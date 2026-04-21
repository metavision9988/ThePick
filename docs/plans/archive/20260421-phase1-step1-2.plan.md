---
phase: 1
step: 1-2
approved_by: Session 9 진산 "중요하고 급한거 부터" + "내가 직접하는 거 빼고 다 해줘" 승인 (2026-04-20)
scope:
  - docs/plans/current.plan.md
  - apps/api/src/auth/routes.ts (M-logger 해소 — console.* → @thepick/shared logger + maskEmail 임시 제거)
  - apps/api/src/auth/hibp.ts (M-logger 해소 — console.warn/error → logger)
  - apps/api/src/auth/dummy-verify.ts (M-dummy-hash — all-zero DUMMY_HASH → 실제 PBKDF2 600k 산출물)
  - apps/api/src/auth/__tests__/dummy-verify.test.ts (신규 — 구조/포맷 검증)
  - apps/api/wrangler.toml (M-rate-limit-namespace — 환경별 분리 dev 1001/1002, staging 2001/2002, prod 3001/3002)
  - apps/api/src/webhooks/payment.ts (신규 — Replay/Idempotency + 서명 검증 + ADR-002/008)
  - apps/api/src/webhooks/__tests__/payment.test.ts (신규)
  - migrations/0008_webhook_events.sql (신규 — webhook_events 멱등성 저장 테이블)
  - apps/api/src/db/schema.ts (webhook_events Drizzle 선언)
  - apps/api/src/index.ts (webhooks 라우트 등록)
  - packages/shared/src/index.ts (필요 시 logger child 재노출)
  - docs/adr/ADR-002-payment-adapter-abstraction.md (webhook 구현 정합 addendum)
risk_level: L3
---

## 목적

Phase 1 Step 1-2 — 결제/인증 기반 확장 + 이월 Major 4건 해소:

1. **이월 Major 4건** (Step 1-1 2차 리뷰에서 Step 1-2 초기 태스크로 명시 이월됨)
   - M-logger: `console.*` 4건을 `@thepick/shared` logger로 교체, 임시 `maskEmail()` 제거 (ADR-009 §후속조치 체크박스 해소)
   - M-dummy-hash: `DUMMY_HASH` all-zero → 실제 PBKDF2 산출물 (통계 공격 경로 차단)
   - M-rate-limit-namespace: 환경별 namespace_id 분리 (staging 트래픽 prod 카운터 오염 방지)
   - M-KV-env: wrangler.toml staging/production KV binding 선언 — **진산님 수동 `wrangler kv:namespace create CACHE` 선행 필요**, 본 Step 1-2 scope 외 처리

2. **Webhook Replay/Idempotency 구현** (ADR-002 §결제 어댑터 + ADR-008 §5 write-path 503)
   - `apps/api/src/webhooks/payment.ts` — `POST /api/webhooks/payment` 엔드포인트
   - Idempotency Key: PG 제공 event_id 또는 요청 헤더 `Idempotency-Key` → D1 UNIQUE 저장
   - 서명 검증: HMAC-SHA256 (Web Crypto + timing-safe compare) — timingSafeEqual 재사용
   - Replay 방어: 기존 event_id 수신 시 200 OK + idempotent 응답 (중복 처리 차단)
   - Write-path 503 + Retry-After (ADR-008 §5)
   - Graceful Degradation 메시지 (ADR-008 §6)

3. **선행 완료 필요** (본 scope 외, 진산님 수동):
   - KV namespace 2개 발급 (staging/production)
   - staging 배포 후 PBKDF2 600k CPU 실측 (Free 50ms vs Paid 30s)

## 대상 파일 상세

### 1. `apps/api/src/auth/routes.ts` (L3) — M-logger

- `console.error/warn` 4건을 `logger.error/warn`으로 교체
- `maskEmail()` 임시 함수 제거 → `@thepick/shared` logger의 `PII_KEYS` 자동 마스킹 활용
- request-scoped child logger 주입 (request_id / IP)

### 2. `apps/api/src/auth/hibp.ts` (L3) — M-logger

- `console.error/warn` → `logger.error/warn`
- 네트워크 실패 시 `{ level: 'warn', event: 'hibp_unavailable', cause }` 구조화 로깅

### 3. `apps/api/src/auth/dummy-verify.ts` (L3) — M-dummy-hash

