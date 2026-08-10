/**
 * **캘리브레이션 표면 동결** — held-out 검증의 선결 조건 (독립 리뷰 C-2 처분).
 *
 * ## 왜 필요한가
 *
 * 08-08 독립 리뷰가 못박은 문장: *"held-out 동결 대상에 **임계 2개뿐 아니라 제외 정규식 5종**을
 * 포함해야 한다 — 제외는 임계와 동등한 자유도다."*
 *
 * 실제로 그랬다. 파일럿에서 `reject 30 → 11` 을 만든 것은 임계 조정이 아니라 **제외 규칙 추가**였고,
 * 리뷰는 그것이 "정확도 개선이 아니라 판정 포기"(판정 가능 47→20)임을 실측으로 보였다.
 * 즉 **임계만 동결하면 동결한 척만 하는 것**이다 — 제외 규칙 한 줄이면 같은 효과를 낸다.
 *
 * ## 이 파일이 하는 일
 *
 * 판정 결과를 바꿀 수 있는 **모든 손잡이를 한 곳에 열거**하고, 그 전체에 지문(fingerprint)을 찍는다.
 * 손잡이가 하나라도 바뀌면 지문이 바뀌고, 그것을 고정한 테스트가 red 가 된다.
 * ⇒ 조용한 조정이 불가능해진다. 바꾸려면 **테스트를 함께 고쳐야 하고, 그 diff 가 기록으로 남는다.**
 *
 * ## 무엇을 보장하지 않는가 (정직)
 *
 * - 이것은 **동결 장치이지 캘리브레이션이 아니다.** 임계가 옳은 값인지는 held-out 실측이 답한다.
 * - held-out 세트는 아직 **없다**(파일럿 58장은 2026-07-14 위임 승격분 = burned 코퍼스).
 *   그 확보는 결재 대시보드 §A #8 이며, 이 파일은 그때 "무엇을 재는가"의 대상을 확정해 둘 뿐이다.
 */

import { QUOTE_COVERAGE_THRESHOLD, MIN_QUOTE_BIGRAMS } from './bigram.js';
import { LCS_RATIO_THRESHOLD } from './lcs.js';
import {
  NON_VALUE_SOURCES,
  UNIT_ALIAS_SOURCES,
  UNIT_SUFFIX_SOURCE,
  SCALE_SOURCES,
} from './numeric.js';
import { ANCHOR_EXCLUSION_SOURCES } from './anchors.js';

/** 판정을 바꿀 수 있는 손잡이 전체. 새 손잡이를 추가하면 **여기에도 반드시 등재**한다. */
export interface CalibrationSurface {
  /** 수치 임계 — 값이 클수록 엄격. */
  readonly thresholds: Readonly<Record<string, number>>;
  /**
   * 제외·정규화 규칙 — **임계와 동등한 자유도**다.
   * 여기에 한 줄 추가하면 임계를 내린 것과 같은 효과를 낼 수 있다(파일럿 실측).
   */
  readonly exclusions: Readonly<Record<string, readonly string[]>>;
}

export const CALIBRATION_SURFACE: CalibrationSurface = {
  thresholds: {
    QUOTE_COVERAGE_THRESHOLD,
    MIN_QUOTE_BIGRAMS,
    LCS_RATIO_THRESHOLD,
  },
  exclusions: {
    /** 3-2 값 검사에서 "값이 아닌 숫자"로 지우는 패턴 (조항 참조·노드 ID·날짜 등). */
    NON_VALUE: NON_VALUE_SOURCES,
    /** 단위 별칭 — 무엇을 같은 단위로 볼지. 넓히면 서로 다른 값이 같아진다. */
    UNIT_ALIAS: UNIT_ALIAS_SOURCES,
    /** 단위 뒤 조사 허용 목록 — 넓히면 미지 단위가 알려진 단위로 흡수된다. */
    UNIT_SUFFIX: [UNIT_SUFFIX_SOURCE],
    /** 한국어 큰 수 배율 — 조(兆) 충돌 처리를 포함한다. */
    SCALE: SCALE_SOURCES,
    /** 3-4 앵커 검사에서 앵커로 세지 않는 패턴. */
    ANCHOR_EXCLUSION: ANCHOR_EXCLUSION_SOURCES,
  },
};

/**
 * 표면 전체의 지문. 손잡이가 하나라도 바뀌면 값이 바뀐다.
 *
 * ★암호학적 해시가 아니라 **결정론적 요약**이다. 목적은 위조 방지가 아니라
 *   "조용한 변경 차단"이므로 의존성 0인 단순 함수로 충분하다(Workers-safe 유지).
 */
export function surfaceFingerprint(surface: CalibrationSurface = CALIBRATION_SURFACE): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(surface.thresholds).sort(([a], [b]) => (a < b ? -1 : 1))) {
    parts.push(`T:${k}=${v}`);
  }
  for (const [k, list] of Object.entries(surface.exclusions).sort(([a], [b]) => (a < b ? -1 : 1))) {
    parts.push(`E:${k}=[${[...list].join('|')}]`);
  }
  const joined = parts.join('\n');
  // FNV-1a 32bit ×2 (오프셋 다르게) → 충돌 확률을 실용 수준으로 낮춘다.
  const fnv = (seed: number): string => {
    let h = seed;
    for (let i = 0; i < joined.length; i += 1) {
      h ^= joined.codePointAt(i)!;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return `${fnv(0x811c9dc5)}${fnv(0x9e3779b9)}`;
}

/** 손잡이 개수 — "새 손잡이를 등재 없이 추가"를 잡는 보조 지표. */
export function surfaceSize(surface: CalibrationSurface = CALIBRATION_SURFACE): {
  thresholds: number;
  exclusionRules: number;
} {
  return {
    thresholds: Object.keys(surface.thresholds).length,
    exclusionRules: Object.values(surface.exclusions).reduce((n, l) => n + l.length, 0),
  };
}
