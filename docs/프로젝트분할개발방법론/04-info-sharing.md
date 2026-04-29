# 🔔 04. INFORMATION SHARING PROTOCOL

## 분할된 세션 간 정보를 어떻게 동기화하나

> **"공유 없이 분할하면, N개의 진실이 만들어진다.**
> **N개의 진실은 머지 시점에 폭발한다."**
>
> — BREAKER

---

**버전:** v1.0
**선행 문서:** 03. Role Definition (Role 정의 후)
**연계 문서:** 06. Operating Manual

---

# 0. 이 문서의 핵심

## 0.1 풀려는 문제

```
다중 세션 운영의 근본 위험:

  세션 A (P2 Engine)이 5월 1일 코드 수정
  세션 B (P3 Service)이 5월 2일 작업 시작
    └ A의 변경을 모름
    └ 이전 인터페이스 가정해서 코드 작성
    └ 5월 5일 머지 → 폭발

이걸 막는 게 정보 공유 프로토콜.
```

## 0.2 4가지 통신 매체

```
              ┌─────────────────────────────────────────┐
              │  4가지 정보 공유 매체 (Communication Bus) │
              ├─────────────────────────────────────────┤
              │                                          │
              │  1. SSOT  (docs/shared/)                 │
              │     ▶ 모두가 합의한 진실                  │
              │     ▶ 변경 = 모두 영향                   │
              │                                          │
              │  2. NOTICE (.claude/notices/)            │
              │     ▶ 비동기 알림                        │
              │     ▶ 즉시 발행, 작업 시작 시 처리        │
              │                                          │
              │  3. Contract (docs/contracts/)           │
              │     ▶ Role 간 명시적 계약                │
              │     ▶ 변경 시 ADR 의무                   │
              │                                          │
              │  4. State (.project/plane-states/)       │
              │     ▶ 각 Role의 진행 상태                │
              │     ▶ 본인 + P0이 읽음                   │
              │                                          │
              └─────────────────────────────────────────┘
```

---

# 1. 매체 1: SSOT (Single Source of Truth)

## 1.1 SSOT의 정의

```
SSOT (Single Source of Truth):
  프로젝트의 핵심 진실이 정의된 단일 출처.
  모든 Role이 동의하고 참조하는 합의 문서.

  변경 = 모든 Role 영향 = 자동 NOTICE 발행 의무.
```

## 1.2 docs/shared/ 의 6개 핵심 파일

| 파일                      | 내용                                                       | 변경 시 영향                |
| :------------------------ | :--------------------------------------------------------- | :-------------------------- |
| **NORTH_STAR.md**         | 프로젝트 북극성, 골든 스레드                               | 모든 Role의 우선순위 재검토 |
| **DOMAIN_MODEL.md**       | 도메인 엔티티/값 객체 정의                                 | P1, P2, P3 즉시 영향        |
| **API_CONTRACTS.md**      | API 계약 요약 (실제 정의는 packages/foundation/contracts/) | P3, P4 영향                 |
| **DESIGN_TOKENS.md**      | 디자인 토큰 (색/타이포/간격)                               | P4 즉시 영향                |
| **COUNTER_DIRECTIVES.md** | 함정 목록 (헌법 v3.3 Part 5.3)                             | 모든 Role의 코딩 시 주의    |
| **HARD_LIMITS.md**        | 절대 제약 (성능/비용/법적)                                 | 모든 Role 의무              |

## 1.3 SSOT 작성 원칙

```
원칙 1: 단일 진실 (Single Source)
  같은 정보가 여러 곳에 있으면 안 됨.
  ✗ DOMAIN_MODEL.md에 User 정의 + packages/foundation에도 별도 정의
  ✓ DOMAIN_MODEL.md에 요약 + packages/foundation/models/User.ts에 코드 진실

원칙 2: 인간 가독성 우선 (Human-Readable)
  코드를 모르는 인간(미래의 본인)이 읽을 수 있게.
  ✗ TypeScript dump
  ✓ 자연어 설명 + 코드 인용

원칙 3: 변경 시 ADR 의무 (Change requires ADR)
  SSOT 변경 = 프로젝트 방향 영향
  → 헌법 v3.3 Part 7.5 ADR 작성 의무

원칙 4: 자동 broadcast (Auto-Broadcast)
  변경 시 PostToolUse hook이 NOTICE 자동 발행
  → 다른 Role이 다음 작업 시 자동 인지
```

