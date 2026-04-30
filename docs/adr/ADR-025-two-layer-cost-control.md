# ADR-025: Two-Layer Cost Control Architecture

- **상태:** Accepted (v1.1 patched 2026-04-27)
- **결정일:** 2026-04-27
- **v1.1 패치 사유:** 4-Pass 독립 에이전트 리뷰 (`.claude/reviews/review-20260427-194529-step1-cost-meter-4pass.md`)에서 발견된 CRITICAL 2건 정정 — ① 단가 표를 `claude-pricing.ts` (보수적 fallback)와 일치, ② CostMeter 인터페이스 시그니처를 실 코드의 개선된 설계로 갱신
- **결정자:** 진산
- **관련 헌법:** v3.0 Vol VI.3 (Financial Circuit Breaker), Vol IX #14 (Free Tier Trap), Vol XVII (Single-Vendor Lock-in Profile)
- **관련 ADR:** ADR-006 (Cloudflare 단일 벤더), ADR-022 (5년 Lock-in)
- **트리거:** Engine Hardening Roadmap v1.1 Step 4 (Review B-3 Two-Layer Cost Control 권고)

---

## 1. Context (맥락)

### 1.1 v3.0 헌법의 미흡한 지점

v3.0 Vol VI.3 Financial Circuit Breaker는 soft 70% / hard 90% / kill 100% 3단계를 명시하지만 **"어디서" 차단하는지는 명시 안 함**. Review B (외부 메타 옵저버)가 정확히 짚었다:

> "비용 통제는 엔진 내부가 아니라 엔진을 감싸는 **외부 장(Field)**에서 이루어져야 합니다. TypeScript 코드 내의 미터기가 '100'을 감지하고 루프를 중단시키기 전에 이미 수십 달러의 비용이 청구될 수 있습니다."

### 1.2 단일 Layer Cost Meter의 결함

`apps/batch/src/cost-meter.ts` 단독으로는:

- ✅ 토큰 소비량 회계 정확
- ✅ 도메인 컨텍스트 풍부 (어느 노드 처리 중인지)
- ❌ 비동기 in-flight 요청 차단 불가 — Anthropic API 호출 N개가 동시에 진행 중일 때, 미터가 "kill" 판정 시점에 이미 N개 청구 진행
- ❌ 코드 버그 (무한 루프, 잘못된 조건문) 시 미터 자체가 우회됨
- ❌ 외부 API 키 탈취 시 차단 불가

### 1.3 ThePick 환경의 특수성

Review B 원안은 Cloudflare Workers 환경 (API Gateway 차단) 가정. 그러나 ThePick BATCH는 **Node.js 로컬 환경** (`apps/batch/package.json`의 `tsx ./bin/batch.ts`):

| Review B 원안                              | ThePick 실제                                               |
| :----------------------------------------- | :--------------------------------------------------------- |
| Cloudflare API Gateway outbound rate limit | ❌ Node.js 로컬엔 적용 안 됨 (Gateway 미경유)              |
| Workers AI 비용 차단                       | ❌ ThePick BATCH는 Anthropic 직접 호출 (Workers AI 미사용) |
| Cloudflare Workers monthly cap             | ⚠️ Phase 2 진입 시 적용                                    |

→ Layer 2 매핑을 ThePick 환경에 맞게 재정의 필요.

---

## 2. Decision (결정)

### 2.1 핵심

**비용 통제는 단일 Layer가 아닌 2개 Layer (Application + Infrastructure)로 구성한다. Layer 2는 ThePick 환경에 맞춰 "Anthropic 콘솔 cap + git pre-commit hook + monthly billing alert" 조합으로 매핑한다.**

### 2.2 Two-Layer 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Application (apps/batch/src/cost-meter.ts)        │
│  ─────────────────────────────────────────────────────       │
│  목적: 정확한 회계 + 도메인 컨텍스트 풍부 + soft 알림        │
│  강점: 어느 노드 처리 중인지, 누적 토큰 정확                 │
│  약점: 비동기 in-flight 차단 불가, 코드 버그 시 우회         │
│                                                              │
│  3단계 임계: soft 70% (warn) / hard 90% (slow) / kill 100%   │
└─────────────────────────────────────────────────────────────┘
                            ↓ 우회 시
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Infrastructure (안전망)                            │
│  ─────────────────────────────────────────────────────       │
│  목적: 물리적·계약적 차단 (Layer 1 우회 시 안전망)           │
│  강점: 코드 버그·악의적 우회에도 강제 적용                   │
│  약점: 도메인 컨텍스트 빈약 (한도 초과 = 모든 호출 차단)     │
│                                                              │
│  ThePick 매핑:                                                │
│   - Anthropic 콘솔 monthly billing cap                       │
│   - Anthropic billing alerts (50%/80%/100%)                  │
│   - Anthropic API key 단일 (탈취 차단)                       │
│   - git pre-commit hook (대용량 SQL 변경 차단)               │
│   - Cloudflare Workers monthly cap (Phase 2 진입 시)         │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Layer 1 — Application 명세 (v1.1 갱신)

