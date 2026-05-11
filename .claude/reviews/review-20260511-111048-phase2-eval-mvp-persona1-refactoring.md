# 5-Persona Tech Debt Review — Refactoring Expert (Persona 1/5)

**Phase**: Phase 2 Eval MVP 종착
**Session**: 065
**Scope**: 7 commits `f98532d..4405c92` (apps/api/src/auth/_, apps/api/src/study/_, apps/web/src/{components,pages}/_, docs/adr/ADR-034/035/036, docs/plans/phase2-_.plan.md)
**Reviewer perspective**: "6개월 뒤 이 코드가 버틸까?" — 코드 품질 부채 (인지 부하 / 중복 / 결합도 / 테스트 가능성 / 확장성 / 명명·문서 / 에러 모델)
**Generated**: 2026-05-11 11:10:48

---

## 리뷰 메타 — 4-Pass 직전 결과 인계 (중복 지적 금지)

| Pass                       | 발견                                                                                                                                                                                                                                                        | 본 리뷰 중복 검사                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pass 1 (Surgeon) C-1       | DUMMY_HASH bytes vs PBKDF2_ITERATIONS drift (해시는 600k 산출물인데 iterations 필드는 PBKDF2_ITERATIONS=100k 참조 → verify 시 다운그레이드 가드 통과·실제 PBKDF2 결과는 100k 산출물이라 hash byte mismatch → 항상 false 정상 동작이나 cache line 분포 변형) | 같은 인자만 본다 — 본 리뷰는 **DUMMY_HASH 재생성 책임 부재(누가 어떻게 알아채는가?)** 라는 **거버넌스 부채** 별도 식별 (MAJOR-2)                                        |
| Pass 2 (Architect) C-1,2,3 | ADR-005 supersedes 본문 미수정 + dummy-verify.ts 주석 "600,000 반복" stale + PBKDF2 600k 문구 미정정                                                                                                                                                        | 동일 dummy-verify.ts 주석 stale 은 **언급 안 함**. 본 리뷰는 그 주변 **"재생성 스크립트가 600000을 하드코딩"** (실행 가능한 stale procedure) 부채 별도 식별             |
| Pass 3 (Advocate) C-1,2,3  | DUMMY_HASH 정합 / 임시 정책 env 분기 부재 / register email rate-limit 부재                                                                                                                                                                                  | 임시 정책 env 분기 부재는 본 리뷰 CRIT 후보였으나 **건너뜀**. 본 리뷰는 임시 정책의 **"2개 진실 원천(API constants + AuthForm minLength)" DRY 위반** 별도 식별 (CRIT-1) |
| Pass 4 (Contract) M-1      | ADR-005 supersedes header 미수정                                                                                                                                                                                                                            | 동일 ADR 위반 미언급 — 본 리뷰는 **ADR-034 "복원 의무 6항목"이 hook/test/CI에 binding 되지 않은** 거버넌스 갭 별도 (MAJOR-3)                                            |

**중복 0 확인**: 본 리뷰 모든 finding 은 위 7건과 별도 시각(코드 품질 부채 카테고리).

---

## 요약

| 분류     | 건수  |
| -------- | ----- |
| CRITICAL | 1     |
| MAJOR    | 4     |
| MINOR    | 3     |
| **합계** | **8** |

**핵심 부채 3건 (6개월 후 가장 위험)**:

1. CRIT-1 — 임시 비밀번호 정책 **3중 source-of-truth** (API constants + AuthForm minLength + DB CHECK 부재)
2. MAJOR-1 — `resolveLoggerEnv` / `KNOWN_ENVIRONMENTS` / `buildLogger` **3개 route 파일에 동일 복사** (auth, study, telemetry)
3. MAJOR-2 — DUMMY_HASH **재생성 스크립트가 600000 하드코딩** + `iterations` 필드만 PBKDF2_ITERATIONS 참조 → 다음 변경 시 "왜 verify 가 항상 false 인지" 디버깅 지옥 (사람 의존)

