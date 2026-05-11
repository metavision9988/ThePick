# 4-Pass Review — Pass 1 (Surgeon, Bottom-Up)

## 리뷰 메타

- 일자: 2026-05-11 KST
- 범위: Session 065 누적 7 commits (f98532d..HEAD = 4405c92)
- 리뷰어: silent-failure-hunter (독립 에이전트, cold-start)
- 리뷰 컨텍스트: 코드 작성 메인 대화와 분리. 자기 확인 편향 차단을 위해 handoff-074 외 변경 동기는 모름.
- 본 Pass 본질: "이 코드 단독으로 터지는 경로가 있는가?" — Null/Async/경계/에러/정밀도/타입/리소스

## 리뷰 범위 (실제 확인 파일 28개)

### 신규 (8)

1. `apps/web/src/components/AuthForm.tsx`
2. `apps/web/src/pages/auth/login.astro`
3. `migrations/0028_pbkdf2_iterations_workers_compat.sql`
4. `docs/adr/ADR-034-test-password-policy-relaxation.md` (계약 참조)
5. `docs/adr/ADR-035-pbkdf2-iterations-workers-compat.md` (계약 참조)
6. `docs/adr/ADR-036-auth-cookie-samesite-cross-origin.md` (계약 참조)
7. `docs/plans/phase2-2nd-self-grade.plan.md` (계약 참조)
8. `docs/deploy/cloudflare-pages-setup.md` (계약 참조)

### 변경 (12)

1. `apps/api/src/index.ts`
2. `apps/api/src/auth/constants.ts`
3. `apps/api/src/auth/routes.ts` ★★★ 다중 ADR 흡수
4. `apps/api/src/auth/__tests__/dummy-verify.test.ts`
5. `apps/api/src/auth/__tests__/password.test.ts`
6. `apps/api/src/auth/__tests__/routes.test.ts`
7. `apps/api/src/__tests__/scenarios.test.ts`
8. `apps/api/src/__tests__/helpers/d1-from-sqlite.ts`
9. `apps/api/src/study/routes.ts`
10. `apps/api/src/study/__tests__/routes.test.ts`
11. `apps/web/src/pages/index.astro`
12. `apps/web/src/layouts/BaseLayout.astro`
13. `apps/web/src/pages/study.astro`
14. `apps/web/src/components/QuestionCard.tsx`

### 연계 참조 (변경 안 됐지만 영향)

- `apps/api/src/auth/dummy-verify.ts` (PBKDF2_ITERATIONS 상수 의존)
- `apps/api/src/auth/password.ts` (downgrade check 의존)
- `apps/api/src/auth/hibp.ts` (호출 보존 + 분기 disable 정합)

---

## 요약

- ✅ PASS 18건 / 🔴 CRITICAL 1건 / 🟠 MAJOR 5건 / 🟡 MINOR 6건 / N/A 0건

---

## CRITICAL (즉시 수정 필수)

### C-1 [apps/api/src/auth/dummy-verify.ts:44 ↔ apps/api/src/auth/constants.ts:23] DUMMY_HASH 임베드 hash bytes 와 stored.iterations 불일치 → timing parity 침해 위험 + 회귀 가드 우회

- **증상**:
  - `DUMMY_HASH.hash` 는 **PBKDF2 600,000 iterations** 산출물 (line 27 주석 `c.pbkdf2Sync(pt, salt, 600000, 32, 'sha256')` 명시).
  - `DUMMY_HASH.iterations` 는 `PBKDF2_ITERATIONS` 상수 경유 → 현재 **100,000** (ADR-035 갱신).
  - 호출 시 `verifyPassword(plaintext, DUMMY_HASH)` 는 `stored.iterations = 100000` 로 PBKDF2 100k 반복 후 bytes 도출 → 임베드 hash bytes (600k 결과)와 mathematically 무관 → 항상 `false` 리턴.
  - 결과적으로 "더미 PBKDF2 실행으로 timing 소비"는 100k 만큼만 수행. 정상 경로 `verifyPassword(user_input, real_stored)` 도 100k → ★ timing parity 유지 (PASS 1 기준).
