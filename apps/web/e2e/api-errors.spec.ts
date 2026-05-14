/**
 * E2E — /api/study/grade 에러 path 회귀 차단망. ADR-040 §6 carry-over #2 (★ Phase 3 launch 차단).
 *
 * 사용자가 가장 빈번하게 마주칠 분기:
 *   1. HTTP 429 rate-limit → "연속 채점 요청이 많습니다..." + "다시 시도" 버튼
 *   2. HTTP 422 QUESTION_HAS_NO_ANSWER → "이 문제는 정답이 등록되지 않았습니다."
 *   3. HTTP 422 generic validation → "입력 형식 오류 — 답안을 다시 확인해 주세요."
 *   4. HTTP 503 service unavailable → "채점 실패 (HTTP 503)"
 *   5. network error (route.abort) → "네트워크 오류 — 잠시 후 다시 시도해 주세요."
 *
 * 각 시나리오는 error UI 표시 + (가능 시) 재시도 회복 path 검증.
 *
 * QuestionCard.tsx:135-172 에러 분기 정합.
 */

import { expect, test } from '@playwright/test';

import { handlePreflight } from './helpers/mock-api';
import { selectFirstChoice, startSessionToFirstQuestion } from './helpers/study-flow';

test.describe('/api/study/grade 에러 path', () => {
  test('HTTP 429 rate-limit → 안내 메시지 + 다시 시도 → 다음 문제 회복', async ({ page }) => {
    const api = await startSessionToFirstQuestion(page);
    api.override({
      gradeSequence: [
        // 5-페르소나 backend C1 흡수 (Session 076) — 실 서버 contract 정합.
        // apps/api/src/study/routes.ts:723,929의 'RATE_LIMIT_EXCEEDED' literal과 sync.
        // 향후 client가 error code 분기 시 mock/server drift silent miss 차단.
        //
        // Retry-After 헤더는 mock에만 inject (실 서버 contract: routes.ts:928 String(retryAfterSeconds)).
        // 5-페르소나 refactor C-1 / quality M1 흡수 — 헤더 존재 자체 assertion은 mock 자기검증
        // tautology (client QuestionCard.tsx:141-144는 status만 보고 헤더 무시). 향후 client가
        // 헤더 기반 retry/back-off 도입 시 그 시점에 setTimeout/retry path 검증 추가 의무
        // (mock impl 동결 금지).
        {
          status: 429,
          body: { error: 'RATE_LIMIT_EXCEEDED' },
          headers: { 'Retry-After': '30' },
        },
      ],
    });

    await selectFirstChoice(page);
    await page.getByRole('button', { name: /채점/ }).click();

    // role=alert 영역 메시지 표시 (MINOR-AD2 흡수 — text + role 이중 검증)
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('연속 채점 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    expect(api.counters.grade).toBe(1);

    // MAJOR-S1+AD1 흡수 — "다시 시도" 버튼은 fetchNext()를 호출 (QuestionCard.tsx:229).
    // 클릭 → /api/study/next 호출 → mock 두번째 문제 응답 → answering phase 복귀 검증.
    // 본 회복 path가 깨지면 error phase에 영구 stuck → 사용자 진행 불가.
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page.getByText('mock question 2 — 다음 중 옳은 것은?')).toBeVisible();
    expect(api.counters.next).toBeGreaterThanOrEqual(2);
  });

  test('HTTP 422 QUESTION_HAS_NO_ANSWER → 정답 미등록 안내', async ({ page }) => {
    const api = await startSessionToFirstQuestion(page);
    api.override({
      gradeSequence: [{ status: 422, body: { error: 'QUESTION_HAS_NO_ANSWER' } }],
    });

    await selectFirstChoice(page);
    await page.getByRole('button', { name: /채점/ }).click();

    await expect(page.getByText('이 문제는 정답이 등록되지 않았습니다.')).toBeVisible();
    expect(api.counters.grade).toBe(1);
  });

  test('HTTP 422 generic validation → 입력 형식 오류 안내', async ({ page }) => {
    const api = await startSessionToFirstQuestion(page);
    api.override({
      gradeSequence: [{ status: 422, body: { error: 'INVALID_INPUT' } }],
    });

    await selectFirstChoice(page);
    await page.getByRole('button', { name: /채점/ }).click();

    await expect(page.getByText('입력 형식 오류 — 답안을 다시 확인해 주세요.')).toBeVisible();
    expect(api.counters.grade).toBe(1);
  });

  test('HTTP 503 service unavailable → HTTP 상태 안내', async ({ page }) => {
    const api = await startSessionToFirstQuestion(page);
    api.override({
      gradeSequence: [{ status: 503, body: { error: 'SERVICE_UNAVAILABLE' } }],
    });

    await selectFirstChoice(page);
    await page.getByRole('button', { name: /채점/ }).click();

    await expect(page.getByText('채점 실패 (HTTP 503)')).toBeVisible();
    expect(api.counters.grade).toBe(1);
  });

  test('network error (fetch abort) → 네트워크 안내', async ({ page }) => {
    await startSessionToFirstQuestion(page);

    // gradeSequence override 대신 직접 grade route abort. mock-api는 LIFO이므로 새 등록이 우선.
    // MINOR-AD2 흡수 — handlePreflight 공통 helper 사용 (CORS inline 복제 제거).
    await page.route('**/api/study/grade**', async (route) => {
      if (await handlePreflight(route)) return;
      await route.abort('failed');
    });

    await selectFirstChoice(page);
    await page.getByRole('button', { name: /채점/ }).click();

    await expect(page.getByText('네트워크 오류 — 잠시 후 다시 시도해 주세요.')).toBeVisible();
  });
});
