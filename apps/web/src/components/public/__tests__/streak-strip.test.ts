/**
 * streak-strip 순수 로직 검증 (D-29 hardening — 기존 커버리지 0).
 * todayDateString 은 KST(UTC+9) 기준 — 타임스탬프를 KST 날짜 경계 안쪽으로 선택.
 */
import { describe, expect, it } from 'vitest';

import { buildStreakStrip } from '../streak-strip';

// now = 2026-07-13T05:00:00Z = 2026-07-13 14:00 KST (오늘 = 07-13)
const NOW = new Date('2026-07-13T05:00:00.000Z');
const STRIP = 30;

describe('buildStreakStrip', () => {
  it('오늘 2회·어제 1회·5일전 1회 → 스트립 3칸 학습 + todayCount 2', () => {
    const reviewedAts = [
      '2026-07-13T04:00:00.000Z', // 13:00 KST 07-13 (오늘)
      '2026-07-13T01:00:00.000Z', // 10:00 KST 07-13 (오늘)
      '2026-07-12T04:00:00.000Z', // 13:00 KST 07-12 (어제)
      '2026-07-08T04:00:00.000Z', // 13:00 KST 07-08 (5일 전)
      '2026-05-01T04:00:00.000Z', // 스트립(30일) 밖 → 미집계
    ];
    const { days, todayCount } = buildStreakStrip(reviewedAts, NOW, STRIP);

    expect(days).toHaveLength(STRIP);
    expect(days[STRIP - 1]).toBe(true); // 마지막 칸 = 오늘
    expect(days[STRIP - 2]).toBe(true); // 어제
    expect(days.filter(Boolean)).toHaveLength(3); // 스트립 내 고유 학습일 = 오늘·어제·5일전
    expect(todayCount).toBe(2);
  });

  it('빈 이력 → 전 칸 false + todayCount 0', () => {
    const { days, todayCount } = buildStreakStrip([], NOW, STRIP);
    expect(days).toHaveLength(STRIP);
    expect(days.some(Boolean)).toBe(false);
    expect(todayCount).toBe(0);
  });

  it('스트립 밖(31일 초과) 이력만 → 전 칸 false', () => {
    const { days, todayCount } = buildStreakStrip(['2026-01-01T04:00:00.000Z'], NOW, STRIP);
    expect(days.some(Boolean)).toBe(false);
    expect(todayCount).toBe(0);
  });

  it('손상 reviewedAt(Invalid Date) → throw 없이 스킵, 유효분만 집계 (패널 유지)', () => {
    const mixed = [
      '2026-07-13T04:00:00.000Z', // 유효(오늘)
      'not-a-date', // 손상 — new Date(NaN)
      '', // 손상
      '2026-07-12T04:00:00.000Z', // 유효(어제)
    ];
    // 가드 없으면 todayDateString(new Date(NaN)) 의 toISOString 이 RangeError → 전체 throw.
    expect(() => buildStreakStrip(mixed, NOW, STRIP)).not.toThrow();
    const { days, todayCount } = buildStreakStrip(mixed, NOW, STRIP);
    expect(days.filter(Boolean)).toHaveLength(2); // 오늘·어제만
    expect(todayCount).toBe(1);
  });

  it('같은 날 중복 reviewedAt → 스트립은 1칸(집합), todayCount 는 누적', () => {
    const sameDay = [
      '2026-07-13T02:00:00.000Z',
      '2026-07-13T03:00:00.000Z',
      '2026-07-13T04:00:00.000Z',
    ];
    const { days, todayCount } = buildStreakStrip(sameDay, NOW, STRIP);
    expect(days.filter(Boolean)).toHaveLength(1);
    expect(todayCount).toBe(3);
  });
});
