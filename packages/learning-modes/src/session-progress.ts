/**
 * @thepick/learning-modes/session-progress — 학습 세션 phase + streak + timezone 코어 로직.
 *
 * Engine-First 원칙: DB·HTTP·Hono 의존 0. 순수 함수로 단위 검증 가치 大.
 *
 * 사용처:
 *   - apps/api/src/study/routes.ts: /grade + /next + /mode/start 세션 진척 + streak UPSERT
 *   - apps/web: 클라이언트는 type만 import (계산은 server)
 *
 * 정합:
 *   - timezone: 본 프로젝트 사용자 100% 한국 → KST 기본 (UTC+9). plan §13 D5 lock.
 *   - phase threshold: warmup(20%) → main(80%) → cooldown(100%) → completed (plan §4.5).
 *   - streak 분기: null (첫 학습) / today (idempotent) / yesterday (++) / gap (reset to 1).
 *
 * Step 3-UX-5c follow-up: 5-페르소나 리뷰 CRIT/MAJ 흡수 (routes.ts → 단일 패키지 격리).
 */

import { LEARNING_MODES, SESSION_PHASES, type LearningMode, type SessionPhase } from './types.js';

// ---------------------------------------------------------------------------
// Timezone — KST 기본 (한국 사용자 100% 정합)
// ---------------------------------------------------------------------------

/** 한국 표준시 offset. DST 없음, leap second 무영향. */
export const KST_OFFSET_HOURS = 9;
const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

/**
 * timezone offset (UTC+N hours) 기준 YYYY-MM-DD 문자열 반환.
 *
 * KST default (9시간) — 한국 사용자가 KST 자정에 day boundary roll over 인식.
 * 다른 시험 도메인 (다른 국가) 확장 시 offsetHours 인자로 전환.
 *
 * 예) KST 2026-05-13 09:00 = UTC 2026-05-13 00:00 → todayDateString() = '2026-05-13'
 *     KST 2026-05-13 08:59 = UTC 2026-05-12 23:59 → todayDateString() = '2026-05-13'
 */
