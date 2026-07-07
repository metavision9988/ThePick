# Phase 1-D — lexical fusion 비교군 상세 plan (D-B: keyword-fallback 매처 re-rank tiebreak 재사용)

> **STATUS: APPROVED-ENTRY(§9 1-D GO 2026-07-07) · L3(검색 경로) · 구현 = 본 plan 독립 리뷰 후**
> 진입 결재 원문: `docs/plans/graph-walk-s5-8-redesign.plan.md:213` §9 "[x] Phase 1-D — 구현 착수 GO
> (진산 결재 2026-07-07 'b로 진행') + PITR 채택 = **D-B**(기존 keyword-fallback 매처를 re-rank
> tiebreak 로 재사용)". 설계 골격 = 동 plan §3 Phase 1-D(:104~130).
> 존재 이유: 3차 실측(`s5-6-measurements/g-s5-v2-facts-20260707.md`) — baseline 73.7% / graph
> depth1 −5.3%·depth2 −15.8% 순손실 / **graphOnlyRecovery 0 3연속**(06-01·06-05·07-07). "graph 없이
> lexical 신호로 벡터를 보완 가능한가"를 **동일 golden v2 로 비교 측정 → MASTER_PLAN §6 #8 GO/NO-GO 재상신**.

## §0 Reality Anchor (측정 전 단언 금지 — G-1)

1. **한국어 형태소 부재 naive 매칭의 위양성/위음성**: 매처는 D1 LIKE substring + 조사 제거 패턴뿐
   (`keyword-fallback.ts:2-6` D-MPF-1=A 채택, 형태소 분석기 미사용 — `:60-61` 조사 정규식이 커버 한계
   명문). 어미 변화 미대응 → lexical 천장 유한. "표적 회수" 여부는 **측정 전 단언 불가**.
2. **tiebreak 가중 = 사실상 랭킹 변경 위험 (baseline 오염 경계)**: lexical score(일치 토큰 비율
   0~1, `keyword-fallback.ts:165-166`)와 vector cosine 은 **비가환 스케일** — 혼합 합산 금지.
   graph 모드의 확장노드 score=0 관례(`graph-search-route.ts:325-339`)와 동일하게, lexical 은
   **동순위(ε-band) tiebreak 보조키로만** 개입. ε 상한 없으면 "tiebreak"이 랭킹 정책 교체로 변질.
3. **측정 공정성 — 순환 리스크 (필수 축)**: golden 라벨의 명칭-동형 아티팩트는 **lexical 에 구조적으로
   유리**(vector 도 수혜였음이 06-05 실측: queryBody 정화로 baseline 100→83.3% 하향 — CLAUDE.md
   2026-06-05 갱신 (4)). LIKE name-매칭은 이 아티팩트의 직격 수혜자 → lexicalOnlyRecovery 를
   NAMED/NOT-NAMED 세그먼트 분리 없이 보고하면 과대해석. G-1D-5 로 차단.
4. **회수 상한 = keyword top-10 + NOT-NAMED 구조적 0**: lexical 신호는
   `KEYWORD_FALLBACK_MAX_TOP_K=10`(`keyword-fallback.ts:33`) 상한 + query 토큰이 name/description 에
   비포함(NOT-NAMED)인 표적은 **구조적 회수 0**. graph 와 실패 표면이 다를 뿐 만능 아님.
5. **순수 tiebreak(정확 동점만)은 자기무력**: F2 실측(s5-8 plan:117-120)은 0.63 vs 0.65 =
   Δ0.02 — 정확 동점 아님. 엄밀-동점 한정 tiebreak 는 측정상 no-op 에 수렴할 개연 [추정] → ε-band
   설계 필수(§2). 단 ε 는 provenance 각인 + 상한 고정(Anchor 2).

## §1 실코드 discovery (전부 실측 — file:line)

- **매처 실물 (D-B 재사용 대상)**: `apps/api/src/search/multi-path-fallback/keyword-fallback.ts`
  - `tokenizeQuery(query): ReadonlyArray<string>` — :73-84 (공백 토큰화 + `\p{P}\p{S}` 제거 + 조사 strip, 최소 2자).
  - `runKeywordFallback(db, examId, query, topK=10): Promise<KeywordFallbackResult>` — :92-180.
    반환 `results: UserSearchHit[]` (score = 일치토큰비율, :161-173) + `matchedTokens`.
  - status 도출 = `buildApprovedNodesQuery` 단일 진실원 공유(CO-4) — :197-206. **수정 0 으로 재사용**(신호 = results 의 id→score Map).
