# mock_exam_questions 격리 스테이징 plan (WS-6c) — exam_questions draft 표현

> ★ **슬롯 정정 (2026-07-02 5-페르소나 리뷰 MAJOR-6)**: 병렬 작성된 `ws-2b-knowledge-edges-guard.plan.md`
> 가 0039 를 선점(같은 날 작성·Track B 묶음이라 집행 순서 선행 개연) — 본 plan 은 **0040** 으로 재번호.
> 슬롯은 예약일 뿐 확정이 아니다: **SQL 작성 시점에 migrations/ 재실측 의무** (양 plan 공통).

> **상태**: DRAFT. **L3 (DB 스키마 마이그레이션 — 신규 테이블·트리거).** 본 plan 은 _무엇을 왜 어떻게_ +
> 스키마 초안 + 세부 PITR + Binary Gate 까지다. ★ **SQL 파일 작성·마이그 적용 = §7 결재란 승인 후**
> (자율 금지 — 2026-05-29 실수 로그 절차: L3 는 `approved_by` 명시 전환 선행. 본 문서에 SQL 은 0줄).
> **진입 결재**: MASTER_PLAN §6 #12 ☑ — 진산 2026-07-02 일괄 결재 "권고대로" = (a) 명문화 + **(b-2)
> mock_exam_questions 격리 스테이징** (기록 커밋 3adb10a). 카드:
> `master-remediation-20260610/decision-card-12-generation-gate-draft-pitr.md`.
> **Binary Gate 종착**: S11 "AI 생성물이 exam_questions 에 무게이트 적재되는 경로 0"
> (OPUS48_EXECUTION_PLAYBOOK.md:219) + G-WS6 ④ ADR(6c) Accepted (MASTER_PLAN.md:184).
> **연계**: `phase2-entry-gate-checklist.md` §2-2 (본 plan = 그 게이트의 이행 수단).

---

## 0. Reality Anchor (이 테이블이 막는 것 / 못 막는 것 — 먼저)

