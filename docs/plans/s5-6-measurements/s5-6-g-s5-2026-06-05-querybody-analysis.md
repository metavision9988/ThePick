# G-S5 2차 측정 분석 — queryBody · maxDepth 1·2 · 노드-grounded (2026-06-05)

> **북극성 2차 실측.** 1차(2026-06-01, engine-default depth2, full-content)의 −33% 헤드라인을
> 결재 #2(queryBody 정화) + 사전등록 렌즈(`premeasure-interpretation-lens.md`)로 공정 재측정.
> **RULE #5: GO/NO-GO 는 진산.** 본 문서는 🟢🟡🔴 사실 + 렌즈 §4 매핑만. AI 자기 판정 금지.
> **측정 무결성**: REMOTE production(공개 엔드포인트, 무인증) + golden querybody + 러너
> `assertRemoteMeasurementInputs`. fabricate 0. 간헐 504 는 retry 흡수(아래 §5, 채점 본문 불변).

## 0. 측정 환경 (provenance)

- **엔드포인트**: `https://thepick-api-production.metavision9988.workers.dev/api/search/graph`
  (공개 라우트·인증 0·`cors` 만 — `index.ts:54,123-126` / `wrangler.toml:98`. "진산 Cloudflare 인증"은
  배포·D1 추출용이고 측정 HTTP 호출과 무관 — 이번에 실코드로 확정).
- **입력**: `golden-pilot-approved.querybody.json` (measurable 6, content=queryBody, 전부 ≤500).
- **러너**: `scripts/measure-s5-6-multihop-accuracy.ts` topK=5 고정, `--maxDepth 1`·`2` 양측.
  resultCap=엔진 default 50(truncated=false 확인). graphExpansion.applied=true·seedWalkCount=5.
