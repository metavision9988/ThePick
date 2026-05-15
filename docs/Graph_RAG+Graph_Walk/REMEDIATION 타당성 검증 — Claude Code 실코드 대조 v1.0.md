# 🔬 REMEDIATION PROMPT 타당성 검증 — Claude Code 실코드 대조 v1.0

> **용도**: `PROJECT REMEDIATION PROMPT v1.0.md`를 실행(처리 계획 작성)하기 **전에**, 그 입력 전제(외부 Review B+C 합집합)가 실제 구현 상태와 일치하는지 검증
> **방법**: 독립 read-only 조사 에이전트 3개 병렬 + 메인 세션 핵심 파일 직접 교차확인
> **상태**: ★ **피드백 게이트** — 본 문서는 진산 피드백 후 REMEDIATION 처리 계획 진입 여부를 판정하기 위한 것. 처리 계획 자체가 아님.
> **작성**: 2026-05-15 / git HEAD `f03c518` (검증 대상 코드 `1f34b0d`)

---

## 0. 한 줄 결론

**REMEDIATION PROMPT의 "절대적 위험 CRIT 합의 5건" 중 2건(CRIT-합의-2, CRIT-합의-3)은 사실과 배치되는 거짓 전제 위에 서 있다. 단일 근본 원인은 한 달째 stale인 `CLAUDE.md` "Phase 0 착수 대기"이며, 이것이 내 G-AUDIT 보고서의 오판을 유발 → 외부 Review B+C(코드 미열람) → REMEDIATION CRIT 합의로 연쇄 전파됐다. 진짜 핵심 위험은 CRIT-1(문서 드리프트=오염원 그 자체)·CRIT-4(Graph walk 실제 부재)·CRIT-5(L3 부분 부재) 3건이다.**

---

## 1. 검증 방법론

| 조사            | 범위                                                                        | 산출                                    |
| :-------------- | :-------------------------------------------------------------------------- | :-------------------------------------- |
| 독립 에이전트 ① | Graph walk / multi-hop traversal 실재 전수 grep                             | CRIT-합의-4 진위                        |
| 독립 에이전트 ② | L3 cross-validation / Cost cap / Adaptive Router 실재                       | CRIT-합의-5, B-1, B-2 진위              |
| 독립 에이전트 ③ | BATCH 적재 상태 / vectorCount / Golden Artifact / 문서 드리프트 / 테이블 수 | CRIT-합의-1·2·3, C-4 진위               |
| 메인 직접 교차  | `batch-loadmap.md`, `handoff-069`, `CLAUDE.md` git log 재확인               | 에이전트 보고의 CRIT-뒤집기 근거 재검증 |

자기 확인 편향 차단: 코드 작성 맥락 없는 독립 에이전트 위임 + CRIT을 뒤집는 단일 사실은 메인 세션이 원본 파일을 직접 재확인 (auto-review-protocol 규칙 0 정합).

---

## 2. CRIT 합의 5건 — 전제별 타당성 판정

### CRIT-합의-1: Foundation Drift (CLAUDE.md ↔ WBS) → ✅ **타당 (확정 사실)**

- `CLAUDE.md:90` "Phase 0 착수 대기 (DB 스키마 + PWA 셸부터)"
- 이 파일 마지막 수정: `git log -1 -- CLAUDE.md` → `c3e1bb9 2026-04-16 10:52:18` — **약 1개월 미갱신**
- `.jjokjipge/wbs-quality-progress.md:32` "현재 위치 | Phase 3 launch 직전 production deploy chain 종착 (Session 069)" / `:59` "Phase 0 ✅ + Phase 1 ✅ + Phase 2 ✅"
- **판정**: 두 문서 정면 모순 확정. CRIT 정당.
- **★ 추가 발견**: 본 드리프트는 단순 CRIT가 아니라 **CRIT-2·3 거짓 전제의 단일 근본 원인**(§4 상술). 우선순위 최상위.

### CRIT-합의-2: Phase 명명 인지 부정합 (인프라 vs 콘텐츠 0%) → 🔴 **거짓 전제 (부분 무효)**

