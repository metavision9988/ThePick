import { describe, expect, it } from 'vitest';
import { PBKDF2_HASH_BYTES, PBKDF2_ITERATIONS, PBKDF2_SALT_BYTES } from '../constants.js';
import { performDummyVerify } from '../dummy-verify.js';

/**
 * DUMMY_HASH 는 모듈 내부 private 상수. 직접 접근 대신 performDummyVerify 의
 * 관측 가능한 동작(항상 undefined 반환, 항상 실행 완료)을 검증하고, 파일 원문에
 * 임베드된 base64 바이트 길이 정합을 static 검증한다.
 */
describe('performDummyVerify', () => {
  it('returns undefined for any plaintext (result is always discarded)', async () => {
    const result = await performDummyVerify('any-password');
    expect(result).toBeUndefined();
  });

  it('completes without throwing for short plaintext', async () => {
    await expect(performDummyVerify('a')).resolves.toBeUndefined();
  });

  it('completes without throwing for empty plaintext', async () => {
    await expect(performDummyVerify('')).resolves.toBeUndefined();
  });

  it('completes without throwing for very long plaintext', async () => {
    const long = 'x'.repeat(1024);
    await expect(performDummyVerify(long)).resolves.toBeUndefined();
  });

  it('takes measurable CPU time (timing parity with real verifyPassword)', async () => {
    // PBKDF2 600k 반복은 Workers/Node 에서 수십 ms 소요. 1ms 미만이면 verify 가
    // 실제로 실행되지 않고 early-return 한 것 — 원래 목적(timing 소비) 미달성.
    const started = performance.now();
    await performDummyVerify('dummy-timing-measure-input');
    const elapsed = performance.now() - started;
    // 환경별 변동폭이 크므로 하한만 보수적으로 확인 (10ms).
    // Workers Free/Paid 실측 범위: 40~250ms.
    expect(elapsed).toBeGreaterThan(10);
  });
});

/**
 * DUMMY_HASH 상수 무결성 검증: 파일 원문의 base64 문자열이 PBKDF2 산출물과
 * 동일한 바이트 길이(32 / 16) 를 가지는지 확인. all-zero 패턴으로 회귀 방지.
 */
describe('DUMMY_HASH embedded constant', () => {
  it('hash base64 decodes to exactly PBKDF2_HASH_BYTES', async () => {
    const mod = await import('../dummy-verify.js');
    // private 상수 접근 우회: 모듈 소스 읽어 파싱.
    // Vitest 는 fs 허용. 실패 시 런타임 오류로 가드.
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(new URL('../dummy-verify.ts', import.meta.url), 'utf-8');
    const hashMatch = src.match(/hash:\s*'([A-Za-z0-9+/=]+)'/);
    expect(hashMatch).not.toBeNull();
    const decoded = Buffer.from(hashMatch![1]!, 'base64');
    expect(decoded.byteLength).toBe(PBKDF2_HASH_BYTES);
    // all-zero 회귀 방지 — 이전 구현은 전부 0 이었음.
    const allZero = decoded.every((b) => b === 0);
    expect(allZero).toBe(false);
    // mod 참조: unused import 경고 방지 + 모듈 로드 확인.
    expect(mod.performDummyVerify).toBeTypeOf('function');
  });

  it('salt base64 decodes to exactly PBKDF2_SALT_BYTES', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(new URL('../dummy-verify.ts', import.meta.url), 'utf-8');
    const saltMatch = src.match(/salt:\s*'([A-Za-z0-9+/=]+)'/);
    expect(saltMatch).not.toBeNull();
    const decoded = Buffer.from(saltMatch![1]!, 'base64');
    expect(decoded.byteLength).toBe(PBKDF2_SALT_BYTES);
    const allZero = decoded.every((b) => b === 0);
    expect(allZero).toBe(false);
  });

  it('iterations equals current PBKDF2_ITERATIONS (downgrade defense)', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(new URL('../dummy-verify.ts', import.meta.url), 'utf-8');
    // 소스에 리터럴 숫자가 박혀있으면 경고 (PBKDF2_ITERATIONS 상수 경유만 허용).
    expect(src).toContain('iterations: PBKDF2_ITERATIONS');
    // 상수가 ADR-005 최소값 600000 을 충족하는지 재확인.
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600000);
  });
});
