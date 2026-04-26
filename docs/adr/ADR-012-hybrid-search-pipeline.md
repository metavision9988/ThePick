# ADR-012: Hybrid Search Pipeline (Vector → Graph → Truth Weight)

작성일: 2026-04-26
상태: Accepted
관련: ADR-008, ADR-011, ADR-013, ADR-019
검토서 §2 결함 C (P0 Critical)

---

## Context

벡터 임베딩 단독 검색 = **위험**:

- 폐기된 과거 노드(개정 전)가 의미적으로 더 가까우면 시스템이 폐기 정보를 정답으로 끌어올림
- 예: "손해정도비율 = ?" 질문 → CONST-900 (20%, 폐기) 가 CONST-901 (10%, 활성) 보다 유사도 높을 시 → 학습자에게 잘못된 답
- 26년 시험 응시자가 20% 답안 → 오답 → 불합격 → **서비스 사망 시나리오**

진산님 메모리 `project_vision_mvp_generalization.md` 북극성 = "생성물 신뢰성·정확성" — 폐기 정보 노출 = 직접 위반.

## Decision

모든 RAG 검색은 **3-Stage Hybrid Search Pipeline** 의무.

```
[Stage 1: Vector Recall]
    ├─ Vectorize 에서 top-K=20 후보
    ├─ 유사도 ≥ 0.60 (Hard Rule 4)
    └─ 출력: candidate_ids[]

[Stage 2: Graph Hard Filter]
    ├─ candidate_ids → D1 JOIN
    ├─ WHERE is_current_active = 1 (ADR-013)
    ├─ AND status = 'approved'
    ├─ AND exam_id = ? (멀티시험 격리)
    ├─ AND (valid_from IS NULL OR valid_from <= today)
    └─ 출력: filtered_nodes[]

[Stage 3: Truth Weight Re-rank]
    ├─ truth_weight 정렬 (LAW=10 > FORMULA=8 > INVESTIGATION=7 > CONCEPT=5)
    ├─ 동일 weight 내에서는 vector similarity 보존
    └─ 출력: final_ranked[]

[최종 반환]
    └─ top-N (운영 RAG: top-3, 검수: top-10)
```

**Hard Rule 18**: 모든 RAG 검색은 3-Stage Hybrid Search 의무. Vectorize 단독 결과 사용 금지.

## Consequences

### 긍정적

- 폐기 정보 노출 차단 (Stage 2 의 `is_current_active=1`)
- 멀티시험 격리 (Stage 2 의 `exam_id`)
- 우선순위 명확화 (Stage 3 의 truth_weight)
- 보안 강화 — prompt injection 으로 폐기 정보 끌어내려는 공격 차단

### Trade-offs

- 단순 Vector 검색 대비 D1 JOIN 추가 — 응답 시간 +50ms 추정
- Concurrent Execution (ADR-019) + Materialized Active View (ADR-013) 결합 시 100ms 미만 보장

### 코드 위치

```
packages/content-build-engine/search/
├── pipeline.ts                # 메인 오케스트레이션
├── stages/
│   ├── vector-recall.ts       # Stage 1
│   ├── graph-filter.ts        # Stage 2
│   └── truth-rerank.ts        # Stage 3
└── types.ts
```

### 테스트 기준

| ID      | 통과 기준                                         |
| :------ | :------------------------------------------------ |
| HSP-T01 | top-K 에 is_current_active=0 노드 0건             |
| HSP-T02 | "손해정도비율" 질문 → CONST-901 (10%) 우선 반환   |
| HSP-T03 | LAW > FORMULA > CONCEPT 순서 100% 준수            |
| HSP-T04 | 응답 시간 500ms 이내                              |
| HSP-T05 | 모든 결과에 page_ref 또는 revision_change_id 포함 |
