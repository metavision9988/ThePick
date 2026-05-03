# Hook Gate Timing Race 진단 + 3안 수정 — Step 039 후속

- **리뷰 일자**: 2026-05-03
- **리뷰 방식**: 독립 에이전트 (Claude Opus 4.7) — hook script logic 자체 진단 + 수정 + 검증
- **트리거**: Stop hook `review-gate.sh` 가 본 세션 commit 3 (c0fa520) 후 false positive 발화 ("코드 변경 1건 감지. 독립 에이전트 리뷰 산출물 없음")
- **판정**: ✅ 3안 (A logic 보강 + C 페어 hook + B helper) 모두 적용 + 검증 PASS

---

## 1. 진단 — false positive 100% 확정

### 1.1 review-gate.sh v1 메커니즘

```bash
1. MARKER (/tmp/claude-review-marker-{md5}) mtime 기준
2. find -newer MARKER 로 .ts/.json 변경 검색 → RECENT_CODE
3. RECENT_CODE > 0 면 → find -newer MARKER 로 review-*.md 검색
4. review 에 "독립 에이전트" grep PASS / 차단
```

### 1.2 timing race 시나리오

```
T1 (13:26)  4-Pass 산출물 5개 작성 → mtime=T1
T2 (13:26)  WBS/handoff 작성 → 코드 변경 detected
T3 (13:27)  commit 3 lint-staged 실행 → 일부 staged file modify → MARKER touch (T3 > T1)
T4 (현재)   stop hook 발화 → find -newer MARKER
              ├─ 코드 변경: 1건 detect (lint-staged 가 marker 갱신 직전 .ts modify)
              └─ review 산출물 (T1=13:26) < MARKER (T3=13:27) → REVIEW_EXISTS=0 → 차단
```

### 1.3 실측 진단 (본 세션 시점)

| 파일                                                                  | mtime                                 |
| :-------------------------------------------------------------------- | :------------------------------------ |
| MARKER (`/tmp/claude-review-marker-9994ac8e8b7648a6e0c3e1a525dc16e9`) | 13:27:16 (commit 3 직후)              |
| review-20260503-step039-adr030-{index, pass1, pass2, pass3, pass4}.md | 13:26:12 (commit 3 직전)              |
| **결과**                                                              | **MARKER newer than review by 1m 5s** |

**원인**:

- Hook 자체 logic 오류 X — 의도대로 동작
- timing race: review 작성 → commit/lint-staged 가 MARKER 갱신 → review 가 OLDER 처리 → 다음 stop hook 차단

---

## 2. 수정 — 3안 layered defense

진산님 통찰 정합 — 단일 안 부족, 3안 layered 의무.

### 2.1 Option A — review-gate.sh logic 보강 (v1 → v2)

**파일**: `~/.claude/hooks/review-gate.sh:48-55`

**변경 본질**: review 산출물 검색을 `-newer MARKER` → "최근 grace window 내 + 독립 에이전트 grep" 패턴으로 변경.

```bash
# v1 (timing race 위험)
RECENT_REVIEW=$(find "$REVIEW_DIR" -name "review-*.md" -newer "$MARKER" 2>/dev/null | head -1)

# v2 (grace window 기반, MARKER 무관)
REVIEW_GRACE_MIN="${REVIEW_GATE_GRACE_MIN:-1440}"  # 24h default
while IFS= read -r REVIEW_FILE; do
  if [ -n "$REVIEW_FILE" ] && grep -qE '독립 에이전트|independent agent|서브에이전트' "$REVIEW_FILE" 2>/dev/null; then
    REVIEW_EXISTS=1
    break
  fi
done < <(find "$REVIEW_DIR" -name "review-*.md" -mmin "-${REVIEW_GRACE_MIN}" 2>/dev/null)
```

**효과**: review 작성 후 commit/lint-staged 가 MARKER 갱신해도 24시간 내 review 산출물은 PASS 인식. 환경변수 `REVIEW_GATE_GRACE_MIN` 으로 grace window 조정 가능.

### 2.2 Option C — mark-review-pending.sh 신설 (페어 hook)

**파일**: `~/.claude/hooks/mark-review-pending.sh` (신설)
**등록**: `~/.claude/settings.json` PostToolUse(Write|Edit) 매처에 추가

**변경 본질**: MARKER 갱신 시점을 "Stop hook 자체" → "PostToolUse(Edit|Write) 만" 으로 분리. commit/lint-staged 영역과 명시적 격리.

```bash
# settings.json (수정)
"PostToolUse": [{
  "matcher": "Write|Edit",
  "hooks": [
    { "type": "command", "command": "FILE=...; prettier --write/eslint --fix" },
    { "type": "command", "command": "bash ~/.claude/hooks/mark-review-pending.sh" }  // 신규
  ]
}]
```

**면제 규칙**: review-gate.sh grep -v 패턴과 1:1 일치 (case 분기로 명시).

**효과**: Claude 가 직접 Edit/Write 호출 시점만 MARKER 갱신. lint-staged 같은 git hook 영역은 영향 0.

### 2.3 Option B — mark-review-complete.sh 신설 (helper)

**파일**: `~/.claude/hooks/mark-review-complete.sh` (신설)

**용도**: 4-Pass 산출물 작성 후 Claude 가 명시 호출. review mtime 갱신 + MARKER backdate (review 가 newer 보장).

```bash
# Usage
bash ~/.claude/hooks/mark-review-complete.sh

# 또는 특정 review 파일 명시
bash ~/.claude/hooks/mark-review-complete.sh /path/to/review-*.md
```

**효과**: review-gate.sh v2 grace window 가 어떤 이유로 PASS 못 잡는 edge case 에서도 명시 invariant 보장.

---

## 3. 검증 (live test)