export function todayDateString(
  now: Date = new Date(),
  offsetHours: number = KST_OFFSET_HOURS,
): string {
  const shifted = new Date(now.getTime() + offsetHours * HOUR_IN_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * 두 YYYY-MM-DD 일자가 정확히 1일 차이인지 검증 (timezone 무관 string 비교).
 *
 * 입력 형식 비정상 (Date.parse 실패) 시 false 반환 (silent corruption 차단).
 * 같은 timezone 기준 yyyy-mm-dd 만 비교하므로 KST/UTC 의존 X.
 */
export function isOneDayApart(earlier: string, later: string): boolean {
  const earlierMs = Date.parse(`${earlier}T00:00:00Z`);
  const laterMs = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(earlierMs) || !Number.isFinite(laterMs)) return false;
  return laterMs - earlierMs === DAY_IN_MS;
}

export interface DayBoundsUtc {
  /** UTC ISO 8601 — KST(또는 offset) 기준 day 시작 시각. study_reviews COUNT range scan inclusive. */
  readonly startUtc: string;
  /** UTC ISO 8601 — 다음 day 시작 시각 (exclusive). */
  readonly endUtc: string;
}

/**
 * YYYY-MM-DD (특정 timezone offset 기준) → UTC ISO 8601 day 경계 [start, end).
 *
 * study_reviews 인덱스 (`user_id, reviewed_at DESC`) 활용 가능한 range scan용 boundary.
 * `substr(reviewed_at, 1, 10) = ?` 패턴 (인덱스 미활용, full scan) 대체.
 *
 * KST default — 한국 사용자 100% 정합.
 */
export function dayBoundsUtc(date: string, offsetHours: number = KST_OFFSET_HOURS): DayBoundsUtc {
  const startKstMs = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(startKstMs)) {
    throw new Error(`invalid date: ${date} (expected YYYY-MM-DD)`);
  }
  // KST day 00:00 = UTC (day - offsetHours)
  const startUtcMs = startKstMs - offsetHours * HOUR_IN_MS;
  const endUtcMs = startUtcMs + DAY_IN_MS;
  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Phase progression (plan §4.5 — 20% / 80% / 100% threshold)
// ---------------------------------------------------------------------------

/** warmup → main 전환 비율. */
export const PHASE_THRESHOLD_WARMUP = 0.2;
/** main → cooldown 전환 비율. */
export const PHASE_THRESHOLD_COOLDOWN = 0.8;

/**
 * cards_completed / cards_planned 비율로 phase 결정.
 *
 *   - warmup:    [0, 0.2)
 *   - main:      [0.2, 0.8)
 *   - cooldown:  [0.8, 1.0)
 *   - completed: ≥ 1.0
 *
 * cardsPlanned ≤ 0 입력 (비정상)은 'completed' fallback (방어적).
 */
export function computePhaseFromProgress(
  cardsCompleted: number,
  cardsPlanned: number,
): SessionPhase {
  if (cardsPlanned <= 0) return 'completed';
  const ratio = cardsCompleted / cardsPlanned;
  if (ratio >= 1) return 'completed';
  if (ratio >= PHASE_THRESHOLD_COOLDOWN) return 'cooldown';
  if (ratio >= PHASE_THRESHOLD_WARMUP) return 'main';
  return 'warmup';
}

// ---------------------------------------------------------------------------
// Streak 갱신 (D5 lock — 일일 학습 연속 카운트)
// ---------------------------------------------------------------------------

export interface StreakInput {
  readonly lastStudyDate: string | null;
  readonly currentStreak: number;
  readonly longestStreak: number;
}

export interface StreakUpdate {
  readonly lastStudyDate: string;
  readonly currentStreak: number;
  readonly longestStreak: number;
  /** lastStudyDate 변경 여부 (UPDATE 필요성 판정용). same-day 호출 시 false. */
  readonly changed: boolean;
}

/**
 * streak 갱신 분기 (last_study_date 기준).
 *
 * 분기:
 *   - last_study_date === today: unchanged (idempotent)
 *   - last_study_date === yesterday: current_streak += 1
 *   - last_study_date === null OR else (gap): current_streak = 1 (reset)
 *
 * longest_streak는 항상 max(longest, new_current).
 */
export function computeStreakUpdate(prev: StreakInput, today: string): StreakUpdate {
  if (prev.lastStudyDate === today) {
    return {
      lastStudyDate: today,
      currentStreak: prev.currentStreak,
      longestStreak: prev.longestStreak,
      changed: false,
    };
  }
  const newCurrent =
    prev.lastStudyDate !== null && isOneDayApart(prev.lastStudyDate, today)
      ? prev.currentStreak + 1
      : 1;
  return {
    lastStudyDate: today,
    currentStreak: newCurrent,
    longestStreak: Math.max(prev.longestStreak, newCurrent),
    changed: true,
  };
}

// ---------------------------------------------------------------------------
// DB → narrow type (잘못된 값 silent fallback 차단 위한 logger 콜백 receive)
// ---------------------------------------------------------------------------

/** narrowing 실패 시 호출자 통지용 콜백 (silent corruption 차단). */
export type NarrowingFallback = (
  value: string | null | undefined,
  expected: readonly string[],
) => void;

/**
 * SessionPhase narrowing. DB schema drift (예: 'review' 신규 추가) 시 fallback + 콜백 통지.
 *
 * 호출 측에서 콜백으로 warn 로깅 + telemetry 카운터 영속 → silent fallback 차단.
 */
export function resolveSessionPhase(
  value: string | null | undefined,
  onFallback?: NarrowingFallback,
): SessionPhase {
  if (value === null || value === undefined) {
    onFallback?.(value, SESSION_PHASES);
    return 'warmup';
  }
  const found = SESSION_PHASES.find((p) => p === value);
  if (found !== undefined) return found;
  onFallback?.(value, SESSION_PHASES);
  return 'warmup';
}

/**
 * LearningMode narrowing. DB schema drift 시 fallback + 콜백 통지.
 */
export function resolveLearningMode(
  value: string | null | undefined,
  onFallback?: NarrowingFallback,
): LearningMode {
  if (value === null || value === undefined) {
    onFallback?.(value, LEARNING_MODES);
    return 'mixed';
  }
  const found = LEARNING_MODES.find((m) => m === value);
  if (found !== undefined) return found;
  onFallback?.(value, LEARNING_MODES);
  return 'mixed';
}
