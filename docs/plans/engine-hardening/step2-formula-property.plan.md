# Step 2 — formula-engine Property Test (결정성 검증)

---

phase: 1
step: engine-hardening-step2
approved_by: TBD
risk_level: L3
scope:

- packages/formula-engine/**tests**/determinism.property.test.ts (신규)
- packages/formula-engine/**tests**/sandbox-bypass.property.test.ts (신규)
- packages/formula-engine/package.json (수정 — fast-check devDependency 추가)

---

## 목적

formula-engine 68개 산식의 **결정성 100% 회귀 차단**. 동일 (formulaId, scope, constants) → 100회 반복 시 100% 동일 출력. v3.0 Vol XV.3 의무 5요소 #1 — "Property Test = 가장 중요". formula-engine은 L3 + Library — 결정성 결함 = 서비스 사망.

## 근거

- v3.0 Vol XV.3 #1 (Library Engine 의무 5요소)
- v3.0 Vol VII.1 Tier 4 (Property-Based Test)
- contract.yaml AC-FE-2 (`docs/engines/formula-engine/contract.yaml`)
- Engine Hardening Roadmap v1.1 Step 8

---

## 대상 파일

### 신규

- `packages/formula-engine/__tests__/determinism.property.test.ts` — 68개 산식 결정성 검증
- `packages/formula-engine/__tests__/sandbox-bypass.property.test.ts` — 동적 코드 실행 우회 시도 차단

### 수정

- `packages/formula-engine/package.json` — devDependency 추가:
  ```json
  "devDependencies": {
    "fast-check": "^3.x"
  }
  ```

---

## Test Strategy

### 1. 결정성 Property Test (AC-FE-2)

```typescript
import fc from 'fast-check';
import { calculate, getAllFormulas, InMemoryConstantsProvider } from '../src';

describe('formula-engine determinism (68 formulas)', () => {
  for (const formula of getAllFormulas()) {
    test(`${formula.id} (${formula.name}) — same input → same output (100 iterations)`, () => {
      fc.assert(
        fc.property(
          arbitraryScopeFor(formula),  // formula별 valid scope generator
          (scope) => {
            const provider = new InMemoryConstantsProvider(...);
            const r1 = calculate(formula.id, scope, provider);
            const r2 = calculate(formula.id, scope, provider);
            expect(r1).toEqual(r2);  // structural equality
          }
        ),
        { numRuns: 100 }
      );
    });
  }
});
```

### 2. Sandbox 우회 차단 Property Test (AC-FE-3)

다음 우회 시나리오 100회 무작위 입력으로 차단 검증:

| 우회 시나리오                                     | 검증                       |
| :------------------------------------------------ | :------------------------- |
| 동적 함수 정의 시도 (`f := function(x) = ...`)    | `safeParse()` 거부         |
| Global object 접근 시도 (`globalThis`, `process`) | `safeParse()` 거부         |
| Prototype pollution (`__proto__.x := ...`)        | `safeParse()` 거부         |
| math.js 내장 위험 함수 (`import`, `createUnit`)   | sandbox 화이트리스트 거부  |
| 무한 루프 induction (`x := x + 1` 자기참조)       | AST 순환 감지 또는 timeout |

### 3. Edge Case Property Test

| 케이스                                            | 검증                            |
| :------------------------------------------------ | :------------------------------ |
| `scope` 변수 누락 → `MISSING_VARIABLE`            | 100% throw                      |
| `scope` 변수 타입 불일치 (string인데 number 기대) | `INVALID_VARIABLE_TYPE`         |
| Constants 미존재 (`CONST-XX-XX-001` 없음)         | `CONSTANT_NOT_FOUND`            |
| Division by zero (`amount / 0`)                   | `DIVISION_BY_ZERO`              |
| Numeric overflow (큰 수 곱셈)                     | `OVERFLOW` 또는 `Infinity` 차단 |
| NaN 발생 시도 (`0 / 0`)                           | `NaN` 출력 0건 (모두 throw)     |

---

## 위험 분석

| 위험                                                      | 완화                                                                                  |
| :-------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| `arbitraryScopeFor(formula)` 작성 누락 — 일부 산식만 검증 | 모든 산식에 대해 generator 의무 작성 + Test Coverage 검증                             |
| math.js 자체의 결정성 가정이 틀림                         | math.js 버전 고정 + `fc.property` 100회 → 1회라도 다르면 fail                         |
| Property test 실행 시간 폭발 (68 × 100 = 6800 시나리오)   | numRuns 신중 결정 (100이면 ~1분, CI에서 수용 가능)                                    |
| Constants Provider mock 결함                              | InMemoryConstantsProvider는 이미 검증된 PoC, 추가 mock 작성 X                         |
| 산식 등록 시점에 검증 누락 (template ↔ schema 불일치)     | `formulas/index.ts` `safeParse()` 등록 시 교차 검증 (이미 구현) — 본 test가 회귀 검증 |

---

## 검증 계획 (Acceptance Criteria)

### AC-FE-2 (contract.yaml 인용)

- 68개 산식 × 100회 반복 = 6800 시나리오 모두 PASS
- 1건이라도 fail 시 즉시 BATCH-1 진입 차단

### AC-FE-3

- Sandbox 우회 시나리오 5종 × 100회 = 500 시나리오 모두 차단

### AC-FE-Edge

- Edge case 6종 × 50회 = 300 시나리오 모두 적절한 FormulaError throw

### Coverage

- `packages/formula-engine/src/engine.ts` — 100% 라인 커버리지
- `packages/formula-engine/src/sandbox.ts` — 100%

---

## 롤백 전략

본 plan 구현 중 결함 발견 시:

- 새 test 파일 삭제
- fast-check devDependency 제거
- Golden Test 5건은 보존 (기존 자산)

영향 범위: 새 test만 추가. 기존 코드 변경 없음 (단, 사양 결함 발견 시 코드 수정 필요 가능).

---

## 승인 기록

- 의존성: contract.yaml AC-FE-2/3 정의 → 본 plan 구현
- 진산님 승인: 2026-04-27 Engine Hardening Roadmap v1.1

---

## 의존성

- **Blocked by:** Step 6 (formula-engine contract.yaml — 완료)
- **Blocks:** Step 18 (자동 검증 스크립트 — AC-FE-2/3 자동 체크)

---

## 작업 추정

- 낙관: 0.5d
- 현실: 1d (×1.5 — fast-check 학습 곡선 + arbitraryScopeFor 작성)
- 비관: 1.5d
