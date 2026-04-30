# P0 CRITICAL 정정 4-Pass — System Architecture 관점

**검토 대상:** R-C1 (`apps/batch/src/cost-meter.ts:30, 330-361`) + Q-C1 (`apps/batch/src/checkpoint.ts:188-272`) + B-C3 (`migrations/0015_batch_runs.sql:60-82`)
**상위 보고서:** `.claude/reports/engine-hardening-midpoint-20260428-synthesis.md`
**관계 plan:** `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` v1.0 APPROVED
**검토 시각:** 2026-04-28 (KST)
**검토자:** Claude (Opus 4.7) — System Architect 페르소나 (silent-failure / quality 영역 침범 차단)

---

## 1. 한 줄 평가

> **accept_with_caveats** — 3건의 정정 모두 모듈 결합도 / 인터페이스 호환성 / 트리거 상호작용 차원에서 시스템 정합성을 해치지 않는다. 단 (a) Step 11.6 plan v1.0 §4.3.4 의 `extractCostState(meter)` helper 가 본 R-C1 의 `meter.toCheckpointCostState()` 인스턴스 메서드로 진화한 사실은 **plan v1.1 정정 의무**를 발생시키며, (b) 0015 마이그레이션의 트리거 이름 변경 (`*_recover_only_from_terminal` → `*_recover_only_from_non_completed`) 은 production 진입 시 **idempotency 가드 한 줄** 추가가 필요하다.

---

## 2. CRITICAL

**0건.**

3건 모두 다음 조건을 모두 만족하여 코드 진입 절대 차단급 결함은 없다:

- 모듈 import 그래프 단방향 유지 (cost-meter → checkpoint, 역방향 부재)
- `BatchCheckpoint.cost_state?` optional 필드와 `CheckpointCostState` 인터페이스 type-shape 정합
- 트리거 3개 (0014 prevent*knowledge_nodes_update, 0015 trg*_*no_state_downgrade, 0015 trg*_\_recover_only_from_non_completed) 의 발화 영역 비충돌
- 시험 도메인 커플링 0 도입 (UKE 비전 §11.4 "universal engine" 정합)

---

## 3. MAJOR

### M1 — Step 11.6 plan v1.0 §4.3.4 extractCostState helper 와 R-C1 인스턴스 메서드 의 시그니처 불일치

**증거 위치:** `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:527-535` vs `apps/batch/src/cost-meter.ts:351-361`

**plan v1.0 가정:**

```typescript
function extractCostState(meter: CostMeter): CheckpointCostState {
  return {
    initial_spend_usd: meter.getInitialSpendUsd(),
    call_count: meter.getCallCount(),
    threshold_breaches: meter.getThresholdBreaches(),
  };
}
```

**실제 R-C1 구현:**

- `meter.toCheckpointCostState()` 인스턴스 메서드 (free function 아님)
- `getInitialSpendUsd()` / `getCallCount()` / `getThresholdBreaches()` 3 getter 미구현 (R-C1 통합 정정으로 인스턴스 메서드 1개로 흡수)

**아키텍처 영향:** plan §3.3 의 `runPipeline` 흐름에서 `extractCostState(ctx.costMeter)` 호출이 컴파일 에러 발생. plan v1.0 의 `extractCostState` 호출 5곳 모두 `ctx.costMeter.toCheckpointCostState()` 로 교체 필요. plan v1.1 정정 의무 발생.

