#!/usr/bin/env python3
"""
STAGE 2 (2-5) — **백필 검수 재검증 라운드** (0047 적용 전 필수).

무엇을 하는가: `source-quotes.json` 의 58장을 **추출 경로와 다른 방식으로** 다시 확인하고,
사람이 행당 수초로 판정할 수 있는 검수 시트를 만든다.

★왜 별도 스크립트인가 (독립 리뷰 2026-08-08·08-10 교훈):
  기존 검수 시트는 **원문 머리 90자만** 보여줬다. 게이트 5종·검수 시트·e2e 세 방어선이
  전부 머리만 봐서 LAW-183(2,325자 중 95%가 별표+부칙+푸터)을 통과시켰다.
  그리고 08-10 에는 **머리가 정상인데 인용 전체가 다른 문서**인 LAW-178 이 나왔다.
  ⇒ 검수는 머리·꼬리·귀속·주소를 **동시에** 봐야 하고, 그 판정 근거가 기계로 찍혀야 한다.

★검사 4종 (전부 결정론 · LLM 0):
  A. **축자 실재** — 인용이 원본 PDF **전문**에 정규화 후 그대로 존재하는가.
     추출 창(`pdf_page±N`)이 아니라 문서 전체를 훑으므로 **추출 경로와 독립**이다.
  B. **조문 귀속** — 인용이 `제N조(제목)` 로 시작하고 그 제목이 노드 이름과 일치하는가.
     ★A 만으로는 부족하다: LAW-178 의 오귀속 인용도 PDF 안에 실재했다(A 통과·B 실패).
  C. **주소 정합** — 노드가 선언한 `pdf_page` 에 그 조문 **본문**이 실제로 있는가.
     불일치 시 **실측 페이지를 병기**한다(선언값을 덮어쓰지 않는다 — 발견을 지우지 않기 위해).
  D. **꼬리 오염** — 인용 말미가 부칙·별표·푸터·다음 조문을 삼켰는가(행 앵커).

★수치 정합(3-2)은 **여기서 다시 구현하지 않는다.** `packages/autoverify` 의 TS 엔진이 낸
  파일럿 판정(JSON)을 읽어 붙일 뿐이다 — 파이썬으로 미러를 짜면 "손 미러를 손으로 검증"이
  되고, 이 저장소는 그 구조로 3라운드 연속 사고를 냈다(결정 #9 원장).

사용:
  packages/parser/.venv/bin/python3 docs/batch-load/stage2-source-quote/audit_source_quotes.py
출력:
  review-audit.md   (검수 시트 — 행당 판정 + 근거)
  review-audit.json (기계 판독용)
종료 코드: A 또는 B 실패가 1건이라도 있으면 1 (0047 적용 차단 신호)
"""

import datetime
import importlib.util
import json
import pathlib
import re
import sys

import pdfplumber

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]

_spec = importlib.util.spec_from_file_location("extractor", OUT / "extract_source_quotes.py")
assert _spec is not None and _spec.loader is not None
X = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(X)

# 꼬리 오염 — 추출기 경계 정의와 **같은 행 앵커**를 쓴다(위치 무관 검사는 정상 상호참조를 오탐).
TAIL_PATTERNS = [
    (r"(?m)^\s*부\s*칙", "부칙"),
    (r"(?m)^\s*\[\s*별\s*표", "별표"),
    (r"(?m)^\s*-\s*\d+\s*-\s*$", "페이지 푸터"),
    (r"(?m)^\s*제\s*\d+\s*조(?:\s*의\s*\d+)?\s*\(", "다음 조문"),
]


def squash(text: str) -> str:
    """정규화 — 공백 전부 제거 + NFC. `packages/autoverify` 의 정규화와 같은 규약."""
    import unicodedata

    return re.sub(r"\s+", "", unicodedata.normalize("NFC", text))


