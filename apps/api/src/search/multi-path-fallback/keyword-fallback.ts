/**
 * Multi-Path Fallback Stage 2 — Keyword/N-gram Match (D1 LIKE/substring).
 *
 * D-MPF-1=A 채택 (Session 059): 형태소 분석기 (kkma/khaiii) 미사용. Workers 즉시
 * 가동을 위한 D1 LIKE 단순 매칭. 한국어 어미 변화 미대응 한계 → SP-T06 ≥ 85%
 * 미달 시 옵션 B (bge-m3 reranking) 보강 의무.
 *
 * 알고리즘:
 *   1. query 를 공백 기준 토큰화 (단순)
 *   2. 길이 ≥ 2 토큰만 추출 (1자 noise 차단)
 *   3. 각 토큰에 대해 D1 `name LIKE '%token%' OR description LIKE '%token%'` 매칭
 *   4. 매칭 노드의 일치 토큰 수 (matchScore) 로 정렬 + Stage 2 정합 (approved + active)
 *   5. top-K=10 반환
 *
 * Hard Rule 16/17 정합: examId 첫 인자 강제, EXAM_IDS 경유 100%.
 * Stage 2 정합 (ADR-013): is_current_active=1 + status='approved' (status_transitions JOIN).
 *
 * 근거:
 *   - docs/plans/phase2a-multi-path-fallback.plan.md §3.1
 *   - docs/architecture/SEARCH_PIPELINE.md §5
 *   - docs/adr/ADR-015-multi-path-fallback-pipeline.md
 */

import { TRUTH_WEIGHTS, type ExamId, type NodeType } from '@thepick/shared';
import { parsePageRefToInt } from '../../vectorize/page-ref.js';
import { UserSearchError, type UserSearchD1, type UserSearchHit } from '../user-search.js';

/** Stage 2 keyword 매칭 최소 토큰 길이 (1자 noise 차단). */
export const KEYWORD_MIN_TOKEN_LEN = 2;

/** Stage 2 keyword 매칭 응답 max top-K. */
export const KEYWORD_FALLBACK_MAX_TOP_K = 10;

/** 토큰별 LIKE 매칭 최대 후보 (D1 부담 제한). */
export const KEYWORD_PER_TOKEN_LIMIT = 50;

interface KeywordMatchRow {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly description: string | null;
  readonly page_ref: string | null;
  readonly truth_weight: number;
  readonly is_current_active: number;
}

export interface KeywordFallbackResult {
  readonly source: 'keyword-fallback';
  readonly matchedTokens: ReadonlyArray<string>;
  readonly results: ReadonlyArray<UserSearchHit>;
}

/**
 * 자주 등장하는 한국어 조사/어미 — 토큰 끝에서 제거 (정확도 보강).
 *
 * Pass 3 M3 + Pass 1 MAJ-1 흡수 (Session 059): "낙엽률이" → "낙엽률".
 * 형태소 분석 미적용 단순 패턴 매칭이라 100% 커버 X — 정확도 보강 (D-MPF-1=A 정합).
 */
const KOREAN_PARTICLE_PATTERN =
  /(이|가|을|를|의|에|에서|에게|로|으로|에서는|에는|와|과|도|만|는|은|이라|이라고|이라는|입니다|입니까|이며|이고|이지만|인지|이지|이군요|어요|어서|에서도|까지|부터|마다)$/;

/**
 * query 를 공백 + 한국어 조사 기반 단순 토큰화.
 *
 * Pass 1 MAJ-1 흡수 (Session 059): 한국어 특수문자 (가운뎃점 · / 인용부호 “” /
 * 물결 〜 / 일본식 점 、 / 모지 「」『』) 포함 — Unicode property `\p{P}` `\p{S}`.
 * Pass 3 M3 흡수: 토큰 끝 한국어 조사/어미 제거 ("낙엽률이" → "낙엽률").
 *
 * 한계 (D-MPF-1=A 정합): 형태소 분석 없음 → 100% 커버 X. SP-T06 < 85% 미달 시
 * 옵션 B (bge-m3 reranking) 보강 의무.
 */
export function tokenizeQuery(query: string): ReadonlyArray<string> {
  return query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[\p{P}\p{S}]/gu, ''))
    .map((t) => {
      // 조사 제거 — KEYWORD_MIN_TOKEN_LEN 이상 보존 시에만 (단, 짧은 어미 1자 제거는 허용)
      const stripped = t.replace(KOREAN_PARTICLE_PATTERN, '');
      return stripped.length >= KEYWORD_MIN_TOKEN_LEN ? stripped : t;
    })
    .filter((t) => t.length >= KEYWORD_MIN_TOKEN_LEN);
}

/**
 * Stage 2 Keyword Fallback — D1 LIKE 매칭 + Stage 2 hard filter 정합.
 *
 * @returns matchedTokens (실제 매칭된 토큰 목록) + results (top-K hits)
 *          매칭 0건 시 results=[] (Stage 3 진입 신호)
 */
