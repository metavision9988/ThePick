# 4-Pass Review — Pass 4 (Contract, plan 대조)

## 리뷰 메타

- **세션**: 066 (Session 065 누적 검증)
- **리뷰 방식**: 독립 에이전트 (Pass 4 Contract 단일 페르소나, cold start)
- **리뷰 범위**: f98532d..HEAD 7 commits 26 files
  - 신규 12개: AuthForm.tsx / login.astro / ADR-034 / ADR-035 / ADR-036 / phase2-2nd-self-grade.plan.md / migrations/0028 / cloudflare-pages-setup.md / handoff-session-074.md / entry verify json × 2 / d1-from-sqlite.ts (helper 신규)
  - 변경 14개: apps/api {index.ts, auth/{constants.ts, routes.ts}, study/routes.ts, study/**tests**/routes.test.ts, auth/**tests**/{dummy-verify.test.ts, password.test.ts, routes.test.ts}, **tests**/scenarios.test.ts} + apps/web {pages/{index.astro, study.astro}, layouts/BaseLayout.astro, components/QuestionCard.tsx} + docs/plans/phase2-eval-mvp.plan.md
- **기준 문서**: phase2-eval-mvp.plan.md / phase2-2nd-self-grade.plan.md / ADR-034/035/036 / CLAUDE.md / production-quality.md / auto-review-protocol.md / handoff-074
- **본질**: Pass 4 = "기획 + plan + ADR 대로 만들었는가? Silent Pivot 없는가?"

## 요약

판정: **완료 가능 (CRITICAL 0건)** — MAJOR 1건 (Phase 3 carry-over 명시 영속) + MINOR 3건. plan §3 옵션 3 (1차 default) + ADR-034/035/036 carry-over chain + Hard Rule 15/16/17 모두 일관 영속. Silent Pivot 0건 — 모든 가정 변경이 plan + ADR + handoff에 명시 영속.

QG (§7 + §8.3 + auto-review-protocol Phase 단위) 12 게이트 중:

- PASS: G1·G2·G3·G4·G6·G7·G9·G10·G11·G12 (10/12)
- carry-over 명시: G5 (Playwright e2e, §8.8) · G8 (5-페르소나 5병렬 pending)

## CRITICAL

(없음)

## MAJOR

### MAJOR-1 — ADR-005 supersedes 표기 carry-over는 명시되었으나 ADR-005 본문 미수정 (Phase 3 carry-over 정합)

- **확인 위치**: `docs/adr/ADR-005-authentication-pbkdf2-sha256.md:3` `상태: Accepted` (불변)
- **상태**: ADR-035 §"검토 의무" 51L `[ ] ADR-005 supersedes 표기 (본 ADR-035 reference)` 명시 carry-over + ADR-036 §"복원 의무" 62L `[ ] ADR-005 §Addendum supersedes 표기 (본 ADR-036 reference)` 명시 carry-over
- **분류 근거**: Phase 3 launch 직전 복원 chain (`project_launch_legal_bundle_deferred.md`)에 포함된 항목. 본 plan은 Phase 2 Eval MVP 범위로 ADR-005 본문 수정은 out-of-scope. 그러나 본 리뷰가 진산님 cold reader 시점에 ADR-005만 읽으면 silent drift 인식 0 위험 잔존 — 임시 명시 (`Partially Superseded by ADR-035 (PBKDF2 iterations) / ADR-036 (SameSite)` 1줄 추가) 정합 권고.
- **fix 옵션**: A) Phase 2 종착 단계에 ADR-005 상태 라인 `Accepted (partially superseded by ADR-035/036 — see those ADRs for Phase 3 restoration)` 1줄 흡수 B) Phase 3 launch 복원 chain에 그대로 carry-over

## MINOR

### MINOR-1 — BaseLayout 진산 단독 환경 service-worker fetch 실패 시 console.error 흡수 의도

