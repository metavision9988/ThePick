# Sprint 1 §5.4 — Pass 3 ADVOCATE (security-engineer) 4-Pass 리뷰

- **리뷰 일시**: 2026-05-02
- **리뷰 대상**: 8 commits (a258f36 / cd25854 / 8dc2c13 / b6891ed / 02d95b6 / cec2aae / 11b366f / 50c8bb3)
- **Pass**: 3/4 ADVOCATE — "수험생 + 공격자 둘 다 만족하는가?"
- **리뷰 방식**: 독립 서브에이전트 (security-engineer 페르소나) — 자가 리뷰 X
- **참조**: handoff-session-032 §3.1 ADR-029 / §3.2 이중 방어 / silent pivot 6건

---

## 1. 리뷰 범위

### 1.1 변경 파일 (commit별)

| Commit                         | 파일                                                                                    | LOC  |
| :----------------------------- | :-------------------------------------------------------------------------------------- | :--- |
| a258f36 REC-02 + ADR-029       | `apps/batch/__tests__/rec-02-checkpoint-tampering.test.ts` (신규)                       | +393 |
|                                | `docs/adr/ADR-029-formula-engine-resource-limit.md` (신규)                              | +216 |
| cd25854 REC-01                 | `apps/batch/__tests__/rec-01-kill-points-parametrized.test.ts` (신규)                   | +302 |
| 8dc2c13 PRC-01 + AST 한도      | `packages/formula-engine/src/sandbox.ts` (수정)                                         | ±15  |
|                                | `packages/formula-engine/src/__tests__/prc-01-precision-framework.test.ts` (신규)       | +133 |
|                                | `packages/formula-engine/src/__tests__/cha-02-compute-timeout.test.ts` (수정)           | ±28  |
|                                | ADR-029 Decision Log §6 갱신                                                            | +6   |
| b6891ed PRF-01 + iterative DFS | `packages/formula-engine/src/sandbox.ts` (computeAstDepth 변환)                         | ±31  |
|                                | `packages/formula-engine/src/__tests__/prf-01-formula-engine-perf.test.ts` (신규)       | +166 |
| 02d95b6 PRF-02                 | `packages/quality/src/__tests__/prf-02-naive-vs-tarjan.test.ts` (신규)                  | +185 |
| cec2aae FUZ-04                 | `packages/formula-engine/src/__tests__/fuz-04-sandbox-bypass-12-vectors.test.ts` (신규) | +106 |
| 11b366f CHA-06                 | `apps/api/src/scheduled/__tests__/cha-06-cron-24h-miss.test.ts` (신규)                  | +159 |
| 50c8bb3 ESLint                 | `.eslintrc.json` (rule 추가)                                                            | +24  |

### 1.2 연관 파일 (확인 대상)

- `packages/formula-engine/src/engine.ts` — `safeParse` / `safeEvaluate` 호출 측, 한국어 prefix + e.message 합성
- `apps/batch/src/checkpoint.ts` — REC-02 의 무결성 보호 메커니즘 본체 (canonical hash + JSON.parse)
- `apps/api/src/__tests__/helpers/d1-disconnect-mock.ts` / `d1-from-sqlite.ts` — ESLint rule 보호 대상
- `packages/shared/src/test-helpers/perf.ts` — production 코드 vs export 경계
- `packages/quality/src/graph-integrity.ts` — `findSupersedeCycles` (PRF-02 측정 대상)

---

## 2. Pass 3 결과 요약

```
── PASS 3 (ADVOCATE / security-engineer) ──────────────
리뷰 방식: 독립 서브에이전트 (security-engineer 페르소나)
리뷰 범위: 변경 파일 12개 + 연관 파일 5개 (총 17개)

확인 항목: ✅ 9건 / 🔴 0건 CRITICAL / 🟠 6건 MAJOR / N/A 2건

판정: 완료 가능 (CRITICAL 0건) — MAJOR 6건은 §5.4 종료 전 흡수 또는 Sprint 2 명시 이월
────────────────────────────────────────────────────
```

---

## 3. 확인된 항목 (PASS 9건 — 증거 기반)

### A1. FUZ-04 — 12 vectors 모두 거부됨 (`safeParse`)

