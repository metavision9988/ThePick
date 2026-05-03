# Pass 3 ADVOCATE — Session 039 ADR-030 + migrations/0019 + 코드 fix

- 일시: 2026-05-03
- 리뷰어: security-engineer (독립 에이전트, 자가 리뷰 X)
- 범위: Session 039 변경 15 파일 (migration 0019, schema-validator, draft-loader, schema.ts, fixtures, ADR-030)
- 관점: Pass 3 ADVOCATE — 보안 + UX + 접근성 + 오프라인 + 정답 안전
- 4-Pass §0 규칙 준수: 0건 보고 시 확인 증거 3개+ 명시, Devil's Advocate 1건+ 의무

---

## 요약

| 분류     | 건수 | 비고                                                                                                                    |
| -------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| Critical | 0    | (확인 증거 4개)                                                                                                         |
| Major    | 2    | (M-1 트리거 한국어 메시지 사용자 노출 / M-2 admin-web NULL 처리 컨트랙트 부재)                                          |
| Minor    | 3    | (m-1 chapter/section 길이 캡 부재 / m-2 IndexedDB 4 컬럼 mirror 누락 / m-3 page_ref vs book_page 통합 표시 컨벤션 미정) |

**판정: 수정 불필요 (Critical 0건). M-1, M-2 는 BATCH-1 v2 + admin-web /telemetry NULL UI 본격 작업 시점에 흡수.**

---

## 보안 (Security)

### 확인 증거 (4건)

1. **SQL Injection 방어 정합 — draft-loader 의 4 신규 컬럼 모두 bind() 경유**
   - `apps/batch/src/loader/draft-loader.ts:313-348` — INSERT OR IGNORE INTO knowledge_nodes (..., book_page, pdf_page, chapter, section, ...) 의 17 placeholder 모두 `?` parameter binding. 인라인 string concatenation 0건.
   - `node.book_page` / `node.pdf_page` / `node.chapter ?? null` / `node.section ?? null` 4 값 모두 D1 prepared statement 의 `bind()` 인자로만 전달. SQLi 차단.

2. **XSS payload 차단 정합 — schema-validator raw 단계 6 패턴 검사**
   - `packages/parser/src/schema-validator.ts:548-555` `XSS_PAYLOAD_PATTERNS` 6 패턴 (script 태그, javascript: 스킴, event handler attribute, iframe/object/embed) — chapter/section 의 raw text 에 XSS 페이로드 포함되면 `validateRawResponseSecurity` 단계 (parse 이전) 에서 즉시 throw.
   - chapter/section 의 raw 단계 검증 진입 경로 정합 — `validateRawClaudeResponse` (`schema-validator.ts:753-778`) 가 1) `validateRawResponseSecurity` 호출 → 2) `JSON.parse` → 3) `validateKnowledgeContract` 순. raw 단계 XSS 검사가 chapter/section 포함 전체 응답 텍스트 대상.

3. **Hard Rule 17 위반 차단 정합 — chapter/section 에 examId literal 인용 차단**
   - `packages/parser/src/schema-validator.ts:578` `HARD_RULE_17_LITERALS = Object.values(EXAM_IDS)` — EXAM_IDS catalogue runtime values 를 raw 응답에서 `includes()` 검사.
   - chapter/section 본문에 `'son-hae-pyeong-ga-sa'` 같은 literal 이 우연/악의로 들어오면 `validateRawResponseSecurity` 4번째 검사에서 throw.

4. **Secondary XSS 차단 — 에러 메시지 HTML escape**
   - `packages/parser/src/schema-validator.ts:561-569` `escapeHtmlSnippet()` — 에러 metadata 의 `rawSnippet` / `match[0]` 모두 HTML metacharacter (`& < > " '`) escape. admin-web UI 가 sanitize 안 해도 secondary XSS 차단 보장.
   - chapter/section value 가 에러 메시지에 surface 될 때도 동일 escape 경로 (`schema-validator.ts:336, 346` 의 ValidationError.value 는 caller 측 surface 시 escape 대상).

