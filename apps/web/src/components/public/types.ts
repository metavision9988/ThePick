/**
 * 공개 학습 표면 타입 — /api/public/* 계약 (apps/api/src/public/routes.ts 정합).
 *
 * 인증 표면(components/question/types.ts)과 choices 형태가 다르다:
 * 인증 = {label, text}(userId 시드 셔플) / 공개 = {choiceId, text}(불투명 무상태 채점).
 */

import type { InputType } from '@thepick/learning-modes';

export type { InputType };

/** 공개 표면 학습 모드 3종 (FE-2/4/5). */
export const PRACTICE_MODES = ['mc', 'blank', 'flip'] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export interface PublicChoice {
  readonly choiceId: string;
  readonly text: string;
}

/** GET /api/public/questions/next 응답 (PublicNextQuestionOut 정합). */
export interface PublicQuestion {
  readonly id: string;
  readonly year: number;
  readonly round: number | null;
  readonly questionNumber: number | null;
  readonly subject: string | null;
  readonly content: string;
  readonly examType: string;
  readonly inputType: InputType;
  /** 객관식만 — 표시 순서 셔플된 보기. 정답 위치 비노출. */
  readonly choices: readonly PublicChoice[] | null;
}

/** POST /api/public/grade 응답. */
export interface PublicGradeResult {
  readonly isCorrect: boolean;
  readonly correctAnswer: string;
  /** 없으면 필드 생략(현 1차 해설 0건 — 빈 상태 처리). */
  readonly explanation?: string;
  /** MC 만 — 정답 보기 하이라이트용. */
  readonly correctChoiceIds?: readonly string[];
}

/** POST /api/public/reveal 응답 (P4-D1 — 카드플립 뒷면·힌트 파생). */
export interface PublicRevealResult {
  readonly correctAnswer: string;
  readonly explanation?: string;
  readonly correctChoiceIds?: readonly string[];
}

/** 한 문항 풀이 기록 — 세션 요약(FE-8) 집계용 (메모리 한정, 서버 전송 0). */
export interface AttemptRecord {
  readonly questionId: string;
  readonly subject: string | null;
  readonly isCorrect: boolean | null;
  readonly hintsUsed: number;
}
