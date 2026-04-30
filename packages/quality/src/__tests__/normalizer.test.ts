/**
 * Step 15a normalizer.ts 단위 테스트.
 *
 * normalizeReport / compareReports 의 정렬·canonical cycle·dedupe·summary hash 결정성
 * 보장. property test (determinism.property.test.ts) 의 도구 무결성 1차 방어선.
 */

import { describe, it, expect } from 'vitest';
import { compareReports, normalizeReport } from '../normalizer';
import type { IntegrityReport, Violation } from '../graph-integrity';

function emptyReport(): IntegrityReport {
  return {
    valid: true,
    violations: [],
    stats: {
      totalNodes: 0,
      totalEdges: 0,
      activeNodes: 0,
      activeEdges: 0,
      orphanNodes: 0,
      brokenEdges: 0,
      supersedeCycles: 0,
    },
  };
}

function reportOf(violations: Violation[]): IntegrityReport {
  const orphan = violations.filter((v) => v.type === 'ORPHAN_NODE').length;
  const broken = violations.filter((v) => v.type === 'BROKEN_EDGE').length;
  const cycle = violations.filter((v) => v.type === 'SUPERSEDES_CYCLE').length;
  return {
    valid: violations.length === 0,
    violations,
    stats: {
      totalNodes: 0,
      totalEdges: 0,
      activeNodes: 0,
      activeEdges: 0,
      orphanNodes: orphan,
      brokenEdges: broken,
      supersedeCycles: cycle,
    },
  };
}

// ---------------- normalizeReport ----------------

