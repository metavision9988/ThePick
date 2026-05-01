/**
 * 성능 측정 유틸 — Sprint 1 §5.2 도구 정비 (handoff-029 §2.A).
 *
 * PRF-01 (Formula Engine 51 산식 p99) / PRF-02 (graph-integrity DFS) /
 * PRF-04 (normalizer cold start) 등 P0 PRF 시나리오의 공통 측정 wrapper.
 *
 * 본 모듈은 production 경로에서 불러오지 않는다. 테스트 전용.
 * package.json 의 ./test-helpers/perf export 경유로만 진입.
 */

export interface MeasureResult {
  readonly label: string;
  readonly runs: number;
  readonly warmup: number;
  readonly durationsMs: readonly number[];
  readonly minMs: number;
  readonly maxMs: number;
  readonly meanMs: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
}

export interface MeasureOptions {
  readonly runs?: number;
  readonly warmup?: number;
  readonly precisionDecimals?: number;
}

const DEFAULT_RUNS = 100;
const DEFAULT_WARMUP = 5;
const DEFAULT_PRECISION = 3;

/**
 * 동기 / 비동기 함수의 latency 분포를 측정한다.
 *
 * @param label 측정 라벨 (스냅샷 / 로그 식별용)
 * @param fn 측정 대상 — sync 또는 Promise 반환
 * @param options.runs 측정 횟수 (default 100). warmup 후 측정.
 * @param options.warmup JIT warmup 횟수 (default 5). 측정에서 제외.
 * @param options.precisionDecimals 결과 소수점 자릿수 (default 3 = μs 정밀도)
 *
 * @example
 * const result = await measure('formula-eval', () => engine.evaluate(formula, vars), { runs: 1000 });
 * expect(result.p99Ms).toBeLessThan(50);
 */
export async function measure(
  label: string,
  fn: () => void | Promise<void>,
  options: MeasureOptions = {},
): Promise<MeasureResult> {
  const runs = options.runs ?? DEFAULT_RUNS;
  const warmup = options.warmup ?? DEFAULT_WARMUP;
  const precision = options.precisionDecimals ?? DEFAULT_PRECISION;

  if (runs < 1) {
    throw new Error(`measure(${label}): runs must be >= 1, got ${runs}`);
  }
  if (warmup < 0) {
    throw new Error(`measure(${label}): warmup must be >= 0, got ${warmup}`);
  }

  for (let i = 0; i < warmup; i += 1) {
    await fn();
  }

  const durationsMs: number[] = new Array(runs);
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    await fn();
    durationsMs[i] = performance.now() - start;
  }

  return summarize(label, durationsMs, runs, warmup, precision);
}

/**
 * 이미 수집된 duration 배열에서 통계를 계산한다.
 * measure() 내부 호출 + 외부에서 직접 수집한 값 가공에도 사용.
 */
export function summarize(
  label: string,
  durationsMs: readonly number[],
  runs: number,
  warmup: number,
  precision: number = DEFAULT_PRECISION,
): MeasureResult {
  if (durationsMs.length === 0) {
    throw new Error(`summarize(${label}): durations array is empty`);
  }

  const sorted = [...durationsMs].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const median = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);

  return Object.freeze({
    label,
    runs,
    warmup,
    durationsMs: Object.freeze(sorted.map((v) => round(v, precision))),
    minMs: round(sorted[0], precision),
    maxMs: round(sorted[sorted.length - 1], precision),
    meanMs: round(mean, precision),
    medianMs: round(median, precision),
    p95Ms: round(p95, precision),
    p99Ms: round(p99, precision),
  });
}

/**
 * Cache hit rate 측정 — 호출별 hit/miss 를 누적해서 계산.
 */
export class CacheHitTracker {
  private hits = 0;
  private misses = 0;

  recordHit(): void {
    this.hits += 1;
  }

  recordMiss(): void {
    this.misses += 1;
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }

  get total(): number {
    return this.hits + this.misses;
  }

  get hitRate(): number {
    if (this.total === 0) return 0;
    return this.hits / this.total;
  }

  snapshot(): {
    readonly hits: number;
    readonly misses: number;
    readonly total: number;
    readonly hitRate: number;
  } {
    return Object.freeze({
      hits: this.hits,
      misses: this.misses,
      total: this.total,
      hitRate: this.hitRate,
    });
  }
}

/**
 * percentile 선형 보간 (NIST type 7) — sorted 배열 기준.
 */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    throw new Error('percentile: empty array');
  }
  if (sorted.length === 1) return sorted[0];

  const idx = p * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];

  const fraction = idx - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
