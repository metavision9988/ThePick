/**
 * @thepick/srs/weak-score — D2 lock 정합 약점 점수 산식.
 *
 * plan §6.4 + §13.1:
 *   `weakScore = α·(1 - subjectCorrectRate) + β·(1 - conceptStability_normalized)`
 *
 * α/β는 WEAK_SCORE_WEIGHTS (default α=0.6, β=0.4). D8 carry-over 조정 가능.
 *
 * 의미:
 *   - 0  = 완전 마스터 (정답률 100% + concept stability 충분)
 *   - 1  = 가장 약점 (정답률 0% + concept stability 0)
 *
 * 사용처:
 *   - apps/api study routes weak mode 추출 정책 (Step 3-UX-5)
 *   - 가중치 정렬: weak_score 높은 카드 우선 surface
 */

import { MASTERED_THRESHOLD_DAYS, WEAK_SCORE_WEIGHTS, type WeakScoreInput } from './types.js';

/**
 * Concept stability를 0~1로 정규화.
 *
 * FSRS stability는 0~∞ (일수 단위). MASTERED_THRESHOLD_DAYS (30일) 이상이면 1.
 * 미만이면 stability / MASTERED_THRESHOLD_DAYS 선형 비례.
 */
export function normalizeStability(stabilityDays: number): number {
  if (stabilityDays <= 0) return 0;
  if (stabilityDays >= MASTERED_THRESHOLD_DAYS) return 1;
  return stabilityDays / MASTERED_THRESHOLD_DAYS;
}

/**
 * weak_score 계산 (0~1).
 *
 * 정합:
 *   - subjectCorrectRate 0~1 외 값은 clamp (0 또는 1)
 *   - α + β 합 != 1 허용 (단순 가중치 합). 정규화 안 함.
 *   - α=0 + β=0 → 항상 0 반환 (모든 카드 동등 = 약점 모드 의미 상실, caller가 fallback 의무)
 */
export function computeWeakScore(input: WeakScoreInput): number {
  const alpha = input.alpha ?? WEAK_SCORE_WEIGHTS.alpha;
  const beta = input.beta ?? WEAK_SCORE_WEIGHTS.beta;
  const subjectRate = clamp01(input.subjectCorrectRate);
  const stabilityNorm = normalizeStability(input.conceptStability);

  const subjectComponent = alpha * (1 - subjectRate);
  const stabilityComponent = beta * (1 - stabilityNorm);

  return subjectComponent + stabilityComponent;
}

/**
 * 카드 정렬 비교 함수: weak_score 내림차순 (약점 카드 우선).
 *
 * 사용: cards.sort(byWeakScoreDesc) → 약점 카드 0번 index부터.
 */
export function byWeakScoreDesc<T extends { weakScore: number }>(a: T, b: T): number {
  return b.weakScore - a.weakScore;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}
