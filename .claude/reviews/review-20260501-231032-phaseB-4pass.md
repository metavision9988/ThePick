# Phase B 4-Pass 독립 에이전트 리뷰 통합 인덱스

**리뷰일**: 2026-05-01 ~23:10 KST
**대상 commit**: `e5273da` — fix(security): admin-web localStorage → httpOnly cookie 전환 (Sentinel CRITICAL 흡수)
**리뷰 방식**: 독립 에이전트 4개 병렬 위임 (자가 리뷰 0건 — auto-review-protocol.md 규칙 0 준수)

---

## 1. 리뷰 구성

| Pass | 페르소나 / 에이전트               | 관점                                                         | 결과                               |
| :--: | :-------------------------------- | :----------------------------------------------------------- | :--------------------------------- |
|  1   | Surgeon (`silent-failure-hunter`) | 코드 정합성 — null/async/timing-safe/error path              | Critical 0 / Major 1 / Minor 3     |
|  2   | Architect (`backend-architect`)   | 연계 검증 — Hono router/CORS/cache-policy/Phase 2 path       | Critical 0 / Major 1 / Minor 3     |
|  3   | Advocate (`security-engineer`)    | 보안 + UX — XSS/CSRF/cookie attrs/PII/timing                 | **Critical 1** / Major 3 / Minor 4 |
|  4   | Contract (`code-reviewer`)        | 기획 대조 — handoff §2.B 13 액션 / Hard Rules / Silent Pivot | Critical 0 / Important 0 / Minor 2 |

**리뷰 범위**: 변경 파일 5건 + 연관 파일 9건 (cache-policy.ts / logger.ts / auth/routes.ts / telemetry/index.astro / write-helper.ts / types.ts / packages/shared constants/auth.ts / astro.config.mjs / index.astro)

**중복 차단**: 각 에이전트에 다른 Pass 결과 미공유 — 독립성 보장.

---

## 2. 종합 판정

| 분류                       | 건수 | 판정                                |
| :------------------------- | :--: | :---------------------------------- |
| 🔴 **CRITICAL**            | 1건  | **즉시 흡수 의무 (완료 선언 차단)** |
| 🟠 MAJOR (즉시 흡수)       | 4건  | 30분 내 흡수 가능                   |
| 🟠 MAJOR (Sprint 1 트래킹) | 1건  | 낮은 우선순위                       |
| 🟡 MINOR                   | 12건 | 보고만 (차단 아님)                  |

**완료 선언 게이트**: CRITICAL 1건 흡수 후 가능. 본 리뷰 산출물 작성 후 §4 즉시 흡수 절차 진행.

---

## 3. CRITICAL / MAJOR 상세

### 🔴 CRITICAL-3-1 — `/api/telemetry/*` cache-policy PRIVATE_PATH_PREFIXES 미등록

- **출처**: Pass 3 (Sentinel)
- **위치**: `apps/api/src/middleware/cache-policy.ts:20-28`
- **증거**: `PRIVATE_PATH_PREFIXES` 에 `/api/auth/`, `/api/progress/`, `/api/webhooks/` 만 존재. `/api/telemetry/` 누락 → `Vary: Authorization, Cookie` 헤더 미부착. 기본 floor `no-store` 만 의존.
- **위협 모델** (OWASP A01 + A04):
  1. Cloudflare CDN/Workers Cache 또는 reverse-proxy 활성화 시 동일 URL `/api/telemetry/dashboard` 가 admin_session cookie 미반영 캐싱 → 다른 admin 응답 cross-leak
  2. Year 2 multi-exam 전환 시 cross-tenant data leak 위험 (recordedAt / batch_run_id / source_id 등 시험별 운영 정보 포함)
  3. 일부 캐시는 `Vary` 부재 시 무차별 캐시 (RFC 7234 §4.1 위반 캐시 존재)