- 파일: `packages/formula-engine/src/__tests__/fuz-04-sandbox-bypass-12-vectors.test.ts:62-78` + `packages/formula-engine/src/sandbox.ts:175-223`
- 확인: `validateNode()` 가 ALLOWED*NODE_TYPES (5종) 화이트리스트 + `BLOCKED_SYMBOL_NAMES` (12개) + `SAFE_SYMBOL_PATTERN` (`/^[a-z]a-z0-9*]\*$/`) 으로 12 vectors 중 11/12 거부 (vector 8 = circular 만 정상 통과 — sanity).
- 거부 메커니즘은 AST 단계 (FunctionNode SymbolNode 가 ALLOWED_FUNCTIONS 16개 외 = throw). string concat build (`'e'+'val'`) 도 mathjs parser 가 식별자로 분해 → 동일 차단.
- BigInt literal `2n**1000n` 은 mathjs parser 가 syntax error → ParseError 거부 ✅

### A2. AST 한도 200 보수화 — 정상 산식 회귀 0건

- 파일: `packages/formula-engine/src/sandbox.ts:254-255` + `packages/formula-engine/src/__tests__/cha-02-compute-timeout.test.ts:1` (수정 회귀)
- 확인: 정상 F-01~F-68 산식 nodeCount ≤ 50 (4× 여유 = 200), depth ≤ 10 (1.5× 여유 = 15). commit 이력 `formula-engine 264 → 276 PASS` 에서 정상 산식 회귀 0건 명시.
- 좌결합 폭주 (`1+1+1+...` 100 그룹 = 400 nodes) 즉시 발화 — fail-open 가능성 차단.

### A3. iterative DFS 변환 — V8 stack overflow 보호

- 파일: `packages/formula-engine/src/sandbox.ts:265-281`
- 확인: `computeAstDepth()` 가 명시 stack (`{node, depth}[]`) 기반 iterative — 깊이 한도 15 + safeParse MAX_EXPRESSION_LENGTH 1024 의 다층 방어로 V8 stack overflow 노출 0.
- 이전 순수 재귀의 RangeError → engine.ts catch 우회 propagate 가능성 차단됨.

### A4. REC-02 byte flip / NUL / BOM — file-level corruption 100% 검출

- 파일: `apps/batch/src/checkpoint.ts:478-487` (`SHA-256 mismatch` 비교) + `:447-451` (`JSON.parse failed`)
- 확인: 시나리오 1 (byte flip) → SHA-256 재계산 mismatch → CheckpointCorruptedError. 시나리오 2 (NUL) + 시나리오 5 (BOM) → JSON.parse 실패 → CheckpointCorruptedError 변환 (silent failure 차단 P1-M3 정합).
- error 객체에 `expectedHash` / `actualHash` 노출 (`:107-122`) → forensic 복원 가능 (REC-02 합격 기준 (b) 정합).

### A5. CHA-06 — GC idempotent + Cron 24h skip 회복

- 파일: `apps/api/src/scheduled/__tests__/cha-06-cron-24h-miss.test.ts:94-113`
- 확인: 시나리오 3 (재실행) → `result2.deletedCount=0` (idempotent). 시나리오 4 (24h 진행) → 추가 1440 row 삭제 — Cron miss 후 단일 catch-up 으로 stale row 0 도달.
- `vi.useFakeTimers` + `now: () => new Date(...)` 로 결정성 보장 (test-patterns.md §1 정합).

### A6. ESLint no-restricted-imports — production 코드 차단 정합

- 파일: `.eslintrc.json:21-31` + `:33-52` overrides
- 확인: `**/__tests__/helpers/**` / `**/__tests__/**` / `**/test-helpers/**` 3 패턴이 `error` 레벨로 production 차단. `__fixtures__` / `*.test.ts` / `*.spec.ts` overrides 로 정상 사용 허용.
- 검증 (`grep` 결과): production 코드에서 `from '*test-helpers'` / `from '*__tests__/helpers/*'` import 0건 — rule 발화 없음 (정상).
- d1-disconnect-mock.ts (mulberry32 PRNG + SimulatedD1DisconnectError) 가 wrangler bundle 회귀 차단됨.

### A7. REC-01 — 50회 결정성 검증 + invariant 일치

