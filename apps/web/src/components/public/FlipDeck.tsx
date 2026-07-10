/**
 * FlipDeck — 카드플립 + FSRS 4단계 자평 (FE-5, 방법론 §M2).
 *
 * 플로우: 앞면(문항·보기)에서 스스로 답 생성 → 플립(Space/탭) → 서버 /reveal 로
 * 정답·해설 수신(뒷면) → 4버튼 자평(모름/애매/알았음/쉬움, 1–4 키·44px 엄지영역)
 * → 부모가 recordReview(cardType 'flip', isCorrect=null) 기록.
 *
 * 하드 룰: 정답은 플립 전에 노출 금지 / 폭죽·트로피 금지 / P4-D3 = MC 문항 지원
 * (라이브 서빙 가능 데이터가 현재 MC 뿐 — 앞면에 보기 동봉, 뒷면에 정답 보기 표식).
 */

import { useCallback, useEffect, useState } from 'react';
import type { FsrsRating } from '@thepick/srs';
import { PublicApiError, revealPublic } from './api';
import { CIRCLED_NUMBERS } from './constants';
import { IconCheck } from './icons';
import { FLIP_RATING_LABELS } from './rating';
import { sourceTextOf } from './PublicQuestionCard';
import type { PublicQuestion, PublicRevealResult } from './types';

interface FlipDeckProps {
  readonly question: PublicQuestion;
  /** 자평 완료 — 부모가 로컬 진도 기록 + 다음 카드 서빙. */
  readonly onRated: (rating: FsrsRating) => void;
  readonly onSkip: () => void;
}

export function FlipDeck({ question, onRated, onSkip }: FlipDeckProps) {
  const [revealed, setRevealed] = useState<PublicRevealResult | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  useEffect(() => {
    setRevealed(null);
    setRevealing(false);
    setRevealError(null);
  }, [question.id]);

  const doFlip = useCallback(async () => {
    if (revealed !== null || revealing) return;
    setRevealing(true);
    setRevealError(null);
    try {
      setRevealed(await revealPublic(question.id));
    } catch (err) {
      setRevealError(
        err instanceof PublicApiError ? err.message : '정답을 불러오지 못했다. 다시 시도해 보자.',
      );
    } finally {
      setRevealing(false);
    }
  }, [question.id, revealed, revealing]);

  // Space = 플립, 1–4 = 자평 (뒷면에서만).
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // 4-Pass MAJOR-2: 버튼/링크 포커스 중엔 표준 키 활성화(Space=클릭)에 개입 금지 —
      // '건너뜀' 포커스 상태에서 Space 가 정답을 강제 공개하던 경로 차단.
      if (e.target instanceof HTMLElement && e.target.closest('button, a, select') !== null) {
        return;
      }
      if (e.key === ' ' && revealed === null) {
        e.preventDefault();
        void doFlip();
        return;
      }
      if (revealed !== null) {
        const idx = '1234'.indexOf(e.key);
        if (idx >= 0) {
          e.preventDefault();
          onRated(FLIP_RATING_LABELS[idx]!.rating);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doFlip, onRated, revealed]);

  const isMc = question.inputType === 'multiple_choice' && question.choices !== null;

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <span className="text-sm text-gray-500">{sourceTextOf(question)}</span>
        {question.subject !== null && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {question.subject}
          </span>
        )}
      </header>

      <div className="px-5 py-5">
        <p className="tp-body whitespace-pre-line text-[15px] text-gray-900">{question.content}</p>

        {isMc && (
          <ul className="mt-4 space-y-2">
            {question.choices!.map((c, i) => {
              const isAnswer =
                revealed !== null && (revealed.correctChoiceIds?.includes(c.choiceId) ?? false);
              return (
                <li
                  key={c.choiceId}
                  className={`flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 ${
                    isAnswer
                      ? 'border-l-2 border-l-emerald-500 bg-emerald-50/40'
                      : 'border-l-2 border-l-transparent bg-white'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs font-medium ${
                      isAnswer
                        ? 'border-emerald-500 text-emerald-700'
                        : 'border-gray-300 text-gray-500'
                    }`}
                  >
                    {CIRCLED_NUMBERS[i] ?? String(i + 1)}
                  </span>
                  <span className="tp-body flex-1 text-[15px] text-gray-900">{c.text}</span>
                  {isAnswer && (
                    <span className="mt-0.5 flex-none text-emerald-700">
                      <IconCheck />
                      <span className="sr-only">정답</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {revealed !== null && (
        <section className="border-t border-gray-100 bg-gray-50 px-5 py-4" aria-live="polite">
          {!isMc && (
            <p className="text-sm text-gray-900">
              정답 <span className="font-medium text-emerald-800">{revealed.correctAnswer}</span>
            </p>
          )}
          <dl className={`grid grid-cols-[52px_1fr] gap-x-3 gap-y-2 ${isMc ? '' : 'mt-3'}`}>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">해설</dt>
            <dd className="tp-body text-sm text-gray-900">
              {revealed.explanation !== undefined && revealed.explanation !== '' ? (
                revealed.explanation
              ) : (
                <span className="text-gray-500">해설 준비 중 — 정답 표식으로 확인하자.</span>
              )}
            </dd>
          </dl>
        </section>
      )}

      {revealError !== null && (
        <p className="border-t border-gray-100 px-5 py-3 text-sm text-amber-800" role="alert">
          {revealError}
        </p>
      )}

      <footer className="border-t border-gray-100 px-5 py-3">
        {revealed === null ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ minHeight: 44 }}
            >
              건너뜀
            </button>
            <button
              type="button"
              onClick={() => void doFlip()}
              disabled={revealing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400"
              style={{ minHeight: 48 }}
            >
              {revealing ? '확인 중' : '정답 확인'}
              <span className="font-mono text-[11px] text-indigo-200">Space</span>
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              얼마나 알고 있었나 <span className="font-mono normal-case text-gray-400">1–4</span>
            </p>
            <div className="grid grid-cols-4 gap-2">
              {FLIP_RATING_LABELS.map(({ rating, label }) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => onRated(rating)}
                  className={`inline-flex items-center justify-center rounded-lg border px-2 py-2.5 text-sm font-medium ${
                    rating === 'good'
                      ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  style={{ minHeight: 44 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </footer>
    </article>
  );
}
