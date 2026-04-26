# Content Build Engine 재정립안 v2.0

> **제목:** S-V-F 비판 검토에 따른 코어 엔진 재설계
> **작성:** 2026-04-26 (DEV COVEN 8 페르소나 합동)
> **상위 문서:** [CONTENT_BUILD_ENGINE_OVERVIEW.md](./CONTENT_BUILD_ENGINE_OVERVIEW.md)
> **버전 관계:** 기존 v1.0 의 4 코어 모듈 구조는 유지, **3 모듈 신설 + 7 Hard Rule 추가**
> **상태:** 🔄 진산님 검토 대기 → 통과 후 BATCH-1 dry-run 진입

---

## 0. 본 문서의 위치 (MEPHISTO 지휘 메모)

> "비판의 의도를 제대로 받았다면, 우리는 방어가 아닌 재해체로 응답한다.
> 7개 결함 중 5개는 BATCH-1 진입 전 설계 종결, 2개는 Year 1 ~ Year 2 점진 처리."

본 문서는 비판자(S-V-F 관점)가 제기한 **7개 결함 + 1개 핵심 질문**에 대한 정식 응답입니다. 각 결함은 DEV COVEN 8 페르소나의 CoT 검증을 거쳤으며, 결론은 "비판 수용 + 구체 설계 + 코드 위치 + 테스트 기준" 으로 매듭짓습니다.

**검증 방법론**:

- ARCHITECT: 시스템 구조 영향 분석
- BREAKER: 엣지 케이스 + 회귀 가능성 분석
- GHOST: 운영 부담 + 비용 분석
- SENTINEL: 보안/공격면 분석
- HACKER: 구현 난이도 + 라인 수 추정
- ORACLE: 비전 정합성 (북극성: 생성물 신뢰성·정확성)
- ADVOCATE: 사용자 영향 분석
- MEPHISTO: 종합 조정 + 우선순위

---

## 1. 비판 7건의 타당성 평가 매트릭스

| #     | 비판 항목                                    | 타당성       | Phase          | 처리 우선순위                     |
| ----- | -------------------------------------------- | ------------ | -------------- | --------------------------------- |
| **A** | Graceful Degradation 역설                    | 70%          | Phase 1        | P1 (개정 필요)                    |
| **B** | Temporal Graph + D1 성능 충돌                | 95%          | Phase 1 (즉시) | **P0 (Critical)**                 |
| **C** | Vector ↔ Graph 구조 괴리                     | 90%          | Phase 1 (즉시) | **P0 (Critical)**                 |
| **D** | Human-in-the-Loop 한계                       | 100%         | Phase 1        | **P0 (Critical)**                 |
| **E** | 오프라인 동기화 단순성 (FSRS LWW)            | 85%          | Phase 2        | P1                                |
| **F** | 멀티시험 사일로 효과                         | 90% (Year 2) | Year 2 진입 시 | P2 (네임스페이스만 예약)          |
| **G** | **Cross-BATCH 자동 검증 (사용자 최종 질문)** | 100%         | Phase 1 (즉시) | **P0 (Critical, 본 문서의 핵심)** |

---

## 2. 결함별 재설계 (7건)

각 항목은 **CoT 검증 → 재설계 사양 → 코드 위치 → 테스트 기준** 순서로 정리합니다.

---

### 🔴 결함 A: Graceful Degradation 역설 (Paradox of Fallback)

#### 비판 요지

> "유사도 < 0.60 = 컨텍스트 미파악인데, 어떻게 정확한 '교재 O장 O절' 을 매핑하여 안내하는가? 이는 논리적 모순."

#### CoT 검증

**ORACLE의 분석:**
비판자의 추론은 부분적으로 옳지만 한 가지 가정이 틀렸다 — "벡터 유사도 = 컨텍스트 파악도" 는 등식이 아니다. 벡터 임베딩은 **의미 표현 공간에서의 거리**일 뿐, 키워드/메타데이터/출제영역 같은 **다른 신호**는 별도로 작동한다. 즉 0.59 의 유사도여도 키워드 "낙엽률" 이 명시적으로 등장하면 BATCH-1 (적과전 종합위험) 영역으로 confidently 라우팅 가능하다.

**ARCHITECT의 분석:**
다만 비판자의 본질적 지적은 옳다 — 현 설계 (`Hard Rule 4: 유사도 < 0.60 → "교재 O장 O절 참고"`) 는 **단일 경로 폴백**이며, 어떻게 "O장 O절" 이 결정되는지 명문화되어 있지 않다. 이는 사실상 underspecified.

**BREAKER의 엣지 케이스:**

- 학습자 질문: "낙엽률이 이상하게 나오는데" (구어체) → 벡터 유사도 0.55, 그러나 키워드 "낙엽률" 100% 일치
- 현 설계: `LOW_SIMILARITY` 거부 → "교재 422페이지 참고하세요" → 학습자는 어디인지 알 수 없음 → 이탈
- 재설계 후: 키워드 폴백 → BATCH-1 영역 → "낙엽률은 단감 산식의 변수입니다. 산식 보기" 가능

**ADVOCATE의 영향 평가:**
사용자 입장에서 "어딘지도 모르는 교재 페이지 안내" 는 **실패한 응답**. 다중 경로 폴백은 UX 핵심.

#### 재설계 사양: Multi-Path Fallback Pipeline

```
[학습자 질문]
    ↓
┌─────────────────────────────────────────┐
│ Stage 1: Vector Search (유사도 ≥ 0.75) │ ← 정상 경로
└────────────┬────────────────────────────┘
             │ Hit → Hybrid Re-rank (결함 C 참조) → 답변
             │ Miss
             ▼
┌─────────────────────────────────────────┐
│ Stage 2: Keyword/N-gram Match           │ ← 1차 폴백
│  - 질문에서 명사 추출 (kkma/khaiii)     │
│  - knowledge_nodes.name 매칭 (fuzzy)    │
│  - 매칭 시 해당 노드 + 인접 SUBGRAPH    │
└────────────┬────────────────────────────┘
             │ Hit → 답변 + "유사 토픽일 수 있습니다" 안내
             │ Miss
             ▼
┌─────────────────────────────────────────┐
│ Stage 3: Topic Cluster Routing          │ ← 2차 폴백
│  - 질문 → exam_scope 분류 (zero-shot)   │
│  - 해당 영역의 topic_clusters 안내       │
│  - "BATCH-1 (적과전) 영역 같습니다.       │
│     관련 산식 5개 보기"                  │
└────────────┬────────────────────────────┘
             │ Hit → 영역 안내 + 노드 목록
             │ Miss
             ▼
┌─────────────────────────────────────────┐
│ Stage 4: Honest Refusal                 │ ← 최종 폴백
│  - "이 질문은 손해평가사 범위 밖일 수    │
│     있습니다."                            │
│  - 진산님 검수 큐에 자동 기록            │
└─────────────────────────────────────────┘
```

#### 코드 위치

```
packages/content-build-engine/search/
├── vector-search.ts         # Stage 1
├── keyword-fallback.ts      # Stage 2 (신규)
├── topic-cluster-router.ts  # Stage 3 (신규)
├── honest-refusal.ts        # Stage 4 (신규)
└── pipeline.ts              # 4 단계 오케스트레이션
```

#### 테스트 기준

| 테스트 ID | 항목                       | 통과 기준                                     |
| --------- | -------------------------- | --------------------------------------------- |
| MPF-T01   | Stage 2 키워드 매칭 정확도 | 키워드 단독 질문 50건 → 90%+ 정확 토픽 라우팅 |
| MPF-T02   | Stage 3 영역 분류 정확도   | 영역별 질문 100건 → 85%+ 정확 영역            |
| MPF-T04   | 최종 거부 비율             | 정상 질문 → 거부율 < 5%                       |
| MPF-T05   | 검수 큐 자동 기록          | 거부된 질문은 100% 진산님 검수 큐             |

---

### 🔴 결함 B: Temporal Graph + D1 성능 충돌 (P0 Critical)

#### 비판 요지

> "Cloudflare D1 (SQLite) 에서 그래프 traversal + valid_from + SUPERSEDES 필터링을 재귀 CTE 로 하면 쿼리 비용 기하급수. 운영 RAG 응답 지연의 핵심 원인 될 Hard Limit."

#### CoT 검증

