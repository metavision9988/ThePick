# L3 PLAN — Graph walk (knowledge_edges N-hop 순회) PoC

- **DEFCON:** L3 (코어 엔진 = Graph RAG 북극성) — 본 plan **진산 승인 후에만** 코딩
- **근거 ADR:** ADR-045 (방향 결정) / ADR-044 (Pattern A 정체성)
- **검증 근거:** `docs/Graph_RAG+Graph_Walk/REMEDIATION 타당성 검증 — Claude Code 실코드 대조 v1.0.md` §2 CRIT-4
- **상태:** ⏸️ 진산 승인 대기 (본 문서는 실행 계획이지 실행이 아님)

---

## 0. Reality Anchor — 이것이 불가능/위험할 이유 3가지 (먼저)

1. **Workers CPU 상한**: 재귀 CTE 무제한 순회는 50ms(free)/30s(paid) 초과로
   런타임 사망. → 깊이·팬아웃 hard cap 없이는 불가.
2. **그래프 폭발**: ~1274 엣지에서 고차수 노드(허브) 경유 시 N-hop 결과가
   기하급수. → 결과 상한 + 가지치기 없이는 응답 품질·지연 동시 붕괴.
3. **엣지 의미 혼재**: SUPERSEDES(시간) / SHARED_WITH / DEPENDS_ON /
   CROSS_REF 가 한 테이블에 공존. 무차별 순회 시 폐기 노드(is_current_active=0)
   나 부적절 관계를 추론에 주입 → 정확성 사망(북극성 위배).

→ 결론: "그냥 재귀 쿼리 추가"는 불가. **edge_type 화이트리스트 + 깊이 cap +
결과 cap + is_current_active 필터**가 동시에 없으면 PoC도 진행 금지.

---

## 1. 목표 (PoC 범위 — 의도적 축소)

- **IN**: 단일 시드 노드에서 edge_type 화이트리스트를 따라 **깊이 ≤2 hop**
  순회, is_current_active=1 + approved 필터, 결과 ≤ N개 반환하는 **읽기 전용
  순회 함수 1개** + golden 테스트.
- **OUT (PoC 제외, 후속)**: 검색 라우터 통합, 인과 DAG 추론, 가중 경로
  스코어링, 사용자 노출 UI. PoC는 *엔진 단독 검증*까지만 (Engine-First).

## 2. PITR — 기술 선택지 비교 (코딩 전 결정)

| 옵션                                | 방식                     | 장점                                               | 단점                                            | 판정                                 |
| :---------------------------------- | :----------------------- | :------------------------------------------------- | :---------------------------------------------- | :----------------------------------- |
| **A. D1 `WITH RECURSIVE` CTE**      | SQL 한 쿼리로 N-hop      | 1 round-trip, D1 네이티브, 깊이 cap을 CTE에서 강제 | SQLite CTE 디버깅 난이도, 팬아웃 제어를 SQL로   | ★ **1순위 후보** (Review C C-2 정합) |
| B. 앱 레벨 반복 BFS (N회 D1 쿼리)   | 코드에서 hop마다 IN 쿼리 | 가지치기 로직 유연                                 | D1 round-trip N회 → 지연·CPU↑                   | 2순위 (A 실패 시)                    |
| C. 사전 계산 인접 materialized view | 적재 시 N-hop 펼침 저장  | 런타임 0 순회                                      | 저장 폭발 + 개정 시 재계산, Temporal Graph 위배 | 기각                                 |

→ **A 채택 권고.** B는 A가 Workers CPU 초과 시 폴백. C는 ADR-002 Temporal
Graph(INSERT+SUPERSEDES) 정합 위배로 기각.

## 3. Binary Gates (완료 판정 — "잘 됨" 금지)

| Gate                      | 입력                              | 기대 출력                       | 판정        |
| :------------------------ | :-------------------------------- | :------------------------------ | :---------- |
| G1 깊이 cap               | depth=2 요청, 3-hop 데이터        | 3-hop 노드 **미포함**           | 기계 비교   |
| G2 폐기 노드 차단         | is_current_active=0 노드가 경로상 | 결과에서 **제외**               | 기계 비교   |
| G3 edge_type 화이트리스트 | SUPERSEDES 엣지만 연결된 시드     | 화이트리스트 외 edge **미순회** | 기계 비교   |
| G4 결과 cap               | 팬아웃 큰 허브 시드               | 결과 ≤ N (cap값)                | count 비교  |
| G5 CPU 예산               | 최악 시드(허브, depth=2)          | 실행 < 정한 ms budget           | 측정값      |
| G6 golden                 | 고정 시드 셋                      | 사전 작성 golden 결과 100% 일치 | golden test |

→ G1~G6 **전부 PASS**여야 PoC "완료". 1건이라도 실패 = 미완.

