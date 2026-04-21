# ADR-005: 인증 비밀번호 해싱 — PBKDF2-SHA256 (WebCrypto)

- **상태:** Accepted
- **결정일:** 2026-04-14 (감사 수정 시 확정), 기록화 2026-04-18
- **결정자:** 진산 + Claude Opus 4.7 (독립 리뷰)
- **관련:** Phase 0 독립 리뷰 C-2 (Argon2 Workers 비호환)

## 맥락 (Context)

사용자 비밀번호 해싱은 서비스 보안의 최하단 방어선이다. OWASP 2024 권고 우선순위:

1. **Argon2id** (최상, 메모리 하드)
2. **scrypt**
3. **bcrypt**
4. **PBKDF2-SHA256/512**

그러나 쪽집게는 **Cloudflare Workers** 런타임에서 인증을 처리해야 하며, Workers는 다음 제약을 가진다:

- **WebCrypto API만 보장** (Node.js crypto 모듈 비표준 지원)
- **Argon2/scrypt/bcrypt**는 WASM 로드 필요 + 콜드스타트 증가
- **CPU 시간 제한** (Free 10ms, Paid 30s — 실질 부담은 작음)

초기 감사(Session 5)에서 `argon2-browser` 도입 시도 → Workers 번들 크기 증가 + 불안정 → 롤백.

## 결정 (Decision)

### PBKDF2-SHA256 (WebCrypto 네이티브) 채택

