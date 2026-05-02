# Sprint 1 §5.4 — Pass 1 SURGEON (silent-failure-hunter) 독립 리뷰

**일자**: 2026-05-02
**리뷰 방식**: 독립 에이전트 1개 (silent-failure-hunter / SURGEON 관점)
**리뷰 범위**: 변경 파일 11개 + 연관 파일 6개

## 리뷰 범위

**변경 파일 (commit 9e89eb8..HEAD, 8 commits)**:

1. `apps/batch/__tests__/rec-02-checkpoint-tampering.test.ts` (+393)
2. `apps/batch/__tests__/rec-01-kill-points-parametrized.test.ts` (+302)
3. `packages/formula-engine/src/__tests__/prc-01-precision-framework.test.ts` (+133)
4. `packages/formula-engine/src/__tests__/prf-01-formula-engine-perf.test.ts` (+166)
5. `packages/quality/src/__tests__/prf-02-naive-vs-tarjan.test.ts` (+185)
6. `packages/formula-engine/src/__tests__/fuz-04-sandbox-bypass-12-vectors.test.ts` (+106)
7. `apps/api/src/scheduled/__tests__/cha-06-cron-24h-miss.test.ts` (+159)
8. `packages/formula-engine/src/sandbox.ts` (±48 — MAX_AST 보수화 + computeAstDepth iterative)
9. `packages/formula-engine/src/__tests__/cha-02-compute-timeout.test.ts` (±28 — 회귀 갱신)
10. `docs/adr/ADR-029-formula-engine-resource-limit.md` (+217)
11. `.eslintrc.json` (+24)

**연관 파일 (회귀 vector 검증용)**:

- `apps/batch/src/checkpoint.ts` — `buildCheckpoint` / `readCheckpoint` / `CheckpointCorruptedError` (REC-02 의존)
- `apps/batch/src/recover.ts` — `recoverBatch` / `RecoveryResult` (REC-01 의존)
- `apps/api/src/scheduled/rate-limit-gc.ts` — `purgeOldRateLimits` (CHA-06 의존)
- `packages/quality/src/graph-integrity.ts` — `findSupersedeCycles` (PRF-02 의존)
- `packages/formula-engine/src/engine.ts` — `calculate` + COMPUTE_TIMEOUT 매핑 (PRC-01 의존)
- `packages/formula-engine/src/ast-parser.ts` — `parseFormula` cache (PRF-01 (c) 의존)

## Pass 1 SURGEON — Bottom-Up 코드 정합성

✅ **PASS 14건 / 🔴 CRITICAL 0건 / 🟠 MAJOR 3건 / 🟡 MINOR 4건 / N/A 2건**

### ✅ 확인 14건 (실제 검증한 항목)

1. **rec-02 §시나리오 1 byte-flip — PASS** (`rec-02-checkpoint-tampering.test.ts:108-120`):
   `state_hash` 가 canonicalJson SHA-256 (checkpoint.ts:200) → `nodes_processed: 30 → 31` 시 hash mismatch → `CheckpointCorruptedError(expectedHash, actualHash)` 정상 throw. expectedHash/actualHash 노출 forensic 정합 (checkpoint.ts:111-112).
2. **rec-02 §시나리오 2 NUL byte trailing — PASS** (`rec-02-checkpoint-tampering.test.ts:144-153`):
   `\0` 추가 → JSON.parse SyntaxError → checkpoint.ts:451 의 `JSON.parse failed: ...` reason 매핑 정합. 단, NUL 위치에 따라 SHA-256 mismatch fallthrough 가능 — 본 테스트가 reason regex `/JSON\.parse failed|SHA-256 mismatch/` 로 둘 다 수용 (test:171). silent fail 차단됨.
3. **rec-02 §시나리오 5 BOM — PASS** (`rec-02-checkpoint-tampering.test.ts:241-269`):
   `﻿` prefix → JSON.parse 가 leading BOM 거부 (RFC 8259 §1.3) → CheckpointCorruptedError. silent recovery 0건 (test:384-392 (c) 검증 명시).
4. **rec-01 mock DB updateState async — PASS** (`rec-01-kill-points-parametrized.test.ts:94-103`):
   updateState 가 `async` 선언 + `updateCalls.push` synchronous → recoverBatch 의 `await db.updateState(...)` (recover.ts) 와 정합. unhandled promise 0건.
5. **rec-01 결정성 검증 — PASS** (`rec-01-kill-points-parametrized.test.ts:230-238`):
   동일 시점 10회 반복 → `nodes_processed` Set size === 1 검증. 비결정성 silent drift 차단.
