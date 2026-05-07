# Stage 1B — 8 자료 추출 종합 보고서 (★ Session 049 정제 갱신)

> Session: 048 추출 → 049 정제 / 2026-05-06
> Trigger: 진산 "순차적으로 진행해줘" + "권장대로 진행" → handoff-048 종착 본 핸드오프 인라인 지시
> Decision applied: D-S1B-1 옵션 A (JSON 영속, Phase 2 마이그레이션 0020 일괄 적재) + D-S1B-7 = γ (explanation 보강만) + D-S1B-8 = B (Stage 1B 정제)
> ★ Session 049 정제 결과: TD-S48-1~5 5건 모두 해소 + γ explanation 보강 영속 12 candidates

## 1. 8 자료 추출 완료 통계

| #      | 자료                       |      크기 |  페이지 |       chars | 영역                 | 핵심 노드 |       작물 노드 | 545 매핑 | 26년 drift |
| ------ | -------------------------- | --------: | ------: | ----------: | -------------------- | --------: | --------------: | -------: | ---------: |
| 1      | 시잘부2 표본구간 정리      |      47KB |       1 |         502 | BATCH-3·4·7·R2       |         9 |           17/25 |        5 |          7 |
| 2      | 시잘부3 과수품목 피해율    |     166KB |       5 |       9,593 | BATCH-1·2·3·4·5·7·R2 |        18 |           22/22 |       10 |          3 |
| 3      | 자료5번 종합과수 11년 기출 |     332KB |      15 |      12,675 | BATCH-2·3·5·7        |         6 |           10/10 |        4 |          3 |
| 4      | 자료9번 수확감소밭작물     |     444KB |      20 |      17,231 | BATCH-3·4·7·R2       |         4 |             8/9 |        3 |          4 |
| 5      | 자료15번 수입안정          |     457KB |      16 |      16,939 | BATCH-5·R2           |         2 |             6/6 |        1 |          2 |
| 6      | 자료11번 인삼+해가림       |     572KB |      17 |      16,708 | BATCH-4·5·R1·R2      |         9 |            9/12 |      0\* |          4 |
| 7      | 자료6번 과실손해           |     603KB |      20 |      17,448 | BATCH-2·3·7·R2       |        10 |             7/7 |        5 |          2 |
| 8      | 자료17번 가축              |     636KB |      22 |      26,250 | BATCH-6·R2           |        12 | n/a (livestock) |      0\* |          3 |
| **계** | —                          | **3.2MB** | **116** | **117,346** | —                    |    **70** |          **79** |   **28** |     **28** |

> \*자료11/17 = exam_question 키워드 검색 보강 의무 (TD-S48-4·5)

## 2. 자료 카테고리 분류 (★ 핵심 인사이트)

### A. 정리 자료 (시잘부 2건) — 학원 정리표

- 시잘부2 표본구간 / 시잘부3 과수품목 피해율
- **성격**: 이론서 요약 정리, 기출 풀이 X
- **활용**: related_nodes 매핑 + 학습 보조

### B. 학원 기출 풀이 — 25년 기반 (자료5·9·6·17 = 4건)

- 자료5번 종합과수 / 자료9번 수확감소밭 / 자료6번 과실손해 / 자료17번 가축
- **성격**: 손평에듀 학원 기출 + 풀이 모음 (1~11년치)
- **★ INSERT 자산 가능성**: 2차 1~10회 미적재 회차 풀이 raw 보유 (TD-S46-2 carry-over 해결 후보)
- **단**: 25년 이론서 기반 → 26년 검증 의무 + 학원 자료 → status='draft' 영역

### C. 26년 정합 풀이 — 부분 반영 (자료15·11 = 2건)

- 자료15번 수입안정 (★ "26년 과거수입형 개정 반영" 명시 + 한종찬교수 제공)
- 자료11번 인삼+해가림 (★ 제목 "26년대비" 명시)
- **차이**: B 카테고리와 동일 풀이 자료지만 26년 부분 흡수
- **활용**: status='active' 가능 영역 (B 카테고리 'draft'와 차별)

