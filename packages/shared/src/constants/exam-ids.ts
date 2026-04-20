/**
 * 시험 식별자 단일 선언처.
 *
 * 근거: Hard Rule 17 (.claude/rules/production-quality.md) + ADR-007.
 * 시험 ID 리터럴은 본 파일 이외 어느 곳에도 등장하지 않는다. 나머지 코드는
 * `ExamId` 타입(packages/shared/src/exam-adapter.ts)을 통해 전파.
 *
 * 현재 (Year 1): 손해평가사 1종.
 * Year 2 이후: 공인중개사 등 추가 시 본 객체에만 항목 추가.
 */

import type { ExamId } from '../exam-adapter.js';

export const EXAM_IDS = {
  /** 손해평가사 자격시험 (1차 + 2차 통합). */
  SON_HAE_PYEONG_GA_SA: 'son-hae-pyeong-ga-sa' as ExamId,
} as const;

/** Year 1 기본값. Year 2 Phase 4 adapter 주입 전환 시 사용 중단. */
export const DEFAULT_EXAM_ID: ExamId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;
