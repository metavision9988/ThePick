import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Locale, TranslationDictionary } from './types';
import { DEFAULT_LOCALE } from './types';
import { ko } from './locales/ko';
import { en } from './locales/en';

const dictionaries: Record<Locale, TranslationDictionary> = { ko, en };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dictionary: TranslationDictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: React.ReactNode;
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
}

export function I18nProvider({
  children,
  locale: initialLocale = DEFAULT_LOCALE,
  onLocaleChange,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      onLocaleChange?.(newLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem('thepick-locale', newLocale);
      }
    },
    [onLocaleChange],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      dictionary: dictionaries[locale],
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18nContext(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
}

export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const stored = localStorage.getItem('thepick-locale');
  if (stored === 'ko' || stored === 'en') {
    return stored;
  }

  const browserLang = navigator.language.split('-')[0];
  return browserLang === 'ko' ? 'ko' : DEFAULT_LOCALE;
}
