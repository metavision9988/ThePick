#!/usr/bin/env python3
"""gap-P3 로컬 기계 게이트 (G-GAP-1·2·4표본·5·6·7 pre-load). 실패 = 비영번 종료."""
import json
import re
import sys

SQL = 'docs/batch-load/gap-P3/gap-P3-insert.sql'
JSON = 'docs/batch-load/gap-P3/gap-P3-knowledge-graph.json'

sql_lines = open(SQL, encoding='utf-8').read().splitlines()
node_ins = [l for l in sql_lines if l.strip().startswith('INSERT OR IGNORE INTO knowledge_nodes')]
edge_ins = [l for l in sql_lines if l.strip().startswith('INSERT OR IGNORE INTO knowledge_edges')]
data = json.load(open(JSON, encoding='utf-8'))

fails = []

# G-GAP-6 행수 3중 일치
if len(node_ins) != 4: fails.append(f'node SQL {len(node_ins)} != 4')
if len(edge_ins) != 4: fails.append(f'edge SQL {len(edge_ins)} != 4')
if len(data['nodes']) != 4: fails.append(f'json nodes {len(data["nodes"])} != 4')
if len(data['edges']) != 4: fails.append(f'json edges {len(data["edges"])} != 4')

# G-GAP-5 draft-only (주석 제외)
code_lines = [l for l in sql_lines if not l.lstrip().startswith('--')]
if [l for l in code_lines if re.search(r'status_transitions|UPDATE\s+knowledge', l, re.I)]:
    fails.append('G-GAP-5 approved 전이/UPDATE 문 발견')
if [l for l in node_ins if "'draft');" not in l]:
    fails.append('G-GAP-5 draft 아닌 노드')

# G-GAP-2 ID 연번/중복
node_ids = re.findall(r"knowledge_nodes[^V]*VALUES \('(CONCEPT-\d{3})'", '\n'.join(node_ins))
if node_ids != [f'CONCEPT-{i}' for i in range(219, 223)]:
    fails.append(f'G-GAP-2 node id 연번 불일치: {node_ids}')
edge_ids = re.findall(r"knowledge_edges[^V]*VALUES \('(EDGE-GAP-P3-\d{4})'", '\n'.join(edge_ins))
if len(set(edge_ids)) != 4:
    fails.append(f'G-GAP-2 edge id 중복/누락: {len(set(edge_ids))}')

# G-GAP-7 pre-load: 신규 노드 각 엣지 >=1 (from OR to — 러너 고아 정의 = "no active edges" 정합)
edge_nodes = set(e['source_id'] for e in data['edges']) | set(e['target_id'] for e in data['edges'])
for nid in node_ids:
    if nid not in edge_nodes:
        fails.append(f'G-GAP-7 고아 후보(엣지 없음): {nid}')

# edge 어휘 + 타깃 (CONCEPT-178 = 확정 META)
VALID_EDGE = {'DEPENDS_ON', 'USES_FORMULA', 'APPLIES_TO', 'DEFINED_AS', 'PREREQUISITE',
              'REQUIRES_INVESTIGATION', 'CROSS_REF', 'GOVERNED_BY', 'DIFFERS_FROM',
              'SHARED_WITH', 'TIME_CONSTRAINT', 'EXCEPTION', 'SUPERSEDES'}
CONFIRMED_EXISTING = {'CONCEPT-178'}
NEW = set(node_ids)
for e in data['edges']:
    if e['edge_type'] not in VALID_EDGE:
        fails.append(f'신조어 edge_type: {e["edge_type"]}')
    for ep in (e['source_id'], e['target_id']):
        if ep not in NEW and ep not in CONFIRMED_EXISTING:
            fails.append(f'미확인 엣지 타깃: {ep}')

# G-GAP-1 대상 완전성 (B-항목 3b·3c·4b·5d 키워드 존재)
content_all = '\n'.join(n['content'] + n['title'] for n in data['nodes'])
TARGETS = ['착과수조사 시기', '과수4종', '무화과 과실손해조사 시기', '표본구간 면적']
for t in TARGETS:
    if t not in content_all:
        fails.append(f'G-GAP-1 대상 미검출: {t}')

# G-GAP-4 표본 수치 (원문 대조 필요)
NUMS = ['100개 이상', '3주 이상', '2m 미만', '2m 이상', '5주', '6주 이상', '10주 이상',
        '20cm', '0.04', '1㎡']
for num in NUMS:
    if num not in content_all:
        fails.append(f'G-GAP-4 표본 수치 미검출: {num}')

print('=== gap-P3 로컬 게이트 ===')
print(f'node SQL {len(node_ins)} / edge SQL {len(edge_ins)} / json {len(data["nodes"])}/{len(data["edges"])}')
print(f'node ids: {node_ids} / edge ids: {len(set(edge_ids))}')
print(f'edge types: {sorted(set(e["edge_type"] for e in data["edges"]))} / 타깃 외부: {sorted(set(e["target_id"] for e in data["edges"]) & CONFIRMED_EXISTING)}')
if fails:
    print('\n❌ FAIL:')
    for f in fails: print('  -', f)
    sys.exit(1)
print('\n✅ ALL LOCAL GATES PASS (G-GAP-1·2·4표본·5·6·7-preload + edge 어휘/타깃)')
