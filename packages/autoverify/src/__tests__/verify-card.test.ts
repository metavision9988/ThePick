/**
 * autoverify 검사기 4종 회귀 + ★적대 10종 (역이식 STAGE 3 · G-S3-1~5).
 *
 * 이 파일의 핵심은 **적대 블록**이다. "돌아간다"는 증거가 아니라 **"일부러 틀린 것을 잡는다"**
 * 는 증거만이 검사기의 존재 이유를 입증한다(체크리스트 3-5 완료 판정: 10/10 검출).
 * 하나라도 통과하면 그 검사는 아직 미완성이라고 체크리스트가 못박고 있다.
 */
import { describe, expect, it } from 'vitest';
import {
  checkQuoteFaithfulness,
  coverage,
  lcsRatio,
  missingAnchors,
  anchorsOf,
  numericTokens,
  valueGrounded,
  stripNonValues,
  verifyCard,
  summarize,
  CALIBRATION_SURFACE,
  surfaceFingerprint,
  surfaceSize,
} from '../index.js';
import { LAW_173_QUOTE, LAW_173_CHUNK } from './fixtures/law-173.js';

/** 실제 법령 조문 (STAGE 2 추출물과 같은 성격 — 조문 단위 청크). */
const SOURCE =
  '제11조(손해평가 등) ① 재해보험사업자는 보험목적물에 관한 지식·경험을 갖춘 사람 또는 그 밖의 ' +
  '관계 전문가를 손해평가인으로 위촉하여 손해평가를 담당하게 하거나 손해평가사 또는 ' +
  '「보험업법」 제186조에 따른 손해사정사에게 손해평가를 담당하게 할 수 있다. ' +
  '② 재해보험사업자는 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록 ' +
  '연 1회 이상 정기교육을 실시하여야 한다.';

describe('G-S3-1 인용 진위 (바이그램 커버리지)', () => {
  it('원문 축자 인용 = 커버리지 1.0 · 통과', () => {
    const quote = '재해보험사업자는 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록';
    const r = checkQuoteFaithfulness(quote, SOURCE);
    expect(r.coverage).toBe(1);
    expect(r.pass).toBe(true);
  });

  it('★지어낸 인용 = 임계 미달 · 불통과(사람 큐)', () => {
    const fake = '재해보험사업자는 손해평가사에게 반드시 손해사정 자격증을 발급하여야 한다.';
    const r = checkQuoteFaithfulness(fake, SOURCE);
    expect(r.pass).toBe(false);
    expect(r.coverage).toBeLessThan(0.95);
  });

  it('★1자 인용 = fail-closed (증거 가치 부족 — 자동 통과 없음)', () => {
    const r = checkQuoteFaithfulness('①', SOURCE);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/너무 짧다/);
  });

  it('공백·제로폭 차이는 판정을 흔들지 않는다 (PDF 추출 내성)', () => {
    const withNoise = '재해보험​사업자는   손해평가인이\n공정하고 객관적인';
    expect(coverage(withNoise, SOURCE)).toBe(1);
  });
});

describe('G-S3-2 수치 정합', () => {
  it('단위별 파싱 — %·일·개월·배·원·ha·kg + 한국어 큰 수', () => {
    const t = numericTokens('자기부담비율 20%, 30일, 12개월, 1.5배, 3만원, 0.8ha, 5,000kg');
    const byUnit = new Map(t.map((x) => [x.unit, x.value]));
    expect(byUnit.get('%')).toBe(20);
    expect(byUnit.get('day')).toBe(30);
    expect(byUnit.get('month')).toBe(12);
    expect(byUnit.get('times')).toBe(1.5);
    expect(byUnit.get('krw')).toBe(30000); // 3만원
    expect(byUnit.get('ha')).toBe(0.8);
    expect(byUnit.get('kg')).toBe(5000);
  });

  it('주장 수치가 인용 안에 있으면 grounded', () => {
    const r = valueGrounded('정기교육은 연 1회 이상 실시한다', SOURCE);
    expect(r.kind).toBe('grounded');
  });

  it('★주장 수치가 인용에 없으면 mismatch = reject', () => {
    const r = valueGrounded('정기교육은 연 3회 이상 실시한다', SOURCE);
    expect(r.kind).toBe('mismatch');
    expect(r.detail).toMatch(/3회|3/);
  });

  it('★단위가 다르면 같은 숫자여도 mismatch (20% ≠ 20일)', () => {
    const r = valueGrounded('자기부담비율은 20%다', '보상 기간은 20일로 한다');
    expect(r.kind).toBe('mismatch');
  });

  it('주장에 수치가 없으면 unparsed = queue (검사할 게 없어서 통과 금지)', () => {
    const r = valueGrounded('손해평가인을 위촉할 수 있다', SOURCE);
    expect(r.kind).toBe('unparsed');
  });
});

