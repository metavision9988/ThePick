#!/usr/bin/env python3
"""별표 1 LAW-138 옵션 C (패턴-H nested) contract 생성.

PDF (book_page=684~687, pdf_page=691~694) 기반 정확 매트릭스.
부모 TBL-001 (15분류 row × 1 col) + 15 sub-tables (TBL-002~011 + TBL-016~020).

Sub-table TBL ID 체계:
  TBL-001: 부모 (H_nested)
  TBL-002~011: sub-tables 1~10 (10개)
  TBL-012~015: 이미 적재 (별표 2/5/6/7) — 충돌 회피
  TBL-016~020: sub-tables 11~15 (5개)
"""

import json
from pathlib import Path

LAW_ID = "LAW-138"
BOOK_PAGE = 684
PDF_PAGE = 691

# 부모 분류 라벨 (15 = 11 description 분류 → inner 분리 후 15)
PARENT_ROWS = [
    ("TBL-002", "사과/배/단감/떫은감/포도(농업수입안정 포함)/복숭아/자두/밤/호두/무화과/감귤(만감류)"),
    ("TBL-003", "유자"),
    ("TBL-004", "참다래/블루베리"),
    ("TBL-005", "매실/대추/살구"),
    ("TBL-006", "오미자"),
    ("TBL-007", "오디"),
    ("TBL-008", "복분자"),
    ("TBL-009", "감귤(온주밀감류)"),
    ("TBL-010", "벼/밀/보리/귀리"),
    ("TBL-011", "고구마/양파/마늘/옥수수/양배추/단호박 (수입보장 포함)"),
    ("TBL-016", "감자/차/콩/팥/수박/당근/생강/고랭지무/가을무(일반)/고랭지배추/가을배추 (수입보장 포함)"),
    ("TBL-017", "인삼"),
    ("TBL-018", "고추/메밀/브로콜리/배추(봄/고랭지/월동)/무/파/시금치/양상추"),
    ("TBL-019", "두릅"),
    ("TBL-020", "참깨/녹두"),
]

