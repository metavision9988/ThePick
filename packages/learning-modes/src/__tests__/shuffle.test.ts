import { describe, expect, it } from 'vitest';
import {
  CHOICE_LABELS,
  createPrng,
  dailySeed,
  shuffleChoices,
  shuffleWithSeed,
  todayDateString,
} from '../shuffle.js';

describe('todayDateString', () => {
  it('YYYY-MM-DD UTC 형식', () => {
    const s = todayDateString();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('dailySeed', () => {
  it('SHA-256 hex (64 chars)', async () => {
    const seed = await dailySeed({
      userId: 'user-1',
      questionId: 'q-1',
      date: '2026-05-12',
    });
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it('같은 input → 같은 seed (결정성)', async () => {
    const input = { userId: 'user-1', questionId: 'q-1', date: '2026-05-12' };
    const s1 = await dailySeed(input);
    const s2 = await dailySeed(input);
    expect(s1).toBe(s2);
  });

  it('userId 다르면 다른 seed', async () => {
    const s1 = await dailySeed({ userId: 'user-1', questionId: 'q-1', date: '2026-05-12' });
    const s2 = await dailySeed({ userId: 'user-2', questionId: 'q-1', date: '2026-05-12' });
    expect(s1).not.toBe(s2);
  });

  it('questionId 다르면 다른 seed', async () => {
    const s1 = await dailySeed({ userId: 'user-1', questionId: 'q-1', date: '2026-05-12' });
    const s2 = await dailySeed({ userId: 'user-1', questionId: 'q-2', date: '2026-05-12' });
    expect(s1).not.toBe(s2);
  });

  it('date 다르면 다른 seed (일자별 새 셔플 보장)', async () => {
    const s1 = await dailySeed({ userId: 'user-1', questionId: 'q-1', date: '2026-05-12' });
    const s2 = await dailySeed({ userId: 'user-1', questionId: 'q-1', date: '2026-05-13' });
    expect(s1).not.toBe(s2);
  });
});

describe('createPrng', () => {
  it('같은 시드 → 같은 sequence (결정성)', () => {
    const rng1 = createPrng('deadbeef00000000');
    const rng2 = createPrng('deadbeef00000000');
    for (let i = 0; i < 5; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('출력은 [0, 1) 범위', () => {
    const rng = createPrng('cafebabe00000000');
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hex 8자 미만은 throw', () => {
    expect(() => createPrng('1234')).toThrow(/hexSeed must be at least 8 chars/);
  });
});

describe('shuffleWithSeed', () => {
  it('같은 input → 같은 shuffle 결과', () => {
    const items = [1, 2, 3, 4, 5];
    const seed = 'deadbeef00000000';
    expect(shuffleWithSeed(items, seed)).toEqual(shuffleWithSeed(items, seed));
  });

  it('shuffle 결과는 원본 permutation', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const result = shuffleWithSeed(items, 'cafebabe00000000');
    expect(result.length).toBe(items.length);
    expect(result.slice().sort()).toEqual(items.slice().sort());
  });

  it('빈 배열은 빈 배열', () => {
    expect(shuffleWithSeed([], 'deadbeef00000000')).toEqual([]);
  });

  it('원본을 mutate하지 않음', () => {
    const items = [1, 2, 3, 4, 5];
    const snapshot = items.slice();
    shuffleWithSeed(items, 'deadbeef00000000');
    expect(items).toEqual(snapshot);
  });
});

describe('shuffleChoices', () => {
  const choices = [
    '보험가액의 50%',
    '보험가액의 60%',
    '보험가액의 70%',
    '보험가액의 80%',
    '보험가액의 90%',
  ];

  it('5지선다 → label A~E + originalIndex 0~4 정합', async () => {
    const result = await shuffleChoices(choices, {
      userId: 'user-1',
      questionId: 'q-1',
      date: '2026-05-12',
    });
    expect(result.length).toBe(5);
    expect(result.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(
      result
        .map((c) => c.originalIndex)
        .slice()
        .sort(),
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it('originalIndex로 원본 텍스트 fetch 정합', async () => {
    const result = await shuffleChoices(choices, {
      userId: 'user-1',
      questionId: 'q-1',
      date: '2026-05-12',
    });
    for (const choice of result) {
      expect(choice.text).toBe(choices[choice.originalIndex]);
    }
  });

  it('같은 input → 같은 shuffle (device sync 보장)', async () => {
    const input = { userId: 'user-1', questionId: 'q-1', date: '2026-05-12' };
    const r1 = await shuffleChoices(choices, input);
    const r2 = await shuffleChoices(choices, input);
    expect(r1).toEqual(r2);
  });

  it('date 변경 시 새 shuffle (다음날 위치 변경)', async () => {
    const r1 = await shuffleChoices(choices, {
      userId: 'user-1',
      questionId: 'q-1',
      date: '2026-05-12',
    });
    const r2 = await shuffleChoices(choices, {
      userId: 'user-1',
      questionId: 'q-1',
      date: '2026-05-13',
    });
    // 매우 적은 확률로 동일할 수 있으나 적어도 한 항목은 위치 변경 기대.
    // 5! = 120 permutations 중 동일 확률 1/120 → flake 위험 무시 가능 수준.
    const sameOrder = r1.every((c, i) => c.originalIndex === r2[i]!.originalIndex);
    expect(sameOrder).toBe(false);
  });

  it('userId 다르면 다른 shuffle (cross-user 위치 차단)', async () => {
    const r1 = await shuffleChoices(choices, {
      userId: 'user-1',
      questionId: 'q-1',
      date: '2026-05-12',
    });
    const r2 = await shuffleChoices(choices, {
      userId: 'user-2',
      questionId: 'q-1',
      date: '2026-05-12',
    });
    const sameOrder = r1.every((c, i) => c.originalIndex === r2[i]!.originalIndex);
    expect(sameOrder).toBe(false);
  });

  it('4지선다 (length 4) 허용', async () => {
    const four = ['a', 'b', 'c', 'd'];
    const result = await shuffleChoices(four, {
      userId: 'user-1',
      questionId: 'q-1',
      date: '2026-05-12',
    });
    expect(result.length).toBe(4);
    expect(result.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('1지선다 (length 1) throw', async () => {
    await expect(
      shuffleChoices(['only'], {
        userId: 'user-1',
        questionId: 'q-1',
        date: '2026-05-12',
      }),
    ).rejects.toThrow(/invalid choice count/);
  });

  it('6지선다 (length 6) throw', async () => {
    await expect(
      shuffleChoices(['a', 'b', 'c', 'd', 'e', 'f'], {
        userId: 'user-1',
        questionId: 'q-1',
        date: '2026-05-12',
      }),
    ).rejects.toThrow(/invalid choice count/);
  });
});

describe('CHOICE_LABELS', () => {
  it('5개 라벨 A~E', () => {
    expect(CHOICE_LABELS).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