/**
 * ★`stripNonValues` 골든 (독립 리뷰 M-1 처분).
 * 이 함수는 파일럿 58장 중 **22장의 판정을 뒤집는데** 테스트가 0건이었고, 무력화해도
 * 전 스위트가 green 이었다(무력화 시 pass 8→17 · reject 11→30). 여기서 각 패턴을 직접 겨눈다.
 */
describe('G-S3-2 stripNonValues — 값이 아닌 숫자 제거 골든', () => {
  const stripped = (s: string): string => stripNonValues(s).replace(/\s+/g, ' ').trim();

  it.each([
    ['호 열거 마커', '1. 삭제 2의2. 「산림조합법」', '삭제 「산림조합법」'],
    ['조항 참조', '제8조 제11조의2 제1항 제3호', ''],
    ['조항 파편', '제8조제2항 제1호에 따른', '에 따른'],
    ['노드 ID', 'CONCEPT-137 INV-087 LAW-001 과 연계', '과 연계'],
    ['날짜(연월일 3표기)', '2014.3.11 / 2014. 3. 11. / 2026년 8월 15일', '/ /'],
  ])('%s 는 제거된다', (_label, input, expected) => {
    expect(stripped(input)).toBe(expected);
  });

  /**
   * ★잔여 갭 — 골든을 쓰다 실측으로 드러난 것. 덮지 않고 **동작을 고정**해 둔다.
   * 둘 다 "숫자가 남는" 방향이 아니라 "글자만 남는" 방향이라 수치 토큰을 만들지 않는다
   * (= 과탐 유발 없음). 정리 가치는 있으나 판정에 영향이 없어 STAGE 4 큐로 둔다.
   */
  it.each([
    ['제(制) 없는 조항 파편은 남는다', '8조 1호에 따른', '8조 따른'],
    ['일(日) 없는 연월은 월 글자가 남는다', '2026년 8월', '월'],
    ['조항 참조 뒤 조사가 남는다', '제8조제2항 제1호에 따른', '에 따른'],
  ])('잔여 갭(문자만 남고 값은 안 만든다): %s', (_label, input, expected) => {
    expect(stripped(input)).toBe(expected);
  });

  /**
   * ★이 골든이 실제로 잡아낸 결함 (2026-08-10) — 회귀 가드.
   * 법령의 `제N조`와 한국어 큰 수 `조`(兆)는 **같은 글자**다. 위 잔여 갭이 남긴 `8조` 가
   * `8 × 10^12` 라는 유령 값을 만들고 있었다. 이 도메인에 조 단위 금액은 사실상 없고
   * 조문 참조는 도처에 있으므로, `조`는 **뒤에 실제 단위가 붙을 때만** 큰 수로 읽는다.
   */
  it('★조문 `조` ↔ 큰 수 `조`(兆) 충돌 — 단위 없는 조는 兆가 아니다', () => {
    expect(numericTokens('8조 따른').map((t) => t.value)).toEqual([8]);
    expect(numericTokens('1조원').map((t) => t.value)).toEqual([1_000_000_000_000]);
    expect(numericTokens('3만원').map((t) => t.value)).toEqual([30_000]);
  });

  it('★도메인 값은 살아남는다 (과잉 제거 방지 — 이게 깨지면 65%→60% 검사가 죽는다)', () => {
    const kept = stripped('자기부담비율 65%, 보상기간 30일, 1.5배, 3만원, 5,000kg');
    for (const v of ['65%', '30일', '1.5배', '3만원', '5,000kg']) expect(kept).toContain(v);
  });

  it('제거 후 토큰화 — 조항 번호는 값으로 잡히지 않는다', () => {
    const t = numericTokens('제11조제2항에 따라 자기부담비율 20%를 적용한다');
    expect(t.map((x) => x.value)).toEqual([20]);
    expect(t[0]!.unit).toBe('%');
  });
});

