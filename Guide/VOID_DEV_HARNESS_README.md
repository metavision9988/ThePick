# 🖤 VOID DEV HARNESS

> **"2,500줄의 부탁보다 10개의 강제가 더 안전하다."**

VOID DEV UNIFIED CONSTITUTION v3.5.1 (2,500줄)의 후속.
규칙을 "텍스트 부탁"에서 "구조적 강제"로 재배치한 하네스 시스템.

---

## 핵심 차이

|               |       이전 (헌법)       |              이후 (하네스)               |
| :------------ | :---------------------: | :--------------------------------------: |
| 규칙 전달     | CLAUDE.md 텍스트 (부탁) | Hook/린터 (강제) + CLAUDE.md 50줄 (판단) |
| 총 줄 수      |        2,500줄+         |                  ~160줄                  |
| 실행률        |   ~0% (FileBeam 실측)   |           5/5 합격 (검증 완료)           |
| 프로젝트 추가 |     200줄 복사+수정     |             50줄 + Hook 상속             |

---

## 구조

```
~/.claude/                          ← 전역 (모든 프로젝트)
├── CLAUDE.md                       ← 50줄: 불변 원칙
├── settings.json                   ← 전역 Hook (포맷/린트/위험차단)
├── skills/void-workflow/SKILL.md   ← DEFCON별 워크플로우
└── commands/
    ├── verify.md                   ← /user:verify
    └── adr.md                      ← /user:adr

{project}/                          ← 프로젝트별
├── CLAUDE.md                       ← 50줄: 스택 + 제약 + 상태
├── .claude/
│   ├── settings.json               ← L3 보호 Hook
│   ├── hooks/protect-l3.sh         ← L3 경로 차단 스크립트
│   └── rules/dev-guide.md          ← 60줄: 프로젝트 특화 규칙
└── docs/
    ├── plans/                      ← L3에서만 사용
    └── adr/                        ← 필요 시에만 사용
```

---

## 설치

### 1. 전역 설치 (1회)

```bash
git clone {this-repo} ~/void-dev-harness
cd ~/void-dev-harness
chmod +x scripts/setup-harness.sh
./scripts/setup-harness.sh global
```

### 2. 새 프로젝트

```bash
./scripts/setup-harness.sh init ~/projects/my-new-app
cd ~/projects/my-new-app
# CLAUDE.md와 .claude/rules/dev-guide.md에서 {중괄호} 부분 수정
```

### 3. 기존 프로젝트 마이그레이션

```bash
./scripts/setup-harness.sh migrate ~/projects/existing-app
# 기존 파일은 .claude/backup-{날짜}/에 자동 백업됨
# 새 CLAUDE.md에 프로젝트 정보 채우기
```

### 4. Claude Code에서 자동 설정

`scripts/claude-code-prompts.md`의 프롬프트를 Claude Code에 붙여넣으면
AI가 프로젝트를 분석해서 자동으로 하네스를 구성한다.

---

## 3개 방어선

```
방어선 1: CRITICAL RULES 5개 (CLAUDE.md — 판단 영역)
  → 가장 치명적인 실수 5개를 텍스트로 3중 반복
  → 글로벌 상단 + 글로벌 하단 + Stop Hook

방어선 2: Hook/린터 (settings.json — 기계적 강제)
  → PostToolUse: 저장 시 자동 포맷 + 린트
  → PreToolUse: 위험 명령 차단 + L3 경로 보호
  → Stop: CRITICAL RULES 리마인드

방어선 3: DEFCON (Skill — 상황별 프로세스)
  → L1: 바로 코딩
  → L2: TODO 5줄 → 코딩
  → L3: plan 필수 → 인간 승인 → 코딩
```

---

## 파일별 역할

| 파일                                   | 수단     | 역할                         | 줄 수 |
| :------------------------------------- | :------- | :--------------------------- | :---: |
| `~/.claude/CLAUDE.md`                  | 조언     | 불변 원칙, DEFCON, 실수 패턴 |  50   |
| `~/.claude/settings.json`              | **강제** | 포맷/린트, 위험 차단         |   —   |
| `~/.claude/skills/void-workflow/`      | 절차     | DEFCON별 워크플로우          |  50   |
| `{project}/CLAUDE.md`                  | 조언     | 스택, 제약, 현재 상태        |  50   |
| `{project}/.claude/settings.json`      | **강제** | L3 경로 보호                 |   —   |
| `{project}/.claude/hooks/`             | **강제** | protect-l3.sh                |  25   |
| `{project}/.claude/rules/dev-guide.md` | 참조     | 프레임워크 특화 규칙         |  60   |

---

## L3 경로 보호 작동 방식

```
AI가 src/auth/token.ts를 수정하려고 시도
    │
    ▼
PreToolUse Hook 발동 → protect-l3.sh 실행
    │
    ├─ docs/plans/current.plan.md 존재?
    │   ├─ YES → exit 0 (허용)
    │   └─ NO  → exit 2 (차단) + 에러 메시지
    │
    ▼
차단 시 AI에게 피드백:
"❌ L3 영역입니다. plan을 먼저 작성하세요."
```

---

## 커스터마이징

### L3 경로 변경

`.claude/hooks/protect-l3.sh`의 `L3_PATTERNS` 수정:

```bash
L3_PATTERNS="^src/(auth|payment|crypto|billing)/"
```

### 프레임워크별 rules 수정

`.claude/rules/dev-guide.md`에서 프레임워크 섹션 수정.

### 번들 크기 체크 추가 (선택)

`.claude/settings.json`의 PostToolUse에 추가:

```jsonc
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "if echo \"$CLAUDE_TOOL_INPUT\" | grep -q 'build'; then node -e \"const s=require('fs').statSync('dist/index.js');if(s.size>204800)process.exit(1)\" 2>/dev/null; fi",
    },
  ],
}
```

---

## 검증 결과

FileBeam 프로젝트에서 슬림화 후 테스트 (2026-04-11):

| TEST | 시나리오             | 결과 |
| :--: | :------------------- | :--: |
|  1   | Silent Pivot 방지    |  ✅  |
|  2   | Stub 금지            |  ✅  |
|  3   | DEFCON 차등          |  ✅  |
|  4   | 사일런트 드롭 금지   |  ✅  |
|  5   | Pattern Mimicry 방지 |  ✅  |

**5/5 합격. 860줄 → 163줄로 81% 줄이고 준수율 0% → 100%.**

---

## 철학

```
프롬프트는 부탁이다. 훅은 강제다.
5개 규칙을 100% 따르는 것이
180개 규칙을 0% 따르는 것보다
180배 안전하다.
```

— VOID DEV HARNESS · 2026
