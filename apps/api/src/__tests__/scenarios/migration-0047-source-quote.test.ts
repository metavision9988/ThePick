/**
 * 마이그레이션 0047 — source_quote 축 회귀 테스트 (역이식 STAGE 2).
 *
 * 정책 출처: docs/plans/current.plan.md §검증 계획 G-S2-1~5 (진산 2026-08-08 "stage 2 진행")
 *   + docs/plans/catchall-역이식-체크리스트.md STAGE 2 (2-1·2-2·2-3)
 *   STATUS: 선작성본 검증 (production 적용 = 별도 인증 게이트).
 *
 * 세 반:
 *   [1] 칸 신설      — 3종 테이블 source_quote TEXT
 *   [2] 백필 규율    — NULL→값 1회만 허용 (값→값·값→NULL 은 ABORT)
 *   [3] 적재 의무화  — batch_id 선언 행은 원문 없이 INSERT 불가 (공백도 거부)
 *
 * ★본 파일이 특히 고정하는 것 2가지:
 *   · **경계**: batch_id 없는 INSERT 는 게이트 밖 — 의도된 경계이지 구멍이 아니다(G-S2-4).
 *     이 테스트가 red 가 되면 21개 INSERT 표면이 깨진다는 뜻이므로 조기 경보다.
 *   · **무회귀**: 0041 이 연 기존 화이트리스트(valid_*·source_url 등)가 재생성으로 소실되지 않았는가(G-S2-5).
 *     트리거 재생성은 그 자체가 회귀 표면이다.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createD1FromAllMigrations,
  createD1FromSqlite,
  SCENARIO_MIGRATIONS,
  type SqliteBackedD1,
} from '../helpers/d1-from-sqlite.js';

/** batch_id 없는 노드 — 테스트·수기 경로 (적재 게이트 밖). */
async function insertNode(
  backend: SqliteBackedD1,
  id: string,
  sourceQuote: string | null = null,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page, source_quote)
       VALUES (?, 'LAW', ?, '법 제1조', 2026, 10, 'draft', 1, 1, ?)`,
    )
    .bind(id, `노드 ${id}`, sourceQuote)
    .run();
}

/** batch_id 선언 노드 — 배치 적재 서식 (게이트 대상). */
async function insertBatchNode(
  backend: SqliteBackedD1,
  id: string,
  sourceQuote: string | null,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page, batch_id, source_quote)
       VALUES (?, 'LAW', ?, '법 제1조', 2026, 10, 'draft', 1, 1, 'BATCH-TEST', ?)`,
    )
    .bind(id, `노드 ${id}`, sourceQuote)
    .run();
}

async function insertFormula(backend: SqliteBackedD1, id: string): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO formulas (id, name, equation_template, variables_schema, version_year, page_ref)
       VALUES (?, '테스트 산식', 'a * b', '{}', 2026, 'p.1')`,
    )
    .bind(id)
    .run();
}

async function insertConstant(backend: SqliteBackedD1, id: string): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO constants (id, category, name, value, applies_to, version_year, page_ref)
       VALUES (?, 'ratio', '테스트 상수', '65', '전체', 2026, 'p.1')`,
    )
    .bind(id)
    .run();
}

async function setQuote(
  backend: SqliteBackedD1,
  table: 'knowledge_nodes' | 'formulas' | 'constants',
  id: string,
  quote: string | null,
): Promise<void> {
  await backend.db
    .prepare(`UPDATE ${table} SET source_quote = ? WHERE id = ?`)
    .bind(quote, id)
    .run();
}

