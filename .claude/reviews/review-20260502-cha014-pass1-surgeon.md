# Pass 1 SURGEON — Sprint 1 §5.3 CHA-01/02/04 (3 commits)

- 일자: 2026-05-02
- 리뷰어 컨텍스트: 독립 (silent-failure-hunter agent persona, 코드 작성자 메인 컨텍스트와 별개)
- 자기 확인 편향 차단 목적 — auto-review-protocol §"규칙 0" 준수
- 대상 commits: e589ce7, ac5e4db, a319a81
- 리뷰 범위: 변경 파일 11개 + 연관 파일 4개 (ast-parser.ts, d1-from-sqlite.ts, recover.ts, checkpoint.ts)
- 검증 방식: 코드 정독 + 테스트 정합성 + 실제 의존성 트리 추적 + pnpm test 실행 (261 passed)

---

## 요약

**Pass 1 (Surgeon): ✅ 14건 확인 / 🔴 1건 / 🟠 4건 / 🟡 3건 / N/A 3건**

판정: **수정 필요 (CRITICAL 1건 + MAJOR 4건)**

CHA-01/02/04 모두 합격 기준 매핑은 정확하며 sandbox 사전/사후 차단 이중 방어 설계는 견고하다. 다만 다음 4영역에 코드 단독 터지는 경로가 잠복:

1. parseFormula 캐시가 CalculationTimeoutError 차단을 우회시키는 회귀 벡터 (CRITICAL)
2. d1-disconnect-mock 의 Proxy `get` 트랩이 `then` (Promise interop) / `Symbol.asyncIterator` / 비함수 속성에 안전하지 않음 (MAJOR)
3. 100회 INSERT 시뮬레이션이 단일 단조 PRNG 시퀀스에 의존 — 50% disconnect 케이스 결정성은 검증돼도 100 INSERT 케이스 재현성은 약함 (MAJOR)
4. `safeEvaluate` 의 wall-clock 검사가 timer 의존 — `vi.useFakeTimers` 활성 컨텍스트에서 사후 차단 우회 가능 (MAJOR)

---

## 🔴 CRITICAL 1 — parseFormula 캐시가 CalculationTimeoutError 차단을 우회

### 위치

- `packages/formula-engine/src/ast-parser.ts:40-66` (`parseFormula`)
- `packages/formula-engine/src/sandbox.ts:285-331` (`safeParse`)
- `packages/formula-engine/src/engine.ts:63-77` (catch CalculationTimeoutError)

### 코드 인용 (`ast-parser.ts:40-50`)

```typescript
export function parseFormula(equationTemplate: string): AstParseResult {
  const cached = cache.get(equationTemplate);
  if (cached) {
    return {
      ok: true,
      node: cached.node,
      compiled: cached.compiled,
      variables: cached.variables,
      cached: true,
    };
  }
  const result: ParseResult | ParseError = safeParse(equationTemplate);
  ...
}
```

### 문제

`parseFormula`는 캐시 히트 시 **`safeParse` 자체를 건너뛴다**. `safeParse` 내부에서 `assertWithinComplexityBudget(node)` 가 throw 하는 `CalculationTimeoutError`는 한번 통과하면 **두 번째 호출부터 영원히 우회**된다.

직접적 회귀 시나리오:

1. 공격 페이로드 P (복잡도 400 노드, MAX_AST_NODE_COUNT=500 미만) 가 캐시에 적재됨 (정상 산식)
2. MAX_AST_NODE_COUNT 가 향후 300으로 강화되는 코드 변경 발생
3. P 가 캐시에 남아 있는 한 `parseFormula(P)` 는 cached={node, compiled, variables} 그대로 반환 — 신규 한도 검증 0회

또 다른 파괴 벡터 (현재 코드만으로도 발화 가능):

1. registry 의 정상 산식 F-XX 가 어느 시점 한도 초과로 변경됨 (예: 향후 산식 추가 — F-69)
2. 다른 테스트가 먼저 `parseFormula('정상')` 으로 캐시 워밍 후
3. 누가 `assertWithinComplexityBudget` 안에 새 검증 (예: 변수 개수 한도) 추가
4. 캐시된 산식은 새 검증을 영원히 거치지 않음 → silent regression

