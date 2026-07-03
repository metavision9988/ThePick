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
        'batch_id': 'BATCH-GAP-P3',
        'description': 'E0-8 갭 보강 P3 — 개정 2차 B-항목 4건 (착과수조사 시기·과수4종 수확량조사·무화과 조사시기·표본구간 면적표). draft-only.',
        'source_pdf': 'docs/manual/4월10일_26년2차2과목_변경사항정리.pdf (26년 개정사항 정리 2차 2과목, 한종찬 교수 제공)',
        'source_pages': 'B-항목3b·3c = PDF p2 / 4b = PDF p3 / 5d = PDF p5',
        'target_source': 'E0-8 §2 A-5 = inventory 라인 686·687·692·698 (❌ B-항목3b 착과수조사 시기·3c 과수4종 수확량조사 준용·4b 무화과 조사시기·5d 품목별 표본구간 면적표). 개정 문서 축(CONCEPT-178~203) 내 부재분.',
        'node_count': len(nodes),
        'edge_count': len(edges),
        'id_range': 'CONCEPT-219~222',
        'status': 'draft',
        'ai_generated_by': 'Claude Opus 4.8 (1M) — E0-8 gap P3 실행 세션',
        'extracted_at': '2026-07-03',
        'approval': '진산 2026-07-03 P3 착수 + override(P2 연속, FIX율 게이트 완화 = 패키지별 독립 리뷰 CRITICAL 0 대체)',
        'edge_intent': '전부 CONCEPT-178 →PREREQUISITE→ 자식 (26년 개정 2차 META → 개정 항목, 기존 25노드 관례 정합)',
        'escalate_note': '교재 본체(BATCH-1~7=개정 반영본) CONTENT 중복 가능(진산 판정) / 3c 수확량 산출식=formulas INSERT 0 / book_page=개정 PDF 자체 페이지(구교재 앵커 미인용)',
        'derivation': '본 json 은 gap-P3-insert.sql 을 build_gap_json.py 로 기계 파싱 파생 (전사 드리프트 0)',
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
assert len(nodes) == 4, f'node count {len(nodes)} != 4'
assert len(edges) == 4, f'edge count {len(edges)} != 4'
ids = [n['id'] for n in nodes]
assert len(set(ids)) == 4, 'duplicate node id'
assert ids == [f'CONCEPT-{i}' for i in range(219, 223)], f'id range mismatch: {ids}'
print('SELF-CHECK PASS: 4 nodes (CONCEPT-219~222), 4 edges, no dup')
