/**
 * BATCH 파이프라인 Checkpoint — snapshot() 산출물.
 *
 * @runtime Node.js only — `node:fs/promises`, `node:crypto` 사용.
 *   Cloudflare Workers 진입 시 R2/KV 어댑터 주입형으로 폴리필.
 *
 * 책임:
 *   1. PipelineState 직렬화 가능한 부분을 SHA-256 으로 무결성 봉인
 *   2. `.checkpoint/{batch_run_id}.json` 로컬 파일 저장 (원자적 쓰기)
 *   3. 로드 시 무결성 검증 (변조 감지 → AC-R2)
 *   4. major version 미일치 시 거부 (AC-R5)
 *   5. JSON.parse 실패·invalid semver·shape 위반 모두 CheckpointCorruptedError 로 통합 (silent failure 차단)
 *
 * v1.1 정정 (4-Pass review):
 *   - JSON.parse SyntaxError → CheckpointCorruptedError 변환 (P1-M3)
 *   - parseMajor 실패 → CheckpointVersionMismatchError 변환 (P1-M2)
 *   - canonicalJson 에서 Date/Map/Set/BigInt 명시적 거부 (P1-m3)
 *   - 24시간 stale lock 임계 상수 추출 (P1-m2)
 *
 * 본 모듈은 D1 메타테이블(`batch_runs`) 을 직접 다루지 않는다.
 * 메타테이블 상태 전이는 recover.ts 책임 (snapshot 은 무상태 직렬화/역직렬화만).
 *
 * 근거:
 *   - docs/plans/engine-hardening/step6-recover-snapshot.plan.md
 *   - .claude/reviews/review-20260427-230149-step11-5-recover-4pass.md
 *   - VOID ENGINE DESIGN CONSTITUTION v3.0 Vol V.2 + V.4
 */

import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, writeSync } from 'node:fs';
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ExamId } from '@thepick/shared';
import type { PipelineStage } from './pipeline.js';

/** Checkpoint schema 호환성 키 — 향후 v2 도입 시 migration 의무. */
export const CHECKPOINT_SCHEMA_VERSION = 1 as const;

/** stale lock 임계 (ms) — recover() 시 사용. v3.0 Vol V.4 24시간 기본. */
export const STALE_LOCK_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** 직렬화 가능한 PipelineState 부분 — pipeline.ts 가 변환 책임 (Step 11.6 통합 단계). */
export interface PipelineStateSnapshot {
  /** 마지막으로 INSERT 한 노드 ID — Idempotency 키 (Step 5 연동) */
  readonly last_inserted_node_id: string | null;
  /** 마지막 완료 stage — recover 시 다음 stage 부터 재개 */
  readonly last_completed_stage: PipelineStage;
  /** 처리한 노드 수 (보고용) */
  readonly nodes_processed: number;
  /** 처리한 엣지 수 (보고용 — nodes 와 별도) */
  readonly edges_processed: number;
  /** Stage 별 결과 누적 — replay 안전성 검증용 */
  readonly stage_results: Readonly<
    Record<
      PipelineStage,
      { status: 'success' | 'failed' | 'skipped' | 'pending'; durationMs: number }
    >
  >;
}

/** CostMeter 상태 인계 — Step 1 통합용 옵션 필드 */
export interface CheckpointCostState {
  readonly initial_spend_usd: number;
  readonly call_count: number;
  readonly threshold_breaches: readonly {
    readonly threshold: 'soft_warn' | 'hard_throttle' | 'kill_switch';
    readonly at_spend_usd: number;
    readonly at_ratio: number;
  }[];
}

