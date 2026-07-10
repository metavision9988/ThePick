/**
 * promo-1st P3 — 로컬 리허설 (production 적용 전 왕복 게이트).
 *
 * in-memory SQLite 에 ①전 마이그레이션(readdir — 0038 트리거 포함) ②원 batch-Q
 * insert SQL(old 525) ③생성된 insert-round-N.sql(신규 MC) 순차 적용 후:
 *   R1. 신규 MC 행 수 = validation-report perRound.pass 와 정확 일치
 *   R2. 전 신규 행 parseMcChoices 계약 PASS (distractors↔answer 위치 왕복)
 *   R2b. ★byte-동등 왕복 (독립 리뷰 m-2): content===JSON stem ·
 *        distractors===JSON.stringify(options) · answer===교정값(또는 원본) — 무손실 확증
 *   R3. 신규 행 content 에 보기 마커(①) 미포함 (stem-only)
 *   R4. old 행 무변경 (525 유지·distractors 전부 NULL)
 *   R5. 트리거(0004→0038·0018 draft-only 등) 하 INSERT 통과 자체가 게이트
 *
 * 실행: apps/api 에서 pnpm exec tsx ../../scripts/promo-p3/rehearse-local.ts
 */

// @ts-expect-error — Node 22 내장 (d1-from-sqlite.ts 와 동일 우회)
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMcChoices } from '../../packages/learning-modes/src/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS = join(ROOT, 'migrations');
const BATCH = join(ROOT, 'docs', 'batch-load');
const OUT = join(BATCH, 'promo-mc-distractors');
const CORRECTIONS = join(OUT, 'answer-corrections.json');

const ROUND_DIRS: Record<number, string> = {
  5: 'batch-Q-2019-5-1st',
  6: 'batch-Q-2020-6-1st',
  7: 'batch-Q-2021-7-1st',
  8: 'batch-Q-2022-8-1st',
  9: 'batch-Q-2023-9-1st',
  10: 'batch-Q-2024-10-1st',
  11: 'batch-Q-2025-11-1st',
};

interface SourceQ {
  readonly id: string;
  readonly stem: string;
  readonly options: readonly string[];
  readonly answer: string;
}

interface ReportShape {
  readonly perRound: Record<
    string,
    { pass: number; excluded: number; corrected: number; sqlFile: string | null }
  >;
  readonly overlay: {
    readonly corrections: ReadonlyArray<{ id: string; corrected: string }>;
    readonly exclusions: ReadonlyArray<{ id: string }>;
  };
  readonly violations: readonly unknown[];
}

interface CanonicalOverlay {
  readonly corrections: ReadonlyArray<{ id: string; corrected: string }>;
  readonly exclusions: ReadonlyArray<{ id: string }>;
}

