# Plan — BA-C1 `apps/api/src/db/queries/tables.ts` examId 시그니처

**상태**: Proposed (Year 2 진입 전 또는 admin G5.5 UI 진입 직전 의무 적용)
**작성 일자**: 2026-05-07 (Session 054, Year 2 zero-cost 전환 선제 plan)
**작성자**: Claude Opus 4.7 1M context (진산 트리거 — "권고 순서대로 해줘")
**관련 영역**: Hard Rule 16 (시험 경계 강제) / Hard Rule 17 (`ExamId` 타입 경유) / `apps/api/src/db/` / ADR-007 (Year 2 이월 / multi-exam adapter) / ADR-032 (Table-as-Micro-KG)
**연관 5-Persona Critical**: BA-C1 (Session 052 backend-architect)

---

## 1. 컨텍스트

ADR-032 Phase 1 도입 시 4 신규 테이블 (table_structures / table_headers / table_cells / table_node_links) 신설. **현재까지 데이터 조회 래퍼 함수 0건** — `apps/api/src/db/queries/` 디렉토리 자체 부재.

**Hard Rule 16 위반** (Session 052 5-Persona BA-C1):

> 시험 지식 테이블 조회는 시험 경계를 반드시 강제. 데이터 조회 래퍼 함수의 첫 인자로 `examId: ExamId` 의무.
> Year 1 (exam_id 컬럼 부재 상태): 함수 시그니처에 `examId` 포함, 내부 동작은 단일 시험 가정.
> Year 2 (exam_id 컬럼 도입 후): 동일 함수 내부에서 `WHERE exam_id = ?` 자동 주입 → 호출 측 0 변경 (zero-cost).

**Year 2 비용 추정** (Session 052 BA-C1):

- **선제 (Year 2 진입 전)**: 5-8 work-day
- **사후 (Year 2 가동 후)**: 30-50 work-day (호출 측 전원 시그니처 갱신 + 회귀 테스트 전면 재작성)
- **차이**: ~3-6배

---

## 2. 목표 (acceptance criteria)

1. `apps/api/src/db/queries/tables.ts` 신설 (5-8 함수, 모두 `examId: ExamId` 첫 인자)
2. Drizzle ORM 의존 + 기존 `apps/api/src/db/schema.ts` 정합
3. 각 함수 회귀 테스트 (`apps/api/src/__tests__/queries/tables.test.ts`) — Year 1 동작 PASS, Year 2 동작 mock TODO carry-over
4. admin G5.5 UI 진입 시점 호출 측 100% 본 모듈 경유 (carry-over 차단)
5. verify-engine-contracts.ts Cat 11 신설 (선택, examId 시그니처 의무 정합 자동 검증)

---

## 3. 함수 카탈로그 (예상 8 함수)

본 plan 시점 추정 — 실제 작성 시 admin G5.5 UI 요구사항 기반 가감.

```typescript
// apps/api/src/db/queries/tables.ts

import type { ExamId } from '@thepick/shared';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * 표 메타 조회 (id 기준).
 * Year 1: examId 인자 무시 (단일 시험). Year 2: WHERE exam_id = ? 자동.
 */
export async function findTableById(
  db: D1Database,
  examId: ExamId,
  tableId: string,
): Promise<TableStructureRow | null>;

/**
 * 패턴별 표 목록 (admin G5.5 검수 대시보드).
 */
export async function findTablesByPattern(
  db: D1Database,
  examId: ExamId,
  patternType: TablePatternType,
  options?: { limit?: number; status?: TableStatus },
): Promise<TableStructureRow[]>;

/**
 * 출처 노드 기반 역방향 조회 (LAW-143 → 별표9 표 등).
 */
export async function findTablesBySourceNode(
  db: D1Database,
  examId: ExamId,
  sourceNodeId: string,
): Promise<TableStructureRow[]>;

/**
 * 표 단위 헤더 트리 조회 (axis filter).
 */
export async function findHeadersByTable(
  db: D1Database,
  examId: ExamId,
  tableId: string,
  axis?: 'row' | 'column',
): Promise<TableHeaderRow[]>;

/**
 * 표 단위 셀 조회 (value_type filter).
 */
export async function findCellsByTable(
  db: D1Database,
  examId: ExamId,
  tableId: string,
  options?: { valueType?: TableValueType; rowId?: string; colId?: string },
): Promise<TableCellRow[]>;

/**
 * 표 ↔ knowledge_nodes 양방향 (extracted_from / referenced_by / supersedes).
 */
export async function findNodeLinksByTable(
  db: D1Database,
  examId: ExamId,
  tableId: string,
  relationType?: TableNodeLinkRelationType,
): Promise<TableNodeLinkRow[]>;

/**
 * Pattern-D anchor 역방향 (merged_with_id IS NOT NULL).
 * 0025 partial index idx_table_cells_merged 활용 (PE-M1 흡수).
 */
export async function findMergedCellGroup(
  db: D1Database,
  examId: ExamId,
  anchorCellId: string,
): Promise<TableCellRow[]>;

/**
 * Pattern-H nested table 역방향 (nested_table_id IS NOT NULL).
 * 0023 idx_table_cells_nested 인덱스 활용.
 */
export async function findNestedTableContainers(
  db: D1Database,
  examId: ExamId,
  nestedTableId: string,
): Promise<TableCellRow[]>;
```

