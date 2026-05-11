# 5-Persona Tech Debt — Backend Architect (4/5)

## 리뷰 메타 (4-Pass 인계)

- **세션:** 066 (Phase 2 Eval MVP 종착, Session 065 누적 ~7 commits)
- **페르소나:** backend-architect (데이터·API 부채) — "2년차에 뭐가 아플까?"
- **관점:** Temporal Graph 진화, API 계약 안정성, Year 2 멀티시험 zero-cost 보장, D1 마이그레이션 chain 무결성, ADR-005 supersedes
- **4-Pass 전달 받은 중복 회피 목록:** DUMMY_HASH bytes drift, ADR-005 supersedes 본문 미반영, dummy-verify 주석 drift, 환경 변수 분기, register rate-limit, grade UPSERT TOCTOU (M-1), d1-from-sqlite 0020-0027 skip, hibpStatus 응답 노출
- **참조 4-Pass 산출물:**
  - `.claude/reviews/review-20260511-111048-phase2-eval-mvp-pass1-surgeon.md`
  - `.claude/reviews/review-20260511-111048-phase2-eval-mvp-pass2-architect.md`
  - `.claude/reviews/review-20260511-111048-phase2-eval-mvp-pass3-advocate.md`
  - `.claude/reviews/review-20260511-111048-phase2-eval-mvp-pass4-contract.md`
- **리뷰 범위 (변경 12 + 연관 N):**
  - migrations/0028_pbkdf2_iterations_workers_compat.sql ★
  - migrations/0001, 0002, 0005, 0006, 0007, 0013, 0014, 0019, 0027 (chain 정합 추적)
  - apps/api/src/db/schema.ts (Drizzle ORM)
  - apps/api/src/auth/routes.ts (register/login/logout/refresh)
  - apps/api/src/study/routes.ts (next/grade)
  - apps/api/src/**tests**/helpers/d1-from-sqlite.ts
  - docs/adr/ADR-005, ADR-007, ADR-034, ADR-035, ADR-036
  - docs/architecture/ARCHITECTURE.md (Temporal Graph 원칙)

---

## 요약

| 분류     | 본 페르소나 신규 | 비고                                                                |
| -------- | ---------------: | ------------------------------------------------------------------- |
| CRITICAL |                3 | 4-Pass M-1 / DUMMY_HASH / 0020-0027 skip 중복 0 (별도 root cause)   |
| MAJOR    |                5 |                                                                     |
| MINOR    |                4 |                                                                     |
| TOTAL    |               12 | 4-Pass 중복 지적 0건 — 본 페르소나는 **2년차 부채 전용** 관점에서만 |

**Phase 2 Eval MVP "완료" 선언 가능 여부 (backend 관점)**:

- **조건부 가능**. 평가 환경(진산 단독) 종착으로는 PASS. 그러나 **Year 2 멀티시험 전환 시 본 session 변경 3건이 zero-cost 약속을 부분 위반**한다 (B-CRIT-1, B-CRIT-2). Phase 3 launch 직전 동기 복원 chain (ADR-034/035/036) + 본 페르소나 신규 CRITICAL 3건도 묶음 처리 의무.

---

## CRITICAL (4-Pass 중복 0)

### B-CRIT-1 — user_progress UNIQUE 제약 부재 + study 라우트의 2가지 UPSERT 키 분기 = Year 2 exam_id 추가 시 데이터 중복 폭증

**증거:**

- `migrations/0002_1st_exam_extension.sql:59-78` — `user_progress` 테이블 CREATE에 PK(`id`)만 존재. **(user_id, card_id, card_type)** 도 **(user_id, node_id, card_type)** 도 UNIQUE 제약 없음.
- 이후 27건 마이그레이션 전수 grep (`grep -rn "user_progress" migrations/`) — UNIQUE INDEX 추가 0건.
- `apps/api/src/study/routes.ts:444-499` — study 라우트는 `user_id + card_id + card_type='exam' + node_id IS NULL` 키로 SELECT 후 분기 UPSERT.
- `apps/api/src/db/schema.ts:356-375` — Drizzle 선언도 PK만 존재.
- `apps/api/src/progress/*` (별도 라우트, 4-Pass 범위 외) — `user_id + node_id + card_type` 키로 별도 UPSERT.

**2년차 시나리오:**

1. **현재 (Year 1, 단일 시험):** SELECT-then-UPDATE/INSERT race window 존재 (4-Pass M-1로 이미 식별). D1 single-writer 특성으로 실측 충돌 낮으나, 동일 user의 동시 grade 호출 2건 시 row 2건 INSERT 가능 → `correct_count` 한쪽이 사라짐.
2. **Year 2 (ADR-007 §"전환 시점" 정합):** `ALTER TABLE user_progress ADD COLUMN exam_id TEXT` + `UPDATE WHERE exam_id IS NULL SET exam_id = 'son-hae-pyeong-ga-sa'`. 이 시점에 **기존 중복 row가 누적되어 있으면** UNIQUE 추가 시점에 `UNIQUE constraint failed` 폭주 → 마이그레이션 자체가 abort.
3. **Year 2 zero-cost 약속 위반:** 마이그레이션이 실패하면 **수동 dedup 스크립트 작성 + reviewer 확인 + 1차/2차 양쪽 검토** 필요. 24~48시간 추가 비용 + 마이그레이션 0029+ chain 작성.