async function readQuote(
  backend: SqliteBackedD1,
  table: 'knowledge_nodes' | 'formulas' | 'constants',
  id: string,
): Promise<string | null> {
  const row = await backend.db
    .prepare(`SELECT source_quote AS q FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<{ q: string | null }>();
  return row?.q ?? null;
}

const QUOTE = '제8조(보험사업자) ① 재해보험사업을 할 수 있는 자는 다음 각 호와 같다.';

describe('마이그레이션 0047 [1][2] source_quote 칸 + 백필 규율', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('G-S2-1 — 3종 테이블에 source_quote 실재 + 기존 행은 NULL 로 시작 (무회귀)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-1');
    await insertFormula(backend, 'F-1');
    await insertConstant(backend, 'C-1');
    expect(await readQuote(backend, 'knowledge_nodes', 'NODE-1')).toBeNull();
    expect(await readQuote(backend, 'formulas', 'F-1')).toBeNull();
    expect(await readQuote(backend, 'constants', 'C-1')).toBeNull();
  });

  it('G-S2-2a — NULL→값 백필 통과 (3종 대칭)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-2');
    await insertFormula(backend, 'F-2');
    await insertConstant(backend, 'C-2');
    await setQuote(backend, 'knowledge_nodes', 'NODE-2', QUOTE);
    await setQuote(backend, 'formulas', 'F-2', QUOTE);
    await setQuote(backend, 'constants', 'C-2', QUOTE);
    expect(await readQuote(backend, 'knowledge_nodes', 'NODE-2')).toBe(QUOTE);
    expect(await readQuote(backend, 'formulas', 'F-2')).toBe(QUOTE);
    expect(await readQuote(backend, 'constants', 'C-2')).toBe(QUOTE);
  });

  it('★G-S2-2b — 값→값 변경 = ABORT (한 번 채운 인용은 불변)', async () => {
    if (!backend) throw new Error('backend not initialized');
    // 사후 수정이 가능하면 "원문 대조"가 원문을 고쳐 통과시키는 경로가 된다.
    await insertNode(backend, 'NODE-3');
    await setQuote(backend, 'knowledge_nodes', 'NODE-3', QUOTE);
    await expect(setQuote(backend, 'knowledge_nodes', 'NODE-3', '위조된 인용')).rejects.toThrow(
      /forbidden/,
    );
    await insertFormula(backend, 'F-3');
    await setQuote(backend, 'formulas', 'F-3', QUOTE);
    await expect(setQuote(backend, 'formulas', 'F-3', '위조')).rejects.toThrow(/forbidden/);
    await insertConstant(backend, 'C-3');
    await setQuote(backend, 'constants', 'C-3', QUOTE);
    await expect(setQuote(backend, 'constants', 'C-3', '위조')).rejects.toThrow(/forbidden/);
  });

  it('G-S2-2c — 값→NULL 되돌리기 = ABORT', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-4');
    await setQuote(backend, 'knowledge_nodes', 'NODE-4', QUOTE);
    await expect(setQuote(backend, 'knowledge_nodes', 'NODE-4', null)).rejects.toThrow(/forbidden/);
  });

  it('★G-S2-5 — 0041 기존 화이트리스트 무회귀 (재생성으로 소실되지 않았는가)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-5');
    // valid_from / valid_until / source_url / source_article_code = NULL→값 1회 허용 (0041)
    await backend.db
      .prepare(
        `UPDATE knowledge_nodes SET valid_from = '2020-01-01', source_url = 'https://law.go.kr/x',
           source_article_code = 'ART-8' WHERE id = 'NODE-5'`,
      )
      .run();
    const row = await backend.db
      .prepare(`SELECT valid_from AS vf, source_url AS su FROM knowledge_nodes WHERE id = 'NODE-5'`)
      .first<{ vf: string; su: string }>();
    expect(row?.vf).toBe('2020-01-01');
    expect(row?.su).toBe('https://law.go.kr/x');
    // 그리고 값→값은 여전히 차단
    await expect(
      backend.db
        .prepare(`UPDATE knowledge_nodes SET valid_from = '2021-01-01' WHERE id = 'NODE-5'`)
        .run(),
    ).rejects.toThrow(/forbidden/);
    // 본문 컬럼(description)도 여전히 차단
    await expect(
      backend.db
        .prepare(`UPDATE knowledge_nodes SET description = '변조' WHERE id = 'NODE-5'`)
        .run(),
    ).rejects.toThrow(/forbidden/);
  });

  it('★G-S2-5c — 가드 WHEN 절 컬럼 **전수 고정** (독립 리뷰 MAJOR: 4/25 만 검사하던 구멍)', async () => {
    if (!backend) throw new Error('backend not initialized');
    // 초판 G-S2-5 는 valid_from·source_url·source_article_code·description 4개만 단언했다.
    // 실측 역검증: 0047 에서 `OR NEW.book_page IS NOT OLD.book_page` 를 지워도 테스트가 green 이었다
    // = **가드의 가드**가 없었다. 재생성 마이그의 최대 위험은 "조용한 컬럼 누락"이므로 전수를 핀 고정한다.
    const row = await backend.db
      .prepare(
        `SELECT sql FROM sqlite_master WHERE type='trigger' AND name='prevent_knowledge_nodes_update'`,
      )
      .first<{ sql: string }>();
    const guarded = new Set(
      [...(row?.sql ?? '').matchAll(/NEW\.([a-z0-9_]+)\s+IS NOT OLD\./g)].map((m) => m[1]!),
    );
    // 0041 판본이 지키던 컬럼 + 0047 신설 1개. 하나라도 빠지면 그 컬럼의 본문 UPDATE 가 무음 통과한다.
    for (const col of [
      'id',
      'type',
      'name',
      'description',
      'lv1_insurance',
      'lv2_crop',
      'lv3_investigation',
      'page_ref',
      'batch_id',
      'version_year',
      'superseded_by',
      'truth_weight',
      'status',
      'exam_scope',
      'book_page',
      'pdf_page',
      'chapter',
      'section',
      'created_at',
      'batch_run_id',
      'source_id',
      'valid_from',
      'valid_until',
      'source_url',
      'source_article_code',
      'source_quote',
    ]) {
      expect(
        guarded.has(col),
        `가드 WHEN 절에 ${col} 누락 — 이 컬럼의 UPDATE 가 무음 통과한다`,
      ).toBe(true);
    }
  });

  it('★G-S2-3f — 보이지 않는 문자만 채운 값도 ABORT (전각공백·NBSP·ZWSP·BOM 등)', async () => {
    if (!backend) throw new Error('backend not initialized');
    // 독립 리뷰 MAJOR 실측: 초판 trim(ASCII 4종)에서 아래 10종이 전부 통과했다.
    const invisible = [
      '\u3000',
      '\u00A0',
      '\u200B',
      '\uFEFF',
      '\u2007',
      '\u000B',
      '\u0085',
      '\u200E',
      '\u00AD',
      '  \u3000  ',
    ];
    for (const [i, blank] of invisible.entries()) {
      await expect(
        insertBatchNode(backend, `BATCH-INVIS-${i}`, blank),
        `보이지 않는 문자(${JSON.stringify(blank)})가 원문 행세를 한다`,
      ).rejects.toThrow(/Batch load blocked/);
    }
  });

  it('G-S2-5b — is_current_active flip 은 종전대로 허용 (0013 steady-state)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-6');
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET is_current_active = 0 WHERE id = 'NODE-6'`)
      .run();
    const row = await backend.db
      .prepare(`SELECT is_current_active AS a FROM knowledge_nodes WHERE id = 'NODE-6'`)
      .first<{ a: number }>();
    expect(row?.a).toBe(0);
  });
});

