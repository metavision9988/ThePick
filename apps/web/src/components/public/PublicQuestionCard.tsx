/**
 * PublicQuestionCard — 공개 표면 4지선다·단답 풀이 카드 (FE-2).
 *
 * claudeDesign question-card.jsx A 골격(헤더/본문/입력/결과/푸터) 이식.
 * 채점 = 서버 /api/public/grade 전용(정답 클라 비노출·choiceId 불투명 계약).
 * 단축키: 1–5 보기 선택, Ctrl+Enter 채점/다음.
 */

import { useCallback, useEffect, useState } from 'react';
import { gradePublic, PublicApiError } from './api';
import { ChoiceRow, type ChoiceGradeState } from './ChoiceRow';
import { ResultBlock } from './ResultBlock';
import type { AttemptRecord, PublicGradeResult, PublicQuestion } from './types';

interface PublicQuestionCardProps {
  readonly question: PublicQuestion;
  /** 채점 완료 시 1회 — 로컬 진도 기록·세션 집계는 부모 소관. */
  readonly onGraded: (record: AttemptRecord, grade: PublicGradeResult) => void;
  /** 다음 문제 요청(채점 후) 또는 건너뜀(채점 전). */
  readonly onNext: (skipped: boolean) => void;
  /** 랜딩 임베드 — 푸터 "다음" 대신 계속 풀기 링크 노출. */
  readonly embed?: boolean;
}

export function sourceTextOf(q: PublicQuestion): string {
  const parts: string[] = [];
  if (q.round !== null) parts.push(`제${q.round}회`);
  parts.push(`(${q.year})`);
  if (q.questionNumber !== null) parts.push(`문${q.questionNumber}`);
  return parts.join(' ');
}

/** MC 정답 보기 텍스트 해석 — correctChoiceIds → 서빙된 보기 텍스트. */
export function correctChoiceTexts(q: PublicQuestion, grade: PublicGradeResult): string {
  if (q.choices === null || grade.correctChoiceIds === undefined) return grade.correctAnswer;
  const texts = q.choices
    .filter((c) => grade.correctChoiceIds!.includes(c.choiceId))
    .map((c) => c.text);
  return texts.length > 0 ? texts.join(' / ') : grade.correctAnswer;
}

export function PublicQuestionCard({
  question,
  onGraded,
  onNext,
  embed = false,
}: PublicQuestionCardProps) {
  const isMc = question.inputType === 'multiple_choice' && question.choices !== null;
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<PublicGradeResult | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  // 문항 교체 시 입력 상태 초기화.
  useEffect(() => {
    setSelectedChoiceId(null);
    setAnswerText('');
    setGrade(null);
    setGradeError(null);
    setGrading(false);
  }, [question.id]);

  const canGrade =
    grade === null && !grading && (isMc ? selectedChoiceId !== null : answerText.trim() !== '');

  const doGrade = useCallback(async () => {
    if (grade !== null || grading) return;
    if (isMc && selectedChoiceId === null) return;
    if (!isMc && answerText.trim() === '') return;
    setGrading(true);
    setGradeError(null);
    try {
      const result = await gradePublic(
        isMc
          ? { questionId: question.id, choiceId: selectedChoiceId! }
          : { questionId: question.id, answer: answerText.trim() },
      );
      setGrade(result);
      onGraded(
        {
          questionId: question.id,
          subject: question.subject,
          isCorrect: result.isCorrect,
          hintsUsed: 0,
        },
        result,
      );
    } catch (err) {
      setGradeError(
        err instanceof PublicApiError ? err.message : '채점 중 오류가 발생했다. 다시 시도해 보자.',
      );
    } finally {
      setGrading(false);
    }
  }, [answerText, grade, grading, isMc, onGraded, question.id, question.subject, selectedChoiceId]);

  // 단축키: 1–5 선택(MC·채점 전), Ctrl+Enter 채점/다음.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (grade !== null) onNext(false);
        else void doGrade();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // MAJOR-2 동형 가드 — 버튼/링크 포커스 중 숫자 키 선택 개입 금지(키 핸들러 통일).
      if (e.target instanceof HTMLElement && e.target.closest('button, a, select') !== null) {
        return;
      }
      if (!isMc || grade !== null) return;
      const idx = '12345'.indexOf(e.key);
      if (idx >= 0 && question.choices !== null && idx < question.choices.length) {
        e.preventDefault();
        setSelectedChoiceId(question.choices[idx]!.choiceId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doGrade, grade, isMc, onNext, question.choices]);

  function gradeStateOf(choiceId: string): ChoiceGradeState {
    if (grade === null) return 'none';
    const isAnswerChoice = grade.correctChoiceIds?.includes(choiceId) ?? false;
    const isMine = choiceId === selectedChoiceId;
    if (isMine && grade.isCorrect) return 'my-correct';
    if (isMine && !grade.isCorrect) return 'my-wrong';
    // 4-Pass MINOR: 복수정답 문항에서 내가 하나를 맞혀도 나머지 정답 보기에 표식 유지
    // (미표식 = 나머지 정답을 오답으로 학습할 여지 — production 복수정답 6문항 실재).
    if (isAnswerChoice) return 'answer';
    return 'none';
  }

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
      </div>

      {isMc ? (
        <fieldset className="px-5 pb-5">
          <legend className="mb-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            정답 선택{' '}
            <span className="font-mono normal-case text-gray-400">
              1–{question.choices!.length}
            </span>
          </legend>
          <ul className="space-y-2.5">
            {question.choices!.map((c, i) => (
              <ChoiceRow
                key={c.choiceId}
                index={i}
                text={c.text}
                selected={c.choiceId === selectedChoiceId}
                disabled={grade !== null || grading}
                gradeState={gradeStateOf(c.choiceId)}
                onSelect={() => setSelectedChoiceId(c.choiceId)}
              />
            ))}
          </ul>
        </fieldset>
      ) : (
        <div className="border-t border-gray-100 px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              정답 입력
            </span>
            <input
              type="text"
              value={answerText}
              disabled={grade !== null || grading}
              onChange={(e) => setAnswerText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canGrade) void doGrade();
              }}
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[15px] text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
              style={{ minHeight: 44 }}
              placeholder="답을 입력"
            />
          </label>
        </div>
      )}

      {grade !== null && (
        <ResultBlock
          isCorrect={grade.isCorrect}
          correctAnswerText={isMc ? correctChoiceTexts(question, grade) : grade.correctAnswer}
          explanation={grade.explanation}
          sourceText={`${sourceTextOf(question)}${question.subject !== null ? ` · ${question.subject}` : ''}`}
        />
      )}

      {gradeError !== null && (
        <p className="border-t border-gray-100 px-5 py-3 text-sm text-amber-800" role="alert">
          {gradeError}
        </p>
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
        {grade === null ? (
          <>
            <button
              type="button"
              onClick={() => onNext(true)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ minHeight: 44 }}
            >
              건너뜀
            </button>
            <button
              type="button"
              disabled={!canGrade}
              onClick={() => void doGrade()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400"
              style={{ minHeight: 44 }}
            >
              {grading ? '채점 중' : '채점'}
              <span className="font-mono text-[11px] text-indigo-200">⌃Enter</span>
            </button>
          </>
        ) : embed ? (
          <a
            href="/practice/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            style={{ minHeight: 44 }}
          >
            계속 풀기
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onNext(false)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            style={{ minHeight: 44 }}
          >
            다음 문제
            <span className="font-mono text-[11px] text-indigo-200">⌃Enter</span>
          </button>
        )}
      </footer>
    </article>
  );
}
