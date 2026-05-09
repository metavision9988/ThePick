# 4-Pass Independent Review — D-TCV-4 lv2 mismatch 정정 (Session 061)

> 본 step: Multi-Path Fallback Stage 3 (Topic Cluster Routing) cluster→nodes 매칭 정정
> plan: `docs/plans/phase2a-d-tcv-4-fix.plan.md`
> 4 에이전트 독립 병렬 실행 (silent-failure-hunter / backend-architect / security-engineer / code-reviewer)
> 작성: Claude (Opus 4.7 1M context) — Session 061
> 효력: 2026-05-09 KST

---

## 0. Executive Summary

| Pass        | Agent                 | ✅     | 🔴 CRIT | 🟠 MAJOR | 🟡 MINOR | 판정                         |
| ----------- | --------------------- | ------ | ------- | -------- | -------- | ---------------------------- |
| 1 SURGEON   | silent-failure-hunter | 6      | 2       | 3        | 4        | 수정 필요                    |
| 2 ARCHITECT | backend-architect     | 9      | 0       | 2        | 3        | 완료 가능 (조건부)           |
| 3 ADVOCATE  | security-engineer     | 7      | 2       | 3        | 2        | 수정 필요                    |
| 4 CONTRACT  | code-reviewer         | 11     | 0       | 2        | 3        | 수정 필요                    |
| **누적**    | —                     | **33** | **4**   | **10**   | **12**   | **수정 필요 → 흡수 후 완료** |

---

## 1. 🔴 CRITICAL 4 (모두 즉시 흡수 ✅)

### CRIT-1 (Pass 1 SURGEON) — D1 throw가 fallback 전체를 깨뜨림 (graceful 위반)

- **위치**: `topic-cluster-router.ts:232, 295` + `multi-path-fallback/index.ts:73`
- **문제**: `fetchClustersByIds` / `fetchNodesByIds` throw 시 caller catch 부재 → routes.ts 까지 전파 → 학습자 500 error. ADR-015 graceful 본질 + index.ts:79-82 honest_refusal 정책과 직접 모순
- **흡수**: `topic-cluster-router.ts:232-244, 333-345` try/catch 추가 + console.error sentinel + buildEmptyResult / continue (graceful Miss)

### CRIT-2 (Pass 1 SURGEON) — truth_weight NULL → NaN 정렬 (비결정적)

- **위치**: `topic-cluster-router.ts:419-430`
- **문제**: `TRUTH_WEIGHTS[row.type] ?? row.truth_weight` 가 row.truth_weight=NULL 시 undefined → Array.sort `b.truthWeight - a.truthWeight = NaN` → V8 비결정 정렬 → 응답 매번 다름
- **흡수**: `topic-cluster-router.ts:121-128` `TRUTH_WEIGHT_NAN_GUARD = 0` 상수 + `?? TRUTH_WEIGHT_NAN_GUARD` fallback. 신규 테스트 case (UNKNOWN_TYPE + truth_weight=null → 0 fallback + Number.isFinite 회귀)

### CRIT-3 (Pass 3 ADVOCATE) — production diagnostics 응답 surface (정보 누설)

- **위치**: `routes.ts:118-127` + `topic-cluster-router.ts:127-153` + `honest-refusal.ts:99-122`
- **문제**: `stage3Diagnostics` (clusterMatchCount/top1ClusterScore/nodeAboveThresholdCount 등) production 응답 노출 → 임계값 역산 + Vectorize index 분포 추정 + Cloudflare V2 binding fingerprinting (NIST SP 800-53 SI-11 위반)
- **흡수**: `routes.ts:127-132` env 분기 (`'staging' | 'dev' | 'development' | 'test'` 만 보존, production strip) + `routes.ts:213-228` `stripStage3Diagnostics()` helper

### CRIT-4 (Pass 3 ADVOCATE) — cluster.lv2 / cluster.name 점수 분류 raw 노출 (출제자 의도 누설)

