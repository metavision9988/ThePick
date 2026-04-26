# ADR-011: Content Build Engine — Project Core Identity (v2.1)

작성일: 2026-04-26
**개정 v2.1**: 2026-04-26 (DEV COVEN 검토 v2.0 + v2.1 PATCH 흡수)
상태: Accepted (진산님 명시 결정)
관련: ADR-007, ADR-010, **ADR-012~021** (v2.0/v2.1 신규)

---

## Context (배경, v2.1)

본 프로젝트(쪽집게/ThePick)는 손해평가사 자격시험 학습 서비스로 시작했으나, 진산님 비전 (메모리 `project_vision_mvp_generalization.md`)은 **자격증 도메인별 Graph RAG + 훈련 콘텐츠 무한 자동 생성 엔진**.

2026-04-25 ~ 26 진산님 명시:

1. _"이 BATCH 처리하는 체계는 이 프로젝트의 머리·지능 코어이자 인프라."_
2. _"이 기반 위에서 서비스 기능·콘텐츠들이 자라난다."_
3. _"가장 중요하다. 시스템이 붕괴되어도 이것만 있으면 된다."_
4. _"손해평가사 외에 다른 자격증 서비스 개발 시에도 이 엔진을 기본으로."_
5. _"버전 관리 즉 법률이나 산식 수치, 논리의 변경 등이 자주 발생하니 필요하다."_

DEV COVEN 8 페르소나의 비판 검토 (v2.0) 후 7개 결함 + 4개 메타 반론 (v2.1) 모두 흡수.

---

## Decision (결정, v2.1)

### 1. Content Build Engine 을 본 프로젝트의 코어 정체성으로 격상

본 엔진의 산출물 = **본 프로젝트의 유일한 진실 원천**.

### 2. 5 코어 모듈 정식 정의 (v2.0: CBIV 추가)

| 모듈                     | 책임                                                                                   |
| :----------------------- | :------------------------------------------------------------------------------------- |
| Ontology                 | 노드/엣지/산식/상수 ID 체계 + Adaptive Threshold (v2.1) + Hard Rule + 도메인 확장 패턴 |
| Validation Framework     | **4단계 검증** (표면 / 내용 / 학습 효과 / Cross-BATCH = CBIV)                          |
| Version Management       | Temporal Graph + SUPERSEDES + revision_changes + **Materialized Active View** (v2.0)   |
| Loader + Source Citation | D1 INSERT + state-machine + page_ref 추적                                              |
| **CBIV** (v2.0 신설)     | **Cross-Batch 회귀 자동 검증** — 6단계 (5 차단 + 1 인간 결정)                          |

### 3. 멀티시험 확장 패턴 명시 (v2.0 보강)

```
packages/content-build-engine/   ← 공통 코어 4 모듈
packages/cbiv/                   ← 5번째 코어 (별도 패키지)
packages/exams/_common/          ← Year 2 멀티시험 공유 (v2.0 신설)
packages/exams/{exam_id}/        ← 도메인 plugin
```

### 4. 7 문서 체계 + Admin Review UI 정식화

`docs/architecture/`:

- `CONTENT_BUILD_ENGINE_OVERVIEW.md`
- `CONTENT_BUILD_ENGINE.md`
- `BATCH_LOAD_PROTOCOL.md` (10단계, v2.0)
- `ONTOLOGY.md`
- `VERSION_MANAGEMENT.md`
- `MULTI_EXAM_EXTENSION.md`
- `VALIDATION_FRAMEWORK.md`
- **`CBIV.md`** (v2.0 신규)
- **`ADMIN_REVIEW_UI.md`** (v2.0 신규)

### 5. Hard Rules 31개 (v2.2)

기존 14개 + v2.0 신설 7개 (15~21) + v2.1 신설 4개 (22~25).

### 6. 본 엔진 무결성 위배 시 모든 plan 에서 최우선 차단

v2.1 추가 무결성:

- ❌ CBIV 우회 (단일 BATCH 검증만으로 적재) 금지
- ❌ Hybrid Search 우회 (Vectorize 단독 결과 사용) 금지
- ❌ 재귀 CTE 직접 사용 금지 (Materialized Active View 의무)
- ❌ Multi-Path Fallback 우회 (단일 안내문 응답) 금지
- ❌ FSRS LWW 사용 금지 (Event Sourcing + Snapshotting)
- ❌ Golden Test 진산님 승인 없이 삭제 금지
- ❌ `_common/` Year 1 데이터 적재 금지
- ❌ in-memory SQLite CBIV 회귀 검증 금지 (D1 Preview 만)
- ❌ 순차 호출 RAG 폴백 금지 (Concurrent + Short-circuit)
- ❌ FSRS Snapshot 미적용 금지
- ❌ 단일 스칼라 임계값 의미 중복 검증 금지

### 7. BATCH 적재 = Claude Code (Opus 4.7) 직접 처리 (메모리 정합)

본 엔진의 적재 워크플로우 = Claude Code 가 진산님과의 대화 세션에서 직접 처리 (메모리 `project_batch_load_workflow.md`).

### 8. 메타 관찰자 결정 5건 확정 (v2.1)

1. CBIV 완성 시점: **(A) BATCH-1 dry-run 전 완성**
2. Golden Test 보존: **(C) Git + D1 둘 다**
3. 의미 중복 임계값: **(C) Adaptive (Ontology 타입별)**
4. CI/CD 트리거: **(B) BATCH 적재 PR 전용**
5. 알림 채널: **(A) GitHub PR 코멘트 최우선**

---

## Consequences (결과)

### 긍정적

1. **명확성**: 본 프로젝트 코어 명문화. 모든 plan 우선순위가 본 엔진 보호로 정렬.
2. **확장성**: Year 2 멀티시험 plugin 패턴.
3. **신뢰성**: CBIV 가 Cross-BATCH 회귀 자동 검증 → 인간 검수 한계 돌파.
4. **버전 관리**: Materialized Active View 로 운영 성능 보장 + Temporal Graph 보존.
5. **검증 깊이**: 4단계 검증 (특히 Level 4 Cross-BATCH) 으로 진산님 비전 직결.
6. **운영 안전**: D1 Preview Database (CBIV) + Concurrent Execution (Multi-Path Fallback) + Snapshotting (FSRS) → production scale 대비.

### 부정적 / Trade-offs

1. 가-1 plan 일부 재정의: BATCH 적재가 Claude Code 직접 처리로 이전됨에 따라 가-1 Group A-1 (Claude API smoke) / Group B (Mock simulation) 의미가 운영 RAG 용으로 좁혀짐.
2. batch-processor.ts 등 코드 단순화 PR 필요.
3. 본 결정 채택으로 **CBIV 모듈 신규 작성 ~600 LOC + 마이그레이션 0014~0017+ 4건 + Admin Review UI ~28 task ≈ 8h** 추가 작업 발생.
4. Year 2 전환 비용 사전 점검 필요 — `MULTI_EXAM_EXTENSION.md` + 시뮬 fixtures.

### 즉시 영향

- `docs/plans/current.plan.md` (가-1 plan) 갱신 — 본 결정 흡수
- `docs/plans/batch-loadmap.md` 갱신
- 메모리 `project_content_build_engine_as_core.md` v2.1 갱신
- 7 문서 + ADMIN_REVIEW_UI 작성 (본 ADR 동시 작성)
- ADR-012~021 (10건 신규)

### 검증 (본 ADR 적용 정도)

본 ADR 채택 후 모든 plan / 검토에서 자체 검증:

- [ ] 본 plan 이 본 엔진 코어 무결성 25개 중 하나 위배?
- [ ] 본 plan 이 도메인 분기 (`if examId ===`) 를 코어에 추가?
- [ ] 본 plan 이 출처 (`page_ref`) 누락?
- [ ] 본 plan 이 검증 4단계 (특히 Level 4 CBIV) 우회?
- [ ] 본 plan 이 in-memory SQLite, 재귀 CTE, 순차 RAG 폴백, LWW, 단일 임계값 중 하나 사용?

위 5 항목 중 하나라도 ✅ → plan 즉시 차단 / 재설계.
