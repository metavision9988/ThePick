# Sprint 1 §5.1 4-Pass 독립 에이전트 리뷰 통합 인덱스

**리뷰일**: 2026-05-01 ~23:38 KST
**대상 commit**: `1c54a85` — fix(quality): naive recursive DFS → iterative DFS — Sprint 1 §5.1 CRITICAL-N1 흡수
**리뷰 방식**: 독립 에이전트 4개 병렬 위임 (자가 리뷰 0건)

---

## 1. 리뷰 구성

| Pass | 에이전트              | 결과                               |
| :--: | :-------------------- | :--------------------------------- |
|  1   | silent-failure-hunter | Critical 0 / Major 3 / Minor 2     |
|  2   | backend-architect     | **Critical 1** / Major 2 / Minor 3 |
|  3   | security-engineer     | Critical 0 / Major 2 / Minor 2     |
|  4   | code-reviewer         | Critical 0 / Major 2 / Minor 0     |

**리뷰 범위**: 변경 2건 + 연관 6건 (apps/batch/src/pipeline.ts:992-1034, qg2-validator.ts:142-171, recover.ts:238, packages/quality/src/index.ts, normalizer.ts, determinism.property.test.ts)

---

## 2. 종합 판정

| 분류                 |          건수           | 즉시 흡수 / 이월               |
| :------------------- | :---------------------: | :----------------------------- |
| 🔴 **CRITICAL**      | **1건 (Pass 2/3 동일)** | **즉시 흡수 의무**             |
| 🟠 MAJOR (즉시 흡수) |           3건           | 본 commit 후속 fix             |
| 🟠 MAJOR (이월)      |           4건           | Sprint 1 §5.2 또는 보고서 v1.2 |
| 🟡 MINOR             |           7건           | 보고만                         |

---

## 3. CRITICAL 상세

### 🔴 CRITICAL-1 — `SupersedeChainTooDeepError` caller 측 처리 미통합

- **출처**: Pass 2 C1 + Pass 3 MAJOR-1 (동일 이슈, 두 Pass 독립 발견 = 신뢰도 ↑)
- **위치**:
  - `packages/quality/src/graph-integrity.ts:325` `validateGraphIntegrity` (JSDoc `@throws` 누락)
  - `apps/batch/src/qg2-validator.ts:142-171` `checkGraphIntegrity` (try/catch 자체 부재 — throw 직접 전파)
  - `apps/batch/src/pipeline.ts:992-1034` `stageIntegrityCheck` (runStage:733-741 일반 catch가 `err.message`만 추출 → `code`/`depth`/`maxDepth` 메타 손실)
  - `apps/batch/src/recover.ts:238` (`CheckpointCorruptedError` 분기 옆에 `SupersedeChainTooDeepError` 분기 없음)
  - `packages/quality/src/index.ts` (`MAX_SUPERSEDE_CHAIN_DEPTH`, `SupersedeChainTooDeepError` re-export 누락)
- **증거**: 본 commit 이전 `findSupersedeCycles`는 `Violation[]` 만 반환했음. 본 commit이 throw 가능 (`SupersedeChainTooDeepError`)으로 시그니처 의미 변경했으나 caller 측은 변경 무인지. 결과:
  1. **silent breaking change**: caller가 try/catch 미감쌈 → throw가 stack 전체 전파 → BATCH `runStage` 일반 catch가 `err.message`만 직렬화 → `code`/`depth`/`maxDepth` 메타데이터 손실
  2. **DoS 2차 위험**: 공격자가 50001 깊이 chain 입력 → throw → BATCH `failed` → recover.ts가 동일 입력 재시도 가능 (`SupersedeChainTooDeepError` 분기 부재 → 무한 재시도 루프)
  3. **외부 패키지 instanceof 검사 불가**: `packages/quality/src/index.ts`가 신규 export 미추가 → caller가 `error.code === 'SUPERSEDE_CHAIN_TOO_DEEP'` 문자열 비교만 가능
- **OWASP / ASVS**: V7.4.1 (security event logging) 미충족 — error code 손실로 SIEM/observability 추적 불가
- **조치 (즉시 흡수, 4건)**:
  1. `packages/quality/src/index.ts` — `MAX_SUPERSEDE_CHAIN_DEPTH`, `SupersedeChainTooDeepError` re-export 추가
  2. `packages/quality/src/graph-integrity.ts` — `findSupersedeCycles` + `validateGraphIntegrity` JSDoc `@throws SupersedeChainTooDeepError` 명시
  3. `apps/batch/src/qg2-validator.ts:142-171` `checkGraphIntegrity` — `SupersedeChainTooDeepError` instanceof 분기 추가 → `passed: false, actual: 'CHAIN_TOO_DEEP'` graceful degradation
  4. `apps/batch/src/recover.ts:238` 또는 적절 위치 — `SupersedeChainTooDeepError` 분기 추가 → `recovery_failed` + `severity: 'critical'` + `manual_review_required`
