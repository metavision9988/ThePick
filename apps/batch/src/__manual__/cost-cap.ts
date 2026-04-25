/**
 * 가-1 Group A smoke 호출 비용·횟수 cap.
 *
 * 무한 루프 / max_tokens 오타 / 의도하지 않은 재시도로 인한
 * 토큰 비용 폭주를 사전 차단한다.
 *
 * 사용 규약 (README 명시 + 본 파일 강제):
 *   - smoke 스크립트는 SDK 직접 호출 금지
 *   - 모든 외부 호출은 `costCap.guardedCall(estimatedMaxUsd, fn)` 경유 의무
 *   - guardedCall 은 사전 guard (예상 누적 > 한도 → throw) + 사후 record 를 단일 wrapper 에 묶음
 *
 * 1차 리뷰(20260425) 발견 후 보강:
 *   - 모듈 레벨 mutable singleton → class 인스턴스화 (M-3 fix)
 *   - resetForNewSession public export 제거 → 새 인스턴스 생성으로 대체 (M-2 / S-5 fix)
 *   - 사후 집계 → 사전 guard 추가 (S-4 fix)
 *   - guardedCall wrapper 강제 (S-3 fix)
 *
 * 단위: USD. 한도 변경은 진산님 사전 합의 후 본 파일 상수 수정.
 */

const DEFAULT_MAX_USD = 1.0;
const DEFAULT_MAX_CALLS = 50;

export class CostCapExceededError extends Error {
  override readonly name = 'CostCapExceededError';
  constructor(
    message: string,
    public readonly accumulatedUsd: number,
    public readonly estimatedNextUsd: number,
    public readonly maxUsd: number,
  ) {
    super(message);
  }
}

export class CallCountExceededError extends Error {
  override readonly name = 'CallCountExceededError';
  constructor(
    message: string,
    public readonly callCount: number,
    public readonly maxCalls: number,
  ) {
    super(message);
  }
}

export class GuardedCallTimeoutError extends Error {
  override readonly name = 'GuardedCallTimeoutError';
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message);
  }
}

export interface CostCapConfig {
  readonly maxUsd?: number;
  readonly maxCalls?: number;
}

export interface SmokeCallResult<T> {
  readonly result: T;
  readonly actualUsd: number;
}

export interface GuardedCallOptions {
  /**
   * fn 자체의 timeout (ms). 초과 시 fn 의 AbortSignal 이 abort 되고 GuardedCallTimeoutError throw.
   * 미지정 시 fn 자체 timeout 부재 — fn 이 hang 하면 inflight chain 이 매달림.
   * Pass 3 NEW-C-1 fix: smoke 스크립트는 항상 명시 권장.
   */
  readonly timeoutMs?: number;
}

export interface CostCapSnapshot {
  readonly accumulatedUsd: number;
  readonly callCount: number;
  readonly maxUsd: number;
  readonly maxCalls: number;
}

export class CostCap {
  private accumulatedUsd = 0;
  private callCount = 0;
  private readonly maxUsd: number;
  private readonly maxCalls: number;
  // 직렬화 큐 — Promise.all 등 동시 호출 시 사전 guard 우회를 차단 (Pass 2 NEW-C-2 fix).
  // 모든 guardedCall 진입은 이전 호출 완료 후에만 시작.
  private inflight: Promise<unknown> = Promise.resolve();

  constructor(config?: CostCapConfig) {
    this.maxUsd = config?.maxUsd ?? DEFAULT_MAX_USD;
    this.maxCalls = config?.maxCalls ?? DEFAULT_MAX_CALLS;
    if (!Number.isFinite(this.maxUsd) || this.maxUsd <= 0) {
      throw new TypeError(`Invalid maxUsd: ${this.maxUsd}`);
    }
    if (!Number.isInteger(this.maxCalls) || this.maxCalls <= 0) {
      throw new TypeError(`Invalid maxCalls: ${this.maxCalls}`);
    }
  }

  /**
   * 사전 guard + 사후 record 를 단일 호출에 묶음. smoke 스크립트는 이 함수만 사용.
   *
   * @param estimatedMaxUsd 호출의 최대 예상 비용. 누적치와 합산해 cap 초과 시 사전 throw.
   * @param fn 실 외부 호출 (Claude/Vision API 등). 결과와 실 발생 비용 반환.
   * @throws TypeError estimatedMaxUsd 또는 actualUsd 가 유효하지 않을 때
   * @throws CallCountExceededError 호출 횟수 한도 초과
   * @throws CostCapExceededError 누적 비용 한도 초과 (사전 또는 사후)
   */
  async guardedCall<T>(
    estimatedMaxUsd: number,
    fn: (signal?: AbortSignal) => Promise<SmokeCallResult<T>>,
    opts?: GuardedCallOptions,
  ): Promise<T> {
    // Promise queue 직렬화 — race 우회 차단. 이전 호출이 끝나야 사전 guard 가 정확함.
    // 본 클래스는 단일 사용자 수동 smoke 전용이므로 큐 길이 제약은 두지 않음.
    const previous = this.inflight;
    const next = previous
      .catch(() => undefined)
      .then(() => this.executeGuarded(estimatedMaxUsd, fn, opts?.timeoutMs));
    this.inflight = next;
    return next;
  }

