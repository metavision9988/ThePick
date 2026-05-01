# 🎭 Engine Hardening 완료 보고서 v1.0 — 최종 검토

> **DEV COVEN 7인 페르소나 + Mephisto 종합 판정**
> 검토 대상: `docs/ENGINE_HARDENING_COMPLETION_REPORT.md` v1.0 (2026-05-01)
> 검토자: Mephisto (orchestrator) + Oracle, Advocate, Architect, Hacker, Breaker, Ghost, Sentinel
> 검토 방식: 페르소나별 Chain-of-Thought → 메피스토 종합

---

## 0. Mephisto의 도입부 — "왜 이 검토가 필요한가"

> _"949 테스트가 통과했다. 17개 마이그레이션이 적용됐다. 100% 완료를 선언했다._
> _그런데도 — 진산, 너는 이 보고서를 나에게 던졌어._
> _그 행동 자체가 이미 답이야. 너도 무언가 찜찜한 거다."_

이 검토의 목적은 **보고서의 통과 여부**가 아니라, **진산님이 사인하기 전에 짚어야 할 인지 부조화**를 발견하는 것이다.

본 보고서가 가진 가장 위험한 특성은 **"수치적으로 너무 깔끔하다"**는 점이다. 949/949, 17/17, 8/8, CRITICAL 0건, Hard Rule 위반 0건 — 이런 숫자들의 행렬이 나란히 서면, 인간의 뇌는 이미 의심을 내려놓는다. 그래서 페르소나들에게 **"숫자 너머의 의미"를 따로 따로 추궁시킨다.**

---

## 1. 🔮 ORACLE — 비즈니스 비전 관점

> _"그건 기능이지, 제품이 아니야. 949 테스트가 합격생을 한 명이라도 만들었어?"_

### CoT 1.1: 북극성 메트릭과의 거리 측정

```
[관찰] 메모리 project_vision_mvp_generalization → 북극성 = 합격률 60%
[관찰] 본 보고서 §2 7가지 품질 목표 → 결정성/회복성/격리성/단일출처/무결성/신뢰성/관측성
[질문] 이 7개 중 합격률에 직접 기여하는 것은?
[추론] 7개 모두 "비기능 요구사항"이다. 학습자가 합격할 가능성을 1%도 올리지 않는다.
       이것들은 "엔진이 거짓말을 하지 않는다"는 보장일 뿐, "엔진이 좋은 콘텐츠를 만든다"는 보장이 아니다.
[결론] 보고서는 '엔진이 망가지지 않을 것'은 증명했지만, '엔진이 가치를 만든다'는 증명을 미뤘다.
```

**Oracle의 판정:**

이 보고서에서 가장 위험한 문장은 §10.6의 `[ ] BATCH-1 fixture 재실행 (Step 20)` 한 줄이다. **BATCH-1이 뭔지 보고서 어디에도 1차 정의가 없다.** §11.2에 절차만 나오는데, BATCH-1 = "교재 835p 적재" 인지, "기출 7회분 적재"인지, 둘 다인지가 보고서 자체에서 자명하지 않다. 진산님 메모리 외부의 독자(예: 6개월 뒤의 진산님 본인)는 이 보고서만으로는 **"진짜 시험 콘텐츠가 시스템에 들어있는가"를 알 수 없다.**

**진산님 1년 시작 시점의 시간 가치:** 메모리상 1년 전 시작 → 시험 직전 출시 압박. 그런데 "Phase 2 사용자 노출 후 데이터 흐름 시작"(§2.3)이라는 표현이 위험하다. **사용자 노출이 BATCH-1 적재 후 언제인지가 본 보고서에 없다.** 6주 뒤? 6개월 뒤?

**Oracle의 권고 한 문장:**

> _"§1.1 북극성 옆에, '이 Phase가 합격률에 기여하는 경로'를 한 단락으로 명시할 것. 안 그러면 949 PASS는 아름다운 박물관이지, 학원이 아니다."_

---

## 2. 👤 ADVOCATE — 사용 경험 관점 (이 보고서의 사용자 = 진산님 본인)

> _"진산님이 6개월 뒤 이 보고서를 다시 펼쳤을 때, 5분 안에 '내가 다음에 뭘 해야 하지'를 알 수 있어?"_

### CoT 2.1: 인지 부조화 추적

```
[입력] §0.3 "다음 단계: BATCH-1 적재 진입 (진산님 트리거 대기)"
[입력] §11.1 "BATCH-1 진입 직전 후속 PR (필수, ~1주)" → 2건 (telemetry wire-up + admin-web vitest)
[입력] §13.1 트리거 옵션 4개

[질문 1] "100% 완료" + "필수 후속 PR ~1주" 가 동시 참인가?
[추론 1] 두 가지 해석이 가능하다:
  (a) Engine 코어 = 100%, 운영 활성화 = 별도 (정직한 분리)
  (b) "100%"라는 마케팅 + "사실은 1주 더" (자기방어적 분류)

[질문 2] 진산님이 §0.3을 보고 "다음 = BATCH-1 적재"로 기억할 가능성은?
[추론 2] 매우 높음. Executive Summary는 BATCH-1 적재로 끝나는 직선처럼 읽힌다.
        그러나 §11에 도달하면 "사실 그 전에 1주짜리 wire-up + 테스트 인프라가 더 있다"가 등장한다.
[결론] §0.3과 §11 사이에 정보 격차(information gap)가 존재. 의사결정 메시지가 두 개다.
```

### CoT 2.2: "진산님이 직접 해야 할 일" vs "Claude가 할 일" 분리도

