# 🏗️ ENGINE · PIPELINE DESIGN AUDIT PROMPT v1.0

> **용도**: 쪽집게(ThePick)의 _목표 → 핵심 엔진 → 엔진 간 파이프라인_ 설계가 올바른지를
> 다양한 전문가 페르소나를 독립·병렬 동원해 **전체+세부**로 심층 감사하여, 더 만들기 전에
> **설계 오류·기술부채**를 잡아내는 실행 프롬프트.
> **층위**: _설계/아키텍처 정합성_. 아래와 **명시적으로 다른 층** (중복 보고 금지):
> | 도구 | 무엇을 보나 |
> |:---|:---|
> | `quality-gate.sh` hook | 문법/lint/any/console.log/빈catch |
> | `4pass-review` | _변경분_ 코드 정합성 (Surgeon/Architect/Advocate/Contract) |
> | `5persona-debt` | _변경분_ 기술부채 (refactoring/perf/quality/backend/devops) |
> | `PROJECT AUDIT PROMPT v1.0` | 외부 SPDP 감사 (Cloudflare 인벤토리·12섹션) |
> | **★ 본 프롬프트** | **엔진 선택이 옳은가 / 파이프라인이 목표를 떠받치는가 / 6개월~2년 뒤 설계가 버티는가** |
>
> **두 가지 실행 모드**:
>
> - **(A) 자동** — `Workflow({ scriptPath: ".claude/workflows/design-audit.js" })` (5단계 다중 페르소나 자동 병렬 + 적대 반증 + 보고서 영속).
> - **(B) 수동** — 본 문서 §"붙여넣기용 프롬프트"를 새 세션/모델에 그대로 투입.

---

## 0. 왜 이 감사인가 (Reality Anchor)

이 프로젝트는 **stale 문서 1건이 5-Layer 거짓 전제로 증폭된 사고**를 겪었다(2026-05-15 G-AUDIT,
CLAUDE.md '현재 상태' Phase 0 오염 → "콘텐츠 0%" 거짓 → 외부 Review B+C → REMEDIATION CRIT-2/3).
그리고 graph-walk 가 "있어 보이지만 순기여 0"(graphOnlyRecovery=0, G-S5 2차 실측)인 사례를 이미 본다.
⇒ **설계는 코드를 쓰기 전에, 그리고 문서가 아닌 실코드/실데이터로 검증되어야 한다.** 본 감사의 존재 이유.

---

## 1. 감사 원칙 — 위반 시 환각으로 간주

1. **실코드/실데이터 게이트(최우선).** 모든 주장 = `파일:라인` 또는 production 1-쿼리. 모르면 `[확인 필요]`.
   stale 문서(CLAUDE.md '현재 상태'·handoff·plan)는 *주장*일 뿐 — 진실원 금지, 실코드와 대조.
   **"스키마에 컬럼 존재 ≠ production 데이터 populate"** (2026-05-16 교훈).
2. **G-1 Reality Gate.** "가능합니다" 단언 금지. 형식: ①SOTA 천장 ②목표 위치 ③측정 전이면 "추정".
3. **RULE #5 — GO/STOP·"할 가치"는 인간(진산).** AI 는 🟢(작동)/🟡(불확실)/🔴(미작동) 사실 + 선택지만
   못박는다. 자가 점수로 가능성 판정 금지.
4. **주관 평가어 금지** — "좋다/괜찮다/안정적/잘 됨" → 수치·경로·인용으로 대체.
5. **독립성·반론 의무.** 페르소나는 서로의 결론을 모른 채 감사(자가확인 편향 차단). 각 발견에 Devil's Advocate
   (이게 정당한 설계일 시나리오) 1건+. stub/TODO/placeholder = CRITICAL.
6. **환각 자수.** 보고서에 추측·표본 한계·확인 필요를 _최소 1건_ 자수. 0건이면 그 자체가 환각 신호.

---

## 2. 5단계 구조

### Phase 0 — 목표 재정립 (북극성 grounding)

