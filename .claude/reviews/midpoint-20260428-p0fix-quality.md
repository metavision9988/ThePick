# P0 CRITICAL 정정 4-Pass — Quality / Test Coverage 관점

리뷰 일자: 2026-04-28
리뷰어: quality-engineer (독립 에이전트)
리뷰 범위:

- `apps/batch/src/cost-meter.ts` (R-C1: line 30, 330-361)
- `apps/batch/src/checkpoint.ts` (Q-C1: line 188-282)
- `migrations/0015_batch_runs.sql` (B-C3: line 60-80)
- 연관 테스트 3종 (`__tests__/cost-meter.test.ts`, `checkpoint.test.ts`, `recover.test.ts`)
  방식: 독립 서브에이전트 (silent-failure-hunter / system-architect 영역 침범 금지)
  직전 5-페르소나 통합 §3.2 결과 인지: "0.5d 작업, 신규 테스트 작성 이연" — 본 리뷰가 그 이연이 정당한지 평가.

---

## 1. 한 줄 평가

> **reject_and_revise** — 137/137 PASS 는 정정 코드 0줄에 대한 검증. 실제 정정한 ≈140줄(R-C1 32줄 + Q-C1 95줄 + B-C3 30줄)의 신규 분기는 **0% 커버리지**다. Step 11.6 진입 시 첫 호출에서 결함 노출 — "0.5d 이연"은 빚이고 부채는 즉시 회수 의무.

핵심 근거:

- `toCheckpointCostState()` (32줄, 4 신규 분기) — 호출 테스트 0건
- `assertCanonicalSafe` 신규 4종 (Symbol/WeakMap-WeakSet/Promise/TypedArray) + circular ref — throw 검증 0건. 기존 5종(BigInt/Function/Date/Map/Set)만 존재
- 0015 트리거 정정 — D1 e2e 검증 0건. mock `BatchRunsDb` 는 `RAISE(ABORT)` 시뮬레이션 X
- AC-Snapshot (Step 11.6 plan §7) — 거부 5종 → 9종으로 확장됐으나 plan v1.0 본문 미갱신 (Silent Pivot 위험)

---

## 2. CRITICAL — 즉시 신규 테스트 작성 의무 (4건)

### CRITICAL-Q1: `toCheckpointCostState()` 단위 테스트 0건 (R-C1)

**현황:**

- `cost-meter.ts:351-361` — 신규 메서드, 기존 31 tests 모두 호출 X
- 137/137 PASS = 메서드 호출 경로 미진입 시점의 검증
- Step 11.6 통합 (`pipeline.ts` 가 매 stage 종료 시 호출) → **첫 호출이 production 통합 시점**

**미검증 분기 4종:**
| 시나리오 | breaches.length | 검증 항목 |
|----------|----------------|-----------|
| breaches 0건 (정상 BATCH) | 0 | `threshold_breaches: []` (빈 배열, undefined X) |
| soft 도달만 | 1 | `[{threshold:'soft_warn', ...}]` |
| soft + hard | 2 | 순서 보존 (insertion order) |
| soft + hard + kill | 3 | 3개 모두, stage/timestamp_ms 제외 매핑 정확 |

**추가 미검증:**

- `initial_spend_usd` 가 `getCurrentSpend()` 결과 = `totalCostMicroUsd / MICRO_USD_PER_USD` (네이밍 함정 — "initial" 인데 "current" 반환). 이 시맨틱 mismatch 자체가 테스트로 고정 안 됨 — 향후 누군가 "initial 이니 `initialSpendMicroUsd` 반환해야지" 정정 시 회귀 0건 PASS.
- `breaches.map((b) => ({...}))` 가 매 호출 새 객체 생성 — 두 번 호출 시 referential equality 깨짐. checkpoint hash 결정성에는 영향 없음(canonical JSON 사용)이나 `===` 비교 코드가 추후 들어가면 silent fail.

**의무 테스트 (최소 6 케이스):**

```typescript
describe('CostMeter — R-C1: toCheckpointCostState()', () => {
  it('returns empty breaches when no threshold reached');
  it('preserves only soft breach when soft-only path');
  it('preserves soft+hard ordering');
  it('preserves soft+hard+kill ordering (huge call scenario)');
  it('omits stage and timestamp_ms fields (3 fields only)');
  it('initial_spend_usd reflects current cumulative (not constructor initialSpend)');
  it('idempotent — calling twice returns equal-by-value (deep equal)');
});
```