- REMEDIATION 주장: "콘텐츠 기준 0%"
- 실측: `docs/plans/batch-loadmap.md:41~78` — BATCH-1~7 + BATCH-L1/L2(법령) + R1/R2(개정) 전부 **"staging+production 적재 완료"** (Session 041~045, 2026-05-03~06). `handoff-session-069.md:153` production D1 `knowledge_nodes : 794`.
- **판정**: "콘텐츠 0%"는 거짓. 콘텐츠 KG는 production D1에 794 노드/878+ 엣지/130+ 산식/91+ 상수 적재 완료. "인프라만 됐고 콘텐츠는 비었다"는 프레임 자체가 무너진다. 단 _"학습 효과 Level 3 역검증 / 런타임 RAG 응답 품질 평가"_ 는 미수행이라는 약화된 형태로만 잔존 (이는 CRIT-2가 아니라 별개 carry-over).

### CRIT-합의-3: BATCH-1 미진입 = Graph RAG 본질 미검증 → 🔴 **거짓 전제 (무효)**

- REMEDIATION 주장: "knowledge_nodes 0건, vectorCount 1277 = topic_cluster + smoke만"
- 실측:
  - `batch-loadmap.md:41` "BATCH-1 ... Session 041 staging+production 적재 완료 (2026-05-03) ... Level 1 production PASS (75/133/13/5 + orphan 0)"
  - `handoff-session-069.md:153` `knowledge_nodes : 794` / `:169-170` `vectorCount=1277`
  - 1277 구성 = 794 실 KG 임베딩 + 433 table micro-KG(ADR-032) + 50 topic_cluster. topic_cluster는 **3.9%**에 불과
- **판정**: CRIT-합의-3의 사실 전제 전체가 거짓. "Graph RAG 본질 미검증" 결론은 _"실데이터 위에서 검색 품질·multi-hop 평가가 미수행"_ 이라는 **다른 명제**로 재정의돼야 하며, 이는 CRIT-4(graph walk 부재)와 사실상 동일 사안.

### CRIT-합의-4: Graph walk 미구현 = 사실상 Vector RAG → ✅ **타당 (확정 사실, 진짜 핵심)**

독립 에이전트 ① 전수 검증 (반증 시도 포함):

- `WITH RECURSIVE` SQL CTE: `apps/api`·`migrations`·`apps/batch`·`packages` 전체 **0건**
- 정식 검색 경로 `apps/api/src/search/user-search.ts:198-285`: Vectorize 단일 질의 → `knowledge_nodes` flat ID 필터(JOIN 대상은 `status_transitions`, **`knowledge_edges` 아님**) → Truth Weight 정렬. 엣지 순회 없음
- Multi-Path Fallback 4파일(`multi-path-fallback/`, `keyword-fallback.ts`, `topic-cluster-router.ts`, `honest-refusal.ts`) 전체에 `knowledge_edges`/`from_node`/`to_node` **0건**
- `knowledge_edges` 실 용도 전수: (1) BATCH 적재 INSERT, (2) `packages/quality/graph-integrity.ts` 무결성 검증(고아/끊김/SUPERSEDES 순환 — 반환은 `Violation[]`만), (3) `migrations/0013,0014` SUPERSEDES **1-hop** 트리거. **검색·추천·추론 런타임에서 엣지 순회 코드 전무**
- **판정**: CRIT 정당. Review B의 MAJ→CRIT 격상도 정당. **이것이 외부 검토 전체에서 유일하게 정확히 짚은 핵심 위험.** knowledge_edges는 적재돼 있으나(878+ 엣지) 런타임이 따라가지 않음 = "그래프를 쌓아두고 안 쓰는 상태".

### CRIT-합의-5: L3 Cross-validation 부재 → 🟠 **부분 타당 (과장 — 정밀화 필요)**

독립 에이전트 ② 검증:

