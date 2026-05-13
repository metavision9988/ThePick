/**
 * Golden Tests — session-progress.ts (Step 3-UX-5c follow-up).
 *
 * 5-페르소나 quality-engineer 발견 흡수:
 *   - CRIT-1: KST/UTC timezone mismatch
 *   - CRIT-2: streak lost-update race (compute 함수 자체는 race 무관, race는 DB UPSERT 레이어)
 *   - MAJ: 0.8 cooldown + 100/100 completed boundary 누락
 *   - MAJ: helper Golden Test 부재 → endpoint 통합으로만 검증 (회귀 추적 불가)
 *
 * 본 테스트 셋이 보장:
 *   - phase 4 경계 (0, 0.2, 0.8, 1.0) 정확 진입
 *   - streak 4 분기 (null/today/yesterday/gap) 정확 계산
 *   - KST/UTC timezone 사용자 학습 일관성
 *   - silent fallback narrowing 콜백 동작
 */

import { describe, expect, it, vi } from 'vitest';
import {
  KST_OFFSET_HOURS,
  PHASE_THRESHOLD_COOLDOWN,
  PHASE_THRESHOLD_WARMUP,
  computePhaseFromProgress,
  computeStreakUpdate,
  dayBoundsUtc,
  isOneDayApart,
  resolveLearningMode,
  resolveSessionPhase,
  todayDateString,
} from '../session-progress.js';

