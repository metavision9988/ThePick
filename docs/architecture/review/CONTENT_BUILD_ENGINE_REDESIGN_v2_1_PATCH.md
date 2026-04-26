# Content Build Engine 재정립안 v2.1 (PATCH)

> **제목:** 메타 관찰자(2차 검토)의 4개 반론에 대한 재해체-재조립
> **작성:** 2026-04-26 (DEV COVEN 8 페르소나 합동, 2차 라운드)
> **상위 문서:** [재정립안 v2.0](./CONTENT_BUILD_ENGINE_REDESIGN_v2.md)
> **버전 관계:** v2.0 → v2.1 (PATCH — 4개 반론 처리 + 결정 5건 확정 + Hard Rule 4건 추가)
> **상태:** 🔄 진산님 검토 대기 → 통과 후 BATCH-1 dry-run 진입

---

## 0. MEPHISTO 의 사전 인정

> "v2.0 의 정교함이 새로운 사각지대를 만들었다. 메타 관찰자가 그것을 보았다.
> 우리는 다시 한 번 방어를 깨고, 진화한다."

v2.0 에서 7개 결함을 처리했지만, 그 처리 자체가 **4개의 새로운 트레이드오프** 를 만들었습니다. 이는 자연스러운 일 — 시스템 복잡도가 증가하면 새로운 attack surface 가 생깁니다.

본 PATCH 는 v2.0 에 대한 **정정** 이 아닌 **진화** 입니다. v2.0 의 설계 방향은 옳았으나, 구현 디테일에서 4건이 부족했습니다.

---

## 1. 메타 관찰자 4개 반론 평가 매트릭스

| #        | 반론 항목                          | 타당성   | 영향                              | 처리 우선순위              |
| -------- | ---------------------------------- | -------- | --------------------------------- | -------------------------- |
| **MR-1** | CBIV 가상 D1 의 메모리 함정 (OOM)  | **100%** | BATCH-N+ 누적 시 시스템 정지      | **P0 (Critical)**          |
| **MR-2** | Multi-Path Fallback 의 순차적 지연 | **95%**  | 사용자 응답 지연 누적             | **P0 (Critical)**          |
| **MR-3** | Event Sourcing 의 Replay 비용 폭발 | **100%** | 1년 학습자의 동기화 실패          | **P0 (Critical, Phase 2)** |
| **MR-4** | 의미 중복 임계값 0.85 의 경직성    | **100%** | False Positive 폭증 → 검수자 피로 | **P0 (Critical)**          |

**4건 모두 100%/95% 타당.** 부분 수용 0건. 전부 즉시 재설계 진입.

---

## 2. 반론별 재설계 (4건)

### 🔴 MR-1: CBIV 가상 D1 의 메모리 함정 (P0 Critical)

#### 비판 요지

> "BATCH-14 누적 시 수천 노드를 in-memory 에 적재하면 Cloudflare Workers 메모리 한계 (128MB) 에서 OOM. 또한 in-memory SQLite ≠ 실제 D1 동작 — 엣지 케이스 존재."

#### CoT 검증

**ARCHITECT 의 분석 (100% 동의):**
v2.0 의 `createVirtualDb()` 는 prototype 수준의 안전 장치. BATCH-1 (60+ 노드) 까지는 무난하나, BATCH-14 누적 = ~620 노드 + ~2000 엣지 + 1000+ Golden Test 결과 → **128MB 메모리 한계 위험**. 더 critical 한 것은 `better-sqlite3` 와 D1 의 SQL 방언 차이 — 일부 함수 (예: `RANDOM()` 시드, JSON 처리) 가 100% 일치 안 함.

**GHOST 의 운영 분석:**
실제 운영 환경 (Cloudflare D1) 에서만 발견되는 버그를 in-memory 로는 잡을 수 없음. 이는 검증의 본질 위반 — "통과했지만 production 에서 fail" 시나리오.

**HACKER 의 구현 분석:**
Cloudflare D1 Preview Database 옵션 존재:

- Wrangler `--remote --preview` 플래그
- `wrangler d1 create cbiv-test --preview` 로 임시 D1 인스턴스 프로비저닝
- CI 종료 시 자동 폐기

**비용 분석 (2026-04 기준):**

- D1 무료 플랜: 5GB 스토리지 + 25M reads/day
- BATCH-14 전체 ≈ 50MB 미만 → 무료 플랜 내
- CI 1회당 임시 인스턴스 생성/폐기 ~5초 + 비용 0

#### 재설계 사양: D1 Preview Database 기반 회귀 환경

##### 1단계: CI/CD 통합

