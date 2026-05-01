# Phase 1 종료 5-페르소나 (4/5) — backend-architect

**작성일**: 2026-05-01
**리뷰 범위**: Step 19 신규 (engine_telemetry) + Phase 1 누적 (마이그레이션 17건 / API 4 라우트군 / batch_runs 어댑터 / ExamAdapter shim)
**리뷰 방식**: 독립 에이전트 (backend-architect 페르소나) — Step 19 4-Pass 결과 전달, 6 MAJOR 중복 지적 회피
**4-Pass 사전 흡수 (지적 금지)**: MAJOR-S1, MAJOR-S2(트래킹), MAJOR-A1, MAJOR-A2, MAJOR-AD-1, MAJOR-CT-1

## 핵심 질문

**"2년차에 뭐가 아플까?"**

본 리뷰는 4-Pass 가 코드 정합성/Silent Failure 관점이었던 것과 달리 **데이터 모델 진화성 + API 진화성 + Hard Rule 16/17 zero-cost 약속의 실효성 + Year 2 multi-tenant 진입 비용** 4축에서 본다.

---

## CRITICAL (Phase 1 종료 차단 사유) — 0건

증거: 본 리뷰는 데이터 모델 / API 계약의 "치명적 진화 차단" 결함을 찾았으나, **모든 후보가 Year 2 Phase 4 작업 범위로 ADR-007 §"Year 2 이전 대상으로 고정" 정책에 명시 이월되어 있어 Phase 1 종료 차단 요건 부재**. 아래 PASS 증거 7건으로 0건을 확정.

### PASS 증거 (확인한 항목)

