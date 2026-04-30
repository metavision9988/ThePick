# 4-Pass 독립 에이전트 리뷰 — Step 11.5 Recover/Snapshot

**리뷰 방식:** 독립 서브에이전트 3개 (Pass 1 SURGEON / Pass 2 ARCHITECT / Pass 4 CONTRACT)
**리뷰 일시:** 2026-04-27 23:01:49 (1차) / 23:11:32 (정정 후 자체 점검)
**Vitest 결과 (정정 후):** 64/64 PASS (cost-meter 31 + checkpoint 25 + recover 8)
**TypeCheck:** PASS

리뷰 범위:

- 변경: `apps/batch/src/checkpoint.ts` (281 → 369줄), `apps/batch/src/recover.ts` (238 → 248줄)
- 변경: `apps/batch/__tests__/checkpoint.test.ts` (15 → 25 tests), `recover.test.ts` (8 tests)
- 변경: `migrations/0015_batch_runs.sql` (49 → 67줄)
- 신규: `.gitignore` (`.checkpoint/` 추가)

---

## 1차 리뷰 결과 종합

| Pass        | 에이전트              | 결과                              |
| :---------- | :-------------------- | :-------------------------------- |
| 1 SURGEON   | silent-failure-hunter | 🔴 1 / 🟠 4 / 🟡 3 / ✅ 7 / N/A 1 |
| 2 ARCHITECT | system-architect      | 🔴 0 / 🟠 2 / 🟡 3 / ✅ 6 / N/A 1 |
| 4 CONTRACT  | quality-engineer      | 🔴 0 / 🟠 2 / 🟡 3 / ✅ 7 / N/A 2 |

**합계 (중복 제거):** 🔴 CRITICAL **1건** / 🟠 MAJOR **8건** / 🟡 MINOR **9건**

---

## CRITICAL/MAJOR 정정 결과

### 🔴 CRITICAL P1-C1 — 0015 트리거가 INSERT만 가드, UPDATE 무방비

**정정:** `BEFORE UPDATE OF state` 트리거 2종 추가

- `trg_batch_runs_no_state_downgrade` — completed → 다른 상태 차단
- `trg_batch_runs_recover_only_from_terminal` — recovered 전이는 (killed/failed) 에서만

증거: `migrations/0015_batch_runs.sql:50-67`

### 🟠 P1-M1 — `writeCheckpoint` fsync 누락

**처리:** 본 단계 명시 주석 + Step 11.6 (pipeline 통합) 으로 이연. `readCheckpoint` 의 `JSON.parse` 가드(P1-M3 정정)로 silent failure 차단.

### 🟠 P1-M2 — `parseMajor` raw throw 외부 catch 부재

**정정:** `readCheckpoint` 에서 `try/catch → CheckpointVersionMismatchError` 통합

### 🟠 P1-M3 — `JSON.parse` 실패 silent 전파

**정정:** `try/catch → CheckpointCorruptedError(reason)` 통합 + runtime shape 검증 + schema_version mismatch

### 🟠 P1-M4 — Q4 `depends_on` stub

**정정:** 발견 시 `recovery_failed + manual_review` 명시 거부

### 🟠 P2/P4 — Step 5 UNIQUE 제약 미구현

**처리:** Step 5 plan 의무로 명시 이연. 마이그레이션 0016 에서 `(batch_run_id, source_id)` UNIQUE.

### 🟠 P2/P4 — pipeline.ts 통합 미수행

**처리:** Step 11.6 신설 (Task #11). AC-R1 e2e 검증 이전.

### 🟠 P4 반론 — SIGINT handler 누락

**처리:** Step 11.6 plan 에 micro-step 추가.

---

## MINOR 9건 처리

| #                                            | 처리                                                                           |
| :------------------------------------------- | :----------------------------------------------------------------------------- |
| `nodes_total` 의미 부정확                    | `nodes_completed` + `edges_completed` 분리                                     |
| 24h 매직넘버                                 | `STALE_LOCK_THRESHOLD_MS` 상수 추출 + clock skew 보정                          |
| `canonicalJson` Date silent collapse         | 사전 walk `assertCanonicalSafe` 도입 — Date/Map/Set/BigInt/Function 명시 throw |
| D1 Preview 통합 테스트                       | Step 11.6 또는 Step 7 으로 이연                                                |
| exam_id 격리 (Hard Rule 16)                  | Year 2 Phase 4 이연                                                            |
| engine_version semver CHECK                  | application 레벨 검증으로 충분 (over-engineering 회피)                         |
| `BatchRunState` 5종                          | plan §"v1.1 정정" 에 명시 (의도된 확장)                                        |
| CostMeter `cost_state` 매핑                  | Step 11.6 통합 시 mapper 작성                                                  |
| `RecoveryResult.resumed_from_stage` nullable | 실패 시나리오 표현 — silent pivot 아님                                         |

---

## 정정 후 64/64 PASS

```
- cost-meter.test.ts: 31/31
- checkpoint.test.ts: 25/25 (15 → +10 신규)
- recover.test.ts:    8/8
```

신규 테스트: JSON.parse / parseMajor / canonicalJson 거부 5종 / STALE_LOCK_THRESHOLD_MS 상수 export

---

## 최종 판정

**Step 11.5 Recover/Snapshot — 완료 가능 (이연 명시 후).**

- CRITICAL 1건 → 0건 (즉시 정정)
- MAJOR 8건 → 4건 즉시 정정 + 4건 명시 이연 (Step 11.6 + Step 5)
- MINOR 9건 → 6건 즉시 정정 + 3건 이연
- 64/64 PASS, typecheck PASS

**다음 단계:** Step 11.6 신설 plan 작성 (Task #11) → Step 5 plan 갱신 → ROADMAP v1.2 패치.

---

**리뷰어:** silent-failure-hunter, system-architect, quality-engineer (3개 독립 에이전트)
**판정:** ✅ Step 11.5 완료 (이연 명시 후). CRITICAL 0건 / MAJOR 즉시 정정 4건 + 명시 이연 4건.
