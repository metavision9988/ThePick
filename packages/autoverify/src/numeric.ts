/**
 * 수치 정합 — "카드의 65%·30일이 그 인용 안에 실재하는가" (STAGE 3 · 3-2).
 *
 * 이식원: catchall `packages/extraction/src/{money.ts,gates/g4-value-groundedness.ts}` (**ADAPT**).
 * ★금액 파서를 그대로 쓰지 않았다 (plan §설계 결정 ③): 이식원은 복지 급여라 단위가 사실상 '원'
 *   하나였고, 손해평가는 **`%`·`일`·`배`·`개월`·`ha`·`kg`** 이 본체다. 단위를 무시하면
 *   "20%" 와 "20일" 이 같은 값으로 취급돼 정합 검사가 무의미해진다.
 *
 * ★이 검사가 막는 것: CLAUDE.md Hard Limit 이 *"65%를 60%로 잘못 입력 = 서비스 사망"* 이라고
 *   못박아 둔 그 위험을, 이 프로젝트에서 **처음으로 기계가** 막는 지점이다.
 *
 * 처분 규약(이식원 계승):
 *   · `grounded` — 값이 인용 안에 실재 → pass
 *   · `mismatch` — 값이 인용에 **없다** → **reject** (그 주장만 반려)
 *   · `unparsed` — 형식을 해석하지 못함 → **queue** (fail-closed, 자동 통과 없음)
 */

/**
 * ★값이 아닌 숫자 — 파싱 전에 제거한다 (파일럿이 잡은 과탐 진앙, 2026-08-08).
 *
 * 초판은 `anchors.ts` 만 조항 참조를 제외하고 여기서는 안 했다. 그 결과 파일럿에서
 * `제8조`·`제1호`의 조각(`8조`·`1호에`)과 노드 ID(`CONCEPT-137`·`INV-087`·`LAW-001`)의
 * 숫자가 "주장 수치"로 잡혀 **58장 중 30장이 reject** 로 튀었다 — 전부 과탐이었다.
 * 조항 번호와 식별자는 **도메인 값이 아니다**(65%·30일 같은 값만 검사 대상).
 */
const NON_VALUE_RE = [
  /\d+(?:의\s*\d+)?\s*\.\s(?=[가-힣「])/g, // 호 열거 마커 ('1. 삭제' · '2의2. 「산림조합법」')
  // ★날짜는 **3-4 앵커 검사 소관**이다. 여기서 날짜를 숫자로 쪼개 비교하면 같은 날짜의
  //   표기 차이('2014.3.11' vs '2014. 3. 11.')가 수치 불일치로 둔갑한다 — 파일럿 실측 진앙.
  /\d{4}\s*[-.년/]\s*\d{1,2}(?:\s*[-.월/]\s*\d{1,2})?\s*[.일]?/g,
  /제\s*\d+\s*(?:조(?:\s*의\s*\d+)?|항|호|장|절|편|목)/g, // 제8조 · 제11조의2 · 제1항
  /\d+\s*(?:조(?:\s*의\s*\d+)?|항|호)\s*(?:제|에|의|을|를|와|과|가|는|,|\.|$)/g, // '8조제' · '1호에' 파편
  /[A-Z]{2,}-\d+/g, // 노드 ID (CONCEPT-137 · INV-087 · LAW-001 · F-01)
];

function stripNonValues(text: string): string {
  let out = text;
  for (const re of NON_VALUE_RE) out = out.replace(re, ' ');
  return out;
}

/** 손해평가 도메인 단위 — 같은 숫자라도 단위가 다르면 다른 값이다. */
const UNIT_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/%|퍼센트|프로/, '%'],
  [/회/, 'count'],
  [/개월|달/, 'month'],
  [/일간|일/, 'day'],
  [/년|연/, 'year'],
  [/시간/, 'hour'],
  [/배/, 'times'],
  [/ha|헥타르/i, 'ha'],
  [/㎡|m2|제곱미터/i, 'm2'],
  [/kg|킬로그램|킬로/i, 'kg'],
  [/톤|t\b/i, 'ton'],
  [/주|株|본/, 'plant'],
  [/원/, 'krw'],
];

/** 한국어 큰 수 단위 (금액·수량 공통). */
const SCALES: ReadonlyArray<readonly [string, number]> = [
  ['조', 1_000_000_000_000],
  ['억', 100_000_000],
  ['만', 10_000],
  ['천', 1_000],
];

export interface NumericToken {
  /** 정규화된 수치 (한국어 큰 수 단위 전개 후). */
  readonly value: number;
  /** 정규화된 단위. 단위가 없으면 `null` — 단위 없는 값끼리만 비교한다. */
  readonly unit: string | null;
  /** 원문 표기 (진단용). */
  readonly raw: string;
}

