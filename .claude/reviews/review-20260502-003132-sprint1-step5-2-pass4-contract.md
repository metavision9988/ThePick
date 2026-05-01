# Pass 4 (CONTRACT) — Sprint 1 §5.2 도구 정비 (commits fefa64a + ba9ad2b)

**Pass**: 4 of 4 — CONTRACT (기획 대조 + Silent Pivot 탐지)
**리뷰 대상**: Sprint 1 §5.2 Day 1 도구 정비 commit 2건
**리뷰 방식**: 독립 에이전트 1개 (quality-engineer 페르소나) — 자가 리뷰 아님 (Pass 4 단독)
**리뷰 일시**: 2026-05-02 00:31:32 KST
**리뷰자**: Claude (Opus 4.7 1M context) — quality-engineer 위임
**계약 (the contract)**: handoff-session-029.md §2.A + decision-2026-05-02-cha-03-05-p1-reclassification.md

---

## 0. 리뷰 범위 (변경 파일 + 연관 파일)

### 0.1 commit fefa64a — `docs(plan): CHA-03/05 P0 → P1 재분류`

| 파일                                                                               |  라인  | 종류 |
| :--------------------------------------------------------------------------------- | :----: | :--: |
| `.claude/reviews/review-sprint0-baseline-20260501-230231.md`                       |   +9   | 변경 |
| `docs/ThePick Engine Quality Test Master Plan v1.0.md`                             | +28/-7 | 변경 |
| `docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md` |  +168  | 신규 |

### 0.2 commit ba9ad2b — `chore(test): Sprint 1 §5.2 Day 1 도구 정비`

| 파일                                                                | 종류 |
| :------------------------------------------------------------------ | :--: |
| `.prettierignore`                                                   | 신규 |
| `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md`       | 신규 |
| `docs/quality/test-patterns.md`                                     | 신규 |
| `packages/parser/__fixtures__/claude-malformed/{01..08, README.md}` | 신규 |
| `packages/parser/__fixtures__/pdf-malicious/{01..05, README.md}`    | 신규 |
| `packages/shared/package.json`                                      | 변경 |
| `packages/shared/src/__tests__/test-helpers-perf.test.ts`           | 신규 |
| `packages/shared/src/test-helpers/perf.ts`                          | 신규 |

### 0.3 연관 파일 (계약 대조 대상)

- `.jjokjipge/handoff-session-029.md` (the contract — §2.A 6개 도구 명세)
- `docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md` (P1 재분류 결정)
- `docs/ENGINE_HARDENING_COMPLETION_REPORT.md` (v1.1 유지 — v1.2 미갱신 확인)
- `docs/ThePick Engine Quality Test Master Plan v1.0.md` 전체 (§11.1/§11.2/§13.1 외 §14.2/§14.3 일관성)
- `packages/parser/__fixtures__/batch1/` (기존 fixture 컨벤션)
- `pnpm-workspace.yaml` (`tests/` 미존재 검증)
- `.eslintrc.json` (Hard Rule 17 강제 + JSON ignorePatterns)

---

## 1. handoff-029 §2.A 명세 vs 본 commit 대조표

| handoff §2.A 명세                               | 시간 | 본 commit 산출물                                              | 정합 판정        |
| :---------------------------------------------- | :--: | :------------------------------------------------------------ | :--------------- |
| MSW Anthropic mock 확장                         |  2h  | **명시 이연** (test-patterns.md §2 banner)                    | ⚠️ 부분 (조건부) |
| Workers Vitest Pool 도입 검토 + ADR             |  3h  | ADR-028 (Option B = 이연 채택)                                | ✅ 완전          |
| sinon (또는 vi.useFakeTimers) 패턴 정립         | 0.5h | test-patterns.md §1                                           | ✅ 완전          |
| `tests/fixtures/pdf-malicious/` 5종 + README    | 1.5h | `packages/parser/__fixtures__/pdf-malicious/` 5종 + README    | ⚠️ 위치 변경     |
| `tests/fixtures/claude-malformed/` 8종 + README |  2h  | `packages/parser/__fixtures__/claude-malformed/` 8종 + README | ⚠️ 위치 변경     |
| `performance.now()` 측정 wrapper                |  1h  | `packages/shared/src/test-helpers/perf.ts` + 13 회귀 테스트   | ✅ 완전          |

