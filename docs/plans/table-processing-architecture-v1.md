# 표 처리 강화 Architecture Plan v1.0 — Table-as-Micro-KG (다중 자격증 정합)

> **세션**: 049 / 2026-05-07
> **트리거**: 진산 발화 "다른 자격증에서도 2차 시험 문제는 표 형식으로 출제 多 / 비정형 표 정확 이해 + 재현 능력 = 본 프로젝트 핵심 / 엔진 개선 + BATCH 처리에 반드시 반영"
> **L3 영역**: ontology-registry.json 변경 + 마이그레이션 신설 + BATCH 처리 패턴 변경 → plan + 진산 spot check + 인간 승인 의무
> **상태**: Plan 작성 (코드 변경 0). 진산 spot check 후 차세션 단계별 적용.

## 1. 요구 사항 재정의 (★ 핵심 역량)

### 1.1 진산 발화 분해

- **확장 범위**: 손해평가사 한정 X — **다중 자격증 2차 시험 = 표 형식 출제 多**. ADR-007 multi-exam Year 2 정합 영역.
- **핵심 역량**: "다양한 형식(비정형 포함)으로 표현된 표를 **정확하게 이해**하고 **다시 표현**하는 능력"
  - 정확 이해 = 셀 의미 + 행/열 헤더 관계 + 다중 헤더 위계 + N/A·병합 셀 처리
  - 재현 = 학습자에게 원본 그대로 (HTML/Markdown 표 + 기출 표 구조 유지)
- **적용 범위 (★ 본 plan)**:
  - 엔진 개선 (Graph RAG / ontology / Vectorize / RAG 검색)
  - **BATCH 처리 패턴** ★ — LLM 추출 시점에 표 분해 의무
  - 학습 UI (Astro 표 렌더링)

### 1.2 본 plan 핵심 질문 (What)

- ThePick은 **표 형식 학습 콘텐츠 자동 생성 엔진**으로 진화한다.
- 표는 단순 정보 나열이 아닌 "행 × 열 교차점 = 압축된 의미"의 결정체.
- 1차원 텍스트 평탄화 (Flattening) = ThePick 핵심 기능 사망.

## 2. 현 상태 분석 (Session 049 종착)

### 2.1 ontology-registry v1.3.0 (★ 표 노드 미정의)

- node_types 7종: LAW/FORMULA/INVESTIGATION/INSURANCE/CROP/CONCEPT/TERM
- ★ 부재: TABLE / ROW_HEADER / COL_HEADER / CELL 등 표 분해 노드
- 현 패턴: 별표1 표본주수표 → LAW-138 단일 노드로 통합 (셀 의미 손실)

### 2.2 BATCH 처리 (LLM 직접 추출)

- Claude Code Opus 4.7 직접 처리 (한국어 도메인 정밀도 검증)
- BATCH-1~7 + R1/R2 적재 완료 (794 노드 / 1274 엣지)
- ★ 표 추출 패턴 미명시 — 표는 본문 텍스트로 변환되어 단일 LAW 또는 CONCEPT 노드화

### 2.3 D1 schema (현 미지원 영역)

- knowledge_nodes / formulas / constants / topic_clusters 4 메인 테이블
- ★ 부재: table_structures / table_rows / table_columns / table_cells
- exam_questions.related_constants TEXT JSON = cell-level 매핑 미가능

### 2.4 RAG 검색

- Vectorize 임베딩 = 노드 본문 통째 (Row-level 임베딩 X)
- 현재 "사과 600주 미만 가입 시 표본주수" 같은 cell-level 질의 → LAW-138 전체 표 반환 (정밀 X)

### 2.5 학습 UI

- 미구현 (Astro PWA Phase 1+ 영역)
- 현 적재 데이터로는 표 재현 불가능 (셀 구조 미보존)

## 3. 비정형 표 패턴 카탈로그 (★ ThePick 자료 실증)

본 BATCH 적재 자료에서 발견된 표 패턴 7종:

### 패턴-A: 1차원 단순 그리드 (~75%)

- 예: LAW-141 손해정도비율 10단계 (단계 × 비율 1:1)
- 예: 한우 월령별 보험가액 (월령 × 가액)
- 처리: lv1 = 행 헤더 1축 + lv2 = 열 헤더 1축

### 패턴-B: 2-Level 다중 헤더 (~15%)

