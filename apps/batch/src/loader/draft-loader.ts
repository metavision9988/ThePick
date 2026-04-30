/**
 * Draft Loader — 검증된 KnowledgeContract 를 D1 의 4개 테이블에 status='draft' 로 적재.
 *
 * 계약:
 *   - 입력은 반드시 `validateKnowledgeContract` 를 통과한 Contract (Ontology Lock 등).
 *   - 적재 전 추가 방어선: page_ref 유효성, versionYear 주입.
 *   - D1 batch() 기반 원자적 적재 — 실패 시 전체 rollback 시도 (D1 제한 내).
 *   - idempotent: 동일 id 이미 존재하면 INSERT OR IGNORE 로 skip, 결과에 skippedIds 누적.
 *   - status 전이 기록 없음: 초기 INSERT 의 draft 는 "from 상태 없음" 이므로 transition 로그 미생성.
 *
 * 비스코프 (Step 1-5 가-0):
 *   - SUPERSEDES 엣지 자동 생성 (가-1 에서 revision-detector 결과와 결합)
 *   - vectorize 업서트 (가-1 이후)
 *   - 검수자(reviewerId) 경로는 '상태 머신' 모듈(C2) 에서만 사용
 */

import type { KnowledgeContract } from '@thepick/parser';
import { isValidNodeId } from '@thepick/parser';
import type { NodeType } from '@thepick/shared';
import { buildSourceId } from './build-source-id.js';

/**
 * batchRunId 안전 패턴 — 영숫자 + `-` + `_` 8~128자.
 *
 * Pass 3 M-1 (Phase 이월 부채) 흡수 — 외부 trigger 추가 시 임의 문자열 주입 차단.
 * UUID v4 strict 패턴 (`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`)
 * 은 test fixture (`batch-run-test-0001` 등) 차단하므로 safe identifier 패턴 채택.
 */
const BATCH_RUN_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

export interface LoadDraftContext {
  /** BATCH 식별자 — knowledge_nodes.batch_id 에 그대로 저장. */
  readonly batchId: string;
  /**
   * 1회 BATCH 실행 UUID — knowledge_nodes.batch_run_id 에 저장.
   * `(batch_run_id, source_id)` partial UNIQUE 키 구성 — 동시 트리거 시 중복 INSERT 차단.
   * Step 5 plan v1.1 §"v1.1 명시 이연" 흡수.
   */
  readonly batchRunId: string;
  /** 교재 판본 연도 — 모든 테이블 version_year 에 주입. */
  readonly versionYear: number;
  /** 배치 기본 페이지 범위 (source_page 누락 시 fallback 은 사용하지 않고 검증 실패로 전환). */
  readonly pageRangeStart: number;
  readonly pageRangeEnd: number;
  /** Contract 내 상수의 applies_to 기본값 — per-constant 미지정 시 사용. 예: '적과전종합위험'. */
  readonly defaultAppliesTo: string;
  /** (optional) 상수 노드 링크 — page 에 출제되는 작물. */
  readonly defaultInsuranceType?: string;
}

export interface LoadDraftResult {
  readonly nodesInserted: number;
  readonly edgesInserted: number;
  readonly formulasInserted: number;
  readonly constantsInserted: number;
  readonly skippedIds: readonly string[];
  readonly durationMs: number;
  /**
   * 마지막으로 INSERT 한 노드 ID — Step 11.6 checkpoint Idempotency 키.
   * 본 필드는 Step 5 코드 진입 시 deterministic 적재 흐름에서 채워진다.
   * 미주입 시 caller(toSnapshot)는 contract.nodes 마지막을 폴백으로 사용.
   */
  readonly lastInsertedNodeId?: string;
}

export class DraftLoadError extends Error {
  readonly phase: 'validate' | 'batch';
  readonly failedStatement?: string;
  constructor(message: string, phase: 'validate' | 'batch', failedStatement?: string) {
    super(message);
    this.name = 'DraftLoadError';
    this.phase = phase;
    this.failedStatement = failedStatement;
  }
}

/**
 * 로컬 테스트 wrapper(d1-from-sqlite.ts) 와 실제 Workers D1 모두 호환되는 최소 인터페이스.
 * 타입 확장은 각 환경에서 자유롭지만 필수 호출 형태(prepare/bind/run/first/batch) 는 고정.
 */
export interface D1Stmt {
  bind(...args: unknown[]): D1Stmt;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1AllResult<T>>;
  run<T = unknown>(): Promise<D1RunResult<T>>;
}
export interface D1AllResult<T> {
  success: boolean;
  results: T[];
}
export interface D1RunResult<T> {
  success: boolean;
  results: T[];
  meta: { changes: number; last_row_id: number } & Record<string, unknown>;
}
export interface D1Db {
  prepare(sql: string): D1Stmt;
  batch<T = unknown>(statements: D1Stmt[]): Promise<Array<D1RunResult<T>>>;
}

