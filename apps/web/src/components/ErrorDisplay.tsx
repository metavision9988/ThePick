import { useTranslation } from '@/i18n';
import type { ErrorCode } from '@thepick/shared';

const errorCodeToKey: Record<string, string> = {
  NETWORK_ERROR: 'errors.networkError',
  NOT_FOUND: 'errors.notFound',
  INTERNAL_ERROR: 'errors.serverError',
  VALIDATION_ERROR: 'errors.validationError',
  TIMEOUT: 'errors.timeout',
};

interface ErrorDisplayProps {
  code?: ErrorCode | string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ code, message, onRetry }: ErrorDisplayProps) {
  const { t } = useTranslation();

  const translationKey = code ? errorCodeToKey[code] : undefined;
  const displayMessage = translationKey
    ? t(translationKey as Parameters<typeof t>[0])
    : (message ?? t('errors.generic'));

  return (
    <div role="alert" className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-800">{displayMessage}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
