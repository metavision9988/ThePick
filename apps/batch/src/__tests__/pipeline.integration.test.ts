/**
 * pipeline.integration 테스트 — Stage 1~9 end-to-end 실행.
 *
 * 경로 구분 (CR-5b 리뷰 이후):
 *   - fixture 모드 (Stage 1~3 skipped): contract 직접 주입. Stage 4~9 만 실경로 검증.
 *     → "full E2E 검증"이 아니라 "structurize 이후 파이프라인 검증"에 한정된다.
 *   - 합성 대규모 fixture: Stage 4~9 전부 success, qg2Passed=true.
 *   - **non-fixture 모드** (CR-5b 신규): pdfPagesOverride + mock ClaudeClient 로 Stage 1
 *     은 injected, Stage 2 (section_split) / Stage 3 (batch_structurize) 는 **실경로**
 *     수행. fixture 우회 착시를 차단한다.
 *   - 실패 경로: invalid contract → Stage 3 FAIL, 이후 skipped.
 *
 * 100% 진짜 E2E (실 PDF + 실 Claude API) 는 가-1 ADR 대상이며 본 테스트 범위 외.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import type { KnowledgeContract, ClaudeClient, ClaudeResponse } from '@thepick/parser';
import { EXAM_IDS } from '@thepick/shared';
import type { ExamId } from '@thepick/shared';
import {
  runPipeline,
  BATCH_CONFIGS,
  ConcurrentRunError,
  RecoveryFailedError,
  PIPELINE_STAGES,
} from '../pipeline';
import type { PipelineContext } from '../pipeline';
import { InMemoryBatchRunsDb } from '../in-memory-batch-runs-db';
import {
  buildCheckpoint,
  writeCheckpoint,
  computeStateHash,
  checkpointPath,
  type PipelineStateSnapshot,
} from '../checkpoint';
import type { GoldenTestCase } from '../qg2-validator';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

/**
 * Step 11.6 통합 후 PipelineContext 가 요구하는 신규 5개 required 필드 + 2개 optional
 * 의 테스트 기본값. checkpointBaseDir 는 mkdtempSync 격리 디렉터리 사용.
 *
 * enableSignalHandlers=false: vitest 환경에서 process.exit 차단
 * fsyncCheckpoint=false: 테스트 속도 + 플랫폼 호환
 */
const TEST_ENGINE_VERSION = '0.1.0';

function step116TestFields(outDir: string) {
  return {
    examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
    batchRunId: randomUUID(),
    checkpointBaseDir: outDir,
    batchRunsDb: new InMemoryBatchRunsDb(),
    engineVersion: TEST_ENGINE_VERSION,
    enableSignalHandlers: false,
    fsyncCheckpoint: false,
  } as const;
}

function loadSampleContract(): KnowledgeContract {
  const raw = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'batch-1-sample-extract.json'), 'utf-8'),
  ) as { contract: KnowledgeContract };
  return raw.contract;
}

function loadGoldenTests(): readonly GoldenTestCase[] {
  const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'batch-1-golden.json'), 'utf-8')) as {
    tests: GoldenTestCase[];
  };
  return raw.tests;
}

/** 합성 contract — 40 노드 / 80 엣지로 QG-2 규모 조건 충족 */
function syntheticLargeContract(): KnowledgeContract {
  const nodes = Array.from({ length: 40 }, (_, i) => ({
    id: `CONCEPT-${String(i + 1).padStart(3, '0')}`,
    type: 'CONCEPT',
    title: `노드 ${i + 1}`,
    content: `설명 ${i + 1}`,
    truth_weight: 5,
    source_page: 403 + (i % 32),
  }));

  const edges = [] as KnowledgeContract['edges'];
  for (let i = 0; i < 80; i++) {
    const from = i % 40;
    const to = (i + 1) % 40;
    edges.push({
      source_id: nodes[from].id,
      target_id: nodes[to].id,
      edge_type: 'DEPENDS_ON',
    });
  }

  return {
    nodes,
    edges,
    formulas: [
      {
        id: 'F-01',
        name: '유과타박률',
        equation_template: 'damaged / (damaged + normal)',
        variables_schema: '{"damaged":"number","normal":"number"}',
        source_page: 414,
      },
    ],
    constants: [
      {
        id: 'CONST-001',
        name: '자기부담비율',
        value: '0.20',
        category: 'deductible',
        source_page: 405,
      },
    ],
  };
}

