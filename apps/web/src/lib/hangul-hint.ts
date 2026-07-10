/**
 * hangul-hint — M9 점진적 힌트 사다리(Graduated Cueing) 순수 파생 함수.
 *
 * 정답 문자열에서 4단계 힌트를 파생한다 (docs/사용자UIUX/쪽집게_암기대상_인터랙션_방법론.md §M9):
 *   1단계 초성 → 2단계 첫 글자 → 3단계 글자수 → 4단계 첫 어절
 *
 * 정답 원문은 서버 /api/public/reveal 로만 받는다(클라 추론 금지) — 이 모듈은
 * 받은 원문의 표시 가공만 담당하는 순수 함수(부수효과 0, DOM 무접촉).
 */

const CHOSEONG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
] as const;

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;

/** 완성형 한글 음절이면 초성, 아니면 null. */
function choseongOf(char: string): string | null {
  const code = char.codePointAt(0);
  if (code === undefined || code < HANGUL_BASE || code > HANGUL_LAST) return null;
  const index = Math.floor((code - HANGUL_BASE) / (JUNGSEONG_COUNT * JONGSEONG_COUNT));
  return CHOSEONG[index] ?? null;
}

/** 마스킹 표시 문자 — 힌트에서 아직 공개되지 않은 글자. */
export const HINT_MASK = '○';

/**
 * 1단계 — 초성 힌트: 한글은 초성으로, 공백은 유지, 그 외(숫자·영문·기호)는 마스킹.
 * 예: "위험보장" → "ㅇㅎㅂㅈ", "제3보험" → "ㅈ○ㅂㅎ"
 */
export function choseongHint(answer: string): string {
  return Array.from(answer)
    .map((ch) => {
      if (ch === ' ') return ' ';
      return choseongOf(ch) ?? HINT_MASK;
    })
    .join('');
}

/** 2단계 — 첫 글자 힌트: 첫 글자만 공개, 나머지 마스킹(공백 유지). */
export function firstCharHint(answer: string): string {
  const chars = Array.from(answer);
  return chars.map((ch, i) => (i === 0 ? ch : ch === ' ' ? ' ' : HINT_MASK)).join('');
}

/** 3단계 — 글자수 힌트: 공백 제외 글자 수. */
export function charCountHint(answer: string): number {
  return Array.from(answer).filter((ch) => ch !== ' ').length;
}

/** 4단계 — 첫 어절 힌트: 첫 어절 공개, 나머지 어절 마스킹. */
export function firstWordHint(answer: string): string {
  const words = answer.split(' ').filter((w) => w.length > 0);
  if (words.length === 0) return '';
  const first = words[0]!;
  const rest = words.slice(1).map((w) => HINT_MASK.repeat(Array.from(w).length));
  return [first, ...rest].join(' ');
}

export const HINT_LEVELS = 4;

export interface HintStep {
  readonly level: 1 | 2 | 3 | 4;
  readonly label: string;
  readonly text: string;
}

/** 힌트 사다리 전체 파생 — level 오름차순(더 많은 단서 순). */
export function buildHintLadder(answer: string): readonly HintStep[] {
  return [
    { level: 1, label: '초성', text: choseongHint(answer) },
    { level: 2, label: '첫 글자', text: firstCharHint(answer) },
    { level: 3, label: '글자수', text: `${charCountHint(answer)}글자` },
    { level: 4, label: '첫 어절', text: firstWordHint(answer) },
  ];
}
