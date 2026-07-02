#!/usr/bin/env tsx
/**
 * 산식 동기 manifest 러너 — WS-3c (MASTER_PLAN G-WS3 ⑤).
 *
 * 근거: docs/plans/formula-sync-manifest.plan.md §3.2 + 진산 결재 2026-07-02
 * (plan §9 ①②③⑥ — PITR: 정규화 B / version_year A+B / 미적재 3컬럼 A / 실행면 C /
 * 정규화 모듈 경로 (ii) 복제). run-graph-integrity-production.ts 선례 동형:
 * 순수 코어(packages/quality/src/formula-sync.ts, vitest 게이트)와 분리 —
 * 본 파일은 D1 덤프 읽기 / 리포트 쓰기 IO 만. production 쓰기 0 (read-only 대조).
 *
 * 사용 (덤프 생성 → 러너):
 *   cd apps/api
 *   npx wrangler d1 execute thepick-db-production --remote --json \
 *     --command "SELECT id, node_id, equation_template, variables_schema, version_year, \
 *       is_current_active, equation_display, expected_inputs, graceful_degradation \
 *       FROM formulas ORDER BY id" > /tmp/formulas.json
 *   pnpm --filter @thepick/quality exec tsx ../../scripts/run-formula-sync-manifest.ts \
 *     --formulas /tmp/formulas.json
 *
 * fabricate 차단 (G-WS3c-5, integrity 러너 패턴 준용): 덤프 파일 미지정/부재/빈 결과/
 * 필수 컬럼 누락 시 가짜 PASS 없이 명시 에러로 비측정 종료 (CLAUDE.md RULE #4/#5).
 *
 * ★ Hard Limit (G-WS3c-6, plan §3.3): 코드 레지스트리는 batch1~5-definitions **직수입**
 *   (formulas/index.ts 레지스트리 미경유 — 레지스트리 로드는 등록시 safeParse 를 실행
 *   하므로 회피). 대조 경로에 evaluate/compile/parse 실행 0 — 순수 문자열 대조만.
 *   formula-engine 파일은 읽기 전용 참조 (평가 경로 무접촉, plan §6).
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BATCH1_FORMULAS } from '../packages/formula-engine/src/formulas/batch1-definitions';
import { BATCH2_FORMULAS } from '../packages/formula-engine/src/formulas/batch2-definitions';
import { BATCH3_FORMULAS } from '../packages/formula-engine/src/formulas/batch3-definitions';
import { BATCH4_FORMULAS } from '../packages/formula-engine/src/formulas/batch4-definitions';
import { BATCH5_FORMULAS } from '../packages/formula-engine/src/formulas/batch5-definitions';
import {
  buildFormulaSyncManifest,
  EXPECTED_ENGINE_BACKED_FORMULA_COUNT,
  type CodeFormulaEntry,
  type D1FormulaSyncRow,
  type FormulaSyncManifest,
} from '../packages/quality/src/index';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const DEFAULT_OUT_DIR = join(
  REPO_ROOT,
  'docs/plans/master-remediation-20260610/g-ws3-formula-sync',
);

/** 덤프 필수 컬럼 — SELECT 목록과 동기 (누락 = 명시 에러, 가짜 0 카운트 차단). */
const REQUIRED_COLUMNS = [
  'id',
  'node_id',
  'equation_template',
  'variables_schema',
  'version_year',
  'is_current_active',
  'equation_display',
  'expected_inputs',
  'graceful_degradation',
] as const;

function fail(msg: string): never {
  process.stderr.write(`\n[formula-sync-runner] 측정 불가 — ${msg}\n`);
  process.stderr.write(
    '[formula-sync-runner] fabricate 차단(G-WS3c-5): 덤프 없이 결과를 출력하지 않습니다. 헤더 사용법 참조.\n',
  );
  process.exit(1);
}

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : null;
}

