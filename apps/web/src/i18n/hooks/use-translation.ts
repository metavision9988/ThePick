import { useCallback } from 'react';
import { useI18nContext } from '../context';
import type { TranslationKey, InterpolationParams, Locale } from '../types';

interface UseTranslationReturn {
  t: (key: TranslationKey, params?: InterpolationParams) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export function useTranslation(): UseTranslationReturn {
  const { locale, setLocale, dictionary } = useI18nContext();

  const t = useCallback(
    (key: TranslationKey, params?: InterpolationParams): string => {
      const keys = key.split('.');
      let value: unknown = dictionary;

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          console.warn(`Translation key not found: ${key}`);
          return key;
        }
      }

      if (typeof value !== 'string') {
        console.warn(`Translation value is not a string: ${key}`);
        return key;
      }

      if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey: string) => {
          return params[paramKey]?.toString() ?? `{{${paramKey}}}`;
        });
      }

      return value;
    },
    [dictionary],
  );

  return { t, locale, setLocale };
}
