/**
 * E2E — promo-1st P4 공개 학습 표면 (/practice/ + 랜딩 임베드).
 *
 * 무인증(쿠키 0) — /api/public/* 만 소비. mock 정답 규약:
 * MC = choiceId `pub-{i}-cid-2`(보기 ②) / fill_blank = '보험가액'.
 */

import { expect, test } from '@playwright/test';

import { hideAstroDevToolbar, installApiMock, waitForReactHydration } from './helpers/mock-api';

// astro dev toolbar 가 하단 고정 버튼 클릭을 가로챔(mobile-375 spec 정합) — 전 테스트 공통 차단.
test.beforeEach(async ({ page }) => {
  await hideAstroDevToolbar(page);
});

test('랜딩 — 정적 소개 + 라이브 임베드 1문항 → 채점 → 계속 풀기 링크 (FE-1 B안)', async ({
  page,
}) => {
  const api = await installApiMock(page);

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '손해평가사 1차, 기출로 시작한다' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '바로 풀어보기' })).toBeVisible();

  // 라이브 임베드 — 실제 mock API 소비 (가짜 UI 아님)
  await expect(page.getByText(/public mock question \d+/)).toBeVisible();
  await expect.poll(() => api.counters.publicNext).toBeGreaterThanOrEqual(1);

  await waitForReactHydration(page, 'article');
  await page.locator('label').filter({ hasText: '공개 보기 2' }).click();
  await page.getByRole('button', { name: /채점/ }).click();
  await expect.poll(() => api.counters.publicGrade).toBe(1);
  // 정답 Pill + 계속 풀기 (임베드 전환 CTA)
  await expect(page.locator('section').getByText('정답', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '계속 풀기' })).toBeVisible();
});

test('4지선다 — 픽커 → 오답 채점(정답 표식) → 다음 문제 (FE-2/FE-3)', async ({ page }) => {
  const api = await installApiMock(page);

  await page.goto('/practice/');
  await waitForReactHydration(page, 'button');
  await expect(page.getByText('어떻게 학습할까')).toBeVisible();

  await page.getByRole('button', { name: /4지선다/ }).click();
  await expect(page.getByText(/public mock question \d+/)).toBeVisible();
  await expect.poll(() => api.counters.publicNext).toBeGreaterThanOrEqual(1);

  // 오답(보기 1) 선택 → 채점 → 오답 Pill + 정답 표식(보기 2)
  await page.locator('label').filter({ hasText: '공개 보기 1' }).click();
  await page.getByRole('button', { name: /채점/ }).click();
  await expect.poll(() => api.counters.publicGrade).toBe(1);
  await expect(page.getByText('오답', { exact: true })).toBeVisible();
  await expect(page.getByText('내가 고른 오답')).toBeVisible();

  // 다음 문제 — 새 문항 서빙
  await page.getByRole('button', { name: /다음 문제/ }).click();
  await expect.poll(() => api.counters.publicNext).toBeGreaterThanOrEqual(2);
});

test('빵꾸노트 — M9 힌트 사다리(초성) → 정답 채점 (FE-4)', async ({ page }) => {
  const api = await installApiMock(page);

  await page.goto('/practice/');
  await waitForReactHydration(page, 'button');
  await page.getByRole('button', { name: /빵꾸노트/ }).click();
  await expect(page.getByText(/public mock 빈칸/)).toBeVisible();

  // 힌트 1단계 — /reveal 1회 + 초성 노출 (보험가액 → ㅂㅎㄱㅇ)
  await page.getByRole('button', { name: /힌트/ }).click();
  await expect.poll(() => api.counters.publicReveal).toBe(1);
  await expect(page.getByText('ㅂㅎㄱㅇ')).toBeVisible();

  // 정답 입력 → 채점 → 정답 Pill
  await page.getByPlaceholder('답을 입력 (Enter 채점)').fill('보험가액');
  await page.getByRole('button', { name: '채점' }).click();
  await expect.poll(() => api.counters.publicGrade).toBe(1);
  await expect(page.getByText('정답', { exact: true }).first()).toBeVisible();
});

test('카드플립 — 정답 확인(reveal) → 4버튼 자평 → 다음 카드 (FE-5)', async ({ page }) => {
  const api = await installApiMock(page);

  await page.goto('/practice/');
  await waitForReactHydration(page, 'button');
  await page.getByRole('button', { name: /카드플립/ }).click();
  await expect(page.getByText(/public mock question \d+/)).toBeVisible();

  // 플립 전 — 자평 버튼 비노출 (정답 선노출 금지)
  await expect(page.getByRole('button', { name: '알았음' })).toHaveCount(0);

  await page.getByRole('button', { name: /정답 확인/ }).click();
  await expect.poll(() => api.counters.publicReveal).toBe(1);
  // 뒷면 — 4단계 자평 버튼 (모름/애매/알았음/쉬움)
  for (const label of ['모름', '애매', '알았음', '쉬움']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }

  await page.getByRole('button', { name: '알았음' }).click();
  // 자평 즉시 다음 카드 서빙
  await expect.poll(() => api.counters.publicNext).toBeGreaterThanOrEqual(2);
});

test('빈 상태 — NO_QUESTION 시 정직한 빈 패널 + 재시도 (FE-9)', async ({ page }) => {
  const api = await installApiMock(page);
  await api.override({
    publicNextResponse: { status: 404, body: { error: 'NO_QUESTION' } },
  });

  await page.goto('/practice/');
  await waitForReactHydration(page, 'button');
  await page.getByRole('button', { name: /4지선다/ }).click();

  await expect(page.getByText('풀 수 있는 문제가 없다')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
});
