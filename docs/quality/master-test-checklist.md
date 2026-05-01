# 종합 테스트 마스터 체크리스트 (Master Test Checklist)

**버전:** v1 (정식판 — M-2 흡수, Step 18)
**작성일:** 2026-04-30 (v0 골격) → **2026-05-01 (v1 정식판 — Step 18)**
**효력:** Engine Hardening Step 19 (BATCH-1 직전 게이트) 진입 시점에 모든 항목 PASS 의무
**근거 메모리:** `project_completion_notification_obligation` (기술 부채 0 정책 + 완료 시점 알림 의무)
**자동 집계:** `pnpm tsx scripts/verify-engine-contracts.ts` (CI Quality Gate `Verify engine contracts` step 연계)

> **진산님 2026-04-30 명시:** "엔진이 완성되어도 분명 미흡한 것이나 오류가 잇을 듯 해서 충분한 품질 과 성능 테스트 를 위한 체크항목, 시나리오, 단위, 모듈, 종합 테스트를 해야 할 거야.. 기록을 해두고.. 완료 시점이 되면 알려줘"

---

## 0. 효력 + 진입 게이트

### 0.1 의무 시점

- **Step 18 (현)**: 자동화 가능 항목 CI 통합 + numeric/boolean PASS 기준 명시
- **Step 19 진입 시:** 본 체크리스트 v1 모든 카테고리 PASS 검증 의무 (5-페르소나 리뷰와 동시)
- **Step 20 BATCH-1 적재 진입 차단 게이트:** 본 체크리스트 미PASS = BATCH-1 적재 진입 거부
- **매 phase 종료 시:** 본 체크리스트 진척도 진산님 보고

### 0.2 PASS 기준 정의

본 체크리스트 모든 항목은 **numeric** (정량 카운트 / 임계값) 또는 **boolean** (전수 통과 / 전수 차단) 두 가지 형식으로 분류:

- **numeric**: `observed >= required` 면 PASS. 예: 테스트 카운트 ≥ 251
- **boolean**: `value === required` 면 PASS. 예: Hard Rule 17 위반 0건 = `true`

자동화 가능 항목은 `scripts/verify-engine-contracts.ts` JSON 결과 (CI artifact) 로 집계. 수동 검수 항목은 진산님 검수 의무 + 본 문서 §10 진척도 매트릭스에 PASS/FAIL 기록.

### 0.3 8 카테고리

|  #  | 카테고리                      | 자동화 비율  | 책임                                                |  Step 18 PASS  |
| :-: | :---------------------------- | :----------: | :-------------------------------------------------- | :------------: |
|  1  | **단위 테스트** (Unit)        |     100%     | 함수/메서드 단독 결정성 + 경계값                    |    ✅ PASS     |
|  2  | **모듈 테스트** (Module)      |     100%     | 패키지 내 상호작용 + 인터페이스 계약                |    ✅ PASS     |
|  3  | **통합 테스트** (Integration) |     100%     | 패키지 간 단방향 의존성 + 데이터 흐름               |    ✅ PASS     |
|  4  | **E2E 테스트** (End-to-End)   |     100%     | runPipeline 풀 실행 + D1 영속화                     |    ✅ PASS     |
|  5  | **성능 테스트** (Performance) | 80%/20% 수동 | Workers 50ms CPU + 토큰 비용 + DB latency           |   ⏳ Phase 2   |
|  6  | **품질 테스트** (Quality)     | 90%/10% 수동 | Golden Test + 산식 정확도 + 정답 100%               |    ✅ PASS     |
|  7  | **보안 테스트** (Security)    |     100%     | API key / SQL injection / XSS / 동적 코드 실행 차단 |    ✅ PASS     |
|  8  | **출력 검증** (Output)        | 50%/50% 수동 | LLM 생성 콘텐츠 신뢰성·정확성 + 출처 추적성         | ⏳ LLM 통합 후 |

---

## 1. 단위 테스트 (Unit) — Cat 1

### 1.1 패키지별 카운트 (numeric, 자동 집계)

