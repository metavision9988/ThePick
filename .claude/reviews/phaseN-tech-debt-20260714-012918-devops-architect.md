# Phase N 기술부채 리뷰 — devops-architect

- ts: `20260714-012918`
- 관점: 운영 부채 — "새벽 3시 on-call 시나리오?"
- 합계: CRITICAL 1 / MAJOR 3 / MINOR 3

---

## DO-1 (CRITICAL) — 정합성/결함 텔레메트리 리더(read-public-analytics --alert)가 어떤 cron 에도 미배선 → 라이브 채점 서비스의 무음 오채점이 인간에게 자동 도달 0

- 파일: `scripts/read-public-analytics.mjs` (12-17, 131-136)

D-17(choice_id_unresolved/malformed = 무음 오채점 신호) → D-20(AE reader) → D-36(secret 회전 runbook) 3단 탐지·대응 루프 구축, --alert 는 정합성 신호 ≥1 시 exit 2(인프라 실패 1 과 구분)까지 설계. 그러나 grep: 이 리더는 .github/ 어떤 워크플로에서도 미호출(ops.yml 은 smoke-public-surface.mjs 만 실행). 라이브 채점 결함(422 defect + choice_id 정합성 신호)은 AE 에 ~90일 롤오프까지 쌓이지만 '누군가 손으로 리더 돌릴 때'만 발견. secret-rotation.md §4 는 'cron 경보를 통째 억제하지 말 것'이라 cron 경보 존재를 전제하나 실제 부재 = 문서-현실 괴리. thepick-study.pages.dev /practice/ 는 지금 라이브·실 수험생 채점. 정답오류 36건 수개월 잠복 선례가 바로 이 무음 결함 클래스 — 관측 장치는 만들었으나 출력이 자동으로 아무에게도 안 감.

- **★진앙 귀속: RC-2(라이브 채점 무음 오채점 안전망 공백). quality QA-1(구조 백스톱 삭제)과 교차 합의 — QA-1 은 구조 백스톱, DO-1 은 관측 백스톱 결손. dedup 후에도 CRITICAL 로 존속(병합으로 0 될 수 없음).**
- 반론: choiceId 정합성 신호는 자가교정(수분 감쇠)·주로 secret 회전 시만 튐, 현 표면 무인증 저트래픽. 36건도 텔레메트리 아닌 -MC 감사로 발견 → 유일 방어선 아님. 그러나 콘텐츠 422 defect 버킷도 동일 리더로만 노출 = '라이브 오답 서빙'의 유일 자동 신호 미배선 → CRITICAL 유지.
- Horizon: 지금 즉시 — 라이브 서비스가 채점하는 매일. 인증 1차 오픈 후 실 학습자 유입 시 폭발 규모 증가.
- 권고: ops.yml 일간 job 추가 — `CLOUDFLARE_API_TOKEN`(Analytics Read) + `node scripts/read-public-analytics.mjs --env production --days 1 --alert`. exit 2 시 GH 실패 → 최소 1채널 알림. exit-code 규약(1 인프라/2 정합성)이 이미 cron 전제 설계 → 배선만 하면 됨.

## DO-2 (MAJOR) — crown-jewel 자격증명 CLOUDFLARE_API_TOKEN(D1 전체 export + R2 write)에 회전 runbook·스코프·만료 정책 부재 (저가치 choiceId secret 은 상세 runbook 보유 = 역전된 우선순위)

- 파일: `docs/runbooks/secret-rotation.md` (12-18)

§0 인벤토리는 JWT_SECRET·WEBHOOK_HMAC·PUBLIC_CF_BEACON 만 나열, GH Actions 시크릿 CLOUDFLARE_API_TOKEN 누락. 이 토큰은 ops.yml backup(:50)에서 production D1 전체 export + R2 write 권한 = 최강 자격증명(유출 시 전 production 데이터 exfiltration + 백업 변조). 회전주기·최소권한·만료 문서화 0. 반면 runbook 이 '보안 경계 아니다'(§1)라 규정한 choiceId secret 엔 156줄 상세 절차. §4/§0 에서 이 토큰을 'Account Analytics Read' 표기하나 backup 은 D1 export+R2 write 요구 = 스코프 표기 불일치(과대권한이 Read 로 위장).

