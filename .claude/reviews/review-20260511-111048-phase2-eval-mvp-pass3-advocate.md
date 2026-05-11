# 4-Pass Review — Pass 3 (Advocate, UX + Security)

## 리뷰 메타

- **Pass**: 3 / 4 — Advocate (Cross-Cutting, UX + Security)
- **세션**: Session 065 누적 (Phase 2 Eval MVP 종착)
- **리뷰 일시**: 2026-05-11 11:10 KST
- **리뷰 방식**: 독립 에이전트 (security-engineer 페르소나), cold-start, 코드 작성 컨텍스트 미보유
- **리뷰 범위 (변경 파일)**:
  - `apps/api/src/auth/constants.ts` ★★★
  - `apps/api/src/auth/routes.ts` ★★★
  - `apps/api/src/index.ts` (CORS allowlist)
  - `migrations/0028_pbkdf2_iterations_workers_compat.sql` ★★★
  - `apps/web/src/components/AuthForm.tsx`
  - `apps/web/src/pages/auth/login.astro`
  - `apps/web/src/components/QuestionCard.tsx`
  - `apps/web/src/pages/index.astro`
  - `apps/web/src/layouts/BaseLayout.astro`
  - `apps/web/src/pages/study.astro`
  - `docs/adr/ADR-034 / 035 / 036`
- **리뷰 범위 (연관 파일, 누적 검증)**:
  - `apps/api/src/auth/password.ts` (verifyPassword downgrade-defense)
  - `apps/api/src/auth/dummy-verify.ts` (DUMMY_HASH 생성 정합)
  - `apps/api/src/auth/hibp.ts` (HIBP 호출 보존)
  - `apps/api/src/auth/rate-limit.ts` (brute-force 방어선)
  - `apps/api/wrangler.toml` (rate-limit period 값)
- **자세한 cold-start 컨텍스트 입력**: ADR-034/035/036, handoff-074

## 요약 (보안 N / UX N)

- **🔴 CRITICAL**: 3건 (보안 2 / UX 1)
- **🟠 MAJOR**: 4건 (보안 3 / UX 1)
- **🟡 MINOR**: 5건 (보안 2 / UX 3)
- **✅ 확인 (PASS)**: 12건+
- **판정**: **수정 필요** — CRITICAL 3건 즉시 해결 의무 (특히 Pass3-C-1 `DUMMY_HASH` 생성 정합 위반은 timing 평탄화를 약화시켜 ADR-034 임시 보안 부채와 곱연산됨)

---

## 🔴 CRITICAL

### Pass3-C-1 — DUMMY_HASH가 100k 반복으로 재생성되지 않음 (timing leak 잠재)

**파일**: `apps/api/src/auth/dummy-verify.ts:42-48`

**증거**:

```ts
// 주석은 "PBKDF2-SHA256(sentinel, salt, 600000, 32)" 로 표기:
//   hash: 'HuUFGOloapz0iDvU53eQP5rSR6ps7nGmoERaGosE9dM=',  ← 600k iter로 생성된 base64
//   salt: '3OGQW6Rmw7USUH6nDsSQVg==',
//   iterations: PBKDF2_ITERATIONS,  ← 이제 100000
```

ADR-035에서 `PBKDF2_ITERATIONS`가 600k → 100k로 떨어졌음에도 `DUMMY_HASH.hash`/`DUMMY_HASH.salt` base64는 **600k iter PBKDF2 산출물 그대로**. 그러나 `iterations: PBKDF2_ITERATIONS`는 100k.

**문제 1 — Timing 평탄화 실패**:

- `performDummyVerify` → `verifyPassword(plaintext, DUMMY_HASH)`
- `password.ts:59` `if (stored.iterations < PBKDF2_ITERATIONS) return false` → 통과 (100k == 100k)
- `password.ts:71` `derivePbkdf2Bits(plaintext, salt, stored.iterations=100k)` — **100k 반복만 수행**
- 정상 user 로그인 경로: 100k 반복 (신규 user 모두 100k 저장) → 동일 CPU 소비. **이 경로는 OK**
- 그러나 dummy-verify.ts의 주석 "iterations 를 현재 PBKDF2_ITERATIONS 와 **반드시** 동일하게 유지" + DUMMY_HASH 본체가 600k로 만들어진 사실은 향후 또 다른 반복수 변경 시 silent fail의 씨앗.

