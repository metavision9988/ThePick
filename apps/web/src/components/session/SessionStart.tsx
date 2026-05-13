/**
 * SessionStart — Step 3-UX-6c LOCK A 단독.
 *
 * 모드 선택 직후. 일일 목표 / 예상 카드 수 / streak 현황 / "시작" 주 버튼.
 * AESTHETIC.md §3.3b 좌측 1px 컬러 보더 hint + §3.2 + §3.3.
 */

import { useState } from 'react';

import type { LearningMode } from './types';
import { MODE_META } from './types';

interface SessionStartProps {
  readonly mode: LearningMode;
  readonly available: number;
  readonly streakCurrent: number;
  readonly streakLongest: number;
  readonly disabled: boolean;
  readonly onStart: (cardsPlanned: number) => void;
  readonly onCancel: () => void;
}

const DEFAULT_CARDS = 15;
const MIN_CARDS = 1;
const MAX_CARDS = 200;

function estimateMinutes(cards: number): number {
  return Math.max(1, Math.round(cards * 0.8));
}

export function SessionStart({
  mode,
  available,
  streakCurrent,
  streakLongest,
  disabled,
  onStart,
  onCancel,
}: SessionStartProps) {
  const meta = MODE_META[mode];
  const cappedDefault = Math.min(DEFAULT_CARDS, available);
  const [cardsPlanned, setCardsPlanned] = useState<number>(cappedDefault);

  function handleChange(raw: string): void {
    const num = Number.parseInt(raw, 10);
    if (Number.isFinite(num)) {
      const clamped = Math.max(MIN_CARDS, Math.min(num, Math.min(MAX_CARDS, available)));
      setCardsPlanned(clamped);
    }
  }

  return (
    <div>
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">세션 시작</p>
        <h1 className="mt-1 text-2xl font-medium text-gray-900">{meta.label} 학습</h1>
      </header>

      <section
        className="mb-4 rounded-lg border border-gray-200 bg-white px-5 py-4"
        style={{ borderLeftWidth: 2, borderLeftColor: meta.borderColor }}
      >
        <p className="text-sm text-gray-500">{meta.hint}</p>
        <p className="mt-2 text-xs tabular-nums text-gray-500">이 mode 대상 {available}문제</p>
      </section>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white px-5 py-4">
        <label
          htmlFor="cards-planned"
          className="block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          이번 세션 카드 수
        </label>
        <div className="mt-2 flex items-baseline gap-3">
          <input
            id="cards-planned"
            type="number"
            inputMode="numeric"
            min={MIN_CARDS}
            max={Math.min(MAX_CARDS, available)}
            value={cardsPlanned}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled || available === 0}
            className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-base tabular-nums text-gray-900 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
            style={{ minHeight: 44 }}
          />
          <span className="text-xs tabular-nums text-gray-500">
            예상 {estimateMinutes(cardsPlanned)}분
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          최대 {Math.min(MAX_CARDS, available)} · 권장 {Math.min(DEFAULT_CARDS, available)}
        </p>
      </section>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">스트릭</p>
          <p className="inline-flex items-center gap-1.5 text-xs tabular-nums text-gray-500">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 text-amber-500"
            >
              <path d="M10 17.5c3 0 5.5-2.3 5.5-5.3 0-2-1-3.5-2.5-4.7C12 6.5 11.5 5 11.5 3.5c0-.5-.1-1-.3-1.5-1.5 1-3 3-3 5.2 0 1-.5 1.8-1.3 2.3-1 .7-1.4 1.8-1.4 2.7 0 3 2.5 5.3 4.5 5.3Z" />
            </svg>
            <span className="font-medium text-gray-900">{streakCurrent}일</span>
            <span className="text-gray-400">· 최장 {streakLongest}</span>
          </p>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          일일 목표 progress는 첫 채점 후 surface된다 (ADR-040 carry-over).
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ minHeight: 44 }}
        >
          뒤로
        </button>
        <button
          type="button"
          onClick={() => onStart(cardsPlanned)}
          disabled={disabled || available === 0 || cardsPlanned < MIN_CARDS}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          style={{ minHeight: 44 }}
        >
          시작
        </button>
      </div>
    </div>
  );
}
