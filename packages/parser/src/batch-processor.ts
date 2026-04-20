/**
 * M07 Claude API 배치 프로세서
 *
 * 파이프라인 Stage 3: 섹션 텍스트 → Claude API(Haiku) → Knowledge Contract JSON.
 * Ontology Lock 적용: validateKnowledgeContract()로 검증 후 실패 시 에러 보고.
 * 재프롬프트(검증 실패 시 Claude 재호출)는 호출자(apps/batch)에서 수동 트리거.
 *
 * API 클라이언트는 인터페이스로 주입 (parser 패키지는 SDK 의존 없음).
 * 실제 SDK 연결은 apps/batch에서 수행.
 */

import type { Section } from './section-splitter';
import type { ExtractedTable } from './table-extractor';
import {
  validateKnowledgeContract,
  type KnowledgeContract,
  type ValidationResult,
} from './schema-validator';

// --- API Client interface (DI) ---

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
  stop_reason: string | null;
}

export interface ClaudeClient {
  createMessage(params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: ClaudeMessage[];
  }): Promise<ClaudeResponse>;
}

// --- Batch processor types ---

export interface BatchInput {
  sections: Section[];
  tables: ExtractedTable[];
  batchId: string;
  pageRange: { start: number; end: number };
}

export interface BatchConfig {
  model: string;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
  /** Exponential backoff base. Production: 1000ms. Tests inject small value for determinism. */
  baseBackoffMs: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * 배치 처리 결과.
 *
 * 성공 판정: `error === null && validation?.valid === true`
 * - contract는 validation.valid === false일 때도 non-null일 수 있음 (디버깅용).
 *   반드시 error + validation.valid를 함께 확인할 것.
 * - validation 실패 시 contract 데이터를 DB에 적재하면 안 됨.
 */
export interface BatchResult {
  batchId: string;
  contract: KnowledgeContract | null;
  validation: ValidationResult | null;
  usage: TokenUsage | null;
  error: string | null;
  retries: number;
  durationMs: number;
}

// --- Default config ---

const DEFAULT_CONFIG: BatchConfig = {
  model: 'claude-haiku-4-5-20251001',
  maxTokens: 4096,
  timeoutMs: 30_000,
  maxRetries: 3,
  baseBackoffMs: 1000,
};

// --- System prompt ---

function buildSystemPrompt(batchId: string, pageRange: { start: number; end: number }): string {
  return `당신은 손해평가사 자격시험 교재를 분석하는 전문가입니다.
교재 텍스트를 읽고 Knowledge Graph 노드, 엣지, 산식, 상수를 구조화된 JSON으로 추출합니다.

## 배치 정보
- Batch ID: ${batchId}
- 페이지 범위: p.${pageRange.start}~${pageRange.end}

## 출력 규칙

### 노드 ID 규칙 (Ontology Lock — 반드시 준수)
- LAW: LAW-NNN (예: LAW-001)
- FORMULA: F-NN (예: F-01)
- INVESTIGATION: INV-NNN (예: INV-001)
- INSURANCE: INS-NN (예: INS-01)
- CROP: CROP-NNN (예: CROP-001)
- CONCEPT: CONCEPT-NNN (예: CONCEPT-001)
- TERM: TERM-NNN (예: TERM-001)

### 상수 ID 규칙
- CONST-NNN (예: CONST-001)

### truth_weight 배정
- LAW: 10, FORMULA: 8, INVESTIGATION: 7, INSURANCE: 6, CROP: 6, CONCEPT: 5, TERM: 3

### 엣지 타입 (13종만 허용)
APPLIES_TO, REQUIRES_INVESTIGATION, PREREQUISITE, USES_FORMULA, DEPENDS_ON,
GOVERNED_BY, DEFINED_AS, EXCEPTION, TIME_CONSTRAINT, SUPERSEDES,
SHARED_WITH, DIFFERS_FROM, CROSS_REF

### 상수 카테고리 (7종만 허용)
threshold, coefficient, date, ratio, sample, deductible, insurance_rate

## JSON 출력 스키마
\`\`\`json
{
  "nodes": [
    {
      "id": "CONCEPT-001",
      "type": "CONCEPT",
      "title": "노드 제목",
      "content": "상세 설명",
      "lv1_insurance": "보험 유형 (예: 농작물재해보험)",
      "lv2_crop": "작물명 (예: 사과)",
      "lv3_investigation": "조사 유형 (해당 시)",
      "truth_weight": 5,
      "source_page": 403
    }
  ],
  "edges": [
    {
      "source_id": "CONCEPT-001",
      "target_id": "F-01",
      "edge_type": "USES_FORMULA",
      "condition": "조건 (해당 시)"
    }
  ],
  "formulas": [
    {
      "id": "F-01",
      "name": "산식명",
      "equation_template": "math.js 파서 호환 수식",
      "variables_schema": "{\\"var1\\": \\"number\\", \\"var2\\": \\"number\\"}"
    }
  ],
  "constants": [
    {
      "id": "CONST-001",
      "name": "상수명",
      "value": "원문 그대로",
      "category": "coefficient"
    }
  ]
}
\`\`\`

## 중요
- 반드시 위 JSON 스키마만 출력하세요. 설명 텍스트 없이 JSON만 반환.
- ID 규칙을 벗어나면 검증 실패로 거부됩니다.
- 수치는 교재 원문 그대로 추출하세요. 절대 계산하거나 변환하지 마세요.
- source_page는 해당 내용이 있는 실제 페이지 번호입니다.`;
}

// --- User prompt ---

const SECTION_BODY_LIMIT = 3000;
const CHILD_BODY_LIMIT = 500;

function buildUserPrompt(input: BatchInput): string {
  const sectionTexts = input.sections
    .map((s) => {
      const header = `[${s.level}] ${s.heading} (p.${s.startPage}-${s.endPage})`;

      let body = s.body;
      if (body.length > SECTION_BODY_LIMIT) {
        console.warn(
          `[batch-processor] Section "${s.heading}" body truncated: ${body.length} → ${SECTION_BODY_LIMIT} chars`,
        );
        body = body.slice(0, SECTION_BODY_LIMIT);
      }

      const children = s.children
        .map((c) => {
          const childBody =
            c.body.length > CHILD_BODY_LIMIT ? c.body.slice(0, CHILD_BODY_LIMIT) : c.body;
          return `  [${c.level}] ${c.heading}: ${childBody}`;
        })
        .join('\n');
      return `${header}\n${body}${children ? '\n' + children : ''}`;
    })
    .join('\n\n---\n\n');

  const tableTexts =
    input.tables.length > 0
      ? '\n\n## 표 데이터\n' +
        input.tables
          .map((t) => {
            const headerRow = t.headers.join(' | ');
            const dataRows = t.rows.map((r) => r.join(' | ')).join('\n');
            return `[P${t.page} T${t.tableIndex}]\n${headerRow}\n${dataRows}`;
          })
          .join('\n\n')
      : '';

  return `다음 교재 텍스트에서 Knowledge Graph 요소를 추출하세요.

## 섹션 텍스트
${sectionTexts}${tableTexts}`;
}

// --- Retry with exponential backoff ---

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  timeoutMs: number,
  baseBackoffMs: number,
): Promise<{ result: T; retries: number }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(fn(), timeoutMs);
      return { result, retries: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delayMs = Math.min(baseBackoffMs * Math.pow(2, attempt), 16_000);
        await sleep(delayMs);
      }
    }
  }

  throw lastError ?? new Error('All retries exhausted');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- JSON parsing ---

