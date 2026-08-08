#!/usr/bin/env python3
"""
STAGE 2 (2-4) 백필 게이트 — 추출물이 "진짜 원문"인지 기계로 판정.

★개수(59/59)는 품질의 증거가 아니다. 아래 게이트를 전부 통과해야 백필 SQL 을 만든다.
  G-S2-7a 조문 제목 일치   — 노드 name 의 괄호 제목이 추출 원문 안에 실재하는가
                             (교재 이론서는 부록 합본이라 조 번호가 재사용된다 → 오조문 절단)
  G-S2-7b description 비동일 — 요약 복사가 아닌가 (복사면 검증이 자기 대조가 된다)
  G-S2-7c 길이 하한/상한    — 너무 짧으면 머리말만, 너무 길면 청크 실패(바이그램 포화)
  G-S2-7d 조 번호 실재      — 추출 원문이 그 조로 시작하는가
  G-S2-7e 전수             — 59/59, 중복 id 0
  G-S2-7f **꼬리 오염**     — 부칙·별표·페이지 푸터·다음 문서 머리를 삼키지 않았는가 ★CRITICAL 처분
  G-S2-7g **과대 배수**     — description 대비 6배 초과 = 절단 실패 의심 ★CRITICAL 처분

실패는 조용히 넘기지 않는다. 위반 목록을 출력하고 exit 1.
"""

import json
import pathlib
import re
import sys

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]

MIN_LEN = 30
MAX_LEN = 3000  # 조문 1개가 이보다 길면 절단 실패로 본다(다음 조 마커를 놓친 경우)
# ★독립 리뷰 CRITICAL 처분 — **꼬리 검사**. 초판 게이트 5종은 전부 인용의 *머리*만 봤고,
#   검수 시트도 머리 90자만 보여줬고, e2e 도 `!= ''`·`!= description` 만 봤다.
#   **세 방어선이 같은 맹점을 공유**한 결과 LAW-183(2,325자 중 95%가 별표 산식표+부칙+푸터)이
#   위반 0건으로 통과했다. 아래는 그 꼬리를 보는 게이트다.
TAIL_CONTAMINANTS = [
    (r"부\s*칙", "부칙 혼입"),
    (r"\[\s*별\s*표", "별표 혼입"),
    (r"(?m)^\s*-\s*\d+\s*-\s*$", "페이지 푸터 혼입"),
    (r"(?m)^\s*\d+\.\s+\S.*\n.*\[시행", "다음 문서 머리 혼입"),
]
# description 대비 과대 배수 — 조문 원문이 요약보다 이 배수 이상 길면 다른 문서를 삼켰을 신호
DESC_RATIO_MAX = 6.0


def load_descriptions() -> dict[str, str]:
    """gap-P1/P2 insert.sql 에서 id → description 을 결정론 파싱."""
    out: dict[str, str] = {}
    for path in sorted(ROOT.glob("docs/batch-load/gap-P*/*insert*.sql")):
        for line in path.read_text().split("\n"):
            if not line.startswith("INSERT OR IGNORE INTO knowledge_nodes"):
                continue
            m = re.search(r"VALUES \('(LAW-\d+)', 'LAW', '(?:[^']|'')*', '((?:[^']|'')*)'", line)
            if m:
                out[m.group(1)] = m.group(2).replace("''", "'")
    return out


def title_of(name: str) -> str | None:
    m = re.search(r"\(([^)]+)\)\s*$", name)
    return m.group(1).strip() if m else None


def squash(text: str) -> str:
    return re.sub(r"\s+", "", text)


