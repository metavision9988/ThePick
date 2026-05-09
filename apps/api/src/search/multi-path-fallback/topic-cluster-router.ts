/**
 * Multi-Path Fallback Stage 3 — Topic Cluster Routing.
 *
 * D-MPF-2=A 채택 (Session 059): Vectorize 재활용. topic_clusters 50건 사전 임베딩
 * 적재 후 query embedding 과 cosine similarity 매칭.
 *
 * D-TCV-4-FIX-1=B-1 채택 (Session 061, plan phase2a-d-tcv-4-fix.plan.md §3):
 *   - Reality Anchor: production cluster.lv1 (간소화 도메인 11종) ≠ kn.lv1_insurance
 *     (보험 종목명) → 직접 컬럼 매칭 영구 0건 보장. cluster.lv2 (점수 분류) ≠ kn.lv2_crop
 *     (작물명) 동일.
 *   - 채택안: cluster matching 1st query 에서 returnValues:true 로 cluster 임베딩
 *     동시 반환 → 각 matched cluster 임베딩을 query value 로 knowledge_node 2nd
 *     query 진행 → 의미 임베딩 매칭으로 production 명명 비대칭 흡수.
 *
 * 본 step 가정 (carry-over — plan phase2a-multi-path-fallback §10):
 *   - topic_clusters.id 별 임베딩이 Vectorize index 에 **node_type='topic_cluster'**
 *     메타데이터로 사전 적재되어야 함 (Session 060 50건 production+staging 적재 완료).
 *   - 본 step 적재 부재 시 Vectorize.query(filter: node_type='topic_cluster') 결과 0건
 *     → graceful Miss → Stage 4 진입.
 *
 * Pass 2 ARCHITECT CRITICAL-1 흡수 (Session 059):
 *   - filter 키 'type' → 'node_type' 정정 (vectorize/upserter.ts VectorizeUpsertMetadata
 *     인터페이스 + handoff-065/066 metadata-index 7종 정합).
 *   - exam_id 필터 추가 (Hard Rule 16 zero-cost — Year 2 멀티시험 진입 시 cross-exam
 *     매칭 차단).
 *
 * Pass 1 SURGEON CRIT-3 흡수 (Session 059):
 *   - Vectorize.query throw 시 빈 결과 반환 (graceful Miss → Stage 4 진입). caller
 *     (multi-path-fallback/index.ts) 에서 logger surface 의무.
 *
 * 알고리즘 (D-TCV-4-FIX-1=B-1, Session 061):
 *   1. precomputed user query embedding 으로 Vectorize.query(filter:
 *      node_type='topic_cluster' + exam_id, topK=3, similarity ≥ 0.50,
 *      returnValues: true) → matched clusters [{id, score, values}]
 *   2. 매칭된 cluster id 로 D1 topic_clusters 메타 조회 → name / lv1 / lv2
 *   3. 각 matched cluster 의 임베딩 (Step 1 의 values) 으로 Vectorize.query
 *      (filter: node_type='knowledge_node' + exam_id, topK=5, similarity ≥ 0.40)
 *      → cluster 별 matched knowledge_node ids
 *   4. matched node ids 로 D1 knowledge_nodes 조회 (status='approved' +
 *      is_current_active=1 — Stage 2 정합) → fetchNodesByIds
 *   5. 통합 + dedup (최고 similarity 보존) + ranking (truth_weight DESC,
 *      score DESC, name ASC)
 *
 * Hard Rule 16: examId 첫 인자 강제. Year 1 단일 시험 (한시 예외) — Year 2 멀티시험
 * 진입 시 topic_clusters 에 exam_id 컬럼 추가 의무.
 *
 * 근거:
 *   - docs/plans/phase2a-d-tcv-4-fix.plan.md §3 (옵션 B-1 영속)
 *   - docs/plans/phase2a-multi-path-fallback.plan.md §3.1
 *   - docs/architecture/SEARCH_PIPELINE.md §5
 *   - docs/adr/ADR-015-multi-path-fallback-pipeline.md
 */