**전체 정합도**: 5/6 정합 + 1 명시 이연 (정당한 사유). MSW 이연은 decision-2026-05-02 §4.4와 정합.

---

## 2. 검증 항목별 판정

### 2.1 위치 변경의 정당성 (handoff "tests/fixtures" → "packages/parser/**fixtures**")

✅ **PASS**. 정당화 근거:

- **`pnpm-workspace.yaml` 검증**: workspace 라인 `apps/* / modules/* / packages/*` — `tests/` 미포함. repo-rooted `tests/fixtures/` 생성 시 workspace 외부 위치가 되어 패키지 의존성 관리 부담.
- **기존 컨벤션 정합**: `packages/parser/__fixtures__/batch1/exam_scope.pdf` 가 이미 존재. 동일 디렉토리 패턴 채택 = 일관성 확보.
- **사용 주체 정합**: pdf-malicious는 `packages/parser/src/pdf-extractor.ts`, claude-malformed는 `packages/parser/src/schema-validator.ts` 가 진입점. fixtures가 사용자 패키지에 위치 = locality of reference 원칙 정합.
- **commit message 명시**: ba9ad2b 본문이 새 경로를 직접 인용 (`packages/parser/__fixtures__/pdf-malicious/`).

⚠️ **MAJOR-1 (위치 변경 transparency)**:

- commit message 어디에도 "handoff §2.A `tests/fixtures/` → 본 commit `packages/parser/__fixtures__/` 이동" 의 명시적 변경 사유 진술 부재.
- 두 README는 위치 변경을 언급하지 않음 (4번 fixture 명세 변경은 README §2.4 / §2.7 에 정직 기록되었으나 위치는 누락).
- 차세션 Claude 또는 진산님이 handoff §2.A의 `tests/fixtures/` 표현을 그대로 검색하면 mismatch 발견.
- **확인 위치**: ba9ad2b commit body / packages/parser/**fixtures**/{pdf-malicious,claude-malformed}/README.md §1 표.

### 2.2 fixtures 명세 변경의 정직성

✅ **PASS** (명세 변경 자체는 정합. 의도 약화 없음).

#### 2.2.1 `04-missing-required-field.json` — handoff "examId 누락" → "필수 필드 누락"

- **README §2.4 정직 기록**: "원래 명세는 'examId 누락' 이지만, 현 schema-validator 의 `KnowledgeContract` 타입에 `examId` 필드가 부재 (Hard Rule 16 정합 — examId 는 함수 파라미터로 주입). 따라서 본 fixture 는 **node 레벨 필수 필드 (truth_weight) 누락** 으로 동등한 vector 를 재현."
- **Hard Rule 16 정합 검증**: production-quality.md Rule 16 본문 "데이터 조회 래퍼 함수는 첫 번째 인자로 `examId: ExamId`를 받는다 ... 현 schema-validator 의 `KnowledgeContract` 타입에 `examId` 필드가 부재" 와 정확히 정합.
- **의도 약화 여부**: 검증 의도는 "필수 필드 누락 시 Claude 응답 거부". `examId` 가 schema-validator 에 부재하므로 다른 필수 필드 (`truth_weight`) 로 동등 vector 재현 = 검증 효과 동등. ⚪ **약화 0건**.

#### 2.2.2 `07-large-payload.json` — handoff "100MB" → "~120KB sentinel"

- **README §2.7 정직 기록**: "원래 명세는 '100MB' 이지만, **git LFS 미설정 + repo 부담 회피** 를 위해 sentinel 크기 (~120 KB) 로 재현. 검증 의도는 동일 — D1 transaction 1 MB 한도 보호."
- **실제 파일 크기 검증**: `wc -c < 07-large-payload.json` ≈ 120 KB.
- **의도 약화 여부**: D1 1 MB 한도가 검증 임계값. 120KB < 1MB 이므로 임계값 초과 검증을 위해서는 schema-validator 의 임계값을 더 낮게 (예: 100 KB) 설정하면 동일 vector 검증 가능. README §2.7 본문이 "schema-validator 의 임계값에 따라 가변" 명시 — ⚪ **약화 0건** (테스트 코드에서 임계값 설정 책임 이전).

