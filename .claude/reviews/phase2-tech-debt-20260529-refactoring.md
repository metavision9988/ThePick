# 기술부채 리뷰 — refactoring-expert (코드 품질 부채 6mo~2yr horizon)

- 리뷰 시점: 2026-05-29
- 리뷰 범위 (실제 읽은 파일 — 28개):
  - 정책 문서: `CLAUDE.md`, `.claude/rules/production-quality.md`,
    `.claude/rules/dev-guide.md`, `.claude/rules/auto-review-protocol.md`
  - `packages/shared/src/types.ts`, `exam-adapter.ts`, `constants/exam-ids.ts`
  - `packages/formula-engine/src/`: `engine.ts`, `ast-parser.ts`, `sandbox.ts`,
    `constants-resolver.ts`, `formulas/index.ts`, `formulas/batch5-definitions.ts`
  - `packages/parser/src/`: `batch-processor.ts`, `schema-validator.ts`,
    `ontology-registry.ts`, `ontology-registry.json`, `normalizer.ts`,
    `section-splitter.ts`, `package.json`
  - `packages/parser-1st-exam/src/`: `index.ts`, `types.ts`
  - `packages/ai-adapter/src/`: `types.ts`, `index.ts`
  - `packages/srs/src/fsrs.ts`
  - `packages/quality/src/normalizer.ts`
  - `packages/study-material-generator/src/index.ts`
  - `apps/api/src/`: `index.ts`, `search/routes.ts`, `search/user-search.ts`,
    `search/graph-search-route.ts`, `search/graph-walk/index.ts`,
    `search/approved-nodes-sql.ts`,
    `search/multi-path-fallback/topic-cluster-router.ts`,
    `auth/routes.ts`, `middleware/retry.ts`, `eval/multihop-accuracy.ts`,
    `vectorize/upserter.ts`
  - `apps/web/src/`: `lib/study-api.ts`, `components/StudyFlow.tsx`,
    `components/AuthForm.tsx`, `components/ProgressSummary.tsx`,
    `components/QuestionCard.tsx`
- 4-Pass 결과와 중복 금지 확인: ✓ (본 리뷰는 6mo~2yr 부채 — 단건 정합성/보안/
  성능/테스트/배포는 본 스코프 외)
- 다른 4 페르소나 스코프 회피 확인: ✓
  (performance/quality/backend/devops — 본 리뷰에서 다루지 않음)

---

## CRITICAL (6개월 내 폭발) — 3건

### C-1. 시험 특화 컬럼 `lv1_insurance`/`lv2_crop`/`lv3_investigation`이 10+ 파일에 직접 컬럼명으로 박혀 있음

- **파일**: `packages/parser/src/schema-validator.ts:34-36`,
  `packages/parser/src/batch-processor.ts:211-213`,
  `apps/api/src/vectorize/upserter.ts:73-74`,
  `apps/api/src/vectorize/routes.ts:115,116,335,375,376`,
  `apps/api/src/vectorize/table-fetcher.ts:50-51,174-175,217-218,249-250,288`,
  `apps/api/src/vectorize/topic-cluster-fetcher.ts`,
  `apps/api/src/search/multi-path-fallback/topic-cluster-router.ts:8-10,307`,
  `apps/batch/src/loader/draft-loader.ts:315,334-336`
  (`grep -c lv1_insurance` 결과 **102 occurrences in 13 production files**).
- **증상**: D1 컬럼 식별자 `lv1_insurance`(보험 종목), `lv2_crop`(작물),
  `lv3_investigation`(조사) — 손해평가사 도메인 어휘 — 가 **인터페이스 타입
  필드**, **SQL SELECT/INSERT 컬럼 목록**, **Vectorize 메타데이터 키**,
  **호환 매핑 분기 주석**까지 모든 레이어에 평문 문자열로 산재. `shared/
exam-adapter.ts:32` 가 "Year 2 Phase 4에 lv1/lv2/lv3 으로 일괄 변경"
  목표를 선언했으나 **현 시점 컴파일러/린터로 강제되는 경계 없음**.
- **근본원인**: 두 가지 동시 발생. ① ADR-007 멀티시험 이월 결정의
  abstraction layer (`LevelTaxonomy {lv1,lv2,lv3}` in `shared/exam-adapter.ts:
44`)가 **타입만 선언되고 실제 코드는 D1 raw row shape 을 그대로 통과**시킴
  — `KnowledgeContractNode.lv1_insurance?: string` 를 schema-validator 가
  공개 타입으로 export 하면서 `loader → API → Vectorize → search` 까지
  payload 가 같은 시험-특화 이름을 들고 다님. ② `topic-cluster-router.ts:8-13`
  은 이미 "production cluster.lv1 ≠ kn.lv1_insurance" 라는 명명 비대칭으로
  복잡한 우회를 만들었고, 그 자체가 부채가 적층됐다는 증거.
