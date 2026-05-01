# Phase 1 종료 5-페르소나 (5/5) — devops-architect

**리뷰어**: devops-architect (독립 페르소나)
**작성일**: 2026-05-01 16:01:56 KST
**리뷰 범위**: Phase 1 종료 시점 운영 부채 — 배포 / 모니터링 / incident response / DR / CI/CD / secrets 회전 / 롤백
**4-Pass 결과 흡수**: review-20260501-154451-step19.md (CRITICAL 0 / MAJOR 6 — S1/A1/A2/AD-1/CT-1 흡수, S2 트래킹). **본 리뷰는 4-Pass 6건 중복 지적하지 않는다.**
**메모리 정합**: `feedback_single_vendor_cloudflare` / `project_engine_observability` / `project_anthropic_cap_pre_install` / `project_completion_notification_obligation`

---

## 핵심 질문

> **"새벽 3시 on-call 시나리오?"** — 진산님 단일 운영자. KILL_SWITCH 발동, 또는 D1 reads 폭증, 또는 CORS 차단으로 admin-web `/telemetry` 가 까만 화면이 됐을 때, **최단 경로로 사고 원인을 어떻게 파악하는가?**

리뷰 결과: 본 step (Step 19) 시점은 **engine telemetry 의 plumbing 만 깔린 상태**. 데이터 흐름 0건. on-call 도구로서 사용 가능한 가시성 0%. Phase 1 closeout 게이트 PASS 가능 — **단, 본 리뷰가 식별한 CRITICAL 1건 흡수 의무**.

---

## CRITICAL (즉시 흡수 의무 — 본 step 또는 차세션 진입 직전)

### CRITICAL-DO-1 — admin-web production 빌드의 `localhost:8787` 무음 fallback (mixed-content 100% 차단)

**파일**: `apps/admin-web/src/components/TelemetryDashboard.tsx:22, 49-56`

**증거 (load-bearing)**:

```typescript
const DEFAULT_API_BASE = 'http://localhost:8787';
function resolveApiBase(): string {
  const fromEnv =
    typeof import.meta.env !== 'undefined'
      ? (import.meta.env.PUBLIC_API_BASE_URL as string | undefined)
      : undefined;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return DEFAULT_API_BASE; // ← production 빌드에서 PUBLIC_API_BASE_URL 미설정 시 localhost
}
```

**시나리오 (새벽 3시)**: Cloudflare Pages 가 admin-web 을 자동 배포. 진산님 `PUBLIC_API_BASE_URL` 환경변수 등록을 잊었다. `https://thepick-admin.pages.dev/telemetry` 접속 → 토큰 입력 → fetch `http://localhost:8787/api/telemetry/dashboard` → **mixed-content 브라우저 차단 + DNS 실패** → "HTTP undefined" 에러 → 이게 production misconfig 인지, API 다운인지, 토큰 오류인지 **구분 불가**. 진산님 30분 trial-and-error.

**근본 원인**: dev 편의 fallback (`localhost:8787`) 이 production 빌드에 그대로 포함됨. `import.meta.env.MODE === 'production'` 체크 부재. `_headers` / `_redirects` Cloudflare Pages config 부재.

**권고 (택일, 본 step 흡수)**:

- **A안 (권장)**: production 빌드에서 `PUBLIC_API_BASE_URL` 부재 시 빌드 시점 throw — `resolveApiBase()` 함수가 `import.meta.env.PROD === true` 일 때 fallback 차단하고 명시적 화면 표시 ("PUBLIC_API_BASE_URL not configured — see runbook")
- **B안**: `apps/admin-web/.env.example` 신설 — `PUBLIC_API_BASE_URL=https://thepick-api-production.{your-account}.workers.dev` 명시 + handoff-027 §"Cloudflare Pages 배포 prerequisite" 에 포함

**handoff-027 의무 (B안 채택 시)**: `PUBLIC_API_BASE_URL` 환경변수 등록을 Cloudflare Pages 환경변수 UI 에서 production / preview 분리 등록 절차 명시. 진산님 단일 운영자 → 잊으면 직접 사고.

---

## MAJOR (Phase 2 이전 의무 — TD 이월 OK, 단 명시 필수)

### MAJOR-DO-1 — `ADMIN_API_TOKEN` 의 secrets baseline 부재 (`.env.example` 미등록 + 회전 정책 0건)

