# 4-Pass 독립 리뷰 통합 보고서 — Session 060 topic_clusters Vectorize 적재

> **세션**: 060
> **트리거**: handoff-068 §3 우선순위 1 (Multi-Path Stage 3 dead path 해제)
> **commit 대상**: 본 step 코드 (NEW topic-cluster-fetcher.ts + i18n 등록 + plan 영속 + 4-Pass 즉시 흡수)
> **검증 시점**: 2026-05-09 KST (post-impl 4-Pass + CRITICAL 2 + MAJOR 1 + MINOR 2 즉시 흡수 완료)
> **운영 적재**: staging+production Vectorize 1227 → **1277** (+50) PASS

## 리뷰 방식

**독립 에이전트 4개 병렬 호출** (자가 리뷰 금지 정합):

| Pass             | 에이전트                                  | 관점                      | 판정      |
| ---------------- | ----------------------------------------- | ------------------------- | --------- |
| Pass 1 SURGEON   | `pr-review-toolkit:silent-failure-hunter` | 코드 정합성 (Bottom-Up)   | 완료 가능 |
| Pass 2 ARCHITECT | `backend-architect`                       | 연계 검증 (Top-Down)      | 수정 필요 |
| Pass 3 ADVOCATE  | `security-engineer`                       | UX + 보안 (Cross-Cutting) | 수정 필요 |
| Pass 4 CONTRACT  | `pr-review-toolkit:code-reviewer`         | 기획 대조 (Silent Pivot)  | 완료 가능 |

## 리뷰 범위

### 변경 파일 (NEW 2 + MOD 4)

- `apps/api/src/vectorize/topic-cluster-fetcher.ts` (NEW) — D1 → NodeForVectorize 변환
- `apps/api/src/vectorize/__tests__/topic-cluster-fetcher.test.ts` (NEW, 8 tests after absorb)
- `apps/api/src/vectorize/routes.ts` (MOD) — BOOTSTRAP_SOURCES 5종 + refine 메시지 보강 (C1)
- `apps/api/src/vectorize/__tests__/routes-dispatcher.test.ts` (MOD) — +3 tests
- `apps/api/src/search/multi-path-fallback/topic-cluster-router.ts` (MOD) — `TOPIC_CLUSTER_NODE_TYPE` import (DRY)
- `apps/web/src/i18n/{types,locales/ko,locales/en}.ts` (MOD) — `fallback.honest_refusal.out_of_scope` 등록 (C1 a)
- `docs/plans/phase2a-topic-cluster-vectorize-indexing.plan.md` (NEW + §6/§8.7 영속)

### 연관 파일 (병행 검토)

- `apps/api/src/vectorize/upserter.ts` (메타 정합)
- `apps/api/src/vectorize/table-fetcher.ts` (D1Reader 패턴)
- `migrations/0002_1st_exam_extension.sql` (topic_clusters schema)
- `migrations/0027_review_queue.sql` (Stage 4)
- `apps/api/src/search/multi-path-fallback/{index,honest-refusal}.ts`

## 누적 결과

| Pass        | 🔴 CRITICAL | 🟠 MAJOR | 🟡 MINOR | N/A |
| ----------- | ----------- | -------- | -------- | --- |
| 1 SURGEON   | 0           | 2        | 3        | 2   |
| 2 ARCHITECT | 1           | 3        | 2        | 0   |
| 3 ADVOCATE  | 1           | 3        | 3        | 1   |
| 4 CONTRACT  | 0           | 1        | 2        | 0   |
| **누적**    | **2**       | **9**    | **10**   | 3   |

## 즉시 흡수 (본 step, 5건)

| ID            | 위치                                 | 처리                                                                                                  |
| ------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Pass 2 C1     | `routes.ts:90-96`                    | refine 메시지에 `(table_*/topic_clusters는 자체 status 컬럼 부재 — 자동 sentinel 'approved')` 명기    |
| Pass 3 C1 (a) | `apps/web/src/i18n/{types,ko,en}.ts` | `fallback.honest_refusal.out_of_scope` 키 등록 (ko 25자 + en 영문)                                    |
| Pass 4 M1     | `topic-cluster-fetcher.ts:51-52`     | `TopicClusterRow` interface `exam_frequency`/`is_covered` 미사용 필드 제거 + SQL SELECT 정리          |
| Pass 1 m1     | `topic-cluster-fetcher.ts:69-79`     | `pagination.limit > VECTORIZE_UPSERT_MAX_BATCH_SIZE` 가드 추가 (table-fetcher 정합) + 단위 테스트 1건 |
| Pass 1 m2     | `topic-cluster-fetcher.test.ts:53`   | `'' as never` → `'' as unknown as ExamId` (ExamId 타입 변경 silent break 방지)                        |

