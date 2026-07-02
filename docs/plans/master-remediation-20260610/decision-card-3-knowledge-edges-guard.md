# 결정 카드 #3 — knowledge_edges UPDATE/DELETE 가드 마이그 plan 착수 (WS-2b)

> 작성: 2026-06-12 / 상태: **결재 대기**
> 배경: production 보호 트리거 체계에서 knowledge_edges 만 UPDATE/DELETE 가드 0 (RC-1, `MASTER_PLAN.md:54,68`).
> **본 결재 대상 = "L3 plan 작성 착수" 자체** (SQL 아님 — SQL 승인은 plan 완성 후 별도, `MASTER_PLAN.md:220,232`).
> 가드 설계 방향(0038식 컬럼 화이트리스트 vs 전면 차단+is_active 플립 예외)은 plan 내 PITR 로 비교 — 본 카드 범위 밖.

## 근거 (실코드·실문서 대조, 2026-06-12)

| 항목                    | 확인 내용                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 가드 공백 확정          | knowledge_edges 트리거 4개 전부 INSERT 계열 — created_at NOT NULL(`migrations/0003:67`)·SUPERSEDES 연동(`0013:101-102` AFTER INSERT)·역순환/자기참조(`0014:182,196` BEFORE INSERT). **BEFORE UPDATE / BEFORE DELETE = 0건** (`grep "ON knowledge_edges"` 재확인)                                                                                                                           |
| 타 테이블과 비대칭      | `prevent_*_update` 차단 체계는 knowledge_nodes/formulas/constants(`0013:64-86` is_current_active 플립 외 ABORT → 현행 최종형 = 컬럼별 IS NOT 화이트리스트 `0014:34-95`·nodes 는 `0016:67-89` backfill 예외 추가, DELETE 차단 `0014:105-121`) + constants/revision_changes/exam_questions(`0004:23-43`) 보유. knowledge_edges 는 처음부터 제외 (부록 ③-① `...analysis-appendix.md:143-157`) |
| 재설계 선례 (절차 체인) | 0038 = 컬럼 화이트리스트 default-deny 트리거 교체 선례(`0038:39-67` prevent_exam_questions_body_update, TR-0 plan→ADR-046→4-Pass→production 적용 #11 ☑ 2026-06-11 `MASTER_PLAN.md:247`). WS-2b 도 동일 절차 명문 (`MASTER_PLAN.md:132` "plan 별도 작성→진산 승인→SQL")                                                                                                                     |
| 공백의 실사용 이력      | E0-2 Track A-1 이 가드 부재 상태에서 수동 `UPDATE knowledge_edges SET is_active=0` 집행 완료(`e0-2-graph-repair.plan.md:115-117`, changes 26). R-4 = "가드 공백(WS-2b)이 메워지기 전 수동 UPDATE 는 본 plan 결재 범위로만" (`e0-2-graph-repair.plan.md:83`)                                                                                                                                |
| 묶음 처리 권고 실재     | plan §3 step4 = "WS-2b ... 별건 결재"(`e0-2-graph-repair.plan.md:78`) vs 부록 ③-⑤ 종합 = "WS-2b 엣지 가드 마이그를 수리 SQL 과 같은 결재 묶음으로 선행/동시 적용" 권고(`...analysis-appendix.md:205`). Track B(고아 24)는 **INSERT-only**(`e0-2-graph-repair.plan.md:52`) → UPDATE/DELETE 가드 선적용과 충돌 없음. Track B 검수 = 06-15 예정(`:117`)                                       |

## 선택지 비교

| 기준               | (a) 지금 plan 착수 + Track B 수리 SQL 결재와 묶음 집행                             | (b) plan 착수만 승인·집행은 Track B 후 별건                     | (c) 후순위 보류                                             |
| ------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| 가드 공백 닫힘     | Track B 집행과 동시/선행 — wrangler 인증 **1회**로 공백+고아 24 함께 처분          | Track B 후 별도 인증 세션 필요 — 닫힘 시점 [미정]               | 무기한 — 공백 인지 상태 지속                                |
| production 쓰기 창 | 다음 엣지 쓰기(Track B) 시점에 이미 가드 존재                                      | Track B 집행이 가드 없는 창에서 1회 더 발생 (R-4 절차로만 방어) | 이후 모든 엣지 작업이 무가드 창                             |
| 위험               | plan+4-Pass 가 06-15 검수 전 미완이면 묶음 못 탐 → (b)로 자연 강등 (불가역 손실 0) | 인증 세션 2회·공백 창 연장                                      | 동일 인증 세션 내 UPDATE/DELETE 오발 무방어 (부록 ③-⑤ 지적) |
| 문서 정합          | 부록 ③-⑤ "선행/동시 적용" 권고와 정합                                              | plan §3 step4 "별건 결재" 문언과 정합                           | RC-1 critical 잔존                                          |

## 권고: **(a) 지금 plan 착수 + Track B 묶음** (vs (b) 착수만)

plan 착수 자체는 문서 작업(코드·DB 무접촉·가역)이며, 집행을 Track B SQL 과 같은 인증 묶음으로
처리하면 인증 세션 1회로 가드 공백과 고아 24 를 함께 닫는 경로가 열린다 — 부록 ③-⑤ 권고와 정합.
Track B 는 INSERT-only(plan §2 명문 `:52` — Track B 수리 SQL 자체는 미작성) 라 가드 선적용과 충돌 없음. 06-15 까지 plan 결재·4-Pass 미완 시
(b)로 자연 분리(손실 없음). plan 작성 소요 [추정 — 미측정]. SQL 작성·집행 승인은 plan §결재란에서 별도.

> 진산 확인란: ☐ (a) plan 착수 승인 + Track B 결재 묶음 / ☐ (b) plan 착수만 승인·집행 별건 / ☐ 보류
