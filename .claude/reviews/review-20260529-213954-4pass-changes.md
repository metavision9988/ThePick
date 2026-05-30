# 4-Pass 리뷰 보고서 — TR-0 마이그 0038 (exam_questions 메타데이터 UPDATE 화이트리스트)

- 타임스탬프: `20260529-213954`
- 리뷰 대상: `prevent_exam_questions_update` 전면 ABORT 트리거 → `prevent_exam_questions_body_update` default-deny 컬럼 화이트리스트 재설계
- 프로토콜: `.claude/rules/auto-review-protocol.md` 4-Pass

---

## 리뷰 범위 (스코프)

### 변경 파일 (changed, 2건, untracked)

- `/home/soo/ClaudePro/ThePick/migrations/0038_exam_questions_metadata_update_allow.sql`
- `/home/soo/ClaudePro/ThePick/apps/api/src/__tests__/scenarios/migration-0038-metadata-update.test.ts`

### 연관 파일 (related, 6건)

- `/home/soo/ClaudePro/ThePick/docs/adr/ADR-046-exam-questions-metadata-update-policy.md`
- `/home/soo/ClaudePro/ThePick/docs/plans/tr-0-backend-c7-trigger-redesign.plan.md`
- `/home/soo/ClaudePro/ThePick/apps/api/src/db/schema.ts`
- `/home/soo/ClaudePro/ThePick/migrations/0004_temporal_guard_extension.sql`
- `/home/soo/ClaudePro/ThePick/migrations/0010_status_transitions_and_page_ref_guard.sql`
- `/home/soo/ClaudePro/ThePick/apps/api/src/__tests__/helpers/d1-from-sqlite.ts`

### 변경 요약

변경 집합은 신규(untracked) 2파일: migration 0038 SQL과 그 시나리오 테스트. 0038은 0004의
전면 ABORT 트리거(`prevent_exam_questions_update`)를 DROP하고, default-deny 방식의
`prevent_exam_questions_body_update`를 신설한다 — WHEN 절에 보호 16컬럼(본문8+상태4+
답안안전2+불변2)을 `IS NOT`(NULL-safe distinct)로 enumerate해 ABORT, 화이트리스트 6컬럼
(`related_nodes`/`related_constants`/`topic_cluster`/`memorization_type`/`confusion_type`/
`input_type`)은 WHEN 미포함이라 허용한다. 16+6=22가 schema.ts:319-345 exam_questions 22컬럼과
정확히 1:1 일치(누락/중복 없음). 테스트는 G-TR0-1~12 게이트를 `it.each`로 22컬럼 전수(보호 16
ABORT + 화이트리스트 6 허용) + 혼합/멀티행 원자성/NULL-safe/트리거 교체를 커버하며,
`createD1FromAllMigrations()`(readdir 자동 로더, 0038 자동 포함)를 사용해 SCENARIO_MIGRATIONS
큐레이션 배열 누락 위양성을 차단한다. production 적용은 진산 wrangler 인증 게이트로 미수행 —
리뷰 대상은 작성된 SQL+테스트 정합성.

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 2개 + 연관 파일 6개 (상기 목록)

### Pass 1 (Surgeon): ✅ 10건 확인 / 🔴 0건 / 🟠 0건 / N/A 1건

확인 (실제로 확인한 것, 파일:라인):

- PASS Null/Undefined — migration-0038 test 의 모든 결과 접근이 옵셔널 체이닝: `row?.v`(test:127),
  `row?.rn`/`row?.c`(test:144-145), `row?.rn`(test:178), `before?.c`/`after?.c`(test:191).
  D1 `.first()` 가 null 반환해도 크래시 경로 없음. 0038 자체는 순수 DDL 로 런타임 null 반환값 없음.
- PASS Async/await — test 의 D1 호출 전부 await: `backend.db...run()`(test:99,107,115,122,168,172,188),
  `.first()`(test:86-90,123-126,140-143,175-178), `seed()` await(test:74,197). helper
  d1-from-sqlite.ts 의 first/run/all 모두 async 시그니처(line 152,161,178) + await 소비. await 누락 0건.
- PASS 경계값 NULL-safe — 0038:40-55 가 `NEW.x IS NOT OLD.x`(NULL-safe distinct) 사용, `<>` 아님.
  G-TR0-3 두 번째 테스트(test:148-162)가 nullable answer 의 NULL→값 전이가 ABORT 됨을 실 SQLite 로
  증명 → `<>` 우회(ADR-046 §D-1 G-TR0-3) 차단 확인. 멀티행 원자성(G-TR0-11, test:195-206) 1행 본문
  변동 시 전체 ABORT·미변경 확인.
- PASS 에러 처리 — 빈 catch 0건. 유일 catch(d1-from-sqlite.ts:109-112)는 fileName 컨텍스트 부착 후
  re-throw (조용한 삭제 아님). 0038 SQL 은 `RAISE(ABORT, ...)` 로 명시적 에러 메시지(0038:58,
  'forbidden ... ADR-046 default-deny') 전파.
- PASS Formula Engine / 동적 코드 — D-3(0038:53, `calc_variables IS NOT` 보호)이 산식 입력변수
  UPDATE 를 ABORT 처리 → Formula Engine 답안 무결성 보호. 동적 코드 실행 함수 사용 0건(순수 DDL).
  ADR-046 §D-3 정합.
- PASS 트리거 컬럼 1:1 정합 — 0038 WHEN 16컬럼(40-55) + 화이트리스트 6 = 22 = schema.ts:319-345
  exam_questions 22컬럼 정확히 일치. 누락/중복 0. 전 22컬럼 실재 확인: 0001(base 14) +
  0002(exam_type/topic_cluster/memorization_type/confusion_type) + 0032(input_type/distractors/
  calc_variables) ALTER TABLE 추적 완료.
- PASS 트리거 교체 원자성 — 0038:34 `DROP IF EXISTS` + 37 `CREATE IF NOT EXISTS` 단일 마이그 파일.
  G-TR0-6(test:83-93) sqlite_master 에서 신 트리거 COUNT=1 AND 구 트리거 COUNT=0 검증 →
  fail-open(no-op/생성실패) 위양성 차단.
- PASS 하네스 정합 — test 가 `createD1FromAllMigrations()`(test:73) 사용 = readdir 자동 로더
  (d1-from-sqlite.ts:122-127), SCENARIO_MIGRATIONS 큐레이션 배열(0037까지) 미사용 → 0038 누락 위양성
  (TD-API-001 부채) 차단. G-TR0-12 정합.
- PASS 회귀 0 검증(출력물 직접 실행) — 단일 파일 28 tests PASS, 전체 api 671 passed/2 skipped/43
  files PASS(baseline 643 → 28 신규 = 671 산술 일치). 다른 `createD1FromAllMigrations` 사용 테스트
  11개에 0038 자동 적용되나 exam_questions UPDATE 사용처 0건(grep) → 동작 변화 없음.
