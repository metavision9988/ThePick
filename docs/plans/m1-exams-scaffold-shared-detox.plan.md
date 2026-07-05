# M1 — `exams/` 골격 + shared 탈오염 (L3 plan)

> **STATUS: DRAFT · L3 · 진산 결재 전 코드 1줄 금지** (CRITICAL RULE #1·#7 / production-quality L3).
> **rev2 (2026-07-05)**: 독립 검증 2에이전트(사실검증 + 적대 설계비평, `add829e29`·`a9c8e830`) 발견 **CRITICAL 1 / MAJOR 6 / MINOR 5 + 게이트 결함 전건 반영**. 정정 이력 §12.
> **근거**: 엔진분리 R5 A안(`docs/학습자료저장및도출/ENGINE_SEPARATION_REVIEW_20260704.md` §5-M1 :146) · ADR-007 Amendment(2026-07-04 조기집행) · Hard Rule 15~17(`.claude/rules/production-quality.md`) · 플레이북 W4.
> **DEFCON**: **L3 Fortress**. plan → 인간 승인 → 코딩.
> **작성 근거**: discovery 3에이전트(`wf_e0601f91`) + 검증 2에이전트. 모든 수치·경로 file:line 실코드 대조(검증 정정 반영).
> **트랙**: 코어(main) 전속.

---

## §0 Reality Anchor (G-1 정신 — "이것이 안 될/터질 이유")

M1을 "타입 파일 옮기기"로 과소평가하면 3가지가 터진다:

1. **`NodeType`은 옮길 수도, 단순 재합성할 수도 없다 — 결합을 _어디 둘지_ 정해야 한다.** INSURANCE/CROP를 shared에서 떼도 `TRUTH_WEIGHTS`·검색 랭킹은 여전히 **실재 INSURANCE/CROP 노드(production 794)** 를 처리해야 한다(`user-search.ts:381` `row.type as NodeType`). 전체 union을 어딘가는 알아야 하고, 그 "어딘가"를 잘못 두면(예: `apps/api`가 `exams/son-hae`를 직접 import) **결합의 방향만 바뀐 재오염**이 된다. A안(같은 `apps/api`가 1호·2호 동시 서빙)에서 이는 치명적. → 정답은 **composition-root / ExamAdapter 주입**(§3-B).
2. **무음 회귀 경로가 실재한다.** `TRUTH_WEIGHTS[nodeType] ?? row.truth_weight`(user-search.ts:381 등 hot path 6파일)에서 키가 누락되면 폴백으로 넘어간다. **단, 정상 적재 노드는 `row.truth_weight`가 맵과 동일 값(6)이라 폴백이 회귀를 _가릴_ 수 있다**(fact-check: `undefined ?? 6 = 6` → 랭킹 동일 → 거짓 GREEN). 즉 "무음 강등"은 **`row.truth_weight`가 맵과 발산할 때만** 관측되며, 유닛/골든 테스트가 오히려 못 잡는다 → **타입 수준 방어가 1차**(§5).
3. **"3중 선언"은 사실 5~7중이고 이미 드리프트했다.** D1 `knowledge_nodes.type` CHECK=7종(`migrations/0001:14`), types.ts/registry=11종. codegen 단일화는 이 잠복 불일치를 표면화하나 D1 변경은 L3 마이그(M3 이관).

→ M1은 광역 수술. 단계별 가역 커밋 + 전체 회귀 + 독립 리뷰 게이트 없이 착수 불가.

---

## §1 M1 범위 정의 — ★2겹 스코프(안전-additive vs 무거운-L3) 분리

검증 M6 반영: detox(리터럴 청소, 2호 무관 standalone 가치)와 scaffold·composition(미래 베팅)을 **성격별로 분리**한다.

### Tier-S (안전·additive·standalone — 저위험, 즉시 후보)

1. **exams/ workspace 골격 신설** — `pnpm-workspace.yaml`에 `exams/*` glob + `exams/son-hae-pyeong-ga-sa/`(package.json·빈 ontology/domain/config). 순수 additive.
2. **ExamConfig 합격판정 메타모델 확장**(스키마만, §6) — 소비처 0 → 무회귀.
3. **near-dead 리터럴 lift**: `cross_crop`(ConfusionType, 타입 importer 0)·`1st_sub*`(ExamScope, 타입 importer 0/죽음)를 exams/domain으로. registry·D1 CHECK 미개입.

### Tier-H (무거운 L3 — composition 재설계, 진산 Q2 결재 + 별도 신중 시퀀싱)

4. **NodeType 결합 재배치** — `EngineNodeType`(shared) / 도메인 타입(exam) 분리 + **engine/app 소비처를 composition-root/ExamAdapter 주입으로 전환**(§3-B). = R5 §5-M1의 "shared 탈오염" 본체이나, 실질은 Year-2-Phase-4급 아키텍처(exam-adapter.ts 주석이 "Year 2" 예고) → M6 타이밍 결재.
5. **TRUTH_WEIGHTS 레지스트리 합성** — 컴파일 상수에서 engine∪active-exam 합성 맵으로(§5).
6. **드리프트 검출 기전** — verifier 확장(§3-C). ※ "codegen 단일화"는 Q3.

### OUT-OF-SCOPE (M1 아님 — 혼입 금지)

- **M2**(파서·품질 파라미터화): `buildSystemPrompt`(batch-processor.ts:105-284) 템플릿화, BATCH_CONFIGS·qg2·section-splitter·parser-1st-exam 패턴. M1은 batch-processor.ts:136 truth-weight fragment만 접촉.
- **M3**(배포·중립 마이그): wrangler.{exam}.toml, migrations-v2, init-exam.mjs, **D1 CHECK 7-vs-11 드리프트 해소·edge_type CHECK 신설**.
- **★Year 2 ADR-007 (M1 out-of-scope, 명시 원장)**: D1 **컬럼명 `lv1_insurance`/`lv2_crop` 계열**(`upserter.ts:73-74`·`table-fetcher.ts` 7회·`topic-cluster-fetcher.ts:120`·`draft-loader.ts:315`·`schema-validator.ts:34`·`schema.ts:176`) + `apps/api/src/db/schema.ts` Drizzle enum(`NODE_TYPES`:61·`CONSTANT_CATEGORIES`·`CONFUSION_TYPES`:146·`EXAM_SCOPES`:135, D1 CHECK 미러) = **Year 2 Phase 4/M3 소관**. **M1 후에도 이 결합은 잔존한다**(진산 오독 차단: "M1 = shared 청정"이지 "도메인 결합 전면 해소" 아님).
- 합격판정 **실측값**(과목 40/과락·배점·문항수): 교재·시행규칙 원문 대조 = 별건 L3 constants(§6).
- **플랫폼 통합 계정 계층**(D1+SSO 쿠키): 결재카드 E-2가 M1 plan과 **묶은 자매 전달물**이나 본 plan은 ExamConfig만 — 계정 계층 설계서는 **별건**(§11 노트, m2).

---

## §2 실측 현황 — 심볼 분류 (검증 정정 반영)

| 심볼                                            | usages(비테스트 실importer)               | 분류                               | M1 처분                                | 근거                               |
| ----------------------------------------------- | ----------------------------------------- | ---------------------------------- | -------------------------------------- | ---------------------------------- |
| **NodeType** (INSURANCE/CROP)                   | 43/14파일(실 타입-import **12**)          | 🔴 Tier-H(결합 재배치)             | EngineNodeType 분리 + composition-root | types.ts:12-23                     |
| **TRUTH_WEIGHTS** (INSURANCE/CROP 키)           | 21/7(비테스트 소비 6, hot path)           | 🔴 Tier-H(레지스트리 합성)         | §5 타입가드+합성                       | types.ts:68-80, user-search.ts:381 |
| **ConstantCategory** (insurance_rate)           | 3중 정합(types+registry+D1 CHECK)         | 🔴 Tier-H                          | 위치 이동·값 불변                      | types.ts:106, migrations/0001:73   |
| **ConfusionType** (cross_crop)                  | 타입 importer 0 (값은 schema.ts:146 병행) | 🟢 Tier-S(near-dead lift)          | domain 이전                            | types.ts:112-120                   |
| **ExamScope** (1st_sub\*)                       | 타입 importer 0(죽음)                     | 🟢 Tier-S                          | 타입 삭제/이전(실값은 schema.ts:135)   | types.ts:96                        |
| ConfusionLevel·TransitionStatus·EdgeType·ExamId | 제네릭/clean                              | ⚪ shared 잔류                     | 무접촉                                 | —                                  |
| LevelTaxonomy·ExamConfig·ExamAdapter            | usage 0(dead)                             | ⚫ ExamConfig=§6 확장, 나머지 잔류 | —                                      | exam-adapter.ts:36/60/89           |

**★VALUE 실편집(비테스트) — 정정**: shared 타입 계층 detox가 실제 코드 값을 바꾸는 곳은 좁다. **schema.ts는 편집 대상 아님**(NodeType 미import; `NODE_TYPES`:61은 D1 CHECK 미러 로컬 const이므로 건드리면 §3-E "D1 값 불변"과 충돌 → **M1 무접촉·M3 소관**). 실 편집 후보 = `ontology-registry.json`(registry 분할) + `batch-processor.ts:136`(프롬프트 truth-weight fragment) + `GraphVisualizer.tsx:17-22`(`NODE_COLORS: Record<NodeType,string>` — 값편집 아니라 **NodeType 조립처 변경 시 타입 경로 파급**; INSURANCE/CROP 색상=손해평가 데이터가 admin-web 잔류 → exam 이동 여부 §11 결정).

**★값-분기 실측 정정(검증 M1)**: discovery의 "14 importer 전부 제네릭(값 분기 0)"은 **거짓**. 실측 값-분기 = `packages/quality/src/graph-integrity.ts:125`(`node.type === 'TERM'`)·`apps/api/src/study/routes.ts:609`(`nodeType === 'LAW'`) 2건(둘 다 **engine 멤버**라 EngineNodeType로 생존). 종목 멤버(INSURANCE/CROP) 값-분기는 미발견이나 **discovery 스캔이 값-분기를 누락**했으므로 M1-e 착수 시 **실 타입-import 12파일 값-분기 전수 재스캔 의무**.

**선재 드리프트(M1 표면화·해소는 M3)**: D1 `knowledge_nodes.type` CHECK=7 vs registry/types=11. 표 4종(TABLE/ROW_HEADER/COL_HEADER/CELL)은 `knowledge_nodes.type` 미유입(별도 table_structures/table_cells, migrations/0021).

---

## §3 핵심 설계 결정 (각 = PITR → 권고 → 진산 결재)

### §3-A. NodeType 경계 — TABLE류 4종은 engine, INSURANCE/CROP만 exam ✅(검증 인정)

- 표 4종: `knowledge_nodes.type` 미유입 + ADR-032 전종목 공용역량(memory `project_table_processing_core_capability`) → **engine**. exam으로 보내면 2호도 표 사용 = 오경계.

### §3-B. ★결합을 어디 둘지 — composition-root / ExamAdapter 주입 (CRITICAL C1 정정)

**문제(C1)**: 전체 `NodeType`(engine∪exam)을 알아야 하는 곳은 **engine/app 소비처**(TRUTH_WEIGHTS 랭킹, `user-search.ts:381`이 실 INSURANCE/CROP row 처리)다. 순진한 두 안이 다 틀림:

- **(기각①)** shared가 exam domain을 import해 union 합성 → shared→exam 의존(Rule 15 위반·순환).
- **(기각②)** `apps/api`가 `exams/son-hae/domain`을 직접 import → **엔진 앱이 특정 종목에 하드결합**(A안: 같은 apps/api가 2호도 서빙 → 재오염). ★plan의 방향 게이트가 "shared→exams=0"만 봐서 이 결합을 **못 잡는다**.

**권고 = 계층별 분해(hexagonal composition-root):**
| 계층 | 결합 처리 |
|---|---|
| `packages/shared` | `EngineNodeType`(9종) 확정 + **`ExamAdapter` 인터페이스**(이미 exam-adapter.ts:89, `validateNodeId` 계약 존재)에 `nodeTypeMembership`·`truthWeightFor` 추가. 특정 종목 무지. |
| `exams/{id}/domain.ts` | `SonHaeNodeType`(INSURANCE/CROP) + 조립 `NodeType = EngineNodeType \| SonHaeNodeType`(**exam 패키지 내부 전용**) + son-hae `ExamAdapter` 구현체(도메인 truth_weight·id패턴). |
| `apps/api`·`packages/quality` 등 **엔진/앱 소비처** | 전체 union·특정 exam **import 금지**. `row.type`는 경계에서 **`string`/branded**로 받고 **런타임 `isValidNodeType()`**(`ontology-registry.ts:74` 실재, 레지스트리 구동=engine∪active-exam 커버) 검증. 랭킹 가중치는 주입된 `ExamAdapter.truthWeightFor(type)` 경유. |
| **composition-root**(배포당 1곳 = apps/api의 exam 배선 파일) | 활성 exam의 `ExamAdapter`를 **주입**. 결합이 허용되는 **유일 지점**(명시적 wiring, madge 예외 원장). |

- **정직 고지**: 이는 "타입 경로 전환"이 아니라 **Year-2-Phase-4급 어댑터 런타임 구축**(exam-adapter.ts가 "Year 2" 예고한 바로 그것)이다. 실 타입-import 12파일 중 값-분기·union-전수 의존처는 M1-e에서 전수 재스캔 후 전환(무변경 아님 — diff·리뷰·회귀 대상).
- **대안(보류)**: ③ 전면 런타임화(컴파일 union 폐기·branded string+런타임 검증) = 결합 완전절단이나 타입안전 축소.
- ★ = **진산 결재 Q2**(계층별). **G-M1-3 확장**: "범용(shared·packages 비-exams·apps/\*) → exams/{특정} import = 0"(madge, composition-root만 예외 원장).

### §3-C. 드리프트 방지 — 검출(verifier) 먼저, 단일화(codegen)는 Q3 (검증 M2 정정)

- **정직 라벨(M2)**: verifier는 **드리프트 *검출*이지 *단일화(단일 진실원)*가 아니다**. R5 §5-M1 "codegen 단일화" 용어를 유지하면 스펙 미달 오독 → §1 Tier-H #6을 **"드리프트 검출 기전 도입(단일화=codegen=Q3/M1-f)"**로 개명.
- **재사용 아님(M2)**: 현 `verify-engine-contracts.ts` Cat10 `ENUM_SYNC_PAIRS`(:695-727)는 **TABLE\_\* 5쌍만** 검사, `NODE_TYPES↔knowledge_nodes.type`·`CONSTANT_CATEGORIES↔constants.category` 미커버 → 요구 검증(engine↔exam↔registry↔D1 불일치 FAIL)은 **신규 로직**(node_types·constant_categories 쌍 신규 추가).
- **부수 win**: registry 로더는 `assertRegistryShape()`(ontology-registry.ts:25)로 **구조는 검증하나 멤버십 미검증**(`as OntologyRegistry` 캐스트 :47) → verifier에 런타임 멤버십 검증 추가로 이 gap 해소.
- **권고 = C(검출 먼저, codegen 팔로우)**. codegen source-of-truth(registry.json 정본화) = **진산 Q3**.

### §3-D. registry 분할 — engine-core + per-exam

- `ontology-registry.json` → engine-core(범용 9노드·18엣지·표 ID패턴) + `exams/{id}/ontology.json`(INSURANCE/CROP·INS-/CROP- 패턴·insurance_rate·cross_crop). 예고 근거 = **`.claude/rules/production-quality.md:80`**(Hard Rule 15 "Year 2 이후 exams/{id}/ontology.json 분리") + exam-adapter.ts:9·84 (※ rev1의 "exam-adapter.ts:98" 오인용 정정).
- **Ontology Lock 유지**: 합집합(engine-core∪exam)으로 "registry 외 ID 금지" 강제.
- **파급 점검(m5)**: `packages/formula-engine/src/engine.ts:16` 도메인 registry 정적 import가 분할 영향 받는지 M1-d/f에서 확인.

### §3-E. D1 무접촉 — M3 이관 ✅(검증 인정)

- A안=종목별 D1이므로 손해평가 D1의 `insurance_rate` CHECK(0001:73)는 **공유 오염 아니라 손해평가 DB의 정당한 자기 스키마**. M1은 D1 무접촉, 7-vs-11 드리프트·edge_type CHECK 부재는 **M3 중립 마이그**로 이관. M1 verifier는 D1 CHECK를 **읽기전용 WARN 원장**으로 대조(은폐 아님).
- `insurance_rate` 선언 위치를 exam registry로 옮겨도 **값 목록 불변** → D1 CHECK SQL 무변경(정합 유지).

### §3-F. 기존 종목 홈 처분 — parser-1st-exam & modules/exam (검증 M5)

- **★parser-1st-exam**(`packages/parser-1st-exam/src/`, exam-question-parser.ts 등)은 Rule 15가 명시한 **Year 1 손해평가 특화 홈**("Year 2 이후 exams/son-hae-pyeong-ga-sa/"). exams/son-hae 신설 시 **손해평가 특화 코드가 2홈 분열** → 처분 결정 필요(흡수 vs 공존). → **진산 Q5**.
- `modules/exam/`(빈 헥사고날 배럴)은 **엔진 시험-도메인 계층**(포트/어댑터 자리), `exams/{id}`는 **종목 데이터·설정**. 다른 축 → M1 무접촉(충돌 아님).

---

## §4 실행 시퀀스 (위험 오름차순 — 각 = 독립 가역 커밋 + green 게이트)

| 단계     | Tier | 내용                                                                                                                                                                                                   | 위험                        | 게이트                     |
| -------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | -------------------------- |
| **M1-a** | S    | exams/ workspace 골격(pnpm-workspace.yaml + package.json + 빈 파일). **★turbo 유닛 17→18**                                                                                                             | 🟢 additive                 | G-M1-1, **§5 re-baseline** |
| **M1-b** | S    | ExamConfig 합격판정 확장(§6)                                                                                                                                                                           | 🟢 additive(소비 0)         | G-M1-8                     |
| **M1-c** | S    | cross_crop·1st_sub\* near-dead lift(registry·CHECK 없음). schema.ts:146 CONFUSION_TYPES 병행선언은 M1 무접촉(M3)                                                                                       | 🟢 타입 importer 0          | G-M1-2                     |
| **M1-d** | H    | insurance_rate 이전 + registry 분할(값 불변, D1 CHECK SQL 무변경)                                                                                                                                      | 🟡 3중 정합                 | G-M1-6                     |
| **M1-e** | H    | ★NodeType 결합 재배치 = EngineNodeType 분리 → exam domain 조립 → **engine/app 소비처 ExamAdapter 주입 전환**(12파일 값-분기 전수 재스캔 선행) + TRUTH_WEIGHTS 합성 + batch prompt/GraphVisualizer 경로 | 🔴 검색 hot path·최대 blast | **G-M1-3·5·TW**            |
| **M1-f** | H    | verifier 확장(engine↔exam↔registry↔D1, node_types·constant_categories 쌍 신규 + 멤버십 검증) → (Q3 승인 시) codegen                                                                                    | 🟡 도구 계층                | G-M1-7                     |

**M1-e 세분**(최대 위험): (e1)EngineNodeType 분리+re-export →(e2)exam domain 조립 union+son-hae ExamAdapter →(e3)엔진/앱 12파일 값-분기 재스캔+주입 전환 →(e4)TRUTH_WEIGHTS 합성+G-M1-TW →(e5)batch prompt·GraphVisualizer 경로 →(e6)원본 리터럴 제거. 각 서브커밋 후 green.

**시퀀싱 규율(R5 §5-M1)**: E0-8 갭 처분 + G-S5 R5 결재 후 **콘텐츠 소강기 전용**. 긴급 완화 가능하나 green 게이트 생략 불가.

---

## §5 1호 green 담보 게이트 (원문 보고 의무 — 요약 금지)

**Baseline(M1 착수 직전 1회 실행 재확인)**: `api 711 PASS(+2 skip) · web 31 · E2E 20/20 · batch 332 · quality 85 · typecheck 17/17 · lint 17/17 · g1 PASS`. ★**M1-a가 exams/son-hae 워크스페이스 패키지 추가 → turbo 유닛 17→18** → G-M1-4 불변식을 "17"이 아닌 **"M1-a 후 18로 re-baseline, 이후 회귀 0"**로 재정의(자기게이트 모순 해소, 검증 M5). 동시에 `scripts/verify-engine-contracts.ts` `VITEST_PACKAGES`(:168-185, 단방향 감소차단 게이트)에 신규 패키지·신규 테스트 엔트리 + required 카운트 **갱신 의무**(망각 시 신규 테스트 무검증 통과).

**★G-M1-TW (TRUTH_WEIGHTS 무음 회귀 차단 — 검증 M4 + fact-check 정정):**

- **(1차·타입) 병합 `TRUTH_WEIGHTS`(또는 합성 함수 반환)를 `Record<NodeType, number>`로 유지** → 키 누락 = **컴파일 에러**(TS가 전 키 전수 강제). 런타임 테스트보다 강하고 싸다 = **authoritative 방어선**.
- **(2차·스냅샷) 병합 후 정확히 canonical 11키(값 포함) frozen snapshot 대조** 테스트. ★**종목 키(INSURANCE/CROP)만이 아니라 engine 키 전수** — `table-fetcher.ts:211,282,380`은 **fallback 없이** `TRUTH_WEIGHTS[TABLE류]` 인덱싱 → engine 키 누락 시 `undefined`가 무-폴백 전파(더 hard). 스냅샷은 11키∪exam키 전수.
- **(참고·비신뢰) 검색 골든**: `TRUTH_WEIGHTS[k] ?? row.truth_weight`에서 정상노드는 `row.truth_weight=6`(맵과 동일) → 키 떨궈도 `undefined ?? 6 = 6` = **거짓 GREEN**(fact-check). 골든은 **독립 확증으로 카운트 금지**. 쓰려면 D1 `truth_weight`가 맵과 **다른/unset** 노드로 구성해 폴백이 회귀를 못 가리게.

shared 변경은 18 turbo 유닛 전부 파급 → 매 커밋 후 `pnpm -w test` 전량+typecheck+lint+g1 원문 첨부.

---

## §6 ExamConfig 합격판정 메타모델 확장 (스키마 — 값은 별건)

현 6필드에 합격판정 축 전무(§6-3 CONFIRMED). 신설(전종목 공통 골격):

```ts
interface PassingPolicy {
  readonly subjectPassFloor: number;
  readonly overallPassMean: number;
} // 과락40/평균60
interface SubjectSpec {
  readonly code: string;
  readonly label: string;
  readonly questionCount: number;
  readonly points: number;
  readonly durationMinutes: number;
  readonly isElective: boolean;
  readonly exemptionEligible: boolean;
}
interface ExamConfig {
  /* 기존 6필드 */ readonly passing: PassingPolicy;
  readonly subjects: ReadonlyArray<SubjectSpec>;
  readonly sittingsPerYear: number;
  readonly exemptionRules?: string;
  readonly effectiveDate?: string;
}
```

- additive·소비처 0 → 무회귀. **실측값**(과목 40/과락·배점·문항수)은 교재·시행규칙 원문 대조 = **별건 L3 constants**. `effectiveDate` = 2호 feasibility Q5(Revision Watch) 정합, 1호도 개정축 도입.
- ※ 결재카드 E-2가 묶은 **플랫폼 통합 계정 계층**(D1+SSO)은 본 §6 밖 = **별건 설계서**(§11 m2).

---

## §7 Binary Gate G-M1-1~10

1. **G-M1-1** exams/ workspace 인식(빌드 그래프 등장).
2. **G-M1-2** shared 청정: `packages/shared/src/`에 INSURANCE·CROP·insurance_rate·cross_crop·1st_sub 리터럴 grep=**0**.
3. **G-M1-3 (★확장)** 방향 정합: shared→exams=0 **AND 범용(packages 비-exams·apps/\*)→exams/{특정}=0**(madge, composition-root만 예외 원장).
4. **G-M1-4 (★re-baseline)** green 전량: M1-a 후 **turbo 18**·api 711·web 31·E2E 20·batch 332·quality 85·typecheck·lint·g1 회귀 0(원문) + verify-engine-contracts required 갱신.
5. **G-M1-5 (★TW)** §5: `Record<NodeType>` 타입가드 + 11키∪exam키 canonical snapshot(table-fetcher no-fallback 포함). 골든은 비신뢰.
6. **G-M1-6** Ontology Lock: engine-core∪exam registry = 기존 11노드·18엣지·전 ID패턴 완전 커버.
7. **G-M1-7** 드리프트 검출 작동: verifier가 의도적 오염주입 시 FAIL(음성테스트, node_types·constant_categories 신규 쌍) + D1 CHECK WARN 원장 + 멤버십 검증.
8. **G-M1-8** ExamConfig additive: typecheck 무회귀 + 소비처 0 재확인.
9. **G-M1-9** 값-분기 재스캔: M1-e 착수 시 12 importer 값-분기 전수 스캔 원장(종목 멤버 분기 0 확인 or 처리).
10. **G-M1-10** 독립 리뷰: 4-Pass CRITICAL 0 + shared 수술 5-페르소나(선택) — 자가 리뷰 금지.

---

## §8 롤백 설계

- 단계별 독립 가역 커밋(M1-a~f). 실패 시 해당 커밋만 revert. M1-e는 e1~e6 세분커밋.
- **production 무접촉**(D1 write·deploy 0) → 롤백 = git only. 미커밋·push 보류(#14) 유지.

---

## §9 비가역성 · 리스크

- **가역**: git-only. 진짜 리스크 = 무음 회귀(§5 타입가드 차단) + **결합 오배치(C1 — apps/api→exam 재오염, G-M1-3 확장 차단)**.
- **★타이밍 ROI(M6)**: Tier-H(composition 재설계)는 2호가 exams/를 실소비(M2/M3/자료 실사)하기 **훨씬 전**에 Year-2급 아키텍처를 선불 집행. Rule 15 Year 1 예외는 현 상태를 **명시 허용**(위반 아닌 이월). 엔진리뷰 H1("소비자 없는 선행 구축=감가상각") 노출 → **Tier-S만 즉시, Tier-H는 2호 R3 spike 후 시퀀싱** 대안 존재(§10·Q1).
- **선재 부채 표면화**: 7-vs-11·edge_type CHECK 부재·registry 멤버십 미검증 = M1이 드러내되 해소는 M3/verifier(M1 비대화 차단).
- **과추상화(H4)**: exams/ 골격 과설계 = M2/M4 재작업 → 1종목 실입주 + 합성 최소만.

---

## §10 PITR 종합

| 결정              | 권고                                 | 대안(기각/보류)                                 |
| ----------------- | ------------------------------------ | ----------------------------------------------- |
| NodeType 처리     | composition-root/adapter 주입        | ①shared→exam(Rule15 위반) ②apps→exam(C1 재오염) |
| TABLE류 소속      | engine 잔류                          | exam(2호 표사용=오경계)                         |
| 드리프트 방지     | C(검출 먼저→codegen 팔로우)          | A(전면 codegen 대공사)                          |
| D1 CHECK          | M1 무접촉(M3)                        | M1 마이그(범위 비대)                            |
| **착수 범위(M6)** | **Tier-S 즉시 / Tier-H 2호 근접 시** | 전체 M1 동시(scaffold가 risky 수술 편승)        |
| codegen source    | registry.json 정본화(Q3)             | types.ts 유지                                   |

---

## §11 진산 결재란 (RULE #5 — 코드 착수 전 필수)

| #      | 결재 질문                                                                                                                                                                   | 선택지                                                | 결정 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---- |
| **Q1** | 착수 범위·타이밍(M6) — Tier-S(scaffold·ExamConfig·near-dead lift)는 즉시, **Tier-H(composition 재설계)는 2호 R3 spike 후 분리 시퀀싱** vs 전체 M1 동시(소강기)              | (a) S즉시/H분리(권고) / (b) 전체 동시 / (c) 전체 대기 | ☐    |
| **Q2** | ★결합 처리(§3-B, C1) — 계층별 분해: 엔진/앱=런타임검증·ExamAdapter 주입, 종목 union=exam 패키지 내부, composition-root 유일 결합점. G-M1-3에 "범용→특정 exam import=0" 추가 | (a) 권고 / (b) ③전면 런타임화 / (c) 재검토            | ☐    |
| **Q3** | 드리프트 방지(§3-C) — 검출 verifier(신규 로직) 먼저, codegen 단일화는 팔로우. source=registry.json 정본화                                                                   | (a) 권고 / (b) 전면 codegen 즉시 / (c) verifier만     | ☐    |
| **Q4** | D1 CHECK 7-vs-11·edge_type CHECK를 M3 이관(M1은 WARN 원장)                                                                                                                  | (a) 권고 / (b) M1 포함                                | ☐    |
| **Q5** | ★parser-1st-exam 처분(§3-F, M5) — 손해평가 특화 코드를 exams/son-hae로 흡수 vs 공존(Rule 15 각주 정합)                                                                      | (a) 흡수 / (b) 공존 / (c) 이번 미결(Tier-H와 동반)    | ☐    |
| **Q6** | ExamConfig 확장 스키마(§6) 승인 + 실측값 별건 L3 constants 분리                                                                                                             | (a) 권고 / (b) 수정                                   | ☐    |
| **Q7** | 단계 커밋(M1-a~f) + 각 green 게이트(§5·§7) + 독립 리뷰 프로토콜                                                                                                             | (a) 승인 / (b) 수정                                   | ☐    |

> **자매 전달물 교차참조(m2)**: 결재카드 E-2는 "M1 plan + **플랫폼 계정 계층 설계서**(통합 계정 D1+SSO+ExamConfig)"를 묶는다. 본 plan은 **ExamConfig(§6)만** 다룸 — 계정 계층(D1 경계·SSO 쿠키)은 **별건 설계서 미작성**(E-2 완료 오독 차단).

---

## §12 rev2 정정 이력 (독립 검증 반영)

| 검증 발견                                                                 | 반영                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **C1** 결합이 apps/api→exam으로 이전·G-M1-3 미포착                        | §3-B composition-root 재설계 + G-M1-3 "범용→특정 exam=0" + Q2 계층분해 |
| **M1** "14 importer 전부 제네릭" 거짓(값분기 2건)                         | §2·§3-B 정정, importer 12, M1-e 값-분기 재스캔(G-M1-9)                 |
| **M2** "단일화" 라벨↔verifier 검출 불일치·Cat10 재사용 아님               | §1 #6·§3-C 개명, 신규 로직 명기                                        |
| **M3** 4 VALUE 편집 부정확(schema.ts 모순·lv1_insurance 누락)             | §2 정정(schema.ts M1 무접촉), §1 lv1_insurance 계열 Year2/M3 원장      |
| **M4** G-M1-TW 구멍(타입가드 미언급·engine키·골든 자기무력)               | §5 재작성(Record<NodeType> 1차·11키 스냅샷·골든 비신뢰)                |
| **M5** parser-1st-exam 누락·turbo 17→18·verify-contracts 카운트           | §3-F Q5·§5 re-baseline·§7 게이트                                       |
| **M6** 타이밍 ROI                                                         | §1 Tier-S/H 분리·§9·§10·Q1                                             |
| minor m1~m5·fact-check(registry 무검증→구조검증만·exam-adapter:98 오인용) | §2·§3-C·§3-D 정정                                                      |
| **인정(건전)** TABLE=engine·2단 가역·D1 M3 이관·Q명시·§0 규율             | 유지                                                                   |
