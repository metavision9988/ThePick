/**
 * 로컬 D1 wrapper — node:sqlite DatabaseSync 위에서 D1Database 호환 인터페이스 제공.
 *
 * 용도: apps/batch CLI 의 상태 전이(status) / 조회(list) 명령 실행 시 로컬 SQLite 파일 접근.
 * 파일 기반(persistent) 또는 `:memory:` 모두 지원. migrations 자동 적용.
 *
 * 보안 메모: raw.exec(sqlText) 는 node:sqlite DatabaseSync 의 prepared SQL API 로,
 * child_process.exec 과 무관. 정적 SQL 문자열(migration 파일 내용) 만 전달 — command injection 경로 없음.
 *
 * 참고: apps/api/src/__tests__/helpers/d1-from-sqlite.ts 와 유사하지만 그 헬퍼는
 * 테스트 범위 전용이며, CLI 경로에서는 workspace 역의존 회피를 위해 본 파일이 별도 구현.
 */

// @ts-expect-error — Node 22 runtime. @types/node 20.x 에 node:sqlite 미포함.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { D1Db, D1Stmt, D1RunResult, D1AllResult } from './draft-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** monorepo 루트 migrations 디렉터리 — apps/batch/src/loader 기준 상대 경로. */
const DEFAULT_MIGRATIONS_DIR = join(__dirname, '..', '..', '..', '..', 'migrations');

export interface OpenLocalDbOptions {
  /** 파일 경로 — `:memory:` 또는 상대/절대 경로. 기본 `./thepick-local.db`. */
  readonly path?: string;
  /** migrations 디렉터리 — 기본 monorepo 루트 `/migrations`. */
  readonly migrationsDir?: string;
  /** migrations 자동 적용 여부 — 기본 true. */
  readonly applyMigrations?: boolean;
}

export interface LocalD1 {
  readonly db: D1Db;
  readonly close: () => void;
  readonly raw: DatabaseSync;
}

export function openLocalDb(options: OpenLocalDbOptions = {}): LocalD1 {
  const path = options.path ?? './thepick-local.db';
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const applyMigrations = options.applyMigrations ?? true;

  const raw = new DatabaseSync(path);
  applySqlBatch(raw, 'PRAGMA foreign_keys = ON');

  if (applyMigrations) {
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const fileName of files) {
      const sqlText = readFileSync(join(migrationsDir, fileName), 'utf-8');
      try {
        applySqlBatch(raw, sqlText);
      } catch (err) {
        // 이미 적용된 마이그레이션은 re-run 시 idempotent 에러 — 명시 allowlist 로만 무시.
        // (CREATE TABLE IF NOT EXISTS / CREATE TRIGGER IF NOT EXISTS 패턴 전제, 다만
        //  ALTER TABLE ADD COLUMN 은 IF NOT EXISTS 미지원이라 "duplicate column" 별도 허용.)
        //
        // ⚠️ 한시 완화 — 4차 리뷰 CRITICAL S-1 + MJ-5 역회귀 인지 (2026-04-24):
        //   `/duplicate column name/` 는 ALTER 재실행(의도) 과 CREATE TABLE 내부 컬럼 타이포
        //   (버그) 를 구분 못 한다 (SQLite 가 동일 메시지 반환). 따라서 silent skip 시
        //   반드시 `console.warn` 으로 노출 — CREATE 타이포도 로그에 뜨도록 하여 debugging
        //   경로 확보. 근본 해결은 TD-052 (migration 에 `CREATE TABLE IF NOT EXISTS`
        //   또는 `__drizzle_migrations` 해시 추적 도입).
        const msg = err instanceof Error ? err.message : String(err);
        const isIdempotentReapply =
          /already exists/i.test(msg) || /duplicate column name/i.test(msg);
        if (!isIdempotentReapply) {
          throw new Error(`migration failed (${fileName}): ${msg}`);
        }
        // silent skip 금지 — 감사 흔적 남김 (CLAUDE.md "빈 catch 금지" 정신).
        console.warn(`[migrations] idempotent skip: ${fileName} — ${msg}`);
      }
    }
  }

  return { db: wrapAsD1(raw), close: () => raw.close(), raw };
}