function main(): void {
  const report = JSON.parse(
    readFileSync(join(OUT, 'validation-report.json'), 'utf-8'),
  ) as ReportShape;
  // M-1 — 빌드 위반 0 확증: report 자기주장이라도 위반 있으면 리허설 진입 금지
  // (빌드가 exit 1 후에도 남긴 회차 SQL 을 무검증 통과시키는 경로 차단).
  if (report.violations.length > 0) {
    throw new Error(
      `build validation-report 위반 ${report.violations.length}건 — 리허설 불가 (M-1)`,
    );
  }
  // M-1 — 교정 정본은 answer-corrections.json 직접 로드 (report.overlay echo 신뢰 금지).
  const canon = JSON.parse(readFileSync(CORRECTIONS, 'utf-8')) as CanonicalOverlay;
  // report ↔ 정본 신선도: 빌드가 소비한 오버레이와 현행 정본이 동일해야 함 (stale report 차단).
  const canonSig = canon.corrections
    .map((c) => `${c.id}=${c.corrected}`)
    .sort()
    .join(',');
  const reportSig = report.overlay.corrections
    .map((c) => `${c.id}=${c.corrected}`)
    .sort()
    .join(',');
  if (canonSig !== reportSig) {
    throw new Error(
      'validation-report.overlay ↔ answer-corrections.json 불일치 = stale report (M-1)',
    );
  }
  const correctedById = new Map(canon.corrections.map((c) => [c.id, c.corrected]));
  const excludedIds = new Set(canon.exclusions.map((e) => e.id));

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');

  // ① 전 마이그레이션 (더 엄격한 최신 트리거 셋에서 리허설).
  for (const f of readdirSync(MIGRATIONS)
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    try {
      db.exec(readFileSync(join(MIGRATIONS, f), 'utf-8'));
    } catch (err) {
      throw new Error(`migration ${f} failed: ${String(err)}`);
    }
  }

  // ② old 525 + 소스 JSON 로드.
  const sourceById = new Map<string, SourceQ>();
  for (const dir of Object.values(ROUND_DIRS)) {
    const sqlFile = readdirSync(join(BATCH, dir)).find((x) => x.endsWith('-insert.sql'));
    if (sqlFile === undefined) throw new Error(`${dir}: 원 insert SQL 부재`);
    db.exec(readFileSync(join(BATCH, dir, sqlFile), 'utf-8'));
    const jsonFile = readdirSync(join(BATCH, dir)).find(
      (x) => x.startsWith('batch-Q-') && x.endsWith('.json') && !x.includes('extract'),
    );
    if (jsonFile === undefined) throw new Error(`${dir}: batch JSON 부재`);
    const batch = JSON.parse(readFileSync(join(BATCH, dir, jsonFile), 'utf-8')) as {
      questions: SourceQ[];
    };
    for (const q of batch.questions) sourceById.set(q.id, q);
  }
  const oldCount = (
    db.prepare(`SELECT COUNT(*) c FROM exam_questions WHERE exam_type='1st'`).get() as { c: number }
  ).c;
  if (oldCount !== 525) throw new Error(`R-pre: old 1st rows ${oldCount} ≠ 525`);

  // ③ 신규 MC (report 가 SQL 생성했다고 주장하는 회차만 — 주장↔실재 대조).
  let expectedTotal = 0;
  for (const [key, info] of Object.entries(report.perRound)) {
    const round = Number.parseInt(key.replace('round-', ''), 10);
    if (info.sqlFile === null) throw new Error(`${key}: SQL 미생성 상태 — 리허설 불가`);
    if (!existsSync(join(OUT, info.sqlFile))) throw new Error(`${key}: ${info.sqlFile} 부재`);
    const sqlText = readFileSync(join(OUT, info.sqlFile), 'utf-8');
    // m-3 심층방어 — 생성 SQL 은 순수 INSERT 여야 함. old 행 접촉(UPDATE/DELETE) 차단
    // (트리거 방어에 더해 코드 사실로도 무접촉 보증).
    if (/\b(UPDATE|DELETE)\b/i.test(sqlText)) {
      throw new Error(`R-safety: ${info.sqlFile} 에 UPDATE/DELETE 포함 = old 행 접촉 위험 (m-3)`);
    }
    db.exec(sqlText);
    // R1 — 회차별 정확 카운트.
    const c = (
      db
        .prepare(`SELECT COUNT(*) c FROM exam_questions WHERE id LIKE '%-MC' AND round=?`)
        .get(round) as { c: number }
    ).c;
    if (c !== info.pass) throw new Error(`R1: round ${round} MC rows ${c} ≠ ${info.pass}`);
    expectedTotal += info.pass;
  }

  // R2+R2b+R3 — 전 신규 행 계약 + byte-동등 왕복 + stem-only.
  const mcRows = db
    .prepare(
      `SELECT id, answer, distractors, content, input_type, status, exam_type
       FROM exam_questions WHERE id LIKE '%-MC'`,
    )
    .all() as Array<{
    id: string;
    answer: string;
    distractors: string;
    content: string;
    input_type: string;
    status: string;
    exam_type: string;
  }>;
  if (mcRows.length !== expectedTotal)
    throw new Error(`R1: total MC ${mcRows.length} ≠ ${expectedTotal}`);
  for (const row of mcRows) {
    const srcId = row.id.replace(/-MC$/, '');
    const src = sourceById.get(srcId);
    if (src === undefined) throw new Error(`R2b: ${row.id} 소스 JSON 미발견`);
    if (excludedIds.has(srcId)) throw new Error(`R2b: 제외 대상 ${srcId} 이 적재됨`);
    const mc = parseMcChoices(row.distractors, row.answer);
    if (!mc.ok) throw new Error(`R2: ${row.id} 계약 위반 ${mc.reason}`);
    // R2b — byte-동등 (무손실 왕복: JSON→sqlEscape→SQLite→재조회).
    if (row.content !== src.stem) throw new Error(`R2b: ${row.id} content ≠ stem`);
    if (row.distractors !== JSON.stringify(src.options))
      throw new Error(`R2b: ${row.id} distractors ≠ JSON.stringify(options)`);
    const expectedAnswer = correctedById.get(srcId) ?? src.answer;
    if (row.answer !== expectedAnswer)
      throw new Error(`R2b: ${row.id} answer=${row.answer} ≠ 기대 ${expectedAnswer} (교정 반영)`);
    if (row.content.includes('①')) throw new Error(`R3: ${row.id} content 에 보기 인라인 잔존`);
    if (row.input_type !== 'multiple_choice' || row.status !== 'active' || row.exam_type !== '1st')
      throw new Error(`R2: ${row.id} 축 오염 (${row.input_type}/${row.status}/${row.exam_type})`);
  }

  // R4 — old 행 무변경.
  const oldAfter = (
    db
      .prepare(`SELECT COUNT(*) c FROM exam_questions WHERE exam_type='1st' AND id NOT LIKE '%-MC'`)
      .get() as { c: number }
  ).c;
  const oldDistractors = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM exam_questions WHERE exam_type='1st' AND id NOT LIKE '%-MC' AND distractors IS NOT NULL`,
      )
      .get() as { c: number }
  ).c;
  if (oldAfter !== 525 || oldDistractors !== 0)
    throw new Error(`R4: old 행 오염 (count=${oldAfter}, distractors≠NULL=${oldDistractors})`);

  process.stdout.write(
    `[rehearse] R1~R5 전부 PASS ✅  (old 525 무변경 · 신규 MC ${expectedTotal} 계약+byte-동등 왕복 · 트리거 통과)\n`,
  );
  db.close();
}

main();
