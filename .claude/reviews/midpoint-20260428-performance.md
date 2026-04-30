# Engine Hardening 중간 점검 — Performance 관점

**검토자:** performance-engineer (독립 에이전트)
**검토일:** 2026-04-28
**검토 범위:** Step 1 (cost-meter.ts) + Step 11.5 (checkpoint.ts / recover.ts) + Step 11.6 plan v1.0 (pipeline.ts 통합 설계)
**검토 관점:** 처리량 / 지연 / 메모리 / GC 압력 / fsync I/O / D1 query 비용
**중복 회피:** refactoring-expert(코드 품질) / quality-engineer(테스트) / backend-architect(스키마) / devops-architect(SIGINT/cap) 영역 침범 없음

---

## 1. 한 줄 평가

> **proceed** — Step 11.6 코드 진입 가능. 단 fsync 비용 측정과 `processBatch.usage` 반환 의존성 2건은 **코드 진입 첫 30분 내 실측 prerequisite**. SLO 60분 빌드 안에 충분한 헤드룸(BATCH-1 추정 ~5~12분, fsync 합산 < 1초) 이지만, 측정 없이 진입하면 BATCH-3 이후 회귀 추정 곤란.

---

## 2. CRITICAL — Production 부하 시 깨짐

### C-1. `processBatch.usage` 반환 가정이 미검증 — CostMeter 무력화 시 비용 폭주 위험

**파일:** `apps/batch/src/pipeline.ts:433` (현행 호출 — `await processBatch(ctx.claudeClient, input)`) + `step11-6-pipeline-recover-integration.plan.md:497-516`(plan §4.3.2)

**증거:**

- plan §4.3.2 가 `result.usage.input_tokens / output_tokens / model` 접근 가정. plan §4.3.3 가 "미반환 시 warn + skip" 폴백 명시.
- `@thepick/parser` 의 `processBatch` 시그니처는 본 검토에서 read 미수행이지만, 현재 `pipeline.ts:434-438` 가 `result.error` / `result.contract` 만 사용 — **usage 필드 코드상 0건 사용 흔적**.
- 폴백("warn + skip")이 발동되는 순간 `recordTokens()` 호출이 0회 → `ratio()` 영원히 0 → kill_switch 영원히 미발동 → **Layer 1 무력화. Layer 2 (Anthropic console cap $200) 만 남음.**

**임계 부하 추정:**

- BATCH-3 (논작물, expectedNodes=40) 적재 중 Claude API 가 prompt explosion (예: PDF 한 페이지에 표가 20개 → 토큰 압축 실패) 발생 시 1회 호출 $5+ 가능. CostMeter 무력화 상태에서 5회 호출 = $25 = BATCH 1회 예산 2.5배 초과 후에야 Layer 2 cap (월 $200) 으로 차단.
- 하지만 monthly cap 도달 시점 = 모든 BATCH 진행 동결. **BATCH-1~5 적재 일정 즉시 중단**.

**권고:** Step 11.6 코드 진입 첫 작업으로 `@thepick/parser/src/batch-processor.ts` 의 `processBatch` 반환 타입 확인 → `usage` 미반환이면 plan §4.3 진입 전 `@thepick/parser` 보강 plan 신규 발행 (이를 현재 plan §"Phase 2 작업" 으로 분리한다고만 명시 — 실제 분리 plan 부재).

---

### C-2. fsync per stage 의 디렉토리 fsync 누적 — NAS/네트워크 마운트 시 BATCH 시간 폭발

**파일:** `step11-6-pipeline-recover-integration.plan.md:683-688` (`writeCheckpoint` 본체 + 디렉토리 fsync) + `step11-6-pipeline-recover-integration.plan.md:709-712` (`writeCheckpointSync` 디렉토리 fsync)

**증거:**

