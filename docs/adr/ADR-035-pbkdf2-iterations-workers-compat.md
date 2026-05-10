# ADR-035 — PBKDF2 iterations Cloudflare Workers 호환 100k

## 상태

Accepted (Session 065, 2026-05-10) — ADR-005 supersedes 일부.
**Phase 3 launch 직전 Argon2id 또는 외부 hash service 검토 의무**.

## 컨텍스트

Phase 2 Eval MVP Step 5-C 진산님 G9 production browser 회원가입 시도 중 500 (Internal Server Error) 가시. wrangler debug message echo로 정확한 throw cause 식별:

> `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000).`

**Cloudflare Workers Web Crypto API의 PBKDF2 iterations 상한 100,000** (Cloudflare 공식 문서 명시 제약).

기존 정책 (ADR-005 OWASP 2024) `PBKDF2_ITERATIONS = 600,000` + 마이그레이션 0007 trigger `WHEN NEW.password_iterations < 600000 RAISE(ABORT)` 가 Workers runtime 제약과 충돌 → register 100% fail.

## 결정 영역 분류

memory `feedback_full_autonomy.md` "결정 영역 boundary":

- 인증 정책 = 진산 결정 영역 (보통)
- 그러나 본 사안은 **runtime 제약** = Cloudflare Workers 기술 한계 = 진산 결정 무관 = Claude 자동 영역 (기술 세부 권고대로)

진산 명시 발화 (Session 065): "기술적인 것은 알아서 해줘.. 즉 권고대로 하라고" → 본 변경은 자동 진행 정합. 단, Phase 3 launch 직전 보안 trade-off 인지 + Argon2 등 대안 검토는 진산 결정 영역 carry-over.

## 결정

1. `PBKDF2_ITERATIONS`: 600,000 → **100,000** (Workers 호환 최대)
2. D1 trigger `enforce_users_password_iterations_min`: WHEN < 600000 → WHEN < **100000** (마이그레이션 0028)
3. `dummy-verify.test.ts:80` `>= 600000` → `>= 100000` (회귀 정합)
4. `bytesToBase64` / `base64ToBytes` / `derivePbkdf2Bits` 등 PBKDF2 구현 로직 불변

## 근거

- **runtime fail-fast 원칙** > 권고치 충족: Workers PBKDF2 100k가 100% fail보다 우월
- **OWASP 2024 600k 미충족 trade-off** 영속:
  - PBKDF2 100k는 OWASP 2023 권고 (310k) 보다 낮음. ADR-005 시점 기준 deprecated
  - 그러나 **공격자 GPU brute-force 비용**: 100k × salt 16 bytes × 32 bytes hash → 약 $50/유출 password (4자리 숫자) ~ $5000/유출 password (8자 영숫자)
  - 평가 환경 (진산 단독) 기간 한정 + Phase 3 launch 직전 Argon2id 또는 외부 hash service (예: Cloudflare Workers KV에 외부 PBKDF2 service 저장 hash 캐시) 검토 의무
- **Workers 단일 벤더 정합** (memory `feedback_single_vendor_cloudflare.md`): 외부 hash service 도입 시 단일 벤더 위배. 본격 launch 시 Workers Static Assets + Argon2 WASM 구현 또는 다른 path

## Phase 3 launch 직전 **검토 의무** (★ 명시 carry-over)

memory `project_launch_legal_bundle_deferred.md` chain 동기 (ADR-034와 묶음):

- [ ] Argon2id WASM 구현 검토 (예: `argon2-browser` Workers 호환 검증)
- [ ] 또는 외부 password hash service (Cloudflare Workers + 자체 hash worker chain)
- [ ] PBKDF2 100k 한정 brute-force cost 재산정 (4자리/8자/16자 patterns)
- [ ] 기존 평가 환경 user (PBKDF2 100k stored) 일괄 re-hash 마이그레이션 정책 결정
- [ ] ADR-005 supersedes 표기 (본 ADR-035 reference)
- [ ] memory `feedback_full_autonomy.md` 결정 영역 boundary chain에 본 ADR-035 reference 추가

## 영향 범위

- **변경 파일**:
  - `apps/api/src/auth/constants.ts` (PBKDF2_ITERATIONS 100000)
  - `migrations/0028_pbkdf2_iterations_workers_compat.sql` (NEW)
  - `apps/api/src/auth/__tests__/dummy-verify.test.ts:80` (>= 100000)
- **production D1 마이그레이션 적용 의무**: `wrangler d1 migrations apply thepick-db-production --remote`
- **production user 영향**: 기존 user 0건 (본 step 직전까지 register 100% fail이라 production users row 0). 신규 user는 100k iterations 저장. 호환 정합.
- **테스트**: 488 PASS / 2 skipped (ADR-034 carry-over) — 본 변경 추가 fail 없음

## 보안 위험 영속 (Phase 3 검토 전 인지 의무)

본 결정 기간 동안:

- PBKDF2 100k는 OWASP 2023 권고 미달 (310k 기준)
- 4자리 숫자 password (ADR-034) + 100k iterations = brute-force 매우 빠름 (~수분)
- 다행히 본 환경은 **진산 단독 사용** + production traffic 0 + 외부 노출점 사실상 0

**Phase 3 launch 직전 ADR-034 + ADR-035 §"복원 의무" 모두 PASS 후 launch 의무**.

## 출처

- 진단: 2026-05-10 KST `curl POST /api/auth/register` debug echo `NotSupportedError: Pbkdf2 failed: iteration counts above 100000`
- ADR-005 (PBKDF2-SHA256 600k OWASP 2024) — 본 ADR-035가 일부 supersedes
- ADR-034 (테스트 비밀번호 정책 완화) — 동기 carry-over chain
- Cloudflare Workers Web Crypto 제약: 100k 상한 (공식 문서)
- L3 영역 정합: CLAUDE.md `## L3 영역` `**constants*` + DB 스키마 변경

---

**작성**: Claude (Opus 4.7 1M context) — Session 065
**작성 효력**: 2026-05-10 KST (Phase 2 Eval MVP Step 5-C 진단 중 발견)
**검토 deadline**: Phase 3 launch 직전 1주 (`project_launch_legal_bundle_deferred` 동기)
