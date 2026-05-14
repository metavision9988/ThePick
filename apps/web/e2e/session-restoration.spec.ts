/**
 * E2E #2 — session restoration. ADR-040 §5 #7 + ADR-040 §"2. carry-over" G-3.
 *
 * sessionStorage에 진행 중 세션 영속 → 새로고침 → StudyFlow loadModes에서
 * fetchSessionDetail 호출 → phase !== 'completed' 시 questioning 자동 복원.
 *
 * 추가 검증:
 *   - phase === 'completed' 응답 시 mode-select fallback + sessionStorage 정리
 */

import { expect, test } from '@playwright/test';

import { MOCK_SESSION_ID, makeSessionDetail } from './helpers/fixtures';
import { installApiMock, seedAuthCookie } from './helpers/mock-api';

const baseURL = 'http://localhost:4321';

test.describe('session restoration (ADR-040 G-3)', () => {
  test('진행 중 세션 sessionStorage 복원 → questioning 직접 진입', async ({ page }) => {
    const api = await installApiMock(page);
    await seedAuthCookie(page, baseURL);

    // sessionStorage 미리 주입 — Astro Island가 mount되기 전에 영속 상태를 만들어야 함.
    // page.addInitScript는 매 navigation 직전 실행 — 가장 안정적.
    await page.addInitScript((sessionId: string) => {
      window.sessionStorage.setItem(
        'thepick:active-session',
        JSON.stringify({ sessionId, examType: '1st', baselineLongest: 5 }),
      );
    }, MOCK_SESSION_ID);

    await page.goto('/study/');

    // 복원 성공 — questioning UI 표시 + mode-select 미표시
    await expect(page.getByText('mock question 1 — 다음 중 옳은 것은?')).toBeVisible();
    await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).not.toBeVisible();

    // GET /session/:id 호출 검증
    expect(api.counters.sessionDetail).toBe(1);
    expect(api.counters.modeStats).toBe(1); // loadModes는 항상 1회
  });

  test('완료된 세션 → 자동 정리 + mode-select fallback', async ({ page }) => {
    const api = await installApiMock(page);
    await seedAuthCookie(page, baseURL);
    await api.override({
      sessionDetailResponse: () => ({
        ...makeSessionDetail({ phase: 'completed', endedAt: new Date().toISOString() }),
      }),
    });

    await page.addInitScript((sessionId: string) => {
      window.sessionStorage.setItem(
        'thepick:active-session',
        JSON.stringify({ sessionId, examType: '1st', baselineLongest: 5 }),
      );
    }, MOCK_SESSION_ID);

    await page.goto('/study/');

    // completed 응답 → mode-select로 fallback + sessionStorage 정리
    await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).toBeVisible();
    const storedAfter = await page.evaluate(() =>
      window.sessionStorage.getItem('thepick:active-session'),
    );
    expect(storedAfter).toBeNull();
    expect(api.counters.sessionDetail).toBe(1);
  });

  test('examType mismatch → sessionStorage 정리 + mode-select', async ({ page }) => {
    const api = await installApiMock(page);
    await seedAuthCookie(page, baseURL);

    // 2nd로 영속된 상태에서 study.astro의 1st 진입
    await page.addInitScript((sessionId: string) => {
      window.sessionStorage.setItem(
        'thepick:active-session',
        JSON.stringify({ sessionId, examType: '2nd', baselineLongest: 5 }),
      );
    }, MOCK_SESSION_ID);

    await page.goto('/study/');

    await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).toBeVisible();
    const storedAfter = await page.evaluate(() =>
      window.sessionStorage.getItem('thepick:active-session'),
    );
    expect(storedAfter).toBeNull();
    // examType mismatch는 GET /session/:id 호출 없이 정리만
    expect(api.counters.sessionDetail).toBe(0);
  });
});
