/**
 * signal-handlers.ts 단위 테스트 — AC-R4 (SIGINT/Ctrl+C handler).
 *
 * 검증 범위:
 *   - SIGINT 수신 시 flushCheckpoint 호출 + process.exit(130) (POSIX)
 *   - SIGTERM 수신 시 flushCheckpoint 호출 + process.exit(143) (POSIX)
 *   - flushCheckpoint 내부 throw 시 catch + console.error + 그래도 process.exit (좀비 차단)
 *   - cleanup 함수 호출 후 신호 → handler 미발동 (stale handler 차단, runPipeline finally)
 *   - 다중 register/cleanup → listener leak 0건 (Step 11.6 §5.3 다중 등록 위험 완화)
 *
 * 본 테스트는 process.exit 을 spy 로 대체 — 실제 vitest worker 종료 차단.
 *
 * SF-MAJOR-DA-2/4 본질 (B1 4-Pass) — markBatchRunKilled best-effort fire-and-forget
 * cosmetic 본질은 pipeline.integration.test.ts AC-R1 + AC-R3 에서 e2e 흡수. 본 파일은
 * signal-handlers.ts 단독 책임 (flushCheckpoint 콜백 + cleanup)만 검증.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { installSignalHandlers } from '../src/signal-handlers';

describe('installSignalHandlers — AC-R4 (SIGINT/SIGTERM handler 격리 검증)', () => {
  let exitSpy: MockInstance;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    // process.exit 호출을 throw 로 변환 — 테스트 격리
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('__test_process_exit__');
    }) as never);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /* swallow */
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('SIGINT 수신 → flushCheckpoint 호출 + process.exit(130)', () => {
    let flushedCount = 0;
    const remove = installSignalHandlers({
      flushCheckpoint: () => {
        flushedCount += 1;
      },
    });

    try {
      expect(() => process.emit('SIGINT' as NodeJS.Signals)).toThrow('__test_process_exit__');
      expect(flushedCount).toBe(1);
      expect(exitSpy).toHaveBeenCalledWith(130);
    } finally {
      remove();
    }
  });

  it('SIGTERM 수신 → flushCheckpoint 호출 + process.exit(143)', () => {
    let flushedCount = 0;
    const remove = installSignalHandlers({
      flushCheckpoint: () => {
        flushedCount += 1;
      },
    });

    try {
      expect(() => process.emit('SIGTERM' as NodeJS.Signals)).toThrow('__test_process_exit__');
      expect(flushedCount).toBe(1);
      expect(exitSpy).toHaveBeenCalledWith(143);
    } finally {
      remove();
    }
  });

  it('flushCheckpoint throw → catch + console.error + 그래도 process.exit (좀비 차단)', () => {
    const remove = installSignalHandlers({
      flushCheckpoint: () => {
        throw new Error('disk full simulation');
      },
    });

    try {
      expect(() => process.emit('SIGINT' as NodeJS.Signals)).toThrow('__test_process_exit__');
      // flushCheckpoint 실패도 stderr 로 가시화 (silent failure 차단, CRITICAL RULE #3)
      const errorCalls = consoleErrorSpy.mock.calls.flat().join(' ');
      expect(errorCalls).toContain('Checkpoint flush failed');
      expect(errorCalls).toContain('disk full simulation');
      expect(exitSpy).toHaveBeenCalledWith(130);
    } finally {
      remove();
    }
  });

  it('cleanup() 호출 후 SIGINT 발생 → flushCheckpoint 미호출 (stale handler 차단)', () => {
    let flushedCount = 0;
    const remove = installSignalHandlers({
      flushCheckpoint: () => {
        flushedCount += 1;
      },
    });
    remove();

    // 다른 listener 가 없으면 SIGINT 가 process 를 죽일 수 있으므로 임시 listener 등록
    const noopListener = (): void => {
      /* preserve process during emit */
    };
    process.on('SIGINT', noopListener);
    try {
      process.emit('SIGINT' as NodeJS.Signals);
      expect(flushedCount).toBe(0);
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      process.off('SIGINT', noopListener);
    }
  });

  it('다중 register + 다중 cleanup → listener 누적 0건 (leak 차단)', () => {
    const beforeSigint = process.listenerCount('SIGINT');
    const beforeSigterm = process.listenerCount('SIGTERM');

    const r1 = installSignalHandlers({ flushCheckpoint: () => undefined });
    const r2 = installSignalHandlers({ flushCheckpoint: () => undefined });
    expect(process.listenerCount('SIGINT')).toBe(beforeSigint + 2);
    expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm + 2);

    r1();
    r2();
    expect(process.listenerCount('SIGINT')).toBe(beforeSigint);
    expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm);
  });

  it('동일 SignalHandlerOptions 인스턴스 재등록 → 별도 listener 2건 (cleanup 도 2건 의무)', () => {
    const opts = { flushCheckpoint: () => undefined };
    const beforeSigint = process.listenerCount('SIGINT');

    const r1 = installSignalHandlers(opts);
    const r2 = installSignalHandlers(opts);
    expect(process.listenerCount('SIGINT')).toBe(beforeSigint + 2);

    r1();
    expect(process.listenerCount('SIGINT')).toBe(beforeSigint + 1);
    r2();
    expect(process.listenerCount('SIGINT')).toBe(beforeSigint);
  });
});
