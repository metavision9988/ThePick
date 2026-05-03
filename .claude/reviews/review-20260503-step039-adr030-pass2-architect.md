# Pass 2 ARCHITECT Review — Session 039 ADR-030 / migration 0019

- **세션:** Session 039 (2026-05-03)
- **대상:** ADR-030 + migration 0019 + KnowledgeContractNode 4 필드 + Drizzle schema 4 컬럼 + draft-loader INSERT path + 7 fixture/test 갱신
- **관점:** "이 코드가 다른 모듈과 만나면 터지는가?" — 모듈 간 계약, FK, drift, Hexagonal, Workers 제약, IndexedDB 동기, Year 2 zero-cost
- **리뷰어:** Architect (system-architect 페르소나)
- **선행:** Pass 1 SURGEON 결과 인지 — 중복 지적 회피
- **보고 형식:** Critical / Major / Minor + 파일:라인 + Devil's Advocate 1건+

---

## Executive Summary

| 분류        | 건수  | 핵심 키워드                                                                                                         |
| :---------- | :---- | :------------------------------------------------------------------------------------------------------------------ |
| 🔴 Critical | **1** | SCENARIO_MIGRATIONS 0019 누락 → 차세션 추가 시 기존 INSERT 시점 회귀                                                |
| 🟠 Major    | **3** | IndexedDB 미러 schema drift / progress/routes.test.ts seedNode 회귀 잠복 / scenarios.test.ts seedKnowledgeNode 동일 |
| 🟡 Minor    | **3** | ARCHITECTURE.md 미갱신 / d1-trigger-verify.test.ts 누락 / batch-loadmap.md 페이지 인용 정합화 미실행                |
| ✅ PASS     | 11    | (아래 §"확인된 항목 11건" 참조)                                                                                     |
| N/A         | 4     | Workers fs/path / Vectorize / IndexedDB 양방향 sync / Hexagonal Domain                                              |

**판정:** 🔴 **수정 필요** — Critical 1건이 차세션 SCENARIO_MIGRATIONS 0019 추가 시점에 즉시 발현. 본 세션에 동시 처리해야 회귀 진산님 부담 0.

---

## 1. 확인된 항목 (PASS 11건, 증거 기반)

