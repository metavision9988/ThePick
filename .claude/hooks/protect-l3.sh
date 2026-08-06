#!/usr/bin/env bash
# L3 영역 보호: plan 없이 L3 파일 수정 시 차단
# 관련 규칙: CLAUDE.md "L3 영역 (plan 필수 + 인간 승인 후 코딩)"
# 관련 ADR: docs/adr/ADR-002 (결제), ADR-005 (인증)
#
# ── 2026-08-06 수리 (역이식 STAGE 0-1) ─────────────────────────────────────────
# 본 훅은 이 수리 전까지 **아무것도 막지 않았다** (라이브 프로브로 확정: L3 패턴 경로에
# 실제 Write 를 시도했더니 통과, 같은 경로를 argv 로 주면 exit 2). 원인 = 경로를 argv 로만
# 읽는데 settings.json 이 비표준 변수를 넘겨 빈 값이 들어왔고, `[[ -z ]] && exit 0` 이
# 무조건 통과시켰다. 형제 훅 mark-review-pending.sh 는 stdin JSON 을 파싱하는데
# 이 훅만 낡은 계약을 쓰고 있었다.
#   수리 3종 = ①stdin JSON 폴백 ②realpath 경로 정규화 ③scope 대조
#   출처 = catchall(이음길) `.claude/hooks/protect-l3.sh` (킷 부트스트랩 5-페르소나 P3 F-3 +
#          2026-07-27 scope 대조 결재). 근거 = docs/plans/catchall-역이식-분석-20260806.md §3-A
#   음성 실측 = scripts/protect-l3.test.sh (가드는 만든 즉시 고의로 깨서 red 를 확인한다)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# L3 경로 패턴 (확장됨 — 2026-04-18 Session 7 5-페르소나 리뷰 반영)
# ★ 본 수리에서 패턴 자체는 건드리지 않는다 (패턴 변경 = 정책 변경, 수리 범위 밖).
#   관측: "constants"·"ontology-registry" 는 무앵커 substring 이라 과잉 매칭한다
#   (예: docs/plans/*constants*.md 도 L3 로 잡힘). 과잉 차단은 fail-safe 방향이라 존치.
L3_PATTERNS=(
  "^packages/formula-engine/"       # Formula Engine — 산식 계산 (L3 core)
  "^packages/payment/"              # 결제 어댑터 (ADR-002, 설계서 §2.1 L3)
  "^migrations/"                    # DB 스키마 (재해 시 복구 불가)
  "^apps/api/src/auth/"             # 인증 경로
  "^apps/api/src/webhooks/"         # 결제 webhook 수신 경로
  "^apps/api/src/db/schema"         # Drizzle schema (스키마 drift 방지)
  "constants"                       # 매직 넘버 레지스트리
  "ontology-registry"               # Ontology Lock
)

FILE_PATH="${1:-}"

# ① argv 부재 시 stdin JSON(Claude Code 훅 표준 입력) 폴백 —
#    mark-review-pending.sh 와 입력 계약 통일. 이게 없어서 훅이 죽어 있었다.
#
#    ★독립 리뷰 수리 (2026-08-06): 초판은 `jq ... || true` 로 실패를 빈 문자열에 흡수해
#    **jq 부재·손상 JSON 이면 조용히 exit 0** 했다 — 방금 고친 사고("빈 값 → 무조건 통과")와
#    같은 클래스를 다른 문으로 재도입한 것. 판정 불가는 통과가 아니라 **차단**이다(fail-closed).
#    단 NotebookEdit 처럼 file_path 가 아예 없는 정당 케이스는 통과시켜야 하므로,
#    "파싱 실패"(exit≠0)와 "파싱 성공·경로 없음"(exit 0 + 빈 값)을 종료코드로 구분한다.
if [[ -z "$FILE_PATH" ]] && [[ ! -t 0 ]]; then
  HOOK_JSON=$(cat 2>/dev/null || true)
  if ! command -v jq >/dev/null 2>&1; then
    echo "❌ L3 가드 판정 불가 — jq 부재 (fail-closed). PATH 를 확인하라." >&2
    exit 2
  fi
  if ! FILE_PATH=$(printf '%s' "$HOOK_JSON" \
        | jq -r '.tool_input.file_path // .tool_input.filePath // .tool_input.notebook_path // empty' 2>/dev/null); then
    echo "❌ L3 가드 판정 불가 — 훅 입력 JSON 파싱 실패 (fail-closed)." >&2
    exit 2
  fi
fi

# 파일 경로 없으면 허용 (스킵) — 파싱은 성공했는데 경로 필드가 없는 정당 케이스
[[ -z "$FILE_PATH" ]] && exit 0

