-- ============================================================
-- 0024_table_structures_pattern_h.sql
--
-- ADR-032 §"패턴 카탈로그 8종" — 패턴-H Nested Table 정합 완성
-- table_structures.pattern_type CHECK 7종 → 8종 ('H_nested' 추가)
--
-- 배경 (Session 052 entry 4-Pass 독립 리뷰 CRIT-A 흡수):
--   Session 051 Phase 2 진입 게이트는 패턴-H 셀 단(table_cells.value_type='nested_table')
--   까지만 흡수했으나 table_structures.pattern_type은 7종 (A~G_temporal) 그대로 유지.
--   batch-processor 시스템 프롬프트는 8종 (A~H_nested) 분류를 LLM에 명시 → LLM이
--   pattern_type='H_nested' 출력 시 schema-validator는 PASS이나 D1 INSERT 단계에서
--   CHECK constraint failure로 BATCH 전체 rollback 발생. 4 독립 에이전트 모두 동일 지적.
--
-- 결정 (Session 052 진산 "권장안으로 진행"):
--   1. table_structures.pattern_type CHECK 7종 → 8종 ('H_nested' 추가)
--   2. SQLite 12-step procedure (CHECK 변경 → table 재생성 의무)
--   3. 0021 적재 row 0건 (Phase 2 BATCH 재추출 전) → 데이터 손실 위험 0
--   4. self-ref FK 부재 (source_node_id → knowledge_nodes 외부 참조만) — RENAME 단순
--   5. BEGIN/COMMIT 미포함 (TD-S49-1 정합, wrangler 자동 wrap)
--
-- 호환성:
--   - 0021 4 테이블 영향 0 (table_headers/cells/node_links 그대로)
--   - 0022 trigger prevent_table_structures_critical_update — DROP TABLE 시 자동 제거,
--     본 마이그레이션 종착부에서 재생성 의무
--   - 0023 table_cells 영향 0 (별도 테이블)
--   - knowledge_nodes / formulas 영향 0 (FK source_node_id는 RENAME 후 자동 정합)
--
-- 검증:
--   - Cat 9 (scripts/verify-engine-contracts.ts) v1.5.0 + 0024 파일 존재 + 8 패턴 enum
--   - 차세션 053 entry verify run PASS 6/0/1 일치 의무
-- ============================================================

-- 12-step procedure: table_structures 재생성 (CHECK pattern_type 7종 → 8종)

-- 1. 새 schema (pattern_type 8종 + H_nested 추가)
CREATE TABLE table_structures_new (
  id                TEXT PRIMARY KEY,
  source_node_id    TEXT REFERENCES knowledge_nodes(id),
  title             TEXT NOT NULL,
  pattern_type      TEXT NOT NULL CHECK (pattern_type IN (
                      'A_simple',
                      'B_2level',
                      'C_3level',
                      'D_merged',
                      'E_na',
                      'F_formula',
                      'G_temporal',
                      'H_nested'
                    )),
  row_count         INTEGER NOT NULL CHECK (row_count > 0 AND row_count <= 99),
  col_count         INTEGER NOT NULL CHECK (col_count > 0 AND col_count <= 99),
  source            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','flagged','deprecated')),
  human_reviewed_at INTEGER,
  created_at        INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at        INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  CHECK (id GLOB 'TBL-[0-9][0-9][0-9]')
);

-- 2. 데이터 이전 (0건이지만 12-step 정합 — 미래 회귀 BATCH 적재 시 패턴 보존)
INSERT INTO table_structures_new (id, source_node_id, title, pattern_type, row_count, col_count, source, status, human_reviewed_at, created_at, updated_at)
  SELECT id, source_node_id, title, pattern_type, row_count, col_count, source, status, human_reviewed_at, created_at, updated_at
  FROM table_structures;

-- 3. 의존 trigger 제거 (0022_table_structures_update_guard 본 마이그레이션에서 재생성 의무)
DROP TRIGGER IF EXISTS prevent_table_structures_critical_update;

-- 4. 기존 table_structures 제거 (관련 인덱스도 자동 삭제)
DROP TABLE table_structures;

-- 5. 새 table_structures 정식 이름 부여 (FK source_node_id → knowledge_nodes 자동 정합)
ALTER TABLE table_structures_new RENAME TO table_structures;

-- 6. 인덱스 재생성 (0021 정합)
CREATE INDEX IF NOT EXISTS idx_table_structures_status      ON table_structures(status);
CREATE INDEX IF NOT EXISTS idx_table_structures_pattern     ON table_structures(pattern_type);
CREATE INDEX IF NOT EXISTS idx_table_structures_source_node ON table_structures(source_node_id);

-- 7. 0022 trigger 재생성 — D-PHASE2-1=α prevent_table_structures_critical_update
--    (table_structures DROP 시 자동 제거되므로 본 마이그레이션이 책임)
CREATE TRIGGER prevent_table_structures_critical_update
BEFORE UPDATE OF id, source_node_id, title, pattern_type, row_count, col_count, source ON table_structures
BEGIN
  SELECT RAISE(ABORT, 'table_structures critical fields are immutable (Hard Rule 28: append-only). Use status update or new TBL-NNN for revisions.');
END;
