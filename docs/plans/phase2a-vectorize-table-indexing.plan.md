# Phase 2A — Table-as-Micro-KG Vectorize 인덱싱 plan (Step 2)

> **세션**: 057 / 2026-05-08
> **트리거**: handoff-065 §3 권장 A — table_cells 인덱싱 (진산 "057 fresh + 권장안" 영속)
> **선행 step**: Phase 2A Vectorize 인덱싱 PoC PASS (commit 5138366, knowledge_nodes 794 영속)
> **선행 ADR**: ADR-004 §4 Addendum (draft 인덱싱 허용), ADR-007 (멀티시험 격리), ADR-008 (graceful), ADR-032 (Table-as-Micro-KG)
> **상태**: Plan 영속 → 즉시 코딩 진입 (전략 갈림길 0건, 진산 권장안 영속).

---

## 1. ★ 핵심 사실 영속

### 1.1 현 production D1 table\_\* 상태 (2026-05-08 verify)

| 테이블             | row 수 | 분포                                                                |
| ------------------ | ------ | ------------------------------------------------------------------- |
| `table_structures` | 20     | A_simple=18, F_formula=1, H_nested=1 (전부 status='draft')          |
| `table_headers`    | 167    | (status 컬럼 없음 — 부모 table_structures.status 추론 의무)         |
| `table_cells`      | 246    | text=228, nested_table=15, formula=3 (status 컬럼 없음 — 부모 추론) |
| `table_node_links` | 20     | relation_type='extracted_from' (vectorize 직접 인덱싱 대상 X)       |

**총 인덱싱 대상 = 20 + 167 + 246 = 433 노드** (ADR-032 정합).

### 1.2 source 분포 (table_structures.source_node_id 기준)

- LAW-138 (별표 1) = 17 (TBL-001~011, 016~020, 002~011 표본주수 14종 + nested 부모)
- LAW-139 (별표 2) = 1 (TBL-012 미보상비율)
- LAW-140 (별표 5) = 1 (TBL-013 무화과 잔여수확량 산식)
- LAW-141 (별표 6) = 1 (TBL-014 손해정도비율)
- LAW-142 (별표 7) = 1 (TBL-015 고추 병충해 등급)

### 1.3 인프라 영속 상태

- ★ apps/api/src/vectorize/upserter.ts — knowledge_nodes 794 인덱싱 검증 완료 (재사용)
- ★ apps/api/src/vectorize/routes.ts — admin sub-router (재사용 + 확장)
- ★ Cloudflare Vectorize index `thepick-embeddings-staging` + `thepick-embeddings` 생성 완료 (1024d cosine, vectorCount=794)
- ★ metadata-index 5 props × 2 env = 10건 enqueued

---

## 2. ★★ 텍스트 합성 정책 (Claude 결정, 최상 품질 기본값)

> **memory `feedback_no_granular_decisions`** 정합: 전략 갈림길 0건, 구현 디테일은 Claude 결정.

### 2.1 table_structures (TBL-NNN)

```
[TBL-NNN] {title}
근거: {source_node_id} ({source_node.name}) - {source_node.description first 200 chars}
패턴: {pattern_type_label} | 행수: {row_count} × 열수: {col_count}
출처: {source}
```

- **node_type**: `'TABLE'`
- **truth_weight**: 8 (TRUTH_WEIGHTS.TABLE)
- **status**: 본인 status (draft/active/flagged/deprecated)
- **source_page**: `source_node.page_ref` (parsePageRefToInt) — JOIN knowledge_nodes
- **lv1_insurance/lv2_crop**: source_node 동일 컬럼 inherit

### 2.2 table_headers (TROW-NNN-NN / TCOL-NNN-NN)

```
[{id}] {axis_label} 헤더 (level {level}): {breadcrumb_text}
표: [{table_id}] {table.title}
{parent_id ? '상위: ' + parent.text : ''}
```

