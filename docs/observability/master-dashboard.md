# Engine Observability Master Dashboard v1

**버전:** v1 (정식판 — Step 19 R-2 흡수)
**작성일:** 2026-05-01
**효력:** Phase 1 종료 시점 (Step 19) 이후 BATCH-1 적재부터 본격 활성
**근거 메모리:** `project_engine_observability` (자동차 계기판 메타포 + 8 게이지 + Cloudflare 단일 벤더)

> **진산님 2026-04-30 명시:** "자동차 계기판처럼 — 자동차 운전하듯이 BATCH 적재 진척, Cost, D1 SLO, Graph 무결성, 품질 게이트, Formula 정확도, Reviewer 큐, 학습 SLO 8 게이지 상시 모니터링/로그"

---

## 0. 운영 모델 — Cloudflare 단일 벤더

```
┌────────────────────────────────────────────────────────────────┐
│ Engine (apps/batch + cost-meter + recover + pipeline)          │
│   ↓ POST /api/telemetry  (X-Admin-Token + JSON 1 줄 logger)    │
│ apps/api Hono Worker                                           │
│   ↓ INSERT engine_telemetry (D1, append-only)                  │
│ Cloudflare D1                                                  │
│   ↑ GET /api/telemetry/dashboard                               │
│ apps/admin-web (Astro Pages, /telemetry — Phase 1 admin token) │
└────────────────────────────────────────────────────────────────┘
```

- **Cost = $0/m 추가** (D1 무료 티어 + Pages 무료 + Workers 기본 무관). 이미 사용 중인 벤더만.
- **외부 SaaS 0건** (메모리 `feedback_single_vendor_cloudflare` 정합)
- **append-only 보증** — engine_telemetry UPDATE/DELETE 트리거 차단 (migrations/0017)

---

## 1. 8 게이지 사양

### Phase 1 활성 (7 게이지) — 본 step 종료 시점부터 BATCH-1 적재 동안 데이터 흐름 시작

|  #  | gauge_name         | metric_value            | metric_json 필수 키                                             | write 주체                       | read 주체 |
| :-: | :----------------- | :---------------------- | :-------------------------------------------------------------- | :------------------------------- | :-------- |
|  1  | `batch_progress`   | 0~1 (적재 비율)         | `stages_done` / `stages_total` / `current_stage`                | apps/batch pipeline.ts           | admin-web |
|  2  | `cost`             | micro_cents             | `soft` / `hard` / `kill` / `status` / `calls_made`              | apps/batch cost-meter.ts         | admin-web |
|  3  | `d1_slo`           | latency_ms (p95)        | `query_count` / `error_count` / `table`                         | apps/batch loader.ts             | admin-web |
|  4  | `graph_integrity`  | violations_count        | `orphan_nodes` / `broken_edges` / `supersedes_cycles`           | packages/quality                 | admin-web |
|  5  | `quality_gate`     | pass_count (≤ 8)        | `cat1` ... `cat8` (각 PASS/FAIL/SKIP)                           | scripts/verify-engine-contracts  | admin-web |
|  6  | `formula_accuracy` | 1.0 (PASS) / 0.0 (FAIL) | `tests_total` / `tests_failed` / `packages: ['formula-engine']` | packages/formula-engine          | admin-web |
|  7  | `reviewer_queue`   | queue_size              | `draft` / `review` / `approved` / `days_oldest_draft`           | apps/api Reviewer (Phase 1 후반) | admin-web |

### Phase 2 활성 (1 게이지) — 사용자 노출 후 학습 데이터 흐름 시작

|  #  | gauge_name     | metric_value          | metric_json 필수 키                               | 활성 시점 |
| :-: | :------------- | :-------------------- | :------------------------------------------------ | :-------- |
|  8  | `learning_slo` | sessions_per_user_p95 | `active_users` / `retention_d7` / `retention_d30` | Phase 2   |

---

## 2. 게이지별 Alarm Rule (Phase 1 후반 본격 활성)