- 파일: `apps/batch/__tests__/rec-01-kill-points-parametrized.test.ts:118-176`
- 확인: 5 시점 × 10 반복 = 50회 모두 `fully_recovered` (`:156`) + `nodes_processed` 일치 (`:159-162`) + `data_loss=none` (`:165-167`) + `state='recovered'` 1회 갱신 (`:170-174`).
- 결정성 검증 — 동일 입력 → 동일 결과 50/50.

### A8. CHA-06 GC cutoff sanity — 자기 데이터 보호 (역삭제 차단)

- 파일: `apps/api/src/scheduled/__tests__/cha-06-cron-24h-miss.test.ts:65-92`
- 확인: cutoff `2026-04-24T00:00` 기준 1500 rows 중 i ≥ 1440 인 60 rows 만 삭제 — recent row 1440 보존. user-facing 시점 rate-limit 데이터 무손실.

### A9. ADR-029 한도 변경 절차 (cache invalidation) 명시

- 파일: `docs/adr/ADR-029-formula-engine-resource-limit.md:111-118` (§2.4)
- 확인: `MAX_AST_*` 변경 시 (1) Decision Log 갱신 (2) cache invalidation 검증 (3) 한도 ±1 회귀 (4) L3 plan + 진산님 승인 — 4 단계. C-CODE-1 (cache hit 우회) 회귀 차단.

---

## 4. 발견된 이슈 (CRITICAL 0 / MAJOR 6)

### 🟠 MAJOR-A1 — FUZ-04 sentinel counter 가 dead canary (실 mutation 경로 0건)

- **파일**: `packages/formula-engine/src/__tests__/fuz-04-sandbox-bypass-12-vectors.test.ts:23-28, 65-78, 92-99`
- **이슈**: `__FUZ04_SENTINEL_COUNTER` 는 12 vectors 어디에서도 참조되지 않는다. 즉 `before === after` assertion 은 vector 가 거부되든, 실행되든, mutation 일으키든 **항상 통과**한다. "함수 실행 0건 검증" 의도와 실 메커니즘이 불일치.
- **올바른 sentinel 설계**: vector 가 실제로 호출하려는 위험 함수 (`Function`, `eval`, `setTimeout`, `Promise.resolve`) 를 globalThis 위에 monkey-patch 하여 호출 시 counter 를 증가시키는 stub 을 설치해야 함. 본 시점 mathjs validateNode 가 SymbolNode 단계에서 차단해 globalThis 까지 도달 불가하지만, **회귀 시 (예: ALLOWED_FUNCTIONS 에 `Function` 잘못 추가) 본 sentinel 이 fail-open** — 위험 함수 실행됐는데도 PASS.
- **위험도**: MAJOR — 보안 회귀 검출 메커니즘 무효화 (theatrical security).
- **수정 권고**:
  ```typescript
  // beforeEach
  const realFunction = globalThis.Function;
  globalThis.Function = function (...args: unknown[]) {
    globalThis.__FUZ04_SENTINEL_COUNTER += 1;
    return realFunction.apply(this, args);
  } as typeof globalThis.Function;
  // afterEach: restore
  ```
  또는 vector 별로 monkey-patch 한 위험 함수 호출 시 counter+1 검증으로 재설계.

### 🟠 MAJOR-A2 — engine.ts user-facing message 에 기술 details leak (ADR-029 §4.2 명시 부채)

- **파일**: `packages/formula-engine/src/engine.ts:69-74, 89-93`
- **이슈**: COMPUTE_TIMEOUT 매핑 시 `${e.message}` 가 user-facing message 에 직접 합성됨. 예: 산식 폭탄 시도 시 "농작물재해보험금 계산 차단: Expression too complex: 432 AST nodes (limit 200) (교재 p.123)" 가 사용자에게 노출.
- 추가로 details `[`kind=ast_too_complex`, `nodeCount=432`, `limit=200`]` 가 노출 — 공격자가 한도 정확값 (200) 을 admin-web 또는 클라이언트 응답에서 복원 가능 → AST 한도 우회 시도 정밀화.
- **위험도**: MAJOR — info disclosure (한도 정확값 + 알고리즘 내부 분류 노출).
- **참조**: ADR-029 §4.2 명시 — "user-facing message 와 details 분리" §5.4 commit 흡수 의무. 본 시점 미흡수 = ADR Decision Log 와 코드 불일치.
- **수정 권고**: user-facing 한국어 message 는 "복잡한 산식이라 계산할 수 없습니다 (교재 p.123 참고)" 류로 고정. `e.message` 는 server log 만, `details.kind` 는 admin-only telemetry 로 분리. 또는 `code='COMPUTE_TIMEOUT'` 만으로 클라이언트가 graceful UI 결정.

