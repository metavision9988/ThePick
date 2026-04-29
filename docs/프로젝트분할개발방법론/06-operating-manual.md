# 🎯 06. IMPLEMENTATION OPERATING MANUAL

## 다중 Claude Code 세션의 일일 운영

> **"Operations is where great plans go to die.**
> **Or where they finally come alive — depending on the discipline."**
>
> — GHOST

---

**버전:** v1.0
**선행 문서:** 05. Planning Workbook (UNLOCK 후)
**연계 문서:** 04. Info Sharing, 07. Verification

---

# 0. 이 매뉴얼의 범위

## 0.1 적용 시점

```
05. Planning Workbook의 UNLOCK 체크리스트 통과 후.
즉 "🔓 UNLOCKED" 상태에서 시작.

이 매뉴얼은 일일 운영 — 즉 "코드를 짜는 단계"의 매뉴얼.
```

## 0.2 일일 흐름 한눈에 보기

```
┌─────────────────────────────────────────────────────────┐
│  09:00  P0 일일 정렬 (5분)                              │
│         - NOTICE 대시보드                                │
│         - Plane 상태 확인                                │
│         - 오늘의 메인 Plane 결정                         │
├─────────────────────────────────────────────────────────┤
│  09:15  메인 Plane Plan Mode (2시간)                     │
│         - 오늘의 Story 검토                              │
│         - Task 분해                                      │
├─────────────────────────────────────────────────────────┤
│  11:15  메인 Plane 구현 (2~3시간)                        │
│         - Auto-accept 모드                               │
│         - 보조 Plane 1개 Plan Mode 병행 가능             │
├─────────────────────────────────────────────────────────┤
│  14:00  점심 + NOTICE 처리 라운드                        │
├─────────────────────────────────────────────────────────┤
│  15:00  보조 Plane 활성 (2~3시간)                        │
│         - 활성 세션 ≤ 3 룰 적용                         │
├─────────────────────────────────────────────────────────┤
│  17:00  머지 라운드                                      │
│         - Plane 브랜치 → main                            │
│         - Gate 검증                                      │
├─────────────────────────────────────────────────────────┤
│  18:00  세션 종료 + state.json 갱신                      │
│         - CLAUDE.md 학습 기록                            │
│         - 내일 우선순위 메모                             │
└─────────────────────────────────────────────────────────┘
```

---

# 1. 세션 시작 의식 (Session Start Ritual)

## 1.1 표준 절차

각 Claude Code 세션 시작 시 의무:

```bash
# 1. 환경 변수 설정
export CLAUDE_PLANE=P2
export CLAUDE_SESSION_ID="p2-$(date +%Y%m%d_%H%M)"

# 2. 작업 브랜치 체크아웃
git checkout plane/p2-engine-$(date +%Y%m%d) || \
  git checkout -b plane/p2-engine-$(date +%Y%m%d)

# 3. 최신 main 가져오기
git fetch origin main
git rebase origin/main  # 충돌 시 즉시 해결

# 4. NOTICE 체크
ls .claude/notices/*.md 2>/dev/null
# 미처리 NOTICE 있으면 우선 처리

# 5. Plane 상태 로드
cat .project/plane-states/p2.json

# 6. Claude Code 시작
claude
```

## 1.2 첫 입력 표준 명령

```
"P2 Engine 세션이다. 다음을 순차 수행하라:

1. .claude/plane-contexts/p2-engine.md 정독
2. 그 파일에 명시된 의무 로드 파일 전부 읽기:
   - CLAUDE.md
   - docs/shared/NORTH_STAR.md
   - docs/shared/DOMAIN_MODEL.md
   - docs/shared/COUNTER_DIRECTIVES.md
   - docs/plane/p2-engine/research.md
   - docs/plane/p2-engine/plan.md
   - .project/plane-states/p2.json
3. .claude/notices/ 의 미처리 NOTICE 확인
4. 어디서 멈췄는지 보고
5. 오늘의 첫 Task 확인 후 진행 의사 확인"
```

