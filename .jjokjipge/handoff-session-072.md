# Session 063 종착 핸드오프 — ThePick (쪽집게, 손해평가사 자격시험 AI 학습 서비스)

> **본 세션(063) 종착**: 진산님 마일스톤 zoom-out 요청 + 현물 기반 종합 진척 파악 + Phase 2 Eval MVP plan 영속 + 진산님 승인. 코딩 미진입 (다음 세션 Step 1).
> **다음 세션(064) 진입 시 본 파일을 가장 먼저 읽고 Step 1 (BATCH-2~5 SQL 부트스트랩) 진입.**
> **본 핸드오프 번호 = 072** (handoff-071 직계 후속, Session 063 종착)

---

## 브랜치 & 컨텍스트

- 브랜치: main
- Session 063 entry HEAD: 94ecf17 (handoff-071 영속) → 본 세션 종착 commit (handoff-072 영속 후)
- ★ 본 세션 진척 = **방향 전환** (handoff-071 §3 우선순위 1~3 → Phase 2 사용자 노출 진입 평가 MVP 우선)

---

## 본 세션(063) 한 일

### A. ★★★ 진산님 마일스톤 zoom-out 요청 + 현물 기반 종합 진척 보고

- 진산님 발화: "엔진+자료적재 끝났는데 사용자 기능 시작할 때 아닌가? 내가 직접 학습해서 정확도/신뢰성 파악할 수 있어야"
- 추정 금지 — Explore 서브에이전트로 코드베이스 실제 상태 종합 점검
- **결과 (현물 기반)**:
  - ✅ 엔진 5종 실구현 + 234 tests PASS (formula-engine 16 / parser 8 / parser-1st-exam / quality 6 / ai-adapter)
  - ✅ DB 적재 완료 (knowledge*nodes 794 / edges 1274 / formulas 157 / constants 193 / questions 545 / clusters 50 / table*\* 433 / Layer 1~6 BATCH 모두 적재)
  - ❌ admin 검수 (status='approved'): BATCH-1 74건만 — 720+ still draft
  - ❌ 학습 페이지: `apps/web/src/pages/index.astro` 1개만 (홈), 학습 라우트 0개
  - ❌ 채점 라우트: 미구현 (`/api/progress/review`는 진도만, 정답 채점 X)
  - ❌ FSRS 간격반복: `apps/api/src/progress/routes.ts:63-75` "Phase 2 이월" 명시
  - ❌ Admin 검수 API: `POST /api/admin/transitions` 미구현 (ContentQueue UI는 있으나 fetch 연결 0줄)
  - ❌ Service Worker: 디렉토리 없음
- **위치 재정의**: Phase 1 후반 (적재 완료) / **Phase 2 미진입** — 사용자 노출 표면 0%
- 진산님 인식 ("엔진+자료 → 사용자 기능") = **반쯤 일치**. 적재량은 끝났으나 검수+UI+채점은 시작 0.

### B. ★ 진산님 결정 — 평가용 MVP 직진 (옵션 A)

- 갈림길 3안 제시 (memory `feedback_no_granular_decisions.md` 정합):
  - A: 평가용 MVP 직진 (BATCH-2~5 부트스트랩 + 학습 페이지 1 + 채점 라우트 1)
  - B: 정상 품질 우선 (handoff-071 §3 우선순위 M2-1/M3-2/SP-T06 먼저)
  - C: Admin 검수 UI 먼저 (BATCH-2~5 정상 검수)
- 진산 채택: **A (평가용 MVP 직진)**

### C. ★★★ Phase 2 Eval MVP plan 영속 (L3 영역)

- 파일: `docs/plans/phase2-eval-mvp.plan.md` (NEW, §1~§9)
- L3 정합: `user_progress` 사용자 데이터 처리 → CLAUDE.md L3 plan 의무
- **§1**: 목적 + memory 정합 (출처 / 표 / Cloudflare 단일 벤더)
- **§2**: scope (in 7건 / out 6건 carry-over)
- **§3**: 채택안 (자동 결정) — 채점 normalize, 문제 추출 가중치, 학습 영역 2차 우선, 출처 surface, 표 노드 surface, requireAuth, 디자인 3안
- **§4**: ★★★ Reality Anchor 5문항 — 불가능 이유 3가지 + Q2 noise type 4종 + Q3 검증 vs 미검증 + Q4 의도 차이 + Q5 1주/1개월 후회
- **§5**: 디자인 A/B/C 3안 (AESTHETIC.md `## 3-Variant 규칙` 의무)
- **§6**: 알고리즘 명세 (BATCH-2~5 SQL / GET /api/study/next / POST /api/study/grade / /study 페이지)
- **§7**: 게이트 12개 (binary, mechanically verifiable)
- **§8**: carry-over 6건 (FSRS / 자유 검색 / self-grade / mnemonic / Admin 본격 / UI 상태)
- **§9**: 출처/정합 표기

