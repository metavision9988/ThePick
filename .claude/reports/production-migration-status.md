# thepick-db-production D1 Migration Status

> **목적**: production D1 마이그레이션 적용 증거 영속 (handoff-074 §"수정된 파일" + Session 066 C-14).
> **근거**: Session 067 C-14 흡수 (handoff-075 §"다음 할 일" §2)
> **확인 명령**: `wrangler d1 migrations list thepick-db-production --remote --env=production`

---

## 적용 일자

- **Session 067 C-14 영속 시점**: 2026-05-12 KST (0029)
- **Session 069 Phase 3 launch 직전 Step 1 적용 시점**: 2026-05-12 KST (0030 + 0031, login_history audit trail)
- **Session 069 Step 3-UX-4 적용 시점**: 2026-05-12 KST (0032 ~ 0035, Phase 3 학습 UX 스키마)
- **wrangler 토큰**: `claude-code-thepick` (User API Token, 2026-05-10 발급)
- **확인 출력**: `✅ No migrations to apply!` (Session 069 0032~0035 적용 후 재확인)

---

## 적용된 마이그레이션 (0001 ~ 0035, 35개 chain)

| 번호 | 파일                                      | 상태 | 비고                                                                                              |
| ---- | ----------------------------------------- | ---- | ------------------------------------------------------------------------------------------------- |
| 0001 | initial_schema.sql                        | ✅   | 1차 base schema                                                                                   |
| 0002 | 1st_exam_extension.sql                    | ✅   | user_progress 신규                                                                                |
| 0003 | temporal_guard_not_null.sql               | ✅   |                                                                                                   |
| 0004 | temporal_guard_extension.sql              | ✅   |                                                                                                   |
| 0005 | not_null_triggers_completion.sql          | ✅   |                                                                                                   |
| 0006 | users_and_auth.sql                        | ✅   | auth 도입                                                                                         |
| 0007 | users_strict_hardening.sql                | ✅   | PBKDF2 trigger 도입 (ADR-005 600k → ADR-035 100k 갱신)                                            |
| 0008 | webhook_events.sql                        | ✅   |                                                                                                   |
| 0009 | sessions.sql                              | ✅   |                                                                                                   |
| 0010 | status_transitions_and_page_ref_guard.sql | ✅   |                                                                                                   |
| 0011 | revision_2026_constants_seed.sql          | ✅   |                                                                                                   |
| 0012 | rate_limits.sql                           | ✅   |                                                                                                   |
| 0013 | active_view_and_review_decisions.sql      | ✅   |                                                                                                   |
| 0014 | phase05_critical_hardening.sql            | ✅   |                                                                                                   |
| 0015 | batch_runs.sql                            | ✅   |                                                                                                   |
| 0016 | knowledge_nodes_batch_idempotency.sql     | ✅   |                                                                                                   |
| 0017 | engine_telemetry.sql                      | ✅   |                                                                                                   |
| 0018 | enforce_draft_only_insert.sql             | ✅   |                                                                                                   |
| 0019 | knowledge_nodes_page_chapter_meta.sql     | ✅   |                                                                                                   |
| 0020 | ~ 0027                                    | ✅   | Pattern-H + review_queue 누적 (8건)                                                               |
| 0028 | pbkdf2_iterations_workers_compat.sql      | ✅   | ★ ADR-035 — trigger 100k 갱신 (Session 065 적용)                                                  |
| 0029 | user_progress_unique_constraint.sql       | ✅   | ★★ Session 067 신규 적용 (C-06 흡수) — 5 commands / 1.04ms                                        |
| 0030 | login_history.sql                         | ✅   | ★★ Session 069 신규 적용 (Phase 3 chain Stage C / C-12) — login audit trail, 7 commands / 1.67ms  |
| 0031 | login_history_event_type.sql              | ✅   | ★★ Session 069 신규 적용 (Phase 3 chain Stage E / P-α C-α-2) — refresh audit, 4 commands / 2.42ms |
| 0032 | exam_questions_input_type.sql             | ✅   | ★★ Session 069 Step 3-UX-4 — D1 lock 4 type 분기 (input_type + distractors + calc_variables)      |
| 0033 | user_progress_fsrs_extension.sql          | ✅   | ★★ Session 069 Step 3-UX-4 — D7 option C FSRS-4 column 확장 + weak_score + mastered_at            |
| 0034 | study_reviews.sql                         | ✅   | ★★ Session 069 Step 3-UX-4 — packages/srs.scheduleReview 영속 source, 7 commands / 1.03ms         |
| 0035 | study_sessions_streak.sql                 | ✅   | ★★ Session 069 Step 3-UX-4 — D5 lock 게이미피케이션 + 세션 흐름, 7 commands / 0.95ms              |

