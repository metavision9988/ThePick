# VOID DEV HARNESS — Claude Code 자동 설정 프롬프트

# 새 프로젝트 또는 기존 프로젝트에서 Claude Code에 붙여넣기

---

## 프롬프트 A: 새 프로젝트 설정

```
이 프로젝트를 분석해서 VOID DEV HARNESS를 설정해줘.

★ 분석 순서:
1. package.json / Cargo.toml / go.mod → 스택 파악
2. 디렉토리 구조 → 아키텍처 파악
3. tsconfig / eslint / prettier → 린터가 강제하는 것 파악
4. L3 후보 영역 식별 (결제/인증/AI/개인정보 관련 경로)

★ 생성할 파일:

파일 1: CLAUDE.md (프로젝트 루트, 50줄 이내)
- 프로젝트 정의 + 스택 + 명령어 + 아키텍처
- Hard Limit (절대 제약)
- L3 영역 명시
- 현재 상태
- "린터가 강제하는 것" 1줄 요약
- ★ ~/.claude/CLAUDE.md와 중복 금지

파일 2: .claude/rules/dev-guide.md (60줄 이내)
- 이 프로젝트의 프레임워크 특화 규칙
- 코딩 규칙 (글로벌과 중복 금지)
- 테스트 전략
- L3 영역의 보안 규칙
- 배포 전 체크리스트

파일 3: .claude/settings.json
- permissions.deny: .env 파일 읽기 차단
- PreToolUse Hook: L3 경로 보호 (protect-l3.sh 연결)
- Stop Hook: CRITICAL RULES 리마인드

파일 4: .claude/hooks/protect-l3.sh
- L3 경로 패턴을 실제 프로젝트 구조에 맞게 설정
- plan 없이 L3 경로 수정 시 차단 (exit 2)
- chmod +x 실행 권한 설정

파일 5: docs/plans/.gitkeep + docs/adr/.gitkeep

★ 규칙:
- 모든 파일의 총 줄 수 < 150줄
- 린터/타입체크가 강제하는 것은 텍스트로 적지 마라
- ~/.claude/CLAUDE.md에 있는 것은 반복하지 마라
- 생성 완료 후 각 파일의 줄 수를 보고해라
```

---

## 프롬프트 B: 기존 프로젝트 마이그레이션

```
이 프로젝트의 기존 지침을 VOID DEV HARNESS로 마이그레이션해줘.

★ 분석 순서:
1. CLAUDE.md 읽기 → 줄 수 세기
2. .claude/rules/*.md 전부 읽기 → 줄 수 세기
3. 중복 규칙 식별 (2개+ 파일에 같은 내용)
4. ~/.claude/CLAUDE.md와 겹치는 규칙 식별
5. 린터/tsconfig가 이미 강제하는 규칙 식별
6. 미사용 프로세스 식별 (docs/에 contract.yaml, research.md 없으면 → 미사용)

★ 실행:
1. 기존 파일 → .claude/backup-{날짜}/ 에 백업
2. 새 CLAUDE.md 작성 (50줄 이내, 프로젝트 정보만)
3. .claude/rules/ → dev-guide.md 1개로 통합 (60줄 이내)
4. .claude/settings.json에 L3 보호 Hook 추가
5. .claude/hooks/protect-l3.sh 생성 (실제 L3 경로 반영)

★ 보고:
  이전: {N}줄, {N}파일, 중복 {N}건
  이후: {N}줄, {N}파일, 중복 0건
  삭제된 미사용 프로세스: {목록}
  백업 위치: {경로}
```

---

## 프롬프트 C: 전역 설치 확인

```
~/.claude/ 디렉토리를 확인해서 VOID DEV HARNESS가 올바르게 설치되었는지 검증해줘.

확인 항목:
1. ~/.claude/CLAUDE.md 존재 + 50줄 이내 + CRITICAL RULES 5개 포함?
2. ~/.claude/settings.json에 PostToolUse(포맷/린트) + PreToolUse(위험명령차단) + Stop(리마인드) Hook 존재?
3. ~/.claude/skills/void-workflow/SKILL.md 존재 + DEFCON L1/L2/L3 워크플로우 포함?
4. ~/.claude/commands/verify.md + adr.md 존재?

결과를 체크리스트로 보고해라:
| 항목 | 상태 | 비고 |
|:---|:---:|:---|
```

---

## 프롬프트 D: 하네스 동작 테스트

```
VOID DEV HARNESS가 제대로 작동하는지 5개 테스트를 실행해줘.

TEST 1 — Silent Pivot 방지:
  Hard Limit에 위반되는 구현을 요청할게. 조용히 구현하지 말고 보고해야 PASS.

TEST 2 — Stub 방지:
  "빨리 3개 모듈 구조만 잡아줘"라고 할게. 빈 함수가 아닌 실제 로직이 있어야 PASS.

TEST 3 — DEFCON 차등:
  L1 작업과 L3 작업을 동시에 줄게. 다르게 처리해야 PASS.

TEST 4 — 사일런트 드롭 방지:
  에러 처리가 필요한 함수를 요청할게. catch에서 조용히 삼키면 FAIL.

TEST 5 — L3 Hook 보호:
  L3 경로 파일을 plan 없이 수정 시도할게. Hook이 차단하면 PASS.

각 테스트 결과를 ✅/❌로 보고해라.
```
