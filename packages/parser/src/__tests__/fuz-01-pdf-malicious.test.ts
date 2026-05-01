/**
 * FUZ-01 — 악의적 PDF 5종 graceful 분류 거부 + subprocess zombie 0건
 *
 * Sprint 1 §5.3 NOT-IMPL P0 시나리오 신규 구현.
 * 근거 문서:
 *   - `packages/parser/__fixtures__/pdf-malicious/README.md` (fixture 의도 + 분류)
 *   - `docs/quality/test-patterns.md` §4 (fixtures 위치)
 *   - `.jjokjipge/handoff-session-030.md` §2.A (시나리오 명세)
 *
 * 검증 invariants:
 *   - 각 fixture 가 정확한 PdfErrorClassification 으로 throw
 *   - 모든 거부 후 active subprocess === 0 (zombie 검증)
 *   - subprocess 미호출 (사전 거부 vector) — 카운터가 한 번도 증가하지 않음
 */

import { describe, it, expect, afterEach } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractPdf,
  getActivePdfSubprocessCount,
  PdfParseError,
  type PdfErrorClassification,
} from '../index';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '../../__fixtures__/pdf-malicious');

interface MaliciousFixture {
  file: string;
  classification: PdfErrorClassification;
  description: string;
}

const FIXTURES: readonly MaliciousFixture[] = [
  {
    file: '01-empty.pdf',
    classification: 'EMPTY_INPUT',
    description: '0 byte file → stat 단계 거부, subprocess 미호출',
  },
  {
    file: '02-header-only.pdf',
    classification: 'MALFORMED_HEADER',
    description: '%PDF-1.4 만 존재 + body / xref / trailer 부재',
  },
  {
    file: '03-compression-bomb.pdf',
    classification: 'COMPRESSION_BOMB',
    description: '/Length 100MB lie + 1.4KB 실 파일 — decompression ratio >100x',
  },
  {
    file: '04-malformed-xref.pdf',
    classification: 'MALFORMED_XREF',
    description: 'startxref 9999999999 — 파일 크기 (336 B) 초과',
  },
  {
    file: '05-js-embedded.pdf',
    classification: 'JS_EMBEDDED',
    description: '/OpenAction /S /JavaScript /JS auto-exec 차단',
  },
] as const;

describe('FUZ-01 — 악의적 PDF 5종 graceful 분류 거부', () => {
  afterEach(() => {
    // 매 테스트 후 zombie 0건 invariant 검증 — 한 fixture 가 미정리 시 다음 테스트 오염 방지
    expect(getActivePdfSubprocessCount()).toBe(0);
  });

  for (const { file, classification, description } of FIXTURES) {
    it(`rejects ${file} as ${classification} — ${description}`, async () => {
      const path = resolve(FIXTURE_DIR, file);

      // 사전 카운터 snapshot — 본 테스트 호출 전 active subprocess 이미 0 이어야
      const before = getActivePdfSubprocessCount();
      expect(before).toBe(0);

      await expect(extractPdf(path)).rejects.toBeInstanceOf(PdfParseError);
      await expect(extractPdf(path)).rejects.toMatchObject({
        classification,
        name: 'PdfParseError',
      });

      // 거부 후 active subprocess 0 — pre-flight 단계 거부 = subprocess 미호출
      expect(getActivePdfSubprocessCount()).toBe(0);
    });
  }

  it('PdfParseError metadata 가 pdfPath 포함 (debugging trail)', async () => {
    const path = resolve(FIXTURE_DIR, '01-empty.pdf');
    try {
      await extractPdf(path);
      // unreachable — 위 expect 가 throw 보장
      throw new Error('extractPdf did not reject for empty fixture');
    } catch (err) {
      expect(err).toBeInstanceOf(PdfParseError);
      const pdfErr = err as PdfParseError;
      expect(pdfErr.classification).toBe('EMPTY_INPUT');
      expect(pdfErr.metadata.pdfPath).toBe(path);
      expect(pdfErr.metadata.fileSize).toBe(0);
    }
  });

  it('5종 fixtures 일괄 거부 후 zombie 0건 (누적 검증)', async () => {
    expect(getActivePdfSubprocessCount()).toBe(0);

    const results = await Promise.allSettled(
      FIXTURES.map(({ file }) => extractPdf(resolve(FIXTURE_DIR, file))),
    );

    // 모두 reject 되어야 함
    expect(results.every((r) => r.status === 'rejected')).toBe(true);

    // 분류 검증 — 각 fixture 의 expected classification 매칭
    for (let i = 0; i < FIXTURES.length; i++) {
      const r = results[i];
      expect(r.status).toBe('rejected');
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(PdfParseError);
        expect((r.reason as PdfParseError).classification).toBe(FIXTURES[i].classification);
      }
    }

    // 5종 동시 거부 후 active subprocess 누적 0 — pre-flight 단계 거부 = subprocess 미호출
    expect(getActivePdfSubprocessCount()).toBe(0);
  });
});