describe('runPipeline — fixture mode (소규모 real fixture)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-batch-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('Stage 1~3 skipped (fixture mode), Stage 4~8 success, Stage 9 FAIL (규모 부족)', async () => {
    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: loadGoldenTests(),
      versionYear: 2026,
      fixtureContract: loadSampleContract(),
      ...step116TestFields(outDir),
    };

    const result = await runPipeline(ctx);
    const stageByName = Object.fromEntries(result.stages.map((s) => [s.stage, s]));

    expect(stageByName.pdf_extract.status).toBe('skipped');
    expect(stageByName.section_split.status).toBe('skipped');
    expect(stageByName.batch_structurize.status).toBe('skipped');
    expect(stageByName.constants_extract.status).toBe('success');
    expect(stageByName.db_load.status).toBe('success');
    expect(stageByName.integrity_check.status).toBe('success');
    expect(stageByName.formula_verify.status).toBe('success');
    // Stage 9 QG-2 FAIL — fixture 규모가 40+ 임계값 미달
    expect(stageByName.qg2_gate.status).toBe('failed');
    expect(result.qg2Passed).toBe(false);
    // Step 11.6 PipelineResult 확장 — fresh run + InMemoryBatchRunsDb 정상 = no_checkpoint + 메타 일관
    expect(result.recoveryStatus).toBe('no_checkpoint');
    expect(result.metaPersistenceFailures).toEqual([]);
  });

  it('dry-run: Stage 5 에서 contract JSON 스냅샷 생성', async () => {
    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: [],
      versionYear: 2026,
      fixtureContract: loadSampleContract(),
      ...step116TestFields(outDir),
    };

    const result = await runPipeline(ctx);
    const snapshot = readFileSync(join(outDir, 'BATCH-1-contract.json'), 'utf-8');
    const parsed = JSON.parse(snapshot);
    expect(parsed.nodes).toHaveLength(4);
    expect(parsed.formulas).toHaveLength(1);
    expect(result.recoveryStatus).toBe('no_checkpoint');
    expect(result.metaPersistenceFailures).toEqual([]);
  });
});

describe('runPipeline — 합성 대규모 contract', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-batch-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('Stage 1~9 전체 성공 + qg2Passed=true', async () => {
    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: loadGoldenTests(),
      versionYear: 2026,
      fixtureContract: syntheticLargeContract(),
      ...step116TestFields(outDir),
    };

    const result = await runPipeline(ctx);
    const qg2Stage = result.stages.find((s) => s.stage === 'qg2_gate');
    expect(qg2Stage?.status).toBe('success');
    expect(result.qg2Passed).toBe(true);
    expect(result.recoveryStatus).toBe('no_checkpoint');
    expect(result.metaPersistenceFailures).toEqual([]);
  });
});

describe('runPipeline — 실패 경로', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-batch-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('invalid contract (schema-validator 실패) → Stage 3 FAIL 후 이후 skipped', async () => {
    const badContract: KnowledgeContract = {
      nodes: [
        {
          id: 'CONCEPT-001',
          type: 'UNKNOWN_TYPE', // 의도적 위반
          title: '',
          content: '',
          truth_weight: 5,
          source_page: 403,
        },
      ],
      edges: [],
      formulas: [],
      constants: [],
    };

    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: [],
      versionYear: 2026,
      fixtureContract: badContract,
      ...step116TestFields(outDir),
    };

    const result = await runPipeline(ctx);
    const byName = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    expect(byName.batch_structurize.status).toBe('failed');
    expect(byName.constants_extract.status).toBe('skipped');
    expect(byName.db_load.status).toBe('skipped');
    expect(result.qg2Passed).toBe(false);
    // 실패 경로 — InMemoryBatchRunsDb in_progress→failed 전이 정상 = 메타 일관
    expect(result.recoveryStatus).toBe('no_checkpoint');
    expect(result.metaPersistenceFailures).toEqual([]);
  });
});

