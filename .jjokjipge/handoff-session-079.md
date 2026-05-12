# Session 069 본격 종착 핸드오프 — ThePick (쪽집게)

> **본 세션(069) 종착**: ★★★★ Phase 3 launch 직전 production deploy chain 5/5 + WBS reconstruction + UX plan 696 lines + Step 3-UX-2/3 (packages/learning-modes + packages/srs) 모두 완료.
> **다음 세션(070) 진입 시 본 파일을 가장 먼저 읽고 Step 3-UX-4 마이그레이션 plan / Step 3-UX-5 apps/api 통합 / 또는 별도 priority 결정으로 진행.**
> **본 핸드오프 번호 = 079** (handoff-078 직계 후속, Session 069 본격 종착)

---

## 브랜치 & 컨텍스트

- 브랜치: main (origin/main 일치 — Session 069 전체 push 완료)
- Session 069 entry HEAD: b104d2c (handoff-077 commit, Session 068 종착)
- Session 069 종착 8 commits (시간 순):
  - **a5a8dac** — chore(ops): Phase 3 launch deploy Step 1-5 (production migration 0030/0031 + redeploy + smoke + ADR retrofit)
  - **faf1794** — docs(handoff-078): Session 069 종착 1차 (deploy chain 5/5)
  - **92550b3** — docs(wbs): Session 069 본격 sync — Phase 2/2.5/3 chain 30 세션 milestone reconstruction
  - **04db69a** — docs(plan): Phase 3 학습 UX 모드 본격 plan 신설 (phase3-learning-ux-modes, 696 lines)
  - **e73f1df** — docs(plan): Phase 3 UX plan §13 진산 결정 lock — D1~D6 권고대로 lock
  - **66f98cd** — feat(learning-modes): Step 3-UX-2 packages/learning-modes 신설 — Engine-First (17 files, 68 tests)
  - **3ea4533** — feat(srs): Step 3-UX-3 packages/srs 신설 — FSRS-4 wrapper + weak_score (10 files, 35 tests)
- 미커밋: 0 (lock 파일 .claude/scheduled_tasks.lock만 untracked, 무관)

---

## ★★★★ 본 세션(069) 한 일 — 4 메이저 chunk

### A. Phase 3 launch 직전 production deploy chain Step 1-5 (commit a5a8dac)

| Step | 작업                                   | 결과                                                               |
| ---- | -------------------------------------- | ------------------------------------------------------------------ |
| 1    | Migration 0030 + 0031 production apply | login_history audit trail + event_type 컬럼 + 인덱스 4종           |
| 2    | Production secret 검증                 | JWT/IP_PEPPER/MOCK/ADMIN 4종 정합                                  |
| 3    | apps/api production redeploy           | Version 02267900-7171-4526-a73e-b6f42ce48737, Worker startup 12 ms |
| 4    | Smoke test                             | login_history baseline 0 → 1 row, event_type='login', ip_hash 정합 |
| 5    | ADR-034/035/036 retrofit               | Accepted → Accepted (temporary) + 4 의무 필드 (ADR-037 정합)       |

### B. WBS reconstruction (commit 92550b3) — Session 040~069 30 세션 본격 sync

§0 + §1 + §2 + §4 + §6 + §7 6 섹션 본격 갱신. handoff-077 §5 carry-over 의무 종착.

- §1 신규 트리: Phase 2 Eval MVP (25 세션) + Phase 2.5 인증 chain (2 세션) + Phase 3 launch chain (Stage A~E) + Step 1-5
- §2 신규 Gantt: Phase 2/2.5/3 progression 10일 농축 mermaid
- §4 신규 매트릭스: Phase 3 launch 후속 quarterly carry-over 10 항목 (P0~P3)
- §6 신규 정합표: 23 신규 memory 매핑
- §7 신규 트리거: Phase 3 launch 후속 결정 트리거 6종

누적 통계 영속: ADR 8건 / 마이그레이션 13건 / 4-Pass 12회+ / 5-페르소나 4회 / CRITICAL 21건 흡수.

### C. Phase 3 학습 UX plan 본격 작성 (commits 04db69a + e73f1df, 696 lines)

