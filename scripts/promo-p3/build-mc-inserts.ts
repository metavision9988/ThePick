/**
 * promo-1st P3 — 4지선다 보기(distractors) 신규 MC 행 INSERT SQL 생성 + 결정적 검증.
 *
 * 소스 = `docs/batch-load/batch-Q-{year}-{round}-1st/batch-Q-*.json` (원 적재 산출물 —
 * options 4지 배열 구조화 완비. 2026-07-10 실측 525/525).
 *
 * ★ 적재 전략 (결정 기록, 위임 — ADR-046 기결 정합):
 *   - production 트리거(0004 전면 ABORT / 0038 도 distractors·superseded_by ABORT)상
 *     old 행 UPDATE 전면 불가 → **신규 MC 행 순수 INSERT** (`{oldId}-MC`), old 행 무접촉.
 *   - D-6(a) SUPERSEDES 결재의 "신규 INSERT" 절반을 이행 — old 행 superseded_by 마킹은
 *     D-2(상태 동결)가 명시한 "별도 plan"(상태머신 마이그) carry-over.
 *   - content = stem 만 (old 행은 보기 인라인 — 신규 행은 choices 분리 서빙이므로 중복 제거).
 *   - 메타데이터는 old 행에서 INSERT...SELECT 승계 + `AND answer = '<원본JSON answer>'`
 *     가드 — production old 행이 예상과 다르면 0행 삽입으로 fail-loud.
 *
 * ★ 교정 오버레이 (answer-corrections.json — 독립 검증 2회가 확증한 공식 정답 교정):
 *   - 2026-07-10 회차별 독립 PDF 대조(7 에이전트)가 원 JSON answer 36건이 공식 최종정답과
 *     불일치함을 적발 → 맹검 2차 재확증(3 에이전트) 일치분만 교정 채택.
 *   - 교정 문항의 신규 행 answer = **교정값 리터럴** (old 행 승계 금지 — old 행이 오답 보유).
 *     가드의 answer 대조는 여전히 원본값(행 식별 무결성).
 *   - 구조 훼손 문항(보기 오배치·표 선형화)은 exclusions = 정직 제외 목록 (무음 skip 금지 —
 *     리포트 영속·재구성 후속 트랙).
 *
 * 결정적 검증 (100% PASS 아니면 해당 회차 SQL 미생성 + exit 1):
 *   V1. parseMcChoices 계약 (단일 정본) / V2. 4지 고정 / V3. 무결성·문항번호 전단사
 *   V4. repo 원 insert SQL answer ↔ JSON answer 결정적 대조 (원본 소스 자기일관성 —
 *       교정 적용 전 단계. E0-8 감사가 SQL↔production D1 완전 정합 확증)
 *
 * 실행: apps/api 에서 pnpm exec tsx ../../scripts/promo-p3/build-mc-inserts.ts
 * 산출: docs/batch-load/promo-mc-distractors/{insert-round-N.sql, validation-report.json}
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMcChoices } from '../../packages/learning-modes/src/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BATCH_DIR = join(ROOT, 'docs', 'batch-load');
const OUT_DIR = join(BATCH_DIR, 'promo-mc-distractors');
const CORRECTIONS_FILE = join(OUT_DIR, 'answer-corrections.json');

const ROUNDS = [
  { year: 2019, round: 5 },
  { year: 2020, round: 6 },
  { year: 2021, round: 7 },
  { year: 2022, round: 8 },
  { year: 2023, round: 9 },
  { year: 2024, round: 10 },
  { year: 2025, round: 11 },
] as const;

interface BatchQuestion {
  readonly id: string;
  readonly year: number;
  readonly round: number;
  readonly exam_type: string;
  readonly question_number: number;
  readonly subject: string;
  readonly stem: string;
  readonly options: readonly string[];
  readonly answer: string;
  readonly source: string;
}

interface BatchFile {
  readonly meta: { readonly total: number };
  readonly questions: readonly BatchQuestion[];
}

interface AnswerCorrection {
  readonly id: string;
  readonly original: string;
  readonly corrected: string;
  readonly basis: string;
}

interface Exclusion {
  readonly id: string;
  readonly reason: string;
}

interface OverlayMeta {
  readonly confirmed?: number;
  readonly pending?: readonly string[];
}

interface CorrectionsOverlay {
  readonly _meta?: OverlayMeta;
  readonly corrections: readonly AnswerCorrection[];
  readonly exclusions: readonly Exclusion[];
}

interface Violation {
  readonly id: string;
  readonly check: string;
  readonly detail: string;
}

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

/**
 * repo 원 insert SQL 에서 id→answer 추출 (V4 결정적 대조용).
 *
 * quoted-atom 패턴 (독립 리뷰 M-1 정정): `'((?:[^']|'')*)'` 가 이스케이프('')를 원자로
 * 처리해 문자열 경계를 넘는 lazy 백트래킹 오캡처를 차단 — explanation 이 non-NULL 인
 * 미래 SQL 에서도 answer 자리를 정확히 캡처.
 */
