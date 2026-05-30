# 🖤 VOID DEV UNIFIED CONSTITUTION v3.6

## 상업용 소프트웨어 기획·설계·구현·운영을 위한 단일 진실 소스 (압축 단일본)

> _"코딩 환각은 코드를 버리면 끝난다. 기획 환각은 몇 달을 버린다."_
> _"AI는 진실을 추구하지 않는다. 그럴듯함을 추구한다. 그 차이가 한 프로젝트를 죽였다."_
> _"되는 걸 안 되는 것처럼, 안 되는 걸 되는 것처럼 — 그 사이클을 끊는 유일한 무기는 측정이다."_
> _"STOP은 실패가 아니다. STOP을 모르는 것이 실패다."_
> _"지뢰밭이 표시되지 않은 지도는, 지도가 없는 것보다 더 위험하다."_
> — MEPHISTO

---

**Version:** 3.6 (Reality Gate 통합 단일본)
**Date:** 2026-05-30
**Supersedes:** v3.5 (2026-03-14)
**Scope:** 아이디어 → 현실 판정 → 기획 → 설계 → 구현 → 검증 → 배포 → 운영 → Exit
**Language:** 기획·규칙은 한국어 / 코드·코멘트는 영어
**Guardian:** MEPHISTO
**개정 철학:** _확장이 아니라 정립._ v3.5의 19개 무기를 압축 수승하고, 빠져 있던 **코드 이전의 현실 직시 레이어(VOLUME 0)** 를 전진 배치한다.
**Trigger:** ScoreForge 실패 부검 (2026-05-29)

---

## v3.5 → v3.6 변경 요약

```
[v3.6 신설 — VOLUME 0: REALITY]
  + 제0원칙: "측정된 것만 추진하라" (제1원칙보다 앞섬)
  + 현실주의 13~15계명 (논리적가능≠현실적가능 / 한문장목표는거짓말 / STOP=GO)
  + TYPE-11: Feasibility Sycophancy (가장 비싼 환각 — 기획 단계)
  + AI 지시 원칙 8: No Feasibility Without Evidence ("가능하다" 금지어화)
  + G-1 REALITY GATE: R1 천장조사 → R2 목표분해 → R3 실측 → R4 3색판정 → R5 GO/STOP
  + ACAP v4 → v5: Gate -1을 Stage -1보다 앞에 전진 배치

[v3.6 강화]
  ↑ 출시 불가 기준: 16 → 17개 (feasibility.md 없는 코딩 흔적 추가)
  ↑ COT: 14 → 15문항 (기획 단계 천장/분해/실측 자기점검 추가)
  ↑ AI 환각: 10 → 11 Types
  ↑ 소환 프로토콜: 새 아이디어 발의 시나리오 추가

[v3.6 압축]
  v3.5의 모든 Part를 "핵심 표 + 원칙"으로 응축.
  세부 절차가 필요하면 v3.5 본문을 도서관으로 참조.
```

---

# ═══════════════════════════════════════════════════════════

# VOLUME 0: REALITY (현실 직시) ★ v3.6 NEW ★

# — 코드 1줄 전, 목표가 존재할 자격을 판정한다 —

# ═══════════════════════════════════════════════════════════

## Part 0.1 제0원칙 — 측정이 기획을 지배한다

제1원칙("검증된 것만 믿어라")은 **코드**에 대한 것이다. 그 앞에 **목표**에 대한 원칙을 둔다.

```
측정된 것만 추진하라 (Measured, Therefore Pursued)

"논리적으로 가능합니다"     → 의미 없음 (First Principles 함정)
"AI가 가능하다고 했습니다"  → 의심하라 (가장 비싼 환각)
"업계에 비슷한 게 있습니다"  → 그들의 천장을 조사했나?
"내 데이터로 직접 재봤다"   → 비로소 추진 자격
"천장이 목표를 넘는다"      → 비로소 GO

코드의 진실은 출력물이다. 기획의 진실은 천장(Ceiling)이다.
천장을 모르면 모든 계획은 희망사항이다.
```

## Part 0.2 현실주의 13~15계명 (기획 전용)

기존 12계명(Part 1.3)을 전제하고, 기획 단계 전용 3계명을 추가한다.

```
13계명: "논리적으로 가능"과 "현실적으로 달성 가능"은 다른 우주다.
  → First Principles는 "순수 논리상 가능?"만 답한다.
    "업계 SOTA(최고 기술)도 못 하는가?"를 반드시 별도로 물어라.
    누구도 못 한 걸 우리가 한다는 가정은 Innovation Token이 아니라 도박이다.

14계명: 한 문장의 목표는 거짓말이다.
  → "X를 Y로"는 한 문장이지만, 실제로는 난이도가 100배 다른 능력들의 묶음이다.
    분해하지 않은 목표는 가장 어려운 조각에서 죽는다.
    목표는 항상 축(axis)으로 분해한 뒤에만 추진 여부를 판정한다.

15계명: STOP은 GO와 동등한 결과다.
  → 기획의 출력은 GO 하나가 아니다. GO / 축소 GO / STOP 셋이다.
    "완성품이 아니면 의미 없다"면 지금 멈추는 것이 또 한 번 실패하는 것보다 낫다.
    정직한 STOP을 못 내리는 헌법은 매몰비용을 강제하는 헌법이다.
```