- **그러나 진짜 위험은 회귀 가드 우회**:
  - `dummy-verify.test.ts:74` `iterations equals current PBKDF2_ITERATIONS` 테스트는 **소스 텍스트 `iterations: PBKDF2_ITERATIONS` 리터럴**만 검사 (line 78 `expect(src).toContain('iterations: PBKDF2_ITERATIONS')`).
  - line 81 `expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100000)` 는 상수만 검사.
  - **임베드 hash bytes 가 stored.iterations 와 정합한지 검증하는 테스트 0건**.
  - 즉 PBKDF2_ITERATIONS 가 600k → 100k → 600k 왕복할 때 hash bytes 재생성 망각해도 회귀 가드가 발견 못 함. 본 코드 commit (`661c320`)이 정확히 그 망각 사례. 회귀 침묵 발생.
- **시나리오 (Phase 3 launch 직전)**:
  1. `PBKDF2_ITERATIONS = 600000` 복원 (ADR-005 정합 회귀).
  2. `DUMMY_HASH.hash` bytes 재생성 망각 — 본 commit 이 만든 100k stub (현재는 600k stub이긴 함, 같은 형태로 망각).
  3. 테스트 PASS — 회귀 미감지.
  4. production 배포 — `performDummyVerify` 가 stored.iterations=600000 으로 derive하면 600k stub과는 합치 (현 상태 비유). 그러나 만약 누군가 라이브 hash 재생성 후 `iterations: PBKDF2_ITERATIONS` 만 갱신하고 hash bytes는 안 갱신하면 timing은 동일하나 가드는 침묵.
- **추가 우려**:
  - 본 100k stub 상태에서 `derivePbkdf2Bits` 가 plaintext+salt+100k → bytes A 계산. stored hash bytes (600k 산출) ≠ A → `timingSafeEqual` 항상 false. 그러나 `timingSafeEqual` 은 **항상 길이가 같으면 전체 루프 (32바이트)** 실행 → timing 측정상 동일. ★ Phase 1 기준 timing parity 침해는 없음 (XOR 32바이트 마이크로초 단위).
  - 즉 본 항목은 **현 시점 timing 침해는 PASS, 회귀 가드 침묵이 CRITICAL** — Phase 3 복원 시점에서 발견되면 too late.
- **권고**:
  - **즉시 수정 1**: `DUMMY_HASH.hash` / `DUMMY_HASH.salt` bytes 를 `PBKDF2_ITERATIONS` (현 100k) 로 재생성 + 주석 `c.pbkdf2Sync(pt, salt, 100000, 32, 'sha256')` 갱신 (ADR-035 정합).
  - **즉시 수정 2**: 회귀 가드 강화 — `dummy-verify.test.ts` 에 runtime 검증 추가:
    ```typescript
    it('DUMMY_HASH bytes are consistent with PBKDF2_ITERATIONS (regression)', async () => {
      // verifyPassword(plaintext, DUMMY_HASH) 가 PBKDF2_ITERATIONS 만큼 도는지 timing 측정 +
      // 본 sentinel plaintext + salt + PBKDF2_ITERATIONS 재계산 후 bytes 일치 검증
      const recomputed = await derivePbkdf2Bits(
        'dummy-verify-sentinel-v1-...',
        salt_bytes,
        PBKDF2_ITERATIONS,
      );
      expect(base64Encode(recomputed)).toBe(DUMMY_HASH.hash);
    });
    ```
  - **항구 대책**: `dummy-verify.ts` 를 **런타임 빌드시 생성** (build script 가 `PBKDF2_ITERATIONS` 읽어 sentinel hash 자동 도출 → ts 모듈 emit). 상수↔임베드 bytes 동기화 자동.
- **분류 근거**: PASS 1 본질 "단독으로 터지는 경로" 는 좁게는 false, 그러나 **silent 회귀 가드 침묵**은 CRITICAL RULE #3 "조용히 삭제 금지" 정신과 정합. handoff-074 §F의 "복원 의무" 6항목 PASS 후 launch 라는 카리오버 의도와 직결.

---

## MAJOR (Phase 2 종착 전 처리 권고)

### M-1 [apps/api/src/study/routes.ts:444-499] grade UPSERT TOCTOU race — 동일 user+question 동시 grade 시 user_progress 중복 row 생성 가능

