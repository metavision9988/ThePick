/**
 * ThePick Error Handling Standards
 * All API responses and internal errors follow this standard.
 */

export enum ErrorCode {
  // 400
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_ONTOLOGY_ID = 'INVALID_ONTOLOGY_ID',
  FORMULA_PARSE_ERROR = 'FORMULA_PARSE_ERROR',
  BATCH_SEQUENCE_VIOLATION = 'BATCH_SEQUENCE_VIOLATION',

  // 404
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  QUESTION_NOT_FOUND = 'QUESTION_NOT_FOUND',
  FORMULA_NOT_FOUND = 'FORMULA_NOT_FOUND',

  // 422
  LOW_SIMILARITY = 'LOW_SIMILARITY',
  ANSWER_MISMATCH = 'ANSWER_MISMATCH',
  REVERSE_VERIFY_FAILED = 'REVERSE_VERIFY_FAILED',

  // 500
  FORMULA_ENGINE_ERROR = 'FORMULA_ENGINE_ERROR',
  AI_GENERATION_ERROR = 'AI_GENERATION_ERROR',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): ErrorResponseBody {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.metadata?.reference ? { reference: String(this.metadata.reference) } : {}),
      },
    };
  }
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponseBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    reference?: string;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponseBody;

export function ok<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

export function gracefulDegradation(chapter: string, section: string): AppError {
  return new AppError(
    ErrorCode.LOW_SIMILARITY,
    `Currently available data is insufficient for a clear explanation. Please refer to Chapter ${chapter}, Section ${section} of the textbook.`,
    422,
    { reference: `${chapter}-${section}` },
  );
}