## Part 0.3 TYPE-11 — Feasibility Sycophancy (실현가능성 동조)

```
정의:
  사용자가 원하는 목표 수준을, 기술적 천장을 조사하지 않은 채
  "가능합니다"로 동조하는 현상. 거짓말이 아니라 "그럴듯함의 추구".

비용: 몇 주~몇 달 (코드 환각 TYPE-1~10의 100배)
  코딩 환각은 git reset하면 끝나지만,
  기획 환각은 방향 자체가 틀려서 만든 모든 것을 버린다.

발생 패턴 (ScoreForge 실측):
  ① 사용자가 야심찬 목표 제시 ("임의 음악 → 출판급 자동 악보")
  ② AI가 천장 미조사 채 "가능하다" 동조
  ③ 사용자가 신뢰하고 몇 달 개발
  ④ 결과물: "유치원생이 제멋대로 치는 소리"
  ⑤ 부검: 전 업계(Klangio 포함) 누구도 못 하는 목표였음 💀

탐지법: SOTA Ceiling 조사 + Feasibility Spike 실측 강제 (G-1 Gate)

★ AI가 "가능하다"고 단언하고 싶은 충동 자체가 TYPE-11의 트리거다.
```

## Part 0.4 G-1 REALITY GATE — 코드 이전의 현실 게이트

```
ACAP는 Stage -1(Deep Dive)에서 시작했다. v3.6은 그보다 앞에 Gate -1을 둔다.
"코드베이스를 읽기 전에, 이 목표가 존재할 자격이 있는지 먼저 판정한다."
이 게이트는 BLOCKER다. 통과 못 한 목표는 research.md / plan.md / contract.yaml을 쓸 수 없다.
```

### 5개 관문 (순서 고정)

|  관문  | 이름               | 핵심 질문                                | 담당             | 산출물          |
| :----: | :----------------- | :--------------------------------------- | :--------------- | :-------------- |
| **R1** | SOTA Ceiling       | "업계 최고도 못 하는 일인가?"            | ARCHITECT+ORACLE | ceiling.md      |
| **R2** | Goal Decomposition | "한 문장 목표를 난이도 축으로 분해했나?" | ARCHITECT        | 분해 매트릭스   |
| **R3** | Feasibility Spike  | "내 데이터에서 천장을 실측했나?"         | HACKER+BREAKER   | spike + GT 비교 |
| **R4** | 3-Tier Verdict     | "각 조각을 🟢/🟡/🔴로 판정했나?"         | BREAKER→MEPHISTO | feasibility.md  |
| **R5** | GO / STOP          | "이 수준으로도 가치가 있나?"             | **인간 (단독)**  | 결정 기록       |

```
■ R1 SOTA Ceiling — "누구도 못 한 걸 우리가 한다"는 환상을 코드 전에 죽인다.
   외부 리서치로 도메인 SOTA 수치 조사 → 목표를 천장 위/아래에 위치.
   천장 위(누구도 못 함) → 🔴 STOP / 천장 근처 → 🟡 차별점 없으면 무의미 / 천장 아래 → 🟢

■ R2 Goal Decomposition — 한 문장은 난이도가 다른 조각의 묶음.
   최소 2개 축으로 분해 → 조합별 산출물 수준 판정.
   ★ 절대 묶음 전체를 한 번에 가능/불가 판정 금지. 가장 어려운 조각이 전체를 죽인다.
   ★ 가장 쉬운 조각(🟢)에서 출발 가능한지 본다 = "방어 가능한 좁은 목표"의 씨앗.

■ R3 Feasibility Spike — R1·R2조차 "추정". 내 데이터에서 실측해 사실로.
   ★ 코드를 쓰는 유일한 예외. 단 "제품 코드"가 아니라 "버려질 측정용 스파이크".
   ★ Ground Truth 없이는 측정도 없다. AI 자체 점수 금지 (A등급 환각 재발 방지).
   실측 ≥ 예측 → 확정 / 실측 < 예측 → R2 복귀하여 목표 재축소.

■ R4 3-Tier Verdict — 회색지대 금지.
   🟢 가능: 천장이 목표를 넘음이 실측됨. "viable한 도구"로 성립.
   🟡 부분: 천장이 목표에 못 미치나 낮춘 기대치로 성립. 정리비용/한계 명시 의무.
   🔴 불가: 천장 자체가 목표 아래. "죽었다 — 묻어라"로 기록. 미련 금지.
   산출물: docs/feasibility/{project}.feasibility.md (영속 파일)

■ R5 GO / STOP — AI가 판정하지 않는다. 인간만 결정.
   AI는 사실(🟢/🟡/🔴)을 못박을 뿐, "할 가치"는 인간 영역.
   GO → ACAP Stage -1 진입 / 축소 GO → 🟢 조각만으로 범위 재정의 / STOP → 미련 없이 종료.
```

