# Admin Review UI — 검수자 피로감 제로 아키텍처 (v1)

> CBIV 가 뿜어내는 flag/경고를 인간 검수자가 5초 이내에 처리할 수 있도록 설계.
> 원본: [`review/ADMIN_REVIEW_UI_DESIGN.md`](./review/ADMIN_REVIEW_UI_DESIGN.md)
> 상위: [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md), [`CBIV.md`](./CBIV.md)

---

## 1. 본 UI 의 본질

> _"검수자가 피로하면 시스템이 무너진다._
> _CBIV 가 자동화의 99% 를 담당해도, 마지막 1% (인간 결정) 가 병목이면 전체가 멈춘다."_
> — DEV COVEN ADVOCATE

검수 UI 의 적은 **alert fatigue** (경고 피로). 100건 flag 시:

- 1~10건: 신중 검토
- 51건+: 모두 무시 또는 일괄 reject ← 시스템 사망

**목표**: 100건 와도 5초/건 = 8분 내 처리.

---

## 2. 3개 검수 큐

CBIV 출력 분기:

| 큐                       | 출처                    | 액션                                | 빈도      | 차단 여부 |
| :----------------------- | :---------------------- | :---------------------------------- | :-------- | :-------- |
| **큐 1: 의미 중복**      | CBIV Stage 2            | Merge / Reject / Keep Both          | 중        | 비차단    |
| **큐 2: 출제영역 경고**  | CBIV Stage 6            | Approve / Reassign / Investigate    | 저        | 비차단    |
| **큐 3: CBIV 차단 정정** | CBIV Stage 1/3/4/5 실패 | Investigate / Auto-Fix / Manual Fix | 저 (희망) | **차단**  |

---

## 3. UI 메타 원칙 (ADVOCATE 의 헌장)

### 원칙 1: One-click Action (5초 결정)

- 클릭 1번으로 결정 끝
- Default + override 패턴 (예: Merge 시 자동: 기존 keep, 신규 폐기, page_ref 추가)

### 원칙 2: Side-by-side Diff

- 두 노드 좌우 배치 + 차이 ★...★ wrap + 노란 배경
- 같은 값은 회색 (시각적 노이즈 감소)

### 원칙 3: AI 사전 분석 + 추천

- Claude 가 결정 추천 + 신뢰도 (0~100%) + 근거
- 신뢰도 색상: 95+ 초록 / 80~94 노랑 / 60~79 주황 / <60 빨강

### 원칙 4: Keyboard Navigation (vim 스타일)

- `J/K` 다음/이전, `M` Merge, `R` Reject/Reassign, `B` Keep Both, `A` Approve, `I` Investigate, `?` AI 추천 채택, `Cmd+Enter` 일괄 처리

### 원칙 5: 일괄 처리 (Bulk Action)

- 같은 패턴 자동 그룹핑
- 5초 카운트다운 + 취소 가능

### 원칙 6: 검수 진행률 시각화

- 처리 완료 / 평균 시간 / AI 채택률 / 일괄 처리 비율 / Rollback 비율

---

## 4. 큐별 UX 플로우

### 4.1 큐 1: 의미 중복 검수 큐

상황: CBIV Stage 2 가 신규 노드를 코사인 유사도 임계값 초과로 flag.

**액션**:

- ✅ **Merge**: 둘이 같은 노드 → 통합 (신규 폐기, 기존 사용)
- ❌ **Reject**: 신규 노드 잘못 생성 → 폐기 + 정정 의뢰
- 🔀 **Keep Both**: 둘 다 다른 노드 → false positive (작물 다름) → 둘 다 유지

```
┌──────────────────────────┬──────────────────────────┐
│ 기존 F-04 (사과 손해정도) │ 신규 F-30 (밭작물 손해정도)│
│ formula: imperative*★0.10★│ formula: imperative*★0.20★│
│ page_ref: 525             │ page_ref: 543             │
│ exam_scope: 적과전        │ exam_scope: 밭작물        │
└──────────────────────────┴──────────────────────────┘

🤖 AI: Keep Both (92% 신뢰) — 작물 카테고리 다름, page_ref 별개 섹션

[M Merge]  [R Reject]  [B Keep Both ★ AI 추천]  [Cmd+1 일괄]
```