function parseContractJson(raw: string): KnowledgeContract {
  // Claude가 ```json ... ``` 블록으로 감쌀 수 있으므로 추출
  const jsonMatch = raw.match(/`{3,}json\s*([\s\S]*?)\s*`{3,}/);
  const jsonStr = jsonMatch ? jsonMatch[1] : raw.trim();

  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  // 누락 필드 경고 (데이터 무음 삭제 방지)
  const expectedKeys = ['nodes', 'edges', 'formulas', 'constants'] as const;
  const missingKeys = expectedKeys.filter((k) => !Array.isArray(parsed[k]));
  if (missingKeys.length > 0) {
    console.warn(
      `[batch-processor] parseContractJson: missing or non-array fields: ${missingKeys.join(', ')}. ` +
        `Response prefix: ${raw.slice(0, 200)}`,
    );
  }

  const contract: KnowledgeContract = {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    formulas: Array.isArray(parsed.formulas) ? parsed.formulas : [],
    constants: Array.isArray(parsed.constants) ? parsed.constants : [],
  };

  // 전부 빈 경우 → Claude가 JSON 대신 설명 텍스트를 반환했을 가능성
  if (
    contract.nodes.length === 0 &&
    contract.edges.length === 0 &&
    contract.formulas.length === 0 &&
    contract.constants.length === 0
  ) {
    throw new Error(
      `Empty contract: 0 nodes, 0 edges, 0 formulas, 0 constants. ` +
        `Response prefix: ${raw.slice(0, 200)}`,
    );
  }

  return contract;
}

