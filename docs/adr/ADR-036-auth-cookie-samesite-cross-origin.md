# ADR-036 — 인증 쿠키 SameSite 환경별 분기 (cross-origin pages.dev ↔ workers.dev)

## 상태

**Accepted (temporary)** (Session 065, 2026-05-10 → Session 069 ADR-037 retrofit 2026-05-12) — ADR-005 §Addendum partial-supersedes.

- **결정일:** 2026-05-10
- **만료 deadline:** Phase 3 launch 직전 (custom domain 통합 후 즉시 — `project_custom_domain_thepick_app_collision` carry-over 동기) — ⚠️ **2026-07-04 조기화: 서브도메인 통합 시(2호 온보딩 전후)로 승격, 아래 §Amendment note 참조**
- **복원 chain:** 본 ADR §"Phase 3 launch 직전 복원 의무" 5 항목
- **자동화 toggle 위치:** `apps/api/src/auth/routes.ts` 의 `authCookieSameSite(environment)` 환경별 분기 함수 (현 production='None' default). custom domain 통합 후 `wrangler.toml` `[env.production.vars]` 의 `AUTH_COOKIE_SAMESITE="Strict"` 설정으로 override 가능
- **Governance:** ADR-037 §"Retrofit 가이드라인" 정합 (Session 069 Phase 3 launch chain Step 5)

## 컨텍스트

Phase 2 Eval MVP Step 5-C 진산님 G9 production browser 학습 시도 중:

1. ✓ 회원가입 성공 (HTTP 201)
2. ✓ 로그인 성공 (set-cookie tp_access + tp_refresh)
3. ✓ /study/ 진입 + "2차 학습" 타이틀 잠시 표시
4. ✗ /api/study/next fetch 401 → AuthForm.tsx로 redirect (login 화면 복귀)

**원인 진단**: 쿠키가 `/study/` → `/api/study/next` cross-origin fetch에 전송 안 됨.

| 영역               | Origin                                                      |
| ------------------ | ----------------------------------------------------------- |
| apps/web (Pages)   | `https://thepick-study.pages.dev`                           |
| apps/api (Workers) | `https://thepick-api-production.metavision9988.workers.dev` |

`pages.dev` ↔ `workers.dev` = **eTLD+1이 다른 cross-site** 관계.
ADR-005 §Addendum `SameSite=Strict` 쿠키는 cross-site 요청에 미전송 → 매 fetch 401.

## 결정 영역 분류

memory `feedback_full_autonomy.md` "결정 영역 boundary":

- 인증 정책 = 진산 결정 (보통)
- 그러나 본 사안은 **domain 분리로 인한 기술 제약** = Workers/Pages 별도 도메인 = 진산 결정 무관
- 진산 명시 발화 (Session 065): "기술적인 것은 알아서 해줘" → 자동 진행 정합

## 결정

`SameSite` 환경별 분기 함수 `authCookieSameSite(environment)` 신규:

| environment               | sameSite | secure | 정합 도메인                                 |
| ------------------------- | -------- | ------ | ------------------------------------------- |
| `production`              | `'None'` | true   | cross-site (pages.dev ↔ workers.dev)        |
| `staging`                 | `'None'` | true   | cross-site (Phase 3 staging 도메인 분리 시) |
| `development` / undefined | `'Lax'`  | false  | same-origin (localhost)                     |
| `test`                    | `'Lax'`  | false  | vitest D1 mock                              |

브라우저 정책: `SameSite=None`은 `Secure=true` 강제. 본 분기는 그 정합 자동 보장.

## 근거

- **Cross-site cookie 의무**: 본 production은 apps/web (Pages) ↔ apps/api (Workers) 별도 eTLD+1. 'Strict'/'Lax'는 cross-site fetch 차단. 'None'만 허용.
- **Phase 3 launch 직전 custom domain 통합**: `study.thepick.app` (Pages) + `api.thepick.app` (Workers) → eTLD+1 동일 (`thepick.app`) → 'Strict' 복원 가능. 본 ADR-036는 그 시점 supersedes.
- **CSRF 방어 보강**: 'None' + Secure는 'Strict' 대비 CSRF 위험 노출. 그러나 본 production은 진산 단독 사용 + Origin allowlist (CORS_ALLOWED_ORIGINS) + httpOnly 쿠키 + JWT 검증 → 다층 방어 정합.

