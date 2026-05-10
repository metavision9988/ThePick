# ADR-034 — 평가 환경 비밀번호 정책 임시 완화 + Phase 3 복원 의무

## 상태

Accepted (Session 065, 2026-05-10) — 임시 정책. **Phase 3 launch 직전 복원 의무**.

## 컨텍스트

Phase 2 Eval MVP Step 5-C 진산님 G9 production browser 학습 시도 진입 중 회원가입 차단:

- AuthForm.tsx /api/auth/register POST → **422 (Unprocessable Content)** + **500 (Internal Server Error)** 가시
- 422 원인: Zod schema `password: z.string().min(8)` violation + HIBP `checkPwned` 응답 'pwned' (4자리 숫자 매우 흔함)
- 500 원인 후보: PBKDF2 600,000 iterations CPU 50ms 한도 초과 / HIBP API timeout / 기타 (정확 진단 carry-over)

진산님 명시 발화 (Session 065):

> "테스트 중이라 비밀번호는 4자리 숫자도 가능하게 우선 간편하게 바꿔줘"

memory `feedback_full_autonomy.md` "결정 영역 boundary" 정합 — **인증 정책은 진산 결정 영역**. 진산 명시 = 정책 변경 권한 위임.

## 결정

평가 환경(MVP) 한정 임시 정책:

1. `PASSWORD_MIN_LENGTH`: 8 → **4**
2. HIBP `checkPwned` 응답 'pwned' 분기 **비활성화** (호출은 logging 보존, 결과 무시)
3. `PASSWORD_MAX_LENGTH` 1024 (불변, DoS 방어)
4. `PBKDF2_ITERATIONS` 600,000 (불변, ADR-005 OWASP 정합)

## 근거

- 본 변경은 **평가 환경 = 진산님 단독 사용자**. 외부 노출 0 + 보안 위협 사실상 없음.
- 진산님 평가 신호 4 type (plan §4 Q2) 식별이 본 phase 핵심. 회원가입 차단으로 G9 차단 = 평가 가치 0.
- ADR-005 PBKDF2-SHA256 600,000 iterations + ADR-008 HIBP k-Anonymity 정책은 production 본격 환경 (Phase 3 launch 후) 정합.

## Phase 3 launch 직전 **복원 의무** (★ 명시 carry-over)

Phase 3 launch 1주 전 또는 외부 사용자 등록 진입점 노출 시점에 다음 모두 복원:

- [ ] `apps/api/src/auth/constants.ts:30` `PASSWORD_MIN_LENGTH = 8` 복원
- [ ] `apps/api/src/auth/routes.ts:140-146` HIBP 'pwned' 422 분기 활성화
- [ ] `apps/api/src/auth/__tests__/routes.test.ts` PASSWORD_PWNED 422 회귀 테스트 활성화
- [ ] register/login 실패 시 RATE_LIMITED 429 응답 정책 검증 (현행 패턴 유지)
- [ ] memory `project_launch_legal_bundle_deferred.md` carry-over chain에 본 ADR-034 reference 추가
- [ ] 기존 평가 환경 user 4자리 password 일괄 reset 정책 결정 (forced password reset 또는 grandfather clause)

## 영향 범위

- **변경 파일**:
  - `apps/api/src/auth/constants.ts` (PASSWORD_MIN_LENGTH 4)
  - `apps/api/src/auth/routes.ts:140-146` (HIBP 'pwned' 분기 disable, logging 보존)
- **테스트**: 일부 회귀 테스트 (PASSWORD_PWNED 422 검증)는 임시 비활성화 또는 skip. Phase 3 복원 시 unskip 의무.
- **production redeploy**: thepick-api-production wrangler deploy 의무 (Version 갱신).
- **migration**: 기존 user 데이터 영향 없음 (password_hash 재생성 불요).

## 보안 위험 영속 (Phase 3 복원 전 인지 의무)

본 결정 기간 동안:

- 평가 환경 user의 비밀번호가 4자리 숫자 등 매우 약한 password일 수 있음
- enumeration / brute-force 공격 발생 시 60초 내 모든 user 탈취 가능 (4자리 = 10,000 조합)
- 다행히 본 환경은 **진산 단독 사용** + production traffic 0 + 외부 노출점 사실상 0

**Phase 3 launch 직전 본 ADR을 다시 읽고 복원 체크리스트 6항목 모두 PASS 후 launch 의무**.

## 출처

- 진산 발화: Session 065 (2026-05-10)
- memory `feedback_full_autonomy.md` "결정 영역 boundary" — 인증 정책 진산 결정 영역
- memory `project_launch_legal_bundle_deferred.md` — Phase 3 launch 직전 1주 스프린트 일괄 처리 패턴
- 기존 정책: ADR-005 PBKDF2-SHA256 + ADR-008 HIBP k-Anonymity
- L3 영역 정합: CLAUDE.md `## L3 영역` `**constants*` 패턴 매칭

---

**작성**: Claude (Opus 4.7 1M context) — Session 065
**작성 효력**: 2026-05-10 KST (Phase 2 Eval MVP Step 5-C 진입 중)
**복원 deadline**: Phase 3 launch 직전 1주 (`project_launch_legal_bundle_deferred` 동기 복원)
