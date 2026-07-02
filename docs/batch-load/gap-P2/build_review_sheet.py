#!/usr/bin/env python3
"""gap-P2-knowledge-graph.json 에서 진산 검수표(§7 형식)를 파생 생성 — 전사 드리프트 0."""
import json

data = json.load(open('docs/batch-load/gap-P2/gap-P2-knowledge-graph.json', encoding='utf-8'))
nodes = data['nodes']
edges = data['edges']

# 노드별 out-엣지 매핑
by_src = {}
for e in edges:
    by_src.setdefault(e['source_id'], []).append((e['target_id'], e['edge_type']))

# 플래그: CROSS_REF 보유 / 수치 포함 / ESCALATE 연관
NUM_MARK = ['5인', '30일', '7영업일', '7일', '2년', '6개월', '2만원', '3만3천원',
            '3년마다', '1월 15일', '별표', 'ESCALATE', '30,000', '65%']


def excerpt(content, n=70):
    s = content.replace('\n', ' ').strip()
    return (s[:n] + '…') if len(s) > n else s


def flags(node):
    fl = []
    c = node['content']
    if any(m in c for m in ['5인', '30일', '7영업일', '7일 이내', '2년', '6개월', '2만원', '3만3천원', '3년마다', '1월 15일']):
        fl.append('수치')
    if any(t[1] == 'CROSS_REF' for t in by_src.get(node['id'], [])):
        fl.append('CROSS_REF(중복소지)')
    if 'ESCALATE' in c or '별표' in c or '표]와' in c or '[표]' in c:
        fl.append('ESCALATE')
    return ' / '.join(fl) if fl else '—'


rows = []
for n in nodes:
    edge_str = ', '.join(f'{t[0]}({t[1]})' for t in by_src.get(n['id'], [])) or '—'
    src = f"{n['chapter']} p.{n['book_page']}(PDF {n['pdf_page']})"
    rows.append(f"| {n['id']} | {n['title']} | {src} | {excerpt(n['content'])} | {edge_str} | {flags(n)} |")

# 엣지 타입 집계
et = {}
for e in edges:
    et[e['edge_type']] = et.get(e['edge_type'], 0) + 1

print('| 신규 ID | name | 출처 (chapter, page) | 원문 발췌 (핵심) | 엣지 (대상·타입) | 플래그 |')
print('| --- | --- | --- | --- | --- | --- |')
for r in rows:
    print(r)
print()
print(f'엣지 집계: {et} (총 {len(edges)})')
print(f'CROSS_REF 노드: {[n["id"] for n in nodes if any(t[1]=="CROSS_REF" for t in by_src.get(n["id"],[]))]}')
