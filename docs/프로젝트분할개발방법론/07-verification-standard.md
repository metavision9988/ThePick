# ✅ 07. VERIFICATION & INTEGRATION STANDARD

## 분할된 작업의 통합 검증 — 어떻게 잘 되었는지 확인하나

> **"Tests pass" is the easiest lie a codebase tells.**
> **The hard truth: does it work for the user?**
>
> — BREAKER

---

**버전:** v1.0
**선행 문서:** 06. Operating Manual
**연계 헌법:** VOID DEV UNIFIED CONSTITUTION v3.3 — Verification Gate System (VGS)

---

# 0. 검증 9 Gate 시스템 (헌법 v3.3 VGS)

## 0.1 9개 Gate 한눈에

```
G0  코드베이스 준수 검증
G1  Counter-Directive 검증
G2  의도-코드 일치 검증
G3  Test 진실성 검증
G4  Story Definition of Done
G4.5 ★ 섹터 통합 검증 (분할 시 의무)
G5  Triangle Cross Verification
G5.5 ★ 인간 기능 검증 (G7 도달 조건)
G6  ADR 회고 검증
G7  통합 사용자 시나리오
```

## 0.2 분할 프로젝트 추가 의무 Gate

```
분할 프로젝트는 다음을 추가:

★ G4.5: Plane 간 통합 검증 (이 문서 핵심)
★ Contract Hash 검증 (각 머지마다)
★ Cross-Plane E2E 테스트 (G7 전 단계)
```

---

# 1. Gate 0: 코드베이스 준수 검증

## 1.1 검증 항목

```yaml
G0_codebase_compliance:
  - '기존 패턴 일관성 (Stage -1에서 발견한 패턴)'
  - 'Anti-pattern 위반 없음 (eslint 룰)'
  - '유비쿼터스 언어 일관 (도메인 용어)'
  - 'Folder ownership 위반 없음 (pre-commit hook)'
```

## 1.2 자동화

```bash
# CI에서 매 PR마다
pnpm lint
pnpm typecheck
pnpm tsc --noEmit
node scripts/check-ownership.js
```

---

# 2. Gate 1: Counter-Directive 검증

## 2.1 검증 항목

```
□ 이 변경이 어느 Counter-Directive를 위반?
□ 위반 시 ADR 작성됐나?
□ 의도적 위반 vs 실수?
```

## 2.2 자동 + 수동 혼합

```javascript
// scripts/check-counter-directives.js
// 일부 CD는 자동 검증 가능

const violations = [];

// CD-1: 동적 rule loading 검출
if (codeContains('rules.fromDB')) {
  violations.push('CD-1 위반: rule이 DB에서 동적 로드');
}

// CD-2: AI 자동 적용 검출
if (codeContains('autoApply.*aiSuggestion')) {
  violations.push('CD-2 위반: AI 제안 자동 적용');
}

// CD-5: AI 호출 전 Cost Cap 체크 누락
if (callsAI() && !checksCostCap()) {
  violations.push('CD-5 위반: AI 호출 전 Cost Cap 미체크');
}

if (violations.length > 0) {
  console.error('❌ Counter-Directive 위반:');
  violations.forEach((v) => console.error(`  - ${v}`));
  process.exit(1);
}
```

---

# 3. Gate 2: 의도-코드 일치 검증

## 3.1 검증 방법

```
방법 A: BDD 시나리오 vs 코드 동작
  - Given/When/Then 시나리오 실행
  - 의도와 결과 일치?

방법 B: Contract.yaml vs 실제 시그니처
  - Contract의 inputs/outputs vs 코드의 함수 시그니처
  - 자동 비교 (TypeScript AST)

방법 C: 인간 검토
  - "이 코드가 plan.md의 의도를 구현?"
```

## 3.2 자동 비교 (Contract vs Code)

