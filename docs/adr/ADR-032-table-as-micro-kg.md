# ADR-032: Table-as-Micro-KG 도입 — 다중 자격증 비정형 표 정확 이해/재현

**Status**: Accepted (2026-05-07 Session 050 진산 spot check 권장 일괄 채택)
**Date**: 2026-05-07 (Proposed — Session 049 / Accepted — Session 050)
**Deciders**: 진산 (PO) + Claude (Opus 4.7)
**Supersedes**: 없음 (신규 도메인 영역)
**Related**: ADR-007 (multi-exam Year 2), ADR-031 (formula_id_pattern v1.2.0), v1.3.0 topic_cluster_id_pattern

## D-TABLE 결정 영속 (Session 050, 진산 "권장대로 진행")

| ID        | 채택  | 의미                                                     |
| --------- | ----- | -------------------------------------------------------- |
| D-TABLE-1 | α     | TBL/TROW/TCOL/TCELL prefix (TC- topic_cluster 충돌 회피) |
| D-TABLE-2 | α     | 4 정규화 테이블 (RAG 정밀도 우선)                        |
| D-TABLE-3 | β     | 기존 BATCH 재추출 = BATCH-1+6+7+R1 영향 큰 영역만        |
| D-TABLE-4 | α     | 신규 BATCH부터 적용 + 기존 carry-over 점진               |
| D-TABLE-5 | β → α | Phase 1 진산 직접 spot check / Phase 2 admin-web UI      |
| D-TABLE-6 | β     | RAG 검색 강화 = Phase 2 데이터 적재 후                   |

## D-PHASE2 결정 영속 (Session 050 후반부, 진산 "권장안으로" → "권장대로 진행")

`docs/plans/table-processing-phase2-batch-reextract.md` §5 의무 결정 6건 모두 권장값 채택:

| ID         | 채택 | 의미                                                                                                                                                                                                               |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-PHASE2-1 | α    | MAJOR-D UPDATE 정책 = 마이그레이션 0022 `prevent_table_structures_critical_update` trigger (Hard Rule 28 자동 강제)                                                                                                |
| D-PHASE2-2 | α    | Drizzle 정의 = `apps/api/src/db/schema.ts` 통합 (단일 파일 정합)                                                                                                                                                   |
| D-PHASE2-3 | α    | BATCH 재추출 순서 = 2A → 2B → 2C → 2D 순차 (패턴 단순→복잡)                                                                                                                                                        |
| D-PHASE2-4 | α    | LLM 1차 추출 + G5.5 인간 검수 (LLM 75% + 검수 효율)                                                                                                                                                                |
| D-PHASE2-5 | α    | 별표 9 분해 깊이 = 메타 + 본문 핵심 10개 표 (75p 전체는 BATCH-1~5 정합 중복 회피)                                                                                                                                  |
| D-PHASE2-6 | β    | G5.5 검수 시점 = 단계별 (2A/2B/2C/2D 종착마다, 회귀 조기 발견)                                                                                                                                                     |
| D-PHASE2-7 | α    | Session 050 후반부 — 패턴-H Nested Table (셀 안에 표 중첩) — 8 패턴 카탈로그 + value_type 6종 + nested_table_id 컬럼                                                                                               |
| D-PHASE2-8 | α    | Session 052 4-Pass 흡수 — pattern_type CHECK 8종 (마이그레이션 0024) + schema-validator 화이트리스트 + DFS cycle 검출 + book_page/pdf_page 표 단위 강제 + truth_weight 점진 감쇠 + Buffer→TextEncoder Workers 호환 |

### Session 050 후반부 추가 — 패턴-H Nested Table 영속 (진산 발화)

★ 진산 발화: "표 안에 표가 있는 형태도 반영해줘" (Session 050 종착 직전).

본 ADR §Decision 영역에 **패턴-H (Nested Table) 추가**:

- 적용 범위: 별표9 품목별 감수과실수 (LAW-143) + 다중 자격증 (위험물 등급표 / 공인중개사 가액산정표) — 외부 표 셀 내부에 재해/품목/시점별 보정 표 중첩
- ontology v1.4.0 → **v1.5.0** (차세션 052+ 영속): 신규 edge_type `CONTAINS_TABLE` (CELL → TABLE)
- D1 schema 확장 (마이그레이션 0023, L3 영역, 차세션 052 진입 게이트):
  - `table_cells.value_type` enum에 `nested_table` 추가 (5종 → 6종)
  - `table_cells.nested_table_id TEXT REFERENCES table_structures(id)` 컬럼 추가
  - CHECK (`value_type='nested_table' ⇒ nested_table_id NOT NULL`)
- KnowledgeContractTableCell schema 확장: `value_type: 'text' | 'number' | 'formula' | 'na' | 'merged_ref' | 'nested_table'` + `nested_table_id?: string`
- batch-processor 시스템 프롬프트 강화: 패턴-H 발견 시 외부 표 분해 + 내부 표를 별도 `TBL-NNN` 신규 ID로 추출 후 nested_table_id로 연결
- D-PHASE2-7 신규: 패턴-H 분해 의무 — 차세션 052 진입 게이트에 마이그레이션 0023 + ontology v1.5.0 + schema-validator + batch-processor 추가

★ Reality Anchor 추가: 패턴-H 인식 정확도 ~70% (LLM 가장 어려운 영역). G5.5 인간 검수 강제 + 외부 표 분해 후 nested 셀 라벨링 추가 단계 의무.

### Session 052 entry 추가 — 4-Pass 독립 리뷰 흡수 (D-PHASE2-8=α)

★ Session 052 entry 차세션 첫 작업으로 4 독립 에이전트 (silent-failure-hunter / system-architect / quality-engineer / code-reviewer) 병렬 리뷰 → Critical 6건 발견. 진산 "권장안으로 진행" 트리거 후 일괄 흡수.

본 ADR §Decision 영역에 다음 추가 영속:

#### §"패턴 카탈로그 8종" — pattern_type 8종 enum 단일 진실

`table_structures.pattern_type` CHECK 7종 → 8종 (마이그레이션 0024):

```
A_simple / B_2level / C_3level / D_merged / E_na / F_formula / G_temporal / H_nested
```

4 layer 정합 의무: ① batch-processor 시스템 프롬프트 §"표 메타 8 패턴" ② `KnowledgeContractTable.pattern_type` TS union ③ `apps/api/src/db/schema.ts` `TABLE_PATTERN_TYPES` Drizzle enum ④ `migrations/0024` D1 SQL CHECK. 1 layer drift 시 LLM hallucination → BATCH rollback.

`schema-validator.ts` `VALID_TABLE_PATTERN_TYPES` 화이트리스트로 application-layer 1차 방어선 강제 (`INVALID_TABLE_PATTERN_TYPE` ErrorCode).

#### §"truth_weight 정합" v2 — 점진 감쇠 (Session 052 CRIT-E 흡수)

table-processing-architecture-v1.md §4.4 정합:

```
TABLE       = 9  (FORMULA 동급 — 표 메타 자체는 LAW 본문 직접 인용)
ROW_HEADER  = 8  (헤더 텍스트 = LAW 본문 보조, 단독 RAG 우선 X)
COL_HEADER  = 8  (동일)
CELL        = 7  (셀 의미는 row+col 헤더 컨텍스트 의존 → standalone weight 부정합)
```

사유: ROW/COL 헤더 텍스트가 LAW 본문보다 RAG 우선 노출되는 사례 차단. 셀 단독 임베딩이 LAW 본문을 dilute하는 구조 위험 회피. v1 (`TABLE/ROW/COL/CELL = 10`)은 plan §4.4 "standalone weight X" 의도 정면 위배 → Silent Pivot 자가 인정 + v2 채택.

