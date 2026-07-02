# Graph-Walk 재설계 plan (S5-8) — G-S5 2차 측정 grounded

> **상태**: DRAFT. **L3 (코어 검색·랭킹 엔진).** 본 plan 은 _무엇을 왜 어떻게_ + 대안 비교(PITR) +
> 검증 게이트까지다. **코드 착수 = 진산 결재 후**(§9). 자율 착수 금지.
> **근거 측정**: `s5-6-g-s5-2026-06-05-querybody-analysis.md` (2차 실측, node-grounded).
> **현 구현 매핑**: 4 영역 병렬 탐사(wf_68e0dffd) + 메인 cycle-closure(엣지 도달성 batch 1274 직접 검증).
> **G-1 준수**: 본 plan 은 "graph 가 개선된다"를 단언하지 않는다. 옵션·게이트·천장만 못박고 GO 는 진산.
> **결재 #7 집행 (2026-06-12)**: Phase 1 비교군에 **D안(graph-walk 동결 + lexical fusion)** 등재 —
> §3 Phase 1-D·§4·§7·§9 (MASTER_PLAN §6 #7 ☑ 진산 승인 2026-06-11 "추천한 것으로". 등재만 집행,
> D안 구현 착수는 §9 별도 체크 + 상세 plan 별건).

---

## 0. Reality Anchor (이 재설계가 실패/제한될 3+1 이유 — 먼저)

1. **식별 신호 N=1**: 공정 측정에서 graph 가 빛날 수 있던 유일 문항은 Q-015 하나(NOT-NAMED 표적 3).
   이 1 문항에 맞춰 튜닝하면 **과적합**이다. ⇒ Phase 0b(golden 확대)가 **하드 선결 게이트**. 확대 신호
   없이 알고리즘 재설계 착수 금지.
2. **데이터 천장**: Q-015 정답 중 `CONCEPT-023 자기부담금`은 batch 그래프에서 **연결 엣지 자체가 부재**
   (inbound = F-21·INS-12 뿐, INS-27·F-103 과 단절). graph 알고리즘으로 영영 도달 불가 = **콘텐츠 공백**.
   graph 의 multi-hop 천장은 **엣지 밀도**에 종속하고, 그 밀도는 수작업 BATCH 품질 문제다(자동 아님).
3. **vector seed 품질 종속**: graph 는 baseline 상위 5 시드에서 확장한다. Q-015 는 vector 가 무관
   FORMULA 5개를 정답 F-103(rank6) 위에 올렸다 — graph 는 **틀린 시드의 이웃만** 본다. 상류(vector
   랭킹)가 정답을 시드에 못 넣으면 graph 도 못 산다.
4. **랭킹 정책 blast radius**: 근본 지렛대(truthWeight-first 정렬)는 baseline(/api/search)과 **공유 단일
   진실원(CO-3)**. 직접 변경 = 보호 대상 baseline 변형 = ADR + 전면 회귀. 보수 경로(ADR 무관)는 효과 제한.

> ⇒ "graph 재설계로 북극성을 살린다"는 **측정 전 단언 불가**. 본 plan 은 (a) 손해부터 멈추고(Phase 0)
> (b) 데이터로 문제 실재를 확대 검증한 뒤(Phase 0b) (c) 단계적·게이트별로 투자하며 매 단계 재측정으로
> 판정한다. 각 Phase GO 는 진산.

## 1. 측정이 확정한 4 실패 기전 (node-grounded + cycle-closed)

| #   | 기전                                   | 측정 증거                                                                                                                | 근원 (data/algo)                                                 | file:line                                               |
| :-- | :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- | :------------------------------------------------------ |
| F1  | **F-노드 범람**                        | depth2 Q-012: baseline[INV-035✓] → graph[F-08·01·02·06·07] = INV-035 축출(regression)                                    | algo (truthWeight FORMULA8>INVESTIGATION7 + depth2 다중도달)     | graph-walk/index.ts:224-247 / graph-search-route.ts:269 |
| F2  | **truthWeight-first 동일-type 무변별** | Q-015 정답 F-103(0.63) 이 무관 FORMULA×5(0.65) 아래 rank6 고착, graph 도 승격 못함                                       | algo (comparator 가 동일 truthWeight 내 score만 봄)              | user-search.ts:330-333                                  |
| F3  | **seed-gating**                        | Q-015 INS-27·CONCEPT-023 baseline top10 미포함 → seeds(F-70/62/84/75/97)에서 ≤depth2 forward 도달 **0**(batch 직접 검증) | **혼합**: F-103·INS-27=algo 회수가능 / CONCEPT-023=**data 공백** | graph-search-route.ts:186 + 엣지 데이터                 |
| F4  | **topK=5 컷**                          | F-103 rank6 = topK5 바로 아래 절단                                                                                       | policy (측정 기준선)                                             | graph-search-route.ts:286                               |