## Phase 3 launch 직전 **복원 의무** (★ carry-over)

memory `project_launch_legal_bundle_deferred.md` chain 동기 (ADR-034 + ADR-035 + ADR-036 묶음):

- [ ] custom domain 적용: `study.thepick.app` (Pages) + `api.thepick.app` (Workers)
- [ ] SameSite='None' → 'Strict' 복원 (또는 'Lax' — top-level navigation OK)
- [ ] CORS_ALLOWED_ORIGINS에서 `*.pages.dev` 제거 + custom domain 한정
- [ ] CSRF token 추가 검토 (Phase 3 보안 강화 시)
- [ ] ADR-005 §Addendum supersedes 표기 (본 ADR-036 reference)

## Amendment note (2026-07-04): 서브도메인 통합 = 복원 의무 조기 이행 경로

엔진 분리 R5 결재(`docs/plans/decision-card-20260704-engine-separation-r5.md` §2)로 서비스 전개가 **`{exam}.thepick.co.kr` 서브도메인 + `Domain=.{루트도메인}` SSO 쿠키**(통합 계정) 모델로 확정됨 → 본 ADR의 임시 `SameSite='None'`은 이 **서브도메인 통합 시점에 조기 복원**(`'Lax'`/`'Strict'`) 대상으로 승격된다.

- 위 §복원 의무 체크리스트의 "custom domain 적용"은 `study.thepick.app`/`api.thepick.app`(구 후보)이 아니라 **`{exam}.thepick.co.kr` + `{exam}-api.thepick.co.kr`**로 대체 — 같은 eTLD+1(`thepick.co.kr`) 하 web↔api = same-site → `'Lax'`/`'Strict'` 복원 가능.
- **루트 도메인 임시 미정** — config/vars 주입만, 하드코딩 금지(decision-card §3.4 · 플레이북 가드레일 4·15). 복원 실집행 = 서브도메인 통합 시(2호 온보딩 전후) + 진산 배포 게이트.
- `project_launch_legal_bundle_deferred` 묶음(ADR-034/035/036) 동기는 유지 — 실집행 **시점만** "Phase 3 launch 직전" → "서브도메인 통합 시"로 조기화(정책·분기 로직은 불변).

## 영향 범위

- **변경 파일**:
  - `apps/api/src/auth/routes.ts` (setAuthCookies + clearAuthCookies + authCookieSameSite 신규)
- **production redeploy 의무**: thepick-api-production wrangler deploy
- **production user 영향**: 기존 로그인 cookie는 sameSite='Strict' → 진산님 next login 시 새 cookie sameSite='None'로 갱신.
- **테스트**: vitest D1 mock environment='test' → 'Lax' (same-origin localhost). 회귀 영향 없음.

## 검증

- 진산님 production browser:
  1. 회원가입 → 자동 로그인 → /study/ 진입
  2. /api/study/next fetch → 200 + 쿠키 전송 정합
  3. 401 redirect 미발생 확인

## 출처

- 진단: 2026-05-10 Session 065 진산 발화 "로그인 → /study 잠시 표시 → 다시 로그인 화면" + apps/api routes.ts:525 `sameSite: 'Strict'` 정합 분석
- ADR-005 §Addendum (HttpOnly + Secure + SameSite=Strict) — 본 ADR-036가 일부 supersedes
- ADR-034 (테스트 비밀번호 정책 완화) + ADR-035 (PBKDF2 100k Workers 호환) — 동기 carry-over chain
- L3 영역 정합: `apps/api/src/auth/` 패턴 매칭

---

**작성**: Claude (Opus 4.7 1M context) — Session 065
**작성 효력**: 2026-05-10 KST (Phase 2 Eval MVP Step 5-C 진단 중)
**복원 deadline**: Phase 3 launch 직전 (`project_launch_legal_bundle_deferred` 동기)
