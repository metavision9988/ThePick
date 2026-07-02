# PITR — /study/next 의 FSRS due 반영 방식 (WS-5c 후속, 결재 상신)

> 작성: 2026-06-12 / 상태: **결재 대기** (RULE #5 — 채택은 진산)
> 맥락: WS-5c 1차(완료 — 본 세션)는 `/api/progress/due` 의 첫 소비자(web 복습 큐 위젯:
> due 카운트 + 학습 진입 CTA)까지다. **`/study/next` 서빙 자체는 due 를 모른다** —
> due 카드가 세션에 우선 등장하지 않는다 (위젯 CTA 라벨도 그래서 "복습 시작"이 아닌
> "학습 시작"으로 정직 표기). 다음 단계 방식을 본 PITR 로 상신한다.

## 사실 (실코드·실데이터)

- `/api/progress/due` (progress/routes.ts) = user_progress 의 `fsrs_next_review IS NULL OR <= now`
  행을 LIMIT 반환. **card_type 무필터** (4-Pass MAJOR 정정 2026-06-12 — 구 "node 카드 기반·exam 과
  별개 축" 서술은 실코드 반증): node 행(POST /progress/review 시드, fsrs_next_review NULL) +
  **exam 카드 행**(study /grade 의 FSRS 영속분, node_id NULL) 모두 포함. node 행의 FSRS 값은
  하드코딩 시드뿐(node-FSRS 누적 미구현 — `decision-card-10-weak-score.md` 보조 사실과 교차).
  /due 의 카드 축 의미(node 전용 vs 전 카드)를 못박는 1줄 결정도 본 PITR 채택 시 동반 필요.
- `/study/next` (study/routes.ts) 서빙 풀 = exam_questions × user_progress(card_type='exam')
  LEFT JOIN. ORDER BY = 미시도 우선 + correct_count ASC (weak 모드만 weak_score DESC).
  **fsrs_next_review 참조 0건.**
- FSRS due 의 학습자 전달 단절 = 감사 RC-3 확정 발견 (MASTER_PLAN §1.2).
- exam 카드 행의 FSRS 필드는 시드값 위주 (결재 #10 카드의 실측 — node-FSRS 누적 경로
  자체가 미구현, decision-card-10-weak-score.md 참조). **due 우선 정렬을 지금 배선해도
  정렬 키 데이터가 빈약**할 수 있음 — 선행 실측 필요.

## 선택지

| 안                                             | 내용                                                                       | 장점                                                               | 단점·위험                                                                                                                            |
| :--------------------------------------------- | :------------------------------------------------------------------------- | :----------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| (A) /next ORDER BY 즉시 반영                   | 기존 모드 ORDER BY 에 `fsrs_next_review <= now` 우선 키 추가               | 코드 최소(ORDER BY 1줄)·모든 모드에 자동 적용                      | 기존 "미시도 우선" 계약과 충돌(우선순위 재정의 = 학습 UX 의미 변경). FSRS 필드 데이터 빈약 시 무의미 정렬. 회귀 표면 = /next 전 모드 |
| (B) 별도 복습 모드 (6번째 모드 또는 weak 확장) | `review` 모드 신설: 풀 = due 카드만, ORDER BY = fsrs_next_review ASC       | 계약 명확(복습 = due 만)·기존 모드 불변·ADR-039 계약 확장으로 정직 | LEARNING_MODES enum 확장 = packages/learning-modes + UI + ADR-039 개정(ADR 필요). 작업량 中                                          |
| (C) 현 상태 유지 (위젯까지)                    | due surface 만 — 서빙 반영은 결재 #10(weak_score)·FSRS 원천 실측 후 재상신 | 데이터 빈약 상태에서 무의미 배선 회피. #10 결정과 시퀀스 정합      | RC-3 "due 미구동" 단절이 1단계만 해소된 채 잔존                                                                                      |

## 권고

**(C) → #10 결재·FSRS 원천 실측 후 (B) 재상신.** 근거: ① due 정렬 키(fsrs_next_review)의
실데이터 품질이 미실측 — 빈약하면 (A)/(B) 모두 전시물이 된다 (결재 #10 카드의 node-FSRS
미구현 발견과 동일 축). ② (A)는 기존 모드 계약을 암묵 변경(Silent Pivot 위험). ③ (B)가
구조적으로 정직하나 ADR-039 개정이 필요해 #10(weak_score 의미)과 묶어 결정하는 것이
일관적. 단 권고일 뿐 — 채택은 진산.

> 진산 확인란: ☐ (A) 즉시 반영 / ☐ (B) 별도 복습 모드 (ADR-039 개정 동반) / ☐ (C) 보류 후 #10 연동 재상신
