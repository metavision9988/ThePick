---
리뷰 방식: 독립 에이전트 (silent-failure-hunter)
리뷰 일시: 2026-04-29 09:44 KST
리뷰 대상: Step 11.6 코드 구현 (본 세션 변경 9건)
리뷰자 컨텍스트: 본 세션 메인 대화 모름 (의도 편향 차단)
---

# Step 11.6 — Silent-Failure Hunter Review

## 0. 검토 범위 (실제로 읽은 파일:라인)

| 파일                                                    | 라인 범위                                                                                      | 목적                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/batch/src/pipeline.ts`                            | 1-948 (전체)                                                                                   | runPipeline 흐름 / toSnapshot / 에러 클래스 / SIGINT closure     |
| `apps/batch/src/checkpoint.ts`                          | 1-541 (전체)                                                                                   | writeCheckpoint / writeCheckpointSync / WriteCheckpointOptions   |
| `apps/batch/src/recover.ts`                             | 1-301 (전체)                                                                                   | BatchRunsDb.insertNewRun / fully_recovered 시 'recovered' UPDATE |
| `apps/batch/src/signal-handlers.ts`                     | 1-62 (전체)                                                                                    | SIGINT/SIGTERM handler + try/catch + process.exit                |
| `apps/batch/src/d1-batch-runs-db.ts`                    | 1-129 (전체)                                                                                   | D1 어댑터 BatchRunsDb 구현                                       |
| `apps/batch/src/in-memory-batch-runs-db.ts`             | 1-141 (전체)                                                                                   | 0015 트리거 invariant 모방                                       |
| `apps/batch/src/loader/draft-loader.ts`                 | 1-383 (전체)                                                                                   | LoadDraftResult.lastInsertedNodeId 추가                          |
| `apps/batch/bin/batch.ts`                               | 1-417 (전체)                                                                                   | CLI 진입점 ENGINE_VERSION + ctx 5 필드 주입                      |
| `apps/batch/src/__tests__/pipeline.integration.test.ts` | 1-394 (전체)                                                                                   | step116TestFields helper / 4 testcases ctx 갱신                  |
| `apps/batch/src/cost-meter.ts`                          | 230-473 (recordTokens / applyThrottle / evaluateAndEnforce / toCheckpointCostState / finalize) | CostMeter 통합 검증                                              |
| `packages/parser/src/batch-processor.ts`                | 320-409 (processBatch 본문)                                                                    | usage 반환 조건                                                  |
| `migrations/0015_batch_runs.sql`                        | 1-95 (전체)                                                                                    | 트리거 3종 invariant                                             |

검토 패턴: 빈 catch / silent drop / fire-and-forget Promise / fsync 누락 / catch 후 흐름 계속 / fallback 미가시화.

---

## 1. CRITICAL (3건)

### CRITICAL #1 — `runPipeline.finally` 의 `removeHandlers()` throw 시 outer try/catch 부재로 finally 자체 throw 가능성

**파일:라인:** `apps/batch/src/pipeline.ts:547-556`

```ts
} finally {
  removeHandlers();              // ← 여기 throw 시 catch 없음
  if (ctx.costMeter) {
    try {
      ctx.costMeter.finalize();
    } catch (err) {
      console.error('[Pipeline] CostMeter finalize 실패 (logged only):', err);
    }
  }
}
```

**증거:** `removeHandlers` 는 `signal-handlers.ts:57-60` 에서 `process.off('SIGINT', sigintHandler)` + `process.off('SIGTERM', sigtermHandler)` 를 수행. process.off 자체는 거의 throw 하지 않으나, **테스트 모드 (`enableSignalHandlers === false`) 에서는 noop arrow function 이라 안전**. 그러나 `signal-handlers.ts:34` 의 cleanup arrow 가 향후 변경되어 throw 가 유입될 경우 outer try/catch 가 부재하여 finally 자체가 throw → caller (CLI) 에서 `[thepick-batch] ERROR` 로 잡히지만 실제 stage 결과는 사라짐.

또한 **`if (ctx.costMeter)` 분기에서 `costMeter.finalize()` 가 try/catch 로 보호되었으나 `removeHandlers()` 는 보호 안 됨**. 본 plan §5.3 "removeHandlers 다중 등록 누적 차단" 의무를 어기진 않으나, **finally 내부 부분 실행 (handler 제거 실패 후 finalize 미실행) 시 process 좀비 상태 + cost 미보고가 동시 silent**.

**Hidden errors:**

- `process.off` 가 EventEmitter listener 갯수 제한 (default 10) 이슈로 RangeError throw 가능
- 향후 `removeHandlers` 가 비동기로 변경 시 await 누락 → unhandledRejection silent
- finally 미완료 시 `costMeter.finalize()` skip → `cost-meter.ts:367-389` 의 CostReport 누락 (운영 대시보드 silent)

**User Impact:** SIGINT 직후 정상 BATCH 종료 시 cost 보고 누락 — `total_cost_usd` 가 어디로 갔는지 추적 불가.

**Recommendation:** `removeHandlers()` 도 try/catch 로 감싸고 양쪽 모두 best-effort 로 보고:

```ts
} finally {
  try {
    removeHandlers();
  } catch (err) {
    console.error('[Pipeline] removeHandlers failed (logged only):', err);
  }
  if (ctx.costMeter) {
    try {
      ctx.costMeter.finalize();
    } catch (err) {
      console.error('[Pipeline] CostMeter finalize 실패 (logged only):', err);
    }
  }
}
```

**Severity 정당화:** finally 는 "마지막 보호망" 이라 catch 누락은 silent failure 의 전형. CRITICAL RULE #3 (try-catch 에서 데이터 조용히 삭제 금지) 의 정신 위반 가능성.

---

### CRITICAL #2 — SIGINT handler 의 `markBatchRunKilled().catch(...)` fire-and-forget 이 process.exit 직전이라 D1 호출이 실제로 도달하지 못할 가능성 (silent collapse)

**파일:라인:** `apps/batch/src/pipeline.ts:434-447` + `apps/batch/src/signal-handlers.ts:36-49`

```ts
// pipeline.ts:435-442
markBatchRunKilled(ctx.examId, ctx.batchRunId, ctx.batchRunsDb).catch((err) => {
  console.error('[Pipeline] markBatchRunKilled failed (best-effort):', err);
});
```

```ts
// signal-handlers.ts:35-49
const handler = (signal: NodeJS.Signals) => () => {
  try {
    console.error(`[Pipeline] ${signal} received — flushing checkpoint before exit`);
    opts.flushCheckpoint();          // ← sync, OK
  } catch (err) {
    console.error(...);
  }
  process.exit(signal === 'SIGINT' ? 130 : 143);   // ← 여기서 즉시 종료
};
```

**증거:**

1. `flushCheckpoint` 콜백 (pipeline.ts:415-443) 안에서 `markBatchRunKilled(...)` 가 호출되지만 **return type 이 `Promise<void>` — fire-and-forget**. handler 의 다음 줄에서 `process.exit(130)` 가 동기 실행됨 (signal-handlers.ts:48). `process.exit` 는 microtask queue 를 flush 하지 않고 즉시 종료 — async D1 호출은 **DNS 조회조차 못 시작**.
2. catch 핸들러 (`console.error('markBatchRunKilled failed ...')`) 도 `process.exit` 이후엔 실행되지 않음 — 실패 자체가 silent.
3. 결과: batch_runs.state 는 'in_progress' 로 남고, 다음 24시간 내 동일 batch_run_id 재진입 시 `concurrent_run_detected` 로 차단 (stale lock 미해소).

**Hidden errors:**

- D1 네트워크 실패 → catch 미실행 → 운영자는 batch_runs.state 가 왜 'in_progress' 로 남는지 알 수 없음
- markBatchRunKilled 가 0015 트리거 위반 throw (예: 이미 'completed' 로 전이된 race) → catch 미실행 → silent

**User Impact:** Ctrl+C 후 24시간 동안 동일 batch_run_id 로 재진입 불가 (`concurrent_run_detected`). 운영자는 "왜 recover 가 막혔지" 디버깅 불가.

**Recommendation:** 두 가지 옵션:

**옵션 A (권장):** sync 보장이 어려운 D1 호출은 SIGINT 경로에서 제거하고, **다음 진입 시 stale lock 검사로 'killed' 추론**. recover.ts 가 stale lock + 'in_progress' 24h+ 면 'killed' 로 자동 전이.

**옵션 B:** `markBatchRunKilled` 호출을 기록만 하고 (예: `.checkpoint/{id}.killed` sentinel 파일 sync 작성), 다음 BATCH 진입 시 sentinel 발견하면 'killed' 로 전이.

본 plan §5.3 "best-effort" 라벨이 있어 의도된 design choice 일 수도 있으나, **현재 구현은 catch 핸들러조차 도달하지 못해 "best-effort" 로도 작동 안 함**. 차라리 호출 자체를 제거하고 주석에 명시하는 편이 정직.

**Severity 정당화:** 본 silent failure 가 다음 24h recover 경로 차단 → 진산님이 "왜 진입 안 되지" 30분 디버깅 = 현실 영향. 진산 메모 [feedback_no_shortcuts] "당장 돌아가는 코드 아닌 상용 서비스 품질" 위반.

---

### CRITICAL #3 — `runPipeline:497-512` 의 `state='failed'` UPDATE 실패 catch 가 console.error 후 흐름 계속 — 실제 batch_runs row 가 'in_progress' 로 잔존

**파일:라인:** `apps/batch/src/pipeline.ts:497-512`

```ts
if (result.status === 'failed') {
  aborted = true;
  try {
    await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
      state: 'failed',
      last_completed_stage: stage,
    });
  } catch (err) {
    // 0015 트리거 (state='completed' 차단 등) 가 RAISE(ABORT) 가능 — 가시화 후 흐름 계속
    console.error(`[Pipeline] batch_runs UPDATE state=failed 실패 (stage=${stage}):`, err);
  }
  continue;
}
```

**증거:**

1. catch 후 흐름 계속 (`continue`) — 다음 stage 들이 `aborted=true` 로 전부 skipped 되지만, **batch_runs.state 는 잔존 상태 (예: 'in_progress')**. 결과는 PipelineResult 로 반환되나 metadata 테이블은 inconsistent.
2. 0015 트리거 RAISE(ABORT) 시나리오: 이전 stage 의 success path 에서 UPDATE state='in_progress' 가 실행되었는데, 동시에 외부 admin 이 'completed' 로 강제 변경한 race 라면 (희박) downgrade 트리거가 발화 — 하지만 이 패턴이 정상 흐름에서 발생할 가능성 거의 없음.
3. 더 현실적인 시나리오: D1 네트워크 일시 단절 → `await batchRunsDb.updateState` throw → console.error 만 출력 → 진산님은 Stage 실패 메시지만 보고 batch_runs 테이블이 정상 'failed' 로 갱신됐다고 가정 → 다음 recover 시 'in_progress' 로 보고 concurrent_run_detected.

**Hidden errors:**

- D1 timeout / 단절: 'in_progress' 잔존 → 다음 recover concurrent_run_detected 24h
- 0015 트리거 RAISE: 잘못된 state 전이 → silent skip
- `markBatchRunKilled` 와 동일한 silent metadata drift

**User Impact:** `result.qg2Passed === false` 만 보고 진산님이 "Stage 실패니까 다시 돌리자" 했을 때, 다음 진입에서 24h 잠금 차단 발견 후 30분 디버깅.

**Recommendation:** UPDATE 실패는 stage 실패와 동등하게 **PipelineResult 에 명시 표기**. 단순 console.error 가 아닌 추가 StageResult 형태로 표기:

```ts
} catch (err) {
  console.error(...);
  stages.push({
    stage: 'metadata_update' as PipelineStage,  // 또는 별도 필드
    status: 'failed',
    message: `batch_runs UPDATE state=failed 실패: ${(err as Error).message}. 운영자 수동 수정 필요.`,
    durationMs: 0,
  });
  // 또는 throw err — caller 가 명시적으로 핸들링
}
```

**Severity 정당화:** 운영 메타테이블이 truth source 와 어긋나는 silent drift = production 사고. CRITICAL RULE #3 정통 위반 ("로깅 + 에러 전파/폴백" 중 전파/폴백 누락).

---

## 2. MAJOR (4건)

### MAJOR #1 — `stageBatchStructurize:762-766` 의 `result.usage` null 처리는 console.warn 만 — recover 시 cost_state 누적 불일치

**파일:라인:** `apps/batch/src/pipeline.ts:762-766`

```ts
if (result.usage) {
  const status = ctx.costMeter.recordTokens(...);
  if (status === 'hard_throttle') await ctx.costMeter.applyThrottle();
} else {
  console.warn(
    '[Pipeline] processBatch returned null usage — CostMeter skip for this call',
  );
}
```

**증거:**

1. `packages/parser/src/batch-processor.ts:401-409` 분석: `usage` 는 `null` 인 경우는 **Claude API 호출 자체가 throw 한 경우뿐** (try block line 339-394 내부에서 throw → catch 에서 error 만 set, usage 는 null 상태 유지). 그러나 **즉시 다음 줄 (`result.error`) 검사 (`pipeline.ts:741-743`) 가 throw 하므로 본 분기 도달 불가**.
2. 그럼에도 코드는 방어적으로 작성됨 — usage 가 null 인데 contract 가 정상인 경로가 향후 batch-processor 변경으로 생길 수 있음 (예: 캐시 hit 시 API 미호출).
3. 문제: 본 시나리오에서 `costMeter.recordTokens` skip 되지만 **다음 stage 에서 `costMeter.toCheckpointCostState()` 가 호출되면 누적 누락된 비용이 영구 보존 못함**. recover 시 `initialSpendUsd` 가 부정확.

**Hidden errors:**

- 향후 캐시 hit / 부분 응답 등으로 usage=null 정상 경로 신설 시 — 비용 silently 누락
- 비용 누락 → kill_switch 도달 지연 → daily budget 초과 silent

**User Impact:** Anthropic Console cap [project_anthropic_cap_pre_install] 이 발동했는데 CostMeter 가 인지 못해 추가 호출 시도 → 진산님 카드 청구 후 발견.

**Recommendation:** usage null 시 throw 또는 명시 결함으로 분류. 현재 batch-processor 가 보장하는 invariant ("error 가 null 이고 contract 가 있으면 usage 도 반드시 있다") 를 명시:

```ts
} else {
  throw new Error(
    '[Pipeline] processBatch contract 정상 + usage=null — invariant 위반. ' +
    'batch-processor 가 cache hit 등 신규 경로 추가했는지 확인 필요.',
  );
}
```

또는 batch-processor 의 BatchResult 타입 자체를 `usage: TokenUsage` (non-null when contract exists) 로 강화.

**Severity 정당화:** 현재 도달 불가 경로지만 **향후 변경 시 silent collapse 위험 + 비용 누락 = MAJOR**. graceful degradation 라벨링 부재.

---

### MAJOR #2 — `recover.ts:283-286` 의 `state='recovered'` UPDATE 후 `runPipeline` 의 stage success loop 에서 `state='in_progress'` 로 즉시 덮어씀 — recover 사실 silent loss

**파일:라인:** `apps/batch/src/recover.ts:283-286` + `apps/batch/src/pipeline.ts:531-536`

```ts
// recover.ts:283-286 (fully_recovered 시)
await opts.batchRunsDb.updateState(opts.examId, opts.batchRunId, {
  state: 'recovered',
  resume_count_increment: 1,
});
```

```ts
// pipeline.ts:531-536 (각 stage success 후)
await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
  state: 'in_progress',
  last_completed_stage: stage,
  last_node_id: lastSnapshot.last_inserted_node_id,
  state_hash: cp.state_hash,
});
```

**증거:**

1. recover.ts 가 'recovered' 로 표시한 후 caller (pipeline.ts) 가 첫 stage success 즉시 'in_progress' 로 변경 — `resume_count` 는 보존되지만 'recovered' 상태 자체는 단명 (몇 ms ~ stage duration).
2. 0015 트리거: 'recovered' → 'in_progress' 는 차단 안 됨 (downgrade 트리거는 OLD.state='completed' 만 차단). 따라서 SQL 레벨 정상.
3. 문제: 운영 대시보드에서 `state='recovered'` 행을 거의 보지 못함 — recovered 인지 여부가 `resume_count > 0` 으로만 추론 가능. 'recovered' state 의 의미가 모호.

**Hidden errors:**

- `idx_batch_runs_state` 인덱스로 'recovered' 조회 시 거의 빈 결과 → 진단 가시성 silent loss
- recover 직후 OS crash → checkpoint 는 있는데 batch_runs.state='recovered' 잔존 → 다음 진입 시 recover 분기 재진입 (정상이지만 의도 모호)

**User Impact:** 운영자가 "어떤 BATCH 들이 recover 됐었지" 조회할 때 `resume_count > 0` 외엔 단서 없음.

**Recommendation:** 두 가지 옵션:

- (A) recover.ts 가 'recovered' UPDATE 를 생략하고 pipeline.ts 가 첫 stage success 후 한 번만 `resume_count_increment: 1` 적용
- (B) batch_runs 에 `last_recovered_at TEXT` 컬럼 추가 (Year 2 마이그레이션 시) — 'recovered' 사실을 영속적으로 보존

현재 구현은 **idempotency / 정합성 측면은 OK 지만 운영 가시성이 silent**. plan §3.4 "recover.ts 자체가 'recovered' UPDATE 책임" 명시되어 있다면 의도된 design choice 가능 — caller 와 일관성 명문화 필요.

**Severity 정당화:** 데이터 손실 X, 운영 silent — MAJOR.

---

### MAJOR #3 — `writeCheckpointSync:402-409` 의 fsync=false path 가 power loss 시 0바이트 파일 — production fsync 기본 true 지만 테스트 SIGINT 경로에서 파일 손상 가능

**파일:라인:** `apps/batch/src/checkpoint.ts:390-419`

```ts
export function writeCheckpointSync(
  cp: BatchCheckpoint,
  baseDir: string,
  options: WriteCheckpointOptions = {},
): string {
  const fsync = options.fsync ?? true;
  ...
  const fd = openSync(tmpPath, 'w');
  try {
    writeSync(fd, content);
    if (fsync) fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmpPath, filePath);
  if (fsync) {
    const dfd = openSync(dir, 'r');
    try {
      fsyncSync(dfd);
    } finally {
      closeSync(dfd);
    }
  }
  return filePath;
}
```

**증거:**

1. fsync=false path: `writeSync(fd, content)` 후 `closeSync(fd)` → page cache 만 flush. POSIX rename(2) 은 원자적이나 **rename 성공 후 즉시 power loss 시 inode block pointer 가 디스크에 도달 안 했을 수 있음 → 0바이트 파일**.
2. 테스트에서는 `fsyncCheckpoint=false` (`pipeline.integration.test.ts:48`) 가 기본 — 정상이나 SIGINT 통합 테스트가 있다면 power loss 시뮬레이션 누락.
3. 실제 시나리오: 운영자가 ENV 잘못 설정 (`THEPICK_BATCH_FSYNC=false`?) 또는 `enableSignalHandlers=false` 인데 ctx.fsyncCheckpoint=false 로 production 진입 → power loss 시 checkpoint 0바이트 → 다음 recover 시 `CheckpointCorruptedError` (shape mismatch) → recovery_failed → 진산님 검토.

**Hidden errors:**

- production CLI batch.ts:177-196 에서 `fsyncCheckpoint` 미명시 → 기본값 `?? true` 적용 — OK
- 그러나 plan v1.1 "테스트에서만 false 허용" 라벨이 production runtime guard 가 아님 — ENV flag 등으로 우회 가능

**User Impact:** 드물지만 발생 시 BATCH 실행 1회 소실 (8분 내외).

**Recommendation:** fsync=false 호출에 production guard 추가:

```ts
if (!fsync && process.env.NODE_ENV === 'production') {
  throw new Error(
    '[writeCheckpoint] fsync=false is not allowed in production — power loss risk. ' +
      'Set fsync=true or remove NODE_ENV=production.',
  );
}
```

또는 plan 에 명시된 "테스트 전용" 라벨을 코드 주석 외 어딘가 강제 (e.g., named export `writeCheckpointForTests`).

**Severity 정당화:** silent collapse (0바이트 파일) 의 전형. fsync 기본값 true 가 첫 방어선이라 실제 위험은 낮으나, 코드 자체는 "production-safety 가드 부재" — MAJOR.

---

### MAJOR #4 — `pipeline.ts:541-545` 의 `state='completed'` UPDATE 가 try/catch 없음 — 마지막 stage 성공 후 metadata 실패 시 PipelineResult 정상 반환되어 사용자는 BATCH 성공으로 인지

**파일:라인:** `apps/batch/src/pipeline.ts:541-545`

```ts
// === 정상 완료 시 'completed' 전이 ===
if (!aborted) {
  await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
    state: 'completed',
    completed_at: new Date().toISOString(),
  });
}
```

**증거:**

1. 본 UPDATE 실패 시 try 블록 외부의 finally 가 발화 → outer caller 에 throw 전파. CLI 는 `[thepick-batch] ERROR` 로 잡아 exit 1. 그러나 **stages 변수는 이미 모든 stage success 로 채워진 상태** — partial 상태로 throw → caller 의 PipelineResult 반환 못 함 → log 이외 정보 손실.
2. CRITICAL #3 (실패 stage 의 UPDATE) 와 대칭 문제 — 한쪽은 catch 후 흐름 계속, 한쪽은 catch 없음. **일관성 부재 자체가 silent failure 패턴**.
3. UPDATE 실패 + finally `removeHandlers` / `costMeter.finalize` 실행 후 throw → SIGINT handler 는 이미 제거 → 만약 caller 가 이 throw 를 catch 하지 않으면 unhandledRejection.

**Hidden errors:**

- 'completed' UPDATE 실패 → batch_runs.state 는 'in_progress' 잔존 → 다음 recover 시 stale lock 24h
- 0015 트리거: 'in_progress' → 'completed' 정상 전이 → 트리거 발화 안 함 (정상)
- D1 일시 단절: throw → CLI exit 1 → stages 결과 미보고 → **모든 stage 가 success 였다는 사실이 운영 로그에 남지 않음**

**User Impact:** 1주일에 1번 발생할 D1 단절로 인해 운영자가 "BATCH 가 진짜 끝났나?" 확인 불가.

**Recommendation:** CRITICAL #3 와 동일한 패턴으로 통일 — try/catch + 흐름 계속 + stages 에 명시 표기. 또는 retry 1회:

```ts
if (!aborted) {
  try {
    await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
      state: 'completed',
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Pipeline] batch_runs UPDATE state=completed 실패:', err);
    // retry 1회
    try {
      await new Promise((r) => setTimeout(r, 500));
      await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
        state: 'completed',
        completed_at: new Date().toISOString(),
      });
    } catch (err2) {
      console.error('[Pipeline] retry 도 실패 — 운영자 수동 수정 필요:', err2);
      // PipelineResult 에 명시 (별도 metadata field 추가)
    }
  }
}
```

**Severity 정당화:** 일관성 부재 + UPDATE 실패 시 모든 stage 결과 손실 — MAJOR.

---

## 3. MINOR (3건)

### MINOR #1 — `signal-handlers.ts:35-49` handler 함수가 outer arrow 안에 inner arrow — 다중 등록 시 동일 reference 보장 깨짐

**파일:라인:** `apps/batch/src/signal-handlers.ts:35-55`

```ts
const handler = (signal: NodeJS.Signals) => () => { ... };
const sigintHandler = handler('SIGINT');     // 새 함수 reference
const sigtermHandler = handler('SIGTERM');   // 새 함수 reference
process.on('SIGINT', sigintHandler);
process.on('SIGTERM', sigtermHandler);
return () => {
  process.off('SIGINT', sigintHandler);   // 동일 reference 로 제거 OK
  process.off('SIGTERM', sigtermHandler);
};
```

**증거:** closure 로 reference 일관성 보장 — OK. 그러나 `installSignalHandlers` 가 한 process 내 여러 번 호출되면 각각 별도 cleanup 반환. 만약 한 cleanup 만 호출되면 다른 handlers 잔존 → 다중 SIGINT 시 여러 번 flush → checkpoint race.

**Recommendation:** plan §5.3 가 "단일 process per BATCH" 가정인지 명시. 또는 `installSignalHandlers` 가 이미 등록된 경우 throw.

---

### MINOR #2 — `pipeline.ts:411-413` 의 `lastSnapshot=null` 초기 상태에서 SIGINT 발생 시 `flushCheckpoint` 가 silent return

**파일:라인:** `apps/batch/src/pipeline.ts:411-417`

```ts
let lastSnapshot: PipelineStateSnapshot | null = null;
const removeHandlers = ctx.enableSignalHandlers !== false
  ? installSignalHandlers({
      flushCheckpoint: () => {
        if (lastSnapshot === null) return;   // ← 여기 silent return
        ...
      },
    })
  : ...
