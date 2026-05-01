# Step 19 — Observability v1 + Phase 1 Closeout

---

phase: 1 (closing)
step: engine-hardening-step19
approved_by: 진산 (2026-05-01 — "권고안으로" 옵션 3 컨펌)
risk_level: L3 (DB 스키마 변경 — 0017_engine_telemetry.sql)
scope:

- migrations/0017_engine_telemetry.sql (신규 — append-only fact table)
- apps/api/src/db/schema.ts (engineTelemetry 추가 — Drizzle 타입 동기화)
- apps/api/src/index.ts (telemetry 라우트 등록)
- apps/api/src/telemetry/ (신규 디렉토리 — routes.ts + types.ts + write-helper.ts + **tests**)
- apps/admin-web/src/pages/telemetry/index.astro (신규)
- apps/admin-web/src/components/TelemetryDashboard.tsx (신규 — React Island)
- apps/admin-web/src/types/telemetry.ts (신규)
- apps/batch/src/cost-meter.ts (MINOR-3A 흡수 — 3건 console.\* → logger)
- apps/batch/src/pipeline.ts (MINOR-A1 흡수 — log.child() 패턴 도입)
- apps/batch/src/recover.ts (MINOR-A1 흡수 — log.child() 패턴 도입)
- packages/shared/src/logger.ts (MINOR-4A — 기존 fallback console.\* 정책 명시 — 코드 변경 없음, 주석 강화)
- scripts/verify-engine-contracts.ts (MAJOR-A1 — 마이그레이션 카운트 16 → 17)
- docs/observability/master-dashboard.md (신규 — 8 게이지 + alarm rule)
- docs/quality/master-test-checklist.md (v1 → v2 — Step 19 PASS 증거 + 마이그레이션 카운트 갱신)
- docs/plans/engine-hardening/ROADMAP.md §8 (Step 19 [x])
- .jjokjipge/handoff-session-027.md (신규)
- .claude/reviews/step19-pass12-\*.md / step19-pass34-\*.md / phase1-tech-debt-\*.md / review-\*-step19.md (4-Pass + 5-페르소나 영속화)

---

## 0. Reality Anchor — "이것이 불가능할 이유 3가지"

진산님 명시: "AI가 빠지는 '가능합니다' 환상을 차단하라" (메모리 `feedback_no_granular_decisions` + `/user:anchor` 규율).

### A. 본 step에서 "불가능할 이유" 3가지

1. **admin-web 인증 — 본 step에서 Cloudflare Access 환경 구성 불가능**
   - Cloudflare Access는 Cloudflare Zero Trust 콘솔에서 진산님 본인이 직접 정책 등록 의무 (CLI 부재 / API 토큰 분리)
   - 본 step에서 admin-web `/telemetry` 페이지는 **API 측에서 임시 admin token 헤더 검증**으로 차단 (환경변수 `ADMIN_API_TOKEN`)
   - Phase 2 또는 진산님 직접 Access 설정 후 token 헤더 검증 제거 (별도 ADR)
   - **불가능 결론: Access 정책 자동 등록 불가능 → admin token 임시 게이트 채택**

2. **engine_telemetry append-only 강제 — Temporal Graph 트리거 추가는 의무이나 SQLite 한계**
   - Drizzle 정책 (NC-1): drizzle-kit 사용 금지, 수동 SQL 마이그레이션 의무
   - SQLite는 ALTER COLUMN을 부분 지원 (DROP COLUMN 미지원, RENAME만 가능). engine_telemetry는 신규 테이블이라 이 제약은 회피.
   - UPDATE 차단 트리거는 0014 패턴(prevent\_\*\_update) 따라 신설 의무. 단, engine_telemetry는 시계열 fact라 UPDATE 자체가 의미 없음 — 트리거로 차단할 가치 vs 비용 평가 의무
   - **불가능 결론: UPDATE 트리거는 추가 (defense-in-depth, 0.1ms cost), append-only 보증**

3. **Phase 1: 7 게이지 / Phase 2: 8 게이지 — 본 step은 7만 활성**
   - 메모리 `project_engine_observability` 명시: "8 게이지 (BATCH 진척/Cost/D1 SLO/Graph/품질/Formula/Reviewer/학습)"
   - Phase 1 시점에는 학습 SLO 게이지 (사용자 학습 흐름 측정) 활성 불가능 — Phase 1 후반 사용자 노출 후 본격 데이터 흐름 시작
   - **불가능 결론: Phase 1 = 7 게이지 (학습 SLO 제외) / Phase 2 = 8 게이지로 단계화. master-dashboard.md 명시**

