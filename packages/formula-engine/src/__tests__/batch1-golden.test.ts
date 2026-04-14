/**
 * BATCH 1 Golden Tests — 교재 예시값 100% 일치 (QG-2)
 *
 * 13개 산식 각각에 대해 교재 실제 예시값 및 수학적으로 정확한 결과를 검증.
 *
 * 교재 근거:
 *   - F-01 유과타박률: p.414 (피해유과수 / (피해+정상))
 *   - F-02 낙엽률: p.415 (낙엽수 / (낙엽+착엽))
 *   - F-03 적정표본주수: p.416-417 예시 (12 × 100/550 = 2.18 → 올림 3)
 *   - F-05 침수주수: p.413 (침수피해나무수 × 과실침수율)
 *   - F-06 단감 인정피해율: p.422 (1.0115×낙엽률 - 0.0014×경과일수)
 *   - F-07 떫은감 인정피해율: p.422 (0.9662×낙엽률 - 0.0703)
 *   - F-11 나무손해보험금: p.434 (자기부담비율 5%)
 *   - F-12 피해인정계수: p.424 (0.0031 × 잔여일수)
 *   - F-13 일소 감수: p.424 (6% 초과분)
 */

import { describe, it, expect } from 'vitest';
import { calculate } from '../engine';

describe('BATCH 1 Golden Tests', () => {
  it('F-01 유과타박률: 피해30 + 정상70 → 0.3', () => {
    const r = calculate('F-01', { damaged_fruits: 30, normal_fruits: 70 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.3);
  });

  it('F-01 유과타박률: 피해0 + 정상100 → 0', () => {
    const r = calculate('F-01', { damaged_fruits: 0, normal_fruits: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  it('F-02 낙엽률: 낙엽45 + 착엽55 → 0.45', () => {
    const r = calculate('F-02', { defoliated: 45, attached: 55 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.45);
  });

  it('F-03 적정표본주수: 10 × (33/100) = 3.3 → 올림 4', () => {
    const r = calculate('F-03', { total_sample: 10, variety_target: 33, total_target: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(4);
  });

  it('F-03 적정표본주수: 정확히 나누어떨어지면 올림 불필요', () => {
    const r = calculate('F-03', { total_sample: 10, variety_target: 50, total_target: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(5);
  });

  // 교재 p.417 실제 예시: 조사대상주수 550주, 전체표본주수 12주
  // 쓰가루/반밀식/10년: 100주 → 12×(100/550) = 2.18 → 올림 3
  it('F-03 교재 p.417 예시: 쓰가루 100/550 → 3', () => {
    const r = calculate('F-03', { total_sample: 12, variety_target: 100, total_target: 550 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(3);
  });

  // 교재 p.417: 쓰가루/반밀식/20년: 200주 → 12×(200/550) = 4.36 → 올림 5
  it('F-03 교재 p.417 예시: 쓰가루 200/550 → 5', () => {
    const r = calculate('F-03', { total_sample: 12, variety_target: 200, total_target: 550 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(5);
  });

  // 교재 p.417: 부사/일반/10년: 150주 → 12×(150/550) = 3.27 → 올림 4
  it('F-03 교재 p.417 예시: 부사 150/550 → 4', () => {
    const r = calculate('F-03', { total_sample: 12, variety_target: 150, total_target: 550 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(4);
  });

  // 교재 p.417 소수점 예시: 1144주, 17주, A품종 337주 → 17×(337/1144) = 5.0078 → 올림 6
  it('F-03 교재 p.417 소수점 예시: 337/1144 → 6', () => {
    const r = calculate('F-03', { total_sample: 17, variety_target: 337, total_target: 1144 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(6);
  });

  it('F-04 품종별 착과수: (500/5) × 100 = 10000', () => {
    const r = calculate('F-04', { sample_fruits_sum: 500, sample_trees_sum: 5, target_trees: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(10000);
  });

  it('F-05 침수주수: 20 × (300/1000) = 6', () => {
    const r = calculate('F-05', { flooded_trees: 20, flooded_fruits: 300, total_fruits: 1000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(6);
  });

  it('F-06 단감 인정피해율: 낙엽률0.45, 경과일수30', () => {
    const r = calculate('F-06', { defoliation_rate: 0.45, elapsed_days: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 1.0115 × 0.45 - 0.0014 × 30 = 0.455175 - 0.042 = 0.413175
      expect(r.value).toBeCloseTo(0.4132, 4);
    }
  });

  it('F-06 단감 인정피해율: 높은 낙엽률', () => {
    const r = calculate('F-06', { defoliation_rate: 0.8, elapsed_days: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 1.0115 × 0.80 - 0.0014 × 10 = 0.8092 - 0.014 = 0.7952
      expect(r.value).toBeCloseTo(0.7952, 4);
    }
  });

  it('F-07 떫은감 인정피해율: 낙엽률0.45', () => {
    const r = calculate('F-07', { defoliation_rate: 0.45 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 0.9662 × 0.45 - 0.0703 = 0.43479 - 0.0703 = 0.36449
      expect(r.value).toBeCloseTo(0.3645, 4);
    }
  });

  it('F-08 착과감소보험금: 기본 케이스', () => {
    const r = calculate('F-08', {
      fruit_reduction: 1000,
      uncompensated: 100,
      self_bearing: 200,
      price: 500,
      coverage: 0.85,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // (1000 - 100 - 200) × 500 × 0.85 = 700 × 500 × 0.85 = 297500
      expect(r.value).toBe(297500);
    }
  });

  it('F-08 착과감소보험금: 공제 초과 시 0 (음수 방지)', () => {
    const r = calculate('F-08', {
      fruit_reduction: 100,
      uncompensated: 80,
      self_bearing: 50,
      price: 500,
      coverage: 0.85,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // max(100-80-50, 0) = max(-30, 0) = 0 → 0 * 500 * 0.85 = 0
      expect(r.value).toBe(0);
    }
  });

  it('F-09 과실손해보험금: 기본 케이스', () => {
    const r = calculate('F-09', {
      accumulated_reduction: 800,
      self_bearing: 200,
      price: 1000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // (800 - 200) × 1000 = 600000
      expect(r.value).toBe(600000);
    }
  });

  it('F-10 나무손해 피해율: 5/100 → 0.05', () => {
    const r = calculate('F-10', { damaged_trees: 5, actual_bearing_trees: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.05);
  });

  it('F-11 나무손해보험금: 피해율 15%, 5% 공제', () => {
    const r = calculate('F-11', { insured_amount: 10000000, damage_rate: 0.15 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 10000000 × max(0.15 - 0.05, 0) = 10000000 × 0.10 = 1000000
      expect(r.value).toBe(1000000);
    }
  });

  it('F-11 나무손해보험금: 피해율 3% → 5% 공제 후 0 (자기부담)', () => {
    const r = calculate('F-11', { insured_amount: 10000000, damage_rate: 0.03 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 10000000 * max(0.03 - 0.05, 0) = 10000000 * 0 = 0
      expect(r.value).toBe(0);
    }
  });

  it('F-12 가을동상해 피해인정계수: 잔여일수 50', () => {
    const r = calculate('F-12', { remaining_days: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 0.0031 × 50 = 0.155
      expect(r.value).toBeCloseTo(0.155, 4);
    }
  });

  it('F-13 일소 감수과실수: 6% 초과분', () => {
    const r = calculate('F-13', { sunburn_fruits: 100, fruits_after_thinning: 1000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // max(100 - 1000×0.06, 0) = max(100 - 60, 0) = 40
      expect(r.value).toBe(40);
    }
  });

  it('F-13 일소 감수과실수: 6% 미달 → 0', () => {
    const r = calculate('F-13', { sunburn_fruits: 50, fruits_after_thinning: 1000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // max(50 - 60, 0) = 0
      expect(r.value).toBe(0);
    }
  });

  // ── 교재 실데이터 Golden Tests (QG-2 충족) ──

  // 교재 p.422 낙과피해구성률 예시: 사과 "중생/홍로"
  // 정상40, 50%형30, 80%형10, 100%형20, 합계100
  // (30×0.5 + 10×0.8 + 20×1) / (30+10+20+40) = (15+8+20)/100 = 43%
  // → 이 산식은 F-01~F-13 범위 밖이지만 교재 예시값 검증용으로 유지

  // 교재 p.422 단감 인정피해율: 경과일수 = 6/1부터 계산
  // 7/1 낙엽률 50%: 경과일수=30, 1.0115×0.50 - 0.0014×30 = 0.50575 - 0.042 = 0.46375
  it('F-06 교재 p.422: 단감 낙엽률50%, 7/1(경과30일)', () => {
    const r = calculate('F-06', { defoliation_rate: 0.5, elapsed_days: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.46375, 4);
  });

  // 8/1 낙엽률 30%: 경과일수=61, 1.0115×0.30 - 0.0014×61 = 0.30345 - 0.0854 = 0.21805
  it('F-06 교재 p.422: 단감 낙엽률30%, 8/1(경과61일)', () => {
    const r = calculate('F-06', { defoliation_rate: 0.3, elapsed_days: 61 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.21805, 4);
  });

  // 교재 p.422 max(x,0) 검증: 낙엽률 5%, 경과일수 100
  // 1.0115×0.05 - 0.0014×100 = 0.050575 - 0.14 = -0.089425 → 0
  it('F-06 교재 p.422 max(0) 가드: 낙엽률5% 경과100일 → 0', () => {
    const r = calculate('F-06', { defoliation_rate: 0.05, elapsed_days: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // 교재 p.422 떫은감: 낙엽률 10% → 0.9662×0.10 - 0.0703 = 0.09662 - 0.0703 = 0.02632
  it('F-07 교재 p.422: 떫은감 낙엽률10%', () => {
    const r = calculate('F-07', { defoliation_rate: 0.1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.02632, 4);
  });

  // 교재 p.422 떫은감 max(0) 가드: 낙엽률 5% → 0.9662×0.05 - 0.0703 = 0.04831 - 0.0703 = -0.02199 → 0
  it('F-07 교재 p.422 max(0) 가드: 떫은감 낙엽률5% → 0', () => {
    const r = calculate('F-07', { defoliation_rate: 0.05 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  // 교재 p.434 나무손해보험금: 자기부담비율 5% 명시
  // 보험가입금액 5,000,000원, 피해율 20% → 5000000 × max(0.20 - 0.05, 0) = 750,000
  it('F-11 교재 p.434: 나무손해 가입500만, 피해율20% → 75만', () => {
    const r = calculate('F-11', { insured_amount: 5000000, damage_rate: 0.2 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(750000);
  });
});