## 3. 종합 매핑 노드 (중복 제거)

### 핵심 개념 노드 (70 → unique 약 35건)

**TERM**: 030 / 035 / 034 / 032 / 029 / 010 (표본 영역)
**LAW**: 015 (잔여수확량) / 138 (별표1 표본주수) / 140 (별표5 무화과 잔존) / 141 (별표6 손해정도비율)
**INV**: 003 / 011 / 018 / 019 / 037 / 068 / 071-074 / 078 (조사 절차)
**INS**: 04 / 13 / 23 / 24 / 33-40 (가축 + 과수 보장)
**F (산식)**: 23 / 41 / 42 / 45 / 49-51 / 90-91 / 147 / 149-151

### CROP 노드 매핑 통계

- **22 종합과수**: 100% 매핑 (시잘부3 정합)
- **9 수확감소밭작물**: 7/9 매핑 (잔여 = 고구마, 밀 — TD-S48-1-residual / TD-S48-3)
- **6 과실손해**: 100% 매핑
- **8 생산비보장 노지**: 100% 매핑
- **인삼·해가림**: 노드 ID 별도 검색 의무 (TD-S48-4)

## 4. 545 questions 매핑 통합 (28 매핑)

### 1차 525 매칭 (10건, 시잘부3 + 자료5/6 출처)

- Q-2020-06-048 / Q-2021-07-049 / Q-2022-08-048·049 / Q-2023-09-047·049 / Q-2024-10-047
- 영역: 농어업재해보험법령 — 손해평가요령 (시잘부3 §3 + 자료5/6 종합과수·과실손해 정합)

### 2차 20 매칭 (18건, 11회만 적재됨)

- 1과목 (이론): Q-004 감자/고추 / Q-007 마늘 (자료9 직격)
- 2과목 (손해평가): Q-011 단감 낙엽률 / Q-012 시기별 조사 / Q-014 밭작물 적기 / Q-016 복분자 / Q-017 옥수수 / Q-019 매실 / Q-020 오디

## 5. 26년 drift 종합 (11+ revision_changes 영향)

| revision_id                      | severity    | 영향 자료                |
| -------------------------------- | ----------- | ------------------------ |
| REV-2026-29-SAMPLE-METHOD        | high        | 시잘부2 / 자료9          |
| REV-2026-30-SAMPLE-CONVERT       | medium-high | 시잘부2 / 자료9          |
| REV-2026-31-CONTRACT-CHANGE      | medium      | 시잘부2 / 자료11         |
| REV-2026-32-MEMIL-CLASSIFY       | low         | 시잘부2                  |
| REV-2026-33-DAMAGE-RATIO-METHOD  | high        | 시잘부2 / 자료9 / 자료11 |
| REV-2026-LOSS-DEGREE             | low-medium  | 시잘부2 / 자료11         |
| REV-2026-28-FIELD-HARVEST-TIMING | medium      | 시잘부2 / 자료9          |
| REV-2026-FRUIT-LOSS-CROSS-DAY    | medium-high | 시잘부3 / 자료5 / 자료6  |
| REV-2026-MUWHA-RESIDUAL          | medium      | 시잘부3 / 자료6          |
| REV-2026-37-INCOME-DETAIL        | low-medium  | 자료5 / 자료15           |
| REV-2026-INSAM-MERGE             | high        | 자료11                   |
| REV-2026-LIVESTOCK-COW-AVAIL     | medium      | 자료17                   |
| REV-2026-LIVESTOCK-PIG-CESSATION | medium      | 자료17                   |
| REV-2026-PRESEED-LOSS-COEFF      | medium      | 자료5                    |

## 6. ★ 핵심 발견 (Critical Findings)

### 6.1 신규 INSERT 자산 가능성 (TD-S46-2 해결 후보)

- 자료5/9/11/15/6/17 = 2차 1~10회 미적재 회차의 영역별 기출 + 풀이 raw 보유
- 진산 결정 의무 (Option α/β/γ):
  - **α**: Stage 1B 매핑만 (related_nodes만, 풀이 자산 미활용)
  - **β**: 신규 BATCH-Q-2차-MISSING 트리거 + 6 자료 통합 → 2차 1~10회 일부 적재
  - **γ**: explanation 보강 자산으로 한정 (★ 권장 — TD-S46-3 직격 + 안전)

