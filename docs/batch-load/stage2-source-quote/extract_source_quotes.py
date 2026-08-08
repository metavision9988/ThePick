#!/usr/bin/env python3
"""
STAGE 2 (2-4) — LAW-144~202 (59장) 근거 원문 축자 추출.

★규약 (docs/plans/current.plan.md §설계 결정 ②, migrations/0047 헤더):
  · **결정론 추출만.** LLM 생성 0. 원문은 언제든 PDF 로 재현 가능해야 한다.
  · **description 복사 금지.** description 은 요약·편집본이라 복사하면 "원문 대조"가
    자기 자신 대조가 되어 STAGE 3 검사기가 항상 통과한다 → 동일성 검사로 fail-loud.
  · **조문 단위로 끊는다.** 전문을 통째로 넣으면 바이그램 풀이 포화해 접합 인용이
    coverage 1.0 으로 통과한다(catchall W1 실증) — 청크는 성능이 아니라 정확성 요건.
  · 매칭 실패는 **조용히 건너뛰지 않는다**. 미매칭 목록을 리포트에 남기고 exit 1.

사용:
  packages/parser/.venv/bin/python3 docs/batch-load/stage2-source-quote/extract_source_quotes.py
출력:
  source-quotes.json  (id → quote + 추출 근거)
  unmatched.json      (미매칭 — 있으면 exit 1)
"""

import json
import pathlib
import re
import sys

import pdfplumber

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).resolve().parent

# chapter → 원본 PDF. 교재 부록(요령·운영규정·목적물고시)은 이론서 PDF 안에 있다.
MANUAL = ROOT / "docs/manual/2026년 「농업재해보험·손해평가의 이론과 실무」 이론서_수정본(26.3.31.).pdf"
PDF_BY_CHAPTER = {
    "농어업재해보험법": ROOT / "docs/manual/농어업재해보험법(법률)(제21065호)(20260102).pdf",
    "농어업재해보험법 시행령": ROOT
    / "docs/manual/농어업재해보험법 시행령(대통령령)(제35947호)(20260102).pdf",
    "상법 제4편 보험": ROOT / "docs/manual/상법(법률)(제21448호)(20260306).pdf",
    "농업재해보험 손해평가요령": MANUAL,
    "재보험사업 및 농업재해보험사업의 운영 등에 관한 규정": MANUAL,
    "농업재해보험에서 보상하는 보험목적물의 범위": MANUAL,
}

# 노드 name 에서 조 번호 추출: "법 제8조 (보험사업자)" / "요령 제11조 (손해평가인 위촉)"
ARTICLE_RE = re.compile(r"제\s*(\d+)\s*조(?:\s*의\s*(\d+))?")
# 노드 name 끝 괄호 = 조문 제목
TITLE_RE = re.compile(r"\(([^)]+)\)\s*$")
# 페이지 텍스트에서 조문 시작 지점: "제8조(보험사업자)" · "제11조의2(손해평가사)"
def article_head_re(num: str, sub: str | None) -> re.Pattern[str]:
    body = rf"제\s*{num}\s*조"
    body += rf"\s*의\s*{sub}" if sub else r"(?!\s*의\s*\d)"
    return re.compile(body)


# 다음 조문(= 절단점).
# ★임의의 "제N조" 로 자르면 안 된다(실측 교훈): 조문 본문에는 **내부 참조**가 흔하다
#   ("…제5조에 따라 …"). 첫 판본이 그 참조에서 잘려 9~39자짜리 머리말만 남았고 게이트가
#   19건을 이렇게 잡아냈다. 실제 다음 조문은 **줄 머리에서 시작하고 곧바로 제목 괄호**가 온다.
NEXT_ARTICLE_RE = re.compile(
    # 다음 조문
    r"(?m)^\s*제\s*\d+\s*조(?:\s*의\s*\d+)?\s*\("
    # 또는 다음 절/장/편 헤더 — 독립 리뷰 MAJOR: LAW-165 말미에 '제6절 자동차보험' 이 혼입됐다.
    r"|^\s*제\s*\d+\s*[절장편]\s"
    # ★또는 **문서 경계** — 독립 리뷰 CRITICAL: 문서 **마지막 조문**은 다음 조 마커가 없어
    #   `rest` 를 통째로 삼켰다. LAW-183(요령 제17조)은 2,325자 중 **95%가 부칙 + [별표 1] 산식표
    #   전문 + 페이지 푸터**였다 — 0047 헤더가 스스로 금지한 "전문 투입 → 바이그램 포화" 그 자체.
    #   머리(조번호·제목)는 정상이라 게이트 5종·검수시트·e2e 가 **전부** 통과시켰다(머리 편향).
    r"|^\s*부\s*칙"
    r"|^\s*\[\s*별\s*표"
    r"|^\s*\d+\.\s+\S"          # 교재 부록 문서 번호 머리 ('5. 농업재해보험에서 보상하는 …')
    r"|^\s*-\s*\d+\s*-\s*$"      # 페이지 푸터 ('- 811 -')
)