**대응 (Phase 2 종착 직후 권고):**

- `migrations/0029_user_progress_upsert_unique.sql` 신규:
  ```sql
  -- 변형 A (study 라우트 키): (user_id, card_id, card_type) UNIQUE WHERE node_id IS NULL
  -- 변형 B (progress 라우트 키): (user_id, node_id, card_type) UNIQUE WHERE node_id IS NOT NULL
  -- SQLite Partial Index 2건으로 두 UPSERT 경로 모두 보호 가능
  CREATE UNIQUE INDEX uq_user_progress_card
    ON user_progress(user_id, card_id, card_type)
    WHERE node_id IS NULL;
  CREATE UNIQUE INDEX uq_user_progress_node
    ON user_progress(user_id, node_id, card_type)
    WHERE node_id IS NOT NULL;
  ```
- 본 인덱스가 있으면 4-Pass M-1 (UPSERT TOCTOU)도 자연 해소 (INSERT OR REPLACE 또는 ON CONFLICT 패턴 가능).
- **이미 handoff-074 §8 M3+M5에 "0029 마이그레이션" carry-over 명시됨** — 본 페르소나는 **Year 2 zero-cost 영향**으로 우선순위를 P0로 승격 권고.

**반론:** "D1 single-writer라 중복 0건"이라는 가정은 위험. Cloudflare D1 Sessions API (read replica) 도입 시 read-after-write 일관성 시간 창 발생 → UPSERT 분기 SELECT가 stale read 받을 가능성. UNIQUE 제약이 마지막 방어선이 되어야 한다.

---

### B-CRIT-2 — Year 1 한시 예외 (Hard Rule 15)에 ADR-035 trigger 변경이 무허가 추가됨 — Year 2 마이그레이션 chain rewrite 비용 증가

**증거:**

- `CLAUDE.md` Rule 15 "Year 1 한시 예외" 명시 4건: types.ts NodeType, constants 테이블 exam_id 기본값, ontology-registry.json, **그리고 "Year 2 Phase 4에 `exams/{id}/ontology.json` 분리"** — 새로운 예외 추가 시 ADR 등록 의무.
- `migrations/0028_pbkdf2_iterations_workers_compat.sql:14-23` — `enforce_users_password_iterations_min` trigger를 600k → 100k로 DROP+CREATE. 본 trigger 자체는 시험 도메인 무관(인증)이나, **0007 DROP+CREATE 패턴을 따라 idempotency가 깨졌다**.
- `migrations/0028:14` — `DROP TRIGGER IF EXISTS enforce_users_password_iterations_min;` 후 즉시 CREATE. 본 마이그레이션을 **재실행하면 trigger가 2번 DROP+CREATE** 되는데, D1 wrangler는 \_versions/_ idempotency 메타 보유라 1회 적용이나, \*\*테스트 환경 (`d1-from-sqlite.ts`)에서는 \_versions/_ 없음\*\* → 신규 마이그레이션 0029+에서 동일 trigger를 다시 변경하려 하면 0028이 두 번 실행될 위험.
- `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:44-67` — SCENARIO_MIGRATIONS는 0019에서 바로 0028로 점프 (0020-0027 skip). **trigger DROP+CREATE 순서가 production과 다르다** (production에는 0021-0024가 0028 직전 적용된 상태, 테스트에는 0019 직후 0028 적용).

**2년차 시나리오:**

1. **Year 2 마이그레이션 0029+ 작성 시점:** ADR-007 §"전환 시점" 단계 7 "CREATE TRIGGER (재생성, exam_id 포함 INSERT 검증)" — 본 시점에 0028의 `enforce_users_password_iterations_min` trigger도 **users 테이블에 exam_id 추가 시 함께 재생성 대상**. 0006 → 0007 → 0028 → 0029+ 4단계 chain rewrite 필요 = git blame 추적 비용 4배.
2. **Argon2id WASM 전환 시점 (ADR-035 §"검토 의무"):** 본 trigger 다시 DROP + (Argon2id는 iterations 개념 없음 → trigger 전면 제거 또는 `password_algorithm` 컬럼 추가) → 0028은 **단기 패치성 마이그레이션**으로 영속됨. 마이그레이션 chain 26개 중 1개가 "이미 deprecated"인 상태로 launch에 진입.

**대응:**

