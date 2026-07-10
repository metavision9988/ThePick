# Phase N 기술부채 리뷰 — devops-architect (운영 부채)

- 관점: "새벽 3시 on-call 시나리오?"
- 스코프: promo-1st P0~P5 체인(공개 API·프론트·MC 적재·배포 게이트) 중심 + 잔존 운영 인프라
- 일시: 2026-07-10 14:33 (ts 20260710-143321)
- 발견: CRITICAL 1 / MAJOR 3 / MINOR 3

## CRITICAL

### DO-C1. D1 DR = Time Travel 30일 단일 의존 — 자동 off-DB export 0, 30일 초과 잠복 결함은 영구 복구 불가

- 위치: `docs/runbooks/production-deployment.md:130, 165`
- 상세: production D1 복구 전략이 'Cloudflare Time Travel — 최대 30일' 단 하나다. `wrangler d1 export` 자동화·주기 백업 job은 scripts/·.github/workflows/ 전수 grep 결과 0건. 이 프로젝트는 무음 데이터 결함이 30일을 훌쩍 넘겨 잠복한 실전 전력이 이미 2건이다: ①정답 오류 36건이 원 적재 시점부터 수개월 production에 잠복(docs/audit/incident-1st-answer-errors-20260710.md) ②3주 휴면 기간(2026-06-13~07-02) 존재. RPO/RTO 정의 문서도 없다. 정식 런칭 후 user_progress·status_transitions(진산 검수 승급 이력)·MC 교정 이력이 쌓이면 이들은 git의 insert SQL로 재구성 불가능한 유일본이 된다. 새벽 3시에 잘못된 마이그/UPDATE를 31일차에 발견하면 복구 수단이 없다.
- Devil's Advocate: 콘텐츠 본체(knowledge_nodes 857·exam_questions)는 docs/batch-load/의 insert SQL이 git에 전량 커밋돼 있어 재적재 가능 — 현시점(서버 user 데이터 0, promo 표면은 G-1 로컬 진도)만 보면 MAJOR로 강등 가능. 단 검수 승급 상태·교정 이력은 이미 SQL 파일 밖이고, 런칭 시점(6개월 내 horizon)부터는 강등 논리가 소멸한다. 완화 비용도 극소(cron + d1 export → R2, 단일 벤더 정합).
- Horizon: 정식 런칭 + 30일 경과 시점 — 첫 '한 달 전에 뭔가 깨졌다' 발견 순간
- 권고: 주간 `wrangler d1 export` → R2 버킷 적재 cron(Workers Cron 또는 GitHub Actions schedule, 단일 벤더 정합) + docs/runbooks/에 RPO(≤7일)/RTO 명문화. 마이그 down script 미작성 의무(runbook:78 자기 기록)도 동일 런북에 회수.

## MAJOR

### DO-M2. 공개 표면 라이브인데 alert 채널 여전히 0 — 모니터 출력 = wrangler tail 휘발, cron 자체 실패 감시(dead-man switch)도 0

- 위치: `apps/api/src/scheduled/silent-failure-monitor.ts:14-18`
- 상세: silent-failure-monitor는 임계 초과 시 logger.error+console.error 2중 emit뿐 — 주석 스스로 '운영자 alert path 0건'을 인정하고 Email Routing은 ADR-043 §3 carry-over(☐ 미이행, ADR-043:3,111)다. 수신자는 '새벽 3시에 wrangler tail을 켜둔 사람'뿐이다. 더구나 index.ts:228 ctx.waitUntil 내부에서 throw 미전파 + Workers cron at-most-once = cron 자체가 죽어도 아무도 모른다(감시자를 감시하는 자 없음). promo-1st로 무인증 공개 트래픽이 실제 유입 중인데, ADR-043이 상정한 발동 조건('Phase 3 launch 직전')이 사실상 도래했다. W3 Revision Watch까지 이 단일 cron(0 3 \* \* \*)에 얹힐 예정이라 무음 반경이 계속 커진다.
- Devil's Advocate: ADR-043이 '활성 사용자 100명 이하에서 wrangler tail 충분'이라 명시적으로 이연한 결정이므로 신규 부채가 아니라 기결 carry-over다. promo 표면은 서버 user 데이터 0(G-1)이라 silent failure의 사용자 피해 반경도 작다. 단 '기결 이연'의 트리거 조건(공개 런칭)이 이번 체인으로 충족됐다는 게 반박의 반박.
- Horizon: 홍보 유입 증가~정식 런칭 직후 첫 무음 장애 (cron 사망 시 즉시)
- 권고: ADR-043 §2 carry-over 즉시 이행: Cloudflare Email Routing + 임계 초과 시 fetch 기반 메일 발송. cron dead-man = engine_telemetry에 cron heartbeat 기록 + d1-schema-drift.yml류 일일 GH Actions가 heartbeat 나이 검사(둘 다 단일 벤더/기존 인프라 재사용).