**AC 매핑:** AC-Cost (Step 11.6 plan §7) — checkpoint 에 cost_state 직렬화 정확성. 현재 AC-Cost 검증 = `cost_state` 필드 존재 여부 only. 매핑 정확성 미검증.

**근거:** plan v1.0 §6 T2 ('checkpoint with cost_state' integration test) 전제는 cost_state 필드 자체 검증, 매핑 함수의 단위 검증은 별도. T2 전에 단위 테스트 선행 의무.

---

### CRITICAL-Q2: `assertCanonicalSafe` 신규 4종 + circular ref 거부 검증 0건 (Q-C1)

**현황:**

- `checkpoint.test.ts:405-425` — 5종(BigInt/Function/Date/Map/Set)만 검증
- 신규 4종 + circular = 5종 신규 거부 분기 **모두 미검증**

**미검증 거부 분기 5종:**
| # | 거부 타입 | 코드 라인 | 위험 |
|---|-----------|-----------|------|
| 1 | Symbol | `checkpoint.ts:222-226` | JSON.stringify 시 silent drop — 거부 안 되면 의미 손실 |
| 2 | WeakMap/WeakSet | `:237-241` | non-enumerable, `{}` 직렬화 |
| 3 | Promise | `:242-246` | `{}` 직렬화, 비동기 의미 손실 |
| 4 | TypedArray/DataView | `:247-251` | index-keyed object 변환 |
| 5 | Circular ref | `:253-260` | stack overflow 차단 — 검증 0건 |

**특히 위험한 시나리오:**

- `Buffer.from('hello')` (Node.js Buffer = `Uint8Array` 상속) → `ArrayBuffer.isView()` true → 거부. 그러나 BATCH PDF 파싱에서 Buffer 가 pipeline_state_snapshot 에 진입할 가능성 있음 (PoC 코드의 흔한 실수). 거부 작동 안 하면 ".checkpoint.json" 에 `{"0":104,"1":101,...}` 가 들어가고 hash 결정성 OK 라 silent collapse → recover 시 복구 불가.
- Circular ref: `obj.self = obj` 패턴은 PipelineState 가 caller reference 보유 시 우발적 발생 가능. `JSON.stringify` 의 `TypeError: Converting circular structure to JSON` 보다 본 코드의 `Error('[canonicalJson] Circular...')` 가 먼저 발화해야 buildCheckpoint 진입점에서 차단 — 순서 의존성 미검증.

**의무 테스트 (최소 7 케이스):**

```typescript
describe('canonicalJson — Q-C1: 신규 4종 + circular 거부', () => {
  it('throws on Symbol value');
  it('throws on Symbol key'); // {[Symbol('x')]: 1}
  it('throws on WeakMap');
  it('throws on WeakSet');
  it('throws on Promise (resolved)');
  it('throws on Promise (pending)'); // 비동기 의미 손실 핵심
  it('throws on Uint8Array (TypedArray)');
  it('throws on DataView');
  it('throws on Buffer.from(...)'); // Node.js 특화
  it('throws on circular reference (self)');
  it('throws on circular reference (mutual: a.b = b; b.a = a)');
  it('throws on circular reference (deep: a.b.c.d = a)');
  it('does NOT throw on diamond DAG (a.x = shared; a.y = shared)'); // false positive 방지
});
```

**AC 매핑:** AC-Snapshot (Step 11.6 plan §7) — "canonical JSON 결정성 + silent collapse 차단". plan v1.0 §7 가 5종 거부만 명시 — **9종으로 강화 의무** (CRITICAL-Q3 참조).

**Devil's Advocate 시나리오:**

- 같은 객체를 두 번 참조하는 정상 DAG (e.g., `{a: shared, b: shared}` where shared 는 plain obj) — 본 정정의 `seen.has(objValue)` 가 두 번째 참조에서 throw → **false positive**. 코드 라인 261 `seen.add(objValue)` 가 첫 진입 시점에 추가되므로 형제 참조 시 두 번째에서 throw. 이 false positive 가 PipelineStateSnapshot 의 stage_results (10 stage 가 ALL_STAGES 배열 공유) 패턴에서 발화 가능 — 검증 0건. 만약 발화하면 모든 checkpoint 빌드 실패 = production 차단.

---

