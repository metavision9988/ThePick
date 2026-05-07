-- BATCH 적재 SQL — BATCH-S1 (2026)
-- 출처: batch-S1-knowledge-graph.json
-- 노드: 6 / 엣지: 14 / 산식: 0 / 상수: 0
-- 적용: wrangler d1 execute <db-name> --file=<this-file> --remote
-- 사전 의무: migration 0019 production 적용 완료
-- 멱등성: INSERT OR IGNORE — 재실행 시 충돌 없음
--
-- AI 생성 데이터 (CLAUDE.md Hard Limit) — status='draft' 만 INSERT
-- 진산님 검수 후 status_transitions UPDATE 로 review/approved 전이
--
-- 주의: D1 wrangler execute --file 은 전체 파일을 자동 트랜잭션으로 감싼다.
-- 명시 BEGIN TRANSACTION/COMMIT 은 D1 거부 (Durable Object 충돌). 의도적으로 생략.

-- 1. knowledge_nodes (6 rows)
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-212', 'CONCEPT', '[BATCH-S1 META] 손해평가사 자격시험 출제영역 (1차 3과목 + 2차 2과목)', '손해평가사 자격시험 출제영역 통합 메타. 1차 시험 3과목: ① 상법(보험편) — 통칙·손해보험(통칙·화재보험). ② 농어업재해보험법령 및 규정 — 농어업재해보험법령(법+시행령) 4영역(총칙·재해보험사업·재보험사업및기금·관리) + 농업재해보험 손해평가요령 3영역(총칙·손해평가인·손해평가). ③ 재배학 및 원예작물학 — 재배(재배작물 개요) + 재배환경(토양·수분·온도·광·생장발육) + 재배기술(종자육묘·파종이식·영양번식·재배관리·병해충관리) + 각종재해(저온고온해·습수해·동상해·도복풍해·우박) + 원예작물(채소·과수·화훼) + 농업시설(시설구조·자재특성). 2차 시험 2과목: ① 농작물재해보험 및 가축재해보험 이론과 실무 — 보험의 이해 + 농업재해보험 특성·필요성 + 농작물재해보험 제도 + 가축재해보험 제도. ② 농작물재해보험 및 가축재해보험 손해평가 이론과 실무 — 손해평가 개관 + 농작물재해보험 손해평가(과수/논/밭/시설/농업수입) + 가축재해보험 손해평가(손해평가·특약·보험금지급심사). exam_scope 필드 정합 자료.', '농작물재해보험·가축재해보험 공통', NULL, NULL, 'p.1', 1, 1, '손해평가사 자격시험 출제영역 메타', 'META 통합', 'BATCH-S1', 2026, 10, 'draft');
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-213', 'CONCEPT', '[1차] 상법(보험편) 출제영역 — 통칙 + 손해보험(통칙·화재보험)', '1차 시험 1과목 상법(보험편) 출제영역. 주요항목: ① 통칙 — 1.보험계약. ② 손해보험 — 1.통칙 / 2.화재보험. 25문항 (1차 시험 비중). 정답·해설 = BATCH-L2 (상법 LAW-088~LAW-137 50개 조문 정합).', '농작물재해보험·가축재해보험 공통', NULL, NULL, 'p.1', 1, 1, '손해평가사 자격시험 출제영역 메타', '1차 1과목 상법(보험편)', 'BATCH-S1', 2026, 10, 'draft');
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-214', 'CONCEPT', '[1차] 농어업재해보험법령 및 규정 출제영역 — 법령(법+시행령) + 손해평가요령', '1차 시험 2과목 농어업재해보험법령 및 규정 출제영역. ① 농어업재해보험법령(법 및 시행령) 4영역: 1.총칙 / 2.재해보험사업 / 3.재보험사업 및 농어업재해보험기금 / 4.보험사업의 관리. ② 농업재해보험 손해평가요령 3영역: 1.총칙 / 2.손해평가인 / 3.손해평가. 25문항 (1차 시험 비중). 정답·해설 = BATCH-L1 (농어업재해보험법 + 시행령 LAW-019~LAW-087 정합).', '농작물재해보험·가축재해보험 공통', NULL, NULL, 'p.1', 1, 1, '손해평가사 자격시험 출제영역 메타', '1차 2과목 농어업재해보험법령 및 규정', 'BATCH-S1', 2026, 10, 'draft');
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-215', 'CONCEPT', '[1차] 재배학 및 원예작물학 출제영역 — 자료 미보유 영역 (★ 진산님 자료 확보 의무)', '1차 시험 3과목 재배학 및 원예작물학 출제영역. ① 재배 — 1.재배작물의 개요. ② 재배환경 — 1.토양 / 2.수분 / 3.온도 / 4.광 / 5.생장발육과 환경. ③ 재배기술 — 1.종자와 육묘 / 2.파종 및 이식 / 3.영양번식 / 4.재배관리 / 5.병해충관리. ④ 각종재해 — 1.저온해 및 고온해 / 2.습해, 수해 및 관리 / 3.동해 및 상해 / 4.도복 및 풍해 / 5.우박 및 기타재해. ⑤ 원예작물 — 1.채소재배 및 관리 / 2.과수재배 및 관리 / 3.화훼재배 및 관리. ⑥ 농업시설 — 1.시설구조 및 설계 / 2.자재특성 및 시설관리. 25문항 (1차 시험 비중). ★ 정답·해설 = **자료 미보유** (BATCH-1~7 영역 외, 농학 일반 자료 별도 확보 필요). 진산님 자료 확보 의무 carry-over.', '농학 일반 (BATCH-1~7 외)', NULL, NULL, 'p.1', 1, 1, '손해평가사 자격시험 출제영역 메타', '1차 3과목 재배학 및 원예작물학 — 자료 미보유', 'BATCH-S1', 2026, 10, 'draft');
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-216', 'CONCEPT', '[2차] 농작물·가축재해보험 이론과 실무 출제영역 — 보험 이해 + 제도', '2차 시험 1과목 농작물재해보험 및 가축재해보험 이론과 실무 출제영역. ① 보험의 이해 — 1.위험과 보험 / 2.보험의 의의와 원칙 / 3.보험의 기능 / 4.손해보험의 이해. ② 농업재해보험 특성과 필요성 — 1.농업의 산업적 특성 / 2.농업재해보험의 필요성 / 3.특징 / 4.기능 / 5.법령. ③ 농작물재해보험 제도 — 1.제도 일반 / 2.상품내용 / 3.계약 관리. ④ 가축재해보험 제도 — 1.제도 일반 / 2.약관 / 3.특별약관. 4문항 서술/계산 (2차 1과목 비중). 정답·해설 = BATCH-1~5 (농작물 5 핵심 영역) + BATCH-6 (가축재해보험) + BATCH-L1 (법령) 정합.', '농작물재해보험·가축재해보험 공통', NULL, NULL, 'p.2', 2, 2, '손해평가사 자격시험 출제영역 메타', '2차 1과목 이론과 실무', 'BATCH-S1', 2026, 10, 'draft');
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-217', 'CONCEPT', '[2차] 농작물·가축재해보험 손해평가 이론과 실무 출제영역 — 손해평가 본문', '2차 시험 2과목 농작물재해보험 및 가축재해보험 손해평가 이론과 실무 출제영역. ① 농업재해보험 손해평가 개관 — 1.손해평가의 개요 / 2.손해평가 체계 / 3.현지조사 내용. ② 농작물재해보험 손해평가 — 1.손해평가 기본단계 / 2.과수작물 / 3.논작물(벼·맥류) / 4.밭작물 / 5.종합위험 시설작물 / 6.농업수입보장방식. ③ 가축재해보험 손해평가 — 1.손해의 평가 / 2.특약의 손해평가 / 3.보험금 지급 및 심사. 4문항 서술/계산 (2차 2과목 비중). 정답·해설 = BATCH-1~5 (농작물 5 핵심) + BATCH-6 (가축) + BATCH-7 (손해평가 이론 + 별표) + BATCH-R1·R2 (26년 개정사항) 정합.', '농작물재해보험·가축재해보험 공통', NULL, NULL, 'p.2', 2, 2, '손해평가사 자격시험 출제영역 메타', '2차 2과목 손해평가 이론과 실무', 'BATCH-S1', 2026, 10, 'draft');