describe('G-S3-2 단위 파서 — 앵커 정합 (독립 리뷰 M-4)', () => {
  const unitOf = (s: string): string | null => numericTokens(s)[0]?.unit ?? null;

  it('★단위 글자로 시작하는 다른 낱말을 단위로 읽지 않는다', () => {
    // 직전 판본은 부분 일치(`/원/.test('원인을')`)라 아래가 `krw`(=금액)로 읽혔다.
    expect(unitOf('5원인을 분석한다')).not.toBe('krw');
    expect(unitOf('5원인을 분석한다')).toMatch(/^raw:/);
    expect(unitOf('5인 이내로 한다')).toBe('raw:인');
    // `3주 후` 의 '주'(株)는 도메인 단위가 맞다 — 과교정으로 이것까지 죽이면 안 된다
    expect(unitOf('3주 후')).toBe('plant');
  });

  it('단위 뒤 조사는 단위 해석을 바꾸지 않는다', () => {
    expect(unitOf('30일까지')).toBe('day');
    expect(unitOf('1,000원을')).toBe('krw');
    expect(unitOf('12개월간')).toBe('month');
    expect(unitOf('20%를')).toBe('%');
  });

  it('★조사가 겹쳐 붙어도 같은 단위 — 검수가 잡은 회귀 (LAW-201)', () => {
    // 실측: 인용 '매 3년째의 6월 30일까지를' ↔ 주장 '30일까지'. 조사 1개만 허용하면
    // '까지를' 이 미지 단위가 되어 **정상 카드가 reject** 로 튄다.
    expect(unitOf('30일까지를')).toBe('day');
    expect(unitOf('3년째의')).toBe('year');
    expect(valueGrounded('30일까지 검토한다', '매 3년째의 6월 30일까지를 기한으로 한다').kind).toBe(
      'grounded',
    );
  });

  it('긴 별칭이 짧은 별칭보다 먼저 물린다', () => {
    expect(unitOf('12개월')).toBe('month'); // '달' 이 아니라 '개월'
    expect(unitOf('3일간')).toBe('day');
  });

  it('★미지 단위는 null 이 아니라 raw: 키 — fail-open 금지 (ADV-3 회귀 가드)', () => {
    expect(unitOf('5필지')).toMatch(/^raw:/);
    // 단위가 다르면 같은 숫자여도 mismatch 여야 한다
    expect(valueGrounded('5필지', '5원').kind).toBe('mismatch');
  });
});

describe('G-S3-3 짜깁기 탐지 (LCS)', () => {
  it('축자 인용 = LCS 1.0', () => {
    expect(lcsRatio('연 1회 이상 정기교육을 실시하여야 한다', SOURCE)).toBe(1);
  });

  it('★재배열 위조 — 바이그램은 높은데 LCS 는 급락한다', () => {
    // 원문 조각을 뒤섞어 없는 말을 만든다: 단어는 전부 원문 것이라 바이그램이 높다.
    const spliced = '손해사정사는 재해보험사업자에게 정기교육을 실시하여야 한다';
    const cov = coverage(spliced, SOURCE);
    const ratio = lcsRatio(spliced, SOURCE);
    expect(cov).toBeGreaterThan(ratio); // 바이그램이 더 관대하다 = LCS 가 잡는 사각
    expect(ratio).toBeLessThan(0.8);
  });
});

describe('G-S3-4 앵커 충분성', () => {
  it('날짜 표기 3형태가 같은 앵커로 정규화된다', () => {
    for (const s of ['2026-08-15', '2026. 8. 15.', '2026년 8월 15일']) {
      expect(anchorsOf(s).dates.has('2026-8-15')).toBe(true);
    }
  });

  it('★조항 참조(제11조·제186조)는 앵커가 아니다 (오탐 방지)', () => {
    const a = anchorsOf('「보험업법」 제186조에 따른 손해사정사');
    expect(a.numbers.has('186')).toBe(false);
  });

  it('★주장의 날짜가 인용에 없으면 부재 앵커로 보고', () => {
    const missing = missingAnchors('2026년 8월 15일 시행', SOURCE);
    expect(missing).toContain('날짜 2026-8-15');
  });

  it('주장 앵커가 전부 인용에 있으면 부재 0', () => {
    expect(missingAnchors('연 1회 이상', SOURCE)).toEqual([]);
  });
});