```
[입력] §11.4 진산님 통제 영역 5건 + §13.2 보고서가 다루지 않는 영역 5건
[관찰] 일부 항목이 두 곳에 모두 나옴 (Cloudflare Access, Anthropic cap, 법무 3종)
[관찰] §11.2 BATCH-1 절차 8단계 중 진산님 행동(4번 ADMIN_API_TOKEN, 5번 PUBLIC_API_BASE_URL,
       6번 Anthropic cap)이 Claude 행동과 섞여 있음
[추론] 진산님이 §11.2를 보고 "1번부터 8번까지 순서대로 진행"이라 읽으면, 진산님 본인이 콘솔 작업해야 할
      4/5/6번을 Claude에게 위임하려 들거나, 반대로 Claude가 할 1/2/3/7/8을 진산님이 직접 하려 들 수 있다.
[결론] BATCH-1 절차가 "주체별 워크플로우"로 분리되지 않은 채 1열 직선으로 적혀 있다 = UX 문제.
```

**Advocate의 판정:**

이 보고서는 **기술적으로 정직하지만, UX적으로 두 얼굴**이다. §0/§10/§14에서는 "Phase 1 100% 완료"라는 의기양양한 어조를 유지하다가, §11에서 갑자기 "사실 1주짜리 후속 PR이 필수"라고 고백한다. **진산님이 피곤한 상태에서 §0과 §13만 읽고 사인할 가능성이 매우 높다.**

또한 §13.1의 4가지 트리거 중 `"telemetry wire-up 먼저"`와 `"admin-web 테스트 먼저"`는 사실 **둘 다 BATCH-1 진입 전에 둘 다 해야 하는 일**이다(§11.1). 그런데 트리거가 OR로 되어 있어, 진산님이 하나만 골라 진행하면 다른 하나가 누락될 위험이 있다.

**Advocate의 권고 한 문장:**

> _"§0.3 한 줄 요약을 두 단계로 쪼개라: '1단계: Engine 코어 949 PASS / 2단계: 운영 활성화 (telemetry wire-up + admin-web vitest, ~1주)'. 그래야 진산님이 다음 일주일을 정직하게 본다."_

---

## 3. 🏗️ ARCHITECT — 시스템 구조 관점

> _"이 결정은 되돌릴 수 있어? 없어? 그럼 더 고민해."_

### CoT 3.1: Year 2 zero-cost 약속의 검증

```
[입력] §7.4 "마이그레이션 0005 추가 후 호출 측 코드 변경 0건"
[입력] Hard Rule 16: 모든 데이터 조회 시그니처 examId 첫 인자
[입력] Hard Rule 17: EXAM_IDS 단일 선언 (exam-ids.ts)

[질문] 진짜로 zero-cost인가?
[검증 1: 데이터 모델] knowledge_nodes / formulas / constants 의 PRIMARY KEY가 (exam_id, source_id) 복합인가,
        아니면 source_id 단일인가? 본 보고서에는 0016이 (batch_run_id, source_id) UNIQUE라고 되어 있는데
        exam_id가 빠져 있다. Year 2에 같은 source_id가 다른 시험에서 발생하면?
[검증 2: 인덱스] 모든 쿼리 인덱스가 exam_id 선두인가? 본 보고서에 명시 없음.
[검증 3: ontology-registry.json] Hard Rule 5 Ontology Lock. 노드 ID 패턴이 시험별로 분기되는가?
        '문제-1차-상법-2024-Q01' 같은 ID 패턴이 시험 추가 시 충돌 없이 확장되는가?
[검증 4: Vectorize 메타데이터] ADR-004 "exam_id 의무". 그런데 Vectorize 인덱스는 immutable. Year 2에
        새 시험 추가 시 기존 임베딩 재계산 필요한가? 메모리 노트 "차원은 immutable"과 별개로,
        메타데이터 스키마 진화 정책은?

[결론] §7.4의 zero-cost 주장은 시그니처 레벨에서만 검증되었고, 데이터/인덱스/온톨로지/Vectorize
      4개 레벨 중 1개에서만 보증된다. 나머지 3개는 "검증 없이 자신감"으로 적혀 있다.
```

### CoT 3.2: engine_telemetry FK 부재의 진짜 비용

```
[입력] §7.3 "FK 부재 의도: 1년 보존 vs batch_runs 무제한 lifecycle 차이"
[추론] 합리적 설계 결정처럼 보인다. 하지만:
  - batch_run_id가 telemetry에는 있지만 batch_runs에는 cascade 없음
  - batch_runs row가 archived/purged 되어도 telemetry는 살아있음
  - 그러면 진산님이 6개월 뒤 telemetry 그래프를 보다가 "이 spike의 batch_run이 뭐였더라"
    하고 batch_runs를 조회했을 때 row가 없으면? → 데이터 고아(orphan)
[질문] 1년 보존 정책 (Phase 2)이 발동될 때, telemetry에서 batch_run_id로 조인하는 admin-web 쿼리가 있나?
[추론] §6.1.3 GET /api/telemetry/dashboard 가 그런 조인을 할 가능성 있음. 보고서에 명시 없음.
[결론] FK 부재의 의도는 명시되었지만, "조인 시점에 NULL/missing 처리는 어떻게 하는가"의 운영 매뉴얼이 없다.
```

### CoT 3.3: admin-web을 "Engine 외부"로 정의한 자기 정합성

```
[입력] CRIT-Q1 admin-web vitest 인프라 = "Engine 외부 viewer"로 명시 트래킹
[입력] §9.1 운영 모델: admin-web이 telemetry 시각화의 endpoint
[입력] §1.2 "Engine = 콘텐츠 빌드 + 품질 검증 + 운영 인프라"

[모순] §1.2의 "운영 인프라 엔진"에 Observability/Audit 포함 → admin-web이 그 시각화 layer
[모순] 그런데 admin-web 자체는 "Engine 외부"로 분류
[결론] admin-web은 "Engine의 출력 인터페이스"이므로, 정의상 Engine의 일부여야 한다.
      그것을 "외부"로 분리한 것은 분류 편의이지 아키텍처적 정의가 아니다.
```