- **breadcrumb_text**: parent_id chain 재귀 (level 1 → 2 → 3)이 있으면 `>` 로 결합
- **node_type**: `'ROW_HEADER'` (axis='row') / `'COL_HEADER'` (axis='column')
- **truth_weight**: 7 (TRUTH_WEIGHTS.ROW = TRUTH_WEIGHTS.COL = 7)
- **status**: parent table_structures.status 추론
- **source_page**: parent table_structures.source_node 의 page_ref (JOIN chain)

### 2.3 table_cells (TCELL-NNN-NN-NN)

```
[{id}] {row_label} × {col_label} = {value_repr}
표: [{table_id}] {table.title}
값 타입: {value_type_label}
```

- **value_repr** (value_type 별 분기):
  - `'text'` → `value_text` 그대로
  - `'number'` → `value_text` (저장된 그대로)
  - `'formula'` → `formula.equation_template` (JOIN formulas) — formula 산식 가시화
  - `'na'` → `'N/A (해당없음)'`
  - `'merged_ref'` → **인덱싱 대상 제외** (primary cell 만 인덱싱하여 중복 방지, plan §2.5 제외 정책)
  - `'nested_table'` → `'중첩 표 [' + nested_table_id + '] ' + nested_table.title` (JOIN table_structures)
- **row_label/col_label**: row_id/col_id JOIN table_headers — breadcrumb (parent chain 포함)
- **node_type**: `'CELL'`
- **truth_weight**: 6 (TRUTH_WEIGHTS.CELL)
- **status**: parent table_structures.status 추론
- **source_page**: parent table.source_node.page_ref

### 2.4 메타데이터 추가 컬럼 (Vectorize)

기존 `VectorizeUpsertMetadata` (knowledge_nodes 정합) + 신규:

- `parent_table_id` (TABLE/ROW_HEADER/COL_HEADER/CELL 모두 자체-id 또는 parent table_id) — 회귀 검색용
- `axis` (ROW_HEADER/COL_HEADER 만, `'row'` | `'column'`)
- `value_type` (CELL 만, `'text'` | `'number'` | `'formula'` | `'na'` | `'nested_table'`)
- `pattern_type` (TABLE 만, `'A_simple'` | ... | `'H_nested'`)

★ Vectorize metadata-index 추가 enqueue 의무: `parent_table_id`, `value_type` (cell-level 검색 회귀 회복)

### 2.5 인덱싱 제외 정책

- **`value_type='merged_ref'` cells**: primary cell 의 별칭이므로 별도 인덱싱 없음 (중복 노이즈 차단)
- **빈 `value_text` 셀**: validate phase 에서 거부 (caller 가 fetch 단계에서 SKIP)
- **`text=NULL` headers**: schema NOT NULL 이므로 발생 불가 — defensive 0건

---

## 3. 적재 단위 (D-VEC2 결정 0건 — 즉시 진입)

### 3.1 신규 모듈

- **`apps/api/src/vectorize/table-fetcher.ts`** (신규):
  - `fetchTableStructuresForVectorize(db, examId, limit, offset)` → `NodeForVectorize[]` (TABLE 노드)
  - `fetchTableHeadersForVectorize(db, examId, limit, offset)` → `NodeForVectorize[]` (ROW_HEADER + COL_HEADER 노드)
  - `fetchTableCellsForVectorize(db, examId, limit, offset)` → `NodeForVectorize[]` (CELL 노드)
  - JOIN-based SQL — table_structures + table_headers + table_cells + formulas + knowledge_nodes
  - Hard Rule 16 정합 (첫 인자 examId)
  - merged_ref cells 자동 SKIP (WHERE value_type != 'merged_ref')

### 3.2 routes.ts 확장 (`POST /api/admin/vectorize/bootstrap` source 확장)

기존 `source: z.enum(['knowledge_nodes'])` → `source: z.enum(['knowledge_nodes', 'table_structures', 'table_headers', 'table_cells'])`.

각 source 분기에서 해당 fetcher 호출 + 동일 upsertNodesToVectorize 위임 (★ Hard Rule 16/17 zero-cost 정합 유지).

