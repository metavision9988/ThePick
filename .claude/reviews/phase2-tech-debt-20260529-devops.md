# 기술부채 리뷰 — devops-architect

- 리뷰 시점: 2026-05-29 (Phase 2 G-S5 측정 직전, S5-7 결재 자료 영속 직후)
- 운영자 가정: 진산 1인 + Claude 협업. 시험 시즌 = 5월말 연 1회 (현 시점은 직전 3개월).
- 단일 벤더: Cloudflare (ADR-006/022) — Sentry/PagerDuty/Resend 등 외부 SaaS 0건 의무.
- 리뷰 범위 (실제 읽은 파일, 절대경로):
  - `/home/soo/ClaudePro/ThePick/apps/api/wrangler.toml` (248줄)
  - `/home/soo/ClaudePro/ThePick/apps/api/package.json`
  - `/home/soo/ClaudePro/ThePick/apps/api/src/index.ts` (262줄)
  - `/home/soo/ClaudePro/ThePick/apps/api/src/scheduled/silent-failure-monitor.ts` (178줄)
  - `/home/soo/ClaudePro/ThePick/apps/api/src/telemetry/{routes,write-helper,admin-token,types}.ts`
  - `/home/soo/ClaudePro/ThePick/migrations/` (37 파일 — 0001~0037, 0020 결번)
  - `/home/soo/ClaudePro/ThePick/.github/workflows/ci.yml`, `d1-schema-drift.yml`
  - `/home/soo/ClaudePro/ThePick/.claude/hooks/{quality-gate,review-reminder,protect-l3}.sh`
  - `/home/soo/ClaudePro/ThePick/.claude/settings.json`, `settings.local.json`
  - `/home/soo/ClaudePro/ThePick/.claude/reports/production-migration-status.md`
  - `/home/soo/ClaudePro/ThePick/docs/observability/master-dashboard.md`
  - `/home/soo/ClaudePro/ThePick/docs/runbooks/{production-deployment,migration-rollback,engine-telemetry-gc}.md`
  - `/home/soo/ClaudePro/ThePick/docs/runbooks/migration-rollback/` (0021~0026 rollback SQL 6종)
  - `/home/soo/ClaudePro/ThePick/docs/deploy/cloudflare-pages-setup.md`
  - `/home/soo/ClaudePro/ThePick/docs/adr/ADR-006,022,025,042,043.md`
  - `/home/soo/ClaudePro/ThePick/package.json` (모노레포 root)
  - 비교 기준 (중복 회피): `.claude/reviews/review-20260511-111048-phase2-eval-mvp-persona5-devops.md` (Session 065 devops 5-페르소나, 2주 전), `.claude/reviews/phase3-tech-debt-20260513-163000.md` (Phase 3 5-페르소나, 16일 전), `.claude/reviews/phase1-tech-debt-20260502-devops.md`
- 결산 단위: 2주 전 phase2-eval-mvp persona5-devops 리뷰 발견사항의 **잔여 미해결** + 그 이후 신규 발현 부채 + Year 2/시험 시즌 horizon.

---

## 요약 (Bottom Line Up Front)

새벽 3시 on-call 관점에서 본 시스템의 **단일 가장 큰 결손은 "운영자 invariant: 사고 발생 시 운영자가 알 방법이 없다"** 이다.

- ADR-043 silent-failure monitor 는 영속(`/home/soo/ClaudePro/ThePick/apps/api/src/scheduled/silent-failure-monitor.ts:148-177`) 됐으나 **§3 Email Routing 활성은 carry-over** 상태로 고정 — `wrangler tail` 을 운영자가 켜고 있어야만 critical 이 보인다.
- production deploy 자체에 **CI workflow 0건** (`/home/soo/ClaudePro/ThePick/.github/workflows/` 에 `ci.yml` + `d1-schema-drift.yml` 만 존재, deploy.yml/release.yml 부재. `production-deployment.md:178` TD-DO-056 미해소).
- D1 disaster recovery runbook **부재** (ADR-042 §2 carry-over `d1-disaster-recovery.md` 미작성. 30일 Time Travel 의 RPO/RTO 가 어디에도 명시되지 않음).
- production secret 의 **로테이션 정책/주기 0건**. `JWT_SECRET`, `IP_PEPPER`, `WEBHOOK_HMAC_SECRET_*`, `ADMIN_API_TOKEN` 모두 `wrangler secret put` 으로 한 번 박힌 후 회전 ADR 없음.

다음 4건이 새벽 3시 호출 시 진단/복구를 가장 강하게 차단한다 (CRITICAL).

---

## CRITICAL (새벽 3시 호출 시 진단 불가) — 4건

### C-1. Worker → R2 Logpush 미연결 — wrangler tail 없으면 critical 알림이 휘발

