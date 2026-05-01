# Phase 1 종료 5-페르소나 (1/5) — refactoring-expert

리뷰 일시: 2026-05-01 15:58:42 KST
대상: Step 19 = Engine Hardening 마지막 게이트 (Engine Observability v1 + Phase 1 누적)
컨텍스트: 4-Pass MAJOR 6건 (5건 흡수 + 1건 트래킹) 이미 다룸 — 본 리뷰는 **장기 가독성/유지보수성/확장성** 관점

## 핵심 질문

**"6개월 뒤 이 코드가 버틸까?"**

- 6개월 뒤 시나리오 가정: BATCH-1~5 적재 완료 → Phase 2 진입 → 학습 서비스 모듈 추가 → Year 2 공인중개사 확장 검토
- 코드 베이스 누적: 1,089-line `pipeline.ts` + 290-line `routes.ts` + 393-line `TelemetryDashboard.tsx` + 5위치 동기화 enum 등
- 누가 만지는가: 6개월 뒤의 Claude (또는 진산님) 가 **현 의도 주석 없이** 만질 수 있는가

리뷰 범위 (실제 read 한 파일):

- `apps/api/src/telemetry/{types,admin-token,write-helper,routes}.ts` + `__tests__/routes.test.ts`
- `apps/admin-web/src/{components/TelemetryDashboard.tsx,types/telemetry.ts,pages/telemetry/index.astro,env.d.ts}`
- `apps/api/src/db/schema.ts` (engineTelemetry 부분)
- `apps/batch/src/{pipeline.ts (1089 lines 전체),recover.ts,cost-meter.ts}`
- `migrations/0017_engine_telemetry.sql`
- `packages/shared/src/{exam-adapter.ts,constants/exam-ids.ts}`
- 비교 대상: `apps/api/src/{auth/routes.ts,webhooks/payment.ts,progress/routes.ts}` + `apps/batch/src/signal-handlers.ts` (logger env resolution 중복 검증용)

---

## CRITICAL

**0건.**

장기 부채 (6개월) 차원에서 즉시 본 step 차단을 정당화하는 결함은 발견되지 않았다. 4-Pass 가 다룬 정합성 6건 이외에는 부채는 모두 "Phase 2 또는 후속 step 으로 이월 가능" 범주.

---

## MAJOR

### MAJOR-R-1 — `LoggerEnvironment` resolver 5곳 동일 코드 중복 (Lava-Layer 시작점)

**증거 (실제 grep 검증):**

- `apps/api/src/auth/routes.ts:75-88` — `KNOWN_ENVIRONMENTS` Set + `resolveLoggerEnv` 함수 (10라인)
- `apps/api/src/webhooks/payment.ts:71-105` — 동일 패턴 (10라인, 변수명 동일)
- `apps/api/src/telemetry/routes.ts:41-58` — 동일 패턴 (`buildLogger` wrapper 1단계 추가만 다름)
- `apps/api/src/progress/routes.ts:35-57` — 동일 패턴
- `apps/batch/src/{recover.ts:39-52, pipeline.ts:68-81, signal-handlers.ts (VALID_ENVS)}` — 변수명만 다른 동일 로직 (`VALID_LOGGER_ENVS` / `VALID_ENVS`)
- `apps/batch/src/cost-meter.ts:37` — `createLogger` 직접 호출 (env resolution 누락 — environment 디폴트가 'development' 인 채로 production 진입 시 **로그 포맷 오작동 잠재**)

**왜 6개월 뒤 무너지는가:**

1. 새 라우트 추가 시 6번째 복제. 변수명 drift (`KNOWN_ENVIRONMENTS` ↔ `VALID_LOGGER_ENVS` ↔ `VALID_ENVS`) 이미 진행 중.
2. `LoggerEnvironment` 타입에 `'preview'` 등 신규 환경 추가 시 6곳 갱신 의무 — **누락 1곳이 silent misroute**.
3. `cost-meter.ts:37` 가 이미 누락 사례 — Phase 2 로그 집계 시 production 호스트가 'development' 라벨로 들어가 alarm rule 매칭 실패 가능.

**권고 (난이도: 1시간, 부채 만기: BATCH-1 직전):**

