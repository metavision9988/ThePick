# Stage 1C — 2차 2과목 10년간 출제 패턴 분석 종합 보고서

> **Session**: 049 / 2026-05-06 (단계 1C 진입)
> **Trigger**: 진산 "단계 1C 진입" (handoff-056 §차세션 권장 트리거)
> **Source**: 손평에듀 한종찬교수 제공 (BATCH-R1/R2 저자 동일, 신뢰성 高)
> **Scope**: 2차 2과목 (손해평가 이론과 실무) 한정 / 1회~10회

## 1. 추출 통계

| 항목          | 값                                                       |
| ------------- | -------------------------------------------------------- |
| PDF 파일      | `docs/manual/2차시험정답지/2차2과목_10년간_기출분석.pdf` |
| 크기          | 37,175 bytes (37KB)                                      |
| 페이지        | 1                                                        |
| 추출 chars    | 2,383                                                    |
| 영역 색상구분 | 11                                                       |
| 출제 슬롯     | 100 (10년 × 10문항)                                      |

## 2. 산출물 (3 파일 영속)

| 파일                  | 내용                                                          |
| --------------------- | ------------------------------------------------------------- |
| `raw-extract.txt`     | pdfplumber 1p 추출 raw                                        |
| `domain-analysis.md`  | 11 영역 × 회차별 매트릭스 + 영역별 출제 빈도 + lv3 출제 패턴  |
| `topic-clusters.json` | 50 candidate clusters (lv1+lv2 20 + lv3 30) — ID 패턴 pending |

## 3. 11 영역 색상구분 + 출제 빈도 (개략)

| 영역             | 5점 | 15점 | 합계 | 비율 | BATCH 매핑   |
| ---------------- | --: | ---: | ---: | ---: | ------------ |
| 적과전종합위험 ★ |  ~9 |   ~9 |  ~18 |  18% | BATCH-1      |
| 밭작물 ★         | ~12 |   ~4 |  ~16 |  16% | BATCH-4      |
| 종합과수         |  ~7 |   ~3 |  ~10 |  10% | BATCH-2      |
| 논작물(벼)       |  ~3 |   ~6 |   ~9 |   9% | BATCH-3      |
| 가축             |  ~3 |   ~5 |   ~8 |   8% | BATCH-6 + R2 |
| 기타             |  ~6 |   ~2 |   ~8 |   8% | BATCH-7      |
| 4대시설          |  ~1 |   ~6 |   ~7 |   7% | BATCH-4/5    |
| 과실손해보장     |  ~3 |   ~2 |   ~5 |   5% | BATCH-2/3    |
| 생산비보장(노지) |  ~1 |   ~4 |   ~5 |   5% | BATCH-4 + R2 |
| 수입감소         |  ~0 |   ~4 |   ~4 |   4% | BATCH-5 + R2 |
| 시설작물         |  ~0 |   ~3 |   ~3 |   3% | BATCH-5      |

★ **5개 영역(적과전 + 밭작물 + 종합과수 + 논작물 + 가축)이 61% 차지** — 학습 우선순위 의무

## 4. 50 Candidate Clusters

### 4.1 lv1 + lv2 (20 cluster)

영역(11) × 배점(5점/15점) = 22 가능 / 실제 출제 X 영역 제외 → 20

### 4.2 lv3 (30 cluster)

구체 출제 패턴 단위 (예: "적과전 — 손해평가반 구성", "밭작물 — 옥수수 보험금산정")

### 4.3 26년 drift overlay 영역 (7건)

