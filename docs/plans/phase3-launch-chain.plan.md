---
phase: 3
step: launch-chain
approved_by: TBD (진산님 "고고" 대기)
session: 068 (착수)
scope:
  - packages/shared/src/constants/password-policy.ts (NEW, Stage A 종착 시 actual path)
  - apps/api/src/auth/constants.ts
  - apps/api/src/auth/routes.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/api/src/db/schema.ts
  - apps/web/src/components/AuthForm.tsx
  - apps/api/wrangler.toml
  - migrations/0030_login_history.sql (NEW)
  - scripts/verify-engine-contracts.ts
  - docs/adr/ADR-034 / ADR-035 / ADR-036 §"복원 의무" reference 갱신
risk_level: L3
estimated_hours: 13-21 (5 CRIT 합계)
---

# Phase 3 Launch Chain — 5 CRIT 흡수 plan

> **본 plan은 14 CRIT 매트릭스 잔여 5건 (C-03/04/05/09/12)을 일관된 chain으로 흡수한다.**
> ADR-034/035/036 §"복원 의무" 자체는 본 chain에 **포함 안 함** — Phase 3 launch 직전 별도 stage (env 분기 토글로 자동화).
> 법무 3종 / 회원탈퇴 / 이메일 인증 / custom domain / UX 본격 = `project_launch_legal_bundle_deferred.md` chain — **본 plan과 분리**.

---

## 1. 목적 (Why)

Phase 2 Eval MVP 완전 종착 (14 CRIT 매트릭스 즉시 흡수 7/7 종결) 시점, Phase 3 launch 1주 전 한꺼번에 처리해야 하는 5 CRIT을 **L3 영역 plan + 진산 승인 → 단계별 chain 흡수**.

**Devil's Advocate 통합 시나리오** (review-20260511-111048 §5):

- Phase 3 launch 30분 후 외부 user 1번째 등록
- PASSWORD_MIN 8 복원 누락 → 4자리 password 통과 (C-05 부재 시)
- PBKDF2 100k 복원 누락 (C-03 env 분기 부재 시) → brute-force 0.025초/account
- register rate-limit 부재 (C-04) → 다중 IP 풀 무한 시도
- 6-24시간 내 첫 account 탈취 → audit trail 단절 (C-12) → forensics 불가능

**예방 비용**: 본 chain 13-21h vs **incident 비용**: launch 연기 + PIPA 신고 + 신뢰 손실 = 무한대.

---

## 2. 대상 파일 + 변경 요약

| #   | 파일                                                     | 변경                                                                                                       | CRIT               |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | `packages/shared/src/constants/password-policy.ts` (NEW) | PASSWORD_MIN/MAX 단일 source-of-truth + env 분기 helper                                                    | C-05 / C-03        |
| 2   | `apps/api/src/auth/constants.ts`                         | PASSWORD_MIN_LENGTH 삭제 (shared로 이관) + PBKDF2_ITERATIONS env-based getter                              | C-05 / C-03        |
| 3   | `apps/api/src/auth/routes.ts`                            | (a) registerSchema에 shared 적용 / (b) HIBP 분기 env-based / (c) register에 checkAuthRateLimitByEmail 추가 | C-05 / C-03 / C-04 |
| 4   | `apps/web/src/components/AuthForm.tsx`                   | minLength={4} 삭제 → shared import                                                                         | C-05               |
| 5   | `apps/api/src/auth/rate-limit.ts`                        | register용 email rate-limit 확장 (필요 시)                                                                 | C-04               |
| 6   | `apps/api/wrangler.toml`                                 | env vars 추가 (`PASSWORD_MIN_LENGTH`, `PBKDF2_ITERATIONS`, `HIBP_ENABLED`, `AUTH_COOKIE_SAMESITE`)         | C-03               |
| 7   | `migrations/0030_login_history.sql` (NEW)                | login_history 테이블 신규 (id, user_id, login_at, ip, user_agent)                                          | C-12               |
| 8   | `apps/api/src/db/schema.ts`                              | loginHistory 테이블 + lastLoginAt UPDATE 폐기                                                              | C-12               |
| 9   | `apps/api/src/auth/routes.ts:303-308`                    | UPDATE users SET last_login_at → INSERT INTO login_history                                                 | C-12               |
| 10  | `scripts/verify-engine-contracts.ts`                     | checkP0NoSkippedTests 확장 → skip 카운트 자동 알람                                                         | C-09               |

