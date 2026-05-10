-- ============================================================
-- admin G5.5 부분 진입 — BATCH-1 (적과전 손해평가) 75건 status='approved' 전환
--
-- 배경 (2026-05-09 Session 062 / handoff-070 §3 우선순위 1):
--   production knowledge_nodes 794건 모두 status='draft' (admin 검수 0건).
--   Stage 3 fetchNodesByIds 의 latest.to_status='approved' 필터 → 영구 0행.
--   학습자 모든 검색 요청 → honest-refusal (messageKey 'out_of_scope' misrepresent).
--   SP-T06 (정확도 ≥ 85%) / SP-T07 (거부율 ≤ 5%) 측정 의미 없는 환경.
--
-- 진산 결정 (Session 062):
--   admin G5.5 부분 진입 채택 — BATCH-1 적과전 75건을 status='approved' 전환하여
--   Stage 3 정정 효과 (D-TCV-4-FIX-1=B-1) 의 측정 차단 해소.
--
-- 정합 검증:
--   - status_transitions append-only 로그 INSERT (migration 0010)
--   - one_way trigger: 'draft' → 'approved' 직행 허용 (역방향만 차단)
--   - reviewer_id = 'session-062-admin-bootstrap' (시스템 부트스트랩 표식, FK 없음)
--   - idempotent: deterministic id ('st-s062-' || node_id) + NOT EXISTS clause
--   - is_current_active=1 강제 (Stage 3 fetchNodesByIds 정합)
--
-- 실행 명령 (production):
--   pnpm --filter @thepick/api exec wrangler d1 execute thepick-db-production \
--     --remote --file ../../scripts/admin-bootstrap-batch1-approved.sql
--
-- 검증 SQL (실행 후):
--   SELECT COUNT(*) FROM status_transitions WHERE to_status='approved' AND reviewer_id='session-062-admin-bootstrap';
--   → 75 (expected)
-- ============================================================

INSERT INTO status_transitions (
  id,
  target_type,
  target_id,
  from_status,
  to_status,
  reviewer_id,
  reason,
  transitioned_at
)
SELECT
  'st-s062-' || kn.id AS id,
  'node' AS target_type,
  kn.id AS target_id,
  'draft' AS from_status,
  'approved' AS to_status,
  'session-062-admin-bootstrap' AS reviewer_id,
  'BATCH-1 적과전 75건 status approved bootstrap (handoff-070 §3 우선순위 1, SP-T06 측정 차단 해소, Reality Anchor 3차 정합)' AS reason,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS transitioned_at
FROM knowledge_nodes kn
WHERE kn.batch_id = 'BATCH-1'
  AND kn.is_current_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM status_transitions st
    WHERE st.target_type = 'node' AND st.target_id = kn.id
  );