**문제 2 — 실제로 testing 회귀로 잡힘**:

- `__tests__/dummy-verify.test.ts:74` `it('iterations equals current PBKDF2_ITERATIONS (downgrade defense)')` — 이 테스트는 `DUMMY_HASH.iterations` 필드와 `PBKDF2_ITERATIONS` 일치만 검증. base64 산출물 정합은 검증 안 함.
- 즉, **회귀 테스트가 통과하더라도 hash와 iterations이 모순된 상태**가 영속됨.

**문제 3 — 재생성 절차 누락**:

- ADR-035에서 PBKDF2_ITERATIONS 변경만 다루고 dummy-verify.ts hash/salt 재생성 의무를 명시 안 함. dummy-verify.ts:38 주석은 "재생성 필요" 명시하나 이번 변경에서 실행 안 됨.

**위험도**: 본 시점 (진산 단독 user, production traffic 0) 직접적 timing attack 노출 0. 그러나 **ADR-035 carry-over의 silent debt가 정확히 이 패턴**(constant 변경 → dummy hash 재생성 누락 → timing leak)이므로 Phase 3 복원 시 또 누락 가능.

**권고**:

1. dummy-verify.ts:43-46의 hash/salt를 100k iter로 재생성 (주석 스크립트 `|v1` → `|v2`)
2. dummy-verify.test.ts에 base64 산출물 직접 정합 테스트 추가 (random plaintext로 derivePbkdf2Bits 호출 후 DUMMY_HASH.hash와 비교 X — sentinel 평문으로 derivePbkdf2Bits 직접 실행하여 일치 검증)

---

### Pass3-C-2 — 임시 보안 정책이 환경 변수 분기 없이 production에 영구 박힘

**파일**: `apps/api/src/auth/constants.ts:23, 42`

**증거**:

```ts
export const PBKDF2_ITERATIONS = 100000; // 컴파일 시점 하드코딩
export const PASSWORD_MIN_LENGTH = 4; // 컴파일 시점 하드코딩
```

ADR-034 §"복원 의무"는 "Phase 3 launch 1주 전 또는 외부 사용자 등록 진입점 노출 시점에 다음 모두 복원" + 6-item 체크리스트 명시. 그러나:

- **`process.env.PASSWORD_MIN_LENGTH` 같은 환경 변수 우회 없음** (grep 결과 환경변수 분기 0건)
- 100k / 4 모두 빌드 산출물에 박힌 상수
- 즉, 평가 환경과 production이 **물리적으로 같은 정책**. ADR-034는 "평가 환경 한정"이라 표현하나 코드는 "전역 정책"

**위험도**:

- 만약 Phase 3 launch 시 `wrangler.toml` env=production만 바꾸고 constants.ts 복원을 잊으면 **launch 후에도 4자리/100k 정책 유지**.
- ADR-034 §"보안 위험 영속" 6항목 체크리스트는 인간 의무. quality-gate / hook이 강제하지 않음.
- 평가 환경 → 외부 노출 진입점이 "1주 전 명시 carry-over" 신뢰 의존 = **CRITICAL RULE #6 (불가능 이유 먼저)** 정합 위반 가능성.

**권고**:

1. constants.ts에 `process.env.NODE_ENV` 또는 wrangler env 변수 분기 도입 (예: `PASSWORD_MIN_LENGTH = env.EVAL_MODE === 'true' ? 4 : 8`)
2. 또는 wrangler.toml `[env.production]` vars에 `PASSWORD_POLICY = 'production'` 명시 + auth/constants.ts가 c.env 통해 lookup
3. 또는 **최소한** quality-gate.sh hook에 `PASSWORD_MIN_LENGTH = 4` 발견 시 차단 + ADR-034 6항목 완료 manifest 통과 의무화
4. Phase 3 launch 직전 자동 검증: 4-Pass + 5-페르소나 리뷰 트리거에 "PASSWORD_MIN_LENGTH < 8 OR PBKDF2_ITERATIONS < 600k 발견 시 CRITICAL"

---

### Pass3-C-3 — Register 엔드포인트에 per-email rate limit 부재 + 약화된 정책 결합 → 4자리 brute-force 가능

**파일**: `apps/api/src/auth/routes.ts:118-130`

**증거**:

```ts
router.post('/register', async (c) => {
  // ...
  const ipAllowed = await checkIpRateLimit(...);  // 20 req/60s per IP
  if (!ipAllowed) { ... }
  // ❌ checkEmailRateLimit 없음
```

vs login (routes.ts:230-239) — IP + email 이중 방어.

**현 정책 조합 (ADR-034 + ADR-035 carry-over 상태)**:

- PASSWORD_MIN = 4 (4자리 숫자 = 10^4 = 10,000 조합)
- PBKDF2 100k (CPU 시간 OWASP 2023 권고 미달)
- Register: IP 20/60s, NO email limit
- Login: IP 20/60s + email 5/600s (prod), 5/60s (dev)

**공격 시나리오 (직접 보안 위험)**:

1. 공격자가 register `/api/auth/register`로 `{email: victim@example.com, password: '0000'..'9999'}` 시도
2. 첫 시도 → 409 EMAIL_TAKEN (이미 등록된 email이라면) — **email enumeration 정합 X** (이는 별도 이슈, Pass3-M-2 참조)
3. 만약 공격자가 자기 계정으로 `/api/auth/register` 호출 시 PBKDF2 100k가 매번 trigger (Workers CPU 50ms 소비)
4. 단 1개 IP에서 20 req/60s → 1분 1200 = 시간당 1200, 일 28,800 reg req. **4자리 무차별 시도 시 10000/1200 = 8분으로 완료**

**위험도**:

- 직접적 register brute-force가 가능 (login 경로는 email rate-limit으로 차단되나 register는 IP만)
- 공격자가 다수 IP 풀(VPN / 무료 proxy) 보유 시 IP rate-limit 회피 → 4자리 + 100k 정책에서 가용 시간 dramatically 감소

**권고**:

1. Register에도 `checkEmailRateLimit` 적용 (5 req/600s — login과 동일) — email 1개당 register 시도 횟수 제한
2. 또는 register는 "이메일 인증 후 register" 워크플로우로 변경 (Phase 3 carry-over `project_launch_legal_bundle_deferred.md`에 이미 포함)
3. **Phase 3 launch 직전 의무**: register에도 email rate-limit 적용 — ADR-034 §"복원 의무"에 7번째 체크리스트 추가

---

## 🟠 MAJOR

### Pass3-M-1 — SameSite=None + Secure + HttpOnly가 cross-site CSRF 100% 차단 못함

**파일**: `apps/api/src/auth/routes.ts:525-527, 537-550`

**증거**:

```ts
function authCookieSameSite(environment: string | undefined): 'Strict' | 'Lax' | 'None' {
  return isSecureCookieEnv(environment) ? 'None' : 'Lax';
}
```

ADR-036 §근거 "다층 방어 정합" 주장:

- Origin allowlist (CORS_ALLOWED_ORIGINS)
- httpOnly 쿠키 + Secure
- JWT 검증

**그러나 CSRF 시나리오 분석**:

- 공격자가 `evil.com`에 `<form action="https://thepick-api-production...workers.dev/api/auth/login" method="POST">` 또는 `fetch()` 작성
- CORS preflight: 공격자 fetch는 Origin: evil.com 헤더 자동 부착 → CORS_ALLOWED_ORIGINS 미포함 → **브라우저가 응답을 evil.com에 노출 X**
- ✅ 그러나 **요청 자체는 도달**. SameSite=None이라 쿠키 전송됨. side-effect를 가진 라우트(예: `/api/auth/logout`, `/api/auth/refresh`, 향후 결제/구독 변경)는 **CSRF 노출**.
- 현재 logout/refresh도 SameSite=None 쿠키로 보호 → 공격자가 victim의 logout/refresh를 강제 호출 가능 (DoS 또는 session rotate)

**ADR-036 §결정 영역 분류**: "진산 단독 사용 + production traffic 0 + 외부 노출점 사실상 0" → 본 시점 실제 공격 위험 미미.

**그러나 carry-over deadline 정합**:

- ADR-036 §복원 의무는 "Phase 3 launch 직전 custom domain 통합" 시 strict 복원
- 그 사이 외부 user 1명이라도 등록되는 순간 본 CSRF는 실재 위협

**권고**:

1. SameSite=None 상태에서 **side-effect mutating endpoints에 CSRF token** 추가 검토 (Phase 3 carry-over ADR-036 §복원 의무 4번 이미 명시) — 본 권고는 강조 의무
2. Phase 3 custom domain 통합 전이라도 외부 user 진입 시점이 도래하면 ADR-036 복원 우선
3. Origin 헤더 미존재 시 (예: <a href> top-level navigation) referer 검증 fallback

---

### Pass3-M-2 — Register 응답으로 email enumeration 가능 (EMAIL_TAKEN 409)

**파일**: `apps/api/src/auth/routes.ts:185-187`

**증거**:

```ts
if (err instanceof Error && D1_UNIQUE_CONSTRAINT_PATTERN.test(err.message)) {
  return c.json({ error: 'EMAIL_TAKEN', message: AUTH_MESSAGES.REGISTER_EMAIL_TAKEN }, 409);
}
```

**문제**:

- login 경로는 `INVALID_CREDENTIALS` 단일 응답으로 enumeration 차단 (Pass 1 C-2 누적)
- 그러나 register 경로는 `EMAIL_TAKEN`을 명시 → **공격자가 임의 email 입력 시 가입 여부 확인 가능**
- 4자리 password 시점에서 enumeration은 brute-force 1단계가 됨

**완화**:

- ADR-034 §"평가 환경 = 진산 단독 user" → 현 시점 enumeration 가치 0 (유일한 user는 진산)
- 그러나 ADR-034 §복원 의무 6항목에는 enumeration 차단 항목 없음 → 누락 carry-over

**권고**:

1. register 응답 enumeration 차단: EMAIL_TAKEN 대신 "확인 이메일을 보냈습니다" 같은 응답 + 실제 이미 등록된 user에게는 "다른 사용자가 등록을 시도했습니다" 알림 (Phase 3 carry-over)
2. ADR-034 §"복원 의무"에 enumeration 차단 항목 추가 의무
3. 또는 register는 "이메일 인증 사전 단계"로 변경 (memory `project_launch_legal_bundle_deferred.md` 정합)

---

### Pass3-M-3 — Open redirect `next` 파라미터 보호가 backslash variants 누락

**파일**: `apps/web/src/components/AuthForm.tsx:28-35`

**증거**:

```ts
function resolveNext(): string {
  if (typeof window === 'undefined') return '/study/';
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next === null || next === '') return '/study/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/study/';
  return next;
}
```

**문제**:

- `//evil.com` → 차단 (OK)
- `/\evil.com` (백슬래시) → `startsWith('/')` 통과, `startsWith('//')` 미통과 → **return 그대로**
- 일부 브라우저(특히 IE 레거시, 일부 모바일 브라우저)는 백슬래시를 forward slash로 정규화 → `window.location.href = '/\\evil.com'` → `//evil.com` → 외부 도메인 navigation
- 또한 `/%2fevil.com` (URL-encoded slash) → `startsWith('/')` 통과, URL decode 후 `//evil.com`

**위험도**:

- 모던 Chrome / Safari는 백슬래시 sanitize → 직접 위험 미미
- 그러나 Firefox / 일부 모바일 webview / 레거시 환경에서 노출 가능
- 피싱 공격에서 `https://thepick.app/auth/login?next=/\\evil.com` 같은 URL이 사용자에게 노출 시 신뢰도 활용

**권고**:

1. `resolveNext` 정규 path-only 검증 강화:

```ts
if (!/^\/[a-zA-Z0-9_/\-]*$/.test(next)) return '/study/';
```

또는

```ts
try {
  const url = new URL(next, window.location.origin);
  if (url.origin !== window.location.origin) return '/study/';
  return url.pathname + url.search;
} catch {
  return '/study/';
}
```

2. Phase 3 carry-over: i18n 활용 + 화이트리스트 path 목록 권장

---

### Pass3-M-4 — wrangler.toml AUTH_RATE_LIMITER_EMAIL period 환경별 불일치

**파일**: `apps/api/wrangler.toml:73, 134, 188`

**증거**:

```toml
# development: limit = 5, period = 60
# staging:     limit = 5, period = 600
# production:  limit = 5, period = 600
```

그리고 routes.ts:237:

```ts
c.header('Retry-After', '600');
```

**문제**:

- dev period=60이라 Retry-After=600이 실제 reset 시간과 10배 차이 → dev에서 60초 후 reset되나 사용자에게 "10분 대기" 안내 → **UX deception**
- 또는 prod는 600s, dev는 60s — 정책 차이가 의도적이라면 ADR에 명시되어야 하나 없음
- ADR-006(Cloudflare rate limit) 정합 검증 누락

**권고**:

1. dev period=600으로 통일 (보안 정책 일관성) 또는 의도가 60이라면 ADR-006 §변경에 명시
2. routes.ts에서 retry-after를 env별 분기 (`c.env.ENVIRONMENT === 'development' ? '60' : '600'`)
3. 회귀 테스트 추가 (env별 rate-limit period 정합 검증)

---

## 🟡 MINOR

### Pass3-Mi-1 — CORS_ALLOWED_ORIGINS의 thepick.app가 ADR-036 명시 carry-over 미정합

**파일**: `apps/api/src/index.ts:31`

```ts
'https://thepick.app',  // domain 확정 시 업데이트 명시
```

ADR-036 §복원 의무 1번 "custom domain 적용: study.thepick.app + api.thepick.app". 그러나 CORS에는 `thepick.app` (apex) 만. memory `project_custom_domain_thepick_app_collision.md` "thepick.app 타인 보유" → 현 도메인은 미사용. 사용 시점 도래 시 subdomain 추가 의무.

**권고**: CORS 주석에 ADR-036 §"복원 의무" reference 추가 + 향후 custom domain 적용 시 자동 동기 manifest 구축

### Pass3-Mi-2 — 비밀번호 정책 사용자 안내가 실제 정책과 불일치

**파일**: `apps/web/src/components/AuthForm.tsx:113`

```tsx
<input type="password" required minLength={4} ... />
```

- 사용자에게는 **4자리 이상만 안내** (HTML5 minLength=4)
- 그러나 ADR-034 §"보안 위험 영속"에 명시된 본질: "OWASP 권고 8자, 본격 정책은 Phase 3 복원"
- 사용자가 "4자리 충분"으로 학습되면 Phase 3 8자 복원 시 forced password reset 충격
- AuthForm에 "평가 환경 임시 정책" 명시 누락 (UX 투명성)

**권고**: AuthForm에 작은 안내 "평가 환경 임시 정책 — 4자리 이상 가능 (런칭 시 8자 이상 의무)" 추가

### Pass3-Mi-3 — ProgressSummary가 examType prop 미수신

**파일**: `apps/web/src/pages/study.astro:12`

```astro
<ProgressSummary client:load />  ← examType 미전달
<QuestionCard examType="1st" client:load />
```

study.astro는 1차 학습 페이지로 변경되었으나 ProgressSummary는 examType 무관하게 호출 → 진척 표시가 1차/2차 구분 X 가능성. (ProgressSummary 내부 구현 미확인 — 가능성만 표시)

**권고**: ProgressSummary가 examType prop을 받아 1차/2차 진척 분리 표시 (Phase 2 carry-over 가능)

### Pass3-Mi-4 — login.astro에 OfflineIndicator 미장착

**파일**: `apps/web/src/pages/auth/login.astro`

- index.astro / study.astro에는 `<OfflineIndicator client:load />` 포함
- login.astro에는 없음 → 오프라인 상태에서 로그인 시도 시 네트워크 에러로만 노출 (auth catch에서 잡힘)

**권고**: login.astro에도 OfflineIndicator 추가 (일관성)

### Pass3-Mi-5 — DUMMY_HASH의 "dummy-verify-sentinel-v1" 평문이 register에서 사용 시 EMAIL_TAKEN 응답 시도 가능

**파일**: `apps/api/src/auth/dummy-verify.ts:24-30`

dummy-verify 주석에 sentinel 평문이 평문으로 노출. 공격자가 이 평문을 password로 사용 시 dummy-verify timing path와 동일한 시간 소비 → **timing 차이 식별 불가** (예상되는 동작). 그러나 sentinel 평문이 진산님의 실제 password일 경우 (확률 매우 낮음) DUMMY_HASH 비교에서 `true` 반환되어 timing 평탄화 fail. 본질은 OK이나 주석 visibility는 minor.

**권고**: sentinel 평문을 환경 변수로 외부화 (선택) 또는 주석에 "본 평문이 실제 user password와 충돌 가능성 0에 가깝지만 0 아님" 명시