### D. ★ 진산님 승인 — 다음 세션 Step 1 진입 (옵션 A)

- AskUserQuestion: "Plan 승인 + 다음 세션에 Step 1 진입" 채택
- 다음 세션 Step 1 = BATCH-2~5 SQL 부트스트랩 (~500건 active approved)

### E. ★ entry verify 영속 2회 (TD-VRF-001 정합)

- run1 PASS 7/0/1 (2026-05-10 02:46 UTC = 11:46 KST)
- run2 PASS 7/0/1 (2026-05-10 02:50 UTC = 11:50 KST)
- run1 ≡ run2 일치 — numerics 합계 3194 동일
- 모노레포 합계: 1406 tests PASS (Session 062 1406 → 변경 없음)

### F. ★ 시스템 셧다운 복구 정상 종착 (Session 062)

- handoff-071 영속 + commit `94ecf17` + push 완료 (origin/main 일치)
- 본 세션 진입 시점 워킹 트리 clean

---

## ★★★ 본 세션 결정 영속

| 트리거                                      | 진산 발화/영속                                       | 결과                                                          |
| ------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| Session 063 entry (시스템 셧다운 후 재시작) | "현황 파악 후 정상 종착"                             | handoff-071 영속 + commit 94ecf17 + push                      |
| 마일스톤 zoom-out                           | "사용자 기능 시작할 때 아닌가? 내가 테스트하며 평가" | 현물 기반 종합 진척 보고 → Phase 1 후반 / Phase 2 미진입 진단 |
| 다음 마일스톤 결정                          | "평가용 MVP 직진"                                    | 옵션 A 채택 → phase2-eval-mvp plan 영속                       |
| Plan 승인                                   | "승인 + 다음 세션에 Step 1 진입"                     | Step 1 (BATCH-2~5 SQL 부트스트랩) 다음 세션 진입              |
| 본 세션 종착 범위                           | "Plan 영속까지 (승인 근거 확보)"                     | entry verify 2회 + plan + handoff-072 + commit + push 종착    |

---

## 수정된 파일 (origin/main = 본 commit)

### 신규

- `.jjokjipge/handoff-session-072.md` (본 핸드오프)
- `docs/plans/phase2-eval-mvp.plan.md` (★★★ Phase 2 사용자 노출 진입 평가 MVP plan, L3 영역, §1~§9)
- `.claude/reports/sprint1-step5-5-verify-session-063-entry-run1.json`
- `.claude/reports/sprint1-step5-5-verify-session-063-entry-run2.json`

### 변경

- (없음 — 본 세션은 plan 영속 + verify 만 진행, 코드 무수정)

---

## 누적 통합 통계 (production D1 + Vectorize, 2026-05-10 Session 063 종착)

```
knowledge_nodes : 794   (변경 0)
knowledge_edges : 1274  (변경 0)
formulas        : 157   (변경 0)
constants       : 193   (변경 0)
revisions       : 39    (변경 0)
exam_questions  : 545   (변경 0)
topic_clusters  : 50    (변경 0)
table_*         : 433   (변경 0)
ontology_registry version : 1.5.0 (불변)
migration count : 26 (불변)

★ status_transitions:
- BATCH-1 status='approved' active 노드 : 74 (Session 062 부트스트랩 — 불변)
- BATCH-2~5 status='draft' : ~500 (★ 다음 세션 Step 1 대상)

★ Vectorize indexes (Cloudflare):
- thepick-embeddings-staging   : 1024d cosine, vectorCount=1277 (불변)
- thepick-embeddings           : 1024d cosine, vectorCount=1277 (불변)

apps/api tests : 467 PASS (불변)
모노레포 : 1406 PASS (불변, TD-VRF-001 batch 326/327 known 비결정성 본 세션 미발현)
verify total : 8 categories = 7/0/1 (불변, Cat 8 SKIP)

★ Hard Rule 17 grep 0건 ✓ (코드 무수정)
★ 상용 품질 0 위반 ✓ (코드 무수정)
```

---

## ★★★ 다음 할 일 (차세션 064+)

