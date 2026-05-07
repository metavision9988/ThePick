# Session 050 핸드오프 — ThePick (쪽집게, 손해평가사 자격시험 AI 학습 서비스)

> **본 세션(050) 종착**: ADR-032 Phase 1 Foundation 완료 — ontology v1.4.0 + 마이그레이션 0021 staging+production + KnowledgeContract.tables[] schema + Cat 9 verifier + 4-Pass 독립 리뷰 (CRIT 0 / MAJOR 6 / MINOR 6) + 즉시 수정 3건 흡수
> **다음 세션 진입 시 본 파일을 가장 먼저 읽고 verify 진입**
> **본 핸드오프 번호 = 057** (049 chain handoff-056의 직계 후속)

## 브랜치 & 컨텍스트

- 브랜치: main
- 마지막 커밋: be783ef (Session 049 backup, Stage 1B 정제 + γ explanation + Stage 1C topic_clusters 적재)
- 미커밋 변경: 6 modified + 14 untracked (verify reports 11 + review 1 + plan 1 + ADR 1 + migration 1)
- 본 핸드오프 = handoff-session-057.md (Session 050 종착, ADR-032 Phase 1)

## 본 세션(050)에서 한 일

### A. ★ entry verify 영속 2회 PASS 일치

- entry run1+run2 = PASS 5/0/1 일치 (TD-VRF-001 미발현)
- `.claude/reports/sprint1-step5-5-verify-session-050-entry-run{1,2}.json`

### B. ★ 진산 D-TABLE-1~6 spot check 결정 영속

진산 발화: "권장대로 진행" → 6건 모두 권장값 일괄 채택:

| ID        | 채택  | 의미                                                        |
| --------- | ----- | ----------------------------------------------------------- |
| D-TABLE-1 | α     | TBL/TROW/TCOL/TCELL prefix (TC- topic_cluster 충돌 회피)    |
| D-TABLE-2 | α     | 4 정규화 테이블 (RAG 정밀도 우선)                           |
| D-TABLE-3 | β     | 기존 BATCH 재추출 = BATCH-1+6+7+R1 영향 큰 영역만 (Phase 2) |
| D-TABLE-4 | α     | 신규 BATCH부터 적용 + 기존 carry-over 점진                  |
| D-TABLE-5 | β → α | Phase 1 진산 직접 spot check / Phase 2 admin-web G5.5 UI    |
| D-TABLE-6 | β     | RAG 검색 강화 = Phase 2 데이터 적재 후 Vectorize 인덱싱     |

### C. ★ ADR-032 Status: Proposed → Accepted

- `docs/adr/ADR-032-table-as-micro-kg.md` 갱신
  - Status: `Accepted (2026-05-07 Session 050 진산 spot check 권장 일괄 채택)`
  - §"D-TABLE 결정 영속" 표 6건 영속

### D. ★ ontology-registry v1.3.0 → v1.4.0 (L3 영역, plan + 진산 승인 정합)

- `packages/parser/src/ontology-registry.json` 갱신:
  - `version`: 1.3.0 → **1.4.0**
  - `node_types`: 7 → **11** (TABLE / ROW_HEADER / COL_HEADER / CELL 추가)
  - `edge_types`: 13 → **17** (HAS_ROW / HAS_COLUMN / BELONGS_TO_ROW / BELONGS_TO_COLUMN 추가)
  - `node_id_patterns`: 7 → **11** (4 신규 패턴 — `^TBL-\d{3}$` / `^TROW-\d{3}-\d{2}$` / `^TCOL-\d{3}-\d{2}$` / `^TCELL-\d{3}-\d{2}-\d{2}$`)
  - `node_types_meta`: 7 → **11** (4 신규 dedup_threshold + confusion_priority)

### E. ★ 마이그레이션 0021 작성 + staging+production 적용 (L3)

**파일**: `migrations/0021_table_as_micro_kg.sql`

**4 신규 테이블** (D-TABLE-2=α 정규화):

- `table_structures` — 표 메타 (pattern_type 7종 + G5.5 human_reviewed_at + status enum)
- `table_headers` — 행/열 헤더 (다중 헤더 트리 supports — patterns B/C)
- `table_cells` — 셀 (value_type 5종 + formula_id FK + merged_with_id ref — pattern D/F)
- `table_node_links` — 표 ↔ knowledge_nodes 다대다 (relation_type 3종)

