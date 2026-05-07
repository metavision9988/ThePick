-- ============================================================
-- Phase 2A 별표 2/5/6/7 적재 — TBL-012/013/014/015
-- Session 055 (2026-05-08)
-- 적재 단위: 4 TBL + 31 headers + 51 cells + 4 node_links = 90 INSERT rows
-- 본 SQL은 staging+production 동시 적용 의무 (A2 schema drift CI 정합).
-- BEGIN/COMMIT 미포함 — wrangler d1 execute 자동 wrap (TD-S49-1).
-- ============================================================

-- TBL-012 농작물재해보험 미보상비율 4단계 적용표 (source: LAW-139)
INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status) VALUES ('TBL-012', 'LAW-139', '농작물재해보험 미보상비율 4단계 적용표', 'A_simple', 4, 4, '교재 별표2 / book_page=688 / pdf_page=695 / LAW-139 description 분해', 'draft');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-012-01', 'TBL-012', 'row', 1, 1, NULL, '해당없음');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-012-02', 'TBL-012', 'row', 1, 2, NULL, '미흡');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-012-03', 'TBL-012', 'row', 1, 3, NULL, '불량');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-012-04', 'TBL-012', 'row', 1, 4, NULL, '매우불량');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-012-01', 'TBL-012', 'column', 1, 1, NULL, '단계');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-012-02', 'TBL-012', 'column', 1, 2, NULL, '비율');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-012-03', 'TBL-012', 'column', 1, 3, NULL, '감자·고추 외 적용 (3항목 분포)');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-012-04', 'TBL-012', 'column', 1, 4, NULL, '감자·고추 적용 (2항목 분포)');
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-01-01', 'TBL-012', 'TROW-012-01', 'TCOL-012-01', '해당없음', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-01-02', 'TBL-012', 'TROW-012-01', 'TCOL-012-02', '0%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-01-03', 'TBL-012', 'TROW-012-01', 'TCOL-012-03', '잡초·병해충 농지 면적 20% 미만 분포', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-01-04', 'TBL-012', 'TROW-012-01', 'TCOL-012-04', '잡초 농지 면적 20% 미만 분포 (병해충 별도 보상)', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-02-01', 'TBL-012', 'TROW-012-02', 'TCOL-012-01', '미흡', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-02-02', 'TBL-012', 'TROW-012-02', 'TCOL-012-02', '10% 미만', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-02-03', 'TBL-012', 'TROW-012-02', 'TCOL-012-03', '제초상태·병해충상태·기타 3항목 미흡 (개별 적용 후 합산)', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-02-04', 'TBL-012', 'TROW-012-02', 'TCOL-012-04', '제초상태·기타 2항목 미흡 (개별 적용 후 합산)', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-03-01', 'TBL-012', 'TROW-012-03', 'TCOL-012-01', '불량', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-03-02', 'TBL-012', 'TROW-012-03', 'TCOL-012-02', '20% 미만', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-03-03', 'TBL-012', 'TROW-012-03', 'TCOL-012-03', '3항목 불량 또는 경작불능조사 결과 수확량 조사 결정 + 영농활동 증빙자료 부족', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-03-04', 'TBL-012', 'TROW-012-03', 'TCOL-012-04', '2항목 불량 또는 경작불능조사 결과 수확량 조사 결정 + 영농활동 증빙자료 부족', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-04-01', 'TBL-012', 'TROW-012-04', 'TCOL-012-01', '매우불량', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-04-02', 'TBL-012', 'TROW-012-04', 'TCOL-012-02', '20% 이상', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-04-03', 'TBL-012', 'TROW-012-04', 'TCOL-012-03', '60% 이상 분포 + 증빙자료 없음', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-012-04-04', 'TBL-012', 'TROW-012-04', 'TCOL-012-04', '60% 이상 분포 + 증빙자료 없음', 'text', NULL, NULL, NULL);
INSERT INTO table_node_links (table_id, related_node_id, relation_type) VALUES ('TBL-012', 'LAW-139', 'extracted_from');

