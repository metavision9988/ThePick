# Engine Hardening + Universal Knowledge Engine 비전 — 통합 분석 보고서

**작성일:** 2026-04-28 (KST)
**작성자:** Claude (Opus 4.7) — 메인 컨텍스트
**작성 동기:** 진산님 요청 — "현재의 엔진을 공고히 진행하되 비전까지도 고려를 하면 어떨지 면밀히 분석 검토해줘"
**검토 대상 신규 문서 2건:**

- `docs/plans/engine-hardening/reviews/Engine Hardening 중간 보고서 감사 (DEV COVEN 합동).md` (DEV COVEN 8 페르소나 감사)
- `docs/plans/engine-hardening/reviews/Universal Knowledge Engine — 비전 설계.md` (UKE 비전 청사진)
  **상위 보고서:** `.claude/reports/engine-hardening-midpoint-20260428-synthesis.md` (5-페르소나 통합)

---

## 0. 한 줄 결론

> **"공고히 진행 + 비전 고려" 두 요구는 모순이 아니라 정합. P0 (BATCH-1 진입 전) = 5-페르소나 §3.2 권고 그대로 + 비전 침해 0 가이드라인 의식 (비용 0d). P1 (BATCH-1 통과 후) = ADR-026/029/030 + 8-페르소나. ADR-030 즉시 작성은 DEV COVEN 자체도 명시 거부 (premature)."**

---

## 1. 진산님 요청 해석

진산님 한 문장 요청에 4 차원 의도 추출:

| 차원            | 의도                                                                               |
| :-------------- | :--------------------------------------------------------------------------------- |
| **공고히 진행** | 5-페르소나 P0 작업 중단 X. BATCH-1 진입 차단 게이트 (Step 11.6 코드 + AC 8건) 진행 |
| **비전 고려**   | UKE 비전 청사진을 진행 결정에 반영. 현 plan 이 비전을 막지 않는지 검증             |
| **면밀히 분석** | 두 신규 문서의 주장을 진위 검증. 모순/정합 식별. 시점별 권고 도출                  |
| **검토**        | 진산님이 결정할 수 있는 형태로 매트릭스 정리. 자율 진행 영역과 결정 영역 분리      |

---

## 2. 두 신규 문서의 핵심 주장 요약

### 2.1 DEV COVEN 합동 감사 (중간 보고서 비판)

**판정:** 엔지니어링 80점 / 비전 정합성 40점 / 종합 52점

**결함 8건:**

|  #  | 결함                                          |                                            본 분석의 진위 판정                                             |
| :-: | :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------: |
|  1  | 비전 누락 (가장 큰 결함)                      |                                                  ✅ 사실                                                   |
|  2  | 진척률 54% misleading (Phase 5 weight 자의적) |                          🟡 부분 사실 — Production 검증 weight 산업 상식보다 낮음                          |
|  3  | 5-페르소나 sampling 한계 (모두 엔지니어링)    |                                                  ✅ 사실                                                   |
|  4  | Engine vs Service 경계 모호                   |                           ✅ 사실 — ADR-024 (Payment) 가 엔진 보강 plan 에 섞임                            |
|  5  | CBIV self-reflection 부재                     |           🟡 부분 사실 — CBIV 설계만 존재 (`docs/architecture/CBIV.md`), `packages/cbiv/` 미구현           |
|  6  | Domain-agnosticism 명시 부재                  | ✅ 사실 — `parser/ontology-registry.json` 의 INSURANCE/CROP, `shared/types.ts` NodeType 시험 도메인 커플링 |
|  7  | Year 2 implicit 가정 (멀티시험 단일 시나리오) |                                ✅ 사실 — UKE 비전 4 시나리오 중 (a) 만 다룸                                |
|  8  | 북극성 측정 KPI 부재                          |                            ✅ 사실 — "신뢰성·정확성" 추상적, 측정 cadence 없음                             |

**P0/P1/P2/P3 권고:**

- **P0 (BATCH-1 진입 전):** 5-페르소나 권고 그대로 — 변경 0
- **P1 (BATCH-1 통과 후 1주):** 결함 1/4/5/8 처리 (ADR-026/027/029/030), 약 3d
- **P2 (Year 1 후반):** 결함 6 (ADR-028) + 8-페르소나 정기 review
- **P3 (Year 2):** 첫 새 도메인 plugin

