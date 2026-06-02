# G-S5 측정 결과 — 다각 페르소나 적대 감사 (5 독립 관점)

> **트리거**: 진산 통찰(2026-06-02) — "정확성 검증 ③층(판단·방법론)은 사람이
> 어렵다. AI 다각 페르소나가 객관적으로 살피는 게 낫다." → 코드용 4-Pass/5-페르소나
> 패턴을 **콘텐츠·측정 정확성 층**에 첫 적용.
>
> **불변 헌장**: AI 정답 확정 금지(헌법 ASDP). 페르소나 = 의심·반증·플래그만.
> 모든 발견에 판정주체 분류(VERIFY_AI / VERIFY_JINSAN_TEXTBOOK / VERIFY_JINSAN_JUDGMENT).
> 출력 = **진산 결재 입력**, 결재 대체 아님. 각 페르소나 production raw 직접 재호출.

## 0. 메타 판정 — NO-GO 는 **시기상조(PREMATURE)**

|               |                                                                                                                                                                                                          |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 페르소나 분포 | **4 PREMATURE** (실무/측정과학/순환편향/통계) + **1 SOUND** (RAG) — 단 SOUND 도 "측정값은 타당하나 graph 일반 NO-GO 확대는 시기상조" 명시 → **5/5 사실상 "측정 방향은 재현되나 일반화 시기상조"로 수렴** |
| 측정값 자체   | **재현·결정적·fabricate 0** (production raw + harness 산술 + 3분할 집계 전부 정합 — confirmedOk 4건)                                                                                                     |
| 결론 의미     | "graph-walk NO-GO" ≠ "측정이 graph 를 제대로 테스트함". **유효 graph 표본 = N=1(Q-012)**                                                                                                                 |

★ **나(메인)의 1차 NO-GO 보고 = 과도 일반화였다.** 단독 패스가 "현 설정 1회차 순손실"(사실)을
"graph-walk NO-GO 방향"(과잉)으로 확대. 다각 감사가 이를 교정 — 진산 통찰의 직접 입증.

## 1. ★ 결정적 발견 — regression 은 단일 파라미터로 가역 (메인 직접 재현)

−33% 헤드라인을 만든 유일한 regression(Q-012)을 production raw 로 직접 재현:

| maxDepth          | baseline                                    | graph final                              | INV-035        | regression |
| :---------------- | :------------------------------------------ | :--------------------------------------- | :------------- | :--------- |
| **2** (측정 설정) | INV-037,**INV-035**,INV-016,INV-053,INV-002 | F-08,F-01,F-02,F-06,F-07 (전부 FORMULA)  | **축출**       | **있음**   |
| **1**             | 동일                                        | F-08,INV-037,**INV-035**,INV-016,INV-053 | **rank3 유지** | **없음**   |

→ −33% 를 좌우한 유일 regression 이 **알고리즘 한계가 아니라 `maxDepth2 × truthWeight 1차정렬 × score=0 병합` 튜닝 아티팩트**. (메인 재현 2026-06-02, Version 07b5f47d.)

## 2. 합의 발견 (2+ 페르소나 독립 수렴 — 신뢰도 최상)

1. **[CRIT, 5/5 전원]** regression 진짜 원인 = **병합 정렬 설계 결함**, graph 회수 실패 아님.
   `compareByTruthWeightThenScore`(user-search.ts:331)가 truthWeight 1순위 + graph 확장노드
   `buildHit(src,0)` score=0(graph-search-route.ts:264) → FORMULA(tw8) 확장노드가 baseline
   이 vector score 0.69 로 회수한 INV-035(tw7)를 **관련성 무관하게 결정론적 축출**.
2. **[CRIT, 4/5]** **표적-표본 불일치**: measurable 4 중 graph 영향 multi-hop = Q-012 1건(그게
   regression). 나머지 3건 단일-hop LAW(vector top1 자명) → graph 동률 구조. "graphOnlyRecovery
   0"은 graph 실패가 아니라 **유효 표본 N=1** 증거. graph 가 빛날 multi-hop 3건(Q-004/014/015)은
   query>500 으로 제외 → **graph 표적 모집단 75% 가 측정에서 빠짐**.
3. **[MAJOR, 3/5]** **baseline 100% 도 부분 아티팩트**: (a) 생존편향(잔존 3/4 가 vector 자명
   single-hop) (b) golden expected 가 AI "노드명 명칭대조"(=벡터가 가장 잘하는 작업)로 선정 →
   vector-친화 표본. 그 100% 가 분모라 graph −25~33% 가 "graph 나쁨"인지 "golden 이 vector 유리"
   인지 **현 데이터로 분리 불가**.
4. **[MAJOR, 2/5]** 순환편향 = 채점 단계는 코드로 차단(검색호출 0, circularBiasGuard) 확인.
   잔여 = **표적 정의 층**(expected 가 코퍼스 488 내부 명칭대조로 선정, 검색가능집합=표적집합).
   진산 인간검수가 유일 차단막.
5. **[MAJOR, 3/5]** −25% vs −33% **절대값은 의사결정 임계 사용 불가**(measured 3 vs 4 의 1건
   차이가 8%p, regression 1건이 33%). 분석 문서 §3 자기제한(N=12 워터마크)은 무결성 강점.

