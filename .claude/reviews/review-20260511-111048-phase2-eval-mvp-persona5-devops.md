# 5-Persona Tech Debt — DevOps Architect (5/5)

> **Phase 종착 5-페르소나 심층 리뷰 — Persona 5/5**
> 관점: "새벽 3시 on-call 시나리오?" (운영 부채)
> 페르소나: devops-architect
> 작성 시각: 2026-05-11 11:10:48 KST
> 작성자: Claude (Opus 4.7 1M context) — Session 066

---

## 1. 리뷰 메타 (4-Pass 인계 + 중복 회피)

### 1.1 본 페르소나 본질

자동화 가능 → 의무 자동화. 시스템 신뢰성, 관측성, 빠른 복구. 모든 절차는 재현 가능 + 감사 가능 + 실패 시나리오 자동 감지·복구 설계.

### 1.2 입력 (인계)

| 입력                 | 출처                                                                | 영향                                                |
| -------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| 4-Pass 결과 7건      | Session 066 종합 4-Pass (DUMMY_HASH / ADR-005 미반영 / env 분기 등) | 중복 지적 0건 의무                                  |
| handoff-074          | `.jjokjipge/handoff-session-074.md`                                 | production redeploy 6회 + Pages 신규                |
| ADR-034/035/036      | 평가 환경 한정 임시 정책 chain — Phase 3 launch 직전 동시 복원 의무 | 운영 deadline 트래킹 부재 (★ 본 페르소나 핵심 부채) |
| 실측 production 상태 | thepick-api-production Version cf498ca0 + thepick-study.pages.dev   | redeploy chain rollback 절차 부재                   |

### 1.3 4-Pass 기존 보고 7건 (중복 금지)

`DUMMY_HASH` / `ADR-005 supersedes 표기 누락` / `dummy-verify 주석 stale` / `env 분기 모델 (PASSWORD_MIN/PBKDF2/SameSite)` / `register rate-limit 정책 검토` / `cookie TOCTOU 시나리오` / `d1-from-sqlite migration skip 검증`

→ 본 페르소나는 **위 7건을 다시 지적하지 않는다.** 그 대신 **운영 시나리오/관측성/배포 chain/복원 deadline 부채**에 집중한다.

### 1.4 리뷰 범위 (변경 파일 + 연관)

- `apps/api/wrangler.toml` (env 변수 모델, observability head_sampling_rate, cron triggers)
- `apps/api/src/index.ts` (CORS allowlist 하드코딩, logpush 의존 주석)
- `apps/api/src/auth/constants.ts` + `auth/routes.ts` (PASSWORD_MIN 4 / PBKDF2 100k / HIBP disable / SameSite 분기)
- `migrations/0028_pbkdf2_iterations_workers_compat.sql` (production 적용 검증 절차)
- `docs/deploy/cloudflare-pages-setup.md` (Pages 신규 셋업 → 절차서가 진산 dashboard 의존)
- `docs/adr/ADR-034/035/036.md` (복원 의무 chain, 임시 정책 deadline)
- `.github/workflows/ci.yml` + `d1-schema-drift.yml` (CI 정합 + 누락 게이트)
- `.husky/pre-commit` + `scripts/check-no-secrets.sh` (pre-commit 게이트)
- `docs/observability/master-dashboard.md` (8 게이지, alarm rule 초안)

---

## 2. 요약 (Bottom Line Up Front)

| 분류         | 건수 | 핵심                                                                                                                                                                                 |
| ------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CRITICAL** | 3    | 복원 chain 망각 위험 + 임시 정책 자동 만료 부재 + rollback 절차 0건                                                                                                                  |
| **MAJOR**    | 6    | redeploy chain 추적 부재 / CORS allowlist 코드내 / Pages 빌드 책임 진산 dashboard 의존 / migration 0028 production 적용 증거 0 / alarm rule 미활성 / wrangler 토큰 ad-hoc            |
| **MINOR**    | 5    | API_VERSION 0.1.0 정체 / cron telemetry GC 트리거 + DROP 패턴 SOP 부재 / pages.dev URL CORS 하드코딩 / observability head_sampling 1.0 cost 가시성 / engine_telemetry wire-up 미진척 |

**가장 위험한 운영 부채 1건:** **CRITICAL-D1 — ADR-034/035/036 복원 deadline이 코드 어디에도 컴파일 타임으로 강제되지 않는다. 외부 user 진입 시점에 "잊었습니다"가 발생하면 4자리 password + PBKDF2 100k + SameSite=None 조합으로 1주일 내 production user 100% 탈취 가능하다.**

