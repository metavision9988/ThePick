#!/usr/bin/env node
/**
 * 진산 결재 카드 #2 (A 채택 + 자료표 포함) 실행 — golden content 에서
 * **정답값 · 중복 정답표 · 출제자 해설** 만 제거하여 `queryBody`(출제 본문)를
 * 파생한다. 원본 `golden-pilot-approved.json` 은 **무변경**(읽기 전용).
 *
 * ★ MASTER_PLAN 4c "golden 빌더 일반화" (2026-07-02 일괄 결재 집행):
 *   기존 문항 ID 하드코딩 RULES(제거 substring 전사본) → **일반화된 정답/해설
 *   분리기**(결재 #2 §6 정책의 기계화 — 아래 §1~§2). 신규 문항은 per-ID 규칙
 *   추가 없이 처리 (Binary Gate G-WS4 ②, 테스트 scripts/__tests__/ 동봉).
 *   per-ID 명단은 §3 의 예외 폴백(MANUAL_OVERRIDE_RULES, 현재 0건)과
 *   검증 전용 데이터(LEAK_TOKEN_ASSERTIONS·POLICY_NOTES)로만 잔존.
 *   기존 12문항 산출은 하드코딩판과 **byte-동치**(동치 테스트 + diff 검증).
 *
 * 무결성 가드 (측정 입력 = 북극성 채점 대상이므로 fabricate·왜곡 차단):
 *   1) 모든 제거 segment 는 원본 content 에 **정확히 1회 존재**해야 함 (없으면
 *      throw = 파생 오류 즉시 검출 / 2회 이상이면 throw = 모호성 → 예외 명단 요구).
 *   2) 제거 후 queryBody 에 **정답 토큰이 남아 있으면 throw** (answer-leak 차단
 *      — per-ID 토큰 + 일반 패턴(➡·채워진 빈칸·워크드 결과값·해설 어휘) 이중).
 *   3) queryBody 는 content 의 **부분집합**(제거만, 추가·수정 0) — segment 는
 *      content 에서 파생되고 변환은 split/join 제거뿐이므로 새 텍스트 주입 불가.
 *   4) 측정 파일에는 **queryBody ≤ 500 인 measurable 문항만** 포함 (route 400 차단).
 *      >500 잔존(Q-004 = 자료표 유지)은 로그에 "미회복" 정직 기록 후 측정서 제외.
 *
 * 산출:
 *   docs/plans/s5-6-measurements/golden-pilot-approved.querybody.json  (측정-ready)
 *   docs/plans/s5-6-measurements/querybody-removal-log.md             (감사 로그)
 *   ※ 커밋본은 lint-staged prettier 경유 포맷 (json 배열 개행·md 표 패딩·EOF 개행).
 *
 * 실행: node scripts/build-querybody-golden.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'docs', 'plans', 's5-6-measurements');
export const SRC = join(DIR, 'golden-pilot-approved.json');

// 공개 계약 상한 — 정본 = graph-search-route.ts GRAPH_QUERY_PUBLIC_MAX_LENGTH(500).
const MAX_QUERY = 500;
// 디버그(측정) 경로 상한 — 정본 = graph-search-route.ts GRAPH_QUERY_DEBUG_MAX_LENGTH(2000).
// G-WS4 ④: >500 문항(Q-004)은 debug 측정 파일로만 포함, 러너 --debug 와 짝 (리뷰 MAJOR-5).
const DEBUG_MAX_QUERY = 2000;

/* ────────────────────────────────────────────────────────────────────────────
 * §1 일반 분리기 — 판별 상수 (결재 #2 §6: 포함=발문+보기+빈칸+자료표 /
 *    제외=정답값+중복 정답표+출제자 해설. 각 상수는 GT(querybody-removal-log.md
 *    문항별 제거 segment)에서 역도출한 표면 패턴이며, 미스매치는 가드 1)·2)가
 *    silent 처리 대신 throw 로 노출한다.)
 * ──────────────────────────────────────────────────────────────────────────── */

