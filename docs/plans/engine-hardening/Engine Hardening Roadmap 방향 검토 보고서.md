# 🔍 Engine Hardening Roadmap 방향 검토 보고서

## ThePick BATCH-1 진입 전 엔진 보강 로드맵 v1.0 Draft 평가

> _"방향이 맞는지를 묻는 것은 가장 좋은 질문이다._  
> _틀린 방향으로 빠르게 가는 것이 가장 비싼 실패다."_  
> — MEPHISTO

---

**Document Type:** Roadmap Direction Review  
**Date:** 2026-04-27  
**Subject:** Engine Hardening Roadmap v1.0 Draft  
**Reviewer:** DEV COVEN 7인 + MEPHISTO  
**Verdict:** **★★★★★ 방향 정확. 5개 보완점만 반영 후 즉시 진행 권고**

---

## 📑 목차

| Part | 내용                          |
| :--- | :---------------------------- |
| 1    | 한 줄 결론                    |
| 2    | 방향성 평가 — 5대 차원        |
| 3    | 페르소나별 평가 매트릭스      |
| 4    | 강점 7개                      |
| 5    | 보완점 5개 (즉시 반영 권고)   |
| 6    | 거부된 우려 3개 (반론과 함께) |
| 7    | v1.1 권고 패치                |
| 8    | 최종 판정                     |

---

# Part 1: 한 줄 결론

```
방향은 정확하다. 진산님의 직관 ("엔진부터 제대로 되야 학습자료 배치도 잘 되는 거 아닌가?")
는 v3.0 헌법 Vol XIV.4 (build_correctness 99.9%) + Vol XV.3 (Property Test 의무) +
Engine-First Doctrine 모두에 정확히 부합한다.

5개 보완점만 v1.1로 반영하면 즉시 진행 가능. 1주 지연은 합당한 투자.
```

---

# Part 2: 방향성 평가 — 5대 차원

## 2.1 핵심 5대 평가 차원

| 차원                     | 평가  | 근거                                                         |
| :----------------------- | :---: | :----------------------------------------------------------- |
| **헌법 정합성**          | ★★★★★ | v3.0 Vol XIV/XV/XVI/XVII 4개 도메인 정확 매핑                |
| **Reality Anchor**       | ★★★★★ | 진산님 직관 + ThePick 실제 구조 100% 반영                    |
| **비가역성 인지**        | ★★★★★ | "BATCH 적재 = 영구 저장" — 정확. Temporal Graph 한계도 인정  |
| **DEFCON 적용**          | ★★★★  | L3 자동 트리거 정확. 단 BATCH 자체의 L3 근거 한 줄 추가 권고 |
| **First Heartbeat 균형** | ★★★★  | 1주 지연은 paralysis 아님. 단 "1주 내외" 추정의 근거 약함    |

## 2.2 종합

```
5개 차원 중 4개 만점 + 1개 보완.
이는 ThePick 갭 분석 보고서가 v3.0 헌법 작성에 기여한 깊이를 그대로 반영한다.
헌법 자체와 같은 사람의 손에서 나왔기에 정합성이 높다.
```

---

# Part 3: 페르소나별 평가 매트릭스

