# Migration 0032 ~ 0035 — Phase 3 학습 UX 스키마 plan

> **목적**: Phase 3 학습 UX 4 마이그레이션 신설 영속 (L3 영역, 진산 명시 승인 후 SQL 작성 + production apply).
> **상위 plan**: `docs/plans/phase3-learning-ux-modes.plan.md` §8 (Step 3-UX-4)
> **production apply pattern**: Session 069 commit a5a8dac (migration 0030/0031) 동일 chain 재사용.

---

phase: 3
step: 3-UX-4 (Step 3-UX-2/3 패키지 신설 완료 후속, Step 3-UX-5 routes 통합 직전 의무)
approved_by: TBD (진산 §승인 후 SQL 작성 진입)
scope:

- `migrations/0032_exam_questions_input_type.sql` (NEW)
- `migrations/0033_user_progress_fsrs_extension.sql` (NEW)
- `migrations/0034_study_reviews.sql` (NEW)
- `migrations/0035_study_sessions_streak.sql` (NEW)
- production D1: thepick-db-production a9b8d521-dc99-46f7-835c-1f226cebdbf8
- staging D1 dry-run carry-over (Session 067 baseline 부재 — 진산 D1 staging 인스턴스 도입 시 활성)

risk_level: **L3** (DB 스키마 변경 + 사용자 데이터 처리 — CLAUDE.md L3 정합)

---

## 1. 목적

`phase3-learning-ux-modes.plan` §13 lock 결정 7종 (D1~D7) 정합 후속 마이그레이션. 4 마이그레이션 chain:

- 0032: exam_questions 4 type 분기 (객관식 distractors + 계산식 variables)
- 0033: user_progress FSRS-4 column 확장 (D7 lock option C — 기존 4 + 신규 4 컬럼)
- 0034: study_reviews 신규 (review 이력 trace, packages/srs.scheduleReview 영속 source)
- 0035: study_sessions + streak_records 신규 (세션 흐름 + 게이미피케이션 D5 lock)

본 마이그레이션은 Step 3-UX-5 (apps/api routes 통합) **직전** 적용 의무. routes가 신규 column/table 의존하므로 마이그레이션 선행 의무 (Session 069 deploy chain Step 1 직전 의무 패턴 정합).

---

## 2. 대상 파일

### 2.1 `migrations/0032_exam_questions_input_type.sql`

```sql
-- ★ Migration 0032 — exam_questions 4 type 분기 (Phase 3 학습 UX D1 lock)
--
-- 트리거: phase3-learning-ux-modes.plan §8.1 + §13 D1 lock
--   - 객관식 distractors (오답 후보 4개) JSON 컬럼 — Step 3-UX-7 BATCH 보강 source
--   - 계산식 calc_variables (산식 변수) JSON 컬럼
--   - input_type 분기 (4 type: multiple_choice / fill_blank / essay / calc)
--
-- L3 영역: DB 스키마 변경
-- backward-compat: 기존 row는 input_type default='fill_blank' (Phase 2 baseline 그대로 동작)

PRAGMA foreign_keys = ON;

ALTER TABLE exam_questions ADD COLUMN input_type TEXT NOT NULL DEFAULT 'fill_blank'
  CHECK (input_type IN ('multiple_choice', 'fill_blank', 'essay', 'calc'));

-- 객관식 distractor 4개 (JSON array of 4 strings, 정답은 answer 컬럼 유지)
ALTER TABLE exam_questions ADD COLUMN distractors TEXT;

-- 계산식 산식 변수 (JSON object: { var_name: numeric_value })
ALTER TABLE exam_questions ADD COLUMN calc_variables TEXT;

CREATE INDEX IF NOT EXISTS idx_exam_questions_input_type ON exam_questions(input_type);
```

### 2.2 `migrations/0033_user_progress_fsrs_extension.sql`

