#!/usr/bin/env node
// scripts/g1-forbidden-phrase.mjs
// ─────────────────────────────────────────────────────────────────────────────
// G-1 Reality Gate 기계강제 (VOID DEV UNIFIED CONSTITUTION v3.6 — docs/consti/).
//
// 목적: TYPE-11(Feasibility Sycophancy) 차단. "되지도 않을 목표를 천장 조사 없이
//       '가능합니다'로 동조"하는 순간을 커밋 단계에서 기계가 막는다.
//       헌법 §하네스: "텍스트는 advisory, 기계가 차단해야 진짜 규칙."
//
// 스캔 대상: 스테이징된 docs/{research,plans,feasibility}/**.md|txt 의 *새로 추가된 줄*.
// ★ added-lines only — 레거시 문서(기존 plan 61개)는 건드리지 않는다 (오탐 0).
//   기존 줄을 새로 추가/수정하지 않는 한 트립하지 않음.
//
// 차단 규칙:
//   ① 가능성 단언 금지어 (FORBIDDEN) — 무조건 차단
//   ② 절대 수식어 (ABSOLUTE) — 같은 파일에 천장/SOTA 근거 없으면 차단
//      ('범용'은 ThePick '범용 계층'(Hard Rule 15~17) 정당 용어라 제외)
//   ③ docs/{plans,contracts} 진입 시 docs/feasibility/*.md 존재 강제 (블록 C-1)
//
// 우회(정당): "가능합니다(측정: 근거)" 형식 / 절대수식어는 ceiling.md 근거 동반.
//
// 보안: execFileSync(인자 배열, 셸 미경유) — 악의적 파일명 셸 인젝션 차단.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const FORBIDDEN = [
  { re: /가능합니다(?!\s*\(측정)/, label: '가능합니다 (천장 측정 없는 단언)' },
  { re: /충분히\s*만들\s*수\s*있/, label: '충분히 만들 수 있다' },
  { re: /어렵지\s*않습니다/, label: '어렵지 않습니다' },
  { re: /문제\s*없습니다/, label: '문제 없습니다' },
];
const ABSOLUTE = /(완전\s*자동|시장\s*지배|출판급|전문가급)/;
const CEILING_REF = /천장|SOTA|ceiling\.md|feasibility/;
const SCAN_DIR = /docs\/(research|plans|feasibility)\//;

// 셸 미경유: 인자는 git 에 리터럴 전달 (메타문자·공백·한글 파일명 안전)
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

let staged;
try {
  staged = git('diff', '--cached', '--name-only', '--diff-filter=ACM').split('\n').filter(Boolean);
} catch {
  process.exit(0); // git 컨텍스트 아님 → 통과
}

let violated = false;

// 블록 C-1: plan/contract 작성 시 feasibility.md 존재 강제
if (staged.some((f) => /docs\/(plans|contracts)\//.test(f))) {
  const dir = 'docs/feasibility';
  const ok = existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.md'));
  if (!ok) {
    console.error('🚧 G-1: feasibility.md 없이 plan/contract 작성 금지.');
    console.error('   docs/feasibility/{project}.feasibility.md 를 먼저 작성하라 (현실 판정이 코드베이스 분석보다 먼저).');
    violated = true;
  }
}

// 블록 C-2: 새로 추가된 줄에서 금지어 + 절대 수식어
const targets = staged.filter((f) => /\.(md|txt)$/.test(f) && SCAN_DIR.test(f));
for (const f of targets) {
  let added, fileText;
  try {
    added = git('diff', '--cached', '-U0', '--', f)
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1));
    fileText = git('show', `:${f}`);
  } catch {
    continue;
  }
  const hasCeiling = CEILING_REF.test(fileText);
  for (const line of added) {
    for (const { re, label } of FORBIDDEN) {
      if (re.test(line)) {
        console.error(`🚧 G-1 금지어 (${f}): "${label}"`);
        console.error(`   → ${line.trim()}`);
        console.error('   천장 수치 없는 가능성 단언 금지. SOTA 천장 조사 후 🟢/🟡/🔴로 못박아라.');
        violated = true;
      }
    }
    if (ABSOLUTE.test(line) && !hasCeiling) {
      console.error(`🚧 G-1 절대 수식어 (${f}): "${line.trim()}"`);
      console.error('   절대 수식어(완전자동/시장지배/출판급/전문가급)는 ceiling.md 천장 근거 동반 의무.');
      violated = true;
    }
  }
}

if (violated) {
  console.error('\n❌ G-1 Reality Gate 차단 (헌법 v3.6, docs/consti/).');
  console.error('   우회: 천장 근거 추가 / "가능합니다(측정: ...)" 형식 / 표현 정정.');
  process.exit(1);
}
process.exit(0);
