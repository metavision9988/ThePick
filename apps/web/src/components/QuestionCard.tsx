/**
 * QuestionCard — Phase 3 학습 UX 코어 컴포넌트 (Step 3-UX-6b).
 *
 * LOCK 채택 안 (A 기본 + C의 context strip 통합):
 *   - A: Phase 2 baseline chrome (rounded-lg border-gray-200, header/body/result, Ctrl+Enter/Ctrl+N)
 *   - C: 본문 위 inline 출처 strip (ContextStrip) — 북극성 출처 surface 1급 정합 강화
 *
 * 분기:
 *   inputType 'multiple_choice' → MultipleChoice (라디오 + 1-5 단축키)
 *   inputType 'fill_blank'      → FillBlank (단일 input + Enter)
 *   inputType 'essay'           → Essay (textarea + self-grade 라디오)
 *   inputType 'calc'            → Calc (number input + 단위)
 *
 * 흐름: loading → answering → graded (Ctrl+N) → answering ... 또는 exhausted / error.
 */

import { useCallback, useEffect, useState } from 'react';
import { EXAM_IDS } from '@thepick/shared';

import { Calc } from '@/components/question/Calc';
import { ContextStrip } from '@/components/question/ContextStrip';
import { Essay } from '@/components/question/Essay';
import { FillBlank } from '@/components/question/FillBlank';
import { MultipleChoice } from '@/components/question/MultipleChoice';
import { ResultSection } from '@/components/question/ResultSection';
import type {
  AnswerPhase,
  AnswerState,
  EssaySelfRating,
  GradeResponse,
  NextQuestion,
  NextResponse,
  SessionProgress,
  StreakSummary,
} from '@/components/question/types';
import { EMPTY_ANSWER } from '@/components/question/types';

const API_BASE: string = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';
const EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

interface QuestionCardProps {
  readonly examType?: '1st' | '2nd';
  readonly sessionId?: string;
  /** 채점 성공 시 fire. StudyFlow가 session.phase==='completed' 감지에 사용. */
  readonly onGraded?: (info: {
    readonly session: SessionProgress | null;
    readonly streak: StreakSummary;
  }) => void;
  /** /next exhausted 시 fire. StudyFlow가 강제 summary 전환에 사용. */
  readonly onExhausted?: () => void;
}

function formatExamReference(year: number, round: number | null, qNum: number | null): string {
  const r = round !== null ? `제${round}회` : '';
  const n = qNum !== null ? `제${qNum}문` : '';
  return `${year}년 ${r} ${n}`.trim().replace(/\s+/g, ' ');
}

function canSubmit(question: NextQuestion, answer: AnswerState): boolean {
  if (question.inputType === 'multiple_choice') return answer.value !== '';
  if (question.inputType === 'essay') {
    return answer.value.trim() !== '' && answer.selfRating !== null;
  }
  return answer.value.trim() !== '';
}

