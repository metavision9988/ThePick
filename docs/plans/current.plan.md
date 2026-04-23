---
phase: 1
step: 1-5 (나) — 진도 API 엔진 통합 검증
approved_by: 진산 "승인할 테니 진행해줘" (2026-04-23 KST)
scope:
  - docs/plans/current.plan.md (본 파일)
  - apps/api/src/progress/routes.ts (신규 — /api/progress/* 3 엔드포인트)
  - apps/api/src/progress/__tests__/routes.test.ts (신규 단위 테스트)
  - apps/api/src/index.ts (progress 라우터 마운트 + require-auth 연결)
  - apps/api/src/__tests__/scenarios.test.ts (S22~S27 추가)
  - apps/api/src/db/schema.ts (변경 없음 — user_progress 기존 테이블 활용)
  - .claude/tech-debt.md (TD-028 해소 경로 진척 / 신규 TD 등록)
risk_level: L3
---

## 목적

Step 1-4 까지 구축한 **인증 엔진(Access JWT + D1 Refresh + require-auth 미들웨어)** 을 실제 보호 라우트에 **처음 마운트** 하여 엔진이 E2E 로 동작함을 검증한다.

진산님 비전(= 자격증 도메인별 Graph RAG + 훈련 콘텐츠 자동 생성 엔진 MVP)의 **엔진 기초공사 최종 합격증**:

- 로그인 → 보호 API 호출 → D1 읽기/쓰기 → 응답 전체 파이프라인 실물 확인
- `require-auth` 미들웨어가 실제 라우트에 연결되어 위조/만료/미인증을 차단하는지 검증
- 시나리오 테스트로 수험생/공격자 관점에서 엔진이 기대대로 동작함을 증명
- user_progress 기존 테이블을 그대로 활용 (FSRS 알고리즘은 Phase 2 이월 — 여기서는 read/write 경로만)

**Step 1-5 (가) 교재 Graph 구축**(본격 콘텐츠 적재)은 본 (나) 통과 후 별도 plan 으로 진입.

## 기술 선택 근거 (PITR 간단판)

**선정: 최소 3개 엔드포인트 + user_progress 기존 테이블 직접 사용 + 신규 study_events 테이블 만들지 않음.**

비교:

- (A) study_events 테이블 신규 + FSRS 엔진 본격 — 스코프 초과, Phase 2 본격 진입
- (B) **user_progress 기존 테이블 활용 + 3 엔드포인트 최소 슬라이스** ← 선정
- (C) 엔드포인트 1개(summary) 만 — require-auth 검증은 되나 write 경로 미검증

B 선정 이유:

- **엔진 통합 검증**이 목적. 콘텐츠 기능 구현이 아님.
- user_progress 는 이미 schema 에 존재 (FSRS 필드 포함). 별도 migration 불필요.
- write 경로(POST /review) + read 경로(GET /summary, /due) 둘 다 포함 → E2E 완결
- Phase 2 에서 FSRS 알고리즘 본격 도입 시 본 구조 그대로 확장 가능

## 대상 변경 상세

### 1. `apps/api/src/progress/routes.ts` (신규)

3 엔드포인트:

**`GET /api/progress/summary`**

- 입력: 인증된 사용자 (userId from require-auth)
- D1: `SELECT COUNT(*), SUM(correct_count), SUM(total_reviews) FROM user_progress WHERE user_id = ?`
- 출력: `{ totalCards, totalReviews, correctCount, accuracy }` (0건이면 0으로)

**`POST /api/progress/review`**

- 입력: `{ nodeId: string, cardType: CardType, correct: boolean }`
- 검증: Zod schema. cardType enum 확인. nodeId 존재 확인 (knowledge_nodes FK — Step 1-5 가 진입 전에는 빈 테이블일 수 있으므로 FK 확인은 graceful)
- D1: user_progress 행이 있으면 `totalReviews += 1, correctCount += correct ? 1 : 0, updatedAt = now` UPDATE. 없으면 INSERT.
- 출력: `{ ok: true, progressId }`
- **출처 추적성 메모**: nodeId → knowledge_nodes.page_ref 를 응답에 surface 할 수 있는 경로 예약 (현재 빈 테이블이라 null). Phase 2 교재 Graph 적재 후 즉시 활성.

**`GET /api/progress/due`**

- 입력: 인증된 사용자
- D1: `SELECT id, node_id, card_type, fsrs_next_review FROM user_progress WHERE user_id = ? AND (fsrs_next_review IS NULL OR fsrs_next_review <= datetime('now')) LIMIT 50`
- 출력: `{ items: [...], count }` (0건이면 빈 배열)
- **FSRS 알고리즘은 Phase 2 이월.** 본 Step 은 next_review 시각 비교만 (단순 SQL).

### 2. `apps/api/src/index.ts` (수정)

```typescript
import { progressRoutes } from './progress/routes';
import { requireAuth } from './auth/middleware/require-auth';

// /api/progress 이하 전체에 require-auth 미들웨어 마운트 (엔진 첫 보호 경로)
app.use('/api/progress/*', requireAuth);
app.route('/api/progress', progressRoutes);
```

### 3. `apps/api/src/progress/__tests__/routes.test.ts` (신규)

테스트 시나리오 (8~10건):

- GET /summary: 인증 성공 → 200 + 0건 집계 / INSERT 후 증가 확인
- GET /summary: 미인증(쿠키 없음) → 401
- GET /summary: 위조 JWT → 401
- POST /review: 유효 payload → 200 + DB row 1건
- POST /review: 동일 userId+nodeId+cardType 재요청 → UPDATE (row 증가 없음, totalReviews +1)
- POST /review: 잘못된 cardType → 400 (Zod)
- POST /review: 미인증 → 401
- GET /due: due 없음 → 200 + 빈 배열
- GET /due: due 1건 (fsrs_next_review 과거) → 200 + 1건 반환
- GET /due: 다른 유저 데이터 격리 (user B 의 due 가 user A 응답에 섞이지 않음)

### 4. `apps/api/src/__tests__/scenarios.test.ts` (기존 파일 확장)

**🎯 엔진 통합 검증 (S22~S27) 신규 그룹:**

- **S22. 수험생이 로그인하고 학습 진도를 조회한다** — 엔진 첫 실전 호출
- **S23. 수험생이 문제를 풀고 진도가 기록된다** — write 경로 E2E
- **S24. 수험생이 오늘 복습할 카드를 조회한다** — read 경로 E2E
- **S25. 로그인하지 않은 방문자가 진도 API 호출 → 401 차단** — require-auth 검증
- **S26. 수험생 A 가 수험생 B 의 학습 데이터 접근 불가** — 격리 검증 (보안 크리티컬)
- **S27. Access 토큰 만료 후 /refresh 갱신 → 학습 이어짐** — rotation E2E (Step 1-4 엔진 합류 검증)

### 5. `.claude/tech-debt.md` (갱신)

- TD-028 (rotation 비원자) 상태 확인 — 본 Step 은 rotation 변경 없음
- 신규 TD: FSRS 알고리즘 Phase 2 이월 명시 (현재 fsrsInterval/fsrsStability/fsrsDifficulty 는 기본값 유지, review 시 SM-2/FSRS 미적용)
- 신규 TD: study_events 별도 테이블(감사 로그) Phase 2 이후 검토

## 위험 분석

| 위험                                                                    | 완화                                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| knowledge_nodes FK 확인 누락 → 임의 nodeId 로 user_progress INSERT 가능 | Zod 검증 + POST /review 에서 `SELECT id FROM knowledge_nodes WHERE id = ? LIMIT 1` 선확인. 미존재 시 404. Step 1-5 (가) 적재 전에는 빈 테이블이므로 모든 nodeId 404 — 정상 동작.                     |
| 다른 사용자 데이터 유출                                                 | 모든 D1 쿼리 `WHERE user_id = ?` 첫 조건. 테스트 S26 에서 명시 검증.                                                                                                                                 |
| FSRS 미구현 상태에서 /due 결과 의미 없음                                | 문서화: "FSRS 알고리즘 Phase 2 이월. 현 Step 은 next_review 시각 비교만". 응답 스키마는 유지하여 Phase 2 에 구현체만 교체.                                                                           |
| user_progress UPSERT 경쟁 조건 (동시 요청 2건)                          | D1 serializes. `INSERT ... ON CONFLICT(user_id, node_id, card_type) DO UPDATE` 패턴. 유니크 인덱스는 본 Step 에서 추가하지 않음 — Phase 2 FSRS 설계 시 결정 (현재는 수동 SELECT then UPDATE/INSERT). |
| require-auth 미들웨어 첫 실전 노출 → 예외 상황 미발견                   | 시나리오 S25/S27 로 미인증/만료 경로 커버. 4-Pass Surgeon 에서 null/undefined 경로 재점검.                                                                                                           |
| 출처 추적성 구조가 이 Step 에서 미완성                                  | 본 Step 은 "엔진 확인"이 목적. citation surface 는 Phase 2 Step 1-5 (가) 교재 Graph 적재 시 본격. 스키마 변경 없음.                                                                                  |
| Zod 의존성 이미 존재 확인 필요                                          | apps/api/package.json 확인 → 없으면 추가 (Hono 친화적, 번들 영향 ~14KB).                                                                                                                             |

## 검증 계획

- [ ] `pnpm --filter @thepick/api typecheck` 0 errors
- [ ] `pnpm -r lint` 14 packages 통과 (Hard Rule 15/16/17 grep 0건)
- [ ] `pnpm --filter @thepick/api test` 기존 161+ tests 유지 + 신규 15~20 tests (routes.test + scenarios S22~S27)
- [ ] `pnpm --filter @thepick/api build` 성공
- [ ] require-auth 마운트 라우트에서 미인증 호출 전부 401 확인 (Grep으로 `/api/progress/*` 방어 경로 검증)
- [ ] 시나리오 S26 (사용자 격리) 실제 통과 → 증거 캡처
- [ ] **4-Pass 독립 에이전트 리뷰** 필수 (Surgeon / Architect / Advocate / Contract)
- [ ] 재리뷰 Critical 0 / Major ≤ 2 (Minor 는 TD 이월 가능)

## 롤백 전략

- routes.ts 신규 파일 → 단순 삭제
- index.ts `app.use` + `app.route` 2줄 제거
- scenarios.test.ts 추가 블록 revert
- DB 스키마 변경 **없음** — 롤백 리스크 최소

## 범위 외 (Step 1-5 가 또는 Phase 2 이월)

- **Step 1-5 (가)** 교재 Graph 구축 (BATCH 1~7 순차 적재) — 본 (나) 통과 후 별도 plan
- **Phase 2** FSRS v4.5 알고리즘 본격 구현 (현재는 필드만 존재, 알고리즘 미적용)
- **Phase 2** study_events 감사 로그 테이블 검토
- **Phase 2** 출처 추적성 `citations` 구조 본격 설계 (수험자 "근거 보기" UX 포함)
- **Phase 2** 문제 자동 생성기 + 근거 역방향 검증 레이어

## 승인 기록

- 진산 "승인할 테니 진행해줘" (2026-04-23 KST, 6-페르소나 감사 재정렬 + 출처 추적성 요구 명시 직후)
