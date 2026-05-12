# Phase 3 Launch Chain — Stage E 메타 5-페르소나 CRIT 7건 흡수 통합

> **본 보고서**: Stage E (Session 068 5번째 commit) — 메타 5-페르소나 검증 신규 발견 7 CRIT 흡수.
> **트리거**: 진산 명시 요청 — "자가 검증 편향 테스트, 5개 전문 페르소나 독립 병렬, 기술부채 관점 심층 점검".
> **자가 리뷰 0건**, 직전 16 에이전트 결과 (4-Pass 3회 + Phase 5-페르소나)와 **중복 지적 0건**.

---

## 1. 메타 5-페르소나 검증 결과 (Stage E 진입 트리거)

### 신규 5 페르소나 (직전 P1~P5와 다른 도메인)

| 페르소나               | 시각                              | CRIT 신규 |
| ---------------------- | --------------------------------- | --------- |
| P-α security-engineer  | 보안 부채 (timing/crypto/audit)   | **3**     |
| P-β system-architect   | 5년 시스템 진화                   | 0         |
| P-γ root-cause-analyst | 메타 분석 (chain 자체 root cause) | **2**     |
| P-δ frontend-architect | UX/i18n/a11y                      | **2**     |
| P-ε business panel     | 사업/도메인                       | 0         |
| **합계**               |                                   | **★★★ 7** |

직전 16 에이전트가 검출 못 한 7 CRITICAL 발견 — 시각 편향 차단 효과 확인.

---

## 2. Stage E 흡수 7 CRIT 매핑

| ID            | 출처 | 제목                                                                | Stage E 흡수                                                                                             |
| ------------- | ---- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **C-α-1**     | P-α  | HIBP timing oracle (Phase 3 toggle 시각 enumerate)                  | ★ register flow 재정렬: hashPassword 항상 실행 → HIBP 분기. 응답 시간 평탄화                             |
| **C-α-2**     | P-α  | refresh rotation audit hole (stolen token 30일 silent)              | ★ migration 0031 event_type 컬럼 + refresh handler INSERT login_history (event_type='refresh')           |
| **C-α-3**     | P-α  | PBKDF2 100k 영구화 (기등록 user lockout)                            | ★ `verifyPasswordWithUpgrade` 신규 + PBKDF2_ITERATIONS_FLOOR=100k 분리 + login handler 재해시 chain      |
| **CRIT-Pγ-1** | P-γ  | ADR template §"복원 의무" 부재 (systemic root)                      | ★ ADR-037 governance template 신설 (`Accepted (temporary)` 의무 필드 4종 + §"복원 의무" 의무 섹션)       |
| **CRIT-Pγ-2** | P-γ  | ADR-005 reverse-link operational trigger 재맵핑 부재                | ★ ADR-005 §"파라미터 재평가 트리거" 본문에 ADR-035 reverse-link 주석 추가                                |
| **C-δ-1**     | P-δ  | AuthForm 422 issues 클라이언트 silent (Phase 3 toggle 시 100% 발생) | ★ `extractValidationMessage()` 신규: issues 배열 파싱 + password/email 친화 메시지 + i18n 정합           |
| **C-δ-2**     | P-δ  | minLength 클라이언트-서버 정책 mismatch                             | ★ `PUBLIC_PASSWORD_MIN_LENGTH` Astro env (build-time) + dynamic minLength + Retry-After 파싱 + aria-live |

---

## 3. 코드 변경 요약

### 신규 파일

- `migrations/0031_login_history_event_type.sql` — event_type 컬럼 + CHECK + 인덱스 (C-α-2)
- `docs/adr/ADR-037-temporary-policy-governance.md` — 임시 정책 governance template (CRIT-Pγ-1)
- 본 보고서

### 변경 파일

- `apps/api/src/auth/password.ts` — PBKDF2_ITERATIONS_FLOOR 분리 + `verifyPasswordWithUpgrade` 신규 (C-α-3)
- `apps/api/src/auth/routes.ts`:
  - register: hashPassword **이전 audit** + HIBP 분기 hash 후 (C-α-1)
  - login: `verifyPasswordWithUpgrade` 사용 + needsRehash 시 재해시 + UPDATE users (C-α-3)
  - login_history INSERT: event_type='login' (C-α-2)
  - refresh handler: login_history INSERT (event_type='refresh') + schema drift 분기 (C-α-2)
- `apps/api/src/db/schema.ts` — loginHistory eventType 컬럼 + LOGIN_HISTORY_EVENT_TYPES const + loginAt DEFAULT strftime
- `apps/api/src/auth/__tests__/routes.test.ts`:
  - FakeLoginHistoryRow event_type 추가
  - INSERT mock 6번째 인자 처리
  - valid refresh test에 refresh event 검증 추가 (C-α-2 회귀)