/** 제거 규칙 클래스 (감사 로그·테스트 식별용) */
export const RULE_CLASS = Object.freeze({
  INLINE_ANSWER: 'inline-answer', //     '… 쓰시오. ➡ 역병' 의 ➡ 정답값 (줄 끝까지)
  ANSWER_KEY_LINE: 'answer-key-line', // '①결실완료 (…)' — 보기('①. ')와 달리 값 직결
  NOISE_LINE: 'noise-line', //           '파이널 특강 적중' — 강의 광고 삽입 텍스트
  COMMENTARY_LINE: 'commentary-line', // '- 복수정답 처리되어야함' — 출제자 주석 단행
  WORKED_SOLUTION: 'worked-solution', // '물음 1) 20,000,000 - 400,000 = 19,600,000원'
  COMMENTARY_BLOCK: 'commentary-block', // '※ 이론서 103페이지의 … 것이다.' 해설 문단
  DUP_ANSWER_TABLE: 'dup-answer-table', // 빈칸표를 정답값으로 채운 중복 판
  MANUAL_OVERRIDE: 'manual-override', //  §3 예외 명단 경유 (일반 규칙 오분류 시만)
});

const RULE_CLASS_LABEL = Object.freeze({
  [RULE_CLASS.INLINE_ANSWER]: '인라인 정답값(➡)',
  [RULE_CLASS.ANSWER_KEY_LINE]: '정답 매핑 라인(①값…)',
  [RULE_CLASS.NOISE_LINE]: '강의 노이즈 라인',
  [RULE_CLASS.COMMENTARY_LINE]: '출제자 주석 라인',
  [RULE_CLASS.WORKED_SOLUTION]: '워크드 풀이(정답값)',
  [RULE_CLASS.COMMENTARY_BLOCK]: '출제자 해설 블록(※)',
  [RULE_CLASS.DUP_ANSWER_TABLE]: '중복 정답표(빈칸 채운 판)',
  [RULE_CLASS.MANUAL_OVERRIDE]: '수동 예외 규칙',
});

// 줄 안 '➡ <정답값>' — 마커 앞 공백부터 줄 끝까지가 정답값 (GT: Q-004 ' ➡ 역병')
const INLINE_ANSWER_RE = /[ \t]*➡.*$/;
// 줄 시작 원형숫자에 값이 직결('①결실완료')된 정답 매핑. 보기 서식 '①. '/빈칸 '( ① )' 는 비매치.
// ★과제거 가드(5-페르소나 리뷰 2026-07-02 MAJOR-1): 같은 표면형이 4지선다 직결 보기('①보험의
//   목적')일 수 있다 — content 에 해당 번호의 빈칸 원형 '(①)' 이 존재할 때만 "빈칸 정답 매핑"으로
//   제거한다 (증거 기반). 증거 없으면 본문(보기)으로 유지 — 진짜 매핑인데 빈칸이 없는 구조는
//   성립하지 않으므로 안전 방향.
const ANSWER_KEY_LINE_RE = /^[①-⑳](?![.\s])/;
// 빈칸 '( ① )' 에 정답값이 채워진 형태 '( ①120 )'/'( ④4.8 )' — 원형숫자 뒤 숫자 직결이 판별점.
const FILLED_BLANK_RE = /\(\s*[①-⑳]\d[\d,.]*\s*\)/;
// 워크드 풀이 결과값 — 줄 끝 '= <숫자>원?' (GT: Q-015 '… = 19,600,000원')
const WORKED_RESULT_RE = /=\s*[\d,.]+\s*원?\s*$/;
// ★과제거 가드(리뷰 MAJOR-2): '= 값원' 종결만으로는 자료표의 주어진 조건('보험가입금액 =
//   20,000,000원')과 풀이 결과를 구분 못 한다 — 산식 연산 증거(연산자 또는 '=' 2회 이상)가
//   있는 줄만 워크드 풀이로 분류. 증거 없는 단독 조건 줄은 본문 유지 (진짜 결과줄 잔존은
//   answer-leak 가드(광역 패턴 유지)가 throw 로 노출 → 인간 판정 강제).
const CALCULATION_EVIDENCE_RE = /[×÷+*/-]|=[^=]*=/;
function isWorkedSolutionLine(line) {
  return WORKED_RESULT_RE.test(line) && CALCULATION_EVIDENCE_RE.test(line);
}
// 출제자 해설 어휘 — 채점 총평·수험서 참조 표현 (결재 #2 §6 "출제자 해설/주석" 판별 근거).
// 출제 본문(발문·보기·자료표)에는 등장하지 않는 메타 발화만 등재 (GT 4문항 전수 검증).
const EXAMINER_COMMENTARY_RE = /복수정답|출제자|출제되었|이론서/;
// 강의 광고 노이즈 — 본문도 정답도 아닌 삽입 텍스트 (GT: Q-014 '파이널 특강 적중')
const NOISE_LINE_RE = /특강|적중/;
const NOISE_LINE_MAX_LENGTH = 20; // 광고 문구는 단행 짧은 텍스트 — 본문 문장 오폭 차단
// 문장 종결 어미 — ※ 블록의 줄바꿈 랩핑 연속 판정 (종결 줄에서 블록 끝)
const SENTENCE_FINAL_RE = /(다|함|음|임|님|됨|것)[.)]?\s*$/;
const COMMENT_MARK = '※'; // 해설/조건 공용 마커 — 어휘 판별로 해설만 제거 (조건 '※ …아님.' 유지)
const SOLUTION_HEAD_MARK = '■'; // 워크드 풀이 시나리오 헤더 (직후 줄이 풀이일 때만 제거)