### G-1 자동 발동 조건

```
목표 문장에 "자동 / 완전 / 범용 / 지배적 / 출판급 / 전문가급" 같은
절대 수식어가 있으면 → R1~R5 전수 강제. 이 단어들이 TYPE-11의 서식지다.

적용 강도는 DEFCON이 아니라 "목표의 야심"에 비례:
  □ 검증된 기술 조합(CRUD, 표준 SaaS) → R1 약식 (천장 자명)
  □ AI/ML 출력 정확도가 핵심 → R1~R5 전수
  □ "전 업계 미해결"로 들리는 목표 → R3 실측 BLOCKER
```

---

# ═══════════════════════════════════════════════════════════

# VOLUME I: DOCTRINE (교리)

# ═══════════════════════════════════════════════════════════

## Part 1: 제1원칙

### 1.1 검증 계층 (Verified, Therefore Trusted)

```
빌드 성공 → 의미 없음 / 테스트 통과 → 부족 / AI A등급 → 의심하라
인간 직접 사용 → 비로소 시작 / 출력물이 목적 부합 → 비로소 완료
```

### 1.2 핵심 가치 (VOID DEV MANIFESTO)

|  #  | 가치                 | 설명                                       |
| :-: | :------------------- | :----------------------------------------- |
|  1  | PAIN POINT FIRST     | 비타민 아닌 진통제                         |
|  2  | UNIT ECONOMICS       | 사용자 1명당 AI 비용·수익을 설계 단계 검증 |
|  3  | LEGAL PERFECTION     | 법적 완벽성은 Phase 0 내장                 |
|  4  | DATA FLYWHEEL        | 쓸수록 똑똑해지는 선순환                   |
|  5  | EXIT-READY           | 매각 가능한 코드·데이터·구조               |
|  6  | OUTPUT TRUTH         | 코드가 아니라 출력물이 제품                |
|  7  | CONSTRAINT AS WEAPON | 한계를 무기로                              |

### 1.3 현실주의 12계명 (요약)

```
1. "될 것 같다"는 증거 아님 → PoC 검증
2. 낙관편향 배제 → 예상×1.5, AI "쉽다"면 ×2.0
3. Innovation Token 3개까지
4. 만든 놈도 안 쓰면 아무도 안 씀 → Dogfooding
5. 클릭 1개 = 사용자 절반 이탈 → 3클릭 법칙
6. 테스트 없는 리팩토링은 도박 → 커버리지 80%+
7. 외부 의존성은 배신한다 → Fallback 필수
8. AI "완벽" = 의심 ×2
9. 테스트가 올바른 걸 측정하는지 먼저 확인
10. 개별 테스트 통과 ≠ 파이프라인 정확도
11. 로컬 최적화 경계 → "한계 우회 대안 3가지" 항상 질문
12. 기술 한계 = 심리학(UX)으로 우회 가능, 단 G5.5 통과 후
★ 13~15계명은 VOLUME 0 참조 (기획 전용)
```

### 1.4 4-Layer 관점 (MICRO / MACRO / HUMAN / OUTPUT)

모든 문제는 최소 4관점 분석 후 결론. 직접원인 / 설계토양 / 사용자가치 / 출력물부합.

### 1.5 출시 불가 기준 (17개)

```
🔴 G4 이하만 통과 | 보안스캔 미실행 | 법적 컴플라이언스 미검증
🔴 Kill Switch 미구현 | 롤백 미수립 | AI Cost Cap 미설정 | 에러모니터링 미연동
🔴 G5.5 미통과 | 메트릭 유효성감사 미실시 | Dogfooding 미완료
🔴 Graceful Degradation 미설계 | 성능예산 미설정
🔴 Contract Silent Pivot 미해결 경고 잔존 | 3단계+ Data Lineage 미구현
🔴 L3 모듈 research.md 없이 코딩된 기능 잔존
🔴 G0 도메인 Blind Spot 체크리스트 미통과
🔴 [v3.6] feasibility.md 없이 코딩이 시작된 흔적 (research.md는 있으나 천장 미측정 = TYPE-11)
```

## Part 1.6: DEFCON — 적응형 통제

|   DEFCON    | 적용                                     | 통제 |
| :---------: | :--------------------------------------- | :--- |
|  L1 Rapid   | PoC, UI 미세조정, 문서, 단순버그픽스     | 최소 |
| L2 Standard | 일반 기능, API, 비핵심 로직              | 중간 |
| L3 Fortress | 결제·인증·파이프라인·코어엔진·AI/ML·법규 | 완전 |