-- TBL-013 무화과 사고발생일 잔여수확량 비율 산식 (8/9/10월) (source: LAW-140)
INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status) VALUES ('TBL-013', 'LAW-140', '무화과 사고발생일 잔여수확량 비율 산식 (8/9/10월)', 'F_formula', 3, 2, '교재 별표5 / book_page=695 / pdf_page=702 / LAW-140 description 분해', 'draft');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-013-01', 'TBL-013', 'row', 1, 1, NULL, '8월');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-013-02', 'TBL-013', 'row', 1, 2, NULL, '9월');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-013-03', 'TBL-013', 'row', 1, 3, NULL, '10월');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-013-01', 'TBL-013', 'column', 1, 1, NULL, '월');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-013-02', 'TBL-013', 'column', 1, 2, NULL, '잔여수확량 비율 산식');
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-013-01-01', 'TBL-013', 'TROW-013-01', 'TCOL-013-01', '8월', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-013-01-02', 'TBL-013', 'TROW-013-01', 'TCOL-013-02', '{100 - (1.06 × 사고발생일자)}', 'formula', 'F-155', NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-013-02-01', 'TBL-013', 'TROW-013-02', 'TCOL-013-01', '9월', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-013-02-02', 'TBL-013', 'TROW-013-02', 'TCOL-013-02', '{(100 - 33) - (1.13 × 사고발생일자)}', 'formula', 'F-156', NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-013-03-01', 'TBL-013', 'TROW-013-03', 'TCOL-013-01', '10월', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-013-03-02', 'TBL-013', 'TROW-013-03', 'TCOL-013-02', '{(100 - 67) - (0.84 × 사고발생일자)}', 'formula', 'F-157', NULL, NULL);
INSERT INTO table_node_links (table_id, related_node_id, relation_type) VALUES ('TBL-013', 'LAW-140', 'extracted_from');

-- TBL-014 표본구간별 손해정도비율 10% 단위 10단계 (26년 정합) (source: LAW-141)
INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status) VALUES ('TBL-014', 'LAW-141', '표본구간별 손해정도비율 10% 단위 10단계 (26년 정합)', 'A_simple', 10, 2, '교재 별표6 / book_page=695 / pdf_page=702 / LAW-141 description 분해', 'draft');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-01', 'TBL-014', 'row', 1, 1, NULL, '1~10%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-02', 'TBL-014', 'row', 1, 2, NULL, '11~20%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-03', 'TBL-014', 'row', 1, 3, NULL, '21~30%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-04', 'TBL-014', 'row', 1, 4, NULL, '31~40%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-05', 'TBL-014', 'row', 1, 5, NULL, '41~50%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-06', 'TBL-014', 'row', 1, 6, NULL, '51~60%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-07', 'TBL-014', 'row', 1, 7, NULL, '61~70%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-08', 'TBL-014', 'row', 1, 8, NULL, '71~80%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-09', 'TBL-014', 'row', 1, 9, NULL, '81~90%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-014-10', 'TBL-014', 'row', 1, 10, NULL, '91~100%');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-014-01', 'TBL-014', 'column', 1, 1, NULL, '손해정도 구간');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-014-02', 'TBL-014', 'column', 1, 2, NULL, '손해정도비율');
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-01-01', 'TBL-014', 'TROW-014-01', 'TCOL-014-01', '1~10%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-01-02', 'TBL-014', 'TROW-014-01', 'TCOL-014-02', '10%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-02-01', 'TBL-014', 'TROW-014-02', 'TCOL-014-01', '11~20%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-02-02', 'TBL-014', 'TROW-014-02', 'TCOL-014-02', '20%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-03-01', 'TBL-014', 'TROW-014-03', 'TCOL-014-01', '21~30%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-03-02', 'TBL-014', 'TROW-014-03', 'TCOL-014-02', '30%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-04-01', 'TBL-014', 'TROW-014-04', 'TCOL-014-01', '31~40%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-04-02', 'TBL-014', 'TROW-014-04', 'TCOL-014-02', '40%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-05-01', 'TBL-014', 'TROW-014-05', 'TCOL-014-01', '41~50%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-05-02', 'TBL-014', 'TROW-014-05', 'TCOL-014-02', '50%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-06-01', 'TBL-014', 'TROW-014-06', 'TCOL-014-01', '51~60%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-06-02', 'TBL-014', 'TROW-014-06', 'TCOL-014-02', '60%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-07-01', 'TBL-014', 'TROW-014-07', 'TCOL-014-01', '61~70%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-07-02', 'TBL-014', 'TROW-014-07', 'TCOL-014-02', '70%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-08-01', 'TBL-014', 'TROW-014-08', 'TCOL-014-01', '71~80%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-08-02', 'TBL-014', 'TROW-014-08', 'TCOL-014-02', '80%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-09-01', 'TBL-014', 'TROW-014-09', 'TCOL-014-01', '81~90%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-09-02', 'TBL-014', 'TROW-014-09', 'TCOL-014-02', '90%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-10-01', 'TBL-014', 'TROW-014-10', 'TCOL-014-01', '91~100%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-014-10-02', 'TBL-014', 'TROW-014-10', 'TCOL-014-02', '100%', 'text', NULL, NULL, NULL);
INSERT INTO table_node_links (table_id, related_node_id, relation_type) VALUES ('TBL-014', 'LAW-141', 'extracted_from');