- **6개월/2년 시나리오**:
  - **6개월**: Year 2 공인중개사 PoC 진입 시점에 schema-validator의
    `KnowledgeContractNode` 가 모든 파서 호출자의 입력 형태이므로, 단일 컬럼
    rename `lv1_insurance → lv1` 하려면 13 파일·~100라인의 동시 수정.
    동시 변경량이 1 PR 한계를 넘어 staged migration 강제 → 중간 상태에서
    runtime contract 충돌(INSERT 컬럼 mismatch) 위험.
  - **2년**: 3번째 시험 추가 시 이미 `cluster.lv1 ≠ kn.lv1_insurance` 같은
    명명 비대칭 우회가 **두 시험치** 굳어져 있어 일반화된 `lv1`로 평탄화하는
    것이 사실상 불가능해짐. 시험별 마이그레이션 비용이 누적 비선형.
- **권장 조치**: (Year 2 진입 전 — 코드 동결 윈도우 활용)
  1. `packages/shared/src/types.ts` 에 **데이터 평면 타입** `KnowledgeNodeRow
{id, type, name, lv1, lv2, lv3, ...}` 신규 export. `LevelTaxonomy` 는
     이미 존재 — 거기에 `Domain` brand 추가.
  2. `schema-validator.ts:34-36` 의 `lv1_insurance` 옵션 컬럼명을 유지하되,
     **즉시 `lv1`로 alias 매핑**하는 `normalizeContractNode()` 어댑터를 동일
     파일에 추가 → 모든 downstream 은 `KnowledgeNodeRow.lv1` 만 본다.
  3. D1 마이그레이션은 그대로 두고(ADR-007 Year 2 이월) **D1 ↔ 도메인 경계**
     를 1줄 함수(`mapD1RowToNode`)로 분리 → SELECT projection 만 한 곳에서.
- **우선순위 근거 (왜 CRITICAL인가)**: Year 2 진입 = WBS 상 차순위 마일스톤.
  현 시점 13파일·~100라인 산포 = Year 2 시작일부터 `git diff` 폭발 → 코드
  리뷰 사각 → 멀티시험 contract drift. 작업 비용 1주 vs Year 2 진입 후
  3~4주 + 회귀 위험 = 5배 차. 단순 rename 이 아니라 **경계 도입**이라는
  점에서 지금 안 하면 영원히 못 한다.
- **반론**: ADR-007 이 "Year 2 Phase 4 일괄 변경" 으로 명시하고 5-페르소나
  리뷰 등에서 합의됐다 → 본 작업은 "Year 2 까지의 비용 vs 지금 비용"
  trade-off 의 의도된 선택. 다만 그 합의는 LOC 증가 추세 (현 13 파일이
  6개월 후 20+) 를 가정에 반영하지 않았으므로 **재평가**는 필요.

---

### C-2. `service: 'thepick-api'` 리터럴 + `resolveLoggerEnv()`/`buildLogger()` 6 파일 복제

- **파일**: `apps/api/src/index.ts:138,209` (resolveLoggerEnv 정의 +
  service 인라인), `auth/routes.ts:94-103`, `webhooks/payment.ts:111`,
  `progress/routes.ts:62`, `telemetry/routes.ts:55-64`,
  `study/routes.ts:79,93`. 검색 라우트는 `createLogger` 인라인.
- **증상**: 동일한 6줄 헬퍼 (`resolveLoggerEnv` + `buildLogger`) 가 **6 라우트
  모듈에 글자 단위로 복제**. `service: 'thepick-api'` 리터럴이 최소 **8회**
  반복. `KNOWN_ENVIRONMENTS = Set<LoggerEnvironment>(['development', 'staging',
'production', 'test'])` 도 같은 6 파일에 복제 위험 (`index.ts:70-75` 는
  이미 정의).
- **근본원인**: `packages/shared/logger.ts` 가 `createLogger({service, env})`
  까지만 제공하고 "thepick-api 서비스의 표준 logger" 팩토리는 **각 라우트가
  자체 구성**. 즉 _시작 wiring_ 의 single source 부재.
