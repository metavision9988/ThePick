/**
 * Formula Engine 확장 골든 테스트 — Tier 1(π·e 내장) + Tier 2(삼각 6 + exp) + deg2rad
 *
 * plan: docs/plans/formula-engine-expansion.plan.md (rev2, §7 위임 결재 2026-07-07)
 *
 * 게이트 매핑:
 *   - G-FE-2: 신규 함수 파싱·평가 골든 (함수별 공학 정본 예시값 ≥2건)
 *             + S6 ❌→해소 5건 실계산 (안정도 sinδ / 동기기 sinδ / 위상각 atan /
 *               순시값 sin / RLC 부족제동 exp×sin 곱)
 *             + 2-인자 log(x,10) 실행 확증 (plan §2-(d))
 *             + 정의역 밖 asin(1.5) fail-loud red (plan §2-(g): Complex 반환 →
 *               safeEvaluate 'not a number' throw)
 *   - G-FE-3: 각도 규약(Q3-A안 = 라디안 전용 + deg2rad) — 도/라디안 golden 동시 PASS.
 *             등치는 prc-01 정밀도 프레임워크 경유 (EPSILON 1e-9 + toFixed(6)) —
 *             naive 등치 금지 (plan §2-(j): sin(deg2rad(30)) = 0.49999999999999994).
 *             ※ `_deg` 접미 lint 검증기(규약 위반 저작 red)는 후속 별건 검증기 스코프.
 *   - G-FE-6(i): 코드 68식 변수명·템플릿 심볼 vs 신규 예약어 충돌 0건 — 상시 회귀 가드
 *               (레지스트리 전수 스캔. D1 157 스캔(ii) 증적 = plan §5b 게이트 기록 —
 *               2026-07-07 독립 리뷰: 로컬 SQL 정본 25파일 157/157 파싱·신규 예약어 충돌 0).
 *   - G-FE-7: π·e 값 자릿수 전수 대조 (Math.PI/Math.E 비트 동치 — 이 블록만 의도적
 *             naive 등치: "자릿수 전수 대조"가 게이트 정의 자체이므로).
 *             2호 기출 역검증은 W5 전 → 1호 68식 원주율 사용 산식 부재 확인으로 대체
 *             (게이트 문면의 대체 조항 — 아래 예약어 스캔 테스트가 pi/e 부재를 전수 확증).
 *
 * 오라클: JS Math.* (mathjs number 경로와 독립 표면 — V8 내장) + 수학 정본값.
 */

import { describe, it, expect } from 'vitest';
import { safeParse, safeEvaluate } from '../sandbox';
import { getAllFormulas } from '../formulas';

const EPSILON = 1e-9; // prc-01 정밀도 프레임워크와 동일

/** safeParse → compile → safeEvaluate 헬퍼 (파싱 실패 = 즉시 fail-loud) */
function evalExpr(expr: string, scope: Record<string, number> = {}): number {
  const r = safeParse(expr);
  if (!r.ok) {
    throw new Error(`safeParse failed for '${expr}': ${r.message}`);
  }
  return safeEvaluate(r.node.compile(), scope);
}