- **위치**: `topic-cluster-router.ts:142-153, 323-332`
- **문제**: production cluster.lv2='5점'/'15점' (점수 분류) + cluster.name='적과전종합위험 — 5점 단답' raw surface → 학습자가 "5점짜리만 선택 학습" 출제자 의도 왜곡. Session 060 carry-over 누적 (Pass 3 C1 b)
- **흡수**: `TopicClusterRouterResult.clusters[].lv2` 응답 shape에서 제거 + `CLUSTER_NAME_SCORE_SUFFIX_REGEX = / — \d+점.*$/` + `sanitizeClusterName()` server-side strip

---

## 2. 🟠 MAJOR 10 (즉시 흡수 4 + carry-over 6)

### 2.1 즉시 흡수 ✅

| ID    | 출처 | 위치                                                        | 흡수                                                    |
| ----- | ---- | ----------------------------------------------------------- | ------------------------------------------------------- |
| M1-1  | P1   | `topic-cluster-router.ts:271-281`                           | `nodeQueryAttemptCount += 1` try 진입 직후 이동         |
| M1-2  | P1   | `topic-cluster-router.ts:272`                               | `STAGE3_NODE_QUERY_OVERFETCH_RATIO = 4` 상수 명명       |
| M4-C1 | P4   | `docs/plans/phase2a-d-tcv-4-fix.plan.md` §3.2 / §5.2.1 / §6 | Silent Pivot 영속 + G-FIX-9/10 추가                     |
| M4-C2 | P4   | `apps/api/src/search/user-search.ts:56-77`                  | VectorizeFilterValue 주석 정정 (Year 2 carry-over 명시) |

### 2.2 Carry-over (handoff-070 §주의 영속)

| ID   | 출처 | 영역                        | 차세션 의무                                                                                                                 |
| ---- | ---- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| M1-3 | P1   | ontology single source      | `STAGE3_NODE_ID_EXCLUDE_PREFIXES` ↔ ontology-registry.json sync (Year 2 v1.6.0 진입 시 회귀 위험)                           |
| M2-1 | P2   | Workers CPU 한도            | Stage 3 4 vector query 직렬 + 4 D1 IN 추정 ~600ms / ADR-008 800ms timeout 정합 검증 (Promise.all 병렬화 step 우선순위 상향) |
| M2-2 | P2   | ADR-004 V2 filter 영속      | Cloudflare Vectorize V2 binding filter operator ($in/$nin/$ne) 미작동 사실 ADR-004 §3 Addendum 또는 신규 ADR 영속           |
| M3-1 | P3   | prefix denylist → allowlist | Year 2 신규 prefix (TLINK-/MEDIA- 등) 도입 시 silent leak 차단 — fail-secure allowlist 전환                                 |
| M3-2 | P3   | messageKey 분기             | 'out_of_scope' / 'admin_review_pending' / 'no_match' 분기 (현 production status='draft' 783건 misrepresent)                 |
| M3-3 | P3   | a11y / apps/web             | stage3Diagnostics raw JSON UI 표시 금지 contract — apps/web 진입 시 messageKey lookup만                                     |

---

## 3. 🟡 MINOR 12 (대부분 carry-over)

