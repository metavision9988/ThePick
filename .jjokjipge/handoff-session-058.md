# Session 051 핸드오프 — ThePick (쪽집게, 손해평가사 자격시험 AI 학습 서비스)

> **본 세션(051) 종착**: Phase 2 진입 게이트 5/5 완료 — ontology v1.5.0 (CONTAINS_TABLE) + 마이그레이션 0023 staging+production 적용 (패턴-H Nested Table) + KnowledgeContractTableCell 6 value_types + validateTablesSection() (MAJOR-A 흡수) + Drizzle 4 테이블 정의 (MAJOR-C 흡수) + batch-processor 시스템 프롬프트 v1.5.0 강화 (D-PHASE2-3=α + D-PHASE2-7=α) + types.ts NodeType/EdgeType union 동기화 (TD-S49-2 부분 흡수)
> **다음 세션 진입 시 본 파일을 가장 먼저 읽고 verify 진입**
> **본 핸드오프 번호 = 058** (050 chain handoff-057의 직계 후속)

## 브랜치 & 컨텍스트

- 브랜치: main
- 마지막 커밋: be783ef (Session 049 backup, Session 050+051 모두 미커밋)
- 미커밋 변경: 10 modified + 21 untracked (verify reports 18 + review 1 + plan 2 + ADR 1 + migration 3 + handoff 2)
- 본 핸드오프 = handoff-session-058.md (Session 051 종착, ADR-032 Phase 2 진입 게이트 5/5 완료)
- ★ Session 050 Phase 1 + Session 051 Phase 2 진입 게이트 = 묶음 backup commit 차세션 entry 권장

## 본 세션(051)에서 한 일

### A. ★ entry verify 영속 2회 PASS 일치

- entry run1+run2 = PASS 6/0/1 일치 (TD-VRF-001 미발현)
- `.claude/reports/sprint1-step5-5-verify-session-051-entry-run{1,2}.json`

### B. ★ 게이트 1 — ontology v1.4.0 → v1.5.0 (CONTAINS_TABLE) + types.ts 동기화

`packages/parser/src/ontology-registry.json` 갱신:

- `version`: 1.4.0 → **1.5.0**
- `edge_types`: 17 → **18** (★ `CONTAINS_TABLE` 추가, CELL → TABLE, 패턴-H Nested Table)
- 4 신규 node_types/edge_types/ID 패턴은 v1.4.0 유지 (Session 050 영속)

`packages/shared/src/types.ts` 갱신 (Session 050 누락 동기화 흡수, TD-S49-2 부분):

- `NodeType` union: 7 → **11** (TABLE/ROW_HEADER/COL_HEADER/CELL 추가)
- `EdgeType` union: 13 → **18** (HAS_ROW/HAS_COLUMN/BELONGS_TO_ROW/BELONGS_TO_COLUMN/CONTAINS_TABLE 추가)
- `TRUTH_WEIGHTS`: 11 키 정합 (TABLE/ROW/COL/CELL = 10 LAW 동급, ADR-032 §"truth_weight 정합")

### C. ★ 게이트 2 — 마이그레이션 0023 staging+production 적용 (D-PHASE2-7=α)

**파일**: `migrations/0023_table_cells_pattern_h.sql`

**변경 사항**:

- `table_cells.value_type` CHECK 5종 → **6종** ('nested_table' 추가)
- `table_cells.nested_table_id TEXT REFERENCES table_structures(id)` 컬럼 추가
- 복합 CHECK 갱신 (value_type='nested_table' ⇒ nested_table_id NOT NULL)
- 신규 인덱스 `idx_table_cells_nested` (패턴-H 역방향 회귀)

**SQLite 12-step procedure** 사용 사유:

- ALTER TABLE는 CHECK 변경 불가 → table_cells_new 재생성 + INSERT-SELECT + DROP + RENAME
- 0021 적재 row 0건 (Phase 2 BATCH 재추출 전) → 데이터 손실 위험 0
- self-ref FK (merged_with_id REFERENCES table_cells(id)) 보존 — RENAME 후 자동 정합
- BEGIN/COMMIT 미포함 (TD-S49-1 정합, wrangler 자동 wrap)