/**
 * CR-5b — non-fixture 통합 테스트: fixture 우회 착시 차단.
 *
 * 의도: `fixtureContract` 경로에서는 Stage 1~3 이 `skipped` 상태로 기록되므로
 * "파이프라인 E2E 통과"로 오인될 위험이 있다 (Pass 4 Contract 지적). 본 블록은
 * pdfPagesOverride + mock ClaudeClient 를 주입해 **Stage 2 (section_split) 와
 * Stage 3 (batch_structurize) 의 실구현 코드 경로를 실제로 실행**한다.
 *
 * pdfplumber subprocess (Stage 1) 와 실제 Claude API 호출 (Stage 3 의 외부 I/O) 만
 * 테스트 결정론을 위해 주입 교체하고, 나머지 파이프라인 내부 로직은 real 경로.
 */
describe('runPipeline — non-fixture 통합 (pdfPagesOverride + mock ClaudeClient, CR-5b)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-batch-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('Stage 1 injected + Stage 2/3 실경로 수행 → contract 주입 후 후속 Stage 통과', async () => {
    // Stage 1 주입용 PDF pages (pdfplumber subprocess 우회). ExtractionResult 형태.
    const fakePdfPages = {
      file: '/fake/BATCH-1.pdf',
      totalPages: 32,
      extractedPages: 32,
      pages: [
        {
          page: 403,
          text: '## 적과전 종합위험\n\n### 제1절 개요\n\n적과전 종합위험 Ⅱ 는 과수의 적과 이전 기간에 자연재해로 인한 피해를 보상하는 상품이다.',
          tables: [],
        },
      ],
    };

    // Stage 3 주입용 mock ClaudeClient — 합성 대규모 contract 를 JSON 으로 반환.
    // processBatch 내부의 parseContractJson/validateKnowledgeContract 가 실경로 수행된다.
    const syntheticContract: KnowledgeContract = {
      nodes: Array.from({ length: 40 }, (_, i) => ({
        id: `CONCEPT-${String(i + 1).padStart(3, '0')}`,
        type: 'CONCEPT',
        title: `개념 ${i + 1}`,
        content: `적과전 종합위험 관련 개념 ${i + 1} 설명`,
        truth_weight: 5,
        source_page: 403 + (i % 32),
      })),
      edges: Array.from({ length: 80 }, (_, i) => ({
        source_id: `CONCEPT-${String((i % 40) + 1).padStart(3, '0')}`,
        target_id: `CONCEPT-${String(((i + 1) % 40) + 1).padStart(3, '0')}`,
        edge_type: 'DEPENDS_ON' as const,
      })),
      formulas: [
        {
          id: 'F-01',
          name: '유과타박률',
          equation_template: 'damaged_fruits / (damaged_fruits + normal_fruits)',
          variables_schema: '{"damaged_fruits":"number","normal_fruits":"number"}',
          source_page: 414,
        },
      ],
      constants: [
        {
          id: 'CONST-001',
          name: '자기부담비율',
          value: '0.20',
          category: 'deductible',
          source_page: 405,
        },
      ],
    };

    let claudeCallCount = 0;
    const mockClaude: ClaudeClient = {
      async createMessage(params): Promise<ClaudeResponse> {
        claudeCallCount += 1;
        // 실구현 batch-processor 가 markdown 코드블록 파싱을 수행 — 그 경로도 검증
        return {
          content: '```json\n' + JSON.stringify(syntheticContract) + '\n```',
          usage: { input_tokens: 1000, output_tokens: 500 },
          model: params.model,
          stop_reason: 'end_turn',
        };
      },
    };

    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: mockClaude,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: loadGoldenTests(),
      versionYear: 2026,
      pdfPagesOverride: fakePdfPages,
      ...step116TestFields(outDir),
    };

    const result = await runPipeline(ctx);
    const byName = Object.fromEntries(result.stages.map((s) => [s.stage, s]));

    // Stage 1 은 injected (skipped 아님 — 실경로 path mode 확인)
    expect(byName.pdf_extract.status).toBe('success');
    expect(byName.pdf_extract.message).toContain('test override');

    // Stage 2 (section_split) 는 real splitSections + extractTables 호출
    expect(byName.section_split.status).toBe('success');

    // Stage 3 (batch_structurize) 는 real processBatch 호출 — mock ClaudeClient 가 1회 호출됨
    expect(byName.batch_structurize.status).toBe('success');
    expect(claudeCallCount).toBe(1);

    // 이후 Stage 4~9 정상 수행
    expect(byName.constants_extract.status).toBe('success');
    expect(byName.db_load.status).toBe('success');
    expect(byName.integrity_check.status).toBe('success');
    expect(byName.formula_verify.status).toBe('success');
    expect(byName.qg2_gate.status).toBe('success');
    expect(result.qg2Passed).toBe(true);
    expect(result.recoveryStatus).toBe('no_checkpoint');
    expect(result.metaPersistenceFailures).toEqual([]);
  });
});

