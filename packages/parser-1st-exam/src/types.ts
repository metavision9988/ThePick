/**
 * 1차 기출문제 파서 타입 정의
 */

export interface ExamMetadata {
  year: number;
  round: number;
  examType: '1st' | '2nd';
  sourceFile: string;
}

export interface ParsedChoice {
  /** 보기 번호 (1-5) */
  number: number;
  /** 보기 텍스트 */
  text: string;
}

export interface ParsedQuestion {
  /** 문항 번호 (1-25 per subject) */
  questionNumber: number;
  /** 과목명 */
  subject: string;
  /** 문항 지문 */
  stem: string;
  /** 보기 목록 (①②③④⑤) */
  choices: ParsedChoice[];
  /** 정답 번호 (외부 대조 후 설정) */
  answer: number | null;
  /** 원본 PDF 페이지 번호 */
  pageNumber: number;
}

export interface ExamParseResult {
  metadata: ExamMetadata;
  questions: ParsedQuestion[];
  /** 파싱 경고 (누락 보기, 불완전 문항 등) */
  warnings: string[];
}

/** 1차 시험 3개 과목 */
export const FIRST_EXAM_SUBJECTS = ['상법보험편', '농어업재해보험법령', '농학개론'] as const;

/** 과목 탐지 패턴 (PDF 헤더에서 사용) */
export const SUBJECT_PATTERNS: Array<{ pattern: RegExp; subject: string }> = [
  { pattern: /상법\s*[(（]?\s*보험편\s*[)）]?/i, subject: '상법보험편' },
  { pattern: /｢상법｣\s*보험편/, subject: '상법보험편' },
  { pattern: /농어업재해보험법령/, subject: '농어업재해보험법령' },
  { pattern: /농작물재해보험\s*(및|&)\s*가축재해보험/, subject: '농어업재해보험법령' },
  { pattern: /농학\s*개론/, subject: '농학개론' },
];