export interface BatchCheckpoint {
  readonly schema_version: typeof CHECKPOINT_SCHEMA_VERSION;
  readonly engine_name: '@thepick/batch';
  readonly engine_version: string;
  /**
   * 시험 식별자 — Year 1 한시 예외 (production-quality.md Hard Rule 17).
   *
   * Year 1: optional. 미주입 시 단일 시험 (DEFAULT_EXAM_ID) 가정.
   * Year 2 Phase 4: required + checkpoint 디렉토리 구조 변경
   *   (`{baseDir}/{exam_id}/{batch_run_id}.json`).
   *
   * 본 필드 부재가 backend-architect C-2 (`midpoint-20260428-backend.md`) 결함 정정의 핵심.
   */
  readonly exam_id?: ExamId;
  readonly batch_run_id: string;
  readonly timestamp: string;
  readonly pipeline_stage: PipelineStage;
  readonly progress: {
    readonly current_stage_index: number;
    readonly total_stages: number;
    readonly nodes_completed: number;
    readonly edges_completed: number;
  };
  readonly pipeline_state_snapshot: PipelineStateSnapshot;
  /** SHA-256 of canonical JSON of all fields above (excluding state_hash itself) */
  readonly state_hash: string;
  /** ThePick BATCH 는 자료 적재 전용 — PII 미포함 */
  readonly pii_filtered: true;
  readonly encryption: 'none';
  /** CostMeter 상태 인계 (선택 — Step 1 통합 시 활성) */
  readonly cost_state?: CheckpointCostState;
  /** 의존 체크포인트 (Phase 1 후반 multi-engine pipeline 시 활성, 현재 미구현) */
  readonly depends_on?: readonly { engine: string; checkpoint_id: string }[];
}

export class CheckpointCorruptedError extends Error {
  constructor(
    public readonly batchRunId: string,
    public readonly reason: string,
    public readonly expectedHash?: string,
    public readonly actualHash?: string,
  ) {
    super(
      `[Checkpoint] Integrity check failed for batch=${batchRunId}: ${reason}` +
        (expectedHash && actualHash
          ? ` (expected=${expectedHash.slice(0, 16)}... actual=${actualHash.slice(0, 16)}...)`
          : ''),
    );
    this.name = 'CheckpointCorruptedError';
  }
}

export class CheckpointVersionMismatchError extends Error {
  constructor(
    public readonly batchRunId: string,
    public readonly checkpointVersion: string,
    public readonly currentVersion: string,
  ) {
    super(
      `[Checkpoint] Engine version mismatch for batch=${batchRunId}. ` +
        `checkpoint=${checkpointVersion}, current=${currentVersion}. ` +
        `Major version differs — Migration guide required.`,
    );
    this.name = 'CheckpointVersionMismatchError';
  }
}

export class CheckpointNotFoundError extends Error {
  constructor(
    public readonly batchRunId: string,
    public readonly path: string,
  ) {
    super(`[Checkpoint] Not found for batch=${batchRunId} at ${path}`);
    this.name = 'CheckpointNotFoundError';
  }
}

export interface SnapshotInput {
  /** Year 1 한시 예외 — optional. Step 11.6 통합 시 always 주입 의무 (Hard Rule 16). */
  readonly examId?: ExamId;
  readonly batchRunId: string;
  readonly engineVersion: string;
  readonly currentStage: PipelineStage;
  readonly currentStageIndex: number;
  readonly totalStages: number;
  readonly snapshot: PipelineStateSnapshot;
  readonly costState?: CheckpointCostState;
  readonly clock?: () => Date;
}

/**
 * Checkpoint 객체 생성 + state_hash 계산.
 * 파일 저장은 별도 (writeCheckpoint).
 */
export function buildCheckpoint(input: SnapshotInput): BatchCheckpoint {
  // 입력 검증 — engineVersion 이 valid semver 이어야 buildCheckpoint 단계에서도 거부
  parseMajor(input.engineVersion); // throws Error('Invalid semver') if malformed

  const clock = input.clock ?? (() => new Date());
  const base: Omit<BatchCheckpoint, 'state_hash'> = {
    schema_version: CHECKPOINT_SCHEMA_VERSION,
    engine_name: '@thepick/batch',
    engine_version: input.engineVersion,
    ...(input.examId !== undefined ? { exam_id: input.examId } : {}),
    batch_run_id: input.batchRunId,
    timestamp: clock().toISOString(),
    pipeline_stage: input.currentStage,
    progress: {
      current_stage_index: input.currentStageIndex,
      total_stages: input.totalStages,
      nodes_completed: input.snapshot.nodes_processed,
      edges_completed: input.snapshot.edges_processed,
    },
    pipeline_state_snapshot: input.snapshot,
    pii_filtered: true,
    encryption: 'none',
    ...(input.costState !== undefined ? { cost_state: input.costState } : {}),
  };
  const state_hash = computeStateHash(base);
  return { ...base, state_hash };
}