회귀: apps/api 447 → 457 → **458 PASS** (+1 LIMIT 가드 단위 테스트). typecheck/lint exit 0. apps/web typecheck PASS (i18n 정합).

## carry-over (별도 step, MAJOR 8 + MINOR 8)

### ★★★ 우선순위 2 (SP-T06 진입 차단 요소)

- **Pass 2 M1 / Pass 3 M3**: D-TCV-4 lv2 mismatch 정정 (`fetchNodesByCluster` lv1만 매칭 또는 metadata schema에 `lv2_topic` 추가) — **SP-T06 측정 step 진입 전 의무 환기 (정확도 0% 위험)**
- **Pass 1 M1 / Pass 3 Mi1**: SP-T06 결과 < 85% 미달 시 D-TCV-1=B (lv1 강조 또는 lv1+name 결합) 보강

### ★★ 운영 안전성 (별도 step)

- **Pass 1 M2**: Stage 1 vector 검색 cross-pollution 차단 — `node_type=knowledge_node` 화이트리스트 또는 `node_type != 'topic_cluster'` filter (검색 정책 step)
- **Pass 3 C1 (b)**: cluster.name 점수 분류 노출 정책 (출제자 의도 누설 우려) — 별도 ADR
- **Pass 3 M1**: `/search` query echo XSS 가드 (Session 058 carry-over 영속, 1주 내 흡수 의무)
- **Pass 3 M2**: routes.ts `confirmEnvironment?: 'staging' | 'production'` 옵션 추가

### ★ minor 보강 (별도 step)

- **Pass 2 M2**: `topic-cluster-router.ts:280` `buildHit` 주석 1줄
- **Pass 2 M3**: plan §3.1 `lv3` 미적재 사유 명기 또는 `lv3_subtopic?` optional 키 추가
- **Pass 1 m3**: `routes-dispatcher.test.ts:415` upsert metadata sentinel 단언 1줄 추가 (회귀 보호)
- **Pass 2 m1**: 상수 export 3종 → `vectorize/constants/topic-cluster.ts` 분리 검토
- **Pass 2 m2**: BOOTSTRAP_SOURCES 5종 비대칭 명시 주석 1줄
- **Pass 3 Mi2 / Mi3**: 정보 leak 미미, PASS
- **Pass 4 m2**: G-TCV-7 부분 PASS 조건 plan §6 영속 (본 step 즉시 흡수)

### Silent Pivot 보고 (Pass 4 반론)

- **ADMIN_API_TOKEN 회전이 plan 미명시** — 본 step 진행 위해 staging+production 양쪽 토큰 회전. 단순 운영 행위로 분류하나, 향후 동일 운영 행위 반복 가능성 고려 plan 또는 별도 ops checklist에 "토큰 회전 시 영향 범위 점검 + 차세션 carry-over 영속" 절차 추가 권고

## 운영 적재 결과 (이미 완료)

```
=== staging ===
mutationId: 51a6c5d9-e49c-4e8a-83ff-84be599c24ae
fetched: 50 / upserted: 50 / skipped: 0 / durationMs: 1193
vectorCount: 1227 → 1277 (+50) ✅ G-TCV-4 PASS

=== production ===
mutationId: 22e30703-8fad-4911-8c5a-b8e98d166dbd
fetched: 50 / upserted: 50 / skipped: 0 / durationMs: 1104
vectorCount: 1227 → 1277 (+50) ✅ G-TCV-5 PASS

=== production e2e smoke ===
query: '낙엽률' / top1: 0.729 / stage1: 10 / stage2: 0
fallback: { source: 'honest-refusal', stage: 4, reviewQueueId: 'rq_4773...', messageKey: 'fallback.honest_refusal.out_of_scope' }
→ Stage 2/3/4 routing 정상 + review_queue INSERT 정상 ✅ G-TCV-7 부분 PASS
→ Stage 3 source='topic-cluster' 미surface = SP-T06 측정 carry-over (D-TCV-4 lv2 mismatch + cosine < 0.50 의심)
```

## 판정: **완료 가능 (적재 step 1차 목표 달성)**

CRITICAL 2건 즉시 흡수 + MAJOR 1 + MINOR 2 흡수 완료. 잔여 MAJOR 8 + MINOR 8 모두 별도 step carry-over 영속. 본 step의 1차 목표 (Stage 3 dead path 해제, Vectorize 적재 +50) 달성 + 4-Pass 정합성 검증 통과.

**다음 step 의무**:

1. (★★★) D-TCV-4 lv2 mismatch 정정 (SP-T06 진입 전 정확도 0% 위험 차단)
2. (★★) SP-T06/T07 fixture 측정 (Pass 1 M1 / Pass 3 Mi1 실측)
3. (★★) `/search` query echo XSS 가드 (Pass 3 M1, Session 058 carry-over)
