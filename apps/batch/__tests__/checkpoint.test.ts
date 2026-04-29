/**
 * checkpoint.ts 단위 테스트
 *
 * 검증 범위:
 *   - buildCheckpoint() — state_hash 결정성 + canonical JSON
 *   - writeCheckpoint() / readCheckpoint() — 원자적 쓰기 + 무결성 검증 (AC-R2)
 *   - 변조 감지 (CheckpointCorruptedError)
 *   - 버전 불일치 거부 (CheckpointVersionMismatchError, AC-R5)
 *   - 파일 부재 (CheckpointNotFoundError)
 *   - canonical JSON 결정성 — 키 순서 무관, 같은 객체 = 같은 hash
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildCheckpoint,
  canonicalJson,
  CheckpointCorruptedError,
  CheckpointNotFoundError,
  CheckpointVersionMismatchError,
  CHECKPOINT_SCHEMA_VERSION,
  checkpointPath,
  computeStateHash,
  readCheckpoint,
  writeCheckpoint,
  type BatchCheckpoint,
  type PipelineStateSnapshot,
} from '../src/checkpoint.js';
import type { PipelineStage } from '../src/pipeline.js';

const ALL_STAGES: PipelineStage[] = [
  'pdf_extract',
  'section_split',
  'vision_ocr',
  'batch_structurize',
  'constants_extract',
  'db_load',
  'integrity_check',
  'human_review',
  'formula_verify',
  'qg2_gate',
];

function emptyStageResults(): PipelineStateSnapshot['stage_results'] {
  return Object.fromEntries(
    ALL_STAGES.map((s) => [s, { status: 'pending' as const, durationMs: 0 }]),
  ) as PipelineStateSnapshot['stage_results'];
}

function sampleSnapshot(): PipelineStateSnapshot {
  return {
    last_inserted_node_id: 'CONCEPT-042',
    last_completed_stage: 'db_load',
    nodes_processed: 30,
    edges_processed: 100,
    stage_results: {
      ...emptyStageResults(),
      pdf_extract: { status: 'success', durationMs: 250 },
      section_split: { status: 'success', durationMs: 1500 },
      db_load: { status: 'success', durationMs: 4000 },
    },
  };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'thepick-cp-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('buildCheckpoint — state_hash 결정성', () => {
  it('produces a checkpoint with all required fields', () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-test-001',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
      clock: () => new Date('2026-04-27T20:00:00.000Z'),
    });

    expect(cp.schema_version).toBe(CHECKPOINT_SCHEMA_VERSION);
    expect(cp.engine_name).toBe('@thepick/batch');
    expect(cp.engine_version).toBe('0.1.0');
    expect(cp.batch_run_id).toBe('BATCH-1-test-001');
    expect(cp.timestamp).toBe('2026-04-27T20:00:00.000Z');
    expect(cp.pipeline_stage).toBe('db_load');
    expect(cp.progress.current_stage_index).toBe(6);
    expect(cp.progress.nodes_completed).toBe(30);
    expect(cp.progress.edges_completed).toBe(100);
    expect(cp.pii_filtered).toBe(true);
    expect(cp.encryption).toBe('none');
    expect(cp.state_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('same input → same state_hash (determinism)', () => {
    const input = {
      batchRunId: 'B-1',
      engineVersion: '0.1.0',
      currentStage: 'db_load' as PipelineStage,
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
      clock: () => new Date('2026-04-27T20:00:00.000Z'),
    };
    const cp1 = buildCheckpoint(input);
    const cp2 = buildCheckpoint(input);
    expect(cp1.state_hash).toBe(cp2.state_hash);
  });

  it('different snapshot → different state_hash', () => {
    const baseInput = {
      batchRunId: 'B-1',
      engineVersion: '0.1.0',
      currentStage: 'db_load' as PipelineStage,
      currentStageIndex: 6,
      totalStages: 10,
      clock: () => new Date('2026-04-27T20:00:00.000Z'),
    };
    const cp1 = buildCheckpoint({ ...baseInput, snapshot: sampleSnapshot() });
    const modified = { ...sampleSnapshot(), nodes_processed: 31 };
    const cp2 = buildCheckpoint({ ...baseInput, snapshot: modified });
    expect(cp1.state_hash).not.toBe(cp2.state_hash);
  });

  it('canonical JSON ignores key order', () => {
    const a = { x: 1, y: 2, z: { b: 3, a: 4 } };
    const b = { z: { a: 4, b: 3 }, y: 2, x: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('canonical JSON drops undefined values', () => {
    const a = { x: 1, y: undefined };
    const b = { x: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});

describe('writeCheckpoint / readCheckpoint — round-trip', () => {
  it('writes and reads a checkpoint preserving all fields', async () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-rt',
      engineVersion: '0.1.0',
      currentStage: 'integrity_check',
      currentStageIndex: 7,
      totalStages: 10,
      snapshot: sampleSnapshot(),
      clock: () => new Date('2026-04-27T20:00:00.000Z'),
    });

    const filePath = await writeCheckpoint(cp, tempDir);
    expect(filePath).toBe(checkpointPath(tempDir, 'BATCH-1-rt'));

    const loaded = await readCheckpoint('BATCH-1-rt', tempDir, {
      currentEngineVersion: '0.1.0',
    });

    expect(loaded).toEqual(cp);
  });

  it('atomic write — no partial file on success', async () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-atomic',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
    });
    await writeCheckpoint(cp, tempDir);
    const raw = await readFile(checkpointPath(tempDir, 'BATCH-1-atomic'), 'utf8');
    const parsed = JSON.parse(raw) as BatchCheckpoint;
    expect(parsed.state_hash).toBe(cp.state_hash);
  });
});

describe('readCheckpoint — AC-R2: 변조 감지', () => {
  it('throws CheckpointCorruptedError when state_hash modified', async () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-tamper',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
    });
    await writeCheckpoint(cp, tempDir);

    // 외부에서 nodes_processed 를 수정 (state_hash 는 그대로)
    const filePath = checkpointPath(tempDir, 'BATCH-1-tamper');
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as BatchCheckpoint;
    const tampered = {
      ...raw,
      pipeline_state_snapshot: {
        ...raw.pipeline_state_snapshot,
        nodes_processed: 999, // 변조
      },
    };
    await writeFile(filePath, JSON.stringify(tampered, null, 2), 'utf8');

    await expect(
      readCheckpoint('BATCH-1-tamper', tempDir, { currentEngineVersion: '0.1.0' }),
    ).rejects.toBeInstanceOf(CheckpointCorruptedError);
  });

  it('CheckpointCorruptedError exposes expected/actual hashes', async () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-tamper2',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
    });
    await writeCheckpoint(cp, tempDir);

    const filePath = checkpointPath(tempDir, 'BATCH-1-tamper2');
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as BatchCheckpoint;
    const tampered = { ...raw, pipeline_stage: 'qg2_gate' as PipelineStage };
    await writeFile(filePath, JSON.stringify(tampered, null, 2), 'utf8');

    try {
      await readCheckpoint('BATCH-1-tamper2', tempDir, {
        currentEngineVersion: '0.1.0',
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CheckpointCorruptedError);
      const e = err as CheckpointCorruptedError;
      expect(e.batchRunId).toBe('BATCH-1-tamper2');
      expect(e.expectedHash).toBe(cp.state_hash);
      expect(e.actualHash).not.toBe(cp.state_hash);
    }
  });
});

describe('readCheckpoint — AC-R5: 버전 불일치', () => {
  it('throws CheckpointVersionMismatchError on major version diff', async () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-ver',
      engineVersion: '1.0.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
    });
    await writeCheckpoint(cp, tempDir);

    await expect(
      readCheckpoint('BATCH-1-ver', tempDir, { currentEngineVersion: '2.0.0' }),
    ).rejects.toBeInstanceOf(CheckpointVersionMismatchError);
  });

  it('allows minor version difference within same major', async () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-minor',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
    });
    await writeCheckpoint(cp, tempDir);

    // 0.1.0 → 0.2.0 (minor) 는 허용
    const loaded = await readCheckpoint('BATCH-1-minor', tempDir, {
      currentEngineVersion: '0.2.0',
    });
    expect(loaded.batch_run_id).toBe('BATCH-1-minor');
  });
});

describe('readCheckpoint — 파일 부재', () => {
  it('throws CheckpointNotFoundError on missing file', async () => {
    await expect(
      readCheckpoint('BATCH-NONEXISTENT', tempDir, { currentEngineVersion: '0.1.0' }),
    ).rejects.toBeInstanceOf(CheckpointNotFoundError);
  });
});

describe('checkpointPath — path traversal sanitize', () => {
  it('removes special chars from batchRunId', () => {
    expect(checkpointPath('/tmp', '../../etc/passwd')).toBe('/tmp/.._.._etc_passwd.json');
    expect(checkpointPath('/tmp', 'BATCH-1/sub')).toBe('/tmp/BATCH-1_sub.json');
  });

  it('preserves safe chars (alphanumeric + _-.)', () => {
    expect(checkpointPath('/tmp', 'BATCH-1.test_run-001')).toBe('/tmp/BATCH-1.test_run-001.json');
  });
});

describe('computeStateHash — canonical determinism', () => {
  it('hash is independent of state_hash field itself', () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-hash',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
    });
    // re-compute → 같은 값
    const recomputed = computeStateHash(cp);
    expect(recomputed).toBe(cp.state_hash);
  });
});

// === v1.1 정정 (4-Pass review) — P1-M2/M3 검증 ===

describe('readCheckpoint — P1-M3: JSON.parse 실패 → CheckpointCorruptedError', () => {
  it('throws CheckpointCorruptedError on broken JSON', async () => {
    const filePath = checkpointPath(tempDir, 'BATCH-1-broken-json');
    await mkdtemp(join(tmpdir(), 'thepick-cp-broken-')); // ensure dir
    await rm(filePath, { force: true });
    // Manual write of broken JSON
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '{ "broken": INVALID }', 'utf8');

    try {
      await readCheckpoint('BATCH-1-broken-json', tempDir, {
        currentEngineVersion: '0.1.0',
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CheckpointCorruptedError);
      expect((err as CheckpointCorruptedError).reason).toContain('JSON.parse failed');
    }
  });

  it('throws CheckpointCorruptedError on shape mismatch (missing fields)', async () => {
    const filePath = checkpointPath(tempDir, 'BATCH-1-shape');
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '{"foo": "bar"}', 'utf8');

    try {
      await readCheckpoint('BATCH-1-shape', tempDir, { currentEngineVersion: '0.1.0' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CheckpointCorruptedError);
      expect((err as CheckpointCorruptedError).reason).toContain('shape mismatch');
    }
  });

  it('throws CheckpointCorruptedError on schema_version mismatch', async () => {
    // Build a valid checkpoint but with wrong schema_version stamped after write
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-sv',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
    });
    await writeCheckpoint(cp, tempDir);

    // Manually rewrite with bad schema_version
    const filePath = checkpointPath(tempDir, 'BATCH-1-sv');
    const { writeFile } = await import('node:fs/promises');
    const tampered = { ...cp, schema_version: 99 };
    await writeFile(filePath, JSON.stringify(tampered, null, 2), 'utf8');

    await expect(
      readCheckpoint('BATCH-1-sv', tempDir, { currentEngineVersion: '0.1.0' }),
    ).rejects.toBeInstanceOf(CheckpointCorruptedError);
  });
});

describe('readCheckpoint — P1-M2: parseMajor 실패 → VersionMismatchError', () => {
  it('throws VersionMismatchError when checkpoint engine_version is invalid semver', async () => {
    // Build with valid version, then tamper engine_version to bogus value (state_hash 도 재계산)
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-bad-ver',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: sampleSnapshot(),
    });
    // Rewrite with bogus version + recompute hash
    const tampered = { ...cp, engine_version: 'not-a-version' };
    const { computeStateHash } = await import('../src/checkpoint.js');
    const newHash = computeStateHash(tampered);
    const final = { ...tampered, state_hash: newHash };
    await writeCheckpoint(final, tempDir);

    await expect(
      readCheckpoint('BATCH-1-bad-ver', tempDir, { currentEngineVersion: '0.1.0' }),
    ).rejects.toBeInstanceOf(CheckpointVersionMismatchError);
  });
});

describe('canonicalJson — P1-m3: 특수 타입 명시 거부', () => {
  it('throws on Date instance', () => {
    expect(() => canonicalJson({ ts: new Date('2026-04-27') })).toThrow(/Date/);
  });

  it('throws on Map', () => {
    expect(() => canonicalJson({ m: new Map([['k', 'v']]) })).toThrow(/Map/);
  });

  it('throws on Set', () => {
    expect(() => canonicalJson({ s: new Set([1, 2]) })).toThrow(/Set/);
  });

  it('throws on BigInt', () => {
    expect(() => canonicalJson({ b: BigInt(123) })).toThrow(/BigInt/);
  });

  it('throws on Function', () => {
    expect(() => canonicalJson({ f: () => 1 })).toThrow(/Function/);
  });
});

describe('STALE_LOCK_THRESHOLD_MS — exported constant', () => {
  it('equals 24 hours in ms', async () => {
    const { STALE_LOCK_THRESHOLD_MS } = await import('../src/checkpoint.js');
    expect(STALE_LOCK_THRESHOLD_MS).toBe(24 * 60 * 60 * 1000);
  });
});

// ===========================================================================
// Step 11.6 §7 AC-Snapshot — 9종 + circular 거부 (Q-C1 13 케이스)
// ===========================================================================
describe('canonicalJson — AC-Snapshot 추가 6종 거부 (Q-C1)', () => {
  it('throws on Symbol value', () => {
    expect(() => canonicalJson({ x: Symbol('x') })).toThrow(/Symbol not allowed/);
  });

  it('throws에 path 표시 — deeply nested 위치 (plan §7 AC-Snapshot 의무)', () => {
    // plan §7 AC-Snapshot: "throw + 명확한 path 표시 (예: $.contract.meta.tag)"
    // 회귀 차단 — assertCanonicalSafe 가 path 추적 누락 시 본 검증 fail
    const nested = { contract: { meta: { tag: Symbol('x') } } };
    let caught: unknown;
    try {
      canonicalJson(nested);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('Symbol not allowed at $.contract.meta.tag');
  });

  it('throws에 path 표시 — array index (Date instance 의 array 위치)', () => {
    // arr[2] Date instance → path 가 $.arr[2] 표시 의무
    const obj = { arr: [1, 2, new Date('2026-01-01')] };
    let caught: unknown;
    try {
      canonicalJson(obj);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('Date instance not allowed at $.arr[2]');
  });

  it('throws on WeakMap', () => {
    expect(() => canonicalJson({ wm: new WeakMap() })).toThrow(/WeakMap\/WeakSet not allowed/);
  });

  it('throws on WeakSet', () => {
    expect(() => canonicalJson({ ws: new WeakSet() })).toThrow(/WeakMap\/WeakSet not allowed/);
  });

  it('throws on Promise (resolved)', () => {
    expect(() => canonicalJson({ p: Promise.resolve(1) })).toThrow(/Promise not allowed/);
  });

  it('throws on Promise (pending)', () => {
    const pending = new Promise(() => {
      /* never resolves */
    });
    expect(() => canonicalJson({ p: pending })).toThrow(/Promise not allowed/);
  });

  it('throws on Uint8Array (TypedArray)', () => {
    expect(() => canonicalJson({ arr: new Uint8Array([1, 2, 3]) })).toThrow(
      /TypedArray\/DataView not allowed/,
    );
  });

  it('throws on Float64Array (TypedArray)', () => {
    expect(() => canonicalJson({ arr: new Float64Array([1.1, 2.2]) })).toThrow(
      /TypedArray\/DataView not allowed/,
    );
  });

  it('throws on DataView', () => {
    expect(() => canonicalJson({ dv: new DataView(new ArrayBuffer(8)) })).toThrow(
      /TypedArray\/DataView not allowed/,
    );
  });

  it('throws on Buffer (Node — TypedArray subclass)', () => {
    expect(() => canonicalJson({ buf: Buffer.from('hello') })).toThrow(
      /TypedArray\/DataView not allowed/,
    );
  });
});

