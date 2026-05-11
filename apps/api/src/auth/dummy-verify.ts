/**
 * Timing Side-Channel 방어용 더미 verifyPassword 수행 (4-Pass 리뷰 C-1).
 *
 * 목적: `/login` 에서 email 없음(row === null) 경로와 email 있음 + password 불일치
 * 경로의 응답 시간을 동일하게 맞춰 사용자 계정 존재 여부 식별 공격을 차단한다.
 *
 * 전략: 고정된 더미 PasswordHashResult 로 `verifyPassword` 를 실제 호출하여
 * PBKDF2 PBKDF2_ITERATIONS 반복 + 상수시간 비교의 CPU 시간을 소비. 결과는 항상 무시.
 *
 * 더미 해시는 빌드 시점에 한 번 생성된 고정 상수. 실제 사용자 데이터와 무관.
 *
 * ADR-035 (Workers Web Crypto PBKDF2 max=100,000) 적용 후 v1 (600k) → v2 (100k) 재생성.
 * Phase 3 launch 직전 600k 복원 시 v3 재생성 의무 (위 스크립트 `|v2` → `|v3`).
 */

import { PBKDF2_ITERATIONS } from './constants.js';
import { verifyPassword } from './password.js';
import type { PasswordHashResult } from './types.js';

/**
 * 고정 더미 해시. 실제 PBKDF2-SHA256 `PBKDF2_ITERATIONS` 반복 산출물.
 *
 * 생성 절차 (결정론적, 재생성 가능):
 *
 * ```sh
 * node -e "
 *   const c = require('crypto');
 *   const pt = 'dummy-verify-sentinel-v2-do-not-use-for-real-accounts';
 *   const salt = c.createHash('sha256').update(pt + '|salt|v2').digest().subarray(0, 16);
 *   const hash = c.pbkdf2Sync(pt, salt, 100000, 32, 'sha256');
 *   console.log(salt.toString('base64'), hash.toString('base64'));
 * "
 * ```
 *
 * sentinel 평문은 register 진입 경로와 무관 (이 해시는 DB 에 저장되지 않고
 * timing 소비용 verify 만 수행, 결과는 무시). 실사용자와 충돌해도 무해.
 *
 * 중요:
 *   - `iterations` 를 현재 `PBKDF2_ITERATIONS` 와 **반드시** 동일하게 유지.
 *   - 상수 변경 시 본 값 재생성 필수 (위 스크립트의 `|v2` 를 `|v3` 으로 바꾼 후 재실행).
 *   - bytes ↔ iterations runtime 정합은 `__tests__/dummy-verify.test.ts` 의
 *     "matches runtime PBKDF2(sentinel, salt, PBKDF2_ITERATIONS)" 회귀 테스트가 검증
 *     (Session 066 5-Persona C-01 흡수). 정합 깨지면 silent drift 차단.
 *   - all-zero 해시(이전 구현) 와 달리 실제 PBKDF2 분포를 가지므로 cache line /
 *     branch predictor 기반 통계 구분 공격 경로 차단 (4-Pass Devil's Advocate #1).
 */
const DUMMY_HASH: PasswordHashResult = {
  // base64 decoded bytes — PBKDF2-SHA256(sentinel_v2, salt_v2, 100000, 32)
  hash: 'p3RQdn6Fvddl1x9B14c091jGR8nV9siBCOtiQJz3/Xs=',
  // base64 decoded bytes — SHA-256(sentinel_v2 + '|salt|v2')[0:16]
  salt: 'rns7CY0gTNvB/SVYZ0jToQ==',
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