### DO-M3. Analytics Engine = 홍보 지표·결함율 유일 원천인데 조회 소비자 0(writer-only) + AE 보존 ~90일 — 지표 무음 소멸

- 위치: `apps/api/src/public/analytics.ts:1-9, 44-67`
- 상세: PUBLIC_ANALYTICS 참조는 index.ts/analytics.ts/routes.ts 3곳 전부 write 측뿐 — AE SQL API 조회 스크립트, admin-web 대시보드, export job 전무(repo 전수 grep). analytics.ts 헤더 스스로 '홍보 지표·오답 통계 원천', defect 이벤트는 '유일 결함율 집계 원천'(M-19)이라 선언했는데, Cloudflare Analytics Engine 데이터 보존은 약 90일이다. 즉 promo 캠페인의 존재 이유인 지표가 ①현재 아무도 읽을 수 없는 채 쌓이고 ②3개월 후부터 롤링 소멸한다. 4지점에서 emit하는 defect(서빙·채점 422 거부) 결함율도 임계 감시 대상이 아니다 — silent-failure-monitor의 SILENT_FAILURE_EVENTS는 streak/weak_delta 2종뿐(silent-failure-monitor.ts:27-30)이라 공개 표면은 모니터 사각지대다.
- Devil's Advocate: AE SQL API는 대시보드/curl로 레포 밖에서 수동 조회 가능하고, 90일 내 export 스크립트를 추가하면 손실 0으로 회수된다. 홍보 지표는 CF Web Analytics 비콘(P5-D1)이 부분 중복 커버한다. 단 '기록만 하고 읽는 코드가 없는 계기판'은 이 프로젝트가 정의한 무음 실패 클래스 그 자체이고, defect 사각지대는 수동 조회로도 임계 감시가 안 된다는 점에서 유지.
- Horizon: 첫 이벤트 기록 + 90일 (≈2026-10월) — 초기 홍보 지표 비교 기준선 소멸 시점
- 권고: ①AE SQL API 조회 스크립트(scripts/query-public-events.mjs) 또는 admin-web 게이지 1면 ②일일 cron이 AE 집계를 engine_telemetry(D1) 스냅샷으로 적재(보존 영속화 + silent-failure-monitor에 defect 임계 편입) — 기존 게이지 인프라 재사용으로 저비용.

### DO-M4. production 배포물 ↔ git SHA 추적성 단절 — web `--commit-dirty=true` + 전 표면 수동 wrangler + push 장기 보류 관행의 결합

