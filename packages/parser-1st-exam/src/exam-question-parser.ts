/**
 * M03 기출문제 파서 (1차 객관식)
 *
 * PDF 텍스트 → 문항별 구조화 JSON
 * 정규식 상태 머신으로 문항/보기/과목 분리
 */

import type { ExtractedPage } from '@thepick/parser';
import type { ExamMetadata, ExamParseResult, ParsedQuestion } from './types';
import { SUBJECT_PATTERNS } from './types';

// --- Regex patterns ---

/** 문항 번호: "1." ~ "99." (줄 시작 또는 공백 후) */
const QUESTION_RE = /^\s*(\d{1,2})\.\s+(.+)/;

/** 보기: ①②③④⑤ (단일 또는 인라인 복수) */
const CHOICE_RE = /^\s*([①②③④⑤])\s*(.+)/;

/** 한 줄에 여러 보기가 있는 경우 분리 */
const INLINE_CHOICES_RE = /([①②③④⑤])\s*([^①②③④⑤]+)/g;

/** 원형 숫자 → 숫자 매핑 */
const CIRCLE_NUM: Record<string, number> = {
  '①': 1,
  '②': 2,
  '③': 3,
  '④': 4,
  '⑤': 5,
};

/** 파일명에서 연도/회차 추출 */
const FILENAME_RE = /(\d{4})년[도]?\s*제?(\d{1,2})회/;

/** 페이지 footer 패턴 (stem/choice 오염 방지) */
const FOOTER_RE = /^\s*\d{4}년[도]?\s*제?\d{1,2}회\s*손해평가사|^\s*\(\s*\d+\s*-\s*\d+\s*\)\s*$/;

// --- Parser ---

/**
 * 파일명에서 시험 메타데이터 추출.
 * 파일명 형식 불일치 시 year=0, round=0 + warning.
 */
export function parseExamMetadata(filename: string): ExamMetadata & { warning?: string } {
  const match = filename.match(FILENAME_RE);
  const year = match ? parseInt(match[1], 10) : 0;
  const round = match ? parseInt(match[2], 10) : 0;
  const examType = filename.includes('2차') ? '2nd' : '1st';

  const result: ExamMetadata & { warning?: string } = {
    year,
    round,
    examType,
    sourceFile: filename,
  };

  if (!match) {
    result.warning = `파일명에서 연도/회차 추출 실패: "${filename}". 기대 형식: "2024년 제10회"`;
  }

  return result;
}

/**
 * 텍스트 라인에서 과목명 탐지
 */
function detectSubject(line: string): string | null {
  for (const { pattern, subject } of SUBJECT_PATTERNS) {
    if (pattern.test(line)) {
      return subject;
    }
  }
  return null;
}

/**
 * 1차 기출 PDF 추출 결과를 구조화된 문항 목록으로 변환
 *
 * @param pages - pdf-extractor의 ExtractedPage 배열
 * @param metadata - 시험 메타데이터
 * @returns 파싱된 문항 목록 + 경고
 */
