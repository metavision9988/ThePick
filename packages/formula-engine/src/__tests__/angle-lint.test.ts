/**
 * G-FE-3 C축 — 각도 규약 lint 게이트 (plan §5: "규약 위반 저작 검출 1건 이상 red 확인").
 */
import { describe, expect, it } from 'vitest';
import { lintAngleConvention } from '../angle-lint';

describe('lintAngleConvention (G-FE-3 C축)', () => {
  it('red — sin(theta_deg) 직저작 = 위반 검출 (라디안 무음 평가 차단)', () => {
    const v = lintAngleConvention('v_1 * sin(theta_deg)');
    expect(v).toHaveLength(1);
    expect(v[0]).toContain("'theta_deg'");
    expect(v[0]).toContain('deg2rad');
  });

  it('red — 중첩 인자 내부의 미보호 _deg 도 검출 (cos(a_deg + 0.5))', () => {
    expect(lintAngleConvention('cos(a_deg + 0.5)')).toHaveLength(1);
  });

  it('red — 다중 삼각함수 각각 위반 집계', () => {
    expect(lintAngleConvention('sin(a_deg) + tan(b_deg)')).toHaveLength(2);
  });

  it('green — sin(deg2rad(theta_deg)) 규약 준수', () => {
    expect(lintAngleConvention('v_1 * sin(deg2rad(theta_deg))')).toEqual([]);
  });

  it('green — 라디안 변수 sin(omega * t) 는 규약 무관', () => {
    expect(lintAngleConvention('v_m * sin(omega * t + phi)')).toEqual([]);
  });

  it('green — 삼각함수 밖의 _deg 사용은 위반 아님 (온도 등 비각도 도 단위)', () => {
    expect(lintAngleConvention('temp_deg * 1.8 + 32')).toEqual([]);
  });

  it('fail-loud — 복잡도 한도 초과는 raw throw 아닌 lint 불능 보고 (P1-M1/P3-MAJ-1 계약 수렴)', () => {
    const bomb = Array.from({ length: 151 }, () => '1').join('+'); // 노드 수 한도 초과·길이 한도 내
    const v = lintAngleConvention(bomb);
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('lint 불능: 복잡도 한도 초과');
  });

  it('fail-loud — 파싱 불가 표현식은 무음 통과가 아니라 lint 불능 보고', () => {
    const v = lintAngleConvention('sin(theta_deg');
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('lint 불능');
  });
});