### B. 본 step에서 명시 회피 항목 (능동 deferred)

- **Workers Analytics Engine 통합** — Phase 2 (성능 카테고리 활성 시점, master-test-checklist Cat 5)
- **Cron Trigger 자동 telemetry 집계** — Phase 1 후반 (Reviewer 큐 활성 후)
- **engine_telemetry GC 정책** — Phase 2 (1년 보존 vs 영구). 본 step에서는 무제한 보존 + 인덱스 최소화

### C. 진산님 통제 영역 (Claude 비개입, 메모리 `feedback_focus_reliability_not_schedule` 정합)

- ADMIN_API_TOKEN 값 결정·발급 — 진산님 본인 환경변수 등록 의무
- Cloudflare Access 정책 등록 — 진산님 본인 콘솔 작업
- engine_telemetry 1년 후 GC 결정 — Phase 2 별도 plan

---

## 1. 목적

ROADMAP §8 라인 510 "Engine Observability 8 게이지 가동" + 진산님 메모리 `project_engine_observability` ("자동차 계기판 메타포 — 자동차 운전하듯이 BATCH 적재 진척, Cost, D1 SLO, Graph 무결성, 품질 게이트, Formula 정확도, Reviewer 큐, 학습 SLO 8 게이지 상시 모니터링/로그") 충족.

본 step 종료 시점이 **Phase 1 종료 + ROADMAP §8 모든 항목 PASS**이며, 채팅 응답 헤드 `★★★ ENGINE HARDENING 완료 ★★★` 표기 + BATCH-1 진입 트리거 대기 단계.

---

## 2. Engine-First 분석 — 별도 패키지 신설 여부

`/user:engine` Engine-First Doctrine 검토:

| 검토 항목                        | 결론                                             |
| :------------------------------- | :----------------------------------------------- |
| 의존 모듈 수                     | apps/batch + apps/api + apps/admin-web (3 모듈)  |
| 입력 형태                        | TelemetryEvent 일관 구조                         |
| 출력 형태                        | D1 INSERT + 집계 read 쿼리                       |
| 별도 패키지 신설 가치            | **낮음** — Hono route + write helper로 충분      |
| 결정                             | apps/api/src/telemetry/ 단일 위치 + 인터페이스만 |
| Year 2 별도 패키지화 트리거 기준 | engine_telemetry 클라이언트 ≥ 5개 또는 SDK 의무  |

**결론**: 신규 패키지 신설 불필요. apps/api/src/telemetry/ 단일 위치 + apps/batch ↔ apps/api HTTP 통신 + apps/admin-web ↔ apps/api HTTP 통신.

---

## 3. 데이터 모델 — engine_telemetry

### 3.1 테이블 스키마 (단일 fact table + JSON metric — 진산님 권고 B)

```sql
CREATE TABLE engine_telemetry (
  id TEXT PRIMARY KEY,                    -- UUID v4 (Workers crypto.randomUUID)
  exam_id TEXT NOT NULL,                  -- Hard Rule 16/17 zero-cost Year 2 정합 (NOT NULL)
  gauge_name TEXT NOT NULL,               -- 8 게이지 enum: 'batch_progress' | 'cost' | 'd1_slo' | 'graph_integrity' | 'quality_gate' | 'formula_accuracy' | 'reviewer_queue' | 'learning_slo'
  metric_value REAL,                      -- 단일 numeric 값 (NULL 가능 — boolean 게이지 시)
  metric_json TEXT,                       -- 부가 컨텍스트 JSON (예: {soft, hard, kill, current_micro_cents}). NULL 가능.
  source_id TEXT,                         -- 추적성: batch_run_id 또는 'cron-{ts}' 또는 'manual-{userId}'
  batch_run_id TEXT,                      -- BATCH 적재 컨텍스트. NULL 허용 (BATCH 외 게이지)
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (gauge_name IN (
    'batch_progress', 'cost', 'd1_slo', 'graph_integrity',
    'quality_gate', 'formula_accuracy', 'reviewer_queue', 'learning_slo'
  )),
  CHECK (metric_value IS NOT NULL OR metric_json IS NOT NULL)
);

CREATE INDEX idx_engine_telemetry_gauge_recorded
  ON engine_telemetry(gauge_name, recorded_at DESC);

CREATE INDEX idx_engine_telemetry_exam_gauge
  ON engine_telemetry(exam_id, gauge_name, recorded_at DESC);

CREATE INDEX idx_engine_telemetry_batch_run
  ON engine_telemetry(batch_run_id)
  WHERE batch_run_id IS NOT NULL;

-- defense-in-depth: UPDATE/DELETE 차단 (append-only 보증)
CREATE TRIGGER prevent_engine_telemetry_update
BEFORE UPDATE ON engine_telemetry
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on engine_telemetry is forbidden (append-only fact table). Use INSERT for new readings.');
END;

CREATE TRIGGER prevent_engine_telemetry_delete
BEFORE DELETE ON engine_telemetry
BEGIN
  SELECT RAISE(ABORT, 'DELETE on engine_telemetry is forbidden (append-only fact table). Phase 2 GC plan only via wrangler d1 execute manual override.');
END;
```

