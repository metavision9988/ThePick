# 독립 에이전트 차분 리뷰 — 가-1 Group A 인프라 1차 수정 후 (Pass 2)

**리뷰 방식: 독립 에이전트 2개 병렬 호출 (1차 리뷰 산출물 입력)**

- Agent 1: `security-engineer` (보안·공격면 — C-1/C-2/M-4/M-5 해소 검증 + 신규 발견)
- Agent 2: `pr-review-toolkit:code-reviewer` (Surgeon/Architect/Contract — C-3/M-1/M-2/M-3 해소 검증 + 신규 발견)

작성일: 2026-04-25 KST 14:21
선행 리뷰: `.claude/reviews/review-20260425-110225-step1-5-ga-1-infra-secrets.md` (1차)

---

## 종합 판정

```
🔴 CRITICAL 3건 / 🟠 MAJOR 4건 / 🟡 MINOR 5건
가-1 Group A 진입: 추가 수정 필수
```

1차 리뷰 7건(C-1/C-2/C-3/M-1/M-2/M-3/M-4/M-5) 중 **6건 PASS / 1건 부분 해소** (C-3 — adapter 강제 통합이 README 텍스트만, 코드 강제 없음). 추가로 차분에서 도입된 결함 2건 (race + 회계) Critical.

---

## 1차 리뷰 항목 해소 검증

### ✅ PASS (실증/grep 완료)

| ID  | 1차 발견                    | 해소 증거                                                                         |
| :-- | :-------------------------- | :-------------------------------------------------------------------------------- |
| C-1 | 공백 파일명 단어분할 bypass | Agent 1 `/tmp/sec-test-1` 공백+newline 파일명 모두 차단 (EXIT=1)                  |
| C-2 | key 패턴 누락               | 14종 패턴 등록, 1차 리뷰 명시 5종(named/Cloudflare/PEM/JWT/DB URL) 모두 차단 실증 |
| M-1 | plan 0011 잔존 3곳          | grep 결과 잘못된 0011 0건 (충돌회피 설명 외)                                      |
| M-2 | resetForNewSession public   | `cost-cap.ts` 전체 식별자 0건                                                     |
| M-3 | 모듈 mutable singleton      | class 인스턴스화 + 모든 가변 상태 private field                                   |
| M-4 | rename skip                 | `--diff-filter=ACMR` 명시, `git mv + secret` 차단 실증                            |
| M-5 | pipefail 미설정             | `set -euo pipefail` 명시                                                          |

### ⚠️ 부분 해소

**C-3 cost-cap adapter 강제 통합** — class + guardedCall API 만 추가, **adapter 강제 통합은 README 텍스트만**. CLAUDE.md §하네스 원칙 "부탁이 아닌 강제" 미충족. → NEW-C-1 으로 재진술.

---

## 🔴 NEW CRITICAL 3건 (차분에서 도입/잔존)

### NEW-C-1 [Agent 2 NEW-C-1 / Agent 1 N-5] — adapter 강제 통합 잔여

- 1차 리뷰 C-3 의 두 갈래 중 wrapper API 만 진행, **"smoke 스크립트가 SDK 를 직접 호출 금지" 코드/lint 강제** 미진행
- Agent 1 권고: ESLint `no-restricted-imports` 로 `__manual__/*-smoke.ts` 의 `@anthropic-ai/sdk` 직접 import 차단
- Agent 2 권고: smoke 스크립트 작성 직전에 메커니즘 결정 필요. ESLint 룰 또는 타입 설계로 SDK 직접 호출 컴파일 실패하게.
- **수정 방향**: smoke 스크립트 골격에 `CostCap` 인스턴스 + `guardedCall` 경유 패턴 하드코딩 + ESLint 룰은 Phase 1 후반전 이월

### NEW-C-2 [Agent 1 N-1] — 동시 호출(race) 시 사전 guard 우회

- 파일: `apps/batch/src/__manual__/cost-cap.ts:90-136`
- 실증: `Promise.all([cap.guardedCall(0.06,...), cap.guardedCall(0.06,...)])` (maxUsd=0.1) → 두 fn 모두 실행, 누적 0.12 발생 후 두 번째에서 사후 throw. **첫 fn 의 외부 비용은 이미 발생**.
- 사유: guardedCall 진입이 동기 가산 후 await fn 인 구조라 두 호출이 병렬 진입 시 둘 다 사전 guard 통과
- **수정 방향**: guardedCall 진입을 promise queue 로 직렬화

### NEW-C-3 [Agent 1 N-2] — actualUsd 검증 실패 시 callCount 미증가 → 회계 누락

- 파일: `apps/batch/src/__manual__/cost-cap.ts:117-124`
- 실증: actualUsd NaN/Infinity 시 fn 은 이미 실행됐으나 throw 분기에서 `callCount += 1` 도달 못함 → 다음 호출이 사전 guard 통과 → 무한 루프 가능
- **수정 방향**: try/finally 또는 callCount 를 actualUsd 검증 전에 먼저 증가

