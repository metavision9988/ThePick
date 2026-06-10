/**
 * ModeSelector — WS-0d 모드 정직성 (결재 #9 위임 = 비활성 표기, 2026-06-11).
 *
 * 계약: 서버 /mode 응답의 wired 가 단일 진실원.
 *   - wired=false → disabled + "준비 중" 배지 + available 숫자 비표시(미필터 풀 숫자 오해 방지)
 *   - wired=true  → 기존 동작 (available=0 이면 "대상 없음")
 *   - 추천 pill 은 wired=false 모드에 절대 부착 금지 ("준비 중을 추천" 모순 차단)
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { ModeSelector } from '../ModeSelector';
import type { ModeAvailability } from '../types';
import { pickRecommendedMode } from '../types';

const MODES_FIXTURE: ReadonlyArray<ModeAvailability> = [
  { mode: 'category', available: 100, wired: false },
  { mode: 'topic', available: 100, wired: false },
  { mode: 'confusion', available: 20, wired: false },
  { mode: 'weak', available: 5, wired: true },
  { mode: 'mixed', available: 100, wired: true },
];

describe('ModeSelector — wired 비활성 표기 (WS-0d)', () => {
  afterEach(() => {
    cleanup();
  });

  it('미배선 모드 = disabled + "준비 중" 라벨', () => {
    const { getByRole, getAllByText } = render(
      <ModeSelector modes={MODES_FIXTURE} disabled={false} onSelect={() => undefined} />,
    );
    for (const label of ['과목별', '주제별', '헷갈림'] as const) {
      const btn = getByRole('button', { name: `${label} (준비 중)` });
      expect(btn).toBeDisabled();
    }
    expect(getAllByText('준비 중')).toHaveLength(3);
  });

  it('배선 모드 = 활성 + available 숫자 표시', () => {
    const { getByRole, getByText } = render(
      <ModeSelector modes={MODES_FIXTURE} disabled={false} onSelect={() => undefined} />,
    );
    expect(getByRole('button', { name: '약점 복습 학습 시작 (5문제)' })).toBeEnabled();
    expect(getByRole('button', { name: '통합 학습 학습 시작 (100문제)' })).toBeEnabled();
    expect(getByText('5문제')).toBeInTheDocument();
  });

  it('미배선 모드의 available 숫자 비표시 (미필터 풀 숫자 오해 방지)', () => {
    const { queryAllByText } = render(
      <ModeSelector modes={MODES_FIXTURE} disabled={false} onSelect={() => undefined} />,
    );
    // category/topic 의 100 은 미필터 전체 풀 — 표시되면 안 됨. mixed(wired)의 100문제만 1회.
    expect(queryAllByText('100문제')).toHaveLength(1);
    expect(queryAllByText('20문제')).toHaveLength(0); // confusion 미배선
  });

  it('추천 pill 은 미배선 모드에 부착 금지 — confusion available>0 이어도 weak 0 이면 mixed 추천', () => {
    const noWeak: ReadonlyArray<ModeAvailability> = [
      { mode: 'category', available: 100, wired: false },
      { mode: 'topic', available: 100, wired: false },
      { mode: 'confusion', available: 20, wired: false }, // 미배선 — 구버전이면 이게 추천됐음
      { mode: 'weak', available: 0, wired: true },
      { mode: 'mixed', available: 100, wired: true },
    ];
    expect(pickRecommendedMode(noWeak)).toBe('mixed');
    const { getByText } = render(
      <ModeSelector modes={noWeak} disabled={false} onSelect={() => undefined} />,
    );
    const pill = getByText('추천');
    // 추천 pill 이 통합 학습 버튼 내부에 있어야 함
    expect(pill.closest('button')?.textContent).toContain('통합 학습');
  });

  it('pickRecommendedMode — weak wired+available>0 이면 weak 우선 (기존 ADR-039 우선순위 보존)', () => {
    expect(pickRecommendedMode(MODES_FIXTURE)).toBe('weak');
  });
});