- **테스트 추가 의무**: qg2-validator.test.ts + recover.test.ts에 신규 케이스 추가

---

## 4. MAJOR 상세

### 🟠 MAJOR-2-M1 / Pass 1-MAJOR-2 — `error.depth` 의미 모호 (즉시 흡수)

- **위치**: `graph-integrity.ts:218-223`
- **증거**: throw 시 `error.depth = stack.length = MAX + 1 = 50_001`. 입력 chain 100K 여도 동일. 운영자가 "이 chain이 얼마나 깊은가" 진단 불가. Pass 1 Major-2 와 동일.
- **조치**: error message에 "chain has at least {depth} nodes (cut off at sentinel)" 명시 + `depth` 필드 이름 의미 명확화 (`triggeredAt` 또는 doc 주석 보강)

### 🟠 MAJOR-2 — `path.indexOf(next)` O(depth) cycle 발견 시 — Workers 50ms 위협 (이월)

- **출처**: Pass 2 M2 + Pass 3 M2 부분 정합
- **위치**: `graph-integrity.ts:241` `path.indexOf(next)`
- **증거**: 50K depth 정상 chain 통과는 OK이나, **cycle이 50K depth 끝에 있는 경우**: cycle 발견 시 `path.indexOf` 50K 선형 탐색. 다중 cycle (cycle-heavy graph) 시 50K × N 연산 → Workers 50ms 위협.
- **완화**: 본 commit은 Node.js apps/batch worker (CPU 30s paid tier) 에서만 호출 → edge worker 한계 미적용. 하지만 미래 호출 경로 변경 시 위협.
- **조치 (이월)**: `pathIndex: Map<string, number>` 보조 자료구조 도입 (Sprint 1 §5.2 또는 차후 microbench 회귀 시점)

### 🟠 MAJOR-3 (Pass 3 M2) — Heap 누적 sentinel 부재 (이월)

- **위치**: `graph-integrity.ts:218-224` (현재는 stack length만 sentinel)
- **증거**: 49,999 깊이 chain × 100개 = 5M 노드 입력 시 sentinel 통과 → `visited` Set 5M entries → ~250MB → Workers heap 128MB 초과 위험.
- **조치 (이월)**: `validateGraphIntegrity` 진입점에 `nodes.length > MAX_GRAPH_NODES` / `edges.length > MAX_GRAPH_EDGES` sentinel 추가 (Sprint 1 §5.2 또는 Phase 1 후속)

### 🟠 MAJOR-4 (Pass 4 MAJOR-1) — Tarjan SCC 흡수 결정 미명시 (즉시 흡수)

- **위치**: commit 메시지 + `docs/ENGINE_HARDENING_COMPLETION_REPORT.md` v1.1 §10.7 #6
- **증거**: Sprint 0 baseline §5.1 표 line 316 "Tarjan SCC 비교 구현 (sanity 검증용) | 4h | 🟠" 의 처리 결정 미명시. iterative + sentinel 가 §10.7 #6 결론 (Tarjan 도입 결정) 충분 여부 명시 부재.
- **조치 (즉시 흡수)**: 본 흡수 commit에 결정 명시 — "iterative DFS + sentinel 50K 가 N=20K 통과 + Worker 50ms 정합 → Tarjan 미도입 (Year 2 멀티시험 확장 시 재검토)"

### 🟠 MAJOR-5 (Pass 4 MAJOR-2) — `ENGINE_HARDENING_COMPLETION_REPORT.md` §10.7 #6 미갱신 (이월 — v1.2 별도)

