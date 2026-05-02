# ADR-029: Formula Engine Resource Limit (AST 사전 + Wall-Clock 사후 이중 방어)

- **상태:** Accepted (2026-05-02)
- **결정일:** 2026-05-02
- **결정자:** 진산 (사용자) — handoff-session-032 §3.1 옵션 C 채택
- **작성:** Claude (Opus 4.7 1M context) — Sprint 1 §5.4 Session 032 / retroactive on commit `ac5e4db`
- **관련 헌법:** v3.0 Vol IV.1 (Hard Limit — Formula Engine 동적 코드 실행 금지), Vol VIII.4 (DEFCON L3 — Formula Engine)
- **관련 ADR:** ADR-002 (Formula Engine — math.js AST), ADR-006 (Cloudflare Single Vendor — Workers 50ms CPU 한도)
- **관련 commit:** `ac5e4db` (CHA-02 — CalculationTimeoutError + COMPUTE_TIMEOUT)
- **관련 plan:** `docs/plans/engine-hardening/cha-02-formula-engine-resource-limit.plan.md` 부재 — 본 ADR 이 그 역할 대체 (handoff §3.1 옵션 C)
- **트리거:** Sprint 1 §5.3 4-Pass Pass 4 C-PROC-1 — `packages/formula-engine/` (CLAUDE.md L3 영역) 6 파일 변경에 plan 부재 적발

---

## 1. Context (맥락)

### 1.1 Master Plan §CHA-02 명세

`docs/ThePick Engine Quality Test Master Plan v1.0.md` §CHA-02 ("Worker CPU 50ms 초과 시뮬레이션") 합격 기준:

- (a) `CalculationTimeoutError` throw 확인
- (b) `error.code='COMPUTE_TIMEOUT'` engine 매핑
- (c) 메모리 누수 = 0 (100회 반복 후 heap delta < 5MB)

**합격 기준 (a) 의 함의**: Formula Engine 이 Workers CPU 50ms 한도 도달 전에 자체 차단해야 한다. Workers isolate kill 에 의존하면:

- Worker 전체가 죽음 (다른 요청 영향)
- error 분류 손실 (`COMPUTE_TIMEOUT` vs `CRASHED` 구분 불가)
- 메모리 누수 측정 불가 (process 자체 종료)

### 1.2 sync 코드 preempt 불가 — handoff-031 §2.A 명세 vs 실 구현

**handoff-031 §2.A 명세**: "CHA-02 setTimeout bail" — `setTimeout(() => bail(), 50)` 으로 평가 중단.

**실 구현 채택 (commit `ac5e4db`)**: "AST 사전 차단 + Wall-clock 사후 차단" 이중 방어.

**명세 → 실 구현 변경 사유**:

`mathjs.compile(node).evaluate()` 는 **sync** 함수. JavaScript event loop 는 sync 코드 실행 중 setTimeout / setImmediate / Promise 모두 발화 불가:

```typescript
// 다음은 setTimeout 이 절대 발화하지 않음 (sync 무한 루프)
let bailed = false;
setTimeout(() => { bailed = true; }, 50);
const result = compiled.evaluate(scope); // 100ms sync hang → setTimeout never fires
if (bailed) throw new CalculationTimeoutError(...); // unreachable
```

→ setTimeout bail 은 sync 평가 도중 interrupt 불가능 = **명세 자체가 기술적으로 비현실**.

**유일 가능 방안 (이중 방어)**:

1. **사전 차단 (AST 복잡도 / 깊이)**: `safeParse` 시점에 `assertWithinComplexityBudget(node)` 로 수치 한도 검증. 폭주 산식의 AST 자체가 검증 통과 못 하도록 차단.
2. **사후 차단 (실 elapsed)**: `safeEvaluate` 가 `compiled.evaluate()` 직후 elapsed 측정 — 정상 산식 < 1ms 이므로 50ms 초과 = 사전 차단 우회한 비정상 발화 신호.

→ 사전 차단 1차 방어 + 사후 차단 defense-in-depth. Workers isolate kill (50ms hard) 가 3차 방어.

### 1.3 Workers Isolate Kill 정합

본 결정은 Workers 50ms CPU 한도와 **3중 방어** 구조:

| 방어선 | 작동 시점       | 한도             | 차단 방식                        | 회복 가능성 |
| :----- | :-------------- | :--------------- | :------------------------------- | :---------- |
| 1차    | `safeParse`     | `MAX_AST_*`      | AST throw (uncaught)             | ✅ 즉시     |
| 2차    | `safeEvaluate`  | `MAX_EVAL_MS=50` | wall-clock throw                 | ✅ 즉시     |
| 3차    | Workers runtime | 50 ms CPU        | isolate kill (process 전체 종료) | ❌ 새 요청  |

**1/2 차 방어가 모두 우회**되어 3차 방어까지 도달하면, Workers isolate kill 은 다음 요청에 영향 없도록 격리. 그러나 본 commit 시점에는 1/2차 만으로 정상 산식 100% 통과 + 폭주 산식 100% 차단.

### 1.4 본 시점 명세된 한도 값 (정량)

`packages/formula-engine/src/sandbox.ts`:

```typescript
export const MAX_AST_NODE_COUNT = 500; // 정상 F-01~F-68 모두 ≤ 50
export const MAX_AST_DEPTH = 30; // 정상 모두 ≤ 10
export const MAX_EVAL_MS = 50; // Workers CPU 한도
```

**정량 근거**:

- 정상 F-01~F-68 산식 측정값: nodeCount ≤ 50, depth ≤ 10
- 한도 = 측정값 × 10 (보수 여유)
- 단, **Sprint 1 §5.3 4-Pass Pass 3 MAJOR-10 적발**: "10× 여유 너무 관대" — §5.4 commit 동시 흡수에서 `MAX_AST_NODE_COUNT` 100~200 으로 강화 검토 의무 (실 산식 회귀 측정 후).

---

## 2. Decision (결정)

**Formula Engine 의 자원 한도 정책을 다음과 같이 영속한다:**

### 2.1 사전 차단 (`safeParse` → `assertWithinComplexityBudget`)

- `MAX_AST_NODE_COUNT = 500`: 산식 AST 노드 총수 한도. 초과 시 `CalculationTimeoutError(kind='ast_too_complex')`.
- `MAX_AST_DEPTH = 30`: 산식 AST 깊이 한도. 초과 시 `CalculationTimeoutError(kind='ast_too_deep')`.
- 검증은 `safeParse` 진입 시 1회. `parseFormula` cache hit 시에도 한도 변경 시점 (§5.4 흡수) 재실행 의무 — Sprint 1 §5.3 CRITICAL C-CODE-1 흡수 정합.

### 2.2 사후 차단 (`safeEvaluate` → wall-clock elapsed)

- `MAX_EVAL_MS = 50`: `compiled.evaluate()` 직후 `Date.now()` (또는 `performance.now()`) elapsed 측정. 초과 시 `CalculationTimeoutError(kind='eval_timeout')`.
- 정상 산식 < 1 ms 이므로 50 ms 초과 = AST 한도 우회한 비정상 산식 신호 (예: `pow(2, 10000)` — 단일 노드, count=2, depth=2 이지만 evaluate 사실상 hang).

### 2.3 Engine 매핑 (`engine.calculate()`)

- `parseFormula` + `safeEvaluate` 양쪽 try/catch.
- `CalculationTimeoutError` 감지 시 `FormulaError` 로 매핑:
  - `code = 'COMPUTE_TIMEOUT'` (FormulaErrorCode 신규)
  - `details = { kind, nodeCount?, depth?, elapsedMs? }` 전파.
- user-facing message 와 details 분리 — Sprint 1 §5.3 4-Pass Pass 3 MAJOR-11 흡수 의무 (§5.4 commit).

### 2.4 한도 변경 절차

`MAX_AST_NODE_COUNT` / `MAX_AST_DEPTH` / `MAX_EVAL_MS` 수치 변경 시:

1. 본 ADR 의 "Decision Log" 갱신 의무.
2. `parseFormula` cache invalidation 검증 — 변경 시점 캐시 모두 재검증.
3. `cha-02-compute-timeout.test.ts` 한도 회귀 추가 (한도 - 1 통과 / 한도 + 1 차단).
4. dev-guide.md L3 변경 = ADR + 진산님 승인 의무.

