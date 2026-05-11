# Phase 2 — 2차 시험 self-grade UI plan (carry-over)

> **본 plan = L2 영역** (UI 신설, user_progress 갱신 없이 클라이언트 self-grade only).
> **목적**: phase2-eval-mvp.plan §3 가정 ("2차 약술 변별력") vs production 실측 (2차 9건 모두 answer null) mismatch 해소. 진산님 평가 신호 2차 영역으로 확장.
> **세션**: 065 (영속) → 미정 (구현)
> **발화 출처**: Session 065 Step 5-C 진산 옵션 3 채택 (1차 default 즉시 + 2차 self-grade carry-over)

---

## 1. 컨텍스트

phase2-eval-mvp.plan §6.3 채점 라우트 결과:

- 2차 9건 모두 `answer IS NULL` → 자동 채점 100% 불가
- POST `/api/study/grade` → 422 `QUESTION_HAS_NO_ANSWER` "이 문제는 약술/계산형으로 자동 채점이 불가합니다"
- 학습자 진입 차단 → Session 065 진산 옵션 3 선택: 1차 default 즉시 + 2차 self-grade carry-over

본 plan은 2차 9건 평가 신호 복원을 위한 self-grade UI 별도 구축.

## 2. scope (in / out)

### In

1. apps/web `/study?examType=2nd` 또는 별도 라우트 `/study/2nd` 모드 분기
2. AuthForm 패턴 응용 — 모범답안 surface (question.explanation) + 사용자 ✅/⚠️/❌ self-grade 입력
3. self-grade 결과 user_progress UPSERT (correctCount 증감 — 단, ⚠️는 "부분 정답" 명시)
4. 2차 문제 9건만 surface (examType=2nd + answer IS NULL 자동 인식)
5. self-grade 회귀 테스트 ≥ 3건 (✅ correctCount +1 / ⚠️ correctCount 불변 / ❌ correctCount 불변, totalReviews +1)

### Out (별도 plan 또는 명시 carry-over)

- 2차 9건 answer 컬럼 후행 적재 (수동 검수 후 모범답안 텍스트 채우기) — 별도 plan
- AI 자동 채점 (LLM grading 정답 비교) — Phase 3 또는 Phase 2A 별도 plan
- self-grade audit trail (진산 시도 vs 자동 채점 일치율 측정) — 별도 plan
- 약술형 keyword matching (재현율/정확도 비교) — Phase 3 본격 ranking

## 3. 채택안 (자동 결정)

| 결정          | 채택안                                                                  | 사유                                                |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| 진입 분기     | study.astro에서 examType prop 동적 (URL `?examType=2nd`로 진입)         | 단일 페이지 + 동일 컴포넌트 분기                    |
| self-grade UX | 채점 버튼 클릭 → 모범답안 expand → ✅/⚠️/❌ 3-button                    | 단순 + 명확                                         |
| user_progress | ✅ correctCount+1 / ⚠️ 부분점수 (0.5) / ❌ 미가산 / totalReviews+1 모두 | FSRS Phase 2 carry-over는 차치, correctCount 분류만 |
| 422 응답 처리 | QuestionCard.tsx 422 → self-grade UI 분기 (현재 errorMsg surface 대체)  | 학습 흐름 차단 해소                                 |
| 디자인        | 1차와 동일 토큰 (Indigo + Amber + Gray)                                 | AESTHETIC.md 정합                                   |

## 4. ★ Reality Anchor 5문항

### Q1. 불가능 이유 3가지

1. **self-grade는 진산 본인 신뢰 의존** — 자기 채점에 noise 多 (정답 누락 / 본인 답 미세 차이 / 부분점 기준 모호). 평가 신호 정확도 떨어짐.
2. **2차 9건은 모집단 너무 작음** — 단일 문제마다 noise type 4 (A/B/C/D) 1건씩 surface 시 통계 의미 X
3. **2차 answer 컬럼 후행 적재 없으면 self-grade도 모범답안 surface 불가** — explanation 컬럼이 모범답안 대체할 수 있는지 미검증

### Q2. 진산 1회 학습 시 가시 noise 종류

- type-E (신규): self-grade UI 자체 UX (3-button 부담 / 부분점 기준 모호)
- type-F: explanation 컬럼이 모범답안으로 부족 (실제 정답 텍스트 vs 해설 텍스트 차이)
- (A/B/C/D 기존 4 type 모두 잔존)

### Q3. 검증/미검증 가정

- 검증: 2차 9건 모두 active + answer null (production 실측, Session 065)
- 검증: explanation 컬럼 적재 비율 (확인 필요)
- 미검증: explanation 텍스트가 모범답안으로 적합한지
- 미검증: 진산 self-grade 일관성 (분당 노이즈 / 본인 답 vs 모범답안 비교 방식)

### Q4. 진산 발화 의도 차이

- 발화: "옵션 3 (장기적 권고): 두 옵션 결합 — 1차 default 즉시 + 2차 self-grade carry-over"
- 의도 추정: 2차 학습 영역 보존 (진산 시험 1차+2차 모두 응시 의무). 자동 채점 불가 ≠ 학습 불가.
- 정합: 본 plan은 그 의도 정합. 2차 9건 carry-over 보존 + Phase 3 본격 진입 시 LLM grading 검토.

### Q5. 1주/1개월 후 후회

- 1주: 진산 self-grade 입력 부담으로 사용 회피 (1차 525건만 사용) → 본 plan 가치 0
- 1개월: 2차 9건 answer 후행 적재 + LLM grading 도입 시 self-grade UI 자연 deprecated → 본 plan 임시성 명시 carry-over

## 5. 게이트 (binary)

| Gate | 명세                                                                           | 검증                |
| ---- | ------------------------------------------------------------------------------ | ------------------- |
| G1   | apps/web `/study?examType=2nd` 진입 시 2차 9건 중 1건 surface (HTTP 200)       | curl + 진산 browser |
| G2   | QuestionCard 422 → self-grade UI 분기 (3-button 표시)                          | unit test           |
| G3   | self-grade 3-button 클릭 시 user_progress UPSERT (correctCount + totalReviews) | unit test           |
| G4   | 회귀 테스트 ≥ 3건 PASS                                                         | vitest              |
| G5   | Hard Rule 17 grep 0 위반 (apps/web AuthForm 패턴 참조)                         | rg                  |
| G6   | typecheck + lint exit 0                                                        | pnpm                |
| G7   | 진산 production browser self-grade 1회 정상 흐름                               | 수동 검증           |

## 6. 출처

- 발화: Session 065 (2026-05-10) 진산 옵션 3 선택
- 기반 plan: `docs/plans/phase2-eval-mvp.plan.md` §3 + §8.3 + §6.3 (422 QUESTION_HAS_NO_ANSWER 분기)
- 메모리: `feedback_full_autonomy.md` 결정 영역 boundary (컨텐츠 평가 = 진산 결정 영역)
- production 실측: 2차 9건 active 모두 answer null + 1차 525건 active 모두 answer filled (Session 065 D1 query)

---

**작성**: Claude (Opus 4.7 1M context) — Session 065 carry-over
**작성 효력**: 2026-05-10 KST (구현 미정)
**진산님 결정 대기**: 본 plan §3 채택안 + §5 게이트 — 구현 진입 시 진산 발화 정합