- 현재: `DUMMY_HASH = new Uint8Array(32)` (all-zero)
- 변경: 빌드 타임 또는 모듈 초기화 시 1회 `await hashPassword('<deterministic-sentinel>')` 산출물을 저장
- 구조: `{ salt (16 byte), hash (32 byte), iterations: 600000 }` — 실제 사용자 hash와 통계적으로 구분 불가
- 보안: sentinel 평문은 실제 계정에 사용될 수 없도록 고정값 + `\x00` null byte 삽입 (email 파서가 거부하는 형식)

### 4. `apps/api/wrangler.toml` (L3) — M-rate-limit-namespace

- 현재: 모든 env가 `namespace_id = "1001"` / `"1002"` 공유
- 변경:
  - `default` (dev local): 1001 / 1002 유지
  - `env.staging`: 2001 / 2002
  - `env.production`: 3001 / 3002
- staging 자동화 테스트가 production rate limit 카운터를 오염시키지 않도록 격리

### 5. `apps/api/src/webhooks/payment.ts` (L3, 신규)

- `POST /api/webhooks/payment` — Hono 라우트
- 요청 처리 순서:
  1. 서명 검증 (HMAC-SHA256) — 실패 시 401, timing-safe
  2. 서명 실패 후에도 body 파싱 (timing attack 완화)
  3. Zod 스키마 검증 — 실패 시 400
  4. Idempotency key 추출 (body.event_id → 없으면 header `Idempotency-Key`) — 없으면 400
  5. D1 `webhook_events` INSERT (UNIQUE key) — D1_CONSTRAINT_UNIQUE 시 200 OK + replayed: true
  6. 실제 비즈니스 처리 (Phase 1 Step 1-2에서는 `packages/payment` mock adapter 호출 → ADR-002)
  7. 성공 시 `processed_at` UPDATE (SUPERSEDES 원칙과 무관 — 운영 메타)
- 에러 처리:
  - D1 일시 장애: 2회 재시도 → 503 + `Retry-After: 30` (ADR-008 §5)
  - 업스트림 adapter 장애: 5xx + Graceful Degradation 메시지

### 6. `migrations/0008_webhook_events.sql` (신규)

```sql
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,                  -- uuid v7
  provider TEXT NOT NULL,               -- 'mock' | 'toss' | 'portone' 등 (ADR-002 adapter name)
  event_id TEXT NOT NULL,               -- provider 제공 고유 id (Idempotency key)
  event_type TEXT NOT NULL,             -- 'payment.approved' | 'payment.failed' 등
  payload TEXT NOT NULL,                -- 원본 JSON (TEXT column, D1 JSON1 호환)
  signature TEXT,                       -- HMAC-SHA256 hex (로깅/감사용, verify 후 저장)
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'received',   -- received | processing | processed | failed
  error_message TEXT,
  UNIQUE (provider, event_id)           -- Idempotency 핵심
);

CREATE INDEX idx_webhook_events_status ON webhook_events(status, received_at);
CREATE INDEX idx_webhook_events_provider ON webhook_events(provider, received_at);
```

NOT NULL 방어 트리거 (provider/event_id/event_type/payload/received_at/status) + UPDATE 시 status 전이 검증 트리거 (received → processing → processed/failed).

### 7. `apps/api/src/db/schema.ts` (L3)

- Drizzle `webhookEvents` 테이블 선언 (0008 SQL과 1:1 대응)
- 기존 users 테이블 선언 유지

## 위험 분석

| 위험                                                          | 완화                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| logger 마이그레이션 중 PII 유출                               | ADR-009 PII_KEYS 33종 자동 마스킹, maskEmail 제거 후 즉시 `pnpm test` 로 로그 출력 검증     |
| DUMMY_HASH 교체 시 기존 테스트 깨짐                           | dummy-verify.test.ts 신규로 "구조만 검증" (값 일치 X) + timing 차이 <10% 유지               |
| webhook_events Idempotency 경쟁 (동일 event_id 동시 POST)     | D1 UNIQUE 제약 = 원자성 보장, INSERT 실패 시 SELECT로 상태 반환                             |
| 서명 검증 전 body 파싱 = DoS 벡터                             | Cloudflare Workers 기본 1MB body limit + Zod maxSize 검증 + 서명 실패 로깅                  |
| rate-limit namespace 변경이 기존 staging 트래픽 카운터 초기화 | 의도된 동작 (격리가 목적). 배포 전 진산님 공지                                              |
| Replay 공격 (유효한 event_id 재전송)                          | UNIQUE 제약이 방어. 서명만으로 방어하면 PG 측 버그로 동일 event_id 재발송 시 중복 처리 가능 |
| 본 Step 1-2에 KV 폴백 미구현 → ADR-008 §3 미충족              | Step 1-2 scope 외 명시 (KV namespace 선행 필요). Step 1-3에서 구현                          |