| #   | 항목                                            | 파일:라인                                                                                      | 확인 내용                                                                                                                                                                                             |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Drizzle ↔ SQL 컬럼 1:1 정합                     | `apps/api/src/db/schema.ts:133-142` ↔ `migrations/0019_*.sql:49-52`                            | bookPage/pdfPage/chapter/section 4 컬럼 타입 (INTEGER/INTEGER/TEXT/TEXT) + NULL 정책 일치                                                                                                             |
| 2   | Drizzle ↔ SQL 인덱스 이름 1:1 정합              | `apps/api/src/db/schema.ts:175-176` ↔ `migrations/0019_*.sql:80-81`                            | `idx_nodes_book_page` + `idx_nodes_chapter` 동일 (drizzle-kit drop 방지 NC-1 정책 정합)                                                                                                               |
| 3   | Trigger 이름 conflict 0건 (0001~0019 전수 grep) | `migrations/0010~0018` vs `migrations/0019:60,67`                                              | `enforce_book_page_on_insert` / `enforce_pdf_page_on_insert` 이름은 0019 단독. 0010 `enforce_knowledge_nodes_page_ref_not_null`, 0018 `enforce_page_ref_on_insert`/`prevent_non_draft_insert` 와 직교 |
| 4   | Index 이름 conflict 0건                         | `migrations/0017:84,88,92` vs `migrations/0019:80-81`                                          | `idx_engine_telemetry_*` (0017) vs `idx_nodes_*` (0019) 네임스페이스 분리                                                                                                                             |
| 5   | FK 안정성 (knowledge_nodes PK 변경 0건)         | `migrations/0001:39-40,64`, `0002:62`, `apps/api/src/db/schema.ts:188,191,216,326`             | knowledge_edges.from_node/to_node, formulas.node_id, user_progress.node_id 모두 `knowledge_nodes(id)` 참조. 0019 는 컬럼 추가만이라 FK 영향 0                                                         |
| 6   | Import 단방향 (Hexagonal)                       | `packages/parser/src/schema-validator.ts:13-25`, `apps/batch/src/loader/draft-loader.ts:17-19` | parser → shared (OK), batch → parser (OK), 역방향 imports 0 — Hexagonal Engine-First 정합                                                                                                             |
| 7   | Workers 제약 — fs/path 0건                      | `packages/parser/src/schema-validator.ts`, `apps/batch/src/loader/draft-loader.ts`             | grep `from 'fs'`, `path.`, `readFileSync` 본 세션 변경 파일에서 0건 (local-db.ts 만 fs 사용 — 이는 Node test only)                                                                                    |
| 8   | Hard Rule 17 — examId literal 0건               | `migrations/0019_*.sql`, `docs/adr/ADR-030-*.md`                                               | 본 세션 신규 파일에 `son-hae-pyeong-ga-sa` literal 직접 인용 0건. ADR 본문 메모리 문구에만 등장 (production-quality.md "JSDoc/주석 예외" 적용)                                                        |
| 9   | Temporal Graph 정합                             | `apps/batch/src/loader/draft-loader.ts:313-319`                                                | INSERT OR IGNORE 패턴 유지. 0016 `is_current_active` + SUPERSEDES 패턴과 양립. 4 컬럼은 INSERT 시점 채움 — 개정 시 신규 노드 (UPDATE 미수행)                                                          |
| 10  | truth_weight 정렬 무관성                        | `packages/parser/src/schema-validator.ts:38, 47`                                               | book_page/pdf_page 도입은 truth_weight 정렬 (LAW > FORMULA > CONCEPT) 에 영향 0 — RAG 정렬 키 무변경                                                                                                  |
| 11  | Year 2 zero-cost 적합                           | `migrations/0019_*.sql:24-26`, ADR-030 §1.4                                                    | 본 4 컬럼은 모든 시험 도메인 공통 (PDF/본문 페이지 + 챕터/절). Year 2 컬럼 변경 0건. ADR-007/Hard Rule 15 위반 0건                                                                                    |

---

## 2. 🔴 Critical 1건

### CRITICAL-A2-1 — `SCENARIO_MIGRATIONS` 에 0019 미등록 → schema drift + 차세션 회귀 잠복

**파일:** `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:38-57`

**증거:**

```ts
// L38-57
const SCENARIO_MIGRATIONS = [
  '0001_initial_schema.sql',
  ...'0017_engine_telemetry.sql',
  '0018_enforce_draft_only_insert.sql',
  // ⚠️ 0019 누락
];
```

**현상:** 본 세션 진행한 ADR-030 변경 (트리거 `enforce_book_page_on_insert`, `enforce_pdf_page_on_insert`) 이 `apps/api/src/__tests__/scenarios.test.ts` + `apps/api/src/progress/__tests__/routes.test.ts` 의 in-memory SQLite 테스트 DB 에 **적용되지 않는다**. 두 테스트 파일에 존재하는 INSERT 사이트는 `book_page`/`pdf_page` 미주입 상태이며, 현재 테스트 통과는 0019 트리거가 빠진 덕분에 silently 통과 중.

**파급 경로 (cross-module):**

1. `scenarios.test.ts:825` `seedKnowledgeNode()` — `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status) VALUES (...)` — book_page/pdf_page 미주입
2. `progress/__tests__/routes.test.ts:51` `seedNode()` — 동일 패턴
3. 차세션에서 (또는 누구든) `SCENARIO_MIGRATIONS` 에 `'0019_knowledge_nodes_page_chapter_meta.sql'` 추가하는 순간 → 두 파일 모든 테스트 즉시 적색 회귀
4. 또한 `apps/batch/src/loader/local-db.ts:51-53` 는 디렉토리 scan 으로 0019 자동 적용 (batch 테스트는 OK) — drift 가 비대칭

