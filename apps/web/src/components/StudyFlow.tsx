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
  fetchSessionDetail,
  redirectToLogin,
  startMode,
} from '@/lib/study-api';

/**
 * Step 3-UX-6c-3 (ADR-040 G-3) — sessionStorage key.
 *
 * 진행 중 세션을 sessionStorage에 영속하여 새로고침 시 자동 복원.
 * sessionStorage (not localStorage) — 탭 종료 시 자동 정리. 다중 탭 격리.
 */
const ACTIVE_SESSION_KEY = 'thepick:active-session';

interface PersistedSession {
  readonly sessionId: string;
  readonly examType: '1st' | '2nd';
  /** session 시작 시점 longest snapshot — 신기록 hero UX 복원 정합 (4-Pass M-3 흡수). */
  readonly baselineLongest: number;
}

function persistActiveSession(value: PersistedSession): void {
  try {
    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(value));
  } catch (err) {
    // private mode / quota exceeded — 복원 미동작 trade-off. CLAUDE.md Rule 3 정합 dev 로깅.
    console.warn('[StudyFlow] sessionStorage write failed (private mode?)', err);
  }
}

function clearActiveSession(): void {
  try {
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch (err) {
    // 동일 fallback. private mode에서는 read도 0건이므로 영향 없음.
    console.warn('[StudyFlow] sessionStorage clear failed', err);
  }
}

function readActiveSession(): PersistedSession | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
  } catch (err) {
    console.warn('[StudyFlow] sessionStorage read failed (private mode?)', err);
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      !('sessionId' in parsed) ||
      !('examType' in parsed)
    ) {
      // schema 변경 또는 외부 조작 — silent corruption 차단 후 정리.
      clearActiveSession();
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj.sessionId !== 'string' ||
      obj.sessionId.length === 0 ||
      (obj.examType !== '1st' && obj.examType !== '2nd')
    ) {
      clearActiveSession();
      return null;
    }
    // baselineLongest는 신규 필드 — 구 schema 호환성: 누락 시 0 fallback (신기록 hero만 약간 손상).
    const baselineLongest =
      typeof obj.baselineLongest === 'number' && Number.isFinite(obj.baselineLongest)
        ? obj.baselineLongest
        : 0;
    return { sessionId: obj.sessionId, examType: obj.examType, baselineLongest };
  } catch (err) {
    // JSON.parse 실패 — schema 변경 또는 외부 조작. CLAUDE.md Rule 3 정합 dev 로깅 + 정리.
    console.warn('[StudyFlow] readActiveSession parse error, clearing', err);
    clearActiveSession();
    return null;
  }
}

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

      // Step 3-UX-6c-3 (ADR-040 G-3) — 진행 중 세션 자동 복원.
      // sessionStorage에 활성 세션이 영속되어 있고 examType이 일치하면 GET /session/:id로 phase 확인.
      // phase !== 'completed' 시 questioning 복원, 그 외 (completed/404/403/401) graceful fallback.
      const persisted = readActiveSession();
      if (persisted !== null && persisted.examType === examType) {
        try {
          const detail = await fetchSessionDetail(persisted.sessionId);
          if (detail.phase !== 'completed') {
            finalizingRef.current = false;
            // 신기록 hero UX 정합 (4-Pass M-3 흡수) — 세션 시작 시점 longest 복원.
            setStreak((prev) => ({ ...prev, baselineLongest: persisted.baselineLongest }));
            setState({
              status: 'questioning',
              stats,
              sessionId: detail.id,
              mode: detail.mode,
              cardsPlanned: detail.cardsPlanned,
            });
            return;
          }
          // 이미 종료된 세션 → 영속 정리 후 mode-select.
          clearActiveSession();
        } catch (restoreErr) {
          // 401/403/404/네트워크 — 정합 fallback. 인증만 redirect 전파.
          if (restoreErr instanceof StudyApiError && restoreErr.kind === 'unauthenticated') {
            redirectToLogin();
            return;
          }
          clearActiveSession();
        }
      } else if (persisted !== null) {
        // examType mismatch — 다른 시험으로 전환된 경우, 영속 정리.
        clearActiveSession();
      }

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
    async (cardsPlanned: number, modeParams?: Record<string, unknown>): Promise<void> => {
      if (state.status !== 'session-start') return;
      setState({
        status: 'starting',
        stats: state.stats,
        mode: state.mode,
        cardsPlanned,
      });
      try {
        // WS-5a — category 는 { subject } modeParams 동반 (SessionStart 픽커가 공급).
        const res = await startMode({
          mode: state.mode,
          cardsPlanned,
          ...(modeParams !== undefined ? { modeParams } : {}),
        });
        finalizingRef.current = false;
        const startBaseline = streak.longest;
        setStreak((prev) => ({ ...prev, baselineLongest: startBaseline }));
        // Step 3-UX-6c-3 — 진행 중 세션 영속 (새로고침 복원 source).
        // baselineLongest 동반 영속 — 신기록 hero UX 정합 (4-Pass M-3 흡수).
        persistActiveSession({
          sessionId: res.sessionId,
          examType,
          baselineLongest: startBaseline,
        });
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
    // streak.longest — handleStart 가 closure 로 읽어 baselineLongest 영속 (4-Pass m 흡수:
    // exhaustive-deps 정합. setStreak 단독 갱신 경로 추가 시 stale 영속 차단).
    [state, streak.longest],
  );

  const finalizeSession = useCallback(
    async (sessionId: string, mode: LearningMode): Promise<void> => {
      // double-finalize race 방지 — onGraded + onExhausted 동시 fire 가능.
      if (finalizingRef.current) return;
      finalizingRef.current = true;
      setState({ status: 'completing', sessionId, mode });
      try {
        const result = await completeSession(sessionId);
        // Step 3-UX-6c-3 — 세션 종료 시 sessionStorage 영속 정리.
        clearActiveSession();
        setState({ status: 'summary', result });
      } catch (err) {
        if (err instanceof StudyApiError && err.kind === 'unauthenticated') {
          redirectToLogin();
          return;
        }
        // 4-Pass M-1 흡수 — finalize 실패 시 sessionStorage는 의도적으로 유지.
        // 서버 측 트랜잭션 상태(complete 성공 vs 부분 실패)가 불명확하므로 클라이언트 자가 정리하면
        // 재시도 경로가 끊긴다. 사용자가 "다시 시도" → loadModes() → readActiveSession() →
        // fetchSessionDetail() phase 검사로 자가 치유 (completed면 정리, !=completed면 복원).
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
        categorySubjects={state.stats.categorySubjects}
        disabled={state.status === 'starting'}
        onStart={(c, mp) => void handleStart(c, mp)}
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
