# Engine Hardening 중간 점검 — Refactoring 관점

**작성일:** 2026-04-28 (KST)
**관점:** 코드 품질 부채 — "6개월 뒤 이 코드가 버틸까?"
**검토 범위:** `apps/batch/src/{cost-meter, checkpoint, recover, pipeline}.ts` + Step 11.6 plan v1.0
**검토자:** refactoring-expert (독립 에이전트, 코드 작성 컨텍스트 없음)
**중복 회피:** performance / quality / backend / devops 영역 침범 X — 캡슐화·결합·명명·마법수·L3 안전성에 한정

---

## 1. 한 줄 평가

> **partial proceed** — 코드 자체의 품질은 견고하지만, Step 11.6 plan 의 §4.3.4 가 **존재하지 않는 cost-meter API 3개를 전제** 하고 있다. 이 1건만 plan 정정하면 코드 진입 가능. 6개월 뒤 부채 위험은 △ 보통 (3개 모듈 각각은 OK, 통합 후 PipelineContext 폭발 가능성이 잠재).

---

## 2. CRITICAL (즉시 정정 필요)

### C-1. Plan §4.3.4 가 존재하지 않는 CostMeter getter 3개를 전제

**파일:** `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:528-537`

**증거:**

- plan §4.3.4 (line 528-537) 의 `extractCostState` helper:
  ```typescript
  return {
    initial_spend_usd: meter.getInitialSpendUsd(),
    call_count: meter.getCallCount(),
    threshold_breaches: meter.getThresholdBreaches(),
  };
  ```
- plan §2.1 (line 142-145) — "현재 시그니처에 `getInitialSpendUsd` / `getCallCount` / `getThresholdBreaches` 가 있음 — §2.1 확인" 명시.
- 실제 `cost-meter.ts` grep — `getInitialSpendUsd|getCallCount|getThresholdBreaches` **3개 모두 NOT FOUND** (검증: `grep -n "getInitialSpendUsd\|getCallCount\|getThresholdBreaches" cost-meter.ts → NOT FOUND`).
- 노출된 public API 는 `start / recordTokens / getCurrentSpend / getStatus / ratio / applyThrottle / triggerKillSwitch / finalize` 만 (cost-meter.ts:221-365).

**근거:** Plan 자체가 "현재 시그니처 확인" 했다고 자기 인증했지만 **거짓**. 6개월 뒤가 아니라 코드 진입 첫 시간에 컴파일 에러로 깨진다. CRITICAL RULE #2 (stub 금지) 와 동등하게 plan 의 phantom API 참조다.

**정정 방향 (3안):**

- A) cost-meter.ts 에 3개 getter 신규 추가 (필드는 이미 private 보유 — `initialSpendMicroUsd / callCount / breaches`).
- B) `extractCostState` 가 `meter.finalize()` 결과의 일부를 참조 (단, finalize 는 BATCH 종료 시 1회 호출 의도 — 중간 호출 시 duration 의미 변질).
- C) `CostMeter` 가 직접 `toCheckpointCostState(): CheckpointCostState` 메서드 노출 (캡슐화 우월, 권장).

**판정:** plan 진입 전 정정 의무. C 권고 — `cost-meter.ts` 가 `checkpoint.ts` 의 `CheckpointCostState` 형태를 알면 결합도가 늘지만, 현 plan §4.3.4 는 이미 그 결합을 전제한다. 차라리 하나의 메서드로 명시.

---

## 3. MAJOR (다음 단계 진입 전 정정)

### M-1. `BatchRunsDb` 인터페이스가 이미 mixed responsibility — `insertNewRun` 추가 시 더 악화

**파일:** `apps/batch/src/recover.ts:57-70` + plan §3.3 line 316 + plan §4.4 line 558-578

**증거:**

- 현재 `BatchRunsDb` (recover.ts:57-70):
  ```typescript
  export interface BatchRunsDb {
    selectByRunId(...): Promise<BatchRunRow | null>;
    updateState(...): Promise<void>;
  }
  ```
