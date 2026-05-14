/**
 * E2E study flow boilerplate — error path / silent_failure surface 시나리오 공통 setup.
 *
 * happy-path.spec.ts 패턴에서 첫 문제 표시까지를 헬퍼로 추출.
 * 본 헬퍼는 mock + cookie + hydration 모두 처리 — 후속 시나리오는 비즈니스 로직만 검증.
 */

import { expect, type Page } from '@playwright/test';

import { MOCK_USER } from './fixtures';
import { installApiMock, seedAuthCookie, waitForReactHydration, type ApiMock } from './mock-api';

const BASE_URL = 'http://localhost:4321';

/**
 * 로그인 + 모드 선택 + 세션 시작 + 첫 문제 표시까지 진행. 후속 시나리오는 grade 단계만 다룸.
 *
 * @param cardsPlanned 시작 시 카드 수 (기본 3). gradeSequence와 정합하도록 호출자가 지정.
 */
export async function startSessionToFirstQuestion(
  page: Page,
  options: { readonly cardsPlanned?: number } = {},
): Promise<ApiMock> {
  const api = await installApiMock(page);
  await seedAuthCookie(page, BASE_URL);

  await page.goto('/auth/login?next=%2Fstudy%2F');
  await expect(page.getByRole('heading', { name: '로그인', level: 1 })).toBeVisible();
  await waitForReactHydration(page, 'form');
  await page.getByLabel('이메일').fill(MOCK_USER.email);
  await page.getByLabel('비밀번호').fill(MOCK_USER.password);
  await Promise.all([
    page.waitForResponse('**/api/auth/login'),
    page.getByRole('button', { name: '로그인' }).click(),
  ]);

  await page.waitForURL('**/study/');
  await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).toBeVisible();

  await page.getByRole('button', { name: /통합 학습 학습 시작/ }).click();
  await expect(page.getByRole('heading', { name: '통합 학습 학습' })).toBeVisible();

  const cards = options.cardsPlanned ?? 3;
  await page.getByLabel('이번 세션 카드 수').fill(String(cards));
  await page.getByRole('button', { name: '시작' }).click();

  await expect(page.getByText('mock question 1 — 다음 중 옳은 것은?')).toBeVisible();
  await expect.poll(() => api.counters.next).toBeGreaterThanOrEqual(1);

  return api;
}

/** 첫 보기(label '보기 1') 선택. MultipleChoice radio가 sr-only이므로 label 클릭. */
export async function selectFirstChoice(page: Page): Promise<void> {
  await page.locator('label').filter({ hasText: '보기 1' }).first().click();
}
