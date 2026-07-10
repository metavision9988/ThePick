# Phase N (promo-1st P0~P4) 기술부채 리뷰 — devops-architect

- 관점: 운영 부채 — "새벽 3시 on-call 시나리오?"
- 리뷰 범위: promo-1st P0~P4 체인(공개 무인증 표면 /api/public/\* + MC 521 production 적재 + /practice/ 프론트) 및 연관 운영 표면(wrangler.toml, CI 3종, scheduled handler, runbooks)
- 실행 상태: **실행 완료** (발견 7건 = MAJOR 4 / MINOR 3, CRITICAL 0)
- 통합 인덱스: `phaseN-tech-debt-20260710-105821-INDEX.md`
- 발견 ID 접두: `D-`

---

## D-M1 [MAJOR] 알림 채널 여전히 0 — 공개 홍보 표면 런칭 게이트(BE-6 ②)와 정면 충돌, cron at-most-once 무재시도까지 겹침

- 파일: `docs/adr/ADR-043-silent-failure-alert-routing.md:3, 60`
- 상세: ADR-043 상태가 'Email Routing 활성은 carry-over'로 남아 있고(§3), 실제 wake-up 경로는 apps/api/src/index.ts:251,263 의 console.error(= wrangler tail 을 켜 둔 사람만 봄)가 전부다. scheduled 핸들러는 주석 스스로 'at-most-once — 실패 시 자동 재시도 없음'(index.ts:198)이라 명시한다. 이번 P1이 확정한 홍보 스코프 정본(docs/plans/promo-1st-free-service-scope-20260708.md:50 BE-6 ②)은 '알림 1채널(Email Routing 활성)'을 **공개 전 최소 운영선**으로 못박았는데, P4까지 완료된 현재도 이행 흔적이 코드·설정 어디에도 없다. 공개 무인증 표면은 rate-limit fail-closed(429 전면 차단)·D1 장애(500)·MC 계약 위반 전부가 '무음 + 3~7일 휘발 로그'로만 남는다. 새벽 3시에 공개 표면이 전면 429/500이어도 아무도 깨지 않는다.
- Devil's Advocate: Email Routing 활성은 Cloudflare 콘솔 진산 행위로 명시 위임돼 있고(ADR-043 §3, 진산 통제 영역), P5 배포 게이트에서 자연 소화될 수 있다. 또 홍보 트래픽 초기 규모가 작아 첫 장애의 사용자 피해는 제한적일 수 있다 — 그 경우 MINOR 강등 가능. 단, P5 가 ② 확인 없이 배포되면 자체 게이트 위반이므로 P5 체크리스트에 기계적으로 등재돼야 강등이 정당화된다.
- Horizon: P5 공개 배포 직후 첫 production 장애 — 홍보 유입 중 무음 다운타임
- 권고: P5 배포 체크리스트에 BE-6 ② 를 blocking 항목으로 등재 + 최소 구현으로 scheduled 핸들러에서 severity=critical 시 Email Routing 주소로 fetch(MailChannels/Email Workers, Cloudflare 단일 벤더 정합) 발신 경로를 코드로 준비해 콘솔 활성만 남기기. 장기적으로 Cloudflare Health Checks 로 /api/public/questions/next 외부 프로브 1개 추가.

## D-M2 [MAJOR] 배포 자동화·post-deploy 검증 0 — Worker/Pages/D1 3면 수동 배포, 1개월 stale 빌드 사고 전력 있는 구조 그대로 공개 표면 런칭

