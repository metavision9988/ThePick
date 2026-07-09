/**
 * local-progress — 무인증 공개 서비스 로컬 진도 계층 공개 API (promo-1st P2, G-1).
 *
 * 소비자: P4 화면(FE-5 카드플립 / FE-7 스트릭 / 복습 큐 / 결과 요약).
 */

export {
  DEFAULT_DAILY_GOAL,
  LOCAL_CARD_TYPES,
  LOCAL_PROGRESS_SCHEMA_VERSION,
  LocalProgressDb,
  getLocalProgressDb,
  type LocalCard,
  type LocalCardType,
  type LocalMeta,
  type LocalReview,
  type LocalStreak,
} from './db.js';

export {
  countReviewsOnKstDate,
  getDueCards,
  getStreak,
  recordReview,
  requestPersistentStorage,
  setDailyGoal,
  type RecordReviewInput,
  type RecordReviewResult,
} from './store.js';

export {
  EXPORT_SCHEMA_ID,
  exportLocalProgress,
  importLocalProgress,
  validateExport,
  type LocalProgressExport,
} from './export.js';