### CRITICAL-Q3: AC-Snapshot 정의 갱신 미반영 — plan v1.0 Silent Pivot (Q-C1)

**현황:**

- `docs/plans/engine-hardening/step11.6.plan.md §7` (가정 — 5-페르소나 통합 §3.2 참조 기반) AC-Snapshot 검증 항목 = "5종 거부 (BigInt/Function/Date/Map/Set)"
- Q-C1 정정으로 거부 9종 + circular 1종 = **10종으로 확장** 됐으나 plan AC 본문 미갱신

**위반:**

- CRITICAL RULE #1 ("기획과 다르게 구현하려면 코딩 멈추고 인간에게 먼저 보고") — 정정이 plan 보다 먼저 갔다 = **Silent Pivot**
- AC 정의가 ground truth 인데 ground truth 미동기 = 향후 다른 구현자가 "5종만 막으면 되겠지" 회귀 가능

**의무 정정:**

1. plan v1.0 → v1.1 정정 (AC-Snapshot 항목 9종 + circular 명시)
2. AC-Snapshot Binary Gate 강화: "10종 거부 throw 검증 + DAG false positive 미발생 검증"
3. 본 plan 정정이 Step 11.6 코드 진입 전 의무

**AC 매핑:** AC-Snapshot self-update.

---

### CRITICAL-Q4: 0015 트리거 정정 e2e 검증 0건 (B-C3)

**현황:**

- `recover.test.ts:8 tests` — 모두 mock `BatchRunsDb`. `db.updateState()` 가 `RAISE(ABORT)` 시뮬레이션 0%
- 0015 SQL 트리거 발화 자체 검증 X — production D1 에서 첫 검증 = 위험

**B-C3 정정 영향 범위:**
| 시나리오 | 정정 전 (원안) | 정정 후 | 검증 상태 |
|----------|---------------|---------|----------|
| `in_progress` (24h+ stale) → `recovered` | ABORT | OK | **검증 0** (T3 시나리오 = AC-R4 stale lock — `recover.test.ts:262-298` mock 만) |
| `killed` → `recovered` | ABORT | OK | **검증 0** (AC-R1 = mock) |
| `failed` → `recovered` | ABORT | OK | **검증 0** |
| `recovered` → `recovered` (재진입) | ABORT | OK | **검증 0** |
| `completed` → `recovered` | ABORT | ABORT | **검증 0** (AC-R3 only — checkpoint 진입 전 short-circuit) |

**Step 11.6 plan §6 D1 Preview 통합 검증 4건 (T1~T4):**

- T3 정의 = "정상 'in_progress' → 'recovered'" 였으나 본 정정으로 "stale 24h+ 'in_progress' → 'recovered' 정상 + 24h 미만 → application 레벨 차단" 으로 의미 재정의 필요
- T3 정의 갱신 의무 = plan v1.0 §6 갱신 의무

**의무 테스트 (D1 Preview e2e):**

```typescript
describe('migrations/0015 — B-C3: 트리거 발화 e2e', () => {
  it('T3a: in_progress (>24h) → recovered: ALLOW');
  it('T3b: in_progress (<24h) → recovered: should be blocked at application layer (NOT SQL)');
  it('T3c: killed → recovered: ALLOW');
  it('T3d: failed → recovered: ALLOW');
  it('T3e: completed → recovered: ABORT (RAISE message contains "Idempotency violation")');
  it('T3f: recovered → recovered (resume_count++): ALLOW');
});
```

이는 vitest 단위 테스트로 불가능 — `wrangler d1 execute --local` 또는 `better-sqlite3` 통합 테스트 필수.

**AC 매핑:**

- AC-R1 (OOM 부활) — mock 에서 PASS, real D1 에서 검증 의무
- AC-R4 (concurrent run) — application 레벨이 24h 미만 차단해야. SQL 에서 통과시키는 게 정정의 핵심 — application 차단 부재 시 race 가능
- 신규 AC-T3 (state transition matrix) 추가 의무

---

## 3. MAJOR — Step 11.6 진입 전 정정 (5건)

### MAJOR-Q1: `assertCanonicalSafe` visited WeakSet 외부 주입 시나리오 미검증

**위치:** `checkpoint.ts:207-211` 시그니처 `(value, path='$', visited?: WeakSet<object>)`

**위험:**

