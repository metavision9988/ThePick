# 5-페르소나 제 3자 체크 — 통합 보고서

**작성일:** 2026-04-28 (KST)
**상위 보고서:** `.claude/reports/engine-hardening-midpoint-20260428.md` (Engine Hardening 중간 점검 v1.0)
**페르소나 5건:** `.claude/reviews/midpoint-20260428-{refactoring,performance,quality,backend,devops}.md`
**검증:** 본 통합 보고서는 메인 컨텍스트가 작성. 5개 에이전트 산출물의 **진위 검증 2건** (R-C1 / Q-C1) 포함.

---

## 0. 한 줄 결론

> **5명 모두 "partial proceed"** — Step 11.6 코드 진입 자체는 결함급 차단 없으나, **CRITICAL 14건 중 6건은 코드 진입 전 의무 정정 (총 2.2~3d). 권고 진행 순서가 ROADMAP v1.1 의 핸드오프 우선순위 (A→B→C) 에서 (E→B→A) 로 자동 재정렬됨.**

---

## 1. 페르소나별 판정 일람

| 페르소나             | 판정            | CRITICAL | MAJOR  | 가용 시간 추정 |
| :------------------- | :-------------- | :------: | :----: | :------------- |
| refactoring-expert   | partial proceed |    1     |   4    | 0.45d          |
| performance-engineer | proceed         |    3     |   4    | 30분 prereq    |
| quality-engineer     | partial proceed |    3     |   7    | 0.5d           |
| backend-architect    | partial proceed |    3     |   4    | 0.5~1.5d       |
| devops-architect     | partial proceed |    4     |   5    | 동시/직전      |
| **합계**             | —               |  **14**  | **24** | **~3d**        |

CRITICAL 14건 중복 0건 (각 페르소나 영역 침범 차단 효과 확인).

---

## 2. CRITICAL 14건 통합 매트릭스

### 2.1 코드 진입 절대 차단급 (즉시 정정 의무) — 6건

|    #     | 페르소나    | 항목                                                                                                                              |                                   진위                                   |    작업    |
| :------: | :---------- | :-------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------: | :--------: |
| **R-C1** | refactoring | `cost-meter.ts` 에 `getInitialSpendUsd / getCallCount / getThresholdBreaches` 미존재 → plan §4.3.4 `extractCostState` 컴파일 에러 |       ✅ 검증 (grep `class CostMeter` 메서드 일람 — 위 3개 미존재)       |    0.1d    |
| **Q-C1** | quality     | `assertCanonicalSafe` (checkpoint.ts:192-222) circular ref 무한 재귀 + Symbol/TypedArray/Promise/WeakMap 분기 부재                |              ✅ 검증 (코드 직접 확인 — visited set 미사용)               |    0.3d    |
| **B-C1** | backend     | Step 5 plan UNIQUE 가정 컬럼 (`batch_run_id`, `source_id`) 가 `knowledge_nodes` 에 부재 + 0014 트리거가 backfill UPDATE 차단      |         ✅ 검증 (Step 5 plan §위험분석 + 0014 화이트리스트 부재)         |     1d     |
| **B-C2** | backend     | `BatchRunsDb` 시그니처 첫 인자 `examId` 부재 → Hard Rule 16 위반 (production-quality.md "신규 코드 예외 금지" 에 정합)            | ✅ 검증 (recover.ts:57-70 + production-quality.md Year 1 한시 예외 본문) |    0.5d    |
| **B-C3** | backend     | 0015 `trg_batch_runs_recover_only_from_terminal` WHEN 조건이 stale 24h 이상 'in_progress' 상태에서 recover 차단                   |                ✅ 검증 (0015:63-68 + recover.ts:131-149)                 |    0.3d    |
| **D-C1** | devops      | Anthropic Console monthly cap **미확인** (ADR-025 §7) — Layer 1 단독 의존 결함                                                    |                              ✅ 알려진 항목                              | 진산님 5분 |

### 2.2 Step 11.6 코드 진입 동시/직전 처리 (병행) — 5건

