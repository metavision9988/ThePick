# Review — P0 정정 (B-C1 + B-C2 + Step 5 examId 흡수) — system-architect

- **리뷰 방식:** 독립 에이전트 (system-architect)
- **리뷰 일시:** 2026-04-28 20:03:07
- **리뷰 범위:** 코드 3파일 + 마이그레이션 1신규 + plan 3 갱신
- **직전 4-Pass 권고 흡수:** `.claude/reviews/midpoint-20260428-backend.md` C-1 (knowledge_nodes 컬럼 부재) + C-2 (BatchRunsDb examId 부재)
- **본 리뷰 책임 한정:** 시스템 정합성 / 모듈 결합도 / 인터페이스 호환성 / Year 2 진화 경로
- **본 리뷰 책임 외:** silent failure / 에러 처리 (silent-failure-hunter), 테스트 커버리지 (quality-engineer)

---

## 0. 한 줄 평가

> **reject_and_revise.** B-C1/B-C2 의 권고를 **정확히 흡수한 부분 (recover.ts 시그니처, 0016 마이그레이션, BatchCheckpoint.exam_id optional)** 은 견고하다. **그러나 Step 11.6 plan §10 "현재 caller 0건 가정" 이 사실과 다르다** — `apps/batch/bin/batch.ts:156-169` 와 `apps/batch/src/__tests__/pipeline.integration.test.ts` 에 `PipelineContext` 직접 구성 callsite 가 **5건 이상 실재**한다. plan §3.1 의 `examId` required 전환은 본 5+ callsite 의 컴파일 실패를 유발 — 미정정 시 "다음 단계 진입 = 빌드 깨짐". 본 결함 1건이 reject 사유.

---

## 1. 검증 항목별 결과

### 검증 1 — `BatchRunsDb` 시그니처 변경의 호환성

**확인:** `recover.ts:70-84` 에 `selectByRunId(examId, batchRunId)` / `updateState(examId, batchRunId, update)` 메서드 정의. `recoverBatch` 본문 (`recover.ts:133`, `recover.ts:247`) 에서 `opts.examId` 로 첫 인자 주입. `recover.test.ts:32` 의 `TEST_EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA` 픽스처가 8개 호출 (lines 127, 189, 223, 256, 297, 334, 355, 372) 모두에서 첫 인자로 사용됨.

**Step 11.6 plan §4.4 D1BatchRunsDb 정합:** plan line 581-665 의 어댑터가 `recover.ts:70-84` 인터페이스와 **시그니처 일치**. `selectByRunId(examId, batchRunId)`, `updateState(examId, batchRunId, update)` 모두 일치. 단 plan 의 `insertNewRun(examId, input)` 메서드는 **`recover.ts` 의 `BatchRunsDb` 인터페이스에 부재** — Step 11.6 코드 진입 시 `BatchRunsDb` 인터페이스 확장 의무.

**결과:** PASS (권고 흡수 정확). 단, MINOR 1건 — `insertNewRun` 추가는 Step 11.6 진입 시 의무.

---

### 검증 2 — `PipelineContext.examId` required 의 영향 → **CRITICAL**

**확인 (반증):** plan §10 line 1038 — _"기존 caller 는 없거나 테스트 fixture 만 — 영향 최소"_ 가 **사실과 다름**.

**증거 (실재 callsite):**

