/**
 * Session 052 5-Persona QE-C2 흡수 — Cat 9/10 mutation reverse-test.
 *
 * 목적:
 *   `verify-engine-contracts.ts` Cat 9 (Table-as-Micro-KG schema 정합) + Cat 10
 *   (Drizzle ↔ SQL enum 동기화) 가 마이그레이션 파일 부재/손상을 실제로 잡아내는가?
 *   카운트 매칭만 통과하면 PASS인 self-verification 0건 위험을 회귀 차단.
 *
 *   "0024 파일 삭제 → Cat 9 PASS = 회귀 차단 0" (5-Persona Persona 3 quality QE-C2)
 *
 * 검증 시나리오:
 *   1. 0024 임시 rename → verify exit !=0 + Cat 9 FAIL (pattern_type CHECK 8종 검증)
 *   2. 0025 임시 rename → verify exit !=0 + Cat 9 FAIL (PE-C1 partial index 검증)
 *   3. 0026 임시 rename → verify exit !=0 + Cat 9 FAIL (BA-C2 trigger 3종 검증)
 *
 * 안전장치:
 *   - try/finally + afterEach 이중 복원 — 테스트 실패 시에도 파일 손실 0
 *   - rename 실패 시 즉시 throw (mutation 적용 못 했으면 검증 무의미)
 *   - 스폰 실패 시 stdout/stderr 보존 후 throw (silent fail 차단)
 *
 * 근거: .claude/reviews/review-20260507-154747-session-052-5-persona-tech-debt.md QE-C2
 */

import { spawn } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..', '..', '..', '..');
const VERIFY_SCRIPT = join(REPO_ROOT, 'scripts', 'verify-engine-contracts.ts');
const TSX_BIN = join(REPO_ROOT, 'packages', 'quality', 'node_modules', '.bin', 'tsx');
const MIGRATIONS_DIR = join(REPO_ROOT, 'migrations');

/**
 * 재귀 spawn 차단 — verify-engine-contracts.ts Cat 1+2+3가 packages/quality vitest를
 * 호출하면 본 테스트가 다시 verify를 spawn → 무한 재귀. 부모(verify) 프로세스가 본 env를
 * 주입하면 자식(이 테스트)은 즉시 skip. CI / `pnpm test` 단독 실행 시는 정상 동작.
 */
const IS_SUBPROCESS = process.env.IN_VERIFY_SUBPROCESS === '1';

interface VerifyJson {
  readonly summary: {
    readonly overallStatus: 'PASS' | 'FAIL' | 'SKIP';
    readonly fail: number;
  };
  readonly categories: ReadonlyArray<{
    readonly id: number;
    readonly name: string;
    readonly status: 'PASS' | 'FAIL' | 'SKIP';
    readonly booleans?: ReadonlyArray<{
      readonly name: string;
      readonly status: 'PASS' | 'FAIL' | 'SKIP';
      readonly evidence?: string;
    }>;
  }>;
}

interface VerifyResult {
  readonly exitCode: number;
  readonly json: VerifyJson | null;
  readonly stderr: string;
  readonly stdout: string;
}

async function runVerify(): Promise<VerifyResult> {
  return new Promise<VerifyResult>((resolveResult, rejectResult) => {
    const proc = spawn(TSX_BIN, [VERIFY_SCRIPT, '--json'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        IN_VERIFY_SUBPROCESS: '1', // 재귀 spawn 차단 (자식 vitest의 본 테스트는 skip)
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    proc.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      rejectResult(new Error('verify subprocess timeout (>120s)'));
    }, 120_000);

    proc.on('error', (err) => {
      clearTimeout(timer);
      rejectResult(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      let json: VerifyJson | null = null;
      try {
        json = JSON.parse(stdout) as VerifyJson;
      } catch {
        json = null;
      }
      resolveResult({ exitCode: code ?? -1, json, stdout, stderr });
    });
  });
}

interface Mutation {
  readonly fileName: string;
  readonly description: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    fileName: '0024_table_structures_pattern_h.sql',
    description: 'pattern_type CHECK 8종 (D-PHASE2-8=α) 부재 시 Cat 9 FAIL',
  },
  {
    fileName: '0025_table_cells_partial_index.sql',
    description: 'PE-C1 partial index 부재 시 Cat 9 FAIL',
  },
  {
    fileName: '0026_table_subordinate_update_guards.sql',
    description: 'BA-C2 trigger 3종 부재 시 Cat 9 FAIL',
  },
];

describe.skipIf(IS_SUBPROCESS)(
  'verify-engine-contracts mutation reverse-test (Cat 9 self-verification)',
  () => {
    let activeMutation: { from: string; to: string } | null = null;

    afterEach(() => {
      if (activeMutation && existsSync(activeMutation.to)) {
        renameSync(activeMutation.to, activeMutation.from);
        activeMutation = null;
      }
    });

    for (const mutation of MUTATIONS) {
      it(`${mutation.fileName} → ${mutation.description}`, async () => {
        const filePath = join(MIGRATIONS_DIR, mutation.fileName);
        const backupPath = `${filePath}.mutation-test-bak`;

        expect(existsSync(filePath)).toBe(true);
        renameSync(filePath, backupPath);
        activeMutation = { from: filePath, to: backupPath };

        let result: VerifyResult;
        try {
          result = await runVerify();
        } finally {
          // 항상 복원 — verify가 exception 던져도 파일 손실 0
          if (existsSync(backupPath)) {
            renameSync(backupPath, filePath);
          }
          activeMutation = null;
        }

        // 1. exit code 검증 — 마이그레이션 부재 시 verify는 PASS이면 안 된다
        expect(
          result.exitCode,
          `verify가 0024-0026 부재를 잡지 못함 (stdout=${result.stdout.slice(0, 300)})`,
        ).not.toBe(0);

        // 2. JSON 보고서 파싱 가능
        expect(
          result.json,
          `verify JSON 파싱 실패 (stderr=${result.stderr.slice(0, 300)})`,
        ).not.toBeNull();

        // 3. Cat 9 status FAIL 직접 확인 (single 부재로 Cat 9 전체 PASS는 회귀)
        const cat9 = result.json?.categories.find((c) => c.id === 9);
        expect(cat9, 'Cat 9 보고서 미발견').toBeDefined();
        expect(cat9?.status, `Cat 9는 ${mutation.fileName} 부재를 FAIL로 보고해야 한다`).toBe(
          'FAIL',
        );

        // 4. Overall status FAIL
        expect(result.json?.summary.overallStatus).toBe('FAIL');
      }, 150_000); // 테스트 timeout: verify ~30s × 안전 마진 5배
    }
  },
);