## 4. Step 분해 (승인 후 실행 순서)

1. **S0 (승인 게이트)**: 본 plan 진산 승인 — ★ 미승인 시 S1 이하 전면 차단
2. **S1**: golden 시드 셋 + 기대 결과 작성 (실 production 데이터 샘플 기반,
   라이브 D1 read-only 쿼리 1회로 시드 노드 실재 확인 — 진산 Cloudflare 인증
   필요 시 위임)
3. **S2**: 옵션 A `WITH RECURSIVE` CTE 순회 함수 단독 구현 (`apps/api/src/
search/` 신규 모듈, 기존 경로 **미변경** — Engine-First 격리)
4. **S3**: G1~G6 Binary Gate 테스트 작성 + 실행. 전 PASS까지 S2 반복
5. **S4**: 4-Pass 독립 에이전트 리뷰 (L3 의무) + 결과 영속
6. **S5**: 진산에 PoC 결과 보고 (multi-hop 정답률 baseline 동반) → 검색
   라우터 통합 여부 **별도 결재** (PoC ≠ 통합)

## 5. 잔존 위험 / 트레이드오프

- PoC 성공해도 검색 통합은 별도 L3 결재 — 본 plan은 통합 미포함
- 라이브 D1 시드 확인은 Cloudflare 인증(진산 통제) 필요 — 미가용 시 적재
  기록(batch-loadmap) 기반 시드로 진행하되 그 한계 명시
- Workers CPU budget 측정값이 free tier 초과 시 paid 전제 or 옵션 B 폴백 —
  S3에서 판정, 진산 보고

### 5.1 4-Pass 독립 리뷰 carry-over (S5 검색 라우터 통합 결재 선결 조건)

PoC S4 4-Pass 독립 3-에이전트 리뷰 결과. CRITICAL C-1(재귀 CTE 경로
폭발)은 **본 PoC에서 수정 + 회귀 게이트로 입증 완료**(`(node_id,depth)`
UNION dedup, 프론티어 ≤ N×(maxDepth+1)). 잔여는 S5 통합 전 선결:

- **CO-1**: 실 Cloudflare D1 + Workers 환경에서 `WITH RECURSIVE` + maxDepth=
  MAX_ALLOWED_DEPTH + 최고차수 실시드 CPU 실측 (PoC 는 in-memory node:sqlite —
  실 budget 미검증. G5/회귀 게이트는 "구조적 bounded 입증"까지)
- **CO-2**: `ORDER BY depth, id` 결정성이 실 D1 collation + 한글/혼합 ID 에서
  node:sqlite 와 동일한지 라이브 1회 대조 (golden 은 node:sqlite 결정성만 증명)
- **CO-3**: truncated 시 노드 보존 정책 — 현재 "가까운 hop 우선(ORDER BY)".
  RAG 주입 시 truth_weight 가중 보존으로 재검토
- **CO-4**: approved 판정 진실원 — graph-walk 는 user-search.ts:432-445 와
  동일 `status_transitions` 경로 (NEW drift 0). 통합 시 단일 진실원 재확인

## 6. 진산 승인 체크포인트 — S0 승인 완료 (2026-05-15)

- [x] PoC 범위 축소(검색 통합 제외, 엔진 단독)에 동의 — 진산 "승인 진행해줘"
- [x] PITR 옵션 A(`WITH RECURSIVE`) 1순위 채택에 동의
- [x] Binary Gate G1~G6 기준에 동의 (G4 resultCap 기본 50 / G5 in-memory
      sane-bound 250ms — 실 Workers budget 은 CO-1 로 carry-over)
- [x] S0 승인 → S1~S4 완료. **S5 통합은 §5.1 CO-1~4 선결 후 별도 결재**

### 진행 기록

- S0 ✅ 진산 승인 (2026-05-15)
- S1~S3 ✅ golden 시드 + 옵션 A 구현 + Binary Gate **21 PASS** (typecheck/lint clean)
- S4 ✅ 4-Pass 독립 3-에이전트 — CRITICAL C-1 발견 → 본 PoC 내 수정 + 회귀
  게이트 입증. 잔여 §5.1 CO-1~4 = S5 선결
- S5 ⏸️ 검색 라우터 통합 — **별도 진산 결재**. S5 L3 plan 작성 완료
  (`docs/plans/graph-walk-s5-integration.plan.md`, Session 086):
  CO-4 ✅ 해소(진실원 동일 코드 대조, drift 0) / CO-3 ✅ 해소(정책 권고:
  graph-walk 최종 랭킹 미결정, 기존 Stage 3 단일 진실원) / CO-1·CO-2 ⏸️
  Cloudflare 인증 게이트로 승격 → S5 plan §6 진산 결재 대기

> **본 plan §1 OUT(검색 통합)은 미진입. 엔진 단독 PoC 까지만 완료.**
