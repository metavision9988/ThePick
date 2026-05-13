/**
 * ProgressViz — Step 3-UX-6d sidebar A (3 카드 stack).
 *
 * LOCK §1 (`docs/design/responses/step-3-ux-6-LOCK.md`) sidebar A 영속:
 *   - 오늘: dailyGoalProgress ring (47% / 7 / 15 식)
 *   - 스트릭: 최근 7일 dot (월~일, 오늘 강조)
 *   - 과목별 마스터: HBar 5건
 *
 * AESTHETIC §3.2 게이미피케이션 (amber streak / indigo progress / emerald 달성)
 * + §3.3 typography (text-xs uppercase tracking-wide gray-500 헤더) 정합.
 *
 * SVG 직접 그리기 (Recharts/d3 의존성 0) — 번들 크기 정합.
 */

import { useEffect, useState } from 'react';

import {
  type ExamType,
  type ProgressResponse,
  StudyApiError,
  fetchModeStats,
  fetchProgress,
  redirectToLogin,
} from '@/lib/study-api';

/** sidebar A — 7일. full page C — 30일. */
const SIDEBAR_DAYS = 7;
const SUBJECT_LIMIT = 5;

interface RingProps {
  readonly value: number;
  readonly max: number;
  readonly size?: number;
  readonly stroke?: number;
}

function Ring({ value, max, size = 88, stroke = 4 }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(1, value / safeMax));
  const dash = c * pct;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block"
      aria-hidden="true"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={pct >= 1 ? '#10b981' : '#4f46e5'}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/** KST 일자 → 한국어 요일 단일자 (월/화/수/목/금/토/일). */
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

function toWeekdayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  return WEEKDAY_KO[dt.getUTCDay()] ?? '';
}

interface MiniWeekProps {
  readonly daily: ReadonlyArray<{ date: string; cardsDistinct: number; isToday: boolean }>;
}

function MiniWeek({ daily }: MiniWeekProps) {
  return (
    <div className="flex gap-2">
      {daily.map((d) => {
        const done = d.cardsDistinct > 0;
        const label = toWeekdayLabel(d.date);
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded"
              style={{
                aspectRatio: '1 / 1',
                background: done ? '#4f46e5' : '#f3f4f6',
                outline: d.isToday ? '1.5px solid #1e3a8a' : 'none',
                outlineOffset: '1px',
              }}
              title={`${d.date} · ${d.cardsDistinct}장`}
            />
            <span
              className={`text-[10px] tabular-nums ${d.isToday ? 'font-medium text-indigo-700' : 'text-gray-500'}`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface HBarProps {
  readonly label: string;
  readonly value: number; // 0~1
  readonly suffix?: string;
}

function HBar({ label, value, suffix }: HBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="truncate text-gray-700">{label}</span>
        <span className="tabular-nums text-gray-900">
          {pct}%{suffix !== undefined ? <span className="ml-1 text-gray-400">{suffix}</span> : null}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type ProgressVizState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ok';
      readonly progress: ProgressResponse;
      readonly streak: { current: number; longest: number; dailyGoalProgress: number };
    }
  | { readonly status: 'error'; readonly message: string };

interface ProgressVizProps {
  readonly examType?: ExamType;
  readonly days?: number;
}

function formatApiError(err: unknown): string {
  if (err instanceof StudyApiError) {
    switch (err.kind) {
      case 'rate_limited':
        return '요청이 많습니다.';
      case 'forbidden':
        return '접근 권한 없음.';
      case 'not_found':
        return '진도 데이터 없음.';
      case 'validation':
        return '요청 형식 오류.';
      case 'network':
        return '오프라인 — 연결 후 다시 시도해 주세요.';
      case 'service_unavailable':
      default:
        return '진도 로딩 실패.';
    }
  }
  return '진도 로딩 실패.';
}

export function ProgressViz({ examType = '1st', days = SIDEBAR_DAYS }: ProgressVizProps) {
  const [state, setState] = useState<ProgressVizState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [progress, stats] = await Promise.all([
          fetchProgress(examType, days),
          fetchModeStats(examType),
        ]);
        if (cancelled) return;
        setState({ status: 'ok', progress, streak: stats.streak });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof StudyApiError && err.kind === 'unauthenticated') {
          redirectToLogin();
          return;
        }
        setState({ status: 'error', message: formatApiError(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examType, days]);

  if (state.status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-gray-200 bg-white p-5 text-xs text-gray-500"
      >
        진도 불러오는 중…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
      >
        {state.message}
      </div>
    );
  }

  const { progress, streak } = state;
  const dailyGoal = progress.dailyGoal;
  const todayCount = progress.daily.find((d) => d.isToday)?.cardsDistinct ?? 0;
  const remaining = Math.max(0, dailyGoal - todayCount);
  const subjects = progress.subjects.slice(0, SUBJECT_LIMIT);

  return (
    <div className="space-y-3">
      {/* 오늘 */}
      <section
        className="rounded-lg border border-gray-200 bg-white px-5 py-4"
        aria-labelledby="progress-today-heading"
      >
        <h3
          id="progress-today-heading"
          className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          오늘
        </h3>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Ring value={todayCount} max={dailyGoal} size={88} stroke={4} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-medium leading-none tabular-nums text-gray-900">
                {todayCount} / {dailyGoal}
              </span>
              <span className="mt-0.5 text-[10px] tabular-nums text-gray-500">
                {Math.round((todayCount / Math.max(1, dailyGoal)) * 100)}%
              </span>
            </div>
          </div>
          <div className="flex-1 text-sm text-gray-700">
            <div className="text-gray-900">
              남은 카드 <span className="font-medium tabular-nums">{remaining}</span>
            </div>
            <div className="mt-1 text-xs tabular-nums text-gray-500">일일 목표 {dailyGoal}장</div>
          </div>
        </div>
      </section>

      {/* 스트릭 */}
      <section
        className="rounded-lg border border-gray-200 bg-white px-5 py-4"
        aria-labelledby="progress-streak-heading"
      >
        <div className="mb-3 flex items-baseline justify-between">
          <h3
            id="progress-streak-heading"
            className="text-xs font-medium uppercase tracking-wide text-gray-500"
          >
            스트릭
          </h3>
          <div className="text-xs tabular-nums text-gray-500">
            <span className="font-medium text-gray-900">{streak.current}일</span>{' '}
            <span className="text-gray-400">· 최장 {streak.longest}</span>
          </div>
        </div>
        <MiniWeek daily={progress.daily} />
      </section>

      {/* 과목별 마스터 */}
      <section
        className="rounded-lg border border-gray-200 bg-white px-5 py-4"
        aria-labelledby="progress-mastery-heading"
      >
        <div className="mb-3 flex items-baseline justify-between">
          <h3
            id="progress-mastery-heading"
            className="text-xs font-medium uppercase tracking-wide text-gray-500"
          >
            과목별 마스터
          </h3>
          <span className="text-xs text-gray-400">상위 {subjects.length}</span>
        </div>
        {subjects.length > 0 ? (
          <div className="space-y-2.5">
            {subjects.map((s) => (
              <HBar
                key={s.subject}
                label={s.subject}
                value={s.masteryPct}
                suffix={`${s.mastered}/${s.total}`}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">학습 시작 후 surface된다.</p>
        )}
      </section>
    </div>
  );
}