- 예: LAW-138 별표1 표본주수표 — 7 분류 × 가입주수 4 구간
- 예: 26년 정부지원비율 (CONST-144/145) — 작물 × 지원비율 항목
- 처리: 다층 col_header 또는 row_header 트리

### 패턴-C: 3-Level 다중 헤더 (~5%)

- 예: BATCH-1 적과전 보장재해 매트릭스 — 작물(4) × 재해 종류 × 보장 시점
- 예: 수확량 산정 분기 표 — 작물 × 재해 시기 × 산정 방법
- 처리: 다중 헤더 트리 + intermediate header 노드

### 패턴-D: 셀 병합 (Merged Cells, ~3%)

- 예: 별표9 품목별 감수과실수 표 (LAW-143)
- 예: 가축 한우 수컷/암컷 가액 (성별 × 월령 일부 병합)
- 처리: 병합 영역 메타 노드 + 인간 검수 의무 (G5.5)

### 패턴-E: N/A / 빈 셀 (~2%)

- 예: 가축재해보험 5 부문 × 6 특약 매트릭스 (특약 적용 안 되는 부문 = N/A)
- 처리: NULL 셀 명시 표기 + "비해당" 의미 영속

### 패턴-F: 산식 셀 (Formula in Cell, ~5% 추정)

- 예: 보험금 산정 표 — 셀이 산식 자체 ("보험가입금액 × 피해율 - 자기부담금")
- 처리: 산식 셀 = FORMULA 노드와 cross-link (USES_FORMULA 엣지)

### 패턴-G: 시간축 헤더 (Temporal Header, ~3% 추정)

- 예: 26년 변경표 — "[25년] 산식 / [26년] 산식" 양 컬럼 비교
- 처리: 시간축 헤더 + SUPERSEDES 엣지 자동 연결

### 패턴-H: Nested Table (중첩 표, ★ Session 050 종착 진산 발화 흡수)

- ★ **진산 발화 (Session 050 후반부)**: "표 안에 표가 있는 형태도 반영해줘"
- 예: 별표9 품목별 감수과실수 (LAW-143) — 외부 표(품목 × 보장재해)의 셀 내부에 재해별 감수과실수 산식 행렬
- 예: 위험물기능사 위험등급표 — 외부(등급 1~3) × 내부(품목별 인화점/위험성)
- 예: 공인중개사 가액산정표 — 외부(지역 × 시점) × 내부(보정 계수표)
- 빈도 추정: 손해평가사 ~1~2% / 위험물기능사 ~5% / 공인중개사 ~3%
- 처리:
  - `table_cells.value_type = 'nested_table'` (신규 enum, 차세션 052 마이그레이션 0023)
  - `table_cells.nested_table_id TEXT REFERENCES table_structures(id)` 컬럼 추가 (0023)
  - 신규 edge_type `CONTAINS_TABLE` (CELL → TABLE) — ontology v1.4.0 → v1.5.0 진화 (차세션 052+ 영속)
  - LLM 추출 시 외부 표 분해 → nested cell 발견 시 내부 표를 별도 TBL-N+1로 추출 + nested_table_id로 연결
- 차세션 052 진입 게이트 추가 (D-PHASE2-7 신규):
  - 마이그레이션 0023 = 0022 trigger + table_cells.value_type CHECK 갱신 + nested_table_id 컬럼 + CHECK (`value_type='nested_table' ⇒ nested_table_id NOT NULL`)
  - ontology v1.5.0 = `CELL` → `CONTAINS_TABLE` → `TABLE` 엣지 추가
  - schema-validator KnowledgeContractTableCell.value_type enum 갱신 + nested_table_id 옵션 필드
  - batch-processor 시스템 프롬프트 §"표 추출"에 패턴-H 명시
- ★ Reality Anchor: 패턴-H 인식은 LLM에게 가장 어려움 (~70% 정확 추정). G5.5 인간 검수 필수 + 외부 표 분해 후 nested 셀 라벨링 단계 추가.

## 4. 개선 방안 (Architectural)

### 4.1 ontology-registry v1.3.0 → v1.4.0 (L3 plan 의무)

**신규 node_types 4종** (지식 분해 영역):

