/**
 * SessionStart — WS-5a category 과목 픽커 (2026-06-12).
 *
 * 계약: category 모드는 subject 선택 전 시작 불가 (무필터 세션 = ADR-039 계약 위반,
 * 서버 /mode/start 422 와 이중 방어). 선택 시 onStart 가 modeParams { subject } 동반.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { SessionStart } from '../SessionStart';
import type { CategorySubjectEntry } from '../types';

const SUBJECTS: ReadonlyArray<CategorySubjectEntry> = [
  { subject: '상법 보험편', available: 175 },
  { subject: '농학개론 중 재배학 및 원예작물학', available: 175 },
  { subject: '빈 과목', available: 0 },
];

function renderCategory(onStart = vi.fn()) {
  const utils = render(
    <SessionStart
      mode="category"
      available={525}
      streakCurrent={0}
      streakLongest={0}
      dailyGoal={20}
      dailyGoalProgress={0}
      categorySubjects={SUBJECTS}
      disabled={false}
      onStart={onStart}
      onCancel={() => undefined}
    />,
  );
  return { ...utils, onStart };
}

describe('SessionStart — WS-5a category 과목 픽커', () => {
  afterEach(() => {
    cleanup();
  });

  it('과목 미선택 → 시작 disabled', () => {
    const { getByRole } = renderCategory();
    expect(getByRole('button', { name: '시작' })).toBeDisabled();
  });

  it('available=0 과목은 선택 disabled', () => {
    const { getByRole } = renderCategory();
    expect(getByRole('radio', { name: /빈 과목/ })).toBeDisabled();
  });

  it('과목 선택 → 시작 enabled + onStart 에 modeParams { subject } 전달', () => {
    const { getByRole, onStart } = renderCategory();
    fireEvent.click(getByRole('radio', { name: /상법 보험편/ }));
    const startBtn = getByRole('button', { name: '시작' });
    expect(startBtn).toBeEnabled();
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledTimes(1);
    const [cards, modeParams] = onStart.mock.calls[0] as [number, Record<string, unknown>];
    expect(cards).toBeGreaterThanOrEqual(1);
    expect(modeParams).toEqual({ subject: '상법 보험편' });
  });

  it('과목 선택 시 카드 수가 과목 풀로 클램프', () => {
    const small: ReadonlyArray<CategorySubjectEntry> = [
      { subject: '2과목 (손해평가)', available: 3 },
    ];
    const onStart = vi.fn();
    const { getByRole } = render(
      <SessionStart
        mode="category"
        available={9}
        streakCurrent={0}
        streakLongest={0}
        dailyGoal={20}
        dailyGoalProgress={0}
        categorySubjects={small}
        disabled={false}
        onStart={onStart}
        onCancel={() => undefined}
      />,
    );
    fireEvent.click(getByRole('radio', { name: /2과목/ }));
    fireEvent.click(getByRole('button', { name: '시작' }));
    const [cards] = onStart.mock.calls[0] as [number];
    expect(cards).toBeLessThanOrEqual(3);
  });

  it('비-category 모드 → 픽커 미노출 + onStart modeParams undefined (회귀)', () => {
    const onStart = vi.fn();
    const { queryByRole, getByRole } = render(
      <SessionStart
        mode="mixed"
        available={100}
        streakCurrent={0}
        streakLongest={0}
        dailyGoal={20}
        dailyGoalProgress={0}
        disabled={false}
        onStart={onStart}
        onCancel={() => undefined}
      />,
    );
    expect(queryByRole('radiogroup')).toBeNull();
    fireEvent.click(getByRole('button', { name: '시작' }));
    const [, modeParams] = onStart.mock.calls[0] as [number, unknown];
    expect(modeParams).toBeUndefined();
  });

  it('categorySubjects 부재(구버전 API) → 빈 안내 + 시작 disabled (graceful)', () => {
    const onStart = vi.fn();
    const { getByText, getByRole } = render(
      <SessionStart
        mode="category"
        available={525}
        streakCurrent={0}
        streakLongest={0}
        dailyGoal={20}
        dailyGoalProgress={0}
        disabled={false}
        onStart={onStart}
        onCancel={() => undefined}
      />,
    );
    expect(getByText('선택할 수 있는 과목이 없습니다')).toBeTruthy();
    expect(getByRole('button', { name: '시작' })).toBeDisabled();
  });
});