```sql
-- ★ Migration 0033 — user_progress FSRS-4 column 확장 (D7 lock option C)
--
-- 트리거: phase3-learning-ux-modes.plan §8.2 + §13.3 D7 lock
--   - 기존 fsrs_difficulty/stability/interval/next_review 4 컬럼 유지 (column 확장 패턴)
--   - 신규 4 컬럼: reps + lapses + state + last_review
--   - 약점/마스터 컬럼: mastered_at + weak_score
--
-- L3 영역: DB 스키마 변경 + 사용자 학습 데이터
-- backward-compat: NOT NULL DEFAULT — 기존 row 영향 0

PRAGMA foreign_keys = ON;

-- FSRS-4 신규 컬럼 (packages/srs FsrsCardState 매핑)
ALTER TABLE user_progress ADD COLUMN fsrs_reps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_progress ADD COLUMN fsrs_lapses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_progress ADD COLUMN fsrs_state TEXT NOT NULL DEFAULT 'new'
  CHECK (fsrs_state IN ('new', 'learning', 'review', 'relearning'));
ALTER TABLE user_progress ADD COLUMN fsrs_last_review TEXT;  -- nullable, 첫 review 전 NULL

-- 약점/마스터 (D2 lock 정합)
ALTER TABLE user_progress ADD COLUMN mastered_at TEXT;  -- fsrs_stability ≥ 30일 (MASTERED_THRESHOLD_DAYS)
ALTER TABLE user_progress ADD COLUMN weak_score REAL NOT NULL DEFAULT 0;  -- 0~1, 높을수록 약점

-- 약점 우선 정렬 인덱스 (Step 3-UX-5 weak mode 추출 정책)
CREATE INDEX IF NOT EXISTS idx_user_progress_weak
  ON user_progress(user_id, weak_score DESC);

-- 마스터 카드 cool-down 추출 인덱스
CREATE INDEX IF NOT EXISTS idx_user_progress_mastered
  ON user_progress(user_id, mastered_at)
  WHERE mastered_at IS NOT NULL;
```

### 2.3 `migrations/0034_study_reviews.sql`

```sql
-- ★ Migration 0034 — study_reviews 신규 (review 이력 trace)
--
-- 트리거: phase3-learning-ux-modes.plan §8.3
--   - packages/srs.scheduleReview 결과 영속 source
--   - cold start replay (packages/srs.replayReviews) source — device sync 복원
--   - admin observability — Phase 3 user 행동 forensics
--
-- L3 영역: 사용자 학습 데이터 (PII)
-- 정합:
--   - FK ON DELETE CASCADE — 사용자 삭제 시 이력 동기 삭제 (GDPR right-to-erasure)
--   - rating CHECK enum — packages/learning-modes FSRS_RATINGS 정합

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS study_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,  -- exam_questions.id 또는 knowledge_nodes.id
  card_type TEXT NOT NULL CHECK (card_type IN ('exam', 'concept')),
  reviewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  interval_days INTEGER NOT NULL,
  stability_before REAL,
  stability_after REAL,
  shuffle_seed TEXT,  -- 객관식 셔플 시드 audit (정답 위치 telemetry 미노출)
  session_id TEXT     -- study_sessions.id FK (0035 도입 후 ON DELETE SET NULL)
);

CREATE INDEX IF NOT EXISTS idx_study_reviews_user_at
  ON study_reviews(user_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_reviews_card
  ON study_reviews(card_id, card_type);

-- NOT NULL 방어 trigger (0005 패턴 정합)
CREATE TRIGGER IF NOT EXISTS enforce_study_reviews_user_id_not_null
BEFORE INSERT ON study_reviews
WHEN NEW.user_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'study_reviews.user_id cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_study_reviews_card_id_not_null
BEFORE INSERT ON study_reviews
WHEN NEW.card_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'study_reviews.card_id cannot be NULL');
END;
```

### 2.4 `migrations/0035_study_sessions_streak.sql`

```sql
-- ★ Migration 0035 — study_sessions + streak_records 신규
--
-- 트리거: phase3-learning-ux-modes.plan §8.4 + §13 D5 lock (게이미피케이션 표준)
--   - 세션 흐름 (warm-up → main → cool-down) — packages/learning-modes session/flow.ts (Step 3-UX-3 후속)
--   - streak 게이미피케이션 (연속 일자 학습 + 일일 목표 + 마스터 비율)
--
-- L3 영역: 사용자 학습 데이터 (PII)
-- 정합:
--   - 0034 study_reviews.session_id FK retroactive 연결
--   - daily_goal default 20 (D5 lock 정합)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ended_at TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('category', 'topic', 'confusion', 'weak', 'mixed')),
  mode_params TEXT,  -- JSON: { subject, conceptId, confusionType, ... }
  phase TEXT NOT NULL DEFAULT 'warmup'
    CHECK (phase IN ('warmup', 'main', 'cooldown', 'completed')),
  cards_planned INTEGER NOT NULL,
  cards_completed INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_started
  ON study_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_sessions_active
  ON study_sessions(user_id, ended_at)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS streak_records (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,  -- YYYY-MM-DD (UTC) — todayDateString 정합
  daily_goal INTEGER NOT NULL DEFAULT 20
);

-- NOT NULL 방어 trigger
CREATE TRIGGER IF NOT EXISTS enforce_study_sessions_user_id_not_null
BEFORE INSERT ON study_sessions
WHEN NEW.user_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'study_sessions.user_id cannot be NULL');
END;
```

