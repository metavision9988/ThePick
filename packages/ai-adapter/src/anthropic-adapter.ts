import {
  AIAdapterError,
  type AIAdapter,
  type AIMessageRequest,
  type AIMessageResponse,
  type AIVisionRequest,
} from './types.js';

export interface AnthropicAdapterConfig {
  readonly apiKey: string;
  readonly modelDefault: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

interface ResolvedConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

export class AnthropicAdapter implements AIAdapter {
  readonly vendor = 'anthropic' as const;
  readonly modelDefault: string;

  private readonly config: ResolvedConfig;

  constructor(config: AnthropicAdapterConfig) {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new AIAdapterError('Anthropic API key is required', 'AUTH');
    }
    if (!config.modelDefault || config.modelDefault.trim() === '') {
      throw new AIAdapterError('modelDefault is required', 'INVALID');
    }
    this.modelDefault = config.modelDefault;
    this.config = Object.freeze({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://api.anthropic.com/v1',
      timeoutMs: config.timeoutMs ?? 30_000,
      maxRetries: config.maxRetries ?? 3,
    });
  }

  describe(): Readonly<{
    vendor: 'anthropic';
    model: string;
    baseUrl: string;
    timeoutMs: number;
    maxRetries: number;
  }> {
    return Object.freeze({
      vendor: this.vendor,
      model: this.modelDefault,
      baseUrl: this.config.baseUrl,
      timeoutMs: this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
    });
  }

  async sendMessage(_req: AIMessageRequest): Promise<AIMessageResponse> {
    void this.config.apiKey;
    throw new AIAdapterError(
      `AnthropicAdapter.sendMessage not yet implemented (model=${this.modelDefault}, baseUrl=${this.config.baseUrl}). Phase 3 운영 RAG 진입 시점 본격 구현 예정. Year 1 BATCH 적재는 Claude Code (Opus 4.7) 직접 처리이므로 본 어댑터 미경유.`,
      'NOT_IMPLEMENTED',
    );
  }

  async sendVision(_req: AIVisionRequest): Promise<AIMessageResponse> {
    void this.config.apiKey;
    throw new AIAdapterError(
      `AnthropicAdapter.sendVision not yet implemented (model=${this.modelDefault}). Phase 3 Vision OCR 시점 본격 구현.`,
      'NOT_IMPLEMENTED',
    );
  }
}
