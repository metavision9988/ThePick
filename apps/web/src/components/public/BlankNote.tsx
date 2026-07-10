/**
 * BlankNote — 빵꾸노트 (FE-4): fill_blank 능동 인출 + M9 점진적 힌트 사다리.
 *
 * 방법론(쪽집게_암기대상_인터랙션_방법론.md §M1+§M9): 답을 먼저 떠올리게 하고,
 * 막히면 초성→첫 글자→글자수→첫 어절 순으로 단서를 늘린다. 사용 힌트 수는
 * FSRS rating 에 반영(부모 onGraded 의 hintsUsed — ratingFromBlankGrade).
 *
 * 정답 원문은 첫 힌트 요청 시 서버 /api/public/reveal 1회로만 수신(클라 선보유 금지 —
 * drip 의미 유지). 채점은 항상 서버 /grade (자가 판정 아님).
 */

import { useCallback, useEffect, useState } from 'react';
import { buildHintLadder, HINT_LEVELS, type HintStep } from '@/lib/hangul-hint';
import { gradePublic, PublicApiError, revealPublic } from './api';
import { ResultBlock } from './ResultBlock';
import { sourceTextOf } from './PublicQuestionCard';
import type { AttemptRecord, PublicGradeResult, PublicQuestion } from './types';

interface BlankNoteProps {
  readonly question: PublicQuestion;
  readonly onGraded: (record: AttemptRecord, grade: PublicGradeResult) => void;
  readonly onNext: (skipped: boolean) => void;
}

export function BlankNote({ question, onGraded, onNext }: BlankNoteProps) {
  const [answerText, setAnswerText] = useState('');
  const [ladder, setLadder] = useState<readonly HintStep[] | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintError, setHintError] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<PublicGradeResult | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  useEffect(() => {
    setAnswerText('');
    setLadder(null);
    setHintsUsed(0);
    setHintError(null);
    setGrade(null);
    setGradeError(null);
    setGrading(false);
  }, [question.id]);

  const canGrade = grade === null && !grading && answerText.trim() !== '';

  const requestHint = useCallback(async () => {
    if (grade !== null || hintsUsed >= HINT_LEVELS) return;
    setHintError(null);
    if (ladder === null) {
      // 첫 힌트 — 정답 원문 1회 수신 후 사다리 파생(이후 단계는 로컬).
      try {
        const revealed = await revealPublic(question.id);
        setLadder(buildHintLadder(revealed.correctAnswer));
        setHintsUsed(1);
      } catch (err) {
        setHintError(
          err instanceof PublicApiError ? err.message : '힌트를 불러오지 못했다. 다시 시도해 보자.',
        );
      }
      return;
    }
    setHintsUsed((n) => Math.min(n + 1, HINT_LEVELS));
  }, [grade, hintsUsed, ladder, question.id]);

  const doGrade = useCallback(async () => {
    if (!canGrade) return;
    setGrading(true);
    setGradeError(null);
    try {
      const result = await gradePublic({ questionId: question.id, answer: answerText.trim() });
      setGrade(result);
      onGraded(
        {
          questionId: question.id,
          subject: question.subject,
          isCorrect: result.isCorrect,
          hintsUsed,
        },
        result,
      );
    } catch (err) {
      setGradeError(
        err instanceof PublicApiError ? err.message : '채점 중 오류가 발생했다. 다시 시도해 보자.',
      );
    } finally {
      setGrading(false);
    }
  }, [answerText, canGrade, hintsUsed, onGraded, question.id, question.subject]);

  const visibleHints = ladder === null ? [] : ladder.slice(0, hintsUsed);
  const nextHintLabel = ladder === null ? '초성' : (ladder[hintsUsed]?.label ?? null);

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <span className="text-sm text-gray-500">{sourceTextOf(question)}</span>
        {question.subject !== null && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {question.subject}
          </span>
        )}
      </header>

      <div className="px-5 py-5">
        <p className="tp-body whitespace-pre-line text-[15px] text-gray-900">{question.content}</p>
      </div>

      <div className="border-t border-gray-100 px-5 py-4">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            먼저 떠올려서 입력
          </span>
          <input
            type="text"
            value={answerText}
            disabled={grade !== null || grading}
            onChange={(e) => setAnswerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canGrade) void doGrade();
            }}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[15px] text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
            style={{ minHeight: 44 }}
            placeholder="답을 입력 (Enter 채점)"
          />
        </label>

        {visibleHints.length > 0 && (
          <dl className="mt-3 grid grid-cols-[64px_1fr] gap-x-3 gap-y-1.5 rounded-lg bg-gray-50 px-3 py-2.5">
            {visibleHints.map((h) => (
              <HintRow key={h.level} hint={h} />
            ))}
          </dl>
        )}

        {hintError !== null && (
          <p className="mt-2 text-sm text-amber-800" role="alert">
            {hintError}
          </p>
        )}

        {grade === null && hintsUsed < HINT_LEVELS && (
          <button
            type="button"
            onClick={() => void requestHint()}
            className="mt-3 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ minHeight: 44 }}
          >
            힌트{nextHintLabel !== null ? ` — ${nextHintLabel}` : ''}
            <span className="ml-2 font-mono text-[11px] text-gray-400">
              {hintsUsed}/{HINT_LEVELS}
            </span>
          </button>
        )}
      </div>

      {grade !== null && (
        <ResultBlock
          isCorrect={grade.isCorrect}
          correctAnswerText={grade.correctAnswer}
          explanation={grade.explanation}
          sourceText={`${sourceTextOf(question)}${question.subject !== null ? ` · ${question.subject}` : ''}`}
        />
      )}

      {gradeError !== null && (
        <p className="border-t border-gray-100 px-5 py-3 text-sm text-amber-800" role="alert">
          {gradeError}
        </p>
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
        {grade === null ? (
          <>
            <button
              type="button"
              onClick={() => onNext(true)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ minHeight: 44 }}
            >
              건너뜀
            </button>
            <button
              type="button"
              disabled={!canGrade}
              onClick={() => void doGrade()}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400"
              style={{ minHeight: 44 }}
            >
              {grading ? '채점 중' : '채점'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onNext(false)}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            style={{ minHeight: 44 }}
          >
            다음 문제
          </button>
        )}
      </footer>
    </article>
  );
}

function HintRow({ hint }: { readonly hint: HintStep }) {
  return (
    <>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{hint.label}</dt>
      <dd className="text-sm tracking-wide text-gray-900">{hint.text}</dd>
    </>
  );
}
