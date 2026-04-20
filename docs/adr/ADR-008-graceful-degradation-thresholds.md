# ADR-008: Graceful Degradation 정량 기준 및 폴백 정책

- **상태:** Accepted (초안) — Phase 1 Step 1-1 착수 전 수립 필수 조건
- **결정일:** 2026-04-18 (Session 8)
- **결정자:** 진산 + Claude Opus 4.7
- **관련 문서:**
  - `docs/architecture/ARCHITECTURE.md` §7 Graceful Degradation 계층별 다이어그램
  - ADR-004 (Vectorize 유사도 임계값)
  - ADR-002 (Payment Adapter idempotency 원칙)
  - 재정립서 v2.0/v3.0 Graceful Degradation Hard Rule

## 맥락 (Context)

`docs/architecture/ARCHITECTURE.md` §7이 Graceful Degradation 계층 구조를 선언했으나 정량 기준(재시도 횟수, 타임아웃, 캐시 TTL, 회로 차단기 조건 등)이 미정의 상태다. Phase 1 Step 1-1 PBKDF2 auth가 `users` 테이블 쿼리부터 L2 경로를 타므로, 구현 전에 정량 기준을 확정하지 않으면 구현자마다 임시 값이 박혀 Silent Pivot(기획 ≠ 구현) 리스크.

또한 독립 리뷰 Pass 3이 "L3 KV 폴백이 사용자별 데이터를 캐싱하면 Broken Access Control + 결제 우회 경로"를 Critical로 지적했다. ARCHITECTURE.md §7에 "user 데이터/Write-path KV 폴백 금지" Hard Limit 박스를 추가했으나, **해당 금지 조항을 구현 레벨에서 강제하는 정량 기준**이 본 ADR로 확정되어야 한다.

## 결정 (Decision)

### 1. D1 쿼리 재시도 정책

- **재시도 횟수:** 2회 (지수 백오프, 초기 100ms → 400ms)
- **타임아웃:** 단건 쿼리 1.5초, 트랜잭션 5초
- **재시도 대상 에러:** `D1_ERROR` with HTTP 5xx 또는 `timeout`, `network` 키워드 포함
- **재시도 제외:** `D1_CONSTRAINT_*` (무결성 위반), `D1_TRIGGER_*` (temporal guard 차단)
- **최종 실패 시:**
  - **read-only 공용 데이터 쿼리:** KV 폴백 시도 (§3 참조)
  - **사용자별 데이터 / Write-path:** 503 Service Unavailable + Retry-After: 5 헤더

### 2. Vectorize 쿼리 정책

- **타임아웃:** 800ms (Workers CPU 50ms 제약 고려 — Edge → Vectorize → 응답 왕복)
- **재시도:** 1회 (300ms 후)
- **유사도 임계값:** **0.60** (ADR-004 §5에서 확정)
- **실패/저유사도 폴백:** "교재 {page_ref} 페이지 참고" 메시지 (§6 메시지 템플릿)
- **Graceful Degradation 로깅:** `logger.warn('VECTOR_LOW_SIMILARITY', { score, page_ref })`

### 3. Workers KV 캐시 폴백 (read-only 공용 데이터 한정)

- **적용 대상 테이블:** `knowledge_nodes`, `knowledge_edges`, `formulas`, `constants`, `exam_questions`, `mnemonic_cards`, `topic_clusters` (ARCHITECTURE.md §7 Hard Limit 박스 참조)
- **적용 제외 (엄격 금지):** `users`, `user_progress`, `payment_events` (및 장래 추가될 사용자별 테이블 전부)
- **캐시 키 네이밍:** `rocache:{exam_id}:{table}:{lookup_key}` (공용 데이터라 user_id 불포함)
- **TTL:** 24시간
- **쓰기 시점:** L2 쿼리 성공 시 비동기 저장 (primary path 지연 영향 0)
- **읽기 시점:** L2 D1 5xx 시 즉시 폴백. 캐시 miss 시 StaticError 페이지
- **키 네이밍에 user_id 포함 금지:** 공용 데이터이므로 불필요. 사용자별 데이터는 본 정책 적용 제외이므로 user_id 포함 키 생성 자체 불가

**정답 비교 로직의 KV stale 방어 (exam_questions / formulas):**

`exam_questions`와 `formulas`는 KV 폴백 허용 테이블이지만, **사용자 답안 채점 / 산식 결과 검증 경로**에서 stale 값이 반환되면 오답 판정 오류가 발생할 수 있다 (예: 개정으로 정답이 변경된 문제). 다음 원칙을 코드 레벨에서 강제:

1. **채점/검증 경로(write 동반):** KV 폴백 **금지**. D1에서 최신 값 fetch 실패 시 503 + Retry-After 반환 (§5 write-path 정책 준용)
2. **단순 열람 경로(read-only):** KV 폴백 허용. UI에 "현재 최신 데이터 로드 지연" 배지 노출 (§6 메시지 템플릿)
3. **Revision 검증:** `exam_questions.revision_year`, `formulas.revision_year` 컬럼을 응답에 포함하고 클라이언트가 KV stale 탐지 시 교재 참조로 Graceful Degradation

**이유:** `exam_questions`가 KV 폴백 허용 테이블이라고 해서 **모든 사용 경로가 허용되는 것은 아니다**. "read-only 공용 데이터" 분류는 "응답 캐시 가능"을 의미하지 "채점 정확도를 양보해도 된다"를 의미하지 않는다.

### 4. Claude API (Haiku) 레이트리밋 정책

- **감지 시그널:** HTTP 429, `rate_limit_exceeded` 에러, `overloaded_error`
- **재시도:** 3회 (지수 백오프, 1s → 4s → 16s)
- **최종 실패 시:**
  - **Phase 1 (학습 서비스):** 사용자 대면 — "잠시 후 다시 시도해주세요" + `{page_ref}` 제시
  - **Phase 2+ (BATCH 파이프라인):** Cloudflare Queues로 작업 재등록 + 사용자 노티 발송 (관리자)

### 5. Write-path 503 + Retry-After 정책

**적용 경로:**

- `/api/auth/*` (PBKDF2 해시, 로그인, 회원가입)
- `/api/webhooks/*` (결제 PG webhook 수신)
- `/api/progress/*` (FSRS 학습 진도 기록)
- 기타 모든 POST/PUT/PATCH/DELETE 엔드포인트

**D1 Write 실패 시 동작:**

1. `logger.error('WRITE_FAILED', { path, reason })` 기록
2. 503 Service Unavailable 응답 + `Retry-After: 5` 헤더
3. **KV 폴백 시도 금지** (write-path는 idempotency 키 D1 단일 소스 원칙 — ADR-002)
4. Webhook: PG 측에 503 반환하여 **PG 자체 재시도 메커니즘에 위임**

**이유:** Write-path에서 KV 병행 저장을 허용하면 idempotency 키가 D1/KV 2곳에 있어 **"D1에는 없으나 KV에 있는" 경계 상태**가 중복 결제 허용 경로가 된다. 단일 소스(D1)를 유지하고 실패 시 재시도 요구만 반환.

### 6. 사용자 메시지 템플릿 (UX 일관성)

상황별 카피라이팅 3종 확정 (Phase 1 Step 1-1 UI 구현 시 `@thepick/shared/messages.ts`로 추출):

| 상황                    | 메시지                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 유사도 < 0.60           | "이 주제는 **교재 {page}페이지**가 더 정확합니다. AI 해설 대신 교재 원문을 권장합니다."                                |
| D1 5xx + KV hit         | "현재 일시적으로 최신 데이터 로드에 문제가 있어 최근 응답을 보여드립니다. 최신 정보는 교재 {page}페이지를 확인하세요." |
| D1 5xx + KV miss (read) | "일시적인 접속 문제로 이 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주시거나 교재 {page}페이지를 참고하세요."       |
| Write-path 503          | (503 + Retry-After: 5. 클라이언트가 자동 재시도) UI 레이어: "저장 중 문제가 발생했습니다. 5초 뒤 자동 재시도합니다."   |
| Claude API rate-limit   | "잠시 후 다시 시도해주세요. 즉시 학습을 계속하려면 교재 {page}페이지를 참고하세요."                                    |

**원칙:** "AI 오류"를 노출하지 않고 "교재가 더 정확"이라는 **신뢰 보존 메시지**로 일관화.

### 8. L1 Edge Cache (Workers Cache API) 헤더 정책

ARCHITECTURE.md §7 "KV 폴백 금지"는 L3 폴백 경로만 다룬다. L1 Edge Cache(Workers Cache API, stale-while-revalidate)에 응답 바디가 **사용자 간 오염**되지 않도록 헤더 정책을 코드 레벨에서 강제.

**사용자별 응답 엔드포인트 (강제 `private, no-store`):**

- `/api/auth/*` (로그인/회원가입/로그아웃/패스워드 변경)
- `/api/user/*` (프로필, 구독 상태, 설정)
- `/api/progress/*` (FSRS 학습 진도)
- `/api/payment/*` (결제 이력, 환불)
- 인증 헤더 (Authorization/Cookie) 포함 모든 요청