### 6.2 자료 카테고리별 status 분류

- **시잘부 (정리표)**: 학습 보조 자료 — D1 적재 X (raw 활용)
- **자료15·11 (26년 반영)**: status='active' 후보 (한종찬교수 + 제목 26년 명시)
- **자료5·9·6·17 (25년 학원)**: status='draft' 후보 (인간 검수 후 active)

### 6.3 자료6 11회 복수정답 정확 매칭

- 본 자료 11회 풀이가 Q-2025-11-2ND-012 큐넷 공식 복수정답 인정 패턴 정확 매칭 = explanation 보강 자산 확실

## 7. TD carry-over (5건 신규 → ★ Session 049 정제 단계 5건 모두 해소 ✅)

| ID                | 내용                                       | 처리 시점        | 해소                                                                                                       |
| ----------------- | ------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| TD-S48-1-residual | 시잘부2 잔여 (고구마/맥류 노드 ID)         | Session 049 정제 | ✅ CROP-028 (BATCH-4 고구마)                                                                               |
| TD-S48-2          | 자료5 F-23 수확량 산식 노드 ID 검증        | Session 049 정제 | ✅ F-23='품종·수령별 주당 착과량' (BATCH-2 적과) + F-15(수확감소 피해율) + F-17(미보상감수량) primary 추가 |
| TD-S48-3          | 자료15 밀 노드 ID 검색 (BATCH-3)           | Session 049 정제 | ✅ CROP-025 밀 (BATCH-3) + 인접 CROP-026 보리 / CROP-027 귀리                                              |
| TD-S48-4          | 자료11 인삼+해가림 노드 ID 정확 식별       | Session 049 정제 | ✅ CROP-058 인삼 + CROP-059 해가림시설 (시설) (BATCH-4) + 산식 7건 (F-98/99/102/125/126/127/128)           |
| TD-S48-5          | 자료17 가축 exam_question 키워드 매칭 보강 | Session 049 정제 | ✅ 21 매칭 (1차 17 secondary + 2차 4 primary, 키워드 9종 검색)                                             |

## 8. ★ 진산 spot check 의무 (3 결정사항)

### D-S1B-7: Option α/β/γ — INSERT 자산 활용 전략

- **α**: Stage 1B 매핑만 종료 (자료 풀이 raw 미활용)
- **β**: 신규 BATCH-Q-2차-MISSING + 자료5/9/11/15/6/17 통합 적재 (2차 1~10회 일부)
- **γ**: explanation 보강만 (★ 권장 — 안전 + TD-S46-3 직격, 545 questions의 explanation NULL 채우기)
- **권장**: γ 우선 + β는 별도 plan 작성 후 결정

### D-S1B-8: Stage 1B 종료 트리거

- 본 PoC 단계 종료 → 다음 분기:
  - **A. 단계 1C 진입** (출제 패턴 분석 → topic_clusters)
  - **B. Stage 1B 정제** (TD-S48-1~5 보강 + γ 활용 explanation 보강)
  - **C. Stage 1B → Phase 2 마이그레이션 plan** (link table 0020 신설)
- **권장 default**: B (정제) → 그 후 1C → Phase 2 plan

### D-S1B-9: 본 세션 종료 + 다음 세션 진입

- 본 세션 048 = 약 1시간 30분 진행 추정 (90분 임계 근접)
- 차세션(049) 진입 핸드오프 작성 의무
- 핸드오프에 D-S1B-7/8 진산 결정 이월 명시

## 9. 산출물 디렉토리 구조 (★ Session 049 갱신)

