/**
 * QuestionCard — Phase 2 Eval MVP /study 페이지 코어 컴포넌트.
 *
 * plan §5 디자인 A 채택: Linear-style 1단 카드 + Ctrl+Enter / Ctrl+N 단축키 (B 차용).
 * plan §6.4 알고리즘 구현. memory `project_source_citation_requirement.md` 정합 — 출처 surface.
 *
 * 흐름: loading → answering → graded (Ctrl+N) → answering ...
 *      또는 exhausted (모든 문제 시도) / error (인증/네트워크).
 */

import { useCallback, useEffect, useState } from 'react';
import { EXAM_IDS } from '@thepick/shared';

const API_BASE: string = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';
const EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

interface RelatedNode {
  readonly id: string;
  readonly name: string;
  readonly nodeType: string;
  readonly bookPage: number | null;
  readonly pageRef: string | null;
}

interface SourceCitations {
  readonly examReferences: ReadonlyArray<{
    readonly year: number;
    readonly round: number | null;
    readonly questionNumber: number | null;
  }>;
  readonly manualPages: ReadonlyArray<number>;
  readonly lawArticles: ReadonlyArray<string>;
}

interface NextQuestion {
  readonly id: string;
  readonly year: number;
  readonly round: number | null;
  readonly questionNumber: number | null;
  readonly subject: string | null;
  readonly content: string;
  readonly examType: string | null;
  readonly relatedNodes: ReadonlyArray<RelatedNode>;
  readonly sourceCitations: SourceCitations;
}

interface NextResponse {
  readonly exhausted: boolean;
  readonly questions: ReadonlyArray<NextQuestion>;
}

interface GradeResponse {
  readonly isCorrect: boolean;
  readonly correctAnswer: string;
  readonly explanation: string | null;
  readonly sourceCitations: SourceCitations;
  readonly relatedNodes: ReadonlyArray<RelatedNode>;
}

type Phase = 'loading' | 'answering' | 'graded' | 'exhausted' | 'error';

interface QuestionCardProps {
  readonly examType?: '1st' | '2nd';
}

function formatExamReference(ref: SourceCitations['examReferences'][number]): string {
  const round = ref.round !== null ? `제${ref.round}회` : '';
  const num = ref.questionNumber !== null ? `제${ref.questionNumber}문` : '';
  return `${ref.year}년 ${round} ${num}`.trim().replace(/\s+/g, ' ');
}

