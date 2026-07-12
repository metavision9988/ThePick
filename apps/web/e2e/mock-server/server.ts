/**
 * Hono cross-origin mock server — ADR-040 §7 B-1 옵션 (iii) 흡수 (Session 077, 2026-05-14).
 *
 * 실 production 환경 (apps/web localhost:4321 → apps/api localhost:8787)과 동일한 네트워크 path.
 * Playwright `page.route()` race 제거 + WebKit cross-origin POST preflight 호환.
 *
 * 라우트:
 *   - POST /api/auth/login                           (cookie set)
 *   - GET  /api/study/mode?examId=...
 *   - POST /api/study/mode/start?examId=...
 *   - GET  /api/study/progress?examId=...&days=...
 *   - GET  /api/study/session/:id                    (path-based, examId 무관)
 *   - POST /api/study/session/:id/complete           (path-based, examId 무관)
 *   - GET  /api/study/next?examId=...
 *   - GET  /api/progress/due?examId=...               (WS-5c DueQueue)
 *   - POST /api/study/grade?examId=...
 *
 * Admin (spec-only):
 *   - GET  /__mock/state    (counters + callLog snapshot)
 *   - POST /__mock/override (SerializedOverrides body 적용)
 *   - POST /__mock/reset    (state 초기화 — installApiMock 시작 시 호출)
 *   - GET  /__mock/health   (Playwright webServer readiness)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

import {
  ACCESS_TOKEN_COOKIE,
  type PublicGradeResult,
  type PublicOverview,
  type PublicRevealResult,
  ACCESS_TOKEN_COOKIE_PATH,
  CORS_ALLOWED_HEADERS_BASE,
  CORS_ALLOWED_METHODS,
  CORS_EXPOSED_HEADERS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from '@thepick/shared';

import {
  makeCompleteResponse,
  makeGradeResponse,
  makeDueQueue,
  makeModeStats,
  makeNextQuestion,
  makePublicFillBlankQuestion,
  makePublicMcQuestion,
  makeProgress,
  makeSessionDetail,
  makeStartResponse,
  NEXT_EXHAUSTED,
  PUBLIC_FILL_BLANK_ANSWER,
} from '../helpers/fixtures';

import { recordCall, resetState, state } from './state';
import type { SerializedOverrides } from './types';

const FRONT_ORIGIN = 'http://localhost:4321';

export const app = new Hono();

/**
 * CORS — credentials: 'include' 정합 (cookie 기반 auth).
 *
 * 5-페르소나 backend C1+C2 흡수 (Session 077 다음 chunk) — packages/shared/src/constants/cors.ts
 * 단일 source. apps/api/src/index.ts buildCorsOptions와 동일 상수 import → drift 0.
 *
 * mock 한정 차이:
 *   - `origin`: production은 동적 echo (CORS_ALLOWED_ORIGINS includes), mock은 정적 (localhost:4321).
 *   - `maxAge`: production CORS_MAX_AGE_SECONDS (600s) vs mock 0 (캐시 비활성, spec 격리).
 */
app.use(
  '*',
  cors({
    origin: FRONT_ORIGIN,
    credentials: true,
    allowMethods: [...CORS_ALLOWED_METHODS],
    allowHeaders: [...CORS_ALLOWED_HEADERS_BASE],
    exposeHeaders: [...CORS_EXPOSED_HEADERS],
    maxAge: 0,
  }),
);

/**
 * Hard Rule 16 — examId 검증 헬퍼.
 *
 * 실 서버 routes.ts:105-119 `requireExamId` 정합. 누락 시 422 fail-loud.
 */
function ensureExamId(c: import('hono').Context): Response | null {
  const examId = c.req.query('examId');
  if (examId === undefined || examId === '') {
    console.error(
      `[mock-server] Hard Rule 16 violation: examId missing on ${c.req.method} ${c.req.url}`,
    );
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'examId query parameter required (Hard Rule 16)' },
      422,
    );
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────
 * Admin (spec-only)
 * ──────────────────────────────────────────────────────────────────────── */

app.get('/__mock/health', (c) => c.json({ ok: true }));

app.get('/__mock/state', (c) =>
  c.json({
    counters: { ...state.counters },
    callLog: [...state.callLog],
  }),
);

