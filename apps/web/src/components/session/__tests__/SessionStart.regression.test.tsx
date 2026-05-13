/**
 * SessionStart 회귀 차단망 — Step 3-UX-6c-2 4-Pass C-2 흡수 영속.
 *
 * 결함: dailyGoalProgress / dailyGoal에 NaN, Infinity, 음수 등 비정상 값이 전달되면
 *      Math.min/max는 NaN을 전파하여 progressbar aria-valuenow가 NaN이 되거나
 *      style width: NaN% 렌더링으로 layout 깨짐.
 *
 * 흡수 fix (SessionStart.tsx:50-57): Number.isFinite 가드 + clamp [0, 1].
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { SessionStart } from '../SessionStart';

function renderWith(overrides: { dailyGoalProgress: number; dailyGoal: number }) {
  return render(
    <SessionStart
      mode="weak"
      available={20}
      streakCurrent={3}
      streakLongest={7}
      dailyGoal={overrides.dailyGoal}
      dailyGoalProgress={overrides.dailyGoalProgress}
      disabled={false}
      onStart={() => undefined}
      onCancel={() => undefined}
    />,
  );
}

describe('SessionStart — 4-Pass C-2 회귀 차단 (dailyGoalProgress NaN/Infinity/clamp)', () => {
  afterEach(() => {
    cleanup();
  });

  it('dailyGoalProgress=NaN → aria-valuenow=0 + width=0%', () => {
    const { getByRole } = renderWith({ dailyGoalProgress: Number.NaN, dailyGoal: 20 });
    const bar = getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    const fill = bar.querySelector('div');
    expect(fill).not.toBeNull();
    expect((fill as HTMLElement).style.width).toBe('0%');
  });

  it('dailyGoalProgress=Infinity → aria-valuenow=0 (clamp NaN-source)', () => {
    const { getByRole } = renderWith({
      dailyGoalProgress: Number.POSITIVE_INFINITY,
      dailyGoal: 20,
    });
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('dailyGoalProgress=-0.5 → aria-valuenow=0 (음수 → 0 clamp)', () => {
    const { getByRole } = renderWith({ dailyGoalProgress: -0.5, dailyGoal: 20 });
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('dailyGoalProgress=1.5 → aria-valuenow=100 (1 초과 → 100 clamp)', () => {
    const { getByRole } = renderWith({ dailyGoalProgress: 1.5, dailyGoal: 20 });
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('dailyGoal=Infinity → 화면에 NaN 미노출 (safeDailyGoal 0 fallback)', () => {
    const { container } = renderWith({
      dailyGoalProgress: 0.5,
      dailyGoal: Number.POSITIVE_INFINITY,
    });
    expect(container.textContent ?? '').not.toMatch(/NaN/);
  });

  it('정상 값 (progress=0.4, goal=20) → aria-valuenow=40', () => {
    const { getByRole } = renderWith({ dailyGoalProgress: 0.4, dailyGoal: 20 });
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });
});
