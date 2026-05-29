# Session 091 종착 핸드오프 — ThePick (쪽집게)

> **본 핸드오프 = 091** (handoff-090 후속). **종착**: S5-6b pilot golden
> **draft 생성 완료** + 코퍼스 도메인-한정 2차 발견 → 진산 결재 "손해평가
> 도메인 집중". 다음 = **진산 인간검수**(golden-pilot-draft.md) → approved
> 동결 → G-S5 pilot 측정.

---

## 브랜치 & 컨텍스트

- 브랜치 `main`. 마지막 commit `1a3b19d`(S5-6b plan 고정, push 완료).
- **본 세션(091) 미커밋**: `docs/plans/s5-6-measurements/` 신규 4파일 +
  `CLAUDE.md`(현재상태 동기) + memory `project_g_s5_golden_data_gap`(진척).
- production **무변경** (read-only D1 SELECT 만, wrangler dev 미구동,
  rows_written=0). `exam_questions.related_nodes` write 0 (Hard Limit).
- 미추적 `docs/Graph_RAG+Graph_Walk/` 3건 = 세션 무관(손대지 말 것).

## 이번 세션(091)에서 한 일

1. **환경 확인**: S5-6b plan/CLAUDE.md/handoff = 이미 1a3b19d 커밋됨
   (handoff-090 step1 완료). wrangler 인증 `metavision9988@gmail.com`.
2. **approved 코퍼스 추출**: `approved-nodes-sql.ts`
   `APPROVED_NODES_STATUS_CORE` 단일 진실원 SQL → remote production
   read-only → `approved-nodes-corpus.json` **488** (FORMULA129/CONCEPT108/
   CROP85/INVESTIGATION80/TERM42/INSURANCE29/LAW15 — §2 grounding 일치).
3. **★ 2차 발견 (STOP & 보고)**: 488 전수 명칭/의미 대조 = **농작물재해
   보험 손해평가 실무 단일 도메인**(p.400~630). 상법 보험계약법·농학개론
   재배학·재해법령 거버넌스 개념 코퍼스 0건. S5-6b §3 4-과목 표본설계가
   데이터 현실과 충돌(Silent Pivot 금지 → 진산 보고). **진산 결재 =
   "손해평가 도메인 집중"**(Option A).
4. **pilot golden draft 생성**(순환차단 엄수 — vector/graph 호출 0):
   `golden-pilot-draft.{json,md}` 12문항.
   - 2차 9 전량(이론 6: Q-2025-11-2ND-001~005,009 / 손해평가 3: 012,014,015)
   - 재해법령 손해평가요령 실무 3: Q-2019-05-031(제5)·Q-2022-08-045(제8)·
     Q-2023-09-045(제9) — 시간 대표성
   - measurable 7 / unmeasurable 5 / multi 4 / single 3 / expected평균 1.57
5. **G-6b self-audit PASS**: G-6b-1 순환차단(vector/graph 0) / G-6b-2
   정밀라벨(평균1.57≤3, why=정답근거) / G-6b-3 대표성(도메인집중·multi 4≥4)
   / G-6b-4 draft 격리(status=draft·워터마크·D1 write 0). G-S5-pilot =
   검수 후(현 단계 정상 차단).
6. **영속**: README.md(도메인결정·변환절차·측정명령) + CLAUDE.md 현재상태
   동기 + memory 진척 갱신.

## 신규/수정 파일 (미커밋)

### 신규 `docs/plans/s5-6-measurements/`

- `approved-nodes-corpus.json` — approved 488 (재사용: 30-50 확대 시 동일)
- `golden-pilot-draft.json` — pilot 12 draft (content+expected+why+
  hopGuess+confidence+proposedRelatedNodesRaw+jinsanReview.decision=PENDING)
- `golden-pilot-draft.md` — **진산 검수 상신본** (문항별 APPROVE/FIX/REJECT)
- `README.md` — 도메인 결정·검수→approved 변환·G-S5 측정 명령

### 수정

- `CLAUDE.md` — 현재상태 S5-6b pilot draft 완료·도메인한정(동기 의무)
- (repo 외) memory `project_g_s5_golden_data_gap.md` 진척 append

## 다음 할 일 (우선순위)

1. **(먼저) 커밋 권장** — 진산 "커밋" 지시 시 1 commit: `docs/plans/
s5-6-measurements/` 4파일 + CLAUDE.md 동기 + handoff-091
   (`docs(eval): S5-6b pilot golden draft + 손해평가 도메인 결정`).
2. **진산 인간검수** (Hard Limit draft→approved, 자율 금지):
   진산이 `golden-pilot-draft.md` 문항별 APPROVE/FIX/REJECT →
   `golden-pilot-draft.json` `items[].jinsanReview.decision` 갱신.
   특히 unmeasurable 5건("코퍼스 정답근거 노드 없음" 주장) 타당성 +
   measurable 7건 expected 과대/과소/순환 여부 확인.
3. **approved 동결** (검수 후, mechanical): APPROVE/FIX분 →
   `golden-pilot-approved.json` `{examId,items:[{questionId,content,
relatedNodesRaw}],coverageNote}`. relatedNodesRaw = 승인 expected id
   `JSON.stringify`(unmeasurable=null). coverageNote=도메인한정 편향.
4. **G-S5 pilot 측정** (검수·동결 후): `cd apps/api && pnpm wrangler dev
--env production --remote --port 8787`(백그라운드) →
   `THEPICK_API_BASE=http://localhost:8787 pnpm dlx tsx
scripts/measure-s5-6-multihop-accuracy.ts --golden
docs/plans/s5-6-measurements/golden-pilot-approved.json` → 산출 후
   wrangler dev kill(쓰기 0 확인). 동시 Pass2 m-2(D-2 description
   projection 재측정 → graph-walk-s5-co1-co2-measurement.md §3.1 각주).
5. pilot 결과(graphOnlyRecovery/regression/Δ) → 30-50 확대 vs NO-GO
   (S5-7 결재자료 §7 GO/NO-GO) 판단.

## 주의사항

- **순환차단 영속**: golden expected 선정에 `/api/search`·graph-walk 호출
  절대 0 (S5-6b §0/G-6b-1). 본 draft 는 노드명·page_ref·문항요지 대조만.
- **Hard Limit**: AI golden = draft. 진산 검수 후에만 G-S5 입력. draft 로
  측정 = RULE #4/#5 위반. `assertRemoteMeasurementInputs` 가 approved 강제.
- **도메인 한정 = G-S5 결론 범위**: 손해평가 실무 한정. 상법/농학 측정은
  별도 코퍼스 확대(Hard Limit·별도 결재) 후. 리포트 워터마크 영속.
- pilot 12 = 통계 표본 아님 — 방법론·신호 방향 검증용. 일반화는 30-50
  검수 후.
- S5-7 A 통합 코드 착수 = §7 GO + 별도 결재 후 (자율 금지 영속).
- 코드 무변경 세션 → 4-Pass 코드 리뷰 비대상. 본 작업 검증 기제 =
  Binary Gate G-6b-1~4(self-audit PASS) + **진산 인간검수**(설계상 독립
  권위 = AI draft→human authority). 상세: README.md / S5-6b plan.

## TaskList (인계 — 비영속)

- 본 세션 #1~4 완료(코퍼스/표본/draft/artifact+gate). G-S5-pilot =
  진산 검수 게이트 대기. S5-6 #6 = 동일 게이트.

이 핸드오프 + 프로젝트 CLAUDE.md 확인 후, 진산 검수 결과를 받아 approved
동결 → G-S5 pilot 측정으로 이어가세요. (검수 전 측정 = Hard Limit 위반)