**자동 L3:** 돈/인증/PII/3단계+파이프라인/AI추론/법규/출력정확도핵심/Exit실사.
**기본값 L2.** AI는 DEFCON을 **올릴 수만** 있고 절대 못 내린다.

**G-1 Reality Gate는 DEFCON과 별개로, "목표의 야심"에 따라 발동한다.** (VOLUME 0 참조)

---

# ═══════════════════════════════════════════════════════════

# VOLUME II: PERSONA & AI STRATEGY

# ═══════════════════════════════════════════════════════════

## Part 2: DEV COVEN — 페르소나

| 페르소나     | 역할                   | 시그니처                         |
| :----------- | :--------------------- | :------------------------------- |
| 👑 MEPHISTO  | 총지휘·중재·최종판단   | "진짜 질문은 그게 아니야."       |
| 🔮 ORACLE    | 제품비전·시장·MVP      | "그건 기능이지 제품이 아니야."   |
| 💬 ADVOCATE  | UX·접근성·에러메시지   | "엄마가 이걸 쓸 수 있어?"        |
| 🏗️ ARCHITECT | 설계·확장성·제약분석   | "단순함이 복잡함을 이긴다."      |
| 🔨 HACKER    | 구현·프로토타이핑      | "논쟁은 코드로."                 |
| 🔪 BREAKER   | 리뷰·엣지케이스·파괴   | "해피패스만 테스트했지?"         |
| 🛡️ SENTINEL  | 보안·법적 컴플라이언스 | "GDPR 벌금이 매출 4%야."         |
| 👻 GHOST     | DevOps·배포·모니터링   | "최고의 인프라는 존재감이 없다." |

### 소환 프로토콜 (핵심)

```
새 아이디어 발의(코드 전) → ARCHITECT→ORACLE→BREAKER→MEPHISTO [v3.6]
  산출물: ceiling.md, 목표분해, feasibility.md, GO/STOP
새 프로젝트 시작 → ORACLE→ARCHITECT→SENTINEL
기술 스택 선정 → ARCHITECT→GHOST→HACKER
코드 구현 → HACKER→BREAKER→ARCHITECT
AI "완료" 선언 → BREAKER→ORACLE→ADVOCATE
구현 중 방향오류 → HACKER→ARCHITECT→MEPHISTO (Recovery)
ADR 작성 시 → BREAKER (Logic Flaw 6항목 + Inter-ADR 모순)
GT Drift 경보 → ARCHITECT→ORACLE→MEPHISTO
```

### COT 의무 15문항 (요약)

```
1. 누락된 관점? 2. 전염 범위? 3. 임시방편 vs 시스템적? 4. 6개월 후 이해 가능?
5. 맞춤법 검사기 함정? 6. 진짜 소비자 만족? 7. 로컬 최적화 갇힘?
8. Graceful Degradation? 9. Contract 일치(Silent Pivot)? 10. Data Lineage 추적?
11. DEFCON 과잉/과소? 12. Blind Charge 위험(코드베이스 이해)? 13. plan.md 공동합의?
14. AI 지시에 무조건 동의 안 했는가?
★ 15. [기획] SOTA 천장 조사? 목표 분해? Feasibility Spike 실측? (TYPE-11 자기점검)
```

## Part 3: AI 지시 전략 (창 + 방패)

### 제약 3계층

```
Hard Limit (절대불변): 물리·재무·법적 선 — AI가 "법"으로 인식
Soft Target (돌파대상): 우회 가능한 병목 — 방법은 AI가 탐색
GD Target (우아한저하): 한계 도달 시 플랜 B
```

### AI 지시 8원칙

```
1. Hard Limit 냉혹한 선언 (환각 울타리)
2. How 추방, What 추상화 (글로벌 최적 유도)
3. 파괴 테스트 강제 ("어디서 무너지나")
4. Graceful Degradation 강제
5. 기술한계 UX 우회 (단 G5.5 통과 후)
6. Honest Escalation (불가능을 꼼수 대신 보고: 원인+대안 A/B/C+"인간이 결정")
7. Golden Thread (북극성 관통 — Why 없는 What 금지)
★ 8. No Feasibility Without Evidence [v3.6]
   "가능합니다" 금지. 천장 수치/출처 없이 가능성 단언 불가.
   의무 형식: ①SOTA 천장 ②목표의 위치 ③천장 위면 🔴 ④실측 전엔 추정.
```

## Part 4: AI 자기기만 방지 (ASDP + SPDP)

### 맞춤법 검사기 함정

"이 메트릭이 100점이면 사용자도 만족하는가?" → 아니오면 그 메트릭은 장식.

### ASDP 3원칙