### Devil's Advocate — 깨질 수 있는 시나리오

**시나리오 1 (Major):** chapter/section 의 raw 단계 검증은 PASS 하지만, 검증 결과 통과 후 admin-web 에서 ContentQueue / GraphVisualizer 가 직접 `node.chapter` 를 unsafe HTML injection 경로 (React unsafe innerHTML props 또는 vanilla `innerHTML`) 로 렌더링한다면 secondary XSS 위험 존재. 현재 `apps/admin-web/src/components/ContentQueue.tsx:111-118` 는 chapter/section 를 미참조하므로 Year 1 시점 영향 0. 단 BATCH-1 v2 적재 후 chapter/section UI 노출 시점에 다시 점검 필수 (M-2 항목과 연결).

**시나리오 2:** XSS_PAYLOAD_PATTERNS 가 `<style>` 태그를 포함하지 않음. chapter/section 에 `<style>body{display:none}</style>` 같은 CSS injection 페이로드가 들어오면 raw 단계 검증 통과. 단 admin-web 이 sanitize 안 한 채로 unsafe HTML 렌더할 때만 위험. React 기본 escape + 본 시점 UI 미노출 → 영향 0. Year 2 multi-exam 확장 + 외부 LLM 응답 직접 렌더 경로 추가 시 점검 필요.

---

## UX (사용자 경험)

### 확인 증거 (3건)

1. **트리거 차단 메시지가 BATCH 적재 단계 한정 — 수험자 노출 경로 0건**
   - `migrations/0019_knowledge_nodes_page_chapter_meta.sql:64, 71` `RAISE(ABORT, 'ADR-030 violation: knowledge_nodes INSERT requires book_page (사용자 노출용 본문 페이지). 출처 추적성 의무.')` 메시지는 한국어이지만 DB INSERT 에 한정 발생. INSERT 호출자는 `apps/batch/src/loader/draft-loader.ts:151` `db.batch(all)` — 즉 BATCH 적재 시점만 발생.
   - 수험자(end-user) 는 PWA `apps/web/` 측에서 read-only 조회만 함 (`apps/web/src/lib/db.ts:8-12` "현 단계 (가-1) 동기화 방향: D1 → IndexedDB 단방향 read only"). 수험자 측 INSERT 경로 0건 → 본 트리거 메시지 노출 가능성 0.

2. **검수자(admin) 대상 메시지로 한국어 적합**
   - 트리거 발생 시 메시지 수신자는 BATCH 운영자(진산님 본인) — 한국어 메시지가 오히려 의도 정합. `'ADR-030 violation: knowledge_nodes INSERT requires book_page'` 형식은 ADR 추적 가능성 + 한국어 부연으로 운영자 친화적.

3. **page_ref 통합 표시 컨벤션 정합 — 수험자 UX 1급 기능 정합**
   - `migrations/0019_knowledge_nodes_page_chapter_meta.sql:21` "page_ref TEXT 그대로 유지 — 사용자 노출 통합 텍스트 ('본문 p.415 / 제1장 제3절 (다) 낙엽률조사')" — 수험자에게 노출되는 통합 텍스트는 `page_ref` 1 컬럼이 책임. 4 신규 컬럼은 구조화 메타 (조회/필터링).
   - 메모리 `project_source_citation_requirement` ("수험자 근거 보기 UX 1급 기능") 정합 — 수험자에게는 가독 통합 텍스트, 시스템에는 구조화 컬럼 분리.

### Major — M-1: 트리거 메시지 한국어 일부 — production logging stack 호환성