- **존재**: `apps/batch/src/qg2-validator.ts:110-137` 교재 예시값 ↔ Formula Engine 결과 Ground Truth 대조 (단 **결정론적 산식 한정**). `packages/parser/src/schema-validator.ts:798-829` 구조 정합 cross-check
- **부재**: LLM 생성 텍스트(개념/암기법/문제)에 대한 Self-Consistency·Critic LLM·다중 샘플 합의 — `packages/ai-adapter` grep 0건. `packages/study-material-generator/src/index.ts` = `export {};` 빈 stub
- **대체재**: 생성물 신뢰성은 `draft → approved` **인간 검수 게이트**로 통제 (`user-search.ts:404-445` approved 필터)
- **판정**: "완전 NO"는 과장(산식 golden test 누락 인지). 정확한 명제 = _"LLM 생성물 자동 의미 교차검증 계층 부재. Year 1은 인간 검수+산식 golden으로 대체. Year 2 자동화 진입 즉시 CRITICAL 승격"_. 현 위험도 = LOW, 잠재 위험도 = CRITICAL. REMEDIATION의 이 인식("Year1 작음 / Year2 CRIT")은 정확.

### CRIT 합의 5건 종합 매트릭스

| 항목                       | REMEDIATION 등급 | 실코드 검증                               |               재판정                |
| :------------------------- | :--------------: | :---------------------------------------- | :---------------------------------: |
| CRIT-1 문서 드리프트       |       CRIT       | CLAUDE.md 1개월 stale, WBS와 모순 확정    |    ✅ **CRIT (+근본원인 격상)**     |
| CRIT-2 인프라 vs 콘텐츠 0% |       CRIT       | 콘텐츠 794노드 production 적재 완료       |   🔴 **거짓 전제 → 무효/재정의**    |
| CRIT-3 BATCH-1 미진입      |       CRIT       | BATCH-1~7 적재 완료                       |       🔴 **거짓 전제 → 무효**       |
| CRIT-4 Graph walk 부재     |       CRIT       | 엣지 순회 코드 전무 확증                  |       ✅ **CRIT (진짜 핵심)**       |
| CRIT-5 L3 부재             |       CRIT       | 산식 golden 존재, LLM생성물 교차검증 부재 | 🟠 **MAJ(현재)/CRIT(Year2) 재분류** |

→ **5건 중 실제 유효 CRIT는 2건(1·4), 1건은 등급 재조정(5), 2건은 거짓 전제(2·3).**

---

## 3. 합집합 10건 (B-1~6, C-1~4) — 타당성 압축 판정

| #                                     | 외부 등급 | 실코드 검증                                                                                                                             |                               재판정                               |
| :------------------------------------ | :-------: | :-------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------: |
| B-1 Cost cap per-req/user 미명시      |    MAJ    | ADR-025는 per-BATCH-run 예산만. per-request/user USD cap = ADR·코드 0건. 사용자 경로는 IP 요청수 rate-limit만(`search/routes.ts:69-80`) |   ✅ **MAJ 타당** (단 Year1 런타임 Claude 미호출이라 실손해 LOW)   |
| B-2 Adaptive Router 부재              |    MAJ    | 질문유형 classifier 0건. graceful degradation cascade만(`multi-path-fallback/index.ts:51-99`)                                           |                          ✅ **MAJ 타당**                           |
| B-3 PII filter 대문자 정규화          |    MAJ    | G-AUDIT 자체 인용(MAJOR-3-1). 미재검증                                                                                                  |                ⚠️ **재확인 필요** (본 검증 범위 외)                |
| B-4 Year2 multi-tenant carry-over 4건 |    MAJ    | ADR-040 §8.3 잔존 확인(handoff-084)                                                                                                     |                 ✅ **MAJ 타당 (Year2 이연 정합)**                  |
| B-5 임시 ADR-034/5/6 deadline 미명시  |    MIN    | ADR-037 거버넌스 존재하나 deadline 값 [확인필요]                                                                                        |                          🟠 **MIN 타당**                           |
| B-6 WBS AGFP 예외 미명시              |    MIN    | WBS는 Session069 부분 sync 상태                                                                                                         |                          🟠 **MIN 타당**                           |
| C-1 수동 BATCH 비확장성               |     —     | BATCH-1~7 수동 완료 사실 = 작업량 곡선 실재. Year2 다시험 시 폭증                                                                       |                     ✅ **수용 (Year2 조건부)**                     |
| C-2 WITH RECURSIVE CTE walk 패턴      |     —     | D1은 recursive CTE 지원. CRIT-4 해법으로 유효                                                                                           |                     ✅ **수용 (CRIT-4 처방)**                      |
| C-3 Critic LLM 자체 검증기            |     —     | Workers AI 내 추가 벤더 없이 L3 구현 가능 (단일벤더 정합)                                                                               |                  ✅ **수용 (CRIT-5 처방, Year2)**                  |
| C-4 Golden Artifact 검증 스크립트     |    MIN    | `apps/batch/src/fixtures/batch-1-golden.json` + `batch1~5-golden.test.ts` **실재 확인**                                                 | 🟢 **자산 실재 → "[확인필요]" 해소. 검증 스크립트는 nice-to-have** |

