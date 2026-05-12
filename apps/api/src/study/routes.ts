/**
 * Study routes (Phase 2 Eval MVP — phase2-eval-mvp.plan §6.2 + §6.3).
 *
 * 진산님 직접 평가 환경 — exam_questions 직접 표시 + 정답 채점 + 출처 surface.
 * Stage 3 (cluster matching) 미경유 (M2-1 timeout 회피).
 *
 * 엔드포인트:
 *   - GET  /api/study/next   — 학습할 문제 1건 추출 (단순 가중치, FSRS 미적용)
 *   - POST /api/study/grade  — 정답 채점 + user_progress UPSERT (★ L3 영역)
 *
 * 정책:
 *   - 인증 필수 (require-auth → userId 주입, progress 패턴 재사용)
 *   - Hard Rule 16: examId query parameter 강제 (Year 2 zero-cost 전환 시그니처)
 *   - Hard Rule 17: EXAM_IDS.SON_HAE_PYEONG_GA_SA 경유 (리터럴 0)
 *   - L3: user_progress 사용자 데이터 처리 (plan 영속 + 진산님 승인 후 코딩)
 *   - 출처 surface 필수 (sourceCitations + relatedNodes) — memory `project_source_citation_requirement.md`
 *   - FSRS 알고리즘 본 step 미적용 (Phase 2 carry-over) — totalReviews / correctCount 만 갱신
 *
 * UPSERT 키 (study 라우트 한정):
 *   user_id + card_id + card_type='exam' (node_id IS NULL)
 *   progress 라우트 (node_id 기반) 와 분리되어 동일 user_progress 테이블 공유.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  createLogger,
  isValidExamId,
  type ExamId,
  type Logger,
  type LoggerEnvironment,
} from '@thepick/shared';
import {
  INPUT_TYPES,
  gradeCalc,
  gradeEssay,
  gradeFillBlank,
  gradeMultipleChoice,
  multipleChoiceAnswerToIndex,
  shuffleChoices,
  todayDateString,
  type EssaySelfRating,
  type FsrsRating,
  type InputType,
  type ShuffledChoice,
} from '@thepick/learning-modes';
import {
  MASTERED_THRESHOLD_DAYS,
  computeWeakScore,
  createFreshCard,
  scheduleReview,
  type FsrsCardState,
} from '@thepick/srs';
import { requireAuth, type RequireAuthVariables } from '../auth/middleware/require-auth.js';
import { D1_UNIQUE_CONSTRAINT_PATTERN, withRetry } from '../middleware/retry.js';
import {
  checkAndIncrementRateLimit,
  RateLimitExceeded,
  sleepJitter,
} from '../progress/rate-limit.js';

const KNOWN_ENVIRONMENTS: ReadonlySet<LoggerEnvironment> = new Set<LoggerEnvironment>([
  'development',
  'staging',
  'production',
  'test',
]);

function resolveLoggerEnv(envName: string | undefined): LoggerEnvironment {
  return envName !== undefined && KNOWN_ENVIRONMENTS.has(envName as LoggerEnvironment)
    ? (envName as LoggerEnvironment)
    : 'development';
}

export interface StudyBindings {
  readonly DB: D1Database;
  readonly ENVIRONMENT?: string;
  readonly JWT_SECRET?: string;
}

function buildLogger(env: StudyBindings): Logger {
  return createLogger({
    service: 'thepick-api',
    environment: resolveLoggerEnv(env.ENVIRONMENT),
  }).child({ module: 'study' });
}

/** GET /next 응답에 포함할 최대 question 수. Phase 2 Eval MVP 는 1건 단위 surface. */
const DEFAULT_NEXT_COUNT = 1;
const MAX_NEXT_COUNT = 5;

/** relatedNodes JSON parse 후 enrichment 시 IN ... 쿼리 상한. silent 폭증 방지. */
const RELATED_NODES_MAX = 20;

