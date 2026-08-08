-- ============================================================
-- Migration 0047: source_quote 축 — "카드는 자기 근거 문장을 들고 있어야 한다"
-- ============================================================
-- STATUS: 선작성본 — **production 적용(wrangler --remote) 미승인**.
--   승인 범위 = SQL 작성·로컬 검증까지 (진산 2026-08-08 "stage 2 진행" = 대시보드 §A #7).
--   적용 + 59장 백필 실행은 별도 인증 게이트 (0038/0044/0045 선례) → 대시보드 §A 재상신.
--
-- plan : docs/plans/current.plan.md (역이식 STAGE 2)
-- 근거 : docs/plans/catchall-역이식-분석-20260806.md §T1-1 ("전부의 관문")
-- 체크 : docs/plans/catchall-역이식-체크리스트.md STAGE 2 (2-1·2-2·2-3)
--
-- ── 무엇을 여는가 ─────────────────────────────────────────────────────────────
-- 지금 노드의 출처는 전부 **포인터**다(page_ref·book_page·source_url). 그래서 "이 카드가 맞나"를
-- 확인하는 유일한 경로가 **사람이 PDF 를 여는 것**이고, 그것이 이 프로젝트의 결재 병목 원인이다.
-- `source_quote` = 그 카드의 근거가 된 **원문 문장 그 자체**. 이게 있어야 STAGE 3 의 검사기
-- (인용 진위·앵커 충분성·값 정합)가 **대조할 대상**을 갖는다. 없으면 검사할 것이 없다.
--
-- ── 세 반 ────────────────────────────────────────────────────────────────────
--   [1] 칸 신설      — knowledge_nodes / formulas / constants 에 source_quote TEXT
--   [2] 백필 규율    — 0041 패턴 그대로 "NULL→값 1회" 화이트리스트 편입
--   [3] 적재 의무화  — **배치 적재분**(batch_id 선언)은 원문 없이 INSERT 불가 (공백도 거부)
--
-- ★[2]가 [1]과 **같은 마이그**에 있어야 하는 이유: 새 컬럼은 기존 `prevent_*_update` 가드의
--   WHEN 절에 **존재하지 않는다** → 칸만 만들고 가드를 미루면 그 사이 값→값 UPDATE 가 **무음 통과**한다.
--   0041 이 정확히 그 구멍을 겪었다(독립 리뷰 wf_83d2aa9a MAJOR: "선재 0019 구멍" 주석 참조).
--
-- ── [3]의 적용 범위 (설계 결정 — plan §설계 결정 ①) ──────────────────────────
-- 체크리스트 완료 판정은 "원문 없이 넣으려 하면 거부 / **공백만 넣어도 거부**" = INSERT 게이트다.
-- 그러나 무조건 걸면 `INSERT INTO knowledge_nodes` 표면 **21곳**(테스트 픽스처 다수)이 전부 깨진다.
-- ⇒ **`batch_id IS NOT NULL` 인 행에만** 강제한다.
--   · 체크리스트 문면이 이미 **"새로 적재하는 *서식*"** 으로 범위를 한정하고 있다.
--   · `batch_id` 는 "이 행은 배치 적재분"이라는 **행 스스로의 선언**이고, 실측상 적재 경로
--     (`apps/batch/src/loader/draft-loader.ts:317`, `docs/batch-load/gap-P*-insert.sql` = 'BATCH-GAP-P1')는
--     **항상** 채우며 테스트 픽스처는 **한 곳도** 쓰지 않는다(전수 grep). 의미와 실측이 같은 선을 긋는다.
--   ⚠️ **막지 않는 것(정직 기록)**: batch_id 없는 수기 INSERT·테스트·마이그레이션은 게이트 밖이다.
--      구멍이 아니라 **의도된 경계**다 — 적재 서식 강제이지 전역 NOT NULL 이 아니다.
--      전역화는 기존 857 행 백필(2-4) 완료가 선행이며, 그것이 STAGE 3 의 진입 조건이다.
--   ⚠️ **formulas/constants 는 [3] 제외**: 두 테이블에 `batch_id` 류 적재 선언 컬럼이 **없다**
--      (schema 실측). 칸[1]과 백필 규율[2]은 걸되 적재 의무화는 별건 이월
--      (분석 §T1-1 이 이 축을 "WS-3c variant 24 교재 대조 큐"로 별도 지목).
--
-- ── source_quote 에 무엇을 넣는가 (백필 규약 — 어기면 STAGE 3 가 공허해진다) ──
--   · **원문 축자**(verbatim)여야 한다. `description` 복사 금지 — 실측상 description 은 요약·편집본이다
--     (예: LAW-144 는 조문을 재구성하고 "(법령 원문 기준 — … CROSS_REF.)" 편집 주석까지 붙어 있다).
--     복사하면 "원문 대조"가 자기 자신 대조가 되어 검사기가 항상 통과한다.
--   · **조문/문단 단위로 끊어서** 넣는다. catchall 이 W1 에서 실증했듯 1.2MB 전문을 통째로 넣으면
--     바이그램 풀이 포화해 **접합 인용이 coverage 1.0 으로 통과**한다 — 청크는 성능이 아니라 정확성 요건이다.
--   · **LLM 생성 금지.** 결정론 추출(pdfplumber)만. 원문은 언제든 PDF 로 재현 가능해야 한다.
--
-- 데이터 변경 0 (DDL only). 기존 행의 source_quote 는 전부 NULL 로 시작 → 오늘자 행위 변화 0.
-- 적용 시점 실측치는 마이그 본문이 아니라 적용 원장(.claude/reports/production-migration-status.md)에 기록한다.
-- ============================================================

-- ============================================================
-- [1] 칸 신설
-- ============================================================
ALTER TABLE knowledge_nodes ADD COLUMN source_quote TEXT;
ALTER TABLE formulas        ADD COLUMN source_quote TEXT;
ALTER TABLE constants       ADD COLUMN source_quote TEXT;

-- ============================================================
-- [2] 백필 규율 — 0041 가드 재구축 + source_quote 화이트리스트 편입
-- ============================================================
-- ★재구축 원칙: 0041 본문을 **문자 그대로 보존**하고 source_quote 절 1줄만 추가한다.
--   (재생성은 그 자체가 회귀 표면 — 0046 [C-1] 과 같은 규율. 시나리오 테스트가 기존 화이트리스트
--    무회귀를 고정한다: G-S2-5.)

DROP TRIGGER IF EXISTS prevent_knowledge_nodes_update;
CREATE TRIGGER prevent_knowledge_nodes_update
BEFORE UPDATE ON knowledge_nodes
WHEN NEW.id IS NOT OLD.id
  OR NEW.type IS NOT OLD.type
  OR NEW.name IS NOT OLD.name
  OR NEW.description IS NOT OLD.description
  OR NEW.lv1_insurance IS NOT OLD.lv1_insurance
  OR NEW.lv2_crop IS NOT OLD.lv2_crop
  OR NEW.lv3_investigation IS NOT OLD.lv3_investigation
  OR NEW.page_ref IS NOT OLD.page_ref
  OR NEW.batch_id IS NOT OLD.batch_id
  OR NEW.version_year IS NOT OLD.version_year
  OR NEW.superseded_by IS NOT OLD.superseded_by
  OR NEW.truth_weight IS NOT OLD.truth_weight
  OR NEW.status IS NOT OLD.status
  OR NEW.exam_scope IS NOT OLD.exam_scope
  OR NEW.book_page IS NOT OLD.book_page
  OR NEW.pdf_page IS NOT OLD.pdf_page
  OR NEW.chapter IS NOT OLD.chapter
  OR NEW.section IS NOT OLD.section
  OR NEW.created_at IS NOT OLD.created_at
  -- 0016 backfill 예외: NULL → 값 1회 허용. 값 → 다른 값 / 값 → NULL 차단.
  OR (OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id)
  OR (OLD.source_id    IS NOT NULL AND NEW.source_id    IS NOT OLD.source_id)
  -- 0041: 시행시점 축·출처 앵커 — 동일 백필 패턴 (Phase 2 backfill = NULL→값 1회, 이후 불변)
  OR (OLD.valid_from          IS NOT NULL AND NEW.valid_from          IS NOT OLD.valid_from)
  OR (OLD.valid_until         IS NOT NULL AND NEW.valid_until         IS NOT OLD.valid_until)
  OR (OLD.source_url          IS NOT NULL AND NEW.source_url          IS NOT OLD.source_url)
  OR (OLD.source_article_code IS NOT NULL AND NEW.source_article_code IS NOT OLD.source_article_code)
  -- 0047: 원문 인용 축 — 동일 백필 패턴. 한 번 채워진 인용은 **불변**이어야 한다
  --   (사후 수정 가능하면 "원문 대조"가 원문을 고쳐 통과시키는 경로가 된다).
  OR (OLD.source_quote        IS NOT NULL AND NEW.source_quote        IS NOT OLD.source_quote)
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on knowledge_nodes body columns is forbidden (Hard Rule 1, Temporal Graph). Use INSERT + SUPERSEDES edge pattern. Only is_current_active flip and (batch_run_id/source_id/valid_from/valid_until/source_url/source_article_code/source_quote) NULL->value backfill (1회) allowed.');
END;

DROP TRIGGER IF EXISTS prevent_formulas_update;
CREATE TRIGGER prevent_formulas_update
BEFORE UPDATE ON formulas
WHEN NEW.id IS NOT OLD.id
  OR NEW.name IS NOT OLD.name
  OR NEW.equation_template IS NOT OLD.equation_template
  OR NEW.equation_display IS NOT OLD.equation_display
  OR NEW.variables_schema IS NOT OLD.variables_schema
  OR NEW.constraints IS NOT OLD.constraints
  OR NEW.expected_inputs IS NOT OLD.expected_inputs
  OR NEW.graceful_degradation IS NOT OLD.graceful_degradation
  OR NEW.page_ref IS NOT OLD.page_ref
  OR NEW.node_id IS NOT OLD.node_id
  OR NEW.version_year IS NOT OLD.version_year
  OR NEW.superseded_by IS NOT OLD.superseded_by
  OR (OLD.valid_from  IS NOT NULL AND NEW.valid_from  IS NOT OLD.valid_from)
  OR (OLD.valid_until IS NOT NULL AND NEW.valid_until IS NOT OLD.valid_until)
  OR (OLD.source_quote IS NOT NULL AND NEW.source_quote IS NOT OLD.source_quote)
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on formulas body columns is forbidden (Hard Rule 1/2, Temporal Graph). Use INSERT new formula with superseded_by set. Only is_current_active and valid_from/valid_until/source_quote NULL->value backfill (1회) may change.');
END;

DROP TRIGGER IF EXISTS prevent_constants_update;
CREATE TRIGGER prevent_constants_update
BEFORE UPDATE ON constants
WHEN NEW.id IS NOT OLD.id
  OR NEW.category IS NOT OLD.category
  OR NEW.name IS NOT OLD.name
  OR NEW.value IS NOT OLD.value
  OR NEW.numeric_value IS NOT OLD.numeric_value
  OR NEW.applies_to IS NOT OLD.applies_to
  OR NEW.insurance_type IS NOT OLD.insurance_type
  OR NEW.confusion_risk IS NOT OLD.confusion_risk
  OR NEW.confusion_level IS NOT OLD.confusion_level
  OR NEW.unit IS NOT OLD.unit
  OR NEW.page_ref IS NOT OLD.page_ref
  OR NEW.version_year IS NOT OLD.version_year
  OR NEW.exam_frequency IS NOT OLD.exam_frequency
  OR NEW.related_formula IS NOT OLD.related_formula
  OR NEW.exam_scope IS NOT OLD.exam_scope
  OR NEW.superseded_by IS NOT OLD.superseded_by
  OR (OLD.valid_from  IS NOT NULL AND NEW.valid_from  IS NOT OLD.valid_from)
  OR (OLD.valid_until IS NOT NULL AND NEW.valid_until IS NOT OLD.valid_until)
  OR (OLD.source_quote IS NOT NULL AND NEW.source_quote IS NOT OLD.source_quote)
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on constants body columns is forbidden (Hard Rule 2, Temporal Graph). Use INSERT new constant with superseded_by set. Only is_current_active and valid_from/valid_until/source_quote NULL->value backfill (1회) may change.');
END;

-- ============================================================
-- [3] 적재 의무화 — 배치 적재분(batch_id 선언)은 원문 없이 INSERT 불가
-- ============================================================
-- 공백 거부가 핵심이다: 빈 문자열·공백만 채우는 것이 "채웠다"의 가장 흔한 위조 형태다.
-- ★독립 리뷰 MAJOR 처분: 초판은 ASCII 4종(space·tab·LF·CR)만 지웠다. 그런데
--   **전각 공백(U+3000)·NBSP(U+00A0)는 한국어 법령 PDF 추출에서 비적대적으로 흔히 나오고**,
--   ZWSP(U+200B)·BOM(U+FEFF)·vtab(char(11))·FF(char(12))도 실측상 전부 통과했다(10/10).
--   즉 "보이지 않는 문자만 채운 값"이 원문 행세를 했다. trim 집합을 유니코드까지 확장한다.
--   (완전 방어는 아니다 — '.' 한 글자는 여전히 통과한다. 그건 §"막지 않는 것 ③" 의 영역이다.)
DROP TRIGGER IF EXISTS require_source_quote_on_batch_load;
CREATE TRIGGER require_source_quote_on_batch_load
BEFORE INSERT ON knowledge_nodes
WHEN NEW.batch_id IS NOT NULL
  AND (
       NEW.source_quote IS NULL
    OR trim(
         NEW.source_quote,
         ' ' || char(9) || char(10) || char(11) || char(12) || char(13)
             || char(133)    -- U+0085 NEL
             || char(160)    -- U+00A0 NBSP
             || char(173)    -- U+00AD soft hyphen
             || char(8203)   -- U+200B ZWSP
             || char(8206)   -- U+200E LRM
             || char(8199)   -- U+2007 figure space
             || char(12288)  -- U+3000 ideographic space (한국어 문서에서 가장 흔하다)
             || char(65279)  -- U+FEFF BOM
       ) = ''
  )
BEGIN
  SELECT RAISE(ABORT, 'Batch load blocked: knowledge_nodes rows carrying a batch_id must include a non-blank source_quote (the verbatim sentence the card is based on). Copying description is not acceptable — extract the original text. See docs/plans/current.plan.md (STAGE 2).');
END;

-- ============================================================
-- 본 마이그가 **막지 않는 것** (정직 기록)
-- ============================================================
-- ① batch_id 없는 INSERT (테스트 픽스처·수기 SQL·마이그레이션) — [3]의 **의도된 경계**.
--    전역 강제는 기존 857 행 백필 완료 후에만 가능하며, 그것이 STAGE 3 진입 조건이다.
-- ② formulas/constants 의 적재 의무화 — 적재 선언 컬럼 부재로 범위를 그을 수 없다(별건 이월).
-- ③ **인용의 진위** — 이 마이그는 "칸이 비어 있지 않은가"만 본다. 그 문자열이 **실제 원문인지**는
--    STAGE 3 검사기(G3 인용 진위·L3-A 앵커 충분성)의 몫이다. 여기서 PASS = 검증됨이 아니다.
-- ④ **description 복사** — SQL 로는 "요약인지 축자인지"를 판정할 수 없다. 백필 스크립트가
--    동일성 검사(quote == description → fail-loud)로 잡고, 최종 방어선은 검수와 STAGE 3 다.
--
-- ============================================================
-- down (수동 롤백):
--   SQLite 는 ALTER TABLE DROP COLUMN 을 이 스키마 형태에서 안전하게 지원하지 않는다
--   (테이블 재작성 = 트리거·인덱스·FK 재구축 위험). **컬럼은 NULL 로 잔류시켜도 무해**하다.
--   되돌릴 것은 규율뿐:
--     DROP TRIGGER IF EXISTS require_source_quote_on_batch_load;
--     -- prevent_{knowledge_nodes,formulas,constants}_update 는 **0041 판본으로 재실행**
--     --   (그냥 DROP 하면 본문 UPDATE 가 전면 무방비가 된다 — 0046 down 과 같은 함정)
--   ⚠️ 롤백 후에도 이미 채워진 source_quote 값은 남는다. 값→값 UPDATE 는 0041 판본에서
--      **무음 통과**하므로(컬럼 미등재), 롤백 상태에서는 인용 위조가 가능해진다 — 기록해 둔다.
-- ============================================================
