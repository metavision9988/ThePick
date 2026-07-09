/**
 * local-progress/db — 무인증 공개 서비스 로컬 진도 **쓰기 스토어** (promo-1st P2, G-1).
 *
 * ★ 기존 `lib/db.ts`(D1→IDB read-only 미러)와 **완전 별개의 Dexie DB** —
 *   미러 계약을 오염시키지 않는다(지뢰 #7). 이 DB 는 클라이언트가 유일한
 *   쓰기 주체이며 서버 동기화가 없다(서버 user 데이터 0 = G-1).
 *
 * 스토어 구성:
 *   - cards   : 카드별 FSRS 상태 + 정오 누적 (cardId = 문항 id 등)
 *   - reviews : append-only review 이력 — FSRS replay 원천 + export 백본
 *   - streak  : 단일 행(고정 key) 스트릭/일일목표
 *   - meta    : 스키마 버전 등 (export/import 무결성)
 *
 * ★ 결정 기록(위임, 4-Pass m-7/m-12): 핸드오프 P2 의 "세션" 축은 **영속 제외** —
 *   세션은 본질 휘발성(탭 수명)이라 P4 화면의 in-memory 상태로 두고, 이력 원천은
 *   reviews(append-only)가 담당. FE-8 결과 요약이 영속 세션 경계를 요구하면
 *   v2 스토어 추가(스키마 버전 증가 + validateExport 마이그레이션 분기 예약).
 *
 * 증발 완화(D-1 정직 한계): `requestPersistentStorage()` + export/import(BE-7 선확보).
 */

import Dexie, { type Table } from 'dexie';
import type { FsrsCardState, FsrsRating } from '@thepick/srs';

/** export 봉투/DB 스키마 버전 — 구조 변경 시 증가 + import 마이그레이션 분기. */
export const LOCAL_PROGRESS_SCHEMA_VERSION = 1;

/** 로컬 카드 종류 — 'exam' = 기출 문항 풀이, 'flip' = 카드플립(FE-5). */
export const LOCAL_CARD_TYPES = ['exam', 'flip'] as const;
export type LocalCardType = (typeof LOCAL_CARD_TYPES)[number];

export interface LocalCard {
  /** 카드 식별자 — exam 카드는 exam_questions.id. (PK) */
  readonly cardId: string;
  readonly cardType: LocalCardType;
  /** 과목 (픽커/약점 통계 축). null = 미상. */
  readonly subject: string | null;
  /** FSRS 카드 상태 (@thepick/srs FsrsCardState 직렬화 그대로). */
  readonly fsrs: FsrsCardState;
  readonly totalReviews: number;
  readonly correctCount: number;
  /** ISO 8601 — 마지막 갱신. */
  readonly updatedAt: string;
}

export interface LocalReview {
  /** auto-increment PK (Dexie '++'). insert 시 미지정. */
  readonly id?: number;
  readonly cardId: string;
  readonly cardType: LocalCardType;
  readonly rating: FsrsRating;
  /** 채점 결과 (퀴즈 카드만 — 플립 자기평가는 null). */
  readonly isCorrect: boolean | null;
  /** ISO 8601. replay 시 chronological 정렬 키. */
  readonly reviewedAt: string;
}

export interface LocalStreak {
  /** 고정 key 'streak' — 단일 행. */
  readonly id: string;
  readonly currentStreak: number;
  readonly longestStreak: number;
  /** KST YYYY-MM-DD (ADR-041 정합 — learning-modes todayDateString). */
  readonly lastStudyDate: string | null;
  readonly dailyGoal: number;
}

export interface LocalMeta {
  /** 고정 key 'meta' — 단일 행. */
  readonly id: string;
  readonly schemaVersion: number;
  /** 최초 사용 시각 (ISO 8601). */
  readonly createdAt: string;
}

export const STREAK_ROW_ID = 'streak';
export const META_ROW_ID = 'meta';
export const DEFAULT_DAILY_GOAL = 20;

/**
 * dailyGoal 유효성 — 스키마 불변식(1~500 정수). store.setDailyGoal 과
 * export 봉투 검증이 **동일 가드 공유**(이중 잣대 차단, 4-Pass MAJOR-3/m-4).
 */
export function isValidDailyGoal(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 500;
}

/**
 * Dexie DB — 이름은 미러 DB 와 구분되는 고유값.
 * 인덱스만 선언(Dexie 규약) — 나머지 속성은 자동 저장.
 */
export class LocalProgressDb extends Dexie {
  cards!: Table<LocalCard, string>;
  reviews!: Table<LocalReview, number>;
  streak!: Table<LocalStreak, string>;
  meta!: Table<LocalMeta, string>;

  /** name override 는 테스트 격리 전용 — 앱 코드는 getLocalProgressDb() 경유(단일 인스턴스). */
  constructor(name = 'thepick-local-progress') {
    super(name);
    this.version(LOCAL_PROGRESS_SCHEMA_VERSION).stores({
      // PK cardId + due 인덱스(복습 큐) + subject/cardType 필터
      cards: 'cardId, fsrs.due, subject, cardType',
      // auto-increment + cardId 조회 + reviewedAt 정렬(replay/export)
      reviews: '++id, cardId, reviewedAt',
      streak: 'id',
      meta: 'id',
    });
  }
}

let singleton: LocalProgressDb | null = null;

/** 앱 전역 단일 인스턴스 (Dexie 는 다중 open 시 경합). 테스트는 new LocalProgressDb() 직접. */
export function getLocalProgressDb(): LocalProgressDb {
  if (singleton === null) singleton = new LocalProgressDb();
  return singleton;
}
