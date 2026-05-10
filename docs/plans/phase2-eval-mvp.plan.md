# Phase 2 — Eval MVP plan (사용자 평가 환경 최소 구축)

> **본 plan = L3 영역** (`user_progress` 사용자 데이터 처리 + 신규 사용자 노출 라우트). CLAUDE.md L3 정합 — 진산님 승인 후 코딩.
> **목적**: 진산님이 직접 학습해보며 정확도/신뢰성을 체감 가능한 최소 환경 구축. handoff-071 §3 우선순위 1~3 (M2-1/M3-2/SP-T06)은 본 plan과 병행 또는 후속.
> **세션**: 063 (entry) ~ 065+ (4-Pass 흡수까지)
> **Reality Anchor 5문항 — §4 참조 (불가능 이유 3가지 우선 영속)**

---

## 1. 목적 + 진산님 발화 정합

- 발화: "엔진+자료적재 끝났는데 사용자 기능 시작할 때 아닌가? 내가 직접 학습해서 정확도/신뢰성 파악할 수 있어야"
- 채택: 평가용 MVP 직진 (옵션 A) — Session 062 답변
- memory `feedback_focus_reliability_not_schedule.md` 정합 — 신뢰성·정확성 집중. 일정 X.
- memory `project_source_citation_requirement.md` 정합 — 모든 결과에 교재 페이지/법조문/기출 근거 surface 필수
- memory `project_table_processing_core_capability.md` 정합 — TBL-\* 노드 결과 화면 표시 가능
- memory `feedback_single_vendor_cloudflare.md` 정합 — 추가 SaaS 도입 X (D1 + Vectorize + Workers + R2 만)

## 2. scope (in / out)

### In (본 plan 범위)

1. ★ BATCH-2~5 admin G5.5 SQL 부트스트랩 추가 (~500건 active approved)
2. ★★ POST `/api/study/grade` 채점 라우트 (L3, user_progress 갱신)
3. ★★ GET `/api/study/next` 학습 문제 추출 라우트 (단순 가중치 — FSRS 미적용)
4. ★★ apps/web `/study` 페이지 (Astro page + React Island QuestionCard)
5. 출처 surface contract (sourceCitations / relatedNodes 응답 필드)
6. 4-Pass 독립 리뷰 + 흡수
7. Production deploy + 진산님 1회 학습 시도 검증

### Out (본 plan 외 / 명시 carry-over)

- **FSRS 간격반복 알고리즘** — `apps/api/src/progress/routes.ts:63-75` "Phase 2 이월" 명시. 본 plan은 totalReviews/correctCount만 갱신. fsrsDifficulty/Stability/Interval/NextReview 컬럼 미수정.
- **혼동 유형 자동 감지** — Layer 4 Core 엔진 잔여, separate plan
- **Service Worker / 오프라인 큐 양방향 sync** — Phase 2 sync-engine, separate plan
- **mnemonic_cards 학습 surface** — separate plan
- **handoff-071 §3 우선순위 1 (M2-1 Promise.all 병렬화)** — 본 plan 진행 전 또는 병행 권고. 미수행 시 Stage 3 timeout 학습자 가시 영향 잔존.
- **handoff-071 §3 우선순위 2 (M3-2 messageKey 분기)** — BATCH-2~5 approved 전환 후 'out_of_scope' misrepresent 자연 해소되므로 본 plan 1단계로 부분 흡수. 'admin_review_pending' 분류는 별도 carry-over.
- **SP-T06/T07 spec plan 단위 work** — 본 plan과 별개 (handoff-071 §3 우선순위 3)

---

## 3. 채택안 (자동 결정 — memory `feedback_no_granular_decisions.md` 정합)