**Architect의 판정:**

세 가지 구조적 빚이 보고서에 빠져 있다:

1. **Year 2 zero-cost는 4개 레벨 중 1개만 검증됨** — 데이터 모델 PK, 인덱스 선두, 온톨로지 ID 패턴, Vectorize 메타데이터 4가지 중 시그니처 레벨만 PASS. **Year 2 진입 시 진짜 zero-cost가 아닐 가능성이 높다.**

2. **engine_telemetry FK 부재의 운영 시나리오 미정의** — 의도는 적혀 있지만, "1년 후 archived batch_run에 대한 telemetry 조회 시 동작"이 명시되지 않음.

3. **admin-web의 "Engine 외부" 분류는 자기방어적** — Engine 정의(§1.2)에 운영 인프라 포함되어 있으면서, admin-web만 외부로 빼는 것은 일관성 결여.

**Architect의 권고 한 문장:**

> _"§7.4 Year 2 zero-cost 주장에 '데이터 모델 PK / 인덱스 선두 / 온톨로지 ID 패턴 / Vectorize 메타데이터' 4개 레벨 검증 결과를 추가하라. 1개만 통과한 zero-cost는 12개월 후의 ADR re-open이다."_

---

## 4. 💻 HACKER — 구현 관점

> _"작동한다는 건 알겠어. 그래서 지금 Worker에 띄워서 fixture 던지면 돌아가?"_

### CoT 4.1: "100% PASS"의 적용 범위 검증

```
[입력] §10.1 Test Counts 합계 949
       formula-engine 251 + parser 136 + quality 41 + shared 33 + ai-adapter 13 + api 239 + batch 236
[관찰] apps/web (학습자 PWA) = 0 tests. 합계에 안 잡힘.
[관찰] apps/admin-web = 0 tests. 합계에 안 잡힘.
[관찰] payment 패키지 = 본 합계에 보이지 않음.
[관찰] study-material-generator = 본 합계에 보이지 않음.

[질문] 949는 무엇의 100%인가?
[추론] "Engine + API + Shared 패키지의 100%"이지, "모노레포 전체의 100%"가 아니다.
      그런데 §10.1 헤더는 "모노레포 합계 949"라고 되어 있다 = 부정확한 라벨.

[검증] 보고서 다른 곳에서 모노레포 전체 패키지 수가 명시된 곳:
       §3.3 = 8 패키지 + 4 앱 (총 12). 본 합계는 7 컴포넌트만 다룸.
       study-material-generator와 payment, parser-1st-exam, apps/web, apps/admin-web 등이 빠짐.
```

### CoT 4.2: telemetry wire-up = "Engine Observability v1 가동" 마킹의 정합성

```
[입력] §10.6 "[x] Engine Observability 8 게이지 가동 (master-dashboard.md v1)"
[입력] §9.3 "wire-up (8 게이지 → engine_telemetry POST) — BATCH-1 진입 직전 후속 PR (MAJOR-S2 트래킹)"

[질문] "8 게이지 가동" = 무엇인가?
       (a) 인프라(테이블+API+페이지)가 가동 = ✅
       (b) 데이터가 흐른다 = ❌ (wire-up 미완)

[현실] 진산님이 admin-web /telemetry 첫 접속 시 8 게이지 모두 'no_data' 표시
       (보고서 §11.1에 본인이 명시함)

[결론] §10.6의 [x] 마킹은 "(a) 가동"의 의미. 그러나 진산님 메모리 project_engine_observability
      "자동차 계기판 메타포"는 "(b) 데이터 흐른다"의 의미.
      = 문자적 정합성 vs 의미적 정합성 충돌.
```

### CoT 4.3: Cat 5/8 deferred의 의미

```
[입력] Cat 5 성능 = "Workers 50ms CPU 벤치 + Vectorize latency 측정 = LLM 통합 후"
[입력] Cat 8 출력 검증 = "Reviewer 큐 + 출처 추적성 = LLM 통합 후 BATCH-1 적재 후"

[질문] LLM 통합이 Phase 1인가 Phase 2인가?
[관찰] §1.2 "운영 인프라 엔진" + ai-adapter 13 tests (Phase 1 합계에 포함) = LLM 통합 부분적 Phase 1
[관찰] §11.3 "BATCH-1 적재 후 / 사용자 노출 시점" Phase 2 명시
[관찰] BATCH-1 적재 자체가 §11.2에서 "다음 단계"로 명시 = Phase 1 닫힘 이후

[모순] LLM 통합이 부분적으로 Phase 1이지만 Cat 5/8 검증은 Phase 2로 미뤄짐.
       이는 "Phase 1 닫힘 = Engine 코어만, LLM 출력 품질 미검증"을 의미.
[결론] 본 보고서의 "Phase 1 100% 완료"는 진산님 메모리 feedback_no_shortcuts ("상용 품질")와
      약하게 충돌. 상용 서비스라면 LLM 출력 품질 검증이 핵심인데, 그것이 Phase 1에서 빠져 있다.
```

**Hacker의 판정:**

코드는 잘 짜였다. 949 PASS는 진짜다. 하지만 **세 가지 마케팅 표현이 실체보다 크다:**

1. **"모노레포 합계 949"는 거짓말.** 모노레포의 일부(7 컴포넌트) 합계 949다. apps/web, apps/admin-web, payment, study-material-generator, parser-1st-exam은 미포함 또는 0건.

