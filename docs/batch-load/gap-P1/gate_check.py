#!/usr/bin/env python3
"""gap-P1 로컬 기계 게이트 (G-GAP-1·2·5·6·7 pre-load). 실패 = 비영번 종료."""
import json
import re
import sys

SQL = 'docs/batch-load/gap-P1/gap-P1-insert.sql'
JSON = 'docs/batch-load/gap-P1/gap-P1-knowledge-graph.json'

sql_lines = open(SQL, encoding='utf-8').read().splitlines()
node_ins = [l for l in sql_lines if l.strip().startswith('INSERT OR IGNORE INTO knowledge_nodes')]
edge_ins = [l for l in sql_lines if l.strip().startswith('INSERT OR IGNORE INTO knowledge_edges')]
data = json.load(open(JSON, encoding='utf-8'))

fails, notes = [], []

# ---- G-GAP-6: 행수 3중 일치 (nodes/edges 각각) ----
if len(node_ins) != 22:
    fails.append(f'G-GAP-6 node SQL rows {len(node_ins)} != 22')
if len(edge_ins) != 28:
    fails.append(f'G-GAP-6 edge SQL rows {len(edge_ins)} != 28')
if len(data['nodes']) != 22:
    fails.append(f'G-GAP-6 json nodes {len(data["nodes"])} != 22')
if len(data['edges']) != 28:
    fails.append(f'G-GAP-6 json edges {len(data["edges"])} != 28')

# ---- G-GAP-5: draft-only + approved 전이문 0 (주석 -- 라인 제외) ----
code_lines = [l for l in sql_lines if not l.lstrip().startswith('--')]
approved_transition = [l for l in code_lines if re.search(r'status_transitions|UPDATE\s+knowledge', l, re.I)]
if approved_transition:
    fails.append(f'G-GAP-5 approved 전이/UPDATE 문 발견: {len(approved_transition)}')
for l in node_ins:
    m = re.search(r",\s*'(\w+)'\)\s*;\s*$", l)  # 마지막 quoted 값 = status
    if not m or m.group(1) != 'draft':
        fails.append(f'G-GAP-5 non-draft status: {l[:80]}')
non_draft = [l for l in node_ins if "'draft');" not in l]
if non_draft:
    fails.append(f'G-GAP-5 draft 아닌 노드 {len(non_draft)}')

# ---- G-GAP-2: ID 패턴 + 중복 ----
node_ids = re.findall(r"knowledge_nodes[^V]*VALUES \('(LAW-\d{3})'", '\n'.join(node_ins))
if node_ids != [f'LAW-{i}' for i in range(144, 166)]:
    fails.append(f'G-GAP-2 node id 연번 불일치: {node_ids}')
if len(set(node_ids)) != len(node_ids):
    fails.append('G-GAP-2 node id 중복')
edge_ids = re.findall(r"knowledge_edges[^V]*VALUES \('(EDGE-GAP-P1-\d{4})'", '\n'.join(edge_ins))
if len(set(edge_ids)) != 28:
    fails.append(f'G-GAP-2 edge id 중복/누락: {len(set(edge_ids))}')

# ---- G-GAP-7 pre-load: 신규 노드 고아 0 (각 노드가 from_node 로 >=1 엣지) ----
from_nodes = set(e['source_id'] for e in data['edges'])
for nid in node_ids:
    if nid not in from_nodes:
        fails.append(f'G-GAP-7 고아 후보(엣지 없음): {nid}')

# ---- edge 어휘 (신조어 금지) ----
VALID_EDGE = {'DEPENDS_ON', 'USES_FORMULA', 'APPLIES_TO', 'DEFINED_AS', 'PREREQUISITE',
              'REQUIRES_INVESTIGATION', 'CROSS_REF', 'GOVERNED_BY', 'DIFFERS_FROM',
              'SHARED_WITH', 'TIME_CONSTRAINT', 'EXCEPTION', 'SUPERSEDES'}
for e in data['edges']:
    if e['edge_type'] not in VALID_EDGE:
        fails.append(f'신조어 edge_type: {e["edge_type"]}')

# ---- edge 타깃 = 신규(144~165) 또는 기존 확정 노드 ----
CONFIRMED_EXISTING = {'LAW-001', 'LAW-002', 'CONCEPT-137', 'INV-087', 'LAW-024', 'LAW-028',
                      'LAW-029', 'LAW-047', 'LAW-050', 'LAW-052', 'LAW-054', 'LAW-069',
                      'LAW-092', 'LAW-110', 'LAW-125', 'LAW-126', 'LAW-136', 'LAW-137'}
NEW = set(node_ids)
for e in data['edges']:
    for ep in (e['source_id'], e['target_id']):
        if ep not in NEW and ep not in CONFIRMED_EXISTING:
            fails.append(f'미확인 엣지 타깃: {ep}')

# ---- G-GAP-1: 대상 22 조문 완전성 ----
TARGETS = ['법 제8조', '법 제11조',
           '시행령 제2조', '시행령 제3조의2', '시행령 제4조', '시행령 제5조', '시행령 제6조',
           '시행령 제11조', '시행령 제17조', '시행령 제18조', '시행령 제20조', '시행령 제21조',
           '시행령 제22조의3', '시행령 제22조의4',
           '상법 제642조', '상법 제721조', '상법 제722조', '상법 제723조', '상법 제724조',
           '상법 제725조', '상법 제725조의2', '상법 제726조']
titles = [n['title'] for n in data['nodes']]
for t in TARGETS:
    hits = [tt for tt in titles if tt.startswith(t + ' ') or tt == t or tt.startswith(t + '(')]
    # 제725조 vs 제725조의2 구분: startswith '상법 제725조 ' 는 의2 배제
    exact = [tt for tt in titles if re.match(re.escape(t) + r'\s*\(', tt)]
    if len(exact) != 1:
        fails.append(f'G-GAP-1 대상 매칭 이상 ({t}): {exact}')
if len(TARGETS) != 22:
    fails.append('G-GAP-1 대상 목록 != 22')

# ---- 보고 ----
print('=== gap-P1 로컬 게이트 ===')
print(f'node SQL {len(node_ins)} / edge SQL {len(edge_ins)} / json nodes {len(data["nodes"])} / json edges {len(data["edges"])}')
print(f'node ids: {node_ids[0]}~{node_ids[-1]} ({len(node_ids)})')
print(f'edge types used: {sorted(set(e["edge_type"] for e in data["edges"]))}')
print(f'대상 22 조문 매칭: 전건 1:1' if not [f for f in fails if "G-GAP-1" in f] else 'G-GAP-1 이상')
if fails:
    print('\n❌ FAIL:')
    for f in fails:
        print('  -', f)
    sys.exit(1)
print('\n✅ ALL LOCAL GATES PASS (G-GAP-1·2·5·6·7-preload + edge 어휘/타깃)')