// ===========================================================================
// G-FE-2 — 신규 함수별 공학 정본 예시값 골든 (각 ≥2건, 경계 포함)
// ===========================================================================
describe('G-FE-2 — 삼각 6 + exp 함수별 골든 (정본 예시값 ≥2건)', () => {
  it('sin: sin(pi/6) = 0.5 / sin(pi/2) = 1 / sin(0) = 0 (경계)', () => {
    expect(Math.abs(evalExpr('sin(pi/6)') - 0.5)).toBeLessThan(EPSILON);
    expect(evalExpr('sin(pi/6)').toFixed(6)).toBe('0.500000');
    expect(Math.abs(evalExpr('sin(pi/2)') - 1)).toBeLessThan(EPSILON);
    expect(evalExpr('sin(0)')).toBe(0);
  });

  it('cos: cos(0) = 1 (경계) / cos(pi/3) = 0.5 / cos(pi) = -1', () => {
    expect(evalExpr('cos(0)')).toBe(1);
    expect(Math.abs(evalExpr('cos(pi/3)') - 0.5)).toBeLessThan(EPSILON);
    expect(evalExpr('cos(pi/3)').toFixed(6)).toBe('0.500000');
    expect(Math.abs(evalExpr('cos(pi)') - -1)).toBeLessThan(EPSILON);
  });

  it('tan: tan(pi/4) = 1 / tan(0) = 0 (경계)', () => {
    expect(Math.abs(evalExpr('tan(pi/4)') - 1)).toBeLessThan(EPSILON);
    expect(evalExpr('tan(pi/4)').toFixed(6)).toBe('1.000000');
    expect(evalExpr('tan(0)')).toBe(0);
  });

  it('asin: asin(0.5) = pi/6 / asin(1) = pi/2 (정의역 상단 경계)', () => {
    expect(Math.abs(evalExpr('asin(0.5)') - Math.PI / 6)).toBeLessThan(EPSILON);
    expect(Math.abs(evalExpr('asin(1)') - Math.PI / 2)).toBeLessThan(EPSILON);
  });

  it('acos: acos(0.5) = pi/3 / acos(1) = 0 (정의역 상단 경계)', () => {
    expect(Math.abs(evalExpr('acos(0.5)') - Math.PI / 3)).toBeLessThan(EPSILON);
    expect(evalExpr('acos(1)')).toBe(0);
  });

  it('atan: atan(1) = pi/4 / atan(0) = 0 (경계)', () => {
    expect(Math.abs(evalExpr('atan(1)') - Math.PI / 4)).toBeLessThan(EPSILON);
    expect(evalExpr('atan(0)')).toBe(0);
  });

  it('exp: exp(0) = 1 (경계) / exp(1) = e / exp(-1) = 1/e', () => {
    expect(evalExpr('exp(0)')).toBe(1);
    expect(Math.abs(evalExpr('exp(1)') - Math.E)).toBeLessThan(EPSILON);
    expect(Math.abs(evalExpr('exp(-1)') - 1 / Math.E)).toBeLessThan(EPSILON);
    expect(evalExpr('exp(-1)').toFixed(6)).toBe('0.367879');
  });
});

// ===========================================================================
// G-FE-2 — S6 ❌→해소 5건 실계산 (전력공학 정본 예시)
// ===========================================================================
describe('G-FE-2 — S6 해소 5건 실계산', () => {
  it('(1) 송전 안정도(원선도): p = v1*v2/x*sin(delta) — per-unit 1.0/1.0/0.5, δ=30° → 1.0', () => {
    const p = evalExpr('v1*v2/x*sin(delta)', { v1: 1.0, v2: 1.0, x: 0.5, delta: Math.PI / 6 });
    expect(Math.abs(p - 1.0)).toBeLessThan(EPSILON);
    expect(p.toFixed(6)).toBe('1.000000');
    // 최대 송전전력 (δ=90°): 154kV 계통, X=59.29Ω → 154²/59.29 = 400 MW
    const pMax = evalExpr('v1*v2/x*sin(delta)', {
      v1: 154,
      v2: 154,
      x: 59.29,
      delta: Math.PI / 2,
    });
    expect(Math.abs(pMax - 400)).toBeLessThan(EPSILON);
  });

  it('(2) 동기기 출력: p = e_f*v/x_s*sin(delta) — 2.0/1.0/1.25, δ=30° → 0.8', () => {
    const p = evalExpr('e_f*v/x_s*sin(delta)', {
      e_f: 2.0,
      v: 1.0,
      x_s: 1.25,
      delta: Math.PI / 6,
    });
    expect(Math.abs(p - 0.8)).toBeLessThan(EPSILON);
    expect(p.toFixed(6)).toBe('0.800000');
    // δ=90° (최대 출력)
    const pMax = evalExpr('e_f*v/x_s*sin(delta)', {
      e_f: 1.5,
      v: 1.0,
      x_s: 0.75,
      delta: Math.PI / 2,
    });
    expect(Math.abs(pMax - 2.0)).toBeLessThan(EPSILON);
  });

  it('(3) 위상각·역률: theta = atan(x/r) — R=3Ω, X=4Ω → 53.13°, cosθ = R/Z = 0.6', () => {
    const theta = evalExpr('atan(x/r)', { x: 4, r: 3 });
    expect(Math.abs(theta - Math.atan(4 / 3))).toBeLessThan(EPSILON);
    // 도 환산 검산: 0.927295218 rad = 53.130102...°
    expect(((theta * 180) / Math.PI).toFixed(4)).toBe('53.1301');
    // 역률 = cos(atan(X/R)) = 3/5 = 0.6 (3-4-5 직각삼각형 정본)
    const pf = evalExpr('cos(atan(x/r))', { x: 4, r: 3 });
    expect(Math.abs(pf - 0.6)).toBeLessThan(EPSILON);
    expect(pf.toFixed(6)).toBe('0.600000');
  });

  it('(4) 순시값: v = v_m*sin(w*t + phi) — Vm=100, ωt+φ=30° → 50', () => {
    const v = evalExpr('v_m*sin(w*t + phi)', { v_m: 100, w: 377, t: 0, phi: Math.PI / 6 });
    expect(Math.abs(v - 50)).toBeLessThan(EPSILON);
    expect(v.toFixed(6)).toBe('50.000000');
    // deg2rad 저작 형태 (Q3-A안): i = Im·sin(30°) = 5
    const i = evalExpr('i_m*sin(deg2rad(theta_deg))', { i_m: 10, theta_deg: 30 });
    expect(Math.abs(i - 5)).toBeLessThan(EPSILON);
  });

  it('(5) RLC 부족제동(underdamped): exp(-alpha*t)*sin(w_d*t) 곱 — e^(-0.5)·sin(π/2)', () => {
    const x = evalExpr('exp(-alpha*t)*sin(w_d*t)', { alpha: 1, t: 0.5, w_d: Math.PI });
    expect(Math.abs(x - Math.exp(-0.5))).toBeLessThan(EPSILON);
    expect(x.toFixed(6)).toBe('0.606531');
    // t=0 경계: exp(0)·sin(0) = 0
    expect(evalExpr('exp(-alpha*t)*sin(w_d*t)', { alpha: 1, t: 0, w_d: Math.PI })).toBe(0);
  });
});