---

## 4. ★ 근본 원인 분석 — 연쇄 오판의 단일 진앙

```
CLAUDE.md:90 "Phase 0 착수 대기" (2026-04-16 이후 미갱신, 한 달 stale)
        │
        ▼  내(G-AUDIT 작성자)가 루트 문서를 신뢰 → §"현재 상태" 오인
G-AUDIT 보고서 §8 "knowledge_nodes [확인필요]" + §12 핵심 정정 #2
   "핵심 지식그래프 KG는 미적재 — BATCH-1 진입 대기. vectorCount=topic_cluster/smoke"
        │  ← 이 "가장 강조한 정정"이 정작 거짓이었음 (batch-loadmap.md 미확인)
        ▼  외부 Review B+C는 코드 못 봄, 보고서만 신뢰
REMEDIATION 입력: CRIT-합의-2 "콘텐츠 0%" + CRIT-합의-3 "BATCH-1 미진입"
        │
        ▼
처리 계획이 거짓 전제 위에 수립될 뻔함 (← 본 검증이 차단)
```

**메타 교훈**: 이는 프로젝트 `CLAUDE.md:최근 실수` 패턴의 교과서 사례 — "스코프 축소(루트 문서만 보고 batch-loadmap 미확인) + 자기 확인 편향". 외부 SPDP(만든 자≠검증자) 체인조차 **입력 문서가 오염되면 동일 오류를 증폭**한다. 진산님의 "외부 검토서는 현재 구현을 모른다"는 직관이 정확히 적중.

### 내 G-AUDIT 보고서 환각 자수 (CRITICAL RULE #5 정합)

- **오류 위치**: G-AUDIT `§12 핵심 정정 #2` 및 `§8` — "vectorCount 1277 = topic_cluster/smoke, 핵심 KG 미적재"
- **사실**: production D1 `knowledge_nodes : 794`, BATCH-1~7 적재 완료 (`batch-loadmap.md:41~78`, `handoff-069:153`)
- **원인**: `CLAUDE.md` stale 신뢰 + `docs/plans/batch-loadmap.md` 미열람. §12에서 "[확인필요]"로 헷지했으나 정작 가장 강조한 정정문에서 단정형으로 오판
- **영향**: 외부 Review B+C → REMEDIATION CRIT-2/3 오염. 본 문서로 정정 영속

---

## 5. 처리 방향 제안 (REMEDIATION Tier 재배치)

REMEDIATION §D Tier 권고를 실코드 기반 재배치:

### T0 (즉시 — 오염원 차단, 진산 결재 불요 추정)

1. **CLAUDE.md "현재 상태" 갱신** — 근본 원인. Phase 0→실상태(Phase 3 launch chain + BATCH-1~7 적재 완료 + Graph walk 미구현). 모든 신규 세션 컨텍스트 오염 차단. **[L1 문서, 자율 가능 / 단 §"현재 상태" 표현은 진산 확인 권장]**
2. **REMEDIATION 입력 정정 영속** — 본 문서가 CRIT-2/3 거짓 전제임을 외부 메타 검토 세션에 회송 (SPDP 체인 정정 의무)

### T1 (다음 Session Block — 진짜 핵심)

3. **Graph walk PoC + ADR** — CRIT-4. 유일하게 정확한 핵심 위험. D1 `WITH RECURSIVE` CTE로 knowledge_edges N-hop 순회 PoC. 이미 878+ 엣지 적재 완료 상태이므로 **실데이터 위에서 즉시 검증 가능** (CRIT-3 거짓 전제가 무효화되며 오히려 PoC 진입 장벽이 사라짐 — 긍정적 반전). **[진산 결재 필요: L3 코어 엔진 변경, plan 선행]**

