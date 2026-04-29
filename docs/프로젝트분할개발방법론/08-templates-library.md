# 📦 08. TEMPLATES LIBRARY

## 복사하여 즉시 사용 가능한 양식·스크립트·설정 모음

> **"A template is a head start. A working system from day one."**
>
> — DEV COVEN

---

**버전:** v1.0
**선행 문서:** 00~07 모든 방법론 문서
**용도:** 복사 → 프로젝트 맞춤 수정 → 즉시 사용

---

# 0. 이 문서의 사용법

## 0.1 패턴별 시작 패키지

```
Pattern 0 (Single Module): Section 1, 2 (CLAUDE.md, plan.md)
Pattern 1 (Phase-based): Section 1, 2, 3 (Phase 양식)
Pattern 2 (5-Plane): 모든 Section
Pattern 3 (Pipeline): Section 1, 2, 4, 7 (Lineage)
Pattern 4 (Domain Vertical): Section 1, 2, 5, 7
Pattern 5 (Core-Plugin): Section 1, 2, 6 (Plugin template)
Pattern 6 (Hybrid): 모든 Section
```

---

# 1. CLAUDE.md 템플릿

## 1.1 루트 CLAUDE.md (5-Plane Hybrid)

```markdown
# CLAUDE.md — {프로젝트명}

> 이 프로젝트는 VOID DEV UNIFIED CONSTITUTION v3.3 +
> VOID PROJECT DECOMPOSITION METHODOLOGY v1.0을 따른다.

## 🎯 프로젝트 정의

- 한 줄: "{북극성 한 줄}"
- 패턴: 5-Plane Hybrid (02. Pattern Catalog)
- DEFCON: L2 (default), L3 forced for {결제, 인증, AI}

## 📚 SSOT 위치

- 북극성: docs/shared/NORTH_STAR.md
- 도메인 모델: docs/shared/DOMAIN_MODEL.md
- Hard Limit: docs/shared/HARD_LIMITS.md
- Counter-Directive: docs/shared/COUNTER_DIRECTIVES.md

## 🪪 Plane 구조

- P0 Orchestra: docs/plane/p0-orchestra/
- P1 Foundation: docs/plane/p1-foundation/
- P2 Engine: docs/plane/p2-engine/
- P3 Service: docs/plane/p3-service/
- P4 Experience: docs/plane/p4-experience/
- CC Cross-Cutting: docs/plane/cc-cross-cutting/

## 📜 방법론 참조

- 진단: docs/methodology/01-diagnosis-framework.md
- 패턴: docs/methodology/02-pattern-catalog.md
- 운영: docs/methodology/06-operating-manual.md

## 🚨 Counter-Directive (요약)

{프로젝트 특화 8개+}

## 🔒 Implementation Lock

- 현재 상태: 🔓 UNLOCKED (since {date})

## 🧠 자가 운용 학습 기록

{매 세션 종료 시 추가}

### {날짜} ({Plane})

- 자주 한 실수: ...
- 학습: ...
```

## 1.2 Plane 별 CLAUDE.md (선택, packages/{plane}/CLAUDE.md)

```markdown
# CLAUDE.md — Plane {N} {Name}

## 🪪 정체성

- Role ID: P2-engine
- Pattern: 5-Plane Hybrid
- DEFCON: L3
- Persona: ARCHITECT (주) + HACKER (협력)

## 📂 작업 영역

- 쓰기: packages/engine/, docs/plane/p2-engine/
- 읽기 전용: packages/foundation/, packages/cross-cutting/
- 절대 금지: 다른 packages/, root config

## 📚 의무 로드 (세션 시작)

1. /CLAUDE.md (루트)
2. docs/shared/NORTH_STAR.md
3. docs/shared/DOMAIN_MODEL.md
4. docs/shared/COUNTER_DIRECTIVES.md
5. docs/plane/p2-engine/research.md
6. docs/plane/p2-engine/plan.md
7. .project/plane-states/p2.json

## 🎯 골든 스레드

"15-rule 린터 정확도 100%."

## 🚨 P2 한정 Counter-Directive

- CD-E1: 다른 Plane internal import 금지
- CD-E2: AI 호출 전 Cost Cap 체크
- CD-E3: 3+단계 파이프라인은 Lineage 의무
```

---

# 2. Plan.md 템플릿