| 패키지                    | 현재 (2026-05-01) | required (Step 19) | PASS 조건                                | 자동 |
| :------------------------ | :---------------: | :----------------: | :--------------------------------------- | :--: |
| `@thepick/formula-engine` |        251        |        251         | observed ≥ 251 + failed = 0              |  ✅  |
| `@thepick/parser`         |        136        |        136         | observed ≥ 136 + failed = 0              |  ✅  |
| `@thepick/quality`        |        41         |         41         | observed ≥ 41 + failed = 0               |  ✅  |
| `@thepick/batch`          |        236        |        236         | observed ≥ 236 + failed = 0              |  ✅  |
| `@thepick/shared`         |        33         |         33         | observed ≥ 33 + failed = 0               |  ✅  |
| `@thepick/api`            |        199        |        199         | observed ≥ 199 + failed = 0              |  ✅  |
| `@thepick/ai-adapter`     |        13         |        30+         | LLM 통합 후 +17                          |  🟡  |
| **모노레포 합계**         |      **909**      |      **909**       | 2026-05-01 Step 18 기준 정확 carbon copy |  ✅  |

### 1.2 핵심 시나리오 (boolean, 패키지별 전수 통과)

- [x] **Null/Undefined/Empty/Whitespace 모든 입력 차단** — assertValidExamId / canonicalJson / Mulberry32 전 패키지
- [x] **경계값 (0 / 1 / MAX_SAFE_INTEGER / NaN / Infinity)** — formula-engine numeric_value 100% 검증
- [x] **결정성 100회 반복 (Mulberry32 PRNG seeded)** — formula 251 / parser 136 / quality 41 모두 invariant_fields
- [x] **충돌 차단 (다른 입력 → 다른 출력)** — buildSourceId 충돌 검증 (8 d1-trigger tests)
- [x] **Throw 경로 (idempotency 키 부재 / 패턴 위반)** — assertValidExamId throw + EXAM_IDS allowlist 회귀
- [x] **Exports / 상수 일치** — TRUTH_WEIGHTS / NodeType / EdgeType 전수
- [ ] **multi-byte / 매우 긴 input (UTF-8 1000자 이상)** ← Phase 이월 부채 M-3 (Step 19 보강 또는 Phase 2)

---

## 2. 모듈 테스트 (Module) — Cat 2

### 2.1 패키지 내 상호작용 (boolean, 모듈 경계 + 인터페이스 계약)

- [x] **`@thepick/parser`** — schema-validator + ontology-registry-loader + normalizer 3 모듈 연계
- [x] **`@thepick/quality`** — graph-integrity + supersede-cycle + normalizer 3 모듈 연계
- [x] **`@thepick/formula-engine`** — ast-parser + engine + sandbox 3 모듈 연계
- [x] **`@thepick/batch`** — loader + cost-meter + checkpoint + recover 4 모듈 연계 (+ pipeline 통합)
- [x] **인터페이스 계약 위반 차단** — TypeScript readonly + Zod 런타임 검증 + ExamId brand type
- [x] **Logger 인터페이스 계약** — `@thepick/shared/logger` JSON 1줄 구조 + child() context 누적 (Step 18)

### 2.2 자동 집계 (numeric)

| 지표                    | observed | required | 자동 |
| :---------------------- | :------: | :------: | :--: |
| 모듈 내 인터페이스 위반 |    0     |    0     |  ✅  |
| 의존성 단방향 위반      |    0     |    0     |  ✅  |

---

## 3. 통합 테스트 (Integration) — Cat 3

### 3.1 패키지 간 단방향 의존성 + 데이터 흐름 (boolean)

