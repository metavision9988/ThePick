# Session 065 종착 핸드오프 — ThePick (쪽집게)

> **본 세션(065) 종착**: Phase 2 Eval MVP Step 5 (production deploy) + Step 5-C G9 진산님 학습 시도 PASS + ADR-034/035/036 silent drift 3건 흡수 + 옵션 3 (1차 default + 2차 self-grade carry-over) + UX 북극성 memory 영속.
> **다음 세션(066) 진입 시 본 파일을 가장 먼저 읽고 4-Pass 종합 + 5-페르소나 phase 단위 기술부채 리뷰 진입.**
> **본 핸드오프 번호 = 074** (handoff-073 직계 후속, Session 065 종착)

---

## 브랜치 & 컨텍스트

- 브랜치: main
- Session 065 entry HEAD: f98532d (handoff-073 Step 4 commit)
- Session 065 종착 commit (예상): handoff-074 영속 후 push
- ★ 본 세션 진척 = phase2-eval-mvp.plan Step 5 (production deploy + G9 PASS) + 옵션 3 자동 채택 + ADR-034/035/036 silent drift carry-over chain 영속

---

## 본 세션(065) 한 일

### A. ★ entry verify 영속 2회 (TD-VRF-001 정합)

- run1 PASS 7/0/1 (2026-05-10 KST)
- run2 PASS 7/0/1 (2026-05-10 KST)
- run1 ≡ run2 numerics MATCH

### B. ★★ Step 5-A — Cloudflare Pages 신규 + 우여곡절

| 단계     | 사건                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1차 시도 | cfut_F1iU... 토큰에 Pages 권한 없음 → wrangler pages deploy 차단                                                       |
| 2차 시도 | 진산 dashboard "Connect GitHub" → 실제로는 Workers 프로젝트 thepick-web 생성 (Cloudflare UI 신규 Pages Git deprecated) |
| 3차 시도 | 진산 새 토큰 `cfut_LD3p...` 발급 (Pages:Edit + Memberships:Read 포함) → Claude wrangler API 진입                       |
| 발견     | thepick-web.pages.dev = 다른 사용자 점유 (외부 충돌)                                                                   |
| 결과     | Workers thepick-web 삭제 + Pages thepick-study 신규 생성 + apps/web/dist deploy ✓                                      |
| CORS     | CORS_ALLOWED_ORIGINS에 `https://thepick-study.pages.dev` 추가 + apps/api production redeploy                           |

### C. ★★ Step 5-B — apps/api production deploy

- staging Version 82b11658 → /api/study/next 401 PASS
- production Version ab9f5533 → 401 PASS
- 이후 ADR-034/035/036 흡수 chain으로 추가 redeploy: 870d87d2 → c1524d07 → 9640ceb5 → b221cd18 → b1941b5f → **cf498ca0** (현 production)

### D. ★★★ Step 5-C G9 진산님 학습 시도 — **PASS**

진산 발화 (2026-05-11 KST):

> "2019년 제5회 제16문 ... 여기까지 정답확인안하고 막 풀어 봣는데.. 순차적으로 나오네"

- 1차 525건 자동 채점 흐름 정상 (옵션 3 채택 후)
- correctCount ASC + 미시도 우선 가중치 정합
- 순차 surface (eq.id ASC tiebreak)
- 진산 noise 4 type (A/B/C/D) 식별 — 직접 검증 carry-over (현재 PASS, 세부 noise 별도 발화 시 carry-over plan)

### E. ★★★ M6 즉시 흡수 — apps/web 임시 인증 페이지

- AuthForm.tsx (login + register toggle, credentials='include', ?next redirect)
- /auth/login.astro (BaseLayout + AuthForm island)
- QuestionCard.tsx 401 → /auth/login?next= redirect (next + grade 양쪽)
- root index.astro 진입점 surface ('학습 시작하기' + '로그인 / 회원가입' 버튼)
- BaseLayout meta `mobile-web-app-capable` 추가 (deprecated apple-\* 보존)

### F. ★★★ Silent Drift 3건 — ADR-034/035/036 동기 carry-over chain

진산 G9 진입 차단을 1건씩 진단 → 모두 Phase 3 launch 직전 복원 의무 영속.

