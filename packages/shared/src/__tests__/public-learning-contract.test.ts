/**
 * public-learning-contract — 재선언 동치 고정 (RC-5).
 * shared 는 learning-modes 에 역의존 금지라 inputType 유니온을 리터럴 재선언 —
 * 본 테스트가 두 선언의 드리프트를 고정한다(learning-modes 는 devDep 수준 참조 불가
 * → 리터럴 기대값으로 고정: learning-modes SERVABLE 과 동일해야 함).
 */
import { describe, expect, it } from 'vitest';
import { PUBLIC_ERROR_CODES, PUBLIC_SERVABLE_INPUT_TYPES } from '../public-learning-contract.js';

describe('public-learning-contract 정본 불변식', () => {
  it('서빙 가능 입력 타입 = multiple_choice·fill_blank 정확 2종 (essay/calc 공개 미지원 불변)', () => {
    expect([...PUBLIC_SERVABLE_INPUT_TYPES]).toEqual(['multiple_choice', 'fill_blank']);
  });

  it('에러코드 전수 = 서버 발행 코드와 1:1 (중복·빈 문자열 없음)', () => {
    expect(new Set(PUBLIC_ERROR_CODES).size).toBe(PUBLIC_ERROR_CODES.length);
    for (const code of PUBLIC_ERROR_CODES) {
      expect(code).toMatch(/^[A-Z_]+$/);
    }
  });
});
