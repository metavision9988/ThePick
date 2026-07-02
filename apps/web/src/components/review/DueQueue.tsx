/**
 * DueQueue — WS-5c FSRS due 소비 경로 1차 (복습 큐 sidebar 위젯).
 *
 * GET /api/progress/due 의 첫 web 소비자: due 카운트 + 학습 진입 CTA.
 * ★ 정직성: /study/next 는 아직 due 우선 정렬을 하지 않는다 (즉시 반영 vs 별도
 *   복습 모드 = PITR `docs/plans/ws-5c-study-next-due-pitr.md` 진산 결재 대기).
 *   따라서 CTA 라벨은 "학습 시작"(일반 진입)이며 "복습 시작"을 참칭하지 않는다.
 *
 * i18n: 자체 I18nProvider 래핑 (독립 island — ErrorDisplay 패턴 정합, 신규 코드
 * 한국어 하드코딩 금지 원칙).
 */

import { useEffect, useState } from 'react';

import { I18nProvider, getInitialLocale } from '@/i18n/context';
import { useTranslation } from '@/i18n/hooks/use-translation';
import { fetchDueQueue, StudyApiError } from '@/lib/study-api';

type DueState =
  | { readonly status: 'loading' }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly count: number };

function DueQueueInner() {
  const { t } = useTranslation();
  const [state, setState] = useState<DueState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchDueQueue();
        if (!cancelled) setState({ status: 'loaded', count: res.count });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof StudyApiError && err.kind === 'unauthenticated') {
          // sidebar 위젯은 로그인 강제 redirect 를 트리거하지 않는다 (페이지 주 흐름이 처리).
          setState({ status: 'unauthenticated' });
          return;
        }
        setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'unauthenticated') {
    return null;
  }

  return (
    <section
      aria-label={t('learning.due')}
      className="rounded-lg border border-gray-200 bg-white px-4 py-3"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {t('learning.due')}
      </p>
      {state.status === 'loading' && (
        <p className="mt-2 text-xs text-gray-400">{t('common.loading')}</p>
      )}
      {state.status === 'error' && (
        <p className="mt-2 text-xs text-gray-400">{t('errors.generic')}</p>
      )}
      {state.status === 'loaded' &&
        (state.count === 0 ? (
          <p className="mt-2 text-xs text-gray-400">{t('learning.dueEmpty')}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-900">
              <span className="text-xl font-medium tabular-nums text-indigo-600">
                {state.count}
              </span>
              <span className="ml-1.5 text-xs text-gray-500">
                {t('learning.dueCards', { count: state.count })}
              </span>
            </p>
            <a
              href="#study-main"
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              style={{ minHeight: 44 }}
            >
              {t('learning.startSession')}
            </a>
          </>
        ))}
    </section>
  );
}

export function DueQueue() {
  return (
    <I18nProvider locale={getInitialLocale()}>
      <DueQueueInner />
    </I18nProvider>
  );
}