```typescript
// scripts/verify-contract-implementation.ts
import { parse } from '@typescript-eslint/parser';
import yaml from 'js-yaml';
import fs from 'fs';

function verifyContract(contractPath: string, codePath: string) {
  const contract = yaml.load(fs.readFileSync(contractPath, 'utf-8'));
  const code = parse(fs.readFileSync(codePath, 'utf-8'));

  // Contract의 export 정의 vs 코드의 실제 export
  for (const expected of contract.public_interface.exports) {
    const actual = findExport(code, expected.name);
    if (!actual) {
      throw new Error(`❌ Missing export: ${expected.name}`);
    }

    if (!signatureMatches(expected, actual)) {
      throw new Error(`❌ Signature mismatch: ${expected.name}`);
    }
  }

  console.log(`✅ ${contractPath} verified`);
}
```

---

# 4. Gate 3: Test 진실성 검증

## 4.1 검증 항목

```
□ Test가 실제 동작 검증? (mock 과다 사용 X)
□ Test fixture가 production 상황 대표?
□ Edge case 커버?
□ Test가 의미 있는 assertion?
```

## 4.2 Anti-Pattern 검출

```javascript
// scripts/test-truthfulness.js

const antiPatterns = [
  // 무의미한 assertion
  /expect\(true\)\.toBe\(true\)/,
  /expect\(1\)\.toBeGreaterThan\(0\)/,

  // Mock 남용
  /vi\.mock.*vi\.mock.*vi\.mock.*vi\.mock/, // 4+ mock

  // Test에 hardcoded production 값
  /sk_live_/, // Stripe live key
  /\bproduction\b.*api/,
];

// Test 파일에서 검출
```

---

# 5. Gate 4: Story DoD (Definition of Done)

## 5.1 Story별 DoD 정의

각 Story마다 명시:

```yaml
# docs/plane/p2-engine/stories/P2-S2.yaml
story: 'P2-S2 Rule 1: 부가세 표기 검증'
done_when:
  - 'ValidateTaxNotation 함수 구현됨'
  - '5개 unit test 통과 (정상 + edge case)'
  - 'BDD 시나리오 2개 통과'
  - 'P3 Service에서 import 가능'
  - 'Performance: P95 < 5ms'
  - 'Counter-Directive 위반 없음'
  - 'PR 머지 + main에서 build 성공'
```

## 5.2 DoD 자동 체크리스트

```bash
# scripts/verify-story-dod.sh STORY_ID
STORY=$1

echo "▶ Story DoD 검증: $STORY"

# 함수 구현?
if grep -r "validateTaxNotation" packages/engine/src/; then
  echo "  ✓ 함수 구현됨"
else
  echo "  ❌ 함수 없음"
  exit 1
fi

# Unit test 5개?
TEST_COUNT=$(grep -c "it(" packages/engine/tests/validateTaxNotation.test.ts)
if [ $TEST_COUNT -ge 5 ]; then
  echo "  ✓ Unit test $TEST_COUNT개"
else
  echo "  ❌ Unit test 부족"
  exit 1
fi

# Performance
if pnpm test:perf -- "validateTaxNotation"; then
  echo "  ✓ Performance OK"
else
  echo "  ❌ Performance 실패"
  exit 1
fi

# 등등
```

---

# 6. ★ Gate 4.5: Plane 간 통합 검증 (분할 핵심)

## 6.1 이 Gate가 가장 중요

```
분할 프로젝트의 핵심 위험:
  - 각 Plane은 unit test 통과
  - 통합 시점에 폭발

Gate 4.5는 이걸 막는다.
```

## 6.2 검증 항목

```yaml
G4.5_inter_plane_integration:
  contract_hash:
    - '각 Contract.yaml의 hash가 실제 코드와 일치?'
    - '다른 Plane이 의존하는 export가 변경되지 않음?'

  acyclic_dependencies:
    - 'dependency-cruiser로 사이클 검출'
    - 'madge로 검증'

  cross_plane_e2e:
    - 'P3 → P2 → P1 → DB 흐름 E2E test'
    - 'P4 → P3 → P2 흐름 E2E test'

  notice_acks:
    - '최근 머지된 SSOT_CHANGE NOTICE 모두 ack됨?'
    - '처리되지 않은 critical NOTICE 없음?'

  ssot_consistency:
    - 'DOMAIN_MODEL.md vs 실제 코드 일치?'
    - 'API_CONTRACTS.md vs Contract.yaml 일치?'
```