- 인터페이스 명은 "BatchRunsDb" (DB 어댑터) 인데 메서드 이름은 비즈니스 액션 (`updateState` — 상태 머신 전이).
- plan §3.3 (line 316) 에서 `ctx.batchRunsDb.insertNewRun({...})` 호출 — 인터페이스에 메서드 추가 의도.
- plan §4.4 line 558-578 의 `D1BatchRunsDb.insertNewRun` 시그니처는 `{ batchRunId, fixturePath, engineVersion }` 받지만, recover.ts 의 인터페이스에는 `insertNewRun?: optional` 로 추가 (plan §8 위험 분석 line 889 에서 명시).
- 결과: `recover()` 는 select/update 만 사용하지만, pipeline 통합 후 `insertNewRun` 도 같은 인터페이스에 떠다님 — Single Responsibility 위반.

**근거:** 6개월 뒤 누군가 `BatchRunsDb` 를 보면 "왜 select/update 하는 어댑터에 insert 만 optional 이지?" 라는 질문을 한다. 이는 **인터페이스 분리 원칙 (ISP)** 위반의 대표 징후. Year 2 멀티시험 진입 시 `exam_id` 컬럼 추가하면 `insertNewRun` 시그니처가 또 한 번 깨진다.

**정정 방향:**

- 분리: `BatchRunsReader` (selectByRunId) + `BatchRunsLifecycle` (insertNewRun, updateState).
- 또는 `BatchRunsDb` 라는 이름을 `BatchRunsRepository` 로 변경하고 모든 lifecycle 메서드 명시.
- 차선: 현재 이름 유지, 단 `insertNewRun` 을 `?optional` 가 아닌 required 로 (반쯤 이쪽 반쯤 저쪽 = 가장 나쁨).

### M-2. `PipelineContext` 의 5+개 신규 필드 — explosion 시작점

**파일:** `apps/batch/src/pipeline.ts:168-196` + plan §3.1 line 202-241

**증거:**

- 현재 `PipelineContext` (pipeline.ts:168-196) 는 이미 13개 필드 (`batchId / config / pdfPath / claudeClient / visionClient / db / dryRun / outDir / enableVisionOcr / goldenTests / versionYear / fixtureContract? / pdfPagesOverride?`).
- plan §3.1 (line 218-240) 신규 필드 7개 추가 예정: `batchRunId / checkpointBaseDir / batchRunsDb / costMeter? / engineVersion / enableSignalHandlers? / fsyncCheckpoint?`.
- 통합 후: **20개 필드**. 그 중 4개 required (`batchRunId`, `checkpointBaseDir`, `batchRunsDb`, `engineVersion`) — 진산님 §13 항목 2 권고 A 승인.
- 이미 잠재 클러스터: "PDF 입력 묶음" (pdfPath, pdfPagesOverride, fixtureContract) / "DB 입력 묶음" (db, batchRunsDb) / "옵션 묶음" (dryRun, enableVisionOcr, enableSignalHandlers, fsyncCheckpoint).

**근거:** 검토 질문 #3 답. **Constructor over-injection** 패턴은 6개월 뒤 새 필드 추가가 cascading 한다. Year 2 멀티시험 진입 시 `examId` 추가 → 21개. ai-adapter 실구현 시 추가 → 22개. 객체 생성 위치(테스트 fixture / production caller) 가 모두 영향 받는다.

**정정 방향 (Step 11.6 코드 진입 전 1회 결정):**

- 묶음 분리: `PipelineContext = { core + io + recovery + cost + signals }` 5개 sub-object.
- 또는 builder 패턴: `PipelineContextBuilder.withRecovery({...}).withCostMeter(...).build()`.
- 본 plan 단계에서 안 하면 Year 2 에 더 비싸진다 (caller 가 더 많아진 후 분리는 painful).

### M-3. `recover.ts` 의 RecoveryStatus 6종이 유사한 분기를 6번 반복

**파일:** `apps/batch/src/recover.ts:113-247`

