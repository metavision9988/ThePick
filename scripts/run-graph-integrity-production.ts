#!/usr/bin/env tsx
/**
 * Production 지식 그래프 누적 무결성 러너 — design-audit WS-2a / 확장 게이트 E0-2.
 *
 * 근거: DESIGN_AUDIT_REPORT_20260610 RC-1 ("production 794/1274 가 검증 기계를
 * 한 번도 통과 안 함") + EXPANSION_GATE_DESIGN E0-2 (판정 = "고아0·끊김0·순환0·
 * stale참조0 = 러너 gatePass" — 구판 "CONCEPT-023 기지양성" 문구는 2026-06-11
 * 실측 반증으로 정정됨, 동 문서 E0-2 행·결재 #18 참조. 리뷰 Minor-1 흡수).
 *
 * 순수 코어(packages/quality/src/production-audit.ts, vitest 게이트)와 분리 —
 * 본 파일은 D1 덤프 읽기 / 리포트 쓰기 IO 만. production 쓰기 0 (read-only 감사).
 *
 * 사용 (덤프 생성 → 러너):
 *   cd apps/api
 *   npx wrangler d1 execute thepick-db-production --remote --json \
 *     --command "SELECT kn.id, kn.type, kn.name, kn.is_current_active, kn.valid_from, kn.valid_until, kn.source_quote, \
 *                  COALESCE((SELECT st.to_status FROM status_transitions st \
 *                             WHERE st.target_type='node' AND st.target_id=kn.id \
 *                             ORDER BY st.transitioned_at DESC, st.rowid DESC LIMIT 1),'draft') AS effective_status \
 *                FROM knowledge_nodes kn" > /tmp/kn.json
 *   npx wrangler d1 execute thepick-db-production --remote --json \
 *     --command "SELECT id, from_node, to_node, edge_type, is_active FROM knowledge_edges" > /tmp/ke.json
 *   pnpm tsx scripts/run-graph-integrity-production.ts --nodes /tmp/kn.json --edges /tmp/ke.json
 *
 * ★ 노드 덤프의 effective_status/valid_from/valid_until 은 **필수**다 (2026-08-07, 결정 #9 (C) §3-4).
 *   계보 불변식(구·신 동시 서빙 / 계보 공백)은 실 status·시행일 없이 판정 불가이며,
 *   판정 불가를 PASS 로 바꾸지 않는다 — 컬럼이 없으면 parseDump 가 입력 단계에서 멈춘다.
 *   effective_status 는 status_transitions 최신 전이(무이력='draft') = 서빙 단일 진실원 미러.
 *
 * fabricate 차단 (eval harness assertRemote 패턴 준용): 덤프 파일 미지정/부재/
 * 빈 결과 시 가짜 PASS 없이 명시 에러로 비측정 종료 (CLAUDE.md RULE #4/#5).
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  auditProductionGraph,
  lineageAnomalySubject,
  type D1EdgeRow,
  type D1NodeRow,
  type ProductionAuditReport,
} from '../packages/quality/src/index';
// whitelist 단일 진실원 = graph-walk (Hard Rule 15: 검색 정책 지식은 코어가 소유하지 않음).
import { DEFAULT_EDGE_TYPE_WHITELIST } from '../apps/api/src/search/graph-walk/index';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const DEFAULT_OUT_DIR = join(REPO_ROOT, 'docs/plans/master-remediation-20260610/g-ws2-integrity');

function fail(msg: string): never {
  process.stderr.write(`\n[integrity-runner] 측정 불가 — ${msg}\n`);
  process.stderr.write(
    '[integrity-runner] fabricate 차단: 덤프 없이 PASS 를 출력하지 않습니다. 헤더 사용법 참조.\n',
  );
  process.exit(1);
}

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : null;
}

/** wrangler --json 출력([{results:[...]}]) 또는 생 results 배열 양쪽 수용. */
function parseDump<T>(path: string, label: string, requiredKeys: readonly string[]): T[] {
  if (!existsSync(path)) fail(`${label} 덤프 파일 부재: ${path}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    fail(`${label} JSON parse 실패 (${String(err)}): ${path}`);
  }
  const results = Array.isArray(parsed)
    ? typeof (parsed[0] as { results?: unknown } | undefined)?.results !== 'undefined'
      ? (parsed[0] as { results: T[] }).results
      : (parsed as T[])
    : null;
  if (!Array.isArray(results) || results.length === 0) {
    fail(`${label} 결과 0행 — 덤프가 비었거나 형식 불일치: ${path}`);
  }
  // 리뷰 P3-2 흡수 — 필수 컬럼 결손을 0행 에러보다 명확한 메시지로 조기 검출
  // (컬럼 누락 덤프도 결과적으론 FAIL 방향으로 수렴하나, 진단 가능성 확보).
  const first = results[0] as Record<string, unknown>;
  const missing = requiredKeys.filter((k) => !(k in first));
  if (missing.length > 0) {
    fail(`${label} 필수 컬럼 누락 [${missing.join(', ')}] — SELECT 컬럼 목록 확인: ${path}`);
  }
  return results;
}

function main(): void {
  const nodesPath = argValue('--nodes');
  const edgesPath = argValue('--edges');
  if (nodesPath === null || edgesPath === null) {
    fail('--nodes <kn.json> --edges <ke.json> 인자 필요');
  }

  const nodeRows = parseDump<D1NodeRow>(nodesPath, 'knowledge_nodes', [
    'id',
    'type',
    'name',
    'is_current_active',
    // 계보 불변식 입력 (2026-08-07) — 없으면 판정 불가이므로 여기서 fail-loud
    'effective_status',
    'valid_from',
    'valid_until',
  ]);
  const edgeRows = parseDump<D1EdgeRow>(edgesPath, 'knowledge_edges', [
    'id',
    'from_node',
    'to_node',
    'edge_type',
    'is_active',
  ]);

  // 계보 판정 기준일 = KST 오늘 (서빙 코어 TODAY_KST_SQL 미러). 코어는 순수 유지 → 여기서 주입.
  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const report: ProductionAuditReport = auditProductionGraph(
    nodeRows,
    edgeRows,
    DEFAULT_EDGE_TYPE_WHITELIST,
    { todayKst },
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = argValue('--out') ?? DEFAULT_OUT_DIR;
  mkdirSync(outDir, { recursive: true });

  const { integrity, staleEdgeRefs, walkUnreachable, lineage, sourceQuoteCoverage, gatePass } =
    report;
  // STAGE 2 · 2-5 — "검사 통과 = 전수 검증" 착시 차단: 분모·분자를 항상 함께 노출한다.
  const coverageCell = sourceQuoteCoverage.measured
    ? `${sourceQuoteCoverage.withQuote} / ${sourceQuoteCoverage.servedTotal}` +
      ` (미보유 ${sourceQuoteCoverage.withoutQuote} = **미검증 — 검사 대상 밖**)`
    : `⚠️ 미측정 (${sourceQuoteCoverage.reason})`;
  const lineageCell = lineage.measured
    ? String(lineage.anomalies.length)
    : `⚠️ 미측정 (${lineage.reason})`;
  const md = [
    `# Production 그래프 무결성 감사 — ${stamp}`,
    '',
    `> 러너: scripts/run-graph-integrity-production.ts (read-only) / 코어: @thepick/quality production-audit`,
    `> 입력: nodes=${nodeRows.length}행 · edges=${edgeRows.length}행 / whitelist=${DEFAULT_EDGE_TYPE_WHITELIST.length}종 (graph-walk 단일 진실원)`,
    // 리뷰 P3-3 흡수 — 덤프 출처(경로·mtime) 기록: 합성/stale 덤프 산출이 실측으로
    // 오인 인용되는 경로 차단. 단 "진짜 production 인지"는 러너가 증명 불가 —
    // 덤프 생성 명령·시각의 교차 확인은 인용자 책임 (리뷰 Devil's Advocate 기록).
    `> 덤프 출처: nodes=${nodesPath} (mtime ${statSync(nodesPath).mtime.toISOString()}) · edges=${edgesPath} (mtime ${statSync(edgesPath).mtime.toISOString()})`,
    `> ⚠️ 도달불가(in-degree 0)는 1차(국소) 기준 — 유일 inbound 의 발신자가 자체 in:0 인 "시드 의존 약연결"은 본 리스트에 미포함 (P3-4 캐비엇)`,
    '',
    `## 게이트 판정 (E0-2): ${gatePass ? '✅ PASS' : '❌ FAIL'}`,
    '',
    '| 항목 | 값 |',
    '|---|---|',
    `| 활성 노드 / 전체 | ${integrity.stats.activeNodes} / ${integrity.stats.totalNodes} |`,
    `| 활성 엣지 / 전체 | ${integrity.stats.activeEdges} / ${integrity.stats.totalEdges} |`,
    `| 고아 노드 | ${integrity.stats.orphanNodes} |`,
    `| 끊긴 엣지 (부재 노드) | ${integrity.stats.brokenEdges} |`,
    `| SUPERSEDES 순환 | ${integrity.stats.supersedeCycles} |`,
    `| 활성 엣지 → 비활성 노드 (신규 검사) | ${staleEdgeRefs.length} |`,
    `| 계보 이상 (동시 서빙 / 계보 공백 / 시행창 이탈) — 기준일 ${todayKst} KST | ${lineageCell} |`,
    `| walk 도달 불가 활성 노드 (정보 지표 — 게이트 불산입) | ${walkUnreachable.length} |`,
    `| **원문 인용 보유** (STAGE 3 검사 가능 범위 — 게이트 불산입) | ${coverageCell} |`,
    '',
    '## 위반 상세',
    '',
    integrity.violations.length === 0 &&
    staleEdgeRefs.length === 0 &&
    lineage.measured &&
    lineage.anomalies.length === 0
      ? '(위반 0건)'
      : [
          ...integrity.violations.map((v) => `- [${v.type}] ${v.entityId}: ${v.message}`),
          ...staleEdgeRefs.map(
            (r) => `- [STALE_EDGE_REF] ${r.edgeId}: ${r.side} → 비활성 노드 ${r.nodeId}`,
          ),
          ...(lineage.measured
            ? lineage.anomalies.map((a) => `- [${a.type}] ${lineageAnomalySubject(a)}: ${a.detail}`)
            : [`- [LINEAGE_UNMEASURED] ${lineage.reason}`]),
        ].join('\n'),
    '',
    '## 원문 인용 커버리지 (STAGE 2 · 2-5)',
    '',
    sourceQuoteCoverage.measured
      ? `오늘 서빙되는 노드 **${sourceQuoteCoverage.servedTotal}** 중 근거 원문(\`source_quote\`) 보유 ` +
        `**${sourceQuoteCoverage.withQuote}**. 나머지 **${sourceQuoteCoverage.withoutQuote}** 는 ` +
        `STAGE 3 검사기가 **검사할 수 없는 범위** = **미검증**이다 — "위반 0건"이 "전수 검증"을 뜻하지 않는다.`
      : `⚠️ 미측정 — ${sourceQuoteCoverage.reason}`,
    '',
    '## walk 도달 불가 노드 (in-degree 0, CONCEPT-023 클래스 — BATCH 엣지 보강 후보)',
    '',
    walkUnreachable.length === 0
      ? '(없음)'
      : walkUnreachable
          .map((u) => `- ${u.nodeId} (${u.name}) — in:${u.inDegree} out:${u.outDegree}`)
          .join('\n'),
    '',
  ].join('\n');

  const mdPath = join(outDir, `integrity-${stamp}.md`);
  const jsonPath = join(outDir, `integrity-${stamp}.json`);
  writeFileSync(mdPath, md, 'utf-8');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  process.stdout.write(md);
  process.stdout.write(`\n[integrity-runner] 리포트 영속: ${mdPath}\n`);
  process.exit(gatePass ? 0 : 2);
}

main();