```markdown
# Plan: {Plane}/{Story ID}

## 🎯 목표

{Story가 달성할 비즈니스 가치}

## 📋 Task 분해

### Task 1: {제목}

- 타입: IMPL | DESIGN | DOC | TEST
- Contract: docs/contracts/{Task ID}.contract.yaml
- 추정: 4시간 (낙관) / 10시간 (현실, ×2.5)
- 의존: {다른 Task}

### Task 2: ...

## 🔍 영향 분석

- 영향 받는 Plane: {목록}
- NOTICE 발행 필요: {Yes/No}
- ADR 작성 필요: {Yes/No}

## 🚨 Counter-Directive 적용

- CD-X 위반 가능성 검토: ...

## ✅ 검증 방법

- Unit test: {시나리오}
- BDD: {Given/When/Then}
- 통합 test: {필요 시}

## 📊 Done When

- [ ] 모든 Task 구현
- [ ] Test 100% 통과
- [ ] Contract 일치
- [ ] G4 Story DoD 통과
- [ ] G4.5 통과 (영향 시)

## 🧠 RAR Cycle

- Iteration 1: {인간 검토 결과}
- Iteration 2: {수정 후 재검토}
- 종료 조건: {인간 승인}
```

---

# 3. Phase 양식 (Pattern 1)

```markdown
# Phase {N}: {제목}

## 🎯 Phase 목표

{이 Phase가 달성할 비즈니스 마일스톤}

## ⏱️ 시간

- 시작: {date}
- 종료 예정: {date} ({weeks}주)
- 끝나야 시작 가능한 다음 Phase: Phase {N+1}

## ✅ 종료 조건

- [ ] {기능 1} 동작
- [ ] {기능 2} 동작
- [ ] G7 통과
- [ ] 사용자 가이드 작성

## 📦 산출물

- 배포된 버전: {URL}
- 사용자 가이드: docs/users/phase-{N}.md
- 학습된 정보: docs/learnings/phase-{N}.md

## 🔮 다음 Phase 입력

- {이 Phase에서 검증된 가정}
- {이 Phase에서 학습된 사용자 행동}
```

---

# 4. Pipeline Stage 양식 (Pattern 3)

```yaml
# docs/plane/stage-{N}/contract.yaml

stage_id: 'stage-2-transcribe'
stage_name: '음성 채보'
position_in_pipeline: 2 of 4

# 입력 (이전 Stage에서)
input:
  format: 'WAV stems (4 channels)'
  upstream_stage: 'stage-1-audio'
  schema: 'schemas/wav-stems.schema.json'

# 출력 (다음 Stage로)
output:
  format: 'MIDI (PrettyMIDI)'
  downstream_stage: 'stage-3-notation'
  schema: 'schemas/midi.schema.json'

# 처리
processing:
  algorithm: 'MT3'
  expected_loss_rate: '<10%'
  performance:
    p95: '<3s for 3min audio'

# Lineage
lineage:
  enable: true
  metrics:
    - 'input_audio_duration'
    - 'output_midi_notes_count'
    - 'processing_time'
    - 'loss_estimation'

# Failure
failure_modes:
  - mode: 'Audio format invalid'
    fallback: 'Reject with clear error'
  - mode: 'MT3 timeout'
    fallback: 'Try Basic-Pitch as backup'
```

---

# 5. Domain Vertical 양식 (Pattern 4)

```yaml
# docs/plane/domain-{name}/role-card.yaml

domain_id: 'memo'
bounded_context: 'Memo'

# Aggregates
aggregates:
  - name: 'Memo'
    root: true
    invariants:
      - 'title 최대 200자'
      - 'content 최대 100,000자'
  - name: 'Highlight'
    root: false # Memo의 부속

# Domain Events (외부에 발행)
events_published:
  - 'MemoCreated'
  - 'MemoLinked' # to Book
  - 'MemoArchived'

# 외부 도메인 의존 (Anti-corruption Layer 의무)
external_dependencies:
  - domain: 'book'
    via: 'BookId only (값 객체)'
    acl: 'infrastructure/book-acl.ts'

# Shared Kernel (도메인 간 공유)
shared_kernel:
  - 'UserId (from auth)'
  - 'Timestamp'
```

---

# 6. Plugin 양식 (Pattern 5)

## 6.1 Plugin Template