| 결정         | 채택안                                                                                                                     | 사유                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 채점 방식    | 텍스트 정규화 (공백/대소문자/조사) 후 exact match + 보기 번호 매칭                                                         | exam_questions.answer 가 "1" / "②" / "보험가액의 80%" 등 혼합 — 단계적 정규화 후 비교. memory `project_source_citation_requirement.md` 정합 (정답 100% 정확). |
| 문제 추출    | `correctCount` 적은 것 우선 + `status='active'` + 사용자 미시도 우선 (단순 가중치)                                         | FSRS Phase 2 이월. 본 plan은 학습 효과보단 검수 노이즈 surface 측정 목적이라 단순 가중치 충분.                                                                |
| 학습 영역    | 2차 시험 문제 (examType='2nd', exam_questions 20건) 우선                                                                   | 1차 525건은 객관식 5지선다 정답 명확, 2차 20건은 약술/계산형 — 정확도/신뢰성 평가에 2차가 더 변별력 있음                                                      |
| 출처 surface | `sourceCitations: { manualPages?, lawArticles?, examReferences? }` + `relatedNodes: { id, name, nodeType, manualPage? }[]` | memory `project_source_citation_requirement.md` 의무                                                                                                          |
| 표 노드 표시 | TBL-\* / TROW-\* 노드 markdown 테이블 렌더 (relatedNodes 일부)                                                             | memory `project_table_processing_core_capability.md` 정합                                                                                                     |
| 인증         | requireAuth 미들웨어 (progress 라우트와 동일)                                                                              | 기존 패턴 재사용                                                                                                                                              |
| 디자인       | A/B/C 3안 §5 영속 (1안 금지)                                                                                               | AESTHETIC.md `## 3-Variant 규칙` 의무                                                                                                                         |

---

## 4. ★★★ Reality Anchor 5문항 (CRITICAL RULE #6, "가능합니다" 환상 차단)

### Q1. 이것이 불가능할 이유 3가지

1. **BATCH-2~5 노드의 metadata 정확도 미검증** — Session 062 부트스트랩은 BATCH-1 74건만이고 진산님 직접 검수 0건. BATCH-2~5 SQL 일괄 approved 전환 시 misclassified 노드가 학습자에 noise로 surface됨. → **mitigation**: reviewer_id `'session-063-admin-bootstrap'` 표식 보존 (진산님 직접 재검수 시 식별 가능 + audit trail).
2. **2차 exam_questions 20건은 약술/계산형이라 텍스트 exact match 부적합** — "보험가액 산정 절차를 서술하시오" 같은 문제는 채점 자동화 불가. → **mitigation**: §6 채점 알고리즘에서 examType + content 패턴으로 단답형/객관식만 자동 채점, 약술형은 모범답안 surface + 사용자 self-grade 채택. 또는 Step 3 진입 시 단답형 가용 건수 재확인 후 1차 525건도 평가 대상으로 포함 결정.
3. **production Stage 3 timeout (handoff-071 §3 우선순위 1 M2-1)** — Stage 3 직렬 ~600ms timeout 가시. 학습자 검색 라우트가 timeout 노출 시 평가 환경 자체가 noise. → **mitigation**: 본 plan은 `/study` 라우트로 검색이 아닌 exam_questions 직접 표시 → Stage 3 미경유. 학습자가 '자유 검색' 시도 시 M2-1 carry-over 우선순위 1 잔존 영향.

### Q2. 진산님이 1회 학습 시도 시 가시 noise 종류

- **type-A**: BATCH-2~5 misclassified 노드 (예: 적과전 영역에 적과후 노드 섞임)
- **type-B**: relatedNodes가 question 정답과 무관 (relatedNodes 컬럼 quality 검증 미수행)
- **type-C**: TBL-\* 노드 markdown 렌더 깨짐 (TBL-012 별표 2 carry-over)
- **type-D**: 채점 false negative (정답 normalize 부족 — "②" vs "2" vs "2번")

→ **이 4가지 type 모두 진산님 평가의 핵심 신호**. plan 의도는 "noise 0" 이 아니라 "noise 식별 가능한 환경 구축". 4-Pass에서 모두 catch 가능한지가 본 plan 가치 판정.

### Q3. 이미 검증된 가정 / 검증 안 된 가정

- 검증: BATCH-1 74건 approved 후 Stage 1 query "적과후착과수 산정" → results=5 ✅ (Session 062)
- 검증: exam_questions 545건 적재 + status 컬럼 정상 (Layer 5 Session 044)
- 미검증: relatedNodes 컬럼 quality (자동 매핑 vs 수동 검수 비율)
- 미검증: 2차 20건의 단답/약술 비율
- 미검증: TBL-\* 노드의 markdown 렌더 가능성 (현재 raw cell 데이터만 적재됨)

### Q4. 진산님 발화에서 추론한 의도와 실제 의도 차이

