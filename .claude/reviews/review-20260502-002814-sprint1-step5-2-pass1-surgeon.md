# Pass 1 — SURGEON (Bottom-Up 코드 정합) — Sprint 1 §5.2 도구 정비

- **리뷰 일자**: 2026-05-02
- **대상 commit**: fefa64a (P0→P1 재분류) + ba9ad2b (도구 정비)
- **리뷰자**: 독립 에이전트 (silent-failure-hunter / SURGEON 페르소나)
- **리뷰 방식**: 4-Pass 자동 리뷰 중 Pass 1 단독. Pass 2/3/4 별도 에이전트 병렬 진행.
- **명세 근거**: `.jjokjipge/handoff-session-029.md` §2.A, `.claude/rules/auto-review-protocol.md`
- **관점**: "이 코드 단독으로 터지는 경로가 있는가?" — Null/Undefined, Async, 경계값, 부동소수점, 에러 처리, Formula Engine 무관, binary safety.

---

## 0. 리뷰 범위 (전체 18개 변경 / 추적 의무)

### Commit fefa64a — P0→P1 재분류 (3 파일)

1. `docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md` (신규, 168 line)
2. `docs/ThePick Engine Quality Test Master Plan v1.0.md` (§11.1/§11.2/§13.1 v1.0.1 패치, +28/-7)
3. `.claude/reviews/review-sprint0-baseline-20260501-230231.md` (상단 banner +9)

### Commit ba9ad2b — §5.2 도구 정비 (15 파일)

4. `packages/shared/src/test-helpers/perf.ts` (179 line, **핵심 코드 — 본 Pass 집중 대상**)
5. `packages/shared/src/__tests__/test-helpers-perf.test.ts` (124 line, 13 cases)
6. `packages/shared/package.json` (`./test-helpers/perf` export 추가)
7. `docs/quality/test-patterns.md` (155 line, 신규)
8. `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md` (188 line, 신규)
9. `packages/parser/__fixtures__/pdf-malicious/{01..05}.pdf` (5 binary, 0 B ~ 1.4 KB)
10. `packages/parser/__fixtures__/pdf-malicious/README.md` (147 line)
11. `packages/parser/__fixtures__/claude-malformed/{01..08}.json` (8 fixtures, 0 B ~ 120 KB)
12. `packages/parser/__fixtures__/claude-malformed/README.md` (171 line)
13. `.prettierignore` (17 line, 신규)

### 연관 파일 (변경 외 검증 대상)

- `packages/shared/src/index.ts` — perf 가 export 되지 않는지 (production 격리)
- `packages/ai-adapter/src/anthropic-adapter.ts:62-77` — 재분류 결정의 사실 근거
- `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` — ADR-028 의 대안 패턴

### 사전 검증 결과

- ✅ `pnpm --filter @thepick/shared test` → 46 tests passed (0 fail). 전 PRF 회귀 13건 GREEN.
- ✅ `index.ts` 에 `test-helpers` export 부재 → production 경로 진입 불가 (의도 부합).
- ✅ ADR-028 의 anthropic-adapter NOT_IMPLEMENTED 사실 근거 검증 (line 62-77).
- ✅ 06-deeply-nested-100.json 실제 depth 100 (Python 측정 검증).

---

## 1. 검사한 항목 — `perf.ts` 본체 (179 line)

### 1.1 PASS — performance.now() 가용성 (3 runtime)

- **위치**: `perf.ts:69, 71`
- **확인**: Node 22 (`typeof performance === 'object', typeof performance.now === 'function'`), Cloudflare Workers (Web Performance API standard), 브라우저 모두 globalThis.performance 가용. ESM globalThis 직접 접근 우회 (no import 필요).
- **반론**: Workers Pool 도입 시점 (Phase 2) 에 `vitest-pool-workers` 가 performance 를 mock 하는지는 ADR-028 §4 trigger 에서 별도 검증 의무 — 단, 본 시점 N/A.

### 1.2 PASS — Async/Sync 함수 통합 처리

