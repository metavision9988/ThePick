# VOID DEV HARNESS — Extensions

> **세션 모니터링 + 자동 핸드오프** 및 **4-Pass 자동 리뷰** 확장 모듈.
> 기본 하네스(`VOID_DEV_HARNESS_README.md`) 설치 후 추가 적용.

---

## Extension 1: Session Monitor + Auto Handoff

### 문제

장시간 세션에서 컨텍스트 윈도우 포화 → 주의력 분산(Context Drift) → 코드 품질 저하.
사용자가 체감하기 전에 이미 품질이 떨어진 상태.

### 해결

Stop Hook에서 턴/시간을 추적하여 임계치 초과 시 경고.
`/user:handoff` 커맨드로 새 세션용 핸드오프 프롬프트 자동 생성.

```
매 응답 완료 → session-monitor.sh
  ├── 30턴 OR 60분 → 🟡 경고
  ├── 50턴 OR 90분 → 🔴 한계 → /user:handoff 권장
  └── 4시간 무사용 → 자동 리셋 (새 세션)
```

### 설치

#### 파일 1: `~/.claude/hooks/session-monitor.sh`

```bash
#!/bin/bash
# session-monitor.sh — Stop Hook
# 세션 건강 상태 모니터링 + 컨텍스트 드리프트 경고

PROJECT_HASH=$(echo "${CLAUDE_PROJECT_DIR:-$(pwd)}" | md5sum | cut -d' ' -f1)
SESSION_FILE="/tmp/claude-session-${PROJECT_HASH}.state"

# 4시간 이상 된 파일은 이전 세션 → 리셋
if [ -f "$SESSION_FILE" ]; then
  FILE_AGE=$(( $(date +%s) - $(stat -c %Y "$SESSION_FILE" 2>/dev/null || echo 0) ))
  if [ "$FILE_AGE" -gt 14400 ]; then
    rm -f "$SESSION_FILE"
  fi
fi

# 새 세션이면 초기화
if [ ! -f "$SESSION_FILE" ]; then
  echo "$(date +%s) 0" > "$SESSION_FILE"
fi

# 카운터 증가
read -r START TURNS < "$SESSION_FILE" 2>/dev/null
TURNS=$((TURNS + 1))
echo "$START $TURNS" > "$SESSION_FILE"

NOW=$(date +%s)
ELAPSED=$(( (NOW - START) / 60 ))

# CRITICAL RULES 리마인드 (항상)
echo "★ Silent Pivot 금지 | Stub 금지 | 사일런트 드롭 금지"

# 세션 건강 체크
if [ "$TURNS" -ge 50 ] || [ "$ELAPSED" -ge 90 ]; then
  echo "" >&2
  echo "🔴 [Session Monitor] 세션 한계 도달 (${TURNS}턴, ${ELAPSED}분)" >&2
  echo "   컨텍스트 드리프트 위험이 높습니다." >&2
  echo "   → /user:handoff 실행하여 핸드오프 프롬프트를 생성하세요." >&2
  echo "   → 새 세션에서 이어가면 품질이 크게 향상됩니다." >&2
elif [ "$TURNS" -ge 30 ] || [ "$ELAPSED" -ge 60 ]; then
  echo "" >&2
  echo "🟡 [Session Monitor] 세션 피로 감지 (${TURNS}턴, ${ELAPSED}분)" >&2
  echo "   복잡한 신규 작업은 새 세션에서 시작하는 것을 권장합니다." >&2
fi
```

```bash
chmod +x ~/.claude/hooks/session-monitor.sh
```

#### 파일 2: `~/.claude/commands/handoff.md`