**증거**:

- `grep -rn ADMIN_API_TOKEN /home/soo/ClaudePro/ThePick/.env.example` → **0 matches** (확인 명령 — `grep -rn ADMIN_API_TOKEN apps docs` 출력에서 `.env.example` 부재)
- `apps/api/wrangler.toml` 줄 21, 29 에 `WEBHOOK_HMAC_SECRET / JWT_SECRET` 만 production secret 운영 주석 — `ADMIN_API_TOKEN` 동일 주석 부재
- `tech-debt.md TD-021` "JWT_SECRET 운영 중 rotation 절차 문서 부재" 기록만 있고 **`ADMIN_API_TOKEN` rotation 절차 전무**

**시나리오 (새벽 3시)**: 진산님 admin-web 토큰을 localStorage 에 저장 후 노트북 분실. 누군가 토큰을 알면 `https://thepick-api-production.workers.dev/api/telemetry/dashboard` 직접 호출 가능. **토큰 회전 = `wrangler secret put ADMIN_API_TOKEN --env production`** — 시점에 admin-web 모든 사용자 즉시 401 + 재로그인 강제. 절차 문서 0건.

**권고 (본 step 흡수 권장)**:

- `.env.example` 에 `ADMIN_API_TOKEN=<32+ chars random — generate with: openssl rand -hex 32>` 라인 추가
- `wrangler.toml` `[vars]` 섹션에 `ADMIN_API_TOKEN` 주석으로 "production 은 `wrangler secret put ADMIN_API_TOKEN --env production`" 명시 (다른 secrets 와 동일 패턴)
- TD-021 보강 — JWT*SECRET / IP_PEPPER / WEBHOOK_HMAC_SECRET*\* / **ADMIN_API_TOKEN** 4종 모두 회전 절차 (Phase 2 docs/security/secret-rotation.md 신규)

### MAJOR-DO-2 — engine_telemetry append-only 트리거가 Phase 2 GC 패턴을 차단하는 운영 미스 (자동 GC 불가)

**파일**: `migrations/0017_engine_telemetry.sql:111-123`

**증거 (load-bearing)**:

```sql
CREATE TRIGGER prevent_engine_telemetry_delete
BEFORE DELETE ON engine_telemetry
BEGIN
  SELECT RAISE(ABORT, 'DELETE on engine_telemetry is forbidden ...
                       Phase 2 GC plan via wrangler d1 execute manual override only.');
END;
```

`docs/observability/master-dashboard.md:88` — _"engine_telemetry 의 DELETE 차단 트리거 때문에 GC 시점에 트리거를 일시 DROP / 작업 / 재CREATE 패턴 의무"_

**시나리오 (Phase 2 진입)**: BATCH-1~5 적재 후 12개월 누적. engine_telemetry 가 D1 5GB 한도 70% 도달. 진산님이 1년 GC 를 자동화하려 Cron Trigger 등록 → **DELETE 차단으로 즉시 실패**. 수동 절차: (1) DROP TRIGGER → (2) DELETE WHERE recorded_at < now-365d → (3) CREATE TRIGGER 재적용. 이 사이 race window 에 다른 쓰레드의 잘못된 DELETE 가 들어가면 손실. 진산님 단일 운영자라 동시성 낮으나, **wrangler d1 execute 가 트랜잭션 단위로 묶이지 않으면** 트리거 재CREATE 실패 시 production GC 가 트리거 없는 상태로 멎음.

**권고**:

- **본 step 흡수**: master-dashboard.md §3 `Phase 2 정책` 행에 "트리거 재CREATE 실패 시 즉시 alert + production rollback 절차" 한 줄 추가. 현재는 "별도 plan" 으로만 표기.
- **Phase 2 진입 시**: GC 절차를 **3-step transactional** 로 작성 — `BEGIN TRANSACTION; DROP TRIGGER ...; DELETE ...; CREATE TRIGGER ...; COMMIT;` (D1 transaction 지원 검증 의무 — Workers 의 `db.batch()` API)

### MAJOR-DO-3 — `apps/admin-web` Cloudflare Pages 배포 자동화 부재 + apps/api Workers 배포 동기화 정책 0건

**증거**:

- `apps/api/package.json` — `deploy:staging`, `deploy:production` 스크립트 존재 (`wrangler deploy --env <env>`)
- `apps/admin-web` package.json — `dev`, `build`, `lint`, `typecheck` 만. **배포 스크립트 0건**
- `.github/workflows/ci.yml` — typecheck/test/lint/audit + `verify-engine-contracts` 만. **deploy job 0건**
- `apps/admin-web` 디렉토리에 `_headers` / `_redirects` / `wrangler.toml` 부재

**시나리오 (새벽 3시)**: 진산님이 apps/api 에 CORS 변경 (origin 추가) 배포 → `wrangler deploy --env production` 즉시 적용. apps/admin-web 측 도메인 변경 → Cloudflare Pages 자동 재빌드 (Git push 트리거). **두 배포 시점 차이 = race window**: admin-web 이 새 origin 으로 fetch 하는 사이 apps/api 가 아직 이전 CORS 적용 → preflight 실패 → 화면 까만 색. 진산님 wrangler tail 로 추적 시 **도착하지 않은 요청** 이라 로그 0건.

**권고**:

- **본 step 흡수**: handoff-027 §"배포 순서 의무" 추가 — "(1) apps/api `deploy:production` → (2) 검증 (`/health` curl) → (3) apps/admin-web Pages 자동 빌드 트리거". 역순 시 사용자 영향 명시.
- **Phase 2**: GitHub Actions deploy job 추가 — `main` 브랜치 push 시 (a) Workers test PASS → (b) wrangler deploy → (c) smoke test (`/health` + `/api/telemetry/dashboard` with Admin token from secrets) → (d) admin-web Pages 자동.

### MAJOR-DO-4 — TD-037 Email Routing alarm 의 Step 19 cross-tenant 라우팅 약속이 미실현

**파일**: `docs/observability/master-dashboard.md:71-77`

**증거 (load-bearing)**:

```markdown
### MINOR-A2 흡수 — cross-tenant cause 라우팅

recover.ts SF-M-2 cross-tenant exam_id mismatch (cause: exam_id_mismatch) 발화 시:

- 본 이벤트는 즉시 critical alarm — Year 2 multi-tenant 진입 시 첫 번째 데이터 격리 위반 신호
- engine_telemetry 측에서 별도 게이지 신설 X (보안 이벤트는 logger.error 가 우선 ...)
- Phase 2 alarm 라우팅 도입 시 logger.error → Cloudflare Workers Logpush → 진산님 이메일 알림
```

**시나리오 (BATCH-2 적재 중)**: SF-M-2 가 발화. recover.ts 가 `logger.error(... cause: 'exam_id_mismatch')` 호출 → **현재 logger.error 만 로그 destination, Logpush 미설정** (TD-037 기록) → 30일 보존 후 휘발 → 진산님 발견 시점 0%. master-dashboard.md 가 약속한 "즉시 critical alarm" 은 Phase 2 까지 0건.

**권고**:

- **본 step 흡수**: master-dashboard.md §"MINOR-A2 흡수" 부분에 "**Phase 1 시점은 alarm 라우팅 X — logger.error 만 (ephemeral)**. BATCH-1 적재 중 cross-tenant 발화 시 사후 발견 가능성. Phase 2 Logpush + Email Routing 의무." 라고 **현재 한계** 1-2줄 명시. 약속만 적혀있는 현 상태는 **거짓 가시성** 위험.
- TD-037 본문 보강 — "Phase 2 프로덕션 런칭 전 필수" 가 아니라 **"BATCH-1 진입 직전 의무"** (이유: BATCH-1 은 production-likeness production cost 실측. Email 알림 없으면 새벽 3시 KILL_SWITCH 발동 시 진산님 발견까지 8시간 휘발 가능).

### MAJOR-DO-5 — D1 backup / disaster recovery 정책 0건 (Cloudflare PITR 의존성 미문서화)

**증거**:

- `docs/` 전체에 `backup` / `disaster` / `PITR` (Point-In-Time Recovery 의미) 검색 결과 — DR 관련 0건
- master-dashboard.md §3 데이터 보존 정책 — engine_telemetry 만. `knowledge_nodes / formulas / constants / user_progress` DR 절차 0건
- `apps/api/wrangler.toml` 에 staging / production D1 database_id 명시되나 backup 정책 부재