```typescript
// packages/plugins/plugin-{name}/src/index.ts

import { VoidPlugin } from '@void/core/plugin-interface';

export const plugin: VoidPlugin = {
  id: 'plugin-{name}',
  name: '{한국어 이름}',
  description: '{1줄 설명}',
  version: '1.0.0',
  category: 'utility',
  defcon: 'L1',

  async render(container, props) {
    // Plugin 진입점
  },

  onMount() {},
  onUnmount() {},
};

export default plugin;
```

## 6.2 Plugin scaffold 스크립트

```bash
#!/usr/bin/env bash
# scripts/new-plugin.sh

PLUGIN_NAME=$1
if [ -z "$PLUGIN_NAME" ]; then
  echo "사용법: ./scripts/new-plugin.sh plugin-name"
  exit 1
fi

PLUGIN_DIR="packages/plugins/${PLUGIN_NAME}"

if [ -d "$PLUGIN_DIR" ]; then
  echo "❌ Plugin이 이미 존재: $PLUGIN_DIR"
  exit 1
fi

# 디렉토리 생성
mkdir -p "${PLUGIN_DIR}/src"
mkdir -p "${PLUGIN_DIR}/tests"

# package.json
cat > "${PLUGIN_DIR}/package.json" <<EOF
{
  "name": "@void/${PLUGIN_NAME}",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "@void/core": "workspace:*"
  }
}
EOF

# index.ts (위 template 복사)
cp packages/plugin-template/src/index.ts.template "${PLUGIN_DIR}/src/index.ts"
sed -i "s/{name}/${PLUGIN_NAME}/g" "${PLUGIN_DIR}/src/index.ts"

# Test
cat > "${PLUGIN_DIR}/tests/index.test.ts" <<EOF
import { describe, it, expect } from 'vitest';
import { plugin } from '../src';

describe('${PLUGIN_NAME}', () => {
  it('exports valid plugin', () => {
    expect(plugin.id).toBe('plugin-${PLUGIN_NAME}');
  });
});
EOF

# Registry에 등록 (반자동)
echo ""
echo "✅ Plugin 생성됨: ${PLUGIN_DIR}"
echo ""
echo "📋 다음 단계:"
echo "  1. ${PLUGIN_DIR}/src/index.ts 의 description 수정"
echo "  2. render() 함수 구현"
echo "  3. packages/core/src/registry/index.ts에 등록 추가:"
echo "     export { default as ${PLUGIN_NAME} } from '@void/${PLUGIN_NAME}';"
echo "  4. pnpm install"
echo "  5. 테스트: pnpm --filter @void/${PLUGIN_NAME} test"
```

---

# 7. Task Contract 템플릿

```yaml
# docs/contracts/{Task ID}.contract.yaml

contract_id: 'P2-E1-S2-T1'
task_type: 'IMPL'
plane: 'P2'
epic: 'P2-E1'
story: 'P2-S2'
task: 'Rule 1 검증 함수 구현'

# 입력
inputs:
  - name: 'lineItems'
    type: 'LineItem[]'
    contract: 'packages/foundation/contracts/LineItemSchema.ts'

# 출력
outputs:
  - name: 'result'
    type: 'Result<RuleViolation[], RuleEngineError>'

# 부수 효과
side_effects:
  - 'Logger 호출'
  - 'Cost Tracker (AI 사용 시)'

# 외부 의존
external_deps:
  - 'P1.LineItem (type)'
  - 'CC.logger'

# 금지 의존
forbidden_deps:
  - 'P3.* (Service Layer)'
  - 'Direct DB'

# 성능
performance:
  p50: '<5ms'
  p95: '<20ms'
  p99: '<50ms'

# 검증
verification:
  unit_tests: 5
  bdd_scenarios: 2
  integration_test: false # 단순 함수

# 완료
done_when:
  - 'Test 100%'
  - 'Contract 일치'
  - 'P3에서 import 가능'

# 페르소나
primary_persona: 'ARCHITECT'
secondary_persona: 'HACKER'

# 시간
estimated_hours: 4
realistic_hours: 10
```

---

# 8. ADR 템플릿

```markdown
# ADR-{N}: {결정 제목}

## 상태

- Status: {Proposed | Accepted | Superseded by ADR-X}
- Date: {YYYY-MM-DD}
- Deciders: {페르소나 또는 인간}

## 컨텍스트

{왜 이 결정이 필요한가? 어떤 문제?}

## 결정

{무엇을 결정했나?}

## 사유

{왜 이 결정인가? 대안은?}

### 대안 검토

1. **대안 A**: ...
   - 장점: ...
   - 단점: ...
2. **대안 B**: ...
3. **선택된 안**: ...

## 결과

- 긍정: {이 결정의 좋은 영향}
- 부정: {이 결정의 단점/비용}
- 영향 받는 Plane: {목록}

## 검증 계획

- 어떻게 이 결정이 옳았는지 알 수 있나?
- 메트릭? 시간?

## 관련

- 영향 SSOT: {파일들}
- 관련 NOTICE: {ID}
- 후속 ADR: {있을 시}
```

