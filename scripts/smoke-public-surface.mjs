#!/usr/bin/env node
/**
 * smoke-public-surface — 공개 학습 표면 배포 후 스모크 (5-페르소나 M-17, P5 blocking).
 *
 * 사용: node scripts/smoke-public-surface.mjs <API_BASE_URL>
 * 예:   node scripts/smoke-public-surface.mjs https://thepick-api-production.metavision9988.workers.dev
 *
 * 검증(전부 PASS 여야 exit 0 — 하나라도 실패 시 exit 1, 원문 출력):
 *   1. GET  /questions/overview       — 200 + total>0 + 정답·보기 텍스트 비노출 + 공용 캐시 헤더
 *   2. GET  /questions/next (MC)      — 200 + choices≥4 + answer/explanation 비노출 + no-store
 *   3. POST /grade (서빙 choiceId)    — 200 + isCorrect boolean + correctAnswer + correctChoiceIds
 *   4. POST /reveal                   — 200 + correctAnswer (P4-D1)
 *   5. 경계 — 미존재 id 채점/공개      — 404 QUESTION_NOT_FOUND (2차/flagged 동일 경로)
 */

const base = process.argv[2];
const FETCH_TIMEOUT_MS = 15_000; // 4-Pass MINOR — 게이트 스크립트 hang 차단 (Node 18+ AbortSignal.timeout)
if (!base || !/^https?:\/\//.test(base)) {
  console.error('usage: node scripts/smoke-public-surface.mjs <API_BASE_URL>');
  process.exit(1);
}

const results = [];
let failed = false;

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  // 1. overview
  const ovRes = await fetch(`${base}/api/public/questions/overview`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const ovBody = await ovRes.json().catch(() => null);
  check('overview 200', ovRes.status === 200, `status=${ovRes.status}`);
  check('overview total>0', typeof ovBody?.total === 'number' && ovBody.total > 0, `total=${ovBody?.total}`);
  check(
    'overview 공용 캐시 헤더',
    (ovRes.headers.get('cache-control') ?? '').includes('public'),
    ovRes.headers.get('cache-control') ?? '(없음)',
  );

  // 2. next (MC)
  const nextRes = await fetch(`${base}/api/public/questions/next?inputType=multiple_choice`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const q = await nextRes.json().catch(() => null);
  check('next 200', nextRes.status === 200, `status=${nextRes.status}`);
  check('next choices≥4', Array.isArray(q?.choices) && q.choices.length >= 4, `choices=${q?.choices?.length}`);
  check('next 정답 비노출', q !== null && !('answer' in q) && !('explanation' in q));
  check(
    'next no-store',
    (nextRes.headers.get('cache-control') ?? '').includes('no-store'),
    nextRes.headers.get('cache-control') ?? '(없음)',
  );
  if (!Array.isArray(q?.choices)) throw new Error('next 실패 — 후속 스텝 진행 불가');

  // 3. grade — 서빙된 첫 choiceId 제출(정오 자체는 미고정, 계약 shape 검증)
  const gradeRes = await fetch(`${base}/api/public/grade`, {
    method: 'POST',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId: q.id, choiceId: q.choices[0].choiceId }),
  });
  const grade = await gradeRes.json().catch(() => null);
  check('grade 200', gradeRes.status === 200, `status=${gradeRes.status}`);
  check('grade shape', typeof grade?.isCorrect === 'boolean' && typeof grade?.correctAnswer === 'string');
  check('grade correctChoiceIds', Array.isArray(grade?.correctChoiceIds) && grade.correctChoiceIds.length >= 1);
  check(
    'grade 정답 choiceId ∈ 서빙 집합',
    Array.isArray(grade?.correctChoiceIds) &&
      grade.correctChoiceIds.every((id) => q.choices.some((c) => c.choiceId === id)),
  );

  // 4. reveal
  const revealRes = await fetch(`${base}/api/public/reveal`, {
    method: 'POST',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId: q.id }),
  });
  const reveal = await revealRes.json().catch(() => null);
  check('reveal 200', revealRes.status === 200, `status=${revealRes.status}`);
  check('reveal correctAnswer', typeof reveal?.correctAnswer === 'string');

  // 5. 경계 — 미존재/비공개 id
  const boundaryRes = await fetch(`${base}/api/public/grade`, {
    method: 'POST',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId: 'smoke-nonexistent-id', answer: 'x' }),
  });
  const boundary = await boundaryRes.json().catch(() => null);
  check(
    '경계 — 미존재 id 404 QUESTION_NOT_FOUND',
    boundaryRes.status === 404 && boundary?.error === 'QUESTION_NOT_FOUND',
    `status=${boundaryRes.status} error=${boundary?.error}`,
  );
}

main()
  .catch((err) => {
    failed = true;
    console.error('SMOKE ABORT:', err.message ?? err);
  })
  .finally(() => {
    const pass = results.filter((r) => r.ok).length;
    console.log(`\n${failed ? '🔴 FAIL' : '🟢 PASS'} — ${pass}/${results.length} checks (${base})`);
    process.exit(failed ? 1 : 0);
  });
