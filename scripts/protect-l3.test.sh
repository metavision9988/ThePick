#!/usr/bin/env bash
# 안전장치 훅 회귀 테스트 — 「가드가 조용히 죽어 있던」 사고(2026-08-06 실측) 재발 방지
#
# 배경: protect-l3.sh 와 quality-gate.sh 는 경로를 argv 로만 읽는데 settings.json 이
# 비표준 변수를 넘겨 **빈 값**이 들어왔고, 두 훅 다 즉시 exit 0 했다. 라이브 프로브로 확정 —
# L3 패턴 경로에 실제 Write 를 했더니 통과, 같은 경로를 argv 로 주면 exit 2.
# 게다가 protect-l3 는 approved_by 만 보고 scope 를 대조하지 않아, **2026-04 에 끝난 plan** 의
# 결재가 남아 있는 동안 L3 전 경로가 통과할 구조였다.
#
# 이 테스트는 그 부정 케이스들을 상주시킨다 — 수리가 조용히 되돌아가면 red.
# ★규율: 가드는 만든 즉시 고의로 깨서 red 를 확인한다(catchall 실수 로그 2026-08-02).
#
# 실행: bash scripts/protect-l3.test.sh

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
L3_HOOK="$ROOT/.claude/hooks/protect-l3.sh"
QG_HOOK="$ROOT/.claude/hooks/quality-gate.sh"
ER_HOOK="$ROOT/.claude/hooks/enforce-review.sh"
FAIL=0
PASS=0

