# BC1+BC2 정정 (Step 5 plan v1.1 + 0016 마이그레이션 + recover/checkpoint examId) 4-Pass 리뷰 — quality-engineer 페르소나

- **리뷰 방식:** 독립 에이전트 (quality-engineer)
- **리뷰 범위:** 코드 3파일 + 마이그레이션 1신규 + plan 3 갱신
  - `apps/batch/src/recover.ts` (BatchRunsDb examId, RecoverOptions.examId)
  - `apps/batch/src/checkpoint.ts` (BatchCheckpoint.exam_id?, SnapshotInput.examId?, buildCheckpoint spread)
  - `apps/batch/__tests__/recover.test.ts` (mock 시그니처 + 8개 호출 갱신)
  - `migrations/0016_knowledge_nodes_batch_idempotency.sql` (신규)
  - `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` v1.1 (AC-RP-6 / AC-RP-7 신규)
  - 인접 갱신: `apps/batch/src/loader/draft-loader.ts` (현 상태 — plan 미반영 확인)
- **직전 4-Pass 권고 흡수:** `.claude/reviews/midpoint-20260428-backend.md` C-1 / C-2 (knowledge_nodes 컬럼 부재 + BatchRunsDb examId 부재)
- **사전 검증 정보:** typecheck PASS, 137/137 tests PASS (회귀 0건)
- **리뷰 시점:** 2026-04-28 20:02 (P0 후보 B 정정 직후, Step 11.6 코드 진입 전)

---

## 1. 한 줄 평가

> **reject_and_revise.** 직전 backend C-1 / C-2 권고를 시그니처 / 컬럼 / 트리거 갱신 레벨에서는 정확히 흡수했으나, **흡수 산출물 자체의 검증 의무(테스트 신규 분기)가 0건**이다. 137 PASS 는 정정 코드의 신규 분기를 1개도 실행하지 않는다 (TEST_EXAM_ID 단일 / exam_id 미주입 path / 0016 SQL 트리거 본문 / source_id 결정성 모두 미검증). 추가로 **`source_id` 정의가 plan v1.1 에는 명문화되었으나 `draft-loader.ts:247` 의 INSERT 컬럼 목록이 v1.0 그대로** — 0016 컬럼이 NULL 만 INSERT 되어 partial UNIQUE 가 실효 0% 인 Silent Pivot 상태. AC-Cost / AC-Snapshot' / AC-T3 의 직전 CRITICAL 3건은 그대로 살아 있고, 본 정정으로 AC-ExamId / AC-RP-6 / AC-RP-7 신규 3건이 더해졌다. **Step 11.6 코드 진입 전 의무 테스트 ≥ 18 케이스 추가 필요 (0.75d 이상).**

---

## 2. CRITICAL — 신규 분기 검증 0건 (5건)

### CRITICAL-Q1: `BatchRunsDb` examId 분기 검증 부재 — mock 이 `_examId` 무시 (AC-ExamId 신설)

**증거:**

- `apps/batch/__tests__/recover.test.ts:72-76` — mock 의 `selectByRunId(_examId, batchRunId)` / `updateState(_examId, batchRunId, update)` 가 `_examId` 를 underscore prefix 로 무시.
- `apps/batch/__tests__/recover.test.ts:32` — `const TEST_EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA;` 단일 값. 모든 8개 호출이 동일 examId 만 주입.
- `apps/batch/src/recover.ts:71-83` — `BatchRunsDb` 인터페이스가 examId 를 첫 인자로 받지만, 본 인터페이스의 production 구현 (Step 11.6 D1BatchRunsDb 예정) 에서 examId 를 SQL `WHERE` 절에 주입하는 분기는 검증 의무.
- 137 PASS 가 검증한 것 = `recoverBatch` → mock 호출 시 `_examId` 가 어떤 값이든 mock 이 무시 = **examId 계약 (Hard Rule 16) 검증 0건.**

**왜 critical 인가:**

1. Year 2 Phase 4 마이그레이션 0005 (exam_id 컬럼 도입) 에서 D1BatchRunsDb 내부 구현이 `WHERE exam_id = ?` 절 추가. 이 시점에 mock 이 examId 무시 가정으로 짜여 있어 **실제 D1 통합 테스트가 진입할 때 mock 패턴 = 잘못된 reference 가 됨.**
2. 동일 batch_run_id 가 다른 examId 로 존재하는 경우 (Year 2 시뮬레이션): mock 이 `currentRow.batch_run_id === batchRunId` 만 비교 → 다른 examId 의 row 를 반환 = **cross-tenant 데이터 누수 검증 0건.**
3. 직전 backend C-2 의 정정 의도 = "Year 2 zero-cost 전환". zero-cost 전환의 binary gate = "호출 측 코드 변경 X 검증". 검증 의무 = examId 분기 시나리오 테스트. 본 정정에는 부재.

**의무 테스트 케이스 (P0 4건):**