## 1.4 SSOT 표준 양식

### NORTH_STAR.md

```markdown
# 🌟 North Star (북극성)

## 프로젝트 정의

**프로젝트명:** VOID BILL
**한 줄 정의:** AI 검증 견적 관리 SaaS

## 북극성 (Why we exist)

"한국 1인 사업자가 법적으로 완벽한 견적서를 30초에 만들 수 있다."

## 골든 스레드 (이 프로젝트의 모든 결정 기준)

"15-rule 린터의 정확도가 100%여야 한다.
99.5%는 출시 불가. 사용자가 법적으로 보호받지 못한다."

## Hard Limit

- 월 서버 비용 < $50
- GDPR/PIPL 100% 준수
- 견적 검증 응답 시간 < 500ms
- 프리 티어 사용자당 월 50건 무료

## Soft Target

- AI 제안 생성 < 3초
- 모바일 응답성 60fps

## Graceful Degradation

- AI 서비스 실패 시: 규칙 기반 검증만 작동
- 결제 webhook 지연: 24시간 보관 후 재처리

## Forbidden (절대 안 함)

- 사용자 견적 데이터를 AI 학습에 무단 사용
- 데이터를 EU 밖으로 전송 (GDPR)
- "괜찮을 거예요"식 검증 결과 (법적 정확성 100%)
```

### DOMAIN_MODEL.md

```markdown
# 🏛️ Domain Model

## Aggregate

### Quote (견적서)

- 식별자: QuoteId (UUID v7)
- 상태: draft | reviewed | approved | sent | archived
- 불변식:
  - draft 외 상태에서는 line items 추가 불가
  - approved 후에는 customer 변경 불가
- 코드 진실: `packages/foundation/models/Quote.ts`

### Customer (고객)

- 식별자: CustomerId
- 분류: individual | business | tax_exempt
- 코드 진실: `packages/foundation/models/Customer.ts`

### LineItem (견적 항목)

- 부속 엔티티 (Quote의 일부)
- 검증: tax_rate가 카테고리와 일치해야 함

## Domain Events

- QuoteDrafted
- QuoteReviewed (15-rule 통과 시)
- QuoteApproved (customer 동의)
- QuoteSent (이메일 발송)

## 유비쿼터스 언어

- "견적" = Quote
- "검증" = Validation (15-rule 적용)
- "발송" = Send (이메일)

## 변경 이력

| 날짜       | 변경                         | 사유            | ADR     |
| :--------- | :--------------------------- | :-------------- | :------ |
| 2026-05-01 | Quote에 visibility 필드 추가 | Admin 공유 기능 | ADR-007 |
```

## 1.5 SSOT 변경 워크플로우

```
시나리오: P1 (ARCHITECT)이 DOMAIN_MODEL.md에 visibility 필드 추가

1. P1 세션이 docs/shared/DOMAIN_MODEL.md 수정 시도

2. PostToolUse hook 자동 실행:
   → ADR 존재 여부 검증 (옵션)
   → NOTICE 자동 발행:
     .claude/notices/{ts}_ssot-domain-model-change.md
     - severity: high
     - affected_planes: P2, P3, P4
   → 'all SSOT changes' 메일링 리스트에 알림 (선택)

3. P1 세션이 영향 분석 추가:
   - packages/foundation/models/Quote.ts 갱신
   - migration 작성
   - 다른 Role의 acks 추적

4. P2, P3, P4 세션이 다음 시작 시:
   → PreToolUse hook이 NOTICE 검사
   → "미처리 NOTICE 1개" 경고
   → 세션이 NOTICE 읽고, 자기 plan.md에 영향 분석 추가
   → 코드 갱신
   → NOTICE의 ack 필드 갱신

5. 모든 Role ack → NOTICE → processed/ 이동
```

