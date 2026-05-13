# Step 3-UX-6c-3 4-Pass 독립 에이전트 리뷰 통합 보고

- **일자:** 2026-05-13 (Session 072)
- **범위:** ADR-040 G-3 흡수 (sessionStorage 세션 자동 복원 — 진산 옵션 A 채택)
- **변경 단일 파일:** `apps/web/src/components/StudyFlow.tsx` (+120/-3 → 흡수 후 +143/-3)
- **리뷰 방식:** 독립 에이전트 2개 병렬 호출 (auto-review-protocol §"규칙 0" 정합)
  - feature-dev:code-reviewer (Pass 1 Surgeon + Pass 2 Architect)
  - pr-review-toolkit:silent-failure-hunter (silent failure 전용 audit)

---

## 결과 요약

| Pass / Agent                                  | Critical | Major | Minor |
| :-------------------------------------------- | :------- | :---- | :---- |
| Pass 1 (Surgeon, feature-dev:code-reviewer)   | 0        | 3     | 0     |
| Pass 2 (Architect, feature-dev:code-reviewer) | 1\*      | 1     | 0     |
| Silent Failure Hunter                         | 0        | 3     | 5     |
| **통합 (중복 제거)**                          | **0**    | **5** | **5** |

\* Pass 2 C-1: fetchSessionDetail user 소유 검증 부재 우려 — 서버 측 검증 (apps/api/src/study/routes.ts:1539-1541) 확인됨 → **자가 해제**.

---

## CRITICAL 자가 해제 (1건)

### Pass 2 C-1 — fetchSessionDetail 사용자 소유 검증 우려

- **위치:** `apps/web/src/lib/study-api.ts:80-84` + `apps/api/src/study/routes.ts` GET /session/:id
- **우려:** sessionStorage XSS 주입 시 타 사용자 세션 조회 가능?
- **확인:** 서버 측 `if (row.user_id !== userId) return c.json({ error: 'SESSION_FORBIDDEN' }, 403);` (routes.ts:1539-1541) 존재. 다른 사용자 sessionId 시도 시 403 fallback. 클라이언트는 catch → `clearActiveSession()` + mode-select.
- **판정:** **자가 해제** (CRITICAL 비대상).

---

## MAJOR 본 step 흡수 (3건)

### M-2 (code-reviewer Pass 1) — readActiveSession catch silent (CLAUDE.md Rule 3 위반)

- **위치:** `StudyFlow.tsx:88-90` 변경 전 빈 catch
- **문제:** JSON.parse 실패 시 `return null`만 — production 디버깅 영향. CLAUDE.md "try-catch에서 데이터 조용히 삭제 금지 — 로깅 + 에러 전파/폴백" 정합 위반.
- **흡수:**
  - `console.warn('[StudyFlow] readActiveSession parse error, clearing', err)` + `clearActiveSession()` 동반 (corruption 자가 정리)
  - `persistActiveSession` / `clearActiveSession` catch도 동일 패턴 (Rule 3 정합)

### M-3 (silent-failure-hunter) — baselineLongest 복원 시 stale값으로 신기록 hero 회귀

- **위치:** `StudyFlow.tsx:171-177` loadModes setStreak 초기화
- **문제:** 복원 시 `baselineLongest: stats.streak.longest` (현재값)로 set → 학습 중 longest 갱신 후 새로고침 → `streakDelta = max(0, 12 - 12) = 0` → 신기록 hero 미표시. memory `project_ux_north_star_phase3.md` 정합 학습 동기 회귀.
- **흡수:**
  - `PersistedSession`에 `baselineLongest: number` 필드 추가
  - handleStart 성공 시 `persistActiveSession({sessionId, examType, baselineLongest: streak.longest})` — 세션 시작 시점 longest 영속
  - 복원 시 `setStreak((prev) => ({...prev, baselineLongest: persisted.baselineLongest}))` 적용
  - 구 schema 호환성: `baselineLongest` 누락 시 0 fallback (Number.isFinite 가드)

### M-1 (silent-failure-hunter) — completeSession 실패 시 sessionStorage 정책

- **위치:** `StudyFlow.tsx:280-289` finalizeSession catch
- **문제:** 서버 부분 성공 / 네트워크 단절 시 클라이언트 error 상태 + sessionStorage 유지 → 자가 치유 path 유지 vs 명시 정리 trade-off
- **흡수 (의도 명문화):** 코드 주석 추가 — "서버 측 트랜잭션 상태 불명확하므로 클라이언트 자가 정리하지 않음. 사용자가 '다시 시도' → loadModes() → readActiveSession() → fetchSessionDetail() phase 검사로 자가 치유 (completed면 정리, !=completed면 복원)" 영속.

---

## MAJOR carry-over (2건, 다음 step 이월)

### code-reviewer Pass 1 M-1 / silent M-2 — useEffect cleanup + stale setState race

