-- ============================================================
-- 0019_knowledge_nodes_page_chapter_meta.sql
--
-- ADR-030 — Knowledge Nodes 페이지/챕터 메타 4 컬럼 도입
--
-- 배경 (2026-05-03, Session 038 BATCH-1 진입 직전):
--   사용자(수험자) 입장 본문 페이지 번호 + 챕터/절 타이틀 병행 의무.
--   Session 038 BATCH-1 reconnaissance 발견: PDF 페이지 ≠ 본문 페이지 (PDF p.N = 본문 p.(N-7)).
--   Claude 가 "PDF p.421 image" 표기 → 진산님이 본문 p.414 검증 → mismatch catch 부담 발생.
--   향후 BATCH-2~5 + 사용자 UX ("교재 O장 O절 참고") 동일 부담 누적 위험.
--
-- 책임:
--   1. knowledge_nodes 에 4 신규 컬럼 추가 (book_page / pdf_page / chapter / section)
--   2. book_page + pdf_page NOT NULL 강제 트리거 (chapter / section 은 NULL 허용 — 법령 노드 호환)
--   3. 인덱스 2개 (book_page 범위 쿼리 + chapter 그룹 쿼리)
--   4. 0010 / 0018 기존 page_ref 트리거와 호환 (page_ref TEXT 컬럼 그대로 유지)
--
-- 호환성:
--   - 기존 row 호환 — 4 신규 컬럼 NULLABLE (ALTER TABLE ADD COLUMN 제약)
--   - 트리거는 신규 INSERT 만 차단 (기존 row 영향 0)
--   - page_ref TEXT 그대로 유지 — 사용자 노출 통합 텍스트 ("본문 p.415 / 제1장 제3절 (다) 낙엽률조사")
--   - 4 신규 컬럼 = 구조화된 메타 (조회/필터링용)
--
-- Year 2 호환:
--   - 본 4 컬럼은 모든 시험 도메인 공통 (ADR-007 정합)
--   - Year 2 진입 시 컬럼 변경 0건 (zero-cost)
--
-- 0019 슬롯 conflict 해결 (handoff-038 §주의사항):
--   - 본 마이그레이션 = 0019 (BATCH-1 진입 직전 차단 게이트)
--   - B-C1 (user_progress.exam_id, Year 2 zero-cost) = 0020 슬롯 이월
--   - B-C3 (engine_telemetry 트리거 옵션 B) = 0021 슬롯 이월
--   - TD-PHASE2-1 갱신 의무 (WBS §5 Devil's Advocate Ledger)
--
-- 근거:
--   - docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md
--   - 진산님 메모리 project_source_citation_requirement (수험자 근거 UX 1급 기능)
--   - 진산님 메모리 project_v3_final_multi_exam_deferred (Year 1 9테이블 유지 — 컬럼 추가 OK, 테이블 추가 X)
--   - .jjokjipge/handoff-session-038.md §주의사항 (0019 conflict 해결)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- PART 1: 4 신규 컬럼 추가
-- ============================================================
-- SQLite ALTER TABLE ADD COLUMN 제약: NOT NULL 불가 (DEFAULT 없으면).
-- → NULLABLE 로 추가 + 별도 트리거로 INSERT 시 NOT NULL 강제 (0018 패턴 정합).

ALTER TABLE knowledge_nodes ADD COLUMN book_page INTEGER;   -- 사용자 노출용 본문 페이지 (예: 415)
ALTER TABLE knowledge_nodes ADD COLUMN pdf_page  INTEGER;   -- PDF 페이지 (추적용, 예: 422)
ALTER TABLE knowledge_nodes ADD COLUMN chapter   TEXT;      -- 예: "제1장 농업재해보험 손해평가 개관" (NULL 허용 — 법령 노드)
ALTER TABLE knowledge_nodes ADD COLUMN section   TEXT;      -- 예: "제3절 현지조사 내용" (NULL 허용)

-- ============================================================
-- PART 2: NOT NULL 강제 트리거 (신규 INSERT 만 — 0018 패턴)
-- ============================================================
-- chapter / section 은 NULL 허용 (법령 노드 LAW-NNN 등 챕터 개념 없음).
-- book_page / pdf_page 는 모든 노드 필수 (출처 추적성 강화).

CREATE TRIGGER IF NOT EXISTS enforce_book_page_on_insert
BEFORE INSERT ON knowledge_nodes
WHEN NEW.book_page IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ADR-030 violation: knowledge_nodes INSERT requires book_page (사용자 노출용 본문 페이지). 출처 추적성 의무.');
END;

CREATE TRIGGER IF NOT EXISTS enforce_pdf_page_on_insert
BEFORE INSERT ON knowledge_nodes
WHEN NEW.pdf_page IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ADR-030 violation: knowledge_nodes INSERT requires pdf_page (PDF 추적용). 검수 단계 PDF 직접 검증 필수.');
END;

-- ============================================================
-- PART 3: 인덱스 2개
-- ============================================================
-- idx_nodes_book_page — page 범위 쿼리 ("본문 p.400~430 노드 모두 보기") + 사용자 검색
-- idx_nodes_chapter   — chapter 그룹 쿼리 ("제1장 노드 모두 보기")

CREATE INDEX IF NOT EXISTS idx_nodes_book_page ON knowledge_nodes(book_page);
CREATE INDEX IF NOT EXISTS idx_nodes_chapter ON knowledge_nodes(chapter);

-- ============================================================
-- 검증 SQL (적용 후 진산님 직접 확인 가능)
-- ============================================================
-- 1. 신규 컬럼 4개 등록 확인
--    PRAGMA table_info(knowledge_nodes);
--    기대: book_page (INTEGER) + pdf_page (INTEGER) + chapter (TEXT) + section (TEXT) 4 row 추가
--
-- 2. 트리거 2개 등록 확인
--    SELECT name FROM sqlite_master WHERE type='trigger'
--      AND name IN ('enforce_book_page_on_insert', 'enforce_pdf_page_on_insert');
--    기대: 2 row
--
-- 3. 인덱스 2개 등록 확인
--    SELECT name FROM sqlite_master WHERE type='index'
--      AND name IN ('idx_nodes_book_page', 'idx_nodes_chapter');
--    기대: 2 row
--
-- 4. book_page NULL INSERT 차단 (smoke test)
--    INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year)
--      VALUES ('TEST-001', 'CONCEPT', 'test', 'p.1', 2026);
--    기대: RAISE ABORT — book_page NOT NULL 위반
--
-- 5. pdf_page NULL INSERT 차단 (smoke test)
--    INSERT INTO knowledge_nodes (id, type, name, page_ref, book_page, version_year)
--      VALUES ('TEST-002', 'CONCEPT', 'test', 'p.1', 415, 2026);
--    기대: RAISE ABORT — pdf_page NOT NULL 위반
--
-- 6. 정상 INSERT — PASS
--    INSERT INTO knowledge_nodes (id, type, name, page_ref, book_page, pdf_page, chapter, section, version_year, status)
--      VALUES ('TEST-003', 'CONCEPT', 'test', '본문 p.415 / 제1장 제3절', 415, 422,
--              '제1장 농업재해보험 손해평가 개관', '제3절 현지조사 내용', 2026, 'draft');
--    기대: PASS (status=draft + page_ref 있음 + book_page + pdf_page 모두 충족)
--
-- 7. 기존 row 호환 — 0019 적용 시점 기존 row 의 book_page/pdf_page/chapter/section 모두 NULL.
--    트리거가 신규 INSERT 만 차단하므로 영향 0. admin-web /telemetry 등에서 NULL 처리 의무.
--
-- ============================================================
-- 롤백 절차 (down script — 비상시만)
-- ============================================================
-- DROP INDEX IF EXISTS idx_nodes_book_page;
-- DROP INDEX IF EXISTS idx_nodes_chapter;
-- DROP TRIGGER IF EXISTS enforce_book_page_on_insert;
-- DROP TRIGGER IF EXISTS enforce_pdf_page_on_insert;
-- 주의: SQLite ALTER TABLE DROP COLUMN 은 3.35.0+ 부터 지원. Cloudflare D1 (SQLite 3.x) 호환 검증 의무.
-- 만약 DROP COLUMN 미지원 시 컬럼은 그대로 두고 트리거 + 인덱스만 제거 (호환성 유지).
