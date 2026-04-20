import { describe, it, expect, vi } from 'vitest';
import {
  processBatch,
  buildSystemPrompt,
  buildUserPrompt,
  parseContractJson,
  DEFAULT_CONFIG,
  type ClaudeClient,
  type ClaudeResponse,
  type BatchInput,
} from '../batch-processor';
import type { Section } from '../section-splitter';
import type { ExtractedTable } from '../table-extractor';

// --- Helpers ---

function mockSection(overrides: Partial<Section> = {}): Section {
  return {
    level: 'section',
    heading: '제2절 과수작물 손해평가 및 보험금 산정',
    body: '적과전 종합위험 보장에서는 자연재해, 조수해, 화재로 인한 피해를 보장한다.',
    startPage: 403,
    endPage: 410,
    children: [],
    ...overrides,
  };
}

function mockTable(): ExtractedTable {
  return {
    page: 405,
    tableIndex: 0,
    headers: ['항목', '비율', '비고'],
    rows: [['자기부담비율', '20%', '기본']],
    shape: { rows: 2, cols: 3 },
  };
}

function mockBatchInput(overrides: Partial<BatchInput> = {}): BatchInput {
  return {
    sections: [mockSection()],
    tables: [mockTable()],
    batchId: 'BATCH-001',
    pageRange: { start: 403, end: 434 },
    ...overrides,
  };
}

const VALID_CONTRACT_JSON = JSON.stringify({
  nodes: [
    {
      id: 'CONCEPT-001',
      type: 'CONCEPT',
      title: '적과전 종합위험 보장 개요',
      content: '자연재해, 조수해, 화재로 인한 과수 피해를 보장하는 상품',
      lv1_insurance: '농작물재해보험',
      lv2_crop: '사과',
      truth_weight: 5,
      source_page: 403,
    },
    {
      id: 'F-01',
      type: 'FORMULA',
      title: '보험가입금액 산정',
      content: '보험가입금액 = 표준수확량 × 기준가격',
      truth_weight: 8,
      source_page: 410,
    },
  ],
  edges: [
    {
      source_id: 'CONCEPT-001',
      target_id: 'F-01',
      edge_type: 'USES_FORMULA',
    },
  ],
  formulas: [
    {
      id: 'F-01',
      name: '보험가입금액',
      equation_template: 'standard_yield * base_price',
      variables_schema: '{"standard_yield": "number", "base_price": "number"}',
    },
  ],
  constants: [
    {
      id: 'CONST-001',
      name: '자기부담비율(20%)',
      value: '0.20',
      category: 'deductible',
    },
  ],
});

function mockClient(responseContent: string = VALID_CONTRACT_JSON): ClaudeClient {
  return {
    createMessage: vi.fn().mockResolvedValue({
      content: responseContent,
      usage: { input_tokens: 1500, output_tokens: 800 },
      model: 'claude-haiku-4-5-20251001',
      stop_reason: 'end_turn',
    } satisfies ClaudeResponse),
  };
}

function failingClient(failCount: number): ClaudeClient {
  let calls = 0;
  return {
    createMessage: vi.fn().mockImplementation(() => {
      calls++;
      if (calls <= failCount) {
        return Promise.reject(new Error(`API error (attempt ${calls})`));
      }
      return Promise.resolve({
        content: VALID_CONTRACT_JSON,
        usage: { input_tokens: 1500, output_tokens: 800 },
        model: 'claude-haiku-4-5-20251001',
        stop_reason: 'end_turn',
      } satisfies ClaudeResponse);
    }),
  };
}

// --- Tests ---