**증거:**

- `recoverBatch()` (line 113-247) 본문 안에서 `RecoveryResult` 객체를 6번 직접 생성 — 모두 동일한 7개 필드 패턴 (status / resumed_from_stage / data_loss_estimate / fallback_strategy? / user_notification_required / message / checkpoint?).
- 예시:
  - line 121-127 (`already_completed`) — 7 필드
  - line 138-148 (`concurrent_run_detected`) — 7 필드
  - line 159-174 (`no_checkpoint`) — 8 필드
  - line 178-192 (`recovery_failed` from corruption) — 8 필드
  - line 196-208 (`recovery_failed` from version mismatch) — 8 필드
  - line 217-228 (`recovery_failed` from depends_on) — 8 필드
  - line 236-247 (`fully_recovered`) — 8 필드
- `data_loss_estimate.severity` 매핑이 status 별로 다르지만 일관된 규칙 (none/minor/major/critical) 도 직접 작성 — 미래 status 추가 시 또 7 필드 작성.

**근거:** 6개월 뒤 새 status (예: `partially_recovered_with_warnings`) 추가 시 또 8 필드 작성. **Builder 또는 factory function** 으로 묶는 것이 정석. 또는 status 별 default factory map.

**정정 방향:**

```typescript
function buildRecoveryResult(
  status: RecoveryStatus,
  options: {
    resumedFrom?: PipelineStage;
    lastNodeId?: string;
    checkpoint?: BatchCheckpoint;
    reason?: string;
  },
): RecoveryResult {
  /* status 별 default + override */
}
```

- 본 plan 안에 안 들어가도 OK. Step 17 또는 Year 2 정리.

### M-4. `pipeline.ts` 의 stage dispatch 가 `switch` 인데 stage 추가 시 누락 가능

**파일:** `apps/batch/src/pipeline.ts:261-299`

**증거:**

- `runStage()` (pipeline.ts:268-289) — 10개 stage 를 switch 로 분기.
- TypeScript 의 exhaustiveness check 는 있지만 (default branch 부재 + return 강제), **새 stage 추가 시 컴파일 에러로 알아채는 것이 유일한 안전망**.
- `PIPELINE_STAGES` 배열 (line 79-90) 과 `runStage` switch 가 **2곳 동기화 의무**.
- Step 11.6 plan §3.3 line 367-413 에서 추가 분기 (resume index check, checkpoint 발행) 가 들어가면 switch 가 더 비대해질 가능성.

**근거:** plan 통합 후 한 함수에 너무 많은 책임 — dispatch + recovery skip + checkpoint 발행 + state update + cost meter await. 검토 질문 #10 답.

**정정 방향:**

- Stage handler 를 `Map<PipelineStage, StageHandler>` 로 변환 — 컴파일 시점 strict 검증 + 핸들러 추가가 1곳.
- 또는 `PIPELINE_STAGES` 가 `[stage, handler]` 튜플 배열. switch 제거.
- Step 11.6 진입 시 권장 — 통합 코드의 가독성을 위해.

---

## 4. MINOR (이연 가능)

### m-1. `1000` (throttleSleepMs 기본값) — 명명 상수화 누락

**파일:** `apps/batch/src/cost-meter.ts:208`

**증거:** `this.throttleSleepMs = options.throttleSleepMs ?? 1000;` — 1초 default 가 magic number.

**근거:** 검토 질문 #8 답. `STALE_LOCK_THRESHOLD_MS` 와 동일 패턴으로 `DEFAULT_THROTTLE_SLEEP_MS = 1000` 추출 권장.

### m-2. `MICRO_USD_PER_USD` 가 file-private 상수 (export X)

**파일:** `apps/batch/src/cost-meter.ts:131`

**증거:** `const MICRO_USD_PER_USD = 1_000_000;` — module-level. 외부 (예: 향후 audit logger / dashboard) 에서 microUsd ↔ USD 환산할 때 다시 정의될 위험.

**근거:** DRY 원칙. export const 로 노출 권장.