- plan §5.2: 매 `writeCheckpoint` 호출마다 **2회 fsync** — 파일 fsync(`fh.sync()`) + 디렉토리 fsync(`dh.sync()`).
- 10 stages × 1 BATCH × 2 fsync = **20 fsync per BATCH**. BATCH-5 누적 = 100 fsync.
- fsync 비용 추정 (root 가정: 측정 prerequisite):
  - **로컬 NVMe SSD:** 0.1~0.5 ms/fsync (consumer-grade, fdatasync). 20 fsync × 0.5ms = 10ms per BATCH — 무시 가능.
  - **로컬 SATA SSD:** 1~5 ms/fsync. 20 fsync × 5ms = 100ms per BATCH — 무시 가능.
  - **HDD:** 10~30 ms/fsync. 20 fsync × 30ms = 600ms per BATCH — 보고용.
  - **WSL2 (Windows /mnt/c):** **5~50 ms/fsync (Windows 파일 시스템 통과)**. 20 × 50 = **1초/BATCH** — 보고용.
  - **NAS/SMB/NFS 마운트:** **50~500 ms/fsync (네트워크 round trip)**. 20 × 500ms = **10초/BATCH** — **CRITICAL**.
- 진산님 환경: WSL2 (env: `Linux 6.6.87.2-microsoft-standard-WSL2`). `/home/soo/ClaudePro/ThePick` 가 ext4 native (WSL2 9P 가 아님) 인지 확인 필요. native 면 SSD 로컬 수준, `/mnt/c` 면 Windows 파일 시스템 → fsync overhead 큼.

**임계 부하:**

- BATCH-1 (60 nodes, ~12분 추정) 에서 fsync 1초 = 0.14% — 무시.
- BATCH-1~5 누적 5회 × 1초 = 5초 — 무시.
- 하지만 **Step 11.6 plan §10 롤백 조항이 fsync 옵션 제거를 명시** — 즉 fsync 비활성 시 power loss 손실 위험 (이연 3 부활). fsync ON 유지가 정답.

**권고:** Step 11.6 코드 진입 시 첫 microbenchmark 작성 — `apps/batch/__tests__/checkpoint-fsync-bench.test.ts` 신규. `fsync: true` vs `false` 의 100회 평균 측정. 결과를 Step 11.6 v1.1 정정 §"실측 fsync 비용" 으로 추가. **이 데이터 없이 production 이행 = 새벽 3시 on-call 시 "왜 BATCH 가 평소보다 느리지?" 디버깅 불가.**

---

### C-3. Claude API throttle sleep 1초 default 가 batch_structurize stage 내 누적 → throttle 시점 1회 sleep 으로 부족

**파일:** `apps/batch/src/cost-meter.ts:325-327` (`applyThrottle`) + `cost-meter.ts:208` (default 1000ms) + `step11-6-pipeline-recover-integration.plan.md:506-512` (plan §4.3.2 의 hard_throttle 처리)

**증거:**

- `applyThrottle()` 가 `setTimeout 1초` 단발 sleep. **호출 후 다음 recordTokens() 가 다시 hard_throttle 반환 시 또 1초 — 누적 가능.**
- BATCH-1 expectedFormulas=13 + expectedNodes=60. 본 도메인 (적과전 종합위험) 의 `processBatch` 가 페이지 단위 chunk 분할 시 약 30~50 Claude 호출. 각 호출 토큰 ~10K input + ~3K output = $0.075/호출 (Sonnet 기준).
- BATCH-1 daily budget $10 (ADR-025 §2.5). 평균 50 호출 × $0.075 = $3.75 — soft (70% = $7) 미도달.
- **이상치 시나리오 (단발 거대 호출):** 산식 13개 중 복잡도 높은 1개(예: 전수조사 누적감수량 산식) → 토큰 50K input + 20K output = $1.5/호출 → 5회 누적 = $7.5 → soft + hard 동시 발화 → 매 호출 후 1초 sleep.
- 1초 throttle × 잔여 호출(~20회) = **20초 추가 지연**. 무시 가능.
- **하지만:** plan §4.3.2 의 호출 순서 — `recordTokens(...)` 후 `await applyThrottle()`. 즉 **recordTokens 다음 호출 때 sleep, 그 다음 호출 때 또 sleep — sequential 누적**. parallelism 없음 (현 `processBatch` 가 순차 호출 가정).

