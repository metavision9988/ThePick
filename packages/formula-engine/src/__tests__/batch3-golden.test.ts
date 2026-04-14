/**
 * BATCH 3 Golden Tests — 논작물(벼, 맥류) (p.501~521)
 *
 * 교재 근거:
 *   - p.524: 이앙·직파불능 보험금 = 보험가입금액 × 15%
 *   - p.525: 재이앙·재직파 보험금 = 보험가입금액 × 25% × 면적피해율
 *   - p.525: 경과비율 5월=80%, 6월=85%, 7월=90%, 8월=100%
 *   - p.527: 수확감소보험금 = 보험가입금액 × (피해율 – 자기부담비율)
 *   - p.550: 감자 피해율 (병충해감수량 가산)
 *   - p.550: 옥수수 보험금 = min(보험가입금액, 손해액) – 자기부담금
 *   - p.580: 인삼 피해율 (연근별기준수확량)
 */

import { describe, it, expect } from 'vitest';
import { calculate } from '../engine';

describe('BATCH 3 Golden Tests', () => {
  // ── F-31 이앙·직파불능 보험금 ──

  it('F-31: 보험가입금액 500만 → 75만', () => {
    const r = calculate('F-31', { insured_amount: 5000000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(750000);
  });

  // ── F-32 재이앙·재직파 보험금 ──

  it('F-32: 보험가입금액 500만, 면적피해율 40% → 500만×25%×40% = 50만', () => {
    const r = calculate('F-32', {
      insured_amount: 5000000,
      area_damage_rate: 0.4,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(500000);
  });

  // ── F-33 면적피해율 ──

  it('F-33: 피해면적 300, 가입면적 1000 → 0.3', () => {
    const r = calculate('F-33', {
      damaged_area: 300,
      insured_area: 1000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.3);
  });

  // ── F-34 수확감소보험금(논작물) ──

  it('F-34: 보험가입금액 800만, 피해율 35%, 자기부담 20% → 120만', () => {
    const r = calculate('F-34', {
      insured_amount: 8000000,
      damage_rate: 0.35,
      deductible_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1200000);
  });

  it('F-34: 피해율이 자기부담비율 이하 → 0', () => {
    const r = calculate('F-34', {
      insured_amount: 8000000,
      damage_rate: 0.1,
      deductible_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // ── F-35 조사료용 벼 경작불능보험금 ──

  it('F-35: 보험가입금액 300만, 보장비율 45%, 경과비율 80%(5월) → 108만', () => {
    const r = calculate('F-35', {
      insured_amount: 3000000,
      coverage_rate: 0.45,
      elapsed_rate: 0.8,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1080000);
  });

  it('F-35: 8월(100%) → 300만 × 40% × 100% = 120만', () => {
    const r = calculate('F-35', {
      insured_amount: 3000000,
      coverage_rate: 0.4,
      elapsed_rate: 1.0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1200000);
  });

  // ── F-36 감자 피해율 ──

  it('F-36: 평년1000, 수확650, 미보상35, 병충해50 → ((1000-650-35)+50)/1000 = 0.365', () => {
    const r = calculate('F-36', {
      standard_yield: 1000,
      actual_yield: 650,
      uncompensated_loss: 35,
      disease_loss: 50,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.365);
  });

  it('F-36: 병충해감수량이 커도 피해율 1.0 상한 (min clamp)', () => {
    const r = calculate('F-36', {
      standard_yield: 100,
      actual_yield: 0,
      uncompensated_loss: 0,
      disease_loss: 50,
    });
    expect(r.ok).toBe(true);
    // (100-0-0+50)/100 = 1.5 → min(1.5, 1) = 1.0
    if (r.ok) expect(r.value).toBe(1.0);
  });

  it('F-36: 병충해 0 → 일반 피해율과 동일', () => {
    const r = calculate('F-36', {
      standard_yield: 1000,
      actual_yield: 700,
      uncompensated_loss: 50,
      disease_loss: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.25);
  });

  // ── F-37 옥수수 수확감소보험금 ──

  it('F-37: 보험가입금액 500만, 피해수확량 600kg, 가격 5000, 자기부담 20%', () => {
    const r = calculate('F-37', {
      insured_amount: 5000000,
      damage_yield: 600,
      price: 5000,
      deductible_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // min(5000000, 600×5000) - 5000000×0.20 = min(5000000, 3000000) - 1000000 = 2000000
      expect(r.value).toBe(2000000);
    }
  });

  it('F-37: 손해액이 보험가입금액 초과 → 보험가입금액 기준', () => {
    const r = calculate('F-37', {
      insured_amount: 2000000,
      damage_yield: 1000,
      price: 5000,
      deductible_rate: 0.2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // min(2000000, 5000000) - 2000000×0.20 = 2000000 - 400000 = 1600000
      expect(r.value).toBe(1600000);
    }
  });

  // ── F-38 인삼 피해율 ──

  it('F-38: 수확량0.3, 기준0.7(3년근표준), 피해면적50, 재배면적100 → 0.2857', () => {
    const r = calculate('F-38', {
      actual_yield: 0.3,
      standard_yield: 0.7,
      damaged_area: 50,
      cultivated_area: 100,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // (1 - 0.3/0.7) × (50/100) = (1 - 0.4286) × 0.5 = 0.5714 × 0.5 = 0.2857
      expect(r.value).toBeCloseTo(0.2857, 4);
    }
  });

  it('F-38: 수확량 > 기준 → 피해율 0 (max 가드)', () => {
    const r = calculate('F-38', {
      actual_yield: 1.0,
      standard_yield: 0.7,
      damaged_area: 100,
      cultivated_area: 100,
    });
    expect(r.ok).toBe(true);
    // (1 - 1.0/0.7) × 1 = (1 - 1.4286) × 1 = -0.4286 → max(-0.4286, 0) = 0
    if (r.ok) expect(r.value).toBe(0);
  });

  it('F-38: 전체 피해(수확량=0, 전체면적) → 피해율 1.0', () => {
    const r = calculate('F-38', {
      actual_yield: 0,
      standard_yield: 0.64,
      damaged_area: 100,
      cultivated_area: 100,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1.0);
  });
});