**Year 1 → Year 2 전환 비용** (zero-cost 보장):

```typescript
// Year 1 본문 (현 schema, exam_id 컬럼 부재):
export async function findTableById(db, examId, tableId): Promise<TableStructureRow | null> {
  // Hard Rule 16 Year 1: examId 인자 보존, 내부 WHERE 절 없음
  return db
    .prepare('SELECT * FROM table_structures WHERE id = ?')
    .bind(tableId)
    .first<TableStructureRow>();
}

// Year 2 본문 (마이그레이션 0028+ 적용 후):
export async function findTableById(db, examId, tableId): Promise<TableStructureRow | null> {
  return db
    .prepare('SELECT * FROM table_structures WHERE exam_id = ? AND id = ?')
    .bind(examId, tableId)
    .first<TableStructureRow>();
}
// 호출 측 코드 변경 0 — 시그니처 동일, 본문만 수정.
```

---

## 4. 작업 분해 (5-8 work-day 추정)

### Phase A — 기반 (1-2일)

| Step | 작업                                                                                                                | 산출물                             |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| A1   | `apps/api/src/db/queries/` 디렉토리 신설 + index.ts barrel export                                                   | `apps/api/src/db/queries/index.ts` |
| A2   | TableStructureRow / TableHeaderRow / TableCellRow / TableNodeLinkRow 타입 정의 (`apps/api/src/db/queries/types.ts`) | `apps/api/src/db/queries/types.ts` |
| A3   | EXAM_IDS / ExamId import 정합 (Hard Rule 17 — `@thepick/shared` 단일 경로 의무)                                     | shared/exam-adapter.ts 정합 확인   |

### Phase B — 함수 작성 (3-5일)

| Step | 작업                                                                            | 산출물                                                                                                     |
| ---- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| B1   | findTableById / findTablesByPattern / findTablesBySourceNode (table_structures) | `apps/api/src/db/queries/tables.ts` (~150 LOC)                                                             |
| B2   | findHeadersByTable / findCellsByTable (table_headers / cells)                   | 동일 파일 (~100 LOC)                                                                                       |
| B3   | findNodeLinksByTable / findMergedCellGroup / findNestedTableContainers          | 동일 파일 (~100 LOC)                                                                                       |
| B4   | 회귀 테스트 (createD1FromAllMigrations helper 재사용)                           | `apps/api/src/__tests__/queries/tables.test.ts` (~300 LOC, 8 함수 × 정상/엣지/Year 2 mock 평균 3 시나리오) |

### Phase C — 검증 (1일)

| Step | 작업                                                                            | 산출물                                                              |
| ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| C1   | verify-engine-contracts.ts Cat 11 신설 (examId 시그니처 정합 자동 검증, 선택)   | scripts/verify-engine-contracts.ts (Cat 11 추가) — 선택, carry-over |
| C2   | apps/api typecheck PASS + parser regression 영향 0 + verify run1+run2 PASS 일치 | -                                                                   |
| C3   | handoff + plan status: Proposed → Accepted 갱신                                 | docs/plans/ba-c1-tables-queries-exam-id.md (status 갱신)            |