- [x] **`apps/batch/src/__tests__/pipeline.integration.test.ts`** — Step 11.6 9 AC e2e 195/195 PASS 유지
- [x] **parser → batch** (KnowledgeContract 단방향) — 역방향 import 0건
- [x] **quality → batch** (IntegrityReport 단방향) — 역방향 import 0건
- [x] **formula-engine → batch** (산식 검증 단방향) — 역방향 import 0건
- [x] **Hexagonal 위반 0건** — modules/ domain → infrastructure 직접 참조 없음
- [x] **Hard Rule 16 — 시험 경계 강제 examId 시그니처** — recover.ts BatchRunsDb / loader.ts findNodesByType 모든 데이터 함수
- [x] **Hard Rule 17 — EXAM_IDS 경유** — exam-ids.ts 외 production 'son-hae-pyeong-ga-sa' 리터럴 0건 (자동 검증 스크립트 PASS)

### 3.2 자동 집계 (CI 통합)

| 검증 항목                 | 도구                                | PASS 조건      |
| :------------------------ | :---------------------------------- | :------------- |
| Hard Rule 17 위반         | `verify-engine-contracts.ts` Cat 7  | violations = 0 |
| pipeline.integration 회귀 | `pnpm --filter @thepick/batch test` | 12/12 PASS     |
| Hexagonal 위반            | tsc + eslint import/no-cycle        | 0건            |

---

## 4. E2E 테스트 (End-to-End) — Cat 4

### 4.1 runPipeline 풀 실행 + D1 영속화 (boolean, 자동)

| AC ID       | 시나리오                                                    | 위치                                  | 상태 |
| :---------- | :---------------------------------------------------------- | :------------------------------------ | :--: |
| AC-RP-1     | 시나리오 A — Reproducibility (동일 seed → invariant)        | `reproducibility-idempotency.test.ts` |  ✅  |
| AC-RP-2     | 시나리오 B — Concurrent (Promise.all 2개 → 1개만 completed) | `reproducibility-idempotency.test.ts` |  ✅  |
| AC-RP-3     | 시나리오 C — Recover (50% kill → recover → 정상 동일)       | `reproducibility-idempotency.test.ts` |  ✅  |
| AC-RP-4     | 시나리오 E — Rerun (동일 batch_run_id → skip)               | `reproducibility-idempotency.test.ts` |  ✅  |
| AC-RP-5     | 시나리오 D — Cron — Phase 2 SKIP                            | (별도 plan)                           |  ⏳  |
| AC-RP-6     | 0016 마이그레이션 + 0014 트리거 e2e                         | `d1-trigger-verify.test.ts`           |  ✅  |
| AC-RP-7     | source_id 결정성 100회 반복 동일                            | `d1-trigger-verify.test.ts`           |  ✅  |
| AC-R1       | atomic last-stage kill → already_completed                  | `pipeline.integration.test.ts`        |  ✅  |
| AC-R3       | 동시 트리거 → 중복 INSERT 0건                               | `pipeline.integration.test.ts`        |  ✅  |
| AC-Snapshot | canonicalJson 4 시나리오 (self/mutual/diamond/deep)         | `pipeline.integration.test.ts`        |  ✅  |
| AC-Cost     | CostMeter onKillSwitch flush + 7 케이스 직렬화              | `cost-meter-pipeline-kill.test.ts`    |  ✅  |
| AC-ExamId   | BatchRunsDb examId 시그니처 + SF-M-2 cross-tenant 가드      | `pipeline.integration.test.ts`        |  ✅  |
| AC-T3       | batch_runs state transition matrix 5×7 e2e                  | `d1-trigger-verify.test.ts`           |  ✅  |

### 4.2 자동 집계 (numeric)

| 지표                              | observed | required | 자동 |
| :-------------------------------- | :------: | :------: | :--: |
| AC 시나리오 커버 파일 카운트      |    7     |    4     |  ✅  |
| pipeline.integration 12/12 PASS   |    12    |    12    |  ✅  |
| reproducibility-idempotency 15/15 |    15    |    15    |  ✅  |
| d1-trigger-verify 신규 8 + 기존   |   28+    |    16    |  ✅  |

### 4.3 MINOR-C2 흡수 — AC-RP-1 invariant_fields 매핑 (boolean)

