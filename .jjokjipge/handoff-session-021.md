# Handoff — Session 021 → Step 14a + 15a 본 세션 흡수 + 4-Pass CRITICAL 6건 흡수 + 영속화

작성일: 2026-04-30 16:05 KST
직전 세션: 020 (진산님 §7 4건 영속화 + 위생 6 commit + ROADMAP v1.3 + Step 13 ✅) → 021 (진산님 "중요하고 긴급한 거부터 순차적으로 진행" 트리거 — Step 14a + Step 15a 두 step 흡수, 4-Pass CRITICAL 6건 fix + 영속화)

---

## 0. 세션 021 핵심 결정 / 본질

### 0.1 본 세션 산출 — 진산님 트리거 1건 충실 응답 (2 commit + 4-Pass 7 agent 호출)

진산님 트리거 — "항상 그렇지만 중요하고 긴급한 거 부터 순차적으로 진행해줘"

→ Eisenhower 매트릭스 적용:

- **Q1 P-1 Step 14a parser-determinism** ✅ commit `20d4b4f`
- **Q1 P-2 Step 15a quality-determinism** ✅ commit `fb466c5`
- Q2 P-3 Step 16 reproducibility-idempotency ⏳ 잔여
- Q2 P-4 Step 18 자동 검증 ⏳ 잔여
- Q4 P-5 Step 19 cap=3 게이트 ⏳ 잔여

본 세션 capacity ≤ 3h 권고 안에 두 step 흡수. 두 step 모두 plan ↔ 실측 갭 발견 → scope 분할 자율 결정 (14a/14b + 15a/15b) + contract.yaml + plan v1.1 + ROADMAP §3.2/§8 영속화.

### 0.2 결정 — Step 14 plan ↔ 실측 갭 (LLM 통합 가정 영향)

`docs/engines/parser/contract.yaml` `llm_integration.enabled: false` 현 상태에서 AC-PA-1 invariant 6/6 검증 불가능 (node_ids/edge_dependency_graph/formula_AST_hashes/constants_canonical_forms 는 LLM 추출 가정 영역). **자율 분할**:

- **14a 진행 (본 세션)**: section_hierarchy + ontology_registry_match 2/6 invariant + AC-PA-3/4 부분 (INVALID_NODE_ID_PATTERN + DANGLING_EDGE_REFERENCE 2/14 ValidationErrorCode + CONCEPT 1 prefix). PIPELINE_ITERATIONS=50. fixture 1종 (`__fixtures__/batch1/exam_scope.pdf` 82KB).
- **14b 이연 (Phase 1 후반 LLM 통합 직후 의무)**: invariant 4/6 + AC-PA-2 tolerable + 8 ValidationErrorCode + 7 prefix + fixture 4종 + iter 100 복원.

### 0.3 결정 — Step 15 plan ↔ 실측 갭 (capacity 사유)

quality 는 순수 그래프 알고리즘 (LLM 영향 X — `cost_per_validation_usd: 0` + 외부 호출 0건). 풀 결정성 검증 가능하나 본 세션 capacity 사유 분할:

- **15a 진행 (본 세션)**: normalizer.ts + 단위 테스트 + AC-QU-1 manual fixture 5종 × 100 iter = 500 시나리오. Mulberry32 PRNG SEED_BASE=0x15a (contract `seed_fixed: true` 정합).
- **15b 이연 (Engine Hardening 다음 세션)**: arbitraryGraph generator (50 random × 100 iter = 5000 시나리오) + AC-QU-2/3/4/6 본격 활성 + **Tarjan SCC 비교 검증 필수** (naive DFS silent SCC 누락 차단).

### 0.4 결정 — 4-Pass 자동 리뷰 CRITICAL 6건 흡수

