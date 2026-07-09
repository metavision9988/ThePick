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
  isValidDailyGoal,
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

// ── 의미 검증 헬퍼 (4-Pass MAJOR-3: typeof 만으로는 오염 봉투가 통과해
//    지연 RangeError(scheduleReview) 또는 due-큐 무음 누락을 유발 — 실측 확증) ──

/** 파싱 가능한 날짜 문자열 (Invalid Date 차단 — 오염 due = 복습 큐 영구 누락 경로). */
function isParseableDate(v: unknown): v is string {
  return typeof v === 'string' && Number.isFinite(Date.parse(v));
}

/** 유한 수 (JSON `1e999` = Infinity 인입 가능 — 스케줄 파괴 실측). */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 음이 아닌 정수 카운터 (reps/lapses/totalReviews/correctCount/streak). */
function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isFsrsCardState(v: unknown): v is FsrsCardState {
  if (v === null || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    isParseableDate(s.due) &&
    isFiniteNumber(s.stability) &&
    s.stability >= 0 &&
    isFiniteNumber(s.difficulty) &&
    isNonNegativeInt(s.reps) &&
    isNonNegativeInt(s.lapses) &&
    FSRS_STATES.includes(s.state as (typeof FSRS_STATES)[number]) &&
    (s.lastReview === null || isParseableDate(s.lastReview)) &&
    isFiniteNumber(s.scheduledDays) &&
    s.scheduledDays >= 0
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
    isNonNegativeInt(c.totalReviews) &&
    isNonNegativeInt(c.correctCount) &&
    isParseableDate(c.updatedAt)
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
    isParseableDate(r.reviewedAt)
  );
}

function isLocalStreak(v: unknown): v is LocalStreak {
  if (v === null || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    s.id === STREAK_ROW_ID &&
    isNonNegativeInt(s.currentStreak) &&
    isNonNegativeInt(s.longestStreak) &&
    (s.lastStudyDate === null || typeof s.lastStudyDate === 'string') &&
    isValidDailyGoal(s.dailyGoal)
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
  if (!Array.isArray(e.cards)) {
    throw new Error('import failed: cards is not an array');
  }
  const badCard = e.cards.findIndex((c) => !isLocalCard(c));
  if (badCard !== -1) {
    throw new Error(`import failed: invalid cards[${badCard}]`);
  }
  // cardId 유일성 — 중복은 bulkAdd 불투명 BulkError 대신 여기서 사유 throw (4-Pass m-11).
  const seenIds = new Set<string>();
  for (const c of e.cards as LocalCard[]) {
    if (seenIds.has(c.cardId)) {
      throw new Error(`import failed: duplicate cardId "${c.cardId}"`);
    }
    seenIds.add(c.cardId);
  }
  if (!Array.isArray(e.reviews)) {
    throw new Error('import failed: reviews is not an array');
  }
  const badReview = e.reviews.findIndex((r) => !isLocalReview(r));
  if (badReview !== -1) {
    throw new Error(`import failed: invalid reviews[${badReview}]`);
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
    // 최초 사용 시각(createdAt)은 import 로 리셋하지 않는다 (4-Pass m-5 — 기기 이동 시 보존).
    const prevMeta = await db.meta.get(META_ROW_ID);
    await Promise.all([db.cards.clear(), db.reviews.clear(), db.streak.clear()]);
    await db.cards.bulkAdd(data.cards as LocalCard[]);
    // id(auto-increment)는 원본 값 보존 대신 재발급 — 봉투 간 충돌 방지.
    await db.reviews.bulkAdd((data.reviews as LocalReview[]).map(({ id: _id, ...rest }) => rest));
    if (data.streak !== null) await db.streak.put(data.streak);
    await db.meta.put({
      id: META_ROW_ID,
      schemaVersion: LOCAL_PROGRESS_SCHEMA_VERSION,
      createdAt: prevMeta?.createdAt ?? now.toISOString(),
    });
  });
  return { cards: data.cards.length, reviews: data.reviews.length };
}