- 위치: `apps/web/package.json:10`
- 상세: web production 배포가 `wrangler pages deploy --commit-dirty=true`로 더티 워킹트리째 나간다. api도 로컬 수동 `wrangler deploy`(CI 배포 0)이고, 프로젝트 관행상 push 보류(#14) 로컬 커밋이 수 주간 누적된다 — origin에도 없는 코드가 production에서 도는 구간이 상시 존재한다. 이 클래스의 실사고 전력이 이미 있다: 2026-06-01 '/api/search/graph 404' = production Worker가 2026-05-10 빌드에 머물러 3주간 라우트 미포함(CLAUDE.md Session 096 기록). 새벽 3시 장애 시 '지금 떠 있는 게 어느 커밋인가'를 답할 수 없으면 재현·롤백 판단이 전부 추측이 된다. 6개월 뒤 2호 트랙 동시 배포(동시 wrangler deploy 금지 규칙)까지 겹치면 드리프트 표면이 배가된다.
- Devil's Advocate: wrangler versions로 versionId 기반 롤백은 가능하고(runbook:101), 수동 배포는 '진산 인증 게이트'라는 의도된 통제다. 단일 운영자 체제에서 배포 빈도도 낮다. 그러나 versionId는 '언제'만 알려줄 뿐 '어느 코드'인지는 안 알려주며, 404 3주 사고가 이미 이 갭의 실물 증거라 MINOR 강등은 부적절.
- Horizon: 6개월 유지보수 — 다음 배포 드리프트 장애의 원인 규명 단계에서 (2호 동시 운영 시 가중)
- 권고: ①`--commit-dirty=true` 제거(클린 트리 강제) ②deploy 스크립트에 git SHA를 Worker var/API_VERSION·Pages 메타로 스탬프 ③배포 시 SHA+versionId를 docs/runbooks/deploy-log에 1줄 기록 의무화(check-deploy-env.mjs에 게이트 추가 가능).

## MINOR

### DO-m5. 배포 후 스모크(smoke-public-surface.mjs)가 어느 자동 경로에도 미배선 — 인간 기억 의존 게이트

- 위치: `scripts/smoke-public-surface.mjs:1-15`
- 상세: P5 blocking 게이트로 만든 스모크(14 체크)가 deploy:production 스크립트·CI 어디에도 연결돼 있지 않다(apps/api/package.json:10, apps/web/package.json:10, ci.yml 전수 확인 — 호출 0). d2d04b5 기록처럼 이번엔 수동 실행됐지만, 6개월 뒤 다른 세션/모델이 배포할 때 실행을 보장하는 건 문서 기억뿐이다. production-deployment.md 런북도 마이그레이션 중심이라 공개 표면 배포 절차가 미반영이다. (※ INDEX 에서 quality QA-M4 와 동일 증상 병합 — 교차 합의)
- DA: 배포 자체가 수동 결재 행위라 스모크도 수동인 게 현 체제와 일관적이고, 핸드오프 문서에 절차가 기록돼 있다. 자동화해도 API_BASE 인자만 있으면 되므로 회수 비용이 매우 낮다는 점이 오히려 '지금 안 할 이유가 없다'는 근거.
- 권고: deploy:production 스크립트 말미에 `&& node ../../scripts/smoke-public-surface.mjs $URL` 체이닝(api·web 각각) + production-deployment.md에 공개 표면 §추가. (Horizon: 다음 담당 세션 배포 첫 회)

### DO-m6. CORS 허용 origin 하드코딩 배열 — {exam}.thepick.co.kr 서브도메인 전개 결재와 정면 긴장

- 위치: `apps/api/src/index.ts:38-52`
- 상세: CORS_ALLOWED_ORIGINS가 소스 상수 배열이고 주석 스스로 '커스텀 도메인 확보 시 config 주입 교체'를 예고한다. 2026-07-04 멀티트랙 결재는 '{exam}.thepick.co.kr 서브도메인 + 루트 도메인 config 주입, 하드코딩 금지'를 명시했다 — 2호(전기기사) 표면이 뜨는 순간 종목 추가마다 api 코드 수정+재배포가 필요해지고, 이는 '동시 wrangler deploy 금지' 트랙 경계 규칙과 충돌하는 배포 결합을 만든다.
- DA: 루트 도메인이 아직 미정이라 지금 config화해도 값이 없고, pages.dev 시절엔 상수가 가장 단순·안전하다. 도메인 확정 시점에 env var 1개로 교체하면 되는 소규모 변경 — 다만 그 시점을 잡는 원장 항목이 없으면 잊힌다는 게 요지.
- 권고: CORS_EXTRA_ORIGINS env var(콤마 분리) 병합 경로만 선배선 — 도메인 확정 시 코드 무변경 주입 가능. 엔진분리 M1 plan 원장에 항목 등재. (Horizon: Year 2 / 2호 서브도메인 첫 배포 즉시)

### DO-m7. JWT_SECRET/IP_PEPPER 로테이션 설계·runbook 부재 — 단일 secret, kid/이중 검증 없음 = 로테이션이 전 세션 강제 로그아웃

- 위치: `apps/api/src/auth/session.ts:53-56`
- 상세: JWT 서명이 단일 env secret이고 key id(kid)나 신·구 secret 이중 검증 경로가 없다(grep: rotation 관련은 refresh token 회전뿐). secret 유출 대응 또는 정기 로테이션 시 유일한 수단 = secret 교체 → 전 사용자 즉시 로그아웃. IP_PEPPER 교체는 rate-limit·login_history 해시 키 연속성 단절(경미). 로테이션 절차 runbook도 docs/runbooks/에 없다. 사고 대응 관점에서 '유출 의심 시 몇 분 안에 무엇을 할지'가 미정의다.
- DA: access token 수명이 짧다면 강제 로그아웃 피해 반경은 작고, 사용자 0에 가까운 현재는 무비용 교체가 가능하다. Phase 3 런칭 법무 스프린트에 인증 하드닝 묶음(ADR-034 복원 등)이 이미 예약돼 있어 그 chunk에 편입하면 충분 — 독립 CRITICAL로 승격할 근거는 약함.
- 권고: verify 측만 2-secret(JWT_SECRET + JWT_SECRET_PREVIOUS) 허용하는 grace 창 구현 + docs/runbooks/secret-rotation.md(교체 순서·검증 스모크) — Phase 3 launch toggle chunk에 편입. (Horizon: 런칭 후 첫 유출 의심 인시던트 / 연 1회 로테이션 도입 시)

## 검증 증거 (checkedItems)

- PASS apps/api/wrangler.toml:1-285 — dev/staging/production env 완전 분리, rate-limit namespace 1001~3005 환경별 격리, PUBLIC*RATE_LIMITER_IP(1005/2005/3005) + AE dataset(thepick_public_events*{env}) promo-1st 신설분 3-env 전부 등재 확인
- PASS apps/api/wrangler.toml:229-231 — production observability enabled + head_sampling_rate=1 (Workers Logs 전수 기록)
- PASS .github/workflows/ci.yml — typecheck/lint/전 패키지 test/루트 scripts test/engine-contracts 게이트/pnpm audit(HIGH+ 차단)/gitleaks secret-scan/Playwright E2E, 신뢰불가 입력 미사용 명시
- PASS .github/workflows/d1-schema-drift.yml:30-34 — staging↔production 스키마 드리프트 일일 cron(UTC 00:00) 자동 감지 (DA-C3 흡수 확인)
- PASS apps/api/package.json:8 — default env deploy 의도적 차단(exit 1), deploy:staging/production만 허용
- PASS apps/web/scripts/check-deploy-env.mjs — PUBLIC_API_BASE_URL Binary Gate(미설정/localhost/비-https 차단 = localhost 폴백 무음 배포 사고 클래스 기계 차단)
- PASS apps/api/src/public/rate-limit.ts:20-35 — 공개 표면 해시 IP(SHA-256+IP_PEPPER) 키 + prod fail-closed 정책 재사용, PII 0
- PASS apps/api/src/public/analytics.ts:22-40 — AE 이벤트 PII 0 설계(IP·userId·본문·정답 미기록) + 바인딩 실패 warn(무음 금지)
- PASS 단일 벤더 정합 — 외부 SaaS(Sentry/PagerDuty 등) 도입 0, AE/Web Analytics/Email Routing 계획 전부 Cloudflare (ADR-006/043 대조)
- PASS docs/runbooks/ 3종 실재(production-deployment/migration-rollback/engine-telemetry-gc) — 단 D1 백업·secret 로테이션·공개 표면 배포 절차는 부재(findings 참조)
- PASS apps/api/src/index.ts:210-268 — scheduled 핸들러 미지 cron 명시 skip + GC 이상치 warn + 이중 emit (앱 레벨 방어 최대치 확인, 채널 부재는 별건 finding)
- N/A Logpush — grep 결과 설정 파일 0건(주석·ADR 언급만): Workers Logs(관측성)로 대체 중, Logpush job 미설정은 DO-M2·DO-M4 의 휘발성 논거에 포함
- N/A Kubernetes/컨테이너 오케스트레이션 — Workers 서버리스 아키텍처로 해당 없음
- CHECKED git log -20 + diff --stat HEAD~8 — 리뷰 스코프 = promo-1st P0~P5 체인(공개 API·프론트·MC 적재·배포 게이트) 중심, 4-Pass 기보고(review-20260710-140338 등) 단기 버그와 중복 배제
