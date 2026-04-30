# Step 5 — BATCH Reproducibility + Idempotency Test

---

phase: 1
step: engine-hardening-step5
version: v1.3
approved_by: 진산 (2026-04-27 Engine Hardening Roadmap v1.1 일괄 승인)
v1_1_revision_by: 2026-04-28 (P0 후보 B 정정 흡수) — backend-architect C-1 결함 (knowledge_nodes 컬럼 부재) 정정 + source_id 정의 명확화
v1_2_revision_by: 2026-04-30 (Step 16a 진행 + 명시 이연 CRITICAL-Q4 흡수) — buildSourceId 헬퍼 + LoadDraftContext.batchRunId + draft-loader.ts INSERT 채움 + 16b/16c 분할
v1_3_revision_by: 2026-04-30 (Step 16b 진입 — 게이트 ⑧/⑨/⑩ 흡수) — LoadDraftContext.examId required + §non-goals (D1 batch atomicity 가정) + page_ref 형식 모델 명시 + e2e 시나리오 4건 + nanoid hint 에러 메시지
risk_level: L3
scope:

- apps/batch/**tests**/reproducibility.test.ts (신규)
- apps/batch/**tests**/idempotency.test.ts (신규)
- apps/batch/src/loader/draft-loader.ts (수정 — INSERT OR IGNORE + (batch_run_id, source_id) 유니크 제약 + source_id 결정성 키 생성)
- migrations/0015_batch_runs.sql (Step 11.5 산출물 — batch_runs 메타테이블)
- migrations/0016_knowledge_nodes_batch_idempotency.sql (v1.1 신설 — knowledge_nodes 컬럼 + 0014 화이트리스트 갱신)

---

## 목적

BATCH 파이프라인 전체의 **Reproducibility (재현성)** + **Idempotency (멱등성)** 검증. 동일 fixture + 동일 seed → 동일 D1 결과. 동시 실행 / 재실행 시 중복 INSERT 0건. **Review B-4 핵심 적용** — Step 11.5 recover()의 전제 조건.

## 근거

- v3.0 Vol XIV.4 `build_reproducibility` (Build SLO 의무)
- v3.0 Vol III.3 5대 함정 — Concurrent Trigger (v3.1 후보 함정)
- Engine Hardening Roadmap v1.1 §0.5 B-4 (Idempotency 4 시나리오)
- Review B-4 (Concurrent Trigger 시나리오)

---

## 대상 파일

### 신규

- `apps/batch/__tests__/reproducibility.test.ts` — 시나리오 A (재현성)
- `apps/batch/__tests__/idempotency.test.ts` — 시나리오 B/C/D/E (멱등성)

### 수정

- `apps/batch/src/loader/draft-loader.ts`:
  - 모든 INSERT 문에 `INSERT OR IGNORE` 또는 `ON CONFLICT (batch_run_id, source_id) DO NOTHING` 적용
  - `batch_run_id` / `source_id` 컬럼 INSERT (모든 노드/엣지에)
  - `source_id` 생성 로직 추가 — §"source_id 정의" 참조

### v1.1 정정 — `source_id` 정의 명확화 (backend-architect C-1)

> **v1.1 정정 (2026-04-28, P0 후보 B):** v1.0 plan 은 `(batch_run_id, source_id)` UNIQUE 만 명시하고 `source_id` 의 의미를 미정. backend-architect C-1 권고에 따라 다음으로 명확화.

`source_id` = **`{page_ref}#{node_id}`** (간단·결정성·디버깅 가독)

| 구성 요소  | 출처                                                                                                                                                                                                                                                                                                 | 결정성                    |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------ |
| `page_ref` | PDF 페이지 참조 — Step 16a 정상 caller 는 정수 문자열만 (예: `"403"`, `pageRefString(node.source_page)` via `preValidate ≥ 1`). 범위 / section 형식 (`"403-434"`, `"525:§4-2"`) 는 migration 0010 CHECK 제약 허용, **Step 16b/16c 진입 시점 caller 보강 의무 (헬퍼 자체는 임의 문자열 결정성 보장)** | PDF + 파서 결정성에 의존  |
| `#` 구분자 | 고정                                                                                                                                                                                                                                                                                                 | 결정성 보장               |
| `node_id`  | ontology-registry.json 패턴 (예: `CONCEPT-001`, `INS-01`, `F-01`, `CROP-001`)                                                                                                                                                                                                                        | ontology lock 기반 결정성 |

