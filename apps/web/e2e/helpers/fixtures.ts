/**
 * E2E mock data fixtures — ADR-040 §5 #7.
 *
 * 서버 contract와 1:1 매핑. type drift 방지 위해 apps/web shared types import.
 * Hard Rule 17 정합: examId 리터럴 없음 (테스트 픽스처는 Rule 17 예외 대상이나, EXAM_IDS 경유 유지).
 */

import { EXAM_IDS } from '@thepick/shared';

import type {
  GradeResponse,
  NextResponse,
  StreakSummary,
} from '../../src/components/question/types';
import type {
  ModeStartResponse,
  ModeStatsResponse,
  SessionCompleteResponse,
  SessionDetail,
} from '../../src/components/session/types';
import type { ProgressResponse } from '../../src/lib/study-api';

export const EXAM_ID: string = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

export const MOCK_USER = {
  email: 'e2e-test@thepick.test',
  password: 'e2e-test-1234',
} as const;

export const MOCK_SESSION_ID = 'sess-e2e-mock-0001';

export function makeModeStats(overrides: Partial<ModeStatsResponse> = {}): ModeStatsResponse {
  return {
    examId: EXAM_ID,
    examType: '1st',
    // wired — 실 서버 WIRED_MODES 정합 (WS-0d 도입 시 본 픽스처 미갱신으로 E2E 전체
    // 파손됐던 선재 결함을 2026-06-12 수리. WS-5a: category wired=true + categorySubjects).
    modes: [
      { mode: 'category', available: 50, wired: true },
      { mode: 'topic', available: 30, wired: false },
      { mode: 'confusion', available: 8, wired: false },
      { mode: 'weak', available: 12, wired: true },
      { mode: 'mixed', available: 100, wired: true },
    ],
    categorySubjects: [
      { subject: '상법 보험편', available: 25 },
      { subject: '농학개론 중 재배학 및 원예작물학', available: 25 },
    ],
    weakTop: [],
    confusionTypes: [],
    streak: { current: 3, longest: 7, dailyGoalProgress: 5 },
    dailyGoal: 20,
    ...overrides,
  };
}

export function makeProgress(
  daysCount = 7,
  overrides: Partial<ProgressResponse> = {},
): ProgressResponse {
  const today = new Date();
  const daily = Array.from({ length: daysCount }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (daysCount - 1 - i));
    return {
      date: d.toISOString().slice(0, 10),
      cardsDistinct: i % 4 === 0 ? 8 : 3,
      isToday: i === daysCount - 1,
    };
  });
  return {
    examId: EXAM_ID,
    examType: '1st',
    days: daysCount,
    dailyGoal: 20,
    daily,
    subjects: [
      { subject: '농업재해보험법', total: 40, mastered: 28, masteryPct: 0.7 },
      { subject: '농작물재해보험', total: 60, mastered: 18, masteryPct: 0.3 },
    ],
    streak: { current: 3, longest: 7, dailyGoalProgress: 5 },
    ...overrides,
  };
}

/**
 * WS-5c — GET /api/progress/due 픽스처 (DueQueue 위젯). 실 서버 응답 shape 정합
 * (progress/routes.ts /due — card_type 무필터: node 행 + exam 카드 행(nodeId null) 모두.
 * 4-Pass MAJOR 정정 2026-06-12).
 */
export interface DueQueueFixture {
  readonly items: ReadonlyArray<{
    readonly id: string;
    readonly nodeId: string | null;
    readonly cardType: string;
    readonly fsrsNextReview: string | null;
  }>;
  readonly count: number;
}

export function makeDueQueue(count = 2): DueQueueFixture {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `up-due-${i + 1}`,
    // 짝수 인덱스 = node 행(시드 NULL 스케줄), 홀수 = exam 카드 행(nodeId null + ISO due).
    nodeId: i % 2 === 0 ? `CONCEPT-00${i + 1}` : null,
    cardType: i % 2 === 0 ? 'flashcard' : 'exam',
    fsrsNextReview: i % 2 === 0 ? null : new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  }));
  return { items, count: items.length };
}

export function makeStartResponse(overrides: Partial<ModeStartResponse> = {}): ModeStartResponse {
  return {
    sessionId: MOCK_SESSION_ID,
    mode: 'mixed',
    phase: 'main',
    cardsPlanned: 3,
    cardsCompleted: 0,
    correctCount: 0,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeSessionDetail(overrides: Partial<SessionDetail> = {}): SessionDetail {
  return {
    id: MOCK_SESSION_ID,
    mode: 'mixed',
    modeParams: null,
    phase: 'main',
    cardsPlanned: 3,
    cardsCompleted: 1,
    correctCount: 1,
    startedAt: new Date().toISOString(),
    endedAt: null,
    ...overrides,
  };
}

export function makeNextQuestion(index: number): NextResponse {
  return {
    exhausted: false,
    questions: [
      {
        id: `q-mock-${String(index).padStart(3, '0')}`,
        year: 2024,
        round: 10,
        questionNumber: index,
        subject: '농업재해보험법',
        content: `mock question ${index} — 다음 중 옳은 것은?`,
        examType: '1st',
        topicCluster: null,
        relatedNodes: [],
        sourceCitations: {
          examReferences: [{ year: 2024, round: 10, questionNumber: index }],
          manualPages: [120 + index],
          lawArticles: [],
        },
        inputType: 'multiple_choice',
        choices: [
          { label: 'A', text: '보기 1' },
          { label: 'B', text: '보기 2' },
          { label: 'C', text: '보기 3' },
          { label: 'D', text: '보기 4' },
        ],
        calcVariables: null,
      },
    ],
    session: { id: MOCK_SESSION_ID, mode: 'mixed', phase: 'main' },
  };
}

export const NEXT_EXHAUSTED: NextResponse = {
  exhausted: true,
  questions: [],
  session: { id: MOCK_SESSION_ID, mode: 'mixed', phase: 'main' },
};

export function makeGradeResponse(
  cardsCompleted: number,
  streak: StreakSummary = { current: 4, longest: 7, dailyGoalProgress: 6 },
): GradeResponse {
  return {
    isCorrect: true,
    correctAnswer: 'A',
    correctLabel: 'A',
    explanation: '농업재해보험법 제3조 정합.',
    sourceCitations: {
      examReferences: [{ year: 2024, round: 10, questionNumber: cardsCompleted }],
      manualPages: [121],
      lawArticles: ['농업재해보험법 제3조'],
    },
    relatedNodes: [],
    streak,
    session: {
      id: MOCK_SESSION_ID,
      phase: cardsCompleted >= 3 ? 'completed' : 'main',
      cardsCompleted,
      cardsPlanned: 3,
      correctCount: cardsCompleted,
    },
  };
}

export function makeCompleteResponse(
  overrides: Partial<SessionCompleteResponse> = {},
): SessionCompleteResponse {
  return {
    id: MOCK_SESSION_ID,
    mode: 'mixed',
    phase: 'completed',
    cardsPlanned: 3,
    cardsCompleted: 3,
    correctCount: 3,
    correctRate: 1.0,
    startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    endedAt: new Date().toISOString(),
    durationMinutes: 10,
    weakDelta: {
      available: true,
      cardsReviewed: 3,
      stillWeakCount: 1,
      bySubject: [{ subject: '농업재해보험법', reviewed: 3, stillWeak: 1 }],
    },
    ...overrides,
  };
}