2. **"Engine Observability 8 게이지 가동"의 의미 모호.** 인프라는 가동, 데이터는 미흐름. 진산님 첫 접속 시 'no_data' = 자동차 계기판이 까만 화면.

3. **"Phase 1 100% 완료"는 Engine 코어 한정.** LLM 출력 품질(Cat 8)이 빠진 채로 Phase 1을 닫는 것은, "엔진이 거짓말 안 하지만 좋은 말을 하는지는 미검증"인 상태.

**Hacker의 권고 한 문장:**

> _"§10.1 헤더를 '모노레포 합계 949' → 'Engine + API + Shared 패키지 합계 949 (apps/web, apps/admin-web 미포함)'로 정정하고, §10.6 [x] 마킹 옆에 '(인프라 가동, 데이터 wire-up 후속)'을 명시하라."_

---

## 5. 🔨 BREAKER — 파괴 관점

> _"949가 통과? 그건 아직 내가 안 봤다는 뜻이야."_

### CoT 5.1: "0건 정책" vs "23건 명시 트래킹"의 모순

```
[입력] §10.6 "[x] Phase 이월 부채 0건"
[입력] 진산님 메모리 project_completion_notification_obligation 정합
[입력] §11.3 "Phase 2 명시 트래킹 — 5-페르소나 MAJOR 23건"
[입력] §11.1 BATCH-1 진입 직전 후속 PR 2건

[모순 1] "이월 부채 0건" + "MAJOR 23건 Phase 2 트래킹"
[해석 시도] "CRITICAL = 0건, MAJOR = 23건은 정상" = 분류 정의로 모순 해소 시도
[검증] 진산님 메모리에 CRITICAL/MAJOR 구분이 명시되어 있는가? — 메모리에는 "이월 부채 0건"만 있음.
[결론] 모순 해소가 분류 정의에 의존하는데, 그 정의가 보고서 내부에서만 통용됨.
       진산님이 "23건 = 부채"로 해석할 가능성을 보고서가 차단하지 못함.

[모순 2] "0건" + "BATCH-1 진입 직전 1주 PR 필수 2건"
[해석 시도] 1주 PR 2건은 "Phase 1 외부 후속 작업" = "이월"이 아니라는 분류
[검증] "Phase 1 100% 완료" 시점에 "그 다음 작업하기 위해 1주 후속 PR 필수" = 일반인 정의로는 이월
[결론] 분류 트릭으로 정의를 우회한 0건 선언.
```

### CoT 5.2: SUPERSEDES 사이클 — naive DFS의 폭발 임계점

```
[입력] §3.2.3 "SUPERSEDES 사이클: Tarjan SCC (단일 패스 O(V+E)) — Phase 1 후반 도입 예정,
       현재는 naive DFS (Step 15b deferred)"
[입력] §5.3.1 "현재 naive DFS (Step 15b 에서 Tarjan SCC 비교 검증 deferred)"

[질문] naive DFS의 시간복잡도?
[추론] 모든 노드에서 DFS 시작 → O(V * (V+E)). 사이클 검출 위해 visited tracking.
[질문] BATCH-1 적재 후 노드 수 추정?
[관찰] 메모리 외 추정: 교재 835p × 평균 노드 N개 + 기출 581문항 × 노드 N개. 본 보고서에 추정치 없음.
[추론] 보수적으로 N=5000 노드, E=20000 엣지 → naive DFS = O(5000 * 25000) = 1.25e8 연산
       Workers CPU 50ms 한도에서 빡빡함.
[결론] BATCH-1 적재 직후 sanity 점검 시점에 첫 폭발 가능. Tarjan SCC가 BATCH-1 진입 전 이슈일 수 있는데,
      §11.3 "Phase 2 트래킹"으로 분류됨.
```

### CoT 5.3: "Engine 범위 CRITICAL 0건" 정의의 자기참조성

```
[입력] §10.5 "Engine 범위 CRITICAL 0건"
[입력] CRIT-Q1 admin-web vitest = Engine 외부 viewer로 분류
[입력] CRIT-Q3 정규식 + CRITICAL-DO-1 production fallback + CRIT-Q2 write-helper unit tests = 흡수

[질문] "Engine 범위"의 정의는 누가 했는가?
[관찰] §1.2 Engine 정의가 보고서 자체에 있음 = 자기정의.
[관찰] CRITICAL이 발견되면 "Engine 외부"로 재분류하는 패턴 가능 = 통과시키기 위한 정의 변경.
[검증] CRIT-Q1을 Engine 내부로 분류하면 CRITICAL 1건 = "Engine 범위 CRITICAL 0건" 거짓.
[결론] "0건"이 정의 의존적이고, 정의는 보고서 작성자가 통제. 진산님이 정의 수정 제안하면 0건이 깨짐.
```

### CoT 5.4: Recovery 결정 트리 — Q3 engine_version major 동일성

```
[입력] §5.6.2 "Q3. engine_version major 동일?"
[질문] BATCH 실행 도중 engine_version major가 bump 되는 시나리오는?
[추론] 일반적이지 않다. 하지만 "BATCH 실행 중 hotfix 배포 → major bump" 가능.
[질문] kill 후 recover 시점에 코드는 신규 major. checkpoint는 구 major. 어떻게 처리?
[추론] §5.6.2에 "VersionMismatch → recovery_failed"로 명시됨 = recover 거부.
[질문] recover 거부 시 진산님은 어떻게 진행?
[관찰] runbook이 보고서에 없음. "recovery_failed 시 manual 처리 절차"가 §11.3 trace 5건에 들어있음
      (D1 backup runbook 항목으로 추정).
[결론] 발생 빈도는 낮지만, 발생 시 "BATCH가 좀비 상태로 남음" 시나리오. on-call 시 진산님 직접 대응.
      runbook 부재가 위험.
```