**cycle-closed 엣지 사실 (batch 1274 직접 검증, production count 일치)**:

- `INS-27 --USES_FORMULA--> F-103` 존재. `INS-27` outbound 6개(풍부). `F-103` = leaf(inbound만).
- `CONCEPT-023(자기부담금)` inbound = `F-21 --DEPENDS_ON-->`, `INS-12 --EXCEPTION-->` **뿐** → INS-27/F-103 과 단절.
- **`INS-27 → CONCEPT-023` 엣지 부재** = 공식이 자기부담금을 쓰는데 그 의미관계가 그래프에 미인코딩(콘텐츠 공백).
- 도달성: seeds→타겟 forward depth≤2 = **0**. **F-103 을 seed 로 가정 시 bidir depth≤1 → INS-27 도달**,
  depth≤2 → CONCEPT-105/111/196/197 도달. **단 CONCEPT-023 은 F-103 seed·bidir 로도 영영 도달 불가**(엣지 부재).

> ★ **타겟별 분리 결론** (탐사 에이전트의 "전부 데이터 공백" 을 메인이 정밀화):
>
> - **F-103, INS-27** = **알고리즘 회수 가능** (seed 에 정답 형식 포함 + 양방향 순회 → 엣지 존재).
> - **CONCEPT-023(자기부담금)** = **데이터만** (연결 엣지 부재 — BATCH 보강 없이는 graph 영구 불가).

## 2. 설계 갈림길 (3 축)

| 축       | 보수 (ADR 무관)                                         | 전략 (ADR 필요)                                                                                    | 데이터                             |
| :------- | :------------------------------------------------------ | :------------------------------------------------------------------------------------------------- | :--------------------------------- |
| **랭킹** | 확장 노드 **입력 정제**(필터·hop감쇠) — comparator 불변 | truthWeight-first **검색 랭킹**과 **주입 우선순위** 분리(relevance-first 검색) — CO-3/Pass2 재정의 | —                                  |
| **도달** | depth1 기본 + **양방향 순회** + **seed 다양화**         | —                                                                                                  | BATCH 엣지 밀도 보강(자기부담금류) |
| **검증** | 기존 6 Binary Gate + 재측정                             | + baseline 전면 회귀                                                                               | golden 확대                        |

> **핵심 제약 (CO-3)**: `compareByTruthWeightThenScore` 는 baseline·graph **공유 단일 진실원**
> (user-search.ts:330-333, /api/search 불변 Hard 계약). ⇒ comparator 직접 변경 = baseline 변형 = **ADR 필수**.
> 보수 경로는 comparator 를 안 건드리고 **merge 입력(확장 노드 집합·점수)만** 손본다.

## 3. 단계별 plan (cheap·게이트 우선)

### Phase 0 — 손해 정지 (즉시·저위험·가역, 단독 결재 가능)

- **0a. `/api/search/graph` depth1 기본화** (R4/D1): graph-search-route.ts:232 — maxDepth 미주입 시 엔진
  default(2) 대신 **1** override. 측정: depth2=순손실(hit-rate −20%, regression 1) / depth1=무해(regression 0).
  비용 ~0, 가역. **이건 "개선"이 아니라 "확정된 손해 차단"** — graph 채택 여부와 무관히 depth2 금지.
  - Binary Gate G-R0a: 재측정 depth1 regression=0 재확인 + 기존 graph-walk.golden 6 Gate PASS.