진산 명시 발화 (Session 065) 정합. 15 섹션 본격 plan:

- §1 5축 분해 + 출처 1급 정합
- §2 ★ Reality Anchor — 학습 UX 함정 3가지 (distractor 부재 / FSRS 이력 부재 / 클라이언트 셔플 누설)
- §6 ★ PITR — 6 영역 기술 선택지 비교
- §7 ★ Engine-First — packages/learning-modes + packages/srs 분리
- §8 데이터 모델 (마이그레이션 0032~0035)
- §10 단계별 구현 (Step 3-UX-2~7)
- §13 ★ 진산 결정 D1~D6 lock (모두 권고대로 lock)

§13 lock 정합:

- D1 distractor: 기출 원문 5지선다 + adminUI 검수 (BATCH 1-2주)
- D2 SRS + 약점: FSRS-4 + subject+concept (α=0.6 β=0.4)
- D3 보기 셔플: hash(userId||questionId||YYYYMMDD) 일자별 결정성
- D4 progressive disclosure: 정답 즉시 + 출처 토글
- D5 게이미피케이션: 표준 (streak + 마스터 + 일일)
- D6 모바일 gesture: 큰 버튼 default + optional swipe toggle

### D. Step 3-UX-2 packages/learning-modes 신설 (commit 66f98cd, 17 files, +1039 lines)

Engine-First 정합. 학습 모드 코어 로직 격리.

- `types.ts` — INPUT_TYPES (4) + LEARNING_MODES (5) + SESSION_PHASES + FSRS_RATINGS as const
- `normalize.ts` — `normalizeAnswer()` (Pass 1 CRIT-1 회귀 정합)
- `shuffle.ts` — `dailySeed()` (SHA-256 Web Crypto) + `createPrng()` (Mulberry32) + `shuffleChoices()` (Fisher-Yates)
  - D3 lock 정합: hash(userId||questionId||YYYYMMDD) 일자별 결정성
  - device sync 보장 + cross-user 격리 + 다음날 새 셔플
- `input-types/multiple-choice.ts` — `gradeMultipleChoice()` + `multipleChoiceAnswerToIndex()`
  - 셔플 라벨 → originalIndex 역추적 → answer 매칭
- `input-types/fill-blank.ts` — normalize 후 string 매칭
- `input-types/essay.ts` — self-grade ('correct'/'partial'/'incorrect')
- `input-types/calc.ts` — numeric parse + tolerance 허용

Golden test **68 PASS** (normalize 8 + shuffle 22 + multiple-choice 14 + fill-blank 8 + essay 4 + calc 12).

### E. Step 3-UX-3 packages/srs 신설 (commit 3ea4533, 10 files, +747 lines)

FSRS-4 + weak_score (D2 lock 정합).

- 의존: ts-fsrs v5.3.3 (zero 의존, Workers 호환)
- `types.ts` — FsrsCardState (D1 JSON 직렬화) + WEAK_SCORE_WEIGHTS (α=0.6 β=0.4) + MASTERED_THRESHOLD_DAYS (30)
- `fsrs.ts` — `createFreshCard()` (cold start) + `scheduleReview()` (결정성) + `replayReviews()` (cold start replay)
  - Rating 매핑: FsrsRating ('again'/'hard'/'good'/'easy') ↔ ts-fsrs Grade enum
  - State 매핑: ts-fsrs State enum ↔ FsrsCardState string ('new'/'learning'/'review'/'relearning')
  - JSON round-trip 검증
- `weak-score.ts` — `computeWeakScore()` + `normalizeStability()` + `byWeakScoreDesc()` + clamp 방어

Golden test **35 PASS** (fsrs 17 + weak-score 18).

알려진 사항:

- packages/srs/tsconfig.json은 rootDir 제외 — cross-package type import (learning-modes FsrsRating) 정합
- learning-modes는 cross-package import 0건이라 rootDir 유지

---

## 다음 세션(070) 할 일 (우선순위)

### 1. ★★ Step 3-UX-4 — 마이그레이션 0032~0035 plan + production apply chain

plan §8 정합 — 4 마이그레이션 신설 plan 영속 + 진산 승인 + production apply (Session 069 deploy pattern 재사용):

