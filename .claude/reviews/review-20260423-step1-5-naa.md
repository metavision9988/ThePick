# Step 1-5 (나) 진도 API — 4-Pass 독립 에이전트 리뷰

**일시:** 2026-04-23 KST
**범위:** `/api/progress/{summary,review,due}` 3 엔드포인트 + require-auth 첫 실전 마운트
**리뷰 방식:** 4개 독립 서브에이전트 병렬 (feature-dev:code-reviewer / system-architect / silent-failure-hunter / pr-review-toolkit:code-reviewer)
**리뷰 범위:** 변경 5개 + 연관 5개

---

## 📊 집계

| Pass             | Critical | Major | Minor | N/A   |
| ---------------- | -------- | ----- | ----- | ----- |
| Pass 1 Surgeon   | 1        | 2     | 1     | 0     |
| Pass 2 Architect | 0        | 0     | 2     | 1     |
| Pass 3 Advocate  | 0        | 2     | 3     | 3     |
| Pass 4 Contract  | 0        | 0     | 2     | 2     |
| **합계**         | **1**    | **4** | **8** | **6** |

---

## ✅ 즉시 해소 (본 Step scope 내)

| 분류   | 항목                                         | 수정                                                               |
| ------ | -------------------------------------------- | ------------------------------------------------------------------ |
| 🔴 C-1 | `/api/progress/*` CORS 미적용                | `index.ts` — `buildCorsOptions()` 팩토리 + auth/progress 양쪽 적용 |
| 🟠 M-1 | `require-auth` 빈 `sub`/`sid` JWT 통과       | `require-auth.ts` — fail-closed 분기 추가                          |
| 🟠 M-2 | `seedProgress` 테스트 FSRS 필드 DEFAULT 의존 | `routes.test.ts` — 명시 INSERT                                     |

재검증 결과:

- `typecheck` 0 errors
- `lint` 14 workspaces Done
- `test` 12 files / **184 passed**

---

## ⏭️ TD 이월 (tech-debt.md TD-029 ~ TD-036)

- **TD-029** /review CSRF 방어 (Phase 2 프론트 통합 전)
- **TD-030** knowledge_nodes ID enumeration rate-limit (Step 1-5 가 적재 전)
- **TD-031** UPSERT lost-update race — 복합 UNIQUE + atomic UPSERT (Phase 2 FSRS 동시)
- **TD-032** require-auth reason 노출 마스킹 (production)
- **TD-033** FSRS 초기값 상수화 (Phase 2)
- **TD-034** resolveLoggerEnv 3~4중 중복 → @thepick/shared
- **TD-035** PRAGMA foreign_keys ON 요청마다 실행 → Workers 부트 1회 압축 검토
- **TD-036** Year 2 user_progress 시그니처 `(examId, userId)` 전환 (ADR-007 이월)

---

## Pass 1 Surgeon — 발견 요약

> "이 코드 단독으로 터지는 경로가 있는가?"

- 🔴 C-1: CORS 누락 — 브라우저 통합 시 preflight 전부 실패 (해소)
- 🟠 M-1: `result.payload.sub` 빈 문자열 경로 — WHERE user_id='' 쿼리 위험 (해소)
- 🟠 M-2: 테스트 픽스처 NOT NULL DEFAULT 의존 (해소)
- 🟡 Mi-1: `resolveLoggerEnv` 중복 선언 (TD-034)
- 반론: UPSERT SELECT→UPDATE race (TD-031)

## Pass 2 Architect — 발견 요약

> "이 코드가 다른 모듈과 만나면 터지는가?"

- Hard Rule 15/17 grep 0건 — 시험 분기/ID 리터럴 clean
- Hard Rule 16 **Year 1 한시 예외 적용 판정 (통과)** — user_progress ADR-007 이월 대상, Year 2 Phase 4 리팩토링 시점에 시그니처 변경
- D1 스키마 정합 — Drizzle vs migrations/0002 user_progress 컬럼 1:1 일치
- require-auth generic 호환성 확인 — 기존 호출처 회귀 없음
- 🟡 Minor: i18n 키 네임스페이스 미도입 (Phase 2), FSRS 기본값 이중 하드코딩 (TD-033)
- 반론: 복합 UNIQUE 부재 race (TD-031), Year 2 exam_id 누락 (TD-036), PRAGMA 이중 비용 (TD-035)

## Pass 3 Advocate — 발견 요약

> "수험생과 공격자 둘 다 만족하는가? Silent Failure?"

- 빈 catch 0건, 조용한 폴백 0건, SQL injection 불가, 사용자 격리 3곳 전부 확인
- 🟠 M-1: CSRF 방어 미게이트 — SameSite=Strict 부분 방어, same-origin XSS 취약 (TD-029)
- 🟠 M-2: NODE_NOT_FOUND enumeration oracle — 공격자가 knowledge_nodes ID 전수 열거 가능 (TD-030)
- 🟡 Minor: reason 노출 마스킹 (TD-032), timestamp ISO/datetime 혼용, Number NaN 방어
- 반론: 로그인한 유료 사용자 1명이면 CSRF + rate-limit 없음으로 Graph 스크래핑 + 자기 진도 조작 가능

## Pass 4 Contract — 발견 요약

> "plan/CLAUDE.md 규율 대로 만들었는가? Silent Pivot?"

- plan `scope:` 6개 파일 외 변경 **0건** — Silent Pivot 없음
- CRITICAL RULE #1 (기획과 다르게 구현 시 코딩 멈춤 + 인간 보고) 준수
- any 0건 / console.log 0건 / TODO 0건 / 빈 catch 0건 / import \* 0건
- knowledge_nodes UPDATE 금지 Hard Limit 준수 — 본 Step SELECT 만
- FSRS 알고리즘 Phase 2 이월 계약 준수 — 카운트만 증가
- 🟡 Minor: FSRS 리터럴 상수화 (TD-033), 201/200 status code plan 미명시 (문서 보완)
- 반론: TD-031 (UPSERT race) 가 Step 1-5 (가) 실사용자 유입 전 해소되어야 함

---

## 판정

**Step 1-5 (나) 완료 가능.** 4-Pass Critical 0건 유지 (C-1 즉시 해소), Major 2건 TD 이월 (Phase 1 후반전 이내 해소). 기획 계약 준수, Silent Pivot 없음.

엔진 E2E 합격증 발급:

- 로그인 → 쿠키 발급 → 보호 API 호출 → 사용자 격리 쿼리 → 응답 파이프라인 실물 동작 확인
- Access 만료 → /refresh rotation → 재인증 흐름 E2E 검증 (S27)
- 21 → 27 시나리오 확장 + progress 라우트 단위 테스트 17건 추가

**Step 1-5 (가) 교재 Graph 구축 진입 가능.**