function requireExamId(value: string | undefined): {
  examId: ExamId | null;
  error: string | null;
} {
  if (value === undefined) {
    return { examId: null, error: 'examId query parameter required (Hard Rule 16)' };
  }
  if (value === '') {
    return { examId: null, error: 'examId must not be empty' };
  }
  if (!isValidExamId(value)) {
    return { examId: null, error: `Invalid examId: ${value}` };
  }
  return { examId: value, error: null };
}

const examTypeSchema = z.enum(['1st', '2nd']);

const ESSAY_SELF_RATINGS = ['correct', 'partial', 'incorrect'] as const;

const gradeSchema = z.object({
  questionId: z.string().min(1).max(128),
  /** 객관식: 셔플 라벨 ('A' ~ 'E') / 단답+계산: 자유 텍스트 / 서술: 사용자 작성 답안. */
  userAnswer: z.string().min(1).max(2000),
  /** Step 3-UX-5a — input_type 분기. 미지정 시 question.input_type 사용 (backward-compat). */
  inputType: z.enum(INPUT_TYPES).optional(),
  /** Step 3-UX-5b — essay self-grade ('correct' | 'partial' | 'incorrect'). essay type 한정. */
  selfRating: z.enum(ESSAY_SELF_RATINGS).optional(),
  /** Step 3-UX-5b — calc tolerance (default 0). 소수점 비교 허용 폭. */
  calcTolerance: z.number().min(0).max(1).optional(),
});

interface ExamQuestionRow {
  readonly id: string;
  readonly year: number;
  readonly round: number | null;
  readonly question_number: number | null;
  readonly subject: string | null;
  readonly content: string;
  readonly answer: string | null;
  readonly explanation: string | null;
  readonly related_nodes: string | null;
  readonly exam_type: string | null;
  readonly topic_cluster: string | null;
  readonly confusion_type: string | null;
  // Migration 0032 — Phase 3 학습 UX 4 type 분기 (Step 3-UX-5a)
  readonly input_type: string | null;
  readonly distractors: string | null;
  readonly calc_variables: string | null;
}

interface KnowledgeNodeRow {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly page_ref: string | null;
  readonly book_page: number | null;
}

interface ProgressExistingRow {
  readonly id: string;
  readonly total_reviews: number | null;
  readonly correct_count: number | null;
  // Step 3-UX-5b — FSRS-4 column (Migration 0033 정합)
  readonly fsrs_difficulty: number | null;
  readonly fsrs_stability: number | null;
  readonly fsrs_interval: number | null;
  readonly fsrs_next_review: string | null;
  readonly fsrs_reps: number | null;
  readonly fsrs_lapses: number | null;
  readonly fsrs_state: string | null;
  readonly fsrs_last_review: string | null;
  readonly mastered_at: string | null;
}

/**
 * D1 user_progress row → packages/srs FsrsCardState (column 매핑).
 *
 * D7 lock option C 정합 — 기존 fsrs_* 4 컬럼 + 신규 4 컬럼 (Migration 0033).
 * 신규 row가 부재(null)인 경우 default 값 적용 → packages/srs.createFreshCard 정합.
 */
function rowToFsrsState(row: ProgressExistingRow): FsrsCardState {
  return {
    due: row.fsrs_next_review ?? new Date(0).toISOString(),
    stability: row.fsrs_stability ?? 0,
    difficulty: row.fsrs_difficulty ?? 0,
    reps: row.fsrs_reps ?? 0,
    lapses: row.fsrs_lapses ?? 0,
    state: (row.fsrs_state as FsrsCardState['state']) ?? 'new',
    lastReview: row.fsrs_last_review,
    scheduledDays: row.fsrs_interval ?? 0,
  };
}

/**
 * isCorrect + selfRating → FsrsRating 변환.
 *
 * - essay: selfRating ('correct'/'partial'/'incorrect') → 'good'/'hard'/'again'
 * - 그 외: isCorrect → 'good' (true) / 'again' (false)
 *
 * Step 3-UX-5b — packages/srs.scheduleReview rating 입력 source.
 */
