# Version Management — 법령 / 산식 / 논리 변경 정식 절차 (v2.0)

> Content Build Engine 의 4 코어 모듈 중 셋째.
> v1 → v2.0: **Materialized Active View** (트리거 + KV 캐시) 추가 (검토서 §2-B).
> 상위: [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md)

---

## 1. 본 모듈의 책임

진산님 명시: _"버전 관리 즉 법률이나 산식 수치, 논리의 변경 등이 자주 발생하니 필요하다."_

법령 / 산식 수치 / 도메인 논리는 매년 (또는 비정기) 변경.

1. **변경 시점 명확화** — `valid_from`, `valid_to`
2. **신구 동시 보존** — UPDATE 금지, 신규 노드 + SUPERSEDES
3. **변경 추적성** — `revision_changes` 테이블
4. **학습자 노출 제어** — 시험 시점에 따른 정확한 정보 (운영 RAG 책임)
5. **운영 성능** (v2.0) — `is_current_active` 컬럼 + 트리거로 재귀 CTE 회피

---

## 2. Temporal Graph 패턴

### 원칙

```
❌ 절대 금지:
   UPDATE knowledge_nodes SET name = '새 이름' WHERE id = 'CONCEPT-001';
   UPDATE constants SET numeric_value = 0.10 WHERE id = 'CONST-900';

✅ 정확한 패턴:
   1. INSERT INTO knowledge_nodes (id, name, page_ref, valid_from, ...)
      VALUES ('CONCEPT-001-v2', '새 이름', '525', '2026-01-01', ...);
   2. INSERT INTO knowledge_edges (from_node, to_node, relation)
      VALUES ('CONCEPT-001-v2', 'CONCEPT-001', 'SUPERSEDES');
   3. INSERT INTO revision_changes (...);
   ★ v2.0: 트리거가 자동으로 CONCEPT-001 의 is_current_active = 0 갱신
```

### D1 트리거

`migrations/0003,0004` (기존):

- `prevent_knowledge_nodes_update` / `prevent_formulas_update` / `prevent_constants_update` — UPDATE 시도 시 `RAISE(ABORT)`

**v2.0 신설** — `migrations/0014/0015`:

- `auto_deactivate_on_supersedes` — SUPERSEDES INSERT 시 구 노드 `is_current_active = 0` 자동 갱신

---

## 3. **Materialized Active View (v2.0 신설, ADR-013)**

### 3.1 배경 (검토서 §2-B P0 Critical)

D1 (SQLite) 의 재귀 CTE 는 인덱스 적용 어려움 + 메모리 buffering. 1000+ 노드에서 SUPERSEDES 체인 추적 = 100ms+ 단위 지연 → 운영 RAG 응답 시간 hard limit (M15-T05 2초 이내) 위협.

### 3.2 해법 — `is_current_active` 컬럼 + 트리거 자동 갱신

#### 마이그레이션 0014: 활성 컬럼 + exam_id 추가 (R-3 정정, Year 1 부터 도입)

```sql
-- R-3 정정: Year 1 부터 exam_id 도입 (CBIV Stage 1 단순화)
ALTER TABLE knowledge_nodes ADD COLUMN exam_id TEXT NOT NULL DEFAULT 'son-hae-pyeong-ga-sa';
ALTER TABLE formulas ADD COLUMN exam_id TEXT NOT NULL DEFAULT 'son-hae-pyeong-ga-sa';
ALTER TABLE constants ADD COLUMN exam_id TEXT NOT NULL DEFAULT 'son-hae-pyeong-ga-sa';
-- Year 2 마이그레이션 0018 = default 제거 (zero-cost 전환, MULTI_EXAM_EXTENSION.md §4)

-- v2.0 활성 컬럼
ALTER TABLE knowledge_nodes ADD COLUMN is_current_active INTEGER DEFAULT 1;
ALTER TABLE knowledge_nodes ADD COLUMN current_version_id TEXT NULL;
ALTER TABLE formulas ADD COLUMN is_current_active INTEGER DEFAULT 1;
ALTER TABLE constants ADD COLUMN is_current_active INTEGER DEFAULT 1;

CREATE INDEX idx_knowledge_nodes_active
  ON knowledge_nodes (is_current_active, exam_id, type);  -- R-3: Year 1 부터 exam_id 활용
CREATE INDEX idx_formulas_active
  ON formulas (is_current_active, exam_id);
CREATE INDEX idx_constants_active
  ON constants (is_current_active, exam_id);
CREATE INDEX idx_knowledge_edges_supersedes
  ON knowledge_edges (relation, from_node) WHERE relation = 'SUPERSEDES';
```

#### 마이그레이션 0015: SUPERSEDES 트리거

```sql
CREATE TRIGGER auto_deactivate_on_supersedes
AFTER INSERT ON knowledge_edges
WHEN NEW.relation = 'SUPERSEDES'
BEGIN
  -- 구 노드: is_current_active=0 + current_version_id = 신 노드
  UPDATE knowledge_nodes
    SET is_current_active = 0, current_version_id = NEW.from_node
    WHERE id = NEW.to_node;

  -- 신 노드: current_version_id = 자기 자신
  UPDATE knowledge_nodes
    SET current_version_id = NEW.from_node
    WHERE id = NEW.from_node;
END;

-- 동일: formulas, constants 트리거
```

