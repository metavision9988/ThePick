/**
 * mock-server / mock-api 공통 type — single source of truth.
 *
 * ADR-040 §7 B-1 옵션 (iii) 흡수 (Session 077, 2026-05-14) — page.route() race 제거 +
 * WebKit cross-origin POST preflight 호환을 위해 별도 Hono mock server (port 8787) 도입.
 *
 * server-side type은 callback이 아닌 data만 (mock-api.ts spec-side가 callback 시그니처 유지하되
 * override 시점에 callback 즉시 호출 → 결과 객체만 admin POST). 단일 객체 반환 fixture만 대상 —
 * stateful 동적 응답은 server-side 별도 endpoint로 carry-over (현재 spec 패턴은 모두 단일 객체).
 */

import type { GradeResponse } from '../../src/components/question/types';

export interface ApiCallCounters {
  authLogin: number;
  modeStats: number;
  progress: number;
  /** WS-5c — GET /api/progress/due (DueQueue 위젯). */
  progressDue: number;
  modeStart: number;
  sessionDetail: number;
  sessionComplete: number;
  next: number;
  grade: number;
  /** promo-1st P4/P5 — 무인증 공개 표면 /api/public/*. */
  publicNext: number;
  publicGrade: number;
  publicReveal: number;
  publicOverview: number;
}

export type EndpointKey = keyof ApiCallCounters;

/**
 * /grade override 응답 entry — status 기반 discriminated union (MAJOR-C1, Session 076 정합).
 *
 * 200: server contract `GradeResponse` 강제 → happy response 추가 시 schema drift TypeScript 차단.
 * 4xx/5xx: `{error}` 강제 → QuestionCard.tsx:147 body shape 정합.
 * `headers`: Retry-After (429) / 임의 contract 헤더 주입용 (MINOR-AD3 정합).
 */
export type GradeResponseEntry =
  | {
      readonly status: 200;
      readonly body: GradeResponse;
      readonly headers?: Readonly<Record<string, string>>;
    }
  | {
      readonly status: 400 | 401 | 403 | 422 | 429 | 500 | 502 | 503;
      readonly body: { readonly error: string } & Readonly<Record<string, unknown>>;
      readonly headers?: Readonly<Record<string, string>>;
    };

/**
 * server-side 직렬화된 override (data only).
 *
 * spec-side `ApiMockOverrides` (callback 포함, mock-api.ts)는 page-scoped 시점에 callback 즉시 호출
 * 결과 객체를 본 type으로 변환 후 admin POST. 본 변환은 mock-api.ts `override()` 내부 책임.
 */
export interface SerializedOverrides {
  readonly sessionDetailResponse?: Record<string, unknown>;
  readonly completeResponse?: Record<string, unknown>;
  readonly nextSequence?: ReadonlyArray<Record<string, unknown>>;
  readonly gradeSequence?: ReadonlyArray<GradeResponseEntry>;
  /**
   * promo-1st P4 — /api/public/questions/next 강제 응답 (에러 상태 spec 용).
   * 설정 시 카운터는 증가하되 항상 이 응답 반환.
   */
  readonly publicNextResponse?: {
    readonly status: number;
    readonly body: Record<string, unknown>;
  };
}

/** Admin endpoint /__mock/state 응답 shape — counters + callLog snapshot. */
export interface MockStateSnapshot {
  readonly counters: ApiCallCounters;
  readonly callLog: ReadonlyArray<EndpointKey>;
}