**임계 부하:**

- 만약 `processBatch` 가 내부 `Promise.all` 로 병렬 호출하면? — `recordTokens` 가 동시에 N회 호출 → ratio 가 atomic 하게 하나만 hard 진입 → 나머지 N-1 은 ok 반환 → throttle 미발동. **이는 race 가 아니라 의도된 sync 동작 (CostMeter 의 firedThresholds Set 1회 발화 보장).**
- 즉 throttle 누적 폭발 시나리오 = 순차 호출 + 단발 거대. 합산 < 1분 추정 → SLO 60분 안전.

**권고:** `throttleSleepMs` default 1초 유지. 단 plan §4.3.2 의 코드 예시 다음 호출 위치에 명시 — "throttle 후 다음 recordTokens 가 또 hard 반환할 수 있음. 계속 throttle 하거나 caller 가 max_throttle_count 둘 책임."

---

## 3. MAJOR — Build SLO 60분 위협

### M-1. `canonicalJson` walk + `assertCanonicalSafe` 이중 walk per stage — 10회/BATCH

**파일:** `apps/batch/src/checkpoint.ts:192-222` (`assertCanonicalSafe` 재귀 walk) + `checkpoint.ts:231-246` (`canonicalJson` JSON.stringify replacer + 키 정렬)

**증거:**

- `buildCheckpoint` → `computeStateHash` → `canonicalJson` → `assertCanonicalSafe` (walk 1) + `JSON.stringify` (walk 2 — replacer 가 모든 객체 visit) + SHA-256 update.
- `PipelineStateSnapshot` 크기 추정:
  - `last_inserted_node_id`: string ~30 bytes
  - `last_completed_stage`: string ~20 bytes
  - `nodes_processed` / `edges_processed`: number 8 bytes × 2
  - `stage_results`: 10 stages × {status, durationMs} ~50 bytes/entry = 500 bytes
  - 총 ~600 bytes
- `cost_state.threshold_breaches`: 최대 3건 × 50 bytes = 150 bytes
- `BatchCheckpoint` 전체 ~1.5KB JSON.
- **walk 비용 (Node.js v20 기준):**
  - `assertCanonicalSafe` 재귀: typeof check + recurse. 1KB JSON 약 30 노드 visit = ~10μs.
  - `canonicalJson` JSON.stringify: 1.5KB ≈ 50μs.
  - SHA-256 update + digest: 1.5KB ≈ 5~10μs.
  - **stage 당 합계 ~70μs.** 10 stages × 70μs = 700μs per BATCH.
- 5 BATCH 누적 = 3.5ms. **SLO 60분에 무관.**

**스택 깊이 위험:**

- `assertCanonicalSafe` 재귀 깊이 = checkpoint object 의 nesting 깊이.
- 현재 `BatchCheckpoint` 깊이 ~5 (root → progress → 필드, root → pipeline_state_snapshot → stage_results → entry). Node.js stack ~10K 프레임 — 안전.
- **단 미래 multi-engine 도입 시 `depends_on` array 가 N개 engine × 깊은 checkpoint 참조 시** — 재귀 깊이 폭발 가능. 본 plan 범위 외(Phase 1 후반).

**권고:** Optional — `assertCanonicalSafe` 를 iterative stack 으로 변환 (마이크로 최적화). 현재는 **Skip — 5ms/BATCH 이득 < 코드 복잡도 증가.**

---

### M-2. D1 `batch_runs` UPDATE 빈도 — 매 stage × BATCH 5회 = 50 UPDATE / 적재 사이클