**적용 결과**:

- staging (thepick-db-staging, edacc775...): success / 9 commands / sql_duration=7.42ms
- production (thepick-db-production, a9b8d521...): success / 9 commands / sql_duration=7.44ms
- 검증: `SELECT sql FROM sqlite_master WHERE name='table_cells'` 양쪽 일치 — value_type CHECK 6종 + nested_table_id 컬럼 + 4 인덱스 (idx_table_cells_nested 신규 포함)

### D. ★ 게이트 3 — schema-validator.ts MAJOR-A 흡수 (validateTablesSection)

`packages/parser/src/schema-validator.ts` 갱신:

**KnowledgeContractTableCell 갱신**:

- `value_type`: 5종 → **6종** ('nested_table' 추가, 패턴-H)
- `nested_table_id?: string` 옵션 필드 추가

**8 신규 ValidationErrorCode**:

- `INVALID_TABLE_ID` / `INVALID_TABLE_HEADER_ID` / `INVALID_TABLE_CELL_ID`
- `INVALID_TABLE_VALUE_TYPE` / `DANGLING_TABLE_CELL_REFERENCE` / `DANGLING_NESTED_TABLE_REFERENCE`
- `TABLE_PATTERN_VALUETYPE_MISMATCH` / `TABLE_HEADER_INDEX_GAP`

**`validateTablesSection()` 함수 신설** (MAJOR-A 흡수):

1. tables[].id Ontology Lock + 중복 차단
2. headers[].id axis-prefix 매칭 (row→TROW / column→TCOL)
3. cells[].id (TCELL 패턴)
4. headers index_pos gap 차단 (row_count / col_count 정합 1..N)
5. cells row_id/col_id table 단위 dangling 검증
6. value_type ↔ formula_id / merged_with_id / nested_table_id 정합 (MISSING + DANGLING)
7. pattern_type ↔ value_type cross-validation:
   - F_formula → ≥1 formula 셀, D_merged → ≥1 merged_ref, E_na → ≥1 na
   - A_simple → text/number/na 만 (formula/merged_ref/nested_table 0건)
8. 패턴-H nested_table_id ∈ tables[].id (자기 참조 허용)

**ValidationResult.stats.tablesValidated** 신규 필드 (emptyStats + happy path 정합).

### E. ★ 게이트 4 — parser test 갱신 (172 PASS, +15)

`packages/parser/src/__tests__/schema-validator.test.ts`:

- enum sync 갱신: node_types 7→11 / edge_types 13→18 / registry edge_types 17→18 (CONTAINS_TABLE)
- happy path stats 갱신: tablesValidated: 0 추가
- **신규 describe block "validateTablesSection — Table-as-Micro-KG"** (11 신규 테스트):
  - happy path 3건 (no tables / pattern-A / pattern-H nested)
  - INVALID_TABLE_ID / INVALID_TABLE_HEADER_ID / TABLE_HEADER_INDEX_GAP
  - INVALID_TABLE_CELL_ID / INVALID_TABLE_VALUE_TYPE
  - MISSING_REQUIRED_FIELD (formula / nested_table)
  - DANGLING_TABLE_CELL_REFERENCE (formula_id / row_id) / DANGLING_NESTED_TABLE_REFERENCE
  - TABLE_PATTERN_VALUETYPE_MISMATCH (F_formula 빈 셀 / A_simple + nested_table)

`packages/parser/src/__tests__/normalizer.test.ts`:

- ADR-030 carry-over fixture fix (book_page/pdf_page 추가, typecheck 회복)

`packages/parser/src/__tests__/schema-validator.test.ts` 'comprehensive error collection':

- ADR-030 carry-over fixture fix (book_page=0/pdf_page=0, MISSING_SOURCE_PAGE 의도 보존)

**parser 전체**: 157 → **172 tests PASS** (+15)

### F. ★ 게이트 5 — Drizzle 4 테이블 정의 (MAJOR-C 흡수)

`apps/api/src/db/schema.ts` 갱신:

**EDGE_TYPES enum** 13 → **18** (HAS_ROW/HAS_COLUMN/BELONGS_TO_ROW/BELONGS_TO_COLUMN/CONTAINS_TABLE 추가, knowledge_edges D1 CHECK 부재 — application-layer enum 강제만)

**4 신규 enum**:

- `TABLE_PATTERN_TYPES` (7종 A_simple ~ G_temporal)
- `TABLE_STATUSES` (4종 draft/active/flagged/deprecated)
- `TABLE_HEADER_AXES` (2종 row/column)
- `TABLE_CELL_VALUE_TYPES` (★ 6종, nested_table 포함)
- `TABLE_NODE_LINK_RELATION_TYPES` (3종 extracted_from/referenced_by/supersedes)

**4 신규 sqliteTable export**:

- `tableStructures` — sourceNodeId FK → knowledgeNodes / 3 인덱스 (status / pattern / source_node)
- `tableHeaders` — tableId FK + parentId self-ref / 3 인덱스 (UNIQUE table_axis_level_pos + table_axis + parent)
- `tableCells` — tableId/rowId/colId/formulaId FK + mergedWithId self-ref + nestedTableId FK / 5 인덱스 (UNIQUE table_row_col + 4 idx)
- `tableNodeLinks` — tableId/relatedNodeId FK + 3 인덱스 (UNIQUE table_node_relation + 2 idx)

**8 신규 type export**: TableStructure / NewTableStructure / TableHeader / NewTableHeader / TableCell / NewTableCell / TableNodeLink / NewTableNodeLink

**typecheck PASS** (apps/api strict).

### G. ★ 게이트 6 — batch-processor 시스템 프롬프트 v1.5.0 강화 (D-PHASE2-3=α + D-PHASE2-7=α)

`packages/parser/src/batch-processor.ts` 시스템 프롬프트 전면 갱신:

**갱신 영역**:

1. ontology-registry 정합: v1.3.0 → **v1.5.0**
2. 노드 ID 규칙: 도메인 7종 + **표 노드 4종** (TBL/TROW/TCOL/TCELL prefix 영속, TC- topic_cluster 충돌 회피)
3. 엣지 타입: 13종 → **18종** (도메인 13 + 표 5 — HAS_ROW/HAS_COLUMN/BELONGS_TO_ROW/BELONGS_TO_COLUMN/CONTAINS_TABLE)
4. **ADR-030 페이지 메타** 강화: source_page + book_page + pdf_page (모두 필수) + chapter/section (선택)
5. **§"표 추출 (Table Extraction)" 신규 전체 섹션**:
   - 추출 대상 판별 규칙 (단순 나열 → 본문 흡수, 셀 의미 결정체 → tables[] 분해)
   - 표 메타 8 패턴 (★ A/B/C/D/E/F/G/H — 패턴-H Nested Table 명시)
   - 헤더 분해 규칙 (axis/level/index_pos/parent_id 트리)
   - 셀 분해 규칙 (value_type 6종 + formula_id/merged_with_id/nested_table_id 정합)
   - 패턴 ↔ value_type cross-validation 의무 (F/D/E/A_simple)
   - 안전 규칙 (merged_with_id anchor / 시간축 G_temporal 강제 / 패턴-H 4단계 추출 / dominant 패턴 1개)
6. JSON 출력 스키마 — tables[] 배열 추가 (별표 1 표본주수표 예시 포함)
7. 중요 규칙 강화: 페이지 추적성 + tables[] 분해 의무 + 패턴-H 인식 정확도 ~70% 경고

**관련 변경 영향**: 이 시스템 프롬프트는 Phase 2 BATCH 재추출 시점부터 활성. Phase 2A (BATCH-7 별표 1·2·5·6·7) 진입 시 즉시 효력 발휘. 본 세션 적재 데이터 0건 (구조만 영속).

### H. ★ verify Cat 9 갱신 + 7회 verify 모두 PASS

`scripts/verify-engine-contracts.ts` 갱신:

- parser required: 157 → **172** (15 신규 테스트 흡수)
- migration required: 21 → **22** (0023 추가)
- Cat 9 v1.4.0 → **v1.5.0** (edge_types 17→18, REQUIRED_NEW_EDGE_TYPES 4→5종 CONTAINS_TABLE 포함, 마이그레이션 0023 file 검증, version 1.5.0)
- 보고 명칭 갱신: "Table-as-Micro-KG schema 정합 (ADR-032 v1.5.0, Cat 9)"

`docs/quality/master-test-checklist.md`:

- D1 마이그레이션 파일 카운트 21 → **22**

**verify 영속 (본 세션 7회 모두 PASS)**:

- entry run1+run2 = PASS 6/0/1 일치
- pre-wrangler sanity run = PASS 6/0/1
- final run1+run2 (post-Drizzle + master-checklist) = PASS 6/0/1 일치
- post-batch-processor run1+run2 = **PASS 6/0/1 일치** ★ 본 세션 종착
- TD-VRF-001 본 세션 7회 모두 1회 PASS (retry 0회 — handoff-054 정합 양호)

## 수정된 파일 (미커밋, Session 050+051 누적)

### Modified (10)

- `.jjokjipge/handoff-session-056.md` (Session 049 carry-over)
- `apps/api/src/db/schema.ts` (★ MAJOR-C: 4 신규 테이블 + 5 enum + EDGE_TYPES 18)
- `docs/quality/master-test-checklist.md` (마이그레이션 카운트 21→22)
- `packages/parser/src/__tests__/normalizer.test.ts` (ADR-030 fixture fix)
- `packages/parser/src/__tests__/schema-validator.test.ts` (enum sync 11/18 + comprehensive fix + 11 신규 validateTablesSection 테스트)
- `packages/parser/src/batch-processor.ts` (★ 게이트 6: 시스템 프롬프트 v1.5.0 + 패턴 A~H + ADR-030 갱신)
- `packages/parser/src/ontology-registry.json` (★ v1.4.0 → **v1.5.0** L3, CONTAINS_TABLE 추가)
- `packages/parser/src/schema-validator.ts` (★ MAJOR-A: KnowledgeContractTableCell 6종 + 8 신규 ErrorCode + validateTablesSection)
- `packages/shared/src/types.ts` (★ NodeType 7→11 + EdgeType 13→18 + TRUTH_WEIGHTS 11키)
- `scripts/verify-engine-contracts.ts` (Cat 9 v1.5.0 + parser 172 + migration 22 + 5 edge_types REQUIRED + 0023 file)

### Untracked Session 051 신규 (7건)

- `.claude/reports/sprint1-step5-5-verify-session-051-entry-run{1,2}.json` (entry 2건 PASS 6/0/1)
- `.claude/reports/sprint1-step5-5-verify-session-051-cat9-pre-wrangler-run1.json` (sanity 1건 PASS)
- `.claude/reports/sprint1-step5-5-verify-session-051-final-run{1,2}.json` (post-Drizzle 2건 PASS)
- `.claude/reports/sprint1-step5-5-verify-session-051-post-bp-run{1,2}.json` (★ 종착 2건 PASS 일치)
- `.jjokjipge/handoff-session-058.md` (★ 본 핸드오프)
- `migrations/0023_table_cells_pattern_h.sql` (★ Session 051 신규, staging+production 적용 완료)

### Untracked Session 050 carry-over (14건, 미커밋)

- `.claude/reports/sprint1-step5-5-verify-session-050-*.json` × 13 (Session 050 verify 영속)
- `.claude/reviews/review-20260507-113718-session-050-phase1-foundation.md` (Session 050 4-Pass 통합)
- `docs/adr/ADR-032-table-as-micro-kg.md` (Session 050 Accepted)
- `docs/plans/table-processing-architecture-v1.md` (Session 050 갱신)
- `docs/plans/table-processing-phase2-batch-reextract.md` (Session 050 신규)
- `migrations/0021_table_as_micro_kg.sql` (Session 050 신규, staging+production)
- `migrations/0022_table_structures_update_guard.sql` (Session 050 신규, trigger)
- `.jjokjipge/handoff-session-057.md` (Session 050 종착 핸드오프)

