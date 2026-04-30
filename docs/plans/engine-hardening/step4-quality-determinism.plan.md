# Step 4 — quality 결정성 Property Test (CBIV 무결성)

---

phase: 1
step: engine-hardening-step4
approved_by: TBD
risk_level: L3
scope:

- packages/quality/**tests**/determinism.property.test.ts (신규)
- packages/quality/**tests**/cycle-detection.property.test.ts (신규)
- packages/quality/src/normalizer.ts (신규 — IntegrityReport 정규화)

---

## 목적

quality 엔진의 **결정성 100%** 검증. `validateGraphIntegrity(nodes, edges)` — 입력 순서 무관하게 동일 그래프 → 동일 IntegrityReport 출력. v3.0 Vol XV.3 #1 + v1.1 L3 격상 (Review A-1) 의무.

## 근거

- contract.yaml AC-QU-1, AC-QU-4 (`docs/engines/quality/contract.yaml`)
- v3.0 Vol XV.3 #1 (Property Test 의무)
- Engine Hardening Roadmap v1.1 §0.5 A-1 (quality L3 격상)

---

## 대상 파일

### 신규

- `packages/quality/__tests__/determinism.property.test.ts` — 100회 반복 결정성
- `packages/quality/__tests__/cycle-detection.property.test.ts` — SUPERSEDES cycle 시나리오
- `packages/quality/src/normalizer.ts` — `normalizeReport()` (정렬 + canonical form)

---

## Normalizer 설계

```typescript
// packages/quality/src/normalizer.ts
export interface NormalizedReport {
  total_violations: number;
  violations_sorted: NormalizedViolation[]; // sorted by (type, targetId)
  type_counts: Record<ViolationType, number>;
  report_summary_hash: string; // SHA-256 of canonical JSON
}

export function normalizeReport(report: IntegrityReport): NormalizedReport;
export function compareReports(a: IntegrityReport, b: IntegrityReport): 'equal' | 'differs';
```

핵심: 입력 순서 의존성 제거 (nodes/edges를 정렬한 후 검증).

---

## Test Strategy

### 1. 결정성 Property Test (AC-QU-1)

```typescript
import fc from 'fast-check';
import { validateGraphIntegrity } from '../src';
import { compareReports } from '../src/normalizer';

test('quality determinism — random node/edge order, 100 iterations', () => {
  fc.assert(
    fc.property(
      arbitraryGraph({
        nodes: 100,
        edges: 200,
        orphanRate: 0.1,
        brokenRate: 0.05,
        cycleRate: 0.02,
      }),
      (graph) => {
        const reports: IntegrityReport[] = [];
        for (let i = 0; i < 100; i++) {
          // 매 iteration 마다 input 순서 무작위화
          const shuffled = shuffle(graph.nodes, graph.edges);
          reports.push(validateGraphIntegrity(shuffled.nodes, shuffled.edges));
        }
        const baseline = reports[0];
        for (let i = 1; i < 100; i++) {
          expect(compareReports(baseline, reports[i])).toBe('equal');
        }
      },
    ),
    { numRuns: 50 }, // 50 random graphs × 100 iter = 5000 시나리오
  );
});
```

### 2. SUPERSEDES Cycle Detection Property Test (AC-QU-4)

| 시나리오                                  | 검증                       |
| :---------------------------------------- | :------------------------- |
| Self-loop (A→A)                           | `findSupersedeCycles` 식별 |
| 2-cycle (A→B→A)                           | 식별                       |
| 3-cycle (A→B→C→A)                         | 식별                       |
| Complex SCC (5개 노드 강한 연결 컴포넌트) | 식별                       |
| No cycle (DAG)                            | 0건 보고                   |

각 시나리오 50회 무작위 그래프로 검증.

### 3. 고아 / 끊긴 엣지 Property Test (AC-QU-2, AC-QU-3)

| 시나리오                                        | 검증                                       |
| :---------------------------------------------- | :----------------------------------------- |
| 100노드 중 5개 고아 (엣지에 미참여)             | `findOrphanNodes`가 정확히 5개 식별        |
| 200엣지 중 10개 broken (from/to가 nodes에 없음) | `findBrokenEdges`가 정확히 10개 식별       |
| 동일 엣지 중복 (A→B 2건)                        | 1건만 보고 또는 모두 보고 (사양 명시 필요) |

### 4. 성능 Property Test (AC-QU-6)

- 1000 노드 + 5000 엣지 그래프 1회 검증
- `performance.now()` 측정 — 5초 이내

---

## 위험 분석

| 위험                                                        | 완화                                              |
| :---------------------------------------------------------- | :------------------------------------------------ |
| `arbitraryGraph` generator 결함 (예: 항상 같은 그래프 생성) | seed 고정 + 다양한 size 매개변수                  |
| 입력 순서 의존성 (`nodes` 배열 순서가 결과 영향)            | `normalizeReport()` 적용 + 100회 무작위 순서 검증 |
| Cycle detection 알고리즘 결함 (복잡 SCC 누락)               | 수동 fixture 5종 + Tarjan SCC 알고리즘 검증       |
| 1000 노드 검증이 5초 초과 (CI 환경 차이)                    | 임계를 환경별 조정 (CI 7초, 로컬 5초)             |
| `IntegrityReport` 직렬화 비결정성 (Map iteration 순서)      | `normalizeReport()`가 모든 키 sort 보장           |

---

## 검증 계획 (Acceptance Criteria)

### AC-QU-1: 결정성 100%

- 50 random graphs × 100 iterations = 5000 시나리오
- 모든 시나리오에서 `compareReports(baseline, current) === "equal"`

### AC-QU-2/3: 고아·끊긴 엣지 정확 식별

- 50 시나리오 × 4종 패턴 = 200 시나리오 모두 정확

### AC-QU-4: Cycle detection 5종 패턴

- 5종 × 50회 = 250 시나리오 모두 식별

### AC-QU-5: 외부 의존 0

- `package.json` audit (런타임 의존성 비어있음)

### AC-QU-6: 1000 노드 < 5초

- 단발성 측정 (CI 환경 7초 임계 적용)

### Coverage

- `packages/quality/src/graph-integrity.ts` — 100%
- `packages/quality/src/normalizer.ts` (신규) — 100%

---

## 롤백 전략

- 새 test 파일 삭제
- `normalizer.ts` 삭제 (사용처 없음 — 신규)
- 기존 `graph-integrity.ts` 보존

---

## 승인 기록

- 의존성: contract.yaml AC-QU-1~7 정의 → 본 plan 구현
- 진산님 승인: 2026-04-27 Engine Hardening Roadmap v1.1

---

## 의존성

- **Blocked by:** Step 6 (quality contract.yaml — 완료)
- **Blocks:** Step 18 (자동 검증)
- **참조:** Review A-1 (L3 격상), contract.yaml AC-QU-\*

---

## 작업 추정

- 낙관: 0.5d (graph-integrity.ts 단순)
- 현실: 1d (×1.5 — `arbitraryGraph` generator 작성)
- 비관: 1.5d