# ★독립 리뷰 수리: ROOT_DIR 도 정규화한다. 초판은 ABS_PATH 만 realpath 하고 ROOT_DIR 은
#   환경변수 원문을 접두 제거에 써서, 끝 슬래시(`/repo/`)나 심링크 루트면 접두가 안 벗겨지고
#   → RELATIVE_PATH==ABS_PATH → 아래 "루트 밖 스킵"이 레포 내부를 외부로 오판해 무음 통과했다.
ROOT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
ROOT_DIR=$(realpath -m "$ROOT_DIR" 2>/dev/null || printf '%s' "${ROOT_DIR%/}")

# ② 경로 정규화 — 구본은 접두 제거만 해서 `./migrations/x.sql`,
#    `migrations/../migrations/x.sql`, `$ROOT/../ThePick/migrations/x.sql` 이 전부 우회했다.
#    realpath -m 은 미존재 파일에도 동작한다 (신규 파일 생성이 정상 케이스).
case "$FILE_PATH" in
  /*) ABS_PATH="$FILE_PATH" ;;
  *)  ABS_PATH="$ROOT_DIR/$FILE_PATH" ;;
esac
ABS_PATH=$(realpath -m "$ABS_PATH" 2>/dev/null || printf '%s' "$ABS_PATH")
RELATIVE_PATH="${ABS_PATH#"$ROOT_DIR"/}"

# 루트 밖 경로는 이 레포의 L3 규율 대상이 아니다 (스킵)
[[ "$RELATIVE_PATH" == "$ABS_PATH" && "$ABS_PATH" == /* ]] && exit 0

# L3 패턴 매칭 확인
matched=0
MATCHED_PATTERN=""
for pattern in "${L3_PATTERNS[@]}"; do
  if printf '%s' "$RELATIVE_PATH" | grep -qE "$pattern"; then
    matched=1
    MATCHED_PATTERN="$pattern"
    break
  fi
done
[[ $matched -eq 0 ]] && exit 0

# plan 파일 존재 + 내용 검증
PLAN_FILE="$ROOT_DIR/docs/plans/current.plan.md"

if [[ ! -f "$PLAN_FILE" ]]; then
  cat >&2 <<EOF
❌ L3 영역 수정 차단

  대상 파일: $RELATIVE_PATH
  매칭 패턴: $MATCHED_PATTERN

  docs/plans/current.plan.md 를 먼저 작성하세요.
  최소 필드:
    - phase: (0|1|2|3)
    - step: (예: 1-2)
    - approved_by: (진산 또는 Claude 독립리뷰 후)
    - scope: (이 plan 이 다루는 파일 경로 — 인라인 또는 YAML 블록 리스트)
    - risk_level: (L2|L3)

  템플릿: docs/plans/TEMPLATE.plan.md 참고
EOF
  exit 2
fi

# 필수 필드 존재 확인
MISSING=()
for field in "phase:" "step:" "approved_by:" "scope:" "risk_level:"; do
  if ! grep -qE "^${field}" "$PLAN_FILE"; then
    MISSING+=("$field")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "❌ docs/plans/current.plan.md 필수 필드 누락: ${MISSING[*]}" >&2
  echo "   템플릿: docs/plans/TEMPLATE.plan.md" >&2
  exit 2
fi

# approved_by 가 "TBD" 또는 빈 값이면 거부
APPROVED=$(grep -E "^approved_by:" "$PLAN_FILE" | head -n1 | sed 's/^approved_by:[[:space:]]*//')
if [[ -z "$APPROVED" ]] || [[ "$APPROVED" == "TBD" ]] || [[ "$APPROVED" == "tbd" ]]; then
  echo "❌ current.plan.md 의 approved_by 필드가 확정되지 않음 ($APPROVED)." >&2
  echo "   진산님 승인 또는 독립 리뷰 완료 후 이름/리뷰번호 명시." >&2
  exit 2
fi