|  #   | 페르소나    | 항목                                                                               |              작업              |
| :--: | :---------- | :--------------------------------------------------------------------------------- | :----------------------------: |
| P-C1 | performance | `processBatch.usage` 반환 가정 미검증 → CostMeter 무력화 시 BATCH-3 단발 폭주 위험 | 0.1d (`@thepick/parser` 확인)  |
| P-C2 | performance | WSL2 환경 fsync 실측 부재 → NAS/SMB 환경 시 BATCH 당 +10s                          |      0.1d (벤치마크 1건)       |
| D-C2 | devops      | SIGINT handler 의 `mkdirSync/openSync` 실패 시 좀비 + 데이터 손실                  |     0.1d (try/catch 강화)      |
| D-C3 | devops      | recover 6 RecoveryStatus 메시지에 다음 행동 위치 (runbook 경로) 부재               |   0.5d (`docs/runbook/` 5건)   |
| D-C4 | devops      | `D1BatchRunsDb.updateState` 트리거 ABORT 후 catch 패턴 무한 ABORT 루프 위험        | 0.2d (state machine 사전 검증) |

### 2.3 다음 단계 (Step 7 / Step 5 e2e) 로 이연 — 3건

|  #   | 페르소나    | 항목                                                                                       |       처리 시점        |
| :--: | :---------- | :----------------------------------------------------------------------------------------- | :--------------------: |
| Q-C2 | quality     | AC-R3 단일 process 시뮬레이션 거짓 → fork(child_process)/Worker thread 진짜 race 검증 필요 |       Step 5 e2e       |
| Q-C3 | quality     | `build_correctness 0.999` 회귀 자동화 0건 (1000회 반복 통계 검증)                          | Step 7 contract verify |
| P-C3 | performance | `applyThrottle` caller `max_throttle_count` 책임 명시 부재                                 |     plan v1.1 정정     |

---

## 3. 권고 진행 순서 (재정렬)

### 3.1 핸드오프 session-013 의 우선순위 (변경 전)

```
A (Step 11.6 plan 작성, 0.5d) ─→ B (Step 5 plan 갱신, 0.3d) ─→ C (ROADMAP v1.2, 0.2d)
                                  ─→ D~G (Step 2~5 코드, 5d) ─→ Step 11.6 코드 (2.6d)
```

### 3.2 5-페르소나 통합 후 권고 (변경 후)

```
[즉시] D-C1 진산님 Anthropic cap 5분
       ↓
[0.5d] CRITICAL 코드 정정 묶음:
       - R-C1: cost-meter 메서드 3개 추가
       - Q-C1: assertCanonicalSafe visited set + Symbol/TypedArray/Promise 거부
       - B-C3: 0015 트리거 WHEN 보정
       ↓
[1.5d] B-C1+B-C2 = Step 5 plan 갱신 + 0016 마이그레이션 + BatchRunsDb examId 시그니처 보강
       (= 핸드오프 우선순위 B 가 사실상 차단 의무로 격상)
       ↓
[0.2d] ROADMAP v1.1 → v1.2 패치 (Step 11.6 의존성 그래프 + 시간 추정 + 본 5-페르소나 결과 반영)
       (= 핸드오프 우선순위 C)
       ↓
[2.6~3d] Step 11.6 코드 구현 (P-C1/C2/D-C2/C3/C4 동시 처리)
       ↓
[1d] Step 11.6 4-Pass 독립 에이전트 리뷰 + 정정
       ↓
[병렬 진입 가능] Step 2~4 Property test 코드 (각 1~1.5d)
```

**총 ROADMAP v1.1 → v1.2 영향:** 현실 11d → 13~14d (+18%). 비관 15d 안전 범위 내.

### 3.3 핵심 변화

| 항목                 | 변경 전 (핸드오프) | 변경 후 (5-페르소나) | 근거                                          |
| :------------------- | :----------------- | :------------------- | :-------------------------------------------- |
| 진산님 Anthropic cap | 우선순위 E (선택)  | **즉시 의무**        | D-C1 (devops) — Layer 1 단독 의존 결함        |
| Step 5 plan 갱신     | 우선순위 B (선택)  | **차단 의무**        | B-C1 (backend) — 컬럼 부재 + 0014 트리거 충돌 |
| BatchRunsDb examId   | 명시 안 됨         | **차단 의무**        | B-C2 (backend) — Hard Rule 16 위반            |
| Step 11.6 코드 진입  | 우선순위 A (즉시)  | **2.2~3d 후**        | R-C1 + Q-C1 + B-C1/C2/C3 정정 후              |
| ROADMAP v1.2 패치    | 우선순위 C (선택)  | **차단 의무**        | 시간 추정 +18%, 진산님 일정 인지 필수         |