// ===========================================================================
// Step 11.6 §7 AC e2e — recover/checkpoint/batch_runs 통합 검증
// ===========================================================================

/**
 * 신규 BATCH 의 checkpoint 파일 경로.
 *
 * outDir 직하 `{batchRunId}.json`. checkpointPath 헬퍼 위임 (sanitize 일관).
 */
function pathFor(outDir: string, batchRunId: string): string {
  return checkpointPath(outDir, batchRunId);
}

/**
 * stage_results 헬퍼 — 모든 stage 를 동일 status / durationMs 로 채운다.
 *
 * AC-R1 e2e fixture: PIPELINE_STAGES 10건 모두 'success' 가정 (qg2_gate 까지 완료).
 */
function stageResultsAll(
  status: 'success' | 'failed' | 'skipped' | 'pending',
  durationMs = 100,
): PipelineStateSnapshot['stage_results'] {
  return Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, { status, durationMs }]),
  ) as PipelineStateSnapshot['stage_results'];
}

describe('runPipeline — AC-1 explicit (정상 흐름 영구화 SLO)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-batch-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('synthetic large contract → batch_runs.state="completed" + checkpoint 영속 + state_hash 일치', async () => {
    const batchRunsDb = new InMemoryBatchRunsDb();
    const batchRunId = randomUUID();

    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: loadGoldenTests(),
      versionYear: 2026,
      fixtureContract: syntheticLargeContract(),
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId,
      checkpointBaseDir: outDir,
      batchRunsDb,
      engineVersion: TEST_ENGINE_VERSION,
      enableSignalHandlers: false,
      fsyncCheckpoint: false,
    };

    const result = await runPipeline(ctx);

    expect(result.qg2Passed).toBe(true);
    expect(result.recoveryStatus).toBe('no_checkpoint');
    expect(result.metaPersistenceFailures).toEqual([]);

    // batch_runs 영속화 — 1건 + state='completed' + completed_at 채움
    const rows = batchRunsDb.snapshot();
    expect(rows).toHaveLength(1);
    expect(rows[0].batch_run_id).toBe(batchRunId);
    expect(rows[0].state).toBe('completed');
    expect(rows[0].completed_at).not.toBeNull();
    expect(rows[0].engine_version).toBe(TEST_ENGINE_VERSION);

    // checkpoint 영속화 — 마지막 성공 stage (qg2_gate) 시점 파일 존재 + state_hash 일치
    const cpRaw = readFileSync(pathFor(outDir, batchRunId), 'utf-8');
    const cp = JSON.parse(cpRaw);
    expect(cp.batch_run_id).toBe(batchRunId);
    expect(cp.exam_id).toBe(EXAM_IDS.SON_HAE_PYEONG_GA_SA);
    expect(cp.engine_version).toBe(TEST_ENGINE_VERSION);
    expect(cp.pipeline_stage).toBe('qg2_gate');
    // state_hash 자기 일관성 — computeStateHash 가 반환한 값과 일치
    const recomputed = computeStateHash(cp);
    expect(cp.state_hash).toBe(recomputed);
  });
});

