import json, re, fitz, pdfplumber, os
from collections import Counter

# 6회 A형 정답 (multimodal 추출)
ANSWERS_A = {
    1:'3',2:'3',3:'3',4:'4',5:'4',6:'1',7:'4',8:'1',9:'3',10:'1',
    11:'2',12:'3',13:'2',14:'4',15:'1',16:'4',17:'4',18:'2',19:'3',20:'1',
    21:'2',22:'1',23:'3',24:'4',25:'2',
    26:'3',27:'2',28:'3',29:'4',30:'1',31:'2',32:'1',33:'2',34:'4',35:'3',
    36:'1',37:'1,2,3,4',38:'4',39:'2',40:'4',41:'2',42:'4',43:'3',44:'3',45:'1',
    46:'4',47:'4',48:'4',49:'3',50:'1',
    51:'4',52:'2',53:'2',54:'3',55:'4',56:'4',57:'3',58:'2',59:'3',60:'2',
    61:'3',62:'4',63:'4',64:'4',65:'1',66:'4',67:'2',68:'2',69:'4',70:'2',
    71:'1',72:'1',73:'1',74:'1',75:'3',
}
assert len(ANSWERS_A) == 75

# 6회 B형 정답 (참고용 보존, 적재 X)
ANSWERS_B = {
    1:'3',2:'3',3:'3',4:'4',5:'1',6:'4',7:'4',8:'3',9:'1',10:'1',
    11:'2',12:'4',13:'2',14:'3',15:'1',16:'4',17:'3',18:'2',19:'3',20:'1',
    21:'1',22:'2',23:'4',24:'3',25:'2',
    26:'3',27:'2',28:'3',29:'4',30:'2',31:'3',32:'1',33:'2',34:'1',35:'3',
    36:'3',37:'4',38:'1,2,3,4',39:'2',40:'4',41:'2',42:'3',43:'4',44:'3',45:'1',
    46:'4',47:'1',48:'1',49:'3',50:'3',
    51:'4',52:'2',53:'2',54:'3',55:'4',56:'3',57:'1',58:'3',59:'4',60:'2',
    61:'3',62:'4',63:'4',64:'1',65:'1',66:'4',67:'2',68:'2',69:'1',70:'2',
    71:'1',72:'4',73:'3',74:'1',75:'3',
}
assert len(ANSWERS_B) == 75

DIR = 'batch-Q-2020-6-1st'
Y, R = 2020, 6

# 1) A형 문제지 텍스트 추출
A_PDF = '/home/soo/ClaudePro/ThePick/docs/manual/제6회 손해평가사 문제지 A형 원본.pdf'
with pdfplumber.open(A_PDF) as pdf:
    pages = [{'page': i+1, 'text': p.extract_text() or ''} for i, p in enumerate(pdf.pages)]
    print(f'A pages: {len(pages)}, chars: {sum(len(x["text"]) for x in pages)}')
with open(f'{DIR}/extract-questions-A.json', 'w', encoding='utf-8') as f:
    json.dump(pages, f, ensure_ascii=False, indent=2)

# 2) B형 문제지 텍스트 추출 (영속 보존)
B_PDF = '/home/soo/ClaudePro/ThePick/docs/manual/제6회 손해평가사 문제지 B형 원본.pdf'
with pdfplumber.open(B_PDF) as pdf:
    pages_b = [{'page': i+1, 'text': p.extract_text() or ''} for i, p in enumerate(pdf.pages)]
    print(f'B pages: {len(pages_b)}, chars: {sum(len(x["text"]) for x in pages_b)}')
with open(f'{DIR}/extract-questions-B.json', 'w', encoding='utf-8') as f:
    json.dump(pages_b, f, ensure_ascii=False, indent=2)

# B형 정답 dict도 영속 (차후 적재 가능)
with open(f'{DIR}/answers-B.json', 'w', encoding='utf-8') as f:
    json.dump({'form': 'B', 'year': Y, 'round': R, 'answers': ANSWERS_B}, f, ensure_ascii=False, indent=2)

# 3) A형 75문항 파싱 (build-all-rounds.py 동일 패턴)
SUBJECTS = [
    (1, 25, '상법 보험편', '1st_sub1'),
    (26, 50, '농어업재해보험법령', '1st_sub2'),
    (51, 75, '농학개론 중 재배학 및 원예작물학', '1st_sub3'),
]
def subj(qn):
    for s, e, name, scope in SUBJECTS:
        if s <= qn <= e: return name, scope

