/**
 * @thepick/autoverify — 자체 검증 엔진 (역이식 STAGE 3).
 *
 * 순수 코어 · I/O 무의존 · Workers-safe · LLM 0 · 같은 입력 → 같은 결과.
 * 상위 plan = docs/plans/autoverify-package.plan.md (Q2 기결, 채택 (a)).
 * 본 패키지 현 범위 = STAGE 3 검사기 4종 + 종합 판정. **자동 승격은 포함하지 않는다**
 * (승격 가동 = autoverify plan §8 별도 게이트).
 *
 * 이식원 = catchall `packages/extraction` (실물 검증된 6게이트) — 파일별 이식원·판정은 각 모듈 주석.
 */
export {
  normalizeForBigrams,
  bigrams,
  coverage,
  checkQuoteFaithfulness,
  QUOTE_COVERAGE_THRESHOLD,
  MIN_QUOTE_BIGRAMS,
} from './bigram.js';
export type { QuoteFaithfulness } from './bigram.js';

export { longestCommonSubstringLength, lcsRatio, LCS_RATIO_THRESHOLD } from './lcs.js';

export { anchorsOf, missingAnchors } from './anchors.js';
export type { Anchors } from './anchors.js';

export { numericTokens, valueGrounded, stripNonValues } from './numeric.js';
export type { NumericToken, Groundedness, GroundednessKind } from './numeric.js';

export { verifyCard, summarize } from './verify-card.js';
export type {
  CardInput,
  CardVerdict,
  Finding,
  CheckId,
  Disposition,
  PilotSummary,
} from './verify-card.js';
