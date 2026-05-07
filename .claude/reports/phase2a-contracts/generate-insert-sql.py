#!/usr/bin/env python3
"""Phase 2A — Knowledge Contract JSON → table_* INSERT SQL 생성.

생성 대상: table_structures + table_headers + table_cells + table_node_links
주의:
- BEGIN/COMMIT 미포함 (TD-S49-1: wrangler d1 execute 가 자동 wrap).
- knowledge_nodes / formulas / constants INSERT 미포함 (이미 D1 적재).
- _meta 키는 contract 보존용, SQL 미반영.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
FILES = [
    'tbl-012-byeolpyo-2.json',
    'tbl-013-byeolpyo-5.json',
    'tbl-014-byeolpyo-6.json',
    'tbl-015-byeolpyo-7.json',
]


def sq(value):
    """SQLite single-quote escape — single quote는 두 개로."""
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def build_sql(contracts):
    lines = []
    lines.append('-- ============================================================')
    lines.append('-- Phase 2A 별표 2/5/6/7 적재 — TBL-012/013/014/015')
    lines.append('-- Session 055 (2026-05-08)')
    lines.append('-- 적재 단위: 4 TBL + 31 headers + 51 cells + 4 node_links = 90 INSERT rows')
    lines.append('-- 본 SQL은 staging+production 동시 적용 의무 (A2 schema drift CI 정합).')
    lines.append('-- BEGIN/COMMIT 미포함 — wrangler d1 execute 자동 wrap (TD-S49-1).')
    lines.append('-- ============================================================')
    lines.append('')

    for c in contracts:
        for table in c.get('tables', []):
            tid = table['id']
            lines.append(f'-- {tid} {table["title"]} (source: {table["source_node_id"]})')

            # 1. table_structures
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

            # 2. table_headers
            for h in table.get('headers', []):
                lines.append(
                    'INSERT INTO table_headers '
                    '(id, table_id, axis, level, index_pos, parent_id, text) '
                    'VALUES (' +
                    ', '.join([
                        sq(h['id']),
                        sq(tid),
                        sq(h['axis']),
                        sq(h.get('level', 1)),
                        sq(h['index_pos']),
                        sq(h.get('parent_id')),
                        sq(h['text']),
                    ]) + ');'
                )

            # 3. table_cells
            for cell in table.get('cells', []):
                lines.append(
                    'INSERT INTO table_cells '
                    '(id, table_id, row_id, col_id, value_text, value_type, '
                    'formula_id, merged_with_id, nested_table_id) '
                    'VALUES (' +
                    ', '.join([
                        sq(cell['id']),
                        sq(tid),
                        sq(cell['row_id']),
                        sq(cell['col_id']),
                        sq(cell.get('value_text')),
                        sq(cell['value_type']),
                        sq(cell.get('formula_id')),
                        sq(cell.get('merged_with_id')),
                        sq(cell.get('nested_table_id')),
                    ]) + ');'
                )

            # 4. table_node_links (extracted_from)
            lines.append(
                'INSERT INTO table_node_links (table_id, related_node_id, relation_type) '
                'VALUES (' +
                ', '.join([
                    sq(tid),
                    sq(table['source_node_id']),
                    sq('extracted_from'),
                ]) + ');'
            )

            lines.append('')

    return '\n'.join(lines) + '\n'


def main():
    contracts = []
    for f in FILES:
        with open(HERE / f) as fh:
            contracts.append(json.load(fh))

    sql = build_sql(contracts)
    out = HERE / 'phase2a-byeolpyo-inserts.sql'
    out.write_text(sql)
    print(f'wrote {out}')

    # 통계
    total_inserts = sql.count('INSERT INTO ')
    print(f'INSERT rows: {total_inserts}')
    print(f'  table_structures : {sql.count("INSERT INTO table_structures")}')
    print(f'  table_headers    : {sql.count("INSERT INTO table_headers")}')
    print(f'  table_cells      : {sql.count("INSERT INTO table_cells")}')
    print(f'  table_node_links : {sql.count("INSERT INTO table_node_links")}')


if __name__ == '__main__':
    main()
