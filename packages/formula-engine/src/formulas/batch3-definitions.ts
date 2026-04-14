/**
 * BATCH 3 산식 정의 (F-31 ~ F-38)
 * 논작물(벼, 맥류) + 공용 산식 — 교재 p.501~521 + 밭작물/인삼 공용 p.550, p.580
 *
 * 대상품목: 벼, 조사료용 벼, 밀, 보리, 귀리
 *
 * NOTE: F-36(감자, p.550), F-37(옥수수, p.550), F-38(인삼, p.580)은
 * BATCH-3 페이지 범위(p.501~521)를 벗어나지만, 여러 배치에서 공유하는
 * 범용 산식이므로 이 파일에서 정의한다. 배치별 QG 검증 시 이 산식들은
 * BATCH-3 소속이 아닌 공용으로 취급해야 한다.
 */

import type { FormulaDefinition } from '../types';

export const BATCH3_FORMULAS: readonly FormulaDefinition[] = [
  // ── 이앙·직파불능 보험금 (p.524) ──
  {
    id: 'F-31',
    name: '이앙·직파불능 보험금',
    equationTemplate: 'insured_amount * 0.15',
    equationDisplay: '보험가입금액 × 15%',
    variablesSchema: [
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
    ],
    constraints: [],
    pageRef: 'p.524',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 재이앙·재직파 보험금 (p.525) ──
  {
    id: 'F-32',
    name: '재이앙·재직파 보험금',
    equationTemplate: 'insured_amount * 0.25 * area_damage_rate',
    equationDisplay: '보험가입금액 × 25% × 면적피해율',
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
    // 면적피해율 = 피해면적 ÷ 보험가입면적, 10% 초과 시에만 지급
    pageRef: 'p.525',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 면적피해율 (p.525) ──
  {
    id: 'F-33',
    name: '면적피해율',
    equationTemplate: 'damaged_area / insured_area',
    equationDisplay: '피해면적 ÷ 보험가입면적',
    variablesSchema: [
      { name: 'damaged_area', displayName: '피해면적', type: 'number', required: true, min: 0 },
      { name: 'insured_area', displayName: '보험가입면적', type: 'number', required: true, min: 1 },
    ],
    constraints: [
      { variable: 'insured_area', rule: 'positive', message: '보험가입면적은 0보다 커야 합니다' },
    ],
    pageRef: 'p.525',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 수확감소보험금(논작물) (p.527) ──
  {
    id: 'F-34',
    name: '수확감소보험금(논작물)',
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
    pageRef: 'p.527',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 조사료용 벼 경작불능보험금 (p.525) ──
  {
    id: 'F-35',
    name: '조사료용 벼 경작불능보험금',
    equationTemplate: 'insured_amount * coverage_rate * elapsed_rate',
    equationDisplay: '보험가입금액 × 보장비율 × 경과비율',
    variablesSchema: [
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'coverage_rate', displayName: '보장비율', type: 'ratio', required: true },
      { name: 'elapsed_rate', displayName: '경과비율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'coverage_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '보장비율은 0~1 범위여야 합니다',
      },
      {
        variable: 'elapsed_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '경과비율은 0~1 범위여야 합니다',
      },
    ],
    // 경과비율: 5월=80%, 6월=85%, 7월=90%, 8월=100%
    pageRef: 'p.525',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 사료용 옥수수 경작불능보험금 (p.548) — 밭작물이지만 논작물과 동일 구조 ──
  // (BATCH 4에서 다시 정의하지 않고 여기서 범용으로 사용)

  // ── 감자 피해율 (p.550) — 병충해감수량 가산형 ──
  {
    id: 'F-36',
    name: '감자 피해율',
    equationTemplate:
      'min(max(((standard_yield - actual_yield - uncompensated_loss) + disease_loss) / standard_yield, 0), 1)',
    equationDisplay:
      'min(max(((평년수확량 – 수확량 – 미보상감수량) + 병충해감수량) ÷ 평년수확량, 0), 1)',
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
    // 감자 피해율은 (수확감소량 + 병충해감수량) / 평년수확량 (p.550)
    pageRef: 'p.550',
    versionYear: 2025,
    resultPrecision: 4,
  },

  // ── 옥수수 수확감소보험금 (p.550) — MIN(보험가입금액, 손해액) - 자기부담금 ──
  {
    id: 'F-37',
    name: '옥수수 수확감소보험금',
    equationTemplate:
      'max(min(insured_amount, damage_yield * price) - insured_amount * deductible_rate, 0)',
    equationDisplay: 'max(min(보험가입금액, 피해수확량×가입가격) – 보험가입금액×자기부담비율, 0)',
    variablesSchema: [
      {
        name: 'insured_amount',
        displayName: '보험가입금액',
        type: 'number',
        required: true,
        min: 0,
      },
      { name: 'damage_yield', displayName: '피해수확량', type: 'number', required: true, min: 0 },
      { name: 'price', displayName: '가입가격', type: 'number', required: true, min: 0 },
      { name: 'deductible_rate', displayName: '자기부담비율', type: 'ratio', required: true },
    ],
    constraints: [
      {
        variable: 'deductible_rate',
        rule: 'range',
        min: 0,
        max: 1,
        message: '자기부담비율은 0~1 범위여야 합니다',
      },
    ],
    pageRef: 'p.550',
    versionYear: 2025,
    resultPrecision: 0,
  },

  // ── 인삼 피해율 (p.580) ──
  {
    id: 'F-38',
    name: '인삼 피해율',
    equationTemplate:
      'max((1 - actual_yield / standard_yield) * (damaged_area / cultivated_area), 0)',
    equationDisplay: 'max((1 – 수확량/연근별기준수확량) × (피해면적/재배면적), 0)',
    variablesSchema: [
      { name: 'actual_yield', displayName: '수확량', type: 'number', required: true, min: 0 },
      // min 미지정: 연근별기준수확량은 0.50~0.81 kg/m² 범위 (p.581). positive constraint로 0 차단.
      { name: 'standard_yield', displayName: '연근별기준수확량', type: 'number', required: true },
      { name: 'damaged_area', displayName: '피해면적', type: 'number', required: true, min: 0 },
      { name: 'cultivated_area', displayName: '재배면적', type: 'number', required: true, min: 1 },
    ],
    constraints: [
      { variable: 'standard_yield', rule: 'positive', message: '기준수확량은 0보다 커야 합니다' },
      { variable: 'cultivated_area', rule: 'positive', message: '재배면적은 0보다 커야 합니다' },
    ],
    // 연근별기준수확량: 2년근 0.50~0.55, 3년근 0.64~0.70, 4년근 0.71~0.78, 5년근 0.73~0.81 (kg/m2)
    pageRef: 'p.580',
    versionYear: 2025,
    resultPrecision: 4,
  },
] as const;