def main() -> int:
    quotes = json.loads((OUT / "source-quotes.json").read_text())
    nodes = json.loads((OUT / "node-inventory.json").read_text())
    excluded_path = OUT / "excluded.json"
    excluded = json.loads(excluded_path.read_text()) if excluded_path.exists() else []
    descs = load_descriptions()
    violations: list[str] = []

    # G-S2-7e 전수·중복
    ids = [q["id"] for q in quotes]
    # 전수 = 추출 + **의도적 제외**. 제외는 조용히 빠지지 않고 사유와 함께 계상된다.
    if len(ids) + len(excluded) != len(nodes):
        violations.append(
            f"[7e] 전수 불일치 — 추출 {len(ids)} + 제외 {len(excluded)} / 대상 {len(nodes)}"
        )
    if len(set(ids)) != len(ids):
        violations.append("[7e] 중복 id 존재")

    for q in quotes:
        qid, name, quote = q["id"], q["name"], q["quote"]
        squashed = squash(quote)

        # G-S2-7c 길이
        if len(quote) < MIN_LEN:
            violations.append(f"[7c] {qid} 원문 과소 {len(quote)}자 — 머리말만 잡혔을 수 있음")
        if len(quote) > MAX_LEN:
            violations.append(f"[7c] {qid} 원문 과대 {len(quote)}자 — 조문 절단 실패(청크 요건 위반)")

        # G-S2-7d 조 번호 실재 (조 번호가 있는 노드만)
        m = re.search(r"제\s*(\d+)\s*조(?:\s*의\s*(\d+))?", name)
        if m:
            num, sub = m.group(1), m.group(2)
            pat = rf"제{num}조" + (rf"의{sub}" if sub else "")
            if not re.search(pat, squashed[:80]):
                violations.append(f"[7d] {qid} 원문 머리에 {pat} 없음 — 다른 조문을 잡았을 수 있음")

        # G-S2-7a 조문 제목 일치 (교재 합본에서 조 번호 재사용 → 오조문 절단 탐지)
        title = title_of(name)
        if title:
            # ★독립 리뷰 MAJOR: 초판은 `if title and m:` 이라 **조 번호가 없는 노드**(LAW-202 고시)에서
            #   7a·7d 를 통째로 건너뛰었다 — 가장 못 미더운 1건에 게이트가 가장 적게 작동했다.
            #   조번호가 없으면 머리 200자 대신 전문에서 제목을 찾는다(문서 제목은 머리에 없을 수 있다).
            window = squashed[:200] if m else squashed
            if squash(title) not in window:
                violations.append(
                    f"[7a] {qid} 제목 불일치 — name 제목 '{title}' 이 원문에 없음"
                )

        # G-S2-7f 꼬리 오염 (독립 리뷰 CRITICAL 처분)
        for pat, label in TAIL_CONTAMINANTS:
            if re.search(pat, quote):
                violations.append(f"[7f] {qid} {label} — 조문 경계를 넘어 다음 문서를 삼켰다")

        # G-S2-7b description 비동일
        desc = descs.get(qid)
        if desc is not None:
            if squash(desc) == squashed:
                violations.append(f"[7b] {qid} description 과 동일 — 요약 복사(검증이 자기 대조가 됨)")
            # G-S2-7g 과대 배수 — 요약보다 지나치게 길면 다른 문서를 삼켰을 신호 (꼬리 검사 보조)
            if len(desc) > 0 and len(quote) / len(desc) > DESC_RATIO_MAX:
                violations.append(
                    f"[7g] {qid} description 대비 {len(quote) / len(desc):.1f}배 — 절단 실패 의심"
                )

    print(
        f"게이트 검사 대상 {len(quotes)}건 · 위반 {len(violations)}건"
        + (f" · 의도적 제외 {len(excluded)}건(사유 기록됨)" if excluded else "")
    )
    for e in excluded:
        print(f"  ⊘ 제외 {e['id']} — {e['reason'][:70]}…")
    for v in violations:
        print("  ✗", v)
    if not violations:
        lens = sorted(len(q["quote"]) for q in quotes)
        print(f"  길이 분포: min {lens[0]} · median {lens[len(lens) // 2]} · max {lens[-1]}")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