| ADR     | 진단                                                                      | 임시 조치                                                        | Phase 3 복원                                                                    |
| ------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **034** | 회원가입 422 — Zod min(8) + HIBP 'pwned'                                  | PASSWORD_MIN_LENGTH 4 + HIBP 분기 주석 disable                   | 8 복원 + HIBP 분기 활성화 + 2 test unskip                                       |
| **035** | 회원가입 500 — Workers Web Crypto PBKDF2 max 100k vs ADR-005 600k         | PBKDF2_ITERATIONS 100000 + 마이그레이션 0028 trigger ≥ 100k      | Argon2id WASM 검토 + brute-force cost 재산정 + 기존 user re-hash                |
| **036** | login 후 /study 401 redirect — cookie SameSite='Strict' cross-origin 차단 | authCookieSameSite(env) 신규 — production='None', dev/test='Lax' | custom domain (study.thepick.app + api.thepick.app) eTLD+1 동일 → 'Strict' 복원 |

각 ADR `복원 의무` 체크리스트 명시. memory `project_launch_legal_bundle_deferred.md` chain 동기.

### G. ★★ 옵션 3 — 1차 default 즉시 + 2차 self-grade carry-over

진단:

- 본 plan §3 가정 ("2차 변별력") vs production 실측 (1차 525 filled / 2차 9 null) mismatch
- 진산 결정 영역 (컨텐츠 평가) → 진산 옵션 3 선택

변경:

- apps/api/src/study/routes.ts examType default '2nd' → **'1st'**
- apps/web/src/pages/study.astro 헤더 '2차 학습' → '1차 학습' + QuestionCard examType="1st"
- routes.test.ts 4 test에 `?examType=2nd` 명시 (filter 검증 의도 보존)
- plan §3 학습 영역 + §8.3 갱신
- docs/plans/phase2-2nd-self-grade.plan.md (NEW) — 2차 9건 carry-over

### H. ★ memory 영속 — UX 북극성 Phase 3

진산 명시 발화 (Session 065 종착):

> "학습 자료의 신뢰성이나 정확성이 담보가 된다면.. 이 프로젝트의 성공요인은 사용자가 얼마나 효과적으로 학습을 하게 하거나 몰입/재미/효율 등등을 위한 사용자 인터페이스나 경험을 잘 기획, 설계 디자인 해야 하는 것이지"

- memory `project_ux_north_star_phase3.md` (NEW) — 2차 축 영속
- Phase 3 본격 진입 영역: 객관식 라디오 / 주관식 분류 / 학습 모드 / 보기 랜덤 / 몰입·재미·효율
- 본 메모리는 vision 영속, 별도 plan은 Phase 3 직전 신규 (`docs/plans/phase3-learning-ux-modes.plan.md`)
- memory `feedback_full_autonomy.md` 결정 영역 boundary 6 카테고리 영속 추가

### I. memory `feedback_full_autonomy.md` 갱신 — 결정 영역 boundary

진산 결정 영역 6 카테고리 명시:

1. 인증 정책 / 2. 프로젝트 목표 변경 / 3. 품질 변화 / 4. 컨텐츠 평가 / 5. 디자인 설정 / 6. 세션 교체

Claude 자동 영역 = 그 외 모든 기술 세부 (라이브러리/빌드/배포/CORS/스키마/테스트 케이스/handoff/plan/ADR 파일명).

---

## ★★★ 본 세션 결정 영속

| 트리거               | 진산 발화                                          | 결과                                                  |
| -------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Session 065 진입     | (entry verify 후 자동 Step 5 진입)                 | memory `feedback_full_autonomy.md` 정합               |
| Pages 옵션 비교      | "권고대로 진행"                                    | B (Git 연결) → 실패 후 D (Claude wrangler 자동)       |
| 토큰 권한 부족       | "claude-code-thepick" 새 토큰 발급 + 채팅 발화     | cfut_LD3p... 토큰 자동 진행                           |
| 비밀번호 422         | "테스트 중이라 비밀번호는 4자리 숫자도 가능하게"   | ADR-034 PASSWORD_MIN 4 + HIBP disable                 |
| 1차 vs 2차 학습 영역 | "옵션 3 (장기적 권고): 두 옵션 결합"               | 1차 default 즉시 + 2차 self-grade plan 신규           |
| G9 결과              | "2019년 제5회 제16문... 순차적으로 나오네... pass" | Step 5-C G9 PASS, Step 6 진입                         |
| 세션 교체 의문       | "세션을 바꿔야 하나?"                              | Claude 권고: fresh session (4-Pass + 5-페르소나 의무) |

---

