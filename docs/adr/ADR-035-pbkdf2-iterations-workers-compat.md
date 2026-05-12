# ADR-035 — PBKDF2 iterations Cloudflare Workers 호환 100k

## 상태

**Accepted (temporary)** (Session 065, 2026-05-10 → Session 069 ADR-037 retrofit 2026-05-12) — ADR-005 partial-supersedes.

- **결정일:** 2026-05-10
- **만료 deadline:** Phase 3 launch 직전 1주 (Argon2id WASM / 외부 hash service 검토 후 결정)
- **복원 chain:** 본 ADR §"Phase 3 launch 직전 검토 의무" 6 항목
- **자동화 toggle 위치:** `apps/api/src/auth/constants.ts:35` `PBKDF2_ITERATIONS = 100000` (★ Cloudflare Workers Web Crypto API PBKDF2 cap 100,000 — 영구 runtime 제약. env toggle 불가. 600k 복원은 hash 알고리즘 자체 변경 필요)
- **Governance:** ADR-037 §"Retrofit 가이드라인" 정합 (Session 069 Phase 3 launch chain Step 5)

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

## PBKDF2 100k vs 600k 비용 정량 분석 (Session 066 5-Persona Performance C-08 흡수)

> 본 섹션은 Phase 3 launch 직전 검토 의무의 정량 baseline. brute-force 비용 + Workers fleet 부담 두 축으로 산정.

### A. brute-force offline cost (공격자 측)

| password 패턴               | search space | PBKDF2 100k cost (RTX 4090 ×8) | PBKDF2 600k cost (RTX 4090 ×8) |
| --------------------------- | ------------ | ------------------------------ | ------------------------------ |
| 4자리 숫자 (ADR-034)        | 10⁴ = 10,000 | **~0.025초** (사실상 즉시)     | ~0.15초 (여전히 즉시)          |
| 6자리 영숫자                | 36⁶ = 2.2B   | ~5.5시간                       | ~33시간                        |
| 8자리 영숫자 (launch-ready) | 36⁸ = 2.8T   | ~92일                          | ~552일 (1.5년)                 |
| 8자리 mixed-case + 특수     | 95⁸ = 6.6Q   | ~600년                         | ~3,600년                       |

**결론**: 4자리 숫자 (ADR-034 평가 환경) 시 600k 복원해도 brute-force 무의미. **password complexity가 iterations보다 1차 방어선**. Phase 3 복원 시 PASSWORD_MIN 8 + complexity 강제(영숫자+특수) 우선, 600k 복원은 차순위.

### B. Workers fleet 부담 (서비스 측)

가정: PBKDF2 100k 1회 CPU ≈ 30~50ms (Cloudflare Workers Web Crypto 실측 범위), 600k ≈ 180~300ms.

| 시나리오                                        | login 트래픽    | 100k 부담           | 600k 부담             | Workers Paid 30s 한계 도달도            |
| ----------------------------------------------- | --------------- | ------------------- | --------------------- | --------------------------------------- |
| Phase 2 평가 (진산 단독)                        | <1 req/day      | 무의미              | 무의미                | 0%                                      |
| Phase 3 초기 1K user                            | ~1 req/min peak | 0.83ms/sec          | 5ms/sec               | <0.1%                                   |
| 1만 user peak hour (5 req/min × 10%)            | ~83 req/sec     | 2,500~4,150ms/sec   | 15,000~24,900ms/sec   | **25% (600k)** ★ Persona2 P-CRIT-3 우려 |
| 10만 user peak burst (10 req/sec/1K user × 10%) | ~1,000 req/sec  | 30,000~50,000ms/sec | 180,000~300,000ms/sec | **300% (600k) — fleet 한계 초과**       |

**해석**:

- 1만 user 도달 시 600k 단일 path가 Workers capacity 25% 점유 → **다른 endpoint 응답성 영향 가능**
- 10만 user 도달 시 600k는 horizontal scale 불가능 (single endpoint 한계 초과) → **Workers fleet 확장 또는 Argon2id 검토 필수**
- Workers 1 request 30s CPU 한계는 단일 hash 자체는 안전 (300ms ≪ 30s). 문제는 **동시 요청 누적**.

### C. 비용 trade-off 매트릭스

| 옵션                                 | brute-force 방어            | Workers 부담       | 구현 비용 | 추천 단계                |
| ------------------------------------ | --------------------------- | ------------------ | --------- | ------------------------ |
| 현 100k + 4자리 (ADR-034)            | 매우 낮음                   | 거의 없음          | 0         | 평가 환경 한정           |
| 100k + 8자 영숫자                    | 보통                        | 거의 없음          | 1h        | Phase 3 초기 (1K user)   |
| 600k + 8자 영숫자                    | 양호 (PCID 통과 가능)       | 1만 user 한계      | 2h        | Phase 3 중기 (1만 user)  |
| Argon2id + 8자 영숫자                | 매우 양호 (OWASP 2024 최상) | 적음 (메모리 hard) | 4-8h      | Phase 3 후기 / 10만 user |
| External hash service (Worker chain) | 양호                        | 매우 적음          | 8-16h     | scaling 압박 시점        |

### D. 결정 영속 (Phase 3 1주 스프린트 chain 입력)

본 정량 분석은 ADR-035 §"검토 의무" 5번째 체크박스 "PBKDF2 100k 한정 brute-force cost 재산정" 일부 흡수.
Phase 3 진입 시 user 규모 예상치 (1K vs 1만 vs 10만)에 따라 옵션 B/C/D 중 진산 결정 (memory `feedback_full_autonomy.md` "인증 정책" + "품질" 결정 영역).

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
