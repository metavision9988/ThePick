// design-audit.js — 전체 프로젝트 엔진·파이프라인 설계 정합성 다중 페르소나 심층 감사
// 실행: Workflow({ scriptPath: ".claude/workflows/design-audit.js" })
// 문서 사양: docs/audit/DESIGN_AUDIT_PROMPT_v1.0.md (이 스크립트는 그 사양의 실행 장치)
//
// 5단계: Goal(목표 재정립) → Map(엔진 실측 지도) → Audit(독립 병렬 페르소나)
//        → Verify(발견별 적대적 realcode 반증) → Synthesize(진앙 종합 · RULE #5)
//
// 핵심 가드(모든 단계 강제):
//  - 실코드/실데이터 게이트: 모든 주장 = file:line 또는 production 1-쿼리. "스키마 존재 ≠ 데이터 populate".
//    stale 문서(특히 CLAUDE.md '현재 상태')를 진실원으로 쓰지 말 것 — 2026-05-15 G-AUDIT 5-Layer 오염 교훈.
//  - G-1 Reality Gate: "가능합니다" 금지. 천장 인용. RULE #5 = GO/STOP은 인간. AI는 🟢🟡🔴 + 옵션만.
//  - 반환각: 추측은 [확인 필요]. 주관 평가어("좋다/안정적") 금지. 환각 자수 의무.
//  - 중복 금지: 4-Pass(코드 정합성)·5-persona-debt(변경분 기술부채)와 다른 층 = '설계/아키텍처 정합성'.

export const meta = {
  name: 'design-audit',
  description: '전체 프로젝트 목표 재정립 → 핵심 엔진·파이프라인 설계 정합성 다중 페르소나 심층 감사(설계오류·기술부채) + 적대 반증 + 진앙 종합. RULE #5(GO/STOP=인간) 준수.',
  whenToUse: '대규모 구현 착수 전 / Phase 경계 / "설계가 제대로 됐나 전체+세부 점검" 요청 시. 매 마일스톤 재실행 가능.',
  phases: [
    { title: 'Goal', detail: '북극성 목표 재정립 (권위 출처 grounding, stale 문서 배제)' },
    { title: 'Map', detail: '핵심 엔진·파이프라인 실측 지도 (병렬 readers)' },
    { title: 'Audit', detail: '다중 전문가 페르소나 독립 병렬 설계 감사' },
    { title: 'Verify', detail: '발견별 적대적 교차검증 (realcode refute)' },
    { title: 'Synthesize', detail: '진앙 종합 + 심각도 매트릭스 + remediation(RULE#5) + 보고서 영속' },
  ],
}

// ── 공통 헌장 (모든 에이전트 프롬프트 머리에 주입) ──
const CHARTER = `[프로젝트] 쪽집게(ThePick) — 손해평가사 자격시험 AI 학습 서비스. 더 크게는 "자격증 도메인별 Graph RAG + 훈련 콘텐츠 무한 자동 생성 엔진"(북극성 = 생성물 신뢰성·정확성, 합격률 60% 목표). 스택: Astro+React(web PWA) / Cloudflare Workers+Hono(api) / D1+Vectorize / Drizzle / Claude API(ai-adapter) / math.js AST(formula-engine). 모노레포 packages/(ai-adapter,formula-engine,learning-modes,parser,parser-1st-exam,payment,quality,shared,srs,study-material-generator) + apps/(web,admin-web,api,batch).

[너의 의무 — 위반 = 환각]
1. 실코드/실데이터에서 직접 확인한 사실만. 인용 = 파일:라인(예: apps/api/src/search/graph-search-route.ts:79). 모르면 [확인 필요].
2. ★ stale 문서를 진실원으로 쓰지 마라. CLAUDE.md '현재 상태'·handoff·plan 은 *주장*일 뿐 — 실코드와 대조하라. "스키마에 컬럼 존재 ≠ production 에 데이터 populate"(2026-05-16 교훈). 데이터 주장은 가능하면 production 1-쿼리 또는 코드 경로로 확인.
3. 주관 평가어("좋다/괜찮다/안정적/잘 됨") 금지 — 수치·경로·인용만.
4. G-1 Reality Gate: "가능합니다" 단언 금지. 실현가능성은 ①SOTA 천장 ②목표 위치 ③측정 전이면 추정 형식. **GO/STOP·"할 가치" 판정은 인간(RULE #5)** — 너는 🟢(작동)/🟡(불확실)/🔴(미작동) 사실 + 선택지만 못박는다.
5. 이 감사는 *설계/아키텍처 정합성* 층이다. 단순 컴파일/문법/lint(=quality-gate hook 담당), 변경분 코드 정합성(=4-Pass), 변경분 기술부채(=5-persona-debt)와 **중복 보고 금지**. 너는 "엔진 선택이 옳은가 / 엔진 간 파이프라인이 목표를 떠받치는가 / 6개월~2년 뒤 설계가 버티는가"를 본다.`

