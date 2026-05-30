<!-- docs/feasibility/thepick.feasibility.md -->

# ThePick (쪽집게) 실현가능성 판정서 (G-1 Reality Gate)

> **헌법:** VOID DEV UNIFIED CONSTITUTION v3.6 — G-1 Reality Gate
> **적용 유형:** 프롬프트 C (검증 통과/방향 확정 → **형식화**). 상태 판정 = **C** (8개 프로젝트 중 가장 성숙: 45 ADR / 61 plan / production 배포).
> **작성:** 2026-05-30 (G-1 소급, 코드 무변경) / **DEFCON:** L2
> **정직성 선언:** 본 문서는 *기 확보된 측정·검증*의 역(逆)형식화다. **측정되지 않은 조각(graph-walk 정답률)은 🟢로 위장하지 않고 🟡/BLOCKED로 못박는다** (헌법 R3·ASDP: AI 자체점수 금지, fabricate 금지). 이 split-verdict가 형식화의 핵심이다.

---

## R1. SOTA Ceiling (업계 천장 — 약식, 상세 `ceiling.md`)

| 능력                                                    | 천장 성격                             |   목표 위치   |
| :------------------------------------------------------ | :------------------------------------ | :-----------: |
| 도메인 RAG QA / 산식(AST 결정론) / FSRS / 콘텐츠 구조화 | 검증됨·해결됨 (산식은 천장 개념 부재) | 천장 아래 🟢  |
| **graph-walk multi-hop 정답률 기여**                    | **혼재 — 비보장**                     | **불확실 🟡** |

**목표 vs 천장:** 아키텍처 전체는 천장 **아래(🟢)**. 🔴(천장 위) 조각 **0개**. 단 graph-walk 1개만 🟡(실측 필요). ★ ScoreForge와의 결정적 차이 = 천장 위 목표 부재 + 🟢 바닥("사실상 Vector RAG")으로도 성립.

## R2. Goal Decomposition (목표 분해 매트릭스)

**축:** 처리계층(정밀 constants × 구조 graph × 맥락 vector) × 능력(생성/검색/연산/스케줄링)

| 조각                                 | 입력                 | 산출물 실제 수준 (정직 서술)                         |  판정  |
| :----------------------------------- | :------------------- | :--------------------------------------------------- | :----: |
| 콘텐츠 구조화·적재                   | 교재 835p + 기출 7회 | 794 노드 / 488 approved, production (live D1 확인)   |   🟢   |
| Formula Engine (산식)                | 교재 산식            | AST 파서, 교재 예시값 골든 테스트, LLM 계산 0        |   🟢   |
| Vector RAG 검색 (단일 hop)           | 학습자 질의          | 운영 중 = **현 실 검색경로**                         |   🟢   |
| FSRS 간격반복                        | 학습 이력            | 검증된 공개 알고리즘                                 |   🟢   |
| **graph-walk multi-hop 정답률 기여** | Q↔node 다중홉        | **측정 0% / 차단 — 학습자 경로 미노출(옵션 C 격리)** | **🟡** |
| 근거 보기(보기별/물음별 출처 라벨)   | 4지선다·2차 실기     | Phase B/C carry-over, 미구축                         |   🟡   |
| 60% 합격률 (최종 사업 목표)          | 실 수험생            | 런칭 후에만 실측 가능 (현 유저 0)                    |   🟡   |

- **가장 쉬운 조각(🟢 씨앗):** 콘텐츠 적재 + 산식 + Vector RAG = _이미 작동하는 viable 도구_.
- **가장 어려운 조각:** graph-walk 정답률 기여 — 하지만 🔴 아님(천장 아래), 🟡(미측정). ★ ScoreForge 교훈("가장 어려운 🔴에 매달림")과 달리 ThePick은 🟢 바닥 위에서 🟡 1개만 게이트하고 있다.

## R3. Feasibility Spike (실측 결과)

| 조각                          | GT/측정          | 예측(R2) | 실측                           |  일치   |     AI 자체점수     |
| :---------------------------- | :--------------- | :------- | :----------------------------- | :-----: | :-----------------: |
| Formula Engine                | 교재 예시값 골든 | 🟢       | **100% (골든 PASS)**           |   예    |      ❌ 미사용      |
| 콘텐츠 적재 무결성            | live D1 count    | 🟢       | **794/1274/157/193/545 일치**  |   예    |      ❌ 미사용      |
| api 회귀                      | vitest           | 🟢       | **671 PASS / 회귀 0**          |   예    |      ❌ 미사용      |
| approved 검수                 | 인간(진산) 검수  | 🟢       | **488 approved (인간 게이트)** |   예    |    ❌ 인간 직접     |
| **multi-hop 정답률 (북극성)** | **G-S5 golden**  | 🟡       | **⛔ BLOCKED = 미측정(0%)**    | **N/A** | ❌ (fabricate 금지) |