| TC ID  | 영역                   | drift 사유                             | REV-IDs                                            |
| ------ | ---------------------- | -------------------------------------- | -------------------------------------------------- |
| TC-030 | 무화과 피해율          | LAW-140 별표5 26년 신설                | REV-2026-MUWHA-RESIDUAL                            |
| TC-033 | 밭작물 수확량조사 적기 | 26년 신설 적기                         | REV-2026-28-FIELD-HARVEST-TIMING                   |
| TC-037 | 인삼·해가림            | 26년 1·2형 통합                        | REV-2026-INSAM-MERGE                               |
| TC-039 | 옥수수 농업수입감소    | 26년 손해액 산식 신설                  | REV-2026-37-INCOME-DETAIL                          |
| TC-044 | 고추(노지) 생산비      | 26년 손해정도비율 0.20→0.10 + 계약변경 | REV-2026-LOSS-DEGREE / REV-2026-31-CONTRACT-CHANGE |
| TC-048 | 한우 보험가액          | 26년 출하예정 가입조건                 | REV-2026-LIVESTOCK-COW-AVAIL                       |
| TC-049 | 돼지 도살·살처분       | 26년 축산휴지 산식 정정                | REV-2026-LIVESTOCK-PIG-CESSATION                   |

## 5. ★ 진산 결정 의무 (Spot Check) — 5건

| 결정 ID | 내용                                                           | 권장                             |
| ------- | -------------------------------------------------------------- | -------------------------------- |
| D-S1C-1 | 자료 회차 ↔ 본 시스템 회차 매핑 (자료 1~10회 vs Q-2019~Q-2025) | α (절대 동일, 자료 1~4회 미적재) |
| D-S1C-2 | Cell-level 정확 매핑 (raw extract 한계 — 표 셀 줄 결합)        | γ → β (개략 후 인간 검수)        |
| D-S1C-3 | topic_clusters ID 패턴 (TC-NNN / TOPIC-NNN / CLUSTER-NNN)      | α (TC-NNN, 짧음+명확)            |
| D-S1C-4 | cluster 입도 (lv1만 / lv1+lv2 / lv1+lv2+lv3)                   | lv1+lv2+lv3 (~50개)              |
| D-S1C-5 | scope 확장 (2-1과목 / 1차 3과목 자료 추가 확보)                | α + β carry-over                 |

## 6. ★ Hard Limit + L3 영역 정합 (★ Session 049 후반부 진산 "권장대로 진행" → 모두 해소)

### 6.1 ontology-registry.json L3 변경 — ★ 적용 완료

- 현 ontology-registry node_types: LAW/FORMULA/INVESTIGATION/INSURANCE/CROP/CONCEPT/TERM (7종) — 변경 X
- topic_clusters는 **별도 D1 테이블** (knowledge_nodes 외) → 별도 `topic_cluster_id_pattern` 필드 추가
- **L3 적용 결과**: ontology-registry.json v1.2.0 → **v1.3.0** + `topic_cluster_id_pattern: "^TC-\\d{3}$"` 추가 (진산 "권장대로 진행" 일괄 승인 정합)

### 6.2 D1 적재 — ★ staging+production 양쪽 50 INSERT PASS

- staging: changes 51 / 250 rows / 3.96ms ✅
- production: changes 51 / 250 rows / 3.90ms ✅
- 7쿼리 검증 PASS (50/50 / 11 lv1 영역 / 27+21+2 lv2 / 142 freq 합계 / 50 covered / 1 source unique)
- post-1C verify run1+run2 = PASS 5/0/1 일치 (ontology v1.3.0 변경 영향 0)

### 6.3 0004 트리거 정합 — 검증 통과

- exam_questions UPDATE 차단 (0004 trigger `prevent_exam_questions_update`) — topic_clusters 영역 무관 (별도 테이블)
- topic_clusters는 INSERT-only 영역 (50건 PASS 정합)
- migrations/0005:191-202 NOT NULL trigger 2종 (name / created_at) 통과

### 6.4 ★ Session 041 fix 정합 위반 발견 + 자체 수정

- INSERT SQL에 BEGIN TRANSACTION/COMMIT 포함 → wrangler Auth error 발생
- `grep -v "^BEGIN TRANSACTION;\|^COMMIT;"` 제거 후 재시도 PASS (handoff §주의사항 정합)
- **TD-S49-1 (신규 carry-over)**: 별도 SQL 제너레이터 작성 시 BEGIN/COMMIT 미추가 정합 의무

