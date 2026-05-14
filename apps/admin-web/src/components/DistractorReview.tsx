/**
 * Step 3-UX-7a — distractor 검수 단일 항목 mock UI.
 *
 * 진산 검수 워크플로우:
 *   1. left 패널: 문제 본문 + 정답 표시 (read-only 컨텍스트)
 *   2. right 패널: 4 distractor textarea (수정 가능) + 검수 메모 + status 액션
 *
 * 본 컴포넌트는 mock 한정 — onUpdate callback만 호출. 실 API PUT은 7c chunk.
 *
 * AESTHETIC §3.3 typography + §3.5 44px+ 터치 타겟 정합 (모바일 admin 검수 가능성).
 */

import { useState } from 'react';
import type { DistractorReviewItem, DistractorUpdatePayload } from '../types/distractor';
import type { ContentStatus } from '@thepick/shared';

const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: '초안',
  review: '검토 중',
  approved: '승인됨',
  published: '게시됨',
  flagged: '문제 있음',
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  draft: '#fbbf24',
  review: '#60a5fa',
  approved: '#34d399',
  published: '#10b981',
  flagged: '#ef4444',
};

interface Props {
  readonly item: DistractorReviewItem;
  readonly onUpdate: (payload: DistractorUpdatePayload) => void;
}

const DISTRACTOR_COUNT = 4;

function confidenceBadge(confidence: number): { label: string; color: string } {
  if (confidence >= 0.9) return { label: '신뢰 高', color: '#10b981' };
  if (confidence >= 0.8) return { label: '신뢰 중', color: '#f59e0b' };
  return { label: '신뢰 低 (우선 검수)', color: '#ef4444' };
}

export function DistractorReview({ item, onUpdate }: Props) {
  // 길이 보정 — DistractorReviewItem.distractors는 4개여야 정합. 부족 시 빈 문자열로 채움.
  const initialDistractors: string[] = (() => {
    const arr = [...item.distractors];
    while (arr.length < DISTRACTOR_COUNT) arr.push('');
    return arr.slice(0, DISTRACTOR_COUNT);
  })();

  const [distractors, setDistractors] = useState<string[]>(initialDistractors);
  const [reviewerNote, setReviewerNote] = useState<string>(item.reviewerNote ?? '');
  const [currentStatus, setCurrentStatus] = useState<ContentStatus>(item.status);

  const allFilled = distractors.every((d) => d.trim() !== '');
  const conf = confidenceBadge(item.confidence);

  function handleDistractorChange(idx: number, value: string): void {
    const next = [...distractors];
    next[idx] = value;
    setDistractors(next);
  }

  function handleAction(nextStatus: ContentStatus): void {
    onUpdate({
      questionId: item.questionId,
      distractors,
      status: nextStatus,
      reviewerNote: reviewerNote.trim() === '' ? null : reviewerNote.trim(),
    });
    setCurrentStatus(nextStatus);
  }

  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: '24px',
        padding: '20px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        borderLeft: `4px solid ${STATUS_COLORS[currentStatus]}`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <section>
        <header style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {item.examYear}년 제{item.examRound}회 {item.examType === '1st' ? '1차' : '2차'} · 제
              {item.questionNumber}문
            </span>
            {item.subject !== null && (
              <span
                style={{
                  background: '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#475569',
                }}
              >
                {item.subject}
              </span>
            )}
            <span
              data-testid="confidence-badge"
              style={{
                background: conf.color,
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {conf.label} ({Math.round(item.confidence * 100)}%)
            </span>
          </div>
        </header>

        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.6,
            color: '#0f172a',
            whiteSpace: 'pre-wrap',
            marginBottom: '16px',
          }}
        >
          {item.questionContent}
        </p>

        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '12px',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
            정답
          </div>
          <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>
            {item.correctAnswer}
          </div>
        </div>

        <details style={{ marginTop: '8px' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: '12px',
              color: '#475569',
              padding: '4px 0',
            }}
          >
            원본 5지 raw 추출 ({item.originalChoices.length}건)
          </summary>
          <ul style={{ marginTop: '6px', paddingLeft: '20px', fontSize: '12px', color: '#64748b' }}>
            {item.originalChoices.map((c, i) => (
              <li key={i} style={{ lineHeight: 1.5 }}>
                {c}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section>
        <header style={{ marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
            오답 후보 검수 (정답 제외 4건)
          </h3>
          <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            BATCH 추출 결과를 수정하거나 그대로 승인하세요.
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {distractors.map((d, idx) => (
            <label key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                오답 {idx + 1}
              </span>
              <textarea
                value={d}
                onChange={(e) => handleDistractorChange(idx, e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  resize: 'vertical',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                }}
              />
            </label>
          ))}
        </div>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}
        >
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            검수 메모 (선택)
          </span>
          <textarea
            value={reviewerNote}
            onChange={(e) => setReviewerNote(e.target.value)}
            rows={2}
            placeholder="예: 정답지 cross-check 정합, 표 형식 변형 주의..."
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '12px',
              fontFamily: 'inherit',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              resize: 'vertical',
              minHeight: '44px',
              boxSizing: 'border-box',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            data-testid="current-status"
            style={{
              background: STATUS_COLORS[currentStatus],
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {STATUS_LABELS[currentStatus]}
          </span>
          <button
            type="button"
            onClick={() => handleAction('approved')}
            disabled={!allFilled || currentStatus === 'approved'}
            style={{
              padding: '8px 16px',
              background: allFilled && currentStatus !== 'approved' ? '#10b981' : '#cbd5e1',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: allFilled && currentStatus !== 'approved' ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: 600,
              minHeight: '44px',
            }}
          >
            승인 (approved)
          </button>
          <button
            type="button"
            onClick={() => handleAction('flagged')}
            disabled={currentStatus === 'flagged'}
            style={{
              padding: '8px 16px',
              background: currentStatus !== 'flagged' ? '#fef2f2' : '#f1f5f9',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              cursor: currentStatus !== 'flagged' ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: 600,
              minHeight: '44px',
            }}
          >
            문제 보고 (flagged)
          </button>
        </div>
      </section>
    </article>
  );
}