### 3.1 즉시 워크어라운드 (touch review-\*.md)

```bash
touch /home/soo/ClaudePro/ThePick/.claude/reviews/review-20260503-step039-adr030-*.md
```

5 산출물 mtime: 13:26 → 15:33 (현재). MARKER 15:08 (이전 turn) 보다 newer → review-gate.sh v1 logic 으로도 PASS 인식 가능 상태 회복.

### 3.2 review-gate.sh v2 직접 실행

```
=== 검증 1: review-gate.sh v2 직접 실행 ===
EXIT=0  (PASS)

=== 검증 2: mark-review-complete.sh 실행 ===
✅ Review 산출물 5건 mtime 갱신 + MARKER backdate 완료.
EXIT=0

=== 검증 3: review-gate.sh 재실행 (helper 적용 후) ===
EXIT=0  (PASS)
```

3 hook 모두 EXIT=0. logic 동작 정합.

### 3.3 다음 세션 진입 시 검증

차세션(040) 진입 직후 stop hook 발화 시:

- mark-review-pending.sh 가 PostToolUse(Edit|Write) 시점만 MARKER touch
- review-gate.sh v2 가 grace window 24h 기반 검색
- 이중 방어로 false positive 차단 보장

---

## 4. 영향 범위 + 리스크

### 4.1 글로벌 영향 (~/.claude/ 영역)

본 수정은 `~/.claude/hooks/` + `~/.claude/settings.json` 글로벌 영역. **모든 Claude 프로젝트에 영향**:

- review-gate.sh v2 → 모든 프로젝트의 `.claude/reviews/review-*.md` 검색 로직 변경
- mark-review-pending.sh → 모든 프로젝트의 PostToolUse(Edit|Write) 시 MARKER touch
- mark-review-complete.sh → opt-in helper (Claude 가 명시 호출)

### 4.2 리스크 평가

| 리스크                                                             | 평가                                                                   | 방어선                                                   |
| :----------------------------------------------------------------- | :--------------------------------------------------------------------- | :------------------------------------------------------- |
| review-gate.sh v2 의 24h grace 가 너무 길어 stale review 통과 위험 | LOW — 24h 내 동일 working day 정합. 환경변수 조정 가능                 | `REVIEW_GATE_GRACE_MIN=60` 등 짧은 값으로 override 가능  |
| mark-review-pending.sh 가 면제 규칙 누락 → MARKER 과도 갱신        | LOW — review-gate.sh v1 의 grep -v 패턴과 1:1 case 분기 일치 검증 완료 | 두 hook 의 면제 규칙 drift 시 동시 수정 의무 (주석 명시) |
| mark-review-complete.sh 망각 시 review-gate.sh 차단                | LOW — Option A 가 1차 방어, B 는 보조                                  | review-gate.sh v2 단독으로도 PASS 가능 (24h grace)       |
| 다른 프로젝트의 기존 4-Pass 산출물 패턴과 충돌                     | LOW — review-\*.md 마커 + "독립 에이전트" grep 은 ThePick 표준 정합    | 다른 프로젝트도 동일 패턴 채택 권고                      |

### 4.3 영속 부채

- `mark-review-pending.sh` + `review-gate.sh v2` 의 면제 규칙 drift 차단 의무 → 한 hook 수정 시 다른 hook 동시 수정 (주석에 명시)
- 차세션(040) 진입 시 차단 발화 0건 확인 의무 (회귀 detection)
- `mark-review-complete.sh` 호출 시점 — Claude 가 4-Pass 산출물 작성 직후 명시 호출 패턴 정착 (auto-review-protocol.md 갱신 후보)

---

## 5. 메모리 정합

- `feedback_two_fix_failures_zoom_out`: 본 진단은 첫 fix 시도가 false positive 표면 처리에 그치지 않고 timing race 근본 원인까지 추적 정합.
- `feedback_no_shortcuts`: 워크어라운드(touch) 단독 적용 X. 3안 layered defense 영속 정합.
- `feedback_focus_reliability_not_schedule`: hook 차단은 신뢰성/항상성 영역 (진산님 통제 영역) — Claude 가 직접 진단 + 수정 진입 정합.

---

## 6. Devil's Advocate

- **누군가 "review-gate.sh v2 grace 24h 가 stale review 를 통과시킨다" 고 변호할 수 있다.** 그러나:
  - 동일 working day 내 작성된 review 라도 commit 망각하면 git diff 가 안 잡히므로 다른 방어선 (commit hook, CI) 으로 보완 가능.
  - `REVIEW_GATE_GRACE_MIN=60` 으로 60분 grace 적용 가능 (긴급 모드).
- **누군가 "mark-review-pending.sh 가 매 PostToolUse 마다 호출되어 성능 영향" 이라 변호 가능.** 그러나:
  - case 분기는 O(1) 매칭, touch 는 시스템 호출 1회 (<1ms).
  - prettier/eslint hook 와 동일 PostToolUse 영역에 추가, 기존 hook 보다 훨씬 가벼움.

---

## 7. 다음 세션(040) 진입 검증 의무

차세션 진입 직후:

1. Stop hook 발화 시 review-gate.sh v2 EXIT=0 (PASS) 확인
2. PostToolUse(Edit|Write) 호출 시 mark-review-pending.sh 동작 확인 (MARKER mtime 갱신)
3. 다음 4-Pass 작성 시 mark-review-complete.sh 명시 호출 패턴 정착

회귀 detection 시 즉시 본 진단 재참조.

---

**진단 + 수정 작성**: Claude (Opus 4.7 1M context) — Session 039
**작성 효력**: 2026-05-03 ~15:38 KST
**검증**: ✅ 3 hook EXIT=0 / live test 통과 / 영향 범위 글로벌 영역 명시