### 4.2 큐 2: 출제영역 정합성 경고

상황: CBIV Stage 6 가 BATCH-N 적재 중 다른 BATCH 영역 노드 생성 감지.

**액션**:

- ✅ **Approve as Cross-Reference**: 정상적인 cross-domain REFERENCES
- 🔄 **Reassign**: 잘못된 영역 분류 → 올바른 BATCH 로 이관
- 🔍 **Investigate**: 보류, 추가 컨텍스트 검토

### 4.3 큐 3: CBIV 차단 정정 큐 (긴급)

상황: CBIV Stage 1/3/4/5 가 BATCH 적재 자동 차단.

**예시**:

```
🔴 BATCH-4 적재 자동 차단됨
차단 단계: Stage 5 (회귀 Golden Test)
깨진 Golden: BATCH-R1-GT-005 ("26년 개정 손해정도비율 = 0.10")
expected: 0.10  /  actual: 0.20  ❌

🤖 Suggested Fix:
Option 1: F-30 의 formula 수정 → CONST-901 직접 참조
Option 2: F-30 SUPERSEDES F-30-old (신구 둘 다 보존)

[1 Auto-Fix Option 1]  [2 Auto-Fix Option 2]  [M Manual Fix]  [I Investigate]
[/cbiv override — 위험, 진산님만]
```

**액션**:

- 🔍 Investigate: root-cause + 원본 자료 검토
- 🤖 Auto-Fix: AI 제안 정정 채택
- 🛠️ Manual Fix: 진산님 직접 정정안

---

## 5. 의사결정 지원 도구

### 5.1 Side-by-side Diff Viewer

- 자동 highlight 알고리즘 (다른 값 ★...★ 노란 배경)
- 핵심 필드 (formula, page_ref) 우선 표시

### 5.2 Subgraph Visualizer (D3.js Force Graph)

- 선택 노드의 1-hop 인접 그래프
- 검수자가 노드의 위치 + 영향 범위 5초 안에 파악

### 5.3 AI 신뢰도 표시

| 신뢰도  | 색상    | 의미                         |
| :------ | :------ | :--------------------------- |
| 95~100% | 🟢 초록 | 거의 확실, 일괄 처리 추천    |
| 80~94%  | 🟡 노랑 | 권고, 검수 후 채택           |
| 60~79%  | 🟠 주황 | 주의, 직접 검토              |
| <60%    | 🔴 빨강 | AI 판단 불가, 인간 결정 필수 |

### 5.4 Rollback (안전망)

- 결정 후 24시간 내 취소 가능
- 24시간 후 자동 확정

---

## 6. 일괄 처리 (Bulk Action)

### 6.1 자동 패턴 감지

같은 BATCH 의 같은 노드 타입 + 같은 임계값 범위 → 자동 그룹핑.

```
"BATCH-4 의 밭작물 산식 5건이 BATCH-1 의 적과전 산식 5건과
 0.95+ 유사도로 flag. 작물 카테고리만 다름."
[B] 5건 모두 Keep Both  [✓] 개별 검토  [✗] 일괄 모드 취소
```

### 6.2 안전 장치

- 같은 패턴만 그룹핑 (다른 카테고리 섞이면 자동 분리)
- 5초 카운트다운 + ESC 취소
- audit log 기록

---

## 7. 검수 진행률 + 게임화 (선택)

```
오늘의 검수: 87 / 100 (87%)
평균 시간: 4.2초/건  (목표 < 6초)
AI 채택률: 78% (BATCH-1 +12%p 개선)
일괄 처리: 35% (15분 절약)
큐 1: 4건 대기 / 큐 2: 0 / 큐 3: 0 ✅
```

### 정량 지표 (Success Metrics)

| 지표           | BATCH-1 | BATCH-7 | BATCH-14 |
| :------------- | :------ | :------ | :------- |
| 평균 결정 시간 | < 10초  | < 6초   | < 4초    |
| AI 추천 채택률 | > 60%   | > 75%   | > 80%    |
| 일괄 처리 비율 | > 20%   | > 35%   | > 50%    |
| Rollback 비율  | < 5%    | < 3%    | < 2%     |
| 일일 처리량    | 50      | 100     | 150+     |

