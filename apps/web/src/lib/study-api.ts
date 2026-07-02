/**
 * study-api — /api/study/* fetch wrapper.
 * 모든 호출은 credentials: 'include' (Cookie 세션). 401 → 호출자가 redirect 결정.
 *
 * Hard Rule 17 정합: examId는 @thepick/shared EXAM_IDS 경유.
 */

import { EXAM_IDS } from '@thepick/shared';

import type {
  ExamType,
  ModeStartRequest,
  ModeStartResponse,
  ModeStatsResponse,
  SessionCompleteResponse,
  SessionDetail,
  StreakSummary,
} from '@/components/session/types';

export type { ExamType };

const API_BASE: string = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';
const EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

export class StudyApiError extends Error {
  readonly kind:
    | 'unauthenticated'
    | 'rate_limited'
    | 'validation'
    | 'forbidden'
    | 'not_found'
    | 'service_unavailable'
    | 'network';
  readonly status: number | null;
  constructor(kind: StudyApiError['kind'], message: string, status: number | null = null) {
    super(message);
    this.name = 'StudyApiError';
    this.kind = kind;
    this.status = status;
  }
}

function fromHttp(status: number): StudyApiError['kind'] {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'service_unavailable';
  return 'service_unavailable';
}

async function safeFetch<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, credentials: 'include' });
  } catch (err) {
    throw new StudyApiError('network', err instanceof Error ? err.message : 'fetch failed');
  }
  if (!res.ok) {
    throw new StudyApiError(fromHttp(res.status), `HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export async function fetchModeStats(examType: ExamType): Promise<ModeStatsResponse> {
  const url = new URL(`${API_BASE}/api/study/mode`);
  url.searchParams.set('examId', EXAM_ID);
  url.searchParams.set('examType', examType);
  return safeFetch<ModeStatsResponse>(url.toString(), { method: 'GET' });
}

/** Step 3-UX-6d ProgressVisualization — daily + subjects + dailyGoal source. */
export interface DailyEntry {
  readonly date: string; // YYYY-MM-DD (KST)
  readonly cardsDistinct: number;
  readonly isToday: boolean;
}

export interface SubjectMastery {
  readonly subject: string;
  readonly total: number;
  readonly mastered: number;
  /** 0~1, mastered / total. */
  readonly masteryPct: number;
}

export interface ProgressResponse {
  readonly examId: string;
  readonly examType: ExamType;
  readonly days: number;
  readonly dailyGoal: number;
  readonly daily: ReadonlyArray<DailyEntry>;
  readonly subjects: ReadonlyArray<SubjectMastery>;
  /** C-P1 흡수 — /progress 응답에 streak 통합 (이전 /mode 별도 호출 제거). */
  readonly streak: StreakSummary;
}

export async function fetchProgress(examType: ExamType, days: number): Promise<ProgressResponse> {
  const url = new URL(`${API_BASE}/api/study/progress`);
  url.searchParams.set('examId', EXAM_ID);
  url.searchParams.set('examType', examType);
  url.searchParams.set('days', String(days));
  return safeFetch<ProgressResponse>(url.toString(), { method: 'GET' });
}

export async function startMode(body: ModeStartRequest): Promise<ModeStartResponse> {
  const url = new URL(`${API_BASE}/api/study/mode/start`);
  url.searchParams.set('examId', EXAM_ID);
  return safeFetch<ModeStartResponse>(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail> {
  return safeFetch<SessionDetail>(`${API_BASE}/api/study/session/${sessionId}`, {
    method: 'GET',
  });
}

export async function completeSession(sessionId: string): Promise<SessionCompleteResponse> {
  return safeFetch<SessionCompleteResponse>(`${API_BASE}/api/study/session/${sessionId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * WS-5c — GET /api/progress/due 응답 항목 (FSRS 복습 큐, user_progress 행).
 * ★ card_type 무필터 — node 행(POST /progress/review 시드) + exam 카드 행(study /grade
 * FSRS 영속분, nodeId null) 모두 포함 (4-Pass MAJOR 정정 — "node 전용" 아님).
 */
export interface DueItem {
  readonly id: string;
  /** node 행은 노드 ID, exam 카드 행은 null. */
  readonly nodeId: string | null;
  readonly cardType: string;
  /** ISO datetime 또는 null (미스케줄 행 — 서버가 due 로 포함). */
  readonly fsrsNextReview: string | null;
}

export interface DueQueueResponse {
  readonly items: ReadonlyArray<DueItem>;
  readonly count: number;
}

/** WS-5c — FSRS due 복습 큐 조회 (/api/progress/due, 서버 LIMIT 적용). */
export async function fetchDueQueue(): Promise<DueQueueResponse> {
  const url = new URL(`${API_BASE}/api/progress/due`);
  url.searchParams.set('examId', EXAM_ID);
  return safeFetch<DueQueueResponse>(url.toString(), { method: 'GET' });
}

/** 401 redirect 헬퍼 — 호출자가 catch 후 사용. */
export function redirectToLogin(): void {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/auth/login?next=${next}`;
}
