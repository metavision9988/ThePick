# CBIV (Cross-Batch Integrity Validator) — 핵심 설계도

> **답변 대상:** "현재 구상하신 8단계의 BATCH 적재 절차에서, Claude Code가 스스로 생성한 JSON 산출물이 기존에 적재된 다른 BATCH의 Graph 노드들과 논리적으로 충돌(모순)하지 않는지, 시스템적(자동화된)으로 교차 검증할 수 있는 장치는 어떻게 구체화할 계획이십니까?"
>
> **답변:** CBIV — 5단계 자동 차단 + 1단계 인간 결정 + 회귀 Golden Test 영구 보존
>
> **위치:** [재정립안 v2.0](./CONTENT_BUILD_ENGINE_REDESIGN_v2.md) §2-D, G + Epic CBE-R3

---

## 1. 한 장으로 보는 CBIV

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Claude Code 가 BATCH-N JSON 산출물 생성                         │
│  (Stage 3: 도메인 분석 완료, Level 1~3 통과)                      │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 6.5: CBIV 실행 (자동 30초 이내)                            │
└──────────────────────────────────────────────────────────────────┘

  ┌────────────────────────┐       ┌────────────────────────┐
  │ ① 참조 무결성           │       │ ② 의미 중복 감지        │
  │   - 외래키 검증         │  ✓    │   - 임베딩 코사인 유사도 │
  │   - exam_id 일치        │       │   - 0.85 초과 → flag    │
  │   - approved 상태       │       │   - 인간 결정 큐          │
  │ FAIL → 즉시 차단        │       │ FLAG → Stage 7.5         │
  └───────────┬────────────┘       └───────────┬────────────┘
              │                                 │
              ▼                                 ▼
  ┌────────────────────────┐       ┌────────────────────────┐
  │ ③ 상수 일관성           │       │ ④ SUPERSEDES 체인       │
  │   - 같은 name + 시점     │  ✓    │   - DFS 순환 감지        │
  │     numeric_value 충돌  │       │   - revision_change_id   │
  │   - unit 단위 일관성     │       │     필수                 │
  │ FAIL → 즉시 차단        │       │ FAIL → 즉시 차단         │
  └───────────┬────────────┘       └───────────┬────────────┘
              │                                 │
              └─────────────┬───────────────────┘
                            │
                            ▼
       ┌────────────────────────────────────────────┐
       │ ⑤ 회귀 Golden Test 재실행 (★ 핵심)          │
       │                                             │
       │ ✓ BATCH-1 ~ BATCH-(N-1) 의 모든 Golden Test │
       │   를 가상 D1 (BATCH-N 추가됨) 에서 재실행    │
       │                                             │
       │ ✓ 1건 fail → BATCH-N 적재 차단              │
       │                                             │
       │ ✓ 실패 원인 자동 분석:                       │
       │   "BATCH-N 의 어떤 노드가 BATCH-X 의        │
       │    어떤 Golden Test 를 깼는가"               │
       │                                             │
       │ FAIL → 즉시 차단 + 회귀 리포트              │
       └─────────────────────┬──────────────────────┘
                             │
                             ▼
       ┌────────────────────────────────────────────┐
       │ ⑥ 출제영역 정합성 (보조)                     │
       │                                             │
       │ ✓ 신규 노드의 exam_scope 가 BATCH 정의된     │
       │   영역과 일치                                │
       │                                             │
       │ ⚠️ Cross-BATCH REFERENCES 가능성 있음        │
       │ FAIL → 경고 + 진산님 검수 (자동 차단 아님)   │
       └─────────────────────┬──────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  CBIV 6단계 모두 통과 (또는 ⚠️ 만 있음)                            │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 7: 진산님 검수                                              │
│   - Level 1~3 결과                                                │
│   - CBIV 결과 + ⚠️ + Stage 7.5 의미 중복 flag 결정                │
└────────────────────────────┬─────────────────────────────────────┘
                             │ 승인
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 8: D1 INSERT (status='draft')                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 10: Golden Test 영구 보존 + CI/CD 등록                     │
│   - docs/measurements/golden-tests/batch-N-golden.json            │
│   - GitHub Actions: 매 PR 마다 BATCH-1~N 회귀 자동 실행           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Stage 5 (회귀 Golden Test) 상세 메커니즘