### 1. ★ entry verify 영속 2회 (의무)

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > /home/soo/ClaudePro/ThePick/.claude/reports/sprint1-step5-5-verify-session-064-entry-run1.json
# (run2 동일) → run1≡run2 PASS 7/0/1 일치 의무
```

### 2. ★★★ Phase 2 Eval MVP — Step 1 (★★★ 본 세션 진산님 승인 완료)

#### Step 1: BATCH-2~5 admin G5.5 SQL 부트스트랩

- 파일: `scripts/admin-bootstrap-batch2-5-approved.sql` (NEW)
- 알고리즘: `docs/plans/phase2-eval-mvp.plan.md` §6.1
- reviewer_id: `'session-064-admin-bootstrap'` (또는 진산 명시 표식)
- production 적용 후 e2e 검증 (Stage 1 BATCH-2 영역 query → results ≥ 3)
- 게이트: G1 (status_transitions ≥ 400) + G2 (e2e Stage 1 results ≥ 3)

### 3. ★★★ Phase 2 Eval MVP — Step 2 (이어서 또는 별도 세션)

#### Step 2-A: GET /api/study/next 라우트

- `apps/api/src/study/routes.ts` (NEW)
- 알고리즘: plan §6.2 (가중치 `correctCount ASC` + 미시도 우선)
- Hard Rule 16: examId 첫 번째 인자
- 단위 테스트 ≥ 4건 (G4)

#### Step 2-B: POST /api/study/grade 라우트 (★★★ L3)

- 알고리즘: plan §6.3 (normalizeAnswer + isAnswerCorrect + user_progress UPSERT + 출처 surface)
- FSRS 컬럼 미수정 (Phase 2 carry-over)
- 단위 테스트 ≥ 8건 (G3) — 정답/오답/normalize/normalize miss/L3/Hard Rule 16/17/출처

### 4. ★★ Phase 2 Eval MVP — Step 3

#### Step 3: apps/web /study 페이지

- `apps/web/src/pages/study.astro` (NEW)
- React Island: `apps/web/src/components/QuestionCard.tsx` (NEW)
- 디자인: plan §5 A 기본 + B의 Ctrl+Enter 단축키 (진산님 최종 결정 시점)
- Playwright e2e ≥ 1건 (G5)

### 5. ★★★ Phase 2 Eval MVP — Step 4 (4-Pass 독립 리뷰)

- 4 에이전트 병렬 (silent-failure-hunter / backend-architect / security-engineer / code-reviewer)
- CRITICAL 0 (G8) → 즉시 흡수
- 통합 보고서: `.claude/reviews/review-{YYYYMMDD-HHMMSS}-phase2-eval-mvp-4pass.md`

### 6. ★★ Phase 2 Eval MVP — Step 5 (handoff-074 또는 075 종착)

- production deploy + 진산님 1회 학습 시도 검증 (G9)
- 4-Pass MAJOR carry-over 영속 + handoff 작성

### 7. ★★ 병행/후속 (handoff-071 §3 carry-over, Phase 2 Eval MVP와 무관 또는 부분 병행)

#### 우선순위 1 (★★★ production timeout 정합)

- ★★★ M2-1 Stage 3 Promise.all 병렬화 — production 1회 timeout 발생 정합. 학습자 자유 검색 라우트 안전성 확보용. **Phase 2 Eval MVP는 검색 미경유라 본 step과 무관, 자유 검색 진입 시 prerequisite**

#### 우선순위 2 (★★ messageKey 분기 부분 흡수)

- ★★★ M3-2 messageKey 분기 — BATCH-2~5 approved 전환 후 'out_of_scope' misrepresent 자연 부분 해소. 'admin_review_pending' 분류는 별도 carry-over

#### 우선순위 3 (★★ SP-T06/T07 spec plan + 측정)

- ★★ SP-T06 spec plan 단위 work — `docs/plans/sp-t06-accuracy-measurement.plan.md` 신규 (handoff-071 §3 우선순위 3)
- ★★ SP-T07 spec plan 단위 work — out-of-scope 100건

#### 우선순위 4 (4-Pass MAJOR carry-over)

- M2-2 ADR-004 V2 filter limitation 영속
- M1-3 STAGE3_NODE_ID_EXCLUDE_PREFIXES ↔ ontology-registry single source
- M3-1 prefix denylist → allowlist
- M3-3 a11y / apps/web stage3Diagnostics 미표시 contract

### 8. carry-over (진산 영역 / Phase 2 병행)

- ★★★ Admin 검수 UI 본격 (POST /api/admin/transitions + ContentQueue fetch 연결) — phase2-eval-mvp plan §8.5 carry-over
- ★★ FSRS 알고리즘 (Phase 2 잔여) — `docs/plans/phase2-fsrs.plan.md` carry-over
- ★ TBL-012 별표 2 PDF 정확 매트릭스 재작업
- ★ docs/observability/master-dashboard.md 본격 작성

---

## 주의사항

### ★★★ phase2-eval-mvp plan §4 Reality Anchor 4 type noise — 진산님 평가 신호

- type-A: BATCH-2~5 misclassified 노드 (mitigation: reviewer_id audit trail)
- type-B: relatedNodes quality 미검증
- type-C: TBL-\* markdown 렌더 깨짐 (TBL-012 별표 2 carry-over)
- type-D: 채점 normalize false negative
- **이 4 type 모두 진산님 평가의 핵심 신호. plan 의도는 "noise 0"이 아니라 "noise 식별 가능"**

### ★★★ Step 2-B (채점 라우트) = L3 영역 (user_progress)

- CLAUDE.md `## L3 영역` "user_progress" 명시
- plan + 진산님 승인 정합 — 본 세션 plan 영속 + 진산님 승인 완료 → 다음 세션 코딩 진입 가능

