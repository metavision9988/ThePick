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
import { gradeFillBlank, normalizeAnswer, todayDateString } from '@thepick/learning-modes';
// ADR-048 (결재 #10) — 구현-정의 일치 테스트(G-WS5 ④)가 저장값을 D2 산식으로 역검증.
import { computeWeakScore, normalizeStability } from '@thepick/srs';

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

/**
 * 노드를 approved 로 승격 (status_transitions INSERT — Hard Limit 준수: 본문 UPDATE 아님).
 *
 * ★ 2026-08-06 (역이식 STAGE 0-4): 그전까지 enrichRelatedNodes 가 `is_current_active=1` 만 봐서
 *   **draft 노드도 학습자 출처 표면에 그대로 나왔고**, 그래서 이 헬퍼 없이 테스트가 통과했다.
 *   이제 approved 도출(단일 진실원)을 타므로 승격이 명시적으로 필요하다 —
 *   즉 이 헬퍼의 존재 자체가 "학습자에게는 승인된 것만 보인다"는 계약의 표현이다.
 */
function approveNode(id: string): void {
  ctx.raw
    .prepare(
      `INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id)
       VALUES (?, 'node', ?, 'draft', 'approved', 'test-approver')`,
    )
    .run(`st-${id}`, id);
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
  /** WS-5a — object 는 JSON 직렬화, string 은 원문 그대로(파손 JSON 시나리오용). */
  modeParams?: Record<string, unknown> | string | null;
}): string {
  const id = params.id ?? crypto.randomUUID();
  const modeParamsValue =
    params.modeParams === undefined || params.modeParams === null
      ? null
      : typeof params.modeParams === 'string'
        ? params.modeParams
        : JSON.stringify(params.modeParams);
  ctx.raw
    .prepare(
      `INSERT INTO study_sessions
         (id, user_id, started_at, ended_at, mode, mode_params, phase,
          cards_planned, cards_completed, correct_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      params.userId,
      params.startedAt ?? new Date().toISOString(),
      params.endedAt ?? null,
      params.mode ?? 'mixed',
      modeParamsValue,
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
    approveNode('CONCEPT-001');
    approveNode('LAW-007');
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

  // ── ★ 노출 계약 음성 실측 (2026-08-06, 역이식 STAGE 0-4) ────────────────────
  // 수리 전 enrichRelatedNodes 는 `is_current_active=1` 만 봤다. 즉 미승인(draft)·미시행 노드가
  // 학습자 출처 표면(GET /next · POST /grade sourceCitation)에 그대로 나갈 수 있었다.
  // production 데이터가 *우연히* 전부 approved 라 사고가 안 났을 뿐이므로, 그 우연에 기대지 않도록
  // 부정 케이스를 상주시킨다. 규율: 가드는 만든 즉시 고의로 깨서 red 를 확인한다.
  it('★draft 노드는 학습자 출처에 노출되지 않는다 (승인 전 유출 차단)', async () => {
    seedUser('u1', 'u1@test.com');
    seedNode('CONCEPT-001', '승인된 개념', 'CONCEPT', 100);
    approveNode('CONCEPT-001');
    seedNode('CONCEPT-999', '미승인 개념', 'CONCEPT', 777); // 승격 없음 = draft
    seedExamQuestion({
      id: 'eq-draft-leak',
      examType: '2nd',
      relatedNodes: ['CONCEPT-001', 'CONCEPT-999'],
    });
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    expect(q.relatedNodes.map((n) => n.id)).toEqual(['CONCEPT-001']);
    expect(q.sourceCitations.manualPages).toEqual([100]); // 777 = draft 페이지, 새면 안 된다
  });

  it('★시행 전(valid_from 미래) 노드는 학습자 출처에 노출되지 않는다', async () => {
    seedUser('u1', 'u1@test.com');
    seedNode('CONCEPT-001', '현행 개념', 'CONCEPT', 100);
    approveNode('CONCEPT-001');
    seedNode('CONCEPT-888', '미시행 개정 개념', 'CONCEPT', 888);
    approveNode('CONCEPT-888');
    // 0041 백필 경로(NULL→값 1회)로 시행일을 미래로 스탬프
    ctx.raw
      .prepare(`UPDATE knowledge_nodes SET valid_from = '2999-01-01' WHERE id = ?`)
      .run('CONCEPT-888');
    seedExamQuestion({
      id: 'eq-future-node',
      examType: '2nd',
      relatedNodes: ['CONCEPT-001', 'CONCEPT-888'],
    });
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    expect(q.relatedNodes.map((n) => n.id)).toEqual(['CONCEPT-001']);
    expect(q.sourceCitations.manualPages).toEqual([100]);
  });

  it('★포맷 내성 — valid_from 이 datetime 이어도 시행 당일 하루를 잃지 않는다', async () => {
    // 독립 리뷰 수리: 초판은 TEXT 사전순 비교라 '2026-08-15T00:00:00Z' <= '2026-08-15' 가 거짓 →
    // 시행 당일 통째 누락. 0044 가 실제로 datetime 을 찍는 선례가 있어 혼입은 가정이 아니라 예상 경로다.
    seedUser('u1', 'u1@test.com');
    seedNode('CONCEPT-001', '오늘부터 시행(날짜형)', 'CONCEPT', 100);
    approveNode('CONCEPT-001');
    seedNode('CONCEPT-002', '오늘부터 시행(datetime형)', 'CONCEPT', 200);
    approveNode('CONCEPT-002');
    const todayKst = ctx.raw.prepare(`SELECT date('now','+9 hours') AS d`).get() as { d: string };
    ctx.raw
      .prepare(`UPDATE knowledge_nodes SET valid_from = ? WHERE id = 'CONCEPT-001'`)
      .run(todayKst.d);
    ctx.raw
      .prepare(`UPDATE knowledge_nodes SET valid_from = ? WHERE id = 'CONCEPT-002'`)
      .run(`${todayKst.d}T00:00:00Z`);
    seedExamQuestion({
      id: 'eq-fmt',
      examType: '2nd',
      relatedNodes: ['CONCEPT-001', 'CONCEPT-002'],
    });
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    // 두 포맷 다 "오늘부터 시행" 이므로 둘 다 보여야 한다
    expect(q.relatedNodes.map((n) => n.id).sort()).toEqual(['CONCEPT-001', 'CONCEPT-002']);
  });

  it('★만료(valid_until 과거) 노드도 노출되지 않는다 — 반개구간 [from, until)', async () => {
    seedUser('u1', 'u1@test.com');
    seedNode('CONCEPT-001', '현행 개념', 'CONCEPT', 100);
    approveNode('CONCEPT-001');
    seedNode('CONCEPT-777', '실효된 구본', 'CONCEPT', 555);
    approveNode('CONCEPT-777');
    ctx.raw
      .prepare(`UPDATE knowledge_nodes SET valid_until = '2020-01-01' WHERE id = ?`)
      .run('CONCEPT-777');
    seedExamQuestion({
      id: 'eq-expired-node',
      examType: '2nd',
      relatedNodes: ['CONCEPT-001', 'CONCEPT-777'],
    });
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    expect(q.relatedNodes.map((n) => n.id)).toEqual(['CONCEPT-001']);
    expect(q.sourceCitations.manualPages).toEqual([100]);
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

describe('GET /next 객관식 가드 (WS-0f 동치 + 결재 #2 위치 라벨형 계약)', () => {
  // exam_questions 는 UPDATE 트리거 차단(0004/0038) → input_type='multiple_choice' +
  // distractors 를 raw INSERT 로 주입(seedExamQuestion 미지원 컬럼).
  // 신 계약 (결재 #2, 2026-06-11): distractors = 보기 전체 배열(원본 순서),
  // answer = 1-based 위치 라벨.
  function seedMcQuestion(id: string, answer: string, choicesJson: string): void {
    ctx.raw
      .prepare(
        `INSERT INTO exam_questions
           (id, year, round, question_number, subject, content, answer, explanation,
            related_nodes, status, exam_type, confusion_type, input_type, distractors)
         VALUES (?, 2024, 11, 5, NULL, 'MC 문제', ?, NULL, NULL, 'active', '2nd', NULL,
                 'multiple_choice', ?)`,
      )
      .run(id, answer, choicesJson);
  }

  it('보기 간 normalize 동치 존재 → MC 셔플 거부, choices=null (WS-0f fallback)', async () => {
    seedUser('u1', 'u1@test.com');
    // '보험가액' vs '보험 가액'(공백만 차이) = normalizeAnswer 후 동치 → 위치 채점 불공정 위험
    seedMcQuestion('eq-dup', '1', JSON.stringify(['보험가액', '보험 가액', '손해액', '면책금']));
    const res = await fetchAs('u1', '/next?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    expect(q.choices).toBeNull(); // 가드 발동 → 객관식 미구성 (fill_blank 강등)
  });

  it('answer 위치가 보기 수 초과 (적재 결함) → 계약 위반 거부, choices=null (결재 #2 검증)', async () => {
    seedUser('u1', 'u1@test.com');
    seedMcQuestion('eq-oob', '4', JSON.stringify(['손해액', '면책금', '보험금액'])); // 보기 3개에 answer "4"
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    expect(body.questions![0].choices).toBeNull();
  });

  it('정상 4지선다 (answer="3", 보기 4) → MC choices 4개', async () => {
    seedUser('u1', 'u1@test.com');
    seedMcQuestion('eq-ok', '3', JSON.stringify(['손해액', '면책금', '보험금액', '자기부담금']));
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    const q = body.questions![0];
    expect(q.choices).not.toBeNull();
    expect(q.choices).toHaveLength(4); // 보기 전체 배열 그대로 (정답 텍스트 prepend 폐기)
  });

  it('★ 결합 (G-WS1): 적재→셔플→채점 — 정답 위치 보기 제출 = 정답, 타 보기 = 오답', async () => {
    seedUser('u1', 'u1@test.com');
    seedMcQuestion('eq-grade', '2', JSON.stringify(['손해액', '면책금', '보험금액', '자기부담금']));
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    const choices = body.questions![0].choices!;
    expect(choices).toHaveLength(4);
    // 서버와 동일 시드로 셔플 재현 불가(일자 시드) → 서빙된 라벨 전수를 /grade 에 제출.
    // 리뷰 P12-M2 강화: "정답 1개 존재" 가 아니라 **어느 보기가 정답인지**(text='면책금')
    // 까지 단언 — off-by-one/위치 시프트 회귀 시 "잘못된 보기 1개 정답" 도 잡는다.
    for (const c of choices) {
      const g = await fetchAs('u1', '/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: 'eq-grade',
          userAnswer: c.label,
          inputType: 'multiple_choice',
        }),
      });
      const gb = (await g.json()) as StudyResponseBody;
      expect(gb.isCorrect).toBe(c.text === '면책금'); // 위치 2 보기만 정답
    }
  });

  it('distractors 에 빈/공백 원소 (적재 결함) → 무음 filter 금지, 서빙 거부 (리뷰 C-1)', async () => {
    seedUser('u1', 'u1@test.com');
    // 구 filter 구현이면 "" 가 떨어져 보기 3개가 되고 answer "3" 이 잘못된 보기를 가리킴.
    seedMcQuestion('eq-mal', '3', JSON.stringify(['손해액', '', '보험금액', '자기부담금']));
    const res = await fetchAs('u1', '/next?examType=2nd');
    const body = (await res.json()) as StudyResponseBody;
    expect(body.questions![0].choices).toBeNull(); // 위치 오염 대신 거부 (안전 강등)
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
    approveNode('CONCEPT-001');
    approveNode('LAW-007');
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
// ADR-048 (결재 #10 (a) 단계 집행) — weak_score D2 정의 복원 구현-정의 일치 (G-WS5 ④)
//   α축 = subject 단위 사용자 정답률 (user_progress ⋈ exam_questions.subject 집계)
//   β축 = 카드 자신의 FSRS stability 폴백 (node FSRS 누적 미구현 — 2단계 이연)
// 저장된 weak_score 를 D2 산식(computeWeakScore)으로 역검증 — FSRS 내부값 하드코딩 없이
// 영속 row 의 fsrs_stability 를 β 입력으로 재계산해 α 배선(집계 vs 카드 단위)을 판별한다.
// ---------------------------------------------------------------------------

describe('POST /api/study/grade — weak_score D2 복원 (ADR-048)', () => {
  function progressRowFor(
    userId: string,
    questionId: string,
  ): { weak_score: number; fsrs_stability: number } {
    return ctx.raw
      .prepare(
        `SELECT weak_score, fsrs_stability FROM user_progress
           WHERE user_id = ? AND card_id = ? AND card_type = 'exam' AND node_id IS NULL`,
      )
      .get(userId, questionId) as { weak_score: number; fsrs_stability: number };
  }

  it('α축 — subject 집계가 여러 카드 리뷰를 횡단 반영 (카드 1건 아님) + 타과목 격리', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-s1', subject: '농작물재해보험 손해평가', answer: '1' });
    seedExamQuestion({ id: 'eq-s2', subject: '농작물재해보험 손해평가', answer: '1' });
    seedExamQuestion({ id: 'eq-x1', subject: '상법(보험편)', answer: '1' });
    // 같은 과목 다른 카드의 이력 — subject 집계에 반영되어야 함 (4시도 1정답).
    seedProgressForQuestion({
      userId: 'u1',
      questionId: 'eq-s1',
      totalReviews: 4,
      correctCount: 1,
    });
    // 다른 과목 poison — 집계에 새면 rate 가 크게 왜곡됨 (10/10 전부 정답).
    seedProgressForQuestion({
      userId: 'u1',
      questionId: 'eq-x1',
      totalReviews: 10,
      correctCount: 10,
    });

    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-s2', userAnswer: '1' }),
    });
    expect(res.status).toBe(200);

    const row = progressRowFor('u1', 'eq-s2');
    // 과목 집계: (1 + 본리뷰 정답 1) / (4 + 본리뷰 1) = 2/5 = 0.4 — eq-x1 10/10 은 제외.
    const expected = computeWeakScore({
      subjectCorrectRate: 2 / 5,
      conceptStability: row.fsrs_stability,
    });
    expect(row.weak_score).toBeCloseTo(expected, 10);
    // 반증: 카드 단위(구 Silent Pivot)라면 rate=1/1=1 → α성분 0 으로 더 낮은 값이어야 함.
    const cardLevelWould = computeWeakScore({
      subjectCorrectRate: 1,
      conceptStability: row.fsrs_stability,
    });
    expect(row.weak_score).toBeGreaterThan(cardLevelWould + 0.3);
  });

  it('α축 — 다른 user 의 같은 과목 이력은 집계 제외 (사용자 격리)', async () => {
    seedUser('u1', 'u1@test.com');
    seedUser('u2', 'u2@test.com');
    seedExamQuestion({ id: 'eq-iso-s', subject: '재배학', answer: '1' });
    seedExamQuestion({ id: 'eq-iso-t', subject: '재배학', answer: '1' });
    // u2 의 같은 과목 대량 오답 이력 — u1 집계에 새면 안 됨.
    seedProgressForQuestion({
      userId: 'u2',
      questionId: 'eq-iso-s',
      totalReviews: 10,
      correctCount: 0,
    });

    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-iso-t', userAnswer: '1' }),
    });
    expect(res.status).toBe(200);

    const row = progressRowFor('u1', 'eq-iso-t');
    // u1 의 과목 이력은 본 리뷰 1건뿐 → rate = 1/1.
    const expected = computeWeakScore({
      subjectCorrectRate: 1,
      conceptStability: row.fsrs_stability,
    });
    expect(row.weak_score).toBeCloseTo(expected, 10);
  });

  it('α축 — subject NULL 문항은 카드 단위 폴백 (NULL 을 과목으로 뭉치지 않음)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-n1', subject: null, answer: '1' });
    seedExamQuestion({ id: 'eq-n2', subject: null, answer: '1' });
    // NULL-subject poison — NULL 끼리 집계됐다면 rate 왜곡 (5시도 0정답).
    // (seed 고정 FSRS 값은 본 카드가 재채점되지 않는 한 FSRS 미접촉 — 집계 대상만.)
    seedProgressForQuestion({
      userId: 'u1',
      questionId: 'eq-n1',
      totalReviews: 5,
      correctCount: 0,
    });
    // 채점 카드 자신의 이력은 실제 /grade 2회로 구성 (정답 1 + 오답 1 = UPDATE 경로 검증).
    await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-n2', userAnswer: '1' }),
    });
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-n2', userAnswer: '9' }),
    });
    expect(res.status).toBe(200);

    const row = progressRowFor('u1', 'eq-n2');
    // 카드 단위 폴백: (정답 1) / (2시도) = 0.5. NULL 횡단 집계라면 (0+1)/(5+2) = 1/7 로 달라짐.
    const expected = computeWeakScore({
      subjectCorrectRate: 1 / 2,
      conceptStability: row.fsrs_stability,
    });
    expect(row.weak_score).toBeCloseTo(expected, 10);
  });

  it('β축 폴백 — 영속된 카드 fsrs_stability 로 β 성분 정합 (2단계 전 정직 폴백)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-beta', subject: '수확량조사', answer: '1' });

    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-beta', userAnswer: '1' }),
    });
    expect(res.status).toBe(200);

    const row = progressRowFor('u1', 'eq-beta');
    // α성분 0 (rate 1/1) → weak_score 전체가 β·(1 − normalize(카드 stability)) 와 일치해야 함.
    const expected = computeWeakScore({
      subjectCorrectRate: 1,
      conceptStability: row.fsrs_stability,
    });
    expect(row.weak_score).toBeCloseTo(expected, 10);
    // 첫 정답 카드 stability 는 마스터 임계(30일) 미만 → β 폴백이 실제로 기여 (0 아님).
    expect(normalizeStability(row.fsrs_stability)).toBeLessThan(1);
    expect(row.weak_score).toBeGreaterThan(0);
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
  readonly modes: ReadonlyArray<{ mode: string; available: number; wired: boolean }>;
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

  // WS-0d 모드 정직성 (결재 #9 위임 = 비활성 표기, 2026-06-11) — wired 가 서버 단일 진실원.
  // WS-5a (2026-06-12): category 배선 → true (topic/confusion 은 데이터 실측상 미배선 잔류).
  it('wired — weak/mixed/category 만 true, 미배선 topic/confusion 은 false', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/mode?examType=2nd');
    const body = (await res.json()) as ModeStatsBody;
    const wiredOf = new Map(body.modes.map((m) => [m.mode, m.wired]));
    expect(wiredOf.get('weak')).toBe(true);
    expect(wiredOf.get('mixed')).toBe(true);
    expect(wiredOf.get('category')).toBe(true);
    expect(wiredOf.get('topic')).toBe(false);
    expect(wiredOf.get('confusion')).toBe(false);
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
    seedExamQuestion({ id: 'eq-c1', examType: '2nd', confusionType: 'numeric', subject: '2과목' });
    seedExamQuestion({ id: 'eq-c2', examType: '2nd', confusionType: 'numeric', subject: null });
    seedExamQuestion({ id: 'eq-other', examType: '1st' }); // 다른 examType 제외
    // user_progress weak_score
    seedProgressForQuestion({ userId: 'u1', questionId: 'eq-c1', weakScore: 0.7 });
    seedProgressForQuestion({ userId: 'u1', questionId: 'eq-c2', weakScore: 0.3 });

    const res = await fetchAs('u1', '/mode?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModeStatsBody;
    const category = body.modes.find((m) => m.mode === 'category');
    // WS-5a G1 정합 — category available = subject NOT NULL 풀 (구 total 의미에서 변경).
    expect(category?.available).toBe(1);
    const mixedRow = body.modes.find((m) => m.mode === 'mixed');
    expect(mixedRow?.available).toBe(2); // 2nd 전체 (NULL subject 포함)
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
    // WS-0d: topic 은 미배선(422) → 배선된 weak 로 modeParams 영속 검증 (검증 의도 동일).
    const res = await fetchAs('u1', '/mode/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'weak',
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

  // WS-0d 모드 정직성 — 미배선 모드는 서버가 거부 (UI disabled 의 API 우회 차단).
  // WS-5a (2026-06-12): category 배선 → 본 목록에서 제외 (topic/confusion 잔류 —
  // topic_cluster 0/534·confusion 데이터 NULL 실측, S10 전 비활성).
  it('미배선 모드(topic/confusion) → 422 MODE_NOT_AVAILABLE', async () => {
    seedUser('u1', 'u1@test.com');
    for (const mode of ['topic', 'confusion'] as const) {
      const res = await fetchAs('u1', '/mode/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, cardsPlanned: 10 }),
      });
      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string; wiredModes: string[] };
      expect(body.error).toBe('MODE_NOT_AVAILABLE');
      expect(body.wiredModes.sort()).toEqual(['category', 'mixed', 'weak']);
    }
  });
});

// ---------------------------------------------------------------------------
// WS-5a — category 모드 배선 (ADR-039: category = subject 단위 학습)
// ---------------------------------------------------------------------------

describe('WS-5a — category 모드 배선 (/mode/start subject 검증 + /next WHERE 필터)', () => {
  it('/mode/start category — modeParams.subject 누락 → 422 MODE_PARAMS_INVALID', async () => {
    seedUser('u1', 'u1@test.com');
    for (const body of [
      { mode: 'category', cardsPlanned: 10 },
      { mode: 'category', modeParams: {}, cardsPlanned: 10 },
      { mode: 'category', modeParams: { subject: '' }, cardsPlanned: 10 },
      { mode: 'category', modeParams: { subject: '   ' }, cardsPlanned: 10 },
      { mode: 'category', modeParams: { subject: 42 }, cardsPlanned: 10 },
      { mode: 'category', modeParams: { subject: 'x'.repeat(101) }, cardsPlanned: 10 },
    ]) {
      const res = await fetchAs('u1', '/mode/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(422);
      const resBody = (await res.json()) as { error: string };
      expect(resBody.error).toBe('MODE_PARAMS_INVALID');
    }
  });

  it('/mode/start category — 유효 subject → 200 + mode_params 영속', async () => {
    seedUser('u1', 'u1@test.com');
    const res = await fetchAs('u1', '/mode/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'category',
        modeParams: { subject: '상법 보험편' },
        cardsPlanned: 10,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModeStartBody;
    expect(body.mode).toBe('category');
    const row = ctx.raw
      .prepare(`SELECT mode_params FROM study_sessions WHERE id = ?`)
      .get(body.sessionId) as { mode_params: string };
    expect(JSON.parse(row.mode_params)).toEqual({ subject: '상법 보험편' });
  });

  it('/next category session → subject WHERE 필터 적용 (타 과목 제외)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-cat-law-1', examType: '2nd', subject: '상법 보험편' });
    seedExamQuestion({ id: 'eq-cat-law-2', examType: '2nd', subject: '상법 보험편' });
    seedExamQuestion({ id: 'eq-cat-agri-1', examType: '2nd', subject: '농학개론' });
    seedExamQuestion({ id: 'eq-cat-null-1', examType: '2nd', subject: null });
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'category',
      modeParams: { subject: '상법 보험편' },
      cardsPlanned: 10,
    });
    const res = await fetchAs('u1', `/next?examType=2nd&sessionId=${sid}&count=5`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as NextWithSessionBody;
    expect(body.exhausted).toBe(false);
    expect(body.questions!.map((q) => q.id).sort()).toEqual(['eq-cat-law-1', 'eq-cat-law-2']);
    expect(body.session?.mode).toBe('category');
  });

  it('/next category session — 해당 subject 0건 → exhausted (무필터 폴백 금지)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-cat-other', examType: '2nd', subject: '농학개론' });
    const sid = seedStudySession({
      userId: 'u1',
      mode: 'category',
      modeParams: { subject: '상법 보험편' },
      cardsPlanned: 10,
    });
    const res = await fetchAs('u1', `/next?examType=2nd&sessionId=${sid}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as NextWithSessionBody;
    expect(body.exhausted).toBe(true);
    expect(body.questions).toEqual([]);
  });

  it('/next category session — mode_params 결손/파손 → 422 MODE_PARAMS_INVALID', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-cat-x', examType: '2nd', subject: '상법 보험편' });
    const cases: ReadonlyArray<Record<string, unknown> | string | null> = [
      null,
      '{not-json',
      { conceptId: 'CONCEPT-001' },
      { subject: '' },
    ];
    for (const modeParams of cases) {
      const sid = seedStudySession({
        userId: 'u1',
        mode: 'category',
        modeParams,
        cardsPlanned: 10,
      });
      const res = await fetchAs('u1', `/next?examType=2nd&sessionId=${sid}`);
      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('MODE_PARAMS_INVALID');
    }
  });

  it('/next 비-category 모드 — subject 필터 미적용 (회귀: mixed 전체 풀)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-mix-1', examType: '2nd', subject: '상법 보험편' });
    seedExamQuestion({ id: 'eq-mix-2', examType: '2nd', subject: '농학개론' });
    const sid = seedStudySession({ userId: 'u1', mode: 'mixed', cardsPlanned: 10 });
    const res = await fetchAs('u1', `/next?examType=2nd&sessionId=${sid}&count=5`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as NextWithSessionBody;
    expect(body.questions).toHaveLength(2);
  });

  it('/mode → category wired=true + categorySubjects breakdown (NULL subject 제외)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-md-1', examType: '2nd', subject: '상법 보험편' });
    seedExamQuestion({ id: 'eq-md-2', examType: '2nd', subject: '상법 보험편' });
    seedExamQuestion({ id: 'eq-md-3', examType: '2nd', subject: '농학개론' });
    seedExamQuestion({ id: 'eq-md-4', examType: '2nd', subject: null });
    const res = await fetchAs('u1', '/mode?examType=2nd');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      modes: ReadonlyArray<{ mode: string; wired: boolean; available: number }>;
      categorySubjects: ReadonlyArray<{ subject: string; available: number }>;
    };
    const category = body.modes.find((m) => m.mode === 'category');
    expect(category?.wired).toBe(true);
    const topic = body.modes.find((m) => m.mode === 'topic');
    expect(topic?.wired).toBe(false);
    expect(body.categorySubjects).toEqual([
      { subject: '농학개론', available: 1 },
      { subject: '상법 보험편', available: 2 },
    ]);
  });

  // S9 완료 게이트 G1 (5-페르소나 MAJOR 흡수, 2026-06-12) — "모드별 /next 풀 = available".
  // category: available = Σ categorySubjects = subject NOT NULL 풀(/next eq.subject 필터와
  // 동치 — total 을 빌리면 NULL subject 데이터에서 게이트가 정의상 깨짐). mixed: 전체 풀.
  it('G1 — 모드별 /next 풀 = available 카운트 (category subject별 + mixed)', async () => {
    seedUser('u1', 'u1@test.com');
    seedExamQuestion({ id: 'eq-g1-a1', examType: '2nd', subject: '상법 보험편' });
    seedExamQuestion({ id: 'eq-g1-a2', examType: '2nd', subject: '상법 보험편' });
    seedExamQuestion({ id: 'eq-g1-b1', examType: '2nd', subject: '농학개론' });
    seedExamQuestion({ id: 'eq-g1-n1', examType: '2nd', subject: null });

    const modeRes = await fetchAs('u1', '/mode?examType=2nd');
    const modeBody = (await modeRes.json()) as {
      modes: ReadonlyArray<{ mode: string; available: number }>;
      categorySubjects: ReadonlyArray<{ subject: string; available: number }>;
    };
    const category = modeBody.modes.find((m) => m.mode === 'category')!;
    const mixed = modeBody.modes.find((m) => m.mode === 'mixed')!;
    expect(category.available).toBe(3); // NULL subject 제외 (total 4 아님)
    expect(modeBody.categorySubjects.reduce((s, e) => s + e.available, 0)).toBe(category.available);
    expect(mixed.available).toBe(4);

    for (const entry of modeBody.categorySubjects) {
      const sid = seedStudySession({
        userId: 'u1',
        mode: 'category',
        modeParams: { subject: entry.subject },
        cardsPlanned: 10,
      });
      const res = await fetchAs('u1', `/next?examType=2nd&sessionId=${sid}&count=5`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as NextWithSessionBody;
      expect(body.questions).toHaveLength(entry.available);
    }

    const sidMixed = seedStudySession({ userId: 'u1', mode: 'mixed', cardsPlanned: 10 });
    const resMixed = await fetchAs('u1', `/next?examType=2nd&sessionId=${sidMixed}&count=5`);
    const bodyMixed = (await resMixed.json()) as NextWithSessionBody;
    expect(bodyMixed.questions).toHaveLength(mixed.available);
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
    // 어제 last_study_date — 서버 streak 의 날짜 기준은 todayDateString(KST 기본)이므로
    // 테스트도 동일 기준으로 계산. (구 toISOString=UTC 기반은 KST 00~09시 실행 시
    // 서버 today 와 2일 차로 벌어져 reset 오판 → 시간 윈도우 결함, 2026-06-11 발화로 발견.)
    const yesterday = todayDateString(new Date(Date.now() - 86400_000));
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
    // KST 기준 통일 (리뷰 m-5 정정: gap 테스트는 구 UTC 기반에서도 전 시간대 PASS —
    // KST 00~09시에 3일 전이 되어도 reset 판정 동일. 결함이 아니라 기준 일관성 정비.)
    const twoDaysAgo = todayDateString(new Date(Date.now() - 86400_000 * 2));
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

describe('★0044 이후 계약 — old 행(deprecated) 데이터 정본 자연 배제 (G-OLD-7·8)', () => {
  // 0044 전이 후 old 행 상태 재현: deprecated + superseded_by 백링크.
  function seedDeprecatedOldRow(id: string): void {
    ctx.raw
      .prepare(
        `INSERT INTO exam_questions
           (id, year, round, question_number, subject, content, answer, explanation,
            related_nodes, status, exam_type, confusion_type, input_type, distractors,
            superseded_by)
         VALUES (?, 2023, 9, 1, NULL, '전이된 old 행', '2', NULL, NULL, 'deprecated', '1st',
                 NULL, 'fill_blank', NULL, ?)`,
      )
      .run(id, `${id}-MC`);
  }

  // -MC 서빙행 재현: input_type='multiple_choice' + distractors 계약 성립.
  function seedFirstMcRow(id: string): void {
    ctx.raw
      .prepare(
        `INSERT INTO exam_questions
           (id, year, round, question_number, subject, content, answer, explanation,
            related_nodes, status, exam_type, confusion_type, input_type, distractors)
         VALUES (?, 2023, 9, 1, NULL, '1차 MC 서빙행', '2', NULL, NULL, 'active', '1st',
                 NULL, 'multiple_choice', ?)`,
      )
      .run(id, JSON.stringify(['보험가액', '보험금액', '손해액', '자기부담금']));
  }

  it('★G-OLD-7: /next 는 deprecated old 행을 status 필터로 자연 배제 — 서빙 = 전부 -MC (가드 없이)', async () => {
    seedUser('u1', 'u1@test.com');
    for (let i = 1; i <= 6; i++) {
      seedDeprecatedOldRow(`eq-a-dep-${i}`);
      seedFirstMcRow(`eq-a-dep-${i}-MC`);
    }
    const res = await fetchAs('u1', '/next?examType=1st&count=2');
    expect(res.status).toBe(200);
    const body = (await res.json()) as StudyResponseBody;
    expect(body.exhausted).toBe(false);
    expect(body.questions!.length).toBe(2);
    for (const q of body.questions!) expect(q.id.endsWith('-MC')).toBe(true);
  });

  it('/next examType=1st — 유자격(active) 행 0 이면 정직 exhausted', async () => {
    seedUser('u1', 'u1@test.com');
    seedDeprecatedOldRow('eq-dep-only');
    const res = await fetchAs('u1', '/next?examType=1st');
    const body = (await res.json()) as StudyResponseBody;
    expect(body.exhausted).toBe(true);
  });

  it('/grade — deprecated old 행 채점 요청 → 404 (status=active lookup 자연 차단, 오답 36 채점 불가)', async () => {
    seedUser('u1', 'u1@test.com');
    seedDeprecatedOldRow('eq-dep-g');
    const res = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-dep-g', userAnswer: '2' }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as StudyResponseBody;
    expect(body.error).toBe('QUESTION_NOT_FOUND');
  });

  it('/grade — 1차 -MC 행·2차 fill_blank(텍스트 정답) 채점 계약 불변', async () => {
    seedUser('u1', 'u1@test.com');
    seedFirstMcRow('eq-mc-g');
    seedExamQuestion({ id: 'eq-2nd-fb', examType: '2nd', answer: '보험가액' });
    const mcRes = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-mc-g', userAnswer: 'A' }),
    });
    expect(mcRes.status).toBe(200);
    const fbRes = await fetchAs('u1', '/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'eq-2nd-fb', userAnswer: '보험가액' }),
    });
    expect(fbRes.status).toBe(200);
    const fbBody = (await fbRes.json()) as StudyResponseBody;
    expect(fbBody.isCorrect).toBe(true);
  });
});