- 외부 caller (e.g., `canonicalJson` line 282) 가 visited 를 명시 전달하는 시나리오 없음 — 항상 첫 호출은 default
- 그러나 시그니처가 export 안 되어 있고 (private function) 재귀에서만 사용 — 그러나 testability 측면에서 외부에서 잘못된 WeakSet 주입 시 false positive 가능
- 잘못된 WeakSet (이미 다른 객체 add 한 상태) 주입 시 `seen.has(value)` true → throw — 검증 0건

**의무:**

- 시그니처를 단일 인자로 축소하거나 (visited 를 closure 로 숨김) 외부 주입 시나리오 명시 거부 테스트 추가

---

### MAJOR-Q2: `assertCanonicalSafe` throw → CheckpointCorruptedError 통합 부재

**위치:** `checkpoint.ts:282` `canonicalJson()` 진입점

**현황:**

- assertCanonicalSafe throw 시 raw `Error` 객체 — `CheckpointCorruptedError` 통합 X
- `buildCheckpoint` (line 149) 가 호출 → throw 시 caller (pipeline.ts) 가 받는 에러는 `Error` ("[canonicalJson] BigInt not allowed at $.foo")
- `CheckpointCorruptedError` 의 batchRunId / reason 메타 부재 → 디버깅 시 batch_run_id 컨텍스트 손실

**검증 부재:**

- "buildCheckpoint(invalid input) → CheckpointCorruptedError" 케이스 0건. 모든 P1-m3 테스트는 `canonicalJson({...})` 직접 호출 only.

**의무:**

- `buildCheckpoint` 가 try/catch 로 감싸 `CheckpointCorruptedError(batchRunId, reason)` 로 변환
- `recover.ts` 가 `CheckpointCorruptedError` 타입가드 하므로 일관성 확보

---

### MAJOR-Q3: `getCurrentSpend()` 부동소수점 → canonical JSON hash 비결정성 위험

**위치:** `cost-meter.ts:308-310` `return this.totalCostMicroUsd / MICRO_USD_PER_USD`

**위험:**

- `totalCostMicroUsd` (정수) / `1_000_000` = JS number (double) — 일부 값에서 부동소수점 표현 불가
- 예: 6_000_001 / 1_000_000 = 6.000001 (정확) BUT 7_777_777 / 1_000_000 = 7.777777000000001 가능
- `toCheckpointCostState().initial_spend_usd` 가 nondeterministic 실수 → JSON 직렬화 시 다른 문자열 → state_hash 다름 → 같은 BATCH 두 번 snapshot → 다른 hash → tampering 오탐

**검증 부재:**

- `cost-meter.test.ts:68-81` 정수 정밀도 only 검증 (`0.006` 정확 일치). 비결정 실수 시나리오 0건.

**의무:**

- `toCheckpointCostState()` 가 `getCurrentSpend()` 대신 `Math.round(spend * 10000) / 10000` (4 decimal places lock) 또는 micro-USD 정수 그대로 보존
- 단위 테스트: `recordTokens(prime_tokens) × N` 후 `toCheckpointCostState()` 두 번 호출 → 두 결과의 canonicalJson 동일

---

### MAJOR-Q4: 137/137 PASS 의 거짓 안심 시나리오 명시

**현황:**

- 5-페르소나 통합 §3.2 가 "회귀 0건 = 안전" 함의를 깐 채로 "0.5d 이연"
- 그러나 **회귀 0건은 정정 외 코드 안전 = 정정 자체에 대한 신뢰 0**

**거짓 안심의 5가지 패턴:**

1. **R-C1**: `toCheckpointCostState` 호출 0건 → import type 만 검증 = 컴파일 PASS = "회귀" 정의 안 깨짐 (호출 안 하니까)
2. **Q-C1**: 신규 거부 분기는 throw path → 기존 정상 input 통과 path 와 무관 → 137 PASS 영향 X
3. **B-C3**: 트리거 정정은 SQL — vitest 가 SQL execution 안 함 → 영향 0건
4. **Q-C1 visited WeakSet**: default 파라미터 추가 → 기존 호출자 영향 0
5. **R-C1 import type**: type-only import → runtime 영향 0

→ 137 PASS 는 "정정이 기존 코드를 안 깼다"의 약한 버전이고 "정정이 의도대로 동작한다"는 **0% 검증**.

**의무:**

