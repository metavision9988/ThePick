# 19개 산출물 감사 보고서 (DEV COVEN 8 페르소나 합동)

> **작성:** 2026-04-26 (메피스토펠레스 + 작업 파트너 모드)
> **검토 범위:** 9개 architecture 문서 + 10개 ADR + 1 메모리 = 19개
> **검토 방법:** Cross-document consistency + 누락 항목 + 트레이드오프 + 실행 가능성
> **상위:** [재정립안 v2.1 PATCH](./CONTENT_BUILD_ENGINE_REDESIGN_v2_1_PATCH.md)

---

## 0. 핵심 진단 한 줄

> "**큰 그림은 80점, 마무리 디테일은 60점.**
> 검토자(메타 관찰자)의 본질적 통찰은 시스템에 새겼지만,
> **그 시스템 자체의 내부 정합성**에서 8건의 결함을 발견."

---

## 1. 즉시 수정 필요 (P0 — production 진입 전 필수)

### 🔴 R-1: Hard Rule 번호 충돌 (Critical)

**문제:**

- `HARD_RULES.md` 의 **Rule 15** = "Hybrid Search 의무"
- `production-quality.md` 의 **Rule 15** = "코어에 도메인 분기 금지" (기존)
- `MULTI_EXAM_EXTENSION.md §3` "Hard Rule 15 (코어 도메인 분기 금지)" 표기
- `ONTOLOGY.md §1` "Year 1 한시 예외 (Hard Rule 15)" 표기

**같은 번호 (15) 가 두 가지 의미로 사용됨!**

**영향:** Claude Code 가 코드 작성 시 어느 Rule 을 참조해야 할지 모호. 실수 유발.

**수정안:**

- `production-quality.md` 의 기존 Rule 15~17 (도메인 분기 금지 등) → **Rule 15.1, 15.2, 15.3** 또는 별도 prefix (`PQ-15`)
- 또는 `HARD_RULES.md` 의 v2.0 신설 번호를 **30~40번대**로 이동
- **권고:** 통합 색인 (`HARD_RULES.md`) 에 production-quality.md 의 Rule 들을 명시 흡수, 25개 → 28개로 확장

**작업 시간:** ~30분

---

### 🔴 R-2: 마이그레이션 0014 의 의미 충돌 (Critical)

**문제:**

- `VERSION_MANAGEMENT.md`: **마이그레이션 0014** = `is_current_active` 컬럼 추가
- `MULTI_EXAM_EXTENSION.md §4`: **마이그레이션 0014** = `exam_id` 컬럼 추가 (Year 2 ADR-007 기존)

**같은 번호 (0014) 가 두 다른 마이그레이션을 가리킴!**

**영향:** 실제 마이그레이션 파일 명명 시 충돌 → 적용 순서 혼란.

**수정안:**
| 마이그레이션 | 시점 | 새 번호 | 내용 |
|---|---|---|---|
| `0014_add_active_columns.sql` | Year 1 (현, v2.0) | **0014** | `is_current_active` + `current_version_id` |
| `0015_supersedes_trigger.sql` | Year 1 (현, v2.0) | **0015** | SUPERSEDES 자동 동기화 트리거 |
| `0016_user_review_events.sql` | Phase 2 (Event Sourcing) | **0016** | FSRS Event Sourcing 테이블 |
| `0017_user_card_state.sql` | Phase 2 (Snapshotting) | **0017** | FSRS 스냅샷 테이블 |
| `0018_add_exam_id.sql` | Year 2 (멀티시험) | **0018** | `exam_id` 컬럼 + 백필 |

**MULTI_EXAM_EXTENSION.md 수정 필요**: Year 2 마이그레이션 번호를 0014 → **0018** 로 갱신.

**작업 시간:** ~15분

---

### 🔴 R-3: exam_id 의 Year 1/2 시점 모순 (Critical)

**문제:**

- `CBIV.md` Stage 1 (참조 무결성): "exam_id 일치 (멀티시험 격리)"
- `BATCH_LOAD_PROTOCOL.md` Stage 6.5: "외래키 + exam_id"
- → **CBIV 가 exam_id 컬럼을 검증함**
- 그러나 `MULTI_EXAM_EXTENSION.md`: "Year 1 D1 스키마 = exam_id 컬럼 부재"