★ Session 050 영속 (Pass 4 MN-1 흡수): plan v1 초안 paragraph는 `^TR-`/`^TC-`/`^CELL-` prefix로 작성됐으나 TC- topic_cluster 충돌 회피 + ID 일관성을 위해 아래 "최종 결정 후보" + ontology v1.4.0 영속이 정답. 초안 paragraph는 사적 history.

**최종 결정 후보 (★ ontology v1.4.0 영속)**:

- TABLE: `^TBL-\d{3}$` (TBL-001 ~ TBL-999, 999 표 한도)
- ROW_HEADER: `^TROW-\d{3}-\d{2}$` (표별 99 행 한도)
- COL_HEADER: `^TCOL-\d{3}-\d{2}$` (표별 99 열 한도)
- CELL: `^TCELL-\d{3}-\d{2}-\d{2}$` (표별 행×열 99×99 셀 한도)

**신규 edge_types 4종**:

```
HAS_ROW       → TABLE → ROW_HEADER
HAS_COLUMN    → TABLE → COL_HEADER
BELONGS_TO_ROW    → CELL → ROW_HEADER
BELONGS_TO_COLUMN → CELL → COL_HEADER
```

**기존 edge_types 활용**:

- `USES_FORMULA`: 산식 셀 → FORMULA 노드
- `SUPERSEDES`: 시간축 셀 → 이전 셀 (REV-2026-\* 정합)
- `CROSS_REF`: 표 ↔ 본문 LAW/CONCEPT 노드

### 4.2 D1 schema 변경 (마이그레이션 0021, L3 plan)

**대안 α (정규화 — 권장)**: 4 신규 테이블

```sql
CREATE TABLE table_structures (
  id TEXT PRIMARY KEY,             -- TBL-001
  source_node_id TEXT,             -- 본 표가 속한 LAW/CONCEPT 노드 (예: LAW-138)
  title TEXT NOT NULL,
  pattern_type TEXT CHECK (pattern_type IN ('A_simple','B_2level','C_3level','D_merged','E_na','F_formula','G_temporal')),
  row_count INTEGER NOT NULL,
  col_count INTEGER NOT NULL,
  source TEXT NOT NULL,
  human_reviewed_at INTEGER,       -- G5.5 정합
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE table_headers (
  id TEXT PRIMARY KEY,             -- TROW-001-01 / TCOL-001-01
  table_id TEXT NOT NULL REFERENCES table_structures(id),
  axis TEXT NOT NULL CHECK (axis IN ('row','column')),
  level INTEGER NOT NULL DEFAULT 1, -- 다중 헤더 (1=top, 2=sub, ...)
  index_pos INTEGER NOT NULL,       -- 행/열 순번 (1~99)
  parent_id TEXT REFERENCES table_headers(id), -- 다중 헤더 트리
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE table_cells (
  id TEXT PRIMARY KEY,             -- TCELL-001-01-01
  table_id TEXT NOT NULL REFERENCES table_structures(id),
  row_id TEXT NOT NULL REFERENCES table_headers(id),
  col_id TEXT NOT NULL REFERENCES table_headers(id),
  value_text TEXT,                 -- 셀 본문 (text/숫자/N/A 표시)
  value_type TEXT CHECK (value_type IN ('text','number','formula','na','merged_ref')),
  formula_id TEXT REFERENCES formulas(id), -- 산식 셀
  merged_with_id TEXT REFERENCES table_cells(id), -- 셀 병합 표현
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE table_node_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id TEXT NOT NULL REFERENCES table_structures(id),
  related_node_id TEXT NOT NULL REFERENCES knowledge_nodes(id),
  relation_type TEXT NOT NULL CHECK (relation_type IN ('extracted_from','referenced_by','supersedes')),
  UNIQUE (table_id, related_node_id, relation_type)
);
```

**대안 β (단일 link table — 가벼움)**: cells JSON 컬럼 단일

- table_structures만 신설 + `cells_json TEXT` 컬럼에 전체 cell 행렬 저장
- 단점: cell-level 검색 불가능 (JSON 파싱 필요), 학습 UI 렌더링만 가능
- 장점: 마이그레이션 가볍고 적재 비용 낮음

**권장**: **α (정규화)** — RAG 검색 정밀도 + Cell-level 질의 + multi-exam adapter zero-cost 정합

### 4.3 BATCH 처리 파이프라인 강화 (★ 진산 명시 영역)