- Step 11.6 plan v1.1 정정에 "신규 분기 검증 의무 §3.2-bis" 추가
- "회귀 0건" 표현을 "기존 코드 안전 0건, 신규 분기 검증 0건" 으로 명시 분리

---

### MAJOR-Q5: Build SLO `build_correctness 0.999` 회귀 차단 자동화 미구축

**현황:**

- 메타 감사 결함 5 (CBIV self-reflection) — 본 P0 정정으로도 미해결
- Step 7 contract verify 의 1000회 통계 검증 = canonical JSON 결정성 + state_hash 결정성 stat verify
- 본 정정으로 canonicalJson 거부 분기 ↑ → 1000회 검증의 input space ↑
- Step 7 시점이 본 정정으로 앞당겨질 필요 (Step 11.6 진입 전 mini contract verify)

**의무:**

- Step 11.6 진입 전 100회 mini contract verify (canonicalJson(random_input) 결정성 + 거부 분기 fuzz)
- Step 7 1000회 검증으로 확장

---

## 4. MINOR — 향후 추적 (3건)

### MINOR-Q1: AC-CM-1 `expect(report.total_cost_usd).toBeCloseTo(7.5, 6)` 정밀도

`cost-meter.test.ts:50` `toBeCloseTo(7.5, 6)` = 6 decimal places = 1e-6 USD = 1 micro-USD. 정수 누적 정밀도가 0 인데 toBeCloseTo 사용 — toBe(7.5) 가능. 그러나 `getCurrentSpend()` 가 division 사용하므로 보수적 선택. → MAJOR-Q3 와 연계.

### MINOR-Q2: `BatchCheckpoint.cost_state?` 옵셔널 — Step 11.6 통합 시 의무화 시점 미명시

`checkpoint.ts:90` `readonly cost_state?: CheckpointCostState` — Step 11.6 통합 후 의무 필드. plan 에 "Step 11.6 통합 후 required" 명시 필요.

### MINOR-Q3: `recover.test.ts` mock DB 의 RAISE(ABORT) 시뮬레이션 부재

mock 이 `updateState` 무조건 성공 → 0015 트리거 정상 작동 가정. 향후 mock 에 trigger simulation 옵션 추가 (e.g., `simulateAbortOn: { fromState: 'completed' }`).

---

## 5. PASS 증거 (5건)

### PASS-1: 기존 137/137 회귀 안전 PASS

`apps/batch/__tests__/cost-meter.test.ts` 31 tests + `checkpoint.test.ts` 25 + `recover.test.ts` 8 + 그 외 73 = 137. 정정 후에도 재실행 시 PASS — 본 리뷰는 "정정이 깨뜨림 없음"은 인정. 단 "신규 분기 검증" 과 다른 차원.

### PASS-2: 기존 5종 거부 케이스 (`checkpoint.test.ts:405-425`) 정상

BigInt/Function/Date/Map/Set 5종 throw 검증 — 본 정정에서 보존 + 동작 확인. line 217-236 5종 분기 모두 retained.

### PASS-3: AC-R1~R5 mock 시나리오 PASS 보존

`recover.test.ts:97-340` AC-R1/R2/R3/R4/R5 모두 PASS — 0015 트리거 정정이 mock 레이어와 무관하므로 영향 0. application 로직 (recover.ts:131-149) 정상.

### PASS-4: `import type { CheckpointCostState }` (cost-meter.ts:30)

type-only import — 런타임 영향 0, 순환 의존성 0 (checkpoint.ts 가 cost-meter 를 import 안 함, 단방향). Verified: `grep "from './cost-meter'" apps/batch/src/checkpoint.ts` 결과 없음 (read 시 확인).

### PASS-5: `breaches.map((b) => ({...}))` 가 stage/timestamp_ms 의도적 제외

`cost-meter.ts:355-359` — `CheckpointCostState.threshold_breaches` 인터페이스 (`checkpoint.ts:63-67`) 의 3 필드와 일치. 의도된 부분집합 매핑 — interface 일관성 OK.

---

## 6. AC 매트릭스 (변경 후)

