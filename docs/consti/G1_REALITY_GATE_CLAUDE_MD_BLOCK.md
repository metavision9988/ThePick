# 🚧 G-1 REALITY GATE — CLAUDE.md 강제 블록 + Hook/Linter 번들

> **용도:** 각 프로젝트의 `CLAUDE.md` 상단에 **블록 A**를 복사. **블록 B~D**는 hook/CI로 기계적 강제.
> **원칙 (헌법 §하네스):** "40개 규칙 90% 준수 > 180개 규칙 0% 준수." 텍스트는 advisory, **기계가 차단해야 진짜 규칙**이다.
> **적용 헌법:** VOID DEV UNIFIED CONSTITUTION v3.6 (G-1 Reality Gate)

---

# 블록 A — CLAUDE.md 텍스트 규칙 (복사해서 붙여넣기)

```markdown
## 🚧 G-1 REALITY GATE 규칙 (코드 1줄 전 — 최우선)

이 프로젝트의 모든 새 기능·아이디어는 코드를 쓰기 전에 G-1을 통과해야 한다.
G-1은 ACAP Stage -1(Deep Dive)보다도 앞에 온다.

### AI(너)가 반드시 지킬 것

1. **"가능합니다"는 금지어다.** 목표의 실현 가능성을 단언하지 마라.
   대신 이 형식으로만 답하라:
   - "이 목표의 업계 SOTA 천장은 [수치/출처]입니다."
   - "당신의 목표는 그 천장 [위/아래]에 있습니다."
   - "측정 전이므로 이것은 추정입니다. Feasibility Spike가 필요합니다."
2. **목표 문장에 절대 수식어**(자동/완전/범용/지배적/출판급/전문가급)가 있으면
   → 즉시 멈추고 R1~R5 전수를 요구하라. 이 단어들은 TYPE-11(Feasibility Sycophancy)의 서식지다.
3. **한 문장 목표를 그대로 받지 마라.** 최소 2개 축으로 분해해서 조각별로 판정하라.
   묶음 전체를 한 번에 "가능/불가"로 판정하는 것은 금지다.
4. **AI 자체 점수로 가능성을 판정하지 마라.** Ground Truth 대비 정량 비교 +
   인간 직접 소비만이 진실이다. (ScoreForge "A등급 환각" 재발 방지)
5. **R5(GO/STOP)는 인간이 결정한다.** 너는 🟢/🟡/🔴 사실만 못박는다.
   "할 가치가 있다/없다"를 네가 결론짓지 마라.
6. **feasibility.md 없이 research.md를 쓰지 마라.** 현실 판정이 코드베이스 분석보다 먼저다.

### G-1 5관문 (산출물 영속 파일 의무)

|         관문          | 행동                                                  | 산출물                                    |
| :-------------------: | :---------------------------------------------------- | :---------------------------------------- |
|    R1 SOTA Ceiling    | 외부 리서치로 업계 천장 조사                          | docs/feasibility/ceiling.md               |
| R2 Goal Decomposition | 목표를 난이도 축으로 분해                             | (ceiling.md 내) 분해 매트릭스             |
| R3 Feasibility Spike  | GT로 내 데이터에서 실측 (버려질 스파이크 코드만 허용) | docs/feasibility/spike-\*.md              |
|   R4 3-Tier Verdict   | 🟢/🟡/🔴 못박기                                       | docs/feasibility/{project}.feasibility.md |
|      R5 GO/STOP       | 인간 결정 대기                                        | (feasibility.md 내) 결정 기록             |

### G-1 자동 발동 조건

- 목표에 절대 수식어 존재 → R1~R5 전수
- AI/ML 출력 정확도가 비즈니스 핵심 → R1~R5 전수
- "전 업계 미해결"로 들리는 목표 → R3 실측 BLOCKER
- 검증된 기술 조합(CRUD, 표준 SaaS) → R1 약식 (천장 자명, ceiling.md에 1줄 근거)

### 절대 하지 말 것 (G-1 위반)

- ❌ 천장 미조사 채 "가능합니다" / "어렵지 않습니다" 단언
- ❌ 한 문장 목표를 분해 없이 통째로 추진
- ❌ feasibility.md 없이 plan.md / contract.yaml 작성
- ❌ 🔴(불가) 조각에 미련 두고 우회 시도 (재정의 없이)
- ❌ R5 결정을 AI가 대신 내림
```