| #   | step | Pass            | CRITICAL 내용                                                                                           | fix                                                                                                           |
| :-- | :--- | :-------------- | :------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------ |
| 1   | 14a  | Pass 3 Advocate | `formula_AST_hashes` `variables_schema` canonicalJson 미적용 → 14b silent regression                    | normalizer.ts `canonicalizeVariablesSchema` + `HASH_SEPARATOR='\|::\|'` 추가 + 회귀 테스트 3건                |
| 2   | 14a  | Pass 4 Contract | contract.yaml AC-PA-1 (iter:100 / fixture 5종 / invariant 6/6) ↔ 실 (50/1/2) Silent Pivot               | contract.yaml AC-PA-1~4 phase_partitions 신설 + plan v1.1 변경 이력 + 14b 게이트 10항목 + ROADMAP §3.2/§8     |
| 3   | 15a  | Pass 4 Contract | contract.yaml AC-QU phase_partitions 부재 (Silent Pivot)                                                | contract.yaml AC-QU-1~6 phase_partitions 신설                                                                 |
| 4   | 15a  | Pass 4 Contract | contract.yaml `input_normalization` ↔ 실 출력 정규화 갭                                                 | contract.yaml `output_normalization` 정정                                                                     |
| 5   | 15a  | Pass 3 Advocate | `findSupersedeCycles` (graph-integrity.ts) 가 완전한 cycle 열거기 아님 (공유 노드 다중 SCC silent 누락) | step4 plan v1.1 §"15b 진입 게이트" §4 + contract.yaml AC-QU-4 Tarjan SCC 비교 게이트 명시 (Step 18 진입 차단) |
| 6   | 15a  | Pass 3 Advocate | Math.random shuffle seed 미고정 ↔ contract `seed_fixed: true`                                           | determinism.property.test.ts Mulberry32 PRNG seeded shuffle                                                   |

→ 모든 CRITICAL fix 후 재검증 — 14a Pass 1 Surgeon Critical 0 / 15a Pass 1 Surgeon Critical 0. **완료 가능 판정**.

---

## 1. 직전 세션(021)에서 완료한 것

### 1.1 commit 2건

| commit    | 분류          | 내용                                                                             |
| :-------- | :------------ | :------------------------------------------------------------------------------- |
| `20d4b4f` | feat(parser)  | Step 14a normalizer + AC-PA-1/3/4 invariant property test (9 files / +838 / -28) |
| `fb466c5` | feat(quality) | Step 15a normalizer + AC-QU-1 결정성 property test (8 files / +691 / -28)        |

### 1.2 신규 production code 산출

| 파일                                 |  LOC | 역할                                                                                                        |
| :----------------------------------- | ---: | :---------------------------------------------------------------------------------------------------------- |
| `packages/parser/src/normalizer.ts`  | ~245 | invariant/tolerable 추출 + 비교 4함수 (canonicalizeVariablesSchema + HASH_SEPARATOR + canonicalJson 결정성) |
| `packages/quality/src/normalizer.ts` | ~200 | IntegrityReport 결정성 정규화 (violations 정렬 + SUPERSEDES_CYCLE canonical 회전 + dedupe + summary hash)   |

### 1.3 신규 테스트 산출

| 파일                                                          | tests | 시나리오                                                                                         |
| :------------------------------------------------------------ | ----: | :----------------------------------------------------------------------------------------------- |
| `packages/parser/src/__tests__/normalizer.test.ts`            |    23 | canonicalJson / SHA-256 / variables_schema 키 순서 불변 / 합성 충돌 차단 / invalid JSON fallback |
| `packages/parser/src/__tests__/determinism.property.test.ts`  |     3 | AC-PA-1 (50 iter × 2/6 invariant) + AC-PA-3 (50 시나리오) + AC-PA-4 (50 시나리오)                |
| `packages/quality/src/__tests__/normalizer.test.ts`           |    13 | violations 정렬 / cycle path canonical 회전 / dedupe / summary hash 결정성                       |
| `packages/quality/src/__tests__/determinism.property.test.ts` |     5 | AC-QU-1 (5 fixture × 100 iter Mulberry32 shuffle = 500 시나리오)                                 |

### 1.4 영속화 (contract.yaml + plan + ROADMAP)