| AC                  | 정의                        | unit         | integration          | e2e               | 상태                                    |
| ------------------- | --------------------------- | ------------ | -------------------- | ----------------- | --------------------------------------- |
| AC-1                | BATCH 정상 흐름             | 보유         | 보유 (pipeline.test) | 미보유            | OK                                      |
| AC-R1               | OOM 부활                    | mock PASS    | mock PASS            | **미검증** (B-C3) | **GAP**                                 |
| AC-R2               | 변조 감지                   | PASS         | PASS                 | mock              | OK                                      |
| AC-R3               | already_completed           | mock         | mock                 | **미검증** (B-C3) | **GAP**                                 |
| AC-R4               | concurrent < 24h            | mock         | mock                 | **미검증**        | **GAP**                                 |
| AC-R5               | version mismatch            | PASS         | mock                 | mock              | OK                                      |
| AC-R6               | stale 24h+                  | mock         | mock                 | **미검증** (B-C3) | **GAP**                                 |
| AC-Cost             | cost_state 직렬화           | **0 (R-C1)** | 미수립               | 미수립            | **CRITICAL**                            |
| AC-Snapshot         | canonical 5종 거부          | 5종 PASS     | —                    | —                 | **stale** (9종+circular 으로 갱신 의무) |
| AC-Snapshot' (신규) | canonical 9종+circular 거부 | **0 (Q-C1)** | —                    | —                 | **CRITICAL**                            |
| AC-T3 (신규)        | state transition matrix     | —            | —                    | **0 (B-C3)**      | **CRITICAL**                            |

**요약:**

- 12개 AC 중 6개 GAP, 3개 CRITICAL
- 본 정정으로 AC-Snapshot 의미 변경 + AC-Cost 신규 매핑 + AC-T3 신규 의무 = **AC 매트릭스 자체가 stale**

---

## 7. Devil's Advocate

### 7.1 "0.5d 작업이라 신규 테스트는 다음 단계로 미뤄도 안전" 반론

**반론 1 — 메서드의 첫 호출 = production 통합:**
`toCheckpointCostState()` 가 처음 호출되는 순간이 Step 11.6 통합. unit test 없이 첫 호출 = "테스트 없는 첫 production 진입" = CRITICAL RULE #4 ("출력물 직접 확인 후에만 완료") 위반. unit test 가 곧 출력물 확인.

**반론 2 — silent path 의 본질:**
137 PASS 가 정정 코드 0줄을 검증한다는 건 정정의 "정상 동작"이 아니라 "에러 없는 import"만 검증. 신규 거부 분기 5종 (Symbol/WeakMap-WeakSet/Promise/TypedArray + circular) 은 throw path 라 정상 input 통과 path 와 mutually exclusive — 회귀 검증의 정의 자체에 안 들어옴.

**반론 3 — 트리거 정정의 race condition:**
B-C3 정정은 application 레벨 차단 (recover.ts:131-149) 에 의존. 24h 미만 'in_progress' → SQL 통과 + application 차단 의무. application 차단이 race condition (clock skew, async ordering) 으로 실패 시 SQL 이 fallback — 그러나 본 정정으로 SQL fallback 제거. 즉 application 차단 = 단일 방어선. mock 검증으로 race 검증 0건.

### 7.2 "Step 11.6 진입 시 통합 테스트로 검증되니 단위는 생략 가능" 반론

**반론 1 — Test Pyramid 위배:**
통합 테스트는 통합 결함 검증, 단위 결함은 단위 테스트가 빠르게 (ms 단위) 검증. 통합 테스트에서 단위 결함 (e.g., breaches 매핑 누락) 발견 시 디버깅 비용 ≈ 단위 테스트 작성 비용 × 5.

**반론 2 — Step 11.6 의 통합 테스트 자체가 stub 가능:**
Step 11.6 plan §6 의 T1~T4 가 "in-memory mock D1" 을 사용한다면 production D1 통합 검증 0건 그대로. T3 정의 갱신 의무 (CRITICAL-Q4) 까지 못 가면 통합 테스트는 stub.

### 7.3 "기존 5-페르소나 통합 §3.2 추정이 옳다" 반론

§3.2 가 "0.5d 작업"으로 추정한 근거는 "신규 코드 ≈ 140줄 × 통상 1줄/2분 = 4.7시간". 그러나:

- R-C1 의무 테스트 6 케이스 ≈ 50줄 × 3분 = 2.5시간
- Q-C1 의무 테스트 13 케이스 ≈ 130줄 × 3분 = 6.5시간
- B-C3 의무 테스트 6 케이스 (e2e setup 포함) ≈ 200줄 × 5분 = 16시간