**CBIV 는 Year 1 부터 동작해야 하는데, exam_id 가 Year 2 에 추가됨 → 모순!**

**영향:** CBIV Stage 1 코드가 Year 1 에서는 fail 또는 skip 분기 필요 → 코드 복잡도 증가.

**수정안 (2가지):**

**(A) Year 1 부터 exam_id 컬럼 도입** ✅ 권장

- 마이그레이션 0014 와 함께 exam_id 도 추가 (default: `'son-hae-pyeong-ga-sa'`)
- CBIV 가 단순한 검증 로직 유지 가능
- Year 2 진입 시 마이그레이션 0018 = "default 제거 + 기존 행은 이미 채워져 있음"

**(B) CBIV 에 Year 1/2 분기 추가**

- `if (year === 1) skip exam_id check`
- → Hard Rule 15 (코어에 도메인 분기 금지) 위반
- ❌ 비권장

**권고:** **(A)** — `MULTI_EXAM_EXTENSION.md §4` "Year 2 전환 PR" 수정:

- 기존: "D1 스키마 exam_id 컬럼 부재 → exam_id 컬럼 추가"
- 수정: "Year 1 부터 default 값으로 exam_id 컬럼 도입, Year 2 에서 default 제거"

**작업 시간:** ~20분 (마이그레이션 0014 갱신 + MULTI_EXAM_EXTENSION.md 수정)

---

### 🔴 R-4: SEARCH_PIPELINE.md 부재 (Critical 누락)

**문제:**

- `HARD_RULES.md` Rule 15: "3-Stage Hybrid Search 의무"
- Rule 18: "Multi-Path Fallback 의무"
- Rule 23: "Concurrent Execution + Short-circuit 의무"
- → **3개 규칙이 모두 운영 RAG 검색을 다루나, 통합 명세 문서 부재**

**현재 분산:**

- Hybrid Search: `CONTENT_BUILD_ENGINE.md §3.3` 다이어그램만
- Multi-Path Fallback: `HARD_RULES.md` 만 언급
- Concurrent Execution: `HARD_RULES.md` 만 언급
- v2.0 PATCH 산출물에 있으나 19개 산출물에 흡수 안 됨

**영향:** 운영 RAG 구현 시 어느 문서를 봐야 할지 분산. 페르소나 (HACKER) 가 코드 작성 시 검색 누락 가능.

**수정안:** **`SEARCH_PIPELINE.md` 신설** — 코어 모듈 6번째 (Search) 또는 Validation 모듈 자식 문서.

**문서 구조:**

```
docs/architecture/
└── SEARCH_PIPELINE.md  (신규)
    ├── §1 본 모듈의 책임
    ├── §2 3-Stage Hybrid Search (Rule 15)
    │   ├─ Stage 1: Vector Recall
    │   ├─ Stage 2: Graph Hard Filter
    │   └─ Stage 3: Truth Weight Re-rank
    ├── §3 Multi-Path Fallback (Rule 18)
    │   ├─ Stage 1: Vector
    │   ├─ Stage 2: Keyword
    │   ├─ Stage 3: Topic Cluster
    │   └─ Stage 4: Honest Refusal
    ├── §4 Concurrent Execution + Short-circuit (Rule 23)
    │   └─ Promise.all + Race + 800ms timeout
    ├── §5 통합 흐름 (3 모두 결합)
    │   └─ 다이어그램 (1장)
    ├── §6 코드 위치
    ├── §7 테스트 기준
    └── §8 무결성 (Vows)
```

**작업 시간:** ~2시간

---

### 🔴 R-5: BATCH 적재 워크플로우 PR vs CLI-direct 모순 (Critical)

**문제:**

- `ADMIN_REVIEW_UI.md §4.3` 큐 3 예시: "Pull Request: #142"
- 그러나 메모리 `project_batch_load_workflow.md`: "BATCH 적재 = Claude Code 가 진산님과 직접 처리"
- v2.1 CI/CD `cbiv-regression.yml`: "pull_request" 트리거

**모순:**

- (a) BATCH 적재 = Claude Code 가 직접 D1 INSERT (PR 없음)
- (b) BATCH 적재 = Claude Code 가 PR 생성 → CI 가 CBIV 실행 → 통과 시 머지 → D1 INSERT

