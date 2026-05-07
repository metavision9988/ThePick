import json, re, os
from collections import Counter

# ===== 정답 dict (회차별, 1교시 A형) — multimodal 직접 추출 =====
ANSWERS = {
    # 2024 제10회
    10: {
        1:'4',2:'2',3:'1',4:'3',5:'1',6:'2',7:'4',8:'1',9:'3',10:'2',
        11:'4',12:'1',13:'2',14:'1',15:'3',16:'4',17:'2',18:'3',19:'4',20:'3',
        21:'2',22:'3',23:'1',24:'4',25:'2',
        26:'1',27:'3',28:'2',29:'1',30:'2',31:'1',32:'4',33:'3',34:'2',35:'3',
        36:'4',37:'2',38:'1',39:'2',40:'1',41:'1',42:'2',43:'1',44:'3',45:'4',
        46:'2',47:'4',48:'3',49:'4',50:'4',
        51:'4',52:'2',53:'4',54:'3',55:'1',56:'3',57:'4',58:'4',59:'1',60:'1',
        61:'3',62:'2',63:'1',64:'3',65:'3',66:'1',67:'4',68:'3',69:'2,4',70:'3',
        71:'4',72:'4',73:'2',74:'2',75:'1',
    },
    # 2023 제9회
    9: {
        1:'4',2:'3',3:'1',4:'2',5:'1',6:'4',7:'1',8:'4',9:'4',10:'3',
        11:'1',12:'2',13:'2',14:'3',15:'4',16:'2',17:'4',18:'3',19:'3',20:'2',
        21:'1',22:'4',23:'2',24:'3',25:'1',
        26:'3',27:'2',28:'2',29:'1',30:'3',31:'4',32:'1',33:'2',34:'4',35:'4',
        36:'1,2,3,4',37:'1,2,3,4',38:'3',39:'2',40:'2',41:'1',42:'3',43:'2',44:'2',45:'3',
        46:'4',47:'4',48:'4',49:'1',50:'2',
        51:'2',52:'4',53:'1',54:'4',55:'4',56:'3',57:'1',58:'2',59:'2',60:'3',
        61:'4',62:'4',63:'1',64:'2',65:'2',66:'1',67:'4',68:'1',69:'3',70:'2',
        71:'3',72:'1',73:'2',74:'3',75:'1,2,3,4',
    },
    # 2022 제8회
    8: {
        1:'2',2:'4',3:'1',4:'2',5:'3',6:'3',7:'1',8:'1',9:'3',10:'2',
        11:'2',12:'2',13:'4',14:'3',15:'1',16:'4',17:'3',18:'1',19:'1',20:'4',
        21:'2',22:'4',23:'3',24:'2',25:'4',
        26:'2',27:'4',28:'3',29:'2',30:'3',31:'4',32:'1',33:'1',34:'3',35:'4',
        36:'3',37:'2',38:'3',39:'1',40:'2',41:'3',42:'2',43:'1',44:'4',45:'1',
        46:'2',47:'1',48:'3',49:'1',50:'4',
        51:'2',52:'1',53:'1',54:'4',55:'3',56:'3',57:'2',58:'4',59:'4',60:'2',
        61:'1',62:'2',63:'3',64:'3',65:'3',66:'4',67:'4',68:'2',69:'1',70:'1',
        71:'2',72:'3',73:'4',74:'1',75:'1',
    },
    # 2021 제7회 1교시 A형
    7: {
        1:'2',2:'4',3:'4',4:'3',5:'1',6:'1',7:'1',8:'2',9:'1',10:'2',
        11:'3',12:'3',13:'1',14:'3',15:'2',16:'4',17:'4',18:'3',19:'4',20:'3',
        21:'2',22:'2',23:'4',24:'2',25:'4',
        26:'1',27:'1',28:'4',29:'4',30:'2',31:'2',32:'3',33:'2',34:'4',35:'1',
        36:'4',37:'4',38:'3',39:'3',40:'4',41:'1',42:'1',43:'2',44:'1',45:'3',
        46:'2',47:'3',48:'4',49:'4',50:'1',
        51:'2',52:'2',53:'3',54:'4',55:'1',56:'1',57:'2,3',58:'1',59:'4',60:'1',
        61:'2',62:'4',63:'1',64:'2',65:'1',66:'3',67:'3',68:'4',69:'2',70:'1',
        71:'3',72:'1',73:'1',74:'4',75:'1',
    },
    # 2019 제5회 1교시 A형
    5: {
        1:'3',2:'1',3:'4',4:'2',5:'4',6:'3',7:'2',8:'1',9:'1',10:'1',
        11:'4',12:'3',13:'4',14:'1',15:'2',16:'1',17:'3',18:'2',19:'4',20:'1',
        21:'4',22:'1',23:'3',24:'2',25:'4',
        26:'3',27:'4',28:'2',29:'1',30:'1',31:'3',32:'4',33:'3',34:'2',35:'4',
        36:'4',37:'1',38:'2',39:'4',40:'2',41:'4',42:'3',43:'4',44:'3',45:'1',
        46:'4',47:'1',48:'2',49:'3',50:'2',
        51:'2',52:'1',53:'2',54:'2',55:'1',56:'4',57:'2',58:'4',59:'3',60:'2',
        61:'3',62:'4',63:'1',64:'1',65:'3',66:'4',67:'4',68:'4',69:'3',70:'1',
        71:'4',72:'3',73:'2',74:'3',75:'2',
    },
}
for r, a in ANSWERS.items():
    assert len(a) == 75, f'Round {r}: {len(a)} answers'

