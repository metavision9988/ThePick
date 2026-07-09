/**
 * local-progress/store — 로컬 진도 연산 계층 (promo-1st P2, G-1 로컬 전용).
 *
 * 알고리즘은 전부 기존 정본 재사용(재구현 0):
 *   - FSRS 스케줄  = @thepick/srs (createFreshCard / scheduleReview / replayReviews)
 *   - 스트릭       = @thepick/learning-modes computeStreakUpdate (+ todayDateString KST,
 *                    ADR-041 정합 — 서버 streak_records 와 동일 날짜 축)
 *
 * 본 모듈은 위 순수 엔진과 Dexie 영속(db.ts)을 잇는 thin 계층이며, 소비자는
 * P4 화면(FE-5 카드플립 / FE-7 스트릭 / 복습 큐)이다.
 */

import { createFreshCard, scheduleReview, type FsrsCardState, type FsrsRating } from '@thepick/srs';
import { computeStreakUpdate, dayBoundsUtc, todayDateString } from '@thepick/learning-modes';
import {
  DEFAULT_DAILY_GOAL,
  LOCAL_PROGRESS_SCHEMA_VERSION,
  META_ROW_ID,
  STREAK_ROW_ID,
  isValidDailyGoal,
  type LocalCard,
  type LocalCardType,
  type LocalProgressDb,
  type LocalReview,
  type LocalStreak,
} from './db.js';

export interface RecordReviewInput {
  readonly cardId: string;
  readonly cardType: LocalCardType;
  readonly rating: FsrsRating;
  /** 퀴즈 카드 채점 결과. 플립 자기평가 카드는 생략(null 저장). */
  readonly isCorrect?: boolean;
  readonly subject?: string | null;
  /** 결정성 테스트용 inject. default = new Date(). */
  readonly now?: Date;
}

export interface RecordReviewResult {
  readonly card: LocalCard;
  readonly streak: LocalStreak;
  /** 오늘 완료한 review 수 (dailyGoal 진척 — KST 날짜 기준). */
  readonly todayReviewCount: number;
}

/**
 * review 1건 기록 — 카드 FSRS 전이 + 이력 append + 스트릭 갱신 (단일 트랜잭션).
 *
 * 카드 미존재 시 createFreshCard 로 cold start (첫 만남 = 그 자리에서 초기화).
 */
export async function recordReview(
  db: LocalProgressDb,
  input: RecordReviewInput,
): Promise<RecordReviewResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const today = todayDateString(now);

  return db.transaction('rw', [db.cards, db.reviews, db.streak, db.meta], async () => {
    await ensureMeta(db, nowIso);

    const existing = await db.cards.get(input.cardId);
    const prevState: FsrsCardState = existing?.fsrs ?? createFreshCard(now);
    const { nextState } = scheduleReview({ state: prevState, rating: input.rating, now });

    const card: LocalCard = {
      cardId: input.cardId,
      cardType: input.cardType,
      subject: input.subject ?? existing?.subject ?? null,
      fsrs: nextState,
      totalReviews: (existing?.totalReviews ?? 0) + 1,
      correctCount: (existing?.correctCount ?? 0) + (input.isCorrect === true ? 1 : 0),
      updatedAt: nowIso,
    };
    await db.cards.put(card);

    const review: LocalReview = {
      cardId: input.cardId,
      cardType: input.cardType,
      rating: input.rating,
      isCorrect: input.isCorrect ?? null,
      reviewedAt: nowIso,
    };
    await db.reviews.add(review);

    const prevStreak = await getStreak(db);
    const update = computeStreakUpdate(
      {
        lastStudyDate: prevStreak.lastStudyDate,
        currentStreak: prevStreak.currentStreak,
        longestStreak: prevStreak.longestStreak,
      },
      today,
    );
    const streak: LocalStreak = {
      id: STREAK_ROW_ID,
      currentStreak: update.currentStreak,
      longestStreak: update.longestStreak,
      lastStudyDate: update.lastStudyDate,
      dailyGoal: prevStreak.dailyGoal,
    };
    // changed=false 는 same-day 재호출뿐(computeStreakUpdate 계약) — 그때는 write 불요.
    if (update.changed) {
      await db.streak.put(streak);
    }

    const todayReviewCount = await countReviewsOnKstDate(db, today);
    return { card, streak, todayReviewCount };
  });
}

/** 스트릭 조회 (부재 시 default 반환 — 쓰지는 않음). */
export async function getStreak(db: LocalProgressDb): Promise<LocalStreak> {
  const row = await db.streak.get(STREAK_ROW_ID);
  return (
    row ?? {
      id: STREAK_ROW_ID,
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
      dailyGoal: DEFAULT_DAILY_GOAL,
    }
  );
}

/** 일일 목표 변경 (FE-7). 가드 = db.ts isValidDailyGoal (export 봉투 검증과 공유). */
export async function setDailyGoal(db: LocalProgressDb, dailyGoal: number): Promise<void> {
  if (!isValidDailyGoal(dailyGoal)) {
    throw new Error(`invalid dailyGoal: ${dailyGoal} (expected 1~500)`);
  }
  const prev = await getStreak(db);
  await db.streak.put({ ...prev, dailyGoal });
}

/**
 * 복습 기한 도래 카드 (fsrs.due <= now) — due 오름차순.
 * 서버 /api/progress/due 대응물의 로컬 판 (G-1: 서버 진도 없음).
 */
export async function getDueCards(
  db: LocalProgressDb,
  now: Date = new Date(),
  limit = 20,
): Promise<LocalCard[]> {
  const nowIso = now.toISOString();
  return db.cards.where('fsrs.due').belowOrEqual(nowIso).limit(limit).sortBy('fsrs.due');
}

/** 오늘(KST) 완료 review 수 — dailyGoal 진척 분모. */
export async function countReviewsOnKstDate(db: LocalProgressDb, kstDate: string): Promise<number> {
  // KST 일 경계 = learning-modes dayBoundsUtc 정본(ADR-041, 서버 study 경로와 동일 함수 —
  // 4-Pass MAJOR-1: 인라인 재구현 금지·무효 입력 시 사유 throw 무상 획득).
  const { startUtc, endUtc } = dayBoundsUtc(kstDate);
  return db.reviews.where('reviewedAt').between(startUtc, endUtc, true, false).count();
}

async function ensureMeta(db: LocalProgressDb, nowIso: string): Promise<void> {
  const meta = await db.meta.get(META_ROW_ID);
  if (meta === undefined) {
    await db.meta.add({
      id: META_ROW_ID,
      schemaVersion: LOCAL_PROGRESS_SCHEMA_VERSION,
      createdAt: nowIso,
    });
  }
}

/**
 * 영속 스토리지 승격 요청 — 브라우저 데이터 정리(특히 Safari ITP 7일)로부터
 * 로컬 진도 증발을 완화(보장은 아님 — export 가 최종 안전망).
 * 미지원/거부 시 false (호출 측 UI 안내용).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || navigator.storage?.persist === undefined) {
      return false;
    }
    // 이미 영속이면 재요청 없이 true.
    if ((await navigator.storage.persisted?.()) === true) return true;
    return await navigator.storage.persist();
  } catch (err) {
    console.warn('[local-progress] persist request failed', err);
    return false;
  }
}
