/**
 * E2E — WS-5c DueQueue 복습 큐 위젯 (플레이북 S9 완료 게이트 G2: due UI 노출 E2E).
 *
 * 흐름: cookie 시드 → /study/ → sidebar DueQueue 가 /api/progress/due 를 호출해
 * due 카운트(mock 기본 2) + 학습 진입 CTA("학습 시작", #study-main 앵커)를 노출.
 *
 * 정직성 계약: CTA 라벨은 "복습 시작"이 아니다 — /study/next 의 due 우선 정렬은
 * PITR(docs/plans/ws-5c-study-next-due-pitr.md) 결재 전 미배선.
 */

import { expect, test } from '@playwright/test';

import { installApiMock, seedAuthCookie } from './helpers/mock-api';

const BASE_URL = 'http://localhost:4321';

test.describe('DueQueue — WS-5c 복습 큐 위젯', () => {
  test('/study 진입 → due 카운트 + 학습 진입 CTA 노출 (G2)', async ({ page }) => {
    const api = await installApiMock(page);
    await seedAuthCookie(page, BASE_URL);

    await page.goto('/study/');
    await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).toBeVisible();

    const widget = page.locator('section[aria-label="복습 예정"]');
    await expect(widget).toBeVisible();
    await expect(widget.getByText('2', { exact: true })).toBeVisible();

    const cta = widget.getByRole('link', { name: '학습 시작' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '#study-main');

    await expect.poll(() => api.counters.progressDue).toBeGreaterThanOrEqual(1);
  });
});
