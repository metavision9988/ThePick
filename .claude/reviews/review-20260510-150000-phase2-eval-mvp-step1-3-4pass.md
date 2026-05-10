# 4-Pass 독립 리뷰 — Phase 2 Eval MVP Step 1+2+3 (Session 064)

**리뷰 방식**: 독립 에이전트 4개 병렬 (general-purpose × 4) — Session 064 코드 작성 컨텍스트와 별개 진입.
**리뷰 일시**: 2026-05-10 KST (Session 064 종착 직전, review-gate.sh hook 의무 발현)
**리뷰 범위**: 변경 8 파일 + 연관 파일 (progress/routes.ts / schema.ts / migrations 0010 / auto-review-protocol.md / phase2-eval-mvp.plan §1~§9 / production-quality.md / AESTHETIC.md)

---

## 누적 통계

| Pass        | Agent           | ✅ PASS | 🔴 CRIT | 🟠 MAJOR | 🟡 MINOR |
| ----------- | --------------- | ------- | ------- | -------- | -------- |
| 1 SURGEON   | general-purpose | 8       | 1       | 4        | 3        |
| 2 ARCHITECT | general-purpose | 9       | 0       | 2        | 3        |
| 3 ADVOCATE  | general-purpose | 7       | 2       | 3        | 2        |
| 4 CONTRACT  | general-purpose | 7       | 0       | 3        | 4        |
| **누적**    | —               | **31**  | **3**   | **12**   | **12**   |

---

## CRITICAL 3건 (G8 게이트 차단 — 즉시 흡수 의무)

### CRIT-1 (Pass 1 SURGEON) — `apps/api/src/study/routes.ts:180`

`String(circledNumbers.indexOf(m) + 1)` 의 indexOf=-1 silent corruption.

- regex `[①-⑩]` 매칭 → `circledNumbers='①②③④⑤⑥⑦⑧⑨⑩'` indexOf 정상 0~9 보장.
- 그러나 미래 변경 (예: `[①-⑳]` regex 확장 + circledNumbers 미동기화) 시 indexOf=-1 → `String(0)` = `'0'` silent 매칭.
- **흡수**: 명시 분기 `if (idx === -1) return m;`.

### CRIT-2 (Pass 3 ADVOCATE) — `apps/api/src/study/routes.ts:363-485`

POST `/api/study/grade` rate-limit 부재 → enumeration oracle (정답 도용).

- 공격자가 questionId 고정 후 userAnswer 무차별 시도 → `correctAnswer` 1회 응답에 echo → 1초 내 정답 dump 가능.
- progress/routes.ts L219는 TD-030 `checkAndIncrementRateLimit` (분당 20회) 적용했으나 study/grade 0.
- **흡수**: progress 패턴 재사용 — `checkAndIncrementRateLimit(c.env.DB, userId, { limitPerMinute: 20 })` + `RateLimitExceeded` catch + jitter + 429.

### CRIT-3 (Pass 3 ADVOCATE) — `apps/api/src/study/routes.ts:174-182`

`normalizeAnswer` regex `/번$|호$/` false-positive.

- 정답 '1번' / 사용자 '1호' 둘 다 '1'로 정규화 → 오답이 정답 채점.
- 손해평가사 객관식은 '번' 의미, 동/호수는 '호' 의미 — 동등 처리 위험.
- **흡수**: `/번$/`만 단순화 (호$ 제거). 정답 패턴별 분기는 carry-over.

---

## MAJOR 12건 (phase 종료 전 해결 또는 명시 carry-over 의무)

### M1 (Pass 1) — routes.ts:181 `/번$|호$/` 보수

CRIT-3와 동일 영역 — '호' 제거로 함께 흡수.

### M2 (Pass 1) — routes.ts:323-328 LEFT JOIN tiebreak 불안정

다중 progress row (node_id 기반 + card_id 기반) 동일 question 매칭 시 ORDER BY tiebreak.

- carry-over: WHERE에 `up.node_id IS NULL` 명시 추가 → next 라우트가 study 영역 progress만 참조.

### M3 (Pass 1) — routes.ts:443-466 동시 INSERT race

SELECT existing → 둘 다 null → 양쪽 INSERT → 중복 행. UNIQUE 제약 부재.

- carry-over (M5와 통합): user_progress UNIQUE 제약 마이그레이션.

### M4 (Pass 1) — routes.ts:344-358 N+1 enrichment

count=5 → 5 round-trip 직렬 → CPU 50ms 위험.

- carry-over: `Promise.all` 병렬화 (M2-1 Stage 3 패턴 정합).

### M5 (Pass 2) — user_progress UNIQUE 제약 부재

0002 migration L59-74 UNIQUE 제약 0건. study/routes.ts:469 `D1_UNIQUE_CONSTRAINT_PATTERN` 검사 절대 매칭 안 됨.

- carry-over: 신규 마이그레이션 0027 `CREATE UNIQUE INDEX idx_user_progress_card ON user_progress(user_id, card_id, card_type) WHERE card_id IS NOT NULL`.

### M6 (Pass 2) — apps/web 인증 진입점 부재

QuestionCard.tsx 401 시 errorMsg surface 만, redirect 없음. `/auth/login` 페이지 자체 없음.

- carry-over: handoff-073 §6 명시 (학습자 인증 페이지 신규).

### M7 (Pass 3) — correctAnswer 1회 호출에 무조건 echo

오답 1번 시도로도 정답 즉시 surface → 학습 효과 약화 + 정답 도용 가속.

- carry-over: "오답 N회 후 정답 노출" 토글 (별도 plan).

### M8 (Pass 3) — Ctrl+N macOS Cmd+N 새 창 단축키 차단

`metaKey + n` preventDefault → 사용자 의도 단축키 차단.