**Phase 3 launch 운영 준비도 추정:** **42%** (§7 상세)

---

## 3. CRITICAL (3건) — 새벽 3시 on-call 직격

### CRITICAL-D1: ADR-034/035/036 복원 chain "자동 만료" 메커니즘 부재 — 외부 user 진입 시 보안 catastrophe

**증거:**

- `apps/api/src/auth/constants.ts:42` `PASSWORD_MIN_LENGTH = 4` 하드코딩
- `apps/api/src/auth/constants.ts:23` `PBKDF2_ITERATIONS = 100000` 하드코딩
- `apps/api/src/auth/routes.ts:141-146` HIBP 'pwned' 분기 주석만 (`// if (pwned.status === 'pwned') { ... }`)
- `apps/api/src/auth/routes.ts:525-527` `authCookieSameSite()` env='production' → 'None'
- ADR-034 §"복원 의무" 6항목 + ADR-035 §"검토 의무" 6항목 + ADR-036 §"복원 의무" 5항목 = 17항목 체크리스트
- **체크리스트가 markdown checklist 뿐 — CI/lint/runtime 어디에도 deadline 만료 시 빌드/배포 차단 hook 없음**

**시나리오 (새벽 3시):**

1. Phase 3 launch 1주 전 진산이 "launch 준비 가즈아" 발화
2. Claude는 본 ADR을 읽으러 가지만 17항목 중 1~2개 누락
3. 외부 사용자 100명 회원가입 (4자리 password 가능, HIBP disable, PBKDF2 100k stored)
4. 일주일 후 GPU brute-force 또는 leak으로 100명 전원 탈취
5. **PIPA 위반 + 신뢰 파탄 + 서비스 사망**

**왜 매우 위험한가:**

- 임시 정책 3건이 **하드코딩** — env var나 feature flag로 추출 안 됨
- "환경별 분기 함수 1건" 만 존재 (`authCookieSameSite`), 나머지 2건 (PASSWORD_MIN, PBKDF2)은 환경 분기 없음
- production 환경에서도 PASSWORD_MIN=4가 그대로 적용된다 (실제 현재 production cf498ca0)
- 복원 항목 17개가 산문 체크리스트라 Claude/진산 모두 잊을 가능성

**권고 (DevOps 관점, 우선순위 순):**

1. **즉시 (이번 세션 또는 차세션)**: `apps/api/src/auth/constants.ts`에 환경별 분기 함수 도입 — `getPasswordMinLength(env)` / `getPbkdf2Iterations(env)`
   - test/development: 4 / 100k
   - staging/production: 8 / 100k (Workers 제약, ADR-035 carry-over)
   - 본 변경은 ADR-034 §"평가 환경 = 진산 단독" 가정에 맞추면서 production에 약한 password 진입 불가 강제
2. **Phase 3 진입 1개월 전**: CI에 deadline 검증 step 추가 — `scripts/verify-restoration-deadline.ts`가 ADR-034/035/036 §"복원 의무" 17항목 grep + 각 항목 PASS evidence 파일 (`.claude/reports/adr-034-restoration-step1.json` 등) 존재 검증
3. **Phase 3 launch 직전**: `wrangler secret put` 으로 ENABLE_HIBP / MIN_PASSWORD_STRICT / SAMESITE_STRICT 3 flag 활성 + 마이그레이션 0029 trigger `< 600000` 복원 (또는 Argon2id 전환)

---

### CRITICAL-D2: production redeploy 6회 chain — rollback 절차 0건 + version diff 가시성 부재

**증거:**

- handoff-074 §통계: production Workers 6회 redeploy chain — `ab9f5533 → 870d87d2 → c1524d07 → 9640ceb5 → b221cd18 → b1941b5f → cf498ca0`
- Pages 4회 deploy (Step 5 + M6 + root surface + 옵션 3)
- **Version 사이 diff가 git commit과 어떻게 매핑되는지 어디에도 영속 없음** — 진산이 "Version cf498ca0가 ADR-036을 포함하는가?" 물으면 즉답 불가
- `wrangler deployments list --env production` 명령 또는 자동화 절차서 0건
- handoff-074 §주의사항에 "rollback 절차" 항목 자체 부재
- `.github/workflows/ci.yml` deploy job 없음 — production deploy가 **Claude wrangler 직접 호출** 패턴 (감사 추적 ad-hoc)

**시나리오 (새벽 3시):**

