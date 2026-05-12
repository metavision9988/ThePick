/**
 * 비밀번호 정책 단일 source-of-truth (Phase 3 launch chain C-05).
 *
 * api / web / future-tooling 모두 본 파일에서 import. 하드코딩 금지.
 *
 * 정책 분기 (ADR-034 §"복원 의무" 자동화, Phase 3 launch chain C-03):
 *   - RELAXED (4자) — Phase 2 Eval MVP 임시 (진산 평가 환경 한정, 외부 노출 0)
 *   - STRICT  (8자) — Phase 3 launch 본격 정책 (OWASP + ADR-005 정합)
 *
 * env 분기:
 *   - env.PASSWORD_MIN_LENGTH 미설정 → RELAXED (Phase 2 default)
 *   - env.PASSWORD_MIN_LENGTH = '8' → STRICT (Phase 3 launch 직전 toggle)
 *   - 유효 범위: RELAXED ≤ value ≤ MAX
 *
 * 출처:
 *   - ADR-034 §"복원 의무" 6항목 (`PASSWORD_MIN_LENGTH = 8` 복원)
 *   - docs/plans/phase3-launch-chain.plan.md §3 Stage A
 *   - review-20260511-111048 §2 C-05 (PASSWORD_MIN 3중 source-of-truth)
 */

/**
 * Phase 2 Eval MVP 임시 최소 길이.
 *
 * 진산님 단독 사용 평가 환경. 외부 노출 0. 본격 정책 미충족 인지 의무 (ADR-034).
 */
export const PASSWORD_MIN_LENGTH_RELAXED = 4;

/**
 * Phase 3 launch 본격 최소 길이.
 *
 * OWASP 2024 권고 minimum + ADR-005 (Phase 1 정합) — Phase 3 launch 직전 env 토글.
 */
export const PASSWORD_MIN_LENGTH_STRICT = 8;

/**
 * 비밀번호 최대 길이 (DoS 방어 — PBKDF2 입력 길이 제한).
 *
 * 환경 분기 없음 (정책 일정). PBKDF2 input 한계 + 메모리 방어.
 */
export const PASSWORD_MAX_LENGTH = 1024;

/**
 * 비밀번호 최소 길이 env-based getter (C-03 env 분기 자동화).
 *
 * @param envValue `c.env.PASSWORD_MIN_LENGTH` (Workers env) 또는 동등 값.
 * @returns 유효한 minimum (RELAXED ≤ value ≤ MAX). 미설정/무효 → RELAXED.
 *
 * @example
 *   getPasswordMinLength(undefined)      // 4 (Phase 2 default)
 *   getPasswordMinLength('8')            // 8 (Phase 3 toggle)
 *   getPasswordMinLength('not-a-number') // 4 (fallback to RELAXED)
 *   getPasswordMinLength('0')            // 4 (below floor, fallback to RELAXED)
 */
export function getPasswordMinLength(envValue: string | undefined): number {
  if (envValue === undefined || envValue === '') {
    return PASSWORD_MIN_LENGTH_RELAXED;
  }
  const parsed = Number.parseInt(envValue, 10);
  if (
    !Number.isFinite(parsed) ||
    parsed < PASSWORD_MIN_LENGTH_RELAXED ||
    parsed > PASSWORD_MAX_LENGTH
  ) {
    return PASSWORD_MIN_LENGTH_RELAXED;
  }
  return parsed;
}

/**
 * HIBP k-Anonymity pwned 검사 활성화 여부 env-based getter (C-03 env 분기).
 *
 * Phase 2 Eval MVP: 호출 + logging 보존, 'pwned' 응답 무시 (register 통과).
 * Phase 3 launch: 'pwned' → 422 reject 복원 (ADR-034 §"복원 의무").
 *
 * @param envValue `c.env.HIBP_ENABLED` (Workers env).
 * @returns true ↔ 'true' (literal string, case-insensitive). 그 외 false.
 *
 * @example
 *   isHibpEnabled(undefined) // false (Phase 2 default)
 *   isHibpEnabled('true')    // true (Phase 3 toggle)
 *   isHibpEnabled('TRUE')    // true
 *   isHibpEnabled('1')       // false (strict literal match)
 */
export function isHibpEnabled(envValue: string | undefined): boolean {
  return typeof envValue === 'string' && envValue.toLowerCase() === 'true';
}