## 누적 통합 통계 (production D1, 2026-05-07 Session 051 종착)

```
knowledge_nodes : 794   (변경 0)
knowledge_edges : 1274  (변경 0)
formulas        : 157   (변경 0)
constants       : 193   (변경 0)
revisions       : 39    (변경 0)
exam_questions  : 545   (변경 0)
topic_clusters  : 50    (변경 0)
table_structures: 0     (★ 신규 테이블, Phase 2A BATCH 재추출 시 채워짐)
table_headers   : 0     (★ 신규 테이블)
table_cells     : 0     (★ 신규 테이블, value_type 6종 + nested_table_id 컬럼)
table_node_links: 0     (★ 신규 테이블)
trigger prevent_table_structures_critical_update : ✅ 적용 (0022 D-PHASE2-1=α)
ontology_registry version : 1.5.0 (★ Table-as-Micro-KG 11 nodes + 18 edges + 패턴-H Nested)
migration count : 22 (0001~0019 + 0021 + 0022 + 0023 / 0020 슬롯 = B-C1 이월)
parser tests : 172 (157 → +15 validateTablesSection 패턴-H 흡수)
```

본 세션(051) = ADR-032 Phase 2 진입 게이트 5/5 완료. Phase 2A BATCH 재추출 (BATCH-7 별표 1·2·5·6·7) 즉시 진입 가능.

## 주요 결정 / 발견

### ★ types.ts NodeType/EdgeType union 11/18 동기화 (TD-S49-2 부분 흡수)

- Session 050에서 ontology v1.4.0 갱신 시 types.ts NodeType/EdgeType union 동기화 누락 → 본 세션 v1.5.0 갱신과 함께 일괄 흡수
- NodeType 7 → 11 (TABLE/ROW_HEADER/COL_HEADER/CELL 추가)
- EdgeType 13 → 18 (HAS_ROW/HAS_COLUMN/BELONGS_TO_ROW/BELONGS_TO_COLUMN/CONTAINS_TABLE 추가)
- TRUTH_WEIGHTS 7 → 11 (표 노드 모두 LAW 동급 truth_weight=10, ADR-032 §"truth_weight 정합")
- ★ Year 2 zero-cost 정합: 표 노드는 도메인 무관이므로 Year 2 Phase 4에서도 별도 분리 불필요

### ★ 패턴-H Nested Table 4단계 추출 흐름 영속

batch-processor 시스템 프롬프트 §"안전 규칙" 영속:

1. 외부 표를 먼저 TBL-N으로 분해 (헤더 + 셀)
2. 내부 표를 TBL-N+1로 별도 분해
3. 외부의 nested 셀을 value_type='nested_table' + nested_table_id='TBL-N+1' 로 연결
4. CONTAINS_TABLE edge (CELL → TABLE) 자동 생성 (Phase 2 BATCH 재추출 시점)

### ★ patten 충돌 해결 (안전 규칙 영속)

batch-processor 시스템 프롬프트 §"안전 규칙":

- 셀 병합 + 시간축 + 산식 동시 출현 시 = dominant 패턴 1개 선택
- 우선순위: F_formula > G_temporal > D_merged > 기본
- 사유: 셀 병합은 visual 메타이지만 산식/시간축은 의미 메타 — 의미 우선

### ★ 마이그레이션 0023 12-step procedure 양쪽 D1 successful

- staging 9 commands / 7.42ms / size_after = 1,945,600 bytes
- production 9 commands / 7.44ms / size_after = 1,998,848 bytes (knowledge_nodes 794 + formulas 157 적재 차이)
- self-ref FK (merged_with_id) 보존 — RENAME 후 자동 정합 검증 완료
- 신규 인덱스 idx_table_cells_nested 양쪽 적용

### ★ Drizzle EDGE_TYPES enum 18종 강제

