/**
 * Graceful Degradation 사용자 메시지 템플릿 (ADR-008 §6).
 *
 * 원칙: "AI 오류" 노출 대신 "교재가 더 정확" 신뢰 보존 메시지.
 * 상황별 카피 5종 고정 — UX 일관성 확보.
 *
 * i18n: Year 1 한국어 고정. Year 2 이후 언어 확장 시 `LocalizedMessage` 구조로.
 *
 * 근거:
 *   - ADR-008 §6 메시지 템플릿
 *   - 재정립서 v2.0/v3.0 Hard Rule 4 Graceful Degradation
 *   - CLAUDE.md CRITICAL RULE #3 (조용한 실패 금지 — 에러 안내 표준화)
 */

/** Graceful Degradation 발생 이유. */
export type DegradationReason =
  | 'low_similarity' // Vectorize 유사도 < 0.60 (ADR-004)
  | 'd1_5xx_with_kv' // D1 장애 + KV 폴백 hit
  | 'd1_5xx_no_kv' // D1 장애 + KV miss (read-only 공용)
  | 'write_path_503' // write-path 재시도 유도
  | 'claude_rate_limit'; // Claude API rate-limit

export interface DegradationContext {
  readonly reason: DegradationReason;
  /** 교재 페이지 레퍼런스 (예: "5장 3절", "p.432"). 없으면 일반 안내. */
  readonly pageRef?: string;
}

/**
 * ADR-008 §6 메시지 템플릿 5종.
 *
 * @param ctx - 저하 이유 + 교재 레퍼런스
 * @returns 사용자 노출 한국어 문구
 */
export function gracefulDegradationMessage(ctx: DegradationContext): string {
  const { reason, pageRef } = ctx;
  const pageFragment = pageRef !== undefined ? `${pageRef} 페이지` : '해당 단원';

  switch (reason) {
    case 'low_similarity':
      return `이 주제는 교재 ${pageFragment}가 더 정확합니다. AI 해설 대신 교재 원문을 권장합니다.`;
    case 'd1_5xx_with_kv':
      return `현재 일시적으로 최신 데이터 로드에 문제가 있어 최근 응답을 보여드립니다. 최신 정보는 교재 ${pageFragment}를 확인하세요.`;
    case 'd1_5xx_no_kv':
      return `일시적인 접속 문제로 이 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주시거나 교재 ${pageFragment}를 참고하세요.`;
    case 'write_path_503':
      return '저장 중 문제가 발생했습니다. 잠시 후 자동 재시도합니다.';
    case 'claude_rate_limit':
      return `잠시 후 다시 시도해주세요. 즉시 학습을 계속하려면 교재 ${pageFragment}를 참고하세요.`;
  }
}

/**
 * 회원가입/로그인 UX 메시지 (Phase 1 Step 1-1).
 *
 * 주의: 로그인 실패 관련 메시지는 모두 `LOGIN_INVALID_CREDENTIALS` 단일 메시지로
 * 통일한다 (suspended/deleted 분기 제거 — enumeration attack 방어, 4-Pass C-2).
 * 계정 상태 별 메시지를 노출하는 경로는 어드민 페이지 등 인증된 컨텍스트로 분리.
 */
export const AUTH_MESSAGES = {
  REGISTER_EMAIL_TAKEN: '이미 가입된 이메일입니다. 로그인을 시도해주세요.',
  REGISTER_PASSWORD_PWNED:
    '이 비밀번호는 외부 유출 기록이 있어 사용할 수 없습니다. 다른 비밀번호를 사용해주세요.',
  REGISTER_PASSWORD_TOO_SHORT: '비밀번호는 최소 8자 이상이어야 합니다.',
  LOGIN_INVALID_CREDENTIALS: '이메일 또는 비밀번호가 일치하지 않습니다.',
  HIBP_UNAVAILABLE:
    '비밀번호 유출 확인 서비스에 일시적으로 연결할 수 없습니다. 회원가입은 계속 진행됩니다.',
} as const;
