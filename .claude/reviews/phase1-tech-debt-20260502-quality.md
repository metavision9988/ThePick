# Phase 1 5-페르소나 기술부채 심층 리뷰 — quality-engineer

**작성일**: 2026-05-02 ~15:30 KST
**리뷰 방식**: 독립 에이전트 (`quality-engineer`, agentId `a3d09b16418b75a03`)
**페르소나 핵심 질문**: "프로덕션에서 뭐가 물릴까?"
**리뷰 범위**: 7 컴포넌트 1164 tests + Master Plan 50 시나리오 + AC 매트릭스
**4-Pass §5.5 quality-engineer 직전 결과 중복 회피 검증 완료**

---

## 컨텍스트 인지

### 0.1 §5.5 4-Pass quality-engineer (직전 본인) 흡수

- 직전 4-Pass scope: verify-engine-contracts +140 lines (Cat 5 일관성). C1 흡수 + 5 MAJOR
- **본 5-페르소나 호출 scope**: 7 컴포넌트 1164 tests **전체** + Master Plan 50 시나리오 + AC 매트릭스. **다른 의도** — Phase 1 종료 게이트 (BATCH-1 진입 차단 + Phase 2 트래킹)

### 0.2 2026-05-01 5-페르소나 quality (1차) 흡수 결과

- CRIT-Q1 admin-web 0 tests — **미흡수 → 본 CRIT-QPHASE1-1 재제기 (1주 영속)**
- CRIT-Q2 write-helper.test.ts — **흡수 PASS** 확인
- CRIT-Q3 트리거 정규식 fragile — 미확인 (영속 추정)

---

## CRITICAL — BATCH-1 진입 차단 의무 (3건)

### CRIT-QPHASE1-1 — admin-web 테스트 0건 (1차 리뷰 1주 영속)

**증거**:

- `find apps/admin-web -name "*.test.*"` → 0건
- `TelemetryDashboard.tsx`: 482 lines (1차 리뷰 393 → +89 lines 미검증 확장)
- `GraphVisualizer.tsx` 249 / `ContentQueue.tsx` 162 — 모두 0 tests

**프로덕션 리스크 (BATCH-1 적재 hot path)**:

1. 30초 폴링 hot loop — fetch race / unmount setState / 401 token clear race 모두 단위 테스트 0건
2. localStorage token race (2 탭) — `storage` event listener 부재
3. CRITICAL-DO-1 흡수 (resolveApiBase throw) build-time 검증 0건
4. GraphVisualizer D3 cleanup / SVG 누적 0 tests
5. ContentQueue (Reviewer 큐) Phase 1 후반 의무 — 0 tests

**권고**:

- vitest + @testing-library/react 도입 + 최소 8 tests
- master-test-checklist.md Cat 1.1 에 `@thepick/admin-web` 행 추가

### CRIT-QPHASE1-2 — Master Plan v1.0.2 footnote 6건 BATCH-1 expansion 자동 trigger 부재

**증거**:

- Master Plan line 895-905 footnote 6건 모두 "BATCH-1 적재 시점 expansion 의무" 명시
- `verify-engine-contracts.ts:443~449` notes 텍스트만 존재 — 자동 검증 FAIL trigger 부재
- `grep "expansion.*trigger\|trigger.*expansion"` → 0건

**프로덕션 리스크**:

1. BATCH-1 적재 시 silent skip — PRC-01 framework 131 PASS → expansion 124건 미실행 → "footnote 의무 위배" 무관측 → 메모리 `feedback_no_shortcuts` 직접 위배
2. REC-02 chain-of-custody 결정 미실행 → footnote 영속 부채 자동 누적
3. PRF-01 51 산식 vs 6 sample 갭 — 자동 검증 부재
4. FUZ-04 vector 8 결정 메커니즘 부재

**권고**:

- `scripts/verify-engine-contracts.ts` Cat 9 신규 (또는 Cat 6 보강) — `EXPANSION_OBLIGATIONS` 배열
- BATCH-1 fixture 적재 감지 시 expansion 미실행 = exit 1
- master-test-checklist §6 "footnote 6건 진척도" 표 신규 (현 0/6)

### CRIT-QPHASE1-3 — Hard Rule 13 (status='draft' 강제) e2e 검증 부재

**증거**:

- `state-machine.test.ts` 12+ tests — 단위 검증 PASS
- 통합 e2e (BATCH 파이프라인 → loader → D1 INSERT → status='draft' 강제) 0건
- D1 트리거 미설치 (0014 prevent_knowledge_nodes_update 는 UPDATE 차단, INSERT status='approved' 차단 X)
- `loader/draft-loader.ts` 의 status='draft' 항상 강제 자동 검증 0건

**프로덕션 리스크**:

1. BATCH-1 적재 시 status='approved' bypass — 코드 회귀 또는 Claude 응답 schema drift 시
2. Reviewer 큐 적재 미검증
3. 출처 추적성 부재 (source_id NULL) 조용히 INSERT — 메모리 `project_source_citation_requirement` 위배

