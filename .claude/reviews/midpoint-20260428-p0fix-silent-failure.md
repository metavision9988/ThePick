# P0 CRITICAL 정정 4-Pass — Silent Failure 관점

**리뷰 일시:** 2026-04-28
**리뷰어:** silent-failure 전문 에이전트 (독립)
**리뷰 범위:**

- `apps/batch/src/cost-meter.ts` (R-C1: line 30, 351-361)
- `apps/batch/src/checkpoint.ts` (Q-C1: line 188-272)
- `migrations/0015_batch_runs.sql` (B-C3: line 60-82)
- 연관: `apps/batch/src/recover.ts` (line 113-248, 트리거 상호작용)

**검토 관점:** 본 정정이 silent failure / 부적절한 catch / 잘못된 fallback 을 새로 도입했는가?
**제약:** 코드 수정 X, 다른 4-Pass 영역(architect/quality) 침범 X

---

## 1. 한 줄 평가

> **accept_with_caveats** — R-C1 / B-C3 정정은 silent failure 관점에서 견고. Q-C1 정정은 9종 거부와 circular ref 차단이 의도대로 작동하나 **MAJOR 1건 (recursion 깊이 제한 부재)** + **MINOR 3건 (cross-realm Date / Buffer 운영 영향 / thenable 누락)** 이 잔존. 다음 통합(Step 11.6) 진입 전 최소 MAJOR 1건은 해소 권고.

---

## 2. CRITICAL — 즉시 정정 필요

**0건.**

본 정정 자체에는 CRITICAL 급 신규 silent failure 가 도입되지 않았다. 5-페르소나 + 메타 감사가 잡은 결함 3건 (R-C1 컴파일 에러 / Q-C1 silent collapse / B-C3 정상 recover ABORT) 의 정합성은 코드/SQL 직접 확인 결과 모두 의도대로 차단·허용된다.

---

## 3. MAJOR — 다음 작업 진입 전 정정

### MAJOR-1 — Q-C1 `assertCanonicalSafe` 재귀 깊이 제한 부재

**위치:** `apps/batch/src/checkpoint.ts:207-272`

**증거:**

```typescript
// line 263-271
if (Array.isArray(value)) {
  value.forEach((v, i) => assertCanonicalSafe(v, `${path}[${i}]`, seen));
  return;
}
if (typeof value === 'object') {
  for (const k of Object.keys(value as Record<string, unknown>)) {
    assertCanonicalSafe((value as Record<string, unknown>)[k], `${path}.${k}`, seen);
  }
}
```

**문제:** circular reference 는 `seen.has(objValue)` 로 차단되지만, **선형으로 깊이 N=10000+ 인 정상 구조**(예: linked-list 형 stage_results 누적, 또는 nested array)는 stack overflow 로 재진입한다. V8 기본 stack size 는 ~10K~15K 프레임. `pipeline_state_snapshot.stage_results` 가 PipelineStage 10개 enum 키로 제한되어 현재는 안전하지만, 향후 확장 시 무경계.

**Silent failure 위험:** stack overflow 시 RangeError throw → `canonicalJson` → `computeStateHash` → `buildCheckpoint` 가 모두 throw. 그러나 throw 메시지가 "Maximum call stack size exceeded" 로 나오면 **운영자가 'silent collapse 차단 의도'와 무관한 V8 내부 에러로 오인** 가능. CheckpointCorruptedError 와 매핑 부재.

**권고:**

- `depth` 파라미터 추가 (visited 와 동일 패턴) — 1000 초과 시 `[canonicalJson] Max depth 1000 exceeded at ${path}` 명시 throw
- 또는 plan §4.3.3 의 "선형 깊이 한계" 명시 + 운영 가드레일 문서화

**영향도:** Major (현재 데이터 shape 에서는 발화 불가, 그러나 Step 11.6 통합 시 pipeline state 변경 시 잠복 결함화)

---