- **증상**:
  - `/grade` 핸들러 흐름: (1) `SELECT existing` (line 444) → (2) existing===null 이면 `INSERT` (line 477).
  - 두 요청이 거의 동시 도착 시 양쪽 모두 (1)에서 null → 양쪽 모두 (2) INSERT 성공 → `user_progress` 동일 (user_id, card_id, card_type='exam', node_id=NULL) 2 row 생성.
  - **현재 migration 0028까지 user_progress 에 (user_id, card_id, card_type) 또는 동등 UNIQUE 제약 없음** (handoff §F.4 M3+M5 carry-over 명시: "마이그레이션 0029" 미적용).
  - catch 블록 line 501 `D1_UNIQUE_CONSTRAINT_PATTERN.test(err.message)` 가 본 race 의 의도된 방어선이지만 — UNIQUE 제약이 DB에 없으면 INSERT 둘 다 성공 → 409 미발생.
- **시나리오**:
  - 진산님 한 번의 채점 클릭이 네트워크 retry 로 2회 fire (브라우저 Strict Mode + 네트워크 hiccup).
  - 2번째 fire 가 1번째 INSERT 완료 전 도착 → 양쪽 SELECT 결과 null → 양쪽 INSERT 성공.
  - `/next` 의 `LEFT JOIN user_progress` (study/routes.ts:335) 가 동일 card_id 에 2 row 매칭 → SQL cross-product → 동일 문제 2회 surface (또는 ORDER BY 가중치 비정상).
  - **현재 production 미발현 이유**: 진산 단독 + 손가락 클릭 간격 > 채점 응답 시간. PoC 환경 한정으로 잠재 위험.
- **권고**:
  - **단기**: `INSERT INTO user_progress ... ON CONFLICT(user_id, card_id, card_type, COALESCE(node_id, '')) DO UPDATE SET total_reviews = total_reviews + 1, correct_count = correct_count + ?` 형태로 atomic UPSERT (이 경우 SQLite 부분 UNIQUE 인덱스 필요).
  - **중기 (handoff §F.4 carry-over 정합)**: migration 0029 적용 — `CREATE UNIQUE INDEX ux_user_progress_exam ON user_progress(user_id, card_id, card_type) WHERE node_id IS NULL`.
  - **현 상태 영속 명시**: catch 블록의 `D1_UNIQUE_CONSTRAINT_PATTERN` 분기 (line 501) 가 0029 미적용 상태에서 죽은 코드인 것을 주석으로 표기.

### M-2 [apps/api/src/auth/routes.ts:140-149] HIBP 호출 결과 'pwned' 분기 주석 처리 — checkPwned() 부작용 보존 vs 사용자 의도 손실

- **증상**:
  - `await checkPwned(password, logger)` (line 140) 는 그대로 호출 → HIBP API 3초 timeout (HIBP_REQUEST_TIMEOUT_MS) 부담 + audit trail 보존 의도.
  - 그러나 'pwned' 결과를 차단하지 않음 (line 144-149 주석). `responseBody.hibpStatus: pwned.status` (line 199) 로 평문 상태 반환.
  - **silent 사용자 의도 손실 위험**: 사용자가 알려진 유출 비밀번호를 입력해도 register 201 성공 + `{hibpStatus: 'pwned'}` 응답. 클라이언트 `AuthForm.tsx` 는 `res.ok` 만 검사 → 가입 성공으로 처리 → 사용자는 '안전한 가입'이라 오해.
- **시나리오**:
  - 평가 환경에서 진산이 '1234' 입력 (4자, ADR-034 정책 ok).
  - HIBP API 응답: `pwned` (1234는 알려진 weak password).
  - register 201 + DB 저장. 진산 모름.
  - 추후 Phase 3 launch 시 본 user record 그대로 production 진입 → 즉시 brute-force 표적.
- **권고**:
  - 본 ADR-034 의도는 "테스트 편의성 + 회귀 가드 보존". 그러나 클라이언트 UX 가 사용자 → 'pwned' 응답을 인지하지 못하면 의도된 audit trail 도 의미 상실.
  - **최소 조치**: `AuthForm.tsx` 가 register 응답의 `body.hibpStatus === 'pwned'` 이면 success toast 대신 경고 banner ("⚠️ 이 비밀번호는 유출 이력이 있습니다. Phase 3 launch 전 변경 필요") 표시.
  - **선택**: 평가 환경 evaluation user (진산 단독) 영속 데이터 cleanup 의무 — Phase 3 launch 직전 ADR-034 §"복원 의무" 에 "기존 평가 user re-register" 추가.
  - **알림**: ADR-035 line 50 "기존 평가 환경 user (PBKDF2 100k stored) 일괄 re-hash 마이그레이션 정책 결정" 과 chain — 동시 처리.

