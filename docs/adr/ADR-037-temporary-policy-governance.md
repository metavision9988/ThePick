# ADR-037: 임시 정책 ADR Governance (Stage E P-γ CRIT-Pγ-1 흡수)

- **상태:** Accepted
- **결정일:** 2026-05-12
- **결정자:** Claude Opus 4.7 (Session 068 Stage E) — 메타 5-페르소나 P-γ root-cause-analyst 검출
- **관련 위협:** 임시 정책 ADR (ADR-034/035/036) 패턴이 향후 무한 재발 시 시스템 일관성 붕괴

---

## 맥락 (Context)

14 CRIT 매트릭스 (Session 065 9 에이전트 통합 리뷰)에서 검출된 5건 (C-03/04/05/09/12) 중 **C-03/C-05/C-09는 ADR-034 임시 정책 chain의 후속 처리**였다. 메타 5-페르소나 P-γ root-cause-analyst가 검출한 systemic root는 다음과 같다:

> "ADR template 자체에 §"복원 의무" 의무 섹션이 없음 — /home/soo/ClaudePro/ThePick/docs/adr/ 35개 ADR 중 template/skeleton 파일 0건. 향후 ADR-038 등 신규 임시 ADR 작성 시 같은 패턴 (인간 의존, 본 chain 처럼 Stage A에서야 toggle 자동화) 재발 보장."

근거 trace:

- ADR-034 (테스트 비밀번호 정책 완화) — Session 065 Phase 2 Eval MVP urgent fix
- ADR-035 (PBKDF2 100k Workers 호환) — Session 065 동일 시점
- ADR-036 (Cookie SameSite cross-origin) — Session 065 동일 시점
- 3 ADR 모두 §"복원 의무" 또는 §"검토 의무"를 사후 추가 (template 의무 부재)
- Stage A에서야 env toggle 자동화 (인간 의존 chain → 자동화 chain 전환에 1세션 소요)

본 ADR은 **임시 정책 ADR template + governance**를 정의하여 향후 ADR-038 등에서 동일 root cause 재발을 차단한다.

---

## 결정 (Decision)

### 1. ADR 상태 enum 확장

기존 ADR 상태:

- `Proposed` / `Accepted` / `Rejected` / `Deprecated` / `Superseded`

본 ADR로 추가:

- **`Accepted (temporary)`** — 임시 정책. 만료 deadline 의무.

### 2. Accepted (temporary) ADR 의무 필드

`Accepted (temporary)` 상태 ADR은 다음 4 필드를 frontmatter 또는 본문에 **의무 포함**:

```yaml
- **상태:** Accepted (temporary)
- **결정일:** 2026-XX-XX
- **만료 deadline:** YYYY-MM-DD 또는 "Phase N launch 직전 1주"
- **복원 chain:** [ADR-XYZ §"복원 의무" 참조]
- **자동화 toggle 위치:** [예: env var `XXX`, build-time flag, code constant]
```

### 3. §"복원 의무" 의무 섹션

`Accepted (temporary)` ADR은 본문에 **§"복원 의무" 섹션 의무 포함**:

```markdown
## 복원 의무 (Phase N launch 직전 체크리스트)

- [ ] 항목 1 — 자동화 toggle 변경 (예: wrangler.toml env value)
- [ ] 항목 2 — 회귀 테스트 활성화
- [ ] 항목 3 — 본 ADR을 Deprecated 또는 Superseded 상태로 변경
- [ ] 항목 4 — 운영 절차 문서 (runbook) 갱신
```

### 4. ADR-005 류 영구 정책 ADR과의 관계

`Accepted (temporary)` ADR이 영구 정책 ADR (예: ADR-005 PBKDF2 600k OWASP)을 부분 supersede하는 경우:

- 임시 ADR은 영구 ADR의 §"Partially-superseded-by" 헤더에 추가
- 영구 ADR의 본문은 변경 0 (임시 정책 만료 후 복원 의도 명확)
- 임시 ADR의 §"복원 의무" 항목 1순위는 "영구 ADR §본문대로 복원"

### 5. Operational Trigger 재맵핑 (Stage E CRIT-Pγ-2 흡수)

