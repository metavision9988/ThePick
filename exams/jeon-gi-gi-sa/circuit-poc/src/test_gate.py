"""Solver-Validated Gate 실증 — 다중 템플릿 관통 + 특정 게이트 실발화 검증.

독립 리뷰(wf_a1fd2c69) + 2차 독립 리뷰(F-1a, §7 Fable 게이트 2026-07-07) 반영:
  - 다중 템플릿(저역통과·대역통과)이 단일 파이프라인을 관통하는지.
  - 1차 MAJOR-1: 게이트 id 실발화 assert + 포지티브 컨트롤(V1·G4 통과·G1만 위반) = G1 회귀 뮤테이션 가드.
  - 1차 MAJOR-2: 출력탭 오배선을 이득 게이트가 거부 — L↔C 스왑(저역통과 기준 H(0)=0≠1) +
    ★ 고역통과 오배선(대역통과 기준 H(0)=0 통과하나 H(∞)=1≠0) = **H(∞) 게이트가 대역통과(0,0)와 고역통과(0,1) 구별**.
  - 2차 MAJOR-1·2: V1-T 템플릿 구조 게이트 — element↔포트 모순·비직렬(렌더러 오도면) LOUD 거부.
  - 2차 MINOR-5: 이득 기대값 미선언 = LOUD (H(∞) 판별 무음 OFF 차단).
  - MINOR-3: G2 난이도 밴드 판별 동작.
★정직 기록(2026-07-07 실측): 병렬 상이 전압원(모순전원)은 lcapy transfer()가 거부하지 않고
  정상 H를 반환 — G1이 못 잡는 알려진 한계. 방어선 = 템플릿 인간 승인(단일 소스).
사일런트 드롭 금지(가드레일 16-③): 거부는 SolverGateError 예외로만.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from generate import ROOT, build_netlist, crosscheck, generate_one, solve
from references import get_reference
from solver_gate import SolverGateError, validate_template_structure, within_difficulty

LOWPASS = json.loads((ROOT / "templates" / "rlc_series.json").read_text(encoding="utf-8"))
BANDPASS = json.loads((ROOT / "templates" / "rlc_series_bandpass.json").read_text(encoding="utf-8"))
VALS = {"V": 10, "R": 22, "L": 0.001, "C": 4.7e-8}  # 스왑/오배선 테스트 공통값


def _mag_bandpass(f: float, R: float, L: float, C: float) -> float:
    """직렬 RLC 저항 양단 |H(j2πf)| = |R/(R+jωL+1/(jωC))| — _cutoffs 공식과 독립(폐형식 미사용)."""
    w = 2 * math.pi * f
    return abs(R / complex(R, w * L - 1 / (w * C)))


def _ports(t: dict) -> tuple[tuple[int, int], tuple[int, int]]:
    o, i = t["output_across"], t["input_across"]
    return (i["pos"], i["neg"]), (o["pos"], o["neg"])


def _gate_input(template: dict, netlist: str, vals: dict | None = None) -> dict:
    """generate_one과 동일한 게이트 입력 구성(derive+crosscheck+이득)을 재현."""
    ref = get_reference(template["reference_id"])
    in_p, out_p = _ports(template)
    sol = solve(netlist, in_p, out_p)
    if sol.get("solved") and len(sol.get("den_coeffs", [])) == 3:
        derived = ref["derive"](sol["den_coeffs"])
        sol.update(derived)
        # vals 주면 실제 교차검증(극점 일치 → V1 통과 → 출력탭/구조 게이트만 남김), 없으면 0.0
        sol["crosscheck_rel_err"] = crosscheck(derived, ref["reference"](vals)) if vals else 0.0
    else:
        sol["crosscheck_rel_err"] = None
    sol["expected_dc_gain"] = template["output_across"]["expected_dc_gain"]
    sol["expected_hf_gain"] = template["output_across"].get("expected_hf_gain")
    sol["answers"] = [{"symbol": a["symbol"], "unit": a["unit"]} for a in template["asks"]]
    return sol


def expect_reject(name: str, sol: dict, must_fire: str) -> bool:
    from solver_gate import hard_validate

    try:
        hard_validate(sol)
    except SolverGateError as e:
        msg = str(e)
        if must_fire in msg:
            print(f"  ✅ 거부 [{name}] — '{must_fire}' 발화\n       {msg}")
            return True
        print(f"  ❌ 거부되나 기대 게이트 '{must_fire}' 미발화 [{name}]: {msg}")
        return False
    print(f"  ❌ 미거부 [{name}] — 게이트를 통과하면 안 됨")
    return False


def expect_template_reject(name: str, template: dict, must_fire: str) -> bool:
    """V1-T 템플릿 구조 게이트 실발화 검증 (F-1a 2차 MAJOR-1·2)."""
    try:
        validate_template_structure(template)
    except SolverGateError as e:
        msg = str(e)
        if must_fire in msg:
            print(f"  ✅ 거부 [{name}] — '{must_fire}' 발화\n       {msg}")
            return True
        print(f"  ❌ 거부되나 기대 '{must_fire}' 미발화 [{name}]: {msg}")
        return False
    print(f"  ❌ 미거부 [{name}] — V1-T 를 통과하면 안 됨")
    return False


def main() -> int:
    results: list[bool] = []
    (ROOT / "out-test").mkdir(exist_ok=True)

    print("== 다중 템플릿 단일 파이프라인 관통 + 상이 물리 직접 검증 ==")
    ans_by_id: dict[str, dict] = {}
    for t in (LOWPASS, BANDPASS):
        ref = get_reference(t["reference_id"])
        try:
            p = generate_one(t, ref, 1, ROOT / "out-test")  # 테스트 산출 격리(실 out/ 오염 방지, 2차 MINOR-6)
            ans_by_id[t["id"]] = {a["symbol"]: a["value"] for a in p["answers"]}
            ok = p["gate_report"]["G1_unique_solution"] == "PASS" and len(p["answers"]) == len(t["asks"])
            print(f"  {'✅' if ok else '❌'} {t['id']} → {', '.join(f'{k}={v}' for k, v in ans_by_id[t['id']].items())}")
            results.append(ok)
        except (SolverGateError, KeyError) as e:
            print(f"  ❌ {t['id']} 생성 실패: {e}")
            results.append(False)

    # 상이/공유 물리 직접 검증 (동일 seed → 동일 값 → 극점 공유; 대역만 BW·차단주파수)
    lp, bp = ans_by_id.get(LOWPASS["id"], {}), ans_by_id.get(BANDPASS["id"], {})
    phys = bool(lp and bp) and (
        abs(lp["f0"] - bp["f0"]) < 1.0  # 극점 공유(동일 값)
        and abs(lp["Q"] - bp["Q"]) < 0.01
        and bp["f_low"] < bp["f0"] < bp["f_high"]  # 대역통과 차단주파수 순서
        and abs((bp["f_high"] - bp["f_low"]) - bp["BW"]) < max(1.0, 0.01 * bp["BW"])  # BW 항등
    )
    print(f"  {'✅' if phys else '❌'} 상이 물리: 극점 공유(저역 f0/Q=대역 f0/Q) + f_low<f0<f_high + (f_high−f_low)≈BW")
    results.append(phys)

    print("\n== 차단주파수 −3dB 독립 검증 (MINOR-1 backstop: _cutoffs 공식) ==")
    ref_bp = get_reference(BANDPASS["reference_id"])["reference"](VALS)
    target = 1 / math.sqrt(2)
    mags = {k: _mag_bandpass(ref_bp[k], VALS["R"], VALS["L"], VALS["C"]) for k in ("f_low", "f_high")}
    cut_ok = all(abs(m - target) < 1e-3 for m in mags.values())
    print(f"  {'✅' if cut_ok else '❌'} |H(j2πf_c)| @ (f_low={ref_bp['f_low']:.1f},f_high={ref_bp['f_high']:.1f}) = "
          f"({mags['f_low']:.4f},{mags['f_high']:.4f}), 기대 {target:.4f}")
    results.append(cut_ok)

    print("\n== G1 특이 토폴로지 거부 (게이트 id 실발화) ==")
    # ★2차 리뷰 정정: 구 "모순전원" 케이스의 실거부 사유 = 출력노드 부재(Unknown node 3)였음 → 정직 라벨.
    #   진짜 모순전원(상이 전압원 병렬, 전 노드 실재)은 transfer()가 거부하지 않음(모듈 도크스트링 한계 기록).
    degenerate = [
        ("부동노드: 커패시터 제거", "V1 1 0 step 10\nR1 1 2 100\nL1 2 3 0.01"),
        ("출력단락: 커패시터를 도선으로", "V1 1 0 step 10\nR1 1 2 100\nL1 2 3 0.01\nW1 3 0"),
        ("출력노드 부재: 넷리스트에 노드 3 없음", "V1 1 0 dc 10\nV2 1 0 dc 5\nR1 1 0 100"),
        ("R=0: 감쇠 소실(ζ=0)", "V1 1 0 step 10\nR1 1 2 0\nL1 2 3 0.01\nC1 3 0 1e-6"),
    ]
    for name, net in degenerate:
        results.append(expect_reject(name, _gate_input(LOWPASS, net), "G1"))

    print("\n== 포지티브 컨트롤: V1·G4 통과 & G1만 위반 (G1 회귀 뮤테이션 가드) ==")
    pc = {
        "solved": True,
        "den_coeffs": [1.0],  # 0차 → 2차 아님 = G1 위반
        "w0": 0.0,
        "zeta": 0.0,
        "dc_gain": 1.0,
        "hf_gain": 0.0,  # V1 출력탭(H(0),H(∞)) 통과
        "expected_dc_gain": 1.0,
        "expected_hf_gain": 0.0,
        "crosscheck_rel_err": 0.0,  # V1 극점 통과
        "answers": [{"symbol": "f0", "unit": "Hz"}],
    }
    results.append(expect_reject("합성: 극점·이득·단위 통과, 구조만 붕괴", pc, "G1"))

    print("\n== 출력탭 오배선 거부 (MAJOR-2) ==")
    # (a) L↔C 스왑 → 저역통과 기준 H(0)=0≠1
    swap_net = "V1 1 0 step 10\nR1 1 2 22\nC1 2 3 4.7e-08\nL1 3 0 0.001"  # 노드3-0 = 인덕터 양단
    results.append(expect_reject("L↔C 스왑 vs 저역통과(H(0) 0≠1)", _gate_input(LOWPASS, swap_net, VALS), "출력탭"))
    # (b) ★ 고역통과 오배선 → 대역통과 기준: H(0)=0 통과하나 H(∞)=1≠0 → H(∞) 게이트가 유일하게 잡음
    hp_net = "V1 1 0 step 10\nR1 1 2 22\nC1 2 3 4.7e-08\nL1 3 0 0.001"  # 출력=L 양단 = 고역통과 (0,1)
    results.append(expect_reject("고역통과 오배선 vs 대역통과(H(∞) 1≠0)", _gate_input(BANDPASS, hp_net, VALS), "H(∞)"))

    print("\n== V1-T 템플릿 구조 게이트 (2차 리뷰 MAJOR-1·2) ==")
    # (a) element 오기: 포트는 C1 노드(3,0) 유지·element만 L1 변조 — 종전엔 전 게이트 통과(JSON ports≠element 모순 + SVG 오라벨)
    bad_elem = json.loads(json.dumps(LOWPASS))
    bad_elem["output_across"]["element"] = "L1"
    results.append(expect_template_reject("element↔포트 모순 (element만 L1 변조)", bad_elem, "element/포트 모순"))
    # (b) 비직렬(병렬 RLC): 렌더러 직렬 가정 → 종전엔 무음으로 직렬 오도면 생성
    par = json.loads(json.dumps(LOWPASS))
    par["netlist_template"] = "V1 1 0 step {V}\nR1 1 0 {R}\nL1 1 0 {L}\nC1 1 0 {C}"
    par["output_across"] = {"element": "C1", "pos": 1, "neg": 0, "expected_dc_gain": 1, "expected_hf_gain": 0}
    results.append(expect_template_reject("비직렬(병렬 RLC) 템플릿", par, "직렬 단일루프 아님"))
    # (c) 정상 템플릿 2종 = V1-T 통과 (게이트 과차단 회귀 방지)
    try:
        validate_template_structure(LOWPASS)
        validate_template_structure(BANDPASS)
        print("  ✅ 정상 템플릿 2종 V1-T 통과 (과차단 없음)")
        results.append(True)
    except SolverGateError as e:
        print(f"  ❌ 정상 템플릿이 V1-T 에 걸림: {e}")
        results.append(False)

    print("\n== 이득 기대값 미선언 = LOUD (H(∞) 무음 OFF 차단, 2차 MINOR-5) ==")
    no_hf = _gate_input(LOWPASS, build_netlist(LOWPASS, VALS), VALS)  # 정상 회로 — 이득 선언만 제거
    no_hf["expected_hf_gain"] = None
    results.append(expect_reject("expected_hf_gain 미선언", no_hf, "미선언"))

    print("\n== G2 난이도 밴드 판별 동작 (MINOR-3) ==")
    lo_ok, _ = within_difficulty({"f0": 5.0}, LOWPASS)  # <10 → False
    in_ok, _ = within_difficulty({"f0": 1000.0}, LOWPASS)  # 밴드 내 → True
    g2 = (not lo_ok) and in_ok
    print(f"  {'✅' if g2 else '❌'} G2: f0=5Hz→거부({not lo_ok}), f0=1kHz→허용({in_ok})")
    results.append(g2)

    print()
    if all(results):
        print(f"RESULT: PASS — {len(results)}/{len(results)} 검증 통과 (다중 템플릿·게이트 id 실발화·사일런트 드롭 0).")
        return 0
    print(f"RESULT: FAIL — {sum(results)}/{len(results)} 통과.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
