---
phase: 1
step: 1-1
approved_by: Session 8 진산 "착수해" 승인 (Session 8 tech-debt 정리 완료 후 — review-20260418-162108 / 173647 / 175309)
scope:
  - docs/plans/current.plan.md
  - migrations/0006_users_and_auth.sql
  - migrations/0007_users_strict_hardening.sql (신규 — 4-Pass 리뷰 Critical 9건 정합 복원)
  - apps/api/src/db/schema.ts (users 테이블 Drizzle 선언 + name 컬럼)
  - apps/api/src/auth/constants.ts
  - apps/api/src/auth/password.ts
  - apps/api/src/auth/hibp.ts
  - apps/api/src/auth/routes.ts
  - apps/api/src/auth/types.ts
  - apps/api/src/auth/rate-limit.ts (신규 — Cloudflare Rate Limit binding)
  - apps/api/src/auth/dummy-verify.ts (신규 — timing enum 방어)
  - apps/api/src/auth/__tests__/password.test.ts
  - apps/api/src/auth/__tests__/hibp.test.ts
  - apps/api/src/auth/__tests__/rate-limit.test.ts (신규)
  - apps/api/src/middleware/cache-policy.ts
  - apps/api/src/middleware/retry.ts
  - apps/api/src/middleware/__tests__/cache-policy.test.ts
  - apps/api/src/middleware/__tests__/retry.test.ts
  - apps/api/src/index.ts (auth 라우트 + 미들웨어 등록)
  - apps/api/package.json
  - apps/api/wrangler.toml (Rate Limit binding 추가)
  - packages/shared/src/messages.ts (ADR-008 §6 Graceful Degradation 메시지)
  - packages/shared/src/index.ts (messages export)
  - docs/adr/ADR-005-authentication-pbkdf2-sha256.md (구현 정합 확인 addendum)
risk_level: L3
---

## 목적

Phase 1 Step 1-1 — 인증 기반 구축:

- PBKDF2-SHA256 password hashing (ADR-005)
- HIBP Pwned Passwords k-Anonymity 체크
- 상수시간 비교(timingSafeEqual)
- `users` 테이블 생성 + v3.0 §7.1 구독 5컬럼
- Cache-Control 헤더 강제 미들웨어 (ADR-008 §8)
- D1 재시도 미들웨어 (ADR-008 §1-2)
- Graceful Degradation 메시지 템플릿 (ADR-008 §6)

## 대상 파일

### 1. `migrations/0006_users_and_auth.sql` (신규)

- `users` 테이블 (id / email / password_hash / password_salt / password_iterations / subscription_plan / subscribed_exams JSON / subscription_started_at / subscription_expires_at / last_login_at / created_at / updated_at / status)
- email UNIQUE index
- NOT NULL 방어 트리거 (email, password_hash, password_salt, password_iterations, status, created_at, updated_at)
- email 포맷 validation 트리거 (기본 `@` 존재 확인)
- **존재 컬럼에 대해 `user_progress.user_id` FK 보강은 Year 2 이월** (ADR-007 순서 준수)

### 2. `apps/api/src/db/schema.ts`

- Drizzle `users` 테이블 선언 (0006 SQL과 1:1 대응)
- SUBSCRIPTION_PLANS union type
- `packages/shared` types 재사용 (ContentStatus 등)

### 3. `apps/api/src/auth/password.ts` (L3)

- `hashPassword(plaintext: string): Promise<HashResult>` — PBKDF2-SHA256, 310000 iterations (OWASP 2023 권고), 128-bit salt (Web Crypto)
- `verifyPassword(plaintext, stored): Promise<boolean>` — 상수시간 비교 + parameter round-trip
- `timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean` — XOR 누적 (Workers 호환)
- `@thepick/shared` AppError 사용
- any 타입 0, 하드코딩 0 (iterations는 constants/auth.ts로 분리)

### 4. `apps/api/src/auth/hibp.ts` (L3)

- `checkPwned(plaintext: string): Promise<PwnedResult>` — SHA-1 해시 앞 5자 → HIBP API `/range/{prefix}` → k-Anonymity 매칭
- 실패/네트워크 에러 시 `{ status: 'unavailable' }` 반환 (차단 아님, 관대한 실패 — Phase 1 UX)
- ADR-008 retry 정책 준용

