# Content Build Engine — 설계 기획 개요서 (v2.1)

> 본 엔진은 본 프로젝트(쪽집게/ThePick) 의 **지능 코어이자 인프라**.
> 시스템이 다 붕괴해도 본 엔진만 살아있으면 재건 가능.
> 본 엔진이 잘못되면 모든 서비스가 의미 없어짐 (진산님 명시, 2026-04-25).

작성일 v1: 2026-04-26
**개정 v2.1**: 2026-04-26 (DEV COVEN 8 페르소나 비판 검토 흡수)

- v1 → v2.0: 7개 결함 처리 (Multi-Path Fallback / Materialized Active View / Hybrid Search / **CBIV** / Event Sourcing / `_common/` 네임스페이스)
- v2.0 → v2.1: 4개 메타 반론 처리 (D1 Preview / Concurrent + Short-circuit / Snapshotting / Adaptive Threshold)

원본 검토서: [`review/CONTENT_BUILD_ENGINE_REDESIGN_v2.md`](./review/CONTENT_BUILD_ENGINE_REDESIGN_v2.md), [`review/CONTENT_BUILD_ENGINE_REDESIGN_v2_1_PATCH.md`](./review/CONTENT_BUILD_ENGINE_REDESIGN_v2_1_PATCH.md), [`review/CBIV_DESIGN_DIAGRAM.md`](./review/CBIV_DESIGN_DIAGRAM.md), [`review/ADMIN_REVIEW_UI_DESIGN.md`](./review/ADMIN_REVIEW_UI_DESIGN.md)

---

## 1. 배경 (Background)

### 1.1 본 프로젝트의 본질

진산님 비전 (메모리 `project_vision_mvp_generalization.md`):

> _"자격증 도메인별 Graph RAG + 훈련 콘텐츠 무한 자동 생성 엔진. 북극성은 '생성물 신뢰성·정확성'. 합격률 목표 60%."_

이 비전을 한 문장으로 환원하면:

```
교재 + 기출 + 법령 + 개정사항  →  [Content Build Engine]  →  Knowledge Graph
                                                            (검증된 도메인 지식)
                                              ↓
                                     [학습 콘텐츠 자동 생성]
                                              ↓
                                  플래시카드 / 산식 계산기 / 사례 풀이 /
                                  암기법 / 모의시험 (모두 검증된 KG 기반)
```

본 엔진의 산출물 (검증된 Knowledge Graph) 위에서 모든 학습 콘텐츠가 자라남.

### 1.2 왜 코어인가

진산님 명시 (2026-04-25):

- _"이것이 잘못되면 모든 서비스가 의미가 없어진다"_
- _"시스템이 붕괴되어도 이것만 있으면 된다"_
- _"이 손해평가사 외에 다른 자격증 서비스 개발 시에도 이 엔진을 기본으로 하고 도메인 특화 부분만 보강"_

본 엔진은 **(a) 단일 자격증 운영의 코어** + **(b) 멀티 자격증 확장의 공통 인프라**.

### 1.3 직면한 문제 (v2.1 보강)

| 문제                                                   | 본 엔진의 해법                                                                 |
| :----------------------------------------------------- | :----------------------------------------------------------------------------- |
| 비구조 자료의 구조화 부재                              | Knowledge Graph 노드/엣지                                                      |
| 산식 계산 불투명 + 출처 불명                           | Formula Engine + page_ref/revision_change_id                                   |
| **법령·산식·논리 자주 변경 (Year 1만 26년 개정 포함)** | Temporal Graph + **Materialized Active View** (v2.0 보강)                      |
| AI 답변의 할루시네이션                                 | 모든 노드 출처 + **3-Stage Hybrid Search** (v2.0 신규)                         |
| **벡터 검색이 폐기 노드를 정답으로**                   | **Hybrid Search Stage 2 (Graph Filter, `is_current_active=1`)**                |
| **유사도 < 0.60 폴백이 막다른 안내**                   | **Multi-Path Fallback** (Vector → Keyword → Topic → Honest Refusal, v2.0 신규) |
| **인간 검수가 14 BATCH 누적 시 확장 불가**             | **CBIV (Cross-Batch Integrity Validator)** — 5번째 코어 모듈 (v2.0 신설)       |
| **FSRS LWW 가 멀티 디바이스 학습 데이터 손실**         | **Event Sourcing + Snapshotting** (v2.0/v2.1 보강)                             |
| 자격증마다 새 도구 만드는 낭비                         | 코어 / 도메인 plugin 분리 + `_common/` (Year 2)                                |

---

