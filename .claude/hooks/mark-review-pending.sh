#!/bin/bash
# mark-review-pending.sh — PostToolUse(Write|Edit)
# 코드 파일 수정 시 리뷰 필요 마커 생성 + 변경 파일 누적(티어 판정용). 범용판.
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

# 면제: 빌드 산출물·의존성·문서·설정·테스트·.claude 자기 자신
EXEMPT='(/node_modules/|/dist/|/build/|/out/|/\.next/|/vendor/|/target/|/__pycache__/|/\.git/|/\.claude/|(^|/)docs?/)'
EXEMPT_EXT='\.(md|mdx|txt|json|ya?ml|toml|ini|lock|map|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot)$'
TEST='(\.test\.|\.spec\.|(^|/)(__tests__|tests?|test)/)'
if echo "$FILE_PATH" | grep -qE "$EXEMPT"     ; then exit 0; fi
if echo "$FILE_PATH" | grep -qE "$EXEMPT_EXT" ; then exit 0; fi
if echo "$FILE_PATH" | grep -qE "$TEST"       ; then exit 0; fi

# 소스 코드 확장자만 트리거
SRC='\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte|astro|py|rb|go|rs|java|kt|kts|scala|swift|m|mm|c|cc|cpp|cxx|h|hpp|cs|php|ex|exs|clj|css|scss|sass|less|sql|sh|bash)$'
if echo "$FILE_PATH" | grep -qE "$SRC"; then
  MARKER="$CLAUDE_PROJECT_DIR/.claude/.review-pending"
  LIST="$CLAUDE_PROJECT_DIR/.claude/.review-files"
  if [ ! -f "$MARKER" ]; then
    date '+%Y-%m-%d %H:%M:%S' > "$MARKER"
    echo "--- 코드 변경 감지: 세션 종료 전 리뷰 필수 ---"
  fi
  REL="${FILE_PATH#$CLAUDE_PROJECT_DIR/}"
  if [ ! -f "$LIST" ] || ! grep -qxF "$REL" "$LIST" 2>/dev/null; then
    echo "$REL" >> "$LIST"
  fi
fi
exit 0