1. `selectByRunId` 호출 시 examId 가 mock 에 정확히 주입 검증 (assert spy 패턴)
2. `updateState` 호출 시 examId 가 mock 에 정확히 주입 검증
3. 다른 examId 의 동일 batch_run_id row 가 mock 에 있을 때 selectByRunId 가 null 반환 검증 (Year 2 cross-tenant 시뮬레이션)
4. examId 미주입 시 TypeScript 컴파일 에러 검증 (negative test — `// @ts-expect-error` + tsc 출력 캡처)

**AC 매핑:** AC-ExamId (신규) — examId 시그니처 검증 의무.

---

### CRITICAL-Q2: `BatchCheckpoint.exam_id` optional 분기 검증 부재 — 3시나리오 모두 0건

**증거:**

- `apps/batch/src/checkpoint.ts:84` — `readonly exam_id?: ExamId;` optional.
- `apps/batch/src/checkpoint.ts:147` — `SnapshotInput.examId?: ExamId;` optional.
- `apps/batch/src/checkpoint.ts:171` — `...(input.examId !== undefined ? { exam_id: input.examId } : {}),` 조건부 spread.
- `apps/batch/__tests__/checkpoint.test.ts` — `grep examId` 결과 0건. 즉 buildCheckpoint 에 examId 주입 시 / 미주입 시 / 다른 examId 시나리오 검증 0건.
- `apps/batch/__tests__/recover.test.ts` — 모든 buildCheckpoint 호출이 `examId` 미주입 (e.g., line 103-110). examId 미주입 path 만 우연히 검증, 의도적 검증 X.

**왜 critical 인가:**

1. **state_hash 결정성 검증 부재:** `computeStateHash` 는 canonical JSON 기반. exam_id 주입 / 미주입 → canonical JSON output 다름 → state_hash 다름. 동일 BATCH 가 examId 주입 후 examId 누락 fallback path 진입 시 state_hash mismatch → CheckpointCorruptedError 발생 가능. 이 시나리오 검증 0건.
2. **Year 2 cross-tenant checkpoint 충돌:** Year 2 Phase 4 시점에 `{baseDir}/{exam_id}/{batch_run_id}.json` 디렉토리 분리 도입. 그 전엔 `{baseDir}/{batch_run_id}.json` 평면 구조. 동일 batch_run_id 가 examId 다르게 존재 시 → 파일 충돌. checkpointPath 의 examId 미반영 검증 0건.
3. **canonical JSON 직렬화 결정성:** `canonicalJson` 은 `Object.keys().sort()` 로 키 정렬. exam_id 주입 시 키 위치가 alphabet 순으로 들어감 (b 와 e 사이) — 다른 환경 (Node 버전, JSON.stringify 구현 차이) 에서 동일 결과 보장 검증 부재.

**의무 테스트 케이스 (P0 5건):**

1. examId 주입 buildCheckpoint → `result.exam_id === EXAM_IDS.SON_HAE_PYEONG_GA_SA` 검증
2. examId 미주입 buildCheckpoint → `result.exam_id === undefined` 검증 (현재 우연히 통과, 의도 검증으로 승격)
3. examId 주입 / 미주입 두 checkpoint 의 state_hash 비교 → 다름 검증 (결정성 + 의미 분리)
4. 동일 examId / 동일 input → state_hash 100회 반복 동일 검증 (결정성)
5. examId 다른 두 checkpoint → state_hash 다름 검증 (Year 2 cross-tenant 분리)

**P1 추가 케이스 (3건):** 6. exam_id 미주입 BatchCheckpoint 직렬화 + readCheckpoint round-trip → 동일 state_hash 7. exam_id 주입 BatchCheckpoint 직렬화 + readCheckpoint round-trip → 동일 state_hash + exam_id 보존 8. 외부에서 exam_id 만 변조 (다른 examId 로 교체) → CheckpointCorruptedError throw 검증

**AC 매핑:** AC-ExamId (신규) + AC-Snapshot' (직전 CRITICAL 그대로 stale).

---

### CRITICAL-Q3: 0016 마이그레이션 단위 테스트 0건 — better-sqlite3 / wrangler d1 e2e 의무 미충족

**증거:**

- `migrations/0016_knowledge_nodes_batch_idempotency.sql` (신규 1파일)
- `apps/batch/__tests__/` 디렉토리 grep — 마이그레이션 SQL 검증 테스트 0건
- `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md:258-274` — AC-RP-6 / AC-RP-7 명시 = "Step 5 플랜에서 검증" 으로 이연
- `Step 11.6 plan §6` (가정) T1~T4 가 mock D1 사용 → production SQL 트리거 동작 검증 0건

**왜 critical 인가:**