- 추론: "사용자 기능" = 학습 페이지 = 검색 + 결과 표시 + 풀이
- 실제: "내가 테스트하면서 정확도/신뢰성 파악" — 검색은 부수, **정답이 있는 환경에서 ground truth 비교 가능한 문제 풀이**가 핵심
- 정합: 본 plan은 검색 X, exam_questions 직접 표시 + 채점 채택 (Q2의 4 type noise 식별에 정합)

### Q5. 1주 후 / 1개월 후 후회할 가능성

- 1주: 진산님이 약술형 문제만 surface 시 self-grade 부담 → 1차 525건 단답형/객관식 자동 채점 우선 권장 (자동 결정 §3 갱신 후보)
- 1개월: BATCH-2~5 approved 일괄 전환 후 진산님 직접 재검수 진입 시 reviewer_id 식별 패턴이 audit trail로 작동하는가 — Session 062 패턴 재사용 의무

---

## 5. 디자인 A/B/C 3안 (AESTHETIC.md `## 3-Variant 규칙` 의무)

> Indigo 600 (주) + Amber 500 (강조 한 곳) + Gray 9단계 + 1280px max-width + rx=8|12 + near-white 배경 + Pretendard. 안티패턴 0 정합 검증.

### A — 교과서 (Linear-style 단정)

- 좌측 narrow sidebar (180px) — 학습 영역 / 진도 / 통계
- 메인: 1단 카드 (max-width 720px) + 큰 여백
- 문제 카드: 헤더 (회차/번호/과목) + 본문 (24px Pretendard) + 보기 (1~5)
- 정답 입력: textarea or radio (단답형/객관식 분기)
- 채점 후: 같은 카드 하단에 정답/해설/근거 surface (페이지 전환 X, 인-place expand)

### B — 밀도 (정보 30% 더 촘촘)

- A의 sidebar 220px — 진도 통계 (correctCount/totalReviews/마지막 시도 confusionType)
- 메인: 2단 (좌 문제 / 우 채점 결과 동시 surface, 채점 전엔 placeholder)
- 출처 패널: 우측 sticky — 교재 페이지 / 법조문 / relatedNodes 항상 가시
- 단축키: Ctrl+Enter = 채점, Ctrl+N = 다음 문제 (Linear-style 단축키 본능)

### C — 급진 (관습 1개 의도적으로 깸)

- sidebar 없음. 페이지 전체 = 1 카드 (max-width 720px center)
- 문제만 surface, 출처/relatedNodes/통계 모두 hidden by default → 진산님이 명시 클릭 시만 확장
- 채점 결과 화면 = 정답만 1줄, 해설은 "더보기" 토글 — 평가 환경의 신호 측정 noise 최소화 (진산님이 본인 답이 맞았는지만 빠르게 체감)
- 관습 깸 포인트: "학습 화면 = 정보 풍부" 통념 → "평가 환경 = 신호 압축"

**plan 채택**: A 기본 + B의 단축키 (Ctrl+Enter 채점) — Step 3 진입 시 진산님 최종 결정. 1안 단독 금지.

---

## 6. 알고리즘 명세

### 6.1 BATCH-2~5 admin G5.5 SQL 부트스트랩 (Step 1)

```sql
-- scripts/admin-bootstrap-batch2-5-approved.sql
INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at)
SELECT
  'st-s063-' || kn.id, 'node', kn.id, 'draft', 'approved',
  'session-063-admin-bootstrap',
  'BATCH-2~5 부트스트랩 (phase2-eval-mvp.plan §6.1, 진산님 직접 재검수 표식 보존)',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM knowledge_nodes kn
WHERE kn.batch_id IN ('BATCH-2','BATCH-3','BATCH-4','BATCH-5')
  AND kn.is_current_active = 1
  AND NOT EXISTS (SELECT 1 FROM status_transitions st WHERE st.target_type='node' AND st.target_id=kn.id);
```

- idempotent (deterministic id `st-s063-` + NOT EXISTS) — Session 062 패턴 재사용
- 기대 결과: ~500건 추가 (production knowledge_nodes BATCH-2~5 active 합)
- production 적용 후 검증 SQL: `SELECT COUNT(*) FROM status_transitions WHERE reviewer_id='session-063-admin-bootstrap'`

### 6.2 GET /api/study/next (Step 2-A)