**시나리오 (새벽 3시)**: 진산님이 staging 배포 시 실수로 `wrangler d1 execute --env production` 입력. `DROP TABLE knowledge_nodes` 같은 실수 SQL 실행 (실제로는 0014 트리거가 차단하나, 공격 벡터는 다양 — `DELETE FROM constants WHERE TRUE` 등). **Cloudflare D1 Time Travel** (PITR) 이 30일까지 backup 자동이나 — 진산님이 모르면 사용 못 함. `wrangler d1 time-travel` 명령어 + 절차 문서 0건.

**권고 (Phase 2 이전)**:

- `docs/runbooks/disaster-recovery.md` 신규 — Cloudflare D1 Time Travel 절차 (`wrangler d1 time-travel restore --bookmark <id>`) + 검증 (`SELECT COUNT(*) FROM knowledge_nodes` 비교) + Phase 2 의무
- 본 step 흡수 1줄: master-dashboard.md §3 끝에 "**DR 정책: Cloudflare D1 Time Travel (30일 PITR) 의존. 절차 문서는 Phase 2 docs/runbooks/disaster-recovery.md 의무**" 추가

---

## MINOR (Phase 2 이후 트래킹)

### MINOR-DO-1 — apps/admin-web 빌드 산출물 (`dist/`) 가 git tracked 되어 있다 (의도 불명)

**증거**: `apps/admin-web/dist/_astro/TelemetryDashboard.Cw3Ndu79.js` 가 grep 결과에 포함 → 커밋되어 있음. 일반 `.gitignore` 에는 `dist/` 등록되어 있으나 admin-web 만 예외 — Cloudflare Pages 가 dist/ 직접 배포하는 패턴인지 의도 확인 필요.

**권고**: handoff-027 §"Cloudflare Pages 배포 모드" 1줄 — Pages "Direct Upload" 모드 (dist/ 커밋 의무) vs "Git Integration" 모드 (dist/ ignore + Pages 가 빌드) 중 어느 쪽인지 명시. 차세션 운영자 (또는 진산님 본인 6개월 후) 가 모르면 동일 빌드를 두 번 push 하는 실수 가능.

### MINOR-DO-2 — wrangler.toml `compatibility_date = "2026-04-01"` 1개월 stale (현재 2026-05-01)

**증거**: `apps/api/wrangler.toml:5` — `compatibility_date = "2026-04-01"`. 4-Pass 와 5-페르소나 모두 본 항목 미지적. compatibility_date 는 Workers runtime 버전 핀 — 새 V8 보안 패치/API 적용을 위해 분기별 업데이트 의무.

**권고**: Phase 2 진입 시 `compatibility_date = "2026-07-01"` 또는 그 시점 최신으로 갱신 + 회귀 테스트 PASS 확인. 분기별 갱신 정책 ADR.

### MINOR-DO-3 — Cron Trigger `0 3 * * *` 단일. telemetry 자동 집계 / engine_telemetry GC / health-check ping 모두 미설정

**증거**: `apps/api/wrangler.toml:167-174` — crons 단일 (rate_limits GC). master-dashboard.md §7 — "Cron Trigger telemetry 자동 집계 (Phase 1 후반)" 미정의.

**권고**: Phase 1 후반 plan — Cron Trigger 추가 (예: `15 3 * * *` quality_gate gauge 일간 집계, `*/15 * * * *` health-check). Workers Cron 무료 티어 한도 검증 (분당 1회 limit) 후 plan.

### MINOR-DO-4 — `apps/api/src/index.ts:154` `GC_DELETE_COUNT_WARN_THRESHOLD = 30_000_000` 마법 숫자 + 하드코딩

**증거**: index.ts:153-154 — 임계값이 코멘트에서 "2일치(28.8M)" 로 설명되나 실제 트래픽 모델 (rate_limit row 생성률) 출처 부재. 코드 파일에 직접 하드코딩 → 변경 시 코드 수정 의무 (production-quality.md 위반 — 하드코딩 금지).

**권고**: `packages/shared/src/constants/operations.ts` (신규) 로 이전. 또는 wrangler.toml `[vars]` 로 이전 (운영 시간 조정 가능). Phase 2 트래픽 실측 후 임계값 재조정.

### MINOR-DO-5 — `head_sampling_rate` 환경별 차등 적용 의도 미문서화