- **OWASP ASVS**: V8.3.4
- **조치**: `PRIVATE_PATH_PREFIXES` 에 `/api/telemetry/` 추가 (1줄)
- **흡수 시점**: 본 리뷰 직후 즉시

### 🟠 MAJOR-1-1 — logout 빈 catch (사용자 미통지 + 디버깅 휘발)

- **출처**: Pass 1 (Surgeon)
- **위치**: `apps/admin-web/src/components/TelemetryDashboard.tsx:342-354`
- **증거**: catch 블록이 비어있음. CORS misconfig / DNS / 5xx / SameSite-Strict cross-origin / offline 시 사용자 인지 불가 + server-side cookie 24h 잔존하나 client unauthenticated 표시 → **권한 회수가 명목상**.
- **CRITICAL RULE #3 정합**: "try-catch에서 데이터 조용히 삭제 금지 — 로깅 + 에러 전파/폴백" — 폴백은 있으나 로깅 부재.
- **조치**: `console.warn('[telemetry] logout request failed; cookie may persist on other tabs', err)` 1줄 추가
- **흡수 시점**: 본 리뷰 직후 즉시

### 🟠 MAJOR-3-1 — logger PII 키 'set-cookie' 누락 (토큰 평문 로그 유출 위험)

- **출처**: Pass 3 (Sentinel)
- **위치**: `packages/shared/src/logger.ts:51-88` `PII_KEY_NAMES`
- **증거**: `'cookie'` 는 있으나 `'set-cookie'` / `'setcookie'` 없음. `normalizeKey` 는 소문자만 (하이픈 제거 안 함). 향후 logger 가 response headers dump 시 `Set-Cookie: admin_session=<TOKEN>; HttpOnly...` 가 raw 기록 → Cloudflare Logpush → R2 → 분석 도구 흐름에서 토큰 평문 leak.
- **OWASP ASVS**: V7.1.1
- **조치**: `PII_KEY_NAMES` 에 `'set-cookie'`, `'setcookie'` 추가 + (선택) `normalizeKey` 강화
- **흡수 시점**: 본 리뷰 직후 즉시

### 🟠 MAJOR-3-2 — `parseExamIdQuery` 빈 문자열 silently bypass (Year 2 zero-cost 위협)

- **출처**: Pass 3 (Sentinel)
- **위치**: `apps/api/src/telemetry/routes.ts:218-221`
- **증거**: `value === ''` 처리가 silently `null` 반환 → `?examId=` (빈 문자열) 호출 시 WHERE exam_id 절 누락 → Year 2 multi-tenant 전환 후 attacker A 가 빈 examId 로 다른 시험 데이터 조회 가능 = Hard Rule 16 zero-cost 약속 깨짐.
- **OWASP ASVS**: V4.1.3
- **조치**: 빈 문자열 → `error: 'examId 빈 값 금지'` 422 반환
- **흡수 시점**: 본 리뷰 직후 즉시 (Year 2 안전 floor)

### 🟠 MAJOR-3-3 — `MIN_TOKEN_LENGTH=16` 클라이언트/서버 중복 선언

- **출처**: Pass 3 (Sentinel)
- **위치**: `apps/admin-web/src/components/TelemetryDashboard.tsx:26` + `apps/api/src/telemetry/admin-token.ts:24`
- **증거**: 두 파일에 각각 `16` 하드코딩. 서버 강화 (32) 시 클라이언트 drift → 16자에서 submit 활성 → 401 반복 + timing oracle 노출 가능.
- **CRITICAL RULE Hardcoding 금지 정합**.
- **조치**: `packages/shared/src/constants/auth.ts` 에 `ADMIN_MIN_TOKEN_LENGTH` 단일 export
- **흡수 시점**: 본 리뷰 직후 즉시

### 🟠 MAJOR-2-1 — cookie helper 패턴 비대칭 (Sprint 1 트래킹, 낮은 우선순위)