### 3.3 단위 테스트 (apps/api/src/vectorize/\_\_tests\_\_/table-fetcher.test.ts)

- D1 mock 으로 row → text 합성 검증
- merged_ref SKIP 검증
- formula JOIN equation_template 합성 검증
- nested_table JOIN title 합성 검증
- breadcrumb (parent_id chain) 재귀 합성 검증
- status 부모 추론 검증
- examId Hard Rule 16 위반 시 throw 검증

목표 vitest PASS 8건+.

### 3.4 인덱싱 실행

- staging: `POST /bootstrap source=table_structures` → 1 batch 20건
- staging: `POST /bootstrap source=table_headers` → 2 batches (100+67)
- staging: `POST /bootstrap source=table_cells` → 3 batches (100+100+46) — merged_ref SKIP 시 실제 246건 그대로 (현 데이터 merged_ref 0건)
- production: 동일 적재 (staging PoC PASS 후)

총 ≈ 6 batches, 433 노드, ~$0.5 비용 (Workers AI bge-m3).

### 3.5 RAG smoke test (cell-level)

**5개 자연어 쿼리** (TBL-001 nested + TBL-012/014/015 cell 검증):

1. `"사과 100주 표본주수"` → TBL-002 (사과/배/단감 표본주수) 또는 TROW(사과)/TCELL(사과 × 100주) hit
2. `"미보상비율 매우 불량"` → TBL-012 또는 TROW(매우 불량)/TCELL(매우 불량 × 30%) hit (LAW-139 기존 hit 회귀 0)
3. `"고추 병충해 2등급"` → TBL-015 또는 TROW(2등급)/TCELL(2등급 × 70%) hit
4. `"손해정도비율 50%"` → TBL-014 또는 TROW(50%) hit (LAW-141 기존 + cell-level 강화)
5. `"무화과 8월 잔여수확량"` → TBL-013 (formula 패턴 F) hit

**합격 기준**: top-5 안에 4/5 hit. cell-level 직접 hit 시 ★ 본 step 핵심 가치 영속.

★ 기존 LAW-138~142 knowledge_nodes hit 회귀 0 (smoke `staging`/`production` post-fix run 동등 의무).

---

## 4. Hard Rule 16/17 zero-cost 전환 (필수)

