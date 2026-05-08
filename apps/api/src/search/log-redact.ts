/**
 * 검색 라우트 로그 PII 마스킹 유틸 — Pass 3 ADVOCATE M1 흡수 (Session 059).
 *
 * 학습자 자연어 query 는 PII 후보 (이름·번호·민감 학습 의도 포함 가능). 운영 로그 (CF Workers
 * tail / 외부 aggregator) 에 평문 노출 시 다음 위험:
 *   1. 로그 aggregator 접근 권한 보유자 ≠ need-to-know 인 모든 동료/계약자 노출
 *   2. 로그 백업/저장 정책 (보존 기간, 암호화) 가 application 데이터와 다를 수 있음
 *   3. 사고 시 dump 가 외부 유출되면 query 전체 평문 노출
 *
 * 본 모듈 정책:
 *   - query 자체는 절대 로깅하지 않는다.
 *   - `length` (자릿수) + `hash` (SHA-256 첫 12 hex 자릿수, 약 48-bit) 만 로깅.
 *   - hash 는 동일 query 그룹핑 (반복 발생 패턴 분석) 용 — pre-image 복원 불가.
 *
 * Web Crypto `subtle.digest('SHA-256', ...)` 사용 — Workers 런타임 1급 지원.
 *
 * 근거:
 *   - .claude/reviews/ session 058 4-Pass Pass 3 ADVOCATE M1
 *   - .claude/rules/production-quality.md "보안: API 키 하드코딩 없음, 입력 검증"
 */

const QUERY_HASH_PREFIX_LEN = 12;

export interface QueryDigest {
  /** Query 평문 길이 (UTF-16 code unit count — JS string.length 일치). */
  readonly length: number;
  /** SHA-256 hex first 12 chars (~48-bit). pre-image 복원 불가, 그룹핑 가능. */
  readonly hash: string;
}

/**
 * 학습자 query → 로그 안전 다이제스트 (length + hash).
 *
 * 평문은 절대 반환하지 않는다. 호출 측은 본 함수 결과만 로깅 가능.
 *
 * @param query 학습자 자연어 입력 (1~500자 z.string().max(500))
 * @returns `{ length, hash }` — 양쪽 다 plain string, JSON.stringify 안전
 */
export async function digestQueryForLog(query: string): Promise<QueryDigest> {
  const encoder = new TextEncoder();
  const data = encoder.encode(query);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return {
    length: query.length,
    hash: hex.slice(0, QUERY_HASH_PREFIX_LEN),
  };
}