### MAJOR-2 — R-C1 `toCheckpointCostState()` 에 startedAt 가드 부재

**위치:** `apps/batch/src/cost-meter.ts:351-361`

**증거:**

```typescript
toCheckpointCostState(): CheckpointCostState {
  return {
    initial_spend_usd: this.getCurrentSpend(),
    call_count: this.callCount,
    threshold_breaches: this.breaches.map((b) => ({ ... })),
  };
}
```

**문제:** `recordTokens()` (line 244) 와 `finalize()` (line 365) 모두 `startedAt === null` 시 `throw new Error('[CostMeter] xxx() before start()')` 가드를 보유. 본 신규 메서드는 동일 가드 부재. **`start()` 호출 전 호출 시 `getCurrentSpend()` = `initialSpendMicroUsd / 1_000_000` 로 동작** → "초기 spend 만 인계된 정상 스냅샷"으로 잘못 인식 가능.

**Silent failure 시나리오:**

1. Step 11.6 통합에서 `pipeline.ts` 가 stage 시작 전 (start() 호출 전) 우발적으로 checkpoint.cost_state 인계 호출
2. 빈 spend (call_count=0, breaches=[]) 가 합법 스냅샷으로 D1 batch_runs.state_hash 에 봉인
3. recover 시 `initialSpendUsd` 로 0 또는 stale value 가 재진입 → **누적 비용 회계 오염** (ADR-025 핵심 의무 침해)

**권고:**

```typescript
toCheckpointCostState(): CheckpointCostState {
  if (this.startedAt === null) {
    throw new Error('[CostMeter] toCheckpointCostState() before start()');
  }
  return { ... };
}
```

다른 두 진입점(`recordTokens` / `finalize`)과 일관 보장.

**영향도:** Major (Step 11.6 통합 시 결함 발화 가능. plan §4.3.4 가 명시한 "stage 종료 시 호출 가능 (finalize 와 무관)" 문구 자체가 start() 전 호출의 정당성을 시사하지 않음)

---

## 4. MINOR — 향후 추적

### MINOR-1 — Q-C1 cross-realm Date 거짓 음성

**위치:** `apps/batch/src/checkpoint.ts:227`

**증거:** `value instanceof Date` 검사. iframe / vm.createContext / worker_threads 로 다른 realm 에서 전달된 Date 객체는 **서로 다른 Date.prototype** 을 가져 `instanceof` 가 false. typeof 'object' 로 빠진 후 `Object.keys(date)` = `[]` → silent collapse (빈 객체 직렬화).

**완화 근거:** 현재 BATCH 파이프라인은 worker_threads / vm 미사용 (Node.js 단일 process). 그러나 `Object.prototype.toString.call(value) === '[object Date]'` 비교가 더 견고. 본 프로젝트는 발화 가능성 낮음 → MINOR.

---

### MINOR-2 — Q-C1 Buffer / TypedArray 거부의 운영 영향

**위치:** `apps/batch/src/checkpoint.ts:247-251`

**증거:** `ArrayBuffer.isView(value)` 가 모든 TypedArray + DataView + **Node.js Buffer (Uint8Array subclass)** 거부. checkpoint 에 이진 stage state (압축 BSON / protobuf 스냅샷) 를 저장하려는 향후 의도가 있다면, **caller 가 base64 인코딩 의무를 인지하지 못하면 throw 폭발**. 본 정정은 silent collapse 를 throw 로 전환했으므로 **silent failure 관점은 PASS**, 다만 운영 가독성 측면에서 메시지에 "Convert to base64 string or number[]" 가이드 포함된 점은 우수.

**잔존 위험:** plan §4.3.3 / 향후 통합 문서에 "checkpoint 에 binary 데이터 저장 시 사전 base64 인코딩" 명시 필요. 현재 `PipelineStateSnapshot` interface (line 41-57) 에는 binary 필드 부재 — 즉시 발화 위험 없음 → MINOR.

