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
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import type { KnowledgeContract, ClaudeClient, ClaudeResponse } from '@thepick/parser';
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
  });
});