import { TRUTH_WEIGHTS, type ExamId, type NodeType } from '@thepick/shared';
import { parsePageRefToInt } from '../../vectorize/page-ref.js';
import { TOPIC_CLUSTER_NODE_TYPE } from '../../vectorize/topic-cluster-fetcher.js';
import {
  UserSearchError,
  type UserSearchD1,
  type UserSearchHit,
  type VectorizeQueryBinding,
} from '../user-search.js';

/** Stage 3 topic cluster 매칭 similarity 임계 (Stage 1 0.60 보다 낮춤 — 토픽 매칭 본질). */
export const TOPIC_CLUSTER_MIN_SIMILARITY = 0.5;

/**
 * Stage 3 cluster→node 2nd query similarity 임계.
 *
 * cluster 매개 재추천이므로 Stage 1 (user query → node 직접 매칭, 0.60) 보다 낮음.
 * 0.40 채택 사유: cluster.name (예: '적과전종합위험 — 5점 단답') 임베딩과
 * 도메인 노드 임베딩 간 의미 매칭에서 부분 매칭 흡수.
 *
 * D-TCV-4-FIX-1=B-1 (Session 061).
 */
export const KNOWLEDGE_NODE_MIN_SIMILARITY = 0.4;

/**
 * Stage 3 2nd query overfetch 비율 — Vectorize V2 binding filter operator
 * ($in/$nin/$ne) 미작동 fallback 으로 client-side prefix exclusion + cluster id
 * self-exclusion 흡수 후 충분한 knowledge_node candidates 잔존 보장.
 *
 * 4배: cluster.embedding 으로 query 시 cluster 끼리 cosine 가장 높음 — top-K=5 면
 * 5건 모두 cluster id 가능성. topK=20 회수 후 client-side filter 로 5 잔존 보장.
 *
 * Year 2 carry-over: V2 binding filter operator 정상화 시 본 ratio 제거 + 단순
 * topK=5 회복 (4-Pass M1-3 / M2-1 carry-over).
 */
export const STAGE3_NODE_QUERY_OVERFETCH_RATIO = 4;

/**
 * truth_weight fallback 값 — D1 row 의 truth_weight 가 NULL/undefined 일 때
 * Array.sort `b.truthWeight - a.truthWeight = NaN` 비결정 정렬 차단 (Pass 1 CRIT-2).
 *
 * 0 채택 사유: 정렬 우선순위 최하위로 명확한 의미. TRUTH_WEIGHTS 매핑 부재 시점에도
 * 결정성 보장.
 */
export const TRUTH_WEIGHT_NAN_GUARD = 0;

/** Vectorize 인덱스 내 knowledge_node 메타데이터 node_type 값. */
export const KNOWLEDGE_NODE_NODE_TYPE = 'knowledge_node';

/**
 * Stage 3 2nd query 결과에서 client-side 제외할 id prefix 화이트리스트.
 *
 * Reality Anchor (Session 061 staging e2e): Cloudflare Vectorize V2 binding 의
 * filter 가 객체 형식 ($in/$nin/$ne) 를 기대치만큼 처리 못함 (filter 적용 시 0건
 * 반환). Stage 1 정합으로 단순 exam_id filter + client-side prefix exclusion 채택.
 *
 * 차단 대상 prefix (ontology v1.5.0):
 *   TC-   : topic_clusters.id (Session 060 적재 50건)
 *   TBL-  : table_structures.id (ADR-032)
 *   TROW- : table_headers.id (row axis)
 *   TCOL- : table_headers.id (col axis)
 *   TCELL-: table_cells.id
 */
export const STAGE3_NODE_ID_EXCLUDE_PREFIXES = ['TC-', 'TBL-', 'TROW-', 'TCOL-', 'TCELL-'] as const;

/** Stage 3 topic cluster top-K. */
export const TOPIC_CLUSTER_TOP_K = 3;

/** cluster 별 추천 노드 max top-K. */
export const TOPIC_CLUSTER_NODES_PER_CLUSTER = 5;

interface TopicClusterRow {
  readonly id: string;
  readonly name: string;
  readonly lv1: string | null;
  readonly lv2: string | null;
  readonly lv3: string | null;
  readonly exam_frequency: number;
}

interface TopicClusterMatch {
  readonly cluster: TopicClusterRow;
  readonly similarity: number;
}

