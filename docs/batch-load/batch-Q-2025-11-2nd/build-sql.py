"""
BATCH-Q-2025-11-2ND build-sql.
input : cleaned-extract.json (20문항, status active/flagged 분류)
output: batch-Q-2025-11-2nd-insert.sql

스키마: exam_questions (id, year, round, question_number, subject,
        content, answer, explanation, exam_type, status)
정책 : D-Q1-4 raw 통째 → content / answer/explanation NULL (추후 정제)
        깨진 수식 문자 발견 문항 → status='flagged' (TD-S47-2 정제 대상)
"""

import json
from pathlib import Path

ROOT = Path(__file__).parent
data = json.load(open(ROOT / 'cleaned-extract.json'))


def esc(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"


lines = [
    '-- BATCH-Q-2025-11-2ND: 2025년 제11회 손해평가사 2차 시험 20문항',
    '-- 출처: 큐넷 공식 + 학원 해설 (홍덕기/한종찬 교수)',
    '-- 적재일: 2026-05-06 (Session 047)',
    f'-- total: {len(data)} questions',
    f'-- active: {sum(1 for q in data if q["status"] == "active")} questions',
    f'-- flagged: {sum(1 for q in data if q["status"] == "flagged")} questions (깨진 수식 문자 → TD-S47-2 정제 대상)',
    '',
]

for q in data:
    sql = (
        'INSERT INTO exam_questions '
        '(id, year, round, question_number, subject, content, answer, '
        'explanation, exam_type, status) VALUES ('
        f'{esc(q["id"])}, {q["year"]}, {q["round"]}, {q["question_number"]}, '
        f'{esc(q["subject"])}, {esc(q["content"])}, {esc(q["answer"])}, '
        f'{esc(q["explanation"])}, {esc(q["exam_type"])}, {esc(q["status"])});'
    )
    lines.append(sql)

out = ROOT / 'batch-Q-2025-11-2nd-insert.sql'
out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'wrote {len(data)} INSERT statements -> {out.name}')
print(f'first sample:\n{lines[7][:300]}')
