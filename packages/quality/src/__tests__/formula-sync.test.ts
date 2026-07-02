/**
 * formula-sync 코어 검증 — WS-3c (G-WS3 ⑤ 의 CI 채점기).
 *
 * 2층 구성:
 *   ① 합성 픽스처 — 대조 술어(byte/정규화 일치·drift 3종·중복 차단·결정성) 고정.
 *   ② 실 코드 레지스트리(batch1~5-definitions 직수입) ↔ production 고정 픽스처
 *      (fixtures/formulas-production-20260702.json, 2026-07-02 SELECT-only 덤프)
 *      — plan §4 실행면 C 의 A축(무인증 CI 게이트, 라이브 의존 0).
 *
 * ★ batch*-definitions **직수입** (formulas/index.ts 레지스트리 미경유):
 *   레지스트리 로드는 등록시 safeParse 를 실행한다 — G-WS3c-6("대조 경로 parse 실행 0")
 *   보수 준수를 위해 순수 데이터 모듈만 읽는다 (plan §3.3). 정의 파일은 읽기 전용 참조.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BATCH1_FORMULAS } from '@thepick/formula-engine/src/formulas/batch1-definitions';
import { BATCH2_FORMULAS } from '@thepick/formula-engine/src/formulas/batch2-definitions';
import { BATCH3_FORMULAS } from '@thepick/formula-engine/src/formulas/batch3-definitions';
import { BATCH4_FORMULAS } from '@thepick/formula-engine/src/formulas/batch4-definitions';
import { BATCH5_FORMULAS } from '@thepick/formula-engine/src/formulas/batch5-definitions';

import {
  buildFormulaSyncManifest,
  equationTemplateFingerprint,
  expectedEngineBackedFormulaIds,
  normalizeEquationTemplate,
  EXPECTED_ENGINE_BACKED_FORMULA_COUNT,
  type CodeFormulaEntry,
  type D1FormulaSyncRow,
} from '../formula-sync';

// --- 합성 픽스처 헬퍼 ---

function codeEntry(id: string, template: string): CodeFormulaEntry {
  return { id, name: `산식 ${id}`, equationTemplate: template };
}

function d1Row(
  id: string,
  template: string,
  overrides: Partial<D1FormulaSyncRow> = {},
): D1FormulaSyncRow {
  return {
    id,
    node_id: id,
    equation_template: template,
    variables_schema: '{"x":"표본수 integer>=0"}',
    version_year: 2026,
    is_current_active: 1,
    equation_display: null,
    expected_inputs: null,
    graceful_degradation: null,
    ...overrides,
  };
}

/** 결정성 비교용 — generatedAt 고정 주입 (G-WS3c-2 "Date 외"). */
const FIXED_AT = '2026-07-02T00:00:00.000Z';

// --- ① 정규화 (PITR B) ---

describe('normalizeEquationTemplate / equationTemplateFingerprint', () => {
  it('공백 표기차를 흡수한다 — ceil( x ) vs ceil(x) (plan §4 B 근거 열)', () => {
    expect(normalizeEquationTemplate('ceil( total * ( a / b ) )')).toBe('ceil(total*(a/b))');
    expect(equationTemplateFingerprint('ceil( x )')).toBe(equationTemplateFingerprint('ceil(x)'));
  });

  it('계수 차이는 다른 지문 — 1.0115 vs 1.0116 (65↔60 클래스 오류 검출)', () => {
    const a = equationTemplateFingerprint('max(1.0115 * r - 0.0014 * d, 0)');
    const b = equationTemplateFingerprint('max(1.0116 * r - 0.0014 * d, 0)');
    expect(a).not.toBe(b);
  });
});

// --- ② 대조 본체 (합성) ---

