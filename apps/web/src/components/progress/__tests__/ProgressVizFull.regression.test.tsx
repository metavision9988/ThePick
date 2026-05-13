/**
 * ProgressVizFull 회귀 차단망 — Step 3-UX-6d 4-Pass 흡수 영속.
 *
 * 흡수 결함 2건:
 * 1. Pass 1 Minor 1 (code-reviewer) — masteryPct clamp 미적용.
 *    서버 layer 라인업 변경 시 값이 [0, 1] 범위를 벗어나면 width: NaN% / 100%+ 회귀.
 *    Fix (ProgressVizFull.tsx:181): Math.min(100, Math.round(Math.max(0, masteryPct) * 100)).
 *
 * 2. I-3 (code-reviewer Pass 3) — network 오프라인 메시지 부재.
 *    StudyApiError.kind === 'network' 시 사용자에게 "오프라인" 안내 부재.
 *    Fix (ProgressVizFull.tsx:40 formatApiError): 'network' branch 추가.
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

import { EXAM_IDS } from '@thepick/shared';

import { ProgressVizFull } from '../ProgressVizFull';
import * as studyApi from '@/lib/study-api';

function buildProgressFixture(
  masteryPctOverrides: ReadonlyArray<number>,
): studyApi.ProgressResponse {
  return {
    examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
    examType: '1st',
    days: 30,
    dailyGoal: 20,
    daily: [{ date: '2026-05-13', cardsDistinct: 10, isToday: true }],
    subjects: masteryPctOverrides.map((pct, i) => ({
      subject: `과목${i + 1}`,
      total: 100,
      mastered: 50,
      masteryPct: pct,
    })),
    streak: { current: 3, longest: 7, dailyGoalProgress: 0.5 },
  };
}

describe('ProgressVizFull — 4-Pass Pass 1 Minor 1 회귀 차단 (masteryPct clamp)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('masteryPct > 1 (예: 1.5) → 100% 표시 (Math.min(100, ...) clamp)', async () => {
    vi.spyOn(studyApi, 'fetchProgress').mockResolvedValue(buildProgressFixture([1.5]));
    const { findByText } = render(<ProgressVizFull examType="1st" />);
    // "100%" 표시 확인.
    const pctNode = await findByText('100%');
    expect(pctNode).toBeInTheDocument();
  });

  it('masteryPct < 0 (예: -0.3) → 0% 표시 (Math.max(0, ...) clamp)', async () => {
    vi.spyOn(studyApi, 'fetchProgress').mockResolvedValue(buildProgressFixture([-0.3]));
    const { findByText } = render(<ProgressVizFull examType="1st" />);
    const pctNode = await findByText('0%');
    expect(pctNode).toBeInTheDocument();
  });

  it('masteryPct=0.42 정상 값 → 42%', async () => {
    vi.spyOn(studyApi, 'fetchProgress').mockResolvedValue(buildProgressFixture([0.42]));
    const { findByText } = render(<ProgressVizFull examType="1st" />);
    const pctNode = await findByText('42%');
    expect(pctNode).toBeInTheDocument();
  });
});

describe('ProgressVizFull — 4-Pass I-3 회귀 차단 (network 오프라인 메시지)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('StudyApiError.kind=network → "오프라인" 메시지 표시', async () => {
    const networkErr = new studyApi.StudyApiError('network', 'offline');
    vi.spyOn(studyApi, 'fetchProgress').mockRejectedValue(networkErr);
    const { findByRole } = render(<ProgressVizFull examType="1st" />);
    const alert = await findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/오프라인/);
  });

  it('StudyApiError.kind=rate_limited → "잠시 후" 메시지', async () => {
    const err = new studyApi.StudyApiError('rate_limited', '429');
    vi.spyOn(studyApi, 'fetchProgress').mockRejectedValue(err);
    const { findByRole } = render(<ProgressVizFull examType="1st" />);
    const alert = await findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/잠시 후/);
  });

  it('일반 에러 → fallback "진도 데이터를 불러오지 못했습니다"', async () => {
    vi.spyOn(studyApi, 'fetchProgress').mockRejectedValue(new Error('boom'));
    const { findByRole } = render(<ProgressVizFull examType="1st" />);
    const alert = await findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/진도 데이터를 불러오지 못했습니다/);
  });

  it('정상 응답 → loading → ok 전환 (alert role 부재)', async () => {
    vi.spyOn(studyApi, 'fetchProgress').mockResolvedValue(buildProgressFixture([0.5]));
    const { queryByRole, findByText } = render(<ProgressVizFull examType="1st" />);
    await findByText('50%');
    expect(queryByRole('alert')).toBeNull();
  });
});

describe('ProgressVizFull — fetchProgress 단일 호출 회귀 차단 (5-페르소나 C-P1 흡수)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('mount 시 fetchProgress 1회만 호출 (별도 /mode 호출 제거)', async () => {
    const fetchSpy = vi
      .spyOn(studyApi, 'fetchProgress')
      .mockResolvedValue(buildProgressFixture([0.5]));
    const { findByText } = render(<ProgressVizFull examType="1st" />);
    await findByText('50%');
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    expect(fetchSpy).toHaveBeenCalledWith('1st', 30);
  });
});
