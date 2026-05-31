-- ============================================================
-- 쪽집게 — related_nodes 백필 (S5-6b pilot golden, 손해평가 도메인 7건)
--
-- ⚠️ STATUS: 검토용 초안 (REVIEW-ONLY · 미실행). L3 production exam_questions UPDATE.
--   Claude 자율 실행 금지(handoff-095 §주의사항). 본 파일은 진산 Cloudflare 인증
--   세션에서 검토 후 직접 실행하는 런북이다. 실행 = 게이트 #3.
--   ★ 독립 4-렌즈 적대 검증 반영(2026-05-31): CRITICAL 1 + MAJOR 6 해소
--     (id-기준 일원화 / status·superseded_by 노출 / RETURNING / 멱등 안전망).
--
-- 목적 (TR-0 동기): production exam_questions 545 기출 전부 related_nodes NULL →
--   골든 라벨 미존재. 본 백필은 진산 검수 동결분(golden-pilot-approved.json)의
--   measurable 7건 related_nodes 를 채워 학습자 study 경로(enrichRelatedNodes)에
--   근거 노드가 노출되게 하고, 골든 라벨을 DB 에도 영속한다.
--
-- 소스: docs/plans/s5-6-measurements/golden-pilot-approved.json
--   (✅ 진산 검수 2026-05-30, APPROVE 7 + FIX 5 / REJECT 0 / 순환위반 0,
--    추가·제거 노드 전부 코퍼스 488 실재 검증 = FK 검증 완료, fabricate 0)
--   값 = 각 item 의 relatedNodesRaw 문자열 그대로(문자 단위 일치 검증 완료).
--
-- 범위 (N=12 워터마크): measurable 7건만 백필. unmeasurable 5건(relatedNodesRaw=null,
--   손해평가 코퍼스 외 도메인)은 NULL 유지 = 측정 분모 제외(정직). 나머지 538 기출은
--   Phase B/C(545 전수 BATCH + 공식 해설집 조사) 별도 결재까지 NULL 유지.
--   ※ 학습자 경로: study 가 related_nodes NULL 을 graceful 처리하는지 별도 확인 권고
--     (7/545 비대칭 = 의도된 pilot 범위).
--
-- ★ G-S5 측정과의 관계: measure-s5-6-multihop-accuracy.ts 의 runner 는 golden
--   *파일*의 relatedNodesRaw 를 expected 로 직접 읽고(runRemote line 96~112, 검증 완료),
--   채점 대상은 `/api/search/graph` 의 vector+graph-walk 결과뿐 — exam_questions.related_nodes
--   (DB) 미참조. ⇒ 본 DB 백필은 G-S5 측정의 *선결 조건이 아니다*. 본 백필은 학습자 경로
--   데이터 정합(TR-0 본래 목적)을 위한 별개 작업이다.
--   측정 자체의 선결조건(백필과 무관, 별도 충족): (1) golden-pilot-approved.json 존재
--   (2) THEPICK_API_BASE=<배포 Worker URL> env (3) 배포 Worker /api/search/graph 정상
--   (vector+graph-walk full path). 미충족 시 runner 의 assertRemoteMeasurementInputs 가
--   비측정 종료(수치 fabricate 차단).
--
-- ============================================================
-- 선결 조건 (반드시 순서 준수)
-- ============================================================
--   (1) ⛔ 마이그 0038 (prevent_exam_questions_body_update) 가 production 에 *먼저*
--       적용돼 있어야 함. 미적용 시 0004 의 prevent_exam_questions_update 가
--       모든 UPDATE 를 ABORT → 본 백필 전량 실패.
--         wrangler d1 execute thepick-db-production --remote \
--           --file=migrations/0038_exam_questions_metadata_update_allow.sql
--   (2) 트리거 정합: 본 백필은 related_nodes 만 SET → 0038 WHEN 절(보호 16컬럼,
--       0038:44~61)에 related_nodes 부재 → ABORT 미발동(G-TR0-1 PASS). created_at
--       등 타 컬럼 무변경(스키마에 updated_at 부재 — UPDATE 부수효과 0).
--   (3) ⛔ STEP 0(식별 SELECT) 를 *반드시 먼저* 실행해 7 타깃이 각각 정확히 1행
--       (현행·status/superseded_by 확인)으로 해소되는지 육안 대조한 뒤에만 STEP 1 진행.
--       (이것이 over-update/no-op 의 1차 게이트. SQL 자동 중단 없음 = 사람 게이트.)
--   (4) 멱등성·원자성: 각 UPDATE 는 고정값 SET 이므로 멱등(재실행 안전). D1 의
--       `execute --file` 트랜잭션 원자성은 벤더 동작 의존이므로, **STEP 2 사후검증을
--       최종 진실원**으로 삼는다(부분 적용 시 STEP 1 재실행 → STEP 2 7행 확인).
--       changes() 대신 RETURNING 으로 행별 반영을 직접 확인한다(D1 HTTP 배치에서
--       changes() 스코프 불신뢰 — 적대검증 CRITICAL 반영).
-- ============================================================

