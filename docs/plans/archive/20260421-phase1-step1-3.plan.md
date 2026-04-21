---
phase: 1
step: 1-3
approved_by: Session 10 진산 "구현 착수 시작해줘" (2026-04-21 KST)
scope:
  - docs/plans/current.plan.md (본 파일 — Step 1-3 정의)
  - apps/api/src/webhooks/payment.ts (M-4 secret 길이 하한 + M-8 UNIQUE 상수 import)
  - apps/api/src/webhooks/__tests__/payment.test.ts (M-4 회귀 테스트 + M-8 간접 검증)
  - apps/api/wrangler.toml (M-4 dev 전용 mock secret placeholder 4 provider × dev env only)
  - apps/api/src/auth/hibp.ts (M-5 모듈 레벨 logger 제거 — request-scoped 파라미터 주입)
  - apps/api/src/auth/rate-limit.ts (M-5 모듈 레벨 logger 제거 — request-scoped 파라미터 주입)
  - apps/api/src/auth/routes.ts (M-5 checkPwned/checkIpRateLimit/checkEmailRateLimit 호출 측에서 logger 주입)
  - apps/api/src/auth/__tests__/hibp.test.ts (M-5 인터페이스 변경 반영)
  - apps/api/src/auth/__tests__/rate-limit.test.ts (M-5 인터페이스 변경 반영)
  - apps/api/src/middleware/retry.ts (M-8 공유 상수 export + 주석에 webhook replay 의존성 명시)
  - apps/api/src/middleware/__tests__/retry.test.ts (M-8 export 검증)
  - .claude/tech-debt.md (해소된 TD-002 체크 + 커밋 해시 기록)
risk_level: L3
---

## 목적

Phase 1 Step 1-2 에서 **Step 1-3 초기 태스크로 명시 이월된 Major 3건 해소** + Step 1-2 미완 수동 검증 확인.

Step 1-2 4-Phase 독립 리뷰 (`/.claude/reviews/review-20260421-174845.md`) 에서 발견된 총 9건 Major 중:

- scope 내 5건: Step 1-2 에서 해소 (M-1/M-2/M-6/M-7/M-9)
- scope 외 4건: Step 1-3 이월 (M-4/M-5/M-8/M-10)
- **M-10 (webhook_events TTL)**: ADR-002 addendum §6 에 Phase 3 전 결정 사항으로 이미 이월 완료 확인 → 본 Step 에서 **추가 코드 변경 없음** (ADR 교차 확인만)
- **KV 폴백 (ADR-008 §3)**: 진산님 수동 선행 (`wrangler kv:namespace create CACHE` × 2) 필요 → 별도 Step 1-4 로 분리 예정

본 Step 1-3 실제 scope: M-4, M-5, M-8 해소.

## 대상 변경 상세

### 1. M-4 — Webhook secret 길이 하한 32B + wrangler dev placeholder (L3)

**문제**: `apps/api/src/webhooks/payment.ts:263` 에서 `secret === undefined || secret.length === 0` 만 체크. 운영자가 실수로 `"test"`, `"abc123"` 같은 약한 secret 주입 시 공격자가 1-byte key 전수 조사(256회)로 valid HMAC 생성 가능. 또한 wrangler.toml 에 dev 전용 placeholder 부재로 로컬 개발 시 원인 파악에 시간 소요 (D-3-1, D-3-2).

**변경**:

- `apps/api/src/webhooks/payment.ts:262-269` 의 `getSecret` 체크를 다음 3단 검증으로 확장:
  1. `secret === undefined` → 500 `WEBHOOK_NOT_CONFIGURED` (기존)
  2. `secret.length === 0` → 500 `WEBHOOK_NOT_CONFIGURED` (기존)
  3. `secret.length < MIN_WEBHOOK_SECRET_BYTES` (32) → 500 `WEBHOOK_WEAK_SECRET` (신규, 환경 무관)
- `apps/api/wrangler.toml` `[vars]` (default dev) 에 provider 4종 mock secret placeholder 선언:
  - `WEBHOOK_HMAC_SECRET_MOCK = "dev-mock-secret-v1-do-not-use-in-production-32chars+"` (32자 이상)
  - `WEBHOOK_HMAC_SECRET_POLAR / PORTONE / TOSSPAYMENTS` 동일 패턴 (PG 별로 이름만 상이)
- staging/production 환경은 `wrangler secret put` 경유 주입 (기존 정책 유지). `[vars]` 에 올리지 않음 (secret 노출 방지).
- 테스트 추가: `returns 500 WEBHOOK_WEAK_SECRET when secret < 32 bytes` / 정상 (≥32) 은 기존 accept 경로 유지.

**Hard Limit 준수**: secret 자체 또는 길이는 로그에 절대 기록하지 않는다 (구조화 로그에 `envKey` 만 유지).

### 2. M-5 — hibp/rate-limit 모듈 레벨 logger 제거 (L3)

**문제**:

- `apps/api/src/auth/hibp.ts:22` — `const logger = createLogger({ service: 'thepick-api' }).child({ module: 'auth/hibp' })` 모듈 로드 시점에 싱글톤 생성. `environment` 미전달 → 기본값 `'development'` 로 고정. 프로덕션 배포 후 HIBP WARN 로그가 `environment: development` 로 찍혀 Cloudflare Workers Observability 에서 환경 필터링 불가.
- `apps/api/src/auth/rate-limit.ts:22` — Step 1-2 M-2 해소 과정에서 동일 패턴 도입됨. 같은 문제.

**변경** (Option: 호출 측 주입 — breaking API change 이나 scope 內 호출 측 2곳만 영향):

- `hibp.ts` 의 모듈 레벨 `logger` 제거. `checkPwned(plaintext, logger?: Logger)` 로 시그니처 확장 (optional → default 는 기존 동작 유지 위해 module-level fallback 사용). **선택 확정**: logger 필수 인자로 변경 (optional 두면 또 다른 오용 경로). 호출 측에서 request-scoped logger 주입.
- `rate-limit.ts` 동일. `checkIpRateLimit(limiter, ip, environment, logger)`, `checkEmailRateLimit(limiter, email, environment, logger)`, `checkWebhookIpRateLimit(limiter, ip, environment, logger)` 로 4번째 인자 logger 추가.
- `handleMissingBinding(kind, env, logger)` 도 logger 파라미터 수신.
- 호출 측 업데이트:
  - `routes.ts:register` 에 이미 `buildLogger(c.env).child({ route: 'register' })` 존재 → 동일 인스턴스를 `checkIpRateLimit/checkEmailRateLimit/checkPwned` 에 전달.
  - `routes.ts:login` 동일.
  - `payment.ts` webhook 라우트도 `logger` 인스턴스를 `checkWebhookIpRateLimit` 에 전달.
- 테스트 업데이트: `hibp.test.ts`, `rate-limit.test.ts` 는 mock logger 주입 (기존 console spy 제거, `expect(mockLogger.warn).toHaveBeenCalled()` 형태로 전환).

**파급 효과**:

- `@thepick/shared` logger 의 `Logger` 인터페이스 안정 (이미 export 됨).
- `rate-limit.test.ts` 의 `logger` mock 은 `{ warn: vi.fn(), error: vi.fn(), info: vi.fn(), child: vi.fn().mockReturnThis() }` 패턴.

### 3. M-8 — UNIQUE 에러 감지 공유 상수화 + 주석 명시 (L3)

**문제**:

- `apps/api/src/middleware/retry.ts:22` 의 `NON_RETRYABLE_MESSAGE_PATTERNS` 에 `/UNIQUE constraint failed/i` 포함 → withRetry 는 재시도 안 함 (설계 맞음).
- `apps/api/src/webhooks/payment.ts:317` catch 블록에서 동일 regex 를 **독립적으로** 재작성 → 두 곳이 분리되어 있어 향후 한 곳만 수정 시 silent regression (retry 가 UNIQUE 를 재시도하면 webhook replay 로직이 2회 idempotent 실패 후 503).

**변경**:

- `apps/api/src/middleware/retry.ts` 에 `export const D1_UNIQUE_CONSTRAINT_PATTERN: RegExp` export 추가 (내부 패턴을 대신 이 상수 사용).
- `NON_RETRYABLE_MESSAGE_PATTERNS` 배열에 `D1_UNIQUE_CONSTRAINT_PATTERN` 재사용.
- 해당 패턴 상수 JSDoc 에 **"webhook replay idempotency 의존성"** 명시:
  > 이 패턴을 제거하거나 NON_RETRYABLE 리스트에서 빼면 webhooks/payment.ts 의 replay 감지가 503 오판으로 회귀한다 (재시도 2회 후 503 → PG 입장에서 UNIQUE 를 못 받고 지수 백오프 폭증).
- `apps/api/src/webhooks/payment.ts:317` 에서 local regex 삭제 → `D1_UNIQUE_CONSTRAINT_PATTERN.test(err.message)` 사용.
- 테스트 추가: `retry.test.ts` 에 export 된 상수가 `UNIQUE constraint failed: ...` 패턴을 매칭하는지 단독 검증 1건.

### 4. M-10 — webhook_events `processed_at` TTL 정책 확인

**결론 (본 Step 에서 추가 작업 없음)**:

- 본 항목은 Step 1-2 4-Phase 리뷰에서 "Phase 3 연계 — Step 1-3 에서 Phase 3 scope 명시"로 분류됨.
- `docs/adr/ADR-002-payment-adapter-abstraction.md` §Addendum §6 "남은 결정 사항" 에 "timestamp-based replay window + payload raw 저장 PCI-DSS + secret 길이 하한 + wrangler placeholder" 4건으로 이미 Phase 3 전 결정 항목으로 공식 이월됨.
- 추가 조치 필요 여부: ADR-002 §6 에 TTL 항목을 명시적으로 추가하여 Phase 3 작업자 지침 강화 → 1문단 추가 (scope 내).