---

## CRITICAL

### CRIT-1 — 임시 비밀번호 정책 3중 source-of-truth (DRY 위반, 정책 drift 高위험)

**카테고리**: 중복 / 명명·문서 / 확장성

**증거**:

- `apps/api/src/auth/constants.ts:42` — `export const PASSWORD_MIN_LENGTH = 4;`
- `apps/web/src/components/AuthForm.tsx:113` — `<input ... minLength={4} ... />` (하드코딩 리터럴)
- `migrations/` 검색 결과 `CHECK(length(password_hash)...)` 류 DB 제약 부재 (서버 zod + 클라이언트 HTML5 만)

**문제**:
ADR-034 §"복원 의무"는 "PASSWORD_MIN_LENGTH=8 복원"만 명시한다. Phase 3 launch 직전 진산님이 `constants.ts` 의 `4 → 8` 만 바꾸면 **AuthForm.tsx 의 `minLength={4}` 는 미동기화**. 결과:

1. 클라이언트 HTML5 검증은 4자 통과 → 서버 zod 거부 → 사용자에게 "비밀번호 최소 8자" 안내가 아닌 422 `VALIDATION_ERROR` raw issues 노출 (Pass 3 Advocate UX 부채)
2. ADR-034 복원 의무 6항목 checklist 에 "AuthForm 의 minLength prop" 항목 부재 → 영속 누락 위험
3. 6개월 후 새 페이지 (`/auth/reset-password` 등) 추가 시 또 `minLength={?}` 리터럴이 복제됨

**해결 패턴**:

- `packages/shared/src/constants/auth.ts` 로 `PASSWORD_MIN_LENGTH` 이동 (현재는 `apps/api` 로컬에만 존재)
- AuthForm.tsx 가 `import { PASSWORD_MIN_LENGTH } from '@thepick/shared'` 후 `minLength={PASSWORD_MIN_LENGTH}`
- ADR-034 §"복원 의무"에 "shared/constants/auth.ts 의 값만 변경" 추가 → 단일 원천

**6개월 후 비용**: 추정 0.5h (현재) → 4-8h (Phase 3 launch 후 사용자 confusion 보고 → 재현 → DRY 리팩토링 + 회귀 테스트). 본격 정책 전환 시점에 발견되면 hot-fix 압박 가중.

---

## MAJOR

### MAJOR-1 — Logger Builder 3중 복제 (auth/study/telemetry routes)

**카테고리**: 중복 / 결합도

**증거**:

- `apps/api/src/auth/routes.ts:75-93` — `KNOWN_ENVIRONMENTS` Set + `resolveLoggerEnv` + `buildLogger` (19줄)
- `apps/api/src/study/routes.ts:41-65` — **동일** 함수 3개 (25줄, 타입만 `StudyBindings` 로 변형)
- `apps/api/src/telemetry/routes.ts:48-64` — **동일** 함수 3개 (17줄)

세 파일이 **글자 그대로 같은** `KNOWN_ENVIRONMENTS` 선언 + `resolveLoggerEnv` 함수. 차이는 `Bindings` 인터페이스 이름뿐. Total: ~60줄 dead duplication.

**문제**:

- 새 route 모듈 추가 시 (예: phase 2 carry-over `2nd-self-grade`) 또 복사됨
- `LoggerEnvironment` enum 에 `'qa'` / `'preview'` 추가하려면 3곳 동시 수정 (silent drift)
- 6개월 후 `qa` 만 한 곳에 추가되면 다른 두 곳은 `'development'` fallback → telemetry 와 study 가 같은 환경에서 다른 module tag 로 로깅

**해결 패턴**:

- `apps/api/src/observability/build-logger.ts` (또는 `@thepick/shared` 의 helper) 로 추출
- `export function buildModuleLogger<B extends { ENVIRONMENT?: string }>(env: B, module: string): Logger`
- 호출 측: `const logger = buildModuleLogger(c.env, 'auth').child({ route: 'register' });`

