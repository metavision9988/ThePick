# Cloudflare Pages 신규 프로젝트 셋업 (apps/web)

> **목적**: Step 5-A — apps/web `/study` 페이지 production 노출 + Phase 2 이후 git push 자동 빌드/배포 정합 (memory `feedback_single_vendor_cloudflare.md` 정합).
> **작성**: Session 065 (2026-05-10), Step 5-A B 옵션 채택 (Git 연결, 1회만).
> **대안 비교**: 옵션 A (토큰 권한 확장 + 매 배포 wrangler) / **B (Git 연결 + 자동 빌드, 권고)** / C (수동 dashboard upload).

---

## 1. 사전 영속 (본 절차 진입 전 확정)

| 항목               | 값                                                          |
| ------------------ | ----------------------------------------------------------- |
| GitHub repo        | `metavision9988/ThePick`                                    |
| Production branch  | `main`                                                      |
| 마지막 영속 commit | f98532d (Phase 2 Eval MVP Step 4 4-Pass 흡수)               |
| API production URL | `https://thepick-api-production.metavision9988.workers.dev` |
| API 인증 미들웨어  | requireAuth (study route 401 검증 PASS)                     |

---

## 2. 진산님 dashboard 작업 절차 (1회만, ~5분)

### 2.1 Cloudflare dashboard 진입

1. https://dash.cloudflare.com/ 로그인 (metavision9988@gmail.com)
2. 좌측 사이드바 → **Workers & Pages** → 상단 **Create** 버튼

### 2.2 Pages 신규 프로젝트 — Git 연결

1. **Pages** 탭 클릭 → **Connect to Git** 선택
2. **Connect GitHub** → OAuth 권한 승인 (private repo 접근 권한 포함)
3. Repository 선택: **metavision9988/ThePick**
4. **Begin setup** 클릭

### 2.3 빌드 설정 (Build settings)

| 항목                       | 값                                 | 비고                            |
| -------------------------- | ---------------------------------- | ------------------------------- |
| **Project name**           | `thepick-web`                      | (또는 `thepick-web-production`) |
| **Production branch**      | `main`                             |                                 |
| **Framework preset**       | `None` (또는 `Astro` 검색 시 선택) | preset 자동 감지 가능           |
| **Build command**          | `pnpm --filter @thepick/web build` | 모노레포 정합                   |
| **Build output directory** | `apps/web/dist`                    | Astro 표준                      |
| **Root directory**         | `/` (비워두기)                     | 모노레포 루트에서 빌드          |

### 2.4 환경변수 (Environment variables, Production)

**Production** + **Preview** 두 환경 모두 동일하게 설정:

| 변수명                | 값                                                          | 타입                                |
| --------------------- | ----------------------------------------------------------- | ----------------------------------- |
| `PUBLIC_API_BASE_URL` | `https://thepick-api-production.metavision9988.workers.dev` | Plaintext                           |
| `NODE_VERSION`        | `22`                                                        | Plaintext                           |
| `PNPM_VERSION`        | `9.15.0`                                                    | Plaintext (선택, 자동감지 안 될 시) |

> ★ `PUBLIC_` prefix는 Astro/Vite가 빌드 시 inline → 클라이언트 번들에 노출 (PII 아님, public URL).

### 2.5 빌드 시스템 버전

- **Build system version**: 최신 (v3 권장)
- **Compatibility flags**: 비워두기 (Pages 자체 빌드는 nodejs_compat 자동)

### 2.6 Save and Deploy

1. **Save and Deploy** 클릭
2. 첫 빌드 시작 → 대시보드에서 진행 상황 추적 (~2~3분)
3. 빌드 성공 시 production URL 자동 발급:
   - `https://thepick-web.pages.dev` (또는 `thepick-web-production.pages.dev`)

### 2.7 Custom Domain (선택, Phase 3 carry-over)

- 향후 `thepick.app` 또는 `study.thepick.app` 등 도메인 연결은 별도 plan
- 본 step은 `*.pages.dev` URL 정합

---

## 3. 검증 절차 (진산님 작업 완료 후 Claude 자동 검증)

진산님이 위 절차 완료 후 Pages URL을 채팅에 발화하면 Claude가 자동으로:

1. `curl -s -o /dev/null -w "%{http_code}" https://<pages-url>/` → HTTP 200 PASS
2. `curl -s https://<pages-url>/study` → study 페이지 HTML 응답 검증
3. `curl -s https://<pages-url>/_astro/QuestionCard.*.js | grep "thepick-api-production"` → API URL inline 정합
4. CORS preflight: `curl -s -X OPTIONS -H "Origin: https://<pages-url>" https://thepick-api-production.metavision9988.workers.dev/api/study/next` → CORS 응답 검증
   - ★ apps/api/src/index.ts CORS allowlist에 Pages URL 추가 필요할 수 있음 (검증 후 결정)

---

## 4. 인증 진입 — M6 carry-over (Step 5-C G9 진입 전 결정)

apps/web 인증 페이지(`/auth/login.astro`) 미구현 → /study 진입 시 401 응답.

진산님 G9 학습 시도 옵션:

- **G9-A (권고, 빠름)**: production /api/auth/register 또는 login curl로 세션 쿠키 받기 → 브라우저 개발자 도구 Application → Cookies 수동 주입
- **G9-B (M6 즉시 흡수)**: apps/web에 임시 `/auth/login.astro` 페이지 신설 (~30~40분, 다음 Step에 carry-over)

→ **G9-A 권고**: Pages 첫 배포 검증 후 Claude가 진산님 user_id 받아 curl 인증 명령 영속.

---

## 5. 자동화 효익 (B 옵션 선택 사유 영속)

- 본 1회 셋업 후 모든 git push to main → Cloudflare Pages 자동 빌드/배포
- Phase 2/3에서 apps/web 변경마다 wrangler 토큰 발화 의무 0
- Preview deployment: feature branch push 시 자동 preview URL 생성 (E2E 회귀 검증 정합)
- memory `feedback_single_vendor_cloudflare.md` + `feedback_full_autonomy.md` 정합

---

## 6. carry-over (다음 plan)

- **Custom domain**: thepick.app 또는 study.thepick.app — 별도 plan (Phase 3 launch 직전)
- **CORS allowlist**: apps/api/src/index.ts CORS origin에 `*.pages.dev` 허용 — 첫 배포 후 검증 시 결정
- **M6 auth/login.astro 본격**: phase2-eval-mvp.plan §8.5 또는 별도 plan
- **Preview branch 정책**: feature/\* 브랜치 push 시 Preview deploy → Phase 2 후반 PR 워크플로우 정착 시 결정

---

**작성**: Claude (Opus 4.7 1M context) — Session 065 Step 5-A
**작성 효력**: 2026-05-10 KST
**진산님 작업 시간**: ~5분 (dashboard UI 클릭 + 환경변수 입력)
