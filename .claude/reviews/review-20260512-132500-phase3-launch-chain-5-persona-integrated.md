# Phase 3 Launch Chain — Phase 단위 5-페르소나 기술부채 심층 리뷰 통합

> **본 보고서**: Phase 3 launch chain (Stage A+B+C, 3 commit) 종착 후 **Phase 단위** 5-페르소나 심층 리뷰 통합.
> **트리거**: `.claude/rules/auto-review-protocol.md` §"Phase 단위 5-페르소나 기술부채 리뷰" 의무.
> **자가 리뷰 0건**, 직전 4-Pass 결과 (Stage A/B/C 각 통합 보고서)와 **중복 지적 0건**.
> **5 에이전트 단일 메시지 병렬 호출**: refactoring-expert / performance-engineer / quality-engineer / backend-architect / devops-architect.

---

## 1. 카운트 요약

| 페르소나                               | Critical | Major  | Minor  |
| -------------------------------------- | -------- | ------ | ------ |
| P1 refactoring-expert (코드 품질 부채) | 0        | 4      | 5      |
| P2 performance-engineer (런타임 부채)  | 0        | 2      | 4      |
| P3 quality-engineer (테스트 부채)      | 0        | 4      | 5      |
| P4 backend-architect (데이터·API 부채) | 0        | 3      | 4      |
| **P5 devops-architect (운영 부채)**    | **★ 2**  | **4**  | **3**  |
| **합계**                               | **2**    | **17** | **21** |

★ **P5 CRITICAL 2건 신규 발견** — 본 chain commit은 통과 가능하나 **production deploy 전 흡수 의무**.

---

## 2. ★ CRITICAL dedupe — P5 신규 2건

### ★★★ CRIT-P5-1: Migration drift 자동 감지 부재 → silent audit hole

**시나리오**:

- 코드 deploy (Stage C 변경 포함) 먼저 + migration 0030 apply 안 함 → `login_history` 테이블 부재
- login handler `INSERT INTO login_history` → throw → **graceful catch + logger.warn** → API 200 응답 + audit 0건 누적
- 사용자/공격자/QA 모두 정상으로 인식 → **새벽 3시 forensics 요청 시 발견** (지난 72시간 audit 0건)

**현 방어선 불충분**:

- plan §5 chain 종료 게이트에 "migration 0030 apply 선행" 명시 (Stage C M-3 흡수) ✓
- 그러나 인간 mistake 차단 부재 — 자동 schema version assertion 없음

**권고**:

- Workers boot 시 `SELECT name FROM sqlite_master WHERE name='login_history' LIMIT 1` 1회 캐싱
- 부재 시 Cloudflare Logpush → R2 critical 로깅 (Sentry-equivalent)
- 또는 deploy CI에 migration version check step 추가

### ★★★ CRIT-P5-2: 부분 rollback decision matrix 부재

**시나리오**:

- Stage C login_history 장애 발견 → Stage C만 revert → Stage A/B production 잔존
- 또는 운영팀이 Stage A+B+C 전체 revert → password 8자 + HIBP 미체크 + 등록 throttle 0 = **사고 대응이 2차 사고 유발**

**현 방어선 불충분**:

- atomic commit (Stage 단위) → atomic rollback 가능
- 그러나 **혼합 rollback 안전 매트릭스** plan §6에 부재 → 즉흥 판단 위험

**권고**:

- plan §6에 rollback 조합 안전 매트릭스 추가
- Stage A revert: env-based 정책 → 정적 정책 회귀 (안전)
- Stage B revert: rate-limit 제거 → brute-force 노출 (★ 위험)
- Stage C revert: audit 단절 → forensics 부재 (★ 위험)
- 부분 rollback 조합 의사결정 chart

---

## 3. MAJOR dedupe — 17건 → 11 고유 매트릭스