| 파일:라인                                                       | callsite                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/batch/bin/batch.ts:156-169`                               | `cmdRun()` 의 `const ctx: PipelineContext = { batchId, config, ... }` (production CLI 진입점) |
| `apps/batch/src/__tests__/pipeline.integration.test.ts:100-113` | "Stage 1~3 skipped" 통합 테스트                                                               |
| `apps/batch/src/__tests__/pipeline.integration.test.ts:131-144` | "dry-run: Stage 5" 통합 테스트                                                                |
| `apps/batch/src/__tests__/pipeline.integration.test.ts:166-179` | "Stage 1~9 전체 성공"                                                                         |
| `apps/batch/src/__tests__/pipeline.integration.test.ts:216-229` | "실패 경로"                                                                                   |
| `apps/batch/src/__tests__/pipeline.integration.test.ts:327-339` | "non-fixture 통합 (CR-5b)"                                                                    |

**문제:** plan §3.1 line 231 `readonly examId: ExamId;` (required, optional 아님) 이 적용되면 위 6개 callsite 모두 컴파일 실패. `bin/batch.ts:156` 는 production CLI — 빌드 실패 시 BATCH 적재 차단.

**system-architect 관점 비판:**

- plan line 1085 "**§3.1 `PipelineContext` 확장 4개 required 필드** (`batchRunId` / `checkpointBaseDir` / `batchRunsDb` / `engineVersion`)" 에서 4개만 거명하고 `examId` 는 5번째 required 로 추가됨 — plan 진산님 승인 시점 (2026-04-28 "어렵군... 모두 권고 대로 진행해줘") 후에 추가된 P0-B-C2 정정 결과.
- 본 리뷰 시점 typecheck PASS 인 이유는 **Step 11.6 코드를 아직 미진입했기 때문** — `pipeline.ts:168` 의 현 `PipelineContext` 는 `examId` 필드가 없고, plan 만 갱신된 상태.
- 즉 "plan 갱신은 검증 PASS 처럼 보이나, 코드 진입 즉시 6 callsite 깨짐" — Step 11.6 코드 진입의 다음 단계가 컴파일 실패.

**완화 (권고 — 다음 중 1):**

- **(A)** Step 11.6 plan §3.1 의 `examId` 를 **`readonly examId?: ExamId`** optional 로 시작 후 §3.3 `runPipeline` 진입에서 `ctx.examId ?? DEFAULT_EXAM_ID` 폴백. Year 2 Phase 4 진입 시 required 전환.
- **(B)** Step 11.6 plan §10 호환 보장 절에 "본 5 callsite 도 plan 적용 시 `examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA` 명시 추가 의무" 명시 + Step 11.6 작업 추정에 0.05d 추가.
- **(C)** Step 11.6 code 진입 시 `bin/batch.ts` 와 `pipeline.integration.test.ts` 6 callsite 동시 정정 PR 의무화.

권고 (B) 가 가장 안전 — Hard Rule 16 의 **examId 시그니처 의무** 는 optional 도입으로는 약화됨. 권고 (A) 는 "Year 2 zero-cost 전환" 의 핵심 가치 (시그니처 일치) 를 약화시키므로 거부.

**판정:** 🔴 CRITICAL — Step 11.6 코드 진입 전 plan §10 의 "caller 0건" 문구 정정 + 6 callsite 갱신 의무 명시 필요.

---

### 검증 3 — `BatchCheckpoint.exam_id` optional 의 진화 경로

**확인:**

- `checkpoint.ts:84` — `readonly exam_id?: ExamId;` Year 1 한시 예외 명시 (production-quality.md Hard Rule 17 인용 정확).
- `checkpoint.ts:147` — `SnapshotInput.examId?: ExamId` optional.
- `checkpoint.ts:171` — `...(input.examId !== undefined ? { exam_id: input.examId } : {})` spread 패턴 사용 — examId 미주입 시 `exam_id` 키 자체가 base 에서 **누락**.

**`state_hash` 결정성 영향 분석 (canonicalJson):**

`checkpoint.ts:295-310` 의 `canonicalJson` 은 키 정렬 후 JSON.stringify. 시나리오:

| 시나리오                                                                              | 결과                                                                                      |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Year 1 기존 checkpoint (`buildCheckpoint({ examId: undefined })`)                     | `exam_id` 키 자체 미생성 → canonical 출력에 미포함 → 기존 hash 와 동일 ✅                 |
| Year 1 신규 checkpoint (`buildCheckpoint({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA })`) | `exam_id: 'son-hae-pyeong-ga-sa'` 키 생성 → canonical 출력에 포함 → 기존 hash 와 **다름** |

**충돌 시나리오 (Year 1 → Year 2 전환):**

1. Year 1 checkpoint A 가 `examId` 미주입으로 hash H1 으로 저장됨.
2. Year 2 Phase 4 진입 시 `BatchCheckpoint.exam_id` 가 required 전환 + `buildCheckpoint` 에서 default 주입 (`EXAM_IDS.SON_HAE_PYEONG_GA_SA`) 시작.
3. `readCheckpoint(A)` → `parsed.exam_id === undefined` → `computeStateHash(parsed)` 가 H1 (정합) — **여기까진 OK**.
4. **그러나** Year 2 마이그레이션 helper 가 A 를 `exam_id` 추가 후 재저장 시도 → `computeStateHash` 가 H2 (다름) → 변조로 판정 → CheckpointCorruptedError throw.

**완화:**

- `CHECKPOINT_SCHEMA_VERSION` bump (1 → 2) 의무: Year 2 진입 시 v1 → v2 마이그레이션 함수에서 hash 재계산 정상화. `checkpoint.ts:36` 에 v1 → v2 진화 경로 ADR 인용 주석 권고.
- **또는** Year 1 현재 시점에 모든 신규 checkpoint 가 `examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA` **항상 주입**하도록 강제 (Step 11.6 §3.3 line 351 의 `examId: ctx.examId` 가 이를 충족 — 단 ctx.examId 가 검증 2 의 6 callsite 에서 미주입 시 undefined → spread skip → hash 분기).

**Step 11.6 caller 일관성:**

- plan §3.3 line 300 `examId: ctx.examId` 와 line 351 `examId: ctx.examId` 가 spread 결과 둘 다 `exam_id` 포함되도록 보장하려면 `ctx.examId` 가 **항상 정의** 되어야 함 — 검증 2 의 권고 (B) 채택 시 보장.

**기존 `.checkpoint/*.json` 파일 호환성:**

- 현 시점 `.checkpoint/` 디렉토리는 untracked + 무내용 (실 BATCH 미실행). production 진입 후 누적된 파일이 Year 2 진입 시 어떻게 처리되는지는 plan §10.1 롤백 절에 명시되어 있지 않음. → 권고: ADR-026 (가칭) "Checkpoint Schema Evolution" 작성.

**판정:** 🟠 MAJOR — Year 2 진입 시 hash 변동 위험 + checkpoint schema migration 정책 미정의. Step 11.6 진입 전 ADR 1건 추가 권고.

---

### 검증 4 — 0016 마이그레이션의 0014 트리거 정합

**확인:**

- 0016 line 67-89 의 `prevent_knowledge_nodes_update` 가 0014 line 35-53 의 14개 컬럼 화이트리스트 (id/type/name/description/lv1_insurance/lv2_crop/lv3_investigation/page_ref/batch_id/version_year/superseded_by/truth_weight/status/exam_scope) 를 **전수 보존** ✅. 라인별 dedupe 검증 완료.
- 0016 line 85-86 추가 화이트리스트 (`OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id` / `OLD.source_id IS NOT NULL AND NEW.source_id IS NOT OLD.source_id`) — backfill (NULL → 값) 만 허용, 값 → 다른 값 / 값 → NULL 차단.
- Step 5 plan v1.1 line 87-110 의 SQL 본문과 **단어 단위 일치** (회귀 0건 검증 PASS).

**IS NOT 비교 패턴의 NULL-safe 정합:**

SQLite `IS NOT` 는 NULL-safe (`NULL IS NOT NULL` = FALSE, `NULL IS NOT 'x'` = TRUE, `'x' IS NOT NULL` = TRUE). 0016 line 85 의 `OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id`:

| OLD  | NEW  | 평가           | 결과                     |
| ---- | ---- | -------------- | ------------------------ |
| NULL | NULL | FALSE AND ...  | FALSE (no abort) ✅      |
| NULL | 'x'  | FALSE AND ...  | FALSE (backfill 허용) ✅ |
| 'x'  | 'x'  | TRUE AND FALSE | FALSE (no-op 허용) ✅    |
| 'x'  | 'y'  | TRUE AND TRUE  | TRUE (값→다른값 차단) ✅ |
| 'x'  | NULL | TRUE AND TRUE  | TRUE (값→NULL 차단) ✅   |

**완벽한 truth table 일치** — Step 5 AC-RP-6 의 의도와 정확히 일치.

**판정:** ✅ PASS (정합 0건 결함).

---

### 검증 5 — 0016 partial UNIQUE INDEX 의 production 정합

**확인:**

- 0016 line 46-48 — `CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_nodes_batch_source ON knowledge_nodes(batch_run_id, source_id) WHERE batch_run_id IS NOT NULL`
- SQLite partial 인덱스: 3.8.0+ 지원 (D1 SQLite 버전은 3.40+ 기반). production 호환 ✅
- D1 (Cloudflare 분산 SQLite) 는 partial 인덱스를 native 지원 — wrangler d1 docs 명시.

**`INSERT OR IGNORE` 와 partial UNIQUE 의 호환:**

`apps/batch/src/loader/draft-loader.ts:245` — `INSERT OR IGNORE INTO knowledge_nodes (..., id, type, ...) VALUES (...)`. 현 컬럼 목록에 **`batch_run_id` / `source_id` 부재** — 0016 마이그레이션 적용 후에도 `draft-loader.ts:244-249` SQL 갱신 의무.

**호환성 분석:**

- partial index `WHERE batch_run_id IS NOT NULL` — `batch_run_id IS NULL` 인 row 는 인덱스에서 제외. 따라서 NULL row 무한 INSERT 가능 (Year 1 fixture seed / import 안전).
- `batch_run_id IS NOT NULL` row 끼리는 `(batch_run_id, source_id)` UNIQUE 강제 — `INSERT OR IGNORE` 가 conflict 시 silently skip.
- SQLite `INSERT OR IGNORE` semantics: 모든 UNIQUE constraint (PK + 명시 UNIQUE INDEX) 충돌 시 IGNORE. partial UNIQUE 도 포함됨 — production 정합 ✅.

**잠재적 미스매치:**

- `draft-loader.ts:244-249` 의 SQL 은 `batch_run_id` / `source_id` 컬럼 INSERT 미포함 — Step 5 plan v1.1 line 43-46 의 의무 (모든 INSERT 에 컬럼 추가) 가 아직 미반영. 본 P0 정정 범위 외이지만, Step 5 진입 전 의무.

**판정:** ✅ PASS (0016 인덱스 자체는 production 정합). 단 Step 5 진입 시 `draft-loader.ts` 갱신 의무 (본 정정 범위 외, 메모용).

---

### 검증 6 — Hard Rule 16 정합 (examId 첫 인자)

**확인:**

- `recover.ts:71` — `selectByRunId(examId: ExamId, batchRunId: string)` — examId 첫 인자 ✅
- `recover.ts:73-74` — `updateState(examId: ExamId, batchRunId: string, update: ...)` — examId 첫 인자 ✅
- `recover.ts:111-112` — `RecoverOptions.examId: ExamId` required — 호출 측 의무화 ✅
- `recover.ts:133` — `opts.batchRunsDb.selectByRunId(opts.examId, opts.batchRunId)` — 첫 인자 정합 ✅
- `recover.ts:247` — `opts.batchRunsDb.updateState(opts.examId, opts.batchRunId, {...})` — 첫 인자 정합 ✅
- Step 11.6 plan §4.4 line 584 / 595 / 622 의 `D1BatchRunsDb` 어댑터 — examId 첫 인자 ✅

**Year 2 zero-cost 전환 보장:**

- Year 2 Phase 4 마이그레이션 0005 (exam_id 컬럼 도입) 시점에 `D1BatchRunsDb` 내부 SQL 만 `WHERE exam_id = ?` 추가 → caller 측 코드 변경 0건 — Hard Rule 16 의도 정확히 충족 ✅.
- `recover.ts:60-69` 주석에 "Year 2 Phase 4 마이그레이션 0005 도입 시 zero-cost 전환 가능 (호출 측 코드 변경 X, 어댑터 내부만 WHERE exam_id = ? 추가)" 명시.

**판정:** ✅ PASS (Hard Rule 16 정합 — recover.ts 본체 한정).

---

### 검증 7 — Hard Rule 17 정합 (EXAM_IDS 경유, 직접 리터럴 0건)

**확인:**

- `recover.test.ts:16` — `import { EXAM_IDS } from '@thepick/shared';`
- `recover.test.ts:32` — `const TEST_EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA;` — 픽스처 변수 패턴 ✅
- `recover.test.ts:127, 189, 223, 256, 297, 334, 355, 372` (8회) — `examId: TEST_EXAM_ID` 사용 — 직접 리터럴 0건 ✅
- `recover.ts:26` — `import type { ExamId } from '@thepick/shared';` — type-only ✅
- `checkpoint.ts:32` — `import type { ExamId } from '@thepick/shared';` — type-only ✅
- `recover.ts` / `checkpoint.ts` 본문에 `'son-hae-pyeong-ga-sa'` 리터럴 grep 결과: **0건** ✅
- `recover.test.ts` 본문에 `'son-hae-pyeong-ga-sa'` 리터럴 grep 결과: **0건** (오직 EXAM_IDS 경유) ✅

**production-quality.md Hard Rule 17 "예외 (Rule 적용 제외)" 와의 일치:**

- 0016 마이그레이션 본문 — Rule 17 본문 "테스트 픽스처 / ADR / docs / 파일 경로" 외 데이터 영역. 그러나 0016 SQL 에 `'son-hae-pyeong-ga-sa'` 리터럴 grep 결과 **0건** ✅ (트리거 본문에서 리터럴 미사용).

**판정:** ✅ PASS (Hard Rule 17 정합 — 본 P0 정정 범위 한정).

---

### 검증 8 — `exam-adapter.ts` 의 `ExamId` brand type 적용 + runtime 의존성

**확인:**

- `packages/shared/src/exam-adapter.ts:28` — `export type ExamId = string & { readonly __brand: 'ExamId' };` brand type ✅
- `recover.ts:26` — `import type { ExamId } from '@thepick/shared';` — `import type` (type-only, runtime 의존 0) ✅
- `checkpoint.ts:32` — `import type { ExamId } from '@thepick/shared';` — `import type` ✅
- `recover.test.ts:16` — `import { EXAM_IDS } from '@thepick/shared';` — runtime import (값 사용 — 의도) — exam-ids.ts 의 brand cast `'son-hae-pyeong-ga-sa' as ExamId` 가 단일 선언처 ✅
- TypeScript 컴파일 시 `import type` 는 emit 결과 0 — `tsc --emitDeclarationOnly` 또는 `tsc` 출력에서 import 자체가 erase. ESM bundler 에서도 dead-code-elimination ✅.

**번들 크기 영향:**

- `recover.ts` / `checkpoint.ts` 의 production 번들에 `@thepick/shared/exam-adapter` 가 포함되지 않음 (type-only). 번들 최적화 의도 충족 ✅.
- 단 `recover.test.ts` 는 `EXAM_IDS` runtime import — 테스트 번들에만 포함, production 분리.

**판정:** ✅ PASS (brand type + type-only import 정합).

---

## 2. Devil's Advocate — Year 2 진입 시 깨질 수 있는 시나리오

### 시나리오 1 — Year 2 두 시험 동시 적재 시 checkpoint 파일명 충돌

**전제:**

- Year 2 Phase 4 진입 후 손해평가사 BATCH-1 적재 + 공인중개사 BATCH-1 적재 **동시 진행**.
- 두 BATCH 모두 UUID v4 로 `batch_run_id` 생성.
- `.checkpoint/{batch_run_id}.json` 디렉토리 구조 (`checkpoint.ts:441` `checkpointPath` 함수).

**문제:**

- UUID v4 collision 확률은 0이 아님 (1/2^122). 1년 수천 건 적재 누적 시 상수배수 증가.
- 더 현실적인 위협: 운영자가 두 시험에서 동일 식별자 (`'BATCH-1-test'` 등) 를 수동 부여 시 collision 100%.
- `checkpoint.ts:438-442` `checkpointPath` 가 sanitize 만 수행하고 collision 검출 없음.

**Year 2 진입 시 깨지는 흐름:**

1. 손해평가사 BATCH `.checkpoint/run-001.json` 작성.
2. 공인중개사 BATCH 가 동일 ID `run-001` 로 시작 → `.checkpoint/run-001.json` overwrite (writeCheckpoint 의 rename 이 origin 덮어쓰기).
3. 손해평가사 recover 시도 → 공인중개사 checkpoint 의 `engine_version` (동일 패키지) PASS, `state_hash` 도 PASS — **그러나 `pipeline_state_snapshot` 이 공인중개사 데이터** → recover 후 손해평가사 D1 에 공인중개사 노드 INSERT 시도.
4. `knowledge_nodes` 의 (Year 2) `exam_id` 컬럼 + ontology-registry 분리 검증이 catch — INSERT 단계에서 ABORT — **그러나 시간 손실 + 운영자 혼란**.

**완화 (즉시 적용 권고):**

- `BatchCheckpoint.exam_id` optional (현 정정) → Year 2 Phase 4 시점에 required 전환 + `checkpointPath(baseDir, examId, batchRunId)` 시그니처 변경 + 디렉토리 구조 `.checkpoint/{exam_id}/{batch_run_id}.json`.
- backend-architect midpoint review (`midpoint-20260428-backend.md` C-2 마지막 권고) 도 동일 권고 ("`.checkpoint/{exam_id}/{batch_run_id}.json` 디렉토리 구조 도입").
- 본 P0 정정에서는 미반영 — Year 1 한시 예외 범위에서 이연되었으나, **`readCheckpoint(batchRunId, baseDir, ...)` 시그니처에 `examId` 인자 추가가 미반영** (recover.ts:170 의 `readCheckpoint(opts.batchRunId, opts.baseDir, ...)` 호출).
- 즉 Year 2 진입 시 `readCheckpoint` 시그니처가 변경되며 caller 코드 수정 의무 발생 — **Hard Rule 16 의 zero-cost 전환 가치가 약화됨**.

**판정:** Year 2 진입 시 약화. 현 P0 정정 범위에서는 OK (recover.ts 의 BatchRunsDb 시그니처 충족), 하지만 `readCheckpoint` 도 동일 패턴 적용 권고.

---

### 시나리오 2 — `exam_id` optional 의 누락 검출 부재

**전제:**

- Step 11.6 §3.3 line 351 `examId: ctx.examId` 가 buildCheckpoint 에 항상 ctx.examId 를 주입 — **그러나 ctx.examId 자체가 optional 이면** (검증 2 권고 A 채택 시) undefined 전파.
- `checkpoint.ts:171` spread 가 undefined 시 키 자체 미생성 — `exam_id` 부재 checkpoint 생성.
- Year 2 Phase 4 시점에 `exam_id` 부재 checkpoint 가 발견되면 어떻게 처리?

**문제:**

- 현 P0 정정은 "Year 1 한시 예외" 명목으로 optional 도입. 그러나 Year 1 운영 중 모든 checkpoint 에 `examId` 가 주입되어야 Year 2 마이그레이션이 단순해짐.
- `buildCheckpoint` 가 examId 미주입을 silently allow — Year 1 운영 중 examId 누락 검출 메커니즘 부재.

**완화:**

- `buildCheckpoint` 에서 `input.examId === undefined` 시 `console.warn` (Year 1 한시 — Year 2 Phase 4 에서 throw) 또는 production 환경에서 throw.
- 현 정정은 spread skip 만 — silent omission. silent-failure-hunter 페르소나 책임 영역과 겹치므로 본 리뷰는 시스템 정합성 관점만 지적: **Year 2 zero-cost 전환을 위해 Year 1 운영 시점부터 examId 주입을 강제하는 메커니즘 필요**.

---

## 3. 최종 판정

### 발견 분류

| 분류        | 건수  | 항목                                                                                                                                                           |
| ----------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 CRITICAL | **1** | 검증 2 — Step 11.6 plan §10 "caller 0건" 사실과 불일치, 6 callsite 영향                                                                                        |
| 🟠 MAJOR    | **1** | 검증 3 — `BatchCheckpoint` schema migration 정책 미정의, Year 2 hash 변동 위험                                                                                 |
| 🟡 MINOR    | **2** | (a) 검증 1 — `BatchRunsDb.insertNewRun` 인터페이스 미추가 (Step 11.6 진입 의무) (b) Devil's 시나리오 1 — `readCheckpoint` 시그니처 examId 미포함 (Year 2 약화) |
| ✅ PASS     | **5** | 검증 1, 4, 5, 6, 7, 8                                                                                                                                          |

---

## 4. 판정

> **reject_and_revise.**

**수정 의무 (Step 11.6 코드 진입 전):**

1. **CRITICAL 정정 (검증 2):** Step 11.6 plan §10 line 1038 의 "현재 `runPipeline` 의 caller 는 없거나 테스트 fixture 만" 문구를 사실 기반으로 정정:
   - `apps/batch/bin/batch.ts:156-169` (production CLI) — `examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA` 추가 의무
   - `apps/batch/src/__tests__/pipeline.integration.test.ts` 5 callsite — `examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA` 추가 의무
   - 또는 plan §3.1 의 `examId` 를 optional + `runPipeline` 진입에서 `ctx.examId ?? DEFAULT_EXAM_ID` 폴백 (권고 A — 그러나 Hard Rule 16 약화).
   - **권고 (B):** Step 11.6 §10 호환 보장 절에 6 callsite 갱신 의무 명시 + 작업 추정에 0.05d 추가 + Step 11.6 코드 PR 에 `bin/batch.ts` 갱신 포함 의무.

2. **MAJOR 정정 (검증 3):** `CHECKPOINT_SCHEMA_VERSION` 진화 경로 ADR 작성 또는 `checkpoint.ts:36` 주석에 v1 → v2 마이그레이션 정책 명시. Year 2 진입 시 hash 변동 처리 의무 정의.

**MINOR 는 권고 (선택 적용):**

3. (검증 1) `recover.ts:70-84` 의 `BatchRunsDb` 인터페이스에 `insertNewRun(examId: ExamId, input: { batchRunId: string; fixturePath: string; engineVersion: string }): Promise<void>` 메서드 추가 — Step 11.6 진입 시 의무이므로 본 P0 단계에서 미리 추가 가능.

4. (Devil's 시나리오 1) `readCheckpoint(examId, batchRunId, baseDir, options)` 시그니처 변경 권고 — Year 2 진입 시 `.checkpoint/{exam_id}/{batch_run_id}.json` 구조 전환 대비.

---

## 5. 4-Pass 보고 형식

```
── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 (system-architect)
리뷰 범위: 코드 3파일 + 마이그레이션 1신규 + plan 3 갱신

System-Architect Pass: 🔴 1건 / 🟠 1건 / 🟡 2건 / ✅ 5건 PASS

확인 (PASS 5건):
  - apps/batch/src/recover.ts:70-84 — BatchRunsDb 시그니처 examId 첫 인자 ✅ (검증 1, 6)
  - migrations/0016_knowledge_nodes_batch_idempotency.sql:67-89 — 0014 화이트리스트 14개 컬럼 전수 보존 + IS NOT 패턴 truth table 정합 ✅ (검증 4)
  - migrations/0016 line 46-48 — partial UNIQUE INDEX SQLite/D1 production 호환 ✅ (검증 5)
  - apps/batch/__tests__/recover.test.ts:32 — TEST_EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA 픽스처, 직접 리터럴 0건 ✅ (검증 7)
  - apps/batch/src/recover.ts:26 + checkpoint.ts:32 — import type ExamId, runtime 의존성 0 ✅ (검증 8)

발견:
  🔴 CRITICAL — Step 11.6 plan §10 line 1038 사실 오류 (apps/batch/bin/batch.ts:156-169 + pipeline.integration.test.ts 5건 callsite)
  🟠 MAJOR — checkpoint.ts:36 CHECKPOINT_SCHEMA_VERSION 진화 경로 ADR 부재 (Year 2 hash 변동)
  🟡 MINOR — BatchRunsDb.insertNewRun 인터페이스 미추가 (Step 11.6 진입 시 의무)
  🟡 MINOR — readCheckpoint 시그니처 examId 미포함 (Year 2 진입 시 약화)

반론 (Devil's Advocate):
  Year 2 두 시험 동시 적재 시 .checkpoint/{batch_run_id}.json 충돌 가능 — exam_id 디렉토리 격리 미적용으로 zero-cost 전환 약화. backend-architect midpoint C-2 마지막 권고와 일치.

판정: reject_and_revise
────────────────────────────────────
```

---

## 6. 산출물 path

`.claude/reviews/review-20260428-200307-bc1bc2-step5-examid-system-architect.md`
