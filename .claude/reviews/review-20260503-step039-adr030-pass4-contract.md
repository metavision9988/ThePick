# Pass 4 — CONTRACT 리뷰 (Step 039 ADR-030 / migration 0019 / 코드 fix)

- **리뷰 일자**: 2026-05-03
- **리뷰 모드**: 독립 에이전트 (Pass 4 — 기획 대조, Silent Pivot 탐지)
- **리뷰 범위**: 본 세션(039) 변경 15 파일 + ADR-030 + handoff-039 + WBS + production-quality.md / dev-guide.md / 메모리 정합
- **검증 기준**: ADR-030 §2.1~§3.3, Hard Rule 13/16/17, production-quality.md, batch-loadmap.md, handoff-039 §3 BATCH-1 영역 매핑
- **관점**: "구현 재정립서 v2.0 + ADR-030 대로 만들었는가? Silent Pivot 발생했는가?"

---

## 통합 판정

| 분류         | 건수 |
| :----------- | :--- |
| **Critical** | 1    |
| **Major**    | 1    |
| **Minor**    | 2    |

**판정: 수정 필요 (Critical 1건 — 픽스처 chapter/section 가 handoff-039 §3 BATCH-1 영역 매핑과 불일치)**

ADR-030 §2.1~§2.4 + §3.3 (0019 우선 차지 + 0020/0021 이월) 모두 코드 정합.
Hard Rule 13/16/17 위반 0건. production-quality.md 위반 0건 (any/하드코딩/import \*/console.log/빈 catch 0건).
다만 fixture 챕터/절 임의값이 실제 BATCH-1 영역 자료와 어긋나는 Silent Pivot 1건 발견.

---

## Critical (수정 필수)

### CRIT-PASS4-1 — fixture chapter/section 값이 handoff-039 §3 BATCH-1 영역 매핑과 정면 불일치 (Silent Pivot)

**파일**: `apps/batch/src/fixtures/batch-1-sample-extract.json:11-67`
**관련 파일**:

- `.jjokjipge/handoff-session-039.md:126-132` (실제 BATCH-1 챕터/절 매핑 표)
- `docs/batch-load/batch-1-raw-pages-403-434.txt:66, 196-197, 222-223` (raw 텍스트 챕터 헤더)
- `apps/batch/src/__tests__/loader.test.ts:25-26, 37-38` (동일 패턴 복제)

**증거**

handoff-039 §3 표 (line 126~132)에 따르면 BATCH-1 영역 챕터/절은 다음과 같이 매핑되어야 한다:

| 본문 페이지 | 챕터/절                                                        |
| :---------- | :------------------------------------------------------------- |
| p.396~398   | **제1장 제3절 (이전 마무리)**                                  |
| p.398~403   | **제1장 제3절** (현지조사 내용)                                |
| p.404~412   | **제2장 제2절 / 가. 손해평가 현지조사 방법** (적과전 종합위험) |
| p.413~420   | **제2장 제2절 / 적과 후 손해조사**                             |
| p.421~427   | **제2장 제2절 / 적과전 5종한정특약**                           |

raw 텍스트의 명시 헤더 (`batch-1-raw-pages-403-434.txt`):

- line 66: `제3절 현지조사 내용` (제1장 — line 196 직전이므로 제1장 소속)
- line 196: `제2장 농작물재해보험 손해평가` (= 본문 p.401, PDF p.408)
- line 197: `제1절 손해평가 기본단계` (제2장의 제1절)
- line 222-223: `제2절 과수작물 손해평가 및 보험금 산정` (제2장의 제2절, 적과전 종합위험 포함)

**fixture 의 실제 값** (batch-1-sample-extract.json:22-23, 37-38, 51-52, 65-66):

