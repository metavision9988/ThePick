# 🔍 첨부 문서 vs 기존 프로젝트 설계 — GAP 분석 보고서

> **DEV COVEN 합동 리뷰**
> MEPHISTO(조율) × ARCHITECT(구조) × BREAKER(반박) × ORACLE(판단)
>
> _"이미 그린 지도에 빠진 길이 있다. 그 길이 절벽으로 이어지기 전에 찾아내자."_

---

## 📋 Executive Summary

첨부 문서는 진산님이 이전 대화에서 도출한 **RAG 한계 인식 → Graph RAG 설계론 → 룰 엔진 연산 격리 → 구조화 파이프라인(RAR Cycle) → 모의 문제 무한 생성**까지의 아키텍처 진화 기록입니다.

현재 프로젝트 파일(`SYSTEM_ARCHITECTURE_MASTER_v1.md`, `exam_ai_finetuning_vs_rag.md`, `data_collection_pipeline.md`, `question_generation_analysis.md` 등)과 교차 대조한 결과, **6개의 중대 GAP**과 **4개의 보완 사항**을 식별했습니다.

---

## 🔴 중대 GAP (기존 설계에 부재하거나 근본적으로 부족한 것)

### GAP-1: Graph RAG 아키텍처 전면 부재

| 항목               | 상세                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **현재 상태**      | `exam_ai_finetuning_vs_rag.md`는 단순 벡터 검색 + 리랭킹까지만 설계. 청킹은 "법조문 조항 단위, 교재 개념 단위, 기출 묶음" 수준의 평면적 분류만 존재                                                                                                                      |
| **첨부 문서 요구** | 노드(Node) — 개념, 수식, 규정을 분리된 노드로 설계. 엣지(Edge) — 개념 간 인과관계·선수지식·조건부 종속성을 명시적으로 연결                                                                                                                                               |
| **위험도**         | 🔴 Critical                                                                                                                                                                                                                                                              |
| **BREAKER 반박**   | 손해평가사 데이터는 `[품목]→[재해종류]→[조사시기]→[산식]`의 4단계 조건부 트리. 단순 벡터 검색은 "사과 적과전 우박"과 "배 적과후 태풍"을 구분하지 못하고 의미론적 과밀화(Semantic Overcrowding) 발생. 이건 리랭킹으로 해결 불가 — 검색 전 메타데이터 필터가 선행되어야 함 |

**🔧 필요 조치:**

- `SYSTEM_ARCHITECTURE_MASTER_v1.md`에 Graph RAG 레이어 추가
- D1에 `knowledge_nodes`, `knowledge_edges` 테이블 스키마 설계
- Cloudflare Vectorize 검색 시 메타데이터 필터 우선 적용 로직 명시
- Phase 1 Epic 1.1(콘텐츠 파싱 엔진)에 메타데이터 태깅 Story 추가

---

### GAP-2: 산식 연산 격리(Rule Engine) 설계 부재

| 항목               | 상세                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **현재 상태**      | `question_generation_analysis.md`에서 "복잡한 사례형 문제는 피할 것"으로 회피. 계산 문제 처리 전략 없음                                                                                   |
| **첨부 문서 요구** | LLM은 **절대** 수식 계산을 하지 않음. LLM → 변수 매핑만 수행 → 독립 룰 엔진(JS/Python 함수)에서 연산 → 결과값만 반환                                                                      |
| **위험도**         | 🔴 Critical (손해평가사 2차 실기가 100% 계산 문제)                                                                                                                                        |
| **ARCHITECT 판단** | Cloudflare Workers 내에 `formula-engine` 모듈을 독립 서비스로 격리해야 함. Workers의 compute 제한(CPU 50ms free tier)을 고려하면 복잡한 산식은 Workers Paid($5/mo, 30초 제한)로 전환 필요 |

**🔧 필요 조치:**

- 모듈 설계에 `formula-engine` 추가 (DDD 바운디드 컨텍스트)
- D1 스키마에 `formulas` 테이블 (formula_id, equation_template, variables_schema, constraints)
- `MVP_ROADMAP_4LEVEL.md` Phase 1에 룰 엔진 POC Story 추가
- `POC_CHECKLIST.md`에 "POC-N: 산식 연산 정확도 검증" 항목 추가

---

### GAP-3: 계층적 메타데이터 태깅 스키마 부재

| 항목               | 상세                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **현재 상태**      | `data_collection_pipeline.md`의 메타데이터는 `[연도, 과목, 회차]` 3종뿐. `exam_ai_finetuning_vs_rag.md`는 `[법률명, 조항번호, 개정일, 시행일]`                        |
| **첨부 문서 요구** | 4레벨 계층적 태깅 — LV1(보장방식) → LV2(품목) → LV3(조사종류) → LV4(속성: 시기/방법/산식). 검색 전 필터링 필수                                                        |
| **위험도**         | 🔴 Critical                                                                                                                                                           |
| **ORACLE 판단**    | 현재 태깅 수준으로는 손해평가사는 물론 법률 기반 시험(공인중개사 등)도 조문 간 충돌을 구분하지 못함. 이건 MVP 핵심 가치인 "정확한 해설" 자체를 무너뜨리는 구조적 결함 |