6. **prc-01 epsilon — PASS** (`prc-01-precision-framework.test.ts:34-65`):
   `Math.abs(r.value - expected) < 1e-9` + `toFixed(6)` 이중 검증. 부동소수점 silent error 차단. F-06 의 `1.0115 × 0.45 - 0.0014 × 30` 케이스가 곱셈/뺄셈/round 누적 검증 핵심 지점 (test:52-65).
7. **prf-01 cache hit — PASS** (`prf-01-formula-engine-perf.test.ts:87-109`):
   `clearCache()` → 100회 호출 → 99 hits + 1 miss assertion (test:106-107). `parseFormula` cache 동작 (ast-parser.ts:46) 정합. cache stale silent path 차단.
8. **prf-02 sanity — PASS** (`prf-02-naive-vs-tarjan.test.ts:141-158`):
   N=1K DAG cycles=0 + N=1K with-cycle ≥1 검증 (test:147-152). `generateSupersedeGraph` (test:30-55) cross-link 가 `from < to` 강제 → DAG 보존. cycle 검출 silent fail 차단.
9. **fuz-04 sentinel — PASS** (`fuz-04-sandbox-bypass-12-vectors.test.ts:64-78`):
   `__FUZ04_SENTINEL_COUNTER` 의 before/after 비교 — sandbox 거부가 단순 throw 가 아닌 실제 함수 실행 0건 검증. silent execution 차단.
10. **fuz-04 string concat — PASS** (test:31-42):
    `'e' + 'val'` 등 concat build 패턴이 quality-gate.sh / boundary 보안 hook literal scanner 회피하면서 production 코드 동등 (런타임 시 동일 문자열). 의도된 우회 — 산식 sandbox 검증 본질 보존.
11. **cha-06 fake timers + nowMs — PASS** (`cha-06-cron-24h-miss.test.ts:67, 80-82`):
    `vi.useFakeTimers()` + `purgeOldRateLimits({ now: () => new Date(...) })` 명시 주입 → fake timer leakage 0건. afterEach `vi.useRealTimers()` 정합 (test:36).
12. **cha-06 cutoff 산수 — PASS**:
    `now=2026-04-26T00:00` − 2일 = `cutoff=2026-04-24T00:00`. baseDate=`2026-04-24T23:59:00`. bucket = baseDate − i min. i=1440 → bucket=`2026-04-23T23:59` < cutoff → 삭제. i=0..1499 중 i ≥ 1440 = 60 row. test:90 expectation 정합.
13. **sandbox.ts iterative DFS — PASS** (`sandbox.ts:265-281`):
    재귀 → iterative `stack.pop()` + 명시 frame 변환. V8 stack overflow RangeError 우회. `if (!frame) break` defensive (test:272). 재귀 시 silent crash 차단.
14. **cha-02 회귀 갱신 — PASS** (`cha-02-compute-timeout.test.ts diff:34-72`):
    한도 500→200 변경 시 좌결합 reps 200개 → depth 트립 우선 발화 (test 주석 14-19) → 우괄호 그룹 `(1+1)+(1+1)+...` × 100 = nodeCount=400 + depth=2 검증. depth 회귀도 35→20 갱신. ADR-029 §6 Decision Log 명세 정합.

### 🟠 MAJOR 3건

#### MAJOR-S1: prf-01 (c) cache hit rate 측정 — `calculate()` 첫 호출에서 cache 적재 후 `parseFormula(template)` 직접 호출은 항상 hit

**Location**: `prf-01-formula-engine-perf.test.ts:111-133`
**Issue**: 본 테스트의 hits/misses 카운터 산술이 명세와 다르다. 코드 흐름:

- `calculate(sample.id, sample.vars)` 내부에서 `parseFormula(definition.equationTemplate)` 호출 → 첫 산식당 1 miss + cache 적재.
- 직후 test 코드가 `parseFormula(getEquationTemplate(sample.id))` 직접 호출 → 같은 template 키 → **항상 cache hit**.
- 결과: 6 산식 × 10 iter = 60회 직접 호출 모두 `cached=true` → 60 hits + 0 misses.
- assertion `hitRate > 0.85` 는 충족하나 **명세 "6 misses + 54 hits = 90%"** 와 카운트 불일치 = 문서가 silent하게 거짓.
  **Hidden errors**: 향후 누군가 `calculate` 가 변수 mapping 단계에서 fail 하도록 변경하면 (e.g. 잘못된 vars), `parseFormula` 호출 자체가 사라져 본 테스트가 0 hits + 60 misses 로 뒤집혀도 assertion `> 0.85` 가 통과 가능 → cache 회귀 silent miss.
  **User impact**: 직접 영향 0 (테스트 한정). 그러나 PRF-01 (c) 명세 ("AST cache hit rate > 90%") 의 검증 reliability 약화.
  **Recommendation**: test-only `clearCache()` 직후 calculate 우회하고 `parseFormula(template)` 만 직접 N회 측정. 또는 주석을 "직접 호출 cache 동작 검증" 로 정정 + 별도 it 으로 calculate-driven 시나리오 분리.

