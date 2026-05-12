/**
 * Study routes 단위 테스트 (Phase 2 Eval MVP — phase2-eval-mvp.plan §7 G3+G4).
 *
 * 실제 SQLite (node:sqlite) + migrations 9종 → user_progress / exam_questions / knowledge_nodes
 * 트리거 위에서 검증. progress/__tests__/routes.test.ts 패턴 정합.
 *
 * 커버 시나리오:
 *   - GET  /next   — 인증/examId/exam_type 필터/미시도 우선/correctCount 가중치/exhausted
 *   - POST /grade  — 인증/examId/Zod/미존재 question/정답/오답/normalize/출처 surface/UPSERT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_COOKIE, EXAM_IDS } from '@thepick/shared';
import { createD1FromSqlite, type SqliteBackedD1 } from '../../__tests__/helpers/d1-from-sqlite.js';
import { signAccessToken } from '../../auth/session.js';
import { createStudyRoutes, type StudyBindings } from '../routes.js';
// Step 3-UX-5a — normalize/isAnswerCorrect 로직은 packages/learning-modes로 분리.
// 본 테스트는 분리 후에도 동일 회귀 정합 검증 (Pass 1 CRIT-1 + Pass 1 M1).
import { gradeFillBlank, normalizeAnswer } from '@thepick/learning-modes';

/** Step 3-UX-5 이전 호환 helper — gradeFillBlank wrapper. */
function isAnswerCorrect(expected: string | null, userAnswer: string): boolean {
  if (expected === null || expected === '') return false;
  return gradeFillBlank({ expected, userAnswer }).isCorrect;
}

const VALID_JWT_SECRET = 'study-test-jwt-secret-32bytes-plus-v1';

interface RelatedNodeBody {
  readonly id: string;
  readonly name: string;
  readonly nodeType: string;
  readonly bookPage: number | null;
  readonly pageRef: string | null;
}

interface SourceCitationsBody {
  readonly examReferences: ReadonlyArray<{
    readonly year: number;
    readonly round: number | null;
    readonly questionNumber: number | null;
  }>;
  readonly manualPages: ReadonlyArray<number>;
  readonly lawArticles: ReadonlyArray<string>;
}

interface NextQuestionBody {
  readonly id: string;
  readonly year: number;
  readonly round: number | null;
  readonly questionNumber: number | null;
  readonly relatedNodes: ReadonlyArray<RelatedNodeBody>;
  readonly sourceCitations: SourceCitationsBody;
}

interface StudyResponseBody {
  readonly exhausted?: boolean;
  readonly questions?: ReadonlyArray<NextQuestionBody>;
  readonly isCorrect?: boolean;
  readonly correctAnswer?: string;
  readonly relatedNodes?: ReadonlyArray<RelatedNodeBody>;
  readonly sourceCitations?: SourceCitationsBody;
  readonly error?: string;
  readonly message?: string;
  readonly questionId?: string;
}

let ctx: SqliteBackedD1;

beforeEach(() => {
  ctx = createD1FromSqlite();
});

afterEach(() => {
  ctx.close();
});

function env(): StudyBindings {
  return {
    DB: ctx.db,
    ENVIRONMENT: 'test',
    JWT_SECRET: VALID_JWT_SECRET,
  };
}

function seedUser(id: string, email: string): void {
  ctx.raw
    .prepare(
      `INSERT INTO users (id, email, password_hash, password_salt, password_iterations, status)
       VALUES (?, ?, ?, ?, 600000, 'active')`,
    )
    .run(id, email, 'x'.repeat(64), 'salt-placeholder');
}

function seedNode(id: string, name = '테스트 노드', type = 'CONCEPT', bookPage = 999): void {
  ctx.raw
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page, is_current_active)
       VALUES (?, ?, ?, ?, 2026, 5, 'draft', ?, ?, 1)`,
    )
    .run(id, type, name, String(bookPage), bookPage, bookPage);
}

function seedExamQuestion(params: {
  id: string;
  year?: number;
  round?: number | null;
  questionNumber?: number | null;
  subject?: string | null;
  content?: string;
  answer?: string | null;
  explanation?: string | null;
  examType?: '1st' | '2nd';
  relatedNodes?: string[] | null;
  status?: 'active' | 'historical';
}): void {
  ctx.raw
    .prepare(
      `INSERT INTO exam_questions
         (id, year, round, question_number, subject, content, answer, explanation,
          related_nodes, status, exam_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.id,
      params.year ?? 2024,
      params.round ?? null,
      params.questionNumber ?? null,
      params.subject ?? null,
      params.content ?? '테스트 문제',
      params.answer === undefined ? '1' : params.answer,
      params.explanation ?? null,
      params.relatedNodes ? JSON.stringify(params.relatedNodes) : null,
      params.status ?? 'active',
      params.examType ?? '2nd',
    );
}