---

## 8. 페이지 구조 (admin-web)

```
apps/admin-web/src/pages/
├── content/
│   ├── graph.astro                      # 기존 Graph Visualizer
│   └── review/                          # ★ 신규
│       ├── deduplication.astro          # 큐 1
│       ├── scope-warning.astro          # 큐 2
│       └── cbiv-block.astro             # 큐 3
├── batch/
│   ├── load.astro
│   ├── load-status.astro
│   └── golden-tests.astro               # Golden Test 모니터
└── system/
    ├── review-stats.astro
    └── review-history.astro             # audit log
```

### 컴포넌트

```
apps/admin-web/src/components/review/
├── ReviewQueue.tsx
├── DiffViewer.tsx
├── AiRecommendation.tsx
├── ActionPanel.tsx
├── BulkActionMode.tsx
├── SubgraphVisualizer.tsx
├── KeyboardShortcuts.tsx
├── ProgressDashboard.tsx
└── RollbackConfirmation.tsx
```

---

## 9. 백엔드 API

```
# 큐 1: 의미 중복
GET    /api/admin/review/deduplication
GET    /api/admin/review/deduplication/:flagId
POST   /api/admin/review/deduplication/:flagId
POST   /api/admin/review/deduplication/bulk

# 큐 2: 출제영역
GET    /api/admin/review/scope-warning
POST   /api/admin/review/scope-warning/:flagId

# 큐 3: CBIV 차단
GET    /api/admin/review/cbiv-block
POST   /api/admin/review/cbiv-block/:blockId

# AI 추천
POST   /api/admin/review/ai-recommendation

# 통계 + Rollback
GET    /api/admin/review/stats?period=today
GET    /api/admin/review/history?userId=...
POST   /api/admin/review/rollback/:decisionId
```

---

## 10. Phase / Epic / Task (Epic CBE-R7)

```
🌍 PHASE 1
   │
   └── 🏔️ Epic CBE-R7: 검수 UI 통합 (총 ~8h)
       │
       ├── 📖 Story R7.1: 백엔드 API (admin-web 지원)
       │   └── 7 task (각 ~15-25분)
       ├── 📖 Story R7.2: 핵심 컴포넌트 (DiffViewer / AiRecommendation / ActionPanel)
       │   └── 6 task
       ├── 📖 Story R7.3: 큐 페이지 구현 (3 큐 + E2E)
       │   └── 4 task
       ├── 📖 Story R7.4: 일괄 처리 + 진행률
       │   └── 4 task
       └── 📖 Story R7.5: Rollback + Audit
           └── 4 task

총 ~28 task × 평균 18분 ≈ 8시간 (1 spread)
```

---

## 11. 본 UI 의 무결성 (Vows)

- ❌ 한 번의 결정에 클릭 2회 이상 요구 금지 (One-click 원칙)
- ❌ AI 추천 없이 인간 결정 강요 금지 (사전 분석 필수)
- ❌ Audit log 없는 결정 처리 금지
- ❌ Rollback 불가능한 액션 금지 (24시간 buffer)
- ❌ 단축키 작동 안 하는 화면 금지
- ❌ 검수자 피로감 알림 무시 금지 (정량 지표 monitoring)

본 무결성이 깨지면 검수자가 시스템을 떠나고 → 자가 검증 능력 상실 → 자살.

---

## 12. 결정 6~10 확정 (v2.2, 메피스토펠레스 의견서 채택)

