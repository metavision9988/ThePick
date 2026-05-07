# γ Explanation 보강 자산 인덱스 (Session 049)

> **결정**: 진산 D-S1B-7 = γ 채택 (explanation 보강만, β 신규 BATCH-Q-2차-MISSING은 별도 plan)
> **목표**: 545 exam_questions 의 explanation NULL 영역(전체)을 자료5/6/9/15/17 raw 풀이로 보강
> **제약 (CRITICAL)**: exam_questions UPDATE 차단 (0004 trigger `prevent_exam_questions_update` RAISE ABORT). 직접 D1 UPDATE 불가능 — Phase 2 마이그레이션 0020 link table `exam_question_explanation_supplement` 일괄 적재 의무 (L3 영역, plan + 진산 인간 승인)

## 1. 영속 산출물

| 파일                 | 내용                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| `candidates.json`    | 12 questions × 자료별 raw 라인 범위 매핑 (line_refinement_pending 9건 포함) |
| `INDEX.md` (본 문서) | 인덱스 + Phase 2 작업 가이드                                                |

## 2. 12 candidate 매핑 요약

| #   | question_id         | subject | source_jaryo                  | match  | drift                                     |
| --- | ------------------- | ------- | ----------------------------- | ------ | ----------------------------------------- |
| 1   | Q-2025-11-2ND-012 ★ | 2과목   | jaryo6 (line 425-501)         | direct | high (REV-2026-FRUIT-LOSS-CROSS-DAY)      |
| 2   | Q-2025-11-2ND-016 ★ | 2과목   | jaryo6 (line 425-501)         | direct | high (REV-2026-FRUIT-LOSS-CROSS-DAY)      |
| 3   | Q-2025-11-2ND-020 ★ | 2과목   | jaryo6 (오디 영역, line 정제) | direct | high (REV-2026-FRUIT-LOSS-CROSS-DAY)      |
| 4   | Q-2025-11-2ND-019   | 2과목   | jaryo5 (line 616-end)         | direct | n/a                                       |
| 5   | Q-2025-11-2ND-004   | 1과목   | jaryo9 (line 139, 352)        | direct | medium (REV-2026-28/29)                   |
| 6   | Q-2025-11-2ND-007   | 1과목   | jaryo9 (마늘 영역)            | direct | medium (REV-2026-29)                      |
| 7   | Q-2025-11-2ND-014   | 2과목   | jaryo9 (line 352)             | direct | high (REV-2026-28)                        |
| 8   | Q-2025-11-2ND-017 ★ | 2과목   | jaryo15 (line 319-405)        | direct | low (REV-2026-37 + 자료15 26년 부분 반영) |
| 9   | Q-2025-11-2ND-002   | 1과목   | jaryo17 (4 위치)              | direct | medium (REV-2026-LIVESTOCK-\*)            |
| 10  | Q-2025-11-2ND-010   | 1과목   | jaryo17                       | direct | medium                                    |
| 11  | Q-2025-11-2ND-011   | 2과목   | jaryo17                       | direct | medium                                    |
| 12  | Q-2025-11-2ND-018   | 2과목   | jaryo17                       | direct | medium                                    |

★ 우선순위: handoff-048 §6.3 자료6 11회 = Q-2025-11-2ND-012/016/020 정확 매칭 + 자료15 26년 부분 반영

## 3. 잔여 의무 (차세션 050+)

### 3.1 needs_line_refinement = 9건

정확 라인 범위 정제 의무. 추출 절차:

1. 자료별 raw-extract.txt 의 11회 영역 시작/종료 라인 정확 식별
2. 다른 회차 영역 (5/6/7/8/9/10회) 라인 범위도 영속 (TD-S46-2 carry-over β 옵션 자산)
3. candidates.json `raw_extract_lines` 정확 갱신

### 3.2 Drift Overlay 작성 (5+5 = 10 candidates 의무)

자료5/6/9/17 = 25년 학원 풀이 → 26년 적용 시 보정 의무. 자료15 = 26년 부분 반영 → 잔여 갱신 검증.

- REV-2026-FRUIT-LOSS-CROSS-DAY (오디·복분자 조사시기 변경, BATCH-R2 §4)
- REV-2026-28-FIELD-HARVEST-TIMING (밭작물 수확량조사 적기 신설, BATCH-R2 §5)
- REV-2026-29-SAMPLE-METHOD (표본구간 수확 후 조사 방법 명세화, BATCH-R2 §5)
- REV-2026-37-INCOME-DETAIL (농업수입안정 표본수+옥수수 손해액 변경, BATCH-R2 §10)
- REV-2026-LIVESTOCK-COW-AVAIL (소 출하예정 가입조건 변경, BATCH-R2 §11)
- REV-2026-LIVESTOCK-PIG-CESSATION (돼지축산휴지 산식 정정, BATCH-R2 §11)

### 3.3 Phase 2 마이그레이션 0020 plan (L3, 진산 승인 의무)

```sql
CREATE TABLE exam_question_explanation_supplement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL REFERENCES exam_questions(id),
  source_jaryo TEXT NOT NULL,
  source_pdf TEXT NOT NULL,
  raw_extract_lines TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('direct','inferred','adjacent')),
  source_textbook_year INTEGER NOT NULL,
  version_drift_warning INTEGER NOT NULL CHECK (version_drift_warning IN (0,1)),
  drift_revision_ids TEXT,  -- JSON array
  human_review_status TEXT NOT NULL DEFAULT 'pending' CHECK (human_review_status IN ('pending','reviewed','approved','rejected')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE (question_id, source_jaryo)
);
```

추가 link table: `exam_question_node_links` (Stage 1B related_nodes 매핑 일괄 적재)

```sql
CREATE TABLE exam_question_node_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL REFERENCES exam_questions(id),
  node_id TEXT NOT NULL REFERENCES knowledge_nodes(id),
  source_doc TEXT NOT NULL,
  relevance TEXT NOT NULL CHECK (relevance IN ('primary','secondary','adjacent')),
  rationale TEXT,
  version_drift INTEGER NOT NULL DEFAULT 0,
  drift_revision_ids TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE (question_id, node_id, source_doc)
);
```

### 3.4 β 옵션 (TD-S46-2 carry-over 해결 자산)

자료5/9/15/6/17 = 2차 1~10회 미적재 회차 풀이 raw 보유 → β 옵션 별도 plan 작성 후 진산 결정.

- 자료5: 1/2/3/5/6/8/9/10회 종합과수
- 자료6: 5/7/8/9/11회 과실손해 (오/감/복/무/두릅/블루베리)
- 자료9: 1/2/7/9/10/11회 수확감소 밭작물
- 자료15: 2/3/4/7/8/10/11회 농업수입안정
- 자료17: 6/7/8/9/10/11회 가축

## 4. 본 단계 산출물 검증 체크리스트

- [x] 12 candidates 영속 (`candidates.json`)
- [x] D-S1B-7 = γ 결정 적용 (explanation 보강만)
- [x] exam_questions UPDATE 차단 정합 명시 (0004 트리거)
- [x] Phase 2 마이그레이션 0020 link table 의무 명시 (L3 plan + 승인)
- [x] 26년 drift_revision_ids 매핑 (자료별 REV-2026-\* IDs)
- [x] needs_line_refinement = 9 영역 명시 (차세션 의무)
- [ ] 정확 라인 범위 정제 (차세션 050+ 의무)
- [ ] drift overlay 작성 (차세션 050+ 의무)
- [ ] Phase 2 마이그레이션 0020 plan 작성 (Phase 2 진입 시 의무)