✅ **PASS** — 두 변경 모두 정직 기록 + 의도 보존.

### 2.3 MSW 이연의 정합성 (§5.3 NOT-IMPL 차단 영향)

✅ **PASS**. 검증:

- **test-patterns.md §2 banner의 4가지 이연 사유**:
  1. CHA-03 P1 재분류 (decision-2026-05-02 정합)
  2. CHA-05 P1 재분류 (Phase 1 후반 hybrid-search 활성)
  3. FUZ-02 fixtures 직접 `fs.readFile()` 패턴 — HTTP layer 부재
  4. MSW pnpm-lock 미존재 (Master Plan v1.0 §12 line 872 "✅ (이미 사용)" 부정확 정직 인정)

- **§5.3 NOT-IMPL 7건 작업 차단 영향 검증**:

  | 시나리오                         | MSW 의존 여부                | 차단 여부 |
  | :------------------------------- | :--------------------------- | :-------- |
  | CHA-01 (D1 disconnect)           | ❌ Proxy wrap (ADR-028 §4.1) | ⚪ 0건    |
  | CHA-02 (CalculationTimeoutError) | ❌ formula-engine 단위       | ⚪ 0건    |
  | CHA-04 (wall clock skew)         | ❌ vi.useFakeTimers          | ⚪ 0건    |
  | FUZ-01 (5종 PDF)                 | ❌ packages/parser fs 직접   | ⚪ 0건    |
  | FUZ-02 (8종 변조)                | ❌ schema-validator fs 직접  | ⚪ 0건    |
  | REC-01 (4 시점 × 10 반복)        | ❌ checkpoint.test.ts        | ⚪ 0건    |
  | REC-02 (4 변조)                  | ❌ checkpoint.test.ts        | ⚪ 0건    |

  **차단 0건** = ba9ad2b commit body 마지막 줄 "§5.3 NOT-IMPL 7건 작업 차단 0건" 진술 정확.

- **트래킹 가능성 검증**:
  - test-patterns.md §2 banner "Phase 2 CHA-03 P1 진입 시점 의무" → 4가지 의무 항목 명시 (`pnpm add -D msw -w` / helpers 신규 / anthropic-adapter 본격 구현 / 본 §2 갱신).
  - decision-2026-05-02 §5.3 "Phase 2 진입 직전 (BATCH-1 적재 후 사용자 노출 전)" 와 정확히 정합.
  - ⚠️ **MINOR-1**: ENGINE_HARDENING_COMPLETION_REPORT v1.2 갱신 (decision §5.2) 시점에 §10.7 #16/#17 신규 항목으로 함께 트래킹되도록 명세되어 있으나, v1.2 갱신은 본 commit 시점 미수행 (정합).

### 2.4 Sprint 1 종료 게이트 변경 (17/17 → 15/15)

✅ **부분 PASS** + 🟠 **MAJOR-2** (Master Plan §14.2/§14.3 일관성 누락):

- **§11.1 P0 갱신** (line 810): "P0 (BATCH-1 진입 전 필수) — 15건 (v1.0.1)" ✅
- **§11.2 P1 갱신** (line 828): "P1 (BATCH-1 적재 후 1주 내) — 20건 (v1.0.1)" ✅
- **§13.1 페이즈 게이트** (line 891-898): "P0 15건 → 15/15 PASS" / "P1 20건 + P0 회귀 → 35/35 PASS" ✅ (산수 검증: 15+20=35 정합)

**🟠 MAJOR-2: §14.2 / §14.3 미갱신 (Master Plan 자체 모순)**:

- **§14.2 Sprint 1 (line 950)**: "P0 17건 GREEN 만들기" — 17 → 15 갱신 누락 ❌
- **§14.2 Day 1-2 (line 953)**: "CHA 6건 + REG 2건" — CHA-03/05 P1 이연으로 4건 이어야 함 ❌
- **§14.2 Day 5 (line 956)**: "17건 모두 GREEN 확인 + JSON 리포트 생성" — 15건 ❌
- **§14.3 Sprint 2 (line 965)**: "P1 18건 GREEN + 회귀 (P0 17건 재실행)" — P1 20건 + P0 15건 ❌
- **§14.1 Sprint 0 Day 3 (line 946)**: "P0 17건 baseline 측정" — 본 measurement 는 사후 사실이라 변경 부적절 (PASS 처리 가능, 다만 Master Plan 본문 일관성 누락 신호)

