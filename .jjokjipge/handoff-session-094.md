# Session 094 진입 핸드오프 — ThePick (쪽집게)

> **본 핸드오프 = 094** (handoff-093 후속 = Session 093 종착).
> **종착**: 이중 게이트 **TR-0 측 대폭 진전** — 재사용 워크플로우 2종 + 사전심사 +
> TR-0 plan 정정 + D-1~3 진산 결재 + ADR-046 Draft + 마이그 0038 SQL/테스트
> 선작성·검증·4-Pass(CRITICAL 0) + 기획 대비 진척 평가(≈64%). 전부 가역·미커밋·
> production 미접촉.
> **차세션 1차 액션**: 진산 게이트 3건(plan formal 결재+ADR Accepted / D-4 distractor /
> production 적용) + 게이트 B golden 12 검수.

---

## 브랜치 & 컨텍스트

- 브랜치 `main`. 마지막 commit `1a3b19d` (S5-6b plan 고정).
- **미커밋 누적** (Session 091+092+093). production **무변경**(read-only, D1 쓰기 0,
  exam_questions 무변경, vector/graph 호출 0). wrangler --remote 미수행.
- 미추적 `docs/Graph_RAG+Graph_Walk/` 3건 = 세션 무관 (손대지 말 것).
- ⚠️ **ultracode 모드**: 본 세션은 Workflow 다축 오케스트레이션 사용. 차세션도 opt-in 시 동일.

## 본 세션(093)에서 한 일

1. **재사용 리뷰 워크플로우 2종 영속** (`.claude/workflows/`):
   - `4pass-review.js` (Scope→Surgeon/Architect/Advocate/Contract→발견별 적대반증→review-\*.md)
   - `5persona-debt.js` (5 페르소나 병렬+교차 진앙+INDEX, 완료기준 CRITICAL 0 게이트=코드 raw floor 교차검증)
   - `README.md` (레지스트리). 차후 `Workflow({name})` 재사용. [[feedback_auto_review]]/[[feedback_phase_review_5_persona]] 에 실행 도구 포인터 추가.
2. **이중 게이트 사전심사 워크플로우** 실행 (41 에이전트, read-only):
   - golden 12 × 3렌즈 적대검증 = APPROVE 7 / FIX 5 / REJECT 0 / **순환위반 0**
   - TR-0 plan 4 리뷰어 = **만장일치 A안** + **CRITICAL 6 식별**(0008 유령참조·컬럼 누락 등)
   - 산출: `.claude/reviews/review-20260529-133629-dual-gate-prescreen.md`
3. **dogfood 4pass-review** (새 워크플로우 자기검증) → `review-20260529-135905-4pass-changes.md` (CRITICAL 0/MINOR 6, 2건 수정)
4. **TR-0 plan 선결 정정** (사전심사 CRITICAL 6 반영, 실코드 대조):
   - §2 exam_questions **22컬럼 4분류 표** (confusionType:337/calcVariables:341 누락 해소)
   - "0008 status 트리거 보호" **유령 참조 제거** — 실코드: 0008=webhook_events / 0010 CHECK=node·formula·constant(exam_question 미커버) / `deprecate_exam_question()` SQLite 미지원 미구현 → status 0004 전면 ABORT 영구 동결
   - §2.1 진산 결재 OPEN → ✅ **D-1 default-deny / D-2 status ABORT 유지 / D-3 calc_variables 본문급 ABORT**
   - §5.1 G-TR0-6/9/10/11/12 보강
5. **ADR-046 Draft 작성** (`docs/adr/ADR-046-exam-questions-metadata-update-policy.md`):
   - D-0 22컬럼 4분류 1:1 동결 + D-1~3 + D-4 Hard Limit 경계 + D-5 신규컬럼 체크리스트 + **D-6 distractor 7c 충돌 OPEN** + carry-over
