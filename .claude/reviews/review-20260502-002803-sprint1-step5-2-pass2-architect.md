# Pass 2 (ARCHITECT) — Sprint 1 §5.2 Day 1 도구 정비

> 4-Pass 자동 리뷰 / 독립 에이전트 방식 — Pass 2 (Top-Down 연계 검증) 단독 보고서.
> Sprint 1 §5.2 commit 2건 (`fefa64a` P0→P1 재분류 / `ba9ad2b` perf wrapper + fixtures + ADR-028) 의 모듈 통합 위험을 다룬다.
> Pass 1/3/4 는 별도 에이전트 산출물.

- **리뷰 일시:** 2026-05-02 00:28:03 KST
- **리뷰어:** Claude (Opus 4.7 1M context) — 독립 system-architect 에이전트
- **리뷰 방식:** 독립 에이전트 (코드 작성 컨텍스트 분리됨) — auto-review-protocol 규칙 0 정합
- **리뷰 범위:** 변경 파일 21개 + 연관 파일 7개 (목록 §0)

---

## 0. 리뷰 범위

### 변경 파일 (21건)

**Commit fefa64a (P0→P1 재분류 — 문서 3건):**

1. `docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md`
2. `docs/ThePick Engine Quality Test Master Plan v1.0.md` (§11.1 / §11.2 / §13.1 v1.0.1 패치)
3. `.claude/reviews/review-sprint0-baseline-20260501-230231.md` (banner)

**Commit ba9ad2b (도구 정비 — 18건):**

4. `packages/shared/src/test-helpers/perf.ts` (신규, 178 LOC, 핵심)
5. `packages/shared/src/__tests__/test-helpers-perf.test.ts` (신규, 124 LOC, 13 PASS)
6. `packages/shared/package.json` (`./test-helpers/perf` exports 추가)
7. `docs/quality/test-patterns.md` (신규)
8. `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md` (신규)
9. `.prettierignore` (신규)
10. `packages/parser/__fixtures__/pdf-malicious/01~05.pdf` × 5 + `README.md`
11. `packages/parser/__fixtures__/claude-malformed/01~08.json` × 8 + `README.md`

### 연관 파일 (Pass 2 영향권 — 변경 없음, 정합 검증 대상)

1. `packages/shared/src/index.ts` (test-helpers re-export 부재 검증)
2. `tsconfig.base.json` (paths 매핑이 exports 와 충돌하는지 검증)
3. `apps/api/wrangler.toml` (Workers 빌드 → shared 번들 진입점)
4. `apps/api/src/index.ts` 외 5종 (`@thepick/shared` import — 모두 barrel)
5. `packages/shared/src/constants/exam-ids.ts` (Hard Rule 17 단일 선언처)
6. `packages/parser/src/__tests__/determinism.property.test.ts` (기존 fixture 패턴 비교)
7. `packages/parser-1st-exam/package.json` (parser fixture 경로 의존성 평가)

---

## 1. 점검 항목별 결과

### 1.A Import 방향성 — `@thepick/shared/test-helpers/perf` 격리

**확인:**

- `packages/shared/src/index.ts:1-9` — barrel 9 export 중 `test-helpers/*` 부재. 정합 ✅
- `packages/shared/package.json:8-13` — exports 4종 (`.`, `./errors`, `./types`, `./test-helpers/perf`). `./test-helpers/perf` 만 sub-path 별도 진입점. 정합 ✅
- `apps/api/src/**/*.ts` (production 9 import) 전수 검사 — 모두 barrel `from '@thepick/shared'` 진입. `test-helpers` 진입 0건. 정합 ✅
- `packages/{parser, parser-1st-exam, quality, formula-engine, payment, ai-adapter, payment}/**/*.ts` — `test-helpers` 진입 0건. 정합 ✅
- `packages/shared/src/__tests__/test-helpers-perf.test.ts:3` — relative import `'../test-helpers/perf.js'` 만 사용. 정합 ✅

**판정:** ✅ PASS (5건 증거).