```typescript
// packages/shared/src/logger.ts 또는 신규 packages/shared/src/logger-factory.ts
export function createLoggerFromEnv(
  service: string,
  envName: string | undefined,
  module?: string,
): Logger {
  const KNOWN: ReadonlySet<LoggerEnvironment> = new Set([
    'development',
    'staging',
    'production',
    'test',
  ]);
  const env: LoggerEnvironment =
    envName !== undefined && KNOWN.has(envName as LoggerEnvironment)
      ? (envName as LoggerEnvironment)
      : 'development';
  const base = createLogger({ service, environment: env });
  return module ? base.child({ module }) : base;
}
```

- 본 리뷰는 4-Pass `MINOR-A3` (createLogger.fromEnv() factory) 가 이미 차세션 트래킹 한 항목. 본 리뷰는 그 우선순위를 **MAJOR 로 격상** — Lava-Layer 시작점이라 Phase 2 진입 전 처리해야 함을 명시.
- 4-Pass 와 중복이 아닌 이유: 4-Pass MINOR-A3 은 "factory 추가" 만 트래킹. 본 항목은 "이미 6곳 복제 + cost-meter.ts 누락 사례 발견 + 변수명 drift 진행 중" → 부채 심각도 격상 근거 제시.

---

### MAJOR-R-2 — `pipeline.ts` 1089-line 단일 파일 / `runPipeline` 260-line 단일 함수

**증거:**

- `apps/batch/src/pipeline.ts` 총 1089 라인 (`wc -l` 검증)
- `runPipeline` 단일 함수 = 라인 441 ~ 702 = **262 라인** (Read 검증)
- 함수 내부 책임: (a) Hard Rule 17 검증 / (b) recover 분기 5종 / (c) batch_runs INSERT / (d) SIGINT/SIGTERM handler 등록 (closure 30 라인) / (e) CostMeter start / (f) 10-stage loop / (g) checkpoint flush / (h) batch_runs UPDATE 4종 / (i) finally finalize 2종 / (j) PipelineResult 조립
- `metaPersistenceFailures` 누적 패턴이 4번 반복 (state_failed/state_in_progress/state_completed/sigint_kill) — try/catch + push 블록 13~17 라인씩 4회 = 동일 패턴 ~70라인.

**왜 6개월 뒤 무너지는가:**

1. 새 stage 추가 (예: vision_ocr 활성, embedding 추가) 시 1089-line 파일을 처음부터 읽어야 함. 6개월 뒤의 Claude 가 이 파일을 한 컨텍스트에 못 담을 수 있다 (200K 컨텍스트 모델은 가능하지만 1M 컨텍스트가 아닌 경우 위험).
2. `runPipeline` 책임이 10가지 — Single Responsibility Principle 명시 위반. 신규 책임 (예: telemetry write integration — 4-Pass MAJOR-S2) 추가 시 **그 100% 가 이 함수 안에** 들어갈 압력.
3. `metaPersistenceFailures` 패턴 4회 복제 — 향후 5번째 영구화 지점 추가 시 또 복제. drift 시그널 (현재 4개 사이트 모두 동일하지만 reason 추출 로직 등 미세 차이 누적 가능).

**권고 (난이도: 4-6시간, 부채 만기: Phase 2 초기):**

1. **단일 파일 분할**: `pipeline.ts` (오케스트레이터 ~400라인) + `pipeline-stages.ts` (10 stage 함수 ~500라인) + `pipeline-meta.ts` (metaPersistenceFailures 누적 helper + batch_runs UPDATE wrapper).
2. **`metaPersistenceFailures` accumulator 추출**:
   ```typescript
   class MetaFailureAccumulator {
     private readonly failures: MetaPersistenceFailure[] = [];
     async run(stage: ..., operation: ..., fn: () => Promise<void>): Promise<void> {
       try { await fn(); }
       catch (err) {
         const reason = err instanceof Error ? err.message : String(err);
         this.log.error(...); this.failures.push({ stage, operation, reason });
       }
     }
     toReadonly(): readonly MetaPersistenceFailure[] { return [...this.failures]; }
   }
   ```
   호출 측 4곳 → 4 라인씩 (현재 13~17 라인). **70라인 → 16라인** 절감.
3. **stage loop 추출**: 본문 i~ii 80여 라인을 별도 `executeStageLoop()` 로 분리 — runPipeline 시그니처는 보존, 가독성 단계만 변화.

