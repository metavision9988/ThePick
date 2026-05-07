-- ============================================================
-- 0025_table_cells_partial_index.sql
--
-- ADR-032 §"Performance" — Session 052 5-Persona PE-C1 흡수
-- Partial index on table_cells.value_type — admin G5.5 cross-table 쿼리 성능
--
-- 배경 (Session 052 5-Persona Persona 2 performance-engineer):
--   기존 idx_table_cells_table_value (table_id, value_type) 복합 인덱스는 (table_id)
--   left-prefix 의존. admin G5.5 검수 시 across-table 쿼리 패턴 (예:
--   SELECT * FROM table_cells WHERE value_type='formula' GROUP BY pattern_type)
--   은 left-prefix 부재로 풀스캔 회귀. value_type 6종 중 'formula'/'merged_ref'/
--   'nested_table' 3종은 selectivity 高 (전체 중 ~10%) → partial index 효과 큼.
--
-- 결정 (Session 052 진산 "중요하고 긴급한 거 부터 순차적으로 모두 처리"):
--   - 부분 인덱스 (WHERE value_type IN (...)) 추가 — 풀 인덱스 대비 storage 1/10
--   - admin 검수 cross-table 쿼리 P95 latency 200ms+ → ~10ms 추정 (24× 개선)
--
-- 호환성:
--   - 기존 idx_table_cells_table_value 보존 (table 단위 검색 용도)
--   - 0024 12-step procedure 영향 0 (table_structures 한정)
--   - INSERT/UPDATE 무관 (인덱스만 추가)
--
-- 검증:
--   - Cat 9 (scripts/verify-engine-contracts.ts) 0025 파일 존재
--   - 차세션 053 entry verify run PASS 6/0/1 일치 의무
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_table_cells_value_partial
  ON table_cells(value_type)
  WHERE value_type IN ('formula','merged_ref','nested_table');

-- merged_with_id 직접 인덱스 — Pattern-D anchor 역방향 검색 (PE-M1 흡수)
-- Phase 3 모바일 표 렌더링 60fps + admin 셀 병합 그룹 식별 정합.
CREATE INDEX IF NOT EXISTS idx_table_cells_merged
  ON table_cells(merged_with_id)
  WHERE merged_with_id IS NOT NULL;
