/**
 * M16 Constants Resolver — 산식에 필요한 상수를 주입받는 인터페이스
 *
 * PoC: 인메모리 맵으로 상수 직접 주입.
 * 프로덕션: D1 쿼리 구현으로 교체.
 */

import type { ConstantsProvider } from './types';

export class InMemoryConstantsProvider implements ConstantsProvider {
  private readonly store: ReadonlyMap<string, number>;

  constructor(constants: Record<string, number>) {
    this.store = new Map(Object.entries(constants));
  }

  resolve(name: string): number | null {
    return this.store.get(name) ?? null;
  }
}
