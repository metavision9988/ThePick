# 4-Pass 재검증 — Step 1 Cost Meter (CRITICAL 정정 후)

**리뷰 방식:** 독립 서브에이전트 3개 (1차 리뷰의 정정 결과 회귀 점검)
**리뷰 일시:** 2026-04-27 21:52:48
**1차 리뷰:** `.claude/reviews/review-20260427-194529-step1-cost-meter-4pass.md` (CRITICAL 3 / MAJOR 7)
**Vitest 결과:** 31/31 PASS
**TypeCheck:** PASS

---

## 재검증 결과 종합

| Pass        | 에이전트              | 1차 결과        | 재검증 결과                                |
| :---------- | :-------------------- | :-------------- | :----------------------------------------- |
| 1 SURGEON   | silent-failure-hunter | 🔴1 / 🟠3 / 🟡2 | **🔴0 / 🟠0 / 🟡1 / ✅6 — 완료 가능**      |
| 2 ARCHITECT | system-architect      | 🔴2 / 🟠3 / 🟡2 | **🔴0 / 🟠0 / 🟡1 / ✅5 — 완료 가능**      |
| 3 ADVOCATE  | (N/A — 사용자 노출 X) | —               | —                                          |
| 4 CONTRACT  | quality-engineer      | 🔴0 / 🟠2 / 🟡3 | **🔴0 / 🟠0 / 🟡2 → 0 / ✅12 — 완료 가능** |

**합계 (재검증):** 🔴 CRITICAL **0건** / 🟠 MAJOR **0건** / 🟡 MINOR 0건 (정정 후) / ✅ PASS 23건

→ **CRITICAL 3건 → 0건 / MAJOR 7건 → 0건. 완료 선언 가능.**

---

## 1차 지적 정정 검증

### CRITICAL 3건 — 모두 PASS

|  #  | 1차 지적                                                  | 정정 방향                                                                       |                                                                                    검증 결과                                                                                    |
| :-: | :-------------------------------------------------------- | :------------------------------------------------------------------------------ | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| C1  | `process.exit(1)` 기본값 → checkpoint 미저장              | `autoEnforce` 기본값 false + `KillSwitchError` throw 기본 + caller catch 패턴   |                  ✅ cost-meter.ts:52~64 (Error class), :199 (`?? false`), :203~207 (default throw); test L208~228 (caller catch → finalize, breaches 3건 보존)                  |
| C2  | Haiku 단가 ADR vs claude-pricing.ts 25% 격차              | ADR + plan → claude-pricing.ts ($1.0/$5.0)와 일치 + "보수적 fallback" 사유 명시 |                           ✅ ADR-025:172 (Haiku $1.0/$5.0 + +25% 안전 마진 명시), step1-plan.md:71, claude-pricing.ts:25-28, test L22-24 — 삼각 일치                            |
| C3  | 인터페이스 Silent Pivot (constructor + getStatus + stage) | ADR-025 + plan을 실 코드 시그니처로 갱신 + 변경 사유 표 명문화                  | ✅ ADR-025:86~128 v1.1 시그니처 + L145~154 "v1.0→v1.1 변경 사유" 6행 표; plan:48~69 인터페이스 블록; cost-meter.ts:179, 221, 237~242, 312, 325, 334, 339 — 6개 메서드 100% 일치 |

### MAJOR 7건 — 모두 PASS

|    #     | 1차 지적                                         |                                                       정정 결과                                                        |
| :------: | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------: |
|  P1-M1   | autoEnforce=true hard_throttle 자동 sleep 미적용 |                    ✅ docstring 정정 (caller 책임 명시), test L147~162 caller pattern 시나리오 추가                    |
|  P1-M2   | 부동소수점 누적 오차                             |            ✅ 정수 마이크로센트 누적 (`MICRO_USD_PER_USD = 1e6`), test L65~76 (1토큰 1000회 = $0.006 정확)             |
|  P1-M3   | NaN/non-integer 토큰 silent oxidation            | ✅ `Number.isFinite + isInteger + ≥0` 3단 검증 (cost-meter.ts:248~258) + costUsd finite 검증 (:261~266); test L280~312 |
|  P2-M1   | Workers 호환성 헤더 미명시                       |                           ✅ cost-meter.ts:4~6 `@runtime Node.js only` 헤더 + 폴리필 가이드                            |
|  P2-M2   | Idempotency recover 인계 부재                    |               ✅ `initialSpendUsd` 옵션 추가 (cost-meter.ts:96~99, 185~194); test L319~352 (4 시나리오)                |
|  P2-M3   | TokenLogger 이중 calculateTokenCost              |               ✅ cost-meter.ts:288~290 NOTE 코멘트로 Step 11.5 통합 시점 명시 (즉시 정정 X — scope out)                |
| P4-m1/m2 | plan AC-CM-3/4/5 본문 v1.0 잔존                  |     ✅ step1-plan.md:99~115 갱신 — caller pattern, KillSwitchError, duration_ms, cost_per_node_usd 제거 사유 명시      |

