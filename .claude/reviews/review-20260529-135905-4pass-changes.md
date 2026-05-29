# 4-Pass 독립 리뷰 보고서 — 멀티에이전트 워크플로우 오케스트레이션 JS 3종

- 생성: 2026-05-29 13:59:05 (ts=20260529-135905)
- 프로토콜: `.claude/rules/auto-review-protocol.md` §"보고 형식"
- 리뷰 방식: **독립 에이전트 5개 (scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증**
- 판정 기준: 4-Pass 전 Pass CRITICAL 0건 시에만 "완료 가능"

---

## 리뷰 범위

### 변경 파일 (3)

1. `/home/soo/ClaudePro/ThePick/.claude/workflows/4pass-review.js` — auto-review-protocol.md 의 4-Pass(Surgeon/Architect/Advocate/Contract) + 규칙0~4 + 발견별 적대 반증을 Workflow 툴(phase/agent/pipeline/parallel/log + JSON Schema)로 구현한 재사용 스크립트
2. `/home/soo/ClaudePro/ThePick/.claude/workflows/5persona-debt.js` — 5-페르소나(refactoring/performance/quality/backend/devops) 병렬 기술부채 리뷰 + 교차 진앙 합의 + INDEX 영속
3. `/home/soo/.claude/projects/-home-soo-ClaudePro-ThePick/eb9ba6ab-9db7-47df-a9f7-9bd755b9f305/workflows/scripts/dual-gate-prescreen-wf_eddc1345-81b.js` — 이미 1회 실행 성공한 일회성 TR-0 이중 게이트(golden 12문항 3렌즈 적대검증 + TR-0 plan A/B 적대검토) 사전심사 스크립트

### 연관 파일 (14)

- `/home/soo/ClaudePro/ThePick/.claude/workflows/README.md`
- `/home/soo/ClaudePro/ThePick/.claude/rules/auto-review-protocol.md`
- `/home/soo/ClaudePro/ThePick/.claude/rules/production-quality.md`
- `/home/soo/ClaudePro/ThePick/CLAUDE.md`
- `/home/soo/.claude/hooks/review-gate.sh`
- `/home/soo/ClaudePro/ThePick/docs/plans/tr-0-backend-c7-trigger-redesign.plan.md`
- `/home/soo/ClaudePro/ThePick/docs/plans/s5-6-measurements/golden-pilot-draft.md`
- `/home/soo/ClaudePro/ThePick/docs/plans/s5-6-measurements/golden-pilot-draft.json`
- `/home/soo/ClaudePro/ThePick/docs/plans/s5-6-measurements/approved-nodes-corpus.json`
- `/home/soo/ClaudePro/ThePick/docs/plans/s5-6-measurements/README.md`
- `/home/soo/ClaudePro/ThePick/migrations/0004_temporal_guard_extension.sql`
- `/home/soo/ClaudePro/ThePick/migrations/0010_status_transitions_and_page_ref_guard.sql`
- `/home/soo/ClaudePro/ThePick/apps/api/src/db/schema.ts`
- `/home/soo/ClaudePro/ThePick/.claude/reviews/phase2-tech-debt-20260529-backend.md`

### 변경 요약

신규 멀티에이전트 워크플로우 오케스트레이션 JS 3종이 추가됐다 (전부 dev 하네스, ThePick 서비스 런타임 코드 아님). (1) `4pass-review.js` 는 4-Pass + 규칙0~4 + 발견별 적대 반증을 Workflow 툴로 구현한 재사용 스크립트, (2) `5persona-debt.js` 는 5-페르소나 병렬 기술부채 리뷰 + 교차 진앙 합의 + INDEX 영속, (3) `dual-gate-prescreen-*.js` 는 일회성 TR-0 이중 게이트 사전심사. README.md 가 앞 둘을 레지스트리에 등록. 모두 순수 JS(Date.now/Math.random 미사용 명시).

---

## ── 4-PASS REVIEW ──────────────────

리뷰 방식: 독립 에이전트 5개 (scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 3개 + 연관 파일 14개 (위 목록)

### Pass 1 (Surgeon): ✅ 11건 확인 / 🔴 0건 / 🟠 0건(MAJOR) / 🟡 2건(MINOR) / N/A 2건

**관점: "이 코드 단독으로 터지는 경로가 있는가?"**

확인:

- PASS — Null/Undefined 가드: `4pass-review.js:95` `scope.changedFiles||[]`, `:160` `passResult?.findings||[]`, `:163` `passResult?.checkedItems||[]`, `:200`/`206` `reviewed.filter(Boolean)`, `:232` `crit.length` 등 에이전트 반환 null 대비 옵셔널체이닝/기본값 일관 적용. agent() 결과 null 이어도 크래시 경로 없음.
- PASS — Null/Undefined 가드: `5persona-debt.js:108` `reports.filter(Boolean)`, `:112` `PERSONAS.length - valid.length` 로 누락 페르소나 명시, `:138` `synth.rootClusters?.length||0`. 병렬 일부 실패(null) 시 은폐 없이 INDEX 에 누락 건수 기록 지시(L112).
- PASS — Null/Undefined 가드: `dual-gate...js:143` `vs.filter(Boolean)`, `:146` `verdicts.length===0?'INCONCLUSIVE'`, `:165`/`220` `.filter(Boolean)`, `:231-232` `r.findings||[]`. 3렌즈 전부 실패해도 INCONCLUSIVE 로 안전 강등(거짓 APPROVE 방지).
- PASS — Async/await: 모든 비동기 경계가 await 됨. `4pass-review.js:70` `await agent`, `:144` `await pipeline`, `:210` `await agent`. `5persona-debt.js:87` `await parallel`, `:109` `await agent`. `dual-gate...js:133` `await parallel`, `:224` `await Promise.all([runGateB(),runGateA()])`, `:239` `await agent`. 누락된 await 0건.
- PASS — 경계값 빈 배열: `4pass-review.js:161-163` `toVerify.length===0` 분기로 검증 대상 0건 안전 처리. `:200` flatMap+`||[]` 로 findings 0건 흡수. `dual-gate...js:146` `verdicts.length===0` 분기. 빈 PASSES/PERSONAS/ITEMS 시에도 map 이 빈 배열 반환하여 무해.
- PASS — NaN/음수: 본 스크립트는 산식 연산(부동소수점)을 수행하지 않는다. 카운트는 전부 정수 `.filter().length` 또는 LLM number. NaN 발생 산술 경로 0건. README:4 'Date.now/Math.random 불가' 와 정합(비결정성 차단).
- PASS — 빈 catch 부재: 3종 전체에서 try-catch 블록 0건(grep 상 catch 키워드 미사용). 에러는 하네스가 Promise rejection 으로 전파하도록 위임 — silent swallow 안티패턴 없음. CLAUDE.md '빈 catch 금지' 위반 0.
- PASS — stub/TODO/placeholder 부재: 3종 + README 전수 확인, TODO/HACK/FIXME/placeholder 주석 0건. 모든 phase 가 실제 agent 호출 body 보유(빈 함수 stub 없음). 규칙3 'stub 발견 시 CRITICAL' 트리거 미발생.
- PASS — Graceful Degradation: `dual-gate` 의 itemRec 우선순위 REJECT>FIX>APPROVE(`...js:148-152`)가 보수적으로 엄격측으로 강등. incomplete/circularViolation 플래그가 은폐 없이 상위로 전파(`:157-159` → `:273`). 4pass 의 적대 반증 refuted→폐기(`:185`)도 거짓 양성 제거 방향.
- PASS — args 정규화 robust: `4pass-review.js:18-24` `a=args||{}`, isStr 분기, `Array.isArray` 가드, label 정규화 `.replace(/[^a-zA-Z0-9._-]/g,'-')`(경로 인젝션 차단). `5persona-debt.js:15-20` 동일 패턴. undefined args 에서도 크래시 없음.
- PASS — severityAdjust 전이 로직: `4pass-review.js:187-191` downgrade(CRITICAL→MAJOR, MAJOR→MINOR), upgrade(MAJOR→CRITICAL) 모두 단조. MINOR 는 L161 에서 검증 대상 제외되므로 fallback `:MINOR`(L188)는 MAJOR→MINOR 에만 적용 — 논리 정합, off-by 오류 없음.
- PASS — Formula Engine 동적 코드 실행: 3종에 eval/new Function/동적 import 0건. JSON.stringify/JSON.parse(암시)만 사용. math.js AST 외 동적 실행 금지 규칙 위반 0.
- PASS — 데이터 참조 정합: dual-gate 하드코딩 11개 expected ID 전부 approved-nodes-corpus.json 에 정확히 1 hit(Bash grep). schema.ts:319-345 exam_questions 컬럼 정의 = 참조 라인 범위와 일치.
- N/A — D1 `.first()` null 크래시: 본 3종은 dev 하네스 오케스트레이션 JS 로 D1/Drizzle 쿼리를 직접 실행하지 않는다. DB 접근은 에이전트 프롬프트가 grep/Read(정적) 또는 wrangler(별도)로 위임. 스크립트 자체에 `.first()`/db.query 호출 0건.
- N/A — Vectorize/Claude API/pdfplumber subprocess: 스크립트가 직접 호출하지 않음. dual-gate 는 오히려 vector/graph 호출을 순환편향(G-6b-1)으로 금지하고 `usedMeasurementSystem===false` 를 schema 로 강제(`...js:65-68`, `:159` circularViolation 집계).

**🟡 MINOR #1 — pipeline reduce-fn 이 동기 객체와 Promise 를 혼합 반환** (`4pass-review.js:159-195`)

pipeline 의 reduce 콜백 `(passResult, p)=>{...}` 이 두 분기에서 서로 다른 종류를 반환한다: (a) `toVerify.length===0` 일 때 plain object `{ pass, findings, checkedItems }`(L162-163), (b) 그 외 `parallel(...).then(...)` 이 반환하는 `Promise<object>`(L164-194). 하네스 pipeline 이 각 reduce 결과를 `Promise.resolve()`/await 로 정규화하면 무해하나, sync 값을 그대로 reviewed 에 넣고 Promise 만 await 하는 비대칭 구현이라면 reviewed 에 Promise 객체가 섞여 L200-208 의 `r.findings`/`r.pass` 접근이 undefined 가 되어 발견이 조용히 누락된다. 원시 함수 정의가 리포 어디에도 없어(grep 0) 계약 검증 불가 — Surgeon 관점 '단독으로 터지는 경로'로 보수적 표기.

- 확인: `4pass-review.js:162-163` — `if (!toVerify.length) return { pass, findings, checkedItems }` (동기 object 반환)
- 확인: `4pass-review.js:178-194` — else: `return parallel(...).then((verified)=>({ pass, checkedItems, findings:[...] }))` (Promise 반환)
- 확인: `4pass-review.js:200-208` — `reviewed.filter(Boolean).flatMap(r=>(r.findings||[])...)` 는 r 이 settled object 임을 전제 (Promise 면 r.findings===undefined → []로 흡수되어 발견 silent drop)
- 확인: Bash grep — 'pipeline'/'parallel'/'agent' 원시 정의가 .claude 내 0건 (하네스 글로벌, README:3 'Workflow 툴' 런타임 제공)

**적대 반증(Devil's Advocate):** README:3 가 명시한 Workflow 툴 런타임은 phase/agent/pipeline/parallel/log 를 await 친화적으로 정규화하는 것이 정상 설계이며, 5persona-debt.js 와 dual-gate 도 `await parallel(...)` 으로 동일 패턴을 일관되게 사용한다. 따라서 하네스가 reduce 반환값을 일괄 await 할 개연성이 높아 실제로는 무해할 수 있다. 다만 원시 계약이 문서/코드로 고정돼 있지 않아, 하네스 버전 변경 시 이 비대칭이 회귀 표면이 된다(테스트 통과=안전 가정 금지). → **반증 미통과, MINOR 유지.**

**🟡 MINOR #2 — synthesize 의 critical/major/minor 카운트가 LLM 자가 산출값 (코드 집계와 교차 검증 없음)** (`5persona-debt.js:109-135, 137-147`)

5persona-debt.js 는 4pass-review.js(L203-205 에서 crit/major/minor 를 코드로 `.filter` 집계)와 달리, synthesize 에이전트의 schema(critical/major/minor: number)에 카운트 산출을 위임하고 그 반환값을 그대로 log·return 한다(L137-146). 즉 합계가 LLM 이 보고한 숫자이며 코드가 valid[].findings 를 다시 세어 대조하지 않는다. 에이전트가 dedup/병합 과정에서 합계를 잘못 보고하면 '완료 기준 = 5-페르소나 CRITICAL 0'(L118) 판정이 거짓 음성(실제 CRITICAL 존재하나 0 보고)이 될 수 있다. dual-gate 도 brief 의 gateBApprove 등을 schema number 로 받지만, 그쪽은 코드측 gbApprove/gbFix(L226-229)를 별도로 계산해 return(L273)에서 코드값을 우선 사용하므로 방어가 있다 — 5persona 에는 그 이중 집계가 없다.

- 확인: `5persona-debt.js:124-131` — synthesize schema 가 critical/major/minor 를 `{type:'number'}` 로 에이전트에 위임
- 확인: `5persona-debt.js:140-146` — `return { critical: synth.critical, ... }` 로 LLM 보고값 그대로 전파 (코드 재집계 없음)
- 확인: `4pass-review.js:203-205` — 대조군: `const crit = allFindings.filter(f=>f.severity==='CRITICAL')` 로 코드가 직접 집계
- 확인: `dual-gate...js:226-229,273` — 대조군: gbApprove 등을 코드로 계산 후 return 에서 코드값 사용 (LLM brief 값과 분리)

**적대 반증(Devil's Advocate):** synthesize 에이전트는 valid[] 전체(L113 에서 JSON.stringify 주입)를 받아 교차 dedup 하므로 병합 후 카운트가 원본 합계와 다른 것이 정상(중복 1건 병합 등)이다. 따라서 코드 재집계와 LLM 카운트가 의도적으로 달라질 수 있어 단순 대조가 오히려 거짓 경보를 낼 수 있다. 그러나 'CRITICAL 0 = 완료'라는 게이트가 LLM 자가 보고 단일 숫자에 의존하는 것은, 본 프로젝트가 반복 학습한 '자기 채점 금지'(CLAUDE.md 검증 원칙) 정신과 긴장 관계 — 최소한 valid[] 내 raw CRITICAL 개수를 floor 로 함께 surface 하면 거짓 음성을 막는다. → **반증 미통과, MINOR 유지.**

---

### Pass 2 (Architect): ✅ 5건 확인 / 🔴 0건 / 🟠 0건(MAJOR) / 🟡 1건(MINOR) / N/A 8건

**관점: "이 코드가 다른 모듈과 만나면 터지는가?"**

확인:

- N/A — Import 방향 packages/ 단방향: 3개 스크립트는 dev-harness 순수 JS 로 packages/ import 0건. harness primitive(agent/phase/pipeline/parallel/log + args 전역 주입). schema.ts:51-52 의 '@thepick/shared'·'@thepick/learning-modes' import 는 타입 파생 전용 단방향 정상.
- N/A — Workers 제약(fs/path 금지/CPU 50ms/번들): 3 스크립트는 Workers 런타임 코드 아님(오케스트레이션 dev 하네스). fs/path 직접 사용 0, Workers 번들 미포함.
- PASS — D1 스키마 일치(Drizzle↔D1): schema.ts:319-345 exam_questions 컬럼 정의(content/answer/explanation/related_nodes/distractors/calc_variables/input_type 등)와 `dual-gate...js:18-19,174-176` 가 참조하는 'schema.ts:319~345' 라인 범위가 grep 으로 정확히 일치(examQuestions 시작 319, '});' 종료 345). distractors 실재 확인(schema.ts:340).
- N/A — Ontology Lock(새 ID ontology-registry 등록): 3 스크립트는 신규 노드/엣지 ID 를 생성하지 않음(read-only 검증 오케스트레이션). dual-gate 참조 expected ID 11종(LAW-002/003/004, CONCEPT-080/105/023, INS-08/21, INV-035/060, F-103)는 전부 approved-nodes-corpus.json(488 노드)에 실재 — 11/11 IN CORPUS 확인.
- N/A — truth_weight 정렬(LAW>FORMULA>CONCEPT): 3 스크립트는 RAG 결과를 LLM 에 주입하는 런타임 경로 아님. golden expected 에 LAW/FORMULA/CONCEPT 혼재하나 채점 ground-truth 라벨일 뿐 주입 순서와 무관.
- N/A — Temporal Graph(UPDATE 대신 INSERT+SUPERSEDES): 3 스크립트는 D1 write 0(dual-gate 명시 read-only). UPDATE/INSERT SQL 미발행. TR-0 plan 자체가 본문 SUPERSEDES 유지 + 메타 화이트리스트(0038 신설) 정상 경로 설계.
- N/A — IndexedDB↔D1 동기화: 클라이언트 오프라인 큐/Background Sync 코드 미포함(서버측 평가 하네스).
- PASS — 다이어그램/문서 정합성: dual-gate js 가 참조하는 9개 파일 전부 존재(grep OK), backend.md C-4(line 161)·C-7(line 308) 앵커 실재, README.md:43-51 가 TR-0 trigger 차단을 정확히 기술(0004:39-43 prevent_exam_questions_update ABORT → 마이그 0038 후 backfill 가능).
- N/A — Hexagonal 위반(domain→infrastructure 직접 참조): 3 스크립트는 modules/ domain 계층 코드 아님.
- PASS — i18n 한국어 하드코딩: 3 스크립트의 한국어 문자열은 전부 sub-agent 전달 dev 프롬프트/로그(4pass-review.js:148-156, 5persona-debt.js:90-100, dual-gate js:109-129) — 사용자(수험생) 노출 UI 문자열 아님. i18n 키 대상 아님.
- PASS — 비결정성(Date.now/Math.random/new Date): README.md:4 '순수 JS, Date.now/Math.random 불가' 정책 대조 — 3 스크립트 전수 grep 0건. 타임스탬프는 sub-agent 가 `date +%Y%m%d-%H%M%S` 셸 실행으로 획득(4pass js:212, 5persona js:111, dual-gate js:241).
- PASS — 데이터 정합(스크립트 하드코딩 vs 소비 파일): `dual-gate js:23-36` ITEMS 배열(12문항 qid/measurable/expected/hop)이 golden-pilot-draft.json items 12건과 python 파싱 전수 대조 — qid·measurable·expected id·hop 전부 일치(Q-2025-11-2ND-015 의 [F-103,CONCEPT-105,CONCEPT-023] 포함). 드리프트 0.
- PASS — async/await 정합(Architect 연계): `4pass-review.js:144` pipeline 콜백 무발견 분기(L162-163)는 동기 객체, 발견 분기(L164-194)는 parallel().then() Promise — pipeline 이 두 branch 반환을 모두 await 처리한다는 전제. dual-gate 의 parallel().then() 패턴(js:143-164)도 동일 계약을 쓰고 1회 성공 실행 기록 있어 계약 충족 확인. (단 계약 미고정 표면은 Pass1 MINOR #1 로 분리 보고.)

**🟡 MINOR #3 — dual-gate 스크립트: meta.phases 3개 선언 vs 런타임 phase() 1개만 호출 (GateB/GateA 미선언)** (`dual-gate...js:5-10, 139, 216, 224, 238`)

meta.phases 는 GateB-Golden / GateA-TR0 / Brief 3 phase 를 광고하나, 런타임 phase() 선언 primitive 는 line 238 `phase('Brief')` 단 1회뿐이다. GateB-Golden(line 139)과 GateA-TR0(line 216)은 agent() 옵션 객체의 'phase:' 라벨로만 등장하고, 이 두 게이트를 실행하는 runGateB()/runGateA() 는 line 224 Promise.all 로 동시 launch 되며 그 앞에 phase 선언이 없다. 결과: phase 진행 표시/타임라인 관측에서 두 게이트 단계가 누락 표기되거나 'Brief' 단일 phase 로만 집계될 수 있다. 단 스크립트가 '이미 1회 실행 성공'을 명시하므로(=harness 가 미선언 phase: 라벨 허용) 런타임 차단이 아닌 관측성/메타 정합 결함이다. 4pass-review.js(L69 'Scope', 143 '4-Pass', 199 'Report' 모두 명시 선언) 및 5persona-debt.js(L86 'Persona', 107 'Synthesize' 모두 선언)와 대비된다.

- 확인: `dual-gate js:5-10` — meta.phases 에 GateB-Golden/GateA-TR0/Brief 3개 title 선언 확인
- 확인: `dual-gate js:238` — grep 결과 런타임 phase() 호출은 `phase('Brief')` 단 1건 (line 139·216 은 `phase: '...'` 스키마 옵션 문자열로 declaration 아님)
- 확인: `dual-gate js:224` — runGateB()/runGateA() 가 Promise.all 로 동시 실행, 그 이전 어떤 phase() 선언도 없음
- 확인: `4pass-review.js:69,143,199` + `5persona-debt.js:86,107` — 비교 대조: 이 두 스크립트는 모든 phase 를 phase() 로 명시 선언(정합), dual-gate 만 비정합
- 확인: 스크립트 스코프 요약 — '이미 1회 실행 성공한 일회성' 명시 → harness 가 미선언 phase: 라벨을 tolerate (런타임 fail 아님 입증)

**적대 반증(Devil's Advocate):** harness 의 phase() 가 단순 표시용이 아니라 동시성 barrier/리소스 게이팅을 강제한다면, GateB/GateA 미선언이 동시 fan-out(12문항×3렌즈=36 + TR-0 4 리뷰어 = 동시 40 agent)의 rate-limit/리소스 제어를 우회시켜 throttle 실패를 일으킬 수 있다. 그러나 (a) Promise.all 이미 동시성을 명시적으로 의도, (b) 1회 성공 실행 기록이 있어 실제 throttle 폭발은 관측되지 않음 → **반증 미통과, MINOR 유지.**

**제안 수정:** runGateB() 진입부에 `phase('GateB-Golden')`, runGateA() 진입부에 `phase('GateA-TR0')` 추가, 또는 동시 실행 특성상 단일 phase 가 맞다면 meta.phases 를 2개('Dual-Gate'+'Brief')로 축약해 광고-실행 정합. 재사용 워크플로우 승격(README §31-32) 시 정합 의무.

---

### Pass 3 (Advocate): ✅ 9건 확인 / 🔴 0건 / 🟠 0건(MAJOR) / 🟡 1건(MINOR) / N/A 4건

**관점: "수험생과 공격자, 둘 다 만족하는가?"**

확인:

- N/A — 에러 UX(교재 O장 참고 Graceful vs 기술에러): 셋 다 dev 하네스 오케스트레이션으로 학습자 대면 에러 메시지를 렌더하지 않음. 산출물은 .claude/reviews/\*.md 개발자용 보고서뿐(4pass-review.js:210-230, 5persona-debt.js:109-135).
- N/A — 상태 표현(로딩/빈데이터/에러/오프라인 UI): UI 컴포넌트·렌더 코드 0건. agent/parallel/pipeline/phase/log Workflow 툴 호출만(4pass-review.js:69-196). 빈 결과는 reports.filter(Boolean)/valid.filter 로 배열 정제(UI 상태 아님).
- N/A — 오프라인 Service Worker 캐싱: SW/Cache API/PWA 코드 없음.
- N/A — 접근성(터치44px/키보드/aria-label): 모바일 학습자 UI 코드 0건. `4pass-review.js:127` 의 'aria-label' 문자열은 Advocate 체크리스트를 에이전트에 전달하는 프롬프트 텍스트일 뿐 실제 마크업 아님.
- PASS — 보안: API키/시크릿 하드코딩: grep `-niE 'api_key|secret|token|password|sk-|process.env'` 3파일 전수 — 매치는 4pass-review.js:128(체크리스트 프롬프트 문자열) + 5persona-debt.js:81(devops 포커스 'secret 로테이션')뿐, 실제 자격증명 0건. process.env/하드코딩 키 0건.
- PASS — 보안: XSS/innerHTML: grep `'innerHTML|eval(|exec(|child_process'` 3파일 — 실코드 매치 0건. 'innerHTML' 은 4pass-review.js:128 프롬프트 텍스트만. 동적 코드 실행 함수 미사용.
- PASS — 입력 검증/주입: `4pass-review.js:24` label 은 `replace(/[^a-zA-Z0-9._-]/g,'-')` 로 새니타이즈되어 파일 경로(review-<ts>-4pass-${label}.md, L218)에 안전 주입. gitRef(L23)는 새니타이즈 없이 `git diff ${gitRef}` 프롬프트(L74)에 들어가나, 셸 직접 실행이 아니라 에이전트 전달 지시 텍스트이며 args 출처가 신뢰된 호출자(개발자 본인)라 위협면 낮음 → PASS(주의 기록).
- PASS — 정답 안전 Hard Stop(골든 정답키 무결성): golden-pilot-draft.json items[].expected 의 11개 노드 ID 전부 approved-nodes-corpus.json 에 존재(Bash 전수 grep, 각 1건). 고아 expected 0건. measurable=false 5건은 expected:[] + proposedRelatedNodesRaw:null 로 분모 제외 명시(은폐 아님, README.md:20).
- PASS — 정답 안전(draft 격리): golden-pilot-draft.json:3-4 status='draft' + watermark '진산 미검수, assertRemoteMeasurementInputs 는 approved 파일만 허용'. golden-pilot-draft.md:3 동일 워터마크. Hard Limit 'AI 생성=draft, 인간검수 후 approved' 준수 — 미검수 데이터의 G-S5 측정 입력 차단.
- PASS — 정답 안전(순환편향 차단): `dual-gate...js:108` corpusHint + L128-129 circular 렌즈가 vector/api/search·graph-walk 호출 금지 명시, GOLDEN_LENS.usedMeasurementSystem(L65)가 호출 시 true 강제 + L159 circularViolation 집계 + brief L243 적색경고. 측정대상 시스템으로 골든 선정하는 순환오염을 다층 차단.
- PASS — stub/TODO/placeholder/빈catch: 3파일 grep `'try{/catch/.catch('` — 4pass-review.js:106(프롬프트 텍스트 '빈catch 금지')·156(체크리스트)만, 실제 빈 catch/stub/TODO/placeholder 0건. `.then()` 체이닝(4pass-review.js:176,178)은 에러 핸들링을 하네스에 위임하는 정상 패턴.
- PASS — 결정성(Date.now/Math.random): grep 3파일 모두 0건, README.md:4 'Date.now/Math.random 불가' 코드 확인. 타임스탬프는 에이전트가 `date +%Y%m%d-%H%M%S` 셸로 획득(4pass-review.js:212, 5persona-debt.js:111, dual-gate:241).
- N/A — Formula Engine/산식 정밀도: 산식 계산·math.js 미관여. Q-2025-11-2ND-015 의 보험금 계산(20,000,000-400,000 등)은 골든 문항 본문 데이터일 뿐 스크립트가 연산하지 않음.
- PASS — 트리거 재설계의 학습자 정답 회귀 방어: tr-0 plan §4.1/§5.1 G-TR0-3 가 본문+메타 혼합 UPDATE ABORT 명시, exam_questions 본문(content/answer/explanation, schema.ts:325-327)은 SUPERSEDES 유지. migrations/0004:39-43 원 트리거 = 전면 ABORT 라 학습자 정답 회귀 위험은 마이그 0038 미적용 현 시점 0(코드 무변경 plan 단계).

**🟡 MINOR #4 — dual-gate 스크립트가 골든 정답키(measurable/expected/hop)를 JSON 단일 진실원과 별개로 하드코딩 — 향후 drift 시 적대검증이 잘못된 정답키 기준으로 수행될 수 있음** (`dual-gate...js:23-36`)

ITEMS 배열이 golden-pilot-draft.json 의 items[].measurable / expected / hopGuess 를 그대로 복제 하드코딩한다(예: Q-2025-11-2ND-015 expected [F-103,CONCEPT-105,CONCEPT-023]). 이 값은 line 109 lensPrompt 에서 `measurable=${item.measurable}`, `expected=${JSON.stringify(item.expected)}` 로 에이전트 프롬프트에 직접 주입된다. '정답 안전(Hard Stop)' 관점에서 골든 정답키는 안전 임계 데이터인데, 두 곳(JS ITEMS + JSON)에 이중 보관되면 JSON 이 갱신(진산 FIX 반영)돼도 JS 가 안 따라가면 적대검증자가 stale 정답키 기준으로 APPROVE/FIX/REJECT 근거를 산출할 위험이 있다. 다만 (a) 현 시점 11개 expected ID 전부 JSON 과 일치(라이브 drift 0, Bash 대조 확인), (b) line 110 이 '문항 전문·why·proposedRelatedNodesRaw 는 GOLD_MD/GOLD_JSON 에서 Read 로 직접 확인하라'고 명시해 JSON 을 진실원으로 지정 → 하드코딩 값은 색인/힌트 역할로 강등. 일회성 실행 스크립트로 이미 1회 수행 완료라 실해 영향 제한적.

- 확인: `dual-gate...js:23-36` — ITEMS 가 qid/measurable/expected/hop 하드코딩, JSON items[] 와 동일 필드
- 확인: `golden-pilot-draft.json:243-254` — Q-012 expected INS-08/INV-035, 스크립트 line 33 과 일치 (drift 0)
- 확인: `golden-pilot-draft.json:306-322` — Q-015 expected F-103/CONCEPT-105/CONCEPT-023, 스크립트 line 35 와 일치
- 확인: `dual-gate...js:110` — GOLD_MD/GOLD_JSON Read 직접 확인 지시로 하드코딩을 색인 역할로 강등 (mitigation)
- 확인: Bash 전수 대조 — LAW-002~CONCEPT-023 11개 expected ID 가 corpus + JSON 양쪽에 모두 존재, 불일치 0건

**적대 반증(Devil's Advocate):** 진산이 검수 중 expected 를 정정(FIX)해 JSON 만 갱신하고 스크립트를 재실행하면, 에이전트는 line 109 의 stale 하드코딩 expected 와 line 110 의 갱신된 JSON 을 동시에 받아 모순된 정답키로 검증 → '근거정확성' 렌즈가 잘못된 baseline 으로 APPROVE 를 낼 수 있다. 반대로, 스크립트가 이미 1회 실행 완료된 일회성 산출물이고 README.md:31 가 '일회성은 인라인 script, 반복 가치 생기면 승격'이라 명시하므로 재실행 시나리오 자체가 설계상 비표준 경로 → **반증 미통과, MINOR 유지.**

**제안 수정:** 승격(named workflow) 시 ITEMS 의 measurable/expected 를 제거하고 qid 만 남긴 뒤 에이전트가 GOLD_JSON 에서 직접 파싱하도록 단일화. 일회성 유지 시 현 상태 충분 — 단 헤더 주석에 'ITEMS expected 는 색인일 뿐, 정답키 진실원은 golden-pilot-draft.json' 1줄 명시 권장.

---

### Pass 4 (Contract): ✅ 11건 확인 / 🔴 0건 / 🟠 0건(MAJOR) / 🟡 2건(MINOR) / N/A 2건

**관점: "구현 재정립서·프로토콜 대로 만들었는가? (Silent Pivot 탐지)"**

확인:

- PASS — 설계서 대조(Silent Pivot): `4pass-review.js:99-140` 의 4-Pass 정의(Surgeon/Architect/Advocate/Contract)와 체크리스트가 `auto-review-protocol.md:58-104` 원문과 1:1 일치(규칙0~4 포함). Silent Pivot 없음.
- PASS — `5persona-debt.js:47-83` 의 5 페르소나(refactoring-expert/performance-engineer/quality-engineer/backend-architect/devops-architect)와 핵심질문이 `auto-review-protocol.md:21-27` 표와 정확히 일치. '완료 기준 4-Pass CRITICAL 0 AND 5-페르소나 CRITICAL 0'(5persona-debt.js:118)도 protocol:42 와 일치.
- PASS — Hard Rule 17 (시험 ID 리터럴 단일 선언): grep 결과 3개 워크플로우 스크립트 어디에도 'son-hae-pyeong-ga-sa' 런타임 리터럴 없음. examId 는 golden-pilot-draft.json 데이터에만 존재(테스트/데이터 픽스처 예외 범주).
- PASS — production-quality 금지패턴: grep 결과 3 스크립트에 any 타입 0, console.log 0, 빈 catch 0, TODO/HACK/stub/placeholder 실코드 0 (4pass-review.js:156 의 'stub/TODO/placeholder' 는 리뷰어에게 발견 시 CRITICAL 보고하라는 프롬프트 문자열, 실제 stub 아님).
- PASS — README.md:4 '순수 JS(Date.now/Math.random 불가)' 주장 실증: grep 결과 3종 모두 Date.now·Math.random·new Date 0건. 결정성 주장 사실.
- PASS — 네이밍/노드 ID 컨벤션: dual-gate ITEMS(script:23-36)의 expected 노드 11종 전부 ontology 패턴(CONCEPT-NNN/F-NNN/INS-NN/INV-NNN/LAW-NNN) 준수 + approved-nodes-corpus.json(488 노드)에 각 1건 정확 존재.
- PASS — golden 데이터 정합: dual-gate ITEMS 12건(qid/measurable/hop/expected)이 golden-pilot-draft.json items 12건과 python 대조 완전 일치(드리프트 0). 단 동일 정답키 2곳 하드코딩=잠재 드리프트 표면(MINOR #4 로 분리 보고; 스크립트가 source 를 런타임 Read 하므로 현 무해).
- PASS — Hard Limit (knowledge_nodes/formulas/exam_questions UPDATE 금지) 비위반: 3 워크플로우는 dev 하네스로 D1 write 0. dual-gate lensPrompt(script:108)는 '★절대 vector/api/search·graph walk API 호출 금지 + usedMeasurementSystem=false 필수'로 순환차단(G-6b-1) 명시, read-only grep 만 지시.
- PASS — draft-only 격리(Hard Limit AI생성=draft): golden-pilot-draft.json:3-4 watermark + README.md:43-51 'golden-pilot-approved.json 동결은 D1 무변경(파일 영속만)' 명시. dual-gate brief(script:242)도 워터마크 영속 의무 지시.
- PASS — 배치 순서/게이트 직렬: dual-gate 은 TR-0 이중 게이트(golden 검수 + plan 결재)를 read-only 사전심사만 수행, 진산 결재 후 실시행(plan §6 인간 승인) 강제. 자율 코딩 차단 명시(brief:243).
- PASS — review-gate.sh 정합: 3 스크립트 모두 산출물을 `.claude/reviews/review-<ts>-*.md`(4pass/dual-gate) 또는 `phase<N>-tech-debt-<ts>-*.md`(5persona)로 Write 지시(4pass:218, 5persona:117, dual-gate:248). review-gate.sh:64 의 '독립 에이전트' 마커 grep 요건 충족 위해 보고서 리뷰방식 명시 의무 프롬프트화(4pass:213).
- N/A — 수치/임계값 ↔ 교재 원문 대조: 워크플로우 스크립트는 constants 산식값을 다루지 않음(오케스트레이션 메타데이터만).
- N/A — Formula Engine/동적 코드 실행: 3 스크립트에 math.js·eval·Function 생성자 사용 0건.

**🟡 MINOR #5 — TR-0 plan 이 status 머신 트리거를 '0008 정책 트리거'로 2회 지칭 — 실제는 migration 0010 (0008은 webhook_events)** (`docs/plans/tr-0-backend-c7-trigger-redesign.plan.md:53, 92`)

plan §2(53행) '상태 머신 ... 0008 정책 트리거가 별도 보호' + §5.1 G-TR0-4(92행) '기존 0008 정책 트리거(별도 가드)와 충돌하지 않음' 으로 status_transitions 일방향 트리거를 migration 0008 에 귀속한다. 실제 grep 결과 status_transitions 의 prevent_status_transitions_update / enforce_status_transitions_one_way 는 migrations/0010_status_transitions_and_page_ref_guard.sql:49,99 에 있고, migration 0008 은 webhook_events(0008_webhook_events.sql)다. plan 의 마이그레이션 참조 번호가 틀렸다. G-TR0-4 가 '0008 트리거와 비충돌'을 검증하라고 지시하면 검증자가 잘못된 파일을 열게 된다.

- 확인: `tr-0 plan:53` — '0008 정책 트리거가 별도 보호 (정합 확인 필요)'
- 확인: `tr-0 plan:92` — G-TR0-4 '기존 0008 정책 트리거(별도 가드)'
- 확인: grep — `migrations/0010_status_transitions_and_page_ref_guard.sql:49` prevent_status_transitions_update / `:99` enforce_status_transitions_one_way
- 확인: `migrations/0008_webhook_events.sql:73,84` = webhook_events status enum/transition (exam_questions 무관)

**적대 반증(Devil's Advocate):** 거짓양성 시나리오: dual-gate-prescreen 스크립트 Migration-safety 리뷰어(script:193)가 정확히 'grep -lE "status|superseded|valid_until" migrations/\*.sql 로 status 머신 트리거의 실제 위치를 찾아 plan 의 0008 참조 정확성 검증(틀리면 MAJOR+ 보고)' 하도록 명시 설계 — 즉 이 오류는 워크플로우가 의도적으로 잡도록 만든 것이고, plan §2 도 '정합 확인 필요'로 미확정을 자인했다. 게이트가 닫으므로 운영 영향은 낮아 MINOR. 그러나 plan 이 in-scope 산출물이고 진산 결재 입력이므로 문서 자체의 사실 오류로 보고 유지. → **반증 미통과, MINOR 유지.**

**🟡 MINOR #6 — TR-0 plan §2 컬럼 분류가 exam_questions 실제 컬럼 2개(confusionType, calcVariables) 누락 — 트리거 본문 가드 enumeration 불완전 위험 (MAJOR→MINOR 강등)** (`docs/plans/tr-0-backend-c7-trigger-redesign.plan.md:47-53, 89`)

TR-0 plan §2 는 exam_questions 컬럼을 본문(content/answer/explanation/subject/year/round/questionNumber/examType) / 메타데이터(related_nodes/related_constants/topic_cluster/memorization_type/input_type/distractors) / 상태머신(status/superseded_by/valid_until/valid_from) 3분류한다. 그러나 apps/api/src/db/schema.ts:319-345 실제 컬럼 전수 대조 결과, `confusionType`(schema.ts:337)과 `calcVariables`(schema.ts:341) 2개가 어느 분류에도 없다. 특히 `calcVariables` 는 근거 보고서 backend C-7 §1(phase2-tech-debt-...-backend.md:341)이 메타데이터 화이트리스트 대상으로 명시 열거했는데 plan 이 옮기며 누락했다. 마이그 0038 의 WHEN 절 본문 enumeration 을 이 불완전 목록으로 작성하면, plan §4(74행)가 스스로 '치명'으로 분류한 '본문 컬럼 enumeration 누락' 위험이 그대로 실현될 잠재성이 있다. 단 마이그 SQL 코드는 아직 미작성(인간 승인 대기, plan §6)이므로 현 시점은 plan 문서의 enumeration 결함이다.

- 확인: `schema.ts:337` `confusionType: text('confusion_type')` — plan §2 어느 분류에도 부재
- 확인: `schema.ts:341` `calcVariables: text('calc_variables')` — plan §2 메타 목록에서 누락, 그러나 backend.md:341 은 메타로 명시
- 확인: `tr-0 plan:47-53` — 본문 8 + 메타 6 + 상태 4 = 18 컬럼만 분류, 실제 schema 는 22 컬럼(id/createdAt 제외 20)
- 확인: `tr-0 plan:74` — 위험표 스스로 '본문 컬럼 enumeration 누락(e.g. explanation) = 치명' 명시

**적대 반증(Devil's Advocate) + 심각도 판정:** refuted=false (발견의 사실 골격은 Read 전수 확인 결과 모두 참). 그러나 severityAdjust=**downgrade (MAJOR→MINOR)**.

- 검증된 사실(발견 유지 근거): confusionType(schema.ts:337)·calcVariables(schema.ts:341) 실존 컬럼이 plan §2 3분류 어디에도 없음. calcVariables 는 backend.md:340-341 이 메타로 명시 열거한 것을 plan 이 떨어뜨림. plan §2 = 18 컬럼만 분류 vs schema 실제 20(id/createdAt 제외). 누락 정확히 2개. plan §4(74행) 스스로 '본문 enumeration 누락=치명' 명시, G-TR0-1(89행)도 동일 8-컬럼 본문 목록을 테스트셋으로 상속 → §2 결함이 게이트까지 전파. plan §2 51행 자인('schema.ts 326~340 추가 점검 필요')은 distractors 에 붙은 것이고 가리키는 범위(326~340)가 calcVariables(341행)를 벗어남 + confusionType 미언급 → 자인 hedge 가 실제 gap 을 못 덮음. devil's advocate 의 핵심 반박('dual-gate-prescreen 의 Migration-safety/Aan-skeptic 스크립트가 실행 시 적발')은 레포 전수 검색 결과 해당 스크립트가 코드로 존재하지 않음(.md 산출물만) → '게이트가 닫는다' 완화책 신뢰 불가, 발견 폐기 근거 불성립.
- MINOR 강등 근거(MAJOR 과대평가): (A) plan §3(59행) 트리거 설계 = '본문 컬럼 변동 時만 ABORT'(본문 enumeration ABORT + 기본 ALLOW). 이 의미론에서 미분류 메타 컬럼은 기본 ALLOW = 정확한(허용) 동작. 발견이 인용한 치명 분기 '미분류 컬럼이 본문이면 정답 회귀'는 본 plan 실제 설계로는 발현 안 됨. (B) 누락 2 컬럼 모두 메타 성격(confusionType=혼동모드 분류, calcVariables=계산입력 JSON — answer/explanation 진실값 아님) → 가드 우회=정답회귀 시나리오 비현실적. (C) 마이그 SQL 미작성(§6 인간승인 게이트) → 현 시점 plan 단계 enumeration 완전성 결함이지 출하 결함 아님. (D) plan 이 ADR-046 schema.ts 1:1 대조표(§4 74행) + 본문 컬럼 전수 ABORT 테스트(§5)를 SQL 착수 前 의무화 — 실제 plan 의무 backstop 존재.
- 결론: 발견은 진짜 문서 결함(§2 목록이 0038 WHEN 절·G-TR0-1 테스트셋의 1차 입력이며 실 스키마와 불일치, calcVariables 는 출처보고서 메타 명시를 떨어뜨림)이라 폐기 불가. 잔여 위험은 '§2 를 20 컬럼 전수로 정정 + 기본 ALLOW 의미론 명시'의 문서 정확성 수정이며, 본 plan 설계상 치명 정답회귀 분기 비발현 + SQL 미착수 + 대조표/테스트 의무 backstop 존재로 **MINOR 가 타당.**

---

## 발견 요약 (반증 통과분만)

| #   | Severity | Pass      | 파일:라인                   | 제목                                                                            |
| --- | -------- | --------- | --------------------------- | ------------------------------------------------------------------------------- |
| 1   | MINOR    | Surgeon   | 4pass-review.js:159-195     | pipeline reduce-fn 이 동기 객체와 Promise 혼합 반환 (하네스 정규화 계약 미고정) |
| 2   | MINOR    | Surgeon   | 5persona-debt.js:109-147    | synthesize critical/major/minor 카운트가 LLM 자가 산출 (코드 교차 검증 없음)    |
| 3   | MINOR    | Architect | dual-gate...js:5-10,224,238 | meta.phases 3개 선언 vs 런타임 phase() 1개만 호출 (관측성/메타 정합)            |
| 4   | MINOR    | Advocate  | dual-gate...js:23-36        | 골든 정답키를 JSON 진실원과 별개로 하드코딩 (drift 표면, 현 일치)               |
| 5   | MINOR    | Contract  | tr-0 plan:53,92             | status 머신 트리거를 '0008'로 2회 지칭 (실제 0010)                              |
| 6   | MINOR    | Contract  | tr-0 plan:47-53,89          | §2 컬럼 분류가 confusionType/calcVariables 2개 누락 (MAJOR→MINOR 강등)          |

**합계: CRITICAL 0 / MAJOR 0 / MINOR 6**

비고: MINOR 5·6 은 변경 JS 3종 자체가 아닌 연관 in-scope plan 문서(tr-0)의 결함이나, dual-gate 스크립트가 그 plan 을 검증 입력으로 직접 참조하므로 본 리뷰 범위(규칙 1: 변경+연관 전수)에 포함하여 보고한다. 변경 JS 3종 자체에는 CRITICAL/MAJOR 0, MINOR 4(#1~#4).

---

## 판정: 완료 가능

근거: 4-Pass 전 Pass(Surgeon/Architect/Advocate/Contract) CRITICAL 0건 + MAJOR 0건. MINOR 6건은 규칙 4 ('Minor 는 보고만')에 따라 즉시 수정 의무 없음. 단 아래 후속 조치를 권고로 남긴다(차단 아님).

- (권고, 비차단) MINOR #1/#3: 두 스크립트를 README §31-32 재사용 워크플로우로 승격하기 전에 pipeline 반환 정규화 계약 문서화 + dual-gate phase 선언 정합 맞춤.
- (권고, 비차단) MINOR #2: 5persona synth 카운트에 valid[] raw CRITICAL floor 동시 surface 로 LLM 자가 채점 거짓 음성 방어.
- (권고, 비차단) MINOR #5/#6: TR-0 plan 마이그 0038 SQL 착수(인간 승인) 前 — §2 의 '0008' → '0010' 정정 + §2 컬럼 분류를 schema.ts 20 컬럼(confusionType/calcVariables 포함) 전수로 보강 + 기본 ALLOW 의미론 명시. (L3 영역, 자율 코딩 금지 — plan §6 인간 승인 게이트 유지.)

────────────────────────────────────
