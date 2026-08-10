#!/usr/bin/env python3
"""
**제3의 주소원** — 조문 head 색인 (독립 리뷰 C-3 권고 처분).

## 왜 만드는가

3-1/3-3 의 출처 청크는 노드가 선언한 `pdf_page` 에서 뽑는다. 그런데 그 `pdf_page` 가 틀리면
정상 인용이 "주소 오류"로 걸리고, 그때 사람이 할 수 있는 일은 **인용을 의심하는 것뿐**이다
(선언값 말고는 비교 대상이 없으므로). 실제로 상법 8건이 그 상태였다.

독립 리뷰 C-3 이 요구한 것: *"진짜 독립 확증을 원하면 **인용 위치와 무관한 제3의 주소원**이 필요하다."*

## 무엇이 '독립'인가

이 색인의 입력은 **PDF 구조뿐**이다 — 문서를 훑어 `제N조(제목)` 형태의 **조문 머리**가
어느 페이지에서 시작하는지 지도로 만든다. 특정 노드의 인용도, 인용을 찾은 위치도 쓰지 않는다.
조회 키는 노드 이름에서 얻은 **조 번호**뿐이다.

⇒ 이제 주소가 **두 개**다: ① 노드가 선언한 `pdf_page` ② 색인이 말하는 페이지.
   둘이 어긋나면 **어느 쪽이 틀렸는지 사람이 판단할 근거**가 생긴다(전에는 근거가 없었다).

## 무엇이 여전히 '독립이 아닌가' (정직)

색인이 지목한 페이지에서 청크를 뜨면, 결정론 추출물인 인용은 **당연히** 그 안에 있다.
즉 이 색인은 **3-1 을 비항등식으로 만들지 못한다** — 그건 결정론 코퍼스에서 원리적으로 불가능하다
(리뷰 C-3·§8-1). 색인이 주는 것은 **주소 판정의 독립 근거**이지 인용 진위의 독립 근거가 아니다.

사용:
  packages/parser/.venv/bin/python3 docs/batch-load/stage2-source-quote/article_index.py
출력:
  article-index.json  (chapter → "제N조" → [본문 시작 페이지…])
  주소 대조 결과를 stdout 에 보고 (선언 ↔ 색인)
"""

import importlib.util
import json
import pathlib
import re
import sys

import pdfplumber

OUT = pathlib.Path(__file__).resolve().parent

_spec = importlib.util.spec_from_file_location("extractor", OUT / "extract_source_quotes.py")
assert _spec is not None and _spec.loader is not None
X = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(X)

# 조문 머리 — 반드시 **줄 머리 + 괄호 제목**. 본문 내부 참조("…제5조에 따라")를 배제한다.
HEAD_RE = re.compile(r"(?m)^\s*제\s*(\d+)\s*조(?:\s*의\s*(\d+))?\s*\(([^)]{1,40})\)")

# 목차(TOC) 배제 — 목차 줄은 조문 머리 뒤에 점선/쪽번호가 오고 본문이 이어지지 않는다.
MIN_BODY_CHARS = 60


def article_key(num: str, sub: str | None) -> str:
    return f"제{num}조" + (f"의{sub}" if sub else "")


# 목차에서 조문 머리 **다음 줄**에 올 수 있는 것들.
# ★`제N절/장/편` 을 빼먹었더니 LAW-165(제726조) 목차 줄이 통과해 색인이 **선언값과 같은 오답**을 냈다
#   (page 24 = `제726조(재보험에의 준용)⏎제6절 자동차보험`). 두 오라클이 같은 실수를 하면
#   "독립 확증"이 아니라 오류의 복사본이 되므로, 이 목록의 누락은 색인 전체를 무의미하게 만든다.
NEXT_HEAD_RE = re.compile(
    r"^\s*제\s*\d+\s*조(?:\s*의\s*\d+)?\s*\(" r"|^\s*제\s*\d+\s*[절장편]\s" r"|^\s*부\s*칙"
)