// ── Phase 1: 매핑 대상 핵심 엔진 (실측 지도 readers) ──
const ENGINES = [
  { key: 'content-build', name: 'Content Build Engine (Ontology/Validation/Version/Loader)',
    hints: 'packages/parser/(ontology-registry.json·ontology-registry.ts·schema-validator·batch-processor·constants-extractor·table-extractor·pdf-extractor·vision-trigger·section-splitter·normalizer), packages/quality/(graph-integrity), apps/batch/, docs/architecture/{CONTENT_BUILD_ENGINE,CONTENT_BUILD_ENGINE_OVERVIEW,ONTOLOGY,VALIDATION_FRAMEWORK,VERSION_MANAGEMENT,BATCH_LOAD_PROTOCOL,CBIV}.md, migrations(트리거 0004/0038 ADR-046)' },
  { key: 'formula-engine', name: 'Formula Engine (산식 AST·L3)',
    hints: 'packages/formula-engine/src/(ast-parser·engine·sandbox·constants-resolver·variable-mapper·errors·formulas/), docs/architecture/LLM_CONTAINMENT.md. Hard Limit: LLM 계산 금지·동적코드 금지·math.js AST only.' },
  { key: 'graph-rag-walk', name: 'Graph RAG + Graph Walk (검색·랭킹)',
    hints: 'apps/api/src/search/(graph-search-route·user-search·ranking-core 등), apps/api/src/vectorize/, docs/architecture/SEARCH_PIPELINE.md, ADR-044(Pattern A 정체성)·ADR-045(N-hop). 3계층: constants(정밀)·graph(구조)·Vectorize(맥락). 현 G-S5 측정: graphOnlyRecovery 0.' },
  { key: 'generation-engine', name: '콘텐츠 생성 엔진 (study-material-generator) — ★북극성 직결',
    hints: 'packages/study-material-generator/src/(index.ts — 구현 깊이 의심: stub인가 실엔진인가?), packages/ai-adapter/. 문제/암기법/풀이/오답후보 생성 + 출처 추적(provenance) + 환각 차단. memory project_content_build_engine_as_core·project_source_citation_requirement.' },
  { key: 'confusion-quality', name: '혼동 유형 감지 + 품질 검증',
    hints: 'packages/quality/src/(graph-integrity·normalizer), 혼동 유형(ConfusionType cross_crop 등), 고아노드/끊긴엣지/SUPERSEDES 순환 0 게이트, docs/architecture/VALIDATION_FRAMEWORK.md.' },
  { key: 'srs-learning', name: 'FSRS 간격반복 + 학습 모드',
    hints: 'packages/srs/src/(fsrs·weak-score), packages/learning-modes/src/(input-types·normalize·shuffle·session-progress), apps/api/src/(progress·study). 오프라인 동기화(IndexedDB/Dexie ↔ D1).' },
  { key: 'eval-measurement', name: '평가·측정 엔진 (yardstick 자체)',
    hints: 'apps/api/src/eval/(multihop-accuracy), scripts/measure-s5-6-multihop-accuracy.ts·build-querybody-golden.mjs, docs/plans/s5-6-measurements/. golden·graphOnlyRecovery·regression. 이 엔진이 북극성(정답률)을 *정직하게* 재는가(순환편향·fabricate 차단)?' },
  { key: 'data-layer', name: '데이터 계층·스키마·멀티시험 격리',
    hints: 'apps/api/src/db/, Drizzle schema, migrations, D1 9테이블, exam_id 격리(Hard Rule 15~17 Year2 zero-cost), Temporal Graph(UPDATE 금지→INSERT+SUPERSEDES), docs/architecture/MULTI_EXAM_EXTENSION.md.' },
  { key: 'llm-containment', name: 'LLM 격리·위협 모델 (ai-adapter)',
    hints: 'packages/ai-adapter/src/(anthropic-adapter), docs/architecture/{LLM_CONTAINMENT,THREAT_MODEL,OPERATIONS_RISK}.md. 4-Layer Isolation(schema/constraint/cross-val/graceful-degradation), cost cap, timeout+retry3, prompt injection, PII filter, draft-only 적재.' },
]