**중요**: 본 트리거는 `is_current_active` / `current_version_id` 메타 컬럼만 갱신. 본문 (name, formula, page_ref) 은 여전히 UPDATE 금지 (Hard Rule 1, 2 보존).

#### 어플리케이션 레이어 — `searchActiveNodes`

```typescript
// packages/content-build-engine/search/active-view.ts
export async function searchActiveNodes(
  query: string,
  examId: string,
  filters: SearchFilters,
): Promise<KnowledgeNode[]> {
  return await db
    .select()
    .from(knowledgeNodes)
    .where(
      and(
        eq(knowledgeNodes.examId, examId),
        eq(knowledgeNodes.isCurrentActive, 1), // ★ 재귀 CTE 불필요
        eq(knowledgeNodes.status, 'approved'),
      ),
    );
}
```

#### KV 캐시 (선택, 운영 RAG 진입 시)

```typescript
// 자주 조회되는 활성 노드 ID 목록 KV 캐시 (TTL 5분, BATCH 적재 시 무효화)
await env.KV.put(`active_nodes:${examId}`, JSON.stringify(activeNodeIds), { expirationTtl: 300 });
```

### 3.3 Hard Rule 19

> **모든 운영 RAG 쿼리는 `is_current_active=1` 필터 의무. 재귀 CTE 사용 금지 (성능 hard limit).**

---

## 4. revision_changes 테이블

| 필드              | 형식         | 의미                                 |
| :---------------- | :----------- | :----------------------------------- |
| id                | `REV-NNN`    | 개정사항 ID                          |
| effective_date    | `YYYY-MM-DD` | 발효일                               |
| source_doc        | 자료명       | "4월8일\_26년변경사항정리.pdf"       |
| source_page       | 페이지       | "p.3"                                |
| description       | 한국어       | "손해정도비율 임계값 20% → 10% 변경" |
| affected_node_ids | JSON 배열    | `["CONCEPT-001", "CONST-900"]`       |
| superseded_by     | `REV-XXX`    | (필요 시)                            |

각 변경 = `revision_changes` 1행 + 영향 노드별 SUPERSEDES 엣지 + 트리거 자동 활성 갱신.

---

## 5. 26년 개정사항 적용 절차 (예시)

| 변경                        | 영향 받는 노드                            | SUPERSEDES + 트리거 결과                      |
| :-------------------------- | :---------------------------------------- | :-------------------------------------------- |
| 손해정도비율 20% → 10%      | CONST-900 → CONST-901                     | `is_current_active`: CONST-900=0, CONST-901=1 |
| 예찰조사 신설               | (신규) INV-NNN-예찰조사                   | (신규, SUPERSEDES 없음)                       |
| 과수4종 종합위험 추가       | (신규) INS-NN-과수4종                     | (신규)                                        |
| 신규 품목 (녹두/생강/참깨)  | (신규) CROP-NNN                           | (신규)                                        |
| 온주밀감 잔존비율 계수 변경 | F-NN-온주밀감-기존 → F-NN-온주밀감-26개정 | SUPERSEDES + 트리거                           |

본 처리는 BATCH-R1 / BATCH-R2 (Layer 4) 적재 시 일괄.

---

## 6. 학습자 노출 제어 (시험 시점 기반)

| 학습자 응시 연도   | 운영 RAG 노출 정책                                                        |
| :----------------- | :------------------------------------------------------------------------ |
| 2026년 시험        | 신 정보 (`is_current_active=1`) 우선. 구 정보는 "변경 전 = 20%" 보조 표시 |
| 2025년 이전 (회고) | 구 정보. 신은 "26년 개정 후" 안내                                         |

이 정책은 운영 RAG (Phase 3) 책임. 본 엔진은 **신구 둘 다 보존** + 활성 표시.

---

## 7. 진산님 검수 워크플로우

변경 적재 시:

1. revision_changes INSERT
2. 신규 노드 INSERT (`status='draft'`)
3. SUPERSEDES 엣지 INSERT → 트리거가 자동 `is_current_active` 갱신
4. CBIV 6단계 검증 (`packages/cbiv/`)
5. 진산님 검수 (Stage 7) — sample 5건
6. status='approved' 승격

---

## 8. 무결성 위배 (즉시 차단, v2.0)

- ❌ knowledge_nodes UPDATE → D1 트리거 차단 (Hard Rule 1, 2)
- ❌ revision_changes 없는 SUPERSEDES → schema-validator 거부
- ❌ valid_from 누락 → NOT NULL 처리
- ❌ 같은 자격증 내 동일 효과 SUPERSEDES 순환 → graph-integrity + CBIV Stage 4 차단
- ❌ **운영 RAG 가 `is_current_active` 필터 누락 → Hard Rule 19 위반** (v2.0)
- ❌ **재귀 CTE 직접 사용 → Hard Rule 19 위반** (v2.0)

본 무결성이 깨지면 학습자가 잘못된 시점의 정보로 시험 준비 → 서비스 사망.
