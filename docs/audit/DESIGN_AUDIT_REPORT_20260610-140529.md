# 쪽집게(ThePick) 설계·아키텍처 정합성 감사 보고서 — SYNTHESIS

- **일시**: 2026-06-10 14:05 (KST)
- **층위**: 설계/아키텍처 정합성 (quality-gate hook·4-Pass·5persona-debt 와 중복 금지 — "엔진 선택이 옳은가 / 파이프라인이 목표를 떠받치는가 / 6개월~2년 뒤 버티는가")
- **방법**: 목표 재정립 → 9개 엔진 실측 지도 → 다중 페르소나 발견 → **발견별 적대 반증(실코드 file:line 대조)** → confirmed 만 종합
- **발견 처리**: confirmed 36건(중복 병합 후 고유 ~29건) / refuted·기각 10건(본 보고서 비포함)
- **RULE #5 준수**: 본 보고서는 🟢/🟡/🔴 사실 + 선택지만 못박는다. GO/STOP·우선순위 확정 = 진산 결재.

---

## 0. 목표 재정립 (잣대)

- **궁극 비전**: 손해평가사 서비스인 동시에 "교재+기출 입력 → Graph RAG 구조화 → 신뢰 가능한 지식 DB → 훈련 문제·암기법 무한 자동 생성" 엔진 MVP (memory project_vision_mvp_generalization, 진산 2026-04-22).
- **북극성**: 자동 생성 훈련 콘텐츠의 신뢰성·정확성 담보. 조작화 3단:
  1. Formula Engine 교재 예시값 골든 100% — **실측 100% PASS** (thepick.feasibility.md:42, 본 감사 vitest 303/303 재확인)
  2. G-S5 검색 정답률 — queryBody 정화 baseline hit-rate@5 **83.3% (N=6)** / graph 채택 잣대 graphOnlyRecovery>0 ∧ regression=0 → **현 실측 충족 0** (s5-6-g-s5-2026-06-05-querybody-analysis.md:24-31)
  3. 합격률 60% — 런칭 후에만 실측 가능 (유저 0, 🟡)
- **Year 1 구체물**: 1차 객관식 3과목 + 2차 100% 서술/계산형, MVP 베타 100명 (재정립서 v2.0 §1).
- **stale 정정 반영**: ceiling.md:24 'baseline 100%' = 답안키 패딩 아티팩트로 확증, 정화 진실 = 83.3%. feasibility/ceiling 권위 산출물이 06-05 2차 실측 미반영 상태임을 전제로 판정.

---

## 1. 엔진 지도 요약 (구현상태 실측)

| #   | 엔진                                                   | 구현상태                | 핵심 실측                                                                                                                                                  |
| --- | ------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Content Build Engine (parser/quality/batch/loader)     | partial                 | 코어 로직 real(parser 179·quality 60·batch 327 PASS), 단 **production 794/1274 는 이 코드 미통과**(Claude Code 직접 SQL, batch-loadmap.md:1-4) + CBIV 부재 |
| 2   | Formula Engine (math.js AST)                           | real                    | 303/303 PASS·골든 119·샌드박스 우회 차단 실증. 소비자 = batch QG-2 단 1곳 — **학습자 런타임 미배선**                                                       |
| 3   | Graph RAG + Graph Walk                                 | real(구현)/효용 0(측정) | depth1 Δ0%·depth2 −20%·graphOnlyRecovery 0 both. S5-8 재설계 plan DRAFT·§9 결재 전부 미체크                                                                |
| 4   | 콘텐츠 생성 엔진 (study-material-generator+ai-adapter) | **stub**                | src 전체 = `export {};` 1줄 + NOT_IMPLEMENTED throw. 소비자 0. 게이트 무음 PASS(--passWithNoTests)                                                         |
| 5   | 혼동 유형 감지 + 품질 검증                             | partial                 | graph-integrity 실로직(60 PASS)·production 미배선 / **ConfusionType 8종 감지 코드 전 repo 0건**                                                            |
| 6   | FSRS + 학습 모드                                       | partial                 | 채점·FSRS 영속 real(srs 35·learning-modes 116 PASS) / due 미구동·모드 3/5 무필터·오프라인 동기화 3중 부재                                                  |
| 7   | 평가·측정 엔진 (G-S5 harness)                          | real                    | 22/22 PASS·fabricate 차단·양면 지표·실측 2회 수행. 한계 = N=6·서빙계약 종속 커버리지                                                                       |
| 8   | 데이터 계층·D1·멀티시험 격리                           | real                    | 트리거 125·draft-only·append-only·Hard Rule 16/17 기계강제 PASS / 엣지 가드 비대칭·schema.ts 드리프트                                                      |
| 9   | LLM 격리 (containment)                                 | partial                 | Layer1 부분+Layer4(draft-only) real / Layer2 validator 4종·Layer3 CBIV·injection·PII 필터 코드 0 (현 공격면 0 = 시점 정합)                                 |

---

## 2. 진앙 (Root Causes) — confirmed 발견 클러스터링

### RC-1 [CRITICAL] Production 지식 그래프의 보호·검증 기계 공백 — "검증 기계와 실데이터 경로의 분리"

5,347 LOC + 327 테스트의 빌드 엔진이 보호하는 경로(로컬 SQLite, bin/batch.ts:53)와 production 실데이터 경로(Claude Code 직접 SQL, batch-loadmap.md:1-4 인간 결재)가 분리. 그 위에:

- **누적 그래프 재검증 기계 0**: validateGraphIntegrity 소비처 = batch contract 경로뿐(pipeline.ts:1077-1092 단일 contract 스코프). production 794/1274 대상 자동 무결성 러너가 코드베이스 어디에도 없음. cron 2종(rate-limit-gc/silent-failure-monitor)·CI(d1-schema-drift=스키마 diff 전용) 전수 확인.
- **검증기가 cross-batch 엣지를 구조적으로 거부**: schema-validator declaredNodeIds = contract 내부 한정(schema-validator.ts:979,1188-1219) → production 실재 cross-batch refs(15/31/10/10/11건+)는 현 모양 그대로 Ontology Lock 재검증 불가.
- **CBIV(ADR-014 Accepted) 전체 미이행**: packages/cbiv 부재·코드 참조 0건. Hard Rule 20(HARD_RULES.md:77,123 "CBIV 통과 없으면 Loader INSERT 거부")의 강제 지점 loadDraft(draft-loader.ts:119-165)에 체크 0건. cbiv-reports 디렉토리 부재. 이연/superseded 결정 기록 0건 = 미이행 의무.
- **다단계 SUPERSEDES 순환 = 위임받은 DFS 가 영영 안 돔**: 0014:176-178 이 다단계 순환을 "graph-integrity DFS"에 명시 위임 — 그 DFS 의 production 실행 경로 부재. 0013 자동 비활성 트리거(0013:101-109)와 결합 시 미검출 순환 = 노드군 무음 소실 기전 실재.
- **knowledge_edges 만 UPDATE/DELETE 가드 트리거 0건**: nodes/formulas/constants/exam*questions/table*\* 전부 가드 보유, 엣지만 비대칭(전수 grep). SUPERSEDES 엣지 DELETE 시 비활성 상태는 남고 근거만 소실. 0014:20 자체 원칙("DB가 마지막 방어선")과 모순.
- 완화 사실(반증 생존분): D1 FK(0001:39-40)가 행 부재형 끊긴 엣지는 INSERT 시점 차단 / 적재 세션별 ad-hoc SQL Level-1 검증 기록 존재 / 2026-05-15 production read-only 실측 대사 1회.

**기여 발견**: cumulative-graph-integrity-machine-zero(critical) · cbiv-cross-batch-regression-zero(critical) · production-data-bypasses-quality-machine(critical 유지) / production-path-bypasses-build-engine(critical→**major 하향 권고**, systems-boundary) · knowledge-edges-temporal-guard-asymmetry(major, 2개 페르소나 독립 확증) · navigability-gate-absent(major) · qg2-gate-target-and-threshold-drift(major — 단 임계 40/80/7 은 설계서 정본, 교정 대상 = stale 주석+batchId 미배선)

**6개월~2년 임팩트**: 매년 R-BATCH 누적 시 고아·3+순환·도달 불가 구멍이 무검출 누적 → 검색 정답률 하락으로만 간접 관측. CONCEPT-023(엣지 부재 = graph 영구 도달 불가)이 이미 최하류(G-S5 측정)에서야 발견된 실례.

### RC-2 [CRITICAL] Graph 신호의 랭킹층 폐기 — graph-walk 순기여 0 의 구조적 원인 (확인된 미해결 설계 결함 — 교정안 설계 완료·결재 미완)

- **score=0 주입 + truthWeight-first 단일 비교자**: 확장 노드 전원 buildHit(src, 0)(graph-search-route.ts:264), 병합 = compareByTruthWeightThenScore(user-search.ts:330-333)뿐 → cross-type 에서 확장 LAW(10)/F(8)가 query-관련 INV(7)/CROP(6) 정답을 무조건 축출. 실측 Q-012(F-노드 5개 범람→INV-035 축출)·Q-014(LAW-008→CROP-028 축출)와 기전 1:1.
- **hop-depth 계산 후 폐기**: MIN(w.depth) projection(graph-walk/index.ts:238)이 라우트 매핑(graph-search-route.ts:255-264)에서 소실 — 랭킹 신호 0비트.
- **priority/condition 사장**: 스키마 선언(0001:42-43)뿐 소비 0 + draft-loader.ts:362-364 가 전 엣지 priority=0 하드코딩 = 데이터 자체가 0비트.
- **seed-gating**: 시드 = 표시용 topK 절단본 slice(0,5)(graph-search-route.ts:186 ← user-search.ts:291) → graphOnlyRecovery 상한 = "baseline top-K 이웃 ∩ expected". Q-015 정답 F-103(rank6, 0.63)은 시드도 병합 풀도 진입 불가 — F-103 seed+bidir depth1 이면 INS-27 도달 가능했음(batch 1274 검증). 단 이는 A/B 측정 격리·CPU 상한의 부분 의도 트레이드오프(plan L4 자기 경고)로 프레이밍 정정.
- **forward-only + 12종 등가 순회**: e.from_node=w.node_id 단방향(graph-walk/index.ts:231-236), edge_type 가중·방향성 구분 0.
- **production 기본값 = 실측 순손실 형상**: DEFAULT_MAX_DEPTH=2(index.ts:66) 그대로, public 무인증 라우트(apps/api/src/index.ts:123-126). Phase 0a(depth1 기본화="확정된 손해 차단") 단독 결재 가능 상태로 §9 미체크.
- **상류 전제 무검증**: ontology-registry edge_types 에 domain/range·방향 규약 메타 0(:16-35) + schema-validator 타입쌍 검증 0(:1165-1221) — 방향이 도달성을 전결하는데 방향 규약은 무검증.
- **가장 싼 지렛대 로드맵 부재**: lexical fusion — SEARCH_PIPELINE.md:42-43 이 자체 설계한 융합 밴드(ADR-019 Accepted)가 미구현, S5-8 plan 에 lexical/RRF/fusion grep 0건. Q-015 의 0.02차 변별 불능(0.63 vs 0.65)이 정확히 dense-단독 약점.

**기여 발견**: graph-merge-query-agnostic-ranking(critical) · graph-signal-discarded-in-ranking(major) · seed-gating-caps-graph-only-recovery(major) · forward-only-unweighted-traversal(major) · production-default-depth2-net-loss(major) · ontology-lock-no-domain-range-direction(major) · hybrid-fusion-absent-pipeline-doc-conflict(major)

**병기 의무**: S5-8 재설계 plan(DRAFT)이 F1/F2/F3 으로 동일 기전을 이미 식별 — 미인지 결함이 아니라 **교정안 설계 완료·진산 결재 대기** 상태. 옵션 C 격리로 현 학습자 노출 0.

### RC-3 [CRITICAL] "계산은 되는데 흐름을 구동하지 않는다" — 산출-소비 단절 패턴 (북극성 효과 미전달)

같은 구조 결함이 5개 독립 지점에서 반복 — 엔진/데이터는 real 인데 학습자 경험에 0비트 기여:

1. **혼동 유형 자동 감지(한 줄 정의 3대 기능) 전 체인 미가동**: 감지 코드 전 repo 0건(존재물 = 타입선언+DB enum) / 유일 휴리스틱 tagConfusionLevels(constants-extractor.ts:132-175) 산출이 draft-loader INSERT 8컬럼에 미포함 = D1 미영속(production 단감 1.0115/떫은감 0.9662 쌍이 'safe' 기본값 영속 실증) / production 기출 525/545 confusion_type NULL / `/next` WHERE 미필터(routes.ts:841-842).
2. **FSRS due 미구동**: scheduleReview·11컬럼 영속 real(routes.ts:1056-1112)이나 fsrs_next_review 를 카드 선택에 쓰는 곳 0 — /next ORDER BY 미참조(:819-828), 유일 소비 API /progress/due 의 web 소비자 0, node 경로는 FSRS 하드코딩 stub(progress/routes.ts:281-287) 혼재.
3. **학습 모드 5종 중 3종(category/topic/confusion) 무필터**: modeParams 저장·surface 만 되고 WHERE 미반영 — mixed 와 동일 풀. /mode available 카운트(필터 풀)와 /next 서빙(무필터 풀)의 직접 모순 = ADR-039 계약 명문 위반.
4. **weak_score 집계 수준 축소**: D2 lock 정의(과목 정답률+concept stability, srs/types.ts:54-61) vs 구현(카드 1장 correct/total + 그 카드 stability, routes.ts:1064-1070) — 주석은 "D2 lock 정합" 주장 = Silent Pivot 류. 과락(매 과목 40+) 구조에서 과목 약점 데이터 미생산.
5. **Formula Engine 학습자 미배선 + 2차 훈련 루프 부재**: apps/api dependencies 에 formula-engine 0 — 설계 문서(phase3-learning-ux-modes.plan.md:371)가 명시한 배선이 지정 시점(Step 3-UX-5) 경과 후에도 무산출·무ADR 표류. calc=최종값 비교 skeleton·essay=self-grade·2차 answer 전량 null. 합격 병목(2차 100% 서술/계산형)이 가장 약한 고리.
6. **출처 추적 체인 데이터 기아**: buildSourceCitations real(routes.ts:519-544)이나 related_nodes 525/545 NULL → 학습자 화면 교재/법령 근거 빈 배열. 백필 = 0038 production 적용(게이트 #3) 대기.
7. **오프라인 동기화 3중 부재**: sw.js:156-161 NOT IMPLEMENTED stub + enqueue 0건 + IndexedDB 쓰기 0건 — CLAUDE.md 스택·ARCHITECTURE.md 현재형 서술과 불일치(문서층 오염 벡터).

**기여 발견**: confusion-detection-triple-gap(critical) · confusion-detection-chain-severed(major) · confusion-enrichment-dead-end(major) · fsrs-due-not-driving(major, 2개 페르소나) · learning-modes-3of5-no-filter(major) · weak-score-aggregation(major, 2개 페르소나) · second-exam-training-loop-absent(major) · formula-engine-unwired-from-learner-runtime(major) · source-citation-chain-data-starved(major) · offline-sync-declared-not-built(major)

### RC-4 [CRITICAL] 생성층(북극성 본체) 공백 + 생성물 게이트 부재 — "게이트가 생성기보다 늦는 역순 리스크" + 무장 결함

- **Layer 5 = 1줄 빈 패키지**: study-material-generator src 전체 `export {};` + ai-adapter NOT_IMPLEMENTED + 소비자 0. 은폐 아님(roadmap 트래커가 명기·TR-2 큐 배정) — 단 --passWithNoTests + verify-engine-contracts 미등록으로 **기계 경고 0**. (northstar-redteam 판정: critical→major 하향 검토 — "추적된 미착수")
- **생성물 테이블 환각 차단 DB 게이트 0중 vs knowledge_nodes 3중**: mnemonic_cards = status CHECK 없음·draft 트리거 없음·UPDATE/DELETE 가드 0·reverse_verified 검증 로직 0(컬럼+enum 만)·page_ref/FK 부재(0002:41-52). exam_questions = status CHECK 에 'draft' 자체 부재(0001:128) → 생성물 INSERT 즉시 'active'(학습자 풀) 직행 가능 + 0038 이 status 를 동결해 사후 격리 UPDATE 경로조차 없음. AI 생성 distractor 의 exam_questions 적재 경로는 ADR-046 D-6 으로 이미 결재 완료 = 가설 아닌 확정 경로.
- **객관식 채점 정답 인덱스 3중 모순 (무장 잠복)**: ① buildShuffledChoices = answer 를 정답 텍스트 index 0 으로(routes.ts:410, 주석 :385) ② 채점 = answer 를 ①~⑤ 위치 마커로 파싱(routes.ts:627, multiple-choice.ts:58-77) ③ shuffle 계약 = "0=①"(shuffle.ts:91). **어떤 데이터 컨벤션으로도 3경로 동시 성립 불가** — answer='③' 이면 오답이 정답 처리. 현재 distractors NULL→fill_blank fallback 으로 잠복, distractor BATCH 적재(결재 대기) 순간 발화. 결합 경로 테스트 0건.
- **LLM tables[] 무음 폐기**: 프롬프트는 분해 '의무'(batch-processor.ts:160-164,281-282), parseContractJson expectedKeys 4종 = tables 미포함(:395)·조립 폐기(:404-409) — ":394 '데이터 무음 삭제 방지' 주석과 자기모순". loader table\_\* INSERT 0건. 현 production 표는 수동 SQL 적재라 현재 손실 0 — **자동 파이프라인 가동(=다른 시험 확장) 순간 발화**.
- **Table-as-Micro-KG 분열**: table_node_links 소문자 'supersedes'(0021:116)가 0013/0014 SUPERSEDES 트리거 기계 전부 우회하는 제2 버전관리 채널 + related_node_id FK 구조상 표→표 supersession 표현 불가(발견보다 심각) / production 표 벡터 433개(인덱스 34%)가 메인 검색 top-20 슬롯만 소모 후 무음 탈락(Stage2 knowledge_nodes 한정).
- **containment 4층 중 기계 강제 = Layer1 부분+Layer4 뿐**: Layer2 validator 4종·Layer3 CBIV·prompt_injection·output_pii_filter 코드 0. Layer1 도 설계(tools structured output)≠구현(정규식 추출) 무ADR 이탈. 현 user-facing LLM 0 = 공격면 부재로 시점 정합이나, Phase 2/3 진입 게이트로 못박을 지점.
- distractor 서빙층 최후 가드(정답-오답 동치 검사) 0(minor).

**기여 발견**: mc-grading-answer-index-contradiction(critical) · generated-content-db-gate-absent(critical) · llm-tables-output-silent-discard(critical 조건부/major — 페르소나 판정 분기) · generation-layer-north-star-stub(critical→major 하향 검토) · generated-content-draft-gate-missing-for-exam-questions(major) · table-micro-kg-split-brain(major) · containment-4layer-two-implemented(major) · distractor-safety-no-answer-equality-guard(minor)

### RC-5 [MAJOR] 이원 진실원 + 문서·스키마·주석 드리프트 — "2026-05-15 stale 오염 사고 클래스의 잔존 서식지"

- **산식 계수 5중 보관·동기 검증 0**: 1.0115 가 ①코드 equationTemplate 인라인(batch1-definitions.ts:174) ②D1 formulas ③D1 constants ④노드 description/엣지 condition 자유텍스트 ⑤골든 기대값 — 코드 68 vs D1 157 이원, supersededBy 선언만(types.ts:41)·소비 0, LLM_CONTAINMENT §3.2 지정 validators/range.ts 미신설.
- **schema.ts 자기선언 위반 드리프트**: "14 tables" 헤더 vs 실선언 23 vs migrations 고유 26 / 전 검색 경로 핵심 필터 is_current_active 가 타입에 0히트 / batch_runs·review_decisions·review_queue 통째 부재 / CLAUDE.md "Drizzle ORM"·"D1 9개 테이블" vs 실제 raw .prepare() 66 콜사이트·26테이블.
- **Year 2 슬롯 포인터 부패**: exam_id 도입 앵커가 소진된 번호 3종(0005/0017/0019)×최소 6곳(draft-loader.ts:36-38, progress/routes.ts 4곳, production-quality.md:102) — 0017 헤더가 이미 소진된 0005 를 복제 인용 = stale 포인터 자기증식 실증.
- **SEARCH_PIPELINE.md(권위 문서) 3축 충돌**: Concurrent Pipeline 명세 vs 순차 실코드 / "❌ 재귀 CTE" vs graph-walk WITH RECURSIVE / 코드 위치 미존재 경로 / 자체 vow(:249 "❌ 순차 호출 폴백")이 현 production 동작을 위반으로 선언 — ADR-045 이후 미개정.
- **회귀 게이트 스코프 공백**: VITEST_PACKAGES + CI test 필터가 동일 8종 — learning-modes(116)·srs(35) 단위 테스트 **151건이 CI 에서 아예 미실행**(minor→major 상향 권고).
- srs→learning-modes 역의존(plan §7.3:375 명시 금지 위반, type-only 2건, minor) / eval 파서 이중 정본(주석 방어뿐, minor) / qg2 주석 stale(minor).

**기여 발견**: formula-coefficient-quintuple-storage-no-sync(major) · schema-ts-type-sot-drift(major) · year2-migration-slot-pointer-rot(major) · hybrid-fusion…doc-conflict(major, RC-2 와 공유) · contract-gate-omits-learning-core-packages(minor→major 권고) · srs-depends-on-learning-modes(minor) · eval-parser-and-ceiling-copies(minor) · qg2-gate-measures-wrong-target(minor)

### RC-6 [MAJOR] 북극성 잣대(G-S5)의 구조 한계 — 측정이 서빙 계약·극소 표본·진단 맹점 위에 있음

- **커버리지가 서빙 계약(query≤500, graph-search-route.ts:79)에 종속**: 빌더가 라우트 계약을 복제(build-querybody-golden.mjs:29) — graph 가 빛날 2차 장문 Q-004(583자) 영구 제외. S5-8 Phase 0b·Binary Gate 에 500자 천장 처리 부재 = 확대 후에도 상속.
- **N=6·단일 도메인·graph 식별 표적 2노드(전부 Q-015 단일 문항)** — 절대값 임계 N≥30 한정 규칙은 결재 큐 미결.
- **명칭-동형 편향 잔존 자인**(golden verification 필드 "queryBody 층 해결불가") — baseline 83.3% 은 상한 추정치 가능. headline hit-rate 83.3% 이면의 mean-recall 58.1%.
- **진단 맹점**: 라우트가 expandedNodes 전체집합 미노출 → "확장됐으나 랭크 미달" vs "미도달" 구분 불가 — 재설계 방향(랭킹/순회/데이터) 선택 신호 결손, 매 측정 오프라인 수동 검증으로만 우회.
- **빌더 비확장**: 문항 ID 하드코딩 RULES — N≥20~30 확대 시 문항당 수동 전사 병목.
- relatedRawCount 의미 퇴화(runner 가 교집합 후 길이 주입 — 미소비 필드라 보고 수치 무오염, minor 급).

**기여 발견**: golden-yardstick-structural-limits(major) · eval-coverage-and-diagnostics-gaps(major) · eval-parser-and-ceiling-copies(minor, RC-5 공유)

---

## 3. 심각도 매트릭스 (적대 반증 생존분, 최종 판정 = 인간)

### CRITICAL — 설계 오류/공백 (7)

| 발견                                    | 진앙 | 핵심 증거                                     | 발화 조건                             | 비고                                                           |
| --------------------------------------- | ---- | --------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| mc-grading-answer-index-contradiction   | RC-4 | routes.ts:410 vs :627 vs shuffle.ts:91        | distractor BATCH 적재 시 즉시         | 정답 안전 Hard Stop 직격, 테스트 0건                           |
| graph-merge-query-agnostic-ranking      | RC-2 | graph-search-route.ts:264,269,286 + 실측 −20% | 현존 (옵션 C 격리로 학습자 노출 0)    | S5-8 plan F1/F2 동일 기전 — 결재 대기                          |
| cumulative-graph-integrity-machine-zero | RC-1 | pipeline.ts:1077-1092 + 소비처 전수 grep      | 현존 (R-BATCH 마다 누적)              | FK 가 끊긴엣지만 차단 — 고아·3+순환·활성엣지→비활성노드 무방비 |
| cbiv-cross-batch-regression-zero        | RC-1 | ADR-014:4 Accepted vs packages/cbiv 부재      | 현존                                  | Hard Rule 20/24 기계강제 0                                     |
| generated-content-db-gate-absent        | RC-4 | 0002:41-52 / 0001:128 / 0018=nodes 전용       | Phase 2 생성·distractor BATCH 착수 시 | "라이브 취약점 아닌 선결 차단 게이트"                          |
| llm-tables-output-silent-discard        | RC-4 | batch-processor.ts:395,404-409                | 자동 파이프라인 가동(타 시험 확장) 시 | 페르소나 판정 분기: critical(조건부)/major                     |
| confusion-detection-triple-gap          | RC-3 | 감지 코드 0 + INSERT 미영속 + /next 미필터    | 현존 (3대 기능 0% 전달)               | 0038 화이트리스트가 backfill 경로는 설계해 둠                  |

_critical→major 하향 권고 2건(판정충돌, 인간 확정 필요): production-path-bypasses-build-engine(systems-boundary 하향 vs production-data-bypasses-quality-machine northstar-redteam 유지) · generation-layer-north-star-stub(추적된 미착수)._

### MAJOR — 기술부채/설계 긴장 (19, 병합 후)

RC-1: knowledge-edges-temporal-guard-asymmetry · navigability-gate-absent · qg2-gate-target-and-threshold-drift
RC-2: graph-signal-discarded-in-ranking · seed-gating-caps-graph-only-recovery · forward-only-unweighted-traversal · production-default-depth2-net-loss · ontology-lock-no-domain-range-direction · hybrid-fusion-absent-pipeline-doc-conflict
RC-3: confusion-detection-chain-severed · confusion-enrichment-dead-end · fsrs-due-not-driving · learning-modes-3of5-no-filter · weak-score-aggregation · second-exam-training-loop-absent · formula-engine-unwired-from-learner-runtime · source-citation-chain-data-starved · offline-sync-declared-not-built
RC-4: generated-content-draft-gate-missing-for-exam-questions · table-micro-kg-split-brain · containment-4layer-two-implemented
RC-5: formula-coefficient-quintuple-storage-no-sync · schema-ts-type-sot-drift · year2-migration-slot-pointer-rot · contract-gate-omits-learning-core-packages(minor→major 상향 권고: CI 미실행 151건)
RC-6: golden-yardstick-structural-limits · eval-coverage-and-diagnostics-gaps

### MINOR (5)

srs-depends-on-learning-modes · eval-parser-and-ceiling-copies · distractor-safety-no-answer-equality-guard · qg2-gate-measures-wrong-target(주석 stale 축) · relatedRawCount 퇴화(eval gaps 하위)

---

## 4. 엔진별 북극성 정렬 판정

| 엔진                         | 판정        | 근거                                                                                                                                                                          |
| ---------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content Build Engine         | **partial** | 코어 로직 real·테스트 PASS, 그러나 production 데이터가 이 엔진을 한 번도 통과 안 함(이중 경로) + CBIV/누적 회귀 0 + tables 폐기 — "같은 규칙의 기계 거울"이지 실보증자가 아님 |
| Formula Engine               | **partial** | 북극성 조작화 1단(골든 100%) 자체는 serves — 단 소비자 = batch QG 단 1곳, 학습자 런타임(2차 계산 채점) 배선 0 = 정확성 보증이 학습자에게 미전달                               |
| Graph RAG + Graph Walk       | **partial** | vector 축 serves(baseline 83.3%, production 학습자 경로) / graph 축 = 구현 real·효용 0(graphOnlyRecovery 0 both·depth2 −20%) — 채택 잣대 미충족, 재설계 §9 결재 대기          |
| 콘텐츠 생성 엔진             | **stub**    | `export {};` 1줄 + NOT_IMPLEMENTED. 북극성 본체("훈련 콘텐츠 무한 자동 생성")의 측정 대상 자체가 0 LOC — 현 서비스 실체 = 기출 풀이 서비스                                    |
| 혼동 유형 감지 + 품질 검증   | **partial** | graph-integrity 검증기 real·production 미배선 / 혼동 8종 감지 = 사실상 stub(코드 0) — 3대 기능 축 미가동                                                                      |
| FSRS + 학습 모드             | **partial** | 채점·영속·streak real / due 미구동·모드 3/5 무필터·오프라인 missing — "계산되는 전시물" 패턴                                                                                  |
| 평가·측정 엔진 (G-S5)        | **serves**  | 유일하게 북극성을 직접 떠받침 — fabricate 차단·양면 지표·실측 2회·불리한 수치 그대로 surface. 한계(N=6·커버리지 종속·진단 맹점)는 워터마크로 자기 인지                        |
| 데이터 계층·D1·멀티시험 격리 | **partial** | Temporal 트리거 125·draft-only·append-only·Hard Rule 16/17 기계강제 = serves 축 / 엣지 가드 비대칭·schema 드리프트·생성물 게이트 공백 = 침식 축                               |
| LLM 격리                     | **partial** | Layer4(draft-only) 기계강제 real + 현 공격면 0 = 시점 정합 / Layer2·3·injection·PII 코드 0 — Phase 2/3 진입 시 선결 게이트로만 유효                                           |

---

## 5. Remediation 선택지 (PITR 식 — RULE #5: GO/STOP·채택 = 진산)

### R-1. Production 그래프 보호·검증 (RC-1) — humanDecisionRequired

- **A (최소 러너, 권고)**: validateGraphIntegrity 는 순수 DI 함수 — production D1 read-only 덤프를 입력으로 먹이는 스크립트 1개 + 정기 실행(CI/cron). 코드 수십 줄, production 쓰기 0, L3 비접촉.
- **B (CBIV 풀스펙)**: ADR-014 6단계 본 구현(packages/cbiv) — Year 2 자동화 대비, 수일 규모.
- **C (문서 정합화)**: ADR-014 를 superseded/축소 개정해 "수동 프로토콜 + A 러너"를 공식 경로로 명문화.
- **+엣지 가드**: knowledge_edges UPDATE/DELETE 차단 마이그 1건(is_active 플립 화이트리스트 패턴 — nodes 전례 4회 존재). L3 = plan+승인 필수.
- 권고 조합: A + 엣지 가드(단기) → B vs C 는 2027 개정 R-BATCH 전 결재.

### R-2. Graph-walk 재설계 + G-S5 GO/NO-GO (RC-2·RC-6) — humanDecisionRequired (S5-8 §9 + 감사 결재 큐와 동일 건)

- **A (Phase 0a 단독)**: DEFAULT_MAX_DEPTH 2→1 — plan 자체가 "개선 아닌 확정 손해 차단·단독 결재 가능"으로 분리해 둠.
- **B (Phase 0b)**: golden N≥20~30 확대 — **빌더 일반화(정답/해설 분리기) + expandedNodes 디버그 노출 + 500자 천장 처리를 게이트에 추가**(현 plan 미커버 3종, 본 감사 신규 기여).
- **C (Phase 1~2)**: hop-감쇠 score·relevance-first 병합 분리·시드 다양화·양방향(L3) — plan PITR 존재.
- **D (대안 경로)**: graph-walk 동결 + lexical fusion 우선 — SEARCH_PIPELINE.md:42-43 의 미구현 자체 스펙(ADR-019 Accepted). 실측 실패(Q-015 0.02차)와 직결된 가장 싼 지렛대인데 S5-8 plan 비교군에 0건 → **Phase 1 PITR 에 D 추가 상신 권고**.
- 부수: SEARCH_PIPELINE.md ADR-045 정합 개정(재오염 차단).

### R-3. 산출-소비 배선 스프린트 (RC-3) — humanDecisionRequired

- **A (정직성 우선, 저비용·즉시)**: 모드 UI 를 실동작 2종(weak/mixed)만 노출 또는 available=0 비활성 — ADR-039 위반 상태의 사용자 노출 차단.
- **B (배선 스프린트, 런칭 전)**: ① /next WHERE 모드 필터(subject populate 됨 = category 즉시 가능) ② confusion_level INSERT 컬럼 추가(트리거 0014:84-85 차단 목록 잔존 → 0038식 재설계 또는 Temporal INSERT, L3) ③ due 소비 경로(web 1소비자) ④ weak_score 집계 수준 교정(D2 lock 재확인 또는 types.ts 재정의 — Silent Pivot 해소) ⑤ Step 3-UX-5 잔여분(formula-engine→learning-modes 배선) 재이연 여부 명시 ADR.
- **C (혼동 감지 엔진 신설)**: 신규 Epic — G-1 R1~R5 전수 후(자동 발동 조건 해당).
- 권고: A 즉시 + B plan 화 → 항목별 L2/L3 분리 결재. C 는 별도.

### R-4. 생성층 진입 게이트 (RC-4) — humanDecisionRequired

- **A (게이트 선행 원칙 명문화, 권고)**: "생성 코드 1줄 전 DB 게이트 마이그 선행" — mnemonic_cards CHECK+draft 트리거+reverse_verified 게이트, exam_questions draft 표현 경로(CHECK 재정의 = 테이블 재생성 = 지연 비용 증가) vs 별도 mock 테이블 — PITR 2안.
- **B (MC 채점 모순 선결)**: distractor BATCH(7b~7f) 착수 전 answer 데이터형 계약 확정(라벨형 vs 텍스트형) + 3경로(buildShuffledChoices/채점 파서/shuffle 계약) 통일 + 결합 경로 테스트 — **7b plan 선결 항목으로 못박기**.
- **C (tables 폐기 봉합)**: parseContractJson expectedKeys 에 tables + 경고 + loader table\_\* 적재 — 자동 파이프라인 승격 결재와 묶음.
- **D (stub 기계 경고)**: --passWithNoTests 제거 또는 stub-허용 명시 라벨 + VITEST_PACKAGES/CI 필터에 learning-modes(116)·srs(35) 등록(즉시, 수 행).
- 권고: B(가장 가까운 발화)·D(수 분) 우선, A 는 Phase 2 진입 게이트 결재.

### R-5. 드리프트 일괄 동기 (RC-5) — humanDecisionRequired (L3 접촉분 한정)

- **A (저비용 배치, 권고)**: Year 2 슬롯 포인터 6곳 "다음 가용 번호" 상대 표기 / schema.ts 헤더·누락 컬럼(is_current_active 등)·3테이블 / CLAUDE.md 스택("Drizzle=타입 전용·26테이블") / qg2 주석 / SEARCH_PIPELINE.md — 대부분 L1~L2.
- **B (산식 동기 장치)**: 코드 equationTemplate ↔ D1 equation_template 문자열 대조 테스트 1건 + 코드 68 vs D1 157 manifest(engine-backed/display-only 구분) — 2027 개정 전.
- **C (supersededBy·ConstantsProvider 실구현)**: 개정 R-BATCH 진입 시 L3 plan.

### R-6. G-S5 GO/NO-GO 본 결재 (북극성) — humanDecisionRequired

- 사실 고정: 🟢 vector baseline 83.3%(N=6) 작동 / 🔻 graph 현 파라미터 순기여 0·depth2 순손실 / 🟡 "알고리즘 사망" 단정 시기상조(재설계 미시도·N 극소·진짜 headroom 2노드는 데이터 천장 포함).
- 선택지 = S5-8 plan §9 의 6옵션 + 본 감사 추가 D(lexical fusion 비교군). 절대값 임계 N≥30 한정 규칙 채택 여부 = 감사 결재 큐 잔여분과 동일 건.

---

## 6. 환각 자수 / [확인 필요] / 증거 한계

1. **production D1 원격 미검증**: wrangler --remote = 진산 인증 게이트(본 감사 중 Authentication error 10000 재현 기록). 다음은 전부 **문서·코드 주석 기록 인용**이지 라이브 쿼리 아님 — [확인 필요]: ① 0038 production 적용 여부 ② D1 formulas 157행의 ID 구성 ③ exam_questions related_nodes/confusion_type 실 NULL 카운트 ④ mnemonic_cards production count ⑤ 0033~0035 적용(보고서 ✅ 기록만) ⑥ live count 794/1274/157/193/545(2026-05-15 실측 기록 인용).
2. **신규성 과대 위험 자수**: RC-2 의 상당 부분(F1/F2/F3 기전·Phase 0a/0b)과 RC-4 의 stub 추적은 S5-8 redesign plan·06-02 다각 감사·roadmap-milestone-progress 가 **이미 식별한 항목** — 본 감사의 기여는 "신규 발견"이 아니라 적대 반증에 의한 확증+정정(예: 끊긴엣지 FK 차단 정정, whitelist 16<17 실질 반박, graceful=true 확장 시나리오 도달 불가 정정)과 미커버 신규분(엣지 가드 비대칭, MC 채점 3중 모순, priority=0 하드코딩, CI 151건 미실행, 슬롯 포인터 6곳, 표 벡터 433 슬롯 잠식 실증)이다.
3. **표본 한계**: 본 보고서의 "graph 순손실/무익" 서술은 전부 N=6·단일 도메인·현 파라미터 한정 신호 — 통계 일반화 불가(절대값 임계 N≥30 규칙 미결).
4. **페르소나 판정 충돌의 자의 통합**: llm-tables(critical vs major)·generation-layer-stub(critical vs 하향권고)·production-bypass(critical vs 하향권고)·contract-gate(minor vs 상향권고)·fsrs-due(minor vs major) — 본 synthesis 가 양론 병기로 처리했으나 **최종 심각도 확정은 인간 결재**.
5. **수치 재실행 범위**: 패키지 테스트(303/60/35/116/22 등)는 감사 단계 직접 실행 실측이나, LOC(5,347)·테스트 총계(327) 등 일부는 선행 페르소나 실측의 인용 — synthesis 단계 재실행 안 함. 발견 원문 evidence 의 file:line 은 반증 단계에서 전수 재대조됨.
6. **혼동 발견 3건의 클러스터 경계**: triple-gap/chain-severed/dead-end 는 동일 체인의 3개 각도 — 별건 카운트 시 발견 수가 과대 보일 수 있어 매트릭스에서 클러스터 명시.

---

## 7. Confirmed 발견 전수 (병합 후 고유 발견 — id / 최종 심각도 / 핵심 file:line)

| id                                                                           | 심각도(반증 후)          | 진앙      | 핵심 증거                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| mc-grading-answer-index-contradiction                                        | critical                 | RC-4      | apps/api/src/study/routes.ts:385,410,627 / packages/learning-modes/src/shuffle.ts:91 / multiple-choice.ts:58-77               |
| graph-merge-query-agnostic-ranking                                           | critical                 | RC-2      | apps/api/src/search/graph-search-route.ts:255-264,269,286 / user-search.ts:330-333 / analysis.md:24-52                        |
| cumulative-graph-integrity-machine-zero                                      | critical                 | RC-1      | apps/batch/src/pipeline.ts:1077-1092 / schema-validator.ts:979,1188-1219 / 0014:176-178                                       |
| cbiv-cross-batch-regression-zero                                             | critical                 | RC-1      | ADR-014:4(Accepted) / HARD_RULES.md:77,123 / draft-loader.ts:119-165(게이트 0)                                                |
| production-data-bypasses-quality-machine (+production-path… major 하향 권고) | critical/major 충돌      | RC-1      | bin/batch.ts:53 / batch-loadmap.md:1-4 / local-db.ts:15                                                                       |
| generated-content-db-gate-absent                                             | critical(Phase 2 선결)   | RC-4      | 0002:41-52 / 0001:128 / 0018:20-37 / schema.ts:368 / errors.ts:21                                                             |
| llm-tables-output-silent-discard                                             | critical(조건부)/major   | RC-4      | batch-processor.ts:160-164,281-282,394-409 / draft-loader table\_\* 0건                                                       |
| confusion-detection-triple-gap (+chain-severed, +enrichment-dead-end)        | critical(클러스터)       | RC-3      | 감지 코드 0(grep) / draft-loader.ts:423-425 / routes.ts:816,841-842 / batch-loadmap.md:97 / batch-1-insert.sql:107-111        |
| generation-layer-north-star-stub                                             | critical→major 하향 검토 | RC-4      | study-material-generator/src/index.ts:1 / package.json:8 / anthropic-adapter.ts:62-76                                         |
| graph-signal-discarded-in-ranking                                            | major                    | RC-2      | graph-walk/index.ts:238 / graph-search-route.ts:255-264 / 0001:42-43 / draft-loader.ts:362-364(priority=0)                    |
| seed-gating-caps-graph-only-recovery                                         | major                    | RC-2      | graph-search-route.ts:75,186 / user-search.ts:291 / redesign plan §1 F3 (하위주장(4) graceful 시나리오 = 도달 불가로 삭제)    |
| forward-only-unweighted-traversal                                            | major                    | RC-2      | graph-walk/index.ts:231-236,50-63 / draft-loader.ts:364                                                                       |
| production-default-depth2-net-loss                                           | major                    | RC-2      | graph-walk/index.ts:66,178 / index.ts:123-126 / wrangler.toml:220-224(rate-limit 실재로 impact 일부 완화)                     |
| ontology-lock-no-domain-range-direction                                      | major                    | RC-2      | ontology-registry.json:16-35 / schema-validator.ts:1165-1221                                                                  |
| hybrid-fusion-absent-pipeline-doc-conflict                                   | major                    | RC-2/RC-5 | routes.ts:111-124 / SEARCH_PIPELINE.md:27,42-43,99,247,249 / S5-8 plan lexical 0건                                            |
| knowledge-edges-temporal-guard-asymmetry                                     | major (2 페르소나 확증)  | RC-1      | 0003:66-71 / 0013:101-108 / 0014:34-53,105-121,181-200 / 가드 grep 0건                                                        |
| navigability-gate-absent                                                     | major                    | RC-1      | graph-integrity.ts:112-133 / qg2-validator.ts:21-38 / redesign plan:16-17,40-43                                               |
| qg2-gate-target-and-threshold-drift (+measures-wrong-target minor)           | major                    | RC-1/RC-5 | qg2-validator.ts:4-8 vs 21-29(주석 stale — 코드=설계서 v1.1 정본) / :96-105 / :216(batchId 미배선)                            |
| table-micro-kg-split-brain                                                   | major                    | RC-4      | 0021:112-117(소문자 supersedes) / 0021:115 FK(표→표 표현 불가) / user-search.ts:258-261,461(표 벡터 433 무음 탈락)            |
| containment-4layer-two-implemented                                           | major                    | RC-4      | validators/ 부재(ls) / LLM_CONTAINMENT.md:52-64 vs batch-processor.ts:383(무ADR 이탈)                                         |
| generated-content-draft-gate-missing-for-exam-questions                      | major                    | RC-4      | 0001:128 / 0038:42-63(status 동결) / types.ts:93(state-machine 미커버)                                                        |
| source-citation-chain-data-starved                                           | major                    | RC-3      | routes.ts:478,519-544 / 0038:5-6,30-33 / 0004:39-43                                                                           |
| second-exam-training-loop-absent                                             | major                    | RC-3      | routes.ts:761-764 / calc.ts:2-7 / essay.ts:22-27 / api package.json(formula-engine 0)                                         |
| formula-engine-unwired-from-learner-runtime                                  | major                    | RC-3      | qg2-validator.ts:16(유일 소비자) / phase3 plan:371(설계 배선 미구현)                                                          |
| fsrs-due-not-driving (2 페르소나)                                            | major                    | RC-3      | routes.ts:819-828 / progress/routes.ts:281-287,305-344 / web /due 소비 0                                                      |
| learning-modes-3of5-no-filter                                                | major                    | RC-3      | routes.ts:814-828,841-842 vs 1441-1448(available 모순) / ADR-039:41-44                                                        |
| weak-score-aggregation (2 페르소나)                                          | major                    | RC-3      | srs/types.ts:54-61 vs routes.ts:1063-1070("D2 lock" 주석 하 카드 단위 주입)                                                   |
| offline-sync-declared-not-built                                              | major                    | RC-3      | sw.js:79,156-161 / db.ts:8-11 / IndexedDB 쓰기 grep 0건                                                                       |
| formula-coefficient-quintuple-storage-no-sync                                | major                    | RC-5      | batch1-definitions.ts:174,196 / batch-1-insert.sql:23,30,70,97,107,165 / types.ts:41(supersededBy 사문)                       |
| schema-ts-type-sot-drift                                                     | major                    | RC-5      | schema.ts:6-28("14 tables") / is_current_active 0히트 / approved-nodes-sql.ts:52 ($inferSelect 소비처 0 = 임팩트 정정)        |
| year2-migration-slot-pointer-rot                                             | major                    | RC-5      | draft-loader.ts:36-38(0017 소진) / progress/routes.ts:104-116 등 4곳(0019 소진) / production-quality.md:102(0005) — 3번호×6곳 |
| golden-yardstick-structural-limits                                           | major                    | RC-6      | graph-search-route.ts:79 / querybody.json(excludedStillOver500·verification 자인) / build-querybody-golden.mjs:29,36-67       |
| eval-coverage-and-diagnostics-gaps                                           | major                    | RC-6      | measure 스크립트:177-183(relatedRawCount 퇴화) / GraphSearchResponse:91-117(expandedNodes 미노출)                             |
| contract-gate-omits-learning-core-packages                                   | minor→major 상향 권고    | RC-5      | verify-engine-contracts.ts:168-179 / ci.yml:53-64(151건 CI 미실행)                                                            |
| srs-depends-on-learning-modes                                                | minor                    | RC-5      | srs/package.json:21 / phase3 plan:375 명시 금지 위반(type-only 2건)                                                           |
| eval-parser-and-ceiling-copies                                               | minor                    | RC-6      | multihop-accuracy.ts:36-66 vs study/routes.ts:478-493 / measure:65                                                            |
| distractor-safety-no-answer-equality-guard                                   | minor                    | RC-4      | routes.ts:393-417 / 0038:52(변경 차단≠내용 검증)                                                                              |

---

## 8. 결재 상신 요약 (진산 행동 큐 — 사실+선택지만, 결정은 인간)

| #   | 건                                                                                 | 연계    | 긴급도 신호                          |
| --- | ---------------------------------------------------------------------------------- | ------- | ------------------------------------ |
| 1   | G-S5 GO/NO-GO + S5-8 §9 (Phase 0a 단독 분리 가능, lexical fusion 비교군 추가 여부) | R-2·R-6 | 북극성 임계 경로, 산출물 미커밋 상태 |
| 2   | MC 채점 3중 모순 — distractor BATCH 착수 전 선결 게이트 지정                       | R-4-B   | 발화 시점 가장 근접한 critical       |
| 3   | Production 그래프 보호: 무결성 러너 A안 + 엣지 가드 마이그(L3)                     | R-1     | R-BATCH 2027 전                      |
| 4   | 생성층 진입 게이트 선행 원칙(A) + stub 기계 경고(D, 수 분)                         | R-4     | Phase 2 진입 전                      |
| 5   | 모드 정직성 임시 조치(A) + 배선 스프린트 plan 화(B)                                | R-3     | 베타 노출면                          |
| 6   | 드리프트 일괄 동기 배치(슬롯 포인터·schema.ts·CLAUDE.md 스택·SEARCH_PIPELINE.md)   | R-5     | stale 오염 재발 차단                 |
| 7   | feasibility/ceiling 권위 산출물의 06-05 2차 실측 반영 갱신                         | §0      | G-1 산출물 영속 의무                 |

> 본 감사 산출물 자체와 06-05 측정 산출물이 **미커밋**(git status) — 재현 근거 영속 여부도 결재 대상.