describe('runPipeline — AC-R1 (resume from checkpoint → fully_recovered)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-batch-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('pre-existing checkpoint(qg2_gate) + batch_runs(state=killed) → fully_recovered + 모든 stage skipped + state=completed 전이', async () => {
    const batchRunsDb = new InMemoryBatchRunsDb();
    const batchRunId = randomUUID();
    const examId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

    // 1) batch_runs 사전 채움 (이전 인스턴스 SIGINT kill 시뮬레이션)
    await batchRunsDb.insertNewRun(examId, {
      batchRunId,
      fixturePath: '<test>',
      engineVersion: TEST_ENGINE_VERSION,
    });
    await batchRunsDb.updateState(examId, batchRunId, {
      state: 'killed',
      last_completed_stage: 'qg2_gate',
    });

    // 2) checkpoint 사전 작성 — last_completed_stage='qg2_gate' (resume from end)
    const snapshot: PipelineStateSnapshot = {
      last_inserted_node_id: 'CONCEPT-040',
      last_completed_stage: 'qg2_gate',
      nodes_processed: 40,
      edges_processed: 80,
      stage_results: stageResultsAll('success'),
    };
    const cp = buildCheckpoint({
      examId,
      batchRunId,
      engineVersion: TEST_ENGINE_VERSION,
      currentStage: 'qg2_gate',
      currentStageIndex: PIPELINE_STAGES.indexOf('qg2_gate'),
      totalStages: PIPELINE_STAGES.length,
      snapshot,
    });
    await writeCheckpoint(cp, outDir, { fsync: false });

    // 3) 동일 batchRunId 로 재진입 — recover 가 fully_recovered 반환 의무
    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: [],
      versionYear: 2026,
      fixtureContract: syntheticLargeContract(),
      examId,
      batchRunId,
      checkpointBaseDir: outDir,
      batchRunsDb,
      engineVersion: TEST_ENGINE_VERSION,
      enableSignalHandlers: false,
      fsyncCheckpoint: false,
    };

    const result = await runPipeline(ctx);

    // recoveryStatus 3 literal e2e (Q-MAJOR-B1-1) — fully_recovered
    expect(result.recoveryStatus).toBe('fully_recovered');
    expect(result.metaPersistenceFailures).toEqual([]);

    // 모든 stage 'skipped' — qg2_gate 까지 완료 후 resume 이라 stage 진입 0건
    for (const stage of result.stages) {
      expect(stage.status).toBe('skipped');
      expect(stage.message).toBe('Resumed from later stage');
    }

    // batch_runs 최종 상태 — recover.ts 가 'recovered' UPDATE → pipeline 종료 시 'completed' UPDATE
    const rows = batchRunsDb.snapshot();
    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe('completed');
    expect(rows[0].resume_count).toBe(1); // recoverBatch 가 resume_count_increment: 1 호출
  });
});

describe('runPipeline — AC-R2 (checkpoint 변조 감지)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-batch-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('valid checkpoint 작성 → state_hash 1바이트 변조 → RecoveryFailedError 전파', async () => {
    const batchRunsDb = new InMemoryBatchRunsDb();
    const batchRunId = randomUUID();
    const examId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

    // batch_runs 사전 채움 — 'killed' (recover 진입 가능 + concurrent_run 미발동)
    await batchRunsDb.insertNewRun(examId, {
      batchRunId,
      fixturePath: '<test>',
      engineVersion: TEST_ENGINE_VERSION,
    });
    await batchRunsDb.updateState(examId, batchRunId, {
      state: 'killed',
      last_completed_stage: 'db_load',
    });

    // valid checkpoint 작성
    const snapshot: PipelineStateSnapshot = {
      last_inserted_node_id: 'CONCEPT-040',
      last_completed_stage: 'db_load',
      nodes_processed: 40,
      edges_processed: 80,
      stage_results: stageResultsAll('success'),
    };
    const cp = buildCheckpoint({
      examId,
      batchRunId,
      engineVersion: TEST_ENGINE_VERSION,
      currentStage: 'db_load',
      currentStageIndex: PIPELINE_STAGES.indexOf('db_load'),
      totalStages: PIPELINE_STAGES.length,
      snapshot,
    });
    const filePath = await writeCheckpoint(cp, outDir, { fsync: false });

    // 변조: state_hash 1글자 교체 (SHA-256 mismatch 유도)
    const tampered = readFileSync(filePath, 'utf-8').replace(
      `"state_hash": "${cp.state_hash}"`,
      `"state_hash": "${cp.state_hash.slice(0, -1)}0"`,
    );
    writeFileSync(filePath, tampered, 'utf-8');

    // 재진입 → RecoveryFailedError throw
    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: [],
      versionYear: 2026,
      fixtureContract: syntheticLargeContract(),
      examId,
      batchRunId,
      checkpointBaseDir: outDir,
      batchRunsDb,
      engineVersion: TEST_ENGINE_VERSION,
      enableSignalHandlers: false,
      fsyncCheckpoint: false,
    };

    let caught: unknown;
    try {
      await runPipeline(ctx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RecoveryFailedError);
    expect((caught as Error).message).toContain('체크포인트 무결성 검증 실패');

    // batch_runs row state 변동 X (recover 자체가 거부)
    const rows = batchRunsDb.snapshot();
    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe('killed');
  });
});

