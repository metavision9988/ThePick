# quality — Stage 0 Research

**작성일:** 2026-04-27
**Engine:** `@thepick/quality`
**Domain Profile:** Library (primary) + Batch-Build (secondary)
**DEFCON:** **L3** (v1.1 격상 — Review A-1)
**Status:** Researched

---

## 1. 도메인 경계 (Bounded Context)

ThePick 지식 그래프의 **무결성 검증** 단일 책임. 입력: `(nodes, edges)` → 출력: `IntegrityReport` (위반 목록). 위반 0건이어야 BATCH 적재의 Stage 6 (Graph 무결성 검증) 통과.

- **포함:** 고아 노드 탐지(`findOrphanNodes`), 끊긴 엣지 탐지(`findBrokenEdges`), SUPERSEDES 순환 탐지(`findSupersedeCycles`)
- **제외:** 노드/엣지 생성 (parser의 책임), DB 적재 (`apps/batch/loader/draft-loader.ts`), 산식 계산 검증 (formula-engine + Golden Test)

**향후 확장:** CBIV (Cross-Batch Integrity Validator) 6단계 — ADR-014. 현재 `apps/batch` 내부에 부분 구현, Phase 1 후반 `@thepick/quality`로 이전 검토.

---

## 2. 기존 엔진과의 차이

| 비교                | 일반 그래프 검증기 | quality                                                                 |
| :------------------ | :----------------- | :---------------------------------------------------------------------- |
| 검증 범위           | 일반 DAG           | ThePick의 9개 테이블 + 노드 타입 (CONCEPT/FORMULA/INSURANCE/CROP 등)    |
| Temporal Graph 인식 | UPDATE 허용        | UPDATE 금지 + INSERT + SUPERSEDES 패턴 인식 (Hard Limit)                |
| 위반 분류           | 단일 에러          | `ViolationType` enum (orphan/broken_edge/cycle 등) — 인간 검수 우선순위 |
| 출력                | true/false         | 상세 보고서 + 위반 노드/엣지 ID + 추적 가능                             |

→ ThePick 도메인 특화. Phase 1 후반 CBIV 통합 시 더 차별화.

---

## 3. 결합 패턴 (Volume III)

**Library Engine — 결합 패턴 N/A.** 호출 시점에만 작동. 단, BATCH 파이프라인 Stage 6에서 호출되며 Stage 7 (인간 검수)의 입력이 되므로 **Pipeline 의존성 핵심 노드**.

---

## 4. DEFCON 분류 (Volume I) — v1.1 격상

**L3** — Review A-1 권고 채택. 자동 트리거 2건 해당:

1. ✅ "데이터 파이프라인 (3단계+)" — CBIV는 6단계 검증 (Phase 1 후반 통합 시)
2. ✅ "Stateful Meta가 의존하는 결정자" — `apps/batch` Stage 6의 합격 기준이 본 엔진 출력

**v1.0 → v1.1 격상 사유:** 무결성 검증기 자체가 결함 있으면 그래프 오염 즉시 발견 불가 → 모든 후속 검증이 신뢰 불가. v3.0 Vol I.3 자동 L3 매칭.

---

## 5. SLA / Availability

| 항목                                        | 값              | 근거                         |
| :------------------------------------------ | :-------------- | :--------------------------- |
| `build_correctness`                         | 0.999           | L3 의무                      |
| `build_reproducibility.invariant_threshold` | **1.0 (100%)**  | 그래프 알고리즘 결정성 100%  |
| `build_reproducibility.tolerable_fields`    | `[]` (비어있음) | 결정성 보장 — 허용 변동 없음 |
| Latency (1000 노드 검증)                    | < 5s            | DAG 알고리즘 효율            |
| Availability                                | N/A (Library)   | —                            |

**핵심:** formula-engine과 동일하게 결정성 100% — `tolerable_fields` 비어있음.

---

## 6. Library 식별 3문항 (Vol XV.2)