### CoT 5.5: 카오스/퍼즈 테스트의 부재

```
[입력] §10.1 949 tests
[관찰] formula-engine sandbox property test (mulberry32 100회) = 결정성 fuzz 일부
[관찰] quality 500 시나리오 property test = 그래프 fuzz 일부
[관찰] 카오스 테스트 (랜덤 D1 disconnect, 랜덤 Worker timeout, 랜덤 클럭 skew) 없음
[관찰] 퍼즈 테스트 (악의적 입력 PDF, 악의적 Claude 응답, 악의적 webhook 페이로드) 없음

[질문] "회복성 100% 보장"이 §14에 명시. 어떤 회복성?
[추론] AC-RP-3 (50% kill → recover) = 결정적 fault injection 1개 시나리오.
      랜덤 fault, 다중 fault, partial fault 미검증.
[결론] "회복성 100%"는 1개 시나리오 PASS.
      장애의 1%만 시나리오와 일치. 나머지 99%는 미검증.
```

**Breaker의 판정:**

이 보고서가 **가장 위험한 점은 "0건"의 행렬**이다. CRITICAL 0건, Hard Rule 위반 0건, 이월 부채 0건, console.\* 0건, 동적 코드 실행 0건, XSS 위험 0건. 진산님이 6개월 뒤 이 보고서만 보고 "엔진은 다 끝났다"라고 기억하면 — 다음 위기가 왔을 때 의심 시작점을 잃는다.

발견된 **빨간 깃발 5개:**

1. **"이월 부채 0건"이 분류 트릭에 의존** — MAJOR 23건과 후속 PR 2건은 일반 정의로는 이월
2. **SUPERSEDES naive DFS가 BATCH-1 노드 수에서 폭발 가능** — Tarjan SCC를 Phase 2로 미룬 것이 위험
3. **"Engine 범위 CRITICAL 0건"이 자기정의 의존** — 정의 변경 시 0건 깨짐
4. **engine_version major bump 시 runbook 부재** — 발생 시 진산님 직접 대응
5. **카오스/퍼즈 테스트 부재** — "100% 회복성"은 1개 시나리오 PASS

**Breaker의 권고 한 문장:**

> _"§10에 '검증되지 않은 영역' 섹션을 추가하라. naive DFS 임계 노드 수, 카오스 테스트 미실시, runbook 부재 항목 등을 명시. 0건의 행렬 옆에 '검증되지 않은 0건'도 적어야 정직하다."_

---

## 6. 👻 GHOST — 운영 관점

> _"로컬에서 되는 건 의미 없어. 프로덕션에서 돼야 해."_

### CoT 6.1: 마이그레이션 적용 환경의 모호성

```
[입력] §10.1 "D1 마이그레이션 17/17 PASS"
[질문] 어느 환경에서 PASS?
[관찰] §11.2 절차 3번에 "wrangler d1 migrations apply --env production (0001~0017)"
       = production 환경에는 아직 적용 안 됨
[관찰] §10에 "local? staging? production?" 명시 없음
[추론] 17/17은 local 또는 dev 환경 PASS. production 미적용.
[결론] "100% 완료" 마킹 시점에 production 환경 검증 0회.
      §11.2 절차 3번이 production 첫 적용 = 진산님 트리거 시점에 처음으로 production D1이 17개를 받음.
[리스크] BATCH-1 진입 직전 후속 PR 1주 + production 마이그레이션 = "검증 안 된 시퀀스"가 BATCH-1 직전에 발생.
```

### CoT 6.2: Anthropic Layer 2 cap 발동 시 Layer 1 연동 시나리오

```
[입력] ADR-025 Two-Layer Cost Control
[입력] Layer 1 = apps/batch cost-meter (soft 70% / hard 90% / kill 100%)
[입력] Layer 2 = Anthropic 콘솔 monthly cap (진산님 통제)

[질문] Layer 2가 발동하면 Anthropic API가 4xx/5xx 반환. apps/batch는 어떻게 인식?
[관찰] §3.2.7 "Layer 2 = 진산님 콘솔" / §11.2 6번 "monthly cap $200 + alerts 설정"
[관찰] Layer 1과 Layer 2의 연동 시나리오 (Layer 2 발동 → Layer 1 자동 kill / 알람) 본 보고서에 없음.
[추론] Layer 2 발동 시 Anthropic SDK가 RateLimitError / OverLimitError 등 반환.
       ai-adapter 13 tests에 이 시나리오가 포함되었는지 본 보고서로는 알 수 없음.
[결론] Two-Layer 정책의 layer 간 통신/fallback이 정의되지 않음.
      발동 시 진산님이 "왜 BATCH가 갑자기 멈췄지" 디버깅을 처음부터 해야 할 수 있음.
```

### CoT 6.3: ADMIN_API_TOKEN 회전 정책

```
[입력] §11.2 4번 "ADMIN_API_TOKEN 환경변수 등록 (wrangler secret put)"
[입력] §11.3 trace 5건 중 "ADMIN_API_TOKEN 회전"이 Phase 2 명시 트래킹
[입력] §6.3 "Admin 인증 = X-Admin-Token 헤더 (Phase 1 임시) → Cloudflare Access (Phase 2)"

[질문] Phase 1 임시 토큰의 수명은?
[관찰] 만료/회전 정책 본 보고서에 없음.
[추론] 일회 발급 후 무한 사용. 유출 시 무한 위험.
[질문] Phase 1 → Phase 2 Cloudflare Access 전환 일정은?
[관찰] §11.3에서 Phase 2 (BATCH-1 적재 후 / 사용자 노출 시점)으로 분류.
       사용자 노출 = 합격률 60% 북극성 진입 = 매우 늦음.
[결론] "Phase 1 임시 토큰"이 사실상 매우 긴 기간 운영.
       유출 시 admin-web /telemetry 전체 + Reviewer 큐 전체 노출 가능.
```

