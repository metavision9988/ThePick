/**
 * i18n type definitions — ported from /home/soo/ThePick/packages/i18n/src/types.ts
 */

export type Locale = 'ko' | 'en';

export const SUPPORTED_LOCALES: Locale[] = ['ko', 'en'];
export const DEFAULT_LOCALE: Locale = 'ko';

export interface TranslationDictionary {
  common: {
    submit: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    save: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
    yes: string;
    no: string;
    search: string;
    retry: string;
    more: string;
    all: string;
    none: string;
  };

  nav: {
    home: string;
    dashboard: string;
    learn: string;
    review: string;
    progress: string;
    settings: string;
  };

  learning: {
    startSession: string;
    endSession: string;
    correct: string;
    incorrect: string;
    showAnswer: string;
    nextCard: string;
    again: string;
    hard: string;
    good: string;
    easy: string;
    cardsRemaining: string;
    sessionComplete: string;
    dailyGoal: string;
    streak: string;
    accuracy: string;
    timeSpent: string;
    mastered: string;
    learning: string;
    new: string;
    due: string;
  };

  content: {
    exam: string;
    question: string;
    answer: string;
    explanation: string;
    mnemonic: string;
    topic: string;
    chapter: string;
    difficulty: string;
    frequency: string;
  };

  errors: {
    generic: string;
    networkError: string;
    notFound: string;
    serverError: string;
    validationError: string;
    timeout: string;
    offline: string;
    referenceHint: string;
  };

  validation: {
    required: string;
    minLength: string;
    maxLength: string;
  };

  time: {
    today: string;
    yesterday: string;
    tomorrow: string;
    days: string;
    hours: string;
    minutes: string;
    ago: string;
    remaining: string;
  };
}

type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>];
    }[Extract<keyof T, string>];

type Join<T extends string[], D extends string> = T extends []
  ? never
  : T extends [infer F]
    ? F
    : T extends [infer F, ...infer R]
      ? F extends string
        ? `${F}${D}${Join<Extract<R, string[]>, D>}`
        : never
      : string;

export type TranslationKey = Join<PathsToStringProps<TranslationDictionary>, '.'>;

export type InterpolationParams = Record<string, string | number>;