---

# 2. 매체 2: NOTICE 시스템

## 2.1 NOTICE의 종류

| 유형                    | 트리거                   | 영향 범위      | 처리 우선순위 |
| :---------------------- | :----------------------- | :------------- | :------------ |
| **SSOT_CHANGE**         | docs/shared/ 변경        | 모든 Role      | Critical      |
| **SCHEMA_CHANGE**       | DB schema 변경           | P2, P3         | High          |
| **API_CONTRACT_CHANGE** | API 계약 변경            | P3, P4         | High          |
| **ADR_PUBLISHED**       | 새 ADR                   | 영향 받는 Role | High          |
| **DEPENDENCY_REQUEST**  | Role A가 Role B에게 요청 | 대상 Role      | Medium        |
| **INCIDENT**            | 운영 사고                | P0 + 영향 Role | Critical      |
| **DAILY_BRIEFING**      | P0 일일 정렬             | 모든 Role      | Low           |
| **MERGE_NOTICE**        | 머지 완료                | 의존 Role      | Medium        |

## 2.2 NOTICE 표준 형식

````yaml
# .claude/notices/{ISO_timestamp}_{type}-{slug}.md

---
# Frontmatter (자동 파싱용)
notice_id: "20260501T103000_001"
created_at: "2026-05-01T10:30:00Z"
type: "SSOT_CHANGE"
severity: "critical"  # critical | high | medium | low
source_plane: "P1"
source_session: "p1-2026-05-01"
affected_planes: ["P2", "P3", "P4"]
acknowledgments:
  P2: { ack: false, at: null }
  P3: { ack: false, at: null }
  P4: { ack: false, at: null }
status: "open"  # open | in_progress | resolved
expires_at: "2026-05-08T00:00:00Z"  # 일주일 후 자동 escalation
---

# 🔔 NOTICE: SSOT Domain Model Change

## 변경 요약
- 파일: docs/shared/DOMAIN_MODEL.md
- 변경: Memo entity에 'visibility' 필드 추가
- 사유: Admin 공유 기능 (ADR-007 참조)

## 변경 내용 (diff)
```diff
 ### Memo
 - 식별자: MemoId
 - 속성:
   - bookId: BookId
   - content: string
+  - visibility: "private" | "public" | "shared"
+    기본값: "private"
````

## 영향 분석

### P2 Engine

- 영향: Memo 처리 로직에 visibility 분기 추가 필요
- 액션: `packages/engine/memo/` 의 처리 로직 갱신
- 예상 작업: 30분

### P3 Service

- 영향: API 응답 schema에 visibility 노출
- 액션: `packages/service-user/` 의 DTO 갱신
- 예상 작업: 15분

### P4 Experience

- 영향: UI에 visibility 선택 컨트롤 추가
- 액션: `packages/ui/Memo*` 컴포넌트 갱신
- 예상 작업: 1시간

## 관련 문서

- ADR: docs/adr/ADR-007-memo-visibility.md
- 새 코드: packages/foundation/models/Memo.ts (변경됨)

## 처리 방법

1. 위 영향 분석 읽기
2. 자기 Plane의 plan.md에 영향 작업 추가
3. 코드 갱신
4. 이 NOTICE의 frontmatter에서 자기 Plane의 acknowledgments.ack를 true로 변경
5. 모든 Plane이 ack하면 P0이 processed/로 이동

````

## 2.3 NOTICE 자동화 — Hook 시스템

### PostToolUse Hook (NOTICE 발행)

```javascript
// .claude/hooks/notice-broadcast.js
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');  // npm install js-yaml

const filePath = process.argv[2];
if (!filePath) process.exit(0);

const sourcePlane = process.env.CLAUDE_PLANE || 'unknown';
const sourceSession = process.env.CLAUDE_SESSION_ID || 'unknown';

