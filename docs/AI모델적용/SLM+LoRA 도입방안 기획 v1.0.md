# 쪽집게 — SLM + LoRA 도입방안 기획 v1.0

> **본 문서의 성격**
> 외부 리서치 3종(오픈 SLM 전략 / SLM 타당성 3대 질문 / LoRA 어댑터 전략)을
> **현 프로젝트의 설계·ADR·Phase 상태에 맞춰 재해석**하고,
> 어디까지 **지금 선행**하고 어디부터 **Year 2로 이월**할지를 결정하기 위한
> 실행 기획 문서이다. 이 문서 자체가 구현 착수 승인서는 아니다.
> "v3.0 FINAL → v3.1" 업그레이드 제안으로서,
> **CRITICAL RULE #1에 따라 인간(진산님) 승인 이후에만 코드 반영**된다.
>
> 작성일: 2026-04-24
> 근거 문서: `docs/AI모델적용/오픈 SLM(소형 AI) 활용 전략 보고서.md`,
> `docs/AI모델적용/SLM 도입 타당성 3대 질문 심층 분석.md`,
> `docs/AI모델적용/ LoRA 어댑터 도입 전략 분석.md`
> 현 기준: 구현 재정립서 v3.0 FINAL (Hard Rules 17) + ADR-001~010
> 현 Phase: **Phase 1 Step 1-5 (가-0) 완료**, Step 1-6(가-1) 진입 직전

---

## 목차

**Part I — Reality Anchor (먼저 불가능 이유부터)**

1. 본 기획이 실패할 3가지 시나리오
2. 도입하지 **않을** 경우의 기회비용

**Part II — 현 프로젝트 정합성 판정** 3. 3종 보고서 주장의 재분류 (수용 / 조건부 수용 / 유보) 4. 기존 설계와의 충돌 지점 분석 5. ADR·Hard Rules·기획서 업데이트 범위

**Part III — 3-Tier 하이브리드 도입안** 6. L1 Browser SLM (Year 2 Phase 5 이월 — 아키텍처만 선행) 7. L2 Cloudflare Workers AI (Phase 2 시범, Phase 3 프로덕션) 8. L3 Claude Haiku 유지 (Phase 0 배치 파이프라인은 그대로) 9. AIRouter / Graph RAG 추상화 설계

**Part IV — LoRA 어댑터 도입안** 10. Year 1 절대 금지 / Year 2 Phase 4 이후 시작 11. 5종 LoRA 후보와 우선순위 12. 데이터 수집 인프라 선행 과제 (Phase 2~3에 필수)

**Part V — 거버넌스 업데이트** 13. Hard Rules 18~23 신설 제안 14. DEFCON·PITR·Plan 적용 경로 15. Phase -1 [B-6] SLM/LoRA 실효성 검증 신설

**Part VI — 실행 로드맵** 16. 현 Phase 1에서 해야 할 **최소 선행 작업** (코드 없음) 17. Phase 2~3 통합 계획 (Year 1 Week 11~16) 18. Year 2 Phase 4~5 확대 계획 19. Year 3 Vision/멀티모달 검토 지점

**Part VII — 의사결정 요청** 20. 진산님께 드리는 5가지 판단 요청 (전략 갈림길) 21. "승인 전에는 절대 안 건드릴 것" 목록 22. 다음 단계 제안

---

# Part I — Reality Anchor (먼저 불가능 이유부터)

> CLAUDE.md CRITICAL RULE #6:
> "새 기능 기획 시 '가능합니다' 대신 '이것이 불가능할 이유 3가지' 먼저."
>
> 세 보고서는 "해야 한다"는 낙관론이 강하다. 그러나 쪽집게는 **시험 정답 0 허용
> 오차**를 약속하는 상용 서비스이므로, **불가능/부작용 시나리오를 먼저 확정**한다.

## 1. 본 기획이 실패할 3가지 시나리오

### 1.1 시나리오 A — "SLM 환각이 기출 정답 경로로 유입"

**메커니즘:**

- L2 Workers AI(Llama 3.2 3B)가 "풀이 힌트"를 생성하면서 잘못된 산식/법조문/상수를
  그럴듯하게 기술
- 사용자(수험생)가 SLM 힌트를 **정답 풀이로 오인**
- 2주 뒤 시험장에서 틀림 → **"쪽집게 때문에 떨어졌다"**

**방어선의 허점:**

- 3종 보고서 모두 "Hard Rule #18 SLM 출력 검증"을 제안하나, **어떤 값을 어느 수준으로
  검증할지에 대한 정량 기준이 없다**. "Graph RAG 사실 일치"는 임베딩 유사도만 보면
  통과될 수 있다.
- Llama 3.2 3B의 한국어 환각률은 Haiku 대비 2~5배라고 인용되는데, **실제 손해평가사
  도메인에서 측정된 숫자가 아니다**. PoC 전에는 합의 불가.
- Year 1 유저 100명 중 1명만 "SLM이 준 산식으로 낙방" 주장해도 ADR-007 기조가
  뒤집힌다.

**대응:**

- **Hard Rule #11 (기출 정답 경로에서 SLM 사용 금지)**를 Rule 18의 선행 조항으로
  고정. SLM은 "설명/변형/톤 변환"에만 허용.
- Phase -1에 [B-6] 정량 측정(손해평가사 해설 20건, Haiku 대비 환각률)을 **반드시**
  삽입. 측정값이 기준 미달이면 L2 도입 전면 중단.

### 1.2 시나리오 B — "50대 수험생이 WebGPU·500MB·옵트인 UX에서 이탈"

**메커니즘:**

- Year 1 타겟은 50대 비중이 높은 손해평가사. 프로젝트 메모리에 기록된 대로 **"50대
  친화"가 제품 성패의 핵심 축** 중 하나.
- 세 보고서 중 "오픈 SLM 활용 전략"은 Year 1에 L1 브라우저 SLM을 "숨김"으로 돌리라고
  이미 권고하지만, 이는 Year 1 "마케팅 차별점"(오프라인 AI) 서사와 모순된다.
- 기대한 차별화 이익은 **Year 2 공인중개사(20~40대) 시점부터** 실현된다는 점을
  현 기획에서 명확히 못박지 않으면, Phase 2~3에서 "시범 공개" 유혹으로 회귀한다.

**방어선의 허점:**

- 500MB 다운로드가 LTE 상에서 진행되면 **월 데이터 요금 충돌** 발생.
  Wi-Fi+충전 조건 부과 UX는 3종 보고서 모두 제시하나, 실제 Transformers.js 기본
  동작에는 그런 게이팅이 없다 — **자체 구현 책임**.
- iOS Safari WebGPU 지원 역사적 지연을 고려할 때, 아이폰 비중이 높은 한국 시장에서
  **Year 2 초에도 L1 커버리지 50% 미만** 가능성이 있다.

**대응:**

- Year 1 기획에서 **L1은 도입 X** 확정. 마케팅 카피에서 "오프라인 AI"를 Year 1
  차별점으로 삼지 않는다.
