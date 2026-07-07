"""Solver-Validated Gate (가드레일 16-③).

생성물은 이 게이트를 통과해야만 노출 후보가 된다. 실패 = 폐기·재생성.
절대 사일런트 드롭 금지 — 구조적 실패는 SolverGateError로 LOUD raise, 값-수준(난이도) 실패는 재난수화 신호 반환.

게이트 (S10 스코프):
  V1-T 템플릿 : output element↔포트 정합 + 직렬 단일루프(렌더러 전제) + 수동소자 접두 유일.
                (2차 독립 리뷰 F-1a MAJOR-1·2 반영 — 템플릿 저작 오류의 무음 통과 차단.)
  G1 유일해   : lcapy 해석 성공 + 특성방정식 2차 + 최고차계수≠0 + 계수 유한·실수 + 물리적 해(ω0>0, ζ>0).
                특이행렬/부동노드/비실수계수 → 여기서 거부.
                ★알려진 한계(실측 2026-07-07): 병렬 상이 전압원(모순전원)은 lcapy transfer()가
                거부하지 않고 정상 H를 반환 — G1이 못 잡는다. 방어선 = 템플릿 인간 승인(단일 소스).
  V1 극점     : lcapy-유도 극점(ω0, ζ) vs 폐형식(1/LC, R/L) 상대오차 ≤ 1e-6.
  V1 출력탭   : DC 이득 H(0) + 고주파 이득 H(∞) = 템플릿 기대값 (분자/출력소자 확인 — 극점만으론 불검출).
                (H(0),H(∞)) 쌍이 탭 유일 식별: 저역통과(1,0)·대역통과(0,0)·고역통과(0,1).
                기대값 미선언(None) = 위반 (H(∞) 판별이 무음으로 꺼지는 비대칭 차단 — F-1a MINOR-5).
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

# 렌더러(schemdraw 직렬 체인)가 지원하는 수동소자 접두 — generate.ELEM_MAP 정의역과 동치(테스트가 고정)
PASSIVE_PREFIXES = ("R", "L", "C")


def validate_template_structure(template: dict[str, Any]) -> None:
    """V1-T 템플릿 구조 게이트 — 저작 오류의 무음 통과 차단 (F-1a MAJOR-1·2 반영). 실패 = LOUD raise.

    ① output_across.element 의 넷리스트 노드 == (pos, neg) — element 오기 시 JSON ports≠element 모순
       + SVG V_out 오라벨이 게이트 전부 통과하던 경로 차단.
    ② 직렬 단일루프(모든 노드 차수 = 2) — 렌더러가 직렬 체인을 무조건 가정하므로 비직렬(병렬 등)
       넷리스트는 무음으로 오도면이 되던 경로 차단. 병렬 템플릿 = 렌더러 확장 후 본 게이트 완화가 선행.
    ③ 수동소자 접두 유일 — 렌더 라벨이 vals[접두] 조회라 동일 접두 2개(R1,R2)는 무음 동일값 표기.
    """
    lines = [ln.split() for ln in template["netlist_template"].splitlines() if ln.split()]
    out = template["output_across"]
    # 노드 = 문자열 키 (폐쇄검증 MINOR 1~3 일괄 해소: int() 강제 시 이름 노드 ValueError 사망
    #  + int("0_2")==2 무음 별칭 오귀속. 게이트 계약 = 거부는 SolverGateError로만)
    for ln in lines:
        if len(ln) < 3:
            raise SolverGateError(f"V1-T 템플릿 위반: 넷리스트 라인 필드 부족(이름 노드+ 노드−) — {ln}")
    elem_nodes = {ln[0]: {ln[1], ln[2]} for ln in lines}

    name = out["element"]
    if name not in elem_nodes:
        raise SolverGateError(f"V1-T 템플릿 위반: output element '{name}' 이 넷리스트에 없음")
    if elem_nodes[name] != {str(out["pos"]), str(out["neg"])}:
        raise SolverGateError(
            f"V1-T 템플릿 위반: output element '{name}' 노드 {sorted(elem_nodes[name])}"
            f" ≠ 출력 포트 ({out['pos']},{out['neg']}) — element/포트 모순(JSON·SVG 오라벨 차단)"
        )

    degree: dict[str, int] = {}
    for ln in lines:
        for node in (ln[1], ln[2]):
            degree[node] = degree.get(node, 0) + 1
    bad = {n: d for n, d in degree.items() if d != 2}
    if bad:
        raise SolverGateError(
            f"V1-T 템플릿 위반: 직렬 단일루프 아님 (노드 차수 이상 {bad}) — 렌더러 직렬 가정 미지원 토폴로지, 무음 오도면 금지"
        )

    sources = [ln[0] for ln in lines if ln[0][0] == "V"]
    if len(sources) != 1:
        raise SolverGateError(
            f"V1-T 템플릿 위반: 전압원 {sources} ≠ 단일 소스 — 렌더러 소스 1개 전제(다중 소스 무음 누락 차단)"
            " + transfer() 모순전원 미검출 한계 보강 (§4-7 ⑦ 기계화)"
        )

    prefixes = [ln[0][0] for ln in lines if ln[0][0] in PASSIVE_PREFIXES]
    if len(prefixes) != len(set(prefixes)):
        raise SolverGateError(
            f"V1-T 템플릿 위반: 동일 접두 수동소자 중복 {prefixes} — 렌더 라벨 값 충돌(무음 동일값 표기) 차단"
        )


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
        if exp is None:  # 미선언 = 위반 — H(∞) 판별이 무음으로 꺼지던 dc/hf 비대칭 차단 (F-1a MINOR-5)
            fails.append(f"V1 출력탭 위반: expected_{key} 미선언 (템플릿 필수 — (H(0),H(∞)) 쌍 판별 무음 OFF 금지)")
            continue
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