PRAGMA foreign_keys = ON;


-- ============================================================
-- STEP 0 — 식별·검증 SELECT (⛔ 먼저 실행, 결과 육안 대조)
--   같은 (year,round,question_number) 좌표에 (a) 1차 과목 간 충돌(농어업재해보험법령
--   q31 vs 상법 q31), (b) 2025/11회 1차 q4 ↔ 2차 q4 충돌, (c) Temporal Graph
--   superseded 사본 공존이 가능하다. 좌표로 모든 후보 행을 노출해 진산이 *현행 정답
--   행(id)* 을 확정한다. status='active' & superseded_by IS NULL 인 행이 현행
--   (exam_questions.status enum = active/deprecated/flagged, default 'active' —
--    knowledge_nodes 의 approved/draft 와 도메인 다름. schema.ts:343 확인).
--   content_head 를 골든 content 첫 줄과 대조할 것.
-- ============================================================
SELECT
  id,
  exam_type,
  year,
  round,
  question_number,
  subject,
  status,                              -- 현행 판별 (현행 = 'active')
  superseded_by,                       -- 현행 판별 (현행 = NULL)
  substr(content, 1, 80) AS content_head,
  related_nodes          AS current_related_nodes
FROM exam_questions
WHERE (year = 2019 AND round = 5  AND question_number = 31)   -- → 농어업재해보험법령, ["LAW-002"]
   OR (year = 2022 AND round = 8  AND question_number = 45)   -- → 농어업재해보험법령, ["LAW-003"]
   OR (year = 2023 AND round = 9  AND question_number = 45)   -- → 농어업재해보험법령, ["LAW-004"]
   OR (year = 2025 AND round = 11 AND question_number IN (4, 12, 14, 15))  -- → 2차(2nd)
ORDER BY year, round, exam_type, question_number, status;

-- 기대 대조표 (골든 메타) — STEP 0 결과에서 아래 7개 *현행 행*의 id 를 확정해 STEP 1 에 기입:
--   exam_type | year | round | q  | subject(골든)        | 백필 related_nodes
--   ----------+------+-------+----+----------------------+------------------------------------------------
--   1st_subN  | 2019 |   5   | 31 | 농어업재해보험법령    | ["LAW-002"]   (approximateGolden — 근사 라벨)
--   1st_subN  | 2022 |   8   | 45 | 농어업재해보험법령    | ["LAW-003"]
--   1st_subN  | 2023 |   9   | 45 | 농어업재해보험법령    | ["LAW-004"]
--   2nd       | 2025 |  11   |  4 | 1과목 (이론)         | ["CONCEPT-080"]   (partial — 단일 anchor)
--   2nd       | 2025 |  11   | 12 | 2과목 (손해평가)     | ["INS-08", "INV-035", "CROP-018", "CROP-019", "CROP-020"]
--   2nd       | 2025 |  11   | 14 | 2과목 (손해평가)     | ["INS-21", "INV-060", "CROP-028", "CROP-038", "CROP-035", "TERM-037", "TERM-038"]
--   2nd       | 2025 |  11   | 15 | 2과목 (손해평가)     | ["F-103", "CONCEPT-023", "INS-27"]
--
-- ⛔ 게이트: 위 7 좌표가 각각 *현행 행(status='active' & superseded_by NULL) 정확히 1개* 로
--    해소되는지 확인. 한 좌표에 현행 행이 2개+ 이면 즉시 중단·조사(복수정답/사본 의심).
-- ※ JSON 공백 포맷은 무관(파서가 JSON.parse — multihop-accuracy.ts:51~66 / study
--    enrichRelatedNodes 파싱 술어 동치). 값은 골든 relatedNodesRaw 와 동일하게 유지.


-- ============================================================
-- STEP 1 — 백필 UPDATE (★ 7건 전부 PK id 기준 — 가장 안전)
--   id(PK)는 단일 행 보장 → status/exam_type/subject/복수물음/좌표충돌 모호성 일괄 제거.
--   <PASTE_ID_*> 를 STEP 0 에서 확정한 *현행 행*의 실제 id 로 치환 후 실행.
--   각 UPDATE 는 RETURNING 으로 반영 행을 직접 출력(0행=치환오류/미매칭, 2행+=불가능).
-- ============================================================

-- 1차 3건 (농어업재해보험법령)
UPDATE exam_questions SET related_nodes = '["LAW-002"]'
WHERE id = '<PASTE_ID_2019_05_31>'
RETURNING id, exam_type, year, round, question_number, related_nodes;

UPDATE exam_questions SET related_nodes = '["LAW-003"]'
WHERE id = '<PASTE_ID_2022_08_45>'
RETURNING id, exam_type, year, round, question_number, related_nodes;