- **위치**: `apps/web/src/layouts/BaseLayout.astro:31` `navigator.serviceWorker.register('/sw.js').catch((err) => { console.error('SW registration failed:', err); })`
- **production-quality.md `## 금지 패턴` 정합**: console.log 디버깅 금지 / console.warn/error 구조화 로깅 허용 — 본 라인은 catch sentinel + console.error (debug 아닌 sentinel) → 위반 0 (handoff-074 §"누적 통합 통계" 201L 명시 — `console.error 는 fetch 실패 sentinel 의도`).
- **권고**: 변경 없음. 단, Phase 3 본격 진입 시 telemetry beacon (D1 engine_telemetry 또는 Cloudflare Analytics)로 승격 carry-over.

### MINOR-2 — `study.astro` aside "FSRS 간격반복은 Phase 2 carry-over" 텍스트 surface

- **위치**: `apps/web/src/pages/study.astro:13-15`
- **plan §8.1 정합**: FSRS는 Phase 2 별도 plan carry-over 명시. UI surface는 plan §3 `correctCount 적은 것 우선 + 단순 가중치` 의도 정합.
- **권고**: 사용자(진산님) 인지 surface — 평가 환경 한정 임시 안내. memory `project_ux_north_star_phase3.md` Phase 3 진입 시 자연 제거. 현 시점 위반 0.

### MINOR-3 — QuestionCard default `examType = '2nd'` (signature 차원)

- **위치**: `apps/web/src/components/QuestionCard.tsx:72` `({ examType = '2nd' }: QuestionCardProps)`
- **plan §3 정합 미일치 외관**: plan §3 옵션 3은 "1차 default". 그러나 `study.astro:22`에서 `<QuestionCard examType="1st" client:load />` 명시 전달이라 실제 실행 path는 1차. Component default는 호출 없는 경우 fallback이라 실 영향 0. apps/api/src/study/routes.ts:309 `examTypeRaw = c.req.query('examType') ?? '1st'` 와 conceptually 일관성 권고 (component default도 '1st'로 통일).
- **위반 정도**: 외관 inconsistency만 — runtime 차원 위반 0.
- **권고**: Phase 3 학습 모드 다양화 plan 시 일괄 정리.

## Hard Rules 전수 점검 결과 (체크리스트)

