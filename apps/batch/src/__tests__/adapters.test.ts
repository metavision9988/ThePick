/**
 * 어댑터 테스트 — anthropic-client, vision-client, token-cost-logger.
 * 네트워크 호출은 sdkOverride 또는 sink 주입으로 차단.
 */

import { describe, it, expect, vi } from 'vitest';
import { createAnthropicClient } from '../adapters/anthropic-client';
import { createVisionClient, NotImplementedError } from '../adapters/vision-client';
import { createTokenCostLogger } from '../adapters/token-cost-logger';

describe('anthropic-client', () => {
  it('빈 API 키 거부', () => {
    expect(() => createAnthropicClient({ apiKey: '' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => createAnthropicClient({ apiKey: '   ' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('SDK mock 성공 응답 → ClaudeResponse 변환 + onUsage 호출', async () => {
    const onUsage = vi.fn();
    const mockSdk = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"nodes":[]}' }],
          usage: { input_tokens: 100, output_tokens: 50 },
          model: 'claude-haiku-4-5-20251001',
          stop_reason: 'end_turn',
        }),
      },
    };
    const client = createAnthropicClient({
      apiKey: 'test-key',
      onUsage,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sdkOverride: mockSdk as any,
    });

    const result = await client.createMessage({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: 'test',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result.content).toBe('{"nodes":[]}');
    expect(result.usage.input_tokens).toBe(100);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTokens: 100,
        outputTokens: 50,
        stage: 'batch_structurize',
        error: null,
      }),
    );
  });
});

describe('vision-client', () => {
  it('빈 API 키 거부', () => {
    expect(() => createVisionClient({ apiKey: '' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('기본 enableRealCalls=false → NotImplementedError throw (가-0 스켈레톤 가드)', async () => {
    const client = createVisionClient({ apiKey: 'test-key' });
    await expect(
      client.processVisionPage({
        pageImageBase64: 'iVBOR...',
        pageNumber: 403,
        batchId: 'BATCH-1',
      }),
    ).rejects.toBeInstanceOf(NotImplementedError);
  });
});

describe('token-cost-logger', () => {
  it('sink 주입 시 파일 쓰기 없이 레코드 관찰 + 비용 계산', () => {
    const captured: string[] = [];
    const logger = createTokenCostLogger({
      sink: (line) => captured.push(line),
      clock: () => new Date('2026-04-23T10:00:00Z'),
    });

    const record = logger.record({
      batchId: 'BATCH-1',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 1000,
      outputTokens: 500,
      retries: 0,
      stopReason: 'end_turn',
      stage: 'batch_structurize',
      error: null,
    });

    expect(record.costUsd).toBeCloseTo(0.001 + 0.0025, 6); // $1/M × 1000 + $5/M × 500
    expect(record.pricingFallback).toBe(false);
    expect(record.modelDisplay).toBe('Claude Haiku 4.5');
    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]);
    expect(parsed.ts).toBe('2026-04-23T10:00:00.000Z');
    expect(parsed.batchId).toBe('BATCH-1');
  });

  it('알 수 없는 모델 → fallback pricing + isFallback 플래그', () => {
    const captured: string[] = [];
    const logger = createTokenCostLogger({ sink: (l) => captured.push(l) });

    const record = logger.record({
      batchId: 'BATCH-X',
      model: 'unknown-future-model',
      inputTokens: 100,
      outputTokens: 100,
      retries: 0,
      stopReason: null,
      stage: 'test',
    });

    expect(record.pricingFallback).toBe(true);
    expect(record.modelDisplay).toContain('UNKNOWN');
  });

  it('실패 레코드 — error 필드 채워짐', () => {
    const captured: string[] = [];
    const logger = createTokenCostLogger({ sink: (l) => captured.push(l) });
    const record = logger.record({
      batchId: 'BATCH-1',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 0,
      outputTokens: 0,
      retries: 3,
      stopReason: null,
      stage: 'batch_structurize',
      error: 'API 429 rate limit',
    });
    expect(record.error).toBe('API 429 rate limit');
    expect(record.costUsd).toBe(0);
  });
});