## 수정된 파일 (origin/main = 본 commit)

### 신규

- `.jjokjipge/handoff-session-074.md` (본 핸드오프)
- `apps/web/src/components/AuthForm.tsx`
- `apps/web/src/pages/auth/login.astro`
- `docs/deploy/cloudflare-pages-setup.md`
- `docs/adr/ADR-034-test-password-policy-relaxation.md`
- `docs/adr/ADR-035-pbkdf2-iterations-workers-compat.md`
- `docs/adr/ADR-036-auth-cookie-samesite-cross-origin.md`
- `docs/plans/phase2-2nd-self-grade.plan.md`
- `migrations/0028_pbkdf2_iterations_workers_compat.sql`
- `.claude/reports/sprint1-step5-5-verify-session-065-entry-run{1,2}.json`
- (memory) `project_custom_domain_thepick_app_collision.md`
- (memory) `project_ux_north_star_phase3.md`

### 변경

- `apps/api/src/index.ts` (CORS_ALLOWED_ORIGINS thepick-study.pages.dev 추가)
- `apps/api/src/auth/constants.ts` (PASSWORD_MIN_LENGTH 4 + PBKDF2_ITERATIONS 100000)
- `apps/api/src/auth/routes.ts` (HIBP 분기 주석 + authCookieSameSite 신규)
- `apps/api/src/auth/__tests__/dummy-verify.test.ts` (PBKDF2 >= 100000)
- `apps/api/src/auth/__tests__/password.test.ts` (it.skip ADR-034)
- `apps/api/src/__tests__/scenarios.test.ts` (S5 it.skip + SameSite=Lax)
- `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` (0028 마이그레이션 추가)
- `apps/api/src/study/routes.ts` (examType default '1st')
- `apps/api/src/study/__tests__/routes.test.ts` (4 test examType=2nd 명시)
- `apps/web/src/pages/index.astro` (진입점 surface)
- `apps/web/src/layouts/BaseLayout.astro` (mobile-web-app-capable meta)
- `apps/web/src/pages/study.astro` (1차 학습 헤더 + QuestionCard examType="1st")
- `apps/web/src/components/QuestionCard.tsx` (401 → /auth/login redirect)
- `docs/plans/phase2-eval-mvp.plan.md` (§3 학습 영역 + §6.4/§6.5/§8.3 갱신)
- (memory) `feedback_full_autonomy.md` (결정 영역 boundary 6 카테고리 추가)
- (memory) `MEMORY.md` (2 entries 추가)

---

## 누적 통합 통계 (2026-05-11 Session 065 종착)

```
knowledge_nodes : 794   (변경 0)
knowledge_edges : 1274  (변경 0)
formulas        : 157   (변경 0)
constants       : 193   (변경 0)
revisions       : 39    (변경 0)
exam_questions  : 545   (변경 0)
  ├─ 1st (active, answer filled) : 525 ★ default 학습 영역
  └─ 2nd (active, answer null)   : 9 (self-grade carry-over)
topic_clusters  : 50    (변경 0)
table_*         : 433   (변경 0)
ontology_registry version : 1.5.0 (불변)
migration count : 27 → 28 (★ 0028_pbkdf2_iterations_workers_compat 추가)

★ status_transitions active approved : 488 (불변, BATCH-1+2~5)

★ Vectorize indexes : 1024d cosine, vectorCount=1277 (불변)

★ Workers deploy (본 세션 진척):
- thepick-api-staging : Version 82b11658
- thepick-api-production : Version cf498ca0 (★ 6회 redeploy chain — Step 5 + ADR-034/035/036 + 옵션 3)

★ Cloudflare Pages (★ 본 세션 신규):
- thepick-study.pages.dev (Direct upload 패턴, Git 연결 0)
- 17 files / production deployment 4회 (Step 5 + M6 + root surface + 옵션 3)

★ /api/study public route:
- GET /api/study/next?examId=...&examType=1st&count=1 (★ default 1st 갱신)
- POST /api/study/grade (L3, ADR-034 HIBP disable)
- POST /api/auth/register (PASSWORD_MIN 4, ADR-034)
- POST /api/auth/login (cookie SameSite=None production, ADR-036)
- POST /api/auth/logout

apps/api tests : 467 → 490 → 488 PASS + 2 skipped (★ ADR-034 carry-over: PASSWORD_PWNED 회귀 + password.test 'short' reject)
apps/web build : 3 pages 성공 (index.html + auth/login + study/index.html)

★ Hard Rule 17 grep 0건 in 변경 파일 ✓
★ 상용 품질 0 위반 (any 0 / console.log 디버깅 0 / TODO 0 / 빈catch 0 / import * 0) ✓
   (console.error 는 fetch 실패 sentinel 의도)
```