# ★백필 제외 (독립 리뷰 MAJOR-3 처분) — 인용을 만들 수 있어도 **넣지 않는 것이 옳은** 경우.
#   0047 이 source_quote 를 NULL→값 1회로 고정하므로 잘못 넣으면 **영구히 못 고친다**.
#   "빈 칸"은 커버리지 지표가 미검증으로 세지만, "틀린 원문"은 STAGE 3 를 조용히 통과시킨다.
EXCLUSIONS = {
    "LAW-202": (
        "고시 본문의 실체는 **보험목적물 범위 표**인데 그 표가 적재돼 있지 않다"
        "(노드 description 자체가 'ESCALATE 규칙3, 표 셀 미적재'라고 적고 있다). "
        "추출 가능한 것은 머리말+재검토기한+부칙뿐이라, 넣으면 STAGE 3 앵커 충분성 검사가 "
        "대조할 실체 없이 통과한다. 표 적재 후 별도 백필."
    ),
}

PAGE_WINDOW = 2  # 조문이 페이지를 넘길 수 있으므로 뒤쪽 N페이지까지 이어 읽는다


def page_text(pdf: pdfplumber.PDF, page_no: int) -> str:
    if page_no < 1 or page_no > len(pdf.pages):
        return ""
    return pdf.pages[page_no - 1].extract_text() or ""


