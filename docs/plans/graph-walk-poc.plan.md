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

## 6. 진산 승인 체크포인트

- [ ] PoC 범위 축소(검색 통합 제외, 엔진 단독)에 동의?
- [ ] PITR 옵션 A(`WITH RECURSIVE`) 1순위 채택에 동의?
- [ ] Binary Gate G1~G6 기준에 동의 (특히 G5 CPU budget 값 / G4 결과 cap 값은
      S1에서 진산과 확정)?
- [ ] S0 승인 시 다음 Session Block에서 S1 진입?

> **본 plan은 실행 계획이지 실행이 아니다. 진산 승인(S0) 전 코드 0줄.**