### 검증

`ast-parser.test.ts` 의 `clearCache` export 는 테스트 격리만 — production 흐름에서는 캐시 invalidation API 0건. 200개 슬롯이 차면 전체 clear 만 (LRU 아님), 한 항목 강제 invalidation 불가.

### 깨질 시나리오 (구체적 입력)

```typescript
// Test order matters — failing flow:
// 1) parseFormula('1+1+1+...300회') — 한도 초과로 throw 의도
// 2) MAX_AST_NODE_COUNT 가 200 으로 낮춰진 코드 변경
// 3) 이전 캐시 항목 (현재 한도 기준 통과) 은 신규 한도 검증 받지 않음
// 4) cha-02-compute-timeout.test.ts 는 매 호출 새 expression 으로 PASS
//    하지만 production 에서는 동일 산식 반복 호출이 상시 — 캐시 우회 100%
```

### 수정 권고

옵션 A (즉시 수정 — 권장): cache 적재 직전 노드 수/깊이를 저장하고 매 cache hit 시 현재 한도와 재비교.

옵션 B: cache key 에 `MAX_AST_NODE_COUNT|MAX_AST_DEPTH` 결합 — 한도 변경 시 자동 invalidate.

옵션 C: `parseFormula` 가 항상 `assertWithinComplexityBudget` 호출 (캐시는 compiled 만 보존). 비용은 traverse 1회 추가.

### 예시 코드 (옵션 C — 가장 견고)

```typescript
import { assertWithinComplexityBudget } from './sandbox';
// (export 추가 필요)

export function parseFormula(equationTemplate: string): AstParseResult {
  const cached = cache.get(equationTemplate);
  if (cached) {
    // CHA-02 회귀 방어 — 한도 변경 시 캐시된 산식도 재검증
    try {
      assertWithinComplexityBudget(cached.node);
    } catch (e) {
      if (e instanceof CalculationTimeoutError) {
        cache.delete(equationTemplate);
        throw e;
      }
      throw e;
    }
    return { ok: true, node: cached.node, compiled: cached.compiled,
             variables: cached.variables, cached: true };
  }
  ...
}
```

---

## 🟠 MAJOR 1 — Proxy `get` 트랩이 Promise interop / Symbol 키 미처리

### 위치

`apps/api/src/__tests__/helpers/d1-disconnect-mock.ts:77-103` (`withDisconnect`)
`apps/api/src/__tests__/helpers/d1-disconnect-mock.ts:106-127` (`wrapStatement`)

### 코드 인용

```typescript
return new Proxy(d1, {
  get(target, prop, receiver) {
    const orig = Reflect.get(target, prop, receiver);
    if (typeof orig !== 'function') return orig;

    if (prop === 'prepare') { ... }
    if (prop === 'withSession') { ... }

    // exec / batch / dump — DB 접촉 메서드, fail 주입.
    return async (...args: unknown[]) => {
      return injectFailureOrCall(prop.toString(), config, () =>
        (orig as (...a: unknown[]) => unknown).apply(target, args),
      );
    };
  },
});
```

### 문제

Proxy 의 `get` 트랩이 **모든 함수형 속성을 fail 주입 대상으로** 처리한다. 다음 케이스가 의도치 않게 fail 주입 대상이 됨:

1. **`then` 메서드**: 누군가 `await flakyDb` 를 호출하면 JS 엔진이 thenable 인지 판정하기 위해 `db['then']` 을 조회. 본 Proxy 는 `prepare/withSession` 외 모든 함수를 비동기 fail 주입 wrapper 로 반환 → `flakyDb` 가 thenable 처럼 보여 `await` 흐름 비정상 동작.

2. **`Symbol.asyncIterator` / `Symbol.iterator`**: D1Database 자체는 미정의지만 미래 추가 시 즉시 깨짐. `prop.toString()` 도 Symbol 에서는 `Symbol(...)` 로 변환되어 디버깅 신호 손실.

3. **`constructor`**: typeof 'function' true → fail 주입 대상이 됨. `flakyDb.constructor` 호출 시점에 disconnect throw 가능.

