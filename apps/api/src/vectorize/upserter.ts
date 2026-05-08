/**
 * Vectorize Upserter — D1 노드 리스트를 bge-m3 임베딩 후 Cloudflare Vectorize 인덱스에 idempotent upsert.
 *
 * 계약:
 *   - 입력 노드 리스트는 caller 가 구성 (D1 fetch + text 변환). 본 모듈은 임베딩 + upsert 만 책임.
 *   - Hard Rule 16: 첫 인자 `examId: ExamId` 강제. 메타데이터 `exam_id` 자동 주입.
 *   - Hard Rule 17: 'son-hae-pyeong-ga-sa' 등 시험 리터럴 0건 — `EXAM_IDS` 경유 의무.
 *   - idempotent: Vectorize `upsert` 메서드 사용 — 동일 id 재진입 시 덮어쓰기.
 *   - 빈 catch 0건. 모든 실패 경로에서 `VectorizeUpsertError` 전파.
 *   - 재시도/타임아웃은 caller 책임 (ADR-008 graceful degradation 은 query 시점 정책).
 *
 * 비스코프:
 *   - 노드 D1 fetch (caller 가 처리, scripts/run-vectorize-indexing.ts 등)
 *   - 청크 분할 (caller 가 ≤100 단위로 호출 분할)
 *   - status 정책 (ADR-004 §4 Addendum 2026-05-08 — 모든 status 인덱싱, 검색 단계 단일 방어)
 *
 * 근거:
 *   - ADR-004 §3 메타데이터 + §4 Addendum (2026-05-08)
 *   - ADR-007 멀티시험 격리 (Hard Rule 16/17)
 *   - plan: docs/plans/phase2a-vectorize-indexing.plan.md §3.3
 */

import { AppError, ErrorCode, type ExamId } from '@thepick/shared';

/**
 * Workers AI bge-m3 binding (최소 인터페이스 — 테스트 mock 가능).
 *
 * 실제 Cloudflare Workers AI binding (`env.AI`) 은 더 많은 메서드를 노출하나,
 * 본 모듈은 bge-m3 호출만 의존. apps/api `worker-configuration.d.ts:9442`
 * (`@cf/baai/bge-m3`) 응답 형태와 정합 (`{ shape: [N, 1024], data: number[][] }`).
 */
export interface AiBinding {
  run(
    model: '@cf/baai/bge-m3',
    input: { readonly text: ReadonlyArray<string> },
  ): Promise<{
    readonly shape: ReadonlyArray<number>;
    readonly data: ReadonlyArray<ReadonlyArray<number>>;
  }>;
}

/**
 * Cloudflare Vectorize binding (최소 인터페이스 — 테스트 mock 가능).
 *
 * `upsert` 는 동일 id 재진입 시 덮어쓰기 (idempotent).
 * `insert` 는 충돌 시 에러를 throw 하므로 본 모듈은 사용하지 않음.
 */
export interface VectorizeBinding {
  upsert(vectors: ReadonlyArray<VectorizeVectorInput>): Promise<{ readonly mutationId: string }>;
}

export interface VectorizeVectorInput {
  readonly id: string;
  readonly values: ReadonlyArray<number>;
  readonly metadata: VectorizeUpsertMetadata;
}

/**
 * Vectorize 메타데이터 (ADR-004 §3 정합).
 *
 * `exam_id` 는 `upsertNodesToVectorize` 의 `examId` 인자로부터 자동 주입 — caller 는 본 인터페이스에서 생략.
 * primitive 만 (string | number | boolean) — Vectorize 메타데이터 타입 제약 충족.
 */
export interface VectorizeUpsertMetadata {
  readonly exam_id: string;
  readonly node_id: string;
  readonly node_type: string;
  readonly status: string;
  readonly truth_weight: number;
  readonly revision_year: number;
  readonly source_page: number;
  readonly is_active: boolean;
  readonly lv1_insurance?: string;
  readonly lv2_crop?: string;
  readonly exam_scope?: string;
}

/**
 * 입력 노드 — caller 가 D1 row 에서 변환하여 전달.
 *
 * `text` 는 임베딩 대상 — 보통 `name + '\n' + description` 형태이나 caller 결정.
 * `metadata` 는 `exam_id` 제외 (자동 주입). 테이블 별 매핑은 caller 책임 (knowledge_nodes vs table_cells 등).
 */
export interface NodeForVectorize {
  readonly id: string;
  readonly text: string;
  readonly metadata: Omit<VectorizeUpsertMetadata, 'exam_id'>;
}

export interface VectorizeUpsertResult {
  readonly upserted: number;
  readonly skipped: number;
  readonly mutationId: string | null;
  readonly durationMs: number;
}