**v2.1 의 "결정 4 (BATCH 적재 PR 전용 CI 트리거)" 는 (b) 가정.**

**영향:** Stage 8 (D1 INSERT) 시점이 명확하지 않음.

**수정안:** **(b) 채택** — BATCH 적재는 PR-based 워크플로우.

**근거:**

- CBIV 의 자동화 + CI/CD 통합 = PR 워크플로우 본질
- 진산님 검수 (Stage 7) = PR 코멘트 review
- D1 INSERT 는 CI 가 PR 머지 시 자동 실행
- audit log + Rollback = git 히스토리 + revert PR 패턴

**`BATCH_LOAD_PROTOCOL.md` 수정 필요:**

```
[Stage 8] D1 INSERT (개정)
  - Claude Code 가 BATCH 적재 PR 생성
  - PR 본문: Stage 1~7 결과 + CBIV 결과 + 진산님 검수 메모
  - CI 자동 실행: cbiv-regression.yml
  - 진산님 PR 머지 → CI 가 wrangler d1 execute 로 D1 INSERT
  - audit log: PR 번호 + 머지 commit hash
```

**작업 시간:** ~30분 (BATCH_LOAD_PROTOCOL.md + ADMIN_REVIEW_UI.md 갱신)

---

## 2. 보강 필요 (P1 — BATCH-1 dry-run 전 권장)

### 🟠 R-6: 검수 결정 → DB 변경 매핑 부재

**문제:**

- ADMIN_REVIEW_UI.md 큐 1 액션: Merge / Reject / Keep Both
- 그러나 각 액션이 실제 D1 에 어떤 변경을 일으키는지 명세 부재
- 특히 **Merge** 가 Hard Rule 1 (UPDATE 금지) 와 충돌 가능

**상세 분석:**

| 액션          | 의도                            | 실제 D1 변경                                               | Hard Rule 정합성   |
| ------------- | ------------------------------- | ---------------------------------------------------------- | ------------------ |
| **Merge**     | 신규 폐기, 기존에 page_ref 추가 | 신규 노드 INSERT 안 함 + 기존 노드의 page_ref 필드 UPDATE? | ⚠️ **Rule 1 위반** |
| **Reject**    | 신규 적재 거부                  | 신규 노드 INSERT 안 함                                     | ✓                  |
| **Keep Both** | 둘 다 별개 노드                 | 신규 노드 INSERT + 명시적 RELATES_TO 엣지                  | ✓                  |

**Merge 의 문제:**
기존 노드의 page_ref 가 ["422"] 였는데 신규의 page_ref ["543"] 도 추가하려면:

- (a) `UPDATE knowledge_nodes SET page_ref = '422,543' WHERE id = 'F-04'` ← Rule 1 위반!
- (b) page_ref 를 별도 테이블로 분리: `node_page_refs (node_id, page_ref)` → INSERT 만 → ✓
- (c) Merge 시에도 새 버전 노드 생성 + SUPERSEDES 패턴

**권고:** **(b)** — `node_page_refs` 별도 테이블 신설 (마이그레이션 0019, Year 1 후반).

**또는 (c)** — Merge = SUPERSEDES 패턴 (가장 안전, Temporal Graph 일관성):

```sql
-- 기존: F-04 (page_ref=422)
-- 신규: F-30 (page_ref=543) → flag → Merge 결정
-- 처리:
INSERT INTO knowledge_nodes (id='F-04-v2', name='...', page_ref='422,543', ...);
INSERT INTO knowledge_edges (from='F-04-v2', to='F-04', relation='SUPERSEDES');
INSERT INTO knowledge_edges (from='F-04-v2', to='F-30', relation='SUPERSEDES');
-- 트리거: F-04, F-30 both is_current_active = 0
-- F-04-v2 는 is_current_active = 1
```

**(c) 권장 — Merge 도 INSERT-only, Hard Rule 1 보존**

**작업 시간:** ~1시간 (ADMIN_REVIEW_UI.md 에 "결정 → DB 변경" 섹션 추가)

---

### 🟠 R-7: Rollback 의 INSERT-only 메커니즘 부재

**문제:**

