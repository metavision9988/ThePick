# CBIV — Cross-Batch Integrity Validator (v2.1)

> Content Build Engine 의 **5번째 코어 모듈** (v2.0 신설).
> 검토서 §2-D, G 의 본질적 응답 — Human-in-the-Loop 한계 + Cross-BATCH 자동 검증.
> 원본 다이어그램: [`review/CBIV_DESIGN_DIAGRAM.md`](./review/CBIV_DESIGN_DIAGRAM.md)
> 상위: [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md)

---

## 1. 본 모듈의 본질

> _"BATCH-1 만 검증하면 BATCH-1 만 안전하다._
> _BATCH-N 적재 시 BATCH-1~(N-1) 모두 재검증해야 시스템이 안전하다._
> _그 재검증은 인간이 할 수 없다. 그래서 CBIV 가 한다."_
>
> — DEV COVEN (BREAKER + ARCHITECT 합의, 검토서 §1.8)

### 1.1 해결하는 문제

기존 Validation Framework (Level 1~3) 의 한계:

- **단일 BATCH 내부 검증**에 집중
- BATCH 간 회귀는 진산님 수기 검수 의존
- 14 BATCH × 6 Layer 누적 시 **인간이 모든 cross-reference 추적 불가능**
- BATCH-5 적재가 BATCH-1 의 논리를 깨뜨릴 위험

### 1.2 자동화 수준

5단계 자동 차단 + 1단계 자동 감지 (인간 결정) = **6 검증 포인트**.

| Stage                  | 자동화    | 차단 권한 | 인간 개입                 |
| :--------------------- | :-------- | :-------- | :------------------------ |
| ① 참조 무결성          | 100%      | 즉시 차단 | 없음                      |
| ② 의미 중복            | 100% 감지 | flag      | **인간 결정 (Stage 7.5)** |
| ③ 상수 일관성          | 100%      | 즉시 차단 | 없음                      |
| ④ SUPERSEDES 체인      | 100%      | 즉시 차단 | 없음                      |
| ⑤ **회귀 Golden Test** | 100%      | 즉시 차단 | 없음 (자동 분석 리포트)   |
| ⑥ 출제영역 정합성      | 100% 감지 | 경고만    | **인간 결정 (Stage 7)**   |

---

## 2. 6단계 자동 검증 흐름

```
[BATCH-N JSON 산출물 (Level 1~3 통과)]
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Stage 6.5: CBIV 실행 (자동 30초 이내, D1 Preview Database)        │
└─────────────────────────────────────────────────────────────────┘

  ┌────────────────────────┐    ┌────────────────────────┐
  │ ① 참조 무결성           │    │ ② 의미 중복 감지        │
  │   외래키 + exam_id +    │ →  │   Adaptive Threshold    │
  │   approved 상태         │    │   (Ontology 타입별)     │
  │ FAIL → 즉시 차단        │    │ FLAG → Stage 7.5        │
  └───────────┬────────────┘    └───────────┬────────────┘
              │                              │
              ▼                              ▼
  ┌────────────────────────┐    ┌────────────────────────┐
  │ ③ 상수 일관성           │    │ ④ SUPERSEDES 체인       │
  │   exact-match 정책      │ →  │   DFS 순환 + revision_  │
  │   (임계값 무관)          │    │   change_id NOT NULL    │
  │ FAIL → 즉시 차단        │    │ FAIL → 즉시 차단        │
  └───────────┬────────────┘    └───────────┬────────────┘
              │                              │
              └──────────────┬───────────────┘
                             ▼
       ┌─────────────────────────────────────────────┐
       │ ⑤ 회귀 Golden Test 재실행 (★ 핵심)           │
       │                                              │
       │ - D1 Preview Database 환경에 BATCH-1~(N-1) + │
       │   신규 BATCH-N 데이터 가상 적재               │
       │ - BATCH-1~N 의 모든 Golden Test 자동 재실행   │
       │ - 1건 fail → BATCH-N 적재 차단              │
       │ - root-cause-analyzer 자동 분석              │
       │                                              │
       │ FAIL → 즉시 차단 + 회귀 리포트 + PR 코멘트   │
       └─────────────────────┬───────────────────────┘
                             ▼
       ┌─────────────────────────────────────────────┐
       │ ⑥ 출제영역 정합성 (보조)                      │
       │   exam_scope vs BATCH 정의 영역              │
       │   FAIL → 경고 (Cross-BATCH REFERENCES 가능성)│
       └─────────────────────┬───────────────────────┘
                             ▼
[CBIV 6단계 통과] → Stage 8 D1 INSERT
[CBIV 실패] → 자동 차단 + 리포트 + 정정 후 재검증
```

