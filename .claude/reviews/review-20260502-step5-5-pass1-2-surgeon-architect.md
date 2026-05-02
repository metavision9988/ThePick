# Sprint 1 §5.5 종료 게이트 — Pass 1 SURGEON + Pass 2 ARCHITECT (통합)

**작성일**: 2026-05-02 ~14:55 KST
**리뷰 방식**: 독립 에이전트 (`pr-review-toolkit:silent-failure-hunter`) — 자가 리뷰 금지 정합 (`auto-review-protocol.md` 규칙 0)
**리뷰 범위**: 변경 파일 1개 (`scripts/verify-engine-contracts.ts` +~140 lines, P0_SCENARIOS + countP0Scenarios + cat5 갱신) + 연관 파일 ~20개 (P0 시나리오 15 file + master-test-checklist + completion report v1.1 + handoff-033)

---

## Pass 1 (Surgeon) — Bottom-Up 코드 정합성

**결과**: ✅ 6건 / 🔴 0건 / 🟠 3건 / N/A 1건

### 확인 (PASS)

1. **P0_SCENARIOS 15 entries 파일 모두 실재** (`verify-engine-contracts.ts:373-464` vs filesystem) — 15/15 OK 확인. missing array 비어 있으면 status=PASS 정상.
2. **타입 안전성** (line 366-371) — P0Scenario interface readonly + mapping union literal. 15 entries 전부 mapping 값 직접 점검: REG-01/02 alias, PRC-02 alias, 나머지 12 direct. 매핑 합 = 12 direct + 3 alias = 15. 타입 mismatch 0건.
3. **빈 catch 회피** (line 471-481) — try block readdirSync 실패 시 catch 에서 `missing.push(s.id)` — 명시적 fail 누적 경로. production-quality.md 빈 catch 금지 원칙 준수.
4. **filename 추출 안전성** (line 473) — `s.file.split('/').pop() ?? ''` — const literal 항상 `/` 포함. fallback 도달 불가. 실질 안전.
5. **JSON output 정합** (line 483-490) — observed/required/status 가 NumericMetric 인터페이스 준수. cat5.status = p0Count.status 직결.
6. **observed/required 비교식** (line 489) — `exists >= P0_SCENARIOS.length`. 15 ≥ 15 PASS. 다른 numeric 게이트와 동일한 단방향 게이트 (감소 차단) 패턴.

### 🟠 MAJOR 3건

#### MAJOR-S1 — catch 에러 코드 미분류 silent dedup

- **위치**: `verify-engine-contracts.ts:479` `catch { missing.push(s.id) }`
- **Hidden Errors**: (a) EACCES permission, (b) ENOTDIR, (c) EMFILE 한도, (d) EIO IO error
- **User Impact**: missing list 에 단순 `'CHA-06'` 만 — 파일 부재인지 권한인지 IO 에러인지 구분 0. `feedback_two_fix_failures_zoom_out` 메모리 직격.
- **권고**: `catch (err)` + `(err as NodeJS.ErrnoException).code` 와 함께 missing.push.
- **흡수 상태**: ✅ 즉시 흡수 완료 (commit 본 §5.5 동시) — `${s.id} (${code})` 형식 적용.

#### MAJOR-S2 — readdirSync vs existsSync 단순화

- **위치**: line 472 `readdirSync(dirname(fullPath))`
- **평가**: 부모 디렉토리 전체 readdir 후 includes — O(N) 메모리. existsSync 또는 statSync 단일 call 이 더 직관적.
- **흡수 상태**: 🟡 §5.5 종료 후 또는 Sprint 2 초기 흡수 (성능 영향 미미, 우선순위 낮음).

#### MAJOR-S3 — file 존재만 검증, vitest skip silent 가능

- **위치**: line 363-364 주석 vs 실 코드
- **Hidden Bug**: `it.skip(...)` / `describe.skip(...)` / `it.todo(...)` 만 남기면 file 존재 PASS, vitest passedTests 줄어들지만 cat 1+2+3 required 가 stale 하면 dedup.
- **권고**: `it.skip / describe.skip / .todo` grep 으로 fail-safe.
- **흡수 상태**: ✅ 즉시 흡수 완료 — `checkP0NoSkippedTests()` boolean metric 추가, cat5.booleans 에 포함.