**파일:** `apps/batch/src/cost-meter.ts`

**기능 (실제 구현 시그니처):**

```typescript
class CostMeter {
  // 옵션은 constructor 로 주입 (immutability — 실행 중 budget 변경 불가)
  constructor(options: {
    batchRunId: string;
    dailyBudgetUsd: number;
    logger?: TokenLogger;
    thresholds?: CostThresholds; // 기본 0.7 / 0.9 / 1.0
    autoEnforce?: boolean; // 기본 false (안전). production 명시 true 의무
    clock?: () => number;
    onKillSwitch?: () => never; // 기본 throw KillSwitchError; production 시 checkpoint flush 후 process.exit
    throttleSleepMs?: number; // 기본 1000
    initialSpendUsd?: number; // recover/resume 인계 (Step 5/11.5 통합)
  });

  // BATCH 시작 시 호출 (duration 측정 시작점)
  start(): void;

  // 매 Anthropic API 호출 직후 호출 — stage 파라미터로 audit log + breach 추적
  recordTokens(inputTokens: number, outputTokens: number, model: string, stage: string): CostStatus;

  // 누적 비용 (USD) — 정수 마이크로센트 누적, 부동소수점 오차 차단
  getCurrentSpend(): number;

  // 임계 도달 여부
  getStatus(): 'ok' | 'soft_warn' | 'hard_throttle' | 'kill_switch';
  ratio(): number;

  // Hard throttle — caller 가 status 보고 await (sync recordTokens 안에서 자동 await 불가)
  applyThrottle(): Promise<void>;

  // Kill switch — 기본 KillSwitchError throw (caller catch 의무).
  // production 에서는 onKillSwitch 옵션으로 checkpoint flush + process.exit 주입.
  triggerKillSwitch(): never;

  // BATCH 종료 시 보고서 출력 (kill 후에도 catch → finalize 가능)
  finalize(): CostReport;
}

interface CostReport {
  batch_run_id: string;
  daily_budget_usd: number;
  initial_spend_usd: number; // recover 인계 비용
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number; // 정수 마이크로센트 / 1e6
  per_model: Record<string, PerModelUsage>;
  threshold_breaches: ThresholdBreach[];
  call_count: number;
  duration_ms: number; // ms 단위 (s 가 아님 — 정밀도)
  final_status: CostStatus;
}
```

**v1.0 → v1.1 시그니처 변경 사유 (Pass 4 CONTRACT 리뷰):**

| 변경                                                                   | 사유                                                                        |
| :--------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| `start(batchRunId, dailyBudgetUsd)` → constructor 주입                 | immutability — 실행 중 budget 변경 차단                                     |
| `recordTokens(in, out, model)` → `recordTokens(in, out, model, stage)` | audit log + breach 추적에 stage 컨텍스트 필요                               |
| `getThresholdStatus()` → `getStatus()`                                 | 명명 간결성                                                                 |
| `cost_per_node_usd` 필드 제거                                          | CostMeter 자체는 노드 수 정보 부재 — Step 11.5 통합 시 BATCH 종료 후 derive |
| `duration_seconds` → `duration_ms`                                     | 정밀도 향상                                                                 |
| `initialSpendUsd` 옵션 추가                                            | recover/resume 인계 (Step 5/11.5)                                           |

**3단계 임계 (Daily Budget = $10 BATCH 1회 기준):**

| 임계          |    비율    | 액션                                                                   |
| :------------ | :--------: | :--------------------------------------------------------------------- |
| soft_warn     |  70% ($7)  | console.warn + slack/email 알림 (Phase 2부터)                          |
| hard_throttle |  90% ($9)  | caller 가 status 검사 후 `await applyThrottle()` (1초 sleep)           |
| kill_switch   | 100% ($10) | autoEnforce=true 시 `onKillSwitch()` 호출 (기본 KillSwitchError throw) |

**단발 거대 호출 시:** SOFT/HARD/KILL 누적 발화 — 모든 lower 임계 breach 가 같은 stage 에서 기록됨 (Pass 4 반론 대응).

**모델별 단가 (2026-04-27 기준, `packages/shared/src/constants/claude-pricing.ts` 와 일치):**