- `migrations/0028_pbkdf2_iterations_workers_compat.sql`에 **명시적 ROLLBACK 절차 + Phase 3 supersedes 마이그레이션 번호 예약 (예: 0030_argon2_password_migration.sql)** 주석 추가.
- 0028은 "Argon2 전환 시 deprecated" 라벨 SQL 주석에 명시 (현재는 부분 명시, line 11-12).
- 본 페르소나는 **ADR-035 §"복원 의무"에 "Year 2 exam_id ALTER 시 password trigger 재생성 패턴 명시 의무"를 추가 carry-over 권고**.

**반론:** "본 trigger는 시험 도메인 무관"이라는 가정 부분 참. 그러나 Year 2 Phase 4의 `ALTER TABLE users ADD COLUMN exam_id` 자체가 본 trigger의 `BEFORE INSERT ON users` 와 충돌 가능 (SQLite trigger 재컴파일 행위 + `enforce_users_password_iterations_not_null` 등 0006 trigger 6종 chain 영향).

---

### B-CRIT-3 — knowledge_nodes/formulas/constants Temporal Graph "UPDATE 금지" 원칙에 users 테이블 last_login_at UPDATE가 patten 위배 — Phase 3 audit trail 단절

**증거:**

- `apps/api/src/db/schema.ts:30-32` 주석: "Temporal Graph pattern: UPDATE 금지 → INSERT + SUPERSEDES edge. (**users 테이블은 예외 — last*login_at / subscription*\* 변경 빈도로 일반 UPDATE 허용**)"
- `apps/api/src/auth/routes.ts:301-313` — login 성공 시 `UPDATE users SET last_login_at = ?, updated_at = ?`.
- `apps/api/src/auth/routes.ts:307-312` — UPDATE 실패 시 **로그인은 성공 처리** + warn 로깅만. last_login_at 누락된 row 존재 가능.
- `migrations/0014_phase05_critical_hardening.sql:52` — knowledge_nodes UPDATE 차단 trigger. users는 보호 없음.
- **CLAUDE.md Hard Limit** "knowledge_nodes, formulas 테이블 UPDATE 금지" — users는 명시 안 됨.

**2년차 시나리오:**

1. **GDPR / PIPA 감사 (Phase 3 launch 직전 법무 1주 스프린트, memory `project_launch_legal_bundle_deferred.md`):** "이 user의 마지막 로그인이 언제였는지 + 과거 로그인 history 추적 가능한가?" — 현재 `last_login_at` 한 컬럼에 직접 UPDATE이라 **이전 값 영구 손실**.
2. **subscription 분쟁:** `subscription_started_at` / `subscription_expires_at` 변경 history 없음 → "내가 5월 1일 구독했는데 왜 4월 30일 expire?" 진산이 답할 수 없음.
3. **계정 탈취 사고 forensics:** "이상 IP 로그인 발생 시점" 추적 = 현재 schema로 불가. `sessions` 테이블이 일부 보완하나 revoked 후 GC되면 손실 (handoff-074 §주의사항 "TTL cron 삭제 carry-over").
4. **회원탈퇴 (memory `project_launch_legal_bundle_deferred.md`):** "회원탈퇴 시 마지막 활동 기록 보존" 의무 — 현재 schema는 status='deleted' UPDATE + last_login_at last write만 남음. 감사 trail 없음.

**대응:**

- **단기 (Phase 3 launch 1주 스프린트 내):** `user_audit_log` 테이블 신설 (append-only). last*login_at / subscription*\* / status 변경 시 INSERT.
- **장기 (Year 2):** users 테이블도 Temporal Graph 패턴 (INSERT + SUPERSEDES) 검토. 그러나 cardinality 차이 (users 1건 vs login 100건) → audit_log 패턴이 합리적.
- 본 페르소나는 **memory `project_launch_legal_bundle_deferred.md` chain에 "user_audit_log 마이그레이션 0030+ 추가" carry-over 권고**.

**반론:** "평가 환경 진산 단독이라 audit trail 불필요" 일견 맞으나, **외부 user 진입 1초 후부터 audit 손실이 누적 시작** = Phase 3 launch 직전 1주 스프린트의 마지막 24시간에 발견하면 launch 연기 불가피.

---

## MAJOR

### B-MAJ-1 — /api/study/grade 응답 shape에 correctAnswer 무조건 노출 = 향후 학습 모드 다양화 시 breaking change 위험

**증거:**

- `apps/api/src/study/routes.ts:509-516` — `GradeResultOut`이 매번 `correctAnswer`, `explanation`, `sourceCitations`, `relatedNodes` 포함 반환.
- memory `project_ux_north_star_phase3.md` "객관식 라디오 / 주관식 분류 / 학습 모드 다양화 / 보기 랜덤" — 학습 모드별 응답 정책 분기 필요 (예: "정답만 표시 / 해설 후공개 / blind mode").

