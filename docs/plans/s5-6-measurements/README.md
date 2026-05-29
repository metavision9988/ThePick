# S5-6b — golden pilot 측정 작업대

> 방법론 고정: `docs/plans/graph-walk-s5-6b-golden-generation.plan.md`
> 배경 차단: [[project_g_s5_golden_data_gap]] (production 기출 545 전부
> `related_nodes` NULL → golden 전무, 본 디렉토리가 최초 생성)

## 파일

| 파일                         | 역할                                                                                                                                        | 상태                             |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------- |
| `approved-nodes-corpus.json` | approved 노드 코퍼스 488 (id/type/name/page_ref/description). `approved-nodes-sql.ts` 단일 진실원 SQL 로 remote production 추출 (read-only) | 재사용 (30-50 확대 시도 시 동일) |
| `golden-pilot-draft.json`    | pilot 12 golden **draft** — content + expected + why + hopGuess + confidence + `proposedRelatedNodesRaw`(approved 변환용)                   | **draft (진산 미검수)**          |
| `golden-pilot-draft.md`      | 진산 검수 상신본 (문항별 APPROVE/FIX/REJECT 체크란)                                                                                         | 검수 대기                        |
| `golden-pilot-approved.json` | 검수 통과분만 harness `GoldenFile` 형식 동결                                                                                                | **검수 후 생성**                 |

## 도메인-한정 결정 (2026-05-16, 진산 결재)

코퍼스 488 노드 전수 대조 결과 = **농작물재해보험 손해평가 실무 단일 도메인**
(p.400~630). 상법 보험계약법·농학개론 재배학·재해법령 거버넌스 개념은
코퍼스에 0건. 플랜 §3 4-과목 표본설계가 데이터 현실과 충돌 →
진산 결재 **"손해평가 도메인 집중"** (Option A). pilot 12 =

- **2차 9 전량**: 이론 6(Q-2025-11-2ND-001~005,009) + 손해평가 3(012/014/015)
- **농어업재해보험법령 손해평가요령 실무 3**: Q-2019-05-031(제5회)·
  Q-2022-08-045(제8회)·Q-2023-09-045(제9회) — 시간 대표성

→ pilot 은 **방법론·신호 방향 검증용**(통계 일반화 아님). G-S5 결론은
손해평가 도메인 한정임을 리포트 워터마크에 영속 명시. 상법/농학 측정은
별도 코퍼스 확대(Hard Limit·별도 결재) 후에만 가능.

## 검수 → approved 변환 (mechanical)

진산이 `golden-pilot-draft.md` 검수 → `golden-pilot-draft.json` 의 각
`items[].jinsanReview.decision` 갱신(APPROVE/FIX/REJECT). 그 후:

- APPROVE/FIX(정정 반영) 분만 추출 → `golden-pilot-approved.json`:
  `{ examId, items:[{ questionId, content, relatedNodesRaw }], coverageNote }`
  - `relatedNodesRaw` = 승인 expected id 배열의 `JSON.stringify`
    (unmeasurable = `null` → harness `parseRelatedNodes` → ids[] →
    `unmeasurable` 분모 제외, 은폐 아님)
  - `coverageNote` = 도메인-한정 편향 + measurable/unmeasurable 카운트

> ⛔ **선결 차단선 (TR-0, 2026-05-29 추가)**: `golden-pilot-approved.json` 동결
> 자체는 D1 무변경(파일 영속만) 이므로 본 README 절차는 통과 가능. 그러나
> 향후 production `exam_questions.related_nodes` 컬럼에 라벨을 **backfill**
> (UPDATE) 하려면 `migrations/0004_temporal_guard_extension.sql:39-43` 의
> `prevent_exam_questions_update` 트리거가 ABORT. 정상 경로 plan =
> `docs/plans/tr-0-backend-c7-trigger-redesign.plan.md` (진산 결재 대기).
> production `related_nodes` 갱신은 TR-0 마이그 0038 적용 후에만 가능.
> 본 README 의 G-S5 측정은 파일 골든만 사용하므로 trigger 차단과 무관 — 측정
> 자체는 TR-0 와 독립 진행 가능 (단, 측정 결과의 production 영속화는 TR-0 의존).

## G-S5 pilot 측정 (검수·동결 후)

```
cd apps/api && pnpm wrangler dev --env production --remote --port 8787   # 백그라운드, production D1/Vectorize read-only
THEPICK_API_BASE=http://localhost:8787 \
  pnpm dlx tsx scripts/measure-s5-6-multihop-accuracy.ts \
  --golden docs/plans/s5-6-measurements/golden-pilot-approved.json
# → 산출 후 wrangler dev 세션 kill (쓰기 0 확인)
```

동시 in-scope: Pass2 m-2 (D-2 description projection 재측정 →
`graph-walk-s5-co1-co2-measurement.md` §3.1 각주).

## ★ N=12 통계 워터마크 (2026-05-29 진산 결재 — Q2 A안 영속)

5-페르소나 리뷰 quality-engineer §C-1 (`phase2-tech-debt-20260529-quality.md`)
이 "G-S5 golden N=12 = 통계 유의도 부재" 를 CRITICAL 로 적시. 진산 결재
= **A안 (pilot 12 측정 진행 + 워터마크 영속)** — 통합 인덱스 §5 Q2.

**모든 G-S5 pilot 측정 리포트는 다음 워터마크를 영속적으로 명시한다**:

> ⚠️ **본 측정은 방법론·신호 방향 검증용 pilot 이며 통계 일반화가 아니다.**
> N=12 (measurable 7 / unmeasurable 5) 는 통계 유의도를 산출하지 않는다.
> graphOnlyRecovery / regression / Δ 의 절대값 해석 금지. 본 측정은 (a)
> harness 정확성 (b) graph walk 신호의 방향성 (c) pilot 외 30~50 확대
> 가치 평가의 3가지에만 사용된다. 결론의 일반화는 N≥30 확대 + 진산
> 결재 후에만 가능. 추가 제한: 손해평가 실무 도메인 한정 (상법/농학/재해
> 법령 거버넌스 측정 0건).

본 워터마크는 `golden-pilot-approved.json:coverageNote` + 측정 리포트 본문
모두에 영속 포함. S5-7 §7 GO/NO-GO 판단도 본 워터마크 전제 위에서 진행
(signal-direction 만 사용, 절대값 비교 금지).

연계: phase2-tech-debt-20260529-INDEX.md §5 Q2 / §7 자기 검증 (C-1 강등
가능성 자가 반박 영속).
