#!/usr/bin/env python3
"""gap-P2 로컬 기계 게이트 (G-GAP-1·2·5·6·7 pre-load). 실패 = 비영번 종료."""
import json
import re
import sys

SQL = 'docs/batch-load/gap-P2/gap-P2-insert.sql'
JSON = 'docs/batch-load/gap-P2/gap-P2-knowledge-graph.json'

sql_lines = open(SQL, encoding='utf-8').read().splitlines()
node_ins = [l for l in sql_lines if l.strip().startswith('INSERT OR IGNORE INTO knowledge_nodes')]
edge_ins = [l for l in sql_lines if l.strip().startswith('INSERT OR IGNORE INTO knowledge_edges')]
data = json.load(open(JSON, encoding='utf-8'))

fails = []

# ---- G-GAP-6: 행수 3중 일치 ----
if len(node_ins) != 37:
    fails.append(f'G-GAP-6 node SQL rows {len(node_ins)} != 37')
if len(edge_ins) != 41:
    fails.append(f'G-GAP-6 edge SQL rows {len(edge_ins)} != 41')
if len(data['nodes']) != 37:
    fails.append(f'G-GAP-6 json nodes {len(data["nodes"])} != 37')
if len(data['edges']) != 41:
    fails.append(f'G-GAP-6 json edges {len(data["edges"])} != 41')

# ---- G-GAP-5: draft-only + approved 전이문 0 (주석 -- 라인 제외) ----
code_lines = [l for l in sql_lines if not l.lstrip().startswith('--')]
approved_transition = [l for l in code_lines if re.search(r'status_transitions|UPDATE\s+knowledge', l, re.I)]
if approved_transition:
    fails.append(f'G-GAP-5 approved 전이/UPDATE 문 발견: {len(approved_transition)}')
non_draft = [l for l in node_ins if "'draft');" not in l]
if non_draft:
    fails.append(f'G-GAP-5 draft 아닌 노드 {len(non_draft)}')

# ---- G-GAP-2: ID 패턴 + 연번 + 중복 ----
node_ids = re.findall(r"knowledge_nodes[^V]*VALUES \('(LAW-\d{3})'", '\n'.join(node_ins))
if node_ids != [f'LAW-{i}' for i in range(166, 203)]:
    fails.append(f'G-GAP-2 node id 연번 불일치: {node_ids[:3]}...{node_ids[-2:]}')
if len(set(node_ids)) != len(node_ids):
    fails.append('G-GAP-2 node id 중복')
edge_ids = re.findall(r"knowledge_edges[^V]*VALUES \('(EDGE-GAP-P2-\d{4})'", '\n'.join(edge_ins))
if len(set(edge_ids)) != 41:
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

# ---- edge 타깃 = 신규(166~202) 또는 기존 확정 노드 (production SELECT 로 확정한 7개) ----
CONFIRMED_EXISTING = {'LAW-145', 'LAW-046', 'LAW-026', 'LAW-003', 'LAW-004',
                      'CONCEPT-137', 'CONCEPT-179'}
NEW = set(node_ids)
for e in data['edges']:
    for ep in (e['source_id'], e['target_id']):
        if ep not in NEW and ep not in CONFIRMED_EXISTING:
            fails.append(f'미확인 엣지 타깃: {ep}')

# ---- G-GAP-1: 대상 완전성 (요령 18 + 운영규정 18 + 목적물 1 = 3 출처단위) ----
titles = [n['title'] for n in data['nodes']]
yeong = [t for t in titles if t.startswith('요령 제')]
unyeong = [t for t in titles if t.startswith('운영규정 제')]
mokjeok = [t for t in titles if t.startswith('목적물고시')]
if len(yeong) != 18:
    fails.append(f'G-GAP-1 요령 조문 {len(yeong)} != 18')
if len(unyeong) != 18:
    fails.append(f'G-GAP-1 운영규정 조문 {len(unyeong)} != 18')
if len(mokjeok) != 1:
    fails.append(f'G-GAP-1 목적물고시 {len(mokjeok)} != 1')

# 요령 핵심 조문 존재 (위음성 방지 표본)
YEONG_KEY = ['요령 제1조', '요령 제2조', '요령 제5조의2', '요령 제8조', '요령 제8조의2',
             '요령 제11조', '요령 제12조', '요령 제13조', '요령 제17조']
for k in YEONG_KEY:
    if not any(t.startswith(k + ' ') or t.startswith(k + '(') for t in titles):
        fails.append(f'G-GAP-1 요령 핵심 조문 누락: {k}')
UNY_KEY = ['운영규정 제1조', '운영규정 제13조', '운영규정 제13조의2', '운영규정 제15조', '운영규정 제18조']
for k in UNY_KEY:
    if not any(t.startswith(k + ' ') or t.startswith(k + '(') for t in titles):
        fails.append(f'G-GAP-1 운영규정 핵심 조문 누락: {k}')

# ---- G-GAP-4 표본: 핵심 수치가 본문(content)에 존재 ----
content_all = '\n'.join(n['content'] for n in data['nodes'])
# ★ 별표1/2/3 산식·표 수치(30,000·65% 등)는 ESCALATE = 노드 미포함이 정상 → NUMS 에서 제외.
#   본 표본은 요령/운영규정 조문 본문에 실재하는 수치만 검사.
NUMS = ['5인 이내', '30일 이내', '7영업일', '7일 이내', '2년', '6개월',
        '2만원', '3만3천원', '3년마다', '1월 15일']
for num in NUMS:
    if num not in content_all:
        fails.append(f'G-GAP-4 표본 수치 미검출(원문 대조 필요): {num}')

# ---- 보고 ----
print('=== gap-P2 로컬 게이트 ===')
print(f'node SQL {len(node_ins)} / edge SQL {len(edge_ins)} / json nodes {len(data["nodes"])} / json edges {len(data["edges"])}')
print(f'node ids: {node_ids[0]}~{node_ids[-1]} ({len(node_ids)}) / edge ids: {len(set(edge_ids))}')
print(f'요령 {len(yeong)} / 운영규정 {len(unyeong)} / 목적물 {len(mokjeok)}')
print(f'edge types: {sorted(set(e["edge_type"] for e in data["edges"]))}')
print(f'edge 타깃 외부(기존): {sorted(set(e["target_id"] for e in data["edges"]) & CONFIRMED_EXISTING)}')
if fails:
    print('\n❌ FAIL:')
    for f in fails:
        print('  -', f)
    sys.exit(1)
print('\n✅ ALL LOCAL GATES PASS (G-GAP-1·2·4표본·5·6·7-preload + edge 어휘/타깃)')
