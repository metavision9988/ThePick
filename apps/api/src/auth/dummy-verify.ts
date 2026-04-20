/**
 * Timing Side-Channel 방어용 더미 verifyPassword 수행 (4-Pass 리뷰 C-1).
 *
 * 목적: `/login` 에서 email 없음(row === null) 경로와 email 있음 + password 불일치
 * 경로의 응답 시간을 동일하게 맞춰 사용자 계정 존재 여부 식별 공격을 차단한다.
 *
 * 전략: 고정된 더미 PasswordHashResult 로 `verifyPassword` 를 실제 호출하여
 * PBKDF2 600k 반복 + 상수시간 비교의 CPU 시간을 소비. 결과는 항상 무시.
 *
 * 더미 해시는 빌드 시점에 한 번 생성된 고정 상수. 실제 사용자 데이터와 무관.
 */

import { PBKDF2_ITERATIONS } from './constants.js';
import { verifyPassword } from './password.js';
import type { PasswordHashResult } from './types.js';

/**
 * 고정 더미 해시. 생성 스크립트:
 *
 * ```ts
 * const r = await hashPassword('dummy-password-for-timing-defense-only');
 * ```
 *
 * Base64 문자열로 임베드. 실사용 비밀번호와 일치할 확률 2^-256. PBKDF2 검증은
 * 항상 false 를 반환하므로 로직상 영향 없고 timing 만 소비.
 *
 * 주의: `iterations` 를 현재 `PBKDF2_ITERATIONS` 와 **반드시** 동일하게 유지.
 * 상수 변경 시 본 상수도 재생성 필요. 트리거(users.password_iterations 하한)
 * 과는 무관 (본 해시는 DB 에 저장되지 않음).
 */
const DUMMY_HASH: PasswordHashResult = {
  hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
  iterations: PBKDF2_ITERATIONS,
};

/**
 * 주어진 평문으로 더미 해시 검증을 수행한다. 결과는 항상 false 이며 호출 측은
 * 반환값을 사용하지 않는다. 오직 timing 소비 목적.
 */
export async function performDummyVerify(plaintext: string): Promise<void> {
  const result = await verifyPassword(plaintext, DUMMY_HASH);
  // 결과는 의도적으로 무시 — timing 평탄화만이 목적
  void result;
}
