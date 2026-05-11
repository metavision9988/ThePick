# 5-Persona Tech Debt — Quality Engineer

> Phase 2 Eval MVP 종착 시점 (Session 065) 5-페르소나 기술부채 심층 리뷰 3/5 —
> **테스트 부채(Test Debt)** 관점. "프로덕션에서 뭐가 물릴까?"
>
> 본 리뷰의 본질: 테스트 통과 = 안전이 아니다. **테스트 자체가 안전을 입증하는가**가 관건.

---

## 리뷰 메타 (4-Pass 인계)

- **트리거**: Phase 2 Eval MVP Step 5 PASS + ADR-034/035/036 silent drift 흡수 chain 종착
- **리뷰 시점**: 2026-05-11 KST, Session 066 진입 직후
- **리뷰 범위 (Session 065 누적)**:
  - `apps/api/src/__tests__/scenarios.test.ts` (S5 it.skip 신규)
  - `apps/api/src/auth/__tests__/password.test.ts` (it.skip 신규 — 'short' reject)
  - `apps/api/src/auth/__tests__/dummy-verify.test.ts` (PBKDF2 ≥ 100k 갱신)
  - `apps/api/src/auth/__tests__/rate-limit.test.ts` (불변)
  - `apps/api/src/auth/__tests__/routes.test.ts` (SameSite=Lax 분기)
  - `apps/api/src/study/__tests__/routes.test.ts` (4 test examType=2nd 명시 신규)
  - `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` (0028 마이그레이션 추가, 0020-0027 skip 유지)
  - `scripts/verify-engine-contracts.ts` (VITEST_PACKAGES required 합계 = 1248, 갱신 부채)
  - `migrations/0028_pbkdf2_iterations_workers_compat.sql` (PBKDF2 100k trigger)
- **4-Pass 인계 (중복 지적 회피 대상)**:
  - Pass1-C-1: DUMMY_HASH bytes drift (100k 재생성 미반영)
  - Pass2-?: ADR-005 supersedes (600k → 100k)
  - Pass1-?: dummy-verify.ts 주석 drift (sentence "600,000 반복")
  - Pass3-C-2: 임시 정책 env 분기 부재 (production 영구 박힘)
  - Pass3-C-3: register per-email rate-limit 부재
  - Pass3 본문: scenarios.test S5 skip / password.test 'short' skip — carry-over 명시
- **본 리뷰 본질**: 위 7건은 **무엇이 잘못되었나**의 영역. 본 리뷰는 **테스트 자체가 무엇을 입증하지 못하는가**의 영역.

---

## 요약

| 등급        | 카운트 | 비고                                                                                       |
| ----------- | -----: | ------------------------------------------------------------------------------------------ |
| 🔴 CRITICAL |      3 | Skip carry-over 자동 알람 부재 / Playwright e2e 0 / TD-VRF-001 비결정성 운용 부채          |
| 🟠 MAJOR    |      5 | checklist 격차 / 0020-0027 skip / 격리 fidelity / mutation 부재 / Golden 정밀도 표면       |
| 🟡 MINOR    |      4 | routes.test 의도 보존 약함 / rate-limit 분 단위 잔존 / progress 격리 외 / scope edge cases |
| **총계**    |     12 | 4-Pass 중복 0건                                                                            |

**판정**: **MAJOR carry-over 5건 명시 후 Phase 3 진입 가능**. CRITICAL 3건은 즉시 수정이 아닌 **운영 게이트**로 봉합 가능하나, **Phase 3 launch 전 의무 해소**가 강제되어야 silent regression 미방지 위험 = ADR-034/035/036 복원 망각과 곱연산.

---

## 🔴 CRITICAL (4-Pass 중복 0)

### Q-C-1 — ADR-034 carry-over skip 테스트 2건 자동 알람 부재 (Phase 3 복원 망각 silent path)

**파일**:

- `apps/api/src/__tests__/scenarios.test.ts:332` — `it.skip('S5. 유출된 비밀번호 ...')`
- `apps/api/src/auth/__tests__/password.test.ts:24` — `it.skip('rejects passwords shorter than minimum')`

**증거**:

```
$ grep -rE "it\.skip|describe\.skip|it\.todo" apps/api/src apps/web/src packages/*/src
apps/api/src/auth/__tests__/password.test.ts:  it.skip('rejects passwords shorter than minimum (ADR-034 carry-over)', ...)
apps/api/src/__tests__/scenarios.test.ts:  it.skip('S5. 유출된 비밀번호 "password" 로 가입 시도 → HIBP 감지로 거부 (ADR-034 carry-over)', ...)
packages/quality/src/__tests__/verify-cat9-mutation.test.ts:describe.skipIf(IS_SUBPROCESS)(...)  # 무관 (subprocess 재귀 차단 의도)
```

**문제 정량**:

- `verify-engine-contracts.ts:1100` `checkP0NoSkippedTests` — Sprint 1 §5.5 P0 15 시나리오 한정. ADR-034 carry-over 2건은 **검사 범위 외**.
- `verify-engine-contracts.ts:1149` VITEST_PACKAGES `@thepick/api required: 309` — skip 2건이 passedTests 카운트에서 자동 제외되지만 **required 카운트 = 309 자체는 갱신되지 않음** (현재 PASS = 309-2 = 307 또는 다른 합계).
- Phase 3 launch 직전 ADR-034 §"복원 의무" 6항목 자동 검증 게이트 0개.

**파급**:

- Phase 3 1주 스프린트 진입 시 (memory `project_launch_legal_bundle_deferred.md` 묶음) ADR-034 복원이 망각되면 `password.test 'short' reject` + `S5 HIBP pwned 422` 회귀 발견 시점이 **외부 사용자 진입 후**가 됨.
- 4-Pass Pass3-C-3 (register per-email rate-limit 부재)와 곱연산 시: 외부 진입 1명 + 4자리 PASSWORD + HIBP disable + rate-limit only IP = brute-force 가능 → 회원가입 1만 회/IP 회전.

**테스트 부채 본질**: skip은 "테스트 자체가 부재"가 아니라 **"테스트가 거짓말한다"**. CI는 PASS로 보고하나 실제로는 검증되지 않은 영역. 이는 `테스트 통과 = 안전` 가정의 가장 위험한 위반 형태.

**개선**:

1. `verify-engine-contracts.ts`에 `checkAdr034CarryoverSkip` 신규 BooleanMetric 추가:
   ```typescript
   function checkAdr034CarryoverSkip(): BooleanMetric {
     // ADR-034 active 상태에서 정확히 2건의 it.skip 존재 검증.
     // Phase 3 복원 시 PASSWORD_MIN=8 / HIBP active 동시에 skip=0 강제.
   }
   ```
2. `migrations/0028` rollback SQL이 주석 처리됨 → 실제 ROLLBACK 마이그레이션 0029 생성 의무 + carry-over chain 명시.
3. ADR-034/035/036 §"복원 의무" 각 항목을 vitest test로 영속화 (현재는 ADR 문서 본문 텍스트만 존재).

---

### Q-C-2 — Playwright E2E 0건 — 사용자 여정 전수 자동 회귀 검증 부재 (handoff §F.4 M12)

**현황**:

- handoff §F.4 M12 명시: "G5 Playwright e2e (plan §8.8)" carry-over
- 본 세션 진산 G9 학습 시도 1회 수동 검증 (2019년 제5회 제16문 순차 surface 확인)
- 자동 회귀 = 0
- `apps/web/src/components/` (AuthForm, QuestionCard, OfflineIndicator, ProgressSummary) 단위 테스트 0건 (관측: `find apps/web -name "*.test.*"` 결과 없음)
- 즉, **로그인 → 학습 → grade → 다음 문제** 의 전체 flow가 자동 검증되지 않음.

**증거**:

- Session 065 핸드오프 §"다음 할 일" #4 진산 noise 4 type (A/B/C/D) 식별 carry-over — 모두 **진산님 수동 시도로만 발견 가능**.
- routes.test.ts (study) + scenarios.test.ts (auth)는 backend API 한정. **frontend ↔ backend 합치 검증 0**.
- 4-Pass Pass3 본문: "Pass3-Mi-4 login.astro에 OfflineIndicator 미장착" — 사용자 시점 회귀를 **수동 리뷰가 발견**한 것. e2e가 있었으면 자동 fail.

**파급**:

- Phase 3 학습 UX 본격 진입 (memory `project_ux_north_star_phase3.md`) 시 객관식 라디오 / 주관식 분류 / 보기 랜덤 / 학습 모드 다양화 = **모두 사용자 인터랙션 회귀 영역**. e2e 부재 상태 진입 = 회귀 발견이 진산님 수동 시도에 100% 의존.
- ADR-036 cookie SameSite='None' production cross-origin 시나리오 자동 검증 0 (현재는 `routes.test.ts:203` Lax 검증, production None 분기는 `routes.test.ts:232` 토큰만 검증, 실제 cross-origin fetch 검증은 0).

**테스트 부채 본질**: backend unit/integration이 100% PASS여도 user-facing 회귀는 발견 불가. 진산님이 "2019년 제5회 제16문 순차적으로 나오네"라고 발화한 이유 = **사람이 직접 시도해야만 발견 가능**한 상태.

**개선**:

1. Phase 3 진입 게이트 의무: `phase3-learning-ux-modes.plan.md` 신규 시 **§§Playwright e2e Required AC** 5개 이상 명시.
2. 최소 시나리오:
   - AC-E2E-1: register → login → /study → /next 1문 → /grade 정답 → 다음 문제 surface (옵션 3 default '1st' 정합).
   - AC-E2E-2: login → /study → /next → 401 expired (refresh 미발급) → /auth/login?next= redirect → 학습 이어짐 (S27 frontend 영역).
   - AC-E2E-3: production env cookie SameSite='None' cross-origin POST 정합 (ADR-036).
   - AC-E2E-4: offline → online queue flush → grade 정상 (M9 carry-over).
   - AC-E2E-5: Ctrl+N keyboard shortcut + macOS Cmd+N 차단 검증 (M8 carry-over).
