<!-- docs/feasibility/ceiling.md -->

# ThePick — R1 SOTA Ceiling (업계 천장 조사)

> **G-1 Reality Gate R1 산출물.** 헌법 VOID DEV v3.6 / G-1 소급 **형식화**(프롬프트 C, 2026-05-30).
> ThePick은 검증된 기술 조합이 대부분이라 **R1 약식**(천장 자명, `v3_6:167`) — 단 **1개 능력만 천장 불확실**.
> 본 파일은 추정이 아닌 *기 확보된 근거*의 형식화다. 신규 Epic은 본 약식을 전수 R1로 승격해야 한다.

## 능력별 천장 매트릭스

| 능력                                 | 업계 SOTA / 천장 성격                      |            목표 위치            | 근거                                                                                                                                                       |
| :----------------------------------- | :----------------------------------------- | :-----------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 도메인 RAG QA (단일 hop)             | 프로덕션 다수 = **해결됨**                 |          천장 아래 🟢           | Vectorize 검색 운영 중("사실상 Vector RAG")                                                                                                                |
| 산식 연산 (AST 결정론)               | **천장 개념 없음** (결정론)                |               🟢                | Hard Limit: _LLM 계산 금지_ → 환각 천장 자체가 부재. math.js AST + 교재 예시값 골든                                                                        |
| FSRS 간격반복                        | 오픈 알고리즘 = **해결됨**                 |               🟢                | 검증된 공개 SRS                                                                                                                                            |
| 콘텐츠 구조화 (Graph 적재)           | 인간검수 파이프라인 = **해결됨**           |               🟢                | 794 노드 / 488 approved (live D1, Session 086)                                                                                                             |
| 표 이해·재현 (Table-as-μKG)          | 부분 해결 (LLM 표 파싱)                    |              🟡→🟢              | ADR-032, 인간검수 게이트로 보강                                                                                                                            |
| **Graph-walk multi-hop 정답률 기여** | **혼재 — 도메인·데이터 의존, 이득 비보장** | **🟡→🔻 (실측: baseline 미달)** | multi-hop graph RAG 이득 SOTA상 비보장. **✅ R3 실측 완료(2026-06-01): 순기여 0/regression 1/Δ−25~33% = 현 설정 순손실.** SOTA "비보장"이 본 도메인서 실현 |

## 핵심 판정 (ScoreForge 대조)

1. **ThePick 아키텍처 전체는 천장 *아래*에 있다.** ScoreForge(임의 음악→출판급 자동 악보 = 전업계 천장 _위_)와 달리, RAG·결정론적 산식·FSRS·인간검수 적재는 전부 검증된 기술이다. → 🔴 조각 **0개**.
2. **유일한 불확실성 = graph-walk의 한계 정확도 기여.** "graph walk가 vector RAG 대비 multi-hop 정답률을 _유의미하게_ 올리는가"는 SOTA상 도메인/데이터 의존이며 보장되지 않는다. → **✅ R3 실측(2026-06-01)으로 해소: 현 설정에서 baseline 미달(순기여 0/regression 1).** SOTA의 "비보장"이 본 도메인·파라미터에서 음(陰)으로 실현됨. graph 재시도(F-노드 억제+표본 확대) = 별도 결재.
3. **최악 시나리오 ≠ 프로젝트 사망 — 측정으로 입증.** graph-walk NO-GO 방향이나 baseline(vector) hit-rate **100%** = "Vector RAG 기반 손해평가사 exam-prep"이 🟢 바닥으로 *실측 확인*됐다. 이것이 ScoreForge(천장 위 → 전부 폐기)와의 결정적 차이다.

## R1 → R2/R3 연결

- 🟢 5개 능력 = 천장 자명 → R2에서 _측정된_ 근거로 확정.
- 🟡 graph-walk 1개 = **✅ R3 측정 완료(2026-06-01)**. `docs/plans/s5-6-measurements/` 하네스 READY → production Worker `07b5f47d` 배포 + golden 파일 직접 채점(measurable 4, query>500 3건 제외)으로 측정. 결과 = 순기여 0/regression 1/Δ −25~33% (NO-GO 방향). 분석 `s5-6-g-s5-analysis.md`. fabricate 0(Ground Truth + raw 적대검증).

근거 포인터: `docs/plans/s5-6-measurements/s5-6-g-s5-analysis.md`(1차 측정 분석) · `docs/plans/graph-walk-s5-7-a-integration.plan.md`(§7.1~7.3 NO-GO 방향+진산 결재 대기) · memory `project_s5_6_eval_measurement_gate`.
