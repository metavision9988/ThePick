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
 *   1. 0024 임시 삭제 → verify exit !=0 + Cat 9 FAIL (pattern_type CHECK 8종 검증)
 *   2. 0025 임시 삭제 → verify exit !=0 + Cat 9 FAIL (PE-C1 partial index 검증)
 *   3. 0026 임시 삭제 → verify exit !=0 + Cat 9 FAIL (BA-C2 trigger 3종 검증)
 *
 * 격리 정책 (Session 075 항상성 강화 — handoff carry-over 흡수):
 *   - 실 `/migrations` 디렉토리는 **절대 mutation하지 않는다**. `os.tmpdir()` 복사본 작업.
 *   - turbo 병렬 (apps/api ↔ packages/quality) race condition 차단:
 *     apps/api/src/__tests__/helpers/d1-from-sqlite.ts가 readFileSync로 실 migrations 사용 →
 *     구버전 mutation test가 실 파일 rename 시 race로 apps/api 7~11건 fail. 본 패턴으로 완전 격리.
 *   - verify-engine-contracts.ts에 `MIGRATIONS_DIR` env override 추가 (scripts/verify-engine-contracts.ts:94).
 *
 * 안전장치:
 *   - tmpdir copy → 원본 무손상 (cleanup 실패해도 실 migrations 영향 0)
 *   - afterEach + afterAll 이중 cleanup (tmpdir 잔재 0건)
 *   - beforeAll legacy `.mutation-test-bak` 자동 정리 (구버전 crash 잔재 회귀 차단)
 *   - spawn 실패 시 stdout/stderr 보존 후 throw (silent fail 차단)
 *
 * 근거: .claude/reviews/review-20260507-154747-session-052-5-persona-tech-debt.md QE-C2
 *       + Session 074 handoff "migrations 0024/0025 `.mutation-test-bak` 잔재" carry-over.
 */

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..', '..', '..', '..');
const VERIFY_SCRIPT = join(REPO_ROOT, 'scripts', 'verify-engine-contracts.ts');
const TSX_BIN = join(REPO_ROOT, 'packages', 'quality', 'node_modules', '.bin', 'tsx');
const REAL_MIGRATIONS_DIR = join(REPO_ROOT, 'migrations');

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