| ID         | 페르소나     | 제목                                                                                                                                                   | 처리                                                     |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| **MAJ-1**  | P1 / P3      | FakeDb mock 부채 + silent drift leading indicator (login_history INSERT 실패 mock에서 bind chain 수정 발생) → `createD1FromSqlite` 전환 권고           | Phase 3 launch 직후 carry-over (4-8h)                    |
| **MAJ-2**  | P1 / P4      | `checkEmailRateLimit` vs `checkRegisterEmailRateLimit` 함수 거의 동일 + rate-limit policy SSOT 부재 → `checkEmailRateLimit(action enum)` 시그니처 통합 | Phase 3 launch 후 (1-2h)                                 |
| **MAJ-3**  | P1           | `getPasswordMinLength` vs `isHibpEnabled` 시그니처 비일관 → `resolveAuthPolicy(env): AuthPolicy` 단일 객체 반환                                        | Phase 3 launch 후                                        |
| **MAJ-4**  | P1           | `email.trim().toLowerCase()` + dummy verify try-catch 중복 → shared/auth/email-normalizer                                                              | Phase 3 launch 후                                        |
| **MAJ-5**  | P2           | login hot path hashIp **중복 호출** (routes.ts:370 + 409) → 변수 재사용 (★ 5분 작업)                                                                   | Stage D 또는 Session 069 즉시 흡수                       |
| **MAJ-6**  | P2 / P4 / P5 | login_history TTL/archival 정책 부재 → 1년 후 ~2.2GB, 5년 후 한도 초과. Cron archival 의무                                                             | Phase 3 launch 직전 별도 stage                           |
| **MAJ-7**  | P3           | HIBP env=true 422 분기 통합 테스트 0건 (브랜치 커버리지 0%)                                                                                            | Phase 3 HIBP_ENABLED=true toggle **이전 즉시 흡수 의무** |
| **MAJ-8**  | P3           | SameSite='Strict' override 브랜치 미커버 (~67% 커버리지)                                                                                               | Phase 3 launch 직전                                      |
| **MAJ-9**  | P3           | login_history 동시성/누적 카운트 0건 + admin 조회 API 부재 → forensics 무용 위험                                                                       | Phase 3 launch 후                                        |
| **MAJ-10** | P4           | users.lastLoginAt 폐기 마이그레이션 0031 carry-over (deprecated 컬럼 잔존)                                                                             | Phase 3 launch 후                                        |
| **MAJ-11** | P4 / P5      | login_history INSERT 실패 silent audit hole → `auth_audit_drop` engine_telemetry 게이지                                                                | Phase 3 launch 직전                                      |
| MAJ-12     | P5           | Migration 0030 rollback DDL 부재 → `DROP TABLE` 절차 명시                                                                                              | plan §6 갱신                                             |
| MAJ-13     | P5           | Cloudflare wrangler 토큰 SPOF + 만료 알람 부재                                                                                                         | carry-over (별도 ADR)                                    |
| MAJ-14     | P5           | Production smoke test 체크리스트 부재 → runbook ADR                                                                                                    | Phase 3 launch 직전                                      |
| MAJ-15     | P5           | Env vars drift 자동 감지 부재 (production ↔ staging 비대칭)                                                                                            | CI gate 추가 carry-over                                  |

---

## 4. MINOR (21건 dedupe → 핵심 8건)

- **MIN-1** (P1/P4): users.lastLoginAt 폐기 마이그레이션 0031 carry-over
- **MIN-2** (P1): `ADR_034_SKIP_BASELINE = 2` 매직 상수 → 외부 정책 파일
- **MIN-3** (P2/P5): `waitUntil()`로 login_history INSERT 비동기 분리 (p99 latency 개선)
- **MIN-4** (P3): password.test.ts:24 skip 입력값 4자 'short' → Phase 3 unskip 시 4자 미만으로 교체 의무
- **MIN-5** (P3): `getPasswordMinLength` 부동소수/공백 fuzz 0건
- **MIN-6** (P4): hibpStatus 응답 노출 만료일(launch D-day) 미명시 (Stage A M-γ carry-over)
- **MIN-7** (P5): Failed login attempt 별도 로깅 부재 → rate-limit 429 Cloudflare 로그만
- **MIN-8** (P5): ADR-034/035/036 "복원 의무" 인간 의존 → hook 부재

