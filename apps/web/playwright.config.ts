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
  webServer: {
    // M2 흡수 (devops Pass 1) — 명시 filter로 모노레포 root에서도 정확한 패키지 지정.
    // 향후 root에 dev script 추가 시 silent 충돌 차단.
    command: 'pnpm --filter @thepick/web dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !CI,
    // M3 흡수 (devops Pass 2) — CI cold container에서 Astro 5 Vite compile + workspace symlink +
    // Tailwind JIT 합산 35-50s. 기존 60s는 마진 10-25s만 남아 flaky 위험. 120s로 상향.
    timeout: 120_000,
    // m2 흡수 (devops Pass 1) — CI 실패 시 Astro 부팅 에러 (port conflict / build error)를
    // GitHub Actions log에 자동 surface (디버깅 단서 보존).
    stdout: CI ? 'pipe' : 'ignore',
    stderr: 'pipe',
  },
});