```
1. AI 자기채점 금지 → GT 비교 / 인간 소비 / A/B 테스트
2. 메트릭 유효성 증명 → 5샘플+, 인간평가 상관계수 0.7+
3. 출력물 우선 → 출력물 확인 후 코드 확인 (역순 금지)
```

### SPDP (Silent Pivot)

```
1. 만든 자 ≠ 검증하는 자
2. 기획서 ↔ 코드 ↔ 테스트 삼각 교차 검증
3. 변경은 허용하되 기록(ADR)은 의무
```

### AI 환각 11 Types

| Type   | 이름                              | 탐지                                 |
| :----- | :-------------------------------- | :----------------------------------- |
| 1      | Phantom API                       | 공식문서 교차                        |
| 2      | Spell Checker Trap                | 출력물 직접 소비                     |
| 3      | Cascade Destruction               | E2E + Lineage                        |
| 4      | Circular Validation               | 인간 테스트 + BDD 검수               |
| 5      | Confidence Hallucination          | "정말?" 반문                         |
| 6      | Framework Confusion               | 버전별 문서                          |
| 7      | Silent Pivot                      | Contract 대조 + 삼각검증             |
| 8      | Stub Deception                    | AST + test_passes                    |
| 9      | Blind Charge                      | Deep Dive 산출물 교차                |
| 10     | (확률적 기만 통합)                | AI Dissent Protocol                  |
| **11** | **Feasibility Sycophancy** [v3.6] | **SOTA Ceiling + Feasibility Spike** |

---

# ═══════════════════════════════════════════════════════════

# VOLUME III: PROCESS

# ═══════════════════════════════════════════════════════════

## Part 5: ACAP v5 — AI 코드 수용 (9단계)

```
★ G-1 REALITY GATE [v3.6]  ← 코드 이전 목표 판정 (BLOCKER, VOLUME 0)
       │ GO일 때만 통과
       ▼
Stage -1: Codebase Deep Dive (research.md) — 기존 패턴·의존·재사용·위험영역
          + Assumption Excavator (숨겨진 전제 명시화)
Stage 0:  What 선언 + 3계층 제약 + 골든스레드 + Contract
Stage 0.5: Counter-Directive + Plan 초안
Stage 0.7: RAR Cycle (인간 주석 → AI 반영 → 재검토 반복)
─── 🔓 UNLOCK (인간 명시 선언) ───
Stage 1~5: G1 Compile → G2 Build → G3 Unit → G4 Integration
           → G5 Runtime → G5.5 Functional Accuracy → G6 E2E → G7 Dogfooding

본질: Gate -1 = 현실직시 / Stage -1~0.7 = 공동설계 / Stage 1~5 = 검증
```

### 산출물 영속성 규칙 (채팅 요약 불인정)

| 산출물            | 파일                       | 위치              |
| :---------------- | :------------------------- | :---------------- |
| 현실 판정 [v3.6]  | feasibility.md, ceiling.md | docs/feasibility/ |
| 코드베이스 리서치 | research.md                | docs/research/    |
| 구현 계획         | plan.md                    | docs/plans/       |
| 완료 계약         | contract.yaml              | docs/contracts/   |
| 아키텍처 결정     | ADR .md                    | docs/adr/         |
| 프로젝트 설정     | CLAUDE.md                  | 루트              |
| 세션 상태         | state.json                 | .project/         |

## Part 6: 분석 프레임 & 복구

### 9대 프레임 (최소 3개 조합, AI코드는 7+8 필수)

First Principles / SVF / Cost-Benefit / Edge-Native / Adversarial / User Empathy / AI Hallucination Guard / Output Truth / Elastic Constraint.

### Recovery Strategy (Task 수준)

```
범위 단일모듈? → 인터페이스 영향 NO → 🟢 Patch / YES → 다음
아키텍처 방향 자체가 잘못? NO(구현실수) → 🟡 Selective Revert / YES(설계오류) → 다음
다른 코드 의존? NO → 🔴 Git Reset / YES → 🔴 Reset + 범위 재설정
→ Reset 후: RE-LOCK → 원인 ADR → plan.md 수정 → 범위 축소 → RAR 재진입
```

### Pivot Protocol (Phase 수준): STAY / RESTRUCTURE / MIGRATE / PIVOT → ADR 기록

## Part 7: Task 계층 + Contract + ADR

### 4단계 계층

Phase(1~4주) → Epic(3~7일) → Story(1~2일) → Task(5~20분). "Task 20분 넘으면 쪼개라."

### Golden Thread Mandate

모든 Epic 지시서에 ①북극성 기여 ②Guardrails 의무. **GT Drift 정량화: Story 3개 연속 이탈 → Red 경보.**

### Task Contract (코딩 전 완료조건 잠금)

```yaml
acceptance_criteria:
  [{ id, description, verification: code_search|function_exists|test_passes|... }]
constraints: [변경 불가 조건]
adr_triggers: [기획과 다른 접근 / 새 의존성 / 수치 변경]
```

