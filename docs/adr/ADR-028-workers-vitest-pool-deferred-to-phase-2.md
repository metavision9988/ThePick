# ADR-028: Workers Vitest Pool 도입을 Phase 2 진입 직전 재검토 시점까지 이연

- **상태:** Accepted (2026-05-02)
- **결정일:** 2026-05-02
- **결정자:** Claude (Opus 4.7 1M context) — Sprint 1 §5.2 도구 정비 / Session 029
- **관련 헌법:** v3.0 Vol VI.3 (Financial Circuit Breaker — 의존성 추가 비용 통제), Vol IX (Engine-First Doctrine)
- **관련 ADR:** ADR-006 (Cloudflare Single Vendor), ADR-022 (Cloudflare Single Vendor Lock-in), ADR-027 (BATCH Atomic — Mid-Resume Year 2 이연)
- **관련 결정:** `docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md` (CHA-03 / CHA-05 P0 → P1 재분류)
- **관련 plan:** `.jjokjipge/handoff-session-029.md` §2.A (Sprint 1 §5.2 도구 정비)
- **트리거:** handoff-029 §2.A 의 "Workers Vitest Pool 도입 검토 — `apps/api/vitest.config.ts` + 별도 ADR — 3h" — 본 §5.2 산출물 의무

---

## 1. Context (맥락)

### 1.1 Workers Vitest Pool 의 정의

`@cloudflare/vitest-pool-workers` 는 Cloudflare 가 제공하는 Vitest pool. 테스트를 실제 `workerd` 런타임 내부에서 실행하여 다음을 보장:

- Workers 런타임 정합성 (CPU 50ms / 메모리 128 MB 한도, fs/path 미가용 등)
- 실 binding 사용 (`miniflare` 기반 D1 / Vectorize / KV / R2 / Durable Objects)
- 외부 fetch 의 MSW 통합 자동
- workerd 실 모듈 시스템 (CommonJS / ESM 정합 검증)

### 1.2 본 프로젝트 현 시점 테스트 인프라 (Year 1 Phase 1)

- `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` — **Node 22 내장 `node:sqlite` 직접 사용**.
  - 실 D1 SQLite 엔진과 99% 호환 (v3.0 Vol VI 정합).
  - `migrations/0001~0017` 의 NOT NULL / UNIQUE / CASCADE / 트리거 15종 전부 실제 작동.
  - **외부 의존성 0건** — Node 22 stable 내장.
- Hono mock — `Hono<{ Bindings }>` direct instantiation + 의존성 주입 패턴.
- Vectorize binding 사용 0건 (Phase 1 후반 hybrid-search 활성 예정).
- CI 통합 — `pnpm -r test` 단일 명령 (Vitest default pool, ~30s).

### 1.3 handoff-029 의 도입 검토 사유

본 ADR 트리거 시점 handoff-029 §2.A 에 다음 검토 항목 명시:

- **CHA-01 D1 disconnect 10% rate** (P0): MSW 또는 D1 wrapper level 에서 disconnect 시뮬레이션.
- **CHA-05 Vectorize timeout 2초 fallback** (P0 → **P1 재분류 by decision-2026-05-02**): Vectorize binding mock.

→ CHA-05 P1 재분류로 본 ADR 의 시급성 1/2 으로 감소.

### 1.4 이번 결정의 배경 (정직)

본 §5.2 도구 정비 시점에 Workers Vitest Pool 을 도입하면 다음이 발생:

1. **신규 의존성**: `@cloudflare/vitest-pool-workers` (vitest, miniflare, workerd 동시 추가).
2. **테스트 런타임 분리**: 일부 테스트는 Workers Pool, 일부는 Node — 두 런타임 운영 부담.
3. **`node:sqlite` 경로 차단**: workerd 내부에서는 `node:sqlite` 미가용 → 기존 `d1-from-sqlite.ts` 헬퍼 별도 워크어라운드 필요.
4. **CI 시간 증가**: workerd startup 오버헤드 (예상 ~3~5초 / suite × 7 패키지).
5. **CHA-05 미가용**: hybrid-search 가 Phase 1 후반 활성 → 본 시점에 Vectorize binding 테스트 자체 부재.

