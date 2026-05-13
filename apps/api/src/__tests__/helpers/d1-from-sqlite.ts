/**
 * 실제 SQLite 기반 D1Database 호환 wrapper (node:sqlite, Node 22 내장).
 *
 * 목적: Step 1-4 시나리오 리뷰 Critical C-1, C-2 해소 —
 *   Fake D1 Map 기반 시뮬레이션 대신 진짜 SQLite 엔진 위에서 migrations 실행.
 *   `migrations/0006 ~ 0009` 의 NOT NULL / UNIQUE / CASCADE / BEFORE INSERT/UPDATE
 *   트리거 15종이 전부 실제 작동하는 환경에서 시나리오 검증.
 *
 * 주의: node:sqlite 의 DatabaseSync.exec() 는 prepared SQL API (child_process.exec 과 무관).
 * 정적 SQL 문자열/migration 파일 내용만 전달. command injection 경로 없음.
 *
 * Cloudflare D1 은 내부적으로 SQLite 이므로 node:sqlite 와 호환 패턴 99% 일치.
 * 차이점 (허용 범위):
 *   - D1 은 async, node:sqlite 는 sync → wrapper 가 async 로 포장
 *   - D1 에러 메시지 포맷 vs SQLite → `D1_UNIQUE_CONSTRAINT_PATTERN` 이 양쪽 매칭
 *
 * 의존성 추가 없음 — `node:sqlite` Node 22+ 내장.
 */

// node:sqlite 는 Node 22.5+ stable 이나 @types/node 20.x 에 타입 미포함 (22.9+ 필요).
// 루트 @types/node 업그레이드는 다른 패키지 영향 → 본 테스트 헬퍼 한정 type import 로 우회.
// @ts-expect-error — Node 22 runtime 보장 (package.json engines)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** migrations 디렉토리 경로 — apps/api/src/__tests__/helpers 기준 상대 경로. */
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', '..', '..', 'migrations');

/**
 * 시나리오 테스트에 필요한 migration 만 로드.
 * 1차 5-페르소나 quality MIN-Q1 영속 + Phase 1 5-페르소나 CRIT-QPHASE1-3 흡수 — 0013~0018 추가.
 * Step 039 4-Pass CRIT-1 (Pass 1 + 2 일치) 흡수 — 0019 추가 (ADR-030 dual-schema dormancy 차단).
 *
 * ★ TD-API-001 (Step 036 silent-failure-hunter MAJOR-3) 누적 부채:
 *   본 배열 + scripts/verify-engine-contracts.ts 의 readdir 자동 wrapper 가 분리되어
 *   향후 마이그레이션 추가 시 본 배열 갱신 망각하면 동일 dual-schema dormancy 회귀 위험.
 *   Sprint 2 초기 자동 readdir 통합 의무 (handoff §주의사항 + WBS §5 ledger).
 */
const SCENARIO_MIGRATIONS = [
  '0001_initial_schema.sql',
  '0002_1st_exam_extension.sql',
  '0003_temporal_guard_not_null.sql',
  '0004_temporal_guard_extension.sql',
  '0005_not_null_triggers_completion.sql',
  '0006_users_and_auth.sql',
  '0007_users_strict_hardening.sql',
  '0008_webhook_events.sql',
  '0009_sessions.sql',
  '0010_status_transitions_and_page_ref_guard.sql',
  '0011_revision_2026_constants_seed.sql',
  '0012_rate_limits.sql',
  '0013_active_view_and_review_decisions.sql',
  '0014_phase05_critical_hardening.sql',
  '0015_batch_runs.sql',
  '0016_knowledge_nodes_batch_idempotency.sql',
  '0017_engine_telemetry.sql',
  '0018_enforce_draft_only_insert.sql',
  '0019_knowledge_nodes_page_chapter_meta.sql',
  // ★ ADR-035: PBKDF2 iterations Workers 호환 100k (0007 trigger >= 600000 → >= 100000 갱신).
  // 본 마이그레이션이 0007 이후 적용되어야 인증 시나리오 통과 (Session 065).
  '0028_pbkdf2_iterations_workers_compat.sql',
  // ★ Session 066 5-Persona C-06: user_progress (user_id, card_id, card_type) partial UNIQUE
  // + (user_id, node_id, card_type) concept partial UNIQUE. Year 2 Phase 4 마이그레이션 폭탄 예방
  // (Persona4-BCRIT1) + lookup 가속 (Persona2-PCRIT1) + 4-Pass M-1 catch 분기 활성화.
  '0029_user_progress_unique_constraint.sql',
  // Session 068 Stage C C-12 — login_history audit trail
  '0030_login_history.sql',
  // Session 068 Stage E P-α C-α-2 — login_history.event_type (login/refresh 분리)
  '0031_login_history_event_type.sql',
  // Session 069 Step 3-UX-4 — Phase 3 학습 UX 스키마 4 chain (plan §13 D1/D2/D7 lock)
  '0032_exam_questions_input_type.sql',
  '0033_user_progress_fsrs_extension.sql',
  '0034_study_reviews.sql',
  '0035_study_sessions_streak.sql',
  // Step 3-UX-6c-2 4-Pass M-1 흡수 — computeWeakDelta `WHERE session_id = ? AND user_id = ?` 인덱스
  '0036_study_reviews_session_index.sql',
];

