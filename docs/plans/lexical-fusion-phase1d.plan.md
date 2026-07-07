# Phase 1-D — lexical fusion 비교군 상세 plan (D-B: keyword-fallback 매처 re-rank tiebreak 재사용)

> **STATUS: APPROVED-ENTRY(§9 1-D GO 2026-07-07) · L3(검색 경로) · rev2 — 구현 = rev2 재리뷰 CRITICAL 0 후**
> **rev2 (2026-07-07, 4-Pass 독립 리뷰 C1/M5/m4 전건 반영)**: ★C-1 ε-band 쌍별 비교자 = **비추이적**(A>B>C>A 순환·sort 3종 출력 실증) → **ε-양자화 밴드키 전순서**로 교체 + G-1D-3′(순열 불변 property) 신설 / M-1 graphExpansion 채점 계약 유지(applied 의미 정의 = graph 모드와 제외집합 동일) / M-2 lexical-only 주입 폐기(★graph 를 죽인 기전의 복제 차단 — **순수 pool 재정렬**로 D-B 충실화) / M-3 NAMED 판별 = corpus read-only 조인 / M-4 실행 환경 = wrangler dev(3열 동일 환경) / M-5 ε 감도 스윕 동봉.
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
   (rev2 정직 재서술) lexical 신호는 **vector 후보 풀(pool-K)의 재정렬 보조키로만** 개입 —
   **lexical-only 후보 주입 없음**. 근거: score=0 주입 + truthWeight-first 는 graph 를 죽인 바로
   그 기전(F-노드 범람 → 정답 축출, 06-01/06-05 실측)의 복제였음(리뷰 M-2). lexical-only 히트는
   debug 관측 필드로만 surface(랭킹 무개입). ε 상한 고정 = "tiebreak"의 정책 교체 변질 차단.
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
6. **(rev2·C-1) 쌍별 ε-band 비교자는 비추이적 = sort 미정의 동작**: "in-band 쌍은 lex, out-of-band
   쌍은 score" 는 A(0.66,lex0)>B(0.62,lex1)>C(0.64,lex.5)>A 순환을 만들고(리뷰 실증: 6 순열 입력 →
   3종 출력), G-1D-3(동일 입력 재실행)로는 **못 잡는다**. → 비교키는 반드시 **원소 단독 함수**(전순서)
   여야 하며 G-1D-3′(순열 불변) property 게이트가 이 클래스를 기계 차단한다.
7. **(rev2·M-5) ε=0.03 은 측정셋 유래(F2 = golden v2 채점 문항) = train-test 누출 클래스**: 일반화
   근거 아님 — ε ∈ {0.01, 0.03, 0.05} 감도 스윕 동봉 + 리포트 해석 각주 의무.

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

## §2 설계 — D-B 배선 (격리 mode 파라미터) [rev2 개정판]

1. **스키마 additive**: `GraphSearchBodySchema`(graph-search-route.ts:100)에
   `mode: z.enum(['graph','lexical']).default('graph')` + `eps: z.number().min(0).max(0.1).default(0.03)`
   (eps 의 '수용' = **graph 경로는 eps 미독(무시)** — 거부 아님(rev3 m-N2: default 주입과 사용자 송신 구분 불가). 감도 스윕(M-5)·동치 테스트 전용. mode='lexical' 은 debug=true 필수라 비-debug lexical 은 400 — '비-debug 고정' 문언은 사문 삭제(m-N5)). **mode 미지정 = 기존 계약 byte-동치**(G-1D-2). (m-3) mode='lexical' 은
   `debug=true` 필수 — 측정 전용 명시 게이트(공개 남용 표면 차단, rate-limit 60/min 병행).