- **0b. golden 평가셋 확대 (★ 알고리즘 재설계 하드 선결)**: 현 measurable 6 / NOT-NAMED 표적 3(전부 Q-015)
  = 과적합 위험. multi-hop·NOT-NAMED 표적 보유 문항을 **N≥20~30**으로 확대(손해평가 도메인, draft-only,
  순환편향 차단 — vector/graph 로 golden 선정 금지). 방법론 = 기존 S5-6b plan 계승.
  - Binary Gate G-R0b: 확대 golden 에서 사전등록 렌즈 재적용 → NOT-NAMED 표적 ≥15(문항 분산), 순환편향 0.
  - ⇒ **확대 측정에서 graph 순손실/무익이 재현되면** Phase 1 착수 정당. 재현 안 되면(표본 편향이었으면)
    재설계 자체 재검토(진산 보고).

### Phase 1 — 보수 알고리즘 재설계 (CO-3·baseline 불변, comparator 미변경)

> 전제: Phase 0b 확대 측정에서 문제 재현. 목표 = (a) 범람 손해 제거 (b) 엣지 존재 표적(INS-27·F-103류) 회수.

- **L1. 확장 FORMULA 노드 주입 억제** (E3, F1 해소): graph-walk 가 FORMULA 엣지(USES_FORMULA)를 *순회*는
  하되, 결과에 **FORMULA 노드 과다 편입 차단**(예: 확장 FORMULA 수 상한 또는 비-FORMULA 우선). comparator
  불변 — merge 입력에서 거른다. **PITR**: (A) FORMULA 노드 최종 SELECT 제외 vs (B) 확장 FORMULA 개수 cap
  vs (C) USES_FORMULA 엣지를 depth1 만 허용. 권고 = **C**(가장 보수, 측정 F1 직격: depth1 F-08 1개는 무해).
- **L2. 확장 노드 hop-감쇠 점수** (R3, F2 부분): 확장 노드 score=0 대신 `score = base / (1 + depth*k)`
  (k = **하드코딩 numeric literal**, Hard Limit: LLM/동적 계산 금지). 동일 truthWeight 내에서 먼 노드가
  가까운 정답을 못 누르게. **단 cross-type(FORMULA>INVESTIGATION) 역전은 comparator 가 truthWeight-first
  라 L2 로 불가** → L1(주입 억제)이 F1 의 1차 방어.
- **L3. 양방향 순회** (F3 algo 부분): graph-walk/index.ts:224-247 WITH RECURSIVE 를 from→to 단방향에서
  **to←from 역방향 1-hop 추가**(INS-27 → F-103 inbound 을 F-103 seed 에서 역추적). batch 검증: F-103 seed
  - bidir depth1 → INS-27 도달. **PITR**: (A) 전면 양방향 vs (B) inbound 1-hop 만 vs (C) 엣지 type별 방향성
    지정. 권고 = **B**(CPU·노이즈 최소, 측정 표적 직격). CPU: 역방향 = recursive CTE 1회 추가(50ms 예산 내 확인).
- **L4. seed 다양화 / 정답형식 포함** (F3 algo 부분): GRAPH_SEED_WALK_LIMIT 또는 시드 선택을 type 균형화
  (S2) — vector 가 rank6 로 민 정답 F-103 을 시드 이웃에 넣음. **PITR**: (A) seed 5→7~10(top-K 확대, CPU
  ×1.4~2, 50ms 내) vs (B) type round-robin 시드 vs (C) baseline rank6~10 의 비-FORMULA 우선 시드. 권고 =
  **B 우선, A 보조**. ⚠️ 측정 무결성: 시드를 baseline top-K 밖으로 확대하면 A/B 비교 격리 변형(별 route/플래그 필요).
- **검증**: 확대 golden 재측정(depth1) → graphOnlyRecovery>0 (INS-27·F-103류 회수) **AND** regression=0
  **AND** 기존 6 Binary Gate + ranking-core/graph-search-route/user-search 테스트 PASS + /api/search 불변.

### Phase 1-D — D안: graph-walk 동결 + lexical fusion (비교군 — 결재 #7 등재)

> **위상**: Phase 1(보수 graph algo)의 **대조군**. graph-walk 는 depth1(0a) 동결로 두고, 자체 스펙이면서
> 정상 경로 미배선인 **lexical(keyword) 신호 융합**이 같은 실패 표적을 더 싸게 회수하는지 **동일 확대
> golden(0b)에서 비교 측정**한다. 비교 측정 결과 = **#8(G-S5 GO/NO-GO) 재상신 트리거** (MASTER_PLAN §6
> #8 조건부 보류 원문: "실질 처분 = #6(depth1 차단)+#7(D안 비교군) 집행 후 D안 vs graph 재설계 비교
> 측정 결과로 재상신").