- **인간 직접 소비:** 콘텐츠/검수는 진산 직접 게이트(488 approved). **학습자 경험 dogfooding은 미완**(런칭 전, 유저 0) = 정직한 공백.
- **R3 BLOCKER 원인:** production 545 기출 `related_nodes` 전부 NULL(golden 부재) + TR-0 트리거가 백필 ABORT. harness는 READY. → 헌법 R3 BLOCKER의 _organic_ 발현. ThePick은 측정 전 "graph-walk가 효과있다"를 주장하지 **않았다**(TYPE-11 미발생).

## R4. 3-Tier Verdict

- **🟢 가능 (viable 도구로 성립, 측정됨):** 콘텐츠 구조화·적재 / Formula Engine / Vector RAG(단일 hop) / FSRS. → **"Vector RAG 기반 손해평가사 exam-prep"은 이미 성립하는 제품 바닥이다.**
- **🟡 부분 (낮춘 기대치로 성립, 정리비용 명시):**
  - graph-walk 정답률 기여 — _측정 전엔 가치 미상_. 정리비용: 미미할 경우 "Vector RAG로 출시"(코드 격리되어 매몰비용 최소, 옵션 C 독립 엔드포인트).
  - 근거 보기 라벨 깊이 — Phase B/C BATCH 필요(DB 스키마 + 공식 해설집 조사).
  - 60% 합격률 — 런칭 후 실측 영역(통제 불가 변수 多).
- **🔴 불가 (죽었다·묻어라):** **없음.** 천장 위 조각 0개. ★ 이것이 ScoreForge 부검과의 핵심 차이.

## R5. GO / STOP Decision (인간 단독 — `v3_6:131,154`)

> ⚠️ 본 R5는 **AI 판정이 아니라 *기 발생한 진산 결정의 기록* + *미결 결정의 표면화***다.

- [x] 축소 GO (🟢만) — 기록: 🟢 아키텍처(콘텐츠+산식+Vector RAG+FSRS)는 **이미 GO·production 배포 완료**(Phase 3 launch chain, CLAUDE.md 현재상태). 결정 증거 = 라이브 배포·488 approved. ※ 본 [x]는 AI 판정이 아니라 _기 발생한 진산 배포 결정의 기록_ — 동의하지 않으시면 해제 요청.
- [ ] GO (전체, graph-walk 통합 포함) — **미결.** S5-7 A 통합 = §7 GO 조건부(G-S5 실측 의존). 진산 결재 대기. _AI가 결정하지 않음._
- [ ] STOP — 해당 없음 (🔴 조각 0).

- **가치 판단 근거 (진산 기록란):** **\_\_\_** (graph-walk 통합 GO는 G-S5 정답률 실측 후 진산이 채움)
- **결정자:** 진산 / **축소 GO 기록일:** ~Phase 3 launch / **전체 GO 결정일:** TBD (G-S5 후)

---

## 형식화 후 잔존 게이트 (G-1 → 기존 트랙 정합)

1. **R3 실측(graph-walk 정답률)** = 기존 **G-S5 측정 게이트**와 동일물. 이중 게이트(TR-0 트리거 결재 + golden 확보) 해소 후 측정 → 본 문서 R3/R5 갱신.
2. **CLAUDE.md G-1 블록** 삽입 완료(본 형식화). **hook(블록 C/D)은 R5 전체 GO 후 + 기존 61 plan 금지어 오탐 점검 후** 별도 설치(현 husky/lint-staged 통합).
3. **신규 Epic/Feature**는 본 약식이 아닌 **R1~R5 전수** 적용 (CLAUDE.md 명시).

**근거 포인터:** `ceiling.md` · `docs/plans/roadmap-milestone-progress-20260529.md` · `docs/plans/graph-walk-s5-7-a-integration.plan.md` · `docs/plans/tr-0-backend-c7-trigger-redesign.plan.md` · memory `project_g_s5_golden_data_gap` / `project_vision_mvp_generalization`.