// ===========================================================================
// G-FE-2 — 2-인자 log(x, 10) 실행 확증 (plan §2-(d))
// ===========================================================================
describe('G-FE-2 — 2-인자 log 실행 확증', () => {
  it('이득여유 20*log(x,10): x=100 → 40 dB', () => {
    const g = evalExpr('20*log(x,10)', { x: 100 });
    expect(Math.abs(g - 40)).toBeLessThan(EPSILON);
    expect(g.toFixed(6)).toBe('40.000000');
  });

  it('log(x,2): x=8 → 3 (밑 자유 지정)', () => {
    expect(Math.abs(evalExpr('log(x,2)', { x: 8 }) - 3)).toBeLessThan(EPSILON);
  });

  it('1-인자 log(x) = 자연로그 유지 (기존 의미 무변): log(e) = 1', () => {
    expect(Math.abs(evalExpr('log(e)') - 1)).toBeLessThan(EPSILON);
  });
});

// ===========================================================================
// G-FE-2 — 정의역 밖 fail-loud red (plan §2-(g))
// ===========================================================================
describe('G-FE-2 — 정의역 밖 입력 fail-loud', () => {
  it('asin(1.5) → mathjs Complex 반환 → safeEvaluate "not a number" throw (red)', () => {
    const r = safeParse('asin(x)');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(() => safeEvaluate(r.node.compile(), { x: 1.5 })).toThrow(/not a number/);
    }
  });

  it('acos(-2) → Complex → fail-loud throw (red)', () => {
    const r = safeParse('acos(x)');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(() => safeEvaluate(r.node.compile(), { x: -2 })).toThrow(/not a number/);
    }
  });

  it('함수 심볼 단독 참조(호출 아님) → 함수 객체 반환 → fail-loud throw', () => {
    const r = safeParse('exp');
    expect(r.ok).toBe(true); // SymbolNode 'exp' 는 허용 함수명 — 파싱은 통과
    if (r.ok) {
      expect(() => safeEvaluate(r.node.compile(), {})).toThrow(/not a number/);
    }
  });
});