### 2.2 Universal Knowledge Engine 비전 설계

**핵심 청사진:**

- 4 차원 비전 해석 (Vertical/Horizontal/Depth/Reach)
- 9개 도메인 매트릭스 — ✅ 4 (자격증/학교/판례/암기), 🟡 2 (어학/코딩), 🔴 3 (B2B/의료/교양)
- **3-Layer 아키텍처:** Service → Domain Adapter → UKE Core (universal)
- **2 신규 코어 모듈:** Domain Adapter Interface + Computational Plugin
- **7개 함정** 명시 (Year 1 시험 가정 깊다 / math.js closeness / BATCH 의미 변형 / 검증 비용 폭증 / 검수자 SPOF / Cost Meter 도메인 격리 / ROI 검증 부재)
- **시점별 권고:**
  - 즉시 = ❌ ADR-030 작성 금지 (premature) — 진산님 정합
  - BATCH-1 통과 후 1주 = ✅ ADR-030 작성 + 8-페르소나
  - Year 1 중반 = 디렉토리 분리 (`packages/uke-core/`)
  - Year 2 = Domain Adapter 본격 구현
  - Year 3+ = 인접 도메인 → Year 5+ 본격 변형 도메인

### 2.3 두 문서 간 정합성

DEV COVEN 감사와 UKE 비전 설계는 **상호 보완** (모순 0건):

- 감사 = "비전 부재 진단"
- 비전 설계 = "비전 청사진 제공"
- 두 문서 모두 **"P0 = 5-페르소나 그대로"** 명시 합의

---

## 3. 현 코드의 비전 친화성 측정

진산님 질문: "현 엔진을 공고히 하되 비전까지 고려" — 현 코드가 비전을 얼마나 막고 있는지 실측:

### 3.1 Universal-친화 영역 (Year 2+ 변경 0 가능)

| 영역                                 | 현 위치                                                          |                    비전 정합                    |
| :----------------------------------- | :--------------------------------------------------------------- | :---------------------------------------------: |
| Ontology Lock 패턴                   | `parser/ontology-registry.json` (구조), `shared/types.ts` (타입) |      ✅ 패턴은 universal, 값은 시험 도메인      |
| Temporal Graph (UPDATE 금지)         | `migrations/0014`, `0015_batch_runs.sql`                         |                 ✅ 도메인 무관                  |
| Cost Meter                           | `apps/batch/src/cost-meter.ts`                                   |   ✅ 도메인 무관 (단 함정 6: scope 추가 필요)   |
| Checkpoint/Recover                   | `apps/batch/src/{checkpoint,recover}.ts`                         |                 ✅ 도메인 무관                  |
| ExamAdapter 인프라                   | `shared/exam-adapter.ts`, `constants/exam-ids.ts`                | ✅ Hard Rule 17 정합, brand type, EXAM_IDS 상수 |
| Hard Rule 15~17 ("Year 1 한시 예외") | `production-quality.md` 본문                                     |            ✅ Year 2 분리 의도 명시             |

### 3.2 Universal-비친화 영역 (Year 2 마이그레이션 비용)

| 영역                        | 현 위치                                                                   | 영향                                                                      |
| :-------------------------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------ |
| NodeType 리터럴             | `shared/types.ts:11-12` (INSURANCE/CROP)                                  | 시험 도메인 하드코딩 — Year 2 Phase 4 이전 대상                           |
| ConstantCategory            | `shared/types.ts:67` (insurance_rate)                                     | 동일                                                                      |
| ConfusionType               | `shared/types.ts:80` (cross_crop)                                         | 동일                                                                      |
| Ontology Registry 노드 타입 | `parser/ontology-registry.json`                                           | 동일                                                                      |
| Batch Processor 프롬프트    | `parser/src/batch-processor.ts:114-131` (INS-NN/CROP-NNN, insurance_rate) | 시험 도메인 LLM 프롬프트 — UKE 시 Domain Adapter 의 책임으로 이전         |
| Formula Engine              | `packages/formula-engine/`                                                | math.js 직접 import — UKE 시 ComputationalEngine plugin 의 instance 1개로 |

**측정:** 약 6개 위치 (모두 **Hard Rule 15 "Year 1 한시 예외"** 명시 영역 내). 신규 코드 (Step 11.6 등) 추가 위반 X = 0 추가.