| 모델              |   Input   |  Output   | 비고                                                                                                                             |
| :---------------- | :-------: | :-------: | :------------------------------------------------------------------------------------------------------------------------------- |
| Claude Opus 4.7   | $15 / 1M  | $75 / 1M  | 정확                                                                                                                             |
| Claude Sonnet 4.6 |  $3 / 1M  | $15 / 1M  | 정확                                                                                                                             |
| Claude Haiku 4.5  | $1.0 / 1M | $5.0 / 1M | **보수적 fallback** — Anthropic 공식 ($0.80/$4.0) 대비 +25% 안전 마진. 실제 청구는 본 표보다 낮음 → kill 가 보수적으로 일찍 발동 |
| 알 수 없는 모델   |  $3 / 1M  | $15 / 1M  | Sonnet fallback (`packages/shared/src/constants/claude-pricing.ts:45-49`)                                                        |

**근거:** 보수적 단가는 안전 마진 확보. Layer 2 (Anthropic 콘솔 monthly cap) 가 실제 청구의 진실 소스이므로 Layer 1 의 over-estimate 는 안전 측 오류. 진짜 가격이 인하되어도 BATCH 가 더 자주 멈출 뿐, 비용 폭발은 발생 안 함.

(BATCH 적재는 Opus 4.7 직접 처리 — 메모리 `project_batch_load_workflow`. Anthropic 가격 변경 시 `claude-pricing.ts` 갱신 + 본 표 갱신 + ADR 신규 작성.)

### 2.4 Layer 2 — Infrastructure 명세 (ThePick 매핑)

#### 2.4.1 Anthropic 콘솔 Monthly Billing Cap

- **위치:** Anthropic Console → Billing → Monthly cap
- **설정값:**
  - 초기 (Phase 1): **$200/월** (BATCH-1~Q 적재 누적 안전 마진)
  - Phase 2~3: 실 사용량 기반 재조정
- **Cap 도달 시 동작:** Anthropic 측에서 API 호출 자동 차단 (HTTP 429 또는 결제 실패)
- **확인 방법:** Anthropic Console에서 진산님이 직접 확인 (스크린샷 → `docs/exit-strategy/anthropic-cap-{YYYY-MM}.png` 보관)

#### 2.4.2 Anthropic Billing Alerts

- **위치:** Anthropic Console → Billing → Alerts
- **알림 임계:**
  - 50% — 이메일 알림 (조기 인지)
  - 80% — 이메일 + 검토 권고
  - 100% — 이메일 + Cap 도달 → BATCH 중단

#### 2.4.3 git pre-commit hook (대용량 변경 차단)

**파일:** `.husky/pre-commit-cost-guard.sh` (신규)

**기능:**

- D1 마이그레이션 SQL 변경 감지 — 의도하지 않은 대용량 INSERT/UPDATE 차단
- BATCH fixture 디렉토리 변경 감지 — 1MB 초과 변경 시 경고
- 환경변수 (`ANTHROPIC_API_KEY`) commit 차단

**트리거 조건:**

- `migrations/*.sql` 변경 + `INSERT|UPDATE` 키워드 다수 포함
- `apps/batch/__fixtures__/**` 변경 + 합계 ≥ 1MB
- 어떤 파일이든 `sk-ant-` (Anthropic API key 패턴) 포함

**액션:** commit 차단 + 진산님 명시 우회 시 (`git commit --no-verify`) 만 진행 (메모리 `feedback_no_shortcuts` 정합 — 우회 가능하나 의식적 결정 필요).

#### 2.4.4 Cloudflare Workers Monthly Cap (Phase 2 진입 시 활성화)

- **위치:** Cloudflare Dashboard → Workers → Subscriptions → Spend limit
- **설정값:** Phase 2 진입 시 결정 (현재 $0 — Workers 사용량 0)
- **Cap 도달 시 동작:** Workers 호출 차단 (HTTP 503)

**Phase 1 단계 (현재):** `apps/api`만 일부 호출 (인증/결제 mock 핸드셰이크) — Cloudflare Workers 무료 한도 (월 100k 요청) 내. Cap 미설정 OK.

### 2.5 Layer 1 + Layer 2 동기화

**원칙:** Layer 1과 Layer 2의 임계는 일치하지 않는다. Layer 2가 더 관대 (안전망).

| 임계         | Layer 1 (per BATCH run) |          Layer 2 (monthly)          |
| :----------- | :---------------------: | :---------------------------------: |
| Daily budget |     $10 (1회 BATCH)     |                  —                  |
| Monthly cap  |            —            |          $200 (Anthropic)           |
| 격차         |            —            | 20 BATCH × $10 = $200 (이론적 최대) |

→ Layer 2가 Layer 1을 20배 허용. Layer 1 정상 동작 시 Layer 2는 발동 안 됨. Layer 1 우회 시 Layer 2가 안전망.

---

## 3. Consequences (결과)

### 긍정적

- v3.0 Vol VI.3 Financial Circuit Breaker "어디서 차단" 명문화 → 헌법 정합 강화
- Layer 1만 있을 때의 비동기 in-flight 위험 차단
- ThePick 환경(Node.js 로컬)에 맞춘 매핑 — Cloudflare API Gateway 미사용 인정
- git pre-commit hook이 대용량 변경의 부수적 차단 효과 (BATCH fixture 의도치 않은 commit 등)

