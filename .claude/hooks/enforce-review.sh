#!/bin/bash
# enforce-review.sh — Stop hook
# .review-pending 마커가 있으면 정지를 차단하고 리뷰를 강제한다. 변경 규모로 티어 분기. 범용판.
# exit 0 = 정지 허용, exit 2 = 정지 차단(메시지가 AI에게 전달).
MARKER="$CLAUDE_PROJECT_DIR/.claude/.review-pending"
LIST="$CLAUDE_PROJECT_DIR/.claude/.review-files"
BLOCKED="$CLAUDE_PROJECT_DIR/.claude/.review-blocked"
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

# ── 리뷰 완료·인간 결재 대기 (.review-blocked) — 2026-08-06 신설 (역이식 STAGE 0-2) ──
# 구판에는 이 상태가 없어서, 리뷰를 끝냈어도 CRITICAL 이 L3/Hard Limit 상 **인간 결재에 묶이면**
# "Critical 0건이어야 완료" ↔ "완료해야 마커를 지운다" 가 서로를 막는 정지 루프가 됐다.
# protect-l3 를 되살리면 이 루프가 즉시 현실화되므로 **같은 작업 단위에서 함께** 넣는다.
#   형식: 1행 = 선언 시점의 변경 파일 수 / 2행 이후 = 사유(무엇이 왜 인간 대기인지 + 정본 경로).
#   파일이 그 뒤로 더 늘면 무효 — 새 변경은 다시 리뷰를 받아야 한다.
#   출처 = catchall `.claude/hooks/enforce-review.sh` (리뷰훅 정지루프 진단 20260727 §2)
#   ★독립 리뷰 수리 (2026-08-06): 유효성 판정이 **파일 '수'** 뿐이라, 같은 파일을 계속 고치면
#   수가 안 늘어 재리뷰가 영영 요구되지 않았다(훅 메시지의 "새 코드 변경이 생기면 다시 리뷰"라는
#   약속과 실제 동작이 달랐다). → 목록의 **내용 해시**를 함께 고정한다.
#   형식(신): 1행=파일 수, 2행=목록 해시, 3행 이후=사유. 구 형식(1행=수, 2행~=사유)도 계속 지원.
if [ -f "$BLOCKED" ]; then
  BLOCKED_AT=$(head -n1 "$BLOCKED" 2>/dev/null)
  case "$BLOCKED_AT" in (*[!0-9]*|'') BLOCKED_AT=-1 ;; esac
  BLOCKED_HASH=$(sed -n '2p' "$BLOCKED" 2>/dev/null)
  CUR_HASH=""
  [ -f "$LIST" ] && CUR_HASH=$(sort "$LIST" 2>/dev/null | sha256sum 2>/dev/null | cut -c1-16)
  # 2행이 해시 형식(16 hex)일 때만 해시 대조 — 구 형식이면 종전대로 개수만 본다
  case "$BLOCKED_HASH" in
    [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f])
      if [ "$BLOCKED_HASH" != "$CUR_HASH" ]; then
        echo "⚠ .review-blocked 무효 — 변경 파일 목록이 달라졌다 (선언 $BLOCKED_HASH ≠ 현재 $CUR_HASH)" >&2
        echo "" >&2
        BLOCKED_AT=-1
      fi
      ;;
  esac
  if [ "${FILE_COUNT:-0}" -le "$BLOCKED_AT" ]; then
    echo "⏸ 리뷰 완료 · 인간 결재 대기 — 정지 허용" >&2
    echo "" >&2
    if [ -n "$BLOCKED_HASH" ] && [ "$BLOCKED_HASH" = "$CUR_HASH" ]; then
      tail -n +3 "$BLOCKED" >&2   # 신형식: 1행 수 · 2행 해시 · 3행~ 사유
    else
      tail -n +2 "$BLOCKED" >&2   # 구형식 하위호환
    fi
    echo "" >&2
    echo "결재 후: rm -f $BLOCKED  (마커는 유지 — 새 코드 변경이 생기면 다시 리뷰를 요구한다)" >&2
    exit 0
  fi
  echo "⚠ .review-blocked 무효 — 선언 시점 ${BLOCKED_AT}건 → 현재 ${FILE_COUNT:-0}건 (새 변경 발생)" >&2
  echo "" >&2
fi

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
echo "" >&2
echo "★ CRITICAL 이 남았으나 그 해소가 **인간 결재/L3 승인에 묶여** AI가 진행할 수 없다면," >&2
echo "  마커를 지우지 말고 아래로 선언하라 (정지 허용 + 사유 영속):" >&2
echo "    printf '%s\\n' \"${FILE_COUNT:-0}\" \"\$(sort $LIST | sha256sum | cut -c1-16)\" '사유: <무엇이 왜 인간 대기인지 · 정본 문서 경로>' > $BLOCKED" >&2
exit 2