```markdown
---
description: 세션 핸드오프 프롬프트 생성. 새 세션에서 작업을 이어갈 수 있도록 현재 상태를 캡슐화한다.
---

## 핸드오프 프롬프트 생성

현재 세션의 작업 상태를 분석하고, 새 세션에 붙여넣을 수 있는 **핸드오프 프롬프트**를 생성하라.

### 1. 상태 수집

아래 명령을 실행하여 현재 상태를 파악하라:

!`git branch --show-current`
!`git log --oneline -5`
!`git diff --stat`
!`git diff --cached --stat`
!`git status --short`

### 2. 핸드오프 프롬프트 작성

아래 템플릿으로 핸드오프 프롬프트를 생성하라. 마크다운 코드블록으로 감싸서 사용자가 복사할 수 있게 하라.

## 세션 핸드오프 — {프로젝트명}

### 브랜치 & 컨텍스트

- 브랜치: {현재 브랜치}
- 마지막 커밋: {최신 커밋 메시지}
- 미커밋 변경: {N}개 파일

### 이번 세션에서 한 일

- {완료된 작업 1}
- {완료된 작업 2}

### 수정된 파일 (미커밋)

{git diff --stat 결과 요약}

### 주요 결정 / 발견

- {아키텍처/기술 결정}
- {gotcha, 주의사항}

### 다음 할 일

1. {가장 우선순위 높은 작업}
2. {그 다음 작업}

### 주의사항

- {이어서 작업할 때 알아야 할 것}

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.

### 3. 규칙

- **이 대화에서 실제로 한 작업**만 포함. 추측 금지.
- 파일 경로는 정확하게.
- 코드블록 안에 전체 프롬프트를 넣어서 복사 한 번에 붙여넣기 가능하게.

### 4. 세션 리셋

프롬프트 생성 후:
!`rm -f /tmp/claude-session-*.state`

사용자에게 "새 세션에서 위 프롬프트를 붙여넣으면 됩니다" 안내.
```

#### 파일 3: `~/.claude/settings.json` — Stop Hook 연결

기존 Stop Hook을 session-monitor.sh로 교체:

```jsonc
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/session-monitor.sh",
          },
        ],
      },
    ],
    // ... 기존 PostToolUse, PreToolUse 유지
  },
}
```

### 커스터마이징

| 파라미터     | 기본값 | 위치               | 설명                     |
| ------------ | ------ | ------------------ | ------------------------ |
| 🟡 경고 턴   | 30     | session-monitor.sh | 복잡 작업 새 세션 권장   |
| 🟡 경고 시간 | 60분   | session-monitor.sh | 시간 기반 경고           |
| 🔴 한계 턴   | 50     | session-monitor.sh | 핸드오프 강력 권장       |
| 🔴 한계 시간 | 90분   | session-monitor.sh | 시간 기반 한계           |
| 세션 리셋    | 4시간  | session-monitor.sh | 이전 세션 파일 자동 삭제 |

프로젝트 성격에 따라 조정:

- **단순 프로젝트** (작은 코드베이스): 턴 50/80, 시간 90/150
- **복잡한 프로젝트** (20+ 모듈): 턴 25/40, 시간 45/75 (더 빠르게 경고)

---

## Extension 2: 4-Pass Auto Review Protocol

### 문제

첫 번째 코딩 완료 후 "완료" 선언 → 사용자가 수동으로 리뷰 요청 → 매번 문제 발견.
이는 첫 번째 코딩의 자기 검증이 구조적으로 부재함을 의미.

### 해결

L2+ 구현 완료 후, "완료" 선언 전에 4회 독립 분석을 **자동으로** 실행.
사용자가 리뷰를 요청하지 않아도 워크플로우에 내장.

```
코딩 완료
  │
  ├── Pass 1: SURGEON    (Bottom-Up)    — 코드 단독 결함
  ├── Pass 2: ARCHITECT  (Top-Down)     — 모듈/서비스 연계 결함
  ├── Pass 3: ADVOCATE   (Cross-Cutting) — UX + 보안
  └── Pass 4: CONTRACT   (기획 대조)    — Silent Pivot 탐지
  │
  ├── Critical 발견 → 즉시 수정 → 빌드/테스트 재확인
  └── Critical 0건 → "완료" 선언 가능
```

### 설치

#### 파일 1: `{project}/.claude/rules/auto-review-protocol.md`

