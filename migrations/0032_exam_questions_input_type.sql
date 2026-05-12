-- ★ Migration 0032 — exam_questions 4 type 분기 (Phase 3 학습 UX D1 lock)
--
-- 트리거: phase3-learning-ux-modes.plan §8.1 + §13 D1 lock
--   - 객관식 distractors (오답 후보 4개) JSON 컬럼 — Step 3-UX-7 BATCH 보강 source
--   - 계산식 calc_variables (산식 변수) JSON 컬럼
--   - input_type 분기 (4 type: multiple_choice / fill_blank / essay / calc)
--
-- L3 영역: DB 스키마 변경 (CLAUDE.md L3 정합)
-- Plan: docs/plans/migration-0032-0035-learning-ux-schema.plan.md §2.1
--
-- backward-compat:
--   - 기존 row는 input_type default='fill_blank' (Phase 2 baseline 그대로 동작)
--   - distractors / calc_variables nullable — 기존 row 영향 0
--   - Step 3-UX-7 BATCH에서 input_type 갱신 chain 진행

PRAGMA foreign_keys = ON;

ALTER TABLE exam_questions ADD COLUMN input_type TEXT NOT NULL DEFAULT 'fill_blank'
  CHECK (input_type IN ('multiple_choice', 'fill_blank', 'essay', 'calc'));

ALTER TABLE exam_questions ADD COLUMN distractors TEXT;

ALTER TABLE exam_questions ADD COLUMN calc_variables TEXT;

CREATE INDEX IF NOT EXISTS idx_exam_questions_input_type
  ON exam_questions(input_type);
