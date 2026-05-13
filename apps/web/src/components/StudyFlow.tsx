/**
 * StudyFlow — Step 3-UX-6c LOCK A 통합 단일 React Island.
 *
 * 흐름 상태머신:
 *   init (loading mode stats)
 *   → mode-select (ModeSelector)
 *   → session-start (SessionStart, mode 선택 후 cardsPlanned 입력)
 *   → starting (POST /mode/start 진행 중)
 *   → questioning (QuestionCard 무한 stream + grade callback)
 *   → completing (POST /session/:id/complete 진행 중)
 *   → summary (SessionSummary)
 *   → mode-select | exit
 *
 * 에러 분기: any step에서 401 → /auth/login redirect. 503/network → error display + 재시도.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { QuestionCard } from '@/components/QuestionCard';
import { ModeSelector } from '@/components/session/ModeSelector';
import { SessionStart } from '@/components/session/SessionStart';
import { SessionSummary } from '@/components/session/SessionSummary';
import type {
  LearningMode,
  ModeStatsResponse,
  SessionCompleteResponse,
} from '@/components/session/types';
import {
  StudyApiError,
  completeSession,
  fetchModeStats,
  redirectToLogin,
  startMode,
} from '@/lib/study-api';

type FlowState =
  | { readonly status: 'init' }
  | { readonly status: 'mode-select'; readonly stats: ModeStatsResponse }
  | {
      readonly status: 'session-start';
      readonly stats: ModeStatsResponse;
      readonly mode: LearningMode;
    }
  | {
      readonly status: 'starting';
      readonly stats: ModeStatsResponse;
      readonly mode: LearningMode;
      readonly cardsPlanned: number;
    }
  | {
      readonly status: 'questioning';
      readonly stats: ModeStatsResponse;
      readonly sessionId: string;
      readonly mode: LearningMode;
      readonly cardsPlanned: number;
    }
  | { readonly status: 'completing'; readonly sessionId: string; readonly mode: LearningMode }
  | { readonly status: 'summary'; readonly result: SessionCompleteResponse }
  | { readonly status: 'error'; readonly message: string };

interface StudyFlowProps {
  readonly examType?: '1st' | '2nd';
}

interface StreakState {
  readonly current: number;
  readonly longest: number;
  /** session 진입 직전 longest snapshot — 신기록 비교용. */
  readonly baselineLongest: number;
  /** Step 3-UX-6c-2 — GET /mode 응답의 일일 목표 progress (0~1). */
  readonly dailyGoalProgress: number;
  /** Step 3-UX-6c-2 — streak_records.daily_goal 사용자 설정 (없으면 20). */
  readonly dailyGoal: number;
}

const INITIAL_STREAK: StreakState = {
  current: 0,
  longest: 0,
  baselineLongest: 0,
  dailyGoalProgress: 0,
  dailyGoal: 20,
};

function formatApiError(err: unknown): string {
  if (err instanceof StudyApiError) {
    switch (err.kind) {
      case 'rate_limited':
        return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
      case 'validation':
        return '요청 형식 오류 — 다시 시도해 주세요.';
      case 'forbidden':
        return '세션 접근 권한이 없습니다.';
      case 'not_found':
        return '세션을 찾을 수 없습니다.';
      case 'service_unavailable':
      case 'network':
      default:
        return '네트워크 오류 — 잠시 후 다시 시도해 주세요.';
    }
  }
  return '알 수 없는 오류가 발생했습니다.';
}