### 3.2 8 게이지 enum + Phase 활성

|  #  | gauge_name         | Phase | metric_value 의미                  | metric_json 예시                                             |
| :-: | :----------------- | :---: | :--------------------------------- | :----------------------------------------------------------- |
|  1  | `batch_progress`   |   1   | 0~1 (적재 비율)                    | `{stages_done, stages_total, current_stage}`                 |
|  2  | `cost`             |   1   | micro_cents                        | `{soft, hard, kill, status, calls_made}`                     |
|  3  | `d1_slo`           |   1   | latency_ms (p95)                   | `{query_count, error_count, table}`                          |
|  4  | `graph_integrity`  |   1   | violations_count (≥ 0)             | `{orphan_nodes, broken_edges, supersedes_cycles}`            |
|  5  | `quality_gate`     |   1   | pass_count                         | `{cat1, cat2, cat3, cat4, cat5, cat6, cat7, cat8}`           |
|  6  | `formula_accuracy` |   1   | 1.0 (PASS) / 0.0 (FAIL)            | `{tests_total, tests_failed, packages: ['formula-engine']}`  |
|  7  | `reviewer_queue`   |   1   | queue_size                         | `{draft, review, approved, days_oldest_draft}`               |
|  8  | `learning_slo`     | **2** | sessions_per_user_p95 (Phase 2 만) | `{active_users, retention_d7, retention_d30}` (Phase 2 활성) |

**Phase 1 종료 시점 (Step 19) 필수 게이지: 1~7 (7개)**. 게이지 8은 admin-web에 placeholder 표시 + Phase 2 활성 명시.

---

## 4. API 설계 — apps/api/src/telemetry/

### 4.1 POST /api/telemetry (write — engine 측이 호출)

```typescript
// 요청 body (Zod 검증)
interface TelemetryEventPayload {
  examId: ExamId; // EXAM_IDS.SON_HAE_PYEONG_GA_SA — Hard Rule 17 정합
  gaugeName: GaugeName; // 8 enum
  metricValue?: number; // null 가능 (boolean 게이지)
  metricJson?: Record<string, unknown>; // 부가 컨텍스트
  sourceId?: string;
  batchRunId?: string;
}

// 인증: ADMIN_API_TOKEN 헤더 (X-Admin-Token) — Phase 1 임시
// 응답: { id: string (UUID), recordedAt: string (ISO8601) }
```

### 4.2 GET /api/telemetry/gauges/:gaugeName (read — admin-web 측이 호출)

```typescript
// 쿼리: ?examId=...&limit=100&since=ISO8601
// 응답: { events: TelemetryEvent[], aggregate: { p50, p95, count, last } }
// 인증: ADMIN_API_TOKEN 헤더 (Phase 1)
```

### 4.3 GET /api/telemetry/dashboard (read — admin-web 메인)

```typescript
// 응답: { gauges: Record<GaugeName, GaugeSnapshot> }
//   GaugeSnapshot = { latest: TelemetryEvent | null, count_24h: number, status: 'ok' | 'warn' | 'critical' }
// 인증: ADMIN_API_TOKEN 헤더 (Phase 1)
```

---

## 5. admin-web 페이지 — /telemetry

### 5.1 라우트

- `apps/admin-web/src/pages/telemetry/index.astro` — Astro 셸 + 헤더
- `apps/admin-web/src/components/TelemetryDashboard.tsx` — React Island (`client:only`)
- `apps/admin-web/src/types/telemetry.ts` — TypeScript 타입 (TelemetryEvent / GaugeSnapshot)

### 5.2 UI 구조

- 7 카드 (gauge 별) — gauge_name + metric_value + metric_json 핵심 + 최근 5건 timeline
- 학습 SLO 게이지 (8번) — placeholder "Phase 2 활성 예정"
- 전체 새로고침 버튼 + 30초 자동 폴링 (admin-web 사용자 = 진산님 단일)
- 인증 입력란 — ADMIN_API_TOKEN localStorage 보관 (Phase 1 임시)

### 5.3 인증 (Phase 1 임시 게이트)