1. 진산 발화 "logout 후 다시 login하니까 500" (가상)
2. Claude는 production이 어떤 commit에 묶인 Version인지 즉시 답 못함
3. `wrangler rollback` 권한이 본 세션 토큰에 있는지도 즉시 답 못함
4. 일단 마지막 git commit 기준 redeploy 시도 → 그 commit이 production Version과 다를 가능성 있음 (chain 중 어느 단계에서 hotfix 직접 적용된 가능성)
5. 진단 1시간 + rollback 1시간 + 재배포 30분 = **2시간 30분 incident**

**왜 위험한가:**

- redeploy 6회 + Pages 4회 = 총 10회 production 변경. 그 중 ADR-036 cookie SameSite 같은 보안 critical 변경 포함
- 각 Version → commit mapping은 `wrangler deployments list` 명령으로 조회 가능하지만, **그 mapping을 영속하는 docs/deploy/ 산출물 없음**
- handoff-074는 "예상" Version만 기록 ("Session 065 종착 commit (예상): handoff-074 영속 후 push")

**권고:**

1. **즉시**: `docs/deploy/version-trail.md` 신규 — 매 production deploy 후 Version ID + git SHA + ADR/변경 요약 1줄 영속. handoff-N+1 §주의사항에 직전 deploy version 명시 의무.
2. **CI 통합 (다음 phase)**: GitHub Actions에 deploy job 추가 — main push 시 `wrangler deploy --env production` + `gh release create` + version trail markdown 자동 append
3. **rollback runbook**: `docs/runbooks/incident-rollback.md` 신규 — 시나리오별 wrangler rollback 명령 + 영향 범위 + 검증 curl
4. Cloudflare 대시보드 Workers "Tail" 즉시 활성화 절차서 — 진산이 dashboard 접근 못 할 경우 wrangler tail 명령

---

### CRITICAL-D3: migration 0028 production 적용 증거 0건 — schema drift 잠재

**증거:**

- `migrations/0028_pbkdf2_iterations_workers_compat.sql` 존재 (DROP trigger + CREATE trigger ≥ 100000)
- handoff-074 §통계: "migration count : 27 → 28 (★ 0028 추가)"
- ADR-035 §"production D1 마이그레이션 적용 의무": `wrangler d1 migrations apply thepick-db-production --remote` 명시
- **그러나 이 명령이 실제로 production에 적용되었는지 영속 증거 0건** — `.claude/reports/`에 migration apply 결과 JSON 없음
- `.github/workflows/d1-schema-drift.yml`은 매일 KST 09:00 schedule cron으로 staging↔production schema diff — 본 작성 시점(11:10) 이후 실행 결과만 확인 가능
- handoff-074 본문: 새 user register PASS = trigger ≥ 100000 통과 = 적용된 것으로 추정만 — **공식 적용 결과 영속 없음**

**시나리오 (새벽 3시):**

1. d1-schema-drift.yml 매일 cron 실행 → staging-production schema 차이 감지 → CI 빨간색
2. 또는 진산 G10 추가 register 시도 → trigger 600k 잔존 시 "iterations must be >= 600000" 에러로 500
3. Claude는 "0028 적용한 줄 알았는데?" 혼선 → migration 재적용 시도 → "already applied" 또는 "no such migration" 진단 어려움

**왜 위험한가:**

- migration 0007 (600k) 잔존 가능성 = production register 100% fail 재발 가능성
- d1-schema-drift cron이 매일 1회만 — 가장 빠른 감지는 12시간 후
- migration apply 결과가 git에 영속 안 됨 (실제 D1 production이 응답한 결과만 진실)

**권고:**

1. **즉시 검증**: `pnpm exec wrangler d1 migrations list DB --env production --remote` 결과 JSON으로 `.claude/reports/migrations-applied-production-20260511.json` 영속
2. **자동 검증 step**: CI d1-schema-drift.yml 매일 cron 외 push trigger도 `migrations/**` 변경 시 발동되도록 이미 설정됨 — **그러나 첫 실행 결과 영속 의무화** (handoff-074에 cron 결과 link 의무)
3. **runbook**: `docs/runbooks/migration-apply-failure.md` — wrangler 실패 시 D1 console 수동 SQL 적용 절차 + rollback SQL

---

## 4. MAJOR (6건) — 곧 사고가 날 수 있는 부채

### MAJOR-D4: CORS_ALLOWED_ORIGINS 코드내 하드코딩 — Pages 신규 도메인마다 redeploy 의무 chain

**증거:**

- `apps/api/src/index.ts:24-36` `CORS_ALLOWED_ORIGINS` = readonly string[] — 10개 origin 하드코딩
- handoff-074 §B: "1차 시도 → 2차 시도 → 3차 시도 → thepick-web 글로벌 충돌 → thepick-study 신규 → CORS_ALLOWED_ORIGINS에 thepick-study.pages.dev 추가 + apps/api production redeploy"
- 즉 **Pages 도메인 1개 변경 = apps/api 코드 변경 + production wrangler deploy 1회 의무**

