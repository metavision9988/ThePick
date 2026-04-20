#!/usr/bin/env bash
# L3 영역 보호: plan 없이 L3 파일 수정 시 차단
# 관련 규칙: CLAUDE.md "L3 Fortress: 결제/인증/AI추론/개인정보"
# 관련 ADR: docs/adr/ADR-002 (결제), ADR-005 (인증)

set -euo pipefail

# L3 경로 패턴 (확장됨 — 2026-04-18 Session 7 5-페르소나 리뷰 반영)
L3_PATTERNS=(
  "^packages/formula-engine/"       # Formula Engine — 산식 계산 (L3 core)
  "^packages/payment/"              # 결제 어댑터 (ADR-002, 설계서 §2.1 L3)
  "^migrations/"                    # DB 스키마 (재해 시 복구 불가)
  "^apps/api/src/auth/"             # 인증 경로 (Phase 1 구현 예정)
  "^apps/api/src/webhooks/"         # 결제 webhook 수신 경로
  "^apps/api/src/db/schema"         # Drizzle schema (스키마 drift 방지)
  "constants"                       # 매직 넘버 레지스트리
  "ontology-registry"               # Ontology Lock
)

FILE_PATH="${1:-}"

# 파일 경로 없으면 허용 (스킵)
[[ -z "$FILE_PATH" ]] && exit 0

# 경로 정규화 — 프로젝트 루트 기준 상대경로
ROOT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
RELATIVE_PATH="${FILE_PATH#"$ROOT_DIR"/}"

# L3 패턴 매칭 확인
matched=0
for pattern in "${L3_PATTERNS[@]}"; do
  if echo "$RELATIVE_PATH" | grep -qE "$pattern"; then
    matched=1
    break
  fi
done
[[ $matched -eq 0 ]] && exit 0

# plan 파일 존재 + 내용 검증
PLAN_FILE="$ROOT_DIR/docs/plans/current.plan.md"

if [[ ! -f "$PLAN_FILE" ]]; then
  cat <<EOF
❌ L3 영역 수정 차단

  대상 파일: $RELATIVE_PATH
  매칭 패턴: $(for p in "${L3_PATTERNS[@]}"; do echo "$RELATIVE_PATH" | grep -qE "$p" && echo "$p"; done)

  docs/plans/current.plan.md 를 먼저 작성하세요.
  최소 필드:
    - phase: (0|1|2|3)
    - step: (예: 1-2)
    - approved_by: (진산 또는 Claude 독립리뷰 후)
    - scope: (이 plan 이 다루는 파일 경로)
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
  echo "❌ docs/plans/current.plan.md 필수 필드 누락: ${MISSING[*]}"
  echo "   템플릿: docs/plans/TEMPLATE.plan.md"
  exit 2
fi

# approved_by 가 "TBD" 또는 빈 값이면 거부
APPROVED=$(grep -E "^approved_by:" "$PLAN_FILE" | head -n1 | sed 's/^approved_by:[[:space:]]*//')
if [[ -z "$APPROVED" ]] || [[ "$APPROVED" == "TBD" ]] || [[ "$APPROVED" == "tbd" ]]; then
  echo "❌ current.plan.md 의 approved_by 필드가 확정되지 않음 ($APPROVED)."
  echo "   진산님 승인 또는 독립 리뷰 완료 후 이름/리뷰번호 명시."
  exit 2
fi

# 모든 검증 통과
exit 0
