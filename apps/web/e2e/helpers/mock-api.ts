/**
 * cross-origin mock 헬퍼 — ADR-040 §7 B-1 옵션 (iii) 흡수 (Session 077, 2026-05-14).
 *
 * 이전 (Session 074~076) page.route() 기반 인터셉트 → 별도 Hono mock server (port 8787) 도입.
 *
 * 본 모듈 책임:
 *   1. mock server state reset (cross-test pollution 차단)
 *   2. page.on('response') 미러링 — counters / callLog 로컬 미러 (spec 시그니처 호환)
 *   3. override() — callback 즉시 실행 → 결과 객체 admin /__mock/override POST
 *   4. seedAuthCookie / hideAstroDevToolbar / waitForReactHydration — 변경 없음
 *   5. CORS_HEADERS / handlePreflight export — spec-level page.route() 사용 시 (api-errors network
 *      error 시나리오) 의도된 abort 핸들러용. mock-api 일반 흐름은 page.route() 미사용.
 *
 * 시그니처 변경:
 *   - `override()` 반환 type: void → Promise<void> (admin POST await 필수)
 *   - spec 4건 (session-restoration, api-errors, silent-failure-surface)은 `await api.override(...)` 의무
 */

import type { Page, Response, Route } from '@playwright/test';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE_PATH,
  CORS_ALLOWED_HEADERS_BASE,
  CORS_ALLOWED_METHODS,
  CORS_EXPOSED_HEADERS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from '@thepick/shared';

import type { GradeResponse } from '../../src/components/question/types';
import { emptyCounters } from '../mock-server/state';
import type {
  ApiCallCounters,
  EndpointKey,
  GradeResponseEntry as ServerGradeResponseEntry,
  SerializedOverrides,
} from '../mock-server/types';

export type { ApiCallCounters, EndpointKey } from '../mock-server/types';

/**
 * /grade override 응답 entry — server-side type re-export.
 * 200 → server contract `GradeResponse` 강제 / 4xx/5xx → `{error}` 강제.
 */
export type GradeResponseEntry = ServerGradeResponseEntry;

/**
 * spec-side override — callback 시그니처 유지 (호출 시점에 즉시 실행하여 결과 객체만 admin POST).
 *
 * 현재 spec 패턴은 모두 단일 객체 반환 (sessionDetailResponse / completeResponse는 매 호출 동일 응답).
 * stateful 동적 응답 (호출마다 다른 결과)이 필요해지면 별도 admin endpoint 또는 multi-response sequence로
 * carry-over (ADR §8).
 */
/**
 * spec-side callback 시그니처는 typed fixture (SessionCompleteResponse 등 interface) 직접 반환을
 * 허용해야 한다. `Record<string, unknown>`은 index signature 부재 interface 거부 → typed fixture
 * 호출 거부 회귀 (ADR-040 §8.1 #4 흡수, Session 078). serialization 경계 (override())에서 cast.
 */
export interface ApiMockOverrides {
  readonly sessionDetailResponse?: () => Readonly<object>;
  readonly nextSequence?: ReadonlyArray<Readonly<object>>;
  readonly gradeSequence?: ReadonlyArray<GradeResponseEntry>;
  readonly completeResponse?: () => Readonly<object>;
  /** promo-1st P4 — /api/public/questions/next 강제 응답 (빈 상태·에러 spec). */
  readonly publicNextResponse?: {
    readonly status: number;
    readonly body: Record<string, unknown>;
  };
}

export interface ApiMock {
  readonly counters: ApiCallCounters;
  /** 호출된 endpoint를 순서대로 누적 — `expect(api.callLog).toEqual([...])` 검증용. */
  readonly callLog: ReadonlyArray<EndpointKey>;
  /** mock server overrides 적용 — admin endpoint POST. spec은 `await` 의무. */
  override(handler: ApiMockOverrides): Promise<void>;
}

const MOCK_SERVER_BASE = 'http://localhost:8787';