- **★진앙: RC-6(운영 자격증명·DR 성숙도).**
- 반론: 토큰은 1st-party 스크립트 2곳만, gitleaks 커밋 차단, ci.yml untrusted input 미사용. CF 토큰 스코프 가능 → 실제 최소권한일 수 있음. 그러나 '최강 자격증명 회전 runbook 없음 + 스코프 불일치' = 사고 시 blast-radius 미상 → MAJOR.
- Horizon: 보안 사고 발생 시 언제든. Year 2 유지보수기 토큰 방치 시 누적.
- 권고: §0 에 CLOUDFLARE_API_TOKEN 행(용도=D1 export+R2 write, 주입=GH secret, blast=전 production). 실 스코프(D1 Read+R2 Write, 그 외 deny) 명문화 + 회전 절차 + 만료일.

## DO-3 (MAJOR) — R2 오프사이트 백업 복원 드릴 부재(RTO '분 단위'는 미검증 주장) + 보존/lifecycle 정책 0 무한 누적

- 파일: `docs/runbooks/migration-rollback.md` (230-231)

§10 은 'RTO = import 소요(현 3MB ≈ 분 단위)' 주장하나 R2 스냅샷 SQL 을 신규 D1 import 후 바인딩 전환 복원 드릴 수행·검증 기록 0 = Schrödinger 백업(포맷·트리거·인덱스 재생성 순서 미검증). backup-d1-to-r2.sh 는 d1/production/<ts>.sql 매주 무한 업로드하나 R2 lifecycle/보존 규칙 부재(grep 확인) → 객체 무한 누적. RPO 주간 cron(1주) = 30일+ 잠복 결함 복구라는 R2 존재이유에서 최대 1주 손실 창.

- **★진앙: RC-5(데이터 수명주기, backend BE-2 retention 과 교차) + RC-6(DR 성숙도).**
- 반론: R2 저장 저렴(3MB×52/yr≈156MB/yr 무시)·<30일 Time Travel 커버. 그러나 '분 단위 RTO' 증거 없이 확정 기재 + 실전 복원 미검증이 진짜 공백 → MAJOR.
- Horizon: 복원이 실제 필요한 날(Year 2 잠복 결함 발견) — 첫 import 시도 시 포맷·순서 문제로 RTO '분'→'시간+' 가능.
- 권고: 분기 1회 restore 드릴(최신 R2→임시 D1 thepick-db-dr-drill import→row count 검산→삭제) 결과를 §10 RTO 실측치로. R2 lifecycle(90일 초과 주간 정리, 월 1개 보존).

## DO-4 (MAJOR) — GitHub 스케줄 워크플로 60일 무활동 자동 비활성화 트랩 (조용한 기간에 백업·스모크가 스스로 꺼지고 무음)

- 파일: `.github/workflows/ops.yml` (8-11)

backup+smoke 는 오직 schedule cron 의존. GH 정책상 60일 무활동 시 스케줄 워크플로 자동 비활성화(알림 미약). 손해평가사 시험 계절성(시험 주기 사이 장기 소강)이 정확히 '아무도 안 보는 조용한 기간'에 60일 경계 밟음 → 그 순간 DR 안전망(주간 백업)+라이브 스모크 동시 증발. 자기 보호 자동화가 방치 시 스스로 꺼지는데 알리는 신호 없음.

- 반론: 현 커밋 빈도 높아 근시일 비현실적. 그러나 시험 시즌 사이 소강은 도메인 구조적 특성 + 그때가 아무도 안 보는 시점 = 위험 창 일치 → Year 2 horizon MAJOR.
- Horizon: 임의 60일 소강(Year 2 유지보수기, 시험 시즌 사이) — 계절성 서비스에서 현실적.
- 권고: keep-alive 워크플로(월 1회 no-op) 또는 외부 CF Worker cron(단일벤더 정합)에서 ops workflow_dispatch. 최소 '마지막 백업 이후 8일 경과' stale-check 로 자동 비활성화 관측 가능하게.

## DO-5 (MINOR) — 단일·취약 알림 채널(GH Actions 기본 이메일)만 존재 (에스컬레이션·양성 확인 부재)

- 파일: `.github/workflows/ops.yml` (5, 29)

주석이 '실패 시 GH 알림 메일 = 최소선 1채널' 자인. 스모크/백업 실패 유일 신호가 GH 기본 이메일(마지막 커밋자·필터 누락 쉬움), 에스컬레이션·재알림 없음. 백업 '성공' 양성 확인이 durable 하게 안 남아 — 조용히 계속 실패해도 복원 갈 때까지 모름(negative-only).

