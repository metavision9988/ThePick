# Phase 3 Launch Chain — Stage B 4-Pass 독립 에이전트 리뷰 통합

> **본 보고서**: docs/plans/phase3-launch-chain.plan.md §3 Stage B 종료 시점, 독립 2 에이전트 4-Pass 리뷰 통합 결과.
> **리뷰 방식**: silent-failure-hunter (Pass 1+2) + security-engineer (Pass 3+4) 병렬 위임.
> **자가 리뷰 0건** (`.claude/rules/auto-review-protocol.md` 규칙 0 준수).

---

## 1. 리뷰 범위

### 변경 파일

| #   | 파일                                                  | 변경                                                        |
| --- | ----------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `apps/api/src/auth/rate-limit.ts`                     | `checkRegisterEmailRateLimit` 신규 (key prefix `register:`) |
| 2   | `apps/api/src/auth/routes.ts`                         | register handler에 `checkRegisterEmailRateLimit` 호출       |
| 3   | `apps/api/src/auth/__tests__/routes.test.ts`          | 2 신규 integration test (denyAll mock)                      |
| 4   | `scripts/verify-engine-contracts.ts`                  | `checkAdr034CarryOverSkips()` Cat 7 통합                    |
| 5   | `docs/adr/ADR-034-test-password-policy-relaxation.md` | §"복원 의무" Stage B 항목 추가                              |

---

## 2. 카운트 요약 (중복 제거 전)

| 리뷰어                                             | CRIT  | MAJOR | MINOR |
| -------------------------------------------------- | ----- | ----- | ----- |
| Pass 1+2 SURGEON+ARCHITECT (silent-failure-hunter) | 0     | 2     | 3     |
| Pass 3+4 ADVOCATE+CONTRACT (security-engineer)     | 0     | 0     | 1     |
| **합계**                                           | **0** | **2** | **4** |

---

## 3. CRITICAL dedupe

**0건 종결** — Stage B 완료 가능 판정 (만장일치).

---

## 4. MAJOR dedupe — 2건 중 1건 즉시 흡수

| ID        | 제목                                                                                      | 출처              | 본 chain 처리                                                                           |
| --------- | ----------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| **★ M-1** | register + login 동일 EMAIL binding 공유 → register 5회로 victim login 600초 lockout 가능 | Pass 1+2 MAJOR-A1 | **★ 즉시 흡수** — `checkRegisterEmailRateLimit` 함수 신규 + key prefix `register:` 분리 |
| M-2       | Windows 경로 파싱 위험 (status `path:lineno:content` 가정)                                | Pass 1+2 MAJOR-S1 | 현 Linux/WSL 환경 영향 0, Stage C 또는 CI 이식 시 처리                                  |

### ★ M-1 흡수 상세 (Stage B 4-Pass 신규 발견)

**위협 시나리오**: 공격자가 victim의 email로 register endpoint를 5회 시도 (이미 가입된 email이면 409, 새 email이면 201). counter 소진 후 victim의 **legitimate login**이 동일 `email:${addr}` key로 차단됨 → 600초 lockout.

**해결**: register와 login의 rate-limit counter를 분리.

- `checkEmailRateLimit` (기존, login 전용): key `email:${email}`
- `checkRegisterEmailRateLimit` (신규, register 전용): key `register:${email}`
- 동일 `AUTH_RATE_LIMITER_EMAIL` binding 사용 (정책 5/600s 공유), counter는 독립

**커밋 영향**:

- `apps/api/src/auth/rate-limit.ts:104-122` 함수 신규
- `apps/api/src/auth/routes.ts:183-186` register handler 호출 변경
- routes.test.ts 2 신규 testcase 통과 (변경 후에도 동일)

---

## 5. MINOR (4건)

