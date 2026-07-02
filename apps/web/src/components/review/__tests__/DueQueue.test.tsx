/**
 * DueQueue — WS-5c FSRS due 복습 큐 위젯 (2026-06-12).
 *
 * 계약: /api/progress/due 카운트 surface + 학습 진입 CTA. 로딩/빈/에러/미인증 4상태.
 * CTA 라벨 = "학습 시작" (due 우선 정렬 미배선 — PITR 결재 전 "복습 시작" 참칭 금지).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

import { DueQueue } from '../DueQueue';
import { fetchDueQueue, StudyApiError } from '@/lib/study-api';

vi.mock('@/lib/study-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/study-api')>();
  return { ...actual, fetchDueQueue: vi.fn() };
});

const mockedFetch = vi.mocked(fetchDueQueue);

describe('DueQueue — WS-5c 복습 큐', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });
  afterEach(() => {
    cleanup();
  });

  it('due N건 → 카운트 + 학습 진입 CTA 노출', async () => {
    mockedFetch.mockResolvedValue({
      items: [
        { id: 'p1', nodeId: 'CONCEPT-001', cardType: 'flashcard', fsrsNextReview: null },
        // exam 카드 행 — nodeId null (서버 card_type 무필터 계약, 4-Pass MAJOR 정정).
        { id: 'p2', nodeId: null, cardType: 'exam', fsrsNextReview: '2026-06-01T00:00:00.000Z' },
      ],
      count: 2,
    });
    const { getByText, getByRole } = render(<DueQueue />);
    await waitFor(() => expect(getByText('2')).toBeTruthy());
    const cta = getByRole('link', { name: '학습 시작' });
    expect(cta.getAttribute('href')).toBe('#study-main');
  });

  it('due 0건 → 빈 안내 + CTA 미노출', async () => {
    mockedFetch.mockResolvedValue({ items: [], count: 0 });
    const { getByText, queryByRole } = render(<DueQueue />);
    await waitFor(() => expect(getByText('지금 복습할 카드가 없습니다')).toBeTruthy());
    expect(queryByRole('link')).toBeNull();
  });

  it('미인증 → 위젯 자체 비노출 (redirect 미트리거)', async () => {
    mockedFetch.mockRejectedValue(new StudyApiError('unauthenticated', 'HTTP 401', 401));
    const { container } = render(<DueQueue />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('서버 오류 → 오류 문구 (silent failure 금지)', async () => {
    mockedFetch.mockRejectedValue(new StudyApiError('service_unavailable', 'HTTP 503', 503));
    const { getByText } = render(<DueQueue />);
    await waitFor(() => expect(getByText('오류가 발생했습니다')).toBeTruthy());
  });
});
