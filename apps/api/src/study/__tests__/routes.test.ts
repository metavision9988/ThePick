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
  readonly inputType: string;
  readonly choices: ReadonlyArray<{ readonly label: string; readonly text: string }> | null;
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
  confusionType?: string | null;
}): void {
  ctx.raw
    .prepare(
      `INSERT INTO exam_questions
         (id, year, round, question_number, subject, content, answer, explanation,
          related_nodes, status, exam_type, confusion_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      params.confusionType ?? null,
    );
}

function seedProgressForQuestion(params: {
  userId: string;
  questionId: string;
  totalReviews?: number;
  correctCount?: number;
  weakScore?: number;
}): void {
  ctx.raw
    .prepare(
      `INSERT INTO user_progress
         (id, user_id, node_id, card_id, card_type, fsrs_difficulty, fsrs_stability, fsrs_interval,
          fsrs_next_review, total_reviews, correct_count, weak_score)
       VALUES (?, ?, NULL, ?, 'exam', 0.3, 1.0, 1, NULL, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      params.userId,
      params.questionId,
      params.totalReviews ?? 0,
      params.correctCount ?? 0,
      params.weakScore ?? 0,
    );
}

/** Step 3-UX-5c — study_sessions seed helper. */
function seedStudySession(params: {
  id?: string;
  userId: string;
  mode?: 'category' | 'topic' | 'confusion' | 'weak' | 'mixed';
  phase?: 'warmup' | 'main' | 'cooldown' | 'completed';
  cardsPlanned?: number;
  cardsCompleted?: number;
  correctCount?: number;
  startedAt?: string;
  endedAt?: string | null;
}): string {
  const id = params.id ?? crypto.randomUUID();
  ctx.raw
    .prepare(
      `INSERT INTO study_sessions
         (id, user_id, started_at, ended_at, mode, mode_params, phase,
          cards_planned, cards_completed, correct_count)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
    )
    .run(
      id,
      params.userId,
      params.startedAt ?? new Date().toISOString(),
      params.endedAt ?? null,
      params.mode ?? 'mixed',
      params.phase ?? 'warmup',
      params.cardsPlanned ?? 20,
      params.cardsCompleted ?? 0,
      params.correctCount ?? 0,
    );
  return id;
}

/** Step 3-UX-6c-2 — study_reviews seed helper (weakDelta 테스트용). */
function seedStudyReview(params: {
  userId: string;
  cardId: string;
  sessionId: string;
  reviewedAt?: string;
  rating?: 'again' | 'hard' | 'good' | 'easy';
  intervalDays?: number;
}): void {
  ctx.raw
    .prepare(
      `INSERT INTO study_reviews
         (id, user_id, card_id, card_type, reviewed_at, rating, interval_days, session_id)
       VALUES (?, ?, ?, 'exam', ?, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      params.userId,
      params.cardId,
      params.reviewedAt ?? new Date().toISOString(),
      params.rating ?? 'good',
      params.intervalDays ?? 1,
      params.sessionId,
    );
}

/** Step 3-UX-5c — streak_records seed helper. */
function seedStreakRecord(params: {
  userId: string;
  currentStreak?: number;
  longestStreak?: number;
  lastStudyDate?: string | null;
  dailyGoal?: number;
}): void {
  ctx.raw
    .prepare(
      `INSERT INTO streak_records
         (user_id, current_streak, longest_streak, last_study_date, daily_goal)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      params.userId,
      params.currentStreak ?? 0,
      params.longestStreak ?? 0,
      params.lastStudyDate ?? null,
      params.dailyGoal ?? 20,
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

  // design-audit WS-0e (2026-06-10) — enrichRelatedNodes(study route)를 parseRelatedNodes
  //   와 같은 malformed→[] 계약에 묶는 route-level 바인딩. related_nodes 가 비배열 JSON
  //   (구조 결함)일 때 라우트가 크래시·silent 오작동 없이 빈 relatedNodes 를 surface 하는지
  //   검증. seedExamQuestion 은 JSON.stringify 라 malformed 주입 불가 → raw INSERT
  //   (exam_questions UPDATE 트리거 차단 때문에 UPDATE 아닌 INSERT 로 주입).
  it('malformed related_nodes(비배열 JSON) → 빈 relatedNodes surface (enrichRelatedNodes 계약)', async () => {
    seedUser('u1', 'u1@test.com');
    ctx.raw
      .prepare(
        `INSERT INTO exam_questions
           (id, year, round, question_number, subject, content, answer, explanation,
            related_nodes, status, exam_type, confusion_type)
         VALUES (?, 2024, 11, 5, NULL, '테스트 문제', '1', NULL, ?, 'active', '2nd', NULL)`,
      )
      .run('eq-malformed', '"CONCEPT-001"'); // 비배열 JSON = malformed (parseRelatedNodes 와 동일 분류)
    const res = await fetchAs('u1', '/next?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    expect(q.relatedNodes).toEqual([]); // enrichRelatedNodes malformed→[] (parseRelatedNodes 동치)
  });
});

describe('GET /next 객관식 distractor 안전 가드 (design-audit WS-0f)', () => {
  // exam_questions 는 UPDATE 트리거 차단(0004/0038) → input_type='multiple_choice' +
  // distractors 를 raw INSERT 로 주입(seedExamQuestion 미지원 컬럼).
  function seedMcQuestion(id: string, answer: string, distractorsJson: string): void {
    ctx.raw
      .prepare(
        `INSERT INTO exam_questions
           (id, year, round, question_number, subject, content, answer, explanation,
            related_nodes, status, exam_type, confusion_type, input_type, distractors)
         VALUES (?, 2024, 11, 5, NULL, 'MC 문제', ?, NULL, NULL, 'active', '2nd', NULL,
                 'multiple_choice', ?)`,
      )
      .run(id, answer, distractorsJson);
  }

  it('정답과 normalize 동치인 distractor 존재 → MC 셔플 거부, choices=null (fallback)', async () => {
    seedUser('u1', 'u1@test.com');
    // 정답 '보험가액' vs distractor '보험 가액'(공백만 차이) = normalizeAnswer 후 동치 → 채점 모순 위험
    seedMcQuestion(
      'eq-dup',
      '보험가액',
      JSON.stringify(['보험 가액', '손해액', '면책금', '보험금액']),
    );
    const res = await fetchAs('u1', '/next?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    expect(q.choices).toBeNull(); // 가드 발동 → 객관식 미구성 (fill_blank 강등)
  });

  it('distractor 간 중복 → MC 셔플 거부, choices=null', async () => {
    seedUser('u1', 'u1@test.com');
    seedMcQuestion(
      'eq-dup2',
      '보험가액',
      JSON.stringify(['손해액', '손해액', '면책금', '보험금액']),
    );
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    expect(body.questions![0].choices).toBeNull();
  });

  it('보기 전부 distinct → 정상 MC choices 5개', async () => {
    seedUser('u1', 'u1@test.com');
    seedMcQuestion(
      'eq-ok',
      '보험가액',
      JSON.stringify(['손해액', '면책금', '보험금액', '자기부담금']),
    );
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    expect(q.choices).not.toBeNull();
    expect(q.choices).toHaveLength(5);
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

// ---------------------------------------------------------------------------
// Step 3-UX-5c — /mode + /session + /grade streak/session 통합 테스트
// ---------------------------------------------------------------------------

interface StreakBody {
  readonly current: number;
  readonly longest: number;
  readonly dailyGoalProgress: number;
}

interface SessionProgressBody {
  readonly id: string;
  readonly phase: 'warmup' | 'main' | 'cooldown' | 'completed';
  readonly cardsCompleted: number;
  readonly cardsPlanned: number;
  readonly correctCount: number;
}

interface GradeResponseBody extends StudyResponseBody {
  readonly streak?: StreakBody;
  readonly session?: SessionProgressBody;
  readonly correctLabel?: string;
}

interface ModeStatsBody {
  readonly examId: string;
  readonly examType: '1st' | '2nd';
  readonly modes: ReadonlyArray<{ mode: string; available: number }>;
  readonly weakTop: ReadonlyArray<{ cardId: string; subject: string | null; weakScore: number }>;
  readonly confusionTypes: ReadonlyArray<{ type: string; count: number }>;
  readonly streak: { current: number; longest: number; dailyGoalProgress: number };
  readonly dailyGoal: number;
}

interface ModeStartBody {
  readonly sessionId: string;
  readonly mode: string;
  readonly phase: 'warmup' | 'main' | 'cooldown' | 'completed';
  readonly cardsPlanned: number;
  readonly cardsCompleted: number;
  readonly correctCount: number;
  readonly startedAt: string;
}

interface SessionBody {
  readonly id: string;
  readonly mode: string;
  readonly modeParams: Record<string, unknown> | null;
  readonly phase: 'warmup' | 'main' | 'cooldown' | 'completed';
  readonly cardsPlanned: number;
  readonly cardsCompleted: number;
  readonly correctCount: number;
  readonly startedAt: string;
  readonly endedAt: string | null;
}

interface WeakDeltaBody {
  readonly available: boolean;
  readonly cardsReviewed: number;
  readonly stillWeakCount: number;
  readonly bySubject: ReadonlyArray<{
    subject: string | null;
    reviewed: number;
    stillWeak: number;
  }>;
}

interface SessionCompleteBody extends SessionBody {
  readonly correctRate: number;
  readonly durationMinutes: number;
  readonly weakDelta: WeakDeltaBody;
}

interface NextWithSessionBody extends StudyResponseBody {
  readonly session?: { id: string; mode: string; phase: string };
}

describe('GET /api/study/mode', () => {
  it('미인증 → 401', async () => {
    const res = await createStudyRoutes().fetch(
      new Request(`http://test.local${withExamId('/mode')}`),
      env(),
    );
    expect(res.status).toBe(401);
  });

  it('examId 누락 → 422', async () => {
    seedUser('u1', 'u1@test.com');
    const token = await accessToken('u1');
    const res = await createStudyRoutes().fetch(
      new Request('http://test.local/mode', {
        headers: { Cookie: `${ACCESS_TOKEN_COOKIE}=${token}` },
      }),
      env(),
    );
    expect(res.status).toBe(422);
  });

  it('빈 데이터 → 5 mode 모두 available=0, weakTop 빈 배열', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/mode?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModeStatsBody;
    expect(body.modes).toHaveLength(5);
    expect(body.modes.map((m) => m.mode).sort()).toEqual([
      'category',
      'confusion',
      'mixed',
      'topic',
      'weak',
    ]);
    for (const m of body.modes) expect(m.available).toBe(0);
    expect(body.weakTop).toEqual([]);
    expect(body.confusionTypes).toEqual([]);
  });

  // Step 3-UX-6e backend M-D1 흡수 — study-read group rate-limit 60/min.
  // /mode + /progress + /session/:id + /session/:id/complete 4 endpoint 공유 카운터.
  // /grade와 분리 (userId:study-read suffix) — 학습 정상 흐름 보장.
  it('study-read rate-limit: /mode 60/min 초과 시 429 + Retry-After', async () => {
    seedUser('u1', 'u1@test.com');
    // 60회 정상 시도
    for (let i = 0; i < 60; i++) {
      const res = await fetchAs('u1', '/mode?examType=2nd');
      expect([200, 429]).toContain(res.status);
    }
    // 61회째 — 429 RATE_LIMIT_EXCEEDED + Retry-After
    const blocked = await fetchAs('u1', '/mode?examType=2nd');
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as StudyResponseBody;
    expect(body.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(blocked.headers.get('Retry-After')).not.toBeNull();
  });

  it('study-read rate-limit: /grade와 /mode 카운터 분리 (group suffix)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-rl-sep', answer: '1', examType: '2nd' });
    // /grade 20회 (분당 20 cap 도달)
    for (let i = 0; i < 20; i++) {
      const res = await fetchAs('u1', '/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'eq-rl-sep', userAnswer: '1' }),
      });
      expect([200, 404]).toContain(res.status);
    }
    // /grade 21회째 — 429 (기존 패턴)
    const gradeBlocked = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-rl-sep', userAnswer: '1' }),
    });
    expect(gradeBlocked.status).toBe(429);

    // /mode는 별도 group이므로 정상 200
    const modeOk = await fetchAs('u1', '/mode?examType=2nd');
    expect(modeOk.status).toBe(200);
  });

  it('streak_records 부재 → streak {0, 0, 0} + dailyGoal 20 (Step 3-UX-6c-2 ADR-040 G-1)', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/mode?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModeStatsBody;
    expect(body.streak).toEqual({ current: 0, longest: 0, dailyGoalProgress: 0 });
    expect(body.dailyGoal).toBe(20);
  });

  it('streak_records 존재 → streak 영속값 + dailyGoalProgress 0 (today review 0)', async () => {
    seedUser('u1', 'u1@test.com');
    seedStreakRecord({
      userId: 'u1',
      currentStreak: 5,
      longestStreak: 7,
      lastStudyDate: '2026-05-12',
      dailyGoal: 30,
    });
    const res = await fetchAs('u1', '/mode?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModeStatsBody;
    expect(body.streak.current).toBe(5);
    expect(body.streak.longest).toBe(7);
    expect(body.streak.dailyGoalProgress).toBe(0);
    expect(body.dailyGoal).toBe(30);
  });

  it('dailyGoalProgress — 같은 카드 N회 review = 1장 학습 (DISTINCT card_id, 4-Pass M-3 흡수)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-dg', examType: '2nd' });
    seedStreakRecord({ userId: 'u1', dailyGoal: 10 });
    // 같은 카드 5회 review (today)
    const sid = seedStudySession({ userId: 'u1', phase: 'main' });
    for (let i = 0; i < 5; i++) {
      seedStudyReview({ userId: 'u1', cardId: 'eq-dg', sessionId: sid });
    }
    const res = await fetchAs('u1', '/mode?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModeStatsBody;
    // 5회 review가 100%(5/10×2)가 아닌 10%(1/10)로 surface → 정직성 정합.
    expect(body.streak.dailyGoalProgress).toBeCloseTo(0.1);
  });

  it('exam_type 필터 + weak top + confusion breakdown', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-c1', examType: '2nd', confusionType: 'numeric' });
    seedExamQuestion({ id: 'eq-c2', examType: '2nd', confusionType: 'numeric' });
    seedExamQuestion({ id: 'eq-other', examType: '1st' }); // 다른 examType 제외
    // user_progress weak_score
    seedProgressForQuestion({ userId: 'u1', questionId: 'eq-c1', weakScore: 0.7 });
    seedProgressForQuestion({ userId: 'u1', questionId: 'eq-c2', weakScore: 0.3 });

    const res = await fetchAs('u1', '/mode?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModeStatsBody;
    const category = body.modes.find((m) => m.mode === 'category');
    expect(category?.available).toBe(2); // 2nd 만
    const weak = body.modes.find((m) => m.mode === 'weak');
    expect(weak?.available).toBe(2);
    const confusion = body.modes.find((m) => m.mode === 'confusion');
    expect(confusion?.available).toBe(2);
    // weakTop 정렬 검증 (DESC)
    expect(body.weakTop).toHaveLength(2);
    expect(body.weakTop[0].cardId).toBe('eq-c1');
    expect(body.weakTop[0].weakScore).toBeCloseTo(0.7);
    expect(body.weakTop[1].cardId).toBe('eq-c2');
    // confusionTypes
    expect(body.confusionTypes).toEqual([{ type: 'numeric', count: 2 }]);
  });
});

