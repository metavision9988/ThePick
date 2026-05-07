#!/usr/bin/env python3
# json-to-sql-batch.py — Knowledge Graph JSON → D1 INSERT SQL 변환
#
# Usage:
#   python3 scripts/json-to-sql-batch.py \
#     --json docs/batch-load/batch-1-v2/batch-1-knowledge-graph.json \
#     --batch-id BATCH-1 \
#     --version-year 2025 \
#     --output docs/batch-load/batch-1-v2/batch-1-insert.sql

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def sql_escape(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    raise TypeError(f"unsupported sql value type: {type(value)}")


CONSTANTS_APPLIES_TO_OVERRIDES: dict[str, str] = {
    "CONST-001": "단감 인정피해율 산식 F-06 낙엽률 계수",
    "CONST-002": "단감 인정피해율 산식 F-06 경과일수 계수",
    "CONST-003": "떫은감 인정피해율 산식 F-07 낙엽률 계수",
    "CONST-004": "나무손해보험 산식 F-11 자기부담비율",
    "CONST-005": "일소피해 산식 F-13 자연낙과 한도 비율",
}


def to_numeric(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_node_inserts(nodes: list[dict[str, Any]], batch_id: str, version_year: int) -> list[str]:
    rows: list[str] = []
    for n in nodes:
        page_ref_text = f"p.{n['source_page']}"
        rows.append(
            "INSERT OR IGNORE INTO knowledge_nodes "
            "(id, type, name, description, lv1_insurance, lv2_crop, lv3_investigation, "
            "page_ref, book_page, pdf_page, chapter, section, batch_id, version_year, "
            "truth_weight, status) VALUES ("
            f"{sql_escape(n['id'])}, "
            f"{sql_escape(n['type'])}, "
            f"{sql_escape(n['title'])}, "
            f"{sql_escape(n.get('content'))}, "
            f"{sql_escape(n.get('lv1_insurance'))}, "
            f"{sql_escape(n.get('lv2_crop'))}, "
            f"{sql_escape(n.get('lv3_investigation'))}, "
            f"{sql_escape(page_ref_text)}, "
            f"{sql_escape(n['book_page'])}, "
            f"{sql_escape(n['pdf_page'])}, "
            f"{sql_escape(n.get('chapter'))}, "
            f"{sql_escape(n.get('section'))}, "
            f"{sql_escape(batch_id)}, "
            f"{version_year}, "
            f"{sql_escape(n['truth_weight'])}, "
            f"'draft'"
            ");"
        )
    return rows


def build_edge_inserts(edges: list[dict[str, Any]], batch_id: str) -> list[str]:
    rows: list[str] = []
    for idx, e in enumerate(edges, start=1):
        edge_id = f"EDGE-{batch_id}-{idx:04d}"
        rows.append(
            "INSERT OR IGNORE INTO knowledge_edges "
            "(id, from_node, to_node, edge_type, condition) VALUES ("
            f"{sql_escape(edge_id)}, "
            f"{sql_escape(e['source_id'])}, "
            f"{sql_escape(e['target_id'])}, "
            f"{sql_escape(e['edge_type'])}, "
            f"{sql_escape(e.get('condition'))}"
            ");"
        )
    return rows


def build_formula_inserts(formulas: list[dict[str, Any]], version_year: int) -> list[str]:
    rows: list[str] = []
    for f in formulas:
        page_ref_text = f"p.{f['source_page']}"
        rows.append(
            "INSERT OR IGNORE INTO formulas "
            "(id, name, equation_template, variables_schema, page_ref, node_id, version_year) VALUES ("
            f"{sql_escape(f['id'])}, "
            f"{sql_escape(f['name'])}, "
            f"{sql_escape(f['equation_template'])}, "
            f"{sql_escape(f['variables_schema'])}, "
            f"{sql_escape(page_ref_text)}, "
            f"{sql_escape(f['id'])}, "
            f"{version_year}"
            ");"
        )
    return rows


def build_constant_inserts(constants: list[dict[str, Any]], version_year: int) -> list[str]:
    rows: list[str] = []
    for c in constants:
        page_ref_text = f"p.{c['source_page']}"
        applies_to = CONSTANTS_APPLIES_TO_OVERRIDES.get(c["id"], c["name"])
        numeric_value = to_numeric(c["value"])
        rows.append(
            "INSERT OR IGNORE INTO constants "
            "(id, category, name, value, numeric_value, applies_to, "
            "page_ref, version_year) VALUES ("
            f"{sql_escape(c['id'])}, "
            f"{sql_escape(c['category'])}, "
            f"{sql_escape(c['name'])}, "
            f"{sql_escape(c['value'])}, "
            f"{sql_escape(numeric_value)}, "
            f"{sql_escape(applies_to)}, "
            f"{sql_escape(page_ref_text)}, "
            f"{version_year}"
            ");"
        )
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Knowledge Graph JSON → D1 INSERT SQL")
    parser.add_argument("--json", required=True, help="Knowledge Graph JSON 경로")
    parser.add_argument("--batch-id", required=True, help="BATCH ID (예: BATCH-1)")
    parser.add_argument("--version-year", type=int, default=2025, help="version_year (default: 2025)")
    parser.add_argument("--output", required=True, help="출력 SQL 경로")
    args = parser.parse_args()

    json_path = Path(args.json).resolve()
    if not json_path.is_file():
        print(f"[error] json not found: {json_path}", file=sys.stderr)
        return 1
    data = json.loads(json_path.read_text(encoding="utf-8"))

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    formulas = data.get("formulas", [])
    constants = data.get("constants", [])

    sql_lines: list[str] = []
    sql_lines.append(f"-- BATCH 적재 SQL — {args.batch_id} ({args.version_year})")
    sql_lines.append(f"-- 출처: {json_path.name}")
    sql_lines.append(f"-- 노드: {len(nodes)} / 엣지: {len(edges)} / 산식: {len(formulas)} / 상수: {len(constants)}")
    sql_lines.append("-- 적용: wrangler d1 execute <db-name> --file=<this-file> --remote")
    sql_lines.append("-- 사전 의무: migration 0019 production 적용 완료")
    sql_lines.append("-- 멱등성: INSERT OR IGNORE — 재실행 시 충돌 없음")
    sql_lines.append("--")
    sql_lines.append("-- AI 생성 데이터 (CLAUDE.md Hard Limit) — status='draft' 만 INSERT")
    sql_lines.append("-- 진산님 검수 후 status_transitions UPDATE 로 review/approved 전이")
    sql_lines.append("--")
    sql_lines.append("-- 주의: D1 wrangler execute --file 은 전체 파일을 자동 트랜잭션으로 감싼다.")
    sql_lines.append("-- 명시 BEGIN TRANSACTION/COMMIT 은 D1 거부 (Durable Object 충돌). 의도적으로 생략.")
    sql_lines.append("")

    sql_lines.append(f"-- 1. knowledge_nodes ({len(nodes)} rows)")
    sql_lines.extend(build_node_inserts(nodes, args.batch_id, args.version_year))
    sql_lines.append("")

    sql_lines.append(f"-- 2. formulas ({len(formulas)} rows, INSERT OR IGNORE — 기존 등록 row 보존)")
    sql_lines.extend(build_formula_inserts(formulas, args.version_year))
    sql_lines.append("")

    sql_lines.append(f"-- 3. constants ({len(constants)} rows, INSERT OR IGNORE)")
    sql_lines.extend(build_constant_inserts(constants, args.version_year))
    sql_lines.append("")

    sql_lines.append(f"-- 4. knowledge_edges ({len(edges)} rows) — nodes 적재 후")
    sql_lines.extend(build_edge_inserts(edges, args.batch_id))
    sql_lines.append("")


    sql_lines.append("-- 검증 SQL (적용 후 진산님 직접 확인):")
    sql_lines.append(f"-- SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='{args.batch_id}'; -- expect: {len(nodes)}")
    sql_lines.append(f"-- SELECT COUNT(*) FROM knowledge_edges WHERE id LIKE 'EDGE-{args.batch_id}-%'; -- expect: {len(edges)}")
    sql_lines.append(f"-- SELECT COUNT(*) FROM formulas WHERE id LIKE 'F-%'; -- expect: \\u003E= {len(formulas)} (기존 등록 합산)")

    out_path = Path(args.output).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(sql_lines) + "\n", encoding="utf-8")

    print(f"[ok] {len(nodes)} nodes + {len(edges)} edges + {len(formulas)} formulas + {len(constants)} constants → {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