### m-3. `parseMajor` 의 정규식 `/^(\d+)\.(\d+)\.(\d+)/` 가 trailing whitespace / SemVer pre-release 미허용

**파일:** `apps/batch/src/checkpoint.ts:380-389`

**증거:** `1.0.0-beta.1` 또는 ` 1.0.0` (leading whitespace) 가 throw — 정상이지만 6개월 뒤 누군가 pre-release 버전을 `engine_version` 에 넣으면 silent throw 보다 명확한 에러가 좋음.

**근거:** 현재 `[Checkpoint] Invalid semver: 1.0.0-beta.1` 메시지는 명확. 단, 정규식 자체에 명시 주석 (`// SemVer pre-release / build-metadata 미지원 — 의도적`) 추가 권장.

### m-4. `recover.ts` 의 한국어 메시지 직접 작성 — i18n 키 부재

**파일:** `apps/batch/src/recover.ts:126, 144-146, 169-173, 189-191, 203-206, 223-226, 241-245`

**증거:** `message: '...진산님 결정 후 처음부터 재시작 필요.'` 등 8건. CLAUDE.md `auto-review-protocol.md` Pass 3 의 i18n 항목.

**근거:** 본 BATCH 는 진산님 단독 사용 — 즉시 i18n 안 해도 OK. Year 2 사용자 노출 면 진입 시 처리. 단, 메시지 누적이 Year 2 분리 비용을 키운다 — 가능하면 message constants 로 추출.

### m-5. `checkpointPath` 의 sanitize 정규식이 다른 모듈에서 재사용 불가

**파일:** `apps/batch/src/checkpoint.ts:374-378`

**증거:** `batchRunId.replace(/[^a-zA-Z0-9_\-.]/g, '_');` — file-system safe identifier 패턴. JSONL audit logger 등에서 동일 sanitize 가 필요해질 수 있다.

**근거:** Year 2 또는 audit logger 추가 시 중복 방지. `packages/shared/src/utils/safe-id.ts` 로 분리 가능. 이연 OK.

---

## 5. Devil's Advocate — "이게 깨질 수 있는 시나리오"

### 시나리오 1: `assertCanonicalSafe` 통과 후 `JSON.stringify` 가 silently 손실

**파일:** `apps/batch/src/checkpoint.ts:192-246`

**문제:**

- `assertCanonicalSafe` 는 Date/Map/Set/BigInt/Function 만 검출 — `WeakMap` / `WeakSet` / `Symbol` / `Promise` / circular reference 미검사.
- 예시: `state.contract.nodes[0].metadata = new WeakMap()` 같은 객체가 들어오면 `JSON.stringify` 가 `{}` 로 silent collapse — `state_hash` 는 계산되지만 의미는 손실.
- 또 `Object.create(null)` 객체는 `Object.keys()` 가 동작하지만 prototype chain 이 없어서 `instanceof` 검사 실패. 우회 가능.

**6개월 뒤 영향:**

- `processBatch` 의 결과 객체에 새 필드 (예: 디버그 metadata) 가 추가될 때 silent collapse → AC-R1 통과되지만 실제 recover 후 일부 정보 손실.
- 4-Pass 미검출 가능성 높음 (mock test 는 plain object 만).

**대응:**

- `assertCanonicalSafe` 에 `WeakMap / WeakSet / Symbol / Promise / circular ref` 추가.
- 또는 `JSON.stringify` 결과를 다시 `JSON.parse` 후 deep-equal 검증 (defensive — 비용 있음).
- Step 11.6 통합 시점에 1회 점검 권고.

### 시나리오 2: `recoverBatch` 가 `concurrent_run_detected` 판정 후 즉시 stale lock 만료 — race window

**파일:** `apps/batch/src/recover.ts:130-149`

**문제:**

- line 133-136: `Date.now() - new Date(row.started_at).getTime()` 로 elapsed 계산 → `staleThreshold` (24h) 비교.
- 두 프로세스가 거의 동시에 recover 시도 → 양쪽 모두 elapsed < threshold → 양쪽 모두 `concurrent_run_detected` → 양쪽 모두 retry 안내 → 진산님 둘 다 같은 시간에 또 시도 → ...

