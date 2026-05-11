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
    // ★ ADR-035: Cloudflare Workers Web Crypto PBKDF2 max=100,000 채택. ADR-005 600k vs Workers 제약 silent drift 해소.
    // Phase 3 launch 직전 Argon2id 또는 외부 hash service 검토 carry-over (ADR-035 §"복원 의무").
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100000);
  });

  /**
   * ★ Session 066 5-Persona C-01 흡수 — bytes ↔ iterations runtime invariant.
   * 임베드된 hash/salt 바이트가 sentinel 평문을 PBKDF2_ITERATIONS 회 반복한
   * 결과와 정확히 일치해야 함. v1(600k) → v2(100k) 전환 또는 미래 v3 복원 시
   * 주석 갱신만 하고 hash bytes 재생성을 누락하면 본 테스트가 실패하여 차단.
   *
   * Pass 1 (Surgeon) C-1 + Pass 2 CRIT-2 + Pass 3 C-1 + Persona 1 MAJOR-2 동일
   * 지적에 대한 단일 회귀 가드.
   */
  it('matches runtime PBKDF2(sentinel, salt, PBKDF2_ITERATIONS) — invariant guard', async () => {
    const fs = await import('node:fs/promises');
    const crypto = await import('node:crypto');
    const src = await fs.readFile(new URL('../dummy-verify.ts', import.meta.url), 'utf-8');

    // sentinel 평문 추출 (`pt = '...'` 패턴, JSDoc 스크립트 영역)
    const ptMatch = src.match(/pt\s*=\s*'(dummy-verify-sentinel-[^']+)'/);
    expect(ptMatch).not.toBeNull();
    const sentinel = ptMatch![1]!;

    // salt 시드 버전 추출 (`|salt|vN` 패턴)
    const saltSeedMatch = src.match(/'\|salt\|(v\d+)'/);
    expect(saltSeedMatch).not.toBeNull();
    const saltVersion = saltSeedMatch![1]!;

    // 임베드된 base64 hash/salt 추출
    const hashMatch = src.match(/hash:\s*'([A-Za-z0-9+/=]+)'/);
    const saltMatch = src.match(/salt:\s*'([A-Za-z0-9+/=]+)'/);
    expect(hashMatch).not.toBeNull();
    expect(saltMatch).not.toBeNull();
    const embeddedHash = Buffer.from(hashMatch![1]!, 'base64');
    const embeddedSalt = Buffer.from(saltMatch![1]!, 'base64');

    // runtime 재생성
    const expectedSalt = crypto
      .createHash('sha256')
      .update(`${sentinel}|salt|${saltVersion}`)
      .digest()
      .subarray(0, PBKDF2_SALT_BYTES);
    const expectedHash = crypto.pbkdf2Sync(
      sentinel,
      expectedSalt,
      PBKDF2_ITERATIONS,
      PBKDF2_HASH_BYTES,
      'sha256',
    );

    // 정합 검증 — 두 바이트 시퀀스가 정확히 일치해야 함
    expect(embeddedSalt.equals(expectedSalt)).toBe(true);
    expect(embeddedHash.equals(expectedHash)).toBe(true);
  });
});
