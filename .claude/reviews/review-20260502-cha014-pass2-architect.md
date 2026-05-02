# Pass 2 — ARCHITECT (Top-Down 연계 검증)

- **대상**: Sprint 1 §5.3 CHA-01 / CHA-02 / CHA-04 (3 commits — e589ce7 / ac5e4db / a319a81)
- **리뷰자**: 독립 system-architect 컨텍스트 (코드 작성 컨텍스트와 분리)
- **시점**: 2026-05-02
- **근거 문서**:
  - `.claude/rules/auto-review-protocol.md` (Pass 2 명세)
  - `CLAUDE.md` (Hard Limit, L3 영역, Hard Rule 15-17)
  - `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md` (CHA-01 §4.1 패턴 근거)
  - `docs/architecture/ARCHITECTURE.md` (Hexagonal 규칙, packages 의존)
  - `docs/quality/test-patterns.md` (CHA-04 §1 정합)

---

## 0. 리뷰 범위

**변경 파일 (11)**:

- `apps/api/src/__tests__/helpers/d1-disconnect-mock.ts` (신규, 145 lines)
- `apps/api/src/__tests__/scenarios/cha-01-d1-disconnect.test.ts` (신규, 264 lines)
- `apps/api/src/middleware/retry.ts` (수정 +2)
- `apps/api/src/middleware/__tests__/retry.test.ts` (수정 +9)
- `apps/batch/__tests__/cha-04-clock-skew.test.ts` (신규, 340 lines)
- `packages/formula-engine/src/engine.ts` (수정 +30)
- `packages/formula-engine/src/errors.ts` (신규, 27 lines)
- `packages/formula-engine/src/index.ts` (수정 +3)
- `packages/formula-engine/src/sandbox.ts` (수정 +65)
- `packages/formula-engine/src/types.ts` (수정 +5)
- `packages/formula-engine/src/__tests__/cha-02-compute-timeout.test.ts` (신규, 189 lines)

**연관 파일 (검증 시 참조)**:

- `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` (Proxy underlying target)
- `apps/api/src/__tests__/scenarios.test.ts` (디렉토리 충돌 대상)
- `apps/batch/src/recover.ts`, `apps/batch/__tests__/recover.test.ts` (CHA-04 회귀 대상)
- `packages/formula-engine/src/ast-parser.ts` (parseFormula cache → COMPUTE_TIMEOUT 정합)
- `apps/batch/src/qg2-validator.ts:114` (FormulaError 다운스트림 소비자)
- `packages/shared/src/logger.ts:312,328` (CHA-04 fake timer 영향 평가 대상)
- `docs/architecture/ARCHITECTURE.md` §6 Hexagonal, §3.2 packages 의존
- `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md` §4.1 (단일 vs 2단 Proxy 정합)

---

## Pass 2 (Architect): 🔴 0건 / 🟠 2건 / 🟡 4건 / ✅ 9건 PASS / N/A 4건

### 🔴 CRITICAL: 0건

연계 검증으로 즉시 다른 모듈을 깨뜨리는 경로 미발견.

---

### 🟠 MAJOR: 2건

#### MAJOR-1 — `apps/api/src/__tests__/scenarios/` (디렉토리) ↔ `apps/api/src/__tests__/scenarios.test.ts` (파일) 네이밍 충돌

**파일**: `apps/api/src/__tests__/scenarios/cha-01-d1-disconnect.test.ts` (신규) ↔ `apps/api/src/__tests__/scenarios.test.ts` (기존 21 시나리오 692 lines)

**증거**:

```
$ find apps/api/src/__tests__ -maxdepth 1
apps/api/src/__tests__/helpers
apps/api/src/__tests__/scenarios       ← 신규 디렉토리
apps/api/src/__tests__/scenarios.test.ts  ← 기존 파일
```

**검증**: `pnpm --filter @thepick/api test -- --run cha-01` 실 실행 → 9 PASS. Vitest glob `*.test.ts`는 디렉토리·파일 코드명 충돌 없이 둘 다 픽업. 따라서 **런타임 오작동은 부재**.

**그러나 깨질 시나리오**:

1. `pnpm test -- scenarios` 같이 부분 매칭으로 필터링 시 의도 모호 (디렉토리 vs 파일 둘 다 매칭).
2. 문서/가이드에서 "scenarios.test.ts" 와 "scenarios/" 를 동음이의어로 혼동.
3. 후속 commit 에서 `scenarios.test.ts` → `scenarios/index.test.ts` 같은 리팩토링 시 git history conflict 발생 가능.
4. 새 chaos 시나리오 추가자가 "기존 scenarios.test.ts 에 추가? scenarios/ 에 새 파일?" 결정 모호 → 컨벤션 분산.