#### §"Temporal 정합" — table_cells/headers/node_links UPDATE 정책 (carry-over 명시)

`prevent_table_structures_critical_update` trigger (마이그레이션 0022) = `table_structures` 한정. `table_cells / table_headers / table_node_links` UPDATE 정책 = Phase 2A 종착 시점 또는 G5.5 검수 진입 시점 trigger 추가 의무 (D-PHASE2-9 후속 결정 carry-over).

#### §"value_type 6종" — table_cells.value_type chain (0021 + 0023)

`table_cells.value_type` enum 5종 → 6종:

```
0021 (v1.4.0): text / number / formula / na / merged_ref
0023 (v1.5.0): + nested_table (D-PHASE2-7=α 패턴-H)
```

복합 CHECK: `value_type='nested_table' ⇒ nested_table_id NOT NULL`.

#### §"Workers 호환 정합" — Buffer 의존 제거 (Session 052 CRIT-F 흡수)

`schema-validator.ts validateRawResponseSecurity` 의 `Buffer.byteLength(raw, 'utf-8')` → `new TextEncoder().encode(raw).length` 교체. 사유: Cloudflare Workers 런타임은 `nodejs_compat` flag 부재 시 `Buffer` 미존재 → ReferenceError. TextEncoder는 V8/Workers/Node 모두 표준.

#### §"Nested Cycle Hardening" — DFS 사이클 검출 (Session 052 CRIT-C 흡수)

`validateTablesSection` 3차 pass에 `detectNestedTableCycle` 추가 — 자기 참조(A→A) `NESTED_TABLE_SELF_REFERENCE` 거부 + 다단(A→B→A 등) `NESTED_TABLE_CYCLE_DETECTED` 거부. 사유: UI 무한 재귀 / Workers CPU 50ms 한도 초과 / OX 정답 결정 불가 (Hard Stop 조건).

#### §"표 단위 출처 추적성" — book_page/pdf_page 강제 (Session 052 CRIT-D 흡수)

`KnowledgeContractTable` 에 `book_page: number` + `pdf_page: number` 필수 필드 추가 (ADR-030 정합). `validateTablesSection`에서 `isValidSourcePage` 강제. 사유: 셀 오추출 시 역추적 가능 + admin G5.5 검수 + 수험자 "근거 보기" UX 1급 기능 (memory `project_source_citation_requirement.md`).

## Context

ThePick은 다중 자격증 자동 학습 엔진을 지향한다 (memory `project_vision_mvp_generalization.md` 정합). 2차 시험 (실무·서술형) 자료에서 **표(Table) 형식 출제가 압도적**이며, 이는 도메인 무관 패턴이다:

| 시험                       | 표 빈도 추정                |
| -------------------------- | --------------------------- |
| 손해평가사 (Year 1)        | ~15% (별표 1·2·5·6·7·9)     |
| 공인중개사 (Year 2 후보)   | ~25% (가액 비교 + 세율)     |
| 위험물기능사 (Year 2 후보) | ~30% (위험물 분류 + 인화점) |
| 소방설비기사               | ~20% (설비 + 화재 등급)     |
| 전기기사                   | ~10% (회로 + 일부 표)       |

진산 발화 (Session 049): "다른 자격증에서도 2차 시험 문제는 표 형식 출제 多 / 비정형 표 정확 이해 + 재현 능력 = 본 프로젝트 핵심 / 엔진 개선 + BATCH 처리에 반드시 반영"

**문제**:

- 현 ontology v1.3.0은 7 node_types (LAW/FORMULA/INVESTIGATION/INSURANCE/CROP/CONCEPT/TERM) — 표 분해 노드 부재
- 현 BATCH 처리 = LLM 직접 추출 → 표 본문이 텍스트로 변환되어 단일 LAW 또는 CONCEPT 노드화
- 셀 의미 (행 헤더 × 열 헤더 교차점) 완전 손실 → cell-level RAG 검색 미가능
- 학습 UI 표 재현 불가능 (셀 구조 미보존)

