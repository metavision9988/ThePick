#!/usr/bin/env python3
"""
STAGE 2 (2-4) — LAW-144~202 (59장) 근거 원문 축자 추출.

★규약 (docs/plans/current.plan.md §설계 결정 ②, migrations/0047 헤더):
  · **결정론 추출만.** LLM 생성 0. 원문은 언제든 PDF 로 재현 가능해야 한다.
  · **description 복사 금지.** description 은 요약·편집본이라 복사하면 "원문 대조"가
    자기 자신 대조가 되어 STAGE 3 검사기가 항상 통과한다 → 동일성 검사로 fail-loud.
  · **인용은 조문 단위로 끊는다.** 전문을 통째로 넣으면 바이그램 풀이 포화해 접합 인용이
    coverage 1.0 으로 통과한다(catchall W1 실증) — 청크는 성능이 아니라 정확성 요건.
    ★단, **출처 청크(`source_chunk`)는 조문 단위가 아니라 페이지 창**이다(2026-08-10 개정).
    조문 단위로 뜨려면 인용을 찾은 위치를 써야 하는데 그러면 3-1 이 항등식이 되기 때문이다.
    그 대가로 청크에 이웃 조문이 섞이고 **3-1·3-3 이 노드 귀속을 증거하지 못한다**(실측 48/58).
    ⇒ 검수 UI 에서 3-1·3-3 의 pass 를 "이 조문에서 왔다"로 표시하지 말 것.
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
    # 또는 **삭제된 조문**('제7조 삭제') — 괄호 제목이 없어 위 패턴에 안 걸린다.
    #   실측(2026-08-10): LAW-172(요령 제6조)가 뒤따르는 '제7조 삭제' 한 줄을 삼켰다.
    r"|^\s*제\s*\d+\s*조(?:\s*의\s*\d+)?\s*삭\s*제\s*$"
    # 또는 다음 절/장/편 헤더 — 독립 리뷰 MAJOR: LAW-165 말미에 '제6절 자동차보험' 이 혼입됐다.
    r"|^\s*제\s*\d+\s*[절장편]\s"
    # ★또는 **문서 경계** — 독립 리뷰 CRITICAL: 문서 **마지막 조문**은 다음 조 마커가 없어
    #   `rest` 를 통째로 삼켰다. LAW-183(요령 제17조)은 2,325자 중 **95%가 부칙 + [별표 1] 산식표
    #   전문 + 페이지 푸터**였다 — 0047 헤더가 스스로 금지한 "전문 투입 → 바이그램 포화" 그 자체.
    #   머리(조번호·제목)는 정상이라 게이트 5종·검수시트·e2e 가 **전부** 통과시켰다(머리 편향).
    r"|^\s*부\s*칙"
    r"|^\s*\[\s*별\s*표"
    # ⛔ 삭제된 경계: `^\s*\d+\.\s+\S` (교재 부록 문서 번호 머리 '5. 농업재해보험에서 보상하는 …')
    #   ★독립 리뷰 CRITICAL(2026-08-10): 이 패턴이 **조문 안의 호 열거를 조문 경계로 오인**했다.
    #   법령 조문은 "① … 다음 각 호와 같다. / 1. 농작물 : 농지별 / 2. 가축 : …" 형태가 표준이라
    #   거의 모든 조문이 첫 호에서 잘렸다. 실측: 요령 제12조가 **43자**로 절단 → 60자 하한 미달 →
    #   전 문서 스캔 폴백 → 교재 본문 서술 조각(101자)이 조문으로 **오귀속**돼 백필 SQL 에 실렸다.
    #   같은 기전이 08-08 리뷰가 "진짜 성과"로 꼽은 **인용 절단 8건의 단일 근본원인**이었다
    #   (LAW-145·148·162·172·173·179·195·198 — 응시수수료·기간 등 상수 클래스 포함).
    #   문서 경계는 아래 부칙·별표·푸터·다음 조문으로 이미 덮이며, 과대 포획은 G-S2-7f(꼬리 오염)가 잡는다.
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
SEARCH_OFFSETS = (0, -1, 1)  # 1차 탐색 기준 페이지 보정

# ★출처 청크 창 = **인용 1차 탐색이 실제로 훑는 범위와 동일**하게 파생한다 (독립 리뷰 L-m1 처분).
#   손으로 `(-1, 2)` 라고 적어 두었더니 탐색 범위 `[-1, +3]` 보다 **좁아져** 있었다.
#   그 비대칭은 조용한 오보 장치다 — 조문이 `+3` 페이지로 넘어가면 **선언 주소가 옳은데도**
#   3-1/3-3 이 실패하고, `lcs.ts` 가 못박은 규칙("실패가 늘면 임계가 아니라 인용·주소를 고쳐라")이
#   **정확한 pdf_page 를 고치도록 사람을 유도**한다. 현 코퍼스에서 미발현이었을 뿐이다.
#   ⇒ 두 상수를 **결합해 파생**시켜 드리프트를 원천 차단하고, 아래에서 기계로 재확인한다.
#
#   ★"창을 넓혀 green 을 만든 것"이 아님을 못박는다: 넓힌 뒤 실패 건수는 **변하지 않았다**
#   (독립 리뷰 실측 스윕 `-1,1`~`-5,5` 전 구간 동일). 3-1 이 이 코퍼스에서 재는 것은
#   애초에 **주소 정합**이고, 적중분의 포함 관계는 창과 무관하게 구조적이다(리뷰 C-3).
CHUNK_WINDOW = (min(SEARCH_OFFSETS), max(SEARCH_OFFSETS) + PAGE_WINDOW)
assert CHUNK_WINDOW == (-1, 3), f"창 파생이 깨졌다: {CHUNK_WINDOW}"


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

    ★독립성의 정의 (2026-08-10 재정의 — STAGE 3 독립 리뷰 §1 처분):
      청크의 주소는 **노드가 스스로 선언한 좌표**(`chapter` + `pdf_page`)뿐이다.
      인용 문자열도, 인용을 찾아낸 위치도 입력으로 쓰지 않는다.

      직전 판본은 `full.find(quote[:40])` 로 **인용을 찾은 자리**에서 청크를 떴다.
      그러면 `quote ⊆ chunk` 가 **수학적 항등식**이 되어 3-1 커버리지·3-3 LCS 가
      항상 1.0 이다 — 임계를 1.0 으로 올려도 전건 통과한다(측정이 아니라 자기충족).
      그 결과 실제로 "58/58 통과 = 백필 원문 독립 확증"이라는 **없는 증거**를 원장에 남겼고,
      직전 판본이 내던 9건(상법 페이지축 오류)이라는 **진짜 발견을 0으로 지웠다**.

    ★이 코퍼스에서 3-1/3-3 이 실제로 측정하는 것 = **주소 정합**이다.
      STAGE 2 인용은 결정론 PDF 추출물이라 정의상 원본 어딘가에 실재한다. 따라서
      "지어낸 인용인가"는 이 표본에서 **측정 불가**이고(=위조 검출력은 AI 저작 인용
      코퍼스에서 비로소 측정된다), 여기서 답할 수 있는 질문은
      **"인용이 노드가 선언한 그 페이지에 실제로 있는가"** 다. 실패 = 주소 드리프트 발견.

    ★왜 전문이 아닌 페이지 창인가: 전문(1.2MB)을 넣으면 바이그램 풀이 포화해 임계 0.95 의
      변별력이 죽는다(catchall W1 실증). 창(median ~5천자)은 그보다 두 자릿수 작다.
    ⚠️ **한계 (독립 리뷰 M-8)**: 페이지 창이라 **이웃 조문이 함께 들어온다** — 실측 48/58 인용이
      다른 노드의 청크에도 통짜로 적중한다. ⇒ 3-1·3-3 의 pass 는 "인용이 이 근방에 실재한다"까지고
      **"이 노드의 조문에서 왔다"를 증거하지 않는다.**
    ✅ **창 비대칭 해소 (독립 리뷰 L-m1 처분)**: 창은 이제 인용 1차 탐색 범위에서 **파생**된다
      (`CHUNK_WINDOW = [min(SEARCH_OFFSETS), max(SEARCH_OFFSETS) + PAGE_WINDOW]`).
      손으로 적어 두었을 때 `−1..+2` 로 탐색 범위 `−1..+3` 보다 좁아 **정상 주소를 드리프트로
      오보할 수 있었다**(현 코퍼스 미발현). 두 상수는 이제 함께 움직인다.
    """
    pdf_path = PDF_BY_CHAPTER.get(node["chapter"])
    if pdf_path is None or not pdf_path.exists():
        return None
    key = str(pdf_path)
    if key not in cache:
        cache[key] = pdfplumber.open(pdf_path)
    pdf = cache[key]
    lo, hi = CHUNK_WINDOW
    pages = [page_text(pdf, node["pdf_page"] + off) for off in range(lo, hi + 1)]
    joined = normalize("\n".join(p for p in pages if p))
    return joined if joined else None