## 1.3 NOTICE 처리 (시작 시 의무)

```
미처리 NOTICE가 있으면:

1. severity 'critical' 먼저 처리
2. 각 NOTICE 정독
3. 자기 Plane 영향 분석 섹션 확인
4. 영향 작업을 plan.md에 추가
5. NOTICE의 frontmatter에서 ack 갱신:
   acknowledgments:
     P2: { ack: true, at: "2026-05-01T13:00:00Z" }
6. 모든 ack 완료된 NOTICE는 P0 일일 정렬 시 processed/로 이동
```

---

# 2. Plan Mode — 코드 작성 전

## 2.1 Plan Mode 시점

```
다음 시점마다 Plan Mode 진입 의무:

✓ 새 Story 시작
✓ 복잡도 3+ Task (헌법 v3.3 Stage 0.3 기준)
✓ 외부 의존 추가 (라이브러리, 서비스)
✓ 다른 Plane의 인터페이스 변경 영향
✓ Production 환경에 배포되는 변경

Plan Mode 건너뛰기 = TYPE-1 환각 위험.
```

## 2.2 Plan Mode 내용

```
Claude의 Plan은 다음을 포함해야:

1. 무엇을 만들 것인가 (구체)
   - 파일 추가/수정 목록
   - 주요 함수 시그니처

2. 왜 이렇게 만드는가 (사유)
   - 대안 비교 (최소 2개)
   - 선택 사유

3. 영향 분석
   - 어느 다른 Plane에 영향?
   - NOTICE 발행 필요?
   - ADR 작성 필요?

4. 검증 방법
   - 어떤 테스트?
   - 어떤 BDD 시나리오?

5. 위험 (Counter-Directive 적용)
   - 어떤 함정에 빠질 수 있나?
   - 어떻게 회피?
```

## 2.3 Plan 검토 — 인간 의무

```
Claude의 Plan을 인간이 검토:

✓ 누락된 영향 분석?
✓ 빠진 Counter-Directive?
✓ 시간 추정 현실적? (×2.5 룰)
✓ 다른 Plane과 합의 필요?

검토 결과:
  A. APPROVED — Auto-accept 또는 수동 진행
  B. ADJUST REQUIRED — Plan 수정 후 재검토
  C. REJECTED — 다른 접근 필요
```

---

# 3. 활성 세션 운영 — 인지 한계 룰

## 3.1 활성 세션 ≤ 3 절대 룰

```
"Max 사용자라도 인간 인지는 무한이 아니다."

활성 세션 분류:
  - Coding (Auto-accept ON): 실제 코드 작성 중
  - Planning (Plan Mode): 검토/설계 중
  - Verifying (Read/Test): 검증 중

룰:
  ★ 동시 Coding ≤ 1 (절대)
  ★ 동시 Planning ≤ 2
  ★ 동시 활성 ≤ 3
  ★ 4번째가 필요하면 → 패턴 잘못된 신호
```

## 3.2 세션 우선순위 결정

```
오늘 무엇을 활성화할지 P0가 매일 결정:

기준 1: NOTICE Critical 우선
  - critical NOTICE 있는 Plane = 자동 우선

기준 2: Blocking Dependency 해소
  - 다른 Plane이 막고 있으면 → 그 Plane 우선

기준 3: 어제 진행 50% 미만이면 → 같은 Plane 계속

기준 4: 컨텍스트 스위칭 비용 고려
  - 최소 2시간 같은 Plane (잦은 전환 금지)
```

## 3.3 세션 전환 의식

```
Plane 전환 시 의무:

1. 현재 세션 종료 의식 (Section 6)
2. 다음 세션 시작 의식 (Section 1)
3. NOTICE 체크
4. 1분간 "이 Plane이 어디서 멈췄는지" 회상

★ 전환 비용 = 약 5~10분 (피할 수 없음)
★ 하루 4회+ 전환 = 컨텍스트 스위칭 카오스
```