---

# 블록 B — feasibility.md / ceiling.md 표준 양식

```markdown
<!-- docs/feasibility/{project}.feasibility.md -->

# {프로젝트} 실현가능성 판정서 (G-1 Reality Gate)

## R1. SOTA Ceiling (업계 천장)

| 능력    | 업계 SOTA 수치 | 출처               | 천장 성격            |
| :------ | :------------- | :----------------- | :------------------- |
| {능력1} | {수치}         | {논문/서비스/벤치} | 해결됨 / 미해결 난제 |

목표 vs 천장: 목표는 천장 [위 🔴 / 근처 🟡 / 아래 🟢]에 위치.

## R2. Goal Decomposition (목표 분해 매트릭스)

축: {축1(예: 처리계층)} × {축2(예: 입력대상)} × {축3(예: 입력형식)}

| 대상    | 입력   | 산출물 실제 수준   |   판정   |
| :------ | :----- | :----------------- | :------: |
| {조각A} | {입력} | {정직한 수준 서술} | 🟢/🟡/🔴 |

가장 쉬운 조각: {🟢 후보} / 가장 어려운 조각: {🔴}

## R3. Feasibility Spike (실측 결과)

- GT 데이터: {MAESTRO/ASAP/자체 등}
- 측정 메트릭: {도메인 적합 정량 메트릭}
- 예측 수준(R2): {} / 실측 수준: {} / 일치 여부: {예/아니오}
- 인간 직접 소비 결과: {양호/불량}
- AI 자체 점수 사용 여부: ❌ (사용 금지)

## R4. 3-Tier Verdict

- 🟢 가능: {조각 목록} — "viable 도구"로 성립
- 🟡 부분: {조각 목록} — 정리비용/한계: {명시}
- 🔴 불가: {조각 목록} — "죽었다, 묻어라"

## R5. GO / STOP Decision (인간 단독)

- [ ] GO (전체) / [ ] 축소 GO (🟢만) / [ ] STOP
- 가치 판단 근거: {인간 기록}
- 결정자: {진산} / 날짜: {YYYY-MM-DD}
```

---

# 블록 C — pre-commit / hook 기계적 강제 (정공법)

> 도구 바인딩: pnpm 프로젝트 = **husky** 또는 **lefthook**, Python(ScoreForge) = **pre-commit**.
> 핵심 차단 3종: ① feasibility.md 없는 docs/ 진입 ② AI 산출물의 "가능합니다" 금지어 ③ 절대 수식어 미검증.

## C-1. feasibility.md 존재 강제 (lefthook 예시)

```yaml
# lefthook.yml
pre-commit:
  commands:
    g1-reality-gate:
      # docs/plans/ 또는 docs/contracts/ 에 신규 파일이 생기는데
      # docs/feasibility/ 가 비어있으면 → 차단 (TYPE-11 방어)
      run: |
        if git diff --cached --name-only | grep -qE '^docs/(plans|contracts)/'; then
          if [ ! -d docs/feasibility ] || [ -z "$(ls -A docs/feasibility 2>/dev/null)" ]; then
            echo "🚧 G-1 위반: feasibility.md 없이 plan/contract 작성 금지."
            echo "   docs/feasibility/{project}.feasibility.md 를 먼저 작성하라."
            exit 1
          fi
        fi
```

## C-2. AI 산출물 금지어 스캐너 (Node/TS, husky)

```javascript
// scripts/g1-forbidden-phrase.mjs — husky pre-commit에서 실행
import { execSync } from 'node:child_process';

// 스테이징된 .md/.research/.plan 문서에서 가능성 단언 금지어 탐지
const FORBIDDEN = [
  /가능합니다(?!\s*\(측정)/, // "가능합니다" (단, "가능합니다(측정..." 예외)
  /충분히\s*만들\s*수\s*있습니다/,
  /어렵지\s*않습니다/,
  /문제\s*없습니다/,
];
// 절대 수식어 + feasibility 미참조 동시 탐지
const ABSOLUTE = /(완전\s*자동|범용|시장\s*지배|출판급|전문가급)/;

const files = execSync('git diff --cached --name-only --diff-filter=ACM')
  .toString()
  .split('\n')
  .filter((f) => /\.(md|txt)$/.test(f) && /docs\/(research|plans|feasibility)/.test(f));

let violated = false;
for (const f of files) {
  let text;
  try {
    text = execSync(`git show :${f}`).toString();
  } catch {
    continue;
  }
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      console.error(`🚧 G-1 금지어 발견 (${f}): "${re}" — 천장 수치 없는 가능성 단언 금지.`);
      violated = true;
    }
  }
  if (ABSOLUTE.test(text) && !/ceiling\.md|SOTA|천장/.test(text)) {
    console.error(`🚧 G-1: 절대 수식어가 있으나 천장(SOTA) 근거 없음 (${f}).`);
    violated = true;
  }
}
process.exit(violated ? 1 : 0);
```

