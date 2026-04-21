# Tech Debt Ledger

Phase/Step 리뷰에서 "수용" 판정된 Minor 항목 누적 등록.
해소 시 체크박스 + 커밋 해시 + 날짜 기록. 분기별 1회 상위 3건 해소 권장.

---

## Phase 1 Step 1-2 — Level 2 4-Phase 리뷰 (2026-04-21)

### 수정 과정에서 파생된 2건

- [ ] **TD-001** `schema.ts` ↔ `migrations/0008` UNIQUE index 이름 이원화 — 인라인 `UNIQUE (provider, event_id)` 은 SQLite autoindex 이름 사용, Drizzle `uniqueIndex('webhook_events_provider_event_id_unique')` 은 명시 이름. 수동 migration 실행에서는 무해하나 `drizzle-kit push` 도입 시 이중 인덱스 생성 가능. 해소안: migrations/0008 를 `CREATE UNIQUE INDEX webhook_events_provider_event_id_unique ON ...` 로 교체 (rollback 스크립트도 조정).
- [x] **TD-002** 모듈 레벨 logger 의 environment 고정 — ~~`auth/hibp.ts:22`, `auth/rate-limit.ts:22` 가 `createLogger({ service })` 만 호출 → 기본값 `'development'` 로 고정~~. ✅ **해소 — Step 1-3 M-5 (2026-04-21)**: 모듈 레벨 logger 제거, `checkPwned/checkIpRateLimit/checkEmailRateLimit/checkWebhookIpRateLimit` 시그니처에 `logger: Logger` 필수 인자 추가. 호출 측(`routes.ts`, `payment.ts`)에서 request-scoped logger 주입. 커밋 해시는 Step 1-3 본 커밋 기록 후 업데이트.

### Level 2 리뷰에서 Minor 판정 12건

- [ ] **TD-003** `schema.ts:3` 주석 "10 tables" → "11 tables" (C-3 수정 시 함께 갱신됨 — 이미 반영됨, 확인 후 삭제).
- [ ] **TD-004** `KNOWN_ENVIRONMENTS` / `resolveLoggerEnv` 3중 복제 (`index.ts:19-30`, `auth/routes.ts:51-68`, `webhooks/payment.ts:56-87`). 해소안: `packages/shared/src/logger.ts` 에 `resolveLoggerEnv` 유틸 export.
- [ ] **TD-005** `Bindings`(index.ts) 와 `WebhookBindings`(payment.ts) 타입 readonly 속성 불일치 — Hono 상위 버전에서 타입 호환성 경고 가능. 해소안: `Bindings` 모든 필드 readonly 추가.
- [ ] **TD-006** `payment.test.ts` FakeDb 의 `UNIQUE constraint failed` 메시지에 `D1_ERROR:` prefix 누락. 실제 D1 포맷과 일부 불일치. 해소안: test fixture 메시지 포맷 통일.
- [ ] **TD-007** `createWebhookRoutes()` / `createAuthRoutes()` 의 DI 가 테스트 전용 — 프로덕션 경로에서 정책 주입 불가. 10K 유저 관측·복구 요건 대비 설계 리팩토링 필요. 해소안: `buildApp(deps: AppDeps)` 팩토리 도입.
- [ ] **TD-008** FK PRAGMA 전역 미들웨어 — 모든 요청 (헬스체크 포함) 에 D1 prepared API 호출 (`DB.exec('PRAGMA foreign_keys = ON')`). 해소안: DB 의존 라우트에만 스코프 한정 또는 Drizzle client 생성 시 1회만 설정.
- [ ] **TD-009** `dummy-verify.test.ts` timing 테스트 (`elapsed > 10ms`) — 고성능 CI 에서 flaky 위험. 해소안: 하한을 1ms 로 낮추거나 PBKDF2 호출 횟수 증가 assertion 으로 전환.
- [ ] **TD-010** `auth/routes.ts:269-273` `logout` 라우트 stub 주석 표현 "Phase 1 Step 1-1: idempotent stub" — 규칙 경계 혼동. 해소안: "Phase 2 JWT 도입 후 확장 예정" 으로 주석 변경.
- [ ] **TD-011** `Retry-After` 값 불일치 (auth 5 vs webhook 30) — ADR-008 본문과 다름. 해소안: ADR-008 에 webhook 전용 값 명시 또는 통일.
- [ ] **TD-012** `migrations/0008` `event_id` 컬럼에 SQL 레벨 CHECK 제약 없음 — 앱 레벨 128자 제한이 유일 방어. 해소안: `CHECK (length(event_id) <= 128)` 추가 (마이그레이션 0009 형태).
- [ ] **TD-013** Rate limiter namespace 교체 (1001→2001/3001) 배포 시 카운터 reset 으로 일시적 공격 창 확장 — plan 에 기록됨 (수용). 해소안: 불필요 (의도된 동작).
- [ ] **TD-014** `withRetry` 지수 백오프 jitter 부재 — D1 장애 탐지 사이드채널 제공 가능. 해소안: `retry.ts sleep(backoff)` 에 +/-20% jitter 추가.
- [ ] **TD-015** webhook `status='received'` 직접 `failed` 전이 허용 — plan §6 문구 "received to processing to processed/failed" 와 엄밀히 다름. 해소안: 트리거 주석 추가 또는 plan 문구 조정.