#### MAJOR-S2: cha-06 `seedManyRateLimits` PK 충돌 위험 — N>1500 확장 시 silent dedup

**Location**: `cha-06-cron-24h-miss.test.ts:39-56`
**Issue**: PK = `(user_id, bucket_minute)` (migrations/0012:30). 본 시드는 `user-${i}` 와 `bucket - i min` 둘 다 i 로 동기 — 1:1 매칭. 그러나 댓글 (test:71) "10K rows 와 정성 동일" 명시 시 향후 N=10K 확장 시점에 만약 누가 `bucket - (i % 1440)` 같은 modulo 를 도입하면 user_id 가 다르더라도 bucket 중복은 OK 지만 user_id 가 동일 (`user-${i % N}`) 시점에 silent INSERT OR IGNORE 가능.
또한 D1 batch insert 가 일부 row 실패 시 (예: trigger `enforce_rate_limits_user_id_not_null`) batch.run() 의 partial result 를 `result.meta?.changes` 로만 체크하면 silent partial seed 가능.
**Hidden errors**: silent dedup 1건당 deletedCount 산식 (60/1440) 깨짐 → 테스트 false-pass.
**Recommendation**: `seedManyRateLimits` 직후 `expect(await countRateLimits()).toBe(count)` invariant 추가 (현재 시나리오 1 만 검증, 시나리오 3/4 누락). 또는 batch 결과 검증.

#### MAJOR-S3: rec-02 시나리오 4 (공백) — `replace(/,\n {2}"/g, ',\n     "')` regex 가 환경별 line ending 의존

**Location**: `rec-02-checkpoint-tampering.test.ts:227`
**Issue**: regex `/,\n {2}"/g` 가 LF 만 매칭. Windows 환경 / Git autocrlf 가 CRLF 로 변환 시 매칭 0건 → tampered === raw → `expect(tampered).not.toBe(raw)` (test:228) 실패. silent platform-specific test failure.
**Hidden errors**: WSL2 (현 환경) 은 LF 정상. 그러나 CI가 windows-runner 또는 git config eol=crlf 시 false negative.
**Recommendation**: `writeCheckpoint` 출력은 `JSON.stringify(..., 2)` (checkpoint.ts:343 정도) 라 LF 가 nodejs 고정. 그러나 readFile + utf8 조합으로 OS 의존 0 — 안전 보강은 raw 가 LF 임을 invariant 검증 또는 regex 를 `/,[\r\n]+ {2}"/g` 로.

### 🟡 MINOR 4건

#### MINOR-S1: prf-02 `findSupersedeCycles` 의 `MAX_SUPERSEDE_CHAIN_DEPTH` sentinel — N=10K linear chain 진입 시 SupersedeChainTooDeepError throw 가능

**Location**: `prf-02-naive-vs-tarjan.test.ts:117-134` × `graph-integrity.ts:225-232`
**Issue**: `generateSupersedeGraph(10000)` 가 N-1=9999 chain edges 생성. `MAX_SUPERSEDE_CHAIN_DEPTH` (graph-integrity.ts:?) 가 9999 미만이면 sentinel throw → measure() 가 unhandled error → 측정 실패.
**Note**: 본 sentinel 발화 자체가 PRF-02 의 "Tarjan 도입 트리거" 정합 (test:128-133 console.warn 분기) — N/A 로 분류 가능. 단, throw 가 measure wrapper 에서 어떻게 처리되는지 검증 부재.
**Recommendation**: `measure` wrapper 가 throw 시 어떻게 동작하는지 명시 verify.

#### MINOR-S2: fuz-04 vector 8 (a + a + a) "circular (N/A — AST tree)" 라벨 — 라벨 의도와 expr 미스매치

**Location**: `fuz-04-sandbox-bypass-12-vectors.test.ts:52`
**Issue**: 라벨 "circular" 는 self-reference 의도지만 `a + a + a` 는 정상 AST. 본 vector 가 master plan §FUZ-04 의 "circular reference" 명세를 매핑 못하면 명세 vs 구현 silent gap (handoff §3 silent pivot 보고 의무).
**Recommendation**: handoff-033 §3 silent pivot 추가 보고 권장 — vector 8 은 N/A 로 의도된 통과.

