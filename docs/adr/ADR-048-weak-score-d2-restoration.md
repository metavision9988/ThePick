# ADR-048: weak_score D2 정의 복원 — α축 subject 집계 즉시 + β축 2단계 (카드 stability 폴백 명시)

- **상태:** Accepted (2026-07-02 진산 결재 #10 — 카드 (a) "단계 집행" 권고대로)
- **결정일:** 2026-07-02 (결재 기록 커밋 3adb10a "결재 카드 전부 권고대로 진행")
- **결정자:** 진산 (결재 #10) + Claude (권고안 작성·집행)
- **관련 영역:** `apps/api/src/study/routes.ts` /grade weak_score 산출, `packages/srs` (D2 산식 엔진), weak mode ORDER BY 소비층, `/mode` weakTop · `/session/:id/complete` weakDelta 소비층
- **근거 카드:** `docs/plans/master-remediation-20260610/decision-card-10-weak-score.md` (실코드 대조 file:line 전수)

---

## 맥락 (Context) — Silent Pivot 경위

진산 D2 lock(★ FSRS-4 + **subject+concept** 약점 정의, `docs/plans/phase3-learning-ux-modes.plan.md` §13 D2 + §6.4/§13.1):

```
weakScore = α·(1 − subject_correct_rate) + β·(1 − concept_stability)   (α 0.6 / β 0.4)
```

카드 #10 실코드 대조(2026-06-12)가 확인한 Silent Pivot 실체:

> 산식 모양은 D2 그대로이나 **입력 2축이 전부 "문항 카드 1건"으로 축소**되어,
> weak_score = "과목+개념 횡단 약점"이 아니라 사실상 **"그 문항 1개를 못 푸는 정도"**
> (변수명만 subject/concept 잔존 — 주석 routes.ts "(D2 lock)"은 부정확).

- α축: D2 = **과목(subject) 단위** 사용자 정답률 ↔ 구현 = 해당 문항 카드 1건의 correct_count/total_reviews
- β축: D2 = **concept(지식 노드)** FSRS stability ↔ 구현 = 해당 문항 카드 자신의 FSRS stability
- 보조 사실(카드 인용): node 단위 user_progress 쓰기 경로는 존재하나 fsrs_stability 는 고정 시드만
  적재·재리뷰 UPDATE 는 total_reviews/correct_count 만 갱신(scheduleReview 미호출) =
  **node 단위 FSRS 누적 경로 자체가 미구현**.

CRITICAL RULE #1(기획과 다른 구현 = 보고 의무) 위반 상태였고, MASTER_PLAN §3 WS-5 5d + §6 결재 #10 이
"어느 쪽이든 해소 ADR 필수"(Binary Gate G-WS5 ④)로 못박음. 진산 2026-07-02 **(a) D2 정의 복원 —
단계 집행** 결재.

---

## 결정 (Decision) — 단계 집행

### 1. α축 (즉시, 본 ADR로 집행 완료)

`/grade` weak_score 산출의 α 입력을 **subject 단위 사용자 정답률**로 복원:

- `user_progress up ⋈ exam_questions eq ON eq.id = up.card_id` 집계 SQL —
  `WHERE up.user_id = ? AND up.card_type = 'exam' AND up.node_id IS NULL AND eq.subject = ?`
  로 해당 사용자·과목의 `SUM(total_reviews)` / `SUM(correct_count)`.
- 집계는 본 리뷰의 UPSERT **전** 스냅샷이므로 본 리뷰 1건(total +1, correct +isCorrect)을
  delta 가산해 post-review 과목 성적으로 산입 (결정적 — 기존 카드 단위 계산과 동일 시점 규약).
- **subject NULL/'' 문항**: 과목 축이 존재하지 않음 → 카드 단위 정답률 폴백 (기존 동작 보존,
  코드 주석 명시). NULL 을 하나의 "과목"으로 뭉치지 않는다 (의미 없는 횡단 방지).
- **집계 실패(D1 transient)**: 채점 가용성 우선 — 카드 단위 폴백으로 강등 + `logger.warn`
  (무음 아님; `study_reviews` INSERT 실패와 동일 계열 = 보조 신호 강등, core UPSERT 비차단).
- **status 무필터**: 문항이 후에 historical 이 되어도 사용자의 과목 성적 이력은 유효 — 집계에 포함.

### 2. β축 (2단계 이연 — 카드 stability 폴백 유지·명시)

D2 원정의 = concept(지식 노드) FSRS stability. 그러나 node 단위 FSRS 누적 경로가 **미구현**
(카드 인용: `progress/routes.ts` 고정 시드 0.3/1.0/1, 재리뷰 시 scheduleReview 미호출)이므로:

- β 입력은 당분간 **카드 자신의 FSRS stability 폴백 유지**. 폴백 사실을 코드 주석
  (`routes.ts` weak_score 블록) + `packages/srs/src/types.ts` WeakScoreInput doc 에 **명시**
  (정직 표기 — 폴백임을 숨기지 않는다).
- 2단계 진입 조건: node 단위 FSRS 누적 경로 구현(progress 재리뷰 시 scheduleReview 반영) +
  node row 적재량 실측([미조사] — 카드 #10) 후 **별도 결재**. 본 ADR 은 2단계를 lock 하지 않는다.

### 3. 부정확 주석 정정

`routes.ts` weak_score 블록의 "(D2 lock)" 단정 주석 제거 → α 복원 사실 + β 폴백 사실을
각각 명기한 블록 주석으로 교체 (본 ADR 참조 포인터 포함).

---

## 측정 게이트 (후속 계측 의무 — hot path 비용)

- /grade hot path 에 집계 쿼리 **+1** (카드 #10 비용 [추정] 항목). 완화 요인:
  - `/grade` 는 사용자당 20/min rate-limit (routes.ts) — 호출량 상한 존재.
  - 집계는 `idx_progress_user`(`migrations/0002:76`) 스캔 + `exam_questions` PK 조인 —
    사용자 보유 카드 수 O(n) (Year 1 기출 545 상한).
- **게이트**: Phase 3 launch 후 첫 계측 사이클에서 `/grade` p95 elapsed 에 본 쿼리 기여를
  telemetry 로 정량화(learning_slo 게이지 확장 또는 wrangler tail 표본) — p95 악화가 유의하면
  (a) 집계 결과 컬럼 영속(비정규화) (b) 요청 scope 캐시 중 택일 별도 결재. 계측 전 선최적화 금지.

---

## 영향 (Consequences)

### 집행 완료 (본 ADR)

- ☑ `apps/api/src/study/routes.ts` — α축 subject 집계 + NULL 폴백 + 실패 폴백 + 주석 정정
- ☑ `packages/srs/src/types.ts` — WeakScoreInput.conceptStability 폴백 허용 doc (산식 코드 무변경)
- ☑ 구현-정의 일치 테스트 (G-WS5 ④): subject 횡단 반영 / 타과목·타사용자 격리 /
  subject NULL 카드 폴백 / β 카드 stability 폴백 정합 / weak mode ORDER BY 소비층 회귀
  (`apps/api/src/study/__tests__/routes.test.ts`)

### 후속 (본 ADR 은 기록만 — lock 안 함)

- ☐ **기존 저장 weak_score 재계산 백필**: 원천(카드별 total_reviews/correct_count, FSRS state)
  영속 = 가역(카드 #10·MASTER_PLAN §3 5d). 신규 리뷰 시 자연 수렴하므로 긴급 아님.
  production 쓰기는 Hard Limit — 별도 결재·계획 후.
- ☐ β축 2단계: node 단위 FSRS 누적 경로 구현 + node row 적재량 실측 + 별도 결재.
- ☐ 측정 게이트 계측 (상단 §측정 게이트).
- ☐ D9 carry-over: α/β 가중치 정밀 조정 (plan §13.2 — 본 ADR 무관 유지).

### 소비층 영향

- weak mode `ORDER BY weak_score DESC`(routes.ts /next) · `/mode` weakTop · session summary
  weakDelta — 전부 **저장된 weak_score 소비**로 스키마·계약 무변경. 값의 의미만 D2 정합으로 복원.

---

## 관련 문서

- `docs/plans/master-remediation-20260610/decision-card-10-weak-score.md` (근거 카드 — 실코드 대조)
- `docs/plans/phase3-learning-ux-modes.plan.md` §6.4 + §13 D2 lock / §13.2 D9
- `docs/plans/master-remediation-20260610/MASTER_PLAN.md` §3 WS-5 5d + §6 결재 #10 + G-WS5 ④
- `packages/srs/src/weak-score.ts` (산식 엔진 — 본 ADR 로 무변경)
- `apps/api/src/study/routes.ts` (α축 집계 구현)
