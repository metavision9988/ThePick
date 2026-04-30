# Step 7 — Contract Verification 자동 스크립트 (의무화)

---

phase: 1
step: engine-hardening-step7
approved_by: TBD
risk_level: L2
scope:

- scripts/verify-engine-contracts.ts (신규)
- .github/workflows/contract-verify.yml (신규)
- packages/shared/src/contract/loader.ts (신규 — YAML 파싱 + AC 추출)

---

## 목적

`engine.contract.yaml`의 `acceptance_criteria` 자동 체크. **Review A-5 핵심** — "선택" → **"의무"**. Step 19 (4-Pass + 5-페르소나 리뷰) 진입 게이트로 작동. v3.0 Vol IX #7 Implicit Contract 안티패턴 차단.

## 근거

- Engine Hardening Roadmap v1.1 Step 18 (의무화)
- Review A-5 (CI 통합 의무)
- v3.0 Vol IX #7 Implicit Contract 안티패턴

---

## 대상 파일

### 신규

- `scripts/verify-engine-contracts.ts` — AC 종류별 검증 dispatcher
- `.github/workflows/contract-verify.yml` — PR마다 자동 실행
- `packages/shared/src/contract/loader.ts` — YAML 파싱 + 표준 인터페이스

---

## 인터페이스 설계

```typescript
// packages/shared/src/contract/loader.ts
export interface EngineContract {
  engine: { name: string; version: string; status: string; defcon: string; ... };
  classification: { scope: string; determinism: string; ... };
  domain_profile: { primary: string; secondary: string[] };
  slo: { tier: string; build_correctness: number; build_reproducibility: ...; ... };
  acceptance_criteria: AcceptanceCriterion[];
  constraints: string[];
  // ...
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  verification: VerificationType;
  // verification별 추가 필드
  test_path?: string;
  iterations?: number;
  threshold?: number | string;
  targets?: string[];
  metric?: string;
  scenario?: string;
  // ...
}

export type VerificationType =
  | "test_passes"        // vitest 실행 → 통과
  | "property_test"      // fast-check property 통과
  | "function_exists"    // export된 함수/심볼 존재
  | "file_exists"        // 파일 존재
  | "metric_check"       // 측정값 ≤ threshold
  | "package_audit"      // dependencies 검증
  | "chaos_test_passes"  // chaos 시나리오 통과
  | "security_test_passes";

export function loadContract(path: string): EngineContract;
export function loadAllContracts(rootDir: string): EngineContract[];
```

---

## Verifier 구현

```typescript
// scripts/verify-engine-contracts.ts
async function verifyContract(contract: EngineContract): Promise<ContractVerifyResult> {
  const results: AcResult[] = [];
  for (const ac of contract.acceptance_criteria) {
    const result = await dispatch(ac, contract);
    results.push(result);
  }
  const failed = results.filter((r) => !r.passed);
  return {
    engine: contract.engine.name,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed,
  };
}

async function dispatch(ac: AcceptanceCriterion, contract: EngineContract): Promise<AcResult> {
  switch (ac.verification) {
    case 'test_passes':
      return runVitest(ac.test_path);
    case 'property_test':
      return runVitest(ac.test_path, { property: true });
    case 'function_exists':
      return checkSymbolsExported(ac.targets);
    case 'file_exists':
      return checkFiles(ac.targets);
    case 'metric_check':
      return readMetric(ac.metric, ac.threshold);
    case 'package_audit':
      return auditPackage(ac.target, ac.allowed_dependencies);
    case 'chaos_test_passes':
      return runChaosScenario(ac.scenario);
    case 'security_test_passes':
      return runSecurityTest(ac.scenario);
    default:
      throw new Error(`Unknown verification type: ${ac.verification}`);
  }
}
```

---

## CI Workflow

```yaml
# .github/workflows/contract-verify.yml
name: Engine Contract Verification

on:
  pull_request:
    paths:
      - 'packages/**'
      - 'apps/**'
      - 'docs/engines/**'
      - 'scripts/verify-engine-contracts.ts'

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm contract:verify
      - if: failure()
        run: echo "::error::Engine contract verification failed. See report above."
```

`package.json` 루트에 추가:

```json
"scripts": {
  "contract:verify": "tsx scripts/verify-engine-contracts.ts"
}
```

---

## 위험 분석

| 위험                                              | 완화                                                     |
| :------------------------------------------------ | :------------------------------------------------------- |
| YAML 파싱 결함                                    | `js-yaml` 표준 라이브러리 + Zod schema 검증              |
| `function_exists` 검증이 import 부수 효과 발생    | dynamic import + try/catch 격리                          |
| `metric_check`의 측정값이 휘발성 (CI 환경별 차이) | threshold에 환경별 buffer 추가 (예: latency × 1.5 in CI) |
| `package_audit`이 transitive dependencies 누락    | `pnpm ls --depth=Infinity` 결과 audit                    |
| AC 작성 시 verification field 누락                | YAML schema strict — 필수 필드 검증                      |

---

## 검증 계획 (Acceptance Criteria — meta)

본 스크립트 자체의 AC:

### AC-CV-1: 3개 엔진 contract 모두 로드 성공

- `loadAllContracts('docs/engines/')` 결과 == 3 (formula-engine, parser, quality)

### AC-CV-2: 모든 AC 항목이 dispatch 가능

- 각 AC의 `verification` 필드가 8가지 타입 중 하나
- Unknown verification 발견 시 build fail

### AC-CV-3: CI workflow 통과

- PR 생성 시 `Engine Contract Verification` job 자동 실행
- 모든 AC PASS 시 green checkmark
- 1개라도 FAIL 시 red X + PR merge 차단

### AC-CV-4: 실패 시 명확한 에러 메시지

- AC ID + 실패 사유 + 수정 가이드 출력
- 예: `[AC-FE-2] FAILED: src/__tests__/determinism.property.test.ts not found. Create the file per docs/plans/engine-hardening/step2-formula-property.plan.md`

### AC-CV-5: 모든 verification 타입 단위 테스트

- `scripts/__tests__/verify-engine-contracts.test.ts` — 8개 타입 각각 mock 시나리오로 검증

---

## 롤백 전략

- `scripts/verify-engine-contracts.ts` 삭제
- `.github/workflows/contract-verify.yml` 삭제
- `package.json`의 `contract:verify` 스크립트 제거

영향 범위: CI 단계만 영향. 기존 코드 변경 없음.

---

## 승인 기록

- 의존성: 3개 엔진 contract.yaml 작성 완료 → 본 plan 구현
- 진산님 승인: 2026-04-27 Engine Hardening Roadmap v1.1

---

## 의존성

- **Blocked by:** Step 6 (3개 contract.yaml — 완료), Step 12~17 코드 구현 완료 (검증 대상 존재 의무)
- **Blocks:** Step 19 (4-Pass 리뷰 — Step 18 PASS 후 진입)
- **참조:** Review A-5

---

## 작업 추정

- 낙관: 0.5d
- 현실: 1d (×1.5 — 8가지 verification 타입 dispatcher 작성)
- 비관: 1.5d