- **위치:** `migrations/0019_knowledge_nodes_page_chapter_meta.sql:64, 71`
- **현황:** 트리거 RAISE 메시지가 한국어/영문 혼합 (`'ADR-030 violation: knowledge_nodes INSERT requires book_page (사용자 노출용 본문 페이지). 출처 추적성 의무.'`).
- **위험:** Cloudflare D1 → Workers Trace → Logpush → 외부 분석 도구 (Splunk/Datadog) 경로에서 일부 logger 가 UTF-8 multi-byte 문자열을 escape sequence (`\uXXXX`) 로 변환 시 가독성 저하. Workers Trace UI 자체는 UTF-8 정상 표시 확인 (Cloudflare 공식 docs).
- **영향:** 본 시점 영향 0 (Phase 2 Cloudflare-only logging stack). Phase 3 외부 분석 도구 통합 시점에 재평가.
- **권고:** Phase 3 로그 통합 직전 해당 트리거 메시지 영문 단순화 (`'ADR-030: book_page required (NOT NULL)'`) 또는 trigger 메시지 ↔ UI 메시지 역할 분리 ADR 추가 검토.
- **차단력:** 본 step 차단 X. 추후 phase 흡수.

### Major — M-2: admin-web 측 NULL chapter/section 표시 컨트랙트 부재

- **위치:** `apps/admin-web/src/components/ContentQueue.tsx` (현재는 chapter/section 미참조), `apps/admin-web/src/types/graph.ts:6-15` `VisNode` 타입 (chapter/section 부재)
- **현황:** 마이그레이션 0019 적용 직후 기존 row 의 `chapter/section` 은 모두 NULL. 향후 BATCH-1 v2 채움 후에도 LAW-NNN (법령 노드) 는 chapter/section NULL 정합 (마이그레이션 주석 line 51).
- **위험:** admin-web 이 향후 chapter/section 컬럼을 surface 시 `node.chapter` 가 NULL 인 경우 `undefined` 또는 `"null"` 문자열이 UI 에 노출될 수 있음. 검수자 입장에서 "법령 노드는 챕터 개념 없음" 인지 어려움.
- **영향:** 본 step 영향 0 (admin-web UI 변경 0건). BATCH-1 v2 적재 후 admin-web /telemetry 에서 chapter/section 표시 로직 추가 시점에 발생.
- **권고:** admin-web `VisNode` 타입에 `chapter?: string | null` / `section?: string | null` 추가 + 표시 컨벤션 ("—" 대시 또는 "(법령)" 라벨) 명시. 다음 step 또는 BATCH-1 v2 직전에 별도 plan 으로 처리.
- **차단력:** 본 step 차단 X.

### Devil's Advocate — 깨질 수 있는 시나리오

**시나리오:** 트리거 메시지의 한국어 부분이 SQLite RAISE error.message 를 통해 Cloudflare D1 의 error response body 에 그대로 포함되고, 만약 batch-loader 가 error.message 를 그대로 admin-web 에 응답으로 전달한다면 검수자 UI 에 한국어 노출 정합. 단 진짜 위험은 진산님 운영 외 제3자 검수자(향후 Year 2 외주 검수팀) 도입 시 발생. 본 시점 단일 운영자라 위험 0.

---

## 접근성 (Accessibility)

### 확인 증거 (3건)

1. **본 step UI 변경 0건 — 접근성 적용 대상 부재**
   - `apps/admin-web/src/components/ContentQueue.tsx`, `GraphVisualizer.tsx`, `TelemetryDashboard.tsx` 본 session 039 변경 0건.
   - 4-Pass §"규칙 2: 증거 기반 보고" 의 N/A 분류 정합 — UI 변경 0건이므로 aria-label / 터치 타겟 / 키보드 내비게이션 검사 N/A.

2. **chapter/section 향후 UI 노출 시 접근성 의무 명시**
   - 메모리 `project_source_citation_requirement` "수험자 근거 보기 1급 기능" + 본 ADR-030 "사용자 노출용" 명시 → BATCH-1 v2 적재 후 수험자 PWA 측 노출 시점에 aria-label "본문 페이지 N, 제M장 제K절" 강제 의무.
   - 모바일 80% 정합 — 챕터/절 제목은 긴 한국어 텍스트 (예: "제1장 농업재해보험 손해평가 개관") → 모바일 wrap 처리 + truncate aria-label 보존 의무.