export interface SqliteBackedD1 {
  readonly db: D1Database;
  readonly close: () => void;
  readonly raw: DatabaseSync;
}

/**
 * In-memory SQLite 에 migrations 를 적용한 D1 호환 wrapper 생성.
 * node:sqlite DatabaseSync 의 SQL prepared API 만 사용 (shell 명령 실행 없음).
 */
export function createD1FromSqlite(
  migrationsToApply: readonly string[] = SCENARIO_MIGRATIONS,
): SqliteBackedD1 {
  const raw = new DatabaseSync(':memory:');

  // PRAGMA foreign_keys = ON — CASCADE FK, ON DELETE 동작 활성화
  applySqlBatch(raw, 'PRAGMA foreign_keys = ON');

  // migrations 순차 적용
  for (const fileName of migrationsToApply) {
    const sql = readFileSync(join(MIGRATIONS_DIR, fileName), 'utf-8');
    try {
      applySqlBatch(raw, sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`migration failed (${fileName}): ${msg}`);
    }
  }

  const db = wrapAsD1(raw);
  const close = (): void => {
    raw.close();
  };
  return { db, close, raw };
}

export function createD1FromAllMigrations(): SqliteBackedD1 {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return createD1FromSqlite(files);
}

/**
 * SQL batch 를 DatabaseSync 에 적용.
 * node:sqlite SQL prepared API (DatabaseSync.exec) 이며 shell 명령과 무관.
 */
function applySqlBatch(raw: DatabaseSync, sqlText: string): void {
  raw.exec(sqlText);
}

// ---------------------------------------------------------------------------
// D1 interface wrapper
// ---------------------------------------------------------------------------

function wrapAsD1(raw: DatabaseSync): D1Database {
  return {
    prepare(sql: string): D1PreparedStatement {
      let boundArgs: readonly unknown[] = [];
      const stmt = raw.prepare(sql);

      const prepared: D1PreparedStatement = {
        bind(...args: unknown[]): D1PreparedStatement {
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
        async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          const info = stmt.run(...toSqliteArgs(boundArgs));
          return {
            success: true,
            meta: {
              changes: Number(info.changes ?? 0),
              last_row_id: Number(info.lastInsertRowid ?? 0),
              duration: 0,
              size_after: 0,
              rows_read: 0,
              rows_written: Number(info.changes ?? 0),
              served_by: 'node-sqlite',
              changed_db: true,
            },
            results: [] as T[],
          };
        },
        async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          const rows = stmt.all(...toSqliteArgs(boundArgs)) as T[];
          return {
            success: true,
            meta: {
              changes: 0,
              last_row_id: 0,
              duration: 0,
              size_after: 0,
              rows_read: rows.length,
              rows_written: 0,
              served_by: 'node-sqlite',
              changed_db: false,
            },
            results: rows,
          };
        },
        async raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<T[]> {
          const rows = stmt.all(...toSqliteArgs(boundArgs));
          return rows.map((r: unknown) => Object.values(r as object)) as T[];
        },
      } as unknown as D1PreparedStatement;

      return prepared;
    },
    async exec(sqlText: string): Promise<D1ExecResult> {
      applySqlBatch(raw, sqlText);
      return { count: 0, duration: 0 };
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const s of statements) {
        const r = await s.run<T>();
        results.push(r);
      }
      return results;
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error('dump() not implemented in sqlite-backed D1 wrapper');
    },
    withSession() {
      throw new Error('withSession() not implemented in sqlite-backed D1 wrapper');
    },
  } as unknown as D1Database;
}

/** D1 bind 인자 → node:sqlite 허용 타입 변환. */
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