```

**증거:** 첫 stage 가 채 success 안 됐는데 SIGINT 발생 시 `lastSnapshot===null` → 그냥 return → checkpoint 미작성 → 다음 진입 시 `no_checkpoint` 분기 (정상). 그러나 console 으로 "checkpoint 없으니 flush skip" 메시지가 없어 **SIGINT 가 정상 처리됐는지 운영자 알 수 없음**.

**Recommendation:** `console.warn('[Pipeline] SIGINT before any stage completed — no checkpoint to flush')` 추가.

---

### MINOR #3 — `in-memory-batch-runs-db.ts:117-121` 의 `'completed' → 'recovered'` 차단이 0015 트리거 `trg_batch_runs_no_state_downgrade` 의 superset 이지만 메시지 다름

**파일:라인:** `apps/batch/src/in-memory-batch-runs-db.ts:112-121`

```ts
if (row.state === 'completed' && update.state !== 'completed') {
  throw new Error('batch_runs: cannot transition out of completed state (Idempotency violation)');
}
if (row.state === 'completed' && update.state === 'recovered') {
  throw new Error('batch_runs: cannot recover completed run (Idempotency violation)');
}
```

**증거:** 두 번째 if 는 첫 번째 if 의 special case (recovered ≠ completed). 따라서 두 번째 if 는 dead code. 0015 SQL 의 `trg_batch_runs_recover_only_from_non_completed` 메시지와 동일하게 맞추려면 별도 메시지가 의미 있으나, in-memory 는 첫 if 에서 이미 throw → 두 번째 도달 불가.

**Hidden errors:** 향후 첫 if 가 변경될 때 (예: completed → completed allow 로 완화) 두 번째 if 가 복구되도록 의도 보존 필요. 현재는 silent dead code.

**Recommendation:** 두 번째 if 를 첫 번째 위로 이동하거나, 주석으로 "0015 트리거 메시지 1:1 매핑 의도" 명시.

---

## 4. ✅ 확인 항목 (silent failure 없음 — 8건)

### ✅ #1 — `recover.ts:191-247` 의 catch 분기 4종 모두 명시 라벨링 + message 포함

- `CheckpointNotFoundError` → `no_checkpoint` 결정
- `CheckpointCorruptedError` → `recovery_failed` + reason 포함
- `CheckpointVersionMismatchError` → `recovery_failed` + version 비교
- 기타 에러 → 그대로 throw (line 245)

빈 catch / silent drop 없음. **검증 완료** (확인 라인: recover.ts:191-247).

### ✅ #2 — `checkpoint.ts:114-151` 의 3개 에러 클래스 모두 batchRunId + reason 포함 + message 가 한국어 + 영어 혼합으로 운영자 가독성 보장

검증 완료 (확인 라인: checkpoint.ts:114, 131, 146).

### ✅ #3 — `assertCanonicalSafe` (checkpoint.ts:229-294) 의 silent collapse 차단 9종 명시

- bigint, function, symbol, Date, Map, Set, WeakMap/WeakSet, Promise, TypedArray
- 각각 path 정보 포함 throw — 일반 silent drop 보다 훨씬 우수
- circular reference 차단 (visited WeakSet, line 276-283)

검증 완료. plan §4.1 의 "silent collapse 차단" 의무 정합. (확인 라인: checkpoint.ts:229-294).

### ✅ #4 — `pipeline.ts:597-606` runStage catch 가 모든 stage 의 throw 를 잡아 `StageResult.status='failed'` 로 변환 — message 보존 + durationMs 측정

검증 완료 (확인 라인: pipeline.ts:597-606). silent drop 없음.

### ✅ #5 — `d1-batch-runs-db.ts` 의 모든 메서드가 0015 트리거 RAISE(ABORT) 를 throw 로 전파 (`.run()` 결과 await — driver 가 자동 throw)

검증 완료. 빈 catch 없음. 주석으로 트리거 invariant 명시 (line 64-65, 120-122). Hard Rule 16/17 정합 (`void examId` + 주석).

### ✅ #6 — `in-memory-batch-runs-db.ts:108` row not found 시 명시 throw (silent return null 아님)

검증 완료. plan §3.3 "0015 트리거 invariant 모방" 의무 부분 정합.

### ✅ #7 — `signal-handlers.ts:36-46` flushCheckpoint 호출을 try/catch 로 감싸 silent crash 차단 + console.error 로 가시화

검증 완료 (확인 라인: signal-handlers.ts:36-46).

### ✅ #8 — `recover.ts:252-264` exam_id 일관성 검증 (B-C2 SF-M-2 정정) — checkpoint.exam_id ≠ opts.examId 시 명시 거부 + recovery_failed

Year 2 cross-tenant recover 차단. silent fallback 없음. 검증 완료 (확인 라인: recover.ts:252-264).

---

## 5. Devil's Advocate 반론 — "이게 깨질 수 있는 시나리오" (3개)

### 시나리오 A — 동일 process 내 runPipeline 두 번 호출 (병렬 또는 순차) 시 SIGINT handler closure leak

**위험:** `installSignalHandlers` 는 process-level handler 등록. 첫 호출의 cleanup 이 호출되기 전에 두 번째 호출이 들어오면 **두 set 의 handlers 가 모두 등록**됨 → SIGINT 시 두 flushCheckpoint 가 모두 실행 → 두 lastSnapshot closure 가 race.

**현재 방어선 부재:** `installSignalHandlers` 에 단일 인스턴스 가드 없음. plan §5.3 "다중 등록 누적 차단" 라벨이 있으나 cleanup 호출 전 두번째 install 시는 차단 안 됨.

**완화안:** `installSignalHandlers` 가 module-level singleton 으로 동작 — 두 번째 호출 시 throw "[Pipeline] handlers already registered".

### 시나리오 B — `enableSignalHandlers=false` (테스트) + Ctrl+C 실제 발생

**위험:** 통합 테스트에서 `enableSignalHandlers=false` 설정 후 vitest watch 모드에서 사용자가 Ctrl+C 누름 → SIGINT handler 등록 안 됨 → checkpoint flush 없이 즉시 종료 → 다음 진입 시 last completed stage 까지만 복구.

**평가:** 의도된 design choice 일 수 있으나 (테스트 격리), `pipeline.integration.test.ts:48` 에서 `fsyncCheckpoint=false + enableSignalHandlers=false` 가 기본 — 운영자가 production 으로 이 설정을 복사할 위험.

**완화안:** 테스트 helper `step116TestFields` 에 명시 주석 "production 에서는 fsyncCheckpoint=true + enableSignalHandlers=undefined (기본 true)" 추가. 또는 프로덕션 CLI batch.ts:177-196 에서 두 필드 명시 주입 (현재는 undefined 의존 → ?? true 적용).

### 시나리오 C — `recover.ts:283` 의 `state='recovered'` UPDATE 후 pipeline.ts 의 `installSignalHandlers` 등록 직전 SIGINT 수신

**위험:** Race window: recover 가 'recovered' 로 표시한 후 0.5ms ~ 수ms 안에 SIGINT 발생 → handler 미등록 → flush 안 함 → 다음 진입 시 checkpoint 는 그대로 (recovery 시 변경 없음) + batch_runs.state='recovered' 잔존 → 다음 recover 진입 시 정상 (recovered 도 fully_recovered 로 다시 진입 가능).

**평가:** **데이터 손실 없음 — 정상 흐름**. 단, 이 경우 `resume_count` 가 한 번 더 증가 → 운영 통계 부풀림.

**완화안:** 무시 가능. 단, plan §3.4 의 resume_count 의미 ("recover 호출 누적") 일관 보장.

---

## 6. 판정

### accept_with_caveats

**근거:**

- CRITICAL 3건: 모두 silent metadata drift 패턴 (CRITICAL #1 finally throw, CRITICAL #2 fire-and-forget D1, CRITICAL #3 UPDATE 실패 catch 후 흐름 계속). 데이터 적재 자체는 안전 (D1 batch insert 가 atomic) 이나 batch_runs metadata 가 truth 와 어긋날 위험.
- MAJOR 4건: 운영 가시성 + production-safety 라벨 부재.
- MINOR 3건: dead code / 가독성.
- ✅ 8건: silent collapse 차단 (canonical JSON), recover 결정 트리, runStage catch 변환 등 핵심 silent failure 차단 패턴은 정상 작동.

**다음 세션 진입 전 우선 처리 권고 (plan v1.2 추가 항목):**

1. CRITICAL #1, #3, #4 (UPDATE 실패 처리 일관성) — 한 패턴으로 통일 (try/catch + retry 1회 + PipelineResult 명시)
2. CRITICAL #2 (markBatchRunKilled fire-and-forget) — design choice 명문화 또는 sentinel file 패턴 전환
3. MAJOR #1 (usage null) — invariant 강화 또는 throw

**명시 이연 (handoff-session-015 §2.3 9 AC) 처리:** 다음 세션 e2e 테스트 작성 단계에서 CRITICAL #2 의 SIGINT race 시나리오 (AC-T3 / AC-RP-7) 가 함께 검증되도록 plan §7 testcase 명세 보강 권고. 본 리뷰는 코드 구현 완성도만 평가 — e2e 테스트 미작성을 CRITICAL 로 분류 안 함.

**참조:**

- `.claude/rules/auto-review-protocol.md` Pass 1 (Surgeon) + Pass 3 (Advocate) 기준 적용
- `.claude/rules/production-quality.md` CRITICAL RULE #3 (try-catch 데이터 silent 삭제 금지) — 본 리뷰의 핵심 lens
- 직전 silent-failure 리뷰 `review-20260428-200210-bc1bc2-step5-examid-silent-failure.md` 의 SF-M-2 (exam_id 일관성 검증) 정정 사항은 본 세션 recover.ts:252-264 에 정합 반영 확인 (✅ #8)