**결정성 보장 조건:**

- 동일 PDF + 동일 파서 버전 + 동일 ontology-registry → 동일 `source_id`
- 동일 BATCH 내 (동일 `batch_run_id`) `source_id` 충돌 시 동일 source 인 1개 노드 — INSERT OR IGNORE 가 idempotent
- 다른 BATCH 간 (다른 `batch_run_id`) 동일 `source_id` 가능 — UNIQUE 가 `(batch_run_id, source_id)` 복합 키이므로 비충돌

**대안 검토 + 거부:**

- (A) SHA-256(content) 해시 — 가장 안전. 그러나 디버깅 시 어떤 source 인지 식별 불가. 거부.
- (B) `{page_ref}::{section}::{type}::{name_normalized}` 4-key — 명시적이나 name 의 정규화 정책 추가 의무. 거부.
- (C) `{page_ref}#{node_id}` (채택) — 간단·결정성·디버깅 가독·기존 컬럼 재활용.

### v1.1 정정 — 0016 마이그레이션 의존성 (backend-architect C-1)

> **v1.1 정정 (2026-04-28, P0 후보 B):** `migrations/0001_initial_schema.sql:21` 의 `knowledge_nodes` 에는 `batch_id TEXT` 만 존재하며 `batch_run_id` / `source_id` 컬럼은 부재. v1.0 plan 의 UNIQUE INDEX SQL 은 컬럼이 없어 작동 불가. 본 plan 진입 전 0016 마이그레이션 의무.

`migrations/0016_knowledge_nodes_batch_idempotency.sql` 신규 (별도 파일):

```sql
ALTER TABLE knowledge_nodes ADD COLUMN batch_run_id TEXT;
ALTER TABLE knowledge_nodes ADD COLUMN source_id TEXT;

-- partial UNIQUE — Year 1 backfill 전 row (batch_run_id IS NULL) 는 제외
CREATE UNIQUE INDEX idx_knowledge_nodes_batch_source
  ON knowledge_nodes(batch_run_id, source_id)
  WHERE batch_run_id IS NOT NULL;

-- 0014 prevent_knowledge_nodes_update 트리거 화이트리스트 갱신:
-- batch_run_id, source_id 의 NULL → 값 1회 backfill UPDATE 만 허용.
-- 값 → 다른 값 / 값 → NULL 은 차단.
DROP TRIGGER IF EXISTS prevent_knowledge_nodes_update;
CREATE TRIGGER prevent_knowledge_nodes_update
BEFORE UPDATE ON knowledge_nodes
WHEN NEW.id IS NOT OLD.id
  OR NEW.type IS NOT OLD.type
  OR NEW.name IS NOT OLD.name
  OR NEW.description IS NOT OLD.description
  OR NEW.lv1_insurance IS NOT OLD.lv1_insurance
  OR NEW.lv2_crop IS NOT OLD.lv2_crop
  OR NEW.lv3_investigation IS NOT OLD.lv3_investigation
  OR NEW.page_ref IS NOT OLD.page_ref
  OR NEW.batch_id IS NOT OLD.batch_id
  OR NEW.version_year IS NOT OLD.version_year
  OR NEW.superseded_by IS NOT OLD.superseded_by
  OR NEW.truth_weight IS NOT OLD.truth_weight
  OR NEW.status IS NOT OLD.status
  OR NEW.exam_scope IS NOT OLD.exam_scope
  -- v1.1 backfill 예외:
  --   batch_run_id 가 OLD=NULL → NEW=값 만 허용 (값 → 다른 값 / 값 → NULL 차단)
  OR (OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id)
  OR (OLD.source_id    IS NOT NULL AND NEW.source_id    IS NOT OLD.source_id)
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on knowledge_nodes body columns is forbidden (Hard Rule 1, Temporal Graph). Only batch_run_id/source_id NULL→value backfill (1회) and is_current_active flip allowed.');
END;
```