### 5. `apps/api/src/auth/routes.ts` (L3)

- `POST /api/auth/register` — email 검증 + HIBP 체크 + PBKDF2 해시 + D1 INSERT
- `POST /api/auth/login` — email 조회 + verifyPassword + last_login_at 업데이트 (INSERT + SUPERSEDES 원칙 적용)
- `POST /api/auth/logout` — 세션 종료 (Phase 1에는 JWT 무효화만)
- Hono Zod 유효성 검증
- 503 + Retry-After (ADR-008 §5 write-path)

### 6. `apps/api/src/middleware/cache-policy.ts`

- Hono 미들웨어. Request path 기반 자동 분류 (ADR-008 §8)
- `/api/auth/*`, `/api/user/*`, `/api/progress/*`, `/api/payment/*` → `Cache-Control: private, no-store` + `Vary: Authorization, Cookie`
- `/api/content/*` → `public, max-age=300`
- `/api/search/*` → `public, max-age=60`

### 7. `apps/api/src/middleware/retry.ts`

- D1 쿼리 재시도 (ADR-008 §1): 2회, 100→400ms 백오프
- 재시도 대상: D1_ERROR 5xx/timeout/network
- 제외: D1*CONSTRAINT*_, D1*TRIGGER*_
- read-only 공용 테이블 쿼리만 KV 폴백 경로 호출 (Phase 1 Step 1-1에는 KV 쓰지 않음 — 구조만 준비)

### 8. `packages/shared/src/messages.ts`

- ADR-008 §6 메시지 템플릿 5종
- `gracefulDegradation({ reason, pageRef })` → 문구 반환
- i18n 준비 (Year 2까지는 한국어 고정, `{ko: ..., en?: ...}` 구조만)

## 위험 분석

| 위험                                           | 완화                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| PBKDF2 iterations 과다로 Workers CPU 50ms 초과 | 310000 iter Web Crypto 측정: Workers에서 ~45ms 예상. 실측 후 조정. Paid 플랜 30s에서는 여유                   |
| HIBP API 장애 → 회원가입 차단                  | `status: 'unavailable'` 반환 + 로깅. 회원가입은 계속 진행. 주기적으로 HIBP 재확인 (Phase 2 배치)              |
| email 평문 저장 (로그인용 조회)                | email은 로그인 식별자라 해시 불가. Logger는 ADR-009 `EMAIL_PATTERN` 부분 마스킹 적용                          |
| Rainbow table 공격                             | salt 128-bit + iterations 310000로 공격자 연산 비용 상한                                                      |
| timingSafeEqual 버그로 timing 누설             | XOR 누적 방식 + 길이 다를 시 즉시 false. 단, 길이 비교 자체가 timing 누설 → 내부에서 더미 XOR로 상수시간 유지 |

## 검증 계획

- [ ] migrations/0006 staging 적용 + 35 triggers + users NOT NULL 트리거 확인
- [ ] migrations/0006 production 적용
- [ ] `pnpm --filter @thepick/api typecheck` 통과
- [ ] `pnpm --filter @thepick/api test` — password.test (hash/verify/timing) + hibp.test (k-Anonymity mock) + middleware.test 통과
- [ ] `pnpm -r lint` — ESLint Rule 17 포함 통과
- [ ] Hard Rule 15/16/17 준수 확인 (examId 파라미터 경유, 시험 ID 리터럴 0건)
- [ ] 4-Pass 독립 에이전트 리뷰 (code-reviewer + system-architect + security-engineer + general-purpose)

## 롤백 전략

- 0006 실패 시: `DROP TRIGGER` + `DROP TABLE users`
- auth 라우트 배포 후 치명 이슈: `wrangler rollback` (staging) 또는 이전 deploy hash로 복원
- HIBP API 장기 장애: `checkPwned` 회귀값을 `{ status: 'skipped' }`로 변경 (환경변수 `DISABLE_HIBP=true`)

## 승인 기록

- Session 8 Step 1-0 완료 (기술 부채 정리): review-20260418-175309.md 완료 판정
- Step 1-1 착수 승인 (Session 8, 2026-04-18): 진산 "착수 해"