- **★진앙: RC-6.**
- 반론: 무인증 pre-revenue 표면엔 GH 이메일 비례적·팀 '1채널 최소선' 명시 수용 → 인증 오픈 전 MINOR, 오픈 후 MAJOR 승격 권고.
- Horizon: 인증 1차 오픈 후 실 학습자 의존 시.
- 권고: backup 성공 시 R2 매니페스트(최신 키·크기·시각) 갱신 + 일간 stale-check 양성 확인. 알림 CF-native(단일벤더) 이메일/Worker webhook 이중화.

## DO-6 (MINOR) — Logpush(→R2) 부재 (관측성이 AE ~90일 롤오프 상한, 90일+ 사고 포렌식 로그 트레일 없음)

- 파일: `apps/api/wrangler.toml` (115, 260)

analytics_engine_datasets 는 있으나 logpush/tail_consumers 0(grep). AE ~90일 롤오프 → 90일+ 사고(정답오류처럼 수개월 잠복) 포렌식 재구성 불가. CF 단일벤더는 Logpush→R2 native 지원(정합).

- 반론: 핵심 지표는 AE 커버, 정답오류 포렌식은 D1 status_transitions(영구)에서 나옴. 로그 장기보존 실효 이득 현 단계 제한 → MINOR.
- Horizon: Year 2 사고 포렌식·감사 요구 시.
- 권고: apps/api Logpush job(→r2://thepick-backups/logs/) 또는 tail_consumers. 보존기간·PII 마스킹(user_progress 정합) 동반.

## DO-7 (MINOR) — 배포-시점 스모크 게이트(D-16)가 auth 경로·JWT_SECRET 길이 미검증 (too-short secret 로 로그인 전면 파손돼도 게이트 green)

- 파일: `docs/runbooks/secret-rotation.md` (86-93, 129)

deploy:production 자동 스모크(smoke-public-surface.mjs)는 공개 무인증 표면만, choiceId 길이 무검증 → JWT_SECRET<32자여도 스모크 통과하나 실제 login 500(JWT_SECRET_TOO_SHORT, session.ts:55). runbook 이 FLAG-2 로 자인·auth 확인을 수동 §5 분리했으나 자동 게이트 green 인 채 인증 전면 파손 가능 관측 사각.

- 반론: runbook 명시 문서화 + 수동 완화 절차 제공, 현 라이브 무인증이라 auth 파손 영향 0 → known-gap MINOR.
- Horizon: 인증 1차 오픈 후 첫 secret 회전 시.
- 권고: 스모크에 auth 헬스체크 1건(테스트계정 login→200 또는 JWT_SECRET 길이 검증 엔드포인트) 추가.

---

## checkedItems (증거 기반 PASS/N-A)

- PASS — CI 게이트 종합성: ci.yml:48-105 typecheck/lint/11패키지 test/scripts test/engine-contracts/pnpm audit HIGH+ 차단 + gitleaks(179-195) + E2E Playwright(110-177)
- PASS — 배포 추적성: deploy-production.mjs:65-91 version.json(git SHA·dirty·builtAt·apiBase) + wrangler --commit-hash (D-21)
- PASS — 백업 무결성 가드: backup-d1-to-r2.sh:22-25 export <100KB 시 abort + set -euo pipefail
- PASS — AE 리더 주입 안전: public-analytics-reader.mjs:38-43 dataset 화이트리스트 + windowDays 양의정수 검증, parseAeResult(56-67) 무음실패 금지(throw)
- PASS — exit-code 규약: read-public-analytics.mjs:15-17,30 인프라(1) vs 정합성(2) 구분 (단 이 cron 자체 미배선 = DO-1 CRITICAL)
- PASS — secret 회전 blast-radius 깊이: secret-rotation.md §2.1-2.3 JWT refresh 15분 graceful·choiceId 자가교정·webhook 독립을 실코드 근거 실측
- PASS — CI 공급망: ci.yml:3-4 untrusted github.event 미사용 + 공식 action 핀, ops.yml:6 동일
- PASS — Time Travel <30일 DR: migration-rollback.md:200,230 CF 30일 PITR 문서화 (공백은 30일+ R2 경로 복원드릴·RPO)
- N/A — 컨테이너/K8s: CF Workers/Pages 서버리스 = 해당 없음(단일벤더 정합)
- N/A — IaC drift: wrangler.toml 이 사실상 IaC, d1-schema-drift.yml 이 스키마 드리프트 CI 감지 중
