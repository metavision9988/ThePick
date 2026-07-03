# 독립 리뷰 — gap-P3 (개정 2차 B-항목 4)

- **대상**: `docs/batch-load/gap-P3/` (insert.sql 4노드 CONCEPT-219~222 + 4엣지 / knowledge-graph.json / review-sheet)
- **방식**: 신선 독립 에이전트 1 (산출 맥락 무지, 적대 반증). PDF 원문(`4월10일_26년2차2과목_변경사항정리.pdf` 12쪽) 직접 재추출(pdfplumber) → PDF→노드 방향 대조. 자가 리뷰 아님(헌법 규칙0).
- **실행**: 2026-07-03, Opus 4.8 세션. 플레이북 §4.
- **판정: 콘텐츠·수치 CRITICAL 0 (Hard Stop 전건 PASS) / 구조 MAJOR 2건 → 전건 수정 반영 후 완료.**

## 콘텐츠·수치 (Hard Stop) — 전건 PASS

- **G-GAP-3 원문충실 (4노드 전수)**: CONCEPT-219(3b 착과수조사 시기)·220(3c 과수4종 수확량조사)·221(4b 무화과 시기)·222(5d 표본구간 면적표) 전부 PDF 원문과 의미 일치, hallucination 0.
- **G-GAP-4 수치 전수**: 100개·1주·3주·2m미만/이상·5주·6주·10주·4주·8주(1m)·20cm×20cm·0.04㎡·1㎡ — 전건 문자 일치, 불일치 0.
- **G-GAP-1 위음성/오귀속**: inventory ❌ 4건(686·687·692·698) ↔ CONCEPT-219~222 1:1. 5d(표본구간 면적)를 5e(감자 병충해 20%→10%, 기존 CONCEPT-171)와 혼동 안 함. 오귀속 0.
- **G-GAP-2/5/6**: production 충돌 0, CONCEPT-178 META 실재, draft 4/4, 행수 4·4, gate_check 재실행 PASS.

## 자체 게이트가 못 잡은 구조 MAJOR 2건 → 수정 완료

- **MAJOR-1 (엣지 방향/타입 관례 위반)**: 기존 개정 축 25노드(CONCEPT-179~203)는 전부 `CONCEPT-178 --PREREQUISITE--> child`(META→자식, outbound). P3 초안은 `자식 --DEPENDS_ON--> 178` 역방향·다른 타입 → META(178) outbound 워크로 개정 항목 열거 시 신규 4노드 누락(발견성 결함, 자기부정: P3가 채운 누락분이 개정 축 탐색에서 재누락). 끊긴 엣지·고아 아님(G-GAP-7 통과)이나 Graph RAG 실질 결함. gate_check 는 타입/방향 미검사 = 자체 게이트 사각. **수정**: production 25노드 관례 실측 확증(178 outbound PREREQUISITE 25 / inbound 1) 후 4엣지를 `CONCEPT-178 →PREREQUISITE→ CONCEPT-219~222` 로 교체 + gate_check G-GAP-7 을 "from OR to" 로 갱신.
- **MAJOR-2 (JSON \_meta P1 오염)**: `build_gap_json.py` \_meta 가 P1 복붙 미갱신 — description "법령 조문 22"·source_pdf 법령 3종·id_range "LAW-144~165"·approval "A안 법률 제8·11조"·derivation "gap-P1-insert.sql". 전부 P3 무관, node_count(4)만 갱신되어 내부 모순. 적재 SQL 무영향이나 출처추적 1급 기능 시스템에서 감사이력 거짓. **수정**: \_meta 를 P3 실제값(source=한종찬 개정 PDF·id_range CONCEPT-219~222·edge_intent PREREQUISITE·escalate_note)으로 정정 후 JSON 재생성(전사 드리프트 0 재확인).

## MINOR

- CONCEPT-221(무화과 4b) truth_weight 10→**9** (직접 형제 CONCEPT-186 오디·복분자 조사시기 = 9 정합). 수정.
- CONCEPT-220 약어 전개("평/수/미"→"평년수확량/수확량/미보상감수량", "MAX(평수,착과량)"→전개) + OCR 오타 정정("자연재새성"→"자연재해성") = 도메인 정확·학습자 친화 = **유지**(의도적 편집, hallucination 아님).

## 교재 본체 중복 (E-1, 진산 판정용)

독립 리뷰 표본 평가: 본체에 동일 토픽(표본구간·무화과 경과비율 등)은 있으나 **동일 CONTENT는 표본 미발견** — 본체는 계산 메커니즘, P3는 조사시기·품목별 이랑 주수(세부). 순수 중복보다 상보적, 개정 아티팩트(변경전/후) 학습 가치 별도. 유지 vs REJECT vs 본체 CROSS_REF = RULE #5 진산 몫.

## Devil's Advocate

개정 META(CONCEPT-178) 진입점 outbound 워크 "26년 2차 개정 항목 보여줘" 실행 시, 초안대로면 CONCEPT-219~222만 조용히 누락(MAJOR-1 실증). → 수정으로 해소(4노드가 META 워크에 편입).

## 재검증 (수정 후)

- `gate_check.py`: ✅ ALL LOCAL GATES PASS (edge type PREREQUISITE). `build_gap_json.py` self-check: 4/4.
- 엣지 방향 178→자식 PREREQUISITE 확인, \_meta id_range=CONCEPT-219~222, CONCEPT-221 tw=9.