- table-fetcher.ts 모든 함수 첫 인자 `examId: ExamId` 강제 (Rule 16)
- table 데이터에 exam_id 컬럼 부재 — 본 step 단일 시험 가정 (Year 2 마이그레이션 0027+ 시 ALTER TABLE)
- 메타데이터 `exam_id` 자동 주입 (upserter 정합)
- `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유 100%, 리터럴 0건 (Rule 17)
- 검증: `grep -rn "'son-hae-pyeong-ga-sa'" apps/api/src/vectorize/table-fetcher.ts` 0건

---

## 5. Gates (의무 검증)

| Gate | 항목                                       | 검증                                                                                       |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 5.1  | table-fetcher.ts 단위 테스트               | Vitest PASS 8건+, JOIN/breadcrumb/value_type 합성 정합                                     |
| 5.2  | routes.ts 확장 단위 테스트 0회귀           | apps/api 322 → 322+ tests PASS (knowledge_nodes 정합 유지)                                 |
| 5.3  | staging dry-run 3건                        | structures/headers/cells fetch count 일치, 임베딩 호출 0회                                 |
| 5.4  | staging 인덱싱 433건 PASS                  | `wrangler vectorize info` vectorCount = 794 + 433 = **1227**                               |
| 5.5  | staging RAG smoke test cell-level 4/5 PASS | top-5 안에 4/5 hit + 기존 5건 회귀 0                                                       |
| 5.6  | production 인덱싱 동등 PASS                | vectorCount = 1227 staging 동등                                                            |
| 5.7  | production RAG smoke test cell-level 동등  | staging 동등 4/5 PASS                                                                      |
| 5.8  | post-indexing verify run1≡run2 PASS 7/0/1  | 회귀 0, Cat 1-7 + Cat 8 SKIP + Cat 9 + Cat 10 동등                                         |
| 5.9  | Hard Rule 17 grep 0건                      | EXAM_IDS 경유 100%                                                                         |
| 5.10 | 4-Pass 5 페르소나 독립 에이전트 리뷰       | CRITICAL 0건 (silent-failure / system-architect / security / quality / code-reviewer 병렬) |
| 5.11 | metadata-index parent_table_id+value_type  | enqueue PASS (staging+production 양쪽 2건씩 신규)                                          |

---

## 6. 비용 견적

| 항목                        | 견적      | 근거                                             |
| --------------------------- | --------- | ------------------------------------------------ |
| Workers AI bge-m3 임베딩    | ~$0.5     | 433 노드 × ~500 토큰 (cell text 단순) × $0.011/M |
| Vectorize 저장 추가 (월)    | +$0.02/월 | 433 vectors × 1024d × $0.05/100M                 |
| Vectorize 쿼리 (smoke 10건) | ~$0.001   | staging 5 + production 5                         |
| **합계 (개시 1회)**         | **~$0.5** | A3 cap $200/월 충분                              |

---

## 7. Rollback / Risk

- **table-fetcher.ts JOIN 실패**: D1 쿼리 단계 try-catch + cause 전파 (Pass 1 SURGEON M1 정합)
- **breadcrumb 무한 재귀**: `level` 컬럼 (1-3 CHECK) + parent_id depth-3 한도 → 안전 (defensive max-depth 3 명시)
- **nested_table 순환**: TBL-A → TBL-B → TBL-A 시 nested_table_id JOIN 1단만 (재귀 X) — 안전
- **merged_ref 누락**: SKIP 정책 (caller WHERE) → primary cell 인덱싱 보장 (UNIQUE table_id+row_id+col_id)
- **vectorize-upsert 실패**: idempotent (id 기반 upsert) — 재실행 무해
- **smoke test 4/5 미달**: ADR-008 graceful degradation (LAW-138 0.538 정합) 동작 검증

---

## 8. 시간 견적

| 단계                                  | 시간      |
| ------------------------------------- | --------- |
| table-fetcher.ts + 단위 테스트        | 1.0h      |
| routes.ts 확장 + 단위 테스트 보강     | 0.4h      |
| staging dry-run + 인덱싱 + smoke test | 0.6h      |
| production 인덱싱 + smoke + verify    | 0.4h      |
| 4-Pass 5 페르소나 독립 에이전트 리뷰  | 0.5h      |
| metadata-index enqueue + post-verify  | 0.2h      |
| handoff + commit + push               | 0.3h      |
| **합계**                              | **~3.4h** |

---

## 9. 결정 영속

- D-VEC2-1 (cell text 합성) = `'row × col = value'` (semantic context 유지)
- D-VEC2-2 (nested_table cells) = nested_table title 포함 (cell-level hit 회귀)
- D-VEC2-3 (merged_ref cells) = 인덱싱 제외 (primary 중복 방지)
- D-VEC2-4 (formula cells) = formulas.equation_template 합성 (산식 가시화)
- D-VEC2-5 (status 추론) = 부모 table_structures.status JOIN
- D-VEC2-6 (truth_weight) = TABLE=8 / ROW=COL=7 / CELL=6 (TRUTH_WEIGHTS v3 정합)

진산 결정 갈림길 = **0건** (모든 사항이 ADR-032 + 기존 정책에서 도출). 즉시 코딩 진입.

---

## 10. 참고

- ADR-032 Table-as-Micro-KG (Accepted Session 050)
- migrations/0021/0023/0024/0025 (table\_\* schema + Pattern H + partial index)
- packages/shared/src/types.ts:68-80 (TRUTH_WEIGHTS v3)
- handoff-session-065.md §3 권장 A
- plan: docs/plans/phase2a-vectorize-indexing.plan.md §3.4 (table_cells carry-over)
- 4-Pass 통합 보고서: review-YYYYMMDD-HHMMSS-session-057-table-vectorize-4pass.md (산출 의무)