- 파일: `apps/api/package.json:8-10`
- 상세: CI(ci.yml)는 품질 게이트만 있고 deploy job 이 없다. API 는 `wrangler deploy --env production` 수동, web 은 CLAUDE.md 명시대로 'wrangler pages 수동 배포(Git 자동배포 없음)'. 이 구조는 이미 실증 사고를 냈다: 2026-06-01 production Worker 가 2026-05-10 빌드로 3주 stale 상태였고 /api/search/graph 404 를 유발(CLAUDE.md '2026-06-01 갱신' 블록). ADR-042 가 Worker↔D1 순서 불일치 리스크를 문서화했지만 기계 강제는 없다. 이제 공개 표면은 apps/web(/practice/) ↔ apps/api(/api/public/\*) ↔ D1(MC 521행) 3-아티팩트 정합에 의존하는데, 셋 다 수동이고 배포 후 자동 smoke(예: /questions/next 200 + choices 비-null 확인)가 없다. scripts/ 에 post-deploy smoke 스크립트 부재 확인(ls scripts: measure/verify/g1 계열뿐).
- Devil's Advocate: CI 자동 deploy 는 진산 Cloudflare 인증 게이트(의도된 인간 게이트)와 충돌하며, 현재 배포 빈도가 낮아 수동으로도 관리 가능하다는 반론. 또 d1-schema-drift.yml 이 스키마 축 드리프트는 매일 자동 감지 중이다. 그러나 '코드/데이터 축' 드리프트(라우트 유무·행 카운트)는 여전히 무감지이므로 완전 강등은 어렵다.
- Horizon: 6개월 유지보수 — 다음 stale 빌드/순서 역전 재발 시 공개 표면 무음 404. 2호(전기기사) 서브도메인 추가 시 배포 매트릭스 2배로 악화
- 권고: 자동 deploy 대신 '배포 후 검증 자동화'부터: scripts/smoke-public-surface.ts(next→grade→reveal 왕복 + 버전 헤더 대조)를 만들어 배포 runbook 필수 스텝 + d1-schema-drift.yml 식 daily cron 워크플로우로 production 실표면 프로브. 배포 버전을 /health 응답에 git SHA 로 노출해 드리프트를 기계 판정.

## D-M3 [MAJOR] D1 DR 부재 — 정기 백업 스케줄 0, RPO/RTO 미정의, Time Travel 30일 밖의 인간 검수 상태(approved 488 + 정답 교정 36) 복원 경로 없음

- 파일: `docs/runbooks/migration-rollback.md:16, 109`
- 상세: 백업 언급은 migration-rollback.md 의 '롤백 직전 ad-hoc wrangler d1 export' 뿐이고, 스케줄된 export(cron/CI)·보관처(R2)·RPO/RTO 정의·복원 리허설 기록이 전무하다(docs/runbooks/ 전수: production-deployment, migration-rollback, engine-telemetry-gc 3종뿐 — DR runbook 없음). 콘텐츠(nodes 857/edges 1347/MC 521)는 repo SQL 로 재현 가능하지만, ①status_transitions 의 진산 승인 이력(approved 488) ②07-10 정답 교정 36건의 적용 시점 이력 ③런칭 후 쌓일 users/login_history 는 D1 이 유일 원본이다. D1 Time Travel 은 30일 창 — 30일 지난 오염·유실(예: 잘못된 마이그가 조용히 상태를 바꾼 채 한 달 경과)은 복원 불가.
- Devil's Advocate: 현재 실사용자 ~0 이고 콘텐츠는 repo 재현 가능하므로 '지금 터져도' 실손실은 승인 이력 메타데이터 정도다 — 런칭 전이라면 MINOR 강등 여지. 그러나 promo 런칭이 목전이고(P5), 유저 데이터가 생기는 순간부터 RPO=∞ 는 상용 품질 원칙(인메모리/유실 금지)과 모순되므로 런칭 전 정의가 맞다.
- Horizon: 런칭 후 첫 데이터 사고가 30일 넘게 잠복했을 때(Year 1 후반~Year 2) — 복원 수단 소멸
- 권고: docs/runbooks/d1-disaster-recovery.md 신설: 주 1회 `wrangler d1 export` → R2 업로드(GitHub Actions schedule, 단일 벤더 정합), RPO=7일/RTO=1일 명문화, Time Travel restore 절차 + 분기 1회 staging 복원 리허설. status_transitions 만이라도 export 를 daily 로.

## D-M4 [MAJOR] 공개 표면 데이터 결함 신호가 휘발 로그에만 — 36건 정답 오류 인시던트 직후인데 결함율(QUESTION_NOT_GRADABLE/계약 위반) 감지 루프 0

