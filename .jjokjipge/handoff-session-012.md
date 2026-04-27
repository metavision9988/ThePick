# Handoff — Session 012 → BATCH-1 dry-run 진입

작성일: 2026-04-27 KST
직전 세션: 011 (Session Monitor) → 012 (Phase 0 + 0.5 + 4-Pass 리뷰)

---

## 1. 직전 세션에서 완료한 것

### Phase 0 (CBE v2.2 거대 설계 + 시스템 차단 4건 해소)

- `c5f82d1` Content Build Engine v2.2 — 12 architecture 문서 + 11 ADR + 31 Hard Rule (Core 5 분류) + 검토 입력 자료 review/, review2/
- `b38120d` 마이그레이션 0013 신설 — `is_current_active` 컬럼 + `review_decisions` 테이블 + Materialized Active View 트리거
- `60676cf` packages/ai-adapter 신설 — Anthropic 단일 의존 antifragile 격리 레이어
- `468ae88` 6 페르소나 다각 검토 산출 + BATCH 적재 로드맵
- `6bde63f` Phase 0 진입 plan + Hard Rules 31개 표기
- `6ff9241` ontology-registry.json — Adaptive Threshold + Constants 정책 (ADR-021)

### Phase 0.5 (4-Pass 리뷰 발견 CRITICAL 7건 정정)

Stop hook 강제 4-Pass 리뷰 (5 페르소나) — CRITICAL 7건 발견 후 정정:

- `457d90b` 마이그레이션 0014 — C-1/C-2/C-3/C-5/C-7 통합 정정
  - C-1: prevent_X_update 컬럼별 IS NOT 화이트리스트 재정의 (knowledge_nodes 14 / formulas 12 / constants 16 컬럼)
  - C-2: prevent_X_delete 트리거 3개 (knowledge_nodes / formulas / constants)
  - C-3: constants ADD COLUMN superseded_by + mav_formulas/constants_supersedes_deactivate 트리거 + 자기참조 차단
  - C-5: prevent_supersedes_reverse_cycle + self
  - C-7: reviewer_id 시스템 prefix 차단 + AI silent adoption 차단 (rationale ≥10 의무)
- `349fef9` ADR-013 column drift (`relation` → `edge_type`)
- `95712c1` ai-adapter 13 unit tests
- `0135ce1` 4-Pass 리뷰 산출물
- `d2e4bf5` C-1 보강 — constants.superseded_by 화이트리스트 누락 정정
- `a8e60fb` Phase 0.5 재검증 산출물

### 종결 상태

- **CRITICAL 0건** (7/7 해소, T1~T10 모두 PASS, sqlite3 dry-run 0001~0014 0 error)
- **MAJOR 7건** Phase 1 초기 명시 이월 (M-1 ~ M-7)
- ai-adapter `pnpm test` → 13/13 passed
- Hard Rule 번호 정합성 grep → 0 충돌

---

## 2. 다음 세션의 작업: BATCH-1 dry-run

진산님 메모리 `project_batch_load_workflow.md` 트리거 키워드 시 자동 진입:

- **"BATCH-1 적재"** / **"BATCH 1 적재"**
- **"다음 배치 적재"** / **"다음 BATCH 적재"**
- **"계속 적재"** / **"이어서 적재"**

### BATCH-1 정의 (docs/plans/batch-loadmap.md)

| 항목   | 값                                                                                       |
| :----- | :--------------------------------------------------------------------------------------- |
| 자료   | `docs/manual/2026년 「농업재해보험·손해평가의 이론과 실무」 이론서_수정본(26.3.31.).pdf` |
| 페이지 | p.403~434 (32p)                                                                          |
| 영역   | 적과전 종합위험                                                                          |
| 목표   | 60 노드 / 200 엣지 / **13 산식 (F-01~F-07 등)**                                          |
| 상태   | F-01~F-07 일부 Golden 적재됨 (이전 세션) — 노드만 신규                                   |

### 10 Stage 워크플로우 (메모리 + BATCH_LOAD_PROTOCOL.md)

1. 다음 ☐ 식별 (BATCH-1 — 이미 확정)
2. PDF 추출 (`packages/parser/scripts/extract_pdf.py`, 결과 `/tmp/batch-1-extract.json`)
3. 도메인 분석 (Opus 4.7 직접 — 본 세션 Claude Code) → Knowledge Graph JSON
4. Level 1 검증 — Ontology Lock / schema-validator / graph-integrity
5. Level 2 검증 — qg2-validator Golden 100% / page_ref 무작위 5건 / 산식 변수명
6. Level 3 학습 효과 — 본 BATCH 영역 기출 1~2건 자동 풀이 일치율 100%
7. **Stage 6.5: CBIV 6단계** — BATCH-1 = Stage 5 회귀 self-validation (R-8)
8. 진산님 검수 — sample 5건 + 산식 1건 + page_ref 5건 무작위 대조
9. **Stage 7.5: 의미 중복 결정** — BATCH-1 단일이라 적용 X
10. **Stage 8: D1 INSERT** — **dry-run 이라 SKIP** (산출만 보존, JSON + Golden Test)
11. Stage 9: 핸드오프 + 로드맵 갱신
12. Stage 10: Golden Test 영구 보존 (`docs/measurements/golden-tests/batch-1-golden.json`)

---

## 3. 핵심 문서 위치 (필수 읽기)

### 필수 (BATCH-1 진입 직전)

- `CLAUDE.md` (프로젝트 룰)
- `docs/architecture/HARD_RULES.md` (31 Hard Rule + Core 5 분류)
- `docs/architecture/BATCH_LOAD_PROTOCOL.md` (10 Stage 명세)
- `docs/plans/batch-loadmap.md` (BATCH-1~14 + Layer 1~5)
- `packages/parser/src/ontology-registry.json` (ID 패턴 + Adaptive Threshold)

