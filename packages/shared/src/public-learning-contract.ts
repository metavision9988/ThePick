/**
 * public-learning-contract — 무인증 공개 학습 표면 `/api/public/*` 와이어 계약 단일 정본.
 *
 * (5-페르소나 P4 RC-5 + P5 M-06 처분, 2026-07-12) 종전 3중 선언 해소:
 *   서버 apps/api/src/public/routes.ts (인라인 interface)
 *   ↔ 클라 apps/web/src/components/public/types.ts
 *   ↔ E2E mock apps/web/e2e/helpers/fixtures.ts
 * 세 곳이 본 모듈을 소비한다. 계약 변경 = 여기 1곳 → 세 표면 컴파일 강제.
 *
 * 스코프 규율: **와이어 shape 전용** — 서버 내부 row/판정(isServable 등)·클라 UI 상태
 * (AttemptRecord 등)는 각자 소유. 시험 특화 리터럴 금지(Rule 15 — examType 은 string,
 * '1st' 고정은 서버 소관). inputType 은 @thepick/learning-modes InputType 과 동일 유니온이나
 * 역의존(shared→learning-modes) 금지 원칙상 리터럴 유니온으로 재선언 — 동치는 각 소비 측
 * 테스트가 고정.
 */

/** 서빙 가능 입력 타입 (공개 표면 = MC·단답만 — essay/calc 미지원). */
export const PUBLIC_SERVABLE_INPUT_TYPES = ['multiple_choice', 'fill_blank'] as const;
export type PublicServableInputType = (typeof PUBLIC_SERVABLE_INPUT_TYPES)[number];

/** 객관식 보기 — choiceId = 불투명 무상태 식별자(HMAC 파생, 셔플시드 대체). */
export interface PublicChoice {
  readonly choiceId: string;
  readonly text: string;
}

/** GET /api/public/questions/next 응답. answer/explanation 절대 비노출. */
export interface PublicNextQuestion {
  readonly id: string;
  readonly year: number;
  readonly round: number | null;
  readonly questionNumber: number | null;
  readonly subject: string | null;
  readonly content: string;
  readonly examType: string;
  readonly inputType: PublicServableInputType;
  /** 객관식만 — 표시 순서 셔플된 보기. 정답 위치 비노출. */
  readonly choices: readonly PublicChoice[] | null;
}

/** POST /api/public/grade 응답 — 정답은 채점 응답에서만 노출. */
export interface PublicGradeResult {
  readonly isCorrect: boolean;
  readonly correctAnswer: string;
  /** 없으면 필드 생략(해설 미보유 문항 — 클라 빈 상태 처리). */
  readonly explanation?: string;
  /** MC 만 — 정답 보기 하이라이트용. */
  readonly correctChoiceIds?: readonly string[];
}

/** POST /api/public/reveal 응답 (카드플립·힌트 파생 — P4-D1). */
export interface PublicRevealResult {
  readonly correctAnswer: string;
  readonly explanation?: string;
  readonly correctChoiceIds?: readonly string[];
}

/** GET /api/public/questions/overview 응답 — 지형도 집계(기출 축). 정답·보기 텍스트 비노출. */
export interface PublicOverview {
  readonly examType: string;
  readonly total: number;
  readonly subjects: ReadonlyArray<{
    readonly subject: string | null;
    readonly total: number;
    readonly rounds: ReadonlyArray<{ readonly round: number | null; readonly total: number }>;
  }>;
}

/**
 * 공개 표면 에러코드 전수 — 서버 발행({error: code}) ↔ 클라 사용자 문구 매핑의 공용 축.
 * 신규 코드 추가 시 여기 등재 → 클라 매핑 테스트(전수 문구 보유)가 누락을 잡는다.
 */
export const PUBLIC_ERROR_CODES = [
  'NO_QUESTION',
  'QUESTION_NOT_FOUND',
  'QUESTION_UNAVAILABLE',
  'QUESTION_HAS_NO_ANSWER',
  'QUESTION_NOT_GRADABLE',
  'TOO_MANY_REQUESTS',
  'VALIDATION_ERROR',
  'CHOICE_ID_REQUIRED',
  'ANSWER_REQUIRED',
  'INTERNAL_ERROR',
] as const;
export type PublicErrorCode = (typeof PUBLIC_ERROR_CODES)[number];
