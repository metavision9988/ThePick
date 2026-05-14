/**
 * page.route() 기반 apps/api mock — ADR-040 §5 #7.
 *
 * 모든 /api/** 호출을 가로채 deterministic 응답 반환.
 * baseURL은 import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787'
 * → glob '**\/api/**'로 모두 매칭 (호스트 무관).
 *
 * 호출 횟수를 외부에서 검증 가능하도록 ApiMock object 반환.
 */

import type { Page, Route } from '@playwright/test';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@thepick/shared';

import {
  makeCompleteResponse,
  makeGradeResponse,
  makeModeStats,
  makeNextQuestion,
  makeProgress,
  makeSessionDetail,
  makeStartResponse,
  NEXT_EXHAUSTED,
} from './fixtures';

export interface ApiCallCounters {
  authLogin: number;
  modeStats: number;
  progress: number;
  modeStart: number;
  sessionDetail: number;
  sessionComplete: number;
  next: number;
  grade: number;
}

/** Pass 1 C-5 흡수 — 호출 순서 검증을 위해 endpoint 키 시계열 기록. */
export type EndpointKey = keyof ApiCallCounters;

export interface ApiMock {
  readonly counters: ApiCallCounters;
  /** 호출된 endpoint를 순서대로 누적 — `expect(api.callLog).toEqual([...])` 검증용. */
  readonly callLog: ReadonlyArray<EndpointKey>;
  /** 새로 mock 등록 (덮어쓰기). */
  override(handler: ApiMockOverrides): void;
}

export interface ApiMockOverrides {
  /** session detail 응답을 임의로 교체 (restoration 시나리오에서 phase 변경). */
  readonly sessionDetailResponse?: () => Record<string, unknown>;
  /** /next 응답 시퀀스를 직접 제공 (3건 + exhausted 기본값 대체). */
  readonly nextSequence?: ReadonlyArray<Record<string, unknown>>;
  /**
   * /grade 응답 시퀀스 (status + body). N번째 grade 호출 시 sequence[N-1] 적용.
   * body는 status code에 의미 있는 shape (예: 422 → `{ error: 'QUESTION_HAS_NO_ANSWER' }`).
   * payload validation (questionId/userAnswer/inputType) 전 override 우선 적용.
   */
  readonly gradeSequence?: ReadonlyArray<{ status: number; body: Record<string, unknown> }>;
  /** /complete 응답 임의 교체 (silent_failure surface 시나리오에서 weakDelta.available=false 주입). */
  readonly completeResponse?: () => Record<string, unknown>;
}

// Pass 2 P2-C1 흡수 — 실제 서버 contract와 cookie 이름 sync (apps/api/src/auth/routes.ts:717,724).
// schema drift 차단 — Phase 3 launch 직전 server-side auth guard 추가 시 mock도 즉시 정합.
const COOKIE_HEADER = `${ACCESS_TOKEN_COOKIE}=mock-access-token-e2e; Path=/api; HttpOnly; SameSite=Lax, ${REFRESH_TOKEN_COOKIE}=mock-refresh-token-e2e; Path=/api/auth; HttpOnly; SameSite=Lax`;