- **6개월/2년 시나리오**:
  - **6개월**: Sentry 도입 결정(`feedback_single_vendor_cloudflare` 메모리
    상 미채택이나 Cloudflare Logpush 옵션 진입 시) → tracing context 주입을
    "한 곳" 에서 못함 → 6 파일 동시 수정 강제. 한 파일 빠뜨리면 무성 관측
    사각.
  - **2년**: 멀티시험 진입 시 `service: 'thepick-api'` 가 시험별 분리되거나
    sub-service 화 (예: `thepick-api/search`, `thepick-api/auth`) 가 자연
    수순. 현 복제 구조는 **부분 분리 불가** — 다시 6 파일 변경.
- **권장 조치**: `apps/api/src/middleware/logger-factory.ts` 신규 (50줄).
  `function loggerForRoute(env, route: string): Logger` 단일 export.
  `KNOWN_ENVIRONMENTS` 도 동일 파일로 이전. 6 라우트가 import 만.
  `service` 리터럴은 동 파일 1곳에만 등장 — Cloudflare 단일 벤더 원칙
  유지하면서 향후 transport 교체 가능.
- **우선순위 근거**: Devops/observability 페르소나는 _운영_ 관점 — 본 리뷰는
  _코드 구조_ 관점에서 별개 사안. 이 부채는 매 신규 라우트마다 1줄씩
  증식(현재 6 → 신규 라우트당 +1) 하고 있어 **선형 누적**. 1년이면 10+,
  2년이면 15+ 라우트가 같은 헬퍼를 복제. 첫 한 번이 가장 싸다.
- **반론**: 각 라우트가 자체 logger 구성을 가지면 라우트별 환경 분기
  (`AUTH_COOKIE_SAMESITE` 같은 라우트 특수 binding) 처리 유연성이 있다 —
  factory 가 binding type 제네릭으로 깔끔히 풀려야 ROI 보장.

---

### C-3. `packages/study-material-generator` 가 `export {}` 만 — 빈 패키지로 모노레포 점유

- **파일**: `packages/study-material-generator/src/index.ts` (전체:
  `export {};`). 1줄.
- **증상**: 패키지가 `pnpm-workspace.yaml`/`package.json` 에 정식 등록되어
  있고 `CLAUDE.md §아키텍처` 에서 명시 ("packages/(parser, ...,
  study-material-generator, quality)") — 그러나 실 구현 0줄. 실제 학습자료
  생성 로직은 `apps/api/src/study/routes.ts` 2050줄 안에 인라인.
- **근본원인**: Engine-First Doctrine (`~/.claude/CLAUDE.md`) 이 "여러 모듈이
  의존할 코어 로직을 단독 패키지로 격리" 를 명시했으나, study-material
  생성 로직이 _초기에는 study/routes.ts 안에서 PoC_ → _Engine 분리 결재가
  매번 carry-over_ → 빈 패키지만 남고 실 로직은 라우트 안에 둠. 의도된 부재가
  아닌 **부채로서의 부재**.
- **6개월/2년 시나리오**:
  - **6개월**: `study/routes.ts` 가 현재 2050줄, 7 엔드포인트. 신규 학습 모드
    (예: confused-pair drill, formula-drill) 추가 시 3000줄 → 라우트와 도메인
    로직이 결합되어 **테스트 가능 단위 0**. 단일 함수 변경이 7 엔드포인트
    전체 회귀 표면.
  - **2년**: 멀티시험 진입 시 학습자료 생성은 시험별 분기 필수 — 현재
    `routes.ts` 안에 인라인된 로직을 시험별 adapter 로 빼려면 2050줄 → ~6
    모듈 분리 + 라우트 재작성. 동일한 양의 작업을 **두 번** 함 (한 번은 패키지
    재작성, 한 번은 시험별 분기).
- **권장 조치**: 즉시 study/routes.ts 의 도메인 로직 (난이도 결정, 카드 그
  룹화, 정답 채점) 을 `packages/study-material-generator/src/` 로 추출. 라
  우트는 thin wrapper. 빈 패키지면 차라리 **삭제** (`pnpm-workspace.yaml`
  제거) — 의도하지 않은 미래 사용을 차단. 둘 중 하나만 선택, 양립 불가.
- **우선순위 근거**: 빈 패키지 자체는 무해하지만 _routes.ts 비대화_ 가
  진짜 부채. `auth/routes.ts:746` / `study/routes.ts:2050` / `vectorize/
routes.ts:382` — Hono 라우트 모듈이 점점 비대해지는 **반복 패턴**.
  study 가 가장 큰 1건 + 빈 패키지가 _구조 의도_ 까지 박혀 있어 가장 싸게
  교정 가능.
