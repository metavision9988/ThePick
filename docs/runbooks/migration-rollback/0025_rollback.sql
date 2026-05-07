-- ============================================================
-- 0025_rollback.sql
--
-- Reverses: migrations/0025_table_cells_partial_index.sql
--   (Session 052 5-Persona PE-C1 흡수 — admin G5.5 cross-table 쿼리 성능)
--
-- 효과:
--   - idx_table_cells_value_partial   인덱스 제거 (value_type IN ('formula','merged_ref','nested_table'))
--   - idx_table_cells_merged          인덱스 제거 (merged_with_id IS NOT NULL, PE-M1)
--
-- 결과 상태:
--   admin G5.5 cross-table 쿼리 P95 200ms+ 회귀 (24× 성능 후퇴 추정).
--   Pattern-D anchor 역방향 검색 풀스캔 회귀 (Phase 3 모바일 60fps 위협).
--   본 down은 인덱스 자체에 D1 storage 한도 임박 등 위급 사유가 있을 때만 사용.
--
-- 데이터 영향: 0 (인덱스 DROP만, 본 테이블 적재 row / 컬럼 변경 없음)
--
-- 적용 순서:
--   wrangler d1 execute thepick-db-staging \
--     --remote --file=docs/runbooks/migration-rollback/0025_rollback.sql
--   (production 동일, --env production)
--
-- 적용 후 의무:
--   1. d1_migrations 테이블에서 0025 row 수동 삭제
--      → DELETE FROM d1_migrations WHERE name LIKE '0025_%';
--   2. 운영 telemetry 모니터링 — admin G5.5 쿼리 P95 회귀 확인 의무
-- ============================================================

DROP INDEX IF EXISTS idx_table_cells_merged;
DROP INDEX IF EXISTS idx_table_cells_value_partial;