**6개월 후 비용**: 새 route 5개 추가 시 100~150줄 dead duplication 누적. 환경 enum 변경 시 grep 의존 (silent drift 검출 불가).

---

### MAJOR-2 — DUMMY_HASH 재생성 절차의 사람 의존성 (Stale 책임 부재)

**카테고리**: 명명·문서 / 테스트 가능성

**증거**:

- `apps/api/src/auth/dummy-verify.ts:22-30` — JSDoc 안의 재생성 스크립트가 `pbkdf2Sync(pt, salt, 600000, 32, ...)` 로 **600000 을 리터럴로 하드코딩**
- `dummy-verify.ts:42-48` — 상수 객체 `DUMMY_HASH` 의 `iterations` 필드만 `PBKDF2_ITERATIONS` 참조 (해시 바이트는 600k 산출물)
- `dummy-verify.ts:38` — "상수 변경 시 본 값 재생성 필요" 주석은 있으나 **자동 검증 없음**
- 테스트 (`__tests__/dummy-verify.test.ts`): `performDummyVerify` 가 항상 `void` 반환 — 실제 verify 결과 (true/false) 미검증 → mismatch 영구 무탐지

**문제**:
이 모듈의 본질은 **"timing 평탄화"** — 결과 무시가 정상. 그러나 `PBKDF2_ITERATIONS` 가 100k → 600k 또는 다른 값으로 바뀌면:

- `iterations` 필드는 자동 갱신됨 (`PBKDF2_ITERATIONS` 참조)
- `hash` / `salt` 는 stale (600k 산출물 그대로)
- `verifyPassword` 의 다운그레이드 가드 (`stored.iterations < PBKDF2_ITERATIONS`) 통과
- 실제 PBKDF2(plaintext, stored.salt, stored.iterations) = stored.iterations 값으로 새 산출 — stored.hash 와 byte 다름 → 항상 false (의도)
- **하지만** "왜 byte mismatch 인가?" 디버깅 시 진실 원천이 JSDoc 주석 안 스크립트 → 사람이 600000 을 100000 으로 바꿔서 재실행해야 함을 인지해야 함

**해결 패턴 (3안)**:

- A안: 런타임 lazy generation — 첫 호출 시 `derivePbkdf2Bits('dummy-sentinel-v1', fixedSalt, PBKDF2_ITERATIONS)` 1회 산출 후 module-level cache. 상수 불일치 원천 차단. CPU 비용 1회 (cold start +30ms).
- B안: 빌드타임 codegen — pre-build script 가 `dummy-verify.constants.ts` 자동 생성. CI 검증 가능.
- C안: 테스트 강제 — `dummy-verify.test.ts` 에 "DUMMY_HASH 가 현재 PBKDF2_ITERATIONS 로 재현 가능한가" 회귀 테스트 추가 (실제 PBKDF2 재산출 후 byte 일치 assert).

**6개월 후 비용**: PBKDF2 → Argon2id 마이그레이션 (ADR-035 carry-over) 시 dummy-verify 의 timing 비용이 실제 verify 와 어긋남을 발견 못 함 → enumeration attack 재개 → 사고. 진산님 직접 손해평가사 합격 후 다른 자격증 확장 시 hash policy 자주 변경 → 재발 확률 高.

---

### MAJOR-3 — ADR-034 "복원 의무 6항목"이 코드/CI 에 binding 되지 않음 (선언적 부채)

**카테고리**: 명명·문서 / 확장성 (정책 부채)

**증거**:

- `apps/api/src/auth/constants.ts:40` — JSDoc "Phase 3 launch 직전 복원 의무 — ADR-034 §"복원 의무" 6항목 PASS 후 launch"
- `apps/api/src/auth/routes.ts:141-149` — HIBP pwned 분기 주석 처리 + "Phase 3 launch 직전 복원 의무" 주석
- `apps/api/src/auth/__tests__/password.test.ts:23` — `it.skip('rejects passwords shorter than minimum (ADR-034 carry-over)' ...)`
- 다른 곳에 binding 없음 (no hook, no CI gate, no `tasks/*.gates.yaml` 검증).

**문제**:
"Phase 3 launch 직전 복원 의무" 표현이 **5곳** 산재 (`constants.ts:16-17`, `constants.ts:40`, `routes.ts:143`, `routes.ts:523`, `password.test.ts:23`, `dummy-verify.test.ts:80`, `AuthForm.tsx:6`). 각각 다른 복원 항목 (PBKDF2 600k / PASSWORD_MIN_LENGTH=8 / HIBP unskip / SameSite=Strict / 디자인 본격 등). Phase 3 launch 직전 진산님이 "ADR-034 복원" 한 가지 키워드로 검색하면 모두 잡히지만, **각 항목의 변경 위치/검증 방법이 분산** + **하나라도 누락 시 자동 감지 0**.

ADR-034 §"복원 의무" 본문이 markdown checklist 라도 코드 binding 부재 → 6개월 후 진산님 또는 미래 Claude 가 "다 했나?" 확인 불가능.

**해결 패턴**:

- `tasks/phase3-launch-restore-adr034.gates.yaml` 생성 (Binary Gates skill 활용) — 6개 복원 항목을 입력→출력 쌍으로 정의
- `.claude/hooks/` 에 deploy-gate hook: production 환경 변수 + git tag `v1.0.0-launch` 동시 충족 시에만 통과
- 또는 `apps/api/src/auth/policy-mode.ts` 도입 — `getCurrentPolicyMode()` 함수가 `'eval'|'production'` 반환, 모든 임시 분기가 이 함수 경유 → production 시 fail-fast (런타임 assertion)

**6개월 후 비용**: Phase 3 launch 일정 압박 + ADR-034 항목 6개 중 1~2개 누락 → production 출시 후 사용자 비밀번호 4자 가입 가능 / HIBP unprotected / 'pwned' 비밀번호 통과 → 보안 사고. 본 프로젝트는 자격증 학습 + 결제 정보 PII 보유 → 사고 비용 大.

---

### MAJOR-4 — Web app 의 API client 부재 (3개 컴포넌트가 fetch raw 사용 + API_BASE 복제)

**카테고리**: 중복 / 결합도 / 테스트 가능성

**증거**:

- `AuthForm.tsx:11`, `QuestionCard.tsx:14`, `ProgressSummary.tsx:11` — 동일한 `const API_BASE: string = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';`
- `QuestionCard.tsx:89-92` + `124-127` + `ProgressSummary.tsx:38` — 동일한 `if (res.status === 401)` → redirect 패턴 (2회 같은 컴포넌트 내에서도 중복)
- 모든 컴포넌트가 `credentials: 'include'` 누락 시 silent fail 위험 (현재는 다 포함, 그러나 4번째 컴포넌트 추가 시 깜빡 위험)

**문제**:

- 6개월 후 새 component 5개 추가 시 `API_BASE` 5번 더 복제, 401 redirect 로직 5번 더 복제
- Phase 3 custom domain 전환 시 `import.meta.env.PUBLIC_API_BASE_URL` fallback hardcoded localhost 가 dev only 인지 production safety net 인지 불명확 → 프로덕션 빌드 검증 누락 시 사용자가 `http://localhost:8787` 호출
- E2E 테스트 어려움 (각 컴포넌트가 직접 fetch — mock 부담)

**해결 패턴**:

- `apps/web/src/lib/api-client.ts` 도입:
  ```ts
  export const apiClient = {
    async get<T>(path: string): Promise<T | 'unauthorized' | { error: string }> { ... },
    async post<T>(path: string, body: unknown): Promise<T | 'unauthorized' | { error: string }>
  };
  ```