**변경**: `docs/adr/ADR-002-payment-adapter-abstraction.md:218-229` §6 에 TTL 항목 1건 추가 (나머지 4건 유지).

## 위험 분석

| 위험                                                                                                              | 완화                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| M-5 breaking API change — `checkPwned/checkIpRateLimit/checkEmailRateLimit/checkWebhookIpRateLimit` 시그니처 변경 | scope 내 호출 측 전체 (routes.ts, payment.ts) 를 한 커밋에 동시 갱신. 타 package 는 이 함수를 사용하지 않음 (`grep -r` 로 검증). |
| M-4 mock secret placeholder 32자 이상이 운영자 onboarding 에서 오해 유발 (진짜 secret 으로 착각)                  | wrangler.toml 주석에 `"do-not-use-in-production"` 문구 + README 에 대체 안내 (Step 1-4 로 이월 가능).                            |
| M-8 `D1_UNIQUE_CONSTRAINT_PATTERN` export 가 외부 package 에서 오용될 가능성                                      | `@thepick/api` 내부 middleware 경로 유지 — packages/\* 에서 import 되지 않도록 ESLint rule 검토 (Step 1-4 검토).                 |
| hibp.ts 모듈 레벨 logger 제거 시 다른 호출자 (향후 batch 등) 에서 logger 주입 누락                                | 현재 `checkPwned` 호출 측은 `routes.ts:register` 1곳만. logger 미주입 시 TS 컴파일 에러로 즉시 감지.                             |
| 테스트에서 mock logger 인터페이스가 `Logger` 타입과 불일치                                                        | `packages/shared/src/logger.ts` 의 `Logger` interface 를 strict 하게 구현한 mock 사용. `child()` 재귀 호출 테스트 포함.          |
| Step 1-2 미완 수동 작업 (staging migration + 로그 검증) 이 본 Step 진행 중 지연                                   | 두 작업 모두 진산님 수동. 본 Step 은 코드 레이어만. 수동 작업은 병행 가능 — Step 완료 조건에서 **제외** (ADR 에 명시 이월).      |

## 검증 계획

- [ ] `pnpm --filter @thepick/api typecheck` 0 errors
- [ ] `pnpm -r lint` 14 packages 전부 통과 (ESLint Rule 17 포함)
- [ ] `pnpm --filter @thepick/api test` — 기존 83건 유지 + 신규 3~5건 (M-4 short secret → 500 / M-5 mock logger 주입 / M-8 공유 상수 매칭)
- [ ] `pnpm --filter @thepick/api build` wrangler dry-run 통과, bindings 목록에 3종 webhook secret + rate-limit 전부 노출
- [ ] Hard Rule 15/16/17 준수 (grep 0건 재확인)
- [ ] Level 2 4-Phase 독립 에이전트 리뷰 (scope 작아 Phase A + Phase C 축약 가능, Phase D 는 M-4 공격 표면 검증에 필수)
- [ ] 재리뷰 통과 (Critical 0 / Major 0 확인)
- [ ] `.claude/tech-debt.md` TD-002 (모듈 레벨 logger) 체크박스 완료 + 커밋 해시 기록

## 롤백 전략

- M-4 short secret 거부 정책이 prod 배포 후 legitimate webhook 차단: 긴급 `wrangler secret put WEBHOOK_HMAC_SECRET_*` 재설정 (32자 이상). 이전 deploy hash 로 `wrangler rollback` 도 가능.
- M-5 logger 주입 누락으로 런타임 crash: typecheck 에서 선제 감지. 통과 후에도 누수 발견 시 단일 커밋 revert.
- M-8 공유 상수 이름 오타로 retry 동작 변경: retry.test.ts 가 회귀 감지. revert.

## 승인 기록

- Session 10 진산 "좋아 추천 순서대로 진행해줘" (2026-04-21 17:55 KST) — Step 1-2 완료 후 A 트랙 (보안 이월) 먼저 처리 권고 수락.
- 본 plan scope 내 L3 경로 수정 시 `protect-l3.sh` 훅 통과 확인.

## 범위 명시 이월 (Step 1-3 scope 외)

- **KV 폴백 구현** (ADR-008 §3): 별도 **Step 1-4** 로 분리. 선행: `wrangler kv:namespace create CACHE` × 2 (진산님 수동).
- **migrations/0008 staging remote apply**: 진산님 수동 (`wrangler d1 migrations apply DB --remote --env staging`).
- **로그 출력 수동 검증**: `pnpm --filter @thepick/api test -- --reporter=verbose` 실행 → email/signature PII 마스킹 육안 확인 (진산님).
- **timestamp-based replay window** (D-5-2): Phase 3 PG 어댑터 착수 전 ADR 결정 (ADR-002 §Addendum §6).
- **payload raw 저장 PCI-DSS 리스크** (D-4-4): Phase 3 전 ADR 결정.
- **`createWebhookRoutes` DI 패턴 리팩토링** (TD-007): Phase 2 설계 단계에서 `buildApp(deps)` 팩토리 도입 시 해소.
