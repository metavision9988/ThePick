#!/bin/bash
# enforce-review.sh — Stop hook
# .review-pending 마커가 있으면 정지를 차단하고 리뷰를 강제한다. 변경 규모로 티어 분기. 범용판.
# exit 0 = 정지 허용, exit 2 = 정지 차단(메시지가 AI에게 전달).
MARKER="$CLAUDE_PROJECT_DIR/.claude/.review-pending"
LIST="$CLAUDE_PROJECT_DIR/.claude/.review-files"
[ -f "$MARKER" ] || exit 0
TIMESTAMP=$(cat "$MARKER" 2>/dev/null)

# ── 티어 판정 (임계값은 여기서 조정) ──
BIG_FILE_THRESHOLD=5
CORE_REGEX='(auth|login|signin|password|crypto|secret|token|session|payment|billing|checkout|stripe|migration|schema|/db/|database|/core/|engine|/api/|security|permission)'

FILE_COUNT=0
CORE_HIT=""
if [ -f "$LIST" ]; then
  FILE_COUNT=$(grep -cve '^$' "$LIST" 2>/dev/null)
  CORE_HIT=$(grep -iE "$CORE_REGEX" "$LIST" 2>/dev/null | head -3)
fi
TIER="small"
if [ "${FILE_COUNT:-0}" -ge "$BIG_FILE_THRESHOLD" ] || [ -n "$CORE_HIT" ]; then TIER="big"; fi

echo "🚫 리뷰 미완료 — 정지 차단" >&2
echo "" >&2
echo "코드 변경 감지: $TIMESTAMP | 변경 코드 파일 수: ${FILE_COUNT:-0}" >&2
if [ -n "$CORE_HIT" ]; then echo "민감/코어 경로 포함:" >&2; echo "$CORE_HIT" | sed 's/^/  - /' >&2; fi
echo "" >&2

if [ "$TIER" = "big" ]; then
  echo "▶ 큰 변경 → 5-페르소나 독립 병렬 심층 리뷰 (기술부채 관점)" >&2
  echo "" >&2
  echo "단순 컴파일/문법 에러만 보지 마라. 논리 오류·잠재 결함·개선점·기술부채를 다각도로 점검:" >&2
  echo "  1. 5개 전문 페르소나를 독립·병렬로 띄운다(Workflow 또는 병렬 Agent)." >&2
  echo "     서로의 결론을 모른 채 점검 → 자가검증 편향 차단." >&2
  echo "     렌즈: ①정합성/메모리·리소스 ②아키텍처/결합도/경계 ③UX·접근성·보안" >&2
  echo "          ④요구사항 대조/Silent Pivot ⑤기술부채/유지보수성(논리오류·중복·확장성)" >&2
  echo "  2. 핵심 발견은 적대적 교차검증(refute 시도)으로 진위 확정 후에만 채택." >&2
  echo "  3. Critical/Major 즉시 수정, Minor 보고. Critical 0건이어야 완료." >&2
else
  echo "▶ 작은 변경 → 다관점 인라인 리뷰(4관점)" >&2
  echo "" >&2
  echo "  1. 정합성   — null/undefined, async 누락, 경계값, 메모리/리소스 누수" >&2
  echo "  2. 연계     — 모듈 경계/import 방향, 이벤트·데이터 계약, 초기화 순서" >&2
  echo "  3. UX·보안  — 에러 상태/i18n, 접근성, 입력 검증, 비밀정보 노출" >&2
  echo "  4. 대조     — 요구사항과 일치하는가(편한 대로 만들지 않았는가)" >&2
fi
echo "" >&2
echo "리뷰 완료 후: rm -f $MARKER $LIST  →  그다음 프로젝트 표준 검증(빌드+테스트+린트) 실행." >&2
exit 2
