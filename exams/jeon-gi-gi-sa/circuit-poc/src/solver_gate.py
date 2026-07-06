"""Solver-Validated Gate (가드레일 16-③).

생성물은 이 게이트를 통과해야만 노출 후보가 된다. 실패 = 폐기·재생성.
절대 사일런트 드롭 금지 — 구조적 실패는 SolverGateError로 LOUD raise, 값-수준(난이도) 실패는 재난수화 신호 반환.

게이트 (S10 스코프):
  G1 유일해   : lcapy 해석 성공 + 특성방정식 2차 + 최고차계수≠0 + 계수 유한·실수 + 물리적 해(ω0>0, ζ>0).
                특이행렬/부동노드/모순전원/비실수계수 → 여기서 거부.
  V1 극점     : lcapy-유도 극점(ω0, ζ) vs 폐형식(1/LC, R/L) 상대오차 ≤ 1e-6.
  V1 출력탭   : DC 이득 H(0) + 고주파 이득 H(∞) = 템플릿 기대값 (분자/출력소자 확인 — 극점만으론 불검출).
                (H(0),H(∞)) 쌍이 탭 유일 식별: 저역통과(1,0)·대역통과(0,0)·고역통과(0,1).
  G4 단위     : 모든 답에 단위 문자열 존재.
  G2 난이도   : f0가 시험 상식 난이도 밴드 내 (값-수준 → 재난수화 대상, 구조 실패 아님).
"""
from __future__ import annotations

import math
from typing import Any


class SolverGateError(Exception):
    """구조적 게이트 실패 — 절대 삼키지 말 것(가드레일 16-③)."""


V1_REL_TOL = 1e-6
DC_GAIN_TOL = 1e-6


def hard_validate(result: dict[str, Any]) -> None:
    """G1·V1·G4 — 구조/정확성 게이트. 실패 시 즉시 LOUD raise."""
    fails: list[str] = []

    # --- G1 유일해 -------------------------------------------------------
    if not result.get("solved", False):
        fails.append(f"G1 유일해 위반: 회로 해석 실패 — {result.get('solve_error', '원인 불명')}")
    else:
        den = result.get("den_coeffs", [])
        if len(den) != 3:
            fails.append(f"G1 유일해 위반: 특성방정식 2차 아님 (분모 차수 {len(den) - 1}, coeffs={den})")
        else:
            a2, a1, a0 = den
            if abs(a2) < 1e-30:
                fails.append("G1 유일해 위반: 최고차 계수 0 (특이/축약 시스템)")
            if any(not math.isfinite(float(c)) for c in den):
                fails.append(f"G1 유일해 위반: 계수 비유한(발산) coeffs={den}")
            if result.get("w0", 0) <= 0 or result.get("zeta", 0) <= 0:
                fails.append(
                    f"G1 유일해 위반: 비물리적 해 (ω0={result.get('w0')}, ζ={result.get('zeta')})"
                )

    # --- V1 극점 대조 (lcapy 유도 vs 폐형식) -----------------------------
    rel = result.get("crosscheck_rel_err")
    if rel is None:
        fails.append("V1 극점 위반: 교차검증 미수행")
    elif rel > V1_REL_TOL:
        fails.append(f"V1 극점 위반: lcapy-유도 vs 폐형식 상대오차 {rel:.2e} > {V1_REL_TOL:.0e}")

    # --- V1 출력탭 검증 (DC 이득 H(0) + 고주파 이득 H(∞) = 분자/출력소자 확인) -
    #   극점(ω0,ζ)은 출력탭에 불변이므로 출력 소자 오배선은 이득으로만 잡힌다.
    #   (H(0),H(∞)) 쌍이 탭을 유일 식별: 저역통과(1,0)·대역통과(0,0)·고역통과(0,1).
    for key, label in (("dc_gain", "DC 이득 H(0)"), ("hf_gain", "고주파 이득 H(∞)")):
        exp = result.get(f"expected_{key}")
        if exp is None:
            continue  # 템플릿이 해당 이득을 선언 안 함 → 검증 생략
        obs = result.get(key)
        if obs is None or not math.isfinite(obs):
            fails.append(f"V1 출력탭 위반: {label} 비유한 ({key}={obs})")
        elif abs(obs - exp) > DC_GAIN_TOL:
            fails.append(f"V1 출력탭 위반: {label} {obs:.6g} ≠ 기대 {exp} (출력 소자/분자 불일치)")

    # --- G4 단위 ---------------------------------------------------------
    for ans in result.get("answers", []):
        if not ans.get("unit"):
            fails.append(f"G4 단위 위반: 답 '{ans.get('symbol')}' 단위 누락")

    if fails:
        raise SolverGateError(" | ".join(fails))


def within_difficulty(result: dict[str, Any], template: dict[str, Any]) -> tuple[bool, str]:
    """G2 난이도 밴드 — 값-수준 검사(구조 실패 아님, 재난수화 신호).

    f0 밴드는 필수, 선택도(Q) 밴드는 템플릿이 선언 시 추가 검사(대역통과는 과감쇠 Q 제외)."""
    gate = template["gate"]
    lo, hi = gate["difficulty_band_f0_hz"]
    f0 = result["f0"]
    if not (lo <= f0 <= hi):
        return False, f"G2 난이도 이탈: f0={f0:.2f}Hz ∉ [{lo},{hi}] → 재난수화"
    qband = gate.get("difficulty_band_Q")
    if qband:
        qlo, qhi = qband
        q = result.get("Q", 0.0)
        if not (qlo <= q <= qhi):
            return False, f"G2 선택도 이탈: Q={q:.3g} ∉ [{qlo},{qhi}] (과감쇠/과협대역 = 대역통과 특성 미흡) → 재난수화"
        return True, f"G2 난이도 PASS: f0={f0:.2f}Hz ∈ [{lo},{hi}], Q={q:.3g} ∈ [{qlo},{qhi}]"
    return True, f"G2 난이도 PASS: f0={f0:.2f}Hz ∈ [{lo},{hi}]"
