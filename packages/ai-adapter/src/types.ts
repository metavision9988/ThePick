export interface AIMessageRequest {
  readonly model: string;
  readonly maxTokens: number;
  readonly system?: string;
  readonly messages: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }>;
  readonly temperature?: number;
  readonly stream?: boolean;
}

export interface AIMessageResponse {
  readonly content: string;
  readonly stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly modelUsed: string;
}

export interface AIVisionRequest extends AIMessageRequest {
  readonly imageBase64: string;
  readonly imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export type AIVendor = 'anthropic';

export type AIAdapterErrorCode =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'INVALID'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL';

export class AIAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: AIAdapterErrorCode,
    public readonly httpStatus?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AIAdapterError';
  }
}

export interface AIAdapter {
  readonly vendor: AIVendor;
  readonly modelDefault: string;
  sendMessage(req: AIMessageRequest): Promise<AIMessageResponse>;
  sendVision(req: AIVisionRequest): Promise<AIMessageResponse>;
}