---

## ✅ 확인 증거 (보안 / UX 카테고리별 최소 3개)

### 보안 카테고리

1. **`apps/api/src/auth/password.ts:59` PBKDF2 downgrade 방어**: `if (stored.iterations < PBKDF2_ITERATIONS) return false` — 2중 방어선. 단, ADR-035 이전 600k user는 0건 (handoff §"production user 영향")이라 영향 없음. PASS.

2. **`apps/api/src/auth/routes.ts:265-298` Login enumeration 방어**: row null / status non-active / password mismatch 모두 `INVALID_CREDENTIALS` 단일 응답. timing 평탄화 dummy verify 호출. constant-time 응답 정합. PASS.

3. **`apps/api/src/auth/routes.ts:537-550` Cookie 속성 정합**: `httpOnly: true, secure: env-conditional, sameSite: env-conditional, path: 명시, maxAge: 명시`. ADR-036 정합. PASS.

4. **`apps/api/src/index.ts:75-87` CORS allowlist 동작**: function-form origin callback이 unallowed origin 시 `null` 반환 → Hono cors 미들웨어가 Access-Control-Allow-Origin 헤더 미설정 → 브라우저 차단. credentials=true도 정합. PASS.

5. **`apps/api/src/auth/routes.ts:153-157` Register hash fail 처리**: hashPassword try-catch + logger.error + 500 응답. silent failure 없음. CLAUDE.md 빈 catch 금지 정합. PASS.

6. **`apps/api/src/auth/dummy-verify.ts:54-58` Dummy verify result void**: `void result` 명시. 결과 사용 0건. PASS.

7. **`apps/api/src/auth/routes.ts:140-149` HIBP 호출 보존 + logging 보존**: HIBP `checkPwned` 호출 자체는 유지 (logging이 audit trail) + 422 분기만 주석 처리. ADR-034 §"복원 의무" 준수 정합. PASS.

8. **`migrations/0028_pbkdf2_iterations_workers_compat.sql:18-23` Trigger 최소 100k 강제**: D1 INSERT 시 password_iterations < 100000 즉 RAISE(ABORT). DB layer 방어선. PASS.

9. **`apps/api/src/auth/routes.ts:159` userId crypto.randomUUID()**: Web Crypto API의 UUIDv4 사용. enumeration 차단 정합. PASS.

### UX 카테고리

10. **`apps/web/src/components/QuestionCard.tsx:184` aria-live="polite"**: 로딩 상태 스크린 리더 노출. 접근성 정합. PASS.

11. **`apps/web/src/components/QuestionCard.tsx:282` aria-label="채점 결과"**: 결과 section 명시 레이블. PASS.

12. **`apps/web/src/layouts/BaseLayout.astro:41-48` 터치 타겟 44px+**: button/a/role=button/checkbox/radio 모두 min-height/min-width 44px. PASS.

13. **`apps/web/src/components/AuthForm.tsx:101, 114, 127` autoComplete 정합**: email/current-password/new-password/name 정확. 패스워드 매니저 호환. PASS.

14. **`apps/web/src/components/QuestionCard.tsx:88-93` 401 → /auth/login redirect**: encodeURIComponent로 next 파라미터 escape. 사용자 학습 복귀 흐름 매끄러움. PASS.

15. **`apps/web/src/pages/index.astro:13-24` 진입점 surface**: 학습 시작 + 로그인/회원가입 2-action. mobile-first. PASS.

16. **`apps/web/src/layouts/BaseLayout.astro:16-21` PWA meta**: mobile-web-app-capable + apple-\* 추가. manifest + apple-touch-icon. PASS.

17. **`apps/web/src/components/AuthForm.tsx:80-83, 107-110` 에러 fallback**: 한국어 에러 메시지 + 네트워크 catch 명시 + ERROR_MESSAGES 매핑. PASS.

---

## 🛡️ Devil's Advocate (공격 시나리오)

### 시나리오 A — Register Brute-Force (Pass3-C-3 + ADR-034 + ADR-035 곱)

**상황**: 공격자가 victim email (`victim@example.com`)을 알고 brute-force 시도.

**단계**:

1. 공격자가 `/api/auth/login`으로 시도 → email rate-limit 5/600s 차단 (login은 보호됨)
2. 그러나 `/api/auth/register`로 우회:
   - victim 이미 등록 → 409 EMAIL_TAKEN (Pass3-M-2 enumeration)