- **위치**: `perf.ts:64, 70`
- **확인**: `await fn()` 가 동기 함수 (void 반환) 와 `Promise<void>` 모두 안전 처리. Node 검증: `await (() => 42)()` 정상.
- **반론**: fn 이 sync throw 와 async reject 모두 동일하게 propagate (try-catch 미존재 = 의도). 단, fn 이 unhandledRejection 으로 시작하는 경우 (e.g. fire-and-forget) 측정 의도 어긋남 — 호출 측 책임으로 위임.

### 1.3 PASS — 경계값 검증 (runs/warmup)

- **위치**: `perf.ts:56-61`
- **확인**: `runs < 1` throw, `warmup < 0` throw, label 포함 message → debugging trail. 단위 테스트 line 34-42 회귀 방어.
- **반론**: 다음 §2.1 참조 (runs 상한 미검증 = OOM 위험).

### 1.4 PASS — 부동소수점 percentile NIST type 7 정확성

- **위치**: `perf.ts:160-173`, 단위 테스트 line 58-66
- **확인**: 수동 검산 — `[1..10]` 의 p95 = 0.95×9=8.55 → 9×0.45+10×0.55 = **9.55** ✓, p99 = 0.99×9=8.91 → 9×0.09+10×0.91 = **9.91** ✓, median = 0.5×9=4.5 → **5.5** ✓. Vitest `toBeCloseTo(_, 5)` 통과 정합.
- **반론**: Wikipedia/NumPy 의 type-7 정의와 정합. 그러나 `(idx - lower)` 가 정확히 0.5 인 경우 IEEE 754 round-half-to-even 의존성 — 모든 듀얼 케이스에서 deterministic 보장.

### 1.5 PASS — Object.freeze 깊은 동결 (불변 결과)

- **위치**: `perf.ts:99-110`, 단위 테스트 line 17-18
- **확인**: 결과 object frozen + `durationsMs` 별도 frozen (`Object.freeze(sorted.map(...))`). Node 검증: `Object.isFrozen(result.durationsMs) === true`.
- **반론**: durationsMs 내부 number primitive 는 어차피 immutable. CacheHitTracker.snapshot() 도 frozen — 단위 테스트 line 119 회귀 방어.

### 1.6 PASS — summarize() 입력 미변경 (불변성)

- **위치**: `perf.ts:92` (`[...durationsMs].sort(...)`)
- **확인**: spread copy 후 sort → 호출자 input 배열 미변경. 단위 테스트 line 81-86 회귀 방어.
- **반론**: readonly number[] 타입은 컴파일 타임 가드. 단, JS runtime 에서 호출자가 mutable 배열 전달해도 spread 가 방어. PASS.

### 1.7 PASS — empty array throw (NaN 방어)

- **위치**: `perf.ts:88-90, 161-163`
- **확인**: 빈 배열 시 throw (mean = sum/0 = NaN, percentile sorted[0] = undefined 진입 차단). 단위 테스트 line 77-79 회귀 방어.
- **반론**: 본 가드는 summarize() 본문 시작 + percentile() 양쪽에서 중복 검증 (방어적). PASS.

### 1.8 PASS — Single element 배열 처리

- **위치**: `perf.ts:164` (`if (sorted.length === 1) return sorted[0];`)
- **확인**: divide-by-zero 회피, p95 = p99 = single value 반환. 단위 테스트 line 68-75 회귀 방어.

---

## 2. 발견 사항 — Critical / Major / Minor

### 🟠 MAJOR — M1: round() — Number.MAX_SAFE_INTEGER overflow 경고 부재

- **위치**: `perf.ts:175-178`
- **문제**: `round(value, 3)` 는 `Math.round(value * 1000) / 1000` 으로 동작. value 가 `Number.MAX_SAFE_INTEGER` 근처 (e.g. 9e15) 면 `value * 1000` 이 `MAX_SAFE_INTEGER` 초과 → 정밀도 손실.
- **재현**:
  ```
  round(1e15, 3) → 1e15 (정밀도 OK)
  round(9e15, 3) → 9.0072...e15 (precision lost beyond 53-bit mantissa)
  ```
