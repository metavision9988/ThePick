/**
 * M06 표 추출기
 *
 * pdfplumber 추출 표 → 구조화 JSON.
 * 교재 내 조사방법표, 보험금 산정표 등을 정형화.
 */

import type { ExtractedPage } from './pdf-extractor';

// --- Types ---

export interface ExtractedTable {
  /** 원본 페이지 번호 */
  page: number;
  /** 표 인덱스 (페이지 내) */
  tableIndex: number;
  /** 헤더 행 (첫 행) */
  headers: string[];
  /** 데이터 행 (헤더 제외) */
  rows: string[][];
  /** 행 × 열 크기 */
  shape: { rows: number; cols: number };
}

export interface TableExtractionResult {
  tables: ExtractedTable[];
  totalTablesFound: number;
  warnings: string[];
}

// --- Implementation ---

/**
 * PDF 추출 결과에서 모든 표를 구조화된 형태로 변환.
 *
 * @param pages - pdf-extractor의 ExtractedPage 배열
 * @returns 구조화된 표 목록
 */
export function extractTables(pages: ExtractedPage[]): TableExtractionResult {
  const tables: ExtractedTable[] = [];
  const warnings: string[] = [];

  for (const page of pages) {
    if (!page.tables || page.tables.length === 0) continue;

    for (let ti = 0; ti < page.tables.length; ti++) {
      const rawTable = page.tables[ti];
      if (rawTable.length === 0) {
        warnings.push(`P${page.page} T${ti}: 빈 테이블 건너뜀`);
        continue;
      }

      // 첫 행을 헤더로, 나머지를 데이터 행으로 분리
      const headers = rawTable[0].map(cleanCell);
      const rows = rawTable.slice(1).map((row) => row.map(cleanCell));

      // 열 수 불일치 경고
      for (let ri = 0; ri < rows.length; ri++) {
        if (rows[ri].length !== headers.length) {
          warnings.push(
            `P${page.page} T${ti} R${ri + 1}: 열 수 불일치 (헤더: ${headers.length}, 행: ${rows[ri].length})`,
          );
        }
      }

      tables.push({
        page: page.page,
        tableIndex: ti,
        headers,
        rows,
        shape: { rows: rawTable.length, cols: headers.length },
      });
    }
  }

  return {
    tables,
    totalTablesFound: tables.length,
    warnings,
  };
}

/**
 * 셀 텍스트 정제: 줄바꿈 → 공백, 연속 공백 제거
 */
function cleanCell(cell: string): string {
  return cell.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}
