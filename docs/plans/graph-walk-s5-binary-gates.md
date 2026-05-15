# S5-4 Binary Gate 검증 — Graph walk S5 통합 (G-S1~G-S6)

- **세션:** 087 (2026-05-15) — S5-2(공통 빌더)·S5-3(독립 엔드포인트) 구현 후
- **선행:** `graph-walk-s5-integration.plan.md` §3 (Binary Gates 정의) /
  `graph-walk-s5-co1-co2-measurement.md` (S5-1 실 D1 측정)
- **판정 원칙:** "잘 됨" 금지 — 입력→기대출력 기계 판정. 1건 실패 = S5 미완.

---

## 판정 요약

| Gate | 기대 출력                                   | 실측/근거                                        | 판정    |
| :--- | :------------------------------------------ | :----------------------------------------------- | :------ |
| G-S1 | 기존 전체 테스트 PASS 유지                  | 592 → **603 PASS / 2 skip** (신규 11건만 증가)   | ✅ PASS |
| G-S2 | 실 D1 worst 시드 CPU < free budget          | S5-1: MAT depth4 41.5ms < 50ms, depth5 hard-cut  | ✅ PASS |
| G-S3 | 정렬 결정성 golden 일치                     | S5-1: production 노드 ID 전부 ASCII (collation∅) | ✅ PASS |
| G-S4 | status 정책 단일 진실원 (양쪽 동시 반영)    | S5-2: approved-nodes-sql.ts 단일 출처 + drift0   | ✅ PASS |
| G-S5 | Vector-only 대비 multi-hop 정답률 측정 보고 | S5-6 단계 (plan §4 분해 — 본 게이트는 S5-6 산출) | ⏸️ S5-6 |
| G-S6 | graph-walk 0건/에러 시 검색 무중단          | graph route graceful 200 + baseline / fail-loud  | ✅ PASS |

→ **G-S1·G-S2·G-S3·G-S4·G-S6 = PASS.** G-S5 는 plan §4 step 분해상 S5-6
산출물(별도 step)로 정의됨 — S5 "완료"는 S5-6 G-S5 측정 후 선언.

---

## G-S1 — 회귀 0 (기계 비교)

- 입력: `pnpm --filter @thepick/api test` (전체 39 파일)
- 기대: 기존 테스트 전건 PASS 유지
- 실측: **603 passed | 2 skipped (605)**. 본 세션 전 592 → +11 신규
  (`approved-nodes-sql.test.ts` 5 + `graph-search-route.test.ts` 6). 기존
  592건(graph-walk golden 21·user-search 16·routes 등) **전부 PASS 유지**.
- 부가: `typecheck`(tsc --noEmit) PASS / `lint`(eslint) PASS.
- 정합: `/api/search`·`searchKnowledgeNodesForUser`·graph-walk 엔진 시그니처
  불변. Stage 3 비교자 추출은 동작 동형(behavior-identical) — 기존 user-search
  16건이 회귀 검출기.
- **판정: ✅ PASS** (기계 비교 — 기존 0건 실패).

## G-S2 — CO-1 실 D1 CPU (S5-1 측정 + S5-3 코드 반영)

- 입력: 실 `thepick-db-production` worst-case 시드, 12종 화이트리스트, MAT.
- 기대: free tier 50ms 내.
- 실측 (measurement.md §3.1): MAT depth2 ~20ms / depth3 26.5ms /
  **depth4 41.5ms (< 50ms)** / depth5 67.3ms (초과).
- 코드 반영 검증 (S5-3): `MAX_ALLOWED_DEPTH = 4` (index.ts) — depth5 요청도
  엔진이 4로 clamp(`clampInt`), 결과 `maxDepth` 필드로 실효값 노출. golden
  test "maxDepth clamp" 가 clamp 동작 회귀 검출. `approved AS MATERIALIZED`
  S5-2 빌더 강제 (rows_read 폭증 차단, 195→67ms 2.9x).
