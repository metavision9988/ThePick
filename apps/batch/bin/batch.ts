#!/usr/bin/env tsx
/* eslint-disable no-console -- CLI 진입점: stdout/stderr 출력이 UX 본질 (디버깅 아님). 사용자 대상 TTY 메시지이므로 no-console 규칙에서 제외. */
/**
 * thepick-batch CLI — 교재 파이프라인 실행 / 상태 전이 / 조회.
 *
 * 명령어:
 *   run <BATCH-N> --fixtures [--dry-run] [--skip-vision]
 *   run <BATCH-N> --pdf=<path> [--dry-run] [--skip-vision]
 *   status <id> --target-type=node|formula|constant --next=review|approved|flagged --reviewer=<id> [--reason=<text>]
 *   list [--target-type=...] [--status=...]
 *
 * 인자 파싱: node:util parseArgs (외부 dep 없음).
 * DB: `./thepick-local.db` (환경변수 `THEPICK_BATCH_DB` 로 override).
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KnowledgeContract } from '@thepick/parser';
import { runPipeline, BATCH_CONFIGS, type BatchId, type PipelineContext } from '../src/pipeline';
import {
  transitionStatus,
  getCurrentStatus,
  TargetNotFoundError,
  InvalidTransitionError,
  type TransitionInput,
} from '../src/loader/state-machine';
import { openLocalDb } from '../src/loader/local-db';
import { createAnthropicClient } from '../src/adapters/anthropic-client';
import { createVisionClient } from '../src/adapters/vision-client';
import { createTokenCostLogger } from '../src/adapters/token-cost-logger';
import type { GoldenTestCase } from '../src/qg2-validator';
import type { TransitionStatus, TransitionTargetType } from '@thepick/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '..', 'src', 'fixtures');
const DEFAULT_DB_PATH = process.env.THEPICK_BATCH_DB ?? './thepick-local.db';
const DEFAULT_OUT_DIR = process.env.THEPICK_BATCH_OUT ?? './out';
const DEFAULT_VERSION_YEAR = 2026;

type ExitCode = 0 | 1 | 2;

async function main(): Promise<ExitCode> {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }

  try {
    switch (command) {
      case 'run':
        return await cmdRun(rest);
      case 'status':
        return await cmdStatus(rest);
      case 'list':
        return await cmdList(rest);
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        return 2;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[thepick-batch] ERROR: ${msg}`);
    if (err instanceof Error && err.stack) console.error(err.stack);
    return 1;
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function cmdRun(args: string[]): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      fixtures: { type: 'boolean', default: false },
      pdf: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'skip-vision': { type: 'boolean', default: true },
      'version-year': { type: 'string' },
      'api-key': { type: 'string' },
    },
    allowPositionals: true,
  });

  const batchId = positionals[0] as BatchId | undefined;
  if (!batchId || !(batchId in BATCH_CONFIGS)) {
    console.error(`run: <BATCH-N> required. Got: "${batchId ?? ''}". Valid: BATCH-1..BATCH-5`);
    return 2;
  }

  const config = BATCH_CONFIGS[batchId];
  const dryRun = values['dry-run'];
  const useFixtures = values.fixtures;
  const skipVision = values['skip-vision'];
  const versionYear = values['version-year']
    ? Number(values['version-year'])
    : DEFAULT_VERSION_YEAR;

  if (!useFixtures && !values.pdf) {
    console.error('run: --fixtures or --pdf=<path> is required');
    return 2;
  }

  const goldenTests = loadGoldenTests(batchId);
  let fixtureContract: KnowledgeContract | undefined;
  if (useFixtures) {
    fixtureContract = loadFixtureContract(batchId);
  }

  const apiKey = values['api-key'] ?? process.env.ANTHROPIC_API_KEY ?? '';
  const tokenLogger = createTokenCostLogger();
  const claudeClient = useFixtures
    ? null
    : createAnthropicClient({
        apiKey,
        onUsage: (usage) =>
          tokenLogger.record({
            batchId,
            model: usage.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            retries: 0,
            stopReason: usage.stopReason,
            stage: usage.stage,
            error: usage.error,
          }),
      });
  const visionClient =
    !skipVision && !useFixtures
      ? createVisionClient({
          apiKey,
          enableRealCalls: false, // 가-0 에서는 항상 false (스켈레톤 가드)
          onUsage: (usage) =>
            tokenLogger.record({
              batchId,
              model: usage.model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              retries: 0,
              stopReason: usage.stopReason,
              stage: usage.stage,
              error: usage.error,
            }),
        })
      : null;

  const localDb = dryRun || useFixtures ? null : openLocalDb({ path: DEFAULT_DB_PATH });

  try {
    const ctx: PipelineContext = {
      batchId,
      config,
      pdfPath: values.pdf ? resolve(values.pdf) : null,
      claudeClient,
      visionClient,
      db: localDb?.db ?? null,
      dryRun: dryRun || useFixtures,
      outDir: DEFAULT_OUT_DIR,
      enableVisionOcr: !skipVision,
      goldenTests,
      versionYear,
      fixtureContract,
    };

    const result = await runPipeline(ctx);
    printRunReport(result);
    return result.qg2Passed ? 0 : 1;
  } finally {
    localDb?.close();
  }
}

function loadGoldenTests(batchId: BatchId): readonly GoldenTestCase[] {
  if (batchId !== 'BATCH-1') return [];
  const path = join(FIXTURES_DIR, 'batch-1-golden.json');
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
    tests: GoldenTestCase[];
  };
  return raw.tests;
}

function loadFixtureContract(batchId: BatchId): KnowledgeContract {
  if (batchId !== 'BATCH-1') {
    throw new Error(`No fixture contract for ${batchId} (only BATCH-1 in 가-0)`);
  }
  const path = join(FIXTURES_DIR, 'batch-1-sample-extract.json');
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
    contract: KnowledgeContract;
  };
  return raw.contract;
}

function printRunReport(result: {
  batchId: string;
  stages: readonly { stage: string; status: string; message: string; durationMs: number }[];
  qg2Passed: boolean;
  qg2Result: unknown;
}): void {
  console.log('');
  console.log(`── Pipeline ${result.batchId} ─────────────────`);
  for (const s of result.stages) {
    const icon = s.status === 'success' ? '✅' : s.status === 'skipped' ? '⏭️ ' : '❌';
    const durationStr = s.durationMs > 0 ? ` (${s.durationMs}ms)` : '';
    console.log(`${icon} ${s.stage.padEnd(20)} ${s.message}${durationStr}`);
  }
  console.log('─────────────────────────────────────────────');
  console.log(`QG-2: ${result.qg2Passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

async function cmdStatus(args: string[]): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      'target-type': { type: 'string', default: 'node' },
      next: { type: 'string' },
      reviewer: { type: 'string' },
      reason: { type: 'string' },
    },
    allowPositionals: true,
  });

  const targetId = positionals[0];
  if (!targetId) {
    console.error('status: <id> required');
    return 2;
  }
  const targetType = (values['target-type'] ?? 'node') as TransitionTargetType;
  if (!['node', 'formula', 'constant'].includes(targetType)) {
    console.error(`status: --target-type must be node|formula|constant, got "${targetType}"`);
    return 2;
  }

  const localDb = openLocalDb({ path: DEFAULT_DB_PATH });
  try {
    if (!values.next) {
      // 현재 상태 조회만
      const current = await getCurrentStatus(localDb.db, targetType, targetId);
      console.log(`[${targetType}] ${targetId}: ${current}`);
      return 0;
    }

    if (!values.reviewer) {
      console.error('status --next=<...> requires --reviewer=<id>');
      return 2;
    }
    const toStatus = values.next as TransitionStatus;
    if (!['review', 'approved', 'flagged'].includes(toStatus)) {
      console.error('status --next must be review|approved|flagged');
      return 2;
    }

    const input: TransitionInput = {
      targetType,
      targetId,
      toStatus: toStatus as Exclude<TransitionStatus, 'draft'>,
      reviewerId: values.reviewer,
      reason: values.reason,
    };

    try {
      const result = await transitionStatus(localDb.db, input);
      console.log(
        `✅ ${targetType}/${targetId}: ${result.fromStatus} → ${result.toStatus} ` +
          `(reviewer=${result.reviewerId}, at=${result.transitionedAt})`,
      );
      return 0;
    } catch (err) {
      if (err instanceof TargetNotFoundError) {
        console.error(`❌ ${err.message}`);
        return 1;
      }
      if (err instanceof InvalidTransitionError) {
        console.error(`❌ ${err.message}`);
        return 1;
      }
      throw err;
    }
  } finally {
    localDb.close();
  }
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

async function cmdList(args: string[]): Promise<ExitCode> {
  const { values } = parseArgs({
    args,
    options: {
      'target-type': { type: 'string', default: 'node' },
      status: { type: 'string' },
      batch: { type: 'string' },
      limit: { type: 'string', default: '50' },
    },
  });

  const targetType = (values['target-type'] ?? 'node') as TransitionTargetType;
  const table = { node: 'knowledge_nodes', formula: 'formulas', constant: 'constants' }[targetType];
  if (!table) {
    console.error(`list: invalid --target-type=${targetType}`);
    return 2;
  }

  const localDb = openLocalDb({ path: DEFAULT_DB_PATH });
  try {
    const conditions: string[] = [];
    const binds: unknown[] = [];
    if (values.batch && targetType === 'node') {
      conditions.push('batch_id = ?');
      binds.push(values.batch);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.max(1, Number(values.limit ?? 50));

    // raw rows 조회 — status 는 status_transitions 최신값으로 필터 (cross join)
    const sql = `
      SELECT t.id,
             COALESCE(
               (SELECT to_status FROM status_transitions
                 WHERE target_type = ? AND target_id = t.id
                 ORDER BY transitioned_at DESC LIMIT 1),
               'draft'
             ) AS current_status
      FROM ${table} t
      ${where}
      LIMIT ${limit}
    `;
    const stmt = localDb.db.prepare(sql).bind(targetType, ...binds);
    const result = await stmt.run<{ id: string; current_status: string }>();
    const rows = result.results ?? [];
    const filtered = values.status ? rows.filter((r) => r.current_status === values.status) : rows;

    for (const row of filtered) {
      console.log(`${row.id}\t${row.current_status}`);
    }
    console.log(`── ${filtered.length} rows (${table})`);
    return 0;
  } finally {
    localDb.close();
  }
}

// ---------------------------------------------------------------------------
// help
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`thepick-batch — 교재 파이프라인 CLI

Usage:
  thepick-batch run <BATCH-N> --fixtures [--dry-run] [--skip-vision]
  thepick-batch run <BATCH-N> --pdf=<path> [--dry-run] [--skip-vision]
  thepick-batch status <id> --target-type=node|formula|constant \\
                       [--next=review|approved|flagged --reviewer=<id> [--reason=<text>]]
  thepick-batch list --target-type=node [--status=draft|review|approved] [--batch=<BATCH-N>]

Environment:
  ANTHROPIC_API_KEY      — 실제 Claude API 호출 시 필수 (--fixtures 생략 시)
  THEPICK_BATCH_DB       — 로컬 SQLite 파일 경로 (default: ./thepick-local.db)
  THEPICK_BATCH_OUT      — dry-run JSON 스냅샷 디렉터리 (default: ./out)
  THEPICK_BATCH_LOG_DIR  — 토큰 비용 JSONL 디렉터리 (default: ./logs)

Notes:
  - 가-0 스코프: --fixtures 모드가 주 경로 (픽스처 JSON 으로 Stage 1~9 검증).
  - 실제 BATCH 1 실행(--pdf)은 Step 1-5 가-1 이후 권장.
  - Vision OCR 실 호출 경로는 NotImplementedError 를 던진다 (가-1 에서 활성).
`);
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error('[thepick-batch] FATAL:', err);
    process.exit(1);
  },
);