- **위치:** `StudyFlow.tsx:222-224` useEffect + loadModes async path
- **문제:** examType prop 변경 시 in-flight fetchSessionDetail 결과가 새 stats를 덮어쓰는 race window 존재. Strict Mode dev 환경에서 효과 두 번 실행.
- **carry-over:** AbortController + safeFetch signal 확장 필요 (변경 표면 큼). 본 step 단일 파일 범위 보존.

### code-reviewer Pass 2 M-4 — SessionDetail.examType 필드 누락

- **위치:** `apps/web/src/components/session/types.ts:69-79`
- **문제:** SessionDetail 응답에 examType 없음 → sessionStorage `persisted.examType` 단일 신뢰. 이중 검증 권고.
- **carry-over:** Workers API 계약 변경 동반. ADR-040 §2.2 영속.

---

## MINOR carry-over (5건)

| 항목                                                | Agent         | 처리                                      |
| :-------------------------------------------------- | :------------ | :---------------------------------------- |
| m-1 빈 catch silent (private mode 로깅)             | silent        | ✅ 본 step 흡수 (M-2 동반)                |
| m-2 Object.hasOwn (prototype pollution)             | silent        | carry-over (실제 위험 0)                  |
| m-3 UUID v4 regex 검증                              | silent        | carry-over (서버 prepared statement 차단) |
| m-4 finalizingRef 복원 분기 reset 정합              | silent        | ✅ 검증 OK (반영 0)                       |
| m-5 examType mismatch UX                            | silent        | ✅ 의도 정합 (반영 0)                     |
| code-reviewer Pass 1 M-3 cardsCompleted 복원 미반영 | code-reviewer | ✅ 검증 OK — 서버 source-of-truth         |

---

## 확인 증거 (auto-review-protocol §"규칙 2 증거 기반 보고")

### feature-dev:code-reviewer

- Pass 1 (Surgeon) 8건 확인 — `StudyFlow.tsx:70-90, 50-64, 164-165 276-278, 200-205`, `session/types.ts:69-79`, `study-api.ts:80-84`, sessionId 검증 type narrowing 분석
- Pass 2 (Architect) 6건 확인 — `study-api.ts:20 65-66 80-84`, `StudyFlow.tsx:43-48 183 222-224`, ARCHITECTURE.md SW 흐름 정합, Hexagonal 격리

### pr-review-toolkit:silent-failure-hunter

- 10건 안전 패턴 확인 — `study-api.ts:54-56 safeFetch network 전파`, `routes.ts:1583-1585 user_id 소유 검증`, `routes.ts:1565-1573 prepared statement injection 차단`, `StudyFlow.tsx:276-277 187 finalizingRef double-finalize 가드`, `71-86 다중 type guard`, `201-204 263-265 285-287 401 redirect 일관성`, `186-198 completed phase 자가 정리`, `207-210 examType mismatch 정리`, `254 mode-select 미시작 좀비 영속 0`, `useEffect 의존성 명확`

---

## 반론 (Devil's Advocate)

### code-reviewer

- examType prop 정적이면 M-1 영향 0이지만 코드만 보고 보장 불가
- 단위 테스트 부재 → 3개 분기 (completed/unauthenticated/mismatch) 수동 검증 의무

### silent-failure-hunter

- iOS Safari 탭 언로드 후 sessionStorage 보존 여부 불명확 — PWA 주 타깃 모바일 80%에서 보장 미흡. graceful fallback으로 Critical 비대상이나 E2E Playwright 검증 의무.
- completeSession 부분 성공 시나리오 — 본 step 의도 명문화로 흡수 (M-1)
- 단위 테스트 부재 — jsdom sessionStorage mock 필요. Phase 3 종료 전 추가 권고.

---

## 판정

**완료 가능** (Critical 0건 — 서버 user 소유 검증으로 자가 해제, Major 본 step 흡수 3건 + carry-over 2건, Minor carry-over 5건).

apps/web 게이트:

- typecheck PASS
- lint PASS
- build PASS (StudyFlow 34.20 kB / gzip 8.97 kB — Session 071 32.40/8.47 → +1.80 kB/+0.50 kB, 세션 복원 로직 정합)

Production deploy 불필요 (UI 전용 변경, 서버 endpoint 동일). 본 step 다음 단계: commit + push + handoff carry-over.

---

## 후속 carry-over 매트릭스 (Step 3-UX-6e 검증 chain 이월)

| 항목                              | 출처                           | 처리 시점               |
| :-------------------------------- | :----------------------------- | :---------------------- |
| useEffect cleanup AbortController | code-reviewer M-1 / silent M-2 | Phase 3 종료 / E2E 동반 |
| SessionDetail.examType 필드       | code-reviewer Pass 2 M-4       | API 계약 변경 step      |
| Object.hasOwn / UUID v4 regex     | silent m-2 / m-3               | hardening step          |
| sessionStorage E2E Playwright     | silent Devil's Advocate        | Step 3-UX-6e 검증 chain |
| iOS Safari 탭 언로드 동작 보장    | silent Devil's Advocate        | Phase 3 mobile QA       |