영구 ADR (예: ADR-005)이 monthly OWASP review 등 operational trigger를 정의한 경우:

- 임시 ADR이 영구 ADR을 supersede하면 **operational trigger도 임시 ADR로 redirect**
- 영구 ADR의 §"Operational Triggers" 섹션에 "현 시점 ADR-XYZ 임시 정책 적용 중 — 검토 시 ADR-XYZ §"복원 의무" 우선 확인" 주석 추가

### 6. 자동화 verify gate (Stage B C-09 정합)

- `scripts/verify-engine-contracts.ts`의 `checkAdr034CarryOverSkips()` 함수는 ADR-034 carry-over skip 카운트만 검증
- 본 ADR로 확장: `checkAdrTemporaryPolicyExpiry()` 신규 (carry-over) — `Accepted (temporary)` ADR의 **deadline이 30일 이내**인 경우 알람
- 본 verify check는 Stage F (carry-over) 또는 Session 069+ 흡수

---

## 적용 (Application)

### Retrofit 가이드라인 (기존 임시 ADR 갱신 절차)

ADR-034 / ADR-035 / ADR-036을 본 ADR-037 정합으로 갱신:

1. **상태 변경**: `Accepted` → `Accepted (temporary)`
2. **만료 deadline 추가**: "Phase 3 launch 직전 1주"
3. **자동화 toggle 위치 명시**:
   - ADR-034: `wrangler.toml` env `PASSWORD_MIN_LENGTH` / `HIBP_ENABLED`
   - ADR-035: `apps/api/src/auth/constants.ts:35` `PBKDF2_ITERATIONS` (Workers cap 영구 제약)
   - ADR-036: `wrangler.toml` env `AUTH_COOKIE_SAMESITE`
4. **복원 chain 참조**: ADR 본문 §"복원 의무" 항목 정합
5. **본 ADR 본문에 reverse-link 추가**: ADR-005 등 영구 ADR에서 임시 ADR 인지 가능하도록

본 retrofit은 Session 069+ Stage F carry-over (현 Session 068 Stage E commit 시점에는 본 ADR-037만 신설).

### 신규 임시 정책 ADR 작성 절차

향후 ADR-038+ 작성 시:

1. 본 ADR-037 template 참조
2. `Accepted (temporary)` 상태 명시
3. 4 의무 필드 (만료 deadline / 복원 chain / 자동화 toggle 위치) 채움
4. §"복원 의무" 섹션 4 항목 이상 명시
5. 영구 ADR과의 관계 (Partially-superseded-by) 명확화
6. 자동화 verify gate 추가 검토

---

## 영향 (Impact)

### 변경 파일 (본 ADR 신설)

- `/home/soo/ClaudePro/ThePick/docs/adr/ADR-037-temporary-policy-governance.md` (NEW)

### Session 069+ carry-over

- ADR-034 / ADR-035 / ADR-036 retrofit (상태 변경 + 의무 필드 추가)
- `checkAdrTemporaryPolicyExpiry()` verify gate 신규
- ADR-005 §"Operational Triggers" 섹션에 임시 ADR 인지 주석 추가 (CRIT-Pγ-2 흡수)

### 향후 임시 정책 ADR (예: ADR-038+)

- 본 ADR template 강제 — root cause 재발 차단

---

## 출처 (Sources)

- Stage E 메타 5-페르소나 P-γ root-cause-analyst (Session 068, 2026-05-12)
- 14 CRIT 매트릭스 통합 보고서: `.claude/reviews/review-20260511-111048-phase2-eval-mvp-session-065-final-integrated.md`
- 5-페르소나 통합 보고서: `.claude/reviews/review-20260512-132500-phase3-launch-chain-5-persona-integrated.md`
- ADR-034 (임시 정책 완화), ADR-035 (PBKDF2 100k), ADR-036 (Cookie SameSite)
- ADR-005 (PBKDF2 600k OWASP) — 영구 ADR 예시

---

**작성**: Claude (Opus 4.7 1M context) — Session 068 Stage E P-γ CRIT-Pγ-1 흡수
**작성 효력**: 2026-05-12 KST (Phase 3 launch chain 종착 시점)