---

## 3. Stage 5 동작 (BATCH-N 별, R-8 보강 v2.2)

| BATCH             | Stage 5 동작                                                                                                                                                                        |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N=1 (BATCH-1)** | **Self-validation** — BATCH-1 자체 Golden Test 실행 (CBIV 동작 검증 자체가 목적). 이전 BATCH 0건이라 회귀는 없으나 CBIV runner / D1 Preview / root-cause-analyzer 의 기본 동작 검증 |
| **N≥2**           | BATCH-1 ~ BATCH-(N-1) + BATCH-N 의 모든 Golden Test 회귀 실행                                                                                                                       |

BATCH-1 self-test 가 통과해야 CBIV 자체가 production-ready 인증.

---

## 4. Stage 5 (회귀 Golden Test) 상세 메커니즘 — ★ 핵심

### 3.1 D1 Preview Database 환경 (v2.1)

v2.0 의 in-memory `better-sqlite3` 폐기 → **D1 Preview Database** (Wrangler `--preview`).

**근거** (검토서 §2 MR-1):

- BATCH-14 누적 시 in-memory ~620 노드 + 2000 엣지 → 128MB 한계 위험
- in-memory ≠ production D1 (SQL 방언 차이)

**해법** (Hard Rule 25):

- CI/CD: `wrangler d1 create cbiv-pr-{N} --preview` (PR 단위 임시 인스턴스)
- 로컬: `wrangler d1 execute --local` (1차 검증, CI 가 게이트)

### 3.2 회귀 실행 로직

```typescript
// packages/cbiv/src/runner/d1-preview-runner.ts (v2.1)

export async function runRegressionGoldenTests(
  newBatchData: BatchData,
  prevBatches: number[],
  target: DbTarget, // ★ v2.1: { type: 'preview', databaseName: 'cbiv-pr-N' }
): Promise<RegressionResult> {
  // 1. D1 Preview 인스턴스에 마이그레이션 적용
  await applyMigrations(target);

  // 2. 기존 BATCH-1 ~ BATCH-(N-1) 데이터 적재
  for (const batchNum of prevBatches) {
    const prevBatch = await loadBatchFromProductionD1(batchNum);
    await insertToTarget(target, prevBatch);
  }

  // 3. 신규 BATCH-N 데이터 가상 적재
  await insertToTarget(target, newBatchData);

  // 4. 모든 BATCH 의 Golden Test 자동 실행
  const failures: GoldenTestFailure[] = [];
  for (const batchNum of [...prevBatches, newBatchData.batchNumber]) {
    const goldenTests = await loadGoldenTests(batchNum);

    for (const test of goldenTests) {
      const result = await executeGoldenTest(target, test);
      if (!matchesExpected(result, test)) {
        failures.push({
          batchNumber: batchNum,
          testId: test.id,
          expected: test.expected,
          actual: result.actual,
          rootCause: await analyzeRootCause(test, newBatchData), // ★ 자동 분석
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

### 3.3 Root Cause Analyzer (자동 분석)

```typescript
// packages/cbiv/src/runner/root-cause-analyzer.ts

interface FailureRootCause {
  category:
    | 'CONSTANT_CONFLICT' // 상수 충돌 (예: 임계값 변경)
    | 'FORMULA_DEPENDENCY' // 산식 의존성 깨짐
    | 'MISSING_REFERENCE' // 참조 노드 누락
    | 'REVISION_INCONSISTENCY' // 개정사항 적용 누락
    | 'EXAM_SCOPE_MISMATCH' // 출제영역 불일치
    | 'UNKNOWN';

  affectedNode: string; // BATCH-N 의 문제 노드 ID
  brokenTest: string; // 깨진 Golden ID
  brokenTestBatch: number; // 깨진 Golden 의 BATCH 번호

  suggestedFix: string; // 자동 제안 정정
  evidence: { queryUsed: string; expectedValue: any; actualValue: any };
}
```

### 3.4 회귀 실패 시나리오 (예시)

```
[가상 시나리오: BATCH-4 (밭작물) 적재 시도]

신규 F-30 정의: 밭작물 손해정도비율 = imperative * 0.20  (← 하드코딩)

[Stage 5 실행]
- BATCH-1, 2, 3 Golden 재실행 ✓
- BATCH-R1 (26년 개정) Golden 재실행 ✗
   FAIL: "26년 개정 손해정도비율 = 0.10" 테스트
   원인: F-30 이 0.20 사용, 26년 개정 후 0.10 이어야 함

