/**
 * public/choice-id 단위 테스트 — 불투명 choiceId 발급/복원 왕복.
 */

import { describe, expect, it } from 'vitest';
import { CHOICE_ID_HEX_LENGTH, issueChoiceId, resolveChoiceId } from '../choice-id.js';

const SECRET = 'unit-test-secret-32bytes-plus-abcdefg';

describe('choice-id', () => {
  it('issueChoiceId: 24-hex, 결정적, 위치별 상이', async () => {
    const a = await issueChoiceId(SECRET, 'q1', 0);
    const b = await issueChoiceId(SECRET, 'q1', 1);
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(a).toHaveLength(CHOICE_ID_HEX_LENGTH);
    expect(a).not.toBe(b);
    // 결정성 — 같은 (secret, qId, idx) → 같은 값.
    expect(await issueChoiceId(SECRET, 'q1', 0)).toBe(a);
  });

  it('resolveChoiceId: 발급 choiceId → originalIndex 왕복', async () => {
    for (let i = 0; i < 4; i++) {
      const cid = await issueChoiceId(SECRET, 'q2', i);
      expect(await resolveChoiceId(SECRET, 'q2', 4, cid)).toBe(i);
    }
  });

  it('resolveChoiceId: 위조/타문항/길이불일치 → null', async () => {
    const cid = await issueChoiceId(SECRET, 'q3', 1);
    // 타 문항 secret 도메인 → 매칭 실패
    expect(await resolveChoiceId(SECRET, 'OTHER', 4, cid)).toBeNull();
    // 손상된 값
    expect(await resolveChoiceId(SECRET, 'q3', 4, 'deadbeefdeadbeefdeadbeef')).toBeNull();
    // 길이 불일치 즉시 거부
    expect(await resolveChoiceId(SECRET, 'q3', 4, 'short')).toBeNull();
  });

  it('secret 미설정(빈 문자열)도 폴백 키로 동작 (왕복 성립)', async () => {
    const cid = await issueChoiceId('', 'q4', 2);
    expect(cid).toMatch(/^[0-9a-f]{24}$/);
    expect(await resolveChoiceId('', 'q4', 4, cid)).toBe(2);
  });

  it('choiceId 는 정답 여부를 노출하지 않음 (위치 식별자일 뿐)', async () => {
    // 같은 문항의 정답/오답 choiceId 는 형태상 구분 불가 (둘 다 24-hex 랜덤).
    const c0 = await issueChoiceId(SECRET, 'q5', 0);
    const c1 = await issueChoiceId(SECRET, 'q5', 1);
    expect(c0).toMatch(/^[0-9a-f]{24}$/);
    expect(c1).toMatch(/^[0-9a-f]{24}$/);
  });
});