1. **partial UNIQUE INDEX 의 NULL 행 제외 동작 미검증:** `migrations/0016:46-48` — `CREATE UNIQUE INDEX ... WHERE batch_run_id IS NOT NULL`. SQLite partial index 는 미묘하다 — `INSERT` 시 batch_run_id 가 NULL 인 row 가 동시에 같은 source_id 로 INSERT 될 수 있는지 (UNIQUE 미적용 검증) 확인 필요.
2. **0014 트리거 갱신 본문 검증 0건:** `migrations/0016:67-89` 트리거 WHEN 절에 `(OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id)` 추가. 이 본문이:
   - NULL → 값 backfill UPDATE 1회 ALLOW 검증 0건
   - 값 → 다른 값 UPDATE ABORT 검증 0건
   - 값 → NULL UPDATE ABORT 검증 0건
   - 기존 본문 컬럼 (name/description/page_ref) UPDATE 여전히 ABORT 회귀 검증 0건
3. **0014 → 0016 트리거 swap race:** `DROP TRIGGER IF EXISTS prevent_knowledge_nodes_update; CREATE TRIGGER ...` 사이에 다른 connection 이 UPDATE 시도 시 트리거 부재 윈도우 — race 검증 0건. SQLite 단일 writer 가정으로 이론상 안전하나 wrangler d1 local 검증 의무.
4. **ALTER TABLE 후 컬럼 존재 검증 0건:** SQLite 는 동일 컬럼 ADD 시 에러. 0016 재실행 시 멱등성 부재 검증 — `IF NOT EXISTS` 누락 (`ADD COLUMN` 은 SQLite 에서 IF NOT EXISTS 미지원). 재시작 안전성 검증 0건.

**의무 테스트 케이스 (P0 7건):**

1. 0016 적용 후 `PRAGMA table_info(knowledge_nodes)` → batch_run_id, source_id 컬럼 존재
2. 0016 적용 후 `PRAGMA index_list(knowledge_nodes)` → idx_knowledge_nodes_batch_source 존재 + partial=1
3. batch_run_id NULL row 2개 동일 source_id INSERT → 2 rows OK (partial 동작)
4. batch_run_id 값 row 2개 동일 source_id 동일 batch_run_id INSERT → UNIQUE 위반 ABORT
5. UPDATE knowledge_nodes SET batch_run_id = 'BATCH-1' WHERE batch_run_id IS NULL — ALLOW (1회 backfill)
6. UPDATE knowledge_nodes SET batch_run_id = 'BATCH-2' WHERE batch_run_id = 'BATCH-1' — ABORT (Hard Rule 1)
7. UPDATE knowledge_nodes SET name = 'changed' WHERE id = ... — ABORT (회귀, 0014 본문 보존 검증)

**P1 추가 케이스 (2건):** 8. 0016 재실행 (멱등성) — `ALTER TABLE ADD COLUMN` 두 번째 실행 시 SQL error 캡처 + 마이그레이션 재시작 안전성 가이드 명시 9. 0014 → 0016 마이그레이션 순서 보장 — 0014 적용 없이 0016 단독 실행 시 트리거 DROP 의 ENOENT 동작 검증

**AC 매핑:** AC-RP-6 (신규) — 0016 e2e 의무.

---

### CRITICAL-Q4: `source_id` 결정성 검증 부재 + draft-loader.ts 미연결 — Silent Pivot 가능성

**증거:**

- `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md:52` — `source_id = {page_ref}#{node_id}` 정의 명시 (v1.1 정정 본문)
- `apps/batch/src/loader/draft-loader.ts:244-249` — knowledge_nodes INSERT 문에 batch_run_id / source_id **미주입** (현재 컬럼 12개에 두 신규 컬럼 부재)
- `apps/batch/src/loader/draft-loader.ts:267` — `ctx.batchId` 만 binding (batch_id 컬럼). batch_run_id 별도 미주입.
- 따라서 0016 적용 후에도 draft-loader 는 NULL 값으로만 INSERT — partial UNIQUE INDEX 가 NULL 제외 → **Idempotency 실효 0%**
- `draft-loader.ts:221, 227, 297` — `edges.source_id` 변수명이 그래프 엣지의 _source node id_ 의미로 이미 사용 중. plan v1.1 의 idempotency `source_id` 와 **이름 충돌 — 코드 작성자 혼동 위험.**

**왜 critical 인가:**

1. **Silent Pivot:** plan v1.1 본문에 정의가 명시되었으나 코드는 v1.0 그대로. 컬럼은 추가되었지만 사용 X — "기획과 다르게 구현하면 인간에게 보고" CRITICAL RULE #1 위반의 시작점. Step 5 코드 진입 시점에 draft-loader 수정 없이 진행하면 0016 마이그레이션이 dead code (NULL 만 채워지는 컬럼).
2. **결정성 검증 부재:**
   - `{page_ref}#{node_id}` 가 정말 결정성인가? `pageRefString(node.source_page)` 가 동일 입력에 동일 출력? source_page 가 number → string 변환 시 padStart 정확성?
   - 동일 PDF + 동일 파서 100회 → 동일 source_id 집합 검증 0건 (AC-RP-7 정의는 있으나 테스트 코드 부재)