---

# 4. Auto-accept 모드 운영

## 4.1 Auto-accept 활성 조건

```
Auto-accept ON 가능:
  ✓ Plan Mode에서 Plan 승인됨
  ✓ Task가 Contract.yaml 있음
  ✓ DEFCON L1 또는 L2 (L3는 신중)
  ✓ 다른 활성 Coding 세션 없음

Auto-accept ON 금지:
  ✗ Production 데이터 변경 (DB migration 등)
  ✗ Root config 수정
  ✗ 다른 Plane 영역 수정
  ✗ AI API 호출 비용 ≥ $1/세션
```

## 4.2 Auto-accept 안전장치

```
Hook 기반 자동 차단:

1. PreToolUse hook (.claude/hooks/auto-accept-guard.js):
   - 변경 파일이 Plane 영역 외? → 차단
   - Root config? → 차단
   - 다른 Plane의 Contract 위반? → 차단

2. PostToolUse hook:
   - NOTICE 자동 발행 (04. 참조)
   - state.json 자동 갱신
   - 테스트 자동 실행 (turbo affected)

3. Stop hook:
   - 세션 종료 시 plan.md 갱신 검증
   - 미커밋 변경 알림
```

## 4.3 Auto-accept 중단 신호

```
다음 발생 시 즉시 Auto-accept 중단:

⚠ 같은 파일 5회 이상 연속 수정
⚠ Test 실패가 반복됨
⚠ 새 의존성 추가 (논의 필요)
⚠ AI 비용 $5 초과
⚠ 1시간 이상 진행 (인간 점검 필요)
⚠ Counter-Directive 위반 가능성
```

---

# 5. Plane 간 의존 처리

## 5.1 새 의존 발생 시

시나리오: P2 Engine이 P1 Foundation에 새 타입을 요청해야 할 때

```
워크플로우:

1. P2 세션이 NOTICE 발행 (REQUEST 타입):
   .claude/notices/{ts}_dependency-request_p2-to-p1.md

   내용:
     - 무엇이 필요한가
     - 왜 필요한가
     - 언제까지 필요한가
     - 임시 우회 가능한가? (있으면 명시)

2. P0이 일일 정렬에서 NOTICE 확인
   - P1 우선순위 결정 영향

3. P1 세션 시작 시 NOTICE 처리:
   - 요청 검토
   - ADR 필요 여부 결정
   - 구현 → Contract 갱신
   - SCHEMA_CHANGE NOTICE 자동 발행

4. P2 세션이 SCHEMA_CHANGE NOTICE 처리:
   - 새 타입 사용 시작
   - 임시 우회 코드 제거
```

## 5.2 의존 사이클 회피

```
의존 사이클 (A → B → A) 발생 시:

탐지: dependency-cruiser 자동 (CI)

해소:
  1. 사이클의 본질 분석 (왜 발생?)
  2. 옵션 A: 공유 모듈 추출
     - 양쪽 의존을 별도 Role로 분리
  3. 옵션 B: 이벤트 기반 통신
     - 직접 의존 → Domain Event
  4. 옵션 C: ADR 작성 + 의존 방향 변경

ARCHITECT 즉시 소환 의무.
```

---

# 6. 세션 종료 의식 (Session End Ritual)

## 6.1 표준 절차

```bash
# 1. 진행 상태 정리
# Claude에게:
"세션 종료 전 다음 수행:
1. 오늘 한 일 요약 (3~5줄)
2. 미해결 이슈 식별
3. 내일의 첫 작업 메모
4. CLAUDE.md 학습 기록 (자주 한 실수가 있나?)"

# 2. plane-states/{plane}.json 갱신
# Claude가 자동 또는 수동으로:
{
  "last_updated": "2026-05-01T18:00:00Z",
  "current_story": "P2-S5",
  "current_task": { ... },
  "progress": { "completed_tasks": 19, "total_tasks": 47 },
  "open_issues": [ ... ],
  "recent_decisions": [ ... ]
}

# 3. Git 커밋
git add .
git commit -m "P2: Story 5 Task 3 — VAT 검증 로직 구현"

# 4. NOTICE 발행 (해당 시)
# 이 세션이 docs/shared/ 또는 contracts 변경했나?
# → PostToolUse hook이 자동 처리

# 5. Plane 브랜치 push
git push origin plane/p2-engine-$(date +%Y%m%d)
```

