/**
 * 가-1 Group A-2 — pdfplumber subprocess 실 smoke 호출.
 *
 * tasks/step-1-5-ga-1.gates.yaml §A-2:
 *   input: docs/manual/2026년... 이론서 p.403~405
 *   output: docs/measurements/pdfplumber-smoke-{YYYYMMDD}.md
 *   pass:
 *     - 403~405 페이지 추출 성공, text 비어있지 않음
 *     - table 추출 결과가 string[][][] shape
 *     - stdout/stderr 분리 로깅 작동
 *
 * 실행:
 *   pnpm --filter @thepick/batch exec tsx src/__manual__/pdfplumber-smoke.ts
 *
 * 비용: $0 (로컬 subprocess, 외부 API 없음 → cost-cap 불필요).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractPdf, type ExtractedPage } from '@thepick/parser';

// Pass 3 NEW-C-2 fix: process.cwd() 의존 제거.
// 본 파일 위치: apps/batch/src/__manual__/pdfplumber-smoke.ts → 4 levels up = repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');

const PDF_RELATIVE_PATH =
  'docs/manual/2026년 「농업재해보험·손해평가의 이론과 실무」 이론서_수정본(26.3.31.).pdf';
const PAGES = '403-405';

interface PageMeasurement {
  page: number;
  textLength: number;
  textHead: string;
  tableCount: number;
  tableShapes: string[];
}

interface SmokeMeasurement {
  timestamp: string;
  pdfPath: string;
  pages: string;
  totalPages: number;
  extractedPages: number;
  durationMs: number;
  perPage: PageMeasurement[];
  warnings: string[];
  passCriteria: {
    extractionSucceeded: boolean;
    textNonEmpty: boolean;
    tableShapeValid: boolean;
  };
}

function describePageMeasurement(page: ExtractedPage): PageMeasurement {
  return {
    page: page.page,
    textLength: page.text.length,
    textHead: page.text.slice(0, 200).replace(/\s+/g, ' ').trim(),
    tableCount: page.tables.length,
    tableShapes: page.tables.map((table) => `${table.length}x${table[0]?.length ?? 0}`),
  };
}

function isStringArrayArrayArray(value: unknown): value is string[][][] {
  if (!Array.isArray(value)) return false;
  for (const table of value) {
    if (!Array.isArray(table)) return false;
    for (const row of table) {
      if (!Array.isArray(row)) return false;
      for (const cell of row) {
        if (typeof cell !== 'string') return false;
      }
    }
  }
  return true;
}

function renderMarkdown(measurement: SmokeMeasurement): string {
  const passSection = Object.entries(measurement.passCriteria)
    .map(([key, value]) => `- ${value ? '✅' : '❌'} ${key}: ${value}`)
    .join('\n');

  const perPageSection = measurement.perPage
    .map((p) => {
      const tables = p.tableShapes.length
        ? p.tableShapes.map((s, i) => `  - table ${i + 1}: ${s}`).join('\n')
        : '  - (no tables)';
      return [
        `### page ${p.page}`,
        `- text length: ${p.textLength}`,
        `- text head (first 200 chars, whitespace collapsed): ${p.textHead}`,
        `- table count: ${p.tableCount}`,
        tables,
      ].join('\n');
    })
    .join('\n\n');

  return `# pdfplumber smoke (A-2)

작성: ${measurement.timestamp}
입력: ${measurement.pdfPath}
페이지: ${measurement.pages}
총 페이지 수: ${measurement.totalPages}
추출 페이지 수: ${measurement.extractedPages}
실행 시간: ${measurement.durationMs} ms

## Pass Criteria

${passSection}

## 페이지별 측정값

${perPageSection}

## stderr / 경고

${
  measurement.warnings.length === 0
    ? '없음'
    : measurement.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')
}

## 다음 단계 (B-1 Mock 설계 입력)

- pdfplumber 페이지당 평균 추출 시간: ${(
    measurement.durationMs / Math.max(measurement.extractedPages, 1)
  ).toFixed(0)} ms
- text 비어있는 페이지: ${measurement.perPage.filter((p) => p.textLength === 0).length}
- table 포함 페이지: ${measurement.perPage.filter((p) => p.tableCount > 0).length}
`;
}

async function main(): Promise<void> {
  const pdfPath = resolve(PROJECT_ROOT, PDF_RELATIVE_PATH);

  // PDF 파일 존재 확인 — readFile 시도로 가시화 (extractPdf 가 ENOENT 던지기 전에)
  try {
    await readFile(pdfPath, { encoding: null });
  } catch (err) {
    process.stderr.write(`PDF 파일을 찾을 수 없습니다: ${pdfPath}\n`);
    process.stderr.write(`원인: ${(err as Error).message}\n`);
    process.exit(1);
  }

  process.stdout.write(`[A-2 smoke] PDF: ${pdfPath}\n`);
  process.stdout.write(`[A-2 smoke] pages: ${PAGES}\n`);

  const startMs = Date.now();
  const result = await extractPdf(pdfPath, { pages: PAGES });
  const durationMs = Date.now() - startMs;

  const perPage = result.pages.map(describePageMeasurement);
  const textNonEmpty = perPage.every((p) => p.textLength > 0);
  const tableShapeValid = result.pages.every((p) => isStringArrayArrayArray(p.tables));

  const measurement: SmokeMeasurement = {
    timestamp: new Date().toISOString(),
    pdfPath: PDF_RELATIVE_PATH,
    pages: PAGES,
    totalPages: result.totalPages,
    extractedPages: result.extractedPages,
    durationMs,
    perPage,
    warnings: result.warnings ?? [],
    passCriteria: {
      extractionSucceeded: result.extractedPages > 0,
      textNonEmpty,
      tableShapeValid,
    },
  };

  // 산출물 작성: docs/measurements/pdfplumber-smoke-{YYYYMMDD}.md
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outDir = resolve(PROJECT_ROOT, 'docs/measurements');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, `pdfplumber-smoke-${date}.md`);
  await writeFile(outPath, renderMarkdown(measurement), 'utf-8');

  process.stdout.write(`\n[A-2 smoke] 산출물: ${outPath}\n`);
  process.stdout.write(`[A-2 smoke] pass: ${JSON.stringify(measurement.passCriteria)}\n`);
  process.stdout.write(`[A-2 smoke] duration: ${durationMs}ms\n`);

  const allPassed = Object.values(measurement.passCriteria).every(Boolean);
  if (!allPassed) {
    process.exit(2);
  }
}

main().catch((err) => {
  process.stderr.write(`[A-2 smoke] 실패: ${(err as Error).message}\n`);
  if (err instanceof Error && err.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
  process.exit(1);
});