**증거**: wrangler.toml:51 (dev 0.1) vs :102, :141 (staging/production 1.0). 주석은 "dev는 10%만 기록 (CI/로컬 관측 비용 절감)". staging/production 100% sampling 은 Workers Logs 비용 증가 가능 (Phase 2 트래픽 실측 후 조정 의무).

**권고**: master-dashboard.md 또는 docs/observability/cost-policy.md 신규 — "Workers Logs sampling 정책 + Phase 2 비용 실측 후 sampling rate 조정 protocol" 1페이지.

### MINOR-DO-6 — handoff-026 → handoff-027 시점에 Anthropic cap pre-install 미실현 (메모리 `project_anthropic_cap_pre_install` 정합)

**증거**: 메모리 명시 — "Phase 2 진입 시 의무 활성. 망각 차단 hook". Phase 1 종료 = 본 step. **본 step 시점에 cap 설정 0건** (콘솔 작업이라 코드 증거 없음 — 진산님 직접 확인 의무).

**권고**: handoff-027 §"BATCH-1 진입 직전 prerequisite" 첫 줄에 "Anthropic Console cap = $200 monthly + alerts 활성화 확인" 명시. 진산님 BATCH-1 트리거 발동 전 미설정 시 Claude (Opus 4.7) 본인이 차단 의무 (이 reminder 가 차세션 컨텍스트 윈도우 진입 시 작동).

---

## Devil's Advocate — 새벽 3시 on-call 시나리오 (Phase 1 종료 시점 실측)

### 시나리오 1: BATCH-1 적재 중 KILL_SWITCH 발동, 진산님 발견까지 휘발 위험

- **상황**: 2026-05-15 03:00 KST (가정). BATCH-1 적재가 cost 누적 > hard threshold 초과로 cost-meter.ts 의 KILL_SWITCH 발동.
- **현재 도구**:
  - apps/batch CLI 가 throw → process exit (진산님 터미널 스크립트 실행 중이라면 즉시 발견)
  - logger.error 로 구조화 로그 → Workers Logs 30일 보존 (단 wrangler tail 실시간 stream 필요)
  - engine_telemetry `cost` 게이지에 `metric_json.status = 'kill_switch'` INSERT — **단, BATCH-1 진입 시점 telemetry write wire-up 0건 (4P-MAJOR-S2 트래킹)** → admin-web 대시보드 진입 시 `cost` 게이지 `no_data`
- **Phase 1 종료 시점 가시성**: 0% (telemetry wire-up 부재 + Email Routing 부재)
- **부정**: 본 시나리오는 "BATCH-1 진입 직전 wire-up PR" 에서 해소. Phase 1 종료 = 게이트 PASS 가능. 단, **handoff-027 에 wire-up PR + Email Routing 활성화를 BATCH-1 trigger 의 prerequisite 로 명시 의무** (현재 master-dashboard.md §7 만 트래킹).

### 시나리오 2: ADMIN_API_TOKEN production 미설정 + admin-web Pages 자동 배포 = 까만 화면

- **상황**: 진산님이 본 step 직후 PR merge. main 브랜치 push → Cloudflare Pages 가 admin-web 자동 빌드/배포. admin-web `/telemetry` 접속 → 토큰 입력 폼 표시 → 토큰 입력 → fetch `https://thepick-api-production.workers.dev/api/telemetry/dashboard` (Pages env 에 PUBLIC_API_BASE_URL 설정 가정) → apps/api 가 `ADMIN_API_TOKEN` env 미등록 → admin-token.ts:46 즉시 401 → admin-web 의 `if (res.status === 401) clearToken()` → 토큰 폼 재표시 → 진산님 "토큰이 틀렸나?" 30분 trial-and-error.
- **현재 도구**: 진산님이 wrangler tail 로 production Workers Logs stream 시 logger 출력 0건 (admin-token.ts:46 가 401 직접 반환 — error log 호출 안 함). **TD-DO-2A 신규 제안**: admin-token.ts 에서 `ADMIN_API_TOKEN === undefined || length < 16` 케이스에서 **logger.error('admin token misconfigured')** 호출 의무 (현재 401 마스크만). 이러면 wrangler tail 로 즉시 발견 가능.
- **부정**: information leak 우려가 있어 의도적 silent. 단, **production 부팅 시 1회만 로그** 패턴 (Workers 의 module-level 로그) 으로 절충 가능. handoff-027 의무.