### T2 (실데이터 품질 평가 — CRIT-2/3의 정당한 잔존분)

4. 적재된 794 노드 위에서 검색 품질 / multi-hop 정답률 baseline 측정 (Phase 2 Eval MVP 연계). REMEDIATION이 "콘텐츠 0%"로 오인한 자리에 들어갈 **정당한 명제**.

### T3 (carry-over 유지)

5. B-1 Cost cap ADR(Year1 LOW, 생성형 기능 추가 시점 트리거), B-2 Adaptive Router, C-3 Critic LLM(Year2), B-3 PII 재확인, B-5 deadline 명시, B-4 multi-tenant.

---

## 6. 진산 결재 필요 포인트

| #      | 결재 사항                                                      | 사유                                                                                                                                                            |
| :----- | :------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 결재-1 | **CRIT-2/3 거짓 전제 판정을 외부 메타 검토 세션에 회송할지**   | SPDP 체인 정정 의무 vs 사이클 비용. 회송 안 하면 외부 Review B가 거짓 전제로 Round 3 진행                                                                       |
| 결재-2 | **CLAUDE.md "현재 상태" 갱신 문구**                            | 루트 문서. Phase 표기를 "Phase 3 launch chain"으로 할지, BATCH/Graph walk 상태를 어떻게 한 줄 요약할지 — 표현이 향후 모든 세션 컨텍스트 기준점                  |
| 결재-3 | **Graph walk(CRIT-4) 처리를 지금 T1로 올릴지**                 | L3 코어 엔진 영역. 진짜 핵심이나 plan 선행+승인 의무. Step 3-UX-7b distractor BATCH와 우선순위 경합                                                             |
| 결재-4 | **REMEDIATION 처리 계획 문서를 본 검증 반영 후 작성 진입할지** | 본 문서는 검증만. 처리 계획(REMEDIATION 6+1 섹션) 실작성은 별도 단계 — 거짓 전제 2건 제외하고 진행할지 결재                                                     |
| 결재-5 | **Pattern A 정체성 (메타 도전 a/b)**                           | 검증 결과 (a) "현재 상태가 Vector RAG에 머묾"이 **정확** (CRIT-4 확증). (b) "Pattern A 자체가 무늬만"은 부정확(D1+Vectorize KG는 유효). 공식 입장 ADR 작성 여부 |

---

## 7. 자기 검증

```
☑ Q1. CRIT 5 + 합집합 10 전 항목 타당성 판정 — YES (§2, §3)
☑ Q2. 거짓 전제 판정에 실코드/파일 인용 — YES (batch-loadmap.md:41~78, handoff-069:153/169, user-search.ts:198-285 등)
☑ Q3. 진산 결재 포인트 명시 — YES (§6, 5건)
☑ Q4. Claude Code가 자체 결재 불가 사항을 자체 결정 안 함 — YES (CLAUDE.md 갱신/REMEDIATION 회송/T1 격상 모두 결재 위임)
☑ Q5. 환각 자수 — YES (§4, 내 G-AUDIT §12 핵심정정 #2 거짓 자수)
☑ Q6. 시간 캘린더 침투("이번 주/곧") — 미사용. 절대 날짜만
☑ Q7. 반론/반증 시도 — YES (에이전트 ① graph walk 반증 3시나리오, ② Year1 런타임 미호출 반박 등 보존)
```

---

## 종결 메타정보

- 작성 일시: 2026-05-15
- 검증 대상 코드: `1f34b0d` (origin/main) / 본 문서 작성 시 HEAD: `f03c518`
- 독립 조사: 에이전트 3개 병렬 (graph walk / L3·cost·router / 데이터규모) + 메인 직접 교차확인 3파일
- 외부 메타 검토 세션 제출 가능: YES (단 §4 거짓 전제 정정이 반드시 동봉돼야 함)
- **다음 단계**: ★ 진산 피드백 게이트 (§6 결재 5건). 결재 후 REMEDIATION 처리 계획 진입 여부 확정. **본 문서는 처리 계획이 아니라 처리 계획의 전제 검증이다.**

> _"진단 없는 처방은 환각이다 — 그러나 오염된 진단 위의 처방은 더 위험한 환각이다."_