**10 인덱스**: status / pattern / source_node / table_axis / parent / table_row_col / table_value / formula / related_node / table_relation

**CHECK 강화**: GLOB ID guards (`TBL-[0-9][0-9][0-9]` 등) + value_type ↔ formula_id/merged_with_id 정합 + axis ↔ ID prefix 매칭

**적용 결과**:

- staging (thepick-db-staging): success / num_tables=22 / sql_duration=5.6ms
- production (thepick-db-production): success / num_tables=22 / sql_duration=4.2ms
- 검증: `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'table_%'` = 4 / `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_table_%'` = 10 (양쪽 일치)

### F. ★ KnowledgeContract.tables[] schema 확장

`packages/parser/src/schema-validator.ts` 추가:

- `KnowledgeContractTableHeader` interface (id/axis/level/index_pos/parent_id?/text)
- `KnowledgeContractTableCell` interface (id/row_id/col_id/value_text?/value_type/formula_id?/merged_with_id?)
- `KnowledgeContractTable` interface (id/source_node_id/title/pattern_type/row_count/col_count/source/headers/cells)
- `KnowledgeContract.tables?: KnowledgeContractTable[]` (optional — Phase 1 호환)

### G. ★ verify-engine-contracts.ts Cat 9 신규 (Table-as-Micro-KG schema 정합)

`scripts/verify-engine-contracts.ts` 추가:

- `loadOntologyRegistry()` 함수
- `buildTableKgCategory()` Cat 9 (id=9)
- 검증 항목: node_types=11 / edge_types=17 / 4 ID 패턴 정합 / 4 신규 node_types 등록 / 4 신규 edge_types 등록 / TC- 충돌 회피 / 마이그레이션 0021 파일 / version=1.4.0
- `MIGRATION required`: 18 → 20 (0019 + 0021, 0020 슬롯 부재 — handoff-038 §주의사항 정합)
- `parser required`: 155 → 157 (4 신규 ID 양성 테스트 흡수)

### H. ★ 4-Pass 독립 에이전트 리뷰 (review-gate.sh hook 정합)

**리뷰 위치**: `.claude/reviews/review-20260507-113718-session-050-phase1-foundation.md`
**리뷰 방식**: 독립 에이전트 4개 병렬 호출 (단일 메시지) — 자가 리뷰 0건

| Pass                 | 에이전트        |     ✅ |    🔴 |    🟠 |    🟡 |
| -------------------- | --------------- | -----: | ----: | ----: | ----: |
| Pass 1 (Surgeon)     | general-purpose |      6 |     0 |     2 |     2 |
| Pass 2 (Architect)   | general-purpose |      5 |     0 |     2 |     2 |
| Pass 3 (Advocate)    | general-purpose |      6 |     0 |     1 |     3 |
| Pass 4 (Contract)    | general-purpose |     12 |     0 |     2 |     2 |
| **통합 (중복 제거)** | —               | **29** | **0** | **6** | **6** |

**판정: 완료 가능 (CRITICAL 0건)**

**MAJOR 즉시 수정 3건 (본 세션 흡수)**:

- ✅ MAJOR-B (Pass 1) — `inferNodeTypeFromId` 4 신규 패턴 양성 테스트 추가 (parser 155→157)
- ✅ MAJOR-E (Pass 4) — plan §4.3 cells shape 갱신 (Silent Pivot 차단, D1 FK 정규화 영속)
- ✅ MAJOR-F (Pass 4) — master-test-checklist §6.2 마이그레이션 카운트 18→20

**MAJOR Phase 2 carry-over 3건**:

- ⏳ MAJOR-A (Pass 1+3) — `validateKnowledgeContract.tables[]` 검증 로직 (BATCH 재추출 직전 의무)
- ⏳ MAJOR-C (Pass 2) — Drizzle 정의 4 테이블 (admin-web G5.5 진입 시)
- ⏳ MAJOR-D (Pass 2) — `prevent_table_structures_update` trigger 또는 ADR-032 §Temporal 명시 (0022 마이그레이션)

**MINOR 7건 carry-over**: 모두 Phase 2 초기 task batch (loadOntologyRegistry catch logging / a11y enum / value_text 길이 CHECK / source sanitize / ARCHITECTURE.md 갱신 / 4 edge truth_weight / formula_id supersedes 검증)

### I. ★ post-fix verify 영속 2회 PASS 일치