const noticeRules = [
  {
    pattern: /^docs\/shared\//,
    type: 'SSOT_CHANGE',
    severity: 'critical',
    affectedPlanes: ['P0', 'P1', 'P2', 'P3', 'P4', 'CC']
  },
  {
    pattern: /^packages\/foundation\/schema\//,
    type: 'SCHEMA_CHANGE',
    severity: 'high',
    affectedPlanes: ['P2', 'P3']
  },
  {
    pattern: /^packages\/foundation\/contracts\//,
    type: 'API_CONTRACT_CHANGE',
    severity: 'high',
    affectedPlanes: ['P3', 'P4']
  },
  {
    pattern: /^docs\/adr\//,
    type: 'ADR_PUBLISHED',
    severity: 'high',
    affectedPlanes: ['P0', 'P1', 'P2', 'P3', 'P4', 'CC']
  }
];

const matchedRule = noticeRules.find(r => r.pattern.test(filePath));
if (!matchedRule) process.exit(0);

const noticeId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '_' + Math.random().toString(36).slice(2, 7);
const slug = path.basename(filePath, '.md').toLowerCase().replace(/[^a-z0-9]/g, '-');

const acknowledgments = {};
matchedRule.affectedPlanes.forEach(p => {
  if (p !== sourcePlane) acknowledgments[p] = { ack: false, at: null };
});

const frontmatter = {
  notice_id: noticeId,
  created_at: new Date().toISOString(),
  type: matchedRule.type,
  severity: matchedRule.severity,
  source_plane: sourcePlane,
  source_session: sourceSession,
  affected_planes: matchedRule.affectedPlanes.filter(p => p !== sourcePlane),
  acknowledgments,
  status: 'open',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
};

const noticeDir = '.claude/notices';
fs.mkdirSync(noticeDir, { recursive: true });

const noticePath = path.join(noticeDir, `${noticeId}_${matchedRule.type.toLowerCase()}-${slug}.md`);

const content = `---
${yaml.dump(frontmatter).trim()}
---

# 🔔 NOTICE: ${matchedRule.type}

## 변경 파일
\`${filePath}\`

## 영향 받는 Plane
${matchedRule.affectedPlanes.filter(p => p !== sourcePlane).map(p => `- ${p}`).join('\n')}

## 액션
영향 받는 Plane은 다음 작업 시작 전 변경 내용을 확인하고
acknowledgments.{plane}.ack를 true로 갱신할 것.

## 처리 후
모든 Plane ack → P0가 .claude/notices/processed/로 이동.

---

(자동 생성됨 — ${matchedRule.type} 타입)
`;

fs.writeFileSync(noticePath, content);
console.log(`🔔 NOTICE 발행: ${noticePath}`);
````

### PreToolUse Hook (NOTICE 검사)

```javascript
// .claude/hooks/notice-check.js
const fs = require('node:fs');
const path = require('node:path');

const noticeDir = '.claude/notices';
if (!fs.existsSync(noticeDir)) process.exit(0);

const myPlane = process.env.CLAUDE_PLANE;
if (!myPlane) process.exit(0);

const notices = fs.readdirSync(noticeDir).filter((f) => f.endsWith('.md'));

const relevant = [];
for (const n of notices) {
  const content = fs.readFileSync(path.join(noticeDir, n), 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) continue;

  if (fmMatch[1].includes(`affected_planes:`) && fmMatch[1].includes(myPlane)) {
    if (fmMatch[1].includes(`${myPlane}:\n    ack: false`)) {
      relevant.push(n);
    }
  }
}

if (relevant.length > 0) {
  console.error(`\n⚠️  ${myPlane} 미처리 NOTICE ${relevant.length}개:`);
  relevant.forEach((n) => console.error(`   - ${n}`));
  console.error(`\n읽고 ack 갱신 후 작업 진행하세요.\n`);
}
```

