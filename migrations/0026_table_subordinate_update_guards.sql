-- ============================================================
-- 0026_table_subordinate_update_guards.sql
--
-- ADR-032 §"Temporal 정합" — Session 052 5-Persona BA-C2 흡수
-- table_cells / table_headers / table_node_links UPDATE 차단 trigger 3종
--
-- 배경 (Session 052 5-Persona Persona 4 backend-architect BA-C2):
--   0022 prevent_table_structures_critical_update trigger = table_structures 한정.
--   table_cells의 value_text/value_type/formula_id/nested_table_id, table_headers의
--   text/parent_id, table_node_links의 relation_type 모두 UPDATE 무차단 = Hard Rule
--   28 (Temporal Graph) 일관성 위배. G5.5 검수자가 셀 직접 UPDATE → revision history
--   0 → 감사 로그 부재. knowledge_nodes/formulas와 동급 강제 의무.
--
-- 결정 (Session 052 진산 "중요하고 긴급한 거 부터 순차적으로 모두 처리"):
--   1. table_cells UPDATE 시 value_text 외 모든 critical 컬럼 차단
--      (value_text는 admin G5.5 오타 수정 허용 — D-PHASE2-9=α 후속 결정 carry-over)
--      ★ 본 trigger는 안전 우선 채택: critical 컬럼 (id/table_id/row_id/col_id/
--        value_type/formula_id/merged_with_id/nested_table_id) 모두 UPDATE 차단
--   2. table_headers UPDATE 시 text 외 모든 critical 컬럼 차단
--      (text는 오타 수정 허용)
--   3. table_node_links UPDATE 전면 차단 (관계 변경 = SUPERSEDES 패턴)
--
-- 호환성:
--   - 기존 0021/0022/0023/0024 영향 0
--   - 적재 row 0건 (Phase 2 BATCH 재추출 전) → 데이터 영향 0
--   - INSERT 무관 (UPDATE 한정)
--   - DELETE 무관 (Phase 2A 종착 시 재검토)
--
-- 검증:
--   - Cat 9 (scripts/verify-engine-contracts.ts) 0026 파일 존재 + trigger 3종 D1 SELECT
--   - 차세션 053 entry verify run PASS 6/0/1 일치 의무
-- ============================================================

-- 1. table_cells critical UPDATE 차단
--    허용 컬럼: value_text (admin G5.5 오타 수정), created_at (자동 갱신 X)
--    차단 컬럼: id, table_id, row_id, col_id, value_type, formula_id, merged_with_id, nested_table_id
CREATE TRIGGER prevent_table_cells_critical_update
BEFORE UPDATE OF id, table_id, row_id, col_id, value_type, formula_id, merged_with_id, nested_table_id ON table_cells
BEGIN
  SELECT RAISE(ABORT, 'table_cells critical fields are immutable (Hard Rule 28: append-only). Use new TCELL-NNN-NN-NN with SUPERSEDES pattern. Only value_text mutation is allowed for admin G5.5 typo correction.');
END;

-- 2. table_headers critical UPDATE 차단
--    허용 컬럼: text (오타 수정)
--    차단 컬럼: id, table_id, axis, level, index_pos, parent_id
CREATE TRIGGER prevent_table_headers_critical_update
BEFORE UPDATE OF id, table_id, axis, level, index_pos, parent_id ON table_headers
BEGIN
  SELECT RAISE(ABORT, 'table_headers critical fields are immutable (Hard Rule 28: append-only). Use new TROW/TCOL with SUPERSEDES pattern. Only text mutation is allowed for typo correction.');
END;

-- 3. table_node_links 전면 UPDATE 차단
--    관계 변경 = SUPERSEDES 패턴 (relation_type='supersedes' 신규 row 추가)
--    어떤 컬럼도 mutation 불가 — 본 테이블은 INSERT-only
CREATE TRIGGER prevent_table_node_links_update
BEFORE UPDATE ON table_node_links
BEGIN
  SELECT RAISE(ABORT, 'table_node_links is INSERT-only (Hard Rule 28: append-only). Add new row with relation_type=supersedes for revision tracking.');
END;
