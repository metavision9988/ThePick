/**
 * source_id 결정성 헬퍼 — Step 5 (Reproducibility/Idempotency) plan v1.1 §"v1.1 명시 이연" 흡수.
 *
 * 형식: `{page_ref}#{node_id}` (정상) 또는 `<no_page>#{node_id}` (NULL/empty fallback).
 *
 * 결정성 계약:
 *   - 동일 (page_ref, node_id) 입력 → 동일 source_id 출력 (100% 결정성)
 *   - knowledge_nodes(batch_run_id, source_id) partial UNIQUE 제약 활성화 키
 *   - 동일 PDF + 동일 파서 버전 + 동일 ontology-registry → 동일 source_id
 *
 * 근거:
 *   - docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md v1.1 §"v1.1 명시 이연" 권고 (B)
 *   - migrations/0016_knowledge_nodes_batch_idempotency.sql:20-24
 *   - .claude/reviews/midpoint-20260428-backend.md C-1
 */

/** NULL/empty page_ref fallback prefix (plan v1.1 명시 이연 권고 B). */
export const PAGE_REF_FALLBACK = '<no_page>';

/** source_id 구분자. SHA-256 / hex / hyphen 충돌 회피용 단일 문자. */
export const SOURCE_ID_SEPARATOR = '#';

/**
 * page_ref + node_id → source_id 결정성 결합.
 *
 * 정책 (B) — `page_ref` 가 null / undefined / empty / whitespace 시 `<no_page>` fallback.
 * preValidate (draft-loader.ts) 가 source_page ≥ 1 을 강제하므로 정상 흐름에서는 fallback 미진입,
 * 단 fixture seed / migration replay / 미래 확장 caller 대비 안전망.
 *
 * @param pageRef knowledge_nodes.page_ref 컬럼 값.
 *   - **Step 16a 정상 caller (`pageRefString` via `draft-loader.ts:399`) 는 항상 정수 문자열 ("403")** —
 *     `preValidate` 가 `source_page ≥ 1` 강제로 NULL/empty 진입 차단.
 *   - 헬퍼 자체는 범위 ("403-434") / section ("525:§4-2") / "p.NNN" 등 임의 문자열도 결정성 보장하나
 *     정상 흐름에서는 사용 X. 16b/16c e2e 진입 시점에 page_ref 형식 모델 확정 후 caller 보강 의무.
 *   - migration 0010 의 page_ref CHECK 제약 형식과 정합 (정수 / 범위 / section).
 * @param nodeId ontology-registry 패턴 (예: 'CONCEPT-001', 'F-01', 'INS-01', 'CROP-001')
 * @returns 결정성 source_id (`{page_ref}#{node_id}` 또는 `<no_page>#{node_id}`)
 * @throws Error nodeId 가 빈 문자열 / whitespace 인 경우 (idempotency 키 부재 차단)
 */
export function buildSourceId(pageRef: string | null | undefined, nodeId: string): string {
  if (typeof nodeId !== 'string' || nodeId.trim() === '') {
    throw new Error('buildSourceId: nodeId must be a non-empty string (idempotency key 부재 차단)');
  }

  const normalizedPageRef =
    typeof pageRef === 'string' && pageRef.trim() !== '' ? pageRef : PAGE_REF_FALLBACK;

  return `${normalizedPageRef}${SOURCE_ID_SEPARATOR}${nodeId}`;
}