/** wrangler --json 출력([{results:[...]}]) 또는 생 results 배열 양쪽 수용 (integrity 러너 동형). */
function parseDump(path: string): D1FormulaSyncRow[] {
  if (!existsSync(path)) fail(`formulas 덤프 파일 부재: ${path}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    fail(`formulas JSON parse 실패 (${String(err)}): ${path}`);
  }
  const results = Array.isArray(parsed)
    ? typeof (parsed[0] as { results?: unknown } | undefined)?.results !== 'undefined'
      ? (parsed[0] as { results: unknown[] }).results
      : (parsed as unknown[])
    : null;
  if (!Array.isArray(results) || results.length === 0) {
    fail(`formulas 결과 0행 — 덤프가 비었거나 형식 불일치: ${path}`);
  }
  const first = results[0] as Record<string, unknown>;
  const missing = REQUIRED_COLUMNS.filter((k) => !(k in first));
  if (missing.length > 0) {
    fail(`formulas 필수 컬럼 누락 [${missing.join(', ')}] — SELECT 컬럼 목록 확인: ${path}`);
  }
  // 필수 컬럼 존재 검증 후 D1 row 로 확정 (integrity 러너 parseDump 동형)
  return results as D1FormulaSyncRow[];
}

/** 코드 레지스트리 사영 — batch1~5 스프레드 = formulas/index.ts ALL_FORMULAS 동일 집합. */
function collectCodeEntries(): CodeFormulaEntry[] {
  return [
    ...BATCH1_FORMULAS,
    ...BATCH2_FORMULAS,
    ...BATCH3_FORMULAS,
    ...BATCH4_FORMULAS,
    ...BATCH5_FORMULAS,
  ].map((f) => ({ id: f.id, name: f.name, equationTemplate: f.equationTemplate }));
}

function renderMarkdown(
  manifest: FormulaSyncManifest,
  stamp: string,
  dumpPath: string,
  codeById: ReadonlyMap<string, CodeFormulaEntry>,
): string {
  const { engineBacked, displayOnly, drift, unpopulatedColumns, versionYear, gate } = manifest;
  const byteMatch = engineBacked.filter((e) => e.match).length;
  const normalizedMatch = engineBacked.filter((e) => e.normalizedMatch).length;
  const yearDist = Object.entries(versionYear.d1Distribution)
    .map(([y, n]) => `${y}=${n}`)
    .join(' / ');

  return [
    `# 산식 동기 manifest — 코드 레지스트리 ↔ D1 formulas 대조 (${stamp})`,
    '',
    `> 러너: scripts/run-formula-sync-manifest.ts (read-only) / 코어: @thepick/quality formula-sync`,
    `> 입력: 코드 ${manifest.codeFormulaCount}건 (batch1~5-definitions 직수입) · D1 ${manifest.d1FormulaCount}행`,
    `> 덤프 출처: ${dumpPath} (mtime ${statSync(dumpPath).mtime.toISOString()}) — SELECT-only`,
    `> 대조 정책 (plan §4 PITR, 진산 결재 2026-07-02): 비교 키 = equation_template 단독 / 정규화 = B(공백 정규화 SHA-256, parser 스킴 (ii) 복제) / version_year = A+B(비교 제외·코드값 사문) / 미적재 3컬럼 = A(대조 제외·정직 표기)`,
    '',
    `## 게이트 판정`,
    '',
    '| 게이트 | 판정 | 근거 |',
    '|---|---|---|',
    `| G-WS3c-1 차분 정확 | ${gate.diffExact ? '✅ PASS' : '❌ FAIL'} | engineBacked ${engineBacked.length}/${EXPECTED_ENGINE_BACKED_FORMULA_COUNT} · displayOnly ${displayOnly.length} = d1 ${manifest.d1FormulaCount} − ${EXPECTED_ENGINE_BACKED_FORMULA_COUNT} |`,
    `| G-WS3c-4 (G-WS3 ⑤) 68 전수 대조 일치 | ${gate.engineBackedAllMatch ? '✅ PASS' : '❌ FAIL'} | 일치 ${normalizedMatch}/68 (byte ${byteMatch}) · template-mismatch ${drift.filter((d) => d.kind === 'template-mismatch').length} |`,
    `| 종합 (drift 0) | ${gate.pass ? '✅ PASS' : '❌ FAIL'} | drift ${gate.driftCount}건 |`,
    '',
    `> G-WS3c-2(결정성)·G-WS3c-3(drift 검출 실증)은 packages/quality vitest`,
    `> (formula-sync.test.ts) CI 게이트 소관 / G-WS3c-5(read-only·fabricate 차단)·`,
    `> G-WS3c-6(대조 경로 parse 실행 0)은 본 러너 구조 자체 (헤더 주석 참조).`,
    '',
    `## engine-backed 대조 결과 (코드 ${engineBacked.length}건)`,
    '',
    `- 일치(정규화 기준): **${normalizedMatch}건** — ${
      engineBacked
        .filter((e) => e.normalizedMatch)
        .map((e) => e.id)
        .join(', ') || '(없음)'
    }`,
    `- 불일치: **${engineBacked.length - normalizedMatch}건** (아래 drift 상세)`,
    '',
    `## drift 상세 (${drift.length}건)`,
    '',
    drift.length === 0
      ? '(drift 0건)'
      : drift
          .map((d) => {
            const eb = engineBacked.find((e) => e.id === d.id);
            const codeName = codeById.get(d.id)?.name ?? '?';
            if (d.kind === 'template-mismatch' && eb) {
              return [
                `- **${d.id}** [${d.kind}] (코드 명칭: ${codeName})`,
                `  - code: \`${eb.codeTemplate}\``,
                `  - d1:   \`${eb.d1Template ?? '(부재)'}\``,
              ].join('\n');
            }
            return `- **${d.id}** [${d.kind}]`;
          })
          .join('\n'),
    '',
    `## display-only ${displayOnly.length}건 — ★분류 결정 대기 (plan §9 ④ 미결, RULE #5)`,
    '',
    `> 코드 레지스트리 미등록 = math.js AST 평가 불가 = 정확도 기계 검증 사각 (plan §0-1).`,
    `> (a) 영구 전시 분류 vs (b) engine 승격 로드맵 — **진산 결재 전이므로 본 리포트는`,
    `> 목록만 제시하고 분류를 확정하지 않는다.**`,
    '',
    displayOnly.map((d) => `- ${d.id}: \`${d.d1Template}\``).join('\n'),
    '',
    `## 정직 표기 (대조 제외 항목)`,
    '',
    `- 미적재 3컬럼 populated 카운트 (PITR A — 대조 제외): equation_display ${unpopulatedColumns.equation_display} / expected_inputs ${unpopulatedColumns.expected_inputs} / graceful_degradation ${unpopulatedColumns.graceful_degradation} (각 /${manifest.d1FormulaCount})`,
    `- version_year (PITR A+B — 비교 제외): D1 분포 ${yearDist}. ${versionYear.codeValueNote}`,
    `- variables_schema: 코드(구조 배열) vs D1(압축 descriptor 맵) 표현 상이 → 문자열 대조 키 불가, 채움 여부만 확인 (157/157 populated 는 덤프 자체로 확인)`,
    '',
    `## 미결 결재 사항 (plan §9 — 본 리포트는 판정하지 않음)`,
    '',
    `- ④ display-only ${displayOnly.length}건 분류 — **결재 대기** ((a) 영구 전시 vs (b) engine 승격 로드맵)`,
    `- ⑤ F-55 TODO 주석 처분 (batch5-definitions.ts constraints) — **결재 대기** (본 manifest 는 처분하지 않음)`,
    `- G-WS3c-4 FAIL 시 해소 방향(코드 vs D1 어느 쪽이 진실원인가) — L3 결재 사안`,
    '',
  ].join('\n');
}

function main(): void {
  const dumpPath = argValue('--formulas');
  if (dumpPath === null) {
    fail('--formulas <formulas.json> 인자 필요');
  }

  const d1Rows = parseDump(dumpPath);
  const codeEntries = collectCodeEntries();
  const codeById = new Map(codeEntries.map((e) => [e.id, e]));

  const manifest = buildFormulaSyncManifest(codeEntries, d1Rows);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = argValue('--out') ?? DEFAULT_OUT_DIR;
  mkdirSync(outDir, { recursive: true });

  const md = renderMarkdown(manifest, stamp, dumpPath, codeById);
  const mdPath = join(outDir, `formula-sync-${stamp}.md`);
  const jsonPath = join(outDir, `formula-sync-${stamp}.json`);
  writeFileSync(mdPath, md, 'utf-8');
  writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), 'utf-8');

  process.stdout.write(md);
  process.stdout.write(`\n[formula-sync-runner] 리포트 영속: ${mdPath}\n`);
  process.exit(manifest.gate.pass ? 0 : 2);
}

main();