```ts
// query: ?examType=2nd|1st&count=1
// 반환: { question: ExamQuestionWithSource } | { exhausted: true }

async function selectNextQuestion(
  examId: ExamId, // Hard Rule 16: 첫 번째 인자
  userId: string,
  examType: '1st' | '2nd' = '2nd',
  count = 1,
): Promise<ExamQuestionWithSource[]>;
```

- 가중치: `correctCount ASC NULLS FIRST` + `totalReviews ASC` (덜 시도/덜 맞춘 것 우선)
- WHERE: `eq.status='active' AND eq.exam_type=examType`
- LEFT JOIN user_progress: 미시도 (NULL) 우선
- 출처 enrichment: relatedNodes JSON parse → knowledge_nodes IN ... → manualPage / book_pages_id surface

### 6.3 POST /api/study/grade (Step 2-B, ★ L3 영역)

```ts
// body: { questionId: string, userAnswer: string, examId?: ExamId }
// 반환: { isCorrect, correctAnswer, explanation, sourceCitations, relatedNodes }

async function gradeQuestion(
  examId: ExamId, // Hard Rule 16
  userId: string,
  questionId: string,
  userAnswer: string,
): Promise<GradeResult>;

function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, '') // 공백/전각공백
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (m) => String('①②③④⑤⑥⑦⑧⑨⑩'.indexOf(m) + 1))
    .replace(/번$|호$/g, ''); // "1번"/"2호" → "1"/"2"
}

function isAnswerCorrect(question: ExamQuestion, userAnswer: string): boolean {
  if (!question.answer) return false;
  return normalizeAnswer(userAnswer) === normalizeAnswer(question.answer);
}
```

- user_progress UPSERT (FSRS 컬럼 미수정):
  ```ts
  // INSERT OR UPDATE — FSRS 컬럼은 default 유지 (Phase 2 이월)
  totalReviews += 1;
  correctCount += isCorrect ? 1 : 0;
  lastConfusionType = question.confusionType;
  updatedAt = now();
  ```
- 출처 surface:
  - `sourceCitations.examReferences`: question.year/round/questionNumber
  - `sourceCitations.manualPages`: relatedNodes 의 manualPage 합집합
  - `sourceCitations.lawArticles`: relatedNodes 중 LAW-\* 의 lawArticle
  - `relatedNodes`: relatedNodes JSON parse → knowledge_nodes IN ... 조회 결과 (id/name/nodeType/manualPage)