export function QuestionCard({ examType = '2nd' }: QuestionCardProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [question, setQuestion] = useState<NextQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchNext = useCallback(async (): Promise<void> => {
    setPhase('loading');
    setUserAnswer('');
    setGradeResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/study/next?examId=${EXAM_ID}&examType=${examType}&count=1`,
        { credentials: 'include' },
      );
      if (res.status === 401) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/auth/login?next=${next}`;
        return;
      }
      if (!res.ok) {
        setPhase('error');
        setErrorMsg(`다음 문제 조회 실패 (HTTP ${res.status})`);
        return;
      }
      const body = (await res.json()) as NextResponse;
      if (body.exhausted || body.questions.length === 0) {
        setPhase('exhausted');
        return;
      }
      setQuestion(body.questions[0]!);
      setPhase('answering');
    } catch (err) {
      console.error('next fetch failed', err);
      setPhase('error');
      setErrorMsg('네트워크 오류 — 잠시 후 다시 시도해 주세요.');
    }
  }, [examType]);

  const submit = useCallback(async (): Promise<void> => {
    if (question === null || userAnswer.trim() === '') return;
    try {
      const res = await fetch(`${API_BASE}/api/study/grade?examId=${EXAM_ID}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, userAnswer }),
      });
      if (res.status === 401) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/auth/login?next=${next}`;
        return;
      }
      if (res.status === 422) {
        const body = (await res.json()) as { error?: string };
        if (body.error === 'QUESTION_HAS_NO_ANSWER') {
          setPhase('error');
          setErrorMsg('이 문제는 약술/계산형으로 자동 채점이 불가합니다 (Phase 2 carry-over).');
          return;
        }
        setPhase('error');
        setErrorMsg('입력 형식 오류 — 답안을 다시 확인해 주세요.');
        return;
      }
      if (!res.ok) {
        setPhase('error');
        setErrorMsg(`채점 실패 (HTTP ${res.status})`);
        return;
      }
      const body = (await res.json()) as GradeResponse;
      setGradeResult(body);
      setPhase('graded');
    } catch (err) {
      console.error('grade fetch failed', err);
      setPhase('error');
      setErrorMsg('네트워크 오류 — 잠시 후 다시 시도해 주세요.');
    }
  }, [question, userAnswer]);

  useEffect(() => {
    void fetchNext();
  }, [fetchNext]);

  // Ctrl+Enter — answering phase 에서 채점 / graded phase 에서 다음 문제
  // Ctrl+N — graded phase 에서 다음 문제
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const isCmd = e.ctrlKey || e.metaKey;
      if (isCmd && e.key === 'Enter') {
        if (phase === 'answering') {
          e.preventDefault();
          void submit();
        } else if (phase === 'graded') {
          e.preventDefault();
          void fetchNext();
        }
      }
      if (isCmd && e.key.toLowerCase() === 'n' && phase === 'graded') {
        e.preventDefault();
        void fetchNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, submit, fetchNext]);

  if (phase === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500"
      >
        다음 문제를 가져오는 중…
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-900"
      >
        <p className="mb-3 font-medium">{errorMsg ?? '오류가 발생했습니다.'}</p>
        <button
          type="button"
          onClick={() => void fetchNext()}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (phase === 'exhausted') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-lg font-medium text-gray-900">모든 문제를 시도했습니다</p>
        <p className="mt-2 text-sm text-gray-500">
          {examType === '2nd' ? '2차' : '1차'} 시험 영역 학습 1회전 완료.
        </p>
      </div>
    );
  }

  if (question === null) return null;

  const examRef = question.sourceCitations.examReferences[0];

  return (
    <article className="rounded-lg border border-gray-200 bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {examRef !== undefined && <span>{formatExamReference(examRef)}</span>}
          {question.subject !== null && question.subject !== '' && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
              {question.subject}
            </span>
          )}
        </div>
      </header>

      <div className="px-6 py-6">
        <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-900">
          {question.content}
        </p>
      </div>

      <div className="border-t border-gray-100 px-6 py-5">
        <label htmlFor="study-answer" className="mb-2 block text-sm font-medium text-gray-700">
          정답 입력
        </label>
        <textarea
          id="study-answer"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={phase === 'graded'}
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="정답을 입력하세요 (① / 1 / 1번 모두 동일 처리)"
        />

        <div className="mt-4 flex items-center gap-3">
          {phase === 'answering' && (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={userAnswer.trim() === ''}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              채점 (Ctrl+Enter)
            </button>
          )}
          {phase === 'graded' && (
            <button
              type="button"
              onClick={() => void fetchNext()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              다음 문제 (Ctrl+N)
            </button>
          )}
        </div>
      </div>

      {phase === 'graded' && gradeResult !== null && (
        <section aria-label="채점 결과" className="border-t border-gray-100 bg-gray-50 px-6 py-5">
          <div className="mb-3 flex items-center gap-2">
            {gradeResult.isCorrect ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                정답
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                오답
              </span>
            )}
            <span className="text-xs text-gray-500">
              내 답: <span className="text-gray-900">{userAnswer}</span>
            </span>
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-gray-500">정답</dt>
              <dd className="mt-1 text-gray-900">{gradeResult.correctAnswer}</dd>
            </div>
            {gradeResult.explanation !== null && gradeResult.explanation !== '' && (
              <div>
                <dt className="text-xs font-medium text-gray-500">해설</dt>
                <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-gray-900">
                  {gradeResult.explanation}
                </dd>
              </div>
            )}
            {gradeResult.sourceCitations.manualPages.length > 0 && (
              <div>
                <dt className="text-xs font-medium text-gray-500">교재 출처</dt>
                <dd className="mt-1 text-gray-900">
                  {gradeResult.sourceCitations.manualPages.map((p) => `p.${p}`).join(' · ')}
                </dd>
              </div>
            )}
            {gradeResult.sourceCitations.lawArticles.length > 0 && (
              <div>
                <dt className="text-xs font-medium text-gray-500">법조문</dt>
                <dd className="mt-1 text-gray-900">
                  {gradeResult.sourceCitations.lawArticles.join(' · ')}
                </dd>
              </div>
            )}
            {gradeResult.relatedNodes.length > 0 && (
              <div>
                <dt className="text-xs font-medium text-gray-500">관련 자료</dt>
                <dd className="mt-2 space-y-1">
                  {gradeResult.relatedNodes.map((n) => (
                    <div key={n.id} className="text-xs text-gray-700">
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-gray-700">
                        {n.nodeType}
                      </span>{' '}
                      <span className="text-gray-900">{n.name}</span>
                      {n.bookPage !== null && (
                        <span className="text-gray-500"> · p.{n.bookPage}</span>
                      )}
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </article>
  );
}
