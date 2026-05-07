-- ============================================================
-- 0021_table_as_micro_kg.sql
--
-- ADR-032 Accepted (2026-05-07 Session 050) — Table-as-Micro-KG 도입
-- 다중 자격증 비정형 표 정확 이해/재현 (loss-evaluator + 공인중개사 + 위험물 + 소방 + 전기 도메인 무관)
--
-- 배경:
--   진산 발화 (Session 049 후반부): "다른 자격증에서도 2차 시험 문제는 표 형식 출제 多 /
--   비정형 표 정확 이해 + 재현 능력 = 본 프로젝트 핵심 / 엔진 + BATCH 처리에 반드시 반영".
--   현 ontology v1.3.0 = 7 node_types — 표 분해 영역 부재. BATCH 처리 LLM 직접 추출 시
--   표 본문이 텍스트로 변환되어 단일 LAW/CONCEPT 노드화 → 셀 의미 (행×열 교차점) 완전 손실.
--
-- D-TABLE 진산 spot check (Session 050, ADR-032 §"D-TABLE 결정 영속"):
--   D-TABLE-1=α  ID 패턴 TBL/TROW/TCOL/TCELL prefix (TC- topic_cluster 충돌 회피)
--   D-TABLE-2=α  4 정규화 테이블 (RAG 정밀도 우선, JSON 단일 link table 배제)
--   D-TABLE-3=β  기존 BATCH 재추출 = BATCH-1+6+7+R1 영향 큰 영역만 (Phase 2)
--   D-TABLE-4=α  신규 BATCH부터 적용 + 기존 carry-over 점진
--   D-TABLE-5=β→α  Phase 1 진산 직접 spot check / Phase 2 admin-web G5.5 UI
--   D-TABLE-6=β  RAG 검색 강화 = Phase 2 데이터 적재 후 Vectorize 인덱싱
--
-- 책임:
--   1. table_structures (표 메타 + 패턴 7종 분류 + G5.5 인간 검수 영역)
--   2. table_headers (행/열 헤더 + 다중 헤더 트리 — patterns B/C 지원)
--   3. table_cells (셀 본문 + value_type 5종 + 산식 셀 FK + 셀 병합 ref — pattern D)
--   4. table_node_links (표 ↔ knowledge_nodes 다대다 — 추출 출처 / 참조 / SUPERSEDES)
--   5. RAG/검색 인덱스 (table_id 회귀, axis filter, related_node_id 역방향)
--
-- ID 패턴 (ontology v1.4.0):
--   TABLE       ^TBL-\d{3}$              — 999 표 한도
--   ROW_HEADER  ^TROW-\d{3}-\d{2}$        — 표별 99 행 한도
--   COL_HEADER  ^TCOL-\d{3}-\d{2}$        — 표별 99 열 한도
--   CELL        ^TCELL-\d{3}-\d{2}-\d{2}$ — 표별 99×99 셀 한도
--
-- 호환성:
--   - 기존 0010~0019 영향 0 (별도 신규 테이블 4종)
--   - knowledge_nodes 794건 + edges 1274건 + formulas 157건 영향 0
--   - Phase 2 BATCH 재추출 시 INSERT 패턴만 활성 (UPDATE 무관)
--
-- 멀티시험 정합 (ADR-007 Year 2 zero-cost):
--   - 4 테이블 모두 도메인 무관 schema (table_structures.source 컬럼만 시험별 구분)
--   - Year 2 exam_id 컬럼 추가 시 ALTER TABLE ADD COLUMN exam_id TEXT NOT NULL DEFAULT '<id>'
--     동일 패턴 (handoff Hard Rule 16 정합)
--
-- 진산 인간 승인:
--   - plan: docs/plans/table-processing-architecture-v1.md
--   - ADR : docs/adr/ADR-032-table-as-micro-kg.md (Accepted 2026-05-07)
--   - Session 050 트리거: "권장대로 진행"
-- ============================================================

-- 1) table_structures — 표 메타 + 패턴 분류
CREATE TABLE IF NOT EXISTS table_structures (
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

-- 2) table_headers — 행/열 헤더 (다중 헤더 트리 지원)
CREATE TABLE IF NOT EXISTS table_headers (
  id          TEXT PRIMARY KEY,
  table_id    TEXT NOT NULL REFERENCES table_structures(id),
  axis        TEXT NOT NULL CHECK (axis IN ('row','column')),
  level       INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 3),
  index_pos   INTEGER NOT NULL CHECK (index_pos >= 1 AND index_pos <= 99),
  parent_id   TEXT REFERENCES table_headers(id),
  text        TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  CHECK (
    (axis='row'    AND id GLOB 'TROW-[0-9][0-9][0-9]-[0-9][0-9]') OR
    (axis='column' AND id GLOB 'TCOL-[0-9][0-9][0-9]-[0-9][0-9]')
  ),
  UNIQUE (table_id, axis, level, index_pos)
);

-- 3) table_cells — 셀 본문 (산식 셀 + 셀 병합 + N/A 지원)
CREATE TABLE IF NOT EXISTS table_cells (
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

-- 4) table_node_links — 표 ↔ knowledge_nodes 다대다
CREATE TABLE IF NOT EXISTS table_node_links (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id          TEXT NOT NULL REFERENCES table_structures(id),
  related_node_id   TEXT NOT NULL REFERENCES knowledge_nodes(id),
  relation_type     TEXT NOT NULL CHECK (relation_type IN ('extracted_from','referenced_by','supersedes')),
  created_at        INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE (table_id, related_node_id, relation_type)
);

-- ============================================================
-- 인덱스 (RAG 검색 + 인간 검수 회귀 쿼리)
-- ============================================================

-- table_structures: G5.5 검수 + 패턴별 통계
CREATE INDEX IF NOT EXISTS idx_table_structures_status      ON table_structures(status);
CREATE INDEX IF NOT EXISTS idx_table_structures_pattern     ON table_structures(pattern_type);
CREATE INDEX IF NOT EXISTS idx_table_structures_source_node ON table_structures(source_node_id);

-- table_headers: 표 회귀 + axis filter
CREATE INDEX IF NOT EXISTS idx_table_headers_table_axis ON table_headers(table_id, axis, level, index_pos);
CREATE INDEX IF NOT EXISTS idx_table_headers_parent     ON table_headers(parent_id);

-- table_cells: cell-level RAG 검색 (pattern_type별 + row/col 회귀)
CREATE INDEX IF NOT EXISTS idx_table_cells_table_row_col ON table_cells(table_id, row_id, col_id);
CREATE INDEX IF NOT EXISTS idx_table_cells_table_value  ON table_cells(table_id, value_type);
CREATE INDEX IF NOT EXISTS idx_table_cells_formula      ON table_cells(formula_id);

-- table_node_links: 역방향 (knowledge_nodes 노드 -> 참조 표)
CREATE INDEX IF NOT EXISTS idx_table_node_links_related ON table_node_links(related_node_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_table_node_links_table   ON table_node_links(table_id, relation_type);
