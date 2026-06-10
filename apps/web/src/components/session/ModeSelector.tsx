/**
 * ModeSelector — Step 3-UX-6c LOCK A 단독.
 * 5 모드 (category/topic/confusion/weak/mixed) 세로 stack
 *   + 좌측 1px 컬러 보더 (mode 정체성 hint)
 *   + 추천 mode amber pill "추천" (1페이지 1회 강조 정합)
 *
 * AESTHETIC.md §3.3b + ADR-039 정합.
 */

import type { LearningMode, ModeAvailability } from './types';
import { MODE_META, pickRecommendedMode } from './types';

interface ModeSelectorProps {
  readonly modes: ReadonlyArray<ModeAvailability>;
  readonly disabled: boolean;
  readonly onSelect: (mode: LearningMode) => void;
}

const ORDER: ReadonlyArray<LearningMode> = ['mixed', 'weak', 'confusion', 'topic', 'category'];

export function ModeSelector({ modes, disabled, onSelect }: ModeSelectorProps) {
  const recommended = pickRecommendedMode(modes);
  const byMode = new Map(modes.map((m) => [m.mode, m]));

  return (
    <div>
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">학습 시작</p>
        <h1 className="mt-1 text-2xl font-medium text-gray-900">학습 모드를 선택하세요</h1>
      </header>
      <ul className="space-y-3">
        {ORDER.map((mid) => {
          const meta = MODE_META[mid];
          const entry = byMode.get(mid);
          const available = entry?.available ?? 0;
          // WS-0d 모드 정직성 (결재 #9 = 비활성 표기): 서버 wired=false = /next 미배선
          // 모드 → "준비 중" disabled. 응답에 항목 자체가 없으면 미배선으로 안전 간주.
          const notWired = entry === undefined || !entry.wired;
          const isRecommended = mid === recommended && !notWired;
          const noCards = available === 0;
          return (
            <li key={mid}>
              <button
                type="button"
                onClick={() => onSelect(mid)}
                disabled={disabled || noCards || notWired}
                aria-label={
                  notWired
                    ? `${meta.label} (준비 중)`
                    : `${meta.label} 학습 시작 (${available}문제)`
                }
                className="group flex w-full items-start gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 text-left transition-colors hover:bg-gray-50 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderLeftWidth: 2, borderLeftColor: meta.borderColor, minHeight: 44 }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-medium text-gray-900">{meta.label}</span>
                    {isRecommended && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        추천
                      </span>
                    )}
                    {notWired && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        준비 중
                      </span>
                    )}
                    {!notWired && noCards && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        대상 없음
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{meta.hint}</p>
                  {/* 미배선 모드의 available 은 미필터 전체 풀 숫자(오해 소지) → 비표시 */}
                  {!notWired && (
                    <p className="mt-2 text-xs tabular-nums text-gray-500">{available}문제</p>
                  )}
                </div>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-1 h-4 w-4 flex-none text-gray-400 group-hover:text-indigo-600"
                >
                  <path d="m7 5 5 5-5 5" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
