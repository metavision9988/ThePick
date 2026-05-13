# Step 3-UX-6b QuestionCard 4 input type 분기 4-Pass 독립 리뷰 통합

- **리뷰 일시**: 2026-05-13 13:24 KST (Session 071)
- **리뷰 대상**: apps/web/src/components/QuestionCard.tsx 리팩토링 + 신규 7 파일 (question/types.ts, ContextStrip, MultipleChoice, FillBlank, Essay, Calc, ResultSection)
- **리뷰 방식**: 독립 에이전트 2개 병렬 (Pass 1+2 / Pass 3+4) — auto-review-protocol §"규칙 0 독립 에이전트 필수" 정합

---

## 1. 리뷰 결과 합계

| Pass               | 에이전트                  | Critical | Major | Minor |
| :----------------- | :------------------------ | -------: | ----: | ----: |
| Pass 1 (Surgeon)   | feature-dev:code-reviewer |        0 |     2 |     2 |
| Pass 2 (Architect) | feature-dev:code-reviewer |        1 |     1 |     1 |
| Pass 3 (Advocate)  | quality-engineer          |        0 |     1 |     4 |
| Pass 4 (Contract)  | quality-engineer          |        0 |     0 |     2 |
| **합계**           | —                         |    **1** | **4** | **9** |

## 2. Critical 1건 — 흡수 완료

### C-1 (Pass 2) — NextResponseSession.mode 타입 후퇴

**문제**: `apps/web/src/components/question/types.ts:76` `mode: string` 으로 느슨하게 선언됨. 서버 `apps/api/src/study/routes.ts:305-309` `mode: LearningMode` ('category'|'topic'|'confusion'|'weak'|'mixed') 와 불일치. 본 필드 소비처가 추가되면 타입 오류 silent 통과.

**fix (커밋 1138a6c 후속)**:

- `types.ts`에 `LearningMode` + `SessionPhase` 리터럴 유니온 신규 export
- `NextResponseSession.mode: LearningMode` + `phase: SessionPhase` 좁힘
- `SessionProgress.phase: SessionPhase` 동일 적용

검증: typecheck + lint + build 모두 PASS.

## 3. Major 4건 — 모두 흡수 완료

### M1 (Pass 1) — Essay textarea maxLength 미설정

**문제**: `Essay.tsx:31` textarea에 `maxLength` 없음. 서버 `gradeSchema.userAnswer: z.string().max(2000)` 강제. 2000자 초과 시 422 에러 수신 (UX 손상).

**fix**: `Essay.tsx`에 `maxLength={2000}` 속성 추가 + 글자 수 카운터 (`{value.length} / 2000`) UI 영속.

### M2 (Pass 1) — FillBlank/Calc "Enter 채점" 안내 vs 실제 Ctrl+Enter 동작 불일치

**문제**: `FillBlank.tsx:31` / `Calc.tsx:57` 안내 텍스트 "Enter 채점"이지만 `QuestionCard.tsx`의 키보드 핸들러는 `Ctrl+Enter`만 처리. 사용자 기대 mismatch.

**fix**: 안내 텍스트를 "Ctrl+Enter 채점"으로 정정 (Enter 단독 핸들러 추가는 multipart 입력 시 우발 채점 위험으로 회피, 일관성 우선).

### M3 (Pass 2) — multiple_choice + choices=null 탈출 불가 상태

**문제**: 서버 `buildShuffledChoices` 실패 시 `inputType='multiple_choice' + choices=null` 응답 가능. 클라이언트는 입력 UI 미렌더 + canSubmit 영구 false → "다음 문제" 버튼도 없음. 사용자 막힘.

**fix**: `QuestionCard.tsx`

- `choicesMissing` 변수 도입
- 입력 영역에 안내 박스 (`role="alert"` + amber 톤) "이 문제는 보기 정보가 누락되어 채점할 수 없습니다. 다음 문제로 이동하세요."
- "다음 문제 (Ctrl+N)" 버튼을 isGraded || choicesMissing 시 노출
- Ctrl+Enter / Ctrl+N 키보드 단축키도 choicesMissing 시 `fetchNext` 라우팅

### M4 (Pass 3) — MultipleChoice sr-only radio focus indicator 부재

**문제**: `MultipleChoice.tsx:55` label에 hover만 있고 `focus-within` ring 없음. 키보드 사용자가 Tab 이동 시 어느 보기에 focus가 있는지 시각 표시 0. WCAG 2.1 §2.4.7 Level AA Focus Visible fail 위험.

**fix**: label className에 `focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200` 추가.

## 4. Minor 9건 — carry-over