- 파일: `apps/api/src/public/routes.ts:360-365, 386-394`
- 상세: grade/reveal 의 MC 계약 위반('grade MC contract violation (data defect)', routes.ts:361)과 MC-in-disguise 차단(:386), serve 의 빌드 실패(:286)는 logger.error 만 남긴다. 이 422 경로들은 recordPublicEvent 를 타지 않으므로(AE 기록은 성공 serve:305·완료 grade:406·card:490 만) Analytics Engine 에도 안 잡히고, Workers Logs 보존(3~7일)이 지나면 증거가 소멸한다. engine_telemetry 에는 learning_slo 2종(streak/weak_delta)만 적재돼 silent-failure monitor(scheduled/silent-failure-monitor.ts SILENT_FAILURE_EVENTS 2종 고정)가 공개 표면 결함을 전혀 못 본다. 07-10 인시던트(production 정답 오류 36건, docs/audit/incident-1st-answer-errors-20260710.md)가 증명하듯 이 데이터군은 결함 전력이 있는데, 학습자가 결함 문항을 만나는 비율을 운영자가 볼 계기판이 없다.
- Devil's Advocate: isServable 이 서빙 단계에서 결함행을 걸러내므로 422 는 '직접 questionId 를 찍은 비정상 클라이언트'에서만 주로 발생하고, 정상 UX 경로 발생률은 낮다는 반론 — 발생 빈도 기준 MINOR 강등 가능. 그러나 감지 루프의 목적은 빈도가 아니라 '새 적재 라운드가 결함을 섞었을 때 며칠 안에 아는가'이므로, 다음 BATCH(P4~P6 갭 보강, 2차 확장)마다 재노출되는 구조 부채로 봐 MAJOR 유지.
- Horizon: 다음 콘텐츠 적재 라운드(E0-8 P4~P6, 2차 서빙 확장)에서 결함 혼입 시 — 시험 시즌 트래픽에서 무감지 누적
- 권고: 422 경로에도 recordPublicEvent(kind:'defect', blobs:[reason, questionId 해시]) 추가(PII 0 유지) 또는 engine_telemetry learning_slo 이벤트로 emit 해 기존 silent-failure monitor 의 SILENT_FAILURE_EVENTS 에 'public_grade_defect' 편입 — 기존 cron 집계 인프라 재사용으로 코드 소건.

## D-m5 [MINOR] Analytics Engine 이벤트 write-only — 소비(쿼리/대시보드) 경로 0인 채 90일 보존창 소진 시작

- 파일: `apps/api/src/public/analytics.ts:38-56`
- 상세: serve/grade/card 이벤트는 기록되지만(analytics.ts:45), repo 전체에서 AE SQL API 를 읽는 스크립트·admin-web 화면·runbook 이 0건이다(grep: 소비자 없음 — 유일 언급은 promo scope 문서의 의도 서술). AE 보존은 90일이므로 홍보 개시 첫 분기의 퍼널 데이터(BE-6 ③ 의 존재 이유인 '홍보 효과 측정')가 읽히기 전에 증발할 수 있다. 이벤트 스키마(blobs 위치 의미)도 코드 주석에만 있어 6개월 뒤 쿼리 작성 시 재해석 비용 발생.
- Devil's Advocate: 소비자는 90일 안에 언제든 후행 구축 가능하고, Cloudflare 대시보드에서 dataset raw 확인도 가능하므로 지금은 '기록부터'가 옳은 순서였다는 반론이 유효 — 그래서 MINOR. 단 스키마 문서화(blobs[0..4] 의미 고정)는 지금 안 하면 드리프트한다.
- Horizon: 홍보 개시 +90일 — 첫 분기 지표 소실 시점
- 권고: scripts/query-public-analytics.ts(AE SQL API, API 토큰은 진산 게이트) 1본 + docs/observability/ 에 이벤트 스키마 표(blobs 인덱스 의미) 영속. 주 1회 수동 실행 runbook 1줄이면 충분.
- INDEX 병합: **B-M5 에 흡수 → 통합 M-14** (동일 file·동일 보존창 증발 증상 — devops 는 '소비 경로 0' 각도로 반향)