app.post('/__mock/override', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as SerializedOverrides;
  state.overrides = body;
  return c.json({ ok: true });
});

app.post('/__mock/reset', (c) => {
  resetState();
  return c.json({ ok: true });
});

/* ────────────────────────────────────────────────────────────────────────
 * Auth
 * ──────────────────────────────────────────────────────────────────────── */

app.post('/api/auth/login', (c) => {
  recordCall('authLogin');
  // 5-페르소나 backend C3 / quality Q1 흡수 (Session 077) — Cookie Path는 shared 상수 경유.
  // 실 서버 apps/api/src/auth/routes.ts:721,728이 동일 상수 사용 → 향후 path 개정 시 mock 자동 sync.
  c.header(
    'Set-Cookie',
    `${ACCESS_TOKEN_COOKIE}=mock-access-token-e2e; Path=${ACCESS_TOKEN_COOKIE_PATH}; HttpOnly; SameSite=Lax`,
    { append: true },
  );
  c.header(
    'Set-Cookie',
    `${REFRESH_TOKEN_COOKIE}=mock-refresh-token-e2e; Path=${REFRESH_TOKEN_COOKIE_PATH}; HttpOnly; SameSite=Lax`,
    { append: true },
  );
  return c.json({ ok: true });
});

/* ────────────────────────────────────────────────────────────────────────
 * Study — examId 필수
 * ──────────────────────────────────────────────────────────────────────── */

app.get('/api/study/mode', (c) => {
  const violation = ensureExamId(c);
  if (violation !== null) return violation;
  recordCall('modeStats');
  return c.json(makeModeStats());
});

app.post('/api/study/mode/start', async (c) => {
  const violation = ensureExamId(c);
  if (violation !== null) return violation;
  recordCall('modeStart');
  // 5-페르소나 MAJOR 흡수 (2026-06-12) — 실 서버 422 계약 동형 (구 핸들러는 body 를
  // 읽지 않아 web modeParams 와이어 회귀가 e2e 에 비가시였음. /grade 의 payload
  // contract drift 차단 패턴과 동형). study/routes.ts WIRED_MODES + category subject 정합.
  const body = (await c.req.json().catch(() => null)) as {
    mode?: unknown;
    modeParams?: Record<string, unknown>;
  } | null;
  const WIRED = ['weak', 'mixed', 'category'] as const;
  const mode = body?.mode;
  if (typeof mode !== 'string' || !(WIRED as readonly string[]).includes(mode)) {
    console.error(`[mock-server] mode/start contract violation: mode=${String(mode)}`);
    return c.json({ error: 'MODE_NOT_AVAILABLE', wiredModes: [...WIRED] }, 422);
  }
  if (mode === 'category') {
    const subject = body?.modeParams?.['subject'];
    if (typeof subject !== 'string' || subject.trim().length === 0) {
      console.error('[mock-server] mode/start category without modeParams.subject');
      return c.json({ error: 'MODE_PARAMS_INVALID' }, 422);
    }
  }
  return c.json(makeStartResponse({ mode: mode as (typeof WIRED)[number] }));
});

app.get('/api/study/progress', (c) => {
  const violation = ensureExamId(c);
  if (violation !== null) return violation;
  recordCall('progress');
  const days = Number.parseInt(c.req.query('days') ?? '7', 10);
  const clamped = Number.isFinite(days) && days > 0 && days <= 30 ? days : 7;
  return c.json(makeProgress(clamped));
});

app.get('/api/study/next', (c) => {
  const violation = ensureExamId(c);
  if (violation !== null) return violation;
  recordCall('next');
  const sequence = state.overrides.nextSequence;
  if (sequence !== undefined) {
    const idx = Math.min(state.counters.next - 1, sequence.length - 1);
    return c.json(sequence[idx]);
  }
  if (state.counters.next <= 3) {
    return c.json(makeNextQuestion(state.counters.next));
  }
  return c.json(NEXT_EXHAUSTED);
});