- **위치**: `docs/ENGINE_HARDENING_COMPLETION_REPORT.md:1008` (#6 행) + §0 Executive Summary line ~60
- **증거**: §10.7 #6 "naive DFS 임계 노드 수 미측정"이 Sprint 0 baseline + 본 commit으로 해소되었으나 보고서 갱신 부재.
- **조치 (이월)**: ENGINE_HARDENING_COMPLETION_REPORT v1.2 별도 commit (Phase B v1.1 갱신과 동일 패턴). 본 commit과 분리 — "리뷰 산출물 + 보고서 갱신 분리" 정합.

### 🟠 MAJOR-6 (Pass 1 MAJOR-1) — `MAX_SUPERSEDE_CHAIN_DEPTH` boundary 회귀 부재 (이월)

- **위치**: `graph-integrity.test.ts:257-261`
- **증거**: 50_001 throw만 검증. 정확 boundary `= 50_000` (통과) / `= 50_001` (throw) 미검증 → 미래 `>` → `>=` 변경 시 silent regression 위험.
- **조치 (이월)**: 회귀 boundary 테스트 2건 추가 (Sprint 1 §5.4 또는 후속 microbench)

### 🟠 MAJOR-7 (Pass 2 M1) — Determinism property test multi-cycle 미커버 (이월)

- **위치**: `packages/quality/src/__tests__/determinism.property.test.ts`
- **증거**: 5종 manual fixture 모두 단일 cycle. iterative 전환이 multi-cycle reporting 순서 결정성 깨지 않는지 100 iter shuffle 검증 부재.
- **조치 (이월)**: Sprint 1 §5.4 PARTIAL 보강 시점에 추가

---

## 5. MINOR 7건 (보고만)

|   Pass    | 위치                                   | 내용                                                          |
| :-------: | :------------------------------------- | :------------------------------------------------------------ |
| 1-Minor-1 | graph-integrity.test.ts:240-244        | N=20K timing assertion 부재                                   |
| 1-Minor-2 | graph-integrity.ts:222                 | `noUncheckedIndexedAccess` strict 모드 시 타입 에러 가능      |
|   2-m1    | graph-integrity.ts:57-71               | Error 클래스 vs AppError 계층 정합 (quality 자체 정의 정당)   |
|   2-m2    | graph-integrity.ts:58                  | error.code 컨벤션 통일 (다른 Error class와 비교 필요)         |
|   2-m3    | validateGraphIntegrity / qg2-validator | JSDoc `@throws` 누락 (CRITICAL-1과 부분 중복)                 |
| 3-Minor-1 | graph-integrity.test.ts                | nested cycle 회귀 테스트 부재                                 |
| 3-Minor-2 | graph-integrity.ts:62-66               | error message에 `revision_changes table` 노출 (admin 한정 OK) |

---

## 6. 즉시 흡수 절차 (CRITICAL 1 + MAJOR 2)

### 6.1 흡수 순서

|  #  | 항목                                            | 위치                                    | 변경 라인 |
| :-: | :---------------------------------------------- | :-------------------------------------- | :-------: |
|  1  | C1 — packages/quality/src/index.ts re-export    | quality/index.ts                        |    +2     |
|  2  | C1 — graph-integrity.ts JSDoc @throws           | graph-integrity.ts                      |    +5     |
|  3  | C1 — qg2-validator.ts try/catch graceful        | apps/batch/src/qg2-validator.ts         |    +20    |
|  4  | C1 — recover.ts SupersedeChainTooDeepError 분기 | apps/batch/src/recover.ts               |    +15    |
|  5  | M-2-M1 — error.depth 의미 명시                  | graph-integrity.ts                      |    +3     |
|  6  | M-4 — Tarjan SCC 결정 명시                      | commit message                          |     —     |
|  7  | 신규 테스트                                     | qg2-validator.test.ts + recover.test.ts |    +30    |

### 6.2 검증 게이트

- `pnpm --filter @thepick/quality test` PASS 유지 (현 48)
- `pnpm --filter @thepick/batch test` PASS 유지 (현 236)
- `pnpm --filter @thepick/batch typecheck` clean
- `verify-engine-contracts.ts` PASS=4 FAIL=0 SKIP=2

---

## 7. 다음 행동

1. **즉시 흡수**: §6.1 1~7번 (~1시간)
2. **검증**: §6.2 4개 게이트 통과
3. **commit**: `fix(review): Sprint 1 §5.1 4-Pass CRITICAL 1 + MAJOR 즉시 흡수 + caller 통합`
4. **이월 트래킹**: MAJOR-2 / MAJOR-3 / MAJOR-5 / MAJOR-6 / MAJOR-7 → Sprint 1 §5.2~§5.4
5. **MAJOR-5 보고서 갱신**: ENGINE_HARDENING_COMPLETION_REPORT v1.1 → v1.2 별도 commit (§10.7 #6 갱신)

---

**리뷰 작성**: 4 독립 에이전트 (silent-failure-hunter / backend-architect / security-engineer / code-reviewer) + Claude Opus 4.7 종합
**리뷰 효력**: 2026-05-01 ~23:38 KST
**파일명 정합**: 메모리 `feedback_review_filename_pattern` (review-\* prefix)