### M-3 [apps/api/src/auth/routes.ts:201-203] hibpMessage 응답 노출 — pwned 상태 + 4자리 비밀번호 조합으로 unauth 측 정보 표면화

- **증상**:
  - register 응답 (line 197) 에 `hibpStatus: string` 노출. 'safe' / 'pwned' / 'unavailable' 셋 중 하나.
  - 비인증 경로 (register 직후) 에서 200 응답에 포함 → 공격자가 임의 비밀번호로 register 시도 후 응답의 hibpStatus 로 HIBP 결과 추출 가능 (HIBP API direct call 우회).
- **시나리오**:
  - 공격자가 ThePick register endpoint 를 HIBP proxy 로 활용 — rate-limit 회피 + HIBP API key 노출 회피.
  - 동일 IP rate-limit (IP_RATE_LIMIT) 가 있긴 하나 (`checkIpRateLimit` line 121), proxy / residential VPN 으로 분산 가능.
  - 본 이슈는 ADR-005 §"HIBP 결과 noise 노출" 사전 검토 미흡.
- **권고**:
  - `hibpStatus` 응답에서 제거 — server-side audit log 만 유지 (line 155 `logger.error('hashPassword failed', ...)` 패턴).
  - 'unavailable' 시 hibpMessage 도 일반 메시지 ("회원가입 완료") 로 통일.
  - 본 항목은 ADR-034 carry-over 시점 (HIBP 분기 활성화 시) 재검토 명시.

### M-4 [apps/api/src/study/routes.ts:309-317 ↔ apps/web/src/components/QuestionCard.tsx:72] examType default '1st' vs '2nd' 불일치 → SSR/client mismatch + 초기 깜빡임

- **증상**:
  - 서버 (line 309): `c.req.query('examType') ?? '1st'`.
  - 클라이언트 (line 72): `examType = '2nd'` (QuestionCardProps default).
  - 호출 명시 (apps/web/src/pages/study.astro:22): `<QuestionCard examType="1st" ... />` → 실제 흐름은 '1st' 정합.
  - 그러나 **컴포넌트 default 값과 페이지 명시값 불일치** = silent drift.
- **시나리오**:
  - 미래 admin-web 등 다른 위치에서 `<QuestionCard />` (default) 사용 시 클라이언트는 '2nd' 로 query → 서버 default 와 무관 (query 명시되므로 ok) → 실제 응답은 '2nd' filter → exhausted (production 2nd=9 self-grade only).
  - 사용자 혼란: '왜 문제가 안 나오지?'
  - QuestionCard line 215 `examType === '2nd' ? '2차' : '1차'` exhausted 메시지 분기는 default '2nd' 가정.
- **권고**:
  - 컴포넌트 default 를 페이지 명시값과 일치 → `examType: '1st' | '2nd' = '1st'` (apps/web/src/components/QuestionCard.tsx:72).
  - QuestionCard.tsx:215 exhausted 메시지 default 도 '1차' 로 매칭.

### M-5 [apps/web/src/components/QuestionCard.tsx:89-92, 122-125] 401 → /auth/login redirect — encodeURIComponent vs server-side ?next 검증 미스매치

- **증상**:
  - QuestionCard 401 → `window.location.href = \`/auth/login?next=${encodeURIComponent(window.location.pathname)}\``.
  - `window.location.pathname` 은 보통 `/study/`. encodeURIComponent('/study/') = `%2Fstudy%2F`.
  - AuthForm 의 `resolveNext` (line 28-35): `params.get('next')` 는 자동 decode → `/study/`. `next.startsWith('/')` true, `next.startsWith('//')` false → 정합 return.
  - **그러나 redirect URL 만들 때 `window.location.pathname` 만 사용 — search params + hash 손실**.
- **시나리오**:
  - 진산이 future `/study/?q=eq-123#answer` 같은 URL 로 진입 (북마크 / 공유 링크) → 401 → redirect → next=`/study/` (search/hash 손실) → 로그인 후 동일 URL 복귀 X.
  - 본 step 한정 영향 없음 (현재 /study/ pathname 만 사용). 그러나 plan phase3-learning-ux-modes 에서 deep link 도입 시 회귀 위험.
