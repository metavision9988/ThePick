/**
 * pipeline.integration 테스트 — fixture mode 로 Stage 1~9 end-to-end 실행.
 *
 * fixture 경로:
 *   - 소규모 (src/fixtures/batch-1-sample-extract.json) → Stage 1~8 성공, Stage 9 QG-2 FAIL (규모 부족)
 *   - 합성 대규모 (메모리 생성) → Stage 1~9 전부 성공, qg2Passed=true
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import type { KnowledgeContract } from '@thepick/parser';
import { runPipeline, BATCH_CONFIGS } from '../pipeline';
import type { PipelineContext } from '../pipeline';
import type { GoldenTestCase } from '../qg2-validator';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

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
    };

    await runPipeline(ctx);
    const snapshot = readFileSync(join(outDir, 'BATCH-1-contract.json'), 'utf-8');
    const parsed = JSON.parse(snapshot);
    expect(parsed.nodes).toHaveLength(4);
    expect(parsed.formulas).toHaveLength(1);
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
    };

    const result = await runPipeline(ctx);
    const qg2Stage = result.stages.find((s) => s.stage === 'qg2_gate');
    expect(qg2Stage?.status).toBe('success');
    expect(result.qg2Passed).toBe(true);
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
    };

    const result = await runPipeline(ctx);
    const byName = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    expect(byName.batch_structurize.status).toBe('failed');
    expect(byName.constants_extract.status).toBe('skipped');
    expect(byName.db_load.status).toBe('skipped');
    expect(result.qg2Passed).toBe(false);
  });
});