export function QuestionCard({
  examType = '2nd',
  sessionId,
  onGraded,
  onExhausted,
}: QuestionCardProps) {
  const [phase, setPhase] = useState<AnswerPhase>('loading');
  const [question, setQuestion] = useState<NextQuestion | null>(null);
  const [answer, setAnswer] = useState<AnswerState>(EMPTY_ANSWER);
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchNext = useCallback(async (): Promise<void> => {
    setPhase('loading');
    setAnswer(EMPTY_ANSWER);
    setGradeResult(null);
    setErrorMsg(null);
    try {
      const url = new URL(`${API_BASE}/api/study/next`);
      url.searchParams.set('examId', EXAM_ID);
      url.searchParams.set('examType', examType);
      url.searchParams.set('count', '1');
      if (sessionId !== undefined) url.searchParams.set('sessionId', sessionId);

      const res = await fetch(url.toString(), { credentials: 'include' });
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
        if (onExhausted !== undefined) onExhausted();
        return;
      }
      setQuestion(body.questions[0]!);
      setPhase('answering');
    } catch (err) {
      console.error('next fetch failed', err);
      setPhase('error');
      setErrorMsg('네트워크 오류 — 잠시 후 다시 시도해 주세요.');
    }
  }, [examType, sessionId, onExhausted]);

  const submit = useCallback(async (): Promise<void> => {
    if (question === null || !canSubmit(question, answer)) return;
    try {
      const payload: Record<string, unknown> = {
        questionId: question.id,
        userAnswer: answer.value,
        inputType: question.inputType,
      };
      if (question.inputType === 'essay' && answer.selfRating !== null) {
        payload.selfRating = answer.selfRating;
      }
      if (sessionId !== undefined) payload.sessionId = sessionId;

      const res = await fetch(`${API_BASE}/api/study/grade?examId=${EXAM_ID}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/auth/login?next=${next}`;
        return;
      }
      if (res.status === 429) {
        setPhase('error');
        setErrorMsg('연속 채점 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (body?.error === 'QUESTION_HAS_NO_ANSWER') {
          setPhase('error');
          setErrorMsg('이 문제는 정답이 등록되지 않았습니다.');
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
      if (onGraded !== undefined) {
        onGraded({ session: body.session ?? null, streak: body.streak });
      }
    } catch (err) {
      console.error('grade fetch failed', err);
      setPhase('error');
      setErrorMsg('네트워크 오류 — 잠시 후 다시 시도해 주세요.');
    }
  }, [question, answer, sessionId, onGraded]);

  useEffect(() => {
    void fetchNext();
  }, [fetchNext]);

  // Ctrl+Enter — answering phase 채점 / graded phase 다음 문제
  // Ctrl+N — graded phase 또는 choicesMissing 시 다음 문제
  const choicesMissingForShortcut =
    question !== null && question.inputType === 'multiple_choice' && question.choices === null;
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const isCmd = e.ctrlKey || e.metaKey;
      if (isCmd && e.key === 'Enter') {
        if (phase === 'answering' && !choicesMissingForShortcut) {
          e.preventDefault();
          void submit();
        } else if (phase === 'graded' || (phase === 'answering' && choicesMissingForShortcut)) {
          e.preventDefault();
          void fetchNext();
        }
      }
      if (
        isCmd &&
        e.key.toLowerCase() === 'n' &&
        (phase === 'graded' || (phase === 'answering' && choicesMissingForShortcut))
      ) {
        e.preventDefault();
        void fetchNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, choicesMissingForShortcut, submit, fetchNext]);

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
          style={{ minHeight: 44 }}
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

  const isGraded = phase === 'graded';
  const submitDisabled = !canSubmit(question, answer) || isGraded;
  const choicesMissing = question.inputType === 'multiple_choice' && question.choices === null;

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="text-xs text-gray-500">
          {formatExamReference(question.year, question.round, question.questionNumber)}
        </div>
        {question.subject !== null && question.subject !== '' && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {question.subject}
          </span>
        )}
      </header>

      <ContextStrip sourceCitations={question.sourceCitations} />

      <div className="px-6 py-6">
        <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-900">
          {question.content}
        </p>
      </div>

      <div className="border-t border-gray-100 px-6 py-5">
        {choicesMissing && (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            이 문제는 보기 정보가 누락되어 채점할 수 없습니다. 다음 문제로 이동하세요.
          </div>
        )}
        {question.inputType === 'multiple_choice' && question.choices !== null && (
          <MultipleChoice
            choices={question.choices}
            value={answer.value}
            disabled={isGraded}
            onChange={(label) => setAnswer({ value: label, selfRating: null })}
          />
        )}
        {question.inputType === 'fill_blank' && (
          <FillBlank
            value={answer.value}
            disabled={isGraded}
            onChange={(v) => setAnswer({ value: v, selfRating: null })}
          />
        )}
        {question.inputType === 'essay' && (
          <Essay
            value={answer.value}
            selfRating={answer.selfRating}
            disabled={isGraded}
            onChange={(v) => setAnswer((prev) => ({ value: v, selfRating: prev.selfRating }))}
            onSelfRate={(rating: EssaySelfRating) =>
              setAnswer((prev) => ({ value: prev.value, selfRating: rating }))
            }
          />
        )}
        {question.inputType === 'calc' && (
          <Calc
            value={answer.value}
            disabled={isGraded}
            onChange={(v) => setAnswer({ value: v, selfRating: null })}
            variables={question.calcVariables}
          />
        )}

        <div className="mt-4 flex items-center gap-3">
          {phase === 'answering' && !choicesMissing && (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitDisabled}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              style={{ minHeight: 44 }}
            >
              채점 (Ctrl+Enter)
            </button>
          )}
          {(isGraded || choicesMissing) && (
            <button
              type="button"
              onClick={() => void fetchNext()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              style={{ minHeight: 44 }}
            >
              다음 문제 (Ctrl+N)
            </button>
          )}
        </div>
      </div>

      {isGraded && gradeResult !== null && (
        <ResultSection
          grade={gradeResult}
          inputType={question.inputType}
          userAnswer={answer.value}
          selfRating={answer.selfRating}
        />
      )}
    </article>
  );
}
