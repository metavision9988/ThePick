"""Solver-Validated Gate 거부 실증 — 특정 게이트가 실제로 발화하는지 검증.

독립 리뷰(review wf_a1fd2c69) 반영:
  - MAJOR-1: 종전 테스트는 V1이 먼저 걸려 G1을 실검증 못함 → 각 케이스가 발화해야 할 게이트 id를 assert.
    + 포지티브 컨트롤(V1·G4는 통과, G1만 위반)로 G1 회귀를 뮤테이션-검출.
  - MAJOR-2: 출력탭 오배선(L↔C 스왑)이 DC-이득 게이트로 거부되는지 실증.
  - MINOR-3: G2 난이도 밴드 판별 동작 단위검증.
사일런트 드롭 금지(가드레일 16-③): 거부는 SolverGateError 예외로만.
"""
from __future__ import annotations

import json
from pathlib import Path

from generate import closed_form, crosscheck, solve
from solver_gate import SolverGateError, hard_validate, within_difficulty

TEMPLATE = json.loads((Path(__file__).resolve().parents[1] / "templates" / "rlc_series.json").read_text(encoding="utf-8"))
IN_P = (TEMPLATE["input_across"]["pos"], TEMPLATE["input_across"]["neg"])
OUT_P = (TEMPLATE["output_across"]["pos"], TEMPLATE["output_across"]["neg"])
EXP_DC = TEMPLATE["output_across"]["expected_dc_gain"]


def _norm(sol: dict) -> dict:
    sol.setdefault("crosscheck_rel_err", None)
    sol.setdefault("expected_dc_gain", EXP_DC)
    sol.setdefault(
        "answers",
        [{"symbol": "f0", "unit": "Hz"}, {"symbol": "Q", "unit": "(무차원)"}, {"symbol": "zeta", "unit": "(무차원)"}],
    )
    return sol


def expect_reject(name: str, sol: dict, must_fire: str) -> bool:
    """거부 + 지정 게이트('G1'/'출력탭'/…)가 실제 발화했는지 검증."""
    try:
        hard_validate(_norm(sol))
    except SolverGateError as e:
        msg = str(e)
        if must_fire in msg:
            print(f"  ✅ 거부 [{name}] — '{must_fire}' 발화")
            print(f"       {msg}")
            return True
        print(f"  ❌ 거부되나 기대 게이트 '{must_fire}' 미발화 [{name}]: {msg}")
        return False
    print(f"  ❌ 미거부 [{name}] — 게이트를 통과하면 안 됨")
    return False


def main() -> int:
    results: list[bool] = []

    print("== G1 특이 토폴로지 거부 (게이트 id 실발화 검증) ==")
    degenerate = [
        ("부동노드: 커패시터 제거 → 노드3 부유", "V1 1 0 step 10\nR1 1 2 100\nL1 2 3 0.01"),
        ("출력단락: 커패시터를 도선으로", "V1 1 0 step 10\nR1 1 2 100\nL1 2 3 0.01\nW1 3 0"),
        ("모순전원: 상이 전압원 병렬", "V1 1 0 dc 10\nV2 1 0 dc 5\nR1 1 0 100"),
        ("R=0: 감쇠 소실(ζ=0) 비물리", "V1 1 0 step 10\nR1 1 2 0\nL1 2 3 0.01\nC1 3 0 1e-6"),
    ]
    for name, net in degenerate:
        results.append(expect_reject(name, solve(net, IN_P, OUT_P), "G1"))

    print("\n== 포지티브 컨트롤: V1·G4 통과 & G1만 위반 (G1 회귀 뮤테이션 가드) ==")
    pc = {
        "solved": True,
        "den_coeffs": [1.0],  # 0차 → 2차 아님 = G1 위반
        "w0": 0.0,
        "zeta": 0.0,
        "dc_gain": EXP_DC,  # V1 출력탭 통과
        "expected_dc_gain": EXP_DC,
        "crosscheck_rel_err": 0.0,  # V1 극점 통과
    }
    results.append(expect_reject("합성: 극점·DC·단위 통과, 구조만 붕괴", pc, "G1"))

    print("\n== 출력탭 오배선 거부 (MAJOR-2: L↔C 스왑 → DC 이득 0≠1) ==")
    swap_net = "V1 1 0 step 10\nR1 1 2 22\nC1 2 3 4.7e-08\nL1 3 0 0.001"  # 노드3-0 = 인덕터 양단(고역통과)
    swap = solve(swap_net, IN_P, OUT_P)
    swap["crosscheck_rel_err"] = crosscheck(swap, closed_form({"R": 22, "L": 0.001, "C": 4.7e-8}))  # 극점은 동일 → 통과
    swap["expected_dc_gain"] = EXP_DC
    results.append(expect_reject("L↔C 스왑(극점 동일·출력탭 상이)", swap, "출력탭"))

    print("\n== G2 난이도 밴드 판별 동작 (MINOR-3) ==")
    lo_ok, _ = within_difficulty({"f0": 5.0}, TEMPLATE)  # <10 → False
    in_ok, _ = within_difficulty({"f0": 1000.0}, TEMPLATE)  # 밴드 내 → True
    g2 = (not lo_ok) and in_ok
    print(f"  {'✅' if g2 else '❌'} G2: f0=5Hz→거부({not lo_ok}), f0=1kHz→허용({in_ok})")
    results.append(g2)

    print()
    if all(results):
        print(f"RESULT: PASS — {len(results)}/{len(results)} 검증 통과 (사일런트 드롭 0, 게이트 id 실발화 확인).")
        return 0
    print(f"RESULT: FAIL — {sum(results)}/{len(results)} 통과.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