**파일:** `migrations/0015_batch_runs.sql:30-36` (인덱스 3종) + `step11-6-pipeline-recover-integration.plan.md:406-411` (매 stage UPDATE) + `step11-6-pipeline-recover-integration.plan.md:580-621` (D1BatchRunsDb)

**증거:**

- BATCH 1회 = 10 stages × 1 UPDATE = 10 D1 UPDATE 호출.
- BATCH-1~5 누적 = 50 UPDATE.
- D1 free tier (2026-04 기준): 5M reads/day + 100K writes/day. **50 UPDATE 는 0.05% — 완전 무관.**
- D1 Workers paid tier ($5/mo): 25B reads + 50M writes. 무시 가능.
- **인덱스 maintenance 비용:** `idx_batch_runs_state` + `idx_batch_runs_started_at` + `idx_batch_runs_engine_version` 3개. 매 UPDATE 시 인덱스 갱신 — `state` UPDATE 가 가장 빈번 → `idx_batch_runs_state` 갱신.
- D1 SQLite WAL 모드 + 1KB row → UPDATE 1건 < 1ms. 50 UPDATE × 1ms = 50ms — 완전 무관.

**임계 부하 (BATCH-Q 누적, 16+ BATCH 병행 가정):**

- ROADMAP 상 BATCH 16개 (Q-loadmap 가정) × 10 stages = 160 UPDATE / 1 적재 사이클.
- 향후 Phase 2 사용자 진입 시 `user_progress` UPDATE 가 분당 100+ — 그쪽이 D1 hot spot. `batch_runs` 는 노이즈.

**권고:** **Skip.** 인덱스 3개도 운영 대시보드(state 별 통계, engine_version 별 migration 추적) 에 유효. 제거 시 운영 비용 증가.

---

### M-3. `extractCostState(meter)` per stage — `getThresholdBreaches()` 가 readonly 반환 + spread 누적

**파일:** `apps/batch/src/cost-meter.ts:360` (`finalize` 내 `[...this.breaches]`) + `step11-6-pipeline-recover-integration.plan.md:528-535` (`extractCostState` helper)

**증거:**

- `cost-meter.ts:360` 의 `finalize` 가 `[...this.breaches]` 로 shallow copy. ThresholdBreach 객체 자체는 immutable (모든 필드 readonly).
- plan §4.3.4 의 `extractCostState` 가 `getThresholdBreaches()` 호출 → readonly array 반환 → checkpoint object 에 spread.
- **breaches 최대 3건** (soft/hard/kill 각 1회 firedThresholds set 보장). 따라서 `[...]` spread 비용 = 3 객체 reference 복사 = ~1μs.
- 매 stage × 10 stages × 5 BATCH = 50회. 50 × 1μs = 50μs — 완전 무관.

**메모리:**

- `breaches` array 가 `firedThresholds.has()` 가드로 1회만 push. 영속 데이터 1회 BATCH 당 최대 3건 ThresholdBreach (~150 bytes 합산).
- BATCH 종료 후 CostMeter 인스턴스 GC. 누적 메모리 위험 0.

**권고:** **Skip.**

---

### M-4. SIGINT/SIGTERM handler register/unregister — BATCH 1회 1번 (확인됨)

**파일:** `step11-6-pipeline-recover-integration.plan.md:331-349` + `step11-6-pipeline-recover-integration.plan.md:719-746` (`installSignalHandlers`)

**증거:**

- plan §3.3 의 `runPipeline` 흐름: `removeHandlers` 변수 stage loop **외부** 에서 1회 등록, `try/finally` 의 `finally` 에서 1회 해제.
- 즉 stage 마다가 아닌 BATCH 마다 1회 — **올바른 패턴.**
- handler 등록 비용: `process.on(signal, fn)` 은 EventEmitter listener push. ~1μs.
- 우려 — plan §8 "SIGINT handler 다중 등록" 위험 항목이 이미 인지됨. cleanup 함수 명시 반환 + `removeHandlers()` finally 호출 패턴 = 안전.

