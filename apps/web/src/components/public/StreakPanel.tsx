/**
 * StreakPanel — 스트릭 + 30일 dot strip (FE-7, claudeDesign progress-viz C).
 *
 * 데이터 = 100% 로컬(local-progress IndexedDB, G-1 서버 user 데이터 0).
 * 하드 룰: 폭죽·트로피 금지 — 담백한 그리드(완료 indigo / 오늘 outline)만.
 */

import { useEffect, useState } from 'react';
import { todayDateString } from '@thepick/learning-modes';
import { getLocalProgressDb, getStreak } from '@/lib/local-progress';
import { IconFlame } from './icons';

const STRIP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

interface StreakView {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly dailyGoal: number;
  readonly todayCount: number;
  /** 오래된 날 → 오늘 순 30칸, 학습일 여부. */
  readonly days: readonly boolean[];
}

async function loadStreakView(): Promise<StreakView> {
  const db = getLocalProgressDb();
  const streak = await getStreak(db);
  const now = new Date();
  const today = todayDateString(now);

  // 최근 30일(KST 날짜 단위) 학습일 집합 — reviewedAt(ISO) → KST 날짜 버킷.
  // 4-Pass MINOR: 최고(最古) 칸이 KST 일 경계에 걸쳐 부분 누락되지 않도록 +1일 여유 조회.
  const cutoffIso = new Date(now.getTime() - (STRIP_DAYS + 1) * DAY_MS).toISOString();
  const recent = await db.reviews.where('reviewedAt').aboveOrEqual(cutoffIso).toArray();
  const studiedDates = new Set(recent.map((r) => todayDateString(new Date(r.reviewedAt))));

  const days: boolean[] = [];
  let todayCount = 0;
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const date = todayDateString(new Date(now.getTime() - i * DAY_MS));
    days.push(studiedDates.has(date));
  }
  todayCount = recent.filter((r) => todayDateString(new Date(r.reviewedAt)) === today).length;

  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    dailyGoal: streak.dailyGoal,
    todayCount,
    days,
  };
}

interface StreakPanelProps {
  /** recordReview 후 부모가 증가 — 재조회 트리거. */
  readonly refreshKey: number;
}

export function StreakPanel({ refreshKey }: StreakPanelProps) {
  const [view, setView] = useState<StreakView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadStreakView()
      .then((v) => {
        if (!cancelled) setView(v);
      })
      .catch((err) => {
        // IDB 불가 환경(프라이빗 모드 등) — 패널만 접고 학습 흐름은 유지.
        console.warn('[public] streak load failed', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (failed) return null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
          <span className="text-amber-700">
            <IconFlame />
          </span>
          연속 학습
        </h2>
        {view !== null && (
          <span className="text-sm tabular-nums text-gray-500">
            오늘 {view.todayCount}
            <span className="text-gray-400"> / 목표 {view.dailyGoal}</span>
          </span>
        )}
      </div>

      {view === null ? (
        <div className="mt-3 h-6 w-40 animate-pulse rounded bg-gray-100" aria-hidden="true" />
      ) : (
        <>
          <p className="mt-2 text-sm text-gray-900">
            <span className="text-2xl font-medium tabular-nums text-indigo-600">
              {view.currentStreak}
            </span>
            <span className="ml-1 text-gray-500">일 연속 · 최장 {view.longestStreak}일</span>
          </p>
          <div
            className="mt-3 grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${STRIP_DAYS}, 1fr)` }}
            role="img"
            aria-label={`최근 ${STRIP_DAYS}일 학습 기록`}
          >
            {view.days.map((studied, i) => {
              const isToday = i === view.days.length - 1;
              return (
                <span
                  key={i}
                  className="aspect-square rounded-sm"
                  style={{
                    backgroundColor: studied ? '#4f46e5' : '#f3f4f6',
                    boxShadow: isToday ? 'inset 0 0 0 1px #1e40af' : undefined,
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