def load_article_index() -> dict[str, dict]:
    """**제3의 주소원** — `article_index.py` 산출물. 없으면 빈 dict(검사 C2 생략).

    ★독립성: 이 색인은 PDF 구조만 보고 만든 조문 지도이고, 특정 노드의 인용도 인용을 찾은 위치도
      쓰지 않는다. 선언 `pdf_page` 와 **다른 출처**의 주소이므로, 둘이 어긋날 때 비로소
      "어느 쪽이 틀렸나"를 사람이 판단할 근거가 생긴다(독립 리뷰 C-3 권고 처분).
    """
    f = OUT / "article-index.json"
    return json.loads(f.read_text()) if f.exists() else {}


def load_pilot_verdicts() -> dict[str, dict]:
    """최신 파일럿 JSON(= TS 엔진 산출물)에서 카드별 판정을 읽는다. 없으면 빈 dict."""
    d = ROOT / "docs/audit/autoverify-pilot"
    files = sorted(d.glob("pilot-*.json")) if d.exists() else []
    if not files:
        return {}
    data = json.loads(files[-1].read_text())
    return {v["cardId"]: v for v in data.get("verdicts", [])}


def main() -> int:
    quotes = json.loads((OUT / "source-quotes.json").read_text())
    nodes = {n["id"]: n for n in json.loads((OUT / "node-inventory.json").read_text())}
    excluded = json.loads((OUT / "excluded.json").read_text())
    verdicts = load_pilot_verdicts()
    art_index = load_article_index()

    # 원본 PDF 전문 캐시 (검사 A·C 용)
    full_text: dict[str, str] = {}
    page_texts: dict[str, list[str]] = {}
    for chapter, path in X.PDF_BY_CHAPTER.items():
        if not path.exists():
            continue
        key = str(path)
        if key in full_text:
            continue
        with pdfplumber.open(path) as pdf:
            pages = [pdf.pages[i].extract_text() or "" for i in range(len(pdf.pages))]
        page_texts[key] = pages
        full_text[key] = X.normalize("\n".join(pages))

    rows, blocking = [], []
    for q in quotes:
        qid = q["id"]
        node = nodes[qid]
        path = X.PDF_BY_CHAPTER.get(node["chapter"])
        key = str(path) if path else ""
        quote = q["quote"]
        sq = squash(quote)

        # --- A. 축자 실재 (문서 전문 대조 — 추출 창과 독립) ---
        a_ok = key in full_text and sq in squash(full_text[key])

        # --- B. 조문 귀속 (인용 머리가 노드 이름의 조번호+제목인가) ---
        am = X.ARTICLE_RE.search(node["name"])
        tm = X.TITLE_RE.search(node["name"])
        if am is None or tm is None:
            b_ok, b_note = True, "조번호/제목 없는 문서 — 귀속 검사 대상 밖"
        else:
            num, sub = am.group(1), am.group(2)
            want = f"제{num}조" + (f"의{sub}" if sub else "") + "(" + squash(tm.group(1))
            b_ok = squash(quote).startswith(want)
            b_note = "머리 = 노드 조번호+제목" if b_ok else f"★머리 불일치 — 기대 '{want}…'"

        # --- C. 주소 정합 (선언 페이지에 본문이 있는가 / 실측 페이지 병기) ---
        declared = node["pdf_page"]
        measured: list[int] = []
        if key in page_texts:
            probe = sq[:40]
            measured = [i + 1 for i, t in enumerate(page_texts[key]) if probe in squash(t)]
        c_ok = bool(q.get("address_hit"))

        # --- C2. 제3의 주소원(조문 head 색인) 대조 ---
        index_pages: list[int] = []
        if am is not None and tm is not None:
            akey = f"제{am.group(1)}조" + (f"의{am.group(2)}" if am.group(2) else "")
            hits = art_index.get(node["chapter"], {}).get(akey, [])
            want_t = squash(tm.group(1))
            narrowed = [h for h in hits if h.get("title") == want_t] or hits
            index_pages = [h["page"] for h in narrowed]
        c2_ok = (not index_pages) or (declared in index_pages)

        # --- D. 꼬리 오염 ---
        body = quote[len(quote.split("\n")[0]) :] if "\n" in quote else ""
        tail_hits = [label for pat, label in TAIL_PATTERNS if re.search(pat, body)]

        v = verdicts.get(qid)
        disp = v["disposition"] if v else "—"
        failed = (
            ", ".join(f["check"].replace("S3-", "") for f in v["findings"] if not f["pass"])
            if v
            else "—"
        )

        if not a_ok or not b_ok:
            blocking.append((qid, "축자 실재" if not a_ok else "조문 귀속"))

        rows.append(
            {
                "id": qid,
                "name": node["name"],
                "len": len(quote),
                "A_verbatim": a_ok,
                "B_attribution": b_ok,
                "B_note": b_note,
                "C_address_hit": c_ok,
                "C2_index_agrees": c2_ok,
                "index_pages": index_pages,
                "declared_page": declared,
                "measured_pages": measured,
                "D_tail": tail_hits,
                "head": quote[:100].replace("\n", " "),
                "tail": quote[-100:].replace("\n", " "),
                "autoverify": disp,
                "autoverify_failed": failed,
            }
        )

    (OUT / "review-audit.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))

    n = len(rows)
    a_bad = [r for r in rows if not r["A_verbatim"]]
    b_bad = [r for r in rows if not r["B_attribution"]]
    c_bad = [r for r in rows if not r["C_address_hit"]]
    d_bad = [r for r in rows if r["D_tail"]]
    c2_bad = [r for r in rows if not r["C2_index_agrees"]]

    md = [
        "# STAGE 2 백필 **검수 재검증** — source_quote 58장",
        "",
        f"> 생성 {datetime.date.today().isoformat()} · 결정론 재검증(pdfplumber 전문 대조) · LLM 0",
        "> 생성기 `audit_source_quotes.py` — **추출 경로와 다른 방식**으로 다시 확인한 결과다.",
        "> ★수치 정합(3-2)은 여기서 재구현하지 않고 `packages/autoverify` TS 엔진의 파일럿 판정을 붙였다",
        ">   (파이썬 미러를 만들면 '손 미러를 손으로 검증'이 되고, 이 저장소는 그 구조로 3라운드 사고를 냈다).",
        "",
        "## 이 시트를 보는 법",
        "",
        "| 열 | 뜻 | 실패면 |",
        "| --- | --- | --- |",
        "| **A 축자** | 인용이 원본 PDF **전문**에 그대로 있는가(공백 무시) | ★**적재 차단** — 지어냈거나 변형됐다 |",
        "| **B 귀속** | 인용 머리가 그 노드의 `제N조(제목)` 인가 | ★**적재 차단** — 다른 조문/문서가 실렸다 |",
        "| **C 주소** | 선언 `pdf_page` 에 본문이 실제로 있는가 | 적재는 가능하나 **주소 데이터가 틀렸다** |",
        "| **C2 색인** | **제3의 주소원**(PDF 구조 색인)이 선언 페이지에 동의하는가 | 선언 주소가 틀렸을 가능성 — C 와 교차 판단 |",
        "| **D 꼬리** | 말미가 부칙·별표·푸터·다음 조문을 삼켰는가 | 인용이 조문 경계를 넘었다 |",
        "| **판정** | autoverify 엔진 처분(pass/queue/reject) | 사유 열 참조 |",
        "",
        "## 요약",
        "",
        f"- 대상 **{n}장** (의도적 제외 {len(excluded)}장은 아래 별도 절)",
        f"- **A 축자 실재: {n - len(a_bad)}/{n}**"
        + (f" — ★실패 {[r['id'] for r in a_bad]}" if a_bad else " ✅"),
        f"- **B 조문 귀속: {n - len(b_bad)}/{n}**"
        + (f" — ★실패 {[r['id'] for r in b_bad]}" if b_bad else " ✅"),
        f"- C 주소 정합: {n - len(c_bad)}/{n}"
        + (f" — 불일치 {[r['id'] for r in c_bad]} (실측 페이지 병기)" if c_bad else " ✅"),
        f"- **C2 색인 대조**(제3의 주소원): {n - len(c2_bad)}/{n}"
        + (
            f" — 불일치 {[r['id'] for r in c2_bad]}"
            if c2_bad
            else " ✅"
        ),
        "  ★C2 는 **선언 주소와 다른 출처**(PDF 구조 색인)라 C 와 어긋나는 지점이 곧 새 발견이다.",
        f"- D 꼬리 오염: {n - len(d_bad)}/{n}"
        + (f" — {[r['id'] for r in d_bad]}" if d_bad else " ✅"),
        "",
        (
            "**⛔ 적재 차단 사유 있음** — A/B 실패는 되돌릴 수 없는 백필(0047: NULL→값 1회)에 "
            "틀린 원문을 영구 고착시킨다. 정정 후 재생성할 것."
            if blocking
            else "**✅ 적재 차단 사유 없음** (A·B 전건 통과). C/D 는 아래 개별 확인 대상."
        ),
        "",
        "## 행별 검수",
        "",
        "| id | 노드 | 길이 | A | B | C | C2 | D | 판정 | 실패 검사 | 주소(선언→실측/색인) |",
        "| --- | --- | ---: | :-: | :-: | :-: | :-: | :-: | :-: | --- | --- |",
    ]
    for r in rows:
        addr = (
            "—"
            if (r["C_address_hit"] and r["C2_index_agrees"])
            else f"**{r['declared_page']} → 실측 {r['measured_pages'] or '미발견'} / 색인 {r['index_pages'] or '미발견'}**"
        )
        md.append(
            f"| {r['id']} | {r['name']} | {r['len']} | "
            f"{'✅' if r['A_verbatim'] else '❌'} | {'✅' if r['B_attribution'] else '❌'} | "
            f"{'✅' if r['C_address_hit'] else '⚠️'} | {'✅' if r['C2_index_agrees'] else '⚠️'} | "
            f"{'✅' if not r['D_tail'] else '⚠️' + '/'.join(r['D_tail'])} | "
            f"{r['autoverify']} | {r['autoverify_failed']} | {addr} |"
        )

    md += ["", "## 머리·꼬리 대조 (★머리만 보면 LAW-183·178 을 또 놓친다)", ""]
    for r in rows:
        md += [
            f"### {r['id']} — {r['name']}  ({r['len']}자 · {r['autoverify']})",
            "",
            f"- **머리** `{r['head']}…`",
            f"- **꼬리** `…{r['tail']}`",
        ]
        if not r["C_address_hit"] or not r["C2_index_agrees"]:
            md.append(
                f"- ⚠️ **주소 불일치** — 선언 `pdf_page {r['declared_page']}` / "
                f"실측 본문 `{r['measured_pages'] or '미발견'}` / "
                f"**제3 주소원(색인)** `{r['index_pages'] or '미발견'}`. "
                "인용 자체는 A·B 로 검증되므로 적재 가능하나 **주소 데이터 정정 대상**이다."
            )
        if r["D_tail"]:
            md.append(f"- ⚠️ **꼬리 오염 의심** — {', '.join(r['D_tail'])}")
        if not r["B_attribution"]:
            md.append(f"- ❌ **귀속 실패** — {r['B_note']}")
        md.append("")

    if excluded:
        md += ["## 의도적 제외 (백필 대상 아님)", ""]
        for e in excluded:
            md += [f"- **{e['id']}** {e['name']} — {e['reason']}", ""]

    (OUT / "review-audit.md").write_text("\n".join(md) + "\n")

    print(
        f"검수 재검증 {n}장 — A {n - len(a_bad)}/{n} · B {n - len(b_bad)}/{n} · "
        f"C {n - len(c_bad)}/{n} · C2 {n - len(c2_bad)}/{n} · D {n - len(d_bad)}/{n}"
    )
    for qid, why in blocking:
        print(f"  ❌ 적재 차단 {qid} — {why}")
    for r in c_bad:
        print(f"  ⚠ 주소 불일치 {r['id']} 선언 {r['declared_page']} → 실측 {r['measured_pages']}")
    return 1 if blocking else 0


if __name__ == "__main__":
    sys.exit(main())