**ARCHITECT의 분석 (전체 동의):**
D1 (SQLite 기반) 의 재귀 CTE 는 인덱스 적용 어려움 + 메모리 buffering. 1000+ 노드에서 SUPERSEDES 체인 최신 버전 추적 = 수백 ms 단위 지연 가능. **운영 RAG 응답 시간 목표 (검색 2초 이내, M15-T05) 달성 불가능 시나리오.**

**GHOST의 운영 분석:**

- 실측 안 했으나 D1 의 일반적 패턴: 5+ 테이블 JOIN + WHERE 절 valid_from BETWEEN + SUPERSEDES NULL → 100ms+ 추정
- 학습자 동시 100명 = 초당 수십 쿼리 → 응답 지연 누적
- **운영 비용 분석:** D1 쿼리 비용은 호출당 → 매번 재귀 CTE = 비용 폭증

**HACKER의 구현 분석:**
SQLite 는 native materialized view 미지원. 두 가지 우회:

1. **트리거 기반 동기화**: INSERT 시 트리거가 활성 상태 컬럼 자동 갱신
2. **어플리케이션 캐시**: KV 에 활성 노드 ID 캐시 (TTL 기반)

진산님의 기존 Hard Rule 1 (UPDATE 금지) 와 충돌 안 함 — 활성 상태는 별도 컬럼으로 관리.

**BREAKER의 엣지 케이스:**

- BATCH-1 적재 후 BATCH-R1 (26년 개정) 적재 → CONST-900 → CONST-901 SUPERSEDES
- 학습자가 "손해정도비율" 질문 → 정답은 CONST-901 (10%)
- 현 설계: 매 쿼리마다 SUPERSEDES 체인 추적 → 마지막 노드 결정
- 재설계 후: `is_current_active=true` 직접 조회 → 즉시 반환

#### 재설계 사양: Materialized Active View (트리거 + 어플리케이션 캐시)

##### 1단계: D1 스키마 보강 (마이그레이션 0014)

```sql
-- knowledge_nodes 테이블에 활성 플래그 추가
ALTER TABLE knowledge_nodes ADD COLUMN is_current_active INTEGER DEFAULT 1;
ALTER TABLE knowledge_nodes ADD COLUMN current_version_id TEXT NULL;

-- 인덱스 추가 (조회 성능)
CREATE INDEX idx_knowledge_nodes_active
  ON knowledge_nodes (is_current_active, exam_id, type);
CREATE INDEX idx_knowledge_nodes_supersedes
  ON knowledge_edges (relation, from_node) WHERE relation = 'SUPERSEDES';

-- 동일 처리: formulas, constants
ALTER TABLE formulas ADD COLUMN is_current_active INTEGER DEFAULT 1;
ALTER TABLE constants ADD COLUMN is_current_active INTEGER DEFAULT 1;
```

##### 2단계: 자동 동기화 트리거 (D1)

```sql
-- SUPERSEDES 엣지 INSERT 시 자동 갱신
CREATE TRIGGER auto_deactivate_on_supersedes
AFTER INSERT ON knowledge_edges
WHEN NEW.relation = 'SUPERSEDES'
BEGIN
  -- 구 노드: is_current_active=0
  UPDATE knowledge_nodes
    SET is_current_active = 0, current_version_id = NEW.from_node
    WHERE id = NEW.to_node;

  -- 신 노드: is_current_active=1 (이미 default)
  -- 신 노드의 current_version_id = 자기 자신
  UPDATE knowledge_nodes
    SET current_version_id = NEW.from_node
    WHERE id = NEW.from_node;
END;
```

##### 3단계: 어플리케이션 레이어 — Hybrid Search 통합

```typescript
// packages/content-build-engine/search/active-view.ts
export async function searchActiveNodes(
  query: string,
  examId: string,
  filters: SearchFilters,
): Promise<KnowledgeNode[]> {
  // is_current_active=1 만 조회 (재귀 CTE 불필요)
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
}
```

##### 4단계: KV 캐시 (선택적, 운영 RAG 진입 시)

```typescript
// 자주 조회되는 활성 노드 ID 목록을 KV 에 캐시
// TTL 5분, BATCH 적재 시 무효화
await env.KV.put(`active_nodes:${examId}`, JSON.stringify(activeNodeIds), { expirationTtl: 300 });
```

#### 코드 위치

```
migrations/
├── 0014_add_active_columns.sql        # 신규
└── 0015_add_supersedes_trigger.sql    # 신규

packages/content-build-engine/
├── version-management/
│   ├── temporal-graph.ts              # 기존 + 트리거 로직
│   └── active-view-sync.ts            # 신규 (트리거 fallback)
└── search/
    ├── active-view.ts                 # 신규
    └── kv-cache.ts                    # 신규 (Phase 3 진입 시)
```

#### 테스트 기준

| 테스트 ID | 항목             | 통과 기준                                                                |
| --------- | ---------------- | ------------------------------------------------------------------------ |
| MAV-T01   | 트리거 정확성    | SUPERSEDES INSERT 후 구 노드 is_current_active=0 자동                    |
| MAV-T02   | 응답 시간        | 1000+ 노드 환경 활성 노드 조회 50ms 이내                                 |
| MAV-T03   | 회귀 안정성      | 기존 BATCH-1 검증 결과 영향 0                                            |
| MAV-T04   | UPDATE 금지 보존 | knowledge_nodes 본문은 UPDATE 차단 유지 (트리거가 status/active 만 갱신) |
| MAV-T05   | KV 캐시 무효화   | BATCH 적재 후 캐시 자동 무효화                                           |

#### Hard Rule 신설

> **Hard Rule 16**: 모든 운영 RAG 쿼리는 `is_current_active=1` 필터 의무. 재귀 CTE 사용 금지 (성능 hard limit).

---

### 🔴 결함 C: Vector ↔ Graph 구조 괴리 (P0 Critical)

#### 비판 요지

> "벡터 임베딩은 의미 유사성만 본다. 폐기된 과거 노드(개정 전)가 의미적으로 더 가까우면 시스템이 폐기 정보를 정답으로 끌어올린다. 순수 벡터 검색이 아닌 Hybrid Search (Vector + Graph/Metadata) 가 필요하다."

#### CoT 검증

**ARCHITECT의 분석 (90% 동의):**
비판자가 절대 옳다 — Vectorize 단독 검색은 위험. 다만 기존 Hard Rule 3 (Truth Weight 강제 정렬) 가 부분적으로 이 문제를 다루고 있다. 즉, **개념은 이미 존재하나 명문화 부족**. 결함 B 의 `is_current_active` 필터까지 결합하면 Hybrid Search 가 완성됨.

**BREAKER의 엣지 케이스 (가장 위험):**

- 학습자 질문: "손해정도비율은 몇 % 입니까?"
- Vectorize 검색 결과 (top-5):
  1. CONST-900 ("손해정도비율 임계값 20%", 유사도 0.92, **폐기됨**)
  2. CONST-901 ("손해정도비율 임계값 10%", 유사도 0.89, 활성)
  3. ...
- 현 설계: top-1 = CONST-900 → "20% 입니다" 답변 → **학습자가 26년 시험에 20% 답안 작성 → 오답 → 불합격**
- **이는 서비스 사망 시나리오**

**SENTINEL의 보안 관점:**
공격자가 의도적으로 폐기된 정보를 노출시키는 prompt injection 가능 — Hybrid Search 필터는 보안 경계이기도 함.

**ORACLE의 비전 정합성:**
북극성 = "생성물 신뢰성·정확성". 폐기 정보 노출 = 북극성 직접 위반.

**ADVOCATE의 영향:**
"근거 보기" UX 가 폐기 정보를 보여주면 학습자 신뢰 즉시 붕괴.

#### 재설계 사양: Hybrid Search Pipeline (3-Stage)

```
[Stage 1: Vector Recall]
    ├─ Vectorize 에서 top-K=20 후보 추출
    ├─ 유사도 ≥ 0.60 만 (기존 Hard Rule 4 유지)
    └─ 출력: candidate_ids[]

[Stage 2: Graph Hard Filter]
    ├─ candidate_ids → D1 JOIN
    ├─ WHERE is_current_active = 1
    ├─ AND status = 'approved'
    ├─ AND exam_id = ? (멀티시험 격리)
    ├─ AND (valid_from IS NULL OR valid_from <= today)
    └─ 출력: filtered_nodes[]

[Stage 3: Truth Weight Re-rank]
    ├─ truth_weight 기준 정렬
    │   - LAW=10 > FORMULA=8 > INVESTIGATION=7 > CONCEPT=5
    ├─ 동일 weight 내에서는 vector similarity 보존
    └─ 출력: final_ranked[]

[최종 반환]
    └─ top-N (운영 RAG: top-3, 검수: top-10)
```