> "이게 제일 중요합니다." — BREAKER

```
[BATCH-N 적재 시도]
   │
   ▼
┌──────────────────────────────────────────────────────────────────┐
│  Step 1. Virtual D1 생성 (in-memory)                              │
│                                                                  │
│  const virtualDb = createVirtualDb();                            │
│                                                                  │
│  // BATCH-1 ~ BATCH-(N-1) 데이터 적재                             │
│  for batchNum in [1, 2, ..., N-1]:                                │
│    virtualDb.insert(loadBatchFromD1(batchNum))                    │
│                                                                  │
│  // 신규 BATCH-N 데이터 가상 적재                                  │
│  virtualDb.insert(newBatchData)                                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Step 2. 모든 BATCH 의 Golden Test 자동 실행                       │
│                                                                  │
│  failures = []                                                    │
│  for batchNum in [1, 2, ..., N]:                                  │
│    goldenTests = loadGoldenTests(batchNum)                        │
│    // 예: batch-1-golden.json — 30+ Golden Test                   │
│    //     "단감 인정피해율 (낙엽률 0.5, 경과일수 100) = ?"         │
│                                                                  │
│    for test in goldenTests:                                       │
│      // 가상 D1 에서 산식/노드/상수 조회 → 정답 도출               │
│      result = executeGoldenTest(virtualDb, test)                  │
│                                                                  │
│      if result.expected != result.actual:                         │
│        failures.append({                                          │
│          batchNumber: batchNum,                                   │
│          testId: test.id,                                         │
│          expected: result.expected,                               │
│          actual: result.actual,                                   │
│          rootCause: analyzeRootCause(test, newBatchData)          │
│        })                                                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Step 3. 결과 처리                                                 │
│                                                                  │
│  if failures.length > 0:                                          │
│    [차단] BATCH-N 적재 중단                                        │
│    [리포트] 회귀 실패 리포트 생성                                   │
│      "BATCH-N 의 신규 노드 X 가                                    │
│       BATCH-3 의 Golden Test 'Y' 를 깼습니다.                     │
│       원인: 노드 X 가 정의한 변수 'z' 가                           │
│       기존 산식 F-NN 의 변수와 충돌합니다."                        │
│    [알림] 진산님 즉시 알림                                          │
│  else:                                                            │
│    [통과] CBIV 다음 단계로 진행                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 회귀 실패 시나리오 예시

```
[가상 시나리오: BATCH-4 (밭작물) 적재 시도]

신규 BATCH-4 가 새 산식 F-30 정의:
  "밭작물 손해정도비율 산식"
  변수: 손해정도비율 임계값 = 0.20

[Stage 5 실행]
- BATCH-1 (적과전) Golden 재실행 ✓
- BATCH-2 (과수16종) Golden 재실행 ✓
- BATCH-3 (논작물) Golden 재실행 ✓
- BATCH-R1 (26년 개정) Golden 재실행 ✗
   FAIL: "26년 개정 손해정도비율 = 0.10" 테스트
   원인: BATCH-4 의 F-30 이 임계값 0.20 사용
   하지만 26년 개정 후 0.10 이어야 함

[자동 리포트]
"BATCH-4 의 F-30 이 BATCH-R1 의 26년 개정사항 (CONST-901, 0.10) 을
 무시하고 0.20 사용. 정정 필요:
 1. F-30 에서 임계값을 CONST-901 직접 참조로 변경
 2. 또는 F-30 에 SUPERSEDES F-30-old 패턴 적용"

[차단]
BATCH-4 적재 중단. 진산님 알림.
```

---

## 3. Golden Test 영구 보존 정책

> "삭제하면 학습자가 시험에서 떨어진다." — ORACLE

```
docs/measurements/golden-tests/
├── _registry.json              # 메타: 총 개수, 마지막 업데이트
│
├── batch-1-golden.json         # BATCH-1 의 30+ Golden Test
│   {
│     "batchNumber": 1,
│     "createdAt": "2026-04-26",
│     "tests": [
│       {
│         "id": "BATCH-1-GT-001",
│         "description": "단감 인정피해율 산식 (낙엽률 0.5, 경과일수 100)",
│         "inputs": {"낙엽률": 0.5, "경과일수": 100},
│         "expectedFormulaId": "F-06",
│         "expectedValue": 0.36475,
│         "tolerance": 0.0001
│       },
│       // ... 29건 더
│     ]
│   }
│
├── batch-2-golden.json
├── batch-3-golden.json
├── batch-r1-golden.json        # 26년 개정 Golden
└── ...
```

### CI/CD 자동 실행 (GitHub Actions)

```yaml
# .github/workflows/cbiv-regression.yml
name: CBIV Regression Tests