/* ────────────────────────────────────────────────────────────────────────────
 * §2 일반 분리기 — 줄 분류 + 제거 segment 파생 (결정적: 입력 content 만으로 결정)
 * ──────────────────────────────────────────────────────────────────────────── */

/** lines[idx] 와 동일한 줄이 idx 이전에 이미 존재하는가 (중복 정답표 확장 근거) */
function duplicatesEarlierLine(lines, idx) {
  const line = lines[idx];
  if (line.trim() === '') return false;
  for (let m = 0; m < idx; m++) {
    if (lines[m] === line) return true;
  }
  return false;
}

/** 채워진 빈칸을 빈칸 원형으로 되돌린 대조형 — '( ①120 )' → '( ① )' (중복 판 증거 대조용) */
function blankedForm(line) {
  return line.replace(/\(\s*([①-⑳])\d[\d,.]*\s*\)/g, '( $1 )');
}

/** 원형숫자 N 의 빈칸 원형 '(N)'/'( N )' 이 content 어딘가에 존재하는가 — 정답 매핑 판별 증거 */
function hasBlankOriginalEvidence(lines, circled) {
  const re = new RegExp(`\\(\\s*${circled}\\s*\\)`);
  return lines.some((l) => re.test(l));
}

/**
 * 줄 단위 분류 — null(본문 유지) 또는 RULE_CLASS. 블록 규칙(※/워크드/중복표) 우선,
 * 라인 규칙(정답매핑/노이즈/주석) 후행. 선점(claim)된 줄은 재분류하지 않는다.
 */