describe('todayDateString — KST 기본 (한국 사용자 100% 정합)', () => {
  it('KST 자정 00:00 = UTC 15:00 (전일) → KST 기준 day', () => {
    // 2026-05-13 KST 00:00:00 → 2026-05-12 UTC 15:00:00
    const utcDate = new Date('2026-05-12T15:00:00Z');
    expect(todayDateString(utcDate)).toBe('2026-05-13');
  });

  it('KST 23:59 = UTC 14:59 → 같은 KST day', () => {
    const utcDate = new Date('2026-05-13T14:59:59Z');
    expect(todayDateString(utcDate)).toBe('2026-05-13');
  });

  it('KST 다음날 00:00 = UTC 15:00 → KST day 변경', () => {
    const utcDate = new Date('2026-05-13T15:00:00Z');
    expect(todayDateString(utcDate)).toBe('2026-05-14');
  });

  it('UTC 자정 00:00 = KST 09:00 → KST 같은 day', () => {
    const utcDate = new Date('2026-05-13T00:00:00Z');
    expect(todayDateString(utcDate)).toBe('2026-05-13');
  });

  it('offsetHours=0 (UTC) override → UTC 기준', () => {
    const utcDate = new Date('2026-05-13T14:59:00Z');
    expect(todayDateString(utcDate, 0)).toBe('2026-05-13');
    expect(todayDateString(new Date('2026-05-13T23:59:00Z'), 0)).toBe('2026-05-13');
    expect(todayDateString(new Date('2026-05-14T00:00:00Z'), 0)).toBe('2026-05-14');
  });

  it('KST_OFFSET_HOURS = 9 (상수 정합)', () => {
    expect(KST_OFFSET_HOURS).toBe(9);
  });

  it('default 호출 (now 인자 없음) — 현재 시각 KST 기준', () => {
    const result = todayDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isOneDayApart — string-based YYYY-MM-DD 비교', () => {
  it('정확히 1일 차이 → true', () => {
    expect(isOneDayApart('2026-05-12', '2026-05-13')).toBe(true);
    expect(isOneDayApart('2026-12-31', '2027-01-01')).toBe(true); // 연도 경계
    expect(isOneDayApart('2026-02-28', '2026-03-01')).toBe(true); // 월 경계 (2026 윤년 아님)
  });

  it('2일 차이 → false', () => {
    expect(isOneDayApart('2026-05-11', '2026-05-13')).toBe(false);
  });

  it('동일 일자 → false (1일 차이 아님)', () => {
    expect(isOneDayApart('2026-05-13', '2026-05-13')).toBe(false);
  });

  it('역순 (later < earlier) → false', () => {
    expect(isOneDayApart('2026-05-13', '2026-05-12')).toBe(false);
  });

  it('잘못된 형식 → false (silent corruption 차단)', () => {
    expect(isOneDayApart('invalid', '2026-05-13')).toBe(false);
    expect(isOneDayApart('2026-05-13', 'invalid')).toBe(false);
    expect(isOneDayApart('', '')).toBe(false);
  });

  it('윤년 2월 29일 ↔ 3월 1일 (2024는 윤년)', () => {
    expect(isOneDayApart('2024-02-29', '2024-03-01')).toBe(true);
  });
});

describe('computePhaseFromProgress — plan §4.5 4 phase threshold', () => {
  it('0/10 = 0% → warmup', () => {
    expect(computePhaseFromProgress(0, 10)).toBe('warmup');
  });

  it('1/10 = 10% < 20% → warmup', () => {
    expect(computePhaseFromProgress(1, 10)).toBe('warmup');
  });

  it('2/10 = 20% 경계 (≥ 0.2) → main', () => {
    expect(computePhaseFromProgress(2, 10)).toBe('main');
  });

  it('7/10 = 70% < 80% → main', () => {
    expect(computePhaseFromProgress(7, 10)).toBe('main');
  });

  it('8/10 = 80% 경계 (≥ 0.8) → cooldown', () => {
    expect(computePhaseFromProgress(8, 10)).toBe('cooldown');
  });

  it('9/10 = 90% < 100% → cooldown', () => {
    expect(computePhaseFromProgress(9, 10)).toBe('cooldown');
  });

  it('10/10 = 100% 경계 (≥ 1.0) → completed', () => {
    expect(computePhaseFromProgress(10, 10)).toBe('completed');
  });

  it('11/10 = 110% (overshoot) → completed', () => {
    expect(computePhaseFromProgress(11, 10)).toBe('completed');
  });

  it('cardsPlanned=0 (방어적) → completed', () => {
    expect(computePhaseFromProgress(0, 0)).toBe('completed');
  });

  it('cardsPlanned=-1 (비정상) → completed', () => {
    expect(computePhaseFromProgress(5, -1)).toBe('completed');
  });

  it('상수 정합 — PHASE_THRESHOLD_WARMUP=0.2, COOLDOWN=0.8', () => {
    expect(PHASE_THRESHOLD_WARMUP).toBe(0.2);
    expect(PHASE_THRESHOLD_COOLDOWN).toBe(0.8);
  });

  it('5/20 = 25% (불규칙) → main', () => {
    expect(computePhaseFromProgress(5, 20)).toBe('main');
  });

  it('16/20 = 80% (정확 경계) → cooldown', () => {
    expect(computePhaseFromProgress(16, 20)).toBe('cooldown');
  });
});

describe('computeStreakUpdate — D5 lock streak 4 분기', () => {
  const today = '2026-05-13';
  const yesterday = '2026-05-12';
  const twoDaysAgo = '2026-05-11';

  it('null (첫 학습) → current=1, changed=true', () => {
    const result = computeStreakUpdate(
      { lastStudyDate: null, currentStreak: 0, longestStreak: 0 },
      today,
    );
    expect(result.lastStudyDate).toBe(today);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.changed).toBe(true);
  });

  it('today (idempotent) → unchanged, changed=false', () => {
    const result = computeStreakUpdate(
      { lastStudyDate: today, currentStreak: 5, longestStreak: 10 },
      today,
    );
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(10);
    expect(result.changed).toBe(false);
  });

  it('yesterday → current +=1, longest 보존 (4 < 10)', () => {
    const result = computeStreakUpdate(
      { lastStudyDate: yesterday, currentStreak: 3, longestStreak: 10 },
      today,
    );
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(10);
    expect(result.changed).toBe(true);
  });

  it('yesterday + current 도달 longest 갱신', () => {
    const result = computeStreakUpdate(
      { lastStudyDate: yesterday, currentStreak: 9, longestStreak: 9 },
      today,
    );
    expect(result.currentStreak).toBe(10);
    expect(result.longestStreak).toBe(10);
  });

  it('gap (2일 공백) → current=1 reset, longest 보존', () => {
    const result = computeStreakUpdate(
      { lastStudyDate: twoDaysAgo, currentStreak: 7, longestStreak: 15 },
      today,
    );
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(15);
    expect(result.changed).toBe(true);
  });

  it('100일 streak 도달 — longest 99 → 100 갱신 (사용자 분노 케이스 차단)', () => {
    const result = computeStreakUpdate(
      { lastStudyDate: yesterday, currentStreak: 99, longestStreak: 99 },
      today,
    );
    expect(result.currentStreak).toBe(100);
    expect(result.longestStreak).toBe(100);
  });
});

describe('resolveSessionPhase — narrowing fallback', () => {
  it('정상 phase → narrow', () => {
    expect(resolveSessionPhase('warmup')).toBe('warmup');
    expect(resolveSessionPhase('main')).toBe('main');
    expect(resolveSessionPhase('cooldown')).toBe('cooldown');
    expect(resolveSessionPhase('completed')).toBe('completed');
  });

  it('null/undefined → warmup fallback + 콜백 호출', () => {
    const onFallback = vi.fn();
    expect(resolveSessionPhase(null, onFallback)).toBe('warmup');
    expect(resolveSessionPhase(undefined, onFallback)).toBe('warmup');
    expect(onFallback).toHaveBeenCalledTimes(2);
  });

  it('잘못된 값 → warmup fallback + 콜백 호출 (DB drift 감지)', () => {
    const onFallback = vi.fn();
    expect(resolveSessionPhase('invalid_phase', onFallback)).toBe('warmup');
    expect(onFallback).toHaveBeenCalledWith('invalid_phase', expect.any(Array));
  });

  it('정상 값에는 콜백 호출 X', () => {
    const onFallback = vi.fn();
    resolveSessionPhase('main', onFallback);
    expect(onFallback).not.toHaveBeenCalled();
  });
});

describe('resolveLearningMode — narrowing fallback', () => {
  it('정상 mode → narrow', () => {
    expect(resolveLearningMode('category')).toBe('category');
    expect(resolveLearningMode('weak')).toBe('weak');
    expect(resolveLearningMode('mixed')).toBe('mixed');
  });

  it('null → mixed fallback + 콜백', () => {
    const onFallback = vi.fn();
    expect(resolveLearningMode(null, onFallback)).toBe('mixed');
    expect(onFallback).toHaveBeenCalled();
  });

  it('잘못된 값 → mixed fallback + 콜백 (drift 감지)', () => {
    const onFallback = vi.fn();
    expect(resolveLearningMode('review', onFallback)).toBe('mixed');
    expect(onFallback).toHaveBeenCalledWith('review', expect.any(Array));
  });
});

describe('dayBoundsUtc — KST day → UTC ISO range (study_reviews COUNT 인덱스 정합)', () => {
  it('KST 2026-05-13 → UTC 2026-05-12T15:00:00.000Z ~ 2026-05-13T15:00:00.000Z', () => {
    const bounds = dayBoundsUtc('2026-05-13');
    expect(bounds.startUtc).toBe('2026-05-12T15:00:00.000Z');
    expect(bounds.endUtc).toBe('2026-05-13T15:00:00.000Z');
  });

  it('startUtc + 24h = endUtc (정확히 1일)', () => {
    const bounds = dayBoundsUtc('2026-05-13');
    const diff = Date.parse(bounds.endUtc) - Date.parse(bounds.startUtc);
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it('offsetHours=0 (UTC) → 동일 day 00:00 ~ 24:00', () => {
    const bounds = dayBoundsUtc('2026-05-13', 0);
    expect(bounds.startUtc).toBe('2026-05-13T00:00:00.000Z');
    expect(bounds.endUtc).toBe('2026-05-14T00:00:00.000Z');
  });

  it('잘못된 date 형식 → throw (silent corruption 차단)', () => {
    expect(() => dayBoundsUtc('invalid')).toThrow(/invalid date/);
  });

  it('★ COUNT range scan 정합 — KST 23:50 review가 today_count에 포함', () => {
    // KST 2026-05-13 23:50 = UTC 2026-05-13 14:50
    // KST today '2026-05-13' bounds: UTC 2026-05-12 15:00 ~ 2026-05-13 15:00
    // 14:50 < 15:00 → 포함 ✓
    const bounds = dayBoundsUtc('2026-05-13');
    const reviewUtc = '2026-05-13T14:50:00.000Z';
    expect(reviewUtc >= bounds.startUtc && reviewUtc < bounds.endUtc).toBe(true);
  });

  it('★ KST 익일 00:10 review는 today_count에 제외 (다음 day)', () => {
    // KST 2026-05-14 00:10 = UTC 2026-05-13 15:10
    // KST today '2026-05-13' bounds end: UTC 2026-05-13 15:00 (exclusive)
    // 15:10 >= 15:00 → 제외 ✓
    const bounds = dayBoundsUtc('2026-05-13');
    const reviewUtc = '2026-05-13T15:10:00.000Z';
    expect(reviewUtc < bounds.endUtc).toBe(false);
  });
});

describe('KST 자정 경계 시나리오 — 한국 사용자 학습 일관성', () => {
  it('KST 자정 직전 + 직후 학습 → streak 동일 day 인식 (idempotent)', () => {
    // KST 2026-05-13 23:50 = UTC 2026-05-13 14:50
    const beforeMidnight = new Date('2026-05-13T14:50:00Z');
    // KST 2026-05-13 23:55 = UTC 2026-05-13 14:55
    const evenLater = new Date('2026-05-13T14:55:00Z');
    expect(todayDateString(beforeMidnight)).toBe('2026-05-13');
    expect(todayDateString(evenLater)).toBe('2026-05-13');
    // 같은 KST day이므로 streak idempotent
  });

  it('KST 자정 직전 + 익일 아침 학습 → streak +1 (어제 → 오늘)', () => {
    // KST 2026-05-13 23:50 = UTC 2026-05-13 14:50
    const beforeMidnight = new Date('2026-05-13T14:50:00Z');
    // KST 2026-05-14 09:00 = UTC 2026-05-14 00:00
    const nextMorning = new Date('2026-05-14T00:00:00Z');
    const dayBefore = todayDateString(beforeMidnight);
    const dayAfter = todayDateString(nextMorning);
    expect(dayBefore).toBe('2026-05-13');
    expect(dayAfter).toBe('2026-05-14');
    expect(isOneDayApart(dayBefore, dayAfter)).toBe(true);
    // 어제 → 오늘 → streak 누적
    const update = computeStreakUpdate(
      { lastStudyDate: dayBefore, currentStreak: 5, longestStreak: 5 },
      dayAfter,
    );
    expect(update.currentStreak).toBe(6);
  });

  it('★ UTC 기준이면 깨지는 시나리오 — KST 익일 새벽 학습 정합 (CRIT-1 회귀 차단)', () => {
    // KST 2026-05-14 02:00 = UTC 2026-05-13 17:00
    // UTC 기준으로 todayDateString 호출 시 '2026-05-13' (한국 사용자에게는 익일)
    // KST 기준이어야 '2026-05-14' (한국 사용자 인식 일치)
    const earlyMorningKst = new Date('2026-05-13T17:00:00Z');
    expect(todayDateString(earlyMorningKst)).toBe('2026-05-14'); // KST default
    expect(todayDateString(earlyMorningKst, 0)).toBe('2026-05-13'); // UTC override
  });
});