## D-m6 [MINOR] JWT_SECRET 이중 용도(auth JWT + 공개 choiceId HMAC) + '' 폴백 — 로테이션 runbook 부재로 로테이션 시 in-flight 객관식이 무음 오답 처리

- 파일: `apps/api/src/public/routes.ts:282, 367-374`
- 상세: 공개 choiceId 서명 키가 auth JWT_SECRET 을 공유하고(routes.ts:282,367,472) 미설정 시 `?? ''` 빈 문자열 폴백. 시크릿 로테이션 runbook 이 repo 에 없고, 로테이션하면 서빙 시점 발급된 choiceId 가 resolveChoiceId null → `isCorrect=false`(:374) 로 **에러가 아니라 오답**으로 채점된다 — '정답 100%' 북극성을 운영 행위가 침해하는 경로. 빈 문자열 폴백도 배포 설정 누락을 무음 통과시킨다(주석의 'F-3 하 보안 영향 0' 은 유출 관점만 다룸).
- Devil's Advocate: 로테이션은 드물고 세션은 분 단위라 blast radius = 로테이션 순간의 in-flight 문항 몇 개뿐이며, 공개 표면은 점수 영속도 없다(로컬 진도만) — 실피해 극소로 MINOR 가 맞다. 반박의 반박: 다만 auth 침해로 긴급 로테이션하는 날 공개 표면까지 조용히 오채점되는 결합은 runbook 한 장으로 끊을 수 있는 싼 부채다.
- Horizon: 첫 시크릿 로테이션(보안 사고 대응 또는 연 1회 위생 로테이션) 시점
- 권고: docs/runbooks/secret-rotation.md 신설(대상 시크릿 목록·순서·choiceId 무효화 영향 고지) + 장기적으로 choiceId 전용 시크릿 분리(PUBLIC_CHOICE_SECRET)로 auth 로테이션과 탈동조. resolveChoiceId null 을 오답 대신 410(재서빙 유도)으로 구분하는 것도 검토.

## D-m7 [MINOR] 공개 /questions/next 가 ORDER BY RANDOM() 풀스캔 + 캐시 0 — 홍보 스파이크에서 D1 row-read 증폭

- 파일: `apps/api/src/public/routes.ts:256-260`
- 상세: 요청마다 exam_questions 매칭 행 전수(~520+)를 RANDOM() 정렬하는 풀스캔. KV CACHE 바인딩이 존재하지만(wrangler.toml:53) 미사용, HTTP Cache-Control 도 없다. 홍보 성공 = 트래픽 스파이크가 설계 목표인 표면에서 요청당 ~500 row read 증폭은 free tier(일 5M row read) 기준 일 ~1만 요청에서 한도 도달, 정오 무렵 429/오류로 전락.
- Devil's Advocate: Vectorize 사용 중 = Workers Paid 플랜일 개연성이 높고, Paid 는 월 250억 row read 포함이라 실질 임계는 요원하다 — 그래서 MINOR. 또 per-IP 60/min 리밋이 단일 소스 남용은 이미 차단. 플랜 확인 1회로 완전 종결 가능한 항목.
- Horizon: 홍보 바이럴 스파이크(플랜이 free 였을 경우) 또는 2호 종목 추가로 공개 표면 배수 확장 시
- 권고: 진산 콘솔에서 플랜 확인 1회 기록 + 서빙 자격 문항 id 목록을 KV 에 5분 캐시(랜덤 픽은 메모리에서) — 요청당 row read 를 ~1로 절감. 코드 소건이며 문항 승급/강등 반영 지연 5분은 허용 범위.
- INDEX 병합: **P-M1 에 흡수 → 통합 M-8** (동일 file:line·동일 풀스캔 증상 — devops 는 캐시 0·free tier 임계 각도로 반향)

---

## 확인 항목 (증거 기반)

