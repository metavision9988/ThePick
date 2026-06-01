# S5-7 — A 정상경로(`/api/search` Stage 2.5) graph 통합 **결재 자료**

> **본 문서 = 결재 자료(설계/리스크)만. 코드 무변경.** 진산 결재
> 2026-05-16: "결재 자료(설계/리스크) 문서만 자율 작성" 경로. 구현은
> **별도 결재** (plan §4 step7 / handoff-089 / [[project_s5_6_eval_measurement_gate]]
> "S5-7 자율 금지"). 본 문서는 그 결재를 위한 의사결정 입력이다.
>
> **선결 의존(미충족 명시):** plan(graph-walk-s5-integration.plan.md §6-B)은
> A 통합 결재 근거를 **S5-6 baseline 실측 ROI**로 규정. G-S5 실측은 아직
> 진산 Cloudflare 인증 게이트 미통과 → 본 문서 §7 ROI/GO 판정은 **측정 후
> 확정되는 조건부**다. 데이터 없는 GO 결재는 plan 위배 — 본 문서는 측정 전
> 까지 "설계·리스크·CO 원장 확정"에 한정, GO 여부는 측정 후.

---

## 0. Reality Anchor — A 통합이 실패/불가할 이유 3가지 (먼저)

1. **정상 경로 = 최대 회귀 표면 + 학습자 직노출.** `/api/search` 는
   학습자 1급 경로(routes.ts:68). graph-walk(depth4 ≈ 41.5ms 실측,
   measurement.md §3.1)를 Stage 2.5 로 삽입하면 ADR-008 800ms 예산 +
   Workers CPU(free 50ms) 내 baseline(Stage1+2+3) + graph-walk + 재정렬
   누적이 동시 발생. 시드 5 직렬 재귀(CO7-1, ~207ms)면 free tier 초과 →
   production 사망. **CO7-1(단일 CTE) 선결 없이는 A 불가.**
2. **ROI 미입증 상태에서 정체성 압박으로 강행 위험.** Pattern A 가치는
   "정상 경로 multi-hop"에서 발현(plan §6-B). 그러나 옵션 C 가 데이터
   측정용으로 설계된 이유 = "정답률 개선이 실제로 있는지 모름". G-S5
   graphOnlyRecovery 가 미미하거나 regression 이 크면 A 통합은 **순손실**
   (지연·CPU·복잡도 ↑, 정확도 ↔/↓). 측정 없이는 ROI 음수 가능성 배제 불가.
3. **graph-search-route 응답 계약이 내부 타입 통째 노출.** `GraphSearchResponse`
   가 `UserSearchResult`/`UserSearchHit` 를 그대로 surface(CO7-3). 정상
   경로 통합 시 학습자 클라이언트가 이 형상에 lock-in → 이후 내부 리팩터
   가 공개 계약 파괴. schemaVersion + 명시 projection(CO7-3) 선결 없이는
   계약 부채 영속.

→ 결론: A 통합은 **CO7-1·CO7-3 선결 + G-S5 ROI 양수 입증 + 회귀 표면
통제(플래그·롤백)** 3중 충족 시에만. 본 문서는 그 조건을 기계적으로 고정.

## 1. 현 상태 (실코드 기준)

- **정상 경로**: `routes.ts:65` `createUserSearchRoutes` →
  `routes.ts:111` `searchKnowledgeNodesForUser`(user-search.ts: Stage1
  vector → Stage2 `fetchApprovedNodes` → Stage3 `compareByTruthWeightThenScore`)
  → `routes.ts:123` graceful/stage2=0 시 `runMultiPathFallback` → 아니면
  `routes.ts:142` `return c.json(result)`.
- **옵션 C(기구축)**: `graph-search-route.ts` `/api/search/graph` 가 A
  파이프라인을 **이미 격리 구현** — baseline(searchKnowledgeNodesForUser
  재사용) + graph-walk N-hop + buildHit + compareByTruthWeightThenScore
  병합. S5-7 = 이 검증된 파이프라인을 정상 경로에 _조건부_ 접합.