### 부정적 / 트레이드오프

- Anthropic 콘솔 cap 설정은 진산님 수동 작업 (자동화 불가 — 결제 정보 접근 권한 분리)
- Layer 2 매핑이 Cloudflare 외부에 있는 부분(Anthropic) 인정 → ADR-006 단일 벤더 원칙의 부분 예외 (단, 단일 벤더 정책은 IT 인프라에 한정. Anthropic은 LLM IP — ADR-006 §"불가피한 외부 의존" 정합)
- git pre-commit hook 우회 가능 (`--no-verify`) — 인지 비용 추가

### 즉시 발생하는 작업 (Engine Hardening Roadmap)

- **Step 12 (Cost meter 코드 구현)** — Layer 1 코드 작성
- **D-Day 0 (본 ADR ACCEPTED 직후) — 진산님 Anthropic 콘솔 cap $200 설정** (수동, 30초)
- **D+1 (다음 Phase 0 commit) — pre-commit hook 추가** (`/user:gates`로 검증)

---

## 4. Alternatives Considered (대안)

| 대안                                       | 장점                                   | 단점                                          | 미선택 이유         |
| :----------------------------------------- | :------------------------------------- | :-------------------------------------------- | :------------------ |
| Layer 1 단독 (현재 v1.0)                   | 단순                                   | 비동기 in-flight 차단 불가, 우회 가능         | Review B-3 위배     |
| Cloudflare API Gateway outbound rate limit | 표준 SaaS 패턴                         | ThePick BATCH는 Workers 미경유 (Node.js 로컬) | 적용 불가           |
| Anthropic Cap만 (Layer 2만)                | 단순                                   | 도메인 컨텍스트 빈약 + Layer 1 회계 정보 부재 | 운영 시 디버깅 불가 |
| **Layer 1 + Layer 2 (본 ADR)**             | 정확 회계 + 안전망 + ThePick 환경 정합 | Layer 2 일부 수동                             | **선택**            |
| Layer 3 추가 (외부 budget guard SaaS)      | 더 강력                                | 외부 SaaS 도입 → ADR-006 위배                 | ADR-006 위배        |

---

## 5. Migration / Backward Compatibility

- 본 ADR ACCEPTED 시점 — 코드 변경 없음 (Step 12에서 Layer 1 신규 작성)
- Anthropic Console cap은 외부 작업 (코드 영향 0)
- pre-commit hook 추가는 husky 기존 설정에 추가 (backward compatible)

---

## 6. SLO Impact

| SLO                                  | Before           | After                       |
| :----------------------------------- | :--------------- | :-------------------------- |
| `build_cost_max_usd` (per BATCH run) | 측정 안 함       | ≤ $10 (Layer 1 kill switch) |
| Monthly Anthropic cost               | 측정 안 함       | ≤ $200 (Layer 2 cap)        |
| BATCH 비용 폭발 위험                 | 높음 (무한 가능) | 낮음 (2-Layer 차단)         |

---

## 7. Human Decision Required

- [x] Approved (진산님 2026-04-27 — Engine Hardening Roadmap v1.1 승인 메시지)
- [ ] Rejected
- [ ] Modified

**Reviewer:** 진산
**Date:** 2026-04-27

**진산님 즉시 작업 (본 ADR ACCEPTED 직후):**

- [ ] Anthropic Console → Billing → Monthly cap = $200 설정
- [ ] Anthropic Console → Billing → Alerts (50%/80%/100%) 설정
- [ ] 설정 완료 스크린샷 → `docs/exit-strategy/anthropic-cap-2026-04.png`

(위 작업은 진산님 통제 영역 — Claude는 코드만 작성, Anthropic 콘솔 접근 불가)

---

## 8. 부록 — v3.1 헌법 패치 후보 입력

본 ADR은 v3.0 Vol VI.3의 미흡함("어디서" 차단)을 ThePick 환경에서 해결한 사례.

v3.1 헌법 패치 후보로 다음 명시 권고:

> **Vol VI.3 강화안 (v3.1):**
> Financial Circuit Breaker는 Application Layer 단독으로 충분하지 않다. 반드시 Infrastructure Layer (벤더 콘솔 cap, API Gateway, billing alert 등)와 Two-Layer로 구성하라. 환경별 매핑:
>
> - SaaS Workers 환경: Cloudflare API Gateway + 벤더 cap
> - Node.js 로컬 환경: 벤더 콘솔 cap + git pre-commit hook
> - 자체 호스팅: nginx rate limit + iptables + 벤더 cap

→ ThePick BATCH 보강이 헌법 v3.1 후보 케이스 1건 도출.