- **현 소비처 = fallback Stage 2 한정**: `multi-path-fallback/index.ts:66`(runMultiPathFallback) ←
  `routes.ts:123-130`(gracefulDegradation ∨ stage2Count=0 시에만 진입). **정상 경로 랭킹 lexical 융합 = 0건**(user-search.ts 무결합) — s5-8 plan:114-116 확인과 일치.
- **비교군 주입 지점**: `graph-search-route.ts` — 격리 `/api/search/graph`(mount `index.ts:164`,
  `/api/search` 는 :165 별개 exact-path). Body 스키마 :100-136(examId/query/topK/maxDepth/resultCap/debug).
  baseline = `searchKnowledgeNodesForUser` 재사용 :249-251(정상 경로 함수 불변) → graph walk 루프
  :304-323 → 병합 `[...baseline.results, ...expandedHits].sort(compareByTruthWeightThenScore)` :343.
  응답 shape :177-186 `{query, examId, topK, baseline, graphExpansion, results}`.
- **랭킹 단일 진실원**: `user-search.ts:370-373` `compareByTruthWeightThenScore`(truthWeight DESC →
  score DESC) + CO-3 계약 주석 :361-368("정상/graph 경로에 2번째 truth_weight 정책 생성 금지").
  `buildHit` :375-392. `DEFAULT_RESULT_TOP_K=3`/`MAX_RESULT_TOP_K=10` :84-87.
- **측정 하네스**: `scripts/measure-s5-6-multihop-accuracy.ts` — requestBody :192-205(maxDepth/debug 는
  **미지정 시 키 자체 생략 = 종전 측정 byte-동치** 패턴 :203-205). 채점 코어
  `apps/api/src/eval/multihop-accuracy.ts:85-88` `GraphSearchResponseShape` 는 `baseline.results[].id`
  - `results[].id` 만 소비(:141-158) → **응답 shape 만 유지하면 코어 무변경으로 lexical 모드 채점**.

## §2 설계 — D-B 배선 (격리 mode 파라미터)

1. **스키마 additive**: `GraphSearchBodySchema`(graph-search-route.ts:100)에
   `mode: z.enum(['graph','lexical']).default('graph')` 추가. **default='graph' = 기존 계약
   byte-동치**(G-1D-2). 요청 예: `POST /api/search/graph {..., "mode": "lexical"}`.
2. **mode='lexical' 경로** (graphWalk 호출 0 — graph-walk 모듈 무접촉):
   - baseline = 기존 :249-251 그대로(topK 요청분) → 응답 `baseline` 필드 **불변 보존**(A/B 격리, graph 모드와 동일 구조).
   - **후보 풀 확대**: 동일 `precomputedEmbedding` 재사용, `searchKnowledgeNodesForUser`
     pool-K=`MAX_RESULT_TOP_K`(10) 1회 추가 호출 [비용 정직: Vectorize query +1/req, 측정 경로 한정].
     F2 표적(vector rank6 F-103류)은 풀 확대 없이는 재정렬 무대상(Anchor 5). 1회-호출 슬라이스 최적화는
     baseline-동치 테스트 증명 시에만 허용.
   - **lexical 신호**: `runKeywordFallback(db, examId, query)` → `Map<nodeId, lexScore>`.
   - **병합**: pool ∪ lexical-only hits(교집합 = vector hit 우선, CO6-4(a) 관례 :319 준용.
     lexical-only 는 `buildHit(src, 0)` — score 0).
   - **re-rank tiebreak 비교자**(신규, 본 route 파일 내 격리): 1차 = `compareByTruthWeightThenScore`
     결과 그대로. 단 **동일 truthWeight ∧ |Δscore| ≤ ε** 이면 lexScore DESC 로 재판정, 그마저 동일하면
     원 비교자 순서 유지. **ε=0.03 고정**(F2 실측 Δ0.02 직격 + tiebreak 의미 보존 상한, 리포트 provenance
     각인). CO-3 방어: truthWeight-first 정책은 단일 진실원 위임 불변 — lex Map 공집합 ∨ ε=0 이면 정렬
     결과가 원 비교자와 **완전 동치**임을 단위 테스트로 고정(G-1D-2b).
   - results = 재정렬 top-K. 응답 `graphExpansion` 자리 = `lexicalFusion` 메타(applied/ε/matchedTokens
     수/poolSize/lexicalOnlyCount — additive, debug 시 lexical 매칭 전체집합 surface).