function classifyLines(lines) {
  const cls = new Array(lines.length).fill(null);

  // (1) ※ 블록 — 종결 어미까지 랩핑 연속으로 범위 산정 후, 해설 어휘 포함 블록만 제거.
  //     어휘 없는 ※ 단행(출제 조건, 예: '※ 금번 사고는 피복재단독사고 아님.')은 본문 유지.
  for (let i = 0; i < lines.length; i++) {
    if (cls[i] !== null || !lines[i].trim().startsWith(COMMENT_MARK)) continue;
    let j = i;
    while (j < lines.length - 1) {
      if (SENTENCE_FINAL_RE.test(lines[j].trim())) break;
      const next = lines[j + 1].trim();
      if (next === '' || next.startsWith(COMMENT_MARK) || next.startsWith(SOLUTION_HEAD_MARK)) break;
      j++;
    }
    if (EXAMINER_COMMENTARY_RE.test(lines.slice(i, j + 1).join('\n'))) {
      for (let k = i; k <= j; k++) cls[k] = RULE_CLASS.COMMENTARY_BLOCK;
    }
    i = j; // 블록 범위는 유지 판정이어도 재스캔 불필요
  }

  // (2) 워크드 풀이 — 결과값 줄(산식 연산 증거 필수 — 과제거 가드) + 직결 ■ 시나리오 헤더.
  for (let i = 0; i < lines.length; i++) {
    if (cls[i] === null && isWorkedSolutionLine(lines[i])) cls[i] = RULE_CLASS.WORKED_SOLUTION;
  }
  for (let i = 0; i < lines.length - 1; i++) {
    if (cls[i] !== null) continue;
    if (lines[i].trim().startsWith(SOLUTION_HEAD_MARK) && cls[i + 1] === RULE_CLASS.WORKED_SOLUTION) {
      cls[i] = RULE_CLASS.WORKED_SOLUTION;
    }
  }

  // (3) 중복 정답표 — 채워진 빈칸(anchor) + "빈칸 원형이 앞서 존재" 증거가 있을 때만,
  //     anchor 사이 전체 + 위/아래로 "이미 나온 줄과 동일"한 표 셀·헤더까지 확장 제거.
  //     증거 없는 채워진 빈칸은 제거하지 않는다 → answer-leak 가드가 throw 로 노출
  //     (silent 오제거 대신 예외 명단(MANUAL_OVERRIDE_RULES) 등재를 강제).
  const anchors = [];
  for (let i = 0; i < lines.length; i++) {
    if (cls[i] === null && FILLED_BLANK_RE.test(lines[i])) anchors.push(i);
  }
  if (anchors.length > 0) {
    const hasDuplicateEvidence = anchors.some((a) =>
      lines.slice(0, anchors[0]).includes(blankedForm(lines[a])),
    );
    if (hasDuplicateEvidence) {
      let start = anchors[0];
      let end = anchors[anchors.length - 1];
      while (start > 0 && cls[start - 1] === null && duplicatesEarlierLine(lines, start - 1)) start--;
      while (end < lines.length - 1 && cls[end + 1] === null && duplicatesEarlierLine(lines, end + 1)) end++;
      // ★과제거 가드(리뷰 MAJOR-3): 구간 내 줄이라도 원본 권역(첫 anchor 이전)에 이미 있는
      //   내용이어야 제거 대상. 중복판은 줄 랩핑이 다를 수 있으므로(GT Q-014 '감자(가을재배)'
      //   → '감자'+'(가을재배)' 2줄) 공백 제거 후 부분문자열로 판별. 고유 본문이 끼어 있으면
      //   무음 소실 대신 throw — 인간 판정(MANUAL_OVERRIDE) 강제.
      const collapse = (s) => s.replace(/\s+/g, '');
      const earlierBlob = collapse(lines.slice(0, anchors[0]).join('\n'));
      for (let k = start; k <= end; k++) {
        if (cls[k] !== null) continue;
        const flat = collapse(lines[k]);
        const isAnchorLine = FILLED_BLANK_RE.test(lines[k]);
        const isDupContent =
          flat === '' ||
          earlierBlob.includes(flat) ||
          (blankedForm(lines[k]) !== lines[k] && earlierBlob.includes(collapse(blankedForm(lines[k]))));
        if (isAnchorLine || isDupContent) {
          cls[k] = RULE_CLASS.DUP_ANSWER_TABLE;
        } else {
          throw new Error(
            `중복 정답표 구간(줄 ${start + 1}~${end + 1}) 안에 비중복 본문 줄 발견(줄 ${k + 1}: ` +
              `${JSON.stringify(lines[k].slice(0, 40))}…) — 과제거 방지: MANUAL_OVERRIDE_RULES 등재로 인간 판정 필요`,
          );
        }
      }
    }
  }

  // (4) 라인 규칙 — 정답 매핑 / 강의 노이즈 / 출제자 주석 단행.
  for (let i = 0; i < lines.length; i++) {
    if (cls[i] !== null) continue;
    const t = lines[i].trim();
    if (ANSWER_KEY_LINE_RE.test(t)) {
      // 빈칸 원형 증거가 있을 때만 매핑으로 제거 — 없으면 직결 서식 보기('①보험의 목적')로
      // 간주해 본문 유지 (과제거 가드, 리뷰 MAJOR-1. 진짜 매핑 잔존은 leak 가드가 throw).
      if (hasBlankOriginalEvidence(lines, t[0])) cls[i] = RULE_CLASS.ANSWER_KEY_LINE;
    } else if (t.length <= NOISE_LINE_MAX_LENGTH && NOISE_LINE_RE.test(t)) cls[i] = RULE_CLASS.NOISE_LINE;
    else if (EXAMINER_COMMENTARY_RE.test(t)) cls[i] = RULE_CLASS.COMMENTARY_LINE;
  }

  return cls;
}