def extract(node: dict, cache: dict[str, pdfplumber.PDF]) -> tuple[str | None, str, bool]:
    """인용(축자 원문) 추출. ★출처 청크는 여기서 만들지 않는다 — `source_chunk()` 전담.

    두 산출물의 경로를 분리해 두는 것이 3-1/3-3 이 측정으로 남는 유일한 조건이다.
    (한 함수가 둘 다 만들면 "인용을 찾은 자리"가 청크로 새어 나가 자기충족이 재발한다.)
    """
    chapter = node["chapter"]
    pdf_path = PDF_BY_CHAPTER.get(chapter)
    if pdf_path is None:
        return None, f"chapter 미매핑: {chapter}", False
    if not pdf_path.exists():
        return None, f"PDF 부재: {pdf_path}", False
    key = str(pdf_path)
    if key not in cache:
        cache[key] = pdfplumber.open(pdf_path)
    pdf = cache[key]

    m = ARTICLE_RE.search(node["name"])
    if m is None:
        # 목적물고시처럼 조 번호가 없는 단일 문서 — 페이지 전문을 청크로 쓴다
        raw = page_text(pdf, node["pdf_page"])
        if not raw.strip():
            return None, "조 번호 없음 + 페이지 텍스트 비어 있음", False
        return normalize(raw), f"조 번호 없음 → 페이지 {node['pdf_page']} 전문", True

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
        # ★조문 헤드는 `제N조(제목)` **괄호형**이어야 한다 (독립 리뷰 CRITICAL 처분, 2026-08-10).
        #   구 판본은 "조 번호 뒤 40자 창 안에 제목 문자열이 있으면" 통과였는데, 그 느슨함이
        #   **본문 서술문을 조문으로 오인**시켰다. 실측: 교재 본문의 "제12조의 손해평가 / 단위별로
        #   현지조사를 실시한다…" 가 (a) `제12조` 매칭 + (b) 창 안에 '손해평가단위' 포함 → 통과했고,
        #   진짜 조문이 절단돼 짧아진 탓에 `max(len)` 이 이 서술문을 골라 백필 SQL 에 실었다.
        #   조문 원문은 예외 없이 `제N조(제목)` 로 시작하므로, 그 형태를 강제하면 서술문은 배제된다.
        want = f"제{num}조" + (f"의{sub}" if sub else "") + (
            "(" + re.sub(r"\s+", "", title) if title is not None else ""
        )
        out: list[tuple[int, str]] = []
        for hit in head.finditer(text):
            rest = text[hit.start() :]
            if title is not None:
                head_window = re.sub(r"\s+", "", rest[: len(want) + 20])
                if not head_window.startswith(want):
                    continue
            nxt = NEXT_ARTICLE_RE.search(rest, pos=hit.end() - hit.start())
            quote = normalize(rest[: nxt.start()] if nxt else rest)
            out.append((len(quote), quote))
        return out

    # 1차 — 기록된 페이지 주변 (±1 페이지 보정 + 뒤로 PAGE_WINDOW)
    start_page = node["pdf_page"]
    best: tuple[int, str] | None = None
    for offset in SEARCH_OFFSETS:
        base = start_page + offset
        joined = "\n".join(page_text(pdf, base + i) for i in range(PAGE_WINDOW + 1))
        for cand in candidates(joined):
            if best is None or cand[0] > best[0]:
                best = cand
    if best is not None and best[0] >= 60:
        return best[1], f"pdf_page {start_page}±1 (+{PAGE_WINDOW}) · 조번호+제목 매칭 · 최장 본문", True

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
            # ★2026-08-08 판본은 여기서 `full.find(quote[:40])` 로 **인용을 찾은 자리**를 청크로 돌려줬다.
            #   그 한 줄이 3-1·3-3 을 항등식으로 만들었다(위 source_chunk 독립성 주석 참조).
            #   지금은 청크를 만들지 않는다 — 이 경로로 온 노드는 **기록 pdf_page 미적중**,
            #   즉 주소 드리프트가 실재한다는 뜻이고, 3-1/3-3 이 그걸 잡아내는 것이 정상 동작이다.
            return (
                top[1],
                f"전 문서 스캔 · 후보 {len(cands)}건 중 최장 본문 (기록 pdf_page {start_page} 미적중)",
                False,  # ★주소 미적중 = 선언 pdf_page 로 조문을 찾지 못했다
            )
    if best is not None:
        return best[1], f"⚠️ 본문 60자 미만 — 검수 필요 (pdf_page {start_page})", True
    return (
        None,
        f"조문 head+제목 미발견 (제{num}조{'의' + sub if sub else ''} '{title}' @ pdf_page {start_page})",
        False,
    )