ROUNDS = [
    {'round': 10, 'year': 2024, 'dir': 'batch-Q-2024-10-1st', 'page_count': 18},
    {'round': 9,  'year': 2023, 'dir': 'batch-Q-2023-9-1st',  'page_count': 18},
    {'round': 8,  'year': 2022, 'dir': 'batch-Q-2022-8-1st',  'page_count': 18},
    {'round': 7,  'year': 2021, 'dir': 'batch-Q-2021-7-1st',  'page_count': 18},
    {'round': 5,  'year': 2019, 'dir': 'batch-Q-2019-5-1st',  'page_count': 17},
]

SUBJECTS = [
    (1, 25, '상법 보험편', '1st_sub1'),
    (26, 50, '농어업재해보험법령', '1st_sub2'),
    (51, 75, '농학개론 중 재배학 및 원예작물학', '1st_sub3'),
]
def subj(qn):
    for s, e, name, scope in SUBJECTS:
        if s <= qn <= e: return name, scope
    raise ValueError(qn)

def parse_round(r):
    """문제지 텍스트 → 75문항 dict"""
    Y, R = r['year'], r['round']
    DIR = r['dir']
    pages = json.load(open(f"{DIR}/extract-questions.json"))
    full = '\n'.join(p['text'] for p in pages)

    # 푸터 일반화 ("YYYY년도 제RR회 손해평가사 1차 1교시 A형 ( N - n )")
    full = re.sub(r'\d{4}년도\s+제\d{1,2}회\s+손해평가사\s+1차\s+1교시\s+[AB]형\s*\(\s*\d+\s*-\s*\d+\s*\)', '', full)

    # 과목 헤더 일반화
    full = re.sub(r'^\s*[「｢『]?상법[」｣』]?\s*\(?\s*보험편\s*\)?\s*$', '', full, flags=re.MULTILINE)
    full = re.sub(r'^\s*농어업재해보험법(?:령)?\s*(?:및\s*규정)?\s*$', '', full, flags=re.MULTILINE)
    full = re.sub(r'^\s*(?:농학개론\s*중\s*)?재배학\s*및\s*원예작물학\s*$', '', full, flags=re.MULTILINE)
    # 5회 첫 페이지 안내문 제거
    full = re.sub(r'^\s*각\s*문제에서\s*요구하는\s*가장\s*적합하거나\s*가까운\s*답.*$', '', full, flags=re.MULTILINE)

    # 순차 마커 (1, 2, ..., 75)
    matches = list(re.finditer(r'(?m)^(\d{1,3})\.\s', full))
    selected = []
    expect = 1
    for m in matches:
        if int(m.group(1)) == expect:
            selected.append(m)
            expect += 1
            if expect > 75: break
    if len(selected) != 75:
        return None, f'parsed {len(selected)} markers (expected 75)'

    build = []
    errs = []
    for i, m in enumerate(selected):
        qn = i + 1
        start = m.end()
        end = selected[i+1].start() if i+1 < len(selected) else len(full)
        body = full[start:end].strip()

        parts = re.split(r'[①②③④]', body)
        if len(parts) < 5:
            errs.append(f'Q{qn}: opts={len(parts)-1}')
            stem = body
            opts = parts[1:] if len(parts) > 1 else []
            # 4개 미만 시 빈 문자열 패딩
            while len(opts) < 4: opts.append('')
        else:
            stem = parts[0]
            opts = parts[1:5]

        stem_clean = re.sub(r'\s+', ' ', stem).strip()
        opts_clean = [re.sub(r'\s+', ' ', o).strip() for o in opts]
        name, scope = subj(qn)
        build.append({
            'id': f'Q-{Y}-{R:02d}-{qn:03d}',
            'year': Y, 'round': R, 'exam_type': '1st',
            'question_number': qn, 'subject': name, 'exam_scope': scope,
            'stem': stem_clean, 'options': opts_clean,
            'answer': ANSWERS[R][qn],
            'source': f'큐넷 공식 — {Y}년 제{R}회 손해평가사 1차 시험 1교시 A형 최종정답',
        })
    return build, errs