-- 2. formulas (0 rows, INSERT OR IGNORE — 기존 등록 row 보존)

-- 3. constants (0 rows, INSERT OR IGNORE)

-- 4. knowledge_edges (14 rows) — nodes 적재 후
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0001', 'CONCEPT-212', 'CONCEPT-213', 'PREREQUISITE', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0002', 'CONCEPT-212', 'CONCEPT-214', 'PREREQUISITE', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0003', 'CONCEPT-212', 'CONCEPT-215', 'PREREQUISITE', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0004', 'CONCEPT-212', 'CONCEPT-216', 'PREREQUISITE', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0005', 'CONCEPT-212', 'CONCEPT-217', 'PREREQUISITE', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0006', 'CONCEPT-213', 'LAW-088', 'CROSS_REF', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0007', 'CONCEPT-213', 'LAW-137', 'CROSS_REF', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0008', 'CONCEPT-214', 'LAW-019', 'CROSS_REF', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0009', 'CONCEPT-214', 'LAW-087', 'CROSS_REF', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0010', 'CONCEPT-216', 'INS-01', 'CROSS_REF', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0011', 'CONCEPT-216', 'INS-33', 'CROSS_REF', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0012', 'CONCEPT-217', 'CONCEPT-204', 'CROSS_REF', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0013', 'CONCEPT-217', 'CONCEPT-178', 'CROSS_REF', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-BATCH-S1-0014', 'CONCEPT-217', 'CONCEPT-177', 'CROSS_REF', NULL);

-- 검증 SQL (적용 후 진산님 직접 확인):
-- SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-S1'; -- expect: 6
-- SELECT COUNT(*) FROM knowledge_edges WHERE id LIKE 'EDGE-BATCH-S1-%'; -- expect: 14
-- SELECT COUNT(*) FROM formulas WHERE id LIKE 'F-%'; -- expect: \u003E= 0 (기존 등록 합산)
