/**
 * E2E #1 — happy path. ADR-040 §5 #7.
 *
 * 흐름: /auth/login → 이메일/비번 → /study/ redirect → ModeSelector → SessionStart →
 *       QuestionCard 3건 grade → 자동 finalize → SessionSummary.
 *
 * Mock 검증: counters로 호출 순서/횟수 보장.
 */

import { expect, test } from '@playwright/test';

import { MOCK_USER } from './helpers/fixtures';
import { installApiMock, waitForReactHydration } from './helpers/mock-api';

test('login → mode select → questioning 3건 → summary 골든 패스', async ({ page }) => {
  const api = await installApiMock(page);

  // 1. 로그인
  await page.goto('/auth/login?next=%2Fstudy%2F');
  await expect(page.getByRole('heading', { name: '로그인', level: 1 })).toBeVisible();
  // Pass 1 M-1 흡수 — toBeEnabled()는 disabled 속성만 보고 React hydration 검증 X.
  // form onSubmit이 부착되지 않으면 native browser submit이 fallthrough → 테스트 race.
  // React fiber attribute 검출로 결정적 hydration sentinel.
  await waitForReactHydration(page, 'form');
  await page.getByLabel('이메일').fill(MOCK_USER.email);
  await page.getByLabel('비밀번호').fill(MOCK_USER.password);
  await Promise.all([
    page.waitForResponse('**/api/auth/login'),
    page.getByRole('button', { name: '로그인' }).click(),
  ]);

  // 2. /study/ 진입 — mode select + ProgressViz 양쪽 island 마운트 확인
  await page.waitForURL('**/study/');
  await expect(page.getByRole('heading', { name: '학습 모드를 선택하세요' })).toBeVisible();
  // Pass 1 C-3 흡수 — ProgressViz fetch 표면화 검증 (silent skip 차단).
  await expect.poll(() => api.counters.progress).toBeGreaterThanOrEqual(1);
  expect(api.counters.authLogin).toBe(1);
  expect(api.counters.modeStats).toBe(1);

  // 3. 통합 학습 (mixed) 선택
  await page.getByRole('button', { name: /통합 학습 학습 시작/ }).click();
  await expect(page.getByRole('heading', { name: '통합 학습 학습' })).toBeVisible();

  // 4. cardsPlanned 3으로 조정 후 시작
  await page.getByLabel('이번 세션 카드 수').fill('3');
  await page.getByRole('button', { name: '시작' }).click();
  await expect.poll(() => api.counters.modeStart).toBe(1);

  // 5. 첫 문제 표시
  await expect(page.getByText('mock question 1 — 다음 중 옳은 것은?')).toBeVisible();
  await expect.poll(() => api.counters.next).toBeGreaterThanOrEqual(1);

  // 3건 grade 반복 — 라벨 클릭 → 채점 → 다음 문제
  for (let i = 1; i <= 3; i += 1) {
    await expect(page.getByText(`mock question ${i} — 다음 중 옳은 것은?`)).toBeVisible();
    await page.locator('label').filter({ hasText: '보기 1' }).first().click();
    await page.getByRole('button', { name: /채점/ }).click();
    await expect.poll(() => api.counters.grade).toBe(i);
    if (i < 3) {
      // 다음 문제 버튼 노출 — 클릭하여 fetchNext 트리거
      await page.getByRole('button', { name: /다음 문제/ }).click();
    }
  }

  // 6. 3번째 grade 응답에 session.phase==='completed' → 자동 finalize → SessionSummary
  await expect.poll(() => api.counters.sessionComplete).toBe(1);
  await expect(page.getByRole('heading', { name: '통합 학습 결과' })).toBeVisible();
  await expect(page.getByText('정답률')).toBeVisible();
  expect(api.counters.grade).toBe(3);

  // Pass 1 C-5 흡수 — 호출 순서 검증으로 contract drift 차단.
  // authLogin → modeStats/progress → modeStart → (next → grade) × 3 → sessionComplete
  expect(api.callLog[0]).toBe('authLogin');
  expect(api.callLog).toContain('modeStart');
  const modeStartIdx = api.callLog.indexOf('modeStart');
  const sessionCompleteIdx = api.callLog.indexOf('sessionComplete');
  expect(modeStartIdx).toBeGreaterThan(0);
  expect(sessionCompleteIdx).toBeGreaterThan(modeStartIdx);
  // grade는 항상 next 다음에
  for (let i = 0; i < api.callLog.length; i += 1) {
    if (api.callLog[i] === 'grade') {
      expect(api.callLog[i - 1]).toBe('next');
    }
  }
});
