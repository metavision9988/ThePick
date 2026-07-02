#!/usr/bin/env python3
"""gap-P1-insert.sql 을 파싱해 batch-L1 형식 knowledge-graph.json 을 파생 생성.
   SQL 이 단일 진실원 — json 은 기계 파생이라 전사(轉寫) 드리프트 0 (G-GAP-6)."""
import json
import re
import sys

SQL = sys.argv[1]
OUT = sys.argv[2]

NODE_COLS = ['id', 'type', 'name', 'description', 'lv1_insurance', 'lv2_crop',
             'lv3_investigation', 'page_ref', 'book_page', 'pdf_page', 'chapter',
             'section', 'batch_id', 'version_year', 'truth_weight', 'status']
EDGE_COLS = ['id', 'from_node', 'to_node', 'edge_type', 'condition']


def parse_tuple(s):
    """VALUES(...) 내부 문자열 파싱 — 단일따옴표 문자열('' 이스케이프)·NULL·정수."""
    vals, i, n = [], 0, len(s)
    while i < n:
        while i < n and s[i] in ' \t':
            i += 1
        if i >= n:
            break
        if s[i] == "'":
            i += 1
            buf = []
            while i < n:
                if s[i] == "'" and i + 1 < n and s[i + 1] == "'":
                    buf.append("'")
                    i += 2
                elif s[i] == "'":
                    i += 1
                    break
                else:
                    buf.append(s[i])
                    i += 1
            vals.append(''.join(buf))
        else:
            j = i
            while j < n and s[j] != ',':
                j += 1
            tok = s[i:j].strip()
            vals.append(None if tok == 'NULL' else int(tok))
            i = j
        while i < n and s[i] in ' \t':
            i += 1
        if i < n and s[i] == ',':
            i += 1
    return vals


def extract(table):
    pat = re.compile(
        r"INSERT OR IGNORE INTO " + table + r"\s*\([^)]*\)\s*VALUES\s*\((.*)\);\s*$")
    rows = []
    for line in open(SQL, encoding='utf-8'):
        m = pat.match(line.strip())
        if m:
            rows.append(parse_tuple(m.group(1)))
    return rows


node_rows = extract('knowledge_nodes')
edge_rows = extract('knowledge_edges')

nodes = []
for r in node_rows:
    d = dict(zip(NODE_COLS, r))
    nodes.append({
        'id': d['id'], 'type': d['type'], 'title': d['name'], 'content': d['description'],
        'truth_weight': d['truth_weight'], 'source_page': d['pdf_page'],
        'book_page': d['book_page'], 'pdf_page': d['pdf_page'],
        'chapter': d['chapter'], 'section': d['section'],
    })

edges = []
for r in edge_rows:
    d = dict(zip(EDGE_COLS, r))
    edges.append({'source_id': d['from_node'], 'target_id': d['to_node'], 'edge_type': d['edge_type']})

out = {
    '_meta': {
        'batch_id': 'BATCH-GAP-P1',
        'description': 'E0-8 갭 보강 P1 — 법령 본체 조문 22 (법률 2·시행령 12·상법 8). draft-only.',
        'source_pdf_law': 'docs/manual/농어업재해보험법(법률)(제21065호)(20260102).pdf',
        'source_pdf_enforcement': 'docs/manual/농어업재해보험법 시행령(대통령령)(제35947호)(20260102).pdf',
        'source_pdf_sangbeop': 'docs/manual/상법(법률)(제21448호)(20260306).pdf',
        'target_source': 'E0-8 §2 A-3 큐레이션 대상 22(법률2·시행령12·상법8) = inventory L1·L2·L3 ❌ 조문 중 시험영역 직결분. inventory 전체 ❌ 93건(별표·부칙·삭제·시험 밖 상법 ~57 포함)의 부분집합 — 법령 갭 전부 폐쇄 아님.',
        'node_count': len(nodes),
        'edge_count': len(edges),
        'id_range': 'LAW-144~165',
        'status': 'draft',
        'ai_generated_by': 'Claude Opus 4.8 (1M) — E0-8 gap P1 실행 세션',
        'extracted_at': '2026-07-02',
        'approval': '진산 2026-07-02 파일럿 착수 + A안(법률 제8·11조 법령 원문 신규 + CROSS_REF)',
        'cross_ref_intent': 'LAW-144→LAW-001 / LAW-145→LAW-002·CONCEPT-137·INV-087 (교재 요약본·파생 연결)',
        'page_axis_note': '법률·시행령 = 실측 PDF 페이지 / 상법 = L2 bundle 내부축(통칙 22·책임보험 24)',
        'derivation': '본 json 은 gap-P1-insert.sql 을 build_gap_json.py 로 기계 파싱 파생 (전사 드리프트 0)',
    },
    'nodes': nodes,
    'edges': edges,
    'formulas': [],
    'constants': [],
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f'nodes={len(nodes)} edges={len(edges)} → {OUT}')
# 무결성 자체 검산
assert len(nodes) == 22, f'node count {len(nodes)} != 22'
assert len(edges) == 28, f'edge count {len(edges)} != 28'
ids = [n['id'] for n in nodes]
assert len(set(ids)) == 22, 'duplicate node id'
assert ids == [f'LAW-{i}' for i in range(144, 166)], f'id range mismatch: {ids}'
print('SELF-CHECK PASS: 22 nodes (LAW-144~165), 28 edges, no dup')