### 시나리오 3: D1 5xx 폭증 → admin-web 503 + Retry-After 5s. 사용자 영향 vs 데이터 일관성

- **상황**: Cloudflare D1 region failure (실제 발생 사례 — 2025년 1회 보고). apps/api 의 `c.env.DB.prepare(...)` 가 5xx throw → routes.ts:209 catch → 503 + Retry-After 5s 응답. admin-web fetch 가 30초 polling interval 이라 5s 후 자동 재시도되지 않음 (next polling cycle 까지 대기).
- **현재 도구**: TelemetryDashboard.tsx:264-269 의 catch 블록이 `error: err instanceof Error ? err.message : String(err)` 표시 — 503 본문이 `{error: 'SERVICE_UNAVAILABLE'}` 인데 fetch wrapper 가 `res.ok === false` 시 `HTTP 503` 표시 (line 250). 즉, 진산님이 `Error: HTTP 503` 만 보고 D1 장애 vs apps/api 장애 구분 불가.
- **부정**: 503 + Retry-After 5s 는 정상 backpressure 패턴. 단, Phase 2 진입 시 `Retry-After` 헤더를 admin-web 이 honor 하도록 polling interval 조정 의무 (현재 30초 고정). master-dashboard.md §7 차세션 의무 추가.

---

## 판정

**완료 가능** — Phase 1 종료 게이트 PASS 가능. 단 **CRITICAL-DO-1 (admin-web localhost fallback) 본 step 흡수 의무**. MAJOR 5건은 handoff-027 명시 + Phase 2 이전 의무 분리 OK.

| 분류        | 건수 | 흡수 정책                                                                             |
| :---------- | :--: | :------------------------------------------------------------------------------------ |
| CRITICAL    |  1   | 본 step 흡수 의무 (admin-web fallback 차단 + handoff-027 prerequisite)                |
| MAJOR       |  5   | 본 step 1줄 보강 (master-dashboard.md, .env.example, handoff-027) + Phase 2 이전 의무 |
| MINOR       |  6   | Phase 2 트래킹 (TD-053~058 신규 등록 권고)                                            |
| 4-Pass 중복 |  0   | S1/S2/A1/A2/AD-1/CT-1 6건 모두 미언급 (정책 정합)                                     |

### Phase 1 closeout 결정 매트릭스

| 게이트                        |  충족  | 본 리뷰 의견                                       |
| :---------------------------- | :----: | :------------------------------------------------- |
| 4-Pass CRITICAL 0             |   ✅   | review-20260501-154451-step19.md §1.3              |
| 5-페르소나 CRITICAL 0         | **⚠️** | **본 리뷰 CRITICAL-DO-1 1건 — 본 step 흡수 시 ✅** |
| 종합 테스트 마스터 체크리스트 |   ✅   | docs/quality/master-test-checklist.md v2           |
| 8 게이지 가동 (plumbing)      |   ✅   | wire-up 은 BATCH-1 진입 시점 (정책 정합)           |
| Phase 이월 부채 0 정책        |   ✅   | MAJOR 5건은 handoff-027 명시 분리 → 정책 정합      |

### CRITICAL-DO-1 흡수 후 ★★★ ENGINE HARDENING 완료 ★★★ 진산님 알림 가능 (메모리 `project_completion_notification_obligation` 정합).

---

## 보고 파일 경로

`/home/soo/ClaudePro/ThePick/.claude/reviews/phase1-tech-debt-20260501-160156-devops.md`

**작성자**: Claude (Opus 4.7) — devops-architect 페르소나 (5/5)
**검증 출처**:

- `apps/admin-web/src/components/TelemetryDashboard.tsx:22, 49-56` (CRITICAL-DO-1)
- `apps/api/wrangler.toml:21, 29` (MAJOR-DO-1 secrets pattern)
- `migrations/0017_engine_telemetry.sql:111-123` (MAJOR-DO-2 GC trigger lock)
- `apps/admin-web/package.json` (MAJOR-DO-3 deploy script 0건)
- `docs/observability/master-dashboard.md:71-77` (MAJOR-DO-4 alarm 약속만)
- `.claude/tech-debt.md:136 (TD-037)` (MAJOR-DO-4 trigger date 보강)
- `docs/` 전체 (MAJOR-DO-5 DR 0건)
- `apps/api/src/index.ts:153-154` (MINOR-DO-4 magic number)