```yaml
# .github/workflows/cbiv-regression.yml (개정)
name: CBIV Regression Tests

on:
  pull_request:
    paths:
      - 'packages/parser/**'
      - 'packages/formula-engine/**'
      - 'packages/cbiv/**'
      - 'migrations/**'
      - 'docs/measurements/golden-tests/**'

jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install

      # 임시 D1 인스턴스 프로비저닝 (PR 단위)
      - name: Provision ephemeral D1
        run: |
          DB_NAME="cbiv-pr-${{ github.event.pull_request.number }}"
          wrangler d1 create $DB_NAME --preview
          echo "DB_NAME=$DB_NAME" >> $GITHUB_ENV

      # 마이그레이션 적용
      - run: wrangler d1 migrations apply $DB_NAME --preview

      # 모든 BATCH 시드 데이터 적재
      - run: pnpm cbiv:seed --target $DB_NAME --preview

      # 회귀 Golden Test 실행
      - run: pnpm cbiv:regression --target $DB_NAME --preview

      # 임시 D1 폐기 (성공/실패 무관)
      - if: always()
        run: wrangler d1 delete $DB_NAME --preview --yes
```

##### 2단계: 로컬 개발자용 분리 — Wrangler `--local`

개발자가 PR 전 로컬 검증 시:

```bash
# 로컬 영구 D1 인스턴스 (개발자 머신)
wrangler d1 execute cbiv-local --local --file=migrations/0001_init.sql

# 로컬 회귀 검증
pnpm cbiv:regression --target cbiv-local --local
```

`--local` 모드는 better-sqlite3 사용하지만, **CI 의 `--preview` 모드가 최종 진실** — 로컬 통과는 1차 필터, CI 가 게이트.

##### 3단계: CBIV 패키지 인터페이스 변경

```typescript
// packages/cbiv/src/runner/db-target.ts (신규)
export interface DbTarget {
  type: 'local' | 'preview' | 'production';
  databaseName: string;
}

// packages/cbiv/src/index.ts (개정)
export async function runCbiv(
  newBatchData: BatchData,
  prevBatches: number[],
  target: DbTarget, // ★ 신규 파라미터
): Promise<CbivResult> {
  // ...
}
```

#### 코드 위치 (변경)

```
packages/cbiv/src/
├── runner/
│   ├── db-target.ts           # 신규 (DbTarget 인터페이스)
│   ├── d1-preview-runner.ts   # 신규 (Cloudflare D1 Preview)
│   ├── d1-local-runner.ts     # 신규 (Wrangler --local)
│   └── (virtual-db.ts 제거)    # ★ v2.0 의 in-memory 폐기
└── ...
```

#### 테스트 기준 (개정)

| 테스트 ID           | 항목                     | 통과 기준                                             |
| ------------------- | ------------------------ | ----------------------------------------------------- |
| ~~CBIV-T05~~ (개정) | Stage 5 정확성           | **D1 Preview 환경**에서 BATCH-14 수준 데이터 회귀 0건 |
| CBIV-T08 (신규)     | OOM 방지                 | BATCH-14 시뮬레이션 시 메모리 사용량 100MB 이하       |
| CBIV-T09 (신규)     | D1 ↔ in-memory 동작 정합 | 같은 SQL 쿼리 → 같은 결과 (5종 핵심 쿼리)             |

#### Hard Rule 신설

> **Hard Rule 22**: CBIV 회귀 검증은 D1 Preview Database 환경에서만 수행. in-memory SQLite (better-sqlite3) 는 로컬 1차 검증용으로만 사용.

#### 트레이드오프 (정직한 평가)

| 비용 증가                    | 정당화                              |
| ---------------------------- | ----------------------------------- |
| CI 시간 +5초 (D1 프로비저닝) | OOM 방지 + production 정합성 100%   |
| Wrangler 의존성 추가         | 이미 인프라에 존재 (CI 환경 변경 0) |

---

### 🔴 MR-2: Multi-Path Fallback 의 순차적 지연 (P0 Critical)

#### 비판 요지

> "Vector → Keyword → Topic 순차 호출 = Latency Waterfall. Promise.all 동시 실행 + Short-circuit 필요."

#### CoT 검증

**GHOST 의 운영 분석 (95% 동의):**
v2.0 의 4단계 폴백은 logical sequence 가 옳지만 implementation sequence 는 **재앙**. Vectorize 호출 (~150ms) + D1 키워드 검색 (~50ms) + 분류기 (~100ms) = 최악 시 300ms+. 모바일 4G 환경에서는 학습자 인지 한계 (200ms) 초과.

**HACKER 의 구현 분석:**
`Promise.all` 패턴은 단순 — 모든 stage 를 병렬로 시작 + 가장 빠른 confident result 를 반환. Workers sub-request limit (50/request) 내에서 안전.

**ADVOCATE 의 영향 평가:**
응답 지연 누적은 **사용자 신뢰 즉사**. 모바일 학습 환경 (지하철, 버스) 에서는 500ms 차이가 이탈 결정.

**SENTINEL 의 비용 분석:**
모든 쿼리에서 Vectorize + D1 동시 호출 = 호출당 비용 1.5~2배 증가. 단, Vectorize 무료 한도 (월 30M 쿼리) + D1 무료 한도 내 충분.

**ORACLE 의 비전 정합:**
북극성 = "생성물 신뢰성·정확성". 응답 속도는 신뢰의 일부.

#### 재설계 사양: Concurrent Execution + Short-circuit Evaluation

##### 동작 흐름