#### 코드 위치

```
packages/content-build-engine/search/
├── pipeline.ts              # 메인 오케스트레이션
├── stages/
│   ├── vector-recall.ts     # Stage 1
│   ├── graph-filter.ts      # Stage 2 (신규, 결함 B 와 연계)
│   └── truth-rerank.ts      # Stage 3 (기존 truth-weight 강화)
└── types.ts                 # SearchPipelineResult 타입
```

#### 테스트 기준

| 테스트 ID | 항목               | 통과 기준                                         |
| --------- | ------------------ | ------------------------------------------------- |
| HSP-T01   | 폐기 노드 차단     | top-K 에 is_current_active=0 노드 0건             |
| HSP-T02   | 26년 개정 시나리오 | "손해정도비율" 질문 → CONST-901 (10%) 우선 반환   |
| HSP-T03   | Truth Weight 정렬  | LAW > FORMULA > CONCEPT 순서 100% 준수            |
| HSP-T04   | 응답 시간          | 3-Stage 전체 응답 500ms 이내                      |
| HSP-T05   | 출처 보존          | 모든 결과에 page_ref 또는 revision_change_id 포함 |

#### Hard Rule 신설

> **Hard Rule 15**: 모든 RAG 검색은 3-Stage Hybrid Search 의무. Vectorize 단독 결과 사용 금지.

---

### 🔴 결함 D: Human-in-the-Loop 한계 + 결함 G: Cross-BATCH 자동 검증 (P0 Critical)

> **사용자의 최종 질문이 핵심:** "Claude Code가 스스로 생성한 JSON 산출물이 기존에 적재된 다른 BATCH의 Graph 노드들과 논리적으로 충돌하지 않는지, 시스템적(자동화된)으로 교차 검증할 수 있는 장치는 어떻게 구체화할 계획이십니까?"

본 결함은 본 문서의 핵심이므로 별도 섹션 처리.

#### CoT 검증

**BREAKER의 분석 (100% 동의):**
현 Validation Framework (Level 1~3) 는 **단일 BATCH 내부 검증**에 집중. BATCH 간 회귀는 진산님의 수기 검수에 의존 — 14 BATCH × 6 Layer 누적 시 인간이 모든 cross-reference 추적 불가능. **이는 시스템적 결함이며, BATCH-5 적재가 BATCH-1 의 논리를 깰 가능성을 차단할 메커니즘 부재.**

**ARCHITECT의 분석:**
필요한 것은 **CBIV (Cross-Batch Integrity Validator)** — 신규 BATCH 적재 시 "이전 모든 BATCH 와의 정합성" 을 자동 검증하는 모듈. 이는 4번째 코어 모듈 (현 Loader) 와는 별개의 **5번째 코어 모듈** 로 위치시킨다.

**HACKER의 구현 분석:**
~500-700 줄. 5단계 자동 검증 + 1단계 의미 중복 (인간 결정). 기존 graph-integrity 와 일부 중복되지만 범위가 다름 (cross-BATCH).

**MEPHISTO의 우선순위 결정:**
**BATCH-1 dry-run 진입 전 CBIV 모듈 v0.1 완성 필수.** BATCH-2 진입 전에 CBIV 가 BATCH-1 의 모든 Golden Test 를 회귀 실행 가능해야 함.

#### 재설계 사양: CBIV (Cross-Batch Integrity Validator)

##### 5+1 단계 자동 검증

```
신규 BATCH-N JSON 산출물 (Stage 6 통과)
    ↓
┌─────────────────────────────────────────────────────────────┐
│ CBIV Stage 1: 참조 무결성 검증                              │
│ (Referential Integrity)                                     │
│                                                             │
│ ✓ 신규 엣지의 from_node, to_node 가 D1 또는 신규 JSON 에     │
│   실제 존재                                                 │
│ ✓ 참조하는 LAW-NNN, F-NN, CONST-NNN 모두 approved 상태       │
│ ✓ exam_id 일치 (멀티시험 격리)                              │
│                                                             │
│ 도구: SQL JOIN + LEFT JOIN NULL 체크                        │
│ 자동화: 100%                                                │
│ 실패 시: BATCH-N 적재 차단                                  │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ CBIV Stage 2: 의미 중복 검증                                │
│ (Semantic Deduplication)                                    │
│                                                             │
│ ✓ 신규 노드 임베딩 vs 기존 노드 임베딩 코사인 유사도          │
│ ✓ 임계값 0.85 초과 시 → "잠재적 중복" flag                  │
│ ✓ flag 된 항목 → 진산님 검수 큐 자동 기록                    │
│                                                             │
│ 도구: Vectorize 사전 적재 + similarity search               │
│ 자동화: 100% 감지, 병합/유지 결정은 인간                    │
│ 실패 시: 자동 차단 아님 (진산님 결정 대기)                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ CBIV Stage 3: 상수 일관성 검증                              │
│ (Constants Coherence)                                       │
│                                                             │
│ ✓ 같은 name + 겹치는 valid_from~valid_to 구간에             │
│   numeric_value 다른 상수 0건                                │
│ ✓ 같은 산식 family 에서 변수 정의 충돌 0건                   │
│ ✓ unit 단위 일관성 (% vs ratio 혼용 차단)                    │
│                                                             │
│ 도구: GROUP BY name + HAVING COUNT(DISTINCT value) > 1       │
│ 자동화: 100%                                                │
│ 실패 시: BATCH-N 적재 차단 + 충돌 리포트 생성                │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ CBIV Stage 4: SUPERSEDES 체인 무결성                        │
│ (Temporal Graph Integrity)                                  │
│                                                             │
│ ✓ DFS 순환 감지 (A SUPERSEDES B SUPERSEDES A 차단)          │
│ ✓ 신규 BATCH 가 기존 SUPERSEDES 체인을 깨지 않는지           │
│ ✓ 모든 SUPERSEDES 엣지에 revision_change_id 존재             │
│ ✓ valid_from 단조 증가 (구→신 순서)                         │
│                                                             │
│ 도구: 그래프 알고리즘 (DFS) + revision_changes 외래키        │
│ 자동화: 100%                                                │
│ 실패 시: BATCH-N 적재 차단                                  │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ CBIV Stage 5: 회귀 Golden Test 재실행 (가장 중요)            │
│ (Regression Golden Test)                                    │
│                                                             │
│ ✓ BATCH-1 ~ BATCH-(N-1) 의 모든 Golden Test 를 D1 (BATCH-N   │
│   추가된 가상 환경) 에서 재실행                              │
│ ✓ 각 Golden Test 가 적재된 노드/산식만으로 정답 도출         │
│   → 일치율 100%                                              │
│ ✓ 1건이라도 fail → BATCH-N 적재 차단                         │
│ ✓ fail 원인 자동 분석 → "BATCH-N 의 어떤 노드가 어떤 BATCH   │
│   의 Golden 을 깼는지" 리포트                                │
│                                                             │
│ 도구: 자동화된 Golden Test runner (TDD 기반)                 │
│ 자동화: 100% (BATCH-1~N-1 의 모든 Golden 자동 재실행)        │
│ 실패 시: BATCH-N 적재 차단 + 회귀 원인 리포트 + 진산님 알림  │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ CBIV Stage 6: 출제영역 정합성 검증 (보조)                    │
│ (Exam Scope Alignment)                                      │
│                                                             │
│ ✓ 신규 노드의 exam_scope 메타가 BATCH 정의된 영역과 일치     │
│ ✓ BATCH-1 적재가 BATCH-3 영역 노드를 만들지 않음             │
│ ✓ "이 노드는 BATCH-N 영역에 속하는가?" 자동 분류 검증         │
│                                                             │
│ 도구: exam_scope 메타데이터 매칭                            │
│ 자동화: 100%                                                │
│ 실패 시: 경고 + 진산님 검수 (차단은 아님 — Cross-BATCH       │
│         REFERENCES 가능성)                                   │
└─────────────────────────────────────────────────────────────┘
    ↓
[CBIV 통과 시] → Stage 8 D1 INSERT 진행
[CBIV 실패 시] → 자동 차단 + 정정 후 재검증
```