UPDATE exam_questions SET related_nodes = '["LAW-004"]'
WHERE id = '<PASTE_ID_2023_09_45>'
RETURNING id, exam_type, year, round, question_number, related_nodes;

-- 2차 4건 (2025 제11회)
UPDATE exam_questions SET related_nodes = '["CONCEPT-080"]'
WHERE id = '<PASTE_ID_2025_11_2ND_04>'
RETURNING id, exam_type, year, round, question_number, related_nodes;

UPDATE exam_questions SET related_nodes = '["INS-08", "INV-035", "CROP-018", "CROP-019", "CROP-020"]'
WHERE id = '<PASTE_ID_2025_11_2ND_12>'
RETURNING id, exam_type, year, round, question_number, related_nodes;

UPDATE exam_questions SET related_nodes = '["INS-21", "INV-060", "CROP-028", "CROP-038", "CROP-035", "TERM-037", "TERM-038"]'
WHERE id = '<PASTE_ID_2025_11_2ND_14>'
RETURNING id, exam_type, year, round, question_number, related_nodes;

UPDATE exam_questions SET related_nodes = '["F-103", "CONCEPT-023", "INS-27"]'
WHERE id = '<PASTE_ID_2025_11_2ND_15>'
RETURNING id, exam_type, year, round, question_number, related_nodes;


-- ------------------------------------------------------------
-- STEP 1-ALT (선택) — 2차 4건 복합키 (수동 id 불요, STEP 0 가 각 좌표 현행 1행임을
--   확인한 경우에만). superseded_by IS NULL 가드로 구버전 사본 제외. 위 id-기준과
--   택일(둘 다 실행 금지 — 멱등하므로 동일 결과지만 혼란 방지).
-- ------------------------------------------------------------
-- UPDATE exam_questions SET related_nodes = '["CONCEPT-080"]'
-- WHERE exam_type='2nd' AND year=2025 AND round=11 AND question_number=4  AND status='active' AND superseded_by IS NULL
-- RETURNING id, question_number, related_nodes;
-- UPDATE exam_questions SET related_nodes = '["INS-08", "INV-035", "CROP-018", "CROP-019", "CROP-020"]'
-- WHERE exam_type='2nd' AND year=2025 AND round=11 AND question_number=12 AND status='active' AND superseded_by IS NULL
-- RETURNING id, question_number, related_nodes;
-- UPDATE exam_questions SET related_nodes = '["INS-21", "INV-060", "CROP-028", "CROP-038", "CROP-035", "TERM-037", "TERM-038"]'
-- WHERE exam_type='2nd' AND year=2025 AND round=11 AND question_number=14 AND status='active' AND superseded_by IS NULL
-- RETURNING id, question_number, related_nodes;
-- UPDATE exam_questions SET related_nodes = '["F-103", "CONCEPT-023", "INS-27"]'
-- WHERE exam_type='2nd' AND year=2025 AND round=11 AND question_number=15 AND status='active' AND superseded_by IS NULL
-- RETURNING id, question_number, related_nodes;


-- ============================================================
-- STEP 2 — 사후 검증 SELECT (★ 최종 진실원: 백필 7건 = 7행, NULL 0건)
--   STEP 1 에서 사용한 7개 id 를 그대로 기입(좌표/NULL 의존 제거 — 재실행에도 신뢰).
-- ============================================================
SELECT id, exam_type, year, round, question_number, subject, status, related_nodes
FROM exam_questions
WHERE id IN (
  '<PASTE_ID_2019_05_31>',
  '<PASTE_ID_2022_08_45>',
  '<PASTE_ID_2023_09_45>',
  '<PASTE_ID_2025_11_2ND_04>',
  '<PASTE_ID_2025_11_2ND_12>',
  '<PASTE_ID_2025_11_2ND_14>',
  '<PASTE_ID_2025_11_2ND_15>'
)
ORDER BY year, round, exam_type, question_number;
-- 기대: 7행, related_nodes 전부 위 대조표와 일치(NULL 0건). 불일치 = STEP 1 재실행(멱등).


-- ============================================================
-- 롤백 (비상시 — pilot 7건을 다시 NULL 로)
--   STEP 1 에서 사용한 *동일 7개 id*. related_nodes 단독 변경이므로 트리거 ABORT 미발동.
-- ============================================================
-- UPDATE exam_questions SET related_nodes = NULL
-- WHERE id IN (
--   '<PASTE_ID_2019_05_31>', '<PASTE_ID_2022_08_45>', '<PASTE_ID_2023_09_45>',
--   '<PASTE_ID_2025_11_2ND_04>', '<PASTE_ID_2025_11_2ND_12>',
--   '<PASTE_ID_2025_11_2ND_14>', '<PASTE_ID_2025_11_2ND_15>'
-- )
-- RETURNING id, related_nodes;
