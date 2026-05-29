export const meta = {
  name: '4pass-review',
  description:
    'ThePick 4-Pass 독립 에이전트 코드정합성 리뷰(Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증 + review-* 보고서 영속',
  whenToUse:
    'L2+ 구현 "완료" 선언 직전(스킵=CRITICAL RULE #4 위반). args={changedFiles?,relatedFiles?,context?,gitRef?,label?} 또는 스코프 문자열, 미지정 시 git diff 자동 스코프.',
  phases: [
    { title: 'Scope', detail: 'git diff + args 로 변경/연관 파일 확정 (규칙1 전체범위)' },
    { title: '4-Pass', detail: 'Surgeon/Architect/Advocate/Contract 4 독립 에이전트' },
    { title: 'Verify', detail: 'CRITICAL/MAJOR 발견마다 적대적 반증 에이전트' },
    { title: 'Report', detail: '.claude/reviews/review-<ts>-4pass-*.md 영속' },
  ],
}

const REPO = '/home/soo/ClaudePro/ThePick'

// ── args 정규화 (문자열=자유 스코프, 객체=명시 파일, undefined=git 자동) ──
const a = args || {}
const isStr = typeof a === 'string'
const userContext = isStr ? a : a.context || ''
const seedChanged = !isStr && Array.isArray(a.changedFiles) ? a.changedFiles : []
const seedRelated = !isStr && Array.isArray(a.relatedFiles) ? a.relatedFiles : []
const gitRef = (!isStr && a.gitRef) || 'HEAD'
const label = ((!isStr && a.label) || 'changes').replace(/[^a-zA-Z0-9._-]/g, '-')

// ── 공통 schema ──
const FINDING = {
  type: 'object',
  required: ['severity', 'title', 'file', 'line', 'detail', 'confirmations', 'devilsAdvocate'],
  properties: {
    severity: { type: 'string', enum: ['CRITICAL', 'MAJOR', 'MINOR'] },
    title: { type: 'string' },
    file: { type: 'string', description: '파일 경로 (없으면 N/A)' },
    line: { type: 'string', description: '라인 번호/범위 (없으면 N/A)' },
    detail: { type: 'string' },
    confirmations: {
      type: 'array',
      items: { type: 'string' },
      description: '실제 확인한 file:line 근거 (0건 보고 시에도 3개+ 필수, 규칙2)',
    },
    devilsAdvocate: { type: 'string', description: '이게 깨질 수 있는 시나리오 1개+ (규칙3)' },
    suggestedFix: { type: 'string' },
  },
}
const PASS_SCHEMA = {
  type: 'object',
  required: ['pass', 'findings', 'checkedItems'],
  properties: {
    pass: { type: 'string' },
    findings: { type: 'array', items: FINDING },
    checkedItems: {
      type: 'array',
      items: { type: 'string' },
      description: 'PASS/N/A 구분한 확인 항목 (file:line 증거). PASS=확인 후 문제없음, N/A=프로젝트에 해당 없음',
    },
  },
}
const VERDICT = {
  type: 'object',
  required: ['refuted', 'reasoning'],
  properties: {
    refuted: { type: 'boolean', description: '반증 성공(=거짓 양성)이면 true → 발견 폐기' },
    reasoning: { type: 'string' },
    severityAdjust: { type: 'string', enum: ['keep', 'downgrade', 'upgrade'] },
  },
}

// ── Phase 1: Scope ──────────────────────────────────────────────
phase('Scope')
const scope = await agent(
  `ThePick 4-Pass 리뷰의 리뷰 범위를 확정한다. 리포 루트: ${REPO}
다음을 실행해 변경 집합을 수집:
- \`git -C ${REPO} status --porcelain\`
- \`git -C ${REPO} diff --stat ${gitRef}\` 및 \`git -C ${REPO} diff --name-only ${gitRef}\`
사용자 지정 변경 파일: ${JSON.stringify(seedChanged)}
사용자 지정 연관 파일: ${JSON.stringify(seedRelated)}
컨텍스트: ${userContext || '(없음)'}
규칙1(전체범위): 변경 파일뿐 아니라 그와 연계된 파일(import 관계, 동일 모듈, 호출 측, 동일 DB 테이블 사용처)도 relatedFiles 에 포함하라. "이 Step 에서 안 건드렸으니 Pass" 금지.
반환: changedFiles[], relatedFiles[], summary(무엇이 바뀌었나 2~3문장), defconGuess(L1/L2/L3 + 이유).`,
  {
    label: 'scope',
    phase: 'Scope',
    schema: {
      type: 'object',
      required: ['changedFiles', 'relatedFiles', 'summary'],
      properties: {
        changedFiles: { type: 'array', items: { type: 'string' } },
        relatedFiles: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' },
        defconGuess: { type: 'string' },
      },
    },
  }
)
const fileList = [...new Set([...(scope.changedFiles || []), ...(scope.relatedFiles || [])])]
log(`스코프: 변경 ${scope.changedFiles?.length || 0} + 연관 ${scope.relatedFiles?.length || 0} (DEFCON ${scope.defconGuess || '?'})`)