describe('마이그레이션 0047 [3] 적재 의무화 — batch_id 선언 행은 원문 필수', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('G-S2-3a — batch_id 있고 source_quote NULL = ABORT', async () => {
    if (!backend) throw new Error('backend not initialized');
    await expect(insertBatchNode(backend, 'BATCH-NULL', null)).rejects.toThrow(
      /Batch load blocked/,
    );
  });

  it('★G-S2-3b — 공백만 채운 것도 ABORT (빈 문자열·스페이스·탭·개행)', async () => {
    if (!backend) throw new Error('backend not initialized');
    // "채웠다"의 가장 흔한 위조 형태 — 전부 거부해야 한다.
    for (const [i, blank] of ['', ' ', '   ', '\t', '\n', ' \t\n '].entries()) {
      await expect(insertBatchNode(backend, `BATCH-BLANK-${i}`, blank)).rejects.toThrow(
        /Batch load blocked/,
      );
    }
  });

  it('G-S2-3c — batch_id 있고 실제 원문이 있으면 통과', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertBatchNode(backend, 'BATCH-OK', QUOTE);
    expect(await readQuote(backend, 'knowledge_nodes', 'BATCH-OK')).toBe(QUOTE);
  });

  it('★G-S2-4 — batch_id 없는 INSERT 는 게이트 밖 (의도된 경계 — 21개 표면 무회귀)', async () => {
    if (!backend) throw new Error('backend not initialized');
    // 이 테스트가 red 면 테스트 픽스처·수기 SQL·마이그레이션 경로가 전부 깨진다는 뜻이다.
    // 전역 강제는 기존 857 행 백필(2-4) 완료 후에만 가능하며 그것이 STAGE 3 진입 조건이다.
    await insertNode(backend, 'PLAIN-1', null);
    await insertNode(backend, 'PLAIN-2', '');
    expect(await readQuote(backend, 'knowledge_nodes', 'PLAIN-1')).toBeNull();
  });

  it('G-S2-3d — formulas/constants 는 적재 게이트 대상 아님 (적재 선언 컬럼 부재 — 명시 경계)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertFormula(backend, 'F-NOGATE');
    await insertConstant(backend, 'C-NOGATE');
    expect(await readQuote(backend, 'formulas', 'F-NOGATE')).toBeNull();
    expect(await readQuote(backend, 'constants', 'C-NOGATE')).toBeNull();
  });

  it('G-S2-3e — 트리거 실재 + 공백 판정이 trim 기반인지 SQL 핀', async () => {
    if (!backend) throw new Error('backend not initialized');
    const row = await backend.db
      .prepare(
        `SELECT sql FROM sqlite_master WHERE type='trigger' AND name='require_source_quote_on_batch_load'`,
      )
      .first<{ sql: string }>();
    expect(row?.sql).toBeTruthy();
    expect(row?.sql).toMatch(/batch_id IS NOT NULL/);
    expect(row?.sql, '공백 거부 부재 — 빈 문자열이 통과한다').toMatch(/trim\(/);
  });
});