/**
 * SHA-256 of canonical JSON. state_hash 자체는 제외.
 */
export function computeStateHash(
  cp: Omit<BatchCheckpoint, 'state_hash'> | BatchCheckpoint,
): string {
  const { state_hash: _ignored, ...rest } = cp as BatchCheckpoint;
  void _ignored;
  const canonical = canonicalJson(rest);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * 사전 검증 — silent collapse 위험 타입 9종 발견 시 throw + circular reference 차단.
 *
 * JSON.stringify replacer 안에서는 Date.toJSON() 이 이미 호출된 후라 늦음 — 별도 walk 필요.
 *
 * 거부 타입 (silent collapse → 의미 손실 차단):
 *   - bigint: JSON 미지원
 *   - function: JSON.stringify 시 undefined → key 누락 (silent)
 *   - symbol: JSON.stringify 시 undefined → key 누락 (silent)
 *   - Date: toJSON 변환됨, 재현 시 string 으로 들어와 재구성 불가 (P1-m3 정합)
 *   - Map/Set: JSON.stringify 시 빈 {} (silent collapse)
 *   - WeakMap/WeakSet: 동일 (silent collapse)
 *   - Promise: JSON.stringify 시 빈 {} (silent collapse, 비동기 의미 손실)
 *   - TypedArray (Uint8Array 등) + DataView: JSON.stringify 시 인덱스 키 object 로 변환 → 의미 손실
 *
 * Circular reference 차단:
 *   - visited WeakSet 으로 같은 object 재진입 시 즉시 throw — stack overflow 차단
 *   - WeakSet 은 첫 호출에서 생성, 재귀 시 동일 인스턴스 전달
 */
function assertCanonicalSafe(value: unknown, path = '$', visited?: WeakSet<object>): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return;
  }
  if (typeof value === 'bigint') {
    throw new Error(`[canonicalJson] BigInt not allowed at ${path} — use number or string`);
  }
  if (typeof value === 'function') {
    throw new Error(`[canonicalJson] Function not allowed at ${path}`);
  }
  if (typeof value === 'symbol') {
    throw new Error(
      `[canonicalJson] Symbol not allowed at ${path} — JSON.stringify silently drops symbol keys/values`,
    );
  }
  if (value instanceof Date) {
    throw new Error(
      `[canonicalJson] Date instance not allowed at ${path} — use ISO 8601 string instead`,
    );
  }
  if (value instanceof Map || value instanceof Set) {
    throw new Error(
      `[canonicalJson] Map/Set not allowed at ${path} — use plain object/array instead`,
    );
  }
  if (value instanceof WeakMap || value instanceof WeakSet) {
    throw new Error(
      `[canonicalJson] WeakMap/WeakSet not allowed at ${path} — non-enumerable, JSON serializes as {} (silent collapse)`,
    );
  }
  if (value instanceof Promise) {
    throw new Error(
      `[canonicalJson] Promise not allowed at ${path} — JSON serializes as {} (silent collapse, async semantics lost). await before snapshot.`,
    );
  }
  if (ArrayBuffer.isView(value)) {
    throw new Error(
      `[canonicalJson] TypedArray/DataView not allowed at ${path} — JSON serializes as index-keyed object (silent semantic loss). Convert to base64 string or number[].`,
    );
  }

  // Circular reference 차단 — typeof === 'object' (Array 포함) 진입 직전
  const seen = visited ?? new WeakSet<object>();
  const objValue = value as object;
  if (seen.has(objValue)) {
    throw new Error(
      `[canonicalJson] Circular reference detected at ${path} — JSON.stringify would throw, walk would stack overflow`,
    );
  }
  seen.add(objValue);

  if (Array.isArray(value)) {
    value.forEach((v, i) => assertCanonicalSafe(v, `${path}[${i}]`, seen));
    return;
  }
  if (typeof value === 'object') {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      assertCanonicalSafe((value as Record<string, unknown>)[k], `${path}.${k}`, seen);
    }
  }
}

