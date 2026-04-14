/**
 * M09 Constants 추출기
 *
 * 배치 프로세서(M07) 출력의 constants 배열을 후처리:
 *   1. numeric_value 파싱 (value 문자열 → 숫자, 파싱 불가 시 null)
 *   2. unit 추출 (%, 배수, 원, kg, 일 등)
 *   3. confusion_level 자동 태깅 (danger/warn/safe)
 *
 * value 필드는 교재 원문 그대로 보존. numeric_value는 파싱 결과.
 */

import type { ConfusionLevel } from '@thepick/shared';
import type { KnowledgeContractConstant } from './schema-validator';

// --- Confusion level typed constants (as 단언 대신 타입 안전) ---

const SAFE: ConfusionLevel = 'safe';
const WARN: ConfusionLevel = 'warn';
const DANGER: ConfusionLevel = 'danger';

// --- Enriched constant type ---

/**
 * 후처리된 상수.
 *
 * 주의: 이 타입은 중간 결과물이며, DB constants 테이블에 직접 삽입할 수 없음.
 * DB 적재 시 appliesTo(NOT NULL), versionYear(NOT NULL), pageRef 등
 * 배치 컨텍스트 필드를 별도로 추가해야 함 (db-loader 단계에서 처리).
 */
export interface EnrichedConstant extends KnowledgeContractConstant {
  numeric_value: number | null;
  unit: string | null;
  confusion_level: ConfusionLevel;
  confusion_risk: string | null;
}

// --- Extraction result ---

export interface ConstantsExtractionResult {
  constants: EnrichedConstant[];
  stats: {
    total: number;
    numericParsed: number;
    withUnit: number;
    danger: number;
    warn: number;
    safe: number;
  };
  warnings: string[];
}

// --- Date detection ---

const DATE_PATTERN = /^\d{4}년\s*\d{1,2}월/;

// --- Numeric parsing ---

/** 한국어 수치 표현에서 숫자를 추출. date 카테고리는 null 반환. */
export function parseNumericValue(value: string, category?: string): number | null {
  const trimmed = value.trim();

  // 날짜 카테고리 또는 날짜 패턴 → 숫자 파싱 안 함
  if (category === 'date' || DATE_PATTERN.test(trimmed)) return null;

  // "1/3", "2/5" 같은 분수 (정수 매칭보다 먼저 확인)
  const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  // "65%", "0.20", "1.0115", "20%" 같은 패턴
  const numMatch = trimmed.match(/^[-+]?(\d+\.?\d*|\.\d+)/);
  if (numMatch) {
    const num = parseFloat(numMatch[0]);
    if (Number.isFinite(num)) return num;
  }

  return null;
}

// --- Unit extraction ---

// ORDER MATTERS: 긴 단위가 짧은 접미사보다 먼저 와야 함.
// 예) "만원" before "원", "배수" before "배", "개월" before "개"
const UNIT_PATTERNS: Array<{ pattern: RegExp; unit: string }> = [
  { pattern: /%/, unit: '%' },
  { pattern: /배수/, unit: '배수' },
  { pattern: /배$/, unit: '배' },
  { pattern: /만원/, unit: '만원' },
  { pattern: /원$/, unit: '원' },
  { pattern: /kg/, unit: 'kg' },
  { pattern: /톤/, unit: '톤' },
  { pattern: /ha/, unit: 'ha' },
  { pattern: /㎡/, unit: '㎡' },
  { pattern: /개월/, unit: '개월' },
  { pattern: /주/, unit: '주' },
  { pattern: /일$/, unit: '일' },
  { pattern: /년$/, unit: '년' },
  { pattern: /회$/, unit: '회' },
  { pattern: /시간/, unit: '시간' },
  { pattern: /개$/, unit: '개' },
  { pattern: /본$/, unit: '본' },
  { pattern: /그루/, unit: '그루' },
];

export function extractUnit(value: string): string | null {
  const trimmed = value.trim();
  for (const { pattern, unit } of UNIT_PATTERNS) {
    if (pattern.test(trimmed)) return unit;
  }
  return null;
}

// --- Confusion level tagging ---