- 영역: 옵저버빌리티 / 알림 라우팅
- 증거:
  - `apps/api/wrangler.toml:62-64,136-138,197-199` — `[observability] enabled = true / head_sampling_rate = 1` (production/staging) 만 선언. **`[[logpush]]` 또는 `logpush = true` 선언 0건** (전체 wrangler.toml grep PASS).
  - `apps/api/src/index.ts:192-194` 주석: "logger.error 가 logpush 미설정 환경에서 휘발될 위험 대비 2차 방어선" → 직접 인정.
  - `apps/api/src/scheduled/silent-failure-monitor.ts:15` 주석: "Email Routing / Cloudflare Healthchecks 등 외부 alert path는 ADR-043 §3 carry-over."
  - `docs/observability/master-dashboard.md:77` "Phase 2 alarm 라우팅 도입 시 logger.error → Cloudflare Workers Logpush → 진산님 이메일 알림" — 미도입.
- 시나리오 (새벽 3시): silent-failure monitor 가 03:00 UTC = 12:00 KST 에 critical 판정 → `logger.error('silent_failure threshold critical')` + `console.error` 발화 → Workers 기본 Observability 는 sample 보존 + UI 조회 가능하지만 **push 알림 0**. 운영자가 다음 morning 에 `wrangler tail` 또는 dashboard 를 켜기 전까지 streak/weak_delta silent failure 가 24h × N 회 쌓이는 동안 무지. 시험 시즌 트래픽 폭증 시 weak_delta 실패 = 학습자에게 amber alert 직접 노출, 진산은 사용자 채널로 알게 됨 (= 발견 경로가 사용자 클레임).
- 진단 차단 요인:
  - 영구 보존 로그 없음 (Workers Observability head sampling 100% 인 staging/prod 도 retention 은 Cloudflare 기본 ~3일).
  - critical 단계 트리거가 만든 trail 이 R2 로 흘러가지 않음 → 사후 forensics 불가.
- 6개월/2년 시나리오:
  - 6개월: launch 직후 register burst 또는 PG webhook 5xx surge 가 wrangler tail 켜진 동안에만 보인다.
  - 2년 (Year 2): 시험 N종 × 사용자 ~수천 명. silent-failure 임계가 percentile 기반 dynamic 으로 가도 (ADR-043 §5) 알람 채널 자체가 없으면 의미 0.
- 권장 조치 (Cloudflare-native):
  1. `wrangler.toml` `[env.production]` 에 `logpush = true` + Cloudflare Workers Logpush job 1개 (R2 bucket `thepick-logs-production` destination, filter `outcome="exception" OR scriptName="thepick-api-production"`). Pages 와 admin-web 별도 job.
  2. ADR-043 §3 Email Routing 활성 ADR 진입 — `alerts@thepick.app` 또는 (custom domain 미확정 시) wrangler secret 으로 `ALERT_EMAIL_TARGET` 주입 후 `MailChannels` 경유 (Cloudflare 권장 outbound). 단, MailChannels 2024 정책 변경 검토 필요 (`docs/analysis/DEV COVEN 종합 검토 보고서 — 가-1 진입 판단_0425.md:244`).
  3. 단기 임시: Cloudflare Healthchecks (HTTP probe) + `/health` 외 `/health/cron` 엔드포인트 노출 → silent-failure monitor 가 critical 이면 `/health/cron` 500 반환 → Healthchecks SMS/이메일.
- 우선순위 근거: ADR-043 가 이미 영속됐고 1차 emit 만 동작. §3 활성은 단순 carry-over 표기로 두면 launch 후 즉시 가시화 0 가 영속화된다. **Phase 3 launch chain의 toggle 그룹과 묶지 말고 G-S5 실측과 동일 chunk 진입 권고** (3개월 슬립 차단).

### C-2. production deploy 자동화 0건 — 휴먼 에러 surface 가 매번 redeploy 마다 열린다

- 영역: CI/CD 파이프라인 / 배포 안전성
- 증거:
  - `/home/soo/ClaudePro/ThePick/.github/workflows/` 디렉토리 직접 ls 결과 **2 파일**: `ci.yml` (quality-gate + e2e + secret-scan) + `d1-schema-drift.yml`. **deploy.yml / release.yml / production.yml 0건.**
  - `docs/runbooks/production-deployment.md:178` "TD-DO-056: `.github/workflows/deploy.yml` 신규 — staging dry-run 자동 게이트화" — 한 달 가까이 미진행.
  - `apps/api/package.json:9-10` `deploy:staging` / `deploy:production` 스크립트 존재하나 호출자 = 진산 로컬 `wrangler whoami` token.
  - production-migration-status.md §"적용 일자" 가 `2026-05-12 KST (0029 / 0030+0031 / 0032~0035)` 6 마이그레이션 누적 적용을 **모두 manual** 로 기록.
  - 2주 전 devops 리뷰 (`review-20260511...persona5-devops.md` MAJOR-D7+D8+D9) 에서 이미 동일 진단 — 미흡수.