interface TopicClusterNodeRow {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly description: string | null;
  readonly page_ref: string | null;
  readonly truth_weight: number;
}

/**
 * Stage 3 진단 정보 (D-TCV-4-FIX-1=B-1 영속 후 SP-T06 측정 + e2e debug용).
 *
 * 4-Pass 후 정확도 정착 시점에 production 응답에서 제거 또는 debug-only flag 토글
 * carry-over (별도 ADR — fallback 응답 shape 정책).
 */
export interface TopicClusterDiagnostics {
  readonly clusterMatchCount: number;
  readonly clusterAboveThresholdCount: number;
  readonly top1ClusterScore: number;
  readonly clustersWithEmbeddingCount: number;
  readonly nodeQueryAttemptCount: number;
  readonly nodeMatchCount: number;
  readonly nodeAboveThresholdCount: number;
}

export interface TopicClusterRouterResult {
  readonly source: 'topic-cluster';
  /**
   * Pass 3 CRIT-4 흡수 (Session 061 4-Pass): cluster.lv2 ('5점'/'15점' 점수 분류)
   * raw 노출 시 출제자 의도 누설 + 학습 신호 왜곡 위험 — 응답 shape 에서 제거.
   *
   * cluster.name 도 server-side 에서 점수 분류 정규식 strip (' — N점.*$') 후 surface.
   * 별도 ADR carry-over: cluster.lv2 server-only 보존 정책 영속 (handoff-070 §주의).
   */
  readonly clusters: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly lv1: string | null;
    readonly similarity: number;
  }>;
  readonly results: ReadonlyArray<UserSearchHit>;
  readonly diagnostics: TopicClusterDiagnostics;
}

/**
 * cluster.name 의 점수 분류 suffix 정규식 — Pass 3 CRIT-4 흡수.
 *
 * 매칭 패턴: " — 5점 단답" / " — 15점" / " — 5점/15점" 등.
 * 정규식 의도: ' — ' (em-dash) 이후 '점' 으로 끝나거나 '점' 다음 문자열까지 strip.
 *
 * production cluster.name 패턴 실측 (Session 061):
 *   '적과전종합위험 — 5점 단답' → '적과전종합위험'
 *   '논작물(벼) — 15점' → '논작물(벼)'
 */
const CLUSTER_NAME_SCORE_SUFFIX_REGEX = / — \d+점.*$/;

function sanitizeClusterName(name: string): string {
  return name.replace(CLUSTER_NAME_SCORE_SUFFIX_REGEX, '').trim();
}

/**
 * Stage 3 Topic Cluster Routing.
 *
 * @returns clusters (매칭된 cluster 메타) + results (cluster 내 추천 노드)
 *          매칭 0건 시 results=[] (Stage 4 진입 신호)
 */
