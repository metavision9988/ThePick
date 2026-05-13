/**
 * @thepick/learning-modes/shuffle — 결정성 셔플 (D3 lock 정합).
 *
 * plan §6.2 PITR D3 결정: `hash(userId || questionId || YYYYMMDD)` 시드.
 *   - 일자별 결정성 — 같은 user + 같은 question + 같은 날짜 → 같은 셔플
 *   - 다음날 새 시드 → 위치 기억 차단
 *   - device sync 보장 (server 측 생성)
 *   - 클라이언트가 정답 라벨 알 수 없도록 (셔플된 라벨만 전송)
 *
 * Web Crypto SHA-256 (Workers 호환). Fisher-Yates with seeded Mulberry32 PRNG.
 *
 * 정합:
 *   - apps/api routes에서 사용. 사용자가 보내는 submittedLabel ('A' ~ 'E')은
 *     셔플 라벨이므로 서버 측에서 ShuffledChoice.originalIndex로 역추적.
 */

export interface ShuffleSeedInput {
  readonly userId: string;
  readonly questionId: string;
  /** YYYY-MM-DD UTC. `todayDateString()` 또는 server timezone 정합 source 사용. */
  readonly date: string;
}

// todayDateString은 packages/learning-modes/session-progress.ts로 이전 (KST 기본 — 한국 사용자 100%).
// 본 모듈 import 정합 위해 re-export.
export { todayDateString } from './session-progress.js';

/**
 * SHA-256(userId || questionId || date) → hex 문자열.
 * Web Crypto only — Workers/Node/Vitest 모두 호환.
 */
export async function dailySeed(input: ShuffleSeedInput): Promise<string> {
  const text = `${input.userId}||${input.questionId}||${input.date}`;
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Mulberry32 PRNG. hex 시드의 첫 8자 (32비트)를 seed로 사용.
 *
 * 학습 보기 셔플 5개 항목 정도에 사용. 암호학적 보안 목적 X (학습 위치 변경 차단만).
 */
export function createPrng(hexSeed: string): () => number {
  if (hexSeed.length < 8) {
    throw new Error(`hexSeed must be at least 8 chars, got ${hexSeed.length}`);
  }
  let a = Number.parseInt(hexSeed.slice(0, 8), 16);
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle with seeded PRNG. 결정성 (같은 시드 → 같은 결과).
 */
export function shuffleWithSeed<T>(items: readonly T[], hexSeed: string): T[] {
  const arr = items.slice();
  const rng = createPrng(hexSeed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;
export type ChoiceLabel = (typeof CHOICE_LABELS)[number];

export interface ShuffledChoice {
  /** 셔플 후 표시되는 라벨 (A ~ E). 사용자 입력 source. */
  readonly label: ChoiceLabel;
  /** 원본 인덱스 (0 ~ originalTexts.length-1). 정답 매칭 용. */
  readonly originalIndex: number;
  /** 보기 본문 텍스트 (셔플 영향 X, originalIndex로 fetch). */
  readonly text: string;
}

/**
 * 객관식 보기 셔플. originalTexts는 원본 순서 (인덱스 0=①, 1=②, ...).
 *
 * 정합:
 *   - originalTexts.length는 2 ~ 5 허용 (4지선다 / 5지선다 양쪽)
 *   - 5지선다 외 (6지+) 는 별도 정책 carry-over
 */
export async function shuffleChoices(
  originalTexts: readonly string[],
  input: ShuffleSeedInput,
): Promise<ShuffledChoice[]> {
  if (originalTexts.length < 2 || originalTexts.length > CHOICE_LABELS.length) {
    throw new Error(
      `invalid choice count: ${originalTexts.length} (expected 2~${CHOICE_LABELS.length})`,
    );
  }
  const seed = await dailySeed(input);
  const indices: number[] = [];
  for (let i = 0; i < originalTexts.length; i++) indices.push(i);
  const shuffled = shuffleWithSeed(indices, seed);
  return shuffled.map((origIdx, shuffleIdx) => ({
    label: CHOICE_LABELS[shuffleIdx]!,
    originalIndex: origIdx,
    text: originalTexts[origIdx]!,
  }));
}