권위 출처에서 목표를 _다시 도출_(CLAUDE.md 요약 복붙 금지). 직접 Read:
`docs/feasibility/{thepick.feasibility,ceiling}.md` · `docs/consti/VOID_DEV_UNIFIED_CONSTITUTION_v3_6.md` ·
`docs/architecture/ARCHITECTURE.md` · `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md` · ROADMAP/NORTH_STAR(있으면).
**산출**: 궁극 비전 / Year1 구체(손해평가사 1·2차) / 측정 가능한 북극성 / 엔진 판정 잣대 / staleClaims(문서≠실코드).
→ 이것이 이후 모든 엔진 감사의 **잣대**.

### Phase 1 — 엔진·파이프라인 실측 지도

아래 핵심 엔진 각각을 *실코드*로 매핑: 목적·입출력·의존·파이프라인 위치·구현상태(real/partial/**stub**/missing)·redFlags + `file:line`.

| 엔진                 | 힌트 경로                                                                                                                                                                                                                                                                                            | 특히 볼 것                                                                                  |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| Content Build Engine | `packages/parser/`(ontology-registry·schema-validator·batch-processor·table-extractor·pdf-extractor·vision-trigger) · `packages/quality/`(graph-integrity) · `apps/batch/` · `docs/architecture/{CONTENT_BUILD_ENGINE,ONTOLOGY,VALIDATION_FRAMEWORK,VERSION_MANAGEMENT,BATCH_LOAD_PROTOCOL,CBIV}.md` | 적재 멱등성·draft→approved·트리거(0004/0038, ADR-046)·단일 진실원                           |
| Formula Engine (L3)  | `packages/formula-engine/src/`(ast-parser·engine·sandbox·constants-resolver·variable-mapper) · `LLM_CONTAINMENT.md`                                                                                                                                                                                  | math.js AST only·동적코드 0·LLM 계산 0·소수점 정밀                                          |
| Graph RAG + Walk     | `apps/api/src/search/`·`vectorize/` · `SEARCH_PIPELINE.md` · ADR-044/045                                                                                                                                                                                                                             | vector+graph fusion·truthWeight-first 병합·엣지 도달성·graphOnlyRecovery                    |
| ★ 생성 엔진          | `packages/study-material-generator/src/` · `packages/ai-adapter/`                                                                                                                                                                                                                                    | **stub 의심** — 북극성(생성물 신뢰성) 직결 엔진이 index.ts 뿐인가? 출처 없이 approved 경로? |
| 혼동·품질 검증       | `packages/quality/` · `VALIDATION_FRAMEWORK.md`                                                                                                                                                                                                                                                      | 고아노드/끊긴엣지/SUPERSEDES 순환 0·혼동유형                                                |
| FSRS·학습모드        | `packages/srs/`·`packages/learning-modes/` · `apps/api/src/{progress,study}`                                                                                                                                                                                                                         | 오프라인 동기화(IndexedDB↔D1)·간격반복 정확성                                               |
| 평가·측정(yardstick) | `apps/api/src/eval/` · `scripts/measure-*·build-querybody-golden.mjs` · `docs/plans/s5-6-measurements/`                                                                                                                                                                                              | golden 대표성·순환편향·fabricate 차단·측정이 *정직*한가                                     |
| 데이터 계층·격리     | `apps/api/src/db/` · migrations · `MULTI_EXAM_EXTENSION.md`                                                                                                                                                                                                                                          | exam_id 격리(Hard Rule 15~17 Year2 zero-cost)·Temporal Graph                                |
| LLM 격리             | `packages/ai-adapter/src/` · `{LLM_CONTAINMENT,THREAT_MODEL,OPERATIONS_RISK}.md`                                                                                                                                                                                                                     | 4-Layer Isolation·cost cap·timeout+retry·PII·draft-only                                     |

### Phase 2 — 다중 전문가 페르소나 독립 병렬 감사

