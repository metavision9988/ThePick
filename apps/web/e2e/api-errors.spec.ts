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
    // MINOR-AD3 흡수 (Session 076) — 실 서버 contract Retry-After 헤더 정합.
    // 클라이언트가 헤더 기반 retry/back-off 로직 도입 시 mock도 contract drift 없이 정합.
    let retryAfterHeader: string | null = null;
    page.on('response', (res) => {
      if (res.url().includes('/api/study/grade') && res.status() === 429) {
        retryAfterHeader = res.headers()['retry-after'] ?? null;
      }
    });
    api.override({
      gradeSequence: [
        { status: 429, body: { error: 'RATE_LIMITED' }, headers: { 'Retry-After': '30' } },
      ],
    });

    await selectFirstChoice(page);
    await page.getByRole('button', { name: /채점/ }).click();

    // role=alert 영역 메시지 표시 (MINOR-AD2 흡수 — text + role 이중 검증)
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('연속 채점 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    expect(api.counters.grade).toBe(1);
    // Retry-After 헤더 contract 회귀 차단 — 클라이언트가 향후 헤더 활용 시 silent miss 방지.
    expect(retryAfterHeader).toBe('30');

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
