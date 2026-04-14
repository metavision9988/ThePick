import type { Locale, TranslationDictionary, TranslationKey } from './types';
import { ko } from './locales/ko';
import { en } from './locales/en';

const dictionaries: Record<Locale, TranslationDictionary> = { ko, en };

export function getTranslation(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dictionary = dictionaries[locale];
  const keys = key.split('.');
  let value: unknown = dictionary;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey: string) => {
      return params[paramKey]?.toString() ?? `{{${paramKey}}}`;
    });
  }

  return value;
}

export function createTranslator(locale: Locale) {
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    return getTranslation(locale, key, params);
  };
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCurrency(value: number, locale: Locale, currency = 'KRW'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(
  date: Date,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatRelativeTime(date: Date, locale: Locale): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffDays > 0) return rtf.format(-diffDays, 'day');
  if (diffHours > 0) return rtf.format(-diffHours, 'hour');
  if (diffMins > 0) return rtf.format(-diffMins, 'minute');
  return rtf.format(-diffSecs, 'second');
}