```typescript
// packages/shared/src/auth/password.ts (예시, 실제 구현은 apps/api)
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 600_000; // OWASP 2024 권고 (PBKDF2-SHA256)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256, // 32 bytes
  );
  // Format: $pbkdf2-sha256$<iterations>$<salt_b64>$<hash_b64>
  return `$pbkdf2-sha256$${iterations}$${b64(salt)}$${b64(new Uint8Array(derived))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, algo, iterStr, saltB64, hashB64] = stored.split('$');
  if (algo !== 'pbkdf2-sha256') return false;
  const iterations = Number(iterStr);
  const salt = fromB64(saltB64);
  const expected = fromB64(hashB64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      256,
    ),
  );
  return timingSafeEqual(derived, expected);
}
```

### 파라미터

- **Iterations:** 600,000 (OWASP 2024 권고 기준 PBKDF2-SHA256)
- **Salt:** 16 bytes 랜덤 (`crypto.getRandomValues`)
- **Hash length:** 32 bytes (256 bits)
- **저장 포맷:** `users` 테이블 3개 컬럼 분리 — `password_hash` (base64, 32 bytes), `password_salt` (base64, 16 bytes), `password_iterations` (integer).
  - Modular crypt format (`$pbkdf2-sha256$<iter>$<salt_b64>$<hash_b64>`) 대신 컬럼 분리 채택 (Session 8 Step 1-1 구현 시점 결정):
    1. iteration 업그레이드 추적 가시성 (SELECT password_iterations FROM users WHERE password_iterations < 600000 쿼리로 rotation 대상 즉시 파악)
    2. DB-레벨 하한 트리거 적용 가능 (`enforce_users_password_iterations_min`)
    3. Drizzle ORM 컬럼 타입 추론 용이
  - 호환성: 향후 modular crypt format 이 필요하면 view 또는 computed column 으로 파생 가능

### 비교 검증

- **반드시 timing-safe** (`timingSafeEqual` 수동 구현 — Workers `crypto.subtle.verify`는 PBKDF2 미지원)

### Timing-Safe 비교 구현 (Workers 호환)

Workers `crypto.subtle`은 PBKDF2 verify를 네이티브 지원하지 않으므로 수동 구현 필수. **조기반환 비교 금지 — 바이트별 타이밍 누출 방지:**

```typescript
/**
 * 상수시간 비교. 길이 체크는 비-상수시간이나 해시 길이는 고정(32 bytes)이므로
 * 실무상 안전. 절대로 조기반환(early return) 하지 말 것.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a[i] ^ b[i];
  }
  return r === 0;
}
```

**금지 패턴:**

- `a.every((byte, i) => byte === b[i])` — 첫 불일치에서 조기반환
- `Buffer.compare()` / `===` / `==` — 모두 조기반환

## 배포 환경 제약 (Hard Rule)

### 🔴 Cloudflare Workers Free 티어 배포 절대 금지

**근거:** 600k iterations PBKDF2-SHA256 연산은 측정 기준 200~400ms CPU 소비.

| 티어         | CPU 한도 | 로그인 가능 여부                               |
| ------------ | -------- | ---------------------------------------------- |
| Workers Free | **10ms** | ❌ 구조적 불가능 (로그인 전건 timeout 실패)    |
| Workers Paid | 30s      | ✅ 단일 로그인 여유, 그러나 동시성 주의 (아래) |

**Paid 티어에서도 동시성 주의:**

- 시험 직전 peak hour: 초당 7 req × 평균 300ms CPU = **초당 2,100ms CPU 소비**
- Workers는 isolate 병렬이 가능하나 **같은 isolate 내 큐잉 가능성** 존재
- 로그인 p95 목표 < 500ms, p99 < 1.5s — 실측 모니터링 필수

**배포 검증 체크리스트:**

- [ ] `wrangler.toml`에 Paid 플랜 확인
- [ ] 로그인 엔드포인트 CPU 사용률 Cloudflare Workers Observability + Analytics Engine 추적 (ADR-006 단일 벤더)
- [ ] 시험 직전 1주일 peak load 테스트 (Phase 3)

## 파라미터 재평가 트리거 (업그레이드됨)

기존: "사용자 10만+ 시점"만 명시 → **너무 느린 트리거**. 아래 3개 중 **하나라도** 충족 시 즉시 재평가:

| 트리거                                 | 실행 액션                                          |
| -------------------------------------- | -------------------------------------------------- |
| ① **연 1회 정기 점검 (매년 4월)**      | OWASP 최신 권고 확인, 필요 시 iterations 상향      |
| ② **DB 유출 사고 발생**                | 즉시 전 사용자 비밀번호 리셋 + iterations 2배 증가 |
| ③ **Paid CPU quota 80% 연속 7일 도달** | iterations 하향(300~400k) + Argon2 전환 검토       |
| ④ **HIBP Pwned API 차단 유입 1% 초과** | 최소 비밀번호 길이 8→10 상향                       |

### HIBP Pwned 체크 (Phase 1로 앞당김)

기존: Phase 3 → **Phase 1 필수** 로 승급. 근거:

- 신규 가입자의 70% 이상이 유출된 비밀번호 재사용 (HIBP 통계)
- PBKDF2 600k의 약점(GPU 공격)을 가장 저비용으로 보완하는 방어선
- 구현 비용 낮음 (HTTP 1회 호출, k-anonymity 방식)

## 결과 (Consequences)

### 긍정적

- Workers WebCrypto 네이티브 → 번들 크기 증가 없음, 콜드스타트 영향 0
- OWASP 2024 권고 허용 알고리즘 (비록 최상은 아니나 실무 적합)
- 해시 포맷에 iteration 포함 → 향후 파라미터 업그레이드 시 점진적 재해싱 가능
- timing-safe 비교로 타이밍 공격 방어

### 부정적

- Argon2id 대비 메모리-하드 특성 없음 → GPU/ASIC 대량 공격에 상대적으로 약함
- 완화책: **Rate limit** (IP당 로그인 시도 5회/분), **CAPTCHA** (반복 실패 시), **HIBP 차단** (Phase 1 필수)
- **Free 티어 배포 불가** (구조적 제약)

### 중립

- `crypto.subtle` API 호출 자체는 1회 약 200~400ms (600k iterations 기준)
- 서버 부하: 단일 isolate 기준 초당 수 건, 병렬 시 더 높음 (실측 필요)

## 점진적 업그레이드 경로

사용자 10만 돌파 또는 심각한 보안 사고 발생 시:

1. 신규 가입자는 Argon2id 해시 생성 (별도 알고리즘 prefix)
2. 로그인 성공 시 기존 PBKDF2 → Argon2id 자동 재해싱 (password 평문이 일시적으로 접근 가능한 순간 활용)
3. 6개월 후 PBKDF2 해시 잔존 계정은 비밀번호 리셋 이메일 발송

## 연관 보안 제어

- **Rate limit:** Cloudflare Workers에서 IP당 5회/분 로그인 실패 차단 (Phase 2)
- **JWT 토큰:** HttpOnly + Secure + SameSite=Strict 쿠키 (**Phase 1 Step 1-4 조기 도입** — §Addendum 참조)
- **2FA 옵션:** TOTP (Phase 3, 유료 사용자 한정)
- **이상 로그인 감지:** 신규 IP/국가 접근 시 이메일 알림 (Phase 3)

## 참고

- OWASP Password Storage Cheat Sheet (2024): https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- MDN Web Crypto `deriveBits`: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits
- 감사 보고서: `.claude/reviews/phase0-full-audit-20260412.md` C-2 항목

---

## Addendum — Phase 1 Step 1-4 JWT 세션 조기 도입 (2026-04-22)

### 맥락

본 ADR 본문 `§연관 보안 제어` 는 JWT 쿠키 발급을 **Phase 2** 로 명시했다. 그러나 Phase 1 Step 1-1~1-3 구현 결과:

- `/api/auth/login` 은 DB 검증만 수행하고 **세션 토큰을 발급하지 않는다**.
- `/api/auth/logout` 은 `204 stub` 상태 (Step 1-2 C-Minor, CRITICAL RULE #2 경계).
- Phase 1 downstream (`/api/progress/*`, 구독 상태, 학습 서비스 사용자 식별) 이 **모두 blocked**.

기획(Phase 2) 유지 시 Phase 1 완결 불가. CRITICAL RULE #1 "기획과 다르게 구현하려면 인간에게 먼저 보고" 경로로 진산님 승인 후 조기 도입 결정.

### 결정 — Access JWT + Refresh Token (D1-backed) 하이브리드

**기술 선택 (PITR 결과, Session 10, 2026-04-22):**

| 기준          | 채택                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- |
| Access Token  | **HS256 JWT, 15분 TTL**, `hono/utils/jwt` 사용 — stateless, D1 lookup 없음                    |
| Refresh Token | **32-byte opaque, 30일 TTL**, D1 `sessions` 테이블 — revocable                                |
| Rotation      | **매 refresh 시 이전 refresh invalidate**, 재사용 감지 시 전체 사용자 세션 파기               |
| 쿠키 속성     | `HttpOnly` + `Secure` + `SameSite=Strict` + `Path=/api` (access) / `Path=/api/auth` (refresh) |
| 저장 형태     | refresh 원본 미저장, SHA-256 해시만 D1 저장                                                   |
| IP 기록       | SHA-256(ip + pepper), 원본 IP 미저장 (PII 최소화)                                             |

### 근거

- **revocation 필수**: 환불/구독 취소/기기 분실 시 세션 즉시 차단 (D1 UPDATE `revoked_at`). 자체 HS256 JWT 단독은 블랙리스트 없이 revocation 불가.
- **성능**: access 는 stateless 검증(매 요청 D1 미접근), refresh 만 15min 에 1회 D1 접근 → 10K 유저 × 평균 1 req/min = 600 refresh/hour. D1 Free tier 5M reads/day 대비 여유.
- **업계 표준**: OAuth 2.0 Access+Refresh 패턴. 팀 온보딩/향후 Social Login 확장 용이.
- **ADR-006 단일 벤더**: Cloudflare Access (ZT) 는 Paid. Durable Objects 는 과한 복잡도. `hono/utils/jwt` + D1 로 Free tier 구현 가능.

### 쿠키 정책 상세

| 쿠키 이름    | 속성                              | TTL   | Path        |
| ------------ | --------------------------------- | ----- | ----------- |
| `tp_access`  | HttpOnly, Secure, SameSite=Strict | 15min | `/api`      |
| `tp_refresh` | HttpOnly, Secure, SameSite=Strict | 30day | `/api/auth` |

- `Path=/api/auth` 로 refresh 를 auth 경로로 제한 → XSS/CSRF 시 유출 표면 축소.
- `SameSite=Strict` 이므로 외부 사이트 링크 클릭 시 세션 날아갈 수 있음. 이메일 인증 링크는 별도 토큰 경로 사용 (Phase 3 구현 시 고려).

### 거부된 대안

- **Option A (자체 HS256 단독)**: revocation 불가 → 구독/결제 비즈니스 부적합.
- **Option C (D1-only opaque)**: 매 요청 D1 lookup → 10K 유저 × 10 req/min = 6M reads/day → Free tier 초과.
- **Option D (Cloudflare Access)**: Paid + 한국어 UX 제한 + 결제 흐름과 통합 복잡도.
- **Option E (iron-session 스타일 encrypted cookie)**: revocation 불가 + 4KB 쿠키 제한.
- **Option F (Durable Objects)**: Paid + 과한 복잡도.

### 보안 제약

1. `JWT_SECRET` 은 `wrangler secret put` 경유만 주입. 32-byte 이상 (Step 1-3 M-4 동일 원칙).
2. `IP_PEPPER` 도 `wrangler secret` 전용. IP hash 가 D1 덤프만으로는 역산 불가하도록 방어.
3. JWT payload 에 `sid` (session_id) 포함 → secret 교체 시 즉시 모든 access 무효 + refresh 기반 재발급 가능.
4. Refresh rotation: 매 refresh 시 이전 token invalidate + 새 refresh 발급. 동일 refresh 2회 사용 감지 (DB 에 `revoked_at` 있는데 또 요청) → **해당 user 전체 세션 파기** + 보안 경고 로그.
5. `sessions` 테이블에 `ON DELETE CASCADE` (`users` FK) → 계정 삭제 시 세션 자동 정리.

### 남은 결정 (Phase 2+ 확정)

- **CSRF 토큰**: `SameSite=Strict` + double-submit 패턴 병행 여부 (Phase 2 프론트 구현 시).
- **Refresh reuse detection 반응**: 전체 세션 파기 외 이메일 알림/2FA 강제 등.
- **세션 관리 UI**: 사용자가 활성 세션 확인/개별 로그아웃 (Phase 2).
- **Social Login (Google/Kakao)**: Phase 3+, 별도 ADR.
- **2FA (TOTP)**: Phase 3+, 유료 사용자 한정.

### 구현 참조

- Sessions 테이블: `migrations/0009_sessions.sql`
- Drizzle schema: `apps/api/src/db/schema.ts` §12
- JWT sign/verify + refresh CRUD: `apps/api/src/auth/session.ts`
- 미들웨어: `apps/api/src/auth/middleware/require-auth.ts`
- 라우트: `apps/api/src/auth/routes.ts` (`/login`, `/logout`, `/refresh`)
- 상수: `packages/shared/src/constants/auth.ts`
- wrangler: `JWT_SECRET` + `IP_PEPPER` (dev placeholder, staging/prod `wrangler secret put`)

## 수정 이력

- 2026-04-14: Session 5 감사 수정 시 비공식 확정 (Argon2 → PBKDF2)
- 2026-04-18: ADR 정식 기록화
- 2026-04-18 (Session 8 Step 1-1 구현 정합): 저장 포맷을 modular crypt format 단일 문자열에서 **3개 컬럼 분리** (`password_hash` / `password_salt` / `password_iterations`) 로 정식 채택. iterations 업그레이드 추적 가시성 + DB 트리거 방어선 연동 근거.
- 2026-04-18 (Session 8 4-Pass 리뷰 C-6 해소): 구현이 ADR 본문과 정합 복원. `apps/api/src/auth/constants.ts` `PBKDF2_ITERATIONS = 600000`, `migrations/0007_users_strict_hardening.sql` 트리거 하한 600000 상향.
- 2026-04-22 (Session 10 Step 1-4): §Addendum 추가 — JWT 쿠키 Phase 2 → Phase 1 조기 도입. Access JWT (HS256 15min) + D1 Refresh Token (30day rotation). 근거: Phase 1 downstream blocked 해소, OAuth 2.0 표준.