function decideFsrsRating(isCorrect: boolean, selfRating: EssaySelfRating | undefined): FsrsRating {
  if (selfRating === 'correct') return 'good';
  if (selfRating === 'partial') return 'hard';
  if (selfRating === 'incorrect') return 'again';
  return isCorrect ? 'good' : 'again';
}

interface RelatedNodeOut {
  readonly id: string;
  readonly name: string;
  readonly nodeType: string;
  readonly bookPage: number | null;
  readonly pageRef: string | null;
}

interface SourceCitations {
  readonly examReferences: ReadonlyArray<{
    readonly year: number;
    readonly round: number | null;
    readonly questionNumber: number | null;
  }>;
  readonly manualPages: ReadonlyArray<number>;
  readonly lawArticles: ReadonlyArray<string>;
}

interface ChoiceOut {
  /** 셔플 후 표시 라벨 ('A' ~ 'E'). 클라이언트 입력 source. */
  readonly label: string;
  /** 보기 텍스트. */
  readonly text: string;
}

interface NextQuestionOut {
  readonly id: string;
  readonly year: number;
  readonly round: number | null;
  readonly questionNumber: number | null;
  readonly subject: string | null;
  readonly content: string;
  readonly examType: string | null;
  readonly topicCluster: string | null;
  readonly relatedNodes: ReadonlyArray<RelatedNodeOut>;
  readonly sourceCitations: SourceCitations;
  // Step 3-UX-5a — Phase 3 학습 UX 4 type 분기
  readonly inputType: InputType;
  /** 객관식만 (셔플된 라벨 + 텍스트). 정답 라벨 비노출 (서버 측 originalIndex 역추적). */
  readonly choices: ReadonlyArray<ChoiceOut> | null;
  /** 계산식만 (산식 변수 JSON). */
  readonly calcVariables: Record<string, number> | null;
}

interface GradeResultOut {
  readonly isCorrect: boolean;
  readonly correctAnswer: string;
  readonly explanation: string | null;
  readonly sourceCitations: SourceCitations;
  readonly relatedNodes: ReadonlyArray<RelatedNodeOut>;
  /** 객관식만 — 채점 후 셔플 라벨 노출 (사전 노출 0). */
  readonly correctLabel?: string;
}

type StudyEnv = {
  readonly Bindings: StudyBindings;
  readonly Variables: RequireAuthVariables;
};

/**
 * normalizeAnswer는 packages/learning-modes로 분리 (Step 3-UX-2 commit 66f98cd).
 * 본 파일은 import 경유 사용 — 동일 회귀 정합 (Pass 1 CRIT-1 silent corruption 차단).
 *
 * isAnswerCorrect는 fill_blank input type에 한정 (gradeFillBlank 사용).
 * 객관식/서술/계산은 별도 type 분기 (gradeMultipleChoice / gradeEssay / gradeCalc).
 */

/**
 * exam_questions.input_type 검증 + 기본값 'fill_blank' (마이그레이션 0032 default 정합).
 */
function resolveInputType(value: string | null | undefined): InputType {
  if (value === null || value === undefined) return 'fill_blank';
  const found = INPUT_TYPES.find((t) => t === value);
  return found ?? 'fill_blank';
}

/**
 * 객관식 보기 셔플. exam_questions.distractors (JSON array 4 + answer 합쳐 5 보기) → shuffleChoices.
 *
 * 정합:
 *   - distractors JSON parse 실패 시 null 반환 (객관식 셔플 불가 → routes 측 inputType fallback)
 *   - 정답 (answer) 인덱스 = 0 (첫 번째) → 셔플 후 originalIndex로 역추적
 *   - 셔플 시드: D3 lock — hash(userId || questionId || YYYYMMDD)
 */