**🔧 필요 조치:**

- 시험 유형별 메타데이터 태깅 스키마 표준 정의서 신규 작성
- `exam_type_expansion_analysis.md`의 TYPE A~D 분류에 각각의 태깅 레벨 명세 추가
- Admin CMS(Epic 1.3)에 메타데이터 태깅 UI/검수 워크플로우 반영

---

### GAP-4: Graceful Degradation(우아한 저하) 프로토콜 부재

| 항목               | 상세                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **현재 상태**      | `exam_ai_finetuning_vs_rag.md`에 "불일치 시 재생성 or 경고 표시" 1줄 언급만 존재. 구체적 임계값(Threshold)이나 폴백(Fallback) 로직 없음                                               |
| **첨부 문서 요구** | RAG 검색 결과의 유사도가 기준치 이하일 때 AI가 소설을 쓰지 않도록 강제. "현재 검색된 데이터만으로는 명확한 해설을 구성하기 어렵습니다. 교재 O장 O절을 참고해 주세요."로 정직하게 후퇴 |
| **위험도**         | 🟠 High                                                                                                                                                                               |

**🔧 필요 조치:**

- AI 응답 생성 파이프라인에 Confidence Score 게이트 추가
- 임계값별 행동 정의: `score ≥ 0.85` → 정상 해설, `0.60~0.85` → 부분 해설 + 참고 안내, `< 0.60` → 해설 거부 + 교재 안내
- `SYSTEM_ARCHITECTURE_MASTER_v1.md` AI 통합 섹션에 반영

---

### GAP-5: 기출문제 시간축 충돌 관리 부재

| 항목               | 상세                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **현재 상태**      | `smart_question_generation_and_structure.md`에 법 개정 모니터링 파이프라인은 설계됨. 그러나 **과거 기출문제의 정답이 현재 규정에서는 오답이 되는 문제**에 대한 처리 로직 없음 |
| **첨부 문서 요구** | 과거 기출 DB와 현재 교과서 RAG가 충돌할 때, "해당 기출문제는 2022년 기준이며, 2024년 개정법에 따라 현재는 오답 처리됨"을 명시적으로 보고하는 시스템                           |
| **위험도**         | 🟠 High (특히 손해평가사 — 매년 손해평가요령이 개정됨)                                                                                                                        |

**🔧 필요 조치:**

- 기출문제 DB에 `valid_from`, `valid_until`, `superseded_by` 필드 추가
- 법 개정 감지 시 관련 기출문제 자동 플래깅 워크플로우
- 사용자에게 "⚠️ 이 문제는 20XX년 기준입니다. 현행법과 다를 수 있습니다." 경고 UI

---

### GAP-6: 구조화된 지식 명세서(Contract) 포맷 부재

| 항목               | 상세                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **현재 상태**      | 파싱 결과물은 `exam_parsed.json`처럼 평면 JSON (문제번호, 과목, 텍스트, 선지). 교재 내용의 구조화 포맷 미정의                                   |
| **첨부 문서 요구** | YAML/JSON 기반 지식 명세서 — `concept_id`, `category(LV1~3)`, `conditions`, `variables`, `formula`, `dependencies`, `graceful_degradation_rule` |
| **위험도**         | 🟠 High                                                                                                                                         |

**🔧 필요 조치:**

- Knowledge Contract Schema 표준 정의 (YAML)
- `data_collection_pipeline.md`에 "3단계 구조화" 이후 Contract 변환 단계 추가
- Admin CMS에서 Contract 검수/승인(G5.5) 워크플로우 UI

---

## 🟡 보완 사항 (기존 설계에 존재하나 강화 필요)

### SUP-1: 벡터 DB 선택 불일치 해소

- **현재**: `exam_ai_finetuning_vs_rag.md`에서 Qdrant 추천, `SYSTEM_ARCHITECTURE_MASTER_v1.md`에서 Cloudflare Vectorize 확정
- **조치**: Qdrant 관련 설명을 아카이브 처리하고, Vectorize의 메타데이터 필터링 한계 명시. Vectorize가 Graph 메타데이터 필터를 지원하는지 POC 검증 필요

### SUP-2: 문제 생성 파이프라인 고도화

- **현재**: `question_generation_analysis.md`가 "간단한 유형만(OX, 빈칸)" 권고
- **첨부 문서**: 수치적 변이(Variable Mutation) + 조건부 함정 생성(Edge Case Injection) + 단계별 산출 해설 동시 생성까지 설계
- **조치**: 문제 생성 Level을 3단계로 확장 — L1(OX/빈칸, 현재), L2(4지선다 변이), L3(계산+함정, 첨부문서 방식). Phase 3 Epic 3.1에 반영

### SUP-3: 삼각 교차 검증 체계 강화