/**
 * content 에서 제거할 segment 를 위치순으로 파생 (제거전용 — segment 는 전부
 * content 의 연속 부분 문자열). 같은 클래스의 연속 줄은 1개 segment 로 병합
 * (감사 로그의 의미 단위 = 하드코딩판 removals 와 동일 granularity).
 */
export function deriveRemovalSegments(content) {
  const lines = content.split('\n');
  const cls = classifyLines(lines);
  const segments = [];
  let i = 0;
  while (i < lines.length) {
    if (cls[i] === null) {
      const m = lines[i].match(INLINE_ANSWER_RE);
      if (m) segments.push({ segment: m[0], ruleClass: RULE_CLASS.INLINE_ANSWER, line: i });
      i++;
      continue;
    }
    const c = cls[i];
    let j = i;
    while (j + 1 < lines.length && cls[j + 1] === c) j++;
    const atEof = j === lines.length - 1;
    segments.push({
      segment: lines.slice(i, j + 1).join('\n') + (atEof ? '' : '\n'),
      ruleClass: c,
      line: i,
    });
    i = j + 1;
  }
  return segments;
}

/* ────────────────────────────────────────────────────────────────────────────
 * §3 per-ID 명단 — 예외 폴백(빈 명단) + 검증/문서화 전용 데이터.
 *    ★ 제거 로직은 §2 일반 분리기가 전담한다. 여기는 규칙이 아니다.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 수동 예외 규칙 (폴백 — 일반 규칙이 오분류하는 문항만 명시 사유와 함께 등재).
 * 형식: { removals?: string[], leakTokens?: string[], allowGenericLeaks?: string[],
 *         note?: string, reason: string }
 *  - removals 지정 시 일반 분리기 전체를 대체 / 미지정 시 일반 분리기 결과 유지.
 *  - allowGenericLeaks: 인간 검수로 본문 유지가 확인된 일반 leak 패턴명 스킵
 *    (예: '워크드 풀이 결과값' — 자료표 '조건 = 값원' 줄 보존 경로. 리뷰 MAJOR-2).
 * 현재 0건 — pilot 12문항 전부 일반 분리기로 처리(byte-동치 검증 완료).
 */
export const MANUAL_OVERRIDE_RULES = {};

/**
 * answer-leak 검증 토큰 (per-ID 추가 assert — 제거 규칙 아님, 가드 2) 강화 전용).
 * 진산 검수 시점에 못박은 문항별 정답 토큰: 일반 패턴 가드에 더해 이중 차단.
 */
const LEAK_TOKEN_ASSERTIONS = {
  'Q-2025-11-2ND-012': ['결실완료', '정아발아', '이론서 103'],
  'Q-2025-11-2ND-004': ['➡'],
  'Q-2025-11-2ND-014': ['①120', '②110', '③95', '④4.8', '⑤2.8'],
  'Q-2025-11-2ND-015': ['19,600,000', '14,700,000', '자기부담금액을 안분'],
};

/** 감사 로그 정책 문구 (문서화 전용 — 검수 동결분 유지. 미등재 문항은 클래스 기반 자동 문구) */
const POLICY_NOTES = {
  'Q-2025-11-2ND-012': '정답 매핑(①결실완료 등) + 출제자 해설 제거. 빈칸 표((①)후 오디만 해당 …)는 본문이므로 유지.',
  'Q-2025-11-2ND-004': '물음 정답값(➡ 역병/시들음병)만 제거. 고추·감자 병충해 등급표(자료표)는 진산 결정대로 유지 → 잔존 길이 >500(미회복).',
  'Q-2025-11-2ND-014': '중복 정답표(②번째 표 = 빈칸에 정답값 채운 판) + 강의 광고("파이널 특강 적중") 제거. 첫 빈칸표(자료표)는 유지.',
  'Q-2025-11-2ND-015': '워크드 풀이(= 정답값) + 출제자 해설 제거. 발문·물음1/2/3·조건(※ 피복재단독사고 아님)·목적물 표(자료표)는 유지.',
};

