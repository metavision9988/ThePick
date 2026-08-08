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

  it('★10/10 전건 검출 (하나라도 통과하면 미완성)', () => {
    const verdicts = adversarial.map((a) => verifyCard(a.card));
    const passed = verdicts.filter((v) => v.disposition === 'pass');
    expect(passed.map((v) => v.cardId)).toEqual([]);
    expect(verdicts).toHaveLength(10);
  });
});