##### Stage 5 (회귀 Golden Test) 상세 메커니즘

```typescript
// packages/cbiv/src/regression-runner.ts

export async function runRegressionGoldenTests(
  newBatchData: BatchData,
  prevBatches: number[], // [1, 2, 3, ...]
): Promise<RegressionResult> {
  // 1. 가상 D1 환경 생성 (in-memory)
  const virtualDb = await createVirtualDb();

  // 2. 기존 BATCH-1 ~ BATCH-(N-1) 데이터 적재
  for (const batchNum of prevBatches) {
    const prevBatch = await loadBatchFromD1(batchNum);
    await virtualDb.insert(prevBatch);
  }

  // 3. 신규 BATCH-N 데이터 가상 적재
  await virtualDb.insert(newBatchData);

  // 4. 모든 BATCH 의 Golden Test 자동 실행
  const failures: GoldenTestFailure[] = [];
  for (const batchNum of [...prevBatches, newBatchData.batchNumber]) {
    const goldenTests = await loadGoldenTests(batchNum);

    for (const test of goldenTests) {
      const result = await executeGoldenTest(virtualDb, test);
      if (result.expected !== result.actual) {
        failures.push({
          batchNumber: batchNum,
          testId: test.id,
          expected: result.expected,
          actual: result.actual,
          rootCause: await analyzeRootCause(test, newBatchData),
        });
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    matchRate: 1 - failures.length / totalTests,
  };
}
```

##### Golden Test 영구 보존 정책

```
docs/measurements/golden-tests/
├── batch-1-golden.json    # BATCH-1 의 Golden Test 영구 보존
├── batch-2-golden.json
├── ...
├── batch-N-golden.json
└── _registry.json         # 메타 (총 개수, 마지막 업데이트, 통과율)
```

> **Hard Rule 21**: 모든 BATCH 의 Golden Test 는 영구 보존 + CI/CD 매 배치 적재 시 100% 자동 재실행. Golden Test 삭제는 진산님 명시 승인 후에만.

#### CBIV 모듈 코드 구조

```
packages/cbiv/                       # 신규 패키지
├── src/
│   ├── index.ts                     # 메인 진입점
│   ├── stages/
│   │   ├── 1-referential.ts         # Stage 1: 참조 무결성
│   │   ├── 2-deduplication.ts       # Stage 2: 의미 중복
│   │   ├── 3-coherence.ts           # Stage 3: 상수 일관성
│   │   ├── 4-supersedes.ts          # Stage 4: SUPERSEDES 체인
│   │   ├── 5-regression.ts          # Stage 5: 회귀 Golden Test (핵심)
│   │   └── 6-scope.ts               # Stage 6: 출제영역
│   ├── runner/
│   │   ├── virtual-db.ts            # in-memory D1 시뮬레이터
│   │   ├── golden-test-runner.ts    # Golden Test 자동 실행
│   │   └── root-cause-analyzer.ts   # 실패 원인 자동 분석
│   ├── reports/
│   │   ├── conflict-report.ts       # 충돌 리포트 생성
│   │   └── regression-report.ts     # 회귀 리포트 생성
│   └── types.ts
├── tests/
│   ├── stages/
│   └── e2e/
│       └── batch-load-cbiv.test.ts  # E2E 테스트
└── package.json
```

#### 테스트 기준 (CBIV 자체)

| 테스트 ID | 항목               | 통과 기준                                                   |
| --------- | ------------------ | ----------------------------------------------------------- |
| CBIV-T01  | Stage 1 정확성     | 의도적 깨진 참조 10건 주입 → 100% 차단                      |
| CBIV-T02  | Stage 2 정확성     | 의도적 중복 노드 5건 주입 → 100% flag                       |
| CBIV-T03  | Stage 3 정확성     | 의도적 상수 충돌 5건 주입 → 100% 감지                       |
| CBIV-T04  | Stage 4 정확성     | 의도적 순환 SUPERSEDES 주입 → 100% 차단                     |
| CBIV-T05  | **Stage 5 정확성** | **BATCH-N+1 추가 시 BATCH-N Golden 100% 재실행 + 회귀 0건** |
| CBIV-T06  | 응답 시간          | BATCH 적재 검증 전체 30초 이내 (회귀 Golden 포함)           |
| CBIV-T07  | 리포트 가독성      | 실패 시 "어떤 노드가 어떤 Golden 을 깼는가" 명확히 표시     |

#### Hard Rule 신설

> **Hard Rule 17**: 신규 BATCH 적재는 CBIV 6단계 통과 후에만 D1 INSERT 진행. 1건이라도 차단 단계 실패 시 즉시 중단.
>
> **Hard Rule 21**: Golden Test 영구 보존 + CI/CD 자동 재실행 (위 참조).

---

### 🟠 결함 E: 오프라인 동기화 단순성 (FSRS LWW)

#### 비판 요지

> "최근 타임스탬프 우선 (LWW) 정책은 학습 진행도 (FSRS) 에 부적합. stability/interval 등 학습 이력 영구 유실 → 학습 스케줄 망가짐. CRDT 또는 병합 로직 필요."

#### CoT 검증

**HACKER의 분석 (85% 동의):**
비판자 옳다. 단, **CRDT 는 과도한 솔루션**. FSRS 학습 데이터는 **append-only 이벤트 스트림** 으로 모델링 가능 — 이는 단순한 Event Sourcing 으로 해결.

**GHOST의 분석:**

- LWW (Last-Write-Wins): 모바일 + 태블릿 동기화 시 모바일의 최신 학습이 태블릿의 더 오래된 학습 데이터로 덮어쓰일 위험 (0%)... 잠깐, 반대다. 태블릿 (오래된 timestamp) 이 모바일 (최신) 을 덮어쓰지는 않음.
- **실제 문제**: 모바일에서 카드 A 학습 (오프라인) → 태블릿에서 카드 A 학습 (온라인 즉시 sync) → 모바일 온라인 → 모바일의 카드 A 데이터가 태블릿의 신규 데이터를 덮어쓰림 (모바일 timestamp 가 더 늦으므로) → 태블릿 학습 사라짐
- 이것이 비판자가 말한 시나리오. LWW 의 본질적 결함

**ADVOCATE의 영향 평가:**
사용자가 학습한 이력이 사라지면 = **신뢰 즉사**. FSRS interval 계산 망가짐 → 같은 카드 반복 출현 → "왜 또?" → 이탈.

#### 재설계 사양: Event Sourcing for FSRS

##### 데이터 모델 변경

```sql
-- 기존 (LWW):
-- user_progress (user_id, card_id, fsrs_state JSON, updated_at)
-- 마지막 updated_at 이 이김 → 데이터 손실

-- 신규 (Event Sourcing):
CREATE TABLE user_review_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'review' / 'reset' / 'lapse'
  rating TEXT NOT NULL,       -- 'again' / 'hard' / 'good' / 'easy'
  device_id TEXT NOT NULL,    -- 동기화 추적
  client_ts INTEGER NOT NULL, -- 클라이언트 시점 (충돌 식별용)
  server_ts INTEGER NOT NULL, -- 서버 수신 시점
  fsrs_state_before JSON NOT NULL,
  fsrs_state_after JSON NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- INDEX: 사용자 + 카드 + 시간순
CREATE INDEX idx_review_events_user_card
  ON user_review_events (user_id, card_id, client_ts);

-- 현재 상태 캐시 (조회 성능)
CREATE TABLE user_card_state (
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  current_fsrs_state JSON NOT NULL,
  last_event_id TEXT NOT NULL,
  PRIMARY KEY (user_id, card_id)
);
```

##### 동기화 로직

```typescript
// packages/learning/src/sync/event-sync.ts

export async function syncUserEvents(
  userId: string,
  pendingEvents: ReviewEvent[],
): Promise<SyncResult> {
  // 1. 모든 이벤트 append (idempotency 보장 — id 기반 UNIQUE)
  for (const event of pendingEvents) {
    await db.insert(userReviewEvents).values(event).onConflictDoNothing();
  }

  // 2. 영향받은 카드 추출
  const affectedCardIds = [...new Set(pendingEvents.map((e) => e.cardId))];

  // 3. 각 카드의 모든 이벤트를 client_ts 순서로 재생 → 최종 FSRS 상태 재계산
  for (const cardId of affectedCardIds) {
    const allEvents = await db
      .select()
      .from(userReviewEvents)
      .where(and(eq(userReviewEvents.userId, userId), eq(userReviewEvents.cardId, cardId)))
      .orderBy(asc(userReviewEvents.clientTs));

    // FSRS 재계산 (멱등 — 같은 이벤트 시퀀스 = 같은 결과)
    const finalState = replayFsrsEvents(allEvents);

    // 캐시 갱신
    await db
      .insert(userCardState)
      .values({ userId, cardId, currentFsrsState: finalState })
      .onConflictDoUpdate({
        /* ... */
      });
  }

  return { synced: pendingEvents.length, affectedCards: affectedCardIds.length };
}
```