| #      | 결정              | 채택 옵션                           | 핵심 조건                                                                           |
| :----- | :---------------- | :---------------------------------- | :---------------------------------------------------------------------------------- |
| **6**  | 일괄 처리 임계값  | **(B) 3건 이상**                    | 학습 기간 (BATCH-1~3) 은 (A) 5건, BATCH-4+ 부터 (B) 3건. 같은 BATCH 내 누적 windows |
| **7**  | AI 추천 자동 채택 | **(B) 95%+ 표시 후 1-click**        | 80~94% 는 명시적 "근거 확인" 강제, 자동 채택 영구 금지 (**Rule 29**)                |
| **8**  | 진행률 게임화     | **(A) 진행률 + 누적 통계만**        | 비교 통계 (평균/최대/최소) 표시 금지, 배지/칭호 영구 미도입 (**Rule 30**)           |
| **9**  | Rollback 기간     | **(A) 24시간 + 다음 BATCH 진입 전** | 큐 3 = 1시간 (긴급), 큐 1/2 = 24h or 다음 BATCH (**Rule 31**)                       |
| **10** | 단축키 학습       | **(A) tutorial + (C) ? 키 결합**    | 첫 진입 tutorial overlay + ? 키 cheat sheet + Help 메뉴 재실행. 사이드바 미도입     |

### 12.1 결정 7 상세 — Rule 29 (AI 자동 채택 영구 금지)

```typescript
// 95%+ 추천: 1-click 채택 가능
// 80~94% 추천: 명시적 "근거 확인" 단계 강제 (1-click 금지)
// 어떤 신뢰도든 자동 채택 endpoint 부재 (의도적, Rule 29)

// audit log 명시 기록
{
  decision_type: 'merge',
  ai_recommendation: 'keep_both',
  ai_confidence: 0.92,
  human_action: '1-click-accept' | 'override' | 'evidence-confirmed-then-accept',
  reviewer_id: '...'
}

// 월 1회 AI 추천 정확도 monitoring
// (1-click 채택 후 Rollback 비율 → AI 추천 신뢰도 보정)
```

### 12.2 결정 8 상세 — Rule 30 (1인 검수자 burnout 방지)

```typescript
// 표시 OK
{
  todayProcessed: 87,
  queueWaiting: { q1: 4, q2: 0, q3: 0 }
}

// 표시 금지
{
  averageDecisionTime: '4.2초',     // ❌ self-comparison 압박
  weeklyAverage: '5.1초',            // ❌
  bestRecord: '3.1초',                // ❌
  rank: '검수의 달인',                // ❌ 게임화
  badges: ['100건 돌파', ...]         // ❌
}

// 통계는 audit log 에만 (UI 미표시)
// 요청 시 별도 페이지 (/admin/system/review-stats.astro)
```

### 12.3 결정 9 상세 — Rule 31 (Rollback 메커니즘)

```typescript
// review_decisions 테이블
ALTER TABLE review_decisions ADD COLUMN rollback_deadline INTEGER NOT NULL;

// 결정 시 자동 계산
function computeRollbackDeadline(queueType: 'q1' | 'q2' | 'q3'): number {
  if (queueType === 'q3') {
    return Date.now() + 60 * 60 * 1000;  // 1시간 (긴급)
  }
  return Math.min(
    Date.now() + 24 * 60 * 60 * 1000,    // 24시간
    nextBatchLoadTime ?? Infinity         // 다음 BATCH 진입
  );
}

// 진산님 부재 (휴가) 시: nextBatchLoadTime = Infinity → 24시간만 적용
// OPERATIONS_RISK.md §2.3 정합 — 부재 기간 BATCH 적재 차단으로 사실상 무한 연장
```

---

## 13. 결정 → DB 변경 매핑 (R-6 보강 v2.2)

각 액션이 D1 에 일으키는 변경 명세. **모든 액션은 INSERT-only — Hard Rule 1 (knowledge_nodes UPDATE 금지) 정합**.

### 13.1 큐 1 의미 중복 액션

| 액션          | 의도         | D1 변경                                                                                           | Hard Rule 정합 |
| :------------ | :----------- | :------------------------------------------------------------------------------------------------ | :------------- |
| **Merge**     | 두 노드 통합 | **SUPERSEDES 패턴** — 신규 v2 노드 INSERT (병합된 page_ref + 양쪽 메타) + 기존 두 노드 SUPERSEDES | ✅ Rule 1 정합 |
| **Reject**    | 신규 폐기    | 신규 노드 INSERT 안 함                                                                            | ✅             |
| **Keep Both** | 둘 다 별개   | 신규 노드 INSERT + RELATES_TO 엣지                                                                | ✅             |

