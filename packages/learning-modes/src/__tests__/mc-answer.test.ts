/**
 * mc-answer 계약 정본 검증 — 결재 #2 (a) 위치 라벨형 (2026-06-11).
 *
 * G-WS1 결합 게이트 포함: 위치 1~4 전순열 × 셔플 시드 10종 = 채점 100% 정합
 * (적재 형태 → 셔플 → 채점 end-to-end, 감사 critical 3중 모순의 회귀 차단).
 */

import { describe, expect, it } from 'vitest';
import {
  MC_MAX_CHOICES,
  answerLabelsFitChoices,
  parseMcAnswerLabels,
} from '../input-types/mc-answer.js';
import { gradeMultipleChoice } from '../input-types/multiple-choice.js';
import { CHOICE_LABELS, shuffleChoices } from '../shuffle.js';

describe('parseMcAnswerLabels — 현행 production 데이터 형식 (실측 2026-06-11)', () => {
  it('plain 숫자 "1"~"4" (519건 형식) → 0-based 단원소 집합', () => {
    expect(parseMcAnswerLabels('1')).toEqual(new Set([0]));
    expect(parseMcAnswerLabels('4')).toEqual(new Set([3]));
  });

  it('복수정답 (production 6건 형식) — "2,3" / "1,2,3,4" / "2,4"', () => {
    expect(parseMcAnswerLabels('2,3')).toEqual(new Set([1, 2]));
    expect(parseMcAnswerLabels('1,2,3,4')).toEqual(new Set([0, 1, 2, 3]));
    expect(parseMcAnswerLabels('2,4')).toEqual(new Set([1, 3]));
    expect(parseMcAnswerLabels('2, 3')).toEqual(new Set([1, 2])); // 공백 관용
  });

  it('관용 형식 — "3번" / "③"', () => {
    expect(parseMcAnswerLabels('3번')).toEqual(new Set([2]));
    expect(parseMcAnswerLabels('③')).toEqual(new Set([2]));
  });

  it('거부 — 빈/범위외/비숫자/중복/비정형 콤마 → null', () => {
    expect(parseMcAnswerLabels('')).toBeNull();
    expect(parseMcAnswerLabels('0')).toBeNull();
    expect(parseMcAnswerLabels('6')).toBeNull();
    expect(parseMcAnswerLabels('정답은 3')).toBeNull();
    expect(parseMcAnswerLabels('3,3')).toBeNull(); // 중복 = 데이터 오류 신호
    expect(parseMcAnswerLabels('3,')).toBeNull();
    expect(parseMcAnswerLabels('보험가액의 80%')).toBeNull(); // 2차 서술형 — 비대상
  });

  it('거부 — 유니코드 적대 변형 전수 (리뷰 P12-m4 프로브 영속: 거부 경계 회귀 차단)', () => {
    expect(parseMcAnswerLabels('３')).toBeNull(); // 전각 숫자
    expect(parseMcAnswerLabels('2，3')).toBeNull(); // 전각 콤마
    expect(parseMcAnswerLabels('2、3')).toBeNull(); // CJK 콤마
    expect(parseMcAnswerLabels('٣')).toBeNull(); // 아랍 숫자
    expect(parseMcAnswerLabels('②③')).toBeNull(); // 연결 원형숫자
    expect(parseMcAnswerLabels('2 3')).toBeNull(); // 공백 구분 (콤마 아님)
    expect(parseMcAnswerLabels('03')).toBeNull(); // 선행 0
    expect(parseMcAnswerLabels('1,1,2')).toBeNull(); // 부분 중복
  });

  it('MC_MAX_CHOICES = CHOICE_LABELS 길이 (셔플 경로 계약 공유 — 리뷰 P12-m2/P34-M1)', () => {
    expect(MC_MAX_CHOICES).toBe(CHOICE_LABELS.length);
  });
});

describe('answerLabelsFitChoices — 위치↔보기수 정합', () => {
  it('answer "4" + 보기 4개 = 정합 / 보기 3개 = 위반', () => {
    const labels = parseMcAnswerLabels('4')!;
    expect(answerLabelsFitChoices(labels, 4)).toBe(true);
    expect(answerLabelsFitChoices(labels, 3)).toBe(false);
  });
  it('보기 1개 이하·6개 이상 = 위반', () => {
    const labels = parseMcAnswerLabels('1')!;
    expect(answerLabelsFitChoices(labels, 1)).toBe(false);
    expect(answerLabelsFitChoices(labels, 6)).toBe(false);
  });
});

describe('★ G-WS1 결합 게이트 — 적재형태→셔플→채점 전순열×시드 100% 정합', () => {
  const CHOICES_4 = ['갑의 보험가액', '을의 손해액', '병의 면책금', '정의 자기부담금'];

  it('4지선다: 정답 위치 1~4 전순열 × 시드(일자) 10종 — 정답 보기 제출 = 항상 정답, 타 보기 = 항상 오답', async () => {
    for (let pos = 1; pos <= 4; pos++) {
      const answer = String(pos); // 적재 형태 그대로
      const correct = parseMcAnswerLabels(answer);
      expect(correct).not.toBeNull();

      for (let seed = 0; seed < 10; seed++) {
        const shuffled = await shuffleChoices(CHOICES_4, {
          userId: `user-${seed}`,
          questionId: 'Q-PERM',
          date: `2026-06-${String(seed + 1).padStart(2, '0')}`,
        });
        for (const choice of shuffled) {
          const result = gradeMultipleChoice({
            submittedLabel: choice.label,
            shuffledChoices: shuffled,
            correctOriginalIndices: correct,
          });
          const shouldBeCorrect = choice.originalIndex === pos - 1;
          expect(result.isCorrect).toBe(shouldBeCorrect); // 단 1건 불일치 = 3중 모순 회귀
        }
      }
    }
  });

  it('5지선다: 정답 위치 1~5 전순열 × 시드 10종 (MASTER_PLAN G-WS1 ② 원문 — 리뷰 P34-M2)', async () => {
    const CHOICES_5 = [...CHOICES_4, '무의 잔존물제거비용'];
    for (let pos = 1; pos <= 5; pos++) {
      const correct = parseMcAnswerLabels(String(pos));
      expect(correct).not.toBeNull();
      for (let seed = 0; seed < 10; seed++) {
        const shuffled = await shuffleChoices(CHOICES_5, {
          userId: `user5-${seed}`,
          questionId: 'Q-PERM5',
          date: `2026-06-${String(seed + 1).padStart(2, '0')}`,
        });
        for (const choice of shuffled) {
          const result = gradeMultipleChoice({
            submittedLabel: choice.label,
            shuffledChoices: shuffled,
            correctOriginalIndices: correct,
          });
          expect(result.isCorrect).toBe(choice.originalIndex === pos - 1);
        }
      }
    }
  });

  it('복수정답 "2,3": 위치 2·3 보기는 정답, 1·4 는 오답 — 시드 10종', async () => {
    const correct = parseMcAnswerLabels('2,3')!;
    for (let seed = 0; seed < 10; seed++) {
      const shuffled = await shuffleChoices(CHOICES_4, {
        userId: `multi-${seed}`,
        questionId: 'Q-MULTI',
        date: `2026-06-${String(seed + 1).padStart(2, '0')}`,
      });
      for (const choice of shuffled) {
        const result = gradeMultipleChoice({
          submittedLabel: choice.label,
          shuffledChoices: shuffled,
          correctOriginalIndices: correct,
        });
        expect(result.isCorrect).toBe(choice.originalIndex === 1 || choice.originalIndex === 2);
      }
    }
  });
});
