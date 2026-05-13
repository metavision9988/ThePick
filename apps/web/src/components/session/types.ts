/**
 * Session 흐름 type — Step 3-UX-6c.
 * 서버 endpoint 응답 매핑:
 *   - GET /api/study/mode
 *   - POST /api/study/mode/start
 *   - GET /api/study/session/:id
 *   - POST /api/study/session/:id/complete
 *
 * ADR-039 정합 — 5 mode (category/topic/confusion/weak/mixed) contract.
 */

import type { LearningMode, SessionPhase, StreakSummary } from '@/components/question/types';

export type { LearningMode, SessionPhase, StreakSummary };

export type ExamType = '1st' | '2nd';

/** GET /api/study/mode 응답 mode 항목 */
export interface ModeAvailability {
  readonly mode: LearningMode;
  readonly available: number;
}

/** GET /api/study/mode 응답 약점 카드 top N */
export interface WeakTopEntry {
  readonly cardId: string;
  readonly subject: string | null;
  readonly weakScore: number;
}

/** GET /api/study/mode 응답 confusion type breakdown */
export interface ConfusionTypeEntry {
  readonly type: string;
  readonly count: number;
}

/** GET /api/study/mode 응답 envelope */
export interface ModeStatsResponse {
  readonly examId: string;
  readonly examType: ExamType;
  readonly modes: ReadonlyArray<ModeAvailability>;
  readonly weakTop: ReadonlyArray<WeakTopEntry>;
  readonly confusionTypes: ReadonlyArray<ConfusionTypeEntry>;
  /** Step 3-UX-6c-2 — 진입 시 streak / 일일 목표 progress surface. */
  readonly streak: StreakSummary;
  /** Step 3-UX-6c-2 — streak_records.daily_goal (사용자 설정값 또는 기본 20). */
  readonly dailyGoal: number;
}

/** POST /api/study/mode/start 요청 body */
export interface ModeStartRequest {
  readonly mode: LearningMode;
  readonly modeParams?: Record<string, unknown>;
  readonly cardsPlanned: number;
}

/** POST /api/study/mode/start 응답 */
export interface ModeStartResponse {
  readonly sessionId: string;
  readonly mode: LearningMode;
  readonly phase: SessionPhase;
  readonly cardsPlanned: number;
  readonly cardsCompleted: number;
  readonly correctCount: number;
  readonly startedAt: string;
}

/** GET /api/study/session/:id 응답 */
export interface SessionDetail {
  readonly id: string;
  readonly mode: LearningMode;
  readonly modeParams: Record<string, unknown> | null;
  readonly phase: SessionPhase;
  readonly cardsPlanned: number;
  readonly cardsCompleted: number;
  readonly correctCount: number;
  readonly startedAt: string;
  readonly endedAt: string | null;
}

/** Step 3-UX-6c-2 (ADR-040 G-2) — subject 단위 약점 잔존 누적. */
export interface WeakDeltaSubject {
  readonly subject: string | null;
  readonly reviewed: number;
  readonly stillWeak: number;
}

/**
 * Step 3-UX-6c-2 (ADR-040 G-2) — 세션 종료 시 약점 영역 surface.
 *
 * `available=false` → 서버 쿼리 실패 (silent failure를 정상 0건과 구분, 4-Pass C-1 흡수).
 * UI는 "집계 실패 — 잠시 후 다시 확인" 안내. telemetry `weak_delta_silent_failure` emit.
 */
export interface WeakDelta {
  readonly available: boolean;
  readonly cardsReviewed: number;
  readonly stillWeakCount: number;
  readonly bySubject: ReadonlyArray<WeakDeltaSubject>;
}

/** POST /api/study/session/:id/complete 응답 */
export interface SessionCompleteResponse {
  readonly id: string;
  readonly mode: LearningMode;
  readonly phase: SessionPhase;
  readonly cardsPlanned: number;
  readonly cardsCompleted: number;
  readonly correctCount: number;
  readonly correctRate: number;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMinutes: number;
  /** Step 3-UX-6c-2 — 세션 종료 후 본 세션 distinct card subject 단위 약점 잔존. */
  readonly weakDelta: WeakDelta;
}

/** mode 한국어 라벨 + 설명 + 좌측 1px 컬러 보더 hint (ADR-039 §"결정" 정합) */
export interface ModeMeta {
  readonly id: LearningMode;
  readonly label: string;
  readonly hint: string;
  readonly borderColor: string;
}

export const MODE_META: Readonly<Record<LearningMode, ModeMeta>> = {
  category: {
    id: 'category',
    label: '과목별',
    hint: '과목 단위로 카드 추출',
    borderColor: '#9ca3af',
  },
  topic: {
    id: 'topic',
    label: '주제별',
    hint: 'concept 단위로 집중 학습',
    borderColor: '#4f46e5',
  },
  confusion: {
    id: 'confusion',
    label: '헷갈림',
    hint: 'confusion_type 카드만',
    borderColor: '#f59e0b',
  },
  weak: {
    id: 'weak',
    label: '약점 복습',
    hint: 'weak_score 높은 카드만 (FSRS)',
    borderColor: '#b45309',
  },
  mixed: {
    id: 'mixed',
    label: '통합 학습',
    hint: '모든 카드 혼합',
    borderColor: '#4b5563',
  },
};

/** 클라이언트 측 추천 mode 선택 (ADR-039 §"결정 §4" 정합) — weak > confusion > mixed. */
export function pickRecommendedMode(modes: ReadonlyArray<ModeAvailability>): LearningMode {
  const byMode = new Map(modes.map((m) => [m.mode, m.available]));
  if ((byMode.get('weak') ?? 0) > 0) return 'weak';
  if ((byMode.get('confusion') ?? 0) > 0) return 'confusion';
  return 'mixed';
}

/** SessionPhase 한국어 라벨 (§3.4 정합) */
export const PHASE_LABELS: Readonly<Record<SessionPhase, string>> = {
  warmup: '워밍업',
  main: '본 학습',
  cooldown: '쿨다운',
  completed: '완료',
};