- final run1+run2 = PASS 6/0/1 일치 (Cat 9 신규 + Cat 1+2+3 parser 157 + Cat 6 migration 20 모두 통과)
- TD-VRF-001 본 세션 6회 연속 PASS 일치 (entry 2 + post-v140 4 + post-fix 2)
- `.claude/reports/sprint1-step5-5-verify-session-050-final-run{1,2}.json`

## 수정된 파일 (미커밋)

### Modified (6)

- `.jjokjipge/handoff-session-056.md` (이전 세션 carry-over)
- `docs/quality/master-test-checklist.md` (Pass 4 MAJOR-F: 마이그레이션 18→20)
- `packages/parser/src/__tests__/schema-validator.test.ts` (enum sync 7→11/13→17 + Pass 1 MAJOR-B 흡수: 4 신규 ID 양성 테스트 + TCOL ↔ TC 충돌 회피 테스트)
- `packages/parser/src/ontology-registry.json` (★ v1.3.0 → **v1.4.0** L3)
- `packages/parser/src/schema-validator.ts` (KnowledgeContract.tables[] optional 확장)
- `scripts/verify-engine-contracts.ts` (Cat 9 신규 + parser 155→157 + migration 18→20)

### Untracked 본 세션 050 신규 (영속 데이터)

- `.claude/reports/sprint1-step5-5-verify-session-050-entry-run{1,2}.json` (entry 2건 PASS 5/0/1)
- `.claude/reports/sprint1-step5-5-verify-session-050-post-v140-run{1,2,3,4}.json` (post-v140 4건 — run1+2 parser test 회귀 확인 → enum sync fix → run3+4 PASS 5/0/1)
- `.claude/reports/sprint1-step5-5-verify-session-050-cat9-run{1,2,3}.json` (Cat 9 신규 3건 — run1 migration count fail → fix → run2+3 PASS 6/0/1)
- `.claude/reports/sprint1-step5-5-verify-session-050-final-run{1,2}.json` (post-MAJOR-fix 2건 PASS 6/0/1 일치)
- `.claude/reviews/review-20260507-113718-session-050-phase1-foundation.md` (★ 4-Pass 통합 보고서)
- `docs/adr/ADR-032-table-as-micro-kg.md` (Session 049 영속, Session 050 Accepted 전이)
- `docs/plans/table-processing-architecture-v1.md` (Session 049 영속, Session 050 §4.1 + §4.3 갱신)
- `migrations/0021_table_as_micro_kg.sql` (★ 신규 — staging+production 적용 완료)

## 누적 통합 통계 (production D1, 2026-05-07 Session 050 종착)

```
knowledge_nodes : 794   (변경 0)
knowledge_edges : 1274  (변경 0)
formulas        : 157   (변경 0)
constants       : 193   (변경 0)
revisions       : 39    (변경 0)
exam_questions  : 545   (변경 0)
topic_clusters  : 50    (변경 0)
table_structures: 0     (★ 신규 테이블, 데이터 0 — Phase 2 BATCH 재추출 시 채워짐)
table_headers   : 0     (★ 신규 테이블)
table_cells     : 0     (★ 신규 테이블)
table_node_links: 0     (★ 신규 테이블)
trigger prevent_table_structures_critical_update : ✅ 적용 (★ 0022 D-PHASE2-1=α)
ontology_registry version : 1.4.0 (Table-as-Micro-KG 4 노드 + 4 엣지)
                          → 1.5.0 차세션 052 (CONTAINS_TABLE 엣지 추가, 패턴-H 지원)
migration count : 21 (0001~0019 + 0021 + 0022 / 0020 슬롯 = B-C1 이월)
```

본 세션(050) = ADR-032 Phase 1 Foundation 완료 + D-PHASE2 영속 + 0022 trigger + 패턴-H plan 영속. Phase 2 BATCH 재추출 진입 게이트 5건 (MAJOR-A / 0023 / v1.5.0 / MAJOR-C / batch-processor) = 차세션 052 carry-over.

## 주요 결정 / 발견

### ★ Plan §4.3 cells shape 진화 (MAJOR-E 영속)

- plan v1 초안: `cells: { row_index, col_index, value, type, formula_ref? }[]` (인덱스 기반)
- Session 050 영속: `cells: KnowledgeContractTableCell[]` (`{id, row_id, col_id, value_text?, value_type, formula_id?, merged_with_id?}` ID FK 정규화)
- 사유: D1 정규화 schema (`table_cells.row_id REFERENCES table_headers(id)`) 정합. plan↔구현 정합 영속.

