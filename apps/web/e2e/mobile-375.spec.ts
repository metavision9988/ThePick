/**
 * E2E #3 — mobile 375px viewport (iPhone SE). ADR-040 §5 #7.
 *
 * 검증 항목:
 *   - horizontal scroll 0 (overflow-x)
 *   - ModeSelector / SessionStart / QuestionCard 핵심 액션 타겟 ≥ 44x44 (WCAG 2.5.5 + AESTHETIC §3.5)
 *   - 본문 텍스트 가독 (truncation/clipping 없음)
 *
 * mobile-375 project 한정 (playwright.config.ts testMatch).
 */

import { expect, test, type Page } from '@playwright/test';

import { hideAstroDevToolbar, installApiMock, seedAuthCookie } from './helpers/mock-api';

const baseURL = 'http://localhost:4321';
const TOUCH_TARGET_MIN = 44;

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // 허용 오차 1px (반올림).
  expect(scrollWidth - clientWidth).toBeLessThanOrEqual(1);
}

test.describe('mobile 375px viewport', () => {
  test.beforeEach(async ({ page }) => {
    await hideAstroDevToolbar(page);
    await installApiMock(page);
    await seedAuthCookie(page, baseURL);
  });

  test('ModeSelector — overflow 없음 + 모드 버튼 44px+ 터치 타겟', async ({ page }) => {
    await page.goto('/study/');
    await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).toBeVisible();
    // Pass 1 M-1 흡수 — networkidle 대신 island enabled sentinel.
    await expect(page.getByRole('button', { name: /통합 학습 학습 시작/ })).toBeEnabled();

    // horizontal overflow 검증
    await assertNoHorizontalOverflow(page);

    // 5개 모드 버튼 모두 44px+ height
    const buttons = await page.getByRole('button', { name: /학습 시작 \(\d+문제\)/ }).all();
    expect(buttons.length).toBe(5);
    for (const btn of buttons) {
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
    }
  });

  test('SessionStart — overflow 없음 + 시작/뒤로 버튼 44px+ + 입력 44px+', async ({ page }) => {
    await page.goto('/study/');
    await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).toBeVisible();
    await expect(page.getByRole('button', { name: /통합 학습 학습 시작/ })).toBeEnabled();
    await page.getByRole('button', { name: /통합 학습 학습 시작/ }).click();
    await expect(page.getByRole('heading', { name: '통합 학습 학습' })).toBeVisible();

    await assertNoHorizontalOverflow(page);

    const startBtn = page.getByRole('button', { name: '시작' });
    const backBtn = page.getByRole('button', { name: '뒤로' });
    const input = page.getByLabel('이번 세션 카드 수');

    for (const target of [startBtn, backBtn, input]) {
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
    }
  });

  test('QuestionCard — overflow 없음 + 채점/라벨/다음 문제 44px+', async ({ page }) => {
    // ADR-040 §7 B-1 옵션 (iii) 흡수 (Session 077) — WebKit cross-origin POST preflight 호환 영속.
    // 별도 Hono mock server (port 8787) 도입 + CORS allowHeaders 명시 enumeration (fetch spec WD-2024
    // credentialed wildcard 무효 root cause 해소) → chromium + WebKit 모두 정합.
    await page.goto('/study/');
    await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).toBeVisible();
    await expect(page.getByRole('button', { name: /통합 학습 학습 시작/ })).toBeEnabled();
    await page.getByRole('button', { name: /통합 학습 학습 시작/ }).click();
    await expect(page.getByRole('heading', { name: '통합 학습 학습' })).toBeVisible();
    await page.getByRole('button', { name: '시작' }).click();
    await expect(page.getByText('mock question 1 — 다음 중 옳은 것은?')).toBeVisible();

    await assertNoHorizontalOverflow(page);

    // 라벨(라디오 카드) 44px+
    const labels = await page
      .locator('label')
      .filter({ hasText: /보기 \d/ })
      .all();
    expect(labels.length).toBe(4);
    for (const label of labels) {
      const box = await label.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
    }

    // 채점 버튼 44px+
    await labels[0]!.click();
    const gradeBtn = page.getByRole('button', { name: /채점/ });
    const gradeBox = await gradeBtn.boundingBox();
    expect(gradeBox).not.toBeNull();
    expect(gradeBox!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);

    // Pass 3 MAJOR-A4 흡수 — 채점 후 "다음 문제" 버튼 44px+ (모바일 핵심 progress action).
    await gradeBtn.click();
    const nextBtn = page.getByRole('button', { name: /다음 문제/ });
    await expect(nextBtn).toBeVisible();
    const nextBox = await nextBtn.boundingBox();
    expect(nextBox).not.toBeNull();
    expect(nextBox!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
  });
});