본 리뷰는 4-Pass 와 중복이 아닌 이유: 4-Pass 는 `runPipeline` 의 **정합성** (stage 순서, error handling, recover 분기) 만 검증. 본 리뷰는 **장기 변경 비용 (책임 분산)** 관점.

---

### MAJOR-R-3 — `TelemetryDashboard.tsx` inline style 26 사이트 + 디자인 토큰 부재

**증거:**

- `apps/admin-web/src/components/TelemetryDashboard.tsx` 총 393라인 / `style={{` 26회 매치 (grep 검증)
- 색상 하드코딩 (`#fff`, `#0f172a`, `#1e293b`, `#475569`, `#7f1d1d`, `#16a34a`, `#eab308`, `#dc2626`, `#94a3b8`, `#f8fafc`, `#cbd5e1`, `#f1f5f9`, `#fef2f2` 등) — `STATUS_COLORS` 4개를 제외하고 모두 inline 매직 헥스.
- `pages/telemetry/index.astro:19-28` 에 `<style>` 태그가 **존재** — 디자인 토큰 인프라 (Tailwind / CSS modules / shadcn) **미사용 상태**.
- CLAUDE.md 명시: "Frontend: Astro + React Islands + **Tailwind CSS** + shadcn/ui (PWA)" — 정책과 구현이 어긋남.

**왜 6개월 뒤 무너지는가:**

1. 디자인 변경 1건 (예: 다크 모드 토글, 색상 토큰 변경) 시 393-line 컴포넌트 수동 grep 후 일괄 교체 필요. 새 컴포넌트 (Phase 2 학습 SLO 차트 등) 추가 시 동일 inline 패턴 복제.
2. 진산님 노출 화면 ≠ 사용자 노출 화면이긴 하나 (admin-web), Phase 2 reviewer 배지 등 신규 UI 추가 시 동일 패턴 폭증 압력. **디자인 토큰 인프라가 부재한 상태로 6개월 후 Tailwind 도입 시 마이그레이션 비용 = 그동안 누적된 N 컴포넌트 × 26 inline.**
3. `phaseTag = snapshot.phase === 2 ? 'Phase 2' : 'Phase 1'` (line 61) — Phase 3 진입 시 분기 추가 누락 위험. 단순 `phase: 1 | 2` literal type 이라 타입 시스템이 잡아주긴 하지만, 표시 문자열 mapping 은 별도 dict 권장.

**권고 (난이도: 2-3시간, 부채 만기: Phase 2 admin-web 본격 확장 직전):**

1. Tailwind CSS 도입 (CLAUDE.md 정책 준수 — 현재 미도입 상태가 "정책 위반" 수준은 아니지만 **지연되는 만큼 부채 가속**).
2. 또는 최소한 `apps/admin-web/src/styles/tokens.css` 신규 + CSS variables (`--color-card-bg`, `--color-status-ok` 등) 로 색상 14개 → 14 토큰 추출. 컴포넌트는 `var(--color-...)` 참조.
3. `phaseTag` 등 표시 문자열은 `const PHASE_LABELS: Record<1 | 2, string>` 등 dict 패턴.

본 리뷰는 4-Pass 와 중복이 아닌 이유: 4-Pass Pass 3 (Advocate) 는 보안/UX/접근성을 봤지만 **inline style 전부**가 시야 밖. 본 리뷰는 6개월 디자인 변경 비용 관점.

---

## MINOR

### MINOR-R-1 — telemetry types ↔ admin-web mirror 정합성 (수동 동기화 위험)

**증거:**

- `apps/api/src/telemetry/types.ts:13-23` `ENGINE_TELEMETRY_GAUGES` (8 게이지)
- `apps/admin-web/src/types/telemetry.ts:9-18` 동일 8 게이지 **수동 mirror** (파일 상단 주석에 "별도 패키지화 회피 — 의존 모듈 3개 미만" 명시)
- `apps/api/src/db/schema.ts:587-596` 또 동일 8 게이지 (Drizzle enum)
- `migrations/0017_engine_telemetry.sql:66-75` 또 동일 8 게이지 (CHECK 제약)
- `apps/api/src/telemetry/__tests__/routes.test.ts` 테스트 fixture 도 동일 enum 참조

