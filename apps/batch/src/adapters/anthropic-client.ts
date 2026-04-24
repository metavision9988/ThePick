/**
 * Anthropic SDK 어댑터 — `packages/parser` 의 ClaudeClient 인터페이스 실구현.
 *
 * 설계 원칙:
 *   - SDK 내장 retry 비활성화 (maxRetries: 0). batch-processor 의 withRetry 가 단일 진실 원천.
 *     → 이중 재시도로 인한 token 비용 폭증을 막는다.
 *   - 400/401/403 은 non-retryable 로 분류하여 AnthropicNonRetryableError 로 throw.
 *     (현재 batch-processor withRetry 는 모든 에러 retry — 개선 대상 TD로 이월,
 *      어댑터에서 비용 신호만 확실히 낸다: 이중 재시도 비용 × 재시도 횟수 → 즉시 감지 가능.)
 *   - API 키는 인자로만 수락. `process.env.ANTHROPIC_API_KEY` 조회는 createAnthropicClient 호출자 책임.
 *   - onUsage 훅 — 성공 시 token-cost-logger 에 기록하도록 위임.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeClient, ClaudeMessage, ClaudeResponse } from '@thepick/parser';

export interface AnthropicClientOptions {
  readonly apiKey: string;
  /** default timeout (ms) per request. withRetry 에서 별도 timeout 이 있으므로 여유 크게. */
  readonly timeoutMs?: number;
  /** 토큰 사용 로깅 훅 — 호출 성공 시 항상 발동. */
  readonly onUsage?: (input: UsageHook) => void;
  /** stage 라벨 — 로깅용. 기본 'batch_structurize'. */
  readonly stage?: string;
  /**
   * SDK 기본값 override. 테스트 주입용 — 프로덕션에서는 기본값 유지.
   * 외부 HTTP 를 스텁하고 싶을 때 사용.
   */
  readonly sdkOverride?: Anthropic;
}

export interface UsageHook {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly stopReason: string | null;
  readonly stage: string;
  readonly error: string | null;
}

export class AnthropicNonRetryableError extends Error {
  readonly statusCode: number;
  readonly errorType: string;
  constructor(message: string, statusCode: number, errorType: string) {
    super(message);
    this.name = 'AnthropicNonRetryableError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;
const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404, 422]);

/**
 * ClaudeClient 를 구현하는 Anthropic 어댑터.
 * 생성 시 SDK 인스턴스 1개 공유. `createMessage` 호출 마다 단일 요청 발신.
 */
export function createAnthropicClient(options: AnthropicClientOptions): ClaudeClient {
  if (!options.apiKey || options.apiKey.trim().length === 0) {
    throw new Error(
      'ANTHROPIC_API_KEY is required. Set the environment variable or pass apiKey explicitly.',
    );
  }

  const sdk =
    options.sdkOverride ??
    new Anthropic({
      apiKey: options.apiKey,
      // 이중 재시도 방지: batch-processor withRetry 가 전권.
      maxRetries: 0,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

  const stage = options.stage ?? 'batch_structurize';

  return {
    async createMessage(params): Promise<ClaudeResponse> {
      try {
        const response = await sdk.messages.create({
          model: params.model,
          max_tokens: params.max_tokens,
          system: params.system,
          messages: toSdkMessages(params.messages),
        });

        const textContent = extractTextContent(response.content);
        const result: ClaudeResponse = {
          content: textContent,
          usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
          },
          model: response.model,
          stop_reason: response.stop_reason,
        };

        options.onUsage?.({
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          stopReason: response.stop_reason,
          stage,
          error: null,
        });

        return result;
      } catch (err) {
        // SDK 가 APIError 계열을 throw — status 기반 분류
        const classified = classifyError(err);

        // 실패 시점에도 토큰 비용 가시성 유지 (usage 없으면 0)
        options.onUsage?.({
          model: params.model,
          inputTokens: 0,
          outputTokens: 0,
          stopReason: null,
          stage,
          error: classified.message,
        });

        if (classified.nonRetryable) {
          throw new AnthropicNonRetryableError(
            classified.message,
            classified.statusCode,
            classified.errorType,
          );
        }
        throw err instanceof Error ? err : new Error(classified.message);
      }
    },
  };
}

/** batch-processor 메시지 포맷 → SDK 포맷. role 은 그대로 통과. */
function toSdkMessages(
  messages: readonly ClaudeMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * SDK 응답의 content block 배열에서 text 만 뽑아 concat.
 * tool_use / image block 은 현재 배치 파이프라인에서 미사용이나 방어적으로 skip.
 */
function extractTextContent(blocks: ReadonlyArray<{ type: string; text?: string }>): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
    }
  }
  if (parts.length === 0) {
    console.warn('[anthropic-client] Response contained no text blocks.');
  }
  return parts.join('\n');
}

interface ClassifiedError {
  message: string;
  statusCode: number;
  errorType: string;
  nonRetryable: boolean;
}

function classifyError(err: unknown): ClassifiedError {
  if (err instanceof Anthropic.APIError) {
    const statusCode = err.status ?? 0;
    return {
      message: `Anthropic API error ${statusCode}: ${err.message}`,
      statusCode,
      errorType: err.name,
      nonRetryable: NON_RETRYABLE_STATUS.has(statusCode),
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    message: msg,
    statusCode: 0,
    errorType: 'UnknownError',
    nonRetryable: false,
  };
}