- 흡수 옵션 1: `e.metaKey === false` 가드 (Ctrl 환경만)
- carry-over: 본 step 즉시 흡수 또는 plan §5 갱신.

### M9 (Pass 3) — 오프라인 surface 부재

/study NetworkOnly. 오프라인 시 errorMsg='네트워크 오류'만, graceful 안내 0.

- carry-over: 오프라인 학습 진입 차단 안내 (별도 plan).

### M10 (Pass 4) — plan §3 "표 노드 markdown 렌더" Silent Pivot

plan §3 표 5행 + §6.4 "TBL-\* markdown 렌더 / marked 의존성"이 미구현.
QuestionCard.tsx:331-341 단순 텍스트 라인만.

- **ADR 의무 또는 plan §8 carry-over 갱신** (CRITICAL RULE #1 정합).

### M11 (Pass 4) — plan §5 "Ctrl+Enter" 채택만 명시, "Ctrl+N" silent expansion

plan §5 = "A 기본 + B의 단축키 (Ctrl+Enter 채점)"만. Ctrl+N 다음 문제 plan에 명시 없음.

- carry-over: plan §5 갱신 또는 ADR.

### M12 (Pass 4) — G5 Playwright e2e carry-over 임의 결정

plan §7 G5 게이트 의무. plan §8.1~§8.6에 G5 carry-over 항목 부재.

- carry-over: plan §8 갱신 — G5 항목 명시 추가.

---

## MINOR 12건 (보고만 / 다음 phase 초기 정리)

| #   | 위치                         | 내용                                                                                      |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| m1  | routes.ts:290,374            | `void examIdParam.examId;` dead-code (Hard Rule 16 시그니처용 의도)                       |
| m2  | routes.ts:444                | `new Date().toISOString()` vs `datetime('now')` SQL default 형식 불일치                   |
| m3  | ProgressSummary.tsx:57       | `useEffect` deps `[]` exhaustive-deps 경고 가능                                           |
| m4  | routes.ts MN-1               | /next CPU 50ms 위험 (M4 통합)                                                             |
| m5  | QuestionCard.tsx ko 하드코딩 | 14건 i18n carry-over 미명시                                                               |
| m6  | PUBLIC_API_BASE_URL fallback | localhost 폭사 — Pages 빌드 시 fail-fast 권고                                             |
| m7  | QuestionCard.tsx:96,140      | HTTP 코드 학습자 노출 (graceful 메시지 미달)                                              |
| m8  | admin-bootstrap-batch2-5.sql | reviewer_id audit trail 빈약 (진산 직접 검수 시 갱신 필요 — 주석 명시됨)                  |
| m9  | plan §6.1 session 번호       | plan은 's-s063-'/'session-063'이지만 실 구현은 's-s064-'/'session-064'. plan 동기화 누락. |
| m10 | plan §3 "조사" normalize     | plan 명시했으나 미구현 (한국어 조사 "이"/"를"/"은"/"는") — false negative carry-over      |
| m11 | AESTHETIC emerald 토큰       | QuestionCard.tsx:285 emerald-100/900 (정답 배지) — AESTHETIC.md 토큰 외 색 사용           |
| m12 | testHelper email patches     | seedUser '@test' → '@test.com' lint-staged 자동 포맷 의존                                 |

---

## Devil's Advocate 시나리오 (각 Pass 1+ 의무)

1. **Pass 1**: production answer가 `'1, 2'` 복수 선택 시 normalize 미처리 → 사용자 '1과 2' 입력 false negative. 414건 중 복수 정답 비율 미측정.
2. **Pass 2**: 동일 user 두 탭 동시 Ctrl+Enter → SELECT existing=null 양쪽 → INSERT 두 번 → progressId 다름 → UNIQUE 제약 미존재로 둘 다 성공 → totalReviews=2 / totalCards=1 왜곡.
3. **Pass 3**: 공격자 단일 user로 581문항 정답 sheet 1초 dump (CRIT C1).
4. **Pass 4**: 진산님 BATCH-2 영역 풀고 relatedNodes에 TBL-012 ID 등장 → name만 surface, nodeData 표 본문 0 → "표가 깨진다"가 아닌 "표가 안 나온다" noise → plan §3 의도 검증 불가.

---

## 흡수 결정 (Session 064 즉시)

### 즉시 흡수 (본 세션)

- **CRIT-1 + M1**: routes.ts:180 `indexOf === -1` 가드 + L181 `/번$/` 단순화 (호$ 제거)
- **CRIT-2**: routes.ts /grade rate-limit (progress 패턴 재사용 — checkAndIncrementRateLimit + RateLimitExceeded + jitter + 429)
- **CRIT-3**: M1과 통합 흡수 (위)
- 회귀 테스트: study/**tests**/routes.test.ts 에 CRIT 시나리오 4건+ 추가

### Carry-over (handoff-073 §3 + plan §8 갱신 영속)

- **MAJOR M2~M12**: 12건 모두 carry-over (다음 plan 또는 phase 초기 흡수)
- **MINOR m1~m12**: 12건 보고만, 차세션 batch 정리

### Plan §8 갱신 의무 영속 (Silent Pivot 차단)

- M10 TBL-\* markdown 렌더 — §8.7 신규
- M12 G5 Playwright e2e — §8.8 신규
- M11 Ctrl+N silent expansion — plan §5 갱신
- m9 plan session 번호 mismatch — plan §6.1 정정

---

**리뷰 작성**: Claude (Opus 4.7 1M context) — 4 독립 에이전트 병렬 결과 통합
**판정**: 수정 필요 (CRIT 3 흡수 후 G8 PASS) → 흡수 후 차세션 Step 5 production deploy 진입 가능