3. 공격자가 victim의 password 4자리를 알아내려면:
   - login 경로 5 시도 / 10분 → 4자리 (10000) / 5 = 2000 cycle × 10분 = 13.8일
   - **그러나 다중 IP 풀 보유 시**: 1000 IP × 20 req/60s = 20000 req/분 → 4자리 30초 완료
4. 시나리오 B (사회공학) — 공격자가 진산 휴대폰/PC 탈취 시 4자리 password는 즉시 노출

**대응 강도**:

- 본 시점 (진산 단독 user) → 실제 위협 미미
- Phase 3 외부 사용자 1명이라도 진입 시 → CRITICAL 위험
- ADR-034 §"복원 deadline" 신뢰 의존

---

### 시나리오 B — Cookie Replay / CSRF (Pass3-M-1)

**상황**: 공격자가 진산 브라우저에 reflected XSS 1건이라도 발견하면 cookie 탈취 우회 가능.

**단계**:

1. HttpOnly로 JS 직접 탈취 차단 (PASS)
2. 그러나 SameSite=None이라 evil.com이 `<img src="https://thepick-api...workers.dev/api/auth/logout" />` 단순 GET 호출 시 cookie 전송 — 그러나 logout은 POST이므로 이 시나리오 미적용
3. 공격자가 evil.com에 `<form action="https://thepick-api.../api/auth/logout" method="POST" />` + auto-submit → cookie 전송 + CORS preflight 통과 → **logout 강제 발동** (logout은 OPTIONS preflight를 필요로 하나 simple form post가 CORS preflight 없이 통과 가능)
4. 본 사례 직접 피해: logout (DoS). 향후 결제/구독 변경 endpoint 도입 시 → 자산 변경 가능

**대응 강도**:

- CSRF token 미도입 + SameSite=None + 결제 endpoint 추가는 동시 충족 시 CRITICAL
- Phase 3 carry-over `ADR-036 §"복원 의무"` 4번 (CSRF token) 우선순위 상향 권고

---

### 시나리오 C — DUMMY_HASH 불일치로 인한 향후 timing leak (Pass3-C-1 carry-over)

**상황**: Phase 3 launch 시 PBKDF2_ITERATIONS를 100k → 600k로 복원하나 dummy-verify.ts hash/salt 재생성 누락.

**단계**:

1. 신규 user 가입 → password_iterations=600k 저장
2. 공격자가 `/api/auth/login`으로 `email=nonexistent@example.com` 시도:
   - `verifyPassword(plaintext, DUMMY_HASH)` 호출
   - DUMMY_HASH.iterations=600k (PBKDF2_ITERATIONS), DUMMY_HASH.hash는 이전 100k 산출물
   - downgrade defense: `600k < 600k` false → 통과
   - derivePbkdf2Bits(plaintext, salt, 600k) — 600k 반복 수행
   - **timing CPU 소비는 정상 경로와 동일** (둘 다 600k)
   - 결과 hash 비교 → 항상 false (다른 hash) → return false
3. 사용자가 nonexistent vs invalid_password 응답 시간 차이 식별 → enumeration
4. **결론**: 본 시나리오는 timing 자체는 평탄화됨 (둘 다 600k PBKDF2 수행). 그러나 의도와 다른 동작이 silent로 지속 → ADR 변경 시 회귀 테스트가 신호 안 줌.

**대응 강도**:

- Direct timing leak risk: LOW (PBKDF2 시간이 dominant이라 hash diff는 미미)
- Hidden complexity / silent drift: HIGH (개발자가 코드 행동 vs 주석 의도 차이 인지 못 함)

---

## 📊 ADR-034/035/036 보안 부채 정량 평가

### ADR-034 — PASSWORD_MIN 4 + HIBP disable

**Brute-force 시간 (offline crack, GPU 8x RTX 4090 기준)**:

- 4자리 숫자 password (10^4 = 10,000 조합)
- PBKDF2-SHA256 100k iter
- 단일 GPU PBKDF2-SHA256 100k: 약 50k hash/sec
- 8 GPU: 400k hash/sec
- 10,000 / 400,000 = **0.025초** (★ 사실상 즉시 crack)

