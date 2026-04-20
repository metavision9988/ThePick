# Session 9 시작 프롬프트

아래 내용을 Claude Code 새 세션 시작 시 그대로 복사해서 붙여넣기.

---

```
Session 9 시작. 이전 세션 핸드오프를 먼저 읽어주세요:

1. /home/soo/ClaudePro/ThePick/.jjokjipge/handoff-session-008.md
2. /home/soo/ClaudePro/ThePick/.jjokjipge/state.json
3. /home/soo/ClaudePro/ThePick/docs/plans/current.plan.md
4. /home/soo/ClaudePro/ThePick/.claude/reviews/review-20260418-201954.md

Phase 1 Step 1-1 (PBKDF2 인증) 완료 상태입니다. Critical 0건, Major 4건 이월.
staging + production D1에 migrations 0001~0007 전부 적용됨 (47+ triggers).
monorepo tests 406건 통과.

지금 해야 할 일 — Step 1-2 착수 전 제 수동 작업 3건:

  1) L3 plan 새 파일 교체 (docs/plans/current.plan.md → Step 1-2 scope로 덮어쓰기)
  2) KV namespace 2개 발급:
     cd apps/api
     wrangler kv:namespace create CACHE --env staging
     wrangler kv:namespace create CACHE --env production
     → 발급받은 id 2개 알려주면 wrangler.toml에 binding 주입

  3) PBKDF2 600k CPU 실측 (staging 배포 후):
     wrangler deploy --env staging
     wrangler tail --env staging
     → register/login 요청 보낸 후 CPU 시간 확인 (Free 50ms vs Paid 30s 여유)

이 3건을 제가 먼저 실행하겠습니다. 순서대로 진행하면 될까요?
아니면 Step 1-2 webhook 구현을 먼저 착수하고 KV는 뒤에 처리할까요?

Step 1-2 예정 범위:
  - apps/api/src/webhooks/payment.ts (Replay/Idempotency)
  - apps/api/src/auth/ logger 마이그레이션 (console.* → @thepick/shared logger)
  - KV 폴백 미들웨어 (ADR-008 §3 read-only 공용 데이터 대상)
  - dummy-verify DUMMY_HASH 실제 PBKDF2 산출물로 교체 (M-dummy-hash 이월)

핵심 규칙 유지:
  - Cloudflare 단일 벤더 원칙 (ADR-006) — 외부 SaaS 금지
  - L3 경로 수정 시 current.plan.md scope 확장 필수 (protect-l3.sh 차단)
  - L2+ 변경 완료 = 4-Pass 독립 에이전트 리뷰, Phase 마일스톤 = 5-페르소나
  - 상용 품질 (any/하드코딩/빈catch/TODO/import * 금지)
  - Hard Rule 15~17 Year 1 재해석본 (ESLint Rule 17 활성, 시험 ID 리터럴 exam-ids.ts 외 금지)
  - v3.0 FINAL 멀티시험 전환은 Year 2 Phase 4 이월 (ADR-007)
  - users 테이블 전체 12컬럼 정합 (v3.0 §7.1) — name 컬럼 포함

이월 Major 4건 (Step 1-2 이후 순차 해소):
  - M-logger: routes.ts console → @thepick/shared logger 마이그레이션 + maskEmail 임시 함수 제거
  - M-KV-env: wrangler.toml staging/production KV binding 선언 (위 수동 작업 2번과 연동)
  - M-dummy-hash: DUMMY_HASH 실제 PBKDF2 산출물로 교체
  - M-rate-limit-namespace: 환경별 namespace_id 분리 (dev 1001/1002, staging 2001/2002, prod 3001/3002)

시작하기 전에 필요한 MCP 도구나 추가 컨텍스트가 있으면 알려주세요.
```

---

## 부가 메모 (Session 8 → 9 전환)

### 즉시 확인해야 할 환경

```bash
# Cloudflare 세션 복원 (재부팅 후 OAuth 재발급 불필요 — API token 기반)
cd /home/soo/ClaudePro/ThePick/apps/api && wrangler whoami

# D1 migration 상태 확인 (staging/production 둘 다 0007까지 적용됨 확인)
wrangler d1 migrations list DB --remote --env staging
wrangler d1 migrations list DB --remote --env production

# 로컬 의존성 상태
cd /home/soo/ClaudePro/ThePick && pnpm install --frozen-lockfile

# 최종 검증 (새 세션 초반 1회)
pnpm -r typecheck && pnpm -r lint
pnpm --filter @thepick/api test
```

### 커밋하지 않은 변경 (58건)

Session 8 종료 시점 uncommitted 상태. Step 1-2 착수 전:

- 기존 Session 7 이월 + Session 8 전체 작업을 **단일 커밋** 으로 묶을지
- 아니면 논리 단위 (G6 / 기술부채 / Step 1-1) 로 **3 커밋** 분할할지
- 결정 필요. 진산님 선호 확인.

### Phase 1 Step 1-1 완료 지표

| 항목                                  | 값                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------- |
| typecheck                             | 14/14 패키지 통과                                                       |
| lint                                  | 14/14 패키지 통과 (ESLint Rule 17 활성)                                 |
| tests                                 | monorepo 406건 통과 (api 58 포함)                                       |
| D1 triggers (staging+production 각각) | 47+ (5 prevent + 30 not_null + 9 users + 3 auto-timestamp/format/iter)  |
| ADR 정합                              | ADR-005 (PBKDF2 600k) + v3.0 §7.1 (users 12컬럼) 7 레이어 완전 일치     |
| Hard Rule                             | 15/16/17 준수, 리터럴 grep 0건                                          |
| 독립 리뷰                             | 1차 4-Pass (Critical 9) → B안 수정 → 2차 축약 2-agent (Critical 0) 완료 |