4. **속성 enumeration / introspection**: `Object.getOwnPropertyNames(flakyDb)` 또는 `for...in` 사용 시 함수 속성마다 wrap 된 Promise 함수 반환 — 호출 측은 native 메서드를 기대하지만 Proxy 가 변형된 wrapper 반환.

**현재 cha-01-d1-disconnect.test.ts 는 await 단일 호출만 — 위 케이스 전부 미커버.**

### 깨질 시나리오

```typescript
// 시나리오 1 — 누군가 Promise.resolve(flakyDb) 작성
const wrapper = await Promise.resolve(flakyDb);
// JS 엔진: wrapper.then 조회 → fail 주입 wrapper 반환
// → 의도치 않게 SimulatedD1DisconnectError throw (Promise resolution 깨짐)

// 시나리오 2 — D1Database 가 미래에 [Symbol.asyncIterator] 도입
for await (const row of flakyDb) { ... }
// → fail 주입 wrapper 가 Symbol 키에 대해서도 발화

// 시나리오 3 — 디버깅 출력
console.log(flakyDb.toString());
// → 'toString' 도 함수, fail 주입 대상
```

### 수정 권고

`get` 트랩 시작에 **알려진 D1 데이터 메서드만 화이트리스트**로 fail 주입 대상 한정.

```typescript
const D1_DB_FAILURE_METHODS = new Set(['exec', 'batch', 'dump']);
const D1_STMT_FAILURE_METHODS = new Set(['first', 'run', 'all', 'raw']);

get(target, prop, receiver) {
  const orig = Reflect.get(target, prop, receiver);
  if (typeof orig !== 'function') return orig;
  if (typeof prop === 'symbol') return orig.bind(target); // Symbol 키 통과
  if (prop === 'prepare') { ... }
  if (prop === 'withSession') { ... }
  if (!D1_DB_FAILURE_METHODS.has(prop)) {
    // then/constructor/toString 등 — bind 만 하고 통과
    return orig.bind(target);
  }
  return async (...args: unknown[]) => { ... };
}
```

---

## 🟠 MAJOR 2 — 100회 INSERT 시뮬레이션의 PRNG 결정성 약점

### 위치

`apps/api/src/__tests__/scenarios/cha-01-d1-disconnect.test.ts:144-200`

### 코드 인용

```typescript
const flaky = withDisconnect(ctx.db, {
  disconnectRate: TARGET_DISCONNECT_RATE,
  errorClass: 'D1_DISCONNECT',
  prng: mulberry32(SEED),
});

for (let i = 0; i < ITERATIONS; i++) {
  ...
  const result = await withRetry(() =>
    flaky.prepare('INSERT INTO cha01_simulated (value) VALUES (?)').bind(`row-${i}`).run(),
  );
  ...
}
```

### 문제

테스트가 (a) 100 INSERT 모두 최종 PASS / (d) row count = 100 을 단언하는데, 이는 **`mulberry32(42)` 의 첫 ~140 호출 중 연속 3개 < 0.1 인 케이스가 0건이라는 가정**에 의존. 검증 없는 행운.

`withRetry` 가 disconnect 1회 발생당 PRNG 1번 더 추가 소비하므로 시퀀스 길이가 동적. 500ms 백오프 도입 / `withRetry` 내부 attempt 한도 변경 / `mulberry32` 시퀀스의 마지막 영역에 연속 disconnect 클러스터 출현 시 `successCount === 100` 불성립.

`Section 1` 의 PRNG 검증 (100회 < 0.1 비율 5~15건) 은 단일 시퀀스 통계만 — 실제 시퀀스 안에서 **연속 3회 < 0.1** (= 1회 호출 내 retry 소진) 이 어디 출현하는지 미검증.

### 깨질 시나리오

