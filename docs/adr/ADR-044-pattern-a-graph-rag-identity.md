# ADR-044: Pattern A (D1 native KG + Vectorize) Graph RAG 정체성 공식 입장

- **상태:** Accepted
- **결정일:** 2026-05-15 (G-AUDIT Round 2.5 메타 도전 응답, 진산 결재-5)
- **결정자:** Claude Opus 4.7 (실코드 검증) + 외부 메타 검토 세션 3-Layer 합의 + 진산 (결재)
- **관련 영역:** Graph RAG 아키텍처 정체성 / 외부 검토 (b)해석 재발 차단
- **경량 ADR** — 1페이지 결정 영속 (외부 검토서 §5 결재-5 권고: "경량 1페이지로 충분")

---

## 맥락 (Context)

G-AUDIT 외부 검토 Round 2에서 Review C(MEPHISTO)가 본 프로젝트 Graph RAG를
_"이름만 Graph DB 흉내를 낸 단순 RDB + Vector 검색"_ 으로 표현. 두 가지 해석이
가능했다:

- **(a)** "*현재 상태*가 Vector RAG에 머물러 있다"
- **(b)** "*Pattern A 자체*가 무늬만 Graph RAG다"

실코드 검증(`docs/Graph_RAG+Graph_Walk/REMEDIATION 타당성 검증 — Claude Code
실코드 대조 v1.0.md` §2 CRIT-4) 결과:

- `knowledge_nodes`(794) + `knowledge_edges`(~1274) + Vectorize(1024d cosine)는
  production D1에 실재 적재됨 (Pattern A의 구조적 요건 충족)
- 그러나 런타임 검색 경로(`apps/api/src/search/user-search.ts:198-285`)가
  엣지를 순회하지 않음 — 단일 노드 벡터 조회 + Truth Weight 재정렬에 그침

## 결정 (Decision)

1. **해석 (a)가 정확, (b)는 부정확** — 3-Layer(Claude Code 실검증 + 외부
   Review B + Review C) 합의로 확정.

2. **Pattern A (D1 native KG + Vectorize)는 학술적으로 유효한 GraphRAG 형태로
   공식 인정한다.** D1을 엔티티/관계 저장소로, Vectorize를 시맨틱 인덱스로
   쓰는 구성은 외부 Graph DB 벤더 없이 GraphRAG를 구현하는 정당한 패턴이며,
   Cloudflare 단일 벤더 원칙(ADR-022)과 정합한다. "무늬만 Graph RAG"가 아니다.

3. **현재가 사실상 Vector RAG인 원인은 Pattern A 결함이 아니라 Graph walk
   미구현이다.** 해법은 패턴 교체가 아니라 **knowledge_edges N-hop 순회
   런타임 추가**(ADR-045)이며, 적재된 ~1274 엣지가 그 즉시 활용 가능한
   기반이다.

4. **본 ADR을 외부 검토 (b)해석 재발 차단용 anchor로 영속한다.** 향후 감사/
   리뷰가 (b)로 재해석하면 본 ADR §결정 1~3을 인용해 즉시 정정한다.

## 결과 (Consequences)

- ✅ Pattern A 정체성 논쟁 종결 — 향후 외부 검토 (b)해석 자동 차단
- ✅ 처리 방향 명확화 — "패턴 교체"가 아니라 "Graph walk 추가"(ADR-045)
- ⚠️ 본 ADR은 정체성 입장만 확정. Graph walk 실구현 검증은 ADR-045 + L3 plan
  승인 후 진행 (본 ADR이 구현을 승인하는 것은 아님)

## 대안 (Rejected Alternatives)

- **외부 Graph DB(Neo4j/Memgraph) 도입**: ADR-022 단일 벤더 5년 lock 위배.
  Pattern A가 유효하므로 불요. 기각.
- **(b) 수용 후 아키텍처 재설계**: 실코드 검증상 (b)는 거짓 전제. 기각.

## 관련 (Related)

- `docs/Graph_RAG+Graph_Walk/REMEDIATION 타당성 검증 — Claude Code 실코드 대조 v1.0.md` §2 CRIT-4, §6 결재-5
- ADR-045 (Graph walk N-hop 순회 도입 — 본 ADR §결정 3의 처방)
- ADR-022 (Cloudflare 단일 벤더 lock — Pattern A 정합 근거)
