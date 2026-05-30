<!-- docs/feasibility/ceiling.md -->

# ThePick — R1 SOTA Ceiling (업계 천장 조사)

> **G-1 Reality Gate R1 산출물.** 헌법 VOID DEV v3.6 / G-1 소급 **형식화**(프롬프트 C, 2026-05-30).
> ThePick은 검증된 기술 조합이 대부분이라 **R1 약식**(천장 자명, `v3_6:167`) — 단 **1개 능력만 천장 불확실**.
> 본 파일은 추정이 아닌 *기 확보된 근거*의 형식화다. 신규 Epic은 본 약식을 전수 R1로 승격해야 한다.

## 능력별 천장 매트릭스

| 능력                                 | 업계 SOTA / 천장 성격                      |   목표 위치   | 근거                                                                                |
| :----------------------------------- | :----------------------------------------- | :-----------: | :---------------------------------------------------------------------------------- |
| 도메인 RAG QA (단일 hop)             | 프로덕션 다수 = **해결됨**                 | 천장 아래 🟢  | Vectorize 검색 운영 중("사실상 Vector RAG")                                         |
| 산식 연산 (AST 결정론)               | **천장 개념 없음** (결정론)                |      🟢       | Hard Limit: _LLM 계산 금지_ → 환각 천장 자체가 부재. math.js AST + 교재 예시값 골든 |
| FSRS 간격반복                        | 오픈 알고리즘 = **해결됨**                 |      🟢       | 검증된 공개 SRS                                                                     |
| 콘텐츠 구조화 (Graph 적재)           | 인간검수 파이프라인 = **해결됨**           |      🟢       | 794 노드 / 488 approved (live D1, Session 086)                                      |
| 표 이해·재현 (Table-as-μKG)          | 부분 해결 (LLM 표 파싱)                    |     🟡→🟢     | ADR-032, 인간검수 게이트로 보강                                                     |
| **Graph-walk multi-hop 정답률 기여** | **혼재 — 도메인·데이터 의존, 이득 비보장** | **불확실 🟡** | multi-hop graph RAG 이득은 SOTA상 비보장. **R3 실측 필수, 현재 BLOCKED**            |

## 핵심 판정 (ScoreForge 대조)

1. **ThePick 아키텍처 전체는 천장 *아래*에 있다.** ScoreForge(임의 음악→출판급 자동 악보 = 전업계 천장 _위_)와 달리, RAG·결정론적 산식·FSRS·인간검수 적재는 전부 검증된 기술이다. → 🔴 조각 **0개**.
2. **유일한 불확실성 = graph-walk의 한계 정확도 기여.** "graph walk가 vector RAG 대비 multi-hop 정답률을 _유의미하게_ 올리는가"는 SOTA상 도메인/데이터 의존이며 보장되지 않는다. 이 1개 능력만 R3 실측이 필요하다.
3. **최악 시나리오 ≠ 프로젝트 사망.** graph-walk 기여가 미미해도 "Vector RAG 기반 손해평가사 exam-prep"으로 성립한다(🟢 바닥 존재). 이것이 ScoreForge(천장 위 → 전부 폐기)와의 결정적 차이다.

## R1 → R2/R3 연결

- 🟢 5개 능력 = 천장 자명 → R2에서 _측정된_ 근거로 확정.
- 🟡 graph-walk 1개 = R3 BLOCKER → `docs/plans/s5-6-measurements/` 하네스가 READY이나 golden 부재 + TR-0 트리거 차단으로 **미측정(0%)**. fabricate 금지(헌법 R3 / RULE #5).

근거 포인터: `docs/plans/roadmap-milestone-progress-20260529.md`(북극성 0% 측정=병목) · `docs/plans/graph-walk-s5-7-a-integration.plan.md`(§7 GO 조건부) · memory `project_g_s5_golden_data_gap`.