---

# 9. 셋업 스크립트 모음

## 9.1 init-5plane.sh — 5-Plane 골격 자동 생성

```bash
#!/usr/bin/env bash
# scripts/init-5plane.sh

set -euo pipefail

echo "🎼 5-Plane 골격 초기화..."

# packages
mkdir -p packages/{foundation,engine,service-user,service-admin,ui,i18n,cross-cutting}/src

for plane in foundation engine service-user service-admin ui i18n cross-cutting; do
  cat > "packages/${plane}/src/index.ts" <<EOF
// @void/${plane} — 공개 인터페이스
export {};
EOF
  cat > "packages/${plane}/package.json" <<EOF
{
  "name": "@void/${plane}",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts"
}
EOF
done

# docs
mkdir -p docs/{shared,plane/{p0-orchestra,p1-foundation,p2-engine,p3-service,p4-experience,cc-cross-cutting},adr,contracts,methodology}

for f in NORTH_STAR DOMAIN_MODEL API_CONTRACTS DESIGN_TOKENS COUNTER_DIRECTIVES HARD_LIMITS FORBIDDEN; do
  cat > "docs/shared/${f}.md" <<EOF
# ${f}
> SSOT — 변경 시 NOTICE 자동 발행

(Stage 0에서 작성)
EOF
done

# .claude
mkdir -p .claude/{plane-contexts,notices/processed,hooks,commands}

# .project
mkdir -p .project/plane-states
for plane in p0 p1 p2 p3 p4 cc; do
  cat > ".project/plane-states/${plane}.json" <<EOF
{
  "plane": "${plane}",
  "current_story": "(없음)",
  "implementation_lock": "🔒 LOCKED",
  "progress": { "completed_tasks": 0, "total_tasks": 0, "percentage": 0 },
  "last_updated": "$(date -Iseconds)"
}
EOF
done

# 초기 state.json
cat > .project/state.json <<EOF
{
  "project": "$(basename $(pwd))",
  "started_at": "$(date -Iseconds)",
  "active_planes": [],
  "today_focus": "Stage -1 시작",
  "active_sessions": [],
  "implementation_lock": "🔒 LOCKED"
}
EOF

echo "✅ 5-Plane 골격 완료"
```

## 9.2 setup-notices.sh — NOTICE 시스템 셋업

```bash
#!/usr/bin/env bash
# scripts/setup-notices.sh

mkdir -p .claude/hooks .claude/notices/processed

# notice-broadcast.js (04. Info Sharing 참조)
cat > .claude/hooks/notice-broadcast.js <<'EOF'
const fs = require('node:fs');
const path = require('node:path');

const filePath = process.argv[2];
if (!filePath) process.exit(0);

const sourcePlane = process.env.CLAUDE_PLANE || 'unknown';
const noticeDir = '.claude/notices';
fs.mkdirSync(noticeDir, { recursive: true });

const rules = [
  { pattern: /^docs\/shared\//, type: 'SSOT_CHANGE', severity: 'critical', planes: ['P0','P1','P2','P3','P4','CC'] },
  { pattern: /^packages\/foundation\/schema/, type: 'SCHEMA_CHANGE', severity: 'high', planes: ['P2','P3'] },
  { pattern: /^packages\/foundation\/contracts/, type: 'API_CONTRACT_CHANGE', severity: 'high', planes: ['P3','P4'] },
  { pattern: /^docs\/adr\//, type: 'ADR_PUBLISHED', severity: 'high', planes: ['P0','P1','P2','P3','P4','CC'] }
];

const matched = rules.find(r => r.pattern.test(filePath));
if (!matched) process.exit(0);

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const slug = path.basename(filePath).replace(/\..+$/, '').toLowerCase();
const noticePath = path.join(noticeDir, `${ts}_${matched.type.toLowerCase()}-${slug}.md`);

const content = `---
notice_id: "${ts}"
created_at: "${new Date().toISOString()}"
type: "${matched.type}"
severity: "${matched.severity}"
source_plane: "${sourcePlane}"
affected_planes: ${JSON.stringify(matched.planes.filter(p => p !== sourcePlane))}
status: "open"
---