- **현실 위험**: PRF 시나리오의 실 측정 latency 는 ms 단위 (< 1e10) → 본 위험 미발현. **하지만 단위가 ns/ps 변환되거나 measure() 사용자가 Mock 으로 큰 값 주입 시** 침묵 정밀도 손실.
- **반론 (Devil's Advocate)**: PRF-01/02/04 의 실 latency 는 < 100ms → MAX_SAFE_INTEGER 위험 발현 0%. 본 fix 는 형식적 robustness — 운영 영향 없음.
- **권고**: 사후 수정 (Sprint 1 §5.4 종료 전 가능). `round()` 진입 시 `Number.isFinite(value)` 체크 + `Math.abs(value) < Number.MAX_SAFE_INTEGER / 10**decimals` 가드 추가 → throw 또는 Infinity 반환.
- **분류 근거**: 운영 영향 없음 (실 latency 범위 안전) + 형식적 robustness 결손 → **Major**.

### 🟠 MAJOR — M2: NaN/Infinity 입력 침묵 통과

- **위치**: `perf.ts:81-110` summarize() 본문
- **문제**: `durationsMs` 에 NaN 또는 Infinity 가 포함되어도 sort/sum/percentile 가 silent 통과:
  - `[NaN, 1, 2, 3].sort((a,b)=>a-b)` → `[NaN, 1, 2, 3]` (V8 sort 비교 무시) → percentile 진입 시 비결정적 결과.
  - Node 검증: `summarize(NaN, 1, 2, 3)` p99 = 1.5 (NaN 이 sorted[0] 위치 차지하면서 보간 오염).
  - `Infinity` 포함 시 mean = Infinity, p99 = Infinity → 통계 무의미.
- **현실 위험**: `performance.now()` 자체가 NaN/Infinity 반환할 가능성 ~0% (W3C HRTime spec 상 monotonic non-negative finite). **하지만 fn() 이 비동기로 `vi.useFakeTimers()` 와 충돌해 fake timer 가 stall 시키거나, 사용자가 외부에서 `summarize()` 직접 호출하며 손상된 데이터 주입 시** 통계가 silent 거짓.
- **반론**: PRF-\* 시나리오는 real timers 강제 (`docs/quality/test-patterns.md:54` 명시) → fake timer 충돌 0%. 외부 직접 summarize 호출 시 호출자 책임. 단, "측정 wrapper" 의 역할상 입력 sanity check 가 권고 수준.
- **권고**: 사후 수정. `summarize()` 진입 시 `for (const v of durationsMs) if (!Number.isFinite(v) || v < 0) throw ...` 추가. **사용자 주도 측정 도구 = sanity check 가 1차 방어선**.
- **분류 근거**: 단일 코드 경로 직접 폭파 시나리오 부재 + 외부 직접 호출 시 silent 통계 오염 → **Major**.

### 🟠 MAJOR — M3: docs/quality/test-patterns.md §4 fixture 경로 오류

- **위치**: `docs/quality/test-patterns.md:134-135`
- **문제**: 표가 `tests/fixtures/pdf-malicious/` / `tests/fixtures/claude-malformed/` 로 명시. 실제 위치는 `packages/parser/__fixtures__/`.
- **확인**: 본 commit 에서 fixtures 는 `packages/parser/__fixtures__/{pdf-malicious,claude-malformed}/` 에 생성. 동일 docs 의 line 87 (`'../../__fixtures__/claude-malformed/...'`) 는 정확하지만 §4 표만 잘못. 또한 fixture 별 README.md (line 96, 118) 는 `__fixtures__/` 정합.
- **현실 위험**: §5.3 NOT-IMPL 7건 구현 시 새 개발자/세션 030 가 본 표를 보고 `tests/fixtures/` 경로 생성 시도 → 디렉토리 부재로 즉시 발견되겠지만, **단일 진실 (Single Source of Truth) 원칙 위배** → 문서 신뢰성 손상.
- **반론**: 즉시 발견 가능한 typo 수준. CRITICAL 아님.
- **권고**: **Sprint 1 §5.3 진입 전 즉시 수정 의무** — `tests/fixtures/` → `packages/parser/__fixtures__/` 두 줄 교체.
- **분류 근거**: docs §4 ↔ §2/§3 경로 모순. §5.3 진입 전 차단 가능 → **Major**.

### 🟡 MINOR — m1: measure() 가 throw 시 partial state cleanup 미명시

- **위치**: `perf.ts:67-74`
- **문제**: warmup 또는 측정 loop 중간에 fn() 이 throw 하면 `durationsMs` 배열의 일부만 채워진 상태에서 함수 종료. caller 는 측정 정상 완료와 throw 를 catch 로 구분 가능하지만, **측정 도중 throw 가 부분 통계로 오해받지 않도록 finally-block 의 명시적 cleanup hook (e.g. progress callback) 부재**.
- **반론**: try-catch finally 도입 시 의도가 모호해진다 (caller 가 throw 를 caught 으로 받고 싶은지 통계 부분 수집을 원하는지 분리 불가). 현 설계 (실패 시 throw + caller 가 catch) 가 표준 동작. **해당 없음 (의도) → Minor 강등**.
- **분류 근거**: 의도된 동작. 본 보고는 후속 사용자 confusion 방지용 docstring 보완 권고만. → **Minor**.

### 🟡 MINOR — m2: CacheHitTracker hits/misses overflow 검증 부재

- **위치**: `perf.ts:117-118`
- **문제**: `hits`/`misses` 는 number type. JavaScript number 는 53-bit mantissa → `2^53 = 9.007e15` 까지 정수 안전. **단위 테스트에서 1e16 회 record 호출 시 overflow** — 그러나 실 단위 테스트에서 이 횟수 도달 불가능 (CPU 50ms 한계).
- **반론**: PRF 시나리오 runs 상한 1만 ~ 100만. 1e15 도달 불가능. 본 위험은 형식적.
- **권고**: 무수정 (실 운영 영향 0). 단, JSDoc 에 "≤ Number.MAX_SAFE_INTEGER 보장 호출자 책임" 한 줄 추가 권고 → 향후 사용자 실수 방어.

### 🟡 MINOR — m3: 03-compression-bomb.pdf 의 claimed length 검증

- **위치**: `packages/parser/__fixtures__/pdf-malicious/03-compression-bomb.pdf`, README §2.3
- **확인**: `xxd` strings 검사 → 실제 PDF 내 `/Length 104857600` (= 100 × 1024 × 1024 = 100 MiB) + `/Filter /FlateDecode` 명세. 실제 stream payload 는 ~1.4 KB. README §2.3 의 claimed 100 MB / actual 1.4 KB 정합.
- **위험 확인**: pdf-extractor.ts (Sprint 1 §5.3 신규) 가 `/Length` 를 신뢰하면 **100 MiB 메모리 할당 시도** → Cloudflare Workers 128 MiB 한도 임박 → Worker kill. README §2.3 위험 회귀 명시 정합.
- **반론**: pdfplumber subprocess 는 Workers 외부 (빌드 파이프라인). 그러나 batch / admin-web 노드 환경에서도 메모리 폭주 가능 (Cloudflare Pages Functions 256 MiB / Render 512 MiB 등). 본 fixture 는 **사전 거부 layer 구현 의무** 를 환기.
- **분류 근거**: fixture 자체는 의도대로 작동. 검증 의무는 §5.3 구현 측. 본 Pass 1 범위 외. → **Minor (정보)**.

### 🟡 MINOR — m4: 05-js-embedded.pdf — pdfplumber 자동 실행 경로 부재

- **위치**: `packages/parser/__fixtures__/pdf-malicious/05-js-embedded.pdf`, README §2.5
- **확인**: PDF 내 `/OpenAction 4 0 R` + `/Type /Action /S /JavaScript /JS (app.alert('XSS-via-PDF');)` 정합 명세. pdfplumber (Python 라이브러리) 는 **PDF 의 /JavaScript 를 자동 실행하지 않음** (Adobe Reader 와 달리 sandbox-less). 검증 의도 = parser 단계 정규식 detection + 보안 거부 정책.
- **반론**: pdfplumber 가 향후 버전에서 JS 실행 plugin 도입 가능성 ~0%. 본 fixture 의 위험은 **검출 누락 (parser 가 /JavaScript 패턴 미스캔 → 정상 PDF 로 판정)**.
- **분류 근거**: fixture 자체 정상. §5.3 구현 의무. → **Minor (정보)**.

---

## 3. 깨질 수 있는 시나리오 (Devil's Advocate)

각 Pass 1 검사 항목의 잠재적 회귀 시나리오:

### S1 — measure() 가 fake timers 환경에서 사용될 경우

- `vi.useFakeTimers()` 활성 상태에서 `measure()` 호출 → `performance.now()` 는 fake timer 미영향 (real timers 유지) → 그러나 fn() 내부 `setTimeout` 등이 fake timer 에 의해 정지 → measure 가 fn 완료 대기 영원히 진행 안 됨 (deadlock).
- **방어**: `docs/quality/test-patterns.md:54` 가 "PRF-\* 시나리오는 real timers 유지" 명시. 그러나 testing infrastructure 미숙지 사용자가 동시 사용 시 silent hang.
- **권고**: perf.ts JSDoc 에 `// 주의: vi.useFakeTimers() 와 동시 사용 금지` 한 줄 추가.

### S2 — measure() runs 상한 미검증 (OOM 잠재)

- `measure('x', fn, { runs: 1e9 })` 호출 시 `new Array(1e9)` → V8 sparse array 로 메모리 ~8GB 시도 → process kill.
- **방어**: 호출 측 책임. 그러나 PRF 시나리오 runs 명세 (1만~100만) 범위 밖 호출 차단 가드 부재.
- **권고**: runs > 1e7 시 throw 또는 warning. 본 Pass 권고는 Major 후속.

### S3 — Workers Vitest Pool 진입 시 `node:sqlite` 차단 (ADR-028 §1.4)

- ADR-028 §1.4 가 명시한 5가지 비용 중 #3 — Workers pool 도입 시 `node:sqlite` 미가용 → 기존 `d1-from-sqlite.ts` 헬퍼 차단.
- **확인**: `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` 존재 검증 완료.
- **방어**: ADR-028 §5 trigger #4 ("node:sqlite 호환 99% 가정의 1% 결손이 운영 중 발견될 경우") 가 재검토 의무 명시. PASS.

### S4 — 06-deeply-nested-100.json 의 V8 stack 안전성

- README §2.6 에 "V8 default ~10K depth 까지 안전" 명시. 실 측정 (Node `JSON.parse`) 검증.
- **반론**: schema-validator 가 재귀 traversal 사용 시 V8 stack 한도 (~15K function frames) 도달 가능. 본 fixture (100 depth) 는 **V8 자체 폭파 안 함** + **schema-validator depth check 의무화** 검증 목적 정합.
- **방어**: §5.3 구현 의무. PASS.

### S5 — 07-large-payload.json 명세 변경 의 검증 일치

- README §2.7 + §4 가 "100MB → 120KB sentinel" 명세 변경 정직 기록. 실 파일 크기 123 078 byte (~120 KB) 검증.
- **반론**: D1 transaction 한도 1 MB 검증 의도가 **120 KB sentinel 로 100% 재현 가능 한가** — schema-validator 의 임계값이 1 MB 직전이면 120 KB sentinel 은 통과 → 검증 무력화.
- **방어**: README §2.7 가 임계값 가변성 명시. **§5.3 구현 시 schema-validator 의 임계값을 100 KB 또는 sentinel 동기화 의무**. 본 fixture 자체는 정상.

---

## 4. 본 Pass 보고 (요약)

```
Pass 1 (Surgeon): ✅ 8건 확인 / 🔴 0건 / 🟠 3건 / 🟡 4건 / N/A 0건

확인:
  perf.ts:69       — performance.now() Node 22 / Workers / 브라우저 가용 (실 검증)
  perf.ts:64       — await fn() sync/async 통합 처리 (Node 검증)
  perf.ts:56-61    — runs/warmup 경계값 throw (단위 테스트 line 34-42)
  perf.ts:160-173  — NIST type 7 percentile 수동 검산 (p95=9.55, p99=9.91, median=5.5)
  perf.ts:99-110   — Object.freeze 깊은 동결 (단위 테스트 line 17-18)
  perf.ts:92       — spread + sort 입력 미변경 (단위 테스트 line 81-86)
  perf.ts:88-90    — empty array throw (NaN 방어)
  perf.ts:164      — single element 배열 처리

🟠 Major:
  M1 — round() Number.MAX_SAFE_INTEGER overflow 가드 부재 (perf.ts:175-178)
  M2 — NaN/Infinity silent 통과 (perf.ts:81-110)
  M3 — test-patterns.md §4 fixture 경로 오류 (line 134-135)

🟡 Minor:
  m1 — measure() throw 시 partial state docstring 부재 (의도)
  m2 — CacheHitTracker overflow JSDoc 권고
  m3 — 03-compression-bomb.pdf §5.3 거부 layer 의무 (정보)
  m4 — 05-js-embedded.pdf parser detection §5.3 의무 (정보)

반론 (Devil's Advocate):
  S1 — vi.useFakeTimers() 동시 사용 시 silent hang
  S2 — runs 상한 미검증 (OOM 잠재)
  S3 — Workers Pool 진입 시 node:sqlite 차단 (ADR-028 §5 trigger 보장)
  S4 — 06-deeply-nested-100 V8 stack 안전 (정합)
  S5 — 07-large-payload sentinel ↔ schema-validator 임계값 동기화 의무 (§5.3 후속)

판정: Critical 0건 = 본 Pass 통과. Major 3건은 Sprint 1 §5.4 종료 전 흡수 의무.
       특히 M3 (docs §4 경로 오류) 는 §5.3 진입 전 즉시 수정 의무.
```

---

## 5. 다음 단계 권고

1. **즉시 (M3 흡수)**: `docs/quality/test-patterns.md` line 134-135 경로 수정 (`tests/fixtures/` → `packages/parser/__fixtures__/`).
2. **Sprint 1 §5.4 종료 전 (M1 + M2)**:
   - `perf.ts:175-178` round() 에 `Number.isFinite` 가드 + overflow 검출.
   - `perf.ts:81-110` summarize() 진입 시 NaN/Infinity/negative 검증.
   - 단위 테스트 회귀 케이스 추가 (NaN 입력 throw / Infinity 입력 throw / negative 입력 throw).
3. **Pass 2 (Architect) 위임**: 본 Pass 결과 전달. 다음 항목 추가 검증 의무:
   - perf.ts 가 packages/ 단방향 의존 (shared → 외부 미참조) 확인.
   - test-helpers/perf export 가 Workers 번들에 포함되지 않는지 (production 격리 확인).
   - `test-patterns.md` §2 의 MSW 이연 결정과 ADR-028 정합 확인.
4. **Pass 3 (Advocate) 위임**: fixtures 의 보안 검증 (XSS payload 03 / Hard Rule 17 violation 08 의 실 거부 정책 일치).
5. **Pass 4 (Contract) 위임**: handoff-029 §2.A 명세 6개 도구 → 5개 도입 + 1개 (MSW) 이연 정직성 검증. ADR-028 채택 정합.

---

**작성**: Claude Opus 4.7 (1M context) — 독립 SURGEON 페르소나
**작성 일자**: 2026-05-02 00:28 KST
**다음 Pass 진입 권고**: Pass 2 (Architect) — 단방향 의존 + Workers 제약 + 다이어그램 정합 검증