export async function runTopicClusterRouting(
  vectorize: VectorizeQueryBinding,
  db: UserSearchD1,
  examId: ExamId,
  queryEmbedding: ReadonlyArray<number>,
): Promise<TopicClusterRouterResult> {
  if (!examId || (examId as string).trim() === '') {
    throw new UserSearchError('examId is required (Hard Rule 16 시험 경계 강제)', 'filter');
  }
  if (queryEmbedding.length === 0) {
    throw new UserSearchError('queryEmbedding 차원 부재', 'query');
  }

  let clusterMatchCount = 0;
  let clusterAboveThresholdCount = 0;
  let top1ClusterScore = 0;
  let clustersWithEmbeddingCount = 0;
  let nodeQueryAttemptCount = 0;
  let nodeMatchCount = 0;
  let nodeAboveThresholdCount = 0;
  const buildEmptyResult = (): TopicClusterRouterResult => ({
    source: 'topic-cluster',
    clusters: [],
    results: [],
    diagnostics: {
      clusterMatchCount,
      clusterAboveThresholdCount,
      top1ClusterScore,
      clustersWithEmbeddingCount,
      nodeQueryAttemptCount,
      nodeMatchCount,
      nodeAboveThresholdCount,
    },
  });

  // Stage 3.a: Vectorize topic_cluster 매칭 (returnValues:true — D-TCV-4-FIX-1=B-1, Session 061)
  // Pass 2 CRITICAL-1 흡수: filter 키 'node_type' (upserter.ts VectorizeUpsertMetadata 정합)
  // + exam_id (Hard Rule 16 zero-cost). Pass 1 CRIT-3 흡수: throw 시 graceful Miss.
  let vectorMatches: ReadonlyArray<{
    readonly id: string;
    readonly score: number;
    readonly values?: ReadonlyArray<number>;
  }>;
  try {
    const resp = await vectorize.query(queryEmbedding, {
      topK: TOPIC_CLUSTER_TOP_K,
      filter: { node_type: TOPIC_CLUSTER_NODE_TYPE, exam_id: examId as string },
      returnMetadata: 'none',
      returnValues: true,
    });
    vectorMatches = resp.matches ?? [];
  } catch {
    // Pass 1 CRIT-3 흡수 (Session 059) — graceful Miss + Stage 4 진입.
    // 운영 모니터링은 caller (multi-path-fallback/index.ts) 의 logger 측면에서 수행
    // (deps 에 logger 주입 carry-over — 본 step 은 빈 결과 반환).
    return buildEmptyResult();
  }

  clusterMatchCount = vectorMatches.length;
  if (vectorMatches.length > 0) {
    top1ClusterScore = Math.max(...vectorMatches.map((m) => m.score));
  }

  const above = vectorMatches.filter((m) => m.score >= TOPIC_CLUSTER_MIN_SIMILARITY);
  clusterAboveThresholdCount = above.length;
  if (above.length === 0) {
    return buildEmptyResult();
  }

  // Stage 3.b: D1 topic_clusters 메타 조회 (Pass 1 MAJ-3 흡수: examId 첫 인자)
  // Pass 1 CRIT-1 흡수 (Session 061 4-Pass): D1 throw 시 graceful Miss → Stage 4
  // 진입. ADR-015 graceful 본질 + index.ts:79-82 honest_refusal 정책 정합.
  let clusterRows: ReadonlyArray<TopicClusterRow>;
  try {
    clusterRows = await fetchClustersByIds(
      db,
      examId,
      above.map((m) => m.id),
    );
  } catch (err) {
    // Pass 1 MINOR-3 흡수: 운영 진단 sentinel — caller logger 주입 carry-over 영속.
    console.error(
      '[stage3] fetchClustersByIds failed → graceful Miss',
      err instanceof Error ? err.message : err,
    );
    return buildEmptyResult();
  }
  if (clusterRows.length === 0) {
    // Vectorize 매칭 있으나 D1 부재 — drift 신호 (admin 적재/삭제 비동기). graceful Miss.
    return buildEmptyResult();
  }

  const matchById = new Map(above.map((m) => [m.id, m]));
  const matches: TopicClusterMatch[] = clusterRows
    .map((cluster) => ({
      cluster,
      similarity: matchById.get(cluster.id)?.score ?? 0,
    }))
    .sort((a, b) => b.similarity - a.similarity);

  // Stage 3.c: 각 cluster.embedding 으로 knowledge_node 2nd vector query (D-TCV-4-FIX-1=B-1).
  // Reality Anchor (Session 061): production cluster.lv1 (간소화 도메인) ≠ kn.lv1_insurance
  // (보험 종목명) → 직접 컬럼 매칭 영구 0건. cluster 의 임베딩 자체로 의미 매칭하여 명명
  // 비대칭 흡수.
  //
  // fetchNodesByIds 는 knowledge_nodes 테이블 IN 쿼리이므로 vector query 결과에 cluster id
  // 가 섞여 들어와도 자연 0행 (자체 cross-pollution 차단).
  const allNodeHits: UserSearchHit[] = [];
  for (const m of matches) {
    const clusterMatch = matchById.get(m.cluster.id);
    if (clusterMatch?.values === undefined || clusterMatch.values.length === 0) {
      // returnValues 미반환 (Vectorize V2 옵션 부재) — graceful Miss + Stage 4 진입 신호.
      continue;
    }
    clustersWithEmbeddingCount += 1;

    // Pass 1 MAJOR-1 흡수: nodeQueryAttemptCount 를 try 진입 직후 increment
    // — throw 시점 미증가 회피 (시도 vs 성공 의미 분리).
    nodeQueryAttemptCount += 1;
    let nodeMatches: ReadonlyArray<{ readonly id: string; readonly score: number }>;
    try {
      // Reality Anchor (Session 061 staging e2e): Vectorize V2 binding filter 객체
      // 형식 ($in/$nin/$ne) 적용 시 0건 반환 (binding spec mismatch). Stage 1 정합
      // 으로 단순 exam_id filter + STAGE3_NODE_QUERY_OVERFETCH_RATIO 배 회수 +
      // client-side prefix exclusion 채택.
      //
      // overfetch: cluster.embedding 으로 query 시 cluster 끼리 cosine 가장 높음 →
      // 충분한 candidates 회수 후 prefix filter + fetchNodesByIds D1 IN (knowledge_nodes
      // 테이블 자연 0행) 으로 차단.
      const nodeResp = await vectorize.query(clusterMatch.values, {
        topK: TOPIC_CLUSTER_NODES_PER_CLUSTER * STAGE3_NODE_QUERY_OVERFETCH_RATIO,
        filter: { exam_id: examId as string },
        returnMetadata: 'none',
      });
      nodeMatches = nodeResp.matches ?? [];
    } catch (err) {
      // 단일 cluster 의 2nd query throw → 해당 cluster 만 skip + 다음 cluster 진행.
      // Pass 1 MINOR-3 흡수: 운영 진단 sentinel.
      console.error(
        '[stage3] vectorize.query 2nd failed → cluster skip',
        err instanceof Error ? err.message : err,
      );
      continue;
    }
    nodeMatchCount += nodeMatches.length;

    // client-side filter: 임계 + cluster id self-exclusion + prefix exclusion (V2 filter spec mismatch fallback)
    const aboveNode = nodeMatches.filter(
      (n) =>
        n.score >= KNOWLEDGE_NODE_MIN_SIMILARITY &&
        n.id !== m.cluster.id &&
        !STAGE3_NODE_ID_EXCLUDE_PREFIXES.some((prefix) => n.id.startsWith(prefix)),
    );
    nodeAboveThresholdCount += aboveNode.length;
    if (aboveNode.length === 0) continue;

    // Pass 1 CRIT-1 흡수: fetchNodesByIds throw 시 단일 cluster skip + 다음 cluster 진행.
    let nodes: ReadonlyArray<TopicClusterNodeRow>;
    try {
      nodes = await fetchNodesByIds(
        db,
        examId,
        aboveNode.map((n) => n.id),
      );
    } catch (err) {
      console.error(
        '[stage3] fetchNodesByIds failed → cluster skip',
        err instanceof Error ? err.message : err,
      );
      continue;
    }
    const scoreByNodeId = new Map(aboveNode.map((n) => [n.id, n.score]));
    for (const n of nodes) {
      const score = scoreByNodeId.get(n.id) ?? 0;
      allNodeHits.push(buildHit(n, score));
    }
  }

  // 중복 제거 (동일 node 가 여러 cluster 에 매핑된 경우 — 최고 similarity 보존)
  const dedupMap = new Map<string, UserSearchHit>();
  for (const hit of allNodeHits) {
    const existing = dedupMap.get(hit.id);
    if (existing === undefined || hit.score > existing.score) {
      dedupMap.set(hit.id, hit);
    }
  }
  const dedup = Array.from(dedupMap.values());

  // truth_weight DESC → similarity DESC → name ASC
  const ranked = dedup.sort((a, b) => {
    if (a.truthWeight !== b.truthWeight) return b.truthWeight - a.truthWeight;
    if (a.score !== b.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  const totalCap = TOPIC_CLUSTER_TOP_K * TOPIC_CLUSTER_NODES_PER_CLUSTER;
  const results = ranked.slice(0, totalCap);

  return {
    source: 'topic-cluster',
    // Pass 3 CRIT-4 흡수: lv2 surface 제거 + cluster.name 점수 분류 suffix strip
    clusters: matches.map((m) => ({
      id: m.cluster.id,
      name: sanitizeClusterName(m.cluster.name),
      lv1: m.cluster.lv1,
      similarity: m.similarity,
    })),
    results,
    diagnostics: {
      clusterMatchCount,
      clusterAboveThresholdCount,
      top1ClusterScore,
      clustersWithEmbeddingCount,
      nodeQueryAttemptCount,
      nodeMatchCount,
      nodeAboveThresholdCount,
    },
  };
}

/**
 * Pass 1 MAJ-3 흡수 (Session 059): examId 첫 인자 강제 (Hard Rule 16).
 *
 * Year 1 carry-over (plan §10): topic_clusters 에 exam_id 컬럼 부재 → 본 step SQL 미반영.
 * Year 2 마이그레이션 시점에 `WHERE exam_id = ?` 절 활성화 (zero-cost 전환).
 */
async function fetchClustersByIds(
  db: UserSearchD1,
  _examId: ExamId,
  ids: ReadonlyArray<string>,
): Promise<ReadonlyArray<TopicClusterRow>> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const sql = `
    SELECT id, name, lv1, lv2, lv3, COALESCE(exam_frequency, 0) AS exam_frequency
    FROM topic_clusters
    WHERE id IN (${placeholders})
      AND COALESCE(is_covered, 1) = 1
  `;
  try {
    const result = await db
      .prepare(sql)
      .bind(...ids)
      .all<TopicClusterRow>();
    return result.results ?? [];
  } catch (err) {
    // Pass 3 M2 정합: SQL keyword 노출 없도록 cause 보존 (caller dev inspect).
    throw new UserSearchError('Stage 3 topic_clusters D1 조회 실패', 'filter', err);
  }
}

/**
 * D-TCV-4-FIX-1=B-1 채택 (Session 061, plan phase2a-d-tcv-4-fix.plan.md §5.3).
 *
 * Vector 2nd query 로 매칭된 knowledge_node ids 를 D1 knowledge_nodes 테이블에서
 * 메타 조회. Stage 2 정합 (status='approved' + is_current_active=1).
 *
 * cluster id 가 ids 에 섞여도 knowledge_nodes 테이블 IN 쿼리이므로 자연 0행 — 별도
 * 사후 필터 불필요.
 *
 * Year 2 carry-over: valid_from time-based effectivity 필터 추가 + exam_id 컬럼
 * 활성화 — knowledge_nodes ADD COLUMN valid_from + revision_changes JOIN.
 */
async function fetchNodesByIds(
  db: UserSearchD1,
  _examId: ExamId,
  ids: ReadonlyArray<string>,
): Promise<ReadonlyArray<TopicClusterNodeRow>> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const sql = `
    SELECT kn.id, kn.type, kn.name, kn.description, kn.page_ref, kn.truth_weight
    FROM knowledge_nodes kn
    LEFT JOIN (
      SELECT target_id, to_status,
        ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY transitioned_at DESC) AS rn
      FROM status_transitions
      WHERE target_type = 'node'
    ) latest ON latest.target_id = kn.id AND latest.rn = 1
    WHERE kn.id IN (${placeholders})
      AND kn.is_current_active = 1
      AND COALESCE(latest.to_status, 'draft') = 'approved'
  `;
  try {
    const result = await db
      .prepare(sql)
      .bind(...ids)
      .all<TopicClusterNodeRow>();
    return result.results ?? [];
  } catch (err) {
    throw new UserSearchError('Stage 3 topic cluster nodes IN 조회 실패', 'filter', err);
  }
}

function buildHit(row: TopicClusterNodeRow, similarity: number): UserSearchHit {
  // Pass 1 CRIT-2 흡수 (Session 061 4-Pass): TRUTH_WEIGHTS 매핑 부재 + row.truth_weight
  // NULL/undefined 시 NaN 정렬 방지 — TRUTH_WEIGHT_NAN_GUARD (=0) fallback. Array.sort
  // `b.truthWeight - a.truthWeight = NaN` 비결정 정렬 차단.
  const truthWeight =
    TRUTH_WEIGHTS[row.type as NodeType] ?? row.truth_weight ?? TRUTH_WEIGHT_NAN_GUARD;
  return {
    id: row.id,
    score: similarity,
    type: row.type,
    truthWeight,
    pageRef: parsePageRefToInt(row.page_ref).value,
    name: row.name,
    description: row.description,
  };
}
