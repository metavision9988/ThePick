/**
 * QG-2 게이트 검증기 — BATCH 품질 게이트
 *
 * 통과 조건 (★ 임계값 정본 = 아래 QG2_THRESHOLDS 코드 — 설계서 v1.1 기준.
 * 구 헤더의 60/200/13 표기는 stale 이었음, design-audit RC-5/2c 동기 2026-06-11):
 *   1. 노드 40+ 개
 *   2. 엣지 80+ 개
 *   3. 산식: 배치별 누적 임계 (CUMULATIVE_FORMULA_THRESHOLDS — BATCH-1~7 +
 *      L1·L2·R1·R2·S1 전 배치 정의, formula-engine 레지스트리 카운트 기준.
 *      ★미정의 batchId = fail-closed 즉시 FAIL — 구 minFormulas(7) 무경고
 *      fallback 은 결재 #19 (a)로 폐기, 진산 2026-07-02)
 *   4. 산식 정확도 100% (교재 예시값 대비)
 *   5. Graph 무결성: 고아노드 0, 순환 0, 끊긴엣지 0
 *
 * 실패 시 다음 BATCH/Phase 진입 보류.
 */

import { validateGraphIntegrity, SupersedeChainTooDeepError } from '@thepick/quality';
import type { GraphNode, GraphEdge, IntegrityReport } from '@thepick/quality';
import { calculate, getAllFormulas } from '@thepick/formula-engine';
import type { CalculateResult } from '@thepick/formula-engine';

// --- QG-2 임계값 ---

const QG2_THRESHOLDS = {
  minNodes: 40,
  minEdges: 80,
  formulaAccuracy: 1.0, // 100%
  maxOrphanNodes: 0,
  maxBrokenEdges: 0,
  maxSupersedeCycles: 0,
} as const;

/**
 * 배치별 누적 산식 수 임계값 — formula-engine 레지스트리(getAllFormulas) 카운트 기준.
 *
 * BATCH-6+ 수치 = 결재 #19 (a) engine 실측 산출 채택 (진산 2026-07-02 "권고대로",
 * `docs/plans/master-remediation-20260610/decision-card-19-qg2-batch6-threshold.md` §②):
 * BATCH-6 = 68+21 = 89 / BATCH-7 = 89+6 = 95 / L1·L2·R1·R2·S1 = 산식 증분 0 → 95 유지.
 * ★F-131~F-157(27건)은 engine 미등록 — 등록(formula-engine = L3 별도 plan·결재) 전까지
 * BATCH-6+ 검증은 의도적으로 FAIL (fail-closed: 등록 갭을 게이트가 강제 노출).
 * 미정의 batchId 는 checkFormulaRegistry 에서 fail-closed FAIL (구 fallback 7 폐기).
 */
const CUMULATIVE_FORMULA_THRESHOLDS: Record<string, number> = {
  'BATCH-1': 7,
  'BATCH-2': 30, // 13 + 17
  'BATCH-3': 38, // 30 + 8
  'BATCH-4': 53, // 38 + 15
  'BATCH-5': 68, // 53 + 15
  'BATCH-6': 89, // 68 + 21 (F-131~F-151 — engine 미등록, 등록 전 FAIL = 의도된 fail-closed)
  'BATCH-7': 95, // 89 + 6 (F-152~F-157 — engine 미등록, 등록 전 FAIL = 의도된 fail-closed)
  'BATCH-L1': 95, // 산식 증분 0 → 95 유지
  'BATCH-L2': 95, // 산식 증분 0 → 95 유지
  'BATCH-R1': 95, // 산식 증분 0 → 95 유지
  'BATCH-R2': 95, // 산식 증분 0 → 95 유지
  'BATCH-S1': 95, // 산식 증분 0 → 95 유지
};

/** 미정의 batchId fail-closed 진단 코드 (admin-web/observability 추적용 — CHAIN_TOO_DEEP 컨벤션 정합) */
const UNDEFINED_THRESHOLD_CODE = 'UNDEFINED_THRESHOLD';

