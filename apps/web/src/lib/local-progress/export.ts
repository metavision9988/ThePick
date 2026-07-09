/**
 * local-progress/export — 진도 내보내기/가져오기 (BE-7 선확보 + D-1 증발 안전망).
 *
 * 봉투(v1) = 전체 스냅샷(cards/reviews/streak) + 스키마 식별자·버전.
 * import = 검증 통과 시 **전체 교체** — 용도가 "증발 후 복구/기기 이동"이라
 * 반쪽 병합보다 예측 가능성이 우선(병합 전략은 유료 계정 이전 BE-7 본편 carry-over).
 * 검증 실패 = 자세한 사유와 함께 throw (무음 부분 적재 금지).
 */

import { FSRS_RATINGS, type FsrsCardState } from '@thepick/srs';
import {
  LOCAL_CARD_TYPES,
  LOCAL_PROGRESS_SCHEMA_VERSION,
  META_ROW_ID,
  STREAK_ROW_ID,
  type LocalCard,
  type LocalProgressDb,
  type LocalReview,
  type LocalStreak,
} from './db.js';

export const EXPORT_SCHEMA_ID = 'thepick-local-progress';

export interface LocalProgressExport {
  readonly schema: typeof EXPORT_SCHEMA_ID;
  readonly version: number;
  readonly exportedAt: string;
  readonly cards: readonly LocalCard[];
  readonly reviews: readonly LocalReview[];
  readonly streak: LocalStreak | null;
}

/** 전체 스냅샷 직렬화 (JSON.stringify 가능한 plain object). */
export async function exportLocalProgress(
  db: LocalProgressDb,
  now: Date = new Date(),
): Promise<LocalProgressExport> {
  const [cards, reviews, streak] = await Promise.all([
    db.cards.toArray(),
    db.reviews.orderBy('reviewedAt').toArray(),
    db.streak.get(STREAK_ROW_ID),
  ]);
  return {
    schema: EXPORT_SCHEMA_ID,
    version: LOCAL_PROGRESS_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    cards,
    reviews,
    streak: streak ?? null,
  };
}

const FSRS_STATES = ['new', 'learning', 'review', 'relearning'] as const;

function isFsrsCardState(v: unknown): v is FsrsCardState {
  if (v === null || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.due === 'string' &&
    typeof s.stability === 'number' &&
    typeof s.difficulty === 'number' &&
    typeof s.reps === 'number' &&
    typeof s.lapses === 'number' &&
    FSRS_STATES.includes(s.state as (typeof FSRS_STATES)[number]) &&
    (s.lastReview === null || typeof s.lastReview === 'string') &&
    typeof s.scheduledDays === 'number'
  );
}

function isLocalCard(v: unknown): v is LocalCard {
  if (v === null || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.cardId === 'string' &&
    c.cardId.length > 0 &&
    LOCAL_CARD_TYPES.includes(c.cardType as (typeof LOCAL_CARD_TYPES)[number]) &&
    (c.subject === null || typeof c.subject === 'string') &&
    isFsrsCardState(c.fsrs) &&
    typeof c.totalReviews === 'number' &&
    typeof c.correctCount === 'number' &&
    typeof c.updatedAt === 'string'
  );
}

function isLocalReview(v: unknown): v is LocalReview {
  if (v === null || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.cardId === 'string' &&
    LOCAL_CARD_TYPES.includes(r.cardType as (typeof LOCAL_CARD_TYPES)[number]) &&
    FSRS_RATINGS.includes(r.rating as (typeof FSRS_RATINGS)[number]) &&
    (r.isCorrect === null || typeof r.isCorrect === 'boolean') &&
    typeof r.reviewedAt === 'string'
  );
}

function isLocalStreak(v: unknown): v is LocalStreak {
  if (v === null || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    s.id === STREAK_ROW_ID &&
    typeof s.currentStreak === 'number' &&
    typeof s.longestStreak === 'number' &&
    (s.lastStudyDate === null || typeof s.lastStudyDate === 'string') &&
    typeof s.dailyGoal === 'number'
  );
}

/**
 * 봉투 검증 — 실패 시 사유 포함 throw (무음 부분 적재 금지).
 * JSON.parse 산출물(unknown)을 그대로 받는다.
 */
export function validateExport(raw: unknown): LocalProgressExport {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('import failed: not an object');
  }
  const e = raw as Record<string, unknown>;
  if (e.schema !== EXPORT_SCHEMA_ID) {
    throw new Error(`import failed: schema mismatch (got ${String(e.schema)})`);
  }
  if (e.version !== LOCAL_PROGRESS_SCHEMA_VERSION) {
    // 버전 증가 시 여기서 마이그레이션 분기 추가 — v1 은 동일 버전만.
    throw new Error(`import failed: unsupported version ${String(e.version)}`);
  }
  if (!Array.isArray(e.cards) || !e.cards.every(isLocalCard)) {
    throw new Error('import failed: invalid cards');
  }
  if (!Array.isArray(e.reviews) || !e.reviews.every(isLocalReview)) {
    throw new Error('import failed: invalid reviews');
  }
  if (e.streak !== null && !isLocalStreak(e.streak)) {
    throw new Error('import failed: invalid streak');
  }
  return {
    schema: EXPORT_SCHEMA_ID,
    version: LOCAL_PROGRESS_SCHEMA_VERSION,
    exportedAt: typeof e.exportedAt === 'string' ? e.exportedAt : '',
    cards: e.cards as LocalCard[],
    reviews: e.reviews as LocalReview[],
    streak: (e.streak as LocalStreak | null) ?? null,
  };
}

/**
 * 검증된 봉투로 **전체 교체** import (단일 트랜잭션 — 중간 실패 시 원상 복구).
 * 호출 측(UI)이 사용자 확인을 먼저 받는다(기존 로컬 진도 소실 고지).
 */
export async function importLocalProgress(
  db: LocalProgressDb,
  raw: unknown,
  now: Date = new Date(),
): Promise<{ cards: number; reviews: number }> {
  const data = validateExport(raw);
  await db.transaction('rw', [db.cards, db.reviews, db.streak, db.meta], async () => {
    await Promise.all([db.cards.clear(), db.reviews.clear(), db.streak.clear()]);
    await db.cards.bulkAdd(data.cards as LocalCard[]);
    // id(auto-increment)는 원본 값 보존 대신 재발급 — 봉투 간 충돌 방지.
    await db.reviews.bulkAdd((data.reviews as LocalReview[]).map(({ id: _id, ...rest }) => rest));
    if (data.streak !== null) await db.streak.put(data.streak);
    await db.meta.put({
      id: META_ROW_ID,
      schemaVersion: LOCAL_PROGRESS_SCHEMA_VERSION,
      createdAt: now.toISOString(),
    });
  });
  return { cards: data.cards.length, reviews: data.reviews.length };
}