describe('canonicalJson — circular reference 거부', () => {
  it('throws on self-reference', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(() => canonicalJson(obj)).toThrow(/Circular reference detected/);
  });

  it('throws on mutual reference (a → b → a)', () => {
    const a: Record<string, unknown> = { name: 'a' };
    const b: Record<string, unknown> = { name: 'b' };
    a.next = b;
    b.next = a;
    expect(() => canonicalJson({ a, b })).toThrow(/Circular reference detected/);
  });

  it('throws on deep circular (a.b.c.parent → a)', () => {
    const a: Record<string, unknown> = { name: 'a' };
    const b: Record<string, unknown> = { name: 'b' };
    const c: Record<string, unknown> = { name: 'c' };
    a.b = b;
    b.c = c;
    c.parent = a;
    expect(() => canonicalJson(a)).toThrow(/Circular reference detected/);
  });
});

describe('canonicalJson — diamond DAG false-positive 차단 (sibling reference 허용)', () => {
  it('shared object referenced by 2 siblings → no throw', () => {
    const shared = { value: 42 };
    const obj = { left: shared, right: shared };
    // 같은 plain object 가 sibling 2개에서 참조 — circular 아님 (DAG)
    // 본 테스트가 false-positive 차단의 핵심 (Q-C1 §"diamond DAG")
    expect(() => canonicalJson(obj)).not.toThrow();
  });

  it('shared array referenced by 2 fields → no throw', () => {
    const shared = [1, 2, 3];
    expect(() => canonicalJson({ a: shared, b: shared })).not.toThrow();
  });

  it('PIPELINE_STAGES.map → 매 entry 새 object literal — sibling reference 미발생 (toSnapshot 패턴)', () => {
    // toSnapshot 의 stage_results 패턴 모방 — 매 entry 가 새 object literal
    const stages = ['s1', 's2', 's3'] as const;
    const obj = {
      stage_results: Object.fromEntries(
        stages.map((s) => [s, { status: 'success', durationMs: 100 }]),
      ),
    };
    expect(() => canonicalJson(obj)).not.toThrow();
  });
});