---

### MINOR-3 — Q-C1 thenable / async iterator 누락

**위치:** `apps/batch/src/checkpoint.ts:242`

**증거:** `value instanceof Promise` 만 검사. 사용자 정의 thenable (`{ then: (resolve) => resolve(x) }`) 은 native Promise 가 아니므로 통과 → typeof 'object' 진입 → `Object.keys` = `['then']` → `then` 이 function 이라 **line 219 의 function 거부에서 throw**. 즉 silent collapse 는 차단됨. async iterator (`Symbol.asyncIterator` 키) 도 비슷하게 function key 로 빠짐.

**결론:** silent failure 관점은 PASS (function 거부가 후방 가드 역할). 다만 메시지가 "Function not allowed at $.then" 으로 나와 **운영자가 thenable 의도를 즉시 인지하기 어려움**. 향후 thenable 명시 거부 분기 추가 권고 → MINOR.

---

### MINOR-4 — B-C3 `recovered` → `recovered` 재진입 무한 resume_count 증가

**위치:** `apps/batch/src/recover.ts:231-234` + `migrations/0015_batch_runs.sql:77-82`

**증거:**

- 정정 후 트리거 (line 79): `WHEN NEW.state = 'recovered' AND OLD.state = 'completed'` — `OLD.state = 'recovered'` 차단 부재
- `recoverBatch()` (line 231): `await opts.batchRunsDb.updateState(..., { state: 'recovered', resume_count_increment: 1 })` — 무조건 increment

**시나리오:** recover() 가 동일 batch_run_id 에 대해 N 회 호출 (네트워크 재시도, 운영자 수동 재실행 등) → 매회 OLD='recovered' → NEW='recovered' 전이 허용 → resume_count 무한 증가. 다른 트리거(`trg_batch_runs_no_state_downgrade` line 54-59) 도 OLD='completed' 만 차단하므로 무관여.

**의도성 판단:** 진산님이 plan §4.3.5 에서 "recover 재진입 허용" 명시. resume_count 누적은 운영 추적 목적으로 의도된 동작. **silent failure 아님 — 명시적 카운터 동작**. 다만 무경계 증가는 D1 INTEGER overflow 리스크 (Year 5+ 시점) → MINOR.

**권고:** resume_count 상한 (예: 100) 도달 시 application 레벨에서 'manual_review_required' 강제 전환. plan §4.3.5 후속 항목으로 이월.

---

### MINOR-5 — checkpoint.ts 주석 오기 (silent failure 무관, 그러나 운영 혼란 위험)

**위치:** `apps/batch/src/checkpoint.ts` — 본 검토 범위 내 파일 line 75-76 (주석)

**증거:** B-C3 정정 본문(`migrations/0015_batch_runs.sql:75-76`)에 `"본 트리거 + 0014 의 trg_batch_runs_no_state_downgrade"` — 그러나 `trg_batch_runs_no_state_downgrade` 는 0015 line 54-59 에서 정의됨 (0014 가 아님). **운영자가 0014 마이그레이션을 추적하려 할 때 발견 실패** → 운영 혼란.

**Silent failure 관점:** 무관. 그러나 본 검토 메타 감사 의무로 보고 → MINOR.

---

## 5. PASS 증거 — 실제 확인한 것

본 4-Pass 는 5-페르소나 + 메타 감사가 잡은 결함 3건의 정정 결과를 **silent failure 관점**에서 직접 확인했다.

### PASS-1 — Q-C1 9종 거부 + circular ref 차단 정상 작동

**확인:** `apps/batch/src/checkpoint.ts:207-272` 전체 직접 읽음.