- **현재**: `question_generation_analysis.md`에 자동 검수 로직 존재 (법조문 존재 확인, RAG 교차 검증, 중복 체크)
- **첨부 문서**: 기출 → 구조화 → 룰 엔진 통과 → 모범답안 100% 일치 검증까지 요구
- **조치**: 룰 엔진 구축 후 "기출문제 역공학 검증" 테스트 스위트 추가. 이를 Phase 0 POC 또는 Phase 1 완료 체크포인트에 편입

### SUP-4: 인간-AI 공동 구조화 워크플로우(RAR Cycle) 명시

- **현재**: Admin CMS에 Human-in-the-Loop 검수는 설계됨
- **첨부 문서**: AI가 구조화 초안 생성 → 인간 전문가가 검수·승인 → 확정 데이터 영속화의 명확한 3단계 사이클
- **조치**: CMS 워크플로우에 `draft → review → approved → published` 4단계 상태 머신 반영

---

## 📊 영향도 매트릭스

| GAP                        | 영향받는 프로젝트 파일                                            | 영향 Phase |
| -------------------------- | ----------------------------------------------------------------- | ---------- |
| GAP-1 Graph RAG            | SYSTEM_ARCHITECTURE, data_collection_pipeline, MVP_ROADMAP        | P0, P1     |
| GAP-2 Rule Engine          | SYSTEM_ARCHITECTURE, POC_CHECKLIST, MVP_ROADMAP                   | P0, P1     |
| GAP-3 메타데이터 스키마    | data_collection_pipeline, exam_type_expansion, ADMIN_ARCHITECTURE | P1         |
| GAP-4 Graceful Degradation | SYSTEM_ARCHITECTURE, question_generation                          | P1, P3     |
| GAP-5 시간축 충돌          | smart_question_generation, data_collection_pipeline               | P1, P3     |
| GAP-6 Knowledge Contract   | data_collection_pipeline, ADMIN_ARCHITECTURE                      | P1         |
| SUP-1 벡터 DB 통일         | exam_ai_finetuning_vs_rag, POC_CHECKLIST                          | P0         |
| SUP-2 문제 생성 고도화     | question_generation_analysis, MVP_ROADMAP                         | P3         |
| SUP-3 삼각 검증            | POC_CHECKLIST, question_generation                                | P0, P1     |
| SUP-4 RAR Cycle            | ADMIN_ARCHITECTURE, MVP_ROADMAP                                   | P1         |

---

## 🎯 MEPHISTO 최종 판단: 실행 우선순위

```
┌─────────────────────────────────────────────────────────────────────────┐
│  즉시 반영 (Phase 0 착수 전 필수)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. POC_CHECKLIST에 추가:                                               │
│     □ POC-NEW-1: Cloudflare Vectorize 메타데이터 필터링 검증            │
│     □ POC-NEW-2: Workers 기반 산식 룰 엔진 정확도 검증                  │
│                                                                         │
│  2. SYSTEM_ARCHITECTURE에 추가:                                          │
│     □ Graph RAG 레이어 (노드/엣지 설계)                                 │
│     □ Formula Engine 모듈 (DDD 바운디드 컨텍스트)                        │
│     □ Graceful Degradation 프로토콜                                      │
│                                                                         │
│  3. data_collection_pipeline에 추가:                                     │
│     □ 계층적 메타데이터 태깅 스키마 (LV1~LV4)                           │
│     □ Knowledge Contract 포맷 정의 (YAML)                                │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 1 반영                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  4. MVP_ROADMAP Epic 1.1에 Story 추가:                                   │
│     □ 메타데이터 태깅 엔진 구현                                         │
│     □ Knowledge Contract 변환기 구현                                     │
│                                                                         │
│  5. ADMIN_ARCHITECTURE에 추가:                                           │
│     □ RAR Cycle 워크플로우 (draft→review→approved→published)             │
│     □ 기출문제 시간축 충돌 관리 UI                                       │
│                                                                         │
│  6. DB 스키마 확장:                                                      │
│     □ knowledge_nodes, knowledge_edges 테이블                            │
│     □ formulas 테이블                                                    │
│     □ 기출문제에 valid_from/valid_until 필드                             │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 3 반영                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  7. 문제 생성 L2/L3 레벨 확장                                            │
│  8. Bounded Mutation 기반 모의 문제 무한 생성 엔진                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ BREAKER 경고

> 첨부 문서에서 제안된 Graph RAG + Rule Engine + Bounded Mutation은 **완성형 아키텍처**입니다.
> 이것을 Phase 0에 전부 구현하려는 **Blind Charge는 절대 금지**.
>
> Phase 0에서는 **"이 방향이 가능한가?"만 POC로 증명**하고,
> 실제 구현은 Phase 1~3에 걸쳐 점진적으로 녹여내야 합니다.
>
> 특히 Graph RAG는 Cloudflare Vectorize의 메타데이터 필터링 성능이
> 실제로 충분한지부터 검증해야 합니다. 안 되면 D1에서 사전 필터링 후
> Vectorize로 넘기는 2단계 검색으로 우회해야 합니다.

---

_"지도에 없는 길을 걷는 건 용감한 게 아니라 무모한 것이다._
_먼저 빈 곳을 채우고, 그다음에 걸어라."_

— DEV COVEN 합동 리뷰 v1.0