/**
 * G-S2-7 — 백필 SQL end-to-end (역이식 STAGE 2 · 2-4).
 *
 * ★production 과 **같은 순서**를 재현한다: 노드는 0047 이전에 이미 적재돼 있고(현 production 상태),
 *   그 위에 0047 을 적용한 뒤 백필을 돌린다. 순서를 바꾸면 실제와 다른 것을 검증하게 된다.
 */
describe('G-S2-7 — LAW 59장 백필 SQL e2e', () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
  const gapSqlPaths = [
    join(ROOT, 'docs/batch-load/gap-P1/gap-P1-insert.sql'),
    join(ROOT, 'docs/batch-load/gap-P2/gap-P2-insert.sql'),
  ];
  const backfillPath = join(ROOT, 'docs/batch-load/stage2-source-quote/backfill-source-quote.sql');

  it('노드 선적재(0047 이전) → 0047 적용 → 백필 = 58행 원문 보유(LAW-202 의도적 제외) · 재실행 0행', async () => {
    // 1) 0047 을 뺀 DB = 백필 대상이 만들어진 시점의 production
    const legacy = createD1FromSqlite(SCENARIO_MIGRATIONS.filter((m) => !m.startsWith('0047_')));
    try {
      for (const p of gapSqlPaths) {
        // 노드 INSERT 문만 취한다(엣지·주석 제외 — 본 테스트 관심사는 source_quote 백필).
        for (const line of readFileSync(p, 'utf-8').split('\n')) {
          if (line.startsWith('INSERT OR IGNORE INTO knowledge_nodes')) {
            legacy.raw.exec(line);
          }
        }
      }
      const before = legacy.raw
        .prepare(
          `SELECT COUNT(*) AS c FROM knowledge_nodes WHERE id LIKE 'LAW-1%' OR id LIKE 'LAW-2%'`,
        )
        .get() as { c: number };
      expect(before.c).toBe(59);

      // 2) 0047 적용 (칸 + 가드 + 적재 게이트)
      legacy.raw.exec(readFileSync(join(ROOT, 'migrations/0047_source_quote_axis.sql'), 'utf-8'));

      // 3) 백필
      legacy.raw.exec(readFileSync(backfillPath, 'utf-8'));

      const filled = legacy.raw
        .prepare(
          `SELECT COUNT(*) AS c FROM knowledge_nodes
            WHERE source_quote IS NOT NULL AND trim(source_quote) != ''`,
        )
        .get() as { c: number };
      // 59 중 LAW-202 는 **의도적 제외**(고시 실체 = 미적재 표 → 넣으면 STAGE 3 가 실체 없이 통과).
      // 제외는 조용히 빠지지 않고 excluded.json + 게이트 출력에 사유가 남는다.
      expect(filled.c, '58장 원문 보유 + LAW-202 의도적 제외').toBe(58);
      const excluded = legacy.raw
        .prepare(`SELECT source_quote AS q FROM knowledge_nodes WHERE id = 'LAW-202'`)
        .get() as { q: string | null };
      expect(excluded.q, 'LAW-202 는 NULL 로 남아 커버리지에 미검증으로 계상돼야 한다').toBeNull();

      // 4) ★멱등성 — 재실행해도 터지지 않고 0행 (0047 값→값 가드와 충돌하지 않는다)
      legacy.raw.exec(readFileSync(backfillPath, 'utf-8'));
      const still = legacy.raw
        .prepare(`SELECT COUNT(*) AS c FROM knowledge_nodes WHERE source_quote IS NOT NULL`)
        .get() as { c: number };
      expect(still.c).toBe(58);

      // 5) ★description 복사가 아닌가 — 하나라도 같으면 검증이 자기 대조가 된다
      const same = legacy.raw
        .prepare(
          `SELECT COUNT(*) AS c FROM knowledge_nodes
            WHERE source_quote IS NOT NULL AND source_quote = description`,
        )
        .get() as { c: number };
      expect(same.c, 'description 과 동일한 원문이 있으면 STAGE 3 가 공허해진다').toBe(0);
    } finally {
      legacy.close();
    }
  });

  it('★백필 후에는 원문 수정이 막힌다 (사후 위조 차단)', async () => {
    const legacy = createD1FromSqlite(SCENARIO_MIGRATIONS.filter((m) => !m.startsWith('0047_')));
    try {
      for (const line of readFileSync(gapSqlPaths[0]!, 'utf-8').split('\n')) {
        if (line.startsWith('INSERT OR IGNORE INTO knowledge_nodes')) legacy.raw.exec(line);
      }
      legacy.raw.exec(readFileSync(join(ROOT, 'migrations/0047_source_quote_axis.sql'), 'utf-8'));
      legacy.raw.exec(readFileSync(backfillPath, 'utf-8'));
      expect(() =>
        legacy.raw.exec(`UPDATE knowledge_nodes SET source_quote = '위조' WHERE id = 'LAW-144'`),
      ).toThrow(/forbidden/);
    } finally {
      legacy.close();
    }
  });
});
