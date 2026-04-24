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
        // 이미 적용된 마이그레이션은 re-run 시 "table already exists" — 무시해도 안전
        // (CREATE TABLE IF NOT EXISTS / CREATE TRIGGER IF NOT EXISTS 패턴 전제).
        const msg = err instanceof Error ? err.message : String(err);
        if (!/already exists/i.test(msg)) {
          throw new Error(`migration failed (${fileName}): ${msg}`);
        }
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
      const results: Array<D1RunResult<T>> = [];
      for (const s of statements) {
        results.push(await s.run<T>());
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