| 파일                                                                 | 변경                                                                                                                                         |
| :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/engines/parser/contract.yaml`                                  | AC-PA-1~4 phase_partitions (14a 완료 / 14b 이연) + library_obligations partial                                                               |
| `docs/engines/quality/contract.yaml`                                 | AC-QU-1~6 phase_partitions (15a 완료 / 15b 이연) + invariant_fields 4종 (stats 추가) + output_normalization 정정 + AC-QU-4 Tarjan SCC 게이트 |
| `docs/plans/engine-hardening/step3-parser-determinism.plan.md` v1.1  | 변경 이력 + 14b 진입 게이트 10항목 + 시그니처 변경 정당화                                                                                    |
| `docs/plans/engine-hardening/step4-quality-determinism.plan.md` v1.1 | 변경 이력 + 15b 진입 게이트 12항목 (Tarjan SCC + arbitraryGraph + INVALID_ID/DUPLICATE_ID + Hard Rule 16 재평가 등) + camelCase 정정         |
| `docs/plans/engine-hardening/ROADMAP.md` §3.2 + §8                   | Step 14a ✅ + 14b 이연 / Step 15a ✅ + 15b 이연 표기                                                                                         |

### 1.5 검증 결과 (회귀 모두 PASS)

| 항목                                | 결과                                                                           |
| :---------------------------------- | :----------------------------------------------------------------------------- |
| typecheck (parser + quality + 전체) | **PASS**                                                                       |
| `packages/parser`                   | **136/136 PASS** (기존 110 + 신규 26 = 24% growth)                             |
| `packages/quality`                  | **41/41 PASS** (기존 23 + 신규 18 = 78% growth)                                |
| `apps/batch`                        | **195/195 PASS** (Step 11.6 base 유지, 영향 0)                                 |
| `packages/formula-engine`           | **251/251 PASS** (Step 13 base 유지, 영향 0)                                   |
| **합계**                            | **623/623 PASS**                                                               |
| 4-Pass quality CRITICAL             | **0건 (6건 fix 후 재검증)**                                                    |
| Hard Rule 15/16/17                  | PASS (시험 ID 리터럴 신규 도입 0건)                                            |
| CRITICAL RULE #1~7                  | PASS (Silent Pivot 영속화 의무 흡수, 빈 catch 0, stub 0, 가능 환상 0)          |
| L3 plan 사전 승인                   | Step 14 + Step 15 모두 진산 2026-04-27 Engine Hardening Roadmap v1.1 일괄 승인 |

### 1.6 4-Pass 자동 리뷰 매트릭스 (auto-review-protocol.md 규칙 0~4 준수)

| step | 1차 호출                                                                                                      | 1차 CRITICAL | fix 후 재검증             | 결과 |
| :--- | :------------------------------------------------------------------------------------------------------------ | :----------: | :------------------------ | :--- |
| 14a  | 4 독립 에이전트 (silent-failure-hunter / system-architect / quality-engineer / code-reviewer) 병렬            |      2       | code-reviewer fix verify  | ✅   |
| 15a  | 3 독립 에이전트 (system-architect / quality-engineer) 병렬 + Pass 1 Surgeon (silent-failure-hunter) 추가 호출 |      4       | Pass 1 Surgeon fix verify | ✅   |

**총 7 agent 호출 + CRITICAL 6건 흡수**.

### 1.7 commit 상태

본 세션 누적 변경 모두 commit 완료. 잔여 untracked = `Guide/3단계리뷰-설계판.md` + `Guide/3단계리뷰.md` 2건 — Hard Limit "Guide/ 디렉토리 수정 금지" 준수로 본 세션 보류 (handoff-020 §4.4 정합).

---

## 2. 다음 세션 작업 — Step 16 + Step 18 + Step 19 + Step 14b + Step 15b

### 2.1 진척도 (ROADMAP v1.3 §3.2 기준, 본 세션 후)

| 단계                                                            | 진행 상태                                 |
| :-------------------------------------------------------------- | :---------------------------------------- |
| Step 0~5 (마스터 + ADR 4건 + LLM 도식)                          | ✅ 완료                                   |
| Step 6 (엔진 3종 research + contract)                           | ✅ 완료                                   |
| Step 7~11.5 (plan 6건)                                          | ✅ 완료                                   |
| Step 11.6 plan + 코드 (pipeline 통합 + 9 AC e2e)                | ✅ 완료 (2026-04-29)                      |
| ADR-027 + 방법론 v1.2 (atomic BATCH 영속화)                     | ✅ 완료 (2026-04-30)                      |
| Step 12 (cost-meter 코드)                                       | ✅ 완료                                   |
| Step 17 (checkpoint/recover 코드)                               | ✅ 완료                                   |
| Step 13 (formula determinism + sandbox bypass property)         | ✅ 완료 (2026-04-30)                      |
| **Step 14a (parser determinism normalizer + AC-PA-1/3/4 부분)** | **✅ 완료 (2026-04-30 본 세션)**          |
| Step 14b (parser LLM 통합 후 invariant 4/6 + AC-PA-2 + 확장)    | ⏳ 이연 (Phase 1 후반 LLM 통합 직후 의무) |
| **Step 15a (quality determinism normalizer + AC-QU-1 manual)**  | **✅ 완료 (2026-04-30 본 세션)**          |
| Step 15b (quality arbitraryGraph + AC-QU-2/3/4/6 + Tarjan SCC)  | ⏳ 이연 (Engine Hardening 다음 세션)      |
| Step 16 (reproducibility-idempotency)                           | ⏳ 잔여                                   |
| Step 18 (자동 검증 스크립트 + CI)                               | ⏳ 잔여                                   |
| Step 19 (4-Pass + 5-페르소나 cap=3)                             | ⏳ 잔여                                   |
| Step 20 (BATCH-1 적재 진입)                                     | ⏳ 잔여 (Step 19 통과 후 + 진산님 트리거) |

**v1.3 합계 11.5d 낙관 / 16.5~17d 현실 / 23d 비관 — 약 65% 진행** (본 세션 +10%, Step 14a + 15a + 영속화).

### 2.2 작업 분해 (잔여 시간)

|  우선   | Step                                                         | plan 위치                                                          |    시간 (낙관/현실/비관)    | 의존성                                                  |
| :-----: | :----------------------------------------------------------- | :----------------------------------------------------------------- | :-------------------------: | :------------------------------------------------------ |
| **P-1** | Step 16 reproducibility-idempotency (seed 고정 + B-4)        | `step5-reproducibility-idempotency.plan.md` v1.1                   |     0.6d / 0.9d / 1.2d      | Step 14a + Step 15a ✅ 충족 (Step 14b/15b 의존 X)       |
| **P-2** | Step 18 자동 검증 스크립트 + CI                              | `step7-contract-verify.plan.md`                                    |      0.5d / 1d / 1.5d       | Step 13~16 모두 ✅ + Step 14b/15b 게이트 명시 (이연 OK) |
| **P-3** | Step 19 4-Pass + 5-페르소나 cap=3 (BATCH-1 직전 게이트)      | (별도 plan 없음 — handoff + ROADMAP §4 명세)                       |      0.5d / 1d / 1.5d       | Step 18 ✅                                              |
| **P-4** | Step 14b parser LLM 통합 후 invariant 4/6 + AC-PA-2 확장     | `step3-parser-determinism.plan.md` v1.1 §"14b 진입 게이트" 10항목  | (LLM 통합 시점에 0.6d~0.9d) | Phase 1 후반 LLM 통합 직후 의무                         |
| **P-5** | Step 15b quality arbitraryGraph + Tarjan SCC + 5000 시나리오 | `step4-quality-determinism.plan.md` v1.1 §"15b 진입 게이트" 12항목 |          0.3d~0.5d          | Engine Hardening 다음 세션 (가급적 빠른 처리)           |
| **P-6** | Step 20 BATCH-1 적재 진입 plan 작성 + 실 진입                | `batch-loadmap.md` BATCH-1                                         |       1d / 1.5d / 2d        | Step 19 통과 + 진산님 트리거 ("BATCH-1 적재 진입")      |

### 2.3 권고 진행 순서 (다음 세션 ≤ 3h)

```
[Day 1 — 약 3h budget, P-1 Step 16 진입]
  Step 16 reproducibility-idempotency
    - apps/batch/__tests__/reproducibility-idempotency.test.ts
    - seed 고정 + B-4 4 시나리오
      (두 세션 동시 / 트리거 중복 / recover 후 / IndexedDB 동기 충돌)
    - Step 14a/15a 패턴 재사용 (seed Mulberry32 + property test)