/**
 * 단위 정규화.
 *
 * ★적대 테스트가 잡은 구멍(ADV-3, 2026-08-08): 초판은 별칭 목록에 없는 꼬리를 전부 `null`
 *   (= 단위 없음)로 돌렸고, `sameToken` 이 "한쪽이 null 이면 값만 비교"라 관대했다.
 *   그 결과 **"연 1회" 를 "연 1일" 로 바꿔치기한 위조가 통과**했다(`회` 가 목록에 없었다).
 *   ⇒ 꼬리 문자열이 **있는데 목록에 없으면 `null` 이 아니라 그 문자열 자체를 단위 키로 쓴다.**
 *   모르는 단위를 "단위 없음"으로 취급하는 것은 fail-open 이고, 별칭 목록은 늘 불완전하다.
 */
function normalizeUnit(tail: string): string | null {
  const t = tail.trim();
  if (t === '') return null;
  for (const [re, canon] of UNIT_ALIASES) {
    if (re.test(t)) return canon;
  }
  return `raw:${t}`;
}

/**
 * 텍스트에서 수치+단위 토큰 전수 추출.
 *
 * 다루는 형태: `65%` · `20 퍼센트` · `1,000원` · `3만원` · `1.5배` · `30일` · `12개월` ·
 * `0.8ha` · `5,000kg` · `2026년`(← 날짜는 anchors.ts 가 담당하므로 여기서도 year 로 잡히되
 * 비교는 단위가 같은 것끼리만 하므로 오탐이 되지 않는다).
 */
export function numericTokens(text: string): NumericToken[] {
  const out: NumericToken[] = [];
  const cleaned = stripNonValues(text);
  // 숫자(+소수/천단위) 다음에 한국어 큰수 단위와 도메인 단위가 붙을 수 있다.
  const re = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*((?:조|억|만|천)?)\s*([a-zA-Z가-힣㎡%]{0,4})/g;
  for (const m of cleaned.matchAll(re)) {
    const digits = Number(m[1]!.replace(/,/g, ''));
    if (!Number.isFinite(digits)) continue;
    const scaleWord = m[2] ?? '';
    const tail = m[3] ?? '';
    const scale = SCALES.find(([w]) => w === scaleWord)?.[1] ?? 1;
    out.push({ value: digits * scale, unit: normalizeUnit(tail), raw: m[0]!.trim() });
  }
  return out;
}

export type GroundednessKind = 'grounded' | 'mismatch' | 'unparsed';

export interface Groundedness {
  readonly kind: GroundednessKind;
  readonly detail: string;
}

/**
 * 같은 값·같은 단위인가.
 * 한쪽이 **정말로 단위 미표기**(빈 꼬리)일 때만 값만 비교한다 — 모르는 단위는 null 이 아니다
 * (위 `normalizeUnit` 주석: 적대 ADV-3 이 이 관대함을 뚫었다).
 */
function sameToken(a: NumericToken, b: NumericToken): boolean {
  if (a.value !== b.value) return false;
  if (a.unit === null || b.unit === null) return true;
  return a.unit === b.unit;
}

/**
 * 주장 텍스트의 수치가 인용 안에 실재하는가.
 *
 * 주장에 수치가 하나도 없으면 이 검사의 대상이 아니다 → `unparsed`(queue).
 * 자동 통과를 만들지 않는 것이 요점 — "검사할 게 없어서 통과"는 이 프로젝트가 두 번 다친 패턴이다.
 */
export function valueGrounded(claimText: string, quote: string): Groundedness {
  const need = numericTokens(claimText);
  if (need.length === 0) {
    return {
      kind: 'unparsed',
      detail: '주장에서 수치 토큰을 찾지 못했다 — 값 정합을 판정할 수 없음(사람 큐)',
    };
  }
  const have = numericTokens(quote);
  if (have.length === 0) {
    return {
      kind: 'mismatch',
      detail: `인용에 수치가 전혀 없다 — 주장 수치 [${need.map((t) => t.raw).join(', ')}] 를 증거하지 못한다`,
    };
  }
  const missing = need.filter((n) => !have.some((h) => sameToken(n, h)));
  if (missing.length === 0) {
    return {
      kind: 'grounded',
      detail: `주장 수치 ${need.length}종 전부 인용 안에 실재 (${need.map((t) => t.raw).join(', ')})`,
    };
  }
  return {
    kind: 'mismatch',
    detail:
      `주장 수치 [${missing.map((t) => t.raw).join(', ')}] 가 인용에 없다 ` +
      `(인용 보유: ${have.map((t) => t.raw).join(', ') || '없음'})`,
  };
}
