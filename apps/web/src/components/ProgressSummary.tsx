/**
 * ProgressSummary — /study 페이지 좌측 narrow sidebar.
 *
 * GET /api/progress/summary 호출 → 시도 / 정답 / 정확도 surface.
 * Phase 2 Eval MVP 단순화: FSRS 미적용, 단일 합계만.
 */

import { useEffect, useState } from 'react';
import { EXAM_IDS } from '@thepick/shared';

const API_BASE: string = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';
const EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

interface SummaryResponse {
  readonly totalCards: number;
  readonly totalReviews: number;
  readonly correctCount: number;
  readonly accuracy: number;
}

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ok'; readonly data: SummaryResponse };

export function ProgressSummary() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let aborted = false;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/progress/summary?examId=${EXAM_ID}`, {
          credentials: 'include',
        });
        if (aborted) return;
        if (res.status === 401) {
          setState({ status: 'unauthenticated' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', message: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as SummaryResponse;
        setState({ status: 'ok', data });
      } catch (err) {
        if (aborted) return;
        console.error('summary fetch failed', err);
        setState({ status: 'error', message: '네트워크 오류' });
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <div className="text-xs text-gray-400">진도 로딩…</div>;
  }
  if (state.status === 'unauthenticated') {
    return <div className="text-xs text-gray-400">로그인 필요</div>;
  }
  if (state.status === 'error') {
    return <div className="text-xs text-red-600">진도 조회 실패</div>;
  }
  const { totalCards, totalReviews, correctCount, accuracy } = state.data;
  const accuracyPct = Math.round(accuracy * 100);
  return (
    <dl className="space-y-3 text-xs">
      <div>
        <dt className="text-gray-500">시도한 문제</dt>
        <dd className="mt-0.5 text-base font-medium text-gray-900">{totalCards}</dd>
      </div>
      <div>
        <dt className="text-gray-500">전체 시도</dt>
        <dd className="mt-0.5 text-base font-medium text-gray-900">{totalReviews}</dd>
      </div>
      <div>
        <dt className="text-gray-500">정답</dt>
        <dd className="mt-0.5 text-base font-medium text-gray-900">{correctCount}</dd>
      </div>
      <div className="border-t border-gray-100 pt-3">
        <dt className="text-gray-500">정확도</dt>
        <dd className="mt-0.5 text-base font-medium text-indigo-600">{accuracyPct}%</dd>
      </div>
    </dl>
  );
}