// ── Phase 2: 독립 병렬 전문가 페르소나 (설계 층, 4-Pass/5-debt 와 중복 금지) ──
const PERSONAS = [
  { key: 'kg-ontology', name: '지식그래프·온톨로지 아키텍트',
    lens: '엔티티/엣지 모델·온톨로지 락·Temporal Graph(SUPERSEDES)·그래프 도달성(엣지 부재로 영구 미도달 클래스=CONCEPT-023 류)·3계층 데이터 일관성. "엔진이 graph의 실제 구조를 제대로 쓰나? 엣지 설계가 검색·생성을 떠받치나, 아니면 그래프가 장식인가?"' },
  { key: 'rag-ir', name: 'RAG·IR 검색 아키텍트',
    lens: '검색 파이프라인·vector+graph fusion·랭킹(truthWeight-first 병합의 동일-type 무변별)·re-ranking·adaptive routing·topK 민감도. "검색 설계가 정답 도달을 보장하나? graph walk 가 순기여(graphOnlyRecovery)할 구조적 여지가 있나?"' },
  { key: 'data-pipeline', name: '데이터 파이프라인·ETL 아키텍트',
    lens: 'BATCH 수집→구조화→검증→draft→approved 흐름·멱등성·증분 인덱싱·단일 진실원(우회 없나)·스키마 진화·백필 게이트(트리거). "10K 유저·매년 개정·다른 시험 확장에서 파이프라인이 버티나? 임시저장/하드코딩/수동개입 없나?"' },
  { key: 'gen-containment', name: '콘텐츠 생성·LLM 격리 전문가',
    lens: 'study-material-generator 실구현 깊이·ai-adapter 4-Layer Isolation·환각 차단·출처 추적(provenance/citation chain)·distractor 안전·draft-only. "북극성(생성물 신뢰성)을 떠받치는 생성 엔진이 *실재*하나, 아니면 index.ts stub 인가? 생성물이 출처 없이 approved 될 경로가 있나?"' },
  { key: 'domain-assessment', name: '도메인 전문가 (손해평가·평가과학)',
    lens: '산식 정확성·constants 정합(65%↔60% 류 치명오류)·시험 출제 구조(보기별/물음별 출처)·정답 안전·측정 방법론(golden 대표성·순환편향·N). "이 설계가 실제 합격에 기여하나? 도메인 진실을 왜곡하거나, 측정이 자기기만(생존편향)하지 않나?"' },
  { key: 'systems-boundary', name: '시스템 아키텍트 (경계·결합도)',
    lens: '모듈 경계·packages 단방향 의존·Hexagonal(domain→infra 직접참조 금지)·Workers 제약(CPU 50ms/fs금지)·멀티시험 격리(exam_id 파라미터, Year2 zero-cost)·번들. "엔진들이 올바르게 분리·결합됐나? Year2 확장 비용이 기하급수로 터질 결합 없나?"' },
  { key: 'northstar-redteam', name: '북극성 정렬·제품 전략 red-team (적대)',
    lens: '목표 재정립(Phase 0) 대비 각 엔진이 *실제로* 그 목표를 떠받치는가 vs 곁가지/over-build·Silent Pivot. "우리가 만든/만들 엔진 중 목표와 무관하게 비대해진 것, 또는 목표에 필수인데 stub 인 것은? graph-walk 처럼 \'있어 보이지만 순기여 0\' 인 설계가 또 있나?"' },
]

