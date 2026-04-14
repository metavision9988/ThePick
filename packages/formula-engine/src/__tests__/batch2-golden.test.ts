/**
 * BATCH 2 Golden Tests — 종합위험 수확감소 16종 (p.435~500)
 *
 * 교재 예시값 + 수학적 정확도 검증
 * 모든 계수는 교재 원문 대조 완료:
 *   - p.471: 수확감소보험금 = 보험가입금액 × (피해율 – 자기부담비율)
 *   - p.471: 피해율 = (평년수확량 - 수확량 - 미보상감수량) / 평년수확량
 *   - p.488: 감귤 피해인정계수 0.3/0.5/0.8/1.0
 *   - p.491: 잔존비율 계수 (12월: 0.935, 1월: 0.774, 2월: 0.286)
 *   - p.490: 블루베리 표준수확일수 30일
 *   - p.507: 무화과 8월 경과비율 계수 1.06
 */

import { describe, it, expect } from 'vitest';
import { calculate } from '../engine';

describe('BATCH 2 Golden Tests', () => {
  // ── F-14 수확감소보험금(과수) ──

  it('F-14: 보험가입금액 1000만, 피해율 30%, 자기부담 20% → 100만', () => {
    const r = calculate('F-14', {
      insured_amount: 10000000,
      damage_rate: 0.3,
      deductible_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1000000);
  });

  it('F-14: 피해율이 자기부담비율 이하 → 0', () => {
    const r = calculate('F-14', {
      insured_amount: 10000000,
      damage_rate: 0.15,
      deductible_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-15 피해율(수확감소) ──

  it('F-15: 평년1000, 수확700, 미보상50 → (1000-700-50)/1000 = 0.25', () => {
    const r = calculate('F-15', {
      standard_yield: 1000,
      actual_yield: 700,
      uncompensated_loss: 50,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.25);
  });

  it('F-15: 수확량이 평년 초과 → 0 (음수 방지)', () => {
    const r = calculate('F-15', {
      standard_yield: 1000,
      actual_yield: 1100,
      uncompensated_loss: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-16 미보상감수량 ──

  it('F-16: 평년1000, 수확700, 미보상비율10% → 30', () => {
    const r = calculate('F-16', {
      standard_yield: 1000,
      actual_yield: 700,
      uncompensated_rate: 0.1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(30);
  });

  it('F-16: 수확량이 평년 이상 → 0 (max 가드)', () => {
    const r = calculate('F-16', {
      standard_yield: 1000,
      actual_yield: 1000,
      uncompensated_rate: 0.1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-17 복숭아 피해율 ──

  it('F-17: 평년1000, 수확600, 미보상30, 병충해20 → 0.35', () => {
    const r = calculate('F-17', {
      standard_yield: 1000,
      actual_yield: 600,
      uncompensated_loss: 30,
      disease_loss: 20,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.35);
  });

  // ── F-18 추가보장 보험금 ──

  it('F-18: 보험가입금액 1000만, 피해율 30% → 30만', () => {
    const r = calculate('F-18', {
      insured_amount: 10000000,
      damage_rate: 0.3,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(300000);
  });

  // ── F-19 비가림시설보험금 ──

  it('F-19: 손해액500만, 자기부담금30만, 보험가입금액1000만 → 470만', () => {
    const r = calculate('F-19', {
      damage_amount: 5000000,
      deductible: 300000,
      insured_amount: 10000000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(4700000);
  });

  it('F-19: 손해액이 보험가입금액 초과 → 보험가입금액 한도', () => {
    const r = calculate('F-19', {
      damage_amount: 15000000,
      deductible: 300000,
      insured_amount: 10000000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(10000000);
  });

  it('F-19: 손해액이 자기부담금 이하 → 0', () => {
    const r = calculate('F-19', {
      damage_amount: 200000,
      deductible: 300000,
      insured_amount: 10000000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-20 감귤 등급별 피해과실수 (p.488~489) ──

  it('F-20: 30%형10, 50%형5, 80%형3, 100%형2 → 3+2.5+2.4+2 = 9.9', () => {
    const r = calculate('F-20', {
      count_30: 10,
      count_50: 5,
      count_80: 3,
      count_100: 2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(9.9);
  });

  it('F-20: 모두 정상 → 0', () => {
    const r = calculate('F-20', {
      count_30: 0,
      count_50: 0,
      count_80: 0,
      count_100: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-21 감귤 총 피해과실수 ──

  it('F-21: 등급내20, 등급외10 → 20 + 10×0.5 = 25', () => {
    const r = calculate('F-21', {
      grade_in_damaged: 20,
      grade_out_damaged: 10,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(25);
  });

  // ── F-22 감귤 피해율 ──

  it('F-22: 피해25, 기준100, 미보상비율10% → (25/100)×0.9 = 0.225', () => {
    const r = calculate('F-22', {
      damaged_fruit_count: 25,
      base_fruit_count: 100,
      uncompensated_rate: 0.1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.225);
  });

  // ── F-23 동상해 피해율 (p.491) ──

  it('F-23: 80%형10, 100%형5, 기준100 → (8+5)/100 = 0.13', () => {
    const r = calculate('F-23', {
      frost_80_count: 10,
      frost_100_count: 5,
      base_fruit_count: 100,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.13);
  });

  // ── F-24 잔존비율(12월) (p.491) ──

  it('F-24: 12월 10일 → (61-9.35)/100 = 0.5165', () => {
    const r = calculate('F-24', { day_of_month: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.5165, 4);
  });

  it('F-24: 12월 31일 → (61-28.985)/100 = 0.32015 → 0.3202', () => {
    const r = calculate('F-24', { day_of_month: 31 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.3202, 3);
  });

  // ── F-25 잔존비율(1월) ──

  it('F-25: 1월 15일 → (32-11.61)/100 = 0.2039', () => {
    const r = calculate('F-25', { day_of_month: 15 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.2039, 4);
  });

  it('F-25: 1월 31일 → (32-23.994)/100 = 0.08006 → 0.0801', () => {
    const r = calculate('F-25', { day_of_month: 31 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.0801, 3);
  });

  // ── F-26 잔존비율(2월) ──

  it('F-26: 2월 15일 → (8-4.29)/100 = 0.0371', () => {
    const r = calculate('F-26', { day_of_month: 15 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.0371, 4);
  });

  it('F-26: 2월 28일 → (8-8.008)/100 → max(−0.008/100, 0) = 0', () => {
    const r = calculate('F-26', { day_of_month: 28 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-27 두릅 피해율 (p.489) ──

  it('F-27: 피해30, 총100, 미보상10% → (30/100)×0.9 = 0.27', () => {
    const r = calculate('F-27', {
      damaged_buds: 30,
      total_buds: 100,
      uncompensated_rate: 0.1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.27);
  });

  // ── F-28 블루베리 잔여수확량비율 (p.490) ──

  it('F-28: 수확개시후 10일, 표준30일 → 1-10/30 = 0.6667', () => {
    const r = calculate('F-28', {
      days_since_harvest: 10,
      standard_harvest_days: 30,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.6667, 4);
  });

  it('F-28: 수확개시 전 → 1', () => {
    const r = calculate('F-28', {
      days_since_harvest: 0,
      standard_harvest_days: 30,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1);
  });

  it('F-28: 표준수확일수 초과 → 0 (max 가드)', () => {
    const r = calculate('F-28', {
      days_since_harvest: 35,
      standard_harvest_days: 30,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-29 블루베리 최종 꽃 고사율 (p.490) ──

  it('F-29: 꽃눈고사율 30%, 꽃고사율 20% → 0.3 + 0.7×0.2 = 0.44', () => {
    const r = calculate('F-29', {
      bud_death_rate: 0.3,
      flower_death_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.44);
  });

  it('F-29: 꽃눈100% → 1.0 (꽃 고사율 무관)', () => {
    const r = calculate('F-29', {
      bud_death_rate: 1.0,
      flower_death_rate: 0.5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1.0);
  });

  // ── F-30 무화과 잔여수확량비율(8월) (p.507) ──

  it('F-30: 8월 10일 → (100 - 10.6)/100 = 0.894', () => {
    const r = calculate('F-30', { day_of_month: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.894);
  });

  it('F-30: 8월 31일 → (100 - 32.86)/100 = 0.6714', () => {
    const r = calculate('F-30', { day_of_month: 31 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.6714);
  });
});