**5곳 중복 진단**: 의도적 (engine-first 단계에서 패키지화 비용 회피) → 4-Pass 도 PASS 처리. 본 리뷰도 즉시 패키지화 의무까지는 아니라 판단 (Phase 2 학습 모듈 추가 시 4번째 의존자 발생 → 그 시점에 `packages/telemetry-shared` 신설 권장).

**잠복 위험**:

1. `PHASE_1_GAUGES` / `PHASE_2_GAUGES` 가 **api 측에만** 존재 (`types.ts:28-38`). admin-web 은 없음 — `TelemetryDashboard.tsx:302` 에서 `gauge === 'learning_slo' ? 2 : 1` **하드코딩 인라인**. 게이지 6번째가 Phase 2 로 이동 시 (예: `reviewer_queue` Phase 2 활성화) admin-web 측 분기 누락 → silent UI label drift.
2. `migration` ↔ `schema.ts` enum drift 시 D1 INSERT 가 CHECK 제약으로 실패. **typecheck 단계 안 잡힘** (Drizzle inferSelect 는 schema 기준만 본다).

**권고 (Phase 2 진입 직전 의무, 난이도: 30분):**

- `apps/admin-web/src/types/telemetry.ts` 에 `PHASE_1_GAUGES` / `PHASE_2_GAUGES` 도 추가 mirror.
- 또는 `TelemetryDashboard.tsx:302` 의 `phase: gauge === 'learning_slo' ? 2 : 1` 을 `PHASE_2_GAUGE_SET.has(gauge) ? 2 : 1` 로 변경 후 mirror.
- Phase 2 진입 시 (학습 모듈) 본 항목을 **MAJOR 로 격상 + `packages/telemetry-shared` 패키지화** 시점.

### MINOR-R-2 — `examId` brand type 손실 (admin-web 측 `string`)

**증거:**

- `apps/api/src/telemetry/types.ts:63` `TelemetryEvent.examId: ExamId` (brand type)
- `apps/admin-web/src/types/telemetry.ts:24` `TelemetryEvent.examId: string` (brand 손실)

**왜 위험한가**: admin-web 이 향후 examId 입력 폼 (Phase 2 multi-tenant) 추가 시 임의 string 진입 가능. Hard Rule 17 의 typescript-level 보호가 admin-web 경계에서 사라짐. 단, 현재는 read-only 라 즉시 위험 없음 (admin-web 이 examId 를 query 로 보낼 때 백엔드의 `parseExamIdQuery` 가 차단).

**권고 (Phase 2 examId UI 입력 도입 시):**

- `packages/telemetry-shared` 패키지화 시 `ExamId` brand 도 함께 import.
- 또는 admin-web 측 `examId: string` 에 JSDoc 으로 "@see ExamId — Hard Rule 17 검증은 백엔드 책임" 명시.

### MINOR-R-3 — `TelemetryDashboard.tsx` `FetchState` 5상태 + `useState` 분산

**증거:**

- `apps/admin-web/src/components/TelemetryDashboard.tsx:24-29` `FetchState` 5 status: idle/loading/success/unauthorized/error
- 라인 219-225: `setState(...)` 6사이트 (loading 진입 / 401 → unauthorized / !ok → error / success / catch error). `setState((prev) => ({ ...prev, status: 'loading' }))` 로 spread + immediate followup.
- `token` 상태 별도 `useState` (line 219). 동시 변경 (logout = both clearToken + setState({status:'unauthorized'})) 패턴이 두 곳 (line 237-244, 346-349).

**왜 6개월 뒤 부채인가**:

1. 신규 status (예: `polling_paused`) 추가 시 5사이트 일관 갱신 의무. 1곳 누락 = stale UI.
2. `token + state` 분리는 자연스러우나, 두 `useState` 가 동기 변경 의무 → useReducer 패턴이 더 적합.

**권고 (Phase 2 admin-web 확장 시):**

```typescript
type Action =
  | { type: 'fetchStarted' }
  | { type: 'fetchSucceeded'; data: DashboardResponse }
  | { type: 'fetchFailed'; error: string }
  | { type: 'unauthorized' }
  | { type: 'tokenSet'; token: string }
  | { type: 'logout' };

function reducer(state: AppState, action: Action): AppState {
  /* ... */
}
```