각 페르소나가 **전체 지도 + 실코드 재확인**으로 자기 렌즈 감사. 서로의 결론 모름.

| #   | 페르소나                         | 핵심 질문                                                                                    |
| :-- | :------------------------------- | :------------------------------------------------------------------------------------------- |
| 1   | 지식그래프·온톨로지 아키텍트     | 엣지 설계가 검색·생성을 떠받치나, graph 가 장식인가? 영구 미도달 노드 클래스(CONCEPT-023류)? |
| 2   | RAG·IR 검색 아키텍트             | 검색 설계가 정답 도달을 보장하나? graph walk 순기여할 *구조적 여지*가 있나?                  |
| 3   | 데이터 파이프라인·ETL 아키텍트   | 10K·매년개정·시험확장에서 버티나? 임시저장/하드코딩/단일진실원 우회/수동개입?                |
| 4   | 콘텐츠 생성·LLM 격리 전문가      | 북극성 떠받치는 생성 엔진이 *실재*하나 stub 인가? 출처 없는 생성물 approved 경로?            |
| 5   | 도메인 전문가(손해평가·평가과학) | 실제 합격에 기여하나? 산식/constants 치명오류? 측정이 자기기만(생존편향)?                    |
| 6   | 시스템 아키텍트(경계·결합도)     | 엔진 분리·결합 옳나? Year2 확장비용 기하급수 결합? Hexagonal/Workers 위반?                   |
| 7   | 북극성 정렬 red-team(적대)       | 목표와 무관히 비대한 엔진 / 필수인데 stub / "있어 보이나 순기여 0" 또 있나? Silent Pivot?    |

**발견 형식**(각 ≤8건, 중대 우선): `id · title · severity(critical/major/minor) · type(design-error/tech-debt/goal-misalignment/pipeline-gap/stub-engine/boundary-violation) · engine · description · evidence(file:line) · impact · devilsAdvocate`.

### Phase 3 — 적대적 교차검증 (realcode refute)

각 _중대_ 발견을 독립 회의론자가 **인용 file:line 을 직접 열어** 반증 시도. 발견 텍스트 재추론 금지.
과장·오인·의도된 설계·정당한 트레이드오프 = `refuted`. **불확실하면 기본 회의(refuted).** 생존 발견만 채택.
(thorough 모드: 발견당 3 회의론자 다수결. 기본: 1 회의론자.)

### Phase 4 — 종합 + 영속