interface ProgressBody {
  readonly examId: string;
  readonly examType: '1st' | '2nd';
  readonly days: number;
  readonly dailyGoal: number;
  readonly daily: ReadonlyArray<{ date: string; cardsDistinct: number; isToday: boolean }>;
  readonly subjects: ReadonlyArray<{
    subject: string;
    total: number;
    mastered: number;
    masteryPct: number;
  }>;
  readonly streak: { current: number; longest: number; dailyGoalProgress: number };
}

describe('GET /api/study/progress (Step 3-UX-6d)', () => {
  it('미인증 → 401', async () => {
    const res = await createStudyRoutes().fetch(
      new Request(`http://test.local${withExamId('/progress')}`),
      env(),
    );
    expect(res.status).toBe(401);
  });

  it('days 누락 → 기본 7일 + daily 7건 + subjects 빈 배열 + streak 통합', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/progress?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProgressBody;
    expect(body.days).toBe(7);
    expect(body.daily).toHaveLength(7);
    expect(body.daily[body.daily.length - 1].isToday).toBe(true); // 마지막은 오늘
    expect(body.daily[0].isToday).toBe(false);
    expect(body.dailyGoal).toBe(20);
    expect(body.subjects).toEqual([]);
    // C-P1 흡수 — streak block 통합 응답.
    expect(body.streak).toEqual({ current: 0, longest: 0, dailyGoalProgress: 0 });
  });

  it('streak — 오늘 review 시 dailyGoalProgress 비율 정확 + current/longest 영속값', async () => {
    seedUser('u1', 'u1@test.com');
    seedStreakRecord({
      userId: 'u1',
      currentStreak: 3,
      longestStreak: 5,
      lastStudyDate: '2026-05-12',
      dailyGoal: 10,
    });
    seedExamQuestion({ id: 'eq-pg1', examType: '2nd' });
    seedExamQuestion({ id: 'eq-pg2', examType: '2nd' });
    const sid = seedStudySession({ userId: 'u1', phase: 'main' });
    seedStudyReview({ userId: 'u1', cardId: 'eq-pg1', sessionId: sid });
    seedStudyReview({ userId: 'u1', cardId: 'eq-pg2', sessionId: sid });
    const res = await fetchAs('u1', '/progress?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProgressBody;
    expect(body.streak.current).toBe(3);
    expect(body.streak.longest).toBe(5);
    expect(body.streak.dailyGoalProgress).toBeCloseTo(0.2); // 2 distinct / 10 goal
  });

  it('days=30 → daily 30건 + 일자 오름차순', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/progress?examType=2nd&days=30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProgressBody;
    expect(body.days).toBe(30);
    expect(body.daily).toHaveLength(30);
    // 일자 단조 증가
    for (let i = 1; i < body.daily.length; i++) {
      expect(body.daily[i].date > body.daily[i - 1].date).toBe(true);
    }
  });

  it('days=0 → 422', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/progress?examType=2nd&days=0');
    expect(res.status).toBe(422);
  });

  it('days=31 → 422 (상한 초과)', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/progress?examType=2nd&days=31');
    expect(res.status).toBe(422);
  });

  it('subjects 마스터 집계 + DESC ORDER (총 카드 수)', async () => {
    seedUser('u1', 'u1@test.com');
    // 보험 일반: 3 카드, 2 마스터. 농작물재해보험: 2 카드, 1 마스터. 미분류 (subject NULL): 제외.
    seedExamQuestion({ id: 'eq-s1', examType: '2nd', subject: '보험 일반' });
    seedExamQuestion({ id: 'eq-s2', examType: '2nd', subject: '보험 일반' });
    seedExamQuestion({ id: 'eq-s3', examType: '2nd', subject: '보험 일반' });
    seedExamQuestion({ id: 'eq-s4', examType: '2nd', subject: '농작물재해보험' });
    seedExamQuestion({ id: 'eq-s5', examType: '2nd', subject: '농작물재해보험' });
    seedExamQuestion({ id: 'eq-s6', examType: '2nd', subject: null }); // 제외
    // mastered_at은 seedProgressForQuestion helper에 없어 raw INSERT.
    const insertMastered = (cardId: string, masteredAt: string | null): void => {
      ctx.raw
        .prepare(
          `INSERT INTO user_progress
             (id, user_id, node_id, card_id, card_type, fsrs_difficulty, fsrs_stability,
              fsrs_interval, fsrs_next_review, total_reviews, correct_count, weak_score,
              mastered_at)
           VALUES (?, ?, NULL, ?, 'exam', 0.3, 30.0, 30, NULL, 5, 5, 0, ?)`,
        )
        .run(crypto.randomUUID(), 'u1', cardId, masteredAt);
    };
    insertMastered('eq-s1', '2026-05-01T00:00:00Z');
    insertMastered('eq-s2', '2026-05-02T00:00:00Z');
    // eq-s3은 progress 없음 (un-mastered, count는 active 모수)
    insertMastered('eq-s4', '2026-05-03T00:00:00Z');
    // eq-s5는 progress 없음

    const res = await fetchAs('u1', '/progress?examType=2nd&days=7');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProgressBody;
    expect(body.subjects).toHaveLength(2); // NULL subject 제외
    const 보험 = body.subjects.find((s) => s.subject === '보험 일반');
    expect(보험).toEqual({
      subject: '보험 일반',
      total: 3,
      mastered: 2,
      masteryPct: 2 / 3,
    });
    const 농작물 = body.subjects.find((s) => s.subject === '농작물재해보험');
    expect(농작물).toEqual({
      subject: '농작물재해보험',
      total: 2,
      mastered: 1,
      masteryPct: 0.5,
    });
    // total DESC ORDER 검증
    expect(body.subjects[0].total).toBeGreaterThanOrEqual(body.subjects[1].total);
  });

  it('daily — 같은 카드 N회 review = 1장 학습 (DISTINCT card_id 정합)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-d1', examType: '2nd' });
    const sid = seedStudySession({ userId: 'u1', phase: 'main' });
    // 같은 카드 3회 review (오늘)
    for (let i = 0; i < 3; i++) {
      seedStudyReview({ userId: 'u1', cardId: 'eq-d1', sessionId: sid });
    }
    const res = await fetchAs('u1', '/progress?examType=2nd&days=7');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProgressBody;
    const todayEntry = body.daily.find((d) => d.isToday);
    expect(todayEntry?.cardsDistinct).toBe(1); // 3회 review가 1장으로 dedupe
  });

  it('사용자 격리 (u2 review가 u1 daily 미반영)', async () => {
    seedUser('u1', 'u1@test.com');
    seedUser('u2', 'u2@test.com');
    seedExamQuestion({ id: 'eq-iso-p', examType: '2nd' });
    const sid = seedStudySession({ userId: 'u2' });
    seedStudyReview({ userId: 'u2', cardId: 'eq-iso-p', sessionId: sid });
    const res = await fetchAs('u1', '/progress?examType=2nd&days=7');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProgressBody;
    const todayEntry = body.daily.find((d) => d.isToday);
    expect(todayEntry?.cardsDistinct).toBe(0);
  });
});

