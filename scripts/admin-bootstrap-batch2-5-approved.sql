-- ============================================================
-- admin G5.5 부분 진입 (확장) — BATCH-2~5 414건 status='approved' 전환
--
-- 배경 (2026-05-10 Session 064 / phase2-eval-mvp.plan §6.1):
--   Session 062 가 BATCH-1 적과전 74건을 status='approved' 전환했다.
--   Phase 2 Eval MVP (진산님 직접 평가 환경) 진입을 위해 BATCH-2~5 영역도
--   동일 패턴으로 일괄 전환한다. 학습자 검색/문제 풀이 시 BATCH-2~5 노드가
--   results 로 surface 될 수 있도록 함.
--
-- 진산 결정 (Session 063 — phase2-eval-mvp plan 승인):
--   옵션 A 평가용 MVP 직진 채택 — BATCH-2~5 SQL 일괄 부트스트랩.
--   진산님 직접 검수는 audit trail (reviewer_id) 로 추후 재진행 가능.
--
-- Reality Anchor 영속 (plan §4 Q1):
--   BATCH-2~5 노드의 metadata 정확도는 본 부트스트랩 이전 검수 0건.
--   misclassified 노드가 학습자에 noise 로 surface 될 수 있다.
--   mitigation: reviewer_id 'session-064-admin-bootstrap' 표식 보존
--   (진산님 직접 재검수 시점에 'jinsan-admin-NNN' 으로 갱신 가능, audit trail 정합).
--
-- 기대 결과 (production pre-flight):
--   BATCH-2 active=116 / BATCH-3 active=84 / BATCH-4 active=116 / BATCH-5 active=98
--   합계 414건 → status_transitions 414 INSERT (changes=414)
--
-- 정합 검증:
--   - status_transitions append-only 로그 INSERT (migration 0010)
--   - one_way trigger: 'draft' → 'approved' 직행 허용 (역방향만 차단)
--   - reviewer_id = 'session-064-admin-bootstrap' (시스템 부트스트랩 표식, FK 없음)
--   - idempotent: deterministic id ('st-s064-' || node_id) + NOT EXISTS clause
--   - is_current_active=1 강제 (Stage 3 fetchNodesByIds 정합)
--
-- 실행 명령 (production):
--   pnpm --filter @thepick/api exec wrangler d1 execute thepick-db-production \
--     --remote --file ../../scripts/admin-bootstrap-batch2-5-approved.sql
--
-- 검증 SQL (실행 후):
--   SELECT COUNT(*) FROM status_transitions WHERE to_status='approved' AND reviewer_id='session-064-admin-bootstrap';
--   → 414 (expected)
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
  'st-s064-' || kn.id AS id,
  'node' AS target_type,
  kn.id AS target_id,
  'draft' AS from_status,
  'approved' AS to_status,
  'session-064-admin-bootstrap' AS reviewer_id,
  'BATCH-2~5 적재 영역 status approved bootstrap (phase2-eval-mvp.plan §6.1, Phase 2 사용자 평가 진입)' AS reason,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS transitioned_at
FROM knowledge_nodes kn
WHERE kn.batch_id IN ('BATCH-2', 'BATCH-3', 'BATCH-4', 'BATCH-5')
  AND kn.is_current_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM status_transitions st
    WHERE st.target_type = 'node' AND st.target_id = kn.id
  );
