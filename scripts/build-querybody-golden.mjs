#!/usr/bin/env node
/**
 * 진산 결재 카드 #2 (A 채택 + 자료표 포함) 실행 — golden content 에서
 * **정답값 · 중복 정답표 · 출제자 해설** 만 제거하여 `queryBody`(출제 본문)를
 * 파생한다. 원본 `golden-pilot-approved.json` 은 **무변경**(읽기 전용).
 *
 * 무결성 가드 (측정 입력 = 북극성 채점 대상이므로 fabricate·왜곡 차단):
 *   1) 모든 제거 substring 은 원본 content 에 **정확히 존재**해야 함 (없으면 throw
 *      = transcription 오류 즉시 검출, silent miss 금지).
 *   2) 제거 후 queryBody 에 **정답 토큰이 남아 있으면 throw** (answer-leak 차단).
 *   3) queryBody 는 content 의 **부분집합**(제거만, 추가·수정 0) — 새 텍스트 주입 금지.
 *   4) 측정 파일에는 **queryBody ≤ 500 인 measurable 문항만** 포함 (route 400 차단).
 *      >500 잔존(Q-004 = 자료표 유지)은 로그에 "미회복" 정직 기록 후 측정서 제외.
 *
 * 산출:
 *   docs/plans/s5-6-measurements/golden-pilot-approved.querybody.json  (측정-ready)
 *   docs/plans/s5-6-measurements/querybody-removal-log.md             (감사 로그)
 *
 * 실행: node scripts/build-querybody-golden.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'docs', 'plans', 's5-6-measurements');
const SRC = join(DIR, 'golden-pilot-approved.json');

const MAX_QUERY = 500; // graph-search-route.ts:79 query.max(500)

/**
 * 문항별 제거 규칙 (진산 §6 정책: 정답값·중복정답표·해설 제거 / 자료표·발문·빈칸 유지).
 * removals = content 에서 잘라낼 정확한 substring. leakTokens = 제거 후 남으면 안 되는 정답 토큰.
 * 단일-hop LAW 3건(Q-031, Q-2022-08-045, Q-2023-09-045)은 정답/해설 미내장 → 규칙 없음(content=queryBody).
 */
const RULES = {
  'Q-2025-11-2ND-012': {
    removals: [
      '①결실완료 ( 본문: 결실 완료 직후부터 수확전 )\n②정아발아 (별표 : 수확완료시점 ~ 수확완료전)\n③개화 (별표 : 수확완료전)\n④수확 (주품종 수확) - 복수정답\n',
      '※ 이론서 103페이지의 표의 내용을 기준으로 출제되었으나 본문 및 별표기준과 달\n라 복수정답으로 인정되어야 한다. 출제자가 이론서의 내용 전체를 숙지 하고 있\n었다면 이런 문제를 출제 할수 없었을 것이다.\n',
    ],
    leakTokens: ['결실완료', '정아발아', '이론서 103'],
    note: '정답 매핑(①결실완료 등) + 출제자 해설 제거. 빈칸 표((①)후 오디만 해당 …)는 본문이므로 유지.',
  },
  'Q-2025-11-2ND-004': {
    removals: [' ➡ 역병', ' ➡ 시들음병'],
    leakTokens: ['➡'],
    note: '물음 정답값(➡ 역병/시들음병)만 제거. 고추·감자 병충해 등급표(자료표)는 진산 결정대로 유지 → 잔존 길이 >500(미회복).',
  },
  'Q-2025-11-2ND-014': {
    removals: [
      '파이널 특강 적중\n',
      '대상품목\n수확량 조사적기\n고구마\n고구마의 비대가 종료된 시점\n(삽식일로부터 ( ①120 )일 이후)에 농지별로 적용\n감자\n(가을재배)\n감자의 비대가 종료된 시점\n(파종일로부터 제주지역( ②110 )일 이후, 이외 지역은 ( ③95 )일 이후)\n차\n조사 가능일 직전 수확이 가능할 정도의 크기 (신초장 ( ④4.8 ) cm이상\n엽장 ( ⑤2.8 ) cm 이상 엽폭 0.9 cm 이상)로 자란 시기',
    ],
    leakTokens: ['①120', '②110', '③95', '④4.8', '⑤2.8'],
    note: '중복 정답표(②번째 표 = 빈칸에 정답값 채운 판) + 강의 광고("파이널 특강 적중") 제거. 첫 빈칸표(자료표)는 유지.',
  },
  'Q-2025-11-2ND-015': {
    removals: [
      '- 복수정답 처리되어야함\n',
      '■ 같은날 사고로 보는 경우\n물음 1) 20,000,000 - 400,000 = 19,600,000원\n물음 2) 15,000,000 - 300,000 = 14,700,000원\n물음 3) 15,000,000 - 300,000 = 14,700,000원\n■ 각각 다른날 발생한 사고로 보는 경우\n물음 1) 20,000,000 - 1,000,000 = 19,000,000원\n물음 2) 15,000,000 - 1,000,000 = 14,000,000원\n물음 3) 15,000,000 - 1,000,000 = 14,000,000원\n',
      '※ 농업용 시설물의 경우 자기부담금액은 1단지, 1사고 단위로 적용한다. 같은날 사고\n의 경우 자기부담금액을 안분하는 규정은 농업용 시설물과 부대시설에 한하여 안\n분하는 규정이 있으나 각 목적물별 자기부담금액을 안분하는 규정은 없다. 그러나\n1사고 단위로 자기부담금액을 적용한다는 의미 자체가 각 동별로 자기부담금액을\n공제하라는 의미 이므로 출제자는 같은날 사고로 보고 출제한 것으로 보인다\n',
    ],
    leakTokens: ['19,600,000', '14,700,000', '자기부담금액을 안분'],
    note: '워크드 풀이(= 정답값) + 출제자 해설 제거. 발문·물음1/2/3·조건(※ 피복재단독사고 아님)·목적물 표(자료표)는 유지.',
  },
};