export function parseExamQuestions(
  pages: ExtractedPage[],
  metadata: ExamMetadata,
): ExamParseResult {
  if (metadata.examType === '2nd') {
    return {
      metadata,
      questions: [],
      warnings: [
        '2차 시험(주관식)은 이 파서의 대상이 아닙니다. parser-1st-exam은 1차 객관식 전용입니다.',
      ],
    };
  }

  const questions: ParsedQuestion[] = [];
  const warnings: string[] = [];

  let currentSubject = '';
  let currentQuestion: ParsedQuestion | null = null;
  let currentChoiceText = '';
  let currentChoiceNum = 0;
  let lastQuestionNumber = 0;

  function flushChoice() {
    if (currentQuestion && currentChoiceNum > 0 && currentChoiceText.trim()) {
      currentQuestion.choices.push({
        number: currentChoiceNum,
        text: currentChoiceText.trim(),
      });
    }
    currentChoiceText = '';
    currentChoiceNum = 0;
  }

  function flushQuestion() {
    flushChoice();
    if (currentQuestion) {
      if (currentQuestion.choices.length < 4) {
        warnings.push(
          `Q${currentQuestion.questionNumber} (${currentQuestion.subject}): ${currentQuestion.choices.length}개 보기 (기대: 4+)`,
        );
      }
      questions.push(currentQuestion);
    }
    currentQuestion = null;
  }

  for (const page of pages) {
    const lines = page.text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 0) Footer 필터 — stem/choice 오염 방지
      if (FOOTER_RE.test(trimmed)) {
        continue;
      }

      // 1) 과목 탐지 — 문항/보기가 아닌 독립 헤더 라인에서만
      if (!QUESTION_RE.test(trimmed) && !CHOICE_RE.test(trimmed)) {
        const subject = detectSubject(trimmed);
        if (subject) {
          currentSubject = subject;
          continue;
        }
      }

      // 2) 보기 탐지 (문항보다 먼저 — 보기 안에 숫자+. 패턴이 올 수 있음)
      const choiceMatch = trimmed.match(CHOICE_RE);
      if (choiceMatch && currentQuestion) {
        // 한 줄에 여러 보기 (① ... ② ... ③ ... ④ ...) 인라인 패턴 체크
        const inlineMatches = [...trimmed.matchAll(INLINE_CHOICES_RE)];
        if (inlineMatches.length >= 2) {
          flushChoice();
          const lastInline = inlineMatches[inlineMatches.length - 1];
          for (const m of inlineMatches) {
            currentQuestion.choices.push({
              number: CIRCLE_NUM[m[1]],
              text: m[2].trim(),
            });
          }
          // 마지막 인라인 보기 번호를 기록하여 다음 줄 연장 텍스트 처리
          currentChoiceNum = CIRCLE_NUM[lastInline[1]];
          currentChoiceText = '';
        } else {
          flushChoice();
          currentChoiceNum = CIRCLE_NUM[choiceMatch[1]];
          currentChoiceText = choiceMatch[2];
        }
        continue;
      }

      // 3) 문항 시작 탐지
      const questionMatch = trimmed.match(QUESTION_RE);
      if (questionMatch) {
        const qNo = parseInt(questionMatch[1], 10);
        const isNextQuestion = qNo === lastQuestionNumber + 1;
        const isNewSubjectStart = qNo === 1 && lastQuestionNumber > 1;
        const isFirstQuestion = lastQuestionNumber === 0 && qNo === 1;

        if (isNextQuestion || isNewSubjectStart || isFirstQuestion) {
          flushQuestion();
          lastQuestionNumber = qNo;
          currentQuestion = {
            questionNumber: qNo,
            subject: currentSubject,
            stem: questionMatch[2],
            choices: [],
            answer: null,
            pageNumber: page.page,
          };
          continue;
        }

        // 비연속 번호: tolerance — 건너뛴 번호 경고 후 허용
        if (qNo > lastQuestionNumber + 1 && qNo <= lastQuestionNumber + 3) {
          warnings.push(
            `P${page.page}: Q${qNo} 감지 (기대: Q${lastQuestionNumber + 1}) — 번호 건너뜀`,
          );
          flushQuestion();
          lastQuestionNumber = qNo;
          currentQuestion = {
            questionNumber: qNo,
            subject: currentSubject,
            stem: questionMatch[2],
            choices: [],
            answer: null,
            pageNumber: page.page,
          };
          continue;
        }
      }

      // 4) 이어지는 텍스트 (현재 보기 또는 문항 지문에 추가)
      if (currentChoiceNum > 0) {
        currentChoiceText += ' ' + trimmed;
      } else if (currentQuestion) {
        currentQuestion.stem += ' ' + trimmed;
      }
    }
  }

  // 마지막 문항 flush
  flushQuestion();

  // 검증: 과목별 문항 수 체크
  const subjectCounts: Record<string, number> = {};
  for (const q of questions) {
    subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
  }
  for (const [subj, count] of Object.entries(subjectCounts)) {
    if (count !== 25) {
      warnings.push(`${subj}: ${count}문항 (기대: 25)`);
    }
  }

  return { metadata, questions, warnings };
}

/**
 * 정답을 파싱된 문항에 매핑 (questionNumber 기반, 인덱스 아님).
 *
 * @param result - 파싱 결과
 * @param answers - 과목별 정답 맵 { subject, answerMap: Record<questionNumber, answer> }
 * @returns 정답이 매핑된 결과 (원본 변경)
 */
export function applyAnswers(
  result: ExamParseResult,
  answers: Array<{ subject: string; answerMap: Record<number, number> }>,
): ExamParseResult {
  for (const { subject, answerMap } of answers) {
    const subjectQuestions = result.questions.filter((q) => q.subject === subject);

    let mapped = 0;
    const unmapped: number[] = [];
    for (const q of subjectQuestions) {
      const ans = answerMap[q.questionNumber];
      if (ans !== undefined) {
        q.answer = ans;
        mapped++;
      } else {
        unmapped.push(q.questionNumber);
      }
    }

    if (unmapped.length > 0) {
      result.warnings.push(
        `${subject}: Q${unmapped.join(',')}에 정답 미매핑 (${mapped}/${subjectQuestions.length} 매핑됨)`,
      );
    }

    const extraKeys = Object.keys(answerMap)
      .map(Number)
      .filter((k) => !subjectQuestions.some((q) => q.questionNumber === k));
    if (extraKeys.length > 0) {
      result.warnings.push(`${subject}: 정답 키 Q${extraKeys.join(',')}에 대응 문항 없음`);
    }
  }

  return result;
}
