-- Migration 0018: Hard Rule 13 강제 — knowledge_nodes 는 status='draft' 만 INSERT 허용
--
-- 근거:
--   - CLAUDE.md Hard Rule 13: AI 생성 데이터는 draft 상태로만 적재 (인간 검수 후 approved)
--   - .claude/reviews/phase1-tech-debt-20260502-quality.md CRIT-QPHASE1-3
--   - production-quality.md "근거 0건 = approved 차단" 정책 (메모리 project_source_citation_requirement)
--
-- 본 마이그레이션이 강제하는 invariant 2개:
--   1) knowledge_nodes INSERT 시 status MUST = draft (코드 회귀 또는 Claude 응답 schema drift 차단)
--   2) knowledge_nodes INSERT 시 page_ref MUST NOT NULL (출처 추적성 — Hard Rule 13 정합)
--
-- Sprint 1 §5.5 Phase 1 5-페르소나 Group A 흡수 — BATCH-1 적재 진입 차단 게이트.
--
-- 호환성:
--   - 기존 INSERT path (apps/batch/src/loader/draft-loader.ts) 는 status=draft 명시 + page_ref 전달
--   - 향후 Phase 2 review/approved 전이는 UPDATE 경로 (state-machine.ts) — 본 트리거 영향 없음
--   - Year 2 멀티시험 진입 시 본 트리거 그대로 유지 — exam_id 컬럼 도입과 무관

-- (1) status=draft 강제 트리거
CREATE TRIGGER IF NOT EXISTS prevent_non_draft_insert
BEFORE INSERT ON knowledge_nodes
WHEN NEW.status != 'draft'
BEGIN
  SELECT RAISE(ABORT, 'Hard Rule 13 violation: knowledge_nodes INSERT requires status=draft. Use state_transitions UPDATE for transitions.');
END;

-- (2) page_ref NOT NULL 강제 트리거 — 출처 추적성 의무
-- 분담 정합 (4-Pass MAJOR-S1 흡수): 0010 enforce_knowledge_nodes_page_ref_not_null 가 NULL+빈 문자열
-- 모두 차단 (strict superset). 본 0018 트리거는 0010 와 의도적 redundancy — 다른 RAISE 메시지로
-- "Hard Rule 13" 의미 직접 노출 (디버깅 가시성 향상). 향후 0010 회수 시 본 트리거를 NULL+빈 문자열
-- 양쪽 차단으로 강화 의무 (0010 의 빈 문자열 방어선 보존).
CREATE TRIGGER IF NOT EXISTS enforce_page_ref_on_insert
BEFORE INSERT ON knowledge_nodes
WHEN NEW.page_ref IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Hard Rule 13 violation: knowledge_nodes INSERT requires page_ref (source citation). Memory project_source_citation_requirement.');
END;

-- 검증 SQL (본 마이그레이션 적용 후 진산님 직접 확인 가능):
-- 1. 트리거 등록 확인
--    SELECT name FROM sqlite_master WHERE type='trigger'
--      AND name IN ('prevent_non_draft_insert', 'enforce_page_ref_on_insert');
--    기대: 2 row
--
-- 2. status=approved INSERT 차단 (smoke test) — RAISE ABORT
-- 3. page_ref NULL INSERT 차단 (smoke test) — RAISE ABORT
-- 4. status=draft + page_ref 있는 정상 INSERT — PASS
--
-- 롤백 절차 (down script):
-- DROP TRIGGER IF EXISTS prevent_non_draft_insert;
-- DROP TRIGGER IF EXISTS enforce_page_ref_on_insert;
