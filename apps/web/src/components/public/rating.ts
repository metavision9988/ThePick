/**
 * rating — 공개 학습 표면의 FSRS rating 매핑 순수 함수 (P4-D4).
 *
 * FsrsRating = 'again'(모름) | 'hard'(애매) | 'good'(알았음) | 'easy'(쉬움).
 * 'easy'는 카드플립 자평 전용 — 자동 채점 경로는 easy 를 주지 않는다(과대 간격 방지).
 */

import type { FsrsRating } from '@thepick/srs';

/** 4지선다 자동 채점 → rating: 맞음=good / 틀림=again. */
export function ratingFromMcGrade(isCorrect: boolean): FsrsRating {
  return isCorrect ? 'good' : 'again';
}

/**
 * 빵꾸노트(M1+M9) — 사용 힌트 수를 간격에 반영(힌트 쓸수록 다음 복습 짧게):
 * 틀림=again / 맞음·힌트 0=good / 맞음·힌트 1개 이상=hard.
 */
export function ratingFromBlankGrade(isCorrect: boolean, hintsUsed: number): FsrsRating {
  if (!isCorrect) return 'again';
  return hintsUsed > 0 ? 'hard' : 'good';
}

/** 카드플립 4버튼 (모바일 하단 엄지영역, 1~4 키 순서) — FsrsRating 직결. */
export const FLIP_RATING_LABELS: ReadonlyArray<{ rating: FsrsRating; label: string }> = [
  { rating: 'again', label: '모름' },
  { rating: 'hard', label: '애매' },
  { rating: 'good', label: '알았음' },
  { rating: 'easy', label: '쉬움' },
] as const;
