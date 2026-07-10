# 인시던트 — 손해평가사 1차 기출 정답 오류 36건 (production old 행)

- **발견일**: 2026-07-10 (promo-1st P3 회차별 독립 검증 중)
- **심각도**: High — 정답 정확성 100% 계약(Hard Stop) 위반. 학습자에게 오답을 정답으로 제시할 수 있음.
- **상태**: 서빙 경로(promo-1st 신규 MC 행)는 **교정 완료**. production **old 행 36건은 오답 잔존**(정정에 상태머신 마이그 필요 = 별도 plan).

## 1. 무엇이

`exam_questions` 의 손해평가사 1차 기출(exam_type='1st', 525행) 중 **36건의 `answer` 컬럼이 공식 최종정답과 불일치**. 원 적재 소스(`docs/batch-load/batch-Q-*/batch-Q-*.json`)의 `source` 필드가 "큐넷 공식 최종정답"이라 주장했으나 실물 정답지와 대조 시 오답.

**회차별**: 5회 1 · 6회 16 · 7회 11 · 8회 8 · 9~11회 0. (6·7·8회 = 표 렌더링/판독 오류 집중 추정.)

전체 목록 = `docs/batch-load/promo-mc-distractors/answer-corrections.json` (id·original·corrected·basis).

## 2. 어떻게 발견

promo-1st P3(4지선다 서빙) 준비 중 "1차 정답 100% 확보" 전제를 **검증 없이 신뢰하지 않고** 회차별 독립 에이전트로 원본 PDF + 공식 정답지 대조 → 36건 적발. 이후 맹검 2차 재확증(35건 일치) + 타이브레이커(5회 Q46) 로 확정. "전제 반증" = CLAUDE.md 최근 실수 로그의 stale/미검증 전제 패턴과 동일 클래스.

## 3. 영향 범위

- **promo-1st 공개 서비스**: 신규 `{id}-MC` 행에 교정값 리터럴 적재 → **영향 없음**(교정된 정답 서빙).
- **production old 행 36건**: `answer` 오답 잔존, status='active'. 내부/인증 학습 경로가 old 행을 소비하면 오답 노출 가능. (단 promo 공개 MC 경로는 distractors=NULL 인 old 행을 parseMcChoices 가 거부하므로 old 행 미서빙.)
- **구조 훼손 4건**(Q-2019-05-021, Q-2024-10-048, Q-2025-11-047, Q-2025-11-048)은 정답 판정 자체 불가 → 서빙 제외.

## 4. 왜 즉시 정정 못 하나 (제약)

`exam_questions` 는 production 트리거 하:

- `0004` `prevent_exam_questions_update` = 전면 UPDATE ABORT (production 적용됨)
- `0038` `prevent_exam_questions_body_update` = distractors·superseded_by·status UPDATE ABORT (미적용이나 화이트리스트 정책)

→ old 행 `answer` in-place UPDATE 불가. 정정하려면 상태머신 재설계(마이그 신설, L3) 또는 SUPERSEDES 신규 행 전략 필요.

## 5. 처분 / 후속

1. **완료**: 서빙 경로는 교정 오버레이로 정확성 확보(promo-1st P3). old 행 무접촉.
2. **필요 (별도 L3 plan)**: old 행 36건 정정 방안 결정 —
   - (A) 상태머신 마이그(0004/0038 answer 화이트리스트 예외) 후 UPDATE, 또는
   - (B) SUPERSEDES 신규 행 + old 행 비활성(단 0038 status ABORT 제약 = 상태머신 필요),
   - (C) old 행을 서빙 경로에서 배제(input_type 재분류)하고 -MC 행만 정본화.
3. **재발 방지**: 원 적재 소스의 `source="공식 최종정답"` 주장을 **적재 시점에 정답지 실물 대조로 검증**하는 게이트 부재가 근인. 향후 기출 BATCH 는 정답지 독립 대조를 적재 게이트에 포함.

## 6. 근거 산출물

- 교정 정본: `docs/batch-load/promo-mc-distractors/answer-corrections.json`
- P3 리포트: `docs/batch-load/promo-mc-distractors/REPORT.md`
- 리뷰: `.claude/reviews/review-20260710-091642-4pass-p3-build-rehearse.md`
