/**
 * M01 PDF Text Extractor
 *
 * TypeScript wrapper for pdfplumber Python subprocess.
 * Workers 내부 X — 로컬/CI 빌드 파이프라인에서만 실행.
 *
 * Sprint 1 §5.3 FUZ-01 — pre-flight byte scan (악의적 PDF 5종 graceful 분류 거부).
 * subprocess 미호출 vector 는 zombie 0건 보장. subprocess 호출 경로는
 * `getActivePdfSubprocessCount` 로 추적.
 */

import { execFile } from 'node:child_process';
import { stat, open } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError, ErrorCode } from '@thepick/shared';
import { PdfParseError, type PdfErrorClassification } from './errors';

// --- Types ---

export interface ExtractedPage {
  page: number;
  text: string;
  tables: string[][][];
}

export interface ExtractionResult {
  file: string;
  totalPages: number;
  extractedPages: number;
  pages: ExtractedPage[];
  warnings?: string[];
}

export interface ExtractOptions {
  /** Page range: "1-10" or "5" (validated: digits and optional dash only) */
  pages?: string;
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  /**
   * Maximum bytes to read for pre-flight byte scan (default 50 MB).
   * Files larger than this are stat-checked only; signature scan still runs
   * over the first 50 MB which covers compression bomb / JS / xref declarations.
   */
  preflightMaxBytes?: number;
}

// --- Implementation ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, '..', 'scripts', 'extract_pdf.py');
const PYTHON_PATH = resolve(__dirname, '..', '.venv', 'bin', 'python3');
const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PREFLIGHT_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
/**
 * Hard ceiling — PDF 파일 크기 절대 한도. 본 한도 초과 시 사전 거부 (4-Pass §5.3 C-4).
 * sparse 파일 / OOM 공격 차단. 200 MB 는 정상 교재 합본 PDF 의 5x 마진.
 */
const HARD_FILE_SIZE_LIMIT = 200 * 1024 * 1024; // 200 MB
/** Tail scan window — %%EOF / startxref 검사용 마지막 N bytes */
const TAIL_SCAN_BYTES = 1024;

/**
 * Compression bomb threshold — declared `/Length` exceeding actual file size by
 * this ratio is treated as malicious. Real-world PDF deflate ratio 5~20:1.
 */
const MAX_DECOMPRESSION_RATIO = 100;

/** Minimum bytes a structurally valid PDF can occupy (signature + trailer). */
const MIN_PDF_BYTES = 100;

/** PDF signature: "%PDF-" */
const PDF_SIGNATURE = Buffer.from('%PDF-', 'latin1');

/** Pages format: "N" or "N-M" only */
const PAGES_RE = /^\d+(-\d+)?$/;

// --- Subprocess tracker (zombie 0건 검증) ---

let activeSubprocessCount = 0;

/**
 * Count of currently running pdfplumber subprocesses.
 * FUZ-01 검증: 모든 거부 후 0 (사전 거부 vectors) / 정상 종료 후 0.
 */
export function getActivePdfSubprocessCount(): number {
  return activeSubprocessCount;
}

// --- Pre-flight byte scan ---

/**
 * 사전 byte scan — subprocess 호출 전 5종 악의적 PDF 차단.
 *
 * 1. file size 0 → EMPTY_INPUT
 * 2. file size < MIN_PDF_BYTES → MALFORMED_HEADER
 * 3. %PDF- signature 부재 → MALFORMED_HEADER
 * 4. tail %%EOF 부재 → MALFORMED_HEADER (header-only / truncated)
 * 5. /JavaScript or /S /JavaScript action → JS_EMBEDDED
 * 6. startxref offset > file size → MALFORMED_XREF
 * 7. /Length 선언이 파일 크기 대비 100x 초과 → COMPRESSION_BOMB
 *
 * 모든 vector subprocess 호출 전 거부 → zombie 0건 보장.
 */