- **근거 스펙 (Accepted, 융합만 미배선)**: SEARCH_PIPELINE.md §2 — Keyword Search(D1 N-gram, ~50ms) +
  "Vector 0.60~0.75 → Hybrid + Keyword 결합" 분기 (ADR-019 Accepted — 정상경로 Concurrent 원형·**미구현**
  / ADR-015 Accepted — fallback 경로·기실재. 두 ADR 의 귀속 경로가 다름에 주의). 현 실재: lexical 매처는
  `multi-path-fallback/keyword-fallback.ts` 가 **fallback Stage 2 한정** 가동(vector 실패/graceful 시에만
  진입 — routes.ts runMultiPathFallback) — 정상 경로 랭킹에 lexical 융합 = **0건**(user-search.ts 무결합).
- **표적 정합 (실측 F2 직격)**: Q-015 정답 F-103(0.63) 이 무관 FORMULA×5(0.65) 아래 rank6 고착 = vector
  0.02차 변별 불능. 질문 토큰 lexical 일치는 vector 동률대의 **직교 변별 신호 후보**이고, graph 와 달리
  엣지 밀도(§0-2 데이터 천장)·seed 품질(§0-3)에 **비종속**. 단 명칭 비포함(NOT-NAMED) 표적의 lexical
  회수 여부는 **측정 전 단언 불가**(G-1) — 확대 golden 비교 측정이 판정.
- **PITR (D안 내부 갈림길 — 채택 시 상세 plan 별건·L3 검색 경로)**: (D-A) `/api/search/graph` 의 walk
  호출을 lexical 융합으로 대체(비교 격리 명확) vs (D-B) 기존 keyword-fallback 매처를 정상 경로 re-rank
  tiebreak 로 재사용(신규 표면 최소) vs (D-C) Concurrent 3-way 전면 배선(SEARCH_PIPELINE §2 원형, 비용
  최대). 권고 = **D-B** — 단 권고일 뿐, 채택·조정은 진산.
- **게이트 (Phase 1 동일 기준 준용)**: 동일 확대 golden 에서 lexicalOnlyRecovery(graphOnlyRecovery 상당
  지표) > 0 AND regression = 0 AND `/api/search` 불변(byte-동치) AND CPU p95 예산 내(G-R-5 준용) + 기존
  테스트 PASS.
- **비용·천장 정직**: 매처 기실재라 신규 표면은 융합·계측뿐 — Phase 1(graph 3종 수술 L1·L3·L4) 대비
  저비용 [추정, 구현 전]. 단 한국어 어미 변화 미대응(D-MPF-1=A 채택 한계)·LIKE 단순 매칭이라 lexical
  천장도 유한 — SP-T06 ≥ 85% 미달 시 옵션 B(bge-m3 reranking) 보강 의무 조항이 동일 적용.

### Phase 2 — 전략 랭킹 (ADR-gated, 진산 별도 결재)

> 전제: Phase 1 후에도 F2(동일-type 무변별·cross-type 범람)가 잔존하고 확대 측정이 정당화할 때만.

- **검색 랭킹 ≠ 주입 우선순위 분리**: 현 `compareByTruthWeightThenScore`(truthWeight-first)는 **LLM 주입
  순서**(Pass2 Hard Rule: LAW>FORMULA>CONCEPT)와 **검색 top-K 랭킹**을 한 함수로 묶었다. 검색 top-K 는
  **relevance(score)-first**, truthWeight 는 **동순위 tiebreak 또는 주입 단계**로 분리하면 F1/F2(무관
  FORMULA 가 관련 INVESTIGATION/저score FORMULA 정답을 truthWeight 로 누름)를 근본 해소. **단 CO-3 단일
  진실원 + /api/search baseline 공유** → **ADR 필수**(comparator 분기 or 신규 graph 전용 re-ranker) +
  baseline 전면 회귀 + Pass2 규칙 재해석(주입 순서는 보존, 검색 랭킹만 분리). blast radius 大 = 별도 결재.
- **PITR**: (A) graph 전용 re-ranker 신설(baseline comparator 불변) vs (B) comparator 에 mode 파라미터 vs
  (C) score 정규화로 truthWeight 영향 축소. 권고 = **A**(baseline 격리 보존, /api/search 불변 계약 준수).