**수정 권고**:

- 명시 컨벤션 1: `scenarios/` = chaos/PRF/REC 시나리오 디렉토리, `scenarios.test.ts` = 기존 사용자 흐름 21건 (이름 그대로 유지).
- 또는 분리: `scenarios/` 를 `chaos/` 로 rename → `apps/api/src/__tests__/chaos/cha-01-d1-disconnect.test.ts`. 의미 충돌 해소.
- `docs/quality/test-patterns.md` 에 컨벤션 1줄 명시.

---

#### MAJOR-2 — ADR-028 §4.1 의 단일 Proxy 예시 vs 본 구현의 2단 Proxy — ADR 갱신 필요

**파일**: `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md:103-118` (예시) vs `apps/api/src/__tests__/helpers/d1-disconnect-mock.ts:76-127` (실 구현)

**증거 — ADR-028 §4.1**:

```typescript
export function withDisconnect(d1: D1Database, config: DisconnectConfig): D1Database {
  return new Proxy(d1, {
    get(target, prop) {
      const orig = Reflect.get(target, prop);
      if (typeof orig !== 'function') return orig;
      return async (...args: unknown[]) => {
        if (Math.random() < config.disconnectRate) { ... }
        return orig.apply(target, args);
      };
    },
  });
}
```

**증거 — 실 구현 (d1-disconnect-mock.ts:76-127)**:

- 1단 Proxy: `D1Database` (exec/batch/dump/prepare/withSession 분기 처리)
- 2단 Proxy: `wrapStatement(D1PreparedStatement)` (bind 재귀 wrap, first/run/all/raw fail 주입)
- `Math.random()` 대신 결정적 mulberry32 PRNG (재현성 확보).

**구조적 차이의 정당성** (코드 주석 — d1-disconnect-mock.ts:13-15):

> "ADR-028 §4.1 의 단일 Proxy 패턴은 prepare/bind (local op) 까지 fail 주입 → 비현실적. 본 wrapper 는 first/run/all/raw/exec/batch (DB 접촉) 에만 주입."

**구조적 정당성은 옳다** (Proxy `get(d1, 'prepare')` 이 fail 주입 함수를 반환하면 prepare 호출 자체가 실패 — D1 의 실제 동작 [prepare 는 local SQL 컴파일, 네트워크 전송 X] 와 어긋남). 그러나 ADR 본문이 갱신 안 된 상태로 남으면:

**깨질 시나리오**:

1. 6개월 뒤 신규 작업자가 ADR-028 § 4.1 예시를 기준으로 다른 chaos 헬퍼 (Vectorize, KV) 작성 시 single-Proxy 패턴 채용 → fail 주입 부정확.
2. CHA-05 P1 (Phase 2 진입 직전) 시점에 "ADR-028 patten 따라하면 됨" 가정 → 동일 함정 재발.
3. ADR-028 §6 "본 결정의 한계" 가 현재 single-Proxy 한계를 반영 안 함 → 정직성 결손.

**수정 권고**:

- ADR-028 §4.1 의 코드 예시를 실 구현의 "2단 Proxy 패턴" 으로 업데이트 (또는 "최종 구현 참조: d1-disconnect-mock.ts:76-127" 명시).
- §6 "본 결정의 한계" 에 "single-Proxy 가정 시 prepare/bind local op 도 fail → 2단 Proxy 의무" 추가.
- 또는 ADR-028 의 예시는 그대로 유지하되 본 commit 메시지/handoff 에 "ADR-028 §4.1 의 단일 Proxy 예시는 conceptual — 실 구현은 2단" 1줄 명시 (선호도 낮음).

---

### 🟡 MINOR: 4건 (보고만 — 즉시 수정 불요, 후속 추적)

#### MINOR-1 — `D1_TIMEOUT` errorClass 가 RETRYABLE_MESSAGE_PATTERNS 에 명시 없음 — substring 의존

**파일**: `apps/api/src/__tests__/helpers/d1-disconnect-mock.ts:39` (3종 errorClass 선언) vs `apps/api/src/middleware/retry.ts:45-53`

