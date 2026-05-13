/**
 * SessionSummary — Step 3-UX-6c LOCK A 단독.
 *
 * 세션 종료 후 요약: 정답률 hero + 카드 / 시간 / streak 갱신 + 액션 (더 학습 / 종료).
 * AESTHETIC.md §3.3b mode 색상 hint 적용.
 */

import type { LearningMode } from './types';
import { MODE_META } from './types';

interface SessionSummaryProps {
  readonly mode: LearningMode;
  readonly cardsCompleted: number;
  readonly cardsPlanned: number;
  readonly correctCount: number;
  readonly correctRate: number;
  readonly durationMinutes: number;
  readonly streakCurrent: number;
  readonly streakLongest: number;
  readonly streakDelta: number;
  readonly onContinue: () => void;
  readonly onExit: () => void;
}

function formatDuration(min: number): string {
  if (min < 1) return '1분 미만';
  if (min < 60) return `${Math.round(min)}분`;
  const hours = Math.floor(min / 60);
  const rest = Math.round(min % 60);
  return `${hours}시간 ${rest}분`;
}

export function SessionSummary({
  mode,
  cardsCompleted,
  cardsPlanned,
  correctCount,
  correctRate,
  durationMinutes,
  streakCurrent,
  streakLongest,
  streakDelta,
  onContinue,
  onExit,
}: SessionSummaryProps) {
  const meta = MODE_META[mode];
  const pct = Math.round(correctRate * 100);
  const newRecord = streakDelta > 0 && streakCurrent === streakLongest;

  return (
    <div>
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">세션 종료</p>
        <h1 className="mt-1 text-2xl font-medium text-gray-900">{meta.label} 결과</h1>
      </header>

      <section
        className="mb-4 rounded-lg border border-gray-200 bg-white px-5 py-5"
        style={{ borderLeftWidth: 2, borderLeftColor: meta.borderColor }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">정답률</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-medium tabular-nums text-indigo-600">{pct}%</span>
          <span className="text-sm tabular-nums text-gray-500">
            {correctCount} / {cardsCompleted}
          </span>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">카드</p>
          <p className="mt-1 text-base font-medium tabular-nums text-gray-900">
            {cardsCompleted} <span className="text-xs text-gray-500">/ {cardsPlanned}</span>
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">소요</p>
          <p className="mt-1 text-base font-medium tabular-nums text-gray-900">
            {formatDuration(durationMinutes)}
          </p>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">스트릭</p>
          <div className="flex items-center gap-2">
            {newRecord && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                신기록
              </span>
            )}
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
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          약점 영역 변화는 다음 chunk에서 surface된다 (ADR-040 carry-over).
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          style={{ minHeight: 44 }}
        >
          오늘은 여기까지
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          style={{ minHeight: 44 }}
        >
          더 학습하기
        </button>
      </div>
    </div>
  );
}
