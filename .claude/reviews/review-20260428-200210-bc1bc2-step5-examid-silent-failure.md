# Step 5/11.6 P0 정정 — silent-failure-hunter 독립 4-Pass 리뷰

**리뷰 방식:** 독립 에이전트 (silent-failure-hunter 페르소나, 자가 리뷰 금지 준수)
**리뷰 범위:** 코드 3파일 + 마이그레이션 1신규 + plan 3 갱신

- `apps/batch/src/recover.ts`
- `apps/batch/src/checkpoint.ts`
- `apps/batch/__tests__/recover.test.ts`
- `migrations/0016_knowledge_nodes_batch_idempotency.sql` (신규)
- `migrations/0015_batch_runs.sql` (SA-M2 정정)
- `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` v1.0 → v1.1
- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` v1.0 → v1.1

**직전 4-Pass 권고 흡수:** `.claude/reviews/midpoint-20260428-backend.md` C-1 (knowledge_nodes 컬럼 부재) + C-2 (BatchRunsDb examId 부재). 본 리뷰는 C-1/C-2 정정의 silent failure 도입 가능성만 검증.

**검증 사전 정보:** typecheck PASS, 137/137 tests PASS (회귀 0건).

**스코프 한정:** silent failure / inadequate error handling / fallback 부재만 검증. system-architect (인터페이스 호환성) / quality-engineer (테스트 커버리지) 영역 침범 금지.

---

## 발견 사항 요약

| 분류     | 건수 | 항목                                                                                                                                                             |
| -------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 0    | —                                                                                                                                                                |
| MAJOR    | 2    | M-1 examId 시그니처 silent ignore (Year 2 cross-contamination 도화선) / M-2 BatchCheckpoint.exam_id optional 직렬화 시 silent skip                               |
| MINOR    | 3    | m-1 mock `_examId` 미검증 시 production silent fail-through 그림자 / m-2 0016 트리거 backfill 패턴 silent 회귀 / m-3 stale lock 시 row.exam_id 없이 recover 진행 |

**판정: accept_with_caveats** — 본 정정은 backend-architect C-1/C-2 의 권고를 정확히 흡수하여 컴파일 시점 시그니처 강제화 + DDL 단계 backfill 화이트리스트 추가를 달성. 단, Year 2 진입 시 발효될 silent failure 그림자 (`void examId; _examId 미사용 mock`) 가 잠복하여, **Step 11.6 코드 구현 시 e2e 테스트로 흡수 의무**.

---

## Pass 1 — 추가된 examId 시그니처가 silent failure 도입 가능성

### M-1 (MAJOR): D1BatchRunsDb 의 `void examId;` 패턴 — Year 2 진입 시 잠복 silent collapse

**위치:**

- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:585-586, 602-603, 633-634` — D1 어댑터 본문 3개 메서드 모두 `void examId;` 로 인자만 받고 무시
- `apps/batch/src/recover.ts:70-84` — `BatchRunsDb` 인터페이스 정의 — 시그니처는 정확히 examId 포함

**증거 인용 (plan v1.1, line 581-636):**

```typescript
async selectByRunId(examId: ExamId, batchRunId: string): Promise<BatchRunRow | null> {
  // Year 1: examId 미사용 (단일 시험). Year 2 Phase 4 진입 시 'WHERE exam_id = ?' 추가.
  void examId;
  ...
}
```

**문제점:**

1. 시그니처는 examId 를 강제하지만, 본문은 `void examId;` 로 의도적으로 무시. 이것은 production-quality.md Hard Rule 16 의 "Year 1 한시 예외" 명시 패턴이지만 — **Year 2 마이그레이션 0005 도입 시점에 누군가가 `void examId;` 줄만 지우고 SQL `WHERE exam_id = ?` 를 잊으면 ZERO ERROR 로 cross-contamination**.
2. `void examId;` 와 `WHERE exam_id = ?` 추가는 **다른 두 줄** — 한 쪽만 잊혀도 컴파일러/타입체커는 통과 (`examId` 파라미터는 사용된 것으로 간주).
3. plan 본문에 "Year 2 진입 시 `WHERE exam_id = ?` 추가" 가 적혀 있지만, **실제 코드에는 없음** — `// TODO: Year 2 enable WHERE clause` 같은 마커 주석조차 없음.