# 🔔 NOTICE: ${matched.type}

## 변경 파일
\`${filePath}\`

## 영향 받는 Plane
${matched.planes.filter(p => p !== sourcePlane).map(p => `- ${p}`).join('\n')}

## 액션
영향 받는 Plane은 다음 작업 시작 전 변경 내용 확인하고 ack 갱신.
`;

fs.writeFileSync(noticePath, content);
console.log(`🔔 NOTICE: ${noticePath}`);
EOF

# notice-check.js
cat > .claude/hooks/notice-check.js <<'EOF'
const fs = require('node:fs');
const path = require('node:path');

const noticeDir = '.claude/notices';
if (!fs.existsSync(noticeDir)) process.exit(0);

const myPlane = process.env.CLAUDE_PLANE;
if (!myPlane) process.exit(0);

const notices = fs.readdirSync(noticeDir).filter(f => f.endsWith('.md'));
const relevant = notices.filter(n => {
  const content = fs.readFileSync(path.join(noticeDir, n), 'utf-8');
  return content.includes(`affected_planes`) && content.includes(myPlane);
});

if (relevant.length > 0) {
  console.error(`\n⚠️  ${myPlane} 미처리 NOTICE ${relevant.length}개:`);
  relevant.forEach(n => console.error(`   - ${n}`));
  console.error(`\n읽고 ack 갱신 후 작업 진행하세요.\n`);
}
EOF

# settings.json
cat > .claude/settings.json <<'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/notice-broadcast.js \"${CLAUDE_TOOL_FILE:-}\"" }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/notice-check.js" }]
      }
    ]
  }
}
EOF

echo "✅ NOTICE 시스템 셋업 완료"
```

## 9.3 daily-alignment.sh — 일일 정렬

```bash
#!/usr/bin/env bash
# scripts/daily-alignment.sh

clear
echo "═══════════════════════════════════════════"
echo "  🎼 DAILY ALIGNMENT — $(date '+%Y-%m-%d %A')"
echo "═══════════════════════════════════════════"