async function preflightPdfChecks(pdfPath: string, preflightMaxBytes: number): Promise<void> {
  // stat / 파일 핸들 fs error → PdfParseError 분류 (4-Pass §5.3 MAJOR-1 흡수)
  let fileSize: number;
  try {
    const stats = await stat(pdfPath);
    fileSize = stats.size;
  } catch (err) {
    throw new PdfParseError('PDF_PARSE_FAILED', `Cannot stat PDF: ${(err as Error).message}`, {
      pdfPath,
    });
  }

  if (fileSize === 0) {
    throw new PdfParseError('EMPTY_INPUT', `Empty PDF file (0 bytes): ${pdfPath}`, {
      pdfPath,
      fileSize: 0,
    });
  }

  if (fileSize < MIN_PDF_BYTES) {
    throw new PdfParseError(
      'MALFORMED_HEADER',
      `PDF too small to be valid (${fileSize} bytes < ${MIN_PDF_BYTES} bytes minimum)`,
      { pdfPath, fileSize },
    );
  }

  // Hard ceiling — sparse / OOM 공격 차단 (4-Pass §5.3 C-4)
  if (fileSize > HARD_FILE_SIZE_LIMIT) {
    throw new PdfParseError(
      'PDF_PARSE_FAILED',
      `PDF too large (${fileSize} bytes > ${HARD_FILE_SIZE_LIMIT} hard limit) — sparse file / OOM protection`,
      { pdfPath, fileSize },
    );
  }

  // 부분 read — head (preflightMaxBytes) + tail (1KB) 만 메모리 적재.
  // 전체 readFile 우회로 sparse 10GB 공격 / 정상 100MB 교재 합본 OOM 방지.
  const headSize = Math.min(fileSize, preflightMaxBytes);
  const tailSize = Math.min(fileSize, TAIL_SCAN_BYTES);
  const headBuf = Buffer.alloc(headSize);
  const tailBuf = Buffer.alloc(tailSize);
  let fd;
  try {
    fd = await open(pdfPath, 'r');
    await fd.read(headBuf, 0, headSize, 0);
    if (fileSize > headSize) {
      // tail 이 head 와 겹치지 않을 때만 별도 read
      await fd.read(tailBuf, 0, tailSize, fileSize - tailSize);
    } else {
      // 작은 파일 — head 의 끝부분이 곧 tail
      headBuf.copy(tailBuf, 0, fileSize - tailSize, fileSize);
    }
  } catch (err) {
    throw new PdfParseError('PDF_PARSE_FAILED', `Cannot read PDF: ${(err as Error).message}`, {
      pdfPath,
      fileSize,
    });
  } finally {
    if (fd) await fd.close();
  }

  // %PDF- signature (파일 시작)
  if (!headBuf.subarray(0, 8).includes(PDF_SIGNATURE)) {
    throw new PdfParseError('MALFORMED_HEADER', `Missing %PDF- signature: ${pdfPath}`, {
      pdfPath,
      fileSize,
    });
  }

  // tail %%EOF (마지막 1KB 윈도우)
  if (!tailBuf.includes(Buffer.from('%%EOF', 'latin1'))) {
    throw new PdfParseError(
      'MALFORMED_HEADER',
      `Missing %%EOF trailer (header-only or truncated PDF): ${pdfPath}`,
      { pdfPath, fileSize },
    );
  }

  // PDF binary 는 latin1 안전 (UTF-8 변환 시 binary 손상). head + tail 결합.
  // tail 이 head 안에 이미 포함된 작은 파일은 head 만으로 충분.
  const text =
    fileSize > headSize
      ? headBuf.toString('latin1') + tailBuf.toString('latin1')
      : headBuf.toString('latin1');

  // /JavaScript action — /S /JavaScript 는 강한 시그널
  if (/\/S\s*\/JavaScript\b/.test(text) || /\/JavaScript\b/.test(text)) {
    throw new PdfParseError(
      'JS_EMBEDDED',
      `Embedded JavaScript action detected (security policy blocks auto-execution PDFs): ${pdfPath}`,
      { pdfPath, fileSize },
    );
  }

  // startxref offset
  const xrefMatch = /startxref\s+(\d+)\s*\n?\s*%%EOF/.exec(text);
  if (xrefMatch) {
    const xrefOffset = Number(xrefMatch[1]);
    if (Number.isFinite(xrefOffset) && xrefOffset > fileSize) {
      throw new PdfParseError(
        'MALFORMED_XREF',
        `xref offset ${xrefOffset} exceeds file size ${fileSize}: ${pdfPath}`,
        { pdfPath, fileSize, xrefOffset },
      );
    }
  }

  // /Length declarations vs file size
  const lengthRe = /\/Length\s+(\d{6,})/g; // 6+ digits = >= 100KB declared
  let lengthMatch;
  while ((lengthMatch = lengthRe.exec(text)) !== null) {
    const declared = Number(lengthMatch[1]);
    if (Number.isFinite(declared) && declared > fileSize * MAX_DECOMPRESSION_RATIO) {
      throw new PdfParseError(
        'COMPRESSION_BOMB',
        `Declared /Length ${declared} exceeds file size ${fileSize} by >${MAX_DECOMPRESSION_RATIO}x — compression bomb suspected`,
        { pdfPath, fileSize, declaredLength: declared },
      );
    }
  }
}

/**
 * Python subprocess stderr / error message → PdfErrorClassification.
 * pre-flight 미차단 vectors 에 대한 보조 분류.
 */
function classifySubprocessError(message: string): PdfErrorClassification {
  const lower = message.toLowerCase();
  if (lower.includes('xref') || lower.includes('cross-reference')) {
    return 'MALFORMED_XREF';
  }
  if (lower.includes('header') || lower.includes('not a pdf') || lower.includes('signature')) {
    return 'MALFORMED_HEADER';
  }
  return 'PDF_PARSE_FAILED';
}