// ── 4-Pass 정의 (auto-review-protocol.md 기준) ──
const PASSES = [
  {
    key: 'Surgeon',
    view: 'Bottom-Up 코드 정합성 — "이 코드 단독으로 터지는 경로가 있는가?"',
    checklist: `- Null/Undefined: D1 \`.first()\` 반환 null 후 크래시 경로
- Async: await 누락 (D1 쿼리, Vectorize, Claude API, pdfplumber subprocess)
- 경계값: 빈 배열(노드 0건), NaN(산식 변수 누락), 음수(FSRS interval)
- 에러 처리: 빈 catch 금지, Graceful Degradation(유사도<0.60 거부)
- 산식 정밀도: 부동소수점 오차, numeric_value vs value 혼용
- Formula Engine: 동적 코드 실행 함수 금지 — math.js AST 만 허용`,
  },
  {
    key: 'Architect',
    view: 'Top-Down 연계 — "이 코드가 다른 모듈과 만나면 터지는가?"',
    checklist: `- Import 방향: packages/ 간 단방향 (quality→parser OK, 역방향 X)
- Workers 제약: fs/path 금지, CPU 50ms, 번들 크기
- D1 스키마 일치: Drizzle 타입 ↔ 실제 D1 shape
- Ontology Lock: 새 ID 가 ontology-registry.json 에 등록
- truth_weight 정렬: LAW>FORMULA>CONCEPT
- Temporal Graph: UPDATE 대신 INSERT+SUPERSEDES
- IndexedDB↔D1 동기화, 다이어그램 정합성, Hexagonal 위반, i18n 하드코딩`,
  },
  {
    key: 'Advocate',
    view: 'Cross-Cutting UX+보안 — "수험생과 공격자, 둘 다 만족하는가?"',
    checklist: `- 에러 UX: "교재 O장 참고" Graceful vs 기술 에러 노출
- 상태 표현: 로딩/빈데이터(기출0건)/에러/오프라인 UI
- 오프라인: Service Worker 캐싱 전략 적절성
- 접근성: 모바일80% — 터치44px+, 키보드, aria-label
- 보안: API키 하드코딩, XSS(innerHTML), 입력 검증
- 정답 안전: OX/빈칸/변형 정답 100% 정확 (Hard Stop)`,
  },
  {
    key: 'Contract',
    view: '기획 대조 Silent Pivot — "구현 재정립서 v2.0 대로 만들었는가?"',
    checklist: `- 설계서 대조: docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md
- Hard Limit/Hard Rules 위반 전수 체크 (CLAUDE.md)
- 수치/임계값: constants 값 ↔ 교재 원문 일치
- 배치 순서: BATCH N 검증 완료 후 N+1
- 네이밍: 노드 ID 컨벤션 (CONCEPT-001, F-01, INS-01)`,
  },
]

