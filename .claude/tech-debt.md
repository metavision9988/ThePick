# Tech Debt Ledger

Phase/Step 리뷰에서 "수용" 판정된 Minor 항목 누적 등록.
해소 시 체크박스 + 커밋 해시 + 날짜 기록. 분기별 1회 상위 3건 해소 권장.

---

## Phase 1 Step 1-2 — Level 2 4-Phase 리뷰 (2026-04-21)

### 수정 과정에서 파생된 2건

- [ ] **TD-001** `schema.ts` ↔ `migrations/0008` UNIQUE index 이름 이원화 — 인라인 `UNIQUE (provider, event_id)` 은 SQLite autoindex 이름 사용, Drizzle `uniqueIndex('webhook_events_provider_event_id_unique')` 은 명시 이름. 수동 migration 실행에서는 무해하나 `drizzle-kit push` 도입 시 이중 인덱스 생성 가능. 해소안: migrations/0008 를 `CREATE UNIQUE INDEX webhook_events_provider_event_id_unique ON ...` 로 교체 (rollback 스크립트도 조정).
- [ ] **TD-002** 모듈 레벨 logger 의 environment 고정 — `auth/hibp.ts:22`, `auth/rate-limit.ts:22` 가 `createLogger({ service })` 만 호출 → 기본값 `'development'` 로 고정. 프로덕션 Observability 에 `environment=development` 로 찍혀 필터링 불가. 해소안: request-scoped logger 주입 패턴으로 전환 (M-5 이월 항목과 동일 작업으로 병합 가능).

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

## 처리 원칙

- 분기별 1회 (phase 종료 시점) 상위 3건 해소
- Critical/Major 로 승격되면 즉시 Step 작업 scope 에 포함
- 해소 불필요 판정 시 취소선 + 근거 기록 후 보관