2. **mode='lexical' 경로** (graphWalk 호출 0 — graph-walk 모듈 무접촉):
   - baseline = 기존 :249-251 그대로(topK 요청분) → 응답 `baseline` 필드 불변 보존.
   - **후보 풀**: 동일 `precomputedEmbedding` 재사용, pool-K=`MAX_RESULT_TOP_K`(10) 1회 추가 호출
     [비용 정직: Vectorize +1/req — debug 측정 경로 한정]. **lexical-only 주입 없음**(rev2 M-2:
     score-0 주입+truthWeight-first = graph 독성 기전 복제 — 폐기. 재정렬 대상 = vector pool 만).
   - **lexical 신호**: `runKeywordFallback(db, examId, query)` → `Map<nodeId, lexScore>` (read-only).
   - **★재정렬 = ε-양자화 밴드키 전순서**(rev2 C-1 — 쌍별 ε-band 는 비추이적·폐기):
     정렬키 = `(truthWeight DESC, band DESC, lexScore DESC, score DESC)` where
     `band = eps > 0 ? Math.floor(score / eps) : score`. 전 키가 **원소 단독 함수** → 추이성 보장.
     성질(rev3 정밀화 — 재리뷰 M-N1): (a) **lex 전원 0 → 완전 동치**(동점 포함 전 케이스·ε 무관,
     2,400 시행 실증) / **ε=0 → 정확 동점 제외 동치**(동점에서 lex 개입 = 순수 tiebreak 의도 동작 —
     CO-3 위반 아님·경로 격리. 동치 assert 픽스처는 lex-0 계열, ε=0 동점-lex 개입은 별도 의도 테스트) (b) 경계쌍 비대칭(0.599 vs 0.601 이 다른 band) = 양자화의 대가 —
     문서화 수용(리뷰 수리안 (i) 채택 사유: 결정성 > 경계 정밀. 순열 불변 실증 리뷰 프로브 기확인).
     tie 최후 = 안정 정렬 입력순(원 비교자와 동일 관례 — m-1 확정).
   - results = 재정렬 top-K(요청 topK).
3. **응답 계약 (rev2 M-1 — 채점 코어 호환 유지)**: `graphExpansion` 필드 **유지**(제거·개명 금지 —
   `multihop-accuracy.ts:85-89` 가 `{applied, truncated}` 필수 소비·:136 no_seed 분모 제외).
   lexical 모드 의미 정의: `applied = baseline.results.length > 0`(graph 모드의 no_approved_seed
   조건과 **동일 술어** → 제외집합 = graph 열과 구성적 동일), `reason='no_approved_seed'`(동일),
   `truncated=false` 고정, `seedWalkCount=0`·`expandedNodeCount=0`·`edgeTypeWhitelist=[]`·`maxDepth=0`·`resultCap=0`(no-seed 분기 관례 준용 — rev3 m-N3).
   lexical 메타는 **additive 필드 `lexicalFusion`**: {eps, poolSize, lexMatchedCount,
   displacedBaselineHits(top-K 에서 pool 재정렬로 밀려난 원 baseline hit 수 — M-2(iii) regression
   귀속용), matchedTokens, (debug) lexicalOnlyObserved(랭킹 무개입 관측 전용)}.
4. **하네스 확장**: `--mode lexical` 플래그 → `requestBody.mode='lexical', debug=true` +
   `--eps` (스윕용). 미지정 = 키 생략 = 종전 byte-동치(:203-205 패턴). coverage 각인
   `mode=lexical | eps=N`(:217-222 관례). 채점 코어 무변경 — graphOnlyRecovery 지표명은 코어 유지,
   리포트 각주(rev3 — 재리뷰 C-N1 처방 문언): "pool 밖(vector Stage1 20-후보·0.60 임계 미회수) 표적
   회수 = 구조적 0(주입 없음). **pool 내 rank(topK+1..10] 표적의 top-K 진입 = 실현 경로이며 이것이
   D안 개선 기전 = 부모 게이트(s5-8 §3 1-D) lexicalOnlyRecovery>0 의 충족 경로.** 단 graph 모드
   graphOnlyRecovery(외부 노드 주입 회수)와 의미가 다름을 비교표에 명기." — 실측 0 이 나오면 그것은
   음성 신호(은폐 금지).

## §3 비교 측정 프로토콜