```typescript
// withRetry 의 BACKOFF_MULTIPLIER 가 향후 변경 (예: 4 → 5)
// → backoff 누적 시간 변동
// → 테스트 자체는 PRNG 만 영향이지만, BATCH 흐름에서는 attempts 가 retry 결정에 영향 없음
// 하지만 mulberry32 시퀀스의 후반에 disconnect 클러스터 등장 시
// successCount = 99 (1회 소진) 가능 — exhaustedCount = 1 → assertion 실패

// 또는 ITERATIONS = 100 → 200 으로 변경 시 시퀀스가 mulberry32(42) 의
// "충분히 무작위" 가정 위배 영역 진입 가능 — 회귀 추적 신호 부재
```

### 수정 권고

옵션 A: PRNG 시퀀스의 "연속 fail 클러스터" 정적 검증 추가 — 100회 시퀀스 안에 RETRY_BUDGET=3 회 연속 fail 0건임을 별도 단언.

옵션 B: 한 단계 더 보수적인 "성공률 ≥ 99%" 단언으로 변경 (1건 소진은 허용).

옵션 C: 각 INSERT 마다 새 `mulberry32(SEED + i)` — 호출 간 독립성 보장.

### 권장 코드 (옵션 A)

```typescript
it('PRNG 시퀀스 결정성 — 100 호출 시퀀스에 retry 소진 0건', () => {
  const prng = mulberry32(SEED);
  // mulberry32 단일 시퀀스 + withRetry 모델 시뮬레이션
  // (실 disconnect 시 retry 발생 → 추가 prng 소비)
  let exhausted = 0;
  let i = 0;
  while (i < ITERATIONS) {
    let attempts = 0;
    while (attempts < RETRY_BUDGET_ATTEMPTS) {
      attempts++;
      if (prng() >= TARGET_DISCONNECT_RATE) break;
    }
    if (attempts === RETRY_BUDGET_ATTEMPTS && prng() < TARGET_DISCONNECT_RATE) exhausted++;
    i++;
  }
  expect(exhausted, 'seed=42 시퀀스의 retry 소진').toBe(0);
});
```

---

## 🟠 MAJOR 3 — `safeEvaluate` wall-clock 차단이 fake timer 컨텍스트에서 우회 가능

### 위치

`packages/formula-engine/src/sandbox.ts:344-380` (`safeEvaluate`)

### 코드 인용

```typescript
const startMs = Date.now();
const result = compiled.evaluate(safeScope);
const elapsedMs = Date.now() - startMs;

if (elapsedMs > MAX_EVAL_MS) {
  throw new CalculationTimeoutError(
    'eval_timeout',
    `Evaluation timeout: ${elapsedMs}ms (limit ${MAX_EVAL_MS}ms)`,
    { elapsedMs, limitMs: MAX_EVAL_MS },
  );
}
```

### 문제

`Date.now()` 는 `vi.useFakeTimers()` 가 활성화된 테스트에서 mock 되며, `vi.advanceTimersByTime` 호출 없이 sync 코드가 진행되면 elapsed 가 항상 0. CHA-04 테스트가 `vi.useFakeTimers()` 를 활성화한 상태에서 동일 vitest 프로세스가 formula engine 호출 시 — **테스트 격리가 깨지면** 사후 차단 0회.

CHA-04 의 `afterEach(() => vi.useRealTimers())` 가 격리를 보장하지만, 본 가드는 **테스트 간**만 보장. 하나의 테스트 안에서 fake timer 활성 상태로 formula 호출하는 시나리오 (예: BATCH 파이프라인 통합 테스트가 fake timer + formula 같이 사용) 시 사후 차단이 silent 통과.

또한 production Workers 환경에서도 `Date.now()` 는 시계 동기화 jitter 영향 — 50ms 직전 elapsed 가 49ms 로 측정되면 통과 후 실제 51ms 소요 가능.

### 검증

cha-02 테스트 자체는 fake timer 미사용 (Section 2 `useFakeTimers` 호출 없음) — 본 시점 회귀 0. 다만 **사후 차단을 시간 기반으로 한 설계 자체의 본질적 약점**.

### 깨질 시나리오

```typescript
// 미래 통합 테스트 (가상)
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('산식 계산을 포함한 BATCH 시나리오', () => {
  vi.setSystemTime(new Date('2026-05-02'));
  // formula engine 호출 — Date.now() 가 frozen → elapsed 항상 0
  // 무한 루프 evaluate (가상) 도 사후 차단 미발화
  calculate('F-XX', { ... });
});
```

