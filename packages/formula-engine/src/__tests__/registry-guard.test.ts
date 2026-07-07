/**
 * 레지스트리 상시 가드 (5-페르소나 리뷰 2026-07-07 P2-M1·P2-M2/P5-M1 처분).
 *
 * ① 전수분할 불변식: ANGLE_ARGUMENT_FUNCTIONS ∩ NON_ANGLE_FUNCTIONS = ∅ + 총수 고정
 *    — ALLOWED_FUNCTIONS 는 두 분류의 합집합 파생이므로, 신규 함수를 분류 없이
 *    추가하는 것 자체가 불가능(구조 강제). 이중 등재만 여기서 차단.
 * ② lint 상시 배선: 코드 레지스트리 전 등록식(getAllFormulas)에 각도 규약 lint 0 위반
 *    — 레지스트리에 삼각 산식이 들어오는 순간 자동 발화 (2호 W5 저작 시 안전망,
 *    배선 누락으로 lint 가 장식이 되는 경로 차단).
 */
import { describe, expect, it } from 'vitest';
import { ANGLE_ARGUMENT_FUNCTIONS, NON_ANGLE_FUNCTIONS } from '../sandbox';
import { lintAngleConvention } from '../angle-lint';
import { getAllFormulas } from '../formulas';

describe('registry-guard (P2-M1·M2 처분)', () => {
  it('전수분할 — 각도/비각도 분류 서로소 + 총수 24 고정 (신규 함수 = 분류 선언 강제)', () => {
    const overlap = [...ANGLE_ARGUMENT_FUNCTIONS].filter((f) => NON_ANGLE_FUNCTIONS.has(f));
    expect(overlap).toEqual([]);
    expect(ANGLE_ARGUMENT_FUNCTIONS.size).toBe(6);
    // 총수 변경 = 의도적 확장 — 이 핀과 분류 등재를 함께 갱신할 것 (무음 드리프트 차단)
    expect(ANGLE_ARGUMENT_FUNCTIONS.size + NON_ANGLE_FUNCTIONS.size).toBe(24);
  });

  it('코드 레지스트리 전 등록식 각도 규약 lint 0 위반 (상시 배선 — 삼각식 인입 시 자동 발화)', () => {
    const formulas = getAllFormulas();
    expect(formulas.length).toBeGreaterThanOrEqual(68); // 워터마크
    for (const f of formulas) {
      const violations = lintAngleConvention(f.equationTemplate);
      expect(violations, `${f.id} 각도 규약 위반`).toEqual([]);
    }
  });
});