---

## 2. Decision (결정)

**Workers Vitest Pool 도입을 Phase 2 진입 직전 (BATCH-1 적재 후 사용자 노출 전) 재검토 시점까지 이연.**

본 §5.2 시점은 **N/A — Year 1 Phase 1**.

---

## 3. 선택지 비교

| 옵션                 | 비용  | 본 시점 효용               | Phase 2 효용            | 의존성 추가 | 정합 | 결과 |
| :------------------- | :---- | :------------------------- | :---------------------- | :---------- | :--: | :--- |
| **A: 본 시점 도입**  | ~3~5d | CHA-01 시뮬레이션만        | 전부 활용               | 3 packages  |  ❌  | 기각 |
| **B: 이연 (본 ADR)** | 0d    | CHA-01 = 기존 wrapper 활용 | Phase 2 진입 시 도입    | 0           |  ✅  | 채택 |
| C: dev-only 도입     | ~1d   | 문서/실험만                | Phase 2 진입 시 본격    | 3 packages  |  🟡  | 기각 |
| D: 영구 N/A          | 0d    | —                          | hybrid-search 검증 결손 | 0           |  ❌  | 기각 |

**옵션 A 기각 사유**: §1.4 의 5가지 비용 (의존성 / 런타임 분리 / `node:sqlite` 경로 차단 / CI 시간 / CHA-05 미가용) 가 본 시점 효용 (CHA-01 한 건 시뮬레이션) 을 초과.

**옵션 C 기각 사유**: dev-only 라도 의존성 lock + 일부 CI 분기 → 운영 부담 시작. "도입 시점 = 본격 사용 시점" 정합이 더 깔끔.

**옵션 D 기각 사유**: Year 2 멀티시험 확장 / Phase 2 hybrid-search 활성 / Workers 런타임 정합 검증은 본 프로젝트 핵심 (ADR-006 단일 벤더 정합). 영구 N/A = 검증 결손.

**옵션 B 채택 사유**:

1. 본 시점 효용이 명백히 작음 (CHA-01 한 건만, CHA-05 는 P1 이연).
2. 기존 `node:sqlite` D1 헬퍼가 D1 99% 호환 — CHA-01 disconnect 는 wrapper level throw 로 충분.
3. Phase 2 진입 시 hybrid-search + Vectorize binding 본격 활성과 **동일 시점 도입** = 운영 시점 정합.
4. 신규 의존성 0건 = §5.3 NOT-IMPL 7건 작업 차단 0건.

---

## 4. 본 결정의 즉시 효력

### 4.1 CHA-01 D1 disconnect 시뮬레이션 (Sprint 1 §5.3 의무)

본 ADR 채택으로 CHA-01 D1 disconnect 시뮬레이션은 다음 패턴으로 구현:

```typescript
// apps/api/src/__tests__/helpers/d1-disconnect-mock.ts (Sprint 1 §5.3 신규)
import { createD1FromSqlite } from './d1-from-sqlite.js';

export interface DisconnectConfig {
  readonly disconnectRate: number; // 0.0 ~ 1.0
  readonly errorClass: string; // 'D1_DISCONNECT' | 'D1_TIMEOUT'
}

export function withDisconnect(d1: D1Database, config: DisconnectConfig): D1Database {
  return new Proxy(d1, {
    get(target, prop) {
      const orig = Reflect.get(target, prop);
      if (typeof orig !== 'function') return orig;
      return async (...args: unknown[]) => {
        if (Math.random() < config.disconnectRate) {
          const error = new Error(`Simulated ${config.errorClass}`);
          (error as Error & { code: string }).code = config.errorClass;
          throw error;
        }
        return orig.apply(target, args);
      };
    },
  });
}
```

→ Workers Pool 미경유 / 기존 `d1-from-sqlite.ts` + Proxy wrap 으로 disconnect 10% rate 시뮬레이션 충분.

### 4.2 CHA-04 wall clock skew (Sprint 1 §5.3 의무)