---

## 3. 구현 순서 (3 stage chain)

### Stage A — Foundation (1-2일, C-05 + C-03 일부)

**A-1. C-05: packages/shared/constants/password-policy.ts 신설** (1h)

- `PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_LENGTH` 단일 export
- Phase 2 임시 정책 (4) + Phase 3 정책 (8) 모두 정의
- env 분기 getter: `getPasswordMinLength(env)` — `env.PASSWORD_MIN_LENGTH ?? 4`
- 출처: ADR-034 §"복원 의무" §"4자리 password 통과 위험"

**A-2. C-03: api constants.ts + routes.ts env 분기 적용** (2-3h)

- PASSWORD_MIN_LENGTH → `getPasswordMinLength(c.env)` 호출
- PBKDF2_ITERATIONS → env-based getter (100k 임시 / 600k 본격)
- HIBP enable 토글 → `env.HIBP_ENABLED === 'true'` 분기
- SameSite=None/Strict env 분기 (`env.AUTH_COOKIE_SAMESITE`)
- 출처: ADR-034/035/036 §"복원 의무" 자동화

**A-3. C-05: apps/web AuthForm.tsx + i18n 정합** (0.5h)

- `minLength={4}` → `PASSWORD_MIN_LENGTH` shared import
- i18n minLength placeholder 정합

**A-4. apps/api/wrangler.toml env vars 추가** (0.5h)

- production: `PASSWORD_MIN_LENGTH=4`, `PBKDF2_ITERATIONS=100000`, `HIBP_ENABLED=false`, `AUTH_COOKIE_SAMESITE=None`
- (Phase 3 launch 직전 production env 값만 갱신 → 코드 변경 0)

### Stage B — Defensive (1일, C-04 + C-09)

**B-1. C-04: register endpoint per-email rate-limit** (2-3h)

- `apps/api/src/auth/routes.ts:120-130` register 핸들러에 `checkAuthRateLimitByEmail(c.env.AUTH_RATE_LIMITER_EMAIL, normalizedEmail, ...)` 추가
- 기존 EMAIL binding 재사용 (login 5 실패/600s) — register 동일 정책
- ADR-034 §"복원 의무" 6항목에 본 항목 추가 (★ 자동화 위해)

**B-2. C-09: verify-engine-contracts skip 자동 알람** (2-4h)

- `scripts/verify-engine-contracts.ts`에 `checkP0NoSkippedTests` 함수 확장
- `it.skip` / `describe.skip` / `test.skip` 카운트
- ADR-034 carry-over 주석 매칭 (`ADR-034 carry-over` 패턴)
- 임계값: skip > 2건 → FAIL
- 보고서에 skip 목록 + 파일:라인 영속

### Stage C — Audit (1일, C-12)

**C-1. migration 0030 신규** (2h)

- `migrations/0030_login_history.sql`:
  - `login_history` 테이블 (id PK, user_id FK, login_at TEXT, ip TEXT NULL, user_agent TEXT NULL)
  - `idx_login_history_user_at` (user_id, login_at DESC)
  - `users.last_login_at` 컬럼은 일단 유지 (backward-compat, 다음 마이그레이션에서 폐기)

**C-2. apps/api/src/db/schema.ts** (1h)

- `loginHistory` 테이블 정의 추가
- `users.lastLoginAt` 컬럼 deprecated 주석

**C-3. apps/api/src/auth/routes.ts:300-310** (1h)

- 기존 `UPDATE users SET last_login_at = ?` 삭제
- 신규 `INSERT INTO login_history (id, user_id, login_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)`
- 실패 시 graceful (login 자체는 성공)

**C-4. apps/api/src/auth/**tests**/routes.test.ts 갱신** (1h)

- 116번 라인 mock SQL 패턴 update (`UPDATE users SET last_login_at` → `INSERT INTO login_history`)
- 신규 test case: login 성공 시 login_history row 1건 insert 검증

---

## 4. 위험 분석