- 401 → centralized redirect 또는 React context (Suspense + ErrorBoundary)
- `PUBLIC_API_BASE_URL` 필수화 (`import.meta.env.PUBLIC_API_BASE_URL!` + Astro config build-time 검증)

**6개월 후 비용**: Phase 3 launch 시 `PUBLIC_API_BASE_URL` 미설정 + fallback localhost → production 빌드에서 사용자 브라우저가 localhost 호출 → 전 사용자 인증 실패 → 1-day outage. 본 프로젝트 단일 벤더 (Cloudflare Pages) 운영 특성상 환경변수 누락 회귀 확률 高.

---

## MINOR

### MINOR-1 — `QuestionCard` 기본 prop `examType='2nd'` 가 plan §3 결정 (1차 default) 과 역방향

**증거**:

- `apps/web/src/components/QuestionCard.tsx:72` — `export function QuestionCard({ examType = '2nd' }: ...)`
- `apps/web/src/pages/study.astro:22` — `<QuestionCard examType="1st" client:load />` (override 됨)
- `docs/plans/phase2-eval-mvp.plan.md:49` — "1차 시험 문제 default — Session 065 진산 옵션 3 선택"

**문제**: 현재는 `study.astro` 가 명시적으로 `'1st'` 를 전달하므로 동작 OK. 그러나 6개월 후 다른 페이지에서 `<QuestionCard />` (prop 미지정) 호출 시 plan §3 결정 위반 (옵션 3 본질 "1차 default" 위반).

**해결**: 기본값 `'1st'` 로 변경 또는 prop 필수화 (default 제거).

### MINOR-2 — `study/routes.ts:304, 391` 의 `void examIdParam.examId;`

**증거**:

- 두 라우트 모두 `requireExamId` 호출 후 `void examIdParam.examId;` — 변수 미사용 lint suppression
- Hard Rule 16 정합 의도 (시그니처에 examId 받음) 인데 실제 D1 쿼리에는 `WHERE exam_id=?` 미주입 (Year 2 zero-cost 전환 준비)

**문제**: 코드 독해 시 "왜 받기만 하고 안 쓰지?" → JSDoc 주석은 module-level 에만 있어 라인 in-line 의도 흐림. `void` 사용은 의도적 unused 표현이나 grep 어려움.

**해결**:

```ts
// Hard Rule 16: examId 검증만 (Year 2 마이그레이션 0005 이후 WHERE 절 주입)
const { examId } = examIdParam; // eslint-disable-line @typescript-eslint/no-unused-vars
```

또는 ESLint comment + 명시적 변수명.

### MINOR-3 — `routes.ts` 의 `let row` / `let lookup` / `let userStatus` 변경 가능 변수 + 중첩 try-catch 가 인지 부하 高

**증거**:

- `apps/api/src/auth/routes.ts:241-255, 402-409, 440-452, 471-498` — 4개 영역이 모두 동일 패턴 (`let X: T | null; try { X = await ... } catch { ... 503 return }`)
- `routes.ts` 567 줄. login handler 만 142 줄, refresh handler 122 줄.

**문제**: handler 1개당 SLOC 100+ → 단일 함수 가독성 임계 초과. 6개월 후 ADR-037, ADR-038 추가 흡수 시 200줄 돌파 가능. 본 리뷰 진행 중 routes.ts 를 메인 리뷰 대상으로 지목한 이유 = 향후 가장 빠르게 부패할 파일.

**해결 패턴**:

- 각 handler 의 read-DB phase 를 helper 로 추출:
  ```ts
  async function safeQuery<T>(c: AuthContext, query: () => Promise<RetryValue<T>>, errLabel: string): Promise<T | Response> { ... }
  ```
- 또는 Hono middleware 기반 D1 retry wrapper (`c.set('user', row)` 까지 한 번에)
- login / refresh 의 "IP_PEPPER 분기 + createRefreshSession + signAccessToken + setAuthCookies" 시퀀스 (login:323-340, refresh:476-490) 가 거의 동일 — `issueSessionTokens(c, userId)` helper 추출