### CoT 6.4: Cron Trigger 03:00 UTC

```
[입력] §5.7 "Cron: 0 3 * * * UTC (rate_limits GC + scheduled telemetry collection — Phase 1 후반)"
[질문] 03:00 UTC = 한국시간 12:00 PM. 진산님이 점심 먹는 시간.
[관찰] Cron 실패 시 알람 경로가 본 보고서에 없음.
       "scheduled telemetry collection — Phase 1 후반"이라 wire-up 미완.
[추론] 진산님이 점심 먹는 동안 Cron이 실패하면 인지 못함. Email Routing alarm = Phase 2 trace.
[결론] Phase 1 종료 시점에 Cron 알람 경로가 닫힘 = 운영 가시성 누수.
```

**Ghost의 판정:**

운영 관점에서 **세 가지 결손**:

1. **production 환경 첫 마이그레이션이 BATCH-1 진입 직전** — 검증 안 된 시퀀스. dry-run / staging 검증 단계 명시 부재.

2. **Two-Layer Cost Control의 layer 간 연동 시나리오 미정의** — Layer 2 발동 시 Layer 1 동작이 ad-hoc.

3. **ADMIN_API_TOKEN 회전 정책 부재 + Cloudflare Access 전환이 매우 늦은 Phase 2** — Phase 1 임시 토큰이 사실상 영구 토큰화 위험.

**Ghost의 권고 한 문장:**

> _"§11.2 절차에 '3번 production 마이그레이션' 직전에 'staging dry-run' 단계를 추가하고, ADMIN_API_TOKEN 회전 주기 (예: 30일)를 Phase 1 활성 동안 명문화하라. Cloudflare Access는 Phase 2지만 토큰 회전은 Phase 1에서 가능하다."_

---

## 7. 🛡️ SENTINEL — 보안 관점

> _"보안은 기능이 아니야. 공기야. 없으면 죽어."_

### CoT 7.1: localStorage admin_api_token = XSS 공격면

```
[입력] §5.8 "Phase 1: localStorage 'admin_api_token' → X-Admin-Token / Phase 2: Cloudflare Access"
[입력] §3.4 Hard Rule 12: innerHTML 금지 (XSS 차단)
[입력] §10.3 "XSS 위험 DOM: 0건 PASS"

[질문] verify-engine-contracts.ts Cat 7이 모든 XSS 벡터를 검출하는가?
[관찰] React 19 + dangerouslySetInnerHTML / 외부 라이브러리 / SVG embedded scripts / URL injection /
       postMessage 등 multi-vector. innerHTML 0건만 검증.
[질문] localStorage 토큰이 XSS 1건에 노출되면?
[추론] 즉시 admin-web 전체 권한 탈취 + /api/telemetry 전 데이터 노출 + Reviewer 큐 변조.
[결론] "Phase 1 임시"라는 라벨이 보안 부채의 isolation을 약속하지만, 실제로는 wide blast radius.
      Cloudflare Access Phase 2가 "사용자 노출 후"이므로 매우 늦음.
[권고] 최소한 httpOnly cookie + SameSite=Strict + Secure로 Phase 1에서도 가능.
      localStorage는 명백한 안티패턴.
```

### CoT 7.2: PBKDF2-SHA256 iteration count

```
[입력] §3.3 ADR-005 "PBKDF2-SHA256"
[질문] iteration count는?
[관찰] 본 보고서에 명시 없음. ADR-005 원본을 봐야 함.
[표준] OWASP 2023 권장: PBKDF2-SHA256 iteration ≥ 600,000
[리스크] iteration이 100,000 이하면 GPU 공격에 취약. 만약 ADR-005가 100,000으로 적혀 있으면 부채.
[결론] 보고서에 검증값이 없어서 외부 검증 불가.
```

### CoT 7.3: Webhook IP allowlist의 운영 변경 정책

```
[입력] §6.3 "Webhook 인증 = HMAC SHA-256 + IP allowlist (provider별)"
[질문] 결제 provider (Polar/TossPayments/PortOne)가 IP 변경하면?
[관찰] 본 보고서에 IP 변경 감지 → allowlist 자동 갱신 정책 없음.
[리스크] provider IP 변경 → 모든 webhook 거부 → 결제 처리 마비.
[결론] HMAC만으로 충분한 검증. IP allowlist는 추가 layer지만 운영 위험 source.
      정적 allowlist가 정말 필요한가는 ADR-002에서 검증되어야 함.
```

### CoT 7.4: PII Masking — D1 저장 데이터 자체

```
[입력] §5.4.1 "PII Masking: 재귀 + 깊이 제한 + 순환 참조 가드 + JWT 패턴 자동 마스킹"
[관찰] logger 레벨 마스킹 = 로그 수출 시점만.
[질문] D1 저장 데이터 자체의 마스킹/암호화는?
[관찰] users 테이블, sessions 테이블, webhook_events 테이블, batch_runs 테이블에 PII가 들어가는가?
[추론] users 테이블 = email/password_hash 최소. password_hash는 PBKDF2 (단방향).
       batch_runs = 구조적 메타데이터. PII 없음.
       webhook_events = 결제 webhook 페이로드 일부 저장. provider별로 PII 포함 가능.
[결론] D1 자체 암호화 (Cloudflare D1 at-rest encryption)에 의존 = OK.
       그러나 webhook_events 페이로드의 PII 마스킹 정책이 보고서에 명시 안 됨.
```

