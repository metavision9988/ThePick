export const meta = {
  name: '5persona-debt',
  description:
    'ThePick Phase 단위 5-페르소나 독립 병렬 기술부채 리뷰(refactoring/performance/quality/backend/devops) + 교차 진앙 합의 + INDEX 영속. 4-Pass 와 중복 금지(6개월~2년 horizon 전용)',
  whenToUse:
    'Phase 마일스톤 완료 / 대규모 묶음 변경(ADR 5건+패키지 신설 등) 후. args={phase?,scope?,prior4PassPath?,focusAreas?}.',
  phases: [
    { title: 'Persona', detail: '5 전문 페르소나 단일-메시지 병렬 독립 리뷰' },
    { title: 'Synthesize', detail: '교차 dedup + 진앙 클러스터 + INDEX 영속' },
  ],
}

const REPO = '/home/soo/ClaudePro/ThePick'

const a = args || {}
const phaseNo = a.phase != null ? String(a.phase) : 'N'
const scope =
  a.scope || `(scope 미지정 — repo 최근 변경 전체. \`git -C ${REPO} log --oneline -20\` 와 diff 로 자율 판단)`
const priorPath = a.prior4PassPath || ''
const focus = Array.isArray(a.focusAreas) ? a.focusAreas : []

const PERSONA_FINDING = {
  type: 'object',
  required: ['severity', 'title', 'file', 'line', 'detail', 'devilsAdvocate', 'horizon'],
  properties: {
    severity: { type: 'string', enum: ['CRITICAL', 'MAJOR', 'MINOR'] },
    title: { type: 'string' },
    file: { type: 'string', description: '파일 경로 (없으면 N/A)' },
    line: { type: 'string', description: '라인 번호/범위' },
    detail: { type: 'string' },
    devilsAdvocate: { type: 'string', description: '반론/강등 가능성 (규칙: 자기 반박 의무)' },
    horizon: { type: 'string', description: '언제 터지나 (예: "시험 시즌 10K", "Year 2 진입 즉시", "6개월 유지보수")' },
    suggestedFix: { type: 'string' },
  },
}
const PERSONA_SCHEMA = {
  type: 'object',
  required: ['persona', 'findings', 'checkedItems'],
  properties: {
    persona: { type: 'string' },
    findings: { type: 'array', items: PERSONA_FINDING },
    checkedItems: { type: 'array', items: { type: 'string' }, description: '확인한 영역 file:line 증거' },
  },
}

// ── 5 페르소나 (auto-review-protocol.md 표) ──
const PERSONAS = [
  {
    type: 'refactoring-expert',
    view: '코드 품질 부채',
    q: '6개월 뒤 이 코드가 버틸까?',
    focus:
      '중복/God 모듈/네이밍/죽은 코드/추상화 누락 + Hard Rule 15~17 시험특화 누수(examId 분기·리터럴·lv1_insurance 류 컬럼 직접 박힘)',
  },
  {
    type: 'performance-engineer',
    view: '런타임 부채',
    q: '10K 사용자에서 뭐가 터지나?',
    focus:
      'D1 N+1·fan-out·시리얼 chain / Workers CPU 50ms 한도 / 콜드스타트 / 인덱스 부재 / hot path RTT (측정 가능하면 수치 추정)',
  },
  {
    type: 'quality-engineer',
    view: '테스트 부채',
    q: '프로덕션에서 뭐가 물릴까?',
    focus:
      'Golden test 공백 / 정답 안전 Hard Stop(OX·빈칸·변형) / 회귀 검출 부재 / mock 의존 계약 drift / 통계 유의도 / 엣지',
  },
  {
    type: 'backend-architect',
    view: '데이터·API 부채',
    q: '2년차에 뭐가 아플까?',
    focus:
      '단일 진실원 우회 / Drizzle↔D1 스키마 drift / Temporal Graph 무결성 / 4-way sync 메커니즘 / append-only GC 정책 / ID 패턴 천장',
  },
  {
    type: 'devops-architect',
    view: '운영 부채',
    q: '새벽 3시 on-call 시나리오?',
    focus:
      'observability(Logpush/tail) / deploy 자동화 / D1 DR runbook(RPO·RTO) / secret 로테이션 / 알림 휘발 / Cloudflare 단일 벤더 정합',
  },
]

// ── Phase 1: 5 페르소나 병렬 (barrier — synthesize 가 전체를 교차 dedup) ──
phase('Persona')
const reports = await parallel(
  PERSONAS.map((p) => () =>
    agent(
      `당신은 ThePick Phase ${phaseNo} 기술부채 리뷰의 [${p.type}] 독립 페르소나다. 메인 대화 의도 0 (단일-메시지 병렬 호출).
관점: ${p.view} — 핵심 질문 "${p.q}"
중점 영역: ${p.focus}${focus.length ? ` / 추가 포커스: ${focus.join(', ')}` : ''}
리뷰 범위: ${scope}
${
  priorPath
    ? `직전 4-Pass 결과(${priorPath})를 Read 하여 ★중복 지적 절대 금지 — 단기 코드 정합성 버그는 4-Pass 영역, 본 리뷰는 6개월~2년 horizon 부채 전용.`
    : '4-Pass(코드 정합성)와 중복되는 단기 버그는 제외하고, 6개월~2년 horizon 기술부채만 보고하라.'
}
기준 문서: ${REPO}/CLAUDE.md + ${REPO}/.claude/rules/production-quality.md (Hard Rule 15~17 멀티시험 격리, Year 2 zero-cost) 를 Read 하여 적용.
각 발견: severity(CRITICAL/MAJOR/MINOR) + file:line 증거(Grep/Read 직접 확인) + devilsAdvocate(자기 반박/강등 가능성) + horizon(언제 터지나). checkedItems 에 N/A·PASS 도 증거와 함께 기록.`,
      { label: `persona:${p.type}`, phase: 'Persona', agentType: p.type, schema: PERSONA_SCHEMA }
    )
  )
)

