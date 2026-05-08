-- ============================================================
-- 0027_review_queue.sql
--
-- ADR-015 Multi-Path Fallback (Rule 18) Stage 4 Honest Refusal —
-- D-MPF-3=A 채택 (Session 059): 신규 review_queue D1 테이블 + migration 0027
--
-- 배경 (Session 059 진산 결정):
--   학습자 검색이 4 단계 모두 Miss 시 (Vector < 0.60 + Keyword Miss + Topic Miss)
--   "정직한 거부" 응답 + 검수 큐 자동 기록 (Hard Rule 21 정합).
--   기존 engine_telemetry 활용 옵션 (D-MPF-3=B) 도 가능하나 admin G5.5 검수 UI
--   통합을 위해 명시적 큐 테이블 채택. 옵션 C (console.error 만) 영속 부재 →
--   운영 부적합.
--
-- 검수자 워크플로우 (Year 1 admin G5.5 step carry-over):
--   1. 학습자 거부 응답 발생 → review_queue INSERT (reviewed_at = NULL)
--   2. 검수자 admin UI 에서 미검수 큐 조회 (idx_review_queue_unreviewed 활용)
--   3. 검수자 결정 (reviewer_action):
--      - 'add_keyword': 노드 description 에 키워드 추가
--      - 'expand_topic': topic_cluster lv1/lv2/lv3 확장
--      - 'add_node': 신규 knowledge_node draft INSERT (BATCH 재처리 신호)
--      - 'out_of_scope': 시험 범위 밖 (영구 분류, 통계 집계용)
--      - 'duplicate': 동일 query_hash 기존 큐와 중복 (idx_review_queue_hash 활용)
--   4. UPDATE reviewed_at = datetime('now'), reviewer_id, reviewer_action
--
-- PII / Pass 3 M1 정합:
--   - query 평문 미저장 (query_hash + query_length 만)
--   - SHA-256 12-hex prefix (apps/api/src/search/log-redact.ts 정합)
--
-- Hard Rule 16 (Year 1 + Year 2 정합):
--   - exam_id 컬럼 명시 — Year 2 멀티시험 진입 시 WHERE 절 즉시 활성화 (zero-cost)
--
-- 호환성:
--   - 기존 0001~0026 영향 0
--   - 적재 row 0건 (Multi-Path Fallback 모듈 도입 전 INSERT 부재)
--   - INSERT 만 (검수자 UPDATE 는 admin G5.5 step 에서 별도 trigger 추가)
--
-- 검증:
--   - wrangler d1 migrations apply staging+production
--   - Cat 9 (scripts/verify-engine-contracts.ts) 0027 파일 존재 + table 존재
-- ============================================================

CREATE TABLE IF NOT EXISTS review_queue (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  query_length INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('honest_refusal', 'topic_uncertain', 'no_match')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewer_id TEXT,
  reviewer_action TEXT CHECK (
    reviewer_action IS NULL
    OR reviewer_action IN ('add_keyword', 'expand_topic', 'add_node', 'out_of_scope', 'duplicate')
  )
);

-- 미검수 큐 조회 인덱스 (admin G5.5 검수자 워크플로우)
CREATE INDEX IF NOT EXISTS idx_review_queue_unreviewed
  ON review_queue(reviewed_at)
  WHERE reviewed_at IS NULL;

-- 시험별 거부율 통계 인덱스 (Year 2 멀티시험 진입 시 활용)
CREATE INDEX IF NOT EXISTS idx_review_queue_exam
  ON review_queue(exam_id);

-- 동일 query 그룹핑 인덱스 (duplicate 검수 + Pass 3 M1 hash 정합)
CREATE INDEX IF NOT EXISTS idx_review_queue_hash
  ON review_queue(query_hash);

-- created_at 시간 순 조회 인덱스 (최신 거부 우선 검수)
CREATE INDEX IF NOT EXISTS idx_review_queue_created
  ON review_queue(created_at DESC);