/** 다중 공백/개행 정리 — 제거로 생긴 빈 줄만 접고, 내용은 불변. */
function normalize(s) {
  return s
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n+$/g, '')
    .replace(/^\n+/g, '')
    .trim();
}

function buildBody(questionId, content) {
  const rule = RULES[questionId];
  if (!rule) return { queryBody: content, removed: [], note: '정답/해설 미내장 — content 그대로(변경 0).' };
  let body = content;
  const removed = [];
  for (const r of rule.removals) {
    if (!body.includes(r)) {
      throw new Error(`[${questionId}] 제거 substring 불일치(transcription 오류): ${JSON.stringify(r.slice(0, 40))}…`);
    }
    body = body.split(r).join('');
    removed.push(r);
  }
  body = normalize(body);
  // answer-leak 가드: 제거 후 정답 토큰 잔존 시 throw.
  for (const tok of rule.leakTokens ?? []) {
    if (body.includes(tok)) {
      throw new Error(`[${questionId}] answer-leak: queryBody 에 정답 토큰 "${tok}" 잔존`);
    }
  }
  // 부분집합 가드: queryBody 의 모든 비공백 문자가 원본에 있어야(추가 텍스트 0).
  //   (normalize 가 공백만 건드리므로 비공백 시퀀스는 원본 부분열)
  return { queryBody: body, removed, note: rule.note };
}

const src = JSON.parse(readFileSync(SRC, 'utf-8'));
const measurable = src.items.filter((it) => it.relatedNodesRaw);

const rows = [];
for (const it of measurable) {
  const { queryBody, removed, note } = buildBody(it.questionId, it.content);
  rows.push({
    questionId: it.questionId,
    subject: it.meta?.subject ?? '',
    hop: it.hopGuess,
    origLen: it.content.length,
    bodyLen: queryBody.length,
    le500: queryBody.length <= MAX_QUERY,
    expectedCount: JSON.parse(it.relatedNodesRaw).length,
    removed,
    note,
    content: it.content,
    queryBody,
    relatedNodesRaw: it.relatedNodesRaw,
  });
}

// 측정 파일: queryBody ≤500 인 measurable 만 (content 자리에 queryBody 주입 → runner drop-in).
const measureItems = rows
  .filter((r) => r.le500)
  .map((r) => ({ questionId: r.questionId, content: r.queryBody, relatedNodesRaw: r.relatedNodesRaw }));
const over500 = rows.filter((r) => !r.le500).map((r) => r.questionId);

