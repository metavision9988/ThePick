# S5-6 선결 CO6-1~CO6-4 — 4-Pass 통합 독립 리뷰

- **세션:** 088 (2026-05-15)
- **대상:** S5-6 착수 선결 의무 — `review-20260515-202957-graph-walk-s5-2-s5-3.md`
  §4 carry-over 원장 **CO6-1 / CO6-2 / CO6-3 / CO6-4(a~e)** 구현
- **리뷰 방식:** 독립 에이전트 **3개** (자가 리뷰 0). Pass1
  silent-failure-hunter / Pass2 system-architect / Pass3+4 code-reviewer.
  전 에이전트 코드 미작성 컨텍스트 + 증거(파일:라인) + Devil's Advocate.
- **realcode 게이트:** 외부/에이전트 지적 채택 전 실코드 대조
  (memory feedback_cycle_closure_realcode_gate). Pass2 핵심질문(CO6-1 동치)을
  approved-nodes-sql.ts 단일 진실원으로 입증.

---

## 1. 변경 요약

| 항목  | 내용                                                                                                                                                                              | 파일                                                                   |
| :---- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| CO6-1 | graph-walk approved CTE projection 에 `kn.description` 동봉 → graph-search-route 잉여 2차 fetchApprovedNodes 제거 (subrequest -1). graph-walk 노드를 `NodeHitSource` 로 직접 매핑 | graph-walk/index.ts, user-search.ts, graph-search-route.ts             |
| CO6-2 | `GraphExpansionMeta.truncated` surface — 다중 시드 OR 집계 (`anyTruncated`). silent 절단 차단                                                                                     | graph-search-route.ts                                                  |
| CO6-3 | 성공 경로 `logger.info('graph_search_ok',{applied,reason,seedWalkCount,expandedNodeCount,truncated,elapsedMs})` + 실패 경로 3곳 elapsedMs 대칭                                    | graph-search-route.ts                                                  |
| CO6-4 | (a) baseline∩expanded 충돌 baseline 우선 (b) score-0 tie (c) mid-loop fail-loud 결정+pin (d) 비교자 골든 (e) buildHit `Number.isFinite` 가드 (`?? 0` NaN 미차단 보강)             | ranking-core.test.ts(신규), graph-search-route.test.ts, user-search.ts |

---

## 2. 판정 요약

| Pass            | CRITICAL | MAJOR | 처리                                                |
| :-------------- | :------: | :---: | :-------------------------------------------------- |
| Pass1 Surgeon   |    0     |   0   | Minor 2 (per-seed trunc 측정해석 / catch elapsedMs) |
| Pass2 Architect |    0     | **1** | **MAJOR-1 즉시 해소** (헤더/주석 stale 정정)        |
| Pass3 Advocate  |    0     |   0   | Minor 1 (truncated per-seed count)                  |
| Pass4 Contract  |    0     |   0   | CO6 원장 1:1 정확 대응 / 초과구현 0                 |

→ **realcode 게이트 후 진성 behavioral CRITICAL = 0.** MAJOR-1 즉시 해소
(auto-review-protocol "Critical/Major 즉시 수정"). Pass2 Devil's Advocate
(측정 무결성 직결)도 구조적 해소.

---

## 3. 즉시 수정 반영 (4건, 본 세션 커밋 대상)

| #   | 출처                   | 내용                                                                                                                                                                                   | 파일                  |
| :-- | :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| F1  | Pass2 MAJOR-1          | 모듈 헤더 파이프라인 step 3 + line ~329 주석 stale 정정 (`fetchApprovedNodes` → graph-walk projection 직접 매핑·2차 조회 없음)                                                         | graph-search-route.ts |
| F2  | Pass2 Devil's Advocate | 최종 SELECT `description` 을 GROUP BY key → `MIN(a3.description)` 집계 (id=PK 그룹이라 값 동일=동치, 긴 법령 본문 group-key 비교 CPU 제거 → D-2 free 마진 잠식 차단, 측정 무결성 직결) | graph-walk/index.ts   |
| F3  | Pass1 Minor-2          | 실패 경로 3곳(`graph_search_walk_failed`/`_baseline_failed`/`_unhandled`) 에 `elapsedMs` 추가 (CO6-3 관측 성공/실패 대칭 — 느린 실패 S5-6 측정 무결성)                                 | graph-search-route.ts |
| F4  | Pass3/4 Minor-2        | ranking-core NaN 반증 테스트의 tautological `toContain` → `Number.isNaN(cmp)===true` 비-tautological 단언 (비교자 NaN 반환=가드 필요 사실 입증)                                        | ranking-core.test.ts  |

