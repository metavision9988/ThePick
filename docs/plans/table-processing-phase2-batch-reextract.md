# 표 처리 Phase 2 진입 plan — BATCH 재추출 + Phase 1 carry-over 흡수

> **세션**: 050 종착 / 2026-05-07
> **트리거**: 진산 발화 "권장안으로" → handoff-057 권장 1순위 채택
> **선행 plan**: `docs/plans/table-processing-architecture-v1.md` §6 Phase 분해 (Phase 2 = "차세션 054~058 ~5 세션, 기존 BATCH 표 분해 적용")
> **선행 ADR**: ADR-032 Accepted (Session 050) — D-TABLE-3=β (BATCH-1+6+7+R1 영향 큰 영역만 재추출)
> **L3 영역**: schema-validator 변경 + 마이그레이션 0022 + batch-processor 시스템 프롬프트 변경 → plan + 진산 D-PHASE2 spot check + 인간 승인 의무
> **상태**: Plan 작성 (코드 변경 0). 진산 spot check 후 차세션 052+ 단계별 적용.

## 1. 목표 (★ 핵심 역량 발휘)

**다음 4개 BATCH를 표 분해 패턴으로 재추출**하여 ontology v1.4.0 + 마이그레이션 0021 신설 schema (table_structures / table_headers / table_cells / table_node_links)에 적재한다. 이로써 cell-level RAG 검색 + 학습 UI 표 재현이 가능해진다.

★ **진산 발화 직격**: "다른 자격증에서도 2차 시험 문제는 표 형식으로 출제 多 / 비정형 표 정확 이해 + 재현 능력 = 본 프로젝트 핵심" — Phase 2가 완료되어야 본 프로젝트 핵심 역량이 실증된다.

## 2. 진입 조건 (★ Phase 1 carry-over 흡수 의무)

차세션 052+ 진입 전에 본 plan §3 작업 4건이 모두 영속되어야 한다. 4건 미흡수 상태로 BATCH 재추출 진입 시 데이터 불순물 + 회귀 위험.

### 2.1 진입 게이트 (모두 PASS 의무)

| 게이트               | 검증 방법                                                               | Phase 2 진입 차단 사유                                        |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| MAJOR-A              | schema-validator.ts에 `validateTablesSection()` 영속 + parser test 추가 | tables[] 무검증 → 잘못된 ID/dangling FK 통과 → DB INSERT 실패 |
| MAJOR-D              | 마이그레이션 0022 staging+production + verify Cat 9 신규 검증           | UPDATE 정책 미명시 → BATCH 재추출 idempotent 회귀             |
| MAJOR-C              | apps/api/src/db/schema.ts 4 테이블 Drizzle 정의 + admin-web 빌드 PASS   | type-safe 경로 부재 → Phase 2C/D admin-web G5.5 검수 UI 불가  |
| batch-processor 강화 | 시스템 프롬프트 표 추출 영역 + tables[] 출력 schema 명시                | LLM이 표 분해 미수행 → BATCH 재추출 결과 무의미               |

## 3. 4 핵심 작업 (Phase 2 진입 전 흡수 의무)

### 3.1 MAJOR-A — `validateKnowledgeContract.tables[]` 검증 로직

**현 상태**: schema-validator.ts:140 `tables?: KnowledgeContractTable[]` optional 추가. 본문 검증 0건.

**추가 검증**:

1. 모든 `tables[].id` Ontology Lock (`^TBL-\d{3}$`)
2. 모든 `headers[].id` axis-prefix 매칭 (`row` → TROW / `column` → TCOL)
3. 모든 `cells[].id` (`^TCELL-\d{3}-\d{2}-\d{2}$`)
4. **Dangling FK**: `cells[].row_id` ∈ `headers[axis='row'].id` / `cells[].col_id` ∈ `headers[axis='column'].id`
5. **Pattern_type ↔ value_type cross-validation** (Pass 1 Devil's Advocate 흡수):
   - `pattern_type='F_formula'` → cells에 `value_type='formula'` 셀 ≥ 1
   - `pattern_type='D_merged'` → cells에 `value_type='merged_ref'` 셀 ≥ 1
   - `pattern_type='E_na'` → cells에 `value_type='na'` 셀 ≥ 1
   - `pattern_type='A_simple'` → cells 모두 `value_type ∈ {text, number, na}` (formula/merged_ref 0건)
6. **headers index_pos 정합**: row 1~row_count + col 1~col_count (gap 차단)

**ValidationErrorCode 추가**:

- `INVALID_TABLE_ID`
- `INVALID_TABLE_HEADER_ID`
- `INVALID_TABLE_CELL_ID`
- `DANGLING_TABLE_CELL_REFERENCE`
- `TABLE_PATTERN_VALUETYPE_MISMATCH`
- `TABLE_HEADER_INDEX_GAP`

**parser test 추가** (~10건): 각 ValidationErrorCode 별 violation fixture + happy path.

### 3.2 MAJOR-D — 마이그레이션 0022 (UPDATE 정책 영속)

**옵션 α (권장 — Hard Rule 28 정합)**: `prevent_table_structures_update` trigger 신설. `human_reviewed_at` + `status` + `updated_at` 외 컬럼 UPDATE 차단.

```sql
CREATE TRIGGER prevent_table_structures_critical_update
BEFORE UPDATE OF id, source_node_id, title, pattern_type, row_count, col_count, source
ON table_structures
BEGIN
  SELECT RAISE(ABORT, 'table_structures critical columns are INSERT-only (Hard Rule 28). Use SUPERSEDES pattern instead.');
END;
```

**옵션 β**: ADR-032 §"Temporal 정합" 명시만 (코드 변경 X) — 진산 직접 운영 의무.

**권장**: **α** — 재추출 idempotent + Hard Rule 28 자동 강제. trigger 1건 추가 비용 무시 가능.

### 3.3 MAJOR-C — Drizzle ORM 4 테이블 정의

**파일**: `apps/api/src/db/schema.ts`

```typescript
export const tableStructures = sqliteTable('table_structures', {
  id: text('id').primaryKey(),
  sourceNodeId: text('source_node_id'),
  title: text('title').notNull(),
  patternType: text('pattern_type', {
    enum: ['A_simple', 'B_2level', 'C_3level', 'D_merged', 'E_na', 'F_formula', 'G_temporal'],
  }).notNull(),
  rowCount: integer('row_count').notNull(),
  colCount: integer('col_count').notNull(),
  source: text('source').notNull(),
  status: text('status', { enum: ['draft', 'active', 'flagged', 'deprecated'] })
    .notNull()
    .default('draft'),
  humanReviewedAt: integer('human_reviewed_at'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
});
// table_headers / table_cells / table_node_links 동일 패턴
```

★ 타입 일관성 게이트 (Pass 2 Devil's Advocate 흡수): `INTEGER strftime('%s')` (0021 SQL) ↔ `integer().default(sql\`(unixepoch())\`)` (Drizzle) — 둘 다 unixepoch unix seconds 정합. mismatch 0.

### 3.4 batch-processor.ts 시스템 프롬프트 강화

**현 위치**: `packages/parser/src/batch-processor.ts:101-185` 시스템 프롬프트.

**추가 영역**:

```
## 표 추출 (Table Extraction) — ADR-032 v1.4.0 의무

본문에서 표(table)를 발견하면 별도 `tables[]` 배열로 추출하라:

1. 표 메타: TBL-NNN ID + title + pattern_type (A/B/C/D/E/F/G) + row_count + col_count + source_node_id (표가 속한 LAW/CONCEPT 노드)
2. 헤더: TROW-NNN-NN (행) / TCOL-NNN-NN (열) + axis + level (다중 헤더 시 1=top, 2=sub) + index_pos (1-indexed)
3. 셀: TCELL-NNN-NN-NN + row_id + col_id + value_text + value_type (text/number/formula/na/merged_ref) + (formula 시) formula_id + (merged_ref 시) merged_with_id

## pattern_type 분류 (★ 명확 분기 의무):
- A_simple: 1차원 그리드 (헤더 1행 + 데이터)
- B_2level: 2단 다중 헤더
- C_3level: 3단 다중 헤더 (적과전 보장재해 매트릭스)
- D_merged: 셀 병합 존재 (가축 월령 표)
- E_na: N/A 셀 다수 (가축 부문 × 특약 매트릭스)
- F_formula: 산식 셀 다수 (별표9 품목별 감수과실수)
- G_temporal: 시간축 헤더 (26년 변경표 25년/26년)

## 안전 규칙:
- 표가 단순 정보 나열이면 본문 LAW/CONCEPT 노드로 흡수 (tables[]에 추가하지 마라)
- 표가 셀 의미 결정체(헤더 × 데이터 교차)일 때만 tables[] 분해
- merged_with_id는 anchor cell 기준으로 (anchor cell이 value_type='text/number', merged cells이 value_type='merged_ref' + merged_with_id=anchor_id)
- 시간축 헤더 발견 시 (예: "25년" / "26년" / "구판" / "신판") pattern_type='G_temporal' 강제 + 본문 SUPERSEDES 엣지 후속 의무
```

**verify-engine-contracts.ts Cat 9 확장**:

- BATCH 재추출 후 시점 활성: `SELECT COUNT(*) FROM table_structures WHERE status='active'` ≥ 1 검증

## 4. BATCH 재추출 범위 (D-TABLE-3=β 영속)

D-TABLE-3=β: 영향 큰 영역만 재추출. **순서 = 패턴 단순한 → 복잡한**.

### Phase 2A — BATCH-7 별표 1·2·5·6·7·9 (~5 표, 패턴 A/B/F)

**최우선** — 손해평가 이론 핵심 표.

| 별표   | 노드                        | 패턴                                               | 추정                                         |
| ------ | --------------------------- | -------------------------------------------------- | -------------------------------------------- |
| 별표 1 | LAW-138 표본주수표          | A_simple (7행 × 4열)                               | TBL 1 + TROW 7 + TCOL 4 + TCELL 28 = 40 노드 |
| 별표 2 | LAW-139 미보상비율 적용표   | A_simple (4행 × 3열)                               | 19 노드                                      |
| 별표 5 | LAW-140 무화과 잔여수확량   | F_formula (3행 × 2열, 산식 셀)                     | 13 노드                                      |
| 별표 6 | LAW-141 손해정도비율 10단계 | A_simple (10행 × 2열)                              | 31 노드                                      |
| 별표 7 | LAW-142 고추 병충해 등급    | A_simple (3행 × 3열)                               | 16 노드                                      |
| 별표 9 | LAW-143 품목별 감수과실수   | F_formula (메타 — Phase 2A 범위 외, Phase 2B 후속) | —                                            |

**Phase 2A 누적 추정**: 5 TBL + ~30 TROW + ~16 TCOL + ~75 TCELL = ~125 노드.

### Phase 2B — BATCH-7 별표 9 + BATCH-1 적과전 (패턴 B/C/F)

**별표 9 LAW-143**: 품목별 감수과실수 (75p 메타 노드, 본문 산식 BATCH-1~5 정합 중복 회피). 본 plan에서 별표9 본문 표 ~10개 (사과/배/단감 × 보장재해) 분해 의무.

**BATCH-1 적과전 보장재해 매트릭스**: INS-01 적과전 종합위험 II — 보장재해 (자연재해/조수해/화재/태풍/우박/봄동상해/일소피해) × 적과 전/후 시기 = 패턴-C 3-level (재해 분류 → 사과/배/단감 → 시기) 가능성 있음.

**Phase 2B 누적 추정**: ~10 TBL + ~80 노드 = ~+200 노드.

### Phase 2C — BATCH-6 가축 매트릭스 (패턴 D/E)

**BATCH-6**: 가축재해보험 5 부문 (소·돼지·가금·기타·축사) × 6 특약 (소도체결함/돼지질병/축산휴지/전기적장치/폭염/씨수말). 패턴-E (N/A 셀 다수 — 부문×특약 적용 안 되는 셀).

**한우/젖소 월령별 보험가액**: 패턴-D (월령 구간 + 시·도별 가액) 셀 병합 가능.

**Phase 2C 누적 추정**: ~5 TBL + ~120 노드.

### Phase 2D — BATCH-R1 26년 변경표 (패턴 G)

**BATCH-R1**: 26년 변경사항 19건 — REV-2026-01~19. 25년 → 26년 변경 표는 패턴-G (시간축 헤더). LLM이 시간축 자동 분리 + SUPERSEDES 엣지 자동 생성 검증.

**Phase 2D 누적 추정**: ~10 TBL + ~150 노드.

### Phase 2 누적 영향

- **노드 추가**: ~600 노드 (~+0.6배 / 794 → ~1400)
- **D1 size 영향**: ~+2~3 MB (5GB free 한도 내 안전)
- **Vectorize 호출 비용 증가**: 데이터 적재 후 인덱싱 1회 (~$5 추정, $200 cap 내)
- **G5.5 인간 검수 부담**: Phase 2C 셀 병합 패턴-D = 진산 직접 영속 의무 (~3~5 시간)

## 5. ★ 진산 결정 영속 (D-PHASE2-1~6, 2026-05-07 Session 050 종착)

진산 트리거: **"권장대로 진행"** → 6건 모두 권장값 일괄 채택. ADR-032 §"D-PHASE2 결정 영속" 표 영속.

| ID         | 채택  | 의미                                                                                       | 사유                                     |
| ---------- | ----- | ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| D-PHASE2-1 | **α** | MAJOR-D UPDATE 정책 = 마이그레이션 0022 `prevent_table_structures_critical_update` trigger | Hard Rule 28 자동 강제 + idempotent      |
| D-PHASE2-2 | **α** | Drizzle 정의 = `apps/api/src/db/schema.ts` 통합                                            | 단일 파일 정합 (4 테이블, 분리 부담 X)   |
| D-PHASE2-3 | **α** | BATCH 재추출 순서 = 2A → 2B → 2C → 2D 순차                                                 | 패턴 단순→복잡 / G5.5 검수 단계적        |
| D-PHASE2-4 | **α** | LLM 1차 추출 + G5.5 인간 검수                                                              | LLM 75% + 검수 효율                      |
| D-PHASE2-5 | **α** | 별표 9 분해 깊이 = 메타 + 본문 핵심 10개 표                                                | 75p 전체는 BATCH-1~5 산식 정합 중복 회피 |
| D-PHASE2-6 | **β** | G5.5 검수 시점 = 단계별 (2A/2B/2C/2D 종착마다)                                             | 회귀 조기 발견 + 진산 부담 분산          |

★ **본 세션 050 종착 작업**: D-PHASE2-1=α 직접 산출 = 마이그레이션 0022 staging+production 적용 + verify Cat 9 강화. 나머지 진입 게이트 3건 (MAJOR-A / MAJOR-C / batch-processor) = 차세션 052 carry-over.

### D-PHASE2-7 신규 (Session 050 후반부 진산 발화 "표 안에 표")

| ID         | 채택         | 의미                                                                                                                           | 사유                                                                             |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| D-PHASE2-7 | **α** (영속) | 패턴-H Nested Table 지원 — 마이그레이션 0023 + ontology v1.5.0 + schema-validator value_type 6종 + batch-processor 패턴-H 명시 | 별표9 + 위험물 등급표 + 공인중개사 가액산정표 등 다중 자격증 핵심 패턴 누락 차단 |

**0023 마이그레이션 핵심 (차세션 052)**:

```sql
-- ALTER TABLE table_cells ADD COLUMN nested_table_id TEXT REFERENCES table_structures(id);
-- value_type CHECK 갱신 (5종 → 6종, 'nested_table' 추가)
-- CHECK (value_type='nested_table' ⇒ nested_table_id NOT NULL)
```

**ontology v1.5.0 핵심**:

- 신규 edge_type: `CONTAINS_TABLE` (CELL → TABLE)
- 4 신규 node_types 영향 0 (기존 v1.4.0 유지) / 4 edge_types → 5 edge_types

**schema-validator KnowledgeContractTableCell 갱신**:

- `value_type: 'text' | 'number' | 'formula' | 'na' | 'merged_ref' | 'nested_table'`
- `nested_table_id?: string` 옵션 필드

## 6. Phase 분해 (예상 ~6 세션, ★ Session 050 후반부 패턴-H 흡수 후 +1)

★ Session 050 후반부 진산 발화 "표 안에 표 형태도 반영" → **패턴-H Nested Table** 추가 영속. 차세션 052 진입 게이트에 0023 마이그레이션 + ontology v1.5.0 + D-PHASE2-7 추가.

| 세션         | 작업                                                                                                                                          | 진입 조건         | 산출                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------- |
| 050 종착 (★) | 마이그레이션 **0022** staging+production + verify Cat 9 강화 (D-PHASE2-1=α 직접 산출)                                                         | D-PHASE2 영속     | trigger PASS / D1 noun 0021+0022 적용 / migration count 21 |
| 052          | **0023** 마이그레이션 (패턴-H 지원) + ontology v1.4.0 → **v1.5.0** + §3.1 MAJOR-A `validateTablesSection()` (패턴-H 포함) + §3.3 Drizzle 정의 | D-PHASE2-1~7 영속 | schema-validator (6 value_type) + 0023 + schema.ts         |
| 053          | §3.4 batch-processor 시스템 프롬프트 강화 (패턴-A~H 모두) + Cat 9 확장 (v1.5.0 + 0023 검증) + verify run PASS                                 | Drizzle 빌드 PASS | batch-processor + Cat 9 강화                               |
| 054          | Phase 2A — BATCH-7 별표 1·2·5·6·7 재추출 + G5.5 검수                                                                                          | 052+053 완료      | 5 TBL ~125 노드                                            |
| 055          | Phase 2B — BATCH-7 별표 9 + BATCH-1 적과전 매트릭스 (★ 패턴-H 발현 영역) + G5.5                                                               | 054 완료          | ~10 TBL ~200 노드 (패턴-H 포함)                            |
| 056          | Phase 2C — BATCH-6 가축 매트릭스 + G5.5 (★ 진산 직접 영속 영역)                                                                               | 055 완료          | ~5 TBL ~120 노드                                           |
| 057          | Phase 2D — BATCH-R1 26년 변경표 + G5.5 + Phase 2 종합 검증                                                                                    | 056 완료          | ~10 TBL ~150 노드                                          |

★ 차세션 052 = 본 plan 진입. Phase 2 종착 = 차세션 057 (~6 세션 후, 패턴-H 추가로 +1).

## 7. ★ Reality Anchor — 본 plan이 "불가능"할 이유 3가지

### 이유 1: BATCH 재추출 시 LLM 표 인식 정확도 한계

- Claude Opus 4.7 한국어 표 구조 이해 ~85% 추정 (검증 미수행)
- 특히 패턴-D 셀 병합 + 패턴-G 시간축 헤더에서 silent miss 위험
- **대응**: 패턴별 tests fixture 작성 (parser-1st-exam에 이미 있는 BATCH-N fixture 패턴 정합) + G5.5 진산 검수 강제 (D-PHASE2-6=β 단계별)
- **잔여 위험**: 진산 검수 시간 부담 (~3~5 시간 × 4 단계 = 12~20 시간)

### 이유 2: D1 노드 +600 → cost cap 활성 의무 (memory `project_anthropic_cap_pre_install.md`)

- 현 794 → ~1400 (~+76%)
- Vectorize 호출 비용 1회 인덱싱 ~$5 추정
- BATCH 재추출 토큰 비용 ~$30 추정 (Claude API call ≠ Claude Code, 그러나 Claude Code 컨텍스트 누적 = 토큰 비용)
- **대응**: Phase 2 진입 직전 `$200 monthly + alerts` cap 활성 의무 (memory `project_anthropic_cap_pre_install.md` 트리거)
- **잔여 위험**: cap 활성 망각 시 cost overrun 차단 X

### 이유 3: knowledge_nodes UPDATE 금지 + table_structures.updated_at 충돌

- Hard Limit "knowledge_nodes UPDATE 금지" 정합 — table_structures는 별도 테이블이지만 동일 패턴 의무
- 그러나 G5.5 검수 시 `human_reviewed_at` + `status` 갱신 필요 → UPDATE 허용 영역 명시 필요
- **대응**: §3.2 MAJOR-D=α (`prevent_table_structures_critical_update` trigger) — `human_reviewed_at` / `status` / `updated_at` 외 컬럼 차단 / 핵심 컬럼은 INSERT+SUPERSEDES 패턴 강제
- **잔여 위험**: trigger 누락 시 진산 직접 UPDATE 사고 가능 (단, L3 영역이라 plan + 승인 의무)

★ **3가지 이유 모두 "치명적 차단" 아님 → plan 진행 가능**. 단 진산 D-PHASE2-1~6 spot check + cap 활성 영속 의무.

## 8. Cross-Reference

- **선행 plan**: `docs/plans/table-processing-architecture-v1.md` §6 Phase 분해
- **선행 ADR**: `docs/adr/ADR-032-table-as-micro-kg.md` Status: Accepted
- **handoff-057 §H**: 4-Pass 통합 리뷰 — MAJOR-A/C/D carry-over 영속
- **review-20260507-113718-session-050-phase1-foundation.md**: MAJOR 6건 + MINOR 7건 분류
- **memory**: `project_table_processing_core_capability.md` (다중 자격증 핵심 역량) + `project_anthropic_cap_pre_install.md` (cap 활성 의무) + `feedback_single_vendor_cloudflare.md` (Cloudflare 정합)
- **batch-loadmap.md**: BATCH-1 / BATCH-6 / BATCH-7 / BATCH-R1 적재 결과 (Layer 1~4 100% 완료)

## 9. 다음 단계 (차세션 052+ 진입)

1. ★ **본 plan + ADR-032 진산 검토** (D-PHASE2-1~6 spot check)
2. 결정 후 §3.1 MAJOR-A `validateTablesSection()` 구현
3. §3.2 MAJOR-D 마이그레이션 0022 staging+production
4. §3.3 Drizzle 정의 4 테이블 + admin-web 빌드 PASS
5. §3.4 batch-processor 시스템 프롬프트 강화 + Cat 9 확장
6. Phase 2A 진입 (BATCH-7 별표 1·2·5·6·7 재추출, G5.5 진산 검수)

---

**작성**: Claude (Opus 4.7 1M context) — Session 050 종착 (handoff-057 권장 1순위 채택)
**상태**: Plan 작성 완료. 진산 D-PHASE2-1~6 spot check 후 차세션 052+ 진입 의무.
**예상 완료**: 차세션 052~057 (~5 세션) 후 BATCH 표 영역 100% 분해 + Phase 2 종착.