**6개월 뒤 영향:**

- Mock test 는 sequential 호출만 검증. 실 D1 multi-process 시 발화 가능.
- 단일 진산님 환경에서는 발생 가능성 낮음. Year 2 multi-tenant 진입 시 위험.

**대응:**

- 0015 트리거의 BEFORE INSERT 가 SQL 레벨 atomic guard — 본 plan 의 §6 D1 Preview 검증으로 cover.
- 단, recover.ts 자체는 `selectByRunId` 후 클라이언트 측 판정만 — race 가능. plan §6 검증 시 명시 시나리오 추가 권고.

---

## 6. Top 3 Actions

### Action 1: Plan §4.3.4 정정 — `cost-meter.ts` 에 `toCheckpointCostState()` 메서드 추가 (CRITICAL C-1)

- 파일: `apps/batch/src/cost-meter.ts` (메서드 신규) + plan §4.3.4 정정.
- 작업: `cost-meter.ts` 에 단일 메서드 노출:
  ```typescript
  toCheckpointCostState(): CheckpointCostState {
    return {
      initial_spend_usd: this.initialSpendMicroUsd / MICRO_USD_PER_USD,
      call_count: this.callCount,
      threshold_breaches: this.breaches.map(b => ({
        threshold: b.threshold,
        at_spend_usd: b.at_spend_usd,
        at_ratio: b.at_ratio,
      })),
    };
  }
  ```
- 트레이드오프: cost-meter 가 checkpoint 의 `CheckpointCostState` 타입을 import 하는 결합 — 양방향이 아닌 단방향 (cost-meter → checkpoint type only) 이라 OK. 또는 `cost-meter` 가 자기 타입 노출하고 pipeline.ts 에서 매핑 (느슨한 결합).
- 추정: 0.1d (테스트 1건 추가 포함).
- 차단: Step 11.6 코드 진입 직전.

### Action 2: `PipelineContext` 묶음 분리 — Step 11.6 진입 전 1회 결정 (MAJOR M-2)

- 파일: `apps/batch/src/pipeline.ts:168-196` 신규 통합 시점.
- 작업: 5개 sub-object 로 분리.
  ```typescript
  export interface PipelineContext {
    readonly batch: { batchId; config; versionYear };
    readonly io: {
      pdfPath;
      claudeClient;
      visionClient;
      db;
      outDir;
      fixtureContract?;
      pdfPagesOverride?;
    };
    readonly recovery: { batchRunId; checkpointBaseDir; batchRunsDb; engineVersion };
    readonly cost?: CostMeter;
    readonly options: {
      dryRun;
      enableVisionOcr;
      enableSignalHandlers?;
      fsyncCheckpoint?;
      goldenTests;
    };
  }
  ```
- 트레이드오프: 기존 caller 수정 비용 (현재 caller 적음 — fixture 위주, 영향 최소). vs Year 2 분리 비용.
- 추정: 0.2d (테스트 fixture 갱신 포함).
- 차단: 본 plan 진입 시 결정 (지금 안 하면 Year 2 에 비싸짐).

### Action 3: `BatchRunsDb` ISP 분리 — `Reader / Lifecycle` (MAJOR M-1)

- 파일: `apps/batch/src/recover.ts:57-70` + 신규 `d1-batch-runs-db.ts`.
- 작업:
  ```typescript
  export interface BatchRunsReader {
    selectByRunId(...): Promise<BatchRunRow | null>;
  }
  export interface BatchRunsLifecycle extends BatchRunsReader {
    insertNewRun(...): Promise<void>;
    updateState(...): Promise<void>;
  }
  // recover() 는 BatchRunsLifecycle 받음 (Reader + state 전이)
  // pipeline() 도 BatchRunsLifecycle 받음 (insert 포함)
  ```
