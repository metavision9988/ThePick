/* eslint-env node */
/**
 * public-analytics-reader 순수 로직 검증 (D-20). 루트 `pnpm test:scripts` (node --test).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DATASETS,
  INTEGRITY_REASONS,
  buildQueries,
  parseAeResult,
  summarizeKinds,
  summarizeAccuracy,
  classifyDefects,
  formatReport,
} from '../lib/public-analytics-reader.mjs';

test('buildQueries: env→dataset 삽입 + windowDays 반영', () => {
  const q = buildQueries('production', 7);
  assert.match(q.byKind, /FROM thepick_public_events_production/);
  assert.match(q.byKind, /INTERVAL '7' DAY/);
  assert.match(q.accuracyBySubject, /blob1='grade'/);
  assert.match(q.accuracyBySubject, /sum\(if\(double1=1,_sample_interval,0\)\) AS correct/);
  assert.match(q.defectByReason, /blob1='defect'/);
  // 샘플 보정 — count() 아닌 sum(_sample_interval).
  assert.match(q.byKind, /sum\(_sample_interval\)/);
});

test('buildQueries: 미지원 env / 비양수 windowDays → throw (주입 안전)', () => {
  assert.throws(() => buildQueries('prod', 7), /미지원 env/);
  assert.throws(() => buildQueries('production', 0), /windowDays/);
  assert.throws(() => buildQueries('production', 1.5), /windowDays/);
  // 화이트리스트 3종만.
  assert.deepEqual(Object.keys(DATASETS).sort(), ['dev', 'production', 'staging']);
});

test('parseAeResult: 정상 data 반환 / 실패·형식이상 throw', () => {
  assert.deepEqual(parseAeResult({ data: [{ kind: 'grade' }], rows: 1 }), [{ kind: 'grade' }]);
  assert.throws(() => parseAeResult({ success: false, errors: [{ message: 'bad' }] }), /AE 쿼리 실패/);
  assert.throws(() => parseAeResult({ meta: [] }), /data 배열 없음/);
  assert.throws(() => parseAeResult(null), /객체가 아님/);
});

test('summarizeKinds: 문자열 카운트 n → number 정규화 (--json 타입 통일)', () => {
  const out = summarizeKinds([
    { kind: 'serve', n: '16' },
    { kind: 'grade', n: '12' },
  ]);
  assert.deepEqual(out, [
    { kind: 'serve', n: 16 },
    { kind: 'grade', n: 12 },
  ]);
  // number 라 산술 안전(문자열 연결 오염 차단).
  assert.equal(out[0].n + out[1].n, 28);
});

test('summarizeAccuracy: 문자열 카운트 → 정답률 %, total=0 은 null', () => {
  const out = summarizeAccuracy([
    { subject: '상법 보험편', total: '5', correct: '1' },
    { subject: '재배학', total: '3', correct: '0' },
    { subject: '', total: '0', correct: '0' },
  ]);
  assert.equal(out[0].accuracyPct, 20); // 1/5
  assert.equal(out[1].accuracyPct, 0); // 0/3
  assert.equal(out[2].accuracyPct, null); // 0/0
  assert.equal(out[2].subject, '(미상)');
  assert.equal(out[0].total, 5); // Number 변환
});

test('classifyDefects: 콘텐츠 결함 vs D-17 정합성 신호 분리 집계', () => {
  const out = classifyDefects([
    { reason: 'grade_mc_contract:missing', n: '3' },
    { reason: 'choice_id_unresolved', n: '10' },
    { reason: 'choice_id_malformed', n: '4' },
    { reason: 'mc_in_disguise_or_numeric_short_answer', n: '2' },
  ]);
  assert.equal(out.contentTotal, 5); // 3 + 2 콘텐츠 결함만
  assert.equal(out.integrityTotal, 14); // 10 + 4 정합성 신호만
  assert.deepEqual(out.integrity.map((d) => d.reason).sort(), INTEGRITY_REASONS.slice().sort());
  // choice_id_* 가 콘텐츠 결함율에 섞이지 않음(4-Pass 지적 = 정답률/결함율 오염 방지).
  assert.ok(out.content.every((d) => !INTEGRITY_REASONS.includes(d.reason)));
});

test('formatReport: 핵심 라인 포함 (종류·정답률·정합성 분리)', () => {
  const report = formatReport({
    env: 'production',
    windowDays: 7,
    kinds: [{ kind: 'grade', n: '12' }],
    accuracy: [{ subject: '상법 보험편', total: 5, correct: 1, accuracyPct: 20 }],
    defects: {
      content: [{ reason: 'grade_mc_contract:x', n: 3 }],
      integrity: [{ reason: 'choice_id_unresolved', n: 10 }],
      contentTotal: 3,
      integrityTotal: 10,
    },
  });
  assert.match(report, /env=production/);
  assert.match(report, /20%/);
  assert.match(report, /정합성 신호 계\(D-17/);
  assert.match(report, /choice_id_unresolved: 10/);
});
