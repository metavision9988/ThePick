# Engine Hardening 중간 점검 — Backend Architect 관점

**관점:** "2년차에 뭐가 아플까?" — 데이터·API 부채 / 멀티시험 격리 / Temporal Graph 호환 / 트리거 동시성 / batch_runs ↔ knowledge_nodes FK / 데이터 lifecycle
**리뷰어 (독립):** backend-architect (5-페르소나 중 1)
**리뷰 시점:** Step 11.6 plan APPROVED 직후, 코드 진입 전
**리뷰 산출물:** 본 파일

---

## 1. 한 줄 평가

> **partial proceed.** 0015 마이그레이션의 트리거 설계와 recover 결정 트리는 견고하나, **Step 5의 `(batch_run_id, source_id)` UNIQUE 제약 전제 컬럼 2개(`batch_run_id`, `source_id`)가 `knowledge_nodes`에 존재하지 않는다.** Step 11.6 코드를 그대로 진입하면 이연 0016 마이그레이션이 도착할 때 본문 컬럼 변경 = 0014 `prevent_knowledge_nodes_update` 트리거가 ABORT — Year 2 적재 중 schema 패치 자체가 차단된다. **0016 마이그레이션 우선 (Decision B → 코드 A) 강력 권고.**

---

## 2. CRITICAL — Year 2 마이그레이션 비용 폭발급 (3건)

### C-1. Step 5 의 `(batch_run_id, source_id)` UNIQUE 인덱스의 전제 컬럼이 **물리적으로 부재** — 본 plan 진입 시 Step 5 작성 시점에 ALTER TABLE이 0014 트리거에 의해 차단

**증거:**

- `migrations/0001_initial_schema.sql:21` — `knowledge_nodes` 에 `batch_id TEXT` 만 존재 (`batch_run_id` 부재)
- `knowledge_nodes` 어디에도 `source_id` 컬럼이 없음 (전수 grep 결과 `loader/draft-loader.ts:221` 의 변수명일 뿐 — `knowledge_edges.from_node` 와 매핑되는 _그래프 엣지 source_, FK 가 아님)
- `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md:46-48` — `CREATE UNIQUE INDEX idx_knowledge_nodes_batch_source ON knowledge_nodes(batch_run_id, source_id)` 명시
- `migrations/0014_phase05_critical_hardening.sql:35-53` — `prevent_knowledge_nodes_update` 가 `batch_id` 컬럼 변경을 본문 변경으로 분류하여 ABORT

**왜 critical 인가:**

1. 0016 마이그레이션이 `ALTER TABLE knowledge_nodes ADD COLUMN batch_run_id TEXT` 를 실행할 때, SQLite 는 ALTER ADD COLUMN 자체는 트리거 우회. **그러나 Step 5 시나리오 C (recover 후 INSERT) 에서 기존 row 의 `batch_run_id` backfill UPDATE가 필요**한데, 0014 트리거가 이를 ABORT.
2. `knowledge_nodes.source_id` 는 **개념적으로 무엇인지조차 정의되지 않음** — Step 5 plan은 `(batch_run_id, source_id)` UNIQUE 라고만 적었고, `source_id` 가 (a) 노드 ID 자체인지 (b) 페이지 참조인지 (c) PDF 원본 좌표인지 미결정. Idempotency 의 **유일성 단위**가 모호.
3. Step 11.6 의 `D1BatchRunsDb.updateState` 는 `batch_runs.last_node_id` 만 추적. recover 후 동일 stage 재실행 시 어떤 `(node, source)` 조합이 이미 INSERT 되었는지 식별 불가능. 결과: **AC-R1 e2e가 mock 환경에서는 PASS 하지만 production D1 에서는 중복 INSERT 누수.**

**Year 2 비용:**

- exam_id 컬럼 추가 0005 마이그레이션 시점에 `(exam_id, batch_run_id, source_id)` 3중 UNIQUE 로 진화 필요 — 그런데 Year 1에 `batch_run_id` / `source_id` 가 부재하면 backfill SQL 이 **9개 테이블 × N년 데이터** 에 대해 작성되어야 함. ETA: 단순 `ALTER ADD COLUMN` 의 100배 (대략 0.5d → 5d).

