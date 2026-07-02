/**
 * mock-server in-memory state (process-scoped).
 *
 * isolation 모델 — ADR-040 §7 옵션 (iii) 채택 시점 (Session 077, 2026-05-14):
 *   - workers=1 강제 (playwright.config.ts)로 동시 spec 실행 차단
 *   - `installApiMock()` 시작 시 admin /__mock/reset 호출로 cross-test pollution 차단
 *   - multi-tenant (X-Test-Session 헤더 기반) isolation은 ADR §8 carry-over (Year 2)
 */

import type { ApiCallCounters, EndpointKey, SerializedOverrides } from './types';

/** 5-페르소나 refactor m-5 흡수 (Session 077) — mock-api.ts와 동일 함수 중복 제거. */
export function emptyCounters(): ApiCallCounters {
  return {
    authLogin: 0,
    modeStats: 0,
    progress: 0,
    progressDue: 0,
    modeStart: 0,
    sessionDetail: 0,
    sessionComplete: 0,
    next: 0,
    grade: 0,
  };
}

export const state: {
  counters: ApiCallCounters;
  callLog: EndpointKey[];
  overrides: SerializedOverrides;
} = {
  counters: emptyCounters(),
  callLog: [],
  overrides: {},
};

export function recordCall(key: EndpointKey): void {
  state.counters[key] += 1;
  state.callLog.push(key);
}

export function resetState(): void {
  state.counters = emptyCounters();
  state.callLog = [];
  state.overrides = {};
}