### N/A

- async/await 흐름: countP0Scenarios() 동기 (readdirSync). main() async 흐름에서 await 없이 직접 호출 — 동기 함수 호출에 await 불필요. N/A.

### Devil's Advocate

CI 가 git submodule 일부 디렉토리 clone 누락 시 readdirSync OK + includes false → missing CHA-06 추가 → cat5 FAIL. 정상 작동. 그러나 cat 1+2+3 vitest 가 cha-06 미실행으로 batch=stale required 통과하면 silent dedup 가능. **CRITICAL-A1 카운트 갱신으로 cat 1+2+3 회귀 차단 확보 필요.**

---

## Pass 2 (Architect) — Top-Down 연계 검증

**결과**: ✅ 4건 / 🔴 2건 / 🟠 4건 / N/A 1건

### 확인 (PASS)

1. **P0 매핑 단일 출처 cite** (script header line 30 → master-test-checklist v1) — handoff-033 §1 line 76-78 PASS 15/15 set 와 1:1 매핑.
2. **Cat 5 SKIP→PASS 전환 산식 정합** — `counted = filter !== SKIP` 5개 (Cat 1+4+5+6+7), skipCount 1 (Cat 8). overall = failCount === 0 ? PASS : FAIL.
3. **CRITICAL RULE #1 (Silent Pivot 회피)** — 본 변경은 Sprint 1 §5.5 plan 명세 정합 (handoff-033 §2.A). 그러나 보고서 v1.1 §10.3 / §10.6 / §10.7 의 "Cat 5 SKIP" 명시와 충돌 (CRITICAL-A2 참조).
4. **Workers 호환** N/A — verify 는 Node.js 빌드 환경 전용.

### 🔴 CRITICAL 2건

#### CRITICAL-A1 — VITEST_PACKAGES required 카운트 stale

- **Evidence**:
  - script 본 시점: shared **33** / formula-engine **251** / parser **136** / quality **41** / batch **236** / api **199** / ai-adapter 13
  - handoff-033 §0.3 §5.4 종료 시점 실측: shared **50** / formula-engine **303** / parser **155** / quality **57** / batch **309** / api **277** / ai-adapter 13
  - 차이: **+255 PASS silent** (§5.3+§5.4 누적 증분이 verify required 에 미반영)
- **단방향 게이트 의미 붕괴**: required stale 한 한, 회귀 +N PASS 삭제 silent. countMigrations line 345 주석 정의된 "갱신 망각 = 신규 검증 0건 PASS" 패턴 정확히 적용.
- **흡수 상태**: ✅ 즉시 흡수 완료 — line 138~146 갱신 + 위 주석 영속 (단방향 갱신 의무 명시).

#### CRITICAL-A2 — Cat 5 SKIP→PASS 갱신과 보고서 §10.6 정합 충돌

- **Evidence**:
  - report v1.1 line 945 `[Cat 5] SKIP — 성능 테스트 (Phase 2)`
  - report v1.1 line 987 `Cat 1/2/3/4/6/7 — Cat 5/8 명시 SKIP`
  - report v1.1 line 1006 §10.7 검증되지 않은 영역 #4 = "Cat 5 0건"
  - master-test-checklist v1 §5 = "Cat 5 = LLM 통합 후 / Phase 2 위임"
