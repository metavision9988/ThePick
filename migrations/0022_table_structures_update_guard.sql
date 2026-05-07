-- ============================================================
-- 0022_table_structures_update_guard.sql
--
-- ADR-032 D-PHASE2-1=α (2026-05-07 Session 050 종착) — table_structures critical 컬럼 UPDATE 차단
--
-- 배경:
--   Session 050 4-Pass 리뷰 Pass 2 MAJOR-D — `prevent_*_update` trigger가
--   knowledge_nodes/formulas/constants에만 적용되어 있고 table_structures는 무방비.
--   `human_reviewed_at`/`status`/`updated_at` 갱신은 G5.5 검수 흐름 의무로 허용하되,
--   id/source_node_id/title/pattern_type/row_count/col_count/source 같은 critical
--   컬럼 변경은 INSERT+SUPERSEDES 패턴 강제 의무 (Hard Rule 28 정합).
--
-- D-PHASE2-1=α 영속:
--   진산 결정 (Session 050 후반부 "권장대로 진행") = α 옵션 = 0022 trigger.
--   β 옵션 (ADR §Temporal 명시만) 거부 사유 = idempotent 보장 + 진산 사고 차단.
--
-- 책임:
--   1. `prevent_table_structures_critical_update` trigger 신설
--   2. UPDATE OF (id, source_node_id, title, pattern_type, row_count, col_count, source)
--      → RAISE(ABORT, 'INSERT+SUPERSEDES 패턴 사용 의무')
--   3. UPDATE OF (status, human_reviewed_at, updated_at) 허용
--      (G5.5 검수 흐름 + 운영 메타 갱신)
--
-- 호환성:
--   - 0021 4 테이블 영향 0 (table_headers/cells/node_links는 본 trigger 미적용)
--   - 0021 적재 row 0건 상태 (Phase 2 BATCH 재추출 전) → 회귀 위험 0
--   - DELETE 미차단 (별도 진산 영역)
--
-- 검증:
--   - Cat 9 신규 검증 항목 (`scripts/verify-engine-contracts.ts`):
--     `prevent_table_structures_critical_update` trigger 존재 확인
--   - 차세션 052 entry verify run PASS 일치 의무
-- ============================================================

CREATE TRIGGER IF NOT EXISTS prevent_table_structures_critical_update
BEFORE UPDATE OF id, source_node_id, title, pattern_type, row_count, col_count, source
ON table_structures
BEGIN
  SELECT RAISE(ABORT, 'table_structures critical columns are INSERT-only (Hard Rule 28 / ADR-032 D-PHASE2-1=α). Use INSERT + SUPERSEDES pattern via table_node_links(relation_type=''supersedes'') instead. Allowed UPDATE: status / human_reviewed_at / updated_at.');
END;