- 동일 golden = `golden-pilot-approved.v2.querybody.json`(N=34, measured 19 — facts §1). 옵션: debug
  2000자 회수 시 N=27(facts §4 ①) — 채택 시 graph 열도 동일 N 재실행(분모 동일 의무).
- **(rev2 M-4) 실행 환경 = `wrangler dev --env production --remote` 로컬 세션**(read-path 한정 —
  production Worker **재배포 없음** = 배포 게이트·"동시 deploy 금지" 회피). ★환경 confound 제거:
  **3열(vector/graph/lexical) 전부 동일 dev 세션에서 재실행** — G-1D-2 의 비교 기준은 "07-07
  production 리포트"가 아니라 **동일 세션 graph 재측정치**로 대체(방향 일치 여부는 참고 각주).
- **(rev2 M-5) ε 감도 스윕**: lexical 열은 ε ∈ {0.01, 0.03, 0.05} 3회 실행 동봉 + "ε는 측정셋
  유래(F2 = 채점 문항) — 일반화 근거 아님" 해석 각주 의무.
- 산출 3열 비교표(분모 = **전체 measured 셋** 기준 — lexical 열 truncated≡false vs graph 절단 가능의 비대칭 때문에 '절단제외' bucket 대신, graph 절단 수는 각주. rev3 m-N4): **vector(baseline) vs graph(depth1, 동일 세션) vs lexical(본 건)** —
  hit-rate@5 / mean-recall@5 / onlyRecovery / regression. baseline 열은 lexical 리포트의 baseline
  필드와 graph 리포트의 baseline 필드 **상호 일치 검산**(불일치 = 측정 무효, fail-loud).
- 결과 문서: `s5-6-measurements/s5-6-remote-lexical-*.{json,md}` + 비교표 1장 → **#8 재상신 자료**.

## §4 학습자 경로 무접촉 증명 (CO-3·baseline 불변 의무)

① diff 스코프 증명: `user-search.ts`/`routes.ts`/`multi-path-fallback/**` **변경 0**(git diff 무출현
— keyword-fallback.ts 는 exported `runKeywordFallback` read-only import). ② mount 분리:
`index.ts:164-165` exact-path 별개 — `/api/search` 핸들러 무접촉. ③ mode 미지정 회귀:
graph-search-route 기존 테스트 全 PASS + 동일 golden depth1 재실행 수치 = 07-07 리포트 동일.

## §5 Binary Gate [rev2]

| Gate     | 판정 (입력→출력, 기계 판정)                                                                                                                                                                                                                                                    |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-1D-1   | `/api/search` byte-불변: §4① diff 0 + api 테스트 전체 PASS 회귀 0                                                                                                                                                                                                              |
| G-1D-2   | mode 미지정 = 기존 graph 계약 byte-동치(스키마 default 테스트) + graph 열 = 동일 dev 세션 재측정(§3 — production 07-07 리포트와의 방향 일치는 참고 각주)                                                                                                                       |
| G-1D-2b  | **lex 전원 0** → 정렬 == `compareByTruthWeightThenScore` 완전 동치(동점 포함) + ε=0 동점-lex 개입 = 별도 의도 테스트 (CO-3 방어 — eps 파라미터 주입, rev3 M-N1 문언)                                                                                                           |
| G-1D-3   | lexical 측정 재현성: 동일 golden 2회 연속 실행 수치 동일                                                                                                                                                                                                                       |
| ★G-1D-3′ | **정렬 전순서 property**(rev2 C-1 차단): 랜덤 풀(tw·score·lex 밀집 난수) × 입력 순열 셔플 ≥50회 → **키-시퀀스 유일**(전키 동률 원소의 입력순 잔존은 안정정렬 의도 — id-시퀀스 아닌 정렬키 시퀀스 비교, rev3 m-N1) + 인접 불변식(sortKey(out[i]) ≥ sortKey(out[i+1])) 전수 PASS |
| G-1D-4   | 비교표 3열 산출 + baseline 열 상호 일치 검산 + **제외집합(no_seed·unmeasurable) 3열 동일성 assert**(M-1 — 분모 동일 기계 검증)                                                                                                                                                 |
| G-1D-5   | 순환 공정성: lexicalOnly… 아닌 **rerank-이득 문항별 NAMED/NOT-NAMED 세그먼트 분리** — NAMED 판별 = `approved-nodes-corpus.json` read-only 조인(name∪description 에 query 토큰 LIKE-일치, 매처 술어 :204 와 동일 정의 — golden 파일 무변경)                                     |
| G-1D-6   | CPU/latency: lexical 모드 전용 메타 로깅 어댑트(logOk 는 GraphExpansionMeta 형상 전용 — 신규 lexical log 라인) p95 기록, graph 대비 표 동봉                                                                                                                                    |