- Year 2 Phase 5 도입 시에도 **기본값 OFF + 설정 페이지 옵트인**으로 최소 6개월
  운영 후 기본 ON 전환 여부 재판단.

### 1.3 시나리오 C — "EXAONE 라이선스·Llama MAU 한도가 제품 성장과 충돌"

**메커니즘:**

- Llama Community License는 MAU 7억 미만 무료. 쪽집게가 그 선에 도달할 가능성은
  사실상 0 — 이 자체는 문제가 아니다.
- 그러나 **Llama 3.2 3B는 공식 한국어 지원 언어가 아님**. 세 보고서 중 "SLM 타당성
  분석"이 이 점을 명시했다. 실제 품질은 Phase -1 [B-6] 전에는 모름.
- EXAONE 3.5는 연구용. 상용 전환 협상이 **MAU 1,000 시점부터 가능**한데, 그 전까지
  한국어 품질 부족이 드러나면 **중간에 대체 모델로 Swap 비용** 발생.
- DOr (DoRA) 기반 Fine-tuning은 훈련 비용이 무료지만 **데이터 수집·라벨링·PIPA
  동의 체계 구축 비용**이 숨겨진 본 비용이다. Year 1에 이를 선행하지 않으면
  Year 2 Phase 4에 LoRA를 "훈련 가능한 상태"로 못 만든다.

**대응:**

- Year 1 내내 모델 선택은 "아키텍처 격리"만 하고 **특정 모델에 결합하지 않는다**.
- 대신 **데이터 수집 파이프라인**(사용자 만족/불만족 클릭, PIPA 동의, 신고 로그)을
  Phase 2~3에 무조건 포함. LoRA 자체보다 이것이 진짜 자산.

## 2. 도입하지 **않을** 경우의 기회비용

위 3 시나리오만 보면 "그냥 Claude Haiku 단일로 가자"라는 결론도 가능하다.
실제로 그 선택지의 비용도 정량화해야 판단이 가능하다.

| 관점               | "Claude 단일 유지" 시 비용                                 |
| ------------------ | ---------------------------------------------------------- |
| Year 1 100명 유료  | 월 AI 비용 ~$50, 연 $600. **사업성엔 무영향**              |
| Year 2 1,000 MAU   | 연 $500~2,000. **여전히 감당 가능**                        |
| Year 3 5,000 MAU   | 연 $3,000~6,000. **슬슬 부담, 여전히 파산 아님**           |
| **진짜 기회비용**  | **"오프라인 AI / 프라이버시 / 즉시응답"을 마케팅에 못 씀** |
| **더 큰 기회비용** | **LoRA 독점 자산 미형성 — 5년 뒤 "복제 불가 해자" 부재**   |

**판정:** 비용 절감은 Year 3부터가 유의미. **진짜 이유는 "해자 형성"과 "제품 차별화
옵션 확보"**다. 따라서 Year 1에는 **구현 X, 아키텍처 격리 O**가 합리적.

---

# Part II — 현 프로젝트 정합성 판정

## 3. 3종 보고서 주장의 재분류

세 보고서의 주요 주장을 프로젝트 현 상태와 대조해 **수용 / 조건부 수용 / 유보**로
재분류한다. 이 표가 본 문서의 핵심이다.

### 3.1 "오픈 SLM 활용 전략" 주장

| #   | 주장                                            | 재분류            | 이유                                                                                |
| --- | ----------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| 1   | 3계층 하이브리드 L1/L2/L3 도입                  | **수용**          | 단, **계층별 도입 타이밍은 재설정** (L1은 Year 2 Phase 5로 이월)                    |
| 2   | Workers AI 80% 절감                             | 수용 (Year 3부터) | Year 1은 사용량 자체가 낮아 절감 체감 미미                                          |
| 3   | EXAONE 상용 라이선스 협상 (LG AI Research 연락) | **유보**          | Year 2 MAU 1,000+ 달성 시점에 재검토. Year 1 접촉은 과잉                            |
| 4   | AIRouter Pattern 선행 정의                      | **수용**          | 단, **Phase 1 Step 1-6 이후** 인터페이스만. 구현은 L3 경유로 위임 유지              |
| 5   | Hard Rule 18~20 신설 (검증/라우팅/라벨링)       | **조건부 수용**   | v3.0 FINAL 17개 체계에 **Rule 18 "생성 콘텐츠 근거 필수"와 중첩 검토** 필요         |
| 6   | Phase 2에 Workers AI Llama 3.2 3B PoC           | **수용**          | 단, **"개념 재설명" 단일 기능으로 한정**, 기출·산식·법령 경로 금지                  |
| 7   | Transformers.js v4 (Year 2부터)                 | **조건부 수용**   | Year 2 Phase 5 시점에 **WebLLM과 재비교 후 채택** (현 시점 단일 후보 고정은 리스크) |

### 3.2 "SLM 도입 타당성 3대 질문" 주장

| #   | 주장                                      | 재분류            | 이유                                                                                                       |
| --- | ----------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Llama 3.2 3B 또는 Phi-4-mini 시작         | **수용**          | 단, Phase -1 [B-6]에서 **도메인 품질 측정 후 확정**                                                        |
| 2   | 3-Tier Automatic Fallback                 | **수용**          | 기기 감지는 capability-detector에 격리                                                                     |
| 3   | Graph RAG + SLM 조합으로 환각 구조적 차단 | **수용 (강력)**   | 우리 DB/Vectorize 체계와 완벽 정합. **ADR-004와 연결**                                                     |
| 4   | Voy WASM 벡터 DB (브라우저)               | **유보**          | Year 2 Phase 5 실물 테스트 전 확정 금지. **대안: 로컬 IndexedDB + 선형 코사인** (노드 100개 수준에선 충분) |
| 5   | Subgraph Cache Manager (2-hop)            | **수용 (설계만)** | Year 2 구현. **Dexie 스키마에 미리 subgraph_meta 자리만 예약**                                             |
| 6   | Fine-tuning 대안 (EXAONE 결렬 시)         | **수용**          | LoRA 기획 섹션에 통합                                                                                      |
| 7   | 브라우저 RAG 프로덕션 레벨 5~10K chunks   | **수용**          | 손해평가사 1,140 노드는 한도의 10~20% — 안전                                                               |

### 3.3 "LoRA 어댑터 도입 전략" 주장