on:
  pull_request:
    paths:
      - 'packages/parser/**'
      - 'packages/formula-engine/**'
      - 'migrations/**'

jobs:
  regression:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        batch: [1, 2, 3, 4, 5, 'r1', 'r2']
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm cbiv:regression -- --batch ${{ matrix.batch }}

      # 1건이라도 fail → CI 실패 → PR 머지 차단
```

---

## 4. CBIV 실패 시 자동 분석 (root-cause-analyzer)

> "실패 원인을 인간이 분석하는 시스템은 결국 무너진다. 자동화 필수." — HACKER

```typescript
// packages/cbiv/src/runner/root-cause-analyzer.ts

interface FailureRootCause {
  category:
    | 'CONSTANT_CONFLICT'      // 상수 충돌 (예: 임계값 변경)
    | 'FORMULA_DEPENDENCY'     // 산식 의존성 깨짐
    | 'MISSING_REFERENCE'      // 참조 노드 누락
    | 'REVISION_INCONSISTENCY' // 개정사항 적용 누락
    | 'EXAM_SCOPE_MISMATCH'    // 출제영역 불일치
    | 'UNKNOWN';

  affectedNode: string;        // BATCH-N 의 문제 노드 ID
  brokenTest: string;          // 어떤 Golden 이 깨졌는가
  brokenTestBatch: number;     // 그 Golden 은 어느 BATCH 의 것인가

  suggestedFix: string;        // 자동 제안 정정 방향
  evidence: {
    queryUsed: string;         // CBIV 가 사용한 SQL
    expectedValue: any;
    actualValue: any;
  };
}