### Phase 3 — 데이터(BATCH) 엣지 밀도 보강 (콘텐츠 트랙, 병렬)

> F3 의 **data 부분**(자기부담금류) = 알고리즘 불가. graph multi-hop 천장을 올리려면 엣지 밀도 보강.

- **누락 의미 엣지 인코딩**: 예 `INS-27 --DEPENDS_ON--> CONCEPT-023(자기부담금)`(공식이 자기부담금 사용
  = 의미상 마땅하나 미인코딩). 후보 = 각 FORMULA/INSURANCE 노드의 description 내 참조 개념을 엣지화.
  - ⚠️ **Hard Limit**: knowledge_edges 는 loader 경유만(Year-1 정책, ad-hoc INSERT 금지) + ontology lock
    - draft→인간검수→approved + Temporal(SUPERSEDES). = **신규 BATCH 보강 작업**(L3·별도 결재·환각 차단).
  - 측정 연동: 엣지 보강 전후 동일 golden 재측정으로 **엣지 밀도 → graphOnlyRecovery** 인과 정량.
- **천장 정직**: 이 트랙은 수작업 BATCH 품질에 종속(자동 아님). graph 가치는 엣지 밀도와 함께만 오른다.

## 4. PITR 요약 (권고 default — 진산 1줄 조정 가능)