describe('runPipeline — AC-R3 동시 실행 차단 + already_completed (Q-MAJOR-B1-1 e2e)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-batch-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('state="in_progress" recent → ConcurrentRunError throw + 메타 변동 X', async () => {
    const batchRunsDb = new InMemoryBatchRunsDb();
    const batchRunId = randomUUID();
    const examId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

    // 다른 인스턴스가 실행 중 시뮬레이션 — 방금 시작 (24h 미만)
    await batchRunsDb.insertNewRun(examId, {
      batchRunId,
      fixturePath: '<test>',
      engineVersion: TEST_ENGINE_VERSION,
    });
    // insertNewRun 직후 state='in_progress' + started_at=now → recover 가 concurrent_run 분기

    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: [],
      versionYear: 2026,
      fixtureContract: syntheticLargeContract(),
      examId,
      batchRunId,
      checkpointBaseDir: outDir,
      batchRunsDb,
      engineVersion: TEST_ENGINE_VERSION,
      enableSignalHandlers: false,
      fsyncCheckpoint: false,
    };

    await expect(runPipeline(ctx)).rejects.toBeInstanceOf(ConcurrentRunError);

    const rows = batchRunsDb.snapshot();
    expect(rows[0].state).toBe('in_progress'); // 변동 X
  });

  it('state="completed" 재진입 → recoveryStatus="already_completed" + 모든 stage skipped (Idempotency)', async () => {
    const batchRunsDb = new InMemoryBatchRunsDb();
    const batchRunId = randomUUID();
    const examId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

    // 이미 완료된 batch 시뮬레이션
    await batchRunsDb.insertNewRun(examId, {
      batchRunId,
      fixturePath: '<test>',
      engineVersion: TEST_ENGINE_VERSION,
    });
    await batchRunsDb.updateState(examId, batchRunId, {
      state: 'completed',
      completed_at: new Date().toISOString(),
    });

    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: [],
      versionYear: 2026,
      fixtureContract: syntheticLargeContract(),
      examId,
      batchRunId,
      checkpointBaseDir: outDir,
      batchRunsDb,
      engineVersion: TEST_ENGINE_VERSION,
      enableSignalHandlers: false,
      fsyncCheckpoint: false,
    };

    const result = await runPipeline(ctx);

    // recoveryStatus 3 literal e2e (Q-MAJOR-B1-1) — already_completed
    expect(result.recoveryStatus).toBe('already_completed');
    expect(result.metaPersistenceFailures).toEqual([]);
    expect(result.qg2Passed).toBe(false); // skip 결과 — 실제 검증 X
    expect(result.contract).toBeNull();

    // 모든 stage 'skipped' + Idempotency 메시지
    for (const stage of result.stages) {
      expect(stage.status).toBe('skipped');
    }

    // batch_runs row 변동 X — 'completed' 유지
    const rows = batchRunsDb.snapshot();
    expect(rows[0].state).toBe('completed');
  });
});

