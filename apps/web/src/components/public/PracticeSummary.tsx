/**
 * PracticeSummary — 세션 요약 + 결과 공유 (FE-8, claudeDesign session-summary A).
 *
 * 정답률 hero + 과목별 분해 + 스트릭 → canvas 공유 이미지(lib/share-image).
 * 격려·과장 카피 금지("잘했어요!" 류) — 수치로만 말한다.
 */

import { useEffect, useRef, useState } from 'react';
import { drawShareCard, canvasToPngBlob, shareOrDownload } from '@/lib/share-image';
import { IconArrowRight, IconFlame } from './icons';
import type { AttemptRecord } from './types';

interface PracticeSummaryProps {
  readonly attempts: readonly AttemptRecord[];
  readonly modeLabel: string;
  readonly streakDays: number;
  readonly onContinue: () => void;
  readonly onChangeMode: () => void;
}

interface SubjectStat {
  readonly subject: string;
  readonly correct: number;
  readonly total: number;
}

function subjectStats(attempts: readonly AttemptRecord[]): readonly SubjectStat[] {
  const map = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    if (a.isCorrect === null) continue;
    const key = a.subject ?? '기타';
    const cur = map.get(key) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    map.set(key, cur);
  }
  return [...map.entries()].map(([subject, s]) => ({ subject, ...s }));
}

export function PracticeSummary({
  attempts,
  modeLabel,
  streakDays,
  onContinue,
  onChangeMode,
}: PracticeSummaryProps) {
  const graded = attempts.filter((a) => a.isCorrect !== null);
  const correct = graded.filter((a) => a.isCorrect === true).length;
  const total = graded.length;
  const rated = attempts.length - graded.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : null;
  const stats = subjectStats(attempts);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shareState, setShareState] = useState<
    'idle' | 'busy' | 'shared' | 'downloaded' | 'failed'
  >('idle');
  const siteUrl = (import.meta.env.SITE ?? 'https://thepick-study.pages.dev').replace(/\/$/, '');

  // 공유 카드 미리보기 렌더 (실제 생성물 그대로 — 가짜 UI 금지).
  useEffect(() => {
    if (canvasRef.current === null || total === 0) return;
    drawShareCard(canvasRef.current, {
      correct,
      total,
      streakDays,
      modeLabel,
      siteUrl: siteUrl.replace(/^https?:\/\//, ''),
    });
  }, [correct, modeLabel, siteUrl, streakDays, total]);

  async function doShare(): Promise<void> {
    if (canvasRef.current === null || shareState === 'busy') return;
    setShareState('busy');
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      if (blob === null) {
        setShareState('failed');
        return;
      }
      const how = await shareOrDownload(blob, 'thepick-result.png');
      setShareState(how);
    } catch (err) {
      // 4-Pass MINOR: File 생성·다운로드 폴백 예외 시 'busy' 고착(버튼 영구 잠금) 차단.
      console.warn('[public] share image failed', err);
      setShareState('failed');
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-gray-200 bg-white px-5 py-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">세션 완료</h2>
        {pct !== null ? (
          <>
            <p className="tp-tight mt-2">
              <span className="text-[40px] font-medium tabular-nums text-indigo-600">{pct}%</span>
              <span className="ml-2 text-sm tabular-nums text-gray-500">
                {correct} / {total} 정답
              </span>
            </p>
          </>
        ) : (
          <p className="tp-body mt-2 text-sm text-gray-500">
            채점된 문제가 없다. 카드 자평 {rated}건을 기록했다.
          </p>
        )}
        {rated > 0 && pct !== null && (
          <p className="mt-1 text-sm text-gray-500">카드 자평 {rated}건 별도 기록</p>
        )}
        {streakDays > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-700">
            <span className="text-amber-700">
              <IconFlame />
            </span>
            {streakDays}일 연속 학습
          </p>
        )}
      </section>

      {stats.length > 1 && (
        <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">과목별</h3>
          <ul className="mt-2 divide-y divide-gray-100">
            {stats.map((s) => (
              <li key={s.subject} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-gray-900">{s.subject}</span>
                <span className="text-sm tabular-nums text-gray-500">
                  {s.correct} / {s.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {total > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">결과 공유</h3>
          <canvas
            ref={canvasRef}
            className="mt-3 w-full rounded-lg border border-gray-100"
            aria-label="세션 결과 공유 이미지 미리보기"
          />
          <button
            type="button"
            onClick={() => void doShare()}
            disabled={shareState === 'busy'}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
            style={{ minHeight: 44 }}
          >
            {shareState === 'busy'
              ? '이미지 생성 중'
              : shareState === 'downloaded'
                ? '이미지 저장됨 — 다시 저장'
                : shareState === 'shared'
                  ? '공유됨 — 다시 공유'
                  : shareState === 'failed'
                    ? '생성 실패 — 다시 시도'
                    : '이미지로 공유'}
          </button>
        </section>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onChangeMode}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          style={{ minHeight: 48 }}
        >
          모드 바꾸기
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          style={{ minHeight: 48 }}
        >
          더 풀기
          <IconArrowRight />
        </button>
      </div>
    </div>
  );
}