**🟠 MAJOR-A1 — tsconfig path mapping 이 exports 격리를 우회**

- 위치: `tsconfig.base.json:24-31`
- 증거:
  ```json
  "paths": {
    "@thepick/shared": ["packages/shared/src"]
  }
  ```
- 문제: TypeScript 타입 해석은 package.json `exports` 가 아닌 path mapping 을 우선. 따라서 누군가가 production 코드(`apps/api/src/foo.ts`)에서
  ```typescript
  import { measure } from '@thepick/shared/test-helpers/perf';
  ```
  를 작성해도 **컴파일러 차원 차단 부재**. path 매핑은 `@thepick/shared` 만 정의되어 있으나, sub-path resolver 로 `packages/shared/src/test-helpers/perf` 가 실제 파일이라 Node ESM resolver fallback 도 가능. ESLint `no-restricted-imports` 규칙 미설정.
- 효과: production 번들에 `performance.now()` 측정 wrapper 178 LOC 가 포함될 위험. Workers 50ms CPU 한도 정합에 영향 미미하나, "test-only 의무 (perf.ts:7)" JSDoc 선언이 type-checker 강제력 부재.
- 권고: ESLint 규칙 `no-restricted-imports` 에 `'@thepick/shared/test-helpers/*'` 를 production 경로 (`apps/*/src/!(__tests__)/**`, `packages/!(*shared)/src/!(__tests__)/**`) 에서만 차단. 또는 `tsconfig.base.json` 에 `"@thepick/shared/test-helpers/*": ["packages/shared/src/test-helpers/*"]` path 명시 후 production tsconfig 의 `exclude` 로 차단.