**2년차 영향:** Phase 3 학습 모드 ABCD 4종 분기 시 본 응답 shape에 `mode: 'classic' | 'blind' | 'deferred-explanation'` discriminator 추가 필수 → 기존 client (apps/web QuestionCard.tsx)와 breaking. handoff-074 §6.5에 학습 모드 carry-over는 있으나 **API 응답 shape 안정성 약속 부재**.

**대응:** 본 페르소나는 **API 응답 schema에 `version: 'v1'` 필드 + Zod schema export 의무화 carry-over** 권고. apps/web과 apps/api 간 zod schema 공유 (`packages/shared/api-schemas.ts`) 도입.

**반론:** "OpenAPI/zod 분리는 over-engineering" 가능. 그러나 1차 525 학습 흐름이 production에 흐르기 시작한 시점부터 client 호환성 약속이 시작된다. Phase 3 launch 후 retroactive 도입이 더 비싸다.

---

### B-MAJ-2 — register 응답에 hibpStatus + hibpMessage 노출 = ADR-034 복원 시점에 응답 shape 변경 = client breaking

**증거:**

- `apps/api/src/auth/routes.ts:193-203` — 모든 register 성공 응답에 `hibpStatus: 'safe' | 'pwned' | 'unavailable'` 포함, `unavailable` 시 hibpMessage 추가.
- ADR-034 §"복원 의무" — Phase 3 launch 직전 `if (pwned.status === 'pwned') return 422` 분기 재활성화.
- 복원 후 응답:
  - `pwned`: 422 (기존 client 401/422 분기 무관)
  - `safe`/`unavailable`: 201 + hibpStatus 유지
- 복원 시 응답 shape 자체는 호환되나, **현재 평가 환경에서 `pwned` 통과로 201 받는 client 가정** (apps/web AuthForm.tsx)가 복원 후 422 받음 → 진산 노출 영역은 적으나 **외부 user 진입 첫 주에 confusion 가능**.

**2년차 영향:** 복원 후 user가 평가 환경에서 등록한 pwned password를 그대로 production에 가져갈 수 없음 (외부 user 새로 등록이라 무관). 그러나 **본 응답 shape이 외부 API 계약화되면** (예: 향후 mobile app 또는 admin API), hibpStatus 노출이 영구화될 위험.

**대응:**

- hibpStatus는 **server-side audit log only**로 강등 (4-Pass에서 이미 지적: hibpStatus 응답 노출). 본 페르소나는 **장기 API 계약 영구화 위험** 관점에서 우선순위 P1 승격 권고.
- 응답 body에서 hibpStatus 제거 → server-side `webhook_events` 또는 신규 `auth_audit_log` 테이블 INSERT.

**반론:** "client에 status 표시해야 UX 좋다" 일견 맞으나, **server가 client에게 '당신 password 유출됐다'고 응답으로 알려주는 것은 enumeration oracle**. HIBP k-anonymity 자체는 client-side에서도 호출 가능 (Phase 3 검토 carry-over).

---

### B-MAJ-3 — examType query parameter 분기로 인한 캐시 키 폭증 (D1 Sessions API + L1 Edge Cache 도입 시)

**증거:**

- `apps/api/src/study/routes.ts:309-317` — `examType` query 'default 1st' 갱신 (옵션 3).
- `apps/api/src/study/routes.ts:330-348` — `LEFT JOIN user_progress + ORDER BY (up.id IS NULL) DESC, COALESCE(correct_count) ASC, ...` 쿼리는 **user-specific + examType-specific** 결과.
- ADR-008 §"L1 Edge Cache" — `rocache:{exam_id}:{table}:{lookup_key}` 캐시 키 패턴은 **공용 데이터** 한정 (user_id 불포함).
- /api/study/next는 user_progress join이라 **캐시 불가** → 매 요청 D1 round-trip.

**2년차 영향:**

1. **10K user 시점:** 매 학습 클릭당 D1 쿼리 1건 + (user_progress 적재 시 enrichment 5건) → 6 queries/click. 평균 100 click/user/day × 10K user = 600만 queries/day. D1 Free tier 5M reads/day 즉시 초과.
2. **D1 Sessions API 도입 시 (cross-region read replica):** user_progress UPDATE가 primary에 가나 SELECT가 replica에 갈 수 있음 → 채점 직후 next 호출 시 **stale read** → 방금 푼 문제 다시 surface (handoff-074 §G "1차 525건 자동 채점 흐름" 정합 깨짐).

**대응:**

- 본 페르소나는 **TD-API-002 (Sessions API 적용 시 read-after-write 보장) carry-over 신규** 권고.
- Phase 3 launch 직전 또는 10K user 도달 시:
  - 옵션 A: user_progress UPSERT 후 즉시 next 호출은 primary 강제 (Sessions API session_id 명시 전달).
  - 옵션 B: client-side 캐시로 방금 푼 문제 1건 in-memory 제외 (apps/web QuestionCard.tsx).
  - 옵션 C: Durable Object로 user-specific learning state 분리 (Cloudflare 단일 벤더 정합).

