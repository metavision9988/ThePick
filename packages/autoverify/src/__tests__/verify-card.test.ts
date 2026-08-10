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
  verifyCard,
  summarize,
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