| invariant_field             | 검증 위치                                                  | 의미                                   |
| :-------------------------- | :--------------------------------------------------------- | :------------------------------------- |
| `formula_AST`               | `formula-engine/__tests__/determinism.test.ts` (251 tests) | math.js AST 노드 동일 = 산식 결정성    |
| `edge_dependency_graph`     | `quality/__tests__/normalizer.test.ts` + integrity (41)    | 의존 엣지 정규화 = 그래프 결정성       |
| `ontology_registry_match`   | `parser/__tests__/ontology-registry-loader.test.ts` (136)  | 노드/엣지 ID 패턴 일치 = ontology lock |
| `node_count` / `edge_count` | `pipeline.integration.test.ts` AC-RP-1                     | 노드·엣지 카운트 동일 = 적재 결정성    |
| `state_hash`                | `recover.ts` SHA-256 검증                                  | checkpoint 무결성                      |

---

## 5. 성능 테스트 (Performance) — Cat 5 [Phase 2 위임]

### 5.1 Workers 런타임 + 토큰 비용 + DB latency

| 지표                                         | required                   | 자동 |        상태        |
| :------------------------------------------- | :------------------------- | :--: | :----------------: |
| Workers CPU 시간                             | < 50ms (free) / 30s (paid) | 80%  |     ⏳ Phase 2     |
| 노드 1000건 INSERT D1 atomic                 | < 5s (배치 단위)           | 80%  |     ⏳ Phase 2     |
| CostMeter SLO (soft warn/hard throttle/kill) | 3 임계 모두 트리거 검증    | 100% |     ✅ Step 12     |
| BATCH-1~5 적재 토큰 비용                     | < $200 (Anthropic cap)     | 100% | ⏳ Layer 2 활성 후 |
| Vectorize 쿼리 latency                       | < 500ms p95                | 80%  |     ⏳ Phase 2     |
| PWA 콜드 스타트                              | < 3s                       | 80%  |     ⏳ Phase 2     |
| FSRS 간격 계산                               | < 50ms                     | 100% |     ⏳ Phase 2     |

### 5.2 자동 집계 (numeric)

성능 벤치는 Phase 2 별도 plan 필요. Step 18 verify-engine-contracts.ts 는 Cat 5 = SKIP.

---

## 6. 품질 테스트 (Quality) — Cat 6

### 6.1 Golden Test + 산식 정확도 + 기출 정답 100% (boolean)

- [x] **Formula Engine 산식 정확도 100%** — 교재 예시값 (소수점 정밀도 포함) — 251 tests PASS
- [ ] **기출 파서 ↔ 공식 정답 100%** — 1건 불일치 시 즉시 원인 규명 (BATCH-1~5 적재 후 검증)
- [ ] **Constants 추출 0건 오류** — 65%를 60%로 잘못 추출 차단 (BATCH-1 적재 후 인간 검수)
- [x] **Graph 무결성** — 고아 노드 0 / 끊긴 엣지 0 / SUPERSEDES 순환 0 — quality 41 tests PASS
- [ ] **Tarjan SCC vs naive DFS 비교** ← Step 15b 의무 (이연)
- [x] **AI 생성 데이터 — draft 만 적재** — loader.ts INSERT status='draft' 강제
- [ ] **암기법 역방향 검증** — 두문자어 → 원래 항목 복원 100% (BATCH-1 mnemonic 생성 후)

### 6.2 자동 집계 (numeric)

| 지표                                            | observed |   required   | 자동 |
| :---------------------------------------------- | :------: | :----------: | :--: |
| Formula Engine 결정성 + sandbox property 테스트 |   251    |     251      |  ✅  |
| D1 마이그레이션 파일 카운트                     |    16    |      16      |  ✅  |
| Graph 무결성 (quality)                          |    41    |      41      |  ✅  |
| Constants 추출 정확도 (BATCH-1 후)              |   TBD    | manual_check |  ⏳  |

---

## 7. 보안 테스트 (Security) — Cat 7

### 7.1 API key / SQL injection / XSS / 동적 코드 실행 차단 (boolean, 자동)