| ID  | 제목                                                               | 출처             | 처리                                                                             |
| --- | ------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------- |
| m1  | TOO_MANY_REQUESTS 응답에 "10분 후" 안내 메시지 권고 (UX)           | Pass3            | Phase 3 launch 직전 AuthForm 통합 시 처리 (ADR-034 §"복원 의무" M-β chain)       |
| m2  | normalizedEmail = email.trim().toLowerCase() 중복 (register/login) | Pass1            | Stage C 또는 별도 부채 정리                                                      |
| m3  | ADR_034_SKIP_BASELINE=2 magic number 주석 부재                     | Pass1+2 MINOR-A2 | **★ 즉시 흡수** — verify-engine-contracts.ts:1109-1112 현 skip 위치 핀 주석 추가 |
| m4  | evidence 출력 길이 캡 부재 (skip 라인 매우 길 경우 JSON 가독성)    | Pass1            | cosmetic — 본 chain 외                                                           |

---

## 6. 반론 (Devil's Advocate) 요약

| Pass                | 반론                                               | 본 chain 대응                                               |
| ------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Pass 1+2 (MAJOR-A1) | register-based login lockout attack vector         | **★ 즉시 흡수 완료** — key prefix 분리                      |
| Pass 1+2 (MAJOR-S1) | Windows 경로 파싱 회귀 위험                        | 현 환경 영향 0, CI 이식 시점 별도 처리                      |
| Pass 3              | victim 자기 typo 4회 후 신규 가입 시도 시 차단     | UX 메시지 개선 권고 (m1 → Phase 3 launch carry-over)        |
| Pass 4              | register 의미론 명세 plan 누락 (Silent Pivot 경계) | plan 범위 내 — register/login 구분이 이제 명확 (key prefix) |

---

## 7. 최종 판정

**Stage B 완료 가능** — CRITICAL 0건, MAJOR 2건 중 1건(★ M-1 register login lockout)은 **즉시 흡수 완료**. 잔여 1건(M-2 Windows 경로)은 환경 의존 — 현 영향 0.

### Stage B 합격 게이트 확인

- [x] apps/api typecheck PASS
- [x] apps/api lint PASS
- [x] apps/api tests: 495 PASS / 2 skip (Stage A baseline 493 → +2 신규 C-04 integration test)
- [x] verify-engine-contracts: 7 PASS / 0 FAIL / 1 SKIP
  - Cat 7 보안 booleans 4 → 5 (+1 신규 ADR-034 carry-over skip 알람)
  - 현 skip 2건 BASELINE 정합 + 태그 정합 → PASS
- [x] 독립 4-Pass 리뷰 (2 에이전트 병렬) — 자가 리뷰 0건
- [x] CRITICAL 0건 확인
- [x] MAJOR M-1 (register login lockout) 흡수 — key prefix 분리
- [x] MINOR m3 (BASELINE 주석) 흡수
- [x] ADR-034 §"복원 의무" 본문 갱신 (Stage A 자동화 + Stage B C-04/C-09 항목 추가)

### Stage C 이월 항목

- Pass 1+2 MAJOR-S1 Windows 경로 회귀 (현 영향 0)
- Pass 1+2 MINOR-S2/S3 cosmetic
- Pass 3 MINOR-m1 (UX 메시지) — Phase 3 launch carry-over (AuthForm 통합)

### Phase 3 launch 직전 별도

- ADR-034 §"복원 의무" 8항목 모두 PASS 후 launch
- AuthForm.tsx 클라이언트 dynamic minLength 반영 (Stage A M-β)
- C-09 skip 0건 도달 + BASELINE 0 갱신 또는 본 check archive

---

## 8. 산출물 영속 영역

- 본 보고서: `.claude/reviews/review-20260512-125401-phase3-stage-b-4pass-integrated.md`
- ADR-034 §"복원 의무" Stage B 흡수 항목 영속
- 다음 핸드오프: `.jjokjipge/handoff-session-077.md` (Stage A+B 합산)
- Stage B 종착 commit: 본 보고서 commit 직후

---

**작성**: Claude (Opus 4.7 1M context) — Session 068, Stage B 종료 시점
**일자**: 2026-05-12 KST
**리뷰 방식**: 독립 2 에이전트 병렬 위임 (silent-failure-hunter / security-engineer)
**자가 리뷰**: 0건 (CRITICAL RULE 정합)
**MAJOR 신규 발견**: register login lockout attack vector (★ 4-Pass 통합 의의)