- **node-ID 게이트(렌즈 §5#5)**: 측정 중 production 응답에 expected 노드 ID 실재 확인됨
  (F-103 rank 6, INV-035, CROP-028 등 반환 — 코퍼스 488 ID 와 정합, 드리프트 0).

## 1. 집계 결과 (both depths)

|                                      | maxDepth=1            | maxDepth=2             |
| :----------------------------------- | :-------------------- | :--------------------- |
| hit-rate@5 Δ (절단제외 measured=6/5) | **0.0%** (83.3→83.3)  | **−20.0%** (80.0→60.0) |
| hit-rate@5 Δ (전체 measured=6)       | 0.0% (83.3→83.3)      | −16.7% (83.3→66.7)     |
| mean-recall@5 Δ                      | **−2.4%** (58.1→55.7) | **−6.9%** (49.7→42.9)  |
| graphOnlyRecovery (multi-hop 순기여) | **0**                 | **0**                  |
| regression (hit-rate flip)           | **0**                 | **1 — Q-012**          |

> **핵심 1**: graphOnlyRecovery = **0**(both). graph 가 baseline 미회수 expected 를 추가 회수한 건 **전무**.
> **핵심 2**: depth1 = 무해·무익(hit-rate Δ 0%), depth2 = 순손실(hit-rate −20%). **depth1 이 depth2 보다 안전**.
> **핵심 3 (감사 §5#1 가설 확증)**: 1차 −33% 는 **depth2 아티팩트**. depth1 regression=0 / depth2 regression=1(Q-012).

## 2. 노드-grounded 진단 (per-node baseline vs graph, 렌즈 §4 선결판독)

### Q-012 (expected 5: INS-08·INV-035·CROP-018오디·019두릅·020블루베리)

| depth | baseline top5                                | graph top5                                | 회수    | 기전                                                                        |
| :---- | :------------------------------------------- | :---------------------------------------- | :------ | :-------------------------------------------------------------------------- |
| 1     | INV-037·**INV-035✓**·INV-016·INV-002·INV-053 | F-08·INV-037·**INV-035✓**·INV-016·INV-002 | 1→1     | F-08 1개 주입, INV-035 유지 → regression 0                                  |
| 2     | INV-037·**INV-035✓**·INV-016·INV-002·INV-053 | F-08·F-01·F-02·F-06·F-07                  | 1→**0** | **FORMULA 5개(F-01·02·06·07·08) 범람 → INV-035 축출 = hit-rate regression** |

→ depth2 의 regression 정체 = **F-노드 범람**. depth1 은 범람 1개라 정답 유지. (1차 raw 재현과 동일.)
주의: baseline 도 expected 5 중 INV-035 1개만 회수(CROP 오디/두릅/블루베리는 이름이 본문에 있어도
vector top5 밖 = SURFACE≠top5보장. 렌즈 가정의 한 보정점).

### Q-014 (expected 7: INS-21·INV-060·CROP-028고구마·038감자·035차·TERM-037·038)

| depth    | baseline top5                                      | graph top5                                   | 회수    | 기전                                                                                   |
| :------- | :------------------------------------------------- | :------------------------------------------- | :------ | :------------------------------------------------------------------------------------- |
| 1·2 동일 | **INV-060✓**·INV-079·INV-059·INV-025·**CROP-028✓** | LAW-008·**INV-060✓**·INV-079·INV-059·INV-025 | 2→**1** | **LAW-008 주입 → CROP-028 축출**(recall 저하, hit-rate 는 INV-060 잔존으로 flip 안 됨) |

→ graph 가 LAW-008 을 top 으로 끌어올려 정답 CROP-028 축출. hit-rate 불변(binary)이나 mean-recall 저하 기여.

### Q-015 (expected 3: F-103·CONCEPT-023·INS-27 = 사전등록 NOT-NAMED 3, 유일 식별 문항)

| depth | graphExpansion          | baseline top5 회수 | F-103                                    | CONCEPT-023 | INS-27      |
| :---- | :---------------------- | :----------------- | :--------------------------------------- | :---------- | :---------- |
| 1     | applied·seed5·expanded4 | 0/3                | baseline **rank 6**(0.63) / graph rank 6 | 미포함(>10) | 미포함(>10) |
| 2     | applied·seed5·expanded5 | 0/3                | baseline **rank 6** / graph rank 6       | 미포함(>10) | 미포함(>10) |

→ **렌즈 §4 선결판독 결론**:

- **F-103**: vector 가 **의미 embedding 으로 회수했다**(rank 6, score 0.63) — "NOT-NAMED ≠ vector 불가"
  (IR 렌즈 M1) **실측 확증**. 단 topK=5 컷 바로 아래 6위 → 측정상 miss. **graph 도 6위 그대로**(승격 실패).
  ⇒ F-103 은 graph-only 표적이 아니었다(vector 가 찾음). graph 의 실패 = "정답 F-103 을 top5 로 못 올림".
- **CONCEPT-023·INS-27**: baseline top10 미포함(vector 의미회수도 실패) + graph 도 미회수.
  graph 가 5 노드 확장했으나 이 둘을 top 랭크로 못 올림 = **graph 가 헤드룸 있던 2 노드에서 0 기여**
  (seed-gated 또는 edge 미연결 — F-노드 시드가 이 둘에 ≤depth2 로 안 닿거나 닿아도 랭크 미달).
- **진짜 병목**: vector 가 **무관 FORMULA 5개(0.65)를 정답 F-103(0.63) 위에** 랭크(0.02 차). graph 는
  같은 truthWeight(tw8) FORMULA 를 **더** 주입할 뿐 F-103 을 못 끌어올림 → truthWeight-first 병합이
  동일 type 내 변별 불가. (depth2 는 F-63 을 score 0.00 으로 10위 주입 = 노이즈.)

## 3. 렌즈 §4 매트릭스 매핑 (측정 결과 → 사전등록 판정)

| 사전등록 관측                                  | 실측                                          | 판정                                                                     |
| :--------------------------------------------- | :-------------------------------------------- | :----------------------------------------------------------------------- |
| NOT-NAMED 노드 baseline 회수 (vector 의미회수) | F-103 rank 6 회수 / CONCEPT-023·INS-27 미회수 | 부분 현실화 — F-103 은 vector 가 잡음(표적 아님), 2 노드만 진짜 headroom |
| graph 가 baseline-miss 노드 회수               | CONCEPT-023·INS-27 둘 다 graph 0 회수         | **graph 식별 문항에서 무기여**                                           |
| Q-012 regression depth1 소멸                   | depth1=0 / depth2=1 확증                      | **1차 −33% = depth2 F-범람 아티팩트** 확정                               |
| baseline hit-rate@5 < 100% (정화 효과)         | 83.3%(queryBody) vs 1차 100%(full-content)    | 명칭-동형 표면 anchor 일부 제거된 정화 baseline                          |

## 4. §7 분기 매핑 (감사 "NO-GO 시기상조" 대비 — 사실, 결정 아님)

감사(2026-06-02)가 1차 NO-GO 를 "시기상조"로 본 3 근거의 본 측정 후 상태:

1. **Q-012 regression = depth2 가역** → ✅ **확증**(depth1 regression 0). 1차 헤드라인은 depth2 산물.
2. **graph 유효표본 N=1** → multi-hop 3 으로 확대 측정. 식별 표적 정밀화: 진짜 graph-only headroom =
   CONCEPT-023·INS-27 **2 노드**(F-103 은 vector 가 rank6 로 회수 = 표적서 제외). 둘 다 graph 0 회수.
3. **baseline 100% 아티팩트** → ✅ queryBody 정화 후 baseline hit-rate 83.3%(<100%). F-103 rank6 노출.

**사실 직시 (🟢🟡🔴)**:

- 🟢 **Vector baseline 작동**: queryBody hit-rate@5 83.3%, F-103 의미회수(rank6) 확인.
- 🔻 **graph 현 파라미터 = 순손실(depth2) ~ 무익(depth1)**: graphOnlyRecovery 0(both). depth2 는 F/LAW
  노드 범람으로 정답 축출(hit-rate −20%). depth1 은 무해하나 순기여도 0.
- 🟡 **"알고리즘 사망" 단정은 여전히 시기상조**: 실패 기전이 **튜닝 형상**(F-노드 범람 / truthWeight-first
  병합의 동일-type 무변별 / CONCEPT-023·INS-27 seed-gating / topK=5 가 F-103 rank6 컷) 이고 **N 극소**
  (measurable 6, 식별 표적 2 노드). 재설계(hop 감쇠 / F-노드 억제 / 병합 재랭크 / seed 확대) **미시도**.

⇒ 측정이 가리키는 방향: **현 graph 파라미터는 채택 근거 없음(특히 depth2 금지). depth1 도 순기여 0.**
그러나 이는 "현 설정의 순손실"이지 "graph 원리의 사망"이 아니다 — 감사 "시기상조"와 정합.
**최종 GO/NO-GO·재설계 착수 여부 = 진산(RULE #5).**

## 5. 캐비엇 (정직 기록)

1. **N 극소**: measurable 6 / multi-hop 3 / graph 진짜 식별 표적 = CONCEPT-023·INS-27 **2 노드**(전부 Q-015).
   통계 일반화 아님 — 존재증명(graph 가 이 둘을 못 올림)까지만. 손해평가 도메인 한정.
2. **topK=5 민감도**: F-103 이 rank 6 = topK 6+ 면 baseline 이 회수(graph 무관). 즉 topK 완화 시 baseline
   recall ↑, graph 우위는 여전히 0. (topK=5 는 러너 고정·production default 정합.)
3. **production 504 간헐**: ADR-008 800ms Vectorize 하드 타임아웃(`user-search.ts:42`)이 쿼리 무관
   ~1/5 산발 504(phase=timeout). 러너에 bounded retry 추가(5xx 재시도→소진 시 fail-loud, 4xx 즉시
   fail-loud, stderr 로깅). **결과 결정적**(성공 시 동일 top-K) → retry 는 지연만 넘김, fabricate 아님.
   ★ 별건 운영 부채: production 검색이 ~20% 504 = 학습자 UX 신뢰성 이슈(Phase 3 perf 트랙).
4. **SURFACE≠top5 보장**: Q-012 의 CROP 오디/두릅/블루베리는 이름이 본문에 있어도 vector top5 밖
   (INV 노드가 상위). 렌즈의 "SURFACE→vector 회수"는 _존재_ 보장이지 _top-K 진입_ 보장 아님(보정).
5. **expandedNodes 전체집합**: 응답은 top-K 와 graphExpansion 카운트만 노출(expanded 4~5). CONCEPT-023·
   INS-27 이 확장집합에 *들었으나 랭크 미달*인지 *미도달*인지 = route 가 전체 확장 ID 미노출(감사 §5#3
   carry-over). 어느 쪽이든 top-K 무진입 = graph 무기여는 불변.

## 6. 산출물

- 리포트: `g-s5-qb-depth1/s5-6-remote-g-s5-2026-06-05-0036.{md,json}` (maxDepth=1)
  / `g-s5-qb-depth2/s5-6-remote-g-s5-2026-06-05-0036.{md,json}` (maxDepth=2).
- 사전등록 렌즈: `premeasure-interpretation-lens.md` (v2, 적대검증 반영).
- 본 분석: 측정 → 렌즈 §4 매핑 → §7 분기. feasibility R3 측정완료(2차)·R5 진산 대기.

## 7. 진산 결재 대기 (RULE #5 — AI 판정 금지)

1. **GO/NO-GO**: 현 graph 파라미터 채택 여부(측정: 순손실~무익 / graphOnlyRecovery 0).
2. **재설계 착수 여부**: (a) hop 감쇠 (b) truthWeight-first 병합 재랭크(동일-type 변별) (c) F-노드 범람
   억제 (d) CONCEPT-023·INS-27 seed-gating 해소 — 미시도 옵션. 착수 = 별도 결재(자율 금지).
3. **depth 정책**: 최소한 **depth2 금지**(범람 순손실 확증). depth1 도 순기여 0.
4. (별건) production 504 ~20% = 운영 부채 — Phase 3 perf 트랙 상신 여부.