| 위험                                                            | 영향                              | 완화                                                                                       |
| --------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| C-03 env 분기 누락 시 production launch 30분 위험               | brute-force 0.025초/account       | wrangler.toml production env 값을 코드 commit과 동시 변경 + smoke test로 검증              |
| C-05 shared 이관 시 web build 영향                              | apps/web build 실패               | typecheck CI gate + shared 의존 추가 검증                                                  |
| C-04 register email rate-limit 도입 시 신규 가입 차단 가능      | 정상 user 5 실패/10분 일시 차단   | login 정책과 동일 (사용자 경험 정합) + Retry-After 헤더                                    |
| C-12 login_history 신규 + 기존 last_login_at 폐기 시점 mismatch | 기존 코드 last_login_at 참조 깨짐 | C-12에서 last_login_at 컬럼은 유지 (다음 마이그레이션에서 폐기), routes.ts만 INSERT로 변경 |
| C-09 skip 자동 알람 추가 시 기존 verify FAIL 전환               | CI 차단 위험                      | 본 chain에서 ADR-034 skip 2건 모두 해소되도록 순서 보장 (Stage A 이후 Stage B로)           |
| TD-VRF-001 비결정성 baseline                                    | verify 1회 FAIL 가능              | 2회 PASS 정합 확인 + C-10 별도 task                                                        |

---

## 5. 검증 계획 (단계별 게이트)

### Stage A 완료 게이트

- [ ] `pnpm typecheck` 통과 (api + web + shared 전수)
- [ ] `pnpm lint` 통과
- [ ] `pnpm test` 통과 (api 489 PASS + 2 skip 유지, web/shared 회귀 없음)
- [ ] env 분기 동작 검증: PASSWORD_MIN_LENGTH=8 env 주입 시 5자 password reject 정합
- [ ] dummy-verify v2 hash 정합 (100k bytes 유지)

### Stage B 완료 게이트

- [ ] register endpoint email rate-limit 회귀 테스트 신규 (5 실패/600s → 429)
- [ ] verify-engine-contracts skip 카운트 알람 동작 (현 2건 PASS / 3건 FAIL 임계값)
- [ ] 4-Pass 독립 에이전트 리뷰 (rate-limit 정책 변경 = 인증 영역 L3)

### Stage C 완료 게이트

- [ ] migration 0030 staging 적용 (1회) → production dry-run
- [ ] login_history INSERT 정합 (login 1회 → 1 row insert)
- [ ] last_login_at UPDATE 폐기 정합 (routes.ts:303 변경 후)
- [ ] schema.ts loginHistory 타입 정합
- [ ] 4-Pass 독립 에이전트 리뷰 (DB 스키마 변경 = L3)

### chain 종료 게이트

- [ ] entry verify 2회 PASS 7/0/1
- [ ] 5-페르소나 기술부채 심층 리뷰 (refactoring / performance / quality / backend / devops)
- [ ] ADR-034/035/036 §"복원 의무" 본문 갱신 (env 분기 자동화 반영)
- [ ] memory `project_launch_legal_bundle_deferred.md` carry-over 갱신
- [ ] **migration 0030 production 적용 선행 의무** (코드 deploy 전 D1 마이그레이션 — 미적용 시 INSERT graceful catch로 audit 0건 누적, Stage C 4-Pass MINOR-3 흡수)
- [ ] production redeploy + smoke test (Workers Version 갱신 + production-migration-status.md 영속)
- [ ] handoff-077 영속

---

## 6. 롤백 전략

### 6.1 Stage 단위 롤백 방법

| Stage | 롤백 방법                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| A     | constants.ts revert + shared package 미사용 — 기존 PASSWORD_MIN_LENGTH=4 유지 (Phase 2 임시 정책 그대로)                       |
| B     | rate-limit 추가 코드 주석 처리 — IP 기반 rate-limit만 활성 (현 상태 회귀)                                                      |
| C     | migration 0030 rollback (DROP TABLE login*history; DELETE FROM d1_migrations WHERE name='0030*\*') + routes.ts:303 UPDATE 복원 |

★ 각 Stage는 **독립 commit + push** — production 영향 없는 변경부터 점진 적용. Stage A/B는 prod env vars 갱신 전까지는 코드 변경만으로 prod 영향 0.

### 6.2 부분 rollback 안전 매트릭스 (★ Stage D CRIT-P5-2 흡수)

새벽 3시 on-call 시점에 즉흥 판단 차단 — 본 매트릭스를 따라 결정.