// --- 검증 결과 ---

export interface QG2Result {
  readonly passed: boolean;
  readonly checks: readonly QG2Check[];
  readonly summary: string;
}

export interface QG2Check {
  readonly name: string;
  readonly passed: boolean;
  readonly expected: string;
  readonly actual: string;
}

// --- Golden Test 데이터 (교재 예시값) ---

export interface GoldenTestCase {
  readonly formulaId: string;
  readonly inputs: Record<string, number>;
  readonly expectedValue: number;
  readonly tolerance?: number;
}

// --- 검증 함수 ---

/**
 * 그래프 규모 검증 — 임계 정본 = QG2_THRESHOLDS (노드 40+, 엣지 80+).
 * (구 "60+/200+" 표기는 stale — 리뷰 MINOR-1 동기, 2026-06-11)
 */
export function checkGraphScale(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): QG2Check[] {
  const activeNodes = nodes.filter((n) => n.isActive !== false).length;
  const activeEdges = edges.filter((e) => e.isActive !== false).length;

  return [
    {
      name: `Node count >= ${QG2_THRESHOLDS.minNodes}`,
      passed: activeNodes >= QG2_THRESHOLDS.minNodes,
      expected: `>= ${QG2_THRESHOLDS.minNodes}`,
      actual: String(activeNodes),
    },
    {
      name: `Edge count >= ${QG2_THRESHOLDS.minEdges}`,
      passed: activeEdges >= QG2_THRESHOLDS.minEdges,
      expected: `>= ${QG2_THRESHOLDS.minEdges}`,
      actual: String(activeEdges),
    },
  ];
}

/**
 * 산식 레지스트리 검증: 배치별 누적 산식 수 확인
 *
 * 결재 #19 (a) 흡수 (진산 2026-07-02): 미정의 batchId 는 구 `?? minFormulas(7)`
 * 무경고 fallback(누적 검증 약화) 대신 **fail-closed 즉시 FAIL** — 직접 호출로
 * 미정의 ID 를 전달해도 7 기준 무음 통과 경로가 존재하지 않는다. 신규 배치 임계
 * 정의 추가는 결재 사안(본 카드 #19 선례).
 *
 * @param batchId - 검증 대상 배치 ID (기본: 'BATCH-1')
 */
export function checkFormulaRegistry(batchId: string = 'BATCH-1'): QG2Check {
  const formulas = getAllFormulas();
  const threshold: number | undefined = CUMULATIVE_FORMULA_THRESHOLDS[batchId];
  if (threshold === undefined) {
    return {
      name: `Formula count threshold defined (${batchId})`,
      passed: false,
      expected: `batchId in [${Object.keys(CUMULATIVE_FORMULA_THRESHOLDS).join(', ')}]`,
      actual: `${UNDEFINED_THRESHOLD_CODE} (${batchId})`,
    };
  }
  return {
    name: `Formula count >= ${threshold} (${batchId})`,
    passed: formulas.length >= threshold,
    expected: `>= ${threshold}`,
    actual: String(formulas.length),
  };
}

/**
 * 산식 정확도 검증: Golden test 100% 통과
 */
export function checkFormulaAccuracy(goldenTests: readonly GoldenTestCase[]): QG2Check[] {
  const results: QG2Check[] = [];

  for (const tc of goldenTests) {
    const result: CalculateResult = calculate(tc.formulaId, tc.inputs);
    const tolerance = tc.tolerance ?? 0.0001;

    if (!result.ok) {
      results.push({
        name: `${tc.formulaId} accuracy`,
        passed: false,
        expected: String(tc.expectedValue),
        actual: `ERROR: ${result.message}`,
      });
      continue;
    }

    const diff = Math.abs(result.value - tc.expectedValue);
    results.push({
      name: `${tc.formulaId} accuracy`,
      passed: diff <= tolerance,
      expected: String(tc.expectedValue),
      actual: String(result.value),
    });
  }

  return results;
}

