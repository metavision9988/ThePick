/**
 * ContextStrip — Step 3-UX-6 LOCK C 통합. 본문 위 inline 출처 strip.
 * 결과 영역(bg-gray-50)의 dl 출처는 always-on 유지 + 본 strip은 학습 시점에도 출처 surface.
 */

import type { SourceCitations } from './types';
import { flattenSourceCitations } from './types';

interface ContextStripProps {
  readonly sourceCitations: SourceCitations;
}

export function ContextStrip({ sourceCitations }: ContextStripProps) {
  const parts = flattenSourceCitations(sourceCitations);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 px-6 pb-2 text-[11px] text-gray-500">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="mr-3 text-gray-300">·</span>}
          {p}
        </span>
      ))}
    </div>
  );
}