- **측정 도구(기구축)**: S5-6a harness(`apps/api/src/eval/multihop-accuracy.ts`
  - `scripts/measure-s5-6-multihop-accuracy.ts`). G-S5 실측만 인증 게이트.

## 2. 통합 지점 (PITR — ★ 결재 핵심, 코딩 전 결정)

A 정상경로 통합의 _접합 방식_ 3안. 통합 위치는 `routes.ts:111`
(`searchKnowledgeNodesForUser` 반환) 직후 ~ `routes.ts:142`
(`return c.json(result)`) 전, **graceful/stage2=0 아닌 healthy 경로만**
graph 확장(graceful 은 fallback 소관 — 시드 0이라 graph-walk 무의미).

| 안                                | 접합 방식                                                                                                                | 장점                                                                     | 단점                                                      | 회귀 표면    |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- | :-------------------------------------------------------- | :----------- |
| **A-1 인라인 치환**               | routes.ts healthy 분기에서 graph-walk 확장 → result.results 증강 후 c.json                                               | 정체성 완전 회복(단일 경로)                                              | 회귀 표면 최대. 롤백=재배포. 측정 격리 상실               | ★★★ 高       |
| **A-2 플래그 게이트 병렬** (권고) | 동일 접합점이나 `GRAPH_AUGMENT_ENABLED`(env/KV) 플래그. off=현 동작 byte-identical, on=graph 증강. 점진 롤아웃(%·examId) | 롤백=플래그 toggle(무배포). off 회귀 표면 0. A/B 측정 정상 경로에서 지속 | 플래그 인프라. on 경로 회귀 표면은 A-1 동일               | ★★ 中 (on만) |
| **A-3 섀도 모드**                 | healthy 경로는 현 result 반환(불변) + graph 확장은 비동기 telemetry 만(응답 미반영)                                      | 회귀 표면 ~0. 실트래픽 ROI 측정                                          | 학습자 가치 미발현(정체성 미회복). ctx.waitUntil CPU 비용 | 低           |

→ **권고: A-3 섀도 → A-2 플래그 게이트 → (데이터 누적) 전량.** 섀도로
실트래픽 graphOnlyRecovery/regression/지연 분포 무위험 수집(G-S5 보강) →
플래그로 통제 롤아웃 → 데이터로 전량 결재. A-1 단독 기각(롤백=재배포 =
학습자 노출 사고 시 복구 지연). **최종 선택 = 진산 결재 §8.**

## 3. 회귀 표면 (정상 경로 — 변경 시 학습자 직격)

- **ADR-008 graceful/timeout**: graph-walk 가 800ms 예산 잠식. 시드별
  재귀 CTE 누적이 timeout→504 유발 시 학습자 검색 실패. 완화: CO7-1
  단일 CTE + graph-walk 자체 fail-loud 를 정상경로에서는 **graceful
  degrade**(graph 실패 시 baseline 반환)로 전환할지 = 설계 결정(옵션 C는
  fail-loud, 정상경로는 학습자 UX상 graph 실패≠검색 실패여야 → 분기 정책
  명문화 필요, CO6 mid-loop 계약과 상충 검토).
- **Multi-Path Fallback 상호작용**: `routes.ts:123` 분기는 graph 증강
  *전*이어야(시드=approved 필요). 증강이 fallback 진입 신호(stage2Count)를
  변조하면 안 됨 — graph 확장은 result.results 만 증강, gracefulDegradation
  /stage2Count 불변 보장 계약 필요.
- **rate limiter 공유**: `routes.ts:72` `SEARCH_RATE_LIMITER_IP` 공유.
  graph 증강은 동일 요청 내라 추가 호출 없음(시드 walk 는 D1) → limiter
  영향 중립. 단 expensive 경로 별도 limit 은 L-1(launch 게이트).