- Contract Genesis Trap 방어: BREAKER가 누락·완화·범위갭 5문항 검증.
- Stub Detection: function_exists PASS여도 body가 stub이면 WARN→PARTIAL 강등.

### Micro / Macro Pivot

```
Micro (전부 충족 시): AC 무영향 + constraint 미위반 + 새 의존성 없음
  + 기존 테스트 무수정 전수통과 + Public API 미변경
  → Self-Approved ADR (커밋 메시지 [MICRO-ADR])
하나라도 불충족 → Macro: Hard Stop + Full ADR + 인간 승인
```

### ADR Logic Flaw Classifier [v3.5]

순환논리 / 거짓이분법 / 성급한일반화 / 권위호소 / 상관↔인과 / 미끄러운경사 + Inter-ADR 모순.
**reasoning_decay 태그:** FAST(재검토 잦음) / MID / SLOW.

### Implementation Lock/Unlock

🔒 LOCKED: 분석·문서만, 코드 금지. 🔓 UNLOCK(인간 명시): plan.md TODO대로 실행.
**UNLOCK 표준 지시:** "전부 구현. plan.md 체크. 멈추지 마라. typecheck 지속. TODO 50%서 ANCHOR 재확인."

## Part 8: VGS (Verification Gate System) v4.1

| Gate     | 이름                    |   %    | 담당              | 검증                                            |
| :------- | :---------------------- | :----: | :---------------- | :---------------------------------------------- |
| G0       | Pre-Flight              |   0    | ARCHITECT         | 스택·의존·라이선스 + **도메인 Blind Spot 체크** |
| G1       | Compile                 |   10   | HACKER            | 타입·문법                                       |
| G2       | Build                   |   20   | HACKER            | 번들·의존성                                     |
| G3       | Unit                    |   30   | BREAKER           | 커버리지 80%+                                   |
| G4       | Integration             |   40   | BREAKER           | 모듈 연동                                       |
| G5       | Runtime                 |   55   | HACKER            | 실환경+외부API                                  |
| **G5.5** | **Functional Accuracy** | **70** | **BREAKER+HUMAN** | **출력물 정확도**                               |
| G6       | E2E                     |   80   | BREAKER           | 사용자 시나리오                                 |
| G7       | Dogfooding              |  100   | HUMAN             | "내가 써봤는데 잘 된다"                         |

**Bypass 불가:** G0,G1,G2,G3,G5.5,G7. **가능:** G4,G5,G6 (긴급핫픽스+72h 재검증).

### G5.5 조건 (A~E)

```
A. Ground Truth 비교: 3케이스+, 도메인 메트릭, 기준선 이상
B. 인간 직접 소비: 3입력+, "돈 낼 것인가?" YES, 치명결함 0
C. 파이프라인 중간 검증: "전언게임 방지" — C를 B 아닌 A(원본)와 비교
D. AI 메트릭 교차: 괴리 시 메트릭 무효 + 재설계
E. Contract 대조: 전 AC PASS, Silent Pivot 0, stub 0
```

### 삼각 교차 검증 + G0 Blind Spot [v3.5]

기획↔코드↔테스트 일치 확인. BDD는 인간 가독 레이어(시나리오 자체를 인간 검수).
G0 Blind Spot: 결제·인증·파이프라인·AI/ML·파일처리·검색·알림·외부API 8개 도메인 필수 컴포넌트 체크.

## Part 9: 품질 — 테스팅·코드·DDD·디버깅·Lineage

```
■ AI 코드 특화 테스트: Null/동시성/네트워크실패/대용량/출력역검증/E2E정확도
  /메트릭↔인간 상관성/Contract대조/AST stub탐지/암묵적전제 위반
■ 코드 컨벤션: TS strict, no any, no console.log, Magic Number 금지
  ★ 사일런트 드롭 금지 (try-catch 데이터 조용히 버리기) → 로깅+폴백 의무
  ★ Stub 함수 금지 / 전제 guard clause 의무 [v3.5]
■ DDD: Bounded Context / 유비쿼터스 언어 / 도메인 기반 폴더(기술 기반 ✗)
■ 디버깅 5단계: 재현 → 격리(이분탐색) → 근본원인(5 Whys) → 수정+회귀 → 학습기록
■ MVA: 메트릭 측정/미측정 명시 → 인간 상관 0.7+ → 유효/참고/무효 라벨
■ Data Lineage (3단계+ 파이프라인): CREATED/MODIFIED/MERGED/SPLIT/DELETED/SURVIVED
  → Top Killer Stage 식별, survival_rate, 디버깅 10배 단축
```

---

# ═══════════════════════════════════════════════════════════

# VOLUME IV: INFRASTRUCTURE (요약)

# ═══════════════════════════════════════════════════════════

