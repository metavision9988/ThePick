-- ============================================================
-- 0023_rollback.sql
--
-- Reverses: migrations/0023_table_cells_pattern_h.sql
--   (ADR-032 D-PHASE2-7=α — table_cells.value_type CHECK 5종 → 6종 + nested_table_id)
--
-- 효과:
--   - table_cells.value_type CHECK 6종 → 5종 (nested_table 제거)
--   - table_cells.nested_table_id 컬럼 제거
--   - idx_table_cells_nested 인덱스 제거 (DROP TABLE 시 자동)
--
-- 결과 상태:
--   별표9 LAW-143 + 위험물 등급표 + 공인중개사 가액산정표 등 패턴-H Nested Table
--   신규 적재 차단 (CHECK 5종 위배). 기존 nested_table 셀은 본 down INSERT 단계에서
--   CHECK 위배 → 트랜잭션 ABORT (안전 우선). 본 down은 패턴-H 자체에 D1 회귀가
--   발견된 경우만 사용.
--
-- ★ 사전 체크 의무 (runbook §"0023 down 안전 체크" 참조):
--   wrangler d1 execute thepick-db-staging --remote \
--     --command "SELECT COUNT(*) FROM table_cells WHERE value_type='nested_table' OR nested_table_id IS NOT NULL;"
--   → 행 수 > 0 이면 본 down 적용 시 INSERT...SELECT 단계가 CHECK 5종 위배 → ABORT.
--   → 행 수 > 0 인 상황에서 down 강행 필요 시 nested_table 행을 다른 value_type
--     (예: text) 또는 별도 백업 테이블로 사전 이전 의무.
--
-- ★ 0024 down 선행 의무:
--   본 down 적용 전 0024 down 우선 적용 (LIFO 순서). H_nested pattern_type을
--   가진 table_structures가 살아있으면 nested_table 셀 ↔ table_structures 정합 깨짐.
--
-- 데이터 영향: 0024 down 정상 적용 후 nested_table 셀은 자동 ABORT (CHECK 5종 위배).
--
-- 적용 순서:
--   wrangler d1 execute thepick-db-staging \
--     --remote --file=docs/runbooks/migration-rollback/0023_rollback.sql
--   (production 동일, --env production)
--
-- 적용 후 의무:
--   1. d1_migrations 테이블에서 0023 row 수동 삭제
--      → DELETE FROM d1_migrations WHERE name LIKE '0023_%';
--   2. verify-engine-contracts.ts Cat 9 0023 파일 검증 FAIL 정상 (down 의도)
--   3. ontology v1.5.0 → v1.4.0 회귀 — packages/parser/src/ontology-registry.json
--      수동 갱신 필요 (CONTAINS_TABLE edge_type 제거)
-- ============================================================

-- 1. 0021 schema (value_type 5종, nested_table_id 부재) 재현
CREATE TABLE table_cells_old (
  id              TEXT PRIMARY KEY,
  table_id        TEXT NOT NULL REFERENCES table_structures(id),
  row_id          TEXT NOT NULL REFERENCES table_headers(id),
  col_id          TEXT NOT NULL REFERENCES table_headers(id),
  value_text      TEXT,
  value_type      TEXT NOT NULL CHECK (value_type IN ('text','number','formula','na','merged_ref')),
  formula_id      TEXT REFERENCES formulas(id),
  merged_with_id  TEXT REFERENCES table_cells(id),
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  CHECK (id GLOB 'TCELL-[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (
    (value_type = 'formula'    AND formula_id IS NOT NULL) OR
    (value_type = 'merged_ref' AND merged_with_id IS NOT NULL) OR
    (value_type IN ('text','number','na'))
  ),
  UNIQUE (table_id, row_id, col_id)
);

-- 2. 데이터 이전 — nested_table 셀은 CHECK 5종 위배 → 자동 ABORT
INSERT INTO table_cells_old (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, created_at)
  SELECT id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, created_at
  FROM table_cells;

-- 3. 기존 table_cells 제거 (인덱스 자동 삭제 — idx_table_cells_table_row_col / table_value /
--    formula / nested / value_partial / merged 모두 DROP TABLE 시 사라짐)
DROP TABLE table_cells;

-- 4. 새 table_cells 정식 이름 부여 (self-ref FK merged_with_id → table_cells 자동 정합)
ALTER TABLE table_cells_old RENAME TO table_cells;

-- 5. 인덱스 재생성 (0021 정합 — 0025 partial index는 별도 0025_rollback에서 처리)
CREATE INDEX IF NOT EXISTS idx_table_cells_table_row_col ON table_cells(table_id, row_id, col_id);
CREATE INDEX IF NOT EXISTS idx_table_cells_table_value  ON table_cells(table_id, value_type);
CREATE INDEX IF NOT EXISTS idx_table_cells_formula      ON table_cells(formula_id);
