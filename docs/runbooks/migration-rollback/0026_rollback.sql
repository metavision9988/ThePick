-- ============================================================
-- 0026_rollback.sql
--
-- Reverses: migrations/0026_table_subordinate_update_guards.sql
--   (Session 052 5-Persona BA-C2 흡수 — Hard Rule 28 일관)
--
-- 효과:
--   - prevent_table_cells_critical_update     trigger 제거
--   - prevent_table_headers_critical_update   trigger 제거
--   - prevent_table_node_links_update         trigger 제거
--
-- 결과 상태:
--   table_cells / table_headers / table_node_links UPDATE 무방비.
--   G5.5 검수자가 셀 직접 UPDATE 가능 (revision history 0 / 감사 로그 부재).
--   Hard Rule 28 (Temporal Graph) 일관성 위배 — 운영 자체로는 권장하지 않음.
--   본 down은 BA-C2 흡수 트리거 자체에 회귀가 발견된 경우에만 사용.
--
-- 데이터 영향: 0 (trigger DROP만, 적재 row 변경 없음)
--
-- 적용 순서:
--   wrangler d1 execute thepick-db-staging \
--     --remote --file=docs/runbooks/migration-rollback/0026_rollback.sql
--   (production 동일, --env production)
--
-- 적용 후 의무:
--   1. d1_migrations 테이블에서 0026 row 수동 삭제 (wrangler가 forward만 추적)
--      → DELETE FROM d1_migrations WHERE name LIKE '0026_%';
--   2. handoff에 down 적용 사실 + 사유 영속 (runbook 기준)
--   3. verify-engine-contracts.ts Cat 9 통과 영향 0 (trigger 검증 0026 한정)
--      → 본 down 적용 후 Cat 9 FAIL 정상 (trigger 부재 검증 발동)
-- ============================================================

DROP TRIGGER IF EXISTS prevent_table_node_links_update;
DROP TRIGGER IF EXISTS prevent_table_headers_critical_update;
DROP TRIGGER IF EXISTS prevent_table_cells_critical_update;