- line 216 BigInt 거부 (typeof 'bigint')
- line 219 Function 거부 (typeof 'function')
- line 222 Symbol 거부 (typeof 'symbol')
- line 227 Date 거부 (instanceof Date) — JSON.stringify replacer 진입 전 walk 에서 차단 (P1-m3 정합성 PASS)
- line 232 Map/Set 거부
- line 237 WeakMap/WeakSet 거부
- line 242 Promise 거부
- line 247 TypedArray/DataView 거부 (ArrayBuffer.isView)
- line 254-261 visited WeakSet circular ref 차단 — 첫 호출에서 `seen ?? new WeakSet()` 생성, 재귀 시 `seen` 재사용 (line 264, 269)

**검증:** 5종 → 9종 확장 의도 + circular ref 신규 차단 모두 코드 라인에서 확인. 종전 silent collapse 4종 (WeakMap/WeakSet, Promise, TypedArray) 이 throw 로 전환됨.

---

### PASS-2 — R-C1 매핑 정확성 (5필드 → 3필드)

**확인:** `apps/batch/src/cost-meter.ts:351-361` + `apps/batch/src/checkpoint.ts:60-68` 비교.

`ThresholdBreach` (cost-meter.ts:103-109) 5필드:

- threshold, at_spend_usd, at_ratio, **timestamp_ms, stage**

`CheckpointCostState.threshold_breaches` (checkpoint.ts:63-67) 3필드:

- threshold, at_spend_usd, at_ratio

매핑 (cost-meter.ts:355-359):

```typescript
threshold_breaches: this.breaches.map((b) => ({
  threshold: b.threshold,
  at_spend_usd: b.at_spend_usd,
  at_ratio: b.at_ratio,
})),
```

**검증:** timestamp_ms / stage 의 명시적 누락이 의도. recover 시 인계 시점에 두 필드는 무관 (timestamp 는 새 BATCH 의 clock, stage 는 새 pipeline) — silent loss 가 아닌 **의도된 좁은 인터페이스**. checkpoint.ts:90 의 `cost_state?: CheckpointCostState` optional 필드와 정합. PASS.

---

### PASS-3 — B-C3 트리거가 정상 recover 경로 허용

**확인:** `migrations/0015_batch_runs.sql:77-82` + `apps/batch/src/recover.ts:131-149, 230-234` 추적.

정정 후 트리거: `WHEN NEW.state = 'recovered' AND OLD.state = 'completed'` → ABORT.

recover.ts 의 정상 경로:

- line 131-148: stale 24h+ 'in_progress' → 'concurrent_run_detected' 반환 X (24h 미만일 때만), **24h+ 인 경우 line 149 통과 후 line 230 으로 진행**
- line 231-234: `updateState({ state: 'recovered', resume_count_increment: 1 })` → OLD='in_progress', NEW='recovered' → 트리거 WHEN 조건 미일치 → 허용

**검증:** 원안 `OLD.state NOT IN ('killed', 'failed')` 은 OLD='in_progress' 시 ABORT (24h+ 정상 경로 차단). 정정 후 OLD='completed' 만 차단 → in_progress / killed / failed / recovered 모두 허용. 정상 recover 경로 unblocked PASS.

---

### PASS-4 — R-C1 type-only import 순환 의존 부재

**확인:** `grep -E "import.*cost-meter" apps/batch/src/checkpoint.ts` 결과 — 0 hits.

`cost-meter.ts:30` `import type { CheckpointCostState } from './checkpoint.js'` 는 type-only (TypeScript erasure 시 런타임 import 부재). checkpoint.ts 가 cost-meter.ts 를 역참조하지 않으므로 **현재 시점 순환 의존 0**.

**검증:** silent failure 관점에서 import 순환은 무관 (런타임 erasure). 향후 양방향 dependency 발생 시 ESM circular dep 의 lazy binding silent failure 위험 잠재 → 본 정정은 PASS, 검토 질문 8 의 "향후 step 11.6 통합 시 위험"은 별도 architect 영역. 본 보고서 범위 외.

---

### PASS-5 — Q-C1 Date 검사 위치가 typeof 'object' 분기 이전