async function runVerify(migrationsDir: string): Promise<VerifyResult> {
  return new Promise<VerifyResult>((resolveResult, rejectResult) => {
    const proc = spawn(TSX_BIN, [VERIFY_SCRIPT, '--json'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        IN_VERIFY_SUBPROCESS: '1', // 재귀 spawn 차단 (자식 vitest의 본 테스트는 skip)
        MIGRATIONS_DIR: migrationsDir, // tmpdir 격리 주입 (실 migrations 미손상)
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

/**
 * tmpdir에 실 migrations/*.sql 전부 복사 — 매 테스트마다 fresh 사본 생성.
 * 격리 보장: 본 디렉토리만 mutation, 실 migrations 무영향.
 */
function copyMigrationsToTmpdir(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'thepick-mut-'));
  const files = readdirSync(REAL_MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  for (const f of files) {
    copyFileSync(join(REAL_MIGRATIONS_DIR, f), join(tmp, f));
  }
  return tmp;
}

describe.skipIf(IS_SUBPROCESS)(
  'verify-engine-contracts mutation reverse-test (Cat 9 self-verification)',
  () => {
    let activeTmpdir: string | null = null;

    /**
     * 구버전 (Session 074 이전) mutation test가 crash 시 남길 수 있는 잔재 정리.
     * tmpdir 패턴 도입 이후에는 발생 X — defensive 회귀 차단.
     * Pass 1 MINOR-1 흡수 — 정리 발생 시 console.warn으로 흔적 보존 (디버깅 단서).
     */
    beforeAll(() => {
      const stale = readdirSync(REAL_MIGRATIONS_DIR).filter((f) =>
        f.endsWith('.mutation-test-bak'),
      );
      if (stale.length > 0) {
        console.warn(
          `[verify-cat9-mutation] legacy .mutation-test-bak ${stale.length}건 자동 정리: ${stale.join(', ')} — Session 074 이전 mutation test crash 잔재 가능성`,
        );
      }
      for (const f of stale) {
        unlinkSync(join(REAL_MIGRATIONS_DIR, f));
      }
    });

    afterEach(() => {
      if (activeTmpdir !== null && existsSync(activeTmpdir)) {
        rmSync(activeTmpdir, { recursive: true, force: true });
      }
      activeTmpdir = null;
    });

    afterAll(() => {
      // 마지막 안전망 — process kill 등 비정상 종료 시 tmpdir 잔재 청소.
      if (activeTmpdir !== null && existsSync(activeTmpdir)) {
        rmSync(activeTmpdir, { recursive: true, force: true });
      }
    });

    for (const mutation of MUTATIONS) {
      it(`${mutation.fileName} → ${mutation.description}`, async () => {
        const tmp = copyMigrationsToTmpdir();
        activeTmpdir = tmp;
        try {
          const targetPath = join(tmp, mutation.fileName);

          // 사전 조건: 복사된 tmpdir에 대상 파일 존재
          expect(existsSync(targetPath), `${mutation.fileName} 복사 누락`).toBe(true);

          // mutation 적용 — tmpdir 사본만 삭제 (실 migrations 무손상)
          unlinkSync(targetPath);
          expect(existsSync(targetPath)).toBe(false);

          const result = await runVerify(tmp);

          // 1. exit code 검증 — 마이그레이션 부재 시 verify는 PASS이면 안 된다
          expect(
            result.exitCode,
            `verify가 ${mutation.fileName} 부재를 잡지 못함 (stdout=${result.stdout.slice(0, 300)})`,
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

          // 3b. Pass 1 MAJOR-1 흡수 — Cat 9 status='FAIL'은 countMigrations() numeric 부수효과로도
          // 달성되므로 (tmpdir에서 1건 unlink → count < required), 미래에 누군가 boolean assertion을
          // 제거하더라도 status='FAIL'은 유지되어 self-verification 회귀가 silently 통과한다.
          // 본 step 핵심 가치 (boolean 검증 회귀 차단) 보존을 위해 booleans 배열에서 해당 파일을
          // 직접 가리키는 항목이 FAIL인지 명시 검증.
          const stem = mutation.fileName.replace('.sql', '');
          const matchingBoolean = cat9?.booleans?.find(
            (b) => b.name.includes(stem) || b.evidence?.includes(stem),
          );
          expect(
            matchingBoolean,
            `Cat 9 booleans 배열에 ${mutation.fileName} 관련 항목 미발견 — self-verification 회귀 위험 (boolean 검증 제거 + numeric 부수효과로 status FAIL 위장)`,
          ).toBeDefined();
          expect(
            matchingBoolean?.status,
            `Cat 9 ${mutation.fileName} boolean이 FAIL이 아닌데 status='FAIL' — countMigrations numeric 부수효과 의존 회귀 차단 무력화`,
          ).toBe('FAIL');

          // 4. Overall status FAIL
          expect(result.json?.summary.overallStatus).toBe('FAIL');

          // 5. 실 migrations 무손상 검증 (격리 정합) — 본 step 핵심 회귀 차단
          expect(
            existsSync(join(REAL_MIGRATIONS_DIR, mutation.fileName)),
            '실 migrations 파일이 영향받았다 — 격리 위반',
          ).toBe(true);
        } finally {
          // 즉시 cleanup — afterEach 단독 의존 시 worker race로 누락 가능 (Session 075 관찰).
          // try/finally는 assertion 실패에도 작동하므로 결정적 청소.
          if (existsSync(tmp)) {
            rmSync(tmp, { recursive: true, force: true });
          }
          activeTmpdir = null;
        }
      }, 150_000); // 테스트 timeout: verify ~30s × 안전 마진 5배
    }
  },
);