// ── Phase 2+3: 각 Pass 완료 즉시 그 발견을 반증 (pipeline, barrier 없음) ──
phase('4-Pass')
const reviewed = await pipeline(
  PASSES,
  (p) =>
    agent(
      `당신은 ThePick 4-Pass 리뷰의 Pass [${p.key}] 독립 리뷰어다. 코드 작성 맥락을 전혀 모르므로 의도 편향 0 (규칙0).
관점: ${p.view}
리뷰 범위(전수 확인 의무): ${JSON.stringify(fileList)}
스코프 요약: ${scope.summary}
체크리스트:
${p.checklist}
기준 문서: ${REPO}/.claude/rules/auto-review-protocol.md 와 production-quality.md 를 Read 하여 정확한 기준 적용.
각 파일을 Read 로 직접 열어 확인. 규칙2(증거): 모든 발견·PASS·N/A 판정에 file:line 근거를 checkedItems 에 명시(0건이라도 3개+). 규칙3(반론): 각 발견에 devilsAdvocate.
stub/TODO/placeholder/빈 catch 발견 시 CRITICAL. 테스트 통과=안전 가정 금지.`,
      { label: `pass:${p.key}`, phase: '4-Pass', schema: PASS_SCHEMA }
    ),
  // async 보장: 무발견 분기(plain object)와 발견 분기(parallel Promise)를 모두
  // Promise 로 균일 반환 → pipeline 의 sync/Promise 정규화 계약에 비의존 (MINOR #1)
  async (passResult, p) => {
    const findings = passResult?.findings || []
    const toVerify = findings.filter((f) => f.severity !== 'MINOR')
    if (!toVerify.length)
      return { pass: p.key, findings, checkedItems: passResult?.checkedItems || [] }
    return parallel(
      toVerify.map((f) => () =>
        agent(
          `다음 4-Pass [${p.key}] 발견을 적대적으로 반증하라. 기본 입장: "거짓 양성일 수 있다".
발견: ${JSON.stringify(f)}
해당 file:line 을 직접 Read 로 열어 검증. 코드가 실제로 그 경로로 터지는가? 이미 가드/테스트가 막고 있지 않은가? 상위 호출이 입력을 보증하지 않는가?
반증되면 refuted=true(발견 폐기). 진짜 위험이면 refuted=false + severity 조정 의견(severityAdjust).`,
          {
            label: `verify:${p.key}:${(f.title || '').slice(0, 18)}`,
            phase: 'Verify',
            schema: VERDICT,
          }
        ).then((v) => ({ ...f, verdict: v }))
      )
    ).then((verified) => ({
      pass: p.key,
      checkedItems: passResult?.checkedItems || [],
      findings: [
        ...findings.filter((f) => f.severity === 'MINOR'),
        ...verified
          .filter(Boolean)
          .filter((f) => !f.verdict?.refuted)
          .map((f) => {
            if (f.verdict?.severityAdjust === 'downgrade')
              return { ...f, severity: f.severity === 'CRITICAL' ? 'MAJOR' : 'MINOR' }
            if (f.verdict?.severityAdjust === 'upgrade')
              return { ...f, severity: f.severity === 'MAJOR' ? 'CRITICAL' : f.severity }
            return f
          }),
      ],
    }))
  }
)

// ── Phase 4: Report ─────────────────────────────────────────────
phase('Report')
const allFindings = reviewed
  .filter(Boolean)
  .flatMap((r) => (r.findings || []).map((f) => ({ ...f, pass: r.pass })))
const crit = allFindings.filter((f) => f.severity === 'CRITICAL')
const major = allFindings.filter((f) => f.severity === 'MAJOR')
const minor = allFindings.filter((f) => f.severity === 'MINOR')
const checkedByPass = reviewed
  .filter(Boolean)
  .map((r) => ({ pass: r.pass, checkedItems: r.checkedItems }))

const report = await agent(
  `ThePick 4-Pass 리뷰 보고서를 작성·영속하라.
1) \`date +%Y%m%d-%H%M%S\` 실행해 타임스탬프 ts 획득.
2) ${REPO}/.claude/rules/auto-review-protocol.md "보고 형식" 을 그대로 따라 4-PASS REVIEW 블록 작성(Pass1~4: ✅/🔴/🟠/N/A 카운트 + 확인 증거 3개+ + 반론 + 판정). 리뷰 방식 = "독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증".
3) 확정 발견(반증 통과분만): CRITICAL ${crit.length} / MAJOR ${major.length} / MINOR ${minor.length}.
   발견 데이터: ${JSON.stringify(allFindings)}
   Pass별 확인 항목: ${JSON.stringify(checkedByPass)}
   스코프: ${JSON.stringify({ changed: scope.changedFiles, related: scope.relatedFiles, summary: scope.summary })}
4) ${REPO}/.claude/reviews/review-<ts>-4pass-${label}.md 로 Write (review-* prefix 의무 = review-gate.sh hook 정합).
5) 판정: CRITICAL 0 이면 "완료 가능", 아니면 "수정 필요".
반환: reportPath, verdict.`,
  {
    label: 'report',
    phase: 'Report',
    schema: {
      type: 'object',
      required: ['reportPath', 'verdict'],
      properties: { reportPath: { type: 'string' }, verdict: { type: 'string' } },
    },
  }
)

log(`4-Pass 완료: CRITICAL ${crit.length} / MAJOR ${major.length} / MINOR ${minor.length} → ${report.reportPath}`)
return {
  reportPath: report.reportPath,
  verdict: report.verdict,
  critical: crit.length,
  major: major.length,
  minor: minor.length,
  findings: allFindings,
}
