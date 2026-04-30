# Step 1 — Cost Meter (Layer 1 Application)

---

phase: 1
step: engine-hardening-step1
approved_by: TBD
risk_level: L2
scope:

- apps/batch/src/cost-meter.ts (신규)
- apps/batch/**tests**/cost-meter.test.ts (신규)
- apps/batch/src/pipeline.ts (수정 — cost meter 통합, Phase 1 후반 LLM 활성 시점)
- ~~packages/shared/src/cost/pricing.ts (신규 — 모델별 단가)~~ → **재사용으로 폐기.** 기존 `packages/shared/src/constants/claude-pricing.ts` (CLAUDE_PRICING + calculateTokenCost) 그대로 활용

---

## 목적

ADR-025 Two-Layer Cost Control의 **Layer 1 (Application)** 구현. BATCH 적재 시 Anthropic 토큰 소비량 정확 회계 + soft 70% / hard 90% / kill 100% 임계 동작. Layer 2 (Anthropic 콘솔 cap)와 함께 BATCH 비용 폭발 차단.

## 근거

- ADR-025 (Two-Layer Cost Control) §2.3
- v3.0 Vol VI.3 Financial Circuit Breaker
- Engine Hardening Roadmap v1.1 Step 7

---

## 대상 파일

### 신규

- `apps/batch/src/cost-meter.ts` — `CostMeter` 클래스, 임계 판정 로직 (정수 마이크로센트 누적)
- `apps/batch/__tests__/cost-meter.test.ts` — 임계 도달·우회 시나리오 + NaN/Infinity 거부 + initialSpend + 단발 거대 호출 (총 31 tests)

### 재사용 (기존 자산)

- `packages/shared/src/constants/claude-pricing.ts` — 기존 `CLAUDE_PRICING` 레지스트리 + `calculateTokenCost` 활용. 본 plan 에서 신규 파일 없음 (원안의 `pricing.ts` 신설 폐기)
- `apps/batch/src/adapters/token-cost-logger.ts` — 기존 JSONL 로거를 옵션으로 주입

### 수정

- `apps/batch/src/pipeline.ts` — Stage 3 (Claude API 배치 구조화) 활성 시점에 통합 (Phase 1 후반 LLM 통합과 동기). 현재는 fixture mode 라 통합 불요.

---

## 인터페이스 설계 (ADR-025 §2.3 v1.1 인용)

```typescript
// apps/batch/src/cost-meter.ts
export class CostMeter {
  // 옵션은 constructor 로 (immutability — 실행 중 budget 변경 차단)
  constructor(options: CostMeterOptions);
  start(): void;
  recordTokens(
    inputTokens: number,
    outputTokens: number,
    model: string,
    stage: string, // audit log + breach 추적
  ): CostStatus;
  getCurrentSpend(): number; // 정수 마이크로센트 누적
  getStatus(): CostStatus; // 'ok' | 'soft_warn' | 'hard_throttle' | 'kill_switch'
  ratio(): number;
  applyThrottle(): Promise<void>; // caller 가 status 보고 await
  triggerKillSwitch(): never; // 기본 KillSwitchError throw
  finalize(): CostReport; // kill 후 catch → finalize 가능
}
```

**모델별 단가 (claude-pricing.ts 와 일치, Haiku $1.0/$5.0 보수적 fallback)**: 기존 `packages/shared/src/constants/claude-pricing.ts` 의 `CLAUDE_PRICING` 레지스트리와 `calculateTokenCost()` 함수를 그대로 재사용. 본 plan 에서 별도 신규 파일 생성하지 않음.

---

## 위험 분석

