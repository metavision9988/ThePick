/**
 * log-redact.ts 단위 테스트 — Pass 3 M1 흡수 (Session 059).
 *
 * 검증:
 *   - query 평문 절대 미반환 (length + hash 만)
 *   - 동일 query → 동일 hash (deterministic)
 *   - 다른 query → 다른 hash (충돌 회피)
 *   - hash 형식 (12-hex 소문자)
 *   - length = query.length (UTF-16 code unit, 한글 NFC 1자=1)
 *   - 빈 문자열 / 매우 긴 query 처리
 */

import { describe, expect, it } from 'vitest';
import { digestQueryForLog } from '../log-redact.js';

describe('digestQueryForLog', () => {
  it('동일 query → 동일 hash (deterministic)', async () => {
    const a = await digestQueryForLog('표본주수 산정 기준');
    const b = await digestQueryForLog('표본주수 산정 기준');
    expect(a.hash).toBe(b.hash);
  });

  it('다른 query → 다른 hash (충돌 회피)', async () => {
    const a = await digestQueryForLog('표본주수 산정 기준');
    const b = await digestQueryForLog('표본주수 산정 방법');
    expect(a.hash).not.toBe(b.hash);
  });

  it('length = query.length', async () => {
    const q = '한글 5단어 질문';
    const d = await digestQueryForLog(q);
    expect(d.length).toBe(q.length);
  });

  it('hash 형식: 12 hex chars 소문자', async () => {
    const d = await digestQueryForLog('test');
    expect(d.hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('빈 문자열 처리 (length=0, hash 정상)', async () => {
    const d = await digestQueryForLog('');
    expect(d.length).toBe(0);
    expect(d.hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('500자 max 길이 처리', async () => {
    const q = 'a'.repeat(500);
    const d = await digestQueryForLog(q);
    expect(d.length).toBe(500);
    expect(d.hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('query 평문이 반환 객체에 포함되지 않음 (정책 검증)', async () => {
    const sensitive = '내 계좌번호는 123-456-789입니다';
    const d = await digestQueryForLog(sensitive);
    const serialized = JSON.stringify(d);
    expect(serialized).not.toContain('123-456-789');
    expect(serialized).not.toContain('계좌번호');
    expect(serialized).not.toContain(sensitive);
  });

  it('SHA-256 known vector 정합 (테스트 reproducibility)', async () => {
    // SHA-256("test") = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    // first 6 bytes (12 hex) = 9f 86 d0 81 88 4c
    const d = await digestQueryForLog('test');
    expect(d.hash).toBe('9f86d081884c');
  });
});
