#!/usr/bin/env bash
# 스테이징된 파일에서 비밀 패턴 감지 시 커밋 차단.
# 진산님 명시 보안 강제 절차 (가-1 plan §검토 흡수).
#
# 한계 (이월 명시):
#   - `git commit --no-verify` 우회 불가 (husky 의 본질적 한계)
#   - 과거 history 의 비밀 검출 안 함 (스테이징된 diff 만 검사)
#   - 서버사이드 강제(GitHub push protection / gitleaks) 는 Phase 1 후반 별도 plan
#
# 1차 리뷰(20260425) 발견 후 보강:
#   - NUL-split 으로 공백 파일명 안전 처리 (S-1 fix)
#   - PATTERNS 에 ANTHROPIC_API_KEY=/Cloudflare/PEM/JWT/DB URL 등 실 사용 벡터 추가 (S-2 fix)
#   - --diff-filter=ACMR 로 rename 포함 (S-8 fix)
#   - set -euo pipefail (S-10 fix)

set -euo pipefail

PATTERNS=(
  # Anthropic
  'sk-ant-[A-Za-z0-9_-]{20,}'
  'ANTHROPIC_API_KEY[[:space:]]*=[[:space:]]*["\047]?[A-Za-z0-9_-]{20,}'

  # OpenAI
  'sk-proj-[A-Za-z0-9_-]{20,}'
  'OPENAI_API_KEY[[:space:]]*=[[:space:]]*["\047]?[A-Za-z0-9_-]{20,}'

  # Cloudflare (단일 벤더 원칙 — 실 사용 토큰)
  'CLOUDFLARE_API_TOKEN[[:space:]]*=[[:space:]]*["\047]?[A-Za-z0-9_-]{20,}'
  'CF_API_TOKEN[[:space:]]*=[[:space:]]*["\047]?[A-Za-z0-9_-]{20,}'

  # Google
  'AIza[0-9A-Za-z_-]{35}'

  # AWS
  'AKIA[0-9A-Z]{16}'
  'aws_secret_access_key[[:space:]]*=[[:space:]]*["\047]?[A-Za-z0-9/+=]{30,}'

  # GitHub
  'ghp_[A-Za-z0-9]{36}'
  'gho_[A-Za-z0-9]{36}'
  'github_pat_[A-Za-z0-9_]{82}'

  # Slack
  'xoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+'
  'xoxp-[0-9]+-[0-9]+-[0-9]+-[A-Za-z0-9]+'
  'xapp-[0-9]+-[A-Z0-9]+-[0-9]+-[a-f0-9]+'
  'hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+'

  # npm
  'npm_[A-Za-z0-9]{36}'

  # JWT 3-segment (eyJ... base64 header.payload.signature)
  # Header 보통 길고, payload 는 가변(작은 클레임 허용), signature 는 HS256 기준 43+ 자
  'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}'

  # PEM private keys
  '-----BEGIN[ A-Z]+PRIVATE KEY-----'

  # DB URLs with embedded credentials
  '(postgres|postgresql|mysql|mongodb|redis)://[^[:space:]:/@]+:[^[:space:]@]+@'
)

VIOLATIONS=0

# Use NUL-separated paths (-z) + read -d '' to handle filenames with whitespace,
# tabs, or newlines safely. --diff-filter=ACMR includes Renamed (M-4 fix).
while IFS= read -r -d '' FILE; do
  [ -f "$FILE" ] || continue
  # Buffer added lines ONCE per file (fail-open fix, 2026-07-14 5-persona review):
  # the previous per-pattern pipeline `git diff | grep '^+' | grep -Eq` let grep -Eq
  # exit early on first match -> upstream SIGPIPE(141) -> under `set -o pipefail`
  # the whole pipeline reads as failure -> secret in a large (>pipe-buffer) file
  # was SILENTLY PASSED (reproduced 10/10 with 200k-line staged file).
  # Buffering also cuts N_patterns x `git diff` re-runs to one per file.
  ADDED=$(git diff --cached -- "$FILE" | grep -E '^\+' || true)
  [ -z "$ADDED" ] && continue
  for PATTERN in "${PATTERNS[@]}"; do
    # `--` separator protects against patterns/filenames starting with `-`.
    if grep -Eq -- "$PATTERN" <<<"$ADDED"; then
      printf '[BLOCKED] Secret pattern in: %s\n' "$FILE" >&2
      printf '          Pattern: %s\n' "$PATTERN" >&2
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
done < <(git diff --cached --name-only -z --diff-filter=ACMR)

if [ "$VIOLATIONS" -gt 0 ]; then
  printf '\n[BLOCKED] %d 건의 비밀 패턴이 스테이징됨. 커밋 차단.\n' "$VIOLATIONS" >&2
  printf '          환경변수로 옮기고 .gitignore 등록 후 재시도.\n' >&2
  exit 1
fi

exit 0
