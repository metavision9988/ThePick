# 핸드오프 — promo-1st P4 (프론트엔드) 진입

- **작성**: 2026-07-10 (Fable 5), P3 완결 직후.
- **다음 세션 첫 액션**: 이 파일 + `.jjokjipge/handoff-to-opus-promo-1st-20260708.md`(원 실행 정본) + AESTHETIC.md 읽고 P4 착수.

## 0. 거버넌스 (불변 — 2026-07-08 진산)

- **결재 큐 금지**: 갈림길 = 위임 결정 기록(결정+사유+기각 대안, "위임" 라벨) 후 **바로 구현**. 보고 = URL·화면·수치.
- **안전선(위임 밖)**: ①정답 100% ②AI 생성물 draft + 기계·독립에이전트 다중검증(리포트 영속) ③Hard Limits ④불가역 production 작업은 실행 전 1줄 고지 ⑤독립 리뷰(4-Pass) 스킵 금지.
- 커밋·push 자율 (main 브랜치 = 1호 손해평가사 트랙).

## 1. 완료 (P0~P3, 전부 커밋·push)

- **P0**(커밋됨): AuthForm 자동로그인 크리덴셜 제거 + 미보유 thepick.app CORS 제거 + resolveSafeNext open-redirect 가드.
- **P1**(`f6e2508`): 공개 학습 표면 `/api/public/*` — GET `/questions/next`(exam_type='1st'+active+SERVABLE 경계) · POST `/grade`(불투명 choiceId HMAC 무상태 채점). parseMcChoices 단일 정본. PII 0(익명 AE + 해시 IP rate limit).
- **P2**(`914d47b`,`9e55c58`): web 로컬 진도 계층(Dexie `thepick-local-progress` — cards/reviews/streak/meta, FSRS replay, export/import 의미검증). 서버 동기화 0(G-1 로컬 전용).
- **P3**(`8007a0b`): ★4지선다 서빙 MC 행 **521** production 적재.
  - 전략: old 행 UPDATE 불가(0004/0038 트리거 ABORT) → 신규 `{id}-MC` 순수 INSERT, old 무접촉.
  - ★**정답 오류 36건 적발·교정**(회차별 독립 PDF 대조 7 + 맹검 2차 3 + 5회 Q46 타이브레이커). 원 적재 JSON="공식정답" 주장 반증. 구조훼손 4건 정직 제외.
  - 검산: mc 521 / old 525 무변경 / 교정 반영 36 / leak 0. 독립 4-Pass Critical 2→0.
  - 정본: `docs/batch-load/promo-mc-distractors/{REPORT.md, answer-corrections.json, validation-report.json, insert-round-{5..11}.sql}` + 리뷰 `.claude/reviews/review-20260710-091642-4pass-p3-build-rehearse.md`.
  - ⚠️ 인시던트: `docs/audit/incident-1st-answer-errors-20260710.md` — old 행 36건 오답 잔존(상태머신 마이그 별도 L3 plan). 서빙 경로는 안전(-MC 행 교정 완료).

## 2. P4 스코프 (FE-1~9, 핸드오프 원본 §P4)

- **리디자인**: FE-2 4지선다(`MultipleChoice.tsx` 완비·휴면 — 스타일·플로우 재설계) / FE-4 빵꾸노트(`FillBlank.tsx` + M9 단계 힌트 신규).
- **신규**: FE-1 랜딩(+OG/twitter 메타·sitemap·robots 현재 0) / FE-5 카드플립+FSRS 4버튼(로컬) / FE-7 스트릭 / FE-8 결과 공유(클라 canvas 이미지) / FE-3 픽커 / FE-9 상태 4종(로딩/빈/에러/오프라인)+접근성(44px·모바일 80%).
- **mock 병행**: 라이브 API만 P3/P5 게이트 — mock 픽스처로 화면은 즉시 구현.

## 3. P4 디자인 입력 (코드 전 필수 흡수)

1. **AESTHETIC.md**(전역, 선독 의무): Indigo 600 주 + Amber 500 강조 1곳 + Gray 9단계 / Pretendard / 그림자보다 얇은 보더(0.5px)·rx 8·12 / 카드보다 리스트 / 1280 max / 그라디언트 히어로·3열 Feature 카드·과잉 애니메이션 **금지** / 신규 화면은 A·B·C 3안 자체 선정(G-7)+기각안 보고.
2. **진산 Claude Design 시안(정본 시각 언어)** `docs/design/claudeDesign/`: app.jsx·shared.jsx(디자인 시스템 코어) + session-start·session-summary·question-card·mode-selector·progress-viz·design-canvas. → 확립된 언어는 **honor**, 3안은 신규(FE-1 랜딩 등)에만.
3. **방법론 md** `docs/사용자UIUX/`: 쪽집게*암기대상*인터랙션*방법론.md + 쪽집게*지형도*도출*표현방법론.md(지형도 = P5 FE-6) + 학습 인터랙션 랩.html.
4. **기존 시스템**: `apps/web/tailwind.config.mjs` + `apps/web/src/components/{question,session,review,progress}/` + `apps/web/src/lib/local-progress/`(P2 완비 — FE-5/7 소비) + `packages/learning-modes`(parseMcChoices·resolveInputType·FSRS).

## 4. P4 진입 순서 (권고)

1. AESTHETIC.md + claudeDesign 8종 + 방법론 2종 흡수 → 디자인 토큰·컴포넌트 매핑 정리.
2. FE-1 랜딩 = 신규 → A/B/C 3안 자체 선정(기각안 근거 기록) → 구현.
3. FE-2/4/3/5/7/9 = 시안 정합 구현(mock 픽스처). local-progress 배선(FE-5 카드플립→recordReview / FE-7 스트릭→getStreak).
4. Binary Gate에 `pnpm --filter @thepick/web build` **포함**(m-8 원장) + typecheck + lint + web 테스트.
5. 완료 전 독립 4-Pass 리뷰(FE 스코프) + review-\*.md 영속.

## 5. carry-over (P4에서 처리)

- i18n 오류코드 매핑(공개 API 에러 → 사용자 문구) / AuthForm 44px 터치 타겟 / FE-5 'card' AE 이벤트 배선 / 봉투 examId(BE-7).

## 6. 이후 (P5)

지형도 API(기출 축)+FE-6 / Web Analytics 스니펫 / E2E 스모크 / 전체 green / **wrangler 배포(staging→production)** — 공개 라우트 `/api/public/*` 현재 미배포(라이브 404) = P5에서 배포 → 라이브 스모크 → 최종 결과 보고.
