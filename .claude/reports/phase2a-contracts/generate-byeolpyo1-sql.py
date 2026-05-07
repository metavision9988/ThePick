#!/usr/bin/env python3
"""별표 1 LAW-138 옵션 C contract → INSERT SQL.

순서: 부모 TBL-001 먼저 → sub-tables → headers/cells/links 순.
주의: nested_table_id FK 정합 — sub-tables 가 먼저 INSERT 되어야 부모 cell의 FK 정합 (또는 deferrable).
SQLite는 FK 즉시 검사가 default — 본 SQL은 부모 cells 가 sub-tables 보다 먼저 INSERT 되면 FK 위반.
→ 순서: 16 table_structures 먼저 (부모 + 15 sub-tables) → 모든 headers → 모든 cells → links.
   table_structures 16건이 모두 적재된 후 cells 의 nested_table_id FK 정합.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
CONTRACT_FILE = HERE / "tbl-001-byeolpyo-1.json"


def sq(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main():
    with open(CONTRACT_FILE) as f:
        contract = json.load(f)

    tables = contract['tables']
    lines = []
    lines.append('-- ============================================================')
    lines.append('-- Phase 2A 별표 1 LAW-138 적재 — TBL-001 부모 (H_nested) + 15 sub-tables')
    lines.append('-- Session 055 후속 (2026-05-08)')
    lines.append(f'-- 적재 단위: {len(tables)} tables + 모든 headers + 모든 cells + {len(tables)} node_links')
    lines.append('-- 순서: ① 16 table_structures → ② 모든 headers → ③ 모든 cells (nested_table FK 정합) → ④ node_links')
    lines.append('-- BEGIN/COMMIT 미포함 — wrangler d1 execute 자동 wrap (TD-S49-1).')
    lines.append('-- ============================================================')
    lines.append('')

    # ① table_structures (16건) — 부모 먼저, sub-tables 후속
    lines.append('-- ① table_structures (16 rows)')
    for table in tables:
        lines.append(
            'INSERT INTO table_structures '
            '(id, source_node_id, title, pattern_type, row_count, col_count, source, status) '
            'VALUES (' +
            ', '.join([
                sq(table['id']),
                sq(table['source_node_id']),
                sq(table['title']),
                sq(table['pattern_type']),
                sq(table['row_count']),
                sq(table['col_count']),
                sq(table['source']),
                sq('draft'),
            ]) + ');'
        )
    lines.append('')

    # ② table_headers (모든 부모/sub-table headers)
    total_headers = sum(len(t['headers']) for t in tables)
    lines.append(f'-- ② table_headers ({total_headers} rows)')
    for table in tables:
        for h in table['headers']:
            lines.append(
                'INSERT INTO table_headers '
                '(id, table_id, axis, level, index_pos, parent_id, text) '
                'VALUES (' +
                ', '.join([
                    sq(h['id']),
                    sq(table['id']),
                    sq(h['axis']),
                    sq(h.get('level', 1)),
                    sq(h['index_pos']),
                    sq(h.get('parent_id')),
                    sq(h['text']),
                ]) + ');'
            )
    lines.append('')

    # ③ table_cells (nested_table_id FK 정합 — sub-tables 가 ①에서 모두 INSERT 됨)
    total_cells = sum(len(t['cells']) for t in tables)
    lines.append(f'-- ③ table_cells ({total_cells} rows, nested_table FK 정합)')
    for table in tables:
        for cell in table['cells']:
            lines.append(
                'INSERT INTO table_cells '
                '(id, table_id, row_id, col_id, value_text, value_type, '
                'formula_id, merged_with_id, nested_table_id) '
                'VALUES (' +
                ', '.join([
                    sq(cell['id']),
                    sq(table['id']),
                    sq(cell['row_id']),
                    sq(cell['col_id']),
                    sq(cell.get('value_text')),
                    sq(cell['value_type']),
                    sq(cell.get('formula_id')),
                    sq(cell.get('merged_with_id')),
                    sq(cell.get('nested_table_id')),
                ]) + ');'
            )
    lines.append('')

    # ④ table_node_links (16 extracted_from)
    lines.append(f'-- ④ table_node_links ({len(tables)} rows, extracted_from)')
    for table in tables:
        lines.append(
            'INSERT INTO table_node_links (table_id, related_node_id, relation_type) '
            'VALUES (' +
            ', '.join([
                sq(table['id']),
                sq(table['source_node_id']),
                sq('extracted_from'),
            ]) + ');'
        )

    sql = '\n'.join(lines) + '\n'
    out = HERE / 'phase2a-byeolpyo1-inserts.sql'
    out.write_text(sql)
    print(f'wrote {out}')

    inserts = sql.count('INSERT INTO ')
    print(f'INSERT rows: {inserts}')
    print(f'  table_structures : {sql.count("INSERT INTO table_structures")}')
    print(f'  table_headers    : {sql.count("INSERT INTO table_headers")}')
    print(f'  table_cells      : {sql.count("INSERT INTO table_cells")}')
    print(f'  table_node_links : {sql.count("INSERT INTO table_node_links")}')


if __name__ == '__main__':
    main()