| 마이그레이션 | 변경                                                        |
| ------------ | ----------------------------------------------------------- |
| 0032         | exam_questions + input_type/distractors/calc_variables 컬럼 |
| 0033         | user_progress + fsrs_state/mastered_at/weak_score 컬럼      |
| 0034         | study_reviews 신규 테이블 (review 이력)                     |
| 0035         | study_sessions + streak_records 신규 테이블                 |

L3 영역 — plan 영속 + 진산 승인 후 production apply chain. ~2-4시간 작업.

### 2. ★★ Step 3-UX-5 — apps/api study routes 통합

learning-modes + srs import + 4 input type 분기. baseline은 fsrs 적용 안 하고 (Step 3-UX-4 마이그레이션 후), 셔플과 normalize만 적용:

- `/api/study/next` inputType 분기 + choices 셔플 (객관식)
- `/api/study/grade` 4 type 채점 + (Step 3-UX-4 후) FSRS state 업데이트 + streak 갱신
- `/api/study/mode` 4 mode (Step 3-UX-4 후 weak 모드 본격)
- `/api/study/session/:id` 진척 추적

4-Pass 의무 (Session 068 9 에이전트 패턴).

### 3. ★★ Step 3-UX-6 — apps/web 신규 컴포넌트

- QuestionCard.tsx 분기 + 4 input type 컴포넌트
- ModeSelector + SessionStart + SessionSummary
- ProgressVisualization (streak / 일일 / 마스터)
- AESTHETIC.md 갱신 + 3안 디자인 제출
- 모바일 80% touch target 검증

### 4. Step 3-UX-7 — distractor BATCH 보강 (★ 진산 + admin 1-2주)

기출 원문 5지선다 추출 + adminUI 검수. plan §13 D1 lock 정합.

### 5. Phase 3 launch 후속 quarterly carry-over (handoff-078 §1 정합)

- ADR-037 verify gate (`checkAdrTemporaryPolicyExpiry()`)
- FakeDb → in-memory SQLite 전환
- MAJ-5 hashIp 중복 호출 통합
- users.lastLoginAt 폐기 마이그레이션 0036 (★ 0032~0035 chain 후 번호 갱신)
- admin login_history 조회 API
- 5-페르소나 P-α/β/γ/δ/ε MINOR 16 dedupe 매트릭스

### 6. C-10 TD-VRF-001 비결정성 100회 누적 동정 (메타 안정성)

### 7. handoff-080 영속 (Session 070 종착 시점)

---

## 게이트 상태 (Session 069 종착)

- apps/api typecheck/lint/tests: PASS (Stage E baseline + Session 069 retrofit 영속 무회귀)
- apps/api tests: **502 PASS / 2 skip** (Session 068 Stage E baseline 유지)
- packages/shared tests: **64 PASS**
- **packages/learning-modes tests: 68 PASS** (★ Session 069 신규)
- **packages/srs tests: 35 PASS** (★ Session 069 신규)
- verify-engine-contracts: **7 PASS / 0 FAIL / 1 SKIP** (Cat 8 SKIP carry-over)
- Hard Rule 17 위반: 0건
- production D1: 31 마이그레이션 적용 완료 (0001 ~ 0031)
- production Worker: Version 02267900-7171-4526-a73e-b6f42ce48737 (Phase 3 chain Stage A~E 5 commit 활성)
- production login_history: 1 row (smoke test, audit trail 작동 확인)

---

## 주의사항

### ★★★★ Cloudflare wrangler 토큰 (Session 067 baseline 유효)

- Session 069 적극 사용: production migration apply + secret list + deploy + D1 query 4종
- Session 070 production action 시 진산 토큰 재확인 발화는 불요 (memory `feedback_full_autonomy.md` 정합)

### ★★★ Phase 3 학습 UX core 패키지 2종 ready (Session 069 신규)

Session 070+ 진입 시 즉시 사용 가능:

- `@thepick/learning-modes` — 답안 채점 4 type + 보기 셔플 + normalize
- `@thepick/srs` — FSRS-4 + weak_score (subject + concept)
- 본 패키지들은 Workers 호환 (Web Crypto + ts-fsrs zero 의존)
- 단독 vitest 103 tests PASS (Session 069 baseline)
- apps/api 통합은 Step 3-UX-5에서 (마이그레이션 0032~0035 후)

