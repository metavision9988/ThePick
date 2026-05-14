/**
 * Playwright E2E 설정 — ADR-040 §5 #7 흡수.
 *
 * 시나리오 3종:
 *   1. happy-path        — 로그인 → 모드 선택 → questioning 3건 → summary 골든 패스
 *   2. session-restoration — questioning 중 새로고침 → sessionStorage 자동 복원
 *   3. mobile-375        — iPhone SE viewport 레이아웃 + 44px+ 터치 타겟
 *
 * 모든 API 호출은 page.route()로 mock — 결정적·고속·네트워크 독립.
 * 백엔드 dependency 없음 (단일 벤더 정합, ADR-040 §5 #7 채택 근거).
 *
 * webServer: astro dev (port 4321). reuseExistingServer dev 한정 — CI는 fresh.
 */

import { defineConfig, devices } from '@playwright/test';

const CI = process.env.CI === 'true' || process.env.CI === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  // 5-페르소나 devops C-D2 / perf M-P1 흡수 (Session 076, 진산 결정 C-2 (a)) — retries 2→1 강등.
  // 본 chunk에서 mobile-webkit SessionStart가 retry로 silent green되는 실 사례 발견 →
  // retry cushion이 race condition을 가린다는 가설 fact 확정. fail-loud 원칙 (Hard Rule +
  // production-quality.md "빈 catch 금지" 동일 맥락) + Year 2 확장 reference로 fail-loud
  // 기본값 확정. 진짜 transient flaky 분리는 ADR-040 §6 M5 carry-over에서 별도 처리.
  retries: CI ? 1 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? [['list'], ['github']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile-375\.spec\.ts$/,
    },
    {
      // chromium + 375x667 viewport + 터치 — ADR-040 §5 #7 명세 (모바일 375px).
      name: 'mobile-375',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        defaultBrowserType: 'chromium',
      },
      testMatch: /mobile-375\.spec\.ts$/,
    },
    {
      // WebKit + 375x667 — ADR-040 §6 carry-over MAJOR-A6 흡수 (Session 075).
      // 실 iOS Safari 95%+ 사용자 환경. devices['iPhone SE']는 webkit 기본 + iOS UA + touch.
      // mobile-375.spec.ts 동일 시나리오를 webkit에서도 검증 → scroll bounce / position:sticky /
      // 100vh viewport / sessionStorage private mode 등 chromium과 다른 동작 silent miss 차단.
      name: 'mobile-webkit',
      use: { ...devices['iPhone SE'] },
      testMatch: /mobile-375\.spec\.ts$/,
    },
  ],
  // ADR-040 §7 B-1 옵션 (iii) 흡수 (Session 077, 2026-05-14).
  //
  // webServer를 array로 — astro dev (4321) + Hono mock server (8787).
  // Playwright는 array의 모든 서버를 병렬 기동 + 각 url readiness 폴링 후 spec 시작.
  //
  // mock server를 별도 process로 분리한 이유 (ADR §7 B-1 carry-over):
  //   - page.route() race condition 제거 (실 production 환경 정합)
  //   - WebKit cross-origin POST preflight 호환 (Hono CORS middleware가 직접 응답)
  //   - apps/api와 동일 Hono stack (contract drift 차단 + 단일 벤더 정합)
  webServer: [
    {
      command: 'pnpm --filter @thepick/web dev',
      url: 'http://localhost:4321',
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: CI ? 'pipe' : 'ignore',
      stderr: 'pipe',
    },
    {
      // Hono mock server (apps/web/e2e/mock-server/start.ts) — tsx로 실행.
      // url은 admin /__mock/health endpoint로 readiness 폴링 (CORS 무관 GET).
      command: 'pnpm --filter @thepick/web e2e:mock-server',
      url: 'http://localhost:8787/__mock/health',
      reuseExistingServer: !CI,
      timeout: 30_000,
      stdout: CI ? 'pipe' : 'ignore',
      stderr: 'pipe',
    },
  ],
});