---

## Phase 1 Step 1-3 — Level 2 축약 리뷰 (2026-04-21)

### Phase D 에서 Major 1건 이월

- [ ] **TD-016** Logger 회귀 방지 ESLint rule 부재 (Phase D D-7-4) — `auth/hibp.ts`, `auth/rate-limit.ts` 에 모듈 레벨 `createLogger(...)` 재도입 시 TS 컴파일 통과 + 테스트 통과로 silent regression 가능. M-5 주석/문서 + 코드리뷰 의존만 있음. 해소안: `.eslintrc` 에 `no-restricted-syntax` rule 추가하여 `Program > VariableDeclaration > VariableDeclarator[init.callee.name='createLogger']` 를 특정 파일에서 차단 (routes.ts/payment.ts/index.ts 의 `buildLogger` 내부는 allowlist). Phase 2 초기 태스크로 이월 (Step 1-3 plan 검증 후 확정).

### Phase D Minor 1건

- [ ] **TD-017** wrangler.toml secret 운영 정책 문서 승격 (Phase D D-8) — 현재 plan.md 에만 "staging/prod 는 `wrangler secret put` 경유" 기재. Phase 2 에 `docs/security/webhook-secret-policy.md` 로 승격하여 팀 온보딩 문서화.

### Phase C Minor 1건 (남은 오기 정정)

- [ ] **TD-018** ADR-002 §Addendum §6 "나머지 4건 유지" 표현 정합성 (Phase C P-2) — Step 1-3 에서 2건은 해소 표시(`~~취소선~~`)로 갱신, 1건 신규 추가. plan §4 "나머지 4건 유지" 표현과 완전 일치하지 않음 (기록성 문제, 기능 회귀 없음). Phase 2 정기 ADR 감사에서 정정.

---

## Phase 1 Step 1-4 — Level 2 4-Phase 리뷰 (2026-04-22)

### Scope 내 해소 (Critical 4 + Major 4)

- ✅ **Critical 해소됨 (2026-04-22, 본 Step 커밋)**:
  - C-1 (D-6-2) BAN 우회 — `/refresh` user status 재검증 추가 + revokeAllUserSessions 통합
  - C-2 (D-5-1 / B-2) Reuse detection 오탐 — `REFRESH_ROTATION_GRACE_SECONDS = 60` grace window 도입, `rotated_recently` reason 추가
  - C-3 (A-2) NaN expires_at 영구 유효 통과 — `!Number.isFinite || expiresAt <= now` fail-safe
  - C-4 (B-5 / B-1) Drizzle drift — inline UNIQUE → 명시 `CREATE UNIQUE INDEX` + Drizzle partial index `.where(sql\`revoked_at IS NULL\`)` 추가