- 시나리오 (새벽 3시): production hotfix 가 필요한 새벽. 진산이 wrangler 토큰 만료 / 새 디바이스 / 2FA token 분실 중 1건이라도 발생하면 즉시 fix path 0. Year 2 진입 시 여러 환경 × 여러 시험 × 여러 마이그레이션 = manual 절차로 휴먼 에러 확률 polynomial.
- 진단 차단 요인:
  - production 에 무엇이 배포됐는지 git commit ↔ deployed version 의 매핑 자동 영속 없음 (Workers Dashboard 의 version ID 만 신뢰).
  - migration 적용 ↔ Worker version 매핑 영속 없음 — ADR-042 의 "Deploy ordering" 정책이 사람의 머리 안에서만 enforce.
- 6개월 / 2년: Year 2 멀티시험 진입 시 exam_id 컬럼 ADD/dual-write/contract 3단계 (ADR-042 §"Year 2 멀티시험 전환 시 정합") = manual 로는 schema drift 회피 불가.
- 권장 조치:
  1. `.github/workflows/deploy.yml` 신규 — trigger: `release` 태그 push 또는 `workflow_dispatch`. job 순서 lock = `[1] pnpm typecheck/lint/test/audit` → `[2] wrangler d1 migrations apply --remote --env staging` → `[3] staging smoke (curl /health)` → `[4] (gate: manual approval via GitHub Environments)` → `[5] wrangler d1 migrations apply --remote --env production` → `[6] wrangler deploy --env production` → `[7] /health, /api/search, /api/study/next smoke` → `[8] production-migration-status.md 자동 갱신 PR commit`.
  2. CLOUDFLARE_API_TOKEN scope 4종 (Workers Scripts:Edit + D1:Edit + Pages:Edit + Account:Read) 분리 + GitHub Environments protected (`production` env 만 진산 manual approve).
  3. Worker version pinning 영속: deploy job 출력의 versionId 를 PR comment + production-migration-status.md 에 append (BCS-style version trail).
- 우선순위 근거: 2주 전 진단 미흡수 + Phase 3 launch chain `ADR-034/035/036` 복원 토글 (password=8, HIBP=true, SameSite=Strict) 이 **wrangler.toml 수정 → redeploy** 패턴이라 deploy 자동화 없으면 "복원 잊혀짐" 시나리오가 단일 source 차단 메커니즘 없이 진산 메모리에만 의존. 시험 시즌 3개월 전 시점이라 launch 게이트와 동시 chunk.

### C-3. D1 disaster recovery runbook 부재 — 30일 Time Travel 외 RPO/RTO 정의 0

- 영역: 재해 복구 / 백업 정책
- 증거:
  - `docs/runbooks/` ls 결과: `engine-telemetry-gc.md`, `migration-rollback.md`, `migration-rollback/` (0021~0026 SQL), `production-deployment.md` **만**. `d1-disaster-recovery.md` 부재 (ADR-042 §2 carry-over 미해소).
  - `docs/adr/ADR-006-single-vendor-cloudflare.md:81` "D1 Time Travel 30일 + R2 외부 백업(개인 NAS/S3 Glacier — 이건 **데이터 백업이지 벤더 이중화 아님**)" → R2/NAS 백업 자동화 0건.
  - `docs/analysis/DEV COVEN 종합 검토 보고서 — 가-1 진입 판단_0425.md:266` G-3 "D1 백업 RPO/RTO/보존기간 명시 부재" — 한 달 전 진단, 미흡수.
  - 사용자 데이터 (`user_progress` 15 rows + `study_reviews`, `study_sessions`, `streak_records`, `login_history`, `sessions`) 의 RPO/RTO 정의 0건. 학습 콘텐츠 (knowledge_nodes 794 / formulas 157 / constants 193 / exam_questions 545) 도 동일.
- 시나리오 (새벽 3시):
  - 운영자 실수로 production D1 에 `DELETE FROM user_progress` 실행 (예: wrangler d1 execute 에 `--env production` 오타). Time Travel restore 절차 모름 → 진산이 Cloudflare Dashboard 에서 손으로 bookmark 찾기.
  - Cloudflare 계정 정지 (결제 카드 만료, abuse flag, 단일 벤더 자체 장애) 시 30일 Time Travel 도 접근 불가 = 전 데이터 휘발.
- 진단 차단 요인:
  - 백업 검증 procedure 0 — D1 export 실제로 동작하는지, 복원이 schema/trigger 모두 살아나는지 한 번도 시도된 적 없음 (search 결과 부재).
  - Vectorize 인덱스 (`thepick-embeddings`, 794 vector) backup 0 — `wrangler vectorize` CLI 의 export 명령 자체가 제한적, 재구축 필요시 bge-m3 임베딩 794 회 재호출 비용 / 시간 미정.
