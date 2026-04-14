/**
 * BATCH 4 Golden Tests — 밭작물 (p.522~576)
 *
 * 교재 근거:
 *   - p.546: 마늘 조기파종 표준피해율 = (30000-주수)/30000
 *   - p.547: 마늘 재파종 35%, 당근 15%, 가을무/감자 20%
 *   - p.547: 재정식 20% × 면적피해율
 *   - p.570: 고추 준비기생산비계수 54.2%, 표준생장일수 100일(홍)/70일(풋)
 *   - p.571: 브로콜리 준비기생산비계수 67.1%, 표준생장일수 130일
 *   - p.572: 메밀 도복 70% 일괄적용
 *   - p.507: 무화과 9월 경과비율 = (100-33) - 1.13×일자
 */

import { describe, it, expect } from 'vitest';
import { calculate } from '../engine';

describe('BATCH 4 Golden Tests', () => {
  // ── F-39 마늘 재파종보험금 ──

  it('F-39: 보험가입금액 200만, 표준피해율 50% → 200만×35%×50% = 35만', () => {
    const r = calculate('F-39', {
      insured_amount: 2000000,
      standard_damage_rate: 0.5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(350000);
  });

  // ── F-40 마늘 표준피해율 ──

  it('F-40: 식물체주수 20000 → (30000-20000)/30000 = 0.3333', () => {
    const r = calculate('F-40', { plant_count: 20000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.3333, 4);
  });

  it('F-40: 식물체주수 30000 이상 → 0 (피해 없음)', () => {
    const r = calculate('F-40', { plant_count: 35000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-41 재파종보험금(면적형) ──

  it('F-41: 당근 재파종 — 200만×15%×60% = 18만', () => {
    const r = calculate('F-41', {
      insured_amount: 2000000,
      rate: 0.15,
      area_damage_rate: 0.6,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(180000);
  });

  it('F-41: 가을무 재파종 — 200만×20%×40% = 16만', () => {
    const r = calculate('F-41', {
      insured_amount: 2000000,
      rate: 0.2,
      area_damage_rate: 0.4,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(160000);
  });

  // ── F-42 재정식보험금 ──

  it('F-42: 양배추 — 300만×20%×50% = 30만', () => {
    const r = calculate('F-42', {
      insured_amount: 3000000,
      area_damage_rate: 0.5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(300000);
  });

  // ── F-43 수확감소보험금(밭작물) ──

  it('F-43: 보험가입금액 500만, 피해율 40%, 자기부담 20% → 100만', () => {
    const r = calculate('F-43', {
      insured_amount: 5000000,
      damage_rate: 0.4,
      deductible_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1000000);
  });

  // ── F-44 경과비율(수확기 이전) ──

  it('F-44: 고추(홍) — α=0.542, 생장50일, 표준100일 → 0.542+(1-0.542)×0.5 = 0.771', () => {
    const r = calculate('F-44', {
      alpha: 0.542,
      growth_days: 50,
      standard_growth_days: 100,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.771);
  });

  it('F-44: 브로콜리 — α=0.671, 생장65일, 표준130일 → 0.671+(1-0.671)×0.5 = 0.8355', () => {
    const r = calculate('F-44', {
      alpha: 0.671,
      growth_days: 65,
      standard_growth_days: 130,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.8355);
  });

  it('F-44: 생장일수 > 표준 → min(ratio,1) = 1 적용', () => {
    const r = calculate('F-44', {
      alpha: 0.542,
      growth_days: 120,
      standard_growth_days: 100,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1.0);
  });

  // ── F-45 경과비율(수확기 중) ──

  it('F-45: 수확일수 30, 표준수확일수 100 → 1-0.3 = 0.7', () => {
    const r = calculate('F-45', {
      harvest_days: 30,
      standard_harvest_days: 100,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.7);
  });

  it('F-45: 수확일수 초과 → 0 (max 가드)', () => {
    const r = calculate('F-45', {
      harvest_days: 120,
      standard_harvest_days: 100,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-46 고추 피해율 ──

  it('F-46: 면적피해율50%, 평균손해정도50%, 미보상10% → 0.5×0.5×0.9 = 0.225', () => {
    const r = calculate('F-46', {
      area_damage_rate: 0.5,
      avg_loss_ratio: 0.5,
      uncompensated_rate: 0.1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.225);
  });

  // ── F-47 생산비보장보험금 ──

  it('F-47: 면적500㎡, 단가2000, 경과비율0.8, 피해율0.3 → 240000', () => {
    const r = calculate('F-47', {
      cultivated_area: 500,
      unit_cost: 2000,
      elapsed_rate: 0.8,
      damage_rate: 0.3,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(240000);
  });

  // ── F-48 비례보상 ──

  it('F-48: 산출보험금 50만, 가입금액 100만, 단가2000, 면적1000 → 50만×100만/200만 = 25만', () => {
    const r = calculate('F-48', {
      base_insurance: 500000,
      insured_amount: 1000000,
      unit_cost: 2000,
      cultivated_area: 1000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(250000);
  });

  // ── F-49 메밀 피해율 ──

  it('F-49: 면적피해율 60%, 미보상 5% → 0.6×0.95 = 0.57', () => {
    const r = calculate('F-49', {
      area_damage_rate: 0.6,
      uncompensated_rate: 0.05,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.57);
  });

  // ── F-50 메밀 피해면적 ──

  it('F-50: 도복300㎡, 비도복200㎡, 평균손해정도비율 50% → 300×0.7+200×0.5 = 310', () => {
    const r = calculate('F-50', {
      lodging_area: 300,
      non_lodging_area: 200,
      avg_loss_ratio: 0.5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(310);
  });

  // ── F-51 브로콜리 피해율 ──

  it('F-51: 면적피해율 40%, 작물피해율 60%, 미보상 10% → 0.4×0.6×0.9 = 0.216', () => {
    const r = calculate('F-51', {
      area_damage_rate: 0.4,
      crop_damage_rate: 0.6,
      uncompensated_rate: 0.1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.216);
  });

  // ── F-52 고추 생산비보장(병충해) ──

  it('F-52: 잔존300만, 경과0.8, 피해율0.5, 병충해인정0.7, 자기부담20%', () => {
    const r = calculate('F-52', {
      remaining_insured: 3000000,
      elapsed_rate: 0.8,
      damage_rate: 0.5,
      disease_recognition_rate: 0.7,
      deductible_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 3000000×0.8×0.5×0.7 - 3000000×0.2 = 840000 - 600000 = 240000
      expect(r.value).toBe(240000);
    }
  });

  it('F-52: 자기부담금 > 보험금 → 0', () => {
    const r = calculate('F-52', {
      remaining_insured: 3000000,
      elapsed_rate: 0.3,
      damage_rate: 0.2,
      disease_recognition_rate: 0.5,
      deductible_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 3000000×0.3×0.2×0.5 - 3000000×0.2 = 90000 - 600000 = -510000 → 0
      expect(r.value).toBe(0);
    }
  });

  // ── F-53 무화과 잔여수확량비율(9월) ──

  it('F-53: 9월 10일 → (67-11.3)/100 = 0.557', () => {
    const r = calculate('F-53', { day_of_month: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.557);
  });

  it('F-53: 9월 30일 → (67-33.9)/100 = 0.331', () => {
    const r = calculate('F-53', { day_of_month: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.331);
  });
});