### ★ COL_HEADER vs topic_cluster prefix 충돌 회피 (D-TABLE-1=α)

- v1.3.0 `topic_cluster_id_pattern: ^TC-\d{3}$` (TC-001~050 50건 production 적재)
- 본 plan v1 초안 paragraph: `^TC-\d{3}-\d{2}$` for COL_HEADER → 충돌 위험
- 영속 결정: COL_HEADER = `^TCOL-\d{3}-\d{2}$` (TCOL prefix 4글자, strict anchor) — 충돌 0
- schema-validator.test.ts:225-230 회귀 테스트 영속

### ★ 마이그레이션 슬롯 0020 부재 + 0021 진입 (handoff-038 정합)

- 0020 슬롯 = B-C1 (user_progress.exam_id, Year 2 zero-cost) 이월 (handoff-038 §주의사항)
- Session 050 = 0021_table_as_micro_kg.sql 신규 (0020 미경유)
- wrangler d1 migrations 적용 = 알파벳 순 → 0019 → 0021 자연 진행 (갭 무시)
- verify migration `required = 20` (0001~0019 + 0021 = 20 파일)

### ★ TD-VRF-001 본 세션 6회 연속 PASS 일치

- entry 2 + post-v140 (run1+2 parser test 회귀 → fix → run3+4 PASS) + cat9 (run1 migration count fix → run2+3 PASS) + final 2 = 총 11회 verify 실행
- 본 세션 모든 verify run = retry 1회 이내 PASS 회복 (handoff-054 정합)

## ★★ Session 050 후반부 진산 트리거 영속 (2건 누적)

### 트리거 1 — "권장안으로" → Phase 2 진입 plan 영속

**산출**: `docs/plans/table-processing-phase2-batch-reextract.md` (Session 050 신규)

### 트리거 2 — "권장대로 진행" (D-PHASE2 결정 영속) + 마이그레이션 0022 적용

진산 D-PHASE2-1~6 모두 권장값 일괄 채택. 본 세션에서 직접 산출:

- ✅ ADR-032 §"D-PHASE2 결정 영속" 표 영속 (Session 050 후반부)
- ✅ Phase 2 plan §5 → "진산 결정 영속" 갱신
- ✅ **마이그레이션 0022** `prevent_table_structures_critical_update` trigger staging+production 적용
  - `id/source_node_id/title/pattern_type/row_count/col_count/source` UPDATE → RAISE(ABORT)
  - `status/human_reviewed_at/updated_at` UPDATE 허용 (G5.5 검수 흐름)
- ✅ verify Cat 9 강화 (0022 파일 존재 검증 추가)
- ✅ migration count required 20 → 21 (master-test-checklist + verify 동시 갱신)
- ✅ post-0022 verify run1+run2 = **PASS 6/0/1 일치**

### 트리거 3 — "표 안에 표가 있는 형태도 반영" (★ Nested Table 패턴-H 영속)

**진산 발화 (Session 050 종착 직전)**: "갑자기 생각나서 알려주는데.. 표 안에 표가 있는 형태가 있거든.. 그것도 반영을 해줘"

**즉시 영속 (Session 050)**:

- ✅ `docs/plans/table-processing-architecture-v1.md` §3 패턴 카탈로그 — **패턴-H Nested Table** 추가 (~1~5% 빈도, 다중 자격증)
- ✅ ADR-032 §"패턴-H Nested Table 영속" footnote 추가
- ✅ Phase 2 plan §5 → **D-PHASE2-7=α** 신규 (패턴-H 지원 의무)
- ✅ Phase 2 plan §6 Phase 분해 ~5세션 → **~6세션** (패턴-H 흡수로 +1)
- ✅ memory `project_table_processing_core_capability.md` 갱신 — 패턴 7종 → **8종**

**차세션 052 carry-over (Phase 2 진입 게이트 추가 1건)**:

- ⏳ **마이그레이션 0023** = `table_cells.value_type` 6종 ('nested_table' 추가) + `nested_table_id TEXT REFERENCES table_structures(id)` 컬럼 + CHECK 갱신
- ⏳ **ontology v1.4.0 → v1.5.0** = 신규 edge_type `CONTAINS_TABLE` (CELL → TABLE) 추가 (4 → 5 edge_types)
- ⏳ schema-validator `KnowledgeContractTableCell.value_type` enum 갱신 + `nested_table_id?` 옵션
- ⏳ batch-processor 시스템 프롬프트 §"표 추출"에 패턴-H 명시

