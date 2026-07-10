/**
 * PublicPracticeApp — 공개 학습 표면 최상위 island (FE-2~9 조립).
 *
 * 상태 기계: picker → session(모드별 카드 × 세션 길이) → summary → 반복.
 * 진도 = 100% 로컬(local-progress, G-1) — 기록 실패는 학습 흐름을 막지 않되 warn.
 * 서버 = /api/public/* 만(무인증·credentials 없음).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FsrsRating } from '@thepick/srs';
import { getLocalProgressDb, recordReview, requestPersistentStorage } from '@/lib/local-progress';
import { fetchPublicNext } from './api';
import { BlankNote } from './BlankNote';
import { DEFAULT_SESSION_SIZE, PRACTICE_MODE_META } from './constants';
import { FlipDeck } from './FlipDeck';
import { PracticePicker, type PracticeFilter } from './PracticePicker';
import { PublicQuestionCard } from './PublicQuestionCard';
import { PracticeSummary } from './PracticeSummary';
import { StreakPanel } from './StreakPanel';
import { LoadingCard, ErrorPanel } from './StatusPanels';
import { ratingFromBlankGrade, ratingFromMcGrade } from './rating';
import type { AttemptRecord, PracticeMode, PublicQuestion } from './types';

type Phase = 'picker' | 'session' | 'summary';

interface SessionState {
  readonly mode: PracticeMode;
  readonly filter: PracticeFilter;
}

export function PublicPracticeApp() {
  const [phase, setPhase] = useState<Phase>('picker');
  const [session, setSession] = useState<SessionState | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [attempts, setAttempts] = useState<readonly AttemptRecord[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  // 서빙된 문항 id 순환 — 같은 세션 내 즉시 중복 회피(서버는 무상태 랜덤).
  const servedIds = useRef<Set<string>>(new Set());
  // 4-Pass MINOR: 세션 세대 카운터 — 이전 세션의 in-flight /next 응답이 새 세션에
  // 착지(모드 불일치 문항 렌더)하지 않도록 resolve 시 세대 불일치 결과 폐기.
  const sessionGen = useRef(0);

  // 로컬 진도 영속성 — 최초 1회 persist 요청(거부돼도 학습엔 영향 0).
  useEffect(() => {
    requestPersistentStorage().catch((err) => {
      console.warn('[public] persistent storage request failed', err);
    });
  }, []);

  const modeMeta = session === null ? null : PRACTICE_MODE_META.find((m) => m.id === session.mode)!;

  const fetchNext = useCallback(async (s: SessionState): Promise<void> => {
    const gen = sessionGen.current;
    setLoading(true);
    setLoadError(null);
    try {
      // 즉시 중복 회피 — 최대 3회 재시도 후 그대로 수용(풀이 자체가 목적).
      let next: PublicQuestion | null = null;
      for (let i = 0; i < 3; i++) {
        const meta = PRACTICE_MODE_META.find((m) => m.id === s.mode)!;
        const candidate = await fetchPublicNext({
          subject: s.filter.subject,
          round: s.filter.round,
          inputType: meta.inputType,
        });
        next = candidate;
        if (!servedIds.current.has(candidate.id)) break;
      }
      if (gen !== sessionGen.current) return; // 세션 전환 후 도착한 응답 폐기
      if (next !== null) {
        servedIds.current.add(next.id);
        setQuestion(next);
      }
    } catch (err) {
      if (gen !== sessionGen.current) return;
      setLoadError(err);
      setQuestion(null);
    } finally {
      if (gen === sessionGen.current) setLoading(false);
    }
  }, []);

  const startSession = useCallback(
    (mode: PracticeMode, filter: PracticeFilter) => {
      const s: SessionState = { mode, filter };
      sessionGen.current += 1;
      setSession(s);
      setAttempts([]);
      servedIds.current = new Set();
      setPhase('session');
      void fetchNext(s);
    },
    [fetchNext],
  );

  /** 로컬 진도 기록 — 실패해도 학습 흐름 유지(무음 금지: warn). */
  const persistReview = useCallback(
    async (
      cardId: string,
      cardType: 'exam' | 'flip',
      rating: FsrsRating,
      isCorrect: boolean | null,
      subject: string | null,
    ) => {
      try {
        const result = await recordReview(getLocalProgressDb(), {
          cardId,
          cardType,
          rating,
          isCorrect: isCorrect ?? undefined,
          subject: subject ?? undefined,
        });
        setStreakDays(result.streak.currentStreak);
        setProgressKey((k) => k + 1);
      } catch (err) {
        console.warn('[public] local progress record failed', err);
      }
    },
    [],
  );

  const pushAttempt = useCallback((record: AttemptRecord) => {
    setAttempts((prev) => [...prev, record]);
  }, []);

  const advance = useCallback(
    (nextAttemptCount: number) => {
      if (session === null) return;
      if (nextAttemptCount >= DEFAULT_SESSION_SIZE) {
        setPhase('summary');
        setQuestion(null);
        return;
      }
      void fetchNext(session);
    },
    [fetchNext, session],
  );

  // 채점형(4지선다·빵꾸노트) 공통 — 채점 즉시 기록, "다음"은 onNext.
  const handleGraded = useCallback(
    (record: AttemptRecord) => {
      pushAttempt(record);
      const rating =
        session?.mode === 'blank'
          ? ratingFromBlankGrade(record.isCorrect === true, record.hintsUsed)
          : ratingFromMcGrade(record.isCorrect === true);
      void persistReview(record.questionId, 'exam', rating, record.isCorrect, record.subject);
    },
    [persistReview, pushAttempt, session?.mode],
  );

  const handleNext = useCallback(
    (skipped: boolean) => {
      // 건너뜀은 집계 제외 — 채점분만 attempts 에 존재.
      void skipped;
      advance(attempts.length);
    },
    [advance, attempts.length],
  );

  // 카드플립 — 자평 = 기록 + 즉시 다음.
  const handleRated = useCallback(
    (rating: FsrsRating) => {
      if (question === null) return;
      const record: AttemptRecord = {
        questionId: question.id,
        subject: question.subject,
        isCorrect: null,
        hintsUsed: 0,
      };
      pushAttempt(record);
      void persistReview(question.id, 'flip', rating, null, question.subject);
      advance(attempts.length + 1);
    },
    [advance, attempts.length, persistReview, pushAttempt, question],
  );

  const handleSkip = useCallback(() => {
    advance(attempts.length);
  }, [advance, attempts.length]);

  const gradedCount = attempts.length;

  return (
    <div className="space-y-3">
      {phase === 'session' && session !== null && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              sessionGen.current += 1; // in-flight fetch 결과 폐기
              setPhase('picker');
              setQuestion(null);
              setSession(null);
            }}
            className="inline-flex items-center rounded-lg px-2 py-1 text-sm text-gray-500 hover:text-gray-900"
            style={{ minHeight: 44 }}
          >
            ← 모드 선택
          </button>
          <span className="text-sm tabular-nums text-gray-500">
            {modeMeta?.label} · {Math.min(gradedCount + 1, DEFAULT_SESSION_SIZE)} /{' '}
            {DEFAULT_SESSION_SIZE}
          </span>
        </div>
      )}

      {/* 세션 진행 스트립 (claudeDesign C — 얇은 1.5px, gray→indigo) */}
      {phase === 'session' && (
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width]"
            style={{ width: `${Math.min((gradedCount / DEFAULT_SESSION_SIZE) * 100, 100)}%` }}
          />
        </div>
      )}

      {phase === 'picker' && (
        <>
          <PracticePicker onStart={startSession} />
          <StreakPanel refreshKey={progressKey} />
        </>
      )}

      {phase === 'session' && (
        <>
          {loading && <LoadingCard />}
          {!loading && loadError !== null && (
            <ErrorPanel
              error={loadError}
              onRetry={session === null ? null : () => void fetchNext(session)}
            />
          )}
          {!loading && loadError === null && question !== null && session !== null && (
            <>
              {session.mode === 'mc' && (
                <PublicQuestionCard
                  key={question.id}
                  question={question}
                  onGraded={handleGraded}
                  onNext={handleNext}
                />
              )}
              {session.mode === 'blank' && (
                <BlankNote
                  key={question.id}
                  question={question}
                  onGraded={handleGraded}
                  onNext={handleNext}
                />
              )}
              {session.mode === 'flip' && (
                <FlipDeck
                  key={question.id}
                  question={question}
                  onRated={handleRated}
                  onSkip={handleSkip}
                />
              )}
            </>
          )}
        </>
      )}

      {phase === 'summary' && session !== null && (
        <PracticeSummary
          attempts={attempts}
          modeLabel={modeMeta?.label ?? ''}
          streakDays={streakDays}
          onContinue={() => startSession(session.mode, session.filter)}
          onChangeMode={() => {
            setPhase('picker');
            setSession(null);
            setQuestion(null);
          }}
        />
      )}
    </div>
  );
}
