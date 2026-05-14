# Step 3-UX-6f 5-페르소나 독립 병렬 기술부채 리뷰 — 자가 확인 편향 감사

- **시점:** 2026-05-14 11:07 KST
- **트리거:** 진산 직접 지시 — "단순 코드 컴파일 에러만 살펴보지 말고 논리 오류·잠재 문제·개선사항 다양한 각도, 다양한 전문가 페르소나 동원 기술부채 점검 / 자가 검증 편향 테스트"
- **리뷰 대상:** 직전 2 커밋 (fb21045 WebKit + 9d3f196 Quick-win 4건)
- **직전 4-Pass (code-reviewer 단일):** Critical 0 / Major 0 / Minor 0 ← **자가 확인 편향 의심**

## 1. 5 페르소나 보고 종합

| 페르소나             | Critical | Major  | Minor  | 핵심 지적                                                                                                                      |
| :------------------- | :------: | :----: | :----: | :----------------------------------------------------------------------------------------------------------------------------- |
| refactoring-expert   |    2     |   5    |   4    | Retry-After tautology / mutable singleton 안전성                                                                               |
| performance-engineer |    0     |   3    |   4    | retries:2 silent flaky cushion / cache key 과민 / report storage                                                               |
| quality-engineer     |    3     |   4    |   3    | WebKit skip 영구 silent miss / gradeSequence silent 반복 + empty array fall-through                                            |
| backend-architect    |    2     |   4    |   5    | **RATE_LIMITED vs RATE_LIMIT_EXCEEDED 실 서버 contract drift (★ 본 PR 신규 도입)** / examId fail-loud 부재 (Hard Rule 16 우회) |
| devops-architect     |    2     |   4    |   5    | .gitignore .claude/scheduled_tasks.lock 누락 / retries silent flaky 영속화                                                     |
| **합계**             |  **9**   | **20** | **21** |                                                                                                                                |

**중복 합산 후 unique Critical 7건** (refactor C-1 ≡ quality M1, perf M-P1 ≡ devops C-D2).

## 2. Critical 7건 분류

### A. 본 PR 신규 도입 위험 (즉시 fix 불가피)

#### A-1. backend C1 — RATE_LIMITED vs RATE_LIMIT_EXCEEDED 실 서버 contract drift

- **증거:** apps/api/src/study/routes.ts:929 `{ error: 'RATE_LIMIT_EXCEEDED' }` vs api-errors.spec.ts:34 `{ error: 'RATE_LIMITED' }`
- **위험:** spec literal이 single source가 되어버려 client가 향후 error code 분기 시 mock 통과 + production silent divergence
- **★ 본 PR이 도입한 신규 위험** (ADR-040 §6 carry-over에 명시 부재)
- **즉시 fix 비용:** 1줄 + ADR 1건. ~10분

#### A-2. refactor C-1 ≡ quality M1 — Retry-After assertion tautology

- **증거:** api-errors.spec.ts:46 `expect(retryAfterHeader).toBe('30')` — mock이 자기 inject한 헤더 검증, client는 헤더 무시
- **위험:** false confidence + listener cleanup 부재 + 6개월 후 cargo-cult 확산
- **★ 본 PR이 도입한 신규 위험**
- **즉시 fix 비용:** assertion + listener 삭제. TODO 주석 추가. ~5분

#### A-3. refactor C-2 — `overrides.current` mutable singleton 안전성 구조 미강제

- **증거:** mock-api.ts:140. 현재 page-scoped라 safe하나 향후 worker-shared 이전 시 silent shared-state bug
- **위험:** 디버깅 hellhole + helper 추가 시 작성자 의도 충돌
- **즉시 fix:** ApiMock.resetOverrides() + immutable replace 명시. ~30분

### B. 본 PR 외 carry-over 합법화 (carry-over 우선순위 상향 필요)

#### B-1. quality C1 — WebKit QuestionCard 시나리오 skip 영구 silent miss

- **증거:** mobile-375.spec.ts:84 + ADR-040 §6 carry-over
- **위험:** 실 사용자 95%+ iOS Safari의 핵심 progress action 회귀 차단망 0
- **★ 본 PR이 "회귀 차단망 14건"으로 표면화한 신뢰성이 webkit project에서 실질 0건이라는 진실 미surface**
- **권고:** carry-over 우선순위 상향 + Phase 3 launch 전 dead line 명시 + 동시에 mobile-webkit project가 사실상 ModeSelector + SessionStart 2건만 cover한다는 fact를 ADR 명시