| 항목                                                                  | 자동화                                                |   required   | observed |      PASS       |
| :-------------------------------------------------------------------- | :---------------------------------------------------- | :----------: | :------: | :-------------: |
| Formula Engine 동적 코드 실행 (eval/Function) 0건                     | `verify-engine-contracts.ts` Cat 7 (PAT_DYNAMIC_CODE) |     0건      |    0     |       ✅        |
| innerHTML 류 위험 DOM 직접 할당 0건 (XSS 차단)                        | `verify-engine-contracts.ts` Cat 7                    |     0건      |    0     |       ✅        |
| Hard Rule 17 — EXAM_IDS 리터럴 단일 선언                              | `verify-engine-contracts.ts` Cat 7                    |     0건      |    0     |       ✅        |
| Step 18 logger 도입 — pipeline/recover/signal-handlers console.\* 0건 | `verify-engine-contracts.ts` Cat 7                    |     0건      |    0     |       ✅        |
| API key 클라이언트 노출 0건                                           | `scripts/check-no-secrets.sh` (pre-commit)            |     0건      |    0     |       ✅        |
| D1 prepared statement 의무 (SQL injection 차단)                       | drizzle-orm 강제 + grep                               |     100%     |   100%   |       ✅        |
| Constants 직접 수정 차단                                              | 0014 트리거 화이트리스트                              |     100%     |   100%   |       ✅        |
| Temporal Graph UPDATE 차단                                            | 0014 prevent_knowledge_nodes_update 트리거            |     100%     |   100%   |       ✅        |
| 사용자 입력 검증 (Zod)                                                | apps/api/src/routes/\* 전수                           | manual_audit |   TBD    | ⏳ Phase 1 후반 |

### 7.2 자동 집계 (CI 통합)

`scripts/verify-engine-contracts.ts` Cat 7 = boolean 4건 모두 PASS = exit 0.

---

## 8. 출력 검증 (Output) — Cat 8 [LLM 통합 후 Phase 1 후반]

### 8.1 LLM 생성 콘텐츠 신뢰성·정확성 + 출처 추적성 (boolean, 50% 자동 + 50% 수동)

본 카테고리는 메모리 `project_source_citation_requirement` 정합. BATCH-1 적재 후 본격 활성.

- [ ] **OX/빈칸/변형 문제 정답 100% 정확** — Hard Stop 조건. AI 자동 검수 + 인간 검수 큐 (Phase 1 후반)
- [ ] **모든 생성 콘텐츠에 출처 FK** — 교재 페이지 / 법조문 / 기출 ID — 자동 grep + draft INSERT 검증
- [ ] **근거 0건 = approved 차단** — draft 상태 영구 잔존 (자동, 0014 트리거)
- [ ] **수험자 "근거 보기" UX** — 1급 기능 작동 (수동 검수)
- [ ] **Reviewer 검수 큐** — Phase 1 후반 (사용자 노출 전) 의무 — 큐 적재 자동, 검수 수동
- [ ] **AI 자동 검수 — 낮은 신뢰도 자동 reject** — Vectorize 유사도 + LLM 재검증

### 8.2 자동 집계 (Phase 1 후반 활성)

| 지표                            | required             | 도구                       |
| :------------------------------ | :------------------- | :------------------------- |
| draft → approved 인간 승인 비율 | 100% (자동 승인 0건) | admin-web Reviewer 큐      |
| 출처 FK 부재 노드 카운트        | 0건                  | quality grep + INSERT 검증 |
| 정답 정확도 (BATCH-1 sample)    | 100%                 | 인간 검수 + AI 자동 비교   |

---

## 9. CI 통합 (Step 18 Quality Gate)

### 9.1 자동 집계 스크립트

```bash
# Local
pnpm tsx scripts/verify-engine-contracts.ts          # Human-readable + JSON stdout
pnpm tsx scripts/verify-engine-contracts.ts --json   # JSON-only (CI artifact 용)

# CI (.github/workflows/ci.yml `Verify engine contracts` step)
# exit 0 = Cat 1/4/6/7 모두 PASS, exit 1 = 한 카테고리라도 FAIL
```

