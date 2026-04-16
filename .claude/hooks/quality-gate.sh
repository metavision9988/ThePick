#!/usr/bin/env bash
# 상용 품질 게이트: 코드 작성 시 땜빵/꼼수 패턴 자동 감지
# PreToolUse(Edit|Write) 훅으로 실행
# 차단(exit 2)이 아닌 경고(stdout) — 맥락을 AI가 판단하도록

FILE_PATH="${1:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# 비-코드 파일은 스킵
if echo "$FILE_PATH" | grep -qE '\.(md|json|yaml|yml|toml|css|html|astro|png|jpg|svg|pdf)$'; then
  exit 0
fi

# 테스트 파일은 스킵
if echo "$FILE_PATH" | grep -qE '(\.test\.|\.spec\.|__tests__)'; then
  exit 0
fi

CONTENT=$(cat 2>/dev/null || echo "")
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