- PASS — 공개 표면 rate limit fail-closed: apps/api/src/auth/rate-limit.ts:54-66 handleMissingBinding 이 production/staging 에서 바인딩 누락 시 fail-closed(false) 확인, public/rate-limit.ts:26-27 이 동일 정책 재사용 + IP 는 SHA-256(IP||PEPPER) 해시로 PII 0
- PASS — rate limit 네임스페이스 환경 분리: apps/api/wrangler.toml:109-112(dev 1005)/:180-184(staging 2005)/:253-257(production 3005) — staging 테스트가 prod 카운터 소모하는 클래스 사고 차단 유지
- PASS — AE dataset 환경 분리: wrangler.toml:115-117/:187-189/:260-262 thepick*public_events*{dev,staging,production} 3분리 — staging 트래픽의 production 지표 오염 없음
- PASS — D1 스키마 드리프트 자동 감시: .github/workflows/d1-schema-drift.yml — push(migrations/\*\*)+PR+daily cron(UTC 00:00) staging↔production 대조, DA-C3 흡수 이력 주석 확인
- PASS — CI secret scan: .github/workflows/ci.yml secret-scan job(gitleaks, fetch-depth 0) + scripts/check-no-secrets.sh 존재. P0 커밋(5210333)에서 PUBLIC*TEST*\* 자동로그인 크리덴셜 제거 확인(git log)
- PASS — production observability 기본선: wrangler.toml:223-225 [env.production.observability] enabled=true, head_sampling_rate=1 (전수 샘플링)
- PASS — 기본 env 오배포 차단: apps/api/package.json:8 `deploy` 스크립트가 의도적 exit 1 — staging/production 명시 강제
- PASS — Cloudflare 단일 벤더 정합: 신규 표면의 텔레메트리(Analytics Engine)·rate limit(Workers Rate Limit API)·난수(crypto.getRandomValues) 전부 Cloudflare/Web 표준 — 외부 SaaS 유입 0 (ADR-006/022 정합)
- PASS — 공개 표면 경계 강제 운영 리스크: routes.ts:48-49 FIXED_EXAM_TYPE='1st'/FIXED_STATUS='active' 서버 고정 + 서빙(:236-237)·채점(:331)·공개(:443) 3경로 WHERE 동일 적용 — 2차/flagged 누출 없음
- N/A — Logpush 설정 자체: Logpush 는 Cloudflare 대시보드/API 리소스로 repo 내 설정 파일이 존재하지 않는 영역(코드 증거 불가) — 미설정 정황은 index.ts:249 주석('logpush 미설정 환경')으로만 확인, 로그 보존창 문제는 D-M4 에 흡수
- N/A — IDB↔D1 오프라인 동기화(sw.js syncOfflineActions stub): CLAUDE.md 스택 절에 정직 표기된 기지 미구현(RC-3) — 기지 항목 중복 보고 제외. 신규 local-progress(apps/web/src/lib/local-progress/db.ts)는 G-1 로컬 전용 설계라 동기화 무관 확인
- 확인 — scheduled 핸들러 구조: apps/api/src/index.ts:198-263 — cron 1개(0 3 \* \* \*)에 GC+silent-failure monitor 직렬, at-most-once 무재시도 주석 자인, 알림 = logger.error+console.error 이중 emit 뿐 (D-M1 근거)
- 확인 — 배포 이력 사고 전례: CLAUDE.md 2026-06-01 갱신 블록 — production Worker 2026-05-10 stale 빌드로 graph 라우트 404 (D-M2 근거)
- 확인 — 백업 관련 전 문서: docs/runbooks/ 3종(production-deployment, migration-rollback+sql 6본, engine-telemetry-gc) 전수 열람 — 스케줄 백업/DR/RPO/RTO/시크릿 로테이션 문서 0건 (D-M3·D-m6 근거)
- 확인 — 직전 5-페르소나(2026-05-29) devops C-1~C-4 '운영 자동화 공백'과의 중복 회피: 본 보고는 promo-1st 신규 표면이 만든 증분(공개 무인증 표면 런칭 게이트·AE 신설·choiceId 시크릿 결합·공개 표면 결함 텔레메트리)에 한정
