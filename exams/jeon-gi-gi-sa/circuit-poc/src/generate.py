"""S10 회로 생성·풀이 수직 관통 PoC (빌드타임 전용 — 가드레일 16-②).

파이프라인: 인간승인 템플릿 → 값 난수화 → lcapy 전달함수 유도 → sympy 계수·이득 추출
            → references.py(템플릿별 승인 물리)로 정답 산출·독립 교차검증 → schemdraw SVG → Solver Gate → 정적 JSON.

런타임(Workers/브라우저)은 out/*.json + out/*.svg 만 소비. 이 스크립트는 절대 런타임에 반입하지 않는다.

★ 측정 포트·정답 물리는 코드가 아니라 템플릿(reference_id → references.REGISTRY)이 정본이다 (가드레일 16-①).
   Solver Gate는 극점(ω0,ζ)뿐 아니라 DC 이득 H(0)·고주파 이득 H(∞)까지 검증 → 출력탭 오배선을 LOUD 거부.
   여러 템플릿(저역통과·대역통과…)이 단일 파이프라인을 통과 = 아키텍처 일반화 실증.

사용: python src/generate.py [--template PATH] [--seed N] [--count K] [--out DIR]
"""
from __future__ import annotations

import argparse
import json
import os
import random
import warnings
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")  # 헤드리스 렌더
os.environ.setdefault("SOURCE_DATE_EPOCH", "0")  # SVG <dc:date> 고정 = 바이트 결정성(콘텐츠 해시 캐싱 안전, 5-페르소나 P3)