| 평가 영역             | ORACLE | ADVOCATE | ARCHITECT | HACKER | BREAKER | SENTINEL | GHOST |  종합  |
| :-------------------- | :----: | :------: | :-------: | :----: | :-----: | :------: | :---: | :----: |
| 핵심 결정 (Section 0) |   ✅   |    ✅    |    ✅     |   ✅   |   ✅    |    ✅    |  ✅   | **A+** |
| 비가역성 분석 (1.1)   |   ✅   |    ✅    |    ✅     |   ✅   |   ✅    |    ✅    |  ✅   | **A+** |
| 헌법 명령 매핑 (1.2)  |   ✅   |    ✅    |    ✅     |   ✅   |   ✅    |    ✅    |  ✅   | **A+** |
| 차단 대상 (2.1)       |   ✅   |    ✅    |    ✅     |   ✅   |   🟡    |    ✅    |  ✅   | **A**  |
| 이연 항목 (2.3)       |   ✅   |    ✅    |    ✅     |   🟡   |   ✅    |    ⚠️    |  ✅   | **A-** |
| 의존성 그래프 (3)     |   🟡   |    ✅    |    ✅     |   ✅   |   ✅    |    ✅    |  ✅   | **A**  |
| 단계별 산출물 (4)     |   ✅   |    ✅    |    ✅     |   ✅   |   ✅    |    ✅    |  🟡   | **A**  |
| Build SLO (5)         |   ✅   |    ✅    |    ✅     |   ✅   |   🟡    |    ✅    |  ✅   | **A**  |
| 위험·트레이드오프 (6) |   ✅   |    ✅    |    ✅     |   ✅   |   🟡    |    ✅    |  ✅   | **A**  |
| 완료 기준 (7)         |   ✅   |    ✅    |    ✅     |   ✅   |   ✅    |    ✅    |  ✅   | **A+** |
| 승인 체크포인트 (8)   |   ✅   |    ✅    |    ✅     |   ✅   |   ✅    |    ✅    |  ✅   | **A+** |

**총평: A+ 평균** — 보완점 5개는 모두 🟡/⚠️ 표시 영역에 집중

---

# Part 4: 강점 7개

## 4.1 [강점 1] Engine-First Doctrine 정확한 인용

```
🏗️ ARCHITECT:
  "이전 권고가 Engine-First Doctrine을 위배했다는 것을
   명시적으로 인정하고 폐기한 것이 핵심이다.
   '병행' → '순차' 결정은 v3.0 Vol XV.3 의무 5요소 #1
   (Property Test = 가장 중요)에 정확히 부합한다."
```

## 4.2 [강점 2] 비가역성 비용 매트릭스

Section 1.1의 "발견 시점별 비용" 표는 v3.0 Vol XIV.5 Silent Drift 안티패턴의 가장 좋은 적용 사례:

| 발견 시점       | 비용                         |
| :-------------- | :--------------------------- |
| BATCH-1 직후    | 인간 검수 재실행             |
| BATCH-3 누적 후 | × 노드 수 + CBIV 회귀        |
| Phase 2 후      | + 콘텐츠 폐기 + 재생성       |
| Phase 3 후      | + user_progress 마이그레이션 |

→ **기하급수 비용 증가**를 시점별로 명시한 것이 ORACLE 만점.

## 4.3 [강점 3] Temporal Graph 한계 인정

```
🛡️ SENTINEL:
  "'Temporal Graph (UPDATE 금지 + INSERT + SUPERSEDES)가
   일부 보호하지만 비용은 시점이 늦을수록 기하급수' —
   이 한 줄이 핵심이다.

   Temporal Graph를 만능으로 보지 않고 한계를 인정한 것이
   Phase 4 운영 데이터까지 보호하는 결정으로 이어졌다."
```

## 4.4 [강점 4] 도메인 프로파일 복합 적용

`apps/batch`를 **XIV (Batch/Build) + XVII (Single-Vendor)** 복합 매핑한 것이 v3.0 헌법의 정확한 적용:

```
v3.0 부록 D 결정 트리에서 명시:
  "단일 벤더 lock-in이면 → Volume XVII 추가 적용 (모든 분기에 중첩 가능)"

→ 로드맵이 정확히 따랐다.
```

## 4.5 [강점 5] 이연 항목의 명확한 트리거

| 항목              | 트리거                                      |
| :---------------- | :------------------------------------------ |
| ai-adapter 실구현 | Phase 3 Vision OCR 진입 전                  |
| Lifecycle 5종     | Phase 2 첫 사용자 1주 전                    |
| OTel SDK          | Phase 2 출시 1주 전                         |
| AIEC 코드         | 결제 mock → 실결제 전환 시 (ADR-024 트리거) |
| Tier 5 Chaos      | Phase 2 베타 100명 시점                     |

→ "이연 = 영구 면제 ❌" 원칙을 트리거로 강제. **Vol XVI Solo-Builder의 위험 경고 정확 반영**.

## 4.6 [강점 6] 진산님 승인 체크포인트 최소화

Section 8: 3개 결정만 명시 승인 필요. 나머지는 자율.