**반론:** "현재 진산 단독이라 무관" 맞음. 그러나 Phase 3 launch가 1주 스프린트로 묶여 있고 D1 Sessions API 도입은 **launch 후 즉시 필요한 영역** (시험 직전 peak hour, ADR-005 §"Paid 티어에서도 동시성 주의" 참조).

---

### B-MAJ-4 — Drizzle ORM schema.ts 와 production D1 trigger 12종 + CHECK 제약 + 복합 인덱스 silent drift

**증거:**

- `apps/api/src/db/schema.ts:1-17` 주석: "drizzle-kit generate / push 사용 금지... drizzle-kit 이 schema.ts 와 실제 D1 상태를 diff 하면 이 구조들을 drop한다."
- `schema.ts:407` — `passwordIterations: integer('password_iterations').notNull()` — **0028 trigger >= 100000 제약 미반영** (주석조차 없음).
- `schema.ts:401-420` users 테이블 선언 — 0006/0007/0028 trigger 6+ 종 미반영.
- `schema.ts:198` — `examScope: text('exam_scope').default('2nd')` — Year 1 옵션 3 결정 후 default '1st'로 갱신했어야 했으나, schema.ts는 여전히 '2nd'.

**2년차 영향:**

1. **신규 개발자 onboarding:** schema.ts만 보고 코드 작성 → trigger에 의해 reject되는 INSERT 작성 → "왜 안 되지?" 디버깅 시간 누적.
2. **Year 2 마이그레이션 시:** ADR-007 §"전환 시점" 단계 7 "CREATE TRIGGER 재생성" 시 **현재 trigger 12종 + 0028 trigger 1종 = 13종 전수 재작성** 필요. schema.ts에 trigger 일람표가 없어 git blame + grep으로 매번 발견해야 함.
3. **D1 마이그레이션 0029+ 충돌:** schema.ts 동기화 망각으로 drizzle-kit 사용자 (예: 신규 admin-web 개발 시) 가 push 시도 → 12 trigger 전부 drop → production catastrophe.

**대응:**

- **schema.ts에 trigger 일람표 + 0028 추가 의무** (즉시).
- `apps/api/src/db/triggers.md` (신규 문서) — production D1에 존재하는 trigger 명세 + 마이그레이션 번호 mapping.
- 본 페르소나는 **TD-API-003 (schema.ts ↔ migrations chain index 영속) carry-over** 권고.

**반론:** "drizzle-kit 안 쓰면 무해" 맞음. 그러나 **본 schema.ts가 단일 source of truth라는 착각**이 위험. 실제 source of truth는 `migrations/*.sql` 28개 chain.

---

### B-MAJ-5 — refresh token 30일 TTL + user status 재검증은 D1 round-trip 1건 추가 = 10K user 시 자정 hours 부하 spike

**증거:**

- `apps/api/src/auth/routes.ts:437-468` — refresh 시 user.status SELECT 추가 (C-1 D-6-2 흡수).
- `migrations/0009_sessions.sql` REFRESH_TOKEN_TTL_SECONDS = 30일 (ADR-005 §Addendum).
- access TTL 1시간 + refresh 30일 = **시간당 1회 refresh + status SELECT**.

**2년차 영향:**

1. **10K active user × 1 refresh/hour = 10K queries/hour = 240K queries/day** (status SELECT 별도). 본 부하는 분산되어 spike 없을 가능성 높으나, **session 갱신은 client 시간 기준이라 시간 boundary (00:00, 01:00) spike 발생 가능** (모바일 push 알림 동기 시).
2. **D1 read 비용:** Free 5M reads/day에서 refresh status SELECT만 240K reads → 4.8% 점유. progress, study, knowledge enrichment 합산 시 Free tier 초과 임박.

**대응:**

- 본 페르소나는 **refresh 시 status SELECT를 JWT claim에 inline 저장 + suspended 시 force-revoke 경로**로 1 round-trip 절감 권고 (Phase 3 carry-over).
- 또는 sessions.revoked_at one-way 트리거가 이미 있으므로 (`schema.ts:512`), suspended 처리 시 **즉시 revokeAllUserSessions 호출 + refresh에서 status SELECT 제거** 패턴 가능.

**반론:** "보안 > 비용" 맞음. 그러나 **suspended/deleted 처리 빈도 추정 < 0.01%** vs 매 refresh마다 status SELECT 100% = trade-off 명확. revoke 채널만 정비하면 안전.

---

## MINOR

### B-MIN-1 — exam_questions.exam_type CHECK 제약 없음, schema.ts enum만 (DB 단 위반 차단 0)

