/**
 * S5-6a Binary Gate — multi-hop 측정 코어 신뢰성 ("잘 됨" 금지).
 *
 * 근거: docs/plans/graph-walk-s5-6a-eval-harness.plan.md §4.
 *   G-6a-1 결정성 / G-6a-2 파서 골든(enrichRelatedNodes 시맨틱) /
 *   G-6a-3 지표 손계산 정확 / G-6a-4 측정불가 명시 제외.
 *   측정 도구가 틀리면 G-S5 결론 전체 무효 → 입력→출력 기계 판정.
 */

import { describe, expect, it } from 'vitest';
import {
  parseRelatedNodes,
  scoreQuestion,
  aggregate,
  formatReportMarkdown,
  type EvalGoldenItem,
  type GraphSearchResponseShape,
} from '../multihop-accuracy.js';

function golden(
  questionId: string,
  expected: string[],
  opts?: { relatedRawCount?: number; relatedMalformed?: boolean },
): EvalGoldenItem {
  return {
    questionId,
    content: `Q-${questionId}`,
    expected,
    relatedRawCount: opts?.relatedRawCount ?? expected.length,
    relatedMalformed: opts?.relatedMalformed ?? false,
  };
}

function resp(
  baseline: string[],
  graph: string[],
  opts?: { applied?: boolean; truncated?: boolean },
): GraphSearchResponseShape {
  return {
    baseline: { results: baseline.map((id) => ({ id })) },
    graphExpansion: { applied: opts?.applied ?? true, truncated: opts?.truncated ?? false },
    results: graph.map((id) => ({ id })),
  };
}

describe('G-6a-2 — parseRelatedNodes 는 enrichRelatedNodes 시맨틱 정본', () => {
  it('정상 JSON string[] → 정제 ids, malformed=false', () => {
    expect(parseRelatedNodes('["CONCEPT-001","F-01"]')).toEqual({
      ids: ['CONCEPT-001', 'F-01'],
      malformed: false,
    });
  });
  it('null / 빈문자 → [] malformed=false (결함 아님)', () => {
    expect(parseRelatedNodes(null)).toEqual({ ids: [], malformed: false });
    expect(parseRelatedNodes('')).toEqual({ ids: [], malformed: false });
    expect(parseRelatedNodes(undefined)).toEqual({ ids: [], malformed: false });
  });
  it('JSON parse 실패 → [] malformed=true (silent 아님 — 호출 측 집계)', () => {
    expect(parseRelatedNodes('{not json')).toEqual({ ids: [], malformed: true });
  });
  it('비배열 JSON → [] malformed=true', () => {
    expect(parseRelatedNodes('"CONCEPT-001"')).toEqual({ ids: [], malformed: true });
    expect(parseRelatedNodes('{"a":1}')).toEqual({ ids: [], malformed: true });
  });
  it('배열 내 비문자/빈문자 항목 제거 (enrichRelatedNodes 와 동일 필터)', () => {
    expect(parseRelatedNodes('["A", 1, "", null, "B"]')).toEqual({
      ids: ['A', 'B'],
      malformed: false,
    });
  });
  // design-audit WS-0e (2026-06-10) — parseRelatedNodes ↔ enrichRelatedNodes 의
  //   '의도적 비동치 1건(절단)'을 명시 잠금. enrichRelatedNodes(study/routes.ts)는 surface
  //   상한 RELATED_NODES_MAX=20 으로 ids.slice(0,20) 절단하나, 측정 코어는 recall 분모
  //   인위 축소 방지 위해 무절단(파일 상단 계약 주석). 두 술어가 같은 절단 정책으로
  //   표류하면 G-S5 정답률이 왜곡되므로 본 테스트가 회귀를 차단한다.
  it('절단 비동치 잠금 — 20개 초과도 무절단 (enrichRelatedNodes 의 RELATED_NODES_MAX 미적용)', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `CONCEPT-${String(i + 1).padStart(3, '0')}`);
    const result = parseRelatedNodes(JSON.stringify(ids));
    expect(result.malformed).toBe(false);
    expect(result.ids).toHaveLength(25); // ★ 무절단 — enrichRelatedNodes 는 여기서 20으로 자른다
    expect(result.ids).toEqual(ids);
  });
});

describe('G-6a-3 — scoreQuestion 지표 손계산 정확', () => {
  it('baselineHit + graphHit (둘 다 회수, 개선 아님)', () => {
    const r = scoreQuestion(golden('q1', ['N1', 'N2']), resp(['N1'], ['N1', 'X']));
    expect(r.excluded).toBeNull();
    expect(r.baselineHit).toBe(true);
    expect(r.graphHit).toBe(true);
    expect(r.graphOnlyRecovery).toBe(false);
    expect(r.regression).toBe(false);
    expect(r.recallBaseline).toBeCloseTo(0.5, 10); // 1/2
    expect(r.recallGraph).toBeCloseTo(0.5, 10); // 1/2 (N1만, N2 미회수)
  });
  it('graphOnlyRecovery — baseline 미회수, graph 회수 (multi-hop 순 기여)', () => {
    const r = scoreQuestion(golden('q2', ['N9']), resp(['X', 'Y'], ['X', 'N9']));
    expect(r.baselineHit).toBe(false);
    expect(r.graphHit).toBe(true);
    expect(r.graphOnlyRecovery).toBe(true);
    expect(r.regression).toBe(false);
    expect(r.recallBaseline).toBe(0);
    expect(r.recallGraph).toBe(1);
  });
  it('regression — baseline 회수, graph 탈락 (악화, 은폐 금지)', () => {
    const r = scoreQuestion(golden('q3', ['N5']), resp(['N5'], ['A', 'B']));
    expect(r.baselineHit).toBe(true);
    expect(r.graphHit).toBe(false);
    expect(r.regression).toBe(true);
    expect(r.graphOnlyRecovery).toBe(false);
  });
  it('truncated 플래그 전파', () => {
    const r = scoreQuestion(golden('q4', ['N1']), resp(['N1'], ['N1'], { truncated: true }));
    expect(r.truncated).toBe(true);
  });
});