## 2. 목적 (Purpose)

### 2.1 본 엔진이 해결하는 것

**한 줄**: _"비구조 자료를 검증된 도메인 그래프로 변환하고, 변경을 신구 동시 보존(Temporal)하여, 폐기 정보 노출 없이(Hybrid Search), Cross-BATCH 회귀 자동 검증(CBIV)을 거쳐 학습 콘텐츠 레이어에 단일 진실 원천을 제공한다."_

세부 책임 (v2.1):

1. **자료 → 노드** (Ontology + Loader)
2. **관계 추출** (RELATES_TO / PART_OF / SUPERSEDES / REFERENCES / GROUNDS)
3. **산식 추출** (math.js AST + Formula Engine)
4. **상수 추출** (DB 만, LLM 추론 0)
5. **출처 보존** (`page_ref` + `revision_change_id` NOT NULL)
6. **버전 관리 + 활성 추적** (Temporal Graph + `is_current_active` 트리거)
7. **검증 4단계** (표면 / 내용 / 학습 효과 / **Cross-BATCH = CBIV**)
8. **학습자 노출 제어** (Hybrid Search 3-Stage + Multi-Path Fallback)
9. **확장** (코어 / `exams/{id}/` / `_common/` plugin 패턴)

### 2.2 본 엔진이 해결하지 않는 것 (명시 제외)

- 학습자 UX 화면 (Phase 3)
- 학습 알고리즘 본격 구현 (FSRS-5 — Phase 2)
- 결제/인증 (apps/api)
- 실시간 자연어 답변 생성 (운영 RAG, **본 엔진의 인터페이스 사용**)

---

## 3. 방향 (Direction)

### 3.1 설계 원칙 — Hard Rules 31개 (v2.2)

기존 14개 + v2.0 추가 7개 + v2.1 추가 4개 = **25개**.

**v2.0 신설 (15~21)**:

- 15: 모든 RAG 검색은 3-Stage Hybrid Search 의무
- 16: 모든 운영 RAG 쿼리는 `is_current_active=1` 필터 의무
- 17: 신규 BATCH 적재는 **CBIV 6단계 통과 후에만** D1 INSERT
- 18: 유사도 < 0.60 시 Multi-Path Fallback 의무 (단일 안내문 금지)
- 19: FSRS 사용자 학습 데이터는 Event Sourcing
- 20: `packages/exams/_common/` 네임스페이스 예약 (Year 2)
- 21: Golden Test 영구 보존 + CI/CD 자동 재실행

**v2.1 신설 (22~25)**:

- 22: CBIV 회귀 검증은 **D1 Preview Database** 환경에서만 (in-memory 금지)
- 23: 모든 RAG 폴백 경로는 **Concurrent Execution + Short-circuit** 의무
- 24: FSRS Event Sourcing 은 **Snapshotting Pattern** 의무 (매 N건 체크포인트)
- 25: 의미 중복 검증은 **Ontology 타입별 적응형 임계값** 의무

세부: [`HARD_RULES.md`](./HARD_RULES.md) (v2.1 기준 통합 명세)

### 3.2 코어 vs Plugin 분리 (멀티시험 확장 ADR-007 본격화)

```
packages/content-build-engine/   ← 공통 코어 (변경 0)
├── ontology/                    노드/엣지/산식/상수 ID 체계 + Adaptive Threshold
├── validation/                  4단계 검증 (Cross-BATCH 포함)
├── version-management/          Temporal Graph + Materialized Active View + 트리거
├── loader/                      D1 INSERT + state-machine
└── source-citation/             page_ref + revision_change_id 추적

packages/cbiv/                   ← 5번째 코어 (v2.0 신설, 별도 패키지)
├── stages/                      6단계 자동 검증
├── runner/                      D1 Preview + golden-test-runner + root-cause-analyzer
└── reports/                     conflict-report + regression-report

packages/exams/{exam_id}/        ← 도메인 plugin (자격증마다 별도)
packages/exams/_common/          ← 멀티시험 공유 도메인 (Year 2 본격)
```

### 3.3 적재 워크플로우 (v2.1) — Claude Code 직접 처리 + CBIV

진산님 메모리 `project_batch_load_workflow.md`:

- BATCH 적재 = **Claude Code Opus 4.7** 가 진산님 대화 세션에서 직접 처리
- 진산님 트리거 키워드 → 자동 진행 (10단계, v2.0 에서 8 → 10)

10단계 절차 ([`BATCH_LOAD_PROTOCOL.md`](./BATCH_LOAD_PROTOCOL.md)):