export async function runKeywordFallback(
  db: UserSearchD1,
  examId: ExamId,
  query: string,
  topK: number = KEYWORD_FALLBACK_MAX_TOP_K,
): Promise<KeywordFallbackResult> {
  if (!examId || (examId as string).trim() === '') {
    throw new UserSearchError('examId is required (Hard Rule 16 시험 경계 강제)', 'filter');
  }
  if (!query || query.trim() === '') {
    throw new UserSearchError('query must be non-empty', 'filter');
  }

  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return { source: 'keyword-fallback', matchedTokens: [], results: [] };
  }

  // 토큰별 후보 수집 — Pass 1 MAJ-2 + CRIT-2 흡수 (Session 059):
  //   - Promise.all 병렬화: N 토큰 × ~50ms D1 round-trip → 1 round-trip 동시화 (latency)
  //   - per-token try/catch 격리: 1 토큰 throw 가 전체 fallback 을 깨뜨리지 않음 (graceful)
  //   - 모든 토큰 throw 시 (totalFailed === tokens.length) 명시적 throw (조용한 0건 금지)
  const tokenResults = await Promise.all(
    tokens.map(async (token) => {
      try {
        const rows = await fetchTokenMatches(db, token);
        return { token, rows, error: null as unknown };
      } catch (err) {
        return { token, rows: [] as ReadonlyArray<KeywordMatchRow>, error: err };
      }
    }),
  );

  const totalFailed = tokenResults.filter((r) => r.error !== null).length;
  if (totalFailed === tokens.length) {
    // 모든 토큰 실패 — 첫 번째 cause 보존 + Pass 3 M2 정합 sanitized message
    const firstError = tokenResults.find((r) => r.error !== null)?.error;
    throw new UserSearchError('Stage 2 keyword fallback 전체 실패', 'filter', firstError);
  }

  const matchByNode = new Map<string, { row: KeywordMatchRow; matched: Set<string> }>();
  const actualMatched = new Set<string>();

  for (const { token, rows } of tokenResults) {
    if (rows.length > 0) actualMatched.add(token);
    for (const row of rows) {
      const existing = matchByNode.get(row.id);
      if (existing !== undefined) {
        existing.matched.add(token);
      } else {
        matchByNode.set(row.id, { row, matched: new Set([token]) });
      }
    }
  }

  if (matchByNode.size === 0) {
    return { source: 'keyword-fallback', matchedTokens: [], results: [] };
  }

  // 일치 토큰 수 DESC → truth_weight DESC → name 사전식 ASC
  const ranked = Array.from(matchByNode.values()).sort((a, b) => {
    if (a.matched.size !== b.matched.size) return b.matched.size - a.matched.size;
    const wA = TRUTH_WEIGHTS[a.row.type as NodeType] ?? a.row.truth_weight;
    const wB = TRUTH_WEIGHTS[b.row.type as NodeType] ?? b.row.truth_weight;
    if (wA !== wB) return wB - wA;
    return a.row.name.localeCompare(b.row.name);
  });

  const effectiveTopK = Math.min(Math.max(topK, 1), KEYWORD_FALLBACK_MAX_TOP_K);
  const results: UserSearchHit[] = ranked.slice(0, effectiveTopK).map(({ row, matched }) => {
    const truthWeight = TRUTH_WEIGHTS[row.type as NodeType] ?? row.truth_weight;
    return {
      id: row.id,
      // keyword score: 일치 토큰 비율 (0.0~1.0). vector similarity 와 의미 다르나 동일 응답 shape.
      score: matched.size / tokens.length,
      type: row.type,
      truthWeight,
      pageRef: parsePageRefToInt(row.page_ref).value,
      name: row.name,
      description: row.description,
    };
  });

  return {
    source: 'keyword-fallback',
    matchedTokens: Array.from(actualMatched),
    results,
  };
}

/**
 * 단일 토큰 LIKE 매칭 — Stage 2 정합 (status='approved' + is_current_active=1).
 *
 * SQL 정책 (Pass 3 M2 흡수, Session 058):
 *   - status_transitions LEFT JOIN ROW_NUMBER OVER PARTITION (최신 to_status)
 *   - knowledge_nodes.status 컬럼은 INSERT snapshot — 실제 status 는 status_transitions
 */
async function fetchTokenMatches(
  db: UserSearchD1,
  token: string,
): Promise<ReadonlyArray<KeywordMatchRow>> {
  // SQL injection 방어 — '?' parameter binding 만 사용. token 본문 % 자체 escape 미필요
  // (D1 SQLite 는 LIKE escape 별도 지정 시에만 활성). 정상 학습자 query 에 % 가 의미
  // 있는 검색 의도가 부재해 단순 substring 매칭 안전.
  const likePattern = `%${token}%`;
  const sql = `
    SELECT kn.id, kn.type, kn.name, kn.description, kn.page_ref, kn.truth_weight,
           kn.is_current_active
    FROM knowledge_nodes kn
    LEFT JOIN (
      SELECT target_id, to_status,
        ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY transitioned_at DESC) AS rn
      FROM status_transitions
      WHERE target_type = 'node'
    ) latest ON latest.target_id = kn.id AND latest.rn = 1
    WHERE (kn.name LIKE ? OR kn.description LIKE ?)
      AND kn.is_current_active = 1
      AND COALESCE(latest.to_status, 'draft') = 'approved'
    LIMIT ${KEYWORD_PER_TOKEN_LIMIT}
  `;
  try {
    const result = await db.prepare(sql).bind(likePattern, likePattern).all<KeywordMatchRow>();
    return result.results ?? [];
  } catch (err) {
    // Pass 3 M2 정합 — public message 에 SQL keyword 비포함. cause 보존.
    throw new UserSearchError('Stage 2 keyword fallback 실패', 'filter', err);
  }
}