## §6 비용·천장 정직

신규 표면 = route 내 mode 분기 + 비교자 wrapper + 하네스 플래그뿐(매처·채점코어·정상경로 무변경) —
graph 3종 수술 대비 저비용 [추정, 구현 전]. 천장: LIKE 한계(Anchor 1·4) → SP-T06 <85% 시 옵션
B(bge-m3 reranking) 보강 의무 조항 동일 적용(s5-8 plan:128-130). Vectorize +1 query/req 는 측정
경로(rate-limit 60/min) 한정.

## §6b 승격 선결 원장 (5-페르소나 리뷰 2026-07-07 — D안 학습자 경로 승격 결재 카드 등재 의무)

- **P5-M1**: route 핸들러 3분기 모놀리스 — 승격 전 `buildEmptyExpansionMeta`/`handleLexical`/`handleGraph` 함수 추출.
- **P5-M3**: lexical 모드 `graphExpansion.applied=true` 의미 과적(walk 미실행인데 true — 채점 계약용 의도) — 승격 전 응답 판별자(최상위 mode 필드 등) 재설계.
- **P1-m3≡P3-m2**: keyword-fallback 부분 토큰 실패의 무음 열화 — failedTokenCount surface 는 학습자 공유 모듈 접촉이라 이연(G-1D-1 무접촉 게이트 보존). 승격 시 additive 필드로.
- **P4-m1/m2**: G-1D-4 제외집합 assert·G-1D-5 NAMED 판별의 "기구"(스크립트) 부재 — 표본 확대(0b N≥30) 측정 전 스크립트화.
- **P4-M1**: G-1D-3 동일-config 2연속 재실행 = production 적용 시 닫기(현재 간접 증거: ε 0.01/0.03 독립 2실행 recall 16자리 동일).

## §7 결재란

```
[x] 진입 결재 — 기완료 (s5-8 §9 1-D GO, 진산 2026-07-07 "b로 진행" + D-B 채택. 본 plan = 동 결재가 명한 상세 plan)
[x] rev1 독립 리뷰 — FAIL(C1 비추이 비교자 실증 + M5·m4) → **rev2 전건 반영**(본 문서. C-1 수리 = D-B
    범위 내 비교자 역학 교체 — 설계 갈림길 아님 판단: 리뷰 자신이 "D-B 결정 보존됨" 명시)
[x] rev2 재리뷰 — C-1 수리 VERIFIED(순환 해소·전순서·순열 불변 실험 확증) + 신규 C-N1(rev2 각주
    "onlyRecovery≡0" 거짓·부모 게이트 모순)·M-N1(ε=0 동치 과대) 적발 → **rev3 = 재리뷰 처방 문언
    그대로 반영**(코드 설계 골격 불변 — 문서 각주·게이트 문언 정정). 리뷰 2회 영속 = review-20260707-*-lexical-plan-*.md
[x] 구현 착수 가능 — rev3 반영 완료(재리뷰 결론: "문서 각주 정정 수준 후 구현 착수 가능한 수준·코드 설계 골격 변경 불요")
[ ] 비교 측정 완료 → #8(G-S5 GO/NO-GO) 재상신 — 수치 사실만 못박고 판정 = 진산 (RULE #5. AI 판정 금지)
```
