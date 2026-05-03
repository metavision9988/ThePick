# ADR-030: Knowledge Nodes 페이지/챕터 메타 4 컬럼 도입 (book_page / pdf_page / chapter / section)

- **상태:** Proposed (2026-05-03 진산님 승인 예정 — Session 038 §"데이터 모델 영향은 승인")
- **결정일:** 2026-05-03
- **결정자:** 진산 (사용자) — Session 038 BATCH-1 진입 직전 페이지 표기 정합화 결정
- **작성:** Claude (Opus 4.7 1M context) — Session 038 BATCH-1 reconnaissance 결과 반영
- **관련 헌법:** Hard Rule 13 (page_ref NOT NULL — 0010/0018), Hard Rule 16 (시험 경계 — Year 2 zero-cost), `project_source_citation_requirement` 메모리
- **관련 ADR:** ADR-007 (멀티시험 공통 기반), ADR-018 (D1 마이그레이션 인프라), ADR-027 (BATCH atomic mid-resume)
- **관련 마이그레이션:** 0019 신설 / 0010 (page_ref 빈문자 차단) / 0018 (page_ref NOT NULL + status=draft 트리거) 호환
- **트리거:** 진산님 (Session 038) "사용자(수험자) 입장에서는 PDF 페이지 번호가 아닌 본문 페이지 번호를 인식 → 정확한 교재 위치 + 챕터 타이틀 병행"

---

## 1. Context (맥락)

### 1.1 BATCH-1 진입 직전 발견된 페이지 단위 mismatch

Session 038 BATCH-1 reconnaissance 중 발견:

| 자료                                                                                     | 페이지 단위                                                                   |
| :--------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| `docs/manual/2026년 「농업재해보험·손해평가의 이론과 실무」 이론서_수정본(26.3.31.).pdf` | PDF 835p, 표지/목차 포함                                                      |
| `docs/plans/batch-loadmap.md` BATCH-1 영역 인용 ("p.403~434")                            | **PDF 페이지** 기준 (검증: PDF idx 421 = PDF p.422 = 단감 산식 1.0115×낙엽률) |
| 교재 footer 페이지 번호 ("- 415 -" 등)                                                   | **본문 페이지** 기준 (PDF p.422 = 본문 p.415, **+7 offset**)                  |
| `docs/manual/ThePick-분석결과.md` 페이지 인용                                            | PDF/본문 혼용 (검증 불일치)                                                   |

**위험 시그널:** Session 038 turn 4 에서 Claude 가 "PDF p.421 image" 라고 표기 → 진산님이 본문 p.414 기준으로 검증 → mismatch catch 부담 발생. 향후 BATCH-2~5 + 사용자 UX ("교재 O장 O절 참고") 에서 동일 부담 누적 위험.

### 1.2 사용자(수험자) UX 관점

`project_source_citation_requirement` 메모리: "수험자 '근거 보기' UX 1급 기능". 수험자가 인식하는 페이지 = **교재 본문 페이지 번호** (PDF 페이지는 의미 0).

추가로 진산님 명시 의무: 챕터/절 + 제목 병행 ("제2장 제1절 + 제목"). 단순 페이지 번호 (예: "p.415") 보다 "**제1장 제3절 / 본문 p.415**" 가 수험자 참고 효율 높음.

### 1.3 현 schema 한계

`migrations/0001_initial_schema.sql` 의 `knowledge_nodes` 테이블:

```sql
CREATE TABLE knowledge_nodes (
  ...
  page_ref TEXT,  -- 단일 텍스트 필드, 형식 미정
  ...
);
```

- `page_ref TEXT` 단일 컬럼 — PDF/본문 페이지 구분 불가, 챕터/절 분리 불가
- `0018_enforce_draft_only_insert.sql` 트리거: `page_ref NOT NULL` 강제 (Hard Rule 13 정합)
- `0010_status_transitions_and_page_ref_guard.sql` 트리거: 빈 문자열 차단

→ `page_ref` 를 그대로 두고 신규 4 컬럼 추가 = **양립 가능** (기존 트리거 호환).

### 1.4 Year 2 멀티시험 영향

`feedback_focus_reliability_not_schedule` + `project_v3_final_multi_exam_deferred` 정합:

- 시험 도메인마다 교재 페이지 표기 단위 다를 수 있음 (PDF / 본문 / 단원 등)
- 4 컬럼 (book_page / pdf_page / chapter / section) 은 모든 시험 도메인 공통 적용 가능
- Year 2 진입 시 컬럼 변경 0건 (zero-cost) → ADR-007 / Hard Rule 17 정합

---

## 2. Decision (결정)

### 2.1 knowledge_nodes 에 4 신규 컬럼 추가

