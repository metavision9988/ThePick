/**
 * public-api — /api/public/* fetch wrapper (무인증, credentials 없음).
 *
 * 에러코드 → 사용자 문구 단일 매핑(P4-D6, carry-over "i18n 오류코드 매핑" 해소).
 * 서버 에러 body = {error: string} (apps/api/src/public/routes.ts).
 */

import type { InputType, PublicGradeResult, PublicQuestion, PublicRevealResult } from './types';

const API_BASE: string = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';

/** 서버 에러코드 → 사용자 문구 (기술 에러 비노출 — Pass 3 Graceful 안내). */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NO_QUESTION: '조건에 맞는 문제가 아직 없다. 필터를 바꾸거나 다른 학습 모드를 골라 보자.',
  QUESTION_NOT_FOUND: '문제를 찾을 수 없다. 다음 문제로 넘어가자.',
  QUESTION_UNAVAILABLE: '이 문제는 지금 풀 수 없다. 다음 문제로 넘어가자.',
  QUESTION_HAS_NO_ANSWER: '이 문제는 정답 데이터 준비 중이다. 다음 문제로 넘어가자.',
  QUESTION_NOT_GRADABLE: '이 문제는 아직 채점을 지원하지 않는다. 다음 문제로 넘어가자.',
  TOO_MANY_REQUESTS: '요청이 많다. 잠시 후 다시 시도해 보자.',
  VALIDATION_ERROR: '요청 형식이 올바르지 않다. 새로고침 후 다시 시도해 보자.',
  CHOICE_ID_REQUIRED: '보기를 선택한 뒤 채점해 보자.',
  ANSWER_REQUIRED: '답을 입력한 뒤 채점해 보자.',
  INTERNAL_ERROR: '일시적인 오류가 발생했다. 잠시 후 다시 시도해 보자.',
};

const NETWORK_MESSAGE = '네트워크에 연결할 수 없다. 연결 상태를 확인한 뒤 다시 시도해 보자.';
const OFFLINE_MESSAGE = '오프라인 상태다. 네트워크 연결 후 다시 시도해 보자.';

export type PublicApiErrorKind = 'no_question' | 'rate_limited' | 'offline' | 'network' | 'server';

export class PublicApiError extends Error {
  readonly kind: PublicApiErrorKind;
  readonly code: string | null;
  readonly status: number | null;
  /** 429 Retry-After 초 (없으면 null). */
  readonly retryAfterSec: number | null;

  constructor(params: {
    kind: PublicApiErrorKind;
    code?: string | null;
    status?: number | null;
    retryAfterSec?: number | null;
  }) {
    super(publicErrorMessage(params.code ?? null, params.kind));
    this.name = 'PublicApiError';
    this.kind = params.kind;
    this.code = params.code ?? null;
    this.status = params.status ?? null;
    this.retryAfterSec = params.retryAfterSec ?? null;
  }
}

/** 에러코드/종류 → 사용자 문구 (단일 정본 — UI 는 error.message 만 표시). */
export function publicErrorMessage(code: string | null, kind: PublicApiErrorKind): string {
  if (kind === 'offline') return OFFLINE_MESSAGE;
  if (kind === 'network') return NETWORK_MESSAGE;
  if (code !== null && code in ERROR_MESSAGES) return ERROR_MESSAGES[code]!;
  return ERROR_MESSAGES['INTERNAL_ERROR']!;
}

function classify(status: number, code: string | null): PublicApiErrorKind {
  if (status === 429) return 'rate_limited';
  if (status === 404 && code === 'NO_QUESTION') return 'no_question';
  return 'server';
}

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new PublicApiError({ kind: 'offline' });
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new PublicApiError({ kind: 'network' });
  }
  if (!res.ok) {
    let code: string | null = null;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') code = body.error;
    } catch {
      code = null;
    }
    const retryAfterRaw = res.headers.get('Retry-After');
    const retryAfterSec =
      retryAfterRaw !== null && Number.isFinite(Number(retryAfterRaw))
        ? Number(retryAfterRaw)
        : null;
    throw new PublicApiError({
      kind: classify(res.status, code),
      code,
      status: res.status,
      retryAfterSec,
    });
  }
  return (await res.json()) as T;
}

export interface NextQuestionFilter {
  readonly subject?: string | null;
  readonly round?: number | null;
  readonly inputType?: InputType | null;
}

export async function fetchPublicNext(filter: NextQuestionFilter = {}): Promise<PublicQuestion> {
  const params = new URLSearchParams();
  if (filter.subject != null) params.set('subject', filter.subject);
  if (filter.round != null) params.set('round', String(filter.round));
  if (filter.inputType != null) params.set('inputType', filter.inputType);
  const qs = params.toString();
  return publicFetch<PublicQuestion>(`/api/public/questions/next${qs === '' ? '' : `?${qs}`}`);
}

export async function gradePublic(body: {
  readonly questionId: string;
  readonly choiceId?: string;
  readonly answer?: string;
}): Promise<PublicGradeResult> {
  return publicFetch<PublicGradeResult>('/api/public/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function revealPublic(questionId: string): Promise<PublicRevealResult> {
  return publicFetch<PublicRevealResult>('/api/public/reveal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId }),
  });
}