- **반론**: Phase 3 학습 UX 진입 (`project_ux_north_star_phase3` 메모리) 까지
  routes 안에서 빠르게 iteration 후 분리하는 것이 더 안전 — premature
  abstraction 위험. 그러나 7 엔드포인트 + 2050줄은 이미 PoC 단계가 아님.

---

## MAJOR (1년 내 아픔) — 6건

### M-1. `packages/parser/src/batch-processor.ts:106-249` 시험-특화 system prompt 144줄 하드코딩

- **파일**: `batch-processor.ts:106` `"당신은 손해평가사 자격시험 교재를
분석하는 전문가입니다."` + 노드 ID prefix(`INS-NN`, `CROP-NNN`,
  `INVESTIGATION`), truth_weight 표(`INSURANCE: 6, CROP: 6` 등), 상수 카테고리
  (`insurance_rate`) 등 손해평가사 ontology가 prompt **본문에 직접 박힘**.
- **증상**: Hard Rule 15 (범용 계층 내 시험 특화 분기 금지) 의 정신 위반 —
  `packages/parser` (범용 계층) 에 손해평가사 prompt 가 있음. 한시 예외
  (CLAUDE.md `lv1_insurance` 등) 와 같은 등급으로 명시 _안 됨_.
- **근본원인**: prompt 구조가 ontology-registry.json 으로 평행하게 정의되어
  있음에도 (registry 가 ID 패턴 단일 진실원), prompt 본문은 별도로 직접
  값을 기재 → **registry 와 prompt 양쪽이 손해평가사 ontology를 복제**.
  Year 2 진입 시 prompt 를 시험별로 분기하지 않으면 공인중개사 BATCH 가
  LLM 에 손해평가사 컨텍스트를 받음.
- **6개월/2년 시나리오**: ontology-registry 가 v1.5.0 까지 진화하며 ID
  패턴이 추가될 때 prompt 본문이 자동 추종하지 않음 → 이미 ADR-032 v1.4→v1.5
  사이 표 노드 prefix (`TBL`, `TROW`, `TCOL`, `TCELL`) 가 prompt에 별도 추가됨
  (137~150줄). 매 ontology 개정 = 매 prompt 수정 = silent drift 위험.
- **권장 조치**: `packages/parser-1st-exam/src/prompt.ts` 신규 (Hard Rule 15
  정합 — 시험 특화는 `parser-1st-exam` 에). `buildSystemPrompt` 의 시험
  특화 sections(노드 ID 표, truth_weight 표, prompt 도입 문장) 를 generator
  function 으로 전달 (DI). registry 가 진짜 단일 진실원이면 prompt 도 거기서
  생성 (template literal).
- **반론**: Claude API system prompt 는 매번 캐싱(prompt caching)되어 LOC
  비용보다 LLM 토큰 비용이 더 큼. 그러나 본 부채는 _캐싱_ 이 아닌 _구조_
  문제 — Year 2 시험 추가 시 prompt 본문이 분기 0건이라는 점.

### M-2. graph-walk SQL 의 description 컬럼 `MIN()` 집계 — 우연 동작에 의존

- **파일**: `apps/api/src/search/graph-walk/index.ts:238` `MIN(a3.description)
AS description`.
- **증상**: GROUP BY 가 `id, type, name, truth_weight, page_ref` 5컬럼, id
  가 PK 라 그룹 내 description 은 항상 동일 → `MIN()` 이 그 값을 반환.
  주석(`graph-walk/index.ts:215-219`)도 "그룹 내 description 은 전부 동일 →
  MIN 은 그 값을 정확 반환" 이라고 명시 — **읽는 사람이 SQL 의미를 즉시
  파악 못 함**, "왜 MIN 인가" 가 우연/CPU 마진 (description 을 GROUP BY 키로
  넣으면 텍스트 비교 비용) 같은 미묘한 이유에 의존.
- **근본원인**: SQLite (D1) 의 GROUP BY 비표준 동작 (non-aggregated 컬럼이
  group key 가 아니어도 SELECT 가능 — `ANY_VALUE` 의미) 을 활용하려 했으나
  표준 SQL 호환성을 위해 `MIN()` 으로 wrap. 이는 _정합_ 하지만 _가독성_ 부채.
- **6개월/2년 시나리오**: 신규 컬럼(예: ADR-030 chapter/section) 추가 시
  같은 패턴으로 `MIN(chapter)`/`MIN(section)` 늘어나면서 한 줄에 6개
  `MIN()` — 코드 변경자가 "왜 다 MIN?" 묻는 turn 누적. PR review cost 누적.