- **Drift 위험**: 6개월 뒤 진산님이 보고서만 보면 "Cat 5 SKIP" 인지 → verify 가 PASS 보고하는 것과 모순. silent pivot 7번째 발생 위험.
- **흡수 상태**: ✅ 부분 흡수 (cat5.name 분리 명세 "Cat 5A | Cat 5B" + cat5.notes 5번째/6번째 명시) + 🟡 v1.2 보고서 갱신 의무 (task #6 진입 게이트).

### 🟠 MAJOR 4건

#### MAJOR-A1 — git grep vs readdirSync 검증 강도 비대칭

- E2E (line 449) 는 `git grep -lE "AC-RP-..."` (content match). P0 (line 466) 는 `readdirSync + includes` (file 존재). 강도 비대칭.
- **흡수 상태**: 🟡 §5.5 종료 후 흡수 (Sprint 2 초기) — `git grep -l "describe('P0 ${id}'..."` 패턴 통일 또는 testid reporter 통합.

#### MAJOR-A2 — handoff-033 §6.1 ledger M-1 (CHA-06 row count invariant) cross-reference 부재

- P0_SCENARIOS line 433-437 CHA-06 매핑이 file 존재만 검증 → row count invariant 누락 사실 비가시.
- **흡수 상태**: 🟡 Sprint 2 초기 흡수 (apps/api/scheduled/**tests**/cha-06 회귀 추가).

#### MAJOR-A3 — Hard Rule 16 시그니처 자동 검증 0건

- cat 7 booleans 에 hr17 / formulaSafety / innerHtml / consoleCheck 4종만. Hard Rule 16 (examId 시그니처) 자동 검증 부재.
- **흡수 상태**: 🟡 §5.5 종료 후 또는 Phase 1 5-페르소나 심층 리뷰.

#### MAJOR-A4 — P0_SCENARIOS single-source-of-truth 위반

- script 의 15 entries 가 master-test-checklist v1 본문에 동일 표 미존재. drift 가능성.
- **흡수 상태**: 🟡 Sprint 2 초기 — master-test-checklist v3 갱신 시 P0 매핑 표 통합 + script 가 master-test-checklist parsing.

### N/A

- IndexedDB ↔ D1 동기화 — verify build-time 검증으로 무관.

### Devil's Advocate

P0_SCENARIOS entry 1개 삭제 (예: PRF-02). length 14 → required 14 → exists 14 → PASS. 본 게이트가 entry 삭제 차단 부재.

- **흡수 상태**: ✅ 즉시 흡수 — `P0_SCENARIOS.length !== 15` 강제 assert 추가 (countP0Scenarios 진입 첫 줄).

---

## Pass 1+2 종합

**판정**: 즉시 흡수 4건 (CRITICAL-A1 + MAJOR-S1 + MAJOR-S3 + Devil's Advocate length assert) + 부분 흡수 1건 (CRITICAL-A2 cat5.notes 보강, v1.2 보고서 갱신 의무로 잔여) + 이월 5건 (MAJOR-S2 / A1 / A2 / A3 / A4).

### 즉시 흡수 검증

본 4-Pass 결과 확정 후 verify 재실행 시:

- VITEST_PACKAGES 갱신 카운트 (50/303/155/57/309/277/13) 로 cat 1+2+3 numerics 통과
- countP0Scenarios length assert + err.code 분류 + checkP0NoSkippedTests boolean
- cat5.name "Cat 5A | Cat 5B 분리" + cat5.notes 6건 (file 존재 + cat 1+2+3 결합 + v1.2 갱신 의무)

### 이월 ledger (handoff-034 §6 추가 의무)

|  #  | 항목                                     | 위치                         | 흡수 시점               |
| :-: | :--------------------------------------- | :--------------------------- | :---------------------- |
|  1  | MAJOR-S2 existsSync 단순화               | verify line 472              | Sprint 2 초기           |
|  2  | MAJOR-A1 git grep 패턴 통일              | verify P0 검증               | Sprint 2 초기           |
|  3  | MAJOR-A2 CHA-06 row count invariant      | apps/api/scheduled/**tests** | Sprint 2 초기           |
|  4  | MAJOR-A3 Hard Rule 16 시그니처 자동 검증 | verify cat 7                 | Phase 1 5-페르소나 심층 |
|  5  | MAJOR-A4 P0 single-source-of-truth       | master-test-checklist v3     | Sprint 2 초기           |

---

**보고서 작성**: Claude (Opus 4.7 1M context) — Session 033 (메인 컨텍스트가 독립 에이전트 결과 영속)
**원본 에이전트**: `pr-review-toolkit:silent-failure-hunter` (agentId: `ac78695c5c81a196b`)