## 6.2 세션 종료 체크리스트

```
□ 모든 변경 파일 git add
□ 의미 있는 커밋 메시지 (Plane: Story-Task: 무엇)
□ plane-states/{plane}.json 갱신
□ NOTICE ack 갱신 (처리한 NOTICE 있으면)
□ 학습 기록 (헌법 v3.3 Part 12.3 자가 운용 학습)
□ Plane 브랜치 push
□ 미해결 이슈 메모 (다음 세션 시작 시 참조)
```

## 6.3 자가 운용 학습 (헌법 v3.3 Part 12.3)

세션 종료 시 CLAUDE.md에 학습 기록:

```markdown
# CLAUDE.md (루트)

## 자주 하는 실수 — 학습 기록

### 2026-05-01 (P2 세션)

- AI 호출 전 토큰 추정 잊고 시작 → Cost Cap 초과 시뮬레이션 발생
- 학습: AI API 호출 전 항상 estimateTokens() 의무

### 2026-04-28 (P1 세션)

- DOMAIN_MODEL 변경 후 NOTICE 발행 안 됨 (hook 미동작)
- 학습: PostToolUse hook 설치 후 첫 변경 시 검증

(계속 추가)
```

---

# 7. 머지 라운드 (Daily Merge)

## 7.1 매일 머지 의무

```
"하루 1회 이상 main 머지" — 절대 룰.

이유:
  - 1주일 머지 미루면 충돌 폭발
  - main과 Plane 브랜치의 격차 확대
  - 다른 Plane이 의존하기 어려움
```

## 7.2 머지 절차

```
17:00 머지 라운드:

1. Plane 브랜치 최종 정리
   git rebase origin/main
   pnpm test
   pnpm typecheck

2. Pre-merge 검증
   - 영역 침범 검증 (pre-commit hook)
   - Contract Hash 검증 (CI)
   - Lint 통과
   - Test 100% 통과 (자기 Plane)

3. Plane 브랜치 → main 머지
   git checkout main
   git merge --no-ff plane/p2-engine-20260501
   git push origin main

4. 다른 Plane에 영향 있으면
   - SSOT 변경? → NOTICE 자동 발행됨 (Hook)
   - Contract 변경? → 자동 NOTICE
   - 일반 코드 변경? → 의존 Role에 알림 권장 (수동 NOTICE)

5. main에서 build 검증
   pnpm build
   - 실패? → 즉시 hot fix

6. 다음 날 모든 Plane 세션이 시작 시 main rebase
```

## 7.3 머지 충돌 해소

```
충돌 발생 시:

옵션 A: 같은 파일 수정 충돌 (영역 침범 신호)
  → Ownership Matrix 위반 가능성
  → ADR 작성 + 책임 명확화

옵션 B: Contract 충돌
  → Contract Hash 검증 실패
  → ADR 의무 + 의존 Role 합의

옵션 C: 단순 텍스트 충돌
  → 보통 머지 도구로 해소
  → 불확실 시 두 Role 세션 모두 활성 후 합의
```

---

# 8. P0 일일 정렬 (Daily Alignment)

## 8.1 P0의 책임

```
P0 Orchestra 세션은 코드를 거의 안 짠다.
주 임무: 다른 Plane의 조율 + 통제.

매일 아침 5분 의식:
  1. NOTICE 대시보드
  2. Plane 상태 확인
  3. 오늘의 우선순위 결정
  4. 일일 브리핑 발행 (선택)
```