### 수정 권고

옵션 A: `performance.now()` 사용 (Workers / Node 양쪽 지원, fake timer 영향 없음).

옵션 B: 시간 측정 callback 을 옵션으로 주입 (테스트 격리 + Workers env.now binding).

### 권장 코드 (옵션 A)

```typescript
// performance.now() 가 Workers / Node 양쪽 stable + fake timer 영향 없음
const startMs = performance.now();
const result = compiled.evaluate(safeScope);
const elapsedMs = performance.now() - startMs;
```

---

## 🟠 MAJOR 4 — `computeAstDepth` 무한 재귀 위험 미차단

### 위치

`packages/formula-engine/src/sandbox.ts:254-261` (`computeAstDepth`)

### 코드 인용

```typescript
function computeAstDepth(node: MathNode): number {
  let maxChildDepth = 0;
  node.forEach((child: MathNode) => {
    const childDepth = computeAstDepth(child);
    if (childDepth > maxChildDepth) maxChildDepth = childDepth;
  });
  return maxChildDepth + 1;
}
```

### 문제

`computeAstDepth` 는 순수 재귀 — JavaScript 엔진의 stack 한도까지 도달 가능. mathjs 가 정상 parse 한 AST 는 acyclic 보장이지만, 본 코드는 **stack overflow 방지 없음**.

추가로 `assertWithinComplexityBudget` 의 순서 문제: nodeCount 검사 후 depth 검사 — nodeCount 가 한도 안이지만 깊이가 V8 stack 한도(~10,000) 를 초과하는 AST 는 nodeCount 통과 후 depth 계산 중 RangeError throw. `safeParse` 의 try/catch 는 `UnsafeExpressionError` 만 처리 (`sandbox.ts:308-314`) — `RangeError: Maximum call stack` 은 **bare throw** 로 전파되어 호출 측 (engine.ts) 의 `if (e instanceof CalculationTimeoutError)` 분기를 빠져나가 throw 그대로 propagate.

cha-02 테스트의 `MAX_EXPRESSION_LENGTH=1024` 한도가 **현재** 안전하지만, 한도 변경 시 즉시 회귀.

### 깨질 시나리오

```typescript
// MAX_EXPRESSION_LENGTH 가 향후 65536 으로 증가 시
const expression = '('.repeat(20000) + '1' + ')'.repeat(20000);
// length 40001 — 신규 한도 통과
// nodeCount 도 ParenthesisNode 20000 + ConstantNode 1 = 20001 → 한도 (예: 50000) 통과 시
// computeAstDepth 가 20001 깊이 재귀 → V8 stack overflow → RangeError throw
// engine.ts 의 catch 가 CalculationTimeoutError 가 아니라 throw 로 전파
// → API 응답 500 (stack trace 노출 위험)
```

### 수정 권고

옵션 A: `computeAstDepth` 를 iterative (스택/큐) 로 재작성.

옵션 B: depth 를 nodeCount traverse 와 함께 단일 패스로 계산 (mathjs 의 `traverse` callback 에 depth 전달 X — 별도 추적 필요).

옵션 C: 재귀 깊이 자체가 MAX_AST_DEPTH 를 초과하면 즉시 throw (재귀 깊이가 depth 와 1:1).

### 권장 코드 (옵션 C)

```typescript
function computeAstDepth(node: MathNode, currentDepth: number = 1): number {
  if (currentDepth > MAX_AST_DEPTH * 2) {
    // defense-in-depth — 한도 2배 초과 시 즉시 throw
    throw new CalculationTimeoutError(
      'ast_too_deep',
      `Expression depth recursion exceeded ${currentDepth}`,
      { depth: currentDepth, limit: MAX_AST_DEPTH },
    );
  }
  let maxChildDepth = 0;
  node.forEach((child: MathNode) => {
    const childDepth = computeAstDepth(child, currentDepth + 1);
    if (childDepth > maxChildDepth) maxChildDepth = childDepth;
  });
  return maxChildDepth + 1;
}
```

---