### ★ 학습 영역 = 2차 20건 우선 (plan §3 채택)

- 단, plan §4 Q5 "1주 후회 가능성" — 약술/계산형 self-grade 부담 시 1차 525건 단답/객관식 자동 채점 우선 권장 carry-over
- Step 2 진입 시 진산님 최종 결정 또는 §3 갱신 검토

### ★ 4-Pass Carry-over 영속 (Session 061 18건 + 본 세션 0건)

- Session 061 4-Pass: MAJOR 6 + MINOR 12 carry-over (불변)
- Session 062: 4-Pass 미실시 (admin G5.5 부트스트랩 + plan 영속만)
- Session 063: 4-Pass 미실시 (plan 영속 + verify만, 코드 무수정)

### ★ session-health 본 세션(063)

- 시작 ~11:32 KST 2026-05-10 → 종료 ~12:00+ KST → ~30분
- 임계 (90분/50턴) 미도달
- ★ 진산님 zoom-out 요청 → 현물 점검 → plan 영속 → 승인 → 종착 흐름

### ★ TD-VRF-001 verify vitest 비결정성

- 본 세션 entry run1=PASS / run2=PASS — 본 세션은 batch 326/327 비결정성 미발현
- known issue, Sprint 2 초기 흡수 의무 (WBS §5)

---

## 차세션 1차 읽기 의무 문서 (우선순위 순)

1. **`.jjokjipge/handoff-session-072.md`** ★ 본 핸드오프 (1순위)
2. **`docs/plans/phase2-eval-mvp.plan.md`** ★★★ Phase 2 Eval MVP plan (§1~§9, 진산님 승인 완료, 다음 세션 Step 1 진입)
3. **`scripts/admin-bootstrap-batch1-approved.sql`** Session 062 부트스트랩 패턴 — Step 1 SQL 작성 시 재사용
4. **`apps/api/src/db/schema.ts`** L309~331 (exam_questions) + L356~375 (user_progress) — Step 2 알고리즘 정합
5. **`apps/api/src/progress/routes.ts`** L63~75 FSRS Phase 2 이월 명시 + 본 plan 정합
6. **`apps/api/src/search/multi-path-fallback/topic-cluster-router.ts`** ★★★ M2-1 Promise.all 병렬화 (Phase 2 Eval MVP와 무관, carry-over)
7. **`.jjokjipge/handoff-session-071.md`** Session 062 종착 (본 핸드오프 직전 컨텍스트)
8. **`~/.claude/AESTHETIC.md`** ★ 디자인 3안 의무 (Step 3 진입 시)
9. **memory `project_source_citation_requirement.md`** (출처 surface 의무)
10. **memory `project_table_processing_core_capability.md`** (표 노드 처리 의무)
11. **memory `feedback_full_autonomy.md`** (자동화 가능 영역 즉시 실행)
12. **memory `feedback_focus_reliability_not_schedule.md`** (신뢰성·항상성 집중)
13. **`.claude/rules/auto-review-protocol.md`** (4-Pass + 5-페르소나)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 063 종착 (마일스톤 zoom-out + Phase 2 Eval MVP plan L3 영역 영속 + 진산님 승인)
**다음 세션**: Session 064 — entry verify + ★★★ Step 1 (BATCH-2~5 SQL 부트스트랩) → Step 2 (study/grade + study/next 라우트) → Step 3 (/study 페이지)
**작성 효력**: 2026-05-10 KST (Session 063 종착, **Phase 2 사용자 노출 진입 평가 MVP plan 영속 + 진산님 승인 완료**)
**예상 완료 다음 세션**: handoff-session-073 (Step 1+2 흡수) 또는 074 (Step 1+2+3+4 통합)

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
