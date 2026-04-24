/**
 * Vision OCR 어댑터 — Claude Sonnet Vision 기반 표/도형 페이지 재추출.
 *
 * 스코프: **스켈레톤만** (Step 1-5 가-0). 실제 PDF → 이미지 변환 경로 및 실 호출은
 * Step 1-5 가-1 에서 활성. 파이프라인 Stage 2.5 삽입 지점만 확보.
 *
 * 설계:
 *   - VisionClient 인터페이스: 단일 page_image(base64 PNG) + page_number
 *     → partial KnowledgeContract (nodes/formulas/constants) 반환.
 *     batch-processor 의 Claude 결과와 병합되어 M08 schema-validator 로 전달.
 *   - 호출 플래그 기본 `skipVisionOcr=true` — 실수로 production 경로 진입 방지.
 *   - `processVisionPage` 는 **NotImplementedError** throw — stub 누출 방어선.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  KnowledgeContractNode,
  KnowledgeContractFormula,
  KnowledgeContractConstant,
} from '@thepick/parser';
import type { UsageHook } from './anthropic-client';

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export interface VisionPageInput {
  /** 페이지 이미지 (PNG) base64 encoded. */
  readonly pageImageBase64: string;
  /** 교재 페이지 번호 — source_page 주입 기준. */
  readonly pageNumber: number;
  /** 배치 맥락 전달 (보조 정보). */
  readonly batchId: string;
  /** 이전 pdfplumber 추출 텍스트 — Claude 에 맥락 제공. 없으면 빈 문자열. */
  readonly fallbackText?: string;
}

/**
 * Vision 추출 결과 — partial KnowledgeContract. edges 는 본문 맥락 없이 추론 위험하므로 포함 안 함
 * (batch-processor 의 Claude Haiku 결과와 병합 시점에 엣지 생성).
 */
export interface VisionExtractionResult {
  readonly nodes: KnowledgeContractNode[];
  readonly formulas: KnowledgeContractFormula[];
  readonly constants: KnowledgeContractConstant[];
}

export interface VisionClient {
  /**
   * 단일 페이지 이미지를 Vision 모델로 분석.
   *
   * 스켈레톤 구현: 호출 즉시 NotImplementedError throw.
   * 실제 구현은 Step 1-5 (가-1) 에서 완성.
   */
  processVisionPage(input: VisionPageInput): Promise<VisionExtractionResult>;
}

export interface VisionClientOptions {
  readonly apiKey: string;
  /** Vision 모델 ID. 기본 claude-sonnet-4-6 (Vision 지원). */
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly onUsage?: (input: UsageHook) => void;
  readonly stage?: string;
  readonly sdkOverride?: Anthropic;
  /**
   * 스켈레톤 모드 비활성화 — true 면 실제 호출 시도 (가-1 단계에서만).
   * Step 1-5 가-0 에서는 반드시 false (기본값).
   */
  readonly enableRealCalls?: boolean;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Vision 어댑터 팩토리.
 *
 * 가-0 기본 동작: enableRealCalls=false → processVisionPage 가 NotImplementedError throw.
 * 이 방어선은 4-Pass Pass 1(Surgeon) 에서 stub 누출 방어로 의미가 있다.
 */
export function createVisionClient(options: VisionClientOptions): VisionClient {
  if (!options.apiKey || options.apiKey.trim().length === 0) {
    throw new Error('Vision client requires ANTHROPIC_API_KEY.');
  }

  const enableRealCalls = options.enableRealCalls ?? false;
  const model = options.model ?? DEFAULT_MODEL;
  const stage = options.stage ?? 'vision_ocr';

  // SDK 인스턴스는 실 호출 경로 활성 시에만 생성 (가-0 경로에서 불필요한 워밍업 방지)
  const sdk = enableRealCalls
    ? (options.sdkOverride ??
      new Anthropic({
        apiKey: options.apiKey,
        maxRetries: 0,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      }))
    : null;

  return {
    async processVisionPage(input) {
      if (!enableRealCalls || sdk === null) {
        throw new NotImplementedError(
          `Vision OCR not yet implemented (page ${input.pageNumber}, batch ${input.batchId}). ` +
            'Step 1-5 가-1 에서 활성 예정. enableRealCalls=true 플래그를 명시적으로 설정해야 함.',
        );
      }

      // 이하 실 호출 경로 — 가-1 에서 완성 예정. 현재는 접근 불가 (enableRealCalls 기본 false).
      // 스켈레톤: Claude Vision 호출 → JSON 파싱 → VisionExtractionResult 반환.
      // PDF → PNG 변환, source_page 주입, schema-validator 합성은 가-1 에서 구현.
      options.onUsage?.({
        model,
        inputTokens: 0,
        outputTokens: 0,
        stopReason: null,
        stage,
        error: 'vision_real_call_stub',
      });
      throw new NotImplementedError(
        `Vision OCR real-call path reached but not implemented (page ${input.pageNumber}). ` +
          'Do not enable in production until Step 1-5 가-1 completes.',
      );
    },
  };
}
