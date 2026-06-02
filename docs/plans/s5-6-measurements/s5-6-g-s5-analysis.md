# G-S5 측정 분석 — multi-hop 정답률 실측 (북극성, 1차)

> ⚠️ **2026-06-02 정정 (5-페르소나 적대 감사)**: 본 문서 §3 의 "§7 NO-GO 방향"
> 결론은 **과도 일반화로 판정되어 "NO-GO 시기상조(PREMATURE)"로 교정**됨. 핵심:
> (1) −33% 헤드라인을 만든 유일 regression(Q-012)이 **maxDepth=1 로 가역**(메인 raw
> 재현) = 알고리즘 한계 아닌 튜닝 아티팩트. (2) 측정 measurable 4 중 graph 유효 표본
> = Q-012 **1건뿐**(나머지 3 단일-hop LAW). graph 가 빛날 multi-hop 3건(Q-004/014/015)은
> query>500(답안키 패딩)으로 제외. ⇒ **측정값은 재현·결정적이나 "graph-walk NO-GO"
> 일반화 불가**. 상세 + 진산 결재 큐: `g-s5-multipersona-audit-20260602.md`. 아래 §1~2
> 측정 사실은 유효(재현됨), §3 결론 해석만 교정.

> **MODE=REMOTE_G_S5** — 실 production D1 + Vectorize (`thepick-api-production`,
> Version `07b5f47d`, 2026-06-01). 원본 리포트:
> `s5-6-remote-g-s5-2026-06-01-1242.{md,json}`.
>
> ⚠️ **본 측정은 방법론·신호 방향 검증용 pilot 이며 통계 일반화가 아니다** (N=12
> 워터마크, README §"N=12 통계 워터마크"). graphOnlyRecovery/regression/Δ 의
> **절대값 해석 금지** — 방향성만. 손해평가 실무 도메인 한정(상법/농학/재해법령
> 거버넌스 측정 0건).
>
> ★ RULE #5: GO/STOP 은 진산 결정. 본 문서는 🟢/🟡/🔴 **사실 + §7 분기 매핑**만 한다
> (AI 자기채점 0 — Ground Truth 대비 정량 비교 + raw 응답 적대 검증).

## 0. 측정 경로 (재현 가능)

| 단계         | 사실                                                                                                                                                                                                                                                                     |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 배포         | `wrangler deploy --env production` → `/api/search/graph`(S5-3) 404→200 (이전 production = 2026-05-10 빌드, graph 라우트 미포함). `/api/search` 불변(byte-identical, additive 검증). api 671 PASS 회귀 0.                                                                 |
| golden       | `golden-pilot-approved.json` (진산 검수 동결, APPROVE 7+FIX 5) → 측정 subset `golden-pilot-approved.query-le500.json`                                                                                                                                                    |
| ⚠️ 분모 축소 | graph-search-route `query` max 500자(graph-search-route.ts:79). golden measurable 7 중 **3건(Q-004/014/015, 2차 서술형) query>500 → 400 거부**. 진산 결재 2026-06-01 = "초과 3건 제외, measurable 4건만 측정". ⇒ **측정 분모 = measurable 4** (절단제외 3 / 절단포함 4). |
| 측정         | `THEPICK_API_BASE=<production> tsx scripts/measure-s5-6-multihop-accuracy.ts --golden <subset>`                                                                                                                                                                          |

## 1. 측정값 (사실)

### 절단표본 제외 (G-S5 권장 기준) — measured=3

| 지표        | baseline (vector) | graph-augmented |          Δ |
| :---------- | ----------------: | --------------: | ---------: |
| hit-rate    |            100.0% |           66.7% | **−33.3%** |
| mean recall |             73.3% |           66.7% |      −6.7% |

- **graphOnlyRecovery (multi-hop 순 기여): 0**
- **regression (악화): 1 — Q-2025-11-2ND-012**

### 전체 (절단 포함) — measured=4

| 지표        | baseline | graph-augmented |          Δ |
| :---------- | -------: | --------------: | ---------: |
| hit-rate    |   100.0% |           75.0% | **−25.0%** |
| mean recall |    80.0% |           75.0% |      −5.0% |

- graphOnlyRecovery: 0 / regression: 1 (Q-012)

### 절단표본 만 (진단) — measured=1

- baseline=graph=100% (Q-045 9회, 53노드 확장·truncated, 정답 LAW-004 유지). Δ 0.

## 2. raw 응답 적대 검증 (regression·동률 원인 규명 — fabricate 0)

작은 N(3~4)이라 1건이 33%를 좌우 → measurable 4건 전부 raw `/api/search/graph` 응답 직접 확인.