- ADMIN_REVIEW_UI.md §5.4: "결정 후 24시간 내 취소 가능"
- 그러나 Merge 한 노드를 Rollback 시 폐기된 신규 노드 복원? → UPDATE 패턴?
- 그 사이 다른 BATCH 가 적재되었으면 Cross-BATCH 영향?

**수정안: Rollback 도 INSERT-only**

```sql
CREATE TABLE review_decisions (
  id TEXT PRIMARY KEY,
  decision_type TEXT NOT NULL,  -- 'merge' / 'reject' / 'keep_both'
  flag_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  decided_at INTEGER NOT NULL,
  d1_changes JSON NOT NULL,     -- 적용된 D1 변경 내역
  reverted INTEGER DEFAULT 0,   -- 0/1
  reverted_at INTEGER NULL,
  reverted_by TEXT NULL
);

-- Rollback 시: 새 결정 INSERT (decision_type='revert', original_decision_id=...)
-- 트리거: original_decision 의 reverted=1 갱신 (메타만, 본문 유지)
-- 그리고 d1_changes 의 역연산 INSERT
```

**작업 시간:** ~45분 (ADMIN_REVIEW_UI.md 보강 + 마이그레이션 0020 설계)

---

### 🟠 R-8: BATCH-1 시점 CBIV Stage 5 동작 미명문

**문제:**

- CBIV Stage 5 = "BATCH-1 ~ BATCH-(N-1) 의 모든 Golden Test 재실행"
- BATCH-1 적재 시점 = 이전 BATCH 0건 → Stage 5 가 빈 패스
- v2.1 PATCH 에서 "BATCH-2 진입 즉시 critical" 로만 언급, BATCH-1 자체 처리 미명문

**해석 가능성:**

- (a) BATCH-1 시 Stage 5 skip (이전 BATCH 0건)
- (b) BATCH-1 자체의 Golden Test 를 self-test 로 실행 (BATCH-1 적재 + BATCH-1 Golden = 100% 통과 보장)

**권고:** **(b)** — BATCH-1 Golden Test 의 self-validation 으로 CBIV Stage 5 의 동작 검증.

**근거:**

- (a) skip = CBIV 실제 동작 검증 없이 BATCH-2 진입 → Day 1 risk
- (b) self-test = "BATCH-1 적재 데이터로 BATCH-1 Golden Test 100% 통과" 검증 → CBIV 자체 검증

**`CBIV.md` 수정 필요:**

```
Stage 5 동작 (BATCH-N 별):
- N=1: BATCH-1 자체 Golden Test 실행 (self-validation, CBIV 동작 확인)
- N≥2: BATCH-1 ~ BATCH-(N-1) + BATCH-N 모든 Golden Test 회귀 실행
```

**작업 시간:** ~20분

---

### 🟠 R-9: 진산님 단일 검수자의 SPOF 미명문

**문제:**

- BATCH-1~14 적재 + 모든 검수 = 진산님 1인
- 큐 1 적체 시 BATCH-2 진입 못 함 → 전체 일정 지연
- 진산님 부재 (병가, 휴가) 시 시스템 정지
- ADVOCATE 가 강조한 "검수자 피로감" 의 본질적 원인

**현재 상태:**

- 19개 산출물에 백업 검수자 정책 없음
- "Year 1 단일 검수자 수용" 명시도 없음

**수정안 (3가지):**

**(A) 명시적 수용**

- `OPERATIONS_RISK.md` (신규) 에 "Year 1 단일 검수자 SPOF 수용" 명시
- 부재 시 BATCH 적재 중단 (안전 우선)

**(B) AI 자동 채택 활용 (위험)**

- 결정 7 의 (A) 옵션 (95%+ 자동 채택) 적용
- → SENTINEL 반대 (책임 분산)

**(C) 신뢰 검수자 위임**

- Year 1 후반 또는 Year 2 진입 시 신뢰 인력 1~2명 권한 부여
- 가장 현실적

**권고:** **(A) + (C) 조합**:

- Year 1 = (A) 단일 검수자 수용 + 명시 문서화
- Year 2 = (C) 백업 검수자 1명 추가

**작업 시간:** ~30분 (OPERATIONS_RISK.md 신설)

---

### 🟠 R-10: page_ref 정밀도 정책 부재

**문제:**

