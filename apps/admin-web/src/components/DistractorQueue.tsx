/**
 * Step 3-UX-7a — distractor 검수 queue list mock UI.
 *
 * status 탭 + 정렬 + 선택된 항목 single DistractorReview 표시.
 * mock seed 한정 — 실 API fetch는 7c chunk.
 */

import { useMemo, useState } from 'react';
import type { ContentStatus } from '@thepick/shared';

import { DistractorReview } from './DistractorReview';
import type {
  DistractorReviewItem,
  DistractorSortKey,
  DistractorUpdatePayload,
} from '../types/distractor';

const STATUS_TABS: ReadonlyArray<ContentStatus> = ['draft', 'review', 'approved', 'flagged'];

const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: '초안',
  review: '검토 중',
  approved: '승인됨',
  published: '게시됨',
  flagged: '문제 있음',
};

interface Props {
  readonly items: ReadonlyArray<DistractorReviewItem>;
}

function sortItems(
  items: ReadonlyArray<DistractorReviewItem>,
  key: DistractorSortKey,
): ReadonlyArray<DistractorReviewItem> {
  const arr = [...items];
  switch (key) {
    case 'confidence-asc':
      arr.sort((a, b) => a.confidence - b.confidence);
      return arr;
    case 'updated-desc':
      arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return arr;
    case 'number-asc':
    default:
      arr.sort((a, b) => a.questionNumber - b.questionNumber);
      return arr;
  }
}

export function DistractorQueue({ items }: Props) {
  const [activeTab, setActiveTab] = useState<ContentStatus>('draft');
  const [sortKey, setSortKey] = useState<DistractorSortKey>('confidence-asc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<DistractorReviewItem[]>([...items]);

  const grouped = useMemo(() => {
    const map = new Map<ContentStatus, DistractorReviewItem[]>();
    for (const s of STATUS_TABS) map.set(s, []);
    for (const it of localItems) {
      const list = map.get(it.status);
      if (list !== undefined) list.push(it);
    }
    return map;
  }, [localItems]);

  const active = sortItems(grouped.get(activeTab) ?? [], sortKey);
  const selected =
    selectedId !== null ? (localItems.find((i) => i.questionId === selectedId) ?? null) : null;

  function handleUpdate(payload: DistractorUpdatePayload): void {
    setLocalItems((prev) =>
      prev.map((it) =>
        it.questionId === payload.questionId
          ? {
              ...it,
              distractors: payload.distractors,
              status: payload.status,
              reviewerNote: payload.reviewerNote,
              updatedAt: new Date().toISOString(),
            }
          : it,
      ),
    );
    // 승인/flag 후 queue 위치 변경 — 선택 해제하여 다음 항목으로 이동 유도
    setSelectedId(null);
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', gap: '2px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {STATUS_TABS.map((s) => {
          const count = grouped.get(s)?.length ?? 0;
          const isActive = activeTab === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setActiveTab(s);
                setSelectedId(null);
              }}
              data-testid={`tab-${s}`}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderBottom: isActive ? '3px solid #4f46e5' : '3px solid transparent',
                background: isActive ? '#f1f5f9' : 'transparent',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                minHeight: '44px',
              }}
            >
              {STATUS_LABELS[s]} ({count})
            </button>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '11px', color: '#64748b' }} htmlFor="distractor-sort">
            정렬
          </label>
          <select
            id="distractor-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as DistractorSortKey)}
            style={{
              padding: '6px 8px',
              fontSize: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              minHeight: '36px',
            }}
          >
            <option value="confidence-asc">신뢰도 낮은 순 (우선 검수)</option>
            <option value="updated-desc">최근 수정 순</option>
            <option value="number-asc">문제 번호 순</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)',
          gap: '16px',
        }}
      >
        <aside
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          {active.length === 0 ? (
            <div
              style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}
            >
              {STATUS_LABELS[activeTab]} 상태 항목이 없습니다.
            </div>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {active.map((it) => (
                <li key={it.questionId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(it.questionId)}
                    data-testid={`queue-item-${it.questionId}`}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: selectedId === it.questionId ? '#eef2ff' : 'transparent',
                      border:
                        selectedId === it.questionId
                          ? '1px solid #c7d2fe'
                          : '1px solid transparent',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      minHeight: '44px',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      {it.examYear} 제{it.examRound}회 · 제{it.questionNumber}문
                    </div>
                    <div style={{ color: '#64748b', marginTop: '2px' }}>
                      신뢰 {Math.round(it.confidence * 100)}% · {it.subject ?? '미분류'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main>
          {selected === null ? (
            <div
              style={{
                background: '#fff',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '60px 20px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              왼쪽에서 검수할 항목을 선택하세요.
            </div>
          ) : (
            <DistractorReview item={selected} onUpdate={handleUpdate} />
          )}
        </main>
      </div>
    </div>
  );
}