**왜 운영 부채인가:**

- preview deployment URL (`https://abc123.thepick-study.pages.dev`)은 PR마다 동적 생성 — CORS 통과 불가
- staging 환경 신규 도메인 추가도 production redeploy 필요 (env별 분리 없음)
- 진산이 custom domain (study.thepick.app + api.thepick.app) 전환 시 또 redeploy
- preview branch 정책 carry-over (cloudflare-pages-setup.md §6) 활성 시 매 PR마다 CORS fail

**권고:**

- env var `CORS_ALLOWED_ORIGINS` 도입 (comma-separated) — wrangler.toml `[env.production.vars]` 또는 `wrangler secret put`
- 또는 정규식 패턴 도입 — `*.thepick-study.pages.dev` allowlist (preview deployment 매칭)
- Phase 3 custom domain 진입 시 코드 변경 0건으로 전환 가능

---

### MAJOR-D5: Pages 빌드 책임 진산 dashboard 의존 — Claude 자동화 영역 침범 + 재현 불가

**증거:**

- `docs/deploy/cloudflare-pages-setup.md` §2.1~2.6: "진산님 dashboard 작업 절차 (1회만, ~5분)"
- handoff-074 §B: "Cloudflare UI 신규 Pages Git deprecated" → 결국 Direct upload 패턴 채택 (Git 연결 0)
- **현재 thepick-study.pages.dev = Direct upload (apps/web/dist `wrangler pages deploy`) 패턴** — main push 자동 빌드 0건
- main에 apps/web 변경 push되어도 production Pages는 자동 갱신 안 됨

**왜 운영 부채인가:**

- memory `feedback_full_autonomy.md`: "자동화 가능 영역은 묻지 말고 즉시 실행" — Pages 빌드는 자동화 가능 영역인데 매 deploy마다 wrangler 토큰 필요
- 진산 토큰 만료 시 apps/web 배포 차단
- CI에 apps/web build job + Pages deploy step 부재 — `.github/workflows/ci.yml`은 typecheck/lint/test만, deploy 없음
- 새 onboarder (가상)가 본 절차서 읽고 Pages Git 연결 재시도 시 cloudflare-pages-setup.md §2.2 "Connect to Git"이 deprecated (handoff-074 §B에서 확인됨)이라 실패

**권고:**

1. cloudflare-pages-setup.md를 **Direct upload 패턴**으로 전면 재작성 — 현 실제 운영 모델 반영
2. GitHub Actions workflow 신규 `pages-deploy.yml`:
   - main push + apps/web 변경 시 build + `wrangler pages deploy apps/web/dist --project-name=thepick-study`
   - secret `CLOUDFLARE_API_TOKEN` 활용 (이미 d1-schema-drift.yml에서 사용 중)
3. preview deployment: PR마다 자동 preview URL + comment

---

### MAJOR-D6: alarm rule 미활성 — engine_telemetry는 셸만, 실제 alarm 0건

**증거:**

- `docs/observability/master-dashboard.md` §2 "Phase 1 후반 본격 활성" — 임계 정책 초안만 영속
- 7 게이지 wire-up 매트릭스 (§5) — `cost` / `d1_slo` / `graph_integrity` / `quality_gate` / `formula_accuracy` 5개가 "BATCH-1 진입 시점" 또는 "CI 통합 PR (별도)"
- 본 Phase 2 Eval MVP는 BATCH-1 적재 후 진산 G9 학습 시도 진입 — **이미 사용자 학습 데이터 흐름 시작** → `learning_slo` 게이지 활성 시점인데 wire-up 0
- ADR-034/035/036 임시 정책 chain → **HASH_ERROR 500 / PASSWORD_PWNED 422 / 401 surge 같은 보안 신호 alarm 0건**

**왜 운영 부채인가:**

- handoff-074 §C: "이후 ADR-034/035/036 흡수 chain으로 추가 redeploy" — 즉 진산 G9 학습 시도 중 500 발생 → Claude 진단 → ADR 작성 → redeploy. 이 chain이 alarm으로 감지 안 되고 진산 발화로만 트리거됨
- **진산이 침묵하면 500 surge 모름** — Workers Analytics는 dashboard 직접 확인 의무 (push alarm 0)
- Cloudflare Logpush 미설정 (index.ts:171 주석 "logpush 미설정 환경" 명시)

**권고:**