## 8.2 일일 정렬 스크립트

```bash
# scripts/daily-alignment.sh
clear
echo "═══════════════════════════════════════════"
echo "  🎼 DAILY ALIGNMENT — $(date '+%Y-%m-%d %A')"
echo "═══════════════════════════════════════════"

# 1. NOTICE
echo ""
echo "▶ NOTICE Dashboard"
echo "──────────────────"
UNPROCESSED=$(ls .claude/notices/*.md 2>/dev/null | wc -l)
echo "  미처리 NOTICE: $UNPROCESSED"

if [ "$UNPROCESSED" -gt 0 ]; then
  for f in .claude/notices/*.md; do
    SEVERITY=$(grep "^severity:" "$f" | head -1 | awk '{print $2}')
    TYPE=$(grep "^type:" "$f" | head -1 | awk '{print $2}')
    echo "    [$SEVERITY] $TYPE — $(basename $f)"
  done
fi

# 2. Plane 상태
echo ""
echo "▶ Plane 진행 상태"
echo "──────────────────"
for f in .project/plane-states/*.json; do
  PLANE=$(jq -r '.plane' $f)
  STORY=$(jq -r '.current_story' $f)
  PROGRESS=$(jq -r '.progress.percentage' $f)
  LAST=$(jq -r '.last_updated' $f)
  echo "  $PLANE: $STORY ($PROGRESS%) — last: $LAST"
done

# 3. 활성 세션
echo ""
echo "▶ 활성 세션 (현재)"
echo "──────────────────"
jq -r '.active_sessions[]? | "  \(.plane) (\(.mode)) since \(.started_at)"' \
  .project/state.json

# 4. 어제 머지 상태
echo ""
echo "▶ Plane 브랜치 (1일 이상 미머지?)"
echo "──────────────────"
git branch | grep "plane/" | while read branch; do
  branch=$(echo $branch | tr -d ' ')
  LAST_MERGE=$(git log main --oneline | grep "$branch" | head -1)
  if [ -z "$LAST_MERGE" ]; then
    LAST_COMMIT=$(git log -1 --format="%cr" "$branch" 2>/dev/null)
    echo "  $branch — 머지 안 됨, 마지막 커밋: $LAST_COMMIT"
  fi
done

echo ""
echo "▶ 오늘의 우선순위 결정 (수동)"
echo "──────────────────"
echo "  → critical NOTICE 있는 Plane 우선"
echo "  → blocking dependency 해소 우선"
echo "  → 활성 세션 ≤ 3 룰 적용"

echo ""
echo "═══════════════════════════════════════════"
```

## 8.3 일일 브리핑 발행 (선택)

```yaml
# .claude/notices/{ts}_daily-briefing.md
---
type: "DAILY_BRIEFING"
severity: "low"
date: "2026-05-01"
---

# 📅 일일 브리핑

## 오늘의 메인 Plane
P2 Engine — 15-rule Linter 마무리

## 보조 Plane
P4 Experience — 견적 에디터 UI

## 미처리 NOTICE
1. SSOT_CHANGE: visibility 필드 (P2, P3, P4 영향)

## 오늘 하지 말 것
- P3 Service 신규 작업 (P1 의존 대기 중)
- 새 라이브러리 추가 (이번 주 동결)

## 위험 신호
- AI Cost: 어제 $2 사용 (월 한도 80%)
  → 오늘 AI 호출 신중히
```

---

# 9. 위험 신호 모니터링

## 9.1 일상 모니터링 항목

| 신호                  |    임계값    | 액션                    |
| :-------------------- | :----------: | :---------------------- |
| NOTICE 미처리         |     5개+     | 일일 정렬에서 강제 처리 |
| Plane 브랜치 미머지   |     2일+     | 즉시 머지 또는 동결     |
| AI 비용               | 월 한도 80%+ | Cost Cap 강화           |
| Test failure rate     |     10%+     | 코드 동결 + 디버깅      |
| 인지 부하 (활성 세션) |      4+      | 즉시 전환               |
| 같은 파일 수정 빈도   | 일주일 5회+  | 분리 검토               |
| AVG 머지 충돌         | 일주일 3회+  | 영역 재정의             |