[자동 root-cause]
{
  category: "REVISION_INCONSISTENCY",
  affectedNode: "F-30",
  brokenTest: "BATCH-R1-GT-005",
  brokenTestBatch: "r1",
  suggestedFix: "F-30 에서 0.20 하드코딩 제거 → CONST-901 직접 참조 또는 SUPERSEDES",
  evidence: {
    queryUsed: "SELECT numeric_value FROM constants WHERE id='CONST-901'",
    expectedValue: 0.10,
    actualValue: 0.20
  }
}

[차단]
BATCH-4 적재 중단. PR 코멘트 자동 알림 (결정 5).
```

---

## 4. Adaptive Threshold (Stage 2, v2.1)

### 4.1 비판 (검토서 §2 MR-4)

단일 임계값 0.85 의 문제:

- "사과 낙엽률 산식 (F-04)" vs "단감 낙엽률 산식 (F-06)" — 텍스트 99% 동일, 다른 산식
- 단일 임계값 → False Positive 폭증 → alert fatigue → 검수자 피로

### 4.2 해법 — Ontology 타입별 임계값

`packages/parser/src/ontology-registry.json`:

```json
{
  "node_types": {
    "LAW": { "deduplication_threshold": 0.88 },
    "FORMULA": { "deduplication_threshold": 0.95 },
    "INVESTIGATION": { "deduplication_threshold": 0.9 },
    "INSURANCE": { "deduplication_threshold": 0.93 },
    "CROP": { "deduplication_threshold": 0.97 },
    "CONCEPT": { "deduplication_threshold": 0.85 },
    "TERM": { "deduplication_threshold": 0.88 }
  },
  "constants_dedup_policy": {
    "strategy": "exact_match",
    "fields": ["name", "valid_from", "valid_to"],
    "rationale": "Constants are exact-match domain — 임계값 무관"
  }
}
```

### 4.3 적용 — CBIV Stage 2

```typescript
// packages/cbiv/src/stages/2-deduplication.ts (v2.1)

const threshold = ontologyRegistry.node_types[newNode.type].deduplication_threshold;
const sameTypeExisting = existingNodes.filter((n) => n.type === newNode.type); // cross-type 비교 안 함

for (const existing of sameTypeExisting) {
  const similarity = await cosineSimilarity(newNode.embedding, existing.embedding);
  if (similarity > threshold) {
    flags.push({ newNodeId: newNode.id, existingNodeId: existing.id, similarity, threshold });
  }
}
```

Hard Rule 28 (Adaptive Threshold 의무).

---

## 5. Golden Test 영구 보존 정책

### 5.1 보존 위치 — Git + D1 둘 다 (결정 2, 결정 2 = C)

```
docs/measurements/golden-tests/         ← Git (SoT, PR 리뷰)
├── _registry.json                       메타 (총 개수, 마지막 갱신, 통과율)
├── batch-1-golden.json                  BATCH-1 의 30+ Golden Test
├── batch-2-golden.json
└── ...