```sql
ALTER TABLE knowledge_nodes ADD COLUMN book_page INTEGER;   -- 사용자 노출용 본문 페이지
ALTER TABLE knowledge_nodes ADD COLUMN pdf_page  INTEGER;   -- PDF 페이지 (추적용)
ALTER TABLE knowledge_nodes ADD COLUMN chapter   TEXT;      -- "제1장 농업재해보험 손해평가 개관"
ALTER TABLE knowledge_nodes ADD COLUMN section   TEXT;      -- "제3절 현지조사 내용"
```

**사용 의도:**

- `book_page`: 사용자 UI 노출 (예: "교재 본문 **p.415** 참고")
- `pdf_page`: 추적용 (PDF 직접 검증 시 사용)
- `chapter`: 사용자 UI 노출 (예: "**제1장** 농업재해보험 손해평가 개관")
- `section`: 사용자 UI 노출 (예: "**제3절 현지조사 내용**")

**기존 page_ref TEXT 호환 유지:**

- `page_ref` 컬럼은 그대로 유지 (사용자 노출 형식 통합 텍스트)
- 예: `page_ref = "본문 p.415 / 제1장 제3절 (다) 낙엽률조사"`
- 4 신규 컬럼 = 구조화된 메타 (조회/필터링용)

### 2.2 신규 트리거 — book_page / pdf_page NOT NULL 강제

```sql
CREATE TRIGGER enforce_book_page_on_insert
BEFORE INSERT ON knowledge_nodes
WHEN NEW.book_page IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ADR-030: knowledge_nodes INSERT requires book_page (사용자 노출용 본문 페이지)');
END;

CREATE TRIGGER enforce_pdf_page_on_insert
BEFORE INSERT ON knowledge_nodes
WHEN NEW.pdf_page IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ADR-030: knowledge_nodes INSERT requires pdf_page (PDF 추적용)');
END;
```

`chapter` / `section` 은 **NULL 허용** — 법령 노드 (`LAW-NNN`) 등 챕터/절 개념이 없는 노드 호환.

### 2.3 인덱스

```sql
CREATE INDEX idx_nodes_book_page ON knowledge_nodes(book_page);
CREATE INDEX idx_nodes_chapter ON knowledge_nodes(chapter);
```

사용자 검색 ("제1장 노드 모두 보기") + page 범위 쿼리 효율.

### 2.4 batch-loadmap.md 페이지 인용 정합화

- 본 ADR 적용 후 batch-loadmap.md 의 "p.403~434" → "**본문 p.396~427 (PDF p.403~434)**" 형식으로 갱신
- ThePick-분석결과.md 도 동일 정합화 (BATCH-2 진입 직전 의무)

---

## 3. Consequences (결과)

### 3.1 Positive

- **사용자 UX 개선** — "교재 제1장 제3절 / 본문 p.415 참고" 형식 = 수험자가 즉시 펼쳐볼 수 있음
- **schema 호환** — 기존 `page_ref` + 0010/0018 트리거 모두 그대로 동작
- **Year 2 zero-cost** — 4 컬럼은 모든 시험 도메인 공통 적용 (ADR-007 정합)
- **추적성 강화** — PDF/본문 mismatch 가 데이터 단위에서 분리 → 향후 BATCH-2~5 검수 부담 0
- **검색 효율** — chapter / book_page 인덱스로 "제1장 노드 모두 보기" 같은 쿼리 O(log N)

### 3.2 Negative

- **마이그레이션 0019 비용** — production D1 ALTER TABLE × 4 회 (Cloudflare D1 ALTER 제약 검토 의무 — 다행히 ADD COLUMN 은 ONLINE 가능)
- **기존 row 호환성** — 0019 적용 시점 기존 row 는 4 컬럼 NULL — 트리거가 신규 INSERT 만 차단하므로 호환. 다만 admin-web /telemetry 등에서 NULL 처리 의무
- **드리즐 ORM 스키마 갱신** — `apps/api/src/db/schema.ts` 에서 knowledge_nodes 정의 4 컬럼 추가 의무 (별도 PR)
- **draft-loader 갱신** — `apps/batch/src/loader/draft-loader.ts` 가 4 컬럼 INSERT path 추가 의무

### 3.3 0019 슬롯 conflict 해결 (handoff-038 §주의사항)

handoff-038 명시: "0019 마이그레이션 번호 conflict 위험 — B-C1 (user_progress.exam_id, Year 2 zero-cost) + B-C3 (engine_telemetry 트리거 옵션 B) 양쪽 0019 슬롯 후보".

**본 ADR 0019 우선 차지 정합:**

- 본 ADR = BATCH-1 적재 직전 의무 (페이지 표기 정합화 차단 게이트)
- B-C1 / B-C3 = Phase 2 진입 시 의무 (BATCH-1 적재 후 시점)
- → 본 ADR = 0019, B-C1 = 0020, B-C3 = 0021 슬롯 할당