function seedProgressForQuestion(params: {
  userId: string;
  questionId: string;
  totalReviews?: number;
  correctCount?: number;
}): void {
  ctx.raw
    .prepare(
      `INSERT INTO user_progress
         (id, user_id, node_id, card_id, card_type, fsrs_difficulty, fsrs_stability, fsrs_interval,
          fsrs_next_review, total_reviews, correct_count)
       VALUES (?, ?, NULL, ?, 'exam', 0.3, 1.0, 1, NULL, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      params.userId,
      params.questionId,
      params.totalReviews ?? 0,
      params.correctCount ?? 0,
    );
}

async function accessToken(
  userId: string,
  sessionId: string = crypto.randomUUID(),
): Promise<string> {
  return signAccessToken(userId, sessionId, VALID_JWT_SECRET);
}

function withExamId(path: string): string {
  if (path.includes('examId=')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}examId=${EXAM_IDS.SON_HAE_PYEONG_GA_SA}`;
}

async function fetchAs(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken(userId);
  const headers = new Headers(init.headers);
  headers.set('Cookie', `${ACCESS_TOKEN_COOKIE}=${token}`);
  return createStudyRoutes().fetch(
    new Request(`http://test.local${withExamId(path)}`, {
      ...init,
      headers,
    }),
    env(),
  );
}

describe('study routes — pure helpers', () => {
  it('normalizeAnswer: trim + lowercase + 공백 제거 + 원형숫자 → 숫자 + "번" 접미사 제거', () => {
    expect(normalizeAnswer('  ②번 ')).toBe('2');
    expect(normalizeAnswer('②')).toBe('2');
    expect(normalizeAnswer('2번')).toBe('2');
    expect(normalizeAnswer('보 험 가 액')).toBe('보험가액');
    expect(normalizeAnswer('CONCEPT')).toBe('concept');
  });

  it('isAnswerCorrect: ② / 2 / 2번 모두 동일 정답 매칭', () => {
    expect(isAnswerCorrect('②', '2')).toBe(true);
    expect(isAnswerCorrect('2', '②')).toBe(true);
    expect(isAnswerCorrect('②', '2번')).toBe(true);
    expect(isAnswerCorrect('2', '3')).toBe(false);
    expect(isAnswerCorrect(null, '1')).toBe(false);
    expect(isAnswerCorrect('', '1')).toBe(false);
  });

  // 4-Pass Pass 3 CRIT-3 회귀 — '번' vs '호' false-positive 차단 검증.
  // 정답 '1번' 일 때 사용자 '1호' 입력은 오답이어야 한다 ('호' 정합 시 동/호수 의미).
  it('CRIT-3 regression: "1번" vs "1호" 동등 처리 차단', () => {
    expect(normalizeAnswer('1번')).toBe('1');
    expect(normalizeAnswer('1호')).toBe('1호');
    expect(isAnswerCorrect('1번', '1호')).toBe(false);
    expect(isAnswerCorrect('1호', '1번')).toBe(false);
  });

  // 4-Pass Pass 1 CRIT-1 회귀 — regex character class 확장 누락 시 silent '0' corruption 차단.
  // 본 테스트는 현 구현 (① ~ ⑩) 정합 + 미래 [①-⑳] 확장 시 indexOf=-1 가드 보장 의도.
  it('CRIT-1 regression: 원형숫자 정상 매핑 + 비-circle 입력 그대로', () => {
    expect(normalizeAnswer('①')).toBe('1');
    expect(normalizeAnswer('⑩')).toBe('10');
    expect(normalizeAnswer('abc')).toBe('abc');
    expect(normalizeAnswer('5')).toBe('5');
  });
});

describe('GET /api/study/next', () => {
  it('미인증 → 401', async () => {
    const res = await createStudyRoutes().fetch(
      new Request(`http://test.local${withExamId('/next')}`),
      env(),
    );
    expect(res.status).toBe(401);
  });

  it('examId 누락 → 422', async () => {
    seedUser('u1', 'u1@test.com');
    const token = await accessToken('u1');
    const res = await createStudyRoutes().fetch(
      new Request('http://test.local/next', {
        headers: { Cookie: `${ACCESS_TOKEN_COOKIE}=${token}` },
      }),
      env(),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as StudyResponseBody;
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('exam_type 필터 — 2nd 만 surface (1st 제외)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-1st-1', examType: '1st', content: '1차 문제' });
    seedExamQuestion({ id: 'eq-2nd-1', examType: '2nd', content: '2차 문제' });
    // ★ Session 065: 라우트 default '2nd' → '1st' 변경 (production 실측 정합). 본 test는 examType filter 검증 의도.
    const res = await fetchAs('u1', '/next?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as StudyResponseBody;
    expect(body.exhausted).toBe(false);
    expect(body.questions).toHaveLength(1);
    expect(body.questions![0].id).toBe('eq-2nd-1');
  });

  it('미시도 우선 — 시도한 question 은 후순위', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-tried', examType: '2nd' });
    seedExamQuestion({ id: 'eq-fresh', examType: '2nd' });
    seedProgressForQuestion({
      userId: 'u1',
      questionId: 'eq-tried',
      totalReviews: 1,
      correctCount: 1,
    });
    const res = await fetchAs('u1', '/next?count=2&examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as StudyResponseBody;
    expect(body.questions).toHaveLength(2);
    expect(body.questions![0].id).toBe('eq-fresh');
    expect(body.questions![1].id).toBe('eq-tried');
  });

  it('correctCount ASC 가중치 — 덜 맞춘 question 우선', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-mastered', examType: '2nd' });
    seedExamQuestion({ id: 'eq-weak', examType: '2nd' });
    seedProgressForQuestion({
      userId: 'u1',
      questionId: 'eq-mastered',
      totalReviews: 5,
      correctCount: 5,
    });
    seedProgressForQuestion({
      userId: 'u1',
      questionId: 'eq-weak',
      totalReviews: 5,
      correctCount: 1,
    });
    const res = await fetchAs('u1', '/next?count=2&examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    expect(body.questions![0].id).toBe('eq-weak');
    expect(body.questions![1].id).toBe('eq-mastered');
  });

  it('exhausted — exam_questions 없음', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/next');
    const body = (await res.json()) as StudyResponseBody;
    expect(body.exhausted).toBe(true);
    expect(body.questions).toEqual([]);
  });

  it('relatedNodes enrichment + sourceCitations.examReferences', async () => {
    seedUser('u1', 'u1@test.com');
    seedNode('CONCEPT-001', '보험가액', 'CONCEPT', 100);
    seedNode('LAW-007', '농어업재해보험법 제11조', 'LAW', 50);
    seedExamQuestion({
      id: 'eq-with-refs',
      examType: '2nd',
      year: 2024,
      round: 11,
      questionNumber: 5,
      relatedNodes: ['CONCEPT-001', 'LAW-007'],
    });
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    expect(q.relatedNodes).toHaveLength(2);
    expect(q.sourceCitations.examReferences[0]).toEqual({
      year: 2024,
      round: 11,
      questionNumber: 5,
    });
    expect(q.sourceCitations.manualPages).toEqual([50, 100]);
    expect(q.sourceCitations.lawArticles).toContain('50');
  });
});

describe('POST /api/study/grade', () => {
  it('미인증 → 401', async () => {
    const res = await createStudyRoutes().fetch(
      new Request(`http://test.local${withExamId('/grade')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'eq-1', userAnswer: '1' }),
      }),
      env(),
    );
    expect(res.status).toBe(401);
  });

  it('examId 누락 → 422', async () => {
    seedUser('u1', 'u1@test.com');
    const token = await accessToken('u1');
    const res = await createStudyRoutes().fetch(
      new Request('http://test.local/grade', {
        method: 'POST',
        headers: {
          Cookie: `${ACCESS_TOKEN_COOKIE}=${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionId: 'eq-1', userAnswer: '1' }),
      }),
      env(),
    );
    expect(res.status).toBe(422);
  });

  it('body validation 실패 → 422', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAnswer: '1' }),
    });
    expect(res.status).toBe(422);
  });

  it('미존재 question → 404', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-nonexistent', userAnswer: '1' }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as StudyResponseBody;
    expect(body.error).toBe('QUESTION_NOT_FOUND');
  });

  it('정답 — isCorrect=true + INSERT user_progress (correctCount=1)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-1', answer: '1', examType: '2nd' });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-1', userAnswer: '1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as StudyResponseBody;
    expect(body.isCorrect).toBe(true);
    expect(body.correctAnswer).toBe('1');

    const progressRow = ctx.raw
      .prepare(
        `SELECT total_reviews, correct_count FROM user_progress
           WHERE user_id='u1' AND card_id='eq-1' AND card_type='exam'`,
      )
      .get() as { total_reviews: number; correct_count: number };
    expect(progressRow.total_reviews).toBe(1);
    expect(progressRow.correct_count).toBe(1);
  });

  it('오답 — isCorrect=false + correct_count 증가 X', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-1', answer: '1', examType: '2nd' });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-1', userAnswer: '3' }),
    });
    const body = (await res.json()) as StudyResponseBody;
    expect(body.isCorrect).toBe(false);
    const progressRow = ctx.raw
      .prepare(
        `SELECT total_reviews, correct_count FROM user_progress
           WHERE user_id='u1' AND card_id='eq-1' AND card_type='exam'`,
      )
      .get() as { total_reviews: number; correct_count: number };
    expect(progressRow.total_reviews).toBe(1);
    expect(progressRow.correct_count).toBe(0);
  });

  it('normalize — "②" vs "2번" 동일 정답 매칭', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-1', answer: '②', examType: '2nd' });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-1', userAnswer: '2번' }),
    });
    const body = (await res.json()) as StudyResponseBody;
    expect(body.isCorrect).toBe(true);
  });

  it('UPSERT existing — 두 번째 시도 시 totalReviews=2', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-1', answer: '1', examType: '2nd' });
    await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-1', userAnswer: '1' }),
    });
    await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-1', userAnswer: '3' }),
    });
    const progressRow = ctx.raw
      .prepare(
        `SELECT total_reviews, correct_count FROM user_progress
           WHERE user_id='u1' AND card_id='eq-1' AND card_type='exam'`,
      )
      .get() as { total_reviews: number; correct_count: number };
    expect(progressRow.total_reviews).toBe(2);
    expect(progressRow.correct_count).toBe(1);
  });

  it('출처 surface — relatedNodes 정상 enrichment + sourceCitations 채워짐', async () => {
    seedUser('u1', 'u1@test.com');
    seedNode('CONCEPT-001', '보험가액', 'CONCEPT', 100);
    seedNode('LAW-007', '농어업재해보험법 제11조', 'LAW', 50);
    seedExamQuestion({
      id: 'eq-refs',
      answer: '1',
      examType: '2nd',
      year: 2024,
      round: 11,
      questionNumber: 5,
      relatedNodes: ['CONCEPT-001', 'LAW-007'],
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-refs', userAnswer: '1' }),
    });
    const body = (await res.json()) as StudyResponseBody;
    expect(body.relatedNodes).toHaveLength(2);
    expect(body.sourceCitations!.examReferences).toEqual([
      { year: 2024, round: 11, questionNumber: 5 },
    ]);
    expect(body.sourceCitations!.manualPages).toEqual([50, 100]);
    expect(body.sourceCitations!.lawArticles).toContain('50');
  });

  it('answer=null question → 422 QUESTION_HAS_NO_ANSWER (약술형 carry-over)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-essay', answer: null, examType: '2nd' });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-essay', userAnswer: '서술형 답' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as StudyResponseBody;
    expect(body.error).toBe('QUESTION_HAS_NO_ANSWER');
  });

  // 4-Pass Pass 3 CRIT-2 회귀 — rate-limit (분당 20회) 적용 검증.
  // 21회째 시도가 429 반환해야 함 (TD-030 정합).
  it('CRIT-2 regression: rate-limit 20/min 초과 시 429', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-rl', answer: '1', examType: '2nd' });
    // 20회 정상 시도
    for (let i = 0; i < 20; i++) {
      const res = await fetchAs('u1', '/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'eq-rl', userAnswer: '1' }),
      });
      expect([200, 404]).toContain(res.status);
    }
    // 21회째 — 429 RATE_LIMIT_EXCEEDED + Retry-After 헤더
    const blocked = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-rl', userAnswer: '1' }),
    });
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as StudyResponseBody;
    expect(body.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(blocked.headers.get('Retry-After')).not.toBeNull();
  });

  it('사용자 격리 — u1 progress 가 u2 grade 에 영향 X', async () => {
    seedUser('u1', 'u1@test.com');
    seedUser('u2', 'u2@test.com');
    seedExamQuestion({ id: 'eq-1', answer: '1', examType: '2nd' });
    seedProgressForQuestion({ userId: 'u1', questionId: 'eq-1', totalReviews: 5, correctCount: 5 });
    await fetchAs('u2', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-1', userAnswer: '1' }),
    });
    const u1Row = ctx.raw
      .prepare(`SELECT total_reviews FROM user_progress WHERE user_id='u1' AND card_id='eq-1'`)
      .get() as { total_reviews: number };
    expect(u1Row.total_reviews).toBe(5);
    const u2Row = ctx.raw
      .prepare(`SELECT total_reviews FROM user_progress WHERE user_id='u2' AND card_id='eq-1'`)
      .get() as { total_reviews: number };
    expect(u2Row.total_reviews).toBe(1);
  });
});