**왜 Critical:**

- ADR-030 §3.2 Negative 에 "기존 row 호환성 — admin-web /telemetry NULL 처리 의무" 만 명시되었고, **테스트 INSERT 사이트 일괄 갱신 의무**는 누락
- handoff-038 0019 conflict 해결 + Drizzle schema 갱신만 처리 → SCENARIO_MIGRATIONS 갱신은 본 세션 implementation plan §5 Items 1~9 어디에도 없음
- "verify 1200/1200 PASS" 를 근거로 완료 선언 → 실제로는 0019 트리거가 일부 테스트 경로에서 비활성 (silent bypass)

**권고 수정:**

1. `SCENARIO_MIGRATIONS` 에 `'0019_knowledge_nodes_page_chapter_meta.sql'` 추가 (배열 마지막)
2. `scenarios.test.ts:823-828` `seedKnowledgeNode` 시그니처를 `(nodeId, bookPage = 1, pdfPage = 1)` 로 확장 + INSERT SQL 에 `book_page, pdf_page` 컬럼 추가
3. `progress/__tests__/routes.test.ts:48-55` `seedNode` 동일 패턴
4. 위 3 수정을 본 세션 동시 처리 (Year 2 zero-cost 메모리 정신 + handoff-038 "본 세션 처리" 정신 정합)

**Devil's Advocate (반박):** "0019 가 SCENARIO_MIGRATIONS 에 있어야 한다는 의무가 없다 — 현 시나리오 테스트 범위에 ADR-030 검증이 들어가지 않아도 됨." → **반박 거부.** SCENARIO_MIGRATIONS 의 의미는 "production D1 schema 의 충실 미러" (`d1-from-sqlite.ts:1-10` 헤더 코멘트). 0019 가 빠지면 시나리오 테스트가 production 과 다른 schema 위에서 돌아 — silent integration drift. 이것은 4-Pass 자동 리뷰 프로토콜 §"규칙 1: 전체 범위 리뷰" + 진산님 메모리 `feedback_two_fix_failures_zoom_out` 정신과도 정합.

---

## 3. 🟠 Major 3건

### MAJOR-A2-1 — IndexedDB schema (`apps/web/src/lib/db.ts`) ADR-030 4 필드 미반영

**파일:** `apps/web/src/lib/db.ts:18-35`, `:173-189`

**증거:**

```ts
// L18-35: IKnowledgeNode interface — book_page/pdf_page/chapter/section 누락
export interface IKnowledgeNode {
  id: string;
  ...
  pageRef: string | null;  // ← 기존 단일 필드만
  ...
  // ⚠️ bookPage / pdfPage / chapter / section 미정의
}

// L173-188: dexie schema version(2) — 인덱스에도 미포함
this.version(2).stores({...});
```

**파급:** D1 → IndexedDB 단방향 sync (현재 BE C-3 명시 이월) 가 Phase 2 진입 시점 활성화될 때, sync engine 이 `bookPage` 필드를 IDB 에 저장 못함 → `node.bookPage` 클라이언트 접근 시 `undefined` → "교재 본문 p.O 참고" UX 깨짐. ADR-030 §3.1 Positive "사용자 UX 개선" 의 핵심 가치 (수험자 근거 보기 1급 기능) 가 PWA 측에서 무력화.

**왜 Major (Critical 아닌 이유):** Phase 2 진입까지 시점이 있어 즉시 회귀는 아님. 단, 4-Pass §"규칙 1 전체 범위" + 메모리 `project_source_citation_requirement` 1급 기능 정합상 본 세션에 동시 갱신 권고.

**권고:**

1. `IKnowledgeNode` interface 에 `bookPage: number | null` + `pdfPage: number | null` + `chapter: string | null` + `section: string | null` 추가
2. `dexie.version(3).stores({ knowledgeNodes: 'id, type, lv1Insurance, lv2Crop, status, examScope, bookPage, chapter' })` 신설 (bookPage 범위 + chapter 그룹 인덱스 — D1 0019 인덱스 미러)
3. version(3) 마이그레이션 함수 작성 (기존 row 4 필드 null fill)