3. **이름 충돌 디버깅 비용:** `edges.source_id` (그래프 엣지 의미) vs `knowledge_nodes.source_id` (idempotency 의미) — 같은 패키지 내 동일 이름 두 의미. 6개월 후 디버거가 stack trace 에서 `source_id` 키 보면 어떤 의미인지 즉시 식별 불가. **개명 권고 — `nodes.idempotency_key` 또는 `nodes.lineage_id` 등.** 권고 채택 안 하더라도 plan v1.1 + draft-loader 주석에 **이름 충돌 명시 의무.**

**의무 테스트 케이스 (P0 5건):**

1. draft-loader 수정 후 INSERT SQL 의 컬럼 목록에 batch_run_id, source_id 포함 검증 (text grep 또는 prepared statement 캡처)
2. 동일 KnowledgeContract → 100회 적재 → source_id 집합 100% 일치 검증
3. 동일 page_ref + 다른 node_id → 다른 source_id 검증
4. 다른 page_ref + 동일 node_id → 다른 source_id 검증 (`{page_ref}#{node_id}` 의 결정성 분리)
5. page_ref NULL 시나리오 (source_page 미주입 노드) → source_id 생성 정책 명문화 + 테스트 (`null#NODE-001` 인가? `0#NODE-001` 인가? throw 인가?)

**P1 추가 케이스 (1건):** 6. 적재 완료 후 `SELECT COUNT(*) FROM knowledge_nodes WHERE source_id IS NULL AND batch_run_id IS NOT NULL` = 0 검증 (AC-RP-7 본문)

**AC 매핑:** AC-RP-7 (신규) — source_id 결정성 의무. **draft-loader.ts 코드 미연결이 핵심 결함.**

---

### CRITICAL-Q5: 137 PASS 의 회귀 의미 stale — "회귀 0건"이 정정 의도 검증 0%

**증거:**

- 사전 검증 정보: "137/137 tests PASS (회귀 0건)"
- 회귀 의미:
  - examId 주입 path: 137 PASS 중 8건만 주입 (recover.test.ts), 모두 동일 examId.
  - exam_id optional path: 0건 의도 검증 (모든 buildCheckpoint 호출이 examId 미주입).
  - 0016 트리거 path: 0건 (마이그레이션 SQL 실행 자체가 테스트 외).
  - source_id 결정성: 0건 (draft-loader 미연결).
- **즉 137 PASS 가 정정 코드의 신규 분기 0% 검증.** 회귀 0건 = "기존 코드 깨지지 않음" 만 보장.

**왜 critical 인가:**

1. "회귀 0건 = 안전" 가정은 직전 CRITICAL RULE #4 ("출력물 직접 확인 후에만 완료") 위반. 정정 코드의 출력물 = 신규 분기 동작. 신규 분기 미실행 = 출력물 미확인 = "완료" 선언 불가.
2. 직전 quality 페르소나 (`midpoint-20260428-p0fix-quality.md` §7.1 반론 2) 가 동일 패턴 명시: "137 PASS 가 정정 코드 0줄을 검증한다는 건 정정의 '정상 동작' 이 아니라 '에러 없는 import' 만 검증." → 본 정정에서 **동일 결함 재발.**
3. **반복 패턴 = 시스템 결함:** 5-페르소나 → P0 정정 1차 → P0 정정 2차 (본 BC1+BC2) → 매 정정마다 "회귀 0건 PASS" 보고 + 신규 분기 0건. 패턴 단절 의무 — 본 정정에서 **신규 의무 테스트 작성 후 PASS 의 의미를 "138+ PASS 중 신규 N건이 신규 분기 N건을 검증" 으로 명시.**

**의무:**

- 137 → 137 + ≥18 (CRITICAL-Q1~Q4 의 P0 합계) = **≥155 PASS** 도달 후 회귀 0건 의미 회복
- 회귀 보고 양식 변경: "N PASS / 신규 M PASS / 신규 분기 K개 검증" 으로 분해 보고 의무

**AC 매핑:** AC 매트릭스 전체 stale 회복 의무.

---

## 3. MAJOR — 중간 비용 (3건)

### MAJOR-Q1: 5-페르소나 §3.2 시간 추정의 underestimate 패턴 재발

**증거:**

- 직전 5-페르소나 통합 §3.2: "0.5d 작업"
- 직전 quality §7.3 (`midpoint-20260428-p0fix-quality.md`): "실제 의무 = 25시간 ≈ 3d, 0.5d 이연은 8배 underestimate"
- 본 BC1+BC2 정정의 후보 B 절충 = 즉시 정정 + Step 11.6 코드 구현 시 e2e 테스트 흡수
- 본 리뷰의 의무 테스트: ≥18 케이스 (Q1 4 + Q2 5+3 + Q3 7+2 + Q4 5+1 = 27, 그 중 P0 21 + P1 6)

**왜 major:**