describe('POST /api/study/mode/start', () => {
  it('mode + cardsPlanned 정상 → sessionId 생성', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/mode/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'weak', cardsPlanned: 20 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModeStartBody;
    expect(body.mode).toBe('weak');
    expect(body.phase).toBe('warmup');
    expect(body.cardsPlanned).toBe(20);
    expect(body.cardsCompleted).toBe(0);
    expect(typeof body.sessionId).toBe('string');
    expect(body.sessionId.length).toBeGreaterThan(0);
    // DB 영속 검증
    const row = ctx.raw
      .prepare(`SELECT * FROM study_sessions WHERE id = ?`)
      .get(body.sessionId) as { user_id: string; mode: string; cards_planned: number };
    expect(row.user_id).toBe('u1');
    expect(row.mode).toBe('weak');
    expect(row.cards_planned).toBe(20);
  });

  it('잘못된 mode → 422', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/mode/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'invalid', cardsPlanned: 10 }),
    });
    expect(res.status).toBe(422);
  });

  it('cardsPlanned 0 → 422', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/mode/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'mixed', cardsPlanned: 0 }),
    });
    expect(res.status).toBe(422);
  });

  it('cardsPlanned 201 → 422 (상한 초과)', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/mode/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'mixed', cardsPlanned: 201 }),
    });
    expect(res.status).toBe(422);
  });

  it('modeParams JSON 영속', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/mode/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'topic',
        modeParams: { conceptId: 'CONCEPT-001' },
        cardsPlanned: 10,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModeStartBody;
    const row = ctx.raw
      .prepare(`SELECT mode_params FROM study_sessions WHERE id = ?`)
      .get(body.sessionId) as { mode_params: string };
    expect(JSON.parse(row.mode_params)).toEqual({ conceptId: 'CONCEPT-001' });
  });
});