3. CI: `apps/web` Playwright suite을 verify-engine-contracts.ts Cat 4에 통합 (현재 Cat 4 = batch 한정).

---

### Q-C-3 — TD-VRF-001 verify vitest 비결정성 운용 부채 영속 (formula-engine 302↔303 / batch 326↔327)

**현황**:

- 핸드오프-074 §"주의사항" 명시: "TD-VRF-001 verify vitest 비결정성 — 본 세션 entry run1=PASS / run2=PASS (불변)"
- `verify-engine-contracts.ts:151` `@thepick/formula-engine required: 303`
- `verify-engine-contracts.ts:154` `@thepick/batch required: 327`
- 본 세션은 run1/run2 모두 PASS. 그러나 **TD-VRF-001 자체가 영속 부채**.

**증거**:

- 본 세션 단일 PASS는 비결정성 해소가 아니라 운 좋은 표집. 사용자 프롬프트 명시: "비결정성 재현율 (run1 FAIL / run2 PASS 빈도) 추정"
- 과거 세션 핸드오프 chain 추적 (Session 062~064 estimate): 약 1회/3 verify 빈도로 run1 FAIL, run2 PASS 패턴 발생 (정확 측정 부재 자체가 부채).
- 카운트 인접: 302 vs 303 (formula-engine), 326 vs 327 (batch) — **1건씩 표류**. 비결정성 원인은 timing-sensitive test 또는 race condition.

**문제 정량**:

- 추정 비결정성 재현율: **0.30 ± 0.15** (1/3 빈도, 본 추정은 핸드오프 chain 명시 "TD-VRF-001 영속"의 빈도 신호 + 카운트 1건 인접의 통계 직관).
- CI 게이트가 1회 PASS로 통과 시: 실제로는 0.7 확률로 PASS, 0.3 확률로 FAIL. **CI 재실행으로 우회 가능** = silent.
- 운용 부채: 매 verify 2회 영속 의무 (handoff-074 §"다음 할 일" #1)로 **수동 보강** 중. 자동화 = 0.

**파급**:

- Phase 3 launch 진입 시점 entry verify 2회 영속 의무가 6 ADR carry-over 묶음 1주 스프린트 동안 매일 수행 필요. 누군가 1회로 단축하면 silent skip.
- formula-engine 302 ↔ 303 (1건 표류) = 산식 검증 1건이 timing-sensitive. 산식은 Hard Limit "LLM에게 수식 계산 절대 금지" + "Formula Engine AST 파서로만"으로 보호되는 영역 → 1건 표류가 race condition 산식 검증이면 **소수점 정밀도 검증 누락 가능**.

**테스트 부채 본질**: **테스트가 결정적이지 않으면 무엇을 입증한다고 말할 수 없다**. TD-VRF-001은 "테스트가 거짓말한다"의 가장 미묘한 형태 — 어떤 때는 진실, 어떤 때는 거짓.

**개선**:

1. **즉시**: verify 100회 자동 실행 + 비결정성 카운트 누적 (`scripts/verify-determinism.ts` 신규):
   ```typescript
   for (let i = 0; i < 100; i++) {
     run verify-engine-contracts.ts --json
     record run.summary.overallStatus + per-package counts
   }
   report: pass/fail 분포 + count drift histogram
   ```
2. **근본 해소**: formula-engine 302 ↔ 303 / batch 326 ↔ 327 표류 1건씩의 정확한 원인 동정. `vitest --reporter=verbose --bail=0` 100회 누적 후 결과 diff.
3. **Phase 3 게이트**: TD-VRF-001 비결정성 재현율 < 0.01 (100회 중 99회 이상 동일 결과) 충족 시 launch 허용.

---

## 🟠 MAJOR (4-Pass 중복 0)

### Q-M-1 — master-test-checklist 1248 vs verify-engine-contracts.ts 합계 격차 / 실측 1426 추정 격차

**현황**:

- `docs/quality/master-test-checklist.md:59`: 모노레포 합계 **937** (Step 19 시점)
- `scripts/verify-engine-contracts.ts:149` VITEST_PACKAGES required 합계: **50+303+179+57+327+309+13+10 = 1248**
- 핸드오프 §"누적 통합 통계" `apps/api tests : 467 → 490 → 488 PASS + 2 skipped` (그 외 패키지 합산 시 약 1426~1427 추정)

**문제 정량**:

- master-test-checklist.md는 Step 19 시점 (2026-05-01 추정) **937** 영속 — **2주 stale**.
- verify-engine-contracts.ts는 Session 053 시점 (B4+B6 흡수 +18+6) **1248** 영속 — **약 1주 stale**.
- 실측 1426/1427 = 누적 신규 테스트 +178~179 미반영.

**파급**:

- `verify-engine-contracts.ts:1156` numerics `observed >= required` PASS 조건 — required가 stale이면 신규 테스트 추가는 자동 PASS (회귀 차단 0).
- 예: Session 065 신규 추가 study/routes.test.ts CRIT-2 regression rate-limit test가 회귀 시점 silent. required = 309 (api)가 갱신되지 않아 308 → 307 표류해도 verify PASS 가능 (필요조건만 검사).
- 정확히 사용자 프롬프트 "CI gate 효과" 정량: required = 1248, observed = 1426 일 때 PASS 마진 = +178. **이 마진 내에서 -178 회귀가 silent**.

**개선**:

1. master-test-checklist.md §1.1 갱신: Step 19 표 + Session 065 종착 표 동시 영속 (단방향 게이트 의무).
2. verify-engine-contracts.ts §VITEST_PACKAGES 단방향 게이트 자동화: `required = max(required, observed - tolerance)` 운영 정책. 매 PR머지 시 갱신 hook 추가.
3. 본 양자가 동기화되지 않으면 `verify-engine-contracts.ts` 자체에 `checkChecklistFreshness` boolean 추가 (master-test-checklist.md 의 `@thepick/api` required 값 추출 후 VITEST_PACKAGES와 비교).

---

### Q-M-2 — d1-from-sqlite.ts 마이그레이션 0020-0027 skip (8건) → 시나리오 fidelity 부채

**파일**: `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:44-67`

**현황**:

```typescript
const SCENARIO_MIGRATIONS = [
  '0001_initial_schema.sql',
  ...'0019_knowledge_nodes_page_chapter_meta.sql',
  '0028_pbkdf2_iterations_workers_compat.sql', // ← 0020~0027 SKIP
];
```

**증거**:

- 0020 슬롯 = B-C1 (user_progress.exam_id, Year 2 zero-cost) 이월 (verify-engine-contracts.ts:370 주석)
- 0021 = table_as_micro_kg
- 0022-0026 = ADR-032 패턴-H + trigger 재생성 chain
- 0027 = (현재 추정, 필요 시 직접 확인)
- 0028 = PBKDF2 100k

**파급**:

- Phase 2 진입 후 ADR-032 (Table-as-Micro-KG) D1 trigger들이 시나리오 테스트 환경에서 **활성화되지 않음**.
- scenarios.test.ts S22-S27 (엔진 통합 검증)이 user*progress / knowledge_nodes / exam_questions 등을 다루나, table*\* 4 테이블 trigger는 실행되지 않음. **table_structures CHECK constraint H_nested 누락 silent fail 위험** (4-Pass Pass2 + Session 052 DA-C1 영역과 겹침).
- handoff-073 §F.4 M3+M5 carry-over (user_progress UNIQUE 제약 → 마이그레이션 0029)가 적용되면 시나리오 테스트도 동시 갱신 필요. 망각 시 production만 trigger active = 시나리오 PASS → production INSERT fail silent drift 재현.

**개선**:

1. `SCENARIO_MIGRATIONS` 배열을 **자동 readdir** 로 전환:
   ```typescript
   const SCENARIO_MIGRATIONS = readdirSync(MIGRATIONS_DIR)
     .filter((f) => /^\d{4}_.+\.sql$/.test(f))
     .sort();
   ```
   현재는 `createD1FromAllMigrations()` 별도 함수로 존재하나 시나리오 테스트는 수동 배열 사용. **TD-API-001 명시 부채** (43줄 주석).
2. 또는 단방향 게이트 추가: `verify-engine-contracts.ts`에 `SCENARIO_MIGRATIONS.length === actual_migrations_count` 검증.

---

### Q-M-3 — Mutation Testing 부재 (Cat 9 verify-cat9-mutation 제외 시)

**현황**:

- `packages/quality/src/__tests__/verify-cat9-mutation.test.ts` 존재하나 `describe.skipIf(IS_SUBPROCESS)` — 일반 vitest run 시 1회만 활성, verify-engine-contracts.ts subprocess 호출 시 skip (재귀 차단).
- 다른 패키지 (formula-engine, parser, api 등) mutation testing 부재.
- 4-Pass에 의해 Pass1-Surgeon이 정합 검증하나, **테스트가 실제로 회귀를 잡는가**는 mutation으로만 입증 가능.

**파급**:

- 예: study/routes.ts `isAnswerCorrect` 함수 — `normalizeAnswer` 호출 후 비교. 가설 mutation: `normalizeAnswer(a) === normalizeAnswer(b)` → `normalizeAnswer(a) !== normalizeAnswer(b)`. 정답 정합 테스트 (routes.test.ts:192) survive 여부 미검증.
- 4-Pass Pass3 본문 CRIT-3 ('번' vs '호' false-positive) 회귀는 발견되었지만, **다른 false-positive가 잠복 가능** (예: `'2번'` vs `'2회'`, `'2'` vs `'2개'` 등). mutation으로 식별 가능 영역.

**개선**:

1. Stryker.js 또는 vitest-mutator 도입 — 우선순위: `apps/api/src/study/routes.ts` (학습 채점 핵심) > `apps/api/src/auth/password.ts` > `packages/formula-engine/`.
2. mutation score 임계: 80% (industry standard) 이상 충족 시 Phase 3 진입 게이트.
3. 본 부채는 Phase 3 launch 직전이 아닌 Phase 3 진입 초기 (학습 UX 본격 시작 전)에 해소 권고 — 옵션 3 옵션 정합 검증 누락 회귀 차단.

---

### Q-M-4 — Golden Test 정밀도 표면 vs 깊이 — formula-engine 302 표류 1건의 정체 미동정

**현황**:

- master-test-checklist §6 "Formula Engine = QG-2/QG-5 골격" 명시
- `verify-engine-contracts.ts:1234` `formulaCount.required = 251` (Step 19 시점)
- 실측 303 (현재 required) — +52 누적
- **302 vs 303 표류 1건의 정체는 PRC-01 precision framework 영역인가 / fuzz / sandbox 영역인가 미동정**

**파급**:

- Hard Limit "LLM에게 수식 계산 절대 금지 (Formula Engine AST 파서로만)" 영역에서 1건 표류는 **소수점 정밀도 검증 위반 가능성**. 1.0115 × 0.45 같은 부동소수점 오차 검증 누락이면 production 산식 결과 0.01원 단위 표류 가능.
- 산식 계산 오류 = 서비스 사망 (Hard Limit "L3 영역" 명시).

**개선**:

1. formula-engine `vitest run --reporter=verbose` 100회 실행 후 PASS/SKIP/FAIL diff 누적.
2. 302 ↔ 303 표류 테스트 동정 후 결정성 보강 (timing-sensitive 라면 `vi.useFakeTimers` / race condition이라면 await chain 명시).
3. PRC-01 footnote expansion (BATCH-1 적재 후 51 산식 × 5 시나리오 = 255건) 의무를 Phase 3 launch 게이트로 명시 — verify-engine-contracts.ts:1002 EXPANSION_OBLIGATIONS 자동 발화 trigger.

---

### Q-M-5 — register-rate-limit 테스트 부재 (4-Pass Pass3-C-3 영역 carry-over 보강)

**현황**:

- 4-Pass Pass3-C-3가 production code의 register per-email rate-limit 부재를 지적함.
- 본 quality 페르소나는 **테스트 부채 측면**에서 보강: register 엔드포인트에 대한 rate-limit 테스트 시나리오 부재.
- `apps/api/src/auth/__tests__/routes.test.ts:202~556` describe 5종 (login Set-Cookie / logout Clear-Cookie / refresh rotation+reuse / register / etc.) 중 register rate-limit 명시 테스트 0.
- scenarios.test.ts S6 = login rate-limit. register rate-limit = 0.

**파급**:

- 4-Pass Pass3-C-3 + Q-C-1 (ADR-034 skip carry-over) 곱:
  - 외부 사용자 진입 + PASSWORD_MIN 4 잔존 + register IP rate-limit only + register per-email rate-limit 없음 → IP 회전 1만회/email 시도 가능.
  - 본 테스트 부재 = 보강 시점 회귀 차단 게이트 0.
- Phase 3 launch 직전 ADR-034 복원 검증 시: `password.test.ts` it.skip 해제로 'short' reject 복원, S5 it.skip 해제로 HIBP pwned 422 복원. **그러나 register rate-limit 테스트는 신규 작성 필요** = 작업 누락 silent 위험.

**개선**:

1. `apps/api/src/auth/__tests__/routes.test.ts` 또는 별도 `register-rate-limit.test.ts` 신규:
   - AC: register 동일 email 21회 시도 → 429
   - AC: register 동일 IP 다른 email 21회 시도 → 429 (별도 limiter)
2. scenarios.test.ts에 S5b (register brute-force) 신규 추가 (S5와 같은 자리 — ADR-034 carry-over chain 정합).

---

## 🟡 MINOR (4-Pass 중복 0)

### Q-Mi-1 — routes.test.ts 4 test examType=2nd 명시 — 옵션 3 의도 보존 약함

**파일**: `apps/api/src/study/__tests__/routes.test.ts:248, 266, 290, 316`

**현황**:

```typescript
// ★ Session 065: 라우트 default '2nd' → '1st' 변경 (production 실측 정합). 본 test는 examType filter 검증 의도.
const res = await fetchAs('u1', '/next?examType=2nd');
```

**문제**: 주석은 "본 test는 examType filter 검증 의도"라고 명시. 그러나 4 test 중 어느 것도 **default가 '1st'임을 명시 검증**하지 않음 (즉, `/next?` query param 없이 호출 시 1st만 surface 되는가).

**파급**: Phase 3 또는 미래 어느 시점 default를 '2nd'로 다시 돌리는 silent pivot 발생 시 본 test 4건은 명시 examType=2nd이므로 PASS 유지 → 회귀 silent.

**개선**: 신규 test 추가 — "default examType=1st surface (옵션 3 영속 정합)":

```typescript
it('옵션 3 — examType query param 없으면 1st default surface', async () => {
  seedUser('u1', 'u1@test.com');
  seedExamQuestion({ id: 'eq-1st-1', examType: '1st' });
  seedExamQuestion({ id: 'eq-2nd-1', examType: '2nd' });
  const res = await fetchAs('u1', '/next'); // ← examType 미지정
  const body = (await res.json()) as StudyResponseBody;
  expect(body.questions).toHaveLength(1);
  expect(body.questions![0].id).toBe('eq-1st-1'); // 옵션 3 default = 1st
});
```

---

### Q-Mi-2 — rate-limit 테스트가 분당 20회 boundary만 검증, time window 만료 후 회복 미검증

**파일**: `apps/api/src/study/__tests__/routes.test.ts:502-524`

**현황**: 20회 PASS → 21회 429 검증. **분 경계 60초 후 새 시도 → 200 회복** 미검증.

**파급**: time window 만료 후에도 429 lock-out 잔존 silent bug 가능 (rate-limit implementation 정합 부족).

**개선**: `vi.useFakeTimers` + `vi.advanceTimersByTime(60_000)` 후 21회째 200 회복 검증.

---

### Q-Mi-3 — scenarios.test.ts S26 (사용자 격리) 외 cross-tenant exam_questions 격리 미검증

**파일**: `apps/api/src/__tests__/scenarios.test.ts:930-951`

**현황**: S26은 user_progress 격리만 검증. **exam_questions의 examId 격리** 미검증.

**파급**: Year 2 멀티시험 진입 시 (memory `project_v3_final_multi_exam_deferred.md`) Hard Rule 16 examId 시그니처 회귀 발견 시점 지연.

**개선**: Year 1 동안은 단일 시험 (son-hae-pyeong-ga-sa)이라 즉시 회귀 위험 0. Phase 3 진입 게이트가 아닌 Year 2 Phase 4 ExamAdapter 도입 시점 의무 추가 — handoff carry-over.

---

### Q-Mi-4 — scope edge cases — 32KB 경계 (S21) 외 1바이트 / 빈 body / null content-type 미검증

**파일**: `apps/api/src/__tests__/scenarios.test.ts:760-806`

**현황**: 32KB-10 + 32KB+10 boundary. **0바이트 body / `content-type` 누락 / `application/json` 대신 `text/plain`** 미검증.

**파급**: 4-Pass Pass1 Surgeon 영역과 부분 겹침. 본 페르소나는 **테스트 부재** 측면.

**개선**: S21b boundary expansion — payload 0/1/32KB-1/32KB/32KB+1/매우 큰 100MB DoS attempt.

---

## 프로덕션에서 물릴 시나리오 (top 3)

### #1. ADR-034 복원 망각 silent → brute-force (외부 사용자 1명 진입 후)

**경로**: Phase 3 launch 1주 스프린트 → ADR-034/035/036 동시 복원 작업 → password.test it.skip 해제 망각 → 'short' reject 미검증 → PASSWORD_MIN_LENGTH=4 잔존 → 외부 사용자 진입 → brute-force.

**확률**: 약 0.30 (1주 스프린트 6 ADR 묶음에서 1건 skip 해제 망각 빈도 직관 추정)
**영향**: CRITICAL (외부 1명 진입 후 즉시 brute-force 가능)
**리스크**: 0.30 × CRITICAL = **즉시 해소 필요**

**해소**: Q-C-1 개선 1번 (verify-engine-contracts.ts `checkAdr034CarryoverSkip`).

---

### #2. TD-VRF-001 비결정성 + CI 재실행 우회 → formula-engine 산식 검증 1건 silent regress

**경로**: TD-VRF-001 비결정성 (재현율 ~0.30) → CI 1회 FAIL → 재실행 PASS → 누군가 1회로 단축 → formula-engine 302↔303 표류 산식 1건이 실제 회귀임에도 silent → 산식 결과 0.01원 단위 표류 → 수험생 채점 결과 오답 처리 → 서비스 신뢰성 사망.

**확률**: 0.05 (TD-VRF-001 재현 × 표류 1건이 정합 회귀 × 외부 영향 도달)
**영향**: CRITICAL (Hard Limit "산식 계산 오류 = 서비스 사망" 명시)
**리스크**: 0.05 × CRITICAL = **Phase 3 launch 전 의무 해소**

**해소**: Q-C-3 개선 1+2번 (verify-determinism.ts 100회 누적 + 표류 1건 정체 동정).

---

### #3. Playwright e2e 0 → 옵션 3 default '1st' 미래 silent pivot 회귀

**경로**: Phase 3 학습 UX 본격 진입 → 객관식 라디오 등 신규 컴포넌트 → 누군가 study.astro 또는 routes.ts default examType을 '2nd'로 silent revert → 단위 테스트는 routes.test.ts 4 test examType=2nd 명시이므로 PASS → 진산님 재학습 시도 시 1차 525건 surface 안 됨 발견 → 외부 사용자 영향 후 발견.

**확률**: 0.20 (Phase 3 학습 UX 본격 도입 중 routes.ts touch 빈도 고려)
**영향**: MAJOR (학습 콘텐츠 영역 default revert는 수험생 1차 본격 학습 차단)
**리스크**: 0.20 × MAJOR = **Phase 3 진입 게이트로 e2e AC-E2E-1~5 의무**

**해소**: Q-C-2 개선 2번 (AC-E2E-1 register → login → /study → /next 1st default surface 검증).

---

## Skip 테스트 영향도 분석

### Skip 테스트 (3건) — Phase 3 복원 시 누락 회귀 매트릭스

| 파일                                    | Skip                                                | 무엇을 검증하지 못하나                                         | 복원 망각 시 silent 영향                                |
| --------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| `password.test.ts:24`                   | `it.skip('rejects passwords shorter than minimum')` | `hashPassword('short')` reject 정합                            | PASSWORD_MIN=4 잔존 시 production register 4자리 허용   |
| `scenarios.test.ts:332`                 | `it.skip('S5. HIBP pwned')`                         | register시 HIBP API '1E4C9B93...' suffix 발견 시 422           | HIBP disable 분기 잔존 시 'password' / '123456' 등 통과 |
| `verify-cat9-mutation.test.ts` (skipIf) | `describe.skipIf(IS_SUBPROCESS)`                    | mutation testing 자체 (verify-engine-contracts 재귀 차단 의도) | 무관 (정상 운용)                                        |

### 회귀 매트릭스 정량

- **password.test 'short' skip**: production 영향 0 (직접 호출 경로 없음, 다만 Zod 검증 우회 발견 시 자동 차단 부재). **register 엔드포인트 통합 영향 = `routes.ts:140` HIBP 분기 + PASSWORD_MIN_LENGTH constants 조합**.
- **S5 skip**: 직접 production register 흐름 자동 검증 부재. HIBP fetch 분기가 routes.ts에서 주석 처리 (handoff §F ADR-034 명시) → S5 unskip만으로는 회귀 차단 불충분. **4-Pass Pass3-C-2 (임시 정책 env 분기 부재)와 곱연산** 시 즉시 외부 노출.

### Phase 3 복원 의무 자동 게이트 부재 (Q-C-1 핵심 회귀)

verify-engine-contracts.ts `checkP0NoSkippedTests` 함수는 Sprint 1 §5.5 P0 15 시나리오 한정. ADR-034 carry-over skip 2건은 **검사 범위 외**. 따라서:

- 현재 CI PASS = 309 (api) (변동 가능), skip 2건은 카운트 제외
- Phase 3 복원 시점에 skip 해제 후 카운트 311 (api) 자동 갱신 — 갱신 망각 시 +2 회귀 silent
- **운영 의무**: 핸드오프 §"다음 할 일" #5 chain에 `password.test.ts:24 + scenarios.test.ts:332 동시 unskip + verify-engine-contracts.ts api required 카운트 +2 갱신` 명시 의무.

---

## master-test-checklist 격차 영향

### 격차 정량

| 출처                                                 | 합계           | 시점                              | 표류                   |
| ---------------------------------------------------- | -------------- | --------------------------------- | ---------------------- |
| `docs/quality/master-test-checklist.md:59`           | **937**        | Step 19 (2026-05-01)              | ★ +311 누적 미반영     |
| `scripts/verify-engine-contracts.ts:149-160`         | **1248**       | Session 053 B4+B6 (2026-05-07~08) | ★ +178~179 누적 미반영 |
| 실측 (핸드오프 §"누적 통합 통계" + 본 페르소나 추정) | **~1426/1427** | Session 065 종착 (2026-05-11)     | —                      |

### CI 게이트 효과 (정량 분석)

verify-engine-contracts.ts:1156 NumericMetric PASS 조건:

```typescript
status: sum.failedTests === 0 && sum.passedTests >= pkg.required ? 'PASS' : 'FAIL';
```

**현재 운영**:

- `@thepick/api required: 309` vs 실측 ~490 (passed) + 2 (skipped) → 마진 = +181
- 회귀 발생 시 passedTests = 309~490 범위 내에서는 PASS 유지 → **silent 회귀 차단 0**
- 정확히 `passedTests < required` 일 때만 FAIL

**격차의 의미**:

- master-test-checklist (937) ↔ verify-engine-contracts (1248) ↔ 실측 (~1426) **3겹 stale**.
- 신규 테스트 추가는 자동 통과, 신규 테스트 회귀는 silent (마진 내 회귀).
- ADR-034 복원 시 skip 2건 → unskip → +2 (api) → required 309에서 갱신 안 되면 차단 효과 0.

**개선** (Q-M-1 재강조):

- master-test-checklist.md §1.1을 자동 생성 (verify-engine-contracts.ts JSON 출력에서 합산)으로 전환.
- 단방향 단조 증가 게이트: 매 PR머지 시 `required = max(required, observed)` 자동 update.
- handoff §"누적 통합 통계"의 테스트 카운트 라인을 verify-engine-contracts.ts JSON에서 자동 채우기.

---

## Devil's Advocate

### 반론 #1 — "Skip 2건은 ADR-034 명시 carry-over고, 핸드오프 §"다음 할 일" #5에 복원 chain 명시되어 있다. Q-C-1은 과장."

**반박**:

- 핸드오프 §"다음 할 일" #5에 "ADR-034 §"복원 의무" 6항목" 명시는 맞으나, **6항목의 자동 검증 게이트는 0개**.
- memory `project_launch_legal_bundle_deferred.md` chain 묶음 1주 스프린트 = 법무 3종 + 회원탈퇴 + 이메일 인증 + 3 ADR + custom domain + UX 본격 진입. **단일 1주에 6 작업 묶음** → 1건 누락 확률 직관 0.3.
- 자동 게이트 없음 → 6항목 중 하나라도 미반영 시 silent.
- 따라서 Q-C-1은 **운영 부채 정량화**가 본질. "carry-over 명시" 자체로는 자동 차단 효과 0.

---

### 반론 #2 — "TD-VRF-001은 본 세션 run1/run2 모두 PASS이고, 핸드오프 §"주의사항"에 영속됨. 운영으로 충분히 봉합 가능. Q-C-3은 과대."

**반박**:

- 본 세션 단일 PASS는 비결정성 해소가 아닌 운 좋은 표집. 비결정성 재현율 자체가 **미측정** 상태.
- Phase 3 launch 직전 1주 스프린트 동안 매일 entry verify 2회 영속 의무가 발화 → 누군가 1회로 단축할 행동 압력 누적.
- formula-engine 302 ↔ 303 표류 1건은 **표류 자체가 정합 회귀일 가능성** (PRC-01 precision framework 영역과 정합 의심). 산식 1건 표류 = Hard Limit "산식 계산 오류 = 서비스 사망" 영역 도달 가능.
- 봉합 운영의 한계: **사람이 매번 verify를 정확히 2회 실행한다는 보장 없음**. 핸드오프 §"다음 할 일" #1 영속 의무도 사람 부주의로 1회로 단축 가능.

---

### 반론 #3 — "Playwright e2e 부재는 handoff §F.4 M12 carry-over이고 Phase 3 진입 시 도입 예정. Q-C-2는 시기상조."

**반박**:

- "Phase 3 진입 시 도입 예정" = **언제까지의 약속도 자동 게이트도 없음**.
- Phase 3 본격 진입 = 학습 UX 신규 컴포넌트 5종 이상 추가 영역 (memory `project_ux_north_star_phase3.md`: 객관식 라디오 / 주관식 분류 / 보기 랜덤 / 학습 모드 / 게이미피케이션). e2e 부재 상태로 5+ 컴포넌트 추가 = 사용자 시점 회귀 발견 0.
- 진산님 G9 수동 시도가 "2019년 제5회 제16문 순차적으로 나오네" 발견한 패턴 — Phase 3에서 컴포넌트 5개 신규 시 매번 진산님이 직접 시도해야 회귀 발견. **운영 cost 폭증**.
- 따라서 Q-C-2는 시기상조가 아니라 **Phase 3 진입 게이트 의무**가 본질.

---

### 깨질 수 있는 시나리오 (테스트 부채 곱연산)

**시나리오 X — 7건 곱연산 silent 회귀**:

1. Phase 3 launch 1주 스프린트 진입 (memory 묶음)
2. ADR-034 복원 시 password.test.ts:24 unskip 망각 (Q-C-1)
3. verify-engine-contracts.ts api required 카운트 갱신 망각 (Q-M-1)
4. TD-VRF-001 비결정성으로 CI 1회 FAIL → 재실행 PASS (Q-C-3)
5. Playwright e2e 부재로 사용자 시점 회귀 발견 0 (Q-C-2)
6. ADR-035 PBKDF2 100k 잔존 + register per-email rate-limit 부재 (Q-M-5)
7. 외부 사용자 진입 1명

**결과**: 외부 사용자 1명이 PASSWORD_MIN=4 + HIBP disable + rate-limit IP only + PBKDF2 100k 결합 환경에서 register brute-force 진행. 발견 시점은 다른 사용자가 본인 이메일로 회원가입 시도 시 "EMAIL_TAKEN" 응답을 받아 신고할 때까지 = **최악 N일**.

각 단계는 0.2~0.3 확률이나 **곱연산 0.001 미만**으로 보일 수 있다. 그러나 자동 게이트 없는 상태에서는 **각 단계가 독립이 아닌 conditional** (1주 스프린트 부담 → 모든 단계 누락 압력 동시 발생). 실제 결합 확률 추정 **0.05~0.10**.

본 시나리오 차단 = Q-C-1 + Q-C-2 + Q-C-3 동시 해소만으로 가능.

---

## 끝.

**리뷰 작성**: Claude (Opus 4.7 1M context) — Quality Engineer 페르소나 (테스트 부채 관점)
**리뷰 일시**: 2026-05-11 KST, Session 066 진입 직후
**판정**: CRITICAL 3건 / MAJOR 5건 / MINOR 4건 (총 12건, 4-Pass 중복 0)
**Phase 3 진입 게이트 권고**: Q-C-1 + Q-C-2 + Q-C-3 + Q-M-1 동시 해소 후 launch 허용
