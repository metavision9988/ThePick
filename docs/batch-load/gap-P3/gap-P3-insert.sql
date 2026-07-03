-- BATCH 적재 SQL — BATCH-GAP-P3 (E0-8 갭 보강 P3: 개정 2차 B-항목 4건, 2026-07-03)
-- 출처: 26년 개정사항 정리(26.3.31 기준) 2차 2과목 (한종찬 교수 제공) = docs/manual/4월10일_26년2차2과목_변경사항정리.pdf
-- 대상 정본: inventory content-coverage-inventory-20260702.md 라인 686·687·692·698 (❌ 누락 B-항목) = E0-8 리포트 §2 A-5.
--   B-항목3b(착과수조사 시기)·3c(과수4종 수확량조사 준용)·4b(무화과 조사시기)·5d(품목별 표본구간 면적표).
-- 노드: 4 (CONCEPT-219~222) / 엣지: 4 (전부 CONCEPT-178 →PREREQUISITE→ 자식, 개정 축 관례 정합) / 산식: 0 / 상수: 0
-- 결재: 진산 2026-07-03 P3 착수 + override(P2 연속, FIX율 게이트 완화 = 패키지별 독립 리뷰 CRITICAL 0 대체). 플레이북 §8 P3 [x]. Opus 4.8.
--
-- ★ ESCALATE / 진산 인지 (플레이북 §6 규칙4·5, inventory line 730 caveat):
--   - 본 4 항목은 '개정 문서 축(CONCEPT-178~203)' 내 부재분. CONTENT 는 교재 본체(BATCH-1~7 = 2026 이론서
--     = 개정 반영본)가 동일 내용을 이미 커버할 가능성 있음 → '중복 여부·교재 본체 CROSS_REF = 진산 판정'.
--     본 노드의 가치 = "변경전/변경후"를 명시한 개정 학습 아티팩트(교재 본체는 현행 상태만 수록).
--   - 3c(CONCEPT-220): 수확량 산출식(착과량·감수량·수확량·피해율) = 규칙1 산식 → description 원문 인용만,
--     formulas 테이블 INSERT 0 (별도 등록 = L3 결재).
--   - book_page: 개정문서가 구교재 페이지를 미인용한 4건 → book_page = 개정 PDF 자체 페이지(2/2/3/5, 1차문서
--     노드 관례 준용). 구교재 앵커 = 미상(진산 검수 시 정밀화 가능).
-- 적용: cd apps/api && npx wrangler d1 execute thepick-db-production --file=<this-file> --remote (진산 인증 게이트)
-- 멱등성: INSERT OR IGNORE. AI 생성 = status='draft' 만. 진산 검수 후 status_transitions 로 approved 전이.

-- ============================================================
-- 개정 2차 B-항목 4건 (CONCEPT-219~222)
-- ============================================================

INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-219', 'CONCEPT', '[26년 정정] 착과수조사 시기 변경 (최초수확품종 수확직전 → 통상적 적과종료 시점)', '종합위험 수확감소보장 과수의 착과수조사 조사시기 변경. 변경전 = 최초수확품종 수확직전(단, 감귤 만감류는 적과 종료 후). 변경후 = 통상적인 적과 종료 시점 — "통상적인 적과 종료"란 과수원이 위치한 지역(시군 등)의 기상 여건 등을 감안하여 통상적으로 해당 지역에서 해당 과실의 적과가 종료되는 시점을 말하며, 단 최초수확 시기를 넘길 수 없다. (26년 개정 2차 2과목 정리 rev-2026-2nd p2 / 3. 종합위험 수확감소보장.)', NULL, '종합위험 수확감소 과수(포도·복숭아·자두·만감류·사과·배·단감·떫은감)', '착과수조사', 'p.2', 2, 2, '26년 개정사항 정리 — 2차 2과목', '3. 종합위험 수확감소보장 — 착과수조사 시기', 'BATCH-GAP-P3', 2026, 10, 'draft');
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-220', 'CONCEPT', '[26년 신설] 과수4종(사과·배·단감·떫은감) 종합위험 수확감소 수확량조사 — 적과전 조사방법 준용', '사과·배·단감·떫은감이 종합위험 수확감소보장방식으로 가입 시 수확량조사(적과전종합위험방식 과 종합위험 수확감소보장방식 중 하나만 선택 가입, 동시 가입 불가). 1. 적과전 종합위험의 조사방법을 준용: 1)착과수조사 2)과중조사(별도 과중조사 없이 가입과중 사용) 3)착과피해조사(품종별 1주 이상·과수원당 3주 이상 표본주에서 추출) 4)낙과피해조사(낙과 중 임의의 과실 100개 이상 추출). 2. 나무손해보장 특약 고사나무조사 — 주수조사 시 "무피해나무 착과수조사" 규정은 오류(무피해나무 착과수조사는 적과전종합위험의 낙과피해조사 시 나무 고사·수확불능으로 발생한 피해과실수 산정용). 3. 수확량 산출식은 포도·복숭아·자두·만감류와 동일: 착과량 = 착과수×가입과중 + 미보상주수×주당평년수확량 / 감수량 = 금차착과감수량(=착과량×착피) + 금차낙과감수량(=낙과량×낙피) + 금차고사주수감수량(=금차고사분과실수×과중) / 수확량 = (착과수조사 이전 피해사실 인정) 착과량 − 사고당감수량합계, (인정 안 됨) MAX(평년수확량, 착과량) − 사고당감수량합계 / 피해율 = (평년수확량 − 수확량 − 미보상감수량) ÷ 평년수확량 (자연재해성 탄저병 미적용). (rev-2026-2nd p2. ★산식 = ESCALATE, formulas INSERT 0.)', NULL, '과수4종(사과·배·단감·떫은감)', '수확량조사(착과수·과중·착과피해·낙과피해)', 'p.2', 2, 2, '26년 개정사항 정리 — 2차 2과목', '3. 종합위험 수확감소보장 — 과수4종 수확량조사(종합과수)', 'BATCH-GAP-P3', 2026, 10, 'draft');
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-221', 'CONCEPT', '[26년 정정] 무화과 과실손해조사 시기 변경 (최초 수확품종 수확기 이전 → 수확직전)', '무화과 과실손해조사 조사시기 변경. 변경전 = 최초 수확품종 수확기 이전까지. 변경후 = 수확직전. (4. 과실손해보장 조사시기 변경 배치 — 동일 배치 내 오디 = 결실 완료후, 복분자 = 수정 완료후. rev-2026-2nd p3.)', NULL, '무화과', '과실손해조사', 'p.3', 3, 3, '26년 개정사항 정리 — 2차 2과목', '4. 과실손해보장 — 무화과 조사시기', 'BATCH-GAP-P3', 2026, 9, 'draft');
INSERT OR IGNORE INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, truth_weight, status) VALUES ('CONCEPT-222', 'CONCEPT', '[26년 신설] 품목별 표본구간 면적 조사방법 (이랑폭 2m 기준 · 품목별 주수 정리표)', '종합위험 수확감소보장 밭작물 품목별 표본구간 면적조사 방법. [품목별 이랑 조사] 양파·마늘: 이랑폭 2m 미만 = 이랑길이(5주 이상) 및 이랑폭 조사 / 단호박·당근: 이랑폭 2m 이상 = 이랑길이(3주 이상) 및 이랑폭 조사 / 가을배추: 이랑길이(6주 이상) 및 이랑폭 조사 / 참깨: 이랑길이(5주 이상) 및 이랑폭 조사 / 가을무(일반무): 이랑길이(10주 이상) 및 이랑폭 조사 / 생강: 1~2줄 재배 = 이랑길이(5주) 및 이랑폭, 3줄 이상 재배 = 이랑길이(4주) 및 이랑폭 / 녹두: 점파 = 이랑길이(4주 이상) 및 이랑폭, 산파 = 규격의 원형(1㎡) 이용 또는 표본구간 가로·세로 길이 조사. [표본구간면적 조사방법 정리표] 3주 이상 = 이랑폭 2m 이상(단호박·양파·마늘·당근) / 4주 이상 = 콩·팥 점파, 생강(3줄 이상 재배) / 5주 이상 = 이랑폭 2m 미만(단호박·양파·마늘·당근)·고구마·양배추·감자·옥수수·참깨·생강(1~2줄 재배) / 6주 이상 = 가을배추(일반 및 병충해보장형) / 8주 이상(1m) = 마늘의 재파종 및 조기파종 / 10주 이상 = 수박·가을무 / 규격 = 차(茶) 규격의 테 20cm×20cm(0.04㎡), 콩·팥 규격의 원형. (rev-2026-2nd p5. ★표 = 단순 매핑표, 원문 인용.)', NULL, '밭작물(양파·마늘·단호박·당근·가을배추·참깨·가을무·생강·녹두·콩·팥 등)', '표본구간 면적조사', 'p.5', 5, 5, '26년 개정사항 정리 — 2차 2과목', '5. 종합위험 수확감소보장 밭작물 — 표본구간 면적조사', 'BATCH-GAP-P3', 2026, 10, 'draft');

-- ============================================================
-- 엣지 4 (EDGE-GAP-P3-0001~0004) — 전부 CONCEPT-178 →(PREREQUISITE)→ 자식
--   ★독립 리뷰 MAJOR-1 반영: 기존 개정 축 25노드(CONCEPT-179~203)가 전부 CONCEPT-178 --PREREQUISITE--> child
--   (META→자식, outbound) 관례. P3 도 동일 방향·타입으로 배선 = META 워크에서 신규 4노드 발견성 확보.
-- ============================================================

INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-GAP-P3-0001', 'CONCEPT-178', 'CONCEPT-219', 'PREREQUISITE', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-GAP-P3-0002', 'CONCEPT-178', 'CONCEPT-220', 'PREREQUISITE', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-GAP-P3-0003', 'CONCEPT-178', 'CONCEPT-221', 'PREREQUISITE', NULL);
INSERT OR IGNORE INTO knowledge_edges (id, from_node, to_node, edge_type, condition) VALUES ('EDGE-GAP-P3-0004', 'CONCEPT-178', 'CONCEPT-222', 'PREREQUISITE', NULL);

-- ============================================================
-- G-GAP 자체 점검 (참고 — 판정은 독립 리뷰):
--   G-GAP-1: inventory ❌ 4건(3b·3c·4b·5d) = 노드 4 (1:1). G-GAP-2: CONCEPT-219~222 연번(max 218+1~), 충돌 0.
--   G-GAP-4 수치: 100개·1주·3주·2m·5주·6주·10주·4주·8주(1m)·20cm(0.04㎡)·1㎡ 등 원문 전수 대조(독립 리뷰).
--   G-GAP-5 draft 4/4. G-GAP-6 행수: 노드 4 + 엣지 4 = 8 INSERT.
--   ESCALATE: 3c 수확량 산출식(formulas INSERT 0) / 교재 본체 중복 여부(진산 판정) / book_page 구교재 앵커 미상.
-- ============================================================
