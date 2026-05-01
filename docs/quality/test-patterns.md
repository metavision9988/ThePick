# Test Patterns — ThePick Engine

> Sprint 1 §5.2 도구 정비 (handoff-029 §2.A) 산출물.
> P0 시나리오 신규 구현 시 본 문서 패턴을 우선 사용. 새 패턴 발견 시 본 문서 갱신 의무.

---

## 1. 시간 의존 테스트 — `vi.useFakeTimers()` (CHA-04 / Q1 / FSRS)

**용도**: wall clock skew, 24h elapsed 검증, FSRS interval 진행, cron catch-up 시뮬레이션.

**의존성**: Vitest 내장 (신규 패키지 0건). `sinon` 미도입 — 동일 기능을 `vi.useFakeTimers()` 가 커버.

### 1.1 정합 패턴 (apps/batch/\_\_tests\_\_/recover.test.ts:230~270 정합)

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('CHA-04 — wall clock skew ±10분', () => {
  afterEach(() => {
    vi.useRealTimers(); // 의무 — 다음 테스트 누설 방지
  });

  it('skew +10min 시 elapsed 음수 처리 graceful', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T10:00:00Z'));

    const startedAt = '2026-05-02T10:10:00Z'; // 미래 (skew 발생)
    // ... recover.ts 의 elapsed = now - startedAt 처리 검증
    // Math.abs() 또는 floor(0) 처리 정합 의무
  });

  it('time advance 24h 후 catch-up 동작', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T00:00:00Z'));

    // ... cron / GC 트리거 시뮬레이션
    vi.advanceTimersByTime(24 * 60 * 60 * 1000); // 24h 진행
    // ... catch-up 단일 실행 검증 (다중 누적 실행 0건)
  });
});
```

### 1.2 안티패턴 (금지)

- `vi.useFakeTimers()` 호출 후 `vi.useRealTimers()` 누락 → 다음 테스트 시간 오염.
- `Date.now() = 1735776000000` 같이 직접 mock → Vitest 의 timer micro-task 큐와 동기화 안됨.
- `setTimeout` mock 만 + system time 미설정 → `new Date()` 가 실제 시각 반환 → 부분 mock 취약.

### 1.3 사용 시점

- ✅ 시간 의존 invariant 검증 (CHA-04 / Q1 / FSRS interval)
- ✅ Promise 체인의 setTimeout 진행 (debounce / throttle)
- ❌ **performance.now() 측정 — fake timers 에 영향 받지 않음** (PRF-\* 시나리오는 real timers 유지)

---

## 2. 외부 API mock — MSW (Anthropic / Vectorize) — **본 시점 이연 (Phase 2 진입 직전)**

**Sprint 1 §5.2 본 시점 결정 (2026-05-02 — Session 029)**:

handoff-029 §2.A 의 `apps/api/src/__tests__/helpers/msw-anthropic.ts` 신규 항목은 본 §5.2 에서 **이연**. 근거:

1. **CHA-03 P1 재분류** (decision-2026-05-02-cha-03-05-p1-reclassification.md) — anthropic-adapter NOT_IMPLEMENTED. Phase 2 진입 직전 본격 구현 시점에 MSW 도구 동시 도입이 정합.
2. **CHA-05 P1 재분류** — hybrid-search 가 Phase 1 후반 활성. Vectorize binding 미사용 시점에 MSW Vectorize 시뮬레이션 부재.
3. **FUZ-02 fixtures (claude-malformed/) 는 schema-validator 직접 입력** — `fs.readFile()` 로 fixtures 읽어 schema-validator 단위 테스트. HTTP layer 시뮬레이션 부재 — MSW 미경유.
4. **MSW 미설치 (pnpm-lock 미존재)** — Master Plan v1.0 §12 의 "✅ (이미 사용)" 기재는 부정확. 본 §5.2 시점 신규 dep 추가 = §5.3 작업 우선순위 이격.

**Phase 2 CHA-03 P1 진입 시점 의무**:

- `pnpm add -D msw -w` (workspace root) 또는 `apps/api` 한정 추가.
- `apps/api/src/__tests__/helpers/anthropic-msw.ts` 신규.
- anthropic-adapter retry / backoff 로직 본격 구현과 **동일 commit** 으로 도입.
- 본 문서 §2 갱신 (이 banner 제거 + 정합 패턴 본문 작성).

**현 시점 FUZ-02 / 단위 테스트 우회 패턴**:

```typescript
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

import { validateKnowledgeContract } from '../src/schema-validator.js';

it('FUZ-02 — XSS payload 거부', async () => {
  const raw = await readFile(
    resolve(__dirname, '../../__fixtures__/claude-malformed/03-xss-payload.json'),
    'utf-8',
  );
  expect(() => validateKnowledgeContract(raw)).toThrow(/XSS_PAYLOAD_DETECTED/);
});
```

**§5.2 산출물 정직 평가**:

handoff-029 §2.A 의 6개 도구 중 5개 본 §5.2 도입 + 1개 (MSW) 명시 이연. 본 결정으로 §5.3 NOT-IMPL 7건 신규 구현 (CHA-01/02/04 + FUZ-01/02 + REC) 작업 차단 0건.

---

## 3. 성능 측정 — `@thepick/shared/test-helpers/perf` (PRF-01/02/04)

**용도**: latency 분포 (median / p95 / p99) + cache hit rate + 직렬 처리량.

**구현체**: `packages/shared/src/test-helpers/perf.ts` (Sprint 1 §5.2 신규).

### 3.1 정합 패턴

```typescript
import { measure, CacheHitTracker } from '@thepick/shared/test-helpers/perf';

it('PRF-01 — formula evaluate p99 < 50ms', async () => {
  const result = await measure('formula-eval-51', () => engine.evaluate(formula, vars), {
    runs: 1000,
    warmup: 10,
  });

  expect(result.p99Ms).toBeLessThan(50);
  expect(result.medianMs).toBeLessThan(5);
});
```

### 3.2 사용 시점

- ✅ p99 / cache hit rate 회귀 방어 (Worker 50ms CPU 한도 정합)
- ✅ Tarjan vs iterative-DFS 비교 (PRF-02)
- ❌ functional 정확성 검증 (이건 별도 unit test)

---

## 4. 픽스처 디렉토리 (Sprint 1 §5.2 신규)

| 디렉토리                           | 용도                 | 시나리오 |
| :--------------------------------- | :------------------- | :------: |
| `tests/fixtures/pdf-malicious/`    | 악의적 PDF 5종       |  FUZ-01  |
| `tests/fixtures/claude-malformed/` | Claude 변조 응답 8종 |  FUZ-02  |

각 디렉토리의 `README.md` 가 fixture 별 의도 + 분류 + 검증 방법 명세.

---

## 5. Workers 환경 테스트 — `@cloudflare/vitest-pool-workers` (검토 중)

**용도**: D1 binding / Vectorize binding / Workers 런타임 정합 검증 (CHA-01 / CHA-05).

**현 결정**: ADR `docs/adr/ADR-028-workers-vitest-pool.md` 참조 (Sprint 1 §5.2 산출물).

본 시점 (Year 1 Phase 1) 에서는 **Hono mock + MSW 조합으로 충분** — Workers Pool 도입은 BATCH-1 진입 직전 재검토.

---

## 변경 이력

| 일자       | 패치      | 내용                                                                        |
| :--------- | :-------- | :-------------------------------------------------------------------------- |
| 2026-05-02 | v1.0 신규 | Sprint 1 §5.2 도구 정비 — fakeTimers / MSW / perf / fixtures / Workers Pool |