1. 다음 ☐ BATCH 식별
2. PDF 추출
3. 도메인 분석 (Opus 4.7 직접)
4. Level 1 (표면) 검증
5. Level 2 (내용) 검증
6. Level 3 (학습 효과) 역검증
7. **Stage 6.5: CBIV 6단계 자동 검증** (v2.0 신설)
8. 진산님 검수 (+ **Stage 7.5: 의미 중복 인간 결정**, v2.0 신설)
9. D1 INSERT
10. **Stage 10: Golden Test 영구 보존 + CI/CD 등록** (v2.0 신설)

### 3.4 운영 RAG (별도 영역, 본 엔진의 사용자)

학습자 트래픽 → 본 엔진의 **3-Stage Hybrid Search** + **Multi-Path Fallback** + **Concurrent Execution** 호출.

```
[학습자 질문]
    ↓
[Concurrent Pipeline] (Promise.all)
   ├─ Vector Search (Vectorize)
   ├─ Keyword Search (D1 N-gram)
   └─ Topic Cluster Classifier
    ↓
[Hybrid Search 3-Stage]
   ├─ Stage 1: Vector Recall (similarity ≥ 0.60)
   ├─ Stage 2: Graph Filter (is_current_active=1, exam_id, status='approved')
   └─ Stage 3: Truth Weight Re-rank (LAW > FORMULA > CONCEPT)
    ↓
[answer with page_ref + revision_change_id]
```

---

## 4. 대상 (Target / Scope)

### 4.1 입력 자료

손해평가사 Year 1 기준 (`docs/manual/`, 분석결과: `docs/manual/ThePick-분석결과.md`):

| 분류      | 자료                                 | 용도                                                     |
| :-------- | :----------------------------------- | :------------------------------------------------------- |
| 교재      | 2026 이론서 835p                     | 메인 노드/산식/상수 source                               |
| 기출      | 6회 1차 + 6회 2차 (2019~2025) ~280p  | **Level 3 학습 효과 역검증** + **Golden Test 영구 보존** |
| 법령      | 농어업재해보험법 + 시행령 + 상법 68p | LAW 노드 (1차 직결)                                      |
| 26년 개정 | 한종찬 교수 정리 24p                 | **SUPERSEDES + Materialized Active View**                |
| 출제영역  | 출제영역 정의서                      | `exam_scope` 매핑 (CBIV Stage 6)                         |

### 4.2 출력 산출물

| 산출                     | 위치                                                    | 검증                                                              |
| :----------------------- | :------------------------------------------------------ | :---------------------------------------------------------------- |
| **knowledge_nodes**      | D1 (`status='draft'` → 검수 후 `approved`)              | Ontology Lock + page_ref + 4단계 검증 + **`is_current_active`**   |
| **knowledge_edges**      | D1                                                      | graph-integrity (고아/끊긴/순환 0) + **CBIV Stage 1 참조 무결성** |
| **formulas**             | D1 (UPDATE 금지)                                        | Formula Engine Golden Test 100% + **CBIV Stage 5 회귀**           |
| **constants**            | D1 (UPDATE 금지)                                        | 교재 원문 대조 + **CBIV Stage 3 일관성 (exact-match)**            |
| **revision_changes**     | D1                                                      | 26년 개정사항 → 영향 노드 SUPERSEDES                              |
| **Vectorize embeddings** | Cloudflare Vectorize                                    | **3-Stage Hybrid Search**                                         |
| **Golden Tests**         | `docs/measurements/golden-tests/` (Git, SoT) + D1 cache | **CBIV Stage 5 영구 재실행** (Hard Rule 24)                       |

### 4.3 사용자

| 사용자                               | 인터페이스                                                                                                       |
| :----------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **콘텐츠 생성기** (Phase 2 M20~M24)  | KG 쿼리 → 학습 콘텐츠 자동 생성                                                                                  |
| **운영 RAG** (Phase 3 학습자 트래픽) | 3-Stage Hybrid + Multi-Path Fallback + Concurrent                                                                |
| **학습자** (Phase 3)                 | "근거 보기" UX (`page_ref` 추적)                                                                                 |
| **검수자** (진산님)                  | **`admin-web` 의 3개 검수 큐** (의미 중복 / 출제영역 / CBIV 차단) — [`ADMIN_REVIEW_UI.md`](./ADMIN_REVIEW_UI.md) |
| **본 엔진 자체 (재진입)**            | 재적재 = SUPERSEDES (idempotent)                                                                                 |

---

## 5. 범위 (Scope Boundaries)

### 5.1 Year 1 범위 (현)