### 🟠 MAJOR-A3 — REC-02 silent pivot: file-level integrity 부재 (key reorder + whitespace 통과)

- **파일**: `apps/batch/__tests__/rec-02-checkpoint-tampering.test.ts:179-235` + `apps/batch/src/checkpoint.ts:200-204` (canonicalJson)
- **이슈**: 시나리오 3 (key reorder) + 시나리오 4 (공백) 가 의도된 통과 — canonical JSON sensitivity 만 보장. 그러나 공격자가 checkpoint 파일에 trailing whitespace + zero-width chars + JSON 주석 (단, JSON 표준 부합 must) 같은 metadata 채널을 삽입할 수 있다 (예: 추후 forensic 분석 방해, log poisoning). state_hash 가 canonical content 만 cover 하므로 raw file 외형은 자유 변형 가능.
- 추가 risk: writeCheckpoint 가 `JSON.stringify(cp, null, 2)` (canonical 아님) 으로 저장 (`apps/batch/src/checkpoint.ts:350`). 즉 raw 파일 ≠ canonical(parsed) — REC-02 옵션 B 가 아직 미적용.
- **위험도**: MAJOR — handoff-033 §3 "결정 옵션 A/B/C" 진산님 결정 선결.
- **수정 권고**: 옵션 B (writeCheckpoint canonical-only + raw == canonical(parsed) 검증) 또는 옵션 C (raw file SHA-256 별도 저장) 를 Sprint 2 초기에 결정. 현 시점은 시나리오 3/4 가 의도된 통과임을 명시 — 본 보고서가 그 보고 의무 흡수.

### 🟠 MAJOR-A4 — Pass 3 i18n 부재 (한국어 vs 영문 message 혼합) §5.3 이월