6. **마이그 0038 SQL + G-TR0-1~12 테스트 선작성·검증** (진산 "권고대로 진행" 승인 하):
   - `migrations/0038_exam_questions_metadata_update_allow.sql` — `prevent_exam_questions_update` DROP + `prevent_exam_questions_body_update` CREATE (default-deny, 보호 16 `IS NOT` NULL-safe / 화이트리스트 6 허용)
   - `apps/api/src/__tests__/scenarios/migration-0038-metadata-update.test.ts` — **28 PASS**
   - 전체 api **671 passed | 2 skipped (회귀 0)** + typecheck 0 에러
   - **4-Pass** (`review-20260529-213954-4pass-changes.md`): **CRITICAL 0** / MAJOR 2 / MINOR 5
7. **기획 대비 진척 평가** (6축 검증 워크플로우 + 독립 오버클레임 감사):
   - `docs/plans/roadmap-milestone-progress-20260529.md` — 전체 **≈64%** (production-ready 58~64%), 감사 PASS(중대 오버클레임 0), P0 95/P1 62/P2 48/P3 30/Y2 5·0·0
8. **문서 동기**: schema.ts 4분류 JSDoc(MINOR-3, plan §3 4파일 완성) + plan §2.1/§8 + phase2-tech-debt-workflow.md §2/§6 + 본 handoff + CLAUDE.md 현재상태 + memory.

## 4-Pass MAJOR 2건 처리 (review-20260529-213954)

- **MAJOR-1 distractor 7c 충돌**: 0038=distractors ABORT인데 Step 3-UX-7c(`distractor.ts:6,66` + phase3 plan)는 distractors 직접 UPDATE 설계 → forward-compat 트랩(7c 미구현=무파손). **ADR-046 §D-6 + plan §2.1 D-4 OPEN 진산 결재**(권고 SUPERSEDES). [[project_multi_source_choice_basis_track]] 연결.
- **MAJOR-2 L3 결재 순서 역전**: SQL이 formal plan 결재/ADR Accepted 전에 작성됨. production 미수행=데이터 회귀 0. SQL 헤더 STATUS 배너 + plan §8 + ADR-046 상태에 "선작성본, formal sign-off + production 적용 대기"로 명시 라벨링.
- **MINOR**: #3 schema.ts 주석 ✅해소 / #5 ✅**기각**(리뷰어 seed 오독 — input_type seed='multiple_choice' test:62, WHITELIST='fill_blank' test:50 = 실전이, RULE #4 교차검증) / #1 DELETE 가드·#2 이중로더·#4 confusion_type CHECK = ADR-046 carry-over.

## 신규/수정 파일 (미커밋 — Session 093)

### 신규

- `.claude/workflows/{4pass-review.js, 5persona-debt.js, README.md}`
- `.claude/reviews/review-20260529-133629-dual-gate-prescreen.md`
- `.claude/reviews/review-20260529-135905-4pass-changes.md`
- `.claude/reviews/review-20260529-213954-4pass-changes.md`
- `docs/adr/ADR-046-exam-questions-metadata-update-policy.md`
- `docs/plans/roadmap-milestone-progress-20260529.md`
- `migrations/0038_exam_questions_metadata_update_allow.sql` ⚠️ **선작성본(진산 formal 결재 전)**
- `apps/api/src/__tests__/scenarios/migration-0038-metadata-update.test.ts`
- `.jjokjipge/handoff-session-094.md` (본 파일)

### 수정

- `docs/plans/tr-0-backend-c7-trigger-redesign.plan.md` (§2/§2.1/§5.1/§8 정정)
- `docs/plans/phase2-tech-debt-workflow.md` (§2 사전심사 + §6 진척 표)
- `apps/api/src/db/schema.ts` (examQuestions 4분류 JSDoc, shape 무변경)
- `CLAUDE.md` (현재 상태 Session 093 갱신 + 실수 로그)

### Memory (repo 외)

- `feedback_auto_review` + `feedback_phase_review_5_persona` 실행 도구 포인터
- `project_phase2_tech_debt_review_20260529` Session 093 진척 append
- `reference_roadmap_milestone_tracker` 신규 + MEMORY.md 인덱스

## 다음 할 일 (차세션 1차 액션)

### A. 커밋 (진산 "커밋" 지시 시)