- **응답 계약**: 정상 경로 `c.json(result)`(UserSearchResult). graph
  증강 시 results 에 score=0 확장 hit 혼입 → 학습자 클라가 score 의미
  가정 시 표시 왜곡. CO7-3 schemaVersion + 명시 계약 선결.
- **stripStage3Diagnostics**(routes.ts:138 telemetry leak 차단): graph
  메타(seedWalkCount/expandedNodeCount/truncated) 가 production 응답에
  노출되면 infra fingerprinting. 정상경로 통합 시 graphExpansion 메타
  strip 정책 = 신규 결정.

## 4. CPU·지연 예산 (정량 — 측정 의존)

- 실측 기준선(measurement.md §3.1, **CO6 전 5컬럼**): MATERIALIZED
  depth4 WL12 = 41.5ms(단일 시드). **CO6 후 description projection +
  MIN() 집계 재측정 미완 = Pass2 m-2 in-scope** — A 결재 전 실 D1 1회
  재측정 필수(전제 갱신).
- 시드 5 직렬(현 graph-search-route 루프) ≈ 5 × 단일 ≈ CO7-1 미해소 시
  ~207ms → free 50ms 대폭 초과. **CO7-1(다중 anchor 단일 CTE, ~42ms
  추정) = A 통합 hard 선결.**
- baseline(Stage1 Vectorize + Stage2 D1 + Stage3) + graph-walk +
  병합·재정렬 누적이 ADR-008 800ms wall + Workers CPU 한도 동시 충족
  여부 = G-S5 측정 세션에서 elapsedMs(CO6-3 telemetry) 분포로 실증.

## 5. CO 통합 원장 (S5-7 결재 = 본 원장 처리 계획 확정)

본 원장 미해소 항목은 A 통합 결재의 **선결/동반 조건**. 출처:
review-20260515-202957 §4 + CO6/S5-6a 리뷰 누적.

### 선결 (A 구현 전 필수)

- **CO7-1 (perf M1, hard)**: 5-seed 직렬 재귀 CTE → 다중 anchor 단일
  CTE 1쿼리(`walk` UNION dedup 이 다중 시드 흡수). 직렬 ~207ms→~42ms.
  **미해소 시 정상경로 CPU 사망 → A 불가.**
- **CO7-3 (backend M-1)**: `GraphSearchResponse` `schemaVersion` + 명시
  baseline projection. 내부 `UserSearchResult/Hit` 통째 노출 = 학습자
  계약 lock-in 차단. 정상경로 노출 전 필수.
- **CO-6a-3**: `GraphSearchResponse extends GraphSearchResponseShape`
  컴파일 가드(consumer-driven contract) — harness 가 측정하는 형상과
  실 응답 drift 시 G-S5 무효. A 통합으로 응답 변경되므로 동시 처리.
- **Pass2 m-2 (CO6 리뷰)**: description projection + MIN() 집계 후 D-2
  실 D1 1회 재측정 → measurement.md §3.1 각주(CPU 전제 갱신). §4 예산
  판정의 데이터 근거.

### 동반 (A 구현과 함께)

- **CO7-4 (backend M-2 / refactor)**: `search-core` 모듈 추출 —
  `buildHit`/`fetchApprovedNodes`/`compareByTruthWeightThenScore`/
  `ApprovedNodeRow` 가 route 내부→de-facto SDK. rate-limit guard 공통화
  (routes.ts↔graph-search-route 중복 = CO-4 교리 위배). graph-search-route
  catch `graph_search_baseline_failed` 오분류(실은 expansion fetch 실패)
  동반 정정.
- **CO7-5 (backend M-3)**: `candidateFilter: string` raw 결합 → 구조적
  타입 계약(`{sql; bindCount}` 또는 typed predicate).
- **CO6 리뷰 m-1**: `truncated` per-seed count(현 OR 집계) — 정상경로
  학습자 노출 시 절단 표본 해석 정밀도.