# Sub-table 매트릭스 정의 (id, title, col_left_label, col_right_label, rows[(left, right)])
SUB_TABLES = [
    # TBL-002 사과/배 등 (13 rows)
    ("TBL-002", "사과/배/단감 등 표본주수 표 (50주~1000주+ 13구간)", "조사대상주수", "표본주수", [
        ("50주 미만", "5"),
        ("50주 이상 100주 미만", "6"),
        ("100주 이상 150주 미만", "7"),
        ("150주 이상 200주 미만", "8"),
        ("200주 이상 300주 미만", "9"),
        ("300주 이상 400주 미만", "10"),
        ("400주 이상 500주 미만", "11"),
        ("500주 이상 600주 미만", "12"),
        ("600주 이상 700주 미만", "13"),
        ("700주 이상 800주 미만", "14"),
        ("800주 이상 900주 미만", "15"),
        ("900주 이상 1,000주 미만", "16"),
        ("1,000주 이상", "17"),
    ]),
    # TBL-003 유자 (6 rows)
    ("TBL-003", "유자 표본주수 표 (50주~800주+ 6구간)", "조사대상주수", "표본주수", [
        ("50주 미만", "5"),
        ("50주 이상 100주 미만", "6"),
        ("100주 이상 200주 미만", "7"),
        ("200주 이상 500주 미만", "8"),
        ("500주 이상 800주 미만", "9"),
        ("800주 이상", "10"),
    ]),
    # TBL-004 참다래/블루베리 (6 rows)
    ("TBL-004", "참다래/블루베리 표본주수 표 (50주~800주+ 6구간)", "조사대상주수", "표본주수", [
        ("50주 미만", "5"),
        ("50주 이상 100주 미만", "6"),
        ("100주 이상 200주 미만", "7"),
        ("200주 이상 500주 미만", "8"),
        ("500주 이상 800주 미만", "9"),
        ("800주 이상", "10"),
    ]),
    # TBL-005 매실/대추/살구 (5 rows)
    ("TBL-005", "매실/대추/살구 표본주수 표 (100주~1000주+ 5구간)", "조사대상주수", "표본주수", [
        ("100주 미만", "5"),
        ("100주 이상 300주 미만", "7"),
        ("300주 이상 500주 미만", "9"),
        ("500주 이상 1,000주 미만", "12"),
        ("1,000주 이상", "16"),
    ]),
    # TBL-006 오미자 (6 rows, 유인틀 길이 단위)
    ("TBL-006", "오미자 표본주수 표 (유인틀 길이 500m~6000m+ 6구간)", "조사대상 유인틀 길이", "표본주수", [
        ("500m 미만", "5"),
        ("500m 이상 1,000m 미만", "6"),
        ("1,000m 이상 2,000m 미만", "7"),
        ("2,000m 이상 4,000m 미만", "8"),
        ("4,000m 이상 6,000m 미만", "9"),
        ("6,000m 이상", "10"),
    ]),
    # TBL-007 오디 (8 rows)
    ("TBL-007", "오디 표본주수 표 (50주~600주+ 8구간)", "조사대상주수", "표본주수", [
        ("50주 미만", "6"),
        ("50주 이상 100주 미만", "7"),
        ("100주 이상 200주 미만", "8"),
        ("200주 이상 300주 미만", "9"),
        ("300주 이상 400주 미만", "10"),
        ("400주 이상 500주 미만", "11"),
        ("500주 이상 600주 미만", "12"),
        ("600주 이상", "13"),
    ]),
    # TBL-008 복분자 (6 rows, 가입포기수)
    ("TBL-008", "복분자 표본포기수 표 (1000~3000포기+ 6구간)", "가입포기수", "표본포기수", [
        ("1,000포기 미만", "8"),
        ("1,000포기 이상 1,500포기 미만", "9"),
        ("1,500포기 이상 2,000포기 미만", "10"),
        ("2,000포기 이상 2,500포기 미만", "11"),
        ("2,500포기 이상 3,000포기 미만", "12"),
        ("3,000포기 이상", "13"),
    ]),
    # TBL-009 감귤(온주밀감류) (3 rows, 가입면적)
    ("TBL-009", "감귤(온주밀감류) 표본주수 표 (5000~10000㎡+ 3구간)", "가입면적", "표본주수", [
        ("5,000㎡ 미만", "4"),
        ("5,000㎡ 이상 10,000㎡ 미만", "6"),
        ("10,000㎡ 이상", "8"),
    ]),
    # TBL-010 벼/밀/보리/귀리 (6 rows)
    ("TBL-010", "벼/밀/보리/귀리 표본구간수 표 (2000~6000㎡+ 6구간)", "조사대상면적", "표본구간", [
        ("2,000㎡ 미만", "3"),
        ("2,000㎡ 이상 3,000㎡ 미만", "4"),
        ("3,000㎡ 이상 4,000㎡ 미만", "5"),
        ("4,000㎡ 이상 5,000㎡ 미만", "6"),
        ("5,000㎡ 이상 6,000㎡ 미만", "7"),
        ("6,000㎡ 이상", "8"),
    ]),
    # TBL-011 고구마/양파/마늘/옥수수/양배추/단호박 (4 rows)
    ("TBL-011", "고구마/양파/마늘/옥수수/양배추/단호박 표본구간수 표 (1500~4500㎡+ 4구간)", "조사대상면적", "표본구간", [
        ("1,500㎡ 미만", "4"),
        ("1,500㎡ 이상 3,000㎡ 미만", "5"),
        ("3,000㎡ 이상 4,500㎡ 미만", "6"),
        ("4,500㎡ 이상", "7"),
    ]),
    # TBL-016 감자 등 (5 rows)
    ("TBL-016", "감자/차/콩/팥/수박/당근 등 표본구간수 표 (2500~10000㎡+ 5구간)", "조사대상면적", "표본구간", [
        ("2,500㎡ 미만", "4"),
        ("2,500㎡ 이상 5,000㎡ 미만", "5"),
        ("5,000㎡ 이상 7,500㎡ 미만", "6"),
        ("7,500㎡ 이상 10,000㎡ 미만", "7"),
        ("10,000㎡ 이상", "8"),
    ]),
    # TBL-017 인삼 (8 rows, 피해칸수)
    ("TBL-017", "인삼 표본칸수 표 (300~1800칸+ 8구간)", "피해칸수", "표본칸수", [
        ("300칸 미만", "3칸"),
        ("300칸 이상 500칸 미만", "4칸"),
        ("500칸 이상 700칸 미만", "5칸"),
        ("700칸 이상 900칸 미만", "6칸"),
        ("900칸 이상 1,200칸 미만", "7칸"),
        ("1,200칸 이상 1,500칸 미만", "8칸"),
        ("1,500칸 이상 1,800칸 미만", "9칸"),
        ("1,800칸 이상", "10칸"),
    ]),
    # TBL-018 고추 등 (4 rows, 피해면적)
    ("TBL-018", "고추/메밀/브로콜리/배추/무/파/시금치/양상추 표본구간(이랑)수 표 (3000~15000㎡+ 4구간)", "피해면적", "표본구간(이랑) 수", [
        ("3,000㎡ 미만", "4"),
        ("3,000㎡ 이상 7,000㎡ 미만", "6"),
        ("7,000㎡ 이상 15,000㎡ 미만", "8"),
        ("15,000㎡ 이상", "10"),
    ]),
    # TBL-019 두릅 (4 rows)
    ("TBL-019", "두릅 표본구간(이랑)수 표 (3000~15000㎡+ 4구간)", "조사대상면적", "표본구간(이랑) 수", [
        ("3,000㎡ 미만", "4"),
        ("3,000㎡ 이상 7,000㎡ 미만", "6"),
        ("7,000㎡ 이상 15,000㎡ 미만", "8"),
        ("15,000㎡ 이상", "10"),
    ]),
    # TBL-020 참깨/녹두 (5 rows)
    ("TBL-020", "참깨/녹두 표본구간수 표 (1000~10000㎡+ 5구간)", "조사대상면적", "표본구간", [
        ("1,000㎡ 미만", "3"),
        ("1,000㎡ 이상 2,500㎡ 미만", "4"),
        ("2,500㎡ 이상 5,000㎡ 미만", "5"),
        ("5,000㎡ 이상 7,500㎡ 미만", "6"),
        ("7,500㎡ 이상 10,000㎡ 미만", "7"),
        ("10,000㎡ 이상", "8"),
    ]),
]


