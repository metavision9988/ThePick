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
  validateRawResponseSecurity,
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

// Session 052 5-Persona PE-Devil 흡수: 별표9 패턴-H Nested 시 outer + nested 5개가
// 단일 응답에 채워지면 ~30K tokens 필요. maxTokens=4096은 Phase 1 (7-node 도메인) 한정.
// Phase 2A 별표9 (LAW-143) 진입 시 truncation 위험 → 16384 상향. claude-haiku-4-5-20251001
// 출력 한도(8192) 초과를 안전하게 흡수 + Anthropic 자동 chunking 정합.
const DEFAULT_CONFIG: BatchConfig = {
  model: 'claude-haiku-4-5-20251001',
  maxTokens: 16384,
  timeoutMs: 30_000,
  maxRetries: 3,
  baseBackoffMs: 1000,
};

// --- System prompt ---

function buildSystemPrompt(batchId: string, pageRange: { start: number; end: number }): string {
  return `당신은 손해평가사 자격시험 교재를 분석하는 전문가입니다.
교재 텍스트를 읽고 Knowledge Graph 노드, 엣지, 산식, 상수, 표를 구조화된 JSON으로 추출합니다.

## 배치 정보
- Batch ID: ${batchId}
- 페이지 범위: p.${pageRange.start}~${pageRange.end}

## 출력 규칙

### 노드 ID 규칙 (Ontology Lock — 반드시 준수, ontology-registry.json v1.5.0 정합)

도메인 노드 (knowledge_nodes 적재):
- LAW: LAW-NNN (예: LAW-001)
- FORMULA: F-NN 또는 F-NNN (예: F-01, F-100, F-130) — pattern '^F-\\d{2,3}$'
- INVESTIGATION: INV-NNN (예: INV-001)
- INSURANCE: INS-NN (예: INS-01)
- CROP: CROP-NNN (예: CROP-001)
- CONCEPT: CONCEPT-NNN (예: CONCEPT-001)
- TERM: TERM-NNN (예: TERM-001)

표 노드 (별도 tables[] 배열에 적재 — knowledge_nodes 미사용):
- TABLE: TBL-NNN (예: TBL-001) — 표 메타
- ROW_HEADER: TROW-NNN-NN (예: TROW-001-01)
- COL_HEADER: TCOL-NNN-NN (예: TCOL-001-01) — TCOL 4글자 prefix (TC- topic_cluster 충돌 회피)
- CELL: TCELL-NNN-NN-NN (예: TCELL-001-01-01)

### 상수 ID 규칙
- CONST-NNN (예: CONST-001)

### truth_weight 배정
- LAW: 10, FORMULA: 8, INVESTIGATION: 7, INSURANCE: 6, CROP: 6, CONCEPT: 5, TERM: 3
- (표 노드 truth_weight 는 본 schema 미적용 — tables[] 별도 배열)

### 엣지 타입 (18종만 허용)
도메인 엣지 (13종):
APPLIES_TO, REQUIRES_INVESTIGATION, PREREQUISITE, USES_FORMULA, DEPENDS_ON,
GOVERNED_BY, DEFINED_AS, EXCEPTION, TIME_CONSTRAINT, SUPERSEDES,
SHARED_WITH, DIFFERS_FROM, CROSS_REF

표 엣지 (5종, ADR-032 v1.5.0):
HAS_ROW, HAS_COLUMN, BELONGS_TO_ROW, BELONGS_TO_COLUMN, CONTAINS_TABLE

### 상수 카테고리 (7종만 허용)
threshold, coefficient, date, ratio, sample, deductible, insurance_rate

### ADR-030 페이지 메타 (모든 도메인 노드 필수)
- source_page: 양의 정수 (legacy fallback)
- book_page: 사용자(수험자) 노출용 본문 페이지 (교재 footer)
- pdf_page: PDF 추적용 페이지 (검수 단계)
- chapter (선택): 챕터 타이틀 (예: "제1장 농업재해보험 손해평가 개관")
- section (선택): 절 타이틀 (예: "제3절 현지조사 내용")

## 표 추출 (Table Extraction) — ADR-032 v1.5.0 의무

본문에서 표(table)를 발견하면 본문 텍스트로 흡수하지 말고 별도 \`tables[]\` 배열로 분해하라:

### 추출 대상 판별 규칙
- 표가 단순 정보 나열이면 본문 LAW/CONCEPT 노드로 흡수 (tables[] 미추가)
- 표가 셀 의미 결정체(헤더 × 데이터 교차)일 때만 tables[] 분해

### 표 메타 (tables[].pattern_type 8 패턴 필수 분류)
- A_simple: 1차원 그리드 (헤더 1행 + 데이터)
- B_2level: 2단 다중 헤더
- C_3level: 3단 다중 헤더 (적과전 보장재해 매트릭스 등)
- D_merged: 셀 병합 존재 (가축 월령 표 등)
- E_na: N/A 셀 다수 (가축 부문 × 특약 매트릭스)
- F_formula: 산식 셀 다수 (별표9 품목별 감수과실수)
- G_temporal: 시간축 헤더 (26년 변경표 — 25년/26년 / 구판/신판)
- H_nested: 셀 안에 표 중첩 (별표9 / 위험물 등급표 / 가액산정표 — 패턴-H 인식 정확도 ~70%, G5.5 인간 검수 강제)

### 헤더 분해 규칙
- axis: 'row' (행 헤더) → ID prefix TROW / 'column' (열 헤더) → ID prefix TCOL
- level: 다중 헤더 시 1=top, 2=sub, 3=sub-sub (1~3 허용)
- index_pos: 1-indexed (1..row_count 또는 1..col_count, gap 0)
- parent_id: 다중 헤더(B/C 패턴) 트리 표현 (level 1 부모 → level 2 자식)

### 셀 분해 규칙 (value_type 6종)
- text: 텍스트 셀 (기본)
- number: 숫자 셀 (원문 그대로, 변환 금지)
- formula: 산식 셀 → formula_id 필수 (같은 contract.formulas[] 내 선언 의무)
- na: N/A / 해당없음 셀
- merged_ref: 셀 병합 참조 → merged_with_id 필수 (anchor cell ID 참조)
- nested_table: 셀 안에 표 중첩 (패턴-H) → nested_table_id 필수 (같은 contract.tables[] 내 다른 TBL-NNN 참조)

### 패턴 ↔ value_type cross-validation (검증 강제)
- pattern_type='F_formula' → cells 에 value_type='formula' 셀 ≥ 1
- pattern_type='D_merged' → cells 에 value_type='merged_ref' 셀 ≥ 1
- pattern_type='E_na' → cells 에 value_type='na' 셀 ≥ 1
- pattern_type='A_simple' → cells 모두 text/number/na (formula/merged_ref/nested_table 0건)

### 안전 규칙
- merged_with_id 는 anchor cell 기준 (anchor cell value_type='text/number', 병합된 셀은 'merged_ref' + merged_with_id=anchor_id)
- 시간축 헤더 발견 시 (예: "25년" / "26년" / "구판" / "신판") pattern_type='G_temporal' 강제 + 본문 SUPERSEDES 엣지 후속 의무
- 패턴-H 발견 시 (셀 내부 표): 외부 표를 먼저 TBL-N으로 분해, 내부 표를 TBL-N+1로 별도 분해, 외부의 nested 셀을 value_type='nested_table' + nested_table_id='TBL-N+1' 로 연결
- 셀 병합 + 시간축 + 산식 동시 출현 시: 가장 dominant 패턴 1개 선택 (실무 기준: F_formula > G_temporal > D_merged > 기본)

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
      "source_page": 403,
      "book_page": 396,
      "pdf_page": 403,
      "chapter": "제1장 농업재해보험 손해평가 개관",
      "section": "제3절 현지조사 내용"
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
      "variables_schema": "{\\"var1\\": \\"number\\", \\"var2\\": \\"number\\"}",
      "source_page": 403
    }
  ],
  "constants": [
    {
      "id": "CONST-001",
      "name": "상수명",
      "value": "원문 그대로",
      "category": "coefficient",
      "source_page": 403
    }
  ],
  "tables": [
    {
      "id": "TBL-001",
      "source_node_id": "LAW-138",
      "title": "별표 1 표본주수표",
      "pattern_type": "A_simple",
      "row_count": 7,
      "col_count": 4,
      "source": "별표 1 (p.403)",
      "headers": [
        { "id": "TROW-001-01", "axis": "row",    "level": 1, "index_pos": 1, "text": "100주 미만" },
        { "id": "TCOL-001-01", "axis": "column", "level": 1, "index_pos": 1, "text": "조사주수" }
      ],
      "cells": [
        {
          "id": "TCELL-001-01-01",
          "row_id": "TROW-001-01",
          "col_id": "TCOL-001-01",
          "value_text": "5주",
          "value_type": "text"
        }
      ]
    }
  ]
}
\`\`\`

## 중요
- 반드시 위 JSON 스키마만 출력하세요. 설명 텍스트 없이 JSON만 반환.
- ID 규칙을 벗어나면 검증 실패로 거부됩니다.
- 수치는 교재 원문 그대로 추출하세요. 절대 계산하거나 변환하지 마세요.
- source_page / book_page / pdf_page 는 모든 도메인 노드/산식/상수에 필수입니다 (양의 정수). 추적성 위반 시 거부.
- 페이지가 범위인 경우 시작 페이지 정수를 사용하세요 (예: p.403~404 → 403).
- 표를 발견했지만 단순 정보 나열이면 본문 LAW/CONCEPT 노드로 흡수 (tables[] 미추가).
- 표가 헤더 × 데이터 교차 의미를 갖는다면 tables[] 분해 의무 — 본문에 단순 텍스트 변환 금지.
- 패턴-H (Nested Table) 인식 정확도 ~70%로 가장 어려운 영역 → 셀 안에 줄바꿈/들여쓰기로 표 구조가 보이면 즉시 nested_table 후보 표시.`;
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

  // FUZ-02 raw 단계 보안 검사 — D1 1MB / XSS / Hard Rule 17 / depth 차단.
  // 4-Pass §5.3 C-3 흡수 (validateRawResponseSecurity production wiring).
  // KnowledgeContractValidationError 가 throw 시 processBatch 의 catch 가 generic
  // Error 처리하므로 분류 정보는 err.message ("[XSS_PAYLOAD_DETECTED] ...") 로 보존.
  validateRawResponseSecurity(jsonStr);

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