`vi.useFakeTimers()` + `vi.setSystemTime()` 으로 충분 (`docs/quality/test-patterns.md` §1 정합). Workers Pool 미경유.

### 4.3 CHA-05 Vectorize timeout fallback (Phase 2 진입 직전 의무)

본 시점 P1 이연 (decision-2026-05-02 정합). Phase 2 진입 직전:

- `@cloudflare/vitest-pool-workers` 도입 + Vectorize binding 실 시뮬레이션
- 또는 Vectorize HTTP API mock (MSW + workerd HTTP fetch) — 본 ADR 재검토 시 결정

### 4.4 §5.3 NOT-IMPL 7건 작업 차단 영향

본 ADR 채택으로 Sprint 1 §5.3 NOT-IMPL 7건 (CHA-01/02/04 + FUZ-01/02 + REC-01/02) 신규 구현 작업 차단 **0건**. 모두 기존 인프라 (Node 22 + Vitest default pool + node:sqlite + vi.useFakeTimers) 위에서 구현 가능.

---

## 5. Phase 2 진입 직전 재검토 트리거

본 ADR 의 "이연" 결정은 다음 조건 발생 시 **재검토 의무**:

1. **BATCH-1 적재 완료** — Engine Hardening Roadmap §11 BATCH-1 진입 게이트 통과 시점.
2. **hybrid-search 본격 활성** — Phase 1 후반 Vectorize 업서트 완료 + 사용자 검색 요청 처리 시작.
3. **CHA-05 본격 측정** — P1 재분류된 CHA-05 의 P1 게이트 측정 의무 시점.
4. **Workers 런타임 발견 사항** — 본 시점 `node:sqlite` 호환 99% 가정의 1% 결손이 운영 중 발견될 경우.

**재검토 시 평가 항목**:

- `@cloudflare/vitest-pool-workers` 의 본 시점 (재검토 시점) 안정성 / 성능
- 기존 `d1-from-sqlite.ts` + Proxy 패턴의 한계 (예: Workers 특화 API 미커버)
- CI 시간 증가 vs 검증 신뢰성 trade-off
- ADR-006 단일 벤더 정합 (Cloudflare 공식 도구 우선)

---

## 6. 본 결정의 한계 (정직)

1. **CHA-01 시뮬레이션의 충실도 한계**: Proxy wrap 은 D1 wrapper API level disconnect 만 시뮬레이션. workerd 내부의 fetch / network layer disconnect 는 본 시점 미커버.
2. **Workers 런타임 정합 결손**: 본 시점 테스트는 Node 22 + node:sqlite 위에서 실행. workerd 의 미세 차이 (CPU 측정 / 메모리 압박 / fetch retry 동작) 는 별도 manual smoke test 또는 staging deploy 시 검증 의무.
3. **Year 2 멀티시험 시점 부담 이연**: Phase 2 진입 시점에 Workers Pool 도입 + 멀티시험 adapter 분리 + hybrid-search 본격 활성이 동시 작업 → 단일 sprint 부담 증가 가능. Phase 2 진입 직전 sprint 계획 시 본 부담 분산 의무.

---

## 7. 본 결정의 검증 가능 항목

진산님 본 결정의 정직성 검증:

1. **node:sqlite 호환 검증**:
   ```bash
   pnpm --filter @thepick/api test 2>&1 | grep -E "PASS|FAIL"
   ```
   현 시점 261 PASS — node:sqlite 기반 D1 헬퍼가 실 D1 호환 검증 완료.
2. **Vectorize binding 부재 검증**:
   ```bash
   grep -rn "VECTORIZE\|Vectorize" apps/api/src packages/ | grep -v node_modules | head
   ```
3. **CHA-05 P1 재분류 정합**:
   ```bash
   cat docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md
   ```

---

**ADR 효력 시점**: 2026-05-02 (Session 029 §5.2 도구 정비 진행 중)
**다음 검토 시점**: Phase 2 진입 직전 (BATCH-1 적재 후 사용자 노출 전)
**본 ADR 변경 트리거**: §5 4 가지 트리거 또는 진산님 명시 reverse 지시
