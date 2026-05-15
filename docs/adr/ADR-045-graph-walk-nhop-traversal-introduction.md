# ADR-045: Graph walk (knowledge_edges N-hop 순회) 런타임 도입 — T1 격상

- **상태:** Accepted / **S0 진산 승인 2026-05-15** / PoC S1~S4 완료 (엔진 단독). S5 검색 라우터 통합은 별도 결재 (4-Pass carry-over 3건 선결)
- **결정일:** 2026-05-15 (G-AUDIT Round 2.5, 진산 결재-3) / S0 plan 승인 2026-05-15 ("승인 진행해줘")
- **결정자:** Claude Opus 4.7 (실코드 검증 CRIT-4 확증) + 외부 3-Layer 합의 (T1 즉시 권고) + 진산 (T1 격상 결재)
- **관련 영역:** ★ **L3 코어 엔진** (Graph RAG = 프로젝트 북극성) — `apps/api/src/search/`, `migrations/`
- **선결 조건:** `docs/plans/graph-walk-poc.plan.md` 진산 승인 (L3 게이트, 본 ADR은 코딩을 승인하지 않음)

---

## 맥락 (Context)

REMEDIATION 타당성 검증(`docs/Graph_RAG+Graph_Walk/REMEDIATION 타당성 검증 —
Claude Code 실코드 대조 v1.0.md` §2 CRIT-4)에서 독립 에이전트 전수 grep 결과:

- `WITH RECURSIVE` SQL CTE: 코드베이스 전체 **0건**
- 검색 경로 4파일에 `knowledge_edges`/`from_node`/`to_node` **0건**
- `knowledge_edges`(~1274 적재) 실 용도 = BATCH INSERT + 무결성 검증 + SUPERSEDES
  1-hop 트리거뿐. **검색·추론 런타임에서 엣지 순회 코드 전무**

→ 외부 검토 5 CRIT 중 거짓 전제 2건(CRIT-2/3) 제거 후 **유일하게 정확히
짚은 진짜 핵심 위험**. 자격시험 도메인 핵심 가치(multi-hop 추론·연계성)가
작동하지 않음. 학술 근거(외부 리뷰 인용): multi-hop GraphRAG 87% vs Vector
RAG 23% 정답률.

## 결정 (Decision)

1. **Graph walk(knowledge_edges N-hop 순회)를 T1(다음 Session Block)로
   격상한다.** Step 3-UX-7b distractor BATCH보다 우선 — distractor는 기존
   Vector RAG 위에서도 가능하나 Graph walk는 Graph RAG 정체성(ADR-044 §3)의
   핵심.

2. **긍정적 반전 활용**: CRIT-3 거짓 전제 무효화로 ~1274 엣지가 production에
   이미 적재 완료 → PoC를 **실데이터 위에서 즉시 검증** 가능. 콘텐츠 적재
   대기 없음.

3. **구현 전 L3 게이트 의무**: `docs/plans/graph-walk-poc.plan.md` 작성 →
   진산 승인 → 코딩. 본 ADR은 *방향*만 확정하며 _구현을 승인하지 않는다_.

4. **기술 방향(PITR carry-over)**: D1 `WITH RECURSIVE` CTE 기반 깊이 제한
   순회(외부 Review C 권고 C-2)를 1순위 후보로 plan에서 비교 검토. math.js/
   동적 코드 실행 무관(검색 경로, Formula Engine 불변).

## 결과 (Consequences)

- ✅ 진짜 핵심 위험 처리 진입 — Vector RAG → Graph RAG 정체성 회복 경로 확정
- ✅ 실데이터 PoC 즉시 가능 (적재 대기 0)
- ⚠️ L3 영역 — plan 미승인 시 코딩 차단 (Hook 강제). 본 ADR은 코딩 허가 아님
- ⚠️ Workers CPU 제약: N-hop 재귀 CTE의 깊이/팬아웃 상한이 plan 필수 검토 항목
  (50ms free / 30s paid — 무제한 순회 시 타임아웃)

## 관련 (Related)

- `docs/Graph_RAG+Graph_Walk/REMEDIATION 타당성 검증 — Claude Code 실코드 대조 v1.0.md` §2 CRIT-4, §5 T1, §6 결재-3
- `docs/plans/graph-walk-poc.plan.md` (L3 plan — 진산 승인 게이트)
- ADR-044 (Pattern A 정체성 — 본 ADR은 그 §결정 3의 처방)
