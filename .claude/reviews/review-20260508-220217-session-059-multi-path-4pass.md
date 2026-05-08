# 4-Pass 독립 리뷰 통합 보고서 — Session 059 Multi-Path Fallback 흡수

> **본 리뷰**: Multi-Path Fallback (Rule 18 / ADR-015, D-MPF-1~4=A) 구현에 대한 4-Pass 독립 에이전트 검증 + CRITICAL 5 + MAJOR 핵심 7건 흡수.
> **세션**: 059 (handoff-067 §3 우선순위 2 처리)
> **타임스탬프**: 2026-05-08 22:02 KST

## 리뷰 범위

신규:

- `apps/api/src/search/multi-path-fallback/{keyword-fallback,topic-cluster-router,honest-refusal,index}.ts`
- `apps/api/src/search/multi-path-fallback/__tests__/{...}.test.ts` × 4
- `migrations/0027_review_queue.sql` (staging+production 양쪽 적용)

수정:

- `apps/api/src/search/user-search.ts` (embedQuery export + precomputedEmbedding)
- `apps/api/src/search/routes.ts` (graceful=true 시 fallback + queryDigest Hono cache)
- `apps/api/src/search/__tests__/routes.test.ts` (e2e Multi-Path Fallback)

연관: `docs/plans/phase2a-multi-path-fallback.plan.md`, `docs/architecture/SEARCH_PIPELINE.md`, `docs/adr/ADR-015-multi-path-fallback-pipeline.md`, `apps/api/src/vectorize/upserter.ts`, `migrations/0002_1st_exam_extension.sql`

## 4-Pass 결과 요약

| Pass        | 에이전트                                  | 판정               | CRITICAL | MAJOR | MINOR |
| ----------- | ----------------------------------------- | ------------------ | -------- | ----- | ----- |
| 1 SURGEON   | `pr-review-toolkit:silent-failure-hunter` | 수정 필요          | 3        | 5     | 4     |
| 2 ARCHITECT | `system-architect`                        | 수정 필요          | 1        | 3     | 2     |
| 3 ADVOCATE  | `security-engineer`                       | 수정 필요 (조건부) | 1        | 4     | 3     |
| 4 CONTRACT  | `pr-review-toolkit:code-reviewer`         | 수정 필요          | 0        | 3     | 2     |

**누적**: CRITICAL 5건 / MAJOR 15건 / MINOR 11건 (중복 제거 후 핵심 ~22건)

## CRITICAL 5건 즉시 흡수 (Session 059 본 commit)

### CRIT-1 — review_queue INSERT 실패 시 wide-blast 500 (graceful 본질 위배)

- **출처**: Pass 1 SURGEON CRIT-1
- **위험**: D1 INSERT throw → routes.ts catch → 학습자 500. ADR-015 Hard Rule 21 honest_refusal UX 약속 깨짐.
- **흡수**: `multi-path-fallback/index.ts:88-96` — `recordHonestRefusal` try/catch 추가 + best-effort. INSERT 실패해도 `buildHonestRefusalResponse` 정상 반환.
- **테스트**: `multi-path-fallback/__tests__/index.test.ts` "Pass 1 CRIT-1: review_queue INSERT 실패해도 honest-refusal 응답 정상" PASS.

### CRIT-2 — keyword fetchTokenMatches 1 토큰 throw → 전체 cascade

- **출처**: Pass 1 SURGEON CRIT-2
- **위험**: 5 토큰 query 에서 1 토큰 D1 transient → 전체 fallback throw → 4 토큰 정상 결과 손실.
- **흡수**: `keyword-fallback.ts:103-122` — `Promise.all + per-token try/catch` 격리 + 모든 토큰 throw 시에만 명시 throw (조용한 0건 금지). Pass 1 MAJ-2 (병렬화) 동시 흡수.
- **테스트**: "Pass 1 CRIT-2: 일부 토큰 throw 시 정상 토큰 결과 보존" + "모든 토큰 throw → 전체 실패 throw" 2건 PASS.

### CRIT-3 — topic-cluster Vectorize.query 주석↔구현 모순 (graceful 약속 위배)

- **출처**: Pass 1 SURGEON CRIT-3
- **위험**: 주석 "graceful 정합 위해 Stage 4 진입 (throw 안 함)" vs 실제 throw → routes.ts 500.
- **흡수**: `topic-cluster-router.ts:107-118` — Vectorize.query throw → empty result + 주석 정정. caller logger surface는 carry-over.
- **테스트**: "Pass 1 CRIT-3: Vectorize.query throw → graceful Miss" PASS.

### CRITICAL-1 (Pass 2) — Vectorize filter `type` 키 schema 위반 (영구 0건 사망 위험)