describe('buildSystemPrompt', () => {
  it('includes batch ID and page range', () => {
    const prompt = buildSystemPrompt('BATCH-001', { start: 403, end: 434 });
    expect(prompt).toContain('BATCH-001');
    expect(prompt).toContain('p.403~434');
  });

  it('includes all 7 node ID patterns', () => {
    const prompt = buildSystemPrompt('B', { start: 1, end: 2 });
    expect(prompt).toContain('LAW-NNN');
    expect(prompt).toContain('F-NN');
    expect(prompt).toContain('INV-NNN');
    expect(prompt).toContain('INS-NN');
    expect(prompt).toContain('CROP-NNN');
    expect(prompt).toContain('CONCEPT-NNN');
    expect(prompt).toContain('TERM-NNN');
  });

  it('includes all 13 edge types', () => {
    const prompt = buildSystemPrompt('B', { start: 1, end: 2 });
    expect(prompt).toContain('APPLIES_TO');
    expect(prompt).toContain('SUPERSEDES');
    expect(prompt).toContain('CROSS_REF');
  });

  it('includes truth_weight rules', () => {
    const prompt = buildSystemPrompt('B', { start: 1, end: 2 });
    expect(prompt).toContain('LAW: 10');
    expect(prompt).toContain('TERM: 3');
  });
});

describe('buildUserPrompt', () => {
  it('includes section headings and body', () => {
    const prompt = buildUserPrompt(mockBatchInput());
    expect(prompt).toContain('제2절 과수작물 손해평가');
    expect(prompt).toContain('적과전 종합위험');
  });

  it('includes table data', () => {
    const prompt = buildUserPrompt(mockBatchInput());
    expect(prompt).toContain('자기부담비율');
    expect(prompt).toContain('P405 T0');
  });

  it('works with no tables', () => {
    const prompt = buildUserPrompt(mockBatchInput({ tables: [] }));
    expect(prompt).not.toContain('## 표 데이터');
  });

  it('includes child sections', () => {
    const section = mockSection({
      children: [
        {
          level: 'subsection',
          heading: '1. 보험가입금액',
          body: '하위 내용',
          startPage: 404,
          endPage: 405,
          children: [],
        },
      ],
    });
    const prompt = buildUserPrompt(mockBatchInput({ sections: [section] }));
    expect(prompt).toContain('1. 보험가입금액');
  });
});

describe('parseContractJson', () => {
  it('parses plain JSON', () => {
    const result = parseContractJson(VALID_CONTRACT_JSON);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.formulas).toHaveLength(1);
    expect(result.constants).toHaveLength(1);
  });

  it('extracts JSON from markdown code block', () => {
    const wrapped = '```json\n' + VALID_CONTRACT_JSON + '\n```';
    const result = parseContractJson(wrapped);
    expect(result.nodes).toHaveLength(2);
  });

  it('defaults missing arrays but throws if all empty', () => {
    // nodes만 있고 나머지 없음 → edges/formulas/constants는 빈 배열로 대체
    const result = parseContractJson(
      JSON.stringify({
        nodes: [
          {
            id: 'CONCEPT-001',
            type: 'CONCEPT',
            title: 't',
            content: 'c',
            truth_weight: 5,
            source_page: 1,
          },
        ],
      }),
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toEqual([]);
  });

  it('throws on completely empty contract (all arrays missing)', () => {
    expect(() => parseContractJson('{"nodes": []}')).toThrow(/Empty contract/);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseContractJson('not json')).toThrow();
  });

  it('handles quadruple backtick code blocks', () => {
    const wrapped = '````json\n' + VALID_CONTRACT_JSON + '\n````';
    const result = parseContractJson(wrapped);
    expect(result.nodes).toHaveLength(2);
  });
});