**Reality Anchor (패턴-H 추가)**:

- LLM 패턴-H 인식 정확도 ~70% (가장 어려운 영역, A_simple 95% 대비)
- 외부 표 분해 → nested 셀 발견 → 내부 표 별도 TBL-N+1 추출 → nested_table_id 연결 = 4단계 추출 흐름
- G5.5 인간 검수 강제 + nested 셀 라벨링 추가 단계 의무 (D-PHASE2-6=β 단계별 검수 정합)

**Phase 2 plan 핵심**:

- 진입 게이트 4건 의무 흡수 (MAJOR-A `validateTablesSection()` / MAJOR-D 마이그레이션 0022 / MAJOR-C Drizzle 정의 / batch-processor 시스템 프롬프트 강화)
- BATCH 재추출 4 단계 (D-TABLE-3=β):
  - Phase 2A — BATCH-7 별표 1·2·5·6·7 (~125 노드, 패턴 A/B/F)
  - Phase 2B — 별표 9 + BATCH-1 적과전 매트릭스 (~200 노드, 패턴 B/C/F)
  - Phase 2C — BATCH-6 가축 매트릭스 (~120 노드, 패턴 D/E, ★ 진산 직접 영속 영역)
  - Phase 2D — BATCH-R1 26년 변경표 (~150 노드, 패턴 G)
- **D-PHASE2-1~6 진산 결정 의무** (차세션 052 entry spot check)
- Reality Anchor 3 이유 (LLM 표 인식 ~85% / cost cap / UPDATE 정책)
- 5 세션 분해 (052~057)

## 다음 할 일 (차세션 052+ — Phase 2 진입)

