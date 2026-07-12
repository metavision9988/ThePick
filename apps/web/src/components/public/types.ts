/**
 * 공개 학습 표면 타입 — 와이어 계약 정본 = @thepick/shared public-learning-contract
 * (RC-5 단일화, 2026-07-12 — 종전 이 파일의 인라인 재선언을 re-export 로 대체).
 *
 * 이 파일에는 **UI 전용 타입**(세션 상태·집계)만 남긴다. 계약 변경은 shared 1곳에서.
 * 인증 표면(components/question/types.ts)과 choices 형태가 다름은 불변:
 * 인증 = {label, text}(userId 시드 셔플) / 공개 = {choiceId, text}(불투명 무상태 채점).
 */

import type { InputType } from '@thepick/learning-modes';
import type { PublicNextQuestion } from '@thepick/shared';

export type { InputType };

export type {
  PublicChoice,
  PublicGradeResult,
  PublicOverview,
  PublicRevealResult,
  PublicErrorCode,
  PublicServableInputType,
} from '@thepick/shared';

/** 종전 로컬명 유지 — 컴포넌트 전반이 PublicQuestion 으로 소비(정본 = PublicNextQuestion). */
export type PublicQuestion = PublicNextQuestion;

/** 공개 표면 학습 모드 3종 (FE-2/4/5) — UI 전용. */
export const PRACTICE_MODES = ['mc', 'blank', 'flip'] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

/** 한 문항 풀이 기록 — 세션 요약(FE-8) 집계용 (메모리 한정, 서버 전송 0). UI 전용. */
export interface AttemptRecord {
  readonly questionId: string;
  readonly subject: string | null;
  readonly isCorrect: boolean | null;
  readonly hintsUsed: number;
}