- **권고**:
  - 단기: `${window.location.pathname}${window.location.search}${window.location.hash}` 로 보존.
  - 단, server-side `resolveNext` 가 `next.startsWith('/')` 가드만 하므로 deep link 도 통과. 추가 보안 검증 (Phase 3 plan 단계에서 path allowlist) carry-over.

---

## MINOR (보고만)

### m-1 [apps/api/src/auth/routes.ts:13] 모듈 docstring `PBKDF2 600k 해시 (ADR-005 OWASP 2024)` 갱신 누락

- ADR-035 가 PBKDF2_ITERATIONS=100000 으로 갱신 후 본 줄 문서 미반영 → 신규 개발자 혼란.
- 권고: `PBKDF2 100k 해시 (ADR-005 + ADR-035 Workers 호환)` 갱신.

### m-2 [apps/api/src/__tests__/scenarios.test.ts:332] S5 it.skip — 회귀 가드 영속 X

- ADR-034 carry-over 의도는 정합하나 `it.skip` 만으로는 Phase 3 복원 시점 자동 트리거 0.
- 권고: `it.skip.skipIf(process.env.HIBP_RESTORED !== 'true')` 또는 별도 unskip TODO list 자동화 (.claude/carry-over.json).

### m-3 [apps/api/src/__tests__/helpers/d1-from-sqlite.ts:64] 마이그레이션 배열 0019 다음 0028 — 0020-0027 누락 시 silent skip

- `SCENARIO_MIGRATIONS` 가 수동 배열 → 0028 추가 시 0020-0027 누락 여부 자동 탐지 X.
- 본 commit 에서 0028 만 추가 = 0020-0027 누락 의도 (existing pattern). 그러나 향후 마이그레이션 dependency 침묵 위험.
- 권고: TD-API-001 (line 39-42 주석 명시) 즉시 처리 — `readdirSync` 자동 동기 wrapper.

### m-4 [apps/web/src/components/AuthForm.tsx:11] PUBLIC_API_BASE_URL fallback `http://localhost:8787` 하드코딩

- production 환경에서 env var 누락 시 localhost 로 fetch → 모든 요청 즉시 fail.
- 사용자에게 '네트워크 오류' 라고만 표시 → 실제 원인 진단 어려움 (console.error 만).
- 권고: production build 시점 env var 부재 → 빌드 fail (Astro vite config envPrefix 강제).

### m-5 [apps/web/src/components/AuthForm.tsx:80] console.error('auth fetch failed', err) — logForDebugging 부재

- CLAUDE.md `production-quality.md` "console.log/디버깅 console 0" 정합 위반. console.error 는 prod 보존 의도 (handoff §"console.error 는 fetch 실패 sentinel 의도") 였으나 — 본 commit 에서 신규 추가.
- 권고: 본 컴포넌트는 client-side 라 logForDebugging 인프라 미적용. 단, sentinel error 도 `[AuthForm] fetch failed` 같은 prefix + structured error code 권장.

### m-6 [migrations/0028_pbkdf2_iterations_workers_compat.sql:18-23] BEFORE INSERT 만 적용 — UPDATE 미보호

- 기존 0007 trigger 가 BEFORE INSERT 였으므로 본 마이그레이션 정합. 단, 향후 `UPDATE users SET password_iterations = ...` 경로 (Phase 3 re-hash 시) silent downgrade 위험.
- 권고: `BEFORE INSERT OR UPDATE OF password_iterations ON users` 형태 강화. Phase 3 re-hash 마이그레이션 시점 동시 처리 (ADR-035 §"복원 의무" line 50 chain).

---

## 확인 증거 (PASS 18건 카테고리별 최소 3개)

### Null/Undefined (4 확인)

- `apps/api/src/auth/routes.ts:241-276`: `row: StoredUserRow | null` 명시 + line 265 `if (row === null)` + line 278 `row.status !== 'active'` 분기 — D1 `.first()` 반환 null 가능성 완비.
- `apps/api/src/auth/routes.ts:442-445`: `userRow?.status ?? null` optional chaining + null coalescing — `/refresh` user status lookup 안전.
- `apps/api/src/study/routes.ts:414-433`: `question: ExamQuestionRow | null` + line 431 `if (question === null)` 404 처리.
- `apps/api/src/study/routes.ts:435-437`: `question.answer === null || question.answer === ''` 양쪽 가드 — answer 빈 문자열도 422.