본 step (Step 19) 시점은 **status='ok' / 'no_data' 만 평가**하는 단순 모드. 임계 기반 'warn' / 'critical' 평가는 Phase 1 후반 (Reviewer 큐 + LLM 통합 후) 도입.

### 임계 정책 초안 (Phase 1 후반 활성 의무)

| gauge              | warn 조건                                   | critical 조건                                        |
| :----------------- | :------------------------------------------ | :--------------------------------------------------- |
| `batch_progress`   | metric_value < 0.1 + 1시간 정체             | metric_value 12시간 정체 (BATCH 사망)                |
| `cost`             | metric_json.status = 'soft_warn'            | metric_json.status = 'hard_throttle' / 'kill_switch' |
| `d1_slo`           | metric_value > 500ms (p95)                  | metric_value > 2000ms (p95)                          |
| `graph_integrity`  | metric_value > 0 (violation 1건이라도 발생) | metric_value > 10                                    |
| `quality_gate`     | metric_value < 6 (Cat 5/8 deferred 인지)    | metric_value < 4                                     |
| `formula_accuracy` | metric_value < 1.0 (1건이라도 FAIL)         | metric_value < 0.95                                  |
| `reviewer_queue`   | metric_json.days_oldest_draft > 7           | metric_json.draft > 100 + days > 14                  |
| `learning_slo`     | metric_value < 5 (Phase 2 후 정의)          | metric_value < 1 (Phase 2 후 정의)                   |

### MINOR-A2 흡수 — cross-tenant cause 라우팅

`recover.ts` SF-M-2 cross-tenant exam_id mismatch (cause: `exam_id_mismatch`) 발화 시:

- 본 이벤트는 **즉시 critical alarm** — Year 2 multi-tenant 진입 시 첫 번째 데이터 격리 위반 신호
- `engine_telemetry` 측에서 별도 게이지 신설 X (보안 이벤트는 logger.error 가 우선, 텔레메트리는 누적 카운트 용도로만)
- Phase 2 alarm 라우팅 도입 시 logger.error → Cloudflare Workers Logpush → 진산님 이메일 알림

---

## 3. 데이터 보존 정책

| 단계    | 정책                                                          | 트리거                                                             |
| :------ | :------------------------------------------------------------ | :----------------------------------------------------------------- |
| Phase 1 | 무제한 (D1 무료 5GB 한도까지)                                 | 본 step 종료 ~ Phase 2 진입                                        |
| Phase 2 | 1년 보존 (Cron Trigger 매일 03:00 UTC, 365일 이전 row DELETE) | wrangler d1 execute manual override (트리거 일시 비활성 후 DELETE) |

**중요:** engine_telemetry 의 DELETE 차단 트리거 때문에 GC 시점에 트리거를 일시 DROP / 작업 / 재CREATE 패턴 의무. 별도 plan (Phase 2 진입 시).

---

## 4. admin-web /telemetry 운영 가이드

### Phase 1 임시 인증 (본 step 시점)

1. 진산님이 ADMIN_API_TOKEN 환경변수 등록 (Cloudflare Workers Secret Manager 또는 wrangler secret put)
2. admin-web `/telemetry` 첫 진입 시 토큰 입력 폼 표시 → localStorage 저장
3. 30초 자동 폴링 + manual refresh 버튼
4. 401 응답 시 자동 logout (token 무효화 + 폼 재표시)

### Phase 2 전환 (Cloudflare Access)

1. 진산님 Cloudflare Zero Trust 콘솔 접속 → Access Application 등록
2. admin-web 도메인 (예: thepick-admin.pages.dev) 정책 등록 (이메일 OTP / WebAuthn / 그룹 멤버십)
3. apps/api 측 admin-token.ts 미들웨어 → Cf-Access-Jwt-Assertion 검증 미들웨어로 교체 (별도 ADR)
4. admin-web TelemetryDashboard.tsx 의 토큰 입력 폼 제거 (localStorage 정리 logic 잔존 OK)

