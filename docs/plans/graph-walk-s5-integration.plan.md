# L3 PLAN — Graph walk S5: 검색 라우터 통합

- **DEFCON:** L3 (코어 엔진 = Graph RAG 북극성 / 사용자 검색 경로 변경) —
  본 plan **진산 승인 후에만** 코딩. 본 문서는 실행 계획이지 실행이 아님.
- **선행:** `docs/plans/graph-walk-poc.plan.md` (S0~S4 완료, 엔진 단독 PoC)
- **근거 ADR:** ADR-045 (Graph walk T1) / ADR-044 (Pattern A 정체성) /
  ADR-012 (3-Stage Hybrid) / ADR-013 (Materialized Active View)
- **정합 문서:** `docs/architecture/SEARCH_PIPELINE.md` v2.1 §2~§5
- **상태:** ✅ S5-0 진산 결재 완료 (2026-05-15, Session 086) —
  6-A **인증 위임(자동 측정)** / 6-B **옵션 C 독립 엔드포인트** /
  6-C 권고 채택(graph-walk 최종 랭킹 미결정, Stage 3 단일 진실원).
  S5-1 인증 세션 진입.

---

## 0. Reality Anchor — S5 통합이 위험할 이유 3가지 (먼저)

1. **사용자 경로 회귀 위험**: PoC 엔진은 격리 검증됐으나, 통합은 production
   `/api/search` (학습자 노출 경로) 를 변경한다. Stage 2 → Stage 3 사이에
   N-hop 확장을 끼우면 결과 집합·지연·LLM 주입 토큰이 모두 변동. 회귀 게이트
   없이는 검색 품질 저하가 사용자에게 직접 도달.
2. **실 환경 미검증 (CO-1/CO-2)**: PoC는 in-memory `node:sqlite`. 실 Cloudflare
   D1 + Workers 의 `WITH RECURSIVE` CPU budget·collation 결정성은 **측정 전무**.
   통합 후 production 에서 50ms(free)/30s(paid) 초과 시 검색 라우트 전체 사망.
3. **이중 truth_weight 정책 위험 (CO-3)**: graph-walk 가 자체 truncation
   순서를 정하면 기존 Stage 3 "Truth Weight Re-rank" 와 별개의 2번째
   진실원이 생긴다. 단일 진실원 원칙 위배 → 개정 시 한쪽만 갱신되는 drift.

→ 결론: "엔진 됐으니 그냥 라우터에 호출 추가"는 불가. **CO-1~4 선결 +
통합 지점 결재 + 회귀 게이트 + 단일 truth_weight 진실원 보존**이 동시에
없으면 S5 진입 금지.

---

## 1. 4-Pass carry-over (CO-1~4) 처리 상태

PoC plan §5.1 가 S5 선결로 지정한 4건. 인증 불요 2건은 본 plan 에서 해소,
인증 게이트 2건은 진산 결재 항목으로 승격.

### CO-4 — approved 진실원 단일화 ✅ **해소 (코드 대조)**

graph-walk `approved` CTE(`apps/api/src/search/graph-walk/index.ts:179-191`)
와 user-search `fetchApprovedNodes`(`apps/api/src/search/user-search.ts:432-445`)
의 현재상태 도출 SQL 이 **문자 단위 동일**:

```
LEFT JOIN ( SELECT target_id, to_status,
  ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY transitioned_at DESC) AS rn
  FROM status_transitions WHERE target_type='node' ) latest
  ON latest.target_id=kn.id AND latest.rn=1
WHERE kn.is_current_active=1 AND COALESCE(latest.to_status,'draft')='approved'
```

- **판정**: 진실원 동일, NEW drift = 0. 유일 차이는 후보 한정
  (`kn.id IN (...)` vs 재귀 프론티어) — 의도된 기능 차이이지 진실원 분기 아님.
- **잔여 권고 (S5 작업 항목)**: 로직이 *공유*가 아닌 _복제_. S5 구현 시
  공통 SQL fragment(`approvedNodesCTE()` 빌더) 추출 → 향후 status 정책 개정
  시 한 곳만 수정. **블로커 아님, S5 리팩토링 항목으로 흡수.**