- "근거 보기" 클릭 → 교재 정확한 위치 (ADVOCATE 강조)
- page_ref = "422" 라는 단일 페이지 번호로는 한 페이지에 여러 노드 존재 시 모호
- 특히 표/그림 위주 페이지: 한 페이지에 5+ 산식 가능

**현재 상태:**

- `ONTOLOGY.md` 산식 필드: page_ref = "422" (단일 페이지 번호만)
- 정밀도 정책 부재

**수정안 (3가지):**

**(A) 페이지 번호만 (현)** — 단순, 학습자가 페이지 내 검색
**(B) 페이지 + 섹션** — `"422:§3-2"` (수기 라벨링 부담)
**(C) 페이지 + Y 좌표** — `"422@Y0.45"` (PDF 좌표, OCR 정확도 의존)

**권고:** **(B) 페이지 + 섹션** — Stage 3 (도메인 분석) 시 Claude Code 가 자동 추출.

**근거:**

- (A) 는 학습자에게 "찾아보세요" 부담
- (C) 는 OCR 정확도 + PDF 의존성 risk
- (B) 는 교재의 명확한 구조 (절/항/호/목) 활용

**`ONTOLOGY.md` 산식 필드 수정:**

```
| page_ref | 한국어 형식 "page:section" | "422:§3-2-1" |
```

**작업 시간:** ~30분 (ONTOLOGY.md + parser 프롬프트 갱신)

---

## 3. 추후 (POC 후)

### 🟡 R-11: CBIV 비용/시간 실측 필요

**상황:** "30초 이내" 추정만 있고 실측 데이터 없음. BATCH-14 시점 (~620 노드 + ~2000 엣지) 에서 회귀 Golden 1000개 재실행 = ?

**권고:** **BATCH-1 dry-run 시 실측 + BATCH-7 시점 재측정.** 30초 초과 시 병렬 실행 도입.

---

### 🟡 R-12: 검수 UI 의 8시간 추정 위험

**상황:** 28 task × 18분 = 8.4시간. D3.js Subgraph + AI 통합 + Keyboard nav 합치면 12시간+ 가능.

**권고:** **v0.5 → v1.0 점진**:

- v0.5 (4시간): 큐 1만 + 단순 diff + 액션 버튼 (Keyboard nav 없음)
- v0.7 (3시간): 큐 2/3 추가 + AI 추천
- v1.0 (3시간): Keyboard nav + 일괄 처리 + Subgraph

BATCH-1 dry-run 전 v0.5 가능, BATCH-3 진입 전 v1.0 완성.

---

## 4. Concurrent Execution + Hybrid Search 의 결합 명문화

### 🟡 R-13: 두 패턴의 결합 모호 (R-4 와 연계)

**문제:** Rule 23 (Concurrent + Short-circuit) 와 Rule 15 (3-Stage Hybrid) 의 실행 순서 불명확.

**해석 가능성:**

- (a) Concurrent 가 먼저 → 가장 빠른 confident result → Hybrid 3-Stage 통과
- (b) Hybrid 3-Stage 자체가 Concurrent

**권고:** **(a)** — 명확한 책임 분리.

```
[Concurrent Pipeline] (Promise.all)
   ├─ Vector Search (Vectorize)
   ├─ Keyword Search (D1 N-gram)
   └─ Topic Cluster Classifier
    ↓
   [Race + Short-circuit]
   - 키워드 exact match → 100ms 즉시 반환
   - Vector ≥ 0.75 → Hybrid 3-Stage 진입
   - Vector 0.60~0.75 → Hybrid + Keyword 결합
   - Vector < 0.60 → Multi-Path Fallback (Keyword/Topic 활용)
   - 모두 fail → Honest Refusal (800ms timeout)
    ↓
[Hybrid 3-Stage] (Vector 결과만 처리)
   ├─ Stage 1: Vector Recall
   ├─ Stage 2: Graph Hard Filter
   └─ Stage 3: Truth Weight Re-rank
    ↓
[answer with page_ref]
```

**`SEARCH_PIPELINE.md` (R-4 신설) 의 §5 통합 흐름 다이어그램에 명문화.**

---

## 5. 산출물 우선순위 권고 (1주일 단위 작업)

### Day 1 (~3시간) — Critical 정리