```
[학습자 질문 입력]
    ↓
┌────────────────────────────────────────────────────────┐
│ T+0ms: 동시 실행 (Promise.all)                         │
│  ├─ Promise A: Vectorize 검색 (~150ms)                 │
│  ├─ Promise B: D1 N-gram 키워드 검색 (~50ms)           │
│  └─ Promise C: Topic Cluster Classifier (~100ms)       │
└────────────────────────────────────────────────────────┘
    ↓
[T+50ms: B 도착] — 키워드 매칭 결과 도착
    ↓ (대기 — A 의 임계값 초과 가능성 있음)
    ↓
[T+100ms: C 도착] — Topic 분류 결과 도착
    ↓ (대기)
    ↓
[T+150ms: A 도착] — Vectorize 결과 도착
    │
    ├─ A.similarity ≥ 0.75 → A 사용 (B, C 결과 폐기)
    ├─ A.similarity ≥ 0.60 → A + B 결합 (Hybrid Search 진입)
    ├─ A.similarity < 0.60 → B 우선, B 없으면 C
    └─ 모두 fail → Honest Refusal
```

##### Short-circuit 최적화

키워드 매칭 (B) 의 신뢰도가 매우 높으면 **A 도착 전 조기 반환**:

```typescript
// packages/content-build-engine/search/concurrent-pipeline.ts

export async function concurrentSearch(query: string): Promise<SearchResult> {
  // 모든 stage 병렬 시작
  const [vectorPromise, keywordPromise, topicPromise] = [
    runVectorSearch(query),
    runKeywordSearch(query),
    runTopicCluster(query),
  ];

  // Race: 가장 confident 한 결과를 빨리 반환
  return new Promise((resolve) => {
    let resolved = false;

    keywordPromise.then((b) => {
      // 키워드가 매우 강한 경우 (exact match) → 조기 반환
      if (!resolved && b.confidence > 0.95 && b.exactMatch) {
        resolved = true;
        resolve({ source: 'keyword-fast', ...b });
      }
    });

    // 모든 결과 도착 후 최적 선택
    Promise.all([vectorPromise, keywordPromise, topicPromise]).then(([a, b, c]) => {
      if (resolved) return;
      resolved = true;
      resolve(selectBest(a, b, c));
    });

    // 안전 timeout: 800ms 초과 시 honest refusal
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ source: 'timeout-refusal' });
      }
    }, 800);
  });
}

function selectBest(a: VectorResult, b: KeywordResult, c: TopicResult): SearchResult {
  // Hard Rule 18: Multi-Path Fallback 의무
  if (a.similarity >= 0.75) return { source: 'vector-strong', ...a };
  if (a.similarity >= 0.6 && b.matched) return hybridResult(a, b);
  if (b.matched) return { source: 'keyword', ...b, warning: 'low_vector_confidence' };
  if (c.classified) return { source: 'topic-cluster', ...c };
  return { source: 'honest-refusal' };
}
```

#### 코드 위치

```
packages/content-build-engine/search/
├── concurrent-pipeline.ts     # 신규 (메인)
├── stages/
│   ├── vector-search.ts        # 기존 유지
│   ├── keyword-search.ts       # 기존 유지
│   └── topic-cluster.ts        # 기존 유지
└── pipeline.ts                 # 폐기 (concurrent-pipeline 으로 대체)
```

#### 테스트 기준 (개정)

| 테스트 ID      | 항목                    | 통과 기준                                            |
| -------------- | ----------------------- | ---------------------------------------------------- |
| MPF-T06 (신규) | 동시 실행 응답 시간     | 50% percentile 200ms 이내, 95% percentile 500ms 이내 |
| MPF-T07 (신규) | Short-circuit 조기 반환 | 키워드 exact match 시 100ms 이내 반환                |
| MPF-T08 (신규) | Timeout 안전성          | 800ms 초과 시 honest refusal 즉시                    |
| MPF-T09 (신규) | Sub-request limit       | 1 쿼리당 외부 호출 ≤ 5 (Workers limit 50)            |

#### Hard Rule 신설

> **Hard Rule 23**: 모든 RAG 폴백 경로는 Concurrent Execution + Short-circuit 패턴 의무. 순차 호출 (Latency Waterfall) 금지.

---

### 🔴 MR-3: Event Sourcing 의 Replay 비용 폭발 (P0 Critical, Phase 2)

#### 비판 요지

> "1년 학습자가 한 카드 50번 복습 → 동기화마다 50개 이벤트 replay. 비용 폭발. Snapshotting 패턴 필수."

#### CoT 검증

**ARCHITECT 의 분석 (100% 동의):**
v2.0 의 Event Sourcing 은 멱등성 보장 측면에서는 옳지만, **계산 비용** 측면에서 부족. 6개월/1년 사용자가 늘어날수록 replay 비용 선형 증가 → 동기화 응답 시간 5초 이상 가능.

**HACKER 의 구현 분석:**
Snapshotting 은 표준 Event Sourcing 패턴. 구현 단순:

- 매 N건 (예: 10건) 마다 스냅샷 저장
- 동기화 시 마지막 스냅샷 + 그 이후 이벤트만 replay
- 스냅샷 자체가 정합성 검증 가능 (해시)