**현 패턴**: LLM 직접 추출 (Claude Opus 4.7 한국어 도메인) — `packages/parser/src/batch-processor.ts:101-185` 시스템 프롬프트

**강화 패턴**:

1. **표 인식 prompt 추가**: BATCH 추출 prompt에 "표가 발견되면 별도 `tables` 배열로 추출" 명시
2. **표 분해 schema**: KnowledgeContract에 `tables?: KnowledgeContractTable[]` 필드 추가 (Session 050 Phase 1 영속, optional)
   ```typescript
   // Session 050 영속 형태 (D1 FK 정규화 정합 — packages/parser/src/schema-validator.ts)
   interface KnowledgeContractTable {
     id: string; // TBL-NNN
     source_node_id: string; // 표가 속한 LAW/CONCEPT 노드
     title: string;
     pattern_type:
       | 'A_simple'
       | 'B_2level'
       | 'C_3level'
       | 'D_merged'
       | 'E_na'
       | 'F_formula'
       | 'G_temporal';
     row_count: number;
     col_count: number;
     source: string; // 출처 (북극성 추적성 강제, NOT NULL)
     headers: KnowledgeContractTableHeader[]; // {id, axis, level, index_pos, parent_id?, text}
     cells: KnowledgeContractTableCell[]; // {id, row_id, col_id, value_text?, value_type, formula_id?, merged_with_id?}
   }
   ```
   ★ Session 050 갱신 (Pass 4 MAJOR-E 흡수): 본 plan v1 초안의 `cells: { row_index, col_index, ... }` 인덱스 기반은 D1 FK 정합 위해 `row_id/col_id` (TROW/TCOL ID 참조) 정규화 형태로 진화. plan↔구현 정합 영속.
3. **검증 로직** (verify-engine-contracts.ts 확장):
   - 모든 cell의 row/col 인덱스 unique
   - 헤더 카운트 = row_count × col_count + 헤더 합
   - pattern_type별 정합성 (D_merged 시 merged_with_id 필수 등)
4. **인간 검수 G5.5**:
   - admin-web에 `/tables/<TBL-NNN>` 검수 UI (Phase 1+ 영역)
   - 표 구조 + 셀 매핑 시각적 확인 후 status='active' 전이

### 4.4 RAG 검색 정밀화

**Row-level 임베딩**:

- 현 Vectorize: 노드 본문 통째 임베딩
- 신규: 각 row를 "row_header × 모든 col_header 조합 명제"로 치환 후 임베딩
- 예: "사과 가입주수 600주 미만의 표본주수 = 5주 / 600~1500주 = 6주 / 1500~3000주 = 8주 / 3000주 이상 = 10주"
- 인덱싱: row 별도 vectorize 메타 + table_id 역참조

**Cell-level 질의**:

- 사용자 질의: "사과 가입주수 800주 시 표본주수?"
- Step 1: 표 검색 (TABLE 노드 임베딩 매칭 → LAW-138 표본주수표)
- Step 2: row 매칭 ("사과" + "600~1500주" 행)
- Step 3: cell 정확 반환 (CELL.value_text = "6주")

**truth_weight 재설계**:

- 현 LAW > FORMULA > CONCEPT
- 신규 추가: TABLE_CELL = LAW + 본문 명제 vs CELL 직접값 우선 (정밀도 高)
- 단 셀 의미는 row+col 헤더 컨텍스트 의존 → standalone weight X

### 4.5 학습 UI 표 재현 (Astro PWA, Phase 1+ 영역)

- HTML `<table>` 직접 렌더 (다중 헤더 = `<th rowspan/colspan>`)
- 셀 병합 패턴-D 지원 (CELL.merged_with_id → rowspan/colspan 자동)
- 학습자 cell click → 해당 셀이 출제된 기출 questions 매핑 표시
- KaTeX/MathJax 통합 (산식 셀 = 수식 렌더)

## 5. 다중 시험 정합 (ADR-007 Year 2 zero-cost 전환)

### 5.1 도메인 무관 설계 의무

본 plan의 4 신규 테이블 + 4 신규 노드 타입은 **시험 도메인 무관 범용 패턴**.

- TABLE / ROW_HEADER / COL_HEADER / CELL = 모든 자격증 적용 가능
- 시험별 특화 X (Hard Rule 15 정합)

