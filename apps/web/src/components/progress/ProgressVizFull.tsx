/**
 * ProgressVizFull — Step 3-UX-6d full page C.
 *
 * LOCK §1 (`docs/design/responses/step-3-ux-6-LOCK.md`) full page C 영속:
 *   - 오늘 학습 hero (44px 분수 표기)
 *   - 최근 30일 dot strip
 *   - 과목별 마스터 단순 % list (bar 얇게)
 *
 * /study/progress 페이지 전용. sidebar의 ProgressViz와 의존성 공유 (study-api).
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

const FULL_DAYS = 30;
const SUBJECT_LIMIT_FULL = 8;

type State =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ok';
      readonly progress: ProgressResponse;
      readonly streak: { current: number; longest: number; dailyGoalProgress: number };
    }
  | { readonly status: 'error'; readonly message: string };

interface ProgressVizFullProps {
  readonly examType?: ExamType;
}

function formatApiError(err: unknown): string {
  if (err instanceof StudyApiError) {
    if (err.kind === 'rate_limited') return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    if (err.kind === 'forbidden') return '접근 권한이 없습니다.';
    if (err.kind === 'not_found') return '진도 데이터가 없습니다.';
    if (err.kind === 'validation') return '요청 형식 오류 — 다시 시도해 주세요.';
    if (err.kind === 'network') return '오프라인 상태입니다. 네트워크 연결 후 다시 시도해 주세요.';
  }
  return '진도 데이터를 불러오지 못했습니다.';
}

export function ProgressVizFull({ examType = '1st' }: ProgressVizFullProps) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [progress, stats] = await Promise.all([
          fetchProgress(examType, FULL_DAYS),
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
  }, [examType]);

  if (state.status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500"
      >
        진도 불러오는 중…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
      >
        {state.message}
      </div>
    );
  }

  const { progress, streak } = state;
  const todayCount = progress.daily.find((d) => d.isToday)?.cardsDistinct ?? 0;
  const remaining = Math.max(0, progress.dailyGoal - todayCount);
  const todayPct = Math.round((todayCount / Math.max(1, progress.dailyGoal)) * 100);
  const totalStudyDays = progress.daily.filter((d) => d.cardsDistinct > 0).length;
  const subjects = progress.subjects.slice(0, SUBJECT_LIMIT_FULL);

  return (
    <div className="space-y-4">
      {/* 오늘 학습 hero */}
      <section className="rounded-lg border border-gray-200 bg-white px-6 py-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">오늘 학습</h2>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-[44px] font-medium leading-none tabular-nums text-indigo-600">
            {todayCount}
          </span>
          <span className="text-xl leading-none text-gray-300">/</span>
          <span className="text-xl leading-none tabular-nums text-gray-500">
            {progress.dailyGoal}
          </span>
          <span className="ml-auto text-xs tabular-nums text-gray-500">남은 {remaining}장</span>
        </div>
        <div
          role="progressbar"
          aria-label="오늘 목표 진척"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={todayPct}
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              todayPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
            }`}
            style={{ width: `${Math.min(100, todayPct)}%` }}
          />
        </div>
      </section>

      {/* 30일 dot strip */}
      <section className="rounded-lg border border-gray-200 bg-white px-6 py-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">최근 30일</h2>
          <div className="text-xs tabular-nums text-gray-500">
            학습일 <span className="font-medium text-gray-900">{totalStudyDays}일</span>
            <span className="mx-1.5 text-gray-300">·</span>
            현재 <span className="font-medium text-gray-900">{streak.current}일</span>
            <span className="ml-1.5 text-gray-400">최장 {streak.longest}</span>
          </div>
        </div>
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${FULL_DAYS}, 1fr)` }}
          role="img"
          aria-label={`최근 30일 학습 기록. ${totalStudyDays}일 학습 완료.`}
        >
          {progress.daily.map((d) => (
            <div
              key={d.date}
              className="aspect-square rounded-sm"
              style={{
                background: d.cardsDistinct > 0 ? '#4f46e5' : '#f3f4f6',
                outline: d.isToday ? '1.5px solid #1e3a8a' : 'none',
                outlineOffset: '1px',
              }}
              title={`${d.date} · ${d.cardsDistinct}장`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] tabular-nums text-gray-400">
          <span>−{FULL_DAYS - 1}일</span>
          <span>오늘</span>
        </div>
      </section>

      {/* 과목별 마스터 */}
      <section className="rounded-lg border border-gray-200 bg-white px-6 py-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
            과목별 마스터
          </h2>
          <span className="text-xs text-gray-400">상위 {subjects.length}</span>
        </div>
        {subjects.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {subjects.map((s) => {
              // 4-Pass Pass 1 Minor 1 흡수 — clamp 보강 (서버 layer 라인업 변경 시 회귀 방어).
              const pct = Math.min(100, Math.round(Math.max(0, s.masteryPct) * 100));
              return (
                <li key={s.subject} className="flex items-baseline justify-between py-2.5">
                  <span className="truncate text-sm text-gray-700">{s.subject}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-sm tabular-nums text-gray-900">
                      {pct}%
                    </span>
                    <span className="w-16 text-right text-xs tabular-nums text-gray-400">
                      {s.mastered}/{s.total}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">학습 시작 후 surface된다.</p>
        )}
      </section>
    </div>
  );
}
