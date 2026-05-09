/**
 * Multi-Path Fallback Stage 3 — Topic Cluster Routing.
 *
 * D-MPF-2=A 채택 (Session 059): Vectorize 재활용. topic_clusters 50건 사전 임베딩
 * 적재 후 query embedding 과 cosine similarity 매칭.
 *
 * 본 step 가정 (carry-over — plan §10):
 *   - topic_clusters.id 별 임베딩이 Vectorize index 에 **node_type='topic_cluster'**
 *     메타데이터로 사전 적재되어야 함 — 적재 step 별도 (admin upsert endpoint or batch).
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
 * 알고리즘:
 *   1. precomputed query embedding 으로 Vectorize.query(filter: node_type+exam_id,
 *      topK=3, similarity ≥ 0.50)
 *   2. 매칭된 topic_cluster id 로 D1 topic_clusters 조회 → lv1 / lv2 / name
 *   3. 각 cluster 의 lv1/lv2 로 knowledge_nodes JOIN (lv1_insurance / lv2_crop 분리)
 *      + Stage 2 정합 (approved + active)
 *   4. 학습자 안내: "관련 토픽 같습니다. 관련 노드 N개" + page_ref 출처
 *
 * Hard Rule 16: examId 첫 인자 강제. Year 1 단일 시험 (한시 예외) — Year 2 멀티시험
 * 진입 시 topic_clusters 에 exam_id 컬럼 추가 의무.
 *
 * 근거:
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

export interface TopicClusterRouterResult {
  readonly source: 'topic-cluster';
  readonly clusters: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly lv1: string | null;
    readonly lv2: string | null;
    readonly similarity: number;
  }>;
  readonly results: ReadonlyArray<UserSearchHit>;
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

  // Stage 3.a: Vectorize topic_cluster 매칭
  // Pass 2 CRITICAL-1 흡수: filter 키 'node_type' (upserter.ts VectorizeUpsertMetadata 정합)
  // + exam_id (Hard Rule 16 zero-cost). Pass 1 CRIT-3 흡수: throw 시 graceful Miss.
  let vectorMatches: ReadonlyArray<{ id: string; score: number }>;
  try {
    const resp = await vectorize.query(queryEmbedding, {
      topK: TOPIC_CLUSTER_TOP_K,
      filter: { node_type: TOPIC_CLUSTER_NODE_TYPE, exam_id: examId as string },
      returnMetadata: 'none',
    });
    vectorMatches = resp.matches ?? [];
  } catch {
    // Pass 1 CRIT-3 흡수 (Session 059) — graceful Miss + Stage 4 진입.
    // 운영 모니터링은 caller (multi-path-fallback/index.ts) 의 logger 측면에서 수행
    // (deps 에 logger 주입 carry-over — 본 step 은 빈 결과 반환).
    return { source: 'topic-cluster', clusters: [], results: [] };
  }

  const above = vectorMatches.filter((m) => m.score >= TOPIC_CLUSTER_MIN_SIMILARITY);
  if (above.length === 0) {
    return { source: 'topic-cluster', clusters: [], results: [] };
  }

  // Stage 3.b: D1 topic_clusters 메타 조회 (Pass 1 MAJ-3 흡수: examId 첫 인자)
  const clusterIds = above.map((m) => m.id);
  const clusterRows = await fetchClustersByIds(db, examId, clusterIds);
  if (clusterRows.length === 0) {
    // Vectorize 매칭 있으나 D1 부재 — drift 신호 (admin 적재/삭제 비동기). graceful Miss.
    return { source: 'topic-cluster', clusters: [], results: [] };
  }

  const scoreById = new Map(above.map((m) => [m.id, m.score]));
  const matches: TopicClusterMatch[] = clusterRows
    .map((cluster) => ({ cluster, similarity: scoreById.get(cluster.id) ?? 0 }))
    .sort((a, b) => b.similarity - a.similarity);

  // Stage 3.c: 각 cluster lv1/lv2 로 knowledge_nodes 추천 (Stage 2 정합).
  // Pass 1 MAJ-4 흡수 — cluster.lv1 (lv1_insurance 도메인) + cluster.lv2 (lv2_crop 도메인)
  // 분리 매칭 (이전 OR 결합으로 인한 정밀도 손실 차단).
  const allNodeHits: UserSearchHit[] = [];
  for (const m of matches) {
    if (m.cluster.lv1 === null && m.cluster.lv2 === null) continue;
    const nodes = await fetchNodesByCluster(db, examId, m.cluster.lv1, m.cluster.lv2);
    for (const n of nodes) {
      allNodeHits.push(buildHit(n, m.similarity));
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
    clusters: matches.map((m) => ({
      id: m.cluster.id,
      name: m.cluster.name,
      lv1: m.cluster.lv1,
      lv2: m.cluster.lv2,
      similarity: m.similarity,
    })),
    results,
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
 * cluster.lv1 (lv1_insurance 도메인) + cluster.lv2 (lv2_crop 도메인) 분리 매칭.
 *
 * Pass 1 MAJ-4 흡수 (Session 059): 이전 `lv1 OR lv2_crop = lv1_value` 결합으로 인한
 * 정밀도 손실 차단. 각 cluster level 을 정확한 컬럼에 매칭.
 *
 * Stage 2 정합 (status='approved' + is_current_active=1).
 *
 * Year 2 carry-over (plan §10): valid_from time-based effectivity 필터 추가 + exam_id
 * 컬럼 활성화 — knowledge_nodes ADD COLUMN valid_from + revision_changes JOIN.
 */
async function fetchNodesByCluster(
  db: UserSearchD1,
  _examId: ExamId,
  lv1: string | null,
  lv2: string | null,
): Promise<ReadonlyArray<TopicClusterNodeRow>> {
  const conditions: string[] = [];
  const params: string[] = [];
  if (lv1 !== null) {
    conditions.push('kn.lv1_insurance = ?');
    params.push(lv1);
  }
  if (lv2 !== null) {
    conditions.push('kn.lv2_crop = ?');
    params.push(lv2);
  }
  if (conditions.length === 0) return [];

  const sql = `
    SELECT kn.id, kn.type, kn.name, kn.description, kn.page_ref, kn.truth_weight
    FROM knowledge_nodes kn
    LEFT JOIN (
      SELECT target_id, to_status,
        ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY transitioned_at DESC) AS rn
      FROM status_transitions
      WHERE target_type = 'node'
    ) latest ON latest.target_id = kn.id AND latest.rn = 1
    WHERE (${conditions.join(' OR ')})
      AND kn.is_current_active = 1
      AND COALESCE(latest.to_status, 'draft') = 'approved'
    LIMIT ${TOPIC_CLUSTER_NODES_PER_CLUSTER}
  `;
  try {
    const result = await db
      .prepare(sql)
      .bind(...params)
      .all<TopicClusterNodeRow>();
    return result.results ?? [];
  } catch (err) {
    throw new UserSearchError('Stage 3 topic cluster nodes JOIN 실패', 'filter', err);
  }
}

function buildHit(row: TopicClusterNodeRow, similarity: number): UserSearchHit {
  const truthWeight = TRUTH_WEIGHTS[row.type as NodeType] ?? row.truth_weight;
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
