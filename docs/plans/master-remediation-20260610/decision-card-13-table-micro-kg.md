# 결정 카드 #13 — Table-as-Micro-KG supersedes 이중 채널 ADR + 표 벡터 433 슬롯 잠식 처분 (WS-6e)

> 작성: 2026-06-12 / 상태: **결재 대기**
> 배경: 감사 major `table-micro-kg-split-brain`(DESIGN_AUDIT_REPORT_20260610-140529.md:91,247) — 표 버전관리가
> SUPERSEDES 트리거 기계 밖의 제2 채널로 존재 + production 표 벡터 433개가 메인 검색 top-20 슬롯만 소모 후
> 무음 탈락. MASTER_PLAN §3 WS-6e "첫 표 개정 전 결정 필요" + §6 #13 "ADR 상신 후 결정".

## 근거 (실코드·실문서 대조 — 2026-06-12)

**문제 A — supersedes 이중 채널 (버전관리 분열)**

- `migrations/0021_table_as_micro_kg.sql:112-118` `table_node_links` — relation_type CHECK 에 소문자
  `'supersedes'` 포함(0021:116). knowledge_edges `edge_type='SUPERSEDES'` 와 별개 채널.
- SUPERSEDES 기계 전부 우회: 0013 active flip 트리거(0013:101-108, knowledge_edges 감시) / `0014:181-200`
  역방향 순환·자기참조 가드(knowledge_edges 감시) / `0014:140-170` formulas·constants 자동 비활성(knowledge_edges
  아닌 **자체 superseded_by 컬럼** 감시 — 0014:127-128 주석 명시). 셋 모두 table_node_links 는 미감시 —
  'supersedes' INSERT 는 어느 트리거에도 걸리지 않음.
- 표→표 supersession 표현 불가: FK 가 `related_node_id → knowledge_nodes(id)`(0021:115) — 표가 표를
  대체하는 개정(2027 R-BATCH 류)을 이 테이블로 기록할 구조 자체가 없음.
- ADR-032 Accepted(2026-05-07)는 표 자체 버전관리 채널을 별도 결정하지 않았고, 위험만 예고(ADR-032:233
  "시간축+의미축 동시 헤더 → LLM 자동 SUPERSEDES 엣지 누락 가능"). production `table_node_links` 의
  relation_type 별 행 분포 라이브 재확인 = [미조사] — 적재 시점 기록은 20 links 전부 relation_type=
  'extracted_from'('supersedes' 사용 기록 0건, phase2a-vectorize-table-indexing.plan.md:20 +
  phase2a-vectorize-indexing.plan.md:24,26).

**문제 B — 표 벡터 433 슬롯 잠식**

- 433 출처: table_structures 20 + headers 167 + cells 246 = **433**(phase2a-vectorize-table-indexing.plan.md:22).
  production `thepick-embeddings` vectorCount=1227 = knowledge_nodes 794 + table\_\* 433
  (phase2a-user-search-route.plan.md §1.1, 2026-05-08 기록 — 이후 변동 여부 [미조사]).
- 잠식 기전: Stage 1 Vectorize.query 필터 = `{ exam_id }` 단독(`user-search.ts:365-376`) + `STAGE1_TOP_K=20`
  (`user-search.ts:48`) → 표 벡터가 top-20 경쟁 참여. Stage 2 `fetchApprovedNodes`(`user-search.ts:258,461`)는
  knowledge_nodes 한정 → table\_\* ID 는 슬롯만 소모 후 **경고 없이 탈락**. 잠식 빈도 실측치 = [미조사].
- 표 벡터에 `node_type` metadata('TABLE'/'ROW_HEADER'/'COL_HEADER'/'CELL') 존재(plan:54,69,90 + upserter.ts:181
  non-empty 강제). Vectorize metadata-index 5 props = exam_id·node_type·status·lv1_insurance·lv2_crop —
  **node_type 포함**(phase2a-vectorize-indexing.plan.md:98; production 라이브 인덱스 실태 재확인 = [미조사]).
  단 V2 binding 제외 연산자($in/$nin/$ne) 미작동 실측 선례(Session 061 staging e2e,
  topic-cluster-router.ts:106-109) → 기존 코드는 equality 필터 + client-side prefix exclusion 채택.
- 표 검색 *활용*은 ADR-032 D-TABLE-6 β = "RAG 검색 강화 = Phase 2 데이터 적재 후"로 의도된 이연 — 미배선
  자체는 결함이 아니나, 잠식 부작용은 ADR 미예견분.

## 선택지 비교 (ADR 1건으로 A·B 동시 처분)

| 기준            | (a) 채널 단일화 + 쿼리측 필터                                                                                                                 | (b) ADR 결정만 영속·마이그 이연 + 필터 즉시                      | (c) 표 전용 인덱스 분리                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| supersedes 채널 | 0021 CHECK 에서 'supersedes' 제거 + 표→표 전용 구조(예: table_supersessions) + 0013/0014 패리티 트리거                                        | 동일 방향을 ADR 로 못박되 마이그는 "첫 표 개정 전" 게이트로 이연 | (a)와 동일 필요 (인덱스 분리는 채널 문제 미해결)    |
| 433 잠식        | Stage 1 node_type 제외 필터(metadata-index 에 node_type 포함 — 단 $nin/$ne 미작동 선례) 또는 ID prefix post-filter(선례 topic-cluster-router) | 좌동 (필터만 즉시 — 저비용·가역)                                 | 433 재업서트 + 검색 경로 분기 — 잠식 원천 차단      |
| 비용            | 마이그 L3 plan + 트리거 2종 + 필터 (중)                                                                                                       | 필터만 (소) — 마이그는 표 개정 트리거 시                         | 인덱스 신설 + 재업서트 + 이중 경로 유지비 (대)      |
| 시급성 정합     | 표 개정은 2027 전 미발생 추정 — 트리거 선투자                                                                                                 | 잠식(현재 진행형)만 즉시, 채널(미래형)은 결정 고정               | D-TABLE-6 β 본구현과 묶이면 일정 과대               |
| 위험            | L3 마이그 1건 추가 (0038 류 결재 체인)                                                                                                        | 이연 망각 위험 → Binary Gate G-WS6 ④ "ADR Accepted"가 차단막     | 미사용 인덱스 운영비 + Phase 2 설계 선점(조기 고정) |

## 권고: **(b)** — ADR 1건 신설로 채널 단일화 방향·표→표 구조를 결정 영속(첫 표 개정 전 마이그 게이트 명문)

- 433 잠식은 쿼리측 필터로 즉시 차단(가역·코드 소폭). 근거: 채널 문제의 실해는 "첫 표 개정" 시점에만 발생
  (MASTER_PLAN:181)하나 잠식은 현 production 검색에 상시 작용 — 시급한 쪽만 즉시, 구조 결정은 ADR 로 고정.
  node_type 제외 필터는 V2 binding 제외 연산자 미작동 실측 선례(topic-cluster-router.ts:106-109)가 있어 실패 시
  ID prefix post-filter(선례 STAGE3_NODE_ID_EXCLUDE_PREFIXES — TBL-/TROW-/TCOL-/TCELL-)로 폴백(슬롯 회복은
  부분적 — ADR 에 한계 명기).

> 진산 확인란: ☐ (a) 채널 단일화 마이그 즉시 + 필터 / ☐ (b) ADR 결정 영속·마이그 이연 + 필터 즉시 / ☐ (c) 표 전용 인덱스 분리 / ☐ 보류