- ✅ **Major 해소됨**:
  - A-4 signAccessToken 빈 userId/sessionId fail-fast (`SIGN_EMPTY_USER_ID` / `SIGN_EMPTY_SESSION_ID`)
  - A-1 / C-M1 `routes.ts:350` 무의미한 삼항식 제거
  - D-7-1 IP_PEPPER 미설정 silent → `logger.warn` 추가 (login/refresh 양쪽)
  - B-2 `revokeAllUserSessions` 실패 → `withRetry` 래핑 (재시도 2회)

### Step 1-5+ 이월 신규 등록

- [ ] **TD-019** 사용자당 활성 세션 상한 부재 (Phase D D-1-1) — `MAX_ACTIVE_SESSIONS_PER_USER` 미정의. 공격자가 동일 user 로 login 반복 시 sessions 테이블 무한 증가. 해소안: login 시점 `COUNT(*) WHERE user_id = ? AND revoked_at IS NULL` 체크 + 상한 초과 시 가장 오래된 세션 revoke. Phase 2.
- [ ] **TD-020** `decodeAccessTokenUnsafe` 프로덕션 미사용 dead code (Phase D D-4-4) — session.ts:144-151. 감사용으로 선언됐으나 호출처 없음. 해소안: `@deprecated` 태그 + 다음 Phase 에 삭제 or 실제 감사 로그에서 사용.
- [ ] **TD-021** JWT_SECRET 운영 중 rotation 절차 문서 부재 (Phase D D-7-2) — 유출 시 전체 sessions 강제 revoke 필요하나 `DELETE FROM sessions` 운영 도구 없음. 해소안: `docs/security/jwt-rotation.md` 작성 + `wrangler d1 execute` 수동 절차.
- [ ] **TD-022** `sessions.last_used_at` UPDATE 경로 부재 (Phase B B-3) — 스키마/트리거는 있으나 코드에서 UPDATE 안 함. Phase 2 세션 관리 UI 구현 시 "마지막 사용 X분 전" 표시 전 활성화 필요.
- [ ] **TD-023** `RequireAuthEnv.Bindings` / `index.ts Bindings` / `AuthBindings` 3중 선언 (Phase B B-1) — Step 1-3 TD-004 (KNOWN_ENVIRONMENTS 3중 복제) 유사 패턴. 해소안: 공통 `ApiBindings` 타입 정의하여 interface merging.
- [ ] **TD-024** `hono/utils/jwt/jwt` 내부 경로 의존 (Phase A #5) — Hono 4.x minor 업그레이드 시 경로 변경 가능. 해소안: `package.json` 에서 `hono` 버전 exact pin (예: `4.12.12`) 또는 공개 `hono/jwt` 미들웨어 검토. 현재는 runtime 동작 정상.
- [ ] **TD-025** Access JWT revoke 지연 창 최대 15분 (Phase B B-3 이월) — JWT stateless 검증 특성상 revokeSession 후 access token 은 exp + leeway (60s) 까지 유효. 환불/계정 정지 시 최대 16분 창. 완화안: require-auth 에 선택적 D1 session existence 체크 (민감 write-path 라우트만) or access TTL 단축 (5min).
- [ ] **TD-026** `session.ts verifyAndRotateRefreshSession` 명세 함수 미구현 (Phase C m-2) — plan.md:93/118 명시 함수가 `session.ts` 에 없음. routes.ts 에 inline rotation. 해소안: session.ts 에 orchestration 함수 추가 (향후 OAuth 엔드포인트에서 재사용).
- [ ] **TD-027** `cache-policy.ts` 주석 vs `index.ts` 등록 순서 설명 모순 (Phase C m-4) — cache-policy.ts:36-37 "마지막 미들웨어" 설명 vs index.ts:39 "첫 번째" 등록. 실제 동작은 올바름 (after-next 패턴). 주석 명료화 필요.

---

## 처리 원칙

- 분기별 1회 (phase 종료 시점) 상위 3건 해소
- Critical/Major 로 승격되면 즉시 Step 작업 scope 에 포함
- 해소 불필요 판정 시 취소선 + 근거 기록 후 보관