/** node:sqlite prepared SQL batch — shell 명령 실행 아님. */
function applySqlBatch(raw: DatabaseSync, sqlText: string): void {
  raw.exec(sqlText);
}

function wrapAsD1(raw: DatabaseSync): D1Db {
  return {
    prepare(sql: string) {
      let boundArgs: readonly unknown[] = [];
      const stmt = raw.prepare(sql);

      const prepared = {
        bind(...args: unknown[]) {
          boundArgs = args;
          return prepared;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const row = stmt.get(...toSqliteArgs(boundArgs));
          if (row === undefined || row === null) return null;
          if (colName !== undefined) {
            const val = (row as Record<string, unknown>)[colName];
            return (val === undefined ? null : val) as T | null;
          }
          return row as unknown as T;
        },
        async all<T = unknown>(): Promise<D1AllResult<T>> {
          const rows = stmt.all(...toSqliteArgs(boundArgs)) as T[];
          return { success: true, results: rows };
        },
        async run<T = unknown>() {
          const info = stmt.run(...toSqliteArgs(boundArgs));
          return {
            success: true,
            results: [] as T[],
            meta: {
              changes: Number(info.changes ?? 0),
              last_row_id: Number(info.lastInsertRowid ?? 0),
            },
          };
        },
      };
      return prepared;
    },
    async batch<T = unknown>(statements: D1Stmt[]): Promise<Array<D1RunResult<T>>> {
      // D1 프로덕션의 atomic batch 와 정합 (CR-4): BEGIN/COMMIT/ROLLBACK 으로 감쌈.
      // 이전에는 순차 run() 만 실행해 중간 실패 시 앞 문장 commit 채로 throw 되어
      // "원자적 적재" 주석과 실동작 괴리 — 테스트는 통과해도 프로덕션 정합 아님.
      // SQLite BEGIN IMMEDIATE: 쓰기 잠금 즉시 획득 (동시 writer race 차단).
      // applySqlBatch = node:sqlite raw.exec 래퍼 (child_process.exec 과 무관).
      //
      // 🚫 중첩 트랜잭션 미지원 (NC-신규 MAJOR, 2026-04-24):
      //   호출자가 이미 외부에서 BEGIN 상태인 채로 본 batch() 를 호출하면 SQLite 가
      //   `cannot start a transaction within a transaction` 으로 즉시 throw 한다.
      //   이 경우 catch 블록이 실행되기 **전**이므로 ROLLBACK 도 호출되지 않는다 —
      //   호출자의 외부 트랜잭션 정리 책임은 호출자에게 있다.
      //   현재 유일 호출자는 draft-loader.ts 로 외부 BEGIN 없음. 새 호출자 추가 시
      //   본 규약 준수 필수.
      applySqlBatch(raw, 'BEGIN IMMEDIATE');
      const results: Array<D1RunResult<T>> = [];
      try {
        for (const s of statements) {
          results.push(await s.run<T>());
        }
        applySqlBatch(raw, 'COMMIT');
      } catch (err) {
        // 안전한 롤백 — 롤백 자체가 실패해도 원래 에러를 보존한다.
        try {
          applySqlBatch(raw, 'ROLLBACK');
        } catch {
          /* rollback 실패는 원래 에러 외 추가 정보 가치 없음 */
        }
        throw err;
      }
      return results;
    },
  };
}

function toSqliteArgs(
  args: readonly unknown[],
): Array<string | number | bigint | null | Uint8Array> {
  return args.map((a) => {
    if (a === null || a === undefined) return null;
    if (typeof a === 'boolean') return a ? 1 : 0;
    if (typeof a === 'string' || typeof a === 'number' || typeof a === 'bigint') return a;
    if (a instanceof ArrayBuffer) return new Uint8Array(a);
    if (a instanceof Uint8Array) return a;
    return JSON.stringify(a);
  });
}
