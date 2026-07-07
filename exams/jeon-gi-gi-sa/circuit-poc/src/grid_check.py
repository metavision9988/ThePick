"""전수 그리드 검증 — 템플릿별 variables choices 전 조합의 물리 정확성 (영속 재현 스크립트).

2차 독립 리뷰(F-1a MINOR-4) 반영: verdict 최강 주장("전수 조합 정확")의 근거 스크립트가
휘발(리뷰 에이전트 임시 실행)이었음 → 영속화. 5-페르소나 리뷰 반영(2026-07-07):
  - 템플릿 목록 = templates/*.json 자동 발견(P2 — 하드코딩 목록은 신규 템플릿 무음 누락 경로)
  - 허용오차 = solver_gate 상수 import(P5 — 재선언은 게이트 개정 시 무음 드리프트)
  - 이득 nan = LOUD FAIL(P1 — `abs(nan-x) > tol == False` 는 fail-open 무음 통과였음)
검증 = 조합마다 ① lcapy 유도(derive) vs 폐형식(reference) 교차검증 rel_err ≤ V1_REL_TOL
② 이득 (H(0), H(∞)) 유한 + 템플릿 기대값 ③ 전 답 유한성.
G2 난이도 밴드는 생성 경로 전용(재난수화 신호)이라 여기선 미적용 — 전수 "물리 정확성"만 본다.
실패는 상세 출력 + exit 1 (사일런트 skip 0).

사용: .venv/bin/python src/grid_check.py
"""
from __future__ import annotations

import itertools
import json
import math
from pathlib import Path

from generate import build_netlist, crosscheck, ROOT, solve
from references import get_reference
from solver_gate import DC_GAIN_TOL, SolverGateError, V1_REL_TOL, validate_template_structure


def run_template(path: Path) -> tuple[int, int, float]:
    t = json.loads(path.read_text(encoding="utf-8"))
    validate_template_structure(t)  # V1-T 선행
    ref = get_reference(t["reference_id"])
    in_p = (t["input_across"]["pos"], t["input_across"]["neg"])
    out_p = (t["output_across"]["pos"], t["output_across"]["neg"])
    exp_dc = t["output_across"].get("expected_dc_gain")
    exp_hf = t["output_across"].get("expected_hf_gain")
    if exp_dc is None or exp_hf is None:  # 게이트 계약 정합 — raw KeyError 아닌 LOUD (P2/P4)
        raise SolverGateError(f"{t['id']}: expected_dc_gain/expected_hf_gain 미선언 — 템플릿 필수")

    names = list(t["variables"])
    grids = [t["variables"][n]["choices"] for n in names]
    total = fails = 0
    worst = 0.0

    for combo in itertools.product(*grids):
        vals = dict(zip(names, combo))
        total += 1
        sol = solve(build_netlist(t, vals), in_p, out_p)
        problems: list[str] = []
        if not (sol.get("solved") and len(sol.get("den_coeffs", [])) == 3):
            problems.append(f"해석 실패/비2차: {sol.get('solve_error', sol.get('den_coeffs'))}")
        else:
            derived = ref["derive"](sol["den_coeffs"])
            rel = crosscheck(derived, ref["reference"](vals))
            worst = max(worst, rel)
            if not math.isfinite(rel) or rel > V1_REL_TOL:
                problems.append(f"교차검증 rel_err {rel} > {V1_REL_TOL:.0e}")
            if any(not math.isfinite(v) for v in derived.values()):
                problems.append(f"비유한 답: {derived}")
            gains_finite = math.isfinite(sol["dc_gain"]) and math.isfinite(sol["hf_gain"])
            if not gains_finite:  # nan 비교는 fail-open → 유한성 선검사 (P1)
                problems.append(f"이득 비유한: H(0)={sol['dc_gain']}, H(∞)={sol['hf_gain']}")
            elif abs(sol["dc_gain"] - exp_dc) > DC_GAIN_TOL or abs(sol["hf_gain"] - exp_hf) > DC_GAIN_TOL:
                problems.append(
                    f"이득 불일치: H(0)={sol['dc_gain']}≟{exp_dc}, H(∞)={sol['hf_gain']}≟{exp_hf}"
                )
        if problems:
            fails += 1
            print(f"  ❌ {t['id']} {vals}: " + " | ".join(problems))
    return total, fails, worst


def main() -> int:
    templates = sorted((ROOT / "templates").glob("*.json"))
    if not templates:  # 빈 발견 = 무음 PASS 금지
        print("RESULT: FAIL — templates/*.json 0건 (검증 대상 부재)")
        return 1
    grand_fails = 0
    for path in templates:
        total, fails, worst = run_template(path)
        grand_fails += fails
        status = "PASS" if fails == 0 else "FAIL"
        print(f"{status} — {path.name}: {total} 조합 전수, 불일치 {fails}, worst rel_err {worst:.3e}")
    if grand_fails:
        print(f"RESULT: FAIL — 총 불일치 {grand_fails}")
        return 1
    print(f"RESULT: PASS — {len(templates)}개 템플릿 전수 그리드 물리 정확성 확증")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