def tbl_num(tbl_id):
    return tbl_id.split('-')[1]  # 'TBL-002' → '002'


def build_parent_table():
    parent_id = "TBL-001"
    headers = []
    cells = []
    parent_rows = PARENT_ROWS

    # row headers
    for i, (sub_id, label) in enumerate(parent_rows, start=1):
        headers.append({
            "id": f"TROW-001-{i:02d}",
            "axis": "row",
            "level": 1,
            "index_pos": i,
            "text": label,
        })
    # 1 col header
    headers.append({
        "id": "TCOL-001-01",
        "axis": "column",
        "level": 1,
        "index_pos": 1,
        "text": "표본주(구간)수 표",
    })
    # nested_table cells
    for i, (sub_id, label) in enumerate(parent_rows, start=1):
        cells.append({
            "id": f"TCELL-001-{i:02d}-01",
            "row_id": f"TROW-001-{i:02d}",
            "col_id": "TCOL-001-01",
            "value_text": f"→ {sub_id} ({label})",
            "value_type": "nested_table",
            "nested_table_id": sub_id,
        })

    return {
        "id": parent_id,
        "source_node_id": LAW_ID,
        "title": "농작물재해보험 품목별 표본주(구간)수 표 — 15 분류 nested 부모 (옵션 C 패턴-H)",
        "pattern_type": "H_nested",
        "row_count": len(parent_rows),
        "col_count": 1,
        "source": f"교재 별표1 / book_page={BOOK_PAGE} / pdf_page={PDF_PAGE} / LAW-138 PDF 정확 매트릭스",
        "book_page": BOOK_PAGE,
        "pdf_page": PDF_PAGE,
        "chapter": "별표",
        "section": "별표1",
        "headers": headers,
        "cells": cells,
    }