### settings.json

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/notice-broadcast.js \"${CLAUDE_TOOL_FILE:-}\""
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/notice-check.js"
          }
        ]
      }
    ]
  }
}
```

## 2.4 NOTICE 처리 워크플로우 (수신 측)

```
세션 시작 시:
  1. PreToolUse hook이 NOTICE 검사 (자동)
  2. "미처리 NOTICE 3개" 경고 출력

인간 또는 Claude의 첫 작업:
  1. cat .claude/notices/*.md (또는 ls 후 확인)
  2. 가장 critical한 것부터 읽기
  3. 자기 Plane 영향 섹션 정독
  4. 영향 작업을 plan.md에 추가
  5. acknowledgments.{my_plane}.ack = true 갱신

P0 일일 정렬 시:
  1. NOTICE Dashboard 확인
  2. 모두 ack된 NOTICE → .claude/notices/processed/로 이동
  3. 일주일 이상 미처리 → escalation
```

## 2.5 NOTICE 폭주 방지

```
위험: NOTICE가 너무 많으면 무시됨

방어 메커니즘:
  ① severity 레벨로 필터링 (critical/high만 즉시)
  ② DAILY_BRIEFING는 일일 1회만
  ③ 같은 파일 5분 내 다중 변경 → 1개로 통합
  ④ NOTICE 폭주 감지 (하루 10개+) → P0가 패턴 단순화 검토
```

---

# 3. 매체 3: Contract 시스템

## 3.1 Role 간 명시적 계약

헌법 v3.3 Part 7.4의 Task Contract를 Role 단위로 확장.

```yaml
# docs/contracts/p1-foundation-quote.contract.yaml

contract_id: 'p1-foundation-quote-v1'
owner_role: 'P1'
status: 'active'
version: '1.0.0'

# ─── 공개 인터페이스 ───
public_interface:
  exports:
    - name: 'Quote'
      type: 'type'
      file: 'packages/foundation/src/models/Quote.ts'
      hash: 'sha256:abc123...' # 자동 갱신

    - name: 'QuoteSchema'
      type: 'zod_schema'
      file: 'packages/foundation/src/contracts/QuoteSchema.ts'
      hash: 'sha256:def456...'

# ─── 의존하는 Role ───
consumers:
  - role: 'P2'
    uses: ['Quote', 'QuoteSchema']
    last_acknowledged: '2026-05-01T10:00:00Z'

  - role: 'P3'
    uses: ['Quote', 'QuoteSchema']
    last_acknowledged: '2026-05-01T10:00:00Z'

# ─── 변경 정책 ───
change_policy:
  major_change_requires_adr: true
  minor_change_requires_notice: true
  breaking_change_consumer_migration_required: true

# ─── 변경 이력 ───
history:
  - version: '1.0.0'
    date: '2026-04-28'
    type: 'initial'
    adr: null
  - version: '1.1.0'
    date: '2026-05-01'
    type: 'minor'
    change: 'visibility 필드 추가'
    adr: 'ADR-007'
    notice: '20260501T103000_001'
```

## 3.2 Contract Hash 검증

```bash
# scripts/verify-contracts.sh
#!/usr/bin/env bash
# 매 PR에서 실행 — Contract와 코드 일치 검증

for contract in $(find docs/contracts -name "*.contract.yaml"); do
  # 각 export의 hash 재계산
  EXPORTS=$(yq '.public_interface.exports[]' "$contract")

  echo "$EXPORTS" | while read -r export_def; do
    FILE=$(echo "$export_def" | yq '.file')
    EXPECTED_HASH=$(echo "$export_def" | yq '.hash')
    ACTUAL_HASH="sha256:$(sha256sum "$FILE" | cut -d' ' -f1)"

    if [ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]; then
      echo "❌ Contract hash mismatch:"
      echo "   $contract"
      echo "   File: $FILE"
      echo "   Expected: $EXPECTED_HASH"
      echo "   Actual:   $ACTUAL_HASH"
      echo ""
      echo "Contract 변경됨. ADR + NOTICE 필요:"
      echo "  pnpm contract:update $contract"
      exit 1
    fi
  done
done
```

## 3.3 Contract 변경 워크플로우

```
시나리오: P1이 Quote 타입 변경

1. P1 세션이 packages/foundation/models/Quote.ts 수정
2. CI가 Contract Hash mismatch 감지
3. P1 세션에게 옵션 제시:
   A. ADR 작성 + Contract version up + NOTICE 발행
   B. 변경 취소 (실수)

4. A 선택 시:
   - docs/adr/ADR-{n}.md 작성
   - docs/contracts/p1-foundation-quote.contract.yaml 갱신
     (version, hash, history)
   - PostToolUse hook이 자동 NOTICE 발행

5. 다른 Role 세션이 NOTICE 처리
```

---

# 4. 매체 4: State 파일

## 4.1 .project/plane-states/

각 Role의 진행 상태를 영속화. 헌법 v3.3 Part 7.3 확장.

```json
// .project/plane-states/p2.json

{
  "plane": "P2",
  "role_id": "p2-engine",
  "current_phase": "Phase 1 — MVP",
  "current_epic": "Epic 3 — 15-rule Linter",
  "current_story": "Story 3.5 — Tax Rule Validator",
  "current_task": {
    "id": "P2-E3-S5-T3",
    "type": "IMPL",
    "status": "in-progress",
    "description": "VAT 부가세 검증 로직 구현"
  },
  "implementation_lock": "🔓 UNLOCKED",
  "rar_cycle_iteration": 2,
  "last_updated": "2026-05-01T15:30:00Z",
  "session_start": "2026-05-01T13:00:00Z",
  "progress": {
    "completed_tasks": 18,
    "total_tasks": 47,
    "percentage": 38
  },
  "context": {
    "research_md_version": "v2",
    "plan_md_version": "v3",
    "ssot_versions": {
      "north_star": "2026-04-28",
      "domain_model": "2026-05-01"
    }
  },
  "open_issues": ["AI 추론 시간 측정 미완 (P95 측정 필요)", "Tax rule 변경 시 hot reload 미구현"],
  "recent_decisions": [
    {
      "date": "2026-04-30",
      "decision": "Basic-Pitch 대신 MT3 도입",
      "adr": "ADR-009"
    }
  ]
}
```

## 4.2 .project/state.json — 전역 상태

```json
{
  "project": "VOID BILL",
  "phase": "Phase 1 — MVP",
  "started_at": "2026-04-15",
  "estimated_completion": "2026-06-15",
  "active_planes": ["P0", "P1", "P2", "P3", "P4"],
  "today_focus": "P2 Engine — 15-rule Linter 마무리",
  "blocked_planes": [],
  "active_sessions": [
    {
      "plane": "P2",
      "started_at": "2026-05-01T13:00:00Z",
      "mode": "Auto-accept"
    },
    {
      "plane": "P4",
      "started_at": "2026-05-01T14:00:00Z",
      "mode": "Plan"
    }
  ],
  "last_alignment": "2026-05-01T09:00:00Z"
}
```

## 4.3 State 갱신 규칙

```
세션 종료 시 (의무):
  1. plane-states/{plane}.json 갱신
  2. last_updated 갱신
  3. progress.completed_tasks 갱신
  4. open_issues 갱신
  5. recent_decisions 추가 (있으면)

P0 일일 정렬 시:
  1. 모든 plane-states/*.json 읽기
  2. .project/state.json 갱신:
     - today_focus
     - active_planes
     - blocked_planes
  3. Plane Dashboard 출력
```

---

# 5. 통합 — 4매체의 협력

## 5.1 정보 흐름 다이어그램

```
        ┌──────────────────────────────────────┐
        │          시나리오:                    │
        │   P1이 새 도메인 모델 추가            │
        └─────────────────┬────────────────────┘
                          ▼
        ┌──────────────────────────────────────┐
        │ Step 1: P1 세션이 SSOT 수정           │
        │   docs/shared/DOMAIN_MODEL.md         │
        └─────────────────┬────────────────────┘
                          │
                          │ PostToolUse hook
                          ▼
        ┌──────────────────────────────────────┐
        │ Step 2: NOTICE 자동 발행              │
        │   .claude/notices/{ts}_ssot.md        │
        │   affected: P2, P3, P4                │
        └─────────────────┬────────────────────┘
                          │
                          │ P1이 후속 작업
                          ▼
        ┌──────────────────────────────────────┐
        │ Step 3: Contract 갱신                 │
        │   docs/contracts/p1-foundation.yaml  │
        │   version 1.0 → 1.1                   │
        └─────────────────┬────────────────────┘
                          │
                          │ ADR 의무
                          ▼
        ┌──────────────────────────────────────┐
        │ Step 4: ADR 작성                      │
        │   docs/adr/ADR-007.md                 │
        └─────────────────┬────────────────────┘
                          │
                          │ State 갱신
                          ▼
        ┌──────────────────────────────────────┐
        │ Step 5: P1 세션 종료                  │
        │   .project/plane-states/p1.json       │
        │   recent_decisions 추가               │
        └─────────────────┬────────────────────┘
                          │
                          │ (다음 날)
                          ▼
        ┌──────────────────────────────────────┐
        │ Step 6: P2 세션 시작                  │
        │   PreToolUse hook → NOTICE 발견       │
        │   "미처리 NOTICE 1개" 경고            │
        └─────────────────┬────────────────────┘
                          │
                          │ P2가 NOTICE 처리
                          ▼
        ┌──────────────────────────────────────┐
        │ Step 7: P2 코드 갱신 + ack            │
        │   NOTICE의 P2.ack = true              │
        │   .project/plane-states/p2.json 갱신  │
        └─────────────────┬────────────────────┘
                          │
                          │ (P3, P4 동일)
                          ▼
        ┌──────────────────────────────────────┐
        │ Step 8: 모든 ack 완료                 │
        │   P0가 NOTICE → processed/ 이동       │
        │   상태: resolved                      │
        └──────────────────────────────────────┘
```

## 5.2 일일 정렬 자동화

P0 세션이 매일 아침 실행하는 스크립트:

```bash
# scripts/daily-alignment.sh

clear
echo "═══════════════════════════════════════════"
echo "  🎼 DAILY ALIGNMENT — P0"
echo "═══════════════════════════════════════════"

echo ""
echo "▶ 1. 미처리 NOTICE"
echo "──────────────────────"
ls .claude/notices/*.md 2>/dev/null | while read n; do
  SEVERITY=$(grep "severity:" "$n" | head -1 | awk '{print $2}')
  TYPE=$(grep "^type:" "$n" | head -1 | awk '{print $2}')
  echo "  [$SEVERITY] $TYPE — $(basename $n)"
done

echo ""
echo "▶ 2. Plane 진행 상태"
echo "──────────────────────"
for f in .project/plane-states/*.json; do
  PLANE=$(jq -r '.plane' $f)
  STORY=$(jq -r '.current_story' $f)
  PROGRESS=$(jq -r '.progress.percentage' $f)
  LOCK=$(jq -r '.implementation_lock' $f)
  echo "  $PLANE: $STORY ($PROGRESS%) $LOCK"
done

echo ""
echo "▶ 3. 활성 세션"
echo "──────────────────────"
jq -r '.active_sessions[] | "  \(.plane): \(.mode) (since \(.started_at))"' .project/state.json

echo ""
echo "▶ 4. 오늘의 우선순위 결정 (수동)"
echo "──────────────────────"
echo "  미처리 NOTICE → 영향 Plane 우선"
echo "  활성 세션 ≤ 3 룰 적용"

echo ""
echo "═══════════════════════════════════════════"
```

---

# 6. 패턴별 정보 공유 적용

## 6.1 패턴별 매체 사용 강도

| 패턴                |  SSOT  |          NOTICE          |       Contract        |   State   |
| :------------------ | :----: | :----------------------: | :-------------------: | :-------: |
| 0. Single Module    |  간소  |          불필요          |        불필요         |   간단    |
| 1. Phase-based      |  강함  |      Phase 전환 시       |         약함          |   중간    |
| 2. 5-Plane Hybrid   |  강함  |           의무           |         의무          |   강함    |
| 3. Pipeline Stage   |  중간  |      Stage 간 의무       | Stage 인터페이스 의무 |   중간    |
| 4. Domain Vertical  |  강함  |    Domain Event 의무     | Anti-corruption Layer |   중간    |
| 5. Core-Plugin      | Core만 | Core 변경 시 모든 Plugin |       Core API        | Core 강함 |
| 6. Hybrid Composite |  강함  |           강함           |         강함          |   강함    |

## 6.2 Pattern 0 (Single Module)

```
SSOT: docs/research.md + docs/plan.md + CLAUDE.md
NOTICE: 불필요 (단일 세션)
Contract: 불필요 (외부 노출 없음)
State: .project/state.json만
```

## 6.3 Pattern 5 (Core-Plugin)

```
SSOT: Core가 SSOT 소유 (Plugin 인터페이스 정의)
NOTICE: Core 변경 시 모든 Plugin에 broadcast
Contract: Core API contract 의무
State: Core + Plugin별 (단순)

특이점:
  - Plugin 추가는 NOTICE 발행 X (다른 Plugin에 영향 없음)
  - Core 변경은 NOTICE 폭발적 (모든 Plugin 영향)
  → Core 변경 빈도를 의도적으로 낮춤 (분기 1회)
```

---

# 7. 정보 공유 안티패턴

| 안티패턴                 | 위험              | 회피                          |
| :----------------------- | :---------------- | :---------------------------- |
| **NOTICE 무시**          | Silent Pivot 폭발 | 세션 시작 시 의무 체크 + Hook |
| **SSOT 다중화**          | N개 진실          | 단일 docs/shared/ 강제        |
| **Contract 없이 의존**   | 타입 충돌         | Contract.yaml 의무            |
| **State 갱신 누락**      | 본인 망각         | 세션 종료 의무 (CLAUDE.md 룰) |
| **Hook 우회**            | NOTICE 발행 안 됨 | Hook 검증 자동화              |
| **NOTICE 폭주 → 무시**   | 중요 신호 묻힘    | severity 필터 + 통합          |
| **ADR 없는 SSOT 변경**   | 사유 망각         | PostToolUse가 ADR 검증        |
| **acknowledgment 안 함** | 처리 추적 불가    | ack 의무 + 일주일 escalation  |

---

# 8. 페르소나 COT 검증 (이 문서)

## 🔨 BREAKER

> "NOTICE 시스템이 무시되면? — Hook 자동 + severity 필터 + 일주일 escalation. 3중 방어."

## 🏛️ ARCHITECT

> "Contract Hash 자동 검증? ✓ CI에서 매 PR — Silent Pivot 즉시 차단."

## 👤 ADVOCATE

> "솔로가 4매체 다 관리하기 부담? — 자동화 비율 80%. 인간은 ack만."

## 🛡️ SENTINEL

> "SSOT 변경이 보안 영향? — ADR 의무 + 영향 분석 강제."

## 👻 GHOST

> "NOTICE Hook이 CI를 느리게? — local hook은 빠르고, CI 검증은 별도."

## 🔮 ORACLE

> "정보 공유가 비즈니스 가치 어떻게 보호? — 1일 정렬 5분 = 머지 카오스 1주일 절약."

## 🎩 MEPHISTO

> "4매체가 충분한가? — SSOT(합의) + NOTICE(알림) + Contract(계약) + State(현황). 4가지 차원 커버."

---

# 9. 다음 단계

```
정보 공유 셋업 완료 후:
  → 05. Planning Workbook (Stage -1 ~ Stage 0.8 워크시트)
  → 06. Operating Manual (일일 운영)
```

---

**END OF 04. INFORMATION SHARING PROTOCOL**

_"Information that doesn't flow is information that doesn't exist."_