### 0032~0035 적용 detail (Session 069 Step 3-UX-4 본 회차)

#### 트리거

- Phase 3 학습 UX core 패키지 2종 (learning-modes + srs, Session 069 commits 66f98cd + 3ea4533) 영속 후속
- plan `docs/plans/migration-0032-0035-learning-ux-schema.plan.md` 진산 명시 승인
- packages/srs의 FsrsCardState 영속 column matching 의무

#### Apply 결과

```
🌀 Executing on remote database thepick-db-production (a9b8d521-dc99-46f7-835c-1f226cebdbf8)
🚣 Executed 7 commands in 1.03ms (0032 + 0033 + 0034)
🚣 Executed 7 commands in 0.95ms (0035)
┌───────────────────────────────────────┬────────┐
│ name                                  │ status │
├───────────────────────────────────────┼────────┤
│ 0032_exam_questions_input_type.sql    │ ✅     │
├───────────────────────────────────────┼────────┤
│ 0033_user_progress_fsrs_extension.sql │ ✅     │
├───────────────────────────────────────┼────────┤
│ 0034_study_reviews.sql                │ ✅     │
├───────────────────────────────────────┼────────┤
│ 0035_study_sessions_streak.sql        │ ✅     │
└───────────────────────────────────────┴────────┘
```

#### Post-apply 검증

- `migrations list --remote` → ✅ No migrations to apply
- user_progress row 무손실: **15 rows** (Phase 2 baseline 유지)
- exam_questions row 무손실: **545 rows** (Phase 2 BATCH 6 + R2 누적 baseline 유지)
- 신규 테이블 3종 정합: streak_records / study_reviews / study_sessions (sqlite_master 확인)
- user_progress 신규 6 컬럼: fsrs_reps / fsrs_lapses / fsrs_state / fsrs_last_review / mastered_at / weak_score ✅
- exam_questions 신규 3 컬럼: input_type / distractors / calc_variables ✅
- 기존 row 모두 input_type='fill_blank' default 적용 (Phase 2 routes 회귀 0)
- 기존 row 모두 fsrs_state='new' default 적용 (packages/srs.createFreshCard 첫 review 정합)

---

---

## 0030 + 0031 적용 detail (Session 069 본 회차)

### 트리거

- **Stage C C-12 (login_history)**: 4-Pass + 5-Persona 통합 리뷰 C-12 (Persona4-BCRIT3) — `users.last_login_at` UPDATE = audit trail 단절 → INSERT login_history 패턴으로 전환. GDPR/PIPA forensics 정합.
- **Stage E C-α-2 (event_type)**: 메타 5-페르소나 P-α — refresh rotation 30일 chain audit 누락. stolen refresh token으로 silent rotation forensic blind. `event_type IN ('login','refresh')` 컬럼으로 분리 audit.

### Pre-apply 점검

- `wrangler d1 migrations list thepick-db-production --remote --env=production` → 0030 + 0031 pending 확인
- 신규 테이블 + DEFAULT 있는 컬럼 추가 → 기존 row backfill 안전 (idempotent)

### Apply 결과

```
🌀 Executing on remote database thepick-db-production (a9b8d521-dc99-46f7-835c-1f226cebdbf8)
🚣 Executed 7 commands in 1.67ms (0030)
🚣 Executed 4 commands in 2.42ms (0031)
┌───────────────────────────────────┬────────┐
│ name                              │ status │
├───────────────────────────────────┼────────┤
│ 0030_login_history.sql            │ ✅     │
├───────────────────────────────────┼────────┤
│ 0031_login_history_event_type.sql │ ✅     │
└───────────────────────────────────┴────────┘
```