- 트레이드오프: 인터페이스 2개 vs 1개. Year 2 진입 시 각각 `examId` 추가 비용은 동일 (현재 상태에서도 1회). 단, ISP 가 명시되면 Year 2 에 lifecycle 만 mock 하기 쉬움 (test 비용 감소).
- 추정: 0.15d.
- 차단: Step 11.6 진입 시 결정.

---

## 7. 진행 권고

### 권고: **partial proceed** (정정 후 진입)

**이유:**

1. **CRITICAL C-1 (plan-reality 불일치) 만 plan 정정 + Action 1 (코드 0.1d) 처리 후 진입.**
2. **MAJOR M-1 / M-2 / M-3 / M-4 는 Step 11.6 코드 진입 시점에 1회 결정 — 코드 작성 중간에 결정 변경하면 비용 폭발.**
3. MINOR 5건은 모두 이연 가능 — Year 2 정리 또는 별도 cleanup PR.

**진입 절차:**

```
1. 본 검토 결과 + 다른 4 페르소나 결과 통합 (진산님 검토)
2. Action 1 (cost-meter API 추가) 0.1d 즉시 처리 → plan v1.1 정정
3. Action 2 (PipelineContext 묶음) 0.2d 결정 → plan v1.1 §3.1 갱신
4. Action 3 (BatchRunsDb ISP) 0.15d 결정 → plan v1.1 §4.4 갱신
5. plan v1.1 APPROVED 후 Step 11.6 코드 진입
```

**총 추가 비용:** 0.45d (현실, plan v1.1 정정 + 사전 정정 코드 1건). 본 plan 추정 (현실 2.6d) 의 17% 증가. Year 2 비용 절감을 감안하면 양호.

---

## 8. 0건 보고 항목 (검증 증거)

이 검토에서 **CRITICAL 1건 / MAJOR 4건 / MINOR 5건** 발견. 단, 다음 항목은 검증 후 PASS 판정:

### PASS 1: 캡슐화 (검토 질문 #1)

- **확인:** cost-meter.ts:153-448 의 `CostMeter` 클래스 — private 필드 11개 (line 154-177), public API 8개 (start/recordTokens/getCurrentSpend/getStatus/ratio/applyThrottle/triggerKillSwitch/finalize). 책임 = 비용 계측 단일.
- **확인:** checkpoint.ts:149-389 의 함수형 API (buildCheckpoint/computeStateHash/canonicalJson/writeCheckpoint/readCheckpoint/checkpointPath/parseMajor) — 모두 pure 또는 명시적 IO. 클래스 미사용은 의도적 (stateless serialization).
- **확인:** recover.ts:113-247 의 `recoverBatch()` — 단일 entry point, 6 RecoveryStatus 분기. 책임 = 결정 트리 실행.
- **판정:** 캡슐화 OK. 단, M-1 (BatchRunsDb 인터페이스 mixed) 은 별도 issue.

### PASS 2: 타입 안전성 (검토 질문 #9)

- **확인:** `any` 0건 (grep 결과 없음, file 확인).
- **확인:** `unknown` 사용 — `assertCanonicalSafe(value: unknown, path)` (checkpoint.ts:192) — 외부 데이터 walk 의 정석 패턴.
- **확인:** runtime guard — `readCheckpoint` (checkpoint.ts:310-322) 의 typeof 검사 4건 + `state_hash` / `engine_version` / `batch_run_id` / `pipeline_stage`.
- **판정:** 타입 안전성 OK.

### PASS 3: Hard Rule 16 (exam_id 격리, 검토 질문 #7)

- **확인:** 3개 파일 모두 `exam_id / examId / EXAM_IDS` 0건 (grep NO matches).
- **확인:** `BatchCheckpoint.batch_run_id` 는 시험 무관 UUID — Year 2 에 `exam_id` 추가 시 컬럼 추가 + checkpoint shape 확장만 (signature 변경 없음).
- **확인:** `BatchRunsDb` 메서드들도 `batchRunId` 만 받음 — Year 2 에 select WHERE 절 내부 추가 + 메서드 시그니처 동일.
- **판정:** Year 2 마이그레이션 비용 = 낮음. Hard Rule 16 §"Year 2 (exam_id 컬럼 도입 후)" 의 zero-cost 전환 패턴 정합.

