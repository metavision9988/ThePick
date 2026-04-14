/**
 * M28 Content Queue — 검수 워크플로우 UI
 *
 * draft → review → approved → published 상태 전환
 * 인간 검수자가 Graph 노드/엣지의 품질을 확인하고 승인/반려.
 */

import { useState, useMemo } from 'react';
import type { ContentStatus } from '@thepick/shared';
import type { VisNode } from '../types/graph';

const STATUS_ORDER: ContentStatus[] = ['draft', 'review', 'approved', 'published'];

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
  nodes: VisNode[];
  onStatusChange: (nodeId: string, newStatus: ContentStatus) => void;
}

function getNextStatus(current: ContentStatus): ContentStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

export default function ContentQueue({ nodes, onStatusChange }: Props) {
  const [activeTab, setActiveTab] = useState<ContentStatus>('draft');

  const grouped = useMemo(() => {
    const map = new Map<ContentStatus, VisNode[]>();
    for (const status of [...STATUS_ORDER, 'flagged' as ContentStatus]) {
      map.set(status, []);
    }
    for (const node of nodes) {
      const list = map.get(node.status);
      if (list) list.push(node);
    }
    return map;
  }, [nodes]);

  const activeNodes = grouped.get(activeTab) ?? [];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* 탭 바 */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
        {([...STATUS_ORDER, 'flagged'] as ContentStatus[]).map((status) => {
          const count = grouped.get(status)?.length ?? 0;
          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom:
                  activeTab === status
                    ? `3px solid ${STATUS_COLORS[status]}`
                    : '3px solid transparent',
                background: activeTab === status ? '#f1f5f9' : 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === status ? 600 : 400,
              }}
            >
              {STATUS_LABELS[status]} ({count})
            </button>
          );
        })}
      </div>

      {/* 노드 목록 */}
      {activeNodes.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          {STATUS_LABELS[activeTab]} 상태의 항목이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeNodes.map((node) => {
            const next = getNextStatus(node.status);
            return (
              <div
                key={node.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${STATUS_COLORS[node.status]}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>
                    {node.id} — {node.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {node.type} · TW:{node.truthWeight}
                    {node.lv1Insurance && ` · ${node.lv1Insurance}`}
                    {node.lv2Crop && ` / ${node.lv2Crop}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {next && (
                    <button
                      onClick={() => onStatusChange(node.id, next)}
                      style={{
                        padding: '6px 12px',
                        background: STATUS_COLORS[next],
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      → {STATUS_LABELS[next]}
                    </button>
                  )}
                  {node.status !== 'flagged' && (
                    <button
                      onClick={() => onStatusChange(node.id, 'flagged')}
                      style={{
                        padding: '6px 12px',
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      문제 보고
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