### CoT 7.5: ADR-009 PII Masking 정합성

```
[입력] §3.3 ADR-009 PII Masking
[관찰] ADR-009의 적용 범위가 보고서에 명시 안 됨.
[질문] ADR-009가 logger만? D1 저장 시? Vectorize 메타데이터?
[추론] Vectorize 메타데이터에 사용자 학습 이력이 들어가면 PII 위험 (Phase 2 진입 시).
[결론] Phase 1 시점에는 PII 노출 표면이 작지만, Phase 2에서 폭발 가능.
      ADR-009의 적용 범위 명시가 Phase 1 closeout에 들어 있어야 미래 부채를 방지.
```

**Sentinel의 판정:**

보안 관점에서 **세 가지 위험**:

1. **localStorage admin_api_token은 명백한 안티패턴** — Phase 1 "임시"라고 부르지만 Phase 2까지 매우 긴 기간. 최소 httpOnly cookie로 즉시 변경 가능. **이건 Phase 1 closeout 직전에 패치 가능한 항목.**

2. **PBKDF2-SHA256 iteration count가 본 보고서에 검증되지 않음** — 외부 ADR-005 의존. 검증 결과를 본 보고서로 끌어와야 함.

3. **ADR-009 PII Masking 적용 범위 명시 부재** — Vectorize 메타데이터로 확장 시 폭발 가능.

**Sentinel의 권고 한 문장:**

> _"§5.8 Phase 1 인증을 'localStorage' → 'httpOnly + SameSite=Strict + Secure cookie'로 즉시 변경하라. ADR-005 PBKDF2 iteration count와 ADR-009 PII Masking 적용 범위를 §3.3에 인라인 명시하라."_

---

## 8. 🎩 MEPHISTO — 종합 판정

> _"이제 내 차례야, 진산. 나는 너에게 답을 주지 않아. 질문을 던지고, 너의 결정을 너에게 돌려줄 뿐이지."_

### 8.1 보고서의 객관적 강점

부정확한 칭찬을 늘어놓을 마음은 없지만, 진짜 잘한 것들은 짚자:

1. **17 ADR + 17 Hard Rule + 14→17 진화 추적** — 결정의 흔적이 정직하게 보존됨.
2. **Hard Rule 16/17의 zero-cost 약속이 시그니처 레벨에서 강제됨** — 미래 Year 2 개발자(아마도 진산님 본인)가 손쉽게 마이그레이션 가능.
3. **Recovery 결정 트리 (§5.6.2) 명문화** — `recovery_failed` 분기 4가지가 명시. 운영 시 의사결정이 자동.
4. **Two-Layer Cost Control (ADR-025)** — Layer 1 마이크로센트 정수 누적은 부동소수점 오차 0건 보장. 진짜 잘함.
5. **Engine-First Doctrine (ADR-023)** — 패키지 격리가 contract.yaml + research.md로 강제됨.
6. **Temporal Graph 트리거 (0014, 0017)** — DB 레벨에서 UPDATE 차단. LLM이 거짓말해도 DB가 거부.

### 8.2 보고서의 7가지 인지 부조화 (페르소나 종합)

|  #  | 부조화                                                               | 근거 페르소나             | 위험도 |
| :-: | :------------------------------------------------------------------- | :------------------------ | :----: |
|  1  | "Phase 1 100% 완료" + "BATCH-1 진입 직전 1주 후속 PR 필수"           | Advocate, Hacker, Breaker |   🔴   |
|  2  | "이월 부채 0건" + "MAJOR 23건 명시 트래킹" (분류 트릭)               | Breaker, Contract         |   🔴   |
|  3  | "Engine Observability 8 게이지 가동" + "wire-up 미완 (no_data 표시)" | Hacker, Advocate          |   🟠   |
|  4  | "Engine 범위 CRITICAL 0건" + "admin-web vitest 0건은 Engine 외부"    | Architect, Breaker        |   🟠   |
|  5  | "모노레포 합계 949" + "apps/web, admin-web, payment 미포함"          | Hacker                    |   🟠   |
|  6  | "Year 2 zero-cost" + "4개 검증 레벨 중 1개만 통과"                   | Architect                 |   🟡   |
|  7  | "100% 회복성 보장" + "1개 시나리오 PASS, 카오스/퍼즈 미실시"         | Breaker                   |   🟡   |

### 8.3 보고서가 사인되기 전 반드시 결정할 7가지 질문

진산, 이 보고서를 그대로 받아들이기 전에, 너 스스로에게 답해야 할 질문들이다.

**Q1. "Phase 1 100% 완료" + "BATCH-1 진입 직전 1주 PR 필수" 중 어느 표현이 진실인가?**

- 옵션 A: "Engine 코어 100%, 운영 활성화 별도" → §0.3과 §11을 명시적으로 두 단계로 쪼개라
- 옵션 B: "운영 활성화까지 Phase 1" → telemetry wire-up + admin-web vitest 완료 후 Phase 1 마감 선언

**Q2. "이월 부채 0건" 정의를 유지할 것인가, 정직하게 수정할 것인가?**

- 옵션 A: "CRITICAL 이월 0건" → 표현 수정
- 옵션 B: "MAJOR 23건은 부채" → 보고서 톤 정직화

**Q3. 합격률 60% 북극성과 본 Phase의 연결고리를 §1.1에 명시할 것인가?**

- 답이 "예"여야 한다. 비기능 요구사항 7개로는 합격생이 안 만들어진다.

