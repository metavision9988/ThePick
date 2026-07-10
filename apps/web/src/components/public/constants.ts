/**
 * 공개 학습 표면 상수 — 모드 토큰(claudeDesign MODES 패턴) + 과목/회차 필터.
 *
 * 과목 목록은 production exam_questions 1차 active 실측 3과목(2026-07-10 SELECT 검증).
 * 서버가 subject 목록 API 를 제공하지 않으므로(v1 스코프) 표시용 상수 — 값 불일치 시
 * NO_QUESTION 빈 상태로 정직 강하(무음 오동작 없음).
 */

import type { InputType, PracticeMode } from './types';

export interface PracticeModeMeta {
  readonly id: PracticeMode;
  readonly label: string;
  readonly hint: string;
  /** 좌측 2px 보더/dot 전용 색 (카드 틴트 금지 — 디자인 정본). */
  readonly color: string;
  readonly tone: string;
  /** 서빙 필터 — null 이면 서빙 가능 전 타입. */
  readonly inputType: InputType | null;
}

export const PRACTICE_MODE_META: readonly PracticeModeMeta[] = [
  {
    id: 'mc',
    label: '4지선다',
    hint: '실제 기출 그대로 — 풀고 바로 채점',
    color: '#4f46e5',
    tone: 'text-indigo-700',
    inputType: 'multiple_choice',
  },
  {
    id: 'blank',
    label: '빵꾸노트',
    hint: '핵심 용어를 직접 꺼내 쓰기 — 막히면 단계 힌트',
    color: '#f59e0b',
    tone: 'text-amber-700',
    inputType: 'fill_blank',
  },
  {
    id: 'flip',
    label: '카드플립',
    hint: '머릿속으로 답하고 뒤집어 확인 — 간격 반복 복습',
    color: '#10b981',
    tone: 'text-emerald-700',
    inputType: null,
  },
] as const;

/** 1차 시험 3과목 (production 실측 subject 값 — 표시·필터 공용). */
export const FIRST_EXAM_SUBJECTS: readonly string[] = [
  '상법 보험편',
  '농어업재해보험법령',
  '농학개론 중 재배학 및 원예작물학',
] as const;

/** 기출 회차 범위 — 제5회~제11회 (7회분). */
export const FIRST_EXAM_ROUNDS: readonly number[] = [5, 6, 7, 8, 9, 10, 11] as const;

/** 원문자 보기 번호 (claudeDesign ChoiceRow). */
export const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤'] as const;

/** 세션 길이 기본값 — 요약(FE-8)까지 한 호흡. */
export const DEFAULT_SESSION_SIZE = 10;