for h in "$L3_HOOK" "$QG_HOOK" "$ER_HOOK"; do
  [[ -f "$h" ]] || { echo "❌ 훅 부재: $h"; exit 1; }
  bash -n "$h" || { echo "❌ 훅 문법 오류: $h"; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# mkplan_inline <dir> <approved_by> <scope 인라인>
mkplan_inline() {
  mkdir -p "$1/docs/plans"
  { echo "phase: 3"; echo "step: test"; echo "approved_by: $2"; echo "scope: $3"; echo "risk_level: L3"; } \
    > "$1/docs/plans/current.plan.md"
}

# mkplan_block <dir> <approved_by> <경로...> — ★ThePick 표준 서식(YAML 블록 리스트)
mkplan_block() {
  local dir="$1" approved="$2"; shift 2
  mkdir -p "$dir/docs/plans"
  {
    echo "---"
    echo "phase: 3"
    echo "step: test"
    echo "approved_by: $approved"
    echo "risk_level: L3"
    echo "scope:"
    echo "  # 주석 줄 — 경로처럼 보이는 문자(훅/설정)가 있어도 무시되어야 한다"
    for p in "$@"; do echo "  - $p"; done
    echo "---"
    echo ""
    echo "## 본문"
  } > "$dir/docs/plans/current.plan.md"
}

ok()   { echo "  ok   $*"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL $*"; FAIL=1; }

# l3 <기대exit> <root> <파일경로> <설명>   — stdin JSON 계약(= 실제 Claude Code 계약)
l3() {
  local want="$1" root="$2" path="$3" desc="$4" got
  printf '{"tool_input":{"file_path":"%s"}}' "$path" \
    | CLAUDE_PROJECT_DIR="$root" bash "$L3_HOOK" >/dev/null 2>&1
  got=$?
  [[ "$got" == "$want" ]] && ok "exit=$got  $desc" || bad "exit=$got (기대 $want)  $desc"
}

# l3argv <기대exit> <root> <파일경로> <설명>  — 구 argv 계약 하위호환
l3argv() {
  local want="$1" root="$2" path="$3" desc="$4" got
  CLAUDE_PROJECT_DIR="$root" bash "$L3_HOOK" "$path" </dev/null >/dev/null 2>&1
  got=$?
  [[ "$got" == "$want" ]] && ok "exit=$got  $desc" || bad "exit=$got (기대 $want)  $desc"
}

echo "# 안전장치 훅 회귀 테스트"

# ── 1. approved_by 미확정 = L3 전건 차단 ────────────────────────────────────
A="$TMP/tbd"; mkplan_inline "$A" "TBD" "apps/api/src/search/x.ts"
echo "## 1. approved_by=TBD → L3 차단"
l3 2 "$A" "$A/migrations/0099.sql"                    "migrations 차단"
l3 2 "$A" "$A/packages/formula-engine/src/f.ts"       "formula-engine 차단"
l3 0 "$A" "$A/apps/web/src/pages/index.astro"         "비-L3 통과"

# ── 2. ★ThePick 표준 서식(YAML 블록 리스트) 파싱 ────────────────────────────
# catchall 원본 파서는 인라인만 읽어서, 그대로 이식하면 경로 토큰 0개 → 전 L3 차단(자기 발등).
B="$TMP/block"; mkplan_block "$B" "진산 (2026-08-06)" \
  "migrations/0039_knowledge_edges_guard_and_node_reactivation.sql" \
  "apps/api/src/db/schema.ts" \
  "docs/plans/current.plan.md"
echo "## 2. scope=YAML 블록 리스트 (ThePick 표준 서식)"
l3 0 "$B" "$B/migrations/0039_knowledge_edges_guard_and_node_reactivation.sql" "scope 안 → 통과"
l3 0 "$B" "$B/apps/api/src/db/schema.ts"              "scope 안(schema) → 통과"
l3 2 "$B" "$B/migrations/0099_rogue.sql"              "scope 밖 마이그 → 차단"
l3 2 "$B" "$B/packages/formula-engine/src/f.ts"       "scope 밖 엔진 → 차단"

# ── 3. 인라인 서식도 계속 지원 ──────────────────────────────────────────────
C="$TMP/inline"; mkplan_inline "$C" "진산" "migrations/0039_a.sql, apps/api/src/db/schema.ts"
echo "## 3. scope=인라인 서식"
l3 0 "$C" "$C/migrations/0039_a.sql"                  "scope 안 → 통과"
l3 2 "$C" "$C/migrations/0040_b.sql"                  "scope 밖 → 차단"

# ── 4. 디렉터리 스코프 ──────────────────────────────────────────────────────
D="$TMP/dir"; mkplan_block "$D" "진산" "migrations/"
echo "## 4. 디렉터리 스코프"
l3 0 "$D" "$D/migrations/0050_x.sql"                  "디렉터리 하위 → 통과"
l3 2 "$D" "$D/packages/formula-engine/src/f.ts"       "다른 L3 → 차단"

# ── 5. 경로 우회 시도 (realpath 정규화) ─────────────────────────────────────
echo "## 5. 경로 우회"
l3 2 "$B" "./migrations/../migrations/0099_rogue.sql"  "상대·.. 우회 → 차단"
l3 2 "$B" "migrations/0099_rogue.sql"                  "루트상대 → 차단"
l3 0 "$B" "/tmp/outside-repo/migrations/0099.sql"      "레포 밖 → 스킵(통과)"

# ── 6. fail-closed: scope 에 경로 토큰이 없음 ───────────────────────────────
E="$TMP/noscope"; mkplan_inline "$E" "진산" "설명만 있고 경로 없음"
echo "## 6. scope 경로 토큰 0개 → fail-closed"
l3 2 "$E" "$E/migrations/0039_a.sql"                  "승인돼 있어도 차단"

# ── 7. plan 파일 자체 부재 ──────────────────────────────────────────────────
F="$TMP/noplan"; mkdir -p "$F"
echo "## 7. current.plan.md 부재"
l3 2 "$F" "$F/migrations/0039_a.sql"                  "차단"

# ── 8. 구 argv 계약 하위호환 ────────────────────────────────────────────────
echo "## 8. argv 계약 하위호환"
l3argv 0 "$B" "$B/apps/api/src/db/schema.ts"          "scope 안 → 통과"
l3argv 2 "$B" "$B/migrations/0099_rogue.sql"          "scope 밖 → 차단"

# ── 9. quality-gate: stdin JSON 에서 경로·본문을 뽑는가 ─────────────────────
echo "## 9. quality-gate stdin JSON 계약"
qg() {
  local desc="$1" json="$2" expect_hit="$3" out
  out=$(printf '%s' "$json" | bash "$QG_HOOK" 2>&1)
  if [[ "$expect_hit" == "yes" ]]; then
    [[ "$out" == *"QUALITY GATE"* ]] && ok "경고 발화  $desc" || bad "경고 없음  $desc"
  else
    [[ "$out" == *"QUALITY GATE"* ]] && bad "경고 오발화  $desc" || ok "무발화     $desc"
  fi
}
qg "Write(content) any 타입"      '{"tool_input":{"file_path":"a/b.ts","content":"const x: any = 1;"}}'            yes
qg "Edit(new_string) console.log" '{"tool_input":{"file_path":"a/b.ts","new_string":"console.log(1)"}}'             yes
qg "MultiEdit(edits[]) 빈 catch"  '{"tool_input":{"file_path":"a/b.ts","edits":[{"new_string":"try{}catch(e){}"}]}}' yes
qg "정상 코드"                    '{"tool_input":{"file_path":"a/b.ts","content":"const x: number = 1;"}}'          no
qg ".md 스킵"                     '{"tool_input":{"file_path":"a/b.md","content":"const x: any = 1;"}}'             no
qg "테스트 파일 스킵"             '{"tool_input":{"file_path":"a/b.test.ts","content":"const x: any = 1;"}}'        no

# ── 10. enforce-review 3상태 ────────────────────────────────────────────────
echo "## 10. enforce-review .review-blocked 3상태"
er() {
  local want="$1" root="$2" desc="$3" got
  CLAUDE_PROJECT_DIR="$root" bash "$ER_HOOK" >/dev/null 2>&1
  got=$?
  [[ "$got" == "$want" ]] && ok "exit=$got  $desc" || bad "exit=$got (기대 $want)  $desc"
}
G="$TMP/review"; mkdir -p "$G/.claude"
er 0 "$G" "마커 없음 → 정지 허용"
printf '2026-08-06 00:00:00\n' > "$G/.claude/.review-pending"
printf 'apps/api/src/a.ts\napps/api/src/b.ts\n' > "$G/.claude/.review-files"
er 2 "$G" "마커 있음·미리뷰 → 정지 차단"
printf '%s\n' "2" "사유: L3 production 적용이 인간 결재 대기" > "$G/.claude/.review-blocked"
er 0 "$G" "blocked 선언(2건) → 정지 허용"
printf 'apps/api/src/c.ts\n' >> "$G/.claude/.review-files"
er 2 "$G" "파일 3건으로 증가 → blocked 무효화·재차단"

# ── 11. ★독립 리뷰 수리 회귀 (2026-08-06) ───────────────────────────────────
# 아래는 전부 초판이 **무음 통과**시키던 경로다. 고친 즉시 음성 실측으로 상주시킨다.
echo "## 11. 독립 리뷰 수리 회귀"

# (a) jq 부재 = 판정 불가 → fail-closed
JQLESS=$(printf '{"tool_input":{"file_path":"%s"}}' "$B/migrations/0099_rogue.sql" \
  | env PATH=/usr/bin:/bin CLAUDE_PROJECT_DIR="$B" bash "$L3_HOOK" >/dev/null 2>&1; echo $?)
[[ "$JQLESS" == "2" ]] && ok "exit=2  jq 부재 → fail-closed 차단" || bad "exit=$JQLESS (기대 2)  jq 부재 → fail-closed"

# (b) 손상 JSON = 판정 불가 → fail-closed
BADJSON=$(printf 'not-json' | CLAUDE_PROJECT_DIR="$B" bash "$L3_HOOK" >/dev/null 2>&1; echo $?)
[[ "$BADJSON" == "2" ]] && ok "exit=2  손상 JSON → fail-closed 차단" || bad "exit=$BADJSON (기대 2)  손상 JSON"

# (c) 경로 필드 없는 정당 케이스(NotebookEdit 등)는 통과해야 한다 — 과잉 차단 금지
NOPATH=$(printf '{"tool_input":{"command":"ls"}}' | CLAUDE_PROJECT_DIR="$B" bash "$L3_HOOK" >/dev/null 2>&1; echo $?)
[[ "$NOPATH" == "0" ]] && ok "exit=0  경로 필드 부재(정당) → 통과" || bad "exit=$NOPATH (기대 0)  경로 필드 부재"

# (d) ROOT_DIR 끝 슬래시 — 정규화 안 되면 레포 내부를 '레포 밖'으로 오판해 통과했다
TSLASH=$(printf '{"tool_input":{"file_path":"%s"}}' "$B/migrations/0099_rogue.sql" \
  | CLAUDE_PROJECT_DIR="$B/" bash "$L3_HOOK" >/dev/null 2>&1; echo $?)
[[ "$TSLASH" == "2" ]] && ok "exit=2  ROOT_DIR 끝 슬래시 → 여전히 차단" || bad "exit=$TSLASH (기대 2)  ROOT_DIR 끝 슬래시"

# (e) 심링크 루트
ln -sfn "$B" "$TMP/rootlink"
SYMROOT=$(printf '{"tool_input":{"file_path":"%s"}}' "$TMP/rootlink/migrations/0099_rogue.sql" \
  | CLAUDE_PROJECT_DIR="$TMP/rootlink" bash "$L3_HOOK" >/dev/null 2>&1; echo $?)
[[ "$SYMROOT" == "2" ]] && ok "exit=2  심링크 루트 → 여전히 차단" || bad "exit=$SYMROOT (기대 2)  심링크 루트"

# (f) scope 본문 재등장 fail-open — frontmatter 첫 블록만 읽어야 한다
H="$TMP/scopedup"; mkplan_block "$H" "진산" "docs/only.md"
printf '\n## 본문\n\nscope:\n  - migrations/\n' >> "$H/docs/plans/current.plan.md"
l3 2 "$H" "$H/migrations/0099_rogue.sql"              "본문 scope: 재등장 → 승인 확대 안 됨"

# (g) 글롭 확장 의존 — scope 토큰이 cwd 의 파일 목록으로 부풀면 안 된다
I="$TMP/glob"; mkplan_block "$I" "진산" "migrations/0039_*.sql"
GLOBCWD=$( cd "$TMP" && printf '{"tool_input":{"file_path":"%s"}}' "$I/migrations/0099_rogue.sql" \
  | CLAUDE_PROJECT_DIR="$I" bash "$L3_HOOK" >/dev/null 2>&1; echo $?)
[[ "$GLOBCWD" == "2" ]] && ok "exit=2  글롭 토큰 → cwd 무관하게 차단" || bad "exit=$GLOBCWD (기대 2)  글롭 토큰"

# (h) enforce-review: 같은 파일 재수정도 재리뷰를 요구해야 한다 (개수 아닌 내용 해시)
J="$TMP/review2"; mkdir -p "$J/.claude"
printf '2026-08-06 00:00:00\n' > "$J/.claude/.review-pending"
printf 'apps/api/src/a.ts\napps/api/src/b.ts\n' > "$J/.claude/.review-files"
printf '%s\n' "2" "$(sort "$J/.claude/.review-files" | sha256sum | cut -c1-16)" '사유: 결재 대기' > "$J/.claude/.review-blocked"
er 0 "$J" "해시 일치 → 정지 허용"
printf 'apps/api/src/c.ts\n' > "$J/.claude/.review-files"   # 개수 동일(2→1? 아니므로 조정)
printf 'apps/api/src/c.ts\napps/api/src/d.ts\n' > "$J/.claude/.review-files"
er 2 "$J" "★개수 같지만 파일이 바뀜 → blocked 무효·재차단"

# (i) quality-gate: 스킵 대상은 stdin 을 소비하지 않는다 (무한 대기 방지)
QGHANG=$(timeout 3 bash -c "bash '$QG_HOOK' 'a/b.md' < /dev/null" >/dev/null 2>&1; echo $?)
[[ "$QGHANG" == "0" ]] && ok "exit=0  quality-gate .md argv → 즉시 종료" || bad "exit=$QGHANG  quality-gate 스킵 경로"

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "✅ ALL PASS ($PASS 케이스)"
else
  echo "❌ FAIL 있음 ($PASS 통과)"
fi
exit $FAIL