검증: `pnpm --filter @thepick/api typecheck`/`lint` 클린 +
`test` **621 passed | 2 skipped (40 files)** — 직전 S5-5 609 → 신규 12
(ranking-core 8 + graph-search-route +4) 만 증가, 회귀 0.

---

## 4. realcode 게이트 — CO6-1 동작 동치 입증 (Pass2 핵심질문)

**Pass2 판정:** CO6-1 "2차 조회 제거" 는 동작 동치 + **TOCTOU 윈도우 제거(개선)**.

- graph-walk `approved` CTE 와 구 `fetchApprovedNodes` 는 **둘 다**
  `APPROVED_NODES_STATUS_CORE`(approved-nodes-sql.ts:44, 단일 진실원) 공유 →
  approved 판정 기준 물리적 동일. flagged/review/draft 격리 계약 단일 fetch 로
  완전 보장.
- 구 2-fetch 는 시드 walk(T1)·응답직전 재조회(T2) 사이 status 전이 시
  `expandedNodeCount` 과대보고하던 split-window 잠재 결함 보유. 신 1-fetch 는
  단일 T1 스냅샷 → 윈도우 소멸, count 정확. **동치를 넘어 일관성 강화.**

---

## 5. Minor 원장 (보고만 — S5-6 측정 설계 반영)

- **m-1 (Pass1/3 공통):** `truncated` 는 5-seed OR 집계 — "5중 1 절단" vs
  "5중 5 절단" 응답만으로 미구분. CO6-2 원장은 boolean surface 만 요구(계약
  충족). S5-6 측정 harness 가 절단 표본을 별도 집계 권고.
- **m-2 (Pass2 MINOR-1):** F2 로 GROUP BY 폭 잠식은 구조 해소했으나, D-2
  (measurement.md §3.1 depth4=41.5ms) 는 5-컬럼 측정값. S5-6 실 D1 측정 시
  `description`-포함 projection 1회 재측정 → measurement.md §3.1 각주 갱신
  (게이트 재판정 아닌 전제 동기화). **S5-6 in-scope.**
- **m-3 (Pass2 MINOR-2):** `GraphSearchResponse.graphExpansion` 은 S5-6
  측정 계약 — 임의 필드 제거 금지를 plan 에 명시 권고(문서 차원).

---

## 6. 종합 판정

**CO6 선결 완료 가능.** 독립 3 에이전트 4-Pass 결과 realcode 게이트 후
behavioral CRITICAL 0, MAJOR 1(즉시 해소), Pass4 CO6-1~4(a~e) 원장 1:1
정확 대응 + 초과구현(S5-7/CO7/A 통합) 0건 + `/api/search` 정상경로 불변
입증(typecheck 클린 + git status). 회귀 0(621 PASS). CO6 = baseline
신뢰성 전제 충족 → **G-S5 측정(S5-6 본체)은 실데이터·remote D1 게이트
의존** (§7).

---

## 7. S5-6 본체 측정 — 진산 게이트 (RULE #5 불가능+대안)

CO6(선결, 코드 무결성)은 자율 완료. **G-S5 "Vector-only 대비 multi-hop
정답률 측정값 보고" 는 다음 2 입력이 모두 진산 통제 영역:**

1. **실데이터 baseline 평가셋** — repo 내 eval harness/golden Q→expected-node
   셋 **미존재** (apps 전수 검색 0건; `phase2-eval-mvp.plan.md` 는 계획만,
   평가셋 미materialize). plan §5 "multi-hop 정답률 baseline 셋은 실
   production 데이터 기반 — 진산 인증 세션에서 시드 노드 실재 확인 동반".
2. **remote production D1 + Vectorize 실행** — plan §6-A CO-1/CO-2 인증
   게이트와 동일 클래스. memory: Cloudflare/D1/Anthropic 토큰 회피 의무.

→ 측정을 자율 fabricate 하지 않는다(CRITICAL RULE #4/#5). 진산 결재 옵션은
본 세션 종료 보고 + handoff 에 상신.