describe('buildFormulaSyncManifest — 합성 대조', () => {
  it('byte 일치 + 공백 표기차 = normalizedMatch true·drift 0', () => {
    const manifest = buildFormulaSyncManifest(
      [codeEntry('F-01', 'a / (a + b)'), codeEntry('F-02', 'ceil(x * y)')],
      [d1Row('F-01', 'a / (a + b)'), d1Row('F-02', 'ceil( x * y )')],
      { generatedAt: FIXED_AT },
    );
    expect(manifest.engineBacked).toHaveLength(2);
    expect(manifest.engineBacked[0]).toMatchObject({
      id: 'F-01',
      match: true,
      normalizedMatch: true,
    });
    // 공백 표기차: byte 불일치이나 정규화 일치 = drift 아님 (게이트 키 = normalizedMatch)
    expect(manifest.engineBacked[1]).toMatchObject({
      id: 'F-02',
      match: false,
      normalizedMatch: true,
    });
    expect(manifest.drift).toHaveLength(0);
    expect(manifest.gate.engineBackedAllMatch).toBe(true);
  });

  it('template-mismatch — 계수 드리프트를 drift 로 표면화한다', () => {
    const manifest = buildFormulaSyncManifest(
      [codeEntry('F-06', 'max(1.0115 * r - 0.0014 * d, 0)')],
      [d1Row('F-06', 'max(1.0116 * r - 0.0014 * d, 0)')],
      { generatedAt: FIXED_AT },
    );
    expect(manifest.drift).toEqual([{ id: 'F-06', kind: 'template-mismatch' }]);
    expect(manifest.engineBacked[0]!.normalizedMatch).toBe(false);
    expect(manifest.gate.engineBackedAllMatch).toBe(false);
    expect(manifest.gate.pass).toBe(false);
  });

  it('code-missing-in-d1 — 코드 등록 산식이 D1 에 없으면 drift', () => {
    const manifest = buildFormulaSyncManifest(
      [codeEntry('F-01', 'a / b'), codeEntry('F-02', 'a * b')],
      [d1Row('F-01', 'a / b')],
      { generatedAt: FIXED_AT },
    );
    expect(manifest.drift).toEqual([{ id: 'F-02', kind: 'code-missing-in-d1' }]);
    expect(manifest.engineBacked.find((e) => e.id === 'F-02')).toMatchObject({
      d1Template: null,
      d1Fingerprint: null,
      normalizedMatch: false,
    });
  });

  it('d1-missing-in-code — 기대 권역(F-01~F-68) ID 가 코드에서 사라지면 drift (display-only 은폐 금지)', () => {
    const manifest = buildFormulaSyncManifest(
      [codeEntry('F-01', 'a / b')],
      [d1Row('F-01', 'a / b'), d1Row('F-30', 'x * y'), d1Row('F-69', 'p + q')],
      { generatedAt: FIXED_AT },
    );
    // F-30 = 기대 권역 회귀 → drift / F-69 = 권역 밖 = display-only (plan §3.1 정의)
    expect(manifest.drift).toEqual([{ id: 'F-30', kind: 'd1-missing-in-code' }]);
    expect(manifest.displayOnly).toEqual([{ id: 'F-69', d1Template: 'p + q' }]);
  });

  it('중복 ID 는 조용히 삼키지 않고 즉시 실패한다 (양측)', () => {
    expect(() =>
      buildFormulaSyncManifest(
        [codeEntry('F-01', 'a'), codeEntry('F-01', 'b')],
        [d1Row('F-01', 'a')],
      ),
    ).toThrow(/code 측 중복 ID 'F-01'/);
    expect(() =>
      buildFormulaSyncManifest([codeEntry('F-01', 'a')], [d1Row('F-01', 'a'), d1Row('F-01', 'a')]),
    ).toThrow(/d1 측 중복 ID 'F-01'/);
  });

  it('G-WS3c-2 결정성 — 동일 입력(순서 뒤집기 포함) 2회 = byte-동일 직렬 (generatedAt 고정)', () => {
    const code = [codeEntry('F-02', 'c / d'), codeEntry('F-01', 'a / b')];
    const rows = [d1Row('F-69', 'p'), d1Row('F-01', 'a / b'), d1Row('F-02', 'c / d')];
    const first = JSON.stringify(buildFormulaSyncManifest(code, rows, { generatedAt: FIXED_AT }));
    const second = JSON.stringify(
      buildFormulaSyncManifest([...code].reverse(), [...rows].reverse(), { generatedAt: FIXED_AT }),
    );
    expect(second).toBe(first);
  });

  it('미적재 3컬럼 populated 카운트 + version_year 분포 (PITR A / A+B 정직 표기)', () => {
    const manifest = buildFormulaSyncManifest(
      [codeEntry('F-01', 'a / b')],
      [
        d1Row('F-01', 'a / b', { version_year: 2025, equation_display: '가나 ÷ 다라' }),
        d1Row('F-69', 'p', { version_year: 2026 }),
        d1Row('F-70', 'q', { version_year: 2026, expected_inputs: '' }), // '' = 미적재 취급
      ],
      { generatedAt: FIXED_AT },
    );
    expect(manifest.unpopulatedColumns).toEqual({
      equation_display: 1,
      expected_inputs: 0,
      graceful_degradation: 0,
    });
    expect(manifest.versionYear.excludedFromComparison).toBe(true);
    expect(manifest.versionYear.d1Distribution).toEqual({ '2025': 1, '2026': 2 });
  });
});