- 손해평가사 단일 자격증
- BATCH 1~7 (교재) + 법령 + 26년 개정 + 기출 (~14 BATCH × 6 Layer)
- 코어 + 도메인 모노레포 혼재 (Hard Rule 15 한시 예외)
- **CBIV BATCH-1 dry-run 전 production-ready 의무** (메타 관찰자 결정 1)
- 학습자 화면 부재 — Phase 3 진입 시 활성

### 5.2 Year 2 범위

- 손해평가사 + 1~2개 추가 자격증 (예: 공인중개사)
- `packages/content-build-engine/` 코어 추출
- `packages/cbiv/` 그대로 (도메인 무관)
- `packages/exams/{exam_id}/` plugin
- `packages/exams/_common/` 본격 활용 (민법 / 상법 공유)
- D1 마이그레이션 0014~0017+ (`exam_id` 컬럼, 활성 플래그, 트리거, Event Store)

### 5.3 명시적 비스코프

- 학습자 UX (Phase 3)
- FSRS 알고리즘 본격 구현 (Phase 2)
- 결제/인증 (apps/api)
- LLM fine-tuning (SLM/LoRA — 2027-04 동결)

---

## 6. 7 문서 체계 (v2.0 → v2.1)

본 개요서 외 **7개 영역 문서** (v2.0 에서 6 → 7, CBIV 추가):