## Decision

**Graph RAG 정밀 진화 (Table-as-Micro-KG)** 채택. RAG-Anything VLM은 오버스펙 + Cloudflare Workers 엣지 환경 정합 위반 위험으로 배제.

### 핵심 변경 (4 영역)

#### 1. ontology-registry v1.3.0 → v1.5.0

신규 4 node_types + 5 edge_types (v1.4.0 4 + v1.5.0 1):

```
node_types: TABLE / ROW_HEADER / COL_HEADER / CELL
edge_types: HAS_ROW / HAS_COLUMN / BELONGS_TO_ROW / BELONGS_TO_COLUMN  (v1.4.0)
            CONTAINS_TABLE                                              (v1.5.0 D-PHASE2-7=α 패턴-H)
```

ID 패턴 (★ TC- 충돌 회피, D-TABLE-1=α 권장):

```
TABLE       : ^TBL-\d{3}$
ROW_HEADER  : ^TROW-\d{3}-\d{2}$
COL_HEADER  : ^TCOL-\d{3}-\d{2}$  ★ TC-NNN topic_cluster와 prefix 분리
CELL        : ^TCELL-\d{3}-\d{2}-\d{2}$
```

#### 2. D1 schema 마이그레이션 0021 (D-TABLE-2=α 권장 — 정규화)

4 신규 테이블: `table_structures` / `table_headers` / `table_cells` / `table_node_links`
상세: `docs/plans/table-processing-architecture-v1.md` §4.2

#### 3. BATCH 처리 파이프라인 강화

- `packages/parser/src/batch-processor.ts` 시스템 프롬프트에 표 추출 영역 추가
- KnowledgeContract schema에 `tables: TableStructure[]` 필드 추가
- verify-engine-contracts.ts Cat 신규 = 표 구조 검증

#### 4. RAG 검색 정밀화

- Row-level 임베딩 (row_header × col_header 명제 치환)
- Cell-level 질의 path (TABLE 검색 → row 매칭 → cell 정확 반환)

### 시험 도메인 무관 (Hard Rule 15 정합)

4 신규 node_types + schema는 모든 자격증 적용 가능. 시험별 특화는 `exams/<exam_id>/table-patterns.ts` (Year 2 ADR-007 zero-cost adapter).

## Alternatives Considered

### 대안 A: 현 통합 노드 유지 (REJECTED)

- 셀 의미 손실 + cell-level RAG 미가능
- 학습 UI 표 재현 불가능
- ★ **본 프로젝트 핵심 역량 미달성**

### 대안 B: RAG-Anything VLM 도입 (REJECTED)

- 오버스펙 (멀티모달 파서 + VLM = 토큰 비용 폭증)
- Cloudflare Workers 엣지 50ms CPU 한도 초과 위험
- memory `feedback_single_vendor_cloudflare.md` 정합 위반 가능 (외부 VLM SaaS 의존 시)

### 대안 C: 단일 link table + cells JSON (D-TABLE-2=β, REJECTED)

- 마이그레이션 가벼움 + 적재 비용 낮음
- ★ 그러나 cell-level RAG 검색 미가능 (JSON 파싱 필요) → **본 plan 핵심 목표 미달성**

### 대안 D: Table-as-Micro-KG 정규화 ★ ACCEPTED (D-TABLE-2=α)

- 4 신규 테이블 + 4 신규 노드 타입
- RAG 정밀도 + cell-level 질의 + multi-exam zero-cost
- D1 노드 폭증 (~+2,000~5,000) 위험은 무료 한도 (5GB) 內 안전

## Consequences

### Positive