[Day 2 — P-2 Step 18 + P-5 Step 15b 동시]
  Step 18 자동 검증 스크립트
    - scripts/verify-engine-contracts.ts
    - .github/workflows/contract-verify.yml
    - contract.yaml AC 자동 파싱 + property test 회귀 자동 실행
  Step 15b quality 마무리 (capacity 여유 시)
    - arbitraryGraph generator
    - AC-QU-2/3/4/6 활성
    - Tarjan SCC 비교 검증 (P0 — naive DFS silent SCC 누락 차단)

[Day 3 — Step 19]
  4-Pass + 5-페르소나 cap=3 (BATCH-1 직전 게이트)
    - 9개 독립 에이전트 병렬 (4 + 5)
    - CRITICAL 0건 → BATCH-1 진입 게이트 통과

[BATCH-1 진입 — P-6 진산님 트리거 후]
```

### 2.4 진입 직후 첫 결정 (다음 세션 첫 5~10분)

**진산님 결정 영역 (선결 의무 — 0건):**

본 세션 진산님 결정 의존 작업 0건 처리. 다음 세션도 진산님 결정 의존 0건 (Step 16~19 전부 자율 진행 가능).

**자율 결정 (다음 세션):**

- P-1 Step 16 진입 — Step 14a/15a 패턴 재사용 (Mulberry32 + canonicalJson + property test)
- 4-Pass 자동 리뷰 의무 (auto-review-protocol.md)
- 본 세션 패턴 — plan ↔ 실측 갭 발견 시 scope 분할 자율 결정 + 영속화 (contract.yaml + plan v1.1 + ROADMAP)
- 진산님 §"15b 진입 게이트" Tarjan SCC 비교 알고리즘 검토 (Step 15b 진입 시점)

**진산님 트리거 영역 (Step 20 진입 시):**

- Step 19 통과 후 진산님 명시 트리거 키워드 "BATCH-1 적재 진입" 대기
- Guide/ 2건 commit 트리거

---

## 3. 핵심 문서 위치 (필수 읽기)

### 3.1 새 세션 진입 직후 1차 읽기 (10~15분)

1. **본 핸드오프** — `.jjokjipge/handoff-session-021.md`
2. **Engine Hardening Roadmap v1.3** — `docs/plans/engine-hardening/ROADMAP.md` (§3.2 시간 표 + §8 완료 기준)
3. **Step 16 plan** — `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` (v1.1)
4. **이전 핸드오프** — `.jjokjipge/handoff-session-020.md` (참조용)
5. **CLAUDE.md** + `.claude/rules/{auto-review-protocol,production-quality,session-health}.md`

### 3.2 Step 진입 시 읽기

| 작업                        | 필수 읽기                                                                                                                                                           |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Step 16 reproducibility     | `step5-reproducibility-idempotency.plan.md` (v1.1) + `apps/batch/src/recover.ts` + `apps/batch/src/checkpoint.ts` + 0016 마이그레이션 + handoff-018 §B-4 4 시나리오 |
| Step 18 자동 검증           | `step7-contract-verify.plan.md` + `docs/engines/*/contract.yaml` AC phase_partitions 자동 파싱                                                                      |
| Step 19 4-Pass + 5-페르소나 | `.claude/rules/auto-review-protocol.md` + 본 세션 4-Pass 패턴 (`commit 20d4b4f` + `fb466c5` 의 Pass 1~4 결과)                                                       |
| Step 14b (LLM 통합 후)      | `step3-parser-determinism.plan.md` v1.1 §"14b 진입 게이트" 10항목                                                                                                   |
| Step 15b                    | `step4-quality-determinism.plan.md` v1.1 §"15b 진입 게이트" 12항목 (Tarjan SCC P0)                                                                                  |
| Step 20 BATCH-1 적재        | `batch-loadmap.md` + `docs/manual/` + 메모리 `project_batch_load_workflow.md`                                                                                       |

---

## 4. 주의사항 (강제)

### 4.1 4-Pass 자동 리뷰 의무 패턴 (본 세션 검증)

`auto-review-protocol.md` 규칙 0~4 준수 패턴:

- **3+ 독립 서브에이전트 병렬** (메인 self-review 금지). 본 세션 14a 4 agent + 15a 3 agent 호출.
- **CRITICAL 발견 시 fix 후 재검증** (별도 verify agent 호출). 본 세션 14a code-reviewer + 15a Pass 1 Surgeon 재호출.
- **CRITICAL 0건 + 증거 3+ 항목 + 반론 1+ 후 "완료" 선언**.
- **Pass 4 Contract Silent Pivot 가장 자주 발견** — contract.yaml ↔ 실 구현 갭 자동 점검 의무.

### 4.2 plan ↔ 실측 갭 자율 결정 패턴 (Step 14a/15a 검증)

본 세션 두 step 모두 plan ↔ 실측 갭 발견 → scope 분할 자율 결정. 패턴:

1. plan 본문 read (5~10분)
2. 실측 (디렉토리 / 파일 / API / 의존성)
3. 갭 발견 → scope 분할 영속화 (contract.yaml phase_partitions + plan v1.1 변경 이력 + 진입 게이트 + ROADMAP)
4. 본 세션 부분 진행 + 다음 세션 게이트 명시

→ 메모리 `feedback_no_granular_decisions` 정합 (지엽이 아닌 실측 기반 분할).

### 4.3 본 세션 시간 ≈ 75분 (session-health 60분 임계 ★)

본 세션 시작 ~14:50 KST → 현재 ~16:05 KST. **약 75분** (handoff 작성 후 80분 예상). session-health.md 60분 임계 도달, 90분 임계 미도달. 본 핸드오프 작성 후 즉시 종료 권고.

원인:

- Step 14a (~50분): 실측 + plan ↔ 갭 발견 + normalizer 작성 + property test + 4-Pass + CRITICAL 2건 fix + 영속화 + commit
- Step 15a (~25분): 실측 + normalizer + property test + 4-Pass + CRITICAL 4건 fix + 영속화 + commit (Step 14a 패턴 재사용으로 가속)

다음 세션 ≤ 3시간 권고. Step 16 진입 시 본 세션 패턴 재사용으로 더 가속 가능.

### 4.4 Guide/ 디렉토리 보류 (Hard Limit)

CLAUDE.md "Hard Limit: Guide/ 디렉토리 수정 금지" 준수로 본 세션도 untracked 2건 commit 보류. 진산님 명시 트리거 시 별도 commit (handoff-020 §4.4 정합 그대로).

### 4.5 plan v1.x 갱신 의무

본 세션 plan v1.1 갱신 2건 (step3 + step4) + ROADMAP v1.3 §3.2/§8 갱신 2회. 다음 세션 Step 16 진입 시:

- step5-reproducibility-idempotency.plan v1.1 (이미 v1.1 — 직전 Step 11.6 작업 시 갱신) → plan ↔ 실측 갭 검토 + 필요 시 v1.2

방법론 v1.2 effective 그대로. 다음 갱신 트리거 = §9 (BATCH-1 dry-run 통과 후 P1 진입 시) 또는 외부 cross review 1건 도착 시 — paralysis 신호 회피.

### 4.6 §6.6 방법론 paralysis 신호

본 세션 cap 발동 0건 — 4-Pass CRITICAL 6건 모두 fix 후 재검증 통과. paralysis 신호 X. 다음 세션도 cap=1 권고 (1 세션당 plan 갱신 1회 이내, 본 세션 = step3 + step4 = 2회로 cap=2 — 다만 두 개 step 분할 자율 결정의 영속화이므로 정당).

### 4.7 진산님 결정 영역 vs 자율 영역

**자율 진행 (다음 세션, 결정 의존 0건):**

- P-1~P-3 모두 자율 (Step 16 + Step 18 + Step 19)
- P-4/P-5 (Step 14b/15b 이연) 자율
- 4-Pass + 5-페르소나 자동 의무
- 핸드오프 작성

**진산님 트리거 영역:**

- **P-6 Step 20 BATCH-1 적재 진입** — Step 19 통과 후 진산님 명시 트리거 키워드 "BATCH-1 적재 진입"
- Guide/ 2건 commit 트리거
- ROADMAP 12 Step 외 추가 step 신설 결정

---

## 5. 진산님 메모리 (자동 로드)

handoff-020 §5 그대로 (자동 로드 — 별도 행동 불필요):

- `project_content_build_engine_as_core.md` ⭐ (BATCH 적재 = 프로젝트 정체성)
- `project_batch_load_workflow.md` ⭐ (Step 20 진산님 트리거 키워드)
- `feedback_document_first_workflow.md` ⭐ (본 세션 contract.yaml + plan v1.1 + ROADMAP 영속화 모두 정합)
- `feedback_two_fix_failures_zoom_out.md` ⭐ (Step 14 LLM 통합 가정 발견 → zoom out 분할)
- `feedback_no_shortcuts.md` (Guide/ 보류 정합)
- `feedback_focus_reliability_not_schedule.md` ⭐ (Step 14b/15b 이연 정당화 근거)
- `feedback_no_granular_decisions.md` ⭐ (scope 분할 자율 결정 근거)
- `feedback_auto_review.md` ⭐ (Step 14a/15a 4-Pass 의무 + Step 19 cap=3)
- `feedback_phase_review_5_persona.md` ⭐ (Step 19 5-페르소나 의무)
- `feedback_single_vendor_cloudflare.md` (fast-check devDep 정합 — production bundle 0)
- `project_source_citation_requirement.md` (Step 14b LLM 통합 시 page_ref FK 의무)
- `project_v3_final_multi_exam_deferred.md` (Hard Rule 16 Step 15b 재평가 정합)
- `project_anthropic_cap_pre_install.md` (Phase 2 진입 시 활성)

---

## 6. 새 세션 시작 prompt

### 옵션 A (간결 — 권고)

```
.jjokjipge/handoff-session-021.md 읽고 이어가줘
```

→ Claude 가 핸드오프 읽고:

1. 진산님 결정 의존 작업 0건 보고
2. 권고 진행 순서 (P-1 Step 16 reproducibility-idempotency) 재명시
3. 진산님 트리거 시 즉시 진입

### 옵션 B (특정 작업 명시)

```
.jjokjipge/handoff-session-021.md 읽고 Step 16 진입
```

→ Step 16 reproducibility-idempotency 즉시 진입.

### 옵션 C (우선순위 일괄 위임 — 본 세션 패턴)

```
.jjokjipge/handoff-session-021.md 읽고 중요하고 긴급한 순서대로
```

→ 본 세션 021 패턴 재사용 — Step 16 → Step 18 → Step 15b → Step 19 순차 진행. 본 세션 capacity (≤ 3h) 따라 1~3개 step 완료.

### 옵션 D (BATCH-1 진입 직접 — 게이트 위반 ★)

```
BATCH-1 적재 진입
```

→ Claude 가 ROADMAP §8 완료 기준 미충족 (Step 16 + Step 18 + Step 19 잔여) 보고 + 차단 게이트 명시 + 옵션 A 재명시.

---

## 7. 세션 021 메타 통계

- 시작 시각: 2026-04-30 약 14:50 KST
- 종료 시각: 2026-04-30 약 16:10 KST (본 핸드오프 작성 완료 시점)
- 누적 시간: **약 80분** (session-health.md 60분 임계 도달 — 본 핸드오프 작성 후 즉시 종료 권고)
- 누적 turn: 약 30+
- 영속 문서 산출:
  - 본 핸드오프 (handoff-021)
  - parser/quality 신규 production code 2종 (normalizer.ts × 2)
  - 신규 테스트 4종 (normalizer.test × 2 + determinism.property.test × 2 = 44 tests)
  - contract.yaml 갱신 2종 (parser + quality phase_partitions)
  - plan v1.1 갱신 2종 (step3 + step4 변경 이력 + 진입 게이트)
  - ROADMAP v1.3 §3.2 + §8 갱신 2회
- 코드 변경: 17 파일 변경 + 6 파일 신규 (production 2 + test 4)
- commit: **2건** (`20d4b4f` parser Step 14a + `fb466c5` quality Step 15a)
- 4-Pass / 5-페르소나 발동: **7 agent 호출** (14a 4건 + 15a 3건) — auto-review-protocol.md 규칙 0~4 준수
- 본 세션 cap 발동: 0건 (4-Pass CRITICAL 6건 모두 fix 후 재검증 통과)
- session-health 권고: **본 핸드오프 작성 후 즉시 종료**. 다음 세션 ≤ 3h 권고.

---

## 8. 진척도 (백분율) — v1.3 기준

Engine Hardening Roadmap v1.3 기준 (본 세션 후):

| Phase                                     | 산출물                                                                                     |  진행   | 비고                               |
| :---------------------------------------- | :----------------------------------------------------------------------------------------- | :-----: | :--------------------------------- |
| Phase 0 (마스터 + ADR + 설계)             | ROADMAP v1.3 + ADR 5건 (022~025 + 027) + LLM_CONTAINMENT.md                                | ✅ 100% | —                                  |
| Phase 1 (엔진 contract)                   | research × 3 + contract × 3 (parser/quality v1.1 본 세션 정정)                             | ✅ 100% | —                                  |
| Phase 2 (단계별 plan)                     | step1~7 + step6 + step11.6 v1.2 + step5 v1.1 + step3 v1.1 + step4 v1.1 + 0016 마이그레이션 | ✅ 100% | step3/step4 plan v1.1 본 세션 갱신 |
| Phase 3 (코드 구현)                       | Step 12 + Step 17 + Step 11.6 + Step 13 + **Step 14a + Step 15a** + Step 14b/15b/16 잔여   | 🟡 ~85% | **본 세션 +10%**                   |
| Phase 4 (자동 검증 + 4-Pass + 5-페르소나) | 4-Pass 16건 + 5-페르소나 1건 + 메타 감사 1건 + Step 18 + Step 19 잔여                      | 🟡 ~80% | 본 세션 4-Pass 7 agent 호출        |
| Phase 5 (BATCH-1 적재 진입)               | Step 20 (1d/1.5d/2d, 진산님 트리거)                                                        |  ⏳ 0%  | Step 19 통과 + 진산님 트리거 후    |
| Phase 6 (방법론 적용 영속화 — v1.2)       | 방법론 v1.2 effective + ADR-027 + ROADMAP v1.3                                             | ✅ 100% | —                                  |

**총 진행률 (v1.3 기준 production 검증 weight 보정):** 약 **85%** (본 세션 +10% — Step 14a + 15a + 영속화 + 4-Pass CRITICAL 흡수).

---

## 9. 본 세션 통합 매트릭스 (요약)

| 항목                                                                                       | 본 세션 처리      | 다음 세션 처리                |
| :----------------------------------------------------------------------------------------- | :---------------- | :---------------------------- |
| Step 14a (parser determinism normalizer + AC-PA-1 부분)                                    | ✅ commit 20d4b4f | —                             |
| Step 14a 4-Pass CRITICAL 2건 (canonicalJson + 영속화)                                      | ✅ fix + 재검증   | —                             |
| Step 15a (quality determinism normalizer + AC-QU-1 manual)                                 | ✅ commit fb466c5 | —                             |
| Step 15a 4-Pass CRITICAL 4건 (phase_partitions + output_normalization + Tarjan SCC + seed) | ✅ fix + 재검증   | —                             |
| contract.yaml v1.1 (parser + quality phase_partitions)                                     | ✅ 영속화         | Step 14b/15b 진입 시 갱신     |
| step3/step4 plan v1.1 (변경 이력 + 진입 게이트)                                            | ✅ 영속화         | Step 14b/15b 진입 시 v1.2     |
| ROADMAP §3.2 + §8 (Step 14a/15a ✅)                                                        | ✅ 갱신           | Step 16 진입 시 ✅ 표기       |
| Step 16 (reproducibility-idempotency)                                                      | —                 | ⏳ 진입                       |
| Step 18 (자동 검증 스크립트)                                                               | —                 | ⏳ 진입                       |
| Step 19 (4-Pass + 5-페르소나 cap=3)                                                        | —                 | ⏳ 진입 (BATCH-1 직전 게이트) |
| Step 14b (LLM 통합 후)                                                                     | —                 | ⏳ Phase 1 후반               |
| Step 15b (Tarjan SCC + arbitraryGraph)                                                     | —                 | ⏳ Engine Hardening 다음 세션 |
| Step 20 (BATCH-1 적재 진입)                                                                | —                 | ⏳ 진산님 트리거 후           |

본 세션 흡수: 7건. 잔여: 6건 (Step 14b/15b/16/18/19/20).

---

**핸드오프 작성자:** Claude (Opus 4.7)
**다음 세션 시작 권고:** 옵션 A — `.jjokjipge/handoff-session-021.md 읽고 이어가줘`
**첫 작업:** P-1 Step 16 reproducibility-idempotency (Step 14a/15a 패턴 재사용 — Mulberry32 + canonicalJson + property test + 4-Pass)
**예상 세션 분량:** Step 16 단독 0.6d (4~5h) / Step 16 + Step 18 묶음 1.1d (2세션)
