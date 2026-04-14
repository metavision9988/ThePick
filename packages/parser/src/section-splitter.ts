/**
 * M06 섹션 분리기
 *
 * 교재 raw text → 절/항/호/목 단위 계층 구조 분리.
 * Claude API 배치 프로세서(M07)에 입력으로 사용.
 */

import type { ExtractedPage } from './pdf-extractor';

// --- Types ---

export interface Section {
  /** 섹션 계층 (chapter > section > subsection > item) */
  level: SectionLevel;
  /** 헤더 텍스트 (e.g., "제2절 과수작물 손해평가 및 보험금 산정") */
  heading: string;
  /** 본문 텍스트 (하위 섹션 제외) */
  body: string;
  /** 시작 페이지 */
  startPage: number;
  /** 끝 페이지 */
  endPage: number;
  /** 하위 섹션 */
  children: Section[];
}

export type SectionLevel =
  | 'chapter' // 제N장
  | 'section' // 제N절
  | 'subsection' // N. (숫자+점 소주제)
  | 'item' // 가. 나. 다. 또는 1) 2) 3)
  | 'subitem'; // 가) 나) 또는 (1) (2) 또는 (가) (나)

export interface SplitResult {
  sections: Section[];
  /** 총 페이지 범위 */
  pageRange: { start: number; end: number };
  warnings: string[];
}

// --- Regex patterns ---

/** 제N장 */
const CHAPTER_RE = /^제\s*(\d+)\s*장\s+(.+)/;

/** 제N절 */
const SECTION_RE = /^제\s*(\d+)\s*절\s+(.+)/;

/** N. 소주제 (1자리 이상 숫자 + 점 + 공백 + 텍스트) — 단, 법령 조문 "제N조" 뒤는 제외 */
const SUBSECTION_RE = /^(\d{1,2})\.\s+(.+)/;

/** 가. 나. 다. 라. 마. 바. 사. 아. */
const ITEM_KO_RE = /^([가나다라마바사아자차카타파하])\.\s+(.+)/;

/** 페이지 헤더 (반복되는 교재 제목) — 필터링 대상 */
const PAGE_HEADER_RE = /^농작물재해보험\s*(및|&)\s*가축재해보험\s*손해평가의\s*이론과\s*실무/;

/** 교재 권 표시 */
const VOLUME_RE = /^[12]권\./;

// --- Implementation ---

interface HeadingMatch {
  level: SectionLevel;
  heading: string;
  number: string;
}

function matchHeading(line: string): HeadingMatch | null {
  const chapterMatch = line.match(CHAPTER_RE);
  if (chapterMatch) {
    return { level: 'chapter', heading: line, number: chapterMatch[1] };
  }

  const sectionMatch = line.match(SECTION_RE);
  if (sectionMatch) {
    return { level: 'section', heading: line, number: sectionMatch[1] };
  }

  const subsectionMatch = line.match(SUBSECTION_RE);
  if (subsectionMatch) {
    return {
      level: 'subsection',
      heading: line,
      number: subsectionMatch[1],
    };
  }

  const itemMatch = line.match(ITEM_KO_RE);
  if (itemMatch) {
    return { level: 'item', heading: line, number: itemMatch[1] };
  }

  return null;
}

/** 레벨 우선순위 (낮을수록 상위) */
const LEVEL_PRIORITY: Record<SectionLevel, number> = {
  chapter: 0,
  section: 1,
  subsection: 2,
  item: 3,
  subitem: 4,
};

/**
 * PDF 추출 결과를 계층적 섹션으로 분리.
 *
 * @param pages - pdf-extractor의 ExtractedPage 배열
 * @returns 계층적 섹션 트리 + 경고
 */
export function splitSections(pages: ExtractedPage[]): SplitResult {
  const warnings: string[] = [];
  const flatSections: Array<{
    level: SectionLevel;
    heading: string;
    bodyLines: string[];
    startPage: number;
    endPage: number;
  }> = [];

  let currentSection: (typeof flatSections)[number] | null = null;

  for (const page of pages) {
    const lines = page.text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 페이지 헤더 필터
      if (PAGE_HEADER_RE.test(trimmed) || VOLUME_RE.test(trimmed)) {
        continue;
      }
      // "- 2권" 같은 부분 제목 필터
      if (/^-\s*\d권\s*$/.test(trimmed)) {
        continue;
      }

      const heading = matchHeading(trimmed);
      if (heading) {
        // 새 섹션 시작
        if (currentSection) {
          currentSection.endPage = page.page;
        }
        currentSection = {
          level: heading.level,
          heading: heading.heading,
          bodyLines: [],
          startPage: page.page,
          endPage: page.page,
        };
        flatSections.push(currentSection);
      } else if (currentSection) {
        currentSection.bodyLines.push(trimmed);
        currentSection.endPage = page.page;
      }
    }
  }

  // flat → tree 변환
  const tree = buildTree(flatSections);

  const pageRange =
    pages.length > 0
      ? { start: pages[0].page, end: pages[pages.length - 1].page }
      : { start: 0, end: 0 };

  if (flatSections.length === 0) {
    warnings.push('섹션이 감지되지 않았습니다. 교재 구조를 확인하세요.');
  }

  return { sections: tree, pageRange, warnings };
}

function buildTree(
  flatSections: Array<{
    level: SectionLevel;
    heading: string;
    bodyLines: string[];
    startPage: number;
    endPage: number;
  }>,
): Section[] {
  const root: Section[] = [];
  const stack: Section[] = [];

  for (const flat of flatSections) {
    const section: Section = {
      level: flat.level,
      heading: flat.heading,
      body: flat.bodyLines.join('\n'),
      startPage: flat.startPage,
      endPage: flat.endPage,
      children: [],
    };

    const priority = LEVEL_PRIORITY[flat.level];

    // 스택에서 현재보다 같거나 낮은(같은 레벨 이상) 항목을 pop
    while (stack.length > 0 && LEVEL_PRIORITY[stack[stack.length - 1].level] >= priority) {
      stack.pop();
    }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(section);
    } else {
      root.push(section);
    }

    stack.push(section);
  }

  return root;
}