- **권장 조치**: GROUP BY 절을 `id` 단독으로 축소하고 (PK 단독 그룹) SELECT
  의 모든 fact 컬럼을 `MAX(a3.x) AS x` 통일 — 또는 더 좋게, `SELECT DISTINCT
a3.id, a3.type, ...` + `JOIN (SELECT node_id, MIN(depth) AS depth FROM
walk GROUP BY node_id) hops USING (node_id)` 분리. depth 집계 의도가 SQL
  shape 에서 명시.
- **반론**: 측정 결과(D-2, 41.5ms/depth4) 이미 PASS — 가독성 위해 성능을
  희생하면 G-S7 carry-over. 그러나 본 리뷰는 _리뷰 비용_ 까지 부채 — SQL
  유지보수자의 이해 비용은 운영 CPU 와 별개로 누적.

### M-3. `compareByTruthWeightThenScore` 단일 진실원과 `topic-cluster-router.ts:395-399` 의 3-key 정렬 — 의도된 비대칭이지만 drift 표면

- **파일**: `user-search.ts:330-333` (2-key: truth*weight, score) vs
  `topic-cluster-router.ts:395-399` (3-key: truth_weight, score, name.
  localeCompare). 주석(`user-search.ts:320-328`) 이 "별개 의미 맥락 — 폴백
  결과 안정 정렬용 name tiebreak — drift 아님, 설계 차이" 라고 *옹호\_.
- **증상**: 두 코드 path 가 정렬 정책에서 의도된 차이를 가짐. 그러나
  `user-search.ts:329` "정상/graph 경로에 2번째 truth_weight 정책 생성
  금지가 본 주석의 계약이다" 라는 강한 계약이 코드로 강제되지 않음 — 리뷰
  탈선 시 즉시 위반 가능.
- **근본원인**: SOLID OCP/SRP — 정렬 정책이라는 단일 책임이 두 모듈에 흩
  어졌고, "의도된 비대칭" 이라는 인간 합의로만 유지. 컴파일러/타입/테스트
  중 어느 것도 본 비대칭을 강제하지 않음.
- **6개월/2년 시나리오**: ADR-012 §Decision Stage 3 개정으로 정렬 정책이
  바뀔 때 (예: truth*weight tiebreak 시 page_ref 우선) 두 모듈 동시 갱신
  필요. user-search 만 업데이트 시 multi-path-fallback 이 silent 옛 정책
  유지. 본 비대칭의 *존재\_ 가 drift 표면.
- **권장 조치**: `compareByTruthWeightThenScore` 시그니처를 _옵션화_:
  `compareByTruthWeightThenScore(a, b, opts?: {nameTiebreak?: boolean})`.
  topic-cluster-router 는 `compareByTruthWeightThenScore(a, b, {nameTiebreak:
true})` 호출. 정책 변경은 1곳, 분기는 명시.
- **반론**: 두 정책의 _의미_ 가 다르다 (graph는 vector score 가 유의미,
  topic-cluster는 cluster 매칭이 dominant 라 name tiebreak 가 결정적 정렬
  보장) — 진짜로 동일 함수로 표현하기 어렵다. 옵션화는 함수 시그니처에
  알고리즘 누설.

### M-4. 4개 fetch 호출자가 `const API_BASE`, `const EXAM_ID`, `credentials: 'include'` 글자 단위 복제

- **파일**: `apps/web/src/components/QuestionCard.tsx:38-39,91,132`,
  `components/AuthForm.tsx:12,141`, `components/ProgressSummary.tsx:11-12,35`,
  `lib/study-api.ts:22-23,56`. `API_BASE: string = import.meta.env.PUBLIC_API_
BASE_URL ?? 'http://localhost:8787'` 4파일 복제, `EXAM_ID = EXAM_IDS.SON_HAE_
PYEONG_GA_SA` 3 파일 복제, `credentials: 'include'` 7 호출.
- **증상**: `lib/study-api.ts` 가 이미 `safeFetch` wrapper 존재 (study-api.ts: 55) 하나 다른 fetch 호출자들이 _이용하지 않음_. 같은 fallback URL
  `'http://localhost:8787'` 4 곳에 복제 — env 미설정 시 dev 동작은 OK 이나
  staging 미설정 사고 시 localhost 폭주.
- **근본원인**: `study-api.ts` 의 `safeFetch` 가 study 도메인에 limit 된 추상화
  였고, 일반 fetch wrapper 가 부재. 결과적으로 같은 wrapper 가 4번 재발명.
- **6개월/2년 시나리오**: Phase 3 launch 시 cookie 정책 변경(SameSite=Strict)
  - custom domain 적용 → 4 파일 동시 수정. 다음 launch 시 (V2 plan, OAuth
    도입 등) 또 동시 수정.