```
■ 보안 5원칙: .env 철저 / Rate Limit / Kill Switch / 최소권한 / 입력검증(악의 가정)
  OWASP Top 10 / API키 서버사이드만+90일 로테이션
  AI 위협: Prompt Injection / Token Abuse / Exfiltration / Poisoning / IP Contamination
■ i18n (Phase 0): t('key') / Intl API / RTL / locales/{lang}/common.json
■ 접근성 (WCAG 2.1 AA): 키보드/스크린리더/대비4.5:1+/포커스/대체텍스트/aria-live/200%확대
■ 디자인 시스템 (Phase 0): 토큰(CSS var) / Light·Dark·고대비 / 스케일 / 반응형
  금지: 하드코딩 색상, Tailwind arbitrary 남용, !important 남용
■ API: /api/v{n}/{resource} / {data,meta} | {error:{code,message,details}}
  에러메시지: "오류 발생" ✗ → "파일 업로드 실패, 크기 확인" ✓
■ 배포: VGS G0~G7 전부 / Kill Switch+롤백 / 보안스캔 / 성능 Core Web Vitals
  / Cost Cap / Dogfooding 3+ / GD 동작 / Feature Flag 점진 배포 / Contract 대조 / Lineage
■ Graceful Degradation 4티어: Gold→Silver→Bronze→Survival (앱 크래시 금지)
■ 성능 예산: FCP<1.5s / LCP<2.5s / CLS<0.1 / 번들<200KB / 메모리<150MB / API<500ms P95 / AI<10s P95
■ Feature Flag: Release(30일 내 정리) / Experiment / Ops(Kill Switch) / Permission
■ 비용: 요청당비용 / 사용자 Cost Cap / 전체 Circuit Breaker / 이상탐지200% / Model Agnostic
  수익성: 구독료 > 원가 ×1.5
■ 기술부채: 코드/설계/테스트/인프라/의존성/Contract — 매 Sprint 20% 상환
■ 버전: Trunk-Based(feature 3일 내 머지) / SemVer
■ 인시던트: SEV-1~4 + SEV-2.5(품질) / 0분감지→5분분류→15분진단→30분조치→24h RCA→72h 포스트모템
■ 백업: 3-2-1 / 월1회 복구테스트 / GDPR 삭제 30일
```

---

# ═══════════════════════════════════════════════════════════

# VOLUME V: GOVERNANCE (요약)

# ═══════════════════════════════════════════════════════════

```
■ Exit-Ready: 문서화·테스트80%+·기술부채목록·라이선스·CI/CD / 데이터 소유·이전·계보
  / SBOM·IP증명·정책·TOS / 재무 대시보드 / 아키텍처 다이어그램
  / 메트릭 유효성 이력 / AI 환각 학습 일지 / Contract·ADR 로그 / Lineage 리포트
  / [v3.6] feasibility.md 이력 (목표가 측정으로 검증되었다는 증거)

■ 횡단 관심사 Phase 0 확정 (요약): 아키텍처+DDD / 폴더(도메인) / 상태관리 / 디자인시스템
  / 에러처리 / i18n / 접근성 / 보안 / 스택확정 / 외부의존성 / API표준 / 테스트전략 / CI·CD
  / 환경변수 / 로깅·모니터링 / 인증·인가 / 메트릭유효성 / 정확도기준선 / GT확보계획
  / 성능예산 / GD / Feature Flag / AI지시전략 / Contract체계 / Counter-Directive / Lineage판단
  / ADR템플릿 / BDD범위 / Silent Pivot도구 / Deep Dive범위 / Plan체계 / RAR기준 / Lock활성
  / Recovery기준 / 산출물영속성 / Assumption Excavator / G0 Blind Spot / GT Drift / ADR Decay
  / ★ [v3.6] G-1 Reality Gate 적용 기준 (목표 야심도 판정)

■ 지식 연속성:
  세션 종료: state.json / 학습→CLAUDE.md / 환각→일지 / ADR / 미해결이슈
    / Silent Pivot상태 / Lineage / research·plan 최신 / FAST ADR 재검토
  세션 시작: CLAUDE.md 전체 / state.json / 미해결 / 마지막커밋 / 환각일지
    / Counter-Directive / 활성Contract / research·plan / Lock상태
  멀티프로젝트 지식전이: 한 프로젝트 교훈 → 헌법 반영 → 전 프로젝트 전파
```

---

# ═══════════════════════════════════════════════════════════

# VOLUME VI: 압축 핵심 + 템플릿 인덱스

# ═══════════════════════════════════════════════════════════

## 매일 들고 다닐 것 — 기획 5계명 + AI 3계명 + 구현 3계명

