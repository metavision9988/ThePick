-- E0-2 수리 Track A-1 + C (진산 결재 2026-06-11 "권고대로 진행" — e0-2-graph-repair.plan.md §6)
-- 사전 검증: 덤프 기계 대조 6/6 PASS + 라이브 사전 SELECT (11 nodes_inactive / 11 r1_active / 2 dup_active)
-- 안전 설계: ID + 현 상태 이중 잠금 (멱등 — 재실행 시 0행)
-- 실행 채널: wrangler d1 execute thepick-db-production --remote --file (진산 발급 cfut_ 토큰, 쓰기 실측 확인)

-- A-1a. 본체 노드 11 복원 (R1 SUPERSEDES 오용으로 비활성화됐던 핵심 상품 노드 — 검색·walk 복귀)
UPDATE knowledge_nodes SET is_current_active = 1
WHERE id IN ('INS-01','INS-09','INS-12','INS-33','CROP-042','CROP-045','CROP-046','CROP-058','CROP-059','F-71','CONCEPT-081')
  AND is_current_active = 0;

-- A-1b. 오용 SUPERSEDES 엣지 11 비활성화 (개정노트는 본체의 후계가 아님 — MAV 불변식 정합, 재비활성화 차단)
UPDATE knowledge_edges SET is_active = 0
WHERE id IN ('EDGE-BATCH-R1-0024','EDGE-BATCH-R1-0025','EDGE-BATCH-R1-0026','EDGE-BATCH-R1-0027','EDGE-BATCH-R1-0028','EDGE-BATCH-R1-0029','EDGE-BATCH-R1-0030','EDGE-BATCH-R1-0031','EDGE-BATCH-R1-0032','EDGE-BATCH-R1-0033','EDGE-BATCH-R1-0034')
  AND edge_type = 'SUPERSEDES' AND is_active = 1;

-- C. 진성 중복 후순위 2건 비활성화 (4-0031≡5-0086, 4-0032≡5-0087 — 무손실)
UPDATE knowledge_edges SET is_active = 0
WHERE id IN ('EDGE-BATCH-5-0086','EDGE-BATCH-5-0087')
  AND is_active = 1;

-- 검수 결정 감사 기록 (G-RP-5 — review_decisions INSERT-only, queue_id 2 = 데이터 수리)
-- decision_type='reject' = R1 SUPERSEDES 적재의 거부 (1차 시도의 'rollback' 은 트리거가
-- references_decision_id 를 요구해 ABORT — 본 건은 기존 결정 롤백이 아닌 적재 오류 거부라 reject 가 정합)
INSERT INTO review_decisions (id, decision_type, target_type, target_id, reviewer_id, decision_rationale, decided_at, rollback_deadline, queue_id, batch_id)
VALUES ('RD-E02-A1-20260611', 'reject', 'edge', 'EDGE-BATCH-R1-0024..0034 (SUPERSEDES 11) + 복원 INS-01,INS-09,INS-12,INS-33,CROP-042,CROP-045,CROP-046,CROP-058,CROP-059,F-71,CONCEPT-081',
        'jinsan', 'E0-2 Track A-1: BATCH-R1 SUPERSEDES 오용 거부·원복 — 개정노트는 본체 후계 아님 (e0-2-graph-repair.plan.md §1, 적대검증 통과). 본체 11 복원 + R1 엣지 11 비활성 + 중복 2 정리',
        strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now','+24 hours'), 2, 'E0-2-REPAIR');