- **v1.0.1 patch banner (line 15)**: "본 패치는 §11.1 / §11.2 / §13.1 에만 적용. 시나리오 본문 (§5 카오스 등) 정의는 변경 없음." — §14.2/§14.3 은 시나리오 본문이 아닌 **Sprint 일정 명세** 이므로 banner의 "변경 없음" 면제 대상 아님.
- **위험**: 차세션 Claude 또는 진산님이 §14.2/§14.3 을 읽고 "P0 17건 / P1 18건" 으로 진행 → 종료 게이트 거짓 통과 위험.
- **확인 위치**: `docs/ThePick Engine Quality Test Master Plan v1.0.md:946,950,953,956,965`.

**🟠 MAJOR-3: §12 line 872 MSW 가용성 정직성 결손**:

- **§12 line 872**: `| **MSW** | 외부 API mock | 5 | ✅ (이미 사용) |`
- **test-patterns.md §2 banner #4**: "MSW 미설치 (pnpm-lock 미존재) — Master Plan v1.0 §12 의 '✅ (이미 사용)' 기재는 부정확."
- **commit ba9ad2b가 test-patterns.md §2 에서 직접 인정한 부정확 표현이 동일 commit 의 영향 대상인 Master Plan §12 본문에는 그대로 유지됨** = 자기 모순.
- **위험**: §12 만 읽는 독자는 MSW 가 가용하다고 오해.
- **확인 위치**: `docs/ThePick Engine Quality Test Master Plan v1.0.md:872` vs `docs/quality/test-patterns.md:62-67`.

### 2.5 테스트 카운트 회귀

✅ **PASS** (회귀 0건):

- **shared 33 → 46 PASS** 검증: `pnpm --filter @thepick/shared test` 결과 = `Test Files 2 passed (2) / Tests 46 passed (46)`. 회귀 0건. +13 perf 회귀.
- **api 261 PASS** 검증: `Tests 261 passed (261)`. 회귀 0건.
- **quality 48 PASS** 검증: `Tests 48 passed (48)`. 회귀 0건.
- **batch 238 PASS** 검증: `Tests 238 passed (238)`. 회귀 0건.