- 6개월: 사용자 ~수백 명 시점에서 부주의 DELETE 또는 trigger 손상 시 1주일+ 운영 정지 가능.
- 2년: Year 2 멀티시험 진입 시 시험별 데이터 격리 + 백업 비용/시간 polynomial 증가. RPO/RTO 정의 없으면 SLA 약속 자체가 불가.
- 권장 조치 (Cloudflare-native):
  1. `docs/runbooks/d1-disaster-recovery.md` 신규 — 4 시나리오 lock: (a) 부주의 DELETE/UPDATE (Time Travel restore), (b) trigger/schema 손상 (rollback SQL + Time Travel), (c) Cloudflare 일시 장애 (대기), (d) 계정 정지 (R2 외부 백업 from). 각 시나리오의 RPO/RTO 명시.
  2. cron `0 4 * * *` 추가 — `wrangler d1 export` → R2 bucket `thepick-backup-production` (Cloudflare 단일 벤더 정합). retention 90일 R2 lifecycle. 매 backup 후 `engine_telemetry` 의 `backup_status` 게이지 emit.
  3. 분기 1회 의무: R2 backup → 신규 D1 DB 로 restore → 행 카운트/스키마 정합 자동 검증 GHA job (월 1회 cron).
  4. Vectorize: D1 `knowledge_nodes` 의 embedding 컬럼화 또는 R2 JSONL dump → 재구축 절차 lock.
- 우선순위 근거: 사용자 데이터가 적은 현 시점 (15 rows) 에서 manual 복구 가능하나, Phase 3 launch 후 사용자 ~100명 도달 시점이면 백업 부재가 즉시 사업 risk. ADR 영속 1건 + cron 1건이면 자동화 완성 = ROI 극대.

### C-4. Secret 로테이션 정책 0건 — 한 번 박힌 production secret 이 영원히 사용

- 영역: 시크릿/자격증명 관리
- 증거:
  - `wrangler.toml:14-45` production 환경에 `JWT_SECRET`, `IP_PEPPER`, `WEBHOOK_HMAC_SECRET_{MOCK,POLAR,PORTONE,TOSSPAYMENTS}`, `ADMIN_API_TOKEN` 모두 `wrangler secret put --env production` 경유 주입.
  - 그러나 `docs/runbooks/`, `docs/adr/`, `.github/workflows/` 전체에서 "secret rotation", "key roll", "회전 주기" 검색 결과 0건 (단, `docs/runbooks/migration-rollback.md:17` 만 Cloudflare API token 회전 의무 1건 단발).
  - ADR-005 (PBKDF2 인증) / ADR-035 (PBKDF2 iterations) / ADR-036 (cookie SameSite) 어디에도 JWT_SECRET 회전 주기 정의 0.
  - Cloudflare API token (CI 의 `CLOUDFLARE_API_TOKEN` GH secret) 회전 정책 0건.
- 시나리오 (새벽 3시):
  - 진산 디바이스 분실/도난 → 디바이스에 wrangler whoami 토큰 또는 Cloudflare 세션 → 시크릿 즉시 회전 필요. 회전 SOP 부재 = 4종 secret + Cloudflare API token + wrangler token 5+ 개 각각 어디서 어떻게 회전하는지 백지에서 작성.
  - `WEBHOOK_HMAC_SECRET_PORTONE` 유출 (PG 측 incident) → 즉시 회전해야 하나 dual-write window 정의 0 — 회전 = 인증 단절 = 결제 webhook 5xx burst.
- 6개월: launch 직후 결제 webhook 활성 시점에 secret 회전 절차 SOP 0건이 실 risk.
- 2년: 멀티시험 진입 시 시험별 secret 분리 또는 통합 정책 결정 필요.
- 진단 차단 요인: incident response checklist 없음. 어떤 secret 이 어디서 발급/사용/회전되는지 inventory document 부재.
- 권장 조치:
  1. `docs/runbooks/secret-rotation.md` 신규 — inventory (각 secret = scope + issuer + rotate command + dual-write window). 정기 회전 cycle (JWT_SECRET 90일, IP_PEPPER 365일 / 1차 사용자 ID hash 영속이라 회전 = 모든 hash 재계산 필요 — dual-pepper 정책 ADR 신설), webhook HMAC 은 PG 정책 동기, ADMIN_API_TOKEN 30일.
  2. ADR 신설: "Secret rotation policy" (ADR-046 또는 049 슬롯). dual-write 또는 grace period 정의.
  3. emergency rotation runbook: digest 분실 / 유출 시 1시간 내 SOP — 검출 → 회전 → 영향 분석 → 통보 흐름.
- 우선순위 근거: Year 2 또는 사용자 확산 전이 적기. 현재 사용자 1명 (진산) 단계에서 dual-write 마이그레이션 risk 가 작다.

---

## MAJOR (곧 사고가 날 수 있는 부채) — 6건

### M-1. Migration tracker 와 file 카운트 불일치 — 0020 결번 + 0038~ 미예약

- 영역: 마이그레이션 운영
- 증거: `migrations/` ls = `0001`~`0019` + `0021`~`0037` (총 36 파일, **0020 결번**). `production-migration-status.md` 표는 0020 entry 자체 없이 0019 → "0020 ~ 0027 (8건)" 묶음 처리.
- 위험: 새 운영자/Claude 세션이 "0020 어디 갔나" 디버깅 cost. wrangler `d1 migrations list` 자체는 file system 기준이라 차이 없지만 humans-in-the-loop 혼란.
- 권장: (a) `0020_RESERVED.sql` placeholder 또는 (b) production-migration-status.md §"적용된 마이그레이션" 에 명시적 "0020: 의도적 결번 (사유: ...)" 1행.

