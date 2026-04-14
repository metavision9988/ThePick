import { describe, it, expect } from 'vitest';
import {
  enrichConstants,
  parseNumericValue,
  extractUnit,
  tagConfusionLevels,
} from '../constants-extractor';
import type { KnowledgeContractConstant } from '../schema-validator';

// --- parseNumericValue ---

describe('parseNumericValue', () => {
  it('parses integer', () => {
    expect(parseNumericValue('65')).toBe(65);
  });

  it('parses decimal', () => {
    expect(parseNumericValue('1.0115')).toBe(1.0115);
    expect(parseNumericValue('0.20')).toBe(0.2);
  });

  it('parses percentage string', () => {
    expect(parseNumericValue('65%')).toBe(65);
    expect(parseNumericValue('0.20%')).toBe(0.2);
  });

  it('parses with unit suffix', () => {
    expect(parseNumericValue('30일')).toBe(30);
    expect(parseNumericValue('1000원')).toBe(1000);
    expect(parseNumericValue('1.5배')).toBe(1.5);
  });

  it('parses negative numbers', () => {
    expect(parseNumericValue('-5')).toBe(-5);
    expect(parseNumericValue('-0.3')).toBe(-0.3);
  });

  it('parses fractions', () => {
    expect(parseNumericValue('1/3')).toBeCloseTo(0.3333, 3);
    expect(parseNumericValue('2/5')).toBe(0.4);
  });

  it('returns null for non-numeric', () => {
    expect(parseNumericValue('사과')).toBeNull();
    expect(parseNumericValue('')).toBeNull();
    expect(parseNumericValue('N/A')).toBeNull();
  });

  it('handles leading dot', () => {
    expect(parseNumericValue('.5')).toBe(0.5);
  });

  it('returns null for date category', () => {
    expect(parseNumericValue('2024년 10월 1일', 'date')).toBeNull();
  });

  it('returns null for date-like patterns regardless of category', () => {
    expect(parseNumericValue('2024년 3월 15일')).toBeNull();
  });

  it('returns null for 0 denominator fraction', () => {
    expect(parseNumericValue('5/0')).toBeNull();
    expect(parseNumericValue('0/0')).toBeNull();
  });
});

// --- extractUnit ---

describe('extractUnit', () => {
  it('extracts % unit', () => {
    expect(extractUnit('65%')).toBe('%');
  });

  it('extracts 배수', () => {
    expect(extractUnit('1.0115배수')).toBe('배수');
  });

  it('extracts 배', () => {
    expect(extractUnit('1.5배')).toBe('배');
  });

  it('extracts 원', () => {
    expect(extractUnit('1000원')).toBe('원');
  });

  it('extracts 만원', () => {
    expect(extractUnit('500만원')).toBe('만원');
  });

  it('extracts 일', () => {
    expect(extractUnit('30일')).toBe('일');
  });

  it('extracts 개월', () => {
    expect(extractUnit('6개월')).toBe('개월');
  });

  it('extracts kg', () => {
    expect(extractUnit('50kg')).toBe('kg');
  });

  it('returns null for no unit', () => {
    expect(extractUnit('0.20')).toBeNull();
    expect(extractUnit('65')).toBeNull();
  });
});

// --- tagConfusionLevels ---

describe('tagConfusionLevels', () => {
  it('tags danger for values within 10% in same category', () => {
    const constants = [
      { numeric_value: 65, category: 'threshold', name: '경작불능' },
      { numeric_value: 60, category: 'threshold', name: '분질미' },
    ];
    const tags = tagConfusionLevels(constants);

    // 65 vs 60: diff = 5/65 = 7.7% → danger
    expect(tags[0].confusion_level).toBe('danger');
    expect(tags[0].confusion_risk).toContain('분질미');
    expect(tags[1].confusion_level).toBe('danger');
    expect(tags[1].confusion_risk).toContain('경작불능');
  });

  it('tags warn for values within 30% in same category', () => {
    const constants = [
      { numeric_value: 1.0115, category: 'coefficient', name: '단감' },
      { numeric_value: 0.75, category: 'coefficient', name: '다른계수' },
    ];
    const tags = tagConfusionLevels(constants);

    // 1.0115 vs 0.75: diff = 0.2615/1.0115 = 25.9% → warn
    expect(tags[0].confusion_level).toBe('warn');
  });

  it('tags safe for distant values', () => {
    const constants = [
      { numeric_value: 100, category: 'threshold', name: 'A' },
      { numeric_value: 10, category: 'threshold', name: 'B' },
    ];
    const tags = tagConfusionLevels(constants);

    // 100 vs 10: diff = 90/100 = 90% → safe
    expect(tags[0].confusion_level).toBe('safe');
    expect(tags[1].confusion_level).toBe('safe');
  });

  it('tags safe for non-numeric values', () => {
    const constants = [{ numeric_value: null, category: 'date', name: '기준일' }];
    const tags = tagConfusionLevels(constants);
    expect(tags[0].confusion_level).toBe('safe');
    expect(tags[0].confusion_risk).toBeNull();
  });

  it('ignores cross-category comparisons', () => {
    const constants = [
      { numeric_value: 65, category: 'threshold', name: 'A' },
      { numeric_value: 60, category: 'coefficient', name: 'B' }, // different category
    ];
    const tags = tagConfusionLevels(constants);

    // 다른 카테고리이므로 비교 안 함 → safe
    expect(tags[0].confusion_level).toBe('safe');
    expect(tags[1].confusion_level).toBe('safe');
  });

  it('handles single constant', () => {
    const constants = [{ numeric_value: 50, category: 'threshold', name: 'solo' }];
    const tags = tagConfusionLevels(constants);
    expect(tags[0].confusion_level).toBe('safe');
  });

  it('handles identical values as danger', () => {
    const constants = [
      { numeric_value: 0.2, category: 'deductible', name: 'A형' },
      { numeric_value: 0.2, category: 'deductible', name: 'B형' },
    ];
    const tags = tagConfusionLevels(constants);
    expect(tags[0].confusion_level).toBe('danger');
    expect(tags[1].confusion_level).toBe('danger');
  });
});