7 commands (0030) = `CREATE TABLE login_history` + 인덱스 2종 (`idx_login_history_user_at`, `idx_login_history_at`) + NOT NULL trigger 2종 + 마이그레이션 추적 INSERT.
4 commands (0031) = `ALTER TABLE ADD COLUMN event_type NOT NULL DEFAULT 'login' CHECK` + 인덱스 1종 (`idx_login_history_event_at`) + 마이그레이션 추적 INSERT.

### Post-apply 검증

```bash
wrangler d1 migrations list thepick-db-production --remote --env=production
# → ✅ No migrations to apply!
```

`PRAGMA table_info(login_history)` 검증 (6 컬럼):

- id TEXT PK
- user_id TEXT NOT NULL (FK ON DELETE CASCADE)
- login_at TEXT NOT NULL DEFAULT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
- ip_hash TEXT (nullable)
- user_agent TEXT (nullable, USER_AGENT_MAX_LENGTH 256 truncate)
- event_type TEXT NOT NULL DEFAULT 'login' (CHECK IN ('login','refresh'))

인덱스 4종 확인: `sqlite_autoindex_login_history_1` (PK) + `idx_login_history_user_at` + `idx_login_history_at` + `idx_login_history_event_at`.

### Smoke test 정합 검증 (Step 4)

- Production redeploy (`02267900-7171-4526-a73e-b6f42ce48737`) 후 `/api/auth/login` 200 → login_history baseline 0 → 1 row
- 검증 row: `event_type='login'`, `login_at='2026-05-12T08:04:19.667Z'` (ISO 8601 + ms), `ip_hash IS NOT NULL` (IP_PEPPER 정합), user_agent 길이 11 ("curl/x.x.x" truncate 정상)

---

## 0029 적용 detail (Session 067 본 회차)

### Pre-apply 안전 검증

production user_progress 사전 확인:

```sql
SELECT COUNT(*) AS total_rows FROM user_progress;
-- → 15 rows (진산 G9 학습 시도 잔여, 1차 525문 부분 시도)

-- exam 중복 검출
SELECT user_id, card_id, card_type, COUNT(*) AS cnt
FROM user_progress
WHERE card_id IS NOT NULL
GROUP BY user_id, card_id, card_type HAVING COUNT(*) > 1;
-- → 0 rows (중복 0건)

-- concept 중복 검출
SELECT user_id, node_id, card_type, COUNT(*) AS cnt
FROM user_progress
WHERE node_id IS NOT NULL AND card_id IS NULL
GROUP BY user_id, node_id, card_type HAVING COUNT(*) > 1;
-- → 0 rows (중복 0건)
```

★ 중복 0건 → dedup 안전망 0 rows affected. 진산 G9 학습 상태 손실 위험 0.

### Apply 결과

```
🌀 Executing on remote database thepick-db-production (a9b8d521-dc99-46f7-835c-1f226cebdbf8)
🚣 Executed 5 commands in 1.04ms
┌──────────────────────────────────────────┬────────┐
│ name                                     │ status │
├──────────────────────────────────────────┼────────┤
│ 0029_user_progress_unique_constraint.sql │ ✅     │
└──────────────────────────────────────────┴────────┘
```

5 commands = dedup DELETE 2건 (0 rows) + partial UNIQUE INDEX 2건 (`uniq_progress_user_card` + `uniq_progress_user_node_concept`) + 마이그레이션 추적 INSERT 1건.

### Post-apply 검증

```bash
wrangler d1 migrations list thepick-db-production --remote --env=production
# → ✅ No migrations to apply!
```

---

## staging (thepick-db-staging) — 별도 검증 carry-over

본 회차에서 production만 확인. staging은 별도 wrangler call 시점 영속 (Session 067 후속 또는 다음 deploy chain 시).

---

## 운영 규칙

- 매 production migration apply 직후 본 파일 갱신 + git commit
- `wrangler d1 migrations list` 출력 정합 유지
- 0030+ 신규 마이그레이션 시 본 표 entry 추가

---

**작성**: Session 067 (Claude Opus 4.7 1M context) — C-14 흡수 → Session 069 갱신 (Phase 3 launch 직전 Step 1) → Session 069 Step 3-UX-4 갱신 (0032~0035 Phase 3 학습 UX)
**일자**: 2026-05-12 KST (0029 / 0030+0031 / 0032~0035 chain, Session 069 누적 6 마이그레이션 production apply)
