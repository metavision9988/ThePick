/**
 * PublicQuestionCard — 정오 표시 계약 렌더 테스트 (정답 안전 = Hard Stop 조건).
 *
 * 검증: 채점 후 내 답/정답 표식이 서버 correctChoiceIds 기준으로 정확히 붙는가 +
 * 정답 보기 텍스트 치환(correctChoiceTexts).
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicQuestionCard, correctChoiceTexts } from '../PublicQuestionCard';
import type { PublicGradeResult, PublicQuestion } from '../types';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, gradePublic: vi.fn() };
});

import { gradePublic } from '../api';

const QUESTION: PublicQuestion = {
  id: 'q-1',
  year: 2019,
  round: 5,
  questionNumber: 3,
  subject: '상법 보험편',
  content: '보험계약에 관한 설명으로 옳지 않은 것은?',
  examType: '1st',
  inputType: 'multiple_choice',
  choices: [
    { choiceId: 'cid-a', text: '보기 A' },
    { choiceId: 'cid-b', text: '보기 B' },
    { choiceId: 'cid-c', text: '보기 C' },
    { choiceId: 'cid-d', text: '보기 D' },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('correctChoiceTexts', () => {
  it('correctChoiceIds → 서빙 보기 텍스트 치환(위치라벨 원문 비노출)', () => {
    const grade: PublicGradeResult = {
      isCorrect: false,
      correctAnswer: '3',
      correctChoiceIds: ['cid-c'],
    };
    expect(correctChoiceTexts(QUESTION, grade)).toBe('보기 C');
  });

  it('매칭 실패 시 correctAnswer 폴백(무음 빈 문자열 금지)', () => {
    const grade: PublicGradeResult = {
      isCorrect: false,
      correctAnswer: '3',
      correctChoiceIds: ['cid-unknown'],
    };
    expect(correctChoiceTexts(QUESTION, grade)).toBe('3');
  });
});

describe('PublicQuestionCard — MC 채점 플로우', () => {
  it('오답 선택 → 내 답 amber(X) + 정답 emerald(Check) + 오답 Pill', async () => {
    vi.mocked(gradePublic).mockResolvedValue({
      isCorrect: false,
      correctAnswer: '3',
      correctChoiceIds: ['cid-c'],
    });
    const onGraded = vi.fn();
    const user = userEvent.setup();
    render(<PublicQuestionCard question={QUESTION} onGraded={onGraded} onNext={() => {}} />);

    await user.click(screen.getByText('보기 B'));
    await user.click(screen.getByRole('button', { name: /채점/ }));

    await waitFor(() => expect(screen.getByText('오답')).toBeInTheDocument());
    // 정답 표식 + 내 오답 표식 (sr-only 라벨로 검증)
    expect(screen.getByText('정답', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('내가 고른 오답')).toBeInTheDocument();
    // 정답 텍스트 치환 노출
    expect(screen.getByText('보기 C', { selector: 'span.font-medium' })).toBeInTheDocument();
    expect(onGraded).toHaveBeenCalledTimes(1);
    expect(onGraded.mock.calls[0]![0]).toMatchObject({
      questionId: 'q-1',
      isCorrect: false,
      hintsUsed: 0,
    });
    expect(vi.mocked(gradePublic)).toHaveBeenCalledWith({ questionId: 'q-1', choiceId: 'cid-b' });
  });

  it('정답 선택 → 정답 Pill + onGraded(isCorrect=true) + 다음 문제 버튼', async () => {
    vi.mocked(gradePublic).mockResolvedValue({
      isCorrect: true,
      correctAnswer: '2',
      correctChoiceIds: ['cid-b'],
    });
    const onGraded = vi.fn();
    const user = userEvent.setup();
    render(<PublicQuestionCard question={QUESTION} onGraded={onGraded} onNext={() => {}} />);

    await user.click(screen.getByText('보기 B'));
    await user.click(screen.getByRole('button', { name: /채점/ }));

    await waitFor(() =>
      expect(screen.getByText('정답', { selector: 'span.rounded-full' })).toBeInTheDocument(),
    );
    expect(onGraded.mock.calls[0]![0]).toMatchObject({ isCorrect: true });
    expect(screen.getByRole('button', { name: /다음 문제/ })).toBeInTheDocument();
  });

  it('보기 미선택 시 채점 버튼 비활성', () => {
    render(<PublicQuestionCard question={QUESTION} onGraded={() => {}} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: /채점/ })).toBeDisabled();
  });
});