## 3. 순환편향 최종 판정

순환편향이 NO-GO 를 **오염(무효화)하지는 않았으나, 의미를 좁히고 일반화를 막는 방향으로 실재**.
채점 순환 = 코드 차단 확인. 잔여 = 표적 정의 층(golden 명칭대조 = vector 친화 → baseline 과대평가).
단 regression 의 결정적 원인이 truthWeight×score=0 (maxDepth1 로 가역)임을 raw 재현으로 확인했으므로
**NO-GO 방향은 순환편향과 독립 성립**. N 확대 시 expected 를 "명칭대조"가 아닌 **"정답 도달 추론경로"**
로 재정의해야 순환이 닫힘.

## 4. 진산 결재 큐 (VERIFY_JINSAN — 사람이 직접 봐야 할 것, 최소부담순)

> ⚠️ 본 큐가 진산 통찰의 핵심 산출 — ③층 부담을 "다 보기"에서 "이것만"으로 압축.

| #     | 항목                                                                                                          | 진산 액션                                                                                     | 유형     |
| :---- | :------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------- | :------- |
| **1** | −25/−33% 절대값을 GO/STOP 임계로 쓸지 vs "방향 사실"만 채택할지                                               | 절대값은 N=1 아티팩트 → 임계 사용 금지·방향만 채택 여부 1줄                                   | JUDGMENT |
| **2** | **golden content 의 "답안키/채워진 표/해설"을 출제 본문과 분리하는 정책**                                     | 본문만 query 화 → Q-014(본문 279자) 등 측정 가능, measurable 4→6~7 회복. 정책 1줄 결재        | JUDGMENT |
| **3** | graph 재시도 설계: (a) score=0 대신 hop-distance 감쇠점수 / (b) graph노드 categorical truthWeight 우선권 제거 | 두 설계 중 택1(코드는 그 후 별도 plan)                                                        | JUDGMENT |
| **4** | S5-7 §7 NO-GO 임계규칙(regression≥graphOnlyRecovery OR Δ≤0)이 소표본서 NO-GO 구조적 강제(1≥0 항상참)          | "N≥30 + multi-hop 가중 표본에서만 GO/NO-GO" 로 명시 or 현 pilot 은 "메커니즘 발견"으로만 기록 | JUDGMENT |
| **5** | unmeasurable 5건 분모제외 + Q-004/014 query>500 제외 정당성 재확인                                            | 봉인 재확인(수초)                                                                             | JUDGMENT |
| **6** | N 확대 시 expected 를 "명칭대조" 아닌 "정답 도달 추론경로"로 재정의                                           | 재정의 방향 + FORMULA 정답 문항 "진짜 회수 vs F-노드 우연적중" raw 분리검수 지시              | JUDGMENT |
| **7** | Q-012 라벨(INS-08+INV-035+CROP-018/019/020) 실무 타당성                                                       | 페르소나 판정 "라벨 실무 정확, 교재 대조 불필요 수준" — 동의 여부만                           | TEXTBOOK |

## 5. AI 후속 (VERIFY_AI — 메인이 코드·데이터로 처리, 진산 부담 0)

1. **maxDepth=1 전수 재측정** — measurable 4(또는 답안키 제거 후 6~7)로 graph route maxDepth=1 측정 → Δ 0/양수 전환 확인 (Q-012 depth1 HIT 이미 메인 재현 §1).
2. golden content 답안키/표/해설 제거 스크립트 → query≤500 회복 분모 정량화.
3. graphExpansion expandedNodes **전체집합 surface**(현재 count만) → expected 가 "확장됐으나 정렬에서 밀림" vs "확장 자체 실패" 구분(처방 = 정렬튜닝 vs 알고리즘).
4. graph route **timeout reliability 정량화**(감사 중 4회 중 1회 timeout 재현) — 분석 문서 §reliability 신규.
5. 분석 문서 §2 표 node-ID 드리프트 정정(문서 F-08,F-01,F-02,F-06,F-07 ↔ 현 raw 일부 상이 — regression 결론 불변, per-node 증거만 stale). ★ 단 본 §1 재현은 2026-06-02 라이브.
6. **mean-recall@5 를 헤드라인 동급 surface**(현 hit-rate@5 는 Q-012 expected 5중 1회수도 hit=1 → baseline 과대). multihop-accuracy.ts:150.
7. golden 임베딩 오염 정량화(본문 vs 본문+해설 2버전 baseline 측정).

## 6. 메타 교훈 (영속)

- **진산 통찰 입증**: 메인 단독 NO-GO 보고를 5-페르소나가 "시기상조"로 교정. 코드용 다각 리뷰
  패턴이 측정·콘텐츠 정확성 층에도 유효 → 재사용 프로토콜 `content-accuracy-audit` 신설.
- **realcode 게이트 재확인**([[feedback_cycle_closure_realcode_gate]]): 페르소나 주장(maxDepth1 가역)을
  메인이 production raw 로 직접 재현 후에만 사실 확정 — 페르소나도 자기채점 아닌 게이트 통과 대상.