- **출처**: Pass 2 ARCHITECT CRITICAL-1
- **위험**: `filter: {type: 'topic_cluster'}` — `upserter.ts VectorizeUpsertMetadata` 인터페이스에 `type` 키 부재. metadata-index 7종에도 `type` 미등록 (handoff-065/066 정합). production Vectorize 적재 후에도 영구 0건 → Stage 3 dead path.
- **흡수**: `topic-cluster-router.ts:113` — `filter: {node_type: 'topic_cluster', exam_id: examId}` 정정. `node_type` 키는 upserter 정합 + `exam_id` 추가 (Hard Rule 16 zero-cost — Pass 2 MAJ-1 동시 흡수).
- **테스트**: "Pass 2 CRITICAL-1: Vectorize.query filter 키 = node_type (not type) + exam_id" PASS.

### C1 (Pass 3) — honestRefusal 학습자 안내 contract 부재

- **출처**: Pass 3 ADVOCATE C1
- **위험**: response 에 message/messageKey 부재 → client 가 honestRefusal=true 만 보고 안내문 분기 → server/client contract drift.
- **흡수**: `honest-refusal.ts` — `HONEST_REFUSAL_MESSAGE_KEY = 'fallback.honest_refusal.out_of_scope' as const` 신규 + `HonestRefusalResponse.messageKey` 필드 추가. server/client i18n contract 안정화.
- **테스트**: "Pass 3 C1: messageKey i18n contract 포함" PASS.

## MAJOR 핵심 흡수 (Session 059 본 commit)

| 항목                                                  | 출처      | 위치                              | 흡수                                             |
| ----------------------------------------------------- | --------- | --------------------------------- | ------------------------------------------------ |
| Pass 1 MAJ-1 + Pass 3 M3 한국어 어미·특수문자         | Pass 1, 3 | keyword-fallback.ts tokenizeQuery | `\p{P}\p{S}` Unicode + 조사 정규식 추가          |
| Pass 1 MAJ-2 토큰 병렬화                              | Pass 1    | keyword-fallback.ts:103-122       | Promise.all 동시화 (CRIT-2 흡수와 묶음)          |
| Pass 1 MAJ-3 + Pass 2 MAJ-1 fetchClustersByIds examId | Pass 1, 2 | topic-cluster-router.ts:181       | `(db, examId, ids)` 시그니처 변경                |
| Pass 1 MAJ-4 lv1/lv2 정밀도                           | Pass 1    | topic-cluster-router.ts:201       | `fetchNodesByCluster` cluster.lv1/lv2 분리       |
| Pass 4 MAJ-B queryDigest Hono cache                   | Pass 4    | routes.ts:101                     | outer scope 1회 계산, fallback/catch 양쪽 재사용 |
| Pass 4 MAJ-A Silent Pivot 정정                        | Pass 4    | plan §3.1                         | Vectorize 의존 정합 영속 + carry-over 명시       |
| Pass 2 MAJ-2 SQL carry-over 주석                      | Pass 2    | topic-cluster-router.ts           | Year 2 valid_from + exam_id 영속 명시            |

## Carry-over (별도 step / plan §10 영속)

본 step 미흡수 11건 plan §10 영속 — 요약:

- Pass 1 MAJ-5 Stage 2/3/4 timeout 통합 (ADR-019 Concurrent step 동시)
- Pass 2 MAJ-3 Concurrent race-compatible 분리
- Pass 3 M1 review_queue dedup (UNIQUE 제약, admin G5.5 step 전 의무)
- Pass 3 M2 fallback cost-aware rate-limit
- Pass 3 M4 / Pass 4 MAJ-A topic_clusters Vectorize 적재 step (별도 admin upsert/batch)
- Pass 4 MAJ-C SP-T06/T07 fixture 측정 step
- MINOR 11건 (LIKE wildcard escape, reviewQueueId 통보, i18n key, ...)

## 회귀 검증

- apps/api 테스트: 410 → 439 → **447 PASS (+37 누계)**
- typecheck PASS, lint PASS
- verify-engine-contracts.ts 7/0/1 (불변)
- Hard Rule 17 grep 0건 in `apps/api/src/search/multi-path-fallback/`
- 상용 품질 0 위반 (any/console.log/TODO/빈catch/import \*)

## 판정: **완료 가능**

- CRITICAL 5건 100% 흡수 + 회귀 테스트 추가
- MAJOR 7건 흡수 + 8건 carry-over 명시
- MINOR 11건 carry-over
- ADR-015 Hard Rule 21 (honest_refusal + 검수 큐) 본질 보존
- Cloudflare 단일 벤더 정합 + Hard Rule 16 zero-cost

**다음 step 권고 (handoff-068)**:

1. topic_clusters Vectorize 적재 step (admin upsert endpoint or batch)
2. SP-T06/T07 fixture 측정 + 정확도 검증
3. Concurrent Execution (Rule 23 / ADR-019) + Stage 2/3/4 race-compatible 분리
4. apps/web honest_refusal i18n key 등록 + UI 안내 분기

---

**보고서 작성**: Claude (Opus 4.7 1M context)
**리뷰 방식**: 4 독립 에이전트 병렬
**프로토콜 정합**: `.claude/rules/auto-review-protocol.md` 규칙 0~4 준수
**파일**: `.claude/reviews/review-20260508-220217-session-059-multi-path-4pass.md`