full = '\n'.join(p['text'] for p in pages)
full = re.sub(r'\d{4}년도\s+제\d{1,2}회\s+손해평가사\s+1차\s+1교시\s+[AB]형\s*\(\s*\d+\s*-\s*\d+\s*\)', '', full)
full = re.sub(r'^\s*[「｢『]?상법[」｣』]?\s*\(?\s*보험편\s*\)?\s*$', '', full, flags=re.MULTILINE)
full = re.sub(r'^\s*농어업재해보험법(?:령)?\s*(?:및\s*규정)?\s*$', '', full, flags=re.MULTILINE)
full = re.sub(r'^\s*(?:농학개론\s*중\s*)?재배학\s*및\s*원예작물학\s*$', '', full, flags=re.MULTILINE)
full = re.sub(r'^\s*각\s*문제에서\s*요구하는\s*가장\s*적합하거나\s*가까운\s*답.*$', '', full, flags=re.MULTILINE)

matches = list(re.finditer(r'(?m)^(\d{1,3})\.\s', full))
selected = []
expect = 1
for m in matches:
    if int(m.group(1)) == expect:
        selected.append(m); expect += 1
        if expect > 75: break
assert len(selected) == 75, f'parsed {len(selected)} markers'

build = []
for i, m in enumerate(selected):
    qn = i + 1
    start = m.end()
    end = selected[i+1].start() if i+1 < len(selected) else len(full)
    body = full[start:end].strip()
    parts = re.split(r'[①②③④]', body)
    stem = parts[0]
    opts = parts[1:5] if len(parts) >= 5 else parts[1:] + [''] * (4 - (len(parts) - 1))
    name, scope = subj(qn)
    build.append({
        'id': f'Q-{Y}-{R:02d}-{qn:03d}',
        'year': Y, 'round': R, 'exam_type': '1st',
        'question_number': qn, 'subject': name, 'exam_scope': scope,
        'stem': re.sub(r'\s+', ' ', stem).strip(),
        'options': [re.sub(r'\s+', ' ', o).strip() for o in opts],
        'answer': ANSWERS_A[qn],
        'source': f'큐넷 공식 — {Y}년 제{R}회 손해평가사 1차 시험 1교시 A형 최종정답',
    })

with open(f'{DIR}/batch-Q-{Y}-{R:02d}-1st.json', 'w', encoding='utf-8') as f:
    json.dump({'meta': {'batch_id': f'BATCH-Q-{Y}-{R:02d}-1ST', 'year': Y, 'round': R, 'exam_type': '1st', 'form': 'A', 'total': len(build), 'note_b_form': 'B형 정답+문제지는 영속 보존 (answers-B.json + extract-questions-B.json), 적재 X (출제 패턴 분석 시 활용)'}, 'questions': build}, f, ensure_ascii=False, indent=2)

# 4) SQL build
def esc(s):
    if s is None or s == '': return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

lines = [f'-- BATCH-Q-{Y}-{R:02d}-1ST: {Y}년 제{R}회 손해평가사 1차 시험 1교시 A형 75문항',
         '-- 출처: 큐넷 공식 최종정답 + 큐넷 공식 문제지 (1교시 A형)',
         '-- 적재일: 2026-05-06']
for q in build:
    content = q['stem'] + '\n\n' + '\n'.join(f'{i}. {o}' for i, o in zip('①②③④', q['options']))
    lines.append(
        f"INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, "
        f"explanation, exam_type, status) VALUES ({esc(q['id'])}, {q['year']}, {q['round']}, {q['question_number']}, "
        f"{esc(q['subject'])}, {esc(content)}, {esc(q['answer'])}, NULL, '1st', 'active');"
    )
with open(f'{DIR}/batch-Q-{Y}-{R:02d}-1st-insert.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

ac = Counter(q['answer'] for q in build)
oc = Counter(len(q['options']) for q in build)
print(f'built: {len(build)} / parse_issues: 0')
print(f'answers: {dict(sorted(ac.items()))}')
print(f'options counts: {dict(oc)}')
print(f'sample Q1: {build[0]["stem"][:80]} → ans={build[0]["answer"]}')
print(f'sample Q26: {build[25]["stem"][:80]} → ans={build[25]["answer"]}')
print(f'sample Q51: {build[50]["stem"][:80]} → ans={build[50]["answer"]}')