// --- ③ 실 레지스트리 ↔ production 고정 픽스처 (G-WS3 ⑤ CI 게이트) ---

/** 코드 레지스트리 사영 — batch1~5 스프레드 = formulas/index.ts ALL_FORMULAS 와 동일 집합. */
const CODE_ENTRIES: readonly CodeFormulaEntry[] = [
  ...BATCH1_FORMULAS,
  ...BATCH2_FORMULAS,
  ...BATCH3_FORMULAS,
  ...BATCH4_FORMULAS,
  ...BATCH5_FORMULAS,
].map((f) => ({ id: f.id, name: f.name, equationTemplate: f.equationTemplate }));

interface ProductionFixture {
  readonly _source: string;
  readonly _rowCount: number;
  readonly rows: readonly D1FormulaSyncRow[];
}

const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/formulas-production-20260702.json', import.meta.url), 'utf-8'),
) as ProductionFixture;

describe('실 코드 레지스트리 ↔ production 픽스처 (2026-07-02 동결)', () => {
  it('픽스처 자체 정합 — _rowCount 와 rows 길이 일치 (절단 덤프 커밋 차단)', () => {
    expect(FIXTURE.rows.length).toBe(FIXTURE._rowCount);
    expect(FIXTURE.rows.length).toBeGreaterThan(EXPECTED_ENGINE_BACKED_FORMULA_COUNT);
  });

  it('코드 레지스트리 = 정확히 F-01~F-68 (plan §1.1 — 13+17+8+15+15)', () => {
    const codeIds = new Set(CODE_ENTRIES.map((e) => e.id));
    expect(codeIds.size).toBe(EXPECTED_ENGINE_BACKED_FORMULA_COUNT);
    expect(codeIds).toEqual(expectedEngineBackedFormulaIds());
  });

  /**
   * ★ 측정 워터마크 (2026-07-02 1차 실측 — fabricate 금지, RULE #4/#5):
   * 일치 = F-01~F-13 (13건, BATCH-1) / template-mismatch = F-14~F-68 (55건).
   * 덤프는 production == docs/batch-load/batch-N-insert.sql 스팟 대조(F-14 batch-2:135 /
   * F-30 batch-2:151 / F-68 batch-4:147)로 검증 — 즉 코드 batch2~5-definitions.ts 와
   * BATCH-2~5 적재물이 ID 배정·변수 어휘부터 분화된 **선재 드리프트 실측**이지 도구
   * 오류가 아니다 (예: D1 F-68 = 마늘 표준피해율(batch-4 SQL) vs 코드 F-68 = 무화과
   * 잔여수확량비율). 본 테스트는 이 측정 사실을 골든으로 고정한다 — 코드/픽스처
   * 어느 쪽이 변해도 표면화. G-WS3c-4(전수 일치 PASS)의 해소 방향(코드 vs D1 어느
   * 쪽이 진실원인가)은 진산 결재 사안 (plan §9 — AI 판정 금지).
   */
  it('G-WS3c-1: 차분 정확 (68/89) + 2026-07-02 실측 워터마크 (일치 13 / mismatch 55 = F-14~F-68)', () => {
    const manifest = buildFormulaSyncManifest(CODE_ENTRIES, FIXTURE.rows, {
      generatedAt: FIXED_AT,
    });
    expect(manifest.engineBacked).toHaveLength(EXPECTED_ENGINE_BACKED_FORMULA_COUNT);
    expect(manifest.displayOnly).toHaveLength(
      FIXTURE.rows.length - EXPECTED_ENGINE_BACKED_FORMULA_COUNT,
    );

    const matchedIds = manifest.engineBacked.filter((e) => e.normalizedMatch).map((e) => e.id);
    const expectedMatched = Array.from(
      { length: 13 },
      (_, i) => `F-${String(i + 1).padStart(2, '0')}`,
    );
    expect(matchedIds).toEqual(expectedMatched);
    // byte 일치 = 정규화 일치와 동일 집합 (공백 표기차 0건 실측)
    expect(manifest.engineBacked.filter((e) => e.match).map((e) => e.id)).toEqual(expectedMatched);

    const expectedMismatched = Array.from({ length: 55 }, (_, i) => ({
      id: `F-${i + 14}`,
      kind: 'template-mismatch' as const,
    }));
    expect(manifest.drift).toEqual(expectedMismatched);
    expect(manifest.gate).toEqual({
      diffExact: true, // G-WS3c-1 PASS
      engineBackedAllMatch: false, // G-WS3c-4 FAIL — 실측 (위 주석, 진산 결재 대기)
      driftCount: 55,
      pass: false,
    });
  });

  it('G-WS3c-3 음성 회귀 가드 — 코드 1건 template 의도 변조 → drift 델타 정확히 +1 (F-06)', () => {
    const baseline = buildFormulaSyncManifest(CODE_ENTRIES, FIXTURE.rows, {
      generatedAt: FIXED_AT,
    });
    // 변조 대상은 현재 일치 중인 BATCH-1 권역(F-06)이어야 "0→1 검출"이 실증된다
    expect(baseline.drift.some((d) => d.id === 'F-06')).toBe(false);

    const mutated = CODE_ENTRIES.map((e) =>
      e.id === 'F-06'
        ? { ...e, equationTemplate: e.equationTemplate.replace('1.0115', '1.0116') }
        : e,
    );
    // 변조 전제 자기검증 — F-06 에 실제로 계수가 존재해야 변조가 유효
    expect(mutated.find((e) => e.id === 'F-06')!.equationTemplate).toContain('1.0116');

    const manifest = buildFormulaSyncManifest(mutated, FIXTURE.rows, { generatedAt: FIXED_AT });
    expect(manifest.drift).toHaveLength(baseline.drift.length + 1);
    expect(manifest.drift.filter((d) => d.id === 'F-06')).toEqual([
      { id: 'F-06', kind: 'template-mismatch' },
    ]);
    expect(manifest.gate.pass).toBe(false);
  });

  it('미적재 3컬럼 0/157 + version_year 2025/2026 분포 (plan §1.2 실측 고정)', () => {
    const manifest = buildFormulaSyncManifest(CODE_ENTRIES, FIXTURE.rows, {
      generatedAt: FIXED_AT,
    });
    expect(manifest.unpopulatedColumns).toEqual({
      equation_display: 0,
      expected_inputs: 0,
      graceful_degradation: 0,
    });
    expect(manifest.versionYear.d1Distribution).toEqual({ '2025': 13, '2026': 144 });
  });
});

