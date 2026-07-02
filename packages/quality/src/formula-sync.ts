/**
 * @thepick/quality/formula-sync — 코드 산식 레지스트리 ↔ D1 formulas 동기 대조 코어 (WS-3c).
 *
 * 근거: docs/plans/formula-sync-manifest.plan.md §3.2(manifest 구조)·§4(PITR)·§5(G-WS3c-1~6)
 * + MASTER_PLAN.md:149 G-WS3 ⑤ ("manifest: 68 engine-backed ID 전수 D1 대조 스크립트 PASS").
 * 진산 결재 2026-07-02 ("결재 카드 전부 권고대로 진행", plan §9 ①②③⑥).
 *
 * 본 모듈은 **순수 코어** (IO 무의존) — D1 덤프 읽기/리포트 쓰기는
 * scripts/run-formula-sync-manifest.ts 가 담당 (production-audit.ts 선례 동형).
 *
 * 대조 정책 (plan §4 PITR 채택안):
 *   - 정규화 = **B**: parser normalizer 의 SHA-256 지문 스킴 재활용 + 공백 정규화로
 *     표기차(`ceil( x )` vs `ceil(x)`) 흡수. 모듈 경로 = **(ii) 복제** — sha256Hex 를
 *     parser/src/normalizer.ts:79-81 에서 복제 (parser→quality 임포트 방향 오염 차단,
 *     plan §3.2 반론 2. quality/src/normalizer.ts:57 에 동일 구현이 이미 존재하나
 *     해당 파일은 IntegrityReport 전용이라 결합하지 않는다).
 *   - 비교 키 = **equation_template 단독**. variables_schema 는 코드(구조 배열,
 *     FormulaDefinition.variablesSchema)와 D1(압축 descriptor 맵, batch-1-insert.sql:97 형)의
 *     표현 자체가 상이해 문자열 대조 키가 될 수 없다 — 채움 여부만 확인.
 *   - version_year = **A+B** (비교 키 제외 + 코드값 사문 명문화 — 코드 68건 전부 2025 고정
 *     vs D1 per-batch ctx.versionYear bind, plan §1.2).
 *   - 미적재 3컬럼(equation_display·expected_inputs·graceful_degradation) = **A**
 *     (대조 제외 + populated 카운트 정직 표기 — 157 전건 불일치 노이즈 차단, plan §0-4).
 *   - display-only 분류(89건) = **결재 보류** (plan §9 ④ 미결) — 본 코어는 집합을
 *     *산출*할 뿐 영구 전시/승격을 판정하지 않는다 (RULE #5).
 *   - Hard Limit (plan §3.3 / G-WS3c-6): equation_template 을 evaluate/compile/parse
 *     하지 않는다 — 순수 문자열 대조만. formula-engine 레지스트리(formulas/index.ts)
 *     로드가 유발하는 등록시 safeParse 조차 회피 — 호출 측이 batch*-definitions
 *     (순수 데이터 모듈) 직수입으로 엔트리를 주입한다.
 *
 * 소비자 = apps/batch(Node)·scripts·vitest 뿐 — node:crypto 사용은 기존
 * quality/src/normalizer.ts:15 와 동일 전제 (Workers 미소비).
 */

import { createHash } from 'node:crypto';

// --- 기대 집합 (MASTER_PLAN G-WS3 ⑤ 단일 진실) ---

/**
 * 코드 레지스트리 기대 산식 수 — F-01~F-68 (batch1~5 = 13+17+8+15+15, plan §1.1).
 * apps/batch qg2-validator CUMULATIVE_FORMULA_THRESHOLDS['BATCH-5']=68 과 동일 진실.
 */
export const EXPECTED_ENGINE_BACKED_FORMULA_COUNT = 68;

/** engine-backed 기대 ID 집합 — F-01~F-68 (2자리 zero-pad, `^F-\d{2}$` 권역). */
export function expectedEngineBackedFormulaIds(): ReadonlySet<string> {
  const ids = new Set<string>();
  for (let n = 1; n <= EXPECTED_ENGINE_BACKED_FORMULA_COUNT; n++) {
    ids.add(`F-${String(n).padStart(2, '0')}`);
  }
  return ids;
}

// --- 정규화 (PITR B — parser 스킴 복제 (ii)) ---

/** parser/src/normalizer.ts:79-81 sha256Hex 복제 — 결재 (ii) 복제 (2026-07-02). */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * 공백 정규화 (PITR B) — math.js 수식에서 공백은 토큰 구분 의미가 없으므로
 * (식별자 둘을 공백으로만 나눈 식은 애초 비합법) 전량 제거가 결정적·안전하다.
 * `ceil( x )` vs `ceil(x)` 표기차 흡수 (plan §4 "B 의 공백 정규화" 근거 열).
 */
export function normalizeEquationTemplate(template: string): string {
  return template.replace(/\s+/g, '');
}

