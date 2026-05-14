/**
 * Step 3-UX-7a — distractor 파이프라인 schema (admin UI mock 한정, 7c chunk에서 packages/shared 이전 검토).
 *
 * 5지선다 오답 후보 BATCH 보강 워크플로우:
 *   1. apps/batch (7b)가 기출 PDF에서 5지선다 추출 → DistractorBatchOutput JSON dump
 *   2. adminUI (본 chunk + 7c)가 dump 로드 → 진산 검수 → exam_questions.distractors UPDATE
 *   3. status: draft → reviewed → approved (ContentStatus 정합)
 *
 * 본 chunk(7a)는 mock UI만 — 실 API 호출 / DB 갱신은 7c chunk.
 * Hard Limit: AI 생성 데이터는 draft만 적재 (인간 검수 후 approved).
 *
 * 근거: docs/plans/phase3-learning-ux-modes.plan.md §6.3 + §13 D1 (★ 기출 원문 5지선다 추출 + adminUI 검수 lock).
 */

import type { ContentStatus } from '@thepick/shared';

/** Step 3-UX-7b BATCH 추출 input (PDF + 정답지 경로). 본 chunk 사용 없음. */
export interface DistractorBatchInput {
  readonly examPdfPath: string;
  readonly answerKeyPath: string;
  readonly examYear: number;
  readonly examRound: number;
  readonly examType: '1st' | '2nd';
}

/**
 * Step 3-UX-7b BATCH 추출 output (PDF 1회분 = ~25문 / 1차 1교시 기준).
 *
 * `extractedChoices`는 [정답 포함] 5지 전체 raw text.
 * `correctIndex`는 정답지 cross-check 결과 (0~4). 정답 라벨은 exam_questions.answer와 일치 검증.
 * `confidence` < 0.85 시 admin 검수 우선순위 상향 (UI sort key).
 */
export interface DistractorBatchOutput {
  readonly questionId: string; // exam_questions.id
  readonly questionNumber: number;
  readonly extractedChoices: ReadonlyArray<string>; // 5지 raw text [정답 + 4 distractor]
  readonly correctIndex: number; // 0~4, 정답지 cross-check 결과
  readonly confidence: number; // 0~1, pdfplumber 추출 신뢰도
  readonly extractedAt: string; // ISO 8601
}

/**
 * adminUI review queue 단위 (BATCH output + 검수 메타).
 *
 * `distractors`는 정답 제외 4 raw text (셔플 전). UI에서 진산이 수정/승인.
 * `originalChoices`는 BATCH가 추출한 원본 5지 (정답 포함 비교용).
 */
export interface DistractorReviewItem {
  readonly questionId: string;
  readonly questionNumber: number;
  readonly questionContent: string;
  readonly correctAnswer: string; // exam_questions.answer (e.g., "③" 또는 "3")
  readonly examYear: number;
  readonly examRound: number;
  readonly examType: '1st' | '2nd';
  readonly subject: string | null;
  readonly originalChoices: ReadonlyArray<string>; // BATCH 추출 raw 5지
  readonly distractors: ReadonlyArray<string>; // 정답 제외 4 distractor (검수자 수정 가능)
  readonly confidence: number;
  readonly status: ContentStatus; // draft / review / approved / flagged
  readonly reviewerNote: string | null;
  readonly updatedAt: string;
}

/**
 * adminUI 검수 액션 → 7c chunk에서 PUT /api/admin/distractors/:questionId로 매핑.
 * 본 chunk(7a)는 onChange callback만, 실 API 미연결.
 */
export interface DistractorUpdatePayload {
  readonly questionId: string;
  readonly distractors: ReadonlyArray<string>;
  readonly status: ContentStatus;
  readonly reviewerNote: string | null;
}

/** 검수 화면 정렬 키 — 낮은 confidence + draft 우선 표시 정합 (검수 효율). */
export type DistractorSortKey = 'confidence-asc' | 'updated-desc' | 'number-asc';

/** mock seed — 7a 한정. 7c에서 실 API fetch로 대체. */
export const MOCK_DISTRACTOR_ITEMS: ReadonlyArray<DistractorReviewItem> = [
  {
    questionId: 'q-2024-10-1-001',
    questionNumber: 1,
    questionContent: '농업재해보험법령상 농업재해보험심의회의 구성에 관한 설명으로 옳지 않은 것은?',
    correctAnswer: '③',
    examYear: 2024,
    examRound: 10,
    examType: '1st',
    subject: '농업재해보험법',
    originalChoices: [
      '① 심의회는 위원장 1명과 부위원장 1명을 포함한 20명 이내의 위원으로 구성한다',
      '② 위원장은 농림축산식품부차관으로 한다',
      '③ 부위원장은 위원장이 위원 중에서 지명한다',
      '④ 위원의 임기는 3년으로 한다',
      '⑤ 심의회 회의는 재적위원 과반수의 출석으로 개의한다',
    ],
    distractors: [
      '심의회는 위원장 1명과 부위원장 1명을 포함한 20명 이내의 위원으로 구성한다',
      '위원장은 농림축산식품부차관으로 한다',
      '위원의 임기는 3년으로 한다',
      '심의회 회의는 재적위원 과반수의 출석으로 개의한다',
    ],
    confidence: 0.92,
    status: 'draft',
    reviewerNote: null,
    updatedAt: '2026-05-14T08:00:00.000Z',
  },
  {
    questionId: 'q-2024-10-1-002',
    questionNumber: 2,
    questionContent: '재해보험요율 산정에 관한 설명으로 옳은 것은?',
    correctAnswer: '①',
    examYear: 2024,
    examRound: 10,
    examType: '1st',
    subject: '농업재해보험법',
    originalChoices: [
      '① 보험요율은 보험상품별로 산출한다',
      '② 보험요율은 정부가 직접 산출한다',
      '③ 보험요율은 매년 인상된다',
      '④ 보험요율은 농가별로 다르다',
      '⑤ 보험요율은 5년 단위로 조정한다',
    ],
    distractors: [
      '보험요율은 정부가 직접 산출한다',
      '보험요율은 매년 인상된다',
      '보험요율은 농가별로 다르다',
      '보험요율은 5년 단위로 조정한다',
    ],
    confidence: 0.78, // 낮은 신뢰도 — 우선 검수 권장
    status: 'draft',
    reviewerNote: null,
    updatedAt: '2026-05-14T08:01:00.000Z',
  },
  {
    questionId: 'q-2024-10-1-003',
    questionNumber: 3,
    questionContent: '적과전 종합위험방식 II의 보장 범위에 해당하는 것은?',
    correctAnswer: '②',
    examYear: 2024,
    examRound: 10,
    examType: '1st',
    subject: '농작물재해보험',
    originalChoices: [
      '① 가뭄 피해',
      '② 자연재해, 조수해, 화재',
      '③ 병충해 전부',
      '④ 가격하락',
      '⑤ 영농비 손실',
    ],
    distractors: ['가뭄 피해', '병충해 전부', '가격하락', '영농비 손실'],
    confidence: 0.95,
    status: 'review',
    reviewerNote: '5지선다 추출 정합 확인 필요 — 정답지 cross-check 완료.',
    updatedAt: '2026-05-14T08:02:00.000Z',
  },
];