1. **즉시**: Cloudflare Workers Logpush 활성 (Cloudflare 단일 벤더 정합) — destination R2 bucket 또는 Cloudflare Workers Email Routing
2. master-dashboard.md §2 임계 정책을 Phase 2 Eval MVP 시점에 **부분 활성**: `d1_slo` p95 > 500ms + `learning_slo` daily session 0 = alert
3. learning_slo 게이지 wire-up: `apps/api/src/study/routes.ts` GET /next 응답 후 telemetry POST (sessionsPerUser, retention 계산은 D1 query)
4. 보안 이벤트 alarm: `auth/routes.ts` PASSWORD_PWNED / HASH_ERROR / rate-limit hit 시 `logger.error` + Logpush filter rule

---

### MAJOR-D7: wrangler 토큰 매 세션 ad-hoc 발급 — 자동화 break point

**증거:**

- handoff-074 §주의사항: "본 세션 사용 토큰: 이름 `claude-code-thepick` (cfut\_ prefix...)" + "매 세션 인증 만료 시 진산님 명시 발화로 신규 토큰 받음"
- handoff-074 §B 우여곡절: 1차 토큰 cfut_F1iU... 권한 부족 → 2차 dashboard Git 연결 → 3차 새 토큰 cfut_LD3p... 발급 → **권한 정합 후에야 진입**
- **즉 매 새 세션 시작 시 진산이 dashboard 진입 + 토큰 발급 + 채팅 입력 절차 필요**

**왜 운영 부채인가:**

- 진산 결정 영역 외에서 진산 dashboard 의존 = autonomy 침해 (`feedback_full_autonomy.md` 위배)
- 토큰 발급 시점에 권한 누락 (Pages:Edit 빠짐 등) → 1차 시도 fail → 진산 재발급 → 30분~1시간 손실
- CI/CD 자동화 측면에서 GitHub Secret에 CLOUDFLARE_API_TOKEN 영속 (이미 d1-schema-drift.yml에서 사용 중) — **그러나 그 토큰의 권한 범위가 deploy까지 포함하는지 명시 없음**

**권고:**

1. **GitHub Secret CLOUDFLARE_API_TOKEN 권한 audit**: 현재 d1-schema-drift에서 D1 execute만 사용 — Workers/Pages/Vectorize/KV deploy 권한도 포함되어 있는지 확인
2. 권한 부족 시 진산 1회 재발급 → GitHub Secret 갱신 → 이후 **세션 토큰 발급 의무 0**
3. Claude 세션 토큰은 **dashboard 작업 / 진단** 한정으로 격하 — production deploy는 GitHub Actions 경유 의무화

---

### MAJOR-D8: redeploy chain version → commit → ADR mapping 부재

**증거:**

- handoff-074 §통계: `production Version cf498ca0 (★ 6회 redeploy chain — Step 5 + ADR-034/035/036 + 옵션 3)`
- 그러나 어떤 Version이 어떤 commit + ADR을 포함하는지 영속 없음
- git log 최근 5건 (handoff 외)는 commit과 ADR 연결되지만, **wrangler Version과의 mapping 부재**

**왜 운영 부채인가:**

- CRITICAL-D2와 별도 시나리오: incident 발생 시 "ADR-036 fix가 production에 적용된 Version은?" 즉답 불가
- audit 관점: 외부 감사관이 "PASSWORD_MIN=4 정책이 production에 언제 적용되었나?" 물으면 wrangler Version으로 답해야 함

**권고:**

- (CRITICAL-D2 권고 1번과 동일) `docs/deploy/version-trail.md` 신규

---

### MAJOR-D9: husky pre-commit 우회 가능 + CI에 secret-scan 외 deploy gate 부재

**증거:**

- `.husky/pre-commit` 2줄: `bash scripts/check-no-secrets.sh` + `pnpm lint-staged`
- `git commit --no-verify` 우회 가능 (check-no-secrets.sh 본문에 명시: "husky 의 본질적 한계")
- `.github/workflows/ci.yml` `secret-scan` job (gitleaks) 있지만 **gitleaks-action@v2 GITHUB_TOKEN만 권한**
- ★ **CI에 production deploy gate 없음** — 즉 typecheck/lint/test PASS 후 deploy는 수동 wrangler 호출

**왜 운영 부채인가:**

- gitleaks가 push protection으로 작동 안 함 (GitHub repo settings의 secret scanning push protection 별도 활성 필요)
- 본 Phase 2 Eval MVP 변경 (PASSWORD_MIN=4 등)이 CI는 통과하지만 **production deploy 자동 검증 없음**
- 진산 G9 PASS 후 자동 production 갱신 chain 없음