##### 충돌 시나리오 (재설계 후)

```
모바일: 09:00 카드A 학습 (offline) → 09:30 sync (server_ts=09:30, client_ts=09:00)
태블릿: 09:15 카드A 학습 (online)  → 09:15 sync (server_ts=09:15, client_ts=09:15)
모바일: 09:30 sync 도착

[Event Sourcing 처리]
1. 두 이벤트 모두 append (UNIQUE id 보장)
2. 카드A 의 모든 이벤트를 client_ts 순서로 재생:
   - 09:00 (모바일) → FSRS state_1
   - 09:15 (태블릿) → state_1 → FSRS state_2
3. 최종 상태 = state_2 (모바일 09:30 sync 가 09:00 학습이지만 client_ts 가 09:00 → 먼저 적용)
4. 두 학습 모두 보존, 순서대로 합리적 FSRS 진행
```

##### 진산님 비전 정합성

진산님 메모리 `project_source_citation_requirement.md` + Hard Rule (UPDATE 금지) 와 정합 — Event Sourcing 은 본질적으로 append-only.

#### 코드 위치

```
modules/learning/
├── domain/
│   ├── review-event.ts              # Event 도메인 모델 (DDD)
│   └── fsrs-replay.ts               # 이벤트 재생 로직
├── application/
│   └── sync-service.ts              # syncUserEvents
└── infrastructure/
    └── event-store.ts                # D1 + 캐시 통합

migrations/
├── 0016_user_review_events.sql       # 신규 테이블
└── 0017_user_card_state.sql          # 캐시 테이블
```

#### 테스트 기준

| 테스트 ID | 항목                 | 통과 기준                                      |
| --------- | -------------------- | ---------------------------------------------- |
| ESF-T01   | 멀티 디바이스 동기화 | 모바일 + 태블릿 충돌 시 두 학습 모두 보존      |
| ESF-T02   | FSRS 멱등성          | 같은 이벤트 시퀀스 → 같은 최종 상태 (3회 검증) |
| ESF-T03   | 오프라인 50건 동기화 | 50건 사후 sync → FSRS state 정합 100%          |
| ESF-T04   | 이벤트 중복 차단     | 같은 id 의 이벤트 재전송 시 1건만 저장         |
| ESF-T05   | 응답 시간            | 50건 sync 완료 2초 이내                        |

#### Hard Rule 신설

> **Hard Rule 19**: FSRS 사용자 학습 데이터는 Event Sourcing 으로 관리. LWW 패턴 사용 금지.

---

### 🟡 결함 F: 멀티시험 사일로 효과 (Year 2 진입 시 처리)

#### 비판 요지

> "공인중개사 + 감정평가사가 민법을 공유. 동일 데이터 중복 적재는 '단일 진실 원천' 비전 위반. Common Foundation 계층 + REFERENCES 교차 참조 구조 필요."

#### CoT 검증

**ORACLE의 분석 (Year 2 한정 90% 동의):**
Year 1 (손해평가사 단독) 시점에는 본 결함 미발생. Year 2 진입 시 비판자 100% 옳음. 농어업재해보험법은 손해평가사 전용 → 다른 시험과 공유 안 됨. 그러나 Year 2 에 공인중개사 (민법 공유) 추가 시 동일 데이터 중복 = 자체 비전 위반.

**ARCHITECT의 분석:**
**핵심**: 지금 (Year 1) 부터 네임스페이스 예약. 본격 구현은 Year 2. 이는 사이즈가 작은 사전 결정 (5분 작업) 으로 큰 비용 (재구조화) 회피.

**MEPHISTO의 우선순위:**

- Year 1: `packages/exams/_common/` 디렉토리 + README.md 만 생성 (placeholder)
- Year 2: 실제 민법 등 적재 시 본격 구현

#### 재설계 사양: 3-tier Package Structure (Year 2 본격)

```
packages/
├── content-build-engine/        ← 공통 코어 (변경 0)
│
├── exams/
│   ├── _common/                 ← Year 1 예약, Year 2 본격
│   │   ├── README.md            # "이 디렉토리는 다중 자격증 공유 도메인 전용"
│   │   ├── manual/
│   │   │   ├── civil-law/       # 민법 (Year 2)
│   │   │   ├── commercial-law/  # 상법 (Year 2 — 손해평가사도 일부 공유)
│   │   │   └── ...
│   │   ├── domain-types.ts      # CIVIL-LAW-NNN, COMMON-LAW-NNN 패턴
│   │   ├── ontology-extension.json
│   │   └── exam-metadata.ts     # exam_id = '_common'
│   │
│   ├── son-hae-pyeong-ga-sa/    ← Year 1 instance
│   │   ├── manual/
│   │   ├── domain-types.ts
│   │   ├── ontology-extension.json  # _common 참조 가능
│   │   └── exam-metadata.ts
│   │
│   └── gong-in-jung-gae-sa/     ← Year 2 추가
│       └── (민법은 _common.civil-law REFERENCES 로 참조)
```

##### 교차 참조 메커니즘

```typescript
// 손해평가사 노드가 _common.civil-law 참조
{
  "id": "INS-01",
  "name": "보험계약의 성립",
  "exam_id": "son-hae-pyeong-ga-sa",
  "edges": [
    {
      "to_node": "CIVIL-LAW-001",  // _common 의 노드
      "to_exam_id": "_common",      // 명시적 cross-domain
      "relation": "REFERENCES"
    }
  ]
}
```

##### 격리 정책 보존

학습자가 손해평가사 학습 시 → 메인 도메인 + 명시적 REFERENCES 만 노출. \_common 의 다른 자격증 전용 노드는 비노출.

#### 코드 위치 (Year 1 예약, Year 2 구현)

```
packages/exams/_common/
└── README.md  ← Year 1 에는 이 파일만 (placeholder)
```

```markdown
# Common Foundation (Reserved)

> **현 상태:** 예약 (Year 1)
> **본격 구현:** Year 2 (멀티시험 진입 시)

이 디렉토리는 여러 자격증이 공유하는 도메인 전용입니다 (예: 민법, 상법).

Year 1 (손해평가사 단독) 에서는 이 디렉토리에 데이터 적재 금지.
Year 2 진입 시 ADR-016 에 따라 본격 활용.
```

#### Hard Rule 신설

> **Hard Rule 20**: `packages/exams/_common/` 네임스페이스 예약. Year 1 에는 placeholder 만, Year 2 에 본격 활용 (ADR-016 참조).

---

## 3. BATCH Load Protocol 8단계 → 10단계 개정

기존 [BATCH_LOAD_PROTOCOL.md](./BATCH_LOAD_PROTOCOL.md) 를 다음과 같이 개정:

```
[Stage 1] 다음 ☐ BATCH 식별                    (기존 유지)
[Stage 2] PDF 추출                              (기존 유지)
[Stage 3] 도메인 분석 (Opus 4.7 직접)            (기존 유지)
[Stage 4] Level 1 (표면) 검증                    (기존 유지)
[Stage 5] Level 2 (내용) 검증                    (기존 유지)
[Stage 6] Level 3 (학습 효과) 역검증              (기존 유지)
[Stage 6.5] CBIV 6단계 자동 검증 (NEW)            ← 결함 D, G 대응
[Stage 7] 진산님 검수 요청                       (기존 유지)
[Stage 7.5] 의미 중복 인간 결정 (NEW, CBIV Stage 2 결과) ← 결함 G 대응
[Stage 8] D1 INSERT                              (기존 유지)
[Stage 9] 핸드오프 + 로드맵 갱신                  (기존 유지)
[Stage 10] Golden Test 영구 보존 + CI/CD 등록 (NEW) ← 결함 D, G 대응
```

### Stage 6.5 (CBIV) 작동 흐름