def normalize(text: str) -> str:
    """줄바꿈 하이픈·중복 공백 정리. 문자 자체는 바꾸지 않는다(축자 보존)."""
    text = text.replace("­", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def source_chunk(node: dict, cache: dict[str, pdfplumber.PDF]) -> str | None:
    """3-1/3-3 검사용 **출처 청크** — 인용과 **독립적으로** PDF 에서 뽑은 페이지 텍스트.

    ★왜 인용 자신을 쓰면 안 되나: 인용을 출처로 대조하면 커버리지가 항상 1.0 이 되어
      "인용이 원문에 실재하는가"라는 질문 자체가 사라진다(자기 대조).
    ★왜 전문이 아닌 페이지인가: 전문(1.2MB)을 넣으면 바이그램 풀이 포화해 임계 0.95 의
      변별력이 죽는다(catchall W1 실증). 페이지(~2천자)는 청크 규모다.
    """
    pdf_path = PDF_BY_CHAPTER.get(node["chapter"])
    if pdf_path is None or not pdf_path.exists():
        return None
    key = str(pdf_path)
    if key not in cache:
        cache[key] = pdfplumber.open(pdf_path)
    pdf = cache[key]
    # 조문이 페이지를 넘길 수 있으므로 기록 페이지 ±1 을 이어 붙인다(창은 유지, 전문은 아님).
    pages = [page_text(pdf, node["pdf_page"] + off) for off in (-1, 0, 1)]
    joined = normalize("\n".join(p for p in pages if p))
    return joined if joined else None


def extract(node: dict, cache: dict[str, pdfplumber.PDF]) -> tuple[str | None, str, str | None]:
    chapter = node["chapter"]
    pdf_path = PDF_BY_CHAPTER.get(chapter)
    if pdf_path is None:
        return None, f"chapter 미매핑: {chapter}", None
    if not pdf_path.exists():
        return None, f"PDF 부재: {pdf_path}", None
    key = str(pdf_path)
    if key not in cache:
        cache[key] = pdfplumber.open(pdf_path)
    pdf = cache[key]

    m = ARTICLE_RE.search(node["name"])
    if m is None:
        # 목적물고시처럼 조 번호가 없는 단일 문서 — 페이지 전문을 청크로 쓴다
        raw = page_text(pdf, node["pdf_page"])
        if not raw.strip():
            return None, "조 번호 없음 + 페이지 텍스트 비어 있음", None
        return normalize(raw), f"조 번호 없음 → 페이지 {node['pdf_page']} 전문", normalize(raw)

    num, sub = m.group(1), m.group(2)
    head = article_head_re(num, sub)
    tm = TITLE_RE.search(node["name"])
    title = tm.group(1).strip() if tm else None

    def candidates(text: str) -> list[tuple[int, str]]:
        """(본문 길이, 원문) 후보 전수.

        ★왜 '최장 본문'을 고르나 (실측 교훈): 법령 PDF 는 앞머리에 **목차**를 싣고
          "제6조(운영세칙) ······ 3" 같은 줄이 조문 head 정규식에 그대로 걸린다. 첫 매칭을
          취하면 목차 한 줄(20~40자)이 원문으로 저장된다 — 게이트가 29건을 이렇게 잡아냈다.
          조 번호+제목이 같은 후보들 중 **뒤따르는 본문이 가장 긴 것**이 실제 조문이다.
          (결정론적 — 길이 비교뿐, 추측 없음.)
        """
        out: list[tuple[int, str]] = []
        for hit in head.finditer(text):
            rest = text[hit.start() :]
            # 제목이 있으면 조 번호 **직후**에 그 제목이 와야 한다(다른 조문 오절단 차단)
            if title is not None:
                window = re.sub(r"\s+", "", rest[: len(title) + 40])
                if re.sub(r"\s+", "", title) not in window:
                    continue
            nxt = NEXT_ARTICLE_RE.search(rest, pos=hit.end() - hit.start())
            quote = normalize(rest[: nxt.start()] if nxt else rest)
            out.append((len(quote), quote))
        return out

    # 1차 — 기록된 페이지 주변 (±1 페이지 보정 + 뒤로 PAGE_WINDOW)
    start_page = node["pdf_page"]
    best: tuple[int, str] | None = None
    for offset in (0, -1, 1):
        base = start_page + offset
        joined = "\n".join(page_text(pdf, base + i) for i in range(PAGE_WINDOW + 1))
        for cand in candidates(joined):
            if best is None or cand[0] > best[0]:
                best = (cand[0], cand[1], joined)
    if best is not None and best[0] >= 60:
        return best[1], f"pdf_page {start_page}±1 (+{PAGE_WINDOW}) · 조번호+제목 매칭 · 최장 본문", best[2]

    # 2차 폴백 — 전 문서 스캔.
    # ★왜 필요한가(실측): P1 헤더가 자백했듯 **상법 노드의 pdf_page 는 실 PDF 축이 아니라
    #   "기존 L2 bundle 내부 페이지축"** 이다. 시행령 일부도 조문이 기록 페이지와 어긋나 있었다.
    #   조 번호+제목 조합은 한 법령 안에서 유일하므로 전 문서 스캔도 결정론적이다.
    #   교재 이론서(부록 합본)는 조 번호가 재사용되지만 **제목까지 일치**해야 하므로 안전하다.
    full = "\n".join(page_text(pdf, i + 1) for i in range(len(pdf.pages)))
    cands = candidates(full)
    if cands:
        top = max(cands, key=lambda c: c[0])
        if top[0] >= 60:
            # ★청크는 **인용을 실제로 찾은 위치**에서 뽑아야 한다(파일럿이 잡은 결함, 2026-08-08).
            #   기록 pdf_page 를 그대로 쓰면 상법처럼 페이지축이 틀린 노드에서 인용이 없는 페이지가
            #   청크로 나가 3-1 커버리지가 0.42 로 떨어졌다 — 카드가 아니라 검사 입력이 틀린 것이었다.
            idx = full.find(top[1][:40])
            region = full[max(0, idx - 1500) : idx + 3000] if idx >= 0 else full[:4000]
            return (
                top[1],
                f"전 문서 스캔 · 후보 {len(cands)}건 중 최장 본문 (기록 pdf_page {start_page} 미적중)",
                region,
            )
    if best is not None:
        return best[1], f"⚠️ 본문 60자 미만 — 검수 필요 (pdf_page {start_page})", best[2]
    return None, f"조문 head+제목 미발견 (제{num}조{'의' + sub if sub else ''} '{title}' @ pdf_page {start_page})", None


def main() -> int:
    nodes = json.loads((OUT / "node-inventory.json").read_text())
    cache: dict[str, pdfplumber.PDF] = {}
    quotes, unmatched = [], []
    excluded = []
    regions: dict[str, str] = {}
    for node in nodes:
        if node["id"] in EXCLUSIONS:
            excluded.append({**node, "reason": EXCLUSIONS[node["id"]]})
            continue
        quote, how, region = extract(node, cache)
        if quote is None:
            unmatched.append({**node, "reason": how})
        else:
            quotes.append({"id": node["id"], "name": node["name"], "quote": quote, "how": how})
            if region:
                regions[node["id"]] = region
    for pdf in cache.values():
        pdf.close()

    (OUT / "source-quotes.json").write_text(json.dumps(quotes, ensure_ascii=False, indent=1))
    (OUT / "unmatched.json").write_text(json.dumps(unmatched, ensure_ascii=False, indent=1))
    (OUT / "excluded.json").write_text(json.dumps(excluded, ensure_ascii=False, indent=1))
    # 3-1/3-3 검사용 출처 청크 — **인용을 실제로 찾은 텍스트 영역**(인용과 독립 추출).
    chunks = regions
    (OUT / "source-chunks.json").write_text(json.dumps(chunks, ensure_ascii=False, indent=1))
    print(f"출처 청크 {len(chunks)}/{len(nodes) - len(excluded)} (3-1·3-3 검사 입력)")
    print(f"추출 {len(quotes)}/{len(nodes)} · 미매칭 {len(unmatched)} · 의도적 제외 {len(excluded)}")
    for e in excluded:
        print(f"  ⊘ {e['id']} {e['name'][:40]} — {e['reason'][:60]}…")
    for u in unmatched:
        print(f"  ✗ {u['id']} {u['name'][:40]} — {u['reason']}")
    return 1 if unmatched else 0


if __name__ == "__main__":
    sys.exit(main())