---

## 6개월 후 시나리오 (가장 위험한 부채 3개 + 누적 비용 추정)

### 시나리오 1 (Phase 3 launch — 2026-Q4 추정): 임시 정책 부채 폭발 (CRIT-1 + MAJOR-3 결합)

진산님 또는 미래 Claude 가 ADR-034 §"복원 의무" 6항목 checklist 를 markdown 으로만 읽고 launch 실행:

- `constants.ts` PASSWORD_MIN_LENGTH 8 로 복원 ✓
- HIBP 분기 unskip ✓
- 그러나 `AuthForm.tsx:113` `minLength={4}` **누락** (CRIT-1)
- ADR-034 launch checklist 가 코드 binding 없음 (MAJOR-3)

**결과**: launch 직후 사용자 50명 4자 비밀번호로 가입 시도 → 클라이언트 통과 → 서버 422 → 사용자 confusion → support 티켓 폭증 → hot-fix 배포. 추정 비용: **6-12h (긴급 hot-fix + 사용자 데이터 재처리 + 회고)**.

### 시나리오 2 (Phase 3 launch + 3개월 — 2027-Q1 추정): Hash 정책 변경 시 dummy-verify 회귀 (MAJOR-2)

ADR-035 carry-over 인 Argon2id 마이그레이션 또는 Workers 가 PBKDF2 200k 지원 시:

- `PBKDF2_ITERATIONS = 200000` 변경
- `dummy-verify.ts` 의 `DUMMY_HASH.iterations` 필드만 200k 로 자동 변경
- `hash` / `salt` 는 stale (100k 산출물)
- timing 측정 시 dummy 가 200k 로 실제 산출 (verify 결과 false, 의도) 하나 실제 PBKDF2 비용 = 200k → login row-null path 와 row-found path 둘 다 200k → **timing 일치 유지** (놀랍게도 OK)
- 그러나 6개월 후 누군가 `verifyPassword` 에 "iterations 가 PBKDF2_ITERATIONS 와 정확히 일치하면 fast path" 같은 최적화 추가 → DUMMY_HASH 의 stale hash bytes 가 cache hit 분포에 차이 발생 → enumeration attack 재개 가능

**결과**: 추정 비용 본격 사고 시 **8-20h (보안 사고 분석 + 회귀 테스트 추가 + ADR-039 작성)**. 발견 안 되면 **무한** (silent vulnerability).

### 시나리오 3 (Phase 2 carry-over 진입 — 2026-05~07): 새 route 추가 시 부채 가속 (MAJOR-1 + MAJOR-4)

- `phase2-2nd-self-grade.plan.md` 진입 시 새 route (`/api/study/self-grade`) 추가 + 새 web component (`SelfGradeCard`)
- `study/routes.ts` 의 `KNOWN_ENVIRONMENTS / resolveLoggerEnv / buildLogger` 25줄을 새 파일에 복사 (or `self-grade/routes.ts` 신설)
- `apps/web/src/components/SelfGradeCard.tsx` 가 `API_BASE` + 401 redirect 또 복제

**누적 부채**: 6개월 내 routes 4개 + components 5개 추정 → ~200줄 dead duplication 누적. 환경 enum 1회 변경 시 grep + 4파일 수정. **추정 누적 비용: 12-20h (각 부채 1회씩 발견 + 후행 리팩토링) + 무한 lint/grep 의존**.

**3 시나리오 누적**: 보수적 추정 **30-50h** + 1건의 보안 사고 가능성.

---

## Devil's Advocate

**반론 1 (자기 비판)**: "CRIT-1 의 AuthForm `minLength={4}` 는 HTML5 클라이언트 검증일 뿐 보안 영향 없음. 서버 zod 가 본질. 과대 우려 아닌가?"

