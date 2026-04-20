/**
 * 인증 모듈 타입 (L3 Fortress 계약).
 */

/**
 * PBKDF2 해시 결과. D1 users 테이블 저장 포맷 대응.
 * - hash: Base64(32 bytes)
 * - salt: Base64(16 bytes)
 * - iterations: 정수 (검증 시 저장값 사용, 업그레이드 추적 가능)
 */
export interface PasswordHashResult {
  readonly hash: string;
  readonly salt: string;
  readonly iterations: number;
}

/** 비밀번호 검증 결과. OWASP timing attack 대응 — 이유는 항상 generic. */
export interface PasswordVerifyResult {
  readonly valid: boolean;
}

/** HIBP Pwned Passwords 응답. */
export type PwnedStatus = 'pwned' | 'safe' | 'unavailable';

export interface PwnedResult {
  readonly status: PwnedStatus;
  /** HIBP 유출 횟수. status='pwned' 시에만 의미. */
  readonly count: number;
}

/**
 * 회원가입 요청 페이로드.
 * @see apps/api/src/auth/routes.ts — Zod 검증
 */
export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
}

/** 로그인 요청 페이로드. */
export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}