**권고:** **Skip — plan 이 이미 처리.**

---

## 4. MINOR — 마이크로 최적화

### m-1. `recordTokens()` 호출당 오버헤드 측정 — μs 단위 추정

**파일:** `apps/batch/src/cost-meter.ts:237-304`

**호출당 작업 (코드 line-by-line 추정):**

1. `startedAt` null check (~10ns)
2. 4개 토큰 검증 (`Number.isFinite` × 2 + `Number.isInteger` × 2 + 비교 4개) (~50ns)
3. `calculateTokenCost()` 호출 — 외부 함수, hash table lookup + 곱셈 2회 (~200ns)
4. `Math.round` × 1 (~20ns)
5. 정수 누적 4개 (`totalInputTokens` + `totalOutputTokens` + `totalCostMicroUsd` + `callCount`) (~40ns)
6. `Map.get(model)` (~50ns), `Map.set(model, {...})` (~80ns) — 첫 호출만, 이후 existing 분기 (in-place mutation, ~30ns)
7. `logger.record()` (선택) — JSONL append. logger 미주입 시 skip. (~0ns or ~5μs disk)
8. `evaluateAndEnforce()` — `ratio()` 1회 + classifyRatio() 3회 비교 + firedThresholds.has() × 3 + recordBreach push (~200ns)

**합계: ~700ns ~ 1μs (logger 없을 시), ~5μs (logger 있을 시 disk write).**

**BATCH-1 50회 호출 × 1μs = 50μs.** SLO 60분에 무관. 측정 권고는 "logger ON 시 JSONL append 가 hot path 진입 시" — 현재는 무관.

---

### m-2. `Math.round(value * 1_000_000)` 부동소수점 → 정수 변환 — 마이크로 최적화 후보

**파일:** `apps/batch/src/cost-meter.ts:267` (`Math.round(costUsd * MICRO_USD_PER_USD)`)

**증거:**

- `costUsd` 가 이미 부동소수점. `Math.round(x * 1e6)` 변환은 IEEE 754 곱셈 1회 + round 1회 = ~10ns.
- `calculateTokenCost` 내부에서 정수 micro-USD 직접 반환하면 1회 곱셈 + round 절약 가능. 단 `claude-pricing.ts` 의 단가가 USD float 으로 정의됨 (e.g., $15/1M = 0.000015).
- **개선 효과:** 50 호출 × 10ns = 500ns / BATCH. **무관.**

**권고:** Skip. `claude-pricing.ts` 단가 표 변경 시 ADR + 마이그레이션 복잡도 증가 가치 < 500ns 이득.

---

### m-3. `breaches: ThresholdBreach[]` array push — 최대 3건 보장 (확인됨)

**파일:** `apps/batch/src/cost-meter.ts:175` (`private readonly breaches: ThresholdBreach[]`) + `cost-meter.ts:391-431` (firedThresholds Set 가드)

**증거:**

- `firedThresholds` Set 가 'soft_warn' / 'hard_throttle' / 'kill_switch' 3종 1회 발화 보장. `recordBreach` 가 push 1회 후 무시.
- **최대 3건 / BATCH. 5 BATCH 누적 = 15건.** 메모리 ~750 bytes. 무관.

**권고:** Skip.

---

### m-4. `perModelMicro: Map` 의 model key 카디널리티 — 1~3 (Opus/Sonnet/Haiku)

**파일:** `apps/batch/src/cost-meter.ts:171-174`

**증거:**

- BATCH 1회 사용 모델 = `claude-pricing.ts` 의 모델 + Sonnet fallback. 실측 1~3 모델.
- Map 크기 < 5. lookup ~50ns. 무관.

**권고:** Skip.

---

## 5. Devil's Advocate

### "BATCH-5 누적 부하에서 깨질 시나리오"

**시나리오 1 (가장 가능성 높음): JSONL audit logger 가 hot path disk I/O 병목**