## 🟡 MINOR 1 — `injectFailureOrCall` start 측정이 fail 주입 분기에 무의미

### 위치

`apps/api/src/__tests__/helpers/d1-disconnect-mock.ts:129-145`

### 코드

```typescript
async function injectFailureOrCall<T>(...): Promise<T> {
  const start = Date.now();
  const roll = config.prng();
  if (roll < config.disconnectRate) {
    const durationMs = Date.now() - start;  // 거의 항상 0 — PRNG roll 만 발생
    config.onCall?.({ method, failed: true, durationMs });
    throw new SimulatedD1DisconnectError(...);
  }
  ...
}
```

### 문제

fail 분기의 `durationMs` 가 항상 ~0ms — onCall callback 사용자가 실패 호출의 latency 분포를 신호로 활용할 여지가 없음. 합격 기준 (b) p95 latency 측정은 `cha-01-d1-disconnect.test.ts:174` 의 외부 `latencies.push(Date.now() - startCall)` 로 충당되므로 본 onCall 정보는 dead. 영향 미미하지만 misleading.

### 권고

fail 분기의 durationMs 를 의도적으로 disconnect simulation 의 가상 latency (예: D1 timeout 5초) 로 추가하거나, onCall signature 에서 fail 분기는 durationMs 제거.

---

## 🟡 MINOR 2 — `mulberry32` state seed=0 시 첫 호출이 비대칭

### 위치

`apps/api/src/__tests__/helpers/d1-disconnect-mock.ts:28-37`

### 코드

```typescript
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    ...
  };
}
```

### 문제

`seed=0` 호출 시 첫 state = `0x6d2b79f5` 로 점프 — 통상 mulberry32 구현이 `seed |= 0` 후 그대로 첫 회로 진입하는 변형 대비 첫 출력 분포 약간 변형. 본 코드만의 결정성은 유지되지만 다른 mulberry32 구현 산출물과 비교 불가능.

### 권고

JSDoc 에 "본 구현은 seed offset 후 첫 next 시 0x6d2b79f5 보강 — 일반 mulberry32 변형과 시퀀스 다름" 명시. seed=42 사용은 영향 없음 (테스트가 PRNG 결정성 자체만 검증).

---

## 🟡 MINOR 3 — `cha-02-compute-timeout.test.ts` heap delta 단언이 GC 환경에 결합

### 위치

`packages/formula-engine/src/__tests__/cha-02-compute-timeout.test.ts:167-189`

### 문제

`process.memoryUsage().heapUsed` 는 V8 GC 주기에 따라 측정 시점 차이 ±수 MB. 100회 반복 후 heap delta 5MB 한도가 **테스트가 환경 GC 주기에 의존** — vitest 가 다른 테스트와 동시 실행 시 (현재 sequential 추정) heap 압박 케이스에서 false positive 가능.

또한 `--expose-gc` 미사용으로 명시적 `global.gc()` 호출 불가 — 측정 신뢰도가 GC 의 자율 실행 타이밍에 좌우. 실제 누수 검증 도구로는 부족.

### 권고

옵션 A: vitest --expose-gc 옵션 추가 + before/after measurement 사이에 `global.gc()` 강제.

옵션 B: heap delta 보다 cache 객체 수 (Map.size, Set.size) 기반 검증 — deterministic.

---

## ✅ PASS — 실제 확인한 항목 (증거 기반)

### CHA-01 / d1-disconnect-mock.ts

1. **`prepare/bind` local op 통과 검증** — `cha-01-d1-disconnect.test.ts:101-115` Section 2 의 "prepare/bind 는 fail 주입 X" 단언이 `disconnectRate=1.0` 에서도 statement 객체 반환 확인. Proxy `get` 트랩의 `prepare === prop` 분기가 `wrapStatement` 위임 정합.

2. **errorClass 별 message 포맷** — `cha-01-d1-disconnect.test.ts:117-138` Section 2 의 D1_DISCONNECT/D1_UNAVAILABLE/D1_TIMEOUT 3종 errorClass 모두 `RETRYABLE_MESSAGE_PATTERNS` (retry.ts:45-53) 매칭 검증. `retry.test.ts:67-74` 가 신규 D1_DISCONNECT/D1_UNAVAILABLE 2건 isRetryable=true 별도 단언.