- `localStorage.getItem('admin_api_token')` → 모든 fetch에 `X-Admin-Token` 헤더 추가
- 토큰 부재 시 입력 폼 표시
- 401 응답 시 토큰 무효화 + 입력 폼 재표시
- **Phase 2 전환 트리거**: Cloudflare Access 정책 등록 후 별도 ADR + 본 게이트 제거

---

## 6. 마이그레이션 0017 SQL 초안

`migrations/0017_engine_telemetry.sql` — §3.1 블록 그대로 + 0014 트리거 화이트리스트 갱신 의무 (engine_telemetry는 Hard Rule 1 대상 아님).

`scripts/verify-engine-contracts.ts:341` 마이그레이션 카운트 16 → 17 갱신 (MAJOR-A1 게이트).

---

## 7. apps/batch 흡수 (MINOR-3A + MINOR-A1)

### 7.1 cost-meter.ts (MINOR-3A — 3건 console.\* 잔존)

라인 415, 426, 437 — `console.warn` / `console.error` → `costMeterLog.warn` / `costMeterLog.error`.

```typescript
import { createLogger } from '@thepick/shared';

const costMeterLog = createLogger({ service: 'thepick-batch-cost-meter' });
```

### 7.2 pipeline.ts + recover.ts (MINOR-A1 — log.child 패턴)

기존 inline context 매 호출 → 모듈 진입점에서 `pipelineLog.child({ batchRunId, examId })` 1회 생성 후 재사용.

---

## 8. master-dashboard.md (신규)

`docs/observability/master-dashboard.md` — 8 게이지 사양 + alarm rule + Phase 단계화 + Cloudflare Workers Analytics 통합 시점 명시.

---

## 9. Hard Rules 정합 검증

| Hard Rule        | 검증                                                                                   |
| :--------------- | :------------------------------------------------------------------------------------- |
| Rule 15 (분기)   | engine_telemetry 본문에 시험 분기 0건 — 단일 fact table 구조                           |
| Rule 16 (시그)   | telemetry write/read API 모두 examId 첫 인자                                           |
| Rule 17 (리터럴) | EXAM_IDS 경유 — verify-engine-contracts.ts 회귀 0건                                    |
| Hard Limit       | 동적 코드 실행 0건 / API 키 노출 0건 / Constants 직접 수정 0건 (engine_telemetry 무관) |
| Temporal Graph   | engine_telemetry 자체 append-only — UPDATE/DELETE 트리거 차단                          |

---

## 10. 테스트 계획

### 10.1 신규 단위 테스트

- `apps/api/src/telemetry/__tests__/routes.test.ts` — POST 인증 / Zod 검증 / 동시성 / examId 검증
- `apps/api/src/telemetry/__tests__/write-helper.test.ts` — D1 INSERT 결정성 + UUID 충돌 가드
- `apps/api/src/telemetry/__tests__/dashboard-aggregate.test.ts` — GET /dashboard p50/p95 집계 정확도

### 10.2 e2e (별도 파일)

- 8 게이지 INSERT → SELECT 라운드트립 (1~7 + Phase 2 placeholder)
- UPDATE 시도 → 트리거 RAISE(ABORT) (boolean PASS)
- DELETE 시도 → 트리거 RAISE(ABORT) (boolean PASS)
- ADMIN_API_TOKEN 부재 시 401
- examId 위반 시 SF-M-2 cross-tenant 가드 발화

### 10.3 회귀

- @thepick/api 199 → 199+ 신규
- 909 합계 → 909+ 신규 (정확 카운트는 Step 19 종료 시점 갱신)
- typecheck (15 pkg) PASS

---

## 11. Binary Gates

| Gate ID | 입력                                                    | 출력                                           | 통과 기준                |
| :------ | :------------------------------------------------------ | :--------------------------------------------- | :----------------------- |
| G19-1   | `wrangler d1 migrations apply 0017`                     | engine_telemetry 테이블 + 3 인덱스 + 2 트리거  | exit 0 + tables 1추가    |
| G19-2   | `pnpm tsx scripts/verify-engine-contracts.ts`           | overallStatus=PASS + migrationCount=17         | exit 0                   |
| G19-3   | `pnpm --filter @thepick/api test`                       | 199+신규 PASS                                  | failed = 0               |
| G19-4   | `pnpm --filter @thepick/batch test`                     | 236 PASS (cost-meter logger 회귀 0건)          | failed = 0               |
| G19-5   | `pnpm typecheck` (모노레포)                             | 15 pkg PASS                                    | exit 0                   |
| G19-6   | `pnpm --filter @thepick/admin-web build`                | static build 성공                              | exit 0                   |
| G19-7   | 4-Pass 독립 에이전트 2개 병렬                           | CRITICAL 0 + MAJOR 즉시 흡수                   | 영속 .claude/reviews/    |
| G19-8   | 5-페르소나 독립 에이전트 5개 병렬                       | CRITICAL 0 (cap=3회 반복)                      | phase1-tech-debt-\*.md   |
| G19-9   | master-test-checklist v2 갱신 + 모든 카테고리 PASS 증거 | 6/8 카테고리 PASS 명시 (Cat 5/8 deferred 명시) | 진산님 검수 + ROADMAP §8 |
| G19-10  | ROADMAP §8 line 497~512 모든 [ ] → [x]                  | ★★★ ENGINE HARDENING 완료 ★★★ + handoff-027    | 채팅 응답 헤드 표기      |