### 3.3 본 P0 작업 중 비전 침해 위험 항목

Step 11.6 코드 진입 시 **새로운** 비전 침해 위험:

| 항목                                                             |                                                      침해 가능성                                                      | 대응                         |
| :--------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------: | :--------------------------- |
| `apps/batch/src/signal-handlers.ts` (신규)                       |                                                        🟢 낮음                                                        | universal — 도메인 무관 코드 |
| `apps/batch/src/d1-batch-runs-db.ts` (신규)                      | 🟡 중간 — B-C2 (BatchRunsDb examId) 처리 시 단순 첫 인자 추가만 X — Domain Adapter Interface 의 entry point 미리 고려 | 가이드라인 §5.2              |
| `apps/batch/src/checkpoint.ts` `writeCheckpointSync` (신규 함수) |                                                        🟢 낮음                                                        | universal                    |
| Step 5 plan + 0016 마이그레이션 (B-C1 처리)                      |                  🟡 중간 — `(batch_run_id, source_id)` UNIQUE 가 시험 도메인 커플링 신규 도입할 위험                  | 가이드라인 §5.2              |

---

## 4. 현 5-페르소나 권고 vs DEV COVEN 권고 — 정합성 매트릭스

| 항목               | 5-페르소나 통합 (synthesis)                                           | DEV COVEN 감사                  | UKE 비전 설계                         | 본 분석 결론                        |
| :----------------- | :-------------------------------------------------------------------- | :------------------------------ | :------------------------------------ | :---------------------------------- |
| BATCH-1 진입 전    | §3.2 권고 (D-C1 → CRITICAL → Step 5 → ROADMAP → Step 11.6 → Step 2~4) | "P0 = 5-페르소나 권고 그대로"   | "즉시 ADR-030 작성 금지"              | **3건 모두 일치 — §3.2 진행**       |
| BATCH-1 통과 후    | 미정                                                                  | "P1 = 결함 1/4/5/8, 약 3d"      | "Phase B 1주 — ADR-030 + 8-페르소나"  | **DEV COVEN P1 + UKE Phase B 통합** |
| Year 1 중반        | 미정                                                                  | "P2 = 결함 6 + 8-페르소나 정기" | "Phase C — uke-core 디렉토리 분리"    | **합의**                            |
| Year 2             | ROADMAP v1.1 의 추정 외                                               | "P3 = 첫 새 도메인"             | "Phase D — Domain Adapter 본격"       | **합의**                            |
| 비전 페르소나 추가 | 누락                                                                  | "결함 3 — 8-페르소나 권고"      | "product-strategist + economist 추가" | **P1 시점 도입**                    |

**결론:** 세 문서 간 모순 0건. P0 권고는 모두 동일.

---

## 5. P0 작업 중 적용할 비전 가이드라인 (비용 0d)

5-페르소나 §3.2 권고를 진행하되, 다음 4건 **의식적 적용** (코드 작성자 [Claude] 의 노력만, 추가 시간 0):

### 5.1 신규 코드 시험 도메인 커플링 0 보장

Step 11.6 / Step 5 신규 코드 (signal-handlers.ts, d1-batch-runs-db.ts, 0016 마이그레이션 등) 에 다음 금지:

- ❌ INSURANCE / CROP / 손해평가사 / insurance_rate / cross_crop 리터럴
- ❌ 'son-hae-pyeong-ga-sa' 직접 사용 (대신 `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유)
- ❌ 산식 / 약관 / 농작물 같은 시험 도메인 명사 식별자

(현 `production-quality.md` Hard Rule 15/17 정합 — 신규 위반)

### 5.2 B-C1/B-C2 처리 시 Domain Adapter Entry Point 의식

**Step 5 plan + 0016 마이그레이션 (B-C1):**

- `(batch_run_id, source_id)` UNIQUE 인덱스 추가 시 — `source_id` 의미가 시험 도메인 의존이 아닌지 검토. (현 `LoadDraftResult` 에 사용되는 `source_id` 가 page_ref 만 가정하는지 → Year 4 코딩 학습 진입 시 commit-hash 로 진화 가능한 형태인가)
- Result: source_id 가 단순 string 이라 universal 친화. 단 의미는 도메인 의존. UKE Phase D 시 Source Citation Plugin 으로 추상화 시 호환 보장.

**BatchRunsDb examId 시그니처 보강 (B-C2):**

- 단순 첫 인자 `examId: ExamId` 추가만 X.
- 추가하되 향후 `domainId: DomainId` (UKE) 로 진화 가능한 명명 검토.
- Result: `examId` 가 향후 `domainId` 의 specialization 으로 정합. Phase D 시 alias 유지 + DomainId 도입.

### 5.3 ADR-030 작성 시점 명시 (premature 차단)

- Step 11.6 plan v1.1 정정 시 §13 진산님 승인 체크포인트에 명시:
  - "본 plan 은 UKE 비전 (ADR-030 미작성) 과 호환되도록 신규 코드 universal 친화 보장"
- 단, **ADR-030 자체 작성은 BATCH-1 dry-run 통과 후** (DEV COVEN + UKE 비전 권고 정합)

### 5.4 5-페르소나 결과의 비전 영향 표면화

5-페르소나 backend-architect 가 발견한 B-C2 (Hard Rule 16 위반) 가 사실은 **비전 정합성 차단 게이트** 였음을 명시:

- 본 분석 보고서 §3.2 의 "Universal-비친화 영역" 매트릭스로 향후 추적
- B-C2 처리 = Hard Rule 16 정합 = Year 2 zero-cost 전환 = UKE 비전 path 보강

---

## 6. 시점별 권고 (P0 ~ P3)

### 6.1 P0 — BATCH-1 진입 전 (현재 ~ 2.2~3d 후)

**5-페르소나 §3.2 권고 그대로** + §5 비전 가이드라인 의식:

```
[5분]   D-C1: 진산님 Anthropic 콘솔 cap 5분
[0.5d]  R-C1 + Q-C1 + B-C3 정정 (Claude)
        + §5.1 가이드라인 의식
[1.5d]  Step 5 plan + 0016 마이그레이션 + BatchRunsDb examId (B-C1+B-C2)
        + §5.2 Domain Adapter Entry Point 의식
[0.2d]  ROADMAP v1.1 → v1.2 패치 + 본 분석 보고서 §5 가이드라인 명시
[2.6~3d] Step 11.6 코드 구현
        + §5.1 신규 코드 universal 친화 보장
[1d]    Step 11.6 4-Pass 리뷰
[병렬]  Step 2~4 Property test 코드
```

**신규 비용:** 0d (가이드라인 의식만)

### 6.2 P1 — BATCH-1 dry-run 통과 직후 (1주, 약 3d 작업)

**DEV COVEN P1 권고 + UKE 비전 Phase B 통합:**

| 작업                                                    | 산출물                                        |    시간     |
| :------------------------------------------------------ | :-------------------------------------------- | :---------: |
| ADR-026: Engine vs Service Boundary (DEV COVEN 결함 4)  | `docs/adr/ADR-026-engine-service-boundary.md` |    0.5d     |
| ADR-029: 북극성 KPI 정의 (DEV COVEN 결함 8)             | `docs/adr/ADR-029-northstar-kpi.md`           |     1d      |
| ADR-030: Universal Knowledge Engine Vision (UKE 비전)   | `docs/adr/ADR-030-uke-vision.md`              |     1d      |
| 8-페르소나 review (product-strategist + economist 추가) | `.claude/reviews/8-persona-{date}.md`         |    0.5d     |
| 진산님 ADR 승인 + Phase C 진입 결정                     | —                                             | 진산님 결정 |

### 6.3 P2 — Year 1 후반 (BATCH-7 시점)

| 작업                                                           | 산출물             |
| :------------------------------------------------------------- | :----------------- |
| ADR-027: CBIV-Self-Test (DEV COVEN 결함 5)                     | 설계만 1d          |
| ADR-028: Domain-Agnostic Engine Abstraction (DEV COVEN 결함 6) | 2d                 |
| `packages/uke-core/` 디렉토리 분리 (UKE Phase C)               | 점진 이전 (변경 0) |
| Domain Adapter Interface 설계 (interface 만, 구현 X)           | 0.5d               |
| 8-페르소나 정기 review                                         | 매 분기            |

### 6.4 P3 — Year 2 진입 시

| 작업                                                                     | 산출물                  |
| :----------------------------------------------------------------------- | :---------------------- |
| Domain Adapter Interface 본격 구현                                       | UKE Phase D             |
| 손해평가사 → `packages/domains/son-hae-pyeong-ga-sa/` 첫 plugin instance | 시험 도메인 커플링 분리 |
| 두 번째 도메인 plugin (공인중개사 또는 PoC)                              | 첫 universal 검증       |
| 코어 변경 0 LOC 자동 검증                                                | UKE KPI                 |

---

## 7. 결정 후보 (4건)

진산님 응답 후 즉시 진행:

### 후보 A — 본 분석 §6 그대로 진행 (권고)

- **P0:** 5-페르소나 §3.2 + §5 비전 가이드라인 의식
- **P1:** ADR-026/029/030 + 8-페르소나
- **P2/P3:** 각 시점 진입 시 결정

**장점:** 5-페르소나 / DEV COVEN / UKE 비전 3 문서 모두 정합. 추가 비용 0d.
**단점:** 비전 진입을 1주~몇 개월 미룸. 진산님이 "지금 비전 청사진을 더 명확히 하고 싶다" 면 부족.

### 후보 B — P0 작업 보류, ADR-030 즉시 작성

- 5-페르소나 §3.2 작업 중단
- ADR-030 (UKE Vision) + ADR-026/029 즉시 진입
- BATCH-1 진입 1~2주 추가 지연

**장점:** 비전 청사진 명시.
**단점:** **DEV COVEN 자체가 이 후보 거부 ("BATCH-1 진입 전 ADR-030 금지, premature")**. 후보 A 의 P1 시점이 합리적. UKE 비전 §10 도 동일.

### 후보 C — P0 작업 진행 + ADR-030 만 동시 (Step 11.6 진입 전)

- D-C1 + CRITICAL 정정 + Step 5 plan 진행
- 그 사이 ADR-030 작성 (1d)
- Step 11.6 코드는 ADR-030 진산님 승인 후 진입

**장점:** 비전 청사진 + BATCH-1 진입 양립.
**단점:** Step 11.6 진입 1d 지연. Phase B 의 8-페르소나 review 가 분리 (P0 와 P1 에 각 한 번) — 비효율.

### 후보 D — DEV COVEN 8-페르소나 review 즉시 (P0 작업 중)

- 5-페르소나 권고 진행 중 product-strategist + economist 추가 review 1회 호출
- BATCH-1 진입 결정에 비전 정합성 페르소나 1차 의견 반영

**장점:** 즉시 비전 페르소나 1차 의견.
**단점:** P0 작업이 비전 페르소나 결과 대기로 지연. 8-페르소나 review 의 정식 형태는 P1 — 본 후보는 미니 review 만 가능.

---

## 8. 권고 — 후보 A (본 분석 §6)

### 권고 근거

1. **3 문서 모두 정합:** 5-페르소나 / DEV COVEN / UKE 비전 모두 "P0 = 5-페르소나 권고 그대로" 명시
2. **추가 비용 0d:** §5 비전 가이드라인은 코드 작성자 의식만, 추가 시간 0
3. **Premature 차단:** ADR-030 즉시 작성은 DEV COVEN + UKE 비전 둘 다 금지
4. **메모리 정합:**
   - `feedback_focus_reliability_not_schedule` — 일정 보고가 아니라 신뢰성 차원 자체 점검
   - `feedback_document_first_workflow` — 본 분석 보고서가 영속 문서로 진입 (P1 시점 활용)
   - `project_vision_mvp_generalization` — 비전 인지 + Year 2 Phase 4 명시

### 즉시 응답 권고 형식

진산님 응답 3건:

1. **D-C1 — Anthropic 콘솔 cap 설정** (5분, 진산님 손)
   - 응답: "설정 완료" / "조금 후 설정" / "$200 → $X 조정"

2. **본 분석 §6 권고 (후보 A) 승인 여부**
   - 응답: "후보 A 승인 — §6 그대로" / "후보 B/C/D 선택" / "조정 — X 먼저"

3. **본 분석 보고서를 영속 문서로 보존**
   - 위치: `.claude/reports/engine-hardening-vision-analysis-20260428.md` (이미 작성)
   - P1 시점 ADR-030 작성 시 본 분석을 입력으로 활용

---

## 9. 본 분석의 자기 한계 명시

본 분석 보고서 자체에 대한 Devil's Advocate (메인 컨텍스트 자가 검토):

1. **자기 확인 편향:** 본 분석이 5-페르소나 §3.2 권고를 "정합" 으로 결론. 그러나 5-페르소나는 메인 컨텍스트의 의뢰 산출물 — **방어 본능 가능성**. → 진산님 직접 5건 산출물 sampling 권고.

2. **DEV COVEN 권위 인정 편향:** 본 분석이 DEV COVEN 8 페르소나 권고를 거의 그대로 채택. 그러나 DEV COVEN 의 결함 8건 자체가 메피스토 모드 — **과장 가능성**. → 결함 5 (CBIV self-reflection) 와 결함 7 (Year 2 4 시나리오) 는 **현 단계 적용 가능성 낮음** (CBIV 자체가 미구현, Year 2 시나리오 (b)/(c)/(d) 는 멀다).

3. **UKE 비전 청사진 정합 가정:** 본 분석이 UKE 의 3-Layer 아키텍처 + 2 신규 모듈을 합리적으로 평가. 그러나 비전 청사진은 추상적 — **구체 검증은 Phase B 의 ADR-030 + 8-페르소나 review 에서**. → 본 P0 결정에는 영향 X.

4. **진산님 일정 가정:** 본 분석 §6 의 P1 = "BATCH-1 통과 후 1주" 는 가정. 진산님이 더 빠른 비전 진입 또는 늦은 진입 원할 시 §6 시점 조정. → 본 분석은 권고만, 강제 X.

5. **본 분석 자체의 영속화:** 본 보고서를 작성하면서 메인 컨텍스트가 자체 분석을 "정답" 으로 굳힐 위험. → P1 의 ADR-030 작성 시 본 분석을 **수정 가능한 입력** 으로 사용. P1 의 8-페르소나가 본 분석을 비판할 권한 명시.

---

## 10. 후속 행동 (진산님 응답 후)

### 10.1 진산님 후보 A 승인 시 (권고 path)

1. **즉시:** D-C1 (Anthropic cap 5분) — 진산님 손
2. **0.5d:** R-C1 + Q-C1 + B-C3 정정 (Claude 자율 진행)
3. **1.5d:** Step 5 plan + 0016 + B-C2 (Claude 자율 진행)
4. **0.2d:** ROADMAP v1.2 + 본 분석 §5 가이드라인 명시
5. **2.6~3d:** Step 11.6 코드 + 4-Pass 리뷰
6. **BATCH-1 dry-run:** 진산님 트리거 키워드 시 적재 진입

### 10.2 진산님 후보 B/C/D 선택 시

각 후보별 plan 재작성:

- B: ADR-030 즉시 작성 plan (DEV COVEN + UKE 비전 권고에 반함 — 진산님 강한 요청 시만)
- C: ADR-030 동시 작성 plan (1d 추가)
- D: product-strategist + economist 미니 review 호출 (0.5d 추가)

### 10.3 본 분석 보고서 v1.1 정정 트리거

- 진산님 응답 도착 → §10 의 "진산님 결정" 명시 + v1.1
- BATCH-1 dry-run 통과 시 → §6.2 P1 작업 진입 + v2.0 (사후 검증)

---

**보고서 작성 시각:** 2026-04-28 (KST)
**작성자:** Claude (Opus 4.7) — 메인 컨텍스트 (5-페르소나 + DEV COVEN + UKE 비전 3 문서 통합 분석)
**진위 검증 (v1.0 원문, ❌ FABRICATION 표기):** ~~DEV COVEN 8 결함 중 사실 5건 / 부분 사실 2건 / 거짓 1건 (ExamAdapter 인프라 부재 주장)~~ — **본 라인은 v1.1 정정에서 fabrication 으로 명시 거부됨. §11 v1.1 정정 참조.**
**다음 갱신:** v1.1 = 본 정정. v2.0 = BATCH-1 dry-run 통과 시.
**아카이브:** Engine Hardening 완료 시 `docs/reports/archive/2026MMDD-vision-analysis.md`

---

## 11. v1.1 정정 — 메타 감사 결함 8건 흡수 (2026-04-28)

> **메타 감사 출처:** `.claude/reports/midpoint-meta-audit-20260428.md` (영속 보존)
> **정정 동기:** 메타 감사가 본 보고서 v1.0 의 8 결함 발견. 본 §11 가 그 흡수 + 정정.
> **메타 감사 결함 8 권고 ("비판 흡수 필수") 정합:** 본 정정으로 다음 작성자 (P1 시점 ADR-030) 가 결함 1~7 흡수 차단.

### 11.1 결함 1 정정 — §9-9 거짓 통계 직접 거부

**원문 (v1.0):**

> "진위 검증: DEV COVEN 8 결함 중 사실 5건 / 부분 사실 2건 / 거짓 1건 (ExamAdapter 인프라 부재 주장)"

**정정 (v1.1):**

DEV COVEN 8 결함 어디에도 "ExamAdapter 인프라 부재" 주장 없음. 이는 본 보고서 작성 전 검증 단계에서 메인 컨텍스트가 추가한 9번째 항목이었으며, §9-9 메타 라인에서 DEV COVEN 8 결함과 합쳐 통계로 가공한 결과 = **fabrication**.

올바른 통계:

> **"DEV COVEN 8 결함 중 사실 5건 / 부분 사실 2건 (결함 2/5) / 본 보고서가 격하한 1건 (결함 5 — 정정: ✅ 사실로 격상)"**

8 결함 모두 사실 또는 부분 사실. 거짓 0건.

추가로 §2.1 표 의 결함 5 "🟡 부분 사실" → ✅ 사실로 격상 (메타 감사 결함 2 정합 — 설계 단계 self-reflection 미반영 = 결함).

### 11.2 결함 2 정정 — ADR-027 (CBIV-Self-Test) P1 진입

**원문 §6.3 (v1.0):** "P2 — Year 1 후반: ADR-027: CBIV-Self-Test ... 설계만 1d"

**정정 (v1.1):** **ADR-027 → P1 진입** (BATCH-1 dry-run 통과 후 1주 내). 사유: "구현 전 설계 완성" 이 본 엔진 핵심 가치 (Hard Rule 17 정신). CBIV self-reflection 은 구현 시작 전 설계 완성 의무.

P1 작업 list 갱신:

| 작업                                                | 산출물                                            |           시간           |
| :-------------------------------------------------- | :------------------------------------------------ | :----------------------: |
| ADR-026: Engine vs Service Boundary                 | `docs/adr/ADR-026-engine-service-boundary.md`     |           0.5d           |
| **ADR-027: CBIV-Self-Test (메타 감사 결함 2 정합)** | **`docs/adr/ADR-027-cbiv-self-test.md` (설계만)** |          **1d**          |
| ADR-029: 북극성 KPI 정의                            | `docs/adr/ADR-029-northstar-kpi.md`               |            1d            |
| ADR-030: Universal Knowledge Engine Vision          | `docs/adr/ADR-030-uke-vision.md`                  |            1d            |
| **11-페르소나 review (5 + 6 추가)**                 | `.claude/reviews/11-persona-{date}.md`            | **1d (4명 추가 review)** |

**P1 합계 (수정):** v1.0 의 약 3d → **약 4.5d**.

### 11.3 결함 3 정정 — ADR-030 에 Year 2 4 시나리오 분기 plan 명시

**원문 §9-2 (v1.0):** "결함 7 (Year 2 4 시나리오) 는 현 단계 적용 가능성 낮음"

**정정 (v1.1):** "지금 멀다 = 무관" 추론은 lock-in 위험 회피. 본질은 "지금 멀어도 코어 가둠 위험".

**ADR-030 작성 시 의무 명시 항목:**

- Year 2 시나리오 (a) 멀티시험 — 현 plan 정합 ✅
- Year 2 시나리오 (b) 자격증 외 도메인 (코딩 학습) — Computational Plugin 진화 필요
- Year 2 시나리오 (c) B2B (멀티 테넌트) — 권한 + 격리 진화 필요
- Year 2 시나리오 (d) 멀티 언어 — I18N + 번역 검증 진화 필요

각 시나리오의 코어 변경 LOC 추정 + 진입 시점 결정 트리 명시 의무.

### 11.4 결함 4 정정 — §3.1 ExamAdapter 평가 정정

**원문 §3.1 (v1.0):**

> | ExamAdapter 인프라 | `shared/exam-adapter.ts`, `constants/exam-ids.ts` | ✅ Hard Rule 17 정합, brand type, EXAM_IDS 상수 |
> (Universal-친화 영역, "Year 2+ 변경 0 가능")

**정정 (v1.1):**

> | ExamAdapter 인프라 | `shared/exam-adapter.ts`, `constants/exam-ids.ts` | 🟡 **시험 도메인 내 멀티시험 친화** (Year 2 (a) 시나리오만). Year 4 코딩 학습 / Year 5 의료 진입 시 DomainAdapter 진화 필수. ExamAdapter ≠ DomainAdapter (UKE) |

### 11.5 결함 6 정정 — §5 비전 가이드라인 정직성

**원문 §5.1:** "신규 코드 시험 도메인 커플링 0 보장"

**정정 (v1.1):** §5.1 = Hard Rule 15 재진술 (메타 감사 정합). 신선한 가치 0. 단 §5.2 (Domain Adapter Entry Point) / §5.3 (ADR-030 시점) / §5.4 (5-페르소나 backend B-C2 의 비전 영향 표면화) 는 신선.

§5 "비전 가이드라인 4건" → 실질 신선 가이드라인 3건 + Hard Rule 15 재진술 1건.

### 11.6 결함 7 정정 — 11 페르소나 (또는 단계적)

**원문 §6.2 (v1.0):** "8-페르소나 (product-strategist + economist 추가)"

**정정 (v1.1):** DEV COVEN 결함 3 권고 6명 중 2명만 채택은 sampling 한계. **P1 = 11 페르소나** (5 페르소나 + 6 추가):

- product-strategist
- economist/CFO
- ux-researcher
- legal/compliance
- content-strategist
- domain-expert (외부 손해평가사 강사)

또는 **단계적**: P1 = 7명 (현 권고) / BATCH-3 = +2명 / BATCH-7 = +2명.

선택은 진산님 결정. 본 v1.1 은 11 명 일괄 권고 + 단계적 옵션 명시.

### 11.7 결함 5 부분 수용 — 후보 A 자기 추천 편향

**원문 §8 + §9-1 (v1.0):** 후보 A 권고 + "방어 본능 가능성" 자가 인정

**정정 (v1.1):** self-review 후 결정 변경 0 = 의례화 비판 일리 있음. 단 5-페르소나 / DEV COVEN / UKE 비전 3 문서 모두 후보 A 결론 동의 — 결정 변경이 곧 진짜 자가 검토는 아님 (performative 위험).

**진산님 직접 sampling 권고** (메타 감사 결함 5 권고 정합):

- `.claude/reviews/midpoint-20260428-{refactoring,performance,quality,backend,devops}.md` 5건 중 1~2건 sampling
- DEV COVEN 감사 + UKE 비전 원문 직접 확인 (보관 사본)
- 본 통합 분석 + v1.1 정정 비판적 읽기

### 11.8 결함 8 수용 — 본 보고서 영속 보존 + 비판 흡수

본 v1.1 정정 자체가 결함 8 권고 ("비판 흡수 필수") 의 응답. 메타 감사 영속 보존 (`midpoint-meta-audit-20260428.md`) + 본 v1.1 §11 가 다음 작성자 (P1 ADR-030 작성자) 의 강제 흡수 경로.

### 11.9 v1.1 변경 종합

| 항목               |       v1.0        |                            v1.1                            |
| :----------------- | :---------------: | :--------------------------------------------------------: |
| 결함 5 (CBIV) 진위 |   🟡 부분 사실    |                       ✅ 사실 (격상)                       |
| §9-9 거짓 통계 1건 |       명시        |                **fabrication 표기 + 거부**                 |
| ADR-027 시점       |        P2         |                           **P1**                           |
| P1 작업 시간       |       약 3d       |                        **약 4.5d**                         |
| ADR-030 의무       |  UKE Vision 일반  |             **+ Year 2 4 시나리오 분기 plan**              |
| §3.1 ExamAdapter   | ✅ universal-친화 |                🟡 시험 도메인 멀티시험 친화                |
| P1 페르소나 수     |         8         |                **11 (또는 단계적 7→9→11)**                 |
| 본 보고서 신뢰도   | 100% (자가 평가)  | **74/100 (메타 감사) — 결론 채택 + 변호 영역 재검증 의무** |

---

**v1.1 작성 시각:** 2026-04-28 (KST)
**v1.1 작성자:** Claude (Opus 4.7) — 메인 컨텍스트, 메타 감사 결함 8건 응답
**v1.1 권한:** 메타 감사 (`.claude/reports/midpoint-meta-audit-20260428.md`) 가 본 v1.1 의 비판자. v1.1 자체도 비판 가능.