/**
 * Graph 무결성 검증: 고아 0, 끊긴 엣지 0, 순환 0
 *
 * Sprint 1 §5.1 4-Pass CRITICAL-1 흡수 (Pass 2/3, 2026-05-01):
 * `validateGraphIntegrity` 가 `SupersedeChainTooDeepError` throw 가능 →
 * graceful degradation 으로 변환 (`passed: false, actual: 'CHAIN_TOO_DEEP'`).
 * throw 가 caller 까지 전파되어 BATCH 가 hard crash 되는 것을 차단 +
 * error code 메타데이터를 QG2Check 에 보존하여 admin-web/observability 추적 가능.
 */
export function checkGraphIntegrity(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): QG2Check[] {
  let report: IntegrityReport;
  try {
    report = validateGraphIntegrity(nodes as GraphNode[], edges as GraphEdge[]);
  } catch (err) {
    if (err instanceof SupersedeChainTooDeepError) {
      // sentinel 발화 — 모든 graph 무결성 check 를 동일 실패 코드로 노출.
      // depth/maxDepth 메타는 actual 필드에 직렬화 (fixture corruption 식별용).
      const actual = `CHAIN_TOO_DEEP (depth>=${err.depth}, max=${err.maxDepth})`;
      return [
        {
          name: 'Orphan nodes = 0',
          passed: false,
          expected: `<= ${QG2_THRESHOLDS.maxOrphanNodes}`,
          actual,
        },
        {
          name: 'Broken edges = 0',
          passed: false,
          expected: `<= ${QG2_THRESHOLDS.maxBrokenEdges}`,
          actual,
        },
        {
          name: 'SUPERSEDES cycles = 0',
          passed: false,
          expected: `<= ${QG2_THRESHOLDS.maxSupersedeCycles}`,
          actual,
        },
      ];
    }
    throw err; // 다른 error 는 기존 동작 유지 (silent breaking change 차단)
  }

  return [
    {
      name: 'Orphan nodes = 0',
      passed: report.stats.orphanNodes <= QG2_THRESHOLDS.maxOrphanNodes,
      expected: `<= ${QG2_THRESHOLDS.maxOrphanNodes}`,
      actual: String(report.stats.orphanNodes),
    },
    {
      name: 'Broken edges = 0',
      passed: report.stats.brokenEdges <= QG2_THRESHOLDS.maxBrokenEdges,
      expected: `<= ${QG2_THRESHOLDS.maxBrokenEdges}`,
      actual: String(report.stats.brokenEdges),
    },
    {
      name: 'SUPERSEDES cycles = 0',
      passed: report.stats.supersedeCycles <= QG2_THRESHOLDS.maxSupersedeCycles,
      expected: `<= ${QG2_THRESHOLDS.maxSupersedeCycles}`,
      actual: String(report.stats.supersedeCycles),
    },
  ];
}

/**
 * QG-2 전체 검증 실행
 */
export function runQG2Validation(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  goldenTests: readonly GoldenTestCase[],
  /**
   * 검증 대상 배치 — 누적 산식 임계 선택 (design-audit RC-5/2c 동기, 2026-06-11:
   * 구 구현은 미배선이라 어느 배치든 BATCH-1 임계(7)로 고정 검증되던 드리프트).
   * 기본값은 하위호환 유지.
   */
  batchId: string = 'BATCH-1',
): QG2Result {
  const checks: QG2Check[] = [
    ...checkGraphScale(nodes, edges),
    checkFormulaRegistry(batchId),
    ...checkFormulaAccuracy(goldenTests),
    ...checkGraphIntegrity(nodes, edges),
  ];

  const passed = checks.every((c) => c.passed);
  const failCount = checks.filter((c) => !c.passed).length;

  const summary = passed
    ? `QG-2 PASSED: ${checks.length}/${checks.length} checks passed`
    : `QG-2 FAILED: ${failCount}/${checks.length} checks failed`;

  return { passed, checks, summary };
}