/**
 * Extract text and tables from a PDF file.
 *
 * @param pdfPath - Absolute path to the PDF file
 * @param options - Extraction options
 * @returns Extracted pages with text and tables
 * @throws {PdfParseError} 사전 검사 또는 subprocess 실패 시 분류된 에러
 * @throws {AppError} 입력 인자 검증 실패 또는 환경 설정 오류 (Python 미설치 등)
 */
export async function extractPdf(
  pdfPath: string,
  options: ExtractOptions = {},
): Promise<ExtractionResult> {
  const {
    pages,
    timeout = DEFAULT_TIMEOUT,
    preflightMaxBytes = DEFAULT_PREFLIGHT_MAX_BYTES,
  } = options;

  // Validate pages format to prevent argument injection
  if (pages !== undefined && !PAGES_RE.test(pages)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid pages format: "${pages}". Expected "N" or "N-M" (e.g., "1-10").`,
    );
  }

  // Pre-flight byte scan — 5종 악의적 PDF 사전 거부 (subprocess 미호출 → zombie 0건)
  await preflightPdfChecks(pdfPath, preflightMaxBytes);

  const args = [SCRIPT_PATH, pdfPath];
  if (pages) {
    args.push('--pages', pages);
  }

  return new Promise<ExtractionResult>((promiseResolve, reject) => {
    activeSubprocessCount++;
    let settled = false;
    let counterDecremented = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };
    // Idempotent decrement — child 'exit' / 'error' / execFile callback 다중 fire 시
    // 단일 감산만 발생. cross-call 오감산 차단 (4-Pass §5.3 C-1).
    const decrementOnce = (): void => {
      if (counterDecremented) return;
      counterDecremented = true;
      if (activeSubprocessCount > 0) activeSubprocessCount--;
    };

    const child = execFile(
      PYTHON_PATH,
      args,
      { timeout, maxBuffer: 100 * 1024 * 1024 },
      (error, stdout, stderr) => {
        // callback 진입 시 보조 감산 — 'exit' / 'error' 이벤트 미발화 환경 (detached
        // process 등) 에서 영구 +1 누수 차단.
        decrementOnce();

        // Log stderr warnings from pdfplumber (data quality signals)
        if (stderr && !error) {
          console.warn(`[PDFExtractor] Warnings for ${pdfPath}:\n${stderr}`);
        }

        if (error) {
          const isEnoent = 'code' in error && error.code === 'ENOENT';
          if (isEnoent) {
            settle(() =>
              reject(
                new AppError(
                  ErrorCode.INTERNAL_ERROR,
                  `Python not found at ${PYTHON_PATH}. Run: cd packages/parser && python3 -m venv .venv && .venv/bin/pip install pdfplumber`,
                ),
              ),
            );
            return;
          }
          if (error.killed) {
            settle(() =>
              reject(
                new PdfParseError(
                  'PDF_TIMEOUT',
                  `PDF extraction timed out after ${timeout}ms: ${pdfPath}`,
                  { pdfPath, timeoutMs: timeout },
                ),
              ),
            );
            return;
          }
          settle(() =>
            reject(
              new PdfParseError(
                classifySubprocessError(stderr || error.message),
                `PDF extraction failed: ${error.message}`,
                { pdfPath, stderr: stderr?.slice(0, 500) },
              ),
            ),
          );
          return;
        }

        try {
          const result = JSON.parse(stdout) as ExtractionResult | { error: string };

          if ('error' in result) {
            settle(() =>
              reject(
                new PdfParseError(
                  classifySubprocessError(result.error),
                  `PDF extraction error: ${result.error}`,
                  { pdfPath, stderr: result.error.slice(0, 500) },
                ),
              ),
            );
            return;
          }

          settle(() => promiseResolve(result as ExtractionResult));
        } catch {
          settle(() =>
            reject(
              new PdfParseError('PDF_PARSE_FAILED', 'Failed to parse PDF extractor JSON output', {
                pdfPath,
                stderr: stderr?.slice(0, 500),
              }),
            ),
          );
        }
      },
    );

    // subprocess lifecycle counter — idempotent decrement (4-Pass §5.3 C-1).
    // exit / error / callback 어느 경로에서든 단일 감산.
    child.once('exit', decrementOnce);
    child.once('error', decrementOnce);
  });
}

/**
 * Extract text only (no tables) from a PDF for quick processing.
 */
export async function extractPdfText(
  pdfPath: string,
  options: ExtractOptions = {},
): Promise<string> {
  const result = await extractPdf(pdfPath, options);
  return result.pages.map((p) => p.text).join('\n\n');
}