1. "Step 11.6 e2e 흡수" 권고 = 0.5d 추정의 갱신본. 본 리뷰의 21 P0 케이스만 ≈ 1.5d (1 케이스당 30분 평균). 이미 3배 underestimate.
2. underestimate 자체가 시스템 결함의 신호 — "기획에서 검증 비용을 일관되게 낮게 잡는다" 패턴 = Reality Anchor (CRITICAL RULE #6) 부재.

**완화:**

- 본 리뷰 후 시간 보정: 0.5d → **1.5~2.0d** (e2e 의무 흡수 반영)
- 5-페르소나 통합 보고서에 "추정 보정 패턴 — Reality Anchor 적용" 항목 추가

---

### MAJOR-Q2: `staleLockThresholdMs` 임계 보정 검증 부재

**증거:**

- `apps/batch/src/recover.ts:130` — `const staleThreshold = opts.staleLockThresholdMs ?? STALE_LOCK_THRESHOLD_MS;`
- `apps/batch/__tests__/recover.test.ts:268-307` — stale lock 테스트는 `STALE_LOCK_THRESHOLD_MS` 기본값 (24h) 만 검증. `staleLockThresholdMs` 옵션 주입 path 0건.
- `apps/batch/src/recover.ts:148-151` — `Math.max(0, Date.now() - new Date(row.started_at).getTime())` clock skew 방어. 음수 elapsed 검증 0건.

**왜 major:**

- staleLockThresholdMs 옵션 자체가 "테스트 주입용" 으로 명시 (`recover.ts:120`) — 그러나 정작 옵션 주입 테스트 없음. 옵션 동작 미검증.
- clock skew 방어의 음수 path: `started_at` 이 미래일 때 (서버 시계 늦음) → elapsed 음수 → Math.max(0) 으로 0 보정 → 무조건 concurrent 판정. 이 동작이 의도인가? 테스트 부재로 의도 미명시.

**의무 테스트 케이스 (P1 2건):**

1. `staleLockThresholdMs: 1000` 주입 시 1.5초 후 stale 판정 검증
2. clock skew 시뮬레이션 (started_at 미래) → 음수 → 0 보정 → concurrent 판정 검증

---

### MAJOR-Q3: `assertCanonicalSafe` 9종 거부 + circular 검증 0건 (직전 Q-C1 그대로 stale)

**증거:**

- `apps/batch/src/checkpoint.ts:221-286` — assertCanonicalSafe 가 9종 + circular 거부 (BigInt/Function/Symbol/Date/Map/Set/WeakMap/WeakSet/Promise/TypedArray + circular)
- `apps/batch/__tests__/checkpoint.test.ts` — 거부 검증 grep 결과 5종 (직전 quality CRITICAL-Q1 명시) — 본 정정에서 미보완
- 직전 quality 페르소나 (`midpoint-20260428-p0fix-quality.md` §6) AC-Snapshot' (신규) — 0 검증 / CRITICAL stale

**왜 major (CRITICAL 아니라 본 BC1+BC2 정정의 직접 결함은 아니나 stale):**

- 본 정정 범위는 BC1 (knowledge_nodes 컬럼) + BC2 (BatchRunsDb examId). assertCanonicalSafe 9종 + circular 검증 부재는 직전 정정의 미해결 항목. 본 정정에서 신규 결함은 아니나 **AC 매트릭스에 그대로 살아있는 CRITICAL.**
- 본 BC1+BC2 정정 시 같이 보완할 기회였는데 미흡수.

**의무 테스트 케이스 (P0 — 직전 권고 유지, 본 리뷰에서 stale 명시):**

- 직전 `midpoint-20260428-p0fix-quality.md` §8 권고 13 케이스 그대로 유지
- 본 리뷰의 의무 18 케이스와 합산 시 ≥31 케이스 추가

---

## 4. MINOR — 사소한 부채 (2건)

### MINOR-Q1: mock 의 `selectByRunId` 가 examId 비교 분기 부재 — assertion 의도 약함

**증거:**

- `apps/batch/__tests__/recover.test.ts:73` — `return currentRow && currentRow.batch_run_id === batchRunId ? currentRow : null;`
- examId 무시 → cross-tenant 시뮬레이션 시 mock 이 잘못된 row 반환

**완화:** mock 을 `currentRow.batch_run_id === batchRunId && _examId === testExamId` 로 강화 (CRITICAL-Q1 의무 테스트 일부에 통합)

---

### MINOR-Q2: 0016 마이그레이션 주석에 "Step 11.6 코드 진입 + Step 5 재현성/Idempotency 테스트 진입 전에 본 마이그레이션 의무" 명시되었으나 실행 순서 게이트 부재

**증거:**

- `migrations/0016_knowledge_nodes_batch_idempotency.sql:11-12` — 의무 명시
- 실제 실행 게이트: 마이그레이션 numeric prefix (0016) 만 신뢰. CI 에서 0014 / 0015 / 0016 연속 실행 검증 부재.
- 5-페르소나 devops 가 분석할 영역 — quality 페르소나는 "CI 검증 의무 명시" 만 권고

**완화:** Step 11.6 plan §5 (가정) Pre-flight check 에 "0014~0016 마이그레이션 적용 검증" 항목 추가

---

## 5. AC 매트릭스 갱신 (본 정정 후)

직전 `midpoint-20260428-p0fix-quality.md` §6 의 AC 매트릭스에 본 변경의 영향 추가:

| AC                   | 정의                                  | unit          | integration          | e2e          | 상태 (본 정정 후)                               |
| -------------------- | ------------------------------------- | ------------- | -------------------- | ------------ | ----------------------------------------------- |
| AC-1                 | BATCH 정상 흐름                       | 보유          | 보유 (pipeline.test) | 미보유       | OK                                              |
| AC-R1                | OOM 부활                              | mock PASS     | mock PASS            | **미검증**   | **GAP** (B-C3 잔존)                             |
| AC-R2                | 변조 감지                             | PASS          | PASS                 | mock         | OK                                              |
| AC-R3                | already_completed                     | mock          | mock                 | **미검증**   | **GAP** (B-C3 잔존)                             |
| AC-R4                | concurrent < 24h                      | mock          | mock                 | **미검증**   | **GAP**                                         |
| AC-R5                | version mismatch                      | PASS          | mock                 | mock         | OK                                              |
| AC-R6                | stale 24h+                            | mock          | mock                 | **미검증**   | **GAP** (B-C3 잔존)                             |
| AC-Cost              | cost_state 직렬화                     | **0 (R-C1)**  | 미수립               | 미수립       | **CRITICAL** (직전 그대로)                      |
| AC-Snapshot          | canonical 5종 거부                    | 5종 PASS      | —                    | —            | **stale**                                       |
| AC-Snapshot'         | canonical 9종+circular 거부           | **0 (Q-C1)**  | —                    | —            | **CRITICAL** (직전 그대로 + 본 정정에서 미흡수) |
| AC-T3                | state transition matrix               | —             | —                    | **0 (B-C3)** | **CRITICAL** (직전 그대로)                      |
| **AC-ExamId (신규)** | examId 시그니처 + Year 2 cross-tenant | **0 (Q1+Q2)** | **0**                | **0**        | **CRITICAL**                                    |
| **AC-RP-6 (신규)**   | 0016 마이그레이션 + 트리거 e2e        | **0 (Q3)**    | **0**                | **0**        | **CRITICAL**                                    |
| **AC-RP-7 (신규)**   | source_id 결정성 + draft-loader 연결  | **0 (Q4)**    | **0**                | **0**        | **CRITICAL**                                    |

**요약:**

- 본 정정 후 14개 AC 중 6 GAP, **6 CRITICAL** (이전 3 → 6, 본 정정으로 3개 신규 CRITICAL 추가)
- 직전 정정 후의 CRITICAL 3건 (AC-Cost / AC-Snapshot' / AC-T3) 은 그대로 살아있음
- 본 정정으로 AC-ExamId / AC-RP-6 / AC-RP-7 신규 CRITICAL 3건 추가
- **AC 매트릭스 자체가 점점 stale — 정정 산출물의 검증이 따라가지 못함**

---

## 6. Devil's Advocate — "테스트 통과한 코드가 production 에서 깨질 시나리오" (3건)

### 6.1 시나리오 1: Year 2 Phase 4 마이그레이션 직후 첫 BATCH 실행 — Cross-tenant data leak

**상황:**

- 2027년 Year 2 Phase 4 진입. exam_id 컬럼 도입 0005 마이그레이션 적용. D1BatchRunsDb 내부에 `WHERE exam_id = ?` 추가.
- 손해평가사 BATCH-2 (in_progress) + 공인중개사 BATCH-2 (completed) 동시 존재.
- recover.ts 호출 시 examId='gong-in-jung-gae-sa' + batchRunId='BATCH-2' 주입.

**현재 137 PASS 가 검증 못 하는 동작:**

- mock 의 `selectByRunId(_examId, batchRunId)` 가 `_examId` 무시 → 손해평가사 row 반환 가능
- 그러나 production D1BatchRunsDb 는 `WHERE exam_id = ? AND batch_run_id = ?` → 공인중개사 row 만 반환
- **테스트 환경 mock 동작 ≠ production SQL 동작** = recover.ts 의 in_progress 분기 (line 147) 가 mock 에선 손해평가사 in_progress 보고 → "concurrent" 판정 / production 에선 공인중개사 completed 보고 → "already_completed" 판정.
- 결과: production 첫 실행 시 unexpected behavior. 디버깅 시 mock 이 잘못된 reference 라 더 큰 혼란.

**방어:** CRITICAL-Q1 의무 테스트 케이스 #3 (다른 examId 의 동일 batch_run_id 시뮬레이션).

---

### 6.2 시나리오 2: source_page = null 인 노드 적재 시 source_id 충돌 (Phase 1 후반)

**상황:**

- `KnowledgeContract` 의 일부 node 가 `source_page` 미주입 (e.g., 일반 개념 노드, 페이지 매핑 안 된 ontology entry).
- 100개 노드 중 5개가 `source_page = null` 상태로 적재.
- `source_id = '{page_ref}#{node_id}'` — pageRefString(null) = ? (현재 draft-loader.ts:373 함수 미확인 — null 입력 시 동작 미정의 가능성)
- 5개 노드 모두 `source_id = 'null#CONCEPT-XXX'` or `0#CONCEPT-XXX` 또는 throw 가능.
- 다른 BATCH 에서 동일 5개 노드 재적재 시 → partial UNIQUE INDEX 가 (BATCH-1, null#CONCEPT-001) 와 (BATCH-2, null#CONCEPT-001) 을 다른 batch_run_id 라 통과 → 의도 OK.
- 그러나 동일 BATCH 내 동일 CONCEPT-XXX 가 두 page (혹은 page=null + page=10) 로 진입 → source_id 가 '0#CONCEPT-001' / '10#CONCEPT-001' 다름 → 동일 노드 중복 INSERT.
- **idempotency key 의 결정성이 page_ref 없는 entity 에서 깨짐.**

**현재 137 PASS 가 검증 못 하는 동작:**

- draft-loader.ts:266 — `pageRefString(node.source_page)`. source_page null / undefined / 0 / negative 시 어떤 string 반환하는지 검증 0건.
- AC-RP-7 정의 "동일 PDF + 동일 파서 + 동일 ontology → 동일 source_id" 는 page_ref 결정성을 전제 — page_ref 자체가 비결정성이면 source_id 도 비결정성.

**방어:** CRITICAL-Q4 의무 테스트 케이스 #5 (page_ref NULL 정책 명문화 + 테스트).

---

### 6.3 시나리오 3: Checkpoint write 도중 process kill — exam_id 일관성 깨짐

**상황:**

- writeCheckpoint() 도중 process kill (e.g., Cloudflare Workers CPU timeout, OOM).
- 임시 파일 (tmpPath) 까지는 쓰여졌으나 rename 전 종료.
- recover 시 readCheckpoint 가 (rename 안 된) tmp 파일 무시 → CheckpointNotFoundError → no_checkpoint path → 처음부터 재시작.
- **그러나** 동일 batch_run_id 의 batch_runs row 는 exam_id (Year 2) 와 함께 in_progress 상태 — recover 시 examId 주입 path 가 row 검색.
- examId 가 미일치 (예: examId='gong-in-jung-gae-sa' 이나 row 의 exam_id='son-...') → row null 반환 → no_checkpoint path 진입.
- 처음부터 재시작 = 새 batch_run_id 생성? 또는 기존 batch_run_id 재사용?
- 본 정정의 examId 분기는 mock 이라 검증 0건 — production 시나리오 불명.

**현재 137 PASS 가 검증 못 하는 동작:**

- writeCheckpoint 의 fsync 부재 (`checkpoint.ts:316-319` 본문 명시) — power loss 0바이트 파일 가능성. 0바이트 파일 → JSON.parse 실패 → CheckpointCorruptedError → recovery_failed (manual_review_required). 정상 path.
- **그러나 examId mismatch + 0바이트 file 동시 발생 시:** recover.ts:133 의 selectByRunId 가 null 반환 → row=null → readCheckpoint 의 CheckpointNotFoundError 분기로 진입 (line 174) → no_checkpoint. **실제로는 corrupted 인데 not_found 보고** = 진단 오류.

**방어:** AC-T3 (state transition matrix) e2e 테스트 + writeCheckpoint fsync 도입 (Step 11.6 plan §6 본문 명시되었으나 검증 항목 부재).

---

## 7. 진행 권고 + 신규 테스트 케이스 우선순위

### 진행 권고: **reject_and_revise.** Step 11.6 코드 진입 BLOCK + 본 리뷰의 P0 18 케이스 + 직전 quality 페르소나 P0 13 케이스 = ≥31 케이스 선행 의무.

순서:

1. **plan v1.1 보강** (AC-ExamId 신규 명시 + AC 매트릭스 갱신) — 0.25d
2. **draft-loader.ts 수정** (Step 5 plan v1.1 source_id 정의 코드 반영 + INSERT 컬럼 목록에 batch_run_id, source_id 추가 + 이름 충돌 주석 명시) — 0.5d
3. **신규 단위 테스트 작성** (CRITICAL-Q1 examId 분기 4 + CRITICAL-Q2 exam_id optional 5 + CRITICAL-Q4 source_id 결정성 5) = 14 케이스 — 1.0d
4. **0016 마이그레이션 e2e 테스트** (CRITICAL-Q3 7 + better-sqlite3 setup) = 7 케이스 — 0.75d
5. **직전 quality 페르소나 §8 권고 13 케이스 흡수** (R-C1 6 + Q-C1 13 + B-C3 6 — 부분 중복 제거 시 ≈ 13 추가) — 1.0d
6. **회귀 보고 양식 변경** (CRITICAL-Q5 — "N PASS / 신규 M / 신규 분기 K" 분해) — 0.25d
7. **그 다음** Step 11.6 plan §3 진입

**총 추가 의무: 약 3.75d** (직전 quality 페르소나 권고 2.25d + 본 리뷰 추가 1.5d).

§3.2 의 "0.5d 이연" 기준선 → 본 리뷰의 3.75d = **7.5배 underestimate.** Reality Anchor 적용 시점.

---

### 신규 테스트 케이스 우선순위 매트릭스 (본 리뷰 P0 18 + P1 6 = 24건)

| ID     | CRITICAL | 케이스                                                   | 우선순위 |
| ------ | -------- | -------------------------------------------------------- | -------- |
| Q1-T1  | Q1       | selectByRunId examId spy 검증                            | P0       |
| Q1-T2  | Q1       | updateState examId spy 검증                              | P0       |
| Q1-T3  | Q1       | cross-tenant 시뮬레이션 (다른 examId 동일 batchRunId)    | P0       |
| Q1-T4  | Q1       | examId 미주입 ts-expect-error 검증                       | P0       |
| Q2-T1  | Q2       | examId 주입 buildCheckpoint result.exam_id 검증          | P0       |
| Q2-T2  | Q2       | examId 미주입 buildCheckpoint result.exam_id===undefined | P0       |
| Q2-T3  | Q2       | examId 주입/미주입 state_hash 다름 검증                  | P0       |
| Q2-T4  | Q2       | 동일 examId 100회 state_hash 일치 검증                   | P0       |
| Q2-T5  | Q2       | 다른 examId 두 checkpoint state_hash 다름 검증           | P0       |
| Q2-T6  | Q2       | exam_id 미주입 round-trip                                | P1       |
| Q2-T7  | Q2       | exam_id 주입 round-trip                                  | P1       |
| Q2-T8  | Q2       | exam_id 변조 → CheckpointCorruptedError                  | P1       |
| Q3-T1  | Q3       | 0016 컬럼 존재 PRAGMA                                    | P0       |
| Q3-T2  | Q3       | 0016 partial INDEX 존재 + partial=1                      | P0       |
| Q3-T3  | Q3       | NULL row 동일 source_id 2건 INSERT OK                    | P0       |
| Q3-T4  | Q3       | 값 row 동일 source_id 동일 batch_run_id ABORT            | P0       |
| Q3-T5  | Q3       | NULL→값 backfill UPDATE ALLOW                            | P0       |
| Q3-T6  | Q3       | 값→다른값 UPDATE ABORT                                   | P0       |
| Q3-T7  | Q3       | 본문 컬럼 UPDATE 회귀 ABORT                              | P0       |
| Q3-T8  | Q3       | 0016 재실행 멱등성 가이드                                | P1       |
| Q3-T9  | Q3       | 0014→0016 순서 보장                                      | P1       |
| Q4-T1  | Q4       | INSERT SQL 컬럼 목록 검증                                | P0       |
| Q4-T2  | Q4       | 동일 contract 100회 source_id 집합 일치                  | P0       |
| Q4-T3  | Q4       | page_ref 다름 → source_id 다름                           | P0       |
| Q4-T4  | Q4       | node_id 다름 → source_id 다름                            | P0       |
| Q4-T5  | Q4       | source_page null 정책 (정의+테스트)                      | P0       |
| Q4-T6  | Q4       | source_id NULL row 0건 검증 (적재 후)                    | P1       |
| MQ2-T1 | MAJOR-Q2 | staleLockThresholdMs 옵션 주입 검증                      | P1       |
| MQ2-T2 | MAJOR-Q2 | clock skew 음수 elapsed 동작                             | P1       |

**P0 합계:** 18건. **P1 합계:** 9건. **총:** 27건. (직전 quality 페르소나 권고 13건 일부 중복 제외 시 합산 약 35~38건 신규.)

---

## 8. 판정

**reject_and_revise.**

근거 요약:

1. backend C-1 / C-2 정정의 시그니처 / 컬럼 / 트리거 갱신은 정확하나 **검증 의무 미흡수** (137 PASS 가 신규 분기 0% 검증)
2. **draft-loader.ts 가 Step 5 plan v1.1 정의를 미반영** — Silent Pivot 가능성 (CRITICAL-Q4)
3. AC 매트릭스의 CRITICAL 6건 (직전 3 + 본 정정 신규 3) — Step 11.6 진입 차단 의무
4. 시간 추정 패턴 (0.5d → 3.75d, 7.5배 underestimate) — Reality Anchor 적용 시점
5. **회귀 0건의 의미 stale** (CRITICAL-Q5) — 보고 양식 변경 의무

**Step 11.6 코드 진입 전 의무:**

- 본 리뷰 P0 18건 + 직전 quality 페르소나 P0 13건 = **≥31건 신규 테스트 작성**
- draft-loader.ts 수정 + plan v1.1 보강
- 회귀 보고 양식 변경 ("N PASS / 신규 M / 신규 분기 K" 분해)

**예상 추가 기간:** 3.75d (§3.2 의 0.5d × 7.5배). 그러나 Step 11.6 통합 후 결함 발견 비용 (cross-tenant data leak / Silent Pivot 발견 + plan revision) 이 8d+ 임을 고려하면 net 절감.

---

**리뷰 산출물 path:** `/home/soo/ClaudePro/ThePick/.claude/reviews/review-20260428-200211-bc1bc2-step5-examid-quality.md`