**Devil's Advocate:** "Phase 2 본격 sync 구현 시 같이 처리하면 충분." → 부분 인정. 단 IDB 인덱스 추가는 dexie version bump 필요 (배포 후 변경 비용 ↑). 사전 schema 잡아두는 편이 합리적.

---

### MAJOR-A2-2 — `apps/api/src/__tests__/scenarios.test.ts:825` `seedKnowledgeNode` 회귀 잠복

**파일:** `apps/api/src/__tests__/scenarios.test.ts:820-829`

**증거:**

```ts
// L820-828
function seedKnowledgeNode(nodeId: string): void {
  // Hard Rule 13 (마이그레이션 0018) 정합 — INSERT status=draft + page_ref 강제.
  ctx.raw
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status)
     VALUES (?, 'CONCEPT', '시나리오 테스트 노드', '999', 2026, 5, 'draft')`,
    )
    .run(nodeId);
}
```

**파급:** CRITICAL-A2-1 의 SCENARIO_MIGRATIONS 0019 추가 즉시 본 함수 호출하는 전체 시나리오 테스트 (~10+ 호출처) 적색 회귀. ADR-030 트리거 `enforce_book_page_on_insert` 가 ABORT 발생.

**왜 Major:** Critical-A2-1 의 결과 파급. SCENARIO_MIGRATIONS 갱신과 함께 동시 fix 필수.

**권고:** `seedKnowledgeNode(nodeId, opts?: { bookPage?: number; pdfPage?: number })` 시그니처 확장 + INSERT 컬럼 4 추가 (default 1, 1).

---

### MAJOR-A2-3 — `apps/api/src/progress/__tests__/routes.test.ts:48-55` `seedNode` 동일 회귀 잠복

**파일:** `apps/api/src/progress/__tests__/routes.test.ts:48-55`

**증거:**

```ts
// L48-55
function seedNode(id: string): void {
  ctx.raw
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status)
     VALUES (?, 'CONCEPT', '테스트 노드', '999', 2026, 5, 'draft')`,
    )
    .run(id);
}
```

**파급:** progress/review 라우트 통합 테스트 (rate-limit, 404 dangling FK, FSRS UPSERT 등) 가 0019 활성 시 일괄 회귀.

**왜 Major:** MAJOR-A2-2 와 동일 카테고리. Production 의 `progress/routes.ts:234` `SELECT id FROM knowledge_nodes WHERE id = ?` 경로 자체는 영향 0 (SELECT 만 — 트리거는 INSERT/UPDATE 만 발화).

**권고:** MAJOR-A2-2 와 동일.

---

## 4. 🟡 Minor 3건

### MINOR-A2-1 — `docs/architecture/ARCHITECTURE.md` knowledge_nodes 섹션 미갱신

**파일:** `docs/architecture/ARCHITECTURE.md:406`

**증거:** L406 `> - knowledge_nodes, knowledge_edges` 만 KV 폴백 허용 테이블 목록에 등장. ADR-030 4 컬럼 도입은 다이어그램에 미반영 (Hexagonal 다이어그램의 D1 layer 박스 그래프에도 page_ref 단일 표기만).

**권고:** ADR-030 링크 추가 + Mermaid D1 layer 박스에 `page_ref / book_page / pdf_page / chapter / section` 5 컬럼 명시. 다음 ARCHITECTURE.md 갱신 PR 에 흡수.

---

### MINOR-A2-2 — `apps/batch/__tests__/d1-trigger-verify.test.ts` 9 INSERT 사이트 갱신 누락

**파일:** `apps/batch/__tests__/d1-trigger-verify.test.ts:295,455,468,475,485,496,514,521`