/* ── 2026-07-02 5-페르소나 리뷰 MAJOR-10 — 스프레드 ↔ 레지스트리 집합 동치 고정 ──
 * 러너/테스트의 batch1~5 스프레드가 formula-engine 공식 레지스트리(getAllFormulas —
 * 등록시 safeParse 실행이지만 여기는 테스트 컨텍스트라 G-WS3c-6 의 "대조 경로" 밖)와
 * ID·수식 단위로 동일함을 기계 고정. batch6+ 가 레지스트리에 등록되면 본 테스트가
 * 깨져 스프레드 2곳(러너·본 테스트) 갱신을 강제한다 — "동일 집합" 주석의 assert 화. */
import { getAllFormulas } from '@thepick/formula-engine';

describe('engine-backed 집합 ↔ 레지스트리 동치 (리뷰 MAJOR-10)', () => {
  it('batch1~5 스프레드 = getAllFormulas() — ID 집합·개수·equationTemplate 완전 일치', () => {
    const registry = getAllFormulas();
    const spreadIds = CODE_ENTRIES.map((e) => e.id).sort();
    const registryIds = registry.map((f) => f.id).sort();
    expect(spreadIds).toEqual(registryIds);
    expect(CODE_ENTRIES.length).toBe(registry.length);
    const byId = new Map(registry.map((f) => [f.id, f.equationTemplate]));
    for (const e of CODE_ENTRIES) {
      expect(e.equationTemplate).toBe(byId.get(e.id));
    }
  });
});
