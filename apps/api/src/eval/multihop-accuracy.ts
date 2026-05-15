/**
 * S5-6 multi-hop 정답률 측정 — **순수 코어** (Workers-safe, IO 무의존).
 *
 * 근거: docs/plans/graph-walk-s5-6a-eval-harness.plan.md §2/§4.
 *   measurement 도구가 틀리면 G-S5 결론 전체가 무효 → 본 코어를 Binary
 *   Gate(G-6a-2/3/4)로 못박는다. IO(D1 추출/Hono in-process/fetch/파일쓰기)는
 *   `scripts/measure-s5-6-multihop-accuracy.ts` 가 담당 (본 모듈은 node:sqlite
 *   /fs/네트워크 무의존 → Worker 번들 안전, vitest 직접 검증).
 *
 * 핵심 지표 (plan §0 Anchor #3): graph-augmented 결과는 baseline 상위 K 를
 *   병합·재정렬하므로 graph ⊇ baseline 경향 → "graph 가 이긴다"가 자명해
 *   보일 수 있다. 따라서 1차 증거는 **graphOnlyRecovery**(baseline 미회수 ·
 *   graph 회수 = multi-hop 순 기여) + **regression**(악화) 양면 동시 보고.
 *   AI 자기채점 금지 — 수치를 진산이 직접 확인 (개선·동률·악화 전부 surface).
 */

/**
 * `exam_questions.related_nodes` **파싱·정제 술어** — `study/routes.ts`
 * `enrichRelatedNodes` 의 *파싱 부분*과 동치 (JSON string[] / 비배열·
 * parse-fail → []).
 *
 * 동치 계약 (study/routes.ts:466~ enrichRelatedNodes, G-6a-2) — *파싱 술어
 * 한정*:
 *   - null / '' → []
 *   - JSON.parse 실패 → [] (silent 아님 — 호출 측이 `malformed` 로 집계)
 *   - 비배열 → []
 *   - 배열: `typeof === 'string' && length > 0` 만 채택 (그 외 항목 제거)
 *
 * ★ 의도적 비동치 1건 (4-Pass Pass2/Pass3·4 M-1 흡수): enrichRelatedNodes
 *   는 `ids.slice(0, RELATED_NODES_MAX=20)` 로 절단(study 런타임 surface
 *   상한). 본 함수는 **절단하지 않는다** — 측정에서 expected 를 20개로
 *   자르면 recall 분모가 인위 축소돼 정답률이 왜곡되기 때문(측정 무결성 >
 *   surface 상한). 따라서 "정본 단일화"가 아니라 "파싱 술어 동치 + 측정
 *   목적상 무절단"이 정확한 계약이다.
 *
 * ★ drift 방어 (Pass2 M-1): 두 함수는 물리적으로 분리된 정본이다.
 *   enrichRelatedNodes 의 파싱 술어가 개정되면 본 함수는 자동 추종하지
 *   않으므로, study/routes.ts enrichRelatedNodes 에 본 함수 cross-ref 주석을
 *   두어 동반 갱신 의무를 명시(같은 G-6a-2 골든이 회귀 감지). 진짜 단일화
 *   (enrichRelatedNodes 가 본 파서를 import)는 study 라우트(L3 사용자 경로)
 *   변경 = S5-6a 범위 외 → plan §5 carry-over.
 *
 * @returns 정제된 노드 id 배열 + parse 실패/비배열 여부(측정불가 사유 집계용)
 */
export interface ParsedRelatedNodes {
  readonly ids: ReadonlyArray<string>;
  /** JSON.parse throw 또는 결과가 배열이 아님 (related_nodes 자체 결함). */
  readonly malformed: boolean;
}