⚠️ **MINOR-2 (관찰)**: 첫 번째 batch 테스트 실행 시 `1 failed | 237 passed (238)` 일시적 결과. 즉시 재실행에서 `238 passed` 회복. **flakiness 신호** 가능. Sprint 1 §5.2 commit과 직접 인과 무관하나 Sprint 1 §5.4 보강 시 재현성 확인 권고 (handoff-029 §6 의무 #2 "MAJOR 5건 이월" 와 별도 트래킹).

### 2.6 ENGINE_HARDENING_COMPLETION_REPORT v1.2 미갱신 정합

✅ **PASS** (정합):

- decision-2026-05-02 §5.2: "Sprint 1 §5.4 완료 후 v1.2 일괄 갱신" ← 명시 이연.
- **검증**: `git diff fefa64a^ ba9ad2b -- docs/ENGINE_HARDENING_COMPLETION_REPORT.md` = empty diff. v1.1 유지 확인.
- handoff-029 §3.2 권고 A 와 정확히 정합 ("Sprint 1 §5.4 완료 후 일괄 흡수").

### 2.7 ADR 번호 (ADR-026 결번 + ADR-028)

✅ **PASS** (의도된 결번):

- **ADR-026 결번 검증**: `docs/ENGINE_HARDENING_COMPLETION_REPORT.md:287` 본문에 "ADR-001 ~ ADR-027, ADR-026 결번" 명시 — 의도된 결번 (ENGINE vs SERVICE BOUNDARY 후보 ADR 가 다른 ADR-027 로 흡수됨).
- **ADR-028 헤더 패턴 검증**: ADR-027 헤더 (`상태 / 결정일 / 결정자 / 관련 헌법 / 관련 ADR / 관련 plan / 트리거`) 와 비교:
  - ADR-028 line 3-10: 동일 7항목 + `관련 결정` 1개 추가 (decision-2026-05-02 참조).
  - 헤더 메타데이터 패턴 정합. ⚪ **PASS**.

### 2.8 decision-2026-05-02 §5 후속 의무 체크

✅ **PASS** (모든 즉시 의무 수행):

| 항목                                                         | 의무 위치           | 본 commit 수행 | 검증                              |
| :----------------------------------------------------------- | :------------------ | :------------: | :-------------------------------- |
| 본 결정 문서 작성                                            | §5.1 [x]            |       ✅       | fefa64a 신규                      |
| Master Plan §11.1 / §11.2 갱신                               | §5.1 [ ]            |       ✅       | line 810/828                      |
| review-sprint0-baseline 상단 banner                          | §5.1 [ ]            |       ✅       | line 1-14 추가                    |
| §5.2 도구 정비 진입                                          | §5.1 [ ]            |       ✅       | ba9ad2b 본격 진행                 |
| ENGINE_HARDENING_COMPLETION_REPORT v1.2 갱신 (Sprint 1 §5.4) | §5.2 (이연 의무)    |   ⚪ 미수행    | 정합 (decision §5.2 의 이연 명시) |
| Phase 2 진입 직전 P1 게이트                                  | §5.3 (Phase 2 의무) |   ⚪ 범위 외   | Sprint 1 미적용                   |

decision §5.1 의 4개 즉시 의무 모두 commit fefa64a + ba9ad2b 에 의해 수행 완료. ⚪ PASS.

---

## 3. Pass 4 정량 보고

### 3.1 결과 매트릭스

| 분류        | 카운트 | 항목                                                                                                                                             |
| :---------- | :----: | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ PASS     |   8    | 위치 변경 정당성 / fixtures 명세 정직성 / MSW 이연 정합 / 종료 게이트 (§11/§13) / 테스트 회귀 / Report v1.2 미갱신 / ADR 번호 / decision §5 의무 |
| 🔴 CRITICAL |   0    | —                                                                                                                                                |
| 🟠 MAJOR    |   3    | MAJOR-1 (위치 변경 transparency) / MAJOR-2 (§14.2/§14.3 미갱신) / MAJOR-3 (§12 line 872 MSW 정직성 결손)                                         |
| 🟡 MINOR    |   2    | MINOR-1 (Report v1.2 트래킹) / MINOR-2 (batch flakiness)                                                                                         |
| ⚪ N/A      |   2    | (CHA-03/05 P1 본격 구현은 Phase 2) / (Workers Pool 도입 본격은 Phase 2)                                                                          |

### 3.2 test-patterns.md 자체 결함 (commit ba9ad2b 내부 모순)

🟠 **MAJOR-4 (test-patterns.md self-contradiction)**:

- **§4 line 134-135**: `tests/fixtures/pdf-malicious/` / `tests/fixtures/claude-malformed/` 경로 사용. 그러나 **동일 commit ba9ad2b 가 fixtures를 `packages/parser/__fixtures__/...` 에 생성**. test-patterns.md 가 자기 commit 내 산출물의 실제 경로를 잘못 기재.
- **§5 line 145**: ADR 경로 `docs/adr/ADR-028-workers-vitest-pool.md` — **실제 파일은 `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md`** (broken link).
- **§5 line 147**: "본 시점 (Year 1 Phase 1) 에서는 **Hono mock + MSW 조합으로 충분**" — §2 banner 가 MSW 미설치 + 이연을 인정함에도 §5 본문은 "MSW 조합으로 충분" 으로 정반대 진술. 자기 모순.
- **위험**: 차세션 Claude 가 test-patterns.md §4/§5 만 읽고 잘못된 경로 / broken ADR link / 잘못된 MSW 가정 으로 작업 진행.
- **확인 위치**: `docs/quality/test-patterns.md:134-135,145,147`.

### 3.3 Devil's Advocate 반론 (Silent Pivot 의심)

**의심 1: handoff §2.A "tests/fixtures/" 명시 → 본 commit "packages/parser/**fixtures**/" 변경이 Silent Pivot인가?**

- **반론 평가**: ⚪ **Silent Pivot 아님** — 명시적 사유 (workspace 부재 / 기존 컨벤션 정합) 가 정당. 다만 **commit message 진술 누락 = transparency 결손** = MAJOR-1.
- **참고**: handoff §2.A 의 `tests/fixtures/` 표기가 handoff 작성 시점 (2026-05-01)의 의도 였을 뿐, 절대적 명령은 아님. handoff 자체가 차세션 적응 권고 문서이므로 정당화된 변경은 허용.

**의심 2: MSW 이연이 handoff §2.A 명시 작업 (2h) 의 임의 스킵인가?**

- **반론 평가**: ⚪ **Silent Pivot 아님** — decision-2026-05-02 §4.4 "MSW Anthropic mock 우선순위 강등 가능 (CHA-03 P1 진입 직전 의무 → Sprint 2 또는 별도 sprint 로 일정 분산)" 가 사전 승인. test-patterns.md §2 banner 에 4가지 이연 사유 명시. 진산님 "P0 → P1 재분류 + §5.2 진입" 트리거 키워드 (handoff §5) 가 본 시나리오 의미 = MSW 자연 이연 정합.

**의심 3: Master Plan §14.2/§14.3 미갱신이 의도된 누락 (§5 카오스 면제) 인가?**

- **반론 평가**: ⚠️ **부분 Silent Pivot 의심** — v1.0.1 patch banner 가 "§5 카오스 등 시나리오 본문" 만 면제 명시. §14.2/§14.3 은 시나리오 본문이 아닌 **Sprint 일정 명세**. 실수 누락 vs 의도 면제 판별 불가능 → MAJOR-2 로 분류.
- **권고 흡수 시점**: Sprint 1 §5.4 + ENGINE_HARDENING_COMPLETION_REPORT v1.2 갱신 동시.

**의심 4: Workers Vitest Pool 이연 결정 (Option B 채택) 이 작업 회피인가?**

- **반론 평가**: ⚪ **Silent Pivot 아님** — ADR-028 §3 가 Option A/B/C/D 4안 비교 + §4 의 5가지 비용 분석 (의존성 / 런타임 분리 / `node:sqlite` 차단 / CI 시간 / CHA-05 미가용) 명시. 의사결정 정합. Phase 2 진입 직전 재검토 트리거 4가지 명시 = 회피 아닌 적시 도입.

**의심 5: ENGINE_HARDENING_COMPLETION_REPORT v1.2 미갱신이 정직성 회피인가?**

- **반론 평가**: ⚪ **Silent Pivot 아님** — decision §5.2 가 명시적 이연 ("Sprint 1 §5.4 완료 후 일괄 갱신"). v1.1 흡수 패턴 (Phase B 머지 후 v1.1.1 별도 commit 안 함) 정합. 다만 MINOR-1 (#16/#17 트래킹 의무) 는 차세션 의무로 명시.

---

## 4. 권고 (Critical/Major 흡수 우선순위)

### 4.1 즉시 흡수 의무 (현 commit chain 전 권고)

🔴 CRITICAL: 0건.

🟠 **MAJOR-2 + MAJOR-4**: 단일 후속 commit 으로 묶어 즉시 흡수 권고:

```
docs(plan): Master Plan v1.0.1 일관성 패치 — §14.2/§14.3/§12 + test-patterns.md §4/§5

- Master Plan §14.2 line 950/953/956: P0 17건 → 15건 / CHA 6건 → 4건
- Master Plan §14.3 line 965: P1 18건 → 20건 / P0 17건 → 15건
- Master Plan §12 line 872: MSW "✅ (이미 사용)" → "⚠️ (Phase 2 도입 의무)"
- test-patterns.md §4 line 134-135: tests/fixtures/ → packages/parser/__fixtures__/
- test-patterns.md §5 line 145: ADR-028 정확 경로 (-deferred-to-phase-2 suffix)
- test-patterns.md §5 line 147: "Hono mock + MSW 조합 충분" → "Hono mock + Proxy wrap 충분 (MSW 이연)"
```

소요: ~30분 추정. fefa64a + ba9ad2b 이후 단일 commit 권고.

### 4.2 다음 Sprint 1 §5.3 진입 시점 흡수

🟠 **MAJOR-1 (위치 변경 transparency)**: §5.3 첫 commit (CHA-01 또는 FUZ-01 신규 구현) 의 README 갱신 시점에 **packages/parser/**fixtures**/{pdf-malicious,claude-malformed}/README.md §1 표 footnote** 로 "본 위치는 handoff-029 §2.A `tests/fixtures/` 명세 대비 변경 — 사유: workspace `tests/` 부재 + `packages/parser/__fixtures__/batch1/` 컨벤션 정합" 추가.

### 4.3 Sprint 1 §5.4 완료 후 흡수

🟡 **MINOR-1**: ENGINE_HARDENING_COMPLETION_REPORT v1.1 → v1.2 갱신 시 §10.7 #16/#17 신규 (anthropic-adapter NOT_IMPL + hybrid-search 미활성) + §0/§14 결론 갱신.

🟡 **MINOR-2**: batch 테스트 flakiness 재현성 확인. token-cost-logger 테스트 또는 pipeline.integration.test.ts 의 race condition 가능성 추적.

---

## 5. 판정

**Pass 4 (CONTRACT) 단독 판정**: ⚠️ **수정 필요** (흡수 의무 MAJOR 4건).

- 🔴 CRITICAL 0건 → 4-Pass 공통 "완료 가능" 충족 가능 후보.
- 🟠 MAJOR 4건 → auto-review-protocol.md "MAJOR phase 종료 전 해결 또는 다음 phase 명시 이월" 정합 적용.
- **권고**: §4.1 즉시 흡수 commit (~30분) 후 4-Pass 통과 재선언 가능. §5.3 진입 보류 권고.

본 commit 2건 (fefa64a + ba9ad2b) 의 의도와 산출물의 본질 정합도는 양호 (handoff §2.A 6/6 도구 모두 합리적 처리). 결손은 모두 **문서 일관성 누락** 영역 (Master Plan 자체 모순 + test-patterns.md 자체 모순). decision-2026-05-02 + ADR-028 + perf wrapper + fixtures 본체는 정합.

본 Pass 4 산출물은 Pass 1/2/3 (Surgeon / Architect / Advocate) 결과와 통합되어 4-Pass 종합 인덱스 생성 의무. handoff-029 §6 "MAJOR 5건 이월" 정합으로 본 4건 누적 처리.

---

## 6. 본 Pass 4 의 한계 (정직)

1. **단독 Pass 4 한계**: Pass 1 (Surgeon — 코드 정합성) / Pass 2 (Architect — 연계 검증) / Pass 3 (Advocate — UX + 보안) 결과 부재. 본 Pass 4 결론 "MAJOR 4건" 은 CONTRACT 차원 한정. perf.ts 의 V8 microtask queue 동기화 / claude-malformed JSON 의 실제 schema-validator 진입 시 throw 분류 정합 / Hard Rule 17 정합 등은 Pass 1/2 영역.
2. **Hard Rule 17 ESLint 강제 검증 한계**: `.eslintrc.json` ignorePatterns `**/*.json` 으로 fixture #8 의 `son-hae-pyeong-ga-sa` literal 통과는 형식적 PASS. 실제 schema-validator 진입 시 정규식 매칭 → throw 동작은 본 commit 에서 미검증 (FUZ-02 본격 구현은 §5.3).
3. **Master Plan §14.2/§14.3 누락의 작동 영향 한계**: §13.1 페이즈 게이트가 binding 진실 = 종료 게이트 거짓 통과 위험은 §14.2/§14.3 혼선 시 발견. 진산님 또는 차세션 Claude 가 §13.1 우선 참조 시 영향 미미. 다만 transparency 의무.
4. **batch flakiness 인과 한계**: 첫 번째 실행 1 failed 의 stack trace 미수집. token-cost-logger 의 console output 만 stderr 로 노출. 본 §5.2 commit 과 직접 무관 가능성 높으나 단정 불가.

---

**Pass 4 작성 완료 시점**: 2026-05-02 00:31:32 KST
**작성자**: Claude (Opus 4.7 1M context) — quality-engineer 페르소나 단독 Pass 4
**다음 의무**: Pass 1/2/3 결과 + 본 Pass 4 통합 인덱스 (`review-20260502-{HHMMSS}-sprint1-step5-2-4pass.md`) 작성
**판정 효력**: 본 Pass 4 단독 = 수정 필요 (MAJOR 4건). 4-Pass 종합 판정 시 Pass 1/2/3 CRITICAL 0건 + MAJOR 흡수 계획 동시 평가 의무.