**완화:**

- **Step 11.6 진입 전** Step 5 plan 갱신 + **0016 마이그레이션 작성 의무화**:
  - `ALTER TABLE knowledge_nodes ADD COLUMN batch_run_id TEXT`
  - `ALTER TABLE knowledge_nodes ADD COLUMN source_id TEXT` (정의 명확화 — 페이지+섹션+노드타입 결정성 키 권고)
  - `CREATE UNIQUE INDEX idx_knowledge_nodes_batch_source ON knowledge_nodes(batch_run_id, source_id) WHERE batch_run_id IS NOT NULL`
  - 0014 `prevent_knowledge_nodes_update` 화이트리스트에 `batch_run_id`, `source_id` 추가 (NULL → 값 변환만 1회 허용)

### C-2. `BatchRunsDb` API 시그니처가 Hard Rule 16 위반 — 첫 인자 `examId` 부재

**증거:**

- `apps/batch/src/recover.ts:57-70` — `BatchRunsDb.selectByRunId(batchRunId)` / `updateState(batchRunId, ...)` 모두 첫 인자가 `batchRunId`
- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:541-621` — `D1BatchRunsDb.insertNewRun({batchRunId, fixturePath, engineVersion})` — `examId` 미포함
- `.claude/rules/production-quality.md` Hard Rule 16 — "모든 데이터 조회 래퍼 함수는 **첫 번째 인자로 `examId: ExamId`** 를 받는다"
- `packages/shared/src/exam-adapter.ts:50` — `ExamScopedVectorFilter.exam_id` 명시. 데이터 경계 인식 존재.

**왜 critical 인가:**

- Year 2 Phase 4 시점에 `batch_runs` 가 시험별로 격리되어야 함. 본 인터페이스는 그때 zero-cost 전환 불가능 — 모든 callsite (현재 `pipeline.ts` + 향후 admin-web / batch CLI / on-call 복구 스크립트) 의 시그니처가 변경되어야 함.
- Hard Rule 16 본문 — "Year 1 시그니처가 examId 포함이면 Year 2 zero-cost 전환". 본 시그니처는 정확히 이 zero-cost 가 깨지는 위반 패턴.
- **반론 (하기 §5 참조):** 사용자가 Year 1 한시 예외 (production-quality.md "Year 1 (exam_id 컬럼 부재 상태, ADR-007 이월)") 를 들 수 있음. 그러나 Year 1 한시 예외는 **함수 시그니처에 examId 를 포함하되 내부 구현은 WHERE 없이 동작** 패턴이지 시그니처 자체 생략이 아님. 본 인터페이스는 시그니처 자체를 생략하므로 한시 예외에 해당하지 않음.

**완화:**

- `BatchRunsDb` 인터페이스 메서드 3개 모두 첫 인자 `examId: ExamId` 추가
- 본 plan 의 D1 어댑터 구현은 Year 1 동안 `examId` 인자를 받되 SQL 의 WHERE 절 미주입 (단일 시험 가정). Year 2 Phase 4 마이그레이션 0005 도입 후 `WHERE exam_id = ?` 추가.
- `BatchCheckpoint.batch_run_id` 도 향후 `(exam_id, batch_run_id)` 복합 키 전환 대비 — 현재 파일명 `.checkpoint/{batch_run_id}.json` 이 collision 안전한가? Year 2 두 시험 동시 적재 시 별 시험에서 동일 UUID 가능성은 낮지만 0이 아님 (UUID v4 조차 0). **권고:** `.checkpoint/{exam_id}/{batch_run_id}.json` 디렉토리 구조 도입 (파일 시스템 격리).

### C-3. `batch_runs.batch_run_id PK` + Trigger 3종이 ACID 모델을 가정하나, **D1 SQLite WAL 모드에서 BEFORE UPDATE 트리거의 deadlock semantics 미검증**

**증거:**

- `migrations/0015_batch_runs.sql:40-68` — 3개 트리거 (`trg_batch_runs_no_duplicate_completed` / `trg_batch_runs_no_state_downgrade` / `trg_batch_runs_recover_only_from_terminal`)
- 모두 `BEFORE INSERT/UPDATE OF state` + `WHEN ... BEGIN SELECT RAISE(ABORT, ...)` 패턴
- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:323-326` — `runPipeline` 진입 시 `state='in_progress' → 'recovered'` UPDATE 시도. 이 전이는 `trg_batch_runs_recover_only_from_terminal` 의 WHEN 조건 (`OLD.state NOT IN ('killed', 'failed')`) 을 트리거 — 정상 recover 경로에서 ABORT
- D1 SQLite 는 WAL 모드 + serializable transaction. 그러나 트리거 RAISE(ABORT) 는 트랜잭션 전체 ROLLBACK — **부분 commit 불가능**