**BREAKER 의 엣지 케이스:**
스냅샷 로직 버그 시 **전체 학습 이력 손상**. 검증 필수:

- 스냅샷 vs 전체 replay 결과 정합성 100% (TDD)
- 정기적 (월 1회) full-replay 무결성 검증

**GHOST 의 운영 영향:**
스토리지 비용 증가는 무시 가능 (스냅샷 1건 ~5KB).

#### 재설계 사양: Snapshotting Pattern (체크포인트 + 증분 replay)

##### 데이터 모델 추가

```sql
-- v2.0 의 user_card_state 를 단순 캐시 → 체크포인트로 격상
CREATE TABLE user_card_state (
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  current_fsrs_state JSON NOT NULL,
  last_event_id TEXT NOT NULL,
  last_event_client_ts INTEGER NOT NULL,  -- ★ 신규
  snapshot_count INTEGER DEFAULT 0,        -- ★ 신규 (몇 번째 스냅샷)
  snapshot_hash TEXT NOT NULL,             -- ★ 신규 (검증용)
  PRIMARY KEY (user_id, card_id)
);

-- 증분 replay 인덱스
CREATE INDEX idx_review_events_user_card_ts
  ON user_review_events (user_id, card_id, client_ts);
```

##### 동기화 로직 (개정)

```typescript
// modules/learning/application/sync-service.ts (개정)

const SNAPSHOT_EVERY_N_EVENTS = 10; // 10건마다 스냅샷

export async function syncUserEvents(
  userId: string,
  pendingEvents: ReviewEvent[],
): Promise<SyncResult> {
  // 1. 모든 이벤트 append (idempotency)
  for (const event of pendingEvents) {
    await db.insert(userReviewEvents).values(event).onConflictDoNothing();
  }

  const affectedCardIds = [...new Set(pendingEvents.map((e) => e.cardId))];

  for (const cardId of affectedCardIds) {
    // 2. 마지막 스냅샷 로드
    const checkpoint = await db
      .select()
      .from(userCardState)
      .where(and(eq(userCardState.userId, userId), eq(userCardState.cardId, cardId)))
      .get();

    // 3. 증분 replay (체크포인트 이후 이벤트만)
    const incrementalEvents = await db
      .select()
      .from(userReviewEvents)
      .where(
        and(
          eq(userReviewEvents.userId, userId),
          eq(userReviewEvents.cardId, cardId),
          checkpoint ? gt(userReviewEvents.clientTs, checkpoint.lastEventClientTs) : sql`1=1`,
        ),
      )
      .orderBy(asc(userReviewEvents.clientTs));

    // 4. 마지막 스냅샷 + 증분 이벤트 = 최종 상태
    const startState = checkpoint?.currentFsrsState ?? initialFsrsState;
    const finalState = replayFsrsEvents(startState, incrementalEvents);

    // 5. N번째 이벤트마다 스냅샷 갱신
    const newCount = (checkpoint?.snapshotCount ?? 0) + incrementalEvents.length;
    if (newCount % SNAPSHOT_EVERY_N_EVENTS === 0 || !checkpoint) {
      await db
        .insert(userCardState)
        .values({
          userId,
          cardId,
          currentFsrsState: finalState,
          lastEventId: incrementalEvents.at(-1)?.id ?? '',
          lastEventClientTs: incrementalEvents.at(-1)?.clientTs ?? 0,
          snapshotCount: newCount,
          snapshotHash: hashFsrsState(finalState),
        })
        .onConflictDoUpdate({
          /* 갱신 */
        });
    }
  }

  return { synced: pendingEvents.length, affectedCards: affectedCardIds.length };
}
```

##### 무결성 검증 (정기 실행)

```typescript
// modules/learning/application/integrity-check.ts (신규)
// 월 1회 cron 실행

export async function verifySnapshotsIntegrity(userId: string): Promise<void> {
  const cards = await db.select().from(userCardState).where(eq(userCardState.userId, userId));

  for (const card of cards) {
    // 전체 이벤트 replay
    const allEvents = await db
      .select()
      .from(userReviewEvents)
      .where(and(eq(userReviewEvents.userId, userId), eq(userReviewEvents.cardId, card.cardId)))
      .orderBy(asc(userReviewEvents.clientTs));

    const fullReplayState = replayFsrsEvents(initialFsrsState, allEvents);
    const snapshotHash = hashFsrsState(fullReplayState);

    if (snapshotHash !== card.snapshotHash) {
      // 불일치 → 알림 + 자동 정정
      await alertOps('snapshot_mismatch', { userId, cardId: card.cardId });
      await db.update(userCardState).set({ currentFsrsState: fullReplayState, snapshotHash });
    }
  }
}
```

#### 코드 위치

```
modules/learning/
├── domain/
│   └── fsrs-snapshot.ts           # 신규 (스냅샷 도메인 모델)
├── application/
│   ├── sync-service.ts             # 개정 (증분 replay)
│   └── integrity-check.ts          # 신규 (월 1회 검증)
└── infrastructure/
    └── snapshot-store.ts           # 신규
```