**깨질 시나리오 (Devil's Advocate):**

- Year 2 Phase 4 진입. 개발자가 `D1BatchRunsDb.selectByRunId` 본문 첫 줄 `void examId;` 를 제거하고 SQL 을 `SELECT ... WHERE batch_run_id = ?` 그대로 둠.
- TypeScript 컴파일 통과 (examId 는 시그니처 인자로 사용된 것으로 간주). 단위 테스트도 통과 (mock `_examId` 가 무시).
- Production: 손해평가사 `BATCH-001` UUID 와 공인중개사 `BATCH-001` UUID 충돌 시, **다른 시험의 row 가 silent 반환** → recover() 가 잘못된 시험의 stage 부터 재개. 데이터 cross-contamination 발생까지 ZERO 에러.

**왜 silent failure 인가:**

- 함수가 정상 반환. 에러 throw 없음.
- 잘못된 row 반환은 caller 에게 "정상 응답" 으로 보임.
- 로그에도 "selectByRunId 호출 성공" 으로만 기록.
- 진산님이 cross-contamination 을 발견하기 전까지 무한히 잠복.

**권고:**

1. `void examId;` 대신 **명시적 assertion 가드** 도입:
   ```typescript
   if (typeof examId !== 'string' || examId.length === 0) {
     throw new Error('[BatchRunsDb] examId is required (Hard Rule 16)');
   }
   // Year 2 Phase 4 enable: SQL append `WHERE exam_id = ?`
   ```
2. 또는 Year 2 마이그레이션 timer — 마이그레이션 0005 진입 시 SQL 누락이 에러 throw 하는 통합 테스트 사전 작성 (Step 11.6 테스트 흡수 시).
3. 최소한 **`// FIXME(year2-phase4): WHERE exam_id = ${examId}`** 마커를 본문에 삽입 — `quality-gate.sh` 의 TODO/FIXME 감지 hook 이 Year 2 진입 시 알람.

**우선순위:** Step 11.6 코드 구현 시 흡수. 본 정정만으로는 차단 불가 (현 plan 만 변경된 상태이므로 코드 진입 전 정정 가능).

---

### m-1 (MINOR): mock `_examId` underscore prefix — production silent fail-through 그림자

**위치:** `apps/batch/__tests__/recover.test.ts:72-76`

```typescript
async selectByRunId(_examId, batchRunId) {
  return currentRow && currentRow.batch_run_id === batchRunId ? currentRow : null;
},
async updateState(_examId, batchRunId, update) {
  ...
}
```

**문제점:**

- mock 이 `_examId` underscore prefix 로 의도적으로 무시. 단위 테스트라서 OK.
- **그러나 mock 은 production 어댑터 (D1BatchRunsDb) 와 같은 인터페이스 (`BatchRunsDb`)** — 같은 무시 패턴이 production 으로 복사되면 M-1 발효.
- 테스트 8건 모두 `examId: TEST_EXAM_ID` 만 전달 — **examId 가 다른 row 와 매칭되는지 검증하는 테스트 없음** (cross-contamination 회귀 테스트 부재).

**깨질 시나리오:**

- Year 2 진입 후 mock 이 그대로 사용됨. 새로운 examId 인 `EXAM_IDS.GONG_IN_JUNG_GAE_SA` 를 추가했는데, 단위 테스트가 손해평가사 `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 만 사용하는 mock 으로 동작 → "테스트 통과" 로 인지.
- production 의 D1BatchRunsDb 는 정작 `WHERE exam_id = ?` 누락 → cross-contamination — 단위 테스트가 잡지 못함.

**권고:**

- Step 11.6 e2e 테스트 단계에서 **명시적 cross-examId 회귀 테스트** 추가:
  - 동일 batch_run_id UUID 가 두 examId 에 존재 시, `recoverBatch({examId: A})` 가 examId B 의 row 를 절대 반환하지 않음 검증.
- mock 을 `_examId` 무시 대신 **`if (examId !== currentRow.exam_id) return null;`** 패턴으로 변경 (배치 row 에 exam_id 컬럼 부재이므로 `_examId` 자체는 OK 이나, Year 2 시점에 mock 도 정합 의무).

**우선순위:** Step 11.6 흡수 (현 변경에선 차단 사유 아님 — quality-engineer 영역 일부 침범 인정).

---

## Pass 2 — BatchCheckpoint.exam_id optional 필드의 silent skip

### M-2 (MAJOR): `BatchCheckpoint.exam_id?` optional + `buildCheckpoint` spread — 누락 시 검증 부재

**위치:**

- `apps/batch/src/checkpoint.ts:71-104` — `BatchCheckpoint.exam_id?: ExamId` optional
- `apps/batch/src/checkpoint.ts:145-156` — `SnapshotInput.examId?: ExamId` optional
- `apps/batch/src/checkpoint.ts:162-188` — `buildCheckpoint` 의 spread 패턴
  ```typescript
  ...(input.examId !== undefined ? { exam_id: input.examId } : {}),
  ```
- `apps/batch/src/checkpoint.ts:341-433` — `readCheckpoint` 의 shape 검증 (line 374-386) — exam_id 검증 부재

**문제점:**

1. **누락 silent collapse:** `input.examId === undefined` 시 spread 가 빈 객체. checkpoint JSON 에 `exam_id` 키 자체가 없음.
2. **readCheckpoint shape 가드 (line 374-386):** `state_hash`, `engine_version`, `batch_run_id`, `pipeline_stage` 만 typeof 검증. **exam_id 는 typeof 검증 대상도 아님** — Year 1 한시 예외라 부재 허용 의도이나, **잘못된 타입이 들어와도 silent 통과**.
3. **state_hash 무결성 검증은 통과:** `canonicalJson` 이 keys 정렬 + undefined 제거이므로, exam_id 부재 checkpoint 와 exam_id 포함 checkpoint 의 `state_hash` 가 다름 — 그러나 **exam_id 가 잘못된 타입 (예: number)** 으로 들어오면, canonicalJson 통과 + state_hash 일치 가능 (외부 변조 시).
4. **recover.ts 가 exam_id 검증 안 함:** `recover.ts:170` 의 `readCheckpoint` 호출 후, line 232-244 의 `depends_on` 만 검증. **`checkpoint.exam_id !== opts.examId` 일관성 검증 없음**.

**깨질 시나리오:**

- Year 1 시점에 손해평가사 `BATCH-001` checkpoint 작성. exam_id 미주입 (현 입력 패턴).
- Year 2 Phase 4 진입. 마이그레이션 0005 적용 후 `exam_id` 가 required 로 전환되었으나, **Year 1 checkpoint 파일은 exam_id 없이 디스크에 잔존**.
- 누군가 `recoverBatch({examId: 'gong-in-jung-gae-sa', batchRunId: 'BATCH-001', ...})` 호출.
- `readCheckpoint` 가 exam_id 없는 Year 1 checkpoint 를 그대로 로드. shape 가드 통과 (exam_id 검증 부재). state_hash 검증 통과.
- `recoverBatch` 가 `checkpoint.exam_id !== opts.examId` 검증 없이 진행 → **공인중개사 추적기로 손해평가사 BATCH-001 의 stage 를 재개**. 노드 cross-contamination.

**왜 silent failure 인가:**

- checkpoint.ts:84 주석: "Year 2 Phase 4: required + checkpoint 디렉토리 구조 변경" — **요구사항은 인지되어 있으나, Year 1 시점에 가드가 없음**.
- exam_id 일관성 검증 부재 = **Year 1 checkpoint 가 Year 2 코드에서 silent 통과** = 적재 데이터 cross-contamination.

**권고:**

1. `recover.ts:230` 직전에 **명시적 일관성 가드** 추가:
   ```typescript
   // exam_id 일관성 검증 — Year 1 한시 (optional → 부재 허용), Year 2 (required)
   if (checkpoint.exam_id !== undefined && checkpoint.exam_id !== opts.examId) {
     return {
       status: 'recovery_failed',
       resumed_from_stage: null,
       data_loss_estimate: { nodes_lost: 0, stages_skipped: 0, severity: 'critical' },
       fallback_strategy: 'manual_review_required',
       user_notification_required: true,
       message: `examId mismatch — checkpoint.exam_id=${checkpoint.exam_id}, opts.examId=${opts.examId}. 시험 cross-contamination 차단.`,
     };
   }
   ```
2. `readCheckpoint` shape 가드에 `parsed.exam_id !== undefined && typeof parsed.exam_id !== 'string'` 검증 추가 (잘못된 타입 거부).
3. Step 11.6 의 fallback 디렉토리 구조 (`{baseDir}/{exam_id}/{batchRunId}.json`) plan 도입 시기 확정 (현 plan 에 미명시).

**우선순위:** **즉시 정정 권고** — 본 변경 자체에 가드 추가가 비용 5줄 미만이며, Year 2 진입 시 잠복 cross-contamination 차단.

---

### m-3 (MINOR): stale lock 시 `row.exam_id` 검증 부재

**위치:** `apps/batch/src/recover.ts:147-165` — stale lock 분기

```typescript
if (row && row.state === 'in_progress') {
  const elapsedMs = Math.max(0, Date.now() - new Date(row.started_at).getTime());
  if (elapsedMs < staleThreshold) {
    return { status: 'concurrent_run_detected', ... };
  }
}
// 24h+ 통과 → checkpoint 로드 진행
```

**문제점:**

- `row` 는 `selectByRunId(examId, batchRunId)` 결과. Year 1 의 mock/D1 어댑터 모두 examId WHERE 미적용.
- Year 2 진입 시: `selectByRunId` 가 잘못된 examId 의 row 를 반환할 수 있음 (D1 어댑터의 SQL 누락 시).
- **stale lock 분기는 row.state 만 검사** — row.exam_id 와 opts.examId 일관성 검증 없음.

**깨질 시나리오:**

- Year 2: 두 시험에서 동일 UUID `BATCH-001`. 손해평가사 BATCH-001 이 48h 전 시작 (stale). 공인중개사가 BATCH-001 신규 진입.
- D1BatchRunsDb 의 SQL 누락 (M-1 발효) → 손해평가사 BATCH-001 row 반환.
- elapsedMs 48h > staleThreshold → stale 통과 → checkpoint 로드 (공인중개사 baseDir). checkpoint 부재 → no_checkpoint → restart.
- **공인중개사가 손해평가사의 stale lock 을 무시한 채 신규 적재** — 진산님이 손해평가사 BATCH-001 강제 종료 시도 시 이미 다른 시험에 의해 'recovered' 로 갱신된 상태.

**우선순위:** M-2 의 일관성 가드가 처리하면 자동 해결. M-2 권고로 충분.

---

## Pass 3 — 0016 마이그레이션의 트리거 갱신 silent collapse

### m-2 (MINOR): 0014 트리거 본문 보존 검증 — 누락 0건 확인 (PASS)

**위치:** `migrations/0016_knowledge_nodes_batch_idempotency.sql:67-89` vs `migrations/0014_phase05_critical_hardening.sql:34-53`

**확인 항목 (실제 비교):**

- 0014 본문 가드 14개 컬럼: `id`, `type`, `name`, `description`, `lv1_insurance`, `lv2_crop`, `lv3_investigation`, `page_ref`, `batch_id`, `version_year`, `superseded_by`, `truth_weight`, `status`, `exam_scope`
- 0016 본문 가드 14개 컬럼: 위와 동일 14개 + backfill 예외 2줄 (`batch_run_id`, `source_id`)
- 14개 모두 보존 — **누락 0건**.

**확인 증거 3건:**

1. `migrations/0014_phase05_critical_hardening.sql:37-50` — 0014 의 14개 컬럼 가드 (id 부터 exam_scope 까지)
2. `migrations/0016_knowledge_nodes_batch_idempotency.sql:70-83` — 0016 의 14개 컬럼 가드 (동일 순서, 동일 컬럼)
3. `migrations/0016_knowledge_nodes_batch_idempotency.sql:84-86` — backfill 예외 2줄 (`OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id` / `OLD.source_id IS NOT NULL AND NEW.source_id IS NOT OLD.source_id`)

**판정:** PASS (silent collapse 부재). 본문 14개 컬럼 가드 누락 0건. backfill 예외 패턴은 NULL→값 1회만 허용, 값→다른 값 / 값→NULL 모두 ABORT.

**Devil's Advocate (반론 시나리오):**

- backfill 예외가 "값 → 동일 값 (no-op UPDATE)" 도 통과시킴. 즉 `UPDATE knowledge_nodes SET batch_run_id = batch_run_id WHERE id = ?` 는 ABORT 안 함 (`IS NOT` = FALSE 이므로 트리거 진입 안 함).
- **실제 silent failure 인가?** 아님 — no-op UPDATE 는 의미상 안전. SQLite `BEFORE UPDATE` 트리거의 정상 행위. `OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id` 만 ABORT.
- **단, "값 → 같은 값" 시 application logic 이 idempotency 위반을 인지 못함.** 예: 같은 batch_run_id 로 두 번 INSERT OR IGNORE 시 두 번째는 IGNORE — 정상. 하지만 추후 backfill 재시도 시 "이미 backfill 됨" 신호가 silent 통과.
- **위험도:** 미미. application 레벨 idempotency 키 (`(batch_run_id, source_id) UNIQUE`) 가 이중 방어.

**우선순위:** 정보성 보고. 차단 사유 아님.

---

## Pass 4 — recoverBatch 본문 변경의 에러 전파

### 검증 결과: 에러 전파 변경 0건 (PASS)

**확인 항목 (실제 비교):**

1. `apps/batch/src/recover.ts:133` — `selectByRunId(opts.examId, opts.batchRunId)` — 인자만 추가, throw 경로 변경 없음
2. `apps/batch/src/recover.ts:247-250` — `updateState(opts.examId, opts.batchRunId, {...})` — 동일 (인자만 추가)
3. `apps/batch/src/recover.ts:174-228` — Q1/Q2/Q3 try-catch 분기 모두 보존 (CheckpointNotFoundError → no_checkpoint, CheckpointCorruptedError → recovery_failed, CheckpointVersionMismatchError → recovery_failed)
4. `apps/batch/src/recover.ts:227` — `throw err;` 미분류 에러 명시 전파 (silent swallow 없음)
5. `apps/batch/src/recover.ts:232-244` — `depends_on` 가드 보존 (P1-M4 정정 부분 회귀 0건)

**확인 증거 3건:**

1. `recover.ts:174` — `if (err instanceof CheckpointNotFoundError)` 분기 — examId 추가 후에도 동일 catch 동작
2. `recover.ts:194` — `if (err instanceof CheckpointCorruptedError)` 분기 — examId 추가 후에도 fallback `manual_review_required` 보존
3. `recover.ts:227` — 마지막 `throw err;` 유지 — silent failure 차단 패턴 회귀 0건

**Devil's Advocate (반론 시나리오):**

- `selectByRunId(opts.examId, opts.batchRunId)` 에서 examId 추가가 D1 어댑터 본문에서 새 throw 경로를 만들 수 있음 (예: `if (!examId) throw new Error(...)`).
- 그러나 plan v1.1 line 586 의 `void examId;` 패턴은 throw 안 함 — Year 1 한시 예외 패턴.
- Mock (`_examId`) 도 throw 안 함.
- 따라서 **현 정정만으로 새 throw 경로 도입 0건**. 단 M-1 권고대로 assertion 가드 추가 시 새 throw 경로 추가됨 — 그것은 의도된 변경이며 silent failure 가 아닌 명시적 fail-fast.

**판정:** PASS. examId 추가가 기존 throw 경로 변경 0건. silent swallow 도입 0건.

---

## Pass 5 — mock 시그니처 변경의 silent fail-through (Pass 1 m-1 와 통합)

### 검증 결과: 단위 테스트 컨텍스트에서 PASS, e2e 컨텍스트에서 m-1 발효 가능

**확인 항목:**

- `recover.test.ts:32` — `const TEST_EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA;` — Hard Rule 17 준수 (리터럴 미사용)
- `recover.test.ts:72-86` — mock 이 `_examId` 무시 — 단위 테스트 컨텍스트에선 OK (단일 시험 가정)
- 테스트 8건 모두 `examId: TEST_EXAM_ID` 전달 — 시그니처 강제 검증 PASS

**Devil's Advocate (반론 시나리오):** Pass 1 m-1 참조.

**판정:** 본 정정 단위에선 PASS. e2e (Step 11.6) 시점에서 cross-examId 회귀 테스트 의무 (m-1 권고).

---

## 요약 판정

**판정: accept_with_caveats**

**근거:**

1. 본 정정은 backend-architect midpoint review C-1/C-2 의 권고를 정확히 흡수.
2. silent failure 차단의 핵심 패턴 (CheckpointCorruptedError 통합, depends_on stub 제거, throw err; 명시 전파) 회귀 0건.
3. 0016 트리거 backfill 화이트리스트는 0014 본문 14개 컬럼 가드 누락 없이 정확히 2줄만 추가.
4. 137/137 tests PASS — 회귀 0건 객관 증거.

**전제 조건 (caveats):**

1. **M-2 즉시 정정 권고:** `recover.ts:230` 직전에 `checkpoint.exam_id !== undefined && checkpoint.exam_id !== opts.examId` 가드 5줄 추가. 본 변경 자체로 처리 가능.
2. **M-1 / m-1 / m-3 Step 11.6 흡수 의무:** D1BatchRunsDb 코드 구현 시 (1) `void examId;` 대신 명시적 assertion + `// FIXME(year2-phase4)` 마커 (2) cross-examId 회귀 e2e 테스트 (3) row.exam_id 일관성 검증 — 본 caveats 가 누락되면 Year 2 cross-contamination 잠복.
3. **m-2 정보성:** 0016 트리거 검증 통과. 추가 정정 불필요.

**진산님 결정 사항:**

- M-2 즉시 정정 (5줄 추가) 또는 Step 11.6 일괄 흡수 — 둘 중 택1.
- 권고: **즉시 정정** (M-2 는 본 정정 범위 내에서 처리 가능, Year 2 진입 시 발효 차단 비용이 가장 낮음).

---

## 본 산출물 path

`/home/soo/ClaudePro/ThePick/.claude/reviews/review-20260428-200210-bc1bc2-step5-examid-silent-failure.md`
