-- ============================================================
-- 0024_rollback.sql
--
-- Reverses: migrations/0024_table_structures_pattern_h.sql
--   (ADR-032 D-PHASE2-8=α — table_structures.pattern_type CHECK 7종 → 8종)
--
-- 효과:
--   - table_structures.pattern_type CHECK 8종 → 7종 (H_nested 제거)
--   - 0024 forward가 자체 재생성한 trigger 제거
--   - 0022 forward 정의의 prevent_table_structures_critical_update trigger 복원
--     (메시지: 'INSERT+SUPERSEDES 패턴 사용 의무')
--
-- 결과 상태:
--   batch-processor 시스템 프롬프트가 H_nested 분류 LLM에 명시하더라도
--   D1 INSERT 단계에서 CHECK 위배 → BATCH 전체 rollback 발생 (Session 052 entry 4-Pass
--   CRIT-A 회귀). 본 down은 CHECK 8종 제약 자체에 D1 회귀가 발견된 경우만 사용.
--
-- ★ 사전 체크 의무 (runbook §"0024 down 안전 체크" 참조):
--   wrangler d1 execute thepick-db-staging --remote \
--     --command "SELECT COUNT(*) FROM table_structures WHERE pattern_type='H_nested';"
--   → 행 수 > 0 이면 본 down 적용 시 INSERT...SELECT 단계가 CHECK 7종 위배 →
--     트랜잭션 ABORT + DDL 변경 전체 롤백. 의도된 동작 (안전 우선).
--   → 행 수 > 0 인 상황에서 down 강행 필요 시 H_nested 행을 다른 패턴 또는
--     별도 백업 테이블로 사전 이전 의무.
--
-- 데이터 영향: 적재된 H_nested 행은 INSERT...SELECT 단계에서 자동 ABORT (안전).
--
-- 적용 순서:
--   wrangler d1 execute thepick-db-staging \
--     --remote --file=docs/runbooks/migration-rollback/0024_rollback.sql
--   (production 동일, --env production)
--
-- 적용 후 의무:
--   1. d1_migrations 테이블에서 0024 row 수동 삭제
--      → DELETE FROM d1_migrations WHERE name LIKE '0024_%';
--   2. verify-engine-contracts.ts Cat 9 8 패턴 enum 검증 FAIL 정상 (down 의도)
--   3. handoff에 H_nested 적재 row 손실 여부 + 사유 영속
-- ============================================================

-- 1. 0021 schema (pattern_type 7종) 재현
CREATE TABLE table_structures_old (
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
                      'G_temporal'
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

-- 2. 데이터 이전 — H_nested 행은 CHECK 7종 위배 → 자동 ABORT (트랜잭션 안전 롤백)
INSERT INTO table_structures_old (id, source_node_id, title, pattern_type, row_count, col_count, source, status, human_reviewed_at, created_at, updated_at)
  SELECT id, source_node_id, title, pattern_type, row_count, col_count, source, status, human_reviewed_at, created_at, updated_at
  FROM table_structures;

-- 3. 0024 forward가 재생성한 trigger 제거
DROP TRIGGER IF EXISTS prevent_table_structures_critical_update;

-- 4. 기존 table_structures 제거 (인덱스 자동 삭제)
DROP TABLE table_structures;

-- 5. 새 table_structures 정식 이름 부여 (FK source_node_id → knowledge_nodes 자동 정합)
ALTER TABLE table_structures_old RENAME TO table_structures;

-- 6. 인덱스 재생성 (0021 정합)
CREATE INDEX IF NOT EXISTS idx_table_structures_status      ON table_structures(status);
CREATE INDEX IF NOT EXISTS idx_table_structures_pattern     ON table_structures(pattern_type);
CREATE INDEX IF NOT EXISTS idx_table_structures_source_node ON table_structures(source_node_id);

-- 7. 0022 forward 정의의 trigger 복원 (D-PHASE2-1=α 원래 메시지)
CREATE TRIGGER IF NOT EXISTS prevent_table_structures_critical_update
BEFORE UPDATE OF id, source_node_id, title, pattern_type, row_count, col_count, source
ON table_structures
BEGIN
  SELECT RAISE(ABORT, 'table_structures critical columns are INSERT-only (Hard Rule 28 / ADR-032 D-PHASE2-1=α). Use INSERT + SUPERSEDES pattern via table_node_links(relation_type=''supersedes'') instead. Allowed UPDATE: status / human_reviewed_at / updated_at.');
END;