---

## 🟠 MAJOR 4건

| ID                        | 발견                                                                                         | Agent   | 해소 시점                                     |
| :------------------------ | :------------------------------------------------------------------------------------------- | :------ | :-------------------------------------------- |
| NEW-M-1 [N-3]             | check-no-secrets.sh 위협 모델 패턴 누락 (Slack webhook URL, npm token, Discord, Telegram 등) | Agent 1 | 부분 즉시 (Slack webhook + npm) / 나머지 이월 |
| NEW-M-2 [N-4]             | `.gitattributes` `binary` 마킹으로 secret 우회                                               | Agent 1 | README 한계 명시 + Phase 1 말 plan            |
| NEW-M-3 [Agent 2 NEW-M-1] | README "CI 자동화 대상 아님" 선언과 `__tests__/cost-cap.test.ts` CI 포함 모순                | Agent 2 | README 즉시 정정                              |
| NEW-M-4 [Agent 2 NEW-M-2] | 사후 throw 시 state 갱신 의도/동작 주석 부재                                                 | Agent 2 | 코드 주석 1줄 보강                            |

## 🟡 MINOR 5건

| ID            | 발견                                                              | 해소 시점    |
| :------------ | :---------------------------------------------------------------- | :----------- |
| NEW-m-1 [N-5] | smoke "SDK 직접 호출 금지" README 텍스트만 (NEW-C-1 본질 동일)    | NEW-C-1 함께 |
| NEW-m-2 [N-6] | binary 파일 매치 시 stderr noise 14줄 (per-pattern grep)          | 다음 터치    |
| NEW-m-3 [N-7] | maxUsd 비현실 작은 값(1e-300) 허용                                | 다음 터치    |
| NEW-m-4       | 1차 m-4 (measurement 90일 자동 만료) 미해소 — 차분 검증 스코프 외 | 별도         |
| NEW-m-5       | binary noise 1차 매치 후 break 가능                               | NEW-m-2 함께 |

---

## 즉시 수정 계획

| #   | 작업                                                                                | 해소         |
| :-- | :---------------------------------------------------------------------------------- | :----------- |
| 1   | `cost-cap.ts` race 직렬화 (promise queue 도입)                                      | NEW-C-2      |
| 2   | `cost-cap.ts` callCount try/finally 또는 검증 순서 재배치                           | NEW-C-3      |
| 3   | `cost-cap.ts` 사후 throw 주석 보강                                                  | NEW-M-4      |
| 4   | `check-no-secrets.sh` npm token + Slack webhook URL 패턴 추가                       | NEW-M-1 부분 |
| 5   | `README.md` CI 모순 정정 (단위 테스트는 CI 포함 명시)                               | NEW-M-3      |
| 6   | `README.md` 한계 §에 `.gitattributes binary` 우회 명시                              | NEW-M-2      |
| 7   | smoke 골격에 `CostCap.guardedCall` 경유 하드코딩 (다음 단계 — claude-smoke 작성 시) | NEW-C-1      |
| 8   | Vitest 추가 테스트: race 직렬화 / actualUsd 검증 후 callCount                       | 검증         |

## 이월 명시 (본 단계 외)

- **NEW-M-1 [N-3] 위협 모델 패턴 추가**: Stripe / Twilio / Sentry / Discord / Telegram — 본 프로젝트 단일 벤더 원칙상 미사용. Phase 1 말 plan 검토
- **NEW-M-2 [N-4] `.gitattributes binary` 우회**: server-side `gitleaks` 도입 시 자동 해소. Phase 1 말 plan
- **ESLint `no-restricted-imports`**: NEW-C-1 본격 강제. Phase 1 후반전 별도 plan
- **NEW-m-2/m-3/m-4/m-5**: 다음 터치 또는 별도

## Devil's Advocate (양 에이전트 종합)

> _"코드 강제 ≠ 문서 부탁. cost-cap 이 모든 가드를 통과해도, smoke 스크립트가 cap 을 경유하지 않으면 cap 은 존재하지 않는 것과 같다."_

NEW-C-1 의 핵심. 본 차분에서 race(NEW-C-2) + 회계(NEW-C-3) 를 해소해도 smoke 스크립트 작성 시 cost-cap 우회 가능하면 무의미. → claude-smoke.ts 첫 줄 작성 시 `CostCap.guardedCall` 경유를 하드코딩하고, ESLint 룰은 Phase 1 후반전.

---

## 서명

- Agent 1 (security-engineer): `agentId: a8efcc1a947a7fb43`, 24 tool uses, 255s
- Agent 2 (pr-review-toolkit:code-reviewer): `agentId: adf77b55dda89ba3f`, 16 tool uses, 132s
- 합계 40 tool uses / ~6.5분 / 독립 컨텍스트 2개