from references import get_reference  # noqa: E402
from solver_gate import (  # noqa: E402
    SolverGateError,
    hard_validate,
    validate_template_structure,
    within_difficulty,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TEMPLATE = ROOT / "templates" / "rlc_series.json"
MAX_DIFFICULTY_ATTEMPTS = 40
IMAG_TOL = 1e-9  # 특성방정식 계수/이득 허용 허수부(수치 오차 한계)

ELEM_MAP: dict[str, str] = {"R": "Resistor", "L": "Inductor2", "C": "Capacitor"}
ELEM_UNIT: dict[str, str] = {"R": "Ω", "L": "H", "C": "F"}


# ----------------------------------------------------------------------------- utils
def sig(x: float, n: int = 4) -> float:
    return float(f"{x:.{n}g}") if x else 0.0


def fmt_si(x: float, unit: str) -> str:
    """공학 접두어 표기 (n/µ/m/k/M)."""
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


def _finite_real(expr, s, at) -> float:
    """H(s→at) 극한을 실수로. 비유한/복소 → nan (게이트가 LOUD 거부)."""
    import sympy as sp

    try:
        v = complex(sp.N(sp.limit(expr, s, at)))
        return v.real if abs(v.imag) < IMAG_TOL else float("nan")
    except (TypeError, ValueError, NotImplementedError, OverflowError):
        return float("nan")


def solve(netlist: str, in_ports: tuple[int | str, int | str], out_ports: tuple[int | str, int | str]) -> dict:
    """lcapy로 V_out/V_in 전달함수를 유도하고 특성방정식 계수 + DC/고주파 이득을 추출한다(순수 추출).

    포트는 템플릿이 정본(하드코딩 금지). ImportError 류는 인프라 실패로 재전파(회로 거부로 오분류 금지)."""
    import sympy as sp

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
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
    _, den = sp.fraction(Hs)
    try:
        raw = sp.Poly(sp.expand(den), s).all_coeffs()
    except sp.PolynomialError as e:
        return {"solved": False, "solve_error": f"분모 다항식화 실패: {e}"}
    coeffs = _real_coeffs(raw)
    if coeffs is None:
        return {"solved": False, "solve_error": "특성방정식 계수 비실수(비물리 토폴로지)"}

    return {
        "solved": True,
        "den_coeffs": coeffs,
        "H_str": str(Hs),
        "dc_gain": _finite_real(Hs, s, 0),  # H(0) — 분자/출력탭 검증
        "hf_gain": _finite_real(Hs, s, sp.oo),  # H(∞) — 저역/대역/고역 탭 유일 식별
    }


def crosscheck(derived: dict, reference: dict) -> float:
    """solver 유도값(lcapy) vs 폐형식 참조(원값) 최대 상대오차.

    키집합 불일치 = LOUD raise (독립 대조군 계약 강제 — 한쪽에만 있는 키의 조용한 미검증 차단).
    참조값 0(falsy) 키는 상대오차 대신 절대오차로 검증(skip 방지)."""
    d_keys, r_keys = set(derived), set(reference)
    if d_keys != r_keys:
        raise SolverGateError(
            f"교차검증 키집합 불일치 — derive 잉여={sorted(d_keys - r_keys)} / "
            f"reference 잉여={sorted(r_keys - d_keys)} (references.py 정합 오류 — 독립성 무력화 차단)"
        )
    if not reference:
        return 1.0
    return max(abs(derived[k] - rv) / abs(rv) if rv else abs(derived[k] - rv) for k, rv in reference.items())


# ----------------------------------------------------------------------------- svg
def render_svg(template: dict, vals: dict, out_path: Path) -> None:
    """직렬 루프 렌더 — 수동소자를 넷리스트 순서로 배치, 접지쪽(마지막) 소자 = 출력탭 명시.

    직렬 단일루프만 지원 — 비직렬 넷리스트는 V1-T가 LOUD 거부(직접 호출 방어, 무음 오도면 금지)."""
    validate_template_structure(template)
    import matplotlib
    import matplotlib.pyplot as plt
    import schemdraw
    import schemdraw.elements as elm

    matplotlib.rcParams["svg.fonttype"] = "none"  # 선택가능 <text> 라벨(접근성·경량화)
    matplotlib.rcParams["svg.hashsalt"] = "thepick-s10"  # clip-path id 결정화(기본=메모리주소) — 바이트 재현성 (P3)

    passives = [
        ln.split()[0]
        for ln in template["netlist_template"].splitlines()
        if ln.split() and ln.split()[0][0] in ELEM_MAP
    ]
    out_elem = template["output_across"]["element"]

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            d = schemdraw.Drawing()
            src = elm.SourceV().up().label(f"Vin\n{fmt_si(vals['V'], 'V')} step")
            d += src
            n = len(passives)
            for i, name in enumerate(passives):
                prefix, last = name[0], (i == n - 1)
                elem = getattr(elm, ELEM_MAP[prefix])()
                elem = elem.down() if last else elem.right()
                label = f"{prefix} = {fmt_si(vals[prefix], ELEM_UNIT[prefix])}"
                if name == out_elem:
                    label += "\n(V_out)"
                d += elem.label(label, loc="bottom" if last else "top")
            d += elm.Line().to(src.start)  # 접지 복귀 = 루프 폐합(폭 무관)
            svg = d.get_imagedata("svg")
        finally:
            plt.close("all")  # matplotlib figure 누수 방지
    out_path.write_bytes(svg if isinstance(svg, bytes) else svg.encode())


# ----------------------------------------------------------------------------- orchestrate
def assemble_gate_input(template: dict, ref: dict, netlist: str, vals: dict | None = None) -> dict:
    """게이트 입력 조립 — 단일 진실원 (generate_one·test_gate 공유, 5-페르소나 P5 조립 이중화 제거).

    vals 를 주면 폐형식 교차검증 실측, 없으면(테스트 퇴화 케이스 전용) 0.0 스텁으로 극점 게이트를
    통과시켜 다른 게이트의 단독 발화를 노출. expected_* 는 .get — 미선언 = hard_validate 가 LOUD 거부
    (dc/hf 대칭, 5-페르소나 P4: 종전 dc 직접 인덱싱은 무맥락 KeyError 로 게이트 계약 이탈)."""
    in_p = (template["input_across"]["pos"], template["input_across"]["neg"])
    out_p = (template["output_across"]["pos"], template["output_across"]["neg"])
    sol = solve(netlist, in_p, out_p)

    if sol.get("solved") and len(sol.get("den_coeffs", [])) == 3:
        derived = ref["derive"](sol["den_coeffs"])  # lcapy 계수 → 정답 (solver 진실)
        sol.update(derived)
        missing = [a["symbol"] for a in template["asks"] if a["symbol"] not in derived]
        if missing:  # 템플릿/registry 오정합 → 조용한 0 답 금지(사일런트 결함 차단)
            raise SolverGateError(
                f"템플릿/registry 정합 오류: asks 심볼 {missing} 이 references.derive 산출에 없음 (사일런트 0 금지)"
            )
        sol["crosscheck_rel_err"] = crosscheck(derived, ref["reference"](vals)) if vals else 0.0
    else:
        sol["crosscheck_rel_err"] = None  # 퇴화 → G1이 거부

    sol["expected_dc_gain"] = template["output_across"].get("expected_dc_gain")
    sol["expected_hf_gain"] = template["output_across"].get("expected_hf_gain")
    sol["answers"] = [
        {
            "symbol": a["symbol"],
            "name": a.get("name"),
            "value": sig(sol.get(a["symbol"], 0.0)),
            "value_raw": sol.get(a["symbol"], 0.0),  # 비반올림 원값 — 채점기 허용오차 판정용 (5-페르소나 P3)
            "unit": a["unit"],
        }
        for a in template["asks"]
    ]
    return sol


# 채점 계약 (5-페르소나 P3 — 정답 안전 Hard Stop 도메인): value 는 %g 4유효숫자 = round-half-even.
# 시험 관례(round-half-up)와 .5 경계에서 갈릴 수 있으므로 채점기는 정확일치 금지, value_raw + 상대 허용오차 사용.
ANSWER_POLICY: dict = {
    "sig_figs": 4,
    "rounding": "round-half-even (%g)",
    "grading_tolerance_rel": 5e-4,  # 4유효숫자 반올림 최대 상대오차(≈4.95e-4) 상회 — 정확일치 채점 금지
    "grading_value": "value_raw",
}


def generate_one(template: dict, ref: dict, seed: int, out_dir: Path) -> dict:
    """단일 문제 생성 — 템플릿구조검증→난수화→조립(공용)→게이트→SVG→JSON. 게이트 실패는 LOUD."""
    validate_template_structure(template)  # V1-T: element↔포트·연결단일루프·접두 화이트리스트 등 (저작 오류 조기 차단)
    rng = random.Random(seed)
    last_g2 = ""

    for _attempt in range(MAX_DIFFICULTY_ATTEMPTS):
        vals = randomize(template, rng)
        netlist = build_netlist(template, vals)
        sol = assemble_gate_input(template, ref, netlist, vals)

        hard_validate(sol)  # G1·V1(극점+DC이득+HF이득)·G4 — 구조/정확성 실패면 raise(재시도 안 함)

        ok, last_g2 = within_difficulty(sol, template)
        if ok:
            svg_name = f"{template['id']}-{seed:04d}.svg"
            render_svg(template, vals, out_dir / svg_name)
            problem = {
                "template_id": template["id"],
                "reference_id": template["reference_id"],
                "seed": seed,
                "exam_class": template["exam_class"],
                "title": template["title"],
                "netlist": netlist,
                "ports": {
                    "input": [template["input_across"]["pos"], template["input_across"]["neg"]],
                    "output": [template["output_across"]["pos"], template["output_across"]["neg"]],
                    "output_element": template["output_across"]["element"],
                },
                "values": {k: {"value": v, "unit": template["variables"][k]["unit"]} for k, v in vals.items()},
                "transfer_function": sol["H_str"],
                "steps": ref["steps"](vals, sol, fmt_si),
                "answers": sol["answers"],
                "answer_policy": ANSWER_POLICY,  # 채점 계약 — 정확일치 금지, value_raw + 상대 허용오차 (P3)
                "gate_report": {
                    # 'PASS' 리터럴 불변식: 직전 hard_validate 가 raise 안 했음 = G1·G4 통과 (P5 게이트 1급화는 승격 태스크)
                    "G1_unique_solution": "PASS",
                    "V1_pole_crosscheck_rel_err": sol["crosscheck_rel_err"],
                    "V1_dc_gain": {"observed": sig(sol["dc_gain"]), "expected": sol["expected_dc_gain"]},
                    "V1_hf_gain": {"observed": sig(sol["hf_gain"]), "expected": sol["expected_hf_gain"]},
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
    ap.add_argument("--template", type=str, default=str(DEFAULT_TEMPLATE))
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--out", type=str, default=str(ROOT / "out"))
    args = ap.parse_args()

    template = json.loads(Path(args.template).read_text(encoding="utf-8"))
    ref = get_reference(template["reference_id"])
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"S10 PoC — 템플릿 {template['id']} ({template['title']})")
    for i in range(args.count):
        seed = args.seed + i
        p = generate_one(template, ref, seed, out_dir)
        ans = ", ".join(f"{a['symbol']}={a['value']} {a['unit']}" for a in p["answers"])
        gr = p["gate_report"]
        print(
            f"  [seed {seed:04d}] PASS — {ans}"
            f" | V1 rel_err={gr['V1_pole_crosscheck_rel_err']:.2e}"
            f" | H(0)={gr['V1_dc_gain']['observed']}=={gr['V1_dc_gain']['expected']}"
            f" H(∞)={gr['V1_hf_gain']['observed']}=={gr['V1_hf_gain']['expected']}"
        )
    print(f"완료: {args.count}문제 → {out_dir}")


if __name__ == "__main__":
    main()
