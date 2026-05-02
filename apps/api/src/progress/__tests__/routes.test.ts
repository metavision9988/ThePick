/**
 * Progress routes 단위 테스트 (Phase 1 Step 1-5 나).
 *
 * 실제 SQLite (node:sqlite) + migrations 9종 전부 적용 → user_progress 테이블 실제 트리거
 * 위에서 검증. Fake D1 자기참조 회피 (Level 3 감사 review-20260422-195030 교훈).
 *
 * 커버 시나리오:
 *   - GET  /summary   — 인증/미인증/위조 JWT/다른 유저 격리/누적 집계
 *   - POST /review    — Zod 실패/미존재 노드/INSERT/UPSERT 카운트 증가
 *   - GET  /due       — 빈 결과/due 포함/미래 제외/다른 유저 격리
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_COOKIE, EXAM_IDS } from '@thepick/shared';
import { createD1FromSqlite, type SqliteBackedD1 } from '../../__tests__/helpers/d1-from-sqlite.js';
import { signAccessToken } from '../../auth/session.js';
import { createProgressRoutes, type ProgressBindings } from '../routes.js';

const VALID_JWT_SECRET = 'progress-test-jwt-secret-32bytes-plus-v1';

let ctx: SqliteBackedD1;

beforeEach(() => {
  ctx = createD1FromSqlite();
});

afterEach(() => {
  ctx.close();
});

function env(): ProgressBindings {
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

function seedNode(id: string): void {
  ctx.raw
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status)
       VALUES (?, 'CONCEPT', '테스트 노드', '999', 2026, 5, 'draft')`,
    )
    .run(id);
}

function seedProgress(params: {
  userId: string;
  nodeId: string;
  cardType: string;
  totalReviews?: number;
  correctCount?: number;
  fsrsNextReview?: string | null;
}): string {
  // Pass 1 M-2 (2026-04-23): FSRS 필드를 DEFAULT 대신 명시적으로 주입.
  // migrations NOT NULL 트리거가 DEFAULT 평가 순서에 의존하면 silent 실패 가능.
  const id = crypto.randomUUID();
  ctx.raw
    .prepare(
      `INSERT INTO user_progress
         (id, user_id, node_id, card_type, fsrs_difficulty, fsrs_stability, fsrs_interval,
          fsrs_next_review, total_reviews, correct_count)
       VALUES (?, ?, ?, ?, 0.3, 1.0, 1, ?, ?, ?)`,
    )
    .run(
      id,
      params.userId,
      params.nodeId,
      params.cardType,
      params.fsrsNextReview ?? null,
      params.totalReviews ?? 0,
      params.correctCount ?? 0,
    );
  return id;
}

async function accessToken(
  userId: string,
  sessionId: string = crypto.randomUUID(),
): Promise<string> {
  return signAccessToken(userId, sessionId, VALID_JWT_SECRET);
}

// Phase 1 5-페르소나 B-C1 흡수 — examId query 시그니처 강제 (Hard Rule 16).
// 테스트 helper 가 모든 path 에 examId 기본 주입 (이미 query 가 있으면 그대로 둠).
// 명시적으로 invalid examId 검증하려는 케이스만 path 에 ?examId= 직접 전달.
function withExamId(path: string): string {
  if (path.includes('examId=')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}examId=${EXAM_IDS.SON_HAE_PYEONG_GA_SA}`;
}

async function call(path: string, init: RequestInit = {}, token?: string): Promise<Response> {
  const app = createProgressRoutes();
  const headers = new Headers(init.headers);
  if (token !== undefined) {
    headers.set('cookie', `${ACCESS_TOKEN_COOKIE}=${token}`);
  }
  return app.request(withExamId(path), { ...init, headers }, env());
}

interface SummaryBody {
  readonly totalCards: number;
  readonly totalReviews: number;
  readonly correctCount: number;
  readonly accuracy: number;
}

interface ReviewBody {
  readonly ok: boolean;
  readonly progressId: string;
  readonly created: boolean;
}

interface DueItem {
  readonly id: string;
  readonly nodeId: string | null;
  readonly cardType: string;
  readonly fsrsNextReview: string | null;
}

interface DueBody {
  readonly items: readonly DueItem[];
  readonly count: number;
}

// ---------------------------------------------------------------------------
// GET /summary
// ---------------------------------------------------------------------------

describe('GET /api/progress/summary', () => {
  it('미인증 요청 → 401', async () => {
    const res = await call('/summary');
    expect(res.status).toBe(401);
  });

  it('위조된 JWT → 401', async () => {
    const res = await call('/summary', {}, 'not.a.valid.jwt');
    expect(res.status).toBe(401);
  });

  it('인증 + 0건 → 기본값 집계', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'solo@example.com');
    const token = await accessToken(userId);

    const res = await call('/summary', {}, token);

    expect(res.status).toBe(200);
    const body = (await res.json()) as SummaryBody;
    expect(body).toEqual({ totalCards: 0, totalReviews: 0, correctCount: 0, accuracy: 0 });
  });

  it('누적 집계 정확 (15건 중 10건 정답)', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'agg@example.com');
    seedNode('CONCEPT-AGG-1');
    seedNode('CONCEPT-AGG-2');
    seedProgress({
      userId,
      nodeId: 'CONCEPT-AGG-1',
      cardType: 'flashcard',
      totalReviews: 10,
      correctCount: 7,
    });
    seedProgress({
      userId,
      nodeId: 'CONCEPT-AGG-2',
      cardType: 'ox',
      totalReviews: 5,
      correctCount: 3,
    });

    const token = await accessToken(userId);
    const res = await call('/summary', {}, token);
    const body = (await res.json()) as SummaryBody;

    expect(body.totalCards).toBe(2);
    expect(body.totalReviews).toBe(15);
    expect(body.correctCount).toBe(10);
    expect(body.accuracy).toBeCloseTo(10 / 15, 3);
  });

  it('다른 유저 데이터 섞이지 않음', async () => {
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();
    seedUser(userA, 'a@example.com');
    seedUser(userB, 'b@example.com');
    seedNode('CONCEPT-ISO-1');
    seedProgress({
      userId: userB,
      nodeId: 'CONCEPT-ISO-1',
      cardType: 'flashcard',
      totalReviews: 100,
      correctCount: 99,
    });

    const tokenA = await accessToken(userA);
    const res = await call('/summary', {}, tokenA);
    const body = (await res.json()) as SummaryBody;

    expect(body.totalCards).toBe(0);
    expect(body.totalReviews).toBe(0);
    expect(body.correctCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// POST /review
// ---------------------------------------------------------------------------

describe('POST /api/progress/review', () => {
  it('미인증 요청 → 401', async () => {
    const res = await call('/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeId: 'x', cardType: 'flashcard', correct: true }),
    });
    expect(res.status).toBe(401);
  });

  it('잘못된 cardType → 422', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'validate@example.com');
    const token = await accessToken(userId);

    const res = await call(
      '/review',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'CONCEPT-XYZ',
          cardType: 'unknown-type',
          correct: true,
        }),
      },
      token,
    );
    expect(res.status).toBe(422);
  });

  it('body 파싱 실패 → 422', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'badbody@example.com');
    const token = await accessToken(userId);

    const res = await call(
      '/review',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      },
      token,
    );
    expect(res.status).toBe(422);
  });

  it('미존재 nodeId → 404', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'missing@example.com');
    const token = await accessToken(userId);

    const res = await call(
      '/review',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId: 'DOES-NOT-EXIST', cardType: 'flashcard', correct: true }),
      },
      token,
    );
    expect(res.status).toBe(404);
  });

  it('정상 INSERT → 201 + created=true + DB 반영', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'insert@example.com');
    seedNode('CONCEPT-INS-1');
    const token = await accessToken(userId);

    const res = await call(
      '/review',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId: 'CONCEPT-INS-1', cardType: 'flashcard', correct: true }),
      },
      token,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as ReviewBody;
    expect(body.ok).toBe(true);
    expect(body.created).toBe(true);

    const row = ctx.raw
      .prepare(`SELECT total_reviews, correct_count FROM user_progress WHERE id = ?`)
      .get(body.progressId) as { total_reviews: number; correct_count: number };
    expect(row.total_reviews).toBe(1);
    expect(row.correct_count).toBe(1);
  });

  it('동일 (user, node, cardType) 재호출 → 200 + created=false + 카운트 증가', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'upsert@example.com');
    seedNode('CONCEPT-UPS-1');
    const token = await accessToken(userId);

    const r1 = await call(
      '/review',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId: 'CONCEPT-UPS-1', cardType: 'flashcard', correct: true }),
      },
      token,
    );
    expect(r1.status).toBe(201);
    const b1 = (await r1.json()) as ReviewBody;

    const r2 = await call(
      '/review',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId: 'CONCEPT-UPS-1', cardType: 'flashcard', correct: false }),
      },
      token,
    );
    expect(r2.status).toBe(200);
    const b2 = (await r2.json()) as ReviewBody;
    expect(b2.created).toBe(false);
    expect(b2.progressId).toBe(b1.progressId);

    const row = ctx.raw
      .prepare(`SELECT total_reviews, correct_count FROM user_progress WHERE id = ?`)
      .get(b1.progressId) as { total_reviews: number; correct_count: number };
    expect(row.total_reviews).toBe(2);
    expect(row.correct_count).toBe(1);
  });

  // limitPerMinute=20 E2E 회귀 방지 (NC-신규 MAJOR, 2026-04-24).
  // review 라우트에 하향된 20/min 한도가 실제로 적용되는지 검증. 60 이 아닌
  // 20 경계에서 차단되는지 확인 — 향후 routes.ts:150 의 limitPerMinute: 20
  // 가 실수로 60/min 기본으로 환원되면 본 테스트가 회귀 감지한다.
  it('review 라우트는 20/min 한도 적용 — 21번째 요청 429 Retry-After', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'ratelimit@example.com');
    seedNode('CONCEPT-RL-1');
    const token = await accessToken(userId);

    // 20회까지 정상 처리 (유효 nodeId 로 201/200 응답 — rate-limit 전 카운트만 소비)
    for (let i = 0; i < 20; i++) {
      const r = await call(
        '/review',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nodeId: 'CONCEPT-RL-1',
            cardType: 'flashcard',
            correct: i % 2 === 0,
          }),
        },
        token,
      );
      expect([200, 201]).toContain(r.status);
    }

    // 21번째는 20/min 한도 초과 — 429 + Retry-After 헤더
    const blocked = await call(
      '/review',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId: 'CONCEPT-RL-1', cardType: 'flashcard', correct: true }),
      },
      token,
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).not.toBeNull();
    const blockedBody = (await blocked.json()) as { error: string };
    expect(blockedBody.error).toBe('RATE_LIMIT_EXCEEDED');
  });
});

// ---------------------------------------------------------------------------
// GET /due
// ---------------------------------------------------------------------------

describe('GET /api/progress/due', () => {
  it('미인증 → 401', async () => {
    const res = await call('/due');
    expect(res.status).toBe(401);
  });

  it('due 없음 → 빈 배열', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'empty@example.com');
    const token = await accessToken(userId);

    const res = await call('/due', {}, token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as DueBody;
    expect(body.items).toEqual([]);
    expect(body.count).toBe(0);
  });

  it('fsrs_next_review 과거 → due 포함', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'due@example.com');
    seedNode('CONCEPT-DUE-1');
    seedProgress({
      userId,
      nodeId: 'CONCEPT-DUE-1',
      cardType: 'flashcard',
      fsrsNextReview: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    });

    const token = await accessToken(userId);
    const res = await call('/due', {}, token);
    const body = (await res.json()) as DueBody;

    expect(body.count).toBe(1);
    expect(body.items[0]!.nodeId).toBe('CONCEPT-DUE-1');
    expect(body.items[0]!.cardType).toBe('flashcard');
  });

  it('fsrs_next_review NULL → due 포함 (처음 본 카드)', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'firstseen@example.com');
    seedNode('CONCEPT-FIRST-1');
    seedProgress({
      userId,
      nodeId: 'CONCEPT-FIRST-1',
      cardType: 'flashcard',
      fsrsNextReview: null,
    });

    const token = await accessToken(userId);
    const res = await call('/due', {}, token);
    const body = (await res.json()) as DueBody;
    expect(body.count).toBe(1);
  });

  it('fsrs_next_review 미래 → 제외', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'future@example.com');
    seedNode('CONCEPT-FUT-1');
    seedProgress({
      userId,
      nodeId: 'CONCEPT-FUT-1',
      cardType: 'flashcard',
      fsrsNextReview: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });

    const token = await accessToken(userId);
    const res = await call('/due', {}, token);
    const body = (await res.json()) as DueBody;
    expect(body.count).toBe(0);
  });

  it('다른 유저 due 섞이지 않음', async () => {
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();
    seedUser(userA, 'due-a@example.com');
    seedUser(userB, 'due-b@example.com');
    seedNode('CONCEPT-ISO-DUE');
    seedProgress({
      userId: userB,
      nodeId: 'CONCEPT-ISO-DUE',
      cardType: 'flashcard',
      fsrsNextReview: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    });

    const tokenA = await accessToken(userA);
    const res = await call('/due', {}, tokenA);
    const body = (await res.json()) as DueBody;
    expect(body.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 1 5-페르소나 B-C1 흡수 — Hard Rule 16 examId 시그니처 검증
// ---------------------------------------------------------------------------

describe('Hard Rule 16 — examId 시그니처 강제', () => {
  it('GET /summary examId query 부재 → 422', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'no-examid@example.com');
    const token = await accessToken(userId);
    // call() helper 가 자동 주입하므로 여기서는 직접 app.request 사용
    const app = createProgressRoutes();
    const headers = new Headers();
    headers.set('cookie', `${ACCESS_TOKEN_COOKIE}=${token}`);
    const res = await app.request('/summary', { headers }, env());
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('examId');
  });

  it('GET /summary examId 빈 문자열 → 422', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'empty-examid@example.com');
    const token = await accessToken(userId);
    const app = createProgressRoutes();
    const headers = new Headers();
    headers.set('cookie', `${ACCESS_TOKEN_COOKIE}=${token}`);
    const res = await app.request('/summary?examId=', { headers }, env());
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toMatch(/examId.*empty/);
  });

  it('GET /summary 잘못된 examId → 422 (Hard Rule 17 EXAM_IDS allowlist)', async () => {
    const userId = crypto.randomUUID();
    seedUser(userId, 'invalid-examid@example.com');
    const token = await accessToken(userId);
    const app = createProgressRoutes();
    const headers = new Headers();
    headers.set('cookie', `${ACCESS_TOKEN_COOKIE}=${token}`);
    const res = await app.request('/summary?examId=invalid-exam-id', { headers }, env());
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('Invalid examId');
  });
});
