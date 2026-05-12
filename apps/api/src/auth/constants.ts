/**
 * 인증 모듈 상수 (ADR-005 PBKDF2-SHA256 + HIBP).
 *
 * 하드코딩 0 원칙 (CLAUDE.md). 모든 수치는 명명된 상수로.
 *
 * ★ PASSWORD_MIN_LENGTH / PASSWORD_MAX_LENGTH 는 `@thepick/shared` 로 이관 (C-05).
 *   api/web/future-tooling 모두 shared에서 import. 환경 분기는 `getPasswordMinLength(env)`.
 */

// Re-export shared password 정책 (backward-compat — 기존 import 경로 보존).
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH_RELAXED as PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_STRICT,
  getPasswordMinLength,
  isHibpEnabled,
} from '@thepick/shared';

/**
 * PBKDF2-SHA256 반복 횟수 (ADR-035 — Cloudflare Workers 호환 100k).
 *
 * ★ Cloudflare Workers Web Crypto API 제약: PBKDF2 iterations **상한 100,000**
 * (`NotSupportedError: iteration counts above 100000 are not supported`).
 * → ADR-005 OWASP 2024 600k 권고 vs Workers runtime 제약 충돌 → 100k 채택.
 *
 * 근거:
 *   - ADR-035 §"결정" — Workers 호환 최대 100k 채택 (Phase 2 Eval MVP, Session 065)
 *   - OWASP 2024 권고 미충족 (보안 trade-off 영속) — Phase 3 launch 직전
 *     Argon2id 또는 외부 hash service 검토 carry-over (ADR-035 §"복원 의무")
 *   - 자격증 학습 서비스 특성상 사용자 계정 탈취 시 학습 이력·결제 정보 유출 위험
 *     → 본 100k는 임시. PBKDF2 한계 + Workers runtime 제약 영속 인지 의무.
 *
 * Workers 영향: 약 20~30ms CPU per hash (Paid tier 30s 상한 대비 여유).
 */
export const PBKDF2_ITERATIONS = 100000;

/** Salt 바이트 길이 (128-bit). */
export const PBKDF2_SALT_BYTES = 16;

/** Hash 출력 바이트 길이 (256-bit). */
export const PBKDF2_HASH_BYTES = 32;

/** PBKDF2 hash 알고리즘. Web Crypto API 요구 문자열. */
export const PBKDF2_HASH_ALGORITHM = 'SHA-256' as const;

/** HIBP k-Anonymity API base URL. */
export const HIBP_API_BASE_URL = 'https://api.pwnedpasswords.com/range/';

/** HIBP k-Anonymity: 전송할 해시 prefix 길이 (hex chars). */
export const HIBP_HASH_PREFIX_LENGTH = 5;

/** HIBP API 요청 timeout (ms). ADR-008 §4 Claude API와 동일 정책 차용. */
export const HIBP_REQUEST_TIMEOUT_MS = 3000;
