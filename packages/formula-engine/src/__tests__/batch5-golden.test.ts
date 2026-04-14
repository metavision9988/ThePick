/**
 * BATCH 5 Golden Tests — 시설작물 + 수입감소 (p.577~647)
 *
 * 교재 근거:
 *   - p.586: 감가상각 — 단동하우스 8%/10년, 연동하우스 5.3%/15년
 *   - p.593: 자기부담금 — 일반 최소30만/최대100만, 피복재단독 최소10만/최대30만
 *   - p.595~596: 시설작물 경과비율 α=40%(일반), 20%(재절화)
 *   - p.597: 장미 나무생존/고사 구분
 *   - p.598: 부추 70% 한도
 *   - p.601~602: 표고버섯 원목/톱밥배지 구분, 톱밥 α=81.4%
 *   - p.507: 무화과 10월 경과비율 = (100-67) - 0.84×일자
 */

import { describe, it, expect } from 'vitest';
import { calculate } from '../engine';

describe('BATCH 5 Golden Tests', () => {
  // ── F-54 시설물 보험금 ──

  it('F-54: 손해액 500만, 자기부담금 30만 → 470만', () => {
    const r = calculate('F-54', { damage_amount: 5000000, deductible: 300000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(4700000);
  });

  it('F-54: 손해액 < 자기부담금 → 0', () => {
    const r = calculate('F-54', { damage_amount: 200000, deductible: 300000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-55 시설물 자기부담금 ──

  it('F-55: 손해액 500만 일반 → max(50만, 30만)=50만, min(50만, 100만)=50만', () => {
    const r = calculate('F-55', {
      damage_amount: 5000000,
      min_deductible: 300000,
      max_deductible: 1000000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(500000);
  });

  it('F-55: 손해액 200만 → max(20만, 30만)=30만 (최소자기부담금)', () => {
    const r = calculate('F-55', {
      damage_amount: 2000000,
      min_deductible: 300000,
      max_deductible: 1000000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(300000);
  });

  it('F-55: 손해액 1500만 → max(150만, 30만)=150만 → min(150만, 100만)=100만 (최대)', () => {
    const r = calculate('F-55', {
      damage_amount: 15000000,
      min_deductible: 300000,
      max_deductible: 1000000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1000000);
  });

  it('F-55: 피복재단독 — 손해액 50만 → max(5만, 10만)=10만', () => {
    const r = calculate('F-55', {
      damage_amount: 500000,
      min_deductible: 100000,
      max_deductible: 300000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(100000);
  });

  // ── F-56 시설작물 생산비보장보험금 ──

  it('F-56: 면적200㎡, 단가3000, 경과0.7, 피해율0.4 → 168000', () => {
    const r = calculate('F-56', {
      cultivated_area: 200,
      unit_cost: 3000,
      elapsed_rate: 0.7,
      damage_rate: 0.4,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(168000);
  });

  // ── F-57 시설작물 경과비율(수확기 이전) ──

  it('F-57: 딸기(α=0.40), 생장45일, 표준90일 → 0.4+(0.6×0.5) = 0.7', () => {
    const r = calculate('F-57', {
      alpha: 0.4,
      growth_days: 45,
      standard_growth_days: 90,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.7);
  });

  it('F-57: 톱밥배지(α=0.814), 생장30일, 표준60일 → 0.814+(0.186×0.5) = 0.907', () => {
    const r = calculate('F-57', {
      alpha: 0.814,
      growth_days: 30,
      standard_growth_days: 60,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.907);
  });

  // ── F-58 시설작물 경과비율(수확기 중) ──

  it('F-58: 딸기 수확일수 60, 표준182일 → 1-60/182 = 0.6703', () => {
    const r = calculate('F-58', {
      harvest_days: 60,
      standard_harvest_days: 182,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.6703, 4);
  });

  // ── F-59 시설작물 피해율 ──

  it('F-59: 피해비율 30%, 손해정도 60%, 미보상 10% → 0.3×0.6×0.9 = 0.162', () => {
    const r = calculate('F-59', {
      damage_area_rate: 0.3,
      loss_degree_rate: 0.6,
      uncompensated_rate: 0.1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.162);
  });

  // ── F-60 장미 생산비보장(나무생존) ──

  it('F-60: 면적100㎡, 단가5000, 피해율0.3 → 150000', () => {
    const r = calculate('F-60', {
      cultivated_area: 100,
      unit_cost_alive: 5000,
      damage_rate: 0.3,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(150000);
  });

  // ── F-61 부추 생산비보장 (70% 한도) ──

  it('F-61: 면적200㎡, 단가2000, 피해율0.5 → 200×2000×0.5×0.7 = 140000', () => {
    const r = calculate('F-61', {
      cultivated_area: 200,
      unit_cost: 2000,
      damage_rate: 0.5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(140000);
  });

  // ── F-62 표고버섯(원목) ──

  it('F-62: 원목1000본, 본당500원, 피해율0.2 → 100000', () => {
    const r = calculate('F-62', {
      log_count: 1000,
      unit_cost_per_log: 500,
      damage_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(100000);
  });

  // ── F-63 표고버섯(톱밥배지) ──

  it('F-63: 배지2000봉, 봉당300원, 경과0.9, 피해율0.3 → 162000', () => {
    const r = calculate('F-63', {
      bag_count: 2000,
      unit_cost_per_bag: 300,
      elapsed_rate: 0.9,
      damage_rate: 0.3,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(162000);
  });

  // ── F-64 단동하우스 감가상각 ──

  it('F-64: 취득가 1000만, 5년 경과 → 1000만×min(0.08×5,1) = 400만', () => {
    const r = calculate('F-64', {
      original_value: 10000000,
      elapsed_years: 5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(4000000);
  });

  it('F-64: 15년 경과(내용연수 초과) → min(1.2, 1)=1 → 전액 감가', () => {
    const r = calculate('F-64', {
      original_value: 10000000,
      elapsed_years: 15,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(10000000);
  });

  // ── F-65 연동하우스 감가상각 ──

  it('F-65: 취득가 2000만, 10년 경과 → 2000만×min(0.053×10,1) = 1060만', () => {
    const r = calculate('F-65', {
      original_value: 20000000,
      elapsed_years: 10,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(10600000);
  });

  // ── F-66 시설물 시가 ──

  it('F-66: 취득가 1000만, 감가 400만 → 600만', () => {
    const r = calculate('F-66', {
      original_value: 10000000,
      depreciation: 4000000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(6000000);
  });

  it('F-66: 감가가 취득가 초과 → 0', () => {
    const r = calculate('F-66', {
      original_value: 5000000,
      depreciation: 6000000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-67 비례보상 보험금 ──

  it('F-67: 손해액500만, 자기부담30만, 가입400만, 가액800만 → 470만×0.5 = 235만', () => {
    const r = calculate('F-67', {
      damage_amount: 5000000,
      deductible: 300000,
      insured_amount: 4000000,
      insured_value: 8000000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(2350000);
  });

  // ── F-68 무화과 잔여수확량비율(10월) ──

  it('F-68: 10월 10일 → (33-8.4)/100 = 0.246', () => {
    const r = calculate('F-68', { day_of_month: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.246);
  });

  it('F-68: 10월 31일 → (33-26.04)/100 = 0.0696', () => {
    const r = calculate('F-68', { day_of_month: 31 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.0696);
  });
});