```
👻 GHOST:
  "이것은 v3.3 헌법의 RAR Cycle + Implementation Lock/Unlock과 정합한다.
   인간의 의사결정 대역폭을 진짜 중요한 3개에 집중시키고,
   나머지는 헌법 + 메모리로 자율 진행 — 운영 효율 극대화."
```

## 4.7 [강점 7] Build SLO Tier 정확 적용

```yaml
slo:
  tier: 'Build'
  build_time_max_minutes: 60
  build_cost_max_usd: 10
  build_correctness: 0.999
  build_reproducibility: 1.0
  retry_on_failure: 1
```

→ v3.0 Vol XIV.4 템플릿과 100% 일치. 추정 수치(60분, $10)도 합리적 범위.

---

# Part 5: 보완점 5개 (즉시 반영 권고)

## 5.1 [보완 1] 🔨 BREAKER — `quality` 엔진 DEFCON L3 권고

### 현재

```
| `packages/quality` | XV Library | L2 | ✅ | ... |
```

### 문제

```
🔨 BREAKER:
  "quality 패키지는 CBIV (Continuous Bidirectional Integrity Verification) 담당.
   v3.0 Vol I.3 자동 L3 트리거 중 두 가지에 해당:
   ① '데이터 파이프라인 (3단계+)' — CBIV는 6단계
   ② 'Stateful Meta Engine'이 의존하는 검증자

   L2로 분류하면 Property Test 의무가 ⚠️ (선택)이 되어
   결정성 보장이 약해진다.
   L3로 격상하면 ✅ (의무)로 강제됨."
```

### 권고

```
| `packages/quality` | XV Library | **L3** | ✅ | ... |
```

→ **차이는 한 글자(L2 → L3)지만, Property Test 강제력이 달라진다.**

---

## 5.2 [보완 2] 🔨 BREAKER — 1주 추정의 근거 부재

### 현재

> "문서 단계(Step 0~10) ≈ 2~3일. 코드 구현(Step 11~17) ≈ 3~4일. 총 1주 내외."

### 문제

```
🔨 BREAKER:
  "v3.0 헌법 현실주의 12계명 #2:
   '예상 소요 시간 × 1.5. AI가 쉽다고 하면 × 2.0.'

   1주 추정의 근거가 없다. ADR 3건 + LLM_CONTAINMENT.md +
   research.md × 3 + contract.yaml × 3 + plan × 5 + 코드 × 6 +
   리뷰 × 2 = 20개 산출물.

   각 산출물이 평균 30분이라 가정해도 10시간.
   실제로는 ADR 1건 = 2~3시간, contract.yaml 1건 = 2시간,
   Property test 1건 = 4~6시간 (학습 곡선 포함).

   현실적 추정: 7~10일 (1.5 calibration 적용 시 10~14일)."
```

### 권고

Section 3에 다음 추가:

```
- 낙관 추정: 5~7일
- 현실 추정: 7~10일 (현실주의 12계명 #2 적용)
- 비관 추정: 10~14일 (학습 곡선 + 디버깅 포함)
- 의사결정 기준: 10일 초과 시 진산님 보고 + 우선순위 재조정
```

---

## 5.3 [보완 3] 🛡️ SENTINEL — 결제 mock의 현재 위험

### 현재

> "이연: AIEC 코드 구현 → 결제 mock → 실결제 전환 시 (ADR-024 트리거)"

### 문제

```
🛡️ SENTINEL:
  "결제 mock이 '이미 Phase 1 Step 1-2에 구현됨'이라고 했다.
   Mock은 안전하지만, mock과 실결제 전환 사이에
   AIEC 도입을 위한 시간이 충분한지가 불명확하다.

   v3.0 Vol XVI 위험 경고:
   '결제 가까이서 즉시 활성화'

   ADR-024는 트리거를 명시하지만, 트리거 발동 시점에서의
   '준비 시간'이 부족하면 위험.

   권고: ADR-024에 '트리거 발동 N일 전 준비 시작' 명시.
   예: '실결제 전환 14일 전부터 AIEC 구현 시작'"
```

### 권고

Step 3 (ADR-024) 명세에 추가:

```
ADR-024 추가 명시:
  - Pre-trigger Window: 실결제 전환 14일 전 AIEC 구현 시작
  - Day -14: HMAC 키 발급 + nonce store (KV) 구축
  - Day -7: capability 매트릭스 정의 + 통합 테스트
  - Day -3: Tier 3 (Contract test) + Tier 5 (Tampering Chaos) 통과
  - Day 0: 실결제 활성화 + AIEC 활성화 동시
```

---

## 5.4 [보완 4] 🟡 ORACLE — Step 17 독립 리뷰 비용 추정

### 현재

> "4-Pass 독립 에이전트 리뷰 + 5-페르소나 기술부채 리뷰"

### 문제

```
🔮 ORACLE:
  "9개 리뷰 (4 + 5)를 한 번에 돌리면 Cost SLI 폭발 가능.
   Roadmap이 Cost meter (Step 11)를 강조하면서
   그 비용을 측정하는 리뷰 단계의 비용은 추정 안 함.

   각 리뷰 = Claude Code Opus 호출 1~3회 = 약 $0.5~$2
   9개 리뷰 = $5~$18 (단발성)

   괜찮은 비용이지만, BATCH-1 적재 비용 ≤ $10 SLO와 비교하면
   '리뷰 비용 = 적재 비용의 50~180%'. 명시 필요."
```

### 권고

Section 5에 추가:

```yaml
review_cost_estimate:
  per_review_usd: 0.5 ~ 2.0
  total_reviews: 9 # 4-Pass + 5-Persona
  estimated_total_usd: 5 ~ 18
  note: 'BATCH-1 비용 ($10)의 50~180%. 1회성이므로 수용.'

review_failure_loop_cap: 3 # 리뷰 실패 → 수정 → 재리뷰 무한 루프 방지
```

---

## 5.5 [보완 5] 💻 HACKER — Step 16 검증 스크립트가 "선택"인 이유

### 현재

> "Step 16: contract.yaml 검증 스크립트 (선택)"

### 문제

```
💻 HACKER:
  "contract.yaml의 acceptance_criteria를 자동 검증하지 않으면,
   v3.0 Vol IV.5 Silent Pivot 탐지가 인간의 눈에만 의존한다.

   '선택'이 아니라 '의무'여야 한다.
   특히 Step 17 독립 리뷰 전에 자동 검증 PASS가 전제되어야
   리뷰가 의미 있다."
```

### 권고

```
Step 16: contract.yaml 검증 스크립트 (의무, 선택 X)

산출물:
  scripts/verify-engine-contracts.ts
  - 모든 engine.contract.yaml의 AC를 자동 체크
  - function_exists / test_passes / metric_check / file_exists 검증
  - 실패 시 Step 17 진입 차단

CI 통합:
  - .github/workflows/contract-verify.yml
  - PR마다 contract.yaml ↔ 코드 정합성 자동 검증
```

---

# Part 6: 거부된 우려 3개 (반론과 함께)

## 6.1 [거부 1] "1주 지연은 너무 길다" 우려

```
👤 ADVOCATE의 반론:
  "1주 지연이 길어 보이는 이유는 '엔진 보강'을 비용으로 봤기 때문.
   Section 1.1 비가역성 표가 명확히 보여준다:

   - BATCH-3 누적 후 발견: 인간 검수 × 노드 수 = 수일~수주
   - Phase 2 후 발견: 콘텐츠 폐기 + 재생성 = 수주~수개월
   - Phase 3 후 발견: user_progress 마이그레이션 = 수개월

   1주 지연 ↔ 잠재 손실 (수개월) — ROI는 명백히 양수."

→ 우려 거부. 1주 지연은 정확한 결정.
```

## 6.2 [거부 2] "Solo-Builder 단계인데 과도한 문서 작업" 우려

