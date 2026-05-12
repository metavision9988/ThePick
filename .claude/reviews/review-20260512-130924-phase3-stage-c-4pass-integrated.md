# Phase 3 Launch Chain — Stage C 4-Pass 독립 에이전트 리뷰 통합

> **본 보고서**: docs/plans/phase3-launch-chain.plan.md §3 Stage C 종료 시점.
> **리뷰 방식**: backend-architect (Pass 1+2) + security-engineer (Pass 3+4) 병렬 위임.
> **자가 리뷰 0건** (`.claude/rules/auto-review-protocol.md` 규칙 0 준수).
> **★ 14 CRIT 매트릭스 5/5 = 100% 흡수 종결 시점** (Phase 3 launch chain 전체 완료).

---

## 1. 리뷰 범위

| #   | 파일                                         | 변경                                                                                |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `migrations/0030_login_history.sql`          | NEW (테이블 + 2 인덱스 + 2 NOT NULL trigger)                                        |
| 2   | `apps/api/src/db/schema.ts`                  | loginHistory Drizzle + LoginHistory/NewLoginHistory 타입                            |
| 3   | `apps/api/src/auth/routes.ts`                | login handler UPDATE → INSERT 전환 (hashIp + truncateUserAgent + crypto.randomUUID) |
| 4   | `apps/api/src/auth/__tests__/routes.test.ts` | FakeLoginHistoryRow + mock + 2 신규 integration test                                |

---

## 2. 카운트 요약

| 리뷰어                                         | CRIT  | MAJOR | MINOR            |
| ---------------------------------------------- | ----- | ----- | ---------------- |
| Pass 1+2 SURGEON+ARCHITECT (backend-architect) | 0     | 0     | 3                |
| Pass 3+4 ADVOCATE+CONTRACT (security-engineer) | 0     | 0     | 1 + Pass4 반론 1 |
| **합계**                                       | **0** | **0** | **5**            |

---

## 3. CRITICAL/MAJOR dedupe

**0건 종결** — Stage C 완료 가능 판정 (만장일치). Stage A/B와 달리 신규 attack vector 0건 발견.

---

## 4. MINOR (5건) — 2건 즉시 흡수

| ID        | 제목                                                                      | 출처             | 처리                                                                                     |
| --------- | ------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| **★ M-1** | 0030 login_at DEFAULT 포맷 불일치 (`datetime('now')` vs `.toISOString()`) | Pass1+2 MINOR-1  | **★ 즉시 흡수** — `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` 통일 (sessions 0009 패턴 정합) |
| M-2       | hashIp empty pepper 빈문자열 반환 비대칭 (현 호출 측 가드 정합)           | Pass1+2 MINOR-2  | 본 chain 외 부채 정리 (별도 PR)                                                          |
| **★ M-3** | production migration 0030 apply 선행 의무 명시 부재                       | Pass1+2 MINOR-3  | **★ 즉시 흡수** — plan §5 chain 종료 게이트에 항목 추가                                  |
| M-4       | audit_insert_failure_rate 게이지 OBS carry-over                           | Pass3 MINOR-P3-1 | master-dashboard.md 별도 carry-over                                                      |
| M-5       | schema.ts:31 헤더 주석 drift (lastLoginAt UPDATE 폐기 미반영)             | Pass4 반론       | 본 chain 외 doc 정리                                                                     |

### ★ M-1 흡수 상세

**문제**: 코드는 `new Date().toISOString()` → `"2026-05-12T13:09:00.123Z"` (T 구분 + ms + Z). DB DEFAULT는 `datetime('now')` → `"2026-05-12 13:09:00"` (space 구분, ms 없음). 양쪽 포맷 mixmatch.

**현 영향 0** — 코드가 항상 `.bind()`로 명시 주입하므로 DEFAULT 미발동. 하지만 향후 누군가 INSERT에서 login_at을 생략하면 다른 포맷 적재.

**해결**: 0030 SQL DEFAULT를 `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`로 변경 → 항상 ISO 8601 포맷. sessions 0009:551 패턴 정합.

### ★ M-3 흡수 상세

