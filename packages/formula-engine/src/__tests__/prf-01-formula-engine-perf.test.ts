/**
 * Master Plan v1.0 §PRF-01 — Formula Engine 51 산식 처리 속도 framework
 *
 * 합격 기준 (Master Plan §PRF-01):
 *   (a) 단일 calculate p99 < 5ms
 *   (b) 51개 직렬 처리 < 100ms
 *   (c) AST cache hit rate > 90% (반복 호출)
 *
 * 본 PARTIAL 보강 (handoff-session-032 §1 — 119/255):
 *   본 시점 framework — BATCH1 13 산식 sample 측정. 51 산식 expansion 은
 *   BATCH-1 적재 시점에 교재 fixture 로 derive 의무. handoff-session-033 §3
 *   silent pivot 보고.
 *
 * 측정 도구: @thepick/shared/test-helpers/perf (Sprint 1 §5.2).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { measure } from '@thepick/shared/test-helpers/perf';
import { calculate } from '../engine';
import { parseFormula, clearCache } from '../ast-parser';

// BATCH1 sample inputs (batch1-golden.test.ts 의 검증된 입력 재사용 — 본 시점 6 sample)
// Pass 4 M-2 흡수: 주석 "BATCH1 13 산식" → 실 카운트 6 sample 정합.
interface FormulaSample {
  readonly id: string;
  readonly vars: Record<string, number>;
}

const BATCH1_SAMPLES: readonly FormulaSample[] = [
  { id: 'F-01', vars: { damaged_fruits: 30, normal_fruits: 70 } },
  { id: 'F-02', vars: { defoliated: 45, attached: 55 } },
  { id: 'F-03', vars: { total_sample: 12, variety_target: 100, total_target: 550 } },
  { id: 'F-05', vars: { flooded_trees: 100, flooded_fruits: 50, total_fruits: 100 } },
  { id: 'F-06', vars: { defoliation_rate: 0.45, elapsed_days: 30 } },
  { id: 'F-07', vars: { defoliation_rate: 0.45 } },
];

beforeEach(() => {
  clearCache(); // 각 테스트 시작 시 cache 비움
});

// ===========================================================================
// 합격 기준 (a) — 단일 calculate p99 < 5ms
// ===========================================================================
describe('PRF-01 (a) — 단일 calculate p99 < 5ms', () => {
  it.each(BATCH1_SAMPLES)('$id 단일 calculate × 100 — p99 < 5ms', async (sample) => {
    const result = await measure(
      `calculate-${sample.id}`,
      () => {
        const r = calculate(sample.id, sample.vars);
        if (!r.ok) throw new Error(`Formula ${sample.id} 실패`);
      },
      { runs: 100, warmup: 5 },
    );
    expect(result.p99Ms).toBeLessThan(5);
    // sanity — meanMs 도 합리적 임계 (cache hit 후 < 1ms 평균)
    expect(result.meanMs).toBeLessThan(2);
  });
});

// ===========================================================================
// 합격 기준 (b) — 51개 직렬 처리 < 100ms (BATCH1 13 산식 → < 25ms 비례 검증)
// ===========================================================================
describe('PRF-01 (b) — N개 직렬 처리 (BATCH1 = 13 산식)', () => {
  it('BATCH1 6 sample 직렬 처리 < 12ms (51 산식 비례 < 100ms 추정)', async () => {
    // 직렬 처리 1회 = 6 calculate (BATCH1_SAMPLES sample). measure 가 측정.
    const result = await measure(
      'batch1-serial',
      () => {
        for (const sample of BATCH1_SAMPLES) {
          const r = calculate(sample.id, sample.vars);
          if (!r.ok) throw new Error(`Formula ${sample.id} 실패`);
        }
      },
      { runs: 50, warmup: 3 },
    );

    // BATCH1 = 6 산식 (sample) → < 12ms 임계 (51 산식 비례 < 100ms)
    expect(result.medianMs).toBeLessThan(12);
    expect(result.p99Ms).toBeLessThan(20); // 변동 여유
  });
});

// ===========================================================================
// 합격 기준 (c) — AST cache hit rate > 90% (반복 호출)
// ===========================================================================
describe('PRF-01 (c) — AST cache hit rate > 90%', () => {
  it('동일 산식 100회 호출 → cache hit rate ≥ 99% (1 miss + 99 hits)', () => {
    clearCache();
    const formula = BATCH1_SAMPLES[0];
    if (!formula) throw new Error('BATCH1_SAMPLES[0] 없음');

    const definition = {
      equationTemplate: 'damaged_fruits / (damaged_fruits + normal_fruits)',
    };

    let hits = 0;
    let misses = 0;
    for (let i = 0; i < 100; i += 1) {
      const result = parseFormula(definition.equationTemplate);
      if (!result.ok) throw new Error('parseFormula 실패');
      if (result.cached) hits += 1;
      else misses += 1;
    }

    const hitRate = hits / (hits + misses);
    expect(hits).toBe(99);
    expect(misses).toBe(1);
    expect(hitRate).toBeGreaterThan(0.9);
  });

  it('BATCH1 6 산식 × 10 반복 = 60 직접 parseFormula 호출 → 6 misses + 54 hits 정확 매칭', () => {
    // Pass 1 MAJOR-S1 흡수: calculate() 첫 호출이 cache 적재 → directParse 가
    // 항상 hit 되는 silent false-pass 회귀 차단. 본 테스트는 calculate() 호출
    // 없이 parseFormula() 직접 호출만 사용해서 6 misses + 54 hits 정확 매칭 검증.
    clearCache();

    let hits = 0;
    let misses = 0;
    for (let iter = 0; iter < 10; iter += 1) {
      for (const sample of BATCH1_SAMPLES) {
        const directParse = parseFormula(getEquationTemplate(sample.id));
        if (!directParse.ok) throw new Error('parseFormula 실패');
        if (directParse.cached) hits += 1;
        else misses += 1;
      }
    }

    // BATCH1 6 산식 × 10 반복 = 60회 — 각 산식 첫 1회 miss + 9회 hit
    // 6 misses + 54 hits = 90% hit rate (정확 카운트 매칭 의무)
    expect(misses).toBe(6); // 산식 6개 × 첫 호출 1회씩
    expect(hits).toBe(54); // 산식 6개 × 후속 호출 9회씩
    const hitRate = hits / (hits + misses);
    expect(hitRate).toBeCloseTo(0.9, 5); // exact 90%
  });
});

// ===========================================================================
// PRF-01 progress tracker — handoff §1 P0 PARTIAL 카운터
// ===========================================================================
describe('PRF-01 progress — 51 산식 expansion 진행 상황', () => {
  it('현 시점 PRF-01 커버리지: BATCH1 6 sample / 51 산식 = 12% (PARTIAL framework)', () => {
    // BATCH-1 적재 후 fixture expansion 의무 — handoff §3 silent pivot 보고.
    const samplesCount = BATCH1_SAMPLES.length;
    const totalFormulas = 51; // Master Plan §PRF-01 명세
    const coveragePercent = Math.round((samplesCount / totalFormulas) * 100);
    expect(coveragePercent).toBeGreaterThanOrEqual(10); // PARTIAL framework 임계
    expect(coveragePercent).toBeLessThan(100);
  });
});

// ===========================================================================
// 헬퍼
// ===========================================================================
function getEquationTemplate(formulaId: string): string {
  // 산식별 template 매핑 — 실 정의에서 추출 가능하나, 본 테스트는 cache 검증 한정
  const templates: Record<string, string> = {
    'F-01': 'damaged_fruits / (damaged_fruits + normal_fruits)',
    'F-02': 'defoliated / (defoliated + attached)',
    'F-03': 'ceil(total_sample * (variety_target / total_target))',
    'F-05': 'flooded_trees * (flooded_fruits / total_fruits)',
    'F-06': 'max(1.0115 * defoliation_rate - 0.0014 * elapsed_days, 0)',
    'F-07': 'max(0.9662 * defoliation_rate - 0.0703, 0)',
  };
  const template = templates[formulaId];
  if (!template) throw new Error(`Unknown formula ID: ${formulaId}`);
  return template;
}