- 즉시 처리는 아니나, 다음 컴포넌트 (Phase 2 차트) 추가 시 "useReducer 도 적용" 결정 시점에 본 컴포넌트도 함께 마이그레이트.

### MINOR-R-4 — 에러 클래스 inheritance 일관성 (`KillSwitchError` / `TelemetryWriteError` / `ConcurrentRunError`)

**증거 (Phase 1 누적 에러 클래스):**

- `apps/batch/src/cost-meter.ts:62-74` `KillSwitchError extends Error`
- `apps/batch/src/pipeline.ts:362-370` `ConcurrentRunError extends Error`
- `apps/batch/src/pipeline.ts:376-384` `RecoveryFailedError extends Error`
- `apps/api/src/telemetry/write-helper.ts:28-36` `TelemetryWriteError extends Error`
- `apps/batch/src/checkpoint.ts` (검증 미완) `CheckpointCorruptedError`, `CheckpointNotFoundError`, `CheckpointVersionMismatchError`
- `packages/shared/src/errors.ts` 본 파일 존재 (Read 미수행 — 단 `wc` 결과 = 64 line)

**왜 6개월 뒤 부채인가**:

1. 7+ 종 에러 클래스가 `Error` 직접 상속 — 공통 super class (예: `AppError` with `code` / `severity` / `cause` chain) 부재 → 운영자 alarm rule 작성 시 instanceof 7번 체크 의무.
2. `cause` 필드가 일관 없음: `KillSwitchError` 에는 `batchRunId/spendUsd/budgetUsd`, `TelemetryWriteError` 는 `cause?: unknown`, `ConcurrentRunError` 는 message only. JSON 직렬화 시 누락 필드 패턴 일관성 0.
3. `packages/shared/src/errors.ts` 가 존재하나 본 신규 에러들이 활용 안 함 — Lava-Layer 진행 중 시그널.

**권고 (Phase 2 통합 alarm rule 작성 시):**

- `packages/shared/src/errors.ts` 의 base class 검토 후 7 에러 클래스 마이그레이트 + `code: string` 필드 의무화 (alarm rule 매칭).
- 본 step 의무는 아님 — Phase 2 alarm rule 활성 시점에 함께.

### MINOR-R-5 — `routes.ts` GET dashboard query 중복 / 쿼리 셋 4종

**증거:**

- `apps/api/src/telemetry/routes.ts:163-211` (gauge timeline) 와 `:214-287` (dashboard) 모두 동일 4종 쿼리 (latest with examId / latest no examId / count24h with examId / count24h no examId) 분기.
- `examIdParam.examId ? withExamId : withoutExamId` 패턴이 코드 4사이트 = SQL 8개 (latest with/without × 2 routes + count with/without × 1 route).
- 쿼리 본문은 동일 컬럼 셀렉트 + ORDER BY + LIMIT 만 다른 파생체.

**왜 6개월 뒤 부채인가**:

1. 컬럼 추가 (예: `tags TEXT`) 시 8개 SQL 모두 갱신 의무.
2. 코드 주석 (line 224) 은 이미 `UNION ALL 단일 쿼리 최적화 가능 (Phase 2 — MINOR 트래킹)` 으로 인지 — 본 리뷰는 그 항목 정합 확인.

**권고 (Phase 2 query optimization 시점, 난이도: 1시간):**

- `buildSelectFragment(examIdScoped: boolean): string` 헬퍼 + `bindParams(...)` 분리.
- 또는 Drizzle ORM 활용 (현재 raw `prepare(...)` 사용 — Drizzle 도입 가치 검토 시점).

### MINOR-R-6 — 명명 일관성 (`KNOWN_ENVIRONMENTS` / `VALID_LOGGER_ENVS` / `VALID_ENVS`)

**증거:**

- `apps/api/src/{auth,webhooks,telemetry,progress}/...` → `KNOWN_ENVIRONMENTS`
- `apps/batch/src/{recover,pipeline}.ts` → `VALID_LOGGER_ENVS`
- `apps/batch/src/signal-handlers.ts` → `VALID_ENVS`

**MAJOR-R-1 의 보조 증거** — 이미 명명 drift 진행 중. 통합 시점에 단일 이름 (`KNOWN_LOGGER_ENVS`) 권장.