// 예시 출력
{
  "category": "REVISION_INCONSISTENCY",
  "affectedNode": "F-30",
  "brokenTest": "BATCH-R1-GT-005",
  "brokenTestBatch": "r1",
  "suggestedFix": "F-30 에서 임계값을 직접 사용하지 말고 CONST-901 참조로 변경. 또는 F-30 에 SUPERSEDES F-30-old 패턴 적용 (만약 신구 둘 다 보존 필요).",
  "evidence": {
    "queryUsed": "SELECT numeric_value FROM constants WHERE id='CONST-901'",
    "expectedValue": 0.10,
    "actualValue": 0.20  // F-30 의 하드코딩 값
  }
}
```

---

## 5. 6단계 자동화 수준 정리

| Stage              | 자동화    | 차단 권한 | 인간 개입                 |
| ------------------ | --------- | --------- | ------------------------- |
| ① 참조 무결성      | 100%      | 즉시 차단 | 없음 (정정 후 재실행만)   |
| ② 의미 중복        | 100% 감지 | flag 만   | **인간 결정 (Stage 7.5)** |
| ③ 상수 일관성      | 100%      | 즉시 차단 | 없음                      |
| ④ SUPERSEDES 체인  | 100%      | 즉시 차단 | 없음                      |
| ⑤ 회귀 Golden Test | 100%      | 즉시 차단 | 없음 (자동 리포트)        |
| ⑥ 출제영역 정합성  | 100% 감지 | 경고만    | **인간 결정 (Stage 7)**   |

**5단계 자동 차단** + **2단계 인간 결정** = **7개 검증 포인트**

---

## 6. 비판자 권고에 대한 직접 답변

> 비판자의 4개 추가 권고:
>
> 1. ✅ **D1 Graph Materialization 전략** → Materialized Active View (`is_current_active` 컬럼 + 트리거)
> 2. ✅ **다중 경로 폴백 정의** → Multi-Path Fallback 4단계 (Vector → Keyword → Topic → Honest Refusal)
> 3. ✅ **L3 회귀 테스트 파이프라인** → **CBIV Stage 5 (본 문서의 핵심)**
> 4. ✅ **하이브리드 RAG 정책** → 3-Stage Hybrid Search (Vector → Graph → Truth Weight)

**4건 모두 100% 수용 + 구체 설계 + 코드 위치 + 테스트 기준 명시.**

상세는 [CONTENT_BUILD_ENGINE_REDESIGN_v2.md](./CONTENT_BUILD_ENGINE_REDESIGN_v2.md) 참조.

---

## 7. 진산님께 — 결정 요청

본 CBIV 설계의 채택 여부 + 다음 5가지 결정:

### 결정 1. CBIV 완성 시점

- (A) BATCH-1 dry-run **전** 완성 (안전 우선, ~6시간 추가 작업)
- (B) BATCH-1 dry-run **후** 진행 (속도 우선, BATCH-2 부터 적용)

### 결정 2. 회귀 Golden Test 보존 위치

- (A) `docs/measurements/golden-tests/` (Git 추적, 검수 용이)
- (B) D1 별도 테이블 (런타임 조회 빠름)
- (C) 둘 다 (Git = SoT, D1 = 캐시)

### 결정 3. 의미 중복 임계값 (Stage 2)

- (A) 0.85 (보수적, 더 많은 flag)
- (B) 0.90 (관대, flag 적음)
- (C) 적응적 (BATCH 별 다름)

### 결정 4. CI/CD 자동 회귀 트리거

- (A) 매 PR 마다 (안전 우선, CI 시간 증가)
- (B) BATCH 적재 PR 만 (효율 우선)
- (C) 매 PR + 매일 야간 일괄 (균형)

### 결정 5. CBIV 실패 시 알림 채널

- (A) GitHub PR 코멘트 (개발자 대상)
- (B) 이메일 (진산님 직접)
- (C) 둘 다 + Slack/Discord

---

## 8. CBIV 의 본질 (요약)

> "BATCH-1 만 검증하면 BATCH-1 만 안전하다.
> BATCH-N 적재 시 BATCH-1~(N-1) 모두 재검증해야 시스템이 안전하다.
> 그 재검증은 인간이 할 수 없다.
> 그래서 CBIV 가 한다."

— DEV COVEN (BREAKER + ARCHITECT 합의)

---

## 부록: CBIV 의 4단계 태스크 분해 (TASK_HIERARCHY_EXPLAINED 기반)

```
🌍 PHASE 1
   │
   └── 🏔️ Epic CBE-R3: CBIV 모듈 신설 (총 ~6시간)
       │
       ├── 📖 Story R3.1: 패키지 설정 + 가상 D1 (~50분)
       │   ├── ✅ Task R3.1.1 [SETUP] packages/cbiv 패키지 초기화 (15분)
       │   ├── ✅ Task R3.1.2 [TEST] virtual-db 단위 테스트 (15분)
       │   └── ✅ Task R3.1.3 [IMPL] virtual-db.ts (20분)
       │
       ├── 📖 Story R3.2: Stage 1 (참조 무결성) (~35분)
       │   ├── ✅ Task R3.2.1 [TEST] 깨진 참조 10건 차단 (15분)
       │   └── ✅ Task R3.2.2 [IMPL] 1-referential.ts (20분)
       │
       ├── 📖 Story R3.3: Stage 2 (의미 중복) (~35분)
       ├── 📖 Story R3.4: Stage 3 (상수 일관성) (~30분)
       ├── 📖 Story R3.5: Stage 4 (SUPERSEDES 체인) (~35분)
       │
       ├── 📖 Story R3.6: Stage 5 (회귀 Golden Test) — 핵심 (~105분)
       │   ├── ✅ Task R3.6.1 [TEST] golden-test-runner 단위 테스트 (20분)
       │   ├── ✅ Task R3.6.2 [IMPL] golden-test-runner.ts (25분)
       │   ├── ✅ Task R3.6.3 [TEST] root-cause-analyzer 테스트 (15분)
       │   ├── ✅ Task R3.6.4 [IMPL] root-cause-analyzer.ts (25분)
       │   └── ✅ Task R3.6.5 [VERIFY] BATCH-1 → BATCH-2 회귀 시뮬레이션 (20분)
       │
       ├── 📖 Story R3.7: Stage 6 (출제영역) + 통합 (~50분)
       └── 📖 Story R3.8: 리포트 생성기 (~55분)
```

각 Task 는 RED → GREEN → REFACTOR 사이클 엄수 (TDD), 20분 초과 즉시 분할.