def esc(s):
    if s is None or s == '': return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

def build_sql(build, year, round_num):
    lines = [
        f'-- BATCH-Q-{year}-{round_num:02d}-1ST: {year}년 제{round_num}회 손해평가사 1차 시험 1교시 A형 75문항',
        '-- 출처: 큐넷 공식 최종정답 + 큐넷 공식 문제지 (1교시 A형)',
        '-- 적재일: 2026-05-06',
    ]
    for q in build:
        content = q['stem'] + '\n\n' + '\n'.join(f'{i}. {o}' for i, o in zip('①②③④', q['options']))
        lines.append(
            f"INSERT INTO exam_questions "
            f"(id, year, round, question_number, subject, content, answer, "
            f"explanation, exam_type, status) VALUES ("
            f"{esc(q['id'])}, {q['year']}, {q['round']}, {q['question_number']}, "
            f"{esc(q['subject'])}, {esc(content)}, {esc(q['answer'])}, NULL, "
            f"'1st', 'active');"
        )
    return '\n'.join(lines) + '\n'

# ===== 5회분 일괄 빌드 =====
results = []
for r in ROUNDS:
    Y, R, DIR = r['year'], r['round'], r['dir']
    print(f"=== ROUND {R} ({Y}) ===")
    build, errs = parse_round(r)
    if build is None:
        print(f"  ✗ FAIL: {errs}")
        results.append({'round': R, 'status': 'FAIL', 'reason': errs})
        continue
    
    # JSON 저장
    with open(f"{DIR}/batch-Q-{Y}-{R:02d}-1st.json", 'w', encoding='utf-8') as f:
        json.dump({'meta': {'batch_id': f'BATCH-Q-{Y}-{R:02d}-1ST', 'year': Y, 'round': R, 'exam_type': '1st', 'form': 'A', 'total': len(build)}, 'questions': build}, f, ensure_ascii=False, indent=2)
    
    # SQL 저장
    sql = build_sql(build, Y, R)
    with open(f"{DIR}/batch-Q-{Y}-{R:02d}-1st-insert.sql", 'w', encoding='utf-8') as f:
        f.write(sql)
    
    # 통계
    ac = Counter(q['answer'] for q in build)
    oc = Counter(len(q['options']) for q in build)
    issues = [q['id'] for q in build if len(q['options']) != 4 or not q['stem']]
    print(f"  built: {len(build)} / errors: {len(errs)} / parse_issues: {len(issues)}")
    print(f"  answers: {dict(sorted(ac.items()))}")
    print(f"  options counts: {dict(oc)}")
    if errs: 
        for e in errs[:5]: print(f"    - {e}")
    results.append({'round': R, 'status': 'OK' if not errs else 'WARN', 'count': len(build), 'errors': errs})
    print()

# 요약
print('=== SUMMARY ===')
for r in results:
    print(f"  Round {r['round']}: {r['status']} ({r.get('count', '?')} qs, {len(r.get('errors', []))} errs)")