→ 반박: 본질은 보안이 아닌 **정책 drift 거버넌스**. ADR-034 가 "Phase 3 launch 시 8 복원" 명시했는데 코드 진실 원천이 2곳이면 **launch checklist 누락 발생 자체가 부채**. 6개 항목 중 1개라도 누락되면 ADR-034 본문 위반 → CRITICAL RULE #7 (gates 통과 전 완료 금지) 영역 진입. 본 리뷰는 **거버넌스 충실도** 관점에서 CRIT 유지.

**반론 2**: "MAJOR-1 (Logger 복제) 는 한 번 묶어두면 동결 가능. 60줄이라도 동작 영향 0. 본 시점에서 리팩토링 가치보다 ROI 낮음."

→ 반박: ROI 는 **현재 시점** 60줄 vs 미래 routes 4-6개 추가 후 240-360줄. 본 리뷰 시점이 Phase 2 종착 → **Phase 3 본격 진입 전이 마지막 저비용 시점**. carry-over 우선순위 재산정 (task #4) 시 본 리팩토링을 Phase 3 첫 step 에 포함 권장 (≤2h).

**반론 3 (테스트 통과 = 안전 가정 거부)**:

- `dummy-verify.test.ts` 는 `performDummyVerify` 가 reject 하지 않음만 검증, 실제 PBKDF2 byte mismatch 시 false 반환을 검증 못 함
- `password.test.ts:24` 의 `it.skip` 은 ADR-034 동안 영속 — 6개월 후 누군가 ADR-034 복원 시 unskip 잊으면 silent regression 영구
- `routes.test.ts` 가 SameSite 환경별 분기 (production = None vs dev = Lax) 의 production 환경 실측 케이스 부재 (단위 테스트는 `ENVIRONMENT='test'` 만)

→ **추가 부채**: 본 페르소나 범위 밖 (quality-engineer 페르소나가 다룰 영역) — 본 리뷰는 명시만 하고 ownership 이관.

---

## 다음 페르소나 인계 사항

- **Persona 2 (performance-engineer)**: MAJOR-4 web API client 부재 — Phase 3 사용자 1만 명 시 401 redirect race condition (동시 다발 fetch) 검토 필요
- **Persona 3 (quality-engineer)**: `it.skip` 영속 (password.test.ts:24) + dummy-verify 회귀 테스트 부재 — Devil's Advocate 반론 3 영역
- **Persona 4 (backend-architect)**: study/routes.ts 의 `void examIdParam.examId` (Hard Rule 16) 정합성 + Year 2 zero-cost 전환 시그니처 검증
- **Persona 5 (devops-architect)**: MAJOR-3 ADR-034 복원 의무 binding — deploy-gate hook 설계 / production env 분기 hook 검토

---

## 판정

**Phase 2 Eval MVP 완료 가능 여부 (Refactoring 관점)**: ✅ **완료 가능** (CRIT-1 1건은 Phase 3 launch 전 해결 필수, 즉시 차단 사유 아님 — Phase 2 평가 환경 동작은 정상)

**carry-over 권장 우선순위** (task #4 입력용):

1. CRIT-1 — PASSWORD_MIN_LENGTH shared 이관 + AuthForm.tsx 동기화 (Phase 3 launch 게이트, 0.5h)
2. MAJOR-3 — ADR-034 복원 의무 코드 binding (tasks gate yaml 작성, 1-2h)
3. MAJOR-1 — Logger builder 추출 (Phase 3 첫 step 권장, 1.5h)
4. MAJOR-2 — DUMMY_HASH 런타임 lazy 또는 회귀 테스트 (1-2h)
5. MAJOR-4 — Web API client 통합 (Phase 3 component 추가 전, 2-3h)
6. MINOR 3건 — Phase 3 진입 점진 흡수

**총 carry-over 추정 비용**: 6-10h (Phase 3 launch 전 분산 처리 가능).
