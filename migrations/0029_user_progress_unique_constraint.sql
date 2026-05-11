-- ★ Migration 0029 — user_progress UNIQUE 제약 + lookup 가속
--
-- 트리거: Session 066 4-Pass + 5-Persona 통합 리뷰 C-06
--   - Persona 2 (Performance) P-CRIT-1: lookup 비용 (idx_progress_user 후 row-level filter)
--   - Persona 4 (Backend) B-CRIT-1: Year 2 마이그레이션 폭탄 예방 (UNIQUE 부재로 누적 중복 row)
--   - 4-Pass M-1: /grade catch D1_UNIQUE_CONSTRAINT_PATTERN 분기 (현 죽은 코드 → 실제 방어선)
--
-- L3 영역: DB 스키마 변경 (CLAUDE.md L3 정합)
-- Plan: docs/plans/migration-0029-user-progress-unique.plan.md
--
-- 정합:
--   - SQLite partial UNIQUE INDEX (3.8.0+ 지원, Cloudflare D1 정합)
--   - exam 카드(card_id 있음) vs concept 카드(node_id 있음, card_id 없음) 패턴 격리
--   - IF NOT EXISTS — 재실행 안전 (idempotent)
--
-- production 적용:
--   wrangler d1 migrations apply thepick-db-production --remote
--   (진산 wrangler 토큰 발화 후 + .claude/reports/production-migration-status.md 영속)

-- ---------------------------------------------------------------------------
-- A. dedup 안전망 (production user_progress 중복 row 정리, 진산 단독 user 0 rows 예상)
-- ---------------------------------------------------------------------------

-- exam 카드 중복 dedup (rowid 작은 row 삭제, 최신 보존)
DELETE FROM user_progress WHERE rowid IN (
  SELECT a.rowid FROM user_progress a
  INNER JOIN user_progress b ON a.user_id = b.user_id
    AND a.card_id = b.card_id
    AND a.card_type = b.card_type
  WHERE a.card_id IS NOT NULL AND a.rowid < b.rowid
);

-- concept 카드 중복 dedup
DELETE FROM user_progress WHERE rowid IN (
  SELECT a.rowid FROM user_progress a
  INNER JOIN user_progress b ON a.user_id = b.user_id
    AND a.node_id = b.node_id
    AND a.card_type = b.card_type
  WHERE a.node_id IS NOT NULL AND a.card_id IS NULL AND a.rowid < b.rowid
);

-- ---------------------------------------------------------------------------
-- B. partial UNIQUE INDEX (lookup 가속 자동 포함)
-- ---------------------------------------------------------------------------

-- exam 카드: (user_id, card_id, card_type) WHERE card_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS uniq_progress_user_card
  ON user_progress(user_id, card_id, card_type)
  WHERE card_id IS NOT NULL;

-- concept 카드: (user_id, node_id, card_type) WHERE node_id IS NOT NULL AND card_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uniq_progress_user_node_concept
  ON user_progress(user_id, node_id, card_type)
  WHERE node_id IS NOT NULL AND card_id IS NULL;