- **출처**: Pass 2 (Architect)
- **위치**: `apps/api/src/telemetry/admin-token.ts:104-117` (자체 빌더) vs `apps/api/src/auth/routes.ts:512-545` (hono `setCookie` helper)
- **증거**:
  - admin-token.ts 는 raw string concat
  - auth/routes.ts 는 hono `setCookie` 사용 + Path=`/api` 또는 `/api/auth` (좁음)
  - admin_session 은 `Path=/` (전체 경로) → admin-web 이 `/api/telemetry/*` 만 호출하므로 cookie scope 좁히면 인증 leak 표면 축소
- **조치 (deferred)**: Sprint 1 후속에서 hono `setCookie` 채택 + `Path=/api/telemetry` 로 좁힘
- **흡수 시점**: Sprint 1 트래킹 (Phase 2 Cloudflare Access 전환 시 모듈 통째 제거되므로 우선순위 낮음)

---

## 4. 즉시 흡수 절차 (CRITICAL 1건 + MAJOR 4건)

### 4.1 흡수 순서 + 영향 추정

|  #  | 항목         | 위치                                 |           변경 라인            |                  테스트 갱신                  |
| :-: | :----------- | :----------------------------------- | :----------------------------: | :-------------------------------------------: |
|  1  | CRITICAL-3-1 | cache-policy.ts                      |               +1               |      기존 cache-policy.test.ts 회귀 확인      |
|  2  | MAJOR-1-1    | TelemetryDashboard.tsx               |       +1 (console.warn)        |                     없음                      |
|  3  | MAJOR-3-1    | packages/shared/src/logger.ts        |              +2~3              |           logger.test.ts 회귀 확인            |
|  4  | MAJOR-3-2    | telemetry/routes.ts parseExamIdQuery |       +3 (early return)        | routes.test.ts 신규 1건 (`?examId=` 빈 → 422) |
|  5  | MAJOR-3-3    | constants/auth.ts + 2 import 갱신    | +1 line export + 2 import 변경 |                     없음                      |

### 4.2 검증 게이트

- `pnpm --filter @thepick/api test` PASS 유지 (현 257)
- `pnpm --filter @thepick/admin-web typecheck` 유지
- `pnpm --filter @thepick/shared test` PASS 유지 (현 33)
- `verify-engine-contracts.ts` PASS=4 FAIL=0 SKIP=2 유지

---

## 5. MINOR 12건 트래킹 (보고만)

|   #   | Pass | 위치                             | 내용                                                                 |
| :---: | :--: | :------------------------------- | :------------------------------------------------------------------- |
| Mn-1  |  1   | admin-token.ts:55-58             | parseCookieHeader value trailing whitespace 유지 (RFC 6265 OWS)      |
| Mn-2  |  1   | routes.ts:161-165                | cookie value=ADMIN_API_TOKEN 평문 (Phase 2 session_id 분리 권고)     |
| Mn-3  |  1   | TelemetryDashboard.tsx:334-340   | dashboard 폴링 logout race window 깜빡임 (AbortController 도입 권고) |
| Ar-m1 |  2   | TelemetryDashboard.tsx:222       | placeholder "X-Admin-Token" → "ADMIN_API_TOKEN (≥16자)" 권고         |
| Ar-m2 |  2   | routes.ts:161-165                | Set-Cookie 응답에 `Cache-Control: no-store` 명시 (defense-in-depth)  |
| Ar-m3 |  2   | routes.ts:174-177                | logout idempotent + Origin 헤더 검증 (low priority)                  |
| Sn-m1 |  3   | admin-token.ts:38                | timingSafeEqual length leak (이미 마스크 / native loop 유지 OK)      |
| Sn-m2 |  3   | TelemetryDashboard.tsx:167       | React state value 메모리 잔존 (production strip 권고)                |
| Sn-m3 |  3   | TelemetryDashboard.tsx:215       | 안내 문구 "JS 메모리 보관 안 됨" 부정확 → 수정 권고                  |
| Sn-m4 |  3   | telemetry/index.astro:5          | 스테일 주석 (localStorage 잔존)                                      |
| Co-M1 |  4   | telemetry/index.astro:5          | (Sn-m4 와 동일 — Pass 3·4 교차 발견)                                 |
| Co-M2 |  4   | admin-token.ts vs auth/routes.ts | hono setCookie helper 패턴 통합 (MAJOR-2-1 와 동일)                  |