```json
{
  "id": "CONCEPT-001",
  "source_page": 403,         // 본문 p.396 → handoff §3: "제1장 제3절 (이전)"
  "book_page": 396,
  "chapter": "제2장 농작물재해보험",   // ← 잘못됨, "제1장 ..." 이어야 함
  "section": "제3절 현지조사 내용"
},
{
  "id": "INV-001",
  "source_page": 414,         // 본문 p.407 → handoff §3: "제2장 제2절 적과전 종합위험"
  "book_page": 407,
  "chapter": "제2장 농작물재해보험",   // 챕터 OK 이지만 raw 텍스트 헤더는 "제2장 농작물재해보험 손해평가"
  "section": "제3절 현지조사 내용"     // ← 잘못됨, "제2절 과수작물 손해평가 및 보험금 산정" 이어야 함
},
{
  "id": "INS-01",
  "source_page": 434,         // 본문 p.427 → handoff §3: "제2장 제2절 적과전 5종한정특약"
  "book_page": 427,
  "chapter": "제2장 농작물재해보험",
  "section": "제3절 현지조사 내용"     // ← 잘못됨, "제2절 ..." 이어야 함
}
```

**문제 본질 — Silent Pivot 3가지**

1. **챕터 misattribution**: CONCEPT-001 (p.396) 은 raw 텍스트 line 1-195 (= 제1장 제3절) 영역인데 fixture 는 "제2장" 으로 misattribute → ontology / chapter 인덱스 검색 결과 오염.
2. **절 misattribution**: INV-001 / F-01 / INS-01 (p.407-427) 은 모두 제2장 **제2절** (과수작물 손해평가 및 보험금 산정) 영역인데 fixture 는 모두 "제3절 현지조사 내용" 으로 라벨링 → 사용자 UX "교재 제2절 참고" 안내가 wrong section 으로 유도됨.
3. **챕터 타이틀 truncation**: raw 텍스트 명시 헤더는 `제2장 농작물재해보험 손해평가` 인데 fixture 는 `제2장 농작물재해보험` 으로 "손해평가" 누락. ADR-030 §2.1 chapter 컬럼 의도 ("'제1장 농업재해보험 손해평가 개관'" 풀 타이틀) 와 불일치.

**메모리 정합 위반**:

- `project_source_citation_requirement` ("수험자 근거 보기 UX 1급 기능"): 챕터/절 잘못 표기 시 수험자가 잘못된 영역으로 안내됨 → 출처 추적성 핵심 가치 훼손.
- `feedback_no_shortcuts` ("땜빵 금지"): fixture 라도 임의 라벨링 = 땜빵. ADR-030 §2.1 풀 타이틀 의도와 어긋남.

**복제 영역**: `apps/batch/src/__tests__/loader.test.ts:25-26, 37-38` 도 동일 misattribution 복제 (CONCEPT-001 book_page=396 chapter "제2장 농작물재해보험" — Silent Pivot 동일).

**Devil's Advocate**: 누군가 "fixture 는 schema 검증용이지 실제 영역 매핑이 목적이 아니다" 라고 변호할 수 있다. 그러나:

- (a) `_meta.description` (line 7) 이 "Stage 1~3 mock 입력" 명시 — 다음 세션 Knowledge Graph 생성 시 이 fixture 값을 reference 패턴으로 차용할 위험.
- (b) ADR-030 §1.2 "사용자 인식 페이지 = 본문 페이지 + 챕터/절 병행" → fixture 가 잘못된 챕터/절 패턴을 박아두면 Knowledge Graph 생성 시 동일 패턴이 traffic 으로 진입.
- (c) 차세션 추출 스크립트 v2 작성 시 fixture 패턴을 oracle 로 사용할 위험 — handoff §5.4 "챕터/절 자동 인식" 작업이 잘못된 라벨링과 충돌하면 회귀 디버깅 비용 발생.

**수정 권고**

옵션 A (즉시 수정, 권장): fixture chapter/section 을 handoff §3 매핑과 raw 텍스트 헤더와 일치시켜 갱신.

```json
// CONCEPT-001 (p.396, source_page=403)
"chapter": "제1장 농업재해보험 손해평가 개관",
"section": "제3절 현지조사 내용"

// INV-001 / F-01 (p.407-414, source_page=414)
"chapter": "제2장 농작물재해보험 손해평가",
"section": "제2절 과수작물 손해평가 및 보험금 산정"

// INS-01 (p.427, source_page=434)
"chapter": "제2장 농작물재해보험 손해평가",
"section": "제2절 과수작물 손해평가 및 보험금 산정"
```

