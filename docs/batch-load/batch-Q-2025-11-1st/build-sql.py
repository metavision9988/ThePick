import json
data = json.load(open('batch-Q-2025-11-1st.json'))
qs = data['questions']

def esc(s):
    if s is None: return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

lines = [
    '-- BATCH-Q-2025-11-1ST: 2025년 제11회 손해평가사 1차 시험 1교시 A형 75문항',
    '-- 출처: 큐넷 공식 최종정답 + 큐넷 공식 문제지 (1교시 A형)',
    '-- 적재일: 2026-05-06',
    f'-- total: {len(qs)} questions',
    '',
]

for q in qs:
    content = q['stem'] + '\n\n' + '\n'.join(f'{i}. {o}' for i, o in zip('①②③④', q['options']))
    sql = (
        f"INSERT INTO exam_questions "
        f"(id, year, round, question_number, subject, content, answer, "
        f"explanation, exam_type, status) VALUES ("
        f"{esc(q['id'])}, {q['year']}, {q['round']}, {q['question_number']}, "
        f"{esc(q['subject'])}, {esc(content)}, {esc(q['answer'])}, NULL, "
        f"'1st', 'active');"
    )
    lines.append(sql)

with open('batch-Q-2025-11-1st-insert.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print(f'wrote {len(qs)} INSERT statements')
print(f'first sample:\n{lines[5][:200]}')