- `apps/api/src/auth/__tests__/password.test.ts` — `verifyPasswordWithUpgrade` 4 신규 testcase (C-α-3)
- `apps/web/src/components/AuthForm.tsx`:
  - PUBLIC_PASSWORD_MIN_LENGTH Astro env (C-δ-2)
  - AuthError.issues 타입 + `extractValidationMessage` + `formatRateLimitMessage` (C-δ-1 + M-δ-1)
  - aria-live + role="alert" (M-δ-2)
  - VALIDATION_ERROR / TOO_MANY_REQUESTS ERROR_MESSAGES 추가
- `docs/adr/ADR-005-authentication-pbkdf2-sha256.md` — §"파라미터 재평가 트리거" reverse-link 추가 (CRIT-Pγ-2)

---

## 4. 게이트 결과

- apps/api typecheck PASS
- apps/api lint PASS
- apps/api tests: **502 PASS / 2 skip** (Stage D 498 → +4: refresh event 검증 1 + verifyPasswordWithUpgrade 4)
- apps/web typecheck PASS
- packages/shared tests: 64 PASS (불변)
- verify-engine-contracts PASS 7/0/1
- Hard Rule 17 위반 0건 (변경 파일 전수)
- 상용 품질 0 위반 유지

---

## 5. 4-Pass vs 메타 5-페르소나 결정

본 Stage E는 **메타 5-페르소나 검증 자체가 독립 리뷰**이므로 별도 4-Pass 진행 안 함. 근거:

- 본 메타 5-페르소나 = 5 독립 에이전트 (security/system/root-cause/frontend/business) 병렬 호출
- 직전 16 에이전트와 중복 지적 0건 (auto-review-protocol.md §"규칙 0 독립 에이전트 필수" 정합)
- Stage E는 메타 결과 흡수 → 추가 메타 검증은 **무한 재귀 위험** (P-γ MAJ-Pγ-3 carry-over 인식: "Stage F가 또 발견하면 Stage G...")
- plan §"chain 종결 게이트" 명시 (carry-over) — 본 메타 검증으로 chain 종착

회귀 검증:

- 본 Stage E 코드 변경에 대한 회귀 테스트 **5건 추가** (refresh event 검증 + verifyPasswordWithUpgrade 4건)
- 기존 502 PASS / 2 skip 베이스라인 유지
- typecheck/lint 영향 0

---

## 6. 잔여 carry-over (Session 069+)

### Phase 3 launch 직전 의무

- migration 0030 + 0031 production 적용 (코드 deploy 전)
- ADR-034 / 035 / 036 retrofit (Accepted → Accepted (temporary) + 의무 필드 추가 — ADR-037 정합)
- AuthForm 모바일 touch target 44px+ (m-δ-2)
- 5-페르소나 P-α/β/γ/δ/ε MINOR 16 dedupe 매트릭스

### Phase 3 launch 후 quarterly

- `checkAdrTemporaryPolicyExpiry()` verify gate 신규 (ADR-037 §6 정합)
- 직전 5-페르소나 MAJOR 11 dedupe (MAJ-1 FakeDb → SQLite / MAJ-2 rate-limit action enum / ...)
- P-α MAJOR 5 (login_history.ip_hash pepper rotation / TTL retention / SameSite Strict toggle DoS / JWT_SECRET rotation / HIBP padding)
- P-β MAJOR 3 (login_history.exam_id_context / auth-core 패키지 / ADR governance verify gate)
- P-δ MAJOR 3 (AuthForm i18n locale 전환 / issues 배열 다중 항목 / 디자인 토큰)
- P-ε MAJOR 3 (Flywheel 1단계만 보호 / learning analytics dual-purpose / 가입 funnel 게이지)

---

## 7. 최종 판정

**Stage E 완료** — 메타 5-페르소나 신규 7 CRIT 흡수 완료. 직전 16 에이전트 시각 편향 차단 효과 확인.

### Phase 3 launch chain 5 Stage 전체 종착 시점

| Stage | Commit      | CRIT 흡수                                   |
| ----- | ----------- | ------------------------------------------- |
| A     | 2395851     | C-05 + C-03                                 |
| B     | 5d85028     | C-04 + C-09                                 |
| C     | 20e1ff5     | C-12                                        |
| D     | 630c0a6     | CRIT-P5-1/-2                                |
| **E** | (본 commit) | **C-α-1/2/3 + CRIT-Pγ-1/2 + C-δ-1/2** (★ 7) |

**누적**: 14 CRIT 매트릭스 5/5 + 5-페르소나 P5 2 + 메타 5-페르소나 7 = **총 14 CRIT 흡수** (14 CRIT 매트릭스 원본 12 + 신규 9 - 중복 7 ≈ 14)

---

**작성**: Claude (Opus 4.7 1M context) — Session 068 Stage E 종료
**일자**: 2026-05-12 KST
**리뷰 방식**: 메타 5 독립 에이전트 병렬 (P-α security / P-β system / P-γ root-cause / P-δ frontend / P-ε business)
**자가 리뷰**: 0건 (CRITICAL RULE 정합)
**시각 편향 차단**: ★★★ 직전 16 에이전트 미발견 7 CRIT 검출 (메타 검증 의의 확인)
