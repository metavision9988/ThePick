#!/usr/bin/env bash
# L3 경로 보호: plan 없이 L3 영역 수정 시 차단

L3_PATTERNS="^packages/formula-engine/|constants|ontology-registry|migrations?/"
FILE_PATH="${1:-}"

# 파일 경로가 없으면 허용
[[ -z "$FILE_PATH" ]] && exit 0

# L3 패턴에 매칭되지 않으면 허용
if ! echo "$FILE_PATH" | grep -qE "$L3_PATTERNS"; then
  exit 0
fi

# plan 파일 존재 확인
PLAN_FILE="docs/plans/current.plan.md"
if [[ -f "$PLAN_FILE" ]]; then
  exit 0
fi

echo "❌ L3 영역입니다. docs/plans/current.plan.md를 먼저 작성하세요."
echo "   대상 파일: $FILE_PATH"
echo "   → plan 작성 후 인간 승인을 받은 뒤 진행하세요."
exit 2