### 성능(롤아웃 전 권장) / Launch 게이트(진산 자원)

- **CO7-2 (perf M3)**: Cache API/KV — embedding + walk subgraph(정적
  토폴로지·결정적). Zipfian 10K 스케일 결정 인자. 전량 롤아웃 전 권장.
- **L-1 (perf C1, launch 게이트)**: 전용 `GRAPH_SEARCH_RATE_LIMITER_IP`
  namespace(낮은 limit). 학습자 노출(A) 전 필수. wrangler.toml namespace
  = **진산 Cloudflare 자원 결정** (자율 provision 불가).

## 6. Binary Gates (S5-7 완료 판정 — 측정 후 적용)

| Gate             | 입력                             | 기대 출력                                                          | 판정           |
| :--------------- | :------------------------------- | :----------------------------------------------------------------- | :------------- |
| G-S7-1 회귀 0    | 플래그 off, 기존 api 전체 테스트 | 현 동작 byte-identical(643+ PASS 유지)                             | 기계 비교      |
| G-S7-2 ROI 양수  | G-S5 실측                        | graphOnlyRecovery > regression + hit-rate Δ > 0 (절단제외)         | 측정값(§7)     |
| G-S7-3 CPU 예산  | 실 D1, 시드5, CO7-1 후           | depth4 누적 < free 50ms (or paid 결재)                             | 실측 elapsedMs |
| G-S7-4 graceful  | graph-walk 실패 주입             | 정상경로 baseline 반환(검색 무중단) — fail-loud→graceful 전환 검증 | 기계           |
| G-S7-5 계약 lock | schemaVersion + 컴파일 가드      | GraphSearchResponse extends Shape 컴파일 통과 + 버전 surface       | 코드+테스트    |
| G-S7-6 롤백      | 플래그 toggle off                | 무배포 즉시 현 동작 복귀                                           | 운영 검증      |

→ G-S7-1·3·4·5·6 = 코드/측정 게이트. **G-S7-2(ROI) = G-S5 실측 의존
= 인증 게이트.** 전 PASS 전 A 전량 금지.

## 7. ROI / GO 판정 (✅ G-S5 1차 실측 완료 2026-06-01 — NO-GO 방향)

> plan §6-B: "데이터로 A 통합 ROI 입증 후 A 결재". **G-S5 1차 실측 완료**
> (`s5-6-remote-g-s5-2026-06-01-1242.md`, 분석 `s5-6-g-s5-analysis.md`).
> production Worker `07b5f47d` 배포 후 측정. **결과 = NO-GO 방향** (아래).

판정 규칙(측정 후 적용):

- **GO**: graphOnlyRecovery 유의미(절단제외 기준) ∧ regression 작음 ∧
  hit-rate Δ > 0 ∧ CPU 예산 충족(G-S7-3) → A-2/A-3 단계 도입 결재.
- **CONDITIONAL**: ROI 미미하나 양수 → 섀도(A-3) 지속 + 특정 문항군
  (multi-hop 의존)만 선별 적용 검토.
- **NO-GO**: regression ≥ graphOnlyRecovery 또는 hit-rate Δ ≤ 0 →
  A 통합 기각, 옵션 C 격리 유지(정체성 미회복 명시 trade 영속). 자원
  낭비 방지 — 측정이 기각을 말하면 기각.

### 7.1 G-S5 1차 실측 결과 (사실 — RULE #5: 결정은 진산)

| 지표 (절단제외, measured=3) | baseline (vector) | graph |             Δ |
| :-------------------------- | ----------------: | ----: | ------------: |
| hit-rate                    |              100% | 66.7% |    **−33.3%** |
| mean recall                 |             73.3% | 66.7% |         −6.7% |
| graphOnlyRecovery           |                 — |     — |         **0** |
| regression                  |                 — |     — | **1 (Q-012)** |

(전체 measured=4: hit-rate Δ −25%, graphOnlyRecovery 0, regression 1.)