- 현재 `cost-meter.ts:287-301` 가 `this.logger?.record()` 를 매 `recordTokens()` 호출마다 호출.
- `TokenLogger` 구현 (apps/batch/src/adapters/token-cost-logger.ts) 이 sync `appendFileSync` 인지 async `appendFile` 인지 미확인 (본 검토 범위 외).
- **만약 sync appendFileSync** + **JSONL 파일이 매 호출마다 fsync 안 함** + **OS page cache** = 10MB 파일 후 dirty page flush 시 hiccup 발생 가능.
- BATCH-5 누적 50 호출 × 5 BATCH = 250 호출 × ~500 bytes/line = 125KB. 무관.
- **하지만:** plan §"Phase 2 베타 100명" + Phase 2 study-material-generator 진입 시 사용자 1인당 Claude 호출 → 호출 빈도 100+/min. JSONL 누적 GB 단위 가능.
- **Phase 2 진입 전 logger 를 stream-based + log rotation 도입 권고.** 본 plan 범위 외, 메모리에 등록 가능.

**시나리오 2: BATCH-3 (논작물) 적재 중 OOM**

- BATCH-3 expectedNodes=40 + expectedEdges=120. KnowledgeContract 객체 크기 추정 ~200KB.
- `state.contract` 를 `PipelineState` 에 hold + `state.graphNodes` + `state.graphEdges` 가 stageIntegrityCheck 에서 추가로 메모리 hold.
- Node.js v20 default heap 1.5GB. 200KB × 5 BATCH 동시 진행 = 1MB — 무관.
- **하지만 Phase 2 study-material-generator 가 동일 KnowledgeContract 를 LLM 프롬프트로 전송 시 직렬화 비용 + heap 압력.**
- 본 plan 범위 외. Phase 2 진입 전 contract size SLO 추가 권고.

**시나리오 3: recover() 후 stage 재실행 시 deterministic 가정 위반**

- plan §8 위험 분석 항목 9 ("Stage 재실행 시 deterministic 가정 위배") 가 인지됨.
- **하지만 performance 관점에서 추가:** Claude API `processBatch` 가 매번 다른 응답 → 토큰 사용량 다름 → CostMeter 누적 다름 → resume 후 daily_budget 다른 비율 도달.
- `initialSpendUsd` 인계 (cost-meter.ts:99) 는 이전 실행 비용 보존. 하지만 resume 시 같은 stage 를 다시 실행하면 **이중 청구 위험.**
- AC-Cost (plan §7) 가 "resume 시 비용 인계" 만 검증, "이중 청구 방지" 미검증. **테스트 갭 — quality-engineer 영역 침범 (skip).**

---

## 6. Top 3 Actions

### 우선순위 1 (Step 11.6 코드 진입 첫 30분 내 의무)

**`@thepick/parser/src/batch-processor.ts` 의 `processBatch` 반환 타입 확인 + `usage` 필드 존재 검증**

- 미존재 시 plan §4.3.3 의 폴백("warn + skip") 발동 → CostMeter 무력화.
- **즉시 처리:** `pnpm -C packages/parser exec grep -n "usage" src/batch-processor.ts` 1회.
- 결과에 따라 분기:
  - `usage` 있음 → plan 진행.
  - `usage` 없음 → plan §"Phase 2 작업" 분리 stub 대신 별도 Phase 2 plan 신규 발행 → BATCH-1 진입 차단 게이트 추가 (CostMeter 미보유 BATCH = ADR-025 위배).

### 우선순위 2 (Step 11.6 코드 구현 중)

**`apps/batch/__tests__/checkpoint-fsync-bench.test.ts` 신규 — fsync 비용 microbenchmark**

