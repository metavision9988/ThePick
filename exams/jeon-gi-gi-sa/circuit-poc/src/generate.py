"""S10 회로 생성·풀이 수직 관통 PoC (빌드타임 전용 — 가드레일 16-②).

파이프라인: 인간승인 템플릿 → 값 난수화 → lcapy 전달함수 유도 → sympy 계수 추출
            → f0/Q/ζ 산출(폐형식 교차검증) → schemdraw SVG → Solver Gate → 정적 JSON.

런타임(Workers/브라우저)은 여기서 나온 out/*.json + out/*.svg 만 소비한다. 이 스크립트는 절대 런타임에 반입하지 않는다.

★ 측정 포트(입력/출력)는 코드가 아니라 템플릿(input_across/output_across)이 정본이다 (가드레일 16-①).
   Solver Gate는 특성방정식(극점)뿐 아니라 DC 이득(분자/출력탭)까지 검증하여, 템플릿-코드 불일치를 LOUD 거부한다.

사용: python src/generate.py [--seed N] [--count K] [--out DIR]
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import warnings
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")  # 헤드리스 렌더

from solver_gate import SolverGateError, hard_validate, within_difficulty  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "templates" / "rlc_series.json"
MAX_DIFFICULTY_ATTEMPTS = 40
IMAG_TOL = 1e-9  # 특성방정식 계수 허용 허수부(수치 오차 한계)


# ----------------------------------------------------------------------------- utils
def sig(x: float, n: int = 4) -> float:
    return float(f"{x:.{n}g}") if x else 0.0


def fmt_si(x: float, unit: str) -> str:
    """공학 접두어 표기 (µ/m/k)."""
    if x == 0:
        return f"0 {unit}"
    prefixes = [(1e-9, "n"), (1e-6, "µ"), (1e-3, "m"), (1, ""), (1e3, "k"), (1e6, "M")]
    for scale, p in reversed(prefixes):
        if abs(x) >= scale:
            return f"{sig(x / scale)} {p}{unit}"
    return f"{sig(x)} {unit}"


# ----------------------------------------------------------------------------- randomize
def randomize(template: dict, rng: random.Random) -> dict:
    """토폴로지 불변, 값만 난수화 (가드레일 16-①)."""
    return {name: rng.choice(spec["choices"]) for name, spec in template["variables"].items()}


def build_netlist(template: dict, vals: dict) -> str:
    net = template["netlist_template"]
    for k, v in vals.items():
        net = net.replace("{" + k + "}", repr(v))
    return net


# ----------------------------------------------------------------------------- solver (lcapy)
def _real_coeffs(coeffs) -> list[float] | None:
    """복소 계수를 실수로 변환. 비실수(허수부 유의) → None (비물리 특성방정식)."""
    out = []
    for c in coeffs:
        cc = complex(c)
        if abs(cc.imag) > IMAG_TOL * max(1.0, abs(cc.real)):
            return None
        out.append(cc.real)
    return out


def solve(netlist: str, in_ports: tuple[int, int], out_ports: tuple[int, int]) -> dict:
    """lcapy로 V_out/V_in 전달함수를 유도하고 특성방정식 계수 + DC 이득을 추출한다.

    포트는 템플릿이 정본(하드코딩 금지). ImportError 류는 인프라 실패로 재전파(회로 거부로 오분류 금지)."""
    import sympy as sp

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")  # lcapy 'removing source' 정보성 경고
            from lcapy import Circuit
    except (ImportError, ModuleNotFoundError):
        raise  # 인프라(툴체인 부재) — 회로 G1 거부가 아님. LOUD 전파.

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            cct = Circuit(netlist)
            H = cct.transfer(in_ports[0], in_ports[1], out_ports[0], out_ports[1])
            Hs = sp.together(sp.sympify(H.sympy))
    except (ValueError, TypeError, AttributeError, ZeroDivisionError) as e:
        return {"solved": False, "solve_error": f"회로 해석 실패 — {type(e).__name__}: {e}"}

    s = next((x for x in Hs.free_symbols if str(x) == "s"), sp.Symbol("s"))
    num, den = sp.fraction(Hs)
    try:
        raw = sp.Poly(sp.expand(den), s).all_coeffs()
    except sp.PolynomialError as e:
        return {"solved": False, "solve_error": f"분모 다항식화 실패: {e}"}
    coeffs = _real_coeffs(raw)
    if coeffs is None:
        return {"solved": False, "solve_error": "특성방정식 계수 비실수(비물리 토폴로지)"}

    # DC 이득 H(s→0) — 분자/출력탭 검증용 (극점만으로는 출력 소자 확인 불가)
    try:
        dc = complex(sp.N(Hs.subs(s, 0)))
        dc_gain = dc.real if abs(dc.imag) < IMAG_TOL else float("nan")
    except (TypeError, ValueError):
        dc_gain = float("nan")

    out = {"solved": True, "den_coeffs": coeffs, "H_str": str(Hs), "dc_gain": dc_gain}
    if len(coeffs) != 3:  # 2차가 아니면 G1에서 거부됨
        out.update(w0=0.0, zeta=0.0, f0=0.0, Q=0.0)
        return out

    a2, a1, a0 = coeffs
    ratio = a0 / a2 if a2 else -1
    w0 = math.sqrt(ratio) if ratio > 0 else 0.0
    zeta = (a1 / a2) / (2 * w0) if w0 > 0 else 0.0
    out.update(
        w0=w0,
        zeta=zeta,
        f0=w0 / (2 * math.pi) if w0 > 0 else 0.0,
        Q=1 / (2 * zeta) if zeta > 0 else 0.0,
    )
    return out


def closed_form(vals: dict) -> dict:
    """폐형식 참조값 — solver 결과 교차검증용 (V1 결정론 대조).

    ★ 본 폐형식은 '직렬 RLC · 출력=C' 템플릿(RLC-SERIES-A1-001) 전용 참조다.
      다른 토폴로지/출력탭 템플릿은 자체 참조가 필요하며, 그 전까지는 DC 이득 게이트가 불일치를 LOUD 거부한다."""
    R, L, C = vals["R"], vals["L"], vals["C"]
    w0 = 1 / math.sqrt(L * C)
    return {
        "w0": w0,
        "zeta": (R / 2) * math.sqrt(C / L),
        "f0": w0 / (2 * math.pi),
        "Q": (1 / R) * math.sqrt(L / C),
    }


def crosscheck(sol: dict, cf: dict) -> float:
    """lcapy-유도 vs 폐형식 최대 상대오차 (극점 = ω0, ζ)."""
    errs = [abs(sol[k] - cf[k]) / abs(cf[k]) for k in ("w0", "zeta") if cf.get(k)]
    return max(errs) if errs else 1.0


# ----------------------------------------------------------------------------- steps + svg
def build_steps(template: dict, vals: dict, sol: dict) -> list[str]:
    R, L, C = vals["R"], vals["L"], vals["C"]
    out_label = template["output_across"]["meaning"]
    return [
        f"① 소자 임피던스: Z_R = R = {fmt_si(R, 'Ω')}, Z_L = sL, Z_C = 1/(sC)  (L={fmt_si(L, 'H')}, C={fmt_si(C, 'F')})",
        f"② 전압분배({out_label}): H(s) = V_out/V_in = Z_C / (Z_R + Z_L + Z_C) = (1/sC) / (R + sL + 1/sC)",
        f"③ 정리(lcapy 유도): H(s) = {sol['H_str']}   [DC 이득 H(0) = {sig(sol['dc_gain'])}]",
        "④ 표준 2차형 대조: 분모 = s² + 2ζω₀·s + ω₀²  ⇒  ω₀² = 1/(LC),  2ζω₀ = R/L",
        f"⑤ 공진각주파수 ω₀ = 1/√(LC) = {sig(sol['w0'])} rad/s  ⇒  f₀ = ω₀/2π = {sig(sol['f0'])} Hz",
        f"⑥ 감쇠비 ζ = (R/2)·√(C/L) = {sig(sol['zeta'])},  품질계수 Q = 1/(2ζ) = {sig(sol['Q'])}",
    ]


def render_svg(vals: dict, out_path: Path) -> None:
    import matplotlib
    import matplotlib.pyplot as plt
    import schemdraw
    import schemdraw.elements as elm

    matplotlib.rcParams["svg.fonttype"] = "none"  # 라벨을 <path>가 아닌 선택가능 <text>로 (접근성·경량화)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            d = schemdraw.Drawing()
            d += elm.SourceV().up().label(f"Vin\n{fmt_si(vals['V'], 'V')} step")
            d += elm.Resistor().right().label(f"R = {fmt_si(vals['R'], 'Ω')}")
            d += elm.Inductor2().right().label(f"L = {fmt_si(vals['L'], 'H')}")
            d += elm.Capacitor().down().label(f"C = {fmt_si(vals['C'], 'F')}", loc="bottom")
            d += elm.Line().left()
            d += elm.Line().up()
            svg = d.get_imagedata("svg")
        finally:
            plt.close("all")  # matplotlib figure 누수 방지 (스케일 안전)
    out_path.write_bytes(svg if isinstance(svg, bytes) else svg.encode())


# ----------------------------------------------------------------------------- orchestrate
def generate_one(template: dict, seed: int, out_dir: Path) -> dict:
    """단일 문제 생성 — 관통: 난수화→풀이→게이트→SVG→JSON. 게이트 실패는 LOUD."""
    rng = random.Random(seed)
    in_p = (template["input_across"]["pos"], template["input_across"]["neg"])
    out_p = (template["output_across"]["pos"], template["output_across"]["neg"])
    expected_dc = template["output_across"]["expected_dc_gain"]
    last_g2 = ""

    for _attempt in range(MAX_DIFFICULTY_ATTEMPTS):
        vals = randomize(template, rng)
        netlist = build_netlist(template, vals)
        sol = solve(netlist, in_p, out_p)
        cf = closed_form(vals) if sol.get("solved") else {}
        sol["crosscheck_rel_err"] = crosscheck(sol, cf) if cf else None
        sol["expected_dc_gain"] = expected_dc
        sol["answers"] = [
            {"symbol": "f0", "name": "공진주파수", "value": sig(sol.get("f0", 0)), "unit": "Hz"},
            {"symbol": "Q", "name": "품질계수", "value": sig(sol.get("Q", 0)), "unit": "(무차원)"},
            {"symbol": "zeta", "name": "감쇠비", "value": sig(sol.get("zeta", 0)), "unit": "(무차원)"},
        ]

        hard_validate(sol)  # G1·V1(극점+DC이득)·G4 — 구조/정확성 실패면 SolverGateError (재시도 안 함)

        ok, last_g2 = within_difficulty(sol, template)
        if ok:
            svg_name = f"{template['id']}-{seed:04d}.svg"
            render_svg(vals, out_dir / svg_name)
            problem = {
                "template_id": template["id"],
                "seed": seed,
                "exam_class": template["exam_class"],
                "title": template["title"],
                "netlist": netlist,
                "ports": {"input": list(in_p), "output": list(out_p)},
                "values": {k: {"value": v, "unit": template["variables"][k]["unit"]} for k, v in vals.items()},
                "transfer_function": sol["H_str"],
                "steps": build_steps(template, vals, sol),
                "answers": sol["answers"],
                "gate_report": {
                    "G1_unique_solution": "PASS",
                    "V1_pole_crosscheck_rel_err": sol["crosscheck_rel_err"],
                    "V1_dc_gain": {"observed": sig(sol["dc_gain"]), "expected": expected_dc},
                    "G4_units": "PASS",
                    "G2_difficulty": last_g2,
                },
                "svg": svg_name,
            }
            (out_dir / f"{template['id']}-{seed:04d}.json").write_text(
                json.dumps(problem, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            return problem
    raise SolverGateError(
        f"G2 난이도 밴드를 {MAX_DIFFICULTY_ATTEMPTS}회 재난수화로도 충족 못함 (마지막: {last_g2}) — 값 범위 재검토 필요"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--out", type=str, default=str(ROOT / "out"))
    args = ap.parse_args()

    template = json.loads(TEMPLATE_PATH.read_text(encoding="utf-8"))
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"S10 PoC — 템플릿 {template['id']} ({template['title']})")
    for i in range(args.count):
        seed = args.seed + i
        p = generate_one(template, seed, out_dir)
        ans = ", ".join(f"{a['symbol']}={a['value']} {a['unit']}" for a in p["answers"])
        gr = p["gate_report"]
        print(
            f"  [seed {seed:04d}] PASS — {ans} | V1 극점 rel_err={gr['V1_pole_crosscheck_rel_err']:.2e}"
            f" | DC이득 {gr['V1_dc_gain']['observed']}=={gr['V1_dc_gain']['expected']}"
        )
    print(f"완료: {args.count}문제 → {out_dir}")


if __name__ == "__main__":
    main()