- **판정: ✅ PASS** (측정값 < budget + hard ceiling 코드 반영).
- 잔존: depth5(67ms)는 명시적 paid opt-in 전까지 차단(Reality Anchor #1 강화).

## G-S3 — CO-2 정렬 결정성 (S5-1 라이브 대조)

- 입력: production `SELECT id FROM knowledge_nodes WHERE id GLOB '*[가-힣]*'`.
- 기대: 비-ASCII ID 0건 → `ORDER BY depth, id` collation 무관 결정적.
- 실측 (measurement.md §1): **0건** — 전부 `INS-15`/`F-08`/`CONCEPT-001`
  ASCII 패턴. 정렬 키 = 정수 depth + ASCII id → node:sqlite golden 과 동일
  보장. graph-walk golden G6 "exact id/depth 배열" 21 PASS 가 결정성 회귀
  검출기.
- **판정: ✅ PASS** (라이브 대조 — 한글 0건).

## G-S4 — 단일 진실원 (코드 + 테스트)

- 입력: status 도출 정책 변경 시뮬(코어 문자열 1곳 수정 시 양쪽 반영 여부).
- 기대: graph-walk·user-search 가 동일 status 코어 공유 → drift 0.
- 검증: `approved-nodes-sql.ts` `APPROVED_NODES_STATUS_CORE` **단일 상수**.
  graph-walk(`buildApprovedNodesMaterializedCte`)·user-search
  (`buildApprovedNodesQuery`) 양쪽이 이 1개 상수를 import — 복제 0,
  구조적 drift 불가. `approved-nodes-sql.test.ts` 5건이 byte-identical
  코어 공유를 기계 검증 (projection/candidateFilter 무관 코어 불변).
- CO-3 동반: Stage 3 truth_weight 정렬도 `compareByTruthWeightThenScore`
  단일 export — graph route 가 _공유_(2차 정책 생성 0). user-search 16건이
  Stage 3 동형성 회귀 검출기.
- **판정: ✅ PASS** (단일 상수 구조 + drift0 테스트).

## G-S5 — multi-hop 정답률 baseline (⏸️ S5-6)

- plan §4 step 분해상 S5-6 산출물. `/api/search/graph` 가 baseline(vector
  -only)·graph-augmented 결과를 1 응답에 동시 반환하도록 S5-3 구현 완료 →
  S5-6 가 실데이터 질의셋으로 A/B 정답률 측정·진산 보고.
- **판정: ⏸️ S5-6 진입 시 측정** (본 게이트는 S5-6 종료 조건).

## G-S6 — Graceful 검색 무중단 (기계 비교)

- 입력 ①: graph-walk 시드 0건 (Stage 2 후 approved 0건).
  - 기대: 200 + `graphExpansion.applied=false`,`reason='no_approved_seed'`
    - baseline 결과 반환 (검색 무중단, silent 실패 아님).
  - 실측: `graph-search-route.test.ts` "G-S6 Graceful" PASS.
- 입력 ②: graph-walk / user-search 내부 실패.
  - 기대: 빈 결과로 삼키지 않고 `GraphWalkError`/`UserSearchError` 전파
    → 5xx + 구조화 로깅 (CLAUDE.md 빈 catch 금지).
  - 실측: 라우트 catch 가 두 에러 타입 분기 + logger.error + 상태코드
    매핑(400/500/504), `throw err` 미지정 에러 전파. graph-walk golden
    "D1 실행 실패 → GraphWalkError(query) 전파" PASS.
- 입력 ③: 기존 `/api/search` Multi-Path Fallback 경로.
  - 기대: 불변 (옵션 C = 독립 엔드포인트, 회귀 표면 0).
  - 실측: `routes.ts` 핸들러 `/` 로직 불변(주석만 stale 정정), routes
    테스트 전건 PASS.
- **판정: ✅ PASS** (graceful 200 + fail-loud 전파 + 정상 경로 불변).

---

## 종합

S5-2/S5-3 구현분에 대한 Binary Gate 5/6 PASS, G-S5 는 plan 분해상 S5-6
산출. **회귀 0 (G-S1)·실 D1 budget 내(G-S2)·결정성(G-S3)·단일 진실원
(G-S4)·무중단(G-S6) 전부 기계 판정 통과.** 다음: S5-5 4-Pass 독립 에이전트

- 5-페르소나 리뷰(CRITICAL 0건) → S5-6 G-S5 baseline 측정.