describe('runPipeline — AC-Snapshot-ExamId (exam_id 불일치 거부)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-batch-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('checkpoint exam_id="다른시험" + opts.examId="손해평가사" → RecoveryFailedError (Year 2 cross-tenant 차단 SF-M-2)', async () => {
    const batchRunsDb = new InMemoryBatchRunsDb();
    const batchRunId = randomUUID();
    const requestedExamId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;
    // Year 1 단일 시험 환경 — Year 2 cross-tenant 시뮬레이션을 위해 의도적 캐스트
    const otherExamId = 'gong-in-jung-gae-sa' as ExamId;

    // checkpoint 사전 작성 — 다른 시험으로 봉인
    const snapshot: PipelineStateSnapshot = {
      last_inserted_node_id: null,
      last_completed_stage: 'db_load',
      nodes_processed: 0,
      edges_processed: 0,
      stage_results: stageResultsAll('success'),
    };
    const cp = buildCheckpoint({
      examId: otherExamId,
      batchRunId,
      engineVersion: TEST_ENGINE_VERSION,
      currentStage: 'db_load',
      currentStageIndex: PIPELINE_STAGES.indexOf('db_load'),
      totalStages: PIPELINE_STAGES.length,
      snapshot,
    });
    await writeCheckpoint(cp, outDir, { fsync: false });

    // batch_runs 비우기 — row=null 경로 → recover 가 곧장 checkpoint 검증 진입
    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: [],
      versionYear: 2026,
      fixtureContract: syntheticLargeContract(),
      examId: requestedExamId,
      batchRunId,
      checkpointBaseDir: outDir,
      batchRunsDb,
      engineVersion: TEST_ENGINE_VERSION,
      enableSignalHandlers: false,
      fsyncCheckpoint: false,
    };

    let caught: unknown;
    try {
      await runPipeline(ctx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RecoveryFailedError);
    expect((caught as Error).message).toContain('exam_id 불일치');
  });

  it('checkpoint exam_id=undefined (Year 1 legacy) → 통과 (false-negative 차단)', async () => {
    // recover.ts:244 의 분기 `checkpoint.exam_id !== undefined && checkpoint.exam_id !== opts.examId`
    // 가 회귀하면 (즉 undefined 도 거부) Year 1 legacy checkpoint 가 모두 RecoveryFailedError → BATCH 차단.
    // 본 테스트가 false-negative 회귀 시점을 차단.
    const batchRunsDb = new InMemoryBatchRunsDb();
    const batchRunId = randomUUID();
    const requestedExamId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

    // checkpoint 사전 작성 — examId 미주입 (Year 1 legacy 시뮬레이션)
    const snapshot: PipelineStateSnapshot = {
      last_inserted_node_id: null,
      last_completed_stage: 'qg2_gate',
      nodes_processed: 0,
      edges_processed: 0,
      stage_results: stageResultsAll('success'),
    };
    const cp = buildCheckpoint({
      // examId 의도적 omit — undefined 입력
      batchRunId,
      engineVersion: TEST_ENGINE_VERSION,
      currentStage: 'qg2_gate',
      currentStageIndex: PIPELINE_STAGES.indexOf('qg2_gate'),
      totalStages: PIPELINE_STAGES.length,
      snapshot,
    });
    expect(cp.exam_id).toBeUndefined();
    await writeCheckpoint(cp, outDir, { fsync: false });

    // batch_runs 사전 채움 — 'killed' (recover 진입 가능)
    await batchRunsDb.insertNewRun(requestedExamId, {
      batchRunId,
      fixturePath: '<test>',
      engineVersion: TEST_ENGINE_VERSION,
    });
    await batchRunsDb.updateState(requestedExamId, batchRunId, {
      state: 'killed',
      last_completed_stage: 'qg2_gate',
    });

    const ctx: PipelineContext = {
      batchId: 'BATCH-1',
      config: BATCH_CONFIGS['BATCH-1'],
      pdfPath: null,
      claudeClient: null,
      visionClient: null,
      db: null,
      dryRun: true,
      outDir,
      enableVisionOcr: false,
      goldenTests: [],
      versionYear: 2026,
      fixtureContract: syntheticLargeContract(),
      examId: requestedExamId,
      batchRunId,
      checkpointBaseDir: outDir,
      batchRunsDb,
      engineVersion: TEST_ENGINE_VERSION,
      enableSignalHandlers: false,
      fsyncCheckpoint: false,
    };

    // 거부되지 않고 정상 fully_recovered 반환
    const result = await runPipeline(ctx);
    expect(result.recoveryStatus).toBe('fully_recovered');
    expect(result.metaPersistenceFailures).toEqual([]);
  });
});
