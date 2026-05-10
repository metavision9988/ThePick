# ADR-036 — 인증 쿠키 SameSite 환경별 분기 (cross-origin pages.dev ↔ workers.dev)

## 상태

Accepted (Session 065, 2026-05-10) — ADR-005 §Addendum 일부 supersedes.
**Phase 3 launch 직전 custom domain 통합 + SameSite=Strict 복원 의무**.

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
