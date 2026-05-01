import { describe, it, expect } from 'vitest';

import { CacheHitTracker, measure, summarize } from '../test-helpers/perf.js';

describe('test-helpers/perf — measure()', () => {
  it('returns durations + statistics with frozen result', async () => {
    const result = await measure('noop', () => undefined, { runs: 20, warmup: 2 });

    expect(result.label).toBe('noop');
    expect(result.runs).toBe(20);
    expect(result.warmup).toBe(2);
    expect(result.durationsMs.length).toBe(20);
    expect(result.minMs).toBeLessThanOrEqual(result.medianMs);
    expect(result.medianMs).toBeLessThanOrEqual(result.p95Ms);
    expect(result.p95Ms).toBeLessThanOrEqual(result.p99Ms);
    expect(result.p99Ms).toBeLessThanOrEqual(result.maxMs);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.durationsMs)).toBe(true);
  });

  it('supports async functions with awaited measurement', async () => {
    const result = await measure(
      'async-noop',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
      },
      { runs: 10, warmup: 1 },
    );

    expect(result.minMs).toBeGreaterThanOrEqual(0);
    expect(result.medianMs).toBeGreaterThanOrEqual(0);
  });

  it('throws when runs < 1', async () => {
    await expect(measure('bad', () => undefined, { runs: 0 })).rejects.toThrow(/runs must be >= 1/);
  });

  it('throws when warmup is negative', async () => {
    await expect(measure('bad', () => undefined, { runs: 5, warmup: -1 })).rejects.toThrow(
      /warmup must be >= 0/,
    );
  });

  it('rounds values to configured precision', async () => {
    const result = await measure('precise', () => undefined, {
      runs: 5,
      warmup: 0,
      precisionDecimals: 1,
    });
    for (const value of result.durationsMs) {
      const decimalPart = value.toString().split('.')[1] ?? '';
      expect(decimalPart.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('test-helpers/perf — summarize()', () => {
  it('computes deterministic statistics for sorted input', () => {
    const result = summarize('static', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10, 0);
    expect(result.minMs).toBe(1);
    expect(result.maxMs).toBe(10);
    expect(result.meanMs).toBe(5.5);
    expect(result.medianMs).toBeCloseTo(5.5, 5);
    expect(result.p95Ms).toBeCloseTo(9.55, 5);
    expect(result.p99Ms).toBeCloseTo(9.91, 5);
  });

  it('handles single-element arrays without divide-by-zero', () => {
    const result = summarize('single', [42], 1, 0);
    expect(result.minMs).toBe(42);
    expect(result.maxMs).toBe(42);
    expect(result.medianMs).toBe(42);
    expect(result.p95Ms).toBe(42);
    expect(result.p99Ms).toBe(42);
  });

  it('throws on empty arrays instead of returning NaN', () => {
    expect(() => summarize('empty', [], 0, 0)).toThrow(/empty/);
  });

  it('does not mutate the input array', () => {
    const input = [10, 5, 3, 8, 1];
    const snapshot = [...input];
    summarize('immutable', input, 5, 0);
    expect(input).toEqual(snapshot);
  });
});

describe('test-helpers/perf — CacheHitTracker', () => {
  it('returns 0 hit rate when total is 0', () => {
    const tracker = new CacheHitTracker();
    expect(tracker.hitRate).toBe(0);
    expect(tracker.total).toBe(0);
  });

  it('computes hit rate over hits + misses', () => {
    const tracker = new CacheHitTracker();
    tracker.recordHit();
    tracker.recordHit();
    tracker.recordHit();
    tracker.recordMiss();
    expect(tracker.hitRate).toBeCloseTo(0.75, 5);
    expect(tracker.total).toBe(4);
  });

  it('reset() zeros hits + misses', () => {
    const tracker = new CacheHitTracker();
    tracker.recordHit();
    tracker.recordMiss();
    tracker.reset();
    expect(tracker.hitRate).toBe(0);
    expect(tracker.total).toBe(0);
  });

  it('snapshot() returns frozen view', () => {
    const tracker = new CacheHitTracker();
    tracker.recordHit();
    const snapshot = tracker.snapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.hits).toBe(1);
    expect(snapshot.misses).toBe(0);
    expect(snapshot.hitRate).toBe(1);
  });
});
