/**
 * PracticePicker — 학습 모드·필터 픽커 (FE-3, claudeDesign mode-selector A).
 *
 * 세로 리스트 + 좌측 2px 모드 컬러 보더 + Chevron. 모드 클릭 = 즉시 세션 시작.
 * 과목/회차 필터는 선택(기본 전체) — 값 불일치 시 서버 NO_QUESTION 빈 상태로 정직 강하.
 */

import { useState } from 'react';
import {
  FIRST_EXAM_ROUNDS,
  FIRST_EXAM_SUBJECTS,
  PRACTICE_MODE_META,
  type PracticeModeMeta,
} from './constants';
import { IconChevron } from './icons';
import type { PracticeMode } from './types';

export interface PracticeFilter {
  readonly subject: string | null;
  readonly round: number | null;
}

interface PracticePickerProps {
  readonly onStart: (mode: PracticeMode, filter: PracticeFilter) => void;
}

export function PracticePicker({ onStart }: PracticePickerProps) {
  const [subject, setSubject] = useState<string | null>(null);
  const [round, setRound] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">범위</h2>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="sr-only">과목 선택</span>
            <select
              value={subject ?? ''}
              onChange={(e) => setSubject(e.target.value === '' ? null : e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              style={{ minHeight: 44 }}
            >
              <option value="">전체 과목</option>
              {FIRST_EXAM_SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">회차 선택</span>
            <select
              value={round === null ? '' : String(round)}
              onChange={(e) => setRound(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              style={{ minHeight: 44 }}
            >
              <option value="">전체 회차</option>
              {FIRST_EXAM_ROUNDS.map((r) => (
                <option key={r} value={String(r)}>
                  제{r}회
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          어떻게 학습할까
        </h2>
        <ul className="mt-2 space-y-2.5">
          {PRACTICE_MODE_META.map((m) => (
            <ModeRow key={m.id} meta={m} onClick={() => onStart(m.id, { subject, round })} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ModeRow({
  meta,
  onClick,
}: {
  readonly meta: PracticeModeMeta;
  readonly onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50"
        style={{ minHeight: 44, borderLeft: `2px solid ${meta.color}` }}
      >
        <span className="flex-1">
          <span className={`block text-sm font-medium ${meta.tone}`}>{meta.label}</span>
          <span className="tp-body mt-0.5 block text-sm text-gray-500">{meta.hint}</span>
        </span>
        <span className="flex-none text-gray-400">
          <IconChevron />
        </span>
      </button>
    </li>
  );
}
