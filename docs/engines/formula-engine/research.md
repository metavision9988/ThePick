# formula-engine — Stage 0 Research

**작성일:** 2026-04-27
**Engine:** `@thepick/formula-engine`
**Domain Profile:** Library (primary) + Batch-Build (secondary)
**DEFCON:** **L3**
**Status:** Researched

---

## 1. 도메인 경계 (Bounded Context)

손해평가 산식의 **결정론적 계산** 단일 책임. 입력: `(formula_id, scope, constantsProvider)` → 출력: `CalculateResult`. 외부와의 통신은 `constantsProvider` 콜백 하나뿐 (DB 접근 추상화).

- **포함:** math.js AST 파싱, 변수 schema 검증, sandbox 화이트리스트, 부동소수점 연산, 산식 레지스트리(68개)
- **제외:** DB 직접 접근, HTTP 호출, LLM 호출, 파일 I/O, 사용자 인터페이스

---

## 2. 기존 엔진과의 차이 (왜 별도 패키지?)

| 비교           | 일반 계산기                | formula-engine                                              |
| :------------- | :------------------------- | :---------------------------------------------------------- |
| 산식 정의 위치 | 코드 내부 (하드코딩)       | DB의 `formulas.equation_template` (개정 시 코드 수정 X)     |
| 변수 검증      | 런타임 에러                | schema 사전 검증 (FormulaErrorCode)                         |
| 보안           | 동적 코드 실행 가능성 존재 | math.js AST sandbox + 동적 코드 실행 절대 금지 (Hard Limit) |
| 정밀도         | JS Number                  | math.js BigNumber (옵션) + 단위 환산                        |
| Constants      | 호출 시 직접 입력          | `ConstantsProvider` 콜백 (DB 위임 + 캐싱)                   |

→ Hard Rule: 동적 코드 실행 함수 절대 금지. math.js AST 파서만 허용.

---

## 3. 결합 패턴 (Volume III)

**Library Engine — 결합 패턴 N/A.** 호출 시점에만 작동, lifecycle 없음. 단, 호출 사이트(`apps/batch`, 향후 `apps/api`)는 **Pattern A (Pipeline)** 안에서 사용.

---

## 4. DEFCON 분류 (Volume I)

**L3** — 자동 트리거 2건 해당:

1. ⚠️ "AI/ML 추론" (산식이 LLM의 정답 근거 — 산식 결함 → 콘텐츠 결함 연쇄)
2. ⚠️ "Stateful Meta가 의존하는 결정자" (`apps/batch` BATCH 적재의 Golden Test 통과 기준)

**Hard Rule (메모리 + CLAUDE.md):** "65%를 60%로 잘못 입력 = 서비스 사망." 정밀도 결함 1건 = 서비스 신뢰성 붕괴.

---

## 5. SLA / Availability

| 항목                                        | 값                                         | 근거                                         |
| :------------------------------------------ | :----------------------------------------- | :------------------------------------------- |
| `build_correctness`                         | 0.999 (Golden + Property + Constants 일치) | v3.0 Vol XIV.4                               |
| `build_reproducibility.invariant_threshold` | **1.0 (100%)**                             | math.js 결정성 — `tolerable_fields` 비어있음 |
| Latency P99 (계산 1회)                      | < 50ms                                     | 단순 AST 평가 — Workers CPU 50ms 한계 내     |
| Throughput                                  | > 100 calc/sec                             | BATCH 적재 시 부담 X                         |
| Availability                                | N/A (Library, lifecycle 없음)              | —                                            |

---

## 6. Library 식별 3문항 (Vol XV.2)

|                 Q                 | 답     | 증거                                                            |
| :-------------------------------: | :----- | :-------------------------------------------------------------- |
|    Q1: 같은 입력 → 같은 출력?     | ✅ YES | math.js AST 결정성 + 산식 레지스트리 immutable                  |
| Q2: 인터페이스 보존 시 구현 교체? | ✅ YES | `ConstantsProvider` 인터페이스 → InMemory/D1/Mock 자유 교체     |
|    Q3: 외부 의존 없이 테스트?     | ✅ YES | math.js만 의존 (npm), 테스트는 InMemoryConstantsProvider로 격리 |

→ 3/3 PASS. 본 엔진은 v3.0 Vol XV Library Engine 자격 충족.

---

## 7. 기존 자산 (이미 존재)

| 항목                   | 위치                                          | 상태                       |
| :--------------------- | :-------------------------------------------- | :------------------------- |
| AST 파서               | `src/ast-parser.ts`                           | ✅                         |
| Sandbox 화이트리스트   | `src/sandbox.ts`                              | ✅                         |
| 변수 매퍼              | `src/variable-mapper.ts`                      | ✅                         |
| Constants 리졸버       | `src/constants-resolver.ts`                   | ✅ (InMemory PoC)          |
| 산식 레지스트리 (68개) | `src/formulas/batch1~5-definitions.ts`        | ✅                         |
| Golden Test            | `src/__tests__/batch1~5-golden.test.ts` (5건) | ✅                         |
| Engine entrypoint      | `src/engine.ts` (`calculate()`)               | ✅                         |
| **Property Test**      | —                                             | **❌ 보강 필요 (Step 13)** |
| engine.contract.yaml   | `docs/engines/formula-engine/contract.yaml`   | ✅ (Step 6)                |

---

## 8. Engine Hardening 차단 항목

본 엔진을 BATCH-1 적재 진입 게이트로 통과시키려면:

- ✅ Library 식별 3문항 통과 (현재 충족)
- ⏳ Property Test 추가 (Step 13) — 68개 산식 결정성 100% (`fc.property` × 68)
- ⏳ contract.yaml ACCEPTED (Step 6) — 본 research.md와 같이 작성
- ⏳ Step 18 자동 검증 스크립트 PASS

---

## 9. 위험 / Devil's Advocate

| 위험                                                 | 근거               | 완화                                                                      |
| :--------------------------------------------------- | :----------------- | :------------------------------------------------------------------------ |
| math.js 라이브러리 결함 (예: 부동소수점 오차)        | 외부 의존          | math.js 버전 고정 + Property test 100회 반복 + Golden Test 5건            |
| 산식 등록 시 변수명 오타 (template vs schema 불일치) | 인간 실수          | `formulas/index.ts`의 `safeParse()` 등록 시 교차 검증 (이미 구현됨)       |
| ConstantsProvider 결함 (잘못된 값 반환)              | DB 또는 Cache 결함 | Constants 일치 검증 (Layer 3 Cross-validation, LLM_CONTAINMENT.md §3.3.3) |
| math.js 동적 함수 정의 우회 시도                     | 보안               | sandbox 화이트리스트 (이미 구현) — Property test로 우회 시나리오 확인     |
| BigNumber 미사용으로 인한 누적 오차                  | 정밀도             | 산식별로 BigNumber 활성/비활성 결정 — contract.yaml에 명시                |

---

## 10. 다음 단계

- Step 6 (본 research + contract.yaml 작성 — 본 문서)
- Step 8 (`step2-formula-property.plan.md` 작성)
- Step 13 (Property Test 코드 구현 — fast-check 도입)
