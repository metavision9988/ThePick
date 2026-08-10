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

/**
 * 미만이면 짜깁기 의심 → 사람 큐.
 *
 * ★1.0 = **정규화 후 정확 포함**(quote 가 sourceText 의 연속 부분문자열)과 수학적으로 동치다.
 *   `lcsRatio = LCS(quote, src) / |quote|` 이고 `LCS ≤ |quote|` 이므로 `ratio === 1` ⟺ 포함.
 *
 * ★왜 0.8 이 아니라 1.0 인가 (2026-08-10 재설계 — 08-08 독립 리뷰 §2 처분).
 *   근거는 **연역 하나뿐이며, 표본 통계가 아니다**:
 *     `source_quote` 의 계약은 "**축자**(verbatim) 원문"이다(migrations/0047 헤더:
 *     "원문은 언제든 PDF 로 재현 가능해야 한다"). 축자 인용은 **정의상** 출처의 연속
 *     부분문자열이고, `ratio === 1` 이 바로 그 술어다. 즉 1.0 은 **튜닝한 값이 아니라
 *     "축자"라는 계약을 그대로 옮겨 적은 값**이다. 0.8 은 "80%만 축자" 라는 뜻이 되어
 *     계약과 대응하는 의미가 없었다.
 *   정규화(NFC + 전 공백 제거)가 PDF 추출 노이즈를 흡수하므로 1.0 은 도달 가능한 값이다.
 *   과탐의 처분은 `reject`(반려)가 아니라 `queue`(사람 확인)다 — fail-closed 방향이라 안전하다.
 *
 * ★**임계 정당화에 파일럿 표본 분포를 쓰지 않는다** (독립 리뷰 C-2, 2026-08-10).
 *   법령 58장은 2026-07-14 위임 승격분 = **burned 코퍼스**이고, 같은 코퍼스에 대해
 *   "위조 검출력은 원리적으로 측정 불가"라고 이 저장소가 스스로 못박았다.
 *   **검출력을 못 재는 표본으로 검출 임계를 정할 수는 없다.** 그 표본에서 관측된
 *   분포(적중 49건이 전건 1.000 등)는 위 연역의 **부작용 확인**일 뿐 근거가 아니며,
 *   근거로 인용해서는 안 된다. held-out 확보 후의 캘리브레이션 대상은 여전히
 *   `QUOTE_COVERAGE_THRESHOLD`·제외 정규식 5종이다(autoverify plan §8).
 *
 * ★**표적 코퍼스에서의 비용은 미측정이다** (독립 리뷰 M-6).
 *   이 임계의 비용이 낮은 이유는 STAGE 2 인용이 pdfplumber 결정론 추출물이기 때문이다.
 *   AutoVerify 의 실제 표적인 **AI 저작 인용**은 축자 부분문자열일 이유가 없으므로
 *   3-3 전건 실패 → 전건 `queue` 가 될 수 있다(= 검수 병목 해소 목적과 충돌).
 *   그때의 옳은 처분은 **임계를 내리는 것이 아니라** 생성 측에 축자 인용을 강제하는 것이다.
 *
 * ★튜닝 금지: 이 값을 내리면 3-3 은 다시 위조 통과 구간을 연다. 실패가 늘면 임계가 아니라
 *   **인용 또는 주소를 고쳐야 한다**(실패 9건이 실제로 주소 드리프트였던 것처럼).
 */
export const LCS_RATIO_THRESHOLD = 1.0;

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