**공용 응답 엔드포인트 (허용 `public, max-age=N`):**

- `/api/content/*` (교재 텍스트, 산식, 상수) — TTL: 300s
- `/api/search/*` (RAG 검색 결과 — 메타데이터 필터 기반 결정적 응답) — TTL: 60s
- 정적 자산 (`/assets/*`) — 기존 Cloudflare Pages 정책 그대로

**구현 규약:**

- Hono 미들웨어 `cache-policy.ts`로 라우트 prefix 자동 분류 (Phase 1 Step 1-1 구현)
- 응답 생성 이후 헤더 누락 방지: 미들웨어가 **마지막 스텝**으로 `c.header('Cache-Control', ...)` 강제
- `Vary: Authorization, Cookie` 자동 주입 (사용자별 응답에 한해)

**이유:** L1 Edge Cache가 Alice의 `/api/auth/login` 응답을 캐싱한 뒤 Bob 요청에 반환하면 세션 토큰/프로필 유출(OWASP A01). `private, no-store`가 CDN/Workers Cache API의 공유 캐시 저장을 차단.

### 9. 회로 차단기 (Circuit Breaker) — Phase 2 이후

Phase 1에서는 재시도 정책으로 충분. Phase 2 이후 BATCH 파이프라인 복잡도 증가 시 다음 기준으로 도입 검토:

- **Open 조건:** 직전 60초 내 실패율 > 50% 및 요청 수 ≥ 20
- **Half-Open 재시도:** 30초 후 단건 시도
- **Close 조건:** Half-Open 재시도 3회 연속 성공

구현 라이브러리: Cloudflare Workers 호환 `@cloudflare/workers-opossum` 또는 자체 구현 (Cloudflare 단일 벤더 원칙 ADR-006 범위 내).

## 결과 (Consequences)

### 긍정적

- Phase 1 Step 1-1 착수 시 정량 기준 확정되어 구현자 판단 편차 제거
- user 데이터 / Write-path KV 폴백 금지로 Broken Access Control + 결제 우회 공격 경로 사전 차단
- 메시지 카피 3종 고정으로 UX 일관성 + 경쟁 서비스 대비 "신뢰 보존" 포지셔닝
- ADR-008 참조하는 dangling reference 해소 (ARCHITECTURE.md §7, ADR-005 등)

### 부정적

- D1 5xx + KV 폴백 미지원 테이블(users, user_progress 등) 쿼리 실패 시 **사용자 즉시 5xx 노출** — Phase 1 Step 1-1 로그인 실패 UX 보완 필요
- Circuit breaker Phase 2 이후 도입 — Phase 1 기간 대량 실패 시 재시도 폭주 가능 (Cloudflare Workers CPU 상한으로 자연 완화)

### 중립

- 메시지 템플릿은 Phase 1 구현 시점에 수험생 베타 피드백으로 재조정 가능
- KV TTL 24h는 실측 후 ADR-008 Addendum으로 조정

## 후속 조치

- [ ] Phase 1 Step 1-1 구현 시 `apps/api/src/middleware/retry.ts` 작성 (본 §1~§2 정책 구현)
- [ ] Phase 1 Step 1-1 구현 시 `apps/api/src/middleware/cache-policy.ts` 작성 (§8 Edge Cache 헤더 정책)
- [ ] `packages/shared/src/messages.ts` 신설 + §6 템플릿 구현 (Phase 1 Step 1-1)
- [ ] Webhook 503 정책 구현 (Phase 1 Step 1-2 `apps/api/src/webhooks/payment.ts`)
- [ ] Circuit breaker PoC — Phase 2 착수 시 ADR-008 Addendum으로 검토 결과 추가
- [ ] `docs/architecture/THREAT_MODEL.md`에 본 ADR 참조 추가 (T-4 Webhook Replay 관련 정책 링크)

## 참고

- ARCHITECTURE.md §7 Graceful Degradation 계층 다이어그램
- ADR-004 Vectorize 유사도 임계값 0.60
- ADR-002 Payment Adapter idempotency 원칙
- 재정립서 v2.0/v3.0 Hard Rule "Graceful Degradation" 선언
- OWASP A01 (Broken Access Control) — 본 ADR의 KV 폴백 제한이 방어 메커니즘

## 수정 이력

- 2026-04-18 (Session 8): 초안 작성 (독립 리뷰 Pass 2/3/4 Critical 해소)
- 2026-04-18 (Session 8, 2차 재리뷰 후속): §8 L1 Edge Cache 헤더 정책 추가 (Devil's Advocate L1 응답 바디 leak 공격 경로 차단)
