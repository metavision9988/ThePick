# Engine Hardening 중간 점검 — DevOps 관점

> **검토자:** devops-architect (독립 5-페르소나 #5)
> **검토일:** 2026-04-28 (KST)
> **관점:** "진산님이 새벽 3시에 BATCH 적재 중 비정상 종료 / Ctrl+C / 비용 폭주 / D1 race / 디스크 가득에 마주쳤을 때, 코드 + 메시지 + playbook 이 자가 진단 + 자가 복구 가능 수준인가?"
> **검토 범위:** `apps/batch/src/{checkpoint,recover,cost-meter,pipeline}.ts` + `migrations/0015_batch_runs.sql` + `docs/plans/engine-hardening/step11-6-*.plan.md` + ADR-023/025
> **중복 회피:** refactoring-expert(코드품질) / performance-engineer(처리량) / quality-engineer(테스트커버리지) / backend-architect(스키마/API) — 본 보고서는 **운영 부채**(시그널/플래시/메시지/플레이북/관측)에만 집중

---

## 1. 한 줄 평가

> **partial proceed** — Step 11.6 코드 진입 자체는 막을 만한 결함은 없으나, **"새벽 3시 진산님 holster"**(Anthropic 콘솔 cap 미설정 + recovery 메시지 actionability + signal handler 좀비 risk + JSONL 로그 운영 정책 부재) 4건이 **코드 진입과 동시 처리 또는 직전 수동 처리** 되어야 한다. Solo-Builder 가 새벽 3시에 5개 문서를 동시에 뒤지지 않게 만드는 게 운영 부채의 핵심.

---

## 2. CRITICAL — On-call (새벽 3시) 에서 깨짐

### CRITICAL-1: Anthropic 콘솔 monthly cap **미확인** 상태에서 Step 11.6 코드 진입은 위험 비대칭

**증거:**

- `.claude/reports/engine-hardening-midpoint-20260428.md:29-33` — "진산님 미확인 작업 (BATCH-1 진입 차단 항목): Anthropic Console Monthly cap = $200 설정"
- `docs/adr/ADR-025-two-layer-cost-control.md:298-303` — "진산님 즉시 작업 (본 ADR ACCEPTED 직후): [ ] Anthropic Console → Billing → Monthly cap = $200 설정 ... 위 작업은 진산님 통제 영역 — Claude는 코드만 작성, Anthropic 콘솔 접근 불가"
- `docs/adr/ADR-025-two-layer-cost-control.md:222-232` — Layer 1 의 안전망이 Layer 2 임을 명문화 ("Layer 1 우회 시 Layer 2가 안전망")
- `apps/batch/src/cost-meter.ts:48-64` — `KillSwitchError` 는 **단일 BATCH 1회**에 대한 보호. 코드 버그·무한루프·exception swallow 시 우회됨

**왜 새벽 3시 실패인가:**

- Step 11.6 의 `onKillSwitch` 콜백이 등록되어도, 만약 `pipeline.ts` 통합 시점에 `recordTokens()` 호출 누락 (§4.3.3 의 "processBatch 의 usage 미반환" 리스크)이 있으면 Layer 1 은 침묵.
- 그 상태에서 새벽 3시 BATCH 가 무한 호출 — Layer 2 cap 미설정 시 과금이 100달러+ 까지 도달할 때까지 신호 없음.
- 진산님이 아침에 일어나서 Anthropic dashboard 보고 "어?" 하는 순간 = $200 청구. Solo-Builder 손실 비대칭.

**현재 미설정 상태에서 Step 11.6 진입 시:**

- AC-Cost 테스트는 mock `onKillSwitch` 로 검증 — Layer 1 검증.
- 그러나 **실 BATCH-1 적재 시점 cap 미설정 = "Layer 1 만 가동된 상태로 production 진입"** = ADR-025 §2.2 가 명시한 "단일 Layer 의 결함" 그대로.

**즉시 행동:**

1. Step 11.6 코드 진입 **이전에** 진산님이 Anthropic Console cap 설정 + 스크린샷 `docs/exit-strategy/anthropic-cap-2026-04.png` 저장 (5분).
2. 위 파일 부재 시 Step 11.6 `pnpm test` 가 fail 하는 pre-flight 체크 추가 (예: `apps/batch/scripts/preflight.sh`):
   ```
   test -f docs/exit-strategy/anthropic-cap-2026-04.png \
     || (echo "[Pre-flight] Layer 2 cap 미설정 — ADR-025 §7" && exit 1)
   ```
3. CI 가 아닌 **로컬 BATCH 진입 직전** 자동 검사. 진산님이 "잊어버림"을 코드가 막아야 한다.

---

### CRITICAL-2: SIGINT/SIGTERM handler 의 sync fsync 실패 시 **좀비 + 데이터 둘 다 손실**

**증거:**

- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:716-746` — handler 의 `try/catch` 는 있으나 `flushCheckpoint` 내부의 `mkdirSync` / `openSync` / `writeSync` / `fsyncSync` 실패 가정 부재
- 같은 파일 §8 "위험 분석" 의 "writeCheckpointSync 에서 mkdirSync 실패 (권한)" 행 — "catch 후 console.error + process.exit(1) (이미 fault path)" 로 처리한다 명시. **그러나 §5.3 의 코드 예시는 catch 안에 process.exit 가 없고 `process.exit(signal === 'SIGINT' ? 130 : 143)` 만 outer 에 존재**

**구체 시나리오 (새벽 3시):**

1. 진산님 노트북 디스크가 90% 찬 상태에서 BATCH-1 시작 (디스크 모니터링 부재)
2. Stage 5 `db_load` 직후 `.checkpoint/` 디렉토리 inode 고갈 — `mkdirSync` 실패
3. 진산님 Ctrl+C → SIGINT handler 진입 → `flushCheckpoint()` 호출 → 내부 `mkdirSync` throw
4. `try/catch` 가 잡지만 catch 블록은 `console.error` 만 — **그리고 outer `process.exit(130)` 실행**
5. 결과: 체크포인트 0 byte, `batch_runs` row 는 여전히 `state='in_progress'` (best-effort UPDATE 도 catch 됨)
6. 다음 날 재시도 시 `recover.ts:131-148` 의 stale lock 검사가 24시간 미경과 → `concurrent_run_detected` reject
7. 진산님 "왜 안 돌아가지?" 30분 디버깅 후 수동 D1 UPDATE 결정

**왜 CRITICAL 인가:**

- `concurrent_run_detected` 의 메시지 (`recover.ts:144-146`)는 "24시간 후 재시도 또는 강제 종료 후 recover" — **"강제 종료"의 구체 절차 부재**. 진산님이 새벽 3시에 D1 UPDATE SQL 작성?
- handler 좀비 자체보다, **handler 실패가 정상 동작과 구분 불가능**한 게 더 위험.

**즉시 행동 (Step 11.6 코드 작성 시):**

1. `signal-handlers.ts` 의 catch 블록 안에 **사용자 가시 출력 의무화**:
   ```
   console.error('[Pipeline] Checkpoint flush FAILED during SIGINT.');
   console.error('[Pipeline] Manual recovery: docs/runbook/checkpoint-flush-failure.md');
   console.error('[Pipeline] batch_run_id:', batchRunId);
   console.error('[Pipeline] Original error:', err);
   ```
2. `docs/runbook/checkpoint-flush-failure.md` 신규 작성 (CRITICAL-3 참조)
3. handler 진입 시점에 **flush 시도 전** 진산님 가시 메시지 출력 — flush 가 throw 되어도 의도가 사용자에게 도달:
   ```
   console.error('[Pipeline] SIGINT received — attempting checkpoint flush (do not kill -9)...');
   ```

---

### CRITICAL-3: Recovery 메시지에 **다음 행동의 구체 위치 부재** — playbook 0건

**증거:**

- `apps/batch/src/recover.ts:170-173` — `no_checkpoint` 메시지: "처음부터 자동 재시작합니다." / "진산님 결정 후 처음부터 재시작 필요." → **재시작 명령어, 환경변수, 옵션 명시 부재**
- `apps/batch/src/recover.ts:188-191` — `recovery_failed` (corrupted) 메시지: "체크포인트 무결성 검증 실패: ${reason}. 진산님 검토 후 처음부터 재시작 결정." → **"검토" 의 구체 절차 부재. corrupted 파일은 보존? 삭제? 백업?**
- `apps/batch/src/recover.ts:203-207` — `recovery_failed` (version mismatch) 메시지: "Migration 가이드 참조 후 처음부터 재시작 결정." → **"Migration 가이드"의 파일 경로 부재 (예: `docs/migrations/checkpoint-v1-to-v2.md`)**
- `apps/batch/src/recover.ts:223-227` — `recovery_failed` (depends_on stub) 메시지: "Multi-engine 의존성 검증은 Phase 1 후반 도입 — 본 단계에서 처리 불가." → **본 단계에서 처리 불가 = 진산님이 뭘 해야 하나? 파일 삭제? batch_run_id 변경? 답 없음**
- `apps/batch/src/recover.ts:142-146` — `concurrent_run_detected` 메시지: "24시간 후 재시도 또는 강제 종료 후 recover." → **"강제 종료"의 절차 부재. D1 batch_runs UPDATE? PID kill? Lock file 삭제?**
- `docs/runbook/` 디렉토리 — **존재하지 않음** (저장소 전체 grep 결과)

**왜 CRITICAL 인가:**

- 진산님 Solo-Builder. 새벽 3시에 메시지 받고 **"Migration 가이드 참조"** 라는 글자만 보면 검색 시작 → 파일 없음 발견 → 30분 손실 → 결국 GitHub Issues 검색 → 실패 → 다음날 출근 → BATCH-1 진입 1일 지연.
- 메시지 actionability 가 0 인 상태로 production 진입 = ADR-023 §1.3 의 "BATCH 적재 = 신뢰할 수 있는 첫 박동" 와 정면 충돌.

**status → 다음 행동 매트릭스 (현재 부재 / 신설 필요):**

| RecoveryStatus                      | 현재 메시지 끝             | 추가되어야 할 actionable 정보                                                                                                                                      |
| :---------------------------------- | :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no_checkpoint`                     | "처음부터 재시작 필요"     | `pnpm batch run BATCH-1 --new-run-id=$(uuidgen)` 명령어 + "이전 batch_run_id 의 batch_runs row 는 보존, 재INSERT 차단됨"                                           |
| `recovery_failed` (corrupted)       | "검토 후 재시작 결정"      | "1. 손상 파일을 `.checkpoint/{id}.json.corrupted-$(date +%s)` 로 백업 → 2. `docs/runbook/checkpoint-corrupted.md` 따라 인간 검수 → 3. 신규 batch_run_id 로 재시도" |
| `recovery_failed` (version)         | "Migration 가이드 참조"    | 명시 경로: `docs/runbook/checkpoint-version-migration.md` (현재 파일 부재 → CRITICAL) + "임시 회피: 신규 batch_run_id 로 처음부터"                                 |
| `recovery_failed` (depends_on stub) | "처리 불가"                | "1. `cat .checkpoint/{id}.json                                                                                                                                     | jq .depends_on` 으로 의존 확인 → 2. 의존 engine checkpoint 도 인간 검수 → 3. 신규 batch_run_id 로 재시도 (multi-engine 정식 도입 전엔 이 경로 미진입 권장)"                                                                                                                     |
| `concurrent_run_detected`           | "24시간 후 또는 강제 종료" | "강제 종료 절차: 1. `ps aux                                                                                                                                        | grep tsx ./bin/batch`로 PID 확인 → 2. PID 발견 시`kill -TERM <pid>`(SIGINT handler 가 checkpoint flush) → 3. PID 없으면 stale lock —`wrangler d1 execute thepick-d1 --command=\"UPDATE batch_runs SET state='killed' WHERE batch_run_id='${id}'\" --local` → 4. recover 재시도" |
| `already_completed`                 | "skip"                     | "정상. 다음 BATCH 진입 가능. 본 batch_run_id 재실행 시도는 Idempotency 정상 동작" — 사용자 안심 유도                                                               |
| `fully_recovered`                   | 정상                       | "재개 stage=X. resume_count=N. 처음부터 재시작이 필요하면 신규 batch_run_id 사용" — escape hatch 명시                                                              |

**즉시 행동:**

1. **Step 11.6 코드 진입 직전** `docs/runbook/` 디렉토리 5개 파일 신설:
   - `docs/runbook/sigint-flush-failure.md`
   - `docs/runbook/checkpoint-corrupted.md`
   - `docs/runbook/checkpoint-version-migration.md`
   - `docs/runbook/concurrent-run-stale-lock.md`
   - `docs/runbook/cost-kill-switch-recovery.md`
2. `recover.ts` 의 메시지에 위 파일 절대 경로 (project-root relative) 임베드.
3. 메시지 길이 제한 (3줄 이상 시 console 가독성 저하) — 핵심 1줄 + "상세: docs/runbook/{X}.md".

---

### CRITICAL-4: `D1BatchRunsDb.updateState` 의 **트리거 ABORT 무한 루프 위험**

**증거:**

- `migrations/0015_batch_runs.sql:54-59` — `trg_batch_runs_no_state_downgrade`: `OLD.state='completed' AND NEW.state != 'completed'` 시 ABORT
- `migrations/0015_batch_runs.sql:62-68` — `trg_batch_runs_recover_only_from_terminal`: `NEW.state='recovered' AND OLD.state NOT IN ('killed','failed')` 시 ABORT
- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:382-390` — Step 11.6 §3.3 의 stage 실패 시 흐름:
  ```
  if (result.status === 'failed') {
    aborted = true;
    await ctx.batchRunsDb.updateState(ctx.batchRunId, {
      state: 'failed',
      last_completed_stage: stage,
    });
    continue;
  }
  ```
- `docs/plans/engine-hardening/step11-6-...plan.md:883` — 위험 분석에 "D1BatchRunsDb.updateState 가 트리거 RAISE(ABORT) throw → catch 후 명시 로그 + state='failed' 전이 시도 (트리거가 차단해도 best-effort)" 명시

**구체 시나리오:**

1. Stage 5 `db_load` 진행 중 Layer 1 CostMeter `kill_switch` 발동 → `onKillSwitch` 콜백이 checkpoint flush + `state='killed'` UPDATE 시도
2. 그러나 race 로 stage 자체는 success 반환 직후 → outer pipeline 이 `state='in_progress', last_completed_stage='db_load'` UPDATE
3. 이어서 다음 stage `integrity_check` 가 (CostMeter 가 throw 한) catch 블록을 돌리고 `state='failed'` UPDATE 시도
4. 마지막 finally 가 `state='completed'` 또는 `state='failed'` 재UPDATE
5. 트리거가 `OLD.state='killed'` AND `NEW.state='failed'` 차단 → ABORT throw → outer `try/catch` 진입 → `state='failed'` 재시도 → 또 ABORT → ...

**왜 CRITICAL 인가:**

- 트리거 ABORT 가 throw 되는 것 자체는 정상이나, **caller 가 catch 후 다시 UPDATE 시도** 패턴이 기본값이면 무한 루프 또는 stack overflow.
- Step 11.6 plan 은 "best-effort" 로 명시하나 "best-effort 의 종료 조건" 부재.
- 새벽 3시 진산님이 stack trace 보고 "왜 무한 ABORT?" 디버깅 = 1시간 손실.

**즉시 행동 (Step 11.6 §4.4 코드 작성 시):**

1. `D1BatchRunsDb.updateState` 의 catch 블록은 **재시도 0회**. 첫 ABORT 시 즉시 `console.error` + 상위로 throw.
2. `runPipeline` finally 의 state transition 은 **현재 state 사전 SELECT 후 합법 전이 검증** — 즉, "OLD.state='killed'" 면 "NEW.state='failed'" 시도 금지 (트리거에 도달조차 하지 말 것).
3. State machine을 명시 함수로 분리:
   ```
   function isLegalTransition(from: BatchRunState, to: BatchRunState): boolean {
     // (in_progress → completed/failed/killed/recovered) OK
     // (completed → *) 차단
     // (killed → recovered) OK / (killed → failed) 차단
     // ...
   }
   ```
4. AC-R6 (트리거 발화 검증) 에 **caller 의 catch 동작** 도 검증: "ABORT 후 caller 가 재시도 0회" assertion.

---

## 3. MAJOR — playbook 부재 / 운영 정책 미수립

### MAJOR-1: STALE_LOCK_THRESHOLD_MS = 24h — 진산님 노트북 환경에 부적합

**증거:**

- `apps/batch/src/checkpoint.ts:38` — `export const STALE_LOCK_THRESHOLD_MS = 24 * 60 * 60 * 1000;`
- `apps/batch/src/recover.ts:131-148` — `concurrent_run_detected` 분기는 `elapsedMs < staleThreshold` 시
- 메모리 — 진산님 환경은 Node.js 로컬 (노트북 추정). WSL2 (env 정보) — 노트북 슬립/재부팅 빈번 가정 가능

**왜 MAJOR 인가:**

- 진산님이 BATCH 시작 → 점심 → 노트북 슬립 → 저녁 재개 시도 시: clock 연속 증가 (started_at 기준 elapsed 8시간) → `concurrent_run_detected` 정상.
- 그러나 **진산님이 BATCH 도중 노트북 강제 종료 (배터리 0% / 시스템 패닉) → 23시간 후 재시도** 시: stale_lock 미경과 → `concurrent_run_detected` reject. 그 시점 진산님 PID 부재 — 진산님은 새벽 3시에 stale lock 강제 해제 절차 수행.
- 24h 는 데이터센터 기준 (Cloudflare Workers 가정). 진산님 환경은 **세션 단위 = 수 시간 ~ 1일**. 24h 는 너무 관대.

**즉시 행동:**

1. `STALE_LOCK_THRESHOLD_MS` 를 환경별로 분기:
   - `process.env.NODE_ENV === 'production'` (Workers Phase 2): 24h
   - 그 외 (진산님 로컬): **2h** (점심+저녁+슬립 cover, 그러나 다음날 재시도 시 stale lock 자동 해제)
2. 또는 **PID liveness 검사**와 결합 — `recover.ts` 가 `ps -p <pid>` 로 lock owner alive 확인 (Linux/macOS only). PID dead 면 즉시 stale lock 처리, 무관계 elapsed 시간.
3. CRITICAL-3 의 runbook `concurrent-run-stale-lock.md` 에 본 결정 근거 + 환경 분기 명시.

---

### MAJOR-2: 0015 트리거 RAISE(ABORT) 메시지 영어 — Drizzle 표면화 시 가독성 0

**증거:**

- `migrations/0015_batch_runs.sql:48` — `RAISE(ABORT, 'batch_runs: cannot re-insert completed batch_run_id (Idempotency violation)')`
- `migrations/0015_batch_runs.sql:58` — `RAISE(ABORT, 'batch_runs: cannot transition out of completed state (Idempotency violation)')`
- `migrations/0015_batch_runs.sql:67` — `RAISE(ABORT, 'batch_runs: recovered state requires killed/failed origin (concurrent run guard)')`
- `apps/batch/src/recover.ts:142-146` — 한글 메시지 사용 (recover.ts 본문) — **언어 일관성 결여**

**왜 MAJOR 인가:**

- Drizzle ORM / D1 client 가 트리거 ABORT 를 표면화할 때 메시지 그대로 throw. caller 가 catch 후 진산님에게 보여줄 때 영어/한글 혼재.
- 진산님 console: "[Pipeline] batch_run_id=...: 정상 복구. ..." (한글) → 다음 줄 "Error: SQLITE_CONSTRAINT: batch_runs: cannot transition out of completed state..." (영어). UX 의 1급 결함은 아니나 **새벽 3시에 갑작스러운 영어 stack 은 진산님이 "내 코드 버그?" 오인** 가능.

**즉시 행동:**

1. 옵션 A (간단) — `D1BatchRunsDb.updateState` 의 catch 블록에서 `SQLITE_CONSTRAINT` 감지 시 한글 wrapper:
   ```
   if (msg.includes('cannot transition out of completed')) {
     throw new IllegalStateTransitionError(
       `[batch_runs] batch_run_id=${id} 는 이미 완료 상태 — 상태 변경 차단됨 (Idempotency).`,
     );
   }
   ```
2. 옵션 B (정공) — 트리거 메시지를 한글로 (D1 SQLite UTF-8 저장 — 동작 검증 필요). 단, 트리거 에러 메시지를 코드 layer 에서 catch 하므로 옵션 A 우선.
3. CRITICAL-3 의 runbook 매트릭스에 "이런 영어 에러 보면 → 이런 의미" 매핑 추가.

---

### MAJOR-3: JSONL 감사 로그 (`logs/batch-tokens-*.jsonl`) — 운영 정책 0건

**증거:**

- `apps/batch/src/adapters/token-cost-logger.ts:4` — `파일 경로: {logDir}/batch-tokens-{YYYYMMDD}.jsonl (일 단위 로테이션)`
- `apps/batch/src/adapters/token-cost-logger.ts:141` — `return join(process.cwd(), 'logs');`
- `.gitignore:30-31` — `# Logs / logs/` (git tracked X — 정상)
- **부재 항목:**
  - 보관 기간 정책 (1주? 30일? 영구?)
  - 디스크 사용량 모니터링 (월 1회 확인? 자동 경고?)
  - Compress 정책 (오래된 일자 .jsonl.gz?)
  - 분석 도구 (jq query 예시? grafana? log search 명령?)

**왜 MAJOR 인가:**

- BATCH 1회 실행 = ~수백 Claude 호출 = ~수백 JSONL 줄. BATCH 5개 × 매년 개정 × 5년 = 수만 줄. 무한 누적.
- 진산님 노트북 SSD 256GB 기준 — 10년 후라도 JSONL 자체는 문제 X. 그러나 **사고 발생 시 "어떤 BATCH 의 어떤 stage 에서 비용 폭주?" 검색 절차 부재** = 디버깅 도구 0.
- ADR-025 §2.3 의 audit log + Layer 1 정확 회계 = JSONL 이 진실 소스. 진실 소스의 검색 가능성 0 = 운영 부채.

**즉시 행동:**

1. `docs/runbook/cost-audit-log-query.md` 신설:
   ```
   # 비용 폭주 사후 분석
   - 일자별 합계: jq -s 'group_by(.batchId) | ...'
   - stage 별 누적: jq -s 'group_by(.stage) | ...'
   - 단일 호출 비용 top 10: jq -s 'sort_by(.costUsd) | reverse | .[:10]'
   ```
2. 보관 정책 결정:
   - **권고 (Solo-Builder)**: 30일 자동 압축 (`logrotate` 또는 Node-based cron) + 1년 후 삭제. 비용 분쟁 시 30일 내 분석 가능.
   - 무한 누적은 거부 (snowball 부채).
3. 본 결정을 ADR 또는 ADR-025 §2.3 패치로 영속화.

---

### MAJOR-4: SIGINT handler 의 fault path 재현성 0 — JSONL 동기 기록 부재

**증거:**

- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:725-732` — handler 코드:
  ```
  const handler = (signal: NodeJS.Signals) => () => {
    try { console.error(`[Pipeline] ${signal} received — flushing checkpoint before exit`);
          opts.flushCheckpoint(); }
    catch (err) { console.error(`[Pipeline] Checkpoint flush failed during ${signal}:`, err); }
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  ```
- `apps/batch/src/cost-meter.ts:287-301` — 정상 경로의 JSONL 로그는 `this.logger.record(...)` 호출. **fault path (SIGINT) 의 JSONL 기록 부재**

**왜 MAJOR 인가:**

- 진산님이 새벽 3시 SIGINT 후 다음날 "왜 BATCH 멈췄지?" 분석 시 — `logs/batch-tokens-{YYYYMMDD}.jsonl` 의 마지막 줄이 정상 stage 호출 (예: `batch_structurize`). **SIGINT 발생 사실과 시점 자체가 로그에 부재**.
- console.error 출력은 ttyy 가 닫히면 휘발 (Solo-Builder 가 nohup 안 쓰면 손실).
- 운영 사후 분석 = "마지막 JSONL 시각 + 마지막 checkpoint 시각" 둘만으로 시간 범위 추정 — 의도적 SIGINT vs OOM kill 구분 불가.

**즉시 행동:**

1. handler 진입 시점에 별도 JSONL 라인 추가 (fault audit log):
   ```
   { "ts": "...", "type": "signal_received", "signal": "SIGTERM",
     "batchId": "...", "lastSnapshot": {...} }
   ```
2. 동기 fs API (`appendFileSync`) — process.exit 직전이라 await 불가. 단일 줄 append 는 atomic (POSIX < PIPE_BUF=4096).
3. CRITICAL-3 의 runbook `sigint-flush-failure.md` 가 본 로그 검색 절차 명시.

---

### MAJOR-5: KillSwitchError 메시지에 다음 행동 부재

**증거:**

- `apps/batch/src/cost-meter.ts:58-61` — 메시지: `[CostMeter] Kill switch triggered — batch=..., spend=$.../$... (...%)`
- 추가 정보 부재: 체크포인트 경로 / 다음 배치 ID 제안 / Anthropic 콘솔 확인 권고 / `applyThrottle` vs `triggerKillSwitch` 구분 가이드

**왜 MAJOR 인가:**

- production `onKillSwitch` 콜백은 `process.exit(1)` 후 진산님에게 보이는 마지막 메시지.
- 진산님이 보는 건 위 한 줄 + `Error: ...stack` — "다음 무엇?" 답 없음.
- ADR-025 §2.5 의 "Layer 1 + Layer 2 동기화" 에서 Layer 1 발동 = Layer 2 미발동. 즉, **Anthropic 콘솔에 청구된 비용은 정확히 Layer 1 의 spendUsd**. 그러나 진산님이 본 사실을 알려면 console 메시지가 알려줘야 함.

**즉시 행동:**

1. `KillSwitchError` constructor 에 추가 정보:
   ```
   super(
     `[CostMeter] Kill switch triggered — batch=${batchRunId}, spend=$${spendUsd.toFixed(4)}/$${budgetUsd.toFixed(2)} (${ratio}%).\n` +
     `  체크포인트: .checkpoint/${batchRunId}.json (보존됨)\n` +
     `  다음 행동: 1) Anthropic Console Billing 확인 (Layer 2 cap 발동 여부) 2) docs/runbook/cost-kill-switch-recovery.md 참조 3) 신규 batch_run_id 로 재시도\n` +
     `  주의: 본 메시지 보면 D1 batch_runs 의 state='killed' 전이 — recover() 시 'fully_recovered' 가능`,
   );
   ```
2. CRITICAL-3 매트릭스의 `cost-kill-switch-recovery.md` runbook 작성 시 본 메시지의 모든 항목을 풀어쓰기.

---

## 4. MINOR — 메시지 / 로그 정정

### MINOR-1: `recover.ts:144-145` 의 24h 표시 — 사용자 가독성

현재: `${Math.floor(staleThreshold / 1000 / 60 / 60)}시간 후` → "24시간 후". 정상이나 STALE_LOCK_THRESHOLD_MS 변경 시 (MAJOR-1) "2시간 후" 등 자동 반영. → 본 분기 자체는 이미 OK, MAJOR-1 적용 후 검증만.

### MINOR-2: `KillSwitchError` 의 `(${ratio}%)` 표시 — `(100.0%)` 보다 `(125.3% — 한도 1.25배 초과)` 가 actionable

`spend=$12.50/$10.00 (125.0%)` 보다 **`spend=$12.50/$10.00 (한도 1.25배 초과)`** 가 진산님이 "이미 초과 청구된 금액" 즉시 인지.

### MINOR-3: `STALE_LOCK_THRESHOLD_MS` 명명 — `STALE_LOCK_THRESHOLD_MS_LOCAL` / `_PROD` 분리 (MAJOR-1 결과)

### MINOR-4: 0015 트리거 SQL 주석 — recover atomicity 트리거의 "concurrent run guard" 표현

`migrations/0015_batch_runs.sql:62-68` 의 트리거는 정확히는 "killed/failed 가 아닌 상태에서 recovered 로의 전이 차단". `in_progress → recovered` 는 차단되지만 in_progress 가 정상인지 stale 인지 트리거는 모름. 주석에 명시: "본 트리거는 SQL 수준 방어. stale lock 판정은 recover.ts 의 STALE_LOCK_THRESHOLD_MS 로 별도 수행".

### MINOR-5: `apps/batch/src/index.ts` 의 export 점검

(읽지 않았으나 통상 패키지 entry — `installSignalHandlers`, `D1BatchRunsDb`, `recoverBatch`, `KillSwitchError` 등 신규 export 누락 시 caller 가 찾기 어려움)

---

## 5. Devil's Advocate

> **"진산님이 새벽 3시에 마주칠 가장 가능성 높은 시나리오 — 본 plan 이 막을 수 없는 것"**

**시나리오 — Anthropic API 키 유출 (운영 부채의 한계)**

1. 진산님이 BATCH-1 적재 중 Stack Overflow 검색 — 어떤 댓글이 `.env` 파일을 함께 commit 한 예시
2. 진산님이 무의식 중 `git add -A` 후 commit (CLAUDE.md 의 "git add -A 금지" 위반)
3. `.husky/pre-commit` 의 `bash scripts/check-no-secrets.sh` 가 catch — **만약 `sk-ant-` 패턴만 정규식 검사이면**, base64 변형 / line break 분리 등은 통과 가능
4. push → GitHub 공개 저장소 → bot 이 5분 내 키 추출 → 다른 곳에서 Anthropic API 호출
5. **Layer 1 CostMeter 는 진산님 BATCH 만 추적 — 외부 호출 차단 0**
6. **Layer 2 Anthropic 콘솔 monthly cap = $200** → 새벽 3시 $200 도달 → bot 호출 차단 → 진산님 BATCH 도 차단 (정상 동작이 의도치 않게 멈춤)
7. 진산님이 아침에 일어나 KillSwitchError 보고 "내 BATCH 가 비싸나?" 오인 → 1시간 디버깅 후 콘솔에서 외부 IP 호출 발견

**왜 본 plan 이 못 막나:**

- ADR-025 §2.4 의 `pre-commit-cost-guard.sh` 는 "대용량 SQL 변경 + sk-ant- 패턴" 차단. **base64 변형 / 다중 라인 / 환경변수 inline 등 우회 가능**
- Layer 1/Layer 2 둘 다 "정상 진산님 호출" 만 가정. 외부 침입 시 Layer 2 가 안전망이지만 **진산님 정상 BATCH 도 동시 차단**

**완화 (Step 11.6 외 별도 Step 또는 ADR):**

1. Anthropic API key 를 BATCH 시작 시점에 **fingerprint 검증** (콘솔 호출로 key 의 created_at 확인 — recent rotation 시 재인증 요구) — 매우 무거움, 권고 안함
2. `pre-commit-cost-guard.sh` 의 secret detection 에 `gitleaks` / `trufflehog` 같은 stable tool 채택 (단순 정규식 거부) — 권고
3. **최후 안전망**: Layer 2 cap 도달 시 진산님 SMS/이메일 즉시 알림 (Anthropic Console Alerts §2.4.2 50%/80%/100% — 이미 ADR-025 에 명시되어 있으나 진산님 미설정. → CRITICAL-1 와 같은 항목)

→ Devil's Advocate 결론: 본 plan 의 범위 밖 (운영 부채 일부는 코드 외 영역). **CRITICAL-1 의 Anthropic 콘솔 cap 미설정 = 본 시나리오에서도 안전망**. 따라서 CRITICAL-1 의 즉시 처리가 본 시나리오 완화에도 기여.

---

## 6. Top 3 Actions

### Action 1 (CRITICAL — Step 11.6 코드 진입 직전 / 30분 작업)

**Anthropic 콘솔 cap 미설정 차단 게이트 신설.** 진산님 수동 작업 5분 + 코드 1줄 (pre-flight check):

1. 진산님이 직접: Anthropic Console Billing → Monthly cap = $200 + Alerts 50%/80%/100% + 스크린샷 `docs/exit-strategy/anthropic-cap-2026-04.png`
2. Claude 가 추가: `apps/batch/scripts/preflight.sh` (또는 `bin/batch.ts` 진입 시점) — 파일 부재 시 BATCH 시작 거부

**근거:** CRITICAL-1. 본 항목 처리 전 Step 11.6 코드 진입은 ADR-025 §2.2 의 "Layer 1 단독 = 결함" 정합 위반.

### Action 2 (CRITICAL — Step 11.6 코드 작성과 병행 / 2시간 작업)

**`docs/runbook/` 5개 파일 신설 + recover.ts / KillSwitchError 메시지에 경로 임베드.**

| 파일                              | 트리거 메시지                                  | 핵심 절차                                                                          |
| :-------------------------------- | :--------------------------------------------- | :--------------------------------------------------------------------------------- |
| `sigint-flush-failure.md`         | CRITICAL-2 의 사용자 가시 메시지               | 1. `.checkpoint/{id}.json` 존재/크기 확인 2. corrupted 면 백업 → 신규 ID           |
| `checkpoint-corrupted.md`         | recover.ts:188-191 (recovery_failed corrupted) | 1. 손상 파일 백업 2. SHA-256 수동 비교 3. 신규 batch_run_id                        |
| `checkpoint-version-migration.md` | recover.ts:203-207 (version mismatch)          | 1. 두 버전 차이 비교 2. 임시 회피: 신규 batch_run_id                               |
| `concurrent-run-stale-lock.md`    | recover.ts:142-146 (concurrent_run_detected)   | 1. PID alive 검사 2. dead 면 D1 UPDATE 강제 해제                                   |
| `cost-kill-switch-recovery.md`    | KillSwitchError                                | 1. Anthropic Console 청구 확인 2. checkpoint 무결 검증 3. 신규 batch_run_id 재시도 |

**근거:** CRITICAL-3 + MAJOR-2/4/5. Solo-Builder 새벽 3시 self-recovery 의 base.

### Action 3 (MAJOR — Step 11.6 코드 작성 시 / 30분 작업)

**`signal-handlers.ts` + `D1BatchRunsDb.updateState` 의 fault path 강화:**

1. SIGINT/SIGTERM handler 진입 시 동기 JSONL append (`logs/signals-{YYYYMMDD}.jsonl`) — fault path 재현성 (MAJOR-4)
2. handler catch 블록의 `console.error` 를 진산님 가시 메시지로 격상 ("Manual recovery: docs/runbook/sigint-flush-failure.md") (CRITICAL-2)
3. `D1BatchRunsDb.updateState` 의 트리거 ABORT catch 블록 — 재시도 0회, 즉시 throw (CRITICAL-4). State machine 사전 검증 함수 (`isLegalTransition`) 도입
4. `STALE_LOCK_THRESHOLD_MS` 의 환경 분기 (production 24h / local 2h) (MAJOR-1)

**근거:** CRITICAL-2/4 + MAJOR-1/4. fault path 자체가 silent 면 운영 부채 무한 누적.

---

## 7. 진행 권고

> **partial proceed** — Step 11.6 코드 작성은 시작하되, **다음 3개 항목은 코드 머지 직전 (또는 동시) 처리:**
>
> 1. **CRITICAL-1**: 진산님 Anthropic 콘솔 cap 설정 + pre-flight 검사 — Step 11.6 코드 진입 **이전**
> 2. **CRITICAL-3 / MAJOR-2~5**: `docs/runbook/` 5개 신설 + 메시지 actionability 보강 — Step 11.6 코드 머지와 **동시** (별도 commit 시리즈 OK)
> 3. **CRITICAL-2 / CRITICAL-4 / MAJOR-1**: signal handler / D1 트리거 catch / stale lock threshold — Step 11.6 코드 작성 **중**
>
> **이연 가능 (Phase 2):**
>
> - MAJOR-3 JSONL 보관 정책 ADR — Step 19 (4-Pass + 5-페르소나) 직전까지 유보 가능 (운영 부채는 30일 후 누적 시 작용)
> - MINOR 5건 — Step 11.6 4-Pass 리뷰 정정 단계
>
> **stop 권고하지 않는 이유:**
> Step 11.6 plan 자체는 견고. AC-R1~R6 + AC-Cost + AC-Snapshot 8건 명확. 본 보고서의 CRITICAL 4건은 "코드 결함" 이 아니라 "**진산님 holster 의 빈 자리**". 코드 진행은 멈출 필요 없으나, 빈 자리를 채우지 않으면 BATCH-1 진입 시점에 진산님이 새벽 3시에 30분~2시간 손실.

---

## 검토 증거 (운영 부채 관점 — 자가 검증)

### 본 보고서가 실제로 확인한 것 (3개+ 의무)

1. `apps/batch/src/recover.ts:113-247` — RecoveryStatus 6종 모두의 메시지 본문 확인. 한글 사용 OK, 그러나 다음 행동 구체 부재 (CRITICAL-3).
2. `apps/batch/src/checkpoint.ts:38, 257-268` — STALE_LOCK_THRESHOLD_MS = 24h 상수 + writeCheckpoint 의 fsync 부재 (Step 11.6 §5 처리 예정 확인).
3. `apps/batch/src/cost-meter.ts:48-64, 287-301, 384-434` — KillSwitchError 메시지 + JSONL 로거 호출 + threshold 발동 console.warn/error.
4. `migrations/0015_batch_runs.sql:40-68` — 트리거 3종 RAISE(ABORT) 메시지 모두 영어 (MAJOR-2).
5. `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:285-440, 716-746, 875-890` — pipeline 통합 흐름 / signal handler 코드 / 위험 분석 매트릭스.
6. `docs/adr/ADR-025-two-layer-cost-control.md:222-303` — Layer 1 + Layer 2 동기화 + 진산님 수동 작업 미확인.
7. `apps/batch/src/pipeline.ts:215-259` — runPipeline 현 구조 (recover/checkpoint/CostMeter 미통합 확인).
8. `apps/batch/src/adapters/token-cost-logger.ts:1-50, 132-141` — JSONL 로그 디렉토리 (`process.cwd()/logs`), .gitignore 정책.
9. `.husky/pre-commit` + `_/` — pre-commit hook 1줄 (`scripts/check-no-secrets.sh` + lint-staged) — ADR-025 §2.4.3 의 cost-guard 미구현 확인.
10. `docs/exit-strategy/` — 디렉토리 자체 부재 (`ls` 결과: `cannot access`). 진산님 cap 스크린샷 저장 경로 사전 생성 필요.

### 본 보고서가 다른 4명 영역과 침범 안 한 것 (boundary 확인)

- refactoring-expert: 코드 품질 (any, 빈 catch, naming) — 본 보고서 미진입
- performance-engineer: 처리량 / latency / memory / GC — 본 보고서 미진입
- quality-engineer: 테스트 커버리지 / property test / mutation test — 본 보고서 미진입 (단, "AC-R6 의 caller 동작 검증 추가" 는 quality-engineer 의 영역도 일부 — 양쪽 채택 가능)
- backend-architect: D1 스키마 정규화 / API 설계 / 멀티시험 — 본 보고서 미진입 (단, "0015 트리거 영어 메시지" 는 schema 결정 영역 — 보고서 본문은 caller wrapper 우선 권고)

### Devil's Advocate 의무 ("이게 깨질 수 있는 시나리오")

§5 — Anthropic API key 유출 시나리오 (Layer 1/2 의 한계). 본 plan 범위 밖이나 **CRITICAL-1 즉시 처리 시 부분 완화** 명시.

---

**보고서 작성 완료 시각:** 2026-04-28 (KST)
**다음 갱신:** 다른 4개 페르소나 결과 도착 시, 메인 보고서 (`engine-hardening-midpoint-20260428.md`) §11 통합 + Top 3 Actions 매트릭스 우선순위 재정렬.
**아카이브:** Engine Hardening 완료 시 `docs/reviews/archive/2026MMDD-midpoint-devops.md`