describe('normalizeReport — 정렬', () => {
  it('빈 violations 의 typeCounts 5종 모두 0', () => {
    const norm = normalizeReport(emptyReport());
    expect(norm.totalViolations).toBe(0);
    expect(norm.typeCounts).toEqual({
      ORPHAN_NODE: 0,
      BROKEN_EDGE: 0,
      SUPERSEDES_CYCLE: 0,
      INVALID_ID: 0,
      DUPLICATE_ID: 0,
    });
    expect(norm.reportSummaryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('violations 입력 순서 무관하게 정렬 (type ASC, entityId ASC)', () => {
    const a: Violation[] = [
      { type: 'BROKEN_EDGE', entityId: 'E-02', message: 'broken e-02' },
      { type: 'ORPHAN_NODE', entityId: 'N-01', message: 'orphan n-01' },
      { type: 'BROKEN_EDGE', entityId: 'E-01', message: 'broken e-01' },
    ];
    const b: Violation[] = [a[2], a[0], a[1]];
    const na = normalizeReport(reportOf(a));
    const nb = normalizeReport(reportOf(b));
    const ids = na.violationsSorted.map((v) => v.entityId);
    expect(ids).toEqual(['E-01', 'E-02', 'N-01']);
    expect(na.reportSummaryHash).toBe(nb.reportSummaryHash);
  });

  it('typeCounts 가 ViolationType 5종 모두 포함 (key 정렬 결정성)', () => {
    const violations: Violation[] = [
      { type: 'ORPHAN_NODE', entityId: 'N-01', message: 'x' },
      { type: 'ORPHAN_NODE', entityId: 'N-02', message: 'y' },
      { type: 'BROKEN_EDGE', entityId: 'E-01', message: 'z' },
    ];
    const norm = normalizeReport(reportOf(violations));
    expect(norm.typeCounts.ORPHAN_NODE).toBe(2);
    expect(norm.typeCounts.BROKEN_EDGE).toBe(1);
    expect(norm.typeCounts.SUPERSEDES_CYCLE).toBe(0);
    expect(norm.typeCounts.INVALID_ID).toBe(0);
    expect(norm.typeCounts.DUPLICATE_ID).toBe(0);
  });
});

// ---------------- canonical cycle path ----------------

describe('normalizeReport — SUPERSEDES_CYCLE canonical path', () => {
  it('cycle 시작점이 다르더라도 동일한 canonical 회전 (entityId 도 정규화)', () => {
    // 동일 cycle 을 다른 시작점에서 보고 — A→B→C→A vs B→C→A→B
    const aV: Violation = {
      type: 'SUPERSEDES_CYCLE',
      entityId: 'NODE-A',
      message: 'SUPERSEDES cycle detected: NODE-A → NODE-B → NODE-C → NODE-A',
      details: { cycle: ['NODE-A', 'NODE-B', 'NODE-C', 'NODE-A'] },
    };
    const bV: Violation = {
      type: 'SUPERSEDES_CYCLE',
      entityId: 'NODE-B',
      message: 'SUPERSEDES cycle detected: NODE-B → NODE-C → NODE-A → NODE-B',
      details: { cycle: ['NODE-B', 'NODE-C', 'NODE-A', 'NODE-B'] },
    };
    const na = normalizeReport(reportOf([aV]));
    const nb = normalizeReport(reportOf([bV]));
    expect(na.reportSummaryHash).toBe(nb.reportSummaryHash);
    expect(na.violationsSorted[0].canonicalCycle).toEqual(['NODE-A', 'NODE-B', 'NODE-C', 'NODE-A']);
    expect(na.violationsSorted[0].entityId).toBe('NODE-A'); // canonical 첫 요소
  });

  it('동일 cycle 이 여러 시작점에서 보고된 경우 dedupe', () => {
    const cycleA: Violation = {
      type: 'SUPERSEDES_CYCLE',
      entityId: 'NODE-A',
      message: 'x',
      details: { cycle: ['NODE-A', 'NODE-B', 'NODE-A'] },
    };
    const cycleB: Violation = {
      type: 'SUPERSEDES_CYCLE',
      entityId: 'NODE-B',
      message: 'y',
      details: { cycle: ['NODE-B', 'NODE-A', 'NODE-B'] },
    };
    const norm = normalizeReport(reportOf([cycleA, cycleB]));
    expect(norm.totalViolations).toBe(1);
    expect(norm.violationsSorted[0].canonicalCycle).toEqual(['NODE-A', 'NODE-B', 'NODE-A']);
  });

  it('Self-loop (A→A) canonical 보존', () => {
    const v: Violation = {
      type: 'SUPERSEDES_CYCLE',
      entityId: 'NODE-X',
      message: 'self',
      details: { cycle: ['NODE-X', 'NODE-X'] },
    };
    const norm = normalizeReport(reportOf([v]));
    expect(norm.violationsSorted[0].canonicalCycle).toEqual(['NODE-X', 'NODE-X']);
  });
});

// ---------------- summary hash ----------------

describe('normalizeReport — reportSummaryHash 결정성', () => {
  it('동일 violations 에 동일 hash', () => {
    const v: Violation[] = [{ type: 'ORPHAN_NODE', entityId: 'N-01', message: 'x' }];
    const r1 = normalizeReport(reportOf(v));
    const r2 = normalizeReport(reportOf(v));
    expect(r1.reportSummaryHash).toBe(r2.reportSummaryHash);
  });

  it('violations 1건 변경 시 다른 hash', () => {
    const r1 = normalizeReport(reportOf([{ type: 'ORPHAN_NODE', entityId: 'N-01', message: 'x' }]));
    const r2 = normalizeReport(reportOf([{ type: 'ORPHAN_NODE', entityId: 'N-02', message: 'x' }]));
    expect(r1.reportSummaryHash).not.toBe(r2.reportSummaryHash);
  });

  it('stats 변경 시 다른 hash (totalNodes 등)', () => {
    const base = reportOf([]);
    const altered: IntegrityReport = {
      ...base,
      stats: { ...base.stats, totalNodes: 100 },
    };
    expect(normalizeReport(base).reportSummaryHash).not.toBe(
      normalizeReport(altered).reportSummaryHash,
    );
  });
});

// ---------------- compareReports ----------------

describe('compareReports', () => {
  it('동일 violations + stats → equal', () => {
    const v: Violation[] = [{ type: 'BROKEN_EDGE', entityId: 'E-01', message: 'x' }];
    expect(compareReports(reportOf(v), reportOf(v))).toBe('equal');
  });

  it('violations 입력 순서 변경에도 equal', () => {
    const a: Violation[] = [
      { type: 'BROKEN_EDGE', entityId: 'E-02', message: 'x' },
      { type: 'ORPHAN_NODE', entityId: 'N-01', message: 'y' },
    ];
    const b: Violation[] = [a[1], a[0]];
    expect(compareReports(reportOf(a), reportOf(b))).toBe('equal');
  });

  it('violation 1건 추가 시 differs', () => {
    const a: Violation[] = [{ type: 'ORPHAN_NODE', entityId: 'N-01', message: 'x' }];
    const b: Violation[] = [...a, { type: 'BROKEN_EDGE', entityId: 'E-01', message: 'y' }];
    expect(compareReports(reportOf(a), reportOf(b))).toBe('differs');
  });

  it('cycle 시작점 다른 동일 cycle → equal', () => {
    const a: Violation[] = [
      {
        type: 'SUPERSEDES_CYCLE',
        entityId: 'NODE-A',
        message: 'x',
        details: { cycle: ['NODE-A', 'NODE-B', 'NODE-C', 'NODE-A'] },
      },
    ];
    const b: Violation[] = [
      {
        type: 'SUPERSEDES_CYCLE',
        entityId: 'NODE-C',
        message: 'y',
        details: { cycle: ['NODE-C', 'NODE-A', 'NODE-B', 'NODE-C'] },
      },
    ];
    expect(compareReports(reportOf(a), reportOf(b))).toBe('equal');
  });
});