**Q4. Year 2 zero-cost 주장을 4개 레벨(데이터 PK / 인덱스 / 온톨로지 / Vectorize)로 검증한 결과를 본 보고서에 추가할 것인가?**

- 안 하면 12개월 뒤 ADR re-open이다.

**Q5. localStorage admin_api_token을 httpOnly cookie로 즉시 패치할 것인가, Phase 2까지 끌고 갈 것인가?**

- Phase 1 closeout 직전 1줄 변경 가능.

**Q6. SUPERSEDES Tarjan SCC를 Phase 2 → BATCH-1 진입 전으로 당길 것인가?**

- BATCH-1 적재 후 노드 수가 5,000+ 추정 시 naive DFS 폭발 가능.

**Q7. "검증되지 않은 영역" 섹션 (§10.7 신설)을 추가할 것인가?**

- 카오스/퍼즈 미실시 / Cat 5/8 deferred / production 환경 미검증 / runbook 부재 등을 명시.

### 8.4 메피스토의 최종 결정

> _"진산. 949 PASS는 진짜야. ADR 27건은 정직한 흔적이야. Two-Layer Cost Control과 Temporal Graph 트리거는 미래의 너에게 진짜 선물이야._
>
> _그러나 — 이 보고서는 **'기술적으로 정직하지만 의사결정 메시지로는 두 얼굴'**이야._
>
> _진산이 6개월 뒤 이 문서를 다시 펼치면, §0.3과 §14의 100% 마케팅에 매몰될 거야. 그러면 다음 위기가 왔을 때 — 그게 Year 2 마이그레이션의 hidden cost건, naive DFS 폭발이건, localStorage XSS 사건이건 — 의심의 시작점을 잃어._
>
> _이 보고서를 사인하기 전에 두 가지만 해._
>
> **_(1) 7가지 인지 부조화 중 적어도 #1, #2, #5를 본 보고서에 정직하게 반영._**
> _§0.3 한 줄 요약을 두 단계로 분리. §10.6 [x] 마킹 옆에 '인프라 가동, 데이터 wire-up 후속' 명시. §10.1 헤더를 'Engine + API + Shared 합계'로 정정._
>
> **_(2) §10.7 '검증되지 않은 영역' 섹션 신설._**
> _0건의 행렬 옆에, 검증되지 않은 0건도 적어. 그게 진짜 정직한 closeout이야._
>
> _이 두 가지 없이 사인하면, 이 보고서는 너의 미래의 너 자신을 속이는 무기가 돼._
>
> _나의 메피스토적 임무는 그걸 막는 거야. 너가 너에게 거짓말하지 않게."_

---

## 9. 권고 액션 매트릭스 (사인 전 필수 vs 권장)

| Action                                                    | 페르소나          | 사인 전 | 사인 후 | 비고              |
| :-------------------------------------------------------- | :---------------- | :-----: | :-----: | :---------------- |
| §0.3 두 단계 분리 (Engine 코어 / 운영 활성화)             | Advocate, Hacker  | ✅ 필수 |    -    | 5분 작업          |
| §10.1 헤더 정정 (모노레포 → Engine+API+Shared)            | Hacker            | ✅ 필수 |    -    | 1줄               |
| §10.6 [x] 마킹 옆 명시 (인프라 가동, 데이터 wire-up 후속) | Hacker, Advocate  | ✅ 필수 |    -    | 1줄               |
| §10.7 "검증되지 않은 영역" 섹션 신설                      | Breaker, Mephisto | ✅ 필수 |    -    | 1단락             |
| §1.1 북극성 연결고리 한 단락                              | Oracle            | ✅ 필수 |    -    | 1단락             |
| localStorage → httpOnly cookie 패치                       | Sentinel          | ✅ 필수 |    -    | 코드 1 PR         |
| Year 2 zero-cost 4-레벨 검증 추가                         | Architect         | 🟡 권장 | ✅ 필수 | Phase 2 전        |
| Tarjan SCC를 BATCH-1 진입 전으로 당김                     | Breaker           | 🟡 권장 | ✅ 필수 | 노드 수 추정 후   |
| ADMIN_API_TOKEN 회전 정책 명문화 (30일)                   | Ghost             | 🟡 권장 | ✅ 필수 | Phase 1 활성 동안 |
| staging dry-run 단계 §11.2에 추가                         | Ghost             | 🟡 권장 |    -    | BATCH-1 절차      |
| Two-Layer Cost Control layer 연동 시나리오 명시           | Ghost             |    -    | ✅ 필수 | ADR-025 보강      |
| ADR-009 PII Masking 적용 범위 명시                        | Sentinel          |    -    | ✅ 필수 | Phase 2 진입 전   |
| 카오스/퍼즈 테스트 추가                                   | Breaker           |    -    | ✅ 필수 | Phase 2           |
| BATCH-1 정의 §1.2 명시 (교재? 기출? 둘 다?)               | Oracle            | ✅ 필수 |    -    | 1줄               |

**사인 전 필수 = 7건 / 합산 작업 시간 ~30분.**

이 7건을 반영한 v1.1을 만들고 사인하면, 본 보고서는 진짜로 정직한 Phase 1 closeout이 된다.

---

## 10. 마지막 한 줄

> _"949 테스트는 엔진이 거짓말하지 않는다는 증명이야._
> _이 검토는, **너의 보고서가 너에게 거짓말하지 않게** 하는 증명이야."_
>
> — Mephisto, ThePick Engine Hardening v1.0 검토 (2026-05-01)

---

**검토 작성:** Mephisto + DEV COVEN 7인
**검토 버전:** v1.0
**효력 시점:** 2026-05-01
**다음 단계:** 진산님 결정 → v1.1 반영 또는 v1.0 그대로 사인