**왜 critical 인가:**

1. **정상 recover 경로 차단:** `recoverBatch` 가 `concurrent_run_detected` 분기에서 24h stale lock 통과 후 정상 recover 진행하려 하면, `state='in_progress'` 행에 `state='recovered'` UPDATE 시도. **트리거 WHEN 조건 위반 → ABORT.** 즉 stale 'in_progress' lock 의 정상 recover 경로가 트리거에 의해 막힘.
2. **3개 트리거 + 외부 트랜잭션 결합 isolation:** `pipeline.ts` 가 stage 종료 시 `batch_runs.UPDATE` + `knowledge_nodes.INSERT OR IGNORE` 를 동일 D1 transaction 으로 묶을 경우 (Step 11.6 §3.3 finally 블록), `batch_runs` 트리거 ABORT 시 `knowledge_nodes` INSERT 도 함께 ROLLBACK. 그러나 **batch_runs.last_node_id 가 갱신 안 된 채 knowledge_nodes 만 commit 되는 split 가능성** — `D1BatchRunsDb.updateState` 가 별도 prepared statement 로 호출되면 default isolation 에서 race.
3. **D1 의 `RAISE(ABORT)` 동작 미검증:** `wrangler d1 execute --local` 의 better-sqlite3 와 production D1 의 분산 SQLite 가 RAISE(ABORT) 표면화 방식이 다를 수 있음. Drizzle ORM 사용 시 어떤 에러 클래스로 throw 되는지 plan §6.3 명시되어 있지만 실증 없음.

**완화:**

- `trg_batch_runs_recover_only_from_terminal` WHEN 조건 보정:
  ```sql
  WHEN NEW.state = 'recovered' AND OLD.state NOT IN ('killed', 'failed', 'in_progress')
  ```
  (24h stale lock 의 'in_progress' → 'recovered' 정상 경로 허용)
- **OR** application 레벨에서 stale lock 감지 시 `state='in_progress' → 'killed'` (기록 의도) → `'killed' → 'recovered'` 2단계 전이로 recover 재진입. plan §3.3 의 분기 명시 필요.
- 0015 트리거의 D1 Preview 통합 검증 (Step 11.6 §6, 옵션 A) 에 본 시나리오 추가:
  - T5 (신규): `state='in_progress'` (stale lock) → `state='recovered'` UPDATE — 결과 expected: 본 정정 적용 시 PASS, 미적용 시 ABORT.

---

## 3. MAJOR — 다음 단계 진입 전 정정 (4건)

### M-1. `batch_runs` 자체는 UPDATE 사용 (state 전이) — Temporal Graph 패턴 (UPDATE 금지) 와 충돌

**증거:**

- `migrations/0014_phase05_critical_hardening.sql:34-52` — `prevent_knowledge_nodes_update` 등 **본문 UPDATE 차단** 트리거 (Hard Rule 1, 31)
- `migrations/0015_batch_runs.sql:54-68` — `batch_runs` 는 **state 컬럼 UPDATE 허용** (BEFORE UPDATE OF state 트리거가 일부 전이만 차단)
- `CLAUDE.md` Hard Rule — "knowledge_nodes, formulas 테이블 UPDATE 금지 (개정 시 신규 노드 + SUPERSEDES 엣지)"

