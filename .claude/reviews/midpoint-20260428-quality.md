# Engine Hardening 중간 점검 — Quality 관점

**리뷰어:** quality-engineer (독립 에이전트)
**관점:** "프로덕션에서 뭐가 물릴까?" — 테스트 부채 / 엣지 케이스 / mock 한계 / AC 충분성 / 회귀 차단력
**범위 (실제 읽음):**

- `.claude/reports/engine-hardening-midpoint-20260428.md` (392줄)
- `apps/batch/__tests__/cost-meter.test.ts` (428줄, 31 tests)
- `apps/batch/__tests__/checkpoint.test.ts` (433줄, 25 tests)
- `apps/batch/__tests__/recover.test.ts` (374줄, 8 tests)
- `apps/batch/src/recover.ts` (249줄, mock `BatchRunsDb`)
- `apps/batch/src/checkpoint.ts:185-244` (canonicalJson + assertCanonicalSafe)
- `migrations/0015_batch_runs.sql` (69줄, 트리거 3종)
- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` (1011줄, AC 8건)
- `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` (223줄)
- `docs/plans/engine-hardening/step6-recover-snapshot.plan.md` §1-100
- `.claude/reviews/review-20260427-230149-step11-5-recover-4pass.md` (111줄)

**다른 페르소나 영역 회피:** refactoring(코드 품질) / performance(처리량/지연) / backend(스키마/API 진화) / devops(SIGINT/cap/배포) — 본 보고서는 모두 **테스트 충분성 + 회귀 차단력** 관점으로만 침습.

---

## 1. 한 줄 평가

> **partial proceed** — 64/64 PASS는 unit-level에서는 견고하나 **e2e 부재로 인한 거짓 안심 (false confidence) 위험이 큼**. Step 11.6 plan §7 AC 8건은 **방향은 옳으나 5건이 단일 process 시뮬레이션** — AC-R3/R4 중 최소 2건은 진짜 프로세스 분리 e2e 필요. CRITICAL 2건(Q-C1 circular ref, Q-C2 AC-R3 mock-only) 정정 후 코드 진입 권고.

---

## 2. CRITICAL — 프로덕션 차단급 갭

### Q-C1. `assertCanonicalSafe` circular reference 무한 재귀 (Stack Overflow)

- **증거:** `apps/batch/src/checkpoint.ts:192-222` — recursive walk이 visited set 미사용. 객체 그래프에 cycle 있으면 무한 재귀 → Node.js stack overflow → process crash.
- **테스트 갭:** `checkpoint.test.ts:405-425` 의 `canonicalJson — P1-m3: 특수 타입 명시 거부`는 Date/Map/Set/BigInt/Function 5종만 검증. **circular reference 검증 0건.**
- **표면화 시나리오:**
  - `pipeline.ts` 의 `PipelineState` 가 `loadResult.contract` 와 `state.contract` 가 동일 객체 참조면 — 현재는 안전하지만 Step 11.6 §3.2 의 `toSnapshot()` 가 `state.contract.nodes[].edges?` 같이 노드↔엣지 양방향 참조 추가 시 즉사.
  - `KnowledgeContract` 의 노드/엣지 그래프가 self-loop 또는 cycle 포함 시 (실제 도메인: SUPERSEDES 체인 잘못 닫힘) `state_hash` 계산 시점에 stack overflow.
- **실제 파일 영향:** `state.contract` 자체는 plain JSON이나 — Step 11.6 §3.2 의 helper 가 `loadResult.lastInsertedNodeId ?? state.contract?.nodes[...]` 인 fallback 체인이 future 확장에서 cycle 도입되면 즉시 crash.
- **AC 매칭:** AC-Snapshot (§7) 이 Date/Map/Set/BigInt/Function 만 명시 — **circular ref / Symbol / TypedArray / Promise 4종 누락**.
- **차단력:** **0** (현재 어떤 테스트도 못 잡음)
- **우선순위:** Step 11.6 코드 진입 **전** 정정 — `assertCanonicalSafe` 에 `WeakSet<object>` visited 추가 + 별도 cycle test case.

### Q-C2. AC-R3 (동시 실행) 단일-process Promise.all = race 시뮬레이션 거짓

- **증거:** `step5-reproducibility-idempotency.plan.md:81-100` 시나리오 B 가 `Promise.all([runBatch(..), runBatch(..)])` — 단일 Node.js 이벤트 루프 안의 sequential await. 실제 OS process 2개의 race condition이 아님.
- **추가 증거:** `step5 plan §"위험 분석"` 자체가 인정: "`Promise.all` 동시 실행이 진짜 race condition 재현 못함 — Worker thread 또는 별도 process로 강화 검토 (Phase 2)" — **하지만 AC-RP-2 는 그 조건으로 PASS 판정 허용.**
- **표면화 시나리오:**
  - 진산님이 두 터미널에서 동시에 Claude Code 트리거 → 두 Node.js process가 같은 D1 SQLite 파일에 INSERT → SQLite WAL은 직렬화하지만 application-level race window (D1Db.selectByRunId → batchRunsDb.insertNewRun 사이) 가 SQL 레벨에서만 차단됨. 0015 트리거가 INSERT는 막지만, **동일 시각 두 process 의 selectByRunId 결과가 모두 null** 인 경우 → 두 INSERT 시도 → 1건 트리거 RAISE → 다른 1건 성공 → recover.ts 로직은 race window 인지 못함.
- **AC-R3 (Step 11.6 §7) 의 시뮬레이션 정의:** "다른 프로세스 시뮬레이션" 으로 적혀있으나 **`pipeline-integration.test.ts` 안에서는 결국 Promise.all 또는 mock concurrency.** 진짜 fork(child_process) 또는 Worker 미명시.
- **차단력:** SQL 레벨은 차단됨 (트리거 PASS), application 레벨 race window는 미차단.
- **우선순위:** AC-R3 정의를 **명시적으로 fork 기반 e2e** 로 격상 또는 "단일 process 시뮬레이션 한계" 로 명시 후 Step 5 e2e 재검증으로 이월.

### Q-C3. Build SLO `build_correctness: 0.999` 회귀 차단 자동화 0건

- **증거:** `docs/engines/formula-engine/contract.yaml:28` / `docs/engines/quality/contract.yaml:31` 모두 `build_correctness: 0.999` — 1000회 BATCH 중 1회 실패 허용.
- **테스트 갭:** Step 7 (`scripts/verify-engine-contracts.ts`) 가 미구현. 따라서 회귀 도입 시 (예: Cost Meter 의 `recordTokens` 가 부동소수점 누적으로 회귀) 자동 차단 메커니즘 없음. 31 tests 는 single-run pass/fail만 검증, **반복 실행 통계 검증 부재.**
- **표면화 시나리오:**
  - PR review 통과한 코드 변경이 결정성 일부 깨뜨림 (예: stage_results 매핑 순서 의존) → CI 100회 반복 실행 시 95~99% 성공으로 `build_correctness 0.999` 위반인데 자동 차단 X. 인간이 1회 PASS 만 보고 merge.
- **차단력:** 0
- **우선순위:** Step 7 (contract verify) 우선순위를 BATCH-1 진입 **차단 게이트** 로 명시 — Step 11.6 단독 통과로 BATCH-1 진입 안 됨을 plan 명시.

---

## 3. MAJOR — Step 11.6 진입 전 정정

### Q-M1. recover.test.ts 8건 = mock `BatchRunsDb` only — D1 트리거 RAISE(ABORT) 표면화 미검증

- **증거:** `apps/batch/__tests__/recover.test.ts:63-84` `makeMockDb()` 는 in-memory 객체. SQLite의 `RAISE(ABORT, 'batch_runs: cannot transition out of completed state')` 가 D1 client에서 어떤 Error class / message 로 표면화되는지 검증 0건.
- **현 위험 수준:** **MAJOR — 프로덕션 진입 전 미해소 시 CRITICAL 격상.**
- **표면화 시나리오:**
  - `D1BatchRunsDb.updateState` 가 `state='in_progress' → 'recovered'` 시도 → SQLite 트리거 RAISE(ABORT) → Drizzle ORM 또는 D1 client 가 `D1Error` 또는 `Error('cannot transition...')` 로 표면화 → recover.ts 의 `try { await opts.batchRunsDb.updateState(...) }` 가 catch 안 함 → 호출자 (Step 11.6 의 pipeline.ts) 가 처리 미정 → process crash.
  - 트리거 메시지 fingerprint를 catch 측에서 string match 로 분기 시도 시 — Cloudflare D1 가 메시지 prefix 추가 가능 (`SQLITE_CONSTRAINT_TRIGGER: ...`) → match 실패 → 잘못된 분기.
- **AC 매칭:** AC-R6 (§7) 이 본 항목 직접 다룸. 단, 명시 위치는 `pipeline-integration.test.ts` 또는 별도 `d1-trigger-verify.test.ts`. **D1 Preview 환경 의존성 인지 + local sqlite fallback 필요.**
- **권고:** Step 11.6 구현 시 **첫 통합 테스트 = D1 트리거 발화 확인 (T1~T4)**. 이게 PASS하기 전엔 recover.ts 의 RAISE 처리 로직 작성 불가.

### Q-M2. AC-R4 SIGINT 검증이 단일 SIGINT만 — Forced kill (두 번째 SIGINT) 시나리오 0건

- **증거:** Step 11.6 plan §5.3 `installSignalHandlers` 가 `process.exit(130/143)` 호출. 단, **두 번째 SIGINT** (Ctrl+C 두 번 빠르게) 시나리오 미정의.
- **표면화 시나리오:**
  - 진산님이 노트북 freeze 의심 → Ctrl+C 두 번 빠르게 → 첫 SIGINT가 handler 진입 + writeCheckpointSync 시작 → 두 번째 SIGINT 가 handler 재진입 → re-entrancy 미차단 → 두 번째 SIGINT의 handler가 **아직 미완료된 첫 번째의 tmp 파일 위에 덮어쓰기** → tmp 파일 corruption → rename 시점에 partial 상태.
  - Node.js 의 default SIGINT 가 user handler를 호출 후 다시 raise → forced exit. 현 plan 은 user handler 만 install, default 동작 미오버라이드 → Node.js 종료 시점이 fsync 완료 보장 못함.
- **AC 매칭:** AC-R4 (§7) 가 "SIGINT handler 가 sync 로 checkpoint flush" 로만 정의. 두 번째 SIGINT, SIGKILL (uncatchable) 시나리오 0건.
- **테스트 갭:** `signal-handlers.test.ts` 에 다음 3건 추가 필요:
  - `it('handles double SIGINT — second SIGINT during flush ignored or queued')`
  - `it('SIGKILL leaves tmp file (partial state) — recover detects + recovery_failed')`
  - `it('SIGTERM during writeCheckpointSync → tmp file remains, recover로직 무결성 검증 PASS or FAIL')`

### Q-M3. AC-Snapshot 의 직렬화 거부 5종에서 **누락 4종**

- **증거:** Step 11.6 plan AC-Snapshot 이 `Date / Map / Set / BigInt / Function` 만 명시. `checkpoint.test.ts:405-425` 도 동일.
- **누락 케이스:**
  | 누락 타입 | 표면화 |
  |:---|:---|
  | `Symbol` | `JSON.stringify` 가 silently 무시 → state_hash 미반영 → 변조 감지 우회 |
  | `TypedArray` (Buffer, Uint8Array) | `state.pdfPages` 가 Buffer 포함 시 — JSON.stringify가 `{0:.., 1:..}` 형태 dict로 fallback 변환 → 거대 hash 입력 + 비결정적 |
  | `Promise` (또는 thenable) | `state.contract` 가 lazy promise 포함 시 — `then` 메서드만 직렬화 → silent loss |
  | **Circular reference** | Q-C1 — stack overflow |
  | `RegExp` | JSON.stringify가 빈 객체 `{}` 로 변환 → silent collapse |
- **AC 매칭:** AC-Snapshot 정의를 **"JSON-safe primitives + plain object + array 만 허용 (whitelist)"** 으로 inversion 권고 — blacklist 방식은 신규 ECMAScript 타입 추가 시 회귀 보장 없음.
- **권고:** `assertCanonicalSafe` 를 **whitelist + visited set** 패턴으로 재작성 + test case 9건 (5+4 누락분).

### Q-M4. AC-R1 e2e: "BATCH 50% 진행 → kill → recover → 정확 재개" — Stage 6~10 재실행 결정성 미검증

- **증거:** Step 11.6 §7 AC-R1 의 검증 항목: "Stage 6~10 재실행 후 state='completed'", "최종 INSERT된 노드 수 = 정상 1회 실행과 동일 (data_loss=0)".
- **테스트 갭:** "동일" 의 정의가 **노드 개수만** 검증인지, **`(node_id, content_hash)` 동일** 까지인지 모호. recover 후 재실행한 stage 가 비결정적 (예: timestamp 컬럼 / random ID 생성) 이면 노드 개수는 같아도 실제 D1 row가 다름.
- **표면화 시나리오:**
  - Stage 6 (`integrity_check`) 가 내부적으로 `Date.now()` 사용 → 정상 1회 실행과 recover 후 재실행이 다른 timestamp → 노드 개수 같지만 invariant_fields 미검증 시 silent.
  - Stage 7 (`human_review`) 가 stub 상태에서 random sample 추출 → 재실행 시 다른 sample → 결과 다름.
- **AC 매칭:** Step 5 plan AC-RP-1 (Reproducibility) 와 AC-RP-3 (recover 후 동일) 가 **분리되어 있어야 정합** — 현재 Step 11.6 의 AC-R1 e2e 는 AC-RP-3 와 사실상 중복이지만, 양쪽 plan 모두 "동일" 의 의미가 invariant_fields 까지 인지 명시 부족.
- **권고:** AC-R1 검증 조건에 **`invariant_fields(snapshot1) === invariant_fields(snapshot2)`** (Step 5 §"AC-RP-1") 와 동일 기준 적용 명시.

### Q-M5. Negative path 부족 — 디스크 가득 / EACCES / D1 timeout / partial write / GC pause

- **증거:** 현 64 tests 의 negative path 분포:
  - cost-meter: NaN/Infinity/non-integer/negative tokens (`cost-meter.test.ts:280-312`) — **good**
  - checkpoint: JSON.parse 실패 / shape mismatch / schema_version mismatch (`checkpoint.test.ts:319-379`) — **good**
  - recover: 변조 감지 / 버전 불일치 / 동시 실행 / stale lock — **good**
- **누락 negative path:**
  | 시나리오 | 영향 | 현 검증 |
  |:---|:---|:---|
  | 디스크 가득 (ENOSPC) 시 `writeCheckpoint` | tmp 파일 0 byte → rename 후 corruption | 0건 |
  | EACCES (권한 거부) on `.checkpoint/` 디렉토리 | mkdir 실패 → 첫 stage 후 즉사 | 0건 |
  | `writeCheckpoint` 도중 process kill (partial write) | tmp 존재 + final 부재 → recover 시 NotFoundError | 0건 (rename 후만 검증) |
  | D1 query timeout (>30s) on `selectByRunId` | recover 무한 hang | 0건 |
  | GC pause 5초 동안 system clock 변경 | stale lock 판정 오류 | 0건 (FakeTimers 만 사용) |
  | `readFile` 가 0 byte 반환 (concurrent rename race) | JSON.parse fail → CheckpointCorruptedError ✅ | 간접 검증 |
- **AC 매칭:** Step 11.6 plan §8 위험 분석 표가 일부 언급하나 **AC 로 격상 안 됨** — "위험 인지" ≠ "차단 게이트".
- **권고:** AC-R5 (fsync 보장) 에 ENOSPC / EACCES 분기 + 명시 errno catch 검증 추가.

### Q-M6. Idempotency 4 시나리오 (Step 5) ↔ Step 11.6 e2e 정합 매트릭스 부재

| 시나리오                                               |        Step 5 plan         | Step 11.6 plan | 중복/누락                                                         |
| :----------------------------------------------------- | :------------------------: | :------------: | :---------------------------------------------------------------- |
| A: Reproducibility (단일 실행 재현성)                  |         ✅ AC-RP-1         |       ❌       | Step 5 단독                                                       |
| B: Concurrent trigger (Promise.all)                    |         ✅ AC-RP-2         | △ AC-R3 (e2e)  | 중복 — Step 5 의 mock 버전 + Step 11.6 의 e2e 가 양쪽 PASS 필요   |
| C: Recover 후 잔존 (50% kill → recover)                |         ✅ AC-RP-3         | ✅ AC-R1 (e2e) | 중복 — invariant_fields 검증 양쪽 일치 명시 필요 (Q-M4)           |
| D: Cron + 수동 동시                                    |     ❌ skip (Phase 2)      |       ❌       | 미검증 — 본 단계 OK                                               |
| E: 동일 batch_run_id 재실행 (완료 후)                  |         ✅ AC-RP-4         | ✅ AC-R3 분기  | 중복                                                              |
| F: knowledge_nodes 의 (batch_run_id, source_id) UNIQUE | △ 마이그레이션 0016 (이연) |       ❌       | **누락 — Step 11.6 진입 전 미해소면 recover 후 중복 INSERT 가능** |

- **권고:** ROADMAP v1.2 패치에 본 매트릭스 포함 + 시나리오 F 를 Step 5 우선순위 B → A 로 격상 (Step 11.6 e2e 가 시나리오 C 검증 시 UNIQUE 제약 부재 → 거짓 PASS 가능).

### Q-M7. 4-Pass 리뷰가 못 잡는 cross-cutting 버그 카테고리

4-Pass 3건이 발견한 CRITICAL 4건 모두 unit test로 검증 + 정정. 그러나 **e2e 부재 = 다음 카테고리 검출 불가:**

| 카테고리                                                         |      4-Pass 검출력       | e2e 필요성 |
| :--------------------------------------------------------------- | :----------------------: | :--------: |
| 단일 모듈 silent failure                                         | ✅ 강 (P1-M3 JSON.parse) |    낮음    |
| 모듈 간 인터페이스 타입 불일치                                   | ✅ 강 (Pass 2 Architect) |    낮음    |
| **상태 전이 race** (recover ↔ pipeline ↔ batchRunsDb)            |          ❌ 약           |  **높음**  |
| **재시작 시 결정성 (Stage 6~10 재실행)**                         |          ❌ 약           |  **높음**  |
| **process kill 시 partial state**                                |          ❌ 약           |  **높음**  |
| **checkpoint ↔ batch_runs 일관성** (file 존재 + DB state 불일치) |          ❌ 약           |  **높음**  |
| **CostMeter ↔ checkpoint cost_state 인계**                       |          ❌ 약           |  **중간**  |
| API contract regression                                          | ✅ 강 (Pass 4 Contract)  |    낮음    |

- **표면화 카테고리 4건 (e2e 부재 시 검출 0):**
  1. checkpoint file 존재 + DB state='completed' 동시 → recover 가 already_completed 분기인데 file 무시 → 다음 recover에서 **stale checkpoint** 가 재사용됨 (file 정리 정책 미정).
  2. checkpoint file 부재 + DB state='in_progress' (kill 직후 file 미flush) → recover 가 concurrent_run_detected 반환 → 24h 대기 → 진산님 매뉴얼 개입 필요. **자동 복구 불가.**
  3. CostMeter `initial_spend_usd` 가 checkpoint cost_state 에서 읽혀와도 **per_model usage 누적 정보는 손실** (cost_state 에 per_model 미포함) → recover 후 정확한 audit 불가.
  4. `state_hash` 가 cost_state 포함 vs 미포함 시 다름 → recover 시 cost_state 변경되면 state_hash 불일치 → CheckpointCorruptedError.

---

## 4. MINOR — 향후 단계

### Q-m1. cost-meter test 의 `vi.spyOn(console, 'warn')` 패턴 — global side effect

- 31 tests 가 console.warn 을 mock. 병렬 실행 시 (`vitest --threads`) 다른 test 가 warn 흘리면 누설 가능. 현재 vitest 기본은 file-level isolation 이라 OK 이나, 파일 내 race 가능.
- **권고:** `beforeEach`에서 일괄 spy + `afterEach` restore. 현재는 it 단위.

### Q-m2. recover.test.ts 의 `vi.useFakeTimers()` cleanup 누락 일부

- `recover.test.ts:262-298` 의 stale lock test 가 `vi.useFakeTimers()` 호출 후 afterEach 의 `vi.useRealTimers()` 의존. 만약 다음 test 가 `useFakeTimers()` 미호출 시 — 의도된 patch 가 OK. 단, 시간 시뮬레이션 관련 추가 test 작성 시 누락 가능성.

### Q-m3. checkpoint.test.ts:319-355 의 dynamic import (`await import('node:fs/promises')`)

- 테스트 내부에서 dynamic import 로 fs 호출 — vi.mock 적용 어려움 + 가독성 저하. test scaffolding 으로 분리 권고.

### Q-m4. AC-Cost (§7) — `dailyBudgetUsd=0.001` 트릭이 실제 production 시나리오 아님

- 즉시 kill 도달 시뮬레이션은 OK이나, **soft → hard → kill 점진적 도달** (수 시간에 걸친 누적) 시나리오 e2e 0건. 진짜 production 에서 발생하는 패턴은 점진적 누적.
- **권고:** AC-Cost 에 `dailyBudgetUsd=10` + 3000회 `recordTokens` 호출 점진 도달 변형 추가.

### Q-m5. fixture 데이터의 결정성 검증 부재

- `apps/batch/src/fixtures/batch-1-contract.json` 자체가 결정적인지 (인간이 수정 시 hash 변동 검출) 미검증. fixture 변경 시 모든 e2e 가 자동 재실행 + golden file 갱신 정책 미정.
- **권고:** Step 5 plan 에 fixture golden hash 추가.

---

## 5. Devil's Advocate — "64/64 PASS 가 거짓 안심을 주는 시나리오"

**시나리오: "노드 개수 동일 = recover 성공" 의 거짓 PASS**

진산님이 BATCH-1 적재 중 50% 진행 후 진산님 노트북이 sleep → 재개 시 recover 가 `fully_recovered` 반환. 64 tests 는 모두 PASS, AC-R1 e2e 도 "최종 노드 수 = 정상 실행과 동일" 만 검증.

**그러나 실제 문제:**

- Stage 6 (`integrity_check`) 의 SUPERSEDES 엣지가 정상 실행 시 `(CONCEPT-001 → CONCEPT-002)` 인데, recover 후 재실행 시 stage 6 재계산 input 데이터가 **stale checkpoint 의 state.contract** 에서 옴 — 정상 실행 시 사용된 input 과 다른 stage 결과 의존 시 결과 다름.
- 노드 개수는 같으나 엣지 종류가 다름 → 그래프 isomorphism 깨짐 → quality engine 의 CBIV 검증이 다른 cluster 분류 → 학습자료 생성 시 다른 출력.
- **이 모든 차이가 64 tests 와 AC-R1 의 "노드 개수 == N" 단일 invariant 로 거짓 PASS.**

**근본 원인:**

1. invariant_fields 정의 부재 — Step 5 plan 이 정의 책임이지만 코드 미진.
2. 그래프 isomorphism 검증 0건 (Step 4 quality 책임이지만 미진).
3. recover 의 "동일" 정의가 cardinality 만.

**해결책:**

- AC-R1 PASS 조건에 `quality.cbiv(snapshot1) === quality.cbiv(snapshot2)` 추가 — 단, Step 4 미진. 따라서 Step 4 + Step 5 + Step 11.6 가 **함께 PASS** 해야 진정한 e2e 성립.
- **이게 Top 3 Action #1 의 직접 근거.**

**두 번째 시나리오: 4-Pass 리뷰 자체의 거짓 안심**

`review-20260427-230149` 가 CRITICAL 1건 + MAJOR 8건 발견 + 정정. **그러나 본 quality 검토에서 CRITICAL 3건 신규 발견** (Q-C1 circular ref, Q-C2 mock-only race, Q-C3 SLO 자동화 0). 이는 4-Pass 가 **단일 시점 코드 정합성** 만 검증하고, **누적 SLO 회귀 / 신규 ECMAScript 타입 / 시뮬레이션 충실성** 은 검증 범위 밖이라는 뜻.

→ **5-페르소나 리뷰가 4-Pass 의 추가 차단 게이트로 의무화된 의의가 정확히 이것.**

---

## 6. Top 3 Actions

### Action 1 (BLOCKING — Step 11.6 코드 진입 전 의무)

**Q-C1 + Q-M3 정정: `assertCanonicalSafe` whitelist + visited set 재작성**

- `apps/batch/src/checkpoint.ts:192-222` 를 whitelist 기반 + `WeakSet<object>` cycle detection 으로 재작성
- `apps/batch/__tests__/checkpoint.test.ts` 에 9 신규 테스트:
  - circular ref (self / mutual) 2건
  - Symbol / TypedArray / Promise / RegExp 4건
  - 정상 plain JSON pass 3건 (regression)
- 추정: 0.3d
- 차단력: stack overflow 예방 + AC-Snapshot 정의 강화

### Action 2 (BLOCKING — Step 11.6 plan 정정)

**AC-R1 / AC-R3 / AC-R4 정의 강화**

- AC-R1 검증 조건에 `invariant_fields` 동일 명시 (Step 5 §AC-RP-1 와 동일 기준)
- AC-R3 를 **fork(child_process) 기반 e2e** 로 격상 또는 "단일 process 시뮬레이션 한계" 명시 후 시나리오 F (Step 5 0016 UNIQUE) 우선순위 격상
- AC-R4 에 **double SIGINT / SIGKILL during flush / SIGTERM during rename** 3건 추가
- Step 11.6 plan §7 정정 (v1.0 → v1.1)
- 추정: 0.2d
- 차단력: e2e 의 거짓 PASS 차단

### Action 3 (BLOCKING — BATCH-1 진입 전, Step 11.6 후 즉시)

**Step 7 (contract verify) 우선순위 A 격상 + `build_correctness 0.999` 자동 회귀 테스트**

- `scripts/verify-engine-contracts.ts` 가 100회 반복 실행 + 통계 검증
- CI workflow 에 nightly 1회 1000회 실행 추가
- BATCH-1 진입 차단 게이트로 ROADMAP v1.2 명시
- 추정: 1d (Step 7 자체 + CI 통합)
- 차단력: SLO 회귀 자동 차단 + Q-C3 해소

---

## 7. 진행 권고

**partial proceed** — 다음 순서:

1. **즉시 (0.5d):** Action 1 + 2 정정 (Q-C1, Q-M3, AC 정의 강화)
2. **그 다음 (2.6d 현실):** Step 11.6 코드 진입 (AC-R1~R6 + AC-Cost + AC-Snapshot 8건 e2e)
3. **그 다음 (1.5d):** Step 5 plan 갱신 (마이그레이션 0016 + 시나리오 F) → Step 5 코드
4. **그 다음 (1d):** Action 3 — Step 7 우선순위 격상 + 회귀 자동화
5. **그 다음:** Step 2~4 (formula/parser/quality property test) — Step 11.6 와 병렬 가능 (의존성 X)

### 결정 후보 (보고서 §10) 중 테스트 관점 가장 위험한 결정

**후보 A (Step 11.6 코드 즉시 진입) — 위험 ★★★** 만약 Action 1 (Q-C1) 미정정 후 진입 시 — Step 11.6 통합 테스트 작성 중 stack overflow 발견 → 전체 plan 재정정 → 4.2d 비관 추정 초과 가능. **진입 전 0.5d 정정이 비용 1/8.**

**후보 D (Step 2~4 Property test 병렬) — 위험 ★** Step 11.6 와 의존성 0. 오히려 병렬 진행이 결정성 검증 조기 확보. 권고.

**후보 B (Step 5 plan 갱신) — 위험 ★★** 시나리오 F (UNIQUE) 미해소 시 Step 11.6 의 AC-R1 e2e 가 거짓 PASS (중복 INSERT 미차단). **B + A 묶음 진입 권고.**

**가장 안전한 진행:** Action 1, 2 (0.5d) → B (0.3d, plan 갱신) → A (Step 11.6 코드 2.6d) → Step 5 코드 (1.5d) → Action 3 (1d) → Step 2~4 (병렬 가능, 4d).

**총 6d ~ 9.4d (현실 ~ 비관)** 후 BATCH-1 진입 가능.

---

## 부록: AC 별 검증 충분성 매트릭스

| AC                          |  명시 위치   |   unit    |   integration   |       e2e        |               충분성                |
| :-------------------------- | :----------: | :-------: | :-------------: | :--------------: | :---------------------------------: |
| AC-1 (Pipeline 정상 흐름)   | Step 11.6 §7 |     △     |       ✅        |        ❌        |                 중                  |
| AC-R1 (50% kill → recover)  | Step 11.6 §7 | ✅ (mock) |       ❌        |   ✅ (planned)   |         **Q-M4 정정 필요**          |
| AC-R2 (변조 감지)           | Step 11.6 §7 |    ✅     |        △        |        ❌        |                 중                  |
| AC-R3 (동시 실행)           | Step 11.6 §7 | ✅ (mock) | △ (Promise.all) | ❌ (fork 미명시) |         **Q-C2 정정 필요**          |
| AC-R4 (SIGINT)              | Step 11.6 §7 |    ❌     | △ (단일 SIGINT) |        ❌        |         **Q-M2 정정 필요**          |
| AC-R5 (fsync)               | Step 11.6 §7 |    ❌     |       ❌        |   △ (planned)    |     **Q-M5 negative path 필요**     |
| AC-R6 (0015 트리거)         | Step 11.6 §7 | ❌ (mock) |  ✅ (planned)   |  △ (D1 Preview)  |         **Q-M1 정정 필요**          |
| AC-Cost (kill switch flush) | Step 11.6 §7 |    ✅     |        △        |        ❌        |       **Q-m4 점진 도달 추가**       |
| AC-Snapshot (직렬화 거부)   | Step 11.6 §7 | ✅ (5종)  |       ❌        |        ❌        | **Q-C1, Q-M3 정정 필요 (4종 누락)** |
| AC-RP-1 (Reproducibility)   |  Step 5 §AC  |    ❌     |       ❌        |        ❌        |                미진                 |
| AC-RP-3 (recover invariant) |  Step 5 §AC  |    ❌     |       ❌        |        ❌        |   미진 — Q-M4 와 AC-R1 정합 필요    |

**0건 보고 증거:**

- AC-R6 unit (mock): `recover.test.ts:63-84` mock `BatchRunsDb` 사용 — 실제 트리거 미검증
- AC-R4 unit: `signal-handlers.test.ts` 미존재 (Step 11.6 신규)
- AC-R5 unit: `writeCheckpoint` fsync 옵션이 Step 11.6 신규 — 현 25 checkpoint tests 모두 fsync false 가정

---

**리뷰 완료 시각:** 2026-04-28 (KST)
**판정:** partial proceed (CRITICAL 3건 + MAJOR 7건 + MINOR 5건 — Action 1, 2 정정 후 Step 11.6 진입 가능)
**다음 갱신:** Action 1, 2 정정 완료 시 본 보고서 §6 / §부록 재검증