export class VectorizeUpsertError extends AppError {
  readonly phase: 'validate' | 'embed' | 'upsert';
  constructor(message: string, phase: 'validate' | 'embed' | 'upsert', cause?: unknown) {
    const { code, statusCode } = mapPhaseToErrorCode(phase);
    super(code, message, statusCode);
    this.name = 'VectorizeUpsertError';
    this.phase = phase;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

function mapPhaseToErrorCode(phase: 'validate' | 'embed' | 'upsert'): {
  code: ErrorCode;
  statusCode: number;
} {
  switch (phase) {
    case 'validate':
      return { code: ErrorCode.VALIDATION_ERROR, statusCode: 400 };
    case 'embed':
      return { code: ErrorCode.AI_GENERATION_ERROR, statusCode: 500 };
    case 'upsert':
      return { code: ErrorCode.INTERNAL_ERROR, statusCode: 500 };
  }
}

/** 본 모듈이 한 번에 처리하는 최대 노드 수 (Workers AI bge-m3 한 호출당 100 텍스트 제한 정합). */
export const VECTORIZE_UPSERT_MAX_BATCH_SIZE = 100;

/** bge-m3 임베딩 차원 — ADR-004 §1 채택. 응답 검증에 사용. */
export const BGE_M3_DIMENSIONS = 1024;

/**
 * 노드 리스트를 bge-m3 임베딩 후 Vectorize 인덱스에 upsert.
 *
 * @param vectorize Cloudflare Vectorize binding (실제 또는 테스트 mock)
 * @param ai Workers AI binding (실제 또는 테스트 mock)
 * @param examId 시험 식별자 — 메타데이터 `exam_id` 자동 주입 (Hard Rule 16/17)
 * @param nodes 입력 노드 리스트 — 비어 있으면 no-op zero return
 *
 * @throws {VectorizeUpsertError} 입력 검증 실패 / AI 호출 실패 / Vectorize upsert 실패
 */
export async function upsertNodesToVectorize(
  vectorize: VectorizeBinding,
  ai: AiBinding,
  examId: ExamId,
  nodes: ReadonlyArray<NodeForVectorize>,
): Promise<VectorizeUpsertResult> {
  const startedAt = Date.now();

  if (!examId || (examId as string).trim() === '') {
    throw new VectorizeUpsertError('examId is required (Hard Rule 16 시험 경계 강제)', 'validate');
  }

  if (nodes.length === 0) {
    return { upserted: 0, skipped: 0, mutationId: null, durationMs: Date.now() - startedAt };
  }

  if (nodes.length > VECTORIZE_UPSERT_MAX_BATCH_SIZE) {
    throw new VectorizeUpsertError(
      `nodes.length=${nodes.length} exceeds VECTORIZE_UPSERT_MAX_BATCH_SIZE=${VECTORIZE_UPSERT_MAX_BATCH_SIZE} — caller 가 청크 분할 필요`,
      'validate',
    );
  }

  const seenIds = new Set<string>();
  for (const node of nodes) {
    if (!node.id || node.id.trim() === '') {
      throw new VectorizeUpsertError(`node id must be non-empty`, 'validate');
    }
    if (seenIds.has(node.id)) {
      throw new VectorizeUpsertError(
        `duplicate node id within single batch: '${node.id}' — caller 책임 (idempotency 보장 위반)`,
        'validate',
      );
    }
    seenIds.add(node.id);
    if (!node.text || node.text.trim() === '') {
      throw new VectorizeUpsertError(
        `node ${node.id}: text must be non-empty (임베딩 대상 부재)`,
        'validate',
      );
    }
    if (!node.metadata.node_type || node.metadata.node_type.trim() === '') {
      throw new VectorizeUpsertError(
        `node ${node.id}: metadata.node_type must be non-empty`,
        'validate',
      );
    }
    if (!node.metadata.status || node.metadata.status.trim() === '') {
      throw new VectorizeUpsertError(
        `node ${node.id}: metadata.status must be non-empty`,
        'validate',
      );
    }
  }

  const texts = nodes.map((n) => n.text);

  let aiResponse: Awaited<ReturnType<AiBinding['run']>>;
  try {
    aiResponse = await ai.run('@cf/baai/bge-m3', { text: texts });
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    throw new VectorizeUpsertError(
      `Workers AI bge-m3 호출 실패 (${nodes.length} 노드): ${msg}`,
      'embed',
      cause,
    );
  }

  if (!Array.isArray(aiResponse.data) || aiResponse.data.length !== nodes.length) {
    throw new VectorizeUpsertError(
      `bge-m3 응답 길이 불일치: 입력 ${nodes.length} 노드 vs 응답 data ${aiResponse.data?.length ?? 'undefined'}`,
      'embed',
    );
  }

  const vectors: VectorizeVectorInput[] = nodes.map((node, i) => {
    const values = aiResponse.data[i];
    if (!Array.isArray(values) || values.length !== BGE_M3_DIMENSIONS) {
      throw new VectorizeUpsertError(
        `bge-m3 응답 차원 불일치 (node ${node.id}): expected ${BGE_M3_DIMENSIONS}, got ${values?.length ?? 'undefined'}`,
        'embed',
      );
    }
    return {
      id: node.id,
      values,
      metadata: { ...node.metadata, exam_id: examId as string },
    };
  });

  let upsertResponse: Awaited<ReturnType<VectorizeBinding['upsert']>>;
  try {
    upsertResponse = await vectorize.upsert(vectors);
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    throw new VectorizeUpsertError(
      `Vectorize upsert 실패 (${vectors.length} vectors): ${msg}`,
      'upsert',
      cause,
    );
  }

  return {
    upserted: vectors.length,
    skipped: 0,
    mutationId: upsertResponse.mutationId,
    durationMs: Date.now() - startedAt,
  };
}
