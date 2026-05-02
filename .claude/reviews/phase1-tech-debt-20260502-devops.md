# Phase 1 5-페르소나 기술부채 심층 리뷰 — devops-architect

**작성일**: 2026-05-02 ~15:30 KST
**리뷰 방식**: 독립 에이전트 (`devops-architect`, agentId `a9c29154b1105c6c0`)
**페르소나 핵심 질문**: "새벽 3시 on-call 시나리오?"
**리뷰 범위**: CI/CD + Cloudflare 배포 + Observability + Secret + 마이그레이션 + 알람

---

## 선행 리뷰 정합 (2026-05-01 1차 리뷰)

본 페르소나는 2026-05-01 Phase 1 종료 시 직접 1차 리뷰 작성 (`.claude/reviews/phase1-tech-debt-20260501-160156-devops.md`).

- CRITICAL-DO-1 (admin-web localhost fallback) — `TelemetryDashboard.tsx:28-60` LOCALHOST_API_BASE 강제 throw 패턴 흡수 확인
- MAJOR-DO-1~5 + MINOR-DO-1~6 — 본 리뷰 다시 지적 안함 (정책 정합)

본 리뷰는 Sprint 1 §5.1~§5.4 진행 + handoff-033 결정 누적 + BATCH-1 진입 D-Day 임박 시점 **신규 발견** 운영 부채만.

---

## CRITICAL — BATCH-1 진입 전 의무 (1건)

### CRITICAL-DO-S1-1 — `apps/batch` telemetry POST wire-up 코드 0건 (8 게이지 no_data 비행)

**증거 (load-bearing)**:

- `grep -rn "fetch.*api/telemetry|engine_telemetry|telemetry" apps/batch/src --include="*.ts"` → **0 matches**
- `find . -name "telemetry-client*"` → **0 matches** (master-dashboard.md §7 차세션 의무 #2 약속 미실현)
- `docs/observability/master-dashboard.md:114-122` — 8 게이지 wire-up 매트릭스 7개 모두 "BATCH-1 적재 직전 후속 PR" 표기. **본 시점 wire-up 코드 없음**
- `docs/ENGINE_HARDENING_COMPLETION_REPORT.md:1069` — `MAJOR-S2 telemetry wire-up — 본 작업 첫 PR` 명시 — handoff-033 §1 진척 0건

**시나리오 (새벽 3시)**: BATCH-1 적재 → cost-meter soft 70% 도달 → `costMeterLog.warn(...)` Workers Logs 만 기록. admin-web `/telemetry` 접속 → cost 게이지 `no_data`. 진산님이 admin-web 만든 본래 목적 0% 달성. wrangler tail streaming 안 하면 KILL_SWITCH 발동까지 발견 휘발 위험.

**근본 원인**: handoff-033 §0.1 Sprint 1 §5.4 PARTIAL 7건에 집중하면서 telemetry wire-up 이 §5.5 종료 게이트 이후로 자연스럽게 밀린 상태. master-dashboard.md §7 차세션 의무 #2 추적 ledger 누락.

**권고 (택일)**:

- **A안 (권장)**: §5.5 종료 게이트 PASS 직후 즉시 후속 PR — `apps/batch/src/telemetry-client.ts` 신규 + 8 게이지 중 Phase 1 활성 7개 wire-up. e2e 검증
- **B안 (차선)**: BATCH-1 트리거 발동 시 첫 단계로 본 PR — "엔진 가동 시작 후 가시성 부재" 윈도우

**메모리 정합**: `project_engine_observability` ("자동차 계기판처럼 8 게이지 상시 모니터링/로그") — 데이터 흐름 0건 = 메모리 직접 위반.

---

## MAJOR — 4건 (Phase 2 명시 트래킹)

### MAJOR-DO-S1-1 — `MAX_BATCH_RUNTIME_HOURS` / KILL_SWITCH Workers Cron 미연동 (12시간 stuck BATCH 자동 발견 0%)

**증거**:

- `apps/api/wrangler.toml:167-174` Cron 단일 (`0 3 * * *` rate_limits GC)
- master-dashboard.md §2 — `batch_progress` warn "metric_value < 0.1 + 1시간 정체" / critical "12시간 정체 (BATCH 사망)"
- `apps/batch/src/cost-meter.ts:61-74` `KillSwitchError` 정의됨. **wrangler scheduled handler 인지 경로 0건**

**권고**:

- **본 step 흡수** (TD-DO-053): `apps/api` Cron `*/15 * * * *` health-check trigger 추가 → `engine_telemetry` `batch_progress` 최신 row 1시간 stale 시 logger.error
- **Phase 2 진입**: Cloudflare Email Routing 활성 후 logger.error → `__alarm_email` route → 진산님 이메일

### MAJOR-DO-S1-2 — `engine_version` major bump runbook 부재 (v1.2 §10.7 #7)

**증거**:

- `apps/batch/__tests__/recover.test.ts:302-335` AC-R5 PASS — recovery_failed 분기 PASS, **manual 처리 절차 0건**
- `find docs/ -name "*runbook*" -o -name "*engine-version*"` → 0 matches

**권고**:

- **TD-DO-054**: `docs/runbooks/engine-version-bump.md` 신규 1쪽 — major bump 절차 + checkpoint 호환성 + recovery_failed 시 폐기 default + ADR 의무
- master-dashboard.md §3 1줄 추가
- **Phase 2 의무**: D1 Time Travel + checkpoint snapshot 동기

### MAJOR-DO-S1-3 — `verify-engine-contracts` CI 게이트 실패 시 진산님 인지 경로 = GitHub UI 의존

**증거**:

- `.github/workflows/ci.yml:71-80` — Step 18 게이트 + `actions/upload-artifact@v4` 30일 보존. **CI 실패 알림 채널 0건**
- `.github/workflows/ci.yml` 전체 — `if: failure()` 분기 + 알림 step 0건

**권고**:

- **TD-DO-055**: `if: failure()` 알림 step 추가 — Cloudflare Email Routing webhook 또는 (Phase 2) GitHub repository notification 활성. **외부 SaaS 도입 금지** (메모리 `feedback_single_vendor_cloudflare` 정합) → Cloudflare Workers webhook receiver 신설

### MAJOR-DO-S1-4 — Production 첫 배포 staging dry-run 절차 전무 (v1.2 §10.7 #1)

**증거**:

- `apps/api/package.json:7` deploy 스크립트 명시 차단 (좋은 방어선)
- `package.json:18` `deploy:api` turbo 통과 — 환경 분리 0건
- `apps/api/wrangler.toml:127-159` staging / production 분리 명시. **"staging dry-run → production" 절차 문서 0건**

**권고**:

- **TD-DO-056**: `docs/runbooks/production-deployment.md` 신규 — (1) staging 마이그레이션 (2) staging /health curl PASS (3) staging /api/telemetry curl 토큰 검증 (4) production 마이그레이션 (5) production /health curl. **각 step 실패 시 rollback 절차**
- handoff-027 § BATCH-1 prerequisite 위치 1줄
- **Phase 2 의무**: GitHub Actions deploy job (이미 phase1 MAJOR-DO-3 트래킹) 자동 staging dry-run 게이트화

---

## MINOR — 3건

- MINOR-DO-S1-1: Workers / D1 / Vectorize / Pages / Email Routing 한도 단일 출처 부재 (`docs/runbooks/cloudflare-quotas.md` 권고)
- MINOR-DO-S1-2: `apps/admin-web/dist/` git tracked 상태 — Astro hash 변동 시 git diff 폭증 (.gitignore 권고)
- MINOR-DO-S1-3: CI 시간 측정 0건 (timeout-minutes 15 한계 임박 가능성)

---

## Devil's Advocate (3 시나리오)

### 시나리오 1: BATCH-1 첫 적재 = 진산님 8시간 자리 비움

- cost-meter soft_warn → hard_throttle → kill_switch 발화. logger 휘발 (Workers Logs 미설정 — apps/batch 노트북). admin-web 게이지 `no_data`. Anthropic Console cap 미설정. **8시간 가시성 부재 + 청구액 미통제**
- **부정**: "진산님 BATCH-1 첫 적재 24시간 모니터링" 운영 정책으로 우회. handoff-027 명시 의무

### 시나리오 2: 새벽 3시 Cron 03:00 GC 실패 + console.error 휘발

- wrangler tail 미실행 시 30일 후 자동 삭제
- **부정**: GC 실패 후 다음 03:00 catch-up 자동 (CHA-06 PASS). 앱 레벨 방어선 통과. 운영 인지 휘발 OK 정책 명시 의무

### 시나리오 3: production CORS 변경 시 admin-web ↔ apps/api 도메인 동기 부재

- DNS 등록 절차 → race window 30분~수 시간
- **부정**: BATCH-1 = 진산님 단독 = production CORS 변경 0회 가정. 메모리 `project_launch_legal_bundle_deferred` 정합 — 유료 오픈 직전 1주 스프린트로 동기

---

## 누적 이월 MAJOR 36건 흡수 — devops 영역 신규 4건

handoff-033 §0.2 4-Pass MAJOR 16 검토 결과 — 본 devops 영역 직접 매핑 **0건** (모두 silent-failure-hunter / quality / security 영역).

본 페르소나 단독 트래킹: **선행 5-페르소나 MAJOR-DO-1~5 + 본 신규 MAJOR-DO-S1-1~4 = 9건**

**tech-debt.md 신규 등록 의무**:

- TD-DO-053: Cron 15분 health-check trigger
- TD-DO-054: engine-version-bump.md runbook
- TD-DO-055: CI 실패 Cloudflare webhook receiver
- TD-DO-056: production-deployment.md staging dry-run runbook

본 4건 = handoff-027 § BATCH-1 prerequisite 보강 필수. **CRITICAL-DO-S1-1 (telemetry wire-up)** 만 본 step 흡수 의무.

---

## 판정

**완료 가능 (조건부)** — Sprint 1 §5.5 종료 게이트 PASS 가능. 단:

| 조건                          | 상태                                               |
| :---------------------------- | :------------------------------------------------- |
| 4-Pass CRITICAL 0             | ✅                                                 |
| 5-페르소나 신규 CRITICAL 0    | ⚠️ CRITICAL-DO-S1-1 BATCH-1 트리거 전 의무         |
| 종합 테스트 마스터 체크리스트 | ✅                                                 |
| 8 게이지 데이터 흐름          | ❌ wire-up 0건                                     |
| Phase 이월 부채 0             | ⚠️ MAJOR-DO-S1-1~4 등록 의무                       |
| 외부 SaaS 도입 권고           | **0건** (Sentry/PostHog/Datadog → Cloudflare 대체) |
| 다른 페르소나 영역 침범       | **0건**                                            |

### 종합 결론

**"새벽 3시 on-call 시나리오"** — Sprint 1 §5.4 종료 시점 가시성 0% (telemetry wire-up 0건) + 알람 경로 0% (Cron health-check 0건) + 자동 복구 50% (engine_version runbook 0건). **BATCH-1 적재 = 진산님 24시간 직접 모니터링 우회 가능. 자동화는 BATCH-2 부터 의무**. handoff-027 § BATCH-1 prerequisite 4건 명시 후 §5.5 PASS 진행 권고.

---

**원본 에이전트**: `devops-architect` (agentId: `a9c29154b1105c6c0`)
