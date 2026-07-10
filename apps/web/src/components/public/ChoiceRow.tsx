/**
 * ChoiceRow — 공개 표면 4지선다 보기 행 (claudeDesign question-card.jsx 시각 계약).
 *
 * 정오 색 규약(정본): 신호등 금지 — 내 답 맞음=indigo 좌보더 / 내 답 틀림=amber+X /
 * 정답 표식=emerald+Check. choiceId 계약(공개 API) — 인증 표면 {label} 과 다름.
 */

import { CIRCLED_NUMBERS } from './constants';
import { IconCheck, IconX } from './icons';

export type ChoiceGradeState = 'none' | 'my-correct' | 'my-wrong' | 'answer';

interface ChoiceRowProps {
  readonly index: number;
  readonly text: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  /** 채점 후 상태 — 채점 전엔 'none'. */
  readonly gradeState: ChoiceGradeState;
  readonly onSelect: () => void;
}

function rowClasses(selected: boolean, gradeState: ChoiceGradeState): string {
  if (gradeState === 'my-correct') return 'border-l-2 border-l-indigo-600 bg-white';
  if (gradeState === 'my-wrong') return 'border-l-2 border-l-amber-500 bg-amber-50';
  if (gradeState === 'answer') return 'border-l-2 border-l-emerald-500 bg-emerald-50/40';
  if (selected) return 'border-l-2 border-l-indigo-600 bg-white';
  return 'border-l-2 border-l-transparent bg-white';
}

export function ChoiceRow({
  index,
  text,
  selected,
  disabled,
  gradeState,
  onSelect,
}: ChoiceRowProps) {
  const numberBadge = CIRCLED_NUMBERS[index] ?? String(index + 1);
  return (
    <li>
      <label
        className={`flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 ${rowClasses(selected, gradeState)} ${
          disabled ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'
        }`}
        style={{ minHeight: 44 }}
      >
        <input
          type="radio"
          name="public-mc-choice"
          checked={selected}
          disabled={disabled}
          onChange={onSelect}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs font-medium ${
            selected || gradeState === 'my-correct'
              ? 'border-indigo-600 text-indigo-600'
              : gradeState === 'answer'
                ? 'border-emerald-500 text-emerald-700'
                : 'border-gray-300 text-gray-500'
          }`}
        >
          {numberBadge}
        </span>
        <span className="tp-body flex-1 text-[15px] text-gray-900">{text}</span>
        {gradeState === 'my-wrong' && (
          <span className="mt-0.5 flex-none text-amber-700">
            <IconX />
            <span className="sr-only">내가 고른 오답</span>
          </span>
        )}
        {gradeState === 'answer' && (
          <span className="mt-0.5 flex-none text-emerald-700">
            <IconCheck />
            <span className="sr-only">정답</span>
          </span>
        )}
        {gradeState === 'my-correct' && (
          <span className="mt-0.5 flex-none text-indigo-600">
            <IconCheck />
            <span className="sr-only">정답 — 내가 고른 답</span>
          </span>
        )}
      </label>
    </li>
  );
}