| ID      | 출처                                      | 항목                                                                                      | 처리                                                    |
| :------ | :---------------------------------------- | :---------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| m1 (P1) | ResultSection.tsx:22                      | renderUserAnswer essay + selfRating=null 경로 미명시 (canSubmit으로 차단되어 실제 발생 X) | carry-over (Step 3-UX-6e or Phase 종료 정리)            |
| m2 (P1) | ContextStrip.tsx:19                       | key={i} (배열 index) 대신 key={p} 권장                                                    | carry-over                                              |
| m3 (P2) | ResultSection.tsx:25-26                   | userAnswer.length !== 1 multiple_choice 케이스 raw 출력                                   | carry-over (서버가 단일 라벨 보장)                      |
| m4 (P3) | Calc.tsx:43-57                            | server 측 단위 (`'원'`) 동적 표기 부재 — placeholder/footer 안내만                        | carry-over (NextQuestion type에 unit 필드 추가 시 처리) |
| m5 (P3) | Essay.tsx:17                              | 자기 채점 라벨 "맞음" vs AESTHETIC §3.6 "정답입니다 보다 정답" — 진산 명시 카피 PASS      | PASS (Silent Pivot 아님)                                |
| m6 (P3) | ContextStrip.tsx:20                       | middot `mr-3` + 부모 `gap-x-3` 중복                                                       | carry-over (UI 검증 시 정리)                            |
| m7 (P3) | ContextStrip — landmark/heading 부재      | SR 사용자 출처 인지 어려움                                                                | carry-over (Step 3-UX-6e a11y 검증)                     |
| m8 (P4) | Essay self-rating "모름" → "부분 정답"    | AESTHETIC.md §3.5 원본 갱신 권고                                                          | carry-over (AESTHETIC §5.5에 부분정답 별도 영속)        |
| m9 (P4) | C variant 카드 상단 progress strip 미통합 | LOCK §1은 "context strip만" 명시 → 정합                                                   | carry-over (Step 3-UX-6c 외부 TopBar 통합 시 결정)      |

## 5. 판정

**완료 가능** ✅

- Critical 0건 (C-1 흡수 완료)
- Major 0건 (M1~M4 모두 흡수 완료)
- Minor 9건 carry-over (Step 3-UX-6e 또는 Phase 3 종료 정리 chain 정합)

## 6. 통합 후 게이트 재확인

- apps/web typecheck ✓ PASS
- apps/web lint ✓ PASS (eslint 위반 0건)
- apps/web build ✓ PASS (Astro 3 pages built, QuestionCard 14.70 kB / gzip 4.57 kB)
- apps/api typecheck ✓ PASS (회귀 0)
- apps/api lint ✓ PASS
- packages/learning-modes test ✓ 116/116 PASS (회귀 0)
- Hard Rule 17 위반 0건 (grep 'son-hae-pyeong-ga-sa' apps/web/src → 0건)
- AESTHETIC §4 안티패턴 0건 (gradient/별/트로피/폭죽/모드슬라이더/SNS/프리미엄띠 모두 grep 0건)

---

# 부록: 검토 항목 증거 추출 (Pass별 PASS 확인 3개+)

## Pass 1 Surgeon (PASS 9건 일부)

- QuestionCard.tsx:253 — `question.choices !== null` 가드 정확
- QuestionCard.tsx:95-99,150-154 — try-catch + setPhase('error') + setErrorMsg 전파
- MultipleChoice.tsx:28-29 — Ctrl/Meta/Alt 회피 + input/textarea focus 회피
- types.ts:88-94 — AnswerState readonly 일관 적용

## Pass 2 Architect (PASS 10건 일부)

- types.ts:6 vs packages/learning-modes/src/types.ts:8-9 — InputType 4값 일치
- types.ts:33-47 vs routes.ts:285-302 — NextQuestionOut 13 필드 100% 일치
- QuestionCard.tsx:37 — Hard Rule 17 정합
- 모든 인터랙티브 minHeight:44 일관

## Pass 3 Advocate (PASS 14건 일부)

- MultipleChoice.tsx:4 — "정답 라벨은 서버 측 결정 (클라이언트 비노출)"
- QuestionCard.tsx:128,135,139,153 — 한국어 평서체 에러 메시지
- ResultSection.tsx:56-87 — dl 출처 always-on, details는 관련 자료만
- amber-100 + amber-900 대비비 ≈ 10.0:1 (WCAG AA PASS)

## Pass 4 Contract (PASS 11건 일부)

- QuestionCard.tsx:232-322 LOCK A+C 정합 (chrome A + ContextStrip C)
- AESTHETIC.md:203 ContextStrip 토큰 char-for-char 일치
- AESTHETIC.md §5.5.4 객관식 선택 카드 토큰 100% 일치
- grep 'son-hae-pyeong-ga-sa' apps/web/src → 0건 (Hard Rule 17)