export function parseRelatedNodes(relatedNodesJson: string | null | undefined): ParsedRelatedNodes {
  if (relatedNodesJson === null || relatedNodesJson === undefined || relatedNodesJson === '') {
    return { ids: [], malformed: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(relatedNodesJson);
  } catch {
    return { ids: [], malformed: true };
  }
  if (!Array.isArray(parsed)) {
    return { ids: [], malformed: true };
  }
  const ids = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return { ids, malformed: false };
}

/**
 * golden 평가셋 항목 — `expected` 는 **이미 approved 교집합 적용된** 노드 id
 * (검색 회수 가능 집합. 교집합은 IO 계층=runner 가 D1 로 수행, 본 코어는
 * 결과만 채점). `relatedRaw` 는 원본 파싱 결과(커버리지/측정불가 분류용).
 */
export interface EvalGoldenItem {
  readonly questionId: string;
  readonly content: string;
  /** related_nodes ∩ {is_current_active=1 ∧ 최신 status=approved}. */
  readonly expected: ReadonlyArray<string>;
  /** 원본 related_nodes 파싱 id 수 (approved 교집합 전 — 커버리지 보고). */
  readonly relatedRawCount: number;
  /** related_nodes 자체가 malformed (parse 실패/비배열). */
  readonly relatedMalformed: boolean;
}

/** `/api/search/graph` 응답에서 채점에 필요한 최소 형태 (계약 고정). */
export interface GraphSearchResponseShape {
  readonly baseline: { readonly results: ReadonlyArray<{ readonly id: string }> };
  readonly graphExpansion: { readonly applied: boolean; readonly truncated: boolean };
  readonly results: ReadonlyArray<{ readonly id: string }>;
}

export type ExclusionReason = 'unmeasurable' | 'no_seed';

export interface PerQuestionResult {
  readonly questionId: string;
  /** 측정 제외 시 사유 (그 외 지표는 무의미 — 분모 제외). */
  readonly excluded: ExclusionReason | null;
  readonly baselineHit: boolean;
  readonly graphHit: boolean;
  /** ★ multi-hop 순 기여: baseline 미회수 + graph 회수. */
  readonly graphOnlyRecovery: boolean;
  /** ★ 악화: baseline 회수 + graph 미회수 (병합/정렬로 expected 탈락). */
  readonly regression: boolean;
  readonly recallBaseline: number;
  readonly recallGraph: number;
  readonly expectedCount: number;
  readonly truncated: boolean;
}

/**
 * 문항 1건 채점 — 결정적 (동일 입력 → 동일 출력, G-6a-1).
 *
 * expected = ∅ → `unmeasurable` (related_nodes 미적재/미승인 — 분모 제외,
 *   silent drop 금지 plan §0 Anchor #1). graphExpansion.applied=false(시드
 *   0건) → `no_seed` (검색 자체 graceful — 측정 분모 분리).
 */
export function scoreQuestion(
  item: EvalGoldenItem,
  response: GraphSearchResponseShape,
): PerQuestionResult {
  const truncated = response.graphExpansion.truncated;
  const base = {
    questionId: item.questionId,
    baselineHit: false,
    graphHit: false,
    graphOnlyRecovery: false,
    regression: false,
    recallBaseline: 0,
    recallGraph: 0,
    expectedCount: item.expected.length,
    truncated,
  };

  if (item.expected.length === 0) {
    return { ...base, excluded: 'unmeasurable' };
  }
  if (!response.graphExpansion.applied) {
    return { ...base, excluded: 'no_seed' };
  }

  const expected = new Set(item.expected);
  const baselineIds = new Set(response.baseline.results.map((r) => r.id));
  const graphIds = new Set(response.results.map((r) => r.id));

  let bHit = 0;
  let gHit = 0;
  for (const e of expected) {
    if (baselineIds.has(e)) bHit += 1;
    if (graphIds.has(e)) gHit += 1;
  }
  const baselineHit = bHit > 0;
  const graphHit = gHit > 0;

  return {
    ...base,
    excluded: null,
    baselineHit,
    graphHit,
    graphOnlyRecovery: graphHit && !baselineHit,
    regression: baselineHit && !graphHit,
    recallBaseline: bHit / expected.size,
    recallGraph: gHit / expected.size,
  };
}

export interface AccuracyBucket {
  /** 측정 분모 (excluded 제외 문항 수). */
  readonly measured: number;
  readonly baselineHitRate: number;
  readonly graphHitRate: number;
  /** graphHitRate − baselineHitRate (G-S5 1차 수치). */
  readonly hitRateDelta: number;
  readonly meanRecallBaseline: number;
  readonly meanRecallGraph: number;
  readonly recallDelta: number;
  readonly graphOnlyRecoveryCount: number;
  readonly regressionCount: number;
  readonly graphOnlyRecoveryIds: ReadonlyArray<string>;
  readonly regressionIds: ReadonlyArray<string>;
}

export interface AggregateReport {
  readonly total: number;
  readonly excludedUnmeasurable: number;
  readonly excludedNoSeed: number;
  /** related_nodes malformed 문항 수 (excludedUnmeasurable 의 부분집합 진단). */
  readonly relatedMalformed: number;
  /** 추출 N / (관점 보고용, runner 가 주입) — 미주입 시 null. */
  readonly coverageNote: string | null;
  /** 전체 측정 가능 문항 (truncated 포함). */
  readonly overall: AccuracyBucket;
  /** 절단표본 제외 (m-1 — silent 절단 왜곡 차단, G-S5 권장 기준). */
  readonly excludingTruncated: AccuracyBucket;
  /** 절단표본만 (별도 진단). */
  readonly truncatedOnly: AccuracyBucket;
}

function buildBucket(rows: ReadonlyArray<PerQuestionResult>): AccuracyBucket {
  const measured = rows.length;
  if (measured === 0) {
    return {
      measured: 0,
      baselineHitRate: 0,
      graphHitRate: 0,
      hitRateDelta: 0,
      meanRecallBaseline: 0,
      meanRecallGraph: 0,
      recallDelta: 0,
      graphOnlyRecoveryCount: 0,
      regressionCount: 0,
      graphOnlyRecoveryIds: [],
      regressionIds: [],
    };
  }
  let bHit = 0;
  let gHit = 0;
  let rB = 0;
  let rG = 0;
  const goIds: string[] = [];
  const regIds: string[] = [];
  for (const r of rows) {
    if (r.baselineHit) bHit += 1;
    if (r.graphHit) gHit += 1;
    rB += r.recallBaseline;
    rG += r.recallGraph;
    if (r.graphOnlyRecovery) goIds.push(r.questionId);
    if (r.regression) regIds.push(r.questionId);
  }
  const baselineHitRate = bHit / measured;
  const graphHitRate = gHit / measured;
  const meanRecallBaseline = rB / measured;
  const meanRecallGraph = rG / measured;
  return {
    measured,
    baselineHitRate,
    graphHitRate,
    hitRateDelta: graphHitRate - baselineHitRate,
    meanRecallBaseline,
    meanRecallGraph,
    recallDelta: meanRecallGraph - meanRecallBaseline,
    graphOnlyRecoveryCount: goIds.length,
    regressionCount: regIds.length,
    // 결정적 보고 (입력 순서 보존 — G-6a-1).
    graphOnlyRecoveryIds: goIds,
    regressionIds: regIds,
  };
}

/**
 * 집계 — 3분할 (전체 / 절단제외 / 절단만). excluded 문항은 분모에서 제외하되
 * 사유별 카운트는 보존 (측정불가 은폐 금지, plan §0 Anchor #1 / G-6a-4).
 */
export function aggregate(
  perQuestion: ReadonlyArray<PerQuestionResult>,
  goldenItems: ReadonlyArray<EvalGoldenItem>,
  coverageNote: string | null = null,
): AggregateReport {
  const measurable = perQuestion.filter((r) => r.excluded === null);
  const excludingTruncated = measurable.filter((r) => !r.truncated);
  const truncatedOnly = measurable.filter((r) => r.truncated);
  return {
    total: perQuestion.length,
    excludedUnmeasurable: perQuestion.filter((r) => r.excluded === 'unmeasurable').length,
    excludedNoSeed: perQuestion.filter((r) => r.excluded === 'no_seed').length,
    relatedMalformed: goldenItems.filter((g) => g.relatedMalformed).length,
    coverageNote,
    overall: buildBucket(measurable),
    excludingTruncated: buildBucket(excludingTruncated),
    truncatedOnly: buildBucket(truncatedOnly),
  };
}

/**
 * REMOTE 측정 입력 사전조건 — **순수 가드 단일 진실원** (G-6a-5).
 *
 * remote G-S5 는 (1) 배포 Worker baseURL (2) 실 평가셋 golden 파일 둘 다
 * 필수 (진산 Cloudflare 인증 세션 산출). 미충족 = 정답률 fabricate 위험 →
 * 명시 throw (silent 0/추정 금지, CLAUDE.md RULE #4/#5 / plan §3). scripts
 * runner 와 G-6a-5 테스트가 본 함수를 *공유* (게이트 정책 drift 0).
 *
 * @param apiBase  process.env.THEPICK_API_BASE (IO 는 호출 측 — 본 함수는 순수)
 * @throws Error 입력 미충족 (사유 명시)
 */
export function assertRemoteMeasurementInputs(
  apiBase: string | undefined,
  goldenPath: string | null,
): { apiBase: string; goldenPath: string } {
  if (apiBase === undefined || apiBase.trim() === '') {
    throw new Error(
      'REMOTE 비측정 종료: env THEPICK_API_BASE 미설정. 진산 Cloudflare 인증 ' +
        '세션에서 배포 Worker baseURL 을 env 로 주입하시오 (plan §3 / 토큰 회피 의무).',
    );
  }
  if (goldenPath === null || goldenPath.trim() === '') {
    throw new Error(
      'REMOTE 비측정 종료: --golden <eval.json> 필수 (실 평가셋 = 진산 인증 ' +
        '세션이 remote D1 에서 추출). 미제공 시 정답률 fabricate 금지 (RULE #4/#5).',
    );
  }
  return { apiBase: apiBase.trim(), goldenPath };
}

/** LOCAL_SMOKE = 합성 stub 산물 → G-S5 아님 (plan §0 Anchor #2 워터마크). */
export type MeasurementMode = 'LOCAL_SMOKE' | 'REMOTE_G_S5';

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtBucket(title: string, b: AccuracyBucket): string {
  return [
    `### ${title} (measured=${b.measured})`,
    '',
    `| 지표 | baseline (vector-only) | graph-augmented | Δ |`,
    `| :-- | --: | --: | --: |`,
    `| hit-rate | ${pct(b.baselineHitRate)} | ${pct(b.graphHitRate)} | ${pct(b.hitRateDelta)} |`,
    `| mean recall | ${pct(b.meanRecallBaseline)} | ${pct(b.meanRecallGraph)} | ${pct(b.recallDelta)} |`,
    '',
    `- **graphOnlyRecovery** (multi-hop 순 기여): **${b.graphOnlyRecoveryCount}**` +
      (b.graphOnlyRecoveryIds.length > 0 ? ` — ${b.graphOnlyRecoveryIds.join(', ')}` : ''),
    `- **regression** (악화): **${b.regressionCount}**` +
      (b.regressionIds.length > 0 ? ` — ${b.regressionIds.join(', ')}` : ''),
  ].join('\n');
}

/**
 * 영속 markdown 리포트. MODE=LOCAL_SMOKE 는 정답률이 합성 산물임을 1행 워터마크
 * (G-S5 오인 차단). 수치 해석/판정은 진산 — 본 함수는 사실 나열만.
 */
export function formatReportMarkdown(
  report: AggregateReport,
  mode: MeasurementMode,
  generatedAt: string,
): string {
  const watermark =
    mode === 'LOCAL_SMOKE'
      ? '> ⚠️ **MODE=LOCAL_SMOKE — 합성 stub 산물. 정답률 수치는 G-S5 가 아니다** ' +
        '(harness 로직 검증 전용). 실 G-S5 는 REMOTE 측정(진산 Cloudflare 인증) 산출.'
      : '> **MODE=REMOTE_G_S5 — 실 production D1 + Vectorize 측정.**';
  return [
    `# S5-6 multi-hop 정답률 측정 리포트`,
    '',
    watermark,
    '',
    `- 생성: ${generatedAt}`,
    `- total 문항: ${report.total}`,
    `- 측정불가(unmeasurable, related_nodes∩approved=∅): ${report.excludedUnmeasurable}` +
      ` (그 중 malformed: ${report.relatedMalformed})`,
    `- no_seed(graph graceful, applied=false): ${report.excludedNoSeed}`,
    report.coverageNote !== null ? `- 커버리지: ${report.coverageNote}` : '- 커버리지: (미주입)',
    '',
    '## 판정 기준 (plan §2)',
    '',
    '"Vector-only 대비 multi-hop 정답률" = graph hit-rate − baseline hit-rate ' +
      '(**절단표본 제외** 기준 권장) + graphOnlyRecovery 절대수. 악화(regression) ' +
      '동시 제시 — 개선·동률·악화 모두 수치로.',
    '',
    fmtBucket('절단표본 제외 (G-S5 권장 기준)', report.excludingTruncated),
    '',
    fmtBucket('전체 (절단 포함)', report.overall),
    '',
    fmtBucket('절단표본 만 (진단)', report.truncatedOnly),
    '',
  ].join('\n');
}