// ── Phase 2: Synthesize (교차 dedup + 진앙 = 정당한 barrier 후 작업) ──
phase('Synthesize')
const valid = reports.filter(Boolean)
// 자기 채점 금지 floor (MINOR #2) — synthesize 의 LLM 자가 카운트를 코드 raw 집계로
// 교차검증. dedup 은 중복을 병합해 카운트를 줄일 수 있으나 CRITICAL 을 0 으로 만들 수 없다.
const rawFindings = valid.flatMap((r) => r.findings || [])
const rawCrit = rawFindings.filter((f) => f.severity === 'CRITICAL').length
const rawMajor = rawFindings.filter((f) => f.severity === 'MAJOR').length
const rawMinor = rawFindings.filter((f) => f.severity === 'MINOR').length
const synth = await agent(
  `ThePick Phase ${phaseNo} 5-페르소나 기술부채 통합 인덱스를 작성·영속하라.
1) \`date +%Y%m%d-%H%M%S\` 로 ts.
2) 5 페르소나 발견(아래)을 통합. 페르소나 미실행/누락(${PERSONAS.length - valid.length}건)이 있으면 INDEX 에 명시(은폐 금지).
   발견 데이터: ${JSON.stringify(valid)}
   ★자기 채점 금지 교차검증: raw 발견 합계 = CRITICAL ${rawCrit} / MAJOR ${rawMajor} / MINOR ${rawMinor}. dedup 후 카운트는 이보다 작을 수 있으나(중복 병합), CRITICAL 은 병합으로도 0 이 될 수 없다 — raw CRITICAL ${rawCrit}>0 인데 dedup critical=0 보고는 거짓 음성(금지). 각 raw CRITICAL 의 병합 귀속을 INDEX 에 명시.
3) 교차 dedup: 동일 file:line·동일 증상은 1건으로 병합하되 어느 페르소나들이 교차 합의했는지 표기.
4) 진앙(root cluster): 여러 페르소나가 같은 뿌리를 가리키는 부채 묶음을 식별 — 이름 + 구성 발견 ID + 권고 액션.
5) CRITICAL 한 줄 매트릭스(# / 페르소나 / 요지 / 영향 / 우선 버킷) + Critical/Major/Minor 합계 표.
6) 개별 페르소나 보고서는 ${REPO}/.claude/reviews/phase${phaseNo}-tech-debt-<ts>-{persona}.md 로 각각 Write, 통합 인덱스는 ${REPO}/.claude/reviews/phase${phaseNo}-tech-debt-<ts>-INDEX.md 로 Write.
7) "완료" 선언 기준: 4-Pass CRITICAL 0 AND 5-페르소나 CRITICAL 0. MAJOR 는 phase 종료 전 해결 또는 다음 phase 초기 태스크로 명시 이월.
반환: indexPath, critical, major, minor, rootClusters[].`,
  {
    label: 'synthesize',
    phase: 'Synthesize',
    schema: {
      type: 'object',
      required: ['indexPath', 'critical', 'major', 'minor', 'rootClusters'],
      properties: {
        indexPath: { type: 'string' },
        critical: { type: 'number' },
        major: { type: 'number' },
        minor: { type: 'number' },
        rootClusters: { type: 'array', items: { type: 'string' } },
      },
    },
  }
)

// floor 적용: dedup 이 CRITICAL 을 0 으로 만들 수 없으므로 raw CRITICAL>0 이면 게이트용 critical 최소 1
const criticalGate = rawCrit > 0 ? Math.max(synth.critical, 1) : synth.critical
if (rawCrit > 0 && synth.critical === 0) {
  log(
    `⚠️ 자기채점 불일치: synthesize 가 CRITICAL 0 보고했으나 raw 발견 CRITICAL ${rawCrit}건 — floor 1 적용(완료 기준 미충족 처리). INDEX 의 dedup 귀속 확인 필요.`
  )
}
log(
  `5-페르소나 완료: CRITICAL ${criticalGate}(raw ${rawCrit}) / MAJOR ${synth.major}(raw ${rawMajor}) / MINOR ${synth.minor}(raw ${rawMinor}) / 진앙 ${synth.rootClusters?.length || 0}묶음 → ${synth.indexPath}`
)
return {
  indexPath: synth.indexPath,
  critical: criticalGate, // 게이트용(floor 적용) — "완료 기준 CRITICAL 0" 판정에 사용
  criticalReported: synth.critical, // synthesize dedup 후 보고값
  criticalRaw: rawCrit, // 코드 raw 집계 floor
  major: synth.major,
  minor: synth.minor,
  rootClusters: synth.rootClusters,
  personaReports: valid.length,
}