describe('processBatch', () => {
  it('returns valid result for well-formed API response', async () => {
    const client = mockClient();
    const result = await processBatch(client, mockBatchInput());

    expect(result.batchId).toBe('BATCH-001');
    expect(result.contract).not.toBeNull();
    expect(result.validation?.valid).toBe(true);
    expect(result.usage).toEqual({
      inputTokens: 1500,
      outputTokens: 800,
      model: 'claude-haiku-4-5-20251001',
    });
    expect(result.error).toBeNull();
    expect(result.retries).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('calls Claude API with correct parameters', async () => {
    const client = mockClient();
    await processBatch(client, mockBatchInput());

    expect(client.createMessage).toHaveBeenCalledTimes(1);
    const call = vi.mocked(client.createMessage).mock.calls[0][0];
    expect(call.model).toBe(DEFAULT_CONFIG.model);
    expect(call.max_tokens).toBe(DEFAULT_CONFIG.maxTokens);
    expect(call.system).toContain('BATCH-001');
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe('user');
  });

  it('detects Ontology validation failures', async () => {
    const invalidJson = JSON.stringify({
      nodes: [
        {
          id: 'INVALID-001',
          type: 'ANIMAL',
          title: 'bad',
          content: 'bad',
          truth_weight: 5,
          source_page: 403,
        },
      ],
      edges: [],
      formulas: [],
      constants: [],
    });
    const client = mockClient(invalidJson);
    const result = await processBatch(client, mockBatchInput());

    expect(result.contract).not.toBeNull();
    expect(result.validation?.valid).toBe(false);
    expect(result.error).toContain('Ontology validation failed');
  });

  it('retries on API failure and succeeds', async () => {
    const client = failingClient(2); // fail 2 times, succeed on 3rd
    const result = await processBatch(client, mockBatchInput(), {
      timeoutMs: 60_000, // generous timeout for test
      baseBackoffMs: 10, // collapse exponential backoff for determinism
    });

    expect(result.error).toBeNull();
    expect(result.retries).toBe(2);
    expect(result.validation?.valid).toBe(true);
  });

  it('reports error after all retries exhausted', async () => {
    const client = failingClient(10); // always fail
    const result = await processBatch(client, mockBatchInput(), {
      maxRetries: 1,
      timeoutMs: 60_000,
      baseBackoffMs: 10,
    });

    expect(result.error).toContain('API error');
    expect(result.contract).toBeNull();
    expect(result.validation).toBeNull();
  });

  it('reports error on malformed JSON response', async () => {
    const client = mockClient('This is not JSON at all');
    const result = await processBatch(client, mockBatchInput());

    expect(result.error).not.toBeNull();
    expect(result.contract).toBeNull();
  });

  it('reports error when response content is empty', async () => {
    const client: ClaudeClient = {
      createMessage: vi.fn().mockResolvedValue({
        content: '',
        usage: { input_tokens: 100, output_tokens: 0 },
        model: 'claude-haiku-4-5-20251001',
        stop_reason: 'end_turn',
      } satisfies ClaudeResponse),
    };
    const result = await processBatch(client, mockBatchInput());

    expect(result.error).toContain('empty content');
    expect(result.contract).toBeNull();
  });

  it('logs warning on stop_reason max_tokens but still attempts parse', async () => {
    const truncatedJson = JSON.stringify({
      nodes: [
        {
          id: 'CONCEPT-001',
          type: 'CONCEPT',
          title: 'test',
          content: 'test',
          truth_weight: 5,
          source_page: 403,
        },
      ],
      edges: [],
      formulas: [],
      constants: [],
    });
    const client: ClaudeClient = {
      createMessage: vi.fn().mockResolvedValue({
        content: truncatedJson,
        usage: { input_tokens: 1000, output_tokens: 4096 },
        model: 'claude-haiku-4-5-20251001',
        stop_reason: 'max_tokens',
      } satisfies ClaudeResponse),
    };
    const result = await processBatch(client, mockBatchInput());

    // 파싱 가능한 JSON이면 결과 반환 (경고 로그는 별도)
    expect(result.contract).not.toBeNull();
  });

  it('applies custom config overrides', async () => {
    const client = mockClient();
    await processBatch(client, mockBatchInput(), {
      model: 'claude-sonnet-4-6',
      maxTokens: 8192,
    });

    const call = vi.mocked(client.createMessage).mock.calls[0][0];
    expect(call.model).toBe('claude-sonnet-4-6');
    expect(call.max_tokens).toBe(8192);
  });
});