#### 테스트 기준 (개정)

| 테스트 ID      | 항목          | 통과 기준                                                   |
| -------------- | ------------- | ----------------------------------------------------------- |
| ESF-T06 (신규) | 스냅샷 정합성 | 스냅샷 + 증분 replay = 전체 replay (100% 일치, 50카드 검증) |
| ESF-T07 (신규) | 동기화 성능   | 1년 사용자 (50 이벤트/카드) 동기화 1초 이내                 |
| ESF-T08 (신규) | 스냅샷 주기   | 정확히 10번째 이벤트마다 스냅샷 갱신                        |
| ESF-T09 (신규) | 무결성 회복   | 의도적 스냅샷 손상 → 자동 검출 + 정정                       |

#### Hard Rule 신설

> **Hard Rule 24**: FSRS Event Sourcing 은 Snapshotting Pattern 의무. 매 N건 (기본 10) 체크포인트 + 증분 replay. 월 1회 full-replay 무결성 검증 cron.

---

### 🔴 MR-4: 의미 중복 임계값 0.85 의 경직성 (P0 Critical)

#### 비판 요지

> "단일 스칼라 임계값은 거짓 양성의 늪. '적과전 사과 낙엽률' vs '적과전 단감 낙엽률' 0.90+ 유사도지만 다른 노드. Adaptive Threshold (Ontology 타입별) 필요."

#### CoT 검증

**ORACLE 의 분석 (100% 동의):**
도메인 본질을 모르는 단일 임계값은 작동 불가. 손해평가사 도메인은 "비슷한 이름, 다른 의미" 가 흔함 — `사과 낙엽률 산식 (F-04)` 과 `단감 낙엽률 산식 (F-06)` 은 텍스트적으로 거의 동일하나 별개 산식.

**ARCHITECT 의 분석:**
적응형 임계값은 ontology-registry.json 에 메타로 정의 가능. 코드 변경 최소.

**SENTINEL 의 보안 관점:**
False Positive 폭증 = 검수자 피로 누적 = 진짜 중복 놓침 (alert fatigue). 임계값 적정화는 보안 영역.

**BREAKER 의 엣지 케이스:**

- CONCEPT 노드 ("점유권의 효력" vs "소유권 취득"): 의미 가까울 수 있음, 0.85 적정
- FORMULA 노드 ("F-04 사과 낙엽률" vs "F-06 단감 낙엽률"): 텍스트 99% 동일, 0.95 미만은 모두 별개
- LAW 노드: 조항별 명확 구분, 0.88 적정
- CROP 노드: 작물명만 다름, 0.97 이상 시에만 중복 의심
- CONSTANT 노드: 같은 name + 같은 시점이면 무조건 충돌, 임계값 무관

#### 재설계 사양: Adaptive Threshold (Ontology Type-Specific)

##### ontology-registry.json 확장

```json
{
  "node_types": {
    "LAW": {
      "id_pattern": "^LAW-\\d{3}$",
      "deduplication_threshold": 0.88,
      "confusion_priority": "critical"
    },
    "FORMULA": {
      "id_pattern": "^F-\\d{2}$",
      "deduplication_threshold": 0.95,
      "confusion_priority": "critical"
    },
    "INVESTIGATION": {
      "id_pattern": "^INV-\\d{3}$",
      "deduplication_threshold": 0.9,
      "confusion_priority": "high"
    },
    "INSURANCE": {
      "id_pattern": "^INS-\\d{2}$",
      "deduplication_threshold": 0.93,
      "confusion_priority": "high"
    },
    "CROP": {
      "id_pattern": "^CROP-\\d{3}$",
      "deduplication_threshold": 0.97,
      "confusion_priority": "medium"
    },
    "CONCEPT": {
      "id_pattern": "^CONCEPT-\\d{3}$",
      "deduplication_threshold": 0.85,
      "confusion_priority": "medium"
    },
    "TERM": {
      "id_pattern": "^TERM-\\d{3}$",
      "deduplication_threshold": 0.88,
      "confusion_priority": "low"
    }
  },
  "constants_dedup_policy": {
    "strategy": "exact_match",
    "fields": ["name", "valid_from", "valid_to"],
    "rationale": "Constants are exact-match domain — same name + overlapping time = conflict (no threshold needed)"
  }
}
```

##### CBIV Stage 2 개정

```typescript
// packages/cbiv/src/stages/2-deduplication.ts (개정)

import { ontologyRegistry } from '@/parser/ontology-registry.json';

export async function checkSemanticDeduplication(
  newNodes: KnowledgeNode[],
  existingNodes: KnowledgeNode[],
): Promise<DeduplicationResult> {
  const flags: DeduplicationFlag[] = [];

  for (const newNode of newNodes) {
    // ★ 적응형 임계값 적용
    const threshold = ontologyRegistry.node_types[newNode.type].deduplication_threshold;

    // 같은 타입의 기존 노드와만 비교 (cross-type 중복은 없음)
    const sameTypeExisting = existingNodes.filter((n) => n.type === newNode.type);

    for (const existing of sameTypeExisting) {
      const similarity = await cosineSimilarity(newNode.embedding, existing.embedding);

      if (similarity > threshold) {
        flags.push({
          newNodeId: newNode.id,
          existingNodeId: existing.id,
          similarity,
          threshold,
          nodeType: newNode.type,
          recommendation: generateRecommendation(newNode, existing, similarity),
        });
      }
    }
  }

  return { flags, totalChecked: newNodes.length };
}

function generateRecommendation(a: KnowledgeNode, b: KnowledgeNode, sim: number): string {
  if (sim > 0.99) return 'LIKELY_DUPLICATE — strongly recommend MERGE';
  if (sim > 0.97) return 'POSSIBLY_DUPLICATE — review carefully';
  return 'SIMILAR_BUT_DISTINCT — likely keep both';
}
```