function parseOriginalAnswers(sqlText: string): Map<string, string> {
  const map = new Map<string, string>();
  const Q = "'((?:[^']|'')*)'"; // quoted-atom 캡처
  const QNC = "'(?:[^']|'')*'"; // quoted-atom 비캡처
  // VALUES ('<id>', year, round, qnum, '<subject>', '<content>', '<answer>', NULL|'<explanation>', '1st', 'active');
  const stmtRe = new RegExp(
    `VALUES \\(${Q}, \\d+, \\d+, \\d+, ${QNC}, ${QNC}, ${Q}, (?:NULL|${QNC}), '1st', 'active'\\);`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = stmtRe.exec(sqlText)) !== null) {
    map.set(m[1]!.replace(/''/g, "'"), m[2]!.replace(/''/g, "'"));
  }
  return map;
}

/**
 * 교정 오버레이 로드 + 하드 사전조건 (독립 리뷰 C-1/C-2/m-5).
 *   - 파일 부재 = throw (fail-loud): 오버레이는 필수 안전층 — 부재 시 확정 오답이
 *     원본 그대로 서빙되므로 무음 빈-반환 금지.
 *   - _meta.pending 비어있지 않음 = throw: 미확정 계쟁 정답 무음 서빙 차단.
 *   - _meta.confirmed ≠ corrections 길이 = throw: 오버레이 자기일관성.
 *   - 교정 ∩ 제외 겹침 / id 중복 = throw.
 * throw 는 stale SQL 제거 후 SQL 미기록 상태에서 발생 = 클린 실패.
 */