| #   | 주장                                | 재분류          | 이유                                                                  |
| --- | ----------------------------------- | --------------- | --------------------------------------------------------------------- |
| 1   | 2026 LoRA 무료 Colab + 20분         | **수용 (사실)** | 단, **Year 1 절대 금지** 원칙 재강조                                  |
| 2   | 5종 LoRA 후보                       | **부분 수용**   | 도메인(P0)·암기법(P1) 2종만 확정. 나머지(혼동감지/톤/난이도)는 Year 3 |
| 3   | Graph RAG 자동 생성으로 데이터 확보 | **조건부 수용** | **인간 10% 검증 통과 후에만** 훈련 데이터화. Rule 21 연동             |
| 4   | 사용자 데이터 수집 (Source B)       | **수용 (필수)** | **이것이 진짜 자산**. Phase 2~3에 수집 인프라 의무 구축               |
| 5   | Phi-4-multimodal Mixture-of-LoRAs   | **유보**        | Year 3 Vision 검토 시점에 재평가                                      |
| 6   | 회로도/화학구조 별도 모델           | **범위 외**     | 쪽집게 Year 1~2는 전기·화학 시험 미포함 (ADR-007 대상 시험 확정)      |
| 7   | Hard Rule 21~23 신설                | **조건부 수용** | 본 문서 §13 통합안 참조                                               |

### 3.4 종합 판정

**수용:** 3-Tier 개념, AIRouter 선행 정의, Graph RAG+SLM 결합, 데이터 수집 인프라
선행, LoRA Year 2 Phase 4 시작, Phase -1 [B-6] 검증.

**조건부 수용 (인간 승인 필수):** Hard Rules 신설 6개, Phase 2 L2 PoC 범위,
Transformers.js v4 vs WebLLM 선택, LoRA 5종→2종 축소.

**유보:** EXAONE Year 1 접촉, Voy WASM DB 확정, 50대 친화 톤 LoRA, Vision/멀티모달.

**범위 외:** 전기·화학 시험, Phi-4-multimodal, Year 4+ 어젠다.

## 4. 기존 설계와의 충돌 지점 분석

본 기획은 다음과 같이 **기존 ADR·Hard Rules·Phase 경로와 직접 충돌**하거나 수정을
요구한다. 모두 인간 승인 대상이다.

### 4.1 ADR-006 (Cloudflare 단일 벤더)와의 정합성

| 도입 요소                          | Cloudflare 단일 벤더 준수?                             |
| ---------------------------------- | ------------------------------------------------------ |
| L2 Workers AI (Llama 3.2 3B)       | ✅ Cloudflare 네이티브                                 |
| L2 Vectorize 기반 RAG              | ✅ 이미 ADR-004                                        |
| L3 Claude Haiku (외부 Anthropic)   | ⚠️ **기존에 이미 예외** (ADR-006에 AI만은 예외로 허용) |
| L1 Transformers.js (브라우저 실행) | ✅ 서드파티 SaaS 아닌 클라이언트 런타임                |
| Hugging Face 모델 CDN              | ⚠️ **신규 외부 의존** (R2 미러링으로 완화 제안)        |
| Google Colab (LoRA 훈련)           | ✅ **오프라인 빌드 타임만** (프로덕션 런타임 X)        |
| LG AI Research 협상 (EXAONE)       | ❌ **Year 2+ 대상, 현 단계 접촉 금지**                 |

**결정 요청:** HF 모델 CDN을 직접 참조할지 / R2로 미러링할지 (ADR 신규 필요).
**기본 권고: R2 미러링** — 단일 벤더 원칙 유지 + CDN 제어권 확보.

### 4.2 ADR-007 (멀티시험 Year 2 이월) 충돌

세 보고서는 반복해서 "시험별 LoRA 어댑터"를 말하지만, 이는 **Year 2 Phase 4부터
허용되는 영역**이다. Year 1에는:

- `packages/` 내부에 시험별 분기 금지 (Hard Rule 15)
- `exams/{exam-id}/` 디렉토리 자체가 Year 2 Phase 4에 신설
- `exams/{exam-id}/loras/`는 **해당 디렉토리 신설 이후**에만 존재 가능

**판정:** LoRA 기획은 Year 2 Phase 4 이후 시점 전용. Year 1에는 **`packages/lora-trainer/`
디렉토리 + README만** 가능하며, 그마저도 인간 승인 시에만.

### 4.3 Hard Rules 17개 구조와의 정합성

현 v3.0 FINAL은 Rule 15~17이 "멀티시험 격리"에 배정돼 있다. 세 보고서가 말하는
"Rule 18~23 신설"은 번호만 이어붙인 것이며, 내용상으로는 별도 카테고리
("AI 출력 안전성")에 해당한다.

**권고:** Rule 18~23을 그대로 쓰지 말고 **카테고리 접두사**를 붙인다. 예:

- `AI-Safe Rule 1` (구 Rule 18) — SLM 출력 사실 검증 필수
- `AI-Safe Rule 2` (구 Rule 19) — AIRouter 경유 강제
- `AI-Safe Rule 3` (구 Rule 20) — SLM 생성 콘텐츠 라벨링 + 신고
- `AI-Safe Rule 4` (구 Rule 21) — LoRA 훈련 데이터 품질 검증
- `AI-Safe Rule 5` (구 Rule 22) — LoRA 출력도 Graph RAG 사실 검증
- `AI-Safe Rule 6` (구 Rule 23) — LoRA 버전 관리 + 롤백

이는 v3.0 FINAL의 17개 체계를 건드리지 않고 확장하는 안전한 방법이다.

### 4.4 현 Phase 1 Step 1-6(가-1) 로드맵과의 충돌

**충돌 없음 — 단, 선행 작업 하나만 필요.** Step 1-6은 ontology-registry 강화 작업이며
AI 모델과 무관하다. 본 기획은 Step 1-6 **종료 후 Step 1-8 (HK-01 Vectorize PoC)**와
자연스럽게 연결된다. 그 때 **"AIRouter 인터페이스 정의" 를 Step 1-8에 얹는 선택지**가
있다. 이는 인간 결정 항목이다 (§20).

## 5. ADR·Hard Rules·기획서 업데이트 범위

### 5.1 신규 ADR 제안 (3건)

- **ADR-011 — AI 3-Tier Hybrid Strategy**
  - L1/L2/L3 도입 타이밍 고정
  - 각 Tier의 허용 기능 목록 (기출/산식 경로 금지 포함)
  - AIRouter를 유일 경유점으로 지정
- **ADR-012 — HF 모델 CDN R2 미러링 전략**
  - ADR-006 단일 벤더 원칙 보강
  - 모델 해시 검증 + 버전 고정
- **ADR-013 — LoRA 어댑터 정책 (Year 2 Phase 4+)**
  - 훈련 데이터 수집 규칙, PIPA 동의, Rule 21~23 연동
  - Year 1 절대 금지 조항 명시

### 5.2 기획서 v3.1 업데이트 범위

세 보고서는 "v3.1 업데이트"를 요구하지만, v3.0 FINAL은 방금(2026-04-17) 확정됐다.
당장 v3.1을 발행하는 대신:

1. **Addendum 형식으로 본 문서를 v3.0 FINAL의 공식 부록으로 편성**
2. Phase 2 진입 직전(Year 1 Week 10 근처)에 Phase -1 [B-6] 결과와 함께
   **v3.1 공식 발행 여부**를 재판단