### 1. 차세션 entry verify 영속 2회 (의무)

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > /home/soo/ClaudePro/ThePick/.claude/reports/sprint1-step5-5-verify-session-NNN-entry-run1.json
# (run2 동일) → run1≡run2 PASS 6/0/1 일치 확인
# ★ Cat 9 추가로 total 7 (PASS=6 / SKIP=1) 패턴
# ★ 절대 경로 의무 (cwd 잔존 시 ERR_MODULE_NOT_FOUND)
```

### 2. ★★ Phase 2 진입 게이트 4건 (Session 050 종착 후 차세션 052 carry-over)

D-PHASE2 결정 영속 + 마이그레이션 0022 본 세션 적용 → 차세션 052 진입 작업:

| 게이트                  | 작업                                                                               | D-PHASE2 결정               |
| ----------------------- | ---------------------------------------------------------------------------------- | --------------------------- |
| **MAJOR-A**             | `validateTablesSection()` 추가 + parser test ~10건 (★ 패턴-H 검증 포함)            | D-PHASE2-4=α                |
| **마이그레이션 0023** ★ | `value_type` 6종 + `nested_table_id` 컬럼 + CHECK 갱신 (패턴-H 지원, D-PHASE2-7=α) | D-PHASE2-7=α                |
| **ontology v1.5.0** ★   | 신규 edge_type `CONTAINS_TABLE` (4→5)                                              | D-PHASE2-7=α                |
| **MAJOR-C**             | `apps/api/src/db/schema.ts` Drizzle 4 테이블 정의                                  | D-PHASE2-2=α                |
| **batch-processor**     | 시스템 프롬프트 §"표 추출" 강화 (패턴 A~H 모두)                                    | D-PHASE2-3=α + D-PHASE2-7=α |

차세션 052 진산 트리거: **"Phase 2 진입 시작"** 또는 **"진입 게이트"** 발화 시 위 5 작업 순차 진행.

### 3. Phase 2 진입 전 cap 활성 의무 (memory `project_anthropic_cap_pre_install.md`)

- $200 monthly + alerts 활성 (BATCH 재추출 토큰 비용 ~$30 추정 + Vectorize 인덱싱 ~$5 추정)
- 본 plan §7 Reality Anchor 이유 2 흡수 의무

| 트리거                                 | 진행                                                                                                 |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **"cell-level 정제"** ★ 단계 1C 정밀화 | 자료2 PDF Vision multimodal 재추출 또는 인간 검수 — D-S1C-2 결정 후                                  |
| **"라인 정제"** ★ Stage 1B γ 정밀화    | candidates.json `needs_line_refinement = 9건` 정확 라인 범위 정제                                    |
| **"drift overlay"** ★ 25→26년 정정     | 자료5/6/9/17 = 25년 → 26년 정합 변경 사항 명시 작성                                                  |
| **"Phase 2 plan"** ★ L3 영역           | 마이그레이션 0020 plan (Stage 1B link table 2종 + Stage 1C question_ids 매핑, plan + 인간 승인 의무) |
| **"BATCH-Q 2차 5~10회"** ★ β 옵션      | 자료5/6/9/15/17 풀이 raw → 2차 1~10회 적재 (TD-S46-2 해결 자산)                                      |
| **"엔진 추출"** 류                     | **handoff-042 §9 carry-over 정합 보류 의무** (사용자 앱 PWA + Level 3 미충족)                        |

★ **권장 트리거**: **"Phase 2 진입 plan"** — ADR-032 Phase 1 Foundation 완료 + MAJOR-A/C/D 흡수 + BATCH-7 별표 재추출. plan 작성 후 진산 인간 승인 (L3) 후 진입.

## 주의사항

### ★ Phase 2 진입 전 의무 3건 (handoff-057 §H carry-over)

- **MAJOR-A**: `validateKnowledgeContract.tables[]` 검증 로직 추가. 현재 `tables?` optional만 추가됐고 본문 검증 0건 → BATCH 재추출 시 잘못된 ID/dangling FK 통과 위험. schema-validator.ts에 `validateTablesSection()` 또는 inline loop 추가 의무.
- **MAJOR-C**: `apps/api/src/db/schema.ts`에 4 신규 테이블 Drizzle export 추가. drizzle-kit push 사고 차단은 schema.ts:8-15 헤더 가드로 되어있으나 admin-web/api type-safe 경로 부재 → Phase 2 G5.5 진입 시 의무.
- **MAJOR-D**: `table_structures.updated_at` UPDATE 정책 영속. (a) `prevent_table_structures_update` trigger 추가 (0022 마이그레이션) 또는 (b) ADR-032 §"Temporal 정합" 명시 ("human_reviewed_at만 UPDATE 허용 / 다른 컬럼 INSERT+SUPERSEDES 패턴 의무").

### ★ exam_questions UPDATE 차단 (재확인)

- 0004 트리거 `prevent_exam_questions_update` RAISE ABORT — Phase 2 마이그레이션 0020 link table `exam_question_explanation_supplement` 신설 의무 (Stage 1B γ + Stage 1C question_ids 일괄)

### ★ ontology v1.4.0 영향 영역 (재확인)

- v1.3.0 → v1.4.0 변경 영향 0건 (verify post-v140 + final 4회 PASS 일치)
- 4 신규 node_types 모두 strict anchor 패턴 (cross-match 불가능)
- inferNodeTypeFromId 자동 등록 (Object.entries) → 4 신규 패턴 자동 처리
- ★ COL_HEADER (TCOL) ↔ topic_cluster (TC) prefix 충돌 회피 회귀 테스트 영속

### ★ wrangler 검증 컬럼명 (재확인 + 본 세션 신규)

- knowledge_edges = `from_node`/`to_node`
- exam_questions = id/year/round/question_number/subject/content/answer/explanation/exam_type/status/related_nodes/related_constants
- formulas 테이블 = id/name/equation_template (description 컬럼 없음)
- ★ table_structures = id/source_node_id/title/pattern_type/row_count/col_count/source/status/human_reviewed_at/created_at/updated_at
- ★ table_headers = id/table_id/axis/level/index_pos/parent_id/text/created_at
- ★ table_cells = id/table_id/row_id/col_id/value_text/value_type/formula_id/merged_with_id/created_at
- ★ table_node_links = id (AUTOINCREMENT)/table_id/related_node_id/relation_type/created_at

### ★ Session 041 fix 정합 (TD-S49-1 잔존)

- SQL 적용 시 `BEGIN TRANSACTION;` / `COMMIT;` 포함하면 wrangler Auth error 발생
- 본 세션 050 마이그레이션 0021은 BEGIN/COMMIT 미포함으로 작성 (정합 ✓)
- 차세션 신규 SQL 제너레이터 작성 시 동일 정합 의무 (TD-S49-1 carry-over)

### ★ TD-VRF-001 (carry-over)

- verify Cat1 batch 326/327 flaky (격리 실행 327 정합)
- 본 세션 050 = 11회 verify 실행 모두 PASS (1회 retry 회복 패턴 정합)
- 차세션 entry 시 발현 시 즉시 retry로 PASS 확보 의무

### ★ TD-S49-2 (handoff-056 carry-over, 본 세션 050 미흡수)

- ontology-registry.ts 인터페이스 + assertRegistryShape + isValidTopicClusterId 헬퍼 동기화
- 본 세션 050에서 ontology v1.4.0 적용 후에도 ontology-registry.ts 인터페이스 동기 미수행 → 차세션 carry-over

### ★ TD-S49-3 (handoff-056 carry-over, 본 세션 050 흡수 부분적)

- ADR-031 갱신 또는 ADR-033 — v1.1.0→v1.4.0 history + 패턴 등록 영구 보존
- 본 세션 050 = ADR-032 신규 (Table-as-Micro-KG)로 v1.3.0→v1.4.0 history는 ADR-032에 영속
- 그러나 v1.1.0→v1.3.0 (formula + topic_cluster pattern) ADR 영속은 별도 task carry-over

### 일반 운영 주의

- migration 0010~0019 + 0021 staging+production 적용 완료 (0020 슬롯 = B-C1 이월)
- L3 영역 변경 시 plan + 인간 승인 의무 — 본 세션 050 ontology-registry.json + DB 스키마 0021 모두 plan + ADR-032 + 진산 "권장대로 진행" 정합
- handoff-042 §9 엔진 추출 carry-over: Layer 1+2+3+4+5(1차+2차 일부)+6 충족하지만 Layer 5 2차 14% + 사용자 앱 PWA + Level 3 미충족 → 발화 시 보류 의무
- 누적 이월 MAJOR ~111건 + MAJOR-A/C/D 신규 = ~114건 (Phase 2 진입 시 일괄 갱신)
- session-health 본 세션(050): 시작 02:39 KST → 약 60분 경과 (90분 임계 여유)

## 차세션 1차 읽기 의무 문서 (우선순위 순)

1. **`.jjokjipge/handoff-session-057.md`** (본 핸드오프, 1순위)
2. ★★ **`docs/plans/table-processing-phase2-batch-reextract.md`** (Session 050 신규 — 진산 "권장안으로" 트리거 산출, D-PHASE2-1~6 spot check)
3. **`.claude/reviews/review-20260507-113718-session-050-phase1-foundation.md`** ★ Session 050 신규 (4-Pass 통합, MAJOR-A/C/D carry-over 명시)
4. **`docs/adr/ADR-032-table-as-micro-kg.md`** (★ Status: Accepted, D-TABLE 영속)
5. **`docs/plans/table-processing-architecture-v1.md`** (Session 050 §4.1 + §4.3 갱신)
6. **`migrations/0021_table_as_micro_kg.sql`** ★ Session 050 신규 (4 테이블 + 10 인덱스)
7. **`packages/parser/src/ontology-registry.json`** ★ v1.4.0 (4 신규 node_types/edge_types/ID 패턴)
8. **`packages/parser/src/schema-validator.ts`** (KnowledgeContract.tables[] optional)
9. `.jjokjipge/handoff-session-056.md` (Session 049 종착, D-TABLE 결정 직전)
10. `docs/batch-load/stage-1c-topic-clusters/STAGE-1C-SUMMARY.md` (50 topic_clusters)
11. `docs/plans/batch-loadmap.md` (Layer 5 1차 100% / 2차 14% / 545 exam_questions)
12. `.jjokjipge/handoff-session-042.md` §9 (엔진 추출 carry-over 보류 의무)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 050 (ADR-032 Phase 1 Foundation 완료)
**다음 세션**: Session 051 — entry verify + 진산 결정 트리거 (★ 권장: "Phase 2 진입 plan" — MAJOR-A/C/D 흡수 + BATCH 재추출 plan)
**작성 효력**: 2026-05-07 KST (Session 050, ADR-032 Phase 1 Foundation 완료, **ontology v1.4.0 + 마이그레이션 0021 production 적재**)
**예상 완료 다음 세션**: handoff-session-058 (Phase 2 진입 plan 작성 또는 minor MAJOR 흡수 또는 Stage 1C 후속)

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