- PASS DB CHECK 정합 — 테스트 whitelist 값(confusion_type='numeric'(test:49),
  input_type='fill_blank'(test:50))이 schema.ts:135 CONFUSION_TYPES/147 INPUT_TYPES 유효값.
  DB-level CHECK 는 status(0001:128)에만 존재, confusion_type/input_type 는 ALTER ADD COLUMN 으로
  CHECK 없음 → seed/whitelist UPDATE 가 CHECK 위반 없이 통과.
- PASS 0018 INSERT 가드 무간섭 — 0018(draft-only INSERT 가드)은 knowledge_nodes 한정(0018:21,33),
  exam_questions 무관 → test 의 seed INSERT(test:53-67)가 ABORT 되지 않는 이유 확인.
- N/A 산식 부동소수점/numeric_value vs value 혼용 — 0038 은 DDL 트리거로 산식 연산 코드 부재.
  calc_variables 는 값 보호 대상이지 연산 경로 아님.

반론 (Devil's Advocate):
approved 골든 백필 워크플로우 중 잘못된 DELETE 쿼리(또는 향후 admin 경로)가 exam_questions 행을
소거하면, 학습자 정답·해설이 DB 계층 가드 없이 사라진다. UPDATE 는 ADR-046 으로 촘촘히 막았으나
DELETE 는 동일 무결성 자산(content/answer)에 대해 무방비라 보호 비대칭이 존재한다(아래 MINOR #1).
단 545 production 행 적재가 INSERT-only 경로이고 현 코드에 exam_questions DELETE 사용처가 0건이라
즉각 위험은 낮음.

### Pass 2 (Architect): ✅ 11건 확인 / 🔴 0건 / 🟠 0건 / N/A 6건

확인 (실제로 확인한 것, 파일:라인):

- PASS D1 스키마 일치(트리거↔Drizzle): migrations/0038:40-55 WHEN 절 16컬럼(content/answer/
  explanation/subject/year/round/question_number/exam_type/status/superseded_by/valid_until/
  valid_from/distractors/calc_variables/id/created_at) + 화이트리스트 6(related_nodes/
  related_constants/topic_cluster/memorization_type/confusion_type/input_type, WHEN 미포함) = 22,
  schema.ts:319-345 examQuestions 22컬럼과 1:1 정확 일치(awk grep 로 16 IS NOT OLD 실측, 중복/누락 0).
- PASS 트리거 NULL-safe 비교: migrations/0038:40-55 전 컬럼이 `IS NOT OLD`(NULL-safe distinct) 사용,
  `<>` 0건. nullable 본문(answer:326/explanation:327)의 NULL↔값 전이도 ABORT 포착
  (G-TR0-3 테스트 :148-162 PASS 확인).
- PASS 트리거 교체 원자성(fail-open 차단): migrations/0038:34 DROP old + :37 CREATE new, lexical
  sort 0004<0038 보장으로 readdir/wrangler 양쪽 순서 정상. 테스트 G-TR0-6(:83-93) sqlite_master 에서
  신 trigger COUNT=1 AND 구 trigger COUNT=0 검증 PASS.
- PASS 애플리케이션 UPDATE 경로 무파손: apps/api/src/study/routes.ts(exam_questions 전부 SELECT/JOIN
  — :836,:998,:1437,:1639,:1879 등), user-search.ts(:452 주석), multihop-accuracy.ts(:18 주석)
  전수 read-only. grep `exam_questions.*UPDATE|SET` 애플리케이션 코드 0건 — 트리거 정책 변경이 깰
  런타임 UPDATE 경로 없음.
- PASS 회귀 0(전 시나리오 테스트): `npx vitest run src/__tests__/scenarios/` → 67/67 PASS(0038 신규
  28 + 기존 39). 0038 미사용 시나리오(0024-pattern-h/hard-rule-13/batch-loader-e2e)는
  SCENARIO_MIGRATIONS(0004 full-ABORT) 환경에서 그린 유지 확인.
- PASS 테스트 하네스 정합(G-TR0-12): migration-0038 테스트(:73)가
  `createD1FromAllMigrations()`(d1-from-sqlite.ts:122 readdir 자동) 사용 → 0038 자동 포함,
  SCENARIO_MIGRATIONS 큐레이션 누락 위양성 차단. 단독 실행 28/28 PASS.
- PASS 트리거 외부 의존 0: grep 결과 `prevent_exam_questions_update` /
  `prevent_exam_questions_body_update` 명칭을 참조하는 애플리케이션/스크립트 코드 0건(migrations 와
  0038 테스트 외). 트리거 rename 이 깰 코드 참조 없음.
- PASS confusion_type/input_type 화이트리스트 fixture 유효성: 테스트 WHITELIST(:44-51)의
  confusion_type='numeric'(schema.ts:134-143 CONFUSION_TYPES 포함), input_type='fill_blank'
  (schema.ts:147 INPUT_TYPES 포함) — CHECK 위반 아닌 정당한 허용 검증.
- PASS 멀티행 원자성: G-TR0-11(:195-206) 다행 단일 UPDATE 본문 변동 시 전체 ABORT + 어떤 행도 미변경
  (statement rollback) 검증 PASS. 545행 production backfill 안전성 표면 커버.
- PASS Temporal Graph 불변 유지: 본문/상태(status/superseded_by/valid_until/valid_from) 전부 ABORT 측
  유지(0038:48-51), SUPERSEDES(INSERT+superseded_by) 패턴 강제 불변. ADR-046 D-2/D-4 와 0004 정책
  정합. UPDATE 대신 INSERT 원칙 미훼손.
- PASS stub/TODO/placeholder/빈catch 부재: migrations/0038(전체 SQL, 실 트리거 로직)·migration-0038
  테스트(28 it 전부 실 assertion)·d1-from-sqlite.ts wrapper 에 TODO/HACK/stub/빈 catch 0건.
  d1-from-sqlite.ts:109-112 catch 는 에러 메시지 래핑+전파(빈 catch 아님).
- N/A Import 방향(packages 단방향): 변경집합은 migrations SQL + 시나리오 테스트 + 문서로, packages/
  간 import 그래프 무관. d1-from-sqlite.ts 는 node:sqlite/fs/path 만 import(테스트 헬퍼 한정).
- N/A Workers 제약(fs/path/CPU): 변경 파일에 Workers 런타임 코드 0. d1-from-sqlite.ts 의
  node:fs/node:path(:24-25)는 테스트 헬퍼 전용(Workers 번들 미포함). 트리거는 D1 엔진 내부 실행으로
  Workers CPU 예산 무관.
- N/A Ontology Lock: 0038 은 트리거 정책 변경으로 신규 노드/엣지 ID 생성 0. ontology-registry.json 무관.
- N/A truth_weight 정렬(LAW>FORMULA>CONCEPT): RAG/LLM 주입 경로 미변경. 본 변경집합은 DB 트리거 +
  테스트로 RAG 랭킹 무관.
- N/A IndexedDB↔D1 동기화 / Service Worker: 클라이언트 오프라인 큐 경로 미변경. exam_questions 메타
  백필은 서버측 관리 작업.
- N/A i18n 하드코딩: 변경 파일에 사용자 노출 UI 문자열 0. 트리거 RAISE 메시지(0038:58)는 영문 개발자
  진단 메시지(학습자 비노출), ADR-046 정책 가독성 목적으로 적절.
- N/A Hexagonal(domain→infrastructure 직접참조): 변경집합에 modules/ 도메인 코드 0. 마이그+테스트+문서만.

반론 (Devil's Advocate):
(1) 이중 로더 부채(아래 MINOR #2) — migration-0038 테스트만 `createD1FromAllMigrations`(0038 포함)를
쓰고, 다른 exam_questions-touching 시나리오(0024-pattern-h/hard-rule-13/batch-loader-e2e)는
SCENARIO_MIGRATIONS(0037까지, 0038 미포함) 경유 → 테스트 환경이 갈린다. 향후 누군가
SCENARIO_MIGRATIONS 기반 테스트에서 exam_questions metadata UPDATE 를 검증하려 하면 0004 full-ABORT
에 막혀 위양성 실패를 본다. (2) schema.ts 본문/메타 4분류 JSDoc 미반영(아래 MINOR #3) — ADR-046 D-5
'1:1 동결'이 out-of-band 문서에만 의존, 미래 컬럼 추가 PR 작성자가 ADR 을 안 읽으면 보호 공백. (3)
Step 3-UX-7c distractor UPDATE 계획과 0038 default-deny 충돌(아래 MAJOR #1) — distractor.ts:6,66 의
직접 UPDATE 설계가 0038:52 distractors ABORT 와 정면 모순, 7c 착수 시 즉시 차단되는 forward-compat 트랩.

### Pass 3 (Advocate): ✅ 11건 확인 / 🔴 0건 / 🟠 0건 / N/A 5건

확인 (실제로 확인한 것, 파일:라인):

- PASS 정답안전(Hard Stop) — answer 컬럼 보호: 0038:41 `NEW.answer IS NOT OLD.answer` ABORT 열거.
  실측 ATTACK1 'answer NULL→①' → ABORT(IS NOT NULL-safe 가 `<>`-우회 차단 확증). 학습자 정답 무결성 유지.
- PASS 정답안전 — explanation(nullable 본문) 보호: 0038:42 IS NOT 열거. 실측 ATTACK7 'explanation
  NULL→해설변조' → ABORT. NULL↔값 전이도 IS NOT 으로 정확히 차단.
- PASS 정답안전 — distractors(객관식 학습자 노출 오답 후보) 보호: 0038:52 IS NOT 열거. 실측
  'distractors UPDATE' → ABORT. 학습자 오답 보기 변조 불가.
- PASS 정답안전 — calc_variables(Formula Engine 입력변수 L3) 보호: 0038:53 IS NOT 열거. 실측
  'calc_variables UPDATE' → ABORT. 산식 답안 정확도 무결성 유지(ADR-046 D-3 본문급).
- PASS 보안(혼합 UPDATE 회피 차단): 실측 ATTACK5 'related_nodes+content' 단일 stmt → ABORT,
  content='본문' 원본 유지(원자 롤백). test G-TR0-3(test:131-146)가 동일 검증 + related_nodes NULL
  잔존 확인. 본문+메타 섞어 우회 불가.
- PASS 보안(트리거 교체 fail-open 차단): 실측 ATTACK6 최종 trigger=
  'prevent_exam_questions_body_update' 단독, 구 prevent_exam_questions_update 부재. test
  G-TR0-6(test:83-93) sqlite_master COUNT 검증. 0038:34 DROP + :37 CREATE 단일 마이그.
- PASS 보안(SQL injection 표면 0): test 의 `${col}`/`${val}` 보간은 전부 const 배열(BODY_IMMUTABLE/
  STATE_MACHINE/ANSWER_SAFETY/WHITELIST, test:21-51) 하드코딩 픽스처 — 사용자 입력 0. Hard Rule 17
  테스트 픽스처 예외. d1-from-sqlite.ts:9,131-135 `DatabaseSync.exec` 는 정적 SQL prepared API
  (shell 무관).
- PASS 입력검증(whitelist input_type): 0032:19 SQL CHECK 로 garbage 값 UPDATE 시 DB ABORT 실측 확인 —
  화이트리스트 허용이 enum 무결성을 우회하지 않음(input_type 한정).
- PASS 데이터 보존(빈 데이터/원자성 경계): test G-TR0-5(test:183-192) UPDATE 후 행수 불변,
  G-TR0-11(test:195-206) 멀티행 단일 UPDATE 본문변동 시 전체 ABORT·전행 원본유지 실측. seed 545행
  규모 백필 시 부분손상 경로 없음.
- PASS stub/TODO/placeholder/빈catch 0건: grep `TODO|FIXME|HACK|placeholder|stub|not implemented`
  → NONE(0038 SQL + test). 빈 catch 정규식 → NONE. 28 테스트 전부 실 PASS(vitest run, 870ms).
- PASS 에러 UX(기술 에러 노출 vs Graceful): 0038:58 RAISE(ABORT) 메시지는 백필 운영자(진산 wrangler
  인증)만 보는 DB 트리거 에러 — 학습자 노출 경로 아님. 메시지에 화이트리스트 6컬럼 + SUPERSEDES 안내
  포함(운영자 친화). 학습자 향 메시지 N/A.
- PASS 기획정합(Silent Pivot 점검): ADR-046 D-0 22컬럼 4분류(허용6/ABORT16)와 0038 SQL WHEN 16컬럼
  열거가 1:1 일치, schema.ts:319-345 22컬럼과도 일치. plan §2.1 진산 결재(D-1 default-deny/D-2
  status ABORT/D-3 calc_variables 본문급)대로 구현 — 설계 이탈 없음.
- PASS Hard Limit 정합: 0038 은 exam_questions 메타만 개방, knowledge_nodes/formulas/constants
  UPDATE 금지(0003/0004) 불변·본문 SUPERSEDES 불변 유지(ADR-046 D-4). exam_questions 외 트리거 미터치
  (0010 status_transitions append-only 등 무영향).
- PASS 하네스 정합(G-TR0-12 위양성 차단): test:16,73 `createD1FromAllMigrations()` =
  d1-from-sqlite.ts:122-127 readdir 자동 로더로 0038 자동 포함. SCENARIO_MIGRATIONS 큐레이션 배열
  (0037까지) 미사용 → 0038 누락 위양성 차단 확인. 0038 이후 exam_questions UPDATE 재정의 마이그 0건.
- N/A 상태표현(로딩/오프라인 UI) — 본 변경은 migration SQL + 시나리오 테스트로 클라이언트/UI 코드 부재
  (routes.ts 는 연관 읽기 경로일 뿐 본 변경 미포함).
- N/A Service Worker 캐싱 전략 — apps/api(Workers 백엔드) 마이그레이션 변경, PWA/SW 코드 스코프 외.
- N/A 접근성(터치 44px/키보드/aria-label) — 렌더 UI 산출물 없음(DB 트리거 + 테스트).
- N/A XSS innerHTML — DOM 조작 코드 없음. 0038/test 전부 SQL·vitest.
- N/A API키 하드코딩 — 시크릿/키 참조 없음. 마이그 SQL 은 트리거 정의만, test 는 in-memory SQLite.

반론 (Devil's Advocate):
화이트리스트 confusion_type 컬럼에 DB-level CHECK 부재(아래 MINOR #4) — input_type 은 0032:19 SQL
CHECK 가 있어 garbage 값 UPDATE 시 ABORT 되지만, confusion_type 은 전 마이그에 SQL CHECK 0건이라
실측 `UPDATE ... SET confusion_type='bogus'` → ALLOW(changes=1, 'bogus' 저장)됐다. 이 값은
study/routes.ts:1471-1527 의 confusionTypes breakdown 으로 학습자 UI 에 그대로 전달된다. 0038 이 새로
연 UPDATE 창으로 잘못된 confusion 모드 라벨이 표면화될 수 있다(단 정답/distractors/calc_variables/
explanation 은 전부 ABORT 보호로 답안 무결성 무손상 → MINOR).

### Pass 4 (Contract): ✅ 11건 확인 / 🔴 0건 / 🟠 0건 / N/A 3건

확인 (실제로 확인한 것, 파일:라인):

- PASS 컬럼 분류 1:1 정합: migrations/0038:40-55 WHEN 절 ABORT 16컬럼(content/answer/explanation/
  subject/year/round/question_number/exam_type + status/superseded_by/valid_until/valid_from +
  distractors/calc_variables + id/created_at) + 화이트리스트 6(related_nodes/related_constants/
  topic_cluster/memorization_type/confusion_type/input_type, WHEN 미포함) = 22, schema.ts:319-345
  exam_questions 22컬럼과 정확히 1:1(누락/중복 0). ADR-046:39-47 D-0 표와도 일치.
- PASS 설계서/ADR 결정 충실: ADR-046:49-72 D-1(default-deny)·D-2(status ABORT 유지)·D-3
  (calc_variables 본문급 ABORT) 진산 결재가 migrations/0038 WHEN 절에 그대로 반영(status 4컬럼·
  calc_variables·distractors 모두 ABORT 측 enumerate). Silent Pivot(설계 일탈) 없음 — 설계는 A안
  컬럼 화이트리스트 불변.
- PASS NULL-safe 연산자: migrations/0038:40-55 전 16컬럼이 `IS NOT`(NULL-safe distinct) 사용,
  `<>` 미사용. ADR-046:57-59 SQLite 주의(nullable 본문 NULL↔값 전이를 `<>`는 우회) 정확 준수.
  테스트 G-TR0-3(test:148-162)이 answer NULL→값 전이 ABORT 로 실증.
- PASS 트리거 명칭 단일화: migrations/0038:37 `prevent_exam_questions_body_update`, ADR-046:103
  'A안=순수 컬럼 화이트리스트=채택'으로 명칭/라벨 단일화 결정과 일치. plan §2 의 `_static_update` 표기
  혼선은 ADR 에서 해소됨.
- PASS Hard Limit 미위반: CLAUDE.md:62 UPDATE 금지 테이블 = knowledge_nodes, formulas 만 명시.
  exam_questions 는 Hard Limit 대상 아님(0004 과보호 트리거의 산물). migrations/0038 은 exam_questions
  만 touch(knowledge_nodes/formulas/constants 무변경), 본문/상태/답안안전 ABORT 유지 → ADR-046:76-83
  D-4 '본문 불변 유지한 채 라벨 메타에만 열린 창' 정확 구현.
- PASS 트리거 교체 fail-open 차단: migrations/0038:34 구 트리거 DROP + :37 신 트리거 CREATE. 테스트
  G-TR0-6(test:83-93)이 sqlite_master 에서 신 트리거 COUNT=1 AND 구 트리거 COUNT=0 확인. no-op/생성
  실패 위양성 차단.
- PASS 테스트 하네스 정합(G-TR0-12): test:16,73 `createD1FromAllMigrations()` 사용
  (d1-from-sqlite.ts:122-127 readdir 자동 정렬 로더, 0038 자동 포함). SCENARIO_MIGRATIONS
  (d1-from-sqlite.ts:44-84, 0037 까지 큐레이션) 미사용 — 0038 누락 위양성(TD-API-001 부채) 차단.
- PASS 테스트 실데이터 정합: 픽스처 confusion_type='numeric'(schema.ts:135 CONFUSION_TYPES 포함),
  input_type='fill_blank'(schema.ts:147 INPUT_TYPES + 0032:19 CHECK 통과), status='deprecated'
  (0001:128 CHECK IN active/deprecated/flagged 유효 → ABORT 가 CHECK 아닌 트리거에서 발생함을 정확히
  분리 검증).
- PASS 테스트 실행 확인(stub 아님): `npx vitest run` 결과 28 tests passed (750ms), 실제 node:sqlite
  엔진 위 전 마이그 적용. G-TR0-1~12 전수(it.each 22컬럼 + 혼합/멀티행원자성/NULL-safe/트리거교체)
  커버. stub/TODO/placeholder/빈 catch 0건.
- PASS Workers 제약 무관: 본 변경은 D1 마이그 SQL + node:sqlite 테스트(d1-from-sqlite.ts:9,12 —
  node:sqlite 는 빌드/테스트 환경 전용, Workers 번들 미포함). 런타임 코드(routes/handlers) 무변경 →
  Workers fs/path/CPU 제약 N/A.
- PASS Temporal Graph 패턴 유지: ADR-046:79,82-83 + migrations/0038:19,58 본문 변경은 SUPERSEDES
  (신규 INSERT + superseded_by) 경로 유지. UPDATE 는 비-진실값 라벨 메타 6컬럼만 — auto-review-protocol
  Pass2 'UPDATE 대신 INSERT+SUPERSEDES' 불변 보존.
- N/A 노드 ID 컨벤션(CONCEPT-001/F-01/INS-01): 본 변경은 마이그 SQL+테스트로 노드/엣지 ID 생성 없음.
  테스트 픽스처의 LAW-002/CONST-01/TC-001 은 \*.test.ts 예시 데이터(production-quality.md:127 Rule 17
  예외)이며 ontology-registry 등재 대상 아님.
- N/A constants 수치/임계값 ↔ 교재 원문: 본 변경은 트리거 정책 변경으로 산식 상수·임계값 없음.
  calc_variables 는 오히려 ABORT(D-3 본문급 보호)로 무결성 강화.
- N/A BATCH 순서(N→N+1): 본 변경은 BATCH 적재가 아닌 스키마 가드 재설계. related_nodes 백필(BATCH
  후속)의 선결 차단선 해소가 목적.

반론 (Devil's Advocate):
(1) L3 결재 게이트 선행 위반(아래 MAJOR #2) — 0038 SQL+테스트가 plan 정식 결재(approved_by=TBD)·
ADR-046 Accepted 이전에 작성됨. plan §6 적용순서는 step1 결재→step2 ADR Accepted→step3 비로소 SQL
작성을 명시하나, mtime 분석상 plan 이 여전히 TBD·ADR 이 Draft 인데도 SQL 이 ~5.6h 뒤 작성됨(순서 역전,
Silent Pivot 오인 위험). 단 production 적용(wrangler --remote)이라는 불가역 하드게이트는 미수행이고
SQL 내용이 ADR-046 D-0 과 1:1 정합하므로 데이터 안전 회귀는 아님 → CRITICAL 아닌 MAJOR. (2) G-TR0-2
화이트리스트 input_type 케이스가 seed=신규값 동일이라 '실제 전이 허용'을 실증하지 못함(아래 MINOR #5).

판정: **완료 가능** (CRITICAL 0건)
────────────────────────────────────

---

## 확정 발견 (반증 통과분만) — CRITICAL 0 / MAJOR 2 / MINOR 5

### MAJOR

#### [MAJOR-1] Step 3-UX-7c distractor UPDATE 계획 흐름이 0038 default-deny 와 충돌 (forward-compat 트랩)

- 파일: `/home/soo/ClaudePro/ThePick/apps/admin-web/src/types/distractor.ts:6, 66-74`
- Pass: Architect
- 상세: distractor.ts 의 워크플로우 docstring(:6 '진산 검수 → exam_questions.distractors UPDATE')과
  `DistractorUpdatePayload`(:69-74, 'PUT /api/admin/distractors/:questionId 로 매핑')는 진산 검수 후
  exam_questions.distractors 를 _직접 UPDATE_ 하는 7c chunk 흐름을 명시적으로 설계한다. 그러나
  ADR-046 D-1/D-3 결재로 0038 트리거가 distractors 를 ABORT 측 16컬럼에 포함(migrations/0038:52)시켰다.
  즉 7c 가 구현되어 `PUT /api/admin/distractors` 가 `SET distractors=...` UPDATE 를 실행하면 DB 계층
  에서 RAISE(ABORT) 로 전면 차단된다. 이는 모듈 간 계약 충돌 — 마이그(0038)와 admin-web 의 distractor
  파이프라인 설계가 서로 모순. ADR-046 D-3 은 'calc 문항 변수 백필이 필요하면 SUPERSEDES 경로로만'이라
  했으나 distractor.ts 설계는 UPDATE 전제. 현재 7c 엔드포인트는 미구현(코드 grep 0건 — docs/types 만
  존재)이므로 런타임 파손은 아니나, 7c 착수 시점에 즉시 막히는 forward-compat 트랩이다.
- 확인:
  - apps/admin-web/src/types/distractor.ts:6 — '2. adminUI ... 진산 검수 →
    exam_questions.distractors UPDATE' 직접 UPDATE 설계 명시
  - apps/admin-web/src/types/distractor.ts:66 — 'adminUI 검수 액션 → 7c chunk에서
    PUT /api/admin/distractors/:questionId로 매핑' (실 API 미연결 = 미구현)
  - migrations/0038_exam_questions_metadata_update_allow.sql:52 — 'OR NEW.distractors IS NOT
    OLD.distractors' = distractors 변동 시 ABORT (default-deny 16컬럼 포함)
  - grep `api/admin/distractors|SET distractors` 결과 distractor.ts 외 0건 — 7c 엔드포인트/UPDATE
    구현체 부재 확인 (런타임 파손 아님, 계획 충돌)
- 반증 결과(refuted=false, severityAdjust=keep): 발견은 거짓 양성이 아니다. 충돌이 단일 docstring
  stale 이 아니라 (a) 미-supersede 된 살아있는 plan(phase3-learning-ux-modes.plan.md:631 '3-UX-7c
  = exam_questions UPDATE / PUT /api/admin/distractors/:questionId')의 직접 UPDATE 설계 + (b) 통과중
  테스트 G-TR0-9(migration-0038 test:111 distractors UPDATE ABORT)의 반대 계약 기계적 강제 양면.
  ADR-046 / tr-0 plan 어디에도 7c distractor 파이프라인과의 정합/이월 cross-ref 0건(tr-0 plan:63 은
  distractors 를 'OPEN'으로 표기 후 ADR-046 D-1 이 ABORT 결정했으나 7c 설계로 루프백 미실행).
  MINOR 강등 기각: 살아있는 plan + 테스트 강제 계약 모순이므로 7c kickoff 즉시 차단. 단 현재 런타임
  무파손(7c 미구현)이라 CRITICAL 아님 → MAJOR 유지.
- 권고: ADR-046 또는 phase3-learning-ux-modes.plan.md 에 'Step 3-UX-7c distractor 백필 = 직접 UPDATE
  불가(0038 D-3 ABORT), SUPERSEDES(신규 INSERT + superseded_by) 또는 별도 staging 경유'를 명시 이월
  기록. distractor.ts:6,66 docstring 도 동기(직접 UPDATE → SUPERSEDES 경로)하거나 7c 미착수
  carry-over 로 ADR-046 §Phase B 카운터 게이트에 연결.

#### [MAJOR-2] L3 결재 게이트 선행 위반 — 마이그 0038 SQL+테스트가 plan 정식 결재(approved_by=TBD)·ADR-046 Accepted 이전에 작성됨 (Silent Pivot/순서 역전)

- 파일: `/home/soo/ClaudePro/ThePick/migrations/0038_exam_questions_metadata_update_allow.sql` (전체 — plan §6 step 3 대조)
- Pass: Contract
- 상세: 본 SQL과 그 테스트는 git status 상 untracked(신규 작성)로 존재한다. 그러나 권위 문서 3종이
  'SQL 작성은 plan 정식 결재 + ADR Accepted 후'를 명시한다: (1) plan §6 적용순서 — step1 진산 plan
  결재→approved_by 갱신, step2 ADR Accepted, step3 비로소 '마이그 0038 SQL 작성→4-Pass'. 현재 plan
  frontmatter approved_by='TBD (진산 결재 대기)', §8 '진산 plan 정식 결재: TBD'. (2) ADR-046:3
  상태='Draft (Proposed) — 진산 Accepted 대기' + '본 ADR은 코딩(마이그 0038 SQL 작성·적용)을 승인하지
  않는다 (L3 게이트)'. (3) handoff-093:117-118 'B-3 묶음(B-1+B-2 모두 결재 후): ADR-046→진산
  Accepted→마이그 0038 SQL 작성', :158-159 'L3 영역 자율 금지: TR-0 마이그 SQL/ADR-046 본문 = 진산
  plan 결재 + ADR Accepted 후 코딩'. CLAUDE.md L3 영역에 'DB 스키마 변경(마이그레이션)'이 plan+인간승인
  필수로 명시. 즉 SQL 산출물 자체가 자신이 따라야 한다고 선언한 결재 순서를 역전했다. (참고: production
  적용(wrangler --remote)이라는 최종 하드게이트는 미수행이며 SQL 내용 자체는 ADR-046 D-0과 1:1 정합
  하므로 데이터 안전 회귀는 아님 → CRITICAL 아닌 MAJOR.)
- 확인:
  - docs/plans/tr-0-backend-c7-trigger-redesign.plan.md:5 — `approved_by: TBD (진산 결재 대기)`
  - docs/plans/tr-0-backend-c7-trigger-redesign.plan.md:166-168 — step1 plan 결재 → step2 ADR
    Accepted → step3 SQL 작성 순서
  - docs/adr/ADR-046-exam-questions-metadata-update-policy.md:3 — 상태 Draft (Proposed), '본 ADR은
    코딩(마이그 0038 SQL 작성·적용)을 승인하지 않는다'
  - .jjokjipge/handoff-session-093.md:158-159 — L3 자율 금지: 마이그 SQL = 진산 plan 결재 +
    ADR Accepted 후 코딩
- 반증 결과(refuted=false, severityAdjust=keep): 4개 confirmation 전부 실파일 Read 로 축자 검증됨.
  git status 상 0038 SQL 과 test 모두 untracked(`??`)이고 `git ls-files --error-unmatch` 에러 →
  신규 작성 확정. mtime 분석: ADR/plan 이 먼저(1780037481~1780037515), SQL/test 가 ~5.6h 뒤
  (1780057789~1780057856) — plan TBD·ADR Draft 인데도 SQL 작성. 데블스 애드버킷("4-Pass 리뷰 돌리려면
  SQL 선존재 필요" 텔레스코핑) 기각: 권위 3문서 모두 'SQL 작성→4-Pass'를 결재 _이후_ step3 으로 명시,
  '리뷰용 선작성' 예외 없음. severity 유지(MAJOR): SQL WHEN 절 16 ABORT 컬럼이 ADR-046 D-0 와 1:1
  정합 + production-migration-status.md 에 0038 무참조(불가역 하드게이트 미수행 = 데이터 안전 회귀 0)
  → CRITICAL 아닌 MAJOR.
- 권고: (1) 진산 plan 정식 결재 획득 후 plan §5 frontmatter approved_by 와 §8 '진산 plan 정식 결재'를
  실제 값으로 갱신하고 ADR-046:3 상태를 Accepted 로 전환. (2) 그 전까지는 본 SQL/테스트를 '4-Pass
  리뷰용 선작성(결재 대기, 미커밋)'으로 명시 라벨링하여 Silent Pivot 오인 차단. (3) production 적용
  (wrangler --remote)은 plan §6 step6 진산 인증 게이트 유지 — 현재 미수행 상태 그대로 보존.

### MINOR

#### [MINOR-1] exam_questions DELETE 경로는 0004/0038 어느 트리거도 가드하지 않음 (SUPERSEDES 불변의 DELETE 측면은 app-layer 의존)

- 파일: `/home/soo/ClaudePro/ThePick/migrations/0038_exam_questions_metadata_update_allow.sql:34-59`
- Pass: Surgeon
- 상세: 0004 는 `prevent_exam_questions_update`(BEFORE UPDATE) 만 생성했고, 0038 은 이를
  `prevent_exam_questions_body_update`(BEFORE UPDATE) 로 교체할 뿐 BEFORE DELETE 가드는 0004·0038
  어디에도 없다 (grep 'DELETE ON exam_questions' 전 migrations 0건). Temporal Graph 불변(본문 변경은
  INSERT+superseded_by)은 UPDATE 측에서만 DB 강제되고, 행 DELETE 로 기출 본문을 소거하는 경로는 DB
  계층 무방비다. status_transitions(0010:55-59) 와 revision_changes 는 명시적 DELETE 가드가 있어
  대비된다. 단 이는 0038 이 신규 도입한 결함이 아니라 0004 부터 존재하던 스코프이며, 0038 의 범위
  (메타 UPDATE 허용)와 직교한다. ADR-046 §D-4 도 본문 SUPERSEDES 의무를 '불변'으로 명시하나 DELETE
  차단은 언급하지 않는다.
- 확인:
  - migrations/0004_temporal_guard_extension.sql:39-43 — prevent_exam_questions_update 가
    BEFORE UPDATE 만, DELETE 트리거 부재
  - migrations/0010_status_transitions_and_page_ref_guard.sql:55-59 — status_transitions 는
    prevent_status_transitions_delete (BEFORE DELETE) 명시 가드 보유 (대조군)
  - grep 'DELETE ON exam_questions' 전 migrations 디렉토리 0건 — DELETE 가드 부재 확증
- 반론(Devil's Advocate): approved 골든 백필 워크플로우 중 잘못된 DELETE 쿼리(또는 향후 admin 경로)가
  exam_questions 행을 소거하면, 학습자 정답·해설이 DB 계층 가드 없이 사라진다. UPDATE 는 ADR-046 으로
  촘촘히 막았으나 DELETE 는 동일 무결성 자산(content/answer)에 대해 무방비라 보호 비대칭이 존재. 단
  545 production 행 적재가 INSERT-only 경로이고 현 코드에 exam_questions DELETE 사용처가 0건(grep
  확인)이라 즉각 위험은 낮음 — MINOR 로 보고하되 0038 책임 범위 밖(별도 carry-over 후보).
- 권고: 0038 범위 밖이므로 본 PR 차단 사유 아님. carry-over: 후속 마이그(또는 TR-1)에서
  prevent_exam_questions_delete (BEFORE DELETE → RAISE ABORT, status_transitions 0010:55-59 패턴
  이식) 추가 검토. ADR-046 §D-4 에 'DELETE 도 차단 대상'을 명시하거나, 의도적 미차단이면 그 근거를
  ADR 에 기록 권장.

#### [MINOR-2] 0038 테스트만 createD1FromAllMigrations 사용 — 다른 exam_questions 시나리오는 0038 부재(0004 full-ABORT)로 실행 = 이중 로더 부채(TD-API-001) 지속

- 파일: `/home/soo/ClaudePro/ThePick/apps/api/src/__tests__/helpers/d1-from-sqlite.ts:44-84, 122-127`
- Pass: Architect
- 상세: migration-0038 테스트는 readdir 자동 로더 `createD1FromAllMigrations()`(d1-from-sqlite.ts:122)를
  써서 0038 을 포함(G-TR0-12 정합). 그러나 다른 exam_questions-touching 시나리오 테스트(migration-0024-
  pattern-h, hard-rule-13-draft-only, batch-loader-e2e)는 큐레이션 배열 SCENARIO_MIGRATIONS
  (d1-from-sqlite.ts:44-84, 0037 까지만, 0038 미포함)를 사용 → 그 테스트들은 여전히 0004 의 전면 ABORT
  트리거 환경에서 실행된다. 두 로더가 공존하며 production(wrangler migrations apply = 전체 적용)과
  테스트 환경이 갈린다. 본 코드(이미 헬퍼 docstring :39-43 에 TD-API-001 부채로 자인)는 0038 신규
  작업이 만든 결함은 아니나, 0038 이 'exam_questions UPDATE 정책'을 바꿨음에도 그 정책을 모르는 시나리오
  테스트가 다수 존재 = 테스트 환경 일관성 공백.
- 확인:
  - apps/api/src/**tests**/helpers/d1-from-sqlite.ts:44-84 — SCENARIO_MIGRATIONS 배열이 0037 에서
    끝남(0038 미포함), 0020·0021~0027 도 큐레이션 누락
  - apps/api/src/**tests**/helpers/d1-from-sqlite.ts:39-43 — 'TD-API-001 ... 향후 마이그레이션 추가
    시 본 배열 갱신 망각하면 동일 dual-schema dormancy 회귀 위험' 자인
  - scenario 디렉토리 전수 grep — createD1FromAllMigrations 소비자는 migration-0038 테스트 단 1건,
    나머지 exam_questions 테스트(0024/hard-rule-13/batch-loader-e2e)는 큐레이션 배열 경유 확인
  - `npx vitest run src/__tests__/scenarios/` → 67/67 PASS (회귀 0, 두 환경 모두 그린)
- 반론(Devil's Advocate): plan G-TR0-12 가 의도적으로 '0038 테스트는 readdir, 큐레이션 배열 미사용'을
  못박았고, 다른 테스트가 0004 full-ABORT 로 도는 것은 그 테스트들이 exam_questions UPDATE 를 시도하지
  않으므로(전부 SELECT/INSERT) 실질 영향 0 — 따라서 MINOR 도 과한 지적일 수 있다. 그러나 향후 누군가
  SCENARIO_MIGRATIONS 기반 테스트에서 exam_questions metadata UPDATE 를 검증하려 하면 0004 full-ABORT
  에 막혀 위양성 실패를 보게 된다.
- 권고: 중기적으로 SCENARIO_MIGRATIONS 를 readdir 자동 로더로 통합(TD-API-001 해소, handoff/WBS 기존
  의무)하거나, 최소한 d1-from-sqlite.ts:84 뒤에 0038 을 추가해 큐레이션 배열도 신정책을 반영. 단기
  차단 사유는 없으므로 carry-over 로 명시 이월 가능.

#### [MINOR-3] schema.ts 본문/메타 구분 JSDoc 미반영 — ADR-046 D-5 '1:1 동결'이 out-of-band 문서에만 의존

- 파일: `/home/soo/ClaudePro/ThePick/apps/api/src/db/schema.ts:319-345`
- Pass: Architect
- 상세: plan §3 (tr-0...plan.md:112)과 ADR-046 D-5 는 schema.ts 에 '본문/메타데이터 구분 주석'을 추가해
  22컬럼 4분류를 1:1 동결하고, 신규 컬럼 추가 시 트리거 WHEN enumeration 갱신 의무를 코드 근처에서
  환기하도록 요구한다. 그러나 현재 examQuestions 정의(schema.ts:319-345)에는 inputType(:338)/
  distractors(:340)/calcVariables(:341) 외에 본문/상태/답안안전/불변 분류를 표시하는 주석이 없다.
  결과적으로 'schema.ts 변경 시 0038 WHEN enumeration 동기' 라는 망각 안전(ADR-046 §D-5)이 schema.ts
  파일 자체가 아닌 ADR/plan 문서에만 살아있어, 미래 컬럼 추가 PR 작성자가 ADR-046 을 안 읽으면 보호
  공백이 발생한다(ADR-046 §'부정/위험' 스스로 인정).
- 확인:
  - apps/api/src/db/schema.ts:319-345 — examQuestions 22컬럼 정의, inputType(:338)/distractors(:340)/
    calcVariables(:341) JSDoc 외 본문/상태/메타 4분류 주석 부재
  - docs/plans/tr-0-backend-c7-trigger-redesign.plan.md:112 — schema.ts '주석 동기 ... 본문/메타데이터
    구분 주석만 추가' 가 plan 대상 파일로 명시되었으나 미반영
  - docs/adr/ADR-046-...md:85-92 (D-5) — '신규 컬럼 추가 시 ... 마이그 0038 후속 마이그의 WHEN
    enumeration 에 추가' 망각 안전이 프로세스(문서) 담보로만 정의됨
  - schema.ts:333-341 status/superseded_by/distractors/calc_variables 가 보호 컬럼임을 알리는 인라인
    마커 0건 확인
- 반론(Devil's Advocate): plan §3 은 schema.ts 를 'shape 무변경, 주석만'으로 분류했고 본 리뷰 시점이
  마이그 0038 SQL+테스트 단계라면 schema.ts 주석 동기는 같은 TR-0 묶음의 후속 커밋으로 예정된 것일 수
  있다(미커밋 변경집합). 그 경우 본 건은 '아직 안 한 작업'일 뿐 결함 아님. 다만 현재 변경집합(0038
  SQL + 테스트)만으로 '완료'를 선언하면 plan §3 의 4파일 중 schema.ts 주석이 누락된 채 닫히는 위험.
- 권고: schema.ts:319-345 examQuestions 블록 상단에 4분류(본문 ABORT / 메타 화이트리스트 / 상태 ABORT
  / 답안안전 ABORT / 불변)와 'ADR-046 D-0 표 1:1 동결, 컬럼 추가 시 마이그 WHEN enumeration 갱신' JSDoc
  추가. plan §3 의 4파일 동기가 끝나야 TR-0 완료 선언.

#### [MINOR-4] 화이트리스트 confusion_type 컬럼에 DB-level CHECK 부재 — 0038 UPDATE 경로로 학습자 노출 UI에 임의 문자열 주입 가능 (input_type 과 비대칭)

- 파일: `/home/soo/ClaudePro/ThePick/migrations/0038_exam_questions_metadata_update_allow.sql:37-59` (트리거 WHEN 미포함 화이트리스트), `schema.ts:337`, `study/routes.ts:188,1471-1527`
- Pass: Advocate
- 상세: 0038 화이트리스트 6컬럼 중 input_type 은 마이그 0032:19 에 SQL
  `CHECK(input_type IN ('multiple_choice','fill_blank','essay','calc'))` 가 있어 잘못된 값 UPDATE 가
  DB 레벨에서 ABORT 된다(실측 ATTACK 'input_type=GARBAGE' → CHECK constraint failed). 그러나
  confusion_type 은 전 마이그레이션에 SQL CHECK 가 0건이고(grep 'confusion_type'+'check' → empty)
  Drizzle TS enum(schema.ts:337 `{ enum: CONFUSION_TYPES }`)으로만 선언돼 런타임 미강제다. 실측 결과
  `UPDATE exam_questions SET confusion_type='bogus'` 는 ALLOW(changes=1, 값='bogus' 저장)됐다. 이 값은
  study/routes.ts:1471-1527 의 confusionTypes breakdown 으로 학습자 UI 에 그대로 전달된다(타입은
  string|null, routes.ts:188 — 읽기 시 enum 검증 없음). 즉 0038 이 새로 연 UPDATE 창으로 잘못된
  confusion 모드 라벨이 학습 화면에 표면화될 수 있다. 다만 (1) 이 컬럼은 INSERT 시점에도 동일하게 CHECK
  부재라 0038 신규 결함이 아니라 기존 컬럼 속성이고, (2) 백필은 진산 검수(approved-only) 게이트를 통과한
  값만 적재되며, (3) 정답(answer/distractors/calc_variables/explanation)은 전부 ABORT 보호되어 답안
  무결성은 무손상이라 MINOR 로 분류.
- 확인:
  - 0038 SQL 라인 40-55 의 WHEN enumeration 에 confusion_type 미포함 = 화이트리스트(허용) 확정
  - 실측 ATTACK 'confusion_type=GARBAGE' → ALLOW changes=1, 저장값='bogus' (node:sqlite 7-migration
    실엔진 probe)
  - 실측 ATTACK 'input_type=GARBAGE' → ABORT (CHECK constraint failed: input_type IN(...)) —
    0032:19 SQL CHECK 존재로 비대칭
  - grep 'confusion_type' + 'check' 전 마이그 = empty (DB CHECK 0건)
  - study/routes.ts:188 confusion_type: string|null + :1471-1527 confusionTypes breakdown 학습자 응답
    매핑(read-path enum 검증 없음)
- 반론(Devil's Advocate): 진산 검수 워크플로우가 '근거 보기'/분류 라벨까지 사람이 검증한다면 garbage
  confusion_type 가 production 에 도달할 확률은 낮다. 그러나 백필 자동화 스크립트가 LLM 산출 분류값을
  검수 화면에 노출하기 전 DB 에 먼저 적재(draft)하는 순서라면, CHECK 부재로 인해 잘못된 enum 이 draft
  단계에서 이미 학습자 통계 쿼리(status='active' 필터, routes.ts:1473)와는 분리되더라도, approved 동결
  시 검수자가 라벨 오타를 놓치면 confusion 모드 카운트가 왜곡될 수 있다. input_type 만 CHECK 가 있고
  confusion_type 은 없는 비대칭이 '둘 다 화이트리스트'라는 설계 의도와 어긋난다.
- 권고: ADR-046 §D-5 신규 컬럼 체크리스트에 '메타 화이트리스트라도 학습자 노출 enum 컬럼은 SQL CHECK
  또는 read-path Zod 검증' 항목 추가 또는 application 적재 레이어에서 CONFUSION_TYPES allowlist 검증.

#### [MINOR-5] G-TR0-2 화이트리스트 테스트 중 input_type 케이스가 값 무변경(seed=신규값 동일)이라 '실제 전이 허용'을 증명하지 못함

- 파일: `/home/soo/ClaudePro/ThePick/apps/api/src/__tests__/scenarios/migration-0038-metadata-update.test.ts:50,62,120-128`
- Pass: Contract
- 상세: WHITELIST 테스트는 input_type 를 'fill_blank' 로 SET 하는데, seed(line 62)가 이미
  input_type='fill_blank' 로 INSERT 한다. 따라서 이 UPDATE 는 input_type 의 실제 값 전이를 일으키지
  않고, 어셈션 `row?.v==='fill_blank'` 는 seed 값과 동일해 자명 통과한다. input_type 이 WHEN 절에 없어
  ABORT 가 구조적으로 불가능하긴 하나, '화이트리스트 컬럼의 값 변경이 허용된다'는 명제를 input_type 에
  대해서는 실증하지 못한다(다른 5개 화이트리스트 컬럼은 NULL→값 전이로 실증됨). G-TR0-2 의 의도(메타
  화이트리스트 단독 UPDATE 성공)에 비춰 input_type 만 커버리지가 약하다.
- 확인:
  - migration-0038-metadata-update.test.ts:50 — WHITELIST input_type 'fill_blank'
  - migration-0038-metadata-update.test.ts:62 — seed INSERT 가 input_type 'fill_blank' 사용
  - migrations/0032_exam_questions_input_type.sql:18-19 — input_type CHECK IN (multiple_choice,
    fill_blank,essay,calc) — 'multiple_choice' 로 전이하면 실제 변경 실증 가능
- 반론(Devil's Advocate): input_type 은 0038 WHEN 절에 부재하므로 어떤 값이든 ABORT 가 원천 불가능 —
  따라서 값 전이 실증 없이도 '허용' 명제는 트리거 구조상 참이다. 그러나 만약 향후 누군가 input_type 을
  실수로 WHEN 절에 추가하면(보호 컬럼 오분류) seed=신규값 동일 어셈션은 그 회귀를 잡지 못한다
  (NEW IS NOT OLD = false 라 ABORT 미발동 → 테스트 여전히 녹색). 즉 이 약한 어셈션은 미래 오분류 회귀에
  대한 검출 공백을 남긴다.
- 권고: WHITELIST 의 input_type 값을 seed 와 다른 유효값(예: 'multiple_choice', 0032 CHECK 통과)으로
  변경하여 NEW.input_type IS NOT OLD.input_type 가 참이 되는 실제 전이를 발생시키고 UPDATE 성공+값
  반영을 어셈션. confusion_type/topic_cluster 등 다른 화이트리스트가 NULL→값으로 실 전이를 검증하는
  패턴과 동일하게 정렬.

---

## 판정

**완료 가능** — 4-Pass 모두 CRITICAL 0건. MAJOR 2건(MAJOR-1 distractor 7c forward-compat 트랩 /
MAJOR-2 L3 결재 게이트 선행 위반)은 모두 (a) production 불가역 게이트(wrangler --remote) 미수행으로
데이터 안전 회귀 0, (b) 0038 SQL 자체는 ADR-046 D-0 과 1:1 정합이므로 CRITICAL 아님. 두 MAJOR 는 phase
종료(TR-0 완료 선언) 전 해소 또는 명시 이월 필요. MINOR 5건은 보고만(0038 책임 범위 밖 carry-over 다수).