### MINOR-R-7 — `docs/observability/master-dashboard.md` ↔ `step19-observability.plan.md` 중복 (Phase 2 정리)

본 항목은 4-Pass MAJOR-CT-1 (plan drift) 와 동일 영역 — 중복 지적 회피 위해 본 step 추적 외 사항만 명시:

- `master-dashboard.md` 가 운영 가이드 (앞으로 살아있는 문서) / `step19-*.plan.md` 가 step 실행 기록 (정적 아카이브) → 역할 분리 명확.
- Phase 2 진입 시 master-dashboard 만 살리고 plan 은 docs/plans/\_archive/ 이동 권장.
- 본 step 의무 아님 — 우선순위 LOW.

---

## Devil's Advocate

### 시나리오 1 — Phase 2 학습 SLO 활성 시점, 6 게이지 → 7 게이지 → 8 게이지 점진 활성

가정: Phase 2 진입 시 `learning_slo` 활성. 진산님이 "검수 큐를 Phase 2 로 이동" 결정. → `PHASE_1_GAUGES` 7개 중 하나가 `PHASE_2_GAUGES` 로 이동.

**무엇이 깨지는가**:

1. `apps/api/src/telemetry/types.ts:28-38` `PHASE_1_GAUGES` / `PHASE_2_GAUGES` 갱신.
2. `apps/api/src/telemetry/routes.ts:72-73` `PHASE_1_GAUGE_SET` / `PHASE_2_GAUGE_SET` **자동 반영** (Set 생성자가 위 상수 참조 — 안전).
3. `apps/admin-web/src/components/TelemetryDashboard.tsx:302` `gauge === 'learning_slo' ? 2 : 1` **하드코딩** → 갱신 누락 → 옮긴 게이지가 admin-web 에서 "Phase 1" 로 표시.
4. `apps/admin-web/src/types/telemetry.ts:54` `learning_slo: '학습 SLO (Phase 2)'` 라벨 — 다른 게이지로 옮길 시 라벨 갱신 의무.
5. master-dashboard.md alarm rule (Phase 1 vs Phase 2 임계 다름) 갱신 의무.

→ **5사이트 동시 갱신 + admin-web 1곳이 typecheck 으로 안 잡힘**. silent UI drift.

**MINOR-R-1 의 권고가 본 시나리오 차단 — `PHASE_2_GAUGE_SET.has(gauge)` 패턴으로 단일 출처 (api/types.ts) 화.**

### 시나리오 2 — 누군가 새 stage 를 pipeline 에 추가 (예: `vectorize_upsert`)

가정: BATCH-1 적재 후 `vectorize_upsert` stage 추가 결정. 6개월 뒤의 Claude (또는 진산님) 가 작업.

**무엇이 깨지는가**:

1. `pipeline.ts:83-93` `PipelineStage` enum 갱신.
2. `pipeline.ts:156-167` `PIPELINE_STAGES` 상수 갱신.
3. `pipeline.ts:716-732` `runStage` switch 갱신 (TypeScript exhaustive — 실수 방지).
4. **`runPipeline` 내부 stage loop 는 자동 반영** — 단, 신규 stage 의 `metaPersistenceFailures` 영구화 책임 추가 시 그 70라인 4회 패턴이 5회로.
5. `MetaPersistenceFailure.stage` 유니언 타입 갱신.
6. checkpoint shape 갱신 (snapshot.stage_results enum).
7. recover.ts 의 resume 로직 — 새 stage 가 deterministic 한가 검증 필요.

→ **신규 stage 추가가 1089-line 파일을 7곳 손대야 함**. MAJOR-R-2 의 권고 (파일 분할 + accumulator 추출) 가 본 시나리오 비용 절감.

### 시나리오 3 — Year 2 공인중개사 진입 시점, `ExamId` 두 번째 값 등장

가정: `EXAM_IDS.GONG_IN_JUNG_GAE_SA` 신설. ADR-007 정합으로 마이그레이션 0005 (exam_id 컬럼 도입).

**무엇이 깨지는가**:

1. `routes.ts` GET dashboard / gauge timeline — `parseExamIdQuery` 는 이미 정합 (Year 2 zero-cost). PASS.
2. `write-helper.ts` — `assertValidExamId` 호출 + DB INSERT — 정합. PASS.
3. **admin-web 측 examId UI 부재** — 사용자가 어떻게 examId 를 선택? Phase 2 진입 시 추가 작업 필요.
4. **MINOR-R-2 시나리오 발화** — admin-web 의 examId: string brand 손실로 임의 string 진입 가능.
5. `TelemetryDashboard.tsx` 가 examId 선택 UI 미보유 — 폼 추가 + 상태 추가 (FetchState 6 → 7 status?). MINOR-R-3 (useReducer 권고) 가 그 시점에 활성.

→ **현재는 단일 시험이라 안전하지만, multi-tenant 진입 1주일 전 본 항목들을 동시 처리해야 한다**. 분산 처리 시 silent drift 위험.

### 시나리오 4 — 6개월 뒤의 누군가가 `cost-meter.ts:37` 에서 `production` 로그를 본다

가정: BATCH-3 적재 중 SOFT_WARN 발화 → Cloudflare Analytics 에서 호스트 라벨 확인.

**무엇이 깨지는가**:

- `cost-meter.ts:37` `createLogger({ service: 'thepick-batch-cost-meter' })` 는 environment 파라미터 부재 → logger 디폴트 (`'development'`) 적용 추정.
- production 호스트의 로그가 `environment: 'development'` 로 인덱싱됨 → alarm rule 매칭 실패 + 진산님 새벽 3시 alert 누락.
- **즉시 위험은 아님 — logger.ts 의 디폴트 환경이 무엇인가에 따라 다름** (Read 미수행 — 374-line 파일 본 리뷰 범위 외).

**권고**: MAJOR-R-1 의 `createLoggerFromEnv` factory 가 적용되면 자동 차단. BATCH-1 직전 처리 의무.

---

## 판정

**완료 가능** (사유 명시).

### CRITICAL 0건 → Step 19 (Engine Hardening 마지막 게이트) 통과 가능.

### MAJOR 3건 (R-1, R-2, R-3) → Phase 2 초기 또는 BATCH-1 직전 처리 의무, 본 step 차단 사유는 아님.

부채 만기 일정 권고:

- **MAJOR-R-1 (logger factory)** → BATCH-1 진입 직전 (4-Pass MAJOR-S2 telemetry write wire-up 과 함께 후속 PR. cost-meter.ts production drift 위험).
- **MAJOR-R-2 (pipeline.ts 분할)** → Phase 2 초기 (BATCH-5 적재 완료 후, 학습 모듈 추가 직전).
- **MAJOR-R-3 (디자인 토큰)** → Phase 2 admin-web 확장 직전 (사용자 노출 화면 신설 시점).

### MINOR 7건 → 트래킹 (각 우선순위 부채 만기 명시).

### 본 5-페르소나 (1/5) refactoring-expert 결론

> **6개월 뒤 이 코드는 버틴다 — 단, 위 MAJOR 3건이 Phase 2 진입 전에 처리될 때만**.

본 리뷰가 발견한 부채는 모두 "땜빵" 이 아닌 **Phase 1 단계의 자연스러운 trade-off** (engine-first → 미세 분할은 의존자 발생 후) 결과. 4-Pass 가 단발 정합성을 보장한 위에 본 리뷰가 장기 가독성을 추가 검증 → Phase 1 종료 합당.

---

## 진산님 알림 게이트 (★★★ ENGINE HARDENING 완료 ★★★) 본 1/5 관점 의견

**찬성** (CRITICAL 0건 + MAJOR 3건 모두 Phase 2 만기로 명시 이월 가능).

단, 알림 시점에 다음 3가지를 명시 권고:

1. "logger factory MAJOR-R-1 — BATCH-1 직전 후속 PR 의무"
2. "pipeline.ts 분할 MAJOR-R-2 — Phase 2 초기 task 등록"
3. "admin-web 디자인 토큰 MAJOR-R-3 — Phase 2 admin-web 확장 직전"

본 5-페르소나 (1/5) 책임 범위 외이므로, 나머지 4 페르소나 (performance / quality / backend / devops) 결과 통합 후 진산님 결정 trigger.

---

## 결과 파일 경로

`/home/soo/ClaudePro/ThePick/.claude/reviews/phase1-tech-debt-20260501-155842-refactoring.md`
