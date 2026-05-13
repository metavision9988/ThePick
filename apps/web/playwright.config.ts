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
  retries: CI ? 2 : 0,
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
      // devices['iPhone SE']는 webkit 기본이라 별도 install 필요 → chromium으로 통일.
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
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
