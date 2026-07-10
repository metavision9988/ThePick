/**
 * StatusPanels — FE-9 상태 4종 (로딩/빈 데이터/에러/오프라인) 공용 패널.
 * 기술 에러 비노출 — PublicApiError.message(단일 매핑 정본)만 표시.
 */

import { PublicApiError } from './api';

export function LoadingCard() {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white px-5 py-6"
      role="status"
      aria-label="문제 불러오는 중"
    >
      <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 space-y-2.5">
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="mt-6 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 w-full animate-pulse rounded-lg bg-gray-50" />
        ))}
      </div>
      <span className="sr-only">문제를 불러오는 중이다</span>
    </div>
  );
}

interface ErrorPanelProps {
  readonly error: unknown;
  readonly onRetry: (() => void) | null;
}

export function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  const isPublicError = error instanceof PublicApiError;
  const message = isPublicError
    ? error.message
    : '일시적인 오류가 발생했다. 잠시 후 다시 시도해 보자.';
  const isEmpty = isPublicError && error.kind === 'no_question';
  const isOffline = isPublicError && error.kind === 'offline';
  const retryAfter = isPublicError ? error.retryAfterSec : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-6 text-center" role="alert">
      <p className="text-sm font-medium text-gray-900">
        {isEmpty ? '풀 수 있는 문제가 없다' : isOffline ? '오프라인' : '잠시 문제가 생겼다'}
      </p>
      <p className="tp-body mt-2 text-sm text-gray-500">
        {message}
        {retryAfter !== null && ` (약 ${retryAfter}초 후)`}
      </p>
      {onRetry !== null && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          style={{ minHeight: 44 }}
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
