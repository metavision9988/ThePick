# Session 061 종착 핸드오프 — ThePick (쪽집게, 손해평가사 자격시험 AI 학습 서비스)

> **본 세션(061) 종착**: handoff-069 §3 우선순위 1 (D-TCV-4 lv2 mismatch 정정) + Reality Anchor 2회 발견 + 진산 결정 옵션 B 채택 + 4-Pass 독립 리뷰 + CRIT 4 + MAJOR 4 즉시 흡수 + production+staging deploy.
> **다음 세션(062) 진입 시 본 파일을 가장 먼저 읽고 verify 진입.**
> **본 핸드오프 번호 = 070** (handoff-069 직계 후속, Session 061 종착)

---

## 브랜치 & 컨텍스트

- 브랜치: main
- Session 061 entry HEAD: 725534b (handoff-069 영속) → 본 세션 종착 commit (handoff-070 영속 후)
- ★ 본 세션 진척 = 시스템 셧다운 후 재시작 + 진산 발화 "권장 진행"

---

## 본 세션(061) 한 일

### A. ★ entry verify 영속 3회 (TD-VRF-001 정합)

- run1 PASS 7/0/1 (`.claude/reports/sprint1-step5-5-verify-session-061-entry-run1.json`)
- run2 FAIL Cat 1 (batch 326/327 — TD-VRF-001 known 비결정성, handoff-041 동일 패턴)
- run3 PASS 7/0/1 (재현 회복)
- 결정: TD-VRF-001 known issue 정합 → 진행

### B. ★★ Reality Anchor 1차 발견 (D-TCV-4 plan §8.1 옵션 1 무효)

