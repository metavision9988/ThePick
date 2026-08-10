#!/usr/bin/env python3
"""STAGE 2 (2-4) — 추출 원문 → 백필 SQL + 검수 시트 생성 (결정론)."""
import json, pathlib, datetime

OUT = pathlib.Path(__file__).resolve().parent
q = json.loads((OUT / "source-quotes.json").read_text())

def esc(t: str) -> str:
    return t.replace("'", "''")

sql = [
    "-- STAGE 2 (2-4) 백필 — LAW-144~202 근거 원문 축자 (source_quote)",
    "-- 생성: docs/batch-load/stage2-source-quote/build_backfill.py (결정론 · LLM 생성 0)",
    "-- 추출: extract_source_quotes.py (pdfplumber) / 게이트: gate_check.py 위반 0 확인 후 생성",
    "-- 선결: migrations/0047 적용 (source_quote 컬럼 + NULL→값 1회 백필 화이트리스트)",
    "-- 적용: wrangler d1 execute <db> --file=<this> --remote",
    "--   ★ production 쓰기 = 진산 인증 게이트 (실행 세션 자율 금지)",
    "-- 멱등성: WHERE source_quote IS NULL — 재실행 시 0행 (0047 값→값 가드와도 충돌하지 않는다)",
    f"-- 대상 {len(q)}행",
    "",
]
for x in q:
    sql.append(
        f"UPDATE knowledge_nodes SET source_quote = '{esc(x['quote'])}' "
        f"WHERE id = '{x['id']}' AND source_quote IS NULL;"
    )
(OUT / "backfill-source-quote.sql").write_text("\n".join(sql) + "\n")

# ★검수 시트는 여기서 만들지 않는다 (2026-08-10 — 정본 이원화 금지).
#   구 `review-sheet.md` 는 **원문 머리 90자만** 보여줬고, 그 머리 편향이 LAW-183(꼬리 95%가
#   별표+부칙)과 LAW-178(머리는 정상, 인용 전체가 다른 문서)을 **둘 다 통과**시켰다.
#   검수 정본 = `audit_source_quotes.py` → `review-audit.md`
#   (머리+꼬리+축자 실재+조문 귀속+주소 정합+엔진 판정을 한 행에 놓는다).
(OUT / "review-sheet.md").write_text(
    "# ⛔ 이 파일은 폐기됐다 — 검수 정본은 `review-audit.md` 다\n\n"
    f"> 폐기 {datetime.date.today().isoformat()} · 사유: **머리 90자만 보여주는 검수표**였고,\n"
    "> 그 머리 편향으로 두 건을 통과시켰다 — LAW-183(꼬리 95%가 별표·부칙·푸터) ·\n"
    "> LAW-178(머리는 정상인데 인용 전체가 다른 문서에서 온 오귀속).\n"
    ">\n"
    "> **검수는 `review-audit.md` 로 한다** — 생성 `audit_source_quotes.py`.\n"
    "> A 축자 실재(PDF 전문 대조) · B 조문 귀속 · C 주소 정합(실측 페이지 병기) ·\n"
    "> D 꼬리 오염 · autoverify 엔진 판정을 **행당 한 줄**로 놓고, 머리와 꼬리를 함께 보여준다.\n"
)
print(f"SQL {len(q)}행 생성 · 검수 시트는 audit_source_quotes.py 소관(review-audit.md)")