echo ""
echo "▶ NOTICE Dashboard"
UNPROCESSED=$(ls .claude/notices/*.md 2>/dev/null | wc -l)
echo "  미처리: $UNPROCESSED"

if [ "$UNPROCESSED" -gt 0 ]; then
  for f in .claude/notices/*.md; do
    [ -f "$f" ] || continue
    SEVERITY=$(grep "^severity:" "$f" 2>/dev/null | awk '{print $2}' | tr -d '"')
    TYPE=$(grep "^type:" "$f" 2>/dev/null | awk '{print $2}' | tr -d '"')
    echo "  [$SEVERITY] $TYPE — $(basename $f)"
  done
fi

echo ""
echo "▶ Plane 상태"
for f in .project/plane-states/*.json; do
  [ -f "$f" ] || continue
  PLANE=$(jq -r '.plane' $f)
  STORY=$(jq -r '.current_story' $f)
  PROG=$(jq -r '.progress.percentage' $f)
  LOCK=$(jq -r '.implementation_lock' $f)
  echo "  $PLANE: $STORY ($PROG%) $LOCK"
done

echo ""
echo "▶ Plane 브랜치 미머지"
git branch | grep "plane/" | while read b; do
  b=$(echo $b | tr -d ' ')
  AGE=$(git log -1 --format="%cr" $b 2>/dev/null)
  echo "  $b — $AGE"
done

echo ""
echo "═══════════════════════════════════════════"
```

## 9.4 plane-dashboard.sh

```bash
#!/usr/bin/env bash
# scripts/plane-dashboard.sh

while true; do
  clear
  echo "═══════════════════════════════════════════"
  echo "  📊 PLANE DASHBOARD — $(date +%H:%M:%S)"
  echo "═══════════════════════════════════════════"

  for f in .project/plane-states/*.json; do
    PLANE=$(jq -r '.plane' $f)
    STORY=$(jq -r '.current_story' $f)
    PROG=$(jq -r '.progress.percentage' $f)
    LOCK=$(jq -r '.implementation_lock' $f)
    LAST=$(jq -r '.last_updated' $f)

    echo ""
    echo "  $PLANE"
    echo "    Story: $STORY"
    echo "    Progress: $PROG%"
    echo "    Lock: $LOCK"
    echo "    Last: $LAST"
  done

  echo ""
  echo "─── NOTICE ───"
  UNPROC=$(ls .claude/notices/*.md 2>/dev/null | wc -l)
  echo "  미처리: $UNPROC"

  echo ""
  echo "Ctrl+C to exit"
  sleep 30
done
```

---

# 10. ESLint + pre-commit 설정

## 10.1 eslint.config.js (영역 침범 방지)

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint';

export default tseslint.config({
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            // Internal 모듈 직접 import 금지
            group: ['@void/*/src/**', '!@void/*/src/index', '!@void/*/src/index.ts'],
            message: '다른 Plane의 internal 모듈 import 금지. barrel(index.ts) 사용.',
          },
          {
            // P4 → P2 직접 의존 금지 (P3 통해서만)
            group: ['@void/engine'],
            // 적용 범위는 별도 설정 (overrides)
            message: 'P4 Experience는 P2 Engine 직접 의존 금지. P3 Service 통해서.',
          },
        ],
      },
    ],
  },
});
```

## 10.2 .husky/pre-commit (영역 침범 검증)

```bash
#!/usr/bin/env bash
. "$(dirname -- "$0")/_/husky.sh"

PLANE=${CLAUDE_PLANE:-unknown}

if [ "$PLANE" != "unknown" ] && [ "$PLANE" != "P0" ]; then
  declare -A ALLOWED
  ALLOWED[P1]="^(packages/foundation/|docs/plane/p1-foundation/|docs/contracts/p1-)"
  ALLOWED[P2]="^(packages/engine/|docs/plane/p2-engine/|docs/contracts/p2-)"
  ALLOWED[P3]="^(packages/service-|apps/web/src/api/|apps/web/src/admin/|docs/plane/p3-service/|docs/contracts/p3-)"
  ALLOWED[P4]="^(packages/ui/|packages/i18n/|apps/web/src/pages/|apps/web/src/components/|docs/plane/p4-experience/|docs/contracts/p4-)"
  ALLOWED[CC]="^(packages/cross-cutting/|docs/plane/cc-cross-cutting/|docs/contracts/cc-)"

  PATTERN=${ALLOWED[$PLANE]}
  if [ -z "$PATTERN" ]; then
    exit 0
  fi

  VIOLATING=$(git diff --cached --name-only | grep -vE "$PATTERN" || true)

  if [ -n "$VIOLATING" ]; then
    echo "❌ Plane 영역 침범 감지!"
    echo "   당신은 $PLANE — 다음 파일은 다른 영역:"
    echo "$VIOLATING" | sed 's/^/     /'
    echo ""
    echo "옵션:"
    echo "  A. 다른 Plane 세션으로 전환해서 작업"
    echo "  B. ADR 작성 후: SKIP_OWNERSHIP=1 git commit"

    if [ "${SKIP_OWNERSHIP:-0}" != "1" ]; then
      exit 1
    fi
  fi
fi

# Lint + Test
pnpm lint
pnpm typecheck
```

---

# 11. CI/CD 워크플로우

```yaml
# .github/workflows/ci.yml
name: CI

on: [pull_request, push]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm test
      - run: pnpm test:e2e:cross-plane

  gate-4-5: # 분할 프로젝트 핵심
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install

      # Contract Hash 검증
      - run: pnpm verify:contracts

      # Acyclic Dependencies
      - run: pnpm dlx madge --circular packages/

      # NOTICE Resolution
      - name: NOTICE Critical Check
        run: |
          CRITICAL=$(grep -l "severity: critical" .claude/notices/*.md 2>/dev/null | wc -l)
          if [ $CRITICAL -gt 0 ]; then
            echo "❌ Critical NOTICE 미처리: $CRITICAL개"
            exit 1
          fi
```

---

# 12. 슬래시 커맨드 모음 (.claude/commands/)

## 12.1 /void — 메인 진입점

```markdown
# .claude/commands/void.md

당신은 VOID 개발 헌법 v3.3 + DECOMPOSITION METHODOLOGY v1.0 준수 모드입니다.

다음을 수행하세요:

1. 현재 작업 중인 Plane 확인 (CLAUDE_PLANE 환경 변수 또는 사용자 명시)
2. 그 Plane의 plane-context.md 정독
3. 미처리 NOTICE 확인
4. plane-states/{plane}.json 확인
5. 다음 작업 의사 결정

DEFCON 레벨에 따라 작업 강도 조정.
Counter-Directive 위반 가능성 항상 확인.
```

## 12.2 /diagnose — 새 프로젝트 진단

```markdown
# .claude/commands/diagnose.md

새 프로젝트 진단을 시작합니다.

1. Diagnosis Framework 따라:

1. Stage A 규모 진단:
   - 사용자에게 기능 목록 요청
   - 각 기능 1~5 복잡도 평가
   - Tiny/Small/Medium/Large/XLarge 분류

1. Stage B 도메인 진단:
   - 6가지 유형 매칭
   - 특성 (PII, 결제, AI 등)

1. Stage C 인지 부하:
   - 8문항 자가 평가

1. Stage D DEFCON

1. Stage E 분할 결정:
   - YES/NO/DEFER
   - 패턴 후보 도출

산출물: docs/methodology-output/PDS-{project}.yaml
```

## 12.3 /review — 작업 회고

```markdown
# .claude/commands/review.md

방금 완료한 작업을 회고합니다:

1. 완료된 Task 목록
2. 헌법 v3.3 9 Gate 점검:
   - G0: 코드베이스 준수?
   - G1: Counter-Directive?
   - G2: 의도-코드 일치?
   - G3: Test 진실성?
   - G4: Story DoD?
   - G4.5: Plane 통합?
   - G5: Triangle?
   - G5.5: 인간 검증 필요?
   - G6: ADR?

3. 발견된 이슈
4. 학습 기록 (CLAUDE.md 추가)
5. 다음 작업 권장
```

---

# 13. 통합 — 첫날 셋업 명령

```bash
# 새 VOID 프로젝트 생성 + 5-Plane 셋업

# 1. pnpm 모노레포 시작
pnpm init
echo "packages:\n  - apps/*\n  - packages/*" > pnpm-workspace.yaml

# 2. 5-Plane 골격
chmod +x scripts/*.sh
./scripts/init-5plane.sh

# 3. NOTICE 시스템
./scripts/setup-notices.sh

# 4. Husky
pnpm dlx husky install
chmod +x .husky/pre-commit

# 5. 의존성
pnpm add -D vitest typescript @types/node turbo
pnpm add -D dependency-cruiser madge
pnpm add -D js-yaml @types/js-yaml

# 6. CLAUDE.md (위 template 복사)
cp templates/CLAUDE.md.template CLAUDE.md
sed -i "s/{프로젝트명}/$(basename $(pwd))/g" CLAUDE.md

# 7. 메소드론 문서 복사
mkdir -p docs/methodology
cp ~/methodology/*.md docs/methodology/

# 8. 첫 커밋
git init
git add .
git commit -m "chore: 5-Plane 모노레포 + 방법론 v1.0 초기화"

echo ""
echo "✅ 셋업 완료. 다음 단계:"
echo "  1. /diagnose 명령으로 프로젝트 진단"
echo "  2. Stage -1 ~ Stage 0.8 워크북 시작"
echo "  3. UNLOCK 후 Stage 1 코딩"
```

---

# 14. 페르소나 COT 검증 (이 라이브러리)

## 💻 HACKER

> "복붙으로 바로 동작? — 모든 스크립트가 standalone. ✓"

## 👤 ADVOCATE

> "처음 쓰는 사람도 이해? — 각 template에 주석 + 빠른 시작. ✓"

## 👻 GHOST

> "CI/CD 셋업이 표준? — GitHub Actions 양식 제공. ✓"

## 🛡️ SENTINEL

> "secret 누출 위험? — .env 자동 추가 안 함. 명시적 셋업 의무."

## 🎩 MEPHISTO

> "이 라이브러리가 8개 문서의 마지막 — 손에 잡힐 도구 제공. ✓"

---

# 15. 끝

```
이제 8개 문서가 모두 준비됐다.

00. Master Index — 전체 안내
01. Diagnosis Framework — 진단
02. Pattern Catalog — 패턴 선택
03. Role Definition — 역할 정의
04. Information Sharing — 정보 공유
05. Planning Workbook — 기획·설계
06. Operating Manual — 운영
07. Verification Standard — 검증
08. Templates Library — 양식 (이 문서)

각 프로젝트마다 진단부터 시작.
8개 도구로 답을 만들어라.

— DEV COVEN
```

---

**END OF 08. TEMPLATES LIBRARY**

_"Templates are the knowledge of past projects, gifted to future ones."_
