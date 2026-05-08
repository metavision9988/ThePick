/**
 * page_ref 파서 — `'p.123-125'` / `'684'` / `null` 모두 처리.
 *
 * 첫 정수만 추출. 추출 실패 시 `{value: 0, parsed: false}`. caller (knowledge_nodes / table_*)
 * 가 `parsed === false` 시 운영자 detect 용 `console.warn` 출력 의무.
 *
 * 근거:
 *   - Pass 1 SURGEON M3 (Session 056) — `page_ref='p.??'` 같은 비정상 입력 시 silent 0 sentinel
 *     로 fallback 되면 검색 결과 출처 'p.0' 사용자 혼란 — 운영자 detect 필요
 *   - Pass 1 + 5th MAJOR-1 (Session 057) — table-fetcher 와 routes.ts 의 parsePageRefToInt 시그니처
 *     불일치 (DRY 위반) — 본 모듈로 단일화
 *   - 5th-m1 (Session 056) — `0` sentinel 의도 명시 (Vectorize 메타데이터 nullable 미지원 정합)
 */

export interface PageRefParseResult {
  /** 추출된 정수. 추출 실패 시 0 sentinel (Vectorize 메타데이터 nullable 미지원 정합). */
  readonly value: number;
  /** true = 정수 추출 성공, false = 입력 비정상 (caller 가 console.warn 출력 의무). */
  readonly parsed: boolean;
}

export function parsePageRefToInt(pageRef: string | null | undefined): PageRefParseResult {
  if (typeof pageRef !== 'string' || pageRef.trim() === '') {
    return { value: 0, parsed: false };
  }
  const match = pageRef.match(/\d+/);
  if (match === null) {
    return { value: 0, parsed: false };
  }
  return { value: Number.parseInt(match[0], 10), parsed: true };
}

/**
 * page_ref 파싱 + 운영자 detect warn 일체화 (caller boilerplate 절감).
 *
 * 정상 추출 시 `value` 만 반환. 비정상 입력 (`pageRef` 가 비어있지 않은데 정수 추출 실패)
 * 시 `console.warn` 출력 후 `0` sentinel 반환.
 *
 * @param pageRef 입력 페이지 ref 문자열
 * @param nodeId 운영자 detect 용 node id (warn 메시지에 포함)
 * @returns 정수 (정상=추출값, 비정상=0)
 */
export function parsePageRefWithWarn(pageRef: string | null | undefined, nodeId: string): number {
  const result = parsePageRefToInt(pageRef);
  if (!result.parsed && typeof pageRef === 'string' && pageRef.trim() !== '') {
    console.warn(
      `parsePageRefToInt: failed to extract integer from '${pageRef}' for node ${nodeId} (source_page=0 sentinel)`,
    );
  }
  return result.value;
}