/**
 * Cross-origin fetch (apps/web localhost:4321 → mock-server localhost:8787) CORS 통과용 헤더.
 *
 * mock-api 일반 흐름은 mock server CORS middleware가 직접 응답하므로 본 상수 사용 불요.
 * spec이 page.route() 직접 사용 (network abort 등 의도된 시나리오) 시 fulfill에 inline 복제 차단용.
 *
 * 5-페르소나 backend C1+C2 흡수 (Session 077 다음 chunk) — packages/shared/src/constants/cors.ts
 * 단일 source. apps/api/src/index.ts buildCorsOptions + mock-server/server.ts와 동일 enumeration → drift 0.
 */
export const CORS_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Access-Control-Allow-Origin': 'http://localhost:4321',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS.join(', '),
  'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS_BASE.join(', '),
  'Access-Control-Expose-Headers': CORS_EXPOSED_HEADERS.join(', '),
});

/** spec이 page.route() 사용 시 OPTIONS preflight 자동 처리 — abort/fulfill 시나리오 정합. */
export async function handlePreflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers: { ...CORS_HEADERS }, body: '' });
  return true;
}

/**
 * URL + method 기반 endpoint key 매핑.
 *
 * 매칭 순서가 중요 — `/mode/start`를 `/mode`보다 먼저 검사 (LIFO 매칭).
 * `/session/:id/complete`를 `/session/:id`보다 먼저 검사.
 */
function mapToEndpointKey(method: string, url: string): EndpointKey | null {
  if (method === 'OPTIONS') return null;
  if (!url.includes('/api/')) return null;
  if (url.includes('/__mock/')) return null;

  if (url.includes('/api/auth/login')) return 'authLogin';
  if (url.includes('/api/study/mode/start')) return 'modeStart';
  if (url.includes('/api/study/mode')) return 'modeStats';
  if (url.includes('/api/study/progress')) return 'progress';
  if (url.includes('/api/progress/due')) return 'progressDue';
  if (/\/api\/study\/session\/[^/]+\/complete/.test(url)) return 'sessionComplete';
  if (/\/api\/study\/session\/[^/]+(?:\?|$)/.test(url)) return 'sessionDetail';
  if (url.includes('/api/study/next')) return 'next';
  if (url.includes('/api/study/grade')) return 'grade';
  if (url.includes('/api/public/questions/next')) return 'publicNext';
  if (url.includes('/api/public/grade')) return 'publicGrade';
  if (url.includes('/api/public/reveal')) return 'publicReveal';
  return null;
}

export async function installApiMock(page: Page): Promise<ApiMock> {
  // 1. mock server state 초기화 — cross-test pollution 차단.
  // Playwright의 page.request는 page context와 동일 cookie/origin 정책 적용. cross-origin OK.
  const resetResponse = await page.request.post(`${MOCK_SERVER_BASE}/__mock/reset`);
  if (!resetResponse.ok()) {
    throw new Error(
      `[mock-api] mock server reset failed: HTTP ${resetResponse.status()}. ` +
        `mock server (port 8787) 미기동? playwright.config.ts webServer array 확인.`,
    );
  }

  // 2. 로컬 미러 (counters / callLog) — spec 시그니처 호환.
  // page.on('response')는 모든 navigated/fetched response (cross-origin 포함) emit.
  // OPTIONS preflight는 mapToEndpointKey에서 null 반환으로 자동 제외.
  //
  // ADR-040 §8.1 #5 흡수 (Session 078) — page.once('close', off) cleanup.
  // 사유: listener는 counters/callLog 배열을 closure capture. Phase 3 spec 50건+ 누적 시
  // 각 page 컨텍스트마다 listener + 배열 reference가 GC root에 묶이는 잠재 leak.
  // page.off()로 명시 detach → page emitter 참조 chain 끊고 GC 가능 상태로.
  // page 'close' 이벤트는 단발이므로 once 사용 (중복 등록 방지).
  const counters = emptyCounters();
  const callLog: EndpointKey[] = [];

  const responseListener = (response: Response): void => {
    const key = mapToEndpointKey(response.request().method(), response.url());
    if (key === null) return;
    counters[key] += 1;
    callLog.push(key);
  };
  page.on('response', responseListener);
  page.once('close', () => {
    page.off('response', responseListener);
  });

  // 3. override 메서드 — callback 즉시 실행 → 결과 객체 admin POST.
  //
  // ADR-040 §8.1 #4 흡수 (Session 078) — SerializedOverrides 필드는 readonly. 가변 할당 대신 object
  // literal spread로 구성. ESLint type-aware mode (no-floating-promises 도입 chain) 활성화로 surface된
  // 사전 위반. spec strict 모드에서 silent fail 잠재.
  async function override(handler: ApiMockOverrides): Promise<void> {
    // ApiMockOverrides callbacks return `object` (typed fixture compat). Serialization 경계에서
    // `Record<string, unknown>` cast — JSON 직렬화에서 이미 동등. SerializedOverrides는 server-side
    // 직렬화 후 receive shape이므로 strict record type 유지.
    const serialized: SerializedOverrides = {
      ...(handler.sessionDetailResponse !== undefined && {
        sessionDetailResponse: handler.sessionDetailResponse() as Record<string, unknown>,
      }),
      ...(handler.completeResponse !== undefined && {
        completeResponse: handler.completeResponse() as Record<string, unknown>,
      }),
      ...(handler.nextSequence !== undefined && {
        nextSequence: handler.nextSequence as ReadonlyArray<Record<string, unknown>>,
      }),
      ...(handler.gradeSequence !== undefined && { gradeSequence: handler.gradeSequence }),
      ...(handler.publicNextResponse !== undefined && {
        publicNextResponse: handler.publicNextResponse,
      }),
    };
    const overrideResponse = await page.request.post(`${MOCK_SERVER_BASE}/__mock/override`, {
      data: serialized,
    });
    if (!overrideResponse.ok()) {
      throw new Error(`[mock-api] mock server override failed: HTTP ${overrideResponse.status()}`);
    }
  }

  return {
    counters,
    callLog,
    override,
  };
}