## 9.2 위험 신호 자동 감지

```bash
# scripts/health-check.sh — 매시간 cron 또는 수동

#!/usr/bin/env bash

WARNINGS=()

# NOTICE 폭주
NOTICES=$(ls .claude/notices/*.md 2>/dev/null | wc -l)
if [ $NOTICES -gt 5 ]; then
  WARNINGS+=("⚠️  미처리 NOTICE $NOTICES개")
fi

# Plane 브랜치 미머지
for branch in $(git branch | grep "plane/" | tr -d ' '); do
  HOURS=$(git log -1 --format="%cr" $branch | grep -oE "[0-9]+ (hour|day)" | head -1)
  if echo "$HOURS" | grep -q "day"; then
    WARNINGS+=("⚠️  $branch: $HOURS 미머지")
  fi
done

# 활성 세션
ACTIVE=$(jq '.active_sessions | length' .project/state.json)
if [ $ACTIVE -gt 3 ]; then
  WARNINGS+=("⚠️  활성 세션 $ACTIVE개 (인지 한계 초과)")
fi

# 출력
if [ ${#WARNINGS[@]} -eq 0 ]; then
  echo "✅ Health OK"
else
  printf '%s\n' "${WARNINGS[@]}"
fi
```

---

# 10. 안티패턴 — 운영 단계

| 안티패턴                  | 위험                         | 회피                  |
| :------------------------ | :--------------------------- | :-------------------- |
| 세션 시작 의식 생략       | NOTICE 무인지 → Silent Pivot | Hook 자동 + 명시 의무 |
| Plan Mode 건너뛰기        | TYPE-1 환각                  | 복잡도 3+ 의무        |
| 활성 세션 4+              | 큐 매니저 전락               | ≤ 3 절대 룰           |
| Plane 영역 침범           | 머지 카오스                  | pre-commit hook       |
| 머지 미루기               | 1주일 후 폭발                | 매일 17시 머지        |
| Auto-accept 동시 2+       | 코드 충돌                    | 동시 1개 룰           |
| 일일 정렬 생략            | 6개 세션 통제 불가           | P0 5분 의식           |
| 종료 의식 생략            | 다음 세션 시작 시 망각       | state.json 의무       |
| NOTICE 무시               | 정보 desync                  | 시작 시 의무 처리     |
| CLAUDE.md 학습 기록 안 함 | 같은 실수 반복               | 종료 시 1줄 의무      |

---

# 11. 페르소나 COT 검증 (이 매뉴얼)

## 🎩 MEPHISTO

> "운영 단계가 5-Plane을 진짜 동작하게 한다. 매뉴얼이 일과를 정의 ✓"

## 👻 GHOST

> "CI/CD가 매일 머지로 안정성? ✓ 1주일 후 폭발 회피."

## 👤 ADVOCATE

> "솔로 부담? — 자동화 80%. 인간은 정렬 5분 + 종료 5분 = 10분/일."

## 🔨 BREAKER

> "운영 중 Silent Pivot 회피? ✓ NOTICE Hook + ack 의무."

## 💻 HACKER

> "Auto-accept 안전? ✓ 동시 1개 + 영역 검증 + Cost Cap."

## 🛡️ SENTINEL

> "운영 중 secret 누출? Hook이 .env 변경 시 차단."

## 🔮 ORACLE

> "운영 5배 효율? ✓ 셋업 1주 → 개발 5배 가속."

---

# 12. 다음 단계

```
운영 시작 후:
  → 07. Verification & Integration Standard (통합 검증)
  → 08. Templates Library (스크립트, 양식)
```

---

**END OF 06. IMPLEMENTATION OPERATING MANUAL**

_"Daily discipline is what makes weekly progress."_
