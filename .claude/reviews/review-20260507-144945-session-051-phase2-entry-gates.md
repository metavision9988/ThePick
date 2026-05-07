# Session 051 Phase 2 Entry Gates — 4-Pass Independent Review (통합 보고서)

> **검토 대상**: Session 051 5+1 게이트 흡수 (ADR-032 Table-as-Micro-KG Phase 2 진입)
> **변경 규모**: 1,449 insertions / 33 deletions / 10 modified files + migrations/0023 신규
> **검토 시각**: 2026-05-07 14:49 KST (Session 052 entry)
> **검토 방식**: 4 독립 에이전트 병렬 호출 (auto-review-protocol.md §"규칙 0" 정합)
> **종합 판정**: 🔴 **수정 필요 — Critical 6건 (4건 4-Pass 합의)**

## 검토 범위

**변경 파일 10개 + 연관 7개**:

- packages/parser/src/{ontology-registry.json, schema-validator.ts, batch-processor.ts}
- packages/parser/src/**tests**/{schema-validator.test.ts, normalizer.test.ts}
- packages/shared/src/types.ts
- apps/api/src/db/schema.ts
- migrations/{0021_table_as_micro_kg.sql, 0022_table_structures_update_guard.sql, 0023_table_cells_pattern_h.sql}
- scripts/verify-engine-contracts.ts
- docs/quality/master-test-checklist.md
- (연관) docs/adr/ADR-032-table-as-micro-kg.md, docs/plans/table-processing-{architecture-v1, phase2-batch-reextract}.md
- (연관) handoff-session-{057, 058}.md

**4 독립 에이전트**:
| Pass | Agent type | 관점 |
|---|---|---|
| 1 SURGEON | pr-review-toolkit:silent-failure-hunter | 코드 정합성, null/async/cycle/silent failure |
| 2 ARCHITECT | system-architect | 모듈 연계 / contract chain drift / Workers 호환 |
| 3 ADVOCATE | quality-engineer | UX + 테스트 부채 + 보안 + Graceful degradation |
| 4 CONTRACT | pr-review-toolkit:code-reviewer | Silent Pivot (기획 vs 구현) |

---

## 🔴 Critical 통합 (6건)

### CRIT-A: Pattern-H 4-Layer Drift ★★★ (Pass 1+2+3+4 합의 — 최고 신뢰도)

**4 Pass 모두 동일 지적**. 본 세션의 가장 결정적 발견.

| Layer               | 위치                                                                                | 패턴 카운트               | 일치? |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------- | ----- |
| LLM 시스템 프롬프트 | `packages/parser/src/batch-processor.ts:170`                                        | **8종 (A~H_nested 명시)** | ✗     |
| TS Type union       | `packages/parser/src/schema-validator.ts:126` `KnowledgeContractTable.pattern_type` | 7종 (A~G)                 | ✗     |
| Drizzle enum        | `apps/api/src/db/schema.ts:90-98` `TABLE_PATTERN_TYPES`                             | 7종 (A~G)                 | ✗     |
| D1 SQL CHECK        | `migrations/0021_table_as_micro_kg.sql:55-63` `pattern_type CHECK`                  | 7종 (A~G)                 | ✗     |

**시나리오**: Phase 2 BATCH 재추출 시 LLM이 시스템 프롬프트 지시대로 `pattern_type='H_nested'` emit → schema-validator는 `pattern_type` 자체 enum 검증 부재 → contract.valid=true → D1 INSERT 시점에 `CHECK constraint failed: table_structures` → 트랜잭션 전체 rollback → BATCH 노드 50건+, 표 N건 모두 폐기 → 토큰 비용 재지출 + 패턴-H 표 영원히 미적재.

**즉시 차단 영향**: Phase 2A (별표 1·2·5·6·7)는 LAW-143 별표9 미포함이라 H 패턴 노출 0건이나, **LLM hallucination으로 평범한 표를 H_nested로 오분류 가능** (시스템 프롬프트가 H_nested 인식 정확도 ~70% 명시). 즉 Phase 2A 첫 BATCH에서 즉시 발현 가능.

**Fix 권장**:

1. **마이그레이션 0024 신설**: `table_structures` 12-step procedure로 `pattern_type` CHECK 7→8 (`'H_nested'` 추가)
2. `apps/api/src/db/schema.ts:90-98` `TABLE_PATTERN_TYPES`에 `'H_nested'` 추가, `:700` 주석 "7종"→"8종"
3. `packages/parser/src/schema-validator.ts:126` TS union 8종으로 확장
4. `validateTablesSection`에 `pattern_type='H_nested' && !hasNestedTableCell` cross-validation 추가
5. `verify-engine-contracts.ts` Cat 9에 `TABLE_PATTERN_TYPES.length === 8` 검증 추가

---

### CRIT-B: pattern_type Runtime Enum-Validation 부재 (Pass 2)

`schema-validator.ts:464-474` `validateTablesSection`은 `value_type`만 `VALID_TABLE_VALUE_TYPES.includes`로 화이트리스트 검증하고, **`pattern_type` 자체는 어떤 enum 검증도 없음**. cross-validation 분기에만 등장.

**시나리오**: LLM이 `pattern_type='Z_unknown'` 같은 hallucination을 emit해도 schema-validator PASS → D1 INSERT 단계에서 CHECK 위반. 1차 방어선 (schema-validator) 무력화.

**Fix**: `VALID_TABLE_PATTERN_TYPES` 상수 + `INVALID_TABLE_PATTERN_TYPE` ValidationErrorCode 추가 + table 진입 시 화이트리스트 검증.

---

### CRIT-C: Nested Table Cycle / Self-Reference 미차단 (Pass 1+3 합의)

`schema-validator.ts:521-541`은 `tableIdSet.has(cell.nested_table_id)`만 검사. 다음 모두 통과:

- 자기 참조: TBL-001 cell이 `nested_table_id='TBL-001'`
- 2-cycle: TBL-001 ↔ TBL-002
- N-cycle: TBL-001 → TBL-002 → TBL-003 → TBL-001

**시나리오**: LLM 환각으로 사이클 발생 → admin-web G5.5 검수 UI에서 `<NestedTable>` 컴포넌트 무한 재귀 → React stack overflow / 브라우저 freeze. RAG retriever가 graph traversal 시 Workers CPU 50ms 한도 초과로 `Worker exceeded CPU time limit`. 또는 향후 explanation 생성기가 표 평탄화하면서 무한 호출 → 토큰 비용 폭증.

**정답 안전 위배**: 순환 참조된 표 = "이 표 안에 또 이 표가 있다" 모순 → OX 정답 결정 불가 (Hard Stop 조건 위배).

**Fix**:

- `validateTablesSection`에 DFS 사이클 검출 (Tarjan 또는 visiting Set)
- 자기 참조 명시 차단 (`NESTED_TABLE_SELF_REFERENCE` 신규 ErrorCode)
- 핸드오프 §"패턴-H 자기 참조 허용" 표현 정정 (해당 결정 영속 X)
- 마이그레이션 0024에 self-ref 차단 trigger (옵션)

---

### CRIT-D: source_page 출처 추적 부재 (Pass 3) — 북극성 위배

`KnowledgeContractTable`에 `source: string`만 존재 (`schema-validator.ts:129`). `validateTablesSection` 전체에 `isValidSourcePage` 호출 0건.

**memory `project_source_citation_requirement.md` 정합 위배**: "문제/암기법/풀이/오답 후보는 교재 페이지·법조문·기출을 FK로 보관. 근거 0건 = approved 불가. 수험자 '근거 보기' UX 1급 기능".

**시나리오**: 별표 1 표본주수표 (LAW-138)에서 "5주" 셀이 "50주"로 오추출 → admin G5.5 검수 시 어느 PDF 페이지에서 왔는지 역추적 불가 → 인간 검수 비용 폭증 + 수험자에게 "교재 O쪽 참조" 안내 불가능.

**Fix**: `KnowledgeContractTable`에 `book_page: number` + `pdf_page: number` 필수 필드 (ADR-030 정합) + 각 cell에 `source_page?: number` 옵션 (표가 여러 페이지 걸친 경우) + `validateTablesSection`에서 `isValidSourcePage` 강제.

---

### CRIT-E: truth_weight Silent Pivot ★★ (Pass 4) — CRITICAL RULE #1 위반