/** 정규화 template 의 SHA-256 지문 — 감사 추적용 (normalizedMatch 판정과 동치). */
export function equationTemplateFingerprint(template: string): string {
  return sha256Hex(normalizeEquationTemplate(template));
}

// --- 입력 형태 ---

/** 코드 측 엔트리 — FormulaDefinition 에서 대조에 필요한 최소 사영 (읽기 전용). */
export interface CodeFormulaEntry {
  readonly id: string;
  readonly name: string;
  readonly equationTemplate: string;
}

/** D1 formulas SELECT row (wrangler d1 execute --json 출력의 results[] 항목). */
export interface D1FormulaSyncRow {
  readonly id: string;
  readonly node_id: string | null;
  readonly equation_template: string;
  readonly variables_schema: string | null;
  readonly version_year: number;
  readonly is_current_active: number;
  readonly equation_display: string | null;
  readonly expected_inputs: string | null;
  readonly graceful_degradation: string | null;
}

// --- manifest 형태 (plan §3.2) ---

export interface EngineBackedComparison {
  readonly id: string;
  readonly codeTemplate: string;
  /** null = D1 에 해당 row 부재 (drift: code-missing-in-d1). */
  readonly d1Template: string | null;
  /** byte 동일 (정보 지표 — 게이트 키는 normalizedMatch). */
  readonly match: boolean;
  /** 공백 정규화 SHA-256 지문 동일 (PITR B — G-WS3c-4 판정 키). */
  readonly normalizedMatch: boolean;
  readonly codeFingerprint: string;
  readonly d1Fingerprint: string | null;
}

export interface DisplayOnlyEntry {
  readonly id: string;
  readonly d1Template: string;
}

export type FormulaDriftKind = 'template-mismatch' | 'code-missing-in-d1' | 'd1-missing-in-code';

export interface FormulaDriftEntry {
  readonly id: string;
  readonly kind: FormulaDriftKind;
}

/** 미적재 3컬럼 populated 카운트 (PITR A — 대조 제외·정직 표기, 기대값 0/157). */
export interface UnpopulatedColumnStats {
  readonly equation_display: number;
  readonly expected_inputs: number;
  readonly graceful_degradation: number;
}

export interface FormulaSyncManifest {
  readonly generatedAt: string;
  readonly codeFormulaCount: number;
  readonly d1FormulaCount: number;
  /** 코드 레지스트리 전건 (id 오름차순) — 각각 D1 대조 결과 동봉. */
  readonly engineBacked: readonly EngineBackedComparison[];
  /**
   * D1 에만 존재(코드 미등록)하는 row (id 오름차순). 단 기대 권역(F-01~F-68)인데
   * 코드에서 사라진 ID 는 여기가 아니라 drift(d1-missing-in-code)로 분류 —
   * display-only 는 "설계상 코드 밖" 집합이지 회귀 은폐 버킷이 아니다.
   * ★ 이 집합의 분류(영구 전시 vs engine 승격)는 plan §9 ④ 결재 대기 (RULE #5).
   */
  readonly displayOnly: readonly DisplayOnlyEntry[];
  readonly drift: readonly FormulaDriftEntry[];
  readonly unpopulatedColumns: UnpopulatedColumnStats;
  /** version_year = PITR A+B: 비교 키 제외 + 코드값 사문 명문화. 분포는 정보 지표. */
  readonly versionYear: {
    readonly excludedFromComparison: true;
    readonly d1Distribution: Readonly<Record<string, number>>;
    readonly codeValueNote: string;
  };
  readonly gate: {
    /** G-WS3c-1: engineBacked === 68 AND displayOnly === d1Count − 68. */
    readonly diffExact: boolean;
    /** G-WS3c-4 (G-WS3 ⑤): engine-backed 전건 D1 존재 + normalizedMatch. */
    readonly engineBackedAllMatch: boolean;
    readonly driftCount: number;
    readonly pass: boolean;
  };
}

/** versionYear.codeValueNote 고정 문구 — 리포트 결정성(G-WS3c-2)을 위해 상수화. */
export const CODE_VERSION_YEAR_DEAD_NOTE =
  'FormulaDefinition.versionYear 는 비교 키가 아니다 (PITR A) — 코드 68건 전부 2025 고정 vs ' +
  'D1 per-batch ctx.versionYear bind = 코드값 사문 (PITR B 명문화, plan §1.2·§4)';

export interface BuildFormulaSyncManifestOptions {
  /** 결정성 검증용 주입 (G-WS3c-2) — 미지정 시 호출 시각 ISO. */
  readonly generatedAt?: string;
}

// --- 내부 헬퍼 ---