- **권장 조치**: `apps/web/src/lib/api-client.ts` 신규 — `API_BASE`,
  `DEFAULT_EXAM_ID`, `apiFetch(path, init)` 단일 export. 4 컴포넌트가 import.
- **반론**: Astro Islands 각각이 독립 번들 — 작은 wrapper 분리는 코드 분할
  손실 가능. 그러나 `EXAM_IDS` 자체가 이미 `@thepick/shared` 에서 가져옴 →
  추가 분할 손실 거의 없음.

### M-5. `packages/formula-engine/src/constants-resolver.ts` 가 PoC 인메모리 구현만 — 프로덕션 경로 부재

- **파일**: `constants-resolver.ts:3-4` `"PoC: 인메모리 맵으로 상수 직접
주입. 프로덕션: D1 쿼리 구현으로 교체."` — 18줄 전체.
- **증상**: TODO/HACK 명시 금지 (`production-quality.md`) 정신에 위배되는
  주석. `InMemoryConstantsProvider` 단일 구현체 — `apps/api`/`apps/batch` 등
  실 호출자가 이 PoC 구현으로 운영 중이거나, 별도 D1Provider 가 인라인되어
  있을 위험. (실 호출자 검색 결과: `index.ts:32` 만 export — 호출 측 search
  결과 0건 = 실 사용 0건 가능성. PoC 코드 데드코드.)
- **근본원인**: Formula Engine 이 산식 정밀도 단위 테스트로만 검증 — Year 1
  실 산식 적용은 _아직 학습자 경로에 노출되지 않음_ (Phase 2 Eval MVP 진행
  중). 따라서 PoC 구현이 산식 등록/AST 검증의 부속물로 남아있고 _제거 결정_
  도 _구현 결정_ 도 안 됨.
- **6개월/2년 시나리오**: Phase 3 산식 학습 모드 (formula-drill, ADR-030)
  추가 시 ConstantsProvider 실 D1 구현이 필요해질 때 _PoC 가 있어서_
  새 D1Provider 추가 시 인터페이스 마찰. 첫 호출자가 PoC 를 의존성으로
  잡으면 제거 비용 증가.
- **권장 조치**: 셋 중 하나 즉시 결정. ① 실 호출자가 0건이면 패키지에서
  제거 (`export {}` 와 같은 부채). ② 실 호출자가 테스트 시드용이면 `__
tests__` 로 이동. ③ Phase 3 진입 결정이면 `D1ConstantsProvider` 신규 +
  PoC 는 `tests/` 픽스처.
- **반론**: PoC 가 "Year 1 Formula Engine 결정성 검증"의 부속물로 의도된
  abstraction (DIP) 일 수 있음. ConstantsProvider 인터페이스가 있어서
  Year 2 산식 자동 cross-validation 시 mock 주입 가능 — 이는 의도된 추상
  화이며 본 항목은 _주석 톤_ 의 문제일 뿐일 수도.

### M-6. `apps/api/src/auth/routes.ts:417` + `:629` login_history INSERT 글자 단위 복제

- **파일**: `auth/routes.ts:417` (login 경로) vs `:629` (refresh 경로). 동일
  SQL `INSERT INTO login_history (id, user_id, login_at, ip_hash, user_agent,
event_type) VALUES (?, ?, ?, ?, ?, ?)`, 동일 schema-drift catch 로직
  (`/no such (table|column)/i` 정규식 fork).
- **증상**: 두 호출은 `event_type='login'` vs `'refresh'` 만 다르고 나머지
  bind / error handling / logger 호출 5줄 똑같이 복제. schema drift
  remediation 메시지 ("Run: wrangler d1 migrations apply ...") 도 두 곳에
  복제.
- **근본원인**: `apps/api/src/auth/session.ts` 가 이미 `createRefreshSession`/
  `revokeSession`/`hashIp` 헬퍼를 모으는 자연스러운 모듈인데, _audit trail_
  helper 는 누락. C-12 / Stage E P-α C-α-2 (Session 081 추정 흡수) 가 _라우트
  안에서_ INSERT 한 결과.
- **6개월/2년 시나리오**: event*type 추가 (예: password-change, account-
  delete) 시마다 한 줄 추가가 아니라 *블록 한 덩어리\_ 복제. 1년이면 4~5
  event_type, 즉 4~5 복제.
- **권장 조치**: `apps/api/src/auth/audit.ts` 신규 (~50줄). `async function
recordLoginEvent(db, {userId, eventType, ipHash, userAgent, logger}):
Promise<void>` 단일 export. 두 라우트가 호출. schema drift detection 도
  같은 헬퍼에.