export function StudyFlow({ examType = '1st' }: StudyFlowProps) {
  const [state, setState] = useState<FlowState>({ status: 'init' });
  const [streak, setStreak] = useState<StreakState>(INITIAL_STREAK);
  /** double-finalize race 방지 (Pass 1 Major M-1) — completing 진입 1회만 허용. */
  const finalizingRef = useRef<boolean>(false);

  const loadModes = useCallback(async (): Promise<void> => {
    setState({ status: 'init' });
    try {
      const stats = await fetchModeStats(examType);
      setStreak({
        current: stats.streak.current,
        longest: stats.streak.longest,
        baselineLongest: stats.streak.longest,
        dailyGoalProgress: stats.streak.dailyGoalProgress,
        dailyGoal: stats.dailyGoal,
      });
      setState({ status: 'mode-select', stats });
    } catch (err) {
      if (err instanceof StudyApiError && err.kind === 'unauthenticated') {
        redirectToLogin();
        return;
      }
      setState({ status: 'error', message: formatApiError(err) });
    }
  }, [examType]);

  useEffect(() => {
    void loadModes();
  }, [loadModes]);

  const handleSelectMode = useCallback(
    (mode: LearningMode) => {
      if (state.status !== 'mode-select') return;
      setState({ status: 'session-start', stats: state.stats, mode });
    },
    [state],
  );

  const handleCancelStart = useCallback(() => {
    if (state.status === 'session-start' || state.status === 'starting') {
      setState({ status: 'mode-select', stats: state.stats });
    }
  }, [state]);

  const handleStart = useCallback(
    async (cardsPlanned: number): Promise<void> => {
      if (state.status !== 'session-start') return;
      setState({
        status: 'starting',
        stats: state.stats,
        mode: state.mode,
        cardsPlanned,
      });
      try {
        const res = await startMode({ mode: state.mode, cardsPlanned });
        finalizingRef.current = false;
        setStreak((prev) => ({ ...prev, baselineLongest: prev.longest }));
        setState({
          status: 'questioning',
          stats: state.stats,
          sessionId: res.sessionId,
          mode: res.mode,
          cardsPlanned: res.cardsPlanned,
        });
      } catch (err) {
        if (err instanceof StudyApiError && err.kind === 'unauthenticated') {
          redirectToLogin();
          return;
        }
        setState({ status: 'error', message: formatApiError(err) });
      }
    },
    [state],
  );

  const finalizeSession = useCallback(
    async (sessionId: string, mode: LearningMode): Promise<void> => {
      // double-finalize race 방지 — onGraded + onExhausted 동시 fire 가능.
      if (finalizingRef.current) return;
      finalizingRef.current = true;
      setState({ status: 'completing', sessionId, mode });
      try {
        const result = await completeSession(sessionId);
        setState({ status: 'summary', result });
      } catch (err) {
        if (err instanceof StudyApiError && err.kind === 'unauthenticated') {
          redirectToLogin();
          return;
        }
        setState({ status: 'error', message: formatApiError(err) });
      } finally {
        finalizingRef.current = false;
      }
    },
    [],
  );

  const handleGraded = useCallback(
    (info: Parameters<NonNullable<Parameters<typeof QuestionCard>[0]['onGraded']>>[0]) => {
      setStreak((prev) => ({
        current: info.streak.current,
        longest: info.streak.longest,
        baselineLongest: prev.baselineLongest,
        dailyGoalProgress: info.streak.dailyGoalProgress,
        dailyGoal: prev.dailyGoal,
      }));
      if (state.status === 'questioning' && info.session?.phase === 'completed') {
        void finalizeSession(state.sessionId, state.mode);
      }
    },
    [state, finalizeSession],
  );

  const handleExhausted = useCallback(() => {
    if (state.status === 'questioning') {
      void finalizeSession(state.sessionId, state.mode);
    }
  }, [state, finalizeSession]);

  const handleContinue = useCallback(() => {
    void loadModes();
  }, [loadModes]);

  if (state.status === 'init') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500"
      >
        학습 모드 정보를 가져오는 중…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-900"
      >
        <p className="mb-3 font-medium">{state.message}</p>
        <button
          type="button"
          onClick={() => void loadModes()}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
          style={{ minHeight: 44 }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (state.status === 'mode-select') {
    return <ModeSelector modes={state.stats.modes} disabled={false} onSelect={handleSelectMode} />;
  }

  if (state.status === 'session-start' || state.status === 'starting') {
    const available = state.stats.modes.find((m) => m.mode === state.mode)?.available ?? 0;
    return (
      <SessionStart
        mode={state.mode}
        available={available}
        streakCurrent={streak.current}
        streakLongest={streak.longest}
        dailyGoal={streak.dailyGoal}
        dailyGoalProgress={streak.dailyGoalProgress}
        disabled={state.status === 'starting'}
        onStart={(c) => void handleStart(c)}
        onCancel={handleCancelStart}
      />
    );
  }

  if (state.status === 'questioning') {
    return (
      <QuestionCard
        examType={examType}
        sessionId={state.sessionId}
        onGraded={handleGraded}
        onExhausted={handleExhausted}
      />
    );
  }

  if (state.status === 'completing') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500"
      >
        세션을 마무리하는 중…
      </div>
    );
  }

  if (state.status === 'summary') {
    const { result } = state;
    const streakDelta = Math.max(0, streak.longest - streak.baselineLongest);
    return (
      <SessionSummary
        mode={result.mode}
        cardsCompleted={result.cardsCompleted}
        cardsPlanned={result.cardsPlanned}
        correctCount={result.correctCount}
        correctRate={result.correctRate}
        durationMinutes={result.durationMinutes}
        streakCurrent={streak.current}
        streakLongest={streak.longest}
        streakDelta={streakDelta}
        weakDelta={result.weakDelta}
        onContinue={handleContinue}
        onExit={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  return null;
}
