/**
 * E2E — WS-5a category 시작 와이어 계약 (5-페르소나 MAJOR 흡수, 2026-06-12).
 *
 * 검증 표적: SessionStart 픽커 → StudyFlow handleStart modeParams spread →
 * startMode JSON body → 서버 422 계약. mock-server /mode/start 가 실 서버와 동형으로
 * body 의 modeParams.subject 를 검증하므로, 본 spec 이 questioning 에 도달한다 =
 * 와이어 전 구간이 실제 fetch 로 통과했다는 기계 증거 (spread 회귀 시 422 → FAIL).
 */

import { expect, test } from '@playwright/test';

import { installApiMock, seedAuthCookie } from './helpers/mock-api';

const BASE_URL = 'http://localhost:4321';

test.describe('category 시작 — subject 와이어 계약', () => {
  test('과목 선택 → 시작 → questioning 도달 (modeParams 와이어 PASS)', async ({ page }) => {
    const api = await installApiMock(page);
    await seedAuthCookie(page, BASE_URL);

    await page.goto('/study/');
    await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).toBeVisible();

    await page.getByRole('button', { name: /과목별 학습 시작/ }).click();
    await expect(page.getByRole('heading', { name: '과목별 학습' })).toBeVisible();

    // 과목 미선택 → 시작 disabled (무필터 세션 차단 — 서버 422 와 이중 방어)
    await expect(page.getByRole('button', { name: '시작' })).toBeDisabled();

    await page.getByRole('radio', { name: /상법 보험편/ }).click();
    await page.getByLabel('이번 세션 카드 수').fill('3');
    await page.getByRole('button', { name: '시작' }).click();

    // mock 이 body.modeParams.subject 부재 시 422 를 돌려주므로(실 서버 동형),
    // questioning 도달 = StudyFlow spread 가 subject 를 실제 전송했다는 증거.
    await expect(page.getByText('mock question 1 — 다음 중 옳은 것은?')).toBeVisible();
    expect(api.counters.modeStart).toBe(1);
  });
});
