/**
 * M14 Normalizer — IntegrityReport 결정성 정규화 (Step 15 Engine Hardening).
 *
 * graph-integrity.ts 의 `validateGraphIntegrity()` 출력은 입력 nodes/edges 배열 순서에
 * 의존한다 (`findBrokenEdges` / `validateInputIds` 의 for loop 순서, `findSupersedeCycles`
 * 의 Map insertion-ordered keys()). AC-QU-1 결정성 100% 보장을 위해 본 normalizer 가
 * 출력을 input-order-independent canonical 형태로 변환한다.
 *
 * contract.yaml `build_reproducibility.invariant_fields`:
 *   - violations_list (위반 노드/엣지 ID 목록)
 *   - violation_count_per_type (ViolationType 별 카운트)
 *   - report_summary_hash (SHA-256 of normalized report)
 */

import { createHash } from 'node:crypto';
import type { IntegrityReport, Violation, ViolationType } from './graph-integrity';

// --- Types ---

export interface NormalizedViolation {
  type: ViolationType;
  entityId: string;
  message: string;
  /** SUPERSEDES_CYCLE 의 경우 정규 회전 (가장 작은 ID 시작) 후 정렬된 cycle path */
  canonicalCycle?: string[];
}

export interface NormalizedReport {
  valid: boolean;
  totalViolations: number;
  /** (type ASC, entityId ASC, message ASC) 정렬 — 입력 순서 무관 */
  violationsSorted: NormalizedViolation[];
  /** ViolationType → 카운트 (5종 모두 0 default) */
  typeCounts: Record<ViolationType, number>;
  /** 통계 (입력 순서 무관 — totalNodes/totalEdges/activeNodes/activeEdges/orphanNodes/brokenEdges/supersedeCycles) */
  stats: IntegrityReport['stats'];
  /** SHA-256 of canonical JSON (typeCounts + violationsSorted + stats) */
  reportSummaryHash: string;
}

export type ReportCompareResult = 'equal' | 'differs';

// --- Constants ---

/** ViolationType 5종 default 0 (typeCounts 결정성). */
const VIOLATION_TYPE_INITIAL: Record<ViolationType, number> = {
  ORPHAN_NODE: 0,
  BROKEN_EDGE: 0,
  SUPERSEDES_CYCLE: 0,
  INVALID_ID: 0,
  DUPLICATE_ID: 0,
};

// --- Helpers ---

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** 객체 키 정렬 + 배열 직렬을 보장하는 canonical JSON. */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value ?? null);
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(record[k]));
  return '{' + parts.join(',') + '}';
}

/**
 * SUPERSEDES_CYCLE 의 path 를 canonical form 으로 변환.
 *
 * cycle 은 `path = [A, B, C, A]` 형태 (시작=끝 동일). DFS 시작점이 입력 순서에 의존하므로
 * 시작점이 다르면 같은 cycle 도 다른 path 표기 (e.g., [A,B,C,A] vs [B,C,A,B]). 결정성을 위해
 * 가장 작은 ID 부터 시작하도록 회전한다.
 */
function canonicalizeCyclePath(path: readonly string[]): string[] {
  if (path.length < 2) return [...path];
  // path 의 마지막 요소는 첫 요소와 동일 (cycle 닫힘). 회전을 위해 닫힘 요소를 제거.
  const ring = path[0] === path[path.length - 1] ? path.slice(0, -1) : [...path];
  if (ring.length === 0) return [...path];

  let minIndex = 0;
  for (let i = 1; i < ring.length; i++) {
    if (ring[i] < ring[minIndex]) {
      minIndex = i;
    }
  }
  const rotated = ring.slice(minIndex).concat(ring.slice(0, minIndex));
  // cycle 닫힘 복원 (가독성 — 첫 요소를 끝에 다시 첨부).
  return [...rotated, rotated[0]];
}

function normalizeViolation(v: Violation): NormalizedViolation {
  const out: NormalizedViolation = {
    type: v.type,
    entityId: v.entityId,
    message: v.message,
  };
  if (v.type === 'SUPERSEDES_CYCLE' && v.details && Array.isArray(v.details.cycle)) {
    out.canonicalCycle = canonicalizeCyclePath(v.details.cycle as string[]);
  }
  return out;
}

function compareViolations(a: NormalizedViolation, b: NormalizedViolation): number {
  if (a.type !== b.type) return a.type < b.type ? -1 : 1;
  if (a.entityId !== b.entityId) return a.entityId < b.entityId ? -1 : 1;
  if (a.message !== b.message) return a.message < b.message ? -1 : 1;
  // canonicalCycle 차이는 entityId+type 동일 시 발생할 수 있는 sub-tiebreaker.
  const ac = JSON.stringify(a.canonicalCycle ?? null);
  const bc = JSON.stringify(b.canonicalCycle ?? null);
  return ac < bc ? -1 : ac > bc ? 1 : 0;
}

// --- Normalize ---

export function normalizeReport(report: IntegrityReport): NormalizedReport {
  const normalized = report.violations.map(normalizeViolation);
  // SUPERSEDES_CYCLE 의 entityId 도 canonical cycle 의 첫 요소로 정규화 (DFS 시작점 의존성 제거).
  for (const v of normalized) {
    if (v.type === 'SUPERSEDES_CYCLE' && v.canonicalCycle && v.canonicalCycle.length > 0) {
      v.entityId = v.canonicalCycle[0];
      v.message = `SUPERSEDES cycle detected: ${v.canonicalCycle.join(' → ')}`;
    }
  }

  // 동일 cycle 이 여러 시작점에서 보고된 경우 dedupe (canonicalCycle 동일성 기준).
  const seen = new Set<string>();
  const deduped: NormalizedViolation[] = [];
  for (const v of normalized) {
    const key =
      v.type === 'SUPERSEDES_CYCLE' && v.canonicalCycle
        ? `${v.type}|${v.canonicalCycle.join('>')}`
        : `${v.type}|${v.entityId}|${v.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(v);
  }

  const violationsSorted = [...deduped].sort(compareViolations);

  const typeCounts: Record<ViolationType, number> = { ...VIOLATION_TYPE_INITIAL };
  for (const v of violationsSorted) {
    typeCounts[v.type]++;
  }

  const reportSummaryHash = sha256Hex(
    canonicalJson({
      valid: report.valid,
      typeCounts,
      violationsSorted,
      stats: report.stats,
    }),
  );

  return {
    valid: report.valid,
    totalViolations: violationsSorted.length,
    violationsSorted,
    typeCounts,
    stats: report.stats,
    reportSummaryHash,
  };
}

// --- Compare ---

export function compareReports(a: IntegrityReport, b: IntegrityReport): ReportCompareResult {
  const na = normalizeReport(a);
  const nb = normalizeReport(b);
  return na.reportSummaryHash === nb.reportSummaryHash ? 'equal' : 'differs';
}
