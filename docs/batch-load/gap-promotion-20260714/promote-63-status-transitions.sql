-- E0-8 갭 보강 P1~P3 63노드 draft→approved 위임 일괄 승격
-- 결재: 진산 2026-07-14 "전부 권고대로 진행" (docs/plans/approval-bottleneck-analysis-20260714.md §6 Q1)
-- 게이트: ①독립 적대검증 2회 이력(P1/P2/P3 각 CRITICAL 0) ②본 세션 AI 재검증 라운드 wf_66b57d39
--   (9 에이전트 원문 PDF 재추출 대조 — 63/63 PASS, HardStop[수치변조·오귀속·환각·의미반전] 0)
--   ③결정론 게이트: 엣지 73 끊김/비활성 0 ④SUPERSEDES 0 = 0042 승격 flip 트리거 무발화 확인
-- 메커니즘: status_transitions INSERT (0010 append-only — knowledge_nodes UPDATE 0, Hard Limit 준수)
-- 멱등: INSERT OR IGNORE (PK 고정) — 재실행 시 0행

INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-CONCEPT-219', 'node', 'CONCEPT-219', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P3 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P3 콘텐츠 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-CONCEPT-220', 'node', 'CONCEPT-220', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P3 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P3 콘텐츠 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-CONCEPT-221', 'node', 'CONCEPT-221', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P3 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P3 콘텐츠 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-CONCEPT-222', 'node', 'CONCEPT-222', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P3 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P3 콘텐츠 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-144', 'node', 'LAW-144', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-145', 'node', 'LAW-145', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-146', 'node', 'LAW-146', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-147', 'node', 'LAW-147', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-148', 'node', 'LAW-148', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-149', 'node', 'LAW-149', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-150', 'node', 'LAW-150', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-151', 'node', 'LAW-151', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-152', 'node', 'LAW-152', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-153', 'node', 'LAW-153', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-154', 'node', 'LAW-154', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-155', 'node', 'LAW-155', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-156', 'node', 'LAW-156', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-157', 'node', 'LAW-157', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-158', 'node', 'LAW-158', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-159', 'node', 'LAW-159', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-160', 'node', 'LAW-160', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-161', 'node', 'LAW-161', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-162', 'node', 'LAW-162', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-163', 'node', 'LAW-163', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-164', 'node', 'LAW-164', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-165', 'node', 'LAW-165', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P1 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260702-165005 CRITICAL 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-166', 'node', 'LAW-166', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-167', 'node', 'LAW-167', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-168', 'node', 'LAW-168', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-169', 'node', 'LAW-169', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-170', 'node', 'LAW-170', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-171', 'node', 'LAW-171', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-172', 'node', 'LAW-172', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-173', 'node', 'LAW-173', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-174', 'node', 'LAW-174', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-175', 'node', 'LAW-175', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-176', 'node', 'LAW-176', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-177', 'node', 'LAW-177', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-178', 'node', 'LAW-178', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-179', 'node', 'LAW-179', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-180', 'node', 'LAW-180', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-181', 'node', 'LAW-181', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-182', 'node', 'LAW-182', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-183', 'node', 'LAW-183', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-184', 'node', 'LAW-184', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-185', 'node', 'LAW-185', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-186', 'node', 'LAW-186', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-187', 'node', 'LAW-187', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-188', 'node', 'LAW-188', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-189', 'node', 'LAW-189', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-190', 'node', 'LAW-190', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-191', 'node', 'LAW-191', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-192', 'node', 'LAW-192', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-193', 'node', 'LAW-193', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-194', 'node', 'LAW-194', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-195', 'node', 'LAW-195', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-196', 'node', 'LAW-196', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-197', 'node', 'LAW-197', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-198', 'node', 'LAW-198', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-199', 'node', 'LAW-199', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-200', 'node', 'LAW-200', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-201', 'node', 'LAW-201', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');
INSERT OR IGNORE INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason)
VALUES ('st-q1del-20260714-LAW-202', 'node', 'LAW-202', 'draft', 'approved', 'jinsan-delegated-ai-reverify-20260714', 'E0-8 gap-P2 위임 승격 (진산 2026-07-14 «전부 권고대로 진행», approval-bottleneck-analysis-20260714 §6 Q1) — AI 재검증 wf_66b57d39 PASS(HardStop 0) + 독립리뷰 review-20260703-gap-P2 CRITICAL 0/MAJOR 0');

-- 감사 집계 (review_decisions — G-RP-5 관례)
INSERT OR IGNORE INTO review_decisions (id, decision_type, target_type, target_id, reviewer_id, decision_rationale, rollback_deadline, queue_id, batch_id)
VALUES ('RD-Q1-PROMO-20260714', 'approve', 'node', 'LAW-144~202 + CONCEPT-219~222 (63)', 'jinsan',
 '위임 일괄 승격 — 진산 2026-07-14 «전부 권고대로 진행». 근거: AI 재검증 wf_66b57d39 63/63 PASS + 기존 독립리뷰 3건 CRITICAL 0. 표본 감사 8행 별도 보고 (사후 거부권 유효)', strftime('%Y-%m-%dT%H:%M:%fZ','now','+24 hours'), 2, 'GAP-P1P2P3-PROMO');