---

## 3. 선택지 비교

| 옵션                                           | 비용 | sync 코드 차단 | 회복성  | 정합 | 결과 |
| :--------------------------------------------- | :--- | :------------- | :------ | :--: | :--- |
| **A: setTimeout bail (handoff-031 §2.A 명세)** | 0d   | ❌ 불가능      | ✅      |  ❌  | 기각 |
| **B: AST 사전 + wall-clock 사후 이중 방어**    | 1d   | ✅ 사전 차단   | ✅      |  ✅  | 채택 |
| C: Workers isolate kill 만 의존 (사전 차단 0)  | 0d   | 🟡 isolate     | ❌ kill |  ❌  | 기각 |
| D: Async / Promise.race + AbortController      | 2d   | ❌ sync 미동작 | 🟡      |  ❌  | 기각 |

**옵션 A 기각 사유**: §1.2 — sync 코드 preempt 불가 = 명세 자체 비현실.

**옵션 C 기각 사유**: §1.3 — isolate kill 은 process 전체 종료. error 분류 손실 + 다른 요청 영향 + 메모리 측정 불가.

**옵션 D 기각 사유**: math.js `compiled.evaluate()` 가 sync — Promise.race 로 wrapping 해도 sync 평가 자체는 abort 불가. AbortController 도 sync interrupt 불가. async 변환 시 mathjs 내부 fork 필요 (수일 + 회귀 위험).

**옵션 B 채택 사유**:

1. sync 평가에서 유일 가능 방안 (사전 + 사후).
2. 정상 산식 100% 통과 (F-01~F-68 nodeCount ≤ 50 / elapsed < 1ms — 한도 ÷ 10 여유).
3. 폭주 산식 100% 차단 (`pow(2, 10000)` 같은 단일 노드 폭탄도 사후 elapsed 로 검출).
4. error 분류 보존 (`ast_too_complex` / `ast_too_deep` / `eval_timeout` 3종).
5. Workers isolate kill 이 3차 방어 — 1/2차 우회 시 fallback.

---

## 4. Consequences (결과)

### 4.1 긍정 결과

- **CHA-02 합격 기준 (a)/(b)/(c) 100% 달성**: 10 tests PASS (사전 차단 / 사후 차단 / engine 매핑 / 회귀 / 100회 메모리).
- **Workers CPU 50ms 한도 자체 차단**: 본 시점 모든 정상 산식이 Workers isolate kill 발화 전에 자체 종료. isolate kill 발화 = 본 결정 우회 = 즉시 incident.
- **error 분류 보존**: 운영 시 `COMPUTE_TIMEOUT` 1건당 `kind` 로 정확한 원인 추적 (admin-web 모니터링).
- **메모리 누수 측정 가능**: heap delta 측정 정상 (3차 방어 시 process 종료 = 측정 불가).

### 4.2 부정 결과