describe('verifyCard 종합 판정', () => {
  it('정상 카드 = pass (4검사 전부 통과)', () => {
    const v = verifyCard({
      id: 'LAW-145',
      claim: '재해보험사업자는 연 1회 이상 정기교육을 실시하여야 한다',
      quote:
        '재해보험사업자는 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록 연 1회 이상 정기교육을 실시하여야 한다.',
      sourceText: SOURCE,
    });
    expect(v.disposition).toBe('pass');
  });

  it('★인용 부재 = queue "미검증" (통과로 세지 않는다)', () => {
    const v = verifyCard({ id: 'X', claim: '무언가 20%', quote: null, sourceText: SOURCE });
    expect(v.disposition).toBe('queue');
    expect(v.findings[0]!.evidence).toMatch(/미검증/);
  });

  it('★출처 청크 부재 = 3-1·3-3 판정 불가 queue (fail-closed — 자동 통과 없음)', () => {
    const v = verifyCard({
      id: 'Y',
      claim: '연 1회 이상',
      quote: '연 1회 이상 정기교육을 실시하여야 한다',
      sourceText: null,
    });
    expect(v.disposition).toBe('queue');
    const ids = v.findings.filter((f) => !f.pass).map((f) => f.check);
    expect(ids).toContain('S3-1-quote');
    expect(ids).toContain('S3-3-splice');
  });

  /**
   * ★진앙 분리 (독립 리뷰 M-3 처분) — `reject` 는 "카드가 틀렸다"는 뜻이어야 한다.
   * 값이 출처에는 있는데 인용에만 없으면 틀린 것은 카드가 아니라 **잘린 인용**이다.
   */
  it('★값이 출처에는 있고 인용에만 없으면 reject 가 아니라 queue (인용 보강)', () => {
    const v = verifyCard({
      id: 'TRUNC',
      claim: '연 1회 이상 정기교육을 실시한다',
      quote: '재해보험사업자는 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록', // '1회' 잘림
      sourceText: SOURCE, // 출처에는 '연 1회 이상' 이 있다
    });
    const f = v.findings.find((x) => x.check === 'S3-2-value')!;
    expect(f.pass).toBe(false);
    expect(f.disposition).toBe('queue');
    expect(f.evidence).toMatch(/인용이 짧게 잘린 것/);
    expect(v.disposition).not.toBe('reject');
  });

  it('★값이 출처에도 없으면 그대로 reject (카드 진앙 — 등급 유지)', () => {
    const v = verifyCard({
      id: 'BADCARD',
      claim: '연 7회 이상 정기교육을 실시한다',
      quote: '연 1회 이상 정기교육을 실시하여야 한다',
      sourceText: SOURCE,
    });
    expect(v.findings.find((x) => x.check === 'S3-2-value')!.disposition).toBe('reject');
    expect(v.disposition).toBe('reject');
  });

  it('summarize 가 검사별 실패 건수를 집계한다', () => {
    const s = summarize([
      verifyCard({ id: 'A', claim: '연 1회', quote: '연 1회 이상 정기교육', sourceText: SOURCE }),
      verifyCard({ id: 'B', claim: '연 5회', quote: '연 1회 이상 정기교육', sourceText: SOURCE }),
    ]);
    expect(s.total).toBe(2);
    expect(s.reject).toBe(1); // B = 수치 불일치
    expect(s.byCheck['S3-2-value']).toBe(1);
  });
});

/**
 * ★G-S3-5 적대 10종 — 체크리스트 3-5 완료 판정: **10/10 검출**.
 * "하나라도 통과하면 그 검사는 아직 미완성이다."
 */