**`source_id` NOT NULL 미강제 이유:** Year 1 적재 전 기존 row 0건 가정이지만, 향후 데이터 import / fixture seed / migration replay 시 NULL 상태 row 가 잠시 존재 가능. partial UNIQUE 가 NULL 행 제외로 안전. 적재 완료 후 `source_id IS NULL` 행 0건 검증을 Step 5 AC 에 명시.

### v1.1 명시 이연 (P0 4-Pass quality CRITICAL-Q4 — Silent Pivot 차단)

> **2026-04-28 명시 이연 (`review-20260428-200211-bc1bc2-step5-examid-quality.md` CRITICAL-Q4):** 본 plan v1.1 의 `source_id = {page_ref}#{node_id}` 정의가 현재 `apps/batch/src/loader/draft-loader.ts:247` 에 미반영 (현재 코드는 NULL 만 INSERT). 정의가 코드와 미연결 = Silent Pivot (CRITICAL RULE #1 위반 잠재). Step 5 코드 구현 시 **첫 commit 의무**:

1. `draft-loader.ts` 의 모든 `INSERT INTO knowledge_nodes` 에 `batch_run_id` / `source_id` 값 채움
2. `source_id` 생성 헬퍼 함수 추가 — `function buildSourceId(pageRef: string, nodeId: string): string` 결정성 + 단위 테스트 7 케이스
3. `source_id` 컬럼이 `edges.source_id` 와 이름 충돌 없는지 검증 — `knowledge_edges` 와 무관 (knowledge_nodes 컬럼만)
4. NULL `page_ref` 노드 처리 정책: `page_ref` 가 null/empty 시 `source_id` 도 NULL → partial UNIQUE 제외 → idempotency key 부재. 정책 결정:
   - (A) `page_ref` 강제 — 모든 노드에 page_ref 의무 (검증 추가)
   - (B) `source_id` fallback — `<no_page>#{node_id}` 패턴 (digest 안전)
   - **권고 (B)** — 결정성 보장 + idempotency 키 활성

본 명시 이연을 Step 5 plan v1.2 (Step 5 코드 commit 시점) 시점에 흡수.

> **v1.2 흡수 (2026-04-30 Step 16a — 본 명시 이연 CRITICAL-Q4 1~4 모두 흡수):**
>
> 1. ✅ `apps/batch/src/loader/draft-loader.ts:251` `INSERT INTO knowledge_nodes` SQL 에 `batch_run_id` + `source_id` 컬럼 추가. `bind` 13개 (기존 11 + 신규 2).
> 2. ✅ `apps/batch/src/loader/build-source-id.ts` 신규 — `buildSourceId(pageRef, nodeId)` 결정성 헬퍼 + 단위 테스트 8 케이스 (정상 / null / undefined / empty / 결정성 100회 / 빈 nodeId throw / 충돌 차단 / exports 일치).
> 3. ✅ `source_id` 컬럼명은 `knowledge_nodes` 전용. `knowledge_edges` 의 `source_id`(엣지 소스 노드 ID) 와 이름 동일하나 테이블 분리로 충돌 0건 — 0001/0016 마이그레이션 검증.
> 4. ✅ NULL page_ref 정책 (B) 채택 — `PAGE_REF_FALLBACK = '<no_page>'`. 단 draft-loader.ts:152 `preValidate` 가 `source_page ≥ 1` 강제 (정책 A 동시 적용) — fallback 은 fixture seed / migration replay 등 정상 흐름 외 안전망.
> 5. ✅ `LoadDraftContext` 시그니처에 `batchRunId: string` 필수 필드 추가. preValidate 빈 문자열 차단. `pipeline.ts:915` loadCtx 에 `ctx.batchRunId` 전달.
> 6. ✅ `loader.test.ts` BASE_CTX `batchRunId: 'batch-run-test-0001'` 추가 + 정상 INSERT 테스트에 `batch_run_id` / `source_id` 검증 보강 + 신규 2 테스트 (batchRunId 누락 차단 / source_id 결정성 모든 노드 채움). 12 tests PASS.
>
> **Step 16a 미흡수 (Step 16b/16c 차세션 이연):**
>
> - 시나리오 A reproducibility (e2e BATCH 1회 × 2) — AC-RP-1
> - 시나리오 B/C/E idempotency (concurrent / recover / rerun) — AC-RP-2/3/4
> - AC-RP-6 0016 마이그레이션 + 0014 트리거 e2e 검증

### Step 16b 진입 게이트 (Engine Hardening 차세션 의무)

다음 항목 모두 충족 후 16b 진입:

1. ✅ Step 16a `buildSourceId` 헬퍼 + LoadDraftContext.batchRunId + INSERT 채움 commit
2. ✅ apps/batch in-memory D1 + better-sqlite3 환경에서 `runPipeline` 풀 실행 가능 (Step 11.6 e2e 패턴) — `pipeline.integration.test.ts` 12 tests 검증
3. ✅ AC-RP-1 시나리오 A: 동일 fixture + 동일 seed → invariant_fields 100% 동일 (knowledge_nodes 정렬 + JSON canonical) — Step 16b `reproducibility-idempotency.test.ts` 신규
4. ✅ AC-RP-2 시나리오 B: `Promise.all` 동시 인스턴스 2개 → 1개만 'completed', INSERT 중복 0건
5. ✅ AC-RP-3 시나리오 C: 50% kill → recover → 최종 결과 정상 동일 + 중복 0건
6. ✅ AC-RP-4 시나리오 E: 동일 batch_run_id 완료 후 재실행 → skip + 결과 보존
7. ✅ AC-RP-7 source_id 결정성 e2e — 본 plan AC 충족, 단위 테스트는 16a 에서 커버
8. ✅ **`LoadDraftContext.examId: ExamId` 필수 필드 추가 (Hard Rule 16 Year 2 zero-cost 전환 의무)** — 16a Pass 2/4 MAJOR-PA4-1 흡수. Year 2 마이그레이션 0017 (`knowledge_nodes.exam_id` 컬럼 도입) 시점에 `loadDraft` 시그니처 / preValidate / pipeline.ts:917 loadCtx / loader.test.ts BASE_CTX 일괄 갱신 비용 < 5분. **2026-04-30 v1.3 Step 16b 진입 시점에 본 게이트 흡수** — `draft-loader.ts:39` `examId: ExamId` required + preValidate 빈 문자열 차단 + pipeline.ts:916 `examId: ctx.examId` + loader.test.ts BASE_CTX `examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA` + 신규 테스트 1 (examId 누락 차단).
9. ✅ **D1 batch() partial-commit 회복 e2e (Pass 2 M-2 흡수)** — §non-goals "D1 batch atomicity Cloudflare 보증 가정" 명시 (본 plan §"Non-goals (Step 16b 시점)" 추가). Workers 50ms CPU 한도 + 노드 다수 INSERT 시 batch atomicity 는 Cloudflare D1 의 SQLite 트랜잭션 모델로 보증. e2e 검증은 Cloudflare Preview Database 진입 시점 (Phase 2 Step) 에 별도 plan 작성.
10. ✅ **page_ref 형식 모델 확정 (Pass 3 C-1 흡수)** — 본 plan §"page_ref 형식 모델 (v1.3 신규)" 추가. **Step 16b 시점 fixture 정수 문자열만 사용** — `pageRefString(node.source_page)` 가 `String(positive_int)` 결과만 반환. 범위 / section 형식은 migration 0010 CHECK 제약 허용 범위이나 적재 caller 진입 차단 (preValidate `Number.isInteger(n.source_page) && n.source_page > 0`). Year 2 다른 시험 / 법령 import path 진입 시 별도 plan.

### Step 16c 진입 게이트 (16b 완료 후 또는 별도)

1. ⏳ AC-RP-6 e2e — `wrangler d1 execute --local` 또는 better-sqlite3 환경
2. ⏳ 0016 적용 후 컬럼/인덱스/트리거 존재 검증
3. ⏳ partial UNIQUE 동작 검증 (`batch_run_id IS NULL` 제외)
4. ⏳ 0014 트리거 갱신 본문 검증 — backfill 1회 / 다른 값 ABORT / 본문 컬럼 ABORT (회귀 0건)
5. ⏳ **fixture seed / migration replay 시 `<no_page>` fallback silent 진입 시나리오 검증 (Pass 3 반론 2 흡수)** — 정상 BATCH 흐름은 preValidate 차단으로 fallback 미진입이나, Year 2 import path 에서 `node.source_page = null` 진입 시 fallback `<no_page>#{nodeId}` 가 partial UNIQUE 충돌 가능성 검증.

---

## Test Strategy

### 시나리오 A — Reproducibility (단일 실행 재현성)

```typescript
test('Reproducibility — same fixture + same seed → same D1 result', async () => {
  const seed = 42;
  const fixturePath = '__fixtures__/batch1/jejae_section_5pg.pdf';

  // 첫 실행
  const db1 = await createInMemoryD1();
  const batchRunId1 = generateBatchRunId(seed);
  await runBatch(fixturePath, db1, { batchRunId: batchRunId1, seed });
  const snapshot1 = await db1.dumpAllTables();

  // 재실행 (db 초기화 후)
  const db2 = await createInMemoryD1();
  const batchRunId2 = generateBatchRunId(seed); // 동일 seed → 동일 ID
  await runBatch(fixturePath, db2, { batchRunId: batchRunId2, seed });
  const snapshot2 = await db2.dumpAllTables();

  // invariant_fields 100% 동일
  expect(extractInvariant(snapshot1)).toEqual(extractInvariant(snapshot2));
});
```

### 시나리오 B — 동시 트리거 (2개 인스턴스 동시 실행)

```typescript
test('Idempotency — concurrent trigger → no duplicate INSERT', async () => {
  const fixturePath = '...';
  const db = await createInMemoryD1();
  const batchRunId = 'batch-concurrent-test-001';

  // 2개 인스턴스 동시 시작
  const [r1, r2] = await Promise.all([
    runBatch(fixturePath, db, { batchRunId }),
    runBatch(fixturePath, db, { batchRunId }),
  ]);

  // 1개만 성공, 1개는 'BATCH already in progress' 거부
  const successCount = [r1, r2].filter((r) => r.status === 'completed').length;
  expect(successCount).toBe(1);

  // 노드 INSERT 중복 0건
  const nodeCount = await db.query(
    'SELECT COUNT(*) FROM knowledge_nodes WHERE batch_run_id = ?',
    batchRunId,
  );
  expect(nodeCount).toBe(expectedNodeCount); // duplicate 없음
});
```

### 시나리오 C — Recover 후 잔존 인스턴스 (Step 11.5 연동)

```typescript
test('Idempotency — recover after partial completion, no duplicate', async () => {
  const fixturePath = '...';
  const db = await createInMemoryD1();
  const batchRunId = 'batch-recover-test-001';

  // 첫 실행 50% 진행 후 강제 종료
  const result1 = await runBatchWithKill(fixturePath, db, { batchRunId, killAtStage: 5 });
  expect(result1.status).toBe('killed');

  // recover() 호출
  const result2 = await recoverBatch(batchRunId, db);
  expect(result2.status).toBe('fully_recovered');

  // 최종 노드 수가 정상 실행과 동일
  const nodeCount = await db.query('...');
  expect(nodeCount).toBe(expectedNodeCount);

  // 중복 INSERT 0건 확인
  const duplicates = await db.query(
    'SELECT source_id, COUNT(*) FROM knowledge_nodes GROUP BY source_id HAVING COUNT(*) > 1',
  );
  expect(duplicates.length).toBe(0);
});
```

### 시나리오 D — Cron + 수동 트리거 동시 발생 (Phase 2 시점)

본 plan 시점에는 Cron 미사용 (BATCH = 진산님 트리거 키워드만). Phase 2 진입 시 Cron 도입되면 본 시나리오 활성화.

→ 시나리오 D는 본 plan에서 **skip** + Phase 2 진입 시 별도 plan 작성 의무 명시.

### 시나리오 E — 동일 batch_run_id 재실행 (완료 후)

```typescript
test('Idempotency — re-run with same batch_run_id after completion → skip', async () => {
  const fixturePath = '...';
  const db = await createInMemoryD1();
  const batchRunId = 'batch-rerun-test-001';

  // 첫 실행 정상 완료
  const r1 = await runBatch(fixturePath, db, { batchRunId });
  expect(r1.status).toBe('completed');

  // 동일 batch_run_id로 재실행
  const r2 = await runBatch(fixturePath, db, { batchRunId });
  expect(r2.status).toBe('skipped');
  expect(r2.message).toContain('already completed');

  // 노드 수 변화 없음
  const nodeCount = await db.query('...');
  expect(nodeCount).toBe(expectedNodeCount); // r1 결과 그대로
});
```

---

## 위험 분석

| 위험                                                                    | 완화                                                                                  |
| :---------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| In-memory D1 ≠ Cloudflare D1 SQL 방언 차이                              | ADR-018 (D1 Preview Database) — 본 plan 코드는 in-memory + 별도 D1 Preview에서도 검증 |
| `Promise.all` 동시 실행이 진짜 race condition 재현 못함                 | Worker thread 또는 별도 process로 강화 검토 (Phase 2)                                 |
| `(batch_run_id, source_id)` 유니크 제약 추가가 기존 fixture 호환 깨뜨림 | 마이그레이션 사전 검증 + 기존 fixture 재실행 회귀 테스트                              |
| recover 후 중복 검증 로직 결함                                          | Step 11.5 plan과 통합 — `INSERT OR IGNORE` 우선, 검증 후 fail fast                    |
| Seed 고정으로 인한 모든 BATCH 결정성 (의도하지 않은 동결)               | seed는 BATCH-1 fixture에만 적용 — 실제 BATCH 적재는 동적 batch_run_id                 |

---

## 검증 계획 (Acceptance Criteria)

### AC-RP-1: Reproducibility 시나리오 A

- 동일 fixture + 동일 seed → invariant_fields 100% 동일

### AC-RP-2: Idempotency 시나리오 B (concurrent)

- 2개 인스턴스 동시 실행 → 1개만 성공, 중복 INSERT 0건

### AC-RP-3: Idempotency 시나리오 C (recover)

- 50% 진행 후 kill → recover → 최종 결과 정상 실행과 동일, 중복 0건

### AC-RP-4: Idempotency 시나리오 E (rerun)

- 완료 후 동일 batch_run_id 재실행 → skip + 결과 보존

### AC-RP-5: 시나리오 D (Cron) 명시적 SKIP

- 본 plan에서 미구현. Phase 2 진입 시 별도 plan 작성 의무

### AC-RP-6 (v1.1 신규): 0016 마이그레이션 + 0014 화이트리스트 갱신 e2e

- `wrangler d1 execute --local` 또는 better-sqlite3 환경에서:
  - 0016 적용 후 `knowledge_nodes.batch_run_id` / `source_id` 컬럼 존재
  - `idx_knowledge_nodes_batch_source` 인덱스 존재 + `batch_run_id IS NULL` 제외 partial 동작
  - 0014 트리거 갱신 본문 검증:
    - `batch_run_id` NULL → 값 backfill UPDATE — ALLOW (1회)
    - `batch_run_id` 값 → 다른 값 UPDATE — ABORT
    - `batch_run_id` 값 → NULL UPDATE — ABORT
    - `source_id` 동일 시나리오 검증
    - 기존 본문 컬럼 (name/description/page_ref 등) UPDATE — 여전히 ABORT (회귀 검증)

### AC-RP-7 (v1.1 신규): source_id 결정성

- 동일 PDF + 동일 파서 버전 + 동일 ontology → 동일 `{page_ref}#{node_id}` 형식 source_id 생성
- 100회 반복 실행 시 동일 batch_run_id 내 source_id 집합이 100% 일치
- 적재 완료 후 `SELECT COUNT(*) FROM knowledge_nodes WHERE source_id IS NULL AND batch_run_id IS NOT NULL` 결과 = 0

---

## 롤백 전략

- 새 test 파일 삭제
- `draft-loader.ts`의 `INSERT OR IGNORE` revert (단, 이는 안전성 향상이라 보존 권고)
- 마이그레이션 ROLLBACK SQL 작성 (유니크 인덱스 DROP)

---

## 승인 기록

- 의존성: Step 11.5 (recover/snapshot) 완료 후 시나리오 C 활성
- 진산님 승인: 2026-04-27 Engine Hardening Roadmap v1.1

---

## 의존성

- **Blocked by:** Step 11.5 (recover/snapshot — 시나리오 C 의존)
- **Blocks:** Step 18 (자동 검증)
- **참조:** Review B-4, ADR-018 (D1 Preview)

---

## 작업 추정

- 낙관: 1d
- 현실: 1.5d (×1.5 — concurrent test 디버깅 + 마이그레이션 검증)
- 비관: 2d

---

## Non-goals (v1.3 신규 — Step 16b 게이트 ⑨ 흡수)

다음 항목은 본 plan 범위 외 — 명시적 SKIP. 검증 진입 시점이 별도 plan 으로 정의되어 있다.

### NG-1 — D1 batch() partial-commit 회복 e2e (Cloudflare Preview Database)

**Skip 사유:**

- Cloudflare D1 의 `db.batch([stmt1, stmt2, ...])` 는 SQLite 의 BEGIN..COMMIT 트랜잭션 모델로
  atomic 보증 — 한 stmt 실패 시 전체 rollback (Cloudflare 문서, [D1 Workers Binding API](https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/)).
- in-memory better-sqlite3 환경 (현재 e2e 테스트) 도 동일 모델 사용 → batch atomicity 검증
  가능하나, Workers 50ms CPU 한도 + Cloudflare 분산 환경에서의 partial-commit (네트워크 단절,
  쿼터 초과) 시나리오는 in-memory 재현 불가.
- e2e 검증 시점: Cloudflare Preview Database (`wrangler d1 execute --preview`) 진입 시 (Phase 2
  진입 시점, ADR-018 D1 Preview).
- 본 plan v1.3 시점 가정: D1 batch atomicity 는 Cloudflare 보증으로 신뢰. Layer 1 cost-meter
  (Step 12) 가 token spend 차단 + Layer 2 (Anthropic console cap) 가 in-flight 차단.

### NG-2 — 시나리오 D (Cron + 수동 트리거 동시 발생)

**Skip 사유:** 본 plan 시점 Cron 미사용 — Phase 2 진입 시 별도 plan. 본 plan §"시나리오 D" 명시.

### NG-3 — 다른 시험 / 법령 import path 의 page_ref 범위 / section 형식

**Skip 사유:** Year 1 손해평가사 단일 시험 — fixture page_ref 는 정수 문자열만. 다른 시험 / 법령
도입 시 별도 plan (Year 2 Phase 4, 메모리 `project_v3_final_multi_exam_deferred` 정합).

### NG-4 — Worker thread / 별도 process 동시성 시나리오

**Skip 사유:** 현재 e2e `Promise.all` 단일 프로세스 내 race condition 재현 — 진짜 OS-level
race condition (두 Claude Code 세션 동시 실행) 은 Worker thread / 별도 process 로 강화 가능하나
본 plan 범위 외. 시나리오 B 는 application-level (BatchRunsDb in-memory mutex) 검증으로 수렴.

### NG-5 — 시나리오 C 실제 kill (SIGKILL / SIGINT) 재현 e2e

**Skip 사유:** 본 plan v1.3 시나리오 C e2e 는 `(sharedDb as any).rows.set('killed')` 직접
mutation 시뮬레이션으로 simplification 됨. production 0015 트리거는 `completed → killed`
ABORT 강제 (downgrade 차단) 이므로, 본 simplification 은 **테스트 픽스처 전용** 이다.

**진짜 kill 시나리오 (SIGINT/SIGTERM/SIGKILL/노트북 슬립/시스템 재부팅):**

- `apps/batch/__tests__/signal-handlers.test.ts` 가 SIGINT/SIGTERM lastSnapshot flush 검증
- `apps/batch/__tests__/cost-meter-pipeline-kill.test.ts` 가 CostMeter kill switch checkpoint flush 검증
- `apps/batch/src/__tests__/pipeline.integration.test.ts` AC-1 e2e 가 정상 흐름 영구화 검증

본 plan 시나리오 C e2e 는 위 3 테스트의 **결합 결과 (kill 후 재실행 분기)** 만 검증 — 즉
"checkpoint 잔존 + state='killed'" 상태에서 두 번째 호출의 recoverBatch 분기가 정상.

**Step 16c 또는 별도 plan 진입 시 보강:**

- `runBatchWithKill(fixturePath, db, {batchRunId, killAtStage: 5})` 헬퍼 신설 — 실제 stage
  loop 중간에 `process.kill(process.pid, 'SIGTERM')` 시뮬레이션
- Worker thread 또는 별도 process 분리 (NG-4 정합)
- `wrangler d1 execute --local` 환경에서 0015 트리거 ABORT 검증 (NG-1 정합)

근거: 4-Pass 자동 리뷰 (Pass 1+2) PA1-M1 흡수 (2026-04-30) — `(sharedDb as any).rows`
직접 mutate 가 production 트리거 우회 simulation 임을 plan 본문에 명시 의무 (handoff-024
차세션 트래킹 의무 동시 활성).

---

## page_ref 형식 모델 (v1.3 신규 — Step 16b 게이트 ⑩ 흡수)

### 형식 매트릭스

| 형식                   | 예시          | migration 0010 CHECK | preValidate (Step 16b) | source_id 결정성 |
| :--------------------- | :------------ | :------------------- | :--------------------- | :--------------- |
| **정수 문자열** (채택) | `"403"`       | ✅ 허용              | ✅ 진입                | ✅ 보장          |
| 범위                   | `"403-434"`   | ✅ 허용              | ❌ 차단                | (미진입)         |
| Section                | `"525:§4-2"`  | ✅ 허용              | ❌ 차단                | (미진입)         |
| `p.NNN`                | `"p.403"`     | ✅ 허용              | ❌ 차단                | (미진입)         |
| NULL / empty           | `null` / `""` | (CHECK 외)           | ❌ 차단                | fallback         |

### 적용 정책 (Step 16b)

- **caller 진입 차단:** `preValidate` 가 `Number.isInteger(node.source_page) && node.source_page > 0`
  강제 (`draft-loader.ts:184-188`). 정수 외 입력은 `DraftLoadError('invalid source_page')` 즉시 throw.
- **헬퍼 결정성:** `pageRefString(node.source_page: number) → String(page)` (line 421-423).
  정수 → 정수 문자열 1:1 변환.
- **source_id 결정성:** `buildSourceId(pageRef, nodeId)` 가 `<no_page>` fallback 보유하나
  Step 16b 정상 흐름은 진입 차단으로 fallback 미진입 — Year 2 import path 안전망.

### Year 2 확장 정책 (별도 plan)

- 다른 시험 / 법령 / 행정해석 도입 시 page_ref 형식 변경 가능 (`예: "법령:보험업법§5-2"`).
- 본 시점 결정: **Step 16b 시점에 형식 모델을 정수 문자열로 고정** + Year 2 별도 plan 으로 위임.
- 변경 시 영향 범위:
  - `preValidate` 검증 로직 (현재: `Number.isInteger`)
  - `pageRefString` 변환 함수 (현재: `String(page)`)
  - `buildSourceId` 입력 형식 (현재: 임의 문자열 결정성 보장 — 변경 불필요)
  - migration 0010 CHECK 제약 (현재: 정규식 허용 범위 — 변경 불필요)

### 검증 (Step 16b 흡수)

- ✅ loader.test.ts: `source_page = 0` (line 152), `source_page = undefined` (line 158),
  `source_page = -1` (line 167) 모두 차단 — 정수 양수만 허용 검증.
- ✅ buildSourceId: 정상 (`"403"` + `"CONCEPT-001"`) + fallback (`null`) + throw (`""` nodeId)
  단위 테스트 8건 (build-source-id.test.ts).
