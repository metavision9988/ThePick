# ADR-013: Materialized Active View on D1 (트리거 + KV 캐시)

작성일: 2026-04-26
상태: Accepted
관련: ADR-011, ADR-012
검토서 §2 결함 B (P0 Critical)

## Context

D1 (SQLite) 의 재귀 CTE 는 인덱스 적용 어려움 + 메모리 buffering. 1000+ 노드에서 SUPERSEDES 체인 추적 = 100ms+ 지연 → 운영 RAG 응답 시간 hard limit (M15-T05 2초) 위협.

매 쿼리마다 SUPERSEDES 체인 추적 = 비용 폭증. 학습자 100명 동시 = 초당 수십 쿼리 지연 누적.

## Decision

`is_current_active` 컬럼 + 자동 동기화 트리거로 **재귀 CTE 회피**.

### 1단계: D1 스키마 (마이그레이션 0014)

```sql
ALTER TABLE knowledge_nodes ADD COLUMN is_current_active INTEGER DEFAULT 1;
ALTER TABLE knowledge_nodes ADD COLUMN current_version_id TEXT NULL;
ALTER TABLE formulas ADD COLUMN is_current_active INTEGER DEFAULT 1;
ALTER TABLE constants ADD COLUMN is_current_active INTEGER DEFAULT 1;

CREATE INDEX idx_knowledge_nodes_active
  ON knowledge_nodes (is_current_active, exam_id, type);
CREATE INDEX idx_knowledge_edges_supersedes
  ON knowledge_edges (edge_type, from_node) WHERE edge_type = 'SUPERSEDES';
```

### 2단계: SUPERSEDES 트리거 (마이그레이션 0015)

```sql
CREATE TRIGGER auto_deactivate_on_supersedes
AFTER INSERT ON knowledge_edges
WHEN NEW.edge_type = 'SUPERSEDES'
BEGIN
  UPDATE knowledge_nodes
    SET is_current_active = 0, current_version_id = NEW.from_node
    WHERE id = NEW.to_node;
  UPDATE knowledge_nodes
    SET current_version_id = NEW.from_node
    WHERE id = NEW.from_node;
END;
```

### 3단계: 어플리케이션 — `searchActiveNodes`

```typescript
// 재귀 CTE 불필요 — 단일 WHERE 조건
return await db
  .select()
  .from(knowledgeNodes)
  .where(
    and(
      eq(knowledgeNodes.examId, examId),
      eq(knowledgeNodes.isCurrentActive, 1),
      eq(knowledgeNodes.status, 'approved'),
    ),
  );
```

### 4단계: KV 캐시 (선택, 운영 RAG 진입 시)

```typescript
await env.KV.put(`active_nodes:${examId}`, JSON.stringify(activeNodeIds), { expirationTtl: 300 });
```

**Hard Rule 19**: 모든 운영 RAG 쿼리는 `is_current_active=1` 필터 의무. 재귀 CTE 사용 금지.

## Consequences

### 긍정적

- 운영 RAG 응답 시간 50ms 이내 보장 (1000+ 노드)
- D1 비용 감소 (재귀 CTE 무거운 쿼리 제거)
- Hard Rule 1 (UPDATE 금지) 보존 — 트리거는 메타 컬럼만 갱신, 본문 (name, formula) 미변경

### Trade-offs

- 마이그레이션 0014/0015 회귀 영향 점검 필요
- 트리거의 예상 외 동작 가능성 — 단위 테스트 강화

### 테스트 기준

| ID      | 통과 기준                                             |
| :------ | :---------------------------------------------------- |
| MAV-T01 | SUPERSEDES INSERT 후 구 노드 is_current_active=0 자동 |
| MAV-T02 | 1000+ 노드 환경 활성 노드 조회 50ms 이내              |
| MAV-T03 | 기존 BATCH-0 데이터 회귀 영향 0건                     |
| MAV-T04 | UPDATE 금지 보존 (트리거가 status/active 만 갱신)     |
| MAV-T05 | KV 캐시 무효화 (BATCH 적재 후 자동)                   |
