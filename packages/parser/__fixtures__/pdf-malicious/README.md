# PDF Malicious Fixtures — FUZ-01

> Sprint 1 §5.2 도구 정비 (handoff-029 §2.A) 산출물.
> P0 시나리오 **FUZ-01 — 악의적 PDF 5종** 신규 구현 시 사용.

---

## 1. 목적

`packages/parser/src/pdf-extractor.ts` 가 다음 5 vectors 에 대해 **graceful 분류 실패** (= `PdfParseError(<분류>)` throw) 하는지 검증한다. **subprocess zombie 0건** 도 동시 검증 의무 (Mephisto 예언 #3 적중 사항).

| 파일                               | 분류                      | 검증 대상                                                                |
| :--------------------------------- | :------------------------ | :----------------------------------------------------------------------- |
| `01-empty.pdf` (0 B)               | `EMPTY_INPUT`             | 0 바이트 입력 즉시 거부, subprocess 미호출                               |
| `02-header-only.pdf` (9 B)         | `MALFORMED_HEADER`        | `%PDF-1.4` 만 존재, body / xref / trailer 부재 → 파싱 진입 전 차단       |
| `03-compression-bomb.pdf` (1.4 KB) | `COMPRESSION_BOMB`        | `/Length 100MB` lie + `/Filter /FlateDecode` — 실제 deflate 진행 전 거부 |
| `04-malformed-xref.pdf` (336 B)    | `MALFORMED_XREF`          | xref 오프셋이 파일 크기 초과 (9999999999 byte) — pdfplumber 호출 불필요  |
| `05-js-embedded.pdf` (449 B)       | `JS_EMBEDDED` (보안 거부) | `/OpenAction /S /JavaScript` 자동 실행 — 보안 검사 단계에서 차단         |

---

## 2. 각 fixture 의 의도

### 2.1 `01-empty.pdf` (0 바이트)

**목적**: 파일 시스템 차원에서 0 바이트 입력 시 pdfplumber subprocess 호출 자체를 차단하는지 검증.

**예상 동작**:

- pdf-extractor.ts 가 `stat()` 또는 `readFile()` 후 `bytes.length === 0` 즉시 `PdfParseError('EMPTY_INPUT')` throw.
- subprocess 미생성 → zombie 0건.

**예상 안티패턴 (탐지 의무)**:

- Subprocess 가 빈 stdin 받고 hang → timeout 의존 부적절 (latency 낭비).
- `try { ... } catch { return null; }` 형태 silent 실패.

### 2.2 `02-header-only.pdf` (9 바이트, `%PDF-1.4\n`)

**목적**: PDF signature 만 존재하고 객체 / xref 부재 시 pdfplumber 의 NoneType / xref-not-found 에러를 우리 분류로 변환하는지 검증.

**예상 동작**:

- pdfplumber stderr 에 "No /Root object" / "Invalid xref" 등이 나옴.
- pdf-extractor.ts 가 stderr pattern matching 으로 `PdfParseError('MALFORMED_HEADER')` 또는 `PdfParseError('NO_XREF')` 분류.

### 2.3 `03-compression-bomb.pdf` (1.4 KB → claimed 100 MB)

**목적**: deflate 압축 비율이 비정상으로 높을 때 (1MB zeros → ~1KB compressed → /Length 100MB 선언) **실제 decompress 진행 전 거부** 하는지 검증.

**예상 동작**:

- pdf-extractor.ts pre-flight check 단계에서 `/Length` 와 stream 실제 크기 비율 검사.
- 비율 > MAX_DECOMPRESSION_RATIO (예: 100:1) 시 `PdfParseError('COMPRESSION_BOMB')` throw.
- subprocess 호출 미발생.

**위험 회귀 (탐지 의무)**:

- 본 fixture 의 selected `/Length 100MB` 가 거짓이지만, parser 가 그대로 신뢰하면 실제 메모리 100MB 할당 시도 → OOM.
- Cloudflare Workers 메모리 한도 (128 MB) 초과 = Worker kill.

### 2.4 `04-malformed-xref.pdf` (336 B)

**목적**: xref 테이블의 오프셋 값이 파일 크기를 초과 (9999999999 byte 위치 참조) 할 때 pdf-extractor 의 graceful 분류.

**예상 동작**:

- pdfplumber 가 "invalid xref offset" / "seek beyond EOF" 에러 stderr 출력.
- pdf-extractor.ts 가 `PdfParseError('MALFORMED_XREF')` 분류.
- 파일 ID / fixture path 가 에러 message 에 포함 (debugging trail).

### 2.5 `05-js-embedded.pdf` (449 B)

**목적**: `/OpenAction /S /JavaScript /JS (app.alert('XSS-via-PDF'))` 형태로 PDF 가 자동 JavaScript 실행을 요청할 때 **보안 거부**.

**예상 동작**:

- pdf-extractor.ts 가 `/JavaScript` keyword scan (정규식) 후 `PdfParseError('JS_EMBEDDED')` 분류.
- 또는 pdfplumber sandbox 단계에서 자동 실행 차단 (현 정책: 모든 `/JavaScript` PDF 거부).

**위험 회귀 (탐지 의무)**:

- pdfplumber 가 native browser 처럼 JS 실행하면 안 되지만, 일부 변종은 자동 trigger 가능 → 본 fixture 의 의도가 발휘되지 않으면 보안 정책 누락 신호.

---

## 3. 사용 방법 (예시 테스트)

```typescript
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

import { extractPdf } from '../src/pdf-extractor.js';
import { PdfParseError } from '../src/errors.js';

const FIXTURE_DIR = resolve(__dirname, '../__fixtures__/pdf-malicious');

describe('FUZ-01 — 악의적 PDF 5종', () => {
  const cases: Array<{ file: string; classification: string }> = [
    { file: '01-empty.pdf', classification: 'EMPTY_INPUT' },
    { file: '02-header-only.pdf', classification: 'MALFORMED_HEADER' },
    { file: '03-compression-bomb.pdf', classification: 'COMPRESSION_BOMB' },
    { file: '04-malformed-xref.pdf', classification: 'MALFORMED_XREF' },
    { file: '05-js-embedded.pdf', classification: 'JS_EMBEDDED' },
  ];

  for (const { file, classification } of cases) {
    it(`rejects ${file} as ${classification}`, async () => {
      const path = resolve(FIXTURE_DIR, file);
      await expect(extractPdf(path)).rejects.toThrow(PdfParseError);
      await expect(extractPdf(path)).rejects.toMatchObject({ classification });
    });
  }

  it('subprocess zombie 0건 — 모든 거부 후 active subprocess === 0', async () => {
    // pgrep / proc 카운트 검증 (linux 한정)
    // 실제 구현 시 ps -ef | grep pdfplumber | wc -l 또는 process tracker
  });
});
```

---

## 4. 본 fixtures 의 한계 (정직)

1. **합성 PDF**: 실제 악의적 PDF 의 모든 vector 를 커버하지 않는다. 실제 운영 시 악성 PDF 는 더 정교할 수 있다.
2. **subprocess zombie 검증**: 본 fixtures 자체로는 subprocess 동작을 보장하지 않는다. **테스트 코드** 가 process tracker 로 별도 검증 의무.
3. **JS embedded 의 실행 가능성**: 본 fixture 는 `app.alert()` 호출이지만, 실제 PDF reader 외부에서는 무해. **pdfplumber 가 자동 실행하지 않음** = 본 검증의 목적이 분류 / 보안 거부 자체.
4. **압축 폭탄 검증의 한계**: 본 fixture 는 DEFLATE 만 다룬다. PDF 의 다른 필터 (LZW / ASCII85) 는 별도 fixtures 로 확장 필요 (P1 이상).

---

## 5. fixture 추가 / 변경 시 의무

본 디렉토리 fixture 변경 시:

1. 본 README 의 §1 / §2 표 갱신 의무.
2. Sprint 1 §5.4 / §5.3 테스트 코드 동시 갱신 (회귀 방어).
3. PR 에 fixture 의 **의도** + **검증 방법** 명시.
4. 4-Pass 리뷰 시 본 fixtures 의 분류 정합성 확인.

---

**작성**: Claude (Opus 4.7 1M context) — Sprint 1 §5.2 / Session 029
**작성일**: 2026-05-02
**FUZ-01 본격 구현**: handoff-030 §5.3 (Sprint 1 §5.3) 시점
