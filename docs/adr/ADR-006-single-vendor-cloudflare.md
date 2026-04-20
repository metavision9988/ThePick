# ADR-006: Cloudflare 단일 벤더 원칙

- **상태:** Accepted
- **결정일:** 2026-04-18
- **결정자:** 진산 (Session 7 명시 지시)
- **관련 리뷰:** `.claude/reviews/phase0-tech-debt-20260418-092310.md` (DevOps D-C2 Observability 지적)

## 맥락 (Context)

쪽집게(ThePick)는 진산님 1인이 운영하는 상용 서비스다. Opus 4.7 재검토 보고서는 5개 이상의 외부 SaaS 도입(Sentry, PostHog, Resend, Mixpanel, Datadog 등)을 권고했고, 5-페르소나 기술부채 리뷰(DevOps) 역시 "관찰가능성 인프라 부재"를 CRITICAL로 지적했다.

그러나 **1인 운영자가 N개 벤더를 동시에 관리하는 것은 그 자체로 사고 유발 요인**이다:

- 계정·청구·보안 설정 N개 파편화
- 장애 발생 시 어느 벤더가 원인인지 추적 비용
- SOC2/PIPA 등 컴플라이언스 범위 확장
- PII 데이터가 여러 벤더 서버로 분산 → 유출면 N배

2024~2026년에 Cloudflare는 Workers Observability, Analytics Engine, Email Routing, Turnstile, Access(Zero Trust), Queues 등을 네이티브로 완비하여, **"관찰·보안·분석 스택 전체를 Cloudflare 단일 벤더로 구성"**이 현실적으로 가능한 수준에 도달했다.

## 결정 (Decision)

### 핵심 원칙

**외부 SaaS 벤더 추가를 금지한다.** 기능이 필요할 때 Cloudflare 제공 여부를 먼저 확인하고, 가능하면 무조건 Cloudflare를 선택한다.

### 채택 매트릭스

| 기능               | 채택 (Cloudflare)                            | 배척 (외부 SaaS)              |
| ------------------ | -------------------------------------------- | ----------------------------- |
| Workers 런타임     | Workers Paid                                 | —                             |
| 관계형 DB          | D1                                           | Supabase/Neon/PlanetScale     |
| 벡터 DB            | Vectorize                                    | Pinecone/Weaviate             |
| 객체 스토리지      | R2                                           | S3/Backblaze                  |
| Key-Value          | KV                                           | Upstash/Redis Cloud           |
| 풀-텍스트 검색     | D1 FTS5 (MVP) → Workers AI                   | Algolia/Meilisearch           |
| **에러/로그 추적** | **Workers Observability**                    | ❌ Sentry                     |
| **제품 분석**      | **Web Analytics + Analytics Engine**         | ❌ PostHog/Mixpanel/Amplitude |
| **이메일 전송**    | **Email Routing + MailChannels via Workers** | ❌ Resend/SendGrid            |
| 캡챠               | Turnstile                                    | ❌ reCAPTCHA/hCaptcha         |
| 관리자 SSO         | Zero Trust (Access)                          | ❌ Okta/Auth0 (초기)          |
| 큐/비동기 작업     | Queues                                       | ❌ SQS/BullMQ                 |
| Cron 스케줄러      | Workers Cron Triggers                        | ❌ cron-job.org               |
| CDN/DDoS           | Workers/Pages 네이티브                       | —                             |
| 프론트엔드 호스팅  | Pages                                        | ❌ Vercel/Netlify             |
| 이미지 최적화      | Cloudflare Images                            | ❌ Cloudinary                 |
| AI 임베딩          | Workers AI (bge-m3)                          | ❌ OpenAI Embeddings          |

### 불가피한 외부 의존 (Cloudflare 미제공)

| 영역                | 선택                                      | 사유                         |
| ------------------- | ----------------------------------------- | ---------------------------- |
| 결제 PG             | Polar/PortOne/TossPayments (Phase 3 결정) | Cloudflare는 결제 처리 안 함 |
| LLM 추론 (Haiku 등) | Anthropic Claude API                      | 쪽집게 핵심 IP, 대체 불가    |
| 코드 저장소 + CI    | GitHub + GitHub Actions                   | Cloudflare는 VCS 아님        |
| 패키지 레지스트리   | npm (pnpm)                                | —                            |

### 신규 기능 추가 시 체크리스트

신규 벤더 도입 유혹이 생길 때마다:

1. **"Cloudflare가 제공하는가?"** — 공식 문서(developers.cloudflare.com) 확인
2. **"Cloudflare 내장으로 외부 서비스와 연동 가능한가?"** — 예: `[observability.logs] destinations = ["sentry-logs"]` 같은 패턴
3. 둘 다 No면 → **ADR 신규 작성**, "Cloudflare 대안 없음" 근거 명시, 진산 승인

## 결과 (Consequences)

### 긍정적

- **단일 청구서** — 월간 Cloudflare 명세 1장만 추적
- **단일 대시보드** — 장애 발생 시 `dash.cloudflare.com` 한 곳만
- **단일 SSO** — 2FA/관리자 권한 한 번
- **벤더 간 데이터 이동 0** — 지연 최소, PII 유출면 최소, Cloudflare 네트워크 내부에서만 전송
- **컴플라이언스 범위 축소** — PIPA 위탁처리 신고 대상 벤더 최소화

### 부정적 / 수용하는 트레이드오프

- **Sentry 수준의 Issue Grouping 부족** — Cloudflare Observability는 같은 에러를 stack trace 기반으로 묶는 UX가 Sentry보다 거침. 대안: JSON 구조화 로그 + custom dashboard 쿼리
- **PostHog 수준의 세션 리플레이·A/B 테스트 부족** — Analytics Engine은 집계 중심, 개별 사용자 여정 분석은 약함. Phase 3에서 수요 확인 후 재검토.
- **Resend 수준의 이메일 템플릿 UX 부족** — MailChannels via Workers는 플레인 HTML 직접 관리. 템플릿 빌더는 별도 사용.
- **벤더 집중 리스크** — Cloudflare 전체 장애 시 모든 것이 멈춤. 완화: D1 Time Travel 30일 + R2 외부 백업(개인 NAS/S3 Glacier — 이건 **데이터 백업이지 벤더 이중화 아님**)

### 중립

- Phase 3 유료 런칭 후 사용자 10K 초과 시, 분석/이메일 영역만 선별적으로 외부 SaaS 도입 재검토. 그때도 **Cloudflare destinations 연동 형태** 우선 (옵션 A).

## 기존 문서 정합화 (이 ADR로 인한 변경)

| 문서                                          | 기존                               | 변경                                                        |
| --------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `docs/architecture/THREAT_MODEL.md:144`       | Sentry 무료 5K/월 통합 예정        | Cloudflare Workers Observability (이미 enabled)             |
| `docs/architecture/THREAT_MODEL.md:145`       | PostHog Cloud 무료 1M/월 통합 예정 | Cloudflare Web Analytics + Analytics Engine                 |
| `docs/architecture/THREAT_MODEL.md:63`        | Resend (이메일)                    | Email Routing + MailChannels via Workers                    |
| `docs/adr/ADR-005:124`                        | Sentry/Cloudflare Analytics 추적   | Cloudflare Analytics만                                      |
| `docs/analysis/session-007-project-status.md` | "Sentry + PostHog 통합"            | "Cloudflare Observability + Analytics Engine"               |
| `Phase 1 게이트 G5`                           | Sentry DSN 발급                    | `packages/shared/src/logger.ts` 작성 + Cloudflare 내장 활용 |

## 후속 조치

- [ ] Phase 1 Step 1-1: `packages/shared/src/logger.ts` 작성 (Cloudflare Observability JSON 포맷)
- [ ] Phase 1 Step 1-2: `apps/api` 모든 라우트에 구조화 로깅 적용
- [ ] Phase 2 말: Cloudflare Analytics Engine custom metric schema 설계
- [ ] Phase 2 말: Email Routing + MailChannels 템플릿 설계
- [ ] Phase 3 초: Cloudflare Access로 관리자 CMS 보호
- [ ] Phase 3 초: Turnstile로 회원가입/로그인 캡챠
- [ ] 매 Phase 완료 시 5-페르소나 리뷰가 "신규 외부 벤더 도입" 자동 점검

## 참고

- Cloudflare Workers Observability: https://developers.cloudflare.com/workers/observability/
- Cloudflare Analytics Engine: https://developers.cloudflare.com/analytics/analytics-engine/
- Email Routing + MailChannels: https://developers.cloudflare.com/email-routing/
- Turnstile: https://www.cloudflare.com/products/turnstile/
- Zero Trust (Access): https://www.cloudflare.com/zero-trust/
- `.claude/reviews/phase0-tech-debt-20260418-092310.md` (DevOps D-C2)

## 수정 이력

- 2026-04-18: 초안 작성 (Session 7, 진산님 명시 지시)