---

## 5. 직전 4-Pass와 중복 회피 검증

본 5-페르소나 결과 중 직전 4-Pass (Stage A/B/C)에서 이미 보고된 항목:

- AuthForm 클라이언트 hint dynamic 미반영 → Stage A M-β (제외)
- register login lockout (key prefix 분리) → Stage B M-1 (제외)
- hibpStatus 응답 노출 → Stage A M-γ (Phase 3 launch 직전 carry-over)
- login_at DEFAULT 포맷 → Stage C M-1 (흡수 완료)
- production migration 0030 apply 선행 → Stage C M-3 (plan 갱신 완료)

→ **본 5-페르소나는 4-Pass 미발견 영역 (6개월~2년 부채 + 운영 부채) 단독 검출**.

---

## 6. 최종 판정

### Phase 3 launch chain commit (Stage A+B+C)

**PASS** — CRITICAL 0건이 commit 시점에서 확인. 본 chain commit (2395851 + 5d85028 + 20e1ff5) 진행 가능.

### Production deploy 전 의무

**FAIL — CRITICAL 2건 흡수 필요**:

- ★ CRIT-P5-1 Migration drift 자동 감지 (Workers boot schema assertion)
- ★ CRIT-P5-2 부분 rollback decision matrix (plan §6 갱신)

### Phase 3 launch chain 완료 게이트 (chain 전체 종착 의무)

- 본 chain 5-페르소나 carry-over 매트릭스 영속 ✓
- handoff-077 carry-over 명시 의무
- Phase 3 launch 직전 별도 stage 의무 (P5 CRIT 2건 + MAJ-6 retention + MAJ-7 HIBP test + MAJ-8 SameSite test + MAJ-11 audit drop gauge)

---

## 7. 산출물 영속 영역

- 본 보고서: `.claude/reviews/review-20260512-132500-phase3-launch-chain-5-persona-integrated.md`
- 다음 핸드오프: `.jjokjipge/handoff-session-077.md` (carry-over matrix 영속)
- plan §6 갱신 권고 (rollback decision matrix)
- 별도 stage 또는 runbook ADR (P5 CRIT 흡수)

---

## 8. carry-over 매트릭스 (우선순위)

### Phase 3 launch 직전 의무 (production deploy 전)

1. ★★ CRIT-P5-1 Migration drift 자동 감지 (Workers boot schema assertion)
2. ★★ CRIT-P5-2 부분 rollback decision matrix (plan §6)
3. ★ MAJ-7 HIBP env=true 422 통합 테스트 (HIBP_ENABLED=true toggle 전 의무)
4. ★ MAJ-6 login_history retention 정책 + Cron archival
5. ★ MAJ-11 login_history INSERT 실패 게이지 (auth_audit_drop)

### Phase 3 launch 후 quarterly refactoring

- MAJ-1 FakeDb → createD1FromSqlite 전환
- MAJ-2 ~ MAJ-4 코드 품질 부채 정리
- MAJ-5 hashIp 중복 호출 통합 (5분, Session 069 즉시 가능)
- MAJ-9 admin login_history 조회 API
- MAJ-10 users.lastLoginAt 폐기 마이그레이션 0031

### Cosmetic / Doc 정리

- MIN-1 ~ MIN-8

---

**작성**: Claude (Opus 4.7 1M context) — Session 068, Phase 3 launch chain 종착 시점
**일자**: 2026-05-12 KST
**리뷰 방식**: 독립 5 에이전트 단일 메시지 병렬 호출 (P1~P5)
**자가 리뷰**: 0건
**chain 진척**: ★ Phase 3 launch chain 14 CRIT 5/5 = 100% 흡수 + 5-페르소나 심층 리뷰 종착
