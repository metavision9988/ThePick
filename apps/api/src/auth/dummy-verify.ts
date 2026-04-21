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
 * 고정 더미 해시. 실제 PBKDF2-SHA256 600,000 반복 산출물 (Step 1-1 M-dummy-hash 해소).
 *
 * 생성 절차 (결정론적, 재생성 가능):
 *
 * ```sh
 * node -e "
 *   const c = require('crypto');
 *   const pt = 'dummy-verify-sentinel-v1-do-not-use-for-real-accounts';
 *   const salt = c.createHash('sha256').update(pt + '|salt|v1').digest().subarray(0, 16);
 *   const hash = c.pbkdf2Sync(pt, salt, 600000, 32, 'sha256');
 *   console.log(salt.toString('base64'), hash.toString('base64'));
 * "
 * ```
 *
 * sentinel 평문은 Zod `loginSchema.password.min(PASSWORD_MIN_LENGTH)` 및 register
 * email 검증을 통과하지 못하는 패턴이 아니지만, 실사용자와 충돌해도 무해 (이 해시는
 * DB 에 저장되지 않고 timing 소비용 verify 만 수행, 결과는 무시).
 *
 * 중요:
 *   - `iterations` 를 현재 `PBKDF2_ITERATIONS` 와 **반드시** 동일하게 유지.
 *   - 상수 변경 시 본 값 재생성 필요 (위 스크립트의 `|v1` 을 `|v2` 로 바꾼 후 재실행).
 *   - all-zero 해시(이전 구현) 와 달리 실제 PBKDF2 분포를 가지므로 cache line /
 *     branch predictor 기반 통계 구분 공격 경로 차단 (4-Pass Devil's Advocate #1).
 */
const DUMMY_HASH: PasswordHashResult = {
  // base64 decoded bytes — PBKDF2-SHA256(sentinel, salt, 600000, 32)
  hash: 'HuUFGOloapz0iDvU53eQP5rSR6ps7nGmoERaGosE9dM=',
  // base64 decoded bytes — SHA-256(sentinel + '|salt|v1')[0:16]
  salt: '3OGQW6Rmw7USUH6nDsSQVg==',
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
