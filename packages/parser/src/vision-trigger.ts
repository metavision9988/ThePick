/**
 * Vision OCR 트리거 휴리스틱 — pdfplumber 추출만으로 품질이 낮은 페이지 탐지.
 *
 * 배치 파이프라인 Stage 2.5 (선택적 Vision OCR) 의 페이지 선별 기준.
 * 실제 Vision 호출은 apps/batch/src/adapters/vision-client.ts 에서 수행 (가-1 이후 활성).
 *
 * 판정 기준 (OR):
 *   - 본문 텍스트 길이 < minTextLength 인데 테이블이 많음 (표 이미지 가능성)
 *   - 페이지 내 표 개수 >= maxTablesPerPage (밀도 높은 도표)
 *   - 본문 텍스트 비율이 페이지 면적 대비 매우 낮은 것으로 추정 (table only)
 */

import type { ExtractedPage } from './pdf-extractor';
import type { ExtractedTable } from './table-extractor';

export interface VisionTriggerOptions {
  /** 본문 텍스트가 이 수치보다 짧으면 "이미지 heavy" 가능성. 기본 500. */
  readonly minTextLength?: number;
  /** 페이지 내 표 수가 이 이상이면 Vision 재추출 필요. 기본 3. */
  readonly maxTablesPerPage?: number;
}

export interface VisionCandidate {
  readonly page: number;
  readonly reason: 'low_text' | 'high_table_density' | 'text_and_table_low';
  readonly textLength: number;
  readonly tableCount: number;
}

const DEFAULT_MIN_TEXT = 500;
const DEFAULT_MAX_TABLES = 3;

/**
 * Vision OCR 이 필요한 페이지 후보 식별.
 * 텍스트/표 모두 저밀도인 경우 text_and_table_low — 페이지가 거의 이미지일 확률.
 */
export function selectVisionCandidates(
  pages: readonly ExtractedPage[],
  tables: readonly ExtractedTable[],
  options: VisionTriggerOptions = {},
): VisionCandidate[] {
  const minTextLength = options.minTextLength ?? DEFAULT_MIN_TEXT;
  const maxTablesPerPage = options.maxTablesPerPage ?? DEFAULT_MAX_TABLES;

  const tablesByPage = new Map<number, number>();
  for (const t of tables) {
    tablesByPage.set(t.page, (tablesByPage.get(t.page) ?? 0) + 1);
  }

  const candidates: VisionCandidate[] = [];
  for (const page of pages) {
    const textLength = page.text.trim().length;
    const tableCount = tablesByPage.get(page.page) ?? 0;

    if (textLength < minTextLength && tableCount === 0) {
      candidates.push({
        page: page.page,
        reason: 'text_and_table_low',
        textLength,
        tableCount,
      });
      continue;
    }
    if (textLength < minTextLength && tableCount >= 1) {
      candidates.push({
        page: page.page,
        reason: 'low_text',
        textLength,
        tableCount,
      });
      continue;
    }
    if (tableCount >= maxTablesPerPage) {
      candidates.push({
        page: page.page,
        reason: 'high_table_density',
        textLength,
        tableCount,
      });
    }
  }

  return candidates;
}