D1 Table: golden_tests                  ← 런타임 캐시 (CI 빠른 쿼리)
├── batch_number, test_id, payload JSON, last_run_result
└── 트리거: docs/.../*.json 변경 → D1 sync
```

### 5.2 Golden Test 형식

```json
{
  "batchNumber": 1,
  "createdAt": "2026-04-26",
  "tests": [
    {
      "id": "BATCH-1-GT-001",
      "description": "단감 인정피해율 산식 (낙엽률 0.5, 경과일수 100)",
      "inputs": { "낙엽률": 0.5, "경과일수": 100 },
      "expectedFormulaId": "F-06",
      "expectedValue": 0.36475,
      "tolerance": 0.0001
    }
    // ... 29건 더
  ]
}
```

Hard Rule 24 (영구 보존, 진산님 승인 없이 삭제 금지).

---

## 6. 패키지 구조 (`packages/cbiv/`)

```
packages/cbiv/                       # 5번째 코어 패키지 (v2.0 신설)
├── src/
│   ├── index.ts                     # runCbiv(newBatchData, prevBatches, target)
│   ├── stages/
│   │   ├── 1-referential.ts         # 참조 무결성
│   │   ├── 2-deduplication.ts       # 의미 중복 (Adaptive Threshold)
│   │   ├── 3-coherence.ts           # 상수 일관성 (exact-match)
│   │   ├── 4-supersedes.ts          # SUPERSEDES 체인 (DFS)
│   │   ├── 5-regression.ts          # 회귀 Golden Test (★ 핵심)
│   │   └── 6-scope.ts               # 출제영역
│   ├── runner/
│   │   ├── db-target.ts             # DbTarget 인터페이스
│   │   ├── d1-preview-runner.ts     # ★ Cloudflare D1 Preview (v2.1)
│   │   ├── d1-local-runner.ts       # 로컬 1차 검증 (Wrangler --local)
│   │   ├── golden-test-runner.ts    # Golden Test 자동 실행
│   │   └── root-cause-analyzer.ts   # 자동 실패 분석
│   ├── reports/
│   │   ├── conflict-report.ts       # 충돌 리포트
│   │   └── regression-report.ts     # 회귀 리포트 + PR 코멘트
│   └── types.ts
├── tests/
│   ├── stages/
│   └── e2e/
│       └── batch-load-cbiv.test.ts
└── package.json
```

---

## 7. CI/CD 연동 (결정 4 = B)

`.github/workflows/cbiv-regression.yml`:

```yaml
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

      - name: Provision ephemeral D1
        run: |
          DB_NAME="cbiv-pr-${{ github.event.pull_request.number }}"
          wrangler d1 create $DB_NAME --preview
          echo "DB_NAME=$DB_NAME" >> $GITHUB_ENV

      - run: wrangler d1 migrations apply $DB_NAME --preview
      - run: pnpm cbiv:seed --target $DB_NAME --preview
      - run: pnpm cbiv:regression --target $DB_NAME --preview

      - name: Auto-comment on PR (결정 5)
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const report = require('./cbiv-report.json');
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: report.markdown
            });

      - if: always()
        run: wrangler d1 delete $DB_NAME --preview --yes
```

---

## 8. 테스트 기준 (CBIV 자체)

| 테스트 ID    | 항목             | 통과 기준                                                                    |
| :----------- | :--------------- | :--------------------------------------------------------------------------- |
| CBIV-T01     | Stage 1          | 깨진 참조 10건 주입 → 100% 차단                                              |
| CBIV-T02     | Stage 2 Adaptive | 7개 노드 타입별 임계값 정확 적용                                             |
| CBIV-T03     | Stage 3          | 상수 충돌 5건 → 100% 감지                                                    |
| CBIV-T04     | Stage 4          | 순환 SUPERSEDES → 100% 차단                                                  |
| **CBIV-T05** | **Stage 5 회귀** | **D1 Preview 환경, BATCH-N+1 추가 시 BATCH-N Golden 100% 재실행 + 회귀 0건** |
| CBIV-T06     | 응답 시간        | 30초 이내 (회귀 Golden 포함)                                                 |
| CBIV-T07     | 리포트           | 실패 시 root-cause 명확                                                      |
| CBIV-T08     | OOM 방지         | BATCH-14 시뮬, 메모리 100MB 이하                                             |
| CBIV-T09     | D1 정합          | Preview ↔ Production 같은 SQL 결과 (5종 핵심)                                |
| CBIV-T10     | False Positive   | 사과 낙엽률 vs 단감 낙엽률 → flag 안 됨                                      |
| CBIV-T11     | True Positive    | 의도적 중복 5건 → 100% flag                                                  |
| CBIV-T12     | Constants        | 임계값 무관 exact-match 100%                                                 |

---

## 9. Hard Rule 통합 (CBIV 관련)

| #   | 규칙                                                | 출처           |
| :-- | :-------------------------------------------------- | :------------- |
| 17  | 신규 BATCH 적재는 CBIV 6단계 통과 후에만 D1 INSERT  | v2.0 결함 D, G |
| 21  | Golden Test 영구 보존 + CI/CD 자동 재실행           | v2.0 결함 D, G |
| 22  | CBIV 회귀 검증은 D1 Preview Database 환경에서만     | v2.1 MR-1      |
| 25  | 의미 중복 검증은 Ontology 타입별 적응형 임계값 의무 | v2.1 MR-4      |

---

## 10. 본 모듈의 무결성 (Vows)

- ❌ CBIV 우회 (단일 BATCH 검증만으로 적재) 금지
- ❌ in-memory SQLite 로 회귀 검증 금지 (D1 Preview 만)
- ❌ Golden Test 진산님 승인 없이 삭제 금지
- ❌ 단일 스칼라 임계값으로 의미 중복 검증 금지
- ❌ Stage 5 (회귀 Golden) 우회 또는 timeout 으로 skip 금지

본 무결성이 깨지면 BATCH 누적 시 시스템 자체가 무너진다 (검토서 핵심 발견).
