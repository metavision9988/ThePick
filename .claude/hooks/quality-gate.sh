#!/usr/bin/env bash
# 상용 품질 게이트: 코드 작성 시 땜빵/꼼수 패턴 자동 감지
# PreToolUse(Edit|Write) 훅으로 실행
# 차단(exit 2)이 아닌 경고(stdout) — 맥락을 AI가 판단하도록

# 스킵 대상 판정 — 비-코드 파일 / 테스트 파일 (stdin 소비 전에 호출한다)
skip_target() {
  echo "$1" | grep -qE '\.(md|json|yaml|yml|toml|css|html|astro|png|jpg|svg|pdf)$' && return 0
  echo "$1" | grep -qE '(\.test\.|\.spec\.|__tests__)' && return 0
  return 1
}

# ── 2026-08-06 수리 (역이식 STAGE 0-1b) ───────────────────────────────────────
# 이 훅도 protect-l3.sh 와 **같은 이유로 죽어 있었다**: 경로를 argv 로만 읽는데
# settings.json 이 비표준 변수를 넘겨 빈 값이 들어왔고, 즉시 exit 0 했다.
# 즉 안전장치 2개가 동시에 무력이었다.
#   입력 계약: Claude Code 훅은 stdin 으로 JSON 1개를 준다 (경로·본문 모두 그 안에 있다).
#   구 계약(argv=경로 + stdin=본문)도 하위호환 유지 — 수동 호출·테스트 경로.
#   ★stdin 은 한 번만 소비된다 → 두 계약은 상호배타로 분기한다.
# ──────────────────────────────────────────────────────────────────────────────
FILE_PATH="${1:-}"
CONTENT=""
HOOK_INPUT=""

# ★독립 리뷰 수리 (2026-08-06): 스킵 판정을 stdin 소비보다 **먼저** 한다.
#   초판은 argv 경로에서 스킵 대상(.md 등)이어도 `cat` 을 먼저 실행해, stdin 이 열린 채
#   닫히지 않는 호출(수동 실행 등)에서 무한 대기했다.
if [[ -n "$FILE_PATH" ]]; then
  skip_target "$FILE_PATH" && exit 0
  CONTENT=$(cat 2>/dev/null || echo "")   # 구 계약: argv=경로, stdin=본문
elif [[ ! -t 0 ]]; then
  # 표준 계약: stdin JSON 1개에서 경로와 본문을 모두 뽑는다.
  # 본 훅은 **경고 전용**(차단 없음)이라 jq 부재 시엔 조용히 스킵한다 — protect-l3.sh 가
  # 차단 책임을 지고 그쪽은 fail-closed 다. 여기서 exit 2 를 내면 경고 훅이 작업을 막는다.
  HOOK_INPUT=$(cat 2>/dev/null || echo "")
  command -v jq >/dev/null 2>&1 || exit 0
  FILE_PATH=$(printf '%s' "$HOOK_INPUT" \
    | jq -r '.tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null || true)
  [[ -z "$FILE_PATH" ]] && exit 0
  skip_target "$FILE_PATH" && exit 0
  # Write=content / Edit=new_string / MultiEdit=edits[].new_string — 3서식 전부 수집
  CONTENT=$(printf '%s' "$HOOK_INPUT" | jq -r '
      [ .tool_input.content?,
        .tool_input.new_string?,
        ( .tool_input.edits? // [] | .[]?.new_string? )
      ] | map(select(type == "string")) | join("\n")
    ' 2>/dev/null || true)
fi

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

WARNINGS=""

# 1. any 타입
if echo "$CONTENT" | grep -qE ':\s*any\b|as\s+any\b|<any>'; then
  WARNINGS="${WARNINGS}\n  - any 타입 감지 — 정확한 타입을 정의하세요"
fi

# 2. console.log (warn/error는 허용)
if echo "$CONTENT" | grep -qE 'console\.log\('; then
  WARNINGS="${WARNINGS}\n  - console.log 감지 — 구조화된 로깅을 사용하세요"
fi

# 3. TODO/HACK/임시 주석
if echo "$CONTENT" | grep -qiE '(//|/\*)\s*(TODO|FIXME|HACK|TEMP|WORKAROUND)'; then
  WARNINGS="${WARNINGS}\n  - TODO/HACK 주석 감지 — 상용 품질로 즉시 구현하세요"
fi

# 4. 빈 catch
if echo "$CONTENT" | grep -qE 'catch\s*(\([^)]*\))?\s*\{\s*\}'; then
  WARNINGS="${WARNINGS}\n  - 빈 catch 감지 — 에러 로깅 + 전파/폴백을 구현하세요"
fi

# 5. 동적 코드 실행
if echo "$CONTENT" | grep -qE 'new\s+Function\('; then
  WARNINGS="${WARNINGS}\n  - 동적 코드 실행 감지 — Hard Rule #9 위반"
fi

# 6. innerHTML 사용 (XSS 위험)
if echo "$CONTENT" | grep -qE '\.innerHTML\s*='; then
  WARNINGS="${WARNINGS}\n  - innerHTML 직접 할당 감지 — XSS 위험, JSX 보간을 사용하세요"
fi

if [[ -n "$WARNINGS" ]]; then
  echo "━━ QUALITY GATE ━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  대상: $FILE_PATH"
  echo -e "$WARNINGS"
  echo ""
  echo "  상용 품질 목표: 10K 유저, 매년 개정, 확장 가능한 구조"
  echo "  임시방편이 아닌 확장 가능한 방식으로 구현하세요."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

exit 0
