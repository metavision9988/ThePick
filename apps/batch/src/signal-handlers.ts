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
 */

export interface SignalHandlerOptions {
  /**
   * Sync 함수 — process.exit 직전 await 불가하므로 sync 보장 의무.
   * 예: writeCheckpointSync(cp, baseDir, { fsync: true })
   *
   * 내부 throw 시 본 모듈이 catch 후 console.error — process 는 정상 exit code 로 종료.
   */
  readonly flushCheckpoint: () => void;
}

/**
 * SIGINT/SIGTERM handler 등록. 반환된 함수를 호출하면 handler 제거.
 *
 * @returns cleanup 함수 — runPipeline finally 에서 호출하여 stale handler 차단.
 */
export function installSignalHandlers(opts: SignalHandlerOptions): () => void {
  const handler = (signal: NodeJS.Signals) => () => {
    try {
      console.error(`[Pipeline] ${signal} received — flushing checkpoint before exit`);
      opts.flushCheckpoint();
    } catch (err) {
      console.error(`[Pipeline] Checkpoint flush failed during ${signal}:`, err);
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
