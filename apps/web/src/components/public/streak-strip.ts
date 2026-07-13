/**
 * streak-strip — StreakPanel 30일 dot strip 순수 계산 (5-페르소나 D-29 hardening).
 *
 * 컴포넌트 파일(StreakPanel.tsx)에서 분리 + 단위 테스트 커버리지 부여(기존 0) +
 * 채점마다 studiedDates map / todayCount filter 이중 순회 → 단일 순회로 통합.
 * (reviews 재조회 자체는 최근 31일 유계 — 유계 재조회는 수용, 인메모리 중복 제거)
 */
import { todayDateString } from '@thepick/learning-modes';

/** 하루 밀리초 — 조회 컷오프(StreakPanel)와 버킷 스텝(여기)이 동일 정의 공유(4-Pass MINOR: 이중선언 드리프트 차단). */
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface StreakStrip {
  /** 오래된 날 → 오늘 순 stripDays 칸, 각 칸 학습일 여부. */
  readonly days: readonly boolean[];
  /** 오늘(KST) 학습 횟수. */
  readonly todayCount: number;
}

/**
 * reviewedAt(ISO) 목록 + 기준 시각 `now` → 최근 `stripDays` 일 학습 스트립 + 오늘 카운트.
 * reviewedAt 별 KST 날짜를 단일 순회로 버킷팅(studiedDates Set)하며 todayCount 동시 집계.
 */
export function buildStreakStrip(
  reviewedAts: readonly string[],
  now: Date,
  stripDays: number,
): StreakStrip {
  const today = todayDateString(now);
  const studiedDates = new Set<string>();
  let todayCount = 0;
  for (const iso of reviewedAts) {
    // 손상 reviewedAt(import 경유 오염 등) 1건이 스트립 전체를 throw(new Date(NaN).toISOString RangeError)
    // → 패널 전면 은닉으로 degrade 되지 않도록 해당 레코드만 스킵(4-Pass MINOR).
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) continue;
    const date = todayDateString(parsed);
    studiedDates.add(date);
    if (date === today) todayCount += 1;
  }

  const days: boolean[] = [];
  for (let i = stripDays - 1; i >= 0; i--) {
    days.push(studiedDates.has(todayDateString(new Date(now.getTime() - i * DAY_MS))));
  }
  return { days, todayCount };
}