// ===========================================================================
// Step 11.6 AC-R5 — fsync 옵션
// ===========================================================================
describe('writeCheckpoint — AC-R5 fsync 옵션', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'cp-fsync-'));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('fsync=true (production 기본) → 파일 valid + readCheckpoint 통과', async () => {
    const cp = buildSampleCheckpoint();
    const path = await writeCheckpoint(cp, baseDir, { fsync: true });
    const loaded = await readCheckpoint(cp.batch_run_id, baseDir, {
      currentEngineVersion: '0.1.0',
    });
    expect(loaded.state_hash).toBe(cp.state_hash);
    expect(typeof path).toBe('string');
  });

  it('fsync=false (테스트 모드) → 동일하게 readCheckpoint 통과 (성능 차이만)', async () => {
    const cp = buildSampleCheckpoint();
    await writeCheckpoint(cp, baseDir, { fsync: false });
    const loaded = await readCheckpoint(cp.batch_run_id, baseDir, {
      currentEngineVersion: '0.1.0',
    });
    expect(loaded.state_hash).toBe(cp.state_hash);
  });

  it('fsync 옵션 미지정 → 기본 true (production safe)', async () => {
    const cp = buildSampleCheckpoint();
    // option object 자체 미주입 → 내부 default fsync=true
    await writeCheckpoint(cp, baseDir);
    const loaded = await readCheckpoint(cp.batch_run_id, baseDir, {
      currentEngineVersion: '0.1.0',
    });
    expect(loaded.state_hash).toBe(cp.state_hash);
  });
});

function buildSampleCheckpoint() {
  const snapshot: PipelineStateSnapshot = {
    last_inserted_node_id: null,
    last_completed_stage: 'db_load',
    nodes_processed: 10,
    edges_processed: 20,
    stage_results: Object.fromEntries(
      ALL_STAGES.map((s) => [s, { status: 'success', durationMs: 50 }]),
    ) as PipelineStateSnapshot['stage_results'],
  };
  return buildCheckpoint({
    batchRunId: 'fsync-test-' + Math.random().toString(36).slice(2, 10),
    engineVersion: '0.1.0',
    currentStage: 'db_load',
    currentStageIndex: 5,
    totalStages: 10,
    snapshot,
  });
}