/**
 * Canonical JSON serialization — 키 정렬 + undefined 제거 + 특수 타입 명시 거부.
 * 같은 객체는 항상 같은 문자열을 만든다 (해시 결정성).
 *
 * @throws Error Date/Map/Set/BigInt/Function 발견 시 — 사전 walk 에서 명시 거부
 *               (silent collapse 차단, P1-m3)
 */
export function canonicalJson(value: unknown): string {
  assertCanonicalSafe(value);
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        const innerValue = (v as Record<string, unknown>)[k];
        if (innerValue !== undefined) {
          sorted[k] = innerValue;
        }
      }
      return sorted;
    }
    return v;
  });
}

/**
 * writeCheckpoint / writeCheckpointSync 공용 옵션.
 *
 * Step 11.6 정정 (이연 3 처리, P1-M1):
 *   - 기본 fsync=true — power loss 시 0바이트 파일 차단
 *   - 테스트에서 fsync=false 로 끄면 page cache 만 flush (Node 기본 동작)
 */
export interface WriteCheckpointOptions {
  /** fsync(2) 강제. 기본 true (production). 테스트에서만 false 허용. */
  readonly fsync?: boolean;
}

/**
 * 원자적 쓰기 — 임시 파일에 쓰고 rename (POSIX rename 은 원자적).
 * 도중 종료해도 기존 파일이 깨지지 않는다.
 *
 * fsync 옵션 (Step 11.6, 기본 true):
 *   - 임시 파일 작성 직후 `fh.sync()` (fsync(2)) 호출 → kernel buffer → disk
 *   - rename 후 디렉토리 entry 도 fsync (POSIX 보장)
 *   - power loss / kernel panic 시 0바이트 파일 가능성 차단
 *
 * @returns 최종 파일 절대 경로
 */
export async function writeCheckpoint(
  cp: BatchCheckpoint,
  baseDir: string,
  options: WriteCheckpointOptions = {},
): Promise<string> {
  const fsync = options.fsync ?? true;
  const filePath = checkpointPath(baseDir, cp.batch_run_id);
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const content = JSON.stringify(cp, null, 2);

  if (fsync) {
    const fh = await open(tmpPath, 'w');
    try {
      await fh.writeFile(content, { encoding: 'utf8' });
      await fh.sync();
    } finally {
      await fh.close();
    }
  } else {
    await writeFile(tmpPath, content, { encoding: 'utf8' });
  }

  await rename(tmpPath, filePath);

  if (fsync) {
    const dh = await open(dir, 'r');
    try {
      await dh.sync();
    } finally {
      await dh.close();
    }
  }

  return filePath;
}

/**
 * writeCheckpoint 의 sync 버전 — SIGINT/SIGTERM handler 에서 process.exit 직전
 * await 불가하므로 별도 제공.
 *
 * Step 11.6: signal-handlers.ts 의 flushCheckpoint 콜백이 본 함수 호출.
 * 동일 무결성 보장 (fsync + dir fsync) — async 버전 결과와 비교 가능.
 *
 * @returns 최종 파일 절대 경로
 */
export function writeCheckpointSync(
  cp: BatchCheckpoint,
  baseDir: string,
  options: WriteCheckpointOptions = {},
): string {
  const fsync = options.fsync ?? true;
  const filePath = checkpointPath(baseDir, cp.batch_run_id);
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const content = JSON.stringify(cp, null, 2);

  const fd = openSync(tmpPath, 'w');
  try {
    writeSync(fd, content);
    if (fsync) fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmpPath, filePath);
  if (fsync) {
    const dfd = openSync(dir, 'r');
    try {
      fsyncSync(dfd);
    } finally {
      closeSync(dfd);
    }
  }
  return filePath;
}