### M-2. ADR-042 Migration PR template 미작성 — BC/BR 분류 강제 메커니즘 부재

- 영역: 배포 안전성
- 증거: `ADR-042 §2.4` "본 deploy의 schema 변경이 BC인지 BR인지 분류 (PR 본문 명시 의무)" + §"carry-over: `.github/PULL_REQUEST_TEMPLATE/migration.md` 신규 (선택, Phase 3 launch 후 30일)". `.github/PULL_REQUEST_TEMPLATE/` 디렉토리 부재.
- 위험: 진산 단독으로 BR migration 을 BC 라 가정하고 1단계 deploy → rollback 시 데이터 손실. ADR 텍스트만으로는 시그널 0.
- 권장:
  1. `.github/PULL_REQUEST_TEMPLATE.md` 또는 `migration.md` 신규 — checkbox: `[ ] migration 분류 BC / BR (BR 이면 ADR-042 §2 2-step plan 첨부)`, `[ ] migrations/migration-rollback/N_rollback.sql 작성`, `[ ] wrangler d1 migrations list --remote drift 0 확인`.
  2. PR title prefix 컨벤션 (`migrate(0038): ...` 등) + CI lint rule.

### M-3. Migration rollback SQL 6개만 작성 (0021~0026) — 신규 0027~0037 11개 부재

- 영역: 마이그레이션 운영 / 재해 복구
- 증거: `docs/runbooks/migration-rollback/` 디렉토리 = `0021_rollback.sql` ~ `0026_rollback.sql` 6 파일. 0027 (review_queue), 0028 (pbkdf2), 0029 (uniq constraint), 0030 (login_history), 0031 (event_type), 0032 (input_type), 0033 (fsrs ext), 0034 (study_reviews), 0035 (streak), 0036 (study_reviews session idx), 0037 (exam_q active subject idx) **모두 rollback SQL 0건**.
- 위험: 0033 fsrs_state CHECK constraint 추가 + 0034/0035 신규 테이블 — rollback 시점에 4-Pass 리뷰 + ADR + manual SQL 작성 = 새벽 3시 호출에 1시간+ 추가.
- 권장: ADR-042 §"Migration rollback SQL 작성 영속" carry-over 의무를 매 migration PR 의 gate 로 격상 (M-2 와 묶음). 최소 BR migration 은 100% 의무.

### M-4. wrangler 토큰 출처/회전 정책 부재 — 자동화 break point 영속

- 영역: 자격증명 / CI
- 증거: `production-migration-status.md:14` "wrangler 토큰: `claude-code-thepick` (User API Token, 2026-05-10 발급)" — 발급 일자 만 영속, 만료 / scope / 회전 미정의. 2주 전 devops 리뷰 MAJOR-D7 동일 지적.
- 위험: API token expiry → CI workflow (특히 `d1-schema-drift.yml` 매일 cron) 정지 → drift detection 누락 → 다음 deploy 가 drift 위 deploy.
- 권장:
  1. `.claude/reports/wrangler-token-trail.md` 신규 — 토큰 = issuance date + scope + next rotation due. 90일 회전.
  2. GitHub repo 의 `CLOUDFLARE_API_TOKEN` secret 도 동일 영속.

### M-5. Observability sampling/cost 가드 0건 — head_sampling_rate=1 production 영속

- 영역: 옵저버빌리티 / 비용 안전
- 증거: `wrangler.toml:199` `[env.production.observability] head_sampling_rate = 1` (=100%). Workers Observability 는 trace event 1M/일 무료 이후 $0.60/M (Cloudflare 공식). 동시에 `[env.production.unsafe.bindings] SEARCH_RATE_LIMITER_IP limit = 60 / 60s` = 단일 IP 분당 60 = ~86400 req/day/IP 가능 = trace 86k+/IP/day. 다중 IP burst 시 trace cost 폭증.
- 위험: 시험 시즌 트래픽 surge 시 observability cost 가 ADR-025 의 cost meter (apps/batch 한정) 안에 안 잡힘 — 운영 cost spike 가 별도 surface 0.
- 권장:
  1. `head_sampling_rate = 0.1` (production) + critical event (logger.error, 5xx) 은 별도 tail sampling 으로 100% 보존. Cloudflare Workers Observability `invocation_logs.sampling` 옵션 활용.
  2. ADR-025 의 Layer 2 에 "Cloudflare Workers Observability cost" 게이지 추가 — admin-web `/telemetry` 에 cost 카드 wire-up.

### M-6. Pages 빌드 Git 통합 의존성 — Claude 자동화 break + rollback 절차 미정