app.post('/api/study/grade', async (c) => {
  const violation = ensureExamId(c);
  if (violation !== null) return violation;

  // 5-페르소나 quality C2/C3 흡수 (Session 076 정합) — empty / overflow fail-loud.
  const seq = state.overrides.gradeSequence;
  if (seq !== undefined) {
    if (seq.length === 0) {
      console.error(
        '[mock-server] gradeSequence empty array — silent fall-through 차단. ' +
          '의도: override({}) 사용 / 의도: 호출 금지면 length 0 유지 + 본 422 surface.',
      );
      return c.json(
        { error: 'VALIDATION_ERROR', message: 'gradeSequence empty (mock contract violation)' },
        422,
      );
    }
    if (state.counters.grade >= seq.length) {
      console.error(
        `[mock-server] gradeSequence overflow: ${state.counters.grade + 1}번째 호출, sequence length=${seq.length}. ` +
          '마지막 항목 silent 반복 차단 — 회귀 가능성 surface.',
      );
    }
    let payload: unknown = null;
    try {
      payload = await c.req.json();
    } catch {
      payload = null;
    }
    if (payload === null) {
      console.error('[mock-server] grade override path: postData null — payload contract drift');
    }
    recordCall('grade');
    const idx = Math.min(state.counters.grade - 1, seq.length - 1);
    const entry = seq[idx]!;
    for (const [k, v] of Object.entries(entry.headers ?? {})) {
      c.header(k, v);
    }
    return c.json(entry.body, entry.status);
  }

  // 기본 path — payload contract drift 차단 (Pass 1 C-5 정합).
  // 5-페르소나 backend M2 흡수 (Session 077 다음 chunk) — inputType은 production zod schema
  // (apps/api/src/study/routes.ts:158) `optional()` 정합. mock에서만 strict required 강제 시
  // production 통과 payload가 mock에서 422 → contract drift silent miss.
  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await c.req.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }
  const required = ['questionId', 'userAnswer'] as const;
  const missing = payload === null ? required.slice() : required.filter((k) => !(k in payload));
  if (missing.length > 0) {
    console.error(`[mock-server] grade payload missing fields: ${missing.join(', ')}`);
    return c.json({ error: 'VALIDATION_ERROR', missing }, 422);
  }
  recordCall('grade');
  const streak = {
    current: 3 + state.counters.grade,
    longest: Math.max(7, 3 + state.counters.grade),
    dailyGoalProgress: 5 + state.counters.grade,
  };
  return c.json(makeGradeResponse(state.counters.grade, streak));
});

/* ────────────────────────────────────────────────────────────────────────
 * Session — path-based (examId 무관, 실 서버 routes.ts:1772-1782 정합)
 *
 * Hono 라우팅은 등록 순서대로 first-match. /session/:id/complete를 /session/:id보다 먼저 등록.
 * ──────────────────────────────────────────────────────────────────────── */

app.post('/api/study/session/:id/complete', (c) => {
  recordCall('sessionComplete');
  const body = state.overrides.completeResponse ?? makeCompleteResponse();
  return c.json(body);
});

app.get('/api/study/session/:id', (c) => {
  recordCall('sessionDetail');
  const body = state.overrides.sessionDetailResponse ?? makeSessionDetail();
  return c.json(body);
});

/* ────────────────────────────────────────────────────────────────────────
 * Progress — WS-5c DueQueue (FSRS 복습 큐)
 * ──────────────────────────────────────────────────────────────────────── */

app.get('/api/progress/due', (c) => {
  recordCall('progressDue');
  const invalid = ensureExamId(c);
  if (invalid) return invalid;
  return c.json(makeDueQueue());
});

/* ────────────────────────────────────────────────────────────────────────
 * Public — promo-1st P4 무인증 공개 표면 (/api/public/*, examId·쿠키 무관)
 *
 * 실 서버 apps/api/src/public/routes.ts 계약 정합:
 *   - next: {choiceId,text} 셔플 서빙 (mock 은 결정적 순서 — 채점 검증 가능)
 *   - grade: choiceId(MC) / answer(fill_blank) → isCorrect + correctChoiceIds
 *   - reveal: correctAnswer + correctChoiceIds (P4-D1)
 * 정답 규약: MC = `pub-{index}-cid-2` / fill_blank = PUBLIC_FILL_BLANK_ANSWER.
 * ──────────────────────────────────────────────────────────────────────── */