---

## ★★★ 다음 할 일 (차세션 066+)

### 1. ★ entry verify 영속 2회 (의무)

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > /home/soo/ClaudePro/ThePick/.claude/reports/sprint1-step5-5-verify-session-066-entry-run1.json
```

### 2. ★★★ **Phase 2 Eval MVP 종착 4-Pass 종합** — Session 065 누적 변경 ~7 commits 일괄 (auto-review-protocol.md 정합)

- 변경 파일 범위: §"수정된 파일" 신규 12 + 변경 16
- 4 에이전트 병렬 (silent-failure-hunter / backend-architect / security-engineer / code-reviewer 또는 general-purpose × 4)
- 통합 보고서: `.claude/reviews/review-YYYYMMDD-HHMMSS-phase2-eval-mvp-session-065-final-4pass.md`
- ★ CRIT 0 / MAJOR carry-over 명시 의무

### 3. ★★★ **Phase 2 Eval MVP 종착 5-페르소나 기술부채 심층 리뷰** — Phase 종착 시점 (auto-review-protocol.md `Phase 단위 5-페르소나` 정합)

- refactoring-expert / performance-engineer / quality-engineer / backend-architect / devops-architect 5 병렬
- 4-Pass 결과 전달 → 중복 지적 금지
- ADR-034/035/036 carry-over chain 검증 + Phase 3 복원 deadline 점검

### 4. ★★ 진산 noise 4 type 식별 carry-over

진산 G9 시도 후 noise 식별 (가능 시 발화 받기):

- type-A: BATCH-2~5 misclassified 1차 노드
- type-B: relatedNodes question 무관 (1차 환경)
- type-C: TBL-_ / TROW-_ 렌더 부재 (Step 3 미구현, plan §8.7)
- type-D: 정답 normalize false negative

발화 시 별도 plan carry-over:

- type-A → admin 재검수 워크플로우 (plan §8.5)
- type-B → relatedNodes quality 점검 별도 plan
- type-C → TBL-\* markdown 렌더 (plan §8.7) 우선순위 상향
- type-D → normalize 강화 patch

### 5. ★★ Phase 3 launch 직전 복원 chain (3 ADR 동기)

memory `project_launch_legal_bundle_deferred.md` chain 동기:

- ADR-034 §"복원 의무" 6항목
- ADR-035 §"검토 의무" 6항목 (Argon2id WASM)
- ADR-036 §"복원 의무" 5항목 (custom domain + SameSite Strict)
- 본 chain은 Phase 3 launch 1주 스프린트로 묶음

### 6. ★ 학습 UX 본격 plan (Phase 3 시점, memory `project_ux_north_star_phase3.md`)

- `docs/plans/phase3-learning-ux-modes.plan.md` 신규 (Phase 3 직전)
- 객관식 라디오 / 주관식 분류 / 학습 모드 다양화 / 보기 랜덤 / 게이미피케이션

### 7. ★ 2차 self-grade plan 구현

- `docs/plans/phase2-2nd-self-grade.plan.md` (Session 065 carry-over)
- 모범답안 surface + ✅/⚠️/❌ self-grade
- 진산 발화 또는 1차 525건 충분 후 진입

### 8. ★ MAJOR / MINOR carry-over (handoff-073 §F.4/§F.5)

- M2: /next LEFT JOIN tiebreak (WHERE up.node_id IS NULL)
- M3+M5: user_progress UNIQUE 제약 → 마이그레이션 0029
- M4: /next N+1 enrichment → Promise.all
- M8: Ctrl+N macOS Cmd+N 차단
- M9: 오프라인 graceful
- M10: TBL-\* markdown 렌더 (plan §8.7)
- M12: G5 Playwright e2e (plan §8.8)
- - MINOR 12

### 9. handoff-075 영속

---

## 주의사항

### ★★★ Cloudflare wrangler 토큰 (claude-code-thepick)

- 본 세션 사용 토큰: 이름 `claude-code-thepick` (cfut\_ prefix User API Token, 진산 dashboard 발급)
- 권한 정합: Pages:Edit + Workers Scripts:Edit + D1:Edit + Vectorize:Edit + Workers KV + User Details:Read + Memberships:Read + Access:Read
- 매 세션 인증 만료 시 진산님 명시 발화로 신규 토큰 받음 (memory `feedback_pat_plaintext_ok.md` Cloudflare 회피 의무)
- 본 핸드오프/repo에 토큰 평문 영속 금지 — husky pre-commit hook 자동 차단

### ★★★ 3 ADR carry-over chain (Phase 3 launch 직전 동시 처리)

- ADR-034 + ADR-035 + ADR-036 — 모두 평가 환경 한정 임시 정책. 외부 user 진입 전 모두 복원 의무.
- memory `project_launch_legal_bundle_deferred.md` chain 동기 — 법무 3종 + 회원탈퇴 + 이메일 인증 + 본 3 ADR + custom domain + UX 본격 진입 = 1주 스프린트 묶음

### ★★ exam_questions 분포 production 실측 (Session 065 D1 query)

```
exam_type=1st : 525 active, answer filled 525 (★ default 학습 영역)
exam_type=2nd : 9 active, answer null 9 (self-grade carry-over)
```

handoff-073에서 "2차 20건"으로 영속됐던 수치는 status 별 카운트 차이로 추정. production 실측 9건이 정확.

### ★ session-health 본 세션(065)

- /clear 후 새 세션 ID — START_TIMESTAMP_TURN_COUNT 추적 X
- 진산 발화로 추적: Session 065 시작 (entry verify) ~ 종착 (handoff-074 영속) — 시계상 약 16시간 (자정 넘어 2026-05-11 진입)
- ★ Session 시간 매우 길어 — fresh session (Session 066) 권고 (4-Pass + 5-페르소나 의무 cold start 정합)

### ★ TD-VRF-001 verify vitest 비결정성

- 본 세션 entry run1=PASS / run2=PASS (불변)

### ★ Hard Rule 17 — apps/web + apps/api 전수 검사

- apps/web/src + apps/api/src 전체에서 `'son-hae-pyeong-ga-sa'` literal 0건 (EXAM_IDS.SON_HAE_PYEONG_GA_SA 경유)
- .env.example URL 환경변수 (Hard Rule 17 적용 외)

---

## 차세션 1차 읽기 의무 문서 (우선순위 순)

1. **`.jjokjipge/handoff-session-074.md`** ★ 본 핸드오프 (1순위)
2. **`docs/plans/phase2-eval-mvp.plan.md`** §3 학습 영역 + §6.5 + §8.3 갱신
3. **`docs/adr/ADR-034-test-password-policy-relaxation.md`** + **ADR-035** + **ADR-036** (Phase 3 복원 의무)
4. **`docs/plans/phase2-2nd-self-grade.plan.md`** (2차 self-grade carry-over)
5. **`apps/api/src/auth/routes.ts`** (★★★ 다중 ADR 흡수 — 4-Pass Pass 1+2 대상)
6. **`apps/api/src/study/routes.ts`** (옵션 3 default '1st' + handoff-073 §F.4 M2-M4 carry-over)
7. **`apps/web/src/components/AuthForm.tsx`** (M6 즉시 흡수)
8. **`migrations/0028_pbkdf2_iterations_workers_compat.sql`** (★ trigger 100k 갱신)
9. **memory `project_ux_north_star_phase3.md`** (★★ Phase 3 본격 UX 방향)
10. **memory `feedback_full_autonomy.md`** 결정 영역 boundary 6 카테고리 (★ Claude 자동 영역 명확)
11. **`.claude/rules/auto-review-protocol.md`** (★★★ 4-Pass + Phase 단위 5-페르소나 의무)
12. **`docs/deploy/cloudflare-pages-setup.md`** (Pages 셋업 절차서)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 065 종착 (Phase 2 Eval MVP Step 5 + G9 PASS + ADR-034/035/036 + 옵션 3)
**다음 세션**: Session 066 — entry verify + ★★★ 4-Pass 종합 (Session 065 누적) + ★★★ Phase 단위 5-페르소나 기술부채 리뷰 → Step 6 (carry-over 우선순위 재산정)
**작성 효력**: 2026-05-11 KST (Session 065 종착, Phase 2 Eval MVP 평가 환경 PASS)
**예상 완료 다음 세션**: handoff-session-075 (4-Pass + 5-페르소나 + carry-over 영속)

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