3. **PWA 측 Dexie schema 본 step 변경 0건 — 동기화 시점 재검토**
   - `apps/web/src/lib/db.ts:18-35` `IKnowledgeNode` 인터페이스에 `bookPage/pdfPage/chapter/section` 부재. 본 변경은 D1 한정.
   - 마이그레이션 주석 "현 단계 (가-1) 동기화 방향: D1 → IndexedDB 단방향 read only" — 향후 sync 도입 시점에 IndexedDB schema 4 컬럼 mirror 의무 (Minor m-2 항목).

### Devil's Advocate

**시나리오:** 향후 chapter/section UI 노출 시 모바일 좁은 화면(360px width) 에서 "제1장 농업재해보험 손해평가 개관" + "제3절 현지조사 내용" + "(다) 낙엽률조사" 3 단계 cascade 가 모두 표시되면 UI overflow 위험. design 작업 시점에 truncation strategy + aria-label full text 보존 의무.

---

## 오프라인 (Offline / PWA)

### 확인 증거 (3건)

1. **본 step Service Worker / cache strategy 변경 0건**
   - 본 step 변경 파일 15개 모두 `apps/batch/`, `packages/parser/`, `apps/api/src/db/schema.ts`, `migrations/`, `docs/`, `tests/` 한정. `apps/web/src/sw/` (service worker) / `apps/web/src/lib/db.ts` (Dexie) 변경 0건.

2. **D1 → IndexedDB 단방향 read-only sync — 본 변경 영향 0**
   - `apps/web/src/lib/db.ts:8-12` "현 단계 (가-1) 동기화 방향: D1 → IndexedDB 단방향 read only" — 본 step 은 D1 측 schema 확장만, IndexedDB 측 변경 미요구.
   - 학습자 진도 변경 → D1 동기화는 Phase 2 본격 구현 (메모리 `project_v3_final_multi_exam_deferred` 정합).

3. **offlineActions 큐 영향 0**
   - `apps/web/src/lib/db.ts:148-155` `IOfflineAction` 인터페이스 변경 X. 본 step 은 학습자 행동 큐 구조 무관 (page meta 는 read-only 조회 데이터).

### Minor — m-2: IndexedDB Dexie schema 4 컬럼 mirror 누락 (예약 사항)

- **위치:** `apps/web/src/lib/db.ts:18-35` `IKnowledgeNode`
- **현황:** Dexie 측 `IKnowledgeNode` 에 `bookPage/pdfPage/chapter/section` 4 컬럼 부재.
- **영향:** 현 단계 (가-1) D1 → IndexedDB 단방향 read-only 미구현이므로 본 시점 영향 0.
- **권고:** Phase 2 sync-engine 모듈 신설 step 시점에 Dexie version(3) 으로 4 컬럼 추가 + 마이그레이션 코드 작성. 현 시점 차단 X.

### Devil's Advocate

**시나리오:** Phase 2 sync-engine 도입 시점에 Dexie schema 갱신을 누락하면, D1 의 chapter/section 정보가 PWA 측 학습자 화면에서 sync 되어 표시되지 않는 silent failure 발생. ADR-030 의 "수험자 노출용" 의도 위반. 본 step 시점에는 영향 0이지만 Phase 2 진입 게이트에 명시 의무.

---

## 정답 안전 (Answer Safety)

### 확인 증거 (3건)

1. **본 변경은 page meta 한정 — 산식/정답 무관**
   - migration 0019 의 4 신규 컬럼 (book_page/pdf_page/chapter/section) 은 페이지 추적 메타. formulas 테이블 / constants 테이블 / exam_questions 테이블 변경 0건.
   - Formula Engine `packages/formula-engine/`, exam_questions 정답 검증 경로 본 step 영향 0.