## 6.3 자동화 — 매 머지마다

```bash
# .github/workflows/inter-plane-integration.yml
name: Gate 4.5 Inter-Plane Integration

on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Contract Hash Verification
        run: pnpm verify:contracts

      - name: Acyclic Dependencies
        run: pnpm dlx madge --circular packages/

      - name: Cross-Plane E2E Tests
        run: pnpm test:e2e:cross-plane

      - name: NOTICE Resolution
        run: |
          UNRESOLVED=$(ls .claude/notices/*.md 2>/dev/null | wc -l)
          if [ $UNRESOLVED -gt 0 ]; then
            CRITICAL=$(grep -l "severity: critical" .claude/notices/*.md | wc -l)
            if [ $CRITICAL -gt 0 ]; then
              echo "❌ Critical NOTICE 미처리: $CRITICAL개"
              exit 1
            fi
          fi

      - name: SSOT vs Code Consistency
        run: pnpm verify:ssot-consistency
```

## 6.4 Cross-Plane E2E 테스트 양식

```typescript
// tests/e2e/cross-plane/quote-validation.test.ts

import { describe, it, expect } from 'vitest';
import { app } from '@/apps/web';

describe('Quote Validation (P4→P3→P2→P1→DB)', () => {
  it('사용자가 견적 작성 → 검증 → DB 저장 흐름', async () => {
    // P4 (UI) — 폼 제출 시뮬
    const formData = {
      customerId: 'cust_123',
      lineItems: [
        { name: 'Service A', amount: 100, taxRate: 10 },
        { name: 'Service B', amount: 200, taxRate: null }, // 위반!
      ],
    };

    // P3 (Service) — API 호출
    const response = await app.fetch(
      new Request('/api/quotes', {
        method: 'POST',
        body: JSON.stringify(formData),
      }),
    );

    // P2 (Engine) — 검증 결과
    const result = await response.json();

    // 통합 결과 검증
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].rule).toBe('R1');
    expect(result.violations[0].lineItemIndex).toBe(1);

    // P1 (DB) — 저장 확인
    const saved = await db.quotes.findOne({ id: result.id });
    expect(saved).toBeDefined();
    expect(saved.status).toBe('draft');
  });
});
```

---

# 7. Gate 5: Triangle Cross Verification

## 7.1 삼각 검증

헌법 v3.3 Part 9.5:

```
3가지 관점에서 같은 변경 검증:

  Vertex 1: 코드 (실제 동작)
  Vertex 2: 테스트 (의도 표현)
  Vertex 3: 문서 (사용자 약속)

세 꼭지가 일치해야 통과.
```

## 7.2 검증 절차

```
A: 코드 → 테스트 일치
  - 코드에 있는 함수가 테스트되나?
  - 테스트의 mock이 실제 코드와 일치?

B: 테스트 → 문서 일치
  - BDD 시나리오가 사용자 가이드와 일치?
  - Test naming이 문서 용어와 일치?

C: 문서 → 코드 일치
  - 사용자 가이드의 예시 코드가 실제 동작?
  - API 문서의 endpoint가 실제 존재?
```

---

# 8. ★ Gate 5.5: 인간 기능 검증 (G7 도달 조건)

## 8.1 G5.5의 핵심

```
"AI는 자기 출력을 검증할 수 없다."

이게 G5.5의 핵심.
인간이 실제로 사용해보고 통과 여부 결정.

자동 테스트 100% 통과 ≠ G5.5 통과.
```

## 8.2 G5.5 시나리오

```
시나리오: VOID BILL의 견적 작성 흐름

1. 인간이 직접 사용 (시뮬레이션 NO)
   - 새 사업자번호로 회원가입
   - 견적 작성
   - 15-rule 검증 결과 확인

2. 평가 항목
   □ 사용자가 30초 안에 견적 작성?
   □ 검증 결과가 이해 가능?
   □ 법적으로 정확한 결과?
   □ 실제로 인쇄/발송 가능?

3. 통과/불통과
   - 통과: G6 진행
   - 불통과: 어느 Plane의 문제? → 재진단
```

## 8.3 G5.5 자동화 보조

