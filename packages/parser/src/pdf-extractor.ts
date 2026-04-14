/**
 * M01 PDF Text Extractor
 *
 * TypeScript wrapper for pdfplumber Python subprocess.
 * Workers 내부 X — 로컬/CI 빌드 파이프라인에서만 실행.
 */

import { execFile } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError, ErrorCode } from '@thepick/shared';

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
}

// --- Implementation ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, '..', 'scripts', 'extract_pdf.py');
const PYTHON_PATH = resolve(__dirname, '..', '.venv', 'bin', 'python3');
const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/** Pages format: "N" or "N-M" only */
const PAGES_RE = /^\d+(-\d+)?$/;

/**
 * Extract text and tables from a PDF file.
 *
 * @param pdfPath - Absolute path to the PDF file
 * @param options - Extraction options
 * @returns Extracted pages with text and tables
 */
export function extractPdf(
  pdfPath: string,
  options: ExtractOptions = {},
): Promise<ExtractionResult> {
  const { pages, timeout = DEFAULT_TIMEOUT } = options;

  // Validate pages format to prevent argument injection
  if (pages !== undefined && !PAGES_RE.test(pages)) {
    return Promise.reject(
      new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid pages format: "${pages}". Expected "N" or "N-M" (e.g., "1-10").`,
      ),
    );
  }

  const args = [SCRIPT_PATH, pdfPath];
  if (pages) {
    args.push('--pages', pages);
  }

  return new Promise((promiseResolve, reject) => {
    execFile(
      PYTHON_PATH,
      args,
      { timeout, maxBuffer: 100 * 1024 * 1024 },
      (error, stdout, stderr) => {
        // Log stderr warnings from pdfplumber (data quality signals)
        if (stderr && !error) {
          console.warn(`[PDFExtractor] Warnings for ${pdfPath}:\n${stderr}`);
        }

        if (error) {
          const isEnoent = 'code' in error && error.code === 'ENOENT';
          if (isEnoent) {
            reject(
              new AppError(
                ErrorCode.INTERNAL_ERROR,
                `Python not found at ${PYTHON_PATH}. Run: cd packages/parser && python3 -m venv .venv && .venv/bin/pip install pdfplumber`,
              ),
            );
            return;
          }
          if (error.killed) {
            reject(
              new AppError(
                ErrorCode.INTERNAL_ERROR,
                `PDF extraction timed out after ${timeout}ms: ${pdfPath}`,
              ),
            );
            return;
          }
          reject(new AppError(ErrorCode.INTERNAL_ERROR, `PDF extraction failed: ${error.message}`));
          return;
        }

        try {
          const result = JSON.parse(stdout) as ExtractionResult | { error: string };

          if ('error' in result) {
            reject(new AppError(ErrorCode.INTERNAL_ERROR, `PDF extraction error: ${result.error}`));
            return;
          }

          promiseResolve(result as ExtractionResult);
        } catch {
          reject(
            new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to parse PDF extractor JSON output'),
          );
        }
      },
    );
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