**막는 것**: AI 생성 문항이 본체 `exam_questions` 로 **직행 적재되는 경로**. 테이블 격리 자체가
차단막 — 본체 유입은 인간 검수 후 승격 INSERT 만 (카드 #12 비교표 "Hard Limit" 행의 채택 근거).

**못 막는 것 (정직)**:

1. **승격 후 콘텐츠 품질** — 격리는 구조 장치일 뿐, 정답·해설 정확성은 인간 검수(진산)가 담보한다.
   Hard Limit "AI 생성 데이터는 draft 상태로만 적재(인간 검수 후 approved)"의 전반부(draft 격리)만
   본 테이블이 기계 강제하고, 후반부(검수 품질)는 사람의 몫.
2. **기존 문항 대체 승격은 현재 불가** — 대체 승격은 SUPERSEDES(신규 INSERT + 원행 `superseded_by`
   마킹)를 요구하는데, 원행 마킹 UPDATE 가 **0038 D-2 ABORT 대상**(`migrations/0038:54`
   `NEW.superseded_by IS NOT OLD.superseded_by` → ABORT, production 라이브). ADR-046 D-2 가 이미
   "deprecate/flagged 류 상태 운영 = 별도 plan"으로 명시 이월해 둔 잔존 게이트다. 본 plan 은 결재
   #12 (b-2) 전제("기결 0038 D-2 불변")에 따라 **D-2 를 건드리지 않는다** ⇒ Phase 2 초기 승격 =
   **신규 문항 INSERT 만**. 대체 승격 개방 시점 = §7 결재란 별도 항목.
3. **mnemonic_cards 게이트가 아니다** — 암기법 표적 테이블 게이트는 WS-6b 별건
   (MASTER_PLAN.md:178, plan 미작성).
4. **생성 엔진 착수 허가가 아니다** — 본 테이블이 깔려도 생성 코드 착수는
   `phase2-entry-gate-checklist.md` §2 전 항목(6b·6f·G-1 R1~R5·E0) 충족 후다.
5. **스키마 드리프트 자동 방지가 아니다** — 본체 컬럼 추가 시 mock 동기는 프로세스(ADR-046 D-5
   체크리스트 확장) + 대조 테스트(G-6c-5)가 담보. 트리거로는 못 잡는다.

---

## 1. 실측 사실 (file:line — 2026-07-02 전수 실파일 재확인)

### 1.1 본체 draft 표현 3중 부재 (카드 #12 근거 재검증 ✓)

1. status CHECK 에 'draft' 없음 — `migrations/0001_initial_schema.sql:128`
   `CHECK(status IN ('active','deprecated','flagged'))`.
2. status UPDATE 동결 — `migrations/0038_exam_questions_metadata_update_allow.sql:53`
   (`NEW.status IS NOT OLD.status` → ABORT, D-2). **production 라이브** (결재 #11 집행 2026-06-11,
   트리거 `prevent_exam_questions_body_update` 교체 확인 — MASTER_PLAN §6 #11).
3. 전이 로그 우회로도 불가 — `migrations/0010_status_transitions_and_page_ref_guard.sql:27`
   `target_type CHECK(target_type IN ('node','formula','constant'))` = exam_question 미커버.

### 1.2 본체 22컬럼 (ADR-046 D-0 4분류 = 유일 진실원)

- 0001:114-130 초기 15컬럼 + `0002_1st_exam_extension.sql:20-30` 확장 4(exam_type/topic_cluster/
  memorization_type/confusion_type) + `0032_exam_questions_input_type.sql:18-23` 확장
  3(input_type/distractors/calc_variables) = **22컬럼**. Drizzle 정본 `apps/api/src/db/schema.ts:351-377`.
- ADR-046 D-0 분류: 본문 8 / 메타 화이트리스트 6 / 상태머신 4 / 답안안전 2 / 불변 2 (허용 6·ABORT 16).

### 1.3 본체 INSERT 게이트 현황 — "무게이트 적재" 리스크의 실체

- `migrations/0005_not_null_triggers_completion.sql:97-123` — exam_questions **BEFORE INSERT 트리거
  4종**(year/content/status/created_at NOT NULL)뿐. 즉 **INSERT 자체는 열려 있고 내용 검증은 0** —
  생성 코드가 본체에 INSERT 하면 NOT NULL 만 통과하면 적재된다. 이것이 카드 #12 가 막으려는 경로.

### 1.4 차기 마이그 슬롯 = **0040**

- `migrations/` 실측 최신 = 0038 (카드 #12 "표기 정정"과 일치 — MASTER_PLAN.md:179 의 "0020+ 슬롯"은
  stale). **0020 은 결번**(0019→0021)이나 재사용 금지 — 테스트 하네스
  `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:122-127` `createD1FromAllMigrations` 가
  `readdirSync().sort()` 사전순 적용이라, 결번 재사용 시 신규 환경은 0020 을 0021 앞에 적용하지만
  production 은 이미 0021~0038 적용 후라 **적용 순서가 분기**한다.

### 1.5 격리·게이트 선례 (준용 대상)

- draft-only INSERT + 근거 필수: `migrations/0018_enforce_draft_only_insert.sql:20-25`
  (`WHEN NEW.status != 'draft'` ABORT) + :32-37 (`WHEN NEW.page_ref IS NULL` ABORT) — knowledge_nodes
  BATCH-1 진입 차단 게이트.
- 상태 전이 어휘: `migrations/0010:29-30` `CHECK(... IN ('draft','review','approved','flagged'))`.
- 문항 id 실컨벤션: `Q-YYYY-RR-NNN` (예 `Q-2023-09-001` —
  `docs/batch-load/batch-Q-2023-9-1st/batch-Q-2023-09-1st-insert.sql:4`).

---

## 2. 설계 방향 (채택안 (b-2) — 격리 스테이징)

### 2.1 설계 불변식 3 (결재 #12 (b-2) 전제 — 위반 시 plan 무효)

1. **본체 무접촉**: 마이그 0040 는 `CREATE TABLE mock_exam_questions` + mock 대상 트리거·인덱스만.
   `exam_questions` 의 DDL·트리거·인덱스·행 접촉 0 (ALTER/DROP/UPDATE/INSERT 전무).
2. **가역**: 롤백 = mock 테이블·트리거 DROP 만으로 완결, 본체 무영향.
3. **0038 D-2 불변**: 본체 status·superseded_by 동결 유지. 스테이징 상태머신은 mock 자체 컬럼.

### 2.2 스키마 초안 (컬럼 명세 — SQL 아님. 본체 22컬럼 대조 기반)

| 그룹                        | 컬럼                                                                                                                                                                                                                                                                                                                                                                                                                                             | 처리                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **콘텐츠 미러 16**          | content, answer, explanation, subject, year, round, question_number, exam_type, related_nodes, related_constants, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables                                                                                                                                                                                                                                      | 본체와 **동명·동타입** 미러 — 승격 INSERT 1:1 매핑 (ADR-046 D-0 의 본문 8 + 메타 6 + 답안안전 2) |
| **본체 전용 6 — 미러 제외** | id(본체 PK)·status(본체 의미)·superseded_by·valid_from·valid_until·created_at(본체)                                                                                                                                                                                                                                                                                                                                                              | 스테이징에서 무의미 또는 D-2 충돌 — 아래 스테이징 전용 필드로 대체 (PITR §3-A)                   |
| **스테이징 전용**           | id(mock 자체 PK — 본체 `Q-` 컨벤션과 비충돌 접두, 예 `MQ-…`. 확정 = §7) · status(스테이징 상태머신 — CHECK, 어휘 = PITR §3-B) · source_refs(생성 근거 출처 — **NOT NULL**, "근거 0건 = approved 불가" 정책) · generation_run_id(생성 이력 추적) · target_question_id(기존 문항 대체 의도 시 원행 참조 — nullable, §0-2 제약 명기) · reviewed_by / reviewed_at / review_note(검수 기록) · promoted_to(승격 후 본체 행 id — nullable) · created_at | 신설                                                                                             |

### 2.3 게이트 트리거 설계 사양 (SQL 작성은 §7 승인 후 — 0018/0010 패턴 준용)

- **T-1 draft-only INSERT**: `BEFORE INSERT WHEN NEW.status != 'draft'` → ABORT (0018:20-25 패턴).
  AI 적재 시점의 Hard Limit 기계 강제.
- **T-2 근거 필수 INSERT**: `BEFORE INSERT WHEN NEW.source_refs IS NULL` → ABORT (0018:32-37
  page_ref 패턴 — 출처 추적성 1급 정책).
- **T-3 전이 가드 (BEFORE UPDATE)**: approved 전이는 reviewed_by/reviewed_at NOT NULL 필수 +
  일방향(역행 금지 — 0010 전이 가드 패턴 이식). 깊이 = PITR §3-C.
- **T-4 검수 후 본문 동결**: status='approved' 행의 콘텐츠 미러 16컬럼 UPDATE → ABORT (검수 무효화
  차단). draft/review 상태의 본문 UPDATE 는 허용 — 반려→수정 재제출 워크플로우 필요분.

### 2.4 승격(mock→본체) 계약

1. **승격 대상**: 인간 검수 status='approved' 행만. 실행 = production 쓰기 = **진산 인증 게이트**
   (wrangler 쓰기 — Claude 자율 금지, 결재 #11 선례).
2. **방식 = 본체 신규 INSERT 만 (본체 UPDATE 0)** — 0038 default-deny 트리거는 UPDATE 전용이므로
   비발동, INSERT 는 0005 NOT NULL 4종 + 0001:128 status CHECK 를 통과해야 한다. 콘텐츠 미러
   16컬럼 1:1 매핑 + 본체 id 신규 발급(`Q-` 계열 — 기출과의 식별 구분 = §7 결재) + 승격 후
   mock 행에 `promoted_to` 기록.
3. **Hard Limit 해석 명문화 (ADR 동결 대상)**: "AI 생성 데이터는 draft 로만 적재"의 이행 지점 =
   mock 테이블(T-1). 승격 INSERT 는 "인간 검수 후 approved" 단계의 구현이므로 본체
   status('active' CHECK 어휘) 로 진입해도 Hard Limit 정합 — 이 해석을 6c ADR 로 동결한다
   (G-WS6 ④ 잔여 절반).
4. **기존 문항 대체(SUPERSEDES) 승격 = 본 plan 범위 밖** (§0-2. ADR-046 D-6 (a) 결재의 distractor
   백필 경로 포함 — 원행 `superseded_by` 마킹이 0038:54 ABORT). 개방 = D-2 재결재 별도 plan(§7-4).
5. **승격 후 mock 행 보존** (DELETE 금지) — 생성→검수→승격 감사 추적(promoted_to 링크).

### 2.5 소비측 격리 (무게이트 적재 경로 0)

- 학습자 경로(/study, /search 등)는 `exam_questions` 만 조회 — **mock 테이블 참조 0** (G-6c-3 grep
  게이트). mock 조회는 admin 검수 경로 전용(검수 UI/API 설계 = Phase 2 admin 몫, 본 plan 범위 밖).
- 생성 코드의 적재 표적 = mock 테이블 **만**. 본체 직접 INSERT 코드 = 착수 금지
  (`phase2-entry-gate-checklist.md` §1 위반 판정).

### 2.6 드리프트 방지 (카드 #12 가 못박은 (b-2) 약점의 상쇄)

- **ADR-046 D-5 체크리스트 확장** (SQL 승인 시 ADR-046 개정 동반): exam_questions 컬럼 추가 절차에
  "⑤ mock_exam_questions 미러 여부 판정(콘텐츠 컬럼이면 mock 동기 마이그 동반)" 항목 추가.
- **대조 테스트 (G-6c-5)**: `createD1FromAllMigrations` 하네스에서 `PRAGMA table_info` 로 본체
  콘텐츠 16컬럼 전수가 mock 에 동명 존재함을 기계 검증 — 컬럼 추가 누락 시 red.

---

## 3. PITR — (b-2) 내부 세부 설계 선택지 (채택 = §7. 권고만 제시)

| 축                    | 선택지                                                                                | 권고                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. 미러 범위**      | (A-1) 22컬럼 전체 미러 / (A-2) 콘텐츠 16 + 스테이징 전용                              | **A-2** — Temporal 4컬럼(superseded_by 등)은 승격 후 본체에서만 의미. 전체 미러는 D-2 의미 혼선 + 드리프트 표면만 증가                                           |
| **B. 상태 어휘**      | (B-1) 0010 어휘 재사용(draft/review/approved/flagged) / (B-2) 자체 어휘(+rejected 등) | **B-1** — 기존 상태머신 어휘 정합(0010:29-30). 반려 = flagged + review_note 로 표현(신규 어휘 0)                                                                 |
| **C. 전이 가드 깊이** | (C-1) T-1 draft-only 만(최소) / (C-2) T-1~T-4 전부                                    | **C-2** — approved 사후 변조·검수 우회가 학습자 정답면 직격. 트리거 4개 비용 대비 0010/0018 검증된 패턴                                                          |
| **D. 승격 실행 형태** | (D-1) 수동 SQL(진산 인증 세션·건별) / (D-2) admin API 경로 / (D-3) batch loader 확장  | **D-1 초기** — 소량·가역·인증 게이트 자연 정합. D-2/D-3 은 Phase 2 admin 검수 UI 설계와 묶어 별도 결재(승격 자동화 = 무게이트 경로 재발 위험이라 단독 채택 금지) |

---

## 4. Binary Gate (G-6c-1~7 — 전부 PASS 전 "완료" 선언 금지)

1. **G-6c-1**: mock INSERT `status != 'draft'` → ABORT 테스트 (approved/active/review 직행 전부 거부).
2. **G-6c-2**: `source_refs IS NULL` INSERT → ABORT 테스트 (근거 0건 = 적재 불가).
3. **G-6c-3 (S11 원문 게이트)**: "AI 생성물이 exam_questions 에 무게이트 적재되는 경로 0" — 생성·적재
   코드의 본체 직접 INSERT 0건 + 학습자 라우트의 mock 참조 0건 (grep 증명 + 리뷰 확인).
4. **G-6c-4 (본체 무접촉 증명)**: 마이그 0040 적용 전후 `sqlite_master` 의 exam_questions 관련
   DDL·트리거·인덱스 문자열 전수 동일 + 행 수 동일 (로컬 하네스 테스트).
5. **G-6c-5 (드리프트)**: 본체 콘텐츠 16컬럼 전수 mock 동명 존재 — `PRAGMA table_info` 대조 테스트.
6. **G-6c-6 (승격 시뮬레이션)**: approved mock 행 → 본체 INSERT 가 0005 NOT NULL 4종 + 0001:128
   CHECK 통과, 그 과정에서 본체 UPDATE 0(0038 트리거 비발동) — 로컬 하네스 검증.
7. **G-6c-7 (가역)**: mock 테이블·트리거 DROP 후 G-6c-4 재실행 PASS (본체 무영향 재증명).

## 5. 위험 분석

| 위험                                                  | 완화                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| 본체 22컬럼 ↔ mock 미러 드리프트 (카드 #12 명기 약점) | §2.6 D-5 확장(프로세스) + G-6c-5(기계)                                   |
| 승격 경로가 인간 검수 우회                            | T-3(approved 전이 = reviewed_by 필수) + D-1 수동 승격(초기) + G-6c-6     |
| mock 데이터의 학습자 노출                             | §2.5 소비측 격리 + G-6c-3                                                |
| "기존 문항 대체 불가(D-2)"를 잊고 대체 생성 착수      | §0-2 Reality Anchor + target_question_id 컬럼 주석 명기 + §7-4 결재 항목 |
| 결번 0020 재사용으로 마이그 적용 순서 분기            | §1.4 — 슬롯 0040 고정                                                    |
| 검수 반려 후 재제출 경로 부재로 운영 막힘             | T-4 가 draft/review 본문 UPDATE 는 허용 (동결은 approved 만)             |

## 6. 실행 순서 (§7 승인 후 — 순서 역전 금지)

1. §7 결재 (SQL 작성 승인 + PITR 채택) → 2. 6c ADR 작성·Accepted (승격 계약·Hard Limit 해석 동결,
   G-WS6 ④) + ADR-046 D-5 확장 개정 → 3. 마이그 0040 SQL + G-6c-1~7 테스트 작성 (로컬
   createD1FromAllMigrations 하네스) → 4. 4-Pass 독립 리뷰 CRITICAL 0 + api vitest 회귀 0 → 5. production 적용 = 진산 Cloudflare 인증 게이트 (wrangler 쓰기 — Claude 자율 금지) → 6. `phase2-entry-gate-checklist.md` §2-2 상태 갱신.

## 7. 결재란 (진산 — 전부 ☐ 상태로 상신)

| #   | 결재 항목                                                                                                                            | 확인 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 1   | **마이그 0040 SQL 작성 승인** (본 plan §2 설계 기준 — 작성 후에도 production 적용은 #5 별도)                                         | ☐    |
| 2   | PITR 채택: A(미러 범위)·B(상태 어휘)·C(가드 깊이)·D(승격 형태) — 권고 A-2/B-1/C-2/D-1                                                | ☐    |
| 3   | mock id 접두 + 승격 시 본체 id 발급 규칙 (기출 `Q-YYYY-RR-NNN` 과 식별 구분 — 권고: mock=`MQ-` 접두, 본체 발급 규칙은 ADR 에서 확정) | ☐    |
| 4   | 기존 문항 대체 승격(원행 superseded_by 마킹 — 0038 D-2 재결재) 별도 plan 시점 (권고: distractor BATCH 7c 착수 전, ADR-046 D-6 연동)  | ☐    |
| 5   | production 적용 (wrangler --remote — 진산 인증 실행 또는 위임)                                                                       | ☐    |

- approved_by: **TBD** (§7-1 승인 시 갱신 — 그 전 SQL 0줄 유지)
- 독립 리뷰 링크: (SQL 작성 후 `.claude/reviews/review-*` 기록)