describe('G-6a-4 — 측정불가 명시 제외 (silent drop 금지)', () => {
  it('expected=∅ → excluded=unmeasurable (지표 분모 제외)', () => {
    const r = scoreQuestion(golden('qE', []), resp(['A'], ['A', 'B']));
    expect(r.excluded).toBe('unmeasurable');
    expect(r.baselineHit).toBe(false);
    expect(r.graphHit).toBe(false);
  });
  it('graphExpansion.applied=false → excluded=no_seed', () => {
    const r = scoreQuestion(golden('qN', ['N1']), resp([], [], { applied: false }));
    expect(r.excluded).toBe('no_seed');
  });
  it('aggregate 가 excluded 를 분모에서 빼되 사유별 카운트 보존', () => {
    const items = [
      golden('m1', ['N1']),
      golden('m2', ['N2']),
      golden('uE', [], { relatedMalformed: true }),
      golden('uN', ['N3']),
    ];
    const per = [
      scoreQuestion(items[0], resp(['N1'], ['N1'])), // baseline+graph hit
      scoreQuestion(items[1], resp([], ['N2'])), // graphOnlyRecovery
      scoreQuestion(items[2], resp(['x'], ['x'])), // unmeasurable (expected=∅)
      scoreQuestion(items[3], resp([], [], { applied: false })), // no_seed
    ];
    const agg = aggregate(per, items, 'extracted 4 / active 100');
    expect(agg.total).toBe(4);
    expect(agg.excludedUnmeasurable).toBe(1);
    expect(agg.excludedNoSeed).toBe(1);
    expect(agg.relatedMalformed).toBe(1);
    expect(agg.coverageNote).toBe('extracted 4 / active 100');
    // 측정 분모 = 2 (m1, m2)
    expect(agg.overall.measured).toBe(2);
    expect(agg.overall.baselineHitRate).toBeCloseTo(0.5, 10); // m1만
    expect(agg.overall.graphHitRate).toBe(1); // m1,m2
    expect(agg.overall.hitRateDelta).toBeCloseTo(0.5, 10);
    expect(agg.overall.graphOnlyRecoveryCount).toBe(1);
    expect(agg.overall.graphOnlyRecoveryIds).toEqual(['m2']);
    expect(agg.overall.regressionCount).toBe(0);
  });
  it('3분할 — 절단표본 제외/만 분리 집계 (m-1 — silent 절단 왜곡 차단)', () => {
    const items = [golden('t1', ['N1']), golden('t2', ['N2'])];
    const per = [
      scoreQuestion(items[0], resp([], ['N1'], { truncated: false })), // 비절단 graphOnly
      scoreQuestion(items[1], resp([], ['N2'], { truncated: true })), // 절단 graphOnly
    ];
    const agg = aggregate(per, items);
    expect(agg.overall.measured).toBe(2);
    expect(agg.excludingTruncated.measured).toBe(1);
    expect(agg.excludingTruncated.graphOnlyRecoveryIds).toEqual(['t1']);
    expect(agg.truncatedOnly.measured).toBe(1);
    expect(agg.truncatedOnly.graphOnlyRecoveryIds).toEqual(['t2']);
  });
});

describe('G-6a-1 — 결정성 (동일 입력 → byte-identical 출력)', () => {
  const items = [golden('a', ['N1']), golden('b', ['N2']), golden('c', [])];
  function run(): string {
    const per = [
      scoreQuestion(items[0], resp(['N1'], ['N1', 'N2'])),
      scoreQuestion(items[1], resp([], ['N2'])),
      scoreQuestion(items[2], resp(['x'], ['x'])),
    ];
    return formatReportMarkdown(
      aggregate(per, items, 'cov'),
      'LOCAL_SMOKE',
      '2026-05-15T00:00:00.000Z',
    );
  }
  it('2회 실행 출력 동일', () => {
    expect(run()).toBe(run());
  });
  it('LOCAL_SMOKE 워터마크 = G-S5 오인 차단', () => {
    expect(run()).toContain('MODE=LOCAL_SMOKE');
    expect(run()).toContain('G-S5 가 아니다');
  });
  it('REMOTE 모드 워터마크 분기', () => {
    const md = formatReportMarkdown(aggregate([], []), 'REMOTE_G_S5', '2026-05-15T00:00:00.000Z');
    expect(md).toContain('MODE=REMOTE_G_S5');
    expect(md).not.toContain('G-S5 가 아니다');
  });
});