**모든 G19-\* PASS = Step 19 완료 = ROADMAP 100% = BATCH-1 진입 트리거 대기.**

---

## 12. 이월 부채 흡수 매핑

handoff-026 §2.3 13건 중 본 step 흡수 7건 + Phase 2 트래킹 6건:

### 본 step 흡수 (7건)

| ID       | 처리                                                                           |
| :------- | :----------------------------------------------------------------------------- |
| R-2      | master-dashboard.md + admin-web /telemetry + 0017 마이그레이션                 |
| MIGR-17  | 0017 마이그레이션 + verify-engine-contracts.ts:341 카운트 갱신                 |
| MAJOR-A1 | verify-engine-contracts.ts 카운트 17 + master-test-checklist §6.2 동기         |
| MINOR-A1 | logger.child() 패턴 — pipeline.ts + recover.ts                                 |
| MINOR-A2 | cross-tenant cause 라우팅 alarm rule — master-dashboard.md §"Alarm Rules"      |
| MINOR-3A | cost-meter.ts 3건 console.\* → logger                                          |
| MINOR-4A | logger.ts fallback console.\* — verify scope 4 파일 한정 (logger.ts 자연 제외) |

### Phase 2 명시 트래킹 (6건)

| ID       | 사유                                                |
| :------- | :-------------------------------------------------- |
| MINOR-S1 | filterGrepLines 인라인 주석 false-positive (verify) |
| MINOR-S2 | vitest stdout 다중 JSON 파싱 — `--outputFile` 전환  |
| MINOR-S3 | execFileSync maxBuffer 64MB 한도                    |
| MINOR-S4 | NumericMetric cause 필드 부가                       |
| MINOR-A3 | createLogger.fromEnv() factory                      |
| MINOR-A4 | checkpoint exam_id legacy path (ADR-007 Year 2)     |

---

## 13. 진행 순서 (commit 단위)

1. **[plan] 본 plan + Reality Anchor 영속화 (커밋 1)**
2. **[migration] 0017_engine_telemetry.sql + Drizzle 동기화 + verify-engine-contracts.ts:341 카운트 17 (커밋 2)**
3. **[api] apps/api/src/telemetry/ 신규 + 테스트 + 라우트 등록 (커밋 3)**
4. **[admin-web] /telemetry 페이지 + TelemetryDashboard.tsx + types (커밋 4)**
5. **[batch] cost-meter.ts MINOR-3A + pipeline/recover MINOR-A1 (커밋 5)**
6. **[docs] master-dashboard.md + master-test-checklist v2 (커밋 6)**
7. **[review] 4-Pass + 5-페르소나 영속화 (커밋 7)**
8. **[roadmap] ROADMAP §8 [x] + handoff-027 (커밋 8 — 완료 알림 동시)**

---

## 14. Step 19 완료 = Phase 1 종료 = ★★★ ENGINE HARDENING 완료 ★★★

진산님 메모리 `project_completion_notification_obligation` 정합:

- ROADMAP §8 line 497~512 모든 [x]
- 채팅 응답 헤드 `★★★ ENGINE HARDENING 완료 ★★★` 표기
- 종합 테스트 PASS 증거 명시
- BATCH-1 진입 트리거 ("BATCH-1 적재 진입") 대기 안내
- handoff-session-027.md — 차세션은 BATCH-1 진입 또는 Phase 2 plan 진입

---

**작성자:** Claude (Opus 4.7 1M context) — 진산님 2026-05-01 "권고안으로" 컨펌 후 자율 진행
**승인:** 진산님 옵션 3 (4 갈림길 권고 모두 채택, BATCH-1 진입 트리거까지)
**risk_level:** L3 (DB 스키마)
**예상 commit 수:** 8건
**예상 시간:** 1.5d (현실)
