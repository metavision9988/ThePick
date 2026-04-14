/**
 * BATCH 5 산식 정의 (F-54 ~ F-68)
 * 시설작물 + 수입감소 — 교재 p.577~647 기준
 *
 * 대상: 원예시설(농업용 시설물+부대시설+시설작물), 버섯재배사,
 *       인삼(해가림시설 포함)
 */

import type { FormulaDefinition } from '../types';

export const BATCH5_FORMULAS: readonly FormulaDefinition[] = [
  // ── 시설물 손해액 (p.586, 592) ──
  {
    id: 'F-54',
    name: '시설물 보험금',
    equationTemplate: 'max(damage_amount - deductible, 0)',
    equationDisplay: 'max(손해액 – 자기부담금, 0)',
    variablesSchema: [
      { name: 'damage_amount', displayName: '손해액', type: 'number', required: true, min: 0 },
      { name: 'deductible', displayName: '자기부담금', type: 'number', required: true, min: 0 },
    ],
    constraints: [],
    pageRef: 'p.592',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 시설물 자기부담금 (p.593) ──
  {
    id: 'F-55',
    name: '시설물 자기부담금',
    equationTemplate: 'min(max(damage_amount * 0.10, min_deductible), max_deductible)',
    equationDisplay: 'min(max(손해액×10%, 최소자기부담금), 최대자기부담금)',
    variablesSchema: [
      { name: 'damage_amount', displayName: '손해액', type: 'number', required: true, min: 0 },
      {
        name: 'min_deductible',
        displayName: '최소자기부담금',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'max_deductible',
        displayName: '최대자기부담금',
        type: 'number',
        required: true,
        min: 0,
      },
    ],
    constraints: [
      {
        variable: 'min_deductible',
        rule: 'non_negative',
        message: '최소자기부담금은 0 이상이어야 합니다',
      },
      {
        variable: 'max_deductible',
        rule: 'non_negative',
        message: '최대자기부담금은 0 이상이어야 합니다',
      },
      // TODO: 교차검증 필요 — min_deductible <= max_deductible (현재 constraint 타입 미지원)
    ],
    // 일반: 최소30만, 최대100만. 피복재단독: 최소10만, 최대30만 (p.593)
    // 호출자는 반드시 min_deductible <= max_deductible을 보장해야 한다.
    pageRef: 'p.593',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 시설작물 생산비보장보험금 (p.595) ──
  // NOTE: F-47(밭작물 생산비보장, p.595)과 동일 산식. F-47 변경 시 함께 확인.
  {
    id: 'F-56',
    name: '시설작물 생산비보장보험금',
    equationTemplate: 'cultivated_area * unit_cost * elapsed_rate * damage_rate',
    equationDisplay: '재배면적 × 단위면적당보장생산비 × 경과비율 × 피해율',
    variablesSchema: [
      { name: 'cultivated_area', displayName: '재배면적', type: 'number', required: true, min: 0 },
      {
        name: 'unit_cost',
        displayName: '단위면적당보장생산비',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'elapsed_rate', displayName: '경과비율', type: 'ratio', required: true },
      { name: 'damage_rate', displayName: '피해율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'elapsed_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '경과비율은 0~1 범위여야 합니다',
      },
      {
        variable: 'damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '피해율은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.595',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 시설작물 경과비율(수확기 이전) (p.595~596) ──
  // NOTE: F-44(고추/브로콜리, p.570)와 동일 산식 구조. α값만 품목별로 다르다.
  // F-44 변경 시 이 산식도 반드시 확인할 것.
  {
    id: 'F-57',
    name: '시설작물 경과비율(수확기 이전)',
    equationTemplate: 'alpha + (1 - alpha) * min(growth_days / standard_growth_days, 1)',
    equationDisplay: 'α + (1–α) × min(생장일수÷표준생장일수, 1)',
    variablesSchema: [
      { name: 'alpha', displayName: '준비기생산비계수', type: 'ratio', required: true },
      { name: 'growth_days', displayName: '생장일수', type: 'integer', required: true, min: 0 },
      {
        name: 'standard_growth_days',
        displayName: '표준생장일수',
        type: 'integer',
        required: true,
        min: 1,
      },
    ],
    constraints: [
      {
        variable: 'alpha',
        rule: 'range',
        min: 0,
        max: 1,
        message: '준비기생산비계수는 0~1 범위여야 합니다',
      },
      {
        variable: 'standard_growth_days',
        rule: 'positive',
        message: '표준생장일수는 0보다 커야 합니다',
      },
    ],
    // α: 40% (일반), 20% (국화/백합/카네이션 재절화), 81.4% (표고버섯 톱밥배지) (p.595~602)
    pageRef: 'p.596',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 시설작물 경과비율(수확기 중) (p.596) ──
  // NOTE: F-45(고추/브로콜리, p.570)와 동일 산식 구조. F-45 변경 시 함께 확인.
  {
    id: 'F-58',
    name: '시설작물 경과비율(수확기 중)',
    equationTemplate: 'max(1 - harvest_days / standard_harvest_days, 0)',
    equationDisplay: 'max(1 – 수확일수÷표준수확일수, 0)',
    variablesSchema: [
      { name: 'harvest_days', displayName: '수확일수', type: 'integer', required: true, min: 0 },
      {
        name: 'standard_harvest_days',
        displayName: '표준수확일수',
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
    pageRef: 'p.596',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 시설작물 피해율 (p.596) ──
  {
    id: 'F-59',
    name: '시설작물 피해율',
    equationTemplate: 'damage_area_rate * loss_degree_rate * (1 - uncompensated_rate)',
    equationDisplay: '피해비율 × 손해정도비율 × (1–미보상비율)',
    variablesSchema: [
      { name: 'damage_area_rate', displayName: '피해비율', type: 'ratio', required: true },
      { name: 'loss_degree_rate', displayName: '손해정도비율', type: 'ratio', required: true },
      { name: 'uncompensated_rate', displayName: '미보상비율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'damage_area_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '피해비율은 0~1 범위여야 합니다',
      },
      {
        variable: 'loss_degree_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '손해정도비율은 0~1 범위여야 합니다',
      },
      {
        variable: 'uncompensated_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '미보상비율은 0~1 범위여야 합니다',
      },
    ],
    // 피해비율 = 피해면적(주수) / 재배면적(주수) (p.596)
    pageRef: 'p.596',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 장미 생산비보장보험금(나무생존시) (p.597) ──
  {
    id: 'F-60',
    name: '장미 생산비보장보험금(나무생존)',
    equationTemplate: 'cultivated_area * unit_cost_alive * damage_rate',
    equationDisplay: '재배면적 × 나무생존시보장생산비 × 피해율',
    variablesSchema: [
      { name: 'cultivated_area', displayName: '재배면적', type: 'number', required: true, min: 0 },
      {
        name: 'unit_cost_alive',
        displayName: '나무생존시보장생산비',
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
    pageRef: 'p.597',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 부추 생산비보장보험금 (p.598) — 70% 한도 ──
  {
    id: 'F-61',
    name: '부추 생산비보장보험금',
    equationTemplate: 'cultivated_area * unit_cost * damage_rate * 0.70',
    equationDisplay: '재배면적 × 단위면적당보장생산비 × 피해율 × 70%',
    variablesSchema: [
      { name: 'cultivated_area', displayName: '재배면적', type: 'number', required: true, min: 0 },
      {
        name: 'unit_cost',
        displayName: '단위면적당보장생산비',
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
    // 부추: 보험가입금액의 70% 한도 (p.598)
    pageRef: 'p.598',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 표고버섯(원목) 생산비보장보험금 (p.601) ──
  {
    id: 'F-62',
    name: '표고버섯(원목) 생산비보장보험금',
    equationTemplate: 'log_count * unit_cost_per_log * damage_rate',
    equationDisplay: '재배원목수 × 원목당보장생산비 × 피해율',
    variablesSchema: [
      { name: 'log_count', displayName: '재배원목수', type: 'integer', required: true, min: 0 },
      {
        name: 'unit_cost_per_log',
        displayName: '원목당보장생산비',
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
    pageRef: 'p.601',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 표고버섯(톱밥배지) 생산비보장보험금 (p.602) ──
  {
    id: 'F-63',
    name: '표고버섯(톱밥배지) 생산비보장보험금',
    equationTemplate: 'bag_count * unit_cost_per_bag * elapsed_rate * damage_rate',
    equationDisplay: '재배배지수 × 배지당보장생산비 × 경과비율 × 피해율',
    variablesSchema: [
      { name: 'bag_count', displayName: '재배배지수', type: 'integer', required: true, min: 0 },
      {
        name: 'unit_cost_per_bag',
        displayName: '배지당보장생산비',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'elapsed_rate', displayName: '경과비율', type: 'ratio', required: true },
      { name: 'damage_rate', displayName: '피해율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'elapsed_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '경과비율은 0~1 범위여야 합니다',
      },
      {
        variable: 'damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '피해율은 0~1 범위여야 합니다',
      },
    ],
    // 준비기생산비계수 α = 81.4% (p.602)
    pageRef: 'p.602',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 시설물 감가상각 — 고정식 하우스 구조체 (p.586) ──
  {
    id: 'F-64',
    name: '시설물 감가상각액(단동하우스)',
    equationTemplate: 'original_value * min(0.08 * elapsed_years, 1)',
    equationDisplay: '취득가액 × min(경년감가율8%×경과년수, 1)',
    variablesSchema: [
      { name: 'original_value', displayName: '취득가액', type: 'number', required: true, min: 0 },
      { name: 'elapsed_years', displayName: '경과년수', type: 'number', required: true, min: 0 },
    ],
    constraints: [],
    // 단동하우스: 내용연수 10년, 경년감가율 8% (p.586)
    pageRef: 'p.586',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 시설물 감가상각 — 연동하우스 구조체 (p.586) ──
  {
    id: 'F-65',
    name: '시설물 감가상각액(연동하우스)',
    equationTemplate: 'original_value * min(0.053 * elapsed_years, 1)',
    equationDisplay: '취득가액 × min(경년감가율5.3%×경과년수, 1)',
    variablesSchema: [
      { name: 'original_value', displayName: '취득가액', type: 'number', required: true, min: 0 },
      { name: 'elapsed_years', displayName: '경과년수', type: 'number', required: true, min: 0 },
    ],
    constraints: [],
    // 연동하우스: 내용연수 15년, 경년감가율 5.3% (p.586)
    pageRef: 'p.586',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 시설물 시가(감가 후) (p.586) ──
  {
    id: 'F-66',
    name: '시설물 시가',
    equationTemplate: 'max(original_value - depreciation, 0)',
    equationDisplay: 'max(취득가액 – 감가상각액, 0)',
    variablesSchema: [
      { name: 'original_value', displayName: '취득가액', type: 'number', required: true, min: 0 },
      { name: 'depreciation', displayName: '감가상각액', type: 'number', required: true, min: 0 },
    ],
    constraints: [],
    pageRef: 'p.586',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 비례보상 보험금 (p.582) — 보험가입금액 < 보험가액 ──
  {
    id: 'F-67',
    name: '비례보상 보험금',
    equationTemplate: 'max(damage_amount - deductible, 0) * (insured_amount / insured_value)',
    equationDisplay: 'max(손해액–자기부담금, 0) × (보험가입금액÷보험가액)',
    variablesSchema: [
      { name: 'damage_amount', displayName: '손해액', type: 'number', required: true, min: 0 },
      { name: 'deductible', displayName: '자기부담금', type: 'number', required: true, min: 0 },
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'insured_value', displayName: '보험가액', type: 'number', required: true, min: 1 },
    ],
    constraints: [
      { variable: 'insured_value', rule: 'positive', message: '보험가액은 0보다 커야 합니다' },
    ],
    pageRef: 'p.582',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 무화과 잔여수확량비율(10월) (p.507) ──
  {
    id: 'F-68',
    name: '무화과 잔여수확량비율(10월)',
    equationTemplate: 'max((33 - 0.84 * day_of_month) / 100, 0)',
    equationDisplay: 'max((100–67) – 0.84×사고발생일자, 0) / 100',
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
    // 교재 p.507: 무화과 10월 = (100-67) - 0.84 × 사고발생일자
    pageRef: 'p.507',
    versionYear: 2025,
    resultPrecision: 4,
  },
] as const;