### ★★★ memory feedback_test_env_password_dont_nag (Session 069 신규)

평가 환경 비밀번호 채팅 평문 노출에 대해 권고 재언급 금지. ADR-034 §"복원 의무" §7로 자동 처리. Session 070+ Claude 재발 X 의무.

### ★★ Production URL 베이스라인

- apps/web: `https://thepick-study.pages.dev/` (불변)
- apps/api: `https://thepick-api-production.metavision9988.workers.dev` Version 02267900 (Session 069 갱신)
- production D1: 0001 ~ 0031 31개 마이그레이션 적용 완료

### ★★ Step 3-UX-4 진입 시 L3 영역 의무

마이그레이션 0032~0035는 L3 영역 (DB 스키마 변경 + user_progress 사용자 데이터 처리). plan 영속 + 진산 명시 승인 + production apply chain 의무. Session 069 deploy pattern (a5a8dac) 재사용.

### ★ TD-VRF-001 비결정성 baseline (안정)

- Session 067~069 안정 PASS (재현 안 됨)
- 본 session verify 2회 PASS (7/0/1) 안정
- C-10 별도 task 100회 누적 동정 carry-over

### ★ handoff-079 1순위 읽기

- `.jjokjipge/handoff-session-079.md` (본 핸드오프)

### ★ memory 우선 참조

- `project_ux_north_star_phase3.md` — ★ Step 3-UX 본격 진입 정합
- `project_source_citation_requirement.md` — 출처 1급 (학습 UX 유지)
- `feedback_test_env_password_dont_nag.md` — Session 069 신규
- `feedback_full_autonomy.md` — 결정 영역 6 카테고리
- `project_launch_legal_bundle_deferred.md` — Phase 3 launch 1주 묶음
- `project_custom_domain_thepick_app_collision.md` — ADR-036 trigger carry-over

---

## 차세션 1차 읽기 의무 문서 (우선순위 순)

1. **`.jjokjipge/handoff-session-079.md`** ★ 본 핸드오프 (1순위)
2. **`docs/plans/phase3-learning-ux-modes.plan.md`** ★★ §13 lock 결정 + Step 3-UX-4~7 진입 가이드
3. **`packages/learning-modes/src/index.ts`** Step 3-UX-5 통합 시 export 참조
4. **`packages/srs/src/index.ts`** Step 3-UX-5 통합 시 export 참조
5. **`.jjokjipge/handoff-session-078.md`** Session 069 1차 종착 (deploy chain Step 1-5)
6. **`.jjokjipge/wbs-quality-progress.md`** Phase 2/2.5/3 chain 본격 sync (Session 069 갱신)
7. **`docs/adr/ADR-037-temporary-policy-governance.md`** + `ADR-034/035/036` retrofit
8. **`.claude/reports/production-migration-status.md`** 0030/0031 적용 detail
9. **`apps/api/src/study/routes.ts`** Step 3-UX-5 통합 대상 (normalize 분리 + 4 type 분기)
10. **`apps/web/src/components/QuestionCard.tsx`** Step 3-UX-6 분기 대상
11. **memory `project_ux_north_star_phase3.md`** UX 북극성
12. **`.claude/rules/auto-review-protocol.md`** (★★★ 4-Pass + Phase 단위 5-페르소나 의무)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 069 본격 종착 (8 commits 누적, Phase 3 launch deploy chain 5/5 + WBS reconstruction + UX plan 696 lines + Step 3-UX-2/3 패키지 2종 + 103 tests 신규)
**다음 세션**: Session 070 — Step 3-UX-4 마이그레이션 plan 또는 Step 3-UX-5 routes 통합 또는 별도 priority 결정
**작성 효력**: 2026-05-12 KST (Phase 3 학습 UX 본격 코어 진입 + core 패키지 2종 영속 종착)
**예상 완료 다음 세션**: handoff-session-080 (Step 3-UX-4 마이그레이션 plan + production apply 또는 Step 3-UX-5 routes 통합 초안)

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