- 영역: 배포 안전성
- 증거: `docs/deploy/cloudflare-pages-setup.md` §"2.2 Pages 신규 프로젝트 — Git 연결" — 진산 대시보드 클릭으로 production branch=`main` 자동 빌드. apps/web 변경 = main push = 즉시 production Pages 배포. **Pages rollback 절차 / preview deployment 검증 게이트 / build failure 알림** 모두 미정의.
- 위험: apps/web 의 잘못된 빌드(예: env var 누락, Astro build 실패 후 캐시 stale) 시 main → production. rollback = Pages Dashboard 의 "Rollback to this deployment" 수동.
- 권장:
  1. Pages production branch 를 `production` 별도 브랜치로 분리 + `main` → `production` PR 머지가 release 게이트.
  2. PR preview deployment 의 e2e smoke (curl /study HTML 응답 + API URL inline 정합) 를 ci.yml e2e job 다음 단계로 자동화.
  3. Pages rollback runbook (`docs/runbooks/pages-rollback.md`) — 절차 + token 권한.

---

## MINOR — 4건

### m-1. `[observability] head_sampling_rate = 0.1` dev 와 staging=1 / prod=1 비대칭

- `wrangler.toml:63-64,138,199`. dev=0.1 / staging=1 / prod=1 — staging 이 production 만큼 비싸다. M-5 와 묶어 staging=0.5 권고.

### m-2. CRON_GC_DAILY 단 1건 — silent-failure monitor + rate-limit-gc 의 실행 시간 cgroup 충돌 잠재

- `apps/api/src/index.ts:200,213-256` 모두 같은 03:00 UTC cron 에서 sequential `ctx.waitUntil((async () => { ... rate-limit GC ... silent-failure ... })())`. rate-limit GC 가 데이터 누적으로 CPU 50ms 한도 초과 시 silent-failure monitor 실행 안 됨 (silent 자체). 권고: cron schedule 분리 (`0 3 * * *` + `15 3 * * *`) 또는 each `ctx.waitUntil()` 호출 분리로 독립.

### m-3. wrangler.toml 의 `database_id` 평문 + git 추적 — 정상이지만 rotation 시 추적성

- `wrangler.toml:133,194`. D1 database_id 는 secret 아님 (Cloudflare ID), 단 만에 하나 DB 재생성 시 history 가 git log 에 남도록 production-migration-status.md 와 sync.

### m-4. settings.local.json 의 allow rule 누적 — 정리 부재

- `.claude/settings.local.json` 의 `permissions.allow` 가 일회성 sed/echo 명령으로 가득. 매 세션 재발화 시 동일 명령 추가. 정리 SOP 부재.

---

## Devil's Advocate

각 CRITICAL/MAJOR 에 대해 "이미 Cloudflare 기본값이 해결할 가능성":

- **C-1**: Workers Observability `enabled = true + head_sampling_rate = 1` 만으로 logger.error 가 Cloudflare Dashboard `Logs` UI 에서 사후 조회 가능 (~3일). 진산 1인 운영자라 매일 morning 에 dashboard 확인 + silent-failure 가 시간당 ~수 건 이하 가정이면 push 알림 없이도 24h 내 대응 가능. **반박**: 이 가정이 시험 시즌(트래픽 ×10) 에 깨진다 — 사용자 채널 (이메일/카톡) 이 발견 경로가 되면 운영 신뢰도 손상.
- **C-2**: 진산 단독 사용자 = 단일 wrangler whoami token = manual deploy 가 휴먼 에러 적다 (이중 검토 0 이지만 deploy 빈도 = 주 1회 미만). **반박**: ADR-042 BC/BR 정책 enforce 가 사람의 머리에 의존 = 6개월 후 망각 risk + Year 2 폭증 시 자동화 0 가 폭주의 단일 source.
- **C-3**: Cloudflare D1 Time Travel 30일은 **자동 활성** (Cloudflare 기본값). 사용자 데이터 15 rows 라 manual restore 충분. **반박**: Cloudflare 계정 정지 / 단일 벤더 자체 장애 시 0; 또한 Time Travel 의 SLA (RPO/RTO) Cloudflare 공식 명시 없음 — production에서 실 테스트해본 적 없음 = 신뢰 0.
- **C-4**: 진산 1인 = 도난/유출 risk 작다 + secret 모두 32B+ 강도. **반박**: webhook HMAC 은 PG 측 incident 가 trigger 인데 PG 측 SOP 의존성을 어디에도 명시 안 함. 또한 IP_PEPPER 회전 = 모든 hash 재계산 필요 — 미리 dual-pepper 정책을 ADR 로 lock 해야 회전 가능.
- **M-1~M-6**: 6 건 모두 "진산 1인 + 작은 데이터 + 시험 시즌 전 적용" 의 안전 마진 안에 있다. **반박**: 이 마진은 launch+90일 까지만 유효. 본 리뷰 시점 (2026-05-29) ~ launch 직전 (~3개월) 안에 closure 권고.

---

## 다른 페르소나가 못 볼 각도