// ── 스키마 ──
const GOAL_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    ultimateVision: { type: 'string', description: '궁극 비전 1~2문장 (권위 출처 인용)' },
    year1Concrete: { type: 'string', description: 'Year1 구체 목표 (손해평가사 1·2차)' },
    northStar: { type: 'string', description: '측정 가능한 북극성 성공 기준 (예: 생성물 정답률/신뢰성)' },
    successCriteria: { type: 'array', items: { type: 'string' }, description: '엔진을 판정할 잣대 (측정 가능)' },
    authoritativeSources: { type: 'array', items: { type: 'string' }, description: '근거 파일:절 (feasibility/ceiling/consti/architecture/재정립서/ROADMAP)' },
    staleClaims: { type: 'array', items: { type: 'string' }, description: '문서 주장 ≠ 실코드/실데이터인 지점 (stale 오염 후보)' },
  },
  required: ['ultimateVision', 'northStar', 'successCriteria', 'authoritativeSources'],
}

const ENGINE_MAP_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    engine: { type: 'string' },
    purpose: { type: 'string' },
    inputs: { type: 'array', items: { type: 'string' } },
    outputs: { type: 'array', items: { type: 'string' } },
    dependencies: { type: 'array', items: { type: 'string' } },
    implementationState: { type: 'string', enum: ['real', 'partial', 'stub', 'missing', 'unknown'] },
    keyFiles: { type: 'array', items: { type: 'string' }, description: 'file:line 증거' },
    pipelinePosition: { type: 'string', description: '수집→구조화→품질검증→Core→생성→학습서비스 중 위치 + 상하류 엔진' },
    redFlags: { type: 'array', items: { type: 'string' }, description: '설계상 의심 지점 (stub/우회/하드코딩/경계위반 등)' },
    evidence: { type: 'array', items: { type: 'string' } },
  },
  required: ['engine', 'purpose', 'implementationState', 'keyFiles', 'evidence'],
}

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    persona: { type: 'string' },
    lensSummary: { type: 'string', description: '이 렌즈로 본 전체 인상 (수치·경로 기반, 주관어 금지)' },
    findings: {
      type: 'array',
      description: '최대 8건 (가장 중대한 것 우선). 없으면 빈 배열 + lensSummary 에 PASS 증거 3개+',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'kebab 슬러그 (예: graph-edge-coverage-gap)' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          type: { type: 'string', enum: ['design-error', 'tech-debt', 'goal-misalignment', 'pipeline-gap', 'stub-engine', 'boundary-violation'] },
          engine: { type: 'string' },
          description: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' }, description: 'file:line (필수, 추측 금지)' },
          impact: { type: 'string', description: '10K유저/매년개정/시험확장/북극성 관점 영향' },
          devilsAdvocate: { type: 'string', description: '이 발견이 틀렸을(=정당한 설계일) 시나리오 1개+' },
        },
        required: ['id', 'title', 'severity', 'type', 'engine', 'description', 'evidence', 'devilsAdvocate'],
      },
    },
  },
  required: ['persona', 'findings', 'lensSummary'],
}

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    findingId: { type: 'string' },
    refuted: { type: 'boolean', description: '실코드 확인 결과 발견이 반증되면 true. 불확실하면 true(기본 회의).' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string' },
    evidenceChecked: { type: 'array', items: { type: 'string' }, description: '실제로 열어본 file:line (재추론 아닌 실코드 대조 증거)' },
    severityAdjustment: { type: 'string', description: '유지/상향/하향 + 사유 (옵션)' },
  },
  required: ['findingId', 'refuted', 'reasoning', 'evidenceChecked'],
}

const SYNTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    reportPath: { type: 'string', description: '영속한 보고서 경로 (docs/audit/DESIGN_AUDIT_REPORT_<date>.md)' },
    rootCauses: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' }, description: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          contributingFindings: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'description', 'severity'],
      },
    },
    criticalDesignErrors: { type: 'array', items: { type: 'string' } },
    techDebtItems: { type: 'array', items: { type: 'string' } },
    goalAlignmentVerdict: {
      type: 'array',
      description: '엔진별 북극성 정렬 판정',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          engine: { type: 'string' },
          verdict: { type: 'string', enum: ['serves', 'partial', 'stub', 'misaligned', 'overbuilt', 'unknown'] },
          note: { type: 'string' },
        },
        required: ['engine', 'verdict', 'note'],
      },
    },
    remediationOptions: {
      type: 'array',
      description: 'PITR 식 선택지 — RULE #5: 권고는 하되 GO/STOP 결정은 인간',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          issue: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          recommendation: { type: 'string' },
          humanDecisionRequired: { type: 'boolean' },
        },
        required: ['issue', 'options', 'humanDecisionRequired'],
      },
    },
    honestEscalation: { type: 'array', items: { type: 'string' }, description: '환각 자수 / [확인 필요] / 표본·증거 한계 (최소 1건 — 0건이면 그 자체가 환각 신호)' },
  },
  required: ['rootCauses', 'criticalDesignErrors', 'goalAlignmentVerdict', 'remediationOptions', 'honestEscalation'],
}

// ════════════════════════════════════════════════════════════════════
// 실행
// ════════════════════════════════════════════════════════════════════

// Phase 1 — 목표 재정립 (단일 grounding 에이전트, 후속 전 단계의 잣대)
const goal = await agent(
  `${CHARTER}

[임무: 북극성 목표 재정립] 이 프로젝트가 *진짜로* 달성하려는 목표를 권위 출처에서 다시 못박아라. CLAUDE.md 요약을 베끼지 말고, 다음을 직접 Read 하여 교차 도출:
- docs/feasibility/thepick.feasibility.md + ceiling.md (현실 판정·천장)
- docs/consti/VOID_DEV_UNIFIED_CONSTITUTION_v3_6.md (G-1 원칙)
- docs/architecture/ARCHITECTURE.md (조감도)
- docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md 가 있으면 (한 줄 정의)
- (있으면) ROADMAP / NORTH_STAR 류
이것이 이후 모든 엔진 감사의 *잣대*가 된다. stale 문서 주장과 실코드가 어긋나는 지점(staleClaims)도 적시하라.`,
  { schema: GOAL_SCHEMA, phase: 'Goal', label: 'goal:restate' }
)

// Phase 2 — 엔진·파이프라인 실측 지도 (병렬 readers, 모든 persona 가 공유할 사실 기반)
const maps = await parallel(
  ENGINES.map((e) => () =>
    agent(
      `${CHARTER}

[재정립된 목표(잣대)]
${JSON.stringify(goal)}

[임무: 엔진 실측 지도 — "${e.name}"] 다음 힌트 경로를 Read/Grep 으로 직접 열어 이 엔진을 매핑하라(추측 금지): ${e.hints}
- implementationState 는 *실제 코드 본문*으로 판정: real(로직 충실)/partial/stub(빈 함수·index만·TODO)/missing/unknown.
- 입력·출력·의존·파이프라인 위치(상하류 엔진)·설계 의심(redFlags)을 file:line 증거와 함께.
- ★ 특히 study-material-generator 류는 "src 에 파일 하나뿐" 같은 표면이 아니라 본문 로직 실재를 확인하라.`,
      { schema: ENGINE_MAP_SCHEMA, phase: 'Map', label: `map:${e.key}` }
    )
  )
)
const engineMap = maps.filter(Boolean)

