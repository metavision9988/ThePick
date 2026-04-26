# Content Build Engine — 메인 명세 (v2.1)

> 본 엔진의 정체성 + 5 모듈 구조 + 외부 인터페이스 정식 정의.
> 개요/배경: [`CONTENT_BUILD_ENGINE_OVERVIEW.md`](./CONTENT_BUILD_ENGINE_OVERVIEW.md)
> v1 → v2.2 변경: 4 → **5 코어 모듈** (CBIV 신설), Hard Rules 14 → **31**, Hybrid Search Pipeline 추가.

---

## 1. 정체성 (Identity, v2.1)

> **"비구조 자료를 검증된 도메인 Knowledge Graph 로 변환하고, 변경을 신구 동시 보존(Temporal + `is_current_active`)하며, Cross-BATCH 회귀를 자동 검증(CBIV)하고, 폐기 정보 노출 없이(Hybrid Search) 학습 콘텐츠 레이어에 단일 진실 원천을 제공하는 인프라."**

본 엔진의 산출물 = **본 프로젝트의 유일한 진실 원천**. 학습자에게 노출되는 모든 콘텐츠는 본 엔진을 거쳐야 함.

---

## 2. 5 코어 모듈 (v2.0 신설: CBIV)

### 2.1 Ontology

- 노드/엣지/산식/상수 ID 체계 + **Adaptive Threshold** (v2.1 신설)
- 위치: `packages/parser/src/ontology-registry.json` + Year 2 `packages/content-build-engine/ontology/`
- 세부: [`ONTOLOGY.md`](./ONTOLOGY.md)

### 2.2 Validation Framework

- **4단계 검증** (v2.0: Cross-BATCH 추가)
  - Level 1 표면 (Ontology + schema)
  - Level 2 내용 (qg2-validator + page_ref)
  - Level 3 학습 효과 (기출 자동 풀이)
  - **Level 4 Cross-BATCH (CBIV 6단계, v2.0)**
- 세부: [`VALIDATION_FRAMEWORK.md`](./VALIDATION_FRAMEWORK.md)

### 2.3 Version Management

- Temporal Graph + SUPERSEDES + revision_changes
- **+ Materialized Active View** (`is_current_active` + 트리거 + KV 캐시) — v2.0 신설
- 세부: [`VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md)

### 2.4 Loader + Source Citation

- D1 INSERT + state-machine (draft → review → approved) + page_ref 추적
- 세부: [`BATCH_LOAD_PROTOCOL.md`](./BATCH_LOAD_PROTOCOL.md)

### 2.5 **CBIV (Cross-Batch Integrity Validator) — 신규 (v2.0)**

> _"BATCH-1 만 검증하면 BATCH-1 만 안전하다._
> _BATCH-N 적재 시 BATCH-1~(N-1) 모두 재검증해야 시스템이 안전하다._
> _그 재검증은 인간이 할 수 없다. 그래서 CBIV 가 한다."_
> — DEV COVEN (검토서 §1.8)

**6단계 자동 검증** (5 차단 + 1 인간 결정):

1. 참조 무결성 (외래키 + exam_id + approved)
2. 의미 중복 — **Adaptive Threshold** (Ontology 타입별, v2.1)
3. 상수 일관성 (exact-match, 임계값 무관)
4. SUPERSEDES 체인 (DFS 순환 + revision_change_id NOT NULL)
5. **회귀 Golden Test 재실행** (BATCH-1~N-1 의 모든 Golden 자동 재실행)
6. 출제영역 정합성 (경고만, 인간 결정)

**v2.1 보강**: 가상 D1 폐기 → **D1 Preview Database** (Wrangler `--preview`).

위치: **`packages/cbiv/`** (별도 패키지).
세부: [`CBIV.md`](./CBIV.md)

---

## 3. 외부 인터페이스

### 3.1 입력 (Input)

| 호출자                          | 인터페이스                                                                             | 빈도          |
| :------------------------------ | :------------------------------------------------------------------------------------- | :------------ |
| **Claude Code** (진산님 트리거) | 키워드 → 자동 진행 10단계 (v2.0, [`BATCH_LOAD_PROTOCOL.md`](./BATCH_LOAD_PROTOCOL.md)) | 매 BATCH 단위 |
| **재적재 / 정정**               | SUPERSEDES 패턴 (idempotent)                                                           | 비정기        |
| **개정사항 적용**               | revision_changes → SUPERSEDES + 트리거 자동 `is_current_active=0`                      | 매년 + 비정기 |

### 3.2 출력 (Output)

| 사용자                      | Read 인터페이스                                                                               |
| :-------------------------- | :-------------------------------------------------------------------------------------------- |
| **콘텐츠 생성기** (Phase 2) | `searchActiveNodes()` — `is_current_active=1` 필터 (Hard Rule 19)                             |
| **운영 RAG** (Phase 3)      | **3-Stage Hybrid Search + Multi-Path Fallback + Concurrent Execution** (Hard Rule 18, 21, 26) |
| **학습자** (Phase 3)        | "근거 보기" UX (`page_ref` / `revision_change_id`)                                            |
| **검수자** (admin-web)      | **3개 큐** ([`ADMIN_REVIEW_UI.md`](./ADMIN_REVIEW_UI.md))                                     |

### 3.3 운영 RAG — Hybrid Search Pipeline (v2.0 신설)

```
[학습자 질문]
    ↓
[Concurrent Pipeline] (Promise.all + Short-circuit) — Hard Rule 26
   ├─ Vector Search (Vectorize)
   ├─ Keyword Search (D1 N-gram)
   └─ Topic Cluster Classifier
    ↓ (가장 빠른 confident result, 최대 800ms 후 honest refusal)
    ↓
[Hybrid Search 3-Stage] — Hard Rule 18
   ├─ Stage 1: Vector Recall (similarity ≥ 0.60)
   ├─ Stage 2: Graph Hard Filter (is_current_active=1, exam_id, approved, valid_from)
   └─ Stage 3: Truth Weight Re-rank (LAW=10 > FORMULA=8 > INVESTIGATION=7 > CONCEPT=5)
    ↓ (Stage 1 miss 시 Multi-Path Fallback) — Hard Rule 21
    ↓
[answer with page_ref + revision_change_id]
```

세부: [`VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) §Materialized Active View