**확인:** `apps/batch/src/checkpoint.ts:227` (instanceof Date) vs `:267` (typeof 'object').

검사 순서: line 212 (null/undefined) → 213 (primitive) → 216-251 (특수 타입 9종) → 254-261 (circular ref) → 263-271 (Array / object 재귀).

**검증:** Date 검사가 line 227 에서 발화 → line 267 의 typeof 'object' 분기 도달 전 차단. JSON.stringify replacer (line 283) 진입 전 walk 에서 throw → Date.toJSON() 호출 기회 없음. 검토 질문 3 의 "Date.toJSON() 이 호출되기 전 검사" 의도 확인. PASS.

---

## 6. Devil's Advocate

### 시나리오 1: B-C3 트리거 정정으로 'killed' 상태에서의 무한 recover 재시도 허용

**가설:** 본 정정은 OLD='completed' 만 차단. 그러나 `recover.ts:131` 의 사전 검사는 OLD='in_progress' 만 처리. **OLD='killed' 또는 OLD='failed' 인 경우 사전 검사 분기가 없어** Q1 (checkpoint 파일 존재) 으로 직행 → checkpoint 정상 시 line 230 의 updateState({ state: 'recovered' }) 가 트리거 통과 → recover.

**구체 발화:**

1. CostMeter kill switch 발동 → batch_runs.state='killed' (Step 11.6 통합 시점)
2. 운영자가 즉시 recover() 호출
3. recover.ts 가 OLD='killed' 인지 사전 인지하지 못한 채 checkpoint 무결성 검증 → 통과 → 'recovered' 로 전이
4. **Cost meter kill switch 가 발동한 원인 (예: 무한 루프 / 비정상 input) 이 해결되지 않은 채** 동일 BATCH 재진입 → 즉시 재 kill → 무한 루프

**판정:** silent failure 가 아닌 application logic gap. 5-페르소나 backend-architect 가 잡았어야 할 영역. 본 검토 범위는 **silent failure** 이며, kill 후 recover 시 origin 검증은 architect 영역. 그러나 **CRITICAL RULE #3 "에러 조용히 삭제 금지"** 의 정신은 침해 — kill 의 근본 원인 silent skip. **차기 통합 단계 에서 application-level guard 의무화 권고.**

---

### 시나리오 2: Q-C1 정정으로 인한 정상 데이터 거짓 양성 — pipeline state 에 Map 우발 도입

**가설:** Step 11.6 통합 시 `pipeline.ts` 의 stage_results 가 우발적으로 Map<stage, result> 로 구현됨 (TypeScript Record vs Map 혼동) → `assertCanonicalSafe` 가 throw → BATCH **모든 stage 종료 직후 checkpoint write 실패**.

**구체 발화:**

1. 개발자가 pipeline.ts 에서 `new Map<PipelineStage, StageResult>()` 사용
2. snapshot() 호출 시 PipelineStateSnapshot.stage_results 에 Map 직접 할당 (TypeScript 가 readonly Record 와 Map 의 키 호환성으로 통과 — 단언/cast 사용 시)
3. canonicalJson → assertCanonicalSafe(line 232) → throw
4. writeCheckpoint 실패 → BATCH 진행 못함 → **운영자가 "왜 갑자기 checkpoint 가 안 써지는가"** 디버깅에 시간 소모

**판정:** silent failure 의 정반대 — **noisy explicit failure**. CRITICAL RULE #2/3 정신과 일치. 본 정정은 정확히 의도된 동작. **단, 메시지가 "Map/Set not allowed" 만 출력하면 호출 stack 추적이 어려움**. line 233 의 `${path}` 출력이 path trace 를 제공하므로 운영 가독성 PASS. 본 시나리오는 정정의 효과 검증.

---

### 시나리오 3: R-C1 신규 메서드 호출이 stage 중간에 일어날 때 partial breach 누락