```
🏗️ ARCHITECT의 반론:
  "Vol XVI Solo-Builder는 'Lifecycle hook / AIEC / Chaos 비활성'을
   허용한다. 그러나 'Property Test (Vol XV.3 #1) + contract.yaml
   (Vol XV.3 #2)'은 Library Engine 의무 5요소 중 가장 중요.

   Solo-Builder 단계라도 결정성·재현성은 면제 X.
   (이는 v3.0 Vol XV.3에 명시: '결정성·회귀 차단 - 가장 중요')

   Roadmap이 정확히 이 경계를 지킨다 —
   Lifecycle/AIEC/Chaos는 이연, Property/Contract는 즉시."

→ 우려 거부. v3.0 헌법 정확 적용.
```

## 6.3 [거부 3] "Premature Documentation 안티패턴 #9" 우려

```
🎩 MEPHISTO의 반론:
  "v3.0 Vol IX.9 Premature Generalization은 '두 번째 사용처 등장 후 추상화'.
   본 로드맵은 추상화가 아니라 '검증·문서화'다 — 다른 차원.

   더 나아가 v3.0 Vol XIX.2:
   '새 도메인 발견 시 헌법은 인정하고 보완한다 (방어적 거부 ❌).'

   ThePick은 이미 ★1~★5의 기존 자산이 두텁다.
   본 로드맵은 새 추상화가 아니라 기존 자산의 결정성 검증.
   안티패턴 #9 적용 대상 아님.

   본 Roadmap의 Section 6 위험 표가 이미 'Premature documentation'
   우려를 자체 기각한 것은 정확한 자기 검증."

→ 우려 거부. 자기 검증이 정확.
```

---

# Part 7: v1.1 권고 패치

5개 보완점을 통합한 v1.1 패치:

## 7.1 Section 2.1 수정 (보완 1)

```diff
- | `packages/quality` | XV Library | L2 | ✅ | 결정성 test, contract.yaml, research.md |
+ | `packages/quality` | XV Library | **L3** | ✅ | 결정성 test, contract.yaml, research.md |
+ | (격상 사유: CBIV 6단계 + Stateful Meta가 의존하는 검증자, v3.0 Vol I.3 자동 L3 트리거 2건 해당) |
```

## 7.2 Section 3 추가 (보완 2)

```markdown
### 3.1 시간 추정 (현실주의 12계명 #2 적용)

- 낙관 추정: 5~7일
- **현실 추정: 7~10일 (× 1.5 calibration)**
- 비관 추정: 10~14일 (학습 곡선 + 디버깅)
- 의사결정 기준: 10일 초과 시 진산님 보고 + 우선순위 재조정
```

## 7.3 Step 3 (ADR-024) 명세 강화 (보완 3)

```markdown
### Step 3 — ADR-024 Payment AIEC Trigger (강화)

내용 추가:

- Pre-trigger Window: 실결제 전환 14일 전 AIEC 구현 시작
- Day -14: HMAC 키 발급 + nonce store (KV) 구축
- Day -7: capability 매트릭스 정의 + 통합 테스트
- Day -3: Tier 3 (Contract) + Tier 5 (Tampering Chaos) 통과
- Day 0: 실결제 활성화 + AIEC 활성화 동시
- 사후 모니터링: AIEC 차단 로그 일일 점검 (첫 30일)
```

## 7.4 Section 5 확장 (보완 4)

```yaml
# 기존 build_slo +
review_cost_estimate:
  per_review_usd: 0.5 ~ 2.0
  total_reviews: 9
  estimated_total_usd: 5 ~ 18
  note: 'BATCH-1 비용($10)의 50~180%. 1회성이므로 수용.'

review_failure_loop_cap: 3
```

## 7.5 Step 16 의무화 (보완 5)

```diff
- ### Step 16 — contract.yaml 검증 스크립트 (선택)
+ ### Step 16 — contract.yaml 검증 스크립트 (**의무**)
+
+ 산출물:
+   - scripts/verify-engine-contracts.ts
+   - .github/workflows/contract-verify.yml
+
+ Step 17 진입 게이트: 본 스크립트 PASS 필수
```

---

# Part 8: 최종 판정

## 8.1 종합 평가

```
방향: ★★★★★ (정확)
완성도: ★★★★ (5개 보완점 반영 후 ★★★★★)
실행 가능성: ★★★★★ (즉시 진행 가능)
헌법 정합성: ★★★★★ (v3.0 4개 도메인 정확 매핑)
ROI: ★★★★★ (1주 지연 ↔ 수개월 손실 방지)

종합: A+ → A++ (v1.1 반영 후)
```

