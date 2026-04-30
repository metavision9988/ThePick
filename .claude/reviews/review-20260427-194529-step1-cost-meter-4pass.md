# 4-Pass 독립 에이전트 리뷰 — Step 1 Cost Meter

**리뷰 방식:** 독립 서브에이전트 3개 (메인 컨텍스트 외부, 코드 작성자 ≠ 리뷰어)
**리뷰 일시:** 2026-04-27 19:45:29
**리뷰 범위 (변경 파일 2건 + 연관 4건):**

- 변경: `apps/batch/src/cost-meter.ts` (~351줄, 신규)
- 변경: `apps/batch/__tests__/cost-meter.test.ts` (~272줄, 신규)
- 연관: `packages/shared/src/constants/claude-pricing.ts`
- 연관: `apps/batch/src/adapters/token-cost-logger.ts`
- 연관: `apps/batch/src/pipeline.ts`
- 연관: `docs/adr/ADR-025-two-layer-cost-control.md`, `docs/plans/engine-hardening/step1-cost-meter.plan.md`

---

## Pass 1 — SURGEON (silent-failure-hunter agent)

**판정:** 🔴 1건 / 🟠 3건 / 🟡 2건 / ✅ 6건 / N/A 1건 — **수정 필요**

### 🔴 CRITICAL P1-C1 — `process.exit(1)` 기본값이 checkpoint 미저장 보장

`onKillSwitch` 기본값이 `process.exit(1)` (cost-meter.ts:141~145, 322~333). autoEnforce=true(production 기본값) + kill_switch 도달 시 `evaluateAndEnforce` 내부에서 즉시 종료 — `finalize()` 미호출, breach 메타 휘발, **Step 11.5 plan(checkpoint)과 직접 충돌**. 운영자는 "왜 죽었는지" 추적 불가.

**권고:** 기본값을 `throw new KillSwitchError(...)`로 변경 (caller가 catch → finalize → checkpoint → exit). 또는 `gracefulShutdown?: () => Promise<void>` 훅 옵션화.

### 🟠 MAJOR

- **P1-M1**: docstring "autoEnforce=true 자동 throttle" vs 실제 동작 불일치 (cost-meter.ts:317~319 주석에 "caller 책임" 자백). 계약 위반. (테스트 미커버)
- **P1-M2**: `totalCostUsd += costUsd` 단순 누적 — IEEE 754 부동소수점 오차 누적 가능. 임계 판정 `0.6999...`로 SOFT 미발화 시나리오. 정수 마이크로센트 누적 권고.
- **P1-M3**: `calculateTokenCost`가 NaN 반환 시 `totalCostUsd = NaN` 오염 → `ratio() = NaN` → 모든 임계 미발화 (silent failure). `Number.isFinite()` 검증 누락.

### 🟡 MINOR

- **P1-m1**: `perModel` Map mutable 참조. 향후 getter 추가 시 invariant 깨짐 위험.
- **P1-m2**: `Number.isInteger`/`Number.isFinite` 미검증. NaN 토큰 입력 시 `NaN < 0 = false` → 통과.

### ✅ PASS (실제 확인)

1. 빈 catch 0건 — try-catch 자체가 코드 전체에 없음 (sweep 결과)
2. `firedThresholds` 1회 발화 정합 (296~310, 322~323) — 테스트 92~112L 검증
3. Negative 토큰 거부 (181~185, 테스트 60~64L)
4. Double start 거부 (160~162, 테스트 218~222L)
5. Threshold 불변성 (`0 < soft < hard < kill <= 1.0`, 149~156)
6. Async/await 누락 0건 — applyThrottle만 async, recordTokens는 의도적 sync

### 반론

production 8시간 BATCH 9000번째 호출 kill 도달 → autoEnforce=true 기본값 → console.error 1줄 → `process.exit(1)` → CostReport 휘발 → JSONL은 9000줄 있지만 breach 메타 사라짐. **테스트는 onKillSwitch=throw로 모킹해서 이 silent exit를 못 잡음 (test 150~165L).**

---

## Pass 2 — ARCHITECT (system-architect agent)

**판정:** 🔴 2건 / 🟠 3건 / 🟡 2건 / ✅ 4건 / N/A 1건 — **수정 필요**

### 🔴 CRITICAL P2-C1 — Haiku 단가 불일치 (ADR vs 실 코드)

- ADR-025 §2.3 line 134: Haiku **$0.80 / $4.0** per 1M
- claude-pricing.ts:25-28: **$1.0 / $5.0** per 1M (실 코드 사용)
- step1-plan.md:62: ADR과 일치 ($0.80/$4)

**영향:** CostMeter는 `calculateTokenCost`를 그대로 사용 → **실제 비용을 25% 과대 계측**. dailyBudgetUsd=$10이면 **실제 $12.5 시점에 kill 발동** = Anthropic 청구 $10 시점에 BATCH가 안 멈춤. ADR-025의 위협 모델("월 한도 $200") 무효화.

**권고:** ADR-025 §2.3과 claude-pricing.ts 중 진실의 원천 1개 선택 → 다른 쪽 정정. 진산님 결정 영역.