const NOTE_NO_REMOVAL = '정답/해설 미내장 — content 그대로(변경 0).';

function deriveGenericNote(derived) {
  const labels = [...new Set(derived.map((d) => RULE_CLASS_LABEL[d.ruleClass]))];
  return `일반 분리기 적용 — ${labels.join(' + ')} 제거 (결재 #2 §6 정책).`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * §4 변환 본체 — 제거전용 split/join + normalize + answer-leak 가드
 * ──────────────────────────────────────────────────────────────────────────── */

/** 다중 공백/개행 정리 — 제거로 생긴 빈 줄만 접고, 내용은 불변. */
export function normalize(s) {
  return s
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n+$/g, '')
    .replace(/^\n+/g, '')
    .trim();
}

/**
 * 가드 2) answer-leak — per-ID 토큰 + 일반 정답 표면 패턴 잔존 시 throw.
 * allowedGenericLeaks: 인간 검수로 "본문 유지가 정당"함이 확인된 패턴명 스킵
 * (MANUAL_OVERRIDE_RULES.allowGenericLeaks — 예: 자료표의 '조건 = 값원' 줄.
 *  리뷰 MAJOR-2: 종전에는 이런 줄을 보존할 경로 자체가 없었다).
 */
export function assertNoAnswerLeak(questionId, body, extraTokens, allowedGenericLeaks = []) {
  for (const tok of extraTokens) {
    if (body.includes(tok)) {
      throw new Error(`[${questionId}] answer-leak: queryBody 에 정답 토큰 "${tok}" 잔존`);
    }
  }
  const bodyLines = body.split('\n');
  const genericLeaks = [
    { name: '인라인 정답 마커(➡)', test: (b) => /➡/.test(b) },
    { name: '채워진 빈칸 정답값', test: (b) => FILLED_BLANK_RE.test(b) },
    // 광역 유지(의도): 연산 증거 없는 '= 값원' 조건 줄도 일단 throw 로 표면화 —
    // 인간 판정 후 allowGenericLeaks 로만 통과 (무음 소실/무음 잔존 양방향 차단).
    { name: '워크드 풀이 결과값', test: (b) => new RegExp(WORKED_RESULT_RE.source, 'm').test(b) },
    { name: '출제자 해설 어휘', test: (b) => EXAMINER_COMMENTARY_RE.test(b) },
    {
      // 직결 서식은 빈칸 원형 증거가 있을 때만 매핑 leak (증거 없는 직결 보기는 정당 본문 —
      // 분류기 rule (4)와 동일 판별. 리뷰 MAJOR-1 정합)
      name: '정답 매핑 라인',
      test: () =>
        bodyLines.some((l) => {
          const t = l.trim();
          return ANSWER_KEY_LINE_RE.test(t) && hasBlankOriginalEvidence(bodyLines, t[0]);
        }),
    },
  ];
  for (const { name, test } of genericLeaks) {
    if (allowedGenericLeaks.includes(name)) continue;
    if (test(body)) {
      throw new Error(`[${questionId}] answer-leak: queryBody 에 ${name} 잔존 — 일반 분리기 미처리분은 MANUAL_OVERRIDE_RULES 등재 필요`);
    }
  }
}

export function buildBody(questionId, content) {
  const override = MANUAL_OVERRIDE_RULES[questionId];
  const allowedGenericLeaks = override?.allowGenericLeaks ?? [];
  let derived;
  if (override?.removals) {
    derived = override.removals.map((segment) => ({ segment, ruleClass: RULE_CLASS.MANUAL_OVERRIDE, line: -1 }));
  } else {
    try {
      derived = deriveRemovalSegments(content);
    } catch (e) {
      throw new Error(`[${questionId}] ${e.message}`);
    }
  }
  if (derived.length === 0) {
    // passthrough 에도 leak 가드 적용 — 분리기가 못 알아본 정답 내장의 무음 통과 차단.
    assertNoAnswerLeak(questionId, content, LEAK_TOKEN_ASSERTIONS[questionId] ?? [], allowedGenericLeaks);
    return { queryBody: content, removed: [], note: NOTE_NO_REMOVAL };
  }
  let body = content;
  const removed = [];
  for (const { segment } of derived) {
    if (!body.includes(segment)) {
      throw new Error(`[${questionId}] 제거 segment 불일치(파생 오류): ${JSON.stringify(segment.slice(0, 40))}…`);
    }
    const occurrences = body.split(segment).length - 1;
    if (occurrences !== 1) {
      throw new Error(`[${questionId}] 제거 segment 다중 발생(${occurrences}회 — 모호성): ${JSON.stringify(segment.slice(0, 40))}… → MANUAL_OVERRIDE_RULES 등재 필요`);
    }
    body = body.split(segment).join('');
    removed.push(segment);
  }
  body = normalize(body);
  assertNoAnswerLeak(questionId, body, override?.leakTokens ?? LEAK_TOKEN_ASSERTIONS[questionId] ?? [], allowedGenericLeaks);
  const note = override?.note ?? POLICY_NOTES[questionId] ?? deriveGenericNote(derived);
  return { queryBody: body, removed, note };
}