- D1 schema 0001_initial_schema.sql의 knowledge_edges.edge_type은 CHECK 부재 (TEXT NOT NULL only)
- Drizzle layer enum 18종이 application-layer 강제 (Phase 2 BATCH 재추출 시 5 신규 edge type 사용 가능)
- knowledge_nodes.type CHECK은 7종 그대로 (도메인 노드만, 표 노드는 별도 4 테이블)

## 다음 할 일 (차세션 052+)

### 1. 차세션 entry verify 영속 2회 (의무, 절대 경로)

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > /home/soo/ClaudePro/ThePick/.claude/reports/sprint1-step5-5-verify-session-NNN-entry-run1.json
# (run2 동일) → run1≡run2 PASS 6/0/1 (total 7) 일치 확인
```

### 2. ★★★ Phase 2A BATCH-7 별표 1·2·5·6·7 재추출 (★ 권장 1순위)

| 별표   | 노드                        | 패턴                  | 추정 노드       |
| ------ | --------------------------- | --------------------- | --------------- |
| 별표 1 | LAW-138 표본주수표          | A_simple (7행 × 4열)  | TBL 1 + 40 노드 |
| 별표 2 | LAW-139 미보상비율 적용표   | A_simple (4행 × 3열)  | 19 노드         |
| 별표 5 | LAW-140 무화과 잔여수확량   | F_formula (3행 × 2열) | 13 노드         |
| 별표 6 | LAW-141 손해정도비율 10단계 | A_simple (10행 × 2열) | 31 노드         |
| 별표 7 | LAW-142 고추 병충해 등급    | A_simple (3행 × 3열)  | 16 노드         |

**Phase 2A 누적 추정**: 5 TBL + ~75 TCELL + ~46 헤더 = ~125 노드.

차세션 052 진산 트리거: **"Phase 2A 진입"** 또는 **"별표 재추출 시작"** — BATCH-1~5 적재 패턴 정합 (Claude Code 직접 처리, BATCH 적재 워크플로우 재활용).

### 3. ★★ Phase 2 진입 cap 활성 의무 (memory `project_anthropic_cap_pre_install.md`)

- **$200 monthly + alerts** 활성 의무 (Phase 2 진입 직전)
- 사유 1: BATCH 재추출 토큰 비용 ~$30 추정 (Claude Code 컨텍스트 누적)
- 사유 2: Vectorize 인덱싱 비용 ~$5 추정 (Phase 2D 종착 후 1회)
- 트리거: 차세션 052 entry 시점 진산 cap 활성 확인 + handoff-058 §주의사항 인용

### 4. carry-over (Phase 2 병행 또는 차차세션)

**TD-S49-1**: SQL 제너레이터 작성 시 BEGIN/COMMIT 미추가 정합 — Phase 2 BATCH 재추출 SQL 생성 시 의무
**TD-S49-2 (잔여)**: ontology-registry.ts assertRegistryShape에 node_types_meta + topic_cluster_id_pattern 검증 추가
**TD-S49-3**: ADR-031 또는 ADR-033 — v1.1.0~v1.3.0 history (formula + topic_cluster pattern) 영구 보존 (v1.3.0~v1.5.0은 ADR-032에 영속)
**TD-VRF-001 (carry-over)**: verify Cat1 batch 326/327 flaky — 본 세션 7회 retry 0회 PASS (안정 양호)
**TD-S51-1 (신규)**: master-test-checklist.md Cat 9 영역 추가 — Phase 2 진입 후 별도 task
**TD-S51-2 (신규)**: 누적 미커밋 31건 (Session 050+051) backup commit + push (PAT workflow scope 영속 carry-over)

### 5. 4-Pass 독립 에이전트 리뷰 (의무, 본 세션 미수행)

본 세션 5 게이트 흡수 = L2+ 큰 변경. 4-Pass 독립 에이전트 리뷰 (`auto-review-protocol.md` 정합) 수행 의무. 차세션 entry 또는 Phase 2A 진입 직전 실행.

| Pass             | 관점         | 핵심 검증                                                                  |
| ---------------- | ------------ | -------------------------------------------------------------------------- |
| Pass 1 Surgeon   | 코드 정합성  | validateTablesSection 빈 배열 / NaN row_count / cycle 등 엣지              |
| Pass 2 Architect | 연계 정합    | Drizzle ↔ 0023 schema CHECK 일치 / batch-processor JSON ↔ schema-validator |
| Pass 3 Advocate  | UX + 보안    | 패턴-H 잘못 추출 시 Graceful 안내 / G5.5 검수 UI 미흡                      |
| Pass 4 Contract  | Silent Pivot | ADR-032 + Phase 2 plan vs 실제 구현 일치 / D-PHASE2 결정 영속              |

## 주의사항

### ★ 본 세션 미수행 영역 (carry-over 의무)

- ★ **4-Pass 독립 에이전트 리뷰** (본 세션 5 게이트 흡수 후 실행 의무 — auto-review-protocol.md 위반 carry-over)
- ★ **누적 미커밋 31건** (Session 050+051 모두) — backup commit 의무 (Session 050 단순 backup 후 push)

### ★ Cloudflare API token 회전 의무 (★ 진산 영역)

- 본 세션에서 사용한 토큰이 채팅 + Claude 세션 로그에 평문 노출 (진산 발화 "신경쓰지 마")
- Phase 2A 진입 전후 회전 권장 (https://dash.cloudflare.com/profile/api-tokens → Roll)
- 차세션에서 재사용 시: `! export CLOUDFLARE_API_TOKEN=...` + `! export CLOUDFLARE_ACCOUNT_ID=42ae87a5d555b0feafed37cb66d9dc15`
- ★ 토큰 권한 추가 의무: 본 토큰은 `/memberships` endpoint 차단 → CLOUDFLARE_ACCOUNT_ID env 우회 필수. 항구 해결 = Account.Account Settings: Read 권한 추가

### ★ Phase 2A 진입 전 4-Pass 리뷰 의무

- 본 세션 5 게이트 = 큰 변경 (L2+ 명백). auto-review-protocol.md §"트리거 조건" 정합 = 4-Pass 의무
- 차세션 entry 직후 또는 Phase 2A BATCH 재추출 직전 실행
- 권장: 4 독립 에이전트 (silent-failure-hunter / system-architect / quality-engineer / code-reviewer) 병렬 호출
- 대상 파일: 위 §"Modified 10건" 전체 + Session 050 §"Untracked 3건" (ADR + plan 2 + migration 3)

### ★ table_cells UPDATE 정책 (0023 신규 컬럼 추가)

- 0022 trigger `prevent_table_structures_critical_update` = table_structures 한정
- table_cells / table_headers / table_node_links UPDATE 정책 미명시 (Phase 2A 진입 후 G5.5 검수 시점 결정)
- 차차세션 또는 Phase 2A 종착 시점 = `prevent_table_cells_critical_update` trigger 추가 또는 ADR-032 §"Temporal 정합" 명시 의무

### ★ batch-processor 시스템 프롬프트 ↔ schema-validator validateTablesSection 정합

- 본 세션 = 양쪽 동시 갱신 (단일 진실 = ADR-032 §"패턴 카탈로그 8종")
- LLM이 시스템 프롬프트의 §"표 추출" 정합 출력 → schema-validator validateTablesSection PASS = 정합 영속
- Phase 2A 첫 BATCH 재추출 시 LLM 출력 검증 결과 SLO 의무 (예: pattern_type 분류 정확도 ~85% 이상)

### ★ wrangler 검증 컬럼명 (재확인)

- table_cells = id/table_id/row_id/col_id/value_text/value_type/formula_id/merged_with_id/**nested_table_id**/created_at (★ 본 세션 nested_table_id 신규)
- value_type CHECK 6종: text, number, formula, na, merged_ref, **nested_table** (★ 신규)
- 인덱스: idx_table_cells_table_row_col / table_value / formula / **nested** (★ 신규) + sqlite_autoindex_table_cells_1/2 (PRIMARY KEY + UNIQUE)

### 일반 운영 주의

- migration 0001~0019 + 0021 + 0022 + 0023 staging+production 적용 완료 (0020 슬롯 = B-C1 이월)
- L3 영역 변경 시 plan + 인간 승인 의무 — 본 세션 ontology v1.5.0 + 마이그레이션 0023 모두 plan + ADR-032 + 진산 "권장안으로 진행" 정합
- handoff-042 §9 엔진 추출 carry-over: Layer 1+2+3+4+5(1차+2차 일부)+6 충족하지만 사용자 앱 PWA + Level 3 미충족 → 발화 시 보류 의무
- 누적 이월 MAJOR ~111건 + Session 050 신규 = ~117건 + Session 051 5 게이트 흡수로 MAJOR-A/C 해결, MAJOR-D는 Session 050 0022 trigger로 해결 → ~114건 carry-over
- session-health 본 세션(051): 시작 13:00 KST → 약 80분 경과 (90분 임계 도달 직전 — 차세션 의무)

## ★ 본 세션 종착 시점 진산 결정 영속

| 트리거       | 진산 발화                                                            | 결과                                                       |
| ------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| 본 세션 진입 | "진입 시작"                                                          | Phase 2 진입 게이트 5/5 흡수 (계획대로)                    |
| 0023 적용    | "토큰은 계속 사용해.. 보안 그런거 신경쓰지 말고"                     | ★ 보안 우려 영속, 토큰 회전 carry-over (handoff §주의사항) |
| 본 세션 종착 | "권장안으로 진행해줘 이거 까지 하고 새로운 세션에서 진행해도 되잖아" | 게이트 6 batch-processor 흡수 + 새 세션 진입 결정          |

## 차세션 1차 읽기 의무 문서 (우선순위 순)

1. **`.jjokjipge/handoff-session-058.md`** (본 핸드오프, 1순위)
2. ★★ **`docs/plans/table-processing-phase2-batch-reextract.md`** §4 BATCH 재추출 범위 (Phase 2A 별표 1·2·5·6·7)
3. **`docs/adr/ADR-032-table-as-micro-kg.md`** (Status: Accepted, D-TABLE + D-PHASE2 + 패턴-H 영속)
4. **`packages/parser/src/batch-processor.ts`** §"표 추출" (★ Session 051 시스템 프롬프트 갱신, 패턴 A~H + ADR-030)
5. **`packages/parser/src/schema-validator.ts`** validateTablesSection() (★ Session 051 신규)
6. **`migrations/0023_table_cells_pattern_h.sql`** (★ Session 051 신규, value_type 6종 + nested_table_id)
7. **`apps/api/src/db/schema.ts`** §Table-as-Micro-KG (★ Session 051 신규, 4 테이블 Drizzle)
8. **`packages/parser/src/ontology-registry.json`** v1.5.0
9. **`packages/shared/src/types.ts`** NodeType/EdgeType union (★ Session 051 동기화)
10. **`docs/quality/master-test-checklist.md`** §6.2 (마이그레이션 22)
11. **`scripts/verify-engine-contracts.ts`** Cat 9 v1.5.0 + parser 172 + migration 22
12. `.jjokjipge/handoff-session-057.md` (Session 050 종착, Phase 2 진입 직전)
13. `docs/plans/batch-loadmap.md` (Layer 5 1차 100% / 2차 14% / 545 exam_questions)
14. `.jjokjipge/handoff-session-042.md` §9 (엔진 추출 carry-over 보류 의무)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 051 (ADR-032 Phase 2 진입 게이트 5/5 완료)
**다음 세션**: Session 052 — entry verify + 4-Pass 독립 에이전트 리뷰 (5 게이트 흡수 후 의무) + 진산 트리거 (★ 권장: "Phase 2A 진입" — BATCH-7 별표 1·2·5·6·7 재추출)
**작성 효력**: 2026-05-07 KST (Session 051 종착, **ontology v1.5.0 + 마이그레이션 0023 staging+production 적재 + Drizzle 4 테이블 + batch-processor 시스템 프롬프트 v1.5.0 + types.ts NodeType/EdgeType union 동기화**)
**예상 완료 다음 세션**: handoff-session-059 (Phase 2A 별표 재추출 진행, ~125 노드 적재 + G5.5 진산 spot check)

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