**권고:**

1. GitHub repo settings → Code security → Secret scanning + push protection 활성 확인
2. CI에 deploy gate job 추가:
   - `wrangler deploy --env staging --dry-run` (build 검증)
   - `wrangler deploy --env production --dry-run` (production wrangler.toml 검증)
   - 둘 다 PASS 후에만 main merge 허용
3. 별도 plan: production deploy를 main push 트리거 자동화 (BATCH 적재 chain과 충돌 가능 — 진산 결정 영역 carry-over)

---

## 5. MINOR (5건) — 늦으면 곪는 부채

### MINOR-D10: API_VERSION 0.1.0 정체

`apps/api/wrangler.toml:16,111,165` 모두 `API_VERSION = "0.1.0"` — Step 1부터 변경 0건. Phase 2 종착 시점에 0.2.0 또는 semver 자동화 (CI에서 git tag → wrangler vars 주입) 검토.

### MINOR-D11: cron telemetry GC 트리거 DROP/CREATE 패턴 runbook 부재

master-dashboard.md §3: "engine_telemetry DELETE 차단 트리거 때문에 GC 시점에 트리거 일시 DROP / 작업 / 재CREATE 패턴 의무. 별도 plan (Phase 2 진입 시)" — 본 Phase 2 진입했으나 runbook 미작성. 1년 보존 정책 시점이 다가오기 전 (D1 5GB 한도 직전) plan 의무.

### MINOR-D12: pages.dev URL CORS 정규식 미적용 — preview deployment 회귀 검증 차단

cloudflare-pages-setup.md §6: "Preview branch 정책: feature/\* 브랜치 push 시 Preview deploy → Phase 2 후반 PR 워크플로우 정착 시 결정" — 본 시점이 Phase 2 후반. 그러나 preview deploy 회귀 검증 e2e가 CORS 차단으로 작동 불가. MAJOR-D4 권고와 동기.

### MINOR-D13: observability head_sampling_rate 분기 모델

`wrangler.toml:51` (dev 0.1) / `:122` (staging 1.0) / `:176` (production 1.0). production이 1.0 sampling = 비용 가시성 0. Cloudflare Workers 사용량 폭증 시 alert 부재. Phase 3 launch 전 head_sampling_rate를 비용 게이지 (cost 게이지 metric_json.cf_workers_invocations)와 연동.

### MINOR-D14: engine_telemetry wire-up 0% 진척

handoff-074 §통계 telemetry 항목 없음. master-dashboard.md §5 wire-up 매트릭스 "BATCH-1 진입 직전 후속 PR" — BATCH-1~5 이미 완료된 상태. 즉 **wire-up이 적재 chain 후에도 미진척**. carry-over plan 별도 의무.

---

## 6. 새벽 3시 on-call 시나리오 — top 3

### 시나리오 A: "회원가입 500 surge" (확률 高)

**Trigger:** Phase 3 launch 직전 진산 hash service 전환 (Argon2id WASM 도입) 후 register endpoint 500 burst.

**현재 부재:**

- Logpush 미설정 → 진산 발화 없으면 surge 무지
- Workers Analytics dashboard 진입 절차서 0건
- rollback runbook 0건

**개선 후 시나리오:**

1. Workers Logpush → R2 또는 Workers Email → 진산 이메일 "register 500 burst (5min, 50건)"
2. Claude `wrangler tail thepick-api-production --format=pretty` 즉시 실행 → throw stack 확인
3. `wrangler rollback --message="revert Argon2id transition"` → 이전 PBKDF2 100k Version 복원
4. version-trail.md 자동 append

### 시나리오 B: "ADR 복원 deadline 망각" (확률 高 + 영향 catastrophic)

**Trigger:** Phase 3 launch 후 외부 user 100명 가입 → 일주일 후 leak

**현재 부재:**

- 17항목 markdown checklist만 — CI 강제 0
- env 분기 모델 부재 (PASSWORD_MIN/PBKDF2)

**개선 후 시나리오:**

1. CRITICAL-D1 권고 1번 적용 — env 분기 함수 도입
2. CRITICAL-D1 권고 2번 적용 — Phase 3 진입 1개월 전 CI gate
3. CI가 ADR-034/035/036 각 §"복원 의무" 항목에 대응하는 evidence 파일 (`.claude/reports/adr-034-restoration-step1.json` 등) 존재 검증

### 시나리오 C: "wrangler 토큰 만료 시 BATCH-6 진입 차단"

**Trigger:** BATCH-6 (가상) 적재 chain 진입 시 wrangler 토큰 만료 → 진산 부재 (밤)

**현재 부재:**