/**
 * confusion_level 자동 태깅 (휴리스틱).
 *
 * 기준:
 * - danger: 동일 카테고리 내 수치 차이 ≤ 10%
 * - warn: 동일 카테고리 내 유사한 수치 존재 (차이 ≤ 30%)
 * - safe: 단독 수치 (카테고리 내 혼동 위험 낮음)
 *
 * 참고: 설계서 예시에서 단감 1.0115 vs 떫은감 0.9662(4.5%)는 "warn"으로
 * 분류되어 있으나, 현재 임계값으로는 "danger"가 됨.
 * 이는 자동 태깅의 한계이며, 최종 confusion_level은 인간 검수(QG) 시 조정 가능.
 */
export function tagConfusionLevels(
  constants: Array<{
    numeric_value: number | null;
    category: string;
    name: string;
  }>,
): Array<{ confusion_level: ConfusionLevel; confusion_risk: string | null }> {
  return constants.map((target, i) => {
    if (target.numeric_value == null) {
      return { confusion_level: SAFE, confusion_risk: null };
    }

    let closestDiff = Infinity;
    let closestName: string | null = null;

    for (let j = 0; j < constants.length; j++) {
      if (i === j) continue;
      const other = constants[j];
      if (other.numeric_value == null) continue;
      if (other.category !== target.category) continue;

      const diff = relativeDifference(target.numeric_value, other.numeric_value);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestName = other.name;
      }
    }

    if (closestDiff <= 0.1) {
      return {
        confusion_level: DANGER,
        confusion_risk: `${closestName} (차이 ${(closestDiff * 100).toFixed(1)}%)`,
      };
    }
    if (closestDiff <= 0.3) {
      return {
        confusion_level: WARN,
        confusion_risk: `${closestName} (차이 ${(closestDiff * 100).toFixed(1)}%)`,
      };
    }

    return { confusion_level: SAFE, confusion_risk: null };
  });
}

/**
 * 두 수치의 상대 차이 (0~1).
 * max(|a|, |b|) 기준. 둘 다 0이면 0.
 * 한쪽이 0이면 100% 차이 반환 — 0 vs N은 항상 safe (의도적).
 */
function relativeDifference(a: number, b: number): number {
  if (a === b) return 0;
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (max === 0) return 0;
  return Math.abs(a - b) / max;
}

// --- Main entry point ---

export function enrichConstants(
  rawConstants: KnowledgeContractConstant[],
): ConstantsExtractionResult {
  const warnings: string[] = [];

  // 1. Parse numeric values + extract units (per-constant 에러 격리)
  const parsed = rawConstants.map((c) => {
    try {
      if (typeof c.value !== 'string') {
        warnings.push(
          `${c.id ?? 'UNKNOWN'} "${c.name ?? 'UNKNOWN'}": value is not a string (${typeof c.value})`,
        );
        return { ...c, numeric_value: null as number | null, unit: null as string | null };
      }

      const numericValue = parseNumericValue(c.value, c.category);
      const unit = extractUnit(c.value);

      if (numericValue == null && c.category !== 'date') {
        warnings.push(`${c.id} "${c.name}": numeric_value 파싱 실패 (value="${c.value}")`);
      }

      return { ...c, numeric_value: numericValue, unit };
    } catch (err) {
      warnings.push(
        `${c.id ?? 'UNKNOWN'} "${c.name ?? 'UNKNOWN'}": 처리 중 에러 — ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ...c, numeric_value: null as number | null, unit: null as string | null };
    }
  });

  // 2. Tag confusion levels
  const confusionTags = tagConfusionLevels(parsed);

  const enriched: EnrichedConstant[] = parsed.map((c, i) => ({
    ...c,
    confusion_level: confusionTags[i].confusion_level,
    confusion_risk: confusionTags[i].confusion_risk,
  }));

  // 3. Build stats
  const stats = {
    total: enriched.length,
    numericParsed: enriched.filter((c) => c.numeric_value != null).length,
    withUnit: enriched.filter((c) => c.unit != null).length,
    danger: enriched.filter((c) => c.confusion_level === 'danger').length,
    warn: enriched.filter((c) => c.confusion_level === 'warn').length,
    safe: enriched.filter((c) => c.confusion_level === 'safe').length,
  };

  console.warn(
    `[constants-extractor] ${stats.total} constants | ` +
      `parsed=${stats.numericParsed} unit=${stats.withUnit} | ` +
      `danger=${stats.danger} warn=${stats.warn} safe=${stats.safe}`,
  );

  return { constants: enriched, stats, warnings };
}