**증거:** 9 INSERT 사이트가 `(id, type, name, version_year, batch_run_id, source_id)` 만 명시 — book_page/pdf_page 누락. 본 파일은 `local-db.ts` 사용 (auto-apply migrations) 이므로 0019 트리거 활성 → 의도적으로 fail 검증하는 케이스가 아니라면 회귀.

**권고:** 본 세션 변경 범위 외이지만 (Pass 1 SURGEON 검토 영역일 가능성) — verify 1200/1200 가 어떻게 통과했는지 재확인 필요. 가능성: (a) DELETE 트리거 검증이 INSERT 후 절차로 이미 fail-by-design (NULL book_page → ABORT 가 의도적 흐름), (b) 본 파일이 verify 대상에서 제외됨. 두 경우 모두 명시 주석 추가 권고.

**Devil's Advocate:** "verify 1200 PASS 가 곧 무결 증거." → 반박. verify 가 본 9 INSERT 를 실행하는지, 트리거 ABORT 를 expected 로 받는지 확인 미수행. 본 Pass 2 범위 외이나 추적 의무 명시.

---

### MINOR-A2-3 — `docs/plans/batch-loadmap.md` 페이지 인용 정합화 미실행

**파일:** `docs/plans/batch-loadmap.md`, `docs/manual/ThePick-분석결과.md`

**증거:** ADR-030 §2.4 명시: "본 ADR 적용 후 batch-loadmap.md 의 'p.403~434' → '본문 p.396~427 (PDF p.403~434)' 형식으로 갱신". Implementation Plan §9 "다음 세션 처리 (BATCH-2 진입 직전)" 로 이월된 항목.

**파급:** BATCH-1 진행 중 진산님이 batch-loadmap.md 참조 시 PDF 페이지 단위 표기 잔존 → ADR-030 도입 의도 (mismatch catch 부담 0) 부분 손상.

**왜 Minor:** ADR 본문에 명시 이월된 의도된 결정. 단 본 세션 진입 직후 진산님 "권고대로 모두 처리" 트리거 정합상 본 세션에 흡수해도 무방했음.

**권고:** 다음 세션 BATCH-2 진입 직전 의무 항목으로 WBS §3 흡수 확인.

---

## 5. N/A 4건 (해당 없음, 검증 완료)

| #   | 항목                                        | 사유                                                                                                                                                                    |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Workers fs/path 사용                        | 본 세션 변경 파일 6개 (schema-validator.ts, schema.ts, draft-loader.ts, ADR, migration, fixture) 에 fs/path import 0건. local-db.ts (Node test only) 는 본 세션 변경 외 |
| 2   | Vectorize 메타데이터 영향                   | ADR-030 4 컬럼은 D1 한정. Vectorize 업서트 (ADR-004 §3) 는 별도 메타 — 본 변경 무관                                                                                     |
| 3   | IndexedDB ↔ D1 양방향 sync                  | 현 단계 단방향 read-only (db.ts:8-12 명시 이월). 본 세션 단방향 read 영향만 MAJOR-A2-1 에서 처리                                                                        |
| 4   | Hexagonal Domain → Infrastructure 직접 참조 | 본 변경 컴포넌트 모두 infrastructure (D1 schema, parser-validator, batch-loader) — domain layer 영향 0                                                                  |

---

## 6. Devil's Advocate — 깨질 수 있는 시나리오 (Pass 2 의무)

**시나리오:** 진산님이 staging 환경에 `wrangler d1 migrations apply 0019` 실행 직후, **이미 production 에 적재된 BATCH-0 시드 데이터** (있다면) 또는 `migrations/0011_revision_2026_constants_seed.sql` 의 seed INSERT 가 트리거에 차단되는가?

**검증:**

- `0011_revision_2026_constants_seed.sql` 은 `revision_changes` + `constants` 테이블 seed (knowledge_nodes 미주입). → 트리거 영향 0
- 본 시점 `knowledge_nodes` 는 production 비어있음 (handoff-038 §"BATCH-1 진입 직전"). → 기존 row 0건 + 트리거는 신규 INSERT 만 차단 → 안전

