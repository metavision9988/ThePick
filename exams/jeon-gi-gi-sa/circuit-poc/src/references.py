"""템플릿별 참조 물리 — reference_id → {derive, reference, steps}.

3층으로 V1 교차검증을 구성한다(순환 아님):
  - derive(coeffs)   : lcapy가 유도한 특성방정식 계수(a2·s²+a1·s+a0)에서 정답 산출 = **solver 진실**.
  - reference(vals)  : 교재 폐형식을 원값(R,L,C)에 직접 대입 = **독립 대조군**. 두 경로 불일치 = lcapy 유도 오류.
  - steps(vals, ans) : 단계별 풀이 서술(표시 전용).

★ 독립성 범위(정직): 극점(ω0,ζ,f0,Q)·BW 는 derive(계수 유래)와 reference(원값 유래)가 진짜 독립 경로 →
  lcapy 유도 오류를 잡는다. 단 차단주파수 f_low/f_high 는 양쪽이 공통 헬퍼 _cutoffs(f0,BW)를 호출하므로
  crosscheck 는 f0/BW 전파 일치만 확인하고 _cutoffs 공식 자체는 검증 못 한다 → **공식 backstop = test_gate
  의 −3dB 독립 검증**(|H(j2πf_c)|=1/√2). 신규 파생량 추가 시 이 한계를 명시하고 독립 backstop 을 동반할 것.

★ 동적 코드 실행 금지(Hard Limit): 템플릿의 reference_formula 문자열은 인간 검수/문서용이며, 계산은
  아래 승인된 파이썬 함수로만 수행한다. 신규 토폴로지 = 이 파일에 함수 추가 + 독립 리뷰(값 대조).
"""
from __future__ import annotations

import math

TWO_PI = 2 * math.pi


# --------------------------------------------------------------------------- 공통 2차 극점
def _poles_from_coeffs(coeffs: list[float]) -> dict:
    """den = a2·s² + a1·s + a0 → ω0, ζ, f0, Q (출력탭 불변, 모든 직렬 RLC 탭 공유)."""
    a2, a1, a0 = coeffs
    w0 = math.sqrt(a0 / a2)
    zeta = (a1 / a2) / (2 * w0)
    return {"w0": w0, "zeta": zeta, "f0": w0 / TWO_PI, "Q": (1 / (2 * zeta)) if zeta > 0 else 0.0}


def _poles_from_values(R: float, L: float, C: float) -> dict:
    """교재 폐형식 — 직렬 RLC 극점(원값 직접 대입, 독립 대조군)."""
    w0 = 1 / math.sqrt(L * C)
    return {"w0": w0, "zeta": (R / 2) * math.sqrt(C / L), "f0": w0 / TWO_PI, "Q": (1 / R) * math.sqrt(L / C)}


def _cutoffs(f0: float, bw_hz: float) -> dict:
    """대역통과 −3dB 차단주파수 (반값폭 대칭식). f_high−f_low = BW 항등."""
    disc = math.sqrt((bw_hz / 2) ** 2 + f0**2)
    return {"f_low": disc - bw_hz / 2, "f_high": disc + bw_hz / 2}


# --------------------------------------------------------------------------- 저역통과 (출력=C)
def derive_lowpass(coeffs: list[float]) -> dict:
    return _poles_from_coeffs(coeffs)


def reference_lowpass(v: dict) -> dict:
    return _poles_from_values(v["R"], v["L"], v["C"])


def steps_lowpass(v: dict, ans: dict, fmt) -> list[str]:
    R, L, C = v["R"], v["L"], v["C"]
    return [
        f"① 소자 임피던스: Z_R = {fmt(R, 'Ω')}, Z_L = sL, Z_C = 1/(sC)  (L={fmt(L, 'H')}, C={fmt(C, 'F')})",
        "② 전압분배(커패시터 양단 V_C): H(s) = Z_C/(Z_R+Z_L+Z_C) = (1/sC)/(R+sL+1/sC) → 저역통과",
        "③ 표준 2차형: 분모 = s² + 2ζω₀·s + ω₀²  ⇒  ω₀² = 1/(LC),  2ζω₀ = R/L,  H(0)=1",
        f"④ 공진 ω₀ = 1/√(LC)  ⇒  f₀ = {fmt(ans['f0'], 'Hz')}",
        f"⑤ 감쇠비 ζ = (R/2)·√(C/L) = {ans['zeta']:.4g},  품질계수 Q = 1/(2ζ) = {ans['Q']:.4g}",
    ]


# --------------------------------------------------------------------------- 대역통과 (출력=R)
def derive_bandpass(coeffs: list[float]) -> dict:
    base = _poles_from_coeffs(coeffs)  # 극점: lcapy 계수 유래
    bw_hz = (coeffs[1] / coeffs[0]) / TWO_PI  # BW = (a1/a2)/2π = (R/L)/2π  [lcapy 유래]
    base["BW"] = bw_hz
    base.update(_cutoffs(base["f0"], bw_hz))
    return base


def reference_bandpass(v: dict) -> dict:
    base = _poles_from_values(v["R"], v["L"], v["C"])  # 극점: 원값 유래(독립)
    bw_hz = v["R"] / (TWO_PI * v["L"])  # BW = R/(2πL)  [원값 직접]
    base["BW"] = bw_hz
    base.update(_cutoffs(base["f0"], bw_hz))
    return base


def steps_bandpass(v: dict, ans: dict, fmt) -> list[str]:
    R, L, C = v["R"], v["L"], v["C"]
    return [
        f"① 소자 임피던스: Z_R = {fmt(R, 'Ω')}, Z_L = sL, Z_C = 1/(sC)  (L={fmt(L, 'H')}, C={fmt(C, 'F')})",
        "② 전압분배(저항 양단 V_R): H(s) = R/(R+sL+1/sC) = (R/L)s/(s²+(R/L)s+1/LC) → 대역통과(H(0)=0, H(∞)=0)",
        f"③ 공진 f₀ = 1/(2π√(LC)) = {fmt(ans['f0'], 'Hz')},  Q = (1/R)·√(L/C) = {ans['Q']:.4g}",
        f"④ 대역폭 BW = f₀/Q = R/(2πL) = {fmt(ans['BW'], 'Hz')}",
        f"⑤ 차단주파수 f_L = {fmt(ans['f_low'], 'Hz')}, f_H = {fmt(ans['f_high'], 'Hz')}  (f_H − f_L = BW 검산)",
    ]


REGISTRY: dict[str, dict] = {
    "series_lowpass_vc": {"derive": derive_lowpass, "reference": reference_lowpass, "steps": steps_lowpass},
    "series_bandpass_vr": {"derive": derive_bandpass, "reference": reference_bandpass, "steps": steps_bandpass},
}


def get_reference(reference_id: str) -> dict:
    if reference_id not in REGISTRY:
        raise KeyError(
            f"미등록 reference_id '{reference_id}' — references.py REGISTRY 에 승인된 함수 추가 필요(동적 실행 금지)"
        )
    return REGISTRY[reference_id]