- **한도 값 보수성 트레이드오프 부담** — Sprint 1 §5.3 Pass 3 MAJOR-10 적발: 10× 여유는 폭주 vector 의 fail-open 가능성. §5.4 commit 동시 흡수에서 `MAX_AST_NODE_COUNT` 100~200 으로 보수화 검토 (실 산식 회귀 측정 후).
- **`parseFormula` cache invalidation 의무** — Sprint 1 §5.3 CRITICAL C-CODE-1 (cache hit 시 한도 변경 우회) 흡수 정합. 본 commit `c8ca91d` 흡수 완료, 그러나 향후 한도 변경 시 cache invalidation 절차 재확인 의무.
- **i18n 부재** — Sprint 1 §5.3 Pass 3 MAJOR (CHA #8) 적발: `sandbox.ts` 영문 message 가 `engine.ts` 한국어 prefix 와 혼합. Phase 1 후반 i18n 일괄 도입 의무.

### 4.3 회귀 추적

| 회귀 vector                           | 검출 위치                           | 회귀 게이트                        |
| :------------------------------------ | :---------------------------------- | :--------------------------------- |
| `MAX_AST_*` 한도 변경 cache stale     | `cha-02-compute-timeout.test.ts`    | 한도 -1 통과 / 한도 +1 차단 의무   |
| `compiled.evaluate()` async 변환 시도 | typecheck — `safeEvaluate` 시그니처 | sync 시그니처 유지 (return value)  |
| `MAX_EVAL_MS` 측정 fakeTimer 우회     | `cha-02-compute-timeout.test.ts`    | `vi.useFakeTimers` 컨텍스트 회귀 1 |
| `details` 의 user-facing message leak | `engine.ts` user-facing message     | §5.4 commit MAJOR-11 흡수 의무     |

---

## 5. Compliance — Hard Rule + L3 영역 정합

### 5.1 Hard Rule 정합

- **Hard Rule 2 (LLM 산식 계산 금지)**: 본 결정은 산식 차단 정책. Hard Rule 2 위반 0건 (LLM 호출 없음).
- **Hard Rule 4 (동적 코드 실행 금지)**: `safeParse` AST 검증이 동적 코드 노드 차단. 본 결정의 `assertWithinComplexityBudget` 가 동일 검증 흐름 재사용.

### 5.2 L3 영역 변경 절차 (dev-guide.md)

`packages/formula-engine/` 변경 = L3 영역. dev-guide.md "L3 영역 변경 시 plan + 승인 완료" 의무. 본 ADR 이 plan 역할 대체 (handoff-session-032 §3.1 옵션 C — "ADR-029 작성" 진산님 권고 + 본 결정).

**향후 L3 변경 절차 강화**:

1. plan 작성 또는 ADR 작성 (양자택일 — 재사용성 큰 변경 = ADR 권장).
2. 진산님 승인.
3. 코드 변경 + 회귀 게이트 통과.
4. 4-Pass 독립 에이전트 리뷰 (auto-review-protocol).

---

## 6. Decision Log

| 일자       | 결정                                                                                                                 | 근거                                                                                                                                                                                                                                                                                              |
| :--------- | :------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-02 | 초기 채택 — `MAX_AST_NODE_COUNT=500` / `MAX_AST_DEPTH=30` / `MAX_EVAL_MS=50`                                         | commit `ac5e4db` + Master Plan §CHA-02 합격 기준                                                                                                                                                                                                                                                  |
| 2026-05-02 | retroactive ADR 채택 (handoff-032 §3.1 옵션 C)                                                                       | 진산님 명시 결정 — L3 plan 부재 절차 흡수                                                                                                                                                                                                                                                         |
| 2026-05-02 | **한도 보수화** — `MAX_AST_NODE_COUNT`: 500 → 200 / `MAX_AST_DEPTH`: 30 → 15 (Sprint 1 §5.4 PRC-01 commit 동시 흡수) | Sprint 1 §5.3 4-Pass Pass 3 MAJOR-10 흡수. 정상 산식 nodeCount ≤ 50 / depth ≤ 10 → 한도/실측 비 = 4× / 1.5×. 좌결합 폭주 (`1+1+1+...` 100 그룹 = 400 nodes) 즉시 발화. `cha-02-compute-timeout.test.ts` 회귀 갱신 (expression 한도 검증 변경). formula-engine 264 → 276 PASS — 정상 산식 회귀 0건 |

---

## 7. References

- v3.0 Vol IV.1 — Hard Limit / Formula Engine 동적 코드 실행 금지
- v3.0 Vol VIII.4 — DEFCON L3 영역
- ADR-002 — Formula Engine 도입 결정
- Master Plan v1.0 §CHA-02 — Worker CPU 50ms 초과 시뮬레이션
- Sprint 1 §5.3 commit `ac5e4db` — CalculationTimeoutError + COMPUTE_TIMEOUT
- Sprint 1 §5.3 commit `c8ca91d` — 4-Pass CRITICAL/MAJOR 흡수 (cache hit 차단 등)
- handoff-session-032 §3.1 — L3 plan 옵션 C 결정

---

**ADR 작성**: Claude (Opus 4.7 1M context) — Session 032
**채택 효력**: 2026-05-02 ~retroactive on commit `ac5e4db`
**다음 갱신 트리거**: `MAX_AST_*` / `MAX_EVAL_MS` 수치 변경 / async 변환 검토 / Workers isolate kill fallback 의 phase 2 진입 시점
