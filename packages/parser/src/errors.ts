/**
 * Parser Error Classifications
 *
 * Sprint 1 §5.3 FUZ-01 / FUZ-02 신규 — graceful 분류 실패 (subprocess 보호 + 보안 거부).
 * 기존 AppError 는 일반 에러용으로 유지. PDF / Knowledge Contract 변조 응답은 본
 * 분류 체계로 throw 한다 (테스트 가능 + 운영 trail).
 */

/**
 * PDF 파싱 분류 (FUZ-01).
 *
 * - EMPTY_INPUT: 0 byte 입력 (subprocess 미호출)
 * - MALFORMED_HEADER: %PDF- signature 부재 또는 trailer (%%EOF) 누락
 * - COMPRESSION_BOMB: 선언된 /Length 가 파일 크기 대비 비정상적 비율 (>100x)
 * - MALFORMED_XREF: startxref offset 이 파일 크기 초과 또는 xref 엔트리 위치 불일치
 * - JS_EMBEDDED: /JavaScript 또는 /JS 액션 포함 (자동 실행 위험)
 * - PDF_PARSE_FAILED: subprocess 실행 후 분류 불가 / 일반 파싱 실패
 * - PDF_TIMEOUT: subprocess timeout (기본 5분)
 */
export type PdfErrorClassification =
  | 'EMPTY_INPUT'
  | 'MALFORMED_HEADER'
  | 'COMPRESSION_BOMB'
  | 'MALFORMED_XREF'
  | 'JS_EMBEDDED'
  | 'PDF_PARSE_FAILED'
  | 'PDF_TIMEOUT';

export interface PdfParseErrorMetadata {
  /** PDF 파일 경로 — 디버깅 추적용 */
  pdfPath?: string;
  /** 파일 크기 (bytes) */
  fileSize?: number;
  /** 선언된 /Length (compression bomb) */
  declaredLength?: number;
  /** xref 오프셋 (malformed xref) */
  xrefOffset?: number;
  /** subprocess stderr 일부 (PDF_PARSE_FAILED 분류 시 원인 추적) */
  stderr?: string;
  /** subprocess timeout (ms) */
  timeoutMs?: number;
  /** 추가 컨텍스트 */
  [key: string]: unknown;
}

export class PdfParseError extends Error {
  public readonly classification: PdfErrorClassification;
  public readonly metadata: PdfParseErrorMetadata;

  constructor(
    classification: PdfErrorClassification,
    message: string,
    metadata: PdfParseErrorMetadata = {},
  ) {
    super(`[${classification}] ${message}`);
    this.name = 'PdfParseError';
    this.classification = classification;
    this.metadata = metadata;
    // V8 stack trace cleanup
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, PdfParseError);
    }
  }
}

/**
 * Knowledge Contract (Claude API 응답) 분류 (FUZ-02).
 *
 * schema-validator.ts 의 ValidationErrorCode 와 별개로 raw 응답 단계 (parse 이전)
 * 거부에 사용. content / title 의 보안 위반 + payload 임계 초과 + Hard Rule 17 도 포함.
 */
export type KnowledgeContractErrorClassification =
  | 'EMPTY_RESPONSE'
  | 'PARSE_ERROR'
  | 'XSS_PAYLOAD_DETECTED'
  | 'MISSING_REQUIRED_FIELD'
  | 'ONTOLOGY_UNREGISTERED_ID'
  | 'JSON_DEPTH_EXCEEDED'
  | 'RESPONSE_SIZE_EXCEEDED'
  | 'HARD_RULE_17_VIOLATION';

export interface KnowledgeContractErrorMetadata {
  /** 응답 원본 일부 (앞 200자) — debug trail */
  rawSnippet?: string;
  /** 위반 필드 경로 */
  field?: string;
  /** 응답 크기 (bytes) */
  size?: number;
  /** 임계값 */
  maxAllowed?: number;
  /** JSON 깊이 */
  depth?: number;
  /** 위반 ID */
  id?: string;
  /** Parse error 위치 */
  lineNumber?: number;
  columnNumber?: number;
  /** 추가 컨텍스트 */
  [key: string]: unknown;
}

export class KnowledgeContractValidationError extends Error {
  public readonly classification: KnowledgeContractErrorClassification;
  public readonly metadata: KnowledgeContractErrorMetadata;

  constructor(
    classification: KnowledgeContractErrorClassification,
    message: string,
    metadata: KnowledgeContractErrorMetadata = {},
  ) {
    super(`[${classification}] ${message}`);
    this.name = 'KnowledgeContractValidationError';
    this.classification = classification;
    this.metadata = metadata;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, KnowledgeContractValidationError);
    }
  }
}