`migrations/0001_initial_schema.sql:114-130` exam_questions 테이블에 `exam_type` 컬럼 자체가 없음. 후속 마이그레이션에서 ALTER ADD COLUMN으로 추가됐을 것으로 추정 (전수 grep 안 함). DB 단 CHECK 없으면 잘못된 값 INSERT 가능 → 추후 schema.ts enum 분기에서 silent drift.

**대응:** Phase 3 launch 직전 `exam_type` CHECK 제약 마이그레이션 추가 권고.

---

### B-MIN-2 — apps/api/src/study/routes.ts:240 `is_current_active = 1` 조건이 enrichRelatedNodes에 있으나 schema.ts에는 컬럼 미선언

- `study/routes.ts:239-240` 쿼리: `WHERE id IN (...) AND is_current_active = 1`.
- `schema.ts:149-211` knowledge_nodes 선언에 **is_current_active 컬럼 없음**.
- `migrations/0013_active_view_and_review_decisions.sql:29` — ALTER TABLE ADD COLUMN 추가됨.

**대응:** schema.ts에 is_current_active 컬럼 추가 (B-MAJ-4 동기).

---

### B-MIN-3 — login 응답에 user.name 누락 = 기존 register 응답과 shape 불일치

- register 응답 (line 198): `user: { id, email, name }`
- login 응답 (line 343): `user: { id, email }` — **name 누락**
- apps/web 학습 페이지 헤더에 "X님 환영합니다" 같은 UX 도입 시 추가 fetch 필요.

**대응:** login 응답에 name 추가 (SELECT 1건 컬럼 추가).

---

### B-MIN-4 — rate_limits 테이블 GC cron 없음 (schema.ts:616 주석에 carry-over로 명시되나 deadline 없음)

`schema.ts:616-630` "GC 전략(TD 이월): 24시간 이상 경과한 bucket 은 Cron Trigger 로 주기 삭제 예정." — Year 2 시점에 10K user × 1440 분 × 30일 = 432M row 누적 가능성 (전부 carry-over). 사실상 unbounded growth.

**대응:** Phase 3 launch 직전 Cron Trigger 도입 의무 carry-over.

---

## 2년차 시나리오 (가장 아플 부채 3개)

### 시나리오 1 — Year 2 멀티시험 Phase 4 마이그레이션 시 user_progress 중복 폭증 (B-CRIT-1)

**상황:** Year 2 시작, 손해평가사 단독 → 공인중개사 추가. ADR-007 §"전환 시점" 8단계 마이그레이션 0029+ 작성.

**고통점:**

1. `ALTER TABLE user_progress ADD COLUMN exam_id TEXT` 실행.
2. `UPDATE user_progress SET exam_id = 'son-hae-pyeong-ga-sa' WHERE exam_id IS NULL` 실행.
3. `CREATE UNIQUE INDEX ON user_progress(user_id, card_id, card_type, exam_id) WHERE node_id IS NULL` 실행 → **UNIQUE constraint failed: 1247건 중복**.
4. 중복 dedup 스크립트 작성 필요 — `correct_count` 합산 / `total_reviews` 합산 / 최신 row 선택 룰 정의 필요.
5. 진산 + 인간 reviewer 협의 → 24시간 추가.
6. 마이그레이션 0029 chain 재작성 → 0030, 0031로 분리.

**예방 비용:** Phase 2 종착 직후 `migrations/0029_user_progress_upsert_unique.sql` 추가 + 2 partial unique index. 본 비용 < 1시간.

---

### 시나리오 2 — Phase 3 launch 직전 1주 스프린트에서 ADR-034/035/036 + user_audit_log + UNIQUE index + Argon2 검토 동시 진행 시 backend 부하 폭증 (B-CRIT-2 + B-CRIT-3 + B-MAJ-2)

**상황:** Phase 3 launch 1주 전. memory `project_launch_legal_bundle_deferred.md` chain 발동.

**고통점:**

1. ADR-034 복원 (HIBP + PASSWORD_MIN 8) → register 응답 shape 변경 + apps/web AuthForm.tsx 갱신.
2. ADR-035 검토 (Argon2id WASM) → users.password_algorithm 컬럼 추가 + 기존 user re-hash 정책 결정 → 마이그레이션 0030.
3. ADR-036 복원 (custom domain + SameSite Strict) → cookie regeneration 비용 + 기존 active session 전체 무효화 가능성.
4. user_audit_log 마이그레이션 0031 신규 + auth/routes.ts last_login_at audit INSERT 패치.
5. UNIQUE index 마이그레이션 0029 + 중복 dedup 스크립트.
6. hibpStatus 응답 제거 → 외부 API 계약 변경 (apps/web + future mobile).

**1주 스프린트 capacity:** backend 1인 (Claude) × 7일 × 8시간 = 56시간. 위 6건 합산 추정 비용 = 70-90시간. **launch 연기 위험 高**.