### 5.2 멀티시험 자료 표 분포 (추정)

| 시험                     | 표 빈도        | 비정형 영역             | 핵심 패턴 |
| ------------------------ | -------------- | ----------------------- | --------- |
| 손해평가사 (Year 1)      | 多 (~15% 본문) | 별표 1·2·5·6·7·9        | A/B/F/G   |
| 공인중개사 (Year 2 후보) | 매우 多 (~25%) | 부동산 가액 비교 + 세율 | A/B/D     |
| 전기기사                 | 中 (~10%)      | 회로도 + 일부 표        | A/F       |
| 소방설비기사             | 多 (~20%)      | 설비 분류 + 화재 등급   | B/C       |
| 위험물기능사             | 매우 多 (~30%) | 위험물 분류 + 인화점    | B/D       |

→ Year 2 공인중개사/위험물 진입 시 본 plan 적용 시 비용 0 (zero-cost adapter).

### 5.3 시험별 adapter 영역 분리 (Year 2)

- 범용 영역: `packages/parser/src/table-extractor.ts` (LLM 추출 + schema 검증)
- 시험별 영역: `exams/{exam_id}/table-patterns.ts` (특수 패턴 처리, 예: 손해평가사 LAW-138 매핑)

## 6. Phase별 작업 분해

### Phase 1 (차세션 050~053, ~3 세션) — Foundation

1. **D-TABLE-1~5 진산 spot check** (ID 패턴 / schema 대안 / 마이그레이션 스코프 / BATCH 패턴 변경 범위 / 인간 검수 UX)
2. **ontology v1.3.0 → v1.4.0 적용** (TABLE/ROW_HEADER/COL_HEADER/CELL 4 노드 + 4 엣지) — L3 plan + 진산 승인
3. **마이그레이션 0021 적용** (4 신규 테이블 또는 단일 link table — α/β 결정 후) — staging+production
4. **batch-processor.ts 시스템 프롬프트 갱신** (표 추출 영역 + tables[] 출력)
5. **TableStructure schema + Zod validator 추가** (`packages/parser/src/`)
6. **verify-engine-contracts.ts 확장** (Cat 신규 = 표 구조 검증)

### Phase 2 (차세션 054~058, ~5 세션) — 기존 BATCH 표 분해 적용

1. **재추출 BATCH-7 별표 1·2·5·6·7·9** — 표 패턴-A/B/F/G 100% 분해 + 영속
2. **재추출 BATCH-1 적과전 보장재해 매트릭스** — 패턴-C 3-Level 헤더
3. **재추출 BATCH-6 가축 5 부문 × 6 특약** — 패턴-E N/A
4. **재추출 BATCH-R1 26년 변경표** — 패턴-G 시간축
5. **인간 검수 G5.5** — admin-web 표 검수 UI 임시 도구 또는 진산 직접 spot check

### Phase 3 (Phase 1+ 영역, 별도 세션) — 학습 UI

1. Astro 표 렌더링 컴포넌트 (다중 헤더 + 셀 병합 + 산식 셀)
2. 셀 클릭 → 기출 매핑 UI
3. KaTeX 통합 (산식 셀)

### Phase 4 (Year 2 ADR-007 영역) — multi-exam adapter

1. `exams/<exam_id>/table-patterns.ts` 시험별 분리
2. 공인중개사/위험물 표 적재 검증

## 7. ★ 진산 결정 의무 (D-TABLE-1~6, 차세션 spot check)

| ID        | 결정                    | 옵션                                                                            | 권장                           |
| --------- | ----------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| D-TABLE-1 | ID 패턴 (TC- 충돌 회피) | α: TBL/TROW/TCOL/TCELL prefix / β: 별도 namespace                               | α                              |
| D-TABLE-2 | schema 대안             | α: 4 정규화 테이블 / β: 단일 link table + cells JSON                            | α (RAG 정밀도 우선)            |
| D-TABLE-3 | 기존 BATCH 재추출 범위  | α: BATCH-7 별표만 (위험 낮음) / β: BATCH-1+6+R1 추가 / γ: 전체 BATCH-1~7 재추출 | β (점진 — 영향 큰 영역만)      |
| D-TABLE-4 | BATCH 처리 패턴         | α: 신규 BATCH부터 적용 + 기존 carry-over / β: 즉시 전체 재추출                  | α (점진)                       |
| D-TABLE-5 | 인간 검수 UX            | α: admin-web 표 전용 UI 신설 / β: 진산 직접 spot check (수동)                   | β (Phase 1 임시) → α (Phase 2) |
| D-TABLE-6 | RAG 검색 강화 시점      | α: Phase 1과 동시 / β: Phase 2 후 (재추출 완료 후)                              | β (데이터 적재 후 인덱싱)      |