- Hard Rule 17 정합: `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유 (리터럴 0)

### 6.4 apps/web /study 페이지 (Step 3)

- 라우트: `apps/web/src/pages/study.astro`
- 인증 미들웨어: 미인증 → /auth/login redirect (Astro middleware 또는 client-side check)
- React Island: `QuestionCard.tsx`
  - state: `{ phase: 'loading' | 'answering' | 'graded', question, userAnswer, gradeResult }`
  - on mount: GET /api/study/next?examType=2nd → state.question
  - on submit: POST /api/study/grade → state.gradeResult, phase='graded'
  - on '다음 문제': GET /api/study/next 재요청 + state reset
- markdown 렌더: question.content / explanation / relatedNodes 의 TBL-\* nodeData
  - 의존성: marked 또는 micromark (Cloudflare 단일 벤더 정합 검증 필요 — Workers compatible)
- 디자인: A 기본 + B 단축키 (Ctrl+Enter)

---

## 7. 게이트 (binary, mechanically verifiable)

| Gate | 명세                                                                                                                                     | 검증                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| G1   | BATCH-2~5 SQL bootstrap 적용 → status_transitions reviewer_id='session-063-admin-bootstrap' 행 수 ≥ 400                                  | `SELECT COUNT(*)` production D1                                                                            |
| G2   | production e2e: BATCH-2 영역 query (예: "적과후착과수 산정") → /api/search results.length ≥ 3                                            | curl + jq                                                                                                  |
| G3   | POST /api/study/grade 단위 테스트 ≥ 8건 PASS (정답/오답/normalize/normalize miss/L3/Hard Rule 16/17/출처)                                | vitest                                                                                                     |
| G4   | GET /api/study/next 단위 테스트 ≥ 4건 PASS (가중치/미시도 우선/exam_type 필터/exhausted)                                                 | vitest                                                                                                     |
| G5   | apps/web /study e2e (Playwright) ≥ 1건 — 진입 → 채점 → 결과 표시                                                                         | playwright                                                                                                 |
| G6   | Hard Rule 17 grep 0 위반 (`'son-hae-pyeong-ga-sa'` 리터럴 in `apps/api/src/study` + `apps/web/src/pages/study.astro` + QuestionCard.tsx) | `rg "'son-hae-pyeong-ga-sa'" --glob '!**/exam-ids.ts'`                                                     |
| G7   | typecheck + lint exit 0                                                                                                                  | pnpm typecheck + pnpm lint                                                                                 |
| G8   | 4-Pass 독립 리뷰 CRITICAL 0                                                                                                              | Agent tool 4 에이전트 병렬 (silent-failure-hunter / backend-architect / security-engineer / code-reviewer) |
| G9   | 진산님 production browser 1회 학습 시도 정상 (loading → answering → graded → 다음)                                                       | 수동 검증, 진산님 발화                                                                                     |
| G10  | 출처 surface 검증 — gradeResult.sourceCitations 비어있지 않음 (relatedNodes ≥ 1 시)                                                      | unit test                                                                                                  |
| G11  | 상용 품질 0 위반 (any 0 / console.log 디버깅 0 / TODO 0 / 빈catch 0 / import \* 0)                                                       | quality-gate.sh hook                                                                                       |
| G12  | post-absorb verify 7/0/1 PASS                                                                                                            | scripts/verify-engine-contracts.ts                                                                         |

---

## 8. carry-over (다음 plan / phase)

### 8.1 FSRS 알고리즘 (Phase 2 잔여, separate plan)

- `docs/plans/phase2-fsrs.plan.md` 신규
- fsrsDifficulty/Stability/Interval/NextReview 컬럼 활성화
- 본 plan의 user_progress 갱신 로직 확장

### 8.2 자유 검색 학습 모드 (handoff-071 §3 우선순위 1 후)

- M2-1 Promise.all 병렬화 흡수 후 /search 라우트 학습자 노출 안전
- 본 plan은 exam_questions 직접 표시만, 자유 검색 X

### 8.3 약술형 self-grade UI (Q2 type-D 정합)

- 2차 약술형 문제 채점 자동화 불가
- self-grade UX (모범답안 surface + 사용자 ✅/⚠️/❌ 자체 평가) 별도 plan

### 8.4 mnemonic_cards 학습 surface

- mnemonic_cards 테이블 활용 별도 plan
- 두문자어 역방향 검증 carry-over

### 8.5 진산님 직접 재검수 워크플로우 (Admin G5.5 본격)

- POST /api/admin/transitions 라우트 신규
- ContentQueue.tsx fetch 연결
- session-063-admin-bootstrap 표식 보존 → 진산님 명시 검수 시 reviewer_id 'jinsan-admin-NNN' 으로 갱신

### 8.6 상태 표현 (Loading / Empty / Error / Offline)

- 본 plan §6.4는 phase 분기만 명시. 상세 UI 상태 매트릭스는 4-Pass Pass 3 ADVOCATE 검증 영역.

---

## 9. 출처 / 정합 표기

- L3 영역 근거: CLAUDE.md `## L3 영역` "user_progress" 명시
- 디자인 3안 의무: ~/.claude/AESTHETIC.md `## 3-Variant 규칙`
- 출처 surface 의무: memory `project_source_citation_requirement.md`
- 표 처리 의무: memory `project_table_processing_core_capability.md`
- Cloudflare 단일 벤더: memory `feedback_single_vendor_cloudflare.md`
- Hard Rule 16/17: `.claude/rules/production-quality.md` `## 멀티시험 격리 Hard Rules (15~17)`
- Reality Anchor 5문항: CLAUDE.md `★★★ CRITICAL RULES` #6
- 4-Pass 의무: `.claude/rules/auto-review-protocol.md`
- handoff carry-over: handoff-session-071 §3 우선순위 1 (M2-1) / 우선순위 2 (M3-2 부분 흡수) / 우선순위 3 (SP-T06 spec)

---

**plan 작성**: Claude (Opus 4.7 1M context) — Session 063 entry
**작성 효력**: 2026-05-10 KST
**진산님 결정 대기**: 본 plan §3 채택안 + §5 디자인 3안 + §7 게이트 12개 + §8 carry-over 6건 — 승인 후 Step 1 진입
**예상 완료**: handoff-session-074 또는 075 (Step 1+2+3+4+5 통합)