**가설:** Step 11.6 통합 시 `pipeline.ts` 가 매 stage 종료 시 `meter.toCheckpointCostState()` 를 호출. 그런데 **soft_warn 만 발화한 상태에서 hard_throttle/kill_switch 가 같은 호출 (단발 거대 호출) 로 발화하기 직전 호출** 시 → breaches 배열에는 soft_warn 만 들어있음.

**구체 발화:**

1. stage A 종료 시 toCheckpointCostState() 호출 → breaches=[soft_warn] 인계
2. stage B 의 첫 recordTokens() 가 hard_throttle + kill_switch 동시 발화 (단발 거대 호출)
3. autoEnforce=true 시 onKillSwitch (process.exit) → finalize 미호출 → **stage A 시점의 checkpoint 만 D1 에 봉인됨**
4. recover 시 D1 batch_runs.state_hash 가 stage A 의 cost_state (soft_warn 만) 보유 → initialSpendUsd 로 인계 → **hard_throttle / kill_switch 가 발생했다는 사실 silent loss**

**판정:** Silent failure 위험 **있음**. 그러나 발화 책임은 R-C1 정정 본문 자체가 아닌 **Step 11.6 통합의 호출 timing 설계** 영역. R-C1 의 toCheckpointCostState() 는 "현 시점 스냅샷"을 정확히 반환 — silent loss 가 아닌 **temporal gap**. 다만 plan §4.3.4 가 "매 stage 종료 시 호출 가능" 명시한 점이 본 timing gap 을 인지 못한 채 통합 진입할 위험. **차기 통합 단계 plan 보강 권고:** stage 종료 직후 + finalize 직전 양쪽에서 호출하여 마지막 breach 까지 D1 에 봉인.

---

## 7. 진행 권고

### 즉시 수용 (현 commit 진입 가능)

- 본 P0 정정 3건 (R-C1 / Q-C1 / B-C3) 은 **silent failure 관점에서 CRITICAL 0건**.
- 5-페르소나 + 메타 감사가 잡은 결함의 정합성 PASS.
- 137/137 unit tests + typecheck PASS 상태가 본 silent failure 검토에서도 정합.

### 차기 작업 진입 전 정정 (MAJOR 2건)

1. **MAJOR-1 (Q-C1 깊이 제한):** `assertCanonicalSafe` 에 `depth` 파라미터 추가, 1000 초과 시 명시 throw. Step 11.6 통합 진입 전 권고.
2. **MAJOR-2 (R-C1 startedAt 가드):** `toCheckpointCostState()` 에 `if (this.startedAt === null) throw` 추가. `recordTokens` / `finalize` 와 일관 보장.

### 향후 추적 (MINOR 5건)

- MINOR-1 cross-realm Date: worker_threads 도입 시 재검토
- MINOR-2 Buffer 거부의 운영 영향: PipelineStateSnapshot 에 binary 필드 추가 시 base64 가이드 의무화
- MINOR-3 thenable 명시 거부: 운영 가독성 보강 (선택)
- MINOR-4 resume_count 상한: Year 2+ 운영 누적 시 재검토
- MINOR-5 checkpoint.ts:75-76 주석 오기 ("0014 의 trg_xxx" → "0015 의 trg_xxx" 정정)

### 차기 통합 (Step 11.6) plan 보강 권고

- Devil's Advocate 시나리오 1 (kill → recover origin guard)
- Devil's Advocate 시나리오 3 (toCheckpointCostState() 호출 timing — finalize 직전 추가 호출 의무)
- 본 두 항목은 silent failure 가 application logic 의 gap 으로 잠복할 위험을 내포 → plan 단계에서 명시 차단 의무.

---

**최종 판정:** **accept_with_caveats**. 본 commit 은 진입 가능. MAJOR 2건은 Step 11.6 통합 진입 전 별도 task 로 정정. CRITICAL 0건 — 4-Pass review-gate.sh Stop Hook 의 1/3 (silent-failure 영역) PASS.