3. **회복 시나리오 — storm 후 정상 복귀** — `cha-01-d1-disconnect.test.ts:240-263` Section 4 의 storm (rate 1.0, 5회) 후 underlying `ctx.db` 정상 동작 확인. Proxy 가 underlying D1 state 누설 없음 검증.

4. **mulberry32 PRNG 결정성** — `cha-01-d1-disconnect.test.ts:52-71` Section 1 의 동일 seed → 동일 시퀀스 + 100회 < 0.1 비율 5~15 단언으로 "seed=42" 시퀀스 회귀 신호.

### CHA-02 / sandbox.ts + engine.ts

5. **CalculationTimeoutError details 불변** — `errors.ts:25` `Object.freeze({ ...details })` 로 details 객체 외부 수정 차단. 호출 측에서 details.nodeCount 등 직접 변형 불가능.

6. **engine.ts 양 try/catch 매핑** — `engine.ts:67-77` (parseFormula) + `engine.ts:88-95` (safeEvaluate) 양쪽 모두 `instanceof CalculationTimeoutError` 분기 + `definition.pageRef` 컨텍스트 + `kind` / details 보존. 사용자 메시지 형식 정합.

7. **정상 산식 회귀 0** — `cha-02-compute-timeout.test.ts:155-160` 의 `calculate('F-01', ...)` PASS 검증으로 신규 한도 도입에도 기존 산식 영향 없음 확인. `pnpm test` 실행 261 tests 전부 PASS.

8. **types.ts COMPUTE_TIMEOUT 등록** — `types.ts:74-76` FormulaErrorCode union 에 신규 코드 추가, JSDoc 에 사전/사후 차단 주석. error code 화이트리스트 정합.

9. **AST 한도 정합** — `sandbox.ts:251-252` MAX_AST_NODE_COUNT=500 / MAX_AST_DEPTH=30 — JSDoc (`sandbox.ts:243-249`) 에 정상 산식 (F-01~F-68) 모두 ≤ 50 노드 / ≤ 10 깊이 + 10× / 3× 여유 명시. 회귀 추적 명시적.

### CHA-04 / cha-04-clock-skew.test.ts

10. **vi.useRealTimers 격리** — `cha-04-clock-skew.test.ts:99` `afterEach` 의 `vi.useRealTimers()` 가 다음 테스트 누설 차단 (test-patterns.md §1.1 정합).

11. **Math.max(0, elapsed) 가드** — `recover.ts:186` `const elapsedMs = Math.max(0, Date.now() - new Date(row.started_at).getTime())` 가 미래 started_at (skew +10분) 시 elapsed 음수를 0으로 보정. cha-04 Section 1 (`it 'Date.now() < started_at 시 elapsed=0 → concurrent_run 블록 유지'`) 가 회귀 방어.

12. **STALE_LOCK_THRESHOLD_MS 임계 검증** — `recover.ts:187` `if (elapsedMs < staleThreshold)` 가 24h 임계 통과 시 concurrent_run 블록 해제. cha-04 Section 2 의 `vi.advanceTimersByTime(STALE_LOCK_THRESHOLD_MS + 1000)` 후 fully_recovered 단언 정합.

13. **staleLockThresholdMs 옵션 주입** — `recover.ts:160` `opts.staleLockThresholdMs ?? STALE_LOCK_THRESHOLD_MS` 가 테스트 격리용 동적 한도 지원. cha-04 Section 2 두 번째 it 가 30분 한도 주입 후 1시간 경과 → fully_recovered 검증.

14. **checkpoint timestamp 비검증 정책** — `cha-04-clock-skew.test.ts:241-287` Section 3 가 timestamp +1h 미래 케이스에서 `fully_recovered` 단언. checkpoint.ts (190-191 SHA-256 검증만) timestamp 비교 없음 회귀 방어.

---

## N/A (해당 항목 부재)

1. **부동소수점 정밀도 (CHA 관련)** — CHA-01/02/04 는 산식 정밀도 검증 영역 아님 (network/timer/clock skew 영역). batch1-golden 등 기존 테스트가 별도 검증.