// Phase 3+4 — 페르소나 독립 감사 → 발견별 적대 반증 (pipeline: persona A 검증 중 B 감사 진행)
const audited = await pipeline(
  PERSONAS,
  // stage 1: 독립 설계 감사 (서로의 결론 모름 → 자가확인 편향 차단)
  (p) =>
    agent(
      `${CHARTER}

[재정립된 목표(잣대)]
${JSON.stringify(goal)}

[엔진 실측 지도 (Phase 2 산출 — 사실 기반)]
${JSON.stringify(engineMap)}

[너의 페르소나: ${p.name}]
렌즈: ${p.lens}

[임무] 위 지도를 출발점 삼되 *반드시 실코드를 직접 재확인*하며(지도도 검증 대상), 이 렌즈로 전체+세부 설계를 감사하라. 설계 오류·기술부채·목표 불일치·파이프라인 공백·stub 엔진·경계 위반을 찾아라. 각 발견 = severity + type + engine + file:line 증거 + 10K/개정/확장/북극성 영향 + Devil's Advocate(이게 정당한 설계일 시나리오). 최대 8건, 중대한 것 우선. 발견 0건이면 lensSummary 에 실제 확인한 PASS 증거 3개+ 제시(N/A≠검증).`,
      { schema: FINDINGS_SCHEMA, phase: 'Audit', label: `audit:${p.key}` }
    ),
  // stage 2: 그 페르소나의 발견들을 각각 독립 회의론자가 realcode 로 반증 시도
  (review, persona) =>
    parallel(
      (review && review.findings ? review.findings : []).map((f) => () =>
        agent(
          `${CHARTER}

[임무: 적대적 반증] 아래 설계 감사 발견을 *반증*하라. 발견 텍스트로 재추론하지 말고 인용된 file:line 을 직접 열어 확인하라. 발견이 과장·오인·이미 의도된 설계·정당한 트레이드오프이면 refuted=true. 불확실하면 기본 회의(refuted=true). 실제로 열어본 file:line 을 evidenceChecked 에 남겨라.

[발견]
${JSON.stringify({ id: f.id, title: f.title, severity: f.severity, engine: f.engine, description: f.description, evidence: f.evidence, impact: f.impact })}`,
          { schema: VERDICT_SCHEMA, phase: 'Verify', label: `verify:${persona.key}:${f.id}` }
        ).then((v) => ({ ...f, persona: persona.key, verdict: v }))
      )
    )
)

const allFindings = audited.flat().filter(Boolean)
const confirmed = allFindings.filter((f) => f.verdict && f.verdict.refuted === false)
const refuted = allFindings.filter((f) => f.verdict && f.verdict.refuted === true)
log(`감사 발견 ${allFindings.length} → 반증 생존(confirmed) ${confirmed.length} / 기각 ${refuted.length}`)

// Phase 5 — 종합 + 보고서 영속
const synthesis = await agent(
  `${CHARTER}

[재정립된 목표(잣대)]
${JSON.stringify(goal)}

[엔진 실측 지도]
${JSON.stringify(engineMap)}

[적대 반증 생존 발견 (confirmed)]
${JSON.stringify(confirmed)}

[참고: 기각된 발견 (synthesis 에 포함 금지, 패턴 참고만)]
${JSON.stringify(refuted.map((f) => ({ id: f.id, why: f.verdict && f.verdict.reasoning })))}

[임무: 종합] confirmed 발견만으로 진앙(root cause) 클러스터링 → 심각도 매트릭스(critical 설계오류 / major 기술부채 / minor) → 엔진별 북극성 정렬 판정(serves/partial/stub/misaligned/overbuilt) → remediation 선택지(PITR식, RULE #5 = GO/STOP 은 인간이므로 권고만·humanDecisionRequired 표시) → 환각 자수(최소 1건).

그 다음 **보고서를 영속**하라:
1) Bash 로 날짜 스탬프: \`date '+%Y%m%d-%H%M%S'\`
2) Write 로 docs/audit/DESIGN_AUDIT_REPORT_<stamp>.md 작성 — 목표 재정립 / 엔진 지도 요약 / 진앙 / 심각도 매트릭스 / 엔진별 정렬 판정 / remediation 선택지 / 환각 자수 / confirmed 발견 전수(file:line). 파일명 review-*/INDEX 패턴 아님 주의(별도 audit 산출물).
3) reportPath 에 그 경로를 반환.`,
  { schema: SYNTH_SCHEMA, phase: 'Synthesize', label: 'synthesize:report' }
)

return {
  goal,
  engineCount: engineMap.length,
  totalFindings: allFindings.length,
  confirmedFindings: confirmed.length,
  refutedFindings: refuted.length,
  synthesis,
}