→ 실제 의무 = 25시간 ≈ **3d**, "0.5d 이연"은 8배 underestimate. §3.2 추정 자체가 결함.

---

## 8. 진행 권고 + 신규 테스트 케이스 우선순위 (10건)

### 진행 권고: Step 11.6 코드 진입 BLOCK + 신규 테스트 1.5d 선행

5-페르소나 통합 §3.2 의 "0.5d 이연" 권고는 reject. 다음 순서로 의무:

1. **plan v1.0 → v1.1 정정** (AC-Snapshot 9종+circular, AC-Cost 신규, AC-T3 신규) — 0.5d
2. **신규 단위 테스트 작성** (R-C1 + Q-C1) — 1.0d
3. **0015 트리거 e2e 통합 테스트** (better-sqlite3 또는 wrangler d1 local) — 0.5d
4. **실행 + 138/138 (또는 그 이상) PASS 확인** — 0.25d
5. **그 다음** Step 11.6 plan §3 (1.5d B-C1+B-C2) 진입

총 추가 의무: ≈ **2.25d** (§3.2 의 0.5d × 4.5 배). 그러나 Step 11.6 통합 후 결함 발견 비용 (디버깅 + 회귀 + plan revision) 이 5d+ 임을 고려하면 net 절감.

### 우선순위 신규 테스트 10건

| #   | 테스트                                                              | 파일                           | AC           | 우선순위                | 추정 |
| --- | ------------------------------------------------------------------- | ------------------------------ | ------------ | ----------------------- | ---- |
| 1   | `toCheckpointCostState() — empty breaches`                          | cost-meter.test.ts             | AC-Cost      | **P0**                  | 5분  |
| 2   | `toCheckpointCostState() — soft+hard+kill 3 ordering`               | 동                             | AC-Cost      | **P0**                  | 10분 |
| 3   | `toCheckpointCostState() — initial_spend_usd 시맨틱 lock`           | 동                             | AC-Cost      | **P0**                  | 10분 |
| 4   | `canonicalJson — Symbol throw`                                      | checkpoint.test.ts             | AC-Snapshot' | **P0**                  | 5분  |
| 5   | `canonicalJson — Promise throw (pending + resolved)`                | 동                             | AC-Snapshot' | **P0**                  | 10분 |
| 6   | `canonicalJson — TypedArray (Uint8Array + Buffer + DataView) throw` | 동                             | AC-Snapshot' | **P0**                  | 10분 |
| 7   | `canonicalJson — circular reference (self + mutual + deep) throw`   | 동                             | AC-Snapshot' | **P0**                  | 15분 |
| 8   | `canonicalJson — diamond DAG (shared sibling) does NOT throw`       | 동                             | AC-Snapshot' | **P0** (false positive) | 10분 |
| 9   | `0015 trigger — completed → recovered ABORT` (better-sqlite3)       | 신규 `migrations-0015.test.ts` | AC-T3        | **P0**                  | 1h   |
| 10  | `0015 trigger — in_progress (24h+ stale) → recovered ALLOW`         | 동                             | AC-T3        | **P0**                  | 30분 |

추가 P1 (이연 가능):

- `buildCheckpoint(invalid) → CheckpointCorruptedError 통합 변환` (MAJOR-Q2)
- `getCurrentSpend() 부동소수점 결정성 fuzz 100회` (MAJOR-Q3)
- `recover.test.ts mock 의 RAISE simulation 옵션 추가` (MINOR-Q3)

---

## 결론

**판정: reject_and_revise**

- 137/137 PASS = 정정 코드 0줄에 대한 검증 = 정정 자체에 대한 신뢰 0%
- AC 매트릭스 상 12개 중 9개가 GAP/stale (75%)
- 5-페르소나 통합 §3.2 의 "0.5d 이연" = 8배 underestimate + Silent Pivot (plan 미동기)
- Step 11.6 진입 전 1.5d 신규 테스트 작성 + plan v1.1 정정 의무

**추천 행동:**

1. 본 리뷰 + silent-failure-hunter + system-architect 결과를 통합 → P0 정정 plan v1.1 작성
2. plan v1.1 §3.2 보강 (1.5d 추가 명시)
3. 인간 (진산님) 승인
4. 우선순위 P0 10건 신규 테스트 작성
5. 138+/138+ PASS 확인 후 Step 11.6 §3 진입

**리뷰 끝.**
