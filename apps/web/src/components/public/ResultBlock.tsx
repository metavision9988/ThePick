/**
 * ResultBlock — 채점 결과 패널 (claudeDesign ResultBlock 시각 계약).
 * bg-gray-50 결과층 + 정오 Pill + 해설(없으면 정직한 빈 상태 문구).
 */

interface ResultBlockProps {
  readonly isCorrect: boolean;
  /** MC = 정답 보기 텍스트(치환), fill_blank = 정답 원문. */
  readonly correctAnswerText: string;
  readonly explanation: string | undefined;
  /** 출처 표기 — "제N회 (YYYY) 문N · 과목" */
  readonly sourceText: string;
}

export function ResultBlock({
  isCorrect,
  correctAnswerText,
  explanation,
  sourceText,
}: ResultBlockProps) {
  return (
    <section className="border-t border-gray-100 bg-gray-50 px-5 py-4" aria-live="polite">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            isCorrect ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {isCorrect ? '정답' : '오답'}
        </span>
        {!isCorrect && (
          <span className="text-sm text-gray-500">
            정답 <span className="font-medium text-emerald-800">{correctAnswerText}</span>
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-[52px_1fr] gap-x-3 gap-y-2">
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">해설</dt>
        <dd className="tp-body text-sm text-gray-900">
          {explanation !== undefined && explanation !== '' ? (
            explanation
          ) : (
            <span className="text-gray-500">해설 준비 중 — 기출 원문과 정답으로 확인하자.</span>
          )}
        </dd>
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">출처</dt>
        <dd className="text-sm text-gray-700">{sourceText}</dd>
      </dl>
    </section>
  );
}