|                 Q                 | 답     | 증거                                                                                              |
| :-------------------------------: | :----- | :------------------------------------------------------------------------------------------------ |
|    Q1: 같은 입력 → 같은 출력?     | ✅ YES | 그래프 알고리즘 결정성 (DFS·BFS 순회 순서가 입력 그래프에 의해 고정)                              |
| Q2: 인터페이스 보존 시 구현 교체? | ✅ YES | `validateGraphIntegrity` 함수 시그니처 명확 — naive DFS → 효율 알고리즘 (Tarjan SCC 등) 교체 가능 |
|    Q3: 외부 의존 없이 테스트?     | ✅ YES | 외부 의존 0 (npm 의존성 없음) — 순수 TypeScript                                                   |

→ 3/3 PASS. Library 자격 충족.

---

## 7. 기존 자산 (이미 존재)

| 항목                     | 위치                                                | 상태                       |
| :----------------------- | :-------------------------------------------------- | :------------------------- |
| 무결성 검증 엔트리       | `src/graph-integrity.ts` (`validateGraphIntegrity`) | ✅                         |
| 고아 노드 탐지           | `findOrphanNodes`                                   | ✅                         |
| 끊긴 엣지 탐지           | `findBrokenEdges`                                   | ✅                         |
| SUPERSEDES 순환 탐지     | `findSupersedeCycles`                               | ✅                         |
| 단위 테스트              | `__tests__/graph-integrity.test.ts`                 | ✅                         |
| **결정성 Property Test** | —                                                   | **❌ 보강 필요 (Step 15)** |
| **CBIV 6단계 통합**      | (현재 `apps/batch` 내부에 분산)                     | ⏳ Phase 1 후반 통합 검토  |
| engine.contract.yaml     | `docs/engines/quality/contract.yaml`                | ✅ (Step 6)                |

---

## 8. Engine Hardening 차단 항목

- ✅ Library 식별 3문항 (3/3 PASS)
- ⏳ Property Test (Step 15): 동일 그래프 입력 → 100회 동일 IntegrityReport
- ⏳ contract.yaml ACCEPTED (Step 6 — 본 파일)
- ⏳ Step 18 자동 검증

---

## 9. 위험 / Devil's Advocate

| 위험                                                  | 근거          | 완화                                                                                      |
| :---------------------------------------------------- | :------------ | :---------------------------------------------------------------------------------------- |
| 입력 그래프 순서 의존성 (nodes 배열 순서가 결과 영향) | 알고리즘 설계 | 입력 정규화 (정렬) + Property test에서 무작위 순서 100회 검증                             |
| 대규모 그래프(노드 10K+) 시 메모리 폭발               | 알고리즘 효율 | BATCH-Q 시점 기준 ~620 노드 — 충분히 작음. Phase 4 누적 시 재평가                         |
| SUPERSEDES 다중 체인 (A→B→C→A) 미감지                 | 그래프 복잡도 | Tarjan SCC 또는 Topological Sort 기반 강한 알고리즘 사용 + Property test에 cycle 시나리오 |
| 새 노드 타입 추가 시 검증 누락                        | 도메인 확장   | ontology-registry.json 변경 시 quality 회귀 테스트 의무                                   |
| CBIV 통합 시 결정성 약화 가능성                       | Phase 1 후반  | 통합 시점에 본 contract 재평가 — 결정성 보장 검증                                         |

---

## 10. v3.1 헌법 패치 후보 도출

본 엔진의 v1.0 → v1.1 L2→L3 격상 사례는 **v3.1 헌법 후보 #2** (Review B-2):

- v3.0 Vol XVI Solo-Builder 차등표는 'Solo + L1/L2'를 가정
- 'Solo + L3' 조합 명시 필요 — quality는 Solo 단계라도 L3 의무
- v3.1에서 Vol XVI 차등표 강화

---

## 11. 다음 단계

- Step 6 (본 파일)
- Step 10 (`step4-quality-determinism.plan.md`)
- Step 15 (Property Test 코드 — graph isomorphism 결정성)
- Phase 1 후반 (CBIV 통합 검토 — 별도 ADR)
