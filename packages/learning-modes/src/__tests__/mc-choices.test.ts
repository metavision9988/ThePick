/**
 * mc-choices 단위 테스트 — 보기 배열 + answer 계약 파싱 단일 정본.
 *
 * 구 buildShuffledChoices 내부 검증(무음 filter 금지·위치 정합·동치 거부)이
 * 순수 함수로 격리된 후에도 동일 계약을 유지하는지 회귀 고정.
 */

import { describe, expect, it } from 'vitest';
import { parseMcChoices } from '../input-types/mc-choices.js';

const FOUR = ['가', '나', '다', '라'];

describe('parseMcChoices', () => {
  it('정상 4지선다: originalTexts + 정답 위치 집합(0-based)', () => {
    const r = parseMcChoices(JSON.stringify(FOUR), '2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.originalTexts).toEqual(FOUR);
      expect([...r.correctOriginalIndices]).toEqual([1]);
    }
  });

  it('복수정답 "2,3" → {1,2}', () => {
    const r = parseMcChoices(JSON.stringify(FOUR), '2,3');
    expect(r.ok).toBe(true);
    if (r.ok) expect([...r.correctOriginalIndices].sort()).toEqual([1, 2]);
  });

  it('distractors NULL/빈 → no_distractors', () => {
    expect(parseMcChoices(null, '1')).toEqual({ ok: false, reason: 'no_distractors' });
    expect(parseMcChoices('', '1')).toEqual({ ok: false, reason: 'no_distractors' });
  });

  it('answer NULL/빈 → no_answer', () => {
    expect(parseMcChoices(JSON.stringify(FOUR), null)).toEqual({ ok: false, reason: 'no_answer' });
    expect(parseMcChoices(JSON.stringify(FOUR), '')).toEqual({ ok: false, reason: 'no_answer' });
  });

  it('JSON 배열 아님 → distractors_not_array', () => {
    expect(parseMcChoices('{"a":1}', '1')).toEqual({
      ok: false,
      reason: 'distractors_not_array',
    });
  });

  it('JSON 파싱 실패 → distractors_parse_failed', () => {
    expect(parseMcChoices('[not json', '1')).toEqual({
      ok: false,
      reason: 'distractors_parse_failed',
    });
  });

  it('★무음 filter 금지: 빈/공백 원소 → distractors_invalid_element (위치 오염 차단)', () => {
    expect(parseMcChoices(JSON.stringify(['가', '', '다', '라']), '1')).toEqual({
      ok: false,
      reason: 'distractors_invalid_element',
    });
    expect(parseMcChoices(JSON.stringify(['가', '  ', '다']), '1')).toEqual({
      ok: false,
      reason: 'distractors_invalid_element',
    });
  });

  it('answer 위치가 보기 수 초과 → answer_contract_violation', () => {
    expect(parseMcChoices(JSON.stringify(['가', '나']), '3')).toEqual({
      ok: false,
      reason: 'answer_contract_violation',
    });
  });

  it('answer 비위치형(서술) → answer_contract_violation', () => {
    expect(parseMcChoices(JSON.stringify(FOUR), '보험가액')).toEqual({
      ok: false,
      reason: 'answer_contract_violation',
    });
  });

  it('동치 보기(normalize 후 동일) → duplicate_choice_text + index 쌍', () => {
    const r = parseMcChoices(JSON.stringify(['가', '가', '다', '라']), '3');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('duplicate_choice_text');
      expect(r.collisionIndexPairs).toBe('0=1');
    }
  });
});