- production 실측: `topic_clusters.lv1` 11종 (간소화 도메인 — 4대시설/가축/과실손해보장/논작물/밭작물 등) ≠ `knowledge_nodes.lv1_insurance` (보험 종목명 — '종합위험 밭작물 생산비보장' 등)
- 11종 직접 매칭 검증: `lv1_insurance IN (...)` = 0건 / `lv2_crop IN (...)` = 0건
- handoff-069 plan §8.1 "옵션 1 cluster.lv1만 매칭 (가장 안전)" 가정이 production 데이터 미실측 추정으로 무효
- 진산 보고 (CRITICAL RULE #1) → 4 옵션 (A LIKE / B bge-m3 2nd query / C 매핑 테이블 / D Stage 3 비활성) 재제시
- 진산 결정: **옵션 B 채택** ("B (bge-m3 2nd query) 권장 — 채택")

### C. ★★★ D-TCV-4-FIX-1=B-1 plan + 코드

#### C.1 plan 영속

- `docs/plans/phase2a-d-tcv-4-fix.plan.md` (NEW, §1~§8)
- §3.1 채택안 + §3.3 옵션 A/C/D 기각 사유 + §5.2 알고리즘 명세 + §6 G-FIX-1~10 게이트

#### C.2 코드 진화 (★★ Reality Anchor 2차 발견 → 알고리즘 fallback)

1. **1차 시도**: cluster matching 1st query `returnValues:true` + cluster.embedding 으로 2nd query `filter: { node_type: 'knowledge_node', exam_id }` + `topK=5`
2. **staging e2e 진단**: cluster matching 정상 (3건 매칭, top1=0.94) but **fetchNodesByIds 결과 0건**
3. **Reality Anchor 2차**: production knowledge_nodes metadata.node_type = NodeType 7종 ('CONCEPT'/'LAW'/'FORMULA'/'INSURANCE'/'INVESTIGATION'/'CROP'/'TERM') — 'knowledge_node' 단일 값으로 적재 안 됨
4. **2차 시도**: filter `node_type: { $nin: ['topic_cluster', 'TABLE', 'ROW', 'COL', 'CELL'] }` → nodeMatchCount=0 (V2 binding $nin 미작동)
5. **3차 시도**: filter `node_type: { $in: KNOWLEDGE_NODE_TYPE_WHITELIST }` → 동일 nodeMatchCount=0
6. **★★ Reality Anchor 결론**: Cloudflare Vectorize V2 binding 의 filter 객체 형식 ($in/$nin/$ne) 가 0건 반환 (binding spec mismatch)
7. **최종 fallback**: 단순 `filter: { exam_id }` + topK = `TOPIC_CLUSTER_NODES_PER_CLUSTER * STAGE3_NODE_QUERY_OVERFETCH_RATIO` (5 × 4 = 20) + client-side prefix exclusion (`STAGE3_NODE_ID_EXCLUDE_PREFIXES = ['TC-', 'TBL-', 'TROW-', 'TCOL-', 'TCELL-']`) — 결과 nodeMatchCount=60 / nodeAboveThresholdCount=24~40 ✅

#### C.3 ★★★ Reality Anchor 3차 발견 (results=0 원인)

- production knowledge_nodes 783건 모두 `status='draft'` (admin 검수 미진행, status_transitions 'approved' 전환 0건)
- fetchNodesByIds `latest.to_status='approved'` 필터로 0행 → results=[] (Stage 4 직행)
- **본 step 코드 측면 정정 완료** — results=0 은 admin 검수 영역 (G5.5)
- SP-T06/T07 carry-over (status='approved' 시점 측정 의무)

#### C.4 진단 필드 신규 surface

- `TopicClusterRouterResult.diagnostics: TopicClusterDiagnostics` (필수, 7 metric)
- `HonestRefusalResponse.stage3Diagnostics?` (옵셔널)
- 학습자 fallback 응답에 cluster matching 단계별 진단 surface — production tuning 종료 시점에 strip

### D. ★★★ 4-Pass 독립 리뷰 (4 에이전트 병렬)

| Pass        | Agent                 | ✅     | 🔴    | 🟠     | 🟡     |
| ----------- | --------------------- | ------ | ----- | ------ | ------ |
| 1 SURGEON   | silent-failure-hunter | 6      | 2     | 3      | 4      |
| 2 ARCHITECT | backend-architect     | 9      | 0     | 2      | 3      |
| 3 ADVOCATE  | security-engineer     | 7      | 2     | 3      | 2      |
| 4 CONTRACT  | code-reviewer         | 11     | 0     | 2      | 3      |
| **누적**    | —                     | **33** | **4** | **10** | **12** |

- 통합 보고서: `.claude/reviews/review-20260509-164117-d-tcv-4-fix-4pass.md`

### E. ★★★ 즉시 흡수 (Session 061)

#### CRIT 4 즉시 흡수

1. **CRIT-1 (P1)**: D1 throw graceful 위반 → `fetchClustersByIds`/`fetchNodesByIds` try/catch + console.error sentinel + buildEmptyResult / continue
2. **CRIT-2 (P1)**: truth_weight NaN 정렬 → `TRUTH_WEIGHT_NAN_GUARD = 0` 상수 + `?? 0` fallback
3. **CRIT-3 (P3)**: production diagnostics 누설 → `routes.ts` env 분기 (staging/dev/development/test 보존 / production strip) + `stripStage3Diagnostics()` helper
4. **CRIT-4 (P3)**: cluster.lv2 / cluster.name 점수 분류 노출 → `lv2` 응답 shape 제거 + `sanitizeClusterName()` server-side strip (`/ — \d+점.*$/` regex)

#### MAJOR 4 즉시 흡수

1. **M1-1**: nodeQueryAttemptCount throw 시 미증가 → try 진입 직후 increment
2. **M1-2**: `topK * 4` 매직넘버 → `STAGE3_NODE_QUERY_OVERFETCH_RATIO = 4` 상수 명명
3. **M4-C1 (Silent Pivot)**: plan §5.2 ↔ 실 구현 불일치 → plan §5.2.1 신규 + §3.2 비용 갱신 + §6 G-FIX-9/10 추가
4. **M4-C2**: VectorizeFilterValue 타입 주석 정정 (Year 2 carry-over 명시)

### F. ★★★ 회귀 + 운영 검증

- 단위 테스트: 38 → 42 → 46 PASS (multi-path-fallback 4 파일)
- apps/api: 458 → 463 → 467 PASS (+9 신규 = 5 lv1-only + 4 CRIT 회귀)
- 모노레포: 1401 PASS (TD-VRF-001 batch 326/327 known)
- typecheck + lint exit 0
- post-absorb verify: 7/0/1 PASS

### G. ★★★ Workers deploy

- staging: thepick-api-staging Version `b67a428a-5b27-4edb-97ff-0cb5cfba9efc`
- production: thepick-api-production Version `3fe8305b-49f7-4845-84a5-6004f822ce46`
- e2e diagnostic 검증:
  - staging: stage3Diagnostics 보존 (clusterMatch=3 / top1=0.94 / nodeAbove=24) ✅
  - production: stage3Diagnostics strip ✅ (CRIT-3 흡수)
  - 양쪽 모두 cluster.lv2 surface 0건 + cluster.name 점수 분류 strip ✅ (CRIT-4 흡수)

---

## ★★★ 본 세션 결정 영속

| 트리거                                        | 진산 발화/영속                                     | 결과                                                          |
| --------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| Session 061 entry (시스템 셧다운 후 재시작)   | "현황 파악 + 로드맵 제출"                          | 프로젝트 진척 55% 보고 + 권장진로 옵션 A 제시                 |
| 권장진로 결정                                 | "권장 진행"                                        | 옵션 A (D-TCV-4 → SP-T06/T07) 채택                            |
| Reality Anchor 1차 (plan §8.1 무효)           | (Claude 보고 후 진산) "B 권장 채택"                | D-TCV-4-FIX-1=B-1 채택                                        |
| Reality Anchor 2차 (V2 binding spec mismatch) | (자동, memory feedback_no_granular_decisions 정합) | 단순 filter + client-side prefix exclusion fallback 자동 진행 |
| Reality Anchor 3차 (status='draft' 783건)     | (자동)                                             | SP-T06/T07 carry-over (admin G5.5 영역)                       |
| 4-Pass CRIT/MAJOR 흡수                        | (자동, 권장진로 정합)                              | CRIT 4 + MAJOR 4 즉시 흡수, MAJOR 6 + MINOR 12 carry-over     |

---

## 수정된 파일 (origin/main = 본 commit)

### 신규

- `docs/plans/phase2a-d-tcv-4-fix.plan.md` (NEW, §1~§8 + §5.2.1 Silent Pivot 영속)
- `.claude/reviews/review-20260509-164117-d-tcv-4-fix-4pass.md` (NEW, 4 에이전트 통합 보고서)

### 변경

- `apps/api/src/search/multi-path-fallback/topic-cluster-router.ts` (코어 — D-TCV-4-FIX-1=B-1 + CRIT 1/2/4 + MAJOR 1/2 흡수)
- `apps/api/src/search/multi-path-fallback/honest-refusal.ts` (stage3Diagnostics? 응답 surface)
- `apps/api/src/search/multi-path-fallback/index.ts` (diagnostics 전달)
- `apps/api/src/search/multi-path-fallback/__tests__/topic-cluster-router.test.ts` (전면 재작성, 17 tests + CRIT 회귀 4 신규)
- `apps/api/src/search/multi-path-fallback/__tests__/index.test.ts` (sequential mock + SQL 분기 'kn.id IN' 변경)
- `apps/api/src/search/user-search.ts` (VectorizeFilterValue 타입 + matches.values + Year 2 주석)
- `apps/api/src/search/routes.ts` (CRIT-3 production strip + stripStage3Diagnostics helper)
- `apps/api/src/vectorize/topic-cluster-fetcher.ts` (Reality Anchor 주석 갱신)
- `.claude/reports/sprint1-step5-5-verify-session-061-{entry-run1,entry-run2,entry-run3,post-fix-run1,post-fix-run2,post-absorb-run1}.json`

---

## 누적 통합 통계 (production D1 + Vectorize, 2026-05-09 Session 061 종착)

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

★ Vectorize indexes (Cloudflare):
- thepick-embeddings-staging   : 1024d cosine, vectorCount=1277 (불변)
- thepick-embeddings           : 1024d cosine, vectorCount=1277 (불변)

★ /api/search public route Multi-Path Fallback (Stage 1~4):
- Stage 1 vector recall (≥0.60) ✅
- Stage 2 hard filter (status='approved') — production 0건 (admin 검수 미진행)
- Stage 3 ★ D-TCV-4-FIX-1=B-1 cluster.embedding 2nd query + client-side prefix exclusion
- Stage 4 honest-refusal + review_queue INSERT
- diagnostics: production strip / staging+dev 보존

★ Workers deploy (Session 061):
- thepick-api-staging Version b67a428a-5b27-4edb-97ff-0cb5cfba9efc
- thepick-api-production Version 3fe8305b-49f7-4845-84a5-6004f822ce46

apps/api tests : 458 → 467 PASS (★ +9 신규)
모노레포 : 1401 PASS (TD-VRF-001 batch 326/327 known 비결정성)
verify total : 8 categories = 7/0/1 (불변, Cat 8 SKIP)

★ Hard Rule 17 grep 0건 in 변경 5 파일 ✓
★ 상용 품질 0 위반 (any/console.log 디버깅/TODO/빈catch/import *) ✓
   (console.error sentinel 은 Pass 1 MINOR-3 흡수 의도, 디버깅 console.log 와 분류 분리)
```

---

## ★★★ 다음 할 일 (차세션 062+)

### 1. ★ entry verify 영속 2회 (의무)

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > /home/soo/ClaudePro/ThePick/.claude/reports/sprint1-step5-5-verify-session-062-entry-run1.json
# (run2 동일) → run1≡run2 PASS 7/0/1 일치 의무 (TD-VRF-001 batch 326/327 known)
```

### 2. ★ A2 schema drift CI 결과 확인 (KST 09:00 schedule)

### 3. ★★★ 권장 진로 (Session 061 4-Pass carry-over + Reality Anchor 3차)

#### 우선순위 1 (★★★ admin G5.5 진입 차단 — SP-T06 측정 전제)

- **★★★ admin 검수 워크플로우 일부 진입 — 적어도 BATCH-1~5 (적과전~논·밭·시설작물) 또는 LAW 노드 일부 status='approved' 전환** — 본 step의 Stage 3 정정 효과 실측 가능 환경 확보
- 또는 본 step 의 fetchNodesByIds 의 status filter 를 일시 완화 (production 학습자 노출 X, SP-T06 측정만)
- 진산 결정 영역 (admin G5.5 우선순위 vs Hard Rule 7 status='draft' 보존)

#### 우선순위 2 (정확도 측정 — handoff-069 carry-over)

- **★★ SP-T06 fixture 50건 + 정확도 ≥ 85%** — 우선순위 1 후
- **★★ SP-T07 fixture 100건 + 거부율 ≤ 5%**

#### 우선순위 3 (4-Pass MAJOR carry-over — handoff-070 §주의)

- **★★★ M3-2 messageKey 분기** (P3 ADVOCATE) — 'out_of_scope' / 'admin_review_pending' / 'no_match' i18n 키 추가 + reason 분기 (현 production 'out_of_scope' misrepresent — status='draft' 783건이 학습자에 "범위 밖" 안내)
- **★★ M2-1 Workers CPU/timeout budget** (P2 ARCHITECT) — Stage 3 4 vector query 직렬 ~600ms / Promise.all 병렬화 (Rule 23 / ADR-019 우선순위 상향)
- **★★ M2-2 ADR-004 V2 filter limitation 영속** (P2 ARCHITECT) — Cloudflare Vectorize V2 binding $in/$nin/$ne 미작동 사실 ADR Addendum 또는 신규 ADR
- **★★ M1-3 STAGE3_NODE_ID_EXCLUDE_PREFIXES ↔ ontology-registry single source** (P1 SURGEON / P2 ARCHITECT MIN2-3) — Year 2 신규 prefix 도입 시 silent leak 차단
- **★ M3-1 prefix denylist → allowlist 전환** (P3 ADVOCATE) — fail-secure
- **★ M3-3 a11y / apps/web stage3Diagnostics 미표시 contract** (P3 ADVOCATE) — apps/web 진입 시 messageKey lookup 만

#### 우선순위 4 (Stage 1 cross-pollution 차단 — Pass 2 시나리오 A 상향)

- **★★ Stage 1 vector recall 에서도 cluster id (TC-) 섞일 가능성** — handoff-068 plan §8.3 우선순위 3 → 우선순위 2 상향 권고

#### 우선순위 5 (운영 안전성 — handoff-069 carry-over)

- **★★ /search query echo XSS 가드** (Pass 3 M1, Session 058 carry-over)
- **★ confirmEnvironment admin endpoint 옵션** (Pass 3 M2)
- **★ review_queue dedup `INSERT ... ON CONFLICT(exam_id, query_hash)`**
- **★ Stage 2/3/4 timeout 통합 (ADR-008 800ms)**

#### 우선순위 6 (UI/노출 정책 — handoff-069 carry-over)

- **★★ cluster.name 점수 분류 노출 정책 ADR** (Pass 3 C1 b carry-over) — 본 세션 sanitizeClusterName 으로 흡수했으나 정책 ADR 영속 의무

#### 우선순위 7 (Year 2 carry-over)

- NodeType union 'TOPIC_CLUSTER' 추가 + ontology-registry v1.6.0 + ADR
- topic_clusters 에 exam_id 컬럼 추가 (멀티시험 진입 시)
- valid_from time-based effectivity (Session 058 Pass 4 C1)
- VectorizeFilterValue operator 분기 활성화 (V2 binding 정상화 시)

### 4. carry-over (진산 영역 / Phase 2 병행)

- 5 별표 status='draft' → 'active' 전환 (admin G5.5)
- TBL-012 별표 2 PDF 정확 매트릭스 재작업
- ADR-033 Activate (Year 2 진입)
- C3 BA-C1 plan Activate (admin G5.5 UI)
- docs/observability/master-dashboard.md 본격 작성

---

## 주의사항

### ★★★ status='draft' 783건 — Stage 3 정정 효과 측정 차단 요소

- production knowledge_nodes 783건 모두 status='draft' (admin 검수 미진행)
- fetchNodesByIds `status='approved'` 필터 → results=[] 영구 보장
- SP-T06/T07 측정 의미 없는 환경 — admin 검수 일부 진행 후 측정 의무
- 학습자 입장: 항상 honest-refusal 응답 — messageKey 'out_of_scope' misrepresent (P3 MAJOR-2 carry-over 권장 우선)

### ★ 4-Pass Carry-over 영속 (총 18건)

- Session 061 4-Pass: MAJOR 6 + MINOR 12 carry-over
- 누적 (Session 058~061): ~50건 carry-over (모두 plan + 본 핸드오프 §3 영속)

### ★ Cloudflare Vectorize V2 binding spec mismatch

- filter 객체 형식 ($in / $nin / $ne) 적용 시 0건 반환 — Cloudflare changelog 모니터링 carry-over
- ADR Addendum 영속 의무 (M2-2, P2 ARCHITECT)

### ★ session-health 본 세션(061)

- 시작 ~16:08 KST 2026-05-09 → 종료 ~16:42 KST 2026-05-09 → 약 35분 / turn ~30+
- 임계 (90분/50턴) 미도달 — 핸드오프 + commit + push 후 종착

### ★ wrangler OAuth + Workers AI + Vectorize 가용

- staging+production deploy + Vectorize query 모두 정상 (Session 061)

### ★ TD-VRF-001 verify vitest 비결정성

- 본 세션 entry run1=PASS / run2=FAIL (batch 326/327) / run3=PASS — handoff-041/060 동일 패턴
- 새 회귀 아님, known issue
- Sprint 2 초기 흡수 의무 (WBS §5)

---

## 차세션 1차 읽기 의무 문서 (우선순위 순)

1. **`.jjokjipge/handoff-session-070.md`** ★ 본 핸드오프 (1순위)
2. **`docs/plans/phase2a-d-tcv-4-fix.plan.md`** §3 + §5.2.1 + §6 + §8 carry-over
3. **`.claude/reviews/review-20260509-164117-d-tcv-4-fix-4pass.md`** ★★★ (4 에이전트 통합 보고서)
4. **`apps/api/src/search/multi-path-fallback/topic-cluster-router.ts`** (코어, ★ Reality Anchor 3차 영속 + CRIT 4 흡수)
5. **`apps/api/src/search/routes.ts`** (CRIT-3 production strip + stripStage3Diagnostics)
6. **`apps/api/src/search/user-search.ts`** (VectorizeFilterValue Year 2 주석)
7. **`docs/plans/phase2a-multi-path-fallback.plan.md`** §10 carry-over
8. **`docs/architecture/SEARCH_PIPELINE.md`** v2.1 §3 + §5
9. **memory `feedback_full_autonomy.md`** (자동화 가능 영역 즉시 실행)
10. **memory `feedback_review_filename_pattern.md`** (review-\* prefix 의무)
11. **memory `feedback_no_granular_decisions.md`** (지엽 결정 delegation 금지)
12. **memory `feedback_two_fix_failures_zoom_out.md`** (2 회 fix 실패 시 root cause 재정의 — 본 세션 V2 binding fallback 정합)
13. **`.claude/rules/auto-review-protocol.md`** (4-Pass + 5-페르소나)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 061 종착 (D-TCV-4 정정 + Reality Anchor 3회 + 4-Pass + CRIT 4 + MAJOR 4 즉시 흡수 + production+staging deploy)
**다음 세션**: Session 062 — entry verify + admin 검수 일부 진행 (★★★ SP-T06 측정 차단 해소) → SP-T06/T07 측정 → messageKey 분기 / Workers timeout / ADR Addendum
**작성 효력**: 2026-05-09 KST (Session 061 종착, **CRIT 4 + MAJOR 4 흡수 + 4-Pass 1회 + production deploy**)
**예상 완료 다음 세션**: handoff-session-071 (admin 검수 일부 + SP-T06/T07 측정 + messageKey 분기)

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