-- TBL-015 고추 병충해 등급별 인정비율 (1·2·3등급) (source: LAW-142)
INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status) VALUES ('TBL-015', 'LAW-142', '고추 병충해 등급별 인정비율 (1·2·3등급)', 'A_simple', 3, 3, '교재 별표7 / book_page=695 / pdf_page=702 / LAW-142 description 분해', 'draft');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-015-01', 'TBL-015', 'row', 1, 1, NULL, '1등급');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-015-02', 'TBL-015', 'row', 1, 2, NULL, '2등급');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TROW-015-03', 'TBL-015', 'row', 1, 3, NULL, '3등급');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-015-01', 'TBL-015', 'column', 1, 1, NULL, '등급');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-015-02', 'TBL-015', 'column', 1, 2, NULL, '인정비율');
INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES ('TCOL-015-03', 'TBL-015', 'column', 1, 3, NULL, '병충해 종류');
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-015-01-01', 'TBL-015', 'TROW-015-01', 'TCOL-015-01', '1등급', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-015-01-02', 'TBL-015', 'TROW-015-01', 'TCOL-015-02', '70%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-015-01-03', 'TBL-015', 'TROW-015-01', 'TCOL-015-03', '역병·풋마름병·바이러스병·세균성점무늬병·탄저병', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-015-02-01', 'TBL-015', 'TROW-015-02', 'TCOL-015-01', '2등급', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-015-02-02', 'TBL-015', 'TROW-015-02', 'TCOL-015-02', '50%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-015-02-03', 'TBL-015', 'TROW-015-02', 'TCOL-015-03', '잿빛곰팡이병·시들음병·담배가루이·담배나방', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-015-03-01', 'TBL-015', 'TROW-015-03', 'TCOL-015-01', '3등급', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-015-03-02', 'TBL-015', 'TROW-015-03', 'TCOL-015-02', '30%', 'text', NULL, NULL, NULL);
INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id) VALUES ('TCELL-015-03-03', 'TBL-015', 'TROW-015-03', 'TCOL-015-03', '흰가루병·균핵병·무름병·진딧물 및 기타', 'text', NULL, NULL, NULL);
INSERT INTO table_node_links (table_id, related_node_id, relation_type) VALUES ('TBL-015', 'LAW-142', 'extracted_from');