자동화로 일부 보조 가능 (Playwright MCP 등):

```typescript
// tests/g5.5/quote-creation-flow.spec.ts (Playwright)

test('견적 작성 흐름 — 인간 시뮬', async ({ page }) => {
  // 단, 이건 G5.5의 보조. 진짜 검증은 인간이.

  await page.goto('/');
  await page.click('[data-testid="signup"]');
  // ... 사용자 흐름 모방

  // 인간이 봐야 할 부분 스크린샷
  await page.screenshot({ path: 'g5.5/quote-result.png' });
});
```

스크린샷을 인간이 검토 → G5.5의 일부.

---

# 9. Gate 6: ADR 회고 검증

## 9.1 검증 항목

```
□ 이 머지가 ADR 의무를 위반하지 않나?
□ Silent Pivot 없나?
□ 결정의 사유가 추적 가능?
```

## 9.2 자동 검증

```bash
# Silent Pivot 검출
# - SSOT 변경 + ADR 없음 = Silent Pivot

if git diff --name-only main..HEAD | grep -q "docs/shared/"; then
  if ! git diff --name-only main..HEAD | grep -q "docs/adr/"; then
    echo "⚠️ SSOT 변경 + ADR 없음 = Silent Pivot 위험"
    echo "ADR 작성 후 머지 권장"
  fi
fi
```

---

# 10. Gate 7: 통합 사용자 시나리오

## 10.1 최종 게이트

```
G7 도달 조건:
  - G0~G6 모두 통과
  - G5.5 인간 검증 통과
  - 비즈니스 가치 재확인

G7 = 출시 가능 상태.
```

## 10.2 G7 체크리스트

```
□ 모든 critical bug 해결
□ Hard Limit 모두 충족
□ Counter-Directive 위반 0
□ G5.5 인간 검증 통과
□ ADR 모두 작성됨
□ NOTICE 모두 처리됨
□ 사용자 가이드 작성
□ 모니터링 셋업 (Sentry, etc)
□ Rollback 계획 존재
□ 비즈니스 가치 재확인 (북극성)
```

---

# 11. 분할 프로젝트 통합 검증 흐름

## 11.1 머지 → 배포 흐름

```
Plane 브랜치 PR
   ↓
G0 (lint + typecheck)
   ↓
G1 (Counter-Directive)
   ↓
G2 (Contract vs Code)
   ↓
G3 (Test 진실성)
   ↓
G4 (Story DoD)
   ↓
머지 → main
   ↓
★ G4.5 (Plane 간 통합) — 매 머지마다
   ↓
G5 (Triangle)
   ↓
(Story 완료 시 G5.5 인간 검증)
   ↓
G6 (ADR 회고)
   ↓
(Phase 완료 시 G7)
   ↓
배포
```

## 11.2 머지 차단 사유

```
G0~G4 실패 → PR 차단 (자동)
G4.5 실패 → main 보호 (CI)
G5.5 미통과 → 출시 차단 (수동)
G6 위반 → ADR 작성 후 재시도
```

---

# 12. 페르소나 COT 검증 (이 표준)

## 🔨 BREAKER

> "9 Gate가 충분? G4.5가 추가되어 분할 프로젝트 보강. ✓"

## 🛡️ SENTINEL

> "보안 검증 별도? — Counter-Directive에 포함 + Contract 검증. ✓"

## 👻 GHOST

> "CI/CD 자동화? G0~G4, G4.5, G6은 자동. G5.5만 수동. ✓"

## 🏛️ ARCHITECT

> "Contract Hash 검증이 핵심. 매 머지마다 동작. ✓"

## 👤 ADVOCATE

> "G5.5 부담? 인간이 5분 사용해보면 됨. 자동 보조 활용. ✓"

## 🎩 MEPHISTO

> "9 Gate가 통과해도 G7이 진짜 출시 가능 보장. 인간 결정. ✓"

---

# 13. 다음 단계

```
검증 시스템 셋업 완료 후:
  → 08. Templates Library (모든 양식, 스크립트)
```

---

**END OF 07. VERIFICATION & INTEGRATION STANDARD**

_"Verification is not the final step. It's the only step that matters."_