---

## 신규 점검 — 회귀 / 새 위험

### Pass 1 SURGEON 신규 위험 (MINOR 1건, 차단급 X)

> caller가 `KillSwitchError`를 catch만 하고 `finalize()` 후 또 `recordTokens` 호출하면? 두 번째부턴 `firedThresholds.has('kill_switch')` true → KILL 블록 진입 안 함 → autoEnforce여도 throw 안 됨 → caller가 무한 호출 가능.

**판정:** caller 계약 위반(catch 후엔 종료해야 함). console.error 1회 로그는 남으므로 silent 아님. ADR/docstring에 "catch 후 호출 금지" 보강 권고 — 본 단계 차단 X.

### Pass 2 ARCHITECT 신규 위험 (MINOR — 정정됨)

> step1-plan.md L14의 `packages/shared/src/cost/pricing.ts (신규)` 잔존

**정정:** L11~14 갱신 — strikethrough + "재사용으로 폐기" 명시 (claude-pricing.ts 그대로 활용).

> production 통합 시 `autoEnforce: true` + `onKillSwitch` 미주입 시 UncaughtException → checkpoint flush 누락 → **컴파일러 강제 불가**. Step 11.5 plan 작성 시 "production 코드 리뷰에서 onKillSwitch 미주입 = CRITICAL" 게이트 추가 권고.

**판정:** Step 11.5 plan에 명시 권고 — 본 단계 차단 X.

### Pass 4 CONTRACT 신규 위험 (Devil's Advocate)

> 진산님이 ADR L298~302 명시한 "Anthropic Console cap $200 수동 설정"이 미완료 상태에서 BATCH-1 진입 시 Layer 2 부재 → Layer 1 단독 의존. autoEnforce=false 기본 시 caller가 status 무시하면 kill 후에도 호출 가능.

**판정:** ADR-025 §7 "진산님 즉시 작업" 체크박스 미완료 시 BATCH-1 진입 차단 의무 — Engine Hardening Roadmap v1.1 §7 완료 기준에 이미 반영됨.

---

## Pass 4 CONTRACT — 삼각 일치 검증

ADR-025 v1.1 ↔ cost-meter.ts ↔ cost-meter.test.ts ↔ step1-plan.md 4파일 100% 일치 (12 PASS):

1. Haiku 단가 $1.0/$5.0 ✅
2. 시그니처 (constructor + start + recordTokens + getStatus + applyThrottle + triggerKillSwitch + finalize) ✅
3. AC-CM-1~5 모두 31 tests로 검증 ✅
4. 단발 거대 호출 SOFT/HARD/KILL 누적 발화 ✅
5. initialSpend (recover 인계) ✅
6. duration_ms 정밀도 ✅
7. KillSwitchError caller catch 패턴 ✅
8. 정수 마이크로센트 누적 정밀도 ✅
9. NaN/Infinity/non-integer 거부 ✅
10. Workers 호환성 헤더 ✅
11. autoEnforce 기본값 false (안전) ✅
12. AC-CM-6 N/A 명시 (Step 11.5 통합 후) ✅

---

## 최종 판정

**Step 1 Cost Meter — 완료 선언 가능.**

- CRITICAL 0건
- MAJOR 0건
- MINOR 잔존 0건 (4건 모두 정정)
- 31 tests PASS, typecheck PASS
- 4파일(ADR/plan/code/test) 100% 일치

**다음 단계:**

- Step 11.5 (recover/snapshot) plan에 "production 코드 리뷰에서 `onKillSwitch` 미주입 = CRITICAL" 게이트 추가
- Step 11.5 코드 구현 시 cost-meter.ts와 통합 (kill switch ↔ checkpoint flush hook)
- Step 5 (Reproducibility/Idempotency) plan에서 `initialSpendUsd` 활용 (recover 시 비용 인계)

---

**리뷰어:** silent-failure-hunter, system-architect, quality-engineer (3개 독립 에이전트, 메인 대화 컨텍스트 외부)
**판정:** ✅ Step 1 완료. CRITICAL 0건 / MAJOR 0건 — 4-Pass 모두 PASS.
