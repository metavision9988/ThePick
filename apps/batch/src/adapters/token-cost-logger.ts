/**
 * 토큰 비용 JSONL 로거 — 배치 파이프라인 Claude API 호출 감사 로그.
 *
 * 파일 경로: `{logDir}/batch-tokens-{YYYYMMDD}.jsonl` (일 단위 로테이션).
 * 포맷: newline-delimited JSON (각 레코드 1줄). append-only, 파일 잠금 없음 (단일 프로세스 전제).
 *
 * 실패/성공 양쪽에서 호출 — 무음 실패 금지 원칙.
 * `ANTHROPIC_API_KEY` 등 민감값은 레코드에 포함하지 않는다.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { calculateTokenCost, type ClaudeModelPricing } from '@thepick/shared';

/** 로그 레코드 — 실패 시 error 필드 채워짐, 성공 시 null. */
export interface TokenUsageRecord {
  /** ISO 8601 UTC timestamp with millisecond precision. */
  ts: string;
  /** BATCH-N 또는 호출자 식별자. */
  batchId: string;
  /** Claude 모델 ID (pricing registry 에서 조회 키). */
  model: string;
  /** 모델 표시 라벨 — pricing registry 에서 해석. */
  modelDisplay: string;
  inputTokens: number;
  outputTokens: number;
  /** USD. 알 수 없는 모델 ID 는 fallback 단가로 계산. */
  costUsd: number;
  /** fallback pricing 사용 시 true — 단가 레지스트리 갱신 알림용. */
  pricingFallback: boolean;
  retries: number;
  /** Claude stop_reason (end_turn | max_tokens | tool_use | null). */
  stopReason: string | null;
  /** Stage 또는 호출 위치 라벨 (예: batch_structurize, vision_ocr). */
  stage: string;
  /** 실패 시 에러 메시지; 성공 시 null. */
  error: string | null;
}

export interface TokenLoggerOptions {
  /** 로그 파일 디렉터리. 기본: 프로젝트 루트 `logs/`. */
  readonly logDir?: string;
  /** 테스트 등에서 시간 주입. 기본: `() => new Date()`. */
  readonly clock?: () => Date;
  /** 테스트에서 파일 쓰기 없이 기록을 관찰. */
  readonly sink?: (line: string) => void;
}

export interface TokenLoggerInput {
  batchId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  stopReason: string | null;
  stage: string;
  error?: string | null;
}

export interface TokenLogger {
  record(input: TokenLoggerInput): TokenUsageRecord;
}

/**
 * 로거 팩토리. logDir 은 lazy 생성 (첫 record() 시점에 mkdir -p).
 */
export function createTokenCostLogger(options: TokenLoggerOptions = {}): TokenLogger {
  const { logDir, clock = () => new Date(), sink } = options;
  const resolvedDir = logDir ?? defaultLogDir();
  let dirReady = false;

  return {
    record(input) {
      const now = clock();
      const { costUsd, pricing, isFallback } = calculateTokenCost(
        input.model,
        input.inputTokens,
        input.outputTokens,
      );

      const record: TokenUsageRecord = {
        ts: now.toISOString(),
        batchId: input.batchId,
        model: input.model,
        modelDisplay: pricing.displayName,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costUsd,
        pricingFallback: isFallback,
        retries: input.retries,
        stopReason: input.stopReason,
        stage: input.stage,
        error: input.error ?? null,
      };

      const line = JSON.stringify(record) + '\n';

      if (sink) {
        sink(line);
      } else {
        if (!dirReady) {
          mkdirSync(resolvedDir, { recursive: true });
          dirReady = true;
        }
        const filePath = join(resolvedDir, `batch-tokens-${formatYyyymmdd(now)}.jsonl`);
        appendFileSync(filePath, line, { encoding: 'utf8' });
      }

      // stderr 요약 로그 — 운영 중 실시간 가시성 확보
      const costStr = costUsd < 0.01 ? `<$0.01` : `$${costUsd.toFixed(4)}`;
      const prefix = input.error ? '[token-cost] FAIL' : '[token-cost]';
      console.warn(
        `${prefix} ${input.batchId} | ${pricing.displayName} | ` +
          `in=${input.inputTokens} out=${input.outputTokens} | ${costStr} | ` +
          `retries=${input.retries}${input.error ? ` | err=${input.error}` : ''}`,
      );

      return record;
    },
  };
}

/** "YYYYMMDD" 포맷 — 일 단위 파일 로테이션 키. */
function formatYyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * 기본 로그 디렉터리 — 프로젝트 루트 `logs/`.
 * apps/batch 디렉터리가 실행 CWD 라고 가정하지 않음: monorepo 루트에서 CLI 실행되든
 * apps/batch 에서 실행되든 동일 경로로 떨어지게 env 기반 1차, CWD fallback.
 */
function defaultLogDir(): string {
  const envDir = process.env.THEPICK_BATCH_LOG_DIR;
  if (envDir && envDir.trim().length > 0) {
    return envDir;
  }
  return join(process.cwd(), 'logs');
}

/** 외부 노출 — 테스트에서 순수 계산 재사용 용도. */
export type { ClaudeModelPricing };