**반론 (Devil's Advocate):**

> "barrel 에 안 넣었으니 안전하다" — 거짓. 본 monorepo 의 path mapping 은 sub-path 를 차단하지 않으며, `@thepick/shared/test-helpers/perf` 는 실제 파일 경로 정합으로 import 성공. 실수로 production 코드에 들어가면 빌드 실패 0건 / 런타임 동작 0건 / 번들에 포함 1건 = silent dead code.

---

### 1.B Workers 호환성 — `performance.now()` + tree-shaking

**확인:**

- `packages/shared/src/test-helpers/perf.ts:69, 71` — `performance.now()` 직접 호출. Node 22 (`apps/api/src/__tests__/scenarios.test.ts:712 외 6 use`) / Cloudflare Workers (Vol VI defaults) / 모던 브라우저 모두 globalThis `performance` 표준 지원. 정합 ✅
- Workers 호환 검증: `apps/api/wrangler.toml:5` — `compatibility_date = "2026-04-01"`, `compatibility_flags = ["nodejs_compat"]`. Workers `performance.now()` 는 compatibility flag 없이도 native 지원 (W3C HRT 2). 정합 ✅
- test-helpers/perf.ts 의 ES module export 는 named export 4건 (measure / summarize / CacheHitTracker / 타입). class `CacheHitTracker` 는 side-effect-free (생성자 + 필드 초기화만). tree-shaking 가능. 정합 ✅
- index.ts 가 test-helpers 를 re-export 안 함 → Workers 빌드 시 esbuild/wrangler 가 perf.ts 진입점 미생성 → 번들 0 byte. 정합 ✅

**판정:** ✅ PASS (4건 증거).

**🟢 MINOR-B1 — `performance` 글로벌 직접 참조의 type narrowing**

- 위치: `packages/shared/src/test-helpers/perf.ts:69`
- 증거: `const start = performance.now()`. `performance` 는 `lib.dom.d.ts` 또는 `@cloudflare/workers-types` 로부터 ambient. shared package `tsconfig.json` 은 `lib: ["ES2022"]` 만 (DOM 미포함, workers-types devDep 미포함).
- 효과: 현재 vitest 기반 테스트에서 `@types/node` 가 `performance` 를 globalThis 로 expose 하므로 컴파일/실행 PASS. 그러나 shared package 가 향후 Workers 빌드에서 단독 typecheck 될 경우 (예: CI 단계 분리), `performance` 미정의 에러 가능.
- 권고: 치명적 위험 아님. shared/tsconfig.json `types` 에 `["node"]` 명시하거나, perf.ts 상단에 `/// <reference types="node" />` 추가. 또는 `globalThis.performance.now()` 명시.

**반론 (Devil's Advocate):**

> "tree-shaking 이 100% 보장된다" — 거짓. Wrangler/esbuild 의 tree-shaking 은 sub-path import 미사용 + barrel 미진입 시 안전하나, 향후 누군가가 `import * as shared from '@thepick/shared'` (Hard Rule 미언급, 차단 부재) 형태로 import 하면 entry 분석이 약화될 수 있다. 현 시점 그런 사용 부재 (검증) 하나, ESLint `no-restricted-syntax` 로 `import *` 차단 미설정.

---

### 1.C 타입 정합 — `MeasureResult` / `MeasureOptions` / `CacheHitTracker` 외부 노출

**확인:**

- `MeasureResult` (perf.ts:11-22) 11 필드 모두 `readonly` + `durationsMs: readonly number[]`. `Object.freeze` (perf.ts:99) 런타임 freeze 까지 강제. 정합 ✅
- `MeasureOptions` (perf.ts:24-28) 3 필드 모두 `readonly` optional. 호출 측 partial config 정합. ✅
- `CacheHitTracker.snapshot()` (perf.ts:142-154) `Object.freeze` 강제 + readonly 4 필드 반환. 외부 mutation 차단. ✅
- 타입 export 가 `package.json`의 `exports` field에서 `./test-helpers/perf` 진입점만 expose. 다른 sub-path 미존재 (예: `./test-helpers/index` 부재). 정합 ✅
- Drizzle / Zod / Hono 등 외부 라이브러리 타입과 충돌 0건 (test-only 격리). ✅

**판정:** ✅ PASS (4건 증거).

**🟢 MINOR-C1 — `summarize()` 의 `runs` / `warmup` 인자가 결과 메타데이터일 뿐 검증 안 됨**

- 위치: `packages/shared/src/test-helpers/perf.ts:81-87`
- 증거: `summarize(label, durationsMs, runs, warmup, precision)` — `runs` 와 `durationsMs.length` 가 일치하는지 검증 없음. `summarize('static', [1,2,3,4,5,6,7,8,9,10], 999, 0)` 호출 가능.
- 효과: 외부에서 `summarize()` 직접 호출 시 (예: 사용자 정의 측정 후 가공) `runs` 메타데이터가 거짓일 수 있음 — 본 테스트 `test-helpers-perf.test.ts:59` 도 의도적으로 `10, 0` 으로 정합 호출 중이나, 향후 호출 측 실수 시 silent inconsistency.
- 권고: 치명적 아님. `runs !== durationsMs.length` 시 throw or warn 추가 가능. 또는 JSDoc 에 "caller 책임" 명시.

---

### 1.D Hard Rules 정합 (production-quality.md §"멀티시험 격리")

**확인:**

- **Rule 15** (범용 계층 시험 특화 분기 0건):
  - `packages/shared/src/test-helpers/perf.ts` 전수 검사 — `examId` / `'son-hae-pyeong-ga-sa'` / `INSURANCE` / `CROP` 0건. 순수 측정 유틸. 정합 ✅
- **Rule 16** (데이터 조회 경계):
  - perf.ts 는 D1 / Vectorize 조회 함수 0건. 적용 대상 N/A.
- **Rule 17** (exam_id literal 단일 선언):
  - `packages/shared/src/constants/exam-ids.ts:16` — 단일 선언처 정합.
  - `packages/parser/__fixtures__/claude-malformed/08-hard-rule-17-violation.json:7` — `'son-hae-pyeong-ga-sa'` literal 의도적 포함. **Rule 17 의 "테스트 픽스처 파일(`*.test.ts`, `*.fixture.ts`) 내 예시 데이터" 예외에 부합?** — `__fixtures__/*.json` 파일은 production-quality.md Rule 17 의 예외 nameset (`*.test.ts`, `*.fixture.ts`) 와 정확히 매칭되지 않음.
- **Rule 17 위반 검증 (FUZ-02 의도)**:
  - claude-malformed/README.md §1 + §2.8 — schema-validator 가 응답 content 의 examId literal 을 거부하는 것이 본 fixture 의 검증 대상. 즉 fixture 자체가 위반 vector → schema-validator 차단 검증.
  - 의도 자체는 Rule 17 강화 (run-time defense in depth) 정합. ✅

**판정:** ✅ PASS Rule 15 / N/A Rule 16 / 🟠 MAJOR Rule 17 정의 모호.

**🟠 MAJOR-D1 — Rule 17 의 "테스트 픽스처" 예외 정의가 `__fixtures__/*.json` 을 명시 미포함**

- 위치: `.claude/rules/production-quality.md` Rule 17 §"런타임 리터럴" 의 예외 5번 — `테스트 픽스처 파일(*.test.ts, *.fixture.ts) 내 예시 데이터`
- 증거: `packages/parser/__fixtures__/claude-malformed/08-hard-rule-17-violation.json:7` 의 literal `'son-hae-pyeong-ga-sa'` 는 본 예외 nameset 에 직접 매칭 안 됨 (확장자가 `.json`, 파일명이 `*.fixture.*` 아님).
- 효과:
  1. 향후 ESLint `no-restricted-syntax` 규칙 (Rule 17 §"검증 방법" 예고) 활성화 시 — `Literal[value='son-hae-pyeong-ga-sa']` AST 패턴은 JSON 파일에 적용 안 되므로 (ESLint default JSON 미파싱) 자연 제외 가능. 그러나 향후 ESLint 의 JSON parser plugin (`eslint-plugin-jsonc` 등) 도입 시 차단 위험.
  2. 정책 인터프리테이션 모호 — 다른 Claude 세션에서 본 fixture 보고 "Rule 17 위반" 으로 잘못 판정 후 fixture 삭제 시 FUZ-02 검증 자체 무력화.
- 권고: `production-quality.md` Rule 17 의 예외 5번을 다음으로 수정 — `테스트 픽스처 파일 또는 디렉토리(*.test.ts, *.fixture.ts, __fixtures__/**) 내 예시 데이터`. 또는 `claude-malformed/README.md §4` 한계 섹션에 본 예외 정합 명시 (현재 §4 는 "fixture #4 명세 변경" 등 다른 한계만 기록). 본 fixture 작성 시점에 정직 기록 정합한 처사이나, 차후 Rule 17 enforcement 시점 충돌 가능.

**🟢 MINOR-D2 — `08-hard-rule-17-violation.json` content 의 literal 형식이 schema-validator 검증 패턴과 일치 검증 미수**

- 증거: fixture content `"이 응답은 exam_id='son-hae-pyeong-ga-sa' 를 직접 인용한다"` — 한국어 + 작은따옴표. schema-validator 의 sanitization 정규식이 `'son-hae-pyeong-ga-sa'` 를 잡으려면 quote 종류 (single/double/backtick) 와 무관하게 substring 매칭 필요. README.md §2.8 "예상 동작" 은 정규식 매칭 명시하나 구체 패턴 미명세.
- 효과: §5.3 schema-validator 구현 시점에 정규식 작성자가 본 fixture 의 quote 형식만 보고 빠른 매칭 작성 → 다른 quote 형식 (double quote / template literal) 우회 가능. 본 fixture 단독으로는 false positive 우려.
- 권고: §5.3 구현 시점에 `09-hard-rule-17-double-quote.json` 등 변형 추가 또는 본 fixture 에 quote 변형 다중 포함. 본 commit scope 외 후속 작업 의무로 README 에 추가 가능.

---

### 1.E ADR-028 결정 정합 — ADR-006/022/027 + decision-2026-05-02 모순 검증

**확인:**

- **ADR-006/022 (Cloudflare 단일 벤더)**: ADR-028 §1.4 "신규 의존성 0건 = §5.3 NOT-IMPL 7건 작업 차단 0건" / §3 옵션 A 기각 사유 "3 packages 추가" — 단일 벤더 정합 위반 vs Cloudflare 공식 도구 (`@cloudflare/vitest-pool-workers`) 도입 trade-off 정직. ADR-006 위반 0건 (도입을 보류한 결정). 정합 ✅
- **ADR-027 (BATCH atomic Year 2 이연)**: ADR-028 §1.2 의 "현 시점 테스트 인프라" 명세는 Phase 1 BATCH-1 직전 시점 한정. ADR-027 의 BATCH atomic 정합 영향 없음 (ADR-028 은 테스트 인프라 단독). ✅
- **decision-2026-05-02 (CHA-03/05 P1 재분류)**: ADR-028 §1.3 "→ CHA-05 P1 재분류로 본 ADR 의 시급성 1/2 으로 감소" 명시 인용. §5 재검토 트리거 #3 "CHA-05 본격 측정 = P1 재분류된 CHA-05 의 P1 게이트 측정 의무 시점" — decision 의 §5.3 (Phase 2 진입 직전 의무) 와 정합. ✅
- **재검토 트리거 4건의 측정가능성 (auto-review-protocol Pass 2 게이트 책임)**:
  1. "BATCH-1 적재 완료" — 측정 가능: Engine Hardening Roadmap §11 BATCH-1 진입 게이트 통과 = `pnpm verify-batch-1` (가정). 실제 검증 메커니즘 부재 시 trigger 발동 검증 불가.
  2. "hybrid-search 본격 활성" — 측정 가능: `apps/api/src/search/` 디렉토리 + Vectorize 호출 1건 이상.
  3. "CHA-05 본격 측정" — 측정 가능: P1 게이트 평가 시점.
  4. "Workers 런타임 발견 사항" — **측정 불가능**: "운영 중 발견될 경우" 라는 정성적 조건. 누가 / 언제 / 어떤 임계점에서 trigger 인지 미명세.
- **decision-2026-05-02 §5.3 후속 의무**: ADR-028 §4.3 의 "@cloudflare/vitest-pool-workers 도입 + Vectorize binding 실 시뮬레이션 또는 Vectorize HTTP API mock (MSW + workerd HTTP fetch) — 본 ADR 재검토 시 결정" — 재검토 시점에 정해질 결정 일부 미정. ✅ (정직).

**판정:** ✅ PASS 3건 + 🟠 1건 (트리거 #4 측정 불가능).

**🟠 MAJOR-E1 — ADR-028 §5 재검토 트리거 #4 측정 불가능**

- 위치: `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md:147`
- 증거: `4. Workers 런타임 발견 사항 — 본 시점 node:sqlite 호환 99% 가정의 1% 결손이 운영 중 발견될 경우.`
- 효과: trigger 의 binary 판정 불가. "1% 결손 = 운영 중 발견 = 누가 보고 / 어떻게 escalation / 어떤 횟수 / 어떤 영역" 미명세 → 향후 발견되어도 ADR 재검토 trigger 발동 안 될 위험.
- 권고: trigger #4 를 다음으로 강화 — `node:sqlite 환경에서 PASS 인 테스트가 staging deploy 후 실 D1/workerd 환경에서 1건이라도 FAIL 발생 시` (binary 판정 가능 + escalation 경로 정의). 또는 staging 정기 smoke test 의 패스 카운트 차이를 trigger 로 정의.

**🟢 MINOR-E2 — Master Plan §14 Sprint 0/1/2/3 본문 v1.0.1 패치 미반영**

- 위치: `docs/ThePick Engine Quality Test Master Plan v1.0.md:946-967`
- 증거 (sed 출력):
  ```
  ### 14.1 Sprint 0 (~3일) — 도구 도입 + Baseline
  Day 3: P0 17건 baseline 측정 (현 상태 그대로 실행)
  ### 14.2 Sprint 1 (~5일) — P0 17건 GREEN 만들기
  Day 5: 17건 모두 GREEN 확인
  ### 14.3 Sprint 2 (~7일) — P1 진입 (BATCH-1 적재 후)
  Day 6-7: P1 18건 GREEN + 회귀 (P0 17건 재실행)
  ```
- 효과: §11.1 / §11.2 / §13.1 v1.0.1 패치는 정합한데 §14 Sprint 본문은 그대로. 내부 일관성 결손 — 다음 세션이 §14 만 보면 "P0 17건" 으로 작업 착수 후 §11 보고 혼란.
- 권고: commit fefa64a 의 patch scope 확장 — §14.1 / §14.2 / §14.3 의 "17건" → "15건", "18건" → "20건" 일괄 수정. 또는 §14 상단에 "Sprint 일정 본문은 P0 17건 가정 작성. P0 15건 v1.0.1 적용 시 ~5일 → ~4일 단축 예상" banner. 본 commit scope 한정으로는 수용 가능하나 다음 commit 에서 정합 의무.

**반론 (Devil's Advocate):**

> "ADR-028 의 이연 결정은 Phase 2 진입 직전에 자연 재검토되므로 trigger #4 측정 불가능 무관하다" — 거짓. trigger #1~#3 은 Phase 2 진입 시점에 동시 발동되므로 #4 의 의의는 "Phase 2 진입 전에 조기 발동 가능한 escalation 경로" 인데, 측정 불가능 = 조기 발동 0건 = #4 dead trigger. ADR 4-trigger 정의의 1/4 가 실효성 결손.

---

### 1.F Fixtures 위치 — 단방향 의존성 정합

**확인:**

- `packages/parser/__fixtures__/` 디렉토리 위치. parser 패키지 내부 격리. ✅
- `packages/parser/package.json:13-14` — exports 부재 + `__fixtures__` 미언급 → npm publish 시 fixture 미포함 정상.
- `parser-1st-exam/package.json:14` — `@thepick/parser: workspace:*` dependency. parser-1st-exam 이 parser 의 fixture 디렉토리 활용 가능 경로 — `packages/parser-1st-exam/src/foo.test.ts` 에서 `resolve(__dirname, '../../parser/__fixtures__/claude-malformed/...')` 형태. 가능하나 권장 X.
- `packages/quality/`, `packages/formula-engine/` — parser dependency 부재. 따라서 fixture 활용은 path-based relative import 가능하나, 단방향 의존성 위반 (quality → parser 부재 정합).
- 기존 fixture 패턴: `packages/parser/__fixtures__/batch1/exam_scope.pdf` 가 `packages/parser/src/__tests__/determinism.property.test.ts:27` 에서 `resolve(__dirname, '../../__fixtures__/batch1/exam_scope.pdf')` 로 사용. 동일 패턴 정합. ✅
- test-patterns.md §4 fixture 디렉토리 표 — `tests/fixtures/pdf-malicious/` 와 `tests/fixtures/claude-malformed/` 로 표기. **실제 위치 `packages/parser/__fixtures__/{pdf-malicious, claude-malformed}/` 와 불일치.**

**판정:** ✅ PASS 4건 + 🔴 1건.

**🔴 CRITICAL-F1 — test-patterns.md §4 fixture 디렉토리 경로 표가 실제 위치와 불일치**

- 위치: `docs/quality/test-patterns.md:130-138`
- 증거 (test-patterns.md §4):
  ```markdown
  | 디렉토리                           | 용도                 | 시나리오 |
  | :--------------------------------- | :------------------- | :------: |
  | `tests/fixtures/pdf-malicious/`    | 악의적 PDF 5종       |  FUZ-01  |
  | `tests/fixtures/claude-malformed/` | Claude 변조 응답 8종 |  FUZ-02  |
  ```
- 실제 위치 (`find` + `ls` 검증):
  ```
  packages/parser/__fixtures__/pdf-malicious/    (5 PDF + README)
  packages/parser/__fixtures__/claude-malformed/ (8 JSON + README)
  ```
- `tests/` 디렉토리 자체 부재 (find 검증).
- 효과:
  1. **§5.3 NOT-IMPL 7건 구현자가 테스트 코드 작성 시 fixture 경로 오류 발생 — `tests/fixtures/...` 로 시도 → ENOENT → debug 시간 손실 (10~30분).**
  2. test-patterns.md §3 (perf 패턴) §4 (fixtures) §5 (Workers Pool) 가 단일 진실 (single source of truth) 의무인데, §4 가 거짓 정보 → 본 문서 신뢰성 결손.
  3. 향후 다른 패키지 (예: `packages/study-material-generator/`) 가 fixture 활용 시 위치 추정 잘못 → 중복 fixture 생성 또는 잘못된 path 작성.
- 권고: **즉시 수정** — test-patterns.md §4 표를 다음으로 변경:
  ```markdown
  | 디렉토리                                         | 용도                 | 시나리오 |
  | :----------------------------------------------- | :------------------- | :------: |
  | `packages/parser/__fixtures__/pdf-malicious/`    | 악의적 PDF 5종       |  FUZ-01  |
  | `packages/parser/__fixtures__/claude-malformed/` | Claude 변조 응답 8종 |  FUZ-02  |
  ```
  본 commit 정합 정직성 의무 (production-quality.md "땜빵 금지" + auto-review-protocol "증거 기반 보고").

**🟢 MINOR-F2 — fixture 디렉토리의 다른 패키지 활용 시 단방향 의존성 권고 부재**

- 위치: 본 commit 의 README + test-patterns.md 어디에도 미명시.
- 효과: 향후 `packages/quality/` 또는 `packages/study-material-generator/` 가 schema-validator 회귀 검증 위해 본 fixture 사용 시 — relative path 로 가능하나 (`../../parser/__fixtures__/...`) 단방향 의존성 (quality → parser 부재 정합) 위반 가능.
- 권고: claude-malformed/README.md §5 ("fixture 추가 / 변경 시 의무") 에 다음 추가 — `다른 패키지에서 본 fixture 활용 시 package.json dependencies 에 @thepick/parser 추가 + workspace:* 정합 명시 (단방향 의존성 위반 회피)`.

---

## 2. Pass 2 종합 판정

| 항목                            | 결과                                                                                                   |
| :------------------------------ | :----------------------------------------------------------------------------------------------------- |
| Pass 2 전체 점검 항목 (1.A~1.F) | 6개 영역                                                                                               |
| ✅ PASS                         | 23건 (증거 기반)                                                                                       |
| 🔴 CRITICAL                     | **1건** (F1 — test-patterns.md §4 fixture 경로 거짓)                                                   |
| 🟠 MAJOR                        | **3건** (A1 path mapping uncovered / D1 Rule 17 fixture 예외 모호 / E1 ADR-028 trigger #4 측정 불가능) |
| 🟢 MINOR                        | 5건 (B1, C1, D2, E2, F2)                                                                               |
| N/A                             | 1건 (1.D Rule 16 — perf.ts D1 조회 0건)                                                                |

**Pass 2 판정**: 🔴 **수정 필요** (CRITICAL 1건 즉시 흡수 의무).

---

## 3. 즉시 흡수 권고 (현 commit 추가 patch 또는 다음 commit 의무)

### 3.A CRITICAL-F1 — test-patterns.md §4 fixture 경로 정정 (즉시)

- 본 commit 추가 patch (별도 commit 가능). 1줄 수정 + 본 review 인용.
- **권고 commit message**: `fix(docs): test-patterns.md §4 fixture 경로 — packages/parser/__fixtures__ 정정 — Pass 2 CRITICAL-F1 흡수`

### 3.B MAJOR-A1 — `@thepick/shared/test-helpers/*` production 차단

- ESLint `no-restricted-imports` 규칙 추가 (root `.eslintrc` 또는 패키지별).
- Sprint 1 §5.3 진입 전 의무. 별도 commit.

### 3.C MAJOR-D1 — production-quality.md Rule 17 예외 nameset 명시

- `__fixtures__/**` 추가. 1줄 수정.
- 본 commit 외 후속 commit (rules 변경) 으로 처리.

### 3.D MAJOR-E1 — ADR-028 §5 trigger #4 강화

- staging deploy 후 실 D1/workerd 환경 FAIL 1건 이상 → trigger 발동 (binary 판정).
- ADR-028 v1.1 patch 형태로 별도 commit.

---

## 4. Devil's Advocate — 본 모듈 통합이 깨질 수 있는 시나리오 (3개)

### 시나리오 1 — production 코드의 test-helpers 우발 import (A1 발동)

- 누군가 `apps/api/src/telemetry/perf-monitoring.ts` (가상) 작성 중 IDE auto-import 가 `@thepick/shared/test-helpers/perf` 를 추천 → 무심코 채택.
- `pnpm typecheck` 통과 (path mapping resolver 정합). `pnpm test` 통과 (test-only 의무 JSDoc 은 enforcement 없음). `pnpm build` (`wrangler deploy --dry-run`) 통과 (esbuild bundle 가능).
- staging deploy → Workers 50ms CPU 한도 정합 영향 미미 (perf.ts 178 LOC 만 추가). 그러나 production 번들에 test util 포함 = 보안 / 빌드 정직성 결손.
- **차단 부재 시점 = 본 commit 직후**. ESLint 규칙 도입 전까지 silent 위험.

### 시나리오 2 — test-patterns.md §4 거짓 경로로 §5.3 구현자 시간 손실 (F1 발동)

- §5.3 NOT-IMPL 7건 작업자 (Claude 다음 세션) 가 test-patterns.md §3 (perf 패턴 정합) → §4 (fixture 디렉토리) → §5.3 FUZ-01/02 구현 진입 → `import { readFile } from 'node:fs/promises'; await readFile(resolve(__dirname, '../../tests/fixtures/pdf-malicious/01-empty.pdf'))` → ENOENT.
- debug 10~30분 → 실제 위치 발견 → test-patterns.md 신뢰 결손 → review 추가 의무.
- **본 commit 의 정직성 결손 = single source of truth 약속 위반**.

### 시나리오 3 — Hard Rule 17 fixture 예외 모호로 미래 fixture 삭제 (D1 발동)

- 6개월 후 다른 Claude 세션이 `packages/parser/__fixtures__/claude-malformed/08-hard-rule-17-violation.json` 의 `'son-hae-pyeong-ga-sa'` literal 발견 → "production-quality.md Rule 17 위반" 으로 잘못 판정 → fixture 삭제 PR 제출.
- 4-Pass 리뷰 시점에 README §2.8 와 본 review (D1) 미참조 시 → fixture 삭제 통과 → FUZ-02 #8 검증 무력화 → schema-validator 의 Hard Rule 17 sanitization 회귀 검증 결손.
- **차단 메커니즘**: production-quality.md Rule 17 예외 nameset 에 `__fixtures__/**` 명시 또는 README §4 에 본 review D1 인용 명시.

---

## 5. 본 Pass 2 의 한계 (정직)

1. **Pass 1 (Surgeon) / Pass 3 (Advocate) / Pass 4 (Contract) 미수행 — 별도 에이전트 산출물 의무.** 본 Pass 2 단독으로 "완료 가능" 판정 불가.
2. **본 Pass 2 는 ESLint 규칙 미도입 시점의 정적 분석.** 향후 ESLint enforcement 도입 시 A1/D1 의 실효성 자동 검증.
3. **Workers 런타임 정합은 `node:sqlite` + Vitest default pool 환경 검증.** workerd 실 환경 검증은 ADR-028 §6 한계 정합 — Phase 2 진입 직전 staging smoke test 의무.
4. **Master Plan §14 Sprint 본문 정합 (E2) 은 본 commit scope 외 — 다음 commit 권고.**

---

**Pass 2 작성**: Claude (Opus 4.7 1M context) — 독립 system-architect 에이전트
**작성일시**: 2026-05-02 00:28:03 KST
**다음 단계**: Pass 1 / Pass 3 / Pass 4 결과 통합 후 Sprint 1 §5.2 완료 가능성 종합 판정