- ★ 비정형 표 100% 분해 (패턴 A/B/C/E/F/G 자동, D 인간 검수)
- ★ Cell-level RAG 검색 정밀도 → "사과 가입주수 800주 시 표본주수?" 질의 정확 답변
- ★ 학습 UI 표 재현 (HTML `<table>` 원본 그대로 + 산식 셀 KaTeX)
- ★ Multi-exam Year 2 zero-cost adapter (도메인 무관 패턴)
- 자료 별표 1·2·5·6·7·9 (BATCH-7) 정밀 재추출 가능

### Negative

- D1 노드 카운트 +2,000~5,000 (현 794 → ~3,000~6,000)
- 검색 path 복잡 (Vectorize → TABLE 매칭 → row → cell 3-step)
- 인간 검수 G5.5 부담 (셀 병합 패턴-D 진산 직접 영속)
- BATCH 처리 토큰 비용 ~20% 증가 (표 영역 추가 추출)

### Neutral

- 마이그레이션 0021 staging+production 적용 (BATCH-1~7 적재 영향 0 — 별도 테이블)
- 기존 BATCH 재추출 범위 = D-TABLE-3 진산 결정 (β 권장 — BATCH-1+6+7+R1만 영향 큰 영역)

## Reality Anchor (불가능할 이유 3가지)

### 1. 셀 병합 패턴-D 정확 추출 한계

- PDF 시각 정보가 LLM 텍스트 추출 시 소실 → 인간 검수 G5.5 강제
- **대응**: 패턴-D는 Phase 2 진산 직접 영속 의무

### 2. 다중 헤더 의미축 분리 한계 (~85% 정확)

- 시간축 + 의미축 동시 헤더 (예: "25년 / 26년") → LLM 자동 SUPERSEDES 엣지 누락 가능
- **대응**: header text "년도/연도" 포함 시 시간축 강제 분리 검증 로직

### 3. D1 노드 카운트 폭증 → cost 영향

- ~+5,000 노드. D1 size 안전 (~5MB) 그러나 Vectorize 호출 비용 증가
- **대응**: memory `project_anthropic_cap_pre_install.md` 정합 — Phase 2 진입 전 $200/월 cap 활성 의무

★ 3 이유 모두 "치명적 차단" 아님 → plan 진행 가능 (D-TABLE-1~6 진산 결정 후).

## Implementation Phases

### Phase 1 (차세션 050~053, ~3 세션) — Foundation

1. D-TABLE-1~6 진산 spot check
2. ontology v1.4.0 적용
3. 마이그레이션 0021 staging+production
4. batch-processor.ts schema 확장
5. verify-engine-contracts.ts Cat 신규

### Phase 2 (차세션 054~058, ~5 세션) — 기존 BATCH 표 분해

1. BATCH-7 별표 1·2·5·6·7·9 재추출 (패턴 A/B/F/G)
2. BATCH-1 적과전 보장재해 매트릭스 (패턴 C)
3. BATCH-6 가축 5×6 매트릭스 (패턴 E)
4. BATCH-R1 26년 변경표 (패턴 G)
5. 인간 검수 G5.5

### Phase 3 (별도, Phase 1+ UI 영역) — 학습 UI

- Astro 표 렌더링 + 셀 병합 + 산식 셀 KaTeX

### Phase 4 (Year 2 ADR-007) — multi-exam adapter

- `exams/<exam_id>/table-patterns.ts` 분리

## Cross-Reference

- **Plan**: `docs/plans/table-processing-architecture-v1.md` (본 ADR 도출 plan)
- **Memory**: `project_table_processing_core_capability.md` (신규, 본 ADR 정합)
- **ADR-007**: multi-exam Year 2 zero-cost adapter
- **ADR-031**: formula_id_pattern v1.2.0 (선례 — ID 패턴 확장 패턴)
- **handoff-session-056.md**: §I (단계 1C 후속 → 표 처리 plan 영속 트리거)

---

**Status 전이 의무**:

- Proposed (현 시점)
- → Accepted (진산 spot check D-TABLE-1~6 결정 후)
- → Deprecated (Phase 4 multi-exam adapter 분리 후)