**Plan v1 §4.4 vs Code 정면 충돌, ADR §"truth_weight 정합" 섹션 자체 부재**.

| 위치                                                     | 내용                                                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts:55` (주석)                 | `// ADR-032 §"truth_weight 정합"`                                                                                                  |
| `packages/shared/src/types.ts:58-70` (코드)              | `TABLE = ROW_HEADER = COL_HEADER = CELL = 10` (LAW와 동격)                                                                         |
| `docs/adr/ADR-032-table-as-micro-kg.md`                  | `grep "truth_weight"` 결과 **0건 — §"truth_weight 정합" 섹션 자체 부재**                                                           |
| `docs/plans/table-processing-architecture-v1.md:230~233` | "TABLE_CELL = LAW + 본문 명제 vs CELL 직접값 우선 (정밀도 高) — 단 셀 의미는 row+col 헤더 컨텍스트 의존 → **standalone weight X**" |

**즉 코드 주석이 존재하지 않는 ADR 섹션을 인용하면서, plan이 명시 거부한 'CELL standalone weight'를 반대로 LAW 동격으로 영속**. CRITICAL RULE #1 ("기획과 다르게 구현하려면 → 코딩 멈추고 인간에게 먼저 보고") 위반.

**시나리오**: Vectorize 인덱싱 시 ROW_HEADER ("100주 미만") 본문이 LAW 동격 truth_weight=10 → "100주 미만 표본주수" 질의 시 ROW_HEADER 노드가 LAW-138 본문보다 우선 반환 가능. RAG 결과 LAW > FORMULA 정렬 정신 dilute.

**Fix 옵션**:

- (a) ADR-032 §"truth_weight 정합" 신규 섹션 추가 + plan §4.4 "standalone X" 영속 → types.ts TRUTH_WEIGHTS 강등 (예: TABLE=9 / ROW=COL=8 / CELL=7 점진 감쇠)
- (b) Plan §4.4 폐기 + ADR §"truth_weight=LAW 동격" 명시 정당화 (셀 정밀도 사유)
- 둘 중 하나는 의무. **진산 결정 필수**.

---

### CRIT-F: Workers `Buffer.byteLength` 호환성 부재 (Pass 2)

`packages/parser/src/schema-validator.ts:1168` `Buffer.byteLength(raw, 'utf-8')` — Cloudflare Workers 런타임은 `nodejs_compat` flag 없이 `Buffer` 미존재 → Workers 환경에서 schema-validator 사용 시 `ReferenceError: Buffer is not defined`.

**주의**: 이는 Session 051 신규가 아닐 수 있음 — `validateRawResponseSecurity`는 기존 함수일 가능성. **확인 필요**. 단 Session 051이 schema-validator를 갱신하면서 본 위험을 카탈로그하지 않았으므로 carry-over 위험은 동일.

**Fix**: `new TextEncoder().encode(raw).length`로 교체 (Workers 안전 + 동작 등가).

---

## 🟠 Major 통합 (~12건)