describe('★G-S3-5 적대 10종 — 전건 검출', () => {
  const REAL_QUOTE =
    '재해보험사업자는 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록 연 1회 이상 정기교육을 실시하여야 한다.';

  const adversarial: ReadonlyArray<{
    readonly label: string;
    readonly card: Parameters<typeof verifyCard>[0];
  }> = [
    // --- 숫자 바꿔치기 4 (65%→60% 클래스) ---
    {
      label: '①숫자 바꿔치기 — 연 1회 → 연 3회',
      card: { id: 'ADV-1', claim: '연 3회 이상 정기교육', quote: REAL_QUOTE, sourceText: SOURCE },
    },
    {
      label: '②비율 바꿔치기 — 인용에 없는 20%를 주장',
      card: { id: 'ADV-2', claim: '자기부담비율 20%', quote: REAL_QUOTE, sourceText: SOURCE },
    },
    {
      label: '③단위 바꿔치기 — 1회를 1일로',
      card: { id: 'ADV-3', claim: '연 1일 정기교육', quote: REAL_QUOTE, sourceText: SOURCE },
    },
    {
      label: '④날짜 바꿔치기 — 인용에 없는 시행일 주장',
      card: {
        id: 'ADV-4',
        claim: '2026년 8월 15일부터 연 1회 이상',
        quote: REAL_QUOTE,
        sourceText: SOURCE,
      },
    },
    // --- 주체 바꿔치기 2 (인용 자체를 위조) ---
    {
      label: '⑤주체 바꿔치기 — 재해보험사업자 → 농림축산식품부장관',
      card: {
        id: 'ADV-5',
        claim: '연 1회 이상 정기교육',
        quote:
          '농림축산식품부장관은 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록 연 1회 이상 정기교육을 실시하여야 한다.',
        sourceText: SOURCE,
      },
    },
    {
      label: '⑥의무 → 재량 바꿔치기 ("하여야 한다" → "할 수 있다")',
      card: {
        id: 'ADV-6',
        claim: '연 1회 이상 정기교육',
        quote:
          '재해보험사업자는 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록 연 1회 이상 정기교육을 실시하지 아니할 수 있다.',
        sourceText: SOURCE,
      },
    },
    // --- 재배열/짜깁기 2 (바이그램을 통과하는 클래스) ---
    {
      label: '⑦재배열 위조 — 원문 단어만 써서 없는 말 만들기',
      card: {
        id: 'ADV-7',
        claim: '연 1회 이상',
        quote: '손해사정사는 재해보험사업자에게 연 1회 이상 정기교육을 실시하여야 한다',
        sourceText: SOURCE,
      },
    },
    {
      label: '⑧두 조문 접합 — ①항 조각 + ②항 조각 이어 붙이기',
      card: {
        id: 'ADV-8',
        claim: '연 1회 이상',
        quote: '손해평가사에게 손해평가를 담당하게 할 수 있다 연 1회 이상 정기교육을 실시',
        sourceText: SOURCE,
      },
    },
    // --- 인용 절단 2 (증거가 되지 못하는 인용) ---
    {
      label: '⑨인용 절단 — 주장 수치가 잘려 나간 인용',
      card: {
        id: 'ADV-9',
        claim: '연 1회 이상 정기교육',
        quote: '재해보험사업자는 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록',
        sourceText: SOURCE,
      },
    },
    {
      label: '⑩빈 껍데기 인용 — 조 번호만',
      card: { id: 'ADV-10', claim: '연 1회 이상', quote: '제11조', sourceText: SOURCE },
    },
  ];

  it.each(adversarial)('$label → 검출(pass 아님)', ({ card }) => {
    const v = verifyCard(card);
    expect(v.disposition, `${card.id} 이 통과했다 = 검사기 미완성`).not.toBe('pass');
  });

  /**
   * ★독립 리뷰(2026-08-08)가 잡은 것: 위 10종 중 ⑤⑥은 **외래 어휘**를 써서 바이그램이 떨어졌다.
   *   **원문 어휘만으로** 같은 클래스를 만들면 바이그램·LCS 를 둘 다 통과한다 = 당시 엔진의 진짜 한계.
   *   당시 처분은 `it.fails`("지금은 못 잡는다"의 실행 가능한 기록)였다.
   *
   * ★**2026-08-10 해소** — LCS 임계를 0.8 → 1.0(정확 포함)으로 재설계하자 red 로 전환됐다
   *   (`lcs.ts` §임계 재설계). 그래서 `it.fails` 를 **정상 `it` 로 승격**한다.
   *   근거: 축자 인용은 정의상 부분문자열이라 진짜는 1.0 이고, 이 위조들은 어휘를 바꾼 지점에서
   *   연속성이 끊겨 1.0 에 못 미친다. 실 데이터 49/49 가 정확히 1.0 이므로 과탐 비용은 0이었다.
   */
  const hardened: ReadonlyArray<{ label: string; card: Parameters<typeof verifyCard>[0] }> = [
    {
      label: "⑤' 주체 바꿔치기(원문 어휘) — 재해보험사업자 → 손해평가사",
      card: {
        id: 'ADV-5H',
        claim: '연 1회 이상 정기교육',
        quote:
          '손해평가사는 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록 연 1회 이상 정기교육을 실시하여야 한다.',
        sourceText: SOURCE,
      },
    },
    {
      label: "⑥' 의무 → 재량(원문 어휘) — 실시하여야 한다 → 실시할 수 있다",
      card: {
        id: 'ADV-6H',
        claim: '연 1회 이상 정기교육',
        quote:
          '재해보험사업자는 손해평가인이 공정하고 객관적인 손해평가를 수행할 수 있도록 연 1회 이상 정기교육을 실시할 수 있다.',
        sourceText: SOURCE,
      },
    },
  ];

  it.each(hardened)('$label → 검출(pass 아님) ★2026-08-10 임계 재설계로 해소', ({ card }) => {
    expect(verifyCard(card).disposition).not.toBe('pass');
  });

  it('★조문·호 번호 위조는 검출한다 (제3자→제4자 · 제1호→제7호)', () => {
    // 독립 리뷰 실측: `자`·`호` 를 값에서 제외했더니 양쪽에서 함께 삭제돼 비교 자체가 사라졌다.
    // 상위 plan G-AV-NUM 은 조문번호를 값으로 명시한다 — 제외는 그 기결 게이트의 반전이었다.
    const v = verifyCard({
      id: 'ADV-REF',
      claim: '제4자에게 손해평가를 담당하게 할 수 있다',
      quote: '제3자에게 손해평가를 담당하게 할 수 있다',
      sourceText: '제3자에게 손해평가를 담당하게 할 수 있다',
    });
    expect(v.disposition).not.toBe('pass');
  });

  /**
   * ★독립 리뷰 §2 처분 — **실코퍼스 규모** 적대 (2026-08-10 신설).
   *
   * 위 10종은 300자 장난감 `SOURCE` 를 쓴다. 리뷰가 실증한 것: **진짜 청크 규모**(수천 자)에서는
   * 바이그램 풀이 커져 위조 어휘의 바이그램마저 청크 어딘가에 존재하므로 3-1 이 통과하고,
   * LCS 도 구 임계 0.8 을 넘겨 **4검사 전부 통과 → `pass`** 가 됐다. 검사기가 가장 위험한 상태다.
   *
   * 아래 픽스처는 **파이프라인 산출물의 복사본**이다(`./fixtures/law-173.ts`, 손 편집 금지):
   *   · 인용 = LAW-173(요령 제8조) `source_quote` **285자 = 코퍼스 median(235자) 대역**
   *   · 출처 = 같은 노드의 **선언 주소 청크 전체 6,541자**
   *   · 위조 = 주체 1개 치환(`재해보험사업자` → `손해평가사`) — 둘 다 **원문에 실재하는 어휘**
   *
   * ★**정정 (독립 리뷰 M-1, 2026-08-10)**: 직전 판본은 이 청크의 **744자 발췌**를 쓰면서
   *   "실 코퍼스 규모"라고 적었다. 커버리지는 청크가 커질수록 위조에 관대해지므로
   *   발췌(cov .976) → **실 규모(cov 1.0000)** 로 값이 달라진다 = 발췌 픽스처는 3-1 을
   *   **실제보다 유능하게** 보이게 했다. 실 청크로 교체하고 그 서명을 아래에 고정한다.
   *
   * ★인용이 144자 → 285자로 늘어난 것은 같은 날 별건 처분이다(호 열거를 조문 경계로 오인해
   *   본문을 자르던 결함 수리). **인용이 길수록 한 단어 위조는 희석돼 LCS 가 올라간다** —
   *   실제로 0.830 → **0.914** 가 됐고, 구 임계 0.8 에서 더 안전하게 통과했을 것이다.
   */
  const FORGED_173 = LAW_173_QUOTE.replace('재해보험사업자', '손해평가사');

  it('실코퍼스 — 진짜 인용은 cov 1.0 · lcs 1.0 (정확 포함) · pass 유지', () => {
    expect(coverage(LAW_173_QUOTE, LAW_173_CHUNK)).toBe(1);
    expect(lcsRatio(LAW_173_QUOTE, LAW_173_CHUNK)).toBe(1);
  });

  it('★실 규모에서 3-1 은 위조에 만점을 준다 (cov 1.0000) — 3-1 단독은 방어선이 아니다', () => {
    // 이 값이 1 미만으로 바뀌면 픽스처가 축소됐거나 정규화가 바뀐 것이다. 먼저 그쪽을 의심하라.
    expect(coverage(FORGED_173, LAW_173_CHUNK)).toBe(1);
    // 구 임계(lcs .8)도 통과했다 = 이 위조는 08-08 엔진에서 `pass` 였다. 실측 0.914.
    expect(lcsRatio(FORGED_173, LAW_173_CHUNK)).toBeGreaterThan(0.9);
    expect(lcsRatio(FORGED_173, LAW_173_CHUNK)).toBeLessThan(1);
  });

  it('★실코퍼스 주체 위조 → 검출(pass 아님) — 임계 1.0 만이 잡는 구간', () => {
    const v = verifyCard({
      id: 'ADV-REAL-1',
      claim: '손해평가반은 5인 이내로 구성한다',
      quote: FORGED_173,
      sourceText: LAW_173_CHUNK,
    });
    expect(v.disposition, 'ADV-REAL-1 통과 = 실코퍼스에서 위조가 새어 나간다').not.toBe('pass');
    expect(v.findings.find((f) => f.check === 'S3-3-splice')?.pass).toBe(false);
    // ★3-1 은 이 위조를 통과시킨다 — 잡은 것은 3-3 단독이다(위 cov 1.0000 의 귀결).
    expect(v.findings.find((f) => f.check === 'S3-1-quote')?.pass).toBe(true);
  });

  it('★구조: `3-3 통과 ⟹ 3-1 통과` — 3-1 은 독립 축이 아니라 3-3 의 하위다 (M-1b)', () => {
    // lcs===1 ⟺ 인용이 청크의 연속 부분문자열 ⟹ 인용의 모든 바이그램이 청크에 존재 ⟹ cov===1.
    // 임계 1.0 도입의 부작용이며 **원장에 남겨야 할 사실**이다: 4검사는 이제 3축(3-3·3-2·3-4)이다.
    for (const q of [LAW_173_QUOTE, LAW_173_QUOTE.slice(0, 60), LAW_173_QUOTE.slice(20, 90)]) {
      if (lcsRatio(q, LAW_173_CHUNK) === 1) expect(coverage(q, LAW_173_CHUNK)).toBe(1);
    }
  });

  it('★한계: 3-1·3-3 은 **노드 귀속을 증거하지 않는다** (청크가 조문 단위가 아님, M-8)', () => {
    // 청크는 페이지 창(~6천자)이라 이웃 조문이 함께 들어 있다. 다른 조문의 인용을 붙여도 통과한다.
    // ⇒ 검수 UI 에서 "통짜로 존재" 를 "이 노드의 조문에서 왔다" 로 읽으면 안 된다.
    const neighbourQuote = '제7조 삭제';
    const v = verifyCard({
      id: 'ADV-REAL-3',
      claim: '손해평가반은 5인 이내로 구성한다',
      quote: LAW_173_CHUNK.slice(
        LAW_173_CHUNK.indexOf(neighbourQuote),
        LAW_173_CHUNK.indexOf(neighbourQuote) + 120,
      ),
      sourceText: LAW_173_CHUNK,
    });
    // 3-1·3-3 은 통과한다(= 귀속 미검증). 이 카드를 막는 것은 3-2/3-4 층뿐이다.
    expect(v.findings.find((f) => f.check === 'S3-1-quote')?.pass).toBe(true);
    expect(v.findings.find((f) => f.check === 'S3-3-splice')?.pass).toBe(true);
    expect(v.disposition, '이웃 조문 인용이 pass 면 앵커 층까지 무력하다').not.toBe('pass');
  });

  /**
   * ★**생산자-교차 픽스처** (독립 리뷰 Pass 2 반론 처분).
   *
   * 반론 원문: *"STAGE 4 에서 sourceText 생산자가 바뀌는 순간(D1 백필본, 재추출, 푸터 정제,
   * NFD 입력) `lcs ≥ 1.0` 은 정상 카드에게도 깨진다. 그때 파일럿·테스트는 전부 green 이다 —
   * 픽스처가 인용과 **같은 생산자**의 산출물이기 때문이다."*
   *
   * ⇒ 청크를 **다른 생산자처럼** 변형해 임계 1.0 의 내성 경계를 실행으로 고정한다.
   * 견디는 것과 못 견디는 것을 둘 다 못박아 둬야, 나중에 전건 queue 로 퇴화할 때
   * "fail-closed 라 안전"이라는 말로 넘어가지 못한다.
   */
  describe('생산자-교차 내성 — 임계 1.0 이 어디까지 견디는가', () => {
    const verdictOf = (src: string): string =>
      verifyCard({
        id: 'X-PROD',
        claim: '5인 이내',
        quote: LAW_173_QUOTE,
        sourceText: src,
      }).findings.find((f) => f.check === 'S3-3-splice')!.pass
        ? 'pass'
        : 'fail';

    it('✅ 견딘다 — 공백·개행·제로폭 차이 (정규화가 흡수)', () => {
      expect(verdictOf(LAW_173_CHUNK.replace(/\n/g, '  ').replace(/ /g, '​ '))).toBe('pass');
    });

    it('✅ 견딘다 — NFD 분해 입력 (정규화가 NFC 로 통일)', () => {
      expect(verdictOf(LAW_173_CHUNK.normalize('NFD'))).toBe('pass');
    });

    it('✅ 견딘다 — 페이지 푸터 제거 (인용 밖 텍스트 변화)', () => {
      expect(verdictOf(LAW_173_CHUNK.replace(/^\s*-\s*\d+\s*-\s*$/gm, ''))).toBe('pass');
    });

    it('⛔ 못 견딘다 — 인용 **안쪽** 문자 1개 차이 (다른 추출기의 활자 판독 차이)', () => {
      // ㆍ↔· 같은 유사문자 치환은 PDF 추출기마다 갈린다. 임계 1.0 은 이걸 위조와 구분하지 못한다.
      const swapped = LAW_173_CHUNK.replace(
        '손해평가반을 구',
        '손해평가반을 구'.replace('구', '構'),
      );
      expect(verdictOf(swapped)).toBe('fail');
    });

    it('⛔ 못 견딘다 — 인용 구간이 청크에서 빠진 경우 (다른 청킹 경계)', () => {
      expect(verdictOf(LAW_173_CHUNK.replace(LAW_173_QUOTE.slice(0, 80), ''))).toBe('fail');
    });
  });

  it('★실코퍼스 인용 절단 — 주장 수치(5인)가 잘린 인용은 통과하지 못한다', () => {
    const truncated = LAW_173_QUOTE.slice(0, 60); // ①항 머리만 — ②항 '5인 이내' 소실
    const v = verifyCard({
      id: 'ADV-REAL-2',
      claim: '손해평가반은 5인 이내로 구성한다',
      quote: truncated,
      sourceText: LAW_173_CHUNK,
    });
    // 절단 인용은 원문에 실재하므로 3-1·3-3 은 통과한다 — 잡는 것은 3-2/3-4 층이다.
    expect(v.findings.find((f) => f.check === 'S3-3-splice')?.pass).toBe(true);
    expect(v.disposition, '증거가 잘린 인용이 pass 면 앵커 층이 무력하다').not.toBe('pass');
  });

  it('★10/10 전건 검출 (하나라도 통과하면 미완성)', () => {
    const verdicts = adversarial.map((a) => verifyCard(a.card));
    const passed = verdicts.filter((v) => v.disposition === 'pass');
    expect(passed.map((v) => v.cardId)).toEqual([]);
    expect(verdicts).toHaveLength(10);
  });
});