// --- enrichConstants (integration) ---

describe('enrichConstants', () => {
  function makeConstant(
    overrides: Partial<KnowledgeContractConstant> = {},
  ): KnowledgeContractConstant {
    return {
      id: 'CONST-001',
      name: '자기부담비율',
      value: '20%',
      category: 'deductible',
      ...overrides,
    };
  }

  it('enriches constants with numeric_value, unit, confusion_level', () => {
    const result = enrichConstants([
      makeConstant({
        id: 'CONST-001',
        name: '자기부담비율(20%)',
        value: '20%',
        category: 'deductible',
      }),
      makeConstant({
        id: 'CONST-002',
        name: '자기부담비율(30%)',
        value: '30%',
        category: 'deductible',
      }),
    ]);

    expect(result.constants).toHaveLength(2);
    expect(result.constants[0].numeric_value).toBe(20);
    expect(result.constants[0].unit).toBe('%');
    expect(result.constants[1].numeric_value).toBe(30);

    // 20 vs 30: diff = 10/30 = 33% → safe (just over 30%)
    // Actually 10/30 = 33.3%, so safe
    expect(result.stats.total).toBe(2);
    expect(result.stats.numericParsed).toBe(2);
  });

  it('handles BATCH 1 realistic data', () => {
    const result = enrichConstants([
      makeConstant({
        id: 'CONST-001',
        name: '경작불능피해율',
        value: '65%',
        category: 'threshold',
      }),
      makeConstant({ id: 'CONST-002', name: '분질미피해율', value: '60%', category: 'threshold' }),
      makeConstant({
        id: 'CONST-003',
        name: '단감보정계수',
        value: '1.0115배수',
        category: 'coefficient',
      }),
      makeConstant({
        id: 'CONST-004',
        name: '떫은감보정계수',
        value: '0.9662배수',
        category: 'coefficient',
      }),
    ]);

    expect(result.constants).toHaveLength(4);

    // 65 vs 60: diff = 5/65 = 7.7% → danger
    const const1 = result.constants[0];
    expect(const1.confusion_level).toBe('danger');
    expect(const1.confusion_risk).toContain('분질미');

    // 1.0115 vs 0.9662: diff = 0.0453/1.0115 = 4.5% → danger
    const const3 = result.constants[2];
    expect(const3.confusion_level).toBe('danger');
    expect(const3.confusion_risk).toContain('떫은감');

    expect(result.stats.danger).toBe(4); // all 4 are danger pairs
  });

  it('returns null numeric_value for date category', () => {
    const result = enrichConstants([
      makeConstant({ id: 'CONST-001', name: '기준일', value: '2024년 10월 1일', category: 'date' }),
    ]);

    expect(result.constants[0].numeric_value).toBeNull();
    expect(result.constants[0].confusion_level).toBe('safe');
  });

  it('handles non-string value gracefully', () => {
    const result = enrichConstants([
      { id: 'CONST-001', name: 'bad', value: null as unknown as string, category: 'threshold' },
    ]);

    expect(result.constants[0].numeric_value).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('not a string');
  });

  it('returns empty result for empty input', () => {
    const result = enrichConstants([]);
    expect(result.constants).toHaveLength(0);
    expect(result.stats.total).toBe(0);
  });

  it('preserves original value field unchanged', () => {
    const result = enrichConstants([makeConstant({ value: '  65%  ' })]);

    // value 원본 보존
    expect(result.constants[0].value).toBe('  65%  ');
    // numeric_value는 파싱 결과
    expect(result.constants[0].numeric_value).toBe(65);
  });
});