### 13.2 Merge 패턴 상세 (R-6, SUPERSEDES 채택)

```sql
-- 시나리오: F-04 (사과 손해정도, page_ref="525:§4-2") + F-30 (밭작물, "543:§5-1") → Merge
-- 처리 (UPDATE 금지, 모두 INSERT):

INSERT INTO knowledge_nodes (id, name, page_ref, is_current_active, ...)
  VALUES ('F-04-v2', '손해정도비율 산식 (사과 + 밭작물 통합)',
          '["525:§4-2", "543:§5-1"]', 1, ...);

INSERT INTO knowledge_edges (from_node, to_node, relation)
  VALUES ('F-04-v2', 'F-04', 'SUPERSEDES');

INSERT INTO knowledge_edges (from_node, to_node, relation)
  VALUES ('F-04-v2', 'F-30', 'SUPERSEDES');

-- 자동 트리거 (마이그레이션 0015) 가 F-04, F-30 의 is_current_active=0 갱신
-- F-04-v2 는 default 1
```

### 13.3 큐 2/3 액션도 동일 — INSERT-only

| 액션                           | D1 변경                                                         |
| :----------------------------- | :-------------------------------------------------------------- |
| **Approve as Cross-Reference** | 신규 노드 INSERT + REFERENCES 엣지                              |
| **Reassign**                   | 신규 노드 보류 → 다른 BATCH 적재 시 재시도 (현 BATCH PR 미커밋) |
| **Auto-Fix Option 1/2**        | 신규 노드 정정 후 INSERT (PR commit 추가)                       |
| **Manual Fix**                 | 진산님 직접 정정 → PR commit                                    |

---

## 14. Rollback INSERT-only 메커니즘 (R-7 보강 v2.2)

Rollback 도 UPDATE 금지 (Hard Rule 1) — 새 결정 INSERT 패턴.

### 14.1 review_decisions 테이블

```sql
CREATE TABLE review_decisions (
  id TEXT PRIMARY KEY,
  decision_type TEXT NOT NULL,         -- 'merge' / 'reject' / 'keep_both' / 'approve' / ... / 'revert'
  flag_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  ai_recommendation TEXT NULL,
  ai_confidence REAL NULL,
  decided_at INTEGER NOT NULL,
  d1_changes JSON NOT NULL,             -- 적용된 D1 변경 내역 (Rollback 시 역연산 입력)
  rollback_deadline INTEGER NOT NULL,   -- Rule 31
  reverted INTEGER DEFAULT 0,           -- 트리거가 갱신 (메타만)
  reverted_at INTEGER NULL,
  reverted_by TEXT NULL,
  original_decision_id TEXT NULL,       -- 'revert' 결정 시 원 결정 참조
  PRIMARY KEY (id),
  FOREIGN KEY (original_decision_id) REFERENCES review_decisions(id)
);
```

### 14.2 Rollback 흐름 — 새 'revert' 결정 INSERT

```sql
-- 시나리오: F-04-v2 (Merge 결과) Rollback

-- 1. 새 'revert' 결정 INSERT
INSERT INTO review_decisions (id, decision_type, original_decision_id, ...)
  VALUES ('REV-XXX', 'revert', 'DEC-YYY-original-merge', ...);

-- 2. 원 결정의 d1_changes 역연산 (트리거 또는 Loader 코드)
--    원 결정: F-04-v2 INSERT + SUPERSEDES 엣지 2건
--    역연산: F-04-v2 의 is_current_active=0 (트리거가 별도 SUPERSEDES 안 받지만, 역연산 전용 메타 갱신)

-- 3. 원 결정의 reverted=1 갱신 (트리거가 메타만)
--    review_decisions UPDATE 가 아닌, reverted_status_log 같은 별도 추적 가능
```

**핵심**: knowledge_nodes 본문은 절대 UPDATE 안 함. Rollback 도 새 노드 또는 메타 갱신만.

### 14.3 Cross-BATCH Rollback 안전성

Rule 31 의 24h or 다음 BATCH 진입 전 — **다음 BATCH 진입 후 Rollback 차단**으로 Cross-BATCH 영향 추적 비용 회피 (메피스토펠레스 함정 2 회피).