| 문항            | expected                        | baseline top5                                  | graph final top5                         | 판정                                                                                                            |
| :-------------- | :------------------------------ | :--------------------------------------------- | :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| Q-031 (5회)     | LAW-002                         | **LAW-002**,LAW-003,LAW-004,INS-32,CONCEPT-001 | **LAW-002**,LAW-003,LAW-004,F-08,F-115   | 동률(둘 다 hit). graph 가 하위 슬롯만 F-노드로 교체(기여 0)                                                     |
| Q-045 (8회)     | LAW-003                         | **LAW-003**,LAW-002,LAW-004,LAW-001,INV-015    | **LAW-003**,LAW-002,LAW-004,LAW-001,F-08 | 동률. expandedNodeCount 6, 정답 유지                                                                            |
| Q-045 (9회)     | LAW-004                         | **LAW-004**,F-103,INS-27,CROP-089,INS-26       | **LAW-004**,F-103,F-130,F-104,F-105      | 동률(truncated, 53노드). 정답 유지                                                                              |
| **Q-012 (2차)** | INS-08,INV-035,CROP-018/019/020 | INV-037,**INV-035**,INV-016,INV-053,INV-002    | F-08,F-01,F-02,F-06,F-07                 | **regression** — baseline 이 회수한 INV-035 를 graph 재정렬이 top5 밖으로 밀어내고 **전부 Formula 노드로 교체** |

**확정 패턴**: graph 확장이 **Formula 노드(F-xx)를 과다 유입**(seedWalkCount 5, expandedNodeCount 6~53)시켜 정답 후보를 밀어낸다. 단일-hop 정답(LAW)이 top-1 견고한 문항은 정답 유지(동률), 정답이 하위 슬롯(INV-035 = baseline rank 2)이면 **F-노드 유입이 정답을 축출(regression)**. multi-hop 순 회수(baseline 미회수→graph 회수) = **0건**.

## 3. §7 분기 매핑 (S5-7 plan §7 — 단정 아닌 매핑)

> S5-7 §7 판정 규칙: NO-GO = "regression ≥ graphOnlyRecovery 또는 hit-rate Δ ≤ 0".

- graphOnlyRecovery **0** ≤ regression **1**, 그리고 hit-rate Δ **음수**(−25%~−33%) → **§7 NO-GO 분기에 해당**.
- CONDITIONAL("ROI 미미하나 양수") 조건 **미충족** (양수 아님, 순기여 0).
- ⇒ **사실로서 NO-GO 방향.** 단 최종 GO/STOP 결정은 진산(RULE #5).

⚠️ **신호 한계 (과대해석 금지)**:

1. **N=4 measurable** (subset, query>500 3건 제외 후). 통계 일반화 불가 — 신호 방향만.
2. 손해평가 도메인 한정. 측정된 4건 중 3건이 **단일-hop LAW 문항**(graph 무관) — multi-hop 의존 문항(Q-012)은 1건뿐인데 그게 regression.
3. **현 graph 파라미터 = maxDepth 2, edge whitelist 12종** 그대로의 결과. 튜닝(F-노드 가중 하향, depth/whitelist 조정) 전 "graph 알고리즘 자체 무가치"로 단정 불가 — **현 설정에서 순손실**이 정확한 서술.
4. CPU 예산(G-S7-3)은 본 정확도 측정으로 미산출 — 별도.

## 4. 함의 (진산 결재 입력)

- **§7 NO-GO 방향** = 옵션 C 격리 유지 (학습자 경로 미노출), "Vector RAG 로 출시"가 🟢 바닥으로 성립(feasibility R4). graph-walk 코드는 격리되어 **매몰비용 최소** — 측정 기반 의사결정의 정상 산물(S5-7 §9).
- baseline(vector-only) **hit-rate 100% / recall 73~80%** = Vector RAG 단독이 이 pilot 에서 이미 강력(정답 LAW 를 top-1 회수). 이것이 측정의 부수 수확 = **🟢 Vector RAG 바닥 재확인**.
- graph 가치 재시도 시 선결: **F-노드 유입 억제**(edge whitelist 재검토 / Formula 노드 truthWeight 재정렬) + **multi-hop 의존 문항 표본 확대**(현 1건 → query≤500 측정 가능한 multi-hop 문항). 이는 별도 plan·결재.

## 5. 후속 (carry-over)

1. **query>500 measurable 3건**(Q-004/014/015) 측정 = 미수행. graph route query 한도 또는 harness 발췌 정책 결정 후(별도 결재). 본 측정은 그 3건 **제외 분모**임을 영속 명시.
2. **N 확대**(30~50, multi-hop 의존 가중) = graph 재평가 전제. 현 pilot 은 신호 방향만.
3. CPU p95(G-S7-3) 별도 측정.
4. S5-7 §7 갱신 완료 → 진산 GO/NO-GO 결재 → feasibility R5 기록.
