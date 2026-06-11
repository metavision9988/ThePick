/**
 * schema.ts ↔ migrations 동기 계약 (NC-1) — design-audit RC-5 드리프트 동기 (2026-06-11).
 *
 * NC-1 정책: schema.ts 는 타입 파생 전용 정본이며 migrations/*.sql 에 수동 동기.
 * 구 헤더('14 tables')가 ~1.5개월 stale 였고 핵심 필터 컬럼(is_current_active)이
 * 타입에 없던 드리프트를 기계 게이트로 재발 차단한다.
 *
 * 검증 2축:
 *   ① 테이블 전수: migrations CREATE TABLE 집합 = schema.ts sqliteTable 선언 집합
 *      (재생성 임시 `_new` 테이블 제외)
 *   ② 핵심 raw SQL 소비 컬럼: approved-nodes-sql 등이 사용하는 is_current_active /
 *      superseded_by 가 해당 테이블 타입에 존재
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  batchRuns,
  constants,
  formulas,
  knowledgeNodes,
  reviewDecisions,
  reviewQueue,
} from '../schema';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'migrations');
const SCHEMA_PATH = join(REPO_ROOT, 'apps/api/src/db/schema.ts');

function migrationTables(): Set<string> {
  const tables = new Set<string>();
  for (const f of readdirSync(MIGRATIONS_DIR)) {
    if (!/^\d{4}_.+\.sql$/.test(f)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf-8');
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)/gi)) {
      const name = m[1]!.toLowerCase();
      if (!name.endsWith('_new')) tables.add(name); // 12-step 재생성 임시 테이블 제외
    }
  }
  return tables;
}

function declaredTables(): Set<string> {
  const src = readFileSync(SCHEMA_PATH, 'utf-8');
  return new Set([...src.matchAll(/sqliteTable\(\s*'([a-z_]+)'/g)].map((m) => m[1]!));
}

describe('NC-1 — schema.ts ↔ migrations 테이블 전수 동기', () => {
  it('migrations CREATE TABLE 전수가 schema.ts 에 선언됨 (미선언 0)', () => {
    const mig = migrationTables();
    const decl = declaredTables();
    const undeclared = [...mig].filter((t) => !decl.has(t)).sort();
    expect(undeclared).toEqual([]); // 신규 마이그 추가 시 schema.ts 동시 갱신 의무
  });

  it('schema.ts 선언이 migrations 에 없는 유령 테이블 0', () => {
    const mig = migrationTables();
    const decl = declaredTables();
    const phantom = [...decl].filter((t) => !mig.has(t)).sort();
    expect(phantom).toEqual([]);
  });
});

describe('NC-1 — 핵심 raw SQL 소비 컬럼의 타입 존재 (RC-5 동기 회귀 차단)', () => {
  it('is_current_active (migrations/0013, approved-nodes-sql 핵심 필터) — nodes/formulas/constants', () => {
    expect(knowledgeNodes.isCurrentActive).toBeDefined();
    expect(formulas.isCurrentActive).toBeDefined();
    expect(constants.isCurrentActive).toBeDefined();
  });

  it('constants.superseded_by (migrations/0014:134)', () => {
    expect(constants.supersededBy).toBeDefined();
  });

  it('신규 동기 3테이블의 PK 컬럼 실재', () => {
    expect(batchRuns.batchRunId).toBeDefined();
    expect(reviewDecisions.id).toBeDefined();
    expect(reviewQueue.id).toBeDefined();
  });
});