- **판정 매핑**: graphOnlyRecovery 0 ≤ regression 1 ∧ hit-rate Δ < 0 →
  **§7 NO-GO 분기 해당** (CONDITIONAL "양수" 조건 미충족).
- **원인 (raw 적대 검증, 분석 §2)**: graph 확장이 Formula 노드(F-xx) 과다
  유입(expandedNodeCount 6~53)으로 정답 후보 축출. Q-012 = baseline 이 회수한
  INV-035 를 재정렬이 top5 밖으로 밀어내고 전부 F-노드로 교체.
- **부수 수확**: baseline(vector-only) hit-rate 100% = 🟢 Vector RAG 바닥 재확인.

### 7.2 신호 한계 (과대해석 금지)

- **N=4 measurable** (query>500 measurable 3건 제외 후, 진산 결재 2026-06-01).
  통계 일반화 불가 — 신호 방향만. 측정 4건 중 3건이 단일-hop LAW(graph 무관),
  multi-hop 의존은 Q-012 1건뿐인데 regression.
- 현 graph 파라미터(maxDepth 2, edge whitelist 12) 결과 — **"현 설정에서 순손실"**
  이 정확한 서술 (알고리즘 자체 사망 단정 아님). 재시도 선결 = F-노드 유입 억제
  - multi-hop 표본 확대 (별도 plan·결재).
- CPU 예산(G-S7-3)은 정확도 측정으로 미산출 — 별도.

### 7.3 진산 결재 대기 (GO/NO-GO)

- [ ] **NO-GO 확정** (권고 방향) — 옵션 C 격리 유지, "Vector RAG 로 출시"(🟢 바닥).
      graph-walk 매몰 최소(격리). feasibility R5 기록.
- [ ] **CONDITIONAL** — N 확대(30~50, multi-hop 가중) + F-노드 억제 후 재측정
      하고서 재판정 (graph 1회 더 기회).
- [ ] 기타 (진산 지시).

## 8. 진산 결재 체크포인트 (S5-7-0)

> ✅ **G-S5 1차 실측 완료 (2026-06-01)** → §7.3 GO/NO-GO 가 **1차 결재 항목**으로
> 부상. 측정 결과 = NO-GO 방향(§7.1). 아래 1~3(통합 방식/선결/L-1)은 §7.3 에서
> GO 또는 CONDITIONAL 결정 시에만 유효 — NO-GO 확정 시 전부 보류(옵션 C 격리 유지).

0. **★ GO/NO-GO (§7.3 — 1차)**: NO-GO 확정(권고) / CONDITIONAL(재측정) / 기타.
1. **통합 방식(§2)**: A-3 섀도→A-2 플래그→전량 (권고) / A-2 직행 /
   A-1 인라인 / 기타. _(GO/CONDITIONAL 시에만)_
2. **선결 순서**: CO7-1·CO7-3·CO-6a-3·Pass2 m-2. _(GO/CONDITIONAL 시에만)_
3. **L-1 rate limiter namespace**: 진산 Cloudflare 자원. _(GO 시에만)_

→ **§7.3 GO 없이 A 코드 착수 금지**(자율 금지 영속). NO-GO 시 graph-walk
매몰 최소(옵션 C 격리) — 측정 기반 의사결정의 정상 산물(§9).

## 9. 잔존 위험 / trade-off

- 옵션 C 격리 유지 기간 동안 Pattern A 정체성 미회복(plan §5 명시 trade).
- 섀도 모드 ctx.waitUntil CPU 비용 — Workers 한도 내 검증 필요.
- 플래그 인프라(KV/env) = Cloudflare 단일 벤더 정합([[feedback_single_vendor_cloudflare]]).
- G-S5 가 NO-GO 면 본 문서 §1~6 설계 노력은 "기각 근거"로 전환(매몰
  아님 — 측정 기반 의사결정의 정상 산물).