**다른 시나리오 — Cloudflare D1 ALTER TABLE ADD COLUMN ONLINE 정합:**

- ADR-030 §3.2 "다행히 ADD COLUMN 은 ONLINE 가능" 주장 → Cloudflare D1 (SQLite 3.x) 공식 문서 검증 필요. SQLite 3.35+ 부터 ALTER TABLE ... ADD COLUMN 은 lock-light. 현 D1 SQLite 버전 확인 미수행.
- **잠복 위험:** D1 의 alpha/beta 시기에는 일부 ALTER 가 실패한 사례 있음. staging dry-run 의무 (진산님 콘솔 영역).

**또 다른 시나리오 — chapter/section 한국어 데이터 i18n:**

- chapter `"제1장 농업재해보험 손해평가 개관"` 은 D1 컬럼에 한국어 직접 저장. PWA 측 영문 UI 빌드 시 (`apps/web/src/i18n/locales/en.ts`) 챕터 raw 한국어 표시 → i18n 일관성 깨짐.
- **현재:** Year 1 한국어 단일 (메모리 `feedback_focus_reliability_not_schedule`). 단 i18n locale 파일이 이미 en/ko 분리 존재 — 향후 chapter/section i18n 키 매핑 또는 별도 chapter_id (정규화) 필요. ADR-030 후속 결정 사항으로 trace 필요.

---

## 7. 최종 판정

**완료 가능 / 수정 필요:** 🔴 **수정 필요**

### 블로킹 (Critical)

- [ ] CRITICAL-A2-1: `SCENARIO_MIGRATIONS` 0019 추가 + scenarios/progress test seedNode 4 컬럼 추가

### 동시 권고 (Major, Phase 2 진입 전 의무)

- [ ] MAJOR-A2-1: IDB `IKnowledgeNode` 4 필드 + dexie version(3) 인덱스
- [ ] MAJOR-A2-2: scenarios.test.ts seedKnowledgeNode 4 컬럼
- [ ] MAJOR-A2-3: progress/routes.test.ts seedNode 4 컬럼

### 후속 (Minor)

- [ ] MINOR-A2-1: ARCHITECTURE.md 다이어그램 갱신 (별도 PR)
- [ ] MINOR-A2-2: d1-trigger-verify.test.ts 9 INSERT 의도 검증 + 주석
- [ ] MINOR-A2-3: batch-loadmap.md 페이지 인용 정합화 (BATCH-2 진입 직전)

### 즉시 PASS 항목

- ADR-030 본문 + migration 0019 SQL 본문은 architecture 정합 (Critical 0 / Major 0)
- Drizzle schema 4 컬럼 + 인덱스 1:1 정합 (drift 0)
- Trigger/Index 이름 conflict 0건 (전수 grep 검증)
- FK / Temporal Graph / Year 2 zero-cost / Hexagonal 정합

---

## 8. 본 리뷰 메타

- **리뷰 방식:** 독립 system-architect 페르소나 (메인 컨텍스트 코드 작성자 아님 — 자가 리뷰 편향 0)
- **리뷰 범위:** 변경 파일 15개 + 연관 파일 9개 (`apps/web/src/lib/db.ts` / `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` / `apps/api/src/__tests__/scenarios.test.ts` / `apps/api/src/progress/__tests__/routes.test.ts` / `apps/api/src/progress/routes.ts` / `apps/batch/src/loader/local-db.ts` / `apps/batch/__tests__/d1-trigger-verify.test.ts` / `migrations/0001/0010/0017/0018` / `docs/architecture/ARCHITECTURE.md`)
- **검증 깊이:** PASS 11건 모두 grep / 직접 read 로 증거 확보. 0건 보고 시 N/A 와 PASS 명확 구분
- **Pass 1 (Surgeon) 결과 인지:** 본 세션 verify 1200/1200 PASS 명시 — 단독 코드 정합 (null/async/경계값/산식 정밀도) Pass 1 영역으로 위임. Pass 2 는 cross-module / FK / drift 한정