/* ────────────────────────────────────────────────────────────────────────────
 * §5 산출물 조립 — 측정 JSON + 감사 로그 (문구·구조 = 검수 동결분 유지)
 * ──────────────────────────────────────────────────────────────────────────── */

export function buildOutputs(src) {
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

  // 디버그 측정 파일: ≤2000 전량 (Q-004 포함) — 러너 `--debug` 전용 (G-WS4 ④ 배선).
  const debugItems = rows
    .filter((r) => r.bodyLen <= DEBUG_MAX_QUERY)
    .map((r) => ({ questionId: r.questionId, content: r.queryBody, relatedNodesRaw: r.relatedNodesRaw }));

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

  // 감사 로그 (per-item original→body, 제거 segment, 길이, ≤500).
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

  const outDebugJson = {
    $schema:
      'S5-6b golden pilot — queryBody 디버그 측정 입력 (≤2000 전량, >500 포함 — 러너 --debug 전용)',
    note:
      `공개 계약(≤${MAX_QUERY}) 초과 문항 포함 — /api/search/graph 에 debug:true 로만 전송 가능 ` +
      `(GRAPH_QUERY_DEBUG_MAX_LENGTH=${DEBUG_MAX_QUERY}). G-WS4 ④(Q-004 측정 포함) 배선용. ` +
      `정본 측정 파일은 golden-pilot-approved.querybody.json (공개 계약 준수판).`,
    derivedFrom: 'golden-pilot-approved.json (진산 검수 동결분, 무변경)',
    examId: src.examId,
    requiresDebugFlag: true,
    items: debugItems,
  };

  return { rows, measureItems, over500, outJson, outDebugJson, logText: log.join('\n') };
}

/* ────────────────────────────────────────────────────────────────────────────
 * §6 CLI 엔트리 (직접 실행 시에만 파일 기록 — 테스트 import 시 부작용 0)
 * ──────────────────────────────────────────────────────────────────────────── */

function main() {
  const src = JSON.parse(readFileSync(SRC, 'utf-8'));
  const { rows, measureItems, over500, outJson, outDebugJson, logText } = buildOutputs(src);

  writeFileSync(join(DIR, 'golden-pilot-approved.querybody.json'), JSON.stringify(outJson, null, 2));
  writeFileSync(join(DIR, 'golden-pilot-approved.querybody.debug.json'), JSON.stringify(outDebugJson, null, 2));
  writeFileSync(join(DIR, 'querybody-removal-log.md'), logText);

  // 콘솔 요약 (성공만 조용히 — 수치 해석/판정은 진산).
  process.stdout.write('=== queryBody 파생 완료 (제거전용·answer-leak 가드 통과) ===\n');
  process.stdout.write(`측정 분모 measurable: 4 → ${measureItems.length}\n`);
  for (const r of rows) {
    process.stdout.write(
      `  ${r.questionId.padEnd(20)} ${String(r.origLen).padStart(4)} → ${String(r.bodyLen).padStart(4)}  ${r.le500 ? '✅측정' : '⛔>500제외'}  (hop=${r.hop})\n`,
    );
  }
  process.stdout.write(`측정 제외(>500 잔존): ${over500.join(', ') || '없음'}\n`);
  process.stdout.write('[written] golden-pilot-approved.querybody.json / .querybody.debug.json / querybody-removal-log.md\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