## 8.2 진산님 결정 권고

```
🎩 MEPHISTO:
  "본 로드맵은 v3.0 헌법 작성자(나)와 같은 사람의 손에서 나왔기에
   정합성이 매우 높다. 5개 보완점은 모두 미세 조정 수준이며,
   방향 자체를 바꾸는 보완이 아니다.

   권고:
   ① v1.1 패치 5건 반영 (1시간 작업)
   ② 진산님 승인
   ③ Step 1~4 (ADR 3건 + LLM_CONTAINMENT.md) 동시 작성 진입

   1주 지연은 paralysis가 아니다.
   Vol XVI Solo-Builder가 12개월 빌드를 허용하는 것에 비하면
   1주는 정확히 First Heartbeat 정신 안에 있다."
```

## 8.3 첫 응답 (메타 메시지)

```
🔮 ORACLE의 마지막 코멘트:
  "진산님이 '방향이 맞는지 검토해줘'라고 물은 것 자체가
   v3.0 Vol XIX.2 (Reality Anchor 우선) + v3.3 헌법 ACAP 정신.

   AI가 '완료했습니다'를 일방 선언하지 않고
   인간이 '방향 검토'를 능동 요청하는 — 이것이 RAR Cycle의 모범.

   본 로드맵 자체가 ThePick 팀(진산님 + AI)의
   공동 설계 성숙도를 보여주는 산출물이다."
```

---

# 부록: v3.0 헌법 매핑 검증표

| Roadmap 항목                    | v3.0 헌법 매핑                             | 정합성 |
| :------------------------------ | :----------------------------------------- | :----: |
| BATCH 비가역성 분석 (1.1)       | Vol XIV.5 Silent Drift                     |   ✅   |
| build_correctness 99.9%         | Vol XIV.4 Build SLO                        |   ✅   |
| build_reproducibility 100%      | Vol XIV.4 + Vol XV.3 #1                    |   ✅   |
| Library 식별 3문항              | Vol XV.2                                   |   ✅   |
| Property Test 의무 (Step 12-14) | Vol XV.3 #1                                |   ✅   |
| contract.yaml × 3 (Step 5)      | Vol XV.3 #2                                |   ✅   |
| Cost meter (Step 11)            | Vol VI 5종 SLI + Vol IX #14 Free Tier Trap |   ✅   |
| ADR-022 Cloudflare Lock-in      | Vol XVII.3 보호 5장치 #1                   |   ✅   |
| ADR-023 Engine-First            | /user:engine Doctrine                      |   ✅   |
| ADR-024 Payment AIEC            | Vol XVI 위험 경고 + Vol IV-B               |   ✅   |
| LLM_CONTAINMENT.md (Step 4)     | Vol IV 4계층 격리                          |   ✅   |
| Lifecycle hook 이연             | Vol XVI Solo-Builder 차등표                |   ✅   |
| OTel 이연 + Cloudflare 백엔드   | Vol XVII OTel SDK만 의무                   |   ✅   |
| Tier 5 Chaos 이연 (100명까지)   | Vol XVI 차등표                             |   ✅   |
| 진산님 승인 3건만 (Section 8)   | v3.3 RAR Cycle                             |   ✅   |
| 4-Pass + 5-Persona 리뷰         | v3.3 Part 8.5 삼각 검증 + COT              |   ✅   |

**16/16 항목 100% 정합** — 본 로드맵은 v3.0 헌법의 정확한 적용 사례.

---

**문서 버전:** Review v1.0  
**Reviewer:** DEV COVEN 7인  
**Verdict:** ★★★★★ 방향 정확. 5개 보완점만 반영 후 즉시 진행 권고.  
**Next Action:** 진산님 v1.1 패치 승인 → Step 1~4 동시 진입  
**Status:** **APPROVED with minor revisions**

---

_"The right direction with imperfect speed beats_  
_the wrong direction at full sprint."_

— **VOID DEV · DEV COVEN · 2026-04-27**
