#!/usr/bin/env python3
"""gap-P2-insert.sql 을 파싱해 batch-L1 형식 knowledge-graph.json 을 파생 생성.
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
        'batch_id': 'BATCH-GAP-P2',
        'description': 'E0-8 갭 보강 P2 — 부록 요령 전문 18조 + 운영규정 18조 + 목적물고시 1 (draft-only).',
        'source_pdf': 'docs/manual/2026년 「농업재해보험·손해평가의 이론과 실무」 이론서_수정본(26.3.31.).pdf',
        'source_pages': '부록2-3 요령 book 807~811 / 부록2-4 운영규정 book 822~825 / 부록2-5 목적물고시 book 826 (PDF = book + 7)',
        'target_source': 'E0-8 §2 A-2 = inventory 부록2-3(요령 전문)·2-4(운영규정)·2-5(목적물고시). 부록2-1/2-2(법·시행령 재수록)·부록3(참고문헌) = 스코프 제외.',
        'node_count': len(nodes),
        'edge_count': len(edges),
        'id_range': 'LAW-166~202',
        'status': 'draft',
        'ai_generated_by': 'Claude Opus 4.8 (1M) — E0-8 gap P2 실행 세션',
        'extracted_at': '2026-07-02',
        'approval': '진산 2026-07-02 P2 착수 + override(P1 FIX율 게이트 명시 생략, 근거 P1 독립검증 2회 CRITICAL 0)',
        'collision_intent': 'A안 CROSS_REF — 요령 제11조→LAW-003 / 제12조→LAW-004 / 제8조의2→CONCEPT-137 / 제13조→CONCEPT-179 (교재 요약본·개정분과 별개 원문 노드)',
        'escalate': '별표1(산식)·별표2/3(표)·목적물 범위표·운영규정 응시수수료 상수 = formulas/constants INSERT 0, 원문 참조만',
        'page_axis_note': '교재 이론서 book_page = pdf_page − 7 (footer 실측 정합 pdf814=807 ~ pdf833=826)',
        'derivation': '본 json 은 gap-P2-insert.sql 을 build_gap_json.py 로 기계 파싱 파생 (전사 드리프트 0)',
    },
    'nodes': nodes,
    'edges': edges,
    'formulas': [],
    'constants': [],
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f'nodes={len(nodes)} edges={len(edges)} → {OUT}')
assert len(nodes) == 37, f'node count {len(nodes)} != 37'
assert len(edges) == 41, f'edge count {len(edges)} != 41'
ids = [n['id'] for n in nodes]
assert len(set(ids)) == 37, 'duplicate node id'
assert ids == [f'LAW-{i}' for i in range(166, 203)], f'id range mismatch: {ids}'
print('SELF-CHECK PASS: 37 nodes (LAW-166~202), 41 edges, no dup')