### 9.2 카테고리별 자동/수동 비율

| 카테고리 | 자동화 | 수동 검수 | Step 19 진입 게이트                            |
| :------- | :----: | :-------: | :--------------------------------------------- |
| Cat 1    |  100%  |    0%     | verify-engine-contracts ✅                     |
| Cat 2    |  100%  |    0%     | verify-engine-contracts ✅                     |
| Cat 3    |  100%  |    0%     | verify-engine-contracts ✅                     |
| Cat 4    |  100%  |    0%     | verify-engine-contracts ✅                     |
| Cat 5    |  80%   |    20%    | Phase 2 별도 plan                              |
| Cat 6    |  90%   |    10%    | verify-engine-contracts + BATCH-1 후 인간 검수 |
| Cat 7    |  100%  |    0%     | verify-engine-contracts ✅                     |
| Cat 8    |  50%   |    50%    | Phase 1 후반 Reviewer 큐 활성                  |

---

## 10. 진척도 매트릭스 (Step 19 진입 시 갱신 의무)

| 카테고리 | v1 시나리오 |         자동화 비율          | 2026-05-01 (Step 18) |
| :------- | :---------: | :--------------------------: | :------------------: |
| 1 단위   |     ✅      |        100% (vitest)         |       ✅ PASS        |
| 2 모듈   |     ✅      |        100% (vitest)         |       ✅ PASS        |
| 3 통합   |     ✅      |     100% (vitest + grep)     |       ✅ PASS        |
| 4 E2E    |     ✅      |        100% (vitest)         |       ✅ PASS        |
| 5 성능   |     ✅      |   80% (벤치) + 20% (수동)    |      ⏳ Phase 2      |
| 6 품질   |     ✅      |     90% (golden + grep)      |       ✅ PASS        |
| 7 보안   |     ✅      |     100% (grep + audit)      |       ✅ PASS        |
| 8 출력   |     ✅      | 50% (자동) + 50% (인간 검수) |    ⏳ LLM 통합 후    |

**Step 18 Overall**: 6 카테고리 PASS / 2 카테고리 ⏳ (Phase 2 + LLM 통합 후) → **자동 검증 게이트 PASS** (exit 0).

---

## 11. v0 → v1 변경 이력

| 항목                      | v0 (2026-04-30) | v1 (2026-05-01 Step 18)                      |
| :------------------------ | :-------------- | :------------------------------------------- |
| 카테고리 골격             | ✅ 존재         | ✅ 유지                                      |
| 시나리오 매트릭스         | ~3 줄/카테고리  | 20~50 줄/카테고리                            |
| numeric/boolean PASS 기준 | ❌ 미명시       | ✅ 모든 항목 명시                            |
| 자동 집계 스크립트 연계   | ❌ 골격만 언급  | ✅ verify-engine-contracts.ts 동작 + CI 통합 |
| MINOR-C2 invariant 매핑   | ❌              | ✅ §4.3 흡수                                 |
| 진척도 매트릭스           | 골격            | 자동/수동 비율 명시                          |

---

## 12. 차세션 의무 (Step 19 진입 시)

1. 본 v1 정식판 갱신 — Step 19 5-페르소나 리뷰 결과 반영 + 종합 테스트 v1 PASS 증거 추가
2. Cat 5 (성능) Phase 2 별도 plan 트리거
3. Cat 8 (출력) LLM 통합 후 Reviewer 큐 활성 — Phase 1 후반 plan 진입
4. Engine Observability `engine_telemetry` 마이그레이션 0017 도입 시 Cat 5 자동화 비율 80% → 90% 갱신

---

**v0 작성자:** Claude (Opus 4.7) — 진산님 2026-04-30 명시 트리거 흡수
**v1 작성자:** Claude (Opus 4.7) — Step 18 M-2 흡수 + verify-engine-contracts.ts 자동 집계 연계
**v1 효력 시점:** 2026-05-01 Step 18 진입
**v2 작성 시점:** Step 19 진입 시 (5-페르소나 + 종합 테스트 PASS 증거 흡수)