```
Level 1~3 통과한 JSON 산출물
    ↓
[Stage 6.5: CBIV 6단계 검증]
    ├─ Stage 1: 참조 무결성 ✓/✗
    ├─ Stage 2: 의미 중복 (flag → Stage 7.5)
    ├─ Stage 3: 상수 일관성 ✓/✗
    ├─ Stage 4: SUPERSEDES 체인 ✓/✗
    ├─ Stage 5: 회귀 Golden Test ✓/✗ (핵심)
    └─ Stage 6: 출제영역 정합성 ✓/⚠️

[Stage 7] 진산님 검수
    ├─ Level 1~3 결과
    └─ CBIV 결과 + 의미 중복 flag 결정
```

### Stage 10 (Golden Test 영구 보존) 작동 흐름

```
[Stage 10]
    ├─ 본 BATCH 의 Golden Test 추출
    │   docs/measurements/golden-tests/batch-N-golden.json
    ├─ _registry.json 갱신 (총 개수, 통과율)
    ├─ CI/CD 파이프라인 등록 (GitHub Actions)
    │   - matrix: BATCH-1, ..., BATCH-N
    │   - 매 PR 시 회귀 자동 실행
    └─ 핸드오프 (Stage 9) 에 Golden 위치 기록
```

---

## 4. Hard Rules 통합 (15~21번 신설)

기존 14개 Hard Rule 에 7개 추가:

| #   | 규칙                                                         | 출처      | 적용 위치        |
| --- | ------------------------------------------------------------ | --------- | ---------------- |
| 15  | 모든 RAG 검색은 3-Stage Hybrid Search 의무                   | 결함 C    | 운영 RAG         |
| 16  | 모든 운영 RAG 쿼리는 `is_current_active=1` 필터 의무         | 결함 B    | 운영 RAG         |
| 17  | 신규 BATCH 적재는 CBIV 6단계 통과 후에만 D1 INSERT           | 결함 D, G | BATCH 파이프라인 |
| 18  | 유사도 < 0.60 시 Multi-Path Fallback 의무 (단일 안내문 금지) | 결함 A    | 운영 RAG         |
| 19  | FSRS 사용자 학습 데이터는 Event Sourcing                     | 결함 E    | 학습 동기화      |
| 20  | `packages/exams/_common/` 네임스페이스 예약                  | 결함 F    | Year 2 준비      |
| 21  | Golden Test 영구 보존 + CI/CD 자동 재실행                    | 결함 D, G | CI/CD            |

---

## 5. ADR 신규 작성 목록 (5건)

[EPIC_DOCUMENTATION_GUIDE.md](./EPIC_DOCUMENTATION_GUIDE.md) 의 ADR 템플릿에 따라:

| ADR     | 제목                                                   | 상태    | 우선순위 |
| ------- | ------------------------------------------------------ | ------- | -------- |
| ADR-012 | Hybrid Search Pipeline (Vector → Graph → Truth Weight) | 🔄 제안 | P0       |
| ADR-013 | Materialized Active View on D1 (트리거 + KV 캐시)      | 🔄 제안 | P0       |
| ADR-014 | Cross-Batch Integrity Validator (CBIV)                 | 🔄 제안 | P0       |
| ADR-015 | Multi-Path Fallback Pipeline                           | 🔄 제안 | P1       |
| ADR-016 | Event Sourcing for FSRS Sync                           | 🔄 제안 | P1       |
| ADR-017 | Multi-Exam Common Foundation (Year 2 reserved)         | 🔄 제안 | P2       |

---

## 6. Phase / Epic / Story / Task 매핑

[TASK_HIERARCHY_EXPLAINED.md](./TASK_HIERARCHY_EXPLAINED.md) 의 4단계 구조에 따라 본 재정립안의 작업을 분해:

### Phase 1 진입 전 (BATCH-1 dry-run 직전, 추가 작업)

```
🌍 PHASE 1 (기존)
   │
   ├── 🏔️ Epic CBE-R1: Materialized Active View 구축 (P0)
   │   ├── 📖 Story R1.1: D1 마이그레이션 0014/0015 작성
   │   │   ├── ✅ Task R1.1.1: [TEST] active 컬럼 추가 마이그레이션 단위 테스트 (10분)
   │   │   ├── ✅ Task R1.1.2: [IMPL] migrations/0014_add_active_columns.sql (15분)
   │   │   ├── ✅ Task R1.1.3: [TEST] SUPERSEDES 트리거 테스트 (15분)
   │   │   ├── ✅ Task R1.1.4: [IMPL] migrations/0015_supersedes_trigger.sql (20분)
   │   │   └── ✅ Task R1.1.5: [VERIFY] 기존 BATCH-0 데이터 회귀 영향 0건 확인 (15분)
   │   ├── 📖 Story R1.2: searchActiveNodes 함수 구현
   │   │   ├── ✅ Task R1.2.1: [TEST] active 노드 조회 테스트 (10분)
   │   │   ├── ✅ Task R1.2.2: [IMPL] searchActiveNodes (15분)
   │   │   └── ✅ Task R1.2.3: [REFACTOR] truth-weight 정렬 통합 (15분)
   │   └── 📖 Story R1.3: KV 캐시 (Phase 3 이월 — 운영 RAG 진입 시)
   │
   ├── 🏔️ Epic CBE-R2: Hybrid Search Pipeline (P0)
   │   ├── 📖 Story R2.1: 3-Stage Pipeline 골격
   │   │   ├── ✅ Task R2.1.1: [TEST] vector-recall 단위 테스트 (15분)
   │   │   ├── ✅ Task R2.1.2: [IMPL] vector-recall.ts (20분)
   │   │   ├── ✅ Task R2.1.3: [TEST] graph-filter 테스트 (15분)
   │   │   ├── ✅ Task R2.1.4: [IMPL] graph-filter.ts (20분)
   │   │   ├── ✅ Task R2.1.5: [TEST] truth-rerank 테스트 (15분)
   │   │   ├── ✅ Task R2.1.6: [IMPL] truth-rerank.ts (15분)
   │   │   └── ✅ Task R2.1.7: [VERIFY] HSP-T02 (26년 개정 시나리오) E2E (20분)
   │   └── 📖 Story R2.2: 통합 pipeline 오케스트레이션
   │       ├── ✅ Task R2.2.1: [TEST] pipeline E2E 테스트 (15분)
   │       ├── ✅ Task R2.2.2: [IMPL] pipeline.ts (20분)
   │       └── ✅ Task R2.2.3: [VERIFY] 응답 시간 500ms 이내 (15분)
   │
   ├── 🏔️ Epic CBE-R3: CBIV (Cross-Batch Integrity Validator) — 핵심 (P0)
   │   ├── 📖 Story R3.1: 패키지 설정 + 가상 D1
   │   │   ├── ✅ Task R3.1.1: [SETUP] packages/cbiv 패키지 초기화 (15분)
   │   │   ├── ✅ Task R3.1.2: [TEST] virtual-db 단위 테스트 (15분)
   │   │   └── ✅ Task R3.1.3: [IMPL] virtual-db.ts (20분)
   │   ├── 📖 Story R3.2: Stage 1 (참조 무결성)
   │   │   ├── ✅ Task R3.2.1: [TEST] 깨진 참조 10건 차단 테스트 (15분)
   │   │   └── ✅ Task R3.2.2: [IMPL] 1-referential.ts (20분)
   │   ├── 📖 Story R3.3: Stage 2 (의미 중복)
   │   │   ├── ✅ Task R3.3.1: [TEST] 중복 5건 flag 테스트 (15분)
   │   │   └── ✅ Task R3.3.2: [IMPL] 2-deduplication.ts (20분)
   │   ├── 📖 Story R3.4: Stage 3 (상수 일관성)
   │   │   ├── ✅ Task R3.4.1: [TEST] 상수 충돌 5건 감지 테스트 (15분)
   │   │   └── ✅ Task R3.4.2: [IMPL] 3-coherence.ts (15분)
   │   ├── 📖 Story R3.5: Stage 4 (SUPERSEDES 체인)
   │   │   ├── ✅ Task R3.5.1: [TEST] 순환 SUPERSEDES 차단 테스트 (15분)
   │   │   └── ✅ Task R3.5.2: [IMPL] 4-supersedes.ts (20분)
   │   ├── 📖 Story R3.6: Stage 5 (회귀 Golden Test) — 핵심
   │   │   ├── ✅ Task R3.6.1: [TEST] golden-test-runner 단위 테스트 (20분)
   │   │   ├── ✅ Task R3.6.2: [IMPL] golden-test-runner.ts (25분)
   │   │   ├── ✅ Task R3.6.3: [TEST] root-cause-analyzer 테스트 (15분)
   │   │   ├── ✅ Task R3.6.4: [IMPL] root-cause-analyzer.ts (25분)
   │   │   └── ✅ Task R3.6.5: [VERIFY] BATCH-1 → BATCH-2 회귀 시뮬레이션 (20분)
   │   ├── 📖 Story R3.7: Stage 6 (출제영역) + 통합
   │   │   ├── ✅ Task R3.7.1: [TEST] exam_scope 정합성 테스트 (15분)
   │   │   ├── ✅ Task R3.7.2: [IMPL] 6-scope.ts (15분)
   │   │   └── ✅ Task R3.7.3: [REFACTOR] 6단계 통합 오케스트레이션 (20분)
   │   └── 📖 Story R3.8: 리포트 생성기
   │       ├── ✅ Task R3.8.1: [TEST] conflict-report 가독성 테스트 (15분)
   │       ├── ✅ Task R3.8.2: [IMPL] conflict-report.ts (20분)
   │       └── ✅ Task R3.8.3: [IMPL] regression-report.ts (20분)
   │
   ├── 🏔️ Epic CBE-R4: Multi-Path Fallback (P1)
   │   ├── 📖 Story R4.1: 형태소 분석기 통합
   │   │   ├── ✅ Task R4.1.1: [SETUP] kkma 또는 khaiii Workers 호환 검토 (POC, 30분)
   │   │   ├── ✅ Task R4.1.2: [TEST] 한국어 형태소 추출 테스트 (15분)
   │   │   └── ✅ Task R4.1.3: [IMPL] keyword-extractor.ts (20분)
   │   ├── 📖 Story R4.2: 4단계 폴백 구현
   │   │   ├── ✅ Task R4.2.1: [IMPL] keyword-fallback.ts (20분)
   │   │   ├── ✅ Task R4.2.2: [IMPL] topic-cluster-router.ts (20분)
   │   │   ├── ✅ Task R4.2.3: [IMPL] honest-refusal.ts (15분)
   │   │   └── ✅ Task R4.2.4: [IMPL] pipeline.ts 통합 (20분)
   │   └── 📖 Story R4.3: 검수 큐 자동 기록
   │       ├── ✅ Task R4.3.1: [TEST] 거부 질문 큐 적재 테스트 (10분)
   │       └── ✅ Task R4.3.2: [IMPL] refusal-queue.ts (15분)
   │
   ├── 🏔️ Epic CBE-R5: Event Sourcing for FSRS (P1, Phase 2)
   │   ├── 📖 Story R5.1: 마이그레이션 + 데이터 모델
   │   ├── 📖 Story R5.2: syncUserEvents 구현
   │   └── 📖 Story R5.3: FSRS replay 멱등성 검증
   │
   └── 🏔️ Epic CBE-R6: Common Foundation Reserved (P2)
       └── 📖 Story R6.1: packages/exams/_common/ placeholder
           └── ✅ Task R6.1.1: [SETUP] 디렉토리 + README.md (5분)
```

