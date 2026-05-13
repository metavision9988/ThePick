# ADR-043: Silent Failure Alert Routing — Cron monitor + Email Routing carry-over

- **상태:** Accepted (Phase 3 launch toggle 차단 의무 1차 해소, Email Routing 활성은 carry-over)
- **결정일:** 2026-05-13 (Session 073 Step 3-UX-6e 5-페르소나 devops CRIT-DO-1 흡수)
- **결정자:** Claude Opus 4.7 (devops-architect 진단) + 진산 (우선순위 위임)
- **관련 영역:** scheduled handler, engine_telemetry 'learning_slo' 게이지, streak_silent_failure / weak_delta_silent_failure 이벤트, Cloudflare Email Routing

---

## 맥락 (Context)

5-페르소나 devops CRIT-DO-1 진단:

- `apps/api/src/study/routes.ts`에서 silent failure 패턴이 발생 시 telemetry emit:
  - **`streak_silent_failure`** (routes.ts:1280): /grade의 streak_records UPSERT 실패 시 (D1 transient / lock contention)
  - **`weak_delta_silent_failure`** (routes.ts:1833): /session/:id/complete의 computeWeakDelta JOIN 실패 시
- 이 이벤트는 engine_telemetry 'learning_slo' 게이지에 INSERT (apps/api/src/telemetry/write-helper.ts 정합).
- **wake-up 메커니즘 0건** — INSERT만 되고 운영자 alert path 없음.

**위협:**

- 사용자 1명당 streak 0 누적 시점부터 게이미피케이션 신뢰 무너짐 (memory `project_ux_north_star_phase3` 정합).
- weak_delta_silent_failure는 사용자에게 "약점 영역 집계를 불러오지 못했습니다" amber alert로 직접 노출 (4-Pass C-1 흡수 후) — 사용자 직접 신뢰 손상.
- 진산 직접 인지 path 부재 → 사용자만 영향, 운영자 모름.

**근본 원인** — Cloudflare 단일 벤더 정책 (memory `feedback_single_vendor_cloudflare`) 정합으로 Sentry 미채택. 자체 alert 인프라 부재.

---

## 결정 (Decision)

### 1. Cron monitor 1차 가시화 (본 ADR 영속 — 본 step 흡수)

`apps/api/src/scheduled/silent-failure-monitor.ts` 신규 모듈로 직전 24h silent failure 카운트 집계 + 임계 분류.

```ts
export const SILENT_FAILURE_WARN_THRESHOLD = 5; // 24h 누적 5 초과 → warn
export const SILENT_FAILURE_CRITICAL_THRESHOLD = 50; // 24h 누적 50 초과 → critical
```

severity 분기:

- `ok` (totalCount ≤ 5): logger.info (정상 traffic 분석)
- `warn` (5 < totalCount ≤ 50): logger.warn + console.warn (wrangler tail에서 가시화)
- `critical` (totalCount > 50): logger.error + console.error (운영자 즉시 인지)

scheduled handler (`apps/api/src/index.ts`)에서 매일 03:00 UTC (KST 12:00)에 호출. 기존 `purgeOldRateLimits`와 동일 cron 묶음.

### 2. 추적 이벤트 contract

본 ADR 정합으로 추적되는 이벤트 (apps/api/src/study/routes.ts emit 정합):

| 이벤트                      | 발생 path                                   | 사용자 영향                           |
| :-------------------------- | :------------------------------------------ | :------------------------------------ |
| `streak_silent_failure`     | /grade streak UPSERT 실패                   | 게이미피케이션 부정확 (streak 0 누적) |
| `weak_delta_silent_failure` | /session/:id/complete computeWeakDelta 실패 | UI amber alert                        |

신규 silent failure 이벤트 추가 시 본 ADR §2 갱신 의무 + monitor `SILENT_FAILURE_EVENTS` 배열 추가 의무.

### 3. Email Routing 활성 (carry-over — Phase 3 launch 직전)

Cloudflare Email Routing 활성 시점:

- 진산 도메인 설정 (`thepick.app` MX record + email routing rule)
- Custom address `alerts@thepick.app` 또는 inbound route 생성
- Worker에서 `env.SEND_EMAIL` binding 또는 `fetch(emailRoutingEndpoint)` 호출

본 ADR §1 monitor가 'critical' severity 시 fetch 호출 chain 활성화 (별도 PR). 본 step에서는 logger.error + console.error로 1차 가시화만.

**carry-over 의무**: Phase 3 launch toggle 직전 (ADR-036 cookie SameSite=Strict 복원과 동일 chunk).

### 4. master-dashboard.md 정합 (carry-over — devops MAJOR-DO-4)

`docs/observability/master-dashboard.md` v2 작성 시 본 ADR §1 monitor 결과를 admin-web에 wire-up:

- `silent_failure_count_24h` 게이지 추가
- severity tag 색상 (ok green / warn amber / critical red)

본 step에서는 monitor 모듈 + scheduled handler 통합 + telemetry emit 정합만. 시각화는 carry-over.

### 5. 임계값 조정 정책

- launch 초기 (~30일): 활성 사용자 100명 이하 가정. WARN 5 / CRITICAL 50은 보수적.
- 100~1K 활성 사용자: WARN 50 / CRITICAL 200 권고 (별도 ADR로 조정).
- 10K+ 활성 사용자: Year 2 진입 시점. percentile 기반 threshold (예: 99th percentile 시간당 max) 도입 carry-over.

threshold 변경은 코드 상수 + 본 ADR §5 갱신 동시.

---

## 채택 근거

1. **Cloudflare 단일 벤더 정합** (memory `feedback_single_vendor_cloudflare`) — Sentry/PagerDuty 등 외부 SaaS 0건. Cron + Email Routing으로 자체 alert 구축.
2. **engine_telemetry 'learning_slo' 게이지는 이미 활성** — monitor 모듈만 추가하면 zero-cost 가시화.
3. **logger.error + console.error 이중 emit 패턴** — `purgeOldRateLimits` 기존 정합 (logpush 미설정 환경에서도 stderr 즉시 노출).
4. **wrangler tail로 운영자 즉시 확인** — Phase 3 launch 초기 활성 사용자 100명 이하에서 충분. Email Routing은 활성 사용자 증가 시점에 활성.

---

## 영향 (Consequences)

### 1. 본 ADR 영속 항목

- ☑ ADR-043 신규 영속 (본 문서)
- ☑ `apps/api/src/scheduled/silent-failure-monitor.ts` 신규 모듈
- ☑ `apps/api/src/index.ts` scheduled handler에 `reportSilentFailures` 호출 추가
- ☑ 단위 테스트 9건 신규 (`apps/api/src/scheduled/__tests__/silent-failure-monitor.test.ts`)

### 2. carry-over (Phase 3 launch 직전)

- ☐ Email Routing 활성 (`alerts@thepick.app` 등 inbound route)
- ☐ Worker `env.SEND_EMAIL` binding 또는 fetch endpoint 호출 chain
- ☐ master-dashboard.md v2 silent_failure_count_24h 게이지 wire-up
- ☐ Cloudflare Healthchecks 외부 ping (선택)

### 3. carry-over (Phase 4 또는 활성 사용자 증가 시)

- ☐ 임계값 조정 (WARN 5→50, CRITICAL 50→200)
- ☐ percentile 기반 dynamic threshold
- ☐ silent failure 이벤트 추가 시 monitor `SILENT_FAILURE_EVENTS` 갱신 의무

### 4. Year 2 멀티시험 정합

silent failure 이벤트는 `exam_id` 메타데이터 포함 (telemetry write-helper 정합). Year 2 진입 시 exam_id별 분리 집계 가능 (ADR-007 정합 + ADR-041 KST timezone 정합).

---

## 관련 문서

- `apps/api/src/scheduled/silent-failure-monitor.ts` (본 ADR 정합 구현)
- `apps/api/src/scheduled/__tests__/silent-failure-monitor.test.ts` (회귀 차단망)
- `apps/api/src/scheduled/rate-limit-gc.ts` (기존 cron 패턴 정합)
- `apps/api/src/index.ts` scheduled handler
- `apps/api/src/study/routes.ts` (silent failure emit source)
- `apps/api/src/telemetry/write-helper.ts` (engine_telemetry INSERT path)
- `docs/observability/master-dashboard.md` (v2 wire-up carry-over)
- ADR-022 (Cloudflare 단일 벤더 lockin)
- ADR-036 (auth cookie SameSite — Email Routing 활성 chunk 정합)
- ADR-042 (deploy ordering — 본 ADR과 동시 carry-over)
- 5-페르소나 통합 보고서: `.claude/reviews/phase3-tech-debt-20260513-163000.md` §"CRITICAL Phase 3 launch 직전 의무 흡수" #5

---

## 결정 책임

본 ADR은 다음만 lock:

- ✅ Cron monitor 1차 가시화 (silent-failure-monitor 모듈)
- ✅ 추적 이벤트 contract (streak_silent_failure / weak_delta_silent_failure)
- ✅ severity 임계값 (5 / 50)
- ✅ scheduled handler 통합 (기존 03:00 UTC cron 묶음)

다음은 lock 안 함:

- ❌ Email Routing 활성 (Phase 3 launch 직전 carry-over)
- ❌ master-dashboard.md v2 wire-up (별도 carry-over)
- ❌ 임계값 동적 조정 (활성 사용자 증가 시 별도 ADR)
- ❌ Cloudflare Healthchecks 외부 ping (선택, Phase 4 carry-over)