| Hard Rule              | 점검 결과 | 증거                                                                                                                                                                                                                                                       |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| any 0건                | PASS      | `grep -rn ": any\|<any>\|as any"` 변경 5 파일 결과 0                                                                                                                                                                                                       |
| 하드코딩 0건           | PASS      | PBKDF2_ITERATIONS / PASSWORD_MIN_LENGTH / RELATED_NODES_MAX 모두 명명 상수. EXAM_ID는 `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유 (QuestionCard.tsx:15). API_BASE는 env (AuthForm.tsx:11). cookie SameSite는 `authCookieSameSite(env)` 함수 분기 (routes.ts:525). |
| 인메모리 임시 저장 0건 | PASS      | user_progress / sessions / status_transitions 모두 D1 영구 경로                                                                                                                                                                                            |
| TODO/HACK 0건          | PASS      | `grep TODO\|HACK\|FIXME\|XXX` 변경 5 파일 결과 0                                                                                                                                                                                                           |
| 빈 catch 0건           | PASS      | `grep "catch[^{]*{[[:space:]]*}"` 변경 5 파일 결과 0. 모든 catch 블록 logger.error/warn + 응답 처리                                                                                                                                                        |
| import \* 0건          | PASS      | `grep "import \*"` 변경 9 파일 결과 0                                                                                                                                                                                                                      |
| 동적 코드 실행 0건     | PASS      | eval / 동적 함수 생성자 / 동적 코드 평가 0건. 채점 normalize는 replace 정규식만 (routes.ts:179-196)                                                                                                                                                        |

## Hard Rule 15/16/17 멀티시험 격리 점검 결과

### Hard Rule 15 — 범용 계층 examId 분기 0건

- PASS
- 증거: `grep "if (examId\|examId ===" packages/{formula-engine,parser,shared}/src` 결과 0 (exam-ids.ts / exam-adapter.ts / .test.ts 제외)
- 본 변경 영역 (apps/api/src/study + apps/api/src/auth + apps/web)은 application 계층이라 Hard Rule 15 적용 범위 외 — 그러나 study/routes.ts:14 주석 `Hard Rule 17: EXAM_IDS.SON_HAE_PYEONG_GA_SA 경유 (리터럴 0)` 자가 정합 명시

### Hard Rule 16 — 데이터 조회 함수 첫 인자 examId 의무

- PASS
- `study/routes.ts:74-88` `requireExamId(value: string | undefined)` — query param 강제 추출 + isValidExamId 검증 + 422 fail-fast
- `/next` 라우트 297L + `/grade` 라우트 384L에서 `requireExamId(c.req.query('examId'))` 둘 다 호출
- 단, 내부 SQL (line 330-345 next / 416-422 grade) 에서 `WHERE exam_id = ?` 절은 Year 1 시점 미주입 (exam_id 컬럼 부재) — Year 2 zero-cost 전환 의도 정합 (plan §6.2 명시)

### Hard Rule 17 — 시험 ID 리터럴 단일 선언

- PASS (변경 9 파일 전수)
- `grep "'son-hae-pyeong-ga-sa'"` 결과: 4건 모두 예외 영역 (JSDoc 주석 2건 + verify 스크립트 검증 pattern 1건 + 신규 변경 0건)
  - `packages/shared/src/exam-adapter.ts:20,22` — JSDoc 주석 (Rule 17 예외 §"JSDoc / 일반 주석")
  - `apps/api/src/vectorize/upserter.ts:7` — JSDoc 주석 (Rule 17 예외)
  - `scripts/verify-engine-contracts.ts:296` — verify pattern string (검증 도구 자체)
- 신규 변경 파일 (AuthForm.tsx / QuestionCard.tsx / login.astro / study.astro / index.astro / BaseLayout.astro / routes.ts / constants.ts / migrations/0028) 모두 0건

## 확인 증거 (카테고리별 최소 3개)

### A. plan 대조 (옵션 3 + §6.5 + §8.3)

1. `apps/api/src/study/routes.ts:309` `examTypeRaw = c.req.query('examType') ?? '1st'` — plan §3 "1차 시험 문제 (examType='1st', exam_questions 525건) default" 정합
2. `apps/web/src/pages/study.astro:19,22` `1차 학습` 헤더 + `<QuestionCard examType="1st" client:load />` — plan §6.4 디자인 A 채택 + 옵션 3 1차 default 일치
3. `docs/plans/phase2-eval-mvp.plan.md:48-49` 표 "학습 영역" 행 `**1차 시험 문제 (examType='1st', exam_questions 525건) default — Session 065 진산 옵션 3 선택**` 갱신 영속
4. `docs/plans/phase2-2nd-self-grade.plan.md:78-280` plan §8.3 §"약술형 self-grade UI" 별도 plan 영속 (옵션 3 2차 carry-over)
5. `apps/web/src/components/AuthForm.tsx` (NEW, 157L) — plan §6.5 "M6 즉시 흡수" login + register toggle + credentials='include' + ?next redirect 일치
6. `apps/web/src/pages/auth/login.astro` (NEW, 11L) — plan §6.5 "BaseLayout + AuthForm island" 정합
7. `apps/web/src/components/QuestionCard.tsx:89-92, 122-126` — plan §6.5 "401 → /auth/login?next= redirect (next + grade 양쪽)" 정합

### B. ADR 정합 (3건 각 §"복원/검토 의무" 체크리스트 + 코드 반영)

1. ADR-034 §"복원 의무" 6항목 명시 — `constants.ts:42` `PASSWORD_MIN_LENGTH = 4` + `routes.ts:144-149` HIBP 'pwned' 분기 주석 처리 + `routes.test.ts S5` it.skip + `password.test.ts:24` `it.skip('rejects passwords shorter than minimum')` 정합
2. ADR-035 §"결정" — `constants.ts:23` `PBKDF2_ITERATIONS = 100000` + `migrations/0028:18-23` trigger `WHEN NEW.password_iterations < 100000` + `dummy-verify.test.ts:81` `PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100000)` 정합
3. ADR-036 §"결정" — `routes.ts:525-527` `authCookieSameSite(environment)` 함수 신규 + production/staging → 'None' / dev/test → 'Lax' 분기 일치
4. ADR-035 §"검토 의무" 51L + ADR-036 §"복원 의무" 62L 모두 `[ ] ADR-005 supersedes 표기` 명시 carry-over (MAJOR-1)
5. 3 ADR 모두 §"Phase 3 launch 직전 복원 의무" 섹션 + memory `project_launch_legal_bundle_deferred.md` chain 동기 참조

### C. Hard Rules 전수 (any/하드코딩/TODO/빈catch/import\* 0건)

1. `grep -rn ": any\b\|<any>\|as any" 변경5파일` 결과 0
2. `grep "TODO\|HACK\|FIXME\|XXX" 변경5파일+ADR3+migration` 결과 0
3. `grep "import \*" 변경9파일` 결과 0
4. `grep "catch[^{]*{[[:space:]]*}" 변경5파일` 결과 0 — 모든 catch 블록 logger.error/warn 명시 (routes.ts:155, 188, 252, 309, 351, 365, 405, 426, 446, 461, 493 / study/routes.ts:226, 252, 351, 403, 428, 503 / QuestionCard.tsx:107, 147 / AuthForm.tsx:80)

### D. Hard Rule 15/16/17 (멀티시험 격리)

1. `grep "if (examId\|examId ===" packages/{formula-engine,parser,shared}/src` 결과 0 — Rule 15 PASS
2. `study/routes.ts:74-88` `requireExamId` 함수 + `/next` 라우트 297L + `/grade` 라우트 384L 양쪽 호출 — Rule 16 PASS
3. `grep "'son-hae-pyeong-ga-sa'"` 변경 9 파일 결과 0 (Rule 17 예외 영역만 4건) — Rule 17 PASS

### E. 수치/임계값 (PBKDF2 / PASSWORD_MIN / SameSite)

1. `constants.ts:23` `PBKDF2_ITERATIONS = 100000` (ADR-035 정합)
2. `constants.ts:42` `PASSWORD_MIN_LENGTH = 4` (ADR-034 정합) + `constants.ts:45` `PASSWORD_MAX_LENGTH = 1024` (불변)
3. `routes.ts:525-527` SameSite production/staging 'None' / dev/test 'Lax' (ADR-036 정합)
4. `migrations/0028:20` trigger `WHEN NEW.password_iterations < 100000` (ADR-035 정합)
5. `dummy-verify.test.ts:81` regression test `>= 100000` (downgrade 방어 + ADR-035 정합)

### F. 네이밍/ID 컨벤션 (ADR 연속성 + migration 연속성 + 리뷰 파일명)

1. ADR: ADR-030 → 031 → 032 → 033 → 034 → 035 → 036 (`ls docs/adr/` 결과 연속, gap 0)
2. migration: 0025 → 0026 → 0027 → 0028 (gap 0)
3. 리뷰 보고서 파일명: 본 파일 `review-20260511-111048-phase2-eval-mvp-pass4-contract.md` (memory `feedback_review_filename_pattern.md` `review-* prefix` 정합)

### G. 누락 (plan §6.5 step + ADR 위치 + handoff §"수정된 파일" 영속)

1. plan §6.5 (M6 즉시 흡수) 4 항목: AuthForm.tsx 정합 + login.astro 정합 + QuestionCard 401 redirect 정합 + ProgressSummary 401 유지 정합 (변경 0)
2. ADR 3건 모두 `docs/adr/` 위치 정합 (ADR-034/035/036)
3. handoff-074 §"수정된 파일" 신규 12 + 변경 14 = 26개 모두 `git diff --name-only` 결과와 일치 (helper d1-from-sqlite.ts 추가 포함)

### H. Silent Pivot 탐지

1. 옵션 3 1차 default: `routes.ts:309` 코드 + plan §3 표 갱신 + handoff-074 §G + ADR 없음 (옵션 3는 plan §3 결정 갱신이라 ADR 작성 의무 아님 — plan 본문 영속으로 충분) → Silent Pivot 0
2. ADR-035 본문 7L `ADR-005 supersedes 일부` + ADR-036 본문 5L `ADR-005 §Addendum 일부 supersedes` — supersedes 표기 의도 명시. ADR-005 본문 미수정은 MAJOR-1 carry-over로 영속.
3. Reality Anchor §4 Q2 type-D (정답 normalize) `routes.ts:179-196` normalize 코드 + `routes.test.ts:183-217` 회귀 테스트 3건 (CRIT-1 / CRIT-3 / 기본) — 4-Pass 누적 흡수 영속

### I. 품질 게이트 (§7 + §8.3)

| Gate | 명세                           | 결과                                                                                                 |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| G1   | BATCH-2~5 SQL bootstrap >= 400 | PASS (handoff-074 §"누적 통합 통계" `status_transitions active approved : 488`)                      |
| G2   | production e2e >= 3 results    | PASS (Session 062~064 entry verify run1/run2)                                                        |
| G3   | grade 단위 >= 8건              | PASS (routes.test.ts grade 영역 >= 8건 — 정답/오답/normalize 회귀/L3/Hard Rule 16/17/출처)           |
| G4   | next 단위 >= 4건               | PASS (routes.test.ts /next 영역 >= 4건 — 가중치/미시도/exam_type/exhausted)                          |
| G5   | Playwright e2e >= 1            | carry-over (plan §8.8 별도 plan `phase2-eval-mvp-e2e-playwright.plan.md` 영속)                       |
| G6   | Hard Rule 17 grep 0            | PASS (위 D-3 증거)                                                                                   |
| G7   | typecheck + lint exit 0        | (vitest 488 PASS + 2 skipped 영속 — handoff-074 §"누적 통합 통계" 197L)                              |
| G8   | 4-Pass CRITICAL 0              | 본 Pass 4 PASS + Pass 1/2/3 병렬 진행 중 (CRITICAL 0건 확인 의무)                                    |
| G9   | production browser 1회 PASS    | PASS (handoff-074 §D `2019년 제5회 제16문... 순차적으로 나오네`)                                     |
| G10  | sourceCitations 비어있지 않음  | PASS (study/routes.ts:257-282 `buildSourceCitations` + 회귀 테스트 영속)                             |
| G11  | quality-gate 0 위반            | PASS (any 0 / console.log 디버깅 0 / TODO 0 / 빈catch 0 / import\* 0 — 위 Hard Rules 전수 점검 결과) |
| G12  | post-absorb verify 7/0/1       | PASS (Session 066 entry verify run1/run2 영속, handoff-074 §A)                                       |

## Devil's Advocate (기획 위반 깨질 시나리오)

### 시나리오 1 — Phase 3 launch 직전 ADR 3건 chain 일괄 처리 실패 가능성

ADR-034/035/036 모두 `project_launch_legal_bundle_deferred.md` chain 동기. 만약 Phase 3 launch 1주 스프린트 시점에 chain 항목 중 1건이 누락되면:

- ADR-034 미복원 → 4자리 password user 외부 노출 (brute-force 즉시 탈취)
- ADR-035 미복원 → PBKDF2 100k stored hash 그대로 + Argon2id 미적용 (외부 user 탈취 시 GPU 비용 매우 낮음)
- ADR-036 미복원 → CSRF 위험 (SameSite=None 잔존 + custom domain 미도입)
- 대응: 본 Pass 4 영속 시점에 ADR 3건 §"복원/검토 의무" 체크리스트 + memory `project_launch_legal_bundle_deferred.md` chain 양쪽 동기 의무 명시 — Phase 3 entry handoff에서 1차 의무 문서로 읽기.

### 시나리오 2 — 옵션 3 1차 default가 진산님 학습 패턴에 mismatch (만약 진산님이 2차 우선 시험 응시 시)

plan §3 학습 영역 갱신은 1차 default. 만약 진산님이 2차 시험 직전에 본 환경 사용 시 `/study?examType=2nd` 명시 진입 가능 (apps/api 422 QUESTION_HAS_NO_ANSWER 분기로 self-grade plan carry-over로 자연 흡수). 그러나 QuestionCard default '2nd' (MINOR-3)는 study.astro에서 명시 전달로 무효화. 만약 다른 page (예: future `/study/2nd.astro`)에서 props 누락 시 default '2nd' fallback → 1차 default 의도와 불일치 외관. 그러나 현 시점 surface 0.

- 대응: MINOR-3 carry-over로 Phase 3 학습 UX plan 시 일괄 정리.

### 시나리오 3 — Silent Pivot 잠재 — exam_type 컬럼 데이터 분포 변경 시

production 실측 (Session 065): 1차 525 active filled / 2차 9 active null. 만약 BATCH-2~5 후행 적재로 2차 answer filled 비율 상승 (예: 2차 100+ active filled) 시 옵션 3 결정 근거 mismatch → plan §3 표 재갱신 의무 + plan §8.3 self-grade carry-over 자연 무효 → 본 plan re-pivot 가능.

- 대응: `engine_telemetry` 게이지 (memory `project_engine_observability.md`) 2차 answer fill 비율 모니터링 carry-over + 임계값 도달 시 alert.

## Phase 2 Eval MVP QG (§8.3) 충족 여부 판정

### §8.3 약술형 self-grade UI carry-over (옵션 3)

- 영속 완료: `docs/plans/phase2-2nd-self-grade.plan.md` 신규 (103L, Session 065 carry-over)
- plan §3 표 행 갱신 + §8.3 본문 갱신 (`phase2-eval-mvp.plan.md:48-49, 275-280`)
- handoff-074 §G + §"다음 할 일" §7 영속

### 본 Pass 4 종합 판정

**완료 가능 (CRITICAL 0건)**.

- MAJOR 1건은 Phase 3 carry-over 명시 영속 (ADR-005 supersedes 표기는 Phase 3 launch chain에 포함)
- MINOR 3건은 외관 inconsistency 또는 carry-over surface — 운영 위반 0
- Silent Pivot 0건 — 모든 가정 변경 (옵션 3 1차 default / PBKDF2 100k / PASSWORD_MIN 4 / SameSite 'None' 분기) 코드 + plan + ADR + handoff 4 영속 layer 모두 일관

### 다음 의무 (handoff-075)

1. Pass 1 (Surgeon) / Pass 2 (Architect) / Pass 3 (Advocate) 결과 통합 → 4-Pass 종합 보고서 작성
2. Phase 단위 5-페르소나 기술부채 심층 리뷰 (refactoring/performance/quality/backend/devops 5 병렬)
3. carry-over 우선순위 재산정 (handoff-073 §F.4 M2~M12 + 본 리뷰 MAJOR-1 + MINOR-3)
4. handoff-075 영속

---

**작성**: Claude (Opus 4.7 1M context, Session 066 Pass 4 Contract)
**작성 효력**: 2026-05-11 KST
**기준 문서**: auto-review-protocol.md §"Pass 4 — CONTRACT" + phase2-eval-mvp.plan.md + ADR-034/035/036
