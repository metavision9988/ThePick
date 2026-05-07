import json, re
from collections import Counter

ANSWERS = {
    1:4,2:2,3:2,4:2,5:2,6:3,7:1,8:4,9:2,10:4,
    11:1,12:3,13:3,14:4,15:1,16:3,17:4,18:4,19:1,20:3,
    21:1,22:1,23:3,24:2,25:3,
    26:4,27:3,28:3,29:2,30:1,31:3,32:1,33:2,34:3,35:2,
    36:3,37:4,38:1,39:1,40:1,41:4,42:2,43:3,44:4,45:2,
    46:4,47:4,48:1,49:2,50:2,
    51:4,52:1,53:1,54:4,55:1,56:2,57:3,58:3,59:1,60:3,
    61:2,62:4,63:1,64:4,65:4,66:2,67:1,68:2,69:2,70:3,
    71:3,72:3,73:4,74:2,75:3,
}
assert len(ANSWERS) == 75

SUBJECTS = [
    (1, 25, '상법 보험편', '1st_sub1'),
    (26, 50, '농어업재해보험법령', '1st_sub2'),
    (51, 75, '농학개론 중 재배학 및 원예작물학', '1st_sub3'),
]
def subj(qn):
    for s, e, name, scope in SUBJECTS:
        if s <= qn <= e: return name, scope
    raise ValueError(qn)

data = json.load(open('extract-questions.json'))
full = '\n'.join(p['text'] for p in data)
full = re.sub(r'2025년도 제11회 손해평가사 1차 1교시 A형\s*\(\s*18\s*-\s*\d+\s*\)', '', full)

# 순차 마커 검출 (1, 2, 3, ..., 75 monotonic)
matches = list(re.finditer(r'(?m)^(\d{1,3})\.\s', full))
selected = []
expect = 1
for m in matches:
    if int(m.group(1)) == expect:
        selected.append(m)
        expect += 1
        if expect > 75: break
assert len(selected) == 75, f'expected 75, got {len(selected)}'

build = []
errors = []
for i, m in enumerate(selected):
    qn = i + 1
    start = m.end()  # after "N. "
    end = selected[i+1].start() if i+1 < len(selected) else len(full)
    body = full[start:end].strip()

    # 과목 헤더 제거 (선지 사이에 끼어들 수 있음)
    body = re.sub(r'^\s*｢상법｣ 보험편\s*$', '', body, flags=re.MULTILINE)
    body = re.sub(r'^\s*농어업재해보험법령\s*$', '', body, flags=re.MULTILINE)
    body = re.sub(r'^\s*농학개론 중 재배학 및 원예작물학\s*$', '', body, flags=re.MULTILINE)

    # 선지 ① ② ③ ④ split
    parts = re.split(r'[①②③④]', body)
    if len(parts) < 5:
        errors.append(f'Q{qn}: opts={len(parts)-1}')
        # stem만이라도 보존
        stem = body
        opts = parts[1:] if len(parts) > 1 else []
    else:
        stem = parts[0]
        opts = parts[1:5]

    stem_clean = re.sub(r'\s+', ' ', stem).strip()
    opts_clean = [re.sub(r'\s+', ' ', o).strip() for o in opts]

    # 정합 체크: 선지 4개여야 함
    name, scope = subj(qn)
    build.append({
        'id': f'Q-2025-11-{qn:03d}',
        'year': 2025,
        'round': 11,
        'exam_type': '1st',
        'question_number': qn,
        'subject': name,
        'exam_scope': scope,
        'stem': stem_clean,
        'options': opts_clean,
        'answer': str(ANSWERS[qn]),
        'source': '큐넷 공식 — 2025년 제11회 손해평가사 1차 시험 1교시 A형 최종정답',
    })

print(f'built: {len(build)} / errors: {len(errors)}')
for e in errors: print(' -', e)

# answer distribution
ac = Counter(int(q['answer']) for q in build)
print('answer distribution:', dict(sorted(ac.items())))

# stem length distribution
sl = sorted(len(q['stem']) for q in build)
print(f'stem len min/median/max: {sl[0]}/{sl[37]}/{sl[-1]}')

# opt count distribution
oc = Counter(len(q['options']) for q in build)
print('options count distribution:', dict(oc))

with open('batch-Q-2025-11-1st.json', 'w', encoding='utf-8') as f:
    json.dump({
        'meta': {'batch_id': 'BATCH-Q-2025-11-1ST', 'year': 2025, 'round': 11,
                 'exam_type': '1st', 'form': 'A', 'total': len(build),
                 'subjects': {'상법 보험편': 25, '농어업재해보험법령': 25, '농학개론 중 재배학 및 원예작물학': 25}},
        'questions': build
    }, f, ensure_ascii=False, indent=2)

# Sample 3건 출력 (각 과목 첫 문항)
for tgt in [1, 26, 51]:
    q = build[tgt-1]
    print()
    print(f"=== {q['id']} (Q{q['question_number']}, {q['subject']}, ans={q['answer']}) ===")
    print('stem:', q['stem'][:150])
    for i, o in enumerate(q['options'], 1):
        print(f'  {i}. {o[:80]}')