---

## 4. 멀티시험 확장 패턴 (ADR-007 본격화, v2.0 보강)

```
packages/content-build-engine/   ← 공통 코어 4 모듈 (변경 0)
packages/cbiv/                   ← 5번째 코어 (도메인 무관)
packages/exams/_common/          ← Year 2 멀티시험 공유 (민법, 상법) — v2.0 신설
packages/exams/{exam_id}/        ← 도메인 plugin (자격증마다)
```

세부: [`MULTI_EXAM_EXTENSION.md`](./MULTI_EXAM_EXTENSION.md)

---

## 5. Year 1 ↔ Year 2 전환 (v2.1)

| 항목               | Year 1 (현)                              | Year 2                                |
| :----------------- | :--------------------------------------- | :------------------------------------ |
| 코어 위치          | 모노레포 분산 (parser / quality / batch) | `packages/content-build-engine/` 단일 |
| CBIV               | `packages/cbiv/` (Year 1 부터 별도)      | 그대로                                |
| 도메인             | 모노레포 혼재 (Hard Rule 15 한시 예외)   | `packages/exams/{id}/` plugin         |
| 공유 도메인        | 부재                                     | `packages/exams/_common/` (민법 등)   |
| D1 스키마          | exam_id 컬럼 부재                        | exam_id 컬럼 추가 (마이그레이션 0014) |
| **활성 컬럼**      | **마이그레이션 0014/0015**               | 그대로 (v2.0 부터 Year 1 도입)        |
| **Event Sourcing** | 부재 (LWW)                               | 마이그레이션 0016/0017 (Phase 2)      |

---

## 6. 무결성 위배 시 행동 (v2.2, 31 Hard Rule)

| 위반                                            | 차단 메커니즘                                                                           |
| :---------------------------------------------- | :-------------------------------------------------------------------------------------- |
| knowledge_nodes / formulas / constants UPDATE   | D1 트리거 `prevent_X_update` (Hard Rule 1, 2)                                           |
| Ontology Lock 외 ID                             | schema-validator + `validateKnowledgeContract`                                          |
| 출처 없는 노드 approved 승격                    | state-machine `transitionStatus` 거부                                                   |
| Constants LLM 추론                              | Hard Limit + 코드 review (lint 룰 후반)                                                 |
| 코어에 도메인 분기                              | ESLint `no-restricted-syntax` (Rule 15)                                                 |
| **CBIV 우회**                                   | Loader 가 CBIV 통과 표시 없으면 INSERT 거부 (Rule 17)                                   |
| **Vectorize 단독 결과 사용**                    | 운영 RAG 코드 review + Hard Rule 18                                                     |
| **재귀 CTE 직접 사용**                          | code review + Hard Rule 19                                                              |
| **단일 안내문 응답 (Multi-Path Fallback 우회)** | Hard Rule 21                                                                            |
| **FSRS LWW 패턴**                               | code review + Hard Rule 22                                                              |
| **Golden Test 삭제**                            | git pre-commit + 진산님 승인 절차                                                       |
| **`_common/` Year 1 데이터 적재**               | git pre-commit + 디렉토리 README guard                                                  |
| **in-memory SQLite CBIV**                       | CBIV runner factory 거부 (`d1-preview-runner.ts` 만 export) — Rule 22                   |
| **순차 호출 RAG 폴백**                          | code review + Hard Rule 26                                                              |
| **Snapshot 미적용 FSRS**                        | sync-service runtime 검증 + Hard Rule 27                                                |
| **단일 스칼라 임계값 의미 중복**                | CBIV Stage 2 가 ontology-registry.json 의 `deduplication_threshold` 직접 참조 — Rule 25 |

---

## 7. 현 단계 (Year 1 BATCH-1 dry-run 직전, v2.1)

`docs/plans/batch-loadmap.md` v1 — 14 BATCH × 6 Layer (도메인) + Layer 7 Cross-BATCH 통합.

본 엔진의 첫 production 검증 = **BATCH-1 시범 적재 (dry-run) + CBIV 첫 가동**.

진산님 결정 1 (메타 관찰자): **CBIV 가 BATCH-1 dry-run 전 production-ready 상태** 의무. 즉 본 엔진 코어 5개 + Hybrid Search + Multi-Path Fallback + Materialized Active View 모두 BATCH-1 진입 전 완성.

총 예상 작업: ~1,800 LOC + 4 마이그레이션 + 10 ADR. 검토서 §6.