  private async executeGuarded<T>(
    estimatedMaxUsd: number,
    fn: (signal?: AbortSignal) => Promise<SmokeCallResult<T>>,
    timeoutMs: number | undefined,
  ): Promise<T> {
    if (!Number.isFinite(estimatedMaxUsd) || estimatedMaxUsd < 0) {
      throw new TypeError(`Invalid estimatedMaxUsd: ${estimatedMaxUsd}`);
    }
    if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
      throw new TypeError(`Invalid timeoutMs: ${timeoutMs}`);
    }

    if (this.callCount + 1 > this.maxCalls) {
      throw new CallCountExceededError(
        `호출 횟수 ${this.callCount + 1} 가 한도 ${this.maxCalls} 초과. 의도하지 않은 루프 가능성. 진산님 확인 후 재시작.`,
        this.callCount + 1,
        this.maxCalls,
      );
    }

    const projectedUsd = this.accumulatedUsd + estimatedMaxUsd;
    if (projectedUsd > this.maxUsd) {
      throw new CostCapExceededError(
        `예상 누적 비용 $${projectedUsd.toFixed(4)} 가 한도 $${this.maxUsd} 초과 — 호출 사전 차단.`,
        this.accumulatedUsd,
        estimatedMaxUsd,
        this.maxUsd,
      );
    }

    // fn 호출 사실 자체를 callCount 에 먼저 기록 (NEW-C-3 fix).
    // 외부 비용은 이미 발생하므로 actualUsd 가 invalid 여도 호출은 회계됨.
    // accumulatedUsd 는 invalid 시 estimatedMaxUsd 로 보수적 누적.
    this.callCount += 1;

    let callResult: SmokeCallResult<T>;
    try {
      callResult = await this.runWithOptionalTimeout(fn, timeoutMs);
    } catch (err) {
      // fn 자체가 실패하거나 timeout 으로 abort — 비용은 발생했을 수 있으므로 보수적 누적.
      this.accumulatedUsd += estimatedMaxUsd;
      throw err;
    }

    const actualUsd = callResult.actualUsd;
    if (!Number.isFinite(actualUsd) || actualUsd < 0) {
      // actualUsd invalid — fn 은 성공했으나 회계 정보 손상.
      // 보수적으로 estimatedMaxUsd 누적 후 throw.
      this.accumulatedUsd += estimatedMaxUsd;
      throw new TypeError(`Invalid actualUsd from call: ${actualUsd}`);
    }

    this.accumulatedUsd += actualUsd;

    // 사후 검증 — 단일 호출이 prediction 보다 비싸 누적이 한도 초과한 경우.
    // state 는 이미 갱신됨(의도): 다음 guardedCall 의 사전 guard 가 즉시 차단함.
    if (this.accumulatedUsd > this.maxUsd) {
      throw new CostCapExceededError(
        `실 누적 비용 $${this.accumulatedUsd.toFixed(4)} 가 한도 $${this.maxUsd} 초과. 다음 호출 차단.`,
        this.accumulatedUsd,
        0,
        this.maxUsd,
      );
    }

    return callResult.result;
  }

  /**
   * fn 을 옵션 timeout 으로 race. timeout 시 AbortSignal 발사 + GuardedCallTimeoutError reject.
   * fn 이 signal 을 받아 자체 cancel 하지 않더라도 race 자체는 reject 되어 inflight 가 해제됨.
   * Pass 3 NEW-C-1 fix.
   */
  private async runWithOptionalTimeout<T>(
    fn: (signal?: AbortSignal) => Promise<T>,
    timeoutMs: number | undefined,
  ): Promise<T> {
    if (timeoutMs === undefined) {
      return fn();
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const fnPromise = fn(ac.signal);
      const timeoutPromise = new Promise<never>((_, reject) => {
        ac.signal.addEventListener(
          'abort',
          () => {
            reject(new GuardedCallTimeoutError(`fn timeout after ${timeoutMs}ms`, timeoutMs));
          },
          { once: true },
        );
      });
      return await Promise.race([fnPromise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }

  snapshot(): CostCapSnapshot {
    return {
      accumulatedUsd: this.accumulatedUsd,
      callCount: this.callCount,
      maxUsd: this.maxUsd,
      maxCalls: this.maxCalls,
    };
  }
}
