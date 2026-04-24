/**
 * Claude API 토큰 단가표 (2026-01 스냅샷).
 *
 * 배치 파이프라인(apps/batch)에서 토큰 비용 로깅 시 사용. 단가는 공식 문서 기준이며
 * 모델이 deprecation 되거나 요금이 바뀌면 여기에서만 갱신한다 — 하드코딩 금지.
 *
 * 단위: USD per 1,000,000 tokens (백만 토큰 당 달러).
 */

export interface ClaudeModelPricing {
  /** input(prompt) 100만 토큰 당 USD. */
  readonly inputUsdPerMillion: number;
  /** output(completion) 100만 토큰 당 USD. */
  readonly outputUsdPerMillion: number;
  /** 모델 라벨 — 로깅용 (실제 모델 ID 와 별개). */
  readonly displayName: string;
}

/**
 * 모델별 단가 레지스트리. 알 수 없는 모델 ID 는 fallback 단가로 계산되고 경고 로그.
 * 새 모델 추가 시: 모델 ID 키 + inputUsdPerMillion + outputUsdPerMillion + displayName.
 */
export const CLAUDE_PRICING: Record<string, ClaudeModelPricing> = {
  // Haiku 4.5 — 배치 구조화 기본 모델. 빠르고 저렴.
  'claude-haiku-4-5-20251001': {
    inputUsdPerMillion: 1.0,
    outputUsdPerMillion: 5.0,
    displayName: 'Claude Haiku 4.5',
  },
  // Sonnet 4.6 — Vision OCR / 복잡 추론.
  'claude-sonnet-4-6': {
    inputUsdPerMillion: 3.0,
    outputUsdPerMillion: 15.0,
    displayName: 'Claude Sonnet 4.6',
  },
  // Opus 4.7 — 최고 품질 (배치에서는 기본 미사용, 수동 호출 시 대비).
  'claude-opus-4-7': {
    inputUsdPerMillion: 15.0,
    outputUsdPerMillion: 75.0,
    displayName: 'Claude Opus 4.7',
  },
};

/** 알 수 없는 모델 ID 대응 fallback (보수적으로 Sonnet 단가 사용). */
export const FALLBACK_PRICING: ClaudeModelPricing = {
  inputUsdPerMillion: 3.0,
  outputUsdPerMillion: 15.0,
  displayName: 'UNKNOWN (Sonnet fallback pricing)',
};

/**
 * 입출력 토큰 수 → 비용(USD) 계산. 소수점 6자리까지 round.
 * 알 수 없는 모델 ID 의 경우 FALLBACK_PRICING 을 사용하고 boolean 플래그로 신호.
 */
export function calculateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { costUsd: number; pricing: ClaudeModelPricing; isFallback: boolean } {
  const pricing = CLAUDE_PRICING[model];
  const isFallback = pricing === undefined;
  const effective = pricing ?? FALLBACK_PRICING;

  const inputCost = (inputTokens / 1_000_000) * effective.inputUsdPerMillion;
  const outputCost = (outputTokens / 1_000_000) * effective.outputUsdPerMillion;
  const total = inputCost + outputCost;

  return {
    costUsd: Math.round(total * 1_000_000) / 1_000_000,
    pricing: effective,
    isFallback,
  };
}
