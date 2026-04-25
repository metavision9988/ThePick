# 중간 3단계 리뷰 — 가-1 Group A-2 완료 시점

**리뷰 방식: 독립 에이전트 5인 병렬 (5-페르소나) + 1단계 자동 도구**
**프로토콜: Guide/3단계리뷰.md Level 3 + auto-review-protocol.md §Phase 단위 5-페르소나**

작성일: 2026-04-25 KST 20:47
선행 리뷰: `.claude/reviews/review-20260425-{110225,142105}-*.md` (1차+2차 4-Pass)
해당 페이지 reviewers는 **위 두 산출물의 발견 중복 금지** 원칙 준수.

---

## 종합 판정

```
🔴 CRITICAL 5건 (dedupe 후) / 🟠 MAJOR 18건 / 🟡 MINOR 17건
중간 점검 결과: A-2 진입 가능 / A-3 진입 전 Critical 5건 결정 필요 (즉시 수정 vs 이월)
```

5 페르소나가 raw로 보고한 Critical은 8건이지만 dedupe 후 **5건 본질**:

- cost-cap inflight HOL blocking + Promise chain 누적 (Q + Perf 동일 지적)
- pdfplumber-smoke `process.cwd()` 의존 (Q + Refactoring 동일)
- IndexedDB → D1 동기화 코드 0건 (BE 단독)
- admin status 전이 API endpoint 부재 (BE 단독)
- Workers Logs 알림 + KV graceful fallback 부재 (DO 2건이지만 동일 메타 — "운영 회로 부재")

기존 plan에 이미 명시된 항목 (TD-043 batch-retry 401, TD-044 lost-update, Year 2 백필) 은 plan 보강으로 처리.

---

## Stage 1 — 자동 도구 (Guide L3 §1단계)