```jsonc
// package.json
{
  "scripts": {
    "g1:check": "node scripts/g1-forbidden-phrase.mjs",
  },
}
```

```bash
# .husky/pre-commit
pnpm g1:check
```

## C-3. Python 프로젝트 (ScoreForge 등) — pre-commit

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: g1-reality-gate
        name: G-1 Reality Gate (feasibility.md 존재 + 금지어)
        entry: python scripts/g1_check.py
        language: system
        files: '^docs/(research|plans|contracts|feasibility)/.*\.md$'
        pass_filenames: true
```

```python
# scripts/g1_check.py
import re, sys, pathlib

FORBIDDEN = [r"가능합니다(?!\s*\(측정)", r"충분히\s*만들\s*수\s*있", r"어렵지\s*않습니다"]
ABSOLUTE = re.compile(r"(완전\s*자동|범용|시장\s*지배|출판급|전문가급)")
feas_dir = pathlib.Path("docs/feasibility")
staged = [pathlib.Path(p) for p in sys.argv[1:]]

violated = False
# 1) plan/contract 진입 시 feasibility.md 존재 강제
if any(re.search(r"docs/(plans|contracts)/", str(p)) for p in staged):
    if not feas_dir.exists() or not any(feas_dir.glob("*.md")):
        print("🚧 G-1: feasibility.md 없이 plan/contract 작성 금지."); violated = True
# 2) 금지어 + 절대 수식어 검사
for p in staged:
    if not p.exists(): continue
    t = p.read_text(encoding="utf-8", errors="ignore")
    for pat in FORBIDDEN:
        if re.search(pat, t):
            print(f"🚧 G-1 금지어 ({p}): {pat}"); violated = True
    if ABSOLUTE.search(t) and not re.search(r"ceiling\.md|SOTA|천장", t):
        print(f"🚧 G-1 절대 수식어, 천장 근거 없음 ({p})"); violated = True
sys.exit(1 if violated else 0)
```

---

# 블록 D — CI 게이트 (배포 차단)

```yaml
# .github/workflows/g1-gate.yml 또는 Cloudflare CI 스텝
# 출시 불가 기준 #17: feasibility.md 없이 코딩된 흔적 차단
- name: G-1 Reality Gate Audit
  run: |
    if [ -d docs/plans ] && [ "$(ls -A docs/plans)" ]; then
      test -d docs/feasibility && [ "$(ls -A docs/feasibility)" ] || {
        echo "::error::G-1 BLOCKER — plan은 있으나 feasibility.md 없음 (TYPE-11 위험)"; exit 1; }
    fi
    # feasibility.md에 R5 GO/STOP 결정이 체크되었는지 확인
    for f in docs/feasibility/*.feasibility.md; do
      grep -qE '\[x\]\s*(GO|축소 GO|STOP)' "$f" || {
        echo "::error::$f — R5 GO/STOP 인간 결정 미기록"; exit 1; }
    done
```

---

# 한계 — 기계가 못 잡는 것 (인간 필수)

```
hook/linter가 잡는 것:   feasibility.md 존재 여부, 금지어 문자열, 절대 수식어
hook/linter가 못 잡는 것:
  ❌ ceiling.md의 SOTA 수치가 진짜인지 (AI가 천장을 날조할 수 있음)
  ❌ Feasibility Spike의 측정이 정직한지 (GT 조작 가능)
  ❌ R5 가치 판단이 옳은지

→ 이 셋은 인간(진산)이 직접 봐야 한다. 기계는 "절차 누락"을 막을 뿐,
  "측정의 진실성"은 못 막는다. G5.5 인간 검증 원칙이 여기서도 동일하게 적용된다.
```
