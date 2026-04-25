# `__manual__/` — 수동 실행 smoke 하네스

가-1 Group A 외부 계약 실측을 위한 **수동 실행** 스크립트 디렉토리.

## 운영 원칙

- **smoke 스크립트 (`*-smoke.ts`) 는 CI/test 자동화 대상 아님** — 실 외부 API 호출로 비용 발생. 매 push 마다 돌리면 안 됨
- **단위 테스트 (`__tests__/cost-cap.test.ts`) 는 외부 호출 0이므로 CI 자동 실행 대상** (Vitest mock 만 사용)
- 진산님 명시 승인 후에만 smoke 실행
- 결과는 `docs/measurements/{YYYYMMDD}-{name}.md` 에 요약 / `docs/measurements/raw/` 에 원본 (gitignore)

## 보안

- 비밀키는 항상 환경변수 (`process.env.ANTHROPIC_API_KEY` 등)
- 코드 상단에 키 리터럴 절대 금지
- pre-commit hook (`scripts/check-no-secrets.sh`) 가 다음 패턴 차단:
  - Anthropic / OpenAI / Cloudflare / Google / AWS / GitHub / Slack 토큰 prefix
  - `ANTHROPIC_API_KEY=` / `CLOUDFLARE_API_TOKEN=` 등 named 패턴
  - PEM private key 블록
  - JWT 3-segment
  - DB URL with embedded credentials

## 비용 / 호출 횟수 cap (필수 사용 규약)

```typescript
import { CostCap } from './cost-cap';

const cap = new CostCap({ maxUsd: 1.0, maxCalls: 50 });

// SDK 직접 호출 금지. 반드시 guardedCall 경유 + timeoutMs 명시 의무.
const response = await cap.guardedCall(
  /* estimatedMaxUsd */ 0.05,
  async (signal) => {
    const result = await sdk.messages.create(
      {
        /* ... */
      },
      { signal }, // signal 을 SDK 에 전달 — timeout 시 백엔드 요청 cancel
    );
    const actualUsd = computeCost(result.usage);
    return { result, actualUsd };
  },
  { timeoutMs: 30_000 }, // 항상 명시. 누락 시 fn hang 시 inflight chain 매달림
);

// 누적/한도 확인
console.warn(JSON.stringify(cap.snapshot()));
```

핵심:

- **사전 guard**: `accumulatedUsd + estimatedMaxUsd > maxUsd` 시 호출 자체 차단 (실 비용 발생 전)
- **사후 record**: 실 발생 비용을 누적. 단일 호출이 prediction 초과 시 사후에도 throw
- **인스턴스 격리**: 모듈 수준 mutable singleton 없음. 새 세션 = 새 `CostCap` 인스턴스
- **호출 횟수 cap**: 의도하지 않은 루프 차단 (기본 50회)
- **fn timeout 의무**: smoke 스크립트는 `timeoutMs` 항상 명시. 누락 시 fn hang → inflight Promise queue 매달림 (Pass 3 NEW-C-1 본질). ESLint 룰 강제는 Phase 1 후반전 이월

### timeout 동작 주의 (Pass 3 NEW-MIN-2)

- timeout 발생 시 `Promise.race` 가 `GuardedCallTimeoutError` 로 reject
- 그러나 **`fn` 자체는 백그라운드에서 계속 실행 가능** (예: Anthropic SDK 의 retry 큐). `fn` 작성자는 받은 `signal` 을 SDK / fetch 에 전달하여 백엔드 요청까지 cancel 할 책임
- timeout 시 `accumulatedUsd` 는 `estimatedMaxUsd` 만 보수 누적. 실제 비용이 더 크면 회계 미달 — `estimatedMaxUsd` 산정 시 max output tokens 기반으로 보수적 계산

## 디렉토리 구조

```
__manual__/
├── README.md            # 본 파일
├── cost-cap.ts          # CostCap class — guardedCall wrapper
├── __tests__/
│   └── cost-cap.test.ts # Vitest 단위 테스트
├── claude-smoke.ts      # A-1 (TBD)
├── pdfplumber-smoke.ts  # A-2 (TBD)
├── vision-smoke.ts      # A-3 (TBD)
├── .env*                # gitignore (개인 키)
├── secrets/             # gitignore
└── output/              # gitignore (실행 산출물)
```

## 한계 (이월 명시)

- **`git commit --no-verify` 우회 불가**: husky 본질적 한계. server-side `gitleaks` / GitHub push protection 도입은 Phase 1 후반 별도 plan
- **과거 history 의 비밀 미검출**: pre-commit 은 스테이징된 diff 만 검사. 이력 스캔은 별도 작업
- **`.gitattributes binary` 마킹 우회**: 파일이 `*.env binary` 같은 attribute 로 마킹되면 `git diff --cached` 가 "Binary files differ" 만 출력하여 패턴 매치 불가. server-side 스캐너로 보강 필요 (Phase 1 후반)
- **추가 위협 모델 패턴 미커버**: Stripe / Twilio / Sentry DSN / Discord / Telegram bot token 등은 본 프로젝트 단일 벤더 원칙상 미사용 가정으로 제외. 도입 시 PATTERNS 추가 필요
- **smoke 스크립트의 cost-cap 강제 통합**: 현재 README 텍스트 약속. ESLint `no-restricted-imports` 로 `@anthropic-ai/sdk` 직접 import 차단은 Phase 1 후반 별도 plan. **그 전까지 smoke 스크립트 작성 시 SDK 직접 호출 금지 — 반드시 `CostCap.guardedCall` 경유**
- **CostCap 의 인메모리 state**: 프로세스 재시작 시 0으로 reset. 동일 세션 연속 실행 시 인스턴스 재사용 또는 정상적 새 인스턴스 사용 권장
