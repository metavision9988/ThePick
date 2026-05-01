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

/** 등록된 모든 시험 ID 값 — runtime allowlist. Year 2 확장 시 EXAM_IDS 추가만으로 자동 반영. */
const ALL_EXAM_ID_VALUES: ReadonlyArray<string> = Object.values(EXAM_IDS);

/**
 * runtime ExamId 검증 (Hard Rule 17 외부 입력 방어선).
 *
 * brand type `ExamId` 는 컴파일 타임 보호만 제공. JSON deserialization (CLI arg,
 * external input → context 변환), test fixture `as ExamId` 캐스팅, 또는
 * `@ts-expect-error` 우회 시 임의 string 진입 가능. 본 type guard 가 EXAM_IDS
 * allowlist 비교로 caller 진입점 (pipeline.ts runPipeline 등) 에서 strict 차단.
 *
 * 근거: 4-Pass review (.claude/reviews/step16b-pass12-20260430-110057.md Pass 2 반론)
 *   — "brand type ExamId 우회 시나리오 — '' 만 차단, 임의 string ('invalid-exam') 미검증"
 */
export function isValidExamId(candidate: string): candidate is ExamId {
  return ALL_EXAM_ID_VALUES.includes(candidate);
}

/**
 * 검증 실패 시 throw — caller 진입점 strict 차단 패턴.
 *
 * 사용처: CLI argument 파싱, REST API request body, pipeline.ts runPipeline 진입,
 * 외부 trigger 메시지 디코드. 모든 진입점에서 1회 호출하여 internal 코드 경로는
 * brand type 보호만으로 안전 보장.
 */
export function assertValidExamId(candidate: string): ExamId {
  if (!isValidExamId(candidate)) {
    throw new Error(
      `Invalid examId: '${candidate}'. Allowed values: ${ALL_EXAM_ID_VALUES.join(', ')}.`,
    );
  }
  return candidate;
}