| 위험                                             | 완화                                                                         |
| :----------------------------------------------- | :--------------------------------------------------------------------------- |
| 비동기 in-flight 요청 차단 불가 (Layer 1 한계)   | Layer 2 (Anthropic cap)가 안전망 — ADR-025 §2.5                              |
| 모델 단가 변경 (Anthropic 가격 정책)             | `MODEL_PRICING_2026_04` 명시적 dated 상수, 변경 시 ADR 트리거                |
| Token count 추정 오차                            | Anthropic SDK 응답의 `usage.input_tokens` `output_tokens` 직접 사용 (추정 X) |
| `process.exit(1)` 시 Checkpoint 미저장           | Step 11.5 recover()와 통합 — kill switch 시 snapshot() 먼저 호출             |
| Daily budget 초과 후에도 사용자가 강제 진행 시도 | 환경변수 `COST_KILL_BYPASS=true` 명시 시에만 우회 (의식적 결정)              |

---

## 검증 계획 (Acceptance Criteria)

### AC-CM-1: Token 회계 정확도 95%+

- 가짜 Anthropic 응답 (mock) 100건 처리 → 누적 token count
- 실제 사용량 대비 95%+ 일치 (Anthropic SDK `usage` 필드 직접 사용 시 100%)

### AC-CM-2: Soft warn 70% 도달 시 console.warn

- Daily budget $10 → $7 도달 시점에 `console.warn` 발생 확인
- 메시지 형식: `[CostMeter] SOFT_WARN: $7.00/$10.00 (70%) — BATCH continues`

### AC-CM-3: Hard throttle 90% 도달 + caller pattern

- $9 도달 시 `recordTokens()` 가 `'hard_throttle'` status 반환
- caller 가 status 검사 후 `await meter.applyThrottle()` 호출 — sync `recordTokens()` 안에서 자동 await 불가 (cost-meter.ts:79-83 docstring 명시)
- `Date.now()` 차이로 N ms+ sleep 확인 (기본 1000ms, 테스트 50ms)

### AC-CM-4: Kill switch 100% 도달 + caller catch 패턴

- $10 도달 → autoEnforce=true 시 `onKillSwitch()` 호출
- 기본 `onKillSwitch` 는 `KillSwitchError` throw — caller 가 catch → `finalize()` → checkpoint flush → `process.exit(1)` 패턴 (Step 11.5 통합 의무)
- `process.exit` 직접 호출 금지 — CostReport 휘발 차단 (4-Pass review CRITICAL P1-C1 정정 사유)
- autoEnforce=false 기본값에서는 status 만 반환, throw 없음

### AC-CM-5: finalize() 보고서 출력

- BATCH 종료 시 `CostReport` 생성 (KillSwitchError catch 후에도 호출 가능)
- 필드: `batch_run_id`, `daily_budget_usd`, `initial_spend_usd`, `total_input_tokens`, `total_output_tokens`, `total_cost_usd`, `per_model`, `threshold_breaches[]`, `call_count`, `duration_ms`, `final_status`
- 단위: `duration_ms` (ms — 정밀도). `cost_per_node_usd` 는 본 모듈 외 derive (Step 11.5 통합 시 노드 수 분모 적용)

### AC-CM-6: Layer 2 안전망 우회 시나리오 (Chaos)

- Layer 1 disable (`COST_METER_DISABLED=true`) 환경에서 BATCH 실행
- Anthropic 콘솔 cap 활성 시 → API 호출이 HTTP 429로 거부됨을 확인
- Layer 1 미경유에도 Layer 2가 차단 → 시스템 안전성 입증

---

## 롤백 전략

본 plan 구현 중 또는 후 결함 발견 시:

- `apps/batch/src/cost-meter.ts` 삭제
- `pipeline.ts`의 `recordTokens()` 호출 revert
- Layer 2 (Anthropic 콘솔 cap)는 영구 유지 (안전망)

---

## 승인 기록

- 진산님 승인: 2026-04-27 Engine Hardening Roadmap v1.1
- 의존성: ADR-025 ACCEPTED → Layer 1 명세 확정 → 본 plan 구현

---

## 의존성

- **Blocked by:** ADR-025 ACCEPTED (완료)
- **Blocks:** Step 11.5 recover() (kill switch ↔ checkpoint 통합)
- **참조:** v3.0 Vol VI.3, ADR-025 §2.3

---

## 작업 추정

- 낙관: 0.5d
- 현실: 0.75d
- 비관: 1d