async function buildShuffledChoices(
  userId: string,
  question: ExamQuestionRow,
  logger: Logger,
): Promise<ShuffledChoice[] | null> {
  if (question.distractors === null || question.distractors === '') return null;
  if (question.answer === null || question.answer === '') return null;

  let distractors: string[];
  try {
    const parsed: unknown = JSON.parse(question.distractors);
    if (!Array.isArray(parsed)) {
      logger.warn('distractors JSON not array', { questionId: question.id });
      return null;
    }
    distractors = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
  } catch (err) {
    logger.warn('distractors JSON parse failed', { err: String(err), questionId: question.id });
    return null;
  }

  // 정답 + distractors 합쳐 originalTexts. 정답은 index 0.
  const originalTexts = [question.answer, ...distractors];
  if (originalTexts.length < 2 || originalTexts.length > 5) {
    logger.warn('choice count out of range', {
      questionId: question.id,
      count: originalTexts.length,
    });
    return null;
  }

  try {
    return await shuffleChoices(originalTexts, {
      userId,
      questionId: question.id,
      date: todayDateString(),
    });
  } catch (err) {
    logger.warn('shuffleChoices failed', { err: String(err), questionId: question.id });
    return null;
  }
}

/**
 * exam_questions.calc_variables JSON parse → Record<string, number> | null.
 */
function parseCalcVariables(
  json: string | null,
  questionId: string,
  logger: Logger,
): Record<string, number> | null {
  if (json === null || json === '') return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      logger.warn('calc_variables JSON not object', { questionId });
      return null;
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch (err) {
    logger.warn('calc_variables JSON parse failed', { err: String(err), questionId });
    return null;
  }
}

/**
 * relatedNodes JSON (string array) parse + knowledge_nodes IN ... 조회.
 *
 * 실패 모드:
 *   - JSON parse 실패: empty 배열 반환 + warn 로깅 (silent fail 차단)
 *   - 빈 배열 / null: empty 반환 (정상 경로)
 *   - 노드 미존재: 결과에서 자연 제외 (knowledge_nodes 가 적재 후 status 영역만 enrichment)
 */
async function enrichRelatedNodes(
  db: D1Database,
  relatedNodesJson: string | null,
  logger: Logger,
): Promise<ReadonlyArray<RelatedNodeOut>> {
  if (relatedNodesJson === null || relatedNodesJson === '') return [];
  let ids: ReadonlyArray<string>;
  try {
    const parsed: unknown = JSON.parse(relatedNodesJson);
    if (!Array.isArray(parsed)) {
      logger.warn('relatedNodes JSON not array', { relatedNodesJson });
      return [];
    }
    ids = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
  } catch (err) {
    logger.warn('relatedNodes JSON parse failed', { err: String(err), relatedNodesJson });
    return [];
  }
  if (ids.length === 0) return [];

  const limited = ids.slice(0, RELATED_NODES_MAX);
  const placeholders = limited.map(() => '?').join(',');

  try {
    const result = await db
      .prepare(
        `SELECT id, name, type, page_ref, book_page
           FROM knowledge_nodes
          WHERE id IN (${placeholders})
            AND is_current_active = 1`,
      )
      .bind(...limited)
      .all<KnowledgeNodeRow>();
    return result.results.map((row) => ({
      id: row.id,
      name: row.name,
      nodeType: row.type,
      bookPage: row.book_page,
      pageRef: row.page_ref,
    }));
  } catch (err) {
    logger.error('relatedNodes enrichment query failed', err, { ids: limited });
    return [];
  }
}

function buildSourceCitations(
  question: ExamQuestionRow,
  relatedNodes: ReadonlyArray<RelatedNodeOut>,
): SourceCitations {
  const manualPagesSet = new Set<number>();
  const lawArticlesSet = new Set<string>();
  for (const node of relatedNodes) {
    if (node.bookPage !== null) {
      manualPagesSet.add(node.bookPage);
    }
    if (node.nodeType === 'LAW' && node.pageRef !== null && node.pageRef !== '') {
      lawArticlesSet.add(node.pageRef);
    }
  }
  return {
    examReferences: [
      {
        year: question.year,
        round: question.round,
        questionNumber: question.question_number,
      },
    ],
    manualPages: [...manualPagesSet].sort((a, b) => a - b),
    lawArticles: [...lawArticlesSet].sort(),
  };
}