### 시간 추정 합계

| Epic                              | 예상 시간   | 우선순위           |
| --------------------------------- | ----------- | ------------------ |
| CBE-R1 (Materialized Active View) | ~2.5시간    | P0                 |
| CBE-R2 (Hybrid Search Pipeline)   | ~2.5시간    | P0                 |
| CBE-R3 (CBIV)                     | ~6시간      | P0 (핵심)          |
| CBE-R4 (Multi-Path Fallback)      | ~2.5시간    | P1                 |
| CBE-R5 (Event Sourcing FSRS)      | ~3시간      | P1 (Phase 2)       |
| CBE-R6 (\_common 예약)            | ~5분        | P2                 |
| **소계 (P0 만)**                  | **~11시간** | BATCH-1 dry-run 전 |

---

## 7. 횡단 관심사 (TDD / I18N / DDD / Debugging / Design)

### 7.1 TDD 적용

[CLAUDE.md v2.1](./CLAUDE_md_v2_1_jjokjipge.md) 의 TDD 원칙 준수:

```
모든 R1~R6 Task 는 RED → GREEN → REFACTOR 사이클 엄수
- [TEST] Task 는 무조건 [IMPL] Task 보다 먼저
- 20분 초과 Task 는 즉시 분할
- 테스트 커버리지: 도메인 로직 90%+, 인프라 80%+
```

특히 CBIV Stage 5 (회귀 Golden Test) 는 **TDD 의 메타 적용** — Golden Test 자체가 TDD 의 산출물이며, 그것을 자동 재실행하는 시스템이 CBIV.

### 7.2 I18N

본 재정립안은 백엔드 코어 위주이므로 I18N 직접 영향 미미. 다만:

- **에러 메시지** (CBIV 충돌 리포트, refusal 등) → `packages/shared/src/i18n/` 활용
- **Multi-Path Fallback Stage 4 (Honest Refusal)** 의 안내 문구 → I18N 키 사용

```typescript
// 예시
import { t } from '@/shared/i18n';

return {
  status: 'refused',
  message: t('search.refusal.out_of_scope', { exam: examId }),
};
```

### 7.3 DDD (Domain-Driven Design)

[CLAUDE.md v2.1](./CLAUDE_md_v2_1_jjokjipge.md) 의 hexagonal architecture 준수:

```
modules/
├── content/
│   ├── domain/                  # 도메인 모델
│   │   ├── knowledge-node.ts
│   │   ├── temporal-graph.ts    # 결함 B 핵심
│   │   └── source-citation.ts
│   ├── application/             # 유스케이스
│   │   ├── search-pipeline.ts   # 결함 C
│   │   └── batch-loader.ts
│   └── infrastructure/          # 외부 의존성
│       ├── d1-repository.ts
│       └── vectorize-client.ts
│
├── learning/
│   ├── domain/
│   │   └── review-event.ts      # 결함 E 핵심
│   ├── application/
│   │   └── sync-service.ts
│   └── infrastructure/
│       └── event-store.ts
│
└── exam/                        # (Year 2 멀티시험 격리)
```

CBIV 는 별도 패키지 (`packages/cbiv/`) — 도메인 횡단이므로 모듈 구조 외부.

### 7.4 디버깅

각 결함의 디버깅 가이드 [docs/troubleshooting/](./docs/troubleshooting/) 에 신설:

```
docs/troubleshooting/
├── KNOWN_ISSUES.md              # 기존
├── DEBUG_GUIDE.md               # 기존
├── HYBRID_SEARCH_DEBUG.md       # 신규 (결함 C)
├── CBIV_FAILURE_DEBUG.md        # 신규 (결함 D, G)
├── EVENT_SOURCING_DEBUG.md      # 신규 (결함 E)
└── ACTIVE_VIEW_DEBUG.md         # 신규 (결함 B)
```

각 가이드는 다음 구조:

1. 증상 (어떤 에러/문제가 보이는가)
2. 원인 (왜 발생하는가)
3. 즉시 진단 (5분 이내 체크할 수 있는 것들)
4. 해결 (스크립트 / SQL 쿼리)
5. 예방 (재발 방지 테스트)

### 7.5 디자인 (검수 UI)

[ADMIN_ARCHITECTURE_SUPPLEMENT.md](./ADMIN_ARCHITECTURE_SUPPLEMENT.md) 의 admin-web 에 UI 추가:

```
apps/admin-web/src/pages/
├── content/
│   ├── graph.astro                   # 기존 Graph Visualizer
│   ├── cbiv-results.astro            # 신규: CBIV 결과 + 회귀 리포트
│   └── deduplication-queue.astro     # 신규: 의미 중복 검수 큐
└── system/
    └── golden-tests.astro            # 신규: Golden Test 영구 보존 모니터
```

---

## 8. 예상 부작용 + 트레이드오프 (정직한 평가)

DEV COVEN 합의로 본 재정립안의 비용도 명시:

### 8.1 비용 증가