| Rollback 조합           | 잔존 stage     | 위험 평가                                                                                    | 권고                                                                                        |
| ----------------------- | -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **C only**              | A + B 유지     | 안전 — login_history 단절만, 인증 정책 유지                                                  | ★ login_history 장애 시 채택                                                                |
| **B only**              | A + C 유지     | ★ **위험** — register rate-limit 제거 → multi-IP brute-force 노출. C는 audit 누적 (장점)     | ❌ 비권장 (rate-limit 별도 fix 우선)                                                        |
| **A only**              | B + C 유지     | 안전 — env 분기 → 정적 정책 회귀. 단 Phase 3 toggle 의도 무효화                              | env 분기 자체 장애 시 채택                                                                  |
| **B + C**               | A 유지         | ★ **위험** — brute-force 노출 + audit 단절 동시                                              | ❌ 비권장                                                                                   |
| **A + C**               | B 유지         | 안전 — register rate-limit 유지 + 환경 분기 제거 + audit 단절                                | Phase 3 전체 chain 부분 되돌릴 때                                                           |
| **A + B + C** (전체)    | 없음           | ★★ **고위험** — Phase 2 베이스라인 회귀: password 4자 + HIBP 미체크 + rate-limit 0 + audit 0 | ❌ 인증 도메인 전체 장애만 (sessions/JWT 영향). 운영팀 단독 결정 금지 — 진산 명시 승인 필수 |
| **Stage D 자체 revert** | A + B + C 유지 | 안전 — schema drift 감지 + rollback matrix 제거. 본 chain 정상 동작                          | Stage D 신규 logger.error 노이즈 시                                                         |

### 6.3 Migration 0030 rollback DDL (Stage D MAJ-12 흡수 일부)

```sql
-- 본 SQL은 production 적용 전 staging에서 dry-run 의무.
-- 0030 적용 후 1주 이내 rollback 시점에만 실행 권장 (data loss 1주 분).
PRAGMA foreign_keys = ON;
DROP TABLE IF EXISTS login_history;
DELETE FROM d1_migrations WHERE name = '0030_login_history.sql';
```

★ Migration rollback 이후 코드 deploy 시 routes.ts login_history INSERT 호출이 schema drift 분기로 진입 — Stage D logger.error remediation 메시지로 운영자 알림.

---

## 7. 본 chain에서 명시적으로 **제외** 항목

- ADR-034 §"복원 의무" 6항목 실행 (PASSWORD_MIN 8 / HIBP enable / skip 해제 / 기존 user reset 등) — **env 토글만 본 chain, 실제 복원은 Phase 3 launch 직전 별도**
- ADR-035 §"검토 의무" Argon2id WASM 검토 — Phase 3 launch 직전 별도 stage
- ADR-036 §"복원 의무" custom domain + SameSite=Strict 복원 — `project_custom_domain_thepick_app_collision.md` chain 동기 (별도 결정)
- 법무 3종 + 회원탈퇴 + 이메일 인증 + 14세 미만 차단 + Cookie 배너 — `project_launch_legal_bundle_deferred.md` chain (별도 1주 스프린트)
- UX 본격 (객관식 라디오 / 보기 랜덤 / 학습 모드 다양화) — `project_ux_north_star_phase3.md` chain (별도 plan)
- C-10 TD-VRF-001 비결정성 정체 동정 — 별도 task (100회 누적 baseline)
- C-11 0028 trigger Year 2 zero-cost — Year 2 Phase 4 carry-over

---

## 8. 승인 기록

- 본 plan 작성: Claude (Opus 4.7 1M context), Session 068
- 진산님 승인: **대기**
- 4-Pass 독립 리뷰: Stage A + B + C 각 단계 종료 후 의무
- 5-페르소나 심층 리뷰: chain 종료 시점 의무

---

## 9. 출처 (참조 문서)

- `.claude/reviews/review-20260511-111048-phase2-eval-mvp-session-065-final-integrated.md` (14 CRIT 매트릭스)
- `.jjokjipge/handoff-session-076.md` (Session 067 종착)
- `docs/adr/ADR-034-test-password-policy-relaxation.md` §"복원 의무"
- `docs/adr/ADR-035-pbkdf2-iterations-workers-compat.md` §"검토 의무"
- `docs/adr/ADR-036-auth-cookie-samesite-cross-origin.md` §"복원 의무"
- memory `project_launch_legal_bundle_deferred.md` (Phase 3 묶음 별도)
- memory `project_ux_north_star_phase3.md` (UX 본격 별도)

---

**작성**: Claude (Opus 4.7 1M context) — Session 068 entry
**작성 효력**: 2026-05-12 KST (Phase 2 Eval MVP 즉시 흡수 7/7 종결 후 진입 plan)
**예상 종착 세션**: Session 068~071 (3-4세션 chain)
