import { describe, expect, it } from 'vitest';

import {
  CallCountExceededError,
  CostCap,
  CostCapExceededError,
  GuardedCallTimeoutError,
} from '../cost-cap';

describe('CostCap.guardedCall — 정상 경로', () => {
  it('호출 누적 / snapshot 갱신', async () => {
    const cap = new CostCap({ maxUsd: 1.0, maxCalls: 10 });

    const out = await cap.guardedCall(0.05, async () => ({
      result: 'ok',
      actualUsd: 0.03,
    }));

    expect(out).toBe('ok');
    expect(cap.snapshot()).toMatchObject({
      accumulatedUsd: 0.03,
      callCount: 1,
      maxUsd: 1.0,
      maxCalls: 10,
    });
  });

  it('연속 호출 누적', async () => {
    const cap = new CostCap({ maxUsd: 1.0, maxCalls: 10 });

    await cap.guardedCall(0.1, async () => ({ result: 1, actualUsd: 0.05 }));
    await cap.guardedCall(0.1, async () => ({ result: 2, actualUsd: 0.07 }));

    const snap = cap.snapshot();
    expect(snap.callCount).toBe(2);
    expect(snap.accumulatedUsd).toBeCloseTo(0.12, 10);
  });
});

describe('CostCap.guardedCall — 사전 guard', () => {
  it('예상 누적이 maxUsd 초과 시 호출 자체 차단', async () => {
    const cap = new CostCap({ maxUsd: 0.1, maxCalls: 10 });
    let invoked = false;

    await expect(
      cap.guardedCall(0.5, async () => {
        invoked = true;
        return { result: 'should-not-run', actualUsd: 0.5 };
      }),
    ).rejects.toBeInstanceOf(CostCapExceededError);

    expect(invoked).toBe(false);
    expect(cap.snapshot().callCount).toBe(0);
    expect(cap.snapshot().accumulatedUsd).toBe(0);
  });

  it('호출 횟수 한도 초과 시 사전 차단', async () => {
    const cap = new CostCap({ maxUsd: 100, maxCalls: 2 });
    let invoked = 0;

    await cap.guardedCall(0.01, async () => ({ result: 1, actualUsd: 0.001 }));
    await cap.guardedCall(0.01, async () => ({ result: 2, actualUsd: 0.001 }));

    await expect(
      cap.guardedCall(0.01, async () => {
        invoked += 1;
        return { result: 3, actualUsd: 0.001 };
      }),
    ).rejects.toBeInstanceOf(CallCountExceededError);

    expect(invoked).toBe(0);
  });
});

describe('CostCap.guardedCall — 사후 검증', () => {
  it('단일 호출이 prediction 보다 비싸 누적이 한도 초과 시 사후 throw', async () => {
    const cap = new CostCap({ maxUsd: 0.1, maxCalls: 10 });

    await expect(
      cap.guardedCall(0.05, async () => ({
        result: 'leaked',
        actualUsd: 0.5,
      })),
    ).rejects.toBeInstanceOf(CostCapExceededError);

    expect(cap.snapshot().accumulatedUsd).toBeCloseTo(0.5, 10);
    expect(cap.snapshot().callCount).toBe(1);
  });

  it('actualUsd 가 음수면 TypeError + 보수적 회계 (estimatedMaxUsd 누적, callCount 증가)', async () => {
    // NEW-C-3 fix: fn 은 이미 실행됨 — 외부 비용 발생을 가정해 보수적으로 회계.
    const cap = new CostCap();

    await expect(
      cap.guardedCall(0.05, async () => ({
        result: 'x',
        actualUsd: -0.01,
      })),
    ).rejects.toBeInstanceOf(TypeError);

    expect(cap.snapshot().callCount).toBe(1);
    expect(cap.snapshot().accumulatedUsd).toBeCloseTo(0.05, 10);
  });

  it('actualUsd 가 NaN 이면 TypeError + 보수적 회계', async () => {
    const cap = new CostCap();

    await expect(
      cap.guardedCall(0.05, async () => ({
        result: 'x',
        actualUsd: Number.NaN,
      })),
    ).rejects.toBeInstanceOf(TypeError);

    expect(cap.snapshot().callCount).toBe(1);
    expect(cap.snapshot().accumulatedUsd).toBeCloseTo(0.05, 10);
  });

  it('fn 자체가 throw 하면 callCount 증가 + estimatedMaxUsd 보수적 누적', async () => {
    // NEW-C-3 fix: 외부 호출이 실패해도 비용은 발생할 수 있음 — 회계 보장.
    const cap = new CostCap({ maxUsd: 1.0, maxCalls: 10 });

    await expect(
      cap.guardedCall(0.1, async () => {
        throw new Error('upstream API failure');
      }),
    ).rejects.toThrow('upstream API failure');

    expect(cap.snapshot().callCount).toBe(1);
    expect(cap.snapshot().accumulatedUsd).toBeCloseTo(0.1, 10);
  });
});

