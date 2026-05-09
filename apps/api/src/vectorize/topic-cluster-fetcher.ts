/**
 * Topic Cluster Fetcher — D1 topic_clusters row 를 Vectorize 인덱싱용 NodeForVectorize 로 변환
 * (Phase 2A Step — Multi-Path Fallback Stage 3 dead path 해제, handoff-068 우선순위 1).
 *
 * 책임:
 *   - 50건 cluster name 임베딩 대상 텍스트 생성 (D-TCV-1=A: cluster.name 단독)
 *   - metadata.node_type='topic_cluster' string 고정 (NodeType union 미수정 — Year 2 carry-over)
 *   - status='approved' 고정 (topic_clusters 테이블에 status 컬럼 부재, 운영 데이터 기본값)
 *   - truth_weight=5 sentinel (D-TCV-2=A: CONCEPT 수준)
 *   - exam_id 자동 주입 (Hard Rule 16/17 — upserter.ts 가 처리)
 *   - lv1/lv2 메타 보존 (Year 2 zero-cost — exam_id 컬럼 부재 가정)
 *
 * ★★ Reality Anchor (lv2 의미 mismatch — D-TCV-4=A carry-over):
 *   production topic_clusters.lv2 는 점수 분류 ('5점' / '15점' / '5점/15점') 이지 작물명이 아님.
 *   metadata.lv2_crop 으로 적재하지만, topic-cluster-router.ts:fetchNodesByCluster 의
 *   `kn.lv2_crop = ?` 매칭은 의미 mismatch (knowledge_nodes.lv2_crop은 '벼'/'마늘' 등 작물).
 *   별도 step에서 fetchNodesByCluster 정정 의무 (lv1만 매칭 또는 새 lv2_score 도입).
 *   본 fetcher 는 적재 책임 단일 — 의미 정합은 별도 step.
 *
 * 비스코프:
 *   - Vectorize upsert (upsertNodesToVectorize 위임)
 *   - 청크 분할 (caller — routes.ts limit/offset, max 100 정합)
 *   - NodeType union 'TOPIC_CLUSTER' 추가 (Year 2 ontology v1.6.0 + ADR)
 *
 * 근거:
 *   - docs/plans/phase2a-topic-cluster-vectorize-indexing.plan.md §3.1
 *   - docs/plans/phase2a-multi-path-fallback.plan.md §10 (Stage 3 활성화 carry-over)
 *   - ADR-004 §3 메타데이터 + ADR-007 멀티시험 격리
 *   - migrations/0002_1st_exam_extension.sql:81 (topic_clusters CREATE TABLE)
 */

import type { ExamId } from '@thepick/shared';
import {
  VECTORIZE_UPSERT_MAX_BATCH_SIZE,
  type NodeForVectorize,
  type VectorizeUpsertMetadata,
} from './upserter.js';
import type { D1Reader, FetchPagination } from './table-fetcher.js';

/** topic_clusters Vectorize 메타 truth_weight sentinel (D-TCV-2=A — CONCEPT 수준). */
export const TOPIC_CLUSTER_TRUTH_WEIGHT = 5;

/** topic_clusters Vectorize 메타 node_type 고정값 (Multi-Path Stage 3 filter 정합). */
export const TOPIC_CLUSTER_NODE_TYPE = 'topic_cluster';

/** topic_clusters 운영 status 기본값 (테이블에 status 컬럼 부재). */
export const TOPIC_CLUSTER_STATUS = 'approved';

interface TopicClusterRow {
  readonly id: string;
  readonly name: string;
  readonly lv1: string | null;
  readonly lv2: string | null;
  readonly lv3: string | null;
}

/**
 * topic_clusters → NodeForVectorize 변환.
 *
 * 텍스트 합성: row.name 단독 (D-TCV-1=A — 이미 lv1+세부주제 결합 형태, 자연어 query 매칭 정합).
 * 정확도 < 85% (SP-T06) 미달 시 D-TCV-1=B (lv1 강조) 보강 검토 별도 step.
 *
 * @param db D1Reader (production 또는 test mock)
 * @param examId 시험 식별자 — 메타데이터 자동 주입 (Hard Rule 16/17)
 * @param pagination limit ≤ 100 (upserter.ts MAX_BATCH_SIZE 정합)
 *
 * @throws {Error} examId 미지정 (Hard Rule 16) / row.name 빈 string (임베딩 대상 부재)
 */
export async function fetchTopicClustersForVectorize(
  db: D1Reader,
  examId: ExamId,
  pagination: FetchPagination,
): Promise<ReadonlyArray<NodeForVectorize>> {
  if (!examId || (examId as string).trim() === '') {
    throw new Error('examId is required (Hard Rule 16 시험 경계 강제)');
  }

  // Pass 1 SURGEON m1 흡수 (Session 060) — caller (route schema) 가 max=100 강제하나,
  // 다른 caller (batch script 등) 직접 호출 시 fetcher 자체에서 차단 (table-fetcher 정합).
  if (pagination.limit > VECTORIZE_UPSERT_MAX_BATCH_SIZE) {
    throw new Error(
      `pagination.limit=${pagination.limit} exceeds VECTORIZE_UPSERT_MAX_BATCH_SIZE=${VECTORIZE_UPSERT_MAX_BATCH_SIZE}`,
    );
  }

  const sql = `
    SELECT id, name, lv1, lv2, lv3
    FROM topic_clusters
    WHERE COALESCE(is_covered, 1) = 1
    ORDER BY id
    LIMIT ? OFFSET ?
  `;

  const result = await db
    .prepare(sql)
    .bind(pagination.limit, pagination.offset)
    .all<TopicClusterRow>();
  const rows = result.results ?? [];

  return rows.map(buildTopicClusterNode);
}

function buildTopicClusterNode(row: TopicClusterRow): NodeForVectorize {
  if (!row.name || row.name.trim() === '') {
    throw new Error(`topic_clusters row ${row.id}: name must be non-empty (임베딩 대상 부재)`);
  }

  const text = row.name;

  // VectorizeUpsertMetadata 정합 — node_type 은 string 타입이므로 'topic_cluster' 리터럴 허용.
  // NodeType union 미확장 (Year 2 carry-over). topic-cluster-router.ts 의 filter 키와 정합.
  const metadata: Omit<VectorizeUpsertMetadata, 'exam_id'> = {
    node_id: row.id,
    node_type: TOPIC_CLUSTER_NODE_TYPE,
    status: TOPIC_CLUSTER_STATUS,
    truth_weight: TOPIC_CLUSTER_TRUTH_WEIGHT,
    revision_year: 0,
    source_page: 0,
    is_active: true,
    ...(row.lv1 ? { lv1_insurance: row.lv1 } : {}),
    ...(row.lv2 ? { lv2_crop: row.lv2 } : {}),
  };

  return { id: row.id, text, metadata };
}