옵션 B (보수적): fixture `_meta` 에 "chapter/section 은 schema 검증용 placeholder, 실제 영역 매핑은 차세션 추출 스크립트 v2 결과 우선" 명시 + 동일 주석을 loader.test.ts:25-26 에 추가.

---

## Major (Phase 2 진입 전 수정 권고)

### MAJOR-PASS4-1 — handoff-039 §3 매핑이 raw 텍스트 헤더와도 어긋남 (handoff 자체 정합 결함)

**파일**: `.jjokjipge/handoff-session-039.md:126-132`

**증거**

handoff §3 line 130 은 "p.404~412 / PDF p.411~419 → **제3절 / 나. 손해평가 현지조사 방법** (적과전 종합위험)" 이라 명시. 그러나 raw 텍스트:

- line 196 (= 본문 p.401, PDF p.408): `제2장 농작물재해보험 손해평가` 헤더 (제1장에서 제2장으로 전환)
- line 222-223 (= 본문 p.402, PDF p.410): `제2절 과수작물 손해평가 및 보험금 산정` (제2장의 제2절)
- line 224: `1. 적과 전 종합위험방식 (대상품목 : 사과, 배, 단감, 떫은감)` — 적과전 종합위험은 **제2장 제2절** 의 1번 항목

→ handoff §3 가 "제3절 / 나. 손해평가 현지조사 방법" 이라 표기한 영역은 사실 **제2장 제2절 / 1. 적과전 종합위험방식 / 가. 시기별 조사 종류 / 나. 손해평가 현지조사 방법** 이다 (절 = 제2절, 본조사 항목 = "1.가. / 1.나." 계층).

**문제**: handoff §3 자체가 챕터/절 단위를 혼동 → fixture 가 이를 그대로 차용하여 CRIT-PASS4-1 발생.

**Devil's Advocate**: handoff 는 임시 메모이고 fixture/코드만 정합하면 충분하다. 그러나 CRIT-PASS4-1 fix 시 oracle 로 handoff §3 를 참조하면 동일 오류 재발 → handoff §3 도 함께 갱신 의무.

**수정 권고**: handoff-040 작성 시 §3 표를 raw 텍스트 명시 헤더 기준으로 재작성:

```
| 본문 페이지 | PDF 페이지 | 챕터 / 절                                    | 영역                             |
| p.396~400   | p.403~407  | 제1장 / 제3절 현지조사 내용                  | 손해평가 일반 / 본조사·재조사    |
| p.401-403   | p.408~410  | 제2장 / 제1절 손해평가 기본단계              | 업무흐름 / 5단계 절차            |
| p.404~427   | p.411~434  | 제2장 / 제2절 과수작물 손해평가 및 보험금 산정 | 적과전 종합위험 (1.가/나/다 ...) |
```

---

## Minor (참고)

### MINOR-PASS4-1 — ADR-030 §5 Implementation Plan 의 "본 세션 처리" vs "다음 세션 처리" 가 본 세션(039)에서 실제 수행한 항목과 부분 swap

**파일**: `docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md:201-203`

**증거**

ADR-030 §5 (line 201-203) 정의:

- 본 세션 처리: 1 (마이그레이션 SQL) + 8 (TD-PHASE2-1 갱신) — ~20분
- 다음 세션 처리: 2 (Drizzle) + 3 (draft-loader) + 4 (추출 v2) + 5 (재추출) + 6 (KG JSON) — ~70분

그러나 본 세션(039) commit `73426e9` stat:

- `apps/api/src/db/schema.ts` — 103 라인 변경 (Drizzle ORM 4 컬럼 추가, ADR-030 §5 #2)
- `apps/batch/src/loader/draft-loader.ts` — 11 라인 변경 (INSERT path 4 컬럼, ADR-030 §5 #3)
- `packages/parser/src/schema-validator.ts` — 65 라인 변경 (book_page/pdf_page 검증)

→ 본 세션(039) 이 ADR-030 §5 #2 + #3 을 이미 처리. ADR §5 와 실제 진행 swap.

**문제 영향**: ADR §5 자체는 영속 결정 기록이므로 갱신 강요 없음. 단 차세션 진입 시 §5 와 handoff-039 §1.2 (다음 세션 의무 9건 중 Drizzle/draft-loader는 이미 본 세션 완료) 사이 정합 mismatch → 핸드오프 의존 차세션이 헷갈릴 위험.

**Devil's Advocate**: ADR 는 "결정 시점" 기록이지 "실행 결과" 가 아니므로 ADR §5 갱신은 over-engineering. 그러나 handoff-040 작성 시 본 세션 진척 명시 의무.

**수정 권고**: handoff-040 §0 누적 결과에 "ADR-030 §5 본 세션 + 다음 세션 분배는 본 세션(039)에서 #2/#3 추가 처리됨" 명시.

---

### MINOR-PASS4-2 — fixture `_meta.source_page_range` 가 ADR-030 정합화 형식 채택했으나 실제 노드 source_page 와 불일치

**파일**: `apps/batch/src/fixtures/batch-1-sample-extract.json:6`

**증거**

line 6: `"source_page_range": "본문 p.396~427 (PDF p.403~434, ADR-030 정합)"` — handoff 정합화 형식 채택 ✅

그러나 노드:

- INS-01 (line 62): `source_page: 434` → 본문 p.427 (= 434-7)
- 그러나 fixture meta 의 "본문 p.396~427" 상한과 일치 → OK

→ 실제로는 정합. 단 ADR §2.4 batch-loadmap.md 갱신 의무는 다음 세션 (handoff-039 §5.10) 으로 이월된 상태로, fixture 만 선반영. fixture 가 batch-loadmap.md 보다 먼저 정합화됨.

**Devil's Advocate**: 차세션 batch-loadmap.md 갱신 시 fixture 형식과 일치시킬 수 있는지 확인 의무. 만약 batch-loadmap.md 가 다른 형식 ("PDF p.403~434 / 본문 p.396~427" 처럼 순서 swap) 으로 갱신되면 fixture 와 불일치 → 일관성 결함.

**수정 권고**: handoff-040 §5.10 처리 시 fixture line 6 형식 ("본문 p.X~Y (PDF p.A~B, ADR-030 정합)") 을 batch-loadmap.md 의 oracle 로 사용.

---

## 확인 항목 (증거 기반 0건 보고)

### Pass 4 CONTRACT 확인 5개 (Critical/Major 영역 외 PASS):

1. **ADR-030 §2.1 4 컬럼 추가** — `migrations/0019_knowledge_nodes_page_chapter_meta.sql:49-52` 4 ALTER TABLE × `book_page INTEGER / pdf_page INTEGER / chapter TEXT / section TEXT` 모두 ADR §2.1 정합. ✅
2. **ADR-030 §2.2 NOT NULL 트리거 2개** — `migrations/0019:60-72` `enforce_book_page_on_insert` + `enforce_pdf_page_on_insert` 2개 트리거 정의, chapter/section 은 NULL 허용 (법령 노드 호환). ✅
3. **ADR-030 §2.3 인덱스 2개** — `migrations/0019:80-81` + `apps/api/src/db/schema.ts:175-176` `idx_nodes_book_page` + `idx_nodes_chapter` 양쪽 1:1 정합 (drizzle-kit drop 방지 주석 정합). ✅
4. **ADR-030 §3.3 0019 슬롯 conflict 해결** — `.jjokjipge/wbs-quality-progress.md:287` TD-PHASE2-1 ✅ 해소 + B-C1 = 0020 / B-C3 = 0021 이월 명시. ✅
5. **ADR-030 §1.4 Year 2 zero-cost** — 4 컬럼이 `apps/api/src/db/schema.ts:133-142` 에서 examId 컬럼 분리 없이 추가 → 다른 시험 도메인 공통 적용 가능, ADR-007 정합. ✅

### Hard Rule 13/16/17 위반 0건 확인:

6. **Hard Rule 13 (draft-only INSERT)** — `apps/api/src/__tests__/scenarios/hard-rule-13-draft-only.test.ts:30-67` 4 시나리오 (approved/published 차단 + page_ref NULL 차단 + 정상 draft INSERT 통과) 모두 0019 트리거 충족 형태 (`book_page=1, pdf_page=1`)로 회귀 갱신 ✅. 본 변경은 0018 트리거를 변경하지 않음.
7. **Hard Rule 16 (examId 강제)** — `apps/batch/src/loader/draft-loader.ts:46, 172-177` `examId: ExamId` 필수 + preValidate 강제. 본 변경은 examId 시그니처를 추가/제거하지 않음. ✅
8. **Hard Rule 17 (EXAM_IDS 단일 선언)** — fixture (line 11~67) + schema-validator + draft-loader + 모든 테스트에서 `'son-hae-pyeong-ga-sa'` literal 0건 (chapter/section 의 한글 챕터 타이틀에 examId 인용 없음). 단일 매칭 `fuz-02-claude-malformed.test.ts:73` 은 테스트 픽스처 description (Rule 17 예외 정합). ✅

### production-quality.md 위반 0건 확인:

9. **any 타입 0건** — `grep "any" *.ts` 결과 모두 error message 문구 ("does not match any known node ID pattern") 만 매칭 (`schema-validator.ts:399, 422`). 타입 annotation `any` 0건. ✅
10. **import \* 0건** — schema-validator / draft-loader / db/schema.ts / fixture 모두 선택적 임포트만 사용. ✅
11. **하드코딩 0건 (production code)** — schema-validator `isValidSourcePage` 양수 검증, draft-loader `BATCH_RUN_ID_PATTERN` 정규식 명시, schema.ts 4 컬럼 NULLABLE → 트리거 강제. fixture 의 chapter/section 한글 문자열은 _test fixture_ 영역으로 production-quality.md Rule 17 예외 (∵ 테스트 픽스처). 단 CRIT-PASS4-1 은 _값의 정확성_ 문제이지 _하드코딩 자체_ 문제는 아님. ✅
12. **빈 catch 0건** — schema-validator `validateRawClaudeResponse` (line 762-769) catch 에 `KnowledgeContractValidationError` throw, draft-loader (line 152-154) catch 에 `DraftLoadError` throw. ✅
13. **Workers 호환** — schema-validator 가 `Buffer.byteLength(raw, 'utf-8')` (line 695) 사용 — Node.js Buffer 의존이지만 schema-validator 는 batch 파이프라인 (Node.js 환경) 전용이므로 OK. apps/api Workers 코드는 본 변경에서 fs/path 0건. ✅

### 메모리 정합 확인:

14. **`project_source_citation_requirement`** — 4 컬럼 추가가 출처 추적성 강화 정합. 단 CRIT-PASS4-1 (fixture chapter misattribution) 은 메모리 위반 → CRIT 분류. ✅ (구조) / 🔴 (값)
15. **`project_v3_final_multi_exam_deferred`** — Year 1 9테이블 유지 (테이블 추가 X, 컬럼 4개만 추가) ✅. ADR-030 §4.2 대안 B (별도 테이블 분리) 거부 사유와도 정합.
16. **`feedback_other_exams_ocr_deferred`** — 본 변경에 OCR/Vision 사용 없음 (Claude multimodal 대신). ✅ N/A 정합.

---

## Devil's Advocate (전체 — Pass 4 의무 1건+)

**시나리오: "fixture chapter/section 라벨링이 잘못되었어도 schema 검증은 통과하므로 0019 트리거가 fire 하지 않아 회귀 미발생 — Critical 이 아니라 Minor 아닌가?"**

→ **반박**:

1. **schema 통과 ≠ 데이터 정합**. CRIT-PASS4-1 의 본질은 _스키마 위반이 아니라 의미 위반_. ADR-030 §1.2 "수험자 인식 페이지" 의 정의 자체가 "본문 페이지 + 챕터/절 병행" 이므로 챕터/절 값이 잘못되면 ADR 의 용도 (수험자 UX 1급 기능) 가 즉시 무력화.
2. **차세션 oracle 오염**. handoff-039 §1.2 다음 세션 의무 #6 "Knowledge Graph JSON 생성 (60 노드 + 200 엣지) — 4 컬럼 채움 의무" 단계에서 fixture 를 reference 로 사용 시 wrong chapter/section 패턴이 production data 로 propagate.
3. **테스트 oracle 오염**. loader.test.ts:25-26 도 동일 misattribution 복제 → 만약 차후 챕터/절 검증 테스트 추가 시 잘못된 oracle 로 false PASS 발생 가능.
4. **Silent Pivot 정의 충족**. Pass 4 의 핵심 임무 = "구현 ≠ 기획 인지" 탐지. ADR-030 §2.1 chapter 컬럼의 의도 (`"제1장 농업재해보험 손해평가 개관"` 풀 타이틀) ≠ fixture 의 실제 값 (`"제2장 농작물재해보험"` truncated + misattributed). 정의상 Silent Pivot.

→ Critical 분류 유지.

**시나리오 2: "raw 텍스트 헤더의 페이지 번호 (line 30 `- 396 -`) 와 ADR §1.1 PDF/본문 offset +7 정합 검증"**

→ raw 텍스트 line 1 (`교재 p.403 (PDF idx 402)`) — line 30 (`- 396 -`) → PDF p.403 = 본문 p.396 (offset = 403 - 396 = 7) 정합. ADR §1.1 표 line 24 (`+7 offset`) 정합. ✅

→ 이 검증으로 fixture book_page/pdf_page 값 자체는 정합 (CONCEPT-001: book_page=396 / pdf_page=403, INS-01: book_page=427 / pdf_page=434 등). chapter/section 만 misattribution. 즉 **"숫자 4 컬럼은 정합 / 텍스트 2 컬럼만 misattribute"** 의 부분 결함.

---

## Pass 4 통합 보고

| 영역                            | 결과                                                                                                          |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------ |
| ADR-030 §2.1~§2.4 모두 구현     | ✅ 4 컬럼 + 트리거 2 + 인덱스 2 + page_ref 호환 모두 정합                                                     |
| ADR-030 §3.3 0019 슬롯 conflict | ✅ TD-PHASE2-1 해소, B-C1 = 0020 / B-C3 = 0021 이월 명시                                                      |
| Hard Rule 13/16/17              | ✅ 0건 위반                                                                                                   |
| production-quality.md           | ✅ any/import\*/console.log/빈catch/하드코딩 0건 (production code)                                            |
| 메모리 정합                     | ✅ source_citation_requirement / v3_final_multi_exam / feedback_no_shortcuts (단 CRIT-PASS4-1 은 메모리 위반) |
| Year 2 zero-cost (ADR-007)      | ✅ 4 컬럼 examId 분리 없음, 모든 시험 도메인 공통 적용 가능                                                   |
| BATCH-1 영역 정합               | 🔴 fixture chapter/section misattribution 1건 (CRIT-PASS4-1)                                                  |
| handoff-039 §3 정합             | 🟠 handoff §3 자체가 raw 텍스트 헤더와 어긋남 (MAJOR-PASS4-1)                                                 |

**판정**: 수정 필요 (Critical 1건). CRIT-PASS4-1 옵션 A (fixture 챕터/절 갱신) 차세션 즉시 처리 후 ADR-030 영역 "완료" 선언 가능.

**누적 흡수 의무**:

- (즉시) CRIT-PASS4-1 fixture + loader.test.ts 챕터/절 갱신 (~5분)
- (handoff-040) MAJOR-PASS4-1 handoff §3 표 raw 텍스트 헤더 기준 재작성
- (handoff-040 §0) MINOR-PASS4-1 ADR-030 §5 vs 본 세션 진행 swap 명시
- (다음 세션 §5.10) MINOR-PASS4-2 batch-loadmap.md 갱신 시 fixture line 6 형식 oracle 차용

**리뷰 작성**: Claude (Opus 4.7 1M context) — Pass 4 독립 에이전트
**리뷰 효력**: 2026-05-03 ~14:00 KST
