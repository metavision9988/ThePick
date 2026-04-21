---
phase: 1
step: 1-4
approved_by: Session 10 진산 "plan 대로 진행해" (2026-04-22 KST)
scope:
  - docs/plans/current.plan.md (본 파일 — Step 1-4 정의)
  - docs/adr/ADR-005-authentication-pbkdf2-sha256.md (§Addendum — JWT Phase 2 → Phase 1 조기 도입)
  - migrations/0009_sessions.sql (신규 — sessions 테이블 + UNIQUE + INDEX + NOT NULL/status 트리거)
  - apps/api/src/db/schema.ts (Drizzle sessions 테이블 선언)
  - packages/shared/src/constants/auth.ts (신규 — JWT/세션 상수)
  - packages/shared/src/index.ts (신규 상수 재노출)
  - apps/api/src/auth/session.ts (신규 — JWT sign/verify + refresh session CRUD + rotation + revoke)
  - apps/api/src/auth/__tests__/session.test.ts (신규)
  - apps/api/src/auth/middleware/require-auth.ts (신규 — access token 검증 미들웨어)
  - apps/api/src/auth/middleware/__tests__/require-auth.test.ts (신규)
  - apps/api/src/auth/routes.ts (기존 /login, /logout 수정 + /refresh 신설)
  - apps/api/src/auth/__tests__/routes.test.ts (기존, Set-Cookie / Clear-Cookie / refresh rotation 추가)
  - apps/api/src/index.ts (Bindings 타입에 JWT_SECRET 추가)
  - apps/api/wrangler.toml (dev JWT_SECRET placeholder + 32B 이상)
  - .claude/tech-debt.md (해소 체크 + 신규 TD 등록)
risk_level: L3
---

## 목적