/**
 * ★**캘리브레이션 표면 동결** (독립 리뷰 C-2 처분).
 *
 * 08-08 리뷰가 못박은 것: *"held-out 동결 대상에 **임계 2개뿐 아니라 제외 정규식 5종**을
 * 포함해야 한다 — 제외는 임계와 동등한 자유도다."* 실제로 파일럿 `reject 30→11` 을 만든 것은
 * 임계가 아니라 **제외 규칙 추가**였고, 그건 정확도 개선이 아니라 **판정 포기**였다(판정 가능 47→20).
 *
 * ⇒ 판정을 바꿀 수 있는 손잡이 전체에 지문을 찍고 여기서 고정한다.
 *   손잡이를 하나라도 건드리면 이 테스트가 red 가 되어 **조용한 조정이 불가능**해진다.
 *   바꾸는 것 자체는 금지가 아니다 — 바꾸려면 이 값을 함께 고쳐야 하고 그 diff 가 기록으로 남는다.
 */
describe('★캘리브레이션 표면 동결 (held-out 선결)', () => {
  it('지문이 동결값과 일치한다 — 바뀌었다면 사유를 커밋 메시지에 남길 것', () => {
    expect(surfaceFingerprint()).toBe('9ce278964f08755a');
  });

  it('손잡이 개수 고정 — 등재 없이 새 손잡이를 추가하면 red', () => {
    expect(surfaceSize()).toEqual({ thresholds: 3, exclusionRules: 27 });
  });

  it('임계 3종이 표면에 실제로 등재돼 있다 (문서만 있고 배선 누락인 상태 차단)', () => {
    expect(CALIBRATION_SURFACE.thresholds).toEqual({
      QUOTE_COVERAGE_THRESHOLD: 0.95,
      MIN_QUOTE_BIGRAMS: 5,
      LCS_RATIO_THRESHOLD: 1.0,
    });
  });

  it('★제외 규칙군 5종이 전부 등재 — 임계만 동결하면 동결한 척이 된다', () => {
    expect(Object.keys(CALIBRATION_SURFACE.exclusions).sort()).toEqual([
      'ANCHOR_EXCLUSION',
      'NON_VALUE',
      'SCALE',
      'UNIT_ALIAS',
      'UNIT_SUFFIX',
    ]);
  });

  it('지문이 실제로 민감하다 — 제외 규칙 하나만 바꿔도 값이 달라진다', () => {
    const tampered = {
      thresholds: CALIBRATION_SURFACE.thresholds,
      exclusions: { ...CALIBRATION_SURFACE.exclusions, NON_VALUE: ['\\d+'] },
    };
    expect(surfaceFingerprint(tampered)).not.toBe(surfaceFingerprint());
  });
});