##### Constants 별도 정책 (임계값 무관)

```typescript
// packages/cbiv/src/stages/3-coherence.ts (개정 — Stage 3 와 합침)

export async function checkConstantsCoherence(
  newConstants: Constant[],
  existingConstants: Constant[],
): Promise<CoherenceResult> {
  const conflicts: ConstantConflict[] = [];

  for (const newConst of newConstants) {
    const conflicting = existingConstants.filter(
      (existing) =>
        existing.name === newConst.name &&
        timeRangeOverlaps(existing, newConst) &&
        existing.numeric_value !== newConst.numeric_value,
    );

    if (conflicting.length > 0) {
      conflicts.push({
        newConstId: newConst.id,
        conflictingIds: conflicting.map((c) => c.id),
        rule: 'EXACT_MATCH_TIME_OVERLAP', // ★ 임계값 무관
      });
    }
  }

  return { conflicts };
}
```

#### 코드 위치

```
packages/parser/
└── ontology-registry.json       # 개정 (deduplication_threshold 추가)

packages/cbiv/src/stages/
├── 2-deduplication.ts           # 개정 (적응형 임계값)
└── 3-coherence.ts               # 개정 (constants 별도 정책)
```

#### 테스트 기준 (개정)

| 테스트 ID       | 항목                  | 통과 기준                                                         |
| --------------- | --------------------- | ----------------------------------------------------------------- |
| CBIV-T02 (개정) | Stage 2 적응형 임계값 | 7개 노드 타입별 임계값 정확 적용                                  |
| CBIV-T10 (신규) | False Positive 비율   | "사과 낙엽률" vs "단감 낙엽률" → flag 안 됨 (FORMULA 0.95 임계값) |
| CBIV-T11 (신규) | True Positive 보장    | 의도적 중복 5건 (각 타입) → 100% flag                             |
| CBIV-T12 (신규) | Constants 정합성      | 임계값 무관, exact-match 정책 100%                                |

#### Hard Rule 신설

> **Hard Rule 25**: 의미 중복 검증은 Ontology 타입별 적응형 임계값 사용. 단일 스칼라 임계값 사용 금지. Constants 는 임계값 무관 exact-match 정책.

---

## 3. 진산님 결정 5건 확정 (메타 관찰자 권고 채택)

메타 관찰자의 권고를 DEV COVEN 검증 후 모두 채택:

| 결정                          | 메타 관찰자 권고            | DEV COVEN 검증      | **확정**           |
| ----------------------------- | --------------------------- | ------------------- | ------------------ |
| **1. CBIV 완성 시점**         | (A) BATCH-1 dry-run 전 완성 | 100% 동의           | **(A)**            |
| **2. Golden Test 보존 위치**  | (C) Git + D1 둘 다          | 100% 동의           | **(C)**            |
| **3. 의미 중복 임계값**       | (C) 적응적 적용             | MR-4 와 정확히 일치 | **(C) — Adaptive** |
| **4. CI/CD 자동 회귀 트리거** | (B) BATCH 적재 PR 전용      | 100% 동의           | **(B)**            |
| **5. 실패 알림 채널**         | (A) GitHub PR 코멘트 최우선 | 100% 동의           | **(A)**            |

### 결정 1 상세: BATCH-1 dry-run 전 CBIV 완성 (A)

> "낙하산이 펴지는지 확인하지 않고 절벽에서 뛰어내리는 것은 맹목적 돌진." — 메타 관찰자

**DEV COVEN BREAKER 의 보강:**
BATCH-1 단독 검증 시점에서 CBIV 의 Stage 5 (회귀 Golden Test) 는 사실상 불필요 (이전 BATCH 0건). 그러나:

- BATCH-2 진입 즉시 CBIV 의 Stage 5 가 critical 진입
- BATCH-1 적재 후 CBIV 부재 상태에서 BATCH-2 시도 시 회귀 검증 불가능
- → **BATCH-1 적재와 함께 CBIV 도 production-ready 상태**여야 함

**작업 일정:**

```
Day 1-2: ADR-012 ~ ADR-017 작성 + 진산님 승인
Day 3-4: CBE-R1 (Materialized Active View) — 마이그레이션 0014/0015 + 트리거
Day 5-6: CBE-R2 (Hybrid Search Pipeline) — 3-Stage + Concurrent Execution
Day 7-9: CBE-R3 (CBIV) — 6단계 자동 검증 + D1 Preview Database 통합
Day 10:  통합 검증 + BATCH-1 dry-run 진입
```