---

## 3. 위험 분석

| 위험                                                                 | 완화                                                                                                                                                                                               |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0033 ADD COLUMN NOT NULL DEFAULT 실패                                | SQLite 3.32+ 지원 (D1 정합). DEFAULT 명시 → 기존 row 자동 채움. 진산 G9 임시 row 15건 영향 0.                                                                                                      |
| input_type='fill_blank' default 후 일부 객관식 문제가 단답 채점 처리 | Step 3-UX-7 BATCH 보강에서 input_type 갱신 의무 (admin UI 검수 chain). 본 마이그레이션 적용 후 즉시 회귀는 0건.                                                                                    |
| fsrs_state default='new' 후 기존 user의 review 진행 카드 상태 오인   | apps/api/src/study/routes.ts Step 3-UX-5 통합 시: 기존 fsrs_next_review NOT NULL row는 'review'로 전환 추정 OR replay reviews. ★ 진산 결정 추가 (D8 carry-over).                                   |
| 0034 study_reviews FK session_id 미존재 시점                         | 0035 study_sessions 적용 후에 study_reviews.session_id INSERT 가능. 0034 본문에서 FK reference 생략 (REFERENCES 절 없음, NULL 허용). 0035 적용 후 회귀 마이그레이션으로 FK 추가는 별도 carry-over. |
| 마이그레이션 4 chain 중 일부만 적용 (partial failure)                | 각 마이그레이션 IF NOT EXISTS + idempotent. Re-apply 안전. wrangler d1 migrations apply는 chronological order 보장.                                                                                |
| weak_score 산식이 production 진산 row 15건에 적용 안 됨 (default=0)  | Step 3-UX-5 routes 통합 시 첫 review에서 weak_score 갱신. 또는 backfill 별도 script (carry-over).                                                                                                  |
| Step 3-UX-5 routes 통합 미완료 상태에서 마이그레이션만 적용 시 회귀  | 신규 컬럼은 nullable 또는 DEFAULT — 기존 routes SELECT/INSERT 100% 호환. INSERT 누락은 DEFAULT로 채움. 회귀 0건.                                                                                   |

---

## 4. 검증 계획

### 4.1 SQL 작성 후 즉시 검증

- [ ] migrations/0032 ~ 0035 4 파일 모두 작성 완료
- [ ] `pnpm test --filter=@thepick/api` PASS (Drizzle ORM schema sync 의무 후)
- [ ] `verify-engine-contracts` PASS (Cat 9 Table-as-Micro-KG + Cat 10 Drizzle/SQL enum 정합)
- [ ] Drizzle schema (`apps/api/src/db/schema.ts`) 동기 갱신 (NC-1 정책 — 수동 동기화 강제)

### 4.2 production apply pre-check

- [ ] `npx wrangler d1 migrations list thepick-db-production --remote --env=production` → 0032/0033/0034/0035 pending 확인
- [ ] production user_progress row count 영속 (기대 ~15 rows — 진산 G9 학습 잔여)
- [ ] production exam_questions row count 영속 (기대 ~414 rows — admin G5.5 active approved)
- [ ] `.claude/reports/production-migration-status.md` baseline 영속

### 4.3 production apply 후 검증

- [ ] `wrangler d1 migrations list` → ✅ No migrations to apply
- [ ] `PRAGMA table_info(user_progress)` — 신규 4 컬럼 정합 (reps/lapses/state/last_review)
- [ ] `PRAGMA table_info(exam_questions)` — 신규 3 컬럼 정합 (input_type/distractors/calc_variables)
- [ ] `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('study_reviews','study_sessions','streak_records')` → 3 row
- [ ] 기존 user_progress 15 row 무손실 (fsrs_state='new' default 적용 정합)
- [ ] 기존 exam_questions 414 row 무손실 (input_type='fill_blank' default 적용 정합)

### 4.4 post-apply smoke (Step 3-UX-5 진입 전 baseline)