# ── ③ scope 대조 ──────────────────────────────────────────────────────────────
# 구본은 approved_by 만 봤다. 그래서 **완료된 타 작업의 결재가 남아 있는 동안 L3 전 경로가
# 무조건 통과**했다 (실제로 2026-04 step1-5 plan 이 그대로 남아 있었다).
# 승인은 "이 plan 의 scope 안에서만" 유효해야 한다.
#
# ★ThePick 개조: 두 서식을 **모두** 읽는다.
#   (a) 인라인   — `scope: a/b.ts, c/d.ts`
#   (b) 블록 리스트 — `scope:` 다음 줄부터 `  - a/b.ts` (ThePick plan 표준 서식)
#   catchall 원본은 (a)만 읽어서, ThePick 서식에 그대로 이식하면 경로 토큰 0개 →
#   fail-closed 로 **전 L3 경로가 차단**된다. 이식이 아니라 개조가 필요한 지점.
#
# ★독립 리뷰 수리 (2026-08-06) 2건:
#   (a) 초판은 본문에 `scope:` 로 시작하는 줄이 다시 나오면 그 지점부터 또 수집해
#       **승인 범위가 무음으로 넓어졌다**(fail-open). → frontmatter 의 **첫 scope 블록만** 읽는다.
#   (b) 토큰 분해의 unquoted 워드분리가 **글롭 확장까지** 일으켜 판정이 cwd 에 의존했다
#       (`*.ts` 같은 토큰이 실제 파일 목록으로 부풀거나, 매칭 파일이 없으면 리터럴로 남음).
#       → `set -f`(noglob) 로 감싼다.
SCOPE_RAW=$(awk '
  seen_end { next }                             # 첫 블록이 끝나면 이후 줄은 전부 무시
  # 인라인 서식: `scope:` 뒤에 내용이 있는 경우
  /^scope:[[:space:]]*[^[:space:]]/ { sub(/^scope:[[:space:]]*/, ""); print; inblock = 1; next }
  # 블록 서식: `scope:` 만 있는 줄 → 다음 줄부터 항목 수집
  /^scope:[[:space:]]*$/ { inblock = 1; next }
  inblock {
    line = $0
    sub(/#.*$/, "", line)                       # 줄 끝 주석 제거
    if (line ~ /^[[:space:]]*$/) next           # 빈 줄·주석 전용 줄은 블록 유지
    if (line ~ /^[[:space:]]+-[[:space:]]*/) {  # 들여쓴 리스트 항목
      sub(/^[[:space:]]*-[[:space:]]*/, "", line)
      print line
      next
    }
    inblock = 0; seen_end = 1                    # 들여쓰기 없는 줄(다음 키·--- 등) = 블록 종료
  }
' "$PLAN_FILE")

# 괄호 주석 제거 → 구분자(· , 공백)로 분해 → 슬래시 포함 토큰만 경로로 채택.
# 한글 주석이 섞여 있어도 안전하도록 문자클래스가 아니라 구분자 기준으로 자른다.
SCOPE_CLEAN=$(printf '%s' "$SCOPE_RAW" | sed 's/([^)]*)/ /g' | tr '·,' '  ')
SCOPE_PATHS=()
set -f                                        # 글롭 확장 차단 — 판정이 cwd 에 의존하면 안 된다
for tok in $SCOPE_CLEAN; do
  tok="${tok%%[.,;:]}"                       # 문장부호 꼬리 제거
  [[ "$tok" == */* ]] && SCOPE_PATHS+=("$tok")
done
set +f

# fail-closed: scope 에 경로 토큰이 하나도 없으면 무엇도 승인할 수 없다
if [[ ${#SCOPE_PATHS[@]} -eq 0 ]]; then
  cat >&2 <<EOF
❌ L3 영역 수정 차단 — scope 에 경로 토큰 없음

  대상 파일: $RELATIVE_PATH
  scope 원문: $SCOPE_RAW

  approved_by 가 채워져 있어도 scope 가 경로를 지정하지 않으면 승인 범위가 없다 (fail-closed).
EOF
  exit 2
fi

in_scope=0
for sp in "${SCOPE_PATHS[@]}"; do
  [[ "$RELATIVE_PATH" == "$sp" ]] && { in_scope=1; break; }          # 정확 일치
  [[ "$RELATIVE_PATH" == "${sp%/}"/* ]] && { in_scope=1; break; }    # 디렉터리 스코프
  # shellcheck disable=SC2053
  [[ "$RELATIVE_PATH" == $sp ]] && { in_scope=1; break; }            # 글롭 (unquoted 의도)
done

if [[ $in_scope -eq 0 ]]; then
  cat >&2 <<EOF
❌ L3 영역 수정 차단 — 승인된 plan 의 scope 밖

  대상 파일: $RELATIVE_PATH
  매칭 패턴: $MATCHED_PATTERN
  승인자   : $APPROVED

  현재 plan 이 승인한 경로:
$(printf '    - %s\n' "${SCOPE_PATHS[@]}")

  이 파일은 위 어디에도 속하지 않습니다. 다른 작업의 결재로 이 파일을 열 수 없습니다.
  → 정말 필요하면 docs/plans/current.plan.md 의 scope 에 추가하고 **진산 재결재**를 받으세요.
EOF
  exit 2
fi

# 모든 검증 통과
exit 0