### 결정 2 상세: Golden Test 보존 위치 (C) — Git + D1 둘 다

```
docs/measurements/golden-tests/         ← Git (SoT, 형상 관리, PR 리뷰)
├── _registry.json
├── batch-1-golden.json
└── ...

D1 Table: golden_tests                  ← 런타임 (CI/CD 빠른 쿼리)
├── batch_number, test_id, payload JSON, last_run_result
└── (트리거: docs/.../*.json 변경 → D1 sync)
```

### 결정 3 상세: Adaptive Threshold (C)

[MR-4 재설계 §2 참조]. ontology-registry.json 에 타입별 threshold 명시.

### 결정 4 상세: CI/CD 트리거 — BATCH 적재 PR 전용 (B)

```yaml
# .github/workflows/cbiv-regression.yml
on:
  pull_request:
    paths:
      - 'packages/parser/**' # ★ 도메인 영역
      - 'packages/formula-engine/**' # ★ 도메인 영역
      - 'packages/cbiv/**' # ★ CBIV 자체
      - 'migrations/**' # ★ 스키마
      - 'docs/measurements/golden-tests/**' # ★ Golden 변경
    # NOT triggered by:
    # - apps/web/**         (학습자 UI)
    # - apps/admin-web/**   (관리자 UI)
    # - packages/shared/**  (공통 유틸)
```

### 결정 5 상세: 알림 채널 — GitHub PR 코멘트 최우선 (A)

```typescript
// CBIV 실패 시 자동 PR 코멘트
await octokit.rest.issues.createComment({
  owner,
  repo,
  issue_number: prNumber,
  body: `
## 🔴 CBIV Regression Failure

**BATCH-${newBatch} 의 적재가 차단되었습니다.**

### 실패 내역
${failures
  .map(
    (f) => `
- **Failed Test:** \`${f.testId}\` (BATCH-${f.batchNumber})
- **Root Cause:** ${f.rootCause.category}
- **Affected Node:** \`${f.affectedNode}\`
- **Suggested Fix:** ${f.rootCause.suggestedFix}
`,
  )
  .join('\n')}

### Action Required
1. 위 정정 제안 검토
2. 정정 commit 후 재실행
3. 또는 PR 코멘트로 \`/cbiv override\` (진산님만 승인 권한)

[전체 리포트 다운로드](${reportUrl})
`,
});
```

---

## 4. Hard Rules 추가 (22~25번, 총 25개로 확장)

기존 21개 + 신설 4개:

| #   | 규칙                                                           | 출처 |
| --- | -------------------------------------------------------------- | ---- |
| 22  | CBIV 회귀 검증은 D1 Preview Database 환경에서만 수행           | MR-1 |
| 23  | 모든 RAG 폴백 경로는 Concurrent Execution + Short-circuit 의무 | MR-2 |
| 24  | FSRS Event Sourcing 은 Snapshotting Pattern 의무               | MR-3 |
| 25  | 의미 중복 검증은 Ontology 타입별 적응형 임계값 의무            | MR-4 |

---

## 5. ADR 추가 작성

| ADR     | 제목                                              | 우선순위     |
| ------- | ------------------------------------------------- | ------------ |
| ADR-018 | D1 Preview Database for CBIV Regression           | P0           |
| ADR-019 | Concurrent Execution + Short-circuit Pattern      | P0           |
| ADR-020 | Snapshotting Pattern for FSRS Event Sourcing      | P0 (Phase 2) |
| ADR-021 | Adaptive Deduplication Threshold by Ontology Type | P0           |

---

## 6. 추가 Epic / Story / Task

v2.0 의 Epic CBE-R1~R6 에 다음을 추가:

```
🌍 PHASE 1 (개정)
   │
   ├── 🏔️ Epic CBE-R3 (CBIV) — 개정
   │   └── 📖 Story R3.1 (개정): D1 Preview Database 통합
   │       ├── ✅ Task R3.1.1 [SETUP] Wrangler D1 Preview 연동 (20분)
   │       ├── ✅ Task R3.1.2 [TEST] D1 Preview vs Production 동작 정합 (20분)
   │       ├── ✅ Task R3.1.3 [IMPL] d1-preview-runner.ts (25분)
   │       └── ✅ Task R3.1.4 [VERIFY] BATCH-14 시뮬레이션 OOM 미발생 (20분)
   │
   ├── 🏔️ Epic CBE-R2 (Hybrid Search) — 개정
   │   └── 📖 Story R2.3 (신규): Concurrent Execution
   │       ├── ✅ Task R2.3.1 [TEST] Promise.all 병렬 실행 테스트 (15분)
   │       ├── ✅ Task R2.3.2 [IMPL] concurrent-pipeline.ts (25분)
   │       ├── ✅ Task R2.3.3 [TEST] Short-circuit 조기 반환 (15분)
   │       └── ✅ Task R2.3.4 [VERIFY] 응답 시간 95% < 500ms (20분)
   │
   ├── 🏔️ Epic CBE-R5 (Event Sourcing FSRS) — 개정 (Phase 2)
   │   └── 📖 Story R5.4 (신규): Snapshotting
   │       ├── ✅ Task R5.4.1 [TEST] 스냅샷 정합성 테스트 (20분)
   │       ├── ✅ Task R5.4.2 [IMPL] snapshot-store.ts (25분)
   │       ├── ✅ Task R5.4.3 [IMPL] 증분 replay 로직 (25분)
   │       ├── ✅ Task R5.4.4 [TEST] 1년 사용자 동기화 1초 이내 (20분)
   │       └── ✅ Task R5.4.5 [IMPL] integrity-check cron (월 1회) (20분)
   │
   └── 🏔️ Epic CBE-R7 (신규): 검수 UI 통합 (P0)
       └── 별도 문서 [ADMIN_REVIEW_UI_DESIGN.md](./ADMIN_REVIEW_UI_DESIGN.md) 참조