#### B-2. backend C2 — examId fail-loud 부재 (Hard Rule 16 우회)

- **증거:** mock-api.ts 모든 route handler가 `examId` query 검증 0건
- **위험:** spec 통과 + production 첫 배포 시 모든 endpoint 422 폭격. CLAUDE.md "데이터 조회 시 시험 경계 강제" 정면 위반
- **즉시 fix:** mock-api 전수 라우트에 examId 검증 + fail-loud. ~30분
- **★ Hard Rule 위반 = 자율 흡수 default 영역**

#### B-3. quality C2 — gradeSequence 마지막 항목 silent 반복

- **증거:** mock-api.ts:237 `Math.min(counters.grade - 1, seq.length - 1)`
- **위험:** sequence 초과 시 silent 반복으로 회귀 차단망에 구멍 (`fetchNext` → `submit` 오타 silent pass)
- **즉시 fix:** console.error fail-loud. ~5분

#### B-4. quality C3 — gradeSequence empty array silent fall-through

- **증거:** mock-api.ts:226 `if (seq !== undefined && seq.length > 0)`
- **위험:** `gradeSequence: []` 의도-동작 mismatch (reset vs ignore)
- **즉시 fix:** console.warn + 조건 분리. ~5분

### C. 운영 단계 별도 처리

#### C-1. devops C-D1 — `.claude/scheduled_tasks.lock` gitignore 누락

- **증거:** `git check-ignore` exit 1 (= NOT ignored)
- **위험:** 우연 add → stale lock 영구 cron 차단 + 머신 간 PID/procStart 의미 다름
- **즉시 fix:** .gitignore 1줄. ~2분

#### C-2. devops C-D2 ≡ perf M-P1 — retries:2 + flaky 흡수 영속화

- **증거:** playwright.config.ts:23. ADR §6 M5 carry-over로 명시되어 있으나 본 commit 영속화 책임 회피 불가
- **권고:** ADR 강등 (retries 2→1) 또는 retry surface warning step 추가 + ADR §6 M5 우선순위 상향

## 3. 직전 code-reviewer 0/0/0 판정의 근본 원인

5 페르소나 모두 동일 진단:

> **"코드 정합성 / typecheck / lint 단독 판정. 운영 시나리오 / contract drift / 사용자 path / 자가검증 tautology 차원이 통째로 누락."**

특히 backend-architect의 결정적 지적:

> "code-reviewer는 'types.ts 단일 source라 drift시 mock도 drift된다'고 평가했다. **이것은 mock의 drift만 막을 뿐, server의 drift는 못 막는다.** 진짜 시나리오: server가 `streak.dailyGoalProgress`를 `dailyTarget`으로 rename → web/mock은 변경 안 됨 → mock 통과, 프로덕션 fail. 이게 carry-over §6이 해결하려던 것."

quality-engineer의 결정적 지적:

> "직전 code-reviewer 0/0/0 보고는 **'테스트가 통과하지만 production 사용자는 회귀를 본다'**는 quality-engineer 핵심 우려에 정확히 해당. 자기 확인 편향으로 무효."

## 4. 처리 권고 (우선순위 매트릭스)

### 4-1. 즉시 자율 흡수 (default — 최상 품질, 진산 결정 불요)

| 항목                                  |         페르소나          | 시간 | 비고              |
| :------------------------------------ | :-----------------------: | :--: | :---------------- |
| A-1 RATE_LIMIT_EXCEEDED 정합          |        backend C1         | 10분 | 본 PR 신규 위험   |
| A-2 Retry-After assertion 삭제 + TODO | refactor C-1 / quality M1 | 5분  | 본 PR 신규 위험   |
| B-2 examId fail-loud 전수             |        backend C2         | 30분 | Hard Rule 16 위반 |
| B-3 gradeSequence overflow fail-loud  |        quality C2         | 5분  | silent miss 회귀  |
| B-4 gradeSequence empty fail-loud     |        quality C3         | 5분  | silent miss 회귀  |
| C-1 .gitignore 1줄                    |        devops C-D1        | 2분  | 즉시 fix          |

**총 ~60분 흡수 가능.** 모두 자율 default 영역 (Hard Rule 위반 / 본 PR 신규 위험 / silent miss 차단).

### 4-2. 진산 결정 필요 (전략 갈림길)