| 도구                | 결과                                                                                                                                                                                                        |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm -r typecheck` | ✅ 전체 워크스페이스 통과 (apps×4 + packages×7 + modules×3)                                                                                                                                                 |
| `pnpm -r lint`      | ✅ 위반 0건 (formula-engine/parser/payment/quality/study-material-generator/parser-1st-exam/batch 모두 Done)                                                                                                |
| `pnpm -r test`      | ⚠️ apps/api + apps/batch + packages PASS / **modules/{learning,exam,content} "No test files found, exit 1"** — 빈 디렉토리 vitest 기본 동작. 회귀가 아닌 운영 잡음. `passWithNoTests: true` 1줄로 해소 가능 |
| `pnpm audit`        | (미실행 — 진산님 직접 호출 권장 시 추가 가능)                                                                                                                                                               |

**modules/\* test 노이즈**: 신규 발견은 아님. vitest config 통일로 즉시 정정 권고 (Minor).

---

## Stage 2~3 — 5-페르소나 (Guide L3 §2-3단계 + Phase 단위 의무 점검)

### 🔴 NEW CRITICAL 5건 (dedupe 후)

#### C-1 [Q NEW-C-1 + Perf M-PERF-1] — cost-cap inflight HOL blocking + chain 누적

- 파일: `apps/batch/src/__manual__/cost-cap.ts:71, 96-101`
- 핵심: fn 자체가 hang/timeout 부재 시 inflight chain 영원히 매달림 + 50회 누적 시 V8 microtask O(n)
- 1차/2차에서 race **발생**은 차단했으나 **fn 의 자체 timeout 강제** 미고려
- **해소 방향**: `guardedCall(estimatedMaxUsd, fn, opts?: { timeoutMs?: number })` 옵션 추가 + `AbortController` 패턴 + smoke 스크립트에서 강제

#### C-2 [Q NEW-C-2 + Refactoring N-NEW-2] — pdfplumber-smoke `process.cwd()` 의존

- 파일: `apps/batch/src/__manual__/pdfplumber-smoke.ts:135-136, 178`
- 코드: `const projectRoot = resolve(process.cwd(), '../..');`
- 시나리오: README 권고 `pnpm --filter @thepick/batch exec` 외 IDE Run 또는 repo root 실행 시 깨짐
- **해소 방향**: `import.meta.url` 기반 절대 경로 (다른 batch 코드 패턴 일관)

#### C-3 [BE C-1] — IndexedDB → D1 동기화 코드 0건

- 파일: `apps/web/src/lib/db.ts:143-150` (offlineActions stub) + `apps/web/src/stores/progress.ts` (D1 호출 0건)
- db.ts 헤더 "9 stores mirroring D1 tables for offline-first PWA" — 양방향 mirroring **선언만**, 실제 단방향(read)
- 시나리오: 출퇴근 모바일 학습 → 집 PC 로그인 → "오늘 푼 문제 0건" → 학습 진도 신뢰성 즉시 붕괴
- **결정 필요**: 가-1 Group A-3 진입 차단 / Phase 2 명시 이월 / 별도 epic

#### C-4 [BE C-2] — admin-web status 전이 API endpoint 부재

- 파일: `apps/admin-web/src/components/ContentQueue.tsx:32, 123, 140` (`onStatusChange` prop 정의됨) + `apps/admin-web/src/pages/index.astro:38-42` (caller 비어 있음, "API 연동 예정" 주석)
- `apps/api/src` 에서 `POST /api/admin/transitions` 라우트 0건
- 시나리오: BATCH-1 적재 후 검수 시작 시도 → 버튼 클릭 무반응 → draft 영원
- **결정 필요**: 가-1 Group B 진입 시 책임 명시 / 별도 step

#### C-5 [DO OP-C-1 + OP-C-2] — 운영 회로 부재 (Workers Logs 알림 + GD KV 폴백 0건)

- 파일: `apps/api/wrangler.toml:49-51` `[observability]` enable 만 / `apps/api/src/middleware/retry.ts:11-14` 주석에 "KV 폴백" 명시 / 실 호출 grep 0건
- 시나리오: KST 03:00 cron 7일 연속 실패해도 7일 후 D1 사용량 알림으로만 인지 / D1 region 부분 장애 시 503 폭증 → 사용자 빈 화면
- **결정 필요**: Group D Graph 적재 직전 plan 보강 (단일 벤더 원칙 준수: Email Routing + Analytics Engine writeDataPoint)

### 🟠 MAJOR 18건 (5인 합산, 핵심)

| ID   | 영역         | 발견                                                                   | Agent            |
| :--- | :----------- | :--------------------------------------------------------------------- | :--------------- |
| M-1  | Build        | `__manual__/` tsconfig include — 운영 번들 누설 위험                   | Refactor M-NEW-1 |
| M-2  | Code Quality | `withRetry` silent drop (lastError 만 보존)                            | Refactor M-NEW-2 |
| M-3  | Code Quality | logger 일관성 — apps/batch 의 console.warn vs apps/api 의 createLogger | Refactor M-NEW-3 |
| M-4  | Code Quality | `ExtractionResult.warnings` dead field — Python script 미수집          | Refactor M-NEW-4 |
| M-5  | Perf         | `appendFileSync` 동기 블로킹 (token-cost-logger)                       | Perf M-PERF-2    |
| M-6  | Perf         | draft-loader N+1 prepare statement (BATCH-2 D1 batch limit 위험)       | Perf M-PERF-3    |
| M-7  | Perf         | pdfplumber 표 풍부 페이지 시 worst-case 미측정                         | Perf M-PERF-4    |
| M-8  | Quality      | progress/routes lost-update race (TD-044 scope 누락)                   | Quality NEW-M-1  |
| M-9  | Quality      | cost-cap fire-and-forget unhandledRejection                            | Quality NEW-M-2  |
| M-10 | BE           | TD-042 호출처 + 테스트 픽스처 정량화 부재                              | BE M-1           |
| M-11 | BE           | 0013 SUPERSEDES — constants 간 엣지 FK 위반 가능                       | BE M-2           |
| M-12 | BE           | Vectorize down 시 ADR-008 §0.60 거부 코드 부재 (Phase 2)               | BE M-3           |
| M-13 | BE           | pdfplumber 자동 fallback (Vision OCR) 경로 미설계                      | BE M-4           |
| M-14 | BE           | D1 다운 시 클라이언트 IndexedDB 폴백 미구현                            | BE M-5           |
| M-15 | BE           | sessions cleanup cron 부재                                             | BE M-6           |
| M-16 | BE           | webhook_events 페이로드 raw 저장 + PII 마스킹 외주                     | BE M-7           |
| M-17 | DO           | wrangler rollback 절차 + D1 down script 부재                           | DO OP-M-1        |
| M-18 | DO           | measurement 90일 만료 자동화 (CI 차단으로 격하 권고)                   | DO OP-M-2        |

추가 4건 (DO OP-M-3/M-4/M-5 + Q NEW-C-3 등) 은 다른 5-페르소나에서 분산 보고 — 산출물 본문 참조.

### 🟡 MINOR 17건 — 다음 터치 / Group D 전 일괄

각 페르소나 보고서의 minor 합산. 핵심 5건만 인용:

- N-NEW-1 매직 넘버 200 중복 (코드+문구) — pdfplumber-smoke
- N-NEW-3 DEFAULT_MAX_USD 산정 근거 주석 부재 — cost-cap
- m-PERF-5 token-cost-logger aggregate CLI 부재
- m-2 progress DUE_LIMIT 50 하드코딩 — Hard Limit 정신 위반
- OP-m-1 KV `id="0000..."` placeholder 모든 env 동일

---

## Part 4 — 시나리오 테스트 권고 (Quality engineer)

### 자동화 가능 (5건)

| ID       | 시나리오                                                                                                            | 위치                   |
| :------- | :------------------------------------------------------------------------------------------------------------------ | :--------------------- |
| α-2-auto | cost-cap 우회 검출 — `apps/batch/src/__manual__/__tests__/integration.test.ts` 신설, grep 기반 SDK import 외부 검출 | 가-1 Group D 또는 즉시 |
| α-3-auto | claude-smoke 호출 횟수 한도 검증 — 단위 테스트                                                                      | A-1 작성 시            |
| α-4-auto | secret 패턴 회귀 — `scripts/__tests__/check-no-secrets.bats` 또는 vitest exec                                       | Group D 전             |
| α-5-auto | pdfplumber-smoke cwd 가정 — 단위 테스트 (NEW-C-2 fix 회귀)                                                          | C-2 fix 시             |
| α-6-auto | progress /review 동시 write race — Promise.all 시뮬, total_reviews=2 검증 (M-8 fix 회귀)                            | TD-044 scope 확장 시   |

### 수동 검증만 가능 (3건)

| ID         | 시나리오                                                        | 트리거   |
| :--------- | :-------------------------------------------------------------- | :------- |
| α-1-manual | 진산님 ANTHROPIC_API_KEY 주입 → claude-smoke 통과 → 산출물 작성 | A-1 진입 |
| α-2-manual | 잘못된 키 → 401 → callCount=1 + 보수적 누적 회복                | A-1 진입 |
| α-7-manual | pdfplumber subprocess SIGKILL 후 좀비 프로세스 OS-level 검증    | 별도     |

### 기존 시나리오 누락 영역 (NEW)

1. `__manual__/` smoke 통합 시나리오 0건 — scenarios.test.ts 27개는 전부 API 영역
2. 결제 실패 후 학습 권한 회수 시나리오 — Phase 2 영역 명시 필요
3. scenarios.test.ts 에 batch/loader 영역 0건 — "수험생이 BATCH 1 학습을 시작한다" 시나리오 부재

---

## 진입 권고

### 즉시 수정 가능 (Claude 위임, 신뢰성 강화)

1. **C-2 pdfplumber-smoke `import.meta.url` 전환** (5분 수정 + 회귀 테스트)
2. **C-1 cost-cap `guardedCall` timeout 옵션** (15분 수정 + 단위 테스트 추가)
3. **M-1 `__manual__/` tsconfig exclude** (1줄 추가 + typecheck 재검)
4. **modules/\* vitest passWithNoTests** (1줄 × 3 — vitest config)

### 진산님 결정 필요 (이월 vs 즉시)

| Critical                               | 본질                                      | 권고                                      |
| :------------------------------------- | :---------------------------------------- | :---------------------------------------- |
| C-3 IndexedDB→D1 sync                  | "오프라인 first PWA" 광고 vs read-only 갭 | Phase 2 명시 이월 + db.ts 헤더 정정       |
| C-4 admin status API                   | BATCH-1 적재 후 검수 차단                 | 가-1 Group B 책임 plan 명시               |
| C-5 운영 회로 (Workers Logs / KV 폴백) | 새벽 3시 알림 도달 경로 0                 | Group D 진입 plan 보강                    |
| M-8 progress lost-update               | TD-044 scope 누락 (draft-loader 만 명시)  | 가-1 Group C TD-044 scope 확장 (plan 1줄) |
| BE C-4 Year 2 백필 SQL                 | Hard Rule 16 zero-cost 의 SQL 비용 갭     | Phase 2 종료 전 시뮬 fixtures + 명시 이월 |

### 이월 명시 (본 Step 외)

- M-2 withRetry silent drop / M-5 appendFileSync / M-6 D1 batch chunking → 가-1 Group C (TD-043 함께)
- M-3 logger 일관성 / M-4 warnings dead field → Phase 1 후반전 옵저버빌리티 묶음
- M-10~M-16 BE Major 7건 → 가-1 Group C 개별 항목 + Phase 2 일부

---

## Devil's Advocate (5-페르소나 종합)

> _"이 코드들이 새벽 3시 누구를 깨우는가" — 진산님 메모리 "안정성·신뢰성·항상성" 정신과 직결._
> _직전 2 라운드 4-Pass는 코드 정합성을 깊이 다뤘으나, 본 5-페르소나는 **운영 회로의 구조적 부재**를 발견했다._
> _CRITICAL RULE #3 "try-catch 에서 데이터 조용히 삭제 금지" 의 운영 차원 명제 — **"실패를 로깅하면서 누구에게도 도달하지 않으면 silent failure"** — 가 본 리뷰의 메타 발견._

---

## 서명

| 페르소나             | agentId           | tools | duration |
| :------------------- | :---------------- | :---- | :------- |
| refactoring-expert   | a3c2af27da29ddbeb | 65    | 320s     |
| performance-engineer | a6463158489f53b73 | 25    | 132s     |
| quality-engineer     | a3a18df00da411a34 | 52    | 329s     |
| backend-architect    | ac5df3abe364753f2 | 49    | 305s     |
| devops-architect     | a10c29e75568a9c22 | 49    | 275s     |

합계 240 tool uses / ~22분 / 독립 컨텍스트 5개 (병렬). 직전 4-Pass 발견 + DEV COVEN G-1/G-2/G-5 중복 0건 검증.

진산님 메모리 원칙 준수: 일정/법무 추정 0 / 신뢰성·안정성·항상성 차원 단독 집중.
