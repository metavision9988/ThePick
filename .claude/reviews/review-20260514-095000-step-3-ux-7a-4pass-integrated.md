# Step 3-UX-7a — distractor adminUI mock 4-Pass 통합 리뷰

**대상:** Phase 3 distractor BATCH 보강 첫 chunk (mock UI + schema)
**일시:** 2026-05-14 09:50 KST (Session 075)
**리뷰 방식:** 1 독립 에이전트 통합 (code-reviewer — Pass 1+2+3+4)
**리뷰 범위:** 신규 5 파일 + 참조 4 파일 (`packages/shared/types.ts`, `ContentQueue.tsx`, `migrations/0032`, `plan §6.3 + §11.6 + §13 D1`)

---

## 통합 판정

| Pass          | Critical | Major | Minor | 흡수                       |
| :------------ | :------- | :---- | :---- | :------------------------- |
| 1 (Surgeon)   | 0        | 0     | 1     | carry-over                 |
| 2 (Architect) | 0        | 1     | 0     | 7c carry-over              |
| 3 (Advocate)  | 0        | 1     | 1     | 7c carry-over              |
| 4 (Contract)  | 0        | 0     | 1     | 7c carry-over              |
| **합계**      | **0**    | **2** | **3** | **5 carry-over (모두 7c)** |

**판정: 완료 가능** — 본 chunk(7a mock UI 한정) 종료 차단 Critical 0건. Major 2건 + Minor 3건 모두 실 API 연동 7c chunk scope에서 자연 해결 또는 명시 carry-over.

---

## Carry-over 5건 (7c chunk 흡수 의무)

| 우선도         | 항목                                                                                                        | 위치                                              | 권장 수정                                                   |
| :------------- | :---------------------------------------------------------------------------------------------------------- | :------------------------------------------------ | :---------------------------------------------------------- |
| Major (Pass 2) | `STATUS_LABELS`/`STATUS_COLORS` 3중 중복 (DistractorReview + DistractorQueue + ContentQueue 각자 별도 선언) | 3 파일                                            | `apps/admin-web/src/lib/content-status.ts` 단일 source 통합 |
| Major (Pass 3) | 모바일 viewport (375px) 2열 grid 깨짐 — sidebar 320px + main 23px                                           | DistractorQueue.tsx:141 + DistractorReview.tsx:84 | `@media (max-width: 768px)` 1열 stack fallback              |
| Minor (Pass 1) | `confidenceBadge` boundary 부동소수점 — `>= 0.9`                                                            | DistractorReview.tsx:33-37                        | `Math.round(confidence * 100) >= 90`                        |
| Minor (Pass 3) | `reviewerNote` textarea `maxLength` 미설정 — 100KB 붙여넣기 위험                                            | DistractorReview.tsx:220-236                      | `maxLength={500}` + 7c API 서버 검증                        |
| Minor (Pass 4) | Step 3-UX-7e 진산 검수 의무 visual reminder 부재                                                            | admin landing page                                | "검수 완료 N/N건 — 진산 게이트 7e 대기" 배지                |

---

## 검증 완료 증거 (Pass 별)

### Pass 1 (Surgeon)

1. mock seed 3건 schema 정합 (`originalChoices` 5개 / `distractors` 4개 / `correctIndex` 매핑)
2. distractor 길이 보정 IIFE safe (slice(0, 4) + 빈 문자열 padding)
3. `allFilled` 공백 트림 검사 정합 (test 4건이 빈 문자열 차단 검증)
4. `handleAction` payload race-free (React 18/19 batching 보장)
5. `handleUpdate` setSelectedId(null) → unmount/remount stale closure 차단

### Pass 2 (Architect)

1. ContentStatus 5 키 모두 매핑 정합 (packages/shared/src/types.ts:83)
2. 마이그레이션 0032 `distractors TEXT` JSON array 매핑 정합
3. Astro `client:only="react"` SSR skip + JSON serializable mock 정합
4. Hard Rule 15/17 정합 — admin-web 시험 특화 분기 0, examId 리터럴 0
5. L3 영역 미저촉 — formula-engine/constants/D1 schema/user_progress 무관

### Pass 3 (Advocate)

1. 모든 인터랙티브 요소 `minHeight: 44px` (AESTHETIC §3.5)
2. 정답 컨테이너 시각 구분 명확 (`background: #f8fafc` + `font-weight: 600`)
3. XSS 표면 0건 — React JSX 자동 escape, 위험 React prop (인라인 HTML 주입) 미사용
4. 정렬 default `confidence-asc` 신뢰도 낮은 항목 우선 검수 (plan §6.3 정합)
5. 빈 데이터 placeholder 명시 (DistractorQueue.tsx:152-156, 190-203)

### Pass 4 (Contract)

1. plan §6.3 path A "기출 원문 5지선다 + adminUI 검수" 정합 (§13 D1 lock)
2. 마이그레이션 0032 schema 매핑 정합
3. ContentQueue.tsx mirror 정합 (동일 status 패턴 + 색상 코드)
4. Hard Limit "AI 생성 데이터는 draft만 적재 (인간 검수 후 approved)" — mock seed 2 draft + 1 review + 0 approved
5. 본 chunk scope 정합 — mock UI 한정 명시 (types/distractor.ts:9, DistractorReview.tsx:8, index.astro:7)

---

## Devil's Advocate

- **Pass 1**: `confidenceBadge(0.9)` boundary 부동소수점 — mock seed는 명시 리터럴이라 현재 통과하나 7c API 응답이 계산값일 경우 `0.9` 정확 비교 실패 가능. → Minor carry-over.
- **Pass 2**: `STATUS_LABELS` 3중 중복 → `published` 라벨 변경 1회 시 3곳 동기화 휴먼 에러. → Major 7c carry-over.
- **Pass 3**: AESTHETIC §3.5 44px+ 주석이 모바일 admin 검수 가능성을 시사. 그러나 375px viewport에서 2열 grid가 사실상 사용 불가 (main 23px). → Major 7c carry-over.
- **Pass 4**: plan §11.6 "진산 검수 의무 (3-UX-7e)" visual reminder가 UI에 없음. 7c에서 admin landing에 검수 완료/대기 배지 권장. → Minor carry-over.

---

## 검증 결과 (최종)

```
$ pnpm -F @thepick/admin-web test
Test Files  5 passed (5)
     Tests  21 passed (21)  (distractor 11 + pre-existing 10)

$ pnpm -F @thepick/admin-web lint  →  PASS
$ pnpm -F @thepick/admin-web typecheck  →  GraphVisualizer.tsx pre-existing error (본 작업 무관)
```

판정: **완료 가능 — Critical 0건, Major + Minor 5건 모두 7c chunk 흡수**.