---

## 5. 8 게이지 wire-up 매트릭스 (BATCH-1 진입 시 의무)

| 게이지             | wire-up 위치                                                  | wire-up 시점                           |
| :----------------- | :------------------------------------------------------------ | :------------------------------------- |
| `batch_progress`   | `apps/batch/src/pipeline.ts` 각 stage 종료 후 POST            | BATCH-1 적재 직전 본 step 후속 PR      |
| `cost`             | `apps/batch/src/cost-meter.ts` finalize()                     | 본 step 후속 PR 또는 BATCH-1 진입 시점 |
| `d1_slo`           | `apps/batch/src/loader.ts` 각 INSERT 후 latency 측정          | BATCH-1 진입 시점                      |
| `graph_integrity`  | `packages/quality/src/index.ts` 검증 후 violations_count 보고 | BATCH-1 적재 후 검증 단계 (Stage 7)    |
| `quality_gate`     | `scripts/verify-engine-contracts.ts` CI step + telemetry POST | CI 통합 PR (별도)                      |
| `formula_accuracy` | `packages/formula-engine` 테스트 후크 (CI)                    | CI 통합 PR (별도)                      |
| `reviewer_queue`   | `apps/api Reviewer 라우트` (Phase 1 후반)                     | Reviewer 큐 활성 시점                  |
| `learning_slo`     | (Phase 2 사용자 노출 후)                                      | Phase 2                                |

**본 step 시점**: 마이그레이션 0017 + admin-web 셸 + apps/api 라우트만 작성. 실제 wire-up은 BATCH-1 진입 직전 PR 의무.

---

## 6. 본 step (Step 19) 직접 활성 항목

- ✅ `engine_telemetry` 테이블 + 3 인덱스 + 2 트리거 (migrations/0017)
- ✅ apps/api `/api/telemetry` POST + GET routes (X-Admin-Token 검증)
- ✅ apps/admin-web `/telemetry` 페이지 (7 게이지 카드 + 1 placeholder)
- ⏳ wire-up (8 게이지 → engine_telemetry POST) — BATCH-1 진입 직전 후속 PR

본 step 종료 시점에는 **테이블/인터페이스/UI 셸**만 활성. **실제 데이터 흐름은 BATCH-1 적재 시점에 wire-up PR 로 활성**.

---

## 7. 차세션 의무 (BATCH-1 진입 시점)

1. 본 master-dashboard.md v1 갱신 (BATCH-1 진입 시 wire-up 위치 명시 + alarm rule v1.1)
2. apps/batch 측 telemetry write helper 라이브러리 (`apps/batch/src/telemetry-client.ts` 신규) — fetch POST `/api/telemetry`
3. 8 게이지 모두 BATCH-1 적재 첫 사이클에서 데이터 흐름 검증 (visual 확인 + 자동 e2e 테스트)
4. Phase 2 진입 시 Cloudflare Access ADR 작성 + admin-token.ts 제거
5. Cron Trigger telemetry 자동 집계 (Phase 1 후반 — Reviewer 큐 활성 후)

---

## 8. v1 → v2 변경 이력 예고

| 항목              | v1 (Step 19, 본 문서) | v2 (BATCH-1 wire-up PR) |
| :---------------- | :-------------------- | :---------------------- |
| 8 게이지 사양     | ✅                    | wire-up 위치 명시       |
| Alarm rule        | 초안                  | 실제 임계 운영 적용     |
| Cron 자동 집계    | 미정의                | Phase 1 후반 도입       |
| Cloudflare Access | Phase 2 예고          | Phase 2 진입 시 ADR     |
| 학습 SLO 게이지   | placeholder           | Phase 2 활성            |

---

**v1 작성자:** Claude (Opus 4.7) — Step 19 R-2 흡수
**v1 효력 시점:** 2026-05-01 Step 19 종료
**v2 작성 시점:** BATCH-1 적재 진입 시점 (wire-up PR 동시)