### 🔴 CRITICAL P2-C2 — Step 11.5 (recover/snapshot)와 kill switch 통합 누락

step6-recover-snapshot.plan.md는 "kill switch ↔ checkpoint 통합" 명시. 그러나 cost-meter.ts:141-145의 기본 onKillSwitch는 즉시 `process.exit(1)` — checkpoint 저장 hook 없음.

**권고:** kill 직전 `await flushCheckpoint()` hook 옵션 강제, 또는 헤더에 "통합은 Step 11.5에서 — 현 단계 단독 사용 금지" 명시. (P1-C1과 같은 결함, 다른 차원)

### 🟠 MAJOR

- **P2-M1**: Workers 호환성 — `process.exit`, `setTimeout` 둘 다 Cloudflare Workers 미지원. 헤더에 "Node-only" 명시 누락. 향후 Worker queue 진입 시 silent break.
- **P2-M2**: Idempotency — 동일 batchRunId 재실행 시 누적/리셋 정책 부재. recover 시 이전 누적 비용을 모르는 채 0부터 시작 → Layer 1 한도가 사실상 N배. start() 시 `initialSpend` 옵션 부재.
- **P2-M3**: TokenLogger도 내부에서 `calculateTokenCost`를 또 호출 (token-cost-logger.ts:75). 결과 동일하나 단가 갱신 시 race 가능. 한 곳에서 계산해 logger에 주입 권고.

### 🟡 MINOR

- **P2-m1**: 인터페이스 계약상 throttle 의무 강제 안 됨. caller가 status 무시하면 hard throttle 무력화.
- **P2-m2**: 테스트 단가 가정($1.0/$5.0)이 ADR-025와 다름 — ADR 갱신 시 test 일괄 수정 필요한 추적 메커니즘 부재.

### ✅ PASS

1. **Import 방향**: packages/shared(안정) → apps/batch(가변) 단방향 (cost-meter.ts:23). 역방향 0건.
2. **Hard Rule 17 (ExamId 리터럴)**: 시험 비특화 — 멀티시험 격리 정합.
3. **L3 영역 plan + 승인**: ADR-025 + step1-plan.md + ROADMAP v1.1 ACCEPTED 절차 충족.
4. **Validation 강건성**: 5종 invariant 가드 (threshold, budget, before-start, double-start, negative tokens).

### 반론

autoEnforce=true 운영에서 첫 호출이 곧장 kill 임계 초과(예: 잘못된 dailyBudgetUsd=0.001 + 정상 호출). soft → hard → kill 순차 발화가 아닌 **단일 호출에서 3개 임계 동시 돌파**. firedThresholds Set으로 1회 발화 보장은 되나, soft/hard breach 기록 직전 kill의 onKillSwitch가 process.exit를 부르면 finalize 미호출 → CostReport 미생성.

---

## Pass 4 — CONTRACT (quality-engineer agent)

**판정:** 🔴 0건 / 🟠 2건 / 🟡 3건 / ✅ 8건 / N/A 2건 — **계약 동기화 누락**

### 🟠 MAJOR

#### P4-M1 — Haiku 단가 ADR 명세 vs 실 코드 불일치 (Pass 2 P2-C1과 동일 지적)

ADR-025 line 134: $0.80/$4 / claude-pricing.ts:26-27: $1.0/$5.0 / step1-plan.md:62: $0.80/$4. 실 코드가 ADR/plan 둘 다 위배.

#### P4-M2 — CostMeter 인터페이스 시그니처 변경 (Silent Pivot 정의 부합)

| ADR-025 §2.3 명세                    | 실 코드                                     | 차이                        |
| :----------------------------------- | :------------------------------------------ | :-------------------------- |
| `start(batchRunId, dailyBudgetUsd)`  | constructor + `start()`                     | batchRunId/budget 위치 이동 |
| `recordTokens(input, output, model)` | `recordTokens(input, output, model, stage)` | stage 추가                  |
| `getThresholdStatus()`               | `getStatus()`                               | 이름 변경                   |

세 변경 모두 정당한 설계 개선이지만 **CLAUDE.md CRITICAL RULE #1 위반**: "기획과 다르게 구현하려면 → 코딩 멈추고 인간에게 먼저 보고". ADR/plan 패치 또는 alias 추가 필요.

### 🟡 MINOR

- **P4-m1**: AC-CM-5의 `cost_per_node_usd` 필드 plan에 명시되었으나 코드에 부재 (노드 수 정보 부재라 측정 불가). plan 결함.
- **P4-m2**: `duration_seconds` (plan) vs `duration_ms` (코드) 단위 변경 — 정밀도 향상이나 plan 미패치.
- **P4-m3**: applyThrottle이 recordTokens에서 자동 await 안 됨 — caller 책임. ADR-025 표 line 125 함의와 다름.

### ✅ PASS (실제 확인)