**왜 major 인가:**

- ThePick 의 모든 본문 데이터는 INSERT-only + SUPERSEDES 엣지로 history 보존. `batch_runs` 만 UPDATE 사용 = **운영 메타데이터의 audit history 부재**.
- recover 시점에 `state='in_progress'` → `'recovered'` UPDATE 가 일어나면, **이전 state 값과 시점이 사라짐**. resume_count 증가만 남음.
- ADR-022 §"데이터 export 형식" — 매년 PostgreSQL import 검증 시 `batch_runs` 의 운영 history 가 부재하면 디버깅 추적 불가.

**완화 옵션:**

- **옵션 A (간단):** `batch_run_state_transitions` 테이블 신규 — `batch_run_id, from_state, to_state, transitioned_at` audit log. AFTER UPDATE 트리거가 자동 INSERT.
- **옵션 B (Temporal Graph 일관):** `batch_runs` 자체를 INSERT-only 로 재설계 — 매 state 전이가 신규 row + 이전 row `superseded_by` 채움. PK 가 `(batch_run_id, version)` 복합. **단점:** Step 11.6 의 D1 어댑터 SQL 시그니처 전면 재설계.

**권고:** 옵션 A. Step 11.6 코드 진입 전 0015 마이그레이션에 audit 테이블만 추가.

### M-2. `BatchCheckpoint.batch_run_id` 가 UUID 만 — Year 2 `(exam_id, batch_run_id)` 복합 키 전환 시 기존 checkpoint 호환성 부재

**증거:**

- `apps/batch/src/checkpoint.ts:74` — `readonly batch_run_id: string;`
- `apps/batch/src/checkpoint.ts:35` — `CHECKPOINT_SCHEMA_VERSION = 1 as const`
- `apps/batch/src/checkpoint.ts:325-333` — `schema_version` mismatch 시 `CheckpointCorruptedError` throw

**왜 major 인가:**

- Year 2 시점에 `BatchCheckpoint` 가 `exam_id` 필드 추가 시 `schema_version` bump 의무. 그러나 Year 1 누적된 `.checkpoint/*.json` 파일이 어떻게 마이그레이션되는가?
- 현재 `readCheckpoint` 의 `strictSchema` 옵션은 false 설정 시 silently 통과 — 무결성 위배 위험. true 설정 시 (기본) 모든 Year 1 checkpoint 가 거부 — recover 불가.
- `engine_version` 의 major bump 정책 (recover 거부) 과 schema_version 정책의 진화 경로가 ADR/문서로 정의되지 않음.

**완화:**

- `BatchCheckpoint` 에 `exam_id?: ExamId` optional 필드 Year 1 즉시 추가 (Hard Rule 17 한시 예외 — production-quality.md "Year 1 한시 예외"). Year 2 Phase 4 시점에 required 전환.
- `CHECKPOINT_SCHEMA_VERSION` 진화 경로 ADR 문서화 — v2 도입 시 v1 → v2 마이그레이션 함수 의무.

### M-3. `D1BatchRunsDb.updateState` 의 dynamic SQL builder — 잠재적 SQL injection 리스크 (Drizzle ORM 미사용)

**증거:**

- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:580-621` — raw SQL 문자열 concatenation 패턴
- `sets.push('last_completed_stage = ?'); vals.push(update.last_completed_stage);` — 컬럼명은 hard-coded, 값은 prepared statement bind. **SQL injection 자체는 안전 (column name 이 user input 아님).**
- `CLAUDE.md` 스택 — "ORM: Drizzle ORM (D1 네이티브)"

**왜 major 인가:**

- 본 dynamic SQL 패턴은 **SQL injection 안전**하지만 **타입 안전성 부재** — TypeScript 컴파일 단계에서 `last_completed_stage` 가 `PipelineStage` enum 값인지, `state` 가 `BatchRunState` 5종 중 하나인지 검증 안 됨.
- `BatchRunState` / `PipelineStage` 가 신규 값 추가될 때 SQL builder 가 자동 갱신되지 않음 — 신규 enum 값이 silently DB 에 저장 가능.
- Drizzle ORM 사용 시 `update(batchRuns).set({state: ...}).where(...)` 형태로 컴파일 단계 타입 검증 가능.
- **Year 2 영향:** schema 변경 시 raw SQL builder 의 `sets` 배열을 수동 수정해야 함. Drizzle 사용 시 schema 정의만 변경하면 자동 전파.

**완화:**

- Step 11.6 코드 진입 시 **Drizzle ORM 사용 강력 권고** — 프로젝트 표준 ORM. raw SQL 은 trigger 검증 등 Drizzle 가 추상화 못 하는 영역만.
- 만약 raw SQL 유지 시: `BatchRunStateValues` / `PipelineStageValues` 런타임 검증 함수 추가 — `updateState` 진입 시점에 enum 값 검증 후 SQL builder 진입.

### M-4. `last_inserted_node_id` 가 ontology-registry.json 정합성 미검증 — stale checkpoint 시 ID drift

**증거:**

- `apps/batch/src/checkpoint.ts:43` — `readonly last_inserted_node_id: string | null`
- `apps/batch/src/checkpoint.ts:309-322` — runtime shape 검증은 typeof 만, 정규식 검증 X
- `CLAUDE.md` Hard Limit — "Ontology Lock: ontology-registry.json 외 ID 생성 금지"

**왜 major 인가:**

- BATCH 진행 중 ontology-registry.json 변경 (예: 신규 NodeType 추가) → checkpoint 의 `last_inserted_node_id` 가 변경 전 ID 패턴 따름 → recover 시점에 신규 ontology 와 불일치.
- 현재 `recoverBatch` 는 ID 의 ontology 정합성을 검증하지 않음 — 단순 Q1~Q4 결정 트리만.
- Year 2 ExamAdapter 도입 시 ontology 가 시험별 분리되면 (`exams/{id}/ontology.json`), Year 1 checkpoint 의 `last_inserted_node_id` 가 어떤 시험의 ontology 인지 추적 불가.

**완화:**

- `BatchCheckpoint` 에 `ontology_registry_hash: string` 필드 추가 (Year 1: ontology-registry.json 의 SHA-256). recover 시 hash 불일치면 `CheckpointVersionMismatchError` 변형 throw.
- 또는 `last_inserted_node_id` 정규식 패턴을 checkpoint 에 함께 저장하여 검증.

---

## 4. MINOR — 향후 추적 (4건)

### m-1. ADR-022 §"데이터 export 형식" — 0015 batch_runs 가 PostgreSQL import 호환인가?

`migrations/0015_batch_runs.sql` 의 `CHECK (state IN (...))` + `RAISE(ABORT, ...)` 트리거 패턴은 PostgreSQL 호환. 그러나 ADR-022 Hard Rule 26 "Migration SQL 이 PostgreSQL 호환" 검증을 별도로 수행하지 않음. **권고:** 본 plan 차단 게이트 외이지만, ADR-022 §장치2 매년 export 테스트 시 0015 가 첫 검증 대상.

### m-2. `BatchRunRow.fixture_path` 가 절대 경로 / 상대 경로 mixed — Year 2 멀티 호스트 시 관리 부담

`migrations/0015_batch_runs.sql:24` — `fixture_path TEXT NOT NULL`. 형식 강제 없음. plan §4.4 의 `D1BatchRunsDb.insertNewRun({fixturePath: ctx.pdfPath ?? '<fixture>'})` — `ctx.pdfPath` 의 경로 정규화 책임 명시 X. **권고:** path 정규화 helper (예: `apps/batch/src/path-utils.ts`) — git root 기준 상대 경로로 정규화. Year 2 멀티 호스트 / Cloudflare Workers 진입 시 비호환 path 확산 차단.

### m-3. `engine_version` semver minor/patch bump 시 schema 변경 backward compat 정책 미정의

`apps/batch/src/checkpoint.ts:380-388` — `parseMajor` 만 비교. minor/patch 동일하면 통과. 그러나 minor bump 가 schema 변경 동반 시 (예: `BatchCheckpoint` 에 신규 optional 필드 추가) recover 가 silently 진행 — 신규 필드 미주입 데이터를 신규 코드가 사용. **권고:** semver minor bump 시 `CHECKPOINT_SCHEMA_VERSION` 도 bump 의무 정책 ADR.

### m-4. `batch_runs.engine_version` 인덱스는 운영 통계용 — Year 2 시점 partition 비용 증가 가능

`migrations/0015_batch_runs.sql:36` — `CREATE INDEX idx_batch_runs_engine_version`. Year 2 운영 시 `batch_runs` 행 수가 증가하면 (BATCH 매주 N회 × 2시험 × 5년) 본 인덱스 + state 인덱스 + started_at 인덱스 3종이 누적. **권고:** Year 2 진입 시 `batch_runs` 의 retention 정책 ADR — 90일 이전 completed 행 archive 테이블 이전.

---

## 5. Devil's Advocate — Year 2 진입 시 깨질 시나리오

**시나리오: "Year 2 첫 BATCH 적재 — 공인중개사 1차 교재 PDF"**

1. Year 2 Phase 4 마이그레이션 0005 적용 — `knowledge_nodes` 에 `exam_id` 컬럼 추가 + Year 1 데이터 backfill = `'son-hae-pyeong-ga-sa'`.
2. `D1BatchRunsDb` 가 Year 1 코드. `examId` 인자 없음 (C-2 미정정 상태).
3. 진산님 "BATCH-1 적재 (공인중개사)" 트리거. `runPipeline` 진입.
4. `recoverBatch({batchRunId: 'gjs-batch-001', ...})` 호출. `selectByRunId('gjs-batch-001')` 가 **examId 없이** 쿼리 — Year 1 의 `'shpgs-batch-001'` 과 UUID collision 시 Year 1 BATCH 의 row 반환. 🔴 **두 시험 데이터 cross-contamination.**
5. 만약 collision 없어도, recover 결정 트리가 `state='completed'` 반환 → `already_completed` skip. **공인중개사 적재가 실행되지 않음.**
6. 또는 fresh insert 시 `batch_runs` 트리거 `trg_batch_runs_no_duplicate_completed` 가 동일 PK 검사. UUID collision 없으면 통과 — 그러나 `batch_runs.exam_id` 컬럼이 부재하여 시험 격리 안 됨.
7. **AC-R1 e2e 테스트 (Year 1) 가 통과한 코드가 Year 2 production 에서 silent data corruption.**

**예방:**

- C-2 (examId 시그니처) 즉시 적용 — Year 1 시점 인터페이스만 보강, 내부 구현은 그대로.
- 0015 마이그레이션에 `exam_id TEXT` 컬럼 + 인덱스 즉시 추가 (Year 1 한시 예외 — production-quality.md 명시).
- Year 2 마이그레이션 0005 시점에 `(exam_id, batch_run_id)` 복합 PK 전환 plan 사전 작성.

---

## 6. Top 3 Actions

### 1. **Step 11.6 코드 진입 전, Step 5 plan 갱신 + 0016 마이그레이션 작성 의무화 (C-1 처리)**

- `knowledge_nodes` 에 `batch_run_id`, `source_id` 컬럼 추가
- `source_id` 의 정의 명확화 (페이지+섹션+노드타입 결정성 키 권고)
- 0014 `prevent_knowledge_nodes_update` 화이트리스트 갱신 (NULL → 값 1회 허용)
- AC-R1 e2e 가 production D1 에서도 PASS 하도록 보장
- ETA: 0.5d (plan 갱신) + 0.5d (마이그레이션 작성 + 검증)

### 2. **`BatchRunsDb` 인터페이스 + `BatchCheckpoint` 에 `exam_id` 필드 즉시 도입 (C-2, M-2 처리)**

- Hard Rule 16 "Year 1 한시 예외" 적용 — 시그니처에 examId 포함, 내부 WHERE 미주입
- `.checkpoint/{exam_id}/{batch_run_id}.json` 디렉토리 구조 도입
- Year 2 Phase 4 zero-cost 전환 보장
- ETA: 0.3d (Step 11.6 plan 정정) + 0.2d (코드 반영)

### 3. **0015 트리거 WHEN 조건 보정 + audit 테이블 신설 (C-3, M-1 처리)**

- `trg_batch_runs_recover_only_from_terminal` WHEN 에 `'in_progress'` 추가 (24h stale lock 정상 경로 허용)
- `batch_run_state_transitions` audit 테이블 신설 + AFTER UPDATE 트리거
- D1 Preview 검증 시나리오 T5 추가 (stale lock recover)
- ETA: 0.3d

---

## 7. 진행 권고

> **partial proceed.** Step 11.6 코드 진입을 **0.5~1.5d 지연**시키고 위 Top 3 Actions 를 우선 처리.

**근거:**

1. C-1 미정정 시 Step 5 (Step 11.6 직후 진입 예정) 가 시작 즉시 ALTER TABLE 차단으로 멈춘다 — 본 plan 의 AC-R1 e2e 가 mock 환경 PASS / production FAIL 이는 production 안전 검증 무력화.
2. C-2 미정정 시 Year 2 진입 시점의 ExamAdapter 도입이 zero-cost 가 아니라 **모든 Step 11.6 코드의 시그니처 재작성** 비용 (대략 1d → 5d). Year 1 한시 예외 정합 조항을 지금 적용하면 0.5d.
3. C-3 미정정 시 stale lock recover 가 0015 트리거에 의해 차단 — recover 결정 트리의 정상 경로 자체가 막힘. ROADMAP v1.1 의 AC-R1 통과 불가능.

**대안 진입 순서:**

1. Action 1 (C-1, Step 5 plan + 0016 마이그레이션) — 0.5d
2. Action 2 (C-2, BatchRunsDb examId + BatchCheckpoint exam_id) — 0.3d
3. Action 3 (C-3, 0015 트리거 보정 + audit 테이블) — 0.3d
4. Step 11.6 코드 진입 (plan §4 핵심) — 2.6d
5. Step 11.6 4-Pass 리뷰 — 0.5d

**합계:** 4.2d (기존 plan 추정 2.6d + 1.6d 선행)

**ROADMAP v1.1 영향:** Step 12~17 합계 +1.6d 증가 — v1.2 패치 시점 본 정정 반영 권고.

---

**리뷰 완료 시각:** 2026-04-28 (KST)
**리뷰어 자기 점검:** 본 리뷰는 다음을 침범하지 않음:

- refactoring-expert: 코드 품질 (any, console.log, 빈 catch — 본 리뷰는 SQL injection M-3 외 코드 품질 미언급)
- performance-engineer: 처리량 (인덱스 m-4 만 운영 부담 차원 언급, 처리량 분석 미수행)
- quality-engineer: 테스트 커버리지 (AC-R1 mock-only 갭 언급은 데이터 정합성 차원, 테스트 전략은 미언급)
- devops-architect: 운영/SIGINT/cap (SIGINT/SIGTERM/cap 미언급, 0015 audit 테이블은 데이터 lifecycle 차원)

**증거 기반 보고 준수:**

- 모든 CRITICAL/MAJOR 가 파일:라인 인용 포함 (0001:21, 0014:34-53, 0015:40-68, recover.ts:57-70, checkpoint.ts:74, step5 plan:46-48, step11-6 plan:541-621 등)
- 0건 보고 항목 없음 (모든 항목이 발견 결과)
- Devil's Advocate §5 — Year 2 cross-contamination 시나리오 1건 명시
