/**
 * BATCH 4 산식 정의 (F-39 ~ F-53)
 * 밭작물 손해평가 — 교재 p.522~576 기준
 *
 * 대상: 종합위험 수확감소 + 생산비보장 밭작물
 * 품목: 고구마, 옥수수, 콩, 양배추, 양파, 마늘, 차, 감자, 팥,
 *       수박, 단호박, 참깨, 당근, 녹두, 생강, 가을무, 가을배추,
 *       고추, 브로콜리, 메밀 등
 */

import type { FormulaDefinition } from '../types';

export const BATCH4_FORMULAS: readonly FormulaDefinition[] = [
  // ── 마늘 재파종 보험금 (p.547) ──
  {
    id: 'F-39',
    name: '마늘 재파종보험금',
    equationTemplate: 'insured_amount * 0.35 * standard_damage_rate',
    equationDisplay: '보험가입금액 × 35% × 표준피해율',
    variablesSchema: [
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'standard_damage_rate', displayName: '표준피해율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'standard_damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '표준피해율은 0~1 범위여야 합니다',
      },
    ],
    // 표���피해율(10a기준) = (30000 - 식물체주수) / 30000 (p.547)
    pageRef: 'p.547',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 마늘 표준피해율 (p.547) ──
  {
    id: 'F-40',
    name: '마늘 표준피해율',
    equationTemplate: 'max((30000 - plant_count) / 30000, 0)',
    equationDisplay: 'max((30,000 – 식물체주수) ÷ 30,000, 0)',
    variablesSchema: [
      {
        name: 'plant_count',
        displayName: '식물체주수(10a당)',
        type: 'integer',
        required: true,
        min: 0,
      },
    ],
    constraints: [],
    // 10a당 30,000주 기준 (p.546~547)
    pageRef: 'p.547',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 당근/가을무/감자 재파종 보험금 (p.547) ──
  {
    id: 'F-41',
    name: '재파종보험금(면적형)',
    equationTemplate: 'insured_amount * rate * area_damage_rate',
    equationDisplay: '보험가입금액 × 지급비율 × 면적피해율',
    variablesSchema: [
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'rate', displayName: '지급비율', type: 'ratio', required: true },
      { name: 'area_damage_rate', displayName: '면적피해율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '지급비율은 0~1 범위여야 합니다',
      },
      {
        variable: 'area_damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '면적피해율은 0~1 범위여야 합니다',
      },
    ],
    // 당근: 15%, 가을무/감자(가을재배): 20% (p.547)
    pageRef: 'p.547',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 재정식보험금 (p.547) ──
  {
    id: 'F-42',
    name: '재정식보험금',
    equationTemplate: 'insured_amount * 0.20 * area_damage_rate',
    equationDisplay: '보험가입금액 × 20% × 면적피해율',
    variablesSchema: [
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'area_damage_rate', displayName: '면적피해율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'area_damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '면적피해율은 0~1 범위여야 합니다',
      },
    ],
    // 대상: 가을양배추, 월동양배추, 단호박, 가을배추, 양파 (p.547)
    pageRef: 'p.547',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 수확감소보험금(밭작물) (p.549) ──
  {
    id: 'F-43',
    name: '수확감소보험금(밭작물)',
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
      { name: 'deductible_rate', displayName: '자기부담비율', type: 'ratio', required: true },
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
    pageRef: 'p.549',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 생산비보장보험금(고추) — 수확기 이전 경과비율 (p.569~570) ──
  // NOTE: F-57(시설작물, p.596)과 동일 산식 구조. F-57 변경 시 함께 확인.
  {
    id: 'F-44',
    name: '경과비율(수확기 이전)',
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
    // 고추: α=54.2%, 표준생장일수=100일(홍)/70일(풋) (p.570)
    // 브로콜리: α=67.1%, 표준생장일수=130일 (p.571)
    // 시설작물: α=40% (일반), 20% (국화/백합/카네이션 재절화) (p.595~596)
    pageRef: 'p.570',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 경과비율(수확기 중) (p.570) ──
  // NOTE: F-58(시설작물, p.596)과 동일 산식 구조. F-58 변경 시 함께 확인.
  {
    id: 'F-45',
    name: '경과비율(수확기 중)',
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
    pageRef: 'p.570',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 고추 피해율 (p.570) ──
  {
    id: 'F-46',
    name: '고추 피해율',
    equationTemplate: 'area_damage_rate * avg_loss_ratio * (1 - uncompensated_rate)',
    equationDisplay: '면적피해율 × 평균손해정도비율 × (1–미보상비율)',
    variablesSchema: [
      { name: 'area_damage_rate', displayName: '면적피해율', type: 'ratio', required: true },
      { name: 'avg_loss_ratio', displayName: '평균손해정도비율', type: 'ratio', required: true },
      { name: 'uncompensated_rate', displayName: '미보상비율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'area_damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '면적피해율은 0~1 범위여야 합니다',
      },
      {
        variable: 'avg_loss_ratio',
        rule: 'range',
        min: 0,
        max: 1,
        message: '평균손해정도비율은 0~1 범위여야 합니다',
      },
      {
        variable: 'uncompensated_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '미보상비율은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.570',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 생산비보장보험금 (일반형) (p.569, p.595) ──
  // NOTE: F-56(시설작물 생산비보장, p.595)과 동일 산식. F-56 변경 시 함께 확인.
  {
    id: 'F-47',
    name: '생산비보장보��금',
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

  // ── 생산비보장보험금 비례보상 (p.596~597) ──
  {
    id: 'F-48',
    name: '생산비보장보험금 비례보상',
    equationTemplate: 'base_insurance * insured_amount / (unit_cost * cultivated_area)',
    equationDisplay: '생산비보장보험금 × 보험가입금액 ÷ (단위면적당보장생산비 × 재배면적)',
    variablesSchema: [
      {
        name: 'base_insurance',
        displayName: '산출생산비보장보험금',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'unit_cost',
        displayName: '단위면적당보장생산비',
        type: 'number',
        required: true,
        min: 1,
      },
      { name: 'cultivated_area', displayName: '재배면적', type: 'number', required: true, min: 1 },
    ],
    constraints: [
      { variable: 'cultivated_area', rule: 'positive', message: '재배면적은 0보다 커야 합니다' },
      {
        variable: 'unit_cost',
        rule: 'positive',
        message: '단위면적당보장생산비는 0보다 커야 합니다',
      },
    ],
    // 재배면적×단위면적당보장생산비 > 보험가입금액인 경우 비례보상
    pageRef: 'p.597',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 메밀 피해율 (p.572) ──
  {
    id: 'F-49',
    name: '메밀 피해율',
    equationTemplate: 'area_damage_rate * (1 - uncompensated_rate)',
    equationDisplay: '면적피해율 × (1–미보상비율)',
    variablesSchema: [
      { name: 'area_damage_rate', displayName: '면적피해율', type: 'ratio', required: true },
      { name: 'uncompensated_rate', displayName: '미보상비율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'area_damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '면적피해율은 0~1 범위여야 합니다',
      },
      {
        variable: 'uncompensated_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '미보상비율은 0~1 범위여야 합니다',
      },
    ],
    // 면적피해율 = (도복면적×70% + 도복이외면적×평균손해정도비율) / 재배면적 (p.572)
    pageRef: 'p.572',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 메밀 피해면적 산정 (p.572) ──
  {
    id: 'F-50',
    name: '메밀 피해면적',
    equationTemplate: 'lodging_area * 0.70 + non_lodging_area * avg_loss_ratio',
    equationDisplay: '도복면적×70% + 도복이외면적×평균손해정도비율',
    variablesSchema: [
      { name: 'lodging_area', displayName: '도복면적', type: 'number', required: true, min: 0 },
      {
        name: 'non_lodging_area',
        displayName: '도복이외 피해면적',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'avg_loss_ratio', displayName: '평균손해정도비율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'avg_loss_ratio',
        rule: 'range',
        min: 0,
        max: 1,
        message: '평균손해정도비율은 0~1 범위여야 합니다',
      },
    ],
    // 도복 일괄 70% 적용 (p.564)
    pageRef: 'p.572',
    versionYear: 2025,
    resultPrecision: 2,
  },

  // ── 브로콜리 피해율 (p.571) ──
  {
    id: 'F-51',
    name: '브로콜리 피해율',
    equationTemplate: 'area_damage_rate * crop_damage_rate * (1 - uncompensated_rate)',
    equationDisplay: '면적피해율 × 작물피해율 × (1–미보상비율)',
    variablesSchema: [
      { name: 'area_damage_rate', displayName: '면적피해율', type: 'ratio', required: true },
      { name: 'crop_damage_rate', displayName: '작물피해율', type: 'ratio', required: true },
      { name: 'uncompensated_rate', displayName: '미보상비율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'area_damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '면적피해율은 0~1 범위여야 합니다',
      },
      {
        variable: 'crop_damage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '작물피해율은 0~1 범위여야 합니다',
      },
      {
        variable: 'uncompensated_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '미보상비율은 0~1 범위여야 합니다',
      },
    ],
    // 작물피해율 = 피해송이수 / 총송이수, 피해인정계수: 50%형=0.5, 80%형=0.8, 100%형=1 (p.564, 571)
    pageRef: 'p.571',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 고추 생산비보장보���금(병충해) (p.569) ──
  {
    id: 'F-52',
    name: '고추 생산비보장보험금(병충해)',
    equationTemplate:
      'max(remaining_insured * elapsed_rate * damage_rate * disease_recognition_rate - remaining_insured * deductible_rate, 0)',
    equationDisplay:
      'max(잔존보험가입금액×경과비율×피해율×병충해인정비율 – 잔존보험가입금액×자기부담비율, 0)',
    variablesSchema: [
      {
        name: 'remaining_insured',
        displayName: '잔존보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'elapsed_rate', displayName: '경과비율', type: 'ratio', required: true },
      { name: 'damage_rate', displayName: '피해율', type: 'ratio', required: true },
      {
        name: 'disease_recognition_rate',
        displayName: '병충해인정비율',
        type: 'ratio',
        required: true,
      },
      { name: 'deductible_rate', displayName: '자기부담비율', type: 'ratio', required: true },
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
      {
        variable: 'disease_recognition_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '병충해인정비율은 0~1 범위여야 합니다',
      },
      {
        variable: 'deductible_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '자기부담비율은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.569',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 무화과 잔여수확량비율(9월) (p.507) ──
  {
    id: 'F-53',
    name: '무화과 잔여수확량비율(9월)',
    equationTemplate: 'max((67 - 1.13 * day_of_month) / 100, 0)',
    equationDisplay: 'max((100–33) – 1.13×사고발생일자, 0) / 100',
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
        max: 30,
        message: '일자는 1~30 범위여야 합니다',
      },
    ],
    // 교재 p.507: 무화과 9월 = (100-33) - 1.13 × 사고발생일자
    pageRef: 'p.507',
    versionYear: 2025,
    resultPrecision: 4,
  },
] as const;