- [ ] production /api/study/next + /api/study/grade 정합 (기존 fill_blank path 회귀 0)
- [ ] 진산 본인 계정 학습 1회 시도 → user_progress row 무회귀 + 신규 column DEFAULT 정합

---

## 5. 적용 절차 (Session 069 deploy chain pattern 재사용)

### 5.1 Pre-apply (진산 명시 승인 후)

```bash
cd /home/soo/ClaudePro/ThePick/apps/api
npx wrangler d1 migrations list thepick-db-production --remote --env=production
# 기대: 0032 + 0033 + 0034 + 0035 4건 pending
```

### 5.2 Apply

```bash
npx wrangler d1 migrations apply thepick-db-production --remote --env=production
# 비대화형 fallback "yes" 자동 진행 (Session 069 0030/0031 패턴 정합)
```

### 5.3 Post-apply 검증

```bash
npx wrangler d1 migrations list thepick-db-production --remote --env=production
# 기대: ✅ No migrations to apply

# 컬럼 검증
npx wrangler d1 execute thepick-db-production --remote --env=production --json --command \
  "PRAGMA table_info(user_progress);"
npx wrangler d1 execute thepick-db-production --remote --env=production --json --command \
  "PRAGMA table_info(exam_questions);"

# 신규 테이블 검증
npx wrangler d1 execute thepick-db-production --remote --env=production --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('study_reviews','study_sessions','streak_records');"

# 기존 row 무손실
npx wrangler d1 execute thepick-db-production --remote --env=production --json --command \
  "SELECT COUNT(*) FROM user_progress;"
# 기대: ~15

npx wrangler d1 execute thepick-db-production --remote --env=production --json --command \
  "SELECT COUNT(*) FROM exam_questions;"
# 기대: ~414
```

### 5.4 영속

- `.claude/reports/production-migration-status.md` 갱신 (0032~0035 entry + detail, Session 069 0030/0031 패턴)
- commit 메시지: `chore(ops): migration 0032-0035 production apply — Phase 3 학습 UX 스키마 chain`
- handoff-080에 적용 영속

---

## 6. 롤백 전략

본 마이그레이션은 **forward-only chain**. SQLite는 ALTER TABLE DROP COLUMN을 SQLite 3.35+에서만 지원하나, D1 trigger drop은 복잡. 따라서 롤백 시:

| 상황                                           | 대응                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0032 적용 후 input_type 정합 회귀 발견         | 신규 forward 마이그레이션 0036에서 `UPDATE exam_questions SET input_type='fill_blank'` (default 복원)      |
| 0033 적용 후 신규 컬럼이 routes 회귀 유발      | 본 컬럼은 nullable 또는 DEFAULT — 회귀 가능성 낮음. routes 측 SELECT 수정으로 복원                         |
| 0034 study_reviews INSERT failure              | 신규 forward 마이그레이션으로 trigger/CHECK 완화                                                           |
| 0035 study_sessions phase enum 회귀            | CHECK constraint 완화 forward 마이그레이션                                                                 |
| 마이그레이션 chain 자체 적용 실패 (production) | wrangler d1 migrations 자체 chronological 처리 — partial apply 안전. 다음 apply 시 잔여 chain 자동 재시도. |

★ **production data 자체 손실은 본 chain에서 발생 0** — ADD COLUMN/CREATE TABLE만 사용. DROP/UPDATE 없음.

---

## 7. 승인 기록

- 본 plan 작성: Claude (Opus 4.7 1M context), 2026-05-12 KST (Session 069 종착 후 Step 3-UX-4 진입)
- 진산 §승인: TBD — 본 plan 검토 후 명시 발화 시 SQL 작성 진입
- 후속 단계: SQL 작성 → typecheck/lint/tests → production apply → handoff 영속

---

## 8. 관련 reference

- 상위 plan: `docs/plans/phase3-learning-ux-modes.plan.md` §8 (마이그레이션 단계) + §13.3 D7 lock
- 기존 schema baseline: `migrations/0001_initial_schema.sql` (exam_questions) + `migrations/0002_1st_exam_extension.sql` (user_progress)
- production apply pattern: Session 069 commit a5a8dac (`.claude/reports/production-migration-status.md` 0030/0031 detail)
- L3 영역 정합: CLAUDE.md `## L3 영역` + `.claude/rules/dev-guide.md` `## L3 보안 규칙`
- NC-1 (Drizzle/SQL 수동 동기화): `scripts/verify-engine-contracts.ts` Cat 10
