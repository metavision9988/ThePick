-- ============================================================
-- 0021_rollback.sql
--
-- Reverses: migrations/0021_table_as_micro_kg.sql
--   (ADR-032 Accepted — 4 신규 테이블 + 8 인덱스)
--
-- 효과:
--   - table_node_links 제거 (FK references table_structures + knowledge_nodes)
--   - table_cells       제거 (self-ref FK merged_with_id + FK formulas/headers/structures)
--   - table_headers     제거 (self-ref FK parent_id + FK structures)
--   - table_structures  제거 (FK source_node_id → knowledge_nodes)
--   - 8 인덱스 자동 삭제 (DROP TABLE 시)
--
-- 결과 상태:
--   ★★★ 적재된 모든 표 데이터 영구 손실 ★★★
--   table_structures / table_headers / table_cells / table_node_links 4 테이블 모두
--   제거. ADR-032 Phase 1 Foundation 회귀 — Phase 2A 별표 재추출 산출물 영구 손실.
--   본 down은 ADR-032 자체를 거부하는 결정이 진산님으로부터 명시된 경우만 사용.
--
-- ★ 사전 의무:
--   1. 0026/0025/0024/0023/0022 down 우선 적용 (LIFO 순서)
--   2. 적재 row 백업 의무 (production 적용 시):
--      wrangler d1 export thepick-db-production --remote \
--        --table=table_structures --table=table_headers --table=table_cells --table=table_node_links \
--        --output=backups/table-data-pre-0021-rollback-$(date +%Y%m%d).sql
--   3. 진산님 명시 결정 영속 (handoff + ADR §"Decision history")
--
-- ★ Vectorize 영향:
--   table_id 메타데이터로 인덱싱된 셀 임베딩 (ADR-004 Phase 2D) 모두 stale.
--   Vectorize 인덱스 재구축 또는 stale 데이터 GC 별도 의무.
--
-- 적용 순서:
--   wrangler d1 execute thepick-db-staging \
--     --remote --file=docs/runbooks/migration-rollback/0021_rollback.sql
--   (production 동일, --env production)
--
-- 적용 후 의무:
--   1. d1_migrations 테이블에서 0021 row 수동 삭제
--      → DELETE FROM d1_migrations WHERE name LIKE '0021_%';
--   2. ontology-registry.json 회귀 — 4 ID 패턴 (TBL/TROW/TCOL/TCELL) 제거
--   3. verify-engine-contracts.ts Cat 9 전면 FAIL 정상 (down 의도)
--   4. ADR-032 status: Accepted → Rejected (decision history 추가)
-- ============================================================

-- DROP 순서: 외부 FK가 있는 테이블부터 (FK 정합 보장)
-- table_node_links → table_cells → table_headers → table_structures
DROP TABLE IF EXISTS table_node_links;
DROP TABLE IF EXISTS table_cells;
DROP TABLE IF EXISTS table_headers;
DROP TABLE IF EXISTS table_structures;