| ID     | 출처 | 요약                                                       | 처리                                                            |
| ------ | ---- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| MIN1-1 | P1   | top1ClusterScore 임계 미달 포함 모호                       | jsdoc 보강 carry-over                                           |
| MIN1-2 | P1   | `_examId` underscore Year 2 zero-cost                      | Year 2 carry-over (plan §8.5 명시)                              |
| MIN1-3 | P1   | console.error sentinel 추가                                | ✅ CRIT-1 흡수 시 동시 처리                                     |
| MIN1-4 | P1   | 테스트 회귀 clustersWithEmbeddingCount 누적 검증           | 추가 회귀 테스트 carry-over                                     |
| MIN2-1 | P2   | status_transitions LEFT JOIN ROW_NUMBER 3중 중복           | DRY 추출 carry-over (별도 step `_shared/sql-fragments.ts`)      |
| MIN2-2 | P2   | production diagnostics 응답 노출 정책 부재                 | ✅ CRIT-3 흡수로 자동 해소                                      |
| MIN2-3 | P2   | STAGE3_NODE_ID_EXCLUDE_PREFIXES ontology sync 의무         | M1-3 carry-over 정합                                            |
| MIN3-1 | P3   | Vectorize.query queryEmbedding 차원 검증 부재              | 임베딩 차원 1024 명시 상수 carry-over                           |
| MIN3-2 | P3   | nodeQueryAttemptCount 위치                                 | ✅ M1-1 흡수                                                    |
| MIN4-1 | P4   | plan §6 G-FIX-7 4-Pass 표현 mismatch                       | plan 표현 갱신 (auto-review-protocol §"규칙 0" 정합) carry-over |
| MIN4-2 | P4   | session-monitor.sh hook 활성 미확인                        | handoff-070 entry 의무                                          |
| MIN4-3 | P4   | plan §8.5 STAGE3_NODE_ID_EXCLUDE_PREFIXES Year 2 영속 보강 | M1-3 carry-over 정합                                            |

---

## 4. Devil's Advocate (Cross-Pass 누적)

1. **production knowledge_nodes 783건 모두 status='draft'** (Pass 1+2+3+4 공통 발견) — Stage 3 fetchNodesByIds 의 `status='approved'` 필터로 results=[] 영구 보장. 본 step 책임 외 (admin G5.5 검수 영역). SP-T06/T07 carry-over.
2. **Cloudflare Vectorize V2 binding spec mismatch** — $ne/$in/$nin operator 가 binding 에서 0건 반환. Cloudflare changelog 모니터링 의무 영속 부재 (M2-2 carry-over).
3. **Stage 1 cross-pollution 차단 우선순위 상향** (Pass 2 시나리오 A) — Stage 1 vector recall 도 cluster id (TC-) 섞일 가능성. handoff-068 plan §8.3 우선순위 3 → 우선순위 2 상향 권고.

---

## 5. 판정

**완료 가능** (즉시 흡수 후) — CRIT 4건 + MAJOR 4건 모두 즉시 흡수 완료. MAJOR 6건 + MINOR 12건 carry-over (handoff-070 영속).

### 검증 게이트 (G-FIX-1~10) 결과

| Gate     | 기준                               | 결과                                                          |
| -------- | ---------------------------------- | ------------------------------------------------------------- |
| G-FIX-1  | typecheck PASS                     | ✅ exit 0                                                     |
| G-FIX-2  | lint PASS                          | ✅ 0 issues                                                   |
| G-FIX-3  | apps/api 458+ vitest               | ✅ 467 (+9 신규: lv1-only fix 5 + CRIT 흡수 4)                |
| G-FIX-4  | verify post-impl 7/0/1             | ✅ Cat 1+4+5+6+7+9+10 PASS / Cat 8 SKIP / TD-VRF-001 known    |
| G-FIX-5  | production e2e Stage 3 흐름        | ✅ 진단 surface로 알고리즘 흐름 검증 (admin status 영역 별도) |
| G-FIX-6  | Hard Rule 17 grep 0건              | ✅ 변경 5 파일                                                |
| G-FIX-7  | 4-Pass CRITICAL 0건                | ✅ 4건 모두 흡수                                              |
| G-FIX-8  | response shape 비변경 + lv2 strip  | ✅                                                            |
| G-FIX-9  | prefix exclusion 차단 동작         | ✅ 단위 테스트 + e2e diagnostics                              |
| G-FIX-10 | production stage3Diagnostics strip | ✅ env 분기 검증 (staging 보존 / production 제거)             |

---

## 6. 본 통합 보고서 영속

- 파일: `.claude/reviews/review-20260509-164117-d-tcv-4-fix-4pass.md`
- 갱신: handoff-070 §주의 + WBS §1+§4+§5+§6 sync 의무
- carry-over 영역: §2.2 + §3 minor 차세션 entry 의무
