# G-S5 재측정 해석 렌즈 — 사전등록 (Pre-Registration)

> **작성**: 2026-06-04 (Session 098), 메인 루프 자율. **REMOTE 측정 전에** 박는다.
> **v2 (2026-06-04)**: 독립 적대 검증 3 렌즈(RAG/IR·손해평가 도메인·적대 측정통계) 반영. §7 기록.
> **목적**: 측정 결과가 도착하기 _전에_ "각 expected 노드가 graph 표적 후보인가 vector 표적인가"를
> 결정론적으로 분류해 둔다. 측정 후 숫자를 보고 사후에 표적을 고르는 것(post-hoc cherry-pick)을
> 차단하기 위한 **사전등록**이다. 단, 이 렌즈는 _예측이 아니라 읽는 자(尺)_ 다 — graphOnlyRecovery 는
> **측정 후 실데이터(baseline-miss 여부)로 확정**하며, 본 분류는 *어디를 볼지*만 고정한다.
> **입력 (전부 read-only, 실데이터)**:
>
> - 측정셋 `golden-pilot-approved.querybody.json` (measurable 6, content=queryBody, 러너 topK=5)
> - 노드 코퍼스 `approved-nodes-corpus.json` (approved 488, 단일 진실원 SQL 추출, id→name→description)
> - 검색 계약 `apps/api/src/search/graph-search-route.ts` + `user-search.ts` (vector=bge-m3 embedding, 시드확장)
> - 표면 토큰 존재는 `content.includes(token)` 결정론 (재현 가능, §2 증거 + §부록 스크립트)
>   **불변**: 원본 골든 `golden-pilot-approved.json` 무변경. 측정 입력 querybody 도 무변경.
>   **이 문서는 결론을 내리지 않는다** (GO/NO-GO = 진산, RULE #5). 측정을 _읽는 자(尺)_ 만 만든다.

---

## 0. 한 줄 요약 (사전등록 핵심)

> **전체 측정셋(measurable 6, multi-hop 3)에서 "표면 anchor 가 없는"(= queryBody 본문에 노드명/공식이
> 노출되지 않아 vector 가 _표면일치_ 로는 회수할 수 없는) expected 노드는 단 3개 — 전부 Q-015 의
> `F-103`(공식)·`CONCEPT-023 자기부담금`·`INS-27 종합위험 농업용 시설물·부대시설 손해보장`.**
>
> ⇒ Q-012·Q-014 의 expected 는 전부 본문에 표면 anchor 가 있어 vector 가 잡을 헤드룸이 크다 →
> 거기서 graph 의 _한계 순기여(marginal)_ 가 0 에 가까운 것은 "graph 실패"가 아니라 "vector 가
> 이미 다 잡아 더 보탤 게 없음"이다(헤드룸 0). 측정의 식별력(discriminating power)은 **Q-015 의 이 3
> 노드**에 집중된다.
>
> ⚠️ **단, "표면 anchor 없음 ≠ vector 회수 불가"** — vector 는 bge-m3 **의미 embedding** 회수이므로
> 이름이 본문에 없어도 description 의미유사도로 회수될 수 있다(예: Q-015 의 지급보험금·손해액 맥락 ↔
> CONCEPT-023 description "손해액 … 자기부담금" 의미 근접). 따라서 이 3 노드는 **graph-only 표적
> _후보_** 이며, "정말 vector 가 놓쳤는가"는 **측정의 per-node baseline recall 이 확정**한다.
> graphOnlyRecovery 의 진짜 분모 = NOT-NAMED ∩ (baseline-miss 확인).

---

## 1. 분류 규칙 (3-tier, 측정 전 고정)

expected 노드를 queryBody 본문 대비 **표면 anchor 존재성**으로 3분류한다. (표면 = literal substring.
의미 embedding 회수는 별개 축 — 측정이 판정.)

| tier          | 정의 (표면 anchor)                                                       | vector 표면회수 | vector 의미회수     | graph-only 표적? |
| :------------ | :----------------------------------------------------------------------- | :-------------- | :------------------ | :--------------- |
| **SURFACE**   | 식별적(distinctive) 노드명 토큰이 본문에 존재 (오디·고구마·과실손해조사) | 높음            | 높음                | ✗ (헤드룸 0)     |
| **GENERIC**   | 일반 공유 토큰만 존재 (보험금·보험가액 = 표 헤더, 다수 노드 공유)        | 모호            | 모호                | △                |
| **NOT-NAMED** | 노드명/공식이 본문에 부재 (정답·해설에만 있던 개념)                      | 낮음            | **미지(측정 확정)** | **○ 후보**       |

- 판정 = 본문 substring 존재(결정론). "식별적 vs 일반" 경계는 §2 각 행에 사유 + 코퍼스 description 근거.
- **NOT-NAMED = graph-only _후보_** — vector 의미 embedding 이 회수할 수도 있으므로 단정 금지.
- **graphOnlyRecovery 의 공정 분모 = NOT-NAMED ∩ (baseline 미회수 실측)**. 측정 후 확정.
- baseline(vector) recall 이 높은 것은 _정상 작동_ 이지 "오염"이 아니다(아래 §3 재서술). 다만 hit-rate
  헤드룸이 SURFACE 다수에 지배되므로 graph 비교의 식별 신호는 NOT-NAMED 소수에만 존재한다.

---

## 2. 노드별 분류 (measurable multi-hop 3 — 측정 전 고정)

표면 토큰 존재는 querybody content 에 `includes()` 로 검증(2026-06-04 실측, §부록 재현).

### Q-2025-11-2ND-012 (queryBody 181자, expected 5)

| 노드     | type          | name                         | 본문 토큰                        | tier        |
| :------- | :------------ | :--------------------------- | :------------------------------- | :---------- |
| INS-08   | INSURANCE     | 종합위험 과실손해보장방식    | 종합위험✅ 과실손해보장✅        | **SURFACE** |
| INV-035  | INVESTIGATION | 과실손해조사 (감귤 온주밀감) | 과실손해조사✅ 감귤✅ 온주밀감✅ | **SURFACE** |
| CROP-018 | CROP          | 오디                         | 오디✅                           | **SURFACE** |
| CROP-019 | CROP          | 두릅                         | 두릅✅                           | **SURFACE** |
| CROP-020 | CROP          | 블루베리                     | 블루베리✅                       | **SURFACE** |

→ **NOT-NAMED 0 / GENERIC 0 / SURFACE 5.** graph-only 후보 = **0** (헤드룸 0).
의미 있는 신호는 graphOnlyRecovery 가 아니라 **regression(graph 확장이 정답을 _밀어냄_) 여부**.
캐비엇: INV-035 는 "감귤 온주밀감 한정"이라는 qualification 결합은 본문에 없으나, 토큰은 존재 →
baseline 회수 가능하므로 graph 표적 수에 영향 없음(SURFACE 유지, 도메인 렌즈 m1).

### Q-2025-11-2ND-014 (queryBody 270자, expected 7)

| 노드     | type          | name                                   | 본문 토큰                                   | tier            |
| :------- | :------------ | :------------------------------------- | :------------------------------------------ | :-------------- |
| INS-21   | INSURANCE     | 종합위험 밭작물 수확감소보장           | 수확감소보장✅ 밭작물✅                     | **SURFACE**     |
| INV-060  | INVESTIGATION | 밭작물 수확량조사 (사료용 옥수수 제외) | 밭작물✅ 수확량조사✅                       | **SURFACE**     |
| CROP-028 | CROP          | 고구마                                 | 고구마✅                                    | **SURFACE**     |
| CROP-038 | CROP          | 감자(가을재배)                         | 감자✅                                      | **SURFACE**     |
| CROP-035 | CROP          | 차(茶)                                 | 차✅ (단일글자 — 약함, false-positive 위험) | **SURFACE\***   |
| TERM-037 | TERM          | 비대 종료 / 결구 형성 완료             | 비대✅ 종료✅ / 결구❌ 형성❌ 완료❌        | **SURFACE\*\*** |
| TERM-038 | TERM          | 신초 (1심2엽) / 기수확지수             | 신초✅                                      | **SURFACE**     |

→ **NOT-NAMED 0 / GENERIC 0 / SURFACE 7.** graph-only 후보 = **0** (헤드룸 0). \* CROP-035 "차"는 단일글자 매칭이라 신뢰도 낮음(아래 §3 산술 캐비엇). graph 표적 수 불변.
\*\* TERM-037 "비대 종료 / 결구 형성 완료": 전반부(비대 종료)만 본문 존재, 후반부(결구 형성 완료 =
양배추용, Q-014 미출제)는 부재(도메인 렌즈 M1). 토큰 일부 존재로 SURFACE 유지하나 부분 hidden 기록.

### Q-2025-11-2ND-015 (queryBody 398자, expected 3) — ★ 유일한 식별 문항

| 노드        | type      | name                                           | 코퍼스 description (실측)                                                      | 본문 토큰                                              | tier            |
| :---------- | :-------- | :--------------------------------------------- | :----------------------------------------------------------------------------- | :----------------------------------------------------- | :-------------- |
| F-103       | FORMULA   | 농업용 시설물 보험금 (보험가입금액 < 보험가액) | `산식: min(loss_amount - deductible_amount, insurance_amount)`                 | 공식❌ / 보험금·가입금액·가액·손해액✅(표 헤더 일반어) | **NOT-NAMED ✓** |
| CONCEPT-023 | CONCEPT   | 자기부담금                                     | `손해액 … 자기부담금 산정. 비가림시설=손해액 10% …`                            | 자기부담금❌                                           | **NOT-NAMED ✓** |
| INS-27      | INSURANCE | 종합위험 농업용 시설물·부대시설 손해보장       | `농업용 시설물(원예시설/단동하우스…) … MIN(손해액-자기부담금, 보험가입금액) …` | 종합위험❌ 농업용 시설물❌ 부대시설❌                  | **NOT-NAMED ✓** |

→ **NOT-NAMED 3 / GENERIC 0 / SURFACE 0.** graph-only 후보 = **3** (전부 Q-015).

- **F-103 재분류 (GENERIC→NOT-NAMED, 적대검증 3/3 렌즈 합의)**: 분류 기준은 _식별적 내용_(= 공식
  `min(손해액-자기부담금, 보험가입금액)`)의 표면 존재인데, 공식 자체는 본문에 없고 표 헤더 재무용어
  (보험금/가입금액/가액/손해액 — 무수한 노드 공유)만 있다. 옆의 자기부담금(CONCEPT-023)이 NOT-NAMED
  인데 그 자기부담금을 핵심 항으로 가진 F-103 을 GENERIC 으로 둔 것은 모순(도메인 렌즈 M2 / 측정통계
  렌즈 C2 / IR 렌즈 m1). ⇒ NOT-NAMED 로 통일. (결론 방향 불변 — 식별력 Q-015 집중 강화.)
- "자기부담금"·"종합위험 …손해보장"·공식은 정답·해설 제거 후 본문 부재 = 표면일치 불가 = vector 가
  표면으로는 못 잡음. 단 **의미 embedding 회수는 측정이 판정**(§0 ⚠️) — description 이 Q-015 의 손해액/
  지급보험금 계산 맥락과 의미 근접하므로 baseline 이 _의미적으로_ 회수할 수도 있다.

---

## 3. 집계 (측정 전 고정)

| 지표                            |                                    값 | 의미                                         |
| :------------------------------ | ------------------------------------: | :------------------------------------------- |
| 전체 expected (multi-hop 3)     |                                    15 | —                                            |
| SURFACE (표면 anchor 존재)      | 12 (80%, 차 false-positive 시 11=73%) | hit-rate 헤드룸 지배군                       |
| GENERIC                         |                                     0 | (F-103 재분류로 소거)                        |
| **NOT-NAMED (graph-only 후보)** |                                 **3** | **F-103 + CONCEPT-023 + INS-27, 전부 Q-015** |
| graph-only 후보 보유 문항       |                             **1 / 3** | Q-015 만                                     |

> **함의 1 (재서술 — 도메인 렌즈 m2)**: multi-hop expected 의 ~80%가 본문에 표면 anchor 보유 →
> baseline(vector) 의 높은 recall 은 **정상 작동**(표면일치 = 아티팩트 아님). 다만 hit-rate 헤드룸이
> 이 쉬운 SURFACE 다수에 지배되므로, **graph 의 비교 우위가 _측정될 수 있는 곳_ 은 NOT-NAMED 소수뿐**.
> hit-rate=100%(1차)를 "graph 가 못 이겼다"의 근거로 읽으면 안 됨(헤드룸이 거기 없었음).
> **함의 2 (식별력 집중)**: 공정 graph 신호는 Q-015 의 3 노드 baseline-miss 후 graph 회수 여부 한 곳.
> **함의 3 (검정력)**: NOT-NAMED N=3(전부 1문항) → **존재증명**(graph 가 vector 가 놓친 노드를 edge
> 로 회수)까지만. **통계 일반화·효과크기(effect size) 측정은 불가**(측정통계 렌즈 M2).

---

## 4. 사전등록 해석 매트릭스 (측정 결과 → 읽는 법)

`--maxDepth 1` 과 `--maxDepth 2` 두 리포트(러너 topK=5, hit-rate@5 + mean-recall@5 양행 출력)를
아래로 _기계적으로_ 매핑. graphOnlyRecovery 는 **측정 후** NOT-NAMED ∩ baseline-miss 로 산정.

**선결 판독 (per-node, Q-015 의 NOT-NAMED 3 = F-103·CONCEPT-023·INS-27 각각):**

1. **baseline 이 그 노드를 회수했는가?** (vector 의미 embedding 회수 = §0 ⚠️ 현실화 여부)
   - 회수 O → 그 노드는 graph-only 표적이 아니었음(vector 의미회수로 충분). graphOnlyRecovery 분모 제외.
   - 회수 X → graph-only 표적 확정. graph 가 회수하면 **순기여**, 못 하면 무기여.
2. **graph 가 baseline-miss 노드를 회수했는가?** 단, graph 는 baseline 상위 5 시드에서 확장하므로
   (`GRAPH_SEED_WALK_LIMIT=5`, graph-search-route.ts:75·185), **그 노드가 어떤 baseline 시드와
   ≤maxDepth edge 로 연결돼야** 도달 가능. 미회수 시:
   - 인접 시드가 baseline 에 있었는데 graph 가 못 폄 → **graph edge/파라미터 한계**.
   - 인접 시드 자체가 baseline 에 없었음 → **vector-seed-gated**(graph 탓 아님, IR 렌즈 M4·실코드 확증).
     ⇒ 측정 시 baseline 시드 집합과 expected 의 인접성을 함께 기록해 이 둘을 분리.

| 관측 (Q-015, NOT-NAMED 3)                            | 사전등록 판정                                                                                                                                        |
| :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥1 노드: baseline-miss + graph-recover, regression 0 | **graph multi-hop 순기여 존재증명** (NO-GO 시기상조 입증 강화 / CONDITIONAL 재측정 근거)                                                             |
| NOT-NAMED 전부 baseline-recover (vector 의미회수)    | graph 표적이 사실상 없었음 = vector 의미검색으로 충분 (graph 무용 아님·무대 없음). 정직 기록                                                         |
| baseline-miss 노드를 graph 도 0 회수, 인접 시드 존재 | graph edge/파라미터(depth·whitelist) 한계 방향 (N=3 한계 명기)                                                                                       |
| baseline-miss 노드를 graph 0 회수, 인접 시드 부재    | **vector-seed-gated** — graph 식별 불가(측정 한계). graph 탓으로 귀속 금지                                                                           |
| Q-012 regression: depth1 vs depth2 거동              | **양 depth 결과 모두 저장**. 소멸/잔존을 _관측_ 으로 기록하되 인과(튜닝 vs 노이즈 vs baseline 불안정)는 별도 분석 — 사전 단정 금지(측정통계 렌즈 m2) |
| baseline hit-rate@5 < 100% (queryBody 정화 효과)     | 명칭-동형 표면 anchor 일부 제거된 정화 baseline (단 의미회수는 잔존)                                                                                 |

- **헤드라인 = hit-rate@5 와 mean-recall@5 _양쪽 동시 보고_** (러너가 둘 다 출력, multihop-accuracy.ts:315-316).
  N=3 NOT-NAMED 에서는 둘이 거의 동치(이산값)이므로 **per-node 회수 표(노드별 baseline/graph)** 가 1차 신호.
- **파라미터 동결**: topK=5(러너 고정, measure-s5-6:147) / resultCap=엔진 default 50(미전송, `truncated`
  surface=CO6-2 → true 면 절단 보정) / maxDepth ∈ {1,2} 양측. 무단 튜닝 여지 0.
- N=6(측정) / NOT-NAMED N=3(전부 Q-015) = 신호이지 통계 일반화 아님. 손해평가 도메인 한정.

---

## 5. 정직 캐비엇 (측정 전 미리 박음)

1. **표면 anchor ≠ vector 회수 능력** (IR 렌즈 M1/M2, 실코드 확증) — vector=bge-m3 의미 embedding
   (`user-search.ts` Stage1 Vectorize.query, 유사도≥0.60). NOT-NAMED 도 의미회수 가능 → graphOnlyRecovery
   는 측정 후 baseline-miss 로만 확정. 본 렌즈는 "어디를 볼지"만 고정(예측 아님).
2. **graph = baseline 시드 확장** (IR 렌즈 M4, graph-search-route.ts:75·185) — graph 는 baseline 상위 5
   시드에서만 N-hop 확장. NOT-NAMED 노드가 어떤 시드와 ≤maxDepth edge 로 안 닿으면 graph 도 회수 불가.
   ⇒ graphOnlyRecovery=0 을 "graph 실패"로 단정 금지(vector-seed-gated 분리 = §4 선결판독 2).
3. **NOT-NAMED N=3, 전부 Q-015** — 단일 문항 의존. 존재증명까지만, 효과크기·일반화 금지(측정통계 M2).
   "baseline 도 회수" 케이스(graph 순기여 0)도 정직 판정에 포함(§4 매트릭스 2행).
4. **산술 캐비엇 (측정통계 M1)**: SURFACE 80% 는 CROP-035 "차" 단일글자 매칭에 의존 → false-positive 시
   73%. "[73%, 80%]" 범위로 읽음. NOT-NAMED 분모(3)에는 영향 0(존재 쪽 오류).
5. **node-ID 드리프트 (IR m2 / 측정통계 M3) — 측정 전 게이트 의무**: 코퍼스(488)는 2026-05-16 추출.
   측정 직전 production D1 에서 `F-103·CONCEPT-023·INS-27` id+name 존재·동일 확인(1 쿼리, 진산 인증
   세션). 불일치 시 코퍼스 재스냅샷 후 측정(N=3 에서 1 노드 변동 = 33% 검정력 손실).
6. **F-103 GENERIC→NOT-NAMED 재분류** (3 렌즈 합의) — 공식 자체 부재 기준. 결론 방향(Q-015 집중) 불변.
7. **expected = 골든 라벨** — 진산 동결 골든 relatedNodesRaw 기준. "추론경로" 재정의(결재 큐 #6)는 별건.

---

## 6. 상태

- **사전등록 v2 완료** (2026-06-04, 적대검증 반영). REMOTE 측정 대기 (잔여 게이트 = 진산
  `THEPICK_API_BASE` 인증). 측정 직전 §5 #5 node-ID 게이트 1 쿼리 동반.
- 측정 도착 시: §4 선결판독(per-node baseline-miss 분리) → 매트릭스 매핑 → `s5-6-g-s5-analysis.md`
  갱신 → §7 분기 재매핑 → feasibility R5 / 진산 GO/NO-GO(RULE #5).

## 7. 독립 적대 검증 기록 (2026-06-04, wf_43a0a6ba)

3 렌즈 병렬(Explore 에이전트, read-only 실코드 대조). 종합 판정: IR/RAG **SOUND_WITH_FIXES** /
손해평가 도메인 **SOUND_WITH_FIXES** / 적대 측정통계 **FLAWED**. 메인이 실코드로 cycle-closure.

**채택(실코드 확증 후 v2 반영):**

- F-103 GENERIC→NOT-NAMED (3/3 렌즈, 코퍼스 description 실측: 공식 본문 부재). §2 Q-015·§3.
- NOT-NAMED ≠ vector 불가 = 의미 embedding 축 분리 (IR M1/M2, user-search.ts bge-m3 확증). §0⚠️·§1·§5#1.
- graph=baseline 시드 확장 → vector-seed-gated 분리 (IR M4, graph-search-route.ts:75·185 확증). §4·§5#2.
- N=3 존재증명 한정·"baseline 도 회수" 케이스 정의 (측정통계 M2). §3 함의3·§4 매트릭스 2행.
- "80% 아티팩트"→"정상 작동·헤드룸 부재"로 재서술 (도메인 m2). §3 함의1.
- 차 단일글자 → [73%,80%] 범위 (측정통계 M1). §3·§5#4.
- node-ID 드리프트 측정 전 게이트 승격 (IR m2·측정통계 M3). §5#5.
- topK=5·resultCap·maxDepth 동결 명시 (IR MINOR·측정통계 m1). §4.
- regression 인과 사전단정 제거 (측정통계 m2). §4 매트릭스 6행.
- TERM-037 부분 hidden / INV-035 qualification 기록 (도메인 M1·m1). §2.

**기각(실코드 반증):**

- "mean-recall 미구현, route 가 hit-rate 만 반환" (측정통계 M4) → **기각**. 러너 `multihop-accuracy.ts`
  가 recallBaseline/Graph(160-161) + meanRecall(230-239) 계산, 리포트 표 hit-rate+mean recall 양행
  출력(315-316). 페르소나가 route(검색결과)와 eval 러너(채점)를 혼동.
- "topK 무단 튜닝 위험"(측정통계 m1 일부) → **부분 기각**. 러너가 topK=5 **고정**(measure-s5-6:147),
  route default(3) 아님 → 무단 튜닝 여지 0. (동결 사실 §4 명시.)
- "사전등록이 답 공간 사전봉쇄"(측정통계 C1) → **부분 채택·부분 반박**. SURFACE 분류는 "graph 무용"이
  아니라 "marginal 헤드룸 0"을 뜻함(vector 가 이미 잡음). 단 비판 수용해 "graphOnlyRecovery 는 측정
  후 실측 확정, 본 분류는 _어디를 볼지_ 만 고정"으로 §0·§1 명문화(예측 아님 = 답 공간 미봉쇄).

## 부록 — 재현 스크립트

```bash
./apps/api/node_modules/.bin/tsx -e '
import fs from "fs";
const qb = JSON.parse(fs.readFileSync("docs/plans/s5-6-measurements/golden-pilot-approved.querybody.json","utf8"));
const corpus = JSON.parse(fs.readFileSync("docs/plans/s5-6-measurements/approved-nodes-corpus.json","utf8"));
const byId = new Map(corpus.map(n=>[n.id,n]));
// 각 multi-hop 문항 expected → byId 로 name/description 조회 → content.includes(token) 판정
'
```