**문제**: migration 0030이 production에 적용되지 않은 상태에서 apps/api 배포되면, login handler가 `INSERT INTO login_history` 시도 → 테이블 없음 → throw → graceful catch (logger.warn) → login 자체는 성공하지만 audit trail 0건 누적.

**해결**: plan §5 chain 종료 게이트에 명시:

- `[ ] migration 0030 production 적용 선행 의무` (코드 deploy 전)
- `[ ] production redeploy + smoke test` (Workers Version 갱신 + production-migration-status.md 영속)

---

## 5. Pass 1+2 반론 (Devil's Advocate)

> "공격자가 동일 user 1만회 login 실패(verify reject) 시 audit row 0 (성공만 누적). 실패 brute-force 추적 불가."

**대응**: login_history는 **success-only** 의도된 설계.

- 실패 브루트포스 추적: 별도 메커니즘 (rate-limit 429 로그 + sessions revoke + audit 8게이지 carry-over)
- 외곽 방어 충분 — rate-limit (5/600s) + sessions revoke chain

---

## 6. Pass 4 반론 (Devil's Advocate)

> "schema.ts:31 헤더 주석 'users 테이블은 예외 — last*login_at / subscription*\* 변경 빈도로 일반 UPDATE 허용'에서 lastLoginAt UPDATE는 C-12로 폐기됐는데 주석 미갱신 → silent doc drift."

**대응**: subscription\_\* 컬럼은 여전히 UPDATE 발생 — 주석 부분 정확. lastLoginAt 부분만 drift. 본 chain 외 doc 정리.

---

## 7. 최종 판정

**Stage C 완료 가능** — CRITICAL 0건, MAJOR 0건, MINOR 2건 즉시 흡수 (M-1 + M-3).

### Stage C 합격 게이트 확인

- [x] apps/api typecheck PASS
- [x] apps/api lint PASS
- [x] apps/api tests: 497 PASS / 2 skip (Stage B 495 → +2 신규 C-12 audit trail test)
- [x] verify-engine-contracts: 7 PASS / 0 FAIL / 1 SKIP
- [x] 독립 4-Pass 리뷰 (2 에이전트 병렬) — 자가 리뷰 0건
- [x] CRITICAL 0건 확인
- [x] MAJOR 0건 확인 (Stage A/B 대비 안정)
- [x] MINOR M-1 (login_at DEFAULT 포맷) 즉시 흡수
- [x] MINOR M-3 (production migration 0030 apply 선행 의무) plan 갱신

### Phase 3 chain 종착 의무 (chain 종료 게이트 §5)

- [ ] entry verify 2회 PASS 7/0/1
- [ ] **5-페르소나 기술부채 심층 리뷰 (Phase 단위 의무, .claude/rules/auto-review-protocol.md)**
- [ ] ADR-034/035/036 §"복원 의무" 본문 갱신 (env 자동화 반영) — Stage B에서 ADR-034 완료
- [ ] memory `project_launch_legal_bundle_deferred.md` carry-over 갱신
- [ ] migration 0030 production 적용 선행 의무 (★ M-3 흡수 반영)
- [ ] production redeploy + smoke test (Workers Version 갱신)
- [ ] handoff-077 영속 (Phase 3 chain 전체 종착 보고)

---

## 8. 산출물 영속 영역

- 본 보고서: `.claude/reviews/review-20260512-130924-phase3-stage-c-4pass-integrated.md`
- plan §5 갱신 (chain 종료 게이트에 M-3 흡수)
- 0030 SQL DEFAULT 포맷 통일 (M-1 흡수)
- Stage C 종착 commit: 본 보고서 commit 직후
- ★ **14 CRIT 매트릭스 5/5 = 100% 흡수 종결**

---

**작성**: Claude (Opus 4.7 1M context) — Session 068, Stage C 종료 시점
**일자**: 2026-05-12 KST
**리뷰 방식**: 독립 2 에이전트 병렬 위임 (backend-architect / security-engineer)
**자가 리뷰**: 0건 (CRITICAL RULE 정합)
**chain 진척**: ★ Phase 3 launch chain Stage A+B+C 3 stage 모두 완료 — 14 CRIT 매트릭스 5/5 흡수
