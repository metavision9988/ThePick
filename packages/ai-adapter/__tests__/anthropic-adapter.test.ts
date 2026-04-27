import { describe, it, expect } from 'vitest';
import { AnthropicAdapter, AIAdapterError } from '../src/index.js';

const validConfig = {
  apiKey: 'sk-ant-test-key-not-real',
  modelDefault: 'claude-haiku-4-5-20251001',
};

describe('AnthropicAdapter — constructor 검증', () => {
  it('정상 config 로 인스턴스 생성', () => {
    const adapter = new AnthropicAdapter(validConfig);
    expect(adapter.vendor).toBe('anthropic');
    expect(adapter.modelDefault).toBe('claude-haiku-4-5-20251001');
  });

  it('apiKey 빈 문자열 → AIAdapterError(AUTH)', () => {
    expect(() => new AnthropicAdapter({ ...validConfig, apiKey: '' })).toThrowError(AIAdapterError);
    try {
      new AnthropicAdapter({ ...validConfig, apiKey: '' });
    } catch (e) {
      expect(e).toBeInstanceOf(AIAdapterError);
      expect((e as AIAdapterError).code).toBe('AUTH');
    }
  });

  it('apiKey 공백만 → AIAdapterError(AUTH)', () => {
    try {
      new AnthropicAdapter({ ...validConfig, apiKey: '   ' });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AIAdapterError);
      expect((e as AIAdapterError).code).toBe('AUTH');
    }
  });

  it('modelDefault 빈 문자열 → AIAdapterError(INVALID)', () => {
    try {
      new AnthropicAdapter({ ...validConfig, modelDefault: '' });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AIAdapterError);
      expect((e as AIAdapterError).code).toBe('INVALID');
    }
  });

  it('default baseUrl / timeoutMs / maxRetries 적용', () => {
    const adapter = new AnthropicAdapter(validConfig);
    const desc = adapter.describe();
    expect(desc.baseUrl).toBe('https://api.anthropic.com/v1');
    expect(desc.timeoutMs).toBe(30_000);
    expect(desc.maxRetries).toBe(3);
  });

  it('override baseUrl / timeoutMs / maxRetries 반영', () => {
    const adapter = new AnthropicAdapter({
      ...validConfig,
      baseUrl: 'https://custom.example/v1',
      timeoutMs: 5000,
      maxRetries: 1,
    });
    const desc = adapter.describe();
    expect(desc.baseUrl).toBe('https://custom.example/v1');
    expect(desc.timeoutMs).toBe(5000);
    expect(desc.maxRetries).toBe(1);
  });
});

describe('AnthropicAdapter — describe()', () => {
  it('반환 객체는 frozen (readonly 보장)', () => {
    const adapter = new AnthropicAdapter(validConfig);
    const desc = adapter.describe();
    expect(Object.isFrozen(desc)).toBe(true);
  });

  it('vendor / model 정상 노출', () => {
    const adapter = new AnthropicAdapter(validConfig);
    const desc = adapter.describe();
    expect(desc.vendor).toBe('anthropic');
    expect(desc.model).toBe('claude-haiku-4-5-20251001');
  });

  it('apiKey 는 describe() 에 노출되지 않음 (보안)', () => {
    const adapter = new AnthropicAdapter(validConfig);
    const desc = adapter.describe();
    expect(JSON.stringify(desc)).not.toContain('sk-ant-test-key-not-real');
  });
});

describe('AnthropicAdapter — sendMessage / sendVision (Phase 3 placeholder)', () => {
  it('sendMessage → AIAdapterError(NOT_IMPLEMENTED)', async () => {
    const adapter = new AnthropicAdapter(validConfig);
    await expect(
      adapter.sendMessage({
        model: validConfig.modelDefault,
        maxTokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrowError(AIAdapterError);
  });

  it('sendMessage 에러 코드 = NOT_IMPLEMENTED', async () => {
    const adapter = new AnthropicAdapter(validConfig);
    try {
      await adapter.sendMessage({
        model: validConfig.modelDefault,
        maxTokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });
      throw new Error('expected reject');
    } catch (e) {
      expect(e).toBeInstanceOf(AIAdapterError);
      expect((e as AIAdapterError).code).toBe('NOT_IMPLEMENTED');
    }
  });

  it('sendVision → AIAdapterError(NOT_IMPLEMENTED)', async () => {
    const adapter = new AnthropicAdapter(validConfig);
    await expect(
      adapter.sendVision({
        model: validConfig.modelDefault,
        maxTokens: 100,
        messages: [{ role: 'user', content: 'image describe' }],
        imageBase64: 'iVBORw0KGgo=',
        imageMediaType: 'image/png',
      }),
    ).rejects.toThrowError(AIAdapterError);
  });

  it('sendVision 에러 메시지에 model 노출 (디버깅 정보)', async () => {
    const adapter = new AnthropicAdapter(validConfig);
    try {
      await adapter.sendVision({
        model: validConfig.modelDefault,
        maxTokens: 100,
        messages: [{ role: 'user', content: 'x' }],
        imageBase64: 'x',
        imageMediaType: 'image/jpeg',
      });
      throw new Error('expected reject');
    } catch (e) {
      expect(e).toBeInstanceOf(AIAdapterError);
      expect((e as Error).message).toContain('claude-haiku-4-5-20251001');
    }
  });
});