describe('GET /api/study/session/:id', () => {
  it('미존재 → 404', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/session/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('다른 user → 403', async () => {
    seedUser('u1', 'u1@test.com');
    seedUser('u2', 'u2@test.com');
    const sid = seedStudySession({ userId: 'u2', mode: 'weak', cardsPlanned: 10 });
    const res = await fetchAs('u1', `/session/${sid}`);
    expect(res.status).toBe(403);
  });

  it('소유자 → 200 + 정상 fields', async () => {
    seedUser('u1', 'u1@test.com');
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'mixed',
      phase: 'main',
      cardsPlanned: 20,
      cardsCompleted: 5,
      correctCount: 3,
    });
    const res = await fetchAs('u1', `/session/${sid}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionBody;
    expect(body.id).toBe(sid);
    expect(body.mode).toBe('mixed');
    expect(body.phase).toBe('main');
    expect(body.cardsPlanned).toBe(20);
    expect(body.cardsCompleted).toBe(5);
    expect(body.correctCount).toBe(3);
  });
});

describe('POST /api/study/session/:id/complete', () => {
  it('미존재 → 404', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/session/00000000-0000-0000-0000-000000000000/complete', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  it('다른 user → 403', async () => {
    seedUser('u1', 'u1@test.com');
    seedUser('u2', 'u2@test.com');
    const sid = seedStudySession({ userId: 'u2' });
    const res = await fetchAs('u1', `/session/${sid}/complete`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('정상 → phase=completed + ended_at 설정 + summary', async () => {
    seedUser('u1', 'u1@test.com');
    const startedAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'weak',
      phase: 'main',
      cardsPlanned: 20,
      cardsCompleted: 12,
      correctCount: 9,
      startedAt,
    });
    const res = await fetchAs('u1', `/session/${sid}/complete`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionCompleteBody;
    expect(body.phase).toBe('completed');
    expect(body.endedAt).not.toBeNull();
    expect(body.correctRate).toBeCloseTo(9 / 12);
    expect(body.durationMinutes).toBeGreaterThan(0);
    // DB 영속 검증
    const row = ctx.raw
      .prepare(`SELECT phase, ended_at FROM study_sessions WHERE id = ?`)
      .get(sid) as { phase: string; ended_at: string | null };
    expect(row.phase).toBe('completed');
    expect(row.ended_at).not.toBeNull();
  });

  it('weakDelta — 세션 review 0건 → available=true + empty bySubject (Step 3-UX-6c-2 ADR-040 G-2)', async () => {
    seedUser('u1', 'u1@test.com');
    const sid = seedStudySession({ userId: 'u1', phase: 'main' });
    const res = await fetchAs('u1', `/session/${sid}/complete`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionCompleteBody;
    expect(body.weakDelta).toEqual({
      available: true,
      cardsReviewed: 0,
      stillWeakCount: 0,
      bySubject: [],
    });
  });

  it('weakDelta — subject 단위 reviewed/stillWeak 집계 + 중복 카드 dedupe', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-w1', examType: '2nd', subject: '보험 일반' });
    seedExamQuestion({ id: 'eq-w2', examType: '2nd', subject: '보험 일반' });
    seedExamQuestion({ id: 'eq-w3', examType: '2nd', subject: '농작물재해보험' });
    seedExamQuestion({ id: 'eq-w4', examType: '2nd', subject: '농작물재해보험' });
    // w1, w2: 약점 잔존 (weak_score > 0). w3: 약점 해소 (weak_score = 0). w4: progress 없음.
    seedProgressForQuestion({ userId: 'u1', questionId: 'eq-w1', weakScore: 0.5 });
    seedProgressForQuestion({ userId: 'u1', questionId: 'eq-w2', weakScore: 0.2 });
    seedProgressForQuestion({ userId: 'u1', questionId: 'eq-w3', weakScore: 0 });

    const sid = seedStudySession({ userId: 'u1', phase: 'main', cardsCompleted: 5 });
    // eq-w1 두 번 review (dedupe 검증) + 나머지 1회씩.
    seedStudyReview({ userId: 'u1', cardId: 'eq-w1', sessionId: sid });
    seedStudyReview({ userId: 'u1', cardId: 'eq-w1', sessionId: sid });
    seedStudyReview({ userId: 'u1', cardId: 'eq-w2', sessionId: sid });
    seedStudyReview({ userId: 'u1', cardId: 'eq-w3', sessionId: sid });
    seedStudyReview({ userId: 'u1', cardId: 'eq-w4', sessionId: sid });

    const res = await fetchAs('u1', `/session/${sid}/complete`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionCompleteBody;
    expect(body.weakDelta.available).toBe(true);
    expect(body.weakDelta.cardsReviewed).toBe(4); // dedupe (eq-w1 두 번 → 1회)
    expect(body.weakDelta.stillWeakCount).toBe(2); // eq-w1, eq-w2
    const 보험 = body.weakDelta.bySubject.find((s) => s.subject === '보험 일반');
    expect(보험).toEqual({ subject: '보험 일반', reviewed: 2, stillWeak: 2 });
    const 농작물 = body.weakDelta.bySubject.find((s) => s.subject === '농작물재해보험');
    expect(농작물).toEqual({ subject: '농작물재해보험', reviewed: 2, stillWeak: 0 });
  });

  it('weakDelta — 다른 사용자 세션 review 격리 (user_id 필터)', async () => {
    seedUser('u1', 'u1@test.com');
    seedUser('u2', 'u2@test.com');
    seedExamQuestion({ id: 'eq-iso', examType: '2nd', subject: '격리테스트' });
    seedProgressForQuestion({ userId: 'u2', questionId: 'eq-iso', weakScore: 0.9 });
    const sid = seedStudySession({ userId: 'u1', phase: 'main' });
    // u2의 review를 동일 session_id로 영속 (FK 검증 우회 시뮬레이션)
    seedStudyReview({ userId: 'u2', cardId: 'eq-iso', sessionId: sid });

    const res = await fetchAs('u1', `/session/${sid}/complete`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionCompleteBody;
    expect(body.weakDelta.cardsReviewed).toBe(0); // u1 review 0건
  });

  it('이미 completed 세션 → idempotent (200 + 기존 ended_at 보존)', async () => {
    seedUser('u1', 'u1@test.com');
    const endedAt = new Date(Date.now() - 60_000).toISOString();
    const sid = seedStudySession({
      userId: 'u1',
      phase: 'completed',
      cardsCompleted: 10,
      cardsPlanned: 10,
      endedAt,
    });
    const res = await fetchAs('u1', `/session/${sid}/complete`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionCompleteBody;
    expect(body.endedAt).toBe(endedAt); // 기존 값 보존
  });
});

describe('POST /api/study/grade — Step 3-UX-5c streak + session 통합', () => {
  it('streak null → current=1, dailyGoalProgress > 0', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-streak-1', answer: '1' });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-streak-1', userAnswer: '1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GradeResponseBody;
    expect(body.streak?.current).toBe(1);
    expect(body.streak?.longest).toBe(1);
    expect(body.streak?.dailyGoalProgress).toBeGreaterThan(0);
    // DB 영속
    const row = ctx.raw
      .prepare(`SELECT current_streak, longest_streak FROM streak_records WHERE user_id='u1'`)
      .get() as { current_streak: number; longest_streak: number };
    expect(row.current_streak).toBe(1);
  });

  it('streak 어제 → current 누적', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-streak-2', answer: '1' });
    // 어제 last_study_date
    const yesterday = new Date(Date.now() - 86400_000).toISOString().substring(0, 10);
    seedStreakRecord({
      userId: 'u1',
      currentStreak: 3,
      longestStreak: 5,
      lastStudyDate: yesterday,
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-streak-2', userAnswer: '1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GradeResponseBody;
    expect(body.streak?.current).toBe(4); // 3 + 1
    expect(body.streak?.longest).toBe(5); // unchanged (4 < 5)
  });

  it('streak gap (2일 이상 공백) → current reset to 1', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-streak-3', answer: '1' });
    const twoDaysAgo = new Date(Date.now() - 86400_000 * 2).toISOString().substring(0, 10);
    seedStreakRecord({
      userId: 'u1',
      currentStreak: 7,
      longestStreak: 10,
      lastStudyDate: twoDaysAgo,
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-streak-3', userAnswer: '1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GradeResponseBody;
    expect(body.streak?.current).toBe(1); // reset
    expect(body.streak?.longest).toBe(10); // 보존
  });

  it('sessionId 통합 → cards_completed += 1 + correct_count += 1', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-sess-1', answer: '1' });
    const sid = seedStudySession({ userId: 'u1', mode: 'mixed', cardsPlanned: 20 });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-sess-1', userAnswer: '1', sessionId: sid }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GradeResponseBody;
    expect(body.session?.cardsCompleted).toBe(1);
    expect(body.session?.correctCount).toBe(1);
    expect(body.session?.phase).toBe('warmup'); // 1/20 = 5% < 20%
  });

  it('sessionId 다른 user → 403', async () => {
    seedUser('u1', 'u1@test.com');
    seedUser('u2', 'u2@test.com');
    seedExamQuestion({ id: 'eq-sess-2', answer: '1' });
    const sid = seedStudySession({ userId: 'u2' });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-sess-2', userAnswer: '1', sessionId: sid }),
    });
    expect(res.status).toBe(403);
  });

  it('sessionId completed → 409', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-sess-3', answer: '1' });
    const sid = seedStudySession({
      userId: 'u1',
      phase: 'completed',
      endedAt: new Date().toISOString(),
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-sess-3', userAnswer: '1', sessionId: sid }),
    });
    expect(res.status).toBe(409);
  });

  it('phase 자동 진행 — main threshold 도달', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-phase-1', answer: '1' });
    // cardsPlanned=10, cardsCompleted=1 → 다음 grade로 2/10=20% → main
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'mixed',
      cardsPlanned: 10,
      cardsCompleted: 1,
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-phase-1', userAnswer: '1', sessionId: sid }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GradeResponseBody;
    expect(body.session?.phase).toBe('main');
    expect(body.session?.cardsCompleted).toBe(2);
  });

  it('phase 자동 진행 — cards_planned 도달 시 completed + ended_at', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-phase-2', answer: '1' });
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'mixed',
      cardsPlanned: 2,
      cardsCompleted: 1,
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-phase-2', userAnswer: '1', sessionId: sid }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GradeResponseBody;
    expect(body.session?.phase).toBe('completed');
    expect(body.session?.cardsCompleted).toBe(2);
    const row = ctx.raw
      .prepare(`SELECT phase, ended_at FROM study_sessions WHERE id = ?`)
      .get(sid) as { phase: string; ended_at: string | null };
    expect(row.phase).toBe('completed');
    expect(row.ended_at).not.toBeNull();
  });

  it('study_reviews.session_id FK 채워짐 (sessionId 제공 시)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-fk-1', answer: '1' });
    const sid = seedStudySession({ userId: 'u1', mode: 'mixed', cardsPlanned: 5 });
    await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-fk-1', userAnswer: '1', sessionId: sid }),
    });
    const row = ctx.raw
      .prepare(`SELECT session_id FROM study_reviews WHERE user_id='u1' AND card_id='eq-fk-1'`)
      .get() as { session_id: string | null };
    expect(row.session_id).toBe(sid);
  });
});

describe('GET /api/study/next — Step 3-UX-5c sessionId session block', () => {
  it('sessionId 미제공 → session block 미포함 (backward-compat)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-next-1', examType: '2nd' });
    const res = await fetchAs('u1', '/next?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as NextWithSessionBody;
    expect(body.session).toBeUndefined();
  });

  it('sessionId 제공 → session block (id/mode/phase) 포함', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-next-2', examType: '2nd' });
    const sid = seedStudySession({ userId: 'u1', mode: 'weak', cardsPlanned: 20 });
    const res = await fetchAs('u1', `/next?examType=2nd&sessionId=${sid}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as NextWithSessionBody;
    expect(body.session?.id).toBe(sid);
    expect(body.session?.mode).toBe('weak');
    expect(body.session?.phase).toBe('warmup');
  });

  it('sessionId 다른 user → 403', async () => {
    seedUser('u1', 'u1@test.com');
    seedUser('u2', 'u2@test.com');
    const sid = seedStudySession({ userId: 'u2' });
    const res = await fetchAs('u1', `/next?examType=2nd&sessionId=${sid}`);
    expect(res.status).toBe(403);
  });

  it('weak mode → weak_score DESC ORDER (높은 weak 카드 먼저)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-w-low', examType: '2nd' });
    seedExamQuestion({ id: 'eq-w-high', examType: '2nd' });
    seedExamQuestion({ id: 'eq-w-mid', examType: '2nd' });
    // 모두 user_progress 영속 (미시도 우선 차단 위해)
    seedProgressForQuestion({
      userId: 'u1',
      questionId: 'eq-w-low',
      totalReviews: 1,
      correctCount: 1,
      weakScore: 0.1,
    });
    seedProgressForQuestion({
      userId: 'u1',
      questionId: 'eq-w-high',
      totalReviews: 1,
      correctCount: 0,
      weakScore: 0.9,
    });
    seedProgressForQuestion({
      userId: 'u1',
      questionId: 'eq-w-mid',
      totalReviews: 1,
      correctCount: 1,
      weakScore: 0.5,
    });
    const sid = seedStudySession({ userId: 'u1', mode: 'weak', cardsPlanned: 20 });
    const res = await fetchAs('u1', `/next?examType=2nd&sessionId=${sid}&count=3`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as NextWithSessionBody;
    expect(body.questions).toHaveLength(3);
    expect(body.questions![0].id).toBe('eq-w-high');
    expect(body.questions![1].id).toBe('eq-w-mid');
    expect(body.questions![2].id).toBe('eq-w-low');
  });

  it('exhausted (questions 0건) + sessionId → session block 응답 유지', async () => {
    seedUser('u1', 'u1@test.com');
    // exam_questions 0건
    const sid = seedStudySession({ userId: 'u1', mode: 'mixed', cardsPlanned: 10 });
    const res = await fetchAs('u1', `/next?examType=2nd&sessionId=${sid}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as NextWithSessionBody;
    expect(body.exhausted).toBe(true);
    expect(body.questions).toEqual([]);
    expect(body.session?.id).toBe(sid);
  });
});

// ---------------------------------------------------------------------------
// Step 3-UX-5c follow-up (5-페르소나 흡수) — 경계값 + race + 누락 시나리오
// ---------------------------------------------------------------------------

describe('phase 경계값 — 0.2 main / 0.8 cooldown / 1.0 completed', () => {
  it('★ cooldown 진입 — 8/10 (정확 0.8 경계) → cooldown', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-cool-1', answer: '1' });
    // cards_completed=7 → 다음 grade로 8/10=80% (cooldown 경계)
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'mixed',
      cardsPlanned: 10,
      cardsCompleted: 7,
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-cool-1', userAnswer: '1', sessionId: sid }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GradeResponseBody;
    expect(body.session?.phase).toBe('cooldown');
    expect(body.session?.cardsCompleted).toBe(8);
  });

  it('★ cooldown 유지 — 9/10 (between 0.8 and 1.0) → cooldown', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-cool-2', answer: '1' });
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'mixed',
      cardsPlanned: 10,
      cardsCompleted: 8,
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-cool-2', userAnswer: '1', sessionId: sid }),
    });
    const body = (await res.json()) as GradeResponseBody;
    expect(body.session?.phase).toBe('cooldown');
    expect(body.session?.cardsCompleted).toBe(9);
  });

  it('★ completed boundary — 99/100 → 100/100 정확히 completed', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-comp-100', answer: '1' });
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'mixed',
      cardsPlanned: 100,
      cardsCompleted: 99,
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-comp-100', userAnswer: '1', sessionId: sid }),
    });
    const body = (await res.json()) as GradeResponseBody;
    expect(body.session?.phase).toBe('completed');
    expect(body.session?.cardsCompleted).toBe(100);
    const row = ctx.raw
      .prepare(`SELECT phase, ended_at FROM study_sessions WHERE id = ?`)
      .get(sid) as { phase: string; ended_at: string | null };
    expect(row.phase).toBe('completed');
    expect(row.ended_at).not.toBeNull();
  });
});

describe('동시 grade race — SQL식 증분 + UPSERT atomic 검증', () => {
  it('★ 동시 2 grade — cards_completed += 2 (race-safe SQL 증분)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-race-1', answer: '1' });
    seedExamQuestion({ id: 'eq-race-2', answer: '1' });
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'mixed',
      cardsPlanned: 100,
      cardsCompleted: 0,
    });
    // Promise.all 2 grade 동시 호출 — SQL식 증분이라 둘 다 +1 적용
    await Promise.all([
      fetchAs('u1', '/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'eq-race-1', userAnswer: '1', sessionId: sid }),
      }),
      fetchAs('u1', '/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'eq-race-2', userAnswer: '1', sessionId: sid }),
      }),
    ]);
    const row = ctx.raw
      .prepare(`SELECT cards_completed, correct_count FROM study_sessions WHERE id = ?`)
      .get(sid) as { cards_completed: number; correct_count: number };
    expect(row.cards_completed).toBe(2);
    expect(row.correct_count).toBe(2);
  });

  it('★ 동시 2 grade same-day — streak idempotent (WHERE 절 no-op)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-streak-race-1', answer: '1' });
    seedExamQuestion({ id: 'eq-streak-race-2', answer: '1' });
    await Promise.all([
      fetchAs('u1', '/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'eq-streak-race-1', userAnswer: '1' }),
      }),
      fetchAs('u1', '/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'eq-streak-race-2', userAnswer: '1' }),
      }),
    ]);
    // 둘 다 첫 학습이고 today 동일이므로 current_streak는 1 (idempotent)
    const row = ctx.raw
      .prepare(`SELECT current_streak, longest_streak FROM streak_records WHERE user_id='u1'`)
      .get() as { current_streak: number; longest_streak: number };
    expect(row.current_streak).toBe(1);
    expect(row.longest_streak).toBe(1);
  });

  it('★ daily_goal 사용자 설정 보존 — UPSERT가 default 20으로 덮지 않음', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-goal-1', answer: '1' });
    // user가 daily_goal=50 설정한 상태
    seedStreakRecord({
      userId: 'u1',
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
      dailyGoal: 50,
    });
    await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-goal-1', userAnswer: '1' }),
    });
    const row = ctx.raw
      .prepare(`SELECT daily_goal, current_streak FROM streak_records WHERE user_id='u1'`)
      .get() as { daily_goal: number; current_streak: number };
    expect(row.daily_goal).toBe(50); // 보존
    expect(row.current_streak).toBe(1); // 정상 갱신
  });
});

describe('weak user 격리 — /mode weakTop이 다른 user 데이터 누설 X', () => {
  it('★ u1 weakTop에 u2의 weak 카드 부재', async () => {
    seedUser('u1', 'u1@test.com');
    seedUser('u2', 'u2@test.com');
    seedExamQuestion({ id: 'eq-iso-1', examType: '2nd' });
    seedExamQuestion({ id: 'eq-iso-2', examType: '2nd' });
    seedProgressForQuestion({ userId: 'u1', questionId: 'eq-iso-1', weakScore: 0.3 });
    seedProgressForQuestion({ userId: 'u2', questionId: 'eq-iso-2', weakScore: 0.9 });
    const res = await fetchAs('u1', '/mode?examType=2nd');
    const body = (await res.json()) as ModeStatsBody;
    expect(body.weakTop).toHaveLength(1);
    expect(body.weakTop[0].cardId).toBe('eq-iso-1');
    expect(body.weakTop.find((w) => w.cardId === 'eq-iso-2')).toBeUndefined();
  });
});