// ===========================================================================
// G-FE-3 — 각도 규약 (Q3-A안: 라디안 전용 + deg2rad) 골든
// ===========================================================================
describe('G-FE-3 — 각도 규약 골든 (도·라디안 동시, prc-01 정밀도 경유)', () => {
  it('deg2rad 변환 골든: 30°→π/6, 90°→π/2, 180°→π, 0°→0 (경계)', () => {
    expect(Math.abs(evalExpr('deg2rad(30)') - Math.PI / 6)).toBeLessThan(EPSILON);
    expect(Math.abs(evalExpr('deg2rad(90)') - Math.PI / 2)).toBeLessThan(EPSILON);
    expect(Math.abs(evalExpr('deg2rad(180)') - Math.PI)).toBeLessThan(EPSILON);
    expect(evalExpr('deg2rad(0)')).toBe(0);
  });

  it('도 단위 golden: sin(deg2rad(30)) = 0.5 — naive 등치 금지 (raw = 0.4999…94)', () => {
    const v = evalExpr('sin(deg2rad(theta_deg))', { theta_deg: 30 });
    // plan §2-(j): naive `toBe(0.5)` 는 부동소수 함정 — EPSILON + toFixed(6) 경유
    expect(Math.abs(v - 0.5)).toBeLessThan(EPSILON);
    expect(v.toFixed(6)).toBe('0.500000');
  });

  it('라디안 golden 동시 PASS: sin(pi/6) = 0.5 (라디안 직저작 경로 보존)', () => {
    const v = evalExpr('sin(theta_rad)', { theta_rad: Math.PI / 6 });
    expect(Math.abs(v - 0.5)).toBeLessThan(EPSILON);
    expect(v.toFixed(6)).toBe('0.500000');
  });

  it('도·라디안 두 저작 경로 동치: sin(deg2rad(60)) ≡ sin(pi/3)', () => {
    const byDeg = evalExpr('sin(deg2rad(60))');
    const byRad = evalExpr('sin(pi/3)');
    expect(Math.abs(byDeg - byRad)).toBeLessThan(EPSILON);
  });

  it('deg2rad 비숫자 인자 → typed 함수 fail-loud (문자열 상수는 파싱 단계 차단)', () => {
    // 문자열 상수는 validateNode 가 ConstantNode(string) 으로 선차단 — red 확인
    const r = safeParse('deg2rad("30")');
    expect(r.ok).toBe(false);
  });
});

// ===========================================================================
// G-FE-7 — π·e 내장 상수 자릿수 전수 대조 (Tier 1)
// ===========================================================================
describe('G-FE-7 — π·e 내장 상수 정확성 (자릿수 전수 대조)', () => {
  it('pi = Math.PI 비트 동치 + 자릿수 전수 "3.141592653589793"', () => {
    const v = evalExpr('pi');
    expect(v).toBe(Math.PI); // 비트 동치 (게이트 정의 = 자릿수 전수 대조)
    expect(String(v)).toBe('3.141592653589793');
  });

  it('e = Math.E 비트 동치 + 자릿수 전수 "2.718281828459045"', () => {
    const v = evalExpr('e');
    expect(v).toBe(Math.E);
    expect(String(v)).toBe('2.718281828459045');
  });

  it('exp(1) ≡ e — 함수·상수 정합', () => {
    expect(Math.abs(evalExpr('exp(1)') - Math.E)).toBeLessThan(EPSILON);
  });

  it('활용 골든: 각주파수 w = 2*pi*f, f=60Hz → 376.991118…', () => {
    const w = evalExpr('2*pi*f', { f: 60 });
    expect(Math.abs(w - 2 * Math.PI * 60)).toBeLessThan(EPSILON);
    expect(w.toFixed(4)).toBe('376.9911');
  });

  it('과학표기 리터럴 회귀: "1e5" 는 상수 e 와 무관하게 숫자 100000 (렉서 층)', () => {
    expect(evalExpr('1e5')).toBe(100000);
  });
});

// ===========================================================================
// Tier 1 — safeParse 변수 추출에서 pi/e 제외 (plan §3-1 Q1-(a) 사양)
// ===========================================================================
describe('Tier 1 — pi/e 는 입력 변수로 추출되지 않는다', () => {
  it('safeParse("2*pi*f*l") → variables = [f, l] (pi 제외)', () => {
    const r = safeParse('2*pi*f*l');
    expect(r.ok).toBe(true);
    if (r.ok) expect([...r.variables].sort()).toEqual(['f', 'l']);
  });

  it('safeParse("exp(-t/(r*c))") → variables = [t, r, c] (exp 함수명 제외)', () => {
    const r = safeParse('exp(-t/(r*c))');
    expect(r.ok).toBe(true);
    if (r.ok) expect([...r.variables].sort()).toEqual(['c', 'r', 't']);
  });

  it('safeParse("v_m*sin(deg2rad(theta_deg))") → variables = [v_m, theta_deg]', () => {
    const r = safeParse('v_m*sin(deg2rad(theta_deg))');
    expect(r.ok).toBe(true);
    if (r.ok) expect([...r.variables].sort()).toEqual(['theta_deg', 'v_m']);
  });

  it('인접 명칭 비오염: e_f/exp_rate/pi_val 은 정상 변수로 추출', () => {
    const r = safeParse('e_f + exp_rate + pi_val');
    expect(r.ok).toBe(true);
    if (r.ok) expect([...r.variables].sort()).toEqual(['e_f', 'exp_rate', 'pi_val']);
  });
});

