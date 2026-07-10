/**
 * LandingEmbed — 랜딩 인라인 라이브 체험 1문항 (FE-1 B안, P4-D2).
 *
 * 실제 /api/public/questions/next 를 그대로 소비(가짜 UI 금지 — AESTHETIC 신뢰 지표).
 * API 실패·문항 없음 시 섹션 자체가 접힘(정적 랜딩으로 축퇴) — 빈 껍데기 비노출.
 */

import { useCallback, useEffect, useState } from 'react';
import { getLocalProgressDb, recordReview } from '@/lib/local-progress';
import { fetchPublicNext } from './api';
import { PublicQuestionCard } from './PublicQuestionCard';
import { ratingFromMcGrade } from './rating';
import type { AttemptRecord, PublicQuestion } from './types';

export function LandingEmbed() {
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'collapsed'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchPublicNext({ inputType: 'multiple_choice' })
      .then((q) => {
        if (cancelled) return;
        setQuestion(q);
        setState('ready');
      })
      .catch(() => {
        // 미배포·오프라인·빈 풀 전부 — 임베드 접힘(정적 랜딩 축퇴, P4-D2).
        if (!cancelled) setState('collapsed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGraded = useCallback((record: AttemptRecord) => {
    recordReview(getLocalProgressDb(), {
      cardId: record.questionId,
      cardType: 'exam',
      rating: ratingFromMcGrade(record.isCorrect === true),
      isCorrect: record.isCorrect ?? undefined,
      subject: record.subject ?? undefined,
    }).catch((err) => {
      console.warn('[landing] local progress record failed', err);
    });
  }, []);

  if (state === 'collapsed') return null;

  return (
    <section className="mt-10" aria-label="지금 바로 한 문제">
      <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
        지금 바로 한 문제
      </h2>
      <div className="mt-2">
        {state === 'loading' ? (
          <div
            className="h-40 animate-pulse rounded-lg border border-gray-200 bg-white"
            role="status"
            aria-label="문제 불러오는 중"
          />
        ) : (
          question !== null && (
            <PublicQuestionCard
              question={question}
              onGraded={handleGraded}
              onNext={() => {
                window.location.href = '/practice/';
              }}
              embed
            />
          )
        )}
      </div>
    </section>
  );
}
