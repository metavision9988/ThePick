# ADR-047: 표(Table-as-Micro-KG) supersedes 채널 단일화 + 표 벡터 433 Stage 1 잠식 필터

- **상태:** **Accepted** (2026-07-02 진산 일괄 결재 — 결재 카드 #13 **(b)** "권고대로", 기록 커밋 3adb10a)
- **결정일:** 2026-07-02 (카드 상신 2026-06-12, WS-6e)
- **결정자:** 진산 (카드 #13 (a)/(b)/(c) 택1 결재) + Claude (실코드·실문서 대조 근거 작성)
- **관련 영역:** `migrations/0021_table_as_micro_kg.sql`(table_node_links — ★ **L3 마이그 이연**),
  `apps/api/src/search/user-search.ts`(Stage 1 필터 — 즉시 집행), ADR-032 Table-as-Micro-KG,
  `docs/plans/master-remediation-20260610/decision-card-13-table-micro-kg.md`
- **선결/게이트:** 채널 단일화 **마이그레이션은 본 ADR 이 승인하지 않는다** (ADR-045 패턴 —
  방향만 확정). SQL 작성 = "첫 표 개정 전" 게이트(§D-2)에서 별도 L3 plan → 진산 승인 후.
  즉시 집행분은 쿼리측 필터(§D-3)뿐 — 가역·소폭·검색 결과 계약 불변(표 벡터 제외만).

---

## 맥락 (Context)

감사 major `table-micro-kg-split-brain`(DESIGN_AUDIT_REPORT_20260610-140529.md:91,247) 이
표 처리(핵심 역량, ADR-032)의 두 결함을 못박았다. 실코드·실문서 대조는 결재 카드 #13
(2026-06-12) 에 영속 — 아래는 요지.

**문제 A — supersedes 이중 채널 (버전관리 분열)**

- `migrations/0021:112-118` `table_node_links.relation_type` CHECK 에 소문자 `'supersedes'`
  포함 — knowledge_edges `edge_type='SUPERSEDES'` 와 **별개 채널**.
- SUPERSEDES 기계 전부 우회: 0013 active flip 트리거 / 0014 역방향 순환·자기참조 가드 /
  0014 formulas·constants 자동 비활성 — 셋 모두 table_node_links 미감시. `'supersedes'`
  INSERT 는 어느 트리거에도 걸리지 않는다.
- **표→표 supersession 표현 불가**: FK 가 `related_node_id → knowledge_nodes(id)`(0021:115)
  — 표가 표를 대체하는 개정(2027 R-BATCH 류)을 기록할 구조 자체가 없음.
- production 실사용: 적재 시점 기록상 20 links 전부 `relation_type='extracted_from'`
  (`'supersedes'` 사용 0건 — phase2a-vectorize-table-indexing.plan.md:20). 라이브 분포
  재확인은 마이그 시점 의무(§D-2).

**문제 B — 표 벡터 433 슬롯 잠식 (현재 진행형)**

- production `thepick-embeddings` 에 표 벡터 **433**(table_structures 20 + headers 167 +
  cells 246) 이 knowledge_nodes 794 와 동거.
- 잠식 기전: Stage 1 `Vectorize.query` 필터 = `{ exam_id }` 단독 + `STAGE1_TOP_K=20` →
  표 벡터가 top-20 경쟁 참여. Stage 2 `fetchApprovedNodes` 는 knowledge_nodes 한정 →
  표 벡터 id 는 **슬롯만 소모 후 경고 없이 탈락**. 부수 왜곡: 표 벡터가 top-1 이면
  `top1Score`/`gracefulDegradation`(ADR-008) 판정이 제공 불가 후보로 오염.
- 표 검색 _활용_ 자체는 ADR-032 D-TABLE-6 β 의도된 이연(Phase 2) — 미배선은 결함이
  아니나 잠식 부작용은 ADR-032 미예견분.

## 결정 (Decision)

### D-1. supersedes 채널 = knowledge_edges `SUPERSEDES` 단일화 방향 확정

표 버전관리를 SUPERSEDES 트리거 기계 **밖의 제2 채널로 두지 않는다**. 단일화 내용
(마이그 시점 구현 스펙의 방향 고정 — SQL 은 본 ADR 범위 밖):

1. `table_node_links.relation_type` CHECK 에서 소문자 `'supersedes'` **제거** (0021:116).
   제거 전 라이브 분포 재확인 의무 — `'supersedes'` 행이 발견되면 이관 계획 동반.
2. **표→표 supersession 전용 구조 신설** (예: `table_supersessions` — 신 표 id → 구 표 id).
   현 FK(`related_node_id → knowledge_nodes`)로는 표가 표를 대체하는 개정을 표현할 수
   없으므로 별도 구조가 유일 경로.
3. 신설 구조에 **0013/0014 패리티 트리거 의무** — active flip(구 표 자동 비활성),
   역방향 순환·자기참조 가드. knowledge_nodes 의 Temporal Graph 불변식(UPDATE 금지,
   INSERT + SUPERSEDES)과 동일 보증 수준.

### D-2. 마이그레이션 = "첫 표 개정 전" 게이트로 이연

- 채널 문제의 실해는 **첫 표 개정 시점에만 발생**(MASTER_PLAN:181 — 2027 전 미발생 추정).
  트리거 선투자 대신 결정만 본 ADR 로 동결한다 (카드 #13 (a) 대비 저비용, (c) 인덱스
  분리 대비 조기 고정 회피).
- **망각 차단막**: ① MASTER_PLAN Binary Gate G-WS6 ④ "ADR Accepted" ② 표 개정 BATCH
  (R-BATCH 류) plan 은 본 ADR §D-1 을 **선결 참조 의무** — 마이그 미완이면 표 개정 착수
  금지. ③ 본 마이그는 L3(DB 스키마) — plan 작성 → 진산 승인 → SQL (0038 결재 체인 패턴).

### D-3. 표 벡터 433 잠식 = Stage 1 쿼리측 필터 즉시 차단 (2026-07-02 집행 완료)

- **구현**: `apps/api/src/search/user-search.ts` — `STAGE1_TABLE_VECTOR_EXCLUDE_PREFIXES`
  (`TBL-`/`TROW-`/`TCOL-`/`TCELL-`, ontology v1.5.0) + `isTableVectorId` client-side
  prefix post-filter 를 Vectorize 회수 **직후** 적용. `top1Score`·`gracefulDegradation`·
  `stage1Count` 가 제공 가능 후보만으로 산출되도록 정화. 가역·소폭 — 응답 shape 불변,
  표 벡터 제외만.
- **서버측 제외가 불가한 이유 (실측)**: knowledge_node 벡터의 `node_type` metadata 는
  `'knowledge_node'` 고정값이 아닌 실 노드 type 12종(`vectorize/routes.ts:367`) →
  equality 단독으론 "표 제외" 표현 불가. `$nin`/`$ne` 객체 필터는 Vectorize V2 binding
  미작동 실측 선례(Session 061 staging e2e, `topic-cluster-router.ts:104-118`).
- **한계 (명기 의무 — 카드 #13 권고문)**: 슬롯 회복은 **부분적**이다. top-20 회수
  자체에는 표 벡터가 여전히 참여하며, 제외분만큼 knowledge_node 후보가 보충되지 않는다
  (worst case: 표 벡터가 top-20 을 점유한 만큼 recall 축소는 잔존). 원천 차단은
  (c) 표 전용 인덱스 분리 또는 V2 filter 연산자 정상화 후 서버측 제외 — Year 2 carry-over.
- **단일 진실원**: multi-path-fallback Stage 3 의 `STAGE3_NODE_ID_EXCLUDE_PREFIXES` 는
  `['TC-', ...STAGE1_TABLE_VECTOR_EXCLUDE_PREFIXES]` 로 표 prefix 4종을 본 상수에서
  파생 — 목록 drift 차단.
- graph 경로(`/api/search/graph`)는 `searchKnowledgeNodesForUser` 재사용으로 자동 적용
  (baseline·시드 선정 동일 정화).

## 결과 (Consequences)

- ✅ 표 버전관리 방향이 단일 채널로 동결 — "첫 표 개정" 시점의 split-brain(표만 구버전
  잔존/이중 기록) 리스크 제거 경로 확정.
- ✅ Stage 1 잠식 즉시 차단 — 표 벡터의 무음 슬롯 소모 + graceful 판정 왜곡 제거
  (테스트 동봉: user-search.test.ts ADR-047 블록 4건 + graph-search-route.test.ts 1건).
- ⚠️ 마이그 이연 = 표 개정 전까지 `'supersedes'` CHECK 는 스키마에 잔존(사용 0건).
  차단막은 §D-2 게이트 — 표 개정 BATCH 착수 조건으로 강제.
- ⚠️ 슬롯 회복 부분적 (§D-3 한계) — 표 벡터 433/1227(≈35%) 비중이라 밀집 질의에서
  top-20 일부 소실 가능성 잔존. 잠식 빈도 실측치 [미조사] — Phase 2 표 검색 활용
  (D-TABLE-6 β) 설계 시 (c) 재평가.
- ⚠️ **범위 밖 관찰**: `TC-`(topic_clusters, 50 벡터)도 Stage 1 에서 동일 잠식 기전.
  카드 #13 은 표 벡터 433 한정이라 본 필터에 미포함 — 별도 처분 후보로 기록만 남긴다.

## 관련 (Related)

- `docs/plans/master-remediation-20260610/decision-card-13-table-micro-kg.md` (근거 전문 + 선택지 비교)
- `docs/plans/master-remediation-20260610/MASTER_PLAN.md` §3 WS-6e / Binary Gate G-WS6 ④
- ADR-032 (Table-as-Micro-KG — 표 구조 자체), ADR-004 §3 Addendum (V2 filter 연산자 carry-over)
- `migrations/0021_table_as_micro_kg.sql` / `migrations/0013`·`0014` (패리티 대상 트리거)
- `docs/plans/phase2a-vectorize-table-indexing.plan.md` (표 벡터 433 구성 출처)
