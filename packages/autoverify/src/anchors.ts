/**
 * 앵커 충분성 — "인용이 그 주장의 값을 증거하는가" (STAGE 3 · 3-4).
 *
 * 이식원: catchall `packages/extraction/src/verify/l3-anchor.ts` (ADAPT — 도메인 필드 교체).
 *
 * 3-1 은 "인용이 원문에 있다"까지만, 3-2 는 "값이 인용에 있다"까지만 본다.
 * 이 검사는 **주장 텍스트의 날짜·수치 토큰이 인용문 안에 실재**해야 한다고 요구한다.
 * 원본 수리 실측(M1): 거주 조건의 기산일 "2015-01-01 이전부터"가 인용 밖이었고,
 * 인용이 조건을 증거하지 못하는데 3-1 은 통과했다 — 날짜가 스왑돼도 잡히지 않는 사각이었다.
 *
 * 실패 처분 = **queue**(인용 확장 요구 — 재추출 또는 사람 확인). LLM 0.
 */

/** 조항 참조(제N조·제N항·제N호…)는 값 앵커가 아니다 — 추출 전 제거(오탐 방지). */
const ARTICLE_REF_RE = /제\s*\d+\s*(?:조(?:의\s*\d+)?|항|호|장|절|편|목)/g;

/** 조항 참조 파편(`8조제`·`1호에`)과 노드 ID(`CONCEPT-137`)도 앵커가 아니다 —
 *  파일럿 과탐 진앙(2026-08-08). `제` 접두가 없는 조각이 남아 수치로 잡혔다. */
const REF_FRAGMENT_RE =
  /\d+\s*(?:조(?:\s*의\s*\d+)?|항|호)\s*(?:제|에|의|을|를|와|과|가|는|,|\.|$)/g;
const NODE_ID_RE = /[A-Z]{2,}-\d+/g;
/** 호 열거 마커('1. 삭제'·'2의2. 「산림조합법」') — 목록 번호이지 값이 아니다. */
const LIST_MARKER_RE = /\d+(?:의\s*\d+)?\s*\.\s(?=[가-힣「])/g;

/** 날짜 토큰 → 정규형 'yyyy-m-d' (2026-08-15 · 2026. 8. 15. · 2026년 8월 15일 전부 같은 키). */
const DATE_RE = /(\d{4})\s*[-.년/]\s*(\d{1,2})\s*[-.월/]\s*(\d{1,2})\s*[.일]?/g;

export interface Anchors {
  readonly dates: ReadonlySet<string>;
  readonly numbers: ReadonlySet<string>;
}

export function anchorsOf(text: string): Anchors {
  const cleaned = text
    .replace(ARTICLE_REF_RE, ' ')
    .replace(REF_FRAGMENT_RE, ' ')
    .replace(NODE_ID_RE, ' ')
    .replace(LIST_MARKER_RE, ' ');
  const dates = new Set<string>();
  for (const m of cleaned.matchAll(DATE_RE)) {
    dates.add(`${m[1]}-${Number(m[2])}-${Number(m[3])}`);
  }
  // 날짜로 소비된 숫자는 수치 앵커에서 제외 (2026·8·15 가 개별 수치로 새는 것 차단)
  const masked = cleaned.replace(DATE_RE, ' ');
  const numbers = new Set<string>();
  for (const m of masked.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?/g)) {
    numbers.add(m[0].replace(/,/g, ''));
  }
  return { dates, numbers };
}

/** 주장 텍스트의 앵커가 전부 인용 안에 실재하는가 — 부재 앵커 목록을 돌려준다. */
export function missingAnchors(claimText: string, quote: string): string[] {
  const need = anchorsOf(claimText);
  const have = anchorsOf(quote);
  const missing: string[] = [];
  for (const d of need.dates) if (!have.dates.has(d)) missing.push(`날짜 ${d}`);
  for (const n of need.numbers) if (!have.numbers.has(n)) missing.push(`수치 ${n}`);
  return missing;
}

/**
 * ★캘리브레이션 표면 등재용 (독립 리뷰 C-2) — 앵커에서 **제외**하는 패턴의 원문.
 * 제외를 넓히면 "주장에 앵커가 없다"가 되어 3-4 가 조용히 통과한다 = 임계와 동등한 자유도.
 */
export const ANCHOR_EXCLUSION_SOURCES: readonly string[] = [
  ARTICLE_REF_RE.source,
  REF_FRAGMENT_RE.source,
  NODE_ID_RE.source,
  LIST_MARKER_RE.source,
];