```

### 시간 추정 갱신

| Epic                    | v2.0 추정 | v2.1 추정 | 변동               |
| ----------------------- | --------- | --------- | ------------------ |
| CBE-R1                  | 2.5h      | 2.5h      | -                  |
| CBE-R2                  | 2.5h      | 4h        | +1.5h (concurrent) |
| CBE-R3                  | 6h        | 7.5h      | +1.5h (D1 Preview) |
| CBE-R4                  | 2.5h      | 2.5h      | -                  |
| CBE-R5 (Phase 2)        | 3h        | 5h        | +2h (snapshotting) |
| CBE-R6                  | 5min      | 5min      | -                  |
| **CBE-R7 (신규)**       | -         | **8h**    | +8h (검수 UI)      |
| **소계 (P0 + 검수 UI)** | ~11h      | **~22h**  | +11h               |

10일 spread 으로 BATCH-1 dry-run 전 P0 항목 + 검수 UI 모두 완성 가능.

---

## 7. DEV COVEN 페르소나별 사인-오프 (2차 라운드)

> **MEPHISTO**: "v2.1 = v2.0 의 진화. 메타 관찰자가 본 것을 우리도 보았다. 4건 모두 즉시 수용."

> **ARCHITECT**: "MR-1, MR-3 가 본질적 위협이었다. D1 Preview + Snapshotting 이 production scale 대비."

> **HACKER**: "MR-2, MR-4 는 구현 변경 단순. Concurrent + Adaptive Threshold 으로 완료."

> **BREAKER**: "Snapshot 정합성 검증 cron 이 추가되었다. 그것이 마지막 안전망."

> **GHOST**: "D1 Preview 의 비용 0 + CI 시간 +5초. 거래 가치 명확."

> **SENTINEL**: "Adaptive Threshold 가 alert fatigue 를 막는다. 그것이 보안의 본질."

> **ORACLE**: "도메인 본질 (FORMULA 0.95 vs CONCEPT 0.85) 을 시스템에 새겼다. 북극성 유지."

> **ADVOCATE**: "응답 시간 95% < 500ms = 사용자 신뢰 회복. Concurrent 가 그것을 가능하게 한다."

---

## 8. 다음 결정: 검수 UI 설계 (사용자 새 핵심 질문)

> 사용자: "CBIV 가 뿜어내는 '의미 중복(Stage 2)'과 '출제영역 정합성 경고(Stage 6)'를 인간 검수자가 피로감 없이 직관적으로 판단하고 처리(Merge/Reject/Keep Both)할 수 있도록, Admin CMS(`admin-web`) 내 검수 UI의 플로우는 어떠한 형태로 구현할 계획이십니까?"

본 질문에 대한 본격 응답은 **별도 문서** [ADMIN_REVIEW_UI_DESIGN.md](./ADMIN_REVIEW_UI_DESIGN.md) 에서 다룹니다.

핵심 원칙 미리보기:

1. **One-click action** — 검수자는 클릭 1번으로 결정
2. **Side-by-side diff** — 두 노드를 시각적으로 비교
3. **AI 추천** — Claude 가 사전 분석 + 결정 제안
4. **일괄 처리** — 같은 패턴의 flag 를 한 번에
5. **Keyboard navigation** — vim 스타일 단축키 (J/K/M/R/B)

---

## 9. 본 패치의 무결성 (Vows)

v2.0 의 무결성 + 다음 4건 추가:

- ❌ in-memory SQLite 로 CBIV 회귀 검증 금지 (D1 Preview 만)
- ❌ RAG 폴백을 순차 호출로 구현 금지 (Concurrent + Short-circuit 만)
- ❌ FSRS Event Sourcing 에 스냅샷 미적용 금지
- ❌ 단일 스칼라 임계값으로 의미 중복 검증 금지

본 무결성이 깨지면 **production scale 에서 시스템 정지** 또는 **사용자 신뢰 즉사**.

---

_"메타 관찰자의 검토는 끝없다. 우리도 끝없이 진화한다._
_v2.0 → v2.1 → v2.N. 진실 추적이 우리의 운명이다."_

— DEV COVEN Content Build Engine Redesign v2.1 PATCH