// --- Main entry point ---

export async function processBatch(
  client: ClaudeClient,
  input: BatchInput,
  config: Partial<BatchConfig> = {},
): Promise<BatchResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  let usage: TokenUsage | null = null;
  let contract: KnowledgeContract | null = null;
  let validation: ValidationResult | null = null;
  let error: string | null = null;
  let retries = 0;

  try {
    // 1. Call Claude API with retry
    const { result: response, retries: retryCount } = await withRetry(
      () =>
        client.createMessage({
          model: cfg.model,
          max_tokens: cfg.maxTokens,
          system: buildSystemPrompt(input.batchId, input.pageRange),
          messages: [{ role: 'user', content: buildUserPrompt(input) }],
        }),
      cfg.maxRetries,
      cfg.timeoutMs,
      cfg.baseBackoffMs,
    );
    retries = retryCount;

    // 2. Log token usage (방어적 접근)
    usage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      model: response.model ?? 'unknown',
    };

    console.warn(
      `[batch-processor] ${input.batchId} | ${usage.model} | ` +
        `in=${usage.inputTokens} out=${usage.outputTokens} | retries=${retries}`,
    );

    // 3. Check response content + stop_reason
    if (!response.content) {
      throw new Error(`Claude returned empty content (stop_reason: ${response.stop_reason})`);
    }

    if (response.stop_reason === 'max_tokens') {
      console.warn(
        `[batch-processor] ${input.batchId} | Response truncated (stop_reason: max_tokens). ` +
          `Consider increasing maxTokens from ${cfg.maxTokens}.`,
      );
    }

    // 4. Parse response JSON
    contract = parseContractJson(response.content);

    // 5. Validate with Ontology Lock
    validation = validateKnowledgeContract(contract);

    if (!validation.valid) {
      const errorCount = validation.errors.length;
      const sample = validation.errors
        .slice(0, 3)
        .map((e) => `${e.path}: ${e.code}`)
        .join('; ');
      error = `Ontology validation failed: ${errorCount} error(s). Sample: ${sample}`;

      console.error(
        `[batch-processor] ${input.batchId} | VALIDATION FAILED | ${errorCount} errors`,
      );
    }
  } catch (err) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    error = errorObj.message;
    console.error(`[batch-processor] ${input.batchId} | ERROR | ${error}`, errorObj.stack);
  }

  return {
    batchId: input.batchId,
    contract,
    validation,
    usage,
    error,
    retries,
    durationMs: Date.now() - startTime,
  };
}

// --- Exported for testing ---
export { buildSystemPrompt, buildUserPrompt, parseContractJson, DEFAULT_CONFIG };
