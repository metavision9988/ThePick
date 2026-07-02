# 결정 카드 #10 — weak_score 의미 확정 (WS-5d)

> 작성: 2026-06-12 / 상태: **결재 완료 (2026-07-02)** — (a) D2 복원·단계 집행 채택
> 배경: 진산 D2 lock(★ FSRS-4 + **subject+concept** 약점 정의, `phase3-learning-ux-modes.plan.md:715,726`)과
> 실 구현의 입력 집계 수준이 다름 = Silent Pivot. MASTER_PLAN §3 WS-5 5d(`MASTER_PLAN.md:169`) +
> §6 결재 #10(`MASTER_PLAN.md:246`) — 어느 쪽이든 **해소 ADR 필수** (Binary Gate G-WS5 ④ `MASTER_PLAN.md:173`).

## 실코드 대조 (2026-06-12 검증 — file:line 전부 직접 확인)

| 구분      | D2 lock 정의                                                                                                        | 현 구현                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 산식 골격 | `weakScore = α·(1−subject_correct_rate) + β·(1−concept_stability)` (plan §6.4 :726, α0.6/β0.4 `srs/types.ts:81-84`) | **동일** — `computeWeakScore` (`packages/srs/src/weak-score.ts:40-50`)                          |
| α축 입력  | **과목(subject) 단위** 사용자 정답률 (`srs/types.ts:64-72` 주석도 "해당 과목 정답률")                               | **해당 문항 카드 1건**의 correct_count/total_reviews (`apps/api/src/study/routes.ts:1123-1125`) |
| β축 입력  | **concept(지식 노드)** 의 FSRS stability (`srs/types.ts:69`)                                                        | **해당 문항 카드 자신**의 FSRS stability (`routes.ts:1128` nextState.stability)                 |
| 조회 row  | 과목·개념 횡단 집계                                                                                                 | `WHERE user_id+card_id+card_type='exam'+node_id IS NULL` 카드 1행 (`routes.ts:1102-1107`)       |

**Silent Pivot 실체 1줄**: 산식 모양은 D2 그대로이나 입력 2축이 전부 "문항 카드 1건"으로 축소되어,
weak_score = "과목+개념 횡단 약점"이 아니라 사실상 **"그 문항 1개를 못 푸는 정도"** (변수명만 subject/concept 잔존 — 주석 `routes.ts:1122` "(D2 lock)"은 현재 부정확).

보조 사실: 소비층은 weak mode `ORDER BY weak_score DESC`(`routes.ts:874-881`) + 세션 요약의 subject 집계는 **소비 시점 별도 SQL**로 수행(`routes.ts:1942-1962`).
원천(카드별 total_reviews/correct_count, FSRS state) 영속 = 후행 재계산 **가역**(`MASTER_PLAN.md:169`). node 단위 user_progress 쓰기 경로는 존재(`progress/routes.ts:281-284` INSERT)하나 fsrs_stability 는 고정 시드(0.3/1.0/1 하드코딩, `:284`)만 적재·재리뷰 UPDATE 는 total_reviews/correct_count 만 갱신(`:262-263`, scheduleReview 미호출) = **node 단위 FSRS 누적 경로 자체가 미구현**. node row production 적재량 [미조사].
(참고: MASTER_PLAN 5d의 좌표 `types.ts:54-61`/`routes.ts:1063-1070`은 현행 코드 기준 `types.ts:64-78`/`routes.ts:1122-1129`로 이동 — 본 카드 좌표가 현행.)

## 선택지 비교

| 기준      | (a) D2 정의 복원 (단계 집행)                                                                                                                                                                                       | (b) 재정의 ADR — 카드 단위 의미로 격상                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 내용      | α축=subject 집계 정답률(user_progress⋈exam_questions.subject SQL — 즉시 가능) 먼저, β축=concept stability 는 node FSRS 누적 경로 **구현**(현 미구현, 상단 보조 사실)+적재 후 2단계(그 전 카드 stability 폴백 명시) | 코드 동작 무변경. 변수·주석을 cardCorrectRate/cardStability 로 정직화 + D2 와의 차이를 ADR 에 기록 |
| 기획 정합 | D2 lock(진산 ★결정) 복원 — CRITICAL RULE #1 정합                                                                                                                                                                   | D2 lock 폐기·대체 (재결재 그 자체)                                                                 |
| 학습 효과 | 과목 약점 + 개념 안정도 횡단 신호 (D2 의도)                                                                                                                                                                        | "틀린 문항 재출제" 수준으로 의미 축소 — weak mode 차별성 약화 [추정]                               |
| 비용/위험 | 채점 hot path 에 집계 쿼리 +1 [추정] · β축 누적 경로 구현 비용 + node row 적재량 [미조사] · 기존 저장값 재계산 백필 필요(가역)                                                                                     | 비용 최소(주석·네이밍·테스트) · 단 D2 의도 영구 상실                                               |
| 공통 의무 | 양쪽 모두 **ADR + 구현-정의 일치 테스트** = G-WS5 ④ (`MASTER_PLAN.md:173`)                                                                                                                                         | 동일                                                                                               |

## 권고

**(a) D2 정의 복원 — 단계 집행** (α축 subject 집계 즉시 / β축은 node FSRS 누적 경로 구현·적재 후 — 현 미구현(보조 사실)이므로 그 전까지 카드 stability 폴백을 ADR 에 명시).
근거: D2 는 진산 ★lock 결정(:715)이고 원천 데이터 영속으로 가역(:169) — 기획 복원 비용이 낮고, (b)는 약점 모드의 설계 의도 자체를 상실. 단 hot path 비용·β축 원천은 [추정]/[미조사]이므로 ADR 에 측정 게이트 동봉.

> 진산 확인란: ☑ (a) D2 정의 복원(단계 집행, ADR 필수) **(진산 2026-07-02 "권고대로")** / ☐ (b) 카드 단위 재정의 ADR / ☐ 보류