## 검증 계획

- [x] `pnpm --filter @thepick/api typecheck` — 0 errors (2026-04-21)
- [x] `pnpm -r lint` — 14 packages 전부 통과
- [x] `pnpm --filter @thepick/api test` — **7 files / 83 tests 전부 통과**
      (신규 3건 추가: multibyte payload 413 / per-IP rate-limit 429 / dummy-verify timing regression)
- [x] `pnpm --filter @thepick/api build` — 219KB / gzip 44KB, `WEBHOOK_RATE_LIMITER_IP` 바인딩 확인
- [x] Hard Rule 15/16/17 준수 — grep 0건 확인 (Phase C 리뷰)
- [x] Level 2 4-Phase 독립 에이전트 리뷰 (code-reviewer × 2 + system-architect + security-engineer) — 병렬 실행 완료
- [x] Critical 3건 (C-1 rate-limit / C-2 byte size guard / C-3 Drizzle uniqueIndex) **수정 + 재리뷰 통과**
- [x] scope 내 Major 5건 (M-1 ADR-002 addendum / M-2 rate-limit logger / M-6 RAW_DUMP payload / M-7 defense-in-depth / M-9 dummy-verify try-catch) **수정 + 재리뷰 통과**
- [x] ADR-002 addendum 추가 — §Addendum Phase 1 Step 1-2 Webhook Receiver (webhook_events vs payment_events 분리, Phase 3 전환 계약, Silent Pivot §5 Step 2 근거, 남은 결정 4건)
- [ ] migrations/0008 staging remote apply — **Step 1-3에 수동 진행** (진산님 직접)
- [ ] 로그 출력 수동 검증 (`test -- --reporter=verbose` → PII 마스킹 확인) — Step 1-3에 진산님 확인

## Silent Pivot 공식 해소 (Phase C M-3)

- plan §5 Step 2 "서명 실패 후에도 body 파싱 (timing attack 완화)" 요구사항 → **ADR-002 addendum §5로 대체됨**
- 결론: `verifySignature` 자체가 full HMAC 계산 + timing-safe dummy compare 를 수행하므로 추가 body 파싱 불필요. body 파싱의 variable-time 특성(Zod/JSON.parse)이 오히려 timing side-channel 을 확장할 수 있음.
- Phase 2 PG 현장 테스트에서 경계 재검토.

## Step 1-3 이월 (명시)

4-Phase 리뷰에서 발견한 나머지 Major 4건은 Step 1-3 초기 태스크로 이월:

- **M-4** (D-3-1/D-3-2): webhook secret 길이 하한 32바이트 검증 + wrangler.toml `[vars]`에 dev 전용 mock secret placeholder 선언
- **M-5** (A-M5/B-4-m2): `auth/hibp.ts` + `auth/rate-limit.ts` 모듈 레벨 logger의 environment 고정 문제 — request-scoped logger 주입 패턴으로 리팩토링
- **M-8** (A-M1/D-2-1): UNIQUE 에러 감지 메시지 의존성 — `retry.ts` `NON_RETRYABLE_MESSAGE_PATTERNS` 의존성 주석 + 공유 상수화
- **M-10** (B-3-M1): `webhook_events.processed_at` 영원히 NULL 청소 전략 — TTL 컬럼 추가 or Phase 3 일정 공식 이월

## Minor 14건 기술부채 등록

`.claude/tech-debt.md`에 등록 (별도 파일 신설).

## 롤백 전략

- 0008 실패 시: `DROP TABLE webhook_events`
- webhook 라우트 배포 후 치명 이슈: `wrangler rollback` (staging) 또는 이전 deploy hash로 복원
- logger 마이그레이션 regression: 단일 커밋으로 분리하여 revert 용이
- DUMMY_HASH 교체 후 login timing 분포 이상: 이전 all-zero로 revert 후 재분석

## 승인 기록

- Session 9 진산 "중요하고 급한거 부터 우선 처리를 해줘" + "내가 직접하는 거 빼고 다 해줘" (2026-04-20)
- Step 1-1 2차 축약 리뷰 `review-20260418-201954.md` — 이월 Major 4건 Step 1-2 초기 태스크로 명시
- 본 plan scope 내 L3 경로 수정 시 protect-l3.sh 통과