- **파일**: `packages/formula-engine/src/sandbox.ts:131-148, 188-220, 290-301, 400-410` (영문) + `packages/formula-engine/src/engine.ts:72, 91, 101, 104` (한국어 prefix)
- **이슈**: 사용자 노출 message 가 한국어 prefix + 영문 internal message 혼합 — 모바일 80% 사용자 환경에서 "농작물재해보험금 계산 차단: Expression too complex" 형태로 노출. ADR-029 §4.2 명시 — Sprint 1 §5.3 Pass 3 (CHA #8) 적발 후 "Phase 1 후반 i18n 일괄 도입" 이월.
- 추가로 `Disabled: import` / `Not allowed: setTimeout` 류 영문 SandboxViolationError message 가 ParseError 경유 클라이언트 전파될 가능성.
- **위험도**: MAJOR — 접근성/UX 부채 (mobile 80% 한국 수험생 환경).
- **수정 권고**: i18n key 도입 (`compute.timeout.too_complex` / `compute.timeout.too_deep` / `compute.timeout.eval_overrun`). Phase 1 후반 일괄 처리 + ADR-029 §4.2 Decision Log 진척 추적.

### 🟠 MAJOR-A5 — ESLint no-restricted-imports 우회 가능 vector 미차단

- **파일**: `.eslintrc.json:24-30`
- **이슈**: 패턴 `**/__tests__/helpers/**` / `**/__tests__/**` / `**/test-helpers/**` 만 차단. 다음 우회 vector 가 가능:
  1. **상대 경로 traversal**: `import x from '../../helpers/d1-from-sqlite'` (path 에 `__tests__` 가 없음 — 폴더 구조 변경 시 우회).
  2. **package.json export 경유**: `@thepick/shared/test-helpers/perf` 는 ESLint glob 이 패키지 spec 의 path segment 까지 매칭하므로 OK 이나, alias 경로 (`#test-helpers/perf` 같은 subpath imports) 는 미차단.
  3. ****mocks** / fixtures 외 명칭** (예: `helpers/`, `support/`, `_internal/`) 으로 rename 시 차단 우회.
  4. **dynamic import**: `await import('./helpers/foo')` 같은 동적 import 는 ESLint AST 매칭 누락 가능 (no-restricted-imports 는 정적만).
- **위험도**: MAJOR — ESLint rule 의 효과 범위 좁음. C-CODE-2 흡수 명목과 실 보호 영역 차이.
- **수정 권고**:
  1. `paths` (특정 모듈명) + `patterns` (glob) 양쪽 사용.
  2. eslint-plugin-import 의 `no-restricted-paths` 도입 (zone-based) — `apps/**/src/**` 에서 `**/__tests__/**` 절대 import 차단.
  3. 또는 build-time check (wrangler dist 분석으로 d1-disconnect-mock 포함 여부 검증) 추가.

### 🟠 MAJOR-A6 — PRF-02 N=10K p99 초과 시 silent warn (회귀 차단 부재)

- **파일**: `packages/quality/src/__tests__/prf-02-naive-vs-tarjan.test.ts:128-133`
- **이슈**: `if (result.p99Ms > 100) console.warn(...)` 만 실행 — assertion 없음. CI 에서 p99 100ms 초과해도 PASS. handoff-session-033 §3 "Tarjan 도입 트리거" 가 사람 손에만 의존.
- **위험도**: MAJOR — 성능 부채 silent fail-open. BATCH-1 적재 후 실 그래프 노드 수가 5K 초과 또는 알 수 없는 hot path 진입 시 본 회귀 감지 부재.
- **수정 권고**:
  ```typescript
  expect(result.p99Ms).toBeLessThan(100); // hard fail
  // 또는 testInfo.attach() 로 metric 영속 + CI threshold check
  ```
  또는 별도 trigger test 로 분리: "p99 > 100ms 발화 시 fail (Tarjan 도입 의무 발화)".

---

## 5. N/A 항목 (해당 없음 — 검증 완료)

### N/A-1 — Service Worker / 오프라인 캐싱 전략

본 8 commits 는 backend (formula-engine / batch / api scheduled) 한정. PWA Service Worker 영역 변경 없음.

### N/A-2 — 접근성 / 터치 타겟 / aria-label

본 8 commits 는 UI 레이어 변경 없음 (test 파일 + ESLint 설정 한정).

---

## 6. 반론 (Devil's Advocate — 깨질 수 있는 시나리오)

### 6.1 FUZ-04 sentinel 무효화 회귀 시나리오

ALLOWED_FUNCTIONS 에 실수로 `Function` 또는 `eval` 추가 (예: `'add'` 의 typo 로 `'Function'`) 시 sandbox.ts validateNode 통과 → 산식 평가 시 실 globalThis.Function 호출. **본 FUZ-04 test 는 sentinel counter 가 mutate 안되므로 PASS 보고**. 보안 회귀가 보안 테스트로 검출 안됨 — MAJOR-A1 시나리오 실증.

### 6.2 REC-02 옵션 B/C 미결 시 forensic 공격 가능성

공격자가 checkpoint 파일을 회수 (D1 export / 백업 디스크 access) → key reorder + 공백 padding 으로 외형 변형 → state_hash 동일 → forensic 분석 시 timestamp 기반 chain-of-custody 검증 불가능 (raw 파일 변형 흔적 보존 안됨). 옵션 C (raw SHA-256 별도) 미적용 시 chain-of-custody 단절.

### 6.3 engine.ts message leak 누적 정밀화

공격자가 변형 산식을 100건 던지며 응답 message 에서 `nodeCount=NN` 추출 → 정확 한도 (200) 역공학 → "AST 한도 우회 + wall-clock 한도 우회 (pow(2, 10000) 단일 노드)" 조합 공격 정밀화. MAJOR-A2 미흡수 시 한도 보안 정밀도 약화.

### 6.4 ESLint dynamic import 우회 시나리오

악의적 contributor 가 `apps/api/src/route.ts` 에 `await import('../__tests__/helpers/' + 'd1-disconnect-mock')` 추가 — string concat 이라 ESLint no-restricted-imports AST 매칭 누락 → wrangler bundle 포함 → production D1 시뮬 disconnect 활성화. MAJOR-A5 시나리오 실증.

### 6.5 PRF-02 silent warn → 사용자 영향

BATCH-1 적재 후 실 그래프 노드 수가 5K 초과 (예: 8K) → naive DFS p99 = 130ms → console.warn 만 발화 (PASS) → admin-web Cron stage 에서 Worker timeout 50ms 한도 초과 → batch fail-open (handoff-033 §3 보고 의무 누락). MAJOR-A6 시나리오 실증.

---

## 7. 판정 + 후속 조치

### 7.1 판정

**완료 가능 (CRITICAL 0건)** — Pass 3 ADVOCATE 관점에서 §5.4 8 commits 는 즉시 차단 사유 없음. 다만 MAJOR 6건은 §5.4 4-Pass 다른 Pass 결과와 dedupe 후 통합 인덱스에서 우선순위 결정 필요.

### 7.2 권고 후속 조치

1. **MAJOR-A1 (FUZ-04 sentinel)** — §5.4 종료 전 흡수 (보안 테스트 무효화 = 즉시 수정).
2. **MAJOR-A2 (engine.ts message leak)** — ADR-029 §4.2 명시 부채. §5.4 commit 흡수 의무.
3. **MAJOR-A3 (REC-02 옵션 결정)** — handoff-session-033 §3 진산님 결정 선결 (옵션 B 권고 — minimal change + raw 검증 즉시 추가 가능).
4. **MAJOR-A4 (i18n)** — Phase 1 후반 일괄 (Sprint 2 명시 이월).
5. **MAJOR-A5 (ESLint 우회)** — eslint-plugin-import 도입 + zone-based rule. §5.4 종료 전 또는 Sprint 2 초기.
6. **MAJOR-A6 (PRF-02 silent warn)** — `console.warn` → `expect().toBeLessThan()` 변환. §5.4 commit 즉시 흡수 가능.

### 7.3 dedupe 가능 항목 (다른 Pass 와 중복 가능)

- MAJOR-A2 (message leak) — Pass 1 SURGEON 도 e.message/details propagation 으로 발견 가능.
- MAJOR-A4 (i18n) — Pass 4 CONTRACT 가 ADR-029 §4.2 부채 미흡수로 동시 발견 가능.
- MAJOR-A5 (ESLint glob 좁음) — Pass 2 ARCHITECT 도 모듈 경계 위반 vector 로 동시 발견 가능.

---

## 8. 보고 형식 (auto-review-protocol §"보고 형식" 정합)

```
── 4-PASS REVIEW (Pass 3 / 4) ──────────────────
리뷰 방식: 독립 서브에이전트 (security-engineer)
리뷰 범위: 변경 파일 12개 + 연관 파일 5개

Pass 3 (Advocate): ✅ 9건 확인 / 🔴 0건 / 🟠 6건 / N/A 2건
확인 (증거 ≥ 3개):
  - sandbox.ts:175-223 — 12 vectors AST 단계 거부 메커니즘
  - sandbox.ts:265-281 — iterative DFS V8 stack overflow 보호
  - checkpoint.ts:478-487 + :447-451 — SHA-256 + JSON.parse 이중 무결성
  - cha-06-cron-24h-miss.test.ts:94-113 — GC idempotent
  - .eslintrc.json:21-31 — production import 차단 + grep 검증 0건
  - rec-01-kill-points-parametrized.test.ts:118-176 — 50회 결정성
  - sandbox.ts:254-255 — AST 한도 200/15 보수화 + 회귀 0건
  - cha-06 cutoff sanity 1440 보존
  - ADR-029 §2.4 — 한도 변경 4단계 절차

반론 (5종): FUZ-04 sentinel 회귀 / REC-02 forensic 공격 / engine.ts 한도 역공학 /
            ESLint dynamic import 우회 / PRF-02 silent warn

판정: 완료 가능 (CRITICAL 0건) — MAJOR 6건 §5.4 흡수 또는 명시 이월
────────────────────────────────────────────────
```

---

**보고서 작성**: Claude (Opus 4.7 1M context) — security-engineer 페르소나 / Pass 3 ADVOCATE
**다음 단계**: Pass 1/2/4 결과와 dedupe → 통합 인덱스 작성 → 흡수 commit / 이월 결정
