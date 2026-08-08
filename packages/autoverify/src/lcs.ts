/**
 * 최장 공통 '연속' 부분문자열 비율 — 짜깁기(재배열) 탐지 (STAGE 3 · 3-3).
 *
 * 이식원: catchall `packages/extraction/src/lcs.ts` (ADOPT).
 *
 * 왜 필요한가: 바이그램 커버리지(3-1)는 **순서를 보지 않는다**. 원문 단어를 재조합한
 * 속성-스왑 위조(원문 "자기부담비율 20%·30%" → 위조 "자기부담비율 30%"만 남기기,
 * 또는 두 조문의 조각을 이어 붙이기)는 coverage 1.0 으로 통과한다.
 * 진짜 인용은 원문에 **통짜 연속**으로 존재하므로 LCS 비율이 1.0 에 가깝고,
 * 짜깁기는 조각나서 비율이 급락한다. 결정론 · LLM 0.
 *
 * ★정규화는 바이그램 정본과 **같은 함수**를 쓴다(복제 금지 — bigram.ts 주석 참조).
 */
import { normalizeForBigrams } from './bigram.js';

/** 미만이면 짜깁기 의심 → 사람 큐. */
export const LCS_RATIO_THRESHOLD = 0.8;

/**
 * 두 문자열의 최장 공통 '연속' 부분문자열 길이 (정규화 후, 코드포인트 단위).
 * DP O(|a|·|b|) — 인용 15~700자 × 청크 수천 자 규모라 충분하다.
 */
export function longestCommonSubstringLength(a: string, b: string): number {
  const s = [...normalizeForBigrams(a)];
  const t = [...normalizeForBigrams(b)];
  if (s.length === 0 || t.length === 0) return 0;
  let best = 0;
  let prev = new Array<number>(t.length + 1).fill(0);
  for (let i = 1; i <= s.length; i += 1) {
    const cur = new Array<number>(t.length + 1).fill(0);
    for (let j = 1; j <= t.length; j += 1) {
      if (s[i - 1] === t[j - 1]) {
        cur[j] = prev[j - 1]! + 1;
        if (cur[j]! > best) best = cur[j]!;
      }
    }
    prev = cur;
  }
  return best;
}

/** quote 가 sourceText 에 얼마나 '연속으로' 실재하는가 (0~1). 빈 quote = 0 (fail-closed). */
export function lcsRatio(quote: string, sourceText: string): number {
  const qLen = [...normalizeForBigrams(quote)].length;
  if (qLen === 0) return 0;
  return longestCommonSubstringLength(quote, sourceText) / qLen;
}
