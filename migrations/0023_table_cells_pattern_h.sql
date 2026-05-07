-- ============================================================
-- 0023_table_cells_pattern_h.sql
--
-- ADR-032 D-PHASE2-7=α (Session 050 종착 후반부 진산 발화 "표 안에 표 형태도 반영")
-- 패턴-H Nested Table 지원 — table_cells.value_type 5종 → 6종 + nested_table_id 컬럼
--
-- 배경:
--   진산 발화 (Session 050 종착 직전): "갑자기 생각나서 알려주는데.. 표 안에 표가 있는 형태가 있거든.. 그것도 반영을 해줘"
--   별표9 LAW-143 + 위험물 등급표 + 공인중개사 가액산정표 등 다중 자격증 핵심 패턴.
--   현 0021 schema = value_type 5종 (text/number/formula/na/merged_ref) — 셀 내부 표 중첩 미지원.
--
-- D-PHASE2-7=α 결정 (Session 050 후반부 진산 "권장대로 진행" 일괄):
--   1. table_cells.value_type CHECK 5종 → 6종 ('nested_table' 추가)
--   2. table_cells.nested_table_id TEXT REFERENCES table_structures(id) 컬럼 추가
--   3. CHECK (value_type='nested_table' ⇒ nested_table_id NOT NULL)
--   4. ontology v1.4.0 → v1.5.0 신규 edge_type CONTAINS_TABLE (CELL → TABLE) 정합
--
-- SQLite 12-step procedure 사용 사유:
--   - SQLite ALTER TABLE는 CHECK 제약 변경 불가 (https://www.sqlite.org/lang_altertable.html#otheralter)
--   - value_type CHECK 5종 → 6종 + 복합 CHECK 갱신 의무 → table 재생성 필요
--   - 0021 적재 row 0건 (Phase 2 BATCH 재추출 전) → 데이터 손실 위험 0
--   - self-ref FK (merged_with_id REFERENCES table_cells(id)) 보존 패턴 정합
--
-- 호환성:
--   - 0021 4 테이블 영향 0 (table_structures/headers/node_links 그대로)
--   - 0022 trigger prevent_table_structures_critical_update 영향 0 (table_cells 비대상)
--   - knowledge_nodes / formulas / constants 영향 0
--   - Phase 2 BATCH 재추출 시 패턴-H 인식 → nested_table_id 자동 적재
--
-- 검증:
--   - Cat 9 (scripts/verify-engine-contracts.ts) v1.5.0 + 0023 파일 존재 + edge_types=18
--   - 차세션 053 entry verify run PASS 6/0/1 일치 의무
-- ============================================================

-- 12-step procedure: table_cells 재생성 (CHECK 변경 + nested_table_id 컬럼 추가)

-- 1. 새 schema (value_type 6종 + nested_table_id + 갱신된 복합 CHECK)
CREATE TABLE table_cells_new (
  id              TEXT PRIMARY KEY,
  table_id        TEXT NOT NULL REFERENCES table_structures(id),
  row_id          TEXT NOT NULL REFERENCES table_headers(id),
  col_id          TEXT NOT NULL REFERENCES table_headers(id),
  value_text      TEXT,
  value_type      TEXT NOT NULL CHECK (value_type IN ('text','number','formula','na','merged_ref','nested_table')),
  formula_id      TEXT REFERENCES formulas(id),
  merged_with_id  TEXT REFERENCES table_cells(id),
  nested_table_id TEXT REFERENCES table_structures(id),
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  CHECK (id GLOB 'TCELL-[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (
    (value_type = 'formula'      AND formula_id      IS NOT NULL) OR
    (value_type = 'merged_ref'   AND merged_with_id  IS NOT NULL) OR
    (value_type = 'nested_table' AND nested_table_id IS NOT NULL) OR
    (value_type IN ('text','number','na'))
  ),
  UNIQUE (table_id, row_id, col_id)
);

-- 2. 데이터 이전 (0건이지만 12-step 정합 — 미래 회귀 BATCH 적재 시 패턴 보존)
INSERT INTO table_cells_new (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, created_at)
  SELECT id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, created_at
  FROM table_cells;

-- 3. 기존 table_cells 제거 (관련 인덱스도 자동 삭제)
DROP TABLE table_cells;

-- 4. 새 table_cells 정식 이름 부여 (self-ref FK merged_with_id 자동 정합)
ALTER TABLE table_cells_new RENAME TO table_cells;

-- 5. 인덱스 재생성 (0021 정합)
CREATE INDEX IF NOT EXISTS idx_table_cells_table_row_col ON table_cells(table_id, row_id, col_id);
CREATE INDEX IF NOT EXISTS idx_table_cells_table_value  ON table_cells(table_id, value_type);
CREATE INDEX IF NOT EXISTS idx_table_cells_formula      ON table_cells(formula_id);

-- 6. 신규 인덱스 — nested_table_id 회귀 (패턴-H: nested table 역방향 검색)
CREATE INDEX IF NOT EXISTS idx_table_cells_nested ON table_cells(nested_table_id);