## 8. ★ Reality Anchor — 본 plan이 "불가능"할 이유 3가지

### 이유 1: 셀 병합 패턴-D 정확 추출 한계

- PDF 표의 셀 병합은 시각적으로만 명확. LLM 텍스트 추출 시 **병합 정보 소실**.
- 본 자료에서 별표9 품목별 감수과실수 (LAW-143)는 BATCH-7 적재 시 메타 노드로 회피 — 즉 셀 분해 X.
- **대응**: 패턴-D는 Phase 2에서 인간(진산) 직접 cell-level 영속 의무 (G5.5 강제)
- **잔여 위험**: 진산 시간 부담 (자료 별표9 = 75p 분량)

### 이유 2: 다중 헤더 의미축 분리 한계

- 예: 26년 변경표 헤더가 "[25년 평년수확량 / 26년 평년수확량]" — 시간축 + 의미축 동시
- LLM이 시간축을 무시하고 의미축만 추출 가능 → SUPERSEDES 엣지 자동 생성 누락
- **대응**: 패턴-G 검증 로직 (header text에 "년도/연도" 포함 시 시간축 강제 분리) — 정확도 ~85% 추정
- **잔여 위험**: 비전형 시간 표기 (예: "구판/신판" / "기존/개정") = 정확 매핑 어려움

### 이유 3: D1 노드 카운트 폭증

- 현 794 노드. 표 1개당 ~30~100 노드 분해 시 (예: 별표1 = 7행 × 4열 = 28셀 + 11 헤더 + 1 표 = 40 노드)
- 손해평가사 추정 표 50개 × 평균 40 노드 = +2,000 노드. D1 size 증가 ~5MB → 무료 한도 (5GB) 영향 0
- **잔여 위험**: 검색 path 복잡화 → Vectorize 호출 비용 + D1 join 비용 증가. memory `project_anthropic_cap_pre_install.md` 정합 — Phase 2 진입 시 cost cap 활성 의무.

★ **3가지 이유 모두 "치명적 차단" 아님 → plan 진행 가능. 단 진산 spot check 5건 (D-TABLE-1~5) 결정 후.**

## 9. ADR-032 표제 명시

본 plan 채택 시 `docs/adr/ADR-032-table-as-micro-kg.md` 영구 보존:

- Title: Table-as-Micro-KG 도입 — 다중 자격증 비정형 표 정확 이해/재현
- Status: Proposed (진산 spot check 후 Accepted)
- Context: ThePick = 다중 자격증 학습 엔진 → 2차 시험 표 출제 多 + 셀 의미 정확 보존 의무
- Decision: Graph RAG 정밀 진화 (4 신규 노드 + 4 신규 엣지 + 4 신규 D1 테이블)
- Alternatives: RAG-Anything VLM (오버스펙, Cloudflare 정합 위반 위험) / 현 통합 노드 유지 (셀 의미 손실)
- Consequences:
  - - 비정형 표 100% 분해 + cell-level RAG + multi-exam zero-cost adapter
  - − D1 노드 +2,000~5,000 / 검색 path 복잡 / 인간 검수 G5.5 부담 증가

## 10. 다음 단계 (차세션 050+ 진입)

1. ★ **본 plan + ADR-032 진산 검토** (D-TABLE-1~6 spot check)
2. 결정 후 ontology v1.4.0 적용 (L3 작업)
3. 마이그레이션 0021 staging+production
4. batch-processor.ts schema 확장
5. Phase 2 재추출 (BATCH-7 별표 1·2·5·6·7·9 우선)

---

**작성**: Claude (Opus 4.7 1M context) — Session 049 단계 1C 후속
**상태**: Plan 작성 완료. 진산 spot check 후 차세션 050+ 진입 의무.
**예상 완료**: Phase 1 (3 세션) + Phase 2 (5 세션) = ~8 세션 후 BATCH 표 영역 완전 분해.