권장: Session 091+092+093 누적. 분할 예:

1. `docs(eval): S5-6b pilot golden draft` (091)
2. `docs(review): Phase 2 5-페르소나 + Q1~Q4 + TR-0/TR-4` (092)
3. `feat(workflow): 재사용 리뷰 워크플로우 2종 + 사전심사/dogfood/진척평가` (093 워크플로우·리뷰)
4. `feat(api): TR-0 마이그 0038 default-deny 트리거 + G-TR0 테스트 + ADR-046` (093 TR-0) ⚠️ **진산 formal 결재 후 커밋**

### B. ★ 진산 게이트 3건 (TR-0 측 완료 조건)

1. **plan 정식 결재 + ADR-046 Accepted** — 선작성 SQL/테스트 formal sign-off. plan `approved_by` 갱신 + ADR-046:3 상태 Accepted 전환.
2. **D-4 distractor 결재** (ADR-046 §D-6) — distractors UPDATE: (a)SUPERSEDES 권고/(b)화이트리스트/(c)staging.
3. **production 적용** — plan §6 step6 `wrangler d1 ... --remote` (진산 Cloudflare 인증 게이트). 적용 후 G-TR0-5/6 production smoke.

### C. 게이트 B golden 12 검수 (별개 트랙, 사전심사 완료)

- `docs/plans/s5-6-measurements/golden-pilot-draft.md` 12 APPROVE/FIX/REJECT
- 사전심사 권고: APPROVE 7 / FIX 5(Q-012·014 즉시보강 가능, Q-015 CONCEPT-105 제거, Q-031·004 근사 anchor). `golden-pilot-draft.json` jinsanReview.decision 갱신 → approved.json 동결.

### D. 측정 종결 (B + 게이트3 완료 후)

- related_nodes 백필 UPDATE(0038 적용 후 가능) → G-S5 pilot 측정(진산 인증) → N=12 워터마크 영속 → 측정 분기(workflow §3) → S5-7 §7 GO/NO-GO.

### E. Phase 2/3 closure (TR-1~TR-4, ~109h) — roadmap-milestone-progress-20260529.md §6.3

## 주의사항

- ⛔ **마이그 0038 = 선작성본**: formal plan 결재 + ADR-046 Accepted **전**에 작성됨(진산 "권고대로 진행" 진행 승인 하, 4-Pass MAJOR-2). production 미적용=가역. 커밋·적용은 formal sign-off 후.
- ⛔ **L3 production 적용은 진산 게이트**: `wrangler --remote` = Claude 미수행. 로컬 검증(node:sqlite 28 PASS)이 dry-run 등가이나 production 적용 자체는 진산 인증.
- ⛔ **D-4 distractor 미결**: 0038 = distractors ABORT 유지. Step 3-UX-7c 착수는 D-4 결재 후(직접 UPDATE 불가).
- ⛔ **N=12 워터마크 / signal-direction 만** (Q2 A안). G-S5 측정 리포트·S5-7 GO/NO-GO 정합.
- ⛔ **자율 실행 금지 영속**: L3(마이그/스키마/Formula Engine)은 plan→진산 결재→코딩. 본 세션 SQL 선작성은 "권고대로 진행" 명시 승인 하 가역 작업 한정.
- 🆕 **차세션 검증 권고**: 진산 formal 결재 시 plan approved_by + ADR-046 상태 실제 갱신 확인. production 적용 후 0038 트리거가 production에서 G-TR0-5/6 smoke 통과하는지 진산 인증 세션에서 재확인.

## 차세션 1차 액션

1. CLAUDE.md "현재 상태"(Session 093 갱신) + handoff-094 + `phase2-tech-debt-workflow.md` §6 통독
2. memory `project_phase2_tech_debt_review_20260529` + `reference_roadmap_milestone_tracker` + `project_g_s5_golden_data_gap` 통독
3. **B 진산 게이트 3건** + **C golden 검수** 진행 (전부 진산 결재/인증)
4. 게이트 해소 시 D 측정 종결 (북극성)