confirmed 발견만으로: **진앙(root cause)** 클러스터 → **심각도 매트릭스** → **엔진별 북극성 정렬 판정**
(serves/partial/stub/misaligned/overbuilt) → **remediation 선택지(PITR식)** → **환각 자수**.
remediation 은 *권고*까지 — **GO/STOP 은 진산(RULE #5)**, `humanDecisionRequired` 표시.
**영속**: `docs/audit/DESIGN_AUDIT_REPORT_<YYYYMMDD-HHMMSS>.md` (+ 누적 시 INDEX). confirmed 발견 전수 file:line 포함.

---

## 3. 완료 기준

- Phase 0~4 전부 수행 + 보고서 영속.
- confirmed 발견 = 실코드 file:line 증거 有. 기각 발견은 보고서 제외(패턴만 참고).
- 환각 자수 ≥1건. 주관 평가어 0건. RULE #5(GO/STOP=인간) 위반 0건.
- 엔진별 정렬 판정에 **stub/misaligned/overbuilt** 후보를 정직하게 표기(특히 생성 엔진).

---

## 4. 붙여넣기용 프롬프트 (모드 B — 단일 세션/모델용 자기완결)

```
너는 쪽집게(ThePick) — 손해평가사 자격시험 AI 학습 서비스(더 크게는 "자격증 도메인별 Graph RAG +
훈련 콘텐츠 무한 자동 생성 엔진", 북극성=생성물 신뢰성·정확성)의 *설계/아키텍처 정합성*을 감사한다.
목적: 목표 → 핵심 엔진 → 엔진 간 파이프라인 설계가 올바른지를 전체+세부로 심층 점검하여, 더 만들기
전에 설계 오류·기술부채를 잡는다. (문법/lint=quality-gate, 변경분 코드=4-Pass, 변경분 기술부채=
5-persona-debt 와 중복 금지 — 너는 '엔진 선택이 옳은가·파이프라인이 목표를 떠받치는가·2년 뒤 버티는가'.)

[원칙 — 위반=환각]
1. 모든 주장 = 파일:라인 또는 production 1-쿼리. 모르면 [확인 필요]. stale 문서(CLAUDE.md '현재상태'·
   handoff·plan)는 진실원 금지·실코드 대조. "스키마 존재 ≠ 데이터 populate".
2. "가능합니다" 단언 금지(천장 인용). GO/STOP·"할 가치"는 인간 결정 — 너는 🟢🟡🔴 사실+선택지만(RULE #5).
3. 주관 평가어 금지(수치·경로만). 각 발견에 Devil's Advocate 1건+. stub/TODO=CRITICAL. 환각 자수 ≥1건.

[수행]
Phase 0 목표 재정립: docs/feasibility/{thepick.feasibility,ceiling}.md, docs/consti/, docs/architecture/
  ARCHITECTURE.md, 구현 재정립서 v2.0 을 Read 하여 궁극비전/Year1구체/측정가능 북극성/판정잣대/staleClaims 도출.
Phase 1 엔진 지도: Content Build(packages/parser·quality·apps/batch) / Formula(packages/formula-engine) /
  Graph RAG+Walk(apps/api/src/search·vectorize) / 생성(packages/study-material-generator·ai-adapter ←stub 의심) /
  혼동·품질(packages/quality) / FSRS·학습(packages/srs·learning-modes) / 평가측정(apps/api/src/eval·scripts) /
  데이터계층·격리(apps/api/src/db·migrations) / LLM격리(packages/ai-adapter). 각: 목적·입출력·의존·파이프라인
  위치·구현상태(real/partial/stub/missing)·redFlags + file:line.
Phase 2 7 렌즈 감사(순차라도 렌즈별 독립 사고): ①지식그래프/온톨로지 ②RAG/IR ③데이터파이프라인 ④생성/LLM격리
  ⑤도메인(손해평가·평가과학) ⑥시스템경계/결합도 ⑦북극성정렬 red-team. 발견= severity/type/engine/file:line/impact/
  Devil's Advocate, 렌즈당 ≤8건.
Phase 3 각 중대 발견을 인용 file:line 직접 열어 반증 시도(불확실=기각). 생존분만 채택.
Phase 4 진앙 클러스터 → 심각도 매트릭스 → 엔진별 정렬 판정(serves/partial/stub/misaligned/overbuilt) →
  remediation 선택지(권고까지, GO/STOP은 인간) → 환각 자수. docs/audit/DESIGN_AUDIT_REPORT_<날짜>.md 로 영속.
```

---

## 5. 자기 검증 (보고서 출력 _후_)

```
□ Phase 0~4 전부 수행 + 보고서 영속?
□ confirmed 발견 전부 file:line 인용? (추측·문서만 근거 0건?)
□ 주관 평가어("좋다/안정적") 들어간 곳? → 제거
□ GO/STOP 을 AI 가 단정한 곳? (RULE #5 위반) → 🟢🟡🔴+선택지로 환원
□ 환각 자수 ≥1건? (0건이면 다시 검토 — 그 자체가 환각 신호)
□ 4-Pass/5-persona-debt 와 중복 보고? → 설계 층으로 환원
□ 생성 엔진(북극성 직결) 구현상태를 *실코드 본문*으로 판정? (파일 개수 표면 아님)
```

---

> _"진단 없는 처방은 환각이다. 설계 감사 없는 대규모 구현은 기술부채의 복리다."_
> 실행 장치: `.claude/workflows/design-audit.js` · 사양: 본 문서 · 층위: 설계/아키텍처 정합성.