| 항목                            | 비용                   | 정당화                                                 |
| ------------------------------- | ---------------------- | ------------------------------------------------------ |
| CBIV 모듈 신설                  | ~600 LOC               | BATCH 누적 시 회귀 자동화 — 인간 검수 불가능 영역 대체 |
| 마이그레이션 0014~0017          | 4 마이그레이션         | 일회성, 회귀 영향 0                                    |
| Stage 5 회귀 Golden 재실행      | BATCH 적재당 +30초     | 14 BATCH × 30초 = 7분 합계, 매우 저렴                  |
| Event Sourcing 스토리지         | 사용자당 ~50KB/월      | D1 비용 낮음, 무시 가능                                |
| Multi-Path Fallback 형태소 분석 | Workers KV/번들 +200KB | bundle size 영향 미미                                  |

### 8.2 잠재 위험

| 위험                                               | 확률        | 대응                                       |
| -------------------------------------------------- | ----------- | ------------------------------------------ |
| 트리거 (D1) 의 예상 외 동작                        | 중          | 마이그레이션 0014/0015 의 회귀 테스트 강화 |
| CBIV Stage 5 (회귀) 가 너무 느려져 BATCH 적재 차단 | 중          | virtual-db 최적화 + 병렬 실행              |
| Event Sourcing 의 이벤트 폭증 (사용자 1만+)        | 저 (Year 2) | 월별 archival 정책 (Year 2 결정)           |
| Multi-Path Fallback 형태소 분석 정확도 부족        | 중          | POC 검증 (Story R4.1.1) 후 결정            |

### 8.3 받아들인 한계 (Accepted Limitations)

- 결함 A (Graceful Degradation): 100% 완벽 폴백 불가능 (자연어 처리의 본질적 한계)
- 결함 F (Multi-Exam Silo): Year 1 미완성 — 네임스페이스만 예약, Year 2 본격
- CBIV 의 Stage 2 (의미 중복): 자동 차단 불가, 인간 결정 필수

---

## 9. MEPHISTO 의 최종 권고 (결론)

> 비판자(S-V-F 관점)의 지적은 다음을 입증했다:
>
> 1. **방어적 설계는 완전하지 않다** — Hard Rule (UPDATE 금지 등) 만으로는 운영 성능 보장 불가
> 2. **인간 검수는 확장 불가능하다** — 14 BATCH 누적 시 회귀 자동화 없이는 시스템 자살
> 3. **벡터 검색은 진실 보장 안 한다** — 폐기 정보의 의미적 유사성이 활성 정보를 능가하는 시나리오 실재
> 4. **단일 경로 정책은 사용자 이탈을 부른다** — Graceful Degradation 의 "교재 참고" 메시지는 사실상 거부와 같음
> 5. **단순 LWW 는 학습 데이터를 잃는다** — 멀티 디바이스 환경에서 신뢰 즉사

### 진산님 결정 요청 사항 (Decision Pending)

다음 5가지 결정이 필요합니다:

1. **본 재정립안 v2.0 채택 여부** — 7개 결함 모두 처리 진행?
2. **CBE-R3 (CBIV) 우선순위** — BATCH-1 dry-run **전** 완성 필수 vs **후** 진행?
3. **R4 (Multi-Path Fallback) 형태소 분석기 PoC** — kkma vs khaiii vs ICU 중 어느 것?
4. **R5 (Event Sourcing FSRS) Phase** — Phase 2 진입 시 즉시 vs Phase 3 이월?
5. **Hard Rule 15~21 신설** — 7개 모두 채택 vs 부분 채택?

### 즉시 실행 권고 (진산님 승인 시)

```
Day 1: ADR-012 ~ ADR-017 작성 + 진산님 승인
Day 2-3: CBE-R1 (Materialized Active View) 마이그레이션 + 트리거
Day 4-5: CBE-R2 (Hybrid Search Pipeline) 구현
Day 6-9: CBE-R3 (CBIV) 6단계 + 가상 D1 + 회귀 Golden runner
Day 10: BATCH-1 dry-run 진입 (CBIV 첫 production 검증)
```

**총 예상 기간:** 10일 (1 spread). BATCH-1 dry-run 전 P0 항목 모두 완성.

---

## 10. 본 재정립안의 무결성 (Vows)

본 재정립안의 코어 약속:

- ❌ CBIV 우회 (단일 BATCH 검증만으로 적재) 금지
- ❌ Hybrid Search 우회 (Vectorize 단독 결과 사용) 금지
- ❌ Materialized Active View 우회 (재귀 CTE 직접 사용) 금지
- ❌ Multi-Path Fallback 우회 (단일 안내문 응답) 금지
- ❌ FSRS LWW 사용 금지 (Event Sourcing 만)
- ❌ Golden Test 삭제 (진산님 승인 없이) 금지
- ❌ `packages/exams/_common/` 에 Year 1 데이터 적재 금지

본 무결성이 깨지면 **북극성 (생성물 신뢰성·정확성) 직접 위반** — 본 프로젝트 전체 의미 0.

---

## 부록 A: 본 재정립안과 기존 6 문서 체계 정합

| 기존 문서                          | 본 재정립안의 영향                       |
| ---------------------------------- | ---------------------------------------- |
| `CONTENT_BUILD_ENGINE_OVERVIEW.md` | 6 문서 → 7 문서 (CBIV 추가)              |
| `CONTENT_BUILD_ENGINE.md`          | 4 모듈 → 5 모듈 (CBIV 신설)              |
| `BATCH_LOAD_PROTOCOL.md`           | 8단계 → 10단계                           |
| `ONTOLOGY.md`                      | 변경 0 (Hard Rule 만 추가)               |
| `VERSION_MANAGEMENT.md`            | Materialized Active View 패턴 추가       |
| `MULTI_EXAM_EXTENSION.md`          | `_common/` 네임스페이스 추가             |
| `VALIDATION_FRAMEWORK.md`          | Level 4 (Cross-BATCH) 추가 — 사실상 CBIV |

---

## 부록 B: 페르소나별 최종 사인-오프

> **MEPHISTO**: "재해체-재조립 완료. 비판자가 옳은 부분 5/7 수용, 부분 타당 2/7 정밀화. BATCH-1 dry-run 전 P0 11시간 작업 권고."

> **ORACLE**: "북극성 정합. 결함 C (폐기 정보 노출) 차단은 비전의 근간."

> **ARCHITECT**: "B + C + G 가 본질. Materialized + Hybrid + CBIV 의 3-축으로 시스템 무결성 복구."

> **HACKER**: "총 ~600 LOC + 4 마이그레이션. 10일이면 충분. 단, CBIV Stage 5 (회귀 Golden) 가 가장 까다로움."

> **BREAKER**: "Cross-BATCH 회귀가 인간에 의존하는 한 시스템은 결국 무너진다. CBIV 가 그 무게를 받는다."

> **GHOST**: "운영 응답 시간 영향 미미 — Materialized View 가 오히려 빠름. 비용 증가는 무시 가능."

> **SENTINEL**: "의미 중복 임계값 0.85 는 적정. Golden Test 의 CI/CD 격리 시 권한 분리 필수."

> **ADVOCATE**: "사용자 입장에서 결함 A (단일 안내) + E (학습 데이터 손실) 차단이 가장 critical. UX 신뢰의 두 축."

---

## 부록 C: 기존 검토 의견과의 정합 표

비판자(S-V-F 관점) 의 4개 추가 권고에 대한 응답:

| 비판자 권고                   | 본 재정립안 응답                                       | 위치    |
| ----------------------------- | ------------------------------------------------------ | ------- |
| D1 Graph Materialization 전략 | ✅ Hard Rule 16 + Epic CBE-R1 + 마이그레이션 0014/0015 | §2-B    |
| 다중 경로 폴백 정의           | ✅ Multi-Path Fallback 4단계 + Epic CBE-R4             | §2-A    |
| L3 회귀 테스트 파이프라인     | ✅ CBIV Stage 5 + Hard Rule 21 + Epic CBE-R3           | §2-D, G |
| 하이브리드 RAG 정책           | ✅ 3-Stage Hybrid Search + Hard Rule 15 + Epic CBE-R2  | §2-C    |

**4건 모두 100% 수용 + 구체 설계 + 코드 위치 + 테스트 기준 명시.**

---

_"방어적 설계가 완전했다면 비판도 없었을 것이다._
_비판이 옳다면, 방어를 깨고 더 강한 무언가를 세운다._
_우리는 그 무언가를 CBIV 라 부른다."_

— DEV COVEN Content Build Engine Redesign v2.0