### Async (3 확인)

- `apps/api/src/auth/routes.ts:140`: `await checkPwned(password, logger)` — fire-and-forget 0건.
- `apps/api/src/auth/routes.ts:163-179`: `withRetry(() => c.env.DB.prepare(...).run())` — Promise wrap 정합.
- `apps/api/src/study/routes.ts:362`: `for (const q of questions)` 안에서 `await enrichRelatedNodes(...)` — N+1 sequential (handoff M4 carry-over) 의식적 patterns.
- `apps/web/src/components/QuestionCard.tsx:99`: `await res.json()` 정합 + 명시적 throw catch.

### 경계값 (3 확인)

- `apps/api/src/study/routes.ts:319-326`: `Number(countRaw)` + `Number.isInteger(countNum) && countNum >= 1 && countNum <= MAX_NEXT_COUNT` — NaN/음수/0/over-cap 모두 422.
- `apps/api/src/auth/routes.ts:97`: `z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)` — DoS 방어 (PASSWORD_MAX_LENGTH=1024).
- `apps/api/src/study/routes.ts:231`: `ids.slice(0, RELATED_NODES_MAX)` — IN ... 쿼리 폭증 차단 (20개 상한).
- `apps/api/src/auth/password.ts:56-63`: `plaintext.length < PASSWORD_MIN_LENGTH` 가드 + `stored.iterations < PBKDF2_ITERATIONS` downgrade 가드.

### 에러 처리 (4 확인)

- `apps/api/src/auth/routes.ts:266-274`: dummy verify 실패 swallow 의도 명시 + `logger.warn` 영속 — silent fail 차단.
- `apps/api/src/auth/routes.ts:307-313`: `last_login_at` 업데이트 실패는 `logger.warn` 만 + 로그인 성공 진행 — Graceful Degradation 정합.
- `apps/api/src/study/routes.ts:225-228`: relatedNodes JSON parse 실패 → `logger.warn` + empty 배열 (silent fail X).
- `apps/api/src/study/routes.ts:251-254`: enrichRelatedNodes D1 실패 → `logger.error` + empty 배열 (호출 측 graceful).

### 부동소수점/숫자 정밀도 (3 확인)

- `apps/api/src/auth/password.ts:84-101`: `timingSafeEqual` XOR 누적 정합 — branch 0건.
- `apps/api/src/study/routes.ts:457-458`: `Number(existing.total_reviews ?? 0) + 1` — null coalescing + integer arithmetic.
- `apps/api/src/auth/constants.ts:23`: `PBKDF2_ITERATIONS = 100000` — Workers 상한 정합 (ADR-035).

### 타입 안전성 (4 확인)

- `apps/api/src/study/routes.ts:97-110`: `ExamQuestionRow` interface readonly 필드 + 명시 nullable.
- `apps/api/src/auth/routes.ts:106-113`: `StoredUserRow` interface — status union type ('active' | 'suspended' | 'deleted').
- `apps/api/src/study/routes.ts:219`: `const parsed: unknown = JSON.parse(...)` + `Array.isArray` 가드 → string filter — unknown 안전 narrowing.
- `apps/web/src/components/AuthForm.tsx:21-26`: `Readonly<Record<string, string>>` ERROR_MESSAGES + `AuthError` interface readonly.

### 리소스 누수 (1 확인 + 1 N/A)

- `apps/api/src/auth/hibp.ts:35-61`: `AbortController` + `clearTimeout` finally — 100% cleanup.
- N/A: 본 commit 신규 stream/reader 미사용. WebSocket / SSE 없음.

---

## Devil's Advocate (Pass 1 깨질 시나리오 — 테스트 통과 = 안전 가정 차단)

### 시나리오 1: DUMMY_HASH iterations 미스매치 회귀 (C-1 직결)