/**
 * 인증 cookie를 미리 주입하여 로그인 단계를 우회. restoration/mobile 시나리오용.
 *
 * cookie 도메인은 baseURL host (localhost). HttpOnly는 context cookie API에서 옵션.
 * Pass 2 P2-C1 흡수 — 실제 서버 contract 정합 (`tp_access` + `tp_refresh`).
 */
export async function seedAuthCookie(page: Page, baseURL: string): Promise<void> {
  const url = new URL(baseURL);
  await page.context().addCookies([
    {
      name: ACCESS_TOKEN_COOKIE,
      value: 'mock-access-token-e2e',
      domain: url.hostname,
      path: ACCESS_TOKEN_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: REFRESH_TOKEN_COOKIE,
      value: 'mock-refresh-token-e2e',
      domain: url.hostname,
      path: REFRESH_TOKEN_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * React 19 fiber attribute 기반 hydration sentinel — Astro client:load island 마운트 검증.
 *
 * React 19은 interactive element에 `__reactProps$<key>` / `__reactFiber$<key>` 속성을 attach.
 * SSR-rendered HTML에는 없고 hydration 완료 시 부착 → form 네이티브 submit fallthrough race 차단.
 */
export async function waitForReactHydration(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((sel: string) => {
    const el = document.querySelector(sel);
    if (el === null) return false;
    return Object.keys(el).some(
      (k) => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'),
    );
  }, selector);
}

/**
 * Astro dev toolbar + Vite error overlay 숨김 — 모바일 viewport 하단 액션 영역 가리는 회피.
 * Astro 5 dev 모드 한정. Production build / preview에서는 미존재.
 *
 * Pass 1 C-4 흡수 — `DOMContentLoaded` listener race 시 silent skip 차단 → readyState 분기.
 * Pass 1 M-7 흡수 — vite-error-overlay 등 추가 dev-only overlay도 catch-all 차단.
 */
export async function hideAstroDevToolbar(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const css =
      'astro-dev-toolbar, vite-error-overlay, vite-plugin-checker-error-overlay { display: none !important; }';
    const inject = (): void => {
      const style = document.createElement('style');
      style.setAttribute('data-test-hide-toolbar', '');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
    } else {
      inject();
    }
  });
}

// GradeResponse re-export — spec / fixtures import path 정합 (mock-server/types에서 import하므로
// 본 모듈은 type-only re-export로 broken import 회피).
export type { GradeResponse };