- **반론**: 2 회의 복제는 추상화 임계점(rule of three) 미달 — premature
  abstraction 위험. 그러나 _drift 위험_ (remediation 메시지 양쪽 sync) 만으로도 헬퍼화 정당.

---

## MINOR (인지만) — 5건

- **m-1** `packages/parser/src/section-splitter.ts:56` 페이지 헤더 정규식이
  "농작물재해보험 및 가축재해보험 손해평가의 이론과 실무" 단일 교재명에 강
  결합. Hard Rule 15 정신 위반 — `parser-1st-exam/` 으로 이동.
- **m-2** `apps/api/src/index.ts:34-46` `CORS_ALLOWED_ORIGINS` 하드코딩
  배열. `thepick.app` 포함 (`project_custom_domain_thepick_app_collision`
  메모리 = 도메인 타인 보유). Phase 3 launch 직전 도메인 결정 시점에 함께
  업데이트 carry-over 인데, 그 시점 망각 위험 — `wrangler.toml` env 주입
  으로 외부화 권장.
- **m-3** `apps/web/src/components/StudyFlow.tsx:43` `ACTIVE_SESSION_KEY =
'thepick:active-session'`, `i18n/context.tsx:35` `'thepick-locale'`. Storage
  key namespace 분산. `lib/storage-keys.ts` 단일 정의 권장 (1년 후 다른 모듈
  도 추가됨).
- **m-4** `apps/api/src/search/log-redact.ts` 가 query digest 산출만 위해
  분리 — 52줄. 같은 파일에 inline 해도 무방. 작은 모듈 = 디렉토리 noise.
  (반대 의견: 보안 단일 책임 분리는 OK. 본 항목 진산 판단.)
- **m-5** `apps/api/src/middleware/retry.ts:34` `D1_UNIQUE_CONSTRAINT_PATTERN`
  이 `webhooks/payment.ts` 에서도 import 되는 명시적 단일 진실원 — **이건
  부채가 아니라 모범사례**. 본 리뷰의 다른 항목들이 이 패턴을 따라야 함을
  대조군으로 명기.

---

## Devil's Advocate (이 리뷰가 틀릴 수 있는 시나리오)

- **반론 1 — ADR-007 정합 = "Year 2 일괄"**: C-1(`lv1_insurance` 등) 은 ADR-007
  에 따라 _의도된_ Year 2 이월 부채. 현 시점 작업 = ADR 위반. 본 리뷰가
  이 부채를 CRITICAL 로 격상하면 거버넌스 충돌 — 진산 결재로 ADR-007
  재검토 명시 필요.
- **반론 2 — 4-Pass 와 중복 가능성**: M-3(정렬 정책 비대칭) 은 이미 Session
  087 S5-5 4-Pass 리뷰에서 "의도된 비대칭, drift 아님" 으로 결론. 본 리뷰가
  이를 재제기하는 것이 _증거 무시_ 일 수 있음. 다만 본 리뷰 관점은 "코드
  구조" 이지 "현 동작" 이 아니므로 _다른 결론 가능_.
- **반론 3 — 빈 패키지 = 미래 의도**: C-3 `study-material-generator` 빈
  패키지가 Phase 3 (`project_ux_north_star_phase3`) 진입 시점에 _이미 정의된
  자리_ 로 활용되도록 의도된 placeholder 일 수 있음. 메모리 `project_content_
build_engine_as_core` 가 4 코어 모듈 (Ontology/Validation/Version/Loader)
  명시 — 학습자료 생성도 같은 위치성. 본 리뷰 제거 권고는 그 의도와 충돌.
- **반론 4 — 부채 정의 자체의 주관성**: M-1 (시험-특화 prompt 144줄) 은
  Claude API prompt caching 의 _cache 단위가 시스템 prompt 전체_ 라 분리
  시 캐시 hit 손실 가능. 본 리뷰는 prompt _구조_ 만 봤고 _캐싱 토큰 비용_
  은 performance 페르소나 스코프. 통합 결재 시 두 의견 충돌 가능.

---

## 다른 페르소나가 못 볼 각도 (본 리뷰 고유 발견)

- **고유-1**: `lv1_insurance`/`lv2_crop` 등 컬럼명 산포는 _스키마 부채_ 가
  아니라 _경계 부채_ — backend-architect 는 "Year 2 마이그레이션 0005"
  관점에서 보고, devops 는 운영 관점에서 못 봄. 본 리뷰가 _컴파일러로 강제
  되는 경계 부재_ 라는 다른 layer 결함을 식별.
