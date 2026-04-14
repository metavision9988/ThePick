/**
 * BATCH 1 산식 정의 (F-01 ~ F-13)
 * 적과전 종합위험 — 교재 p.403~434 기준
 *
 * equation_template: math.js AST 파싱 가능 수식 (영문 snake_case 변수)
 * variablesSchema: 각 변수의 타입, 범위, 필수 여부
 * constraints: 추가 입력값 제약
 * resultPrecision: 결과 반올림 소수점 자릿수 (0 = 정수)
 */

import type { FormulaDefinition } from '../types';

export const BATCH1_FORMULAS: readonly FormulaDefinition[] = [
  {
    id: 'F-01',
    name: '유과타박률',
    equationTemplate: 'damaged_fruits / (damaged_fruits + normal_fruits)',
    equationDisplay: '피해유과수합계 ÷ (피해유과수합계 + 정상유과수합계)',
    variablesSchema: [
      {
        name: 'damaged_fruits',
        displayName: '피해유과수합계',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'normal_fruits',
        displayName: '정상유과수합계',
        type: 'integer',
        required: true,
        min: 0,
      },
    ],
    constraints: [
      {
        variable: 'damaged_fruits',
        rule: 'non_negative',
        message: '피해유과수합계는 0 이상이어야 합니다',
      },
    ],
    pageRef: 'p.407',
    versionYear: 2025,
    resultPrecision: 4,
  },
  {
    id: 'F-02',
    name: '낙엽률',
    equationTemplate: 'defoliated / (defoliated + attached)',
    equationDisplay: '낙엽수합계 ÷ (낙엽수합계 + 착엽수합계)',
    variablesSchema: [
      { name: 'defoliated', displayName: '낙엽수합계', type: 'integer', required: true, min: 0 },
      { name: 'attached', displayName: '착엽수합계', type: 'integer', required: true, min: 0 },
    ],
    constraints: [],
    pageRef: 'p.408',
    versionYear: 2025,
    resultPrecision: 4,
  },
  {
    id: 'F-03',
    name: '적정표본주수',
    equationTemplate: 'ceil(total_sample * (variety_target / total_target))',
    equationDisplay: '전체표본주수 × (품종별조사대상주수 ÷ 조사대상주수합) [올림]',
    variablesSchema: [
      {
        name: 'total_sample',
        displayName: '전체표본주수',
        type: 'integer',
        required: true,
        min: 1,
      },
      {
        name: 'variety_target',
        displayName: '품종별조사대상주수',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'total_target',
        displayName: '조사대상주수합',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      {
        variable: 'total_target',
        rule: 'positive',
        message: '조사대상주수합은 0보다 커야 합니다',
      },
    ],
    pageRef: 'p.409',
    versionYear: 2025,
    resultPrecision: 0,
  },
  {
    id: 'F-04',
    name: '품종별 착과수',
    equationTemplate: '(sample_fruits_sum / sample_trees_sum) * target_trees',
    equationDisplay: '(표본주착과수합계 ÷ 표본주합계) × 조사대상주수',
    variablesSchema: [
      {
        name: 'sample_fruits_sum',
        displayName: '표본주착과수합계',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'sample_trees_sum',
        displayName: '표본주합계',
        type: 'integer',
        required: true,
        min: 1,
      },
      {
        name: 'target_trees',
        displayName: '조사대상주수',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      {
        variable: 'sample_trees_sum',
        rule: 'positive',
        message: '표본주합계는 0보다 커야 합니다',
      },
    ],
    pageRef: 'p.411',
    versionYear: 2025,
    resultPrecision: 0,
  },
  {
    id: 'F-05',
    name: '침수주수',
    equationTemplate: 'flooded_trees * (flooded_fruits / total_fruits)',
    equationDisplay: '침수피해나무수 × (침수착과수 ÷ 전체착과수)',
    variablesSchema: [
      {
        name: 'flooded_trees',
        displayName: '침수피해나무수',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'flooded_fruits',
        displayName: '침수착과수',
        type: 'integer',
        required: true,
        min: 0,
      },
      { name: 'total_fruits', displayName: '전체착과수', type: 'integer', required: true, min: 1 },
    ],
    constraints: [
      {
        variable: 'total_fruits',
        rule: 'positive',
        message: '전체착과수는 0보다 커야 합니다',
      },
    ],
    pageRef: 'p.406',
    versionYear: 2025,
    resultPrecision: 0,
  },
  {
    id: 'F-06',
    name: '단감 인정피해율',
    equationTemplate: 'max(1.0115 * defoliation_rate - 0.0014 * elapsed_days, 0)',
    equationDisplay: '1.0115 × 낙엽률 – 0.0014 × 경과일수',
    variablesSchema: [
      { name: 'defoliation_rate', displayName: '낙엽률', type: 'ratio', required: true },
      { name: 'elapsed_days', displayName: '경과일수', type: 'integer', required: true, min: 0 },
    ],
    constraints: [
      {
        variable: 'defoliation_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '낙엽률은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.424',
    versionYear: 2025,
    resultPrecision: 4,
  },
  {
    id: 'F-07',
    name: '떫은감 인정피해율',
    equationTemplate: 'max(0.9662 * defoliation_rate - 0.0703, 0)',
    equationDisplay: '0.9662 × 낙엽률 – 0.0703',
    variablesSchema: [
      { name: 'defoliation_rate', displayName: '낙엽률', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'defoliation_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '낙엽률은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.424',
    versionYear: 2025,
    resultPrecision: 4,
  },
  {
    id: 'F-08',
    name: '착과감소보험금',
    equationTemplate: 'max(fruit_reduction - uncompensated - self_bearing, 0) * price * coverage',
    equationDisplay: 'max(착과감소량 – 미보상감수량 – 자기부담감수량, 0) × 가입가격 × 보장수준',
    variablesSchema: [
      {
        name: 'fruit_reduction',
        displayName: '착과감소량',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'uncompensated',
        displayName: '미보상감수량',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'self_bearing',
        displayName: '자기부담감수량',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'price', displayName: '가입가격', type: 'number', required: true, min: 0 },
      { name: 'coverage', displayName: '보장수준', type: 'ratio', required: true },
    ],
    constraints: [],
    pageRef: 'p.426',
    versionYear: 2025,
    resultPrecision: 0,
  },
  {
    id: 'F-09',
    name: '과실손해보험금',
    equationTemplate: 'max(accumulated_reduction - self_bearing, 0) * price',
    equationDisplay: 'max(적과후누적감수량 – 자기부담감수량, 0) × 가입가격',
    variablesSchema: [
      {
        name: 'accumulated_reduction',
        displayName: '적과후누적감수량',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'self_bearing',
        displayName: '자기부담감수량',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'price', displayName: '가입가격', type: 'number', required: true, min: 0 },
    ],
    constraints: [],
    pageRef: 'p.426',
    versionYear: 2025,
    resultPrecision: 0,
  },
  {
    id: 'F-10',
    name: '나무손해 피해율',
    equationTemplate: 'damaged_trees / actual_bearing_trees',
    equationDisplay: '피해주수(고사나무) ÷ 실제결과주수',
    variablesSchema: [
      {
        name: 'damaged_trees',
        displayName: '피해주수(고사나무)',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'actual_bearing_trees',
        displayName: '실제결과주수',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      {
        variable: 'actual_bearing_trees',
        rule: 'positive',
        message: '실제결과주수는 0보다 커야 합니다',
      },
    ],
    pageRef: 'p.427',
    versionYear: 2025,
    resultPrecision: 4,
  },
  {
    id: 'F-11',
    name: '나무손해보험금',
    equationTemplate: 'insured_amount * max(damage_rate - 0.05, 0)',
    equationDisplay: '보험가입금액 × max(피해율 – 5%, 0)',
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
    pageRef: 'p.427',
    versionYear: 2025,
    resultPrecision: 0,
  },
  {
    id: 'F-12',
    name: '가을동상해 피해인정계수',
    equationTemplate: '0.0031 * remaining_days',
    equationDisplay: '0.0031 × 잔여일수',
    variablesSchema: [
      { name: 'remaining_days', displayName: '잔여일수', type: 'integer', required: true, min: 0 },
    ],
    constraints: [],
    pageRef: 'p.424',
    versionYear: 2025,
    resultPrecision: 4,
  },
  {
    id: 'F-13',
    name: '일소 감수과실수 한도',
    equationTemplate: 'max(sunburn_fruits - fruits_after_thinning * 0.06, 0)',
    equationDisplay: 'max(일소감수과실수 – 적과후착과수 × 6%, 0)',
    variablesSchema: [
      {
        name: 'sunburn_fruits',
        displayName: '일소감수과실수',
        type: 'integer',
        required: true,
        min: 0,
      },
      {
        name: 'fruits_after_thinning',
        displayName: '적과후착과수',
        type: 'integer',
        required: true,
        min: 0,
      },
    ],
    constraints: [],
    pageRef: 'p.424',
    versionYear: 2025,
    resultPrecision: 0,
  },
] as const;