app.get('/api/public/questions/overview', (c) => {
  recordCall('publicOverview');
  // 실서버 불변식(4-Pass MINOR): total = Σ subjects.total = Σ rounds.total — 파생 계산으로 고정.
  const subjects = [
    {
      subject: '농어업재해보험법령',
      rounds: [5, 6, 7, 8, 9, 10, 11].map((round) => ({ round, total: round === 5 ? 22 : 25 })),
    },
    {
      subject: '상법 보험편',
      rounds: [5, 6, 7, 8, 9, 10, 11].map((round) => ({ round, total: round === 11 ? 24 : 25 })),
    },
  ].map((s) => ({ ...s, total: s.rounds.reduce((a, r) => a + r.total, 0) }));
  const body = {
    examType: '1st',
    total: subjects.reduce((a, s) => a + s.total, 0),
    subjects,
  } satisfies PublicOverview;
  return c.json(body);
});

app.get('/api/public/questions/next', (c) => {
  recordCall('publicNext');
  const forced = state.overrides.publicNextResponse;
  if (forced !== undefined) {
    return c.json(forced.body, forced.status as 200);
  }
  const inputType = c.req.query('inputType');
  const index = state.counters.publicNext;
  if (inputType === 'fill_blank') {
    return c.json(makePublicFillBlankQuestion(index));
  }
  return c.json(makePublicMcQuestion(index));
});

/** 공개 MC 채점 규약 — choiceId 접미 `-cid-2` = 정답 보기. */
function publicMcCorrectChoiceId(questionId: string): string {
  const index = questionId.replace(/^pub-q-/, '');
  return `pub-${index}-cid-2`;
}

app.post('/api/public/grade', async (c) => {
  recordCall('publicGrade');
  const body = (await c.req.json().catch(() => null)) as {
    questionId?: string;
    choiceId?: string;
    answer?: string;
  } | null;
  if (body === null || typeof body.questionId !== 'string') {
    return c.json({ error: 'VALIDATION_ERROR' }, 400);
  }
  if (body.questionId.startsWith('pub-fb-')) {
    if (typeof body.answer !== 'string') return c.json({ error: 'ANSWER_REQUIRED' }, 400);
    const out = {
      isCorrect: body.answer.trim() === PUBLIC_FILL_BLANK_ANSWER,
      correctAnswer: PUBLIC_FILL_BLANK_ANSWER,
      explanation: 'mock 해설 — 보험가액은 보험 목적물의 평가 기준 금액이다.',
    } satisfies PublicGradeResult;
    return c.json(out);
  }
  if (typeof body.choiceId !== 'string') return c.json({ error: 'CHOICE_ID_REQUIRED' }, 400);
  const correctChoiceId = publicMcCorrectChoiceId(body.questionId);
  const out = {
    isCorrect: body.choiceId === correctChoiceId,
    correctAnswer: '2',
    explanation: 'mock 해설 — 보기 ②가 정답이다.',
    correctChoiceIds: [correctChoiceId],
  } satisfies PublicGradeResult;
  return c.json(out);
});

app.post('/api/public/reveal', async (c) => {
  recordCall('publicReveal');
  const body = (await c.req.json().catch(() => null)) as { questionId?: string } | null;
  if (body === null || typeof body.questionId !== 'string') {
    return c.json({ error: 'VALIDATION_ERROR' }, 400);
  }
  if (body.questionId.startsWith('pub-fb-')) {
    const out = {
      correctAnswer: PUBLIC_FILL_BLANK_ANSWER,
      explanation: 'mock 해설 — 보험가액은 보험 목적물의 평가 기준 금액이다.',
    } satisfies PublicRevealResult;
    return c.json(out);
  }
  const out = {
    correctAnswer: '2',
    explanation: 'mock 해설 — 보기 ②가 정답이다.',
    correctChoiceIds: [publicMcCorrectChoiceId(body.questionId)],
  } satisfies PublicRevealResult;
  return c.json(out);
});

/* unhandled fallback — fail-loud (silent 404 차단). */
app.all('*', (c) => {
  console.error(`[mock-server] unhandled route: ${c.req.method} ${c.req.url}`);
  return c.json({ error: 'UNHANDLED', method: c.req.method, url: c.req.url }, 404);
});