- **고유-2**: `buildLogger`/`resolveLoggerEnv` 6 파일 복제는 _코드 양_ 으로는
  적지만 **신규 라우트 추가의 hidden friction** — 누군가 새 라우트 만들
  때 기존 6 파일 중 하나를 복붙해야 함을 _구조_ 가 강제. devops 페르소나는
  운영 가시성, performance 는 logger overhead 만 봄.
- **고유-3**: `compareByTruthWeightThenScore` 의 "의도된 비대칭" 관용주석은
  _리뷰 비용_ 부채. 6개월 뒤 다른 엔지니어가 라우트를 만들 때 어느 정렬을
  쓸지 매번 코드/주석을 다시 읽어야 함. 본 리뷰는 _문서화로 우회한 부채_ 를
  진짜 부채로 식별 — 다른 4 페르소나가 "주석으로 잘 설명됐다" 로 마무리
  하는 지점.
- **고유-4**: `study-material-generator` 의 1줄 패키지는 _아키텍처 다이어그
  램_ 과 _실 코드_ 의 drift. ARCHITECTURE.md 가 모듈 인박스로 표시하나 빈
  것. quality/backend 페르소나는 동작 면에서 발견 못함. 본 리뷰는 모노레포
  구조 자체를 보는 유일한 페르소나.

---

## 우선순위 매트릭스

| 항목                          | 영향 (코드 면적)                             | 빈도 (변경 압력)                               | 수정 비용 (예상 LOC/PR)                      | 권장 timing                                     |
| ----------------------------- | -------------------------------------------- | ---------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| C-1 lv1/lv2/lv3 경계          | 13 파일 · ~100 라인                          | 매 신규 노드/검색 라우트 추가 시               | ~150 LOC 1 PR + D1 migration plan            | Year 2 진입 결재 _전_ (D-1 month)               |
| C-2 logger 6 파일 복제        | 6 파일 · 50 라인                             | 매 신규 라우트 +1                              | 50 LOC 1 PR                                  | 다음 신규 라우트 추가 직전                      |
| C-3 study-material-generator  | 1 파일 1 줄 (placeholder) + 2050줄 routes.ts | 매 학습 모드 추가                              | 800~1200 LOC 3 PR (점진 추출)                | Phase 3 학습 UX 진입 _전_                       |
| M-1 batch-processor prompt    | 1 파일 144줄                                 | 매 ontology 개정                               | 200 LOC 1 PR                                 | Year 2 진입 결재 _전_                           |
| M-2 graph-walk MIN() SQL      | 1 파일 ~30 줄                                | 매 컬럼 추가                                   | 50 LOC 1 PR (성능 재측정 동반)               | ADR-030 chapter/section graph 노출 직전         |
| M-3 정렬 정책 비대칭          | 2 파일 · 10 줄                               | 매 ranking 정책 개정                           | 30 LOC 1 PR                                  | ADR-012 Stage 3 차기 개정 함께                  |
| M-4 API_BASE/EXAM_ID 4 복제   | 4 파일 · 12 줄                               | 매 신규 컴포넌트 +1                            | 60 LOC 1 PR                                  | Phase 3 학습 UX 진입 _전_                       |
| M-5 ConstantsResolver PoC     | 1 파일 · 18 줄                               | 산식 학습 모드 신설 시                         | 40 LOC 1 PR (제거) or 100 LOC 1 PR (D1 구현) | Formula 학습 모드 (Phase 3) 진입 _전_           |
| M-6 login_history INSERT 복제 | 2 위치 · 30줄                                | 신규 audit event 추가 시 (예: password-change) | 60 LOC 1 PR                                  | password-change/account-delete 라우트 추가 직전 |
| m-1~m-5 minor                 | 단일 위치                                    | 낮음                                           | <50 LOC each                                 | Phase 3 cleanup 스프린트                        |

**총평**: 본 코드베이스는 _기본 위생_ (any 5건/대부분 .astro 자동 생성,
TODO 1건, 빈 catch 0건, Hard Rule 17 literal 0건, mathjs custom bundling
적용) 측면에서 **상용 수준**이다. 본 리뷰가 식별한 부채는 _경계 도입_·
_복제 정리_·_빈 패키지 결단_ 의 **구조적 결정** 카테고리이며, 단위 코드
품질 위반이 아니다. 단 CRITICAL 3건 모두 _Year 2 진입_ 또는 _Phase 3 학습
UX 진입_ 이라는 **다음 마일스톤이 트리거** — 그 결재 전에 해소하지 않으면
**마일스톤 작업과 부채 정리가 동시 진행되어 회귀 표면 곱셈**.