def main() -> int:
    nodes = json.loads((OUT / "node-inventory.json").read_text())
    cache: dict[str, pdfplumber.PDF] = {}
    quotes, unmatched = [], []
    excluded = []
    chunks: dict[str, str] = {}
    chunkless: list[dict] = []
    for node in nodes:
        if node["id"] in EXCLUSIONS:
            excluded.append({**node, "reason": EXCLUSIONS[node["id"]]})
            continue
        quote, how, address_hit = extract(node, cache)
        if quote is None:
            unmatched.append({**node, "reason": how})
        else:
            quotes.append(
                {
                    "id": node["id"],
                    "name": node["name"],
                    "quote": quote,
                    "how": how,
                    # ★명시 계약 (독립 리뷰 L-m5 처분) — 소비자(러너)가 `how` 문자열을
                    #   `includes('전 문서 스캔')` 로 파싱하던 **암묵 계약**을 필드로 승격한다.
                    #   문구를 다듬으면 소비자의 주소-미적중 집합이 조용히 빈 집합이 됐다.
                    "address_hit": address_hit,
                }
            )
        # ★청크는 인용 성패와 **무관하게** 선언 주소에서 뽑는다 — 인용 경로와 교차하지 않는다.
        chunk = source_chunk(node, cache)
        if chunk:
            chunks[node["id"]] = chunk
        else:
            # ★fail-loud (독립 리뷰 L-m3) — 청크 결손을 카운트만 줄이고 넘어가면
            #   3-1/3-3 이 조용히 판정 불가로 빠지고 아무도 모른다.
            chunkless.append({"id": node["id"], "name": node["name"], "pdf_page": node["pdf_page"]})
    for pdf in cache.values():
        pdf.close()

    (OUT / "source-quotes.json").write_text(json.dumps(quotes, ensure_ascii=False, indent=1))
    (OUT / "unmatched.json").write_text(json.dumps(unmatched, ensure_ascii=False, indent=1))
    (OUT / "excluded.json").write_text(json.dumps(excluded, ensure_ascii=False, indent=1))
    # 3-1/3-3 검사용 출처 청크 — **노드가 선언한 주소**(chapter + pdf_page±창)에서만 뽑는다.
    (OUT / "source-chunks.json").write_text(json.dumps(chunks, ensure_ascii=False, indent=1))
    lo, hi = CHUNK_WINDOW
    # ★분모는 "제외 안 된 노드"가 아니라 **인용이 만들어진 노드**여야 한다 (독립 리뷰 L-m2).
    #   두 집합이 갈리면(미매칭 발생 시) 지표가 조용히 어긋난다.
    quoted_ids = {q["id"] for q in quotes}
    chunk_for_quoted = sum(1 for i in quoted_ids if i in chunks)
    print(
        f"출처 청크 {chunk_for_quoted}/{len(quoted_ids)} (인용 보유 노드 기준) "
        f"· 전체 생성 {len(chunks)} · 선언 주소 pdf_page{lo:+d}..{hi:+d} · 인용과 독립"
    )
    miss = sum(1 for q in quotes if not q["address_hit"])
    print(f"주소 적중 {len(quotes) - miss}/{len(quotes)} · 미적중 {miss} (전 문서 스캔으로 회수)")
    print(f"추출 {len(quotes)}/{len(nodes)} · 미매칭 {len(unmatched)} · 의도적 제외 {len(excluded)}")
    for e in excluded:
        print(f"  ⊘ {e['id']} {e['name'][:40]} — {e['reason'][:60]}…")
    for c in chunkless:
        print(f"  ⚠ 청크 결손 {c['id']} {c['name'][:40]} @ pdf_page {c['pdf_page']}")
    for u in unmatched:
        print(f"  ✗ {u['id']} {u['name'][:40]} — {u['reason']}")
    # 청크 결손은 3-1/3-3 을 판정 불가로 만든다 = 조용한 커버리지 손실 → 미매칭과 동급으로 실패시킨다.
    return 1 if (unmatched or chunkless) else 0


if __name__ == "__main__":
    sys.exit(main())
