/**
 * SIGINT / SIGTERM handler — pipeline 종료 직전 checkpoint flush.
 *
 * @runtime Node.js only.
 *
 * 책임:
 *   1. SIGINT (Ctrl+C) / SIGTERM (kill) 수신 시 sync checkpoint flush
 *   2. flushCheckpoint 콜백 내부 throw 를 process 좀비 상태로 새지 않게 catch
 *   3. POSIX exit code 준수 — SIGINT=130, SIGTERM=143
 *   4. cleanup 함수 반환 — runPipeline finally 에서 호출하여 다중 등록 누적 차단
 *
 * 본 모듈은 file system / DB 직접 호출 X — flushCheckpoint 콜백에 위임.
 *
 * 근거:
 *   - docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md §5.3
 *   - VOID ENGINE DESIGN CONSTITUTION v3.0 Vol V.4 (kill switch + checkpoint flush)
 *   - Step 18 MINOR-A3: console.error → @thepick/shared/logger (JSON 1줄 + Workers Observability)
 */

import { createLogger, type Logger, type LoggerEnvironment } from '@thepick/shared';

// 모듈 스코프 default logger — opts.logger 미주입 시 fallback. test 격리는 opts.logger 주입.
const VALID_ENVS: ReadonlySet<string> = new Set(['development', 'staging', 'production', 'test']);
const env = process.env.NODE_ENV;
const defaultLog: Logger = createLogger({
  service: 'thepick-batch-signal-handlers',
  environment:
    env !== undefined && VALID_ENVS.has(env) ? (env as LoggerEnvironment) : 'development',
});

export interface SignalHandlerOptions {
  /**
   * Sync 함수 — process.exit 직전 await 불가하므로 sync 보장 의무.
   * 예: writeCheckpointSync(cp, baseDir, { fsync: true })
   *
   * 내부 throw 시 본 모듈이 catch 후 logger.error — process 는 정상 exit code 로 종료.
   */
  readonly flushCheckpoint: () => void;
  /**
   * Optional logger override — 테스트 격리 + 호출자 컨텍스트 (batchRunId 등) 누적용.
   * 미지정 시 모듈 스코프 default logger (JSON 한 줄, Workers Observability 호환).
   */
  readonly logger?: Logger;
}

/**
 * SIGINT/SIGTERM handler 등록. 반환된 함수를 호출하면 handler 제거.
 *
 * @returns cleanup 함수 — runPipeline finally 에서 호출하여 stale handler 차단.
 */
export function installSignalHandlers(opts: SignalHandlerOptions): () => void {
  const log = opts.logger ?? defaultLog;
  const handler = (signal: NodeJS.Signals) => () => {
    try {
      // warn 레벨: 정상 종료 경로지만 운영자가 인지해야 함 (kill switch / Ctrl+C)
      log.warn(`${signal} received — flushing checkpoint before exit`, { signal });
      opts.flushCheckpoint();
    } catch (err) {
      // CRITICAL RULE #3: silent failure 차단. flushCheckpoint 실패도 stderr 로 가시화.
      log.error(`Checkpoint flush failed during ${signal}`, err, { signal });
    }
    // POSIX: SIGINT=130, SIGTERM=143
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };

  const sigintHandler = handler('SIGINT');
  const sigtermHandler = handler('SIGTERM');

  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);

  return () => {
    process.off('SIGINT', sigintHandler);
    process.off('SIGTERM', sigtermHandler);
  };
}