// ===========================================================================
// 보안 — scope 주입이 내장 상수/함수를 shadow 하는 경로 차단 (fail-loud)
// ===========================================================================
describe('보안 — scope 키의 내장 상수·함수 shadow 차단', () => {
  it('scope {pi: 3} → throw (미차단 시 π=3 무음 오답 — 65↔60 동급 클래스)', () => {
    const r = safeParse('pi * x');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(() => safeEvaluate(r.node.compile(), { pi: 3, x: 1 })).toThrow(/Unsafe scope key/);
    }
  });

  it('scope {e: 5} → throw', () => {
    const r = safeParse('e + x');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(() => safeEvaluate(r.node.compile(), { e: 5, x: 1 })).toThrow(/Unsafe scope key/);
    }
  });

  it('scope {sin: 2} → throw (함수명 shadow 차단)', () => {
    const r = safeParse('sin(x)');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(() => safeEvaluate(r.node.compile(), { sin: 2, x: 1 })).toThrow(/Unsafe scope key/);
    }
  });
});

// ===========================================================================
// 화이트리스트 경계 — 확장이 열지 않은 이름은 여전히 차단 (adversarial red)
// ===========================================================================
describe('화이트리스트 경계 — 미허용 인접 함수 차단 유지', () => {
  it.each(['sinh(x)', 'cosh(x)', 'tanh(x)', 'expm1(x)', 'log10(x)', 'log2(x)', 'rad2deg(x)'])(
    '%s → 거부 (Tier 3 별건 / 미등록)',
    (expr) => {
      const r = safeParse(expr);
      expect(r.ok).toBe(false);
    },
  );

  it('evaluate/compile/simplify 차단 불변 (G-FE-5 보강)', () => {
    expect(safeParse('evaluate("1+1")').ok).toBe(false);
    expect(safeParse('compile("1+1")').ok).toBe(false);
    expect(safeParse('simplify(x)').ok).toBe(false);
  });
});

// ===========================================================================
// G-FE-6(i) — 코드 68식 예약어 충돌 0건 상시 회귀 가드
//   (G-FE-7 대체 조항 동시 이행: 1호 68식에 pi/e 사용 산식 부재 확인)
// ===========================================================================
describe('G-FE-6(i) — 코드 레지스트리 68식 vs 신규 예약어 충돌 스캔', () => {
  const RESERVED = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'pi', 'e', 'deg2rad'];
  // 식별자 추출: 선행 문자가 [a-z0-9_] 이면 제외 (과학표기 1e-9 의 'e' 오탐 차단)
  const IDENT_PATTERN = /(?<![a-z0-9_])[a-z][a-z0-9_]*/g;

  it('레지스트리 68식 워터마크 (전수 스캔 분모 고정)', () => {
    expect(getAllFormulas()).toHaveLength(68);
  });

  it('variablesSchema 변수명 충돌 0건 (68식 전수)', () => {
    const collisions: string[] = [];
    for (const f of getAllFormulas()) {
      for (const s of f.variablesSchema) {
        if (RESERVED.includes(s.name)) collisions.push(`${f.id}:${s.name}`);
      }
    }
    expect(collisions).toEqual([]);
  });

  it('equationTemplate 심볼 충돌 0건 (68식 전수 — 1호 pi/e 사용 부재 = G-FE-7 대체 확인)', () => {
    const collisions: string[] = [];
    for (const f of getAllFormulas()) {
      const idents = f.equationTemplate.match(IDENT_PATTERN) ?? [];
      for (const ident of idents) {
        if (RESERVED.includes(ident)) collisions.push(`${f.id}:${ident}`);
      }
    }
    expect(collisions).toEqual([]);
  });
});