### PASS 4: 에러 클래스 일관성 (검토 질문 #5)

- **확인:** 3개 에러 클래스 모두 동일 패턴: `class XError extends Error { constructor(public readonly batchRunId, ...) { super(message); this.name = 'XError'; } }` (checkpoint.ts:95-132).
- **확인:** 각 에러가 `batchRunId` 를 첫 인자로 받음 — context propagation 일관.
- **확인:** 추가 에러 (예: `RecoveryConcurrentError`, `BatchRunsTriggerError`) 도 동일 패턴 따라가면 분산 정의 위험 낮음.
- **판정:** 단, plan §3.3 line 303-307 의 `ConcurrentRunError` / `RecoveryFailedError` 가 어디 정의될지 미명시 — Step 11.6 진입 시 `recover.ts` 에 추가 권고 (한 곳 응집).

### PASS 5: 주석 부패 위험 (검토 질문 #6)

- **확인:** cost-meter.ts:288-290 — TokenLogger 내부 race 가능성 NOTE 주석 + 정정 시점 명시 ("Step 11.5 통합 시점에 logger 인터페이스 확장"). Plan 진행 따라 갱신 필요한 곳.
- **확인:** checkpoint.ts:252-256 — fsync 미적용 NOTE + 갱신 시점 명시 ("Step 11.6 (pipeline 통합) 에서 ... 도입"). Step 11.6 진입 시 주석 갱신/제거 의무.
- **확인:** recover.ts:18-19 — v1.1 정정 이력 주석. 누적 가능. 단, 정정 이력은 git log 와 중복 — 코드 헤더에서 짧게 유지 권고.
- **판정:** 주석 부패 핫스팟 2개 (cost-meter:288-290, checkpoint:252-256) — Step 11.6 진입 시 갱신 의무.

### PASS 6: SHA-256 / canonical JSON 디버깅 가능성 (검토 질문 #4)

- **확인:** `canonicalJson` (checkpoint.ts:231-246) — 14줄, 단순 (sort keys + filter undefined + reject special types via assert).
- **확인:** `assertCanonicalSafe` (checkpoint.ts:192-222) — 30줄, recursive walk, path 추적 (`$.foo.bar[0]` 형식). 디버깅 시 정확한 위치 추출 가능.
- **확인:** `computeStateHash` (checkpoint.ts:179-186) — state_hash 자체 제외 후 canonical → SHA-256.
- **판정:** 6개월 뒤 디버깅 가능. 단, Devil's Advocate 시나리오 1 (WeakMap 등 silent collapse) 엣지케이스 보강 권고.

---

## 9. 종합

**6개월 뒤 이 코드가 버틸까?** — **OK with 3 conditions:**

1. CRITICAL C-1 정정 (Action 1, plan-reality 불일치 해소)
2. PipelineContext 묶음 분리 (Action 2, 신규 필드 폭발 차단)
3. BatchRunsDb ISP 분리 (Action 3, Year 2 마이그레이션 비용 절감)

위 3건 처리 후 Step 11.6 코드 진입 시 코드 품질 부채 위험 = △ 보통 → ○ 낮음.

**Year 2 멀티시험 확장 비용:** Hard Rule 16 정합성 OK (PASS 3). 단, M-2 미처리 시 PipelineContext 가 21+ 필드로 폭발 — Year 2 에 caller 전수 수정 필요.

**검토 종료:** 다른 4 페르소나 (performance / quality / backend / devops) 결과와 통합하여 진산님 결정 대기.

---

**검토자:** refactoring-expert (독립 에이전트)
**산출물:** 본 파일 단독 (다른 페르소나 영역 침범 없음)
**다음:** 5-페르소나 통합 보고 → 진산님 Step 11.6 진입 결정