2. **schema-validator 단계 정수 검증 강화**
   - `packages/parser/src/schema-validator.ts:150-154` `isValidSourcePage()` — 양의 정수만 통과 (0/음수/NaN/Infinity/null/undefined 거부). book_page/pdf_page 도 `isValidSourcePage` 재사용 (line 306, 318) → page 값 무결성 1차 방어선.

3. **DB 트리거 2차 방어선**
   - `migrations/0019_knowledge_nodes_page_chapter_meta.sql:60-72` 두 트리거가 application bypass (예: schema-validator 우회 INSERT) 시에도 NULL 차단.

### Devil's Advocate

**시나리오:** book_page 가 `1` 같은 비현실 값 (실제 교재는 p.396-434 범위) 으로 들어와도 schema-validator + DB 트리거 모두 PASS (양의 정수). 향후 ADR-030.1 (page range 검증 — 교재별 valid range Constants DB 조회) 보강 검토.

---

## 추가 의문 응답

### Q1. validateRawClaudeResponse 의 chapter/section 처리

- `packages/parser/src/schema-validator.ts:753-778` 정상 흐름 — 1~5 단계 (validateRawResponseSecurity) 가 raw 전체 텍스트 검사 (XSS / Hard Rule 17 / depth) → JSON.parse → 7. structural validation (chapter/section 비어있지 않은 string 검증) → 통과 시 KnowledgeContract 반환.
- chapter/section 에 외부 LLM raw 응답이 들어와도 동일 5+1+1 단계 모두 거침. 별도 처리 필요 X.

### Q2. migration 0019 트리거의 기존 row 영향

- 트리거 2개 (`enforce_book_page_on_insert`, `enforce_pdf_page_on_insert`) 모두 `BEFORE INSERT ... WHEN NEW.book_page IS NULL` — INSERT 만 차단. UPDATE/SELECT 영향 0.
- 기존 row 의 `book_page/pdf_page/chapter/section` 은 ALTER TABLE ADD COLUMN 결과 모두 NULL. SELECT 시 NULL 정상 반환.
- admin-web /telemetry 등에서 NULL 처리 컨벤션 — 마이그레이션 주석 line 117 에 명시 ("admin-web /telemetry 등에서 NULL 처리 의무"). 단 admin-web 측 실제 NULL UI 처리 코드 부재 → M-2 항목으로 보고.

### Q3. chapter/section 길이 임계 부재

- `packages/parser/src/schema-validator.ts:330-349` chapter/section 검증 — `typeof string && trim() !== ''` 만 체크. 길이 상한 부재.
- `apps/batch/src/loader/draft-loader.ts:340-341` `node.chapter ?? null` / `node.section ?? null` 도 길이 검증 부재.
- 위험: 외부 LLM 이 chapter 에 1MB string 을 반환하면 raw 응답 100KB 임계 (`DEFAULT_MAX_RESPONSE_SIZE_BYTES`) 에 1차 차단되지만, 50KB chapter 는 통과 가능. D1 1MB transaction 임계 + SQLite TEXT 무제한 → 현실적 위험은 낮음. Minor m-1 항목.

---

## 최종 판정

**Critical 0건. 본 변경 (ADR-030 + migration 0019 + 코드 fix) 보안/UX/접근성/오프라인/정답안전 5 차원 모두 PASS. 4-Pass Pass 3 통과.**

- **수정 권고:** 없음 (본 step 한정).
- **이월 권고:**
  - M-1 (트리거 한국어 메시지): Phase 3 외부 logging stack 통합 시점.
  - M-2 (admin-web NULL chapter/section UI): BATCH-1 v2 적재 후 chapter/section UI 노출 step.
  - m-1 (chapter/section 길이 캡): 다음 schema-validator 강화 step.
  - m-2 (Dexie 4 컬럼 mirror): Phase 2 sync-engine 모듈 step.
  - m-3 (page_ref vs book_page 통합 표시 컨벤션): UI/디자인 작업 시 design 토큰 정의 step.

- **Devil's Advocate 누적 4건:** 모두 본 step 영향 0, 향후 step 진입 게이트에 명시 권고.
