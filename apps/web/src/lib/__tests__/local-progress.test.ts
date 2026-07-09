/**
 * local-progress 통합 테스트 — 로컬 진도 계층 (promo-1st P2, G-1).
 *
 * fake-indexeddb 로 실제 Dexie 트랜잭션 위에서 검증. 결정성 = now inject.
 * 커버: FSRS 전이 누적 / 스트릭(동일일 idempotent·연속일 +1·공백 reset) /
 *       복습 큐(due) / KST 일일 카운트 / export↔import 왕복 / 봉투 검증 거부.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LocalProgressDb,
  countReviewsOnKstDate,
  exportLocalProgress,
  getDueCards,
  getStreak,
  importLocalProgress,
  recordReview,
  requestPersistentStorage,
  setDailyGoal,
  validateExport,
} from '../local-progress/index.js';

let db: LocalProgressDb;

beforeEach(() => {
  db = new LocalProgressDb();
});

afterEach(async () => {
  await db.delete();
});

// KST 낮 시간대 고정 (경계 모호성 없음).
const DAY1 = new Date('2026-07-10T12:00:00+09:00');
const DAY1_LATER = new Date('2026-07-10T13:00:00+09:00');
const DAY2 = new Date('2026-07-11T12:00:00+09:00');
const DAY4 = new Date('2026-07-13T12:00:00+09:00');

describe('recordReview — FSRS 전이 + 이력 + 스트릭', () => {
  it('cold start: 카드 자동 생성 + reps=1 + 이력 1건 + 스트릭 1', async () => {
    const r = await recordReview(db, {
      cardId: 'q-1',
      cardType: 'exam',
      rating: 'good',
      isCorrect: true,
      subject: '상법',
      now: DAY1,
    });
    expect(r.card.fsrs.reps).toBe(1);
    expect(r.card.fsrs.state).not.toBe('new');
    expect(r.card.totalReviews).toBe(1);
    expect(r.card.correctCount).toBe(1);
    expect(r.card.subject).toBe('상법');
    expect(r.streak.currentStreak).toBe(1);
    expect(r.streak.lastStudyDate).toBe('2026-07-10');
    expect(r.todayReviewCount).toBe(1);

    const reviews = await db.reviews.toArray();
    expect(reviews).toHaveLength(1);
    expect(reviews[0]!.rating).toBe('good');
    expect(reviews[0]!.isCorrect).toBe(true);
  });

  it('같은 카드 재리뷰: FSRS 누적(reps=2) + 정오 카운트 누적', async () => {
    await recordReview(db, {
      cardId: 'q-1',
      cardType: 'exam',
      rating: 'good',
      isCorrect: true,
      now: DAY1,
    });
    const r2 = await recordReview(db, {
      cardId: 'q-1',
      cardType: 'exam',
      rating: 'again',
      isCorrect: false,
      now: DAY1_LATER,
    });
    expect(r2.card.fsrs.reps).toBe(2);
    expect(r2.card.totalReviews).toBe(2);
    expect(r2.card.correctCount).toBe(1); // again/오답 → 미증가
    expect(r2.todayReviewCount).toBe(2);
  });

  it('스트릭: 동일일 idempotent → 연속일 +1 → 공백(2일) reset=1', async () => {
    await recordReview(db, { cardId: 'a', cardType: 'exam', rating: 'good', now: DAY1 });
    const same = await recordReview(db, {
      cardId: 'b',
      cardType: 'exam',
      rating: 'good',
      now: DAY1_LATER,
    });
    expect(same.streak.currentStreak).toBe(1); // 같은 날 = 불변

    const next = await recordReview(db, {
      cardId: 'c',
      cardType: 'exam',
      rating: 'good',
      now: DAY2,
    });
    expect(next.streak.currentStreak).toBe(2); // 연속일 +1
    expect(next.streak.longestStreak).toBe(2);

    const gap = await recordReview(db, {
      cardId: 'd',
      cardType: 'exam',
      rating: 'good',
      now: DAY4,
    });
    expect(gap.streak.currentStreak).toBe(1); // 07-11 → 07-13 공백 = reset
    expect(gap.streak.longestStreak).toBe(2); // longest 보존
  });

  it('플립 카드(isCorrect 생략) → 이력 isCorrect=null', async () => {
    await recordReview(db, { cardId: 'node-1', cardType: 'flip', rating: 'hard', now: DAY1 });
    const reviews = await db.reviews.toArray();
    expect(reviews[0]!.isCorrect).toBeNull();
    expect(reviews[0]!.cardType).toBe('flip');
  });
});

describe('getDueCards — 복습 큐', () => {
  it('again 카드는 즉시 due, 먼 미래 due 카드는 제외', async () => {
    await recordReview(db, { cardId: 'q-due', cardType: 'exam', rating: 'again', now: DAY1 });
    await recordReview(db, { cardId: 'q-easy', cardType: 'exam', rating: 'easy', now: DAY1 });

    // again 카드 due 는 분 단위(learning step) — 1시간 뒤 시점에서 due 도래.
    const due = await getDueCards(db, DAY1_LATER);
    const ids = due.map((c) => c.cardId);
    expect(ids).toContain('q-due');
    // easy 는 수일 뒤 → 미포함.
    expect(ids).not.toContain('q-easy');
  });
});

describe('스트릭 조회/일일목표', () => {
  it('빈 DB getStreak = default(0/0/null/goal 20)', async () => {
    const s = await getStreak(db);
    expect(s.currentStreak).toBe(0);
    expect(s.lastStudyDate).toBeNull();
    expect(s.dailyGoal).toBe(20);
  });

  it('setDailyGoal 검증: 범위 밖 throw', async () => {
    await setDailyGoal(db, 50);
    expect((await getStreak(db)).dailyGoal).toBe(50);
    await expect(setDailyGoal(db, 0)).rejects.toThrow('invalid dailyGoal');
    await expect(setDailyGoal(db, 501)).rejects.toThrow('invalid dailyGoal');
  });
});

describe('countReviewsOnKstDate — KST 경계', () => {
  it('KST 자정 직전/직후가 다른 날로 집계', async () => {
    // KST 2026-07-10 23:30 = UTC 14:30 / KST 2026-07-11 00:30 = UTC 前日 15:30
    await recordReview(db, {
      cardId: 'x',
      cardType: 'exam',
      rating: 'good',
      now: new Date('2026-07-10T23:30:00+09:00'),
    });
    await recordReview(db, {
      cardId: 'y',
      cardType: 'exam',
      rating: 'good',
      now: new Date('2026-07-11T00:30:00+09:00'),
    });
    expect(await countReviewsOnKstDate(db, '2026-07-10')).toBe(1);
    expect(await countReviewsOnKstDate(db, '2026-07-11')).toBe(1);
  });
});

describe('export ↔ import', () => {
  it('왕복: export → 새 DB import → 데이터 동일', async () => {
    await recordReview(db, {
      cardId: 'q-1',
      cardType: 'exam',
      rating: 'good',
      isCorrect: true,
      subject: '상법',
      now: DAY1,
    });
    await recordReview(db, { cardId: 'q-2', cardType: 'flip', rating: 'easy', now: DAY2 });
    const envelope = await exportLocalProgress(db, DAY2);

    // JSON 직렬화 왕복 (실사용 경로 재현).
    const parsed: unknown = JSON.parse(JSON.stringify(envelope));

    const db2 = new LocalProgressDb('thepick-local-progress-test2');
    try {
      // 기존 데이터가 있어도 전체 교체.
      await recordReview(db2, { cardId: 'stale', cardType: 'exam', rating: 'good', now: DAY1 });
      const counts = await importLocalProgress(db2, parsed, DAY2);
      expect(counts).toEqual({ cards: 2, reviews: 2 });

      expect(await db2.cards.count()).toBe(2);
      expect(await db2.cards.get('stale')).toBeUndefined(); // 교체 확인
      const q1 = await db2.cards.get('q-1');
      expect(q1?.subject).toBe('상법');
      expect(q1?.fsrs.reps).toBe(1);
      const streak = await getStreak(db2);
      expect(streak.currentStreak).toBe(2); // DAY1→DAY2 연속
    } finally {
      await db2.delete();
    }
  });

  it('봉투 검증: 스키마/버전/오염 필드 거부 (무음 부분 적재 금지)', () => {
    expect(() => validateExport(null)).toThrow('not an object');
    expect(() => validateExport({ schema: 'wrong' })).toThrow('schema mismatch');
    expect(() => validateExport({ schema: 'thepick-local-progress', version: 99 })).toThrow(
      'unsupported version',
    );
    expect(() =>
      validateExport({
        schema: 'thepick-local-progress',
        version: 1,
        exportedAt: '',
        cards: [
          {
            cardId: 'x',
            cardType: 'exam',
            subject: null,
            fsrs: { bogus: true },
            totalReviews: 0,
            correctCount: 0,
            updatedAt: '',
          },
        ],
        reviews: [],
        streak: null,
      }),
    ).toThrow('invalid cards');
    expect(() =>
      validateExport({
        schema: 'thepick-local-progress',
        version: 1,
        exportedAt: '',
        cards: [],
        reviews: [
          { cardId: 'x', cardType: 'exam', rating: 'INVALID', isCorrect: null, reviewedAt: '' },
        ],
        streak: null,
      }),
    ).toThrow('invalid reviews');
  });

  it('import 실패 시 기존 데이터 보존 (트랜잭션 원상 복구 아님 — 검증 선행 거부)', async () => {
    await recordReview(db, { cardId: 'keep', cardType: 'exam', rating: 'good', now: DAY1 });
    await expect(importLocalProgress(db, { schema: 'wrong' })).rejects.toThrow('schema mismatch');
    expect(await db.cards.count()).toBe(1); // 검증 단계 거부 = DB 무접촉
  });
});

describe('requestPersistentStorage', () => {
  it('navigator.storage 미지원(jsdom) → false (throw 없음)', async () => {
    expect(await requestPersistentStorage()).toBe(false);
  });
});