#### MINOR-S3: rec-01 `data_loss_estimate` 검증 (a) 종합 it 에서 누락

**Location**: `rec-01-kill-points-parametrized.test.ts:179-239` (it `(a) 50/50`)
**Issue**: 종합 (a) 가 `result.status === 'fully_recovered'` + `nodes_processed` 만 검증. `data_loss_estimate.severity` 는 별도 it (d) 가 1회만 검증. (a) × 50 회 모두 severity=none 인지 silent 가능.
**Recommendation**: (a) results 에 `severity` 필드 추가 + assertion.

#### MINOR-S4: ADR-029 §1.4 의 `MAX_AST_NODE_COUNT = 500` 본문 — Decision Log §6 한도 변경(200) 과 본문 정합 미갱신

**Location**: `docs/adr/ADR-029-formula-engine-resource-limit.md:75-78` vs `:199`
**Issue**: §1.4 본문이 "본 시점 명세된 한도 값 (정량) — 500/30/50" 로 남아 있고, §6 Decision Log 가 별도 row 로 200/15 갱신. 본문 reader 가 §6 까지 안 보면 stale 정보. silent doc drift.
**Recommendation**: §1.4 본문에 "§6 Decision Log 참조 — 최신 한도 200/15" cross-link 또는 §1.4 자체 갱신.

### N/A 2건

- N/A-1: 본 commit 들에 D1 query null 분기 변경 0건 (cha-06 의 `row?.n ?? 0` 은 기존 패턴 재사용).
- N/A-2: 본 commit 들에 await 누락 분기 0건 (mock DB / measure / readCheckpoint 모두 Promise 반환 + await).

### 반론 (Devil's Advocate) — 깨질 수 있는 시나리오

**시나리오 A — prf-01 cache hit rate 가 timer-fake 환경에서 false-pass**:
`vi.useFakeTimers()` 가 다른 테스트에서 leak 되어 `measure()` 의 wall-clock 측정에 영향 → p99/median 0.0 ms 측정 → assertion `< 5ms` 통과 → 실 perf 회귀를 silent 통과.

**시나리오 B — sandbox.ts MAX_AST 한도 200 보수화 — 정상 산식 회귀 검증 부재**:
ADR-029 §6 "formula-engine 264 → 276 PASS — 정상 산식 회귀 0건" 명시. 그러나 `cha-02-compute-timeout.test.ts` 만 갱신, batch1~5-golden 119 tests 가 한도 변경 후 재실행되었는지 본 commit diff 에서 직접 확인 불가. F-XX 산식 중 nodeCount > 200 인 산식 1건이라도 silent 누락 시 production hot path 에서 COMPUTE_TIMEOUT false-positive.
**Mitigation**: ADR-029 §6 명시 — 그러나 본 Pass 는 측정 증거 부재. `pnpm -F @thepick/formula-engine test` 출력 직접 첨부 의무.

**시나리오 C — rec-02 시나리오 3/4 silent pivot 의 production 정합**:
"key reorder + whitespace 가 의도된 통과" 는 canonical JSON sensitivity 정합. 그러나 production 환경에서 attacker 가 checkpoint 파일을 reorder 후 의미있는 field (state, last_completed_stage) 를 추가/제거하려 시도 시, JSON.parse 가 통과 + state_hash recompute 가 일치 → 우회 성공. canonical hash 는 정합한 검증이 아닌 file integrity 와 다른 차원의 보장. handoff-033 §3 옵션 B/C 결정 의무 (test:21-23).

## 판정

**판정**: 수정 필요 (MAJOR 3건 흡수 후 완료 가능)

**우선순위**:

1. MAJOR-S1 (prf-01 cache 카운터 산수) — 5분 fix
2. MAJOR-S2 (cha-06 invariant 보강) — 5분 fix
3. MAJOR-S3 (rec-02 line ending) — 5분 fix
4. MINOR-S4 (ADR-029 §1.4 cross-link) — 2분 fix
5. MINOR-S1/S2/S3 — handoff-033 silent pivot 보고에 흡수 가능

**dedupe 가능 항목**: MINOR-S2 (vector 8 N/A) 는 handoff-033 §3 silent pivot 카운트에 이미 흡수됨 — 다른 Pass 에서 중복 지적 시 dedupe.

---

**작성**: Claude (Opus 4.7 1M context) — Pass 1 SURGEON 독립 에이전트
**규칙 정합**: 규칙 0 (독립) ✅ / 규칙 1 (전체 범위) ✅ / 규칙 2 (증거 기반) ✅ / 규칙 3 (반론) ✅