```markdown
# 4-Pass 자동 리뷰 프로토콜

# L2+ 구현 완료 후, "완료" 선언 전에 반드시 4-Pass 리뷰를 실행한다.

# 이 프로토콜은 선택이 아니다. 스킵하면 CRITICAL RULE #4 위반이다.

## 트리거 조건

- L2 이상 구현 작업 완료 시 (새 기능, 기존 기능 수정, 리팩토링)
- L1(스타일/문서/1줄 버그)은 면제

## Pass 1 — SURGEON (Bottom-Up, 코드 정합성)

**관점: "이 코드 단독으로 터지는 경로가 있는가?"**

- Null/Undefined: 반환값 null 가능 함수 호출 후 크래시 경로
- Async: `await` 누락 (DB, import(), 파일 I/O)
- 경계값: 빈 배열/문자열, NaN/Infinity, 음수
- 에러 처리: 빈 catch 금지, 사용자 피드백 + 로깅 패턴
- 메모리: 리소스 생성 ↔ 해제 짝 확인
- 타이밍: 이벤트 등록 순서, DOM 존재 전 접근

## Pass 2 — ARCHITECT (Top-Down, 연계 검증)

**관점: "이 코드가 다른 모듈과 만나면 터지는가?"**

- Import 방향: 아키텍처 규칙 준수 (단방향 등)
- 인터페이스 계약: 함수 시그니처, 이벤트 payload, API 응답 shape 일치
- 초기화 순서: 모듈 간 의존성 순서 보장
- 공유 코드 수정 시: 모든 사용처 영향 확인
- 데이터 흐름: 송신/수신 shape 일치

## Pass 3 — ADVOCATE (Cross-Cutting, UX + 보안)

**관점: "처음 쓰는 사용자와 공격자, 둘 다 만족하는가?"**

- 에러 UX: 에러 메시지가 사용자 친화적인지
- 상태 표현: 로딩/빈 데이터/에러 UI 존재 확인
- 접근성: 키보드, aria-label, 색상 대비
- 국제화: 하드코딩 텍스트 없음
- 보안: 입력 검증, XSS 방지, 민감 데이터 노출 없음

## Pass 4 — CONTRACT (기획 대조, Silent Pivot 탐지)

**관점: "기획대로 만들었는가, 편한 대로 만들었는가?"**

- 설계서 대조: 빠진 기능, 추가된 기능
- 수치/임계값 일치
- 프로젝트 Hard Limit 위반 여부
- 네이밍/컨벤션 규칙 준수

## 실행 규칙

1. 각 Pass는 별도 분석으로 실행 (한꺼번에 뭉치지 마라)
2. 각 Pass 결과를 Critical/Major/Minor로 분류
3. Critical/Major는 즉시 수정. Minor는 보고만.
4. 수정 후 빌드/테스트 재확인
5. 4-Pass 모두 Critical 0건이어야 "완료" 선언 가능

## 보고 형식

── 4-PASS REVIEW ──────────────────
Pass 1 (Surgeon): ✅ 0건 / 🔴 N건 / 🟠 N건
Pass 2 (Architect): ✅ 0건 / 🔴 N건 / 🟠 N건
Pass 3 (Advocate): ✅ 0건 / 🔴 N건 / 🟠 N건
Pass 4 (Contract): ✅ 0건 / 🔴 N건 / 🟠 N건
판정: 완료 가능 / 수정 필요
────────────────────────────────────
```

**★ 프로젝트 특화**: 각 Pass의 체크 항목을 프로젝트 스택에 맞게 수정한다.
예시:

- **React 프로젝트**: Pass 1에 useEffect cleanup, Pass 2에 prop drilling, Pass 3에 React a11y
- **API 서버**: Pass 1에 SQL injection, Pass 2에 트랜잭션 경계, Pass 3에 rate limiting
- **Vanilla JS**: Pass 1에 메모리 관리, Pass 2에 이벤트/CSS chain, Pass 3에 i18n

#### 파일 2: `~/.claude/skills/void-workflow/SKILL.md` — 워크플로우에 삽입

L2/L3 워크플로우의 "코딩 실행"과 "완료 확인" 사이에 리뷰 단계를 추가:

```markdown
## L2 Standard — 간소 plan 후 실행

1. **기존 코드 확인**
2. **TODO 5줄 공유**
3. **코딩 실행**
4. **★ 4-Pass 자동 리뷰** — 코딩 완료 후, "완료" 선언 전에 반드시 실행. 스킵 불가.
5. **완료 확인**
```

스킬에 4-Pass 요약도 포함:

```markdown
## ★ 4-Pass 자동 리뷰 프로토콜 (L2+ 필수)

코딩 직후, 변경된 코드를 대상으로 4회 독립 분석을 수행한다.
**"리뷰 요청 없이도 기술부채 0을 목표로 한다."**

**Pass 1 — SURGEON (Bottom-Up):** 이 코드 단독으로 터지는 경로.
**Pass 2 — ARCHITECT (Top-Down):** 다른 모듈과 만나면 터지는 경로.
**Pass 3 — ADVOCATE (Cross-Cutting):** 사용자와 공격자 관점.
**Pass 4 — CONTRACT (기획 대조):** 기획대로 만들었는가.

각 Pass: Critical/Major/Minor 분류. Critical 즉시 수정. 4-Pass 후 보고서 출력.
상세 체크리스트: 프로젝트 `.claude/rules/auto-review-protocol.md` 참조.
```

#### 파일 3: `{project}/.claude/rules/dev-guide.md` — 규칙 추가

dev-guide.md에 아래 섹션 추가:

```markdown
## ★ 자동 리뷰 (L2+ 구현 후 필수, 스킵 불가)

- L2 이상 구현 완료 후, "완료" 선언 전에 4-Pass 리뷰를 반드시 실행한다.
- Pass 1(Surgeon) → Pass 2(Architect) → Pass 3(Advocate) → Pass 4(Contract)
- Critical 0건이어야 "완료" 선언 가능. 상세: `auto-review-protocol.md`
- 사용자가 리뷰를 요청하지 않아도 자동 수행한다. 이것은 선택이 아닌 의무다.
```

### 강제 메커니즘 (3중)

```
방어선 1: void-workflow Skill — 워크플로우 절차에 리뷰 단계 강제 삽입
방어선 2: dev-guide.md 규칙 — "L2+ 후 4-Pass 필수" 명문화
방어선 3: auto-review-protocol.md — Pass별 구체적 체크리스트
```

세 곳에서 동일한 의무를 반복함으로써, 하나를 놓쳐도 다른 곳에서 잡는다.

### 새 프로젝트 적용 순서

```
1. auto-review-protocol.md 템플릿 복사
2. 프로젝트 스택에 맞게 각 Pass 체크 항목 수정
3. dev-guide.md에 자동 리뷰 규칙 4줄 추가
4. void-workflow SKILL.md에 리뷰 단계 삽입 (이미 글로벌이면 스킵)
```

---

## Quick Setup (두 Extension 한번에)

### 전역 (1회)

```bash
# 1. session-monitor.sh 복사 + 실행 권한
cp session-monitor.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/session-monitor.sh

# 2. handoff 커맨드 복사
cp handoff.md ~/.claude/commands/

# 3. settings.json Stop Hook 교체
# "Stop" 훅의 command를:
#   "bash ~/.claude/hooks/session-monitor.sh"
# 로 변경

# 4. void-workflow 스킬에 4-Pass 단계 포함 (이미 글로벌)
```

### 프로젝트별

```bash
# 1. auto-review-protocol.md 복사 + 프로젝트 특화 수정
cp auto-review-protocol.md {project}/.claude/rules/

# 2. dev-guide.md에 자동 리뷰 규칙 4줄 추가
```

---

## 검증

### Session Monitor 테스트

```
긴 작업을 시뮬레이션하여 30턴 이상 대화 유지.
→ 🟡 경고 메시지가 Stop Hook에서 출력되는지 확인.
→ /user:handoff 실행 시 핸드오프 프롬프트가 생성되는지 확인.
```

### 4-Pass Auto Review 테스트

```
L2 기능 구현을 요청.
→ 코딩 완료 후 사용자가 리뷰를 요청하지 않았는데도
   4-Pass 리뷰가 자동으로 실행되는지 확인.
→ Critical 발견 시 즉시 수정하는지 확인.
→ 보고서 형식이 올바른지 확인.
```

---

## 철학

```
세션 모니터: AI도 피로해진다. 인정하고 교대하라.
자동 리뷰:   리뷰를 요청해야만 품질이 나오면, 첫 코딩이 미완성이다.
             완성의 기준을 "코딩 끝"에서 "리뷰 끝"으로 옮겨라.
```

— VOID DEV HARNESS Extensions · 2026
