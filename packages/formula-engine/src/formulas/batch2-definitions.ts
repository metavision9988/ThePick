/**
 * BATCH 2 산��� 정의 (F-14 ~ F-30)
 * 종합위험 수확감소보장 16종 — 교재 p.435~500 기준
 *
 * 대상품목: 포도, 복숭아, 자두, 감귤(만감류), 밤, 호두, 참다래,
 *           대추, 매실, 살구, 오미자, 유자, 사과, 배, 단감, 떫은감
 *           + 오디, 감귤(온주밀감류), 두릅, 블루베리, 복분자, 무화과
 */

import type { FormulaDefinition } from '../types';

export const BATCH2_FORMULAS: readonly FormulaDefinition[] = [
  // ── 수확감소보험금 기본 패턴 (p.471) ──
  {
    id: 'F-14',
    name: '수확감소보험금(과수)',
    equationTemplate: 'insured_amount * max(damage_rate - deductible_rate, 0)',
    equationDisplay: '보험가입금액 × max(피해율 – 자기부담비율, 0)',
    variablesSchema: [
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'damage_rate', displayName: '피해율', type: 'ratio', required: true },
      { name: 'deductible_rate', displayName: '자기���담비율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '피해율은 0~1 범위여야 합니다',
      },
      {
        variable: 'deductible_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '자기부담비율은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.471',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 피해율(수확감소 기본형) (p.471) ──
  {
    id: 'F-15',
    name: '피해율(수확감소)',
    equationTemplate:
      'max((standard_yield - actual_yield - uncompensated_loss) / standard_yield, 0)',
    equationDisplay: 'max((평년수확량 – 수확량 – 미보상감수량) ÷ 평년수확량, 0)',
    variablesSchema: [
      { name: 'standard_yield', displayName: '평년수확량', type: 'number', required: true, min: 1 },
      { name: 'actual_yield', displayName: '���확량', type: 'number', required: true, min: 0 },
      {
        name: 'uncompensated_loss',
        displayName: '미보���감수량',
        type: 'number',
        required: true,
        min: 0,
      },
    ],
    constraints: [
      { variable: 'standard_yield', rule: 'positive', message: '평년수확량은 0보다 커야 합니다' },
    ],
    pageRef: 'p.471',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 미보상감수량 (p.471) ──
  {
    id: 'F-16',
    name: '미보���감수량',
    equationTemplate: 'max(standard_yield - actual_yield, 0) * uncompensated_rate',
    equationDisplay: 'max(평년수확량 – 수확량, 0) × ���보상비율',
    variablesSchema: [
      { name: 'standard_yield', displayName: '평년��확량', type: 'number', required: true, min: 0 },
      { name: 'actual_yield', displayName: '수확량', type: 'number', required: true, min: 0 },
      { name: 'uncompensated_rate', displayName: '미보상비���', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'uncompensated_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '미보상비율은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.471',
    versionYear: 2025,
    resultPrecision: 2,
  },

  // ── 복숭아 피해율 (p.471) — 병충해감수량 포함 ──
  {
    id: 'F-17',
    name: '복숭아 피해율',
    equationTemplate:
      'max((standard_yield - actual_yield - uncompensated_loss - disease_loss) / standard_yield, 0)',
    equationDisplay: 'max((평년수확량 – 수확량 – 미보상감수량 – 병충해감수���) ÷ 평년수확량, 0)',
    variablesSchema: [
      { name: 'standard_yield', displayName: '평년수확량', type: 'number', required: true, min: 1 },
      { name: 'actual_yield', displayName: '수확량', type: 'number', required: true, min: 0 },
      {
        name: 'uncompensated_loss',
        displayName: '미보상감수량',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'disease_loss', displayName: '병충해감수량', type: 'number', required: true, min: 0 },
    ],
    constraints: [
      { variable: 'standard_yield', rule: 'positive', message: '평년수확량은 0보다 커야 합니다' },
    ],
    // 병충해감수량 = 병충해 피해 과실 무게 × 0.5 (50%형 인정, p.471)
    pageRef: 'p.471',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 수확량감소 추가보장 특약 보험금 (p.472) ──
  {
    id: 'F-18',
    name: '수확량감소 추가보장 보험금',
    equationTemplate: 'insured_amount * damage_rate * 0.10',
    equationDisplay: '보험가입금액 × 피해율 × 10%',
    variablesSchema: [
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'damage_rate', displayName: '피해율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '피해율은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.472',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 비가림시설보험금 (p.472) ──
  {
    id: 'F-19',
    name: '비가림시설��험금',
    equationTemplate: 'min(max(damage_amount - deductible, 0), insured_amount)',
    equationDisplay: 'min(max(손해액 – 자기부담금, 0), 보험가입금액)',
    variablesSchema: [
      { name: 'damage_amount', displayName: '손해액', type: 'number', required: true, min: 0 },
      { name: 'deductible', displayName: '자기��담금', type: 'number', required: true, min: 0 },
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
    ],
    constraints: [],
    pageRef: 'p.472',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 감귤(온주밀감류) 등급별 피해과실수 (p.488) ──
  {
    id: 'F-20',
    name: '감귤 등급별 피해과실수',
    equationTemplate: 'count_30 * 0.3 + count_50 * 0.5 + count_80 * 0.8 + count_100 * 1.0',
    equationDisplay: '30%형×0.3 + 50%형×0.5 + 80%형×0.8 + 100%형×1.0',
    variablesSchema: [
      {
        name: 'count_30',
        displayName: '30%형 피해과실수',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'count_50',
        displayName: '50%형 피��과실수',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'count_80',
        displayName: '80%형 피해과실수',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'count_100',
        displayName: '100%형 피해과실��',
        type: 'integer',
        required: true,
        min: 0,
      },
    ],
    constraints: [],
    // 피해인정계수: 정상=0, 30%형=0.3, 50%형=0.5, 80%형=0.8, 100%형=1 (p.489)
    pageRef: 'p.488',
    versionYear: 2025,
    resultPrecision: 1,
  },

  // ── 감귤 총 피해과실수 (p.488) — 등급내 + 등급외×0.5 ──
  {
    id: 'F-21',
    name: '감귤 총 피해과실수',
    equationTemplate: 'grade_in_damaged + grade_out_damaged * 0.5',
    equationDisplay: '등급내 피해과실수 + (등급외 피해과실수 × 50%)',
    variablesSchema: [
      {
        name: 'grade_in_damaged',
        displayName: '등급내 피해과실수',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'grade_out_damaged',
        displayName: '등급외 피해과실수',
        type: 'number',
        required: true,
        min: 0,
      },
    ],
    constraints: [],
    pageRef: 'p.488',
    versionYear: 2025,
    resultPrecision: 1,
  },

  // ── 감귤(온주밀감류) 피해율 (p.488) ──
  {
    id: 'F-22',
    name: '감귤 피해율',
    equationTemplate: '(damaged_fruit_count / base_fruit_count) * (1 - uncompensated_rate)',
    equationDisplay: '(피해과실수 ÷ 기준과실수) × (1 – 미���상비율)',
    variablesSchema: [
      {
        name: 'damaged_fruit_count',
        displayName: '피해과실수',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'base_fruit_count',
        displayName: '기준과실수',
        type: 'integer',
        required: true,
        min: 1,
      },
      { name: 'uncompensated_rate', displayName: '미보상비율', type: 'ratio', required: true },
    ],
    constraints: [
      { variable: 'base_fruit_count', rule: 'positive', message: '기준과실수는 0보다 커야 합니다' },
      {
        variable: 'uncompensated_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '미보상비율은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.488',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 동상해 피해율 (p.491) ──
  {
    id: 'F-23',
    name: '동상해 피해율',
    equationTemplate: '(frost_80_count * 0.8 + frost_100_count * 1.0) / base_fruit_count',
    equationDisplay: '(동상해80%형×0.8 + 동상해100%형×1.0) ÷ 기준��실수',
    variablesSchema: [
      {
        name: 'frost_80_count',
        displayName: '동상해 80%형 과실수',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'frost_100_count',
        displayName: '동상해 100%형 ���실수',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'base_fruit_count',
        displayName: '기준과실수',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      { variable: 'base_fruit_count', rule: 'positive', message: '기준과실수는 0보다 커야 ��니다' },
    ],
    pageRef: 'p.491',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 수확기 잔존비율 — 12월 (p.491) ──
  {
    id: 'F-24',
    name: '잔존비율(12월)',
    equationTemplate: 'max((61 - 0.935 * day_of_month) / 100, 0)',
    equationDisplay: 'max((100–39) – 0.935×사고발생일자, 0) / 100',
    variablesSchema: [
      {
        name: 'day_of_month',
        displayName: '사고발생일자(일)',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      {
        variable: 'day_of_month',
        rule: 'range',
        min: 1,
        max: 31,
        message: '일자는 1~31 범위여야 합니다',
      },
    ],
    // 교재 p.491 잔존비율: 12월 (100-39) - (0.935×사고발생일자)
    pageRef: 'p.491',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ��─ 수확기 잔존비율 — 1월 (p.491) ──
  {
    id: 'F-25',
    name: '잔존비율(1월)',
    equationTemplate: 'max((32 - 0.774 * day_of_month) / 100, 0)',
    equationDisplay: 'max((100–68) – 0.774×사고발생일자, 0) / 100',
    variablesSchema: [
      {
        name: 'day_of_month',
        displayName: '사고발생일자(일)',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      {
        variable: 'day_of_month',
        rule: 'range',
        min: 1,
        max: 31,
        message: '일자는 1~31 범위여야 ���니다',
      },
    ],
    pageRef: 'p.491',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 수확기 잔존비율 — 2월 (p.491) ──
  {
    id: 'F-26',
    name: '잔��비율(2월)',
    equationTemplate: 'max((8 - 0.286 * day_of_month) / 100, 0)',
    equationDisplay: 'max((100–92) – 0.286×사고발생일자, 0) / 100',
    variablesSchema: [
      {
        name: 'day_of_month',
        displayName: '사고발생일자(일)',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      {
        variable: 'day_of_month',
        rule: 'range',
        min: 1,
        max: 29,
        message: '일자는 1~29 범위여야 합니다',
      },
    ],
    pageRef: 'p.491',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 두릅 피해율 (p.489) ���─
  {
    id: 'F-27',
    name: '두릅 피해율',
    equationTemplate: '(damaged_buds / total_buds) * (1 - uncompensated_rate)',
    equationDisplay: '(피해 정아지수 ÷ 총 정아지수) × (1 �� 미보상비율)',
    variablesSchema: [
      {
        name: 'damaged_buds',
        displayName: '피해 정아지수',
        type: 'integer',
        required: true,
        min: 0,
      },
      { name: 'total_buds', displayName: '�� 정아지수', type: 'integer', required: true, min: 1 },
      { name: 'uncompensated_rate', displayName: '미보상���율', type: 'ratio', required: true },
    ],
    constraints: [
      { variable: 'total_buds', rule: 'positive', message: '총 정아���수는 0보��� 커야 합니다' },
      {
        variable: 'uncompensated_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '미보상비율은 0~1 범위여�� 합니다',
      },
    ],
    pageRef: 'p.489',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 블루베리 잔여수확량비율 (p.490) ─���
  {
    id: 'F-28',
    name: '블루베리 잔여수확량���율',
    equationTemplate: 'max(1 - (days_since_harvest / standard_harvest_days), 0)',
    equationDisplay: 'max(1 – (사고일자–수확개시일자) ÷ 표준수확일수, 0)',
    variablesSchema: [
      {
        name: 'days_since_harvest',
        displayName: '수확개시후 경과일수',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'standard_harvest_days',
        displayName: '표준수���일수',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      {
        variable: 'standard_harvest_days',
        rule: 'positive',
        message: '표준수확일수는 0보다 커야 합니다',
      },
    ],
    // 표준수확일수 = 30일 (p.490)
    pageRef: 'p.490',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 블루베리 최종 꽃 고사율 (p.490) ──
  {
    id: 'F-29',
    name: '블루베리 최종 꽃 고사율',
    equationTemplate: 'bud_death_rate + (1 - bud_death_rate) * flower_death_rate',
    equationDisplay: '꽃눈 고사율 + (1 – ���눈 고사율) × 꽃 고��율',
    variablesSchema: [
      { name: 'bud_death_rate', displayName: '꽃눈 고사율', type: 'ratio', required: true },
      { name: 'flower_death_rate', displayName: '꽃 고사율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'bud_death_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '꽃눈 고사율은 0~1 범위여야 합니다',
      },
      {
        variable: 'flower_death_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '꽃 고사율은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.490',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 무화과 경과비율 — 8월 (p.507) ──
  {
    id: 'F-30',
    name: '무화과 잔여수확량비율(8월)',
    equationTemplate: 'max((100 - 1.06 * day_of_month) / 100, 0)',
    equationDisplay: 'max(100 – 1.06×사고발생일자, 0) / 100',
    variablesSchema: [
      {
        name: 'day_of_month',
        displayName: '사고발생일자(일)',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      {
        variable: 'day_of_month',
        rule: 'range',
        min: 1,
        max: 31,
        message: '일자는 1~31 범위여야 합니다',
      },
    ],
    // 교재 p.507: 무화과 8월 경과비율 = 100 – 1.06 × 사고발생일자
    pageRef: 'p.507',
    versionYear: 2025,
    resultPrecision: 4,
  },
] as const;