---

## 5. Year 2 zero-cost 전환 영속 (마이그레이션 0028+ 적용 시)

본 plan 의 함수 시그니처는 Year 1 시점에 이미 `examId: ExamId` 첫 인자 의무. Year 2 마이그레이션 0028 (table_structures 외 4 테이블 + knowledge_nodes / formulas / constants 등 9 테이블 모두 `exam_id` 컬럼 추가) 적용 후 함수 본문만 갱신:

```diff
- .prepare('SELECT * FROM table_structures WHERE id = ?')
- .bind(tableId)
+ .prepare('SELECT * FROM table_structures WHERE exam_id = ? AND id = ?')
+ .bind(examId, tableId)
```

호출 측 코드 변경 0 — Hard Rule 16 정합 유지. ADR-007 §"Year 2 zero-cost 전환" 영속.

---

## 6. 검토한 대안

### 옵션 A (★ 채택): 본 plan 대로 examId 첫 인자 의무

- 장점: Year 2 zero-cost 전환 보장, Hard Rule 16/17 정합 100%
- 단점: Year 1 시점 examId 인자가 사실상 unused — 단, 5-Persona BA-C1 spec 정합

### 옵션 B (보류): Year 2 시점 일괄 추가

- 장점: Year 1 단순화 — 함수 시그니처에 examId 부재
- 단점: Year 2 진입 시 호출 측 전원 갱신 의무 = 30-50 work-day (~3-6배 비용)

### 옵션 C (보류): D1 prepared statement template 사용 + 동적 WHERE 주입

- 장점: 함수 본문 변경 0
- 단점: 보안 위험 (prepared statement 외부 변조), Drizzle ORM 정합 깨짐

---

## 7. carry-over (admin G5.5 UI 진입 시점 의무)

본 plan 활성화 트리거:

1. **admin G5.5 UI 첫 endpoint 진입**: `apps/api/src/routes/` 신설 시점 (현 시점 0건). routes 신설 직후 본 plan 100% 활용 의무.
2. **Phase 2A 별표 재추출 후 검수 흐름 진입**: G5.5 검수자가 표 단위 SELECT 시 본 함수 경유 의무.
3. **Year 2 진입 결정**: 진산 발화 "Year 2 진입" 시 본 plan 즉시 활성화 + 마이그레이션 0028+ 동시 진행.

---

## 8. 의존 관계

| 의존         | 상태                                        | 비고                             |
| ------------ | ------------------------------------------- | -------------------------------- |
| ADR-007      | Accepted                                    | Year 2 multi-exam adapter 영속   |
| ADR-032      | Accepted (Phase 1 Foundation)               | 4 테이블 신설                    |
| ADR-033      | Proposed (본 ADR과 동시 선제 plan)          | TBL/TROW/TCOL/TCELL ID 패턴 확장 |
| Hard Rule 16 | 영속                                        | 시험 경계 강제                   |
| Hard Rule 17 | 영속                                        | ExamId 타입 단일 경로            |
| EXAM_IDS     | `packages/shared/src/constants/exam-ids.ts` | 단일 정의                        |

---

## 9. 검증 체크리스트 (활성화 시점)

- [ ] `apps/api/src/db/queries/` 디렉토리 신설 + barrel export
- [ ] 8 함수 모두 `examId: ExamId` 첫 인자 의무 + 회귀 테스트 8 × 3 = ~24 시나리오 PASS
- [ ] apps/api typecheck PASS
- [ ] parser regression 영향 0 (179+ PASS 일치)
- [ ] verify-engine-contracts.ts run1+run2 PASS 일치
- [ ] handoff + plan status: Proposed → Accepted 갱신
- [ ] (선택) verify-engine-contracts.ts Cat 11 examId 시그니처 정합 자동 검증

---

**작성**: Claude Opus 4.7 1M context (Session 054 plan, BA-C1 Year 2 zero-cost 전환 선제 plan)
**다음**: admin G5.5 UI 첫 endpoint 진입 또는 Year 2 진입 트리거 시점에 본 plan Activate.