**권고**:

- `pipeline.integration.test.ts` 신규 5 tests (e2e BATCH-1 fixture → SELECT status WHERE batch_run_id → 100% 'draft' 검증)
- 마이그레이션 0018 신규 — `prevent_non_draft_insert` 트리거 + source_id NOT NULL CONSTRAINT
- master-test-checklist Cat 6 행 자동 검증 전환

---

## MAJOR — 8건 (Phase 2 명시 트래킹)

|  #  | ID            | 제목                                         | 흡수 시점                               |
| :-: | :------------ | :------------------------------------------- | :-------------------------------------- |
|  1  | MAJ-QPHASE1-1 | apps/web (PWA) 테스트 0건                    | Phase 2 Step 21 mini-step               |
|  2  | MAJ-QPHASE1-2 | Property-based test 비대칭 (2/7 패키지)      | Phase 2 mini-step (CRIT-QPHASE1-2 동시) |
|  3  | MAJ-QPHASE1-3 | Cat 8 LLM 출력 품질 검증 0건                 | Phase 1 후반 별도 plan                  |
|  4  | MAJ-QPHASE1-4 | Cat 5B 성능 벤치 0건                         | Phase 2 Step 21                         |
|  5  | MAJ-QPHASE1-5 | engine_telemetry FK 운영 시나리오            | Phase 2 진입 게이트                     |
|  6  | MAJ-QPHASE1-6 | Mock vs 실 D1 (better-sqlite3 동등 가정)     | Phase 2 wrangler dev smoke              |
|  7  | MAJ-QPHASE1-7 | fakeTimers 13건 cleanup race 미검증          | Phase 2 mini-step + lint rule           |
|  8  | MAJ-QPHASE1-8 | Vectorize 통합 테스트 0건 (BATCH-1 hot path) | Phase 2 진입 게이트                     |

---

## MINOR — 5건

- MIN-QPHASE1-1: payment / study-material-generator / parser-1st-exam 3 패키지 scripts.test 부재
- MIN-QPHASE1-2: 1164 tests 실행 시간 측정 부재
- MIN-QPHASE1-3: ESLint `no-skipped-tests` rule 부재
- MIN-QPHASE1-4: 1차 MIN-Q1 SCENARIO_MIGRATIONS 0013-0017 미포함 영속
- MIN-QPHASE1-5: describe/it 한국어 + 영어 혼용 컨벤션 부재

---

## Devil's Advocate (3 시나리오)

### 시나리오 1: BATCH-1 적재 첫 시도 — 23:47 KST

**현 시점 무관측**:

1. CRIT-QPHASE1-3 직접 발화 — status='approved' 또는 source_id=NULL INSERT silent
2. CRIT-QPHASE1-2 직접 발화 — PRC-01 framework 131 PASS → expansion 124건 미실행
3. CRIT-QPHASE1-1 직접 발화 — admin-web fetch race → "BATCH-1 동작 안 함" 30분 진단

### 시나리오 2: BATCH-3 적재 중 Cron 24h 미발화

- CHA-06 fakeTimers 가 actual delivery semantics 와 동등 가정 검증 0건

### 시나리오 3: Vectorize 메타 exam_id 누락 회귀 (Year 2)

- ADR-004 §3 정합 위배 회귀 무관측 — MAJ-QPHASE1-8 functional test 0건

---

## 누적 이월 MAJOR 36건 흡수 권고 — quality 영역 8건

**Phase 1 closeout 이전 (BATCH-1 진입 차단 게이트)**:

- CRITICAL 3건 흡수 (~2일 작업)

**Phase 2 진입 mini-step (Step 21)**:

- MAJ-QPHASE1-1/2/4/5/6/7/8 흡수 (~1주, master-test-checklist v3 영속)

**Phase 1 후반 (LLM 통합 + Reviewer 큐)**:

- MAJ-QPHASE1-3 흡수 (Cat 8) — 별도 plan

---

## 판정

**CRITICAL 3건 — BATCH-1 진입 차단 의무 게이트 미통과**

`master-test-checklist §0.1` "Step 20 BATCH-1 적재 진입 차단 게이트" 정합. 본 5-페르소나 quality-engineer 는 다음 3건 흡수 전 **BATCH-1 적재 진입 거부**:

1. CRIT-QPHASE1-1 즉시: admin-web vitest + 8 tests (1차 영속 1주 → 우선)
2. CRIT-QPHASE1-2 즉시: footnote 6건 automation trigger
3. CRIT-QPHASE1-3 즉시: Hard Rule 13 e2e + 마이그레이션 0018

MAJOR 8건은 Phase 2 진입 게이트로 명시 이월.

---

**원본 에이전트**: `quality-engineer` (agentId: `a3d09b16418b75a03`)
