/**
 * golden 빌더 일반화 테스트 (MASTER_PLAN 4c / Binary Gate G-WS4 ②)
 *
 * 검증 축:
 *   A) byte-동치 — 일반 분리기가 파생한 제거 segment 가 구(舊) 하드코딩 RULES
 *      removals 와 문항별로 완전 동일 + 산출 JSON 이 커밋 동결분과 동일.
 *   B) G-WS4 ② — 신규 문항 픽스처 1건을 per-ID 규칙 추가 없이 처리.
 *   C) 3대 불변식 — 제거전용(부분집합) / 결정적 / answer-leak assert.
 *
 * 실행: pnpm test:scripts  (= node --test scripts/__tests__/*.test.mjs — 디렉토리 인자는 MODULE_NOT_FOUND)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBody,
  buildOutputs,
  deriveRemovalSegments,
  assertNoAnswerLeak,
  MANUAL_OVERRIDE_RULES,
  RULE_CLASS,
  SRC,
} from '../build-querybody-golden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MEASURE_DIR = join(HERE, '..', '..', 'docs', 'plans', 's5-6-measurements');

const src = JSON.parse(readFileSync(SRC, 'utf-8'));
const itemById = new Map(src.items.map((it) => [it.questionId, it]));
const fixture = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'querybody-newq-fixture.json'), 'utf-8'));

/**
 * GT — 구 하드코딩 RULES 의 removals 전사본 (git 8361ea4 scripts/build-querybody-golden.mjs:36-67
 * = querybody-removal-log.md 문항별 제거 segment 와 동일물). 일반 분리기의 byte-동치 기준점.
 */
const GT_REMOVALS = {
  'Q-2025-11-2ND-012': [
    '①결실완료 ( 본문: 결실 완료 직후부터 수확전 )\n②정아발아 (별표 : 수확완료시점 ~ 수확완료전)\n③개화 (별표 : 수확완료전)\n④수확 (주품종 수확) - 복수정답\n',
    '※ 이론서 103페이지의 표의 내용을 기준으로 출제되었으나 본문 및 별표기준과 달\n라 복수정답으로 인정되어야 한다. 출제자가 이론서의 내용 전체를 숙지 하고 있\n었다면 이런 문제를 출제 할수 없었을 것이다.\n',
  ],
  'Q-2025-11-2ND-004': [' ➡ 역병', ' ➡ 시들음병'],
  'Q-2025-11-2ND-014': [
    '파이널 특강 적중\n',
    '대상품목\n수확량 조사적기\n고구마\n고구마의 비대가 종료된 시점\n(삽식일로부터 ( ①120 )일 이후)에 농지별로 적용\n감자\n(가을재배)\n감자의 비대가 종료된 시점\n(파종일로부터 제주지역( ②110 )일 이후, 이외 지역은 ( ③95 )일 이후)\n차\n조사 가능일 직전 수확이 가능할 정도의 크기 (신초장 ( ④4.8 ) cm이상\n엽장 ( ⑤2.8 ) cm 이상 엽폭 0.9 cm 이상)로 자란 시기',
  ],
  'Q-2025-11-2ND-015': [
    '- 복수정답 처리되어야함\n',
    '■ 같은날 사고로 보는 경우\n물음 1) 20,000,000 - 400,000 = 19,600,000원\n물음 2) 15,000,000 - 300,000 = 14,700,000원\n물음 3) 15,000,000 - 300,000 = 14,700,000원\n■ 각각 다른날 발생한 사고로 보는 경우\n물음 1) 20,000,000 - 1,000,000 = 19,000,000원\n물음 2) 15,000,000 - 1,000,000 = 14,000,000원\n물음 3) 15,000,000 - 1,000,000 = 14,000,000원\n',
    '※ 농업용 시설물의 경우 자기부담금액은 1단지, 1사고 단위로 적용한다. 같은날 사고\n의 경우 자기부담금액을 안분하는 규정은 농업용 시설물과 부대시설에 한하여 안\n분하는 규정이 있으나 각 목적물별 자기부담금액을 안분하는 규정은 없다. 그러나\n1사고 단위로 자기부담금액을 적용한다는 의미 자체가 각 동별로 자기부담금액을\n공제하라는 의미 이므로 출제자는 같은날 사고로 보고 출제한 것으로 보인다\n',
  ],
};

/** 부분집합(제거전용) 검사 — queryBody 의 문자열이 content 의 부분열(순서 보존)인가 */
function isSubsequenceIgnoringWhitespace(body, content) {
  const strip = (s) => s.replace(/\s+/g, '');
  const b = strip(body);
  const c = strip(content);
  let ci = 0;
  for (const ch of b) {
    ci = c.indexOf(ch, ci);
    if (ci === -1) return false;
    ci++;
  }
  return true;
}

