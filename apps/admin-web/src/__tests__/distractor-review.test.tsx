/**
 * DistractorReview + DistractorQueue 회귀 차단 — Step 3-UX-7a.
 *
 * 검증:
 *   - DistractorReview 정답/문제 표시 + 4 textarea + 승인 활성 조건 (allFilled)
 *   - confidence badge 색상/라벨
 *   - textarea 수정 → 승인 시 onUpdate payload 정합
 *   - DistractorQueue status 탭 + 정렬 + 항목 선택 → 검수 → queue 갱신
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DistractorQueue } from '../components/DistractorQueue';
import { DistractorReview } from '../components/DistractorReview';
import { MOCK_DISTRACTOR_ITEMS } from '../types/distractor';
import type { DistractorReviewItem, DistractorUpdatePayload } from '../types/distractor';

afterEach(() => {
  cleanup();
});

const SAMPLE: DistractorReviewItem = MOCK_DISTRACTOR_ITEMS[0]!;

describe('DistractorReview', () => {
  it('정답 + 문제 본문 + 4 distractor textarea를 표시한다', () => {
    const onUpdate = vi.fn();
    render(<DistractorReview item={SAMPLE} onUpdate={onUpdate} />);

    expect(screen.getByText(/2024년 제10회 1차 · 제1문/)).toBeInTheDocument();
    expect(screen.getByText(SAMPLE.questionContent)).toBeInTheDocument();
    expect(screen.getByText(SAMPLE.correctAnswer)).toBeInTheDocument();

    // 4 distractor textarea (오답 1~4) + 검수 메모 1 = 5 textarea
    const textareas = screen.getAllByRole('textbox');
    expect(textareas.length).toBe(5);
  });

  it('confidence 0.92 → "신뢰 高" badge', () => {
    const onUpdate = vi.fn();
    render(<DistractorReview item={SAMPLE} onUpdate={onUpdate} />);
    const badge = screen.getByTestId('confidence-badge');
    expect(badge).toHaveTextContent('신뢰 高');
    expect(badge).toHaveTextContent('92%');
  });

  it('confidence 0.78 → "신뢰 低 (우선 검수)" badge', () => {
    const lowConf = { ...SAMPLE, confidence: 0.78 };
    const onUpdate = vi.fn();
    render(<DistractorReview item={lowConf} onUpdate={onUpdate} />);
    const badge = screen.getByTestId('confidence-badge');
    expect(badge).toHaveTextContent('신뢰 低');
    expect(badge).toHaveTextContent('78%');
  });

  it('빈 distractor 있으면 승인 버튼 비활성', () => {
    const empty: DistractorReviewItem = {
      ...SAMPLE,
      distractors: ['보기 1', '', '보기 3', '보기 4'],
    };
    const onUpdate = vi.fn();
    render(<DistractorReview item={empty} onUpdate={onUpdate} />);
    const approveBtn = screen.getByRole('button', { name: '승인 (approved)' });
    expect(approveBtn).toBeDisabled();
  });

  it('승인 클릭 시 onUpdate payload에 distractors + approved + reviewerNote 정합', () => {
    const onUpdate = vi.fn();
    render(<DistractorReview item={SAMPLE} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: '승인 (approved)' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const payload = onUpdate.mock.calls[0]![0] as DistractorUpdatePayload;
    expect(payload.questionId).toBe(SAMPLE.questionId);
    expect(payload.status).toBe('approved');
    expect(payload.distractors).toHaveLength(4);
    expect(payload.distractors).toEqual(SAMPLE.distractors);
    expect(payload.reviewerNote).toBeNull(); // 메모 미입력
  });

  it('distractor textarea 수정 후 승인 → payload에 수정된 내용 반영', () => {
    const onUpdate = vi.fn();
    render(<DistractorReview item={SAMPLE} onUpdate={onUpdate} />);

    const textareas = screen.getAllByRole('textbox');
    // 첫 번째 distractor textarea (검수 메모는 5번째)
    fireEvent.change(textareas[0]!, { target: { value: '수정된 오답 1' } });

    fireEvent.click(screen.getByRole('button', { name: '승인 (approved)' }));

    const payload = onUpdate.mock.calls[0]![0] as DistractorUpdatePayload;
    expect(payload.distractors[0]).toBe('수정된 오답 1');
    expect(payload.distractors[1]).toBe(SAMPLE.distractors[1]);
  });

  it('문제 보고 클릭 시 status=flagged payload', () => {
    const onUpdate = vi.fn();
    render(<DistractorReview item={SAMPLE} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: '문제 보고 (flagged)' }));

    const payload = onUpdate.mock.calls[0]![0] as DistractorUpdatePayload;
    expect(payload.status).toBe('flagged');
  });
});

describe('DistractorQueue', () => {
  it('status 탭 count 정합 (mock seed: draft 2 / review 1 / approved 0 / flagged 0)', () => {
    render(<DistractorQueue items={MOCK_DISTRACTOR_ITEMS} />);

    expect(screen.getByTestId('tab-draft')).toHaveTextContent('초안 (2)');
    expect(screen.getByTestId('tab-review')).toHaveTextContent('검토 중 (1)');
    expect(screen.getByTestId('tab-approved')).toHaveTextContent('승인됨 (0)');
    expect(screen.getByTestId('tab-flagged')).toHaveTextContent('문제 있음 (0)');
  });

  it('draft 탭에서 항목 선택 → DistractorReview 표시', () => {
    render(<DistractorQueue items={MOCK_DISTRACTOR_ITEMS} />);

    // 기본 selection 없음 — placeholder 표시
    expect(screen.getByText(/검수할 항목을 선택하세요/)).toBeInTheDocument();

    // draft 탭의 q-2024-10-1-002 (confidence 0.78이라 confidence-asc 정렬 시 첫 항목) 선택
    fireEvent.click(screen.getByTestId('queue-item-q-2024-10-1-002'));

    expect(screen.queryByText(/검수할 항목을 선택하세요/)).not.toBeInTheDocument();
    // 본문 일부 확인
    expect(screen.getByText(/재해보험요율 산정/)).toBeInTheDocument();
  });

  it('정렬: confidence-asc (기본) → 0.78 항목이 0.92보다 위', () => {
    render(<DistractorQueue items={MOCK_DISTRACTOR_ITEMS} />);

    // draft 탭의 queue 항목 순서 — confidence-asc 기본
    const items = screen.getAllByTestId(/queue-item-/);
    // 첫 두 draft 항목: 0.78 먼저, 0.92 다음
    expect(items[0]).toHaveAttribute('data-testid', 'queue-item-q-2024-10-1-002');
    expect(items[1]).toHaveAttribute('data-testid', 'queue-item-q-2024-10-1-001');
  });

  it('승인 후 항목이 draft → approved 탭으로 이동', () => {
    render(<DistractorQueue items={MOCK_DISTRACTOR_ITEMS} />);

    fireEvent.click(screen.getByTestId('queue-item-q-2024-10-1-001'));
    fireEvent.click(screen.getByRole('button', { name: '승인 (approved)' }));

    // queue 갱신 — draft 2→1, approved 0→1
    expect(screen.getByTestId('tab-draft')).toHaveTextContent('초안 (1)');
    expect(screen.getByTestId('tab-approved')).toHaveTextContent('승인됨 (1)');

    // approved 탭 전환 시 해당 항목 노출
    fireEvent.click(screen.getByTestId('tab-approved'));
    expect(screen.getByTestId('queue-item-q-2024-10-1-001')).toBeInTheDocument();
  });
});