| Phase      | 권고                                          | 근거                                                                    |
| :--------- | :-------------------------------------------- | :---------------------------------------------------------------------- |
| 0a depth   | depth1 기본                                   | 측정: depth2 순손실 확정. 무관 변수 0                                   |
| 0b golden  | N≥20~30 확대 후 재측정                        | N=1 과적합 차단(하드 게이트)                                            |
| 1 L1 범람  | USES_FORMULA depth1 한정                      | 측정 F1 직격·최보수                                                     |
| 1 L3 도달  | inbound 1-hop 양방향                          | batch 검증: F-103→INS-27 회수, CPU 최소                                 |
| 1 L4 seed  | type round-robin                              | seed 품질 = vector 종속 완화                                            |
| 1-D 비교군 | D안: graph 동결 + lexical fusion (D-B 재사용) | F2(0.02차 변별 불능) 직격·데이터 천장 비종속·매처 기실재 (결재 #7 등재) |
| 2 랭킹     | graph 전용 re-ranker(ADR)                     | baseline 격리·CO-3 준수                                                 |
| 3 데이터   | 누락 엣지 BATCH 보강                          | 자기부담금류 = algo 불가                                                |

## 5. Binary Gates (재설계 완료 판정)

- **G-R-1 (손해정지)**: depth1 기본 후 확대 golden regression=0.
- **G-R-2 (순기여)**: 확대 golden 에서 graphOnlyRecovery>0 (엣지 존재 NOT-NAMED 표적 회수) + 비-명칭 분리집계.
- **G-R-3 (무회귀)**: graph-walk.golden 6 Gate(G1-G6 depth-cap/active/edge-type/result-cap/CPU/golden) + ranking-core(NaN) + graph-search-route + user-search 테스트 전부 PASS.
- **G-R-4 (baseline 불변)**: /api/search 응답 byte-동치(comparator 미변경 — Phase 1) 또는 ADR+회귀(Phase 2).
- **G-R-5 (CPU)**: 양방향·seed 확대 후 graph-walk p95 ≤ 50ms(free) 또는 측정 후 paid 결정. depth4=41.5ms 기준.
- **G-R-6 (504 무악화)**: 재설계 후 production 504율 ≤ 현 ~20%(subrequest 증가 = 800ms 예산 압박 감시).

## 6. 위험·회귀 표면 + CPU 예산

- **회귀 표면**: graph-search-route.ts(병합·시드·depth), graph-walk/index.ts(순회·방향·화이트리스트),
  user-search.ts:330(comparator — Phase 2 만). 테스트: graph-walk.golden(6 Gate)·ranking-core·route·user-search.
- **CPU**: free 50ms. depth4=41.5/depth5=67.3ms(초과). 양방향=recursive CTE +1, seed 5→10=walk ×2. MATERIALIZED
  CTE(D-2, 195→67ms) **유지 의무**. 예산 내 검증 = G-R-5.
- **ADR-008 800ms / 504 ~20%**: subrequest 추가가 timeout 예산 압박 → 504율 악화 위험(G-R-6). 별건 운영 부채.
- **Hard Limit 준수**: examId/EXAM_IDS(Rule16/17), 동적 truth_weight 금지, LLM 수식계산 금지(hop감쇠 = 상수
  literal), approved-only 순회(CO-4), 엣지 화이트리스트 ≤16, MAX_DEPTH=4·resultCap=500, truncated surface 보존.

## 7. 시퀀싱 (의존)

```
Phase 0a(depth1, 즉시·단독결재) ──┐
Phase 0b(golden 확대) ───────────┼─→ [확대 측정 재현?] ─yes→ Phase 1(보수 algo) ─→ [잔존?] ─yes→ Phase 2(ADR 랭킹)
Phase 3(BATCH 엣지, 병렬·독립) ──┘            │               no→ 재설계 재검토(진산 보고)
                                              └─→ Phase 1-D(D안: lexical fusion·graph 동결, 결재 #7 등재·0b 선결)
                                                  — Phase 1 과 동일 확대 golden 병렬 비교 측정
                                                  → D안 vs graph 재설계 결과로 #8(GO/NO-GO) 재상신
```

## 8. 측정 ROI 정직 (감사 "시기상조"와 정합)

- 현 측정: graph 순손실(depth2)~무익(depth1), graphOnlyRecovery 0. **단 실패가 튜닝·데이터 형상**이고
  **N=1**이라 "원리 사망"은 미증명. Phase 0(손해정지)은 무조건 이득. Phase 1+ 투자는 **Phase 0b 확대
  측정이 문제를 재현해야** 정당 — 아니면 graph 보류가 더 정직할 수 있다.
- ROI 의 상한은 §0 Reality Anchor 2(데이터 천장)·3(seed 품질)에 묶인다. graph 가 vector 를 _이기는_ 게
  아니라 *보완*하는 영역(엣지 존재 NOT-NAMED 표적)이 실재하는지를 확대 측정이 판정한다.

## 9. 진산 결재란 (RULE #5 — AI 판정 금지)

```
[x] Phase 0a (depth1 기본화)        — ★결재 #6 (진산 2026-06-11 "추천한 것으로") + 집행 완료: 엔진 DEFAULT_MAX_DEPTH 2→1 (plan 문언 "route override" 와 동등·더 보수 — 직접 호출자까지 보호, 리뷰 m-3). 4-Pass C0/M2 해소. G-R0a **완료** (2026-06-11): Worker 재배포(8d2e6ea3) 후 REMOTE 재측정 — hit-rate 83.3/83.3 Δ0.0%·regression 0 (`s5-6-remote-g-s5-2026-06-11-0549.md`). **Phase 0a 완료.**
[x] Phase 0b (golden N≥20~30 확대)  — ★결재 (진산 2026-07-02 "권고대로") + "진행". 메인 구축 착수(draft-only·순환편향 차단·진산 검수 후 동결). 4c 잣대 강화 3종(빌더 일반화·expandedNodes·500자 천장) 게이트 병합.
[ ] Phase 1 (보수 algo: L1·L3·L4)   — Phase 0b 재현 후. PITR 권고 채택/조정: ____________
[ ] Phase 1-D (D안: graph 동결+lexical fusion) — 비교군 **등재는 결재 #7 ☑(2026-06-11) 집행 완료(2026-06-12)**. 구현 착수 = 본 체크 + 상세 plan 별건(L3 검색 경로). PITR D-A/D-B/D-C 권고 채택/조정: ____________
[ ] Phase 2 (ADR 랭킹 분리)         — Phase 1 잔존 시. ADR 선작성 후 별도 결재.
[ ] Phase 3 (BATCH 엣지 보강)       — 콘텐츠 트랙. 별도 결재(loader·검수·환각 차단).
[ ] 보류(graph 현 상태 동결)        — 확대 측정 전까지 depth1(0a)만 적용하고 투자 보류. ※ Phase 1-D 와 구별: 본 체크 = lexical 투자(D안)도 보류 → #8 재상신 전제(D안 vs graph 비교 측정) 정지.
```

- **코드 착수 = 위 체크 + 진산 "진행" 후**(L3, 자율 금지). depth1(0a)·golden(0b)은 저위험 → 우선 권고.
- 각 Phase 완료 = 해당 Binary Gate + 4-Pass(코드정합) + 재측정. "완료" 선언은 출력물(재측정 리포트) 확인 후.