- **refactoring-expert** 는 코드 가독성 / 모듈 경계 본다 — 운영 중 cron 충돌 (m-2) 처럼 "동작은 하나, 운영 시점에 silent" 인 패턴은 본 페르소나 영역.
- **performance-engineer** 는 런타임 throughput 본다 — observability sampling cost (M-5) 처럼 "런타임 OK 인데 청구서가 폭발" 은 본 페르소나 영역.
- **quality-engineer** 는 테스트 커버리지 본다 — CI 의 deploy gate 부재 (C-2) 는 본 페르소나 영역.
- **backend-architect** 는 데이터 모델 본다 — migration rollback SQL 작성 (M-3) 의 "운영 시점 회복 가능성" 은 본 페르소나 영역.
- **본 페르소나 고유**: 새벽 3시 / 시험 시즌 / Year 2 horizon 의 운영 catastrophe 시나리오 + Cloudflare 단일 벤더 lockin 의 실효성 점검.

---

## On-call Runbook 부재 영역

| 시나리오                                  | runbook 존재?                         | 진단 단계 정의? | 비고                                                  |
| :---------------------------------------- | :------------------------------------ | :-------------- | :---------------------------------------------------- |
| Worker 5xx burst (register, login, study) | ❌                                    | ❌              | `production-deployment.md` 는 첫 배포 절차만          |
| silent-failure 임계 초과                  | ⚠️ ADR-043 + monitor 코드             | ❌              | Email Routing carry-over (C-1)                        |
| Cron 미실행 / cron timeout                | ❌                                    | ❌              | wrangler tail 외 zero                                 |
| D1 Time Travel restore                    | ❌                                    | ❌              | ADR-042 §2 carry-over `d1-disaster-recovery.md` (C-3) |
| D1 schema drift (CI 감지 후)              | ⚠️ d1-schema-drift.yml 의 stderr hint | ❌              | "원인 후보 3개" 출력만, 결정 매트릭스 0               |
| Vectorize 인덱스 손상 / 재구축            | ❌                                    | ❌              | 794 vector 재인덱싱 cost / 시간 미정                  |
| webhook HMAC secret 유출                  | ❌                                    | ❌              | dual-write window 미정 (C-4)                          |
| Cloudflare 계정 정지                      | ❌                                    | ❌              | 단일 벤더 lockin 실효 검증 부재                       |
| Pages production 잘못된 빌드              | ❌                                    | ❌              | Pages rollback 절차 미문서화 (M-6)                    |
| 결제 webhook PG 5xx burst (Phase 3)       | ❌                                    | ❌              | Phase 3 launch 직전 작성 의무                         |

총 10 시나리오 중 runbook + 진단 단계 둘 다 정의된 것 = 0건. ADR/monitor 1차 영속만 1건 (silent-failure).

---

## 시험 시즌 사고 대응 매트릭스

5월말 시험 = 직전 1개월 트래픽 폭증. 현재 (2026-05-29) ~ 2027-05 (가정) 까지 약 12개월 launch + 시즌 준비 가능.

| 증상                                    | 1차 진단                                     | 1차 복구                          | 자동 esc                        | 부재 항목                                                           |
| :-------------------------------------- | :------------------------------------------- | :-------------------------------- | :------------------------------ | :------------------------------------------------------------------ |
| /api/auth/register 5xx 폭증             | wrangler tail (manual)                       | wrangler rollback                 | ❌                              | Logpush + Email Routing (C-1)                                       |
| /api/study/next p95 > 2000ms            | wrangler tail + master-dashboard d1_slo 카드 | search rate-limit 60→30 임시 강화 | ❌                              | dashboard alarm 활성 (master-dashboard.md §2 임계 정책 초안만)      |
| FSRS 학습 데이터 부정확 / streak 0 누적 | wrangler tail                                | (없음)                            | silent-failure monitor critical | Email Routing (C-1)                                                 |
| 결제 webhook 5xx (PortOne, Toss)        | wrangler tail                                | (없음)                            | ❌                              | HMAC secret rotation runbook (C-4), webhook PG runbook 부재         |
| D1 throughput 한도                      | dashboard                                    | (없음)                            | ❌                              | D1 SLO 게이지 wire-up (master-dashboard.md §5 BATCH-1 wire-up 의무) |
| Workers AI (bge-m3) cost 폭증           | Anthropic 콘솔 (BATCH 무관, 이건 Workers AI) | rate-limit search 60→0            | ❌                              | Cloudflare Workers AI cost 게이지 부재                              |
| Pages 빌드 실패                         | Cloudflare Pages dashboard                   | Pages 이전 deployment rollback    | ❌                              | Pages rollback runbook (M-6)                                        |
| Vectorize 쿼리 실패 (v.matches 0건)     | wrangler tail                                | graph-only path 우회              | ❌                              | (S5-3 graph walk 격리로 부분 완화)                                  |

핵심 패턴: **manual = wrangler tail / 진산 dashboard 시야 안에 들어와야만 인지**. 자동 에스컬레이션 0건. silent-failure monitor 가 유일한 자동 분류 → 그러나 push 채널 0 (C-1).

