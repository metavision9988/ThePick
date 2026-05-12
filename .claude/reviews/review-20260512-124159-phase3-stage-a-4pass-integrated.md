# Phase 3 Launch Chain — Stage A 4-Pass 독립 에이전트 리뷰 통합

> **본 보고서**: docs/plans/phase3-launch-chain.plan.md §3 Stage A 종료 시점, 독립 3 에이전트 4-Pass 리뷰 통합 결과.
> **리뷰 방식**: silent-failure-hunter (Pass 1) + backend-architect (Pass 2) + security-engineer (Pass 3+4) 병렬 위임.
> **자가 리뷰 0건** (`.claude/rules/auto-review-protocol.md` 규칙 0 준수).

---

## 1. 리뷰 범위

### 변경 파일 (신규 + 변경)

| #   | 파일                                                    | 상태                                                                            |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | `packages/shared/src/constants/password-policy.ts`      | NEW                                                                             |
| 2   | `packages/shared/src/__tests__/password-policy.test.ts` | NEW (14 tests)                                                                  |
| 3   | `packages/shared/src/index.ts`                          | export 추가                                                                     |
| 4   | `apps/api/src/auth/constants.ts`                        | PASSWORD_MIN_LENGTH 삭제 + shared re-export                                     |
| 5   | `apps/api/src/auth/routes.ts`                           | AuthBindings 확장 + enforcePasswordPolicy() + HIBP env 분기 + SameSite override |
| 6   | `apps/web/src/components/AuthForm.tsx`                  | minLength={4} → PASSWORD_MIN_HINT (shared)                                      |
| 7   | `apps/api/wrangler.toml`                                | env vars (PASSWORD_MIN_LENGTH / HIBP_ENABLED) 3 환경 추가                       |
| 8   | `apps/api/src/auth/__tests__/routes.test.ts`            | 4 integration tests + INSERT INTO users FakeDb handler (Pass 1 반론 R1 흡수)    |

### 연관 파일 (검토 컨텍스트)

- `apps/api/src/auth/password.ts`
- `apps/api/src/auth/dummy-verify.ts`
- `apps/api/src/auth/hibp.ts`
- `docs/adr/ADR-034/035/036.md`

---

## 2. 카운트 요약 (중복 제거 전)

| 리뷰어                                         | CRIT  | MAJOR | MINOR |
| ---------------------------------------------- | ----- | ----- | ----- |
| Pass 1 SURGEON (silent-failure-hunter)         | 0     | 2     | 3     |
| Pass 2 ARCHITECT (backend-architect)           | 0     | 2     | 0     |
| Pass 3+4 ADVOCATE+CONTRACT (security-engineer) | 0     | 3     | 0     |
| **합계**                                       | **0** | **7** | **3** |

---

## 3. CRITICAL dedupe

**0건 종결** — Stage A 완료 가능 판정 (각 리뷰어 만장일치).

---

## 4. MAJOR dedupe — 7건 → 4 고유 매트릭스

| ID      | 제목                                                               | 출처                            | 본 chain 처리                                                                              |
| ------- | ------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------ |
| **M-α** | Zod issue shape 불완전 + Zod floor 주석 미흡                       | Pass1 M1 + Pass2 M1             | Stage A 흡수 (응답 형식은 클라이언트 미사용 - 주석은 password-policy.ts §54-63 자체 명시)  |
| **M-β** | AuthForm 클라이언트 hint dynamic 미반영 (Phase 3 toggle 시 422 UX) | Pass1 M2 + Pass2 M2 + Pass3 M-2 | Stage B 이월 (PUBLIC_PASSWORD_MIN_LENGTH Astro env 도입 or 422 issues[].minimum 동적 파싱) |
| **M-γ** | register 응답 hibpStatus 정보 노출                                 | Pass3 M-1                       | Phase 3 launch 직전 별도 (Phase 2 default 동작, 위협 모델 외 — single user)                |
| **M-δ** | plan §3 A-1 path drift (auth/ → constants/)                        | Pass4 M-3                       | Stage A 흡수 (plan §3 갱신 완료)                                                           |

### R1 Pass 1 SURGEON 반론 (★ 흡수 의무)

> "PASSWORD_MIN_LENGTH=8 env 주입 후 입력 5자 password → 422 응답 검증 testcase 부재. 누군가 routes.ts L177 `enforcePasswordPolicy` 호출을 실수로 삭제해도 14 unit test는 전부 통과. **integration test gap → 회귀 silent**."

**Stage A 흡수**: `apps/api/src/auth/__tests__/routes.test.ts` 4 integration tests 신규 추가