**TD-PHASE2-1 갱신 의무**: WBS §5 Devil's Advocate Ledger 의 "0019 conflict" 행을 "0020/0021 슬롯" 으로 변경.

---

## 4. Alternatives Considered (검토된 대안)

### 4.1 대안 A: page_ref TEXT 를 JSON 으로 사용

```sql
-- page_ref = '{"book_page": 415, "pdf_page": 422, "chapter": "제1장", "section": "제3절"}'
```

- **장점**: 마이그레이션 0건 (스키마 변경 없음)
- **단점**: SQLite JSON1 extension 의존 + 쿼리 비효율 (`json_extract(page_ref, '$.book_page') = 415` 매번) + 0010/0018 트리거가 JSON 문자열 검사 → 빈 JSON `{}` 통과 위험 + 인덱싱 어려움
- **판정**: 거부 — 쿼리 효율 + 트리거 호환 위험

### 4.2 대안 B: page_ref TEXT 를 그대로 두고 추가 메타 테이블 분리

```sql
CREATE TABLE knowledge_node_pages (
  node_id TEXT PRIMARY KEY REFERENCES knowledge_nodes(id),
  book_page INTEGER, pdf_page INTEGER, chapter TEXT, section TEXT
);
```

- **장점**: knowledge_nodes 스키마 무변경 + 1:1 외부 테이블 (확장성)
- **단점**: 모든 조회에 JOIN 추가 (성능 손해) + 9테이블 → 10테이블 (`project_v3_final_multi_exam_deferred` 의 "Year 1 현 9테이블 유지" 위반)
- **판정**: 거부 — Year 1 9테이블 정책 위반

### 4.3 대안 C: 본 ADR 채택 (4 컬럼 ALTER TABLE)

- **장점**: 쿼리 효율 + 트리거 호환 + 9테이블 유지 + Year 2 zero-cost
- **단점**: 마이그레이션 0019 비용 (ADD COLUMN × 4)
- **판정**: **채택** ★ — 단점이 1회성, 장점이 영속

---

## 5. Implementation Plan

|  #  | 항목                                                                                    | 영역                          | 분량                   |
| :-: | :-------------------------------------------------------------------------------------- | :---------------------------- | :--------------------- |
|  1  | `migrations/0019_knowledge_nodes_page_meta.sql` 작성                                    | 본 세션                       | 15분                   |
|  2  | `apps/api/src/db/schema.ts` knowledge_nodes 4 컬럼 추가                                 | 다음 세션 (Drizzle ORM 갱신)  | 10분                   |
|  3  | `apps/batch/src/loader/draft-loader.ts` INSERT path 4 컬럼 추가                         | 다음 세션                     | 20분                   |
|  4  | `scripts/extract-batch-pages.py` v2 작성 (extract_text + extract_tables + 챕터/절 메타) | 다음 세션                     | 30분                   |
|  5  | BATCH-1 raw text v2 재추출 + chapter/section 자동 인식                                  | 다음 세션                     | 5분                    |
|  6  | Knowledge Graph JSON 생성 시 4 컬럼 채움 의무                                           | 다음 세션                     | (Knowledge Graph 단계) |
|  7  | 진산님 production wrangler d1 migrations apply 0019                                     | 진산님 콘솔 영역              | (BATCH-1 적재 직전)    |
|  8  | TD-PHASE2-1 (0020/0021 슬롯 할당) WBS 갱신                                              | 본 세션                       | 5분                    |
|  9  | batch-loadmap.md 페이지 인용 정합화                                                     | 다음 세션 (BATCH-2 진입 직전) | 10분                   |

**본 세션 처리**: 1 + 8 (ADR + 마이그레이션 SQL 작성 + WBS 갱신) — ~20분
**다음 세션 처리**: 2 + 3 + 4 + 5 + 6 (Drizzle + draft-loader + 추출 v2 + Knowledge Graph) — ~70분
**진산님 콘솔**: 7 (production migrations apply)

---

## 6. References

- `migrations/0001_initial_schema.sql` (knowledge_nodes 원형)
- `migrations/0010_status_transitions_and_page_ref_guard.sql` (page_ref 빈문자 차단)
- `migrations/0018_enforce_draft_only_insert.sql` (page_ref NOT NULL 트리거 패턴)
- `docs/plans/batch-loadmap.md` (BATCH-1 페이지 인용)
- `docs/manual/ThePick-분석결과.md` (페이지 인용 혼용 발견)
- `.jjokjipge/handoff-session-038.md` (0019 conflict 명시)
- 메모리 `project_source_citation_requirement` (수험자 근거 UX)
- 메모리 `project_v3_final_multi_exam_deferred` (Year 1 9테이블 유지)
- 메모리 `feedback_focus_reliability_not_schedule` (사용자 UX 우선)