function loadOverlay(): CorrectionsOverlay {
  if (!existsSync(CORRECTIONS_FILE)) {
    throw new Error(
      `answer-corrections.json 부재 (${CORRECTIONS_FILE}) — 교정 오버레이는 필수 안전층. ` +
        `부재 시 확정 오답 무음 서빙 위험이므로 fail-loud (독립 리뷰 C-1).`,
    );
  }
  const raw = JSON.parse(readFileSync(CORRECTIONS_FILE, 'utf-8')) as CorrectionsOverlay;
  const overlay: CorrectionsOverlay = {
    _meta: raw._meta,
    corrections: raw.corrections ?? [],
    exclusions: raw.exclusions ?? [],
  };
  const pending = overlay._meta?.pending ?? [];
  if (pending.length > 0) {
    throw new Error(
      `미확정 계쟁 정답 ${pending.length}건 [${pending.join(', ')}] — 확정(교정 또는 제외) 전 빌드 금지 (C-2).`,
    );
  }
  if (
    overlay._meta?.confirmed !== undefined &&
    overlay._meta.confirmed !== overlay.corrections.length
  ) {
    throw new Error(
      `오버레이 자기모순: _meta.confirmed=${overlay._meta.confirmed} ≠ corrections=${overlay.corrections.length} (C-2).`,
    );
  }
  const corrIds = overlay.corrections.map((c) => c.id);
  const exclIds = new Set(overlay.exclusions.map((e) => e.id));
  const overlap = corrIds.filter((id) => exclIds.has(id));
  if (overlap.length > 0) {
    throw new Error(`교정 ∩ 제외 겹침 [${overlap.join(', ')}] — 모순 (m-5).`);
  }
  if (new Set(corrIds).size !== corrIds.length) {
    throw new Error('교정 id 중복 (m-5).');
  }
  if (exclIds.size !== overlay.exclusions.length) {
    throw new Error('제외 id 중복 (m-5).');
  }
  return overlay;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  // stale 산출물 제거 (독립 리뷰 m-1 — 이전 세대 SQL 잔존 시 리허설이 무검증 소비 위험).
  for (const f of readdirSync(OUT_DIR).filter((x) => /^insert-round-\d+\.sql$/.test(x))) {
    rmSync(join(OUT_DIR, f));
  }

  const overlay = loadOverlay();
  const correctionById = new Map(overlay.corrections.map((c) => [c.id, c]));
  const exclusionById = new Map(overlay.exclusions.map((e) => [e.id, e]));
  const usedCorrections = new Set<string>();
  const usedExclusions = new Set<string>();

  const violations: Violation[] = [];
  const perRound: Record<
    string,
    { total: number; pass: number; excluded: number; corrected: number; sqlFile: string | null }
  > = {};

  for (const { year, round } of ROUNDS) {
    const dirName = `batch-Q-${year}-${round}-1st`;
    const dir = join(BATCH_DIR, dirName);
    const files = readdirSync(dir).filter(
      (f) => f.startsWith('batch-Q-') && f.endsWith('.json') && !f.includes('extract'),
    );
    if (files.length !== 1) {
      throw new Error(`${dirName}: batch JSON 파일 식별 실패 (found ${files.join(',')})`);
    }
    const batch = JSON.parse(readFileSync(join(dir, files[0]!), 'utf-8')) as BatchFile;

    const sqlFiles = readdirSync(dir).filter((f) => f.endsWith('-insert.sql'));
    if (sqlFiles.length !== 1) {
      throw new Error(`${dirName}: insert SQL 파일 식별 실패 (found ${sqlFiles.join(',')})`);
    }
    const originalAnswers = parseOriginalAnswers(readFileSync(join(dir, sqlFiles[0]!), 'utf-8'));
    if (originalAnswers.size !== batch.questions.length) {
      violations.push({
        id: dirName,
        check: 'V4-parse',
        detail: `원 SQL answer 추출 ${originalAnswers.size} ≠ JSON ${batch.questions.length}`,
      });
    }

    const seenNumbers = new Set<number>();
    const stmts: string[] = [];
    let pass = 0;
    let excluded = 0;
    let corrected = 0;

    for (const q of batch.questions) {
      // 정직 제외 (구조 훼손 — 리포트 영속, 무음 skip 아님).
      const exclusion = exclusionById.get(q.id);
      if (exclusion !== undefined) {
        usedExclusions.add(q.id);
        excluded += 1;
        continue;
      }

      const correction = correctionById.get(q.id);
      const effectiveAnswer = correction?.corrected ?? q.answer;
      const localViolations: Violation[] = [];

      // V1 — parseMcChoices 계약 (교정 반영 answer 기준 — 서빙될 값).
      const mc = parseMcChoices(JSON.stringify(q.options), effectiveAnswer);
      if (!mc.ok) {
        localViolations.push({ id: q.id, check: 'V1-contract', detail: mc.reason });
      }
      // V2 — 4지 고정.
      if (q.options.length !== 4) {
        localViolations.push({ id: q.id, check: 'V2-choices4', detail: `${q.options.length}지` });
      }
      // V3 — 무결성.
      if (typeof q.stem !== 'string' || q.stem.trim().length < 5) {
        localViolations.push({ id: q.id, check: 'V3-stem', detail: 'stem 결손' });
      }
      if (typeof q.subject !== 'string' || q.subject.trim() === '') {
        localViolations.push({ id: q.id, check: 'V3-subject', detail: 'subject 결손' });
      }
      if (q.year !== year || q.round !== round || q.exam_type !== '1st') {
        localViolations.push({ id: q.id, check: 'V3-axes', detail: 'year/round/exam_type 불일치' });
      }
      if (
        !Number.isInteger(q.question_number) ||
        q.question_number < 1 ||
        q.question_number > 75 ||
        seenNumbers.has(q.question_number)
      ) {
        localViolations.push({
          id: q.id,
          check: 'V3-qnum',
          detail: `question_number ${q.question_number} (중복/범위)`,
        });
      }
      seenNumbers.add(q.question_number);
      // V4 — 원 SQL answer ↔ 원본 JSON answer (소스 자기일관성 — 교정 전 값 기준).
      const origAnswer = originalAnswers.get(q.id);
      if (origAnswer !== q.answer) {
        localViolations.push({
          id: q.id,
          check: 'V4-answer',
          detail: `JSON=${q.answer} vs 원SQL=${origAnswer ?? '(부재)'}`,
        });
      }
      // 교정 오버레이 무결성 — original 필드가 실제 원본과 일치해야 적용.
      if (correction !== undefined && correction.original !== q.answer) {
        localViolations.push({
          id: q.id,
          check: 'V5-correction',
          detail: `교정 original=${correction.original} ≠ JSON=${q.answer}`,
        });
      }

      if (localViolations.length > 0) {
        violations.push(...localViolations);
        continue;
      }
      pass += 1;
      if (correction !== undefined) {
        usedCorrections.add(q.id);
        corrected += 1;
      }

      // answer 컬럼: 교정 문항 = 교정값 리터럴 (old 행 오답 승계 금지) / 그 외 = old 행 승계.
      const answerExpr =
        correction !== undefined ? `'${sqlEscape(correction.corrected)}'` : 'answer';
      stmts.push(
        `INSERT INTO exam_questions (id, year, round, question_number, subject, content, answer, explanation, related_nodes, related_constants, status, exam_type, topic_cluster, memorization_type, confusion_type, input_type, distractors, calc_variables)
SELECT id || '-MC', year, round, question_number, subject, '${sqlEscape(q.stem)}', ${answerExpr}, explanation, related_nodes, related_constants, 'active', exam_type, topic_cluster, memorization_type, confusion_type, 'multiple_choice', '${sqlEscape(JSON.stringify(q.options))}', calc_variables
FROM exam_questions
WHERE id = '${sqlEscape(q.id)}' AND exam_type = '1st' AND status = 'active' AND answer = '${sqlEscape(q.answer)}';`,
      );
    }

    const key = `round-${round}`;
    const expectedPass = batch.questions.length - excluded;
    if (pass === expectedPass && batch.questions.length === 75) {
      const sqlFile = `insert-round-${round}.sql`;
      const header = `-- promo-1st P3 — 제${round}회(${year}) 1차 4지선다 신규 MC 행 ${pass}건 (순수 INSERT, old 행 무접촉)
-- 소스: docs/batch-load/${dirName}/${files[0]} + answer-corrections.json (교정 ${corrected}·제외 ${excluded})
-- 전략: ADR-046 D-6(a) 정합 — {oldId}-MC 신규 행 + INSERT...SELECT 메타 승계 + answer 가드
-- 검산 (적용 직후 기계 실행 의무): SELECT COUNT(*) FROM exam_questions WHERE id LIKE '%-MC' AND round=${round}; -- 기대 ${pass}
-- 부분 실패 복구: SELECT id FROM exam_questions WHERE id LIKE '%-MC' AND round=${round}; 로 기적재분 확인 후 잔여만 재실행
PRAGMA foreign_keys = ON;

`;
      writeFileSync(join(OUT_DIR, sqlFile), header + stmts.join('\n\n') + '\n');
      perRound[key] = { total: batch.questions.length, pass, excluded, corrected, sqlFile };
    } else {
      perRound[key] = { total: batch.questions.length, pass, excluded, corrected, sqlFile: null };
      violations.push({
        id: dirName,
        check: 'ROUND-incomplete',
        detail: `pass=${pass}/${expectedPass} (total=${batch.questions.length}) — SQL 미생성`,
      });
    }
  }

  // 오버레이 고아 항목 검출 (오타 id = 무음 미적용 차단).
  for (const c of overlay.corrections) {
    if (!usedCorrections.has(c.id) && !exclusionById.has(c.id)) {
      violations.push({ id: c.id, check: 'V5-orphan', detail: '교정 대상 id 미발견/미적용' });
    }
  }
  for (const e of overlay.exclusions) {
    if (!usedExclusions.has(e.id)) {
      violations.push({ id: e.id, check: 'V5-orphan', detail: '제외 대상 id 미발견' });
    }
  }

  const report = {
    generatedBy: 'scripts/promo-p3/build-mc-inserts.ts',
    totalQuestions: Object.values(perRound).reduce((a, r) => a + r.total, 0),
    totalPass: Object.values(perRound).reduce((a, r) => a + r.pass, 0),
    totalExcluded: Object.values(perRound).reduce((a, r) => a + r.excluded, 0),
    totalCorrected: Object.values(perRound).reduce((a, r) => a + r.corrected, 0),
    perRound,
    overlay: {
      corrections: overlay.corrections,
      exclusions: overlay.exclusions,
    },
    violations,
    gates: {
      'V1-contract': 'parseMcChoices(단일 정본) — 교정 반영 answer 기준',
      'V2-choices4': '4지 고정 (1차 전 회차 실측)',
      'V3-integrity': 'stem/subject/축/문항번호 전단사',
      'V4-answer': 'repo 원 insert SQL ↔ 원본 JSON answer 자기일관성',
      'V5-correction': '교정 오버레이 original 정합 + 고아 검출',
    },
  };
  writeFileSync(join(OUT_DIR, 'validation-report.json'), JSON.stringify(report, null, 2) + '\n');

  const fail = violations.length > 0;
  const lines = [
    `[promo-p3] pass=${report.totalPass} excluded=${report.totalExcluded} corrected=${report.totalCorrected} / total=${report.totalQuestions} · violations=${violations.length}` +
      (fail ? ' ⚠️ FAIL' : ' ✅'),
    ...Object.entries(perRound).map(
      ([k, v]) =>
        `  ${k}: pass=${v.pass} excl=${v.excluded} corr=${v.corrected} ${v.sqlFile ?? '(SQL 미생성)'}`,
    ),
  ];
  if (fail) {
    lines.push(`  violations: ${JSON.stringify(violations.slice(0, 10), null, 2)}`);
    process.exitCode = 1;
  }
  process.stdout.write(lines.join('\n') + '\n');
}

main();