2. **Workers fs/path 사용** — CHA-01/02 는 mock helper (Node test 전용), CHA-04 는 apps/batch (Node only). Workers 런타임 영향 0.

3. **Vectorize / Constants 호출** — 본 3 commits 변경 파일 어디도 Vectorize/Constants 미참조.

---

## 반론 (Devil's Advocate — auto-review-protocol §"규칙 3")

### 시나리오 1 — CHA-01 "동시 다중 BATCH 시 PRNG 공유 누설"

`cha-01-d1-disconnect.test.ts` 가 매 it 마다 `mulberry32(SEED)` 새 인스턴스 생성하여 격리. 다만 production 흐름에서 `withDisconnect` 가 mock helper 임을 잊고 실제 BATCH 파이프라인에 prng 단일 인스턴스를 공유시키는 미래 코드가 있을 경우 — N개 BATCH 가 동일 시퀀스 소비하여 결정성 자체가 의미 상실. **본 helper 가 production 코드에 import 가능한 위치 (`apps/api/src/__tests__/`) 라 import 자체는 막혀 있지만**, helper 를 production 으로 옮기는 미래 변경에 안전망 0건.

### 시나리오 2 — CHA-02 "사용자 입력 산식 (등록 외) 처리"

본 시점 `engine.calculate()` 는 `getFormula(formulaId)` registry 만 처리 → 사용자 입력 산식 X. 다만 향후 사용자 정의 변형 산식 도입 시 (예: 학습 도구 — "이 산식의 변형 풀어보기") 동일 expression 이 사용자 디바이스마다 다양한 형태로 들어오면 cache 폭증 + MAX_CACHE_SIZE=200 도달 → `cache.clear()` 1회 호출. 이때 **공격자가 의도적으로 cache 침수** 후 한도 초과 산식 캐시 적재 → CRITICAL 1 회귀 벡터 활성화.

### 시나리오 3 — CHA-04 "vi.advanceTimersByTime 후 D1 mock 미반영"

cha-04 Section 2 의 `vi.advanceTimersByTime(24h+1s)` 가 `Date.now()` 만 진행 — `db.row.started_at` 은 string 유지. recover.ts:186 의 `new Date(row.started_at).getTime()` 가 정상 동작. 다만 D1 의 `started_at` 컬럼이 미래에 ms-since-epoch INTEGER 로 변경 시 mock 의 string 형식 그대로 두면 `new Date('1735689600000')` 가 NaN. **현재 가드 없음**.

### 시나리오 4 — "테스트 통과 = 안전" 가정 무력화

`pnpm test` 261 PASS 는 cha-01 이 단일 단조 PRNG 시퀀스에서 우연히 통과한 것 (MAJOR 2). seed 변경 / ITERATIONS 변경 시 즉시 실패 가능 — 회귀 추적 신호 부재. 또한 cha-02 의 캐시 우회 회귀 벡터 (CRITICAL 1) 는 **현재 테스트가 매 호출 새 expression** 사용해서 우회 — 동일 expression 반복 호출 production 시나리오 미커버.

---

## 판정

**수정 필요** — CRITICAL 1건 (parseFormula 캐시 우회) 즉시 패치 권고. MAJOR 4건은 후속 commit 으로 수렴 가능하나, MAJOR 1 (Proxy then 누설) 은 미래 await 패턴 도입 시 즉시 발화 가능하므로 우선순위 상.

다음 단계:

1. CRITICAL 1 즉시 흡수 (parseFormula cache hit 시 assertWithinComplexityBudget 재실행)
2. MAJOR 1 흡수 (D1_DB_FAILURE_METHODS 화이트리스트)
3. MAJOR 3 흡수 (Date.now → performance.now)
4. MAJOR 4 흡수 (computeAstDepth iterative or recursion guard)
5. MAJOR 2 보완 (PRNG 시퀀스 정적 검증 it 추가)
6. MINOR 3건 → handoff 이월 (Phase 종료 전 정리)

리뷰 완료 후 Pass 2~4 결과 종합하여 최종 "완료" 판정.