/**
 * 저장된 checkpoint 로드 + 무결성 + 버전 검증.
 *
 * @throws CheckpointNotFoundError 파일 없음
 * @throws CheckpointCorruptedError SHA-256 mismatch / JSON parse fail / shape 위반 / invalid semver
 * @throws CheckpointVersionMismatchError engine_version major 다름
 */
export async function readCheckpoint(
  batchRunId: string,
  baseDir: string,
  options: {
    /** 현재 엔진 버전 — major 비교에 사용 */
    readonly currentEngineVersion: string;
    /** schema_version 불일치 시 거부 (기본 true) */
    readonly strictSchema?: boolean;
  },
): Promise<BatchCheckpoint> {
  const filePath = checkpointPath(baseDir, batchRunId);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CheckpointNotFoundError(batchRunId, filePath);
    }
    throw err;
  }

  // v1.1 정정 (P1-M3): JSON.parse 실패를 CheckpointCorruptedError 로 통합
  let parsed: BatchCheckpoint;
  try {
    parsed = JSON.parse(raw) as BatchCheckpoint;
  } catch (err) {
    throw new CheckpointCorruptedError(batchRunId, `JSON.parse failed: ${(err as Error).message}`);
  }

  // v1.1 정정 (P1-M3): runtime shape 검증 — 핵심 필드 typeof 가드
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof parsed.state_hash !== 'string' ||
    typeof parsed.engine_version !== 'string' ||
    typeof parsed.batch_run_id !== 'string' ||
    typeof parsed.pipeline_stage !== 'string'
  ) {
    throw new CheckpointCorruptedError(
      batchRunId,
      'shape mismatch — required fields missing or wrong type',
    );
  }

  // Schema 버전 검증
  if (options.strictSchema !== false && parsed.schema_version !== CHECKPOINT_SCHEMA_VERSION) {
    throw new CheckpointCorruptedError(
      batchRunId,
      `schema_version mismatch — file=${parsed.schema_version}, current=${CHECKPOINT_SCHEMA_VERSION}`,
    );
  }

  // 무결성 검증
  const expectedHash = parsed.state_hash;
  const actualHash = computeStateHash(parsed);
  if (expectedHash !== actualHash) {
    throw new CheckpointCorruptedError(
      batchRunId,
      'SHA-256 mismatch (tampered or corrupted file)',
      expectedHash,
      actualHash,
    );
  }

  // v1.1 정정 (P1-M2): parseMajor 실패를 CheckpointVersionMismatchError 로 통합
  let cpMajor: number;
  let currentMajor: number;
  try {
    cpMajor = parseMajor(parsed.engine_version);
    currentMajor = parseMajor(options.currentEngineVersion);
  } catch {
    throw new CheckpointVersionMismatchError(
      batchRunId,
      parsed.engine_version,
      options.currentEngineVersion,
    );
  }
  if (cpMajor !== currentMajor) {
    throw new CheckpointVersionMismatchError(
      batchRunId,
      parsed.engine_version,
      options.currentEngineVersion,
    );
  }

  return parsed;
}

/**
 * Checkpoint 파일 경로. baseDir 은 보통 `.checkpoint/`.
 */
export function checkpointPath(baseDir: string, batchRunId: string): string {
  // batchRunId 가 path traversal 시도 못하게 sanitize
  const safe = batchRunId.replace(/[^a-zA-Z0-9_\-.]/g, '_');
  return join(baseDir, `${safe}.json`);
}

function parseMajor(version: string): number {
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`[Checkpoint] Invalid semver: ${String(version)}`);
  }
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!m) {
    throw new Error(`[Checkpoint] Invalid semver: ${version}`);
  }
  return parseInt(m[1] as string, 10);
}
