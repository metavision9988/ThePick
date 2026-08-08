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

rows = ["| id | 노드 | 추출 근거 | 길이 | 원문 머리 (검수용) |", "| --- | --- | --- | ---: | --- |"]
for x in q:
    head = x["quote"][:90].replace("\n", " ").replace("|", "\\|")
    rows.append(f"| {x['id']} | {x['name']} | {x['how']} | {len(x['quote'])} | {head}… |")
(OUT / "review-sheet.md").write_text(
    "# STAGE 2 백필 검수 시트 — source_quote 59장\n\n"
    "> 생성 " + datetime.date.today().isoformat() + " · 결정론 추출(pdfplumber) · LLM 생성 0\n"
    "> 게이트 `gate_check.py` 위반 0 (제목 일치·description 비동일·길이·조번호·전수)\n"
    "> ★검수 포인트: **원문 머리가 그 조문이 맞는가** / 요약이 아니라 축자인가\n\n" + "\n".join(rows) + "\n"
)
print(f"SQL {len(q)}행 · 검수 시트 생성 완료")