### 참조 (Stage 진행 중)

- `docs/architecture/ONTOLOGY.md` (노드/엣지 ID 체계)
- `docs/architecture/VERSION_MANAGEMENT.md` (Temporal Graph SUPERSEDES)
- `docs/architecture/VALIDATION_FRAMEWORK.md` (4단계 검증)
- `docs/architecture/CBIV.md` (Cross-Batch Integrity Validator)

### 자료

- `docs/manual/2026년 「농업재해보험·손해평가의 이론과 실무」 이론서_수정본(26.3.31.).pdf`
- `docs/manual/ThePick-분석결과.md` (1,115p / 20 파일 인벤토리)

---

## 4. 주의사항 (Hard Rule 의무)

### Core 5 Rule (북극성 직접 — BATCH-1 전 강제)

- **Rule 3**: LLM 수식 계산 금지 — Formula Engine math.js AST 만
- **Rule 4**: Constants LLM 추론 금지 — DB 쿼리만
- **Rule 6**: Ontology Lock — `ontology-registry.json` 외 ID 생성 금지
- **Rule 7**: AI 생성 데이터 `draft` 상태로만 적재 (인간 검수 후 `approved`)
- **Rule 8**: BATCH 순차 — 전 검증 없이 다음 진행 금지
- **+** Source Citation FK — 모든 노드/산식/상수에 `page_ref` 필수

### BATCH-1 dry-run 특이 사항

- **D1 INSERT SKIP** — 산출만 보존
- 산출 위치:
  - `/tmp/batch-1-extract.json` (PDF 추출)
  - `docs/measurements/batch-1-draft.json` (Knowledge Graph JSON)
  - `docs/measurements/golden-tests/batch-1-golden.json` (Golden Test)
- 노드 ID 형식 (Ontology Lock):
  - `CONCEPT-NNN` / `LAW-NNN` / `F-NN` / `INV-NNN` / `INS-NN` / `CROP-NNN` / `TERM-NNN`
- 산식: F-01~F-07 이미 Golden 적재 (`docs/measurements/golden-tests/`) — 충돌 시 재사용

### 검수 단계 (Stage 7) 진산님 무작위 검증

- sample 노드 5건 — `name` 교재 본문 일치
- 산식 1건 — `equation_template` 변수명 정합 + page_ref 일치
- page_ref 무작위 5건 — 실제 PDF 페이지 대조
- Ontology Lock ID 형식 정확

### 4-Pass 리뷰 의무 (BATCH-1 종결 전)

- L2 이상 구현이라 4-Pass 리뷰 강제 (`.claude/rules/auto-review-protocol.md`)
- 독립 에이전트 5 페르소나 병렬 리뷰
- 산출: `.claude/reviews/review-YYYYMMDD-HHMMSS-batch-1.md`
- CRITICAL 0건 후 "완료" 선언

---

## 5. MAJOR 7건 (Phase 1 초기 이월 — BATCH-1 진입 차단 아님)

| #   | 발견                                                   | 우선순위     |
| :-- | :----------------------------------------------------- | :----------- |
| M-1 | review_decisions references_decision_id 자기 참조 차단 | Phase 1 초기 |
| M-2 | ai_recommendation/ai_confidence pair CHECK             | Phase 1 초기 |
| M-3 | rollback_deadline 형식 검증                            | Phase 1 초기 |
| M-4 | ontology-registry SoT 분열 (배열↔객체 동기화 미강제)   | Phase 1 초기 |
| M-5 | describe() Object.freeze 반복                          | Phase 1 후반 |
| M-6 | review_decisions ↔ status_transitions 책임 경계 ADR    | Phase 1 초기 |
| M-7 | SUPERSEDES 다중 체인 회귀 테스트                       | Phase 1 초기 |

→ BATCH-1 적재 후 retrospective 처리.

---

## 6. 진산님 메모리 (자동 로드)

자동 로드되는 핵심 메모리 — 별도 행동 불필요:

- `project_content_build_engine_as_core.md` (v2.2, 31 Hard Rule)
- `project_batch_load_workflow.md` (트리거 키워드 + 10 Stage)
- `feedback_no_shortcuts.md` (땜빵 금지)
- `feedback_focus_reliability_not_schedule.md` (일정 X / 신뢰성 O)
- `feedback_no_granular_decisions.md` (지엽 결정 묻지 마라)
- `project_source_citation_requirement.md` (출처 추적성 FK 의무)

---

## 7. 새 세션 시작 prompt

새 세션 시작 후 첫 입력으로 다음 중 하나 사용:

**옵션 A (간결)**:

```
.jjokjipge/handoff-session-012.md 읽고 BATCH-1 적재 진행해줘
```

**옵션 B (직접 트리거)**:

```
BATCH-1 적재
```

(Claude Code 가 메모리 트리거 키워드 인지 → docs/plans/batch-loadmap.md 의 BATCH-1 자동 진입)

**옵션 C (검토 + 진입)**:

```
.jjokjipge/handoff-session-012.md 읽고 직전 작업 종결 상태 확인 후
BATCH-1 적재 진행해줘
```

---

## 8. 세션 건강 점검

`session-health.md` 규칙 정합 — 새 세션 시작 시 자동 점검:

- 60분 / 30턴: "세션 피로 감지" 알림
- 90분 / 50턴: 즉시 핸드오프 생성 권고

BATCH-1 작업이 32p PDF 추출 + 60 노드 JSON 생성 + 검수까지 — 한 세션에 끝나지 않을 가능성. 중간 핸드오프 필요 시 `handoff-session-013.md` 작성.