3. **하네스 확장**: `--mode lexical` 플래그 → `requestBody.mode='lexical'`(미지정 = 키 생략 =
   종전 byte-동치, :203-205 패턴). coverage 각인 `mode=lexical | ε=0.03`(:217-222 maxDepth 각인 관례).
   채점 코어 무변경 — 지표명 `graphOnlyRecovery` 는 코어 유지, 리포트 해석 각주 "lexical 모드에서는
   fusedOnlyRecovery(=lexicalOnlyRecovery)" 정직 라벨(s5-8 M2 정직화 관례).

## §3 비교 측정 프로토콜

- 동일 golden = `golden-pilot-approved.v2.querybody.json`(N=34, measured 19 — facts §1). 옵션: debug
  2000자 회수 시 N=27(facts §4 ①) — 채택 시 graph 열도 동일 N 재실행(분모 동일 의무).
- 산출 3열 비교표: **vector(baseline) vs graph(depth1, 07-07 기측정) vs lexical(본 건)** —
  hit-rate@5 / mean-recall@5 / onlyRecovery / regression. baseline 열은 lexical 리포트의 baseline
  필드와 graph 리포트의 baseline 필드 **상호 일치 검산**(불일치 = 측정 무효, fail-loud).
- 결과 문서: `s5-6-measurements/s5-6-remote-lexical-*.{json,md}` + 비교표 1장 → **#8 재상신 자료**.

## §4 학습자 경로 무접촉 증명 (CO-3·baseline 불변 의무)

① diff 스코프 증명: `user-search.ts`/`routes.ts`/`multi-path-fallback/**` **변경 0**(git diff 무출현
— keyword-fallback.ts 는 exported `runKeywordFallback` read-only import). ② mount 분리:
`index.ts:164-165` exact-path 별개 — `/api/search` 핸들러 무접촉. ③ mode 미지정 회귀:
graph-search-route 기존 테스트 全 PASS + 동일 golden depth1 재실행 수치 = 07-07 리포트 동일.

## §5 Binary Gate

| Gate    | 판정 (입력→출력, 기계 판정)                                                                                                                   |
| :------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| G-1D-1  | `/api/search` byte-불변: §4① diff 0 + api 테스트 전체 PASS 회귀 0                                                                             |
| G-1D-2  | mode 미지정 = 기존 graph 계약 byte-동치: 스키마 default 테스트 + depth1 재측정 수치 == 07-07 리포트                                           |
| G-1D-2b | lex 공집합 ∨ ε=0 → 정렬 == `compareByTruthWeightThenScore` 완전 동치 (CO-3 방어 단위 테스트)                                                  |
| G-1D-3  | lexical 측정 재현성: 동일 golden 2회 연속 실행 수치 동일 (LIKE·정렬 결정적 — 재시도는 5xx timeout 한정)                                       |
| G-1D-4  | 비교표 3열 산출 + baseline 열 상호 일치 검산 PASS (§3)                                                                                        |
| G-1D-5  | 순환 공정성: lexicalOnlyRecovery 문항별 NAMED(표적 명칭이 query 토큰과 LIKE-일치)/NOT-NAMED 세그먼트 분리 보고 + golden 파일 무변경(재라벨 0) |
| G-1D-6  | CPU/latency: elapsedMs telemetry(:221-237 기존 배선)로 lexical 모드 p95 기록 — graph depth1 대비 표 동봉                                      |

## §6 비용·천장 정직

신규 표면 = route 내 mode 분기 + 비교자 wrapper + 하네스 플래그뿐(매처·채점코어·정상경로 무변경) —
graph 3종 수술 대비 저비용 [추정, 구현 전]. 천장: LIKE 한계(Anchor 1·4) → SP-T06 <85% 시 옵션
B(bge-m3 reranking) 보강 의무 조항 동일 적용(s5-8 plan:128-130). Vectorize +1 query/req 는 측정
경로(rate-limit 60/min) 한정.

## §7 결재란

```
[x] 진입 결재 — 기완료 (s5-8 §9 1-D GO, 진산 2026-07-07 "b로 진행" + D-B 채택. 본 plan = 동 결재가 명한 상세 plan)
[ ] 구현 착수 — 본 plan 독립 리뷰(4-Pass) CRITICAL 0 확인 후 자율 착수 (별도 결재 불요 — §9 GO 기부여.
    단 리뷰가 설계 갈림길급 CRITICAL 을 내면 STOP → 진산 재상신)
[ ] 비교 측정 완료 → #8(G-S5 GO/NO-GO) 재상신 — 수치 사실만 못박고 판정 = 진산 (RULE #5. AI 판정 금지)
```
