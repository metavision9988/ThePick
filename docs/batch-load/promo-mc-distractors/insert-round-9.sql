-- promo-1st P3 — 제9회(2023) 1차 4지선다 신규 MC 행 75건 (순수 INSERT, old 행 무접촉)
-- 소스: docs/batch-load/batch-Q-2023-9-1st/batch-Q-2023-09-1st.json + answer-corrections.json (교정 0·제외 0)
-- 전략: ADR-046 D-6(a) 정합 — {oldId}-MC 신규 행 + INSERT...SELECT 메타 승계 + answer 가드
-- 검산 (적용 직후 기계 실행 의무): SELECT COUNT(*) FROM exam_questions WHERE id LIKE '%-MC' AND round=9; -- 기대 75
-- 부분 실패 복구: SELECT id FROM exam_questions WHERE id LIKE '%-MC' AND round=9; 로 기적재분 확인 후 잔여만 재실행
PRAGMA foreign_keys = ON;

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 보험자가 보험계약자로부터 손해보험계약의 청약과 함께 보험료 상당액의 전부 또는 일부를 받은 경우 이 보험계약에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험계약은 낙성계약이므로 보험자가 승낙하면 성립한다.","다른 약정이 없으면 보험자는 30일내에 보험계약자에 대하여 낙부의 통지를 발송하여야 한다.","보험자가 상법이 정하는 낙부의 통지기간내에 그 통지를 해태한 때에는 승낙한 것으로 본다.","승낙하기 전에 발생한 보험사고에 대해서 청약을 거절할 사유가 있더라도 보험자는 보험계약상의 책임을 진다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-001' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 타인을 위한 보험에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험계약자는 보험자에 대하여 보험료를 지급할 의무가 있다.","보험계약자는 위임을 받지 아니하고 타인을 위하여 보험계약을 체결할 수 있다.","타인은 계약 성립 시 특정되어야 한다.","보험계약자가 파산선고를 받은 때에는 그 타인이 그 권리를 포기하지 아니하는 한 그 타인도 보험료를 지급할 의무가 있다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-002' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 보험증권에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["기존의 보험계약을 변경한 경우 보험자는 그 보험증권에 그 사실을 기재함으로써 보험증권의 교부에 갈음할 수 있다.","보험자는 보험계약자의 청약이 있는 경우 보험료의 지급 여부와 상관없이 지체없이 보험증권을 작성하여 보험계약자에게 교부하여야 한다.","보험계약의 당사자는 보험증권의 교부가 있은 날부터 14일내에 한하여 그 증권내용의 정부(正否)에 관한 이의를 할 수 있음을 약정할 수 있다.","보험계약자가 보험증권을 멸실한 경우 보험계약자는 보험자에게 증권의 재교부를 청구할 수 있으며, 그 증권작성의 비용은 보험자의 부담으로 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-003' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 보험사고 등에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험계약은 그 계약전의 어느 시기를 보험기간의 시기(始期)로 할 수 있다.","보험계약 당시에 보험사고가 발생할 수 없음이 객관적으로 확정된 경우 당사자 쌍방과 피보험자가 이를 알았는지 여부에 관계없이 그 계약은 무효로 한다.","자기를 위한 보험계약에서 보험사고가 발생하기 전에는 언제든지 보험계약자는 계약의 전부 또는 일부를 해지할 수 있다.","피보험자는 보험사고의 발생을 안 때에는 지체없이 보험자에게 그 통지를 발송하여야 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-004' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '甲은 보험대리상이 아니면서 특정한 보험자 乙을 위하여 계속적으로 보험계약의 체결을 중개하는 자로서 丙이 乙과 보험계약을 체결하도록 중개하였다. 甲의 권한 에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["甲은 자신이 작성한 영수증을 丙에게 교부하는 경우 丙으로부터 보험료를 수령할 권한이 있다.","甲은 乙이 작성한 보험증권을 丙에게 교부할 수 있는 권한이 있다.","甲은 丙으로부터 청약, 고지, 통지, 해지, 취소 등 보험계약에 관한 의사표시를 수령할 수 있는 권한이 없다.","甲은 丙에게 보험계약의 체결, 변경, 해지 등 보험계약에 관한 의사표시를 할 수 있는 권한이 없다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-005' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 보험료의 지급 및 반환 등에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험사고가 발생하기 전에 보험계약자가 계약을 해지한 경우 당사자간에 약정을 한 경우에 한해 보험계약자는 미경과보험료의 반환을 청구할 수 있다.","보험계약자가 계약체결후 제1회 보험료를 지급하지 아니하는 경우 다른 약정이 없는 한 보험자가 계약성립후 2월이내에 그 계약을 해제하지 않으면 그 계약은 존속한다.","계속보험료가 약정한 시기에 지급되지 아니한 때에는 보험자는 보험계약자에 대하여 최고 없이 그 계약을 해지할 수 있다.","특정한 타인을 위한 보험의 경우에 보험계약자가 보험료의 지급을 지체한 때에는 보험자는 그 타인에게 상당한 기간을 정하여 보험료의 지급을 최고한 후가 아니면 그 계약을 해제 또는 해지하지 못한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-006' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 보험계약자가 부활을 청구할 수 있는 경우는 모두 몇 개인가? (단, 어느 경우든 해지환급금은 지급되지 않음) ○ 보험계약자가 계속보험료를 지급하지 않아 보험자가 계약을 해지한 경우 ○ 피보험자의 고지의무 위반을 이유로 보험자가 계약을 해지한 경우 ○ 위험이 현저하게 변경되어 보험자가 계약을 해지한 경우 ○ 위험이 현저하게 증가하여 보험자가 계약을 해지한 경우', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["1개","2개","3개","4개"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-007' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 고지의무에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험수익자는 고지의무를 부담한다.","보험계약당시에 고지의무와 관련 보험자가 서면으로 질문한 사항은 중요한 사항으로 의제한다.","고지의무자의 고지의무 위반을 이유로 보험자가 계약을 해지한 경우 보험자는 이미 받은 보험료의 전부를 반환하여야 한다.","고지의무자가 고지의무를 위반한 사실이 보험사고 발생에 영향을 미치지 아니하였음이 증명된 경우 보험자는 보험금을 지급할 책임이 있다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-008' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 보험계약 관련 소멸시효의 기간으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험금청구권: 2년","보험료청구권: 3년","보험료의 반환청구권: 2년","적립금의 반환청구권: 3년"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-009' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 손해보험증권에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험사고의 성질을 기재하여야 한다.","보험증권의 작성지를 기재하여야 한다.","보험계약자가 기명날인하여야 한다.","무효와 실권의 사유를 기재하여야 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-010' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 초과보험에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험자 또는 보험계약자는 보험료와 보험금액의 감액을 청구할 수 있다.","보험계약자가 청구한 보험료의 감액은 계약체결일부터 소급하여 그 효력이 있다.","보험가액이 보험기간 중에 현저하게 감소된 때에도 보험계약자는 보험료의 감액을 청구할 수 없다.","보험계약자의 사기로 인하여 체결된 초과보험의 경우 보험자는 그 계약을 체결한 날부터 1월내에 계약을 해지할 수 있다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-011' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 보험가액에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험가액이란 피보험이익을 금전적으로 산정 또는 평가한 액수이다.","당사자간에 보험가액을 정한 때에는 그 가액은 사고발생시의 가액으로 정한 것으로 본다.","당사자간에 보험가액을 정하지 아니한 때에는 사고발생시의 가액을 보험가액으로 한다.","기평가보험에서 당사자간에 정한 보험가액이 사고발생시의 가액을 현저하게 초과할 때에는 사고발생시의 가액을 보험가액으로 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-012' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 손해보험계약에서 보험금액의 지급에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험자는 보험금액의 지급에 관하여 약정기간이 있는 경우에는 그 기간내에 지급할 보험금액을 정하여야 한다.","보험사고가 전쟁으로 인하여 생긴 때에도 당사자간에 다른 약정이 없으면 보험자는 보험금액을 지급할 책임이 있다.","보험사고가 피보험자의 중대한 과실로 인하여 생긴 때에는 보험자는 보험금액을 지급 할 책임이 없다.","보험자는 보험금액의 지급에 관하여 약정기간이 없는 경우에는 보험사고 발생의 통지를 받은 후 지체없이 지급할 보험금액을 정하고 그 정하여진 날부터 10일내에 피보험자에게 보험금액을 지급하여야 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-013' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법 제663조(보험계약자 등의 불이익변경금지) 규정이다. ( )에 들어갈 내용은? 이 편의 규정은 당사자간의 특약으로 보험계약자 또는 피보험자나 보험수익자의 불이익으로 변경하지 못한다. 그러나 ( ㄱ ) 및 ( ㄴ ) 기타 이와 유사한 보험의 경우에는 그러하지 아니하다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["ㄱ: 책임보험, ㄴ: 해상보험","ㄱ: 책임보험, ㄴ: 화재보험","ㄱ: 재보험, ㄴ: 해상보험","ㄱ: 재보험, ㄴ: 화재보험"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-014' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 보험기간 중에 사고발생의 위험이 현저하게 변경 또는 증가된 경우에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험수익자가 사고발생의 위험이 현저하게 변경된 사실을 안 때에는 지체없이 보험자 에게 통지하여야 한다.","통지의무자가 사고발생의 위험이 현저하게 증가된 사실의 통지를 해태한 때에는 보험자는 그 사실을 안 날부터 3월내에 한하여 계약을 해지할 수 있다.","보험수익자의 중대한 과실로 인하여 사고발생의 위험이 현저하게 증가된 때에는 보험자는 그 사실을 안 날부터 2월내에 계약을 해지할 수 있다.","보험자가 사고발생의 위험변경증가의 통지를 받은 때에는 1월내에 보험료의 증액을 청구할 수 있다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-015' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 보험계약해지 및 보험사고발생에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험자가 파산의 선고를 받은 때에는 보험계약자는 계약을 해지할 수 있다.","보험수익자는 보험사고의 발생을 안 때에는 지체없이 보험계약자에게 그 통지를 발송 하여야 한다.","보험계약자가 사고발생의 통지의무를 해태함으로 인하여 손해가 증가된 때에는 보험자는 그 증가된 손해를 보상할 책임이 없다.","보험자의 파산선고에도 불구하고 보험계약자가 해지하지 아니한 보험계약은 파산선고 후 3월을 경과한 때에는 그 효력을 잃는다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-016' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 손해보험에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험자는 보험사고로 인하여 생길 보험수익자의 재산상의 손해를 보상할 책임이 있다.","보험사고로 인하여 상실된 피보험자가 얻을 이익이나 보수는 보험자가 보상할 손해액에 산입한다.","대리인에 의하여 손해보험계약을 체결한 경우에 대리인이 안 사유는 그 본인이 안 것과 동일한 것으로 할 수 없다.","보험계약은 금전으로 산정할 수 있는 이익에 한하여 보험계약의 목적으로 할 수 있다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-017' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 손해보험에서 중복보험에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["중복보험은 동일한 보험계약의 목적과 동일한 사고에 관하여 수개의 보험계약이 동시에 또는 순차로 체결되는 방식으로 성립할 수 있다.","중복보험에서 그 보험금액의 총액이 보험가액을 초과한 때에는 보험자는 각자의 보험 금액의 한도에서 연대책임을 지며 이 경우 각 보험자의 보상책임은 각자의 보험금액의 비율에 따른다.","보험계약자의 사기로 인하여 중복보험 계약이 체결된 경우 보험자는 그 사실을 안 때 까지의 보험료를 청구할 수 없다.","보험자 1인에 대한 권리의 포기는 다른 보험자의 권리의무에 영향을 미치지 아니한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-018' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 손해보험에서 일부보험에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["일부보험이란 보험가액이 보험금액에 미달되는 경우를 말한다.","당사자간에 다른 약정이 없는한 보험자는 보험가액의 보험금액에 대한 비율에 따라 보상할 책임을 진다.","보험자는 보험금액의 한도내에서 그 손해를 전부 보상할 책임을 지는 내용의 약정을 할 수 있다.","전부보험계약 체결후 물가등귀로 인하여 보험가액이 현저히 인상되더라도 일부보험은 발생하지 아니한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-019' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 손해보험에서 손해액의 산정기준 등에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험자가 보상할 손해액의 산정에 관한 비용은 보험자의 부담으로 한다.","당사자간에 다른 약정이 없는 경우 보험자가 보상할 손해액은 그 손해가 발생한 때의 보험계약 체결지의 가액에 의하여 산정한다.","당사자간의 약정에 의하여 보험의 목적의 신품가액에 의하여 손해액을 산정할 수 있다.","보험의 목적의 성질, 하자 또는 자연소모로 인한 손해는 보험자가 이를 보상할 책임이 없다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-020' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '甲이 자기 소유 건물에 대하여 A보험회사와 화재보험을 체결한 경우에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["A보험회사가 甲으로부터 보험료의 지급을 받지 아니한 잔액이 있더라도 그 지급기일이 아직 도래하지 아니한 때에는, A보험회사는 甲에게 손해를 보상할 경우에 보상할 금액 에서 그 잔액을 공제하여서는 아니된다.","A보험회사는 보험사고로 인하여 부담할 책임에 대하여 다른 보험자와 재보험계약을 체결할 수 있다.","甲이 보험의 목적인 건물을 乙에게 양도한 때에는 乙은 보험계약상의 권리와 의무를 승계한 것으로 추정한다.","甲이 보험의 목적인 건물을 乙에게 양도한 경우 甲 또는 乙은 A보험회사에 대하여 지체없이 그 사실을 통지하여야 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-021' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '다음 사례와 관련하여 손해방지의무 등에 관한 설명으로 옳지 않은 것은? 甲은 乙이 소유한 창고(시가 1억원)에 대하여 A보험회사와 화재보험계약(보험 금액 1억원)을 체결하였다. 이후 보험기간 중 해당 창고에 화재가 발생하였는데 화재사고 당시 甲은 창고의 연소로 인한 손해방지를 위한 비용을 1천만원 지출 하였고, 乙은 창고의 연소로 인한 손해의 경감을 위하여 비용을 3천만원 지출 하였다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["甲과 乙 모두 손해의 방지와 경감을 위하여 노력하여야 한다.","甲이 지출한 1천만원이 손해방지를 위하여 필요하였던 비용일 경우 A보험회사는 甲이 지출한 1천만원의 비용을 부담한다.","乙이 지출한 3천만원이 손해경감을 위하여 유익하였던 비용일 경우 A보험회사는 乙이 지출한 3천만원의 비용을 부담한다.","위 사고로 인하여 乙에 대한 보상액이 8천만원으로 책정될 경우 A보험회사는 甲 및 乙이 지출한 비용과 보상액을 합쳐서 1억원의 한도에서 부담한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-022' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '다음 사례와 관련하여 보험자대위에 관한 설명으로 옳은 것은? 보리 농사를 대규모로 영위하는 甲은 금년에 수확하여 팔고남은 보리를 자신의 창고에 보관하면서, 해당 보리 재고를 보험목적으로 하고 자신을 피보험자로 하는 화재보험계약을 A보험회사와 체결하였다. 그런데 甲의 창고를 방문한 乙 이 화재를 일으켰고 그 결과 위 보리 재고가 전소되었다. 이에 A보험회사는 甲 에게 보험금을 전액 지급하였다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["중과실로 화재를 일으킨 乙이 甲의 이웃집 친구일 경우, A보험회사는 乙에게 보험금 지급사실의 통지를 발송하는 시점에 乙에 대한 甲의 권리를 취득한다.","경과실로 화재를 일으킨 乙이 甲의 거래처 지인일 경우, A보험회사는 그 지급한 금액의 한도에서 乙에 대한 甲의 권리를 취득한다.","중과실로 화재를 일으킨 乙이 甲과 생계를 달리 하는 자녀일 경우, A보험회사는 乙에 대한 甲의 권리를 취득하지 못한다.","고의로 방화한 乙이 甲과 생계를 같이 하는 배우자일 경우, A보험회사는 乙에 대한 甲의 권리를 취득하지 못한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-023' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 화재보험계약에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["보험자는 화재와 상당인과관계에 있는 손해를 보상하여야 한다.","보험자는 화재의 소방 또는 손해의 감소에 필요한 조치로 인하여 생긴 손해를 보상할 책임이 있다.","동일한 건물에 관한 화재보험계약일 경우 그 소유자와 담보권자가 갖는 피보험이익은 같다.","연소 작용이 아닌 열의 작용으로 발생한 손해는 보험자가 보상하지 아니한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-024' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '상법상 집합된 물건을 일괄하여 화재보험의 목적으로 한 경우 해당 화재보험에 관한 설명으로 옳은 것을 모두 고른 것은? ㄱ. 집합된 물건에 피보험자의 가족의 물건이 있는 경우 해당 물건도 보험의 목 적에 포함된 것으로 한다. ㄴ. 집합된 물건에 피보험자의 사용인의 물건이 있는 경우 그 보험은 그 사용인 을 위하여서도 체결한 것으로 본다. ㄷ. 보험의 목적에 속한 물건이 보험기간중에 수시로 교체된 경우 보험계약의 체결 시에 현존한 물건은 그 보험의 목적에 포함된 것으로 한다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["ㄱ, ㄴ","ㄱ, ㄷ","ㄴ, ㄷ","ㄱ, ㄴ, ㄷ"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-025' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법상 용어의 정의로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["“농업재해”란 농작물ㆍ임산물ㆍ가축 및 농업용 시설물에 발생하는 자연재해ㆍ병충해 ㆍ조수해(鳥獸害)ㆍ질병 또는 화재를 말한다.","“농어업재해보험”이란 농어업재해로 발생하는 재산 피해에 따른 손해를 보상하기 위한 보험을 말한다.","“보험금”이란 보험가입자와 보험사업자 간의 약정에 따라 보험가입자가 보험사업자에게 내야 하는 금액을 말한다.","“보험가입금액”이란 보험가입자의 재산 피해에 따른 손해가 발생한 경우 보험에서 최대로 보상할 수 있는 한도액으로서 보험가입자와 보험사업자 간에 약정한 금액을 말한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-026' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법령상 농업재해보험심의회에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["심의회는 위원장 및 부위원장 각 1명을 포함한 21명 이내의 위원으로 구성한다.","심의회의 위원장은 농림축산식품부장관이 위촉한다.","심의회는 그 심의 사항을 검토ㆍ조정하고, 심의회의 심의를 보조하게 하기 위하여 심 의회에 분과위원회를 둘 수 있다.","심의회의 회의는 재적위원 과반수의 출석으로 개의(開議)하고, 출석위원 과반수의 찬 성으로 의결한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-027' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법상 재해보험에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["재해보험에서 보상하는 재해의 범위는 해당 재해의 발생 빈도, 피해 정도 및 객관적인 손해평가방법 등을 고려하여 재해보험의 종류별로 대통령령으로 정한다.","양식수산업에 종사하는 법인은 재해보험에 가입할 수 없다.","「수산업협동조합법」에 따른 수산업협동조합중앙회는 재해보험사업을 할 수 있다.","정부는 재해보험에서 보상하는 재해의 범위를 확대하기 위하여 노력하여야 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-028' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법상 보험료율의 산정에 관한 내용이다. ( )에 들어갈 용어는? 농림축산식품부장관 또는 해양수산부장관과 재해보험사업의 약정을 체결한 자는 재해보험의 보험료율을 객관적이고 합리적인 통계자료를 기초로 하여 ( ㄱ ) 또 는 ( ㄴ )로 산정하되, 행정구역과 권역의 구분에 따른 단위로 산정하여야 한다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["ㄱ: 보험목적물별, ㄴ: 보상방식별","ㄱ: 보상방식별, ㄴ: 보험종류별","ㄱ: 보험종류별, ㄴ: 보험가입금액별","ㄱ: 보험가입금액별, ㄴ: 보험료별"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-029' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법령상 농작물재해보험 손해평가인의 자격요건에 관한 내용의 일부이다. ( )에 들어갈 숫자는? 「보험업법」에 따른 보험회사의 임직원이나 「농업협동조합법」에 따른 중 앙회와 조합의 임직원으로 영농 지원 또는 보험ㆍ공제 관련 업무를 ( ㄱ )년 이상 담당하였거나 손해평가 업무를 ( ㄴ )년 이상 담당한 경력이 있는 사람', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["ㄱ: 2, ㄴ: 1","ㄱ: 1, ㄴ: 2","ㄱ: 3, ㄴ: 2","ㄱ: 2, ㄴ: 3"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-030' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법령상 손해평가사의 시험 등에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["금융감독원에서 손해사정 관련 업무에 2년 종사한 경력이 있는 사람에게는 손해평가사 자격시험 과목의 일부를 면제할 수 있다.","농림축산식품부장관은 부정한 방법으로 시험에 응시한 사람에 대하여는 그 시험을 정지시키고 그 처분 사실을 14일 이내에 알려야 한다.","농림축산식품부장관은 시험에서 부정한 행위를 한 사람에 대하여는 그 시험을 취소하고 그 처분 사실을 7일 이내에 알려야 한다.","손해평가사는 다른 사람에게 그 명의를 사용하게 하거나 다른 사람에게 그 자격증을 대여해서는 아니 된다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-031' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법령상 손해평가사의 자격취소 사유에 해당하지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["심신장애로 인하여 직무를 수행할 수 없게 된 경우","거짓으로 손해평가를 한 경우","업무정지 기간 중에 손해평가 업무를 수행한 경우","손해평가사의 자격을 거짓 또는 부정한 방법으로 취득한 경우"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-032' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법상 재해보험사업에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["농림축산식품부장관은 손해평가사가 그 직무를 수행하면서 부적절한 행위를 하였다고 인정하면 1년 이상의 기간을 정하여 업무의 정지를 명할 수 있다.","재해보험사업자는 정보통신장애나 그 밖에 대통령령으로 정하는 불가피한 사유로 보험금을 보험금수급계좌로 이체할 수 없을 때에는 현금으로 보험금을 지급할 수 있다.","보험목적물이 담보로 제공된 경우에는 이를 압류할 수 없다.","재해보험가입자가 재해보험에 가입된 보험목적물을 양도하는 경우 재해보험계약에 관한 양도인의 의무는 그 양수인에게 승계되지 않는다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-033' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법령상 재보험 약정에 포함되는 사항을 모두 고른 것은? ㄱ. 재보험 약정의 변경ㆍ해지 등에 관한 사항 ㄴ. 재보험 책임범위에 관한 사항 ㄷ. 재보험금 지급 및 분쟁에 관한 사항', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["ㄱ, ㄴ","ㄱ, ㄷ","ㄴ, ㄷ","ㄱ, ㄴ, ㄷ"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-034' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법상 과태료 부과대상인 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["거짓으로 손해평가를 한 손해평가사","재해보험을 모집할 수 없는 자로서 모집을 한 자","다른 사람에게 손해평가사 자격증을 대여한 손해평가사","농림축산식품부장관이 재해보험사업에 관한 업무처리 상황을 보고하게 하였으나 보고 하지 아니한 재해보험사업자"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-035' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법령상 농어업재해재보험기금에 관한 사항으로 농림축산식품부 장관과 해양수산부장관이 협의하여 하는 것이 아닌 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["기금의 설치","기금의 관리ㆍ운용","기금의 부담으로 금융기관으로부터 자금을 차입하는 것","기금의 결산"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-036' AND exam_type = '1st' AND status = 'active' AND answer = '1,2,3,4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농어업재해보험법령상 보험사업의 관리에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["농림축산식품부장관 또는 해양수산부장관은 손해평가사 제도 운용 관련 업무를 농업 정책보험금융원에 위탁할 수 있다.","정부가 하는 재해보험 가입 촉진을 위한 조치로서 신용보증 지원을 할 수 없다.","농림축산식품부장관은 손해평가인의 자격요건에 대하여 매년 그 타당성을 검토하여야 한다.","농림축산식품부장관은 보험가입촉진계획을 매년 수립한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-037' AND exam_type = '1st' AND status = 'active' AND answer = '1,2,3,4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 손해평가반의 구성에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["손해평가반은 재해보험사업자가 구성한다.","「보험업법」제186조에 따른 손해사정사는 손해평가반에 포함될 수 있다.","손해평가인 2인과 손해평가보조인 3인으로는 손해평가반을 구성할 수 없다.","자기 또는 이해관계자가 모집한 보험계약에 관한 손해평가에 대하여는 해당자를 손해 평가반 구성에서 배제하여야 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-038' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 손해평가인에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["손해평가인은 농업재해보험이 실시되는 시ㆍ군ㆍ자치구별 보험가입자의 수 등을 고려 하여 적정 규모로 위촉하여야 한다.","손해평가인증은 농림축산식품부장관 또는 해양수산부장관이 발급한다.","재해보험사업자는 손해평가 업무를 원활히 수행하기 위하여 손해평가보조인을 운용할 수 있다.","재해보험사업자는 실무교육을 받는 손해평가인에 대하여 소정의 교육비를 지급할 수 있다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-039' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 농업재해보험의 종류에 해당하지 않는 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["농작물재해보험","양식수산물재해보험","가축재해보험","임산물재해보험"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-040' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 손해평가인의 업무에 해당하는 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["피해사실 확인","재해보험사업의 약정 체결","보험료율의 산정","재해보험상품의 연구와 보급"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-041' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 손해평가인 위촉의 취소 사유에 해당하는 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["업무수행과 관련하여 「개인정보보호법」을 위반한 경우","업무수행과 관련하여 보험사업자로부터 금품 또는 향응을 제공받은 경우","손해평가인이 피한정후견인이 된 경우","손해평가인 위촉이 취소된 후 3년이 경과한 때에 다시 손해평가인으로 위촉된 경우"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-042' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 교차손해평가에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["평가인력 부족 등으로 신속한 손해평가가 불가피하다고 판단되는 경우 손해평가반의 구성에 지역손해평가인을 포함시키지 않을 수 있다.","교차손해평가를 위해 손해평가반을 구성할 경우 농업재해보험 손해평가요령에 따라 선발된 지역손해평가인 2인 이상이 포함되어야 한다.","재해보험사업자가 교차손해평가를 담당할 지역손해평가인을 선발할 때 타지역 조사 가능여부는 고려사항이다.","재해보험사업자는 교차손해평가가 필요한 경우 재해보험 가입규모, 가입분포 등을 고려하여 교차손해평가 대상 시ㆍ군ㆍ구를 선정하여야 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-043' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 손해평가결과 검증에 관한 설명으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["농림축산식품부장관은 재해보험사업자로 하여금 검증조사를 하게 할 수 있으며, 재해 보험사업자는 특별한 사유가 없는 한 이에 응하여야 한다.","보험가입자가 정당한 사유없이 검증조사를 거부하는 경우 검증조사반은 검증조사가 불가능하여 손해평가 결과를 확인할 수 없다는 사실을 지체없이 농림축산식품부장관 에게 보고하여야 한다.","검증조사결과 현저한 차이가 발생되어 재조사가 불가피하다고 판단될 경우에는 해당 손해평가반이 조사한 전체 보험목적물에 대하여 재조사를 할 수 있다.","재해보험사업자 및 재해보험사업의 재보험사업자는 손해평가반이 실시한 손해평가 결과를 확인하기 위하여 손해평가를 실시한 보험목적물 중에서 일정수를 임의 추 출하여 검증조사를 할 수 있다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-044' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 보험목적물별 손해평가 단위로 옳은 것을 모두 고른 것은? ㄱ. 농작물 : 농지별(농지라 함은 하나의 보험가입금액에 해당하는 토지로 필 지에 따라 구획된 경작지를 말함) ㄴ. 가축 : 개별가축별(단, 벌은 벌통 단위) ㄷ. 농업시설물 : 보험가입 목적물별', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["ㄱ, ㄴ","ㄱ, ㄷ","ㄴ, ㄷ","ㄱ, ㄴ, ㄷ"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-045' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 ‘농작물의 품목별ㆍ재해별ㆍ시기별 손해수량 조사 방법’ 중 ‘특정위험방식 상품(인삼)’에 관한 것으로 ( )에 들어갈 내용은? 생육시기 재해 조사내용 조사시기 보험기간 태풍(강풍) 수확량 조사 ( )', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["수확 직전","사고접수 후 지체 없이","수확완료 후 보험 종기 전","피해 확인이 가능한 시기"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-046' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 종합위험방식의 과실손해보장 보험금 산정시 피해율로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["감귤 : (등급내 피해과실수 + 등급외 피해과실수 × 70%) ÷ 기준과실수","복분자 : 고사결과모지수 ÷ 평년결과모지수","오디 : (평년결실수 – 조사결실수 – 미보상감수결실수) ÷ 평년결실수","7월 31일 이전에 사고가 발생한 무화과 : (1 – 수확전사고 피해율) × 경과비율 × 결과지 피해율"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-047' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 가축의 보험가액 및 손해액 산정 등에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["가축에 대한 보험가액은 보험사고가 발생한 때와 곳에서 평가한 보험목적물의 수량에 시장가격을 곱하여 산정한다.","가축에 대한 손해액 산정시 보험가입당시 보험가입자와 재해보험사업자가 별도로 정한 방법은 고려하지 않는다.","가축에 대한 보험가액 산정시 보험목적물에 대한 감가상각액을 고려해야 한다.","가축에 대한 손해액은 보험사고가 발생한 때와 곳에서 폐사 등 피해를 입은 보험목적물의 수량에 적용가격을 곱하여 산정한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-048' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령상 농작물의 보험가액 산정에 관한 설명이다. ( )에 들어갈 내용은? 적과전종합위험방식의 보험가액은 적과후착과수조사를 통해 산정한 ( ㄱ )에 보 험가입 당시의 단위당 ( ㄴ )을 곱하여 산정한다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["ㄱ: 기준수확량, ㄴ: 가입가격","ㄱ: 보장수확량, ㄴ: 가입가격","ㄱ: 기준수확량, ㄴ: 시장가격","ㄱ: 보장수확량, ㄴ: 시장가격"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-049' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '농업재해보험 손해평가요령에 관한 설명으로 옳은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["농림축산식품부장관은 요령에 대하여 매년 그 타당성을 검토하여 개선 등의 조치를 하여야 한다.","농업시설물에 대한 손해액은 보험사고가 발생한 때와 곳에서 산정한 피해목적물의 원 상복구비용을 말한다.","농업시설물에 대한 보험가액은 보험사고가 발생한 때와 곳에서 평가한 피해목적물의 재조달가액으로 한다.","농림축산식품부장관은 요령의 효율적인 운용 및 시행을 위하여 필요한 세부적인 사항 을 규정한 손해평가업무방법서를 작성하여야 한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-050' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '작물 분류학적으로 가지과에 해당하는 것을 모두 고른 것은? ㄱ. 고추 ㄴ. 토마토 ㄷ. 감자 ㄹ. 딸기', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["ㄱ, ㄹ","ㄱ, ㄴ, ㄷ","ㄴ, ㄷ, ㄹ","ㄱ, ㄴ, ㄷ, ㄹ"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-051' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '콩과작물의 작황부족으로 어려움을 겪고 있는 농가를 찾은 A손해평가사의 재배지에 대한 판단으로 옳은 것은? ○ 작물의 칼슘 부족증상이 발생했다. ○ 근류균 활력이 떨어졌다. ○ 작물의 망간 장해가 발생했다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["재배지의 온도가 높다.","재배지에 질소가 부족하다.","재배지의 일조량이 부족하다.","재배지가 산성화되고 있다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-052' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '작물의 질소에 관한 내용이다. ( )에 들어갈 내용을 순서대로 옳게 나열한 것은? 작물재배에서 ( )작물에 비해 ( )작물은 질소 시비량을 늘려 주는 것이 좋으 며, 잎의 질소 결핍 증상은 ( )보다 ( )에서 먼저 나타난다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["콩과, 벼과, 유엽, 성엽","벼과, 콩과, 유엽, 성엽","콩과, 벼과, 성엽, 유엽","벼과, 콩과, 성엽, 유엽"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-053' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '한해피해 조사를 마친 A손해평가사가 농가에 설명한 작물 내 물의 역할로 옳은 것은 몇 개인가? ○ 물질 합성과정의 매개 ○ 양분 흡수의 용매 ○ 세포의 팽압 유지 ○ 체내의 항상성 유지', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["1개","2개","3개","4개"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-054' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '과수작물의 서리피해에 관한 내용이다. 밑줄 친 부분이 옳은 것을 모두 고른 것은? 최근 지구온난화에 따른 기상이변으로 개화기가 빠른 (ㄱ)핵과류에서 피해가 빈 번하게 발생한다. 특히, 과수원이 (ㄴ)강이나 저수지 옆에 있을 때 발생률이 높 다. 따라서 일부 농가에서는 상층의 더운 공기를 아래로 불어내려 과수원의 기온 저하를 막아주는 (ㄷ)송풍법을 사용하고 있다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["ㄱ","ㄱ, ㄴ","ㄴ, ㄷ","ㄱ, ㄴ, ㄷ"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-055' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '작물의 생장에 영향을 주는 광질에 관한 내용이다. ( )에 들어갈 내용을 순서대로 옳게 나열한 것은? 가시광선 중에서 ( )은 광합성․광주기성․광발아성 종자의 발아를 주도하는 중요한 광선이다. 근적외선은 식물의 신장을 촉진하여 적색광과 근적외선의 비가 ( ) 절간신장이 촉진되어 초장이 커진다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["청색광, 작으면","적색광, 크면","적색광, 작으면","청색광, 크면"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-056' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '생육적온이 달라 동일 재배사에서 함께 재배할 경우 재배효율이 떨어지는 조합은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["상추, 고추","당근, 시금치","가지, 호박","오이, 토마토"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-057' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '소비자의 기호 변화로 씨가 없는 샤인머스캣 포도가 인기를 모으고 있다. 샤인 머스캣을 무핵화하고 과립 비대를 위해 처리하는 생장조절물질은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["아브시스산","지베렐린","옥신","에틸렌"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-058' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '저온자극을 통해 화아분화가 촉진되는 작물이 아닌 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["양파","상추","배추","무"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-059' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '식물의 생육과정에서 강풍의 외부환경에 따른 영향으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["화분매개곤충의 활동을 억제한다.","상처를 유발하여 호흡량을 증가시킨다.","증산작용은 억제되나 광합성은 촉진된다.","상처를 통한 병해충의 발생을 촉진한다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-060' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '식물의 종자 또는 눈이 휴면에 들어가면서 증가하는 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["호흡량","옥신","지베렐린","아브시스산"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-061' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '시설재배 농가를 찾은 A손해평가사의 육묘에 관한 조언으로 옳지 않은 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["출하기 조절이 가능하다.","유기질 육묘상토로 피트모스를 추천하였다.","단위면적당 생산량을 증가시킬 수 있다.","공간활용도를 높이기 위해 이동식 벤치보다 고정식 벤치를 추천하였다."]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-062' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '수박재배 농가에서 대목을 사용하는 접목재배로 방제할 수 있는 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["덩굴쪼김병","애꽃노린재","진딧물","잎오갈병"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-063' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '최종 적과 후 우박피해를 입은 사과농가의 대처로 옳은 것을 모두 고른 것은? A농가 - 피해 정도가 심한 가지에는 도포제를 발라준다. B농가 - 수세가 강한 피해 나무에 질소 엽면시비를 한다. C농가 - 90 % 이상의 과실이 피해를 입은 나무의 과실은 모두 제거한다. D농가 - 병해충 방제를 위해 살균제를 살포한다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["A, C","A, D","B, C","B, D"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-064' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '다음은 벼의 수발아에 관한 내용이다. ( )에 들어갈 내용을 순서대로 옳게 나열 한 것은? 수발아는 ( )에 종실이 이삭에 달린 채로 싹이 트는 것을 말하며, 벼가 우기에 도복이 되었을 때 자주 발생한다. 또한 ( )이 ( )보다 수발아가 잘 발생한다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["수잉기, 조생종, 만생종","결실기, 조생종, 만생종","수잉기, 만생종, 조생종","결실기, 만생종, 조생종"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-065' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '전염성 병해가 아닌 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["토마토 배꼽썩음병","벼 깨씨무늬병","배추 무름병","사과나무 화상병"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-066' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '0℃에서 저장할 경우 저온장해가 발생하는 채소만을 나열한 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["배추, 무","마늘, 양파","당근, 시금치","가지, 토마토"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-067' AND exam_type = '1st' AND status = 'active' AND answer = '4';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '다음 ( )에 들어갈 필수원소에 관한 내용을 순서대로 옳게 나열한 것은? ( )원소인 ( )은 엽록소의 구성성분으로 부족 시 잎이 황화된다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["다량, 마그네슘","다량, 몰리브덴","미량, 마그네슘","미량, 몰리브덴"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-068' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '자가수분으로 수분수가 필요 없는 과수는?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["신고 배","후지 사과","캠벨얼리 포도","미백도 복숭아"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-069' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '다음 설명에 해당하는 해충은? ○ 흡즙성 해충이다. ○ 포도나무 가지와 잎을 주로 가해한다. ○ 약충이 하얀 솜과 같은 왁스 물질로 덮여 있다.', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["꽃매미","미국선녀벌레","포도유리나방","포도호랑하늘소"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-070' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '장미의 블라인드 현상의 직접적인 원인은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["수분 부족","칼슘 부족","일조량 부족","근권부 산소 부족"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-071' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '근경으로 영양번식을 하는 화훼작물은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["칸나, 독일붓꽃","시클라멘, 다알리아","튤립, 글라디올러스","백합, 라넌큘러스"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-072' AND exam_type = '1st' AND status = 'active' AND answer = '1';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '유리온실 내 지면으로부터 용마루까지의 길이를 나타내는 용어는?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["간고","동고","측고","헌고"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-073' AND exam_type = '1st' AND status = 'active' AND answer = '2';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '베드의 바닥에 일정한 크기의 기울기로 얇은 막상의 양액이 흘러 순환하도록 하고 그 위에 작물의 뿌리 일부가 닿게 하여 재배하는 방식은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["매트재배","심지재배","NFT재배","담액재배"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-074' AND exam_type = '1st' AND status = 'active' AND answer = '3';

INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '시설재배에서 필름의 가시광선 투과율이 큰 것부터 작은 것 순으로 옳게 나타낸 것은?', answer, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '["PE > EVA > PVC","EVA > PE > PVC","PE > PVC > EVA","PVC > PE > EVA"]', calc_variables
FROM exam_questions
WHERE id = 'Q-2023-09-075' AND exam_type = '1st' AND status = 'active' AND answer = '1,2,3,4';
