/**
 * MultipleChoice — 객관식 라디오 카드 5개 (또는 4개) + 1-5 단축키.
 * 셔플된 보기 (`choices: {label, text}`)를 그대로 표시. 정답 라벨은 서버 측 결정 (클라이언트 비노출).
 */

import { useCallback, useEffect } from 'react';
import type { Choice } from './types';

interface MultipleChoiceProps {
  readonly choices: ReadonlyArray<Choice>;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (label: string) => void;
}

export function MultipleChoice({ choices, value, disabled, onChange }: MultipleChoiceProps) {
  const handleNumeric = useCallback(
    (idx: number) => {
      const choice = choices[idx];
      if (choice !== undefined) onChange(choice.label);
    },
    [choices, onChange],
  );

  useEffect(() => {
    if (disabled) return;
    function onKey(e: KeyboardEvent): void {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = '12345'.indexOf(e.key);
      if (idx >= 0 && idx < choices.length) {
        e.preventDefault();
        handleNumeric(idx);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices.length, disabled, handleNumeric]);

  return (
    <div>
      <fieldset>
        <legend className="mb-3 block text-xs font-medium uppercase tracking-wide text-gray-500">
          정답 선택 (1–5 단축키)
        </legend>
        <ul className="space-y-2">
          {choices.map((c, i) => {
            const selected = c.label === value;
            return (
              <li key={c.label}>
                <label
                  className={`flex items-start gap-3 rounded-lg border px-3 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 ${
                    selected ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 bg-white'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'}`}
                  style={{ minHeight: 44 }}
                >
                  <input
                    type="radio"
                    name="mc-answer"
                    value={c.label}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange(c.label)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs font-medium ${
                      selected
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-gray-300 text-gray-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[15px] leading-relaxed text-gray-900">{c.text}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
}