| 문서                                                   | 책임                                                              | 주요 독자                 |
| :----------------------------------------------------- | :---------------------------------------------------------------- | :------------------------ |
| [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md) | 메인 — 5 코어 모듈 + Hybrid Search                                | 진산님 + 신규 contributor |
| [`BATCH_LOAD_PROTOCOL.md`](./BATCH_LOAD_PROTOCOL.md)   | 적재 10단계 + 검수 체크리스트                                     | Claude Code 자동 진행     |
| [`ONTOLOGY.md`](./ONTOLOGY.md)                         | ID 체계 + **Adaptive Threshold** + Hard Rule                      | 코어 + plugin 개발자      |
| [`VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md)     | Temporal Graph + **Materialized Active View**                     | 코어 + 운영 검수자        |
| [`MULTI_EXAM_EXTENSION.md`](./MULTI_EXAM_EXTENSION.md) | plugin 패턴 + **`_common/`**                                      | Year 2 plugin 개발자      |
| [`VALIDATION_FRAMEWORK.md`](./VALIDATION_FRAMEWORK.md) | 4단계 검증 (표면 / 내용 / 학습효과 / **Cross-BATCH = CBIV**)      | 검수자 + CBIV 호출자      |
| **[`CBIV.md`](./CBIV.md)**                             | **NEW** — CBIV 6단계 본격 명세 + D1 Preview + root-cause-analyzer | CBIV 개발자               |
| **[`ADMIN_REVIEW_UI.md`](./ADMIN_REVIEW_UI.md)**       | **NEW** — 3개 검수 큐 + UI 패턴 + 단축키                          | admin-web 개발자          |

[`HARD_RULES.md`](./HARD_RULES.md) — 31개 Hard Rule 통합 명세 (참조용 색인).

---

## 7. 의사결정 기록 (관련 ADR + 메모리, v2.1 갱신)

| 항목        | 위치                                                   | 핵심                       |
| :---------- | :----------------------------------------------------- | :------------------------- |
| ADR-007     | 멀티시험 Year 2 이월 + Hard Rule 15~17                 | 기존                       |
| ADR-008     | 유사도 0.60 거부 (단, **Multi-Path Fallback 진입**)    | 보강                       |
| ADR-010     | formulas/constants status canonical                    | 기존                       |
| ADR-011     | Content Build Engine = Project Core (4 → **5 모듈**)   | 보강                       |
| **ADR-012** | Hybrid Search Pipeline (Vector → Graph → Truth Weight) | **신규 P0**                |
| **ADR-013** | Materialized Active View on D1 (트리거 + KV 캐시)      | **신규 P0**                |
| **ADR-014** | Cross-Batch Integrity Validator (CBIV)                 | **신규 P0 (핵심)**         |
| **ADR-015** | Multi-Path Fallback Pipeline                           | **신규 P1**                |
| **ADR-016** | Event Sourcing for FSRS Sync                           | **신규 P1 (Phase 2)**      |
| **ADR-017** | Multi-Exam Common Foundation (Year 2 reserved)         | **신규 P2**                |
| **ADR-018** | D1 Preview Database for CBIV Regression                | **신규 P0 (v2.1)**         |
| **ADR-019** | Concurrent Execution + Short-circuit Pattern           | **신규 P0 (v2.1)**         |
| **ADR-020** | Snapshotting Pattern for FSRS Event Sourcing           | **신규 P0 Phase 2 (v2.1)** |
| **ADR-021** | Adaptive Deduplication Threshold by Ontology Type      | **신규 P0 (v2.1)**         |

| 메모리                                    | 핵심                                                     |
| :---------------------------------------- | :------------------------------------------------------- |
| `project_vision_mvp_generalization.md`    | 비전                                                     |
| `project_batch_load_workflow.md`          | Claude Code 직접 처리 + 트리거                           |
| `project_source_citation_requirement.md`  | 출처 추적성                                              |
| `project_content_build_engine_as_core.md` | **본 엔진 = 코어** + **무결성 25 위배 차단** (v2.1 보강) |

---

## 8. 진산님 메타 관찰자 결정 (확정 5건)

v2.1 PATCH 에서 메타 관찰자가 권고한 결정 5건은 DEV COVEN 검증 후 **모두 확정** (검토서 §3):

| #   | 결정                   | 확정                               |
| :-- | :--------------------- | :--------------------------------- |
| 1   | CBIV 완성 시점         | **(A) BATCH-1 dry-run 전 완성**    |
| 2   | Golden Test 보존 위치  | **(C) Git + D1 둘 다**             |
| 3   | 의미 중복 임계값       | **(C) Adaptive (Ontology 타입별)** |
| 4   | CI/CD 자동 회귀 트리거 | **(B) BATCH 적재 PR 전용**         |
| 5   | 실패 알림 채널         | **(A) GitHub PR 코멘트 최우선**    |

추가 5건 (검수 UI 영역) 은 진산님 결정 대기 — [`ADMIN_REVIEW_UI.md`](./ADMIN_REVIEW_UI.md) §14 참조.

---

## 9. 본 엔진의 무결성 (Vows, v2.1 강화)

본 엔진의 코어를 깨는 변경은 모든 plan 에서 **최우선 차단** (메모리 `project_content_build_engine_as_core.md`):

**v1.0 무결성 (유지)**:

- ❌ knowledge_nodes / formulas / constants UPDATE
- ❌ Ontology Lock 외 ID 생성
- ❌ 출처 (page_ref) 없는 노드 approved 승격
- ❌ Constants LLM 추론
- ❌ 코어 모듈에 도메인 분기 (`if examId === ...`)
- ❌ 검증 단계 우회

**v2.0 추가 무결성**:

- ❌ **CBIV 우회** (단일 BATCH 검증만으로 적재) 금지
- ❌ **Hybrid Search 우회** (Vectorize 단독 결과 사용) 금지
- ❌ **Materialized Active View 우회** (재귀 CTE 직접 사용) 금지
- ❌ **Multi-Path Fallback 우회** (단일 안내문 응답) 금지
- ❌ **FSRS LWW 사용** 금지 (Event Sourcing 만)
- ❌ **Golden Test 삭제** (진산님 승인 없이) 금지
- ❌ `_common/` Year 1 데이터 적재 금지

**v2.1 추가 무결성**:

- ❌ **in-memory SQLite** 로 CBIV 회귀 검증 금지 (D1 Preview 만)
- ❌ **순차 호출** 로 RAG 폴백 구현 금지 (Concurrent + Short-circuit)
- ❌ FSRS Event Sourcing 에 **스냅샷 미적용** 금지
- ❌ **단일 스칼라 임계값** 으로 의미 중복 검증 금지

위반 시 본 엔진의 신뢰성 0 — 본 프로젝트 전체 의미 0 (진산님 명시).

---

## 10. 다음 단계 (현 시점, v2.1 기준)

본 7 문서 체계 + ADR 10건 + 메모리 갱신 = **설계 종결**.
다음 = **구현 진입**.

진행 순서 (검토서 v2.1 §6 + 결정 1):

1. **ADR-012~021 작성** (10 ADR) — 별도 진행
2. **Epic CBE-R1 (Materialized Active View)** — 마이그레이션 0014/0015 + 트리거
3. **Epic CBE-R2 (Hybrid Search Pipeline + Concurrent)** — 검색 코어
4. **Epic CBE-R3 (CBIV)** — 6단계 + D1 Preview + Golden Test runner
5. **Epic CBE-R7 (Admin Review UI)** — 3개 큐 + 단축키
6. **BATCH-1 dry-run 진입** (CBIV 첫 production 검증, 결정 1)

총 예상 LOC ~1,800 + 4 마이그레이션. CBE-R5 (Event Sourcing) 는 Phase 2.