const outJson = {
  $schema: 'S5-6b golden pilot — queryBody(출제 본문) 측정 입력 (결재 카드 #2 A안 / 자료표 포함)',
  status:
    'derived — 독립검증 5/5 PASS (wf_f5b13834, CRITICAL 0 / MAJOR 0 / MINOR 6 처리). 진산 queryBody 확인 완료(2026-06-04: "그냥 출제된 문제" = 본문 정확, 정답·해설 분리 적정). REMOTE 인증(THEPICK_API_BASE)만 잔여 = 측정 게이트.',
  verification:
    '독립 에이전트 5(추출 answer-leak/content-loss/정책·순환편향 3렌즈 + 러너 4-Pass 2패스) 2026-06-04: answer-VALUE leak 0 / content-loss 0 / 순환편향(채점층) 0 / 정답지(relatedNodesRaw) 바이트 무변경. 잔여 = expected 명칭-동형 편향(결재 큐 #6, queryBody 층 해결불가 — 재측정 해석 각주). 상세 .claude/reviews/review-20260604-145408-querybody-runner-verify.md',
  derivedFrom: 'golden-pilot-approved.json (진산 검수 동결분, 무변경)',
  policy:
    '결재 카드 #2 (2026-06-04, 진산): A 채택 + 자료표 포함. query = 발문+보기+빈칸+자료표, 제외 = 정답값·중복정답표·해설. 변환 = scripts/build-querybody-golden.mjs (결정적·제거전용·answer-leak 가드).',
  examId: src.examId,
  measurementSubset: `queryBody ≤${MAX_QUERY} measurable 만 (route 400 차단). 측정 분모 = ${measureItems.length} (was 4).`,
  excludedStillOver500: over500,
  items: measureItems,
  coverageNote:
    `REMOTE G-S5 pilot golden — queryBody 판(결재 #2). measurable ${measureItems.length} 측정 (Q-2025-11-2ND-004 자료표 유지로 ${rows.find((r) => r.questionId === 'Q-2025-11-2ND-004')?.bodyLen}자 = 여전히 >500 미회복). N=12 워터마크 — 방법론·신호 방향 검증용, 통계 일반화 아님. 손해평가 도메인 한정.`,
};
writeFileSync(join(DIR, 'golden-pilot-approved.querybody.json'), JSON.stringify(outJson, null, 2));

// 감사 로그 (per-item original→body, 제거 substring, 길이, ≤500).
const log = [];
log.push('# queryBody 파생 감사 로그 — 결재 카드 #2 (A 채택 + 자료표 포함)');
log.push('');
log.push('> 변환: `scripts/build-querybody-golden.mjs` (결정적·제거전용). 원본 `golden-pilot-approved.json` 무변경.');
log.push('> 가드: 제거 substring 존재 assert + answer-leak 토큰 잔존 throw + 제거후 ≤500 만 측정.');
log.push('');
log.push('## 회복 요약');
log.push('');
log.push('| 문항 | hop | 원본 길이 | queryBody 길이 | ≤500 | 측정 | expected |');
log.push('| :-- | :-- | --: | --: | :-- | :-- | --: |');
for (const r of rows) {
  log.push(
    `| ${r.questionId} | ${r.hop} | ${r.origLen} | ${r.bodyLen} | ${r.le500 ? '✅' : '⛔'} | ${r.le500 ? '측정' : '제외(>500)'} | ${r.expectedCount} |`,
  );
}
log.push('');
log.push(`측정 분모 measurable: **4 → ${measureItems.length}** (회복: ${rows.filter((r) => r.le500 && (r.questionId === 'Q-2025-11-2ND-014' || r.questionId === 'Q-2025-11-2ND-015')).map((r) => r.questionId).join(', ')}).`);
log.push(`여전히 >500 (자료표 유지): ${over500.join(', ') || '없음'}.`);
log.push('');
log.push('## 문항별 변환 상세');
for (const r of rows) {
  log.push('');
  log.push(`### ${r.questionId} (${r.subject}, hop=${r.hop}) — ${r.origLen}자 → ${r.bodyLen}자 ${r.le500 ? '✅측정' : '⛔제외'}`);
  log.push('');
  log.push(`- **정책 적용**: ${r.note}`);
  if (r.removed.length === 0) {
    log.push('- **제거**: 없음 (정답/해설 미내장).');
  } else {
    log.push('- **제거된 segment** (정답값·중복표·해설):');
    for (const rm of r.removed) {
      const oneLine = rm.replace(/\n/g, ' ⏎ ').trim();
      log.push(`  - \`${oneLine.length > 120 ? oneLine.slice(0, 120) + '…' : oneLine}\``);
    }
  }
  log.push('- **queryBody (측정 입력)**:');
  log.push('```');
  log.push(r.queryBody);
  log.push('```');
}
writeFileSync(join(DIR, 'querybody-removal-log.md'), log.join('\n'));

// 콘솔 요약 (성공만 조용히 — 수치 해석/판정은 진산).
process.stdout.write('=== queryBody 파생 완료 (제거전용·answer-leak 가드 통과) ===\n');
process.stdout.write(`측정 분모 measurable: 4 → ${measureItems.length}\n`);
for (const r of rows) {
  process.stdout.write(
    `  ${r.questionId.padEnd(20)} ${String(r.origLen).padStart(4)} → ${String(r.bodyLen).padStart(4)}  ${r.le500 ? '✅측정' : '⛔>500제외'}  (hop=${r.hop})\n`,
  );
}
process.stdout.write(`측정 제외(>500 잔존): ${over500.join(', ') || '없음'}\n`);
process.stdout.write('[written] golden-pilot-approved.querybody.json / querybody-removal-log.md\n');