- GitHub Secret CLOUDFLARE_API_TOKEN 권한 범위 명시 0건
- BATCH 적재 chain의 토큰 의존 절차서 0건

**개선 후 시나리오:**

1. MAJOR-D7 권고 1번 적용 — GitHub Secret 권한 audit + 갱신
2. BATCH 적재 chain이 GitHub Actions workflow_dispatch trigger로 전환
3. 진산 발화 0 + Claude 자동 진입 정합

---

## 7. Cloudflare 단일 벤더 정합 (관측/알람/로그)

memory `feedback_single_vendor_cloudflare.md` 정합 검증 — 외부 SaaS (Sentry/PostHog/Resend) 도입 회피 의무.

| 영역            | 현 상태                                       | Cloudflare 대체 패턴                                                   | 진척 |
| --------------- | --------------------------------------------- | ---------------------------------------------------------------------- | ---- |
| 로그 수집       | Workers Analytics + wrangler tail (manual)    | **Workers Logpush** → R2 bucket (filter rule) — 미설정                 | 10%  |
| Push alarm      | 진산 발화 0건                                 | **Workers Email Routing** → 진산 mailto: + 실패 시 R2 archive — 미설정 | 0%   |
| 사용자 메트릭   | engine_telemetry 셸 (admin-web /telemetry)    | Workers Analytics Engine (이미 wrangler.toml `[observability]` 활성)   | 30%  |
| Cron 모니터링   | `[triggers] crons = ["0 3 * * *"]` 활성       | Cron Trigger health = Workers Analytics queries                        | 50%  |
| Schema drift    | `.github/workflows/d1-schema-drift.yml` daily | ✓ 정합 — Cloudflare API 토큰만 사용                                    | 100% |
| Performance     | head_sampling_rate 0.1/1.0/1.0                | Workers Analytics percentile (sampling 갱신 plan 필요)                 | 40%  |
| Incident notify | 0건                                           | Workers Email + Cloudflare Status API (worker.dev outage 감지)         | 0%   |

**총 정합도 추정:** 약 33% (메모리 정합 의도는 100%이나 wire-up 0%~50%)

**최우선 권고:**

1. Workers Logpush → R2 활성 (1시간 작업, 진산 dashboard 1회)
2. Workers Email Routing 진산 이메일 (`taeksoo6432@gmail.com`) — 단방향 alert 채널
3. 본 2건이 Phase 3 launch 직전 운영 베이스라인 의무

---

## 8. Phase 3 launch chain 운영 준비도

| 영역                              | 준비도 | 부채                                                                                     |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| Workers / Pages 배포 자동화       | 50%    | Pages Direct upload 패턴 + GitHub Actions deploy job 부재                                |
| 시크릿 관리                       | 60%    | GitHub Secret CLOUDFLARE_API_TOKEN 권한 audit 필요                                       |
| ADR-034/035/036 복원 메커니즘     | 15%    | env 분기 0건 + CI gate 0건 + 17항목 markdown만                                           |
| 관측성 (logs/metrics/alarm)       | 33%    | Logpush + Email Routing 미설정 (Cloudflare 단일 벤더 정합 부족)                          |
| Rollback / DR                     | 20%    | runbook 0건, version-trail 0건, wrangler rollback 절차 미영속                            |
| Migration apply 검증              | 40%    | d1-schema-drift cron daily만, push 결과 영속 부재                                        |
| CI/CD gate                        | 65%    | typecheck/lint/test/audit 양호, deploy dry-run gate 부재                                 |
| Custom domain (study/api.thepick) | 0%     | thepick.app 외부 점유 (memory 정합) — 다른 후보 결정 carry-over                          |
| Incident response                 | 25%    | runbook 0건, escalation 0건 (단일 user → 외부 user cutover)                              |
| Cost guardrail                    | 50%    | Anthropic cap 권고 영속 (`project_anthropic_cap_pre_install`), Workers/D1 budget alarm 0 |

**가중 평균 준비도:** **42%**

**Phase 3 launch 가능 임계:** 70% (devops 관점) — **현재 미달**

**선행 의무 5건 (Phase 3 진입 1개월 전):**

1. CRITICAL-D1 — env 분기 함수 + CI gate (preparedness 가장 큰 lift)
2. MAJOR-D5 — Pages 빌드 GitHub Actions 자동화
3. MAJOR-D6 — Workers Logpush + Email Routing 활성
4. MAJOR-D7 — GitHub Secret 권한 audit + wrangler rollback runbook
5. CRITICAL-D2 — version-trail.md + rollback runbook

본 5건 완료 시 준비도 약 70% 도달 추정.