**예방 비용:** 본 5-페르소나 리뷰 직후 (Phase 2 종착 직후) B-CRIT-1, B-CRIT-3, B-MAJ-2 3건을 Phase 2 종착 carry-over에 P0로 영속 (0029 + user_audit_log + hibpStatus 제거). 본 비용 < 1일.

---

### 시나리오 3 — 10K user 도달 시 D1 read quota 초과 (B-MAJ-3 + B-MAJ-5)

**상황:** Phase 3 launch + 6개월. 외부 user 10K 도달.

**고통점:**

1. /api/study/next 1 click = 6 D1 queries (LEFT JOIN + enrichment N+1, 4-Pass M2/M4 정합).
2. /api/auth/refresh 1 hour = 1 status SELECT + 1 session SELECT + 1 INSERT + 1 UPDATE.
3. 10K user × 100 click/day = 6M queries/day on /study/next alone.
4. D1 Free 5M reads/day → 즉시 초과. Paid 10M reads $5 + $1/M reads = 약 $30/month.
5. Cloudflare 단일 벤더 영속 (memory `feedback_single_vendor_cloudflare.md`) → Sessions API 도입 외 다른 path 없음.

**예방 비용:** Phase 3 carry-over로 N+1 enrichment Promise.all (handoff-074 §8 M4) + Sessions API session_id 명시 전달 패턴 정비. 본 비용 ~ 3일.

---

## Year 2 멀티시험 영향 평가

| Year 1 변경                                               | Year 2 zero-cost 약속 영향                                                                           | 회수 비용 추정 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------- |
| migrations/0028 PBKDF2 trigger 100k                       | **부분 위반** — Year 2 user 테이블 exam_id 추가 시 trigger chain 재생성. 4시간 추가.                 | 4h             |
| examType default '1st' (옵션 3, Session 065)              | **무관** — examType은 시험 내 분류 (1차/2차), 시험 간 격리와 무관.                                   | 0h             |
| user_progress UNIQUE 부재                                 | **명시 위반** — Year 2 마이그레이션 시 중복 폭증 (B-CRIT-1). 24~48시간 추가.                         | 24-48h         |
| auth/routes.ts authCookieSameSite (ADR-036)               | **무관** — cookie SameSite은 도메인/배포 패턴 영역, 시험 격리 무관.                                  | 0h             |
| schema.ts trigger drift (B-MAJ-4)                         | **부분 위반** — Year 2 trigger 재생성 시 schema.ts 동기화 망각 위험. 8시간 추가.                     | 8h             |
| ADR-034 PASSWORD_MIN 4 + HIBP 분기 disable                | **무관** — 외부 user 진입 전 복원 의무 영속.                                                         | 0h             |
| hibpStatus 응답 노출                                      | **부분 위반** — Year 2 admin API/mobile 도입 시 응답 shape 영구화 위험. 응답 schema versioning 필요. | 4h             |
| Drizzle schema.ts examScope default '2nd' (옵션 3 미반영) | **부분 위반** — Year 2 시점에 schema.ts/DB 정합 retroactive 보수.                                    | 2h             |

**총 회수 비용 (예방 미실시 시):** 42-66시간 = **Year 2 Phase 4 마이그레이션 capacity의 30~50%**.
**Hard Rule 15/16/17 위반 여부:**

- Rule 15 (범용 계층 분기 금지): 위반 0건. 본 session 변경은 모두 `apps/api/src/auth/*` 와 `apps/api/src/study/*` 시험-비격리 영역.
- Rule 16 (examId 강제): study 라우트는 examId 파라미터 수신 OK (study/routes.ts:297, :384). **그러나 user_progress UPSERT 키에 exam_id 부재 = Rule 16 본문 위반은 아니나 Year 2 zero-cost 위반** (B-CRIT-1).
- Rule 17 (EXAM_IDS 경유): 위반 0건. handoff-074 §주의사항 "Hard Rule 17 grep 0건 ✓" 영속 정합.

---

## ADR-034/035/036 long-term 데이터 영향

### ADR-034 (PASSWORD_MIN 4 + HIBP disable) — long-term 데이터 영향

- **현재 평가 환경 user 0건** (handoff-074 §주의사항 영속).
- **Phase 3 launch 직전 복원 시:** 신규 user만 영향. 기존 0건 user → 강제 password 변경 imperative 없음.
- **데이터 영구 손실 risk:** **0** — 본 ADR은 정책만 변경, 저장 데이터는 hash 형태로 안전.
- **상기 의무:** Phase 3 1주 스프린트 chain.

### ADR-035 (PBKDF2 100k) — long-term 데이터 영향

- **현재 평가 환경 user 0건** (handoff-074 §주의사항 영속).
- **Argon2id 전환 시 (Phase 3 검토 carry-over):** 기존 user re-hash 마이그레이션 정책 필요 → ADR-035 §"복원 의무" 4번에 명시됨 ("기존 평가 환경 user 일괄 re-hash"). **현재 user 0건이라 비용 0**.
- **users.password_algorithm 컬럼 신설 필요** — Year 1 시점에 영속 미진행, Year 2/Phase 3 마이그레이션 0030+에서 동시 작업 의무.
- **상기 의무:** Phase 3 1주 스프린트 + Year 2 Phase 4 마이그레이션 chain 동기.