/**
 * draft 적재 진입점.
 */
export async function loadDraft(
  db: D1Db,
  contract: KnowledgeContract,
  ctx: LoadDraftContext,
): Promise<LoadDraftResult> {
  const startedAt = Date.now();

  preValidate(contract, ctx);

  // 기존 ID 조회 (idempotent 구현 — DB 트리거/UNIQUE 에 앞선 애플리케이션 레벨 skip)
  const existing = await queryExistingIds(db, contract);

  const skippedIds: string[] = [];
  const nodeStmts = buildNodeInserts(db, contract, ctx, existing.nodes, skippedIds);
  const edgeStmts = buildEdgeInserts(db, contract, existing.edges, skippedIds);
  const formulaStmts = buildFormulaInserts(db, contract, ctx, existing.formulas, skippedIds);
  const constantStmts = buildConstantInserts(db, contract, ctx, existing.constants, skippedIds);

  const all = [...nodeStmts, ...edgeStmts, ...formulaStmts, ...constantStmts];

  if (all.length === 0) {
    return {
      nodesInserted: 0,
      edgesInserted: 0,
      formulasInserted: 0,
      constantsInserted: 0,
      skippedIds,
      durationMs: Date.now() - startedAt,
    };
  }

  try {
    await db.batch(all);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DraftLoadError(`D1 batch insert failed: ${msg}`, 'batch');
  }

  return {
    nodesInserted: nodeStmts.length,
    edgesInserted: edgeStmts.length,
    formulasInserted: formulaStmts.length,
    constantsInserted: constantStmts.length,
    skippedIds,
    durationMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// Pre-validation (DB 적재 이전 애플리케이션 레벨 방어선)
// ---------------------------------------------------------------------------

function preValidate(contract: KnowledgeContract, ctx: LoadDraftContext): void {
  if (!ctx.batchId || ctx.batchId.trim() === '') {
    throw new DraftLoadError('batchId is required', 'validate');
  }
  if (!ctx.batchRunId || ctx.batchRunId.trim() === '') {
    throw new DraftLoadError(
      'batchRunId is required (Step 5 plan v1.1 idempotency 키 부재 차단)',
      'validate',
    );
  }
  if (!BATCH_RUN_ID_PATTERN.test(ctx.batchRunId)) {
    throw new DraftLoadError(
      `batchRunId must match safe identifier pattern (^[a-zA-Z0-9_-]{8,128}$). got '${ctx.batchRunId}' (Pass 3 M-1 흡수).`,
      'validate',
    );
  }
  if (!Number.isInteger(ctx.versionYear) || ctx.versionYear < 2020) {
    throw new DraftLoadError(`versionYear must be >= 2020, got ${ctx.versionYear}`, 'validate');
  }
  if (!ctx.defaultAppliesTo || ctx.defaultAppliesTo.trim() === '') {
    throw new DraftLoadError(
      'defaultAppliesTo is required (constants.applies_to 기본값)',
      'validate',
    );
  }

  for (const n of contract.nodes) {
    if (!Number.isInteger(n.source_page) || n.source_page <= 0) {
      throw new DraftLoadError(
        `node ${n.id} has invalid source_page (${n.source_page}) — 북극성 출처 추적성 위반`,
        'validate',
      );
    }
    // Pass 3 M-2 (Phase 이월 부채) 흡수 — schema-validator 우회 fixture 차단을 위한 이중 방어.
    // ontology-registry.json 패턴 (CONCEPT-NNN / F-NN / INS-NN / CROP-NNN / LAW-NNN / INV-NNN / TERM-NNN) 강제.
    if (!isValidNodeId(n.type as NodeType, n.id)) {
      throw new DraftLoadError(
        `node ${n.id} of type ${n.type} does not match ontology-registry pattern (Pass 3 M-2 흡수)`,
        'validate',
      );
    }
  }
  for (const f of contract.formulas) {
    if (!Number.isInteger(f.source_page) || f.source_page <= 0) {
      throw new DraftLoadError(
        `formula ${f.id} has invalid source_page (${f.source_page})`,
        'validate',
      );
    }
  }
  for (const c of contract.constants) {
    if (!Number.isInteger(c.source_page) || c.source_page <= 0) {
      throw new DraftLoadError(
        `constant ${c.id} has invalid source_page (${c.source_page})`,
        'validate',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Existing ID lookup (idempotent skip 지원)
// ---------------------------------------------------------------------------

interface ExistingIdSets {
  nodes: Set<string>;
  edges: Set<string>;
  formulas: Set<string>;
  constants: Set<string>;
}

async function queryExistingIds(db: D1Db, contract: KnowledgeContract): Promise<ExistingIdSets> {
  return {
    nodes: await selectIds(
      db,
      'knowledge_nodes',
      contract.nodes.map((n) => n.id),
    ),
    edges: await selectEdgeIds(db, contract.edges),
    formulas: await selectIds(
      db,
      'formulas',
      contract.formulas.map((f) => f.id),
    ),
    constants: await selectIds(
      db,
      'constants',
      contract.constants.map((c) => c.id),
    ),
  };
}

async function selectIds(db: D1Db, table: string, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set<string>();
  const placeholders = ids.map(() => '?').join(',');
  const sql = `SELECT id FROM ${table} WHERE id IN (${placeholders})`;
  const result = await db
    .prepare(sql)
    .bind(...ids)
    .all<{ id: string }>();
  const set = new Set<string>();
  for (const row of result.results ?? []) {
    set.add(row.id);
  }
  return set;
}

async function selectEdgeIds(
  db: D1Db,
  edges: ReadonlyArray<{ source_id: string; target_id: string; edge_type: string }>,
): Promise<Set<string>> {
  const ids = edges.map(edgeIdOf);
  return selectIds(db, 'knowledge_edges', ids);
}

function edgeIdOf(edge: { source_id: string; target_id: string; edge_type: string }): string {
  // 결정론적 id — 동일 (source, target, type) 조합은 동일 ID → idempotent 보장
  return `E-${edge.source_id}-${edge.edge_type}-${edge.target_id}`;
}

// ---------------------------------------------------------------------------
// Insert statements
// ---------------------------------------------------------------------------

function buildNodeInserts(
  db: D1Db,
  contract: KnowledgeContract,
  ctx: LoadDraftContext,
  existing: Set<string>,
  skipped: string[],
): D1Stmt[] {
  const stmts: D1Stmt[] = [];
  const sql = `
    INSERT OR IGNORE INTO knowledge_nodes
      (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation,
       page_ref, batch_id, batch_run_id, source_id, version_year, truth_weight, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `;
  for (const node of contract.nodes) {
    if (existing.has(node.id)) {
      skipped.push(node.id);
      continue;
    }
    const pageRef = pageRefString(node.source_page);
    stmts.push(
      db
        .prepare(sql)
        .bind(
          node.id,
          node.type,
          node.title,
          node.content,
          node.lv1_insurance ?? null,
          node.lv2_crop ?? null,
          node.lv3_investigation ?? null,
          pageRef,
          ctx.batchId,
          ctx.batchRunId,
          buildSourceId(pageRef, node.id),
          ctx.versionYear,
          node.truth_weight,
        ),
    );
  }
  return stmts;
}

function buildEdgeInserts(
  db: D1Db,
  contract: KnowledgeContract,
  existing: Set<string>,
  skipped: string[],
): D1Stmt[] {
  const stmts: D1Stmt[] = [];
  const sql = `
    INSERT OR IGNORE INTO knowledge_edges
      (id, from_node, to_node, edge_type, condition, priority, is_active)
    VALUES (?, ?, ?, ?, ?, 0, 1)
  `;
  for (const edge of contract.edges) {
    const id = edgeIdOf(edge);
    if (existing.has(id)) {
      skipped.push(id);
      continue;
    }
    stmts.push(
      db
        .prepare(sql)
        .bind(id, edge.source_id, edge.target_id, edge.edge_type, edge.condition ?? null),
    );
  }
  return stmts;
}

function buildFormulaInserts(
  db: D1Db,
  contract: KnowledgeContract,
  ctx: LoadDraftContext,
  existing: Set<string>,
  skipped: string[],
): D1Stmt[] {
  const stmts: D1Stmt[] = [];
  const sql = `
    INSERT OR IGNORE INTO formulas
      (id, name, equation_template, variables_schema, page_ref, version_year)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  for (const formula of contract.formulas) {
    if (existing.has(formula.id)) {
      skipped.push(formula.id);
      continue;
    }
    stmts.push(
      db
        .prepare(sql)
        .bind(
          formula.id,
          formula.name,
          formula.equation_template,
          formula.variables_schema,
          pageRefString(formula.source_page),
          ctx.versionYear,
        ),
    );
  }
  return stmts;
}

function buildConstantInserts(
  db: D1Db,
  contract: KnowledgeContract,
  ctx: LoadDraftContext,
  existing: Set<string>,
  skipped: string[],
): D1Stmt[] {
  const stmts: D1Stmt[] = [];
  const sql = `
    INSERT OR IGNORE INTO constants
      (id, category, name, value, applies_to, insurance_type, page_ref, version_year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  for (const constant of contract.constants) {
    if (existing.has(constant.id)) {
      skipped.push(constant.id);
      continue;
    }
    stmts.push(
      db
        .prepare(sql)
        .bind(
          constant.id,
          constant.category,
          constant.name,
          constant.value,
          ctx.defaultAppliesTo,
          ctx.defaultInsuranceType ?? null,
          pageRefString(constant.source_page),
          ctx.versionYear,
        ),
    );
  }
  return stmts;
}

/** source_page(number) → page_ref("NNN") 변환. 양의 정수 가정 (preValidate 통과 후 진입). */
function pageRefString(page: number): string {
  return String(page);
}
