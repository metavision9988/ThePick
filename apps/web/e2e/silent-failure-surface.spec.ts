/**
 * E2E — SessionSummary `weakDelta.available=false` silent failure surface 회귀 차단.
 * ADR-040 §6 carry-over #3 (★ Phase 3 launch 차단).
 *
 * 사용자가 세션 종료 시 server가 약점 집계 쿼리에 실패한 경우:
 *   - happy path: weakDelta.available=true → "약점 잔존" 섹션 + bySubject 5건 표시
 *   - silent failure: weakDelta.available=false → "약점 영역 집계를 불러오지 못했습니다..." 안내
 *
 * SessionSummary.tsx:56-58, 124-128 정합. 4-Pass C-1 흡수 영속.
 *
 * happy path도 동시에 검증 — silent failure UI가 부주의로 항상 표시되는 회귀 차단.
 */

import { expect, test, type Page } from '@playwright/test';

import { makeCompleteResponse } from './helpers/fixtures';
import { selectFirstChoice, startSessionToFirstQuestion } from './helpers/study-flow';

const UNAVAILABLE_MESSAGE = '약점 영역 집계를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.';

async function completeSession(page: Page): Promise<void> {
  // 3건 grade → 자동 finalize → SessionSummary
  for (let i = 1; i <= 3; i += 1) {
    await expect(page.getByText(`mock question ${i} — 다음 중 옳은 것은?`)).toBeVisible();
    await selectFirstChoice(page);
    await page.getByRole('button', { name: /채점/ }).click();
    if (i < 3) {
      await page.getByRole('button', { name: /다음 문제/ }).click();
    }
  }
  await expect(page.getByRole('heading', { name: '통합 학습 결과' })).toBeVisible();
}

test.describe('SessionSummary weakDelta silent failure surface', () => {
  test('available=false → 집계 불가 안내 표시 + "약점 잔존" 섹션 비표시', async ({ page }) => {
    const api = await startSessionToFirstQuestion(page);
    await api.override({
      completeResponse: () =>
        makeCompleteResponse({
          weakDelta: {
            available: false,
            cardsReviewed: 0,
            stillWeakCount: 0,
            bySubject: [],
          },
        }),
    });

    await completeSession(page);

    await expect(page.getByText(UNAVAILABLE_MESSAGE)).toBeVisible();
    // happy path "약점 잔존" 섹션은 노출되지 않아야 한다 (silent failure를 정상 0건과 구분)
    await expect(page.getByText('약점 잔존')).not.toBeVisible();
  });

  test('available=true (happy) → 집계 불가 안내 미표시 + 약점 잔존 노출', async ({ page }) => {
    // 기본 mock response가 available=true. override 없이 진행.
    await startSessionToFirstQuestion(page);
    await completeSession(page);

    await expect(page.getByText(UNAVAILABLE_MESSAGE)).not.toBeVisible();
    await expect(page.getByText('약점 잔존')).toBeVisible();
  });

  test('available=true, cardsReviewed=0 → 정상 0건 (안내/잔존 모두 비표시)', async ({ page }) => {
    const api = await startSessionToFirstQuestion(page);
    await api.override({
      completeResponse: () =>
        makeCompleteResponse({
          weakDelta: {
            available: true,
            cardsReviewed: 0,
            stillWeakCount: 0,
            bySubject: [],
          },
        }),
    });

    await completeSession(page);

    // silent failure 안내 없음 (available=true)
    await expect(page.getByText(UNAVAILABLE_MESSAGE)).not.toBeVisible();
    // "약점 잔존" 섹션도 없음 (cardsReviewed=0 정상 0건)
    await expect(page.getByText('약점 잔존')).not.toBeVisible();
  });
});