### ADR-036 (SameSite=None production) — long-term 데이터 영향

- **데이터 영구 손실 risk:** **0**.
- **Phase 3 launch 직전 SameSite=Strict 복원 시:** 기존 active session cookie 전체 무효화 발생 가능 (브라우저 cookie key 정책 차이). 평가 환경에서 진산 1명 → 영향 0. 외부 user 진입 후에는 **현 cookie regeneration이 user 전체 logout 강제**.
- **상기 의무:** Phase 3 1주 스프린트에 SameSite 전환 시 **모든 active session revoke + 강제 재로그인 메시지** UX 정비 필요.

**3 ADR 통합 long-term 영향:** 데이터 손실 risk 0건, **그러나 ADR-035 Argon2id 전환 시 users 스키마 변경 + Year 2 멀티시험 마이그레이션 chain 동기 + B-CRIT-1 UNIQUE index 동시 작업 = 1주 스프린트 capacity 초과 위험**. 본 페르소나는 Phase 2 종착 carry-over에 **3 ADR 묶음 + B-CRIT-1/2/3 동시 영속 영역 분리 권고**.

---

## Devil's Advocate

**반론 1 — "본 페르소나가 Year 2 Phase 4를 너무 일찍 걱정한다":**

- 반박: ADR-007이 Year 1 종착 시점에 발동하는 **공식 계약**이며, Hard Rule 15/16/17은 Year 1 매일 적용 의무. Year 2를 무시한 Year 1 결정 = 본 ADR-007 자체 위반.

**반론 2 — "user_progress UNIQUE는 production에서 race 발생 안 한다":**

- 반박: 4-Pass M-1이 이미 SELECT-then-UPDATE TOCTOU으로 식별. 본 페르소나는 별도 Year 2 마이그레이션 폭증 root cause로 카테고리화. 동일 증상, 두 가지 다른 시간축의 부채 = 별도 우선순위.

**반론 3 — "hibpStatus 응답 노출은 4-Pass에서 이미 식별, 본 페르소나 중복":**

- 반박: 4-Pass는 **현재 보안 경계 위반** 관점, 본 페르소나는 **API 계약 영구화 위험** 관점. hibpStatus가 외부 client에 노출된 그 순간부터 1주일이면 mobile app 통합 시 영구 영속화 가능 (실제 mobile 계획 carry-over 부재 / Year 2 검토 영역).

**반론 4 — "Cloudflare D1 single-writer라 UNIQUE 없어도 OK":**

- 반박: D1 Sessions API (cross-region read replica) 활성화는 Phase 3 launch 직후 필수 (ADR-005 §"Paid 티어에서도 동시성 주의"). Single-writer 가정은 launch 직후 깨진다.

**반론 5 — "본 페르소나 신규 CRITICAL 3건은 Phase 3 1주 스프린트에 묶어도 충분":**

- 반박: B-CRIT-1 (UNIQUE index)은 **Phase 2 종착 직후 즉시 추가**가 1주 스프린트 부하 분산 + Year 2 마이그레이션 zero-cost 영속 양쪽 모두 만족하는 유일 path. 1주 스프린트로 미루면 시나리오 2 (1주 capacity 초과)가 현실화.

---

## 결론 — Phase 2 Eval MVP "완료" 가능 여부 (backend 관점)

| 게이트                               | 현재 상태              | 판정 |
| ------------------------------------ | ---------------------- | ---- |
| 평가 환경 진산 단독 학습 PASS        | G9 영속 (handoff-074)  | ✓    |
| 데이터 손실 risk 0건                 | 영속 정합              | ✓    |
| Year 2 zero-cost 전환 약속 100% 충족 | 부분 위반 (B-CRIT-1/2) | ✗    |
| Phase 3 1주 스프린트 capacity 영속   | 시나리오 2 위험        | ✗    |

**판정: 조건부 완료 가능.**

**조건:** Phase 2 종착 carry-over에 본 페르소나 신규 CRITICAL 3건 (B-CRIT-1/2/3) 모두 P0 영속 + handoff-075에 시나리오 1, 2, 3 명시 carry-over. **B-CRIT-1 (user_progress UNIQUE)은 Phase 2 종착 직후 즉시 마이그레이션 0029 추가 권고** (1시간 비용 vs Year 2 24-48시간 회수 절감).

---

**작성:** Claude (Opus 4.7 1M context, backend-architect persona) — Session 066
**작성 효력:** 2026-05-11 KST (Phase 2 Eval MVP 종착, 5-페르소나 4/5)
**다음 페르소나:** devops-architect (운영 부채) 5/5