**판정:** MAJOR — plan 문서 정정만 필요, 본 R-C1 코드 자체는 **더 정합한 설계**. (encapsulation 향상: caller 가 CostMeter 내부 상태에 3 getter 로 분리 접근하는 대신, 단일 직렬화 메서드로 통합 — Tell, Don't Ask 원칙 정합)

### M2 — 0015 트리거 이름 변경의 idempotency 가드 부재

**증거 위치:** `migrations/0015_batch_runs.sql:77` (현재 이름 `trg_batch_runs_recover_only_from_non_completed`)

5-페르소나 보고서 §2.1 B-C3 항목과 메타 감사 검증에서 트리거 이름이 `trg_batch_runs_recover_only_from_terminal` → `trg_batch_runs_recover_only_from_non_completed` 로 변경됨. SQLite `CREATE TRIGGER IF NOT EXISTS` 는 **이름 기반** idempotency — 옛 이름이 이미 deploy 된 환경에서는:

1. `CREATE TRIGGER IF NOT EXISTS trg_*_non_completed` 만 실행됨 (NEW 이름)
2. 옛 이름 `trg_*_terminal` 은 그대로 잔존
3. **옛 트리거의 OLD WHEN 조건** (`OLD.state NOT IN ('killed', 'failed')`) 이 stale 24h+ in_progress 정상 recover 경로를 ABORT — 결함 재발

**현재 환경 상태 (git status 검증):** `migrations/0015_batch_runs.sql` 가 **untracked 파일** (새 마이그레이션, 아직 deploy X). 따라서 즉시 위험 0. 단:

- production 진입 시 `DROP TRIGGER IF EXISTS trg_batch_runs_recover_only_from_terminal;` 한 줄 0015 상단에 추가 의무 (defensive idempotency)
- 또는 (더 안전): 트리거 이름 유지 + 본문만 보정 (이번 정정의 의도는 본문 보정)

**판정:** MAJOR — 현재 deploy 안 된 untracked 상태라 즉시 위험 X. Step 11.6 코드 진입 전 0015 에 idempotency drop 한 줄 추가 권고. plan §6 (D1 Preview 통합 검증) 의 AC-R6 4건 시나리오에 "신구 트리거 양쪽 존재 시나리오" T5 추가 권고.

### M3 — Engine boundary 위치 — cost-meter ↔ checkpoint 결합 강화의 도메인 정합

**증거 위치:** `apps/batch/src/cost-meter.ts:23` (의존성 docstring) + `apps/batch/src/checkpoint.ts:60-68` (CheckpointCostState 정의 위치)

cost-meter 의 도메인 위치 판정:

- **Engine boundary**: BATCH 파이프라인 실행 회계 → checkpoint flush hook → recover 시 initialSpend 인계. 모두 BATCH lifecycle 의 **내부** 메커니즘.
- **Service boundary가 아님**: 결제/billing 시스템과 외부 API 가 없음. Anthropic Console monthly cap (Layer 2) 은 ADR-025 §2.4 명시 외부 → 본 모듈 무관.

→ cost-meter 와 checkpoint 모두 **동일 Engine boundary** 내부. 본 R-C1 의 결합 강화 (cost-meter → checkpoint type import) 는 **Engine 내부 응집도 강화** 로 해석. UKE 비전 §11.4 "universal engine" 의 단일 boundary 응집 정합.

**다만 우려:** `CheckpointCostState` 의 정의 위치가 `checkpoint.ts:60-68` 인 것이 비대칭. cost-meter 가 정의의 source 인 의미론적 책임자인데, 정의가 checkpoint 에 위치 → cost-meter 가 자신의 직렬화 형태를 checkpoint 에서 import 해야 함.

**대안 비교:**

- (A) 현재: `CheckpointCostState` 가 checkpoint.ts 에 정의 — checkpoint 가 모든 직렬화 shape 의 단일 진실 (현재 채택, 정합)
- (B) cost-meter.ts 에 정의 + checkpoint.ts 가 import — 책임자가 정의 (대안)

(A) 가 더 정합한 이유: `BatchCheckpoint` 가 `cost_state?` 필드를 자신의 shape 의 일부로 owning 하므로, checkpoint 가 shape 정의의 source. cost-meter 는 변환 책임만 보유. **현재 설계 정합.**

**판정:** MAJOR — 정합 판정이지만 cost-meter docstring (line 23) 에 "checkpoint.ts 가 CheckpointCostState shape 의 source, cost-meter 는 변환 책임만" 명시 권고. 향후 새 entrant 가 정의 위치를 헷갈리지 않도록.

### M4 — `assertCanonicalSafe` 의 `over-engineering` 가능성 (Symbol/Promise/TypedArray 9종 거부)

**증거 위치:** `apps/batch/src/checkpoint.ts:207-272`

Q-C1 의 9종 거부가 실제 `BatchCheckpoint` shape 에서 발생 가능한 타입과의 정합:

| 거부 타입       |                                 BatchCheckpoint 에서 발생 가능?                                  |     defense in depth 의도      |
| :-------------- | :----------------------------------------------------------------------------------------------: | :----------------------------: |
| bigint          |                                ❌ (모든 number 필드는 USD/count)                                 |           ✅ 안전망            |
| function        |                                       ❌ (함수 필드 없음)                                        |           ✅ 안전망            |
| symbol          |                                           ❌ (사용 X)                                            |           ✅ 안전망            |
| Date            |                 ⚠️ (timestamp 필드는 ISO string 의무 — Date instance 혼입 가능)                  |       ✅ **실효성 있음**       |
| Map/Set         |                       ⚠️ (개발자가 stage_results 를 Map 으로 만들 수 있음)                       |       ✅ **실효성 있음**       |
| WeakMap/WeakSet |                                           ❌ (사용 X)                                            |           ✅ 안전망            |
| Promise         |                                   ⚠️ (await 누락 시 혼입 가능)                                   |       ✅ **실효성 있음**       |
| TypedArray      | ⚠️ (PDF Buffer 가 pipeline_state_snapshot 에 누설될 가능성 — pdfPages 같은 외부 라이브러리 객체) | ✅ **실효성 있음 (가장 중요)** |
| circular ref    |                      ⚠️ (PipelineState 가 내부에 양방향 참조 만들 수 있음)                       |       ✅ **실효성 있음**       |

**판정:** MAJOR — 9종 중 5건이 실제 BatchCheckpoint shape 에서 발생 가능, 4건은 defense in depth. **합리적 안전망**. 다만 plan §3.2 의 `toSnapshot()` 변환 함수가 "직렬화 가능한 부분만 추출" 책임이므로, `toSnapshot()` 에서 이미 거부 9종이 누락되도록 보장하는 것이 1차 방어선. `assertCanonicalSafe` 는 2차 방어선으로 정합.

→ Step 11.6 plan §3.2 `toSnapshot()` 구현 시 `state.contract` / `state.loadResult` 같은 명시 추출 필드 외에는 snapshot 에 포함하지 않는 패턴 유지 의무 명시 권고.

---

## 4. MINOR

### m1 — `CheckpointCostState.threshold_breaches` 의 anonymous inline type

**증거 위치:** `apps/batch/src/checkpoint.ts:63-67`

```typescript
readonly threshold_breaches: readonly {
  readonly threshold: 'soft_warn' | 'hard_throttle' | 'kill_switch';
  readonly at_spend_usd: number;
  readonly at_ratio: number;
}[];
```

inline type 으로 정의 — 별도 `CheckpointThresholdBreach` interface 추출 시 가독성 향상 + cost-meter 의 `ThresholdBreach` 와의 부분집합 관계가 명시적.

**현재 R-C1 매핑 (cost-meter.ts:355-359):**

```typescript
threshold_breaches: this.breaches.map((b) => ({
  threshold: b.threshold,
  at_spend_usd: b.at_spend_usd,
  at_ratio: b.at_ratio,
}));
```

**향후 위험:** `ThresholdBreach` 에 새 필드 추가 시 (예: `causation_chain_id` for tracing) 본 메서드는 자동으로 그것을 전파하지 않고 명시 매핑 필요. type-safe 하지만 누락 silent. TypeScript 의 "extra fields are allowed" 동작상 컴파일 에러 X — Pick<ThresholdBreach, 'threshold'|'at_spend_usd'|'at_ratio'> 패턴 적용 시 누락 검출 가능.

**판정:** MINOR — 현재 동작 정합. 향후 Step 11.6 plan v1.1 에서 다음 패턴 권고:

```typescript
type CheckpointThresholdBreach = Pick<ThresholdBreach, 'threshold' | 'at_spend_usd' | 'at_ratio'>;
```

이렇게 하면 `ThresholdBreach` 에 필드 추가 시 `CheckpointThresholdBreach` 가 자동 동기 + spread 매핑이 type-checked.

### m2 — `assertCanonicalSafe` 의 `visited` WeakSet nondeterminism 우려

**증거 위치:** `apps/batch/src/checkpoint.ts:254-261`

질문서 §5번 우려: "WeakSet iteration 순서 — 본 코드는 `has` 만 사용해 무관, 그러나 추가 점검 필요"

**검증:**

- Line 256 `seen.has(objValue)` — Set membership 검사 (순서 무관)
- Line 261 `seen.add(objValue)` — 추가 (순서 무관)
- Line 264 `value.forEach((v, i) => ...)` — Array iteration (Array 순서 보존, deterministic)
- Line 268 `Object.keys(...)` — **순서: insertion order (numeric keys then string keys)** — 그러나 `canonicalJson` (line 286) 에서 `.sort()` 적용으로 정렬됨
- WeakSet 자체는 iteration 미지원 — has/add/delete 만 사용 → nondeterminism 진입 경로 0

→ **결정성 보장.** state_hash 가 본 정정 전후 동일 input 에 대해 동일 hash 생성. 회귀 위험 0.

**판정:** MINOR — 안심 영역. 다만 cost-meter.ts:30 (`import type { CheckpointCostState } from './checkpoint.js'`) 의 `import type` 키워드가 runtime import 회피 — TypeScript 컴파일 후 `.js` 에 import 문이 남지 않음. cost-meter ↔ checkpoint 의 runtime 의존성은 0 (type-only). 모듈 결합도 가장 낮은 수준.

### m3 — 0015 트리거 3개 발화 우선순위 미명시

**증거 위치:** `migrations/0015_batch_runs.sql:40-82`

0015 에 트리거 3개:

1. `trg_batch_runs_no_duplicate_completed` BEFORE INSERT (40-49)
2. `trg_batch_runs_no_state_downgrade` BEFORE UPDATE OF state (54-59)
3. `trg_batch_runs_recover_only_from_non_completed` BEFORE UPDATE OF state (77-82)

**SQLite 트리거 발화 순서:** 동일 timing (BEFORE/AFTER) + 동일 event (UPDATE/INSERT) + 동일 column (state) 의 다중 트리거는 **CREATE TRIGGER 정의 순서** 또는 미정의 (구현 의존). 트리거 #2 와 #3 둘 다 BEFORE UPDATE OF state.

**중복 영역:** `'completed' → 'recovered'` 시도 시:

- 트리거 #2: `OLD.state = 'completed' AND NEW.state != 'completed'` → ABORT
- 트리거 #3: `NEW.state = 'recovered' AND OLD.state = 'completed'` → ABORT

→ **defense in depth 명시 의도** (line 75-76 주석 정합). 둘 중 어느 것이 먼저 발화해도 결과 동일 — recover 차단. 운영 가독성: 트리거 #3 의 메시지가 더 명확 ("cannot recover completed run") — 진산님이 ABORT 메시지를 보고 원인 빠르게 식별 가능.

**판정:** MINOR — 의도된 defense in depth. SQLite 트리거 순서가 미정의이지만 결과 결정성 보장 (둘 다 ABORT). 0015 에 "두 트리거 중 어느 것이 먼저 발화해도 같은 ABORT 결과" 주석 한 줄 추가 권고.

---

## 5. PASS 증거 (3건+)

### PASS-1: cost-meter ↔ checkpoint 단방향 의존성 검증

**확인 명령:**

```bash
grep -n "import.*checkpoint\|import.*cost-meter" apps/batch/src/{checkpoint,cost-meter,recover,pipeline}.ts
```

**결과:**

- `cost-meter.ts:30` — `import type { CheckpointCostState } from './checkpoint.js'` ✅
- `checkpoint.ts` — cost-meter 미import ✅ (역방향 의존성 0)
- `recover.ts:26-33` — checkpoint 만 import (cost-meter 무관) ✅

**아키텍처 영향:** Step 11.6 통합 시 양방향 의존성 위험 차단. checkpoint 는 cost-meter 의 존재를 모름 (느슨한 결합 유지). cost-meter 는 checkpoint 의 type 만 import (`import type` 키워드로 runtime 의존성 0).

**Engine boundary 응집 평가:** 두 모듈 모두 `apps/batch/src/` 하위 — 동일 Engine boundary. 결합 강화는 boundary 내부 결합으로 OK.

### PASS-2: BatchCheckpoint.cost_state? optional 필드와 CheckpointCostState 인터페이스 type-shape 정합

**확인 위치:** `apps/batch/src/checkpoint.ts:60-68, 90, 170` + `apps/batch/src/cost-meter.ts:351-361`

**검증:**

1. `BatchCheckpoint.cost_state?: CheckpointCostState` (line 90) — optional 필드
2. `CheckpointCostState` interface (line 60-68) 의 3 필드: `initial_spend_usd`, `call_count`, `threshold_breaches`
3. `toCheckpointCostState()` 반환 타입: `CheckpointCostState` (TypeScript 컴파일러가 type-check)
4. `buildCheckpoint` (line 170): `...(input.costState !== undefined ? { cost_state: input.costState } : {})` — optional 패턴 정합

→ `meter.toCheckpointCostState()` 반환 객체가 `BatchCheckpoint.cost_state` 자리에 그대로 들어감. Type-safe 보장.

**canonicalJson 직렬화 보장:** `canonicalJson(BatchCheckpoint)` 시 cost_state 필드의 키 정렬 + `threshold_breaches` 배열 내부 객체도 재귀 정렬 (checkpoint.ts:283-296). state_hash 결정성 보장.

### PASS-3: Q-C1 9종 거부의 BatchCheckpoint shape 적합성

**확인 위치:** `apps/batch/src/checkpoint.ts:41-93`

`BatchCheckpoint` 의 모든 필드 type 분석:

- `schema_version`: literal 1 — 거부 대상 X ✅
- `engine_name`/`engine_version`/`batch_run_id`/`timestamp`/`pipeline_stage`: string ✅
- `progress`: 4개 number ✅
- `pipeline_state_snapshot`: 자신도 plain object (`PipelineStateSnapshot`) — 재귀 검증 ✅
- `state_hash`: string ✅
- `pii_filtered`: literal true ✅
- `encryption`: literal 'none' ✅
- `cost_state?`: `CheckpointCostState` — 자신도 plain object (3 primitive 필드 + readonly array) ✅
- `depends_on?`: readonly array of plain object ✅

→ **정상 BatchCheckpoint 객체는 9종 거부에 hit 0건.** 거부 9종은 모두 "발생하면 silent collapse 차단" 안전망. `assertCanonicalSafe` 가 정상 흐름에 false-positive throw 0.

### PASS-4: 0015 트리거 vs 0014 prevent_knowledge_nodes_update 비충돌

**확인 위치:** `migrations/0014_phase05_critical_hardening.sql:34-52` + `migrations/0015_batch_runs.sql:전체`

**검증:**

- 0014 의 `prevent_knowledge_nodes_update` 는 `knowledge_nodes` 테이블 BEFORE UPDATE
- 0015 의 트리거 3개는 모두 `batch_runs` 테이블 (BEFORE INSERT/UPDATE)
- **테이블 영역 비교차** — 충돌 위험 0

**별도 확인:** B-C1 (Step 5 plan UNIQUE 가정 컬럼 부재) 는 `knowledge_nodes` 의 `(batch_run_id, source_id)` UNIQUE 제약 부재 + 0014 트리거가 backfill UPDATE 차단 — 본 P0 정정 3건 (R-C1/Q-C1/B-C3) 와 무관. **B-C1 은 P1 단계** (Step 5 plan 갱신 + 0016 마이그레이션) 에서 처리.

### PASS-5: Year 2 호환성 — 시험 도메인 커플링 0 도입 검증

**확인 위치:** 정정 3건 모두

- `cost-meter.ts:351-361` `toCheckpointCostState`: `examId` / 시험 도메인 리터럴 0건. universal cost accounting.
- `checkpoint.ts:188-272` `assertCanonicalSafe`: `examId` / 시험 도메인 리터럴 0건. universal serialization safety.
- `0015_batch_runs.sql`: `batch_runs` 테이블이 이미 BATCH 메타테이블 (시험별 분리 X) — Year 2 진입 시 `exam_id` 컬럼 추가는 별도 마이그레이션 책임. 본 정정 트리거는 universal state-machine 가드 (시험 비종속).

→ **UKE 비전 §11.4 정합** (universal engine + adapter pattern). Hard Rule 15 신규 코드 예외 미발생.

---

## 6. Devil's Advocate

### 시나리오 1 (가장 무거운 시나리오) — Step 11.6 통합 시 cost-meter 의 직렬화 형태가 향후 진화하면 BatchCheckpoint 의 `cost_state` 가 backward compatible 깨짐

**상황:** Phase 1 후반에 multi-batch parallel 진입. `CostMeter` 가 다음 진화:

- `per_model: Record<string, PerModelUsage>` 같은 모델별 비용을 `cost_state` 에 인계 의무 발생
- `CheckpointCostState` 에 `per_model?` 필드 추가 의무

**위험:** 본 정정 시점의 checkpoint 파일이 Phase 1 후반에 read 되면:

- `per_model` 부재 → `undefined` 가 들어감
- `assertCanonicalSafe` 는 `undefined` 통과 (line 212) ✅
- runtime 안전성 정합 (TypeScript optional)
- 단, `state_hash` 는 옛 hash — 새 코드의 새 hash 와 불일치 가능

**완화:**

- `CHECKPOINT_SCHEMA_VERSION` (line 35) 이 이미 versioning. v2 도입 시 마이그레이션 책임 명시 (현재 docstring 정합).
- `CheckpointCostState` 의 모든 새 필드는 `?` optional 추가 패턴 의무. 기존 hash 영속.

→ **본 정정은 backward compatible 한 진화 경로를 차단하지 않음.** 다만 Step 11.6 plan §1 에 "CheckpointCostState 진화 시 모든 새 필드 optional 의무" 한 줄 추가 권고.

### 시나리오 2 — assertCanonicalSafe 의 visited WeakSet 가 동일 객체 다중 path 등장 시 false-positive

**상황:** `BatchCheckpoint.pipeline_state_snapshot.stage_results` 가 다음 형태:

```typescript
const sharedZeroDuration = { status: 'pending', durationMs: 0 };
const stage_results = {
  pdf_extract: sharedZeroDuration,
  section_split: sharedZeroDuration, // 동일 reference
  ...
};
```

**위험:** `assertCanonicalSafe` 가 첫 번째 entry 에서 `visited.add(sharedZeroDuration)` 후, 두 번째 entry 에서 `visited.has(sharedZeroDuration)` → throw "Circular reference detected".

**검증 필요:** Step 11.6 plan §3.2 `toSnapshot()` 가 stage_results 를 다음 패턴으로 생성:

```typescript
PIPELINE_STAGES.map((s) => [s, { status: ..., durationMs: ... }])
```

`Object.fromEntries` 의 각 entry 가 **새 object literal** — 다중 reference 미발생. ✅ 안전.

**다만 위험:** 향후 누군가 `toSnapshot()` 를 최적화하면서 sharedRef 패턴 도입 시 false-positive throw. 현재 코드는 안전하지만 미래 회귀 위험.

**완화 권고:** `assertCanonicalSafe` 의 docstring 에 "tree shape 가정 — 동일 object 가 여러 path 에서 등장하면 circular 로 false-positive throw" 명시 + `toSnapshot()` 의 컨벤션에 "각 stage 의 `{status, durationMs}` 는 항상 새 literal" 명시 권고.

→ **본 정정 자체는 안전.** Step 11.6 코드 진입 시 `toSnapshot()` 구현 패턴이 본 가정 위반하지 않도록 plan v1.1 에 명시 의무.

### 시나리오 3 — SQLite 트리거 발화 race window

**상황:** `state='in_progress'` 행에 두 동시 process 가 다음 UPDATE 시도:

- Process A: `UPDATE batch_runs SET state='recovered' WHERE batch_run_id=X` (24h+ stale recover)
- Process B: `UPDATE batch_runs SET state='completed' WHERE batch_run_id=X` (정상 완료)

**위험:** SQLite WAL 직렬화 보장 시 둘 중 하나만 commit. 결정성 보장. 단:

- A 가 먼저 commit → state='recovered'. B 의 UPDATE 는 `WHERE batch_run_id=X` 매치되어 `state='completed'`. 트리거 #2 (`OLD.state='completed' AND NEW.state != 'completed'`) 는 OLD='recovered' 이므로 통과 → completed 전환됨. 의도된 정상 흐름.
- B 가 먼저 commit → state='completed'. A 의 UPDATE: 트리거 #2 와 #3 모두 발화 (OLD='completed', NEW='recovered') → ABORT. 정상 차단.

→ **race window 내 결정성 보장.** 단 Application 레벨에서 `concurrent_run_detected` 분기가 24h 미만 in_progress 차단 — race 진입 자체가 24h+ 조건에서만 발생. **Step 11.6 plan §AC-R3 e2e 시나리오에 본 race 추가 검증 권고.**

→ Q-C2 (5-페르소나 quality 이연) 의 fork(child_process) 진짜 race 검증과 정합.

---

## 7. 진행 권고 + Step 11.6 plan v1.1 정정 의무

### 7.1 본 P0 정정 3건의 진행 권고

> **accept_with_caveats — 3건 모두 머지 가능**

근거:

- CRITICAL 0건 (시스템 정합성 차단 결함 부재)
- MAJOR 4건 모두 plan 문서 정정 또는 향후 Step 11.6 코드 진입 시 처리 가능 (현재 코드 자체는 정합)
- 137/137 unit tests PASS — 회귀 0건
- 모듈 결합도 / 인터페이스 호환성 / Engine boundary 응집 / Year 2 호환성 모두 정합

### 7.2 Step 11.6 plan v1.0 → v1.1 정정 의무 (즉시)

다음 6건을 plan v1.1 에 반영하여 **APPROVED 상태 갱신** 필요:

1. **§4.3.4 `extractCostState(meter)` helper → `meter.toCheckpointCostState()` 인스턴스 메서드** 시그니처 교체. plan §3.3 `runPipeline` 흐름 코드 블록 5곳 (line 342, 401, 484, 528-535, 등) 모두 교체.
2. **§3.2 `toSnapshot()` 에 "각 stage 의 `{status, durationMs}` 는 항상 새 object literal" 컨벤션** 한 줄 추가 (Devil's Advocate 시나리오 2 완화).
3. **§6.1 AC-R6 트리거 시나리오에 T5 추가** — "신구 트리거 양쪽 존재 (옛 이름 잔존) 시나리오" — 0015 에 `DROP TRIGGER IF EXISTS trg_batch_runs_recover_only_from_terminal;` 한 줄 추가 의무.
4. **§AC-R3 e2e 시나리오에 24h+ stale lock + 동시 recover/complete UPDATE race 검증** 추가 (Devil's Advocate 시나리오 3).
5. **§1 새 절 추가 — "CheckpointCostState 진화 시 모든 새 필드 optional 의무"** — backward compatible 가드 명시.
6. **§4.3 cost-meter docstring 한 줄 추가 의무** — "checkpoint.ts 가 CheckpointCostState shape 의 source, cost-meter 는 변환 책임만" (M3 완화).

### 7.3 0015 마이그레이션 정정 권고 (즉시 또는 Step 11.6 코드 진입 시)

**옵션 A (권장):** 0015 상단에 `DROP TRIGGER IF EXISTS trg_batch_runs_recover_only_from_terminal;` 한 줄 추가. production 진입 시 옛 이름 잔존 위험 0.

**옵션 B:** 트리거 이름을 옛 이름 `trg_batch_runs_recover_only_from_terminal` 로 유지 + 본문만 보정. 이번 정정의 의도는 본문 보정이지 이름 변경이 아니었으므로, 옵션 B 가 더 정합.

→ **결정 의무: 진산님 또는 메인 컨텍스트.** 본 System Architect 권고는 **옵션 B (이름 유지)** — production deploy idempotency 더 안전.

### 7.4 Step 11.6 코드 진입 차단 여부

> **차단 X.** 본 P0 정정 3건은 Step 11.6 코드 진입 차단 의무 (5-페르소나 §3.2 §3.2 권고) 를 충족.

**선결 조건 잔여:**

- B-C1 (Step 5 plan UNIQUE 컬럼 부재 + 0014 트리거 충돌) — 1d
- B-C2 (BatchRunsDb examId 시그니처) — 0.5d
- D-C1 (Anthropic Console monthly cap) — 진산님 5분
- (선택) plan v1.1 정정 — 0.1d

본 P0 정정 3건만으로 Step 11.6 코드 진입은 **여전히 1.5~2d 후**. 5-페르소나 통합 보고서 §3.2 의 재정렬 순서 정합.

---

**보고서 작성 시각:** 2026-04-28 (KST)
**검토 범위:** 정정 3건 + 연관 4파일 (`cost-meter.ts` / `checkpoint.ts` / `recover.ts` / `0015_batch_runs.sql`) + plan v1.0 + 0014 마이그레이션 + 5-페르소나 통합 보고서
**자가 리뷰 회피 증거:** 본 페르소나는 silent-failure / quality 영역 진입 차단 — 실제 거부 9종의 안전성 (Q-C1) 검증은 quality-engineer 에 위임. 본 보고서는 모듈 결합도 / 인터페이스 호환성 / 트리거 상호작용 / Engine boundary 만 다룸.
**Devil's Advocate 의무 충족:** 3 시나리오 (cost-meter 진화 backward compat / WeakSet false-positive / 트리거 race window).
**판정:** accept_with_caveats — 3건 머지 가능 + plan v1.1 정정 의무 + 0015 옵션 B 권고