/** F-xx 숫자부 오름차순 (F-71 < F-100 — 사전순 왜곡 차단), 비정형 ID 는 사전순 폴백. */
function compareFormulaIds(a: string, b: string): number {
  const na = Number(a.slice(2));
  const nb = Number(b.slice(2));
  if (a.startsWith('F-') && b.startsWith('F-') && Number.isFinite(na) && Number.isFinite(nb)) {
    if (na !== nb) return na - nb;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 중복 ID 는 카운트 게이트 전체를 무효화하므로 조용히 삼키지 않고 즉시 실패. */
function toUniqueMap<T extends { readonly id: string }>(
  items: readonly T[],
  side: 'code' | 'd1',
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) {
      throw new Error(
        `[formula-sync] ${side} 측 중복 ID '${item.id}' — 대조 불능 (입력 검증 실패)`,
      );
    }
    map.set(item.id, item);
  }
  return map;
}

function isPopulated(value: string | null): boolean {
  return value !== null && value !== '';
}

// --- 대조 본체 ---

export function buildFormulaSyncManifest(
  codeEntries: readonly CodeFormulaEntry[],
  d1Rows: readonly D1FormulaSyncRow[],
  options: BuildFormulaSyncManifestOptions = {},
): FormulaSyncManifest {
  const codeById = toUniqueMap(codeEntries, 'code');
  const d1ById = toUniqueMap(d1Rows, 'd1');
  const expectedIds = expectedEngineBackedFormulaIds();

  const drift: FormulaDriftEntry[] = [];

  // ① engine-backed: 코드 레지스트리 전건 → D1 대조
  const engineBacked: EngineBackedComparison[] = [...codeById.values()]
    .sort((a, b) => compareFormulaIds(a.id, b.id))
    .map((entry) => {
      const d1Row = d1ById.get(entry.id) ?? null;
      const codeFingerprint = equationTemplateFingerprint(entry.equationTemplate);
      const d1Fingerprint =
        d1Row === null ? null : equationTemplateFingerprint(d1Row.equation_template);
      const normalizedMatch = d1Fingerprint !== null && d1Fingerprint === codeFingerprint;
      if (d1Row === null) {
        drift.push({ id: entry.id, kind: 'code-missing-in-d1' });
      } else if (!normalizedMatch) {
        drift.push({ id: entry.id, kind: 'template-mismatch' });
      }
      return {
        id: entry.id,
        codeTemplate: entry.equationTemplate,
        d1Template: d1Row === null ? null : d1Row.equation_template,
        match: d1Row !== null && d1Row.equation_template === entry.equationTemplate,
        normalizedMatch,
        codeFingerprint,
        d1Fingerprint,
      };
    });

  // ② D1-only: 기대 권역(F-01~F-68)에서 코드가 사라진 ID = drift / 그 외 = display-only
  const displayOnly: DisplayOnlyEntry[] = [];
  for (const row of [...d1ById.values()].sort((a, b) => compareFormulaIds(a.id, b.id))) {
    if (codeById.has(row.id)) continue;
    if (expectedIds.has(row.id)) {
      drift.push({ id: row.id, kind: 'd1-missing-in-code' });
    } else {
      displayOnly.push({ id: row.id, d1Template: row.equation_template });
    }
  }
  drift.sort((a, b) => compareFormulaIds(a.id, b.id));

  // ③ 미적재 3컬럼 정직 표기 (PITR A)
  const unpopulatedColumns: UnpopulatedColumnStats = {
    equation_display: d1Rows.filter((r) => isPopulated(r.equation_display)).length,
    expected_inputs: d1Rows.filter((r) => isPopulated(r.expected_inputs)).length,
    graceful_degradation: d1Rows.filter((r) => isPopulated(r.graceful_degradation)).length,
  };

  // ④ version_year 분포 (키 정렬 = 결정성)
  const yearCounts = new Map<string, number>();
  for (const row of d1Rows) {
    const key = String(row.version_year);
    yearCounts.set(key, (yearCounts.get(key) ?? 0) + 1);
  }
  const d1Distribution: Record<string, number> = {};
  for (const key of [...yearCounts.keys()].sort()) {
    d1Distribution[key] = yearCounts.get(key)!;
  }

  // ⑤ 게이트 (G-WS3c-1 / G-WS3c-4)
  const diffExact =
    engineBacked.length === EXPECTED_ENGINE_BACKED_FORMULA_COUNT &&
    displayOnly.length === d1Rows.length - EXPECTED_ENGINE_BACKED_FORMULA_COUNT;
  const engineBackedAllMatch =
    engineBacked.length > 0 && engineBacked.every((e) => e.normalizedMatch);

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    codeFormulaCount: codeEntries.length,
    d1FormulaCount: d1Rows.length,
    engineBacked,
    displayOnly,
    drift,
    unpopulatedColumns,
    versionYear: {
      excludedFromComparison: true,
      d1Distribution,
      codeValueNote: CODE_VERSION_YEAR_DEAD_NOTE,
    },
    gate: {
      diffExact,
      engineBackedAllMatch,
      driftCount: drift.length,
      pass: diffExact && engineBackedAllMatch && drift.length === 0,
    },
  };
}
