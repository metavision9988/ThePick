/**
 * 인증 모듈 상수 (ADR-005 PBKDF2-SHA256 + HIBP).
 *
 * 하드코딩 0 원칙 (CLAUDE.md). 모든 수치는 명명된 상수로.
 */

/**
 * OWASP 2024 PBKDF2-SHA256 최소 반복 횟수 (ADR-005).
 *
 * 근거:
 *   - OWASP Password Storage Cheat Sheet (2024 rev) — PBKDF2-SHA256: 600,000
 *   - ADR-005 본문 "Iterations: 600,000" 준수
 *   - 자격증 학습 서비스 특성상 사용자 계정 탈취 시 학습 이력·결제 정보 유출
 *     → 서버 CPU 부담 감수하고 엄격 적용
 *
 * Workers 영향: 약 100~150ms CPU per hash (Paid tier 30s 상한 대비 여유).
 */
export const PBKDF2_ITERATIONS = 600000;

/** Salt 바이트 길이 (128-bit). */
export const PBKDF2_SALT_BYTES = 16;

/** Hash 출력 바이트 길이 (256-bit). */
export const PBKDF2_HASH_BYTES = 32;

/** PBKDF2 hash 알고리즘. Web Crypto API 요구 문자열. */
export const PBKDF2_HASH_ALGORITHM = 'SHA-256' as const;

/** 비밀번호 최소 길이. */
export const PASSWORD_MIN_LENGTH = 8;

/** 비밀번호 최대 길이 (DoS 방어 — PBKDF2 입력 길이 제한). */
export const PASSWORD_MAX_LENGTH = 1024;

/** HIBP k-Anonymity API base URL. */
export const HIBP_API_BASE_URL = 'https://api.pwnedpasswords.com/range/';

/** HIBP k-Anonymity: 전송할 해시 prefix 길이 (hex chars). */
export const HIBP_HASH_PREFIX_LENGTH = 5;

/** HIBP API 요청 timeout (ms). ADR-008 §4 Claude API와 동일 정책 차용. */
export const HIBP_REQUEST_TIMEOUT_MS = 3000;
