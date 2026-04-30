# Step 4 — quality 결정성 Property Test (CBIV 무결성)

---

phase: 1
step: engine-hardening-step4
approved_by: 진산 (2026-04-27 Engine Hardening Roadmap v1.1 일괄 승인)
risk_level: L3
plan_version: 1.1
scope:

- packages/quality/src/**tests**/determinism.property.test.ts (Step 15a 본 세션 진행)
- packages/quality/src/**tests**/cycle-detection.property.test.ts (Step 15b 이연)
- packages/quality/src/normalizer.ts (Step 15a 본 세션 진행)
- packages/quality/src/**tests**/normalizer.test.ts (Step 15a 본 세션 신규)

---

## 변경 이력

- **v1.0 (2026-04-27)**: 초기 plan, Engine Hardening Roadmap v1.1 진산 승인 (본문 approved_by:TBD 는 갱신 누락 — v1.1 정정).
- **v1.1 (2026-04-30)**: Step 15 진입 시 plan ↔ 실측 갭 발견 → Step 15a / 15b scope 분할
  영속화 (contract.yaml AC-QU-1~AC-QU-6 phase_partitions 정합).
  - **근거**: Step 14 (parser, LLM 통합 가정) 와 달리 quality 는 순수 그래프 알고리즘 (LLM 영향
    X — `cost_per_validation_usd: 0` + 외부 호출 0건). 풀 결정성 검증 가능하나 본 세션 ≤ 3h
    권고 capacity 사유로 분할.
  - **15a 진행 (2026-04-30)**: normalizer.ts (181 LOC — violations 정렬 + SUPERSEDES_CYCLE
    canonical 회전 + dedupe + summary hash) + 13 단위 테스트 + AC-QU-1 결정성 (manual fixture
    5종 × 100 iter shuffle = 500 시나리오, Mulberry32 PRNG SEED_BASE=0x15a). 4-Pass CRITICAL
    4건 흡수 (contract.yaml phase_partitions / output_normalization 정정 / seed 고정 / Tarjan
    SCC 게이트 명시).
  - **15b 이연 (Engine Hardening 다음 세션)**: arbitraryGraph generator (50 random × 100 iter
    = 5000 시나리오) + AC-QU-2/3/4/6 본격 활성 + INVALID_ID/DUPLICATE_ID fixture +
    Tarjan SCC 비교 검증.
  - **시그니처 정정 (Naming Drift)**: plan §"Normalizer 설계" snake_case
    (`total_violations`/`violations_sorted`/`type_counts`) → 실 구현 camelCase
    (`totalViolations`/`violationsSorted`/`typeCounts`). NormalizedReport 5필드 (totalViolations,
    violationsSorted, typeCounts, stats, reportSummaryHash).
  - **input_normalization → output_normalization 정정**: contract.yaml v1.0 의
    `input_normalization: "sort_nodes_by_id_ascending"` 는 normalizer 의 실 동작 (입력은 변경
    하지 않고 graph-integrity.ts 의 IntegrityReport 출력을 정규화) 과 갭. 4-Pass CRITICAL Pass 4
    Silent Pivot 흡수 → contract.yaml v1.1 에서 `output_normalization` 으로 정정.

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

### v1.1 실측 (Step 15a 본 세션)

- 15a 본 세션 실측: ≈ 0.3d (~2시간) — normalizer.ts (181 LOC) + normalizer.test.ts
  (13 tests) + determinism.property.test.ts (5 tests, 5 fixture × 100 iter = 500 시나리오) +
  contract.yaml v1.1 (phase_partitions) + plan v1.1 + ROADMAP §3.2 갱신 + 4-Pass CRITICAL 4건
  흡수.
- 15b 추정: ≈ 0.3d~0.5d (arbitraryGraph generator + AC-QU-2/3/4/6 본격 활성 + Tarjan SCC 비교).

---

## 15b 진입 게이트 (의무)

다음 세션 Step 18 (자동 검증) 진입 직전 다음 항목 일괄 진행. 15a 의 결정성 검증은 manual
fixture 5종 entropy 한정이므로 15b 는 entropy 폭 + 알고리즘 한계 차단의 두 축.

1. **arbitraryGraph generator** — fast-check 기반 random graph 50종 × 100 iter = 5000 시나리오.
   매개변수: nodes(10~200), edges(20~500), orphanRate(0~0.2), brokenRate(0~0.1), cycleRate(0~0.05).
2. **AC-QU-2 orphan property test** — arbitraryGraph 100노드 × 5 고아 × 50 시나리오 모두 정확 식별.
3. **AC-QU-3 broken edge property test** — arbitraryGraph 200엣지 × 10 broken × 50 시나리오.
4. **AC-QU-4 cycle detection 5종 패턴** — self_loop / 2-cycle / 3-cycle / complex_scc / no_cycle 각
   50회 = 250 시나리오. **Tarjan SCC 비교 검증 필수** — naive DFS (`findSupersedeCycles`) 의
   "공유 노드 다중 SCC 누락" silent fail 차단. Tarjan 결과 ≠ DFS 결과 시 graph-integrity.ts
   알고리즘 격상 (ADR 트리거).
5. **AC-QU-6 1000 노드 < 5초 성능 측정** — arbitraryGraph 1000 노드 + 5000 엣지 단발성 +
   CI 환경 7초 임계 분리.
6. **INVALID_ID / DUPLICATE_ID property test** — 5 ViolationType 중 15a 미커버 2종 흡수.
7. **Hard Rule 16 재평가** — `validateGraphIntegrity(nodes, edges)` 가 examId 파라미터 미수용.
   Year 2 마이그레이션 0005 후 도입 시 시그니처 변경 필요 — 15b 시점 의도/계획 명시 (변경 없이
   유지 시 ADR 트리거).
8. **shuffle 1000 iter 상향 검토** — 현 100 iter × 5 fixture = 500 시나리오 → 15b arbitraryGraph
   합쳐 5500+ 시나리오. 15a manual 의 100 iter 가 충분한지 통계적 재평가.
9. **stats invariant 명시 단정** — property test 가 reportSummaryHash 만 비교하나 stats 필드
   각각의 invariant 도 별도 expect 추가 (회귀 시 원인 파악 가속).
10. **빈 graph fixture 추가** — capacity 0 (nodes=[], edges=[]) edge case property test.
11. **canonicalizeCyclePath 입력 검증** — path 가 닫힘이 아닌 비정상 cycle 입력 시 명시 거부.
12. **packages/quality/src/index.ts normalizer export 결정** — 15a 보류 (Step 14a 동일 패턴).
    외부 소비자 진입 시점 (apps/batch CBIV 통합 직전) 일괄 export.