### CO-3 — truncated 노드 보존 정책 ✅ **해소 (아키텍처 결정 권고)**

현재 graph-walk: `ORDER BY depth ASC, id ASC` + `LIMIT cap+1` → "가장 먼
hop·큰 id" 노드 절단.

- **권고 정책**: graph-walk 는 **최종 랭킹을 정하지 않는다.** truncation 은
  hop-distance(연관성 proxy)로 recall 을 bound 하는 책임만 진다. truth_weight
  최종 정렬은 **기존 Stage 3 "Truth Weight Re-rank" 가 단일 진실원**으로
  수행 (SEARCH_PIPELINE.md §2 line 64 / ADR-012). graph-walk 에 2번째
  truth_weight 정책을 만들지 않는다 (Reality Anchor #3 회피).
- **함의**: S5 통합 시 graph-walk resultCap 은 Stage 3 re-rank 이 의미있게
  동작하도록 **충분히 관대**해야 한다(절단이 truth_weight 높은 노드를
  Stage 3 도달 전 제거하면 안 됨). 구체 cap 값은 §3 Binary Gate G-S3.
- **판정**: 정책 방향 확정 (단일 진실원 = 기존 Stage 3). **진산 확인 항목**
  (북극성 영향이므로 결재 체크포인트 §6 에 포함).

### CO-1 — 실 Cloudflare D1 + Workers CPU 실측 ⏸️ **인증 게이트**

- PoC G5 는 in-memory `node:sqlite` sane-bound(250ms)까지만 입증. 실
  D1 `WITH RECURSIVE` + `maxDepth=MAX_ALLOWED_DEPTH(5)` + 최고차수 실시드
  CPU 는 **미측정**.
- **필요**: Cloudflare 인증(진산 통제 자격증명) → staging/production D1 에
  read-only 측정 쿼리 실행. → 진산 결재 항목 §6-A.

### CO-2 — `ORDER BY depth, id` 결정성 실 D1 대조 ⏸️ **인증 게이트**

- golden 은 `node:sqlite` 결정성만 증명. 실 D1 collation + 한글/혼합 ID
  정렬이 동일한지 라이브 1회 대조 필요. → 진산 결재 항목 §6-A (CO-1 과
  동일 인증 세션에서 동시 처리 가능).

---

## 2. PITR — 통합 지점 아키텍처 (코딩 전 결정, ★ 진산 결재 핵심)

현 파이프라인(SEARCH_PIPELINE.md §2): **Stage 1 Vector Recall → Stage 2
Graph Hard Filter(approved/active 필터일 뿐, 엣지 순회 아님) → Stage 3
Truth Weight Re-rank**. N-hop 순회를 어디에 꽂는가:

| 옵션                                       | 통합 지점                                                                 | 장점                                                                                 | 단점                                                                              | 회귀 표면        |
| :----------------------------------------- | :------------------------------------------------------------------------ | :----------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :--------------- |
| **A. Stage 2.5 서브그래프 확장**           | Stage 2 approved 시드 → graph-walk N-hop 확장 → Stage 3 re-rank 입력 증강 | ADR-044 Pattern A 핵심 가치 실현 (multi-hop 추론). 정답률 비약(외부 인용 87% vs 23%) | 정상 경로 변경 = 최대 회귀 표면. 지연·토큰 증가. CO-1 미해소 시 production 사망   | ★ 高 (정상 경로) |
| **B. Multi-Path Fallback 보강**            | Stage 1 약함(<0.60) 시 fallback 단계에서만 graph-walk                     | 정상 경로 불변 = 회귀 표면 최소. 점진 도입                                           | Pattern A 핵심 가치는 *정상 경로*에서 발현돼야 함 — fallback 한정은 "있으나 마나" | 低 (예외 경로만) |
| **C. 독립 엔드포인트** `/api/search/graph` | 기존 라우트 무변경, opt-in 신규 라우트                                    | 회귀 표면 0. A/B baseline 측정 격리 가능                                             | 학습자 UX 통합 안 됨 (별도 화면). 정체성 회복 미완                                | 0                |

→ **권고: C → A 단계 도입.** C 로 실데이터 baseline(multi-hop 정답률)
격리 측정 + CO-1/CO-2 실측을 회귀 위험 0 에서 확보 → 데이터로 A 통합
ROI 입증 후 A 결재. B 는 Pattern A 정체성 미회복으로 단독 채택 기각.
**단 최종 선택은 진산 결재 (§6-B).**

---

## 3. Binary Gates (S5 완료 판정 — "잘 됨" 금지)

| Gate                  | 입력                        | 기대 출력                                             | 판정        |
| :-------------------- | :-------------------------- | :---------------------------------------------------- | :---------- |
| G-S1 회귀 0           | 기존 `apps/api` 전체 테스트 | 592 PASS 유지 (graph-walk 통합 후에도)                | 기계 비교   |
| G-S2 CO-1 실측        | 실 D1 최악 시드 depth=5     | CPU < 확정 budget (free 50ms or paid 결재값)          | 측정값      |
| G-S3 CO-2 결정성      | 한글/혼합 ID 시드, 실 D1    | `node:sqlite` golden 과 정렬 100% 일치                | 라이브 대조 |
| G-S4 단일 진실원      | status 정책 변경 시뮬       | graph-walk·user-search 양쪽 동시 반영 (공통 fragment) | 코드+테스트 |
| G-S5 multi-hop 정답률 | 실데이터 baseline 셋        | Vector-only 대비 정답률 측정값 보고 (개선 입증)       | golden+측정 |
| G-S6 Graceful         | graph-walk 0건/에러         | 기존 Multi-Path Fallback 정상 진입 (검색 무중단)      | 기계 비교   |

→ G-S1~G-S6 **전부 PASS**여야 S5 "완료". 1건이라도 실패 = 미완.

---

## 4. Step 분해 (결재 후 실행 순서)

1. **S5-0 (결재 게이트)**: 본 plan 진산 승인 + §6-B 통합 지점(A/B/C) 결정
   — ★ 미승인 시 S5-1 이하 전면 차단
2. **S5-1 (인증 세션)**: CO-1 + CO-2 실 Cloudflare D1 read-only 측정 (진산
   인증 위임 또는 진산 직접 실행). 측정값 → `docs/plans/` 영속
3. **S5-2**: 공통 `approvedNodesCTE()` fragment 추출 (CO-4 잔여 — graph-walk
   - user-search 공유, NEW drift 0 회귀 테스트)
4. **S5-3**: §6-B 결정 옵션 구현 (C 우선 권고: 독립 라우트 + Engine-First
   유지). Stage 3 re-rank 단일 진실원 보존 (CO-3)
5. **S5-4**: G-S1~G-S6 Binary Gate 작성+실행. 전 PASS 까지 S5-3 반복
6. **S5-5**: 4-Pass 독립 에이전트 리뷰 (L3 의무) + 5-페르소나 (북극성 경로
   변경 = 마일스톤) + 결과 영속
7. **S5-6**: multi-hop 정답률 baseline 진산 보고 → A 정상경로 통합 여부
   **차기 별도 결재** (C→A 단계 도입 시)

---

## 5. 잔존 위험 / 트레이드오프

- CO-1 실측이 free tier(50ms) 초과 시: paid 전제 결재 or PoC plan §2 옵션 B
  (앱 레벨 BFS) 폴백 재검토 — S5-1 에서 판정, 진산 보고
- 옵션 C 채택 시 학습자 UX 미통합 상태가 일정 기간 지속 (baseline 측정 기간).
  Pattern A 정체성 _완전_ 회복은 A 통합 차기 결재까지 미완 — 명시적 trade
- multi-hop 정답률 baseline 셋은 실 production 데이터 기반 — 진산 인증
  세션에서 시드 노드 실재 확인 동반 (S5-1 과 묶음)

---

## 6. 진산 결재 체크포인트 (S5-0 — ⏸️ 대기)

### 6-A. CO-1/CO-2 인증 게이트 결정 (택1)

- [ ] **A-1**: 진산이 Cloudflare 인증 제공/위임 → Claude 가 staging/production
      D1 read-only 측정 실행 (CO-1 CPU + CO-2 결정성 1 세션 처리)
- [ ] **A-2**: 진산이 측정 쿼리 직접 실행(`! wrangler d1 execute ...`) →
      결과를 Claude 에 전달
- [ ] **A-3**: 인증 불가 → C(독립 엔드포인트)로 회귀 표면 0 에서만 진행,
      CO-1/CO-2 는 staging 배포 시점까지 carry-over (한계 명시 영속)

### 6-B. 통합 지점 결정 (택1 — §2 PITR)

- [ ] **B-A**: Stage 2.5 정상 경로 확장 (Pattern A 즉시·최대 가치, 최대 회귀)
- [ ] **B-B**: Multi-Path Fallback 한정 (회귀 최소, 정체성 미회복 — 기각 권고)
- [ ] **B-C**: 독립 `/api/search/graph` → baseline 측정 후 A 차기 결재 (**권고**)

### 6-C. CO-3 단일 진실원 정책 확인

- [ ] graph-walk 는 최종 랭킹 미결정, truth_weight 정렬은 기존 Stage 3 단일
      진실원 유지 (graph-walk 2차 정책 생성 금지)에 동의

### 진행 기록

- 본 plan 작성 2026-05-15 (Session 086) — CO-4 ✅ / CO-3 ✅(정책 권고) /
  CO-1·CO-2 ⏸️ 인증 게이트로 승격. S5-0 결재 대기.
- S5-0 ✅ 진산 결재 2026-05-15 (Session 086): 6-A 인증 위임(자동 측정) /
  6-B 옵션 **C 독립 엔드포인트**(C→A 단계 도입) / 6-C 권고 채택.
  → S5-1 인증 세션 진입.
- S5-2~S5-5 ✅ 완료 (Session 087):
  - S5-2 공통 `approved-nodes-sql.ts` 단일 진실원 + drift-0 테스트.
  - S5-3 독립 `/api/search/graph`(옵션 C) + D-1(12종)·D-2(MAX_DEPTH 4·
    MATERIALIZED) 반영 + routes.ts:117 정정. `/api/search` 불변.
  - S5-4 Binary Gate `graph-walk-s5-binary-gates.md` G-S1~G-S4·G-S6 PASS
    (G-S5 = S5-6 산출).
  - S5-5 4-Pass(3 독립 에이전트) + 5-페르소나(5 독립) — realcode 게이트
    후 CRITICAL 0. 즉시수정 8묶음(CO-4 4곳 완전통합·실DB 동치/flagged/
    MATERIALIZED 테스트·Zod 정직·devops 로그 등). 회귀 0 (609 PASS).
    잔여 MAJOR = `review-20260515-202957-graph-walk-s5-2-s5-3.md` §4
    carry-over 원장 (S5-6 측정무결성 4 / S5-7 구조 5 / launch 게이트 1).
  - ★ S5-6 진입 시 §4 CO6-1~CO6-4 (perf M2 / truncated surface / 성공
    telemetry / 누락 테스트) **선결 의무** — baseline 신뢰성 전제.
- S5-1 ✅ 실 D1 측정 완료 (`graph-walk-s5-co1-co2-measurement.md`):
  CO-2 ✅ 해소(노드 ID 전부 ASCII, collation 무관). CO-1 ⚠️ 조건부 —
  narrow ~5ms 안전 / WIDE depth5 54ms free 초과 + `approved` CTE 비물질화
  rows_read 폭증(240K) 결함 식별(수정 경로 §2.2). 부수: 라이브 794노드
  확정(W2 해소) + production approved 488(0건 아님, routes.ts:117 stale).
  → ★ 결재 상신 D-1(화이트리스트 범위=북극성)·D-2(CPU 정책).

> **PoC plan §1 OUT(검색 통합)은 여전히 미진입. 본 plan 결재 전 코딩 금지
> (ADR-045 §결정 3 / plan §1 OUT / handoff-085 "자율 통합 절대 금지").**