| 항목                           |   페르소나   | 갈림길                                                                                          |
| :----------------------------- | :----------: | :---------------------------------------------------------------------------------------------- |
| A-3 mutable singleton refactor | refactor C-2 | (a) 즉시 ApiMock refactor / (b) carry-over                                                      |
| B-1 WebKit QuestionCard        |  quality C1  | (a) launch 전 cross-origin proxy 도입 / (b) carry-over + "차단망 14건 = chromium 한정" ADR 명시 |
| C-2 retries 강등               | devops/perf  | (a) 2→1 즉시 강등 / (b) retry warning surface만 추가 / (c) carry-over                           |

### 4-3. ADR-040 §6 신규 carry-over 등재

| 항목                                                                         |            페르소나             |
| :--------------------------------------------------------------------------- | :-----------------------------: |
| M-1 mock-api.ts 348줄 SRP 분리 (6개월 후 600줄 임계)                         |          refactor M-1           |
| M-P2 cache key Playwright 버전 단독화                                        |            perf M-P2            |
| M-P3 HTML report 조건부 upload                                               |            perf M-P3            |
| M-D1 cache restore-keys silent contamination                                 |           devops M-D1           |
| M-D2 cancel-in-progress + retries 비용 곱셈                                  |           devops M-D2           |
| M-D3 e2e needs:quality-gate ADR 종결 (carry-over 진척 0건 책임)              |           devops M-D3           |
| 401 redirect spec 누락 (production critical)                                 |           quality M2            |
| sessionId-aware mock progression                                             |           quality M4            |
| 4xx body type 풍부화 (issues / questionId / 409 CONCURRENT_UPDATE)           |           backend M2            |
| cookie Secure flag profile sync                                              |           backend M3            |
| CORS allowedOrigin 옵션화 (carry-over 이미 등재)                             |           backend M4            |
| shared package contract layer (`packages/shared/src/contracts/study-api.ts`) | backend M1 — ADR §6에 이미 등재 |

## 5. 5-페르소나 리뷰 자체의 검증 (메타)

각 페르소나가 직전 code-reviewer 정당화를 명시 challenge:

- refactor: "forward contract라는 변호는 코드 작성자가 그 시점에 이 테스트를 기억하고 확장한다는 가정에 의존"
- quality: "ADR §6 carry-over 명시는 'launch해도 된다'는 면죄부가 아니다"
- backend: "types.ts 단일 source는 mock의 drift만 막고 server의 drift는 못 막는다"
- devops: "actions/cache@v4 + playwright install 정합 가정은 미검증, restore-keys 효과 conjecture"
- perf: "retries:2가 silent flaky를 가리는 cushion이라는 사실은 코드 정합성 관점에서 보이지 않음"

각 페르소나가 자기 영역의 부채만 보고 (overlap 일부 — Retry-After / retries) → 5각 관점 cross-validation 성립.

## 6. 결론

**직전 code-reviewer 0/0/0 판정은 자가 확인 편향으로 확정 무효.** 5-페르소나 unique Critical 7건 중:

- **본 PR 신규 도입 위험 3건** (A-1, A-2, A-3) — 책임 회피 불가
- **본 PR이 합법화한 Hard Rule 위반 1건** (B-2 examId fail-loud) — 책임 회피 불가
- **본 PR이 영속화한 silent miss 2건** (B-3, B-4 gradeSequence) — 책임 회피 불가
- **carry-over 정합 위반 시 launch 차단 1건** (B-1 WebKit) — Phase 3 launch dead line 의무

**자율 즉시 흡수 ~60분** 권고 + 진산 결정 갈림길 3건 + ADR §6 신규 carry-over 12건 등재.

**관련 파일 (절대 경로):**

- /home/soo/ClaudePro/ThePick/apps/web/e2e/helpers/mock-api.ts
- /home/soo/ClaudePro/ThePick/apps/web/e2e/api-errors.spec.ts
- /home/soo/ClaudePro/ThePick/apps/web/e2e/mobile-375.spec.ts
- /home/soo/ClaudePro/ThePick/apps/web/playwright.config.ts
- /home/soo/ClaudePro/ThePick/.github/workflows/ci.yml
- /home/soo/ClaudePro/ThePick/.gitignore
- /home/soo/ClaudePro/ThePick/apps/api/src/study/routes.ts (RATE_LIMIT_EXCEEDED 진실)
- /home/soo/ClaudePro/ThePick/docs/adr/ADR-040-step-3-ux-6c-server-contract-gap-carryover.md