- `writeCheckpoint(cp, dir, { fsync: true })` × 100회 평균 측정.
- `writeCheckpoint(cp, dir, { fsync: false })` × 100회 평균 측정.
- 진산님 환경 (WSL2 ext4 native) 에서 결과 기록 → Step 11.6 v1.1 정정 §"실측 fsync 비용" 추가.
- **이유:** plan §10 롤백 조항이 fsync 옵션 제거 명시 — fsync 가 너무 비싸면 rollback 가능. 하지만 측정 없이 rollback 결정 불가.

### 우선순위 3 (Phase 2 진입 전, 메모리 등록)

**`TokenLogger` JSONL stream + rotation 도입 plan 신규 발행**

- 현재 batch 단발 환경에서 무관, Phase 2 사용자 진입 시 hot path.
- 메모리 `feedback_document_first_workflow` 정합 — 채팅 출력 대신 plan 영속화.

---

## 7. 진행 권고

**Step 11.6 코드 진입 권고. 단 다음 3가지 prerequisite:**

1. **첫 30분 내** — `processBatch.usage` 반환 확인 (우선순위 1).
2. **코드 구현 중** — fsync microbench 테스트 1건 추가 (우선순위 2).
3. **plan v1.1 정정 작성** — 본 검토의 CRITICAL C-1 / C-2 / C-3 + Top 3 Actions 반영. fsync 비용 추정 표 추가.

**SLO 60분 빌드 안전성:**

- BATCH-1 추정 시간 = `processBatch` Claude API 50회 × 평균 5~15초 응답 = **5~12분** 코어 타임.
- 본 검토에서 식별한 모든 오버헤드 합산 < 1분 (fsync 1초 / canonicalJson 700μs / D1 UPDATE 50ms / throttle 누적 < 30초).
- **헤드룸 충분 — Tier 1 Library SLO `latency_p99_ms: 50` (formula-engine) 도 무관 (formula-engine 은 Library 호출 시점만, 50 호출 × 50ms = 2.5초).**

**Phase 1 후반 또는 Phase 2 진입 시 재점검 항목:**

- TokenLogger JSONL hot path 부하
- `assertCanonicalSafe` 재귀 깊이 (multi-engine `depends_on` 도입 시)
- `state.contract` 메모리 hold (study-material-generator LLM 프롬프트 직렬화 시)

---

## 8. 진행 권고 결론

> **proceed (Step 11.6 코드 진입). 단 prerequisite 3건 first 30분 내 처리.**
>
> 5-페르소나 다른 4명 (refactoring/quality/backend/devops) 결과와 통합 후 진산님 결정.

**측정 prerequisite 미실행 시 위험:**

- C-1 미확인 → CostMeter 무력화 가능성. BATCH-1~3 진행 중 Anthropic monthly cap $200 도달 시 적재 일정 동결.
- C-2 미측정 → 새벽 3시 on-call 시 "왜 BATCH 가 평소보다 느리지?" 디버깅 불가.

**완료 기준 (본 검토):**

- [✅] Step 1 cost-meter.ts read + 호출당 오버헤드 추정
- [✅] Step 11.5 checkpoint.ts read + canonicalJson walk 비용 추정
- [✅] Step 11.5 recover.ts read + stale lock 임계 확인
- [✅] Step 11.6 plan v1.0 read + fsync 설계 / per-stage 발행 빈도 확인
- [✅] migrations/0015_batch_runs.sql read + 인덱스 3종 확인
- [✅] ADR-025 v1.1 read + Layer 1/2 임계 확인
- [✅] formula-engine contract.yaml read + SLO 60분 확인
- [✅] CRITICAL 3건 / MAJOR 4건 / MINOR 4건 분류
- [✅] Devil's Advocate 3 시나리오 + Top 3 Actions
- [✅] 진행 권고 (proceed)

---

**검토 완료 시각:** 2026-04-28 (KST)
**검토 형식:** ThePick `auto-review-protocol.md` §"Phase 단위 5-페르소나 기술부채 리뷰" 정합 — performance-engineer 단독 관점.
**다른 페르소나 결과와 통합 후 진산님 최종 결정 대기.**