**현황**: retry.ts 의 RETRYABLE_MESSAGE_PATTERNS 는 `/timeout/i`, `/D1_DISCONNECT/i`, `/D1_UNAVAILABLE/i` 명시. `D1_TIMEOUT` 자체는 미명시이나 emit format 이 `D1_TIMEOUT: simulated first (...)` 이라 `/timeout/i` 가 substring 으로 catch.

**결과**: 동작 정확. test 도 PASS.

**약점**: emit format 이 변경되어 "timeout" 키워드가 빠지면 silent fail (D1_TIMEOUT 이 non-retryable 로 분류). 본 wrapper 단위 테스트가 retry middleware 매칭까지 검증 안 함.

**권고** (P2 후속):

- retry.ts:45-53 에 `/D1_TIMEOUT/i` 명시 추가 (방어).
- 또는 d1-disconnect-mock.test (별도) 에 "errorClass 3종 모두 isRetryable=true 검증" 1건 추가.

---

#### MINOR-2 — CHA-04 fake timer 가 logger.ts 의 `new Date()` timestamp 를 fake 시각으로 출력

**파일**: `packages/shared/src/logger.ts:312` (`timestamp: new Date().toISOString()`) ↔ `apps/batch/__tests__/cha-04-clock-skew.test.ts:108,146,...` (`vi.setSystemTime`)

**증거** (실 실행 stdout):

```json
{
  "level": "warn",
  "message": "recover blocked — concurrent_run_detected (state=in_progress)",
  "timestamp": "2026-05-02T10:00:00.000Z",
  "elapsedMs": 0
}
```

(`timestamp` 가 fake clock = 10:00:00 으로 출력 — wall clock 이 아닌 시뮬레이션 시각.)

**구조적 평가**:

- 이는 `vi.useFakeTimers()` 의 정상 동작 — Vitest 의 의도된 부작용.
- recover.test.ts (commit b1d8a) 도 이미 `vi.setSystemTime` 사용 — 동일 영향 기존 존재.
- environment="test" 출력이라 production observability 영향 0.

**위험도**: production 영향 0, 본 테스트 만 영향. **회귀 신호 X**.

**권고** (P3, 선택):

- `packages/shared/src/logger.ts` 에 `clock?: () => string` 옵션 주입 (DI) — production = `() => new Date().toISOString()`, test = 명시 주입 가능. 본 변경 비용은 본 sprint 효용 미달이므로 후속 backlog.

---

#### MINOR-3 — `formula-engine` 단위 테스트가 `examId` 파라미터 부재 — Hard Rule 16 Year 2 zero-cost 전환 시 noise

**파일**: `packages/formula-engine/src/__tests__/cha-02-compute-timeout.test.ts` 전체

**증거**: `grep -n "EXAM_ID\|exam_id" cha-02-compute-timeout.test.ts` → 0건.

**현황**: `engine.calculate(formulaId, inputs)` 의 시그니처 자체가 examId 미수신. 본 commit 의 신규 작업이 아니라 **formula-engine 패키지 전반의 pre-existing 미준수** (Hard Rule 16 — 모든 데이터 조회/엔진 진입에 examId 의무).

**평가**: 본 CHA-02 commit 책임 X — formula-engine 패키지가 Year 1 한시 예외 (production-quality.md Hard Rule 15 § Year 1 한시 예외) 대상 일 가능성 (단일 시험 한정 산식만 등록). Year 2 Phase 4 adapter 분리 시점에 본 시그니처 추가 필요.

**권고** (P3, 후속): handoff-032 에 "Year 2 Phase 4 시점: `calculate(examId, formulaId, inputs)` 시그니처 변경 + 본 테스트 5건도 동시 갱신" 명시 이월.

---

#### MINOR-4 — CHA-01 테스트가 `examId` 미사용 — apps/api layer 정합

**파일**: `apps/api/src/__tests__/scenarios/cha-01-d1-disconnect.test.ts` 전체