## 7. 본 단계 1C 진입+적재 결과 (★ Session 049 완료)

- ✅ raw extract (1p / 2,383 chars)
- ✅ 도메인 분석 (11 영역 × 매트릭스 + 출제 빈도 + lv3 패턴)
- ✅ 50 candidate clusters JSON 영속 (lv1+lv2 20 + lv3 30)
- ✅ 26년 drift overlay 영역 7건 식별 (REV-2026-\* 정합)
- ✅ 진산 결정 D-S1C-1~5 모두 적용 ("권장대로 진행")
- ✅ **ontology-registry.json v1.3.0 L3 적용** (`topic_cluster_id_pattern` 등록)
- ✅ **TC-001~TC-050 ID 할당 + topic-clusters-insert.sql 50 INSERT 생성**
- ✅ **staging+production D1 적재 PASS** (각 50건)
- ✅ **7쿼리 검증 PASS**
- ✅ **post-1C verify run1+run2 PASS 5/0/1 일치**

## 8. 차세션 050+ 진입 의무 (★ 본 세션 적재 완료, 후속 의무만 carry-over)

1. ★ entry verify run1+run2 PASS 일치 (TD-VRF-001 retry 의무)
2. ★ question_ids 매핑 영속 (545 questions ↔ TC-001~050) — D-S1C-2=β 인간 검수 후
3. cell-level 정확 매핑 정제 (D-S1C-2=β, Vision multimodal 또는 인간 검수)
4. ★ TD-S49-2 (신규): ontology-registry.ts 인터페이스 + assertRegistryShape + isValidTopicClusterId 헬퍼 동기화 (Pass 1 M-S49-1 carry-over)
5. ★ TD-S49-3 (신규): ADR-032 작성 — v1.1.0→v1.3.0 history + topic_cluster_id_pattern 등록 사유 영구 보존 (Pass 4 MAJOR-2 carry-over)
6. D-S1C-5 β 옵션 (2-1과목 / 1차 3과목 자료 추가 확보) carry-over
7. lv2 혼합값 ("5점/15점") 정제 + question_ids JSON array 정규화 (Phase 2 마이그레이션)
8. exam_frequency 동기화 plan (question_ids 매핑 후 SELECT COUNT 정합)

## 9. Reality Anchor 종합

- ✅ CRITICAL RULE #1 (기획 다른 구현 보고): D-S1C-1~5 5건 진산 spot check 의무
- ✅ CRITICAL RULE #4 (출력 직접 확인): raw extract 텍스트 직접 읽고 11 영역 매트릭스 확인
- ✅ CRITICAL RULE #5 (불가능 시 대안 보고): cell-level 정확 매핑 = α/β/γ 대안 명시
- ✅ Hard Rule "Ontology Lock": topic_cluster ID 패턴 미등록 영역 = ontology-registry 등록 plan 의무 명시
- ✅ Hard Rule "AI 생성 데이터 draft 강제": topic_clusters는 진산 검수 후 활용 (is_covered=1 default 유지)
- ✅ memory "출처 추적성": 모든 cluster에 source 필드 = 자료 PDF 명시
- ✅ memory "지엽 결정 delegation 금지": D-S1C는 전략 갈림길만 상신 (구현 세부 X)
- ✅ memory "문서 우선 워크플로우": raw + 분석 + JSON + SUMMARY 4 영속 후 채팅 요약
- ✅ L3 영역 변경 = ontology-registry.json v1.2.0→v1.3.0 (1줄 추가, plan 채팅 명시 + 진산 "권장대로 진행" 일괄 승인 정합)

---

**작성**: Claude (Opus 4.7 1M context) — Session 049 단계 1C 진입+적재 완료
**다음**: 차세션 050+ 진입 — question_ids 매핑 (D-S1C-2=β 인간 검수) + TD-S49-1~3 carry-over fix + Phase 2 마이그레이션 plan