| ID     | 발견자                                       | 내용                                                                           | 위치                              |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- |
| MAJ-1  | Pass 1 M-1                                   | row_id/col_id 누락 시 silent pass (NOT NULL 위배 D1 단에서 발견)               | schema-validator.ts:545-555       |
| MAJ-2  | Pass 1 M-2                                   | nested_table_id pattern (TBL-) 검증 부재                                       | schema-validator.ts:521-541       |
| MAJ-3  | Pass 2 Major#1                               | batch-processor edge 카운트 주석 5종 분리 표현 누락                            | batch-processor.ts:141            |
| MAJ-4  | Pass 2 Major#2                               | Drizzle `tableHeaders.parentId` self-ref `.references()` 누락                  | apps/api/src/db/schema.ts:739     |
| MAJ-5  | Pass 2 Major#3                               | Hard Rule 16 위반 가능성 — table 4 신규 테이블 examId 컬럼/래퍼 부재           | apps/api/src/db/schema.ts:701-833 |
| MAJ-6  | Pass 2 Major#4 / Pass 3 (CRIT-E와 중복 부분) | truth_weight=10 RAG 노이즈 위험 (CRIT-E의 운영 측면)                           | types.ts:58-70                    |
| MAJ-7  | Pass 3 M-1                                   | Pattern B/C/G cross-validation 분기 부재 (silent pass)                         | schema-validator.ts:569-608       |
| MAJ-8  | Pass 3 M-2                                   | 빈 cells/headers + row_count mismatch 미검증                                   | schema-validator.ts:464+          |
| MAJ-9  | Pass 3 M-3                                   | 에러 메시지 한국어 하드코딩 (admin i18n 부재)                                  | schema-validator.ts:528           |
| MAJ-10 | Pass 3 M-4                                   | DANGLING_NESTED_TABLE_REFERENCE 컨텍스트 부족 (admin 추적성)                   | schema-validator.ts:521-541       |
| MAJ-11 | Pass 3 M-5                                   | Graceful degradation hook 부재 (BATCH all-or-nothing)                          | validateRawClaudeResponse:1226    |
| MAJ-12 | Pass 4 MAJ-1                                 | table_cells/headers/node_links UPDATE policy 미명시 (handoff 자인, ADR 미반영) | ADR-032                           |
| MAJ-13 | Pass 4 MAJ-2                                 | D-PHASE2-7 + 패턴-H 결정이 ADR §Decision 본문이 아닌 후미 paragraph만          | ADR-032 §Decision §1              |
| MAJ-14 | Pass 4 MAJ-3                                 | value_type 'nested_table' 6번째 값이 ADR §Decision 본문 부재                   | ADR-032 §Decision §2              |

## 🟡 Minor (~10건, 생략)

각 Pass §Minor 영역 참조. 향후 Phase 2A 진입 후 일괄 흡수.

---

## ✅ PASS 증거 통합 (각 Pass 3+ 항목)

- ontology-registry.json edge_types 18종 + node_id_patterns ↔ schema-validator isValidNodeId 호출 prefix 정합 (Pass 1, Pass 2)
- `migrations/0023_table_cells_pattern_h.sql:38-57` 복합 CHECK `value_type='nested_table' ⇒ nested_table_id NOT NULL` 정확 (Pass 1)
- 12-step procedure 데이터 보존 + self-ref FK 자동 정합 (Pass 1, Pass 2)
- `VALID_TABLE_VALUE_TYPES` 6종 = SQL CHECK 6종 = Drizzle 6종 — 3 layer 일치 (Pass 2)
- `D-PHASE2-1=α` table_structures UPDATE trigger ↔ 0022 SQL ↔ ADR-032:26 ↔ plan §3.2 — 4 곳 일치 (Pass 4)
- `TC- topic_cluster 충돌 회피` ↔ ontology-registry.json TCOL 패턴 ↔ batch-processor 주석 — 3 곳 일치 (Pass 4)
- migration count 22 — verify + master-checklist + 디렉토리 실제 4 곳 일치 (Pass 4)
- Phase 2A 별표 1·2·5·6·7 (LAW-138~LAW-142) — handoff + plan §6 + plan §4 일치 (Pass 4)

---

## 종합 판정

**🔴 수정 필요** — Critical 6건. auto-review-protocol.md §"규칙 4" 정합 = "완료" 선언 불가.

특히 **CRIT-A (Pattern-H 4-layer drift)**는 4 Pass 모두 독립적으로 동일 지적 = 최고 신뢰도. **Phase 2A BATCH 진입 직전 의무 차단**.

특히 **CRIT-E (truth_weight Silent Pivot)**는 CRITICAL RULE #1 명시 위반 = 진산님 직접 결정 의무.

---

## 권장 수정 순서 (Phase 2A 진입 전 의무)

### 즉시 (1 step, 묶음)

1. **마이그레이션 0024 신설**: `table_structures.pattern_type` CHECK 7→8 (`'H_nested'` 추가) — 12-step procedure
2. **마이그레이션 0024 staging+production 적용** (CLOUDFLARE_API_TOKEN + ACCOUNT_ID env 우회 carry-over)
3. **`apps/api/src/db/schema.ts`** `TABLE_PATTERN_TYPES` enum 8종 + 주석 갱신
4. **`packages/parser/src/schema-validator.ts`**:
   - `KnowledgeContractTable.pattern_type` 8종 union
   - `VALID_TABLE_PATTERN_TYPES` 상수 + `INVALID_TABLE_PATTERN_TYPE` ErrorCode
   - `validateTablesSection` 진입 시 화이트리스트 검증
   - DFS 사이클 검출 (visiting Set) + `NESTED_TABLE_SELF_REFERENCE` + `NESTED_TABLE_CYCLE_DETECTED`
   - cross-validation `pattern_type='H_nested' ⇒ ≥1 cell with value_type='nested_table'`