---

## 4. Devil's Advocate 5건 종합

각 페르소나의 Devil's Advocate 시나리오 통합:

1. **refactoring**: `assertCanonicalSafe` 가 WeakMap/Symbol/Promise/circular 미검사 — Q-C1 과 정합 (이미 CRITICAL)
2. **performance**: Phase 2 study-material-generator 의 LLM 프롬프트 직렬화 비용 (현 단계 무관)
3. **quality**: "노드 개수 동일 = recover 성공" 거짓 PASS — graph isomorphism 검증 부재. **Step 4 quality determinism + Step 5 reproducibility + Step 11.6 e2e 가 함께 PASS 해야 진정한 e2e** (가장 무거운 시나리오)
4. **backend**: Year 2 공인중개사 첫 BATCH 시 examId 인자 없는 BatchRunsDb 가 Year 1 row 와 UUID collision (B-C2 와 정합)
5. **devops**: Anthropic API key 유출 → Layer 1 무력화 → Layer 2 cap 발동 (D-C1 즉시 처리 시 부분 완화)

**가장 위험한 시나리오 (quality):** AC-R1 의 "정확 재개" 정의가 노드 cardinality 만 검증하면 SUPERSEDES 엣지 차이를 놓침 → 학습자료 출력 차이 → 수험자 정답 불일치. **Step 11.6 의 AC-R1 정의를 v1.1 정정 시 graph isomorphism + state_hash 일치 + invariant_fields 100% 3중 검증으로 강화 필요.**

---

## 5. 진산님 결정 요청

### 5.1 즉시 응답 (5분)

- **D-C1 처리:** Anthropic Console → Billing → Monthly cap = $200 + Alerts 50%/80%/100% 설정 + 스크린샷 → `docs/exit-strategy/anthropic-cap-2026-04.png`. 본 작업이 BATCH-1 진입 차단 항목 (ADR-025 §7).

  **응답 후보:**
  - **"설정 완료"** — 다음 단계 진입 가능
  - **"조금 후 설정"** — 본 통합 보고서 후 진산님 작업 / Claude는 그 동안 정정 작업 진행
  - **"$200 → $X"** — cap 금액 조정 요청 시 ADR-025 v1.1 정정

### 5.2 진행 순서 승인

본 통합 보고서 §3.2 의 **재정렬 순서 (D-C1 → CRITICAL 정정 → Step 5 plan + 0016 → ROADMAP v1.2 → Step 11.6 코드 → Step 2~4 병렬)** 승인 여부.

- **"승인 — 위 순서 그대로"** — Claude 자율 진행 (D-C1 외)
- **"조정 — X 먼저"** — 진산님 우선순위 재지정
- **"중단 — 더 검토 필요"** — 5-페르소나 산출물 5건 직접 읽기 권고

### 5.3 ROADMAP v1.1 → v1.2 영향 인지

- 현실 추정 11d → **13~14d (+18%)**
- 비관 추정 15d 안전 범위 내
- 메모리 `feedback_focus_reliability_not_schedule` 정합 — 일정 보고가 아니라 신뢰성 차원 자체 점검

---

## 6. 후속 작업 (5-페르소나 결과 반영)

본 통합 보고서를 v1.0 으로 종결. 다음 갱신 트리거:

- 진산님 §5 응답 시 → CRITICAL 정정 작업 진입 + 본 보고서 v1.1 (정정 결과 반영)
- 정정 작업 완료 시 → Step 11.6 plan v1.1 (CRITICAL 14건 반영) + ROADMAP v1.2
- Step 11.6 코드 구현 완료 시 → 4-Pass 리뷰 + 본 보고서 v2.0 (사후 검증)

---

**보고서 작성 시각:** 2026-04-28 (KST)
**작성자:** Claude (Opus 4.7) — 메인 컨텍스트 (5-페르소나 5건의 외부 산출물 통합)
**진위 검증:** R-C1 (✅ 코드 grep) + Q-C1 (✅ 코드 직접 확인)
**아카이브:** Engine Hardening 완료 시 `docs/reports/archive/2026MMDD-5-persona-synthesis.md`