---

## Year 2 운영 폭발 점검

- **exam_id 5 테이블 ADD** (Hard Rule 16 Year 2 전환): ADR-042 BR migration 2-step deploy 적용. 자동화 0 (C-2) 면 매 step manual + 7일 모니터 = 진산 시간 surge.
- **Vectorize 인덱스 N배** (시험별 분리 또는 metadata filter): 인덱스 backup 0 (C-3) 가 직격.
- **시험별 secret/config**: secret rotation 정책 0 (C-4) 가 시험별 webhook secret 분리 시 폭증.
- **운영 dashboard**: master-dashboard.md §1 의 8 게이지 중 actual wire-up 0건 (§5 BATCH-1 진입 직전 PR 의무 — 미진행). Year 2 = 게이지 × 시험 수 = 폭증 surface.
- **Cron 분기**: 현 단일 cron `0 3 * * *` (m-2). Year 2 backup / GC / silent-failure / exam_id GC 등 4+ 작업 = 분리 의무.

---

## 단일 벤더 락인 (ADR-022) 자기 검증

ADR-022 가 의도된 트레이드오프임을 인정하나 운영 시나리오 실효 점검:

- **Cloudflare 전체 장애** (지역 또는 글로벌): fallback 0건. 의도된 트레이드오프이나 시험 시즌 D-day 와 겹치면 직격 risk. 권고: 사용자 공지 페이지를 Cloudflare 외부 (예: 진산 개인 NAS) 에 사전 준비 + `status.thepick.app` 외부 ping 페이지.
- **Cloudflare 계정 정지**: R2 백업이 같은 계정이면 동시 정지. 권고: R2 외 별도 cold backup (개인 NAS + S3 Glacier mirror) — ADR-006 §주석 인정만, 자동화 0.
- **D1 Time Travel SLA**: Cloudflare 공식 SLA 없음 (best-effort). 의존 시 실 테스트 1회 + 결과 영속 의무.
- **단일 wrangler API token = single point of compromise**: token 회전 정책 0 (M-4). 토큰 유출 시 모든 영역 (Workers, D1, Pages, Vectorize) 접근.

권고: ADR-022 의 §"리스크 완화" 에 위 4 항목을 명시적 carry-over 로 기록 + Year 2 진입 시 ADR 자기 갱신 의무.

---

## 종합 권고 우선순위

| 순위 | 항목                                           | 영역          | 작업량                          | 권장 시점                      |
| :--: | :--------------------------------------------- | :------------ | :------------------------------ | :----------------------------- |
|  1   | C-1 Email Routing 활성 + Logpush → R2          | 알림          | 3~5h                            | G-S5 측정과 동일 chunk         |
|  2   | C-2 deploy.yml + GH Environments               | CI/CD         | 4~6h                            | Phase 3 launch chain 진입 직전 |
|  3   | C-3 d1-disaster-recovery.md + R2 backup cron   | DR            | 3h + 1h cron                    | C-1 직후                       |
|  4   | C-4 secret-rotation.md + ADR                   | 시크릿        | 2h ADR + 1h SOP                 | Phase 3 launch 직전            |
|  5   | M-2 + M-3 migration PR template + rollback SQL | 마이그        | 2h template + 매 migration 30분 | 본 sprint                      |
|  6   | M-6 Pages rollback runbook + preview gate      | 배포          | 3h                              | Phase 3 launch 직전            |
|  7   | M-5 observability sampling 조정 + cost 게이지  | 비용          | 2h                              | M-1 ~ M-4 와 묶음              |
|  8   | M-1 0020 결번 명시 + M-4 wrangler token trail  | 마이그/시크릿 | 1h                              | 본 sprint quick-win            |

총 작업량 ~25h. 진산 단독 의사결정 + Claude 자동화 가능 영역이라 12개월 launch horizon 안에 충분.

---

## 인계 메모

- 본 리뷰는 2주 전 `review-20260511-111048-phase2-eval-mvp-persona5-devops.md` 의 잔여 미흡수 + 그 이후 신규 발현 부채를 중심으로 재진단. ADR-042/043 + silent-failure monitor + login_history audit + d1-schema-drift CI 는 이미 영속 (중복 보고 없음).
- CRITICAL 4건 모두 "코드 변경 0 + ADR/runbook + cron 1건" 으로 closure 가능 — 진산 결재 후 Claude 자동 진행 가능 영역.
- G-S5 측정 게이트 (`project_g_s5_golden_data_gap`, golden 확보 진산 결재 단계) 와 본 리뷰 CRITICAL 은 직교 — 동시 진행 가능.
- 시험 시즌 D-day 직격 시나리오 (Pages 빌드 실패 / D1 throughput / Vectorize 손상 / silent-failure burst) 모두 push 알림 0 + runbook 0 가 공통 root cause.
- 본 리뷰의 "다른 페르소나가 못 볼 각도": Cron 충돌 (m-2) / observability cost (M-5) / wrangler token trail (M-4) / 단일 벤더 lockin 실효 점검.