1. default env (Phase 2) — 4자 password 통과 (RELAXED 정책) → 201
2. PASSWORD_MIN_LENGTH="8" toggle — 5자 password reject (Phase 3 정책) → 422 + issues[0].minimum=8
3. PASSWORD_MIN_LENGTH="8" toggle — 8자 password 통과 → 201
4. PASSWORD_MIN_LENGTH 무효 입력 ("3") — RELAXED 폴백 (4자 통과) → 201

- FakeDb `INSERT INTO users` handler 신규 (test infra)

---

## 5. MINOR (3건)

| ID  | 제목                                                                    | 출처  | 처리                                                  |
| --- | ----------------------------------------------------------------------- | ----- | ----------------------------------------------------- |
| m1  | PASSWORD_MAX 1024 = min boundary 가능 (잘못 설정 시 모든 user 차단)     | Pass1 | Stage B 검토 (POLICY_MAX=64 분리 고려)                |
| m2  | AUTH_COOKIE_SAMESITE typed but runtime untyped (소문자 'lax' 무시 정합) | Pass1 | 현 상태 OK (env 입력은 dashboard 통제)                |
| m3  | password.test.ts:24 it.skip ADR-034 carry-over 정합                     | Pass1 | 현 상태 OK (Phase 3 unskip 의무 — plan §3 Stage A 외) |

---

## 6. 반론 (Devil's Advocate) 요약

| Pass      | 반론                                                               | 본 chain 대응                                                                           |
| --------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Pass 1 R1 | integration test gap (silent 회귀)                                 | **흡수 완료** — 4 testcase 추가                                                         |
| Pass 1 R2 | AuthForm UX desync — toggle 시 web 재배포 동시 의무                | **Stage 게이트 checklist 추가** — wrangler.toml:185 주석 명시                           |
| Pass 2 S1 | staging vs production 비대칭 toggle 위험                           | wrangler.toml:127 staging도 '4' default 명시. Phase 3 launch 시점 동시 toggle checklist |
| Pass 2 S2 | invalid env 입력 (e.g. '888' typo) → RELAXED silent fallback       | Stage B 검토 (logger.warn 추가 가능, 본 chain 외 - operator 신뢰 영역)                  |
| Pass 3    | hashPassword(password.ts:108) 별 경로 우회 가능 (env 분기 미적용)  | Stage B 검토 (현재는 register handler만 진입점, 별 endpoint 0건)                        |
| Pass 4    | ADR-034/036 본문 §"자동화 완료" 단락 갱신 누락 시 운영자 confusion | **chain 종료 게이트에 명시** — plan §5                                                  |

---

## 7. 최종 판정

**Stage A 완료 가능** — CRITICAL 0건, MAJOR 4 고유 매트릭스 중 2건 (M-α + M-δ + R1) 본 Stage 흡수, 2건 (M-β + M-γ) Stage B/Phase 3 launch 이월 명시.

### Stage A 합격 게이트 확인

- [x] packages/shared tests: 64 passed (14 신규 password-policy + 기존 50 유지)
- [x] apps/api typecheck PASS
- [x] apps/api lint PASS
- [x] apps/api tests: 489 PASS + 2 skip baseline 유지 + 4 신규 integration test 추가 후 16/16 routes.test PASS
- [x] apps/web typecheck PASS
- [x] apps/web lint PASS
- [x] 독립 4-Pass 리뷰 (3 에이전트 병렬) — 자가 리뷰 0건
- [x] CRITICAL 0건 확인
- [x] Pass 1 반론 R1 흡수 (integration test 4건 추가)
- [x] M-δ 흡수 (plan §3 path 갱신)

### Stage B 이월 항목

- M-β AuthForm 클라이언트 hint dynamic 반영 (UX)
- m1 PASSWORD_MAX vs POLICY_MAX 분리 검토
- Pass 2 S2 invalid env logger.warn 추가 검토

### Phase 3 launch 직전 별도 항목

- M-γ register 응답 hibpStatus 정보 노출 (위협 모델 외)
- Pass 4 반론 — ADR-034/036 §"자동화 완료" 본문 갱신 (chain 종착 시)

---

## 8. 산출물 영속 영역

- 본 보고서: `.claude/reviews/review-20260512-124159-phase3-stage-a-4pass-integrated.md`
- plan 갱신: `docs/plans/phase3-launch-chain.plan.md` §3 A-1 path 정합
- 다음 핸드오프: `.jjokjipge/handoff-session-077.md` (작성 예정)
- Stage A 종착 commit: 본 보고서 commit 직후

---

**작성**: Claude (Opus 4.7 1M context) — Session 068, Stage A 종료 시점
**일자**: 2026-05-12 KST
**리뷰 방식**: 독립 3 에이전트 병렬 위임 (silent-failure-hunter / backend-architect / security-engineer)
**자가 리뷰**: 0건 (CRITICAL RULE 정합)