**증거**: `grep -n "EXAM_ID" cha-01-d1-disconnect.test.ts` → 0건. `cha-04-clock-skew.test.ts` 는 `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 사용 (apps/batch — Hard Rule 16 BatchRunsDb 시그니처 정합).

**평가**: CHA-01 은 raw D1 호출 (INSERT INTO cha01_simulated VALUES ...) 로 retry 정합만 검증 — knowledge_nodes 같은 시험 지식 테이블 미접촉. Hard Rule 16 의 적용 대상 (knowledge_nodes/exam_questions 등 9 테이블) 외부. **현재는 정합**.

**권고** (P3, 후속): Phase 2 BATCH 통합 카오스 테스트 (handoff-032 §1 명시 이월 항목) 추가 시점에 examId 시그니처 적용 의무.

---

### ✅ PASS: 9건 (실제 확인 증거)

#### P-1. Import 방향 단방향성 — `formula-engine → shared` 위반 0

- `packages/formula-engine/package.json:13-15` — `@thepick/shared`만 의존 (단방향).
- `packages/formula-engine/src/sandbox.ts:19-41` — `mathjs` + `./errors` (내부) 만 import. 외부 packages 무의존.
- `packages/formula-engine/src/engine.ts:15-20` — types/formulas/ast-parser/variable-mapper/sandbox/errors (전부 내부). 무의존 외부.

#### P-2. Workers 제약 — fs/path 사용 0 (apps/api)

- `apps/api/src/__tests__/helpers/d1-disconnect-mock.ts` — `fs`, `path`, `node:*` 사용 0건. Pure Proxy + PRNG.
- `apps/api/src/__tests__/scenarios/cha-01-d1-disconnect.test.ts` — 동일. test infra 만 (vitest).
- 단, `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:23` 가 `node:sqlite` 사용 — Workers 미가용. 그러나 본 파일은 **테스트 헬퍼** (production 번들 미포함). ADR-028 §1.2 명시 정당화.

#### P-3. Workers 제약 — fs/path 사용 0 (formula-engine)

- `packages/formula-engine/src/sandbox.ts`, `errors.ts`, `engine.ts` 모두 fs/path 0건. mathjs + 순수 함수.
- COMPUTE_TIMEOUT path 에 Date.now() 사용 (sandbox.ts:359) — Workers 호환 (`performance.now` 호환 인터페이스, 코드 주석 명시).

#### P-4. D1 스키마 일치 — 본 commit 변경 0건

- 본 3 commit 은 D1 스키마 (migrations/) 미수정. CHA-01 의 `cha01_simulated` 는 in-memory SQLite test-only 테이블 (in-test `CREATE TABLE`).
- recover.ts 는 batch_runs 테이블 unchanged — CHA-04 가 BatchRunsDb mock 만 사용.

#### P-5. Hexagonal 위반 — domain → infrastructure 직접 참조 0

- 본 commit 의 변경 파일 11개 중 `modules/` 진입 0건 (전부 packages/ 또는 apps/ 의 helpers/tests).
- `grep -rn "modules/" <변경 11파일>` → 0 매칭.

#### P-6. ARCHITECTURE.md 다이어그램 정합성

- `docs/architecture/ARCHITECTURE.md:158` — formula-engine M16 (L3) 위치 정합. 본 commit 의 errors.ts 신설은 동일 패키지 내부 분리 (외부 노출 X 전엔). index.ts:26 export 추가로 외부 노출 정합 — 다이어그램 미영향 (외부 의존 변화 없음).
- ARCHITECTURE.md:103 "formula-engine: 빌드 시 packages/에서 개발" 정합. 본 commit 변경 패턴 정합.

#### P-7. Year 1/Year 2 경계 — Hard Rule 17 EXAM_IDS 사용 정합

- `apps/batch/__tests__/cha-04-clock-skew.test.ts:26` — `import { EXAM_IDS } from '@thepick/shared'`.
- 동 파일 :37 — `const TEST_EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA;`
- `'son-hae-pyeong-ga-sa'` literal 직접 사용 0건 (테스트 픽스처 외).
- recover.test.ts 기존 패턴 정합 (recover.ts:Hard Rule 16 examId 시그니처 의무).

#### P-8. parseFormula 캐시 무결성 (COMPUTE_TIMEOUT 후 정상 작동)

- `packages/formula-engine/src/ast-parser.ts:40-65` — `safeParse` 가 throw → cache.set 절대 미도달. 캐시 오염 0.
- 다음 호출에서 동일 expression → cache miss → 다시 throw → engine.calculate catch → COMPUTE_TIMEOUT 결과. 결정성 보장.
- `cha-02-compute-timeout.test.ts:174-188` 의 100회 반복 테스트가 본 정합을 검증 (heap delta < 5MB 통과).

#### P-9. CHA-04 vs test-patterns.md §1 정합

- `docs/quality/test-patterns.md:14-42` 패턴 — `vi.useFakeTimers()` + `vi.setSystemTime()` + `afterEach: vi.useRealTimers()`.
- `cha-04-clock-skew.test.ts:99` — `afterEach: vi.useRealTimers()` 명시. test-patterns.md §1.1 의무 정합.
- `cha-04-clock-skew.test.ts:108,146,...` — 5 테스트 모두 `vi.setSystemTime` 사용 정합.
- 안티패턴 (test-patterns.md §1.2) 위반 0 — `Date.now() = N` 직접 mock 미사용, `setTimeout` 부분 mock 미사용.

---

### N/A: 4건 (해당 없음 — 본 commit 범위 외)

- **Ontology Lock**: 본 commit 신규 노드/엣지 ID 생성 0건. ontology-registry.json 미터치.
- **truth_weight 정렬**: RAG 결과 LLM 주입 미관여. 본 commit 은 chaos test/formula-engine.
- **Temporal Graph (UPDATE 금지)**: D1 쿼리 SELECT/INSERT 만 (CHA-01 cha01_simulated INSERT). knowledge_nodes/formulas UPDATE 0.
- **i18n**: 본 commit 의 사용자 노출 문자열 0 (전부 test/log).

---

## 반론 의무 (Devil's Advocate) — 깨질 수 있는 시나리오 5개

### 반론-1 (CHA-01) — D1Database 의 미래 API 추가 시 silent break

**시나리오**: Cloudflare 가 D1 에 `D1Database.session()`, `D1Database.transaction()`, 또는 `D1Database.observe()` 같은 신규 메서드 추가 시:

- d1-disconnect-mock.ts:96 의 `default branch` (`exec/batch/dump 외 모두 fail 주입`) 가 신규 메서드를 자동으로 fail 주입 → 본 wrapper 사용 테스트가 silent fail.
- 또는 신규 메서드가 local op (e.g., 'observe') 인데 fail 주입 → 비현실적 시뮬레이션.

**현재 방어**: prepare/withSession 만 explicit allowlist. `D1Database.dump()` 는 코드 주석 (line 70 — `D1Database.exec / batch / dump`) 에 명시했으나 wrapStatement 분기 없음. **wrapper 가 D1Database 전체 surface 를 enumerate 안 함** = 미래 API 추가 시 전수 회귀 검증 의무.

**완화 권고**: d1-disconnect-mock.ts 에 D1 API 버전 잠금 주석 (`@cloudflare/workers-types ^4.20260415.1` — 본 시점 D1 surface). 후속 wrangler upgrade 시 본 wrapper 회귀 검토 의무 명시.

### 반론-2 (CHA-02) — `CalculationTimeoutError` 가 외부 catch 가능하지만 외부 catch 부재

**시나리오**:

- `index.ts:26` — `CalculationTimeoutError` export 됨.
- `engine.calculate()` 가 자체 catch → `FormulaError code='COMPUTE_TIMEOUT'` 매핑.
- 따라서 외부 caller (qg2-validator.ts:114) 는 `result.code` 만 보고 분기 — `CalculationTimeoutError` instance 직접 catch 코드 0건.
- 이는 의도된 graceful degradation. **그러나 외부 export 는 무의미** (instance 검사 없는 export).

**현재 방어**: 정합. caller 가 `result.ok === false && result.code === 'COMPUTE_TIMEOUT'` 분기로 충분.

**완화 권고**: index.ts:26 의 `export { CalculationTimeoutError }` 가 **진단 목적 (Sprint 1 §5.3 CHA-02 — 자원 한도 위반 에러)** 임이 주석 명시. 또는 export 제거 (외부 instance 검사 안 하면 dead export). 본 commit 의 메시지 (ac5e4db) 는 "CalculationTimeoutError + COMPUTE_TIMEOUT" 명시 — 이중 표면 의도. ✅ 의도 정합.

### 반론-3 (CHA-04) — `vi.advanceTimersByTime` + `vi.setSystemTime` 혼용 시 미세 케이스

**시나리오**: cha-04-clock-skew.test.ts:322-323:

```ts
vi.advanceTimersByTime(600 * 1000); // T=10:10:00
vi.setSystemTime(new Date('2026-05-02T10:00:00Z')); // -10분 점프 → T=10:00:00
```

- `advanceTimersByTime` 후 `setSystemTime` 으로 시각을 후퇴시킴.
- Vitest 내부 timer 큐가 미래 (T+10min) 에 있는데 wall clock 만 후퇴 → setTimeout 콜백이 wall clock 기준으로 발화 시점을 재계산하면 무한 대기 가능.

**현재 방어**: 본 테스트는 setTimeout 사용 0 — recover.ts 가 sync (Promise chain 만, no setTimeout). 따라서 발화 X. ✅ 본 테스트 시나리오 안전.

**잠재 위험**: 만약 후속 commit 에서 recover.ts 에 `setTimeout` (e.g., backoff retry) 추가 시 본 패턴 (forward then backward) 이 깨질 가능. **회귀 추적 신호** 로 보존 의무.

### 반론-4 (CHA-01) — disconnect storm 후 회복 시나리오의 ctx.db 누설

**시나리오**: cha-01-d1-disconnect.test.ts:240-263 — storm (Proxy wrap 된 flaky) 5회 호출 후 underlying ctx.db (raw) 정상 동작 검증.

- Proxy 가 underlying d1 에 mutation 안 함 (Reflect.get / apply 만) → 정합.
- 그러나 만약 Proxy 가 D1 connection state 를 wrap 했다면 (예: 가상 connection ID 추적), storm 후 누설 가능.

**현재 방어**: Proxy 는 stateless (PRNG 만 외부 state). underlying d1 mutation 0. ✅ 정합.

### 반론-5 (CHA-04) — `state='killed'` 시나리오 (multi-skew Section 4) 의 의미적 모호

**시나리오**: cha-04-clock-skew.test.ts:314-315 — `state: 'killed'` 로 concurrent_run 블록 우회.

- 코드 의도 명시: "이미 killed 상태 — concurrent_run 블록 우회".
- 그러나 recover.ts:184 의 분기는 `state === 'in_progress'` 만 체크. 'killed' 는 분기 진입 X — 이 우회는 정상 동작.
- 진짜 multi-skew 는 `state='in_progress'` 시점에 시계가 점프 → elapsed 계산이 `Math.max(0, ...)` 정합.

**현재 방어**: 본 Section 4 테스트는 multi-skew 시나리오 자체는 검증하나, recover 의 elapsed 분기까지 도달 X (state=killed 우회). **반쪽 검증**.

**완화 권고**: Section 4 에 `state='in_progress'` + multi-skew (forward/backward 시각 점프) 시나리오 1건 추가. 현재는 Section 1 (skew +10min) + Section 2 (catch-up) 가 그 분기를 분담 검증 — 종합 정합 ✅. Section 4 는 "다중 시계 점프 후에도 checkpoint 정합 보장" 으로 의미 한정 명시.

---

## 판정

**판정: 완료 가능 (조건부)**

- CRITICAL 0건 → 본 commit 즉시 합격.
- MAJOR 2건 → 본 sprint 종료 전 흡수 권고:
  - **MAJOR-1** (scenarios 디렉토리/파일 충돌): 컨벤션 명시 1줄 + (선택) chaos/ rename. 30분 작업.
  - **MAJOR-2** (ADR-028 §4.1 단일 vs 2단 Proxy): ADR-028 갱신 1 페이지 또는 commit 메시지/handoff 1줄. 15분 작업.
- MINOR 4건 → 보고만, handoff-032 backlog 이월:
  - MINOR-1 (D1_TIMEOUT 명시 추가)
  - MINOR-2 (logger clock DI — Phase 2 백로그)
  - MINOR-3 (formula-engine examId — Year 2 Phase 4)
  - MINOR-4 (CHA-01 BATCH 통합 examId — handoff-032 §1)

**연계 검증 결론**: 본 3 commit 의 신규 모듈은 패키지 경계 / Workers 제약 / Hexagonal 규칙 모두 정합. ARCHITECTURE.md 다이어그램 변경 의무 0건. Hard Rule 15-17 위반 0건 (CHA-04 EXAM_IDS 정합).

다음 모듈과의 통합 위험 0 — 본 commit 은 chaos test 인프라 + formula-engine 자원 한도 가드. 다운스트림 (qg2-validator) 영향은 graceful (`result.code='COMPUTE_TIMEOUT'` 분기 정합).

---

## 메타 — 리뷰 정직성 검증

- 본 리뷰는 코드 작성 컨텍스트와 분리된 독립 system-architect 컨텍스트에서 수행 (auto-review-protocol.md 규칙 0 정합).
- 0건 보고 (CRITICAL) 시 PASS 9건 + N/A 4건 + MAJOR 2건 + MINOR 4건 의 증거 기반 분류 (auto-review-protocol.md 규칙 2 정합).
- 5개 반론 시나리오 명시 (auto-review-protocol.md 규칙 3 — 최소 1개 의무).
- 변경 파일 11개 + 연관 파일 8개 전체 범위 검증 (auto-review-protocol.md 규칙 1 정합).