---

## 6. handoff-028 §2.B 13 액션 항목 흡수 매트릭스 (Pass 4 종합)

|   #    | 액션                                            | 결과 | 증거                                     |
| :----: | :---------------------------------------------- | :--: | :--------------------------------------- |
| api-1  | 헤더 → cookie fallback                          |  ✅  | admin-token.ts:73-87 `extractAdminToken` |
| api-2  | POST /login + Set-Cookie 5속성                  |  ✅  | routes.ts:140-167                        |
| api-3  | POST /logout + Max-Age=0                        |  ✅  | routes.ts:175-178                        |
| api-4  | cookie 검증 미들웨어                            |  ✅  | admin-token.ts:120-126                   |
| api-5  | 테스트 4분류 (path/401 mask/timing-safe/만료)   |  ✅  | routes.test.ts +18건                     |
| web-1  | TokenForm onSubmit /login credentials:'include' |  ✅  | TelemetryDashboard.tsx:170-194           |
| web-2  | localStorage 사용 제거                          |  ✅  | grep 결과 0건                            |
| web-3  | 모든 fetch credentials:'include'                |  ✅  | dashboard/login/logout 3개 모두          |
| web-4  | logout 버튼 → POST /logout                      |  ✅  | TelemetryDashboard.tsx:336-348           |
| cors-1 | /api/telemetry/\* CORS credentials:true         |  ✅  | index.ts:67-89 buildCorsOptions 상속     |
| cors-2 | allowHeaders X-Admin-Token 유지                 |  ✅  | index.ts:89                              |

**Silent Pivot**: 0건 — 명세 100% 흡수.

---

## 7. 본 리뷰의 한계 (정직)

1. **Pass 1 / 2 는 동일 파일 검사** — 일부 발견 중복 가능. 본 인덱스에서 중복 제거 시도했으나 누락 가능성 잔존.
2. **Pass 3 의 OWASP 위협 모델은 이론적** — Cloudflare Workers/Pages 의 실제 캐시 정책 확인 0회 (production deploy 0회). CRITICAL-3-1 의 실제 위험도는 Phase 2 진입 시 production 환경 확인 후 재평가 필요.
3. **본 리뷰는 Phase B 단독** — Phase A (docs only) / Phase C (measurement) 는 4-Pass 면제 정합 (auto-review-protocol.md L1 면제).
4. **CRITICAL 1건이 production 환경 미적용 영역에서 발견** — v1.1 §10.7 #1 ("production 환경 미검증") 정합. 현 시점에서 실제 leak 가능성 0건이나 Phase 2 진입 직전 의무 흡수.

---

## 8. 다음 행동

1. **즉시**: §4.1 5개 항목 흡수 (예상 30분)
2. **검증**: §4.2 4개 게이트 통과 확인
3. **커밋**: `fix(review): Phase B 4-Pass CRITICAL/MAJOR 5건 즉시 흡수`
4. **트래킹**: MAJOR-2-1 (cookie helper 비대칭) 을 Sprint 1 backlog 에 명시
5. **Sprint 1 진입 트리거 대기** (진산님)

---

**리뷰 작성**: 4 독립 에이전트 (silent-failure-hunter / backend-architect / security-engineer / code-reviewer) + Claude Opus 4.7 종합
**리뷰 효력**: 2026-05-01 ~23:10 KST
**파일명 정합**: 메모리 `feedback_review_filename_pattern` (review-\* prefix)