// ── A) byte-동치 (기존 12문항 = 구 하드코딩판과 완전 동일) ──────────────────

test('GT byte-동치: 규칙 보유 4문항의 파생 segment = 구 RULES removals 와 완전 동일', () => {
  for (const [qid, gtRemovals] of Object.entries(GT_REMOVALS)) {
    const { removed } = buildBody(qid, itemById.get(qid).content);
    assert.deepEqual(removed, gtRemovals, `${qid} 제거 segment 불일치`);
  }
});

test('단일-hop LAW 3건: 정답/해설 미내장 → content 무변경 passthrough', () => {
  for (const qid of ['Q-2019-05-031', 'Q-2022-08-045', 'Q-2023-09-045']) {
    const content = itemById.get(qid).content;
    const { queryBody, removed } = buildBody(qid, content);
    assert.equal(queryBody, content, `${qid} content 변형 발생`);
    assert.deepEqual(removed, []);
  }
});

test('산출 전체 동치: buildOutputs(원본 golden) = 커밋 동결 querybody.json', () => {
  const { outJson } = buildOutputs(src);
  const committed = JSON.parse(
    readFileSync(join(MEASURE_DIR, 'golden-pilot-approved.querybody.json'), 'utf-8'),
  );
  assert.deepEqual(outJson, committed, '재생성 outJson ≠ 커밋본');
  assert.equal(
    JSON.stringify(outJson, null, 2),
    JSON.stringify(committed, null, 2),
    '직렬화 문자열 불일치',
  );
});

// ── B) G-WS4 ② — 신규 문항을 per-ID 규칙 추가 없이 처리 ─────────────────────

test('G-WS4 ②: 신규 문항 픽스처 — MANUAL_OVERRIDE 0건으로 6클래스 전부 분리', () => {
  assert.equal(
    Object.keys(MANUAL_OVERRIDE_RULES).length,
    0,
    '예외 명단은 현재 0건이어야 함 (일반 규칙 전담 입증)',
  );
  assert.ok(!(fixture.questionId in MANUAL_OVERRIDE_RULES));

  const segments = deriveRemovalSegments(fixture.content);
  assert.deepEqual(
    segments.map((s) => s.ruleClass),
    fixture.expectedRuleClasses,
    '제거 클래스 시퀀스 불일치',
  );

  const { queryBody, removed, note } = buildBody(fixture.questionId, fixture.content);
  assert.deepEqual(removed, fixture.expectedRemoved, '제거 segment 불일치');
  assert.equal(queryBody, fixture.expectedQueryBody, 'queryBody 불일치');
  assert.match(note, /^일반 분리기 적용/, '미등재 문항은 클래스 기반 자동 문구여야 함');
});

test('보존 대상: 해설 어휘 없는 ※ 출제 조건 라인은 본문 유지', () => {
  const q015 = buildBody('Q-2025-11-2ND-015', itemById.get('Q-2025-11-2ND-015').content);
  assert.ok(q015.queryBody.includes('※ 금번 사고는 피복재단독사고 아님.'), 'Q-015 조건 ※ 소실');
  const fx = buildBody(fixture.questionId, fixture.content);
  assert.ok(fx.queryBody.includes('※ 주어진 조건 외는 고려하지 않음.'), '픽스처 조건 ※ 소실');
});

// ── C) 3대 불변식 — 제거전용 / 결정적 / answer-leak assert ──────────────────

test('불변식 1 제거전용: 전 measurable + 픽스처 queryBody 는 원본의 부분열 (주입 0)', () => {
  const targets = [
    ...src.items.filter((it) => it.relatedNodesRaw).map((it) => [it.questionId, it.content]),
    [fixture.questionId, fixture.content],
  ];
  for (const [qid, content] of targets) {
    const { queryBody } = buildBody(qid, content);
    assert.ok(isSubsequenceIgnoringWhitespace(queryBody, content), `${qid} 부분집합 위반`);
  }
});

test('불변식 2 결정적: 동일 입력 2회 → 동일 출력', () => {
  for (const [qid, content] of [
    ['Q-2025-11-2ND-015', itemById.get('Q-2025-11-2ND-015').content],
    [fixture.questionId, fixture.content],
  ]) {
    assert.deepEqual(buildBody(qid, content), buildBody(qid, content), `${qid} 비결정적 출력`);
  }
});

