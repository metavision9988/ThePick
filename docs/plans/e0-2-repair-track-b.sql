-- E0-2 Track B 고아 수리 — 신규 엣지 INSERT 27 (노드 UPDATE 0)
-- 결재: 진산 2026-07-14 "전부 권고대로 진행" (Q1 — 검수 위임. 검수 카드 권고 (a) 등급별 채택)
-- 게이트: AI 증거 검증 wf_66b57d39 — B-1/B-2/C 15 전건 CONFIRM(production 실재·중복 0·whitelist·앵커 4 live)
--   + B-3 원문 대조 CONFIRM 12 / HOLD 9(원문 근거 부재 = 미시행, fabricate 금지) / REJECT 1(부록 추정이 교재와 모순)
-- 결과: 고아 24 → 해소 22 / 정직 잔여 2 (LAW-043·LAW-128 — 전 후보 원문 근거 부재, G-RP-2 잔여 표기)
-- 상법 블록(093~099) 일괄 시행 + live 앵커 4(092/103/105/122) 동반 — 부분 시행 고아 섬 없음
-- 멱등: NOT EXISTS 중복 가드 (G-RP-4)

-- [B-1] 제목 동일 모법 1:1·시행령→모법 관례 13+
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0001', 'LAW-064', 'LAW-021', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-064' AND to_node='LAW-021' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0001');
-- [B-1] 심의회 모법 1:1
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0002', 'LAW-065', 'LAW-024', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-065' AND to_node='LAW-024' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0002');
-- [B-2] 완전 동명(피해면적 보정계수)·F→CONCEPT 73관례
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0003', 'F-60', 'CONCEPT-066', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='F-60' AND to_node='CONCEPT-066' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0003');
-- [B-2] 완전 동명(미보상감수량 밭작물)
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0004', 'F-81', 'CONCEPT-084', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='F-81' AND to_node='CONCEPT-084' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0004');
-- [B-2] 면적피해율 논작물 산식→개념
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0005', 'F-54', 'CONCEPT-053', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='F-54' AND to_node='CONCEPT-053' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0005');
-- [B-2] 수정불량환산계수→자연수정불량률(복분자)
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0006', 'F-40', 'CONCEPT-057', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='F-40' AND to_node='CONCEPT-057' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0006');
-- [B-2] 표본구간 수확량 합계→표본구간
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0007', 'CONCEPT-082', 'CONCEPT-037', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='CONCEPT-082' AND to_node='CONCEPT-037' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0007');
-- [B-2] 상법 641→640 (live 앵커 1/4)
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0008', 'LAW-093', 'LAW-092', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-093' AND to_node='LAW-092' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0008');
-- [B-2] 소급보험→객관적 확정 효과
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0009', 'LAW-094', 'LAW-095', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-094' AND to_node='LAW-095' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0009');
-- [B-2] 648 반환청구→644 무효
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0010', 'LAW-099', 'LAW-095', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-099' AND to_node='LAW-095' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0010');
-- [B-2] 대리인의 지→고지의무 (live 앵커 2/4)
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0011', 'LAW-096', 'LAW-103', 'CROSS_REF', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-096' AND to_node='LAW-103' AND edge_type='CROSS_REF' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0011');
-- [B-2] 646의2→646 파생조문
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0012', 'LAW-097', 'LAW-096', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-097' AND to_node='LAW-096' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0012');
-- [B-2] 위험 감소↔증가 대칭 (live 앵커 3/4)
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0013', 'LAW-098', 'LAW-105', 'DIFFERS_FROM', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-098' AND to_node='LAW-105' AND edge_type='DIFFERS_FROM' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0013');
-- [B-2] 초과보험 무효 반환 (live 앵커 4/4)
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0014', 'LAW-099', 'LAW-122', 'CROSS_REF', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-099' AND to_node='LAW-122' AND edge_type='CROSS_REF' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0014');
-- [C] 재조달가액 한정어쌍 — CROSS_REF 채택(SUPERSEDES 배제)
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0015', 'CONCEPT-030', 'CONCEPT-111', 'CROSS_REF', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='CONCEPT-030' AND to_node='CONCEPT-111' AND edge_type='CROSS_REF' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0015');
-- [B-3] 이론서 2권 p503·517 벼 전용 명시
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0016', 'CONCEPT-069', 'CROP-023', 'APPLIES_TO', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='CONCEPT-069' AND to_node='CROP-023' AND edge_type='APPLIES_TO' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0016');
-- [B-3] 실태조사 목적=기본계획 수립·시행 원문 명시
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0017', 'LAW-022', 'LAW-021', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-022' AND to_node='LAW-021' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0017');
-- [B-3] 법 총칙 소속·출제영역 명시
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0018', 'CONCEPT-214', 'LAW-022', 'CROSS_REF', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='CONCEPT-214' AND to_node='LAW-022' AND edge_type='CROSS_REF' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0018');
-- [B-3] 의무 주체=보험가입자 원문 명시
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0019', 'LAW-031', 'LAW-028', 'APPLIES_TO', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-031' AND to_node='LAW-028' AND edge_type='APPLIES_TO' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0019');
-- [B-3] 법13↔상법679 승계 추정 동일 문언
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0020', 'LAW-040', 'LAW-132', 'CROSS_REF', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-040' AND to_node='LAW-132' AND edge_type='CROSS_REF' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0020');
-- [B-3] 보험목적물 정의(제5조) 의존
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0021', 'LAW-040', 'LAW-026', 'DEPENDS_ON', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-040' AND to_node='LAW-026' AND edge_type='DEPENDS_ON' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0021');
-- [B-3] 회계 구분 의무 주체=재해보험사업자
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0022', 'LAW-042', 'LAW-001', 'APPLIES_TO', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-042' AND to_node='LAW-001' AND edge_type='APPLIES_TO' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0022');
-- [B-3] 보험업법 적용 주체
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0023', 'LAW-044', 'LAW-001', 'APPLIES_TO', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-044' AND to_node='LAW-001' AND edge_type='APPLIES_TO' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0023');
-- [B-3] 제2장 재해보험사업·출제영역 명시
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0024', 'CONCEPT-214', 'LAW-044', 'CROSS_REF', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='CONCEPT-214' AND to_node='LAW-044' AND edge_type='CROSS_REF' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0024');
-- [B-3] 재보험 일반법↔특별법 동일 용어
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0025', 'LAW-114', 'LAW-046', 'CROSS_REF', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-114' AND to_node='LAW-046' AND edge_type='CROSS_REF' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0025');
-- [B-3] 상법 제726조(재보험 준용) 법문 브리지 — 검증자 정밀화 권고 채택(원안 LAW-136 대체)
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0026', 'LAW-114', 'LAW-165', 'CROSS_REF', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='LAW-114' AND to_node='LAW-165' AND edge_type='CROSS_REF' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0026');
-- [B-3] 상법 통칙 소속·출제영역 명시
INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, priority, is_active)
SELECT 'EDGE-E02-TB-0027', 'CONCEPT-213', 'LAW-114', 'CROSS_REF', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE from_node='CONCEPT-213' AND to_node='LAW-114' AND edge_type='CROSS_REF' AND is_active=1)
  AND NOT EXISTS (SELECT 1 FROM knowledge_edges WHERE id='EDGE-E02-TB-0027');

INSERT OR IGNORE INTO review_decisions (id, decision_type, target_type, target_id, reviewer_id, decision_rationale, rollback_deadline, queue_id, batch_id)
VALUES ('RD-E02-TB-20260714', 'approve', 'edge', 'EDGE-E02-TB-0001..0027 (고아 22 해소, 잔여 LAW-043/LAW-128)', 'jinsan',
 'Track B 고아 수리 위임 집행 — 진산 2026-07-14 «전부 권고대로 진행». AI 증거검증 CONFIRM 27만 시행(HOLD 9·REJECT 1 미시행 — fabricate 금지). C=CROSS_REF 채택. LAW-114 원안 136→165 정밀화', strftime('%Y-%m-%dT%H:%M:%fZ','now','+24 hours'), 2, 'E0-2-TRACK-B');