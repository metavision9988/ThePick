# Plan — migration 0029: user_progress UNIQUE + 복합 인덱스 (L3)

> **트리거**: Session 066 4-Pass + 5-Persona 통합 리뷰 C-06 (Persona2-PCRIT1 + Persona4-BCRIT1)
> **L3 영역**: DB 스키마 변경 (마이그레이션) — CLAUDE.md `## L3 영역` 정합
> **진산 승인**: Session 066 옵션 A "즉시 흡수 7건 전부" (Session 066 entry 단일 결정)

## 1. 문제

`user_progress` 테이블 (migrations/0002:59-78):

- PK: `id` (랜덤 UUID, 동일 (user, card) 다중 row 생성 차단 0)
- 인덱스: `idx_progress_user(user_id)`, `idx_progress_next(fsrs_next_review)`, `idx_progress_node(node_id)`
- **UNIQUE 부재**: `(user_id, card_id, card_type)` 또는 `(user_id, node_id, card_type)` 무방어

### Persona 2 — runtime 부담

- `/api/study/grade` SELECT existing → INSERT 흐름 (study/routes.ts:444-499) **TOCTOU race**
- 1M rows 도달 시 lookup이 `idx_progress_user` 후 row-level filter → user당 100 row scan/req

### Persona 4 — Year 2 마이그레이션 폭탄

- Year 2 Phase 4 `ALTER TABLE user_progress ADD COLUMN exam_id` + UNIQUE INDEX 생성 시 누적 중복 row → `UNIQUE constraint failed` → 24-48h dedup 비용
- **예방 비용 1h vs 회수 24-48h**

## 2. 결정

### a. partial UNIQUE INDEX 2건

```sql
-- exam 카드: (user_id, card_id, card_type) WHERE card_id IS NOT NULL
CREATE UNIQUE INDEX uniq_progress_user_card
  ON user_progress(user_id, card_id, card_type)
  WHERE card_id IS NOT NULL;

-- concept 카드: (user_id, node_id, card_type) WHERE node_id IS NOT NULL AND card_id IS NULL
CREATE UNIQUE INDEX uniq_progress_user_node_concept
  ON user_progress(user_id, node_id, card_type)
  WHERE node_id IS NOT NULL AND card_id IS NULL;
```

근거:

- SQLite partial UNIQUE INDEX는 NULL을 자동 제외 (NULL-safe). exam (card_id 있음) vs concept (node_id 있음, card_id 없음) 두 패턴 격리.
- UNIQUE INDEX는 자동 lookup index 역할 → 추가 일반 인덱스 불필요.
- `IF NOT EXISTS` 추가로 재실행 안전 (idempotent).

### b. dedup 안전망 (production 적용 시 0-row 가능)

```sql
-- exam 중복 dedup (rowid 작은 row 삭제, 최신 보존)
DELETE FROM user_progress WHERE rowid IN (
  SELECT a.rowid FROM user_progress a
  INNER JOIN user_progress b ON a.user_id = b.user_id
    AND a.card_id = b.card_id
    AND a.card_type = b.card_type
  WHERE a.card_id IS NOT NULL AND a.rowid < b.rowid
);

-- concept 중복 dedup
DELETE FROM user_progress WHERE rowid IN (
  SELECT a.rowid FROM user_progress a
  INNER JOIN user_progress b ON a.user_id = b.user_id
    AND a.node_id = b.node_id
    AND a.card_type = b.card_type
  WHERE a.node_id IS NOT NULL AND a.card_id IS NULL AND a.rowid < b.rowid
);
```

production 진산 단독 user: G9 시도 1회 → dedup 영향 0 rows 예상. dedup은 안전망.

### c. Drizzle ORM 정합

`apps/api/src/db/schema.ts:356-375` userProgress 정의 변경 0건 (인덱스는 Drizzle에서 별도 선언이며 본 인덱스는 raw SQL로만 생성. 미래 schema.ts에서 인덱스 declaration 동기화 carry-over).

### d. /grade INSERT OR IGNORE 보강 (4-Pass M-1 죽은 코드 해소)

routes.ts:484-499 INSERT 흐름은 SELECT existing 후 분기. 새 UNIQUE 제약 활성화 시 TOCTOU 동시 INSERT는 SQLite `UNIQUE constraint failed` throw → 기존 catch 블록 `D1_UNIQUE_CONSTRAINT_PATTERN` 분기가 활성화. **본 마이그레이션 후 죽은 코드 → 실제 방어선**.

## 3. 영향 범위

### 변경 파일

- `migrations/0029_user_progress_unique_constraint.sql` (NEW)
- `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` SCENARIO_MIGRATIONS 배열 `'0029_user_progress_unique_constraint.sql'` 추가

### Drizzle schema.ts

- 본 step 변경 0건 (raw SQL 인덱스). Year 2 Phase 4 시점 schema.ts에 `index()` declaration 추가 의무 carry-over

### 테스트

- routes.test.ts (study) 23 PASS 유지 — UNIQUE 활성화 후 동일 (user, card, type) row 2회 INSERT 시도하는 테스트 0건 (정합)
- scenarios.test.ts S5 ADR-034 skip 보존
- 추가 회귀 테스트 1건 권고: `/grade 2회 호출 동일 question → user_progress 단일 row 보존` (D1_UNIQUE_CONSTRAINT_PATTERN catch 검증)

### production 적용

- `wrangler d1 migrations apply thepick-db-production --remote` (진산 wrangler 토큰 발화 후)
- 본 step에서는 마이그레이션 파일만 영속 + 테스트 정합. production 적용은 C-14 (migration 0028 적용 증거) 처리 동시 진행.

## 4. 회귀 시나리오 (Devil's Advocate)

1. **production user_progress에 이미 중복 row 존재 시**: dedup이 자동 정리. fsrs_next_review 최신 row 보존 보장 X (rowid 기준) → 진산 G9 학습 상태 손실 위험. mitigation: production 적용 전 `SELECT COUNT(*) FROM user_progress` 수동 확인.
2. **partial UNIQUE INDEX SQLite 버전 의존**: SQLite 3.8.0+ 지원. Cloudflare D1은 SQLite 3.x.x (3.43+ 추정) → 정합.
3. **/grade catch 블록 false positive**: D1_UNIQUE_CONSTRAINT_PATTERN 정규식이 SQLite stderr 정확 일치 검증 필요 → 회귀 테스트 추가 권고.

## 5. carry-over

- **본 step 미흡수** (handoff-075 영속): `/grade 2회 호출 동일 question UNIQUE constraint catch` 회귀 테스트. 본 마이그레이션 적용은 충분하나, catch 분기 실제 발화 회귀 검증은 별도 task.
- **Year 2 Phase 4**: schema.ts에 `index()` declaration 추가 + Year 2 마이그레이션에서 `ALTER TABLE user_progress ADD COLUMN exam_id` + UNIQUE INDEX `(user_id, exam_id, card_id, card_type)` 확장.

## 6. 결정 영역

- 본 마이그레이션은 **품질/스키마** 영역 (memory `feedback_full_autonomy.md` 결정 영역 boundary 3번 "품질 변화" 일부) — 진산 옵션 A 승인으로 자동 진행 정합.
- production 적용 (wrangler 호출)은 진산 토큰 발화 의존 → 본 step에서는 마이그레이션 파일 + 테스트 정합만 영속.

---

**작성**: Claude (Opus 4.7 1M context) — Session 066 옵션 A C-06
**일자**: 2026-05-11 KST