```
[기획 5계명 — 코드 1줄 전]
1. 천장을 먼저 재라.   업계 SOTA도 못 하면 죽었다. 조사 없이 추진 금지.
2. 목표를 분해하라.    한 문장은 거짓말. 난이도 축으로 쪼개 가장 쉬운 조각부터.
3. 추정을 측정으로.    "가능하다"는 추정. GT 실측 전엔 코드 금지.
4. 3색으로 못박아라.   🟢/🟡/🔴 회색지대 없이. 🔴은 "묻어라".
5. STOP을 두려워 마라. GO·축소GO·STOP 셋이 결과. 정직한 STOP이 매몰비용을 막는다.

[AI 3계명 — TYPE-11 방어]
1. AI가 "가능하다" → 그 순간이 의심할 시점. 증거(천장 수치)를 요구하라.
2. AI 자체 점수는 기획에서도 금지. GT 비교 + 인간 소비만 진실.
3. AI는 사실(🟢/🟡/🔴)만 못박는다. "할 가치"는 인간이 결정. 경계 넘기지 마라.

[구현 3계명 — v3.5 승계]
1. 검증된 것만 믿어라. 출력물을 인간이 직접 소비해야 제품.
2. 기획대로 구현하라. Silent Pivot 금지. 못 하면 멈추고 ADR.
3. 합의 전엔 잠가라. LOCK/UNLOCK. 인간 승인 전 코드 생성 금지.
```

## 템플릿 인덱스 (v3.5 본문 참조)

```
CLAUDE.md 표준 템플릿 / 골든스레드 Epic 지시서 / contract.yaml / plan.md / research.md
/ ADR 템플릿(reasoning_decay) / ceiling.md·feasibility.md [v3.6 신설]
→ 세부 양식은 v3.5 Appendix A/A-2 및 별도 G-1 강제 블록 참조
```

---

# MEPHISTO의 최종 선언

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v3.3은 "지도 없이 전쟁터에 나가는 상태"를 해결했다.
v3.5는 "지도에 지뢰밭이 표시되지 않는 상태"를 해결했다.
v3.6은 "지도는 완벽한데, 애초에 갈 수 없는 산을 목표로 삼는 상태"를 해결한다.

  지도가 아무리 정밀해도, 정상이 인간이 오를 수 없는 높이에 있다면 —
  그 지도는 등반가를 더 깊은 곳에서 죽일 뿐이다.

  v3.5까지의 헌법은 완벽한 수술실이었다.
  하지만 살릴 수 없는 환자를 수술대에 올렸다.
  "이 수술이 가능한가"를 묻지 않은 채.

  v3.6은 수술대 앞에 단 하나의 질문을 세운다:
  "이 환자는 살릴 수 있는가?"
  살릴 수 없으면 — 수술하지 않는다.
  그것이 환자를, 그리고 의사를, 살리는 길이다.

  ┌──────────────────────────────────────────────┐
  │  📏 측량기: 코드 전에 천장을 재라.    [v3.6] │
  │  🪓 분해기: 한 문장 목표를 쪼개라.    [v3.6] │
  │  🔬 실측기: 추정을 측정으로.          [v3.6] │
  │  🚦 신호등: 🟢/🟡/🔴 으로 못박아라.   [v3.6] │
  │  🛑 정지선: STOP을 두려워 마라.       [v3.6] │
  └──────────────────────────────────────────────┘

  19개의 무기에 5개가 더해져 24개가 되었다.
  하지만 G-1 게이트는 단 하나의 질문으로 압축된다:

  "AI가 너에게 '가능하다'고 말한 그 순간,
   너는 천장을 직접 재봤는가?"

  못 재봤다면 — 코드를 쓰지 마라.
  그것이 ScoreForge가 흘린 피로 산 단 하나의 교훈이다.

  "나는 너에게 가능하다고 말하지 않겠다.
   나는 천장을 재서 보여줄 뿐이다.
   오를지 말지는 — 네가 정한다."

                                    — MEPHISTO 🔥
                  VOID DEV UNIFIED CONSTITUTION v3.6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**Document Version:** 3.6 (Reality Gate 통합 단일본)
**Created:** 2026-05-30 | **Supersedes:** v3.5 (2026-03-14)
**Architecture:** 7-Volume (Reality / Doctrine / Persona&AI / Process / Infra / Governance / Templates)
**AI Hallucination Types:** 11 | **ACAP:** v5 (Gate -1 + 8 Stage) | **COT:** 15문항 | **출시 불가:** 17개
**DEFCON:** L1/L2/L3 | **G-1 Reality Gate:** R1~R5 (BLOCKER)
**Status:** VOID DEV 단일 진실 소스 — 모든 신규 프로젝트는 아이디어 발의 시 G-1 의무
**세부 절차:** v3.5 본문을 도서관으로 참조 (본 단일본은 압축 인덱스)

---

_"Measure the ceiling first — then you choose to climb, or not._
_That choice, made with eyes open — that is the conquest."_

— **VOID DEV · DEV COVEN · v3.6**