def build_sub_table(tbl_id, title, col_left, col_right, rows):
    num = tbl_num(tbl_id)
    headers = []
    cells = []

    for i, (left, right) in enumerate(rows, start=1):
        headers.append({
            "id": f"TROW-{num}-{i:02d}",
            "axis": "row",
            "level": 1,
            "index_pos": i,
            "text": left,  # 행 자체가 구간 레이블
        })

    headers.append({"id": f"TCOL-{num}-01", "axis": "column", "level": 1, "index_pos": 1, "text": col_left})
    headers.append({"id": f"TCOL-{num}-02", "axis": "column", "level": 1, "index_pos": 2, "text": col_right})

    for i, (left, right) in enumerate(rows, start=1):
        cells.append({
            "id": f"TCELL-{num}-{i:02d}-01",
            "row_id": f"TROW-{num}-{i:02d}",
            "col_id": f"TCOL-{num}-01",
            "value_text": left,
            "value_type": "text",
        })
        cells.append({
            "id": f"TCELL-{num}-{i:02d}-02",
            "row_id": f"TROW-{num}-{i:02d}",
            "col_id": f"TCOL-{num}-02",
            "value_text": right,
            "value_type": "text",
        })

    return {
        "id": tbl_id,
        "source_node_id": LAW_ID,
        "title": title,
        "pattern_type": "A_simple",
        "row_count": len(rows),
        "col_count": 2,
        "source": f"교재 별표1 / book_page={BOOK_PAGE} / pdf_page={PDF_PAGE} / LAW-138 PDF 정확 매트릭스 — sub-table",
        "book_page": BOOK_PAGE,
        "pdf_page": PDF_PAGE,
        "chapter": "별표",
        "section": "별표1",
        "headers": headers,
        "cells": cells,
    }


def main():
    parent = build_parent_table()
    subs = [build_sub_table(*t) for t in SUB_TABLES]

    contract = {
        "_meta": {
            "comment": "별표 1 LAW-138 — TBL-001 부모 (H_nested 15 분류) + 15 sub-tables (TBL-002~011 + TBL-016~020). PDF 정확 매트릭스 기반.",
            "session": "055",
            "created_at": "2026-05-08",
            "validate_only": "INSERT 시 nodes/edges/formulas/constants는 SKIP. tables[]만 INSERT.",
        },
        "nodes": [],
        "edges": [],
        "formulas": [],
        "constants": [],
        "tables": [parent] + subs,
    }

    out = Path(__file__).parent / "tbl-001-byeolpyo-1.json"
    out.write_text(json.dumps(contract, ensure_ascii=False, indent=2))
    print(f"wrote {out}")

    # 통계
    total_tables = len(contract["tables"])
    total_headers = sum(len(t["headers"]) for t in contract["tables"])
    total_cells = sum(len(t["cells"]) for t in contract["tables"])
    print(f"tables  : {total_tables}")
    print(f"headers : {total_headers}")
    print(f"cells   : {total_cells}")
    print(f"node_links (extracted_from) : {total_tables}")
    print(f"sum     : {total_tables + total_headers + total_cells} cell-level + {total_tables} links = {total_tables + total_headers + total_cells + total_tables}")


if __name__ == "__main__":
    main()