5. **`packages/shared/src/types.ts`** TRUTH_WEIGHTS 영역 — **진산 결정 대기** (강등 vs ADR §추가)
6. **`packages/parser/src/__tests__/schema-validator.test.ts`** 회귀 테스트 추가:
   - pattern_type='H_nested' 분류 + nested cell 정합
   - 자기 참조/2-cycle/3-cycle 거부
   - INVALID_TABLE_PATTERN_TYPE
   - empty cells + row_count mismatch
7. **`scripts/verify-engine-contracts.ts`** Cat 9에 `pattern_types.length === 8` 검증 추가
8. **`docs/adr/ADR-032-table-as-micro-kg.md`** §Decision §1 갱신:
   - v1.5.0 통합 (4+1 edge_types)
   - §"패턴 카탈로그 8종" 명시 영속 (A~H 일괄)
   - §"truth_weight 정합" 신규 (진산 결정 후)
   - §"Temporal 정합" 신규 (table_cells/headers/node_links UPDATE policy)
   - §"value_type 6종" §Decision §2 영역 통합
9. **CRIT-D source_page**: KnowledgeContractTable에 `book_page` + `pdf_page` 필수 필드 추가 + isValidSourcePage 강제
10. **CRIT-F**: schema-validator.ts:1168 `Buffer.byteLength` → `TextEncoder.encode().length` 교체

### 차차세션 (Phase 2A 병행 또는 종착)

- Major M-1 ~ M-14 일괄 흡수
- Minor 일괄 흡수
- Phase 2 BATCH 재추출 시 LLM 출력 SLO 측정 (pattern_type 분류 정확도 ≥85%)

---

## 진산님 결정 필요 사항

1. **CRIT-E truth_weight 정책** (Silent Pivot 해소):
   - 옵션 (a): TABLE=9 / ROW=COL=8 / CELL=7 점진 감쇠 (plan §4.4 "standalone X" 영속)
   - 옵션 (b): TABLE/ROW/COL/CELL=10 유지 + ADR §"truth_weight 정합" 신규 정당화 (셀 정밀도 사유)
   - **추천**: 옵션 (a) — plan §4.4가 명시한 의도가 더 정합 + RAG 노이즈 차단

2. **Phase 2A 진입 차단 vs 동시 진행**:
   - 옵션 (가): 본 6 Critical 흡수 후 Phase 2A 진입 (안전, 1-2 세션 지연)
   - 옵션 (나): CRIT-A/B/C 즉시 흡수 (4-layer drift + enum + cycle) + CRIT-D/E/F는 Phase 2A 병행 흡수
   - **추천**: 옵션 (가) — Pattern-H drift는 첫 BATCH에서 즉시 발현 가능 (LLM hallucination)

3. **마이그레이션 0024 적용 시점**: 본 fix step 종착 시 즉시 staging+production 적용 의무 (Session 051 0023과 동일 패턴)

---

## 차세션 carry-over

- 본 보고서 → handoff-session-059에 §주의사항 영속
- TD-S52-1 (신규): CRIT-A~F 6건 fix step (차세션 첫 작업)
- TD-S52-2 (신규): Major M-1 ~ M-14 14건 carry-over (Phase 2A 병행)
- TD-S52-3 (신규): truth_weight 정책 진산 결정 영속 (옵션 a/b 명시)
- 누적 이월 MAJOR ~114 + 본 14 = ~128건 (Phase 2A 진입 시 일괄 갱신)

---

**작성**: Claude (Opus 4.7 1M context) — Session 052 entry
**근거**: 4 독립 에이전트 (silent-failure-hunter / system-architect / quality-engineer / code-reviewer) 병렬 호출 결과 통합. 각 에이전트 메인 컨텍스트 미공유, 자기 확인 편향 0.
**다음**: 진산 결정 → fix step 진입 → 마이그레이션 0024 + 코드 fix + 테스트 + 재 verify