1. **engine_telemetry exam_id NOT NULL 채택** — `migrations/0017_engine_telemetry.sql:59` `exam_id TEXT NOT NULL`. 신설 테이블이라 처음부터 컬럼 보유. Hard Rule 16 "Year 2 (exam_id 컬럼 도입 후) → 변경 불필요" 약속을 본 테이블만큼은 이미 0-cost 만족. 마이그레이션 0005 도입 시점에 본 테이블은 **추가 작업 0**.
2. **rowToEvent metricJson 타입 가드** — `apps/api/src/telemetry/routes.ts:79-87` `JSON.parse` 후 `typeof === 'object' && !Array.isArray` 검증 + 실패 시 `null` 마스크. JSON corruption 침투 시 UI 깨짐 0. 4-Pass 가 다루지 않은 데이터 sanitization 경로.
3. **D1BatchRunsDb 모든 메서드 첫 인자 examId** — `apps/batch/src/d1-batch-runs-db.ts:35,46,73`. `selectByRunId(examId, batchRunId)`, `insertNewRun(examId, ...)`, `updateState(examId, batchRunId, ...)`. Year 2 Phase 4 진입 시 본 파일 내부에 `AND exam_id = ?` 1줄 추가만으로 호출 측 0 변경 — Hard Rule 16 zero-cost 약속 실증.
4. **EXAM_IDS 단일 선언처** — `packages/shared/src/constants/exam-ids.ts:14-17` 단 1개 리터럴. `assertValidExamId` 외부 진입점 strict 차단 + brand type `ExamId` 컴파일 보호. Hard Rule 17 정합. `grep` 결과 런타임 리터럴 위반 0건 (출력: `DEFAULT_EXAM_ID` + `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 사용 3개소만).
5. **append-only 트리거 12개 + 신규 2개** — `migrations/0017:111-123` `prevent_engine_telemetry_update/delete` + 기존 `prevent_nodes_update`, `prevent_status_transitions_update/delete`, sessions `enforce_sessions_immutable_*`, webhook_events `enforce_webhook_events_status_transition`. Temporal Graph + audit log 모두 application-level 우회 차단.
6. **CORS allowHeaders X-Admin-Token 명시** — `apps/api/src/index.ts:84-87` `/api/telemetry/*` 만 별도 CORS 옵션. 4-Pass MAJOR-AD-1 흡수 정합. 일반 보호 라우트(`/api/auth`, `/api/progress`)와 헤더 분리 (admin token 노출 surface 최소화).
7. **FK ON DELETE CASCADE 정책** — `migrations/0009_sessions.sql:30` `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`. user 삭제 시 session 자동 정리 (orphan 0). user_progress / mnemonic_cards 는 FK 미설정 — 의도적(Temporal Graph 보존). GDPR 분리 처리 ADR 의무 (MAJOR-B6).

### Devil's Advocate (CRITICAL 가능 시나리오 1개)

**시나리오**: Year 2 진입 시점에 `exams` 테이블 도입 PR 에서 `engine_telemetry.exam_id` 가 신규 `exams.id` FK 를 참조하지 못하는 구조. Year 1 의 `exam_id TEXT NOT NULL` 은 string 검증만 — Year 2 `exams` 테이블 신설 후에도 본 컬럼은 FK 부재로 dangling row 가능. **반증**: ADR-007 + Hard Rule 16 §"Year 2 마이그레이션 0005" 명시. Year 2 Phase 4 마이그레이션이 `ALTER TABLE engine_telemetry ADD CONSTRAINT fk_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id)` 를 1회 추가하면 zero-cost. **본 step 미흡수 = CRITICAL 아님** (Year 1 단일 시험 작동 + Year 2 1줄 ALTER 가능).

---

## MAJOR (2년차 운영 시 아플 곳) — 6건

### MAJOR-B1 — engine_telemetry CHECK enum 8개 하드코딩 → 신규 게이지 추가 시 마이그레이션 의무 + 코드 3곳 동시 갱신

**증거**:

- `migrations/0017_engine_telemetry.sql:66-75` `CHECK (gauge_name IN ('batch_progress', ..., 'learning_slo'))`
- `apps/api/src/db/schema.ts:587-596` `ENGINE_TELEMETRY_GAUGES` 8개 배열
- `apps/api/src/telemetry/types.ts:14-23` 동일 8개
- `apps/admin-web/src/types/telemetry.ts:9-18` 동일 8개 (mirror)

게이지 신규 추가 시 (예: `vectorize_health` Phase 3) **4곳 동시 수정 + 마이그레이션 1건 의무**:

1. `migrations/0018_*.sql` — `ALTER TABLE` 으로 CHECK 변경 불가 → 신규 테이블 + INSERT SELECT + DROP + RENAME 패턴 (D1 SQLite 제약).
2. schema.ts enum 배열
3. types.ts enum + `PHASE_*_GAUGES` 분류
4. admin-web types.ts mirror + `GAUGE_LABELS` + `STATUS_COLORS`

**Year 2 영향**: ADR-007 multi-exam 전환 시 시험별 게이지가 다를 가능성 (예: 공인중개사 `formula_accuracy` 부재). 본 enum 은 시험 무관 통합 — Year 2 시점에 게이지 분류를 examId 별 적용으로 재설계 필요 (MINOR-B1 후속).

**권고**:

- Year 1 트래킹 — TD-Engine-Telemetry-Schema-Evolution: SQLite CHECK 제약 변경 패턴 ADR 작성 (Phase 2 BATCH-1 진입 직전).
- Year 2 진입 시 examId 별 게이지 enum 분리 검토 (별도 ADR).

---

### MAJOR-B2 — metric_json TEXT 필드 게이지별 shape 검증 부재 → admin-web UI 깨짐 잠재

**증거**:

- `apps/api/src/telemetry/types.ts:50` `metricJson: z.record(z.string(), z.unknown()).optional()` — 게이지 무관 generic record. 게이지별 expected shape (`batch_progress: { ratio: number, total: number }` 등) 미강제.
- `apps/api/src/telemetry/write-helper.ts:54-63` JSON.stringify + 64KB 상한만 — 구조 검증 0.
- `migrations/0017_engine_telemetry.sql:62` `metric_json TEXT` — DB 측 SQL CHECK 부재 (TEXT 임의).

**2년차 시나리오**: BATCH-3 진입 시 cost-meter 가 새 필드 (`tokenBreakdown: { input, output, cache }`) 추가 → write 통과 → admin-web 이 `latest.metricJson?.tokensUsed` 만 읽어 화면 break (NaN 표시). Phase 1 시점 `evaluateStatus` 함수 단순 평가라 admin-web 측 shape 의존 면적 좁음 — 그러나 Phase 2 alarm rule 활성 시 본 shape 검증 부재가 **alarm false-positive/negative 직접 원인**.

**권고**:

- types.ts 에 `gaugeName` discriminated union 으로 metric_json shape 강제 (예: `{ gaugeName: 'cost', metricJson: CostMetricSchema }`).
- write-helper.ts 가 `gaugeName` 별 추가 Zod 분기 검증 (Defense-in-depth — DB CHECK 추가는 SQLite 제약상 불가).
- Phase 2 alarm rule 도입 step 의 진입 차단 게이트로 명시.

---

### MAJOR-B3 — telemetry write integration 0건 (8 게이지 모두 no_data) → Engine Observability "가동" 상태 의미 약화

**증거**:

- `grep -rn "engineTelemetry\|writeTelemetryEvent\|engine_telemetry" apps/batch/src/` → **출력 0건**.
- `apps/batch/src/cost-meter.ts:1-40` cost meter 가 telemetry POST 호출 부재 (logger 만).
- `apps/batch/src/pipeline.ts` BATCH 진척 telemetry POST 호출 부재.
- 4-Pass MAJOR-S2 명시 (BATCH-1 진입 직전 PR 의무 트래킹).

**2년차 시나리오**: BATCH-1~5 적재 완료 시점에 admin-web 8 게이지 모두 `no_data` 상태 → 운영자가 "Observability 가동 = false" 인식 → "마이그레이션은 적용됐는데 왜 데이터가 없나?" 디버깅 시간 낭비. 4-Pass 에서 트래킹 명시했으나 **본 step 종료 시점에 실측 가동 0**.

**중복 지적 방지 메모**: MAJOR-S2 와 동일 이슈이나, 4-Pass 는 Silent Failure 관점에서 본 데이터 흐름 단절을, 본 리뷰는 **"Engine Observability 가동" = ROADMAP §8 line 510 충족 정의의 명확성 부족** 데이터 모델 관점에서 본다.

**권고**:

- ROADMAP §8 line 510 갱신 시 "8 게이지 가동 = 마이그레이션 + 엔드포인트 가동(현재) **vs** 실측 데이터 stream(BATCH-1 진입 직전)" 2단계 정의 명시.
- BATCH-1 진입 게이트에 "telemetry write wire-up E2E 1건 PASS" 추가.

---

### MAJOR-B4 — GET /api/telemetry/dashboard N+1 쿼리 (8 게이지 × 2 라운드트립 = 16 prepared statement) → Year 2 multi-tenant 시 ×N 시험 비례 폭발

**증거**:

- `apps/api/src/telemetry/routes.ts:226-265` `for (const gauge of ENGINE_TELEMETRY_GAUGES)` 루프 — 게이지당 `latestRow` + `countRow` = 2 D1 prepared statement.
- 주석 `routes.ts:222-224` "16 sequential D1 prepared statement (Workers CPU < 50ms 가정). 향후 UNION ALL 단일 쿼리 최적화 가능 (Phase 2 — MINOR 트래킹)".

**2년차 시나리오**: Year 2 multi-tenant 진입 + 운영자가 시험 5개 한 화면 비교 (`?examId=` 5번 호출 = 80 prepared statement). Workers CPU 시간 50ms free tier 한계 초과 가능. Phase 2 Anthropic Console cap (메모리 `project_anthropic_cap_pre_install`) 의 monthly $200 cap 과는 무관하나 **Cloudflare Workers 측 CPU time 초과 = 503**.

**권고**:

- Phase 2 진입 직전 단일 UNION ALL 쿼리 변환:
  ```sql
  WITH latest AS (
    SELECT gauge_name, ... FROM engine_telemetry WHERE (gauge_name, recorded_at) IN
    (SELECT gauge_name, MAX(recorded_at) FROM engine_telemetry GROUP BY gauge_name)
  )
  SELECT g.gauge_name, l.*, c.count_24h FROM (VALUES (...)) g
  LEFT JOIN latest l ... LEFT JOIN counts c ...
  ```
- 또는 Cloudflare KV 5-min cache layer (Workers `caches.default` API).

---

### MAJOR-B5 — API 버저닝 부재 (`/api/telemetry`, `/api/auth`, `/api/progress`) → 2년차 breaking change 발생 시 client 동시 깨짐

**증거**:

- `apps/api/src/index.ts:116-119` `app.route('/api/auth', ...)`, `app.route('/api/telemetry', ...)` — `/v1` prefix 부재.
- `apps/api/src/telemetry/routes.ts:122` POST `/` (router 내부) → 외부 노출 `POST /api/telemetry`.

**2년차 시나리오**: Year 2 multi-tenant 진입 시 `GET /api/telemetry/dashboard` 응답 shape 변경 (시험별 그룹핑) → admin-web 클라이언트와 batch CLI 모두 동시 갱신 의무. 단계적 마이그레이션 불가 → blue/green 배포 시 `/v1` 와 `/v2` 병존 패턴 부재.

**권고**:

- Phase 2 진입 직전 Hono router prefix 변경: `app.route('/api/v1/telemetry', ...)` + `/api/telemetry` (deprecated alias) 12개월 유지 ADR 작성.
- 본 step 시점 흡수 시 admin-web fetch URL 일괄 갱신 의무 — Phase 2 진입 게이트 작업으로 트래킹.

---

### MAJOR-B6 — GDPR/PIPA right-to-erasure ↔ Temporal Graph SUPERSEDES 충돌 ADR 부재

**증거**:

- 메모리 `project_launch_legal_bundle_deferred` — 법무는 런칭 직전 일괄 처리 명시.
- `migrations/0001_initial_schema.sql:64` `node_id TEXT REFERENCES knowledge_nodes(id)` — `user_progress.node_id` FK 만, `user_progress.user_id` FK 부재 (`migrations/0001:67-92` 영역 + 0006 users 테이블 신설 시 `user_progress` 미수정).
- `migrations/0009_sessions.sql:30` sessions 만 `ON DELETE CASCADE`. user_progress 는 직접 FK 부재 → 사용자 삭제 시 orphan row 유지 가능.
- `users.status = 'deleted'` enum 존재 (`schema.ts:92`) — soft-delete 패턴.
- knowledge_nodes/formulas/constants 는 UPDATE 차단 (Hard Rule 1 Temporal Graph) — user_progress 에 PII 흔적 (정답 패턴, 학습 시간) 잔존 시 삭제 불가 가능성.

**2년차 시나리오**: KISA PIPA 또는 EU GDPR 사용자 삭제 요청 → user_progress 삭제 의무 → SUPERSEDES 패턴 위반 (정답 패턴 자체는 Temporal 보존이 PII 마스킹 후 가능) → 법무 컴플라이언스 위반 위험.

**권고**:

- 법무 일괄 처리 시점 ADR-026 신설: `right-to-erasure-vs-temporal-graph` — user_progress.user_id 익명화(IP_PEPPER 와 별도 USER_PEPPER + SHA-256 hash로 Year 2 마이그레이션) + sessions/users CASCADE + Phase 2 user_progress.user_id FK 추가 + revocation 후 mnemonic_cards 정합 점검.
- 메모리 정합 — 본 항목은 "Phase 2 법무 일괄 처리 직전 의무" 트래킹 (Phase 1 종료 차단 아님).

---

## MINOR — 4건

### MINOR-B1 — Year 2 zero-cost 약속의 검증 자동화 부재

- **증거**: Hard Rule 16 §"Year 2 (exam_id 컬럼 도입 후, 마이그레이션 0005 이후) → 호출 측 변경 불필요" 약속이 코드 grep 으로만 검증. CI 자동 검증 없음.
- **권고**: `tools/verify-engine-contracts.ts` (Step 18) 에 `assert-batch-runs-db-examid-first-arg` 룰 추가 — TS AST 파서로 `BatchRunsDb` 인터페이스 메서드 첫 인자 `examId: ExamId` 강제.

### MINOR-B2 — admin-web telemetry types.ts mirror 자동 동기화 부재

- **증거**: `apps/admin-web/src/types/telemetry.ts:1-7` 주석 "별도 패키지화 회피 (Engine-First 분석 §2): 의존 모듈 3개 미만이라 인터페이스 동기화는 수동 검증". 실제로는 enum 8개 + interface 3개 mirror — 한쪽만 갱신 시 typecheck 통과 (`examId: string` 으로 brand 누락 — `apps/admin-web/src/types/telemetry.ts:24`).
- **권고**: Phase 2 BATCH-1 진입 직전 Engine-First 트리거 임계 4 모듈 도달 시 `packages/telemetry-types` 단독 패키지화. 그 전까지 `tools/verify-engine-contracts.ts` 에 mirror diff 검증 추가.

### MINOR-B3 — engine_telemetry retention 정책 1년 vs SQLite GC 미구현

- **증거**: `migrations/0017_engine_telemetry.sql:50-54` 주석 "engine_telemetry: 1년 보존 (Phase 2 Cron GC 정책, master-dashboard.md §3)". 현재 Cron Trigger 부재 (`apps/api/src/index.ts:153` `CRON_GC_DAILY` 는 rate_limits 만).
- **권고**: Phase 2 Cron Trigger 확장 — `purgeOldRateLimits` 와 동일 시각에 `purgeOldEngineTelemetry` 호출. 트리거 일시 비활성 (DROP TRIGGER → INSERT GC → CREATE TRIGGER) 패턴 ADR 작성.

### MINOR-B4 — request_id correlation 미적용

- **증거**: `grep -rn "request_id\|X-Request-Id\|requestId" apps/api/src/` → 출력 0건. Hono context 의 `c.req.header('X-Request-Id')` 또는 자체 `crypto.randomUUID()` 주입 부재.
- **2년차 시나리오**: 운영 디버깅 시 admin-web `/telemetry` 요청 → `/api/telemetry/dashboard` D1 쿼리 → `engine_telemetry` row 인 cross-layer trace 불가. logger.child(`{ requestId }`) 미적용 → wrangler tail 에서 동시 요청 구분 불가.
- **권고**: Phase 2 진입 직전 Hono middleware 추가:
  ```typescript
  app.use('*', async (c, next) => {
    const reqId = c.req.header('X-Request-Id') ?? crypto.randomUUID();
    c.set('requestId', reqId);
    c.header('X-Request-Id', reqId);
    return next();
  });
  ```

---

## Devil's Advocate — 2년차에 깨질 시나리오 1개

**시나리오**: Year 2 Phase 4 진입 (multi-tenant) + ADR-007 §"Year 2 이전 대상" 작업 미완료 + 본 5-페르소나 MAJOR-B1~B6 중 3건 미해결 누적 상태에서, **공인중개사 BATCH-1 적재 시 engine_telemetry 가 examId='gong-in-jung-gae-sa' 로 INSERT** → admin-web `/telemetry?examId=gong-in-jung-gae-sa` 호출.

발생 가능 깨짐:

1. **MAJOR-B1**: gauge enum 변경 마이그레이션 의무 누락 → 신규 시험별 게이지 (예: 공인중개사 `case_law_freshness`) 미반영 → write 시 CHECK 위반 → 503.
2. **MAJOR-B4**: dashboard N+1 쿼리 × 시험 2개 = 32 prepared statement → Workers CPU 50ms 초과 → 일부 게이지 stale.
3. **MAJOR-B5**: API 버저닝 부재 → multi-tenant 응답 shape 변경 시 손해평가사 admin-web 도 동시 깨짐.
4. **MAJOR-B6**: 공인중개사 사용자 PIPA 삭제 요청 → user_progress.user_id 익명화 ADR 부재 → 컴플라이언스 위반 + 손해평가사 사용자도 동일 위험 노출.

**반증 (이 시나리오가 발생하지 않는 이유)**:

- 메모리 `project_v3_final_multi_exam_deferred` + ADR-007 명시 — Year 2 Phase 4 리팩토링이 위 6건을 1회 batch 처리하는 step. **단**, 본 5-페르소나 보고서가 **Year 2 진입 게이트 trigger** 로 작동하지 않으면 망각 위험. 진산님 메모리 `project_completion_notification_obligation` "Hard Rule 16/17 Year 2 zero-cost 전환 본 step 동시 처리 (이연 X)" 는 본 5-페르소나 항목들이 Year 2 진입 step 의 명시 입력으로 재참조될 때만 실효성 보장.

**권고**: ROADMAP Year 2 진입 step 작성 시 본 보고서 파일 경로를 게이트 입력으로 명시. handoff-027 에 "Year 2 진입 시 .claude/reviews/phase1-tech-debt-20260501-160014-backend.md MAJOR-B1~B6 흡수 의무" 추가.

---

## Phase 1 종료 게이트 충족 매트릭스 (backend-architect 차원)

| 게이트                              | 충족 | 증거                                                           |
| :---------------------------------- | :--: | :------------------------------------------------------------- |
| 데이터 모델 진화성 (CRITICAL 부재)  |  ✅  | engine_telemetry exam_id NOT NULL + 트리거 차단 + FK 의도 주석 |
| Hard Rule 16 zero-cost 약속 실증    |  ✅  | D1BatchRunsDb 모든 메서드 examId 첫 인자                       |
| Hard Rule 17 단일 선언처            |  ✅  | EXAM_IDS literal 1개소 + grep 출력 위반 0                      |
| Hexagonal 위반 (modules → infra)    |  ✅  | telemetry/write-helper.ts D1 직접 사용 OK (apps 계층)          |
| Audit/Compliance baseline           |  ✅  | webhook_events / sessions / status_transitions append-only     |
| API 응답 일관성 (5xx + Retry-After) |  ✅  | progress/telemetry 모두 503 + Retry-After:5 동일 패턴          |
| FK ON DELETE 정책                   |  ⚠️  | sessions CASCADE OK / user_progress FK 부재 (MAJOR-B6 트래킹)  |

**판정**: 본 backend-architect 페르소나 차원 **CRITICAL 0건 → Phase 1 종료 게이트 통과 가능**. MAJOR 6건 / MINOR 4건은 Year 2 Phase 4 진입 게이트 + Phase 2 BATCH-1 진입 게이트로 명시 트래킹 의무.

---

## 결과 파일 경로

`/home/soo/ClaudePro/ThePick/.claude/reviews/phase1-tech-debt-20260501-160014-backend.md`