1. **3단계 임계** 0.7/0.9/1.0 정확 (DEFAULT_THRESHOLDS, test L225)
2. **AC-CM-1 회계** (test L27-44, 누적/per-model)
3. **AC-CM-2 SOFT 1회성** (firedThresholds Set, test L92-112)
4. **AC-CM-3 HARD throttle** (test L116-135, 50ms sleep 측정)
5. **AC-CM-4 KILL 분기** (autoEnforce false/true/150% 초과, test L138-177)
6. **VOID 헌법 v3.0 Vol VI.3 정합** (3단계 + recovery 경로 옵션화)
7. **invariants 방어** (test L205-227, 5종 throw 검증)
8. **TokenLogger DI** (test L229-271)

### N/A

- **AC-CM-6 Layer 2 Chaos**: plan §AC-CM-6 자체가 "Step 11.5 통합 후" 명시 → 본 단계 N/A 정합.
- **fixture mode 호환**: pipeline.ts 통합 미완 → N/A.

### 반론

`firedThresholds`가 Set이라 **단조 증가만 가정** — 환불/롤백 시나리오 지원 X. 또한 단발 거대 호출 시 SOFT/HARD breach가 같은 호출에서 함께 기록되지만 throttle 적용 못 하고 즉시 KILL → ADR-025 "70%→90%→100% 단계적 차단" 의도 무효화. 테스트 미커버.

---

## Pass 3 — ADVOCATE: N/A (사유 명시)

CostMeter는 BATCH 내부 도구 — 사용자 직접 노출 X (UI/UX 영향 없음). Pass 3 (Advocate, UX + 보안)의 핵심 체크 항목 (에러 UX, 상태 표현, 접근성, 보안 입력 검증)이 본 코드에 적용 대상 X. Pass 3는 Phase 2 (사용자 진입) 시점에 BATCH 결과 노출 화면 작성 시 활성.

단, 보안 차원 1건은 다른 Pass에 흡수: Pass 1 MAJOR P1-M3 (NaN 오염) = 입력 검증 미흡으로 판정.

---

## 종합 판정

**총 결과:** 🔴 **CRITICAL 3건** / 🟠 MAJOR 7건 / 🟡 MINOR 7건 / ✅ PASS 18건 / N/A 4건

**완료 선언 불가** — CRITICAL 0건 의무 위배. 수정 후 재검증 필요.

### CRITICAL 3건 통합 (중복 제거)

|   #    | 출처                   | 핵심 결함                                                                            |    우선순위    |
| :----: | :--------------------- | :----------------------------------------------------------------------------------- | :------------: |
| **C1** | P1+P2 (양쪽 동시 지적) | `process.exit(1)` 기본값 → checkpoint 미저장 + Step 11.5 통합 누락 + CostReport 휘발 |  🔴 즉시 수정  |
| **C2** | P2                     | Haiku 단가 ADR-025 $0.80/$4 vs claude-pricing.ts $1.0/$5.0 → **25% 과대 계측**       | 🔴 진산님 결정 |
| **C3** | P4                     | 인터페이스 Silent Pivot — start() 시그니처 + getStatus 이름 + stage 파라미터         |  🔴 즉시 수정  |

### 수정 계획 후보

**A. C1 (process.exit 기본값) — 코드 수정**

- `autoEnforce` 기본값을 `false`로 변경 → production 통합 시 명시적 `true` + checkpoint hook 주입
- 또는 onKillSwitch 기본값을 `throw new KillSwitchError`로 변경 (caller catch 의무)

**B. C2 (단가 불일치) — 진산님 결정 갈림길**

- B1. ADR-025 §2.3 단가 표를 claude-pricing.ts와 일치시킴 (보수적 단가 인정)
- B2. claude-pricing.ts를 ADR-025와 일치시킴 (Anthropic 공식 가격, 정확)
- B3. claude-pricing.ts에 "보수적 fallback" footnote + ADR-025도 양쪽 명시 (현 상태 인정 + 문서만 정정)

**C. C3 (인터페이스 Silent Pivot) — 문서 패치**

- ADR-025 §2.3 + step1-plan.md를 실 코드의 개선된 설계로 갱신 + Silent Pivot 보고
- 변경 사유 명시: "constructor immutability / audit stage / naming concision"

### MAJOR 7건 처리 권고

- P1-M1, P1-M2, P1-M3: 즉시 수정 (NaN 방어, throttle 자동 await, 정수 누적)
- P2-M1, P2-M2, P2-M3: 헤더 주석 + recover hook + 한 곳 계산
- P4-M1, P4-M2: C2/C3 수정 시 자동 해결

### 다음 액션

본 리뷰 결과를 진산님에게 보고 → 수정 계획 승인 → 코드/문서 동기 패치 → 4-Pass 재검증 → CRITICAL 0건 후 Step 1 "완료" 선언.

---

**리뷰어:** silent-failure-hunter, system-architect, quality-engineer (3개 독립 에이전트, 메인 대화 컨텍스트 외부)
**Pass 3 ADVOCATE:** N/A (사용자 노출 X — Phase 2 진입 시 활성)
**판정:** ❌ 수정 필요. CRITICAL 3건 해결 + 4-Pass 재검증 후 완료 가능.