- 현재 테스트 `dummy-verify.test.ts:74-82` 가 PASS 임은 회귀 가드 작동 증명 아님 — 단순 `toContain('iterations: PBKDF2_ITERATIONS')` literal 검사일 뿐.
- 진짜 검증: `performDummyVerify('any')` 가 PBKDF2_ITERATIONS 만큼 도는지 timing 측정 + 임베드 hash bytes 가 sentinel + salt + PBKDF2_ITERATIONS 의 산출물인지 재계산 → 일치 검증. **현재 0건**.
- Phase 3 복원 시점 (PBKDF2_ITERATIONS=600000) hash bytes 재생성 망각 → 본 테스트 PASS → production 배포 → timing parity 침해 (real path 600k vs dummy path 100k stub → real 가 6배 느림 → enumeration oracle 재개) 가능성.

### 시나리오 2: HIBP 분기 disable + AuthForm hibpStatus 표시 부재 (M-2 + M-3 직결)

- production user (진산 단독) 가 평가 환경에서 weak password 등록 → 'pwned' 응답 무시 → Phase 3 launch 시점 동일 password 영속 → 외부 노출.
- Phase 3 §"복원 의무" 가 `PASSWORD_MIN_LENGTH = 8` 복원만 하고 기존 user record cleanup 절차 누락 → 진산 user 영속 weak password.
- handoff §F.4 carry-over 에 "기존 평가 user re-register 의무" 추가 필요.

### 시나리오 3: user_progress UNIQUE 미적용 + grade race (M-1 직결)

- 본 환경은 진산 단독 + 클릭 간격 충분이라 PoC 단계 무사고. 그러나 Phase 3 launch 시 다중 user 동시 grade → user_progress duplicate row → `/next` LEFT JOIN cross-product → 동일 문제 surface 2회 + correctCount 가중치 무효화.
- migration 0029 (handoff §F.4 M3+M5 carry-over) 가 Phase 3 launch 전에 적용되어야 함. 본 step 직전 처리 의무.

### 시나리오 4: SameSite=None production cookie + CSRF 위험 (ADR-036 §"근거" 인지)

- ADR-036 line 52 명시: 'None' + Secure 는 'Strict' 대비 CSRF 위험.
- 다층 방어 (Origin allowlist + httpOnly + JWT) 가 있으나, 일반 사용자 (Phase 3) 시 CSRF token 도입 검토 carry-over 필수.
- 본 step 한정 영향: 진산 단독 환경 → CSRF 시나리오 미발현. PASS.

### 시나리오 5: Cookie max-age 갱신 정책 부재 — 진산 30일 갱신 직전 silent expiry

- `setAuthCookies` (auth/routes.ts:537-550) 가 `maxAge: REFRESH_TOKEN_TTL_SECONDS` 절대값 사용. /refresh 가 rotation 시 새 cookie max-age 재설정 → ok.
- 그러나 진산이 30일간 미접속 시 silent expire → 다음 access 시 'unknown refresh' (`{reason: 'not_found'}`) → AuthForm redirect.
- 본 step 한정 사용자 UX 영향 minor. PASS.

---

## 판정

**판정: 수정 권고 (CRITICAL 1건 + MAJOR 5건)**

본 step 자체는 Phase 2 Eval MVP 평가 환경 한정으로 production traffic 0 + 진산 단독 사용 → 즉시 운영 사고 위험은 LOW. 그러나:

1. **C-1 (DUMMY_HASH 회귀 가드 침묵)**: Phase 3 launch 직전 복원 시점에 발견되면 too late. **본 step 종료 전 즉시 흡수 권고** (DUMMY_HASH 100k 재생성 + runtime 검증 테스트 추가).
2. **M-1~M-5**: handoff §F.4/§F.5 carry-over 와 chain. Phase 3 launch 1주 스프린트 묶음에 명시 의무.
3. ADR-034/035/036 carry-over chain 자체는 정합. `project_launch_legal_bundle_deferred.md` chain 동기 정합.

**4-Pass Pass 1 단독 판정**: CRITICAL 1건 즉시 흡수 후 PASS. MAJOR 5건은 Pass 2/3/4 + 5-페르소나 검증과 chain.

본 결과는 자기 채점 X — Pass 2 Architect / Pass 3 Advocate / Pass 4 Contract 가 본 보고서를 인계받아 별도 시각 점검 필요.

---

**작성**: silent-failure-hunter (Pass 1 Surgeon, 독립 에이전트)
**작성 효력**: 2026-05-11 KST (Session 066 entry verify 직후)
**다음 단계**: Pass 2 Architect (Top-Down 연계 검증) — 본 보고서 §M-1 / §M-4 cross-module 영향 재검증 의무