**Online brute-force (rate-limit 미회피)**:

- login: 5 req / 600s = 0.5/min = 720/day → 4자리 14일 (worst case)
- 다중 IP 풀 우회 시: register 경로로 20 req / 60s × N IP

**HIBP disable 영향**:

- 4자리 숫자 `0000`, `1234` 등은 HIBP top-100 빈출 → 정상 HIBP 동작 시 100% reject
- 본 변경으로 사용자가 가장 흔한 패턴 사용 가능

**carry-over 의무 시점**:

- ADR-034 §"복원 의무" 6항목 PASS 후 Phase 3 launch
- 외부 user 1명이라도 도입 직전 의무

### ADR-035 — PBKDF2 100k vs 600k

**CPU 시간 비교 (Workers 환경)**:

- PBKDF2-SHA256 100k: 약 20~30ms (constants.ts:21 명시)
- PBKDF2-SHA256 600k: 약 120~180ms (Workers 50ms 한도 초과 → register 100% fail이 ADR-035 배경)

**Offline crack cost (4090 GPU 1대 기준, 8자 영숫자 password)**:

- 100k iter: $5,000 per password (ADR-035 §근거 명시)
- 600k iter: $30,000 per password (6배)
- **차이**: 6배 → 100k는 OWASP 2023 권고(310k) 미달, 2024 권고(600k) 미달

**대안 시점**:

- Argon2id WASM: Workers 호환 + memory-hard → GPU 공격 어려움
- 외부 hash service: 단일 벤더 위배 → 미채택

### ADR-036 — SameSite=None CSRF 노출도

**Strict vs None 비교**:

- SameSite=Strict: 모든 cross-site fetch에 cookie 미전송 → CSRF 100% 방어
- SameSite=None: 모든 cross-site에 cookie 전송 (Secure 필요) → CSRF token 또는 다른 방어선 필수

**HttpOnly / Secure 보완 평가**:

- HttpOnly: JS 탈취 차단 (XSS 1차 방어) — PASS
- Secure: HTTPS 강제 (전송 중 탈취 차단) — PASS
- 그러나 **CSRF 자체 방어 효과 0** (HttpOnly/Secure는 mitigation 아닌 transport-layer 방어)

**현 시점 노출도**:

- Origin allowlist (CORS) 강력 — 응답 leak 차단
- 그러나 side-effect endpoint (logout, refresh, 향후 결제) CSRF 가능
- 진산 단독 user 시점 직접 위험 미미

**Phase 3 복원 deadline**:

- custom domain 통합 → Strict 복원 + CORS allowlist 축소

---

## 판정

**완료 가능 / 수정 필요**: **수정 필요**

**즉시 수정 (CRITICAL 3건)**:

1. Pass3-C-1: DUMMY_HASH 100k 재생성 또는 회귀 테스트 강화
2. Pass3-C-2: PASSWORD_MIN_LENGTH / PBKDF2_ITERATIONS 환경 변수 분기 또는 quality-gate hook 강제
3. Pass3-C-3: register에 per-email rate limit 추가

**Phase 3 launch 전 의무 (MAJOR 4건)**:

- ADR-036 §"복원 의무" CSRF token 도입
- register enumeration 차단 (Pass3-M-2)
- open redirect `next` 정규 path-only 강화 (Pass3-M-3)
- wrangler.toml rate-limit period 환경별 정합 (Pass3-M-4)

**MINOR 5건**: 다음 phase carry-over OK

---

## 부록 — 누적 검증 미커버 영역

- `apps/api/src/auth/middleware/` — 인증 middleware 본 리뷰 미커버 (Pass 1/2 영역)
- `apps/api/src/auth/session.ts` — JWT signing / refresh rotation 본 리뷰 미커버 (Pass 1/2 영역)
- `apps/api/src/study/routes.ts` — examType '1st' default 변경 본 리뷰 부분 커버 (study domain 코어 검증은 Pass 4 영역)
- `apps/web/src/components/ProgressSummary.tsx` — 본 리뷰 미커버 (Pass3-Mi-3 가설 단계)

**다음 Pass 권고**: Pass 4 (Contract — 기획 대조)에서 ADR-034/035/036 carry-over 6+5+5 = 16항목 체크리스트가 실제 carry-over 영속 채널(handoff, MEMORY)에 정합 등재 검증.