---

## 9. Devil's Advocate — "이게 깨질 수 있는 시나리오"

### 반론 1: "진산 단독 사용자 = 보안 risk 0건이라는 ADR 가정이 깨지는 경우"

ADR-034/035/036 모두 "진산 단독 사용 + production traffic 0 + 외부 노출점 사실상 0"을 가정. 그러나:

- thepick-study.pages.dev URL이 publicly accessible (handoff-074 §B "thepick-web.pages.dev 다른 사용자 점유" = 외부 noise 정합)
- **외부 봇/크롤러가 register endpoint hit 가능** → 4자리 password + HIBP disable + PBKDF2 100k = 30분 안에 brute-force 성공
- production 진산 user 1건의 password가 4자리이면 그것도 노출 위험
- 그래서 본 페르소나는 CRITICAL-D1을 **"Phase 3 launch 직전"이 아니라 즉시 부분 적용** 권고

**증거 (ADR 본문에서 직접 인용):**

- ADR-034 §"보안 위험 영속": "60초 내 모든 user 탈취 가능 (4자리 = 10,000 조합)"
- ADR-035 §"보안 위험 영속": "4자리 숫자 password + 100k iterations = brute-force 매우 빠름 (~수분)"

### 반론 2: "rollback도 단방향 cascade 충돌 시 더 깨진다"

`wrangler rollback`은 Workers Version만 되돌린다. 그러나:

- migration 0028 (PBKDF2 trigger 100k)이 production D1에 적용된 상태에서 Workers를 600k 이전 Version으로 rollback하면 register 시 Workers (600k 의도) → D1 trigger (100k 강제) **trigger PASS → 새 user 200k stored** (Workers가 600k iteration 시도하면 NotSupportedError 500)
- 즉 Workers + D1 migration이 **함께 rollback** 되어야 하는데 D1은 forward-only migration 정책 (CLAUDE.md `## Hard Limit` "knowledge_nodes, formulas 테이블 UPDATE 금지" 외 마이그레이션 회피)
- runbook이 이 cascade를 명시해야 함

### 반론 3: "GitHub Actions deploy job 추가 시 CLOUDFLARE_API_TOKEN 권한 leak 위험"

MAJOR-D7 + MAJOR-D9 권고가 GitHub Secret 권한을 deploy까지 확장. 그러나:

- GitHub Actions가 Workers/Pages/D1/Vectorize 전체 권한 토큰 보유 = repo 권한자 + main push 권한자 = production 전체 권한
- 누가 main에 push 가능한가? 진산만? Claude도 PR merge 가능? Branch protection rule 미영속
- 본 페르소나는 **branch protection rule + required reviews + signed commits** 의무도 carry-over 권고

---

## 10. carry-over 권고 (handoff-075 §주의사항 반영 의무)

본 페르소나 발견 CRITICAL 3건 + MAJOR 6건은 **Phase 3 launch 진입 carry-over chain**에 추가:

1. ADR-034/035/036 chain에 **본 페르소나 D1/D2/D3 CRITICAL 3건** carry-over 항목 명시 (env 분기 / version-trail / migration evidence)
2. memory `project_launch_legal_bundle_deferred.md` 1주 스프린트 묶음에 **devops top 5 선행 의무** 추가
3. master-dashboard.md v2 작성 시점 (BATCH-1 진입 wire-up PR 시점은 이미 지남 — 현재가 v1.5 의무) `learning_slo` 게이지 wire-up 의무
4. 신규 plan `docs/plans/phase3-devops-readiness.plan.md` (Phase 3 launch 1개월 전 진입) — 본 페르소나 9건 흡수

---

## 11. 인계 (Persona 5/5 완료)

본 페르소나 보고로 5-페르소나 chain 종료. Session 066 통합 보고서 작성 의무:

- 파일명: `.claude/reviews/review-20260511-HHMMSS-phase2-eval-mvp-5-persona-integrated.md`
- 5 페르소나 (refactoring / performance / quality / backend / **devops**) 통합 우선순위 매트릭스
- CRITICAL 총 (4-Pass 0 + 5-페르소나 N) → Phase 3 진입 가능 판정 (현 추정 미통과)
- handoff-075 §carry-over에 본 페르소나 CRITICAL 3건 명시

---

**작성**: Claude (Opus 4.7 1M context) — devops-architect persona, Session 066 (Phase 2 Eval MVP 종착 5-페르소나 5/5)
**작성 효력**: 2026-05-11 11:10:48 KST
**리뷰 대상 Version**: thepick-api-production cf498ca0 + thepick-study.pages.dev (4 deploy chain)
