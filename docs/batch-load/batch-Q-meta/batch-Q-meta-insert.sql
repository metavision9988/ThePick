-- BATCH 적재 SQL — BATCH-Q-META (2026)
-- 출처: batch-Q-meta-knowledge-graph.json
-- 노드: 1 / 엣지: 1 / 산식: 0 / 상수: 0
-- 적용: wrangler d1 execute <db-name> --file=<this-file> --remote
-- 사전 의무: migration 0019 production 적용 완료
-- 멱등성: INSERT OR IGNORE — 재실행 시 충돌 없음
--
-- AI 생성 데이터 (CLAUDE.md Hard Limit) — status='draft' 만 INSERT
-- 진산님 검수 후 status_transitions UPDATE 로 review/approved 전이
--
-- 주의: D1 wrangler execute --file 은 전체 파일을 자동 트랜잭션으로 감싼다.
-- 명시 BEGIN TRANSACTION/COMMIT 은 D1 거부 (Durable Object 충돌). 의도적으로 생략.

-- 1. knowledge_nodes (1 rows)
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-218', 'CONCEPT', '[BATCH-Q-META] 손해평가사 기출 7회분 카탈로그 + 본격 적재 차세션 이월 메타', '손해평가사 자격시험 1차+2차 기출 7회분 (제5~11회, 2019~2025) 통계 카탈로그. **자료 위치 (docs/manual/)**: ① 1차 시험 — 2019(5회 A형/B형 분리) / 2021(7회 zip) / 2022(8회 1교시 A형) / 2023(9회) / 2024(10회) / 2025(11회). ② 2차 시험 — 2019(5회 공개용) / 2020(6회 zip 원본) / 2021(7회) / 2022(8회) / 2023(9회) / 2024(10회) / 2025(11회). **분량 추정**: 1차 7회분 × 75문항 = 525문항 / 2차 7회분 × ~24문항 = ~168문항 / 합계 ~693문항. **본격 적재 이월 사유**: ① 정답지 자료 미보유 (큐넷 공식 발표 별도 확보 필요) ② 단일 세션 내 693문항 구조화 비현실 ③ Level 3 역검증 자료로서 정답 매핑이 핵심. **차세션 권장 분할**: 회차당 1세션 (1차 75 + 2차 24 = 99문항/세션). exam_questions 테이블 INSERT (BATCH-Q-N차-회차 단위 batch_id). BATCH-S1 출제영역(CONCEPT-212) DEPENDS_ON.', '농작물재해보험·가축재해보험 공통', NULL, NULL, 'p.1', 1, 1, '기출 카탈로그 메타', 'BATCH-Q 7회분 카탈로그 + 본격 적재 차세션 이월', 'BATCH-Q-META', 2026, 10, 'draft');

-- 2. formulas (0 rows, INSERT OR IGNORE — 기존 등록 row 보존)

-- 3. constants (0 rows, INSERT OR IGNORE)

-- 4. knowledge_edges (1 rows) — nodes 적재 후
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-Q-META-0001', 'CONCEPT-218', 'CONCEPT-212', 'DEPENDS_ON', NULL);

-- 검증 SQL (적용 후 진산님 직접 확인):
-- SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-Q-META'; -- expect: 1
-- SELECT COUNT(*) FROM knowledge_edges WHERE id LIKE 'EDGE-BATCH-Q-META-%'; -- expect: 1
-- SELECT COUNT(*) FROM formulas WHERE id LIKE 'F-%'; -- expect: \u003E= 0 (기존 등록 합산)
