/**
 * Essay — 서술형 textarea + 자기 채점 라디오 (correct / partial / incorrect).
 * 서버 측 자동 채점 불가 → selfRating 의무. submit 버튼은 selfRating 선택 후 활성화.
 */

import type { EssaySelfRating } from './types';

interface EssayProps {
  readonly value: string;
  readonly selfRating: EssaySelfRating | null;
  readonly disabled: boolean;
  readonly onChange: (next: string) => void;
  readonly onSelfRate: (rating: EssaySelfRating) => void;
}

const RATING_LABELS: ReadonlyArray<{ readonly value: EssaySelfRating; readonly label: string }> = [
  { value: 'correct', label: '맞음' },
  { value: 'partial', label: '부분 정답' },
  { value: 'incorrect', label: '틀림' },
];

export function Essay({ value, selfRating, disabled, onChange, onSelfRate }: EssayProps) {
  return (
    <div>
      <label
        htmlFor="study-essay"
        className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500"
      >
        서술형 답안
      </label>
      <textarea
        id="study-essay"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={5}
        maxLength={2000}
        placeholder="답안을 입력하세요. 모범 답안 비교 후 자기 채점합니다."
        className="block w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
      />
      <p className="mt-1 text-right text-[11px] text-gray-400 tabular-nums">
        {value.length} / 2000
      </p>
      <fieldset className="mt-3" disabled={disabled}>
        <legend className="block text-xs font-medium uppercase tracking-wide text-gray-500">
          자기 채점
        </legend>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {RATING_LABELS.map(({ value: rv, label }) => {
            const selected = selfRating === rv;
            return (
              <button
                key={rv}
                type="button"
                onClick={() => onSelfRate(rv)}
                disabled={disabled}
                aria-pressed={selected}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  selected
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                } disabled:cursor-not-allowed disabled:opacity-60`}
                style={{ minHeight: 44 }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