def build_index(pages: list[str]) -> dict[str, list[int]]:
    """페이지별로 훑어 '본문이 실제로 이어지는' 조문 머리만 색인한다.

    ★**목차 줄 배제가 이 함수의 전부다.** 상법 PDF 는 22~24쪽에 목차를 싣고 본문은 31~40쪽에 있다.
      머리만 세면 목차가 잡혀 **틀린 주소를 정답이라고 우긴다** — 실제로 첫 판본이 그랬고,
      노드 선언값(22·24)이 정확히 그 목차 페이지다. 색인이 선언값과 같은 실수를 하면
      "독립 주소원"이라는 이름만 붙은 **같은 오류의 복사본**이 된다.

    판별 근거(실측): 목차 줄은 닫는 괄호에서 **줄이 끝나고** 다음 줄이 또 조문 머리다 —
      `제642조(증권의 재교부청구)⏎제643조(소급보험)⏎…`
      본문은 같은 줄에 내용이 이어진다 —
      `제724조(보험자와 제3자와의 관계) ①보험자는 피보험자가 책임을 질 사고로 …`
    """
    index: dict[str, list[int]] = {}
    for page_no, text in enumerate(pages, start=1):
        lines = text.split("\n")
        # 줄 시작 오프셋 → 몇 번째 줄인지 역산용
        starts, acc = [], 0
        for ln in lines:
            starts.append(acc)
            acc += len(ln) + 1
        for m in HEAD_RE.finditer(text):
            li = max(i for i, s in enumerate(starts) if s <= m.start())
            same_line_rest = lines[li][m.end() - starts[li] :].strip()
            if len(same_line_rest) < 10:
                nxt = lines[li + 1].strip() if li + 1 < len(lines) else ""
                # 같은 줄이 비었고 다음 줄도 조문 머리 → 목차
                if NEXT_HEAD_RE.match(nxt) or nxt == "":
                    continue
                same_line_rest = nxt
            # 본문 분량 확인 (조문이 페이지 끝에 시작하면 다음 페이지까지 이어 본다)
            body = text[m.end() :]
            if len(body.strip()) < MIN_BODY_CHARS and page_no < len(pages):
                body = body + "\n" + pages[page_no]
            if len(body.strip()) < MIN_BODY_CHARS:
                continue
            # ★키에 **제목까지** 넣는다: 교재 합본 PDF 는 요령·운영규정·고시를 한 파일에 담고 있어
            #   `제7조` 가 문서마다 존재한다. 번호만으로 조회하면 후보가 여러 개 나와
            #   "불일치"인지 "다른 문서의 동번호"인지 구분할 수 없다(실측: LAW-189·199).
            index.setdefault(article_key(m.group(1), m.group(2)), []).append(
                {"page": page_no, "title": re.sub(r"\s+", "", m.group(3))}
            )
    return index


def main() -> int:
    nodes = json.loads((OUT / "node-inventory.json").read_text())
    index_by_chapter: dict[str, dict[str, list[int]]] = {}
    pages_cache: dict[str, list[str]] = {}

    for chapter, path in X.PDF_BY_CHAPTER.items():
        if not path.exists():
            continue
        key = str(path)
        if key not in pages_cache:
            with pdfplumber.open(path) as pdf:
                pages_cache[key] = [p.extract_text() or "" for p in pdf.pages]
        index_by_chapter[chapter] = build_index(pages_cache[key])

    (OUT / "article-index.json").write_text(
        json.dumps(index_by_chapter, ensure_ascii=False, indent=1)
    )

    agree, disagree, unknown = [], [], []
    for node in nodes:
        am = X.ARTICLE_RE.search(node["name"])
        if am is None:
            unknown.append((node["id"], node["name"], "조 번호 없음"))
            continue
        key = article_key(am.group(1), am.group(2))
        tm = X.TITLE_RE.search(node["name"])
        want_title = re.sub(r"\s+", "", tm.group(1)) if tm else None
        idx = index_by_chapter.get(node["chapter"], {})
        hits = idx.get(key, [])
        # 제목이 있으면 제목까지 일치하는 후보만 남긴다(합본 PDF 동번호 충돌 해소)
        if want_title:
            hits = [h for h in hits if h["title"] == want_title] or hits
        pages = [h["page"] for h in hits]
        declared = node["pdf_page"]
        if not pages:
            unknown.append((node["id"], node["name"], f"{key} 색인 미발견"))
        elif declared in pages:
            agree.append(node["id"])
        else:
            disagree.append((node["id"], node["name"], declared, pages))

    print(f"조문 head 색인 — 챕터 {len(index_by_chapter)} · 조문 키 {sum(len(v) for v in index_by_chapter.values())}")
    print(f"주소 대조: 일치 {len(agree)} · **불일치 {len(disagree)}** · 판정불가 {len(unknown)}")
    for i, name, d, p in disagree:
        print(f"  ✗ {i} {name[:38]:<38} 선언 {d} → 색인 {p}")
    for i, name, why in unknown:
        print(f"  ? {i} {name[:38]:<38} {why}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
