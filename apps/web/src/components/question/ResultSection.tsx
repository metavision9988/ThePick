/**
 * ResultSection — graded 단계 결과 영역 (bg-gray-50).
 * 정답/해설/출처 always-on (북극성 정합) + 관련 자료만 <details> 토글.
 * Phase 2 baseline 패턴 유지 (dl-dt-dd).
 */

import type { GradeResponse, InputType, EssaySelfRating } from './types';

interface ResultSectionProps {
  readonly grade: GradeResponse;
  readonly inputType: InputType;
  readonly userAnswer: string;
  readonly selfRating: EssaySelfRating | null;
}

function renderUserAnswer(
  inputType: InputType,
  userAnswer: string,
  selfRating: EssaySelfRating | null,
): string {
  if (inputType === 'essay') {
    const ratingLabel =
      selfRating === 'correct' ? '맞음' : selfRating === 'partial' ? '부분' : '틀림';
    return `${ratingLabel} · ${userAnswer.length}자`;
  }
  if (inputType === 'multiple_choice' && userAnswer.length === 1) {
    return userAnswer;
  }
  return userAnswer;
}

export function ResultSection({ grade, inputType, userAnswer, selfRating }: ResultSectionProps) {
  const correctLabel = grade.correctLabel ?? grade.correctAnswer;
  return (
    <section aria-label="채점 결과" className="border-t border-gray-100 bg-gray-50 px-6 py-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {grade.isCorrect ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
            정답
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            오답
          </span>
        )}
        <span className="text-xs text-gray-500">
          내 답:{' '}
          <span className="font-medium text-gray-900">
            {renderUserAnswer(inputType, userAnswer, selfRating)}
          </span>
        </span>
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">정답</dt>
          <dd className="mt-1 text-gray-900">{correctLabel}</dd>
        </div>
        {grade.explanation !== null && grade.explanation !== '' && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">해설</dt>
            <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-gray-900">
              {grade.explanation}
            </dd>
          </div>
        )}
        {grade.sourceCitations.manualPages.length > 0 && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">교재 출처</dt>
            <dd className="mt-1 text-gray-900">
              {grade.sourceCitations.manualPages.map((p) => `p.${p}`).join(' · ')}
            </dd>
          </div>
        )}
        {grade.sourceCitations.lawArticles.length > 0 && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">법조문</dt>
            <dd className="mt-1 text-gray-900">{grade.sourceCitations.lawArticles.join(' · ')}</dd>
          </div>
        )}
      </dl>

      {grade.relatedNodes.length > 0 && (
        <details className="mt-4 group">
          <summary
            className="flex cursor-pointer list-none items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-500"
            style={{ minHeight: 32 }}
          >
            <span>관련 자료 · {grade.relatedNodes.length}</span>
            <span
              aria-hidden="true"
              className="text-gray-400 transition-transform group-open:rotate-90"
            >
              ›
            </span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {grade.relatedNodes.map((n) => (
              <li key={n.id} className="flex items-baseline gap-2 text-xs text-gray-800">
                <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-700">
                  {n.nodeType}
                </span>
                <span className="text-gray-900">{n.name}</span>
                {n.bookPage !== null && <span className="text-gray-500"> · p.{n.bookPage}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