- ✅ R-1: Hard Rule 번호 충돌 정리 (HARD_RULES.md 갱신, 28개로 확장)
- ✅ R-2: 마이그레이션 번호 정리 (VERSION_MANAGEMENT.md + MULTI_EXAM_EXTENSION.md)
- ✅ R-3: Year 1 부터 exam_id 컬럼 도입 (마이그레이션 0014 갱신)
- ✅ R-5: BATCH 적재 PR-based 명문화 (BATCH_LOAD_PROTOCOL.md + ADMIN_REVIEW_UI.md)

### Day 2-3 (~3시간) — Critical 누락

- ✅ R-4: SEARCH_PIPELINE.md 신설 (~2h)
- ✅ R-13: Concurrent + Hybrid 결합 흐름 다이어그램 (R-4 의 §5)

### Day 4 (~2.5시간) — High 보강

- ✅ R-6: 검수 결정 → DB 매핑 (Merge = SUPERSEDES 패턴) — ADMIN_REVIEW_UI.md
- ✅ R-7: Rollback INSERT-only — ADMIN_REVIEW_UI.md + 마이그레이션 0020 설계
- ✅ R-8: BATCH-1 시점 CBIV Stage 5 self-test — CBIV.md

### Day 5 (~1.5시간) — Medium 보강

- ✅ R-9: OPERATIONS_RISK.md 신설 (SPOF 명시) — Year 1 단일 검수자 수용
- ✅ R-10: page_ref 정밀도 = "page:section" — ONTOLOGY.md

### POC 후 (BATCH-1 dry-run 결과 기반)

- 🟡 R-11: CBIV 시간 실측
- 🟡 R-12: 검수 UI v0.5 → v1.0 점진 일정

**총 작업 시간:** ~10시간 (BATCH-1 dry-run 진입 전 모두 완료 가능)

---

## 6. 5번째 페르소나 합의 (DEV COVEN)

> **MEPHISTO**: "v2.1 PATCH 까지의 큰 그림은 80점. 13개 보완점은 본질이 아닌 마무리. 그러나 R-1~R-5 (Critical 5건) 는 production 진입 전 절대 처리 필요."

> **ARCHITECT**: "R-3 (exam_id 시점 모순) 가 가장 위험. CBIV 의 단순성을 위해 Year 1 부터 exam_id 도입 필수."

> **HACKER**: "R-2 (마이그레이션 0014 충돌) 는 실제 코드 작성 시 즉각 충돌. 30분 작업으로 해결."

> **BREAKER**: "R-6 (Merge = UPDATE 위반 risk) 가 가장 깊은 결함. SUPERSEDES 패턴으로 일관성 보장."

> **GHOST**: "R-5 (BATCH 적재 PR-based) 명문화 가 운영 워크플로우의 본질. CI/CD 가 SoT."

> **SENTINEL**: "R-7 (Rollback INSERT-only) 는 audit 무결성 보장. 24시간 내 잘못된 결정 자유 반전 — 그러나 트랜잭션 안전."

> **ADVOCATE**: "R-9 (SPOF) 는 진산님 보호. Year 1 단일 검수자 수용 명시 = 진산님이 부담 없이 휴식 가능."

> **ORACLE**: "R-4 (SEARCH_PIPELINE.md) 가 비전 정합성 핵심. 운영 RAG 가 북극성을 깨뜨리지 않도록 통합 명세 필수."

---

## 7. 본 감사의 무결성

본 감사는 **방어가 아닌 진화**의 정신으로 작성되었습니다:

- ❌ 19개 산출물에 대한 단순 칭찬 거부
- ❌ "큰 그림은 좋다" 등 무의미한 평가 회피
- ✅ 13개 구체 결함 + 수정안 + 작업 시간 명시
- ✅ DEV COVEN 8 페르소나 합의

본 감사가 옳다면 → 13개 보완 처리 후 BATCH-1 dry-run 진입.
본 감사가 틀렸다면 → 페르소나별 사인-오프 재검토.

---

_"산출물의 80점은 함정이다. 80점이 90점 되는 길은 디테일에 있다._
_디테일을 보지 않으면 production 에서 80점이 0점 된다."_

— DEV COVEN 19개 산출물 감사 보고서