Phase 1 Step 1-1 이후 `/api/auth/login` 은 사용자를 DB 검증만 수행하고 **세션 토큰을 발급하지 않는다**.
`/api/auth/logout` 은 204 stub (Step 1-2 C-Minor, CRITICAL RULE #2 경계).
결과: Phase 1 downstream (`/api/progress/*`, 구독 상태, 사용자 대면 학습 기능) 모두 blocked.

ADR-005:187 원안은 **JWT HttpOnly+Secure+SameSite=Strict 쿠키 (Phase 2)** 였으나,
실제 Phase 1 완결을 위해 **Phase 1 Step 1-4 로 조기 도입**한다. 기획 경계 이동이므로
`ADR-005 §Addendum` 에 근거 기록 (CRITICAL RULE #1 준수).

## 기술 선택 근거 (PITR 결과)

**선정: Access JWT (HS256, 15min TTL) + D1-backed Refresh Token (opaque, 30day TTL, rotation).**

비교 대상 6종 (자체 JWT 단독 / JWT+D1 refresh / D1-only opaque / CF Access / iron-session / DO) 중:

- D1-backed refresh = revocation 가능 (환불/구독 취소/기기 분실 시 즉시 세션 차단)
- Access JWT 15min = 상태 없이 매 요청 검증, D1 lookup 불필요
- Rotation = 탈취 시 무한 재발급 차단
- Cloudflare Free tier 친화적 (ADR-006 준수, D1 5M reads/day 충분)
- OAuth 2.0 표준 → 팀 온보딩 유리
- `hono/utils/jwt` 내장 사용 (외부 의존성 0)

## 대상 변경 상세

### 1. migrations/0009_sessions.sql (L3, 신규)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                      -- uuid v7
  user_id TEXT NOT NULL,                    -- FK users.id
  refresh_token_hash TEXT NOT NULL UNIQUE,  -- SHA-256(refresh_token) hex, 원본 미저장
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,                 -- created_at + 30day
  revoked_at TEXT,                          -- NULL = active
  user_agent TEXT,                          -- 감사용 (잘림: 첫 256자)
  ip_hash TEXT,                             -- SHA-256(ip + pepper) hex, PII 방어
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_active ON sessions(user_id, revoked_at, expires_at);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE revoked_at IS NULL;
```

트리거: NOT NULL 방어 (user_id/refresh_token_hash/expires_at 빈문자열 거부), revoked_at UPDATE 허용 (운영 메타).

### 2. packages/shared/src/constants/auth.ts (신규)

- `ACCESS_TOKEN_TTL_SECONDS = 900` (15min)
- `REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 3600` (30day)
- `ACCESS_TOKEN_COOKIE = 'tp_access'`
- `REFRESH_TOKEN_COOKIE = 'tp_refresh'`
- `MIN_JWT_SECRET_BYTES = 32` (HS256 key entropy 하한 — Step 1-3 M-4 동일 원칙)
- `JWT_ALG = 'HS256'`
- `REFRESH_TOKEN_BYTES = 32` (256-bit opaque)
- `JWT_CLOCK_SKEW_SECONDS = 60` (clock skew leeway)
- `USER_AGENT_MAX_LENGTH = 256`

### 3. apps/api/src/auth/session.ts (L3, 신규)

핵심 함수:

- `signAccessToken(userId, sessionId, secret)` → HS256 JWT 문자열
- `verifyAccessToken(token, secret)` → `{ sub, sid, iat, exp }` 또는 null (만료/위조 모두 null)
- `createRefreshSession(db, userId, userAgent, ipHash)` → `{ refreshToken, sessionId }`
  - crypto.getRandomValues 32B → base64url
  - SHA-256(token) → D1 INSERT
  - TTL 30day
- `verifyAndRotateRefreshSession(db, refreshToken)` → `{ sessionId, userId, newRefreshToken }` 또는 null
  - 기존 session revoked_at UPDATE (rotation)
  - 새 session INSERT
- `revokeSession(db, sessionId)` → UPDATE revoked_at
- `revokeAllUserSessions(db, userId)` → 환불/계정정지 시 사용
- `hashRefreshToken(token)` / `hashIp(ip, pepper)` 유틸

**JWT 서명/검증**: `hono/utils/jwt` 의 `sign` / `verify` 사용 (HS256). 외부 의존 없음.

### 4. apps/api/src/auth/middleware/require-auth.ts (L3, 신규)

- 쿠키 `tp_access` 읽기 → `verifyAccessToken` → `c.set('userId', ...)` / `c.set('sessionId', ...)`
- 실패 시 401 `{ error: 'UNAUTHORIZED' }` + `WWW-Authenticate: Bearer`
- ADR-008 §8 준수: 모든 인증 응답에 `Cache-Control: private, no-store`, `Vary: Cookie`

### 5. apps/api/src/auth/routes.ts 수정

- `/login` 성공 시:
  - `createRefreshSession` → cookie `tp_refresh` (HttpOnly, Secure, SameSite=Strict, Path=/api/auth, Max-Age=30day)
  - `signAccessToken` → cookie `tp_access` (동일 속성, Max-Age=15min, Path=/api)
  - response body 에 `{ ok: true, userId }`
- `/logout` (stub 해소):
  - 쿠키에서 `tp_refresh` 읽기 → `revokeSession` (best-effort, 무효 refresh 도 204)
  - `Set-Cookie: tp_access=; Max-Age=0` + `tp_refresh=; Max-Age=0`
- `/refresh` (신규):
  - `tp_refresh` 쿠키 읽기 → `verifyAndRotateRefreshSession`
  - 성공: 새 access + refresh 쿠키 재발급 (rotation)
  - 실패: 401 + 쿠키 clear

### 6. apps/api/wrangler.toml

- `[vars]` (dev): `JWT_SECRET = "dev-jwt-secret-do-not-use-in-production-32chars+"` (≥32B, mock)
- `IP_PEPPER = "dev-ip-pepper-for-sha256-ip-hashing-32bytes+"` (IP 해시용 salt)
- staging/production: `wrangler secret put` 경유 주입 (`[vars]` 에 올리지 않음)

### 7. apps/api/src/db/schema.ts + apps/api/src/index.ts

- `sessions` Drizzle 테이블 선언 (인덱스 + UNIQUE 포함, Step 1-3 M-C3 교훈)
- `Bindings` 타입에 `JWT_SECRET?: string`, `IP_PEPPER?: string` 추가

## 위험 분석

| 위험                                               | 완화                                                                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT_SECRET 유출 → 모든 기존 access token 위조 가능 | `wrangler secret put` 경유 전용. session 발급 시 `sessionId` 도 JWT payload 에 포함 → secret 교체 시 기존 access 전부 무효. Refresh 는 D1 기반이라 재로그인 없이 복구. |
| Refresh token 탈취 후 연속 사용                    | Rotation: 매 refresh 시 이전 refresh invalidate. 동일 refresh 2회 사용 감지 시 사용자 전체 세션 파기 (revokeAllUserSessions) + 경고 로그.                              |
| SameSite=Strict 가 이메일 링크에서 세션 날림       | login/auth 경로만 Strict. 추후 외부 링크 대응 필요 시 Lax 로 조정 (별도 ADR).                                                                                          |
| D1 `sessions` 테이블 무한 증가                     | Step 1-5 이후 cron `DELETE WHERE expires_at < now() OR (revoked_at IS NOT NULL AND revoked_at < now()-7day)`. 우선은 INSERT.                                           |
| 환불/구독 취소 시 세션 차단 미연동                 | `revokeAllUserSessions(userId)` 유틸 제공. Phase 3 결제 이벤트 처리기에서 호출. 본 Step 은 함수만 제공.                                                                |
| Clock skew (서버/클라이언트 시간 불일치)           | `verifyAccessToken` 에 60s leeway 허용. JWT iat/exp 에 여유 반영.                                                                                                      |
| `hono/utils/jwt` API 미지원/변경                   | Hono 4.12.14 기준 안정. 실패 시 Web Crypto 직접 구현 (fallback 코드는 작성 보류 — over-engineering).                                                                   |
| IP_PEPPER 유출 시 IP hash 역산                     | D1 dump + PEPPER 둘 다 leak 해야 위험. PEPPER 는 Cloudflare secret. PII 최소화 원칙 — IP hash 는 감사/rate-limit 보조용.                                               |
| 쿠키 SameSite=Strict + iOS PWA 호환성              | 현재 Phase 1 scope 외 (프론트엔드 미구축). Phase 2 프론트 구현 시 실측 필요.                                                                                           |

## 검증 계획

- [ ] `pnpm --filter @thepick/api typecheck` 0 errors
- [ ] `pnpm -r lint` 14 packages 전부 통과 (Hard Rule 17 포함)
- [ ] `pnpm --filter @thepick/api test` — 기존 93건 유지 + 신규 15~20건:
  - session.test: sign/verify/expired/tampered/rotation/revoke/hash 8+ 케이스
  - require-auth.test: 유효/만료/위조/미주입 4 케이스
  - routes.test: login Set-Cookie 2종 / logout Clear-Cookie / refresh rotation / refresh after revoke 401 / refresh reuse (탈취 시나리오) 전체 세션 파기
- [ ] `pnpm --filter @thepick/api build` 성공, Bindings 에 `JWT_SECRET` + `IP_PEPPER` 노출 확인
- [ ] Hard Rule 15/16/17 준수 grep 0건
- [ ] Level 2 **4-Phase 독립 에이전트 리뷰** (보안 크리티컬 → Phase A/B/C/D 전부 필수)
- [ ] 재리뷰 Critical 0 / Major 0 확인
- [ ] ADR-005 §Addendum 작성 완료
- [ ] `.claude/tech-debt.md` 갱신 (해소 항목 + 신규 등록)

## 롤백 전략

- migrations/0009 실패 시: `DROP TABLE sessions` (FK 없으므로 안전)
- JWT 키 유출 의심 시: `wrangler secret put JWT_SECRET` 재발급 → 모든 access token 즉시 무효. Refresh 는 D1 기반이라 유지되지만 access 재발급 실패 시 강제 재로그인.
- 쿠키 SameSite 정책 문제 발견 시: `routes.ts` 에서 `Strict` → `Lax` 단일 수정 후 deploy. 기존 세션 유지.

## 승인 기록

- Session 10 진산 "중요하고 급한 것 부터 순차적으로 진행" + "재평가 후보 순서대로" + "plan 대로 진행해" (2026-04-22)

## 범위 명시 이월 (Step 1-4 scope 외)

- **Step 1-5**: sessions 테이블 TTL cron 삭제 루틴 (Cloudflare Cron Trigger)
- **Step 1-5 이후**: CSRF 토큰 (double-submit 패턴)
- **Phase 2**: 프론트엔드 쿠키 처리 + PWA 오프라인 refresh 전략 + session 관리 UI
- **Phase 3+**: OAuth Social Login (Google/Kakao), 2FA
- **Phase 3 결제 연동**: 환불/구독 취소 시 `revokeAllUserSessions(userId)` 호출 지점 구현