```
docs/batch-load/stage-1b-related-nodes/
├── STAGE-1B-SUMMARY.md          ← 본 보고서 (Session 049 정제 반영)
├── sijalbu2/                     (8 자료 mapping.json + raw-extract.txt 각각)
├── sijalbu3/
├── jaryo5_jonghap_gwasu/         ★ Session 049 정제: F-15/17/23 매핑 명확화
├── jaryo9_field_crop/            ★ Session 049 정제: CROP-028 고구마 영속
├── jaryo15_income_stabil/        ★ Session 049 정제: CROP-025 밀 영속
├── jaryo11_insam/                ★ Session 049 정제: CROP-058/059 + F-98~128 7건 영속
├── jaryo6_fruit_damage/          ★ 11회 Q-012/016/020 직격 매핑 (큐넷 복수정답 정합)
├── jaryo17_livestock/            ★ Session 049 정제: 21 exam_question_links 영속
└── explanation-supplement/       ★ Session 049 신규 — γ 보강 자산
    ├── candidates.json           (12 questions × 자료 raw 라인 범위 매핑)
    └── INDEX.md                  (인덱스 + Phase 2 마이그레이션 0020 plan 가이드)
```

## 9.1 ★ Session 049 신규 산출물 — γ explanation 보강 (D-S1B-7 채택)

- **위치**: `docs/batch-load/stage-1b-related-nodes/explanation-supplement/`
- **자산**: 12 candidates (Q-2025-11-2ND-002/004/007/010/011/012/014/016/017/018/019/020)
  - ★ 우선순위 4건 (자료6 11회 Q-012/016/020 + 자료15 26년 정합 Q-017)
  - 1과목 4건 + 2과목 8건
  - jaryo5(1) + jaryo6(3) + jaryo9(3) + jaryo15(1) + jaryo17(4)
- **★ CRITICAL 제약**: exam_questions UPDATE 차단 (0004 trigger `prevent_exam_questions_update` RAISE ABORT)
  - 직접 D1 UPDATE 불가능 → Phase 2 마이그레이션 0020 link table `exam_question_explanation_supplement` 일괄 적재 의무 (L3, plan + 진산 인간 승인)
- **차세션 050+ 잔여 의무**: needs_line_refinement = 9 영역 정확 라인 범위 정제 + 26년 drift overlay 10건 작성

## 10. Reality Anchor 종합

- ✅ CRITICAL RULE #1 (기획 다른 구현 보고): D-S1B-7 Option β 발견 시 즉시 보고 의무 ★
- ✅ CRITICAL RULE #6 (Reality Anchor): 매 자료마다 version_drift 식별 + 6.1 INSERT 자산 옵션 3종 도출
- ✅ Hard Rule "LLM 수식 계산 금지": 자료 풀이 raw 보존만, 산식 자체 계산 X
- ✅ memory "출처 추적성 필수": 매 매핑에 source 파일 + 페이지 + 회차 명시
- ✅ memory "지엽 결정 delegation 금지": D-S1B-7/8/9 전략 갈림길만 상신
- ✅ memory "문서 우선 워크플로우": 본 보고서 + 8 mapping.json 영속 후 채팅 요약
- ✅ L3 영역 변경 0 (마이그레이션 / ontology-registry / 스키마 변경 X)

---

## 11. ★ Session 049 정제 단계 완료 정합

- ✅ **Stage 1B 정제 완료** (D-S1B-8 = B 채택 정합): TD-S48-1~5 5건 모두 해소
- ✅ **γ explanation 보강 영속** (D-S1B-7 = γ 채택 정합): 12 candidates 영속
- ✅ **5 mapping.json 갱신**: jaryo5/9/11/15/17 (TD 해소 정보 영속, td_resolved_session_049 필드 추가)
- ✅ **L3 영역 변경 0** (마이그레이션 / ontology-registry / 스키마 변경 X — 본 세션 049 영역)
- ⏳ **Phase 2 마이그레이션 0020 plan** = 차세션 050+ 의무 (link table 2종 신설, L3 plan + 진산 승인)

---

**다음 단계**: 차세션(050) 진입 — 단계 1C (출제 패턴 분석 → topic_clusters) 또는 정확 라인 범위 정제 + drift overlay 작성 또는 Phase 2 마이그레이션 0020 plan 작성. 진산 결정 트리거 발화 대기.