export function createStudyRoutes(): Hono<StudyEnv> {
  const router = new Hono<StudyEnv>();

  router.use('*', async (c, next) => {
    const logger = buildLogger(c.env).child({ route: 'require-auth' });
    const middleware = requireAuth<StudyEnv>(logger);
    return middleware(c, next);
  });

  router.get('/next', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'next' });
    const userId = c.var.userId;

    const examIdParam = requireExamId(c.req.query('examId'));
    if (examIdParam.error || !examIdParam.examId) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: examIdParam.error ?? 'examId required' },
        422,
      );
    }
    void examIdParam.examId;

    // ★ Phase 2 Eval MVP plan §3 결정 갱신 (Session 065 진산 옵션 3 선택):
    // production 실측 2차 9건 모두 answer null = 자동 채점 0% → 1차 525건 default 채택.
    // 2차 self-grade는 plan §8.3 별도 plan (`docs/plans/phase2-2nd-self-grade.plan.md`) carry-over.
    const examTypeRaw = c.req.query('examType') ?? '1st';
    const examTypeParsed = examTypeSchema.safeParse(examTypeRaw);
    if (!examTypeParsed.success) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: `Invalid examType: ${examTypeRaw}` },
        422,
      );
    }
    const examType = examTypeParsed.data;

    const countRaw = c.req.query('count') ?? String(DEFAULT_NEXT_COUNT);
    const countNum = Number(countRaw);
    if (!Number.isInteger(countNum) || countNum < 1 || countNum > MAX_NEXT_COUNT) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: `count must be integer in [1, ${MAX_NEXT_COUNT}]` },
        422,
      );
    }

    let questions: ReadonlyArray<ExamQuestionRow>;
    try {
      const result = await c.env.DB.prepare(
        `SELECT eq.id, eq.year, eq.round, eq.question_number, eq.subject, eq.content,
                eq.answer, eq.explanation, eq.related_nodes, eq.exam_type, eq.topic_cluster,
                eq.confusion_type, eq.input_type, eq.distractors, eq.calc_variables
           FROM exam_questions eq
           LEFT JOIN user_progress up
             ON up.card_id = eq.id
            AND up.user_id = ?
            AND up.card_type = 'exam'
          WHERE eq.status = 'active'
            AND eq.exam_type = ?
          ORDER BY (up.id IS NULL) DESC,
                   COALESCE(up.correct_count, 0) ASC,
                   COALESCE(up.total_reviews, 0) ASC,
                   eq.id ASC
          LIMIT ?`,
      )
        .bind(userId, examType, countNum)
        .all<ExamQuestionRow>();
      questions = result.results;
    } catch (err) {
      logger.error('next query failed', err, { userId, examType, count: countNum });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    if (questions.length === 0) {
      return c.json({ exhausted: true, questions: [] });
    }

    // ★ Session 066 5-Persona C-07 흡수 — N+1 직렬 enrichment → Promise.all 병렬.
    // count=5 시 직렬 6 D1 round-trip (Edge→D1 RTT 30~50ms × 5 = 150~250ms wallclock)을
    // 1 round-trip wave 로 압축. handoff-073 §F.4 M4 동시 해소.
    //
    // Step 3-UX-5a 갱신: input_type 분기 + 객관식 셔플 (D3 lock 정합).
    const enriched: NextQuestionOut[] = await Promise.all(
      questions.map(async (q) => {
        const inputType = resolveInputType(q.input_type);
        const [relatedNodes, shuffled] = await Promise.all([
          enrichRelatedNodes(c.env.DB, q.related_nodes, logger),
          inputType === 'multiple_choice'
            ? buildShuffledChoices(userId, q, logger)
            : Promise.resolve(null),
        ]);
        const choices: ReadonlyArray<ChoiceOut> | null =
          shuffled !== null ? shuffled.map((c) => ({ label: c.label, text: c.text })) : null;
        const calcVariables =
          inputType === 'calc' ? parseCalcVariables(q.calc_variables, q.id, logger) : null;
        return {
          id: q.id,
          year: q.year,
          round: q.round,
          questionNumber: q.question_number,
          subject: q.subject,
          content: q.content,
          examType: q.exam_type,
          topicCluster: q.topic_cluster,
          relatedNodes,
          sourceCitations: buildSourceCitations(q, relatedNodes),
          inputType,
          choices,
          calcVariables,
        };
      }),
    );

    return c.json({ exhausted: false, questions: enriched });
  });

  router.post('/grade', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'grade' });
    const userId = c.var.userId;

    const examIdParam = requireExamId(c.req.query('examId'));
    if (examIdParam.error || !examIdParam.examId) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: examIdParam.error ?? 'examId required' },
        422,
      );
    }
    void examIdParam.examId;

    // 4-Pass Pass 3 CRIT-2 흡수 — enumeration oracle 차단 (정답 dump 방지).
    // progress/review 패턴 재사용 (TD-030). 분당 20회 cap + 429 응답 + jitter.
    try {
      await checkAndIncrementRateLimit(c.env.DB, userId, { limitPerMinute: 20 });
    } catch (err) {
      if (err instanceof RateLimitExceeded) {
        await sleepJitter();
        c.header('Retry-After', String(err.retryAfterSeconds));
        return c.json({ error: 'RATE_LIMIT_EXCEEDED' }, 429);
      }
      logger.error('rate-limit check failed', err, { userId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    const parsed = gradeSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 422);
    }
    const {
      questionId,
      userAnswer,
      inputType: requestedInputType,
      selfRating: requestedSelfRating,
      calcTolerance: requestedCalcTolerance,
    } = parsed.data;

    let question: ExamQuestionRow | null;
    try {
      question = await c.env.DB.prepare(
        `SELECT id, year, round, question_number, subject, content, answer, explanation,
                related_nodes, exam_type, topic_cluster, confusion_type,
                input_type, distractors, calc_variables
           FROM exam_questions
          WHERE id = ?
            AND status = 'active'
          LIMIT 1`,
      )
        .bind(questionId)
        .first<ExamQuestionRow>();
    } catch (err) {
      logger.error('question lookup failed', err, { userId, questionId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
    if (question === null) {
      return c.json({ error: 'QUESTION_NOT_FOUND' }, 404);
    }

    if (question.answer === null || question.answer === '') {
      return c.json({ error: 'QUESTION_HAS_NO_ANSWER', questionId }, 422);
    }

    // Step 3-UX-5a — input_type 분기 채점.
    // 클라이언트 request inputType 우선 (체크), 없으면 question.input_type 사용.
    const inputType: InputType = resolveInputType(requestedInputType ?? question.input_type);
    let isCorrect = false;
    let correctLabel: string | undefined;
    let shuffleSeedForAudit: string | null = null;

    if (inputType === 'multiple_choice') {
      // 객관식: 셔플 재생성 후 originalIndex 역추적 → answer 매칭.
      const shuffled = await buildShuffledChoices(userId, question, logger);
      if (shuffled === null) {
        // distractors 부재 또는 parse 실패 → fill_blank fallback (backward-compat)
        const result = gradeFillBlank({ expected: question.answer, userAnswer });
        isCorrect = result.isCorrect;
      } else {
        const correctOriginalIndex = multipleChoiceAnswerToIndex(question.answer);
        const result = gradeMultipleChoice({
          submittedLabel: userAnswer,
          shuffledChoices: shuffled,
          correctOriginalIndex,
        });
        isCorrect = result.isCorrect;
        correctLabel = result.correctLabel;
        // study_reviews.shuffle_seed audit — 정답 위치 telemetry 미노출, seed만 기록.
        shuffleSeedForAudit = todayDateString();
      }
    } else if (inputType === 'fill_blank') {
      const result = gradeFillBlank({ expected: question.answer, userAnswer });
      isCorrect = result.isCorrect;
    } else if (inputType === 'essay') {
      // Step 3-UX-5b — essay self-grade.
      // selfRating 미주입 시 정답 string 매칭 fallback (backward-compat).
      if (requestedSelfRating !== undefined) {
        const result = gradeEssay({ userAnswer, selfRating: requestedSelfRating });
        isCorrect = result.isCorrect;
      } else {
        const result = gradeFillBlank({ expected: question.answer, userAnswer });
        isCorrect = result.isCorrect;
      }
    } else if (inputType === 'calc') {
      // Step 3-UX-5b — calc numeric 비교 (tolerance 허용).
      // 자동 채점 불가 시 fill_blank fallback (backward-compat).
      const calcResult = gradeCalc({
        expectedValue: question.answer,
        userValue: userAnswer,
        tolerance: requestedCalcTolerance ?? 0,
      });
      if (calcResult.autoGraded) {
        isCorrect = calcResult.isCorrect;
      } else {
        const result = gradeFillBlank({ expected: question.answer, userAnswer });
        isCorrect = result.isCorrect;
      }
    }

    const relatedNodes = await enrichRelatedNodes(c.env.DB, question.related_nodes, logger);
    const sourceCitations = buildSourceCitations(question, relatedNodes);

    // Step 3-UX-5b — FSRS-4 rating 결정 + scheduleReview 호출.
    const fsrsRating = decideFsrsRating(isCorrect, requestedSelfRating);
    const nowDate = new Date();
    const nowIso = nowDate.toISOString();

    try {
      const existing = await c.env.DB.prepare(
        `SELECT id, total_reviews, correct_count,
                fsrs_difficulty, fsrs_stability, fsrs_interval, fsrs_next_review,
                fsrs_reps, fsrs_lapses, fsrs_state, fsrs_last_review, mastered_at
           FROM user_progress
          WHERE user_id = ?
            AND card_id = ?
            AND card_type = 'exam'
            AND node_id IS NULL
          LIMIT 1`,
      )
        .bind(userId, questionId)
        .first<ProgressExistingRow>();

      // FSRS state 계산 — existing row → restored FsrsCardState, 없으면 createFreshCard.
      const previousState: FsrsCardState =
        existing !== null ? rowToFsrsState(existing) : createFreshCard(nowDate);
      const reviewResult = scheduleReview({
        state: previousState,
        rating: fsrsRating,
        now: nowDate,
      });
      const nextState = reviewResult.nextState;

      // weak_score 계산 — subjectCorrectRate + conceptStability (D2 lock).
      const newTotal = Number(existing?.total_reviews ?? 0) + 1;
      const newCorrect = Number(existing?.correct_count ?? 0) + (isCorrect ? 1 : 0);
      const subjectCorrectRate = newTotal > 0 ? newCorrect / newTotal : 0;
      const weakScore = computeWeakScore({
        subjectCorrectRate,
        conceptStability: nextState.stability,
      });

      // mastered_at 갱신 — stability ≥ MASTERED_THRESHOLD_DAYS 도달 시점 영속.
      const masteredAtNew =
        existing?.mastered_at ?? (nextState.stability >= MASTERED_THRESHOLD_DAYS ? nowIso : null);

      if (existing !== null) {
        const updateResult = await withRetry(() =>
          c.env.DB.prepare(
            `UPDATE user_progress
                SET total_reviews = ?,
                    correct_count = ?,
                    last_confusion_type = ?,
                    fsrs_difficulty = ?,
                    fsrs_stability = ?,
                    fsrs_interval = ?,
                    fsrs_next_review = ?,
                    fsrs_reps = ?,
                    fsrs_lapses = ?,
                    fsrs_state = ?,
                    fsrs_last_review = ?,
                    mastered_at = ?,
                    weak_score = ?,
                    updated_at = datetime('now')
              WHERE id = ?`,
          )
            .bind(
              newTotal,
              newCorrect,
              question.confusion_type,
              nextState.difficulty,
              nextState.stability,
              nextState.scheduledDays,
              nextState.due,
              nextState.reps,
              nextState.lapses,
              nextState.state,
              nextState.lastReview,
              masteredAtNew,
              weakScore,
              existing.id,
            )
            .run(),
        );
        if (!updateResult.value.success) {
          throw new Error('D1_UPDATE_FAILED');
        }
      } else {
        const progressId = crypto.randomUUID();
        const insertResult = await withRetry(() =>
          c.env.DB.prepare(
            `INSERT INTO user_progress
               (id, user_id, node_id, card_id, card_type,
                fsrs_difficulty, fsrs_stability, fsrs_interval, fsrs_next_review,
                fsrs_reps, fsrs_lapses, fsrs_state, fsrs_last_review,
                mastered_at, weak_score,
                total_reviews, correct_count, last_confusion_type, created_at, updated_at)
             VALUES (?, ?, NULL, ?, 'exam',
                     ?, ?, ?, ?,
                     ?, ?, ?, ?,
                     ?, ?,
                     1, ?, ?, ?, ?)`,
          )
            .bind(
              progressId,
              userId,
              questionId,
              nextState.difficulty,
              nextState.stability,
              nextState.scheduledDays,
              nextState.due,
              nextState.reps,
              nextState.lapses,
              nextState.state,
              nextState.lastReview,
              masteredAtNew,
              weakScore,
              isCorrect ? 1 : 0,
              question.confusion_type,
              nowIso,
              nowIso,
            )
            .run(),
        );
        if (!insertResult.value.success) {
          throw new Error('D1_INSERT_FAILED');
        }
      }

      // Step 3-UX-5b — study_reviews INSERT (review 이력 trace, Migration 0034 정합).
      // packages/srs.replayReviews source. session_id는 Step 3-UX-5c carry-over (현 NULL).
      try {
        await withRetry(() =>
          c.env.DB.prepare(
            `INSERT INTO study_reviews
               (id, user_id, card_id, card_type, reviewed_at, rating,
                interval_days, stability_before, stability_after, shuffle_seed, session_id)
             VALUES (?, ?, ?, 'exam', ?, ?, ?, ?, ?, ?, NULL)`,
          )
            .bind(
              crypto.randomUUID(),
              userId,
              questionId,
              nowIso,
              fsrsRating,
              nextState.scheduledDays,
              reviewResult.review.stabilityBefore,
              reviewResult.review.stabilityAfter,
              shuffleSeedForAudit,
            )
            .run(),
        );
      } catch (err) {
        // study_reviews INSERT 실패는 user_progress UPSERT 영향 0 (audit trail만 누락).
        // Pass 3 ADVOCATE — silent failure 차단 위해 warn 로깅.
        logger.warn('study_reviews INSERT failed (audit trail only)', {
          err: err instanceof Error ? err.message : String(err),
          userId,
          questionId,
        });
      }
    } catch (err) {
      if (err instanceof Error && D1_UNIQUE_CONSTRAINT_PATTERN.test(err.message)) {
        return c.json({ error: 'CONCURRENT_UPDATE' }, 409);
      }
      logger.error('grade write failed', err, { userId, questionId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    const result: GradeResultOut = {
      isCorrect,
      correctAnswer: question.answer,
      explanation: question.explanation,
      sourceCitations,
      relatedNodes,
      ...(correctLabel !== undefined ? { correctLabel } : {}),
    };
    return c.json(result);
  });

  return router;
}