/**
 * Cross-origin fetch (apps/web localhost:4321 → apps/api localhost:8787) CORS 통과용 헤더.
 * 모든 fulfill 응답 + OPTIONS preflight에 동일하게 적용 — credentials: 'include' 정합.
 *
 * WebKit 정합 — Session 075 ADR-040 §6 WebKit 도입 시 발견:
 *   - WebKit (Safari)은 chromium보다 엄격: ACA-Headers에 wildcard `*` 또는 명시적 enumeration 필요
 *   - Max-Age 캐시 invalidation 차이 (WebKit 5분 vs chromium 7200s) → preflight 매번 재요청 정합
 *   - 따라서 `Access-Control-Allow-Headers: '*'` (모든 헤더 허용) + Max-Age 제거 (캐시 비활성)
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'http://localhost:4321',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
};

function json(
  route: Route,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  });
}

async function handlePreflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
  return true;
}

export async function installApiMock(page: Page): Promise<ApiMock> {
  const counters: ApiCallCounters = {
    authLogin: 0,
    modeStats: 0,
    progress: 0,
    modeStart: 0,
    sessionDetail: 0,
    sessionComplete: 0,
    next: 0,
    grade: 0,
  };
  const callLog: EndpointKey[] = [];
  const overrides: { current: ApiMockOverrides } = { current: {} };

  function record(key: EndpointKey): void {
    counters[key] += 1;
    callLog.push(key);
  }

  await page.route('**/api/auth/login', async (route) => {
    if (await handlePreflight(route)) return;
    record('authLogin');
    await json(route, { ok: true }, 200, { 'Set-Cookie': COOKIE_HEADER });
  });

  await page.route('**/api/study/mode**', async (route) => {
    if (await handlePreflight(route)) return;
    const url = route.request().url();
    // /mode/start는 POST, /mode 단독은 GET — method로 분기
    if (route.request().method() === 'POST' && url.includes('/mode/start')) {
      record('modeStart');
      await json(route, makeStartResponse());
      return;
    }
    if (url.includes('/api/study/mode?') || url.endsWith('/api/study/mode')) {
      record('modeStats');
      await json(route, makeModeStats());
      return;
    }
    // Pass 1 C-2 흡수 — unintercepted fall-through 차단.
    // route.continue()는 실제 apps/api (혹시 dev로 떠있으면)로 빠져 contract drift silently 흡수.
    // 명시 abort + dev 로깅으로 fail-loud.
    console.error(`[mock-api] unhandled /mode URL: ${url}`);
    await route.abort('failed');
  });

  await page.route('**/api/study/progress**', async (route) => {
    if (await handlePreflight(route)) return;
    record('progress');
    const url = new URL(route.request().url());
    const days = Number.parseInt(url.searchParams.get('days') ?? '7', 10);
    const clamped = Number.isFinite(days) && days > 0 && days <= 30 ? days : 7;
    await json(route, makeProgress(clamped));
  });

  // Pass 1 C-1 흡수 — route 등록 순서를 LIFO 매칭 정합으로 명시.
  // Playwright는 마지막 등록 핸들러 먼저 매칭 → /complete 같은 specific 패턴을 NACHHER 등록.
  // (구버전: /complete 먼저 등록 후 /session/* 핸들러에서 endsWith fallback. 동작은 동일하나 fragile.)
  await page.route('**/api/study/session/*', async (route) => {
    if (await handlePreflight(route)) return;
    record('sessionDetail');
    const body = overrides.current.sessionDetailResponse?.() ?? makeSessionDetail();
    await json(route, body);
  });

  // specific 패턴 (LIFO 매칭 우선) — /session/:id/complete를 sessionDetail보다 먼저 catch.
  await page.route('**/api/study/session/*/complete', async (route) => {
    if (await handlePreflight(route)) return;
    record('sessionComplete');
    const body = overrides.current.completeResponse?.() ?? makeCompleteResponse();
    await json(route, body);
  });

  await page.route('**/api/study/next**', async (route) => {
    if (await handlePreflight(route)) return;
    record('next');
    const sequence = overrides.current.nextSequence;
    if (sequence !== undefined) {
      const idx = Math.min(counters.next - 1, sequence.length - 1);
      await json(route, sequence[idx]);
      return;
    }
    // 기본: 3건 + exhausted
    if (counters.next <= 3) {
      await json(route, makeNextQuestion(counters.next));
    } else {
      await json(route, NEXT_EXHAUSTED);
    }
  });

  await page.route('**/api/study/grade**', async (route) => {
    if (await handlePreflight(route)) return;

    // gradeSequence override (api-errors 시나리오) — 1-indexed (N번째 호출 = sequence[N-1]).
    // 시퀀스 초과 시 마지막 항목 반복.
    // Pass 2 MAJOR-A1 흡수 — override path도 payload 존재만 최소 검증 (contract drift 1차 차단).
    const seq = overrides.current.gradeSequence;
    if (seq !== undefined && seq.length > 0) {
      let hasPayload = false;
      try {
        hasPayload = route.request().postDataJSON() !== null;
      } catch {
        hasPayload = false;
      }
      if (!hasPayload) {
        console.error('[mock-api] grade override path: postData null — payload contract drift');
      }
      record('grade');
      const idx = Math.min(counters.grade - 1, seq.length - 1);
      const entry = seq[idx]!;
      await json(route, entry.body, entry.status);
      return;
    }

    // Pass 1 C-5 흡수 — payload contract drift 차단.
    // 실제 server는 questionId/userAnswer/inputType 누락 시 422. mock도 동일 fail-loud.
    let payload: Record<string, unknown> | null = null;
    try {
      payload = route.request().postDataJSON() as Record<string, unknown>;
    } catch {
      payload = null;
    }
    const required = ['questionId', 'userAnswer', 'inputType'] as const;
    const missing = payload === null ? required.slice() : required.filter((k) => !(k in payload));
    if (missing.length > 0) {
      console.error(`[mock-api] grade payload missing fields: ${missing.join(', ')}`);
      await json(route, { error: 'VALIDATION_ERROR', missing }, 422);
      return;
    }
    record('grade');
    const streak = {
      current: 3 + counters.grade,
      longest: Math.max(7, 3 + counters.grade),
      dailyGoalProgress: 5 + counters.grade,
    };
    await json(route, makeGradeResponse(counters.grade, streak));
  });

  return {
    counters,
    callLog,
    override(handler: ApiMockOverrides): void {
      overrides.current = handler;
    },
  };
}

/**
 * 인증 cookie를 미리 주입하여 로그인 단계를 우회. restoration/mobile 시나리오용.
 *
 * cookie 도메인은 baseURL host (localhost). HttpOnly는 context cookie API에서 옵션.
 */
export async function seedAuthCookie(page: Page, baseURL: string): Promise<void> {
  const url = new URL(baseURL);
  // Pass 2 P2-C1 흡수 — 실제 서버 contract 정합 (`tp_access` + `tp_refresh`).
  // Path는 서버 발급 정합 (`/api` + `/api/auth`).
  await page.context().addCookies([
    {
      name: ACCESS_TOKEN_COOKIE,
      value: 'mock-access-token-e2e',
      domain: url.hostname,
      path: '/api',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: REFRESH_TOKEN_COOKIE,
      value: 'mock-refresh-token-e2e',
      domain: url.hostname,
      path: '/api/auth',
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
 *
 * Pass 1 M-1 흡수 — `waitForLoadState('networkidle')`는 Vite HMR WebSocket idle 정의가 fragile.
 * React fiber 검출은 결정적 + Astro/Vite 버전 비의존.
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
 * Astro dev toolbar + Vite error overlay 숨김 — 모바일 viewport에서 화면 하단 액션 영역을 가리는 회피.
 * Astro 5 dev 모드 한정. Production build / preview에서는 미존재.
 *
 * Pass 1 C-4 흡수 — addInitScript는 navigation 전 실행되나 `document.head` 미존재 시점 가능.
 * `DOMContentLoaded` listener가 이미 fired 후 등록되면 silent skip되어 toolbar 노출 silent → readyState 분기.
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