이 방식으로 v3.0 FINAL의 안정성을 해치지 않고 확장한다.

---

# Part III — 3-Tier 하이브리드 도입안

## 6. L1 Browser SLM (Year 2 Phase 5 이월 — 아키텍처만 선행)

### 6.1 Year 1 범위

- **구현 0건.**
- 단, AIRouter 인터페이스에 `source: 'browser' | 'workers-ai' | 'claude'` enum을
  미리 선언해 두어, Year 2 활성화 시 인터페이스 깨짐 방지.
- Dexie 스키마(`apps/web/src/lib/db.ts`)에 `subgraph_meta` 테이블 자리만 예약
  (version migration 대비).

### 6.2 Year 2 Phase 5 도입 조건

다음 모두 충족 시에만 L1 활성화:

1. Phase -1 [B-6]에서 **Gemma 3n E2B 또는 Llama 3.2 1B가 모바일 4 tok/s 이상 확인**
2. Year 1 베타 운영 중 **50대 사용자 불만이 "속도·네트워크" 원인으로 20% 이상 누적**
   → 오프라인 가치가 입증됨
3. iOS Safari WebGPU 지원이 **메이저 버전 보편화**
4. WebLLM vs Transformers.js v4 비교 리포트 작성 후 기술 선택 PITR 완료

### 6.3 모델 후보 잠정 순위 (2026-04 기준, 재확인 필수)

| 순위      | 모델                 | 이유                             |
| --------- | -------------------- | -------------------------------- |
| 1         | Gemma 3n E2B (500MB) | 최저 다운로드, 65 tok/s          |
| 2         | Llama 3.2 1B (600MB) | 100+ tok/s, 품질 낮음 감수       |
| 3         | Phi-4-mini (2.1GB)   | MIT 라이선스, 첫 다운로드 부담   |
| 후보 제외 | Llama 3.2 3B (2GB)   | 첫 다운로드 부담 큼. L2에만 사용 |

### 6.4 UX 원칙 (확정)

- **기본값 OFF.** 옵트인 설정.
- **Wi-Fi + 충전** 조건 충족 시만 자동 다운로드. 그 외엔 사용자 명시 승인.
- 다운로드 진행률 UI는 Dexie에 상태 persist (중단 후 재개 가능).
- WebGPU 미지원 기기는 L2 자동 폴백. 사용자에게는 "AI 응답 중..." 수준 동일 UX.

## 7. L2 Cloudflare Workers AI

### 7.1 Year 1 Phase 2 (Week 11~14) 시범

**허용 기능 (단일):** "개념 재설명(Rephrase)".

**입력:** Graph RAG가 반환한 해설 텍스트 1건 + 사용자 프로필(티어, 선호 톤).
**출력:** 동일 의미, 다른 표현의 한국어 해설.
**Rejection 조건 (어떤 하나라도 해당 시 원본 해설 fallback):**

- 생성 텍스트와 원본의 의미 유사도 < 0.8 (임베딩 비교)
- 생성 텍스트에 **원본에 없던 숫자·법조문·고유명사** 등장
- 생성 텍스트 길이가 원본의 3배 초과 또는 50% 미만

**절대 금지 (AI-Safe Rule 1 적용):**

- 산식 재계산 금지 (math.js AST만)
- 법령 인용 신규 생성 금지 (Graph RAG 조회값만)
- 기출 정답 판정 금지 (기출 경로는 L3 Haiku 또는 Rule 기반 검증)

### 7.2 Year 1 Phase 3 (Week 15~16) 프로덕션

Phase 2 베타 5명 만족도 ≥ 80% 달성 시:

- 개념 재설명을 프리미엄 "쉬운 설명" 버튼으로 공개
- 빈칸 자동 생성(기능 #4)은 **Year 2로 이월** (검증 부담)

### 7.3 Year 2 Phase 5 확대

- 자유 질문 AI 튜터 (Router Pattern: 70% L2, 5% L3 분산)
- 플래시카드 변형 (L1 주력)
- 오답 패턴 분석 (L1 주력, 프라이버시)

### 7.4 모델 및 비용

- 기본 모델: **Llama 3.2 3B**. Workers AI 공식 제공, 한국어 실사용 품질은 Phase -1에서 측정.
- 비용 모델 추정: Year 1 전체 $30 이하 (사용량이 낮음).
- 환각 방지 설정: temperature ≤ 0.3, max_tokens 200 기본값.

## 8. L3 Claude Haiku 유지

### 8.1 현재 배치 파이프라인 유지

`apps/batch/src/adapters/anthropic-client.ts` 및 `packages/parser/src/batch-processor.ts`
의 Claude Haiku 호출은 **그대로 유지**. 모델 ID는 `claude-haiku-4-5-20251001` 고정.

### 8.2 Year 1 프로덕션 런타임 AI

현재 런타임 Claude 호출은 0건. Phase 2에 Workers 프록시 경유 최초 도입 시 **AIRouter
를 통해야만** 가능 (AI-Safe Rule 2). `/api/exams/:exam/ai/*` 라우트는 AIRouter로
라우팅되어, 기본값이 L3 Haiku이며 Phase 2 Rephrase만 L2로 분기.

### 8.3 Year 2+ 복잡 쿼리 전용

Phase 5 이후, Router가 복잡도 분류 결과 "상" 판정 시에만 L3 호출. 예상 비중: 전체
쿼리의 **5% 이하**.

## 9. AIRouter / Graph RAG 추상화 설계

### 9.1 핵심 인터페이스 (Year 1 Phase 2 이전 선언만)

```typescript
// packages/ai-engine/src/types.ts  (신규, DEFCON L3 경로)

export type AILayer = 'browser' | 'workers-ai' | 'claude';

export type AIOperation =
  | 'rephrase' // Phase 2부터 허용
  | 'hint' // Year 2 Phase 5
  | 'variation' // Year 2 Phase 5
  | 'free-question' // Year 2 Phase 5
  | 'graph-rag-explain' // Year 1부터 L3만
  | 'pipeline-batch'; // 배치 전용, 런타임 호출 X

export interface AIRequest {
  readonly examId: ExamId; // Hard Rule 16 (2단계 선언) 준수
  readonly operation: AIOperation;
  readonly prompt: string;
  readonly context?: GraphRAGContext;
  readonly userTier: 'free' | 'single' | 'combo' | 'all-access';
}

export interface AIResponse {
  readonly content: string;
  readonly source: AILayer;
  readonly modelUsed: string;
  readonly latencyMs: number;
  readonly sources?: NodeId[]; // Graph RAG 근거 (AI-Safe Rule 1)
  readonly aiGenerated: true; // UI 라벨링 강제 (AI-Safe Rule 3)
}
```

### 9.2 레이어 결정 규칙 (Year 1 기준)

```
operation === 'pipeline-batch' → (런타임 호출 거부, 배치 전용)
operation === 'rephrase'       → L2 (실패 시 L3 fallback)
operation === 'graph-rag-explain' → L3 (fallback 없음, 실패 시 원본 해설)
기타                            → Year 2 이후 활성화, 현재 throw NotYetAvailableError
```

### 9.3 Graph RAG 통합

AIRouter 내부에서 호출되는 GraphRAGService는 L1/L2/L3 모두 공통 인터페이스로 접근:

```typescript
export interface GraphRAGService {
  retrieve(
    examId: ExamId,
    query: string,
    options: { topK: number; minTruthWeight?: number; examScope?: ExamScope },
  ): Promise<GraphRAGContext>;
}
```

- Year 1: `ServerGraphRAG` 구현체 1개 (Workers AI Vectorize + D1).
- Year 2 Phase 5: `BrowserGraphRAG` 구현체 추가 (IndexedDB subgraph cache + 로컬 임베딩).

### 9.4 Hexagonal 배치

- `packages/ai-engine/` (신규): 코어 라우팅·타입·GraphRAGService 인터페이스.
- `apps/api/src/routes/ai.ts` (Year 1 Phase 2에 신설): HTTP 어댑터.
- `apps/batch/src/adapters/anthropic-client.ts` (기존 유지): 배치 전용.
- `exams/{exam-id}/` (Year 2 Phase 4 신설): 시험별 분기는 어댑터 패턴으로만.

**Hexagonal 규칙 준수:** packages/ai-engine/는 domain만. HTTP·HF CDN·Workers AI
클라이언트는 모두 adapters/에 격리.

---

# Part IV — LoRA 어댑터 도입안

## 10. Year 1 절대 금지 / Year 2 Phase 4 이후 시작

### 10.1 Year 1에 절대 금지인 이유 (재확인)

1. **베이스라인 부재.** 일반 Llama 3.2 3B의 손해평가사 품질을 측정하지 않으면 LoRA
   훈련 전후 비교 자체가 불가능.
2. **데이터 부재.** 베타 유저 없이 실제 사용 데이터가 없어, Graph RAG 자동 생성만으론
   다양성 부족.
3. **인간 라벨링 부재.** 200개 양질 > 2,000개 자동 생성. 진산님이 직접 작성하거나
   합격자 외주를 Year 1 내에 소화하기 어려움.
4. **운영 부담.** Year 1에 핵심 엔진(Formula Engine, Graph RAG, Constants DB)이
   안정화 전이며, LoRA 재훈련/롤백 운영은 과잉.

### 10.2 Year 2 Phase 4 허용 조건

다음을 모두 충족 시에만 첫 LoRA 훈련 착수:

- [ ] 베타 운영 ≥ 3개월, 1,000+ 양질 Q&A 샘플 축적
- [ ] 진산님 직접 작성 암기법 200개 완료 (LoRA #2 데이터)
- [ ] Graph RAG 자동 생성 Q&A 1,000개, 인간 10% 검증 통과
- [ ] PIPA 동의 체계 운영 중 (데이터 수집 합법성 확보)
- [ ] ExamAdapter 구현체(`exams/son-hae-pyeong-ga-sa/adapter.ts`) 존재
- [ ] ADR-013 승인

## 11. 5종 LoRA 후보와 우선순위

현 기획은 세 보고서가 제안한 5종을 **축소**한다. 이유: 유지보수 부담과 데이터
확보 난이도.

| 우선순위 | LoRA                       | Year             | 채택 여부                                              |
| -------- | -------------------------- | ---------------- | ------------------------------------------------------ |
| P0       | 시험별 도메인 (손해평가사) | Year 2 Phase 4   | **채택 확정**                                          |
| P0       | 시험별 도메인 (공인중개사) | Year 2 Phase 5   | **채택 확정**                                          |
| P1       | 암기법 생성기              | Year 2 Phase 5~6 | **채택 (데이터 200개 달성 시)**                        |
| P2       | 혼동 유형 감지기           | Year 3           | **유보** (룰 엔진으로 먼저 구현 → LoRA 보강이 더 나음) |
| P3       | 50대 친화 톤 변환기        | Year 3           | **유보** (세 보고서도 P2로 분류)                       |
| P3       | 문제 난이도 분류기         | Year 3           | **유보** (정답률 통계로 대체 가능)                     |

**결정 근거:** "5종 이내가 적정"이라는 LoRA 보고서 본문과 일치.

## 12. 데이터 수집 인프라 선행 과제 (Phase 2~3에 필수)

### 12.1 Year 1 Phase 2~3 구축 대상

LoRA 자체는 Year 1에 없지만, **데이터 수집 체계는 반드시 Year 1에 구축**. 이게 없으면
Year 2 Phase 4에 LoRA를 훈련할 재료가 없다.

- [ ] **사용자 만족/불만족 클릭 추적.** `user_ai_feedback` 테이블 신설.
- [ ] **신고 시스템.** 잘못된 AI 답변 신고 → DB 저장 + 모니터링 대시보드.
- [ ] **AI 튜터 대화 로그.** PIPA 동의 받은 사용자만 저장. 비동의자는 즉시 파기.
- [ ] **진산님 직접 작성 암기법 저장소.** `mnemonic_cards` 테이블(v3.0 FINAL 11개
      테이블 중)의 `source='manual_expert'` 플래그 활용.

### 12.2 PIPA 동의 설계 (신규 ADR 불필요, 기존 런칭 법무 3종 번들에 포함)

Memory에 기록된 대로 "런칭 직전 법무 3종 + 회원탈퇴 + 이메일 인증 일괄 처리"
방침에 **"AI 데이터 수집 동의"를 추가 항목으로 편성**. Phase 2~3에서는 DB 스키마만
준비하고, 실제 수집은 런칭 스프린트에서 동의 UI와 함께 활성화.

### 12.3 자동 생성 파이프라인

`packages/study-material-generator/` 확장 (신규 서브모듈):

```
packages/study-material-generator/
├── src/
│   ├── qa-generator.ts              # Graph RAG 기반 Q&A 자동 생성
│   ├── fact-validator.ts            # AI-Safe Rule 1 구현
│   ├── human-sampling-queue.ts      # 인간 검증 큐 (10% 샘플링)
│   └── jsonl-export.ts              # ChatML 변환
```

현재 패키지 디렉토리에는 `study-material-generator`가 이미 설계되어 있으므로, LoRA
훈련 파이프라인과 병합 가능. 별도 `packages/lora-trainer/` 필요성 재검토 — 본 기획은
**Year 2 Phase 4에 가서 판단**.

---

# Part V — 거버넌스 업데이트

## 13. Hard Rules 18~23 신설 제안

**주의:** 번호 18~23은 세 보고서의 제안이지만, 본 기획은 **AI-Safe Rule 1~6** 카테고리
접두사를 권고한다 (§4.3 이유).

### AI-Safe Rule 1 — SLM/LLM 출력 사실 검증 필수

**규칙:** 모든 AI 생성 텍스트(L1/L2/L3 공통)는 사용자 노출 전에 다음 검증 통과 필수.

- 산식: `packages/formula-engine/`만 계산. AI는 재계산 금지.
- 법조문: Graph RAG의 LAW 노드 `content` 필드와 **문자열 부분 일치**.
- 상수: Constants DB 조회값과 일치 (AI가 변경값 생성 금지).
- 기출 정답: 기출 경로는 AI 호출 자체 금지 (Hard Rule 11 선행).

검증 실패 시: Graceful Degradation (ADR-008) — 원본 해설로 fallback + 사용자에게
"자료에 없는 정보" 고지.

### AI-Safe Rule 2 — AIRouter 경유 강제

**규칙:** `apps/` 또는 `packages/` 내 모든 런타임 AI 호출은 `packages/ai-engine/`
AIRouter만 경유한다. 다음 직접 호출 금지:

- `fetch('https://api.anthropic.com/...')` 직접
- `Workers AI binding` 직접
- `transformers.pipeline(...)` 직접 (브라우저 포함)

**예외:** `apps/batch/` 배치 파이프라인은 기존 anthropic-client 경로 유지. 단,
Year 2 Phase 4에 배치도 AIRouter 경유로 통합 검토.

### AI-Safe Rule 3 — AI 생성 콘텐츠 라벨링 + 신고 버튼

**규칙:** AI가 생성한 사용자 노출 콘텐츠는 반드시:

- "AI 자동 생성" 배지 표시
- 신고 버튼 노출 (`user_ai_feedback` 테이블로 저장)
- Draft/Approved 상태 플래그 (v3.0 FINAL DB 체계 준수)

Approved 전환은 **인간 검수자**만 가능. LLM 자체 판단으로 Approved 금지.

### AI-Safe Rule 4 — LoRA 훈련 데이터 품질 검증 (Year 2+ 전용)

**규칙:** LoRA 훈련 데이터 JSONL에 포함되기 전:

- Graph RAG 근거 매핑 (각 answer에 sources 필드 의무)
- Constants DB / 법령 DB 사실 일치
- 10% 인간 샘플 검증 (≥ 95% 합격률)
- PIPA 동의 확인 (사용자 데이터 출처 시)
- PII 마스킹 완료 (ADR-009 준수)

### AI-Safe Rule 5 — LoRA 출력도 Graph RAG 사실 검증

**규칙:** LoRA 적용된 모델의 출력도 AI-Safe Rule 1을 동일하게 적용한다. "LoRA가
학습했으니 맞을 것"이라는 가정 금지. Fine-tuned 모델도 환각 가능.

### AI-Safe Rule 6 — LoRA 버전 관리 + 롤백

**규칙:** 각 LoRA 어댑터는:

- 시맨틱 버전: `{feature}-v{major}.{minor}.{patch}.bin`
- 학습 데이터 해시 + 메타데이터 JSON 동봉
- 즉시 비활성화 토글 (구성 플래그)
- 최소 직전 2버전 보관 (롤백 대비)

## 14. DEFCON·PITR·Plan 적용 경로

### 14.1 DEFCON 판정

| 작업                          | DEFCON | 근거                                       |
| ----------------------------- | ------ | ------------------------------------------ |
| AIRouter 인터페이스 정의      | **L3** | packages/ai-engine은 코어 엔진 — plan 필수 |
| HF 모델 R2 미러링 스크립트    | L2     | 빌드 파이프라인, 런타임 영향 제한적        |
| Phase 2 Rephrase PoC          | **L3** | AI 산출물이 사용자 노출 — 상용 품질 영향   |
| LoRA 훈련 파이프라인          | **L3** | Year 2 전용, 개인정보 처리                 |
| Dexie subgraph_meta 자리 예약 | L2     | DB 스키마 변경이나 영향 범위 작음          |
| Hard Rules 문서 추가          | L1     | 문서만 (CLAUDE.md 린터 외 영향 없음)       |

### 14.2 PITR 대상 항목

다음은 **PITR (기술 선택지 비교)** 필수:

- L1 스택 선택: Transformers.js v4 vs WebLLM vs MLC (Year 2 Phase 5 직전)
- L1 모델 선택: Gemma 3n E2B vs Llama 3.2 1B vs Phi-4-mini (Year 2 Phase 5)
- 브라우저 벡터 DB: Voy vs 자체 IndexedDB + 선형 코사인 (Year 2 Phase 5)
- LoRA 프레임워크: Unsloth vs Axolotl vs LlamaFactory (Year 2 Phase 4)
- EXAONE vs Llama Fine-tune (Year 2 후반, MAU 1,000+ 시점)

### 14.3 Plan 작성 필수 항목

Year 1 내에 L3 plan이 필요한 것은 **단 하나**: "AIRouter 인터페이스 + ai-engine 패키지
신설". 그 외는 본 기획 승인 후 개별 Step 시작 시점에 추가 plan 작성.

## 15. Phase -1 [B-6] SLM/LoRA 실효성 검증 신설

**세 보고서의 [B-6]을 본 기획에 정식 편입.** 단, 범위를 현 Phase 1 상태에 맞게 축소:

### [B-6A] Llama 3.2 3B + Graph RAG PoC (1일)

- 손해평가사 샘플 질문 20개 (현 Step 1-3 산출물 활용 가능)
- Haiku 대비 품질: 80% 이상 만족 목표 (진산님 + 합격자 1명 블라인드 평가)
- 응답 시간: 평균 2초 이하
- 사실 검증 실패율: 5% 이하
- **판정:** L2 Phase 2 시범 도입 여부

### [B-6B] 브라우저 SLM 실행 가능성 확인 (0.5일)

- M2 MacBook, iPhone 15 Pro, 중저가 안드로이드 중 2대
- Gemma 3n E2B 또는 Llama 3.2 1B 로딩 및 1회 추론 성공 여부만
- **판정:** Year 2 Phase 5 계획 유효성 (실패 시 ADR-011에 반영)

### [B-6C] EXAONE 3.5 로컬 품질 비교 (선택, 0.5일)

- 연구용 라이선스로 Ollama + EXAONE-3.5-2.4B-Instruct-GGUF
- Llama 3.2 3B와 동일 20개 질문으로 한국어 품질 비교
- **LG AI Research 접촉은 하지 않음** (Year 2 이후)
- **판정:** Year 2 EXAONE 협상 가치 참고 자료

### [B-6] 예산

- 클라우드 비용: $30 이하
- 인간 시간: 진산님 3시간 + 평가자 2시간
- 총 예상 기간: **2일 내**

**중요:** [B-6]은 코드 커밋 없이 리포트만 생성. 결과에 따라 Phase 2 계획 조정.

---

# Part VI — 실행 로드맵

## 16. 현 Phase 1에서 해야 할 **최소 선행 작업** (코드 없음)

### 16.1 문서/ADR 선행 (인간 승인 시)

- [ ] ADR-011 초안 작성 (AI 3-Tier Hybrid)
- [ ] ADR-012 초안 작성 (HF R2 미러링)
- [ ] ADR-013 초안 작성 (LoRA 정책, Year 2)
- [ ] 본 기획 문서를 v3.0 FINAL **공식 Addendum**으로 편성
- [ ] AI-Safe Rule 1~6을 `.claude/rules/production-quality.md`에 **비활성 초안**으로
      추가 (린터 강제는 Phase 2부터)

### 16.2 절대 하지 않을 것

- 코드 디렉토리 신설 (packages/ai-engine/, packages/lora-trainer/ 등)
- Dexie 스키마 변경
- Workers AI 바인딩 추가
- HF 모델 다운로드 스크립트
- **어떤 AI 호출 코드도 작성 금지**

### 16.3 Step 1-6(가-1)~1-8(HK-01) 영향

- **Step 1-6 (가-1):** 영향 없음. 그대로 진행.
- **Step 1-7:** 영향 없음.
- **Step 1-8 (HK-01 Vectorize PoC):** **여기에 Graph RAG 인터페이스 초안을 얹을지**는
  인간 판단 대상 (§20). 추가 부담 2~3일.

## 17. Phase 2~3 통합 계획 (Year 1 Week 11~16)

### 17.1 Phase -1 [B-6] 실행 (Week 10 사이)

Phase 1과 Phase 2 사이에 [B-6A~C] 2일 수행. 결과 리포트를 본 기획 v1.1로 발행.

### 17.2 Phase 2 Week 11~14

- [ ] `packages/ai-engine/` 패키지 신설 (DEFCON L3, plan 필수)
- [ ] AIRouter + GraphRAGService 인터페이스 확정
- [ ] `apps/api/src/routes/ai.ts` 신설, Rephrase 엔드포인트
- [ ] Workers AI 바인딩 + Llama 3.2 3B 통합
- [ ] 데이터 수집 스키마(`user_ai_feedback`, 신고 테이블) DB 마이그레이션
- [ ] AI-Safe Rule 1~3 린터/Hook 활성화
- [ ] 베타 5명 A/B 테스트 (L2 vs L3 품질)

### 17.3 Phase 3 Week 15~16

- [ ] Rephrase 기능 프로덕션 배포 (만족도 80%+ 시)
- [ ] "AI 자동 생성" 배지 + 신고 버튼 UI
- [ ] 런칭 직전 법무 번들에 "AI 데이터 수집 동의" 편성

### 17.4 Phase 3 종료 시점 산출물

- 런칭된 쪽집게 서비스에 L2 Rephrase 기능 1종 동작
- 데이터 수집 파이프라인 가동 (PIPA 동의 받은 유저부터)
- AIRouter 아키텍처가 Year 2 확장 준비 상태

## 18. Year 2 Phase 4~5 확대 계획

### 18.1 Phase 4 (Year 2 전반, 공인중개사 추가 시점)

- [ ] `exams/son-hae-pyeong-ga-sa/` 디렉토리 신설 (ADR-007 실행)
- [ ] `packages/lora-trainer/` 신설 또는 `study-material-generator/`로 병합
- [ ] Graph RAG 자동 생성 Q&A 확보 (5,000개)
- [ ] 인간 검증 10% 샘플
- [ ] **첫 LoRA 훈련:** 손해평가사 도메인 v1.0.0 (Colab + Unsloth)
- [ ] Workers AI 통합 (Custom 모델 배포 또는 adapter 합성)
- [ ] A/B: 일반 Llama vs 손해평가사 LoRA

### 18.2 Phase 5 (Year 2 후반)

- [ ] L1 Browser SLM 도입 검토 (§6.2 조건 충족 시)
- [ ] WebLLM vs Transformers.js PITR
- [ ] Gemma 3n E2B 또는 Llama 3.2 1B 선정
- [ ] BrowserGraphRAG 구현 (Voy 또는 IndexedDB 선형 코사인)
- [ ] Subgraph Cache Manager
- [ ] 공인중개사 LoRA 훈련
- [ ] LoraRegistry + 동적 어댑터 로드 시스템

### 18.3 Phase 6 (Year 2 말)

- [ ] 암기법 LoRA 훈련 (데이터 200개 달성 시)
- [ ] EXAONE 3.5 상용 라이선스 접촉 (MAU 1,000+ 확인 시)
- [ ] "프리미엄 한국어 AI 튜터" 상품화 검토

## 19. Year 3 Vision/멀티모달 검토 지점

**Year 3에 들어가기 전엔 Vision 미검토.** 쪽집게 Year 1~2는 손해평가사 + 공인중개사

- 전기기사 후보까지만 포함하며, 전기기사 회로도는 본 버전 범위 외(ADR-007 §확정 시험
  포트폴리오 확인 필요).

Year 3 이후 소방기사/화학공학기사 등 도면·구조식 중심 시험이 포트폴리오에 들어올
때:

- Phi-4-multimodal Mixture-of-LoRAs 재평가
- Llama 3.2 11B Vision 재평가
- YOLOv8 + 텍스트 LLM 파이프라인 재평가

이 결정은 **Year 3 별도 기획서**로 다룬다.

---

# Part VII — 의사결정 요청

## 20. 진산님께 드리는 5가지 판단 요청 (전략 갈림길)

본 기획은 다음 5개 **전략 갈림길**에 대한 인간 판단이 있어야 실행으로 넘어간다.
나머지는 모두 위임 가능.

### 결정 1 — "v3.1 발행" 시점

A. 본 기획을 즉시 v3.0 FINAL Addendum으로 편성, v3.1 공식 발행은 Phase -1 [B-6] 결과
확인 후 (권고).
B. 즉시 v3.1 공식 발행.
C. v3.0 FINAL에 통합하고 별도 Addendum 없이 v3.1 발행.

**권고: A.** v3.0 FINAL의 안정성 해치지 않음.

### 결정 2 — "ADR-011/012/013 착수 시점"

A. 본 기획 승인 즉시 ADR 3건 작성 (권고).
B. Phase -1 [B-6] 결과 받은 뒤.
C. Phase 2 직전.

**권고: A.** ADR은 문서이므로 L1, Phase 경로 영향 없음.

### 결정 3 — "Phase 1 Step 1-8에 Graph RAG 인터페이스 초안 얹기"

A. 얹지 않는다 — Step 1-8은 Vectorize PoC만, AI 쪽은 Phase 2부터 (권고).
B. 얹는다 — 2~3일 연장, Phase 2 착수 빠름.

**권고: A.** Step 1-8은 임베딩 인프라 검증 전용. AI 라우팅까지 얹으면 Step 1-8 완료
기준이 흐려지고 독립 리뷰 부담 급증.

### 결정 4 — "HF 모델 CDN R2 미러링"

A. 미러링 (ADR-006 단일 벤더 원칙 유지, 권고).
B. HF 직접 참조 (비용/복잡성 절감).
C. 결정 연기 — Year 2 Phase 5 직전에 재결정.

**권고: C.** Year 1에는 이 결정을 내릴 실물이 없음. 모델 선택이 확정되지 않은 상태에서
미러링 전략만 선결정하는 것은 과잉.

### 결정 5 — "데이터 수집 스키마 (user_ai_feedback, 신고) 선행 포함 여부"

A. Phase 2 착수 시점에 스키마 추가 (권고).
B. Phase 3 런칭 직전에 스키마 추가.
C. Year 2 Phase 4에 LoRA 착수 시점에 추가.

**권고: A.** Phase 2에 L2 Rephrase PoC가 나오면 즉시 사용자 피드백이 필요.
Year 2에 가서 추가하면 "지난 1년치 데이터"가 없어 LoRA 훈련 자산 손실.

## 21. "승인 전에는 절대 안 건드릴 것" 목록

본 기획 승인 전까지 다음은 **한 줄도 작성하지 않는다**:

- `packages/ai-engine/` 디렉토리 / 코드
- `packages/lora-trainer/` 디렉토리 / 코드
- `apps/api/src/routes/ai.ts`
- Workers AI 바인딩 (`wrangler.toml` 또는 config)
- HF 모델 다운로드 스크립트
- Dexie 스키마 변경 (`subgraph_meta` 포함)
- `.claude/rules/production-quality.md` 린터 룰 변경 (문서에 초안 주석만 허용)
- v3.0 FINAL 기획서 본문 수정
- 기존 Hard Rules 17개 번호/순서 재배치

**변경은 본 기획이 Addendum으로 편성된 이후 개별 Step의 plan이 승인돼야 시작.**

## 22. 다음 단계 제안

### 22.1 진산님 즉시 확인 요청

위 §20의 5가지 결정 중 **결정 1, 2, 3만 회신**해 주시면 본 기획이 Addendum 편성 단계로
넘어갑니다. 결정 4, 5는 Phase 2 진입 직전에 재확인해도 충분합니다.

### 22.2 승인 후 즉시 실행 항목

- 본 문서를 v3.0 FINAL의 Addendum-1로 편성 (파일 이름 유지, 링크 추가)
- ADR-011/012/013 초안 작성 (각 200~400줄)
- Phase -1 [B-6A/B/C] 체크리스트를 현 Phase 1 잔여 작업 옆에 삽입
- AI-Safe Rule 1~6을 `.claude/rules/production-quality.md`에 **"활성화 Phase 2부터"**
  주석으로 추가

### 22.3 Phase 2 착수 직전 실행 항목

- [B-6] 2일 수행 및 결과 리포트
- 결과 불합격 시 ADR-011 수정 (예: L2를 Year 2로 이월)
- Phase 2 Week 11 첫날: `packages/ai-engine/` plan 작성 → 인간 승인 → 코딩

---

## 부록 A — 용어 정의

- **SLM (Small Language Model):** 1B~7B 파라미터급 오픈 소스 언어 모델. 여기서는
  Llama 3.2 3B / Gemma 3n E2B / Phi-4-mini / EXAONE 3.5 2.4B를 지칭.
- **LoRA (Low-Rank Adaptation):** 기본 모델 가중치를 동결하고 작은 어댑터 레이어만
  학습하는 파인튜닝 기법. 2026년 기준 Unsloth/DoRA로 Colab 무료 실행 가능.
- **AIRouter:** 본 기획이 도입하는 패턴. 모든 런타임 AI 호출을 단일 경유점으로 모아
  L1/L2/L3 라우팅과 Graph RAG 컨텍스트 주입을 통합 관리.
- **Graph RAG:** 쪽집게의 기존 핵심 기술 (v3.0 FINAL §4). Knowledge Node + Edge +
  Truth Weight + Vectorize 임베딩.
- **3-Tier Hybrid:** L1 브라우저 / L2 Workers AI / L3 Claude Haiku의 3계층 라우팅.

## 부록 B — 참고 문서 상호 링크

- `docs/AI모델적용/오픈 SLM(소형 AI) 활용 전략 보고서.md` — 3계층 구조 원본 제안
- `docs/AI모델적용/SLM 도입 타당성 3대 질문 심층 분석.md` — Graph RAG + SLM 결합
  및 기기 편차 대응
- `docs/AI모델적용/ LoRA 어댑터 도입 전략 분석.md` — LoRA 5종 + 데이터 4소스
- `docs/쪽집게(ThePick) — 구현 재정립서 v3.0 FINAL.md` — 현 기준 문서
- `docs/architecture/ARCHITECTURE.md` — Hexagonal 규칙, Mermaid 다이어그램
- `docs/adr/ADR-006-single-vendor-cloudflare.md` — 외부 벤더 금지 원칙
- `docs/adr/ADR-007-multi-exam-deferred-to-year-2.md` — 멀티시험 Year 2 이월
- `docs/adr/ADR-004-vectorize-embedding-spec.md` — 임베딩 후보 3종
- `docs/adr/ADR-008-graceful-degradation-thresholds.md` — 0.60 임계값 외
- `docs/adr/ADR-009-pii-masking-policy.md` — PIPA/PII 처리 원칙

## 부록 C — 본 기획이 명시적으로 **결정하지 않는** 항목

- Year 2 EXAONE 라이선스 조건
- 정확한 Workers AI 월 비용 (사용량에 의존)
- LoRA 훈련 1회당 실제 품질 향상치 (측정 전)
- 50대 사용자의 실제 L1 수용률 (베타 운영 전)
- 공인중개사/전기기사 LoRA 훈련 우선순위 (Year 2 진입 시 재결정)

이들은 **의도적으로 열려 있다**. 데이터 없이 결정하면 Silent Pivot 위험.

---

## 맺음말

> 본 기획은 세 입력 보고서를 **"바로 도입"** 하지 않는다.
> 대신 **"Year 1에는 아키텍처 격리만, Year 2부터 단계 활성화"** 로
> 현 프로젝트의 ADR-006 / ADR-007 / v3.0 FINAL 체계와 충돌 없이 정합시킨다.
>
> 세 보고서가 강조한 "점진적 도입"과 "Graph RAG + SLM 결합" 핵심 통찰은 그대로 살리되,
> "Year 1 즉시 L2 PoC"는 Phase -1 [B-6] 결과로 **재판정 대상**으로 둔다.
>
> 쪽집게는 "최초의 재미있는 MVP"가 아니라
> "10년 버티는 자격시험 SaaS 엔진"을 목표로 한다.
> SLM과 LoRA는 그 엔진에 붙일 **확장 포트**이지, 엔진 그 자체가 아니다.
>
> — SLM + LoRA Integration Plan v1.0
> — 2026-04-24

---

_"최고의 AI 전략은 '지금 도입하느냐'가 아니라_
_'언제 어떤 조건에서 도입하느냐'를 설계하는 것이다._
_아키텍처만 격리해 두면, 활성화는 언제든 가능하다._
_활성화부터 하면, 격리는 영원히 불가능하다."_
