/**
 * QuestionCard shared types — server `/api/study/next` 응답 + `/api/study/grade` 응답 매핑.
 * Step 3-UX-6b LOCK A+C 정합.
 */

export type InputType = 'multiple_choice' | 'fill_blank' | 'essay' | 'calc';

export type EssaySelfRating = 'correct' | 'partial' | 'incorrect';

export type LearningMode = 'category' | 'topic' | 'confusion' | 'weak' | 'mixed';

export type SessionPhase = 'warmup' | 'main' | 'cooldown' | 'completed';

export interface RelatedNode {
  readonly id: string;
  readonly name: string;
  readonly nodeType: string;
  readonly bookPage: number | null;
  readonly pageRef: string | null;
}

export interface SourceCitations {
  readonly examReferences: ReadonlyArray<{
    readonly year: number;
    readonly round: number | null;
    readonly questionNumber: number | null;
  }>;
  readonly manualPages: ReadonlyArray<number>;
  readonly lawArticles: ReadonlyArray<string>;
}

export interface Choice {
  readonly label: string;
  readonly text: string;
}

export interface NextQuestion {
  readonly id: string;
  readonly year: number;
  readonly round: number | null;
  readonly questionNumber: number | null;
  readonly subject: string | null;
  readonly content: string;
  readonly examType: string | null;
  readonly topicCluster: string | null;
  readonly relatedNodes: ReadonlyArray<RelatedNode>;
  readonly sourceCitations: SourceCitations;
  readonly inputType: InputType;
  readonly choices: ReadonlyArray<Choice> | null;
  readonly calcVariables: Record<string, number> | null;
}

export interface StreakSummary {
  readonly current: number;
  readonly longest: number;
  readonly dailyGoalProgress: number;
}

export interface SessionProgress {
  readonly id: string;
  readonly phase: SessionPhase;
  readonly cardsCompleted: number;
  readonly cardsPlanned: number;
  readonly correctCount: number;
}

export interface GradeResponse {
  readonly isCorrect: boolean;
  readonly correctAnswer: string;
  readonly explanation: string | null;
  readonly sourceCitations: SourceCitations;
  readonly relatedNodes: ReadonlyArray<RelatedNode>;
  readonly correctLabel?: string;
  readonly streak: StreakSummary;
  readonly session?: SessionProgress;
}

export interface NextResponseSession {
  readonly id: string;
  readonly mode: LearningMode;
  readonly phase: SessionPhase;
}

export interface NextResponse {
  readonly exhausted: boolean;
  readonly questions: ReadonlyArray<NextQuestion>;
  readonly session?: NextResponseSession;
}

export type AnswerPhase = 'loading' | 'answering' | 'graded' | 'exhausted' | 'error';

/** 사용자 입력 상태. inputType 별로 의미가 다름. */
export interface AnswerState {
  /** multiple_choice: 선택한 라벨 ('A'~'E') / fill_blank: 단답 / essay: 서술 / calc: 수치 문자열 */
  readonly value: string;
  /** essay 한정 — 자기 채점. */
  readonly selfRating: EssaySelfRating | null;
}

export const EMPTY_ANSWER: AnswerState = { value: '', selfRating: null };

/** 출처를 문자열로 평탄화 — ContextStrip inline 표시용. 최대 3개까지. */
export function flattenSourceCitations(s: SourceCitations): ReadonlyArray<string> {
  const parts: string[] = [];
  const examRef = s.examReferences[0];
  if (examRef !== undefined) {
    const round = examRef.round !== null ? `제${examRef.round}회` : '';
    const num = examRef.questionNumber !== null ? `제${examRef.questionNumber}문` : '';
    parts.push(`${examRef.year}년 ${round} ${num}`.trim().replace(/\s+/g, ' '));
  }
  if (s.manualPages.length > 0) {
    parts.push(`교재 p.${s.manualPages.slice(0, 2).join('·')}`);
  }
  if (s.lawArticles.length > 0) {
    parts.push(s.lawArticles[0]!);
  }
  return parts;
}
