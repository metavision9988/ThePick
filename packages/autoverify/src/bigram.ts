/**
 * 문자 바이그램 커버리지 — 인용 진위 검사 (체크리스트 STAGE 3 · 3-1).
 *
 * 이식원: catchall `lib/bigram-coverage.mjs` (ADOPT — 규약·임계·한계 서술 그대로 승계).
 * 원본 위치가 다른 레포이므로 **복사 이식**이며, 그 사실과 원본 경로를 여기 남긴다
 * (역이식 원장 = docs/plans/catchall-역이식-분석-20260806.md §T1-2).
 *
 * 무엇을 판정하는가: 카드에 적힌 `source_quote` 가 **실제 원문에 존재하는 표현인지**를
 * LLM 없이 결정론으로 본다. 지어낸 인용·존재하지 않는 조문을 값싸게 차단한다.
 *
 * 왜 바이그램인가:
 *   · 정확 일치는 공백·조사·PDF 추출 차이에 부서진다.
 *   · 임베딩 유사도는 "그럴듯한 가짜"를 통과시킨다.
 *   · 문자 바이그램 커버리지는 그 사이 — "그 문서에 있던 표현인지"를 본다.
 *
 * ★ 선언된 한계 (원본 5-페르소나 리뷰 2026-07-14 그대로 승계 — 지우지 말 것):
 *   1. **순서 무시 집합 판정**이다. 원문 단어를 재조합한 재배열/속성-스왑 위조는
 *      coverage 1.0 으로 통과한다 → 방어선은 `lcsRatio`(3-3)와 사람 검수뿐이다.
 *      **검수 UI 에서 "3-1 ✅" 를 진위 보증으로 표시하지 말 것.**
 *   2. sourceText 는 **조·항 단위 청크**를 전제한다. 전문을 넣으면 바이그램 풀이 포화해
 *      임계 0.95 의 변별력이 급감한다(catchall W1 실증: 1.2MB 전문에서 접합 인용이 1.0 통과).
 *      ThePick 은 STAGE 2 가 `source_quote` 를 조문 단위로 끊어 저장해 이 함정을 데이터 층에서 막았다.
 *   3. 짧은 인용은 증거 가치가 낮다 — 바이그램 수 < `MIN_QUOTE_BIGRAMS` 는 fail-closed(사람 큐).
 */

/**
 * 정규화 — NFC 통일 + 공백·제로폭 제거 (PDF 추출 텍스트 방어).
 * ★단일 정본: `lcsRatio` 도 이 함수를 써야 한다(복제 금지 — 두 지표가 다른 정규화를 쓰면
 * "바이그램 통과 + LCS 미달" 신호가 정규화 차이인지 위조인지 구분할 수 없다).
 */
export function normalizeForBigrams(s: string): string {
  return String(s)
    .normalize('NFC')
    .replace(/[\s\u200B\u00AD\uFEFF]/g, '');
}

/** 정규화 후 인접 2문자쌍 집합 (코드포인트 단위 — 한글 조합 안전). */
export function bigrams(s: string): Set<string> {
  const t = [...normalizeForBigrams(s)];
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i += 1) set.add(t[i]! + t[i + 1]!);
  return set;
}

/**
 * quote 의 바이그램이 sourceText 에 얼마나 실재하는가 (0~1).
 * quote 가 1자 이하(바이그램 0개)면 판정 불가 → 0 (fail-closed).
 */
export function coverage(quote: string, sourceText: string): number {
  const q = bigrams(quote);
  const s = bigrams(sourceText);
  if (q.size === 0) return 0;
  let hit = 0;
  for (const b of q) if (s.has(b)) hit += 1;
  return hit / q.size;
}

/** 인용의 95% 이상 바이그램이 원문에 존재해야 통과. */
export const QUOTE_COVERAGE_THRESHOLD = 0.95;

/** 인용의 최소 바이그램 수 — 미만이면 증거 가치 부족으로 fail-closed. */
export const MIN_QUOTE_BIGRAMS = 5;

export interface QuoteFaithfulness {
  readonly pass: boolean;
  readonly coverage: number;
  readonly threshold: number;
  readonly reason?: string;
}

/** 3-1 판정. 임계 미달 또는 인용이 너무 짧으면 불통과 → 사람 큐. */
export function checkQuoteFaithfulness(
  quote: string,
  sourceText: string,
  threshold: number = QUOTE_COVERAGE_THRESHOLD,
): QuoteFaithfulness {
  const q = bigrams(quote);
  if (q.size < MIN_QUOTE_BIGRAMS) {
    return {
      pass: false,
      coverage: q.size === 0 ? 0 : coverage(quote, sourceText),
      threshold,
      reason: `인용이 너무 짧다 (${q.size} 바이그램 < ${MIN_QUOTE_BIGRAMS}) — 증거 가치 부족, 사람 큐`,
    };
  }
  const c = coverage(quote, sourceText);
  return { pass: c >= threshold, coverage: c, threshold };
}