test('불변식 3 answer-leak assert: 일반 패턴 + per-ID 토큰 잔존 시 throw', () => {
  assert.throws(() => assertNoAnswerLeak('T', '남은 마커 ➡ 정답', []), /answer-leak.*➡/);
  assert.throws(() => assertNoAnswerLeak('T', '채워진 ( ①120 ) 빈칸', []), /answer-leak/);
  assert.throws(() => assertNoAnswerLeak('T', '물음 1) 계산 = 19,600,000원', []), /answer-leak/);
  assert.throws(() => assertNoAnswerLeak('T', '복수정답 어휘 잔존', []), /answer-leak/);
  assert.throws(() => assertNoAnswerLeak('T', '무해 본문', ['무해']), /정답 토큰 "무해" 잔존/);
  assert.doesNotThrow(() => assertNoAnswerLeak('T', '빈칸 ( ① ) 과 보기 ①. 항목', []));
});

test('가드: 파생 segment 가 원본에 2회 이상 존재하면 모호성 throw (silent 오제거 차단)', () => {
  const ambiguous = [
    '발문입니다. 다음 물음에 답하시오. (5점)',
    '- 복수정답 처리되어야함',
    '본문 자료 한 줄',
    '- 복수정답 처리되어야함',
    '마지막 본문 줄입니다.',
  ].join('\n');
  assert.throws(() => buildBody('Q-AMBIGUOUS-TEST', ambiguous), /다중 발생.*모호성/);
});

test('가드: 중복 판 증거 없는 채워진 빈칸은 제거하지 않고 leak throw (수동 예외 강제)', () => {
  const noEvidence = [
    '발문입니다. ( )에 들어갈 내용을 쓰시오. (5점)',
    '적과 종료 후 ( ①10 )일 이내', // 빈칸 원형 선행 부재 → 중복 정답표 아님 → 제거 보류
  ].join('\n');
  assert.throws(() => buildBody('Q-NO-EVIDENCE-TEST', noEvidence), /answer-leak.*채워진 빈칸/);
});

/* ── 2026-07-02 5-페르소나 리뷰 과제거(over-removal) 가드 회귀 (MAJOR-1·2·3) ── */

test('과제거 가드 1: 빈칸 원형 증거 없는 직결 서식 보기(①텍스트)는 본문 유지', () => {
  const mcQuestion = [
    '다음 중 보험의 목적에 관한 설명으로 옳지 않은 것은? (5점)',
    '①보험의 목적',
    '②보험가액',
    '③보험금액',
    '④보험기간',
  ].join('\n');
  const { queryBody, removed } = buildBody('Q-MC-CHOICE-TEST', mcQuestion);
  assert.equal(removed.length, 0, '보기 4줄은 제거 대상이 아니다');
  for (const choice of ['①보험의 목적', '②보험가액', '③보험금액', '④보험기간']) {
    assert.ok(queryBody.includes(choice), `보기 "${choice}" 는 본문으로 유지`);
  }
});

test('과제거 가드 2: 연산 증거 없는 조건 줄(명사구 = 값원)은 무음 제거 대신 leak throw (인간 판정 강제)', () => {
  const withCondition = [
    '다음 계약사항을 참조하여 보험금을 구하시오. (15점)',
    '○ 계약사항',
    '보험가입금액 = 20,000,000원',
    '자기부담비율: 20%',
  ].join('\n');
  // 분류기는 제거하지 않는다(무음 소실 차단) — 광역 leak 가드가 throw 로 표면화.
  assert.throws(() => buildBody('Q-CONDITION-TEST', withCondition), /워크드 풀이 결과값/);
  // 인간 검수 후 allowGenericLeaks 등재 시에만 보존 통과 (MANUAL_OVERRIDE 보존 경로).
  MANUAL_OVERRIDE_RULES['Q-CONDITION-TEST'] = {
    allowGenericLeaks: ['워크드 풀이 결과값'],
    reason: '테스트 — 자료표 조건 줄은 본문 (인간 검수 가정)',
  };
  try {
    const { queryBody } = buildBody('Q-CONDITION-TEST', withCondition);
    assert.ok(queryBody.includes('보험가입금액 = 20,000,000원'), '검수 후 조건 줄 보존');
  } finally {
    delete MANUAL_OVERRIDE_RULES['Q-CONDITION-TEST'];
  }
});

test('과제거 가드 3: 중복 정답표 구간 내 비중복 고유 본문은 무음 소실 대신 throw', () => {
  const dupWithUnique = [
    '빈칸을 채우시오. (5점)',
    '대상품목',
    '(삽식일로부터 ( ① )일 이후)에 적용',
    '(삽식일로부터 ( ①120 )일 이후)에 적용',
    '★고유 본문 조건: 표본구간은 4구간 이상 선정한다.',
    '(파종일로부터 ( ②95 )일 이후)에 적용',
  ].join('\n');
  assert.throws(() => buildBody('Q-DUP-UNIQUE-TEST', dupWithUnique), /비중복 본문 줄 발견/);
});