describe('CostCap — 잘못된 입력 거부', () => {
  it('estimatedMaxUsd 가 음수면 TypeError', async () => {
    const cap = new CostCap();
    await expect(
      cap.guardedCall(-0.1, async () => ({ result: 1, actualUsd: 0 })),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('estimatedMaxUsd 가 NaN 이면 TypeError', async () => {
    const cap = new CostCap();
    await expect(
      cap.guardedCall(Number.NaN, async () => ({ result: 1, actualUsd: 0 })),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('maxUsd <= 0 생성 거부', () => {
    expect(() => new CostCap({ maxUsd: 0 })).toThrow(TypeError);
    expect(() => new CostCap({ maxUsd: -1 })).toThrow(TypeError);
  });

  it('maxCalls 가 정수 아니면 거부', () => {
    expect(() => new CostCap({ maxCalls: 1.5 })).toThrow(TypeError);
    expect(() => new CostCap({ maxCalls: 0 })).toThrow(TypeError);
  });
});

describe('CostCap — 에러 컨텍스트 보존', () => {
  it('CostCapExceededError 가 누적/예상/한도 필드 보존', async () => {
    const cap = new CostCap({ maxUsd: 0.1 });

    try {
      await cap.guardedCall(0.5, async () => ({ result: 1, actualUsd: 0 }));
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CostCapExceededError);
      const e = err as CostCapExceededError;
      expect(e.accumulatedUsd).toBe(0);
      expect(e.estimatedNextUsd).toBe(0.5);
      expect(e.maxUsd).toBe(0.1);
    }
  });

  it('CallCountExceededError 가 callCount/maxCalls 보존', async () => {
    const cap = new CostCap({ maxCalls: 1 });

    await cap.guardedCall(0, async () => ({ result: 1, actualUsd: 0 }));

    try {
      await cap.guardedCall(0, async () => ({ result: 2, actualUsd: 0 }));
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CallCountExceededError);
      const e = err as CallCountExceededError;
      expect(e.callCount).toBe(2);
      expect(e.maxCalls).toBe(1);
    }
  });
});

describe('CostCap — 동시 호출 직렬화 (NEW-C-2 race fix)', () => {
  it('Promise.all 동시 호출 시 직렬화되어 두 번째 호출이 사전 차단', async () => {
    const cap = new CostCap({ maxUsd: 0.1, maxCalls: 10 });
    let secondInvoked = false;

    const [first, second] = await Promise.allSettled([
      cap.guardedCall(0.06, async () => ({ result: 1, actualUsd: 0.06 })),
      cap.guardedCall(0.06, async () => {
        secondInvoked = true;
        return { result: 2, actualUsd: 0.06 };
      }),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    if (second.status === 'rejected') {
      expect(second.reason).toBeInstanceOf(CostCapExceededError);
    }
    // 핵심: 두 번째 fn 이 실행되지 않아야 — 외부 비용이 발생하지 않음
    expect(secondInvoked).toBe(false);
    expect(cap.snapshot().callCount).toBe(1);
    expect(cap.snapshot().accumulatedUsd).toBeCloseTo(0.06, 10);
  });

  it('연속 동시 5건 시 직렬화되어 순서 보장', async () => {
    const cap = new CostCap({ maxUsd: 1.0, maxCalls: 10 });
    const order: number[] = [];

    await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        cap.guardedCall(0.01, async () => {
          order.push(n);
          return { result: n, actualUsd: 0.01 };
        }),
      ),
    );

    expect(order).toEqual([1, 2, 3, 4, 5]);
    expect(cap.snapshot().callCount).toBe(5);
  });
});

describe('CostCap.guardedCall — fn timeout (NEW-C-1 fix)', () => {
  it('timeoutMs 미지정 시 fn 자체 hang 가능 (회귀 — 기존 호환)', async () => {
    const cap = new CostCap({ maxUsd: 1.0, maxCalls: 10 });

    const out = await cap.guardedCall(0.05, async () => ({
      result: 'ok',
      actualUsd: 0.01,
    }));

    expect(out).toBe('ok');
  });

  it('timeoutMs 초과 시 GuardedCallTimeoutError + 보수적 회계', async () => {
    const cap = new CostCap({ maxUsd: 1.0, maxCalls: 10 });

    await expect(
      cap.guardedCall(
        0.1,
        () =>
          new Promise<never>(() => {
            // 영원히 resolve 안 함 — fn hang 시뮬
          }),
        { timeoutMs: 50 },
      ),
    ).rejects.toBeInstanceOf(GuardedCallTimeoutError);

    expect(cap.snapshot().callCount).toBe(1);
    expect(cap.snapshot().accumulatedUsd).toBeCloseTo(0.1, 10);
  });

  it('fn 이 signal 을 받아 자체 abort 가능', async () => {
    const cap = new CostCap({ maxUsd: 1.0, maxCalls: 10 });
    let signalAborted = false;

    await expect(
      cap.guardedCall(
        0.1,
        (signal) =>
          new Promise<never>((_, reject) => {
            signal?.addEventListener('abort', () => {
              signalAborted = true;
              reject(new Error('fn-side abort'));
            });
          }),
        { timeoutMs: 50 },
      ),
    ).rejects.toThrow();

    expect(signalAborted).toBe(true);
    expect(cap.snapshot().callCount).toBe(1);
    expect(cap.snapshot().accumulatedUsd).toBeCloseTo(0.1, 10);
  });

  it('timeout 전 fn 이 빠르게 완료되면 정상 통과', async () => {
    const cap = new CostCap({ maxUsd: 1.0, maxCalls: 10 });

    const out = await cap.guardedCall(0.05, async () => ({ result: 'fast', actualUsd: 0.01 }), {
      timeoutMs: 1000,
    });

    expect(out).toBe('fast');
    expect(cap.snapshot().accumulatedUsd).toBeCloseTo(0.01, 10);
  });

  it('timeoutMs 가 NaN/0/음수면 TypeError', async () => {
    const cap = new CostCap();

    await expect(
      cap.guardedCall(0, async () => ({ result: 1, actualUsd: 0 }), {
        timeoutMs: Number.NaN,
      }),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      cap.guardedCall(0, async () => ({ result: 1, actualUsd: 0 }), {
        timeoutMs: 0,
      }),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      cap.guardedCall(0, async () => ({ result: 1, actualUsd: 0 }), {
        timeoutMs: -100,
      }),
    ).rejects.toBeInstanceOf(TypeError);

    // invalid timeoutMs 는 사전 검증 단계라 callCount 미증가
    expect(cap.snapshot().callCount).toBe(0);
  });

  it('GuardedCallTimeoutError 가 timeoutMs 필드 보존', async () => {
    const cap = new CostCap({ maxUsd: 1.0, maxCalls: 10 });

    try {
      await cap.guardedCall(0.05, () => new Promise<never>(() => {}), {
        timeoutMs: 30,
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(GuardedCallTimeoutError);
      const e = err as GuardedCallTimeoutError;
      expect(e.timeoutMs).toBe(30);
      expect(e.message).toContain('30ms');
    }
  });
});

describe('CostCap — 인스턴스 격리 (resetForNewSession 대체)', () => {
  it('새 인스턴스는 누적 0 으로 시작 — 모듈 수준 공유 없음', async () => {
    const a = new CostCap({ maxUsd: 1.0, maxCalls: 5 });
    await a.guardedCall(0.1, async () => ({ result: 1, actualUsd: 0.05 }));
    expect(a.snapshot().accumulatedUsd).toBeCloseTo(0.05, 10);

    const b = new CostCap({ maxUsd: 1.0, maxCalls: 5 });
    expect(b.snapshot().accumulatedUsd).toBe(0);
    expect(b.snapshot().callCount).toBe(0);
  });
});
