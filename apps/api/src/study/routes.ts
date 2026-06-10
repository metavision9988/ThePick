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

import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  EXAM_IDS,
  createLogger,
  isValidExamId,
  type ExamId,
  type Logger,
  type LoggerEnvironment,
} from '@thepick/shared';
import {
  INPUT_TYPES,
  LEARNING_MODES,
  computeStreakUpdate,
  dayBoundsUtc,
  gradeCalc,
  gradeEssay,
  gradeFillBlank,
  gradeMultipleChoice,
  multipleChoiceAnswerToIndex,
  normalizeAnswer,
  resolveLearningMode as resolveLearningModeBase,
  resolveSessionPhase as resolveSessionPhaseBase,
  shuffleChoices,
  todayDateString,
  type EssaySelfRating,
  type InputType,
  type LearningMode,
  type NarrowingFallback,
  type SessionPhase,
  type ShuffledChoice,
} from '@thepick/learning-modes';
import {
  MASTERED_THRESHOLD_DAYS,
  computeWeakScore,
  createFreshCard,
  scheduleReview,
  type FsrsCardState,
  type FsrsRating,
} from '@thepick/srs';
import { requireAuth, type RequireAuthVariables } from '../auth/middleware/require-auth.js';
import { writeTelemetryEvent } from '../telemetry/write-helper.js';
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

// PHASE_THRESHOLD_* + computePhaseFromProgress + computeStreakUpdate + resolveSessionPhase +
// resolveLearningMode + isOneDayApart + todayDateString은 packages/learning-modes/session-progress.ts
// 단일 source. 본 파일은 import 경유 사용 (Engine-First 정합 + Golden Test 110건 packages 위임).

/** Step 3-UX-5c — streak_records.daily_goal default (plan §13 D5 lock). */
const DEFAULT_DAILY_GOAL = 20;

/** Step 3-UX-5c — /mode weak 영역 surface top N + cards_planned 상한. */
const WEAK_TOP_LIMIT = 5;
const MAX_CARDS_PLANNED = 200;
const MIN_CARDS_PLANNED = 1;

/**
 * Step 3-UX-6e (5-페르소나 backend M-D1 흡수) — study read endpoint group rate-limit.
 *
 * /grade는 user_id 기반 분당 20 cap (enumeration oracle 차단). read endpoint 4종
 * (/mode, /progress, /session/:id, /session/:id/complete)은 별도 group으로 분리하여
 * /grade 카운터와 독립적으로 동작.
 *
 * rate_limits 테이블 PK `(user_id, bucket_minute)` 정합 — 마이그레이션 0건. userId
 * suffix `:study-read`로 group 분리.
 *
 * 분당 60 cap = 1 RPS. 정상 사용자 (/study 페이지 진입 + 학습 흐름)는 분당 5~10회.
 * DoS / scraping은 즉시 429 차단.
 */
const STUDY_READ_LIMIT_PER_MINUTE = 60;
const STUDY_READ_RATE_GROUP_SUFFIX = ':study-read';

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
  /** Step 3-UX-5c — 세션 진척 추적용. 미제공 시 study_reviews.session_id NULL (backward-compat). */
  sessionId: z.string().uuid().optional(),
});

/** Step 3-UX-5c — POST /mode/start 요청 schema. */
const modeStartSchema = z.object({
  mode: z.enum(LEARNING_MODES),
  /** mode 별 추가 파라미터. category={subject}, topic={conceptId}, confusion={confusionType}. */
  modeParams: z.record(z.string(), z.unknown()).optional(),
  /** 세션 계획 카드 수. cards_planned 도달 시 자동 phase='completed'. */
  cardsPlanned: z.number().int().min(MIN_CARDS_PLANNED).max(MAX_CARDS_PLANNED),
});

/**
 * 실배선 모드 (design-audit WS-0d, 결재 #9 위임 = "비활성 표기", 2026-06-11).
 *
 * 등재 기준 = "/next 서빙 의미가 모드 계약과 일치하는 모드" (리뷰 m-1 정정: weak 는
 * WHERE 가 아닌 ORDER BY weak_score 분기, mixed 는 무필터가 곧 계약). category/topic/
 * confusion 은 modeParams 저장·표시만 되고 서빙 풀이 mixed 와 동일(ADR-039:41-43 계약
 * 위반 상태, 기보고 RC-3)라 제외. 미배선 모드는 ① /mode 응답 wired=false (UI "준비 중"
 * disabled 근거) ② /mode/start 422 거부 (UI 우회 차단). ★ WS-5a 에서 해당 모드 서빙
 * 배선 완료 시 본 Set 등재가 재활성의 유일 경로 — UI 는 wired 를 따르므로 자동 추종.
 * 단 Set 등재 전 "해당 모드 /next 필터 통합 테스트 PASS" 가 선행 게이트 (Set 은 선언이지
 * 검증이 아님 — 리뷰 m-3).
 */
const WIRED_MODES: ReadonlySet<LearningMode> = new Set<LearningMode>(['weak', 'mixed']);

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

/** Step 3-UX-5c — study_sessions row shape. */
interface StudySessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly mode: string;
  readonly mode_params: string | null;
  readonly phase: string;
  readonly cards_planned: number;
  readonly cards_completed: number;
  readonly correct_count: number;
}

/** Step 3-UX-5c — streak_records row shape. */
interface StreakRecordRow {
  readonly user_id: string;
  readonly current_streak: number;
  readonly longest_streak: number;
  readonly last_study_date: string | null;
  readonly daily_goal: number;
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

/** Step 3-UX-5c — /next 응답 envelope. sessionId 제공 시 session block 포함. */
interface NextResponseSession {
  readonly id: string;
  readonly mode: LearningMode;
  readonly phase: SessionPhase;
}

/** Step 3-UX-5c — /grade 응답 streak summary (plan §9.2 GradeResponse.streak). */
interface StreakSummaryOut {
  readonly current: number;
  readonly longest: number;
  /** 0~1, dailyGoal 대비 오늘 누적 review 비율. 정확도는 todayCount/dailyGoal cap. */
  readonly dailyGoalProgress: number;
}

/** Step 3-UX-5c — /grade 응답 session 진척 summary. */
interface SessionProgressOut {
  readonly id: string;
  readonly phase: SessionPhase;
  readonly cardsCompleted: number;
  readonly cardsPlanned: number;
  readonly correctCount: number;
}

interface GradeResultOut {
  readonly isCorrect: boolean;
  readonly correctAnswer: string;
  readonly explanation: string | null;
  readonly sourceCitations: SourceCitations;
  readonly relatedNodes: ReadonlyArray<RelatedNodeOut>;
  /** 객관식만 — 채점 후 셔플 라벨 노출 (사전 노출 0). */
  readonly correctLabel?: string;
  /** Step 3-UX-5c — streak 누적 (plan §13 D5 lock). */
  readonly streak: StreakSummaryOut;
  /** Step 3-UX-5c — sessionId 제공 시 세션 진척 surface. */
  readonly session?: SessionProgressOut;
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

  // design-audit WS-0f (2026-06-10) — distractor 안전 최후 가드.
  //   채점(gradeMultipleChoice)은 originalIndex 로 정답을 판정한다. 같은 텍스트가 두
  //   슬롯에 있으면 "정답과 동일한 보기"를 고른 사용자가 오답 처리되는 불공정이 발생
  //   하고, distractor 간 중복은 동일 보기 2개 노출이 된다. 채점 동치 기준(normalizeAnswer)
  //   으로 중복을 검출하면 셔플·서빙을 거부 → routes 측 fill_blank fallback (안전 강등).
  //   ※ index 쌍만 로깅(정답 원문 미노출 — 정답 누출 차단). index 0 = 정답.
  const normalizedTexts = originalTexts.map((t) => normalizeAnswer(t));
  const firstSeenIndex = new Map<string, number>();
  const collisionPairs: string[] = [];
  let answerCollides = false;
  normalizedTexts.forEach((norm, i) => {
    const prev = firstSeenIndex.get(norm);
    if (prev === undefined) {
      firstSeenIndex.set(norm, i);
      return;
    }
    collisionPairs.push(`${prev}=${i}`);
    if (prev === 0) answerCollides = true;
  });
  if (collisionPairs.length > 0) {
    logger.warn('duplicate choice text — refusing MC shuffle (fallback to fill_blank)', {
      questionId: question.id,
      collisionIndexPairs: collisionPairs.join(','),
      answerCollides,
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
 *
 * ★ drift 방어 (S5-6a 4-Pass Pass2 M-1): 본 함수의 *파싱 술어*
 *   (JSON.parse / Array 검사 / `typeof==='string' && length>0` 필터)는
 *   `apps/api/src/eval/multihop-accuracy.ts` `parseRelatedNodes` 와 **동치
 *   유지 의무**다. 여기 파싱 규칙을 개정하면 그쪽 G-6a-2 골든 테스트도
 *   동반 갱신하라 (측정 정답률이 production surface 파싱과 어긋나면 G-S5
 *   해석이 왜곡). 단 `RELATED_NODES_MAX` 절단은 study 런타임 surface 상한
 *   으로, 측정 측은 분모 인위 축소 방지 위해 의도적 미적용(비동치 1건).
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

/**
 * Step 3-UX-5c — DB schema drift narrowing 콜백 (silent fallback 차단, devops 5-페르소나 흡수).
 *
 * 잘못된 phase/mode 값이 DB에서 surface될 시 warn 로깅 (운영자가 admin-web에서 trace 가능).
 * Production에서 drift 발견 시 즉시 마이그레이션 또는 데이터 정합 작업 진행 의무.
 */
function makeNarrowingFallback(logger: Logger, kind: 'phase' | 'mode'): NarrowingFallback {
  return (value, expected) => {
    logger.warn(`schema drift narrowing fallback (${kind})`, {
      kind,
      receivedValue: value === null ? 'NULL' : value === undefined ? 'UNDEFINED' : value,
      expectedValues: expected,
    });
  };
}

/** routes.ts 내 호출 정합 wrapper (logger 미주입 시 silent fallback). */
function resolveSessionPhase(value: string | null | undefined, logger?: Logger): SessionPhase {
  return resolveSessionPhaseBase(
    value,
    logger ? makeNarrowingFallback(logger, 'phase') : undefined,
  );
}

function resolveLearningMode(value: string | null | undefined, logger?: Logger): LearningMode {
  return resolveLearningModeBase(value, logger ? makeNarrowingFallback(logger, 'mode') : undefined);
}

/**
 * Step 3-UX-5c — study_sessions row → SessionProgressOut (응답 매핑).
 */
function rowToSessionProgress(row: StudySessionRow, logger?: Logger): SessionProgressOut {
  return {
    id: row.id,
    phase: resolveSessionPhase(row.phase, logger),
    cardsCompleted: row.cards_completed,
    cardsPlanned: row.cards_planned,
    correctCount: row.correct_count,
  };
}

/**
 * Step 3-UX-5c — 4 input type 분기 채점 (refactoring 5-페르소나 흡수).
 *
 * /grade orchestrator 단일 책임 압박 완화 — 채점 로직 추출.
 * 본격 step 함수 5개 분리 (validateAndLookup / persistProgress / appendStudyReview /
 * advanceSession / bumpStreak) 는 phase 3 안정화 후 carry-over.
 *
 * 반환:
 *   - isCorrect: 정답 여부
 *   - correctLabel: 객관식 정답 라벨 (채점 후 노출 OK, 사전 노출 0)
 *   - shuffleSeedForAudit: study_reviews.shuffle_seed audit (정답 위치 telemetry 미노출)
 */
async function gradeAnswerByType(params: {
  readonly question: ExamQuestionRow;
  readonly userAnswer: string;
  readonly inputType: InputType;
  readonly userId: string;
  readonly selfRating: EssaySelfRating | undefined;
  readonly calcTolerance: number | undefined;
  readonly logger: Logger;
}): Promise<{
  isCorrect: boolean;
  correctLabel: string | undefined;
  shuffleSeedForAudit: string | null;
}> {
  const { question, userAnswer, inputType, userId, selfRating, calcTolerance, logger } = params;
  // question.answer 검증은 호출 측에서 (QUESTION_HAS_NO_ANSWER 422).
  // 본 함수는 answer != null 전제.
  const expectedAnswer = question.answer as string;
  let isCorrect = false;
  let correctLabel: string | undefined;
  let shuffleSeedForAudit: string | null = null;

  if (inputType === 'multiple_choice') {
    // 객관식: 셔플 재생성 후 originalIndex 역추적 → answer 매칭.
    const shuffled = await buildShuffledChoices(userId, question, logger);
    if (shuffled === null) {
      // distractors 부재 또는 parse 실패 → fill_blank fallback (backward-compat).
      isCorrect = gradeFillBlank({ expected: expectedAnswer, userAnswer }).isCorrect;
    } else {
      const correctOriginalIndex = multipleChoiceAnswerToIndex(expectedAnswer);
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
    isCorrect = gradeFillBlank({ expected: expectedAnswer, userAnswer }).isCorrect;
  } else if (inputType === 'essay') {
    // selfRating 미주입 시 정답 string 매칭 fallback (backward-compat).
    if (selfRating !== undefined) {
      isCorrect = gradeEssay({ userAnswer, selfRating }).isCorrect;
    } else {
      isCorrect = gradeFillBlank({ expected: expectedAnswer, userAnswer }).isCorrect;
    }
  } else if (inputType === 'calc') {
    // calc 자동 채점 불가 시 fill_blank fallback (backward-compat).
    const calcResult = gradeCalc({
      expectedValue: expectedAnswer,
      userValue: userAnswer,
      tolerance: calcTolerance ?? 0,
    });
    isCorrect = calcResult.autoGraded
      ? calcResult.isCorrect
      : gradeFillBlank({ expected: expectedAnswer, userAnswer }).isCorrect;
  }

  return { isCorrect, correctLabel, shuffleSeedForAudit };
}

/**
 * Step 3-UX-5c — learning_slo 게이지 emit (devops 5-페르소나 흡수).
 *
 * Phase 3 launch 후 admin-web 학습 활동 가시성 확보 (engine_telemetry 8 게이지 중 learning_slo).
 * best-effort: ctx.waitUntil로 비동기 (응답 latency 영향 0), 실패 시 warn 로깅.
 *
 * 호출 시점:
 *   - /grade: event='grade' (isCorrect + inputType + sessionId)
 *   - /grade streak 실패: event='streak_silent_failure' (운영자 alert candidate)
 *   - /grade session 실패: event='session_update_failure' (동시 race candidate)
 *   - /mode/start: event='mode_start' (mode + cardsPlanned)
 *   - /session/:id/complete: event='session_complete' (correctRate + duration)
 */
function emitLearningTelemetry(
  c: Context<StudyEnv>,
  examId: ExamId,
  metricJson: Record<string, unknown>,
  logger: Logger,
): void {
  const promise = writeTelemetryEvent(
    {
      examId,
      gaugeName: 'learning_slo',
      metricValue: 1,
      metricJson,
    },
    { db: c.env.DB, logger },
  ).catch((err: unknown) => {
    // telemetry 실패는 silent (학습 응답 영향 0). warn 로깅으로 trace 보존.
    logger.warn('learning_slo telemetry emit failed', {
      err: err instanceof Error ? err.message : String(err),
      event: typeof metricJson.event === 'string' ? metricJson.event : 'unknown',
    });
  });
  // executionCtx는 Workers runtime에서 자동 주입. test 환경에서는 getter 자체가 throw.
  // try-catch로 안전 fallback — fire-and-forget (응답에 영향 0).
  try {
    c.executionCtx.waitUntil(promise);
  } catch {
    // test/dev 환경 — 이미 catch 핸들러 attached, await 없이 종료
    void promise;
  }
}

/**
 * Step 3-UX-6e backend M-D1 흡수 — study read endpoint group rate-limit helper.
 *
 * 인증된 사용자가 /mode + /progress + /session/:id + /session/:id/complete를
 * 무제한 호출 시 D1 비용 폭증 / DoS / scraping 위협. user_id + ':study-read' suffix로
 * 별도 카운터 group → /grade와 독립.
 *
 * 분당 60 cap 초과 시 429 + Retry-After + sleepJitter (타이밍 oracle 방어).
 * 카운터 자체 실패 (D1 transient) 시 503 + Retry-After.
 * 반환값 null은 통과, Response 객체는 호출자가 즉시 return.
 */
async function enforceStudyReadRateLimit(
  c: Context<StudyEnv>,
  userId: string,
  logger: Logger,
): Promise<Response | null> {
  try {
    await checkAndIncrementRateLimit(c.env.DB, `${userId}${STUDY_READ_RATE_GROUP_SUFFIX}`, {
      limitPerMinute: STUDY_READ_LIMIT_PER_MINUTE,
    });
    return null;
  } catch (err) {
    if (err instanceof RateLimitExceeded) {
      await sleepJitter();
      c.header('Retry-After', String(err.retryAfterSeconds));
      return c.json({ error: 'RATE_LIMIT_EXCEEDED' }, 429);
    }
    logger.error('study-read rate-limit check failed', err, { userId });
    c.header('Retry-After', '5');
    return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
  }
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

    // Step 3-UX-5c — sessionId optional. 제공 시 user 소유 + 미종료 검증.
    // 응답에 session block(id/mode/phase) 포함 + mode 별 ORDER BY 분기 (weak: weak_score DESC).
    const sessionIdRaw = c.req.query('sessionId');
    let nextSessionRow: StudySessionRow | null = null;
    if (sessionIdRaw !== undefined && sessionIdRaw !== '') {
      try {
        nextSessionRow = await c.env.DB.prepare(
          `SELECT id, user_id, started_at, ended_at, mode, mode_params, phase,
                  cards_planned, cards_completed, correct_count
             FROM study_sessions
            WHERE id = ?
            LIMIT 1`,
        )
          .bind(sessionIdRaw)
          .first<StudySessionRow>();
      } catch (err) {
        logger.error('session lookup failed (next)', err, { userId, sessionId: sessionIdRaw });
        c.header('Retry-After', '5');
        return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
      }
      if (nextSessionRow === null) {
        return c.json({ error: 'SESSION_NOT_FOUND' }, 404);
      }
      if (nextSessionRow.user_id !== userId) {
        return c.json({ error: 'SESSION_FORBIDDEN' }, 403);
      }
      if (nextSessionRow.phase === 'completed' || nextSessionRow.ended_at !== null) {
        return c.json({ error: 'SESSION_ALREADY_COMPLETED' }, 409);
      }
    }

    // Step 3-UX-5c — mode 별 ORDER BY 분기.
    // weak mode: weak_score DESC (D2 lock 정합) + 미시도 우선
    // 기타 (category/topic/confusion/mixed): 기존 정책 (미시도 우선 + correct_count ASC)
    const nextMode: LearningMode | null =
      nextSessionRow !== null ? resolveLearningMode(nextSessionRow.mode) : null;
    const orderClause =
      nextMode === 'weak'
        ? `ORDER BY (up.id IS NULL) DESC,
                COALESCE(up.weak_score, 0) DESC,
                COALESCE(up.correct_count, 0) ASC,
                eq.id ASC`
        : `ORDER BY (up.id IS NULL) DESC,
                COALESCE(up.correct_count, 0) ASC,
                COALESCE(up.total_reviews, 0) ASC,
                eq.id ASC`;

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
          ${orderClause}
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

    // session block 영속 (응답 surface).
    const sessionBlock: NextResponseSession | null =
      nextSessionRow !== null && nextMode !== null
        ? {
            id: nextSessionRow.id,
            mode: nextMode,
            phase: resolveSessionPhase(nextSessionRow.phase),
          }
        : null;

    if (questions.length === 0) {
      return c.json({
        exhausted: true,
        questions: [],
        ...(sessionBlock !== null ? { session: sessionBlock } : {}),
      });
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

    return c.json({
      exhausted: false,
      questions: enriched,
      ...(sessionBlock !== null ? { session: sessionBlock } : {}),
    });
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
      sessionId: requestedSessionId,
    } = parsed.data;

    // Step 3-UX-5c — sessionId 제공 시 user 소유 + 미종료 검증.
    // 잘못된 sessionId (다른 user 또는 없는 id 또는 completed)는 404 / 403 / 409.
    // sessionId 미제공 시 session 통합 비활성 (backward-compat).
    let sessionRow: StudySessionRow | null = null;
    if (requestedSessionId !== undefined) {
      try {
        sessionRow = await c.env.DB.prepare(
          `SELECT id, user_id, started_at, ended_at, mode, mode_params, phase,
                  cards_planned, cards_completed, correct_count
             FROM study_sessions
            WHERE id = ?
            LIMIT 1`,
        )
          .bind(requestedSessionId)
          .first<StudySessionRow>();
      } catch (err) {
        logger.error('session lookup failed', err, { userId, sessionId: requestedSessionId });
        c.header('Retry-After', '5');
        return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
      }
      if (sessionRow === null) {
        return c.json({ error: 'SESSION_NOT_FOUND' }, 404);
      }
      if (sessionRow.user_id !== userId) {
        return c.json({ error: 'SESSION_FORBIDDEN' }, 403);
      }
      if (sessionRow.phase === 'completed' || sessionRow.ended_at !== null) {
        return c.json({ error: 'SESSION_ALREADY_COMPLETED' }, 409);
      }
    }

    // Step 3-UX-5c — streak + session 응답 자료 (UPSERT 실패 시 fallback 영역).
    let streakOut: StreakSummaryOut = { current: 0, longest: 0, dailyGoalProgress: 0 };
    let sessionOut: SessionProgressOut | undefined = undefined;

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

    // === Step A: input_type 분기 채점 (gradeAnswerByType 추출, 5-페르소나 흡수) ===
    const inputType: InputType = resolveInputType(requestedInputType ?? question.input_type);
    const { isCorrect, correctLabel, shuffleSeedForAudit } = await gradeAnswerByType({
      question,
      userAnswer,
      inputType,
      userId,
      selfRating: requestedSelfRating,
      calcTolerance: requestedCalcTolerance,
      logger,
    });

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
      // Step 3-UX-5c — session_id 활성 (sessionRow 있으면 채움).
      try {
        await withRetry(() =>
          c.env.DB.prepare(
            `INSERT INTO study_reviews
               (id, user_id, card_id, card_type, reviewed_at, rating,
                interval_days, stability_before, stability_after, shuffle_seed, session_id)
             VALUES (?, ?, ?, 'exam', ?, ?, ?, ?, ?, ?, ?)`,
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
              sessionRow?.id ?? null,
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

      // Step 3-UX-5c (5-페르소나 흡수) — study_sessions UPDATE 원자성 강화.
      //   - SQL식 증분 (cards_completed + 1) → race 시 둘 다 +1 적용 (quality CRIT-3 흡수)
      //   - phase + ended_at도 SQL CASE로 atomic (memory 계산 race 차단)
      //   - WHERE phase != 'completed' guard 유지 (cards_planned 도달 시 idempotent)
      //   - UPDATE RETURNING으로 응답값 fetch (SELECT 추가 round-trip 절감)
      //   - 실패 시 sessionOut은 직전 state로 fallback (warn 로깅, devops 흡수)
      if (sessionRow !== null) {
        try {
          const updated = await withRetry(() =>
            c.env.DB.prepare(
              `UPDATE study_sessions
                  SET cards_completed = cards_completed + 1,
                      correct_count = correct_count + ?,
                      phase = CASE
                        WHEN (cards_completed + 1) >= cards_planned THEN 'completed'
                        WHEN (cards_completed + 1) * 1.0 / cards_planned >= 0.8 THEN 'cooldown'
                        WHEN (cards_completed + 1) * 1.0 / cards_planned >= 0.2 THEN 'main'
                        ELSE 'warmup'
                      END,
                      ended_at = CASE
                        WHEN (cards_completed + 1) >= cards_planned AND ended_at IS NULL THEN ?
                        ELSE ended_at
                      END
                WHERE id = ?
                  AND user_id = ?
                  AND phase != 'completed'
                RETURNING cards_completed, correct_count, phase, cards_planned`,
            )
              .bind(isCorrect ? 1 : 0, nowIso, sessionRow.id, userId)
              .first<{
                cards_completed: number;
                correct_count: number;
                phase: string;
                cards_planned: number;
              }>(),
          );
          if (updated.value !== null) {
            sessionOut = {
              id: sessionRow.id,
              phase: resolveSessionPhase(updated.value.phase, logger),
              cardsCompleted: updated.value.cards_completed,
              cardsPlanned: updated.value.cards_planned,
              correctCount: updated.value.correct_count,
            };
          } else {
            // WHERE phase != 'completed' 매칭 실패 (race로 다른 호출이 먼저 completed 진입)
            // 정상 시나리오 — 직전 state로 fallback (UI에는 이미 phase 표시됨)
            sessionOut = rowToSessionProgress(sessionRow, logger);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.warn('study_sessions UPDATE failed (progress fallback)', {
            err: errMsg,
            sessionId: sessionRow.id,
            userId,
            event: 'session_silent_failure',
          });
          emitLearningTelemetry(
            c,
            examIdParam.examId,
            {
              event: 'session_update_failure',
              sessionId: sessionRow.id,
              userId,
              error: errMsg,
            },
            logger,
          );
          sessionOut = rowToSessionProgress(sessionRow, logger);
        }
      }

      // Step 3-UX-5c (5-페르소나 흡수) — streak_records UPSERT 원자성 강화.
      //   - SELECT + INSERT/UPDATE → 단일 INSERT ON CONFLICT DO UPDATE WHERE (backend CRIT-2 흡수)
      //   - WHERE last_study_date != excluded.last_study_date 절로 same-day idempotent
      //   - daily_goal는 excluded.daily_goal로 덮지 않음 (사용자 설정 보존)
      //   - today COUNT: substr → reviewed_at >= ? AND < ? range scan (perf CRIT-5 흡수)
      // ★ ADR-041 (KST-only) — `todayDateString()` / `dayBoundsUtc()` 모두 default KST.
      //   last_study_date는 KST YYYY-MM-DD 영속. Year 2 멀티시험 시 ADR-041 §3 재평가.
      try {
        const today = todayDateString();
        const todayBounds = dayBoundsUtc(today);
        const streakExisting = await c.env.DB.prepare(
          `SELECT user_id, current_streak, longest_streak, last_study_date, daily_goal
             FROM streak_records
            WHERE user_id = ?
            LIMIT 1`,
        )
          .bind(userId)
          .first<StreakRecordRow>();

        const previousStreak = {
          lastStudyDate: streakExisting?.last_study_date ?? null,
          currentStreak: streakExisting?.current_streak ?? 0,
          longestStreak: streakExisting?.longest_streak ?? 0,
        };
        const updated = computeStreakUpdate(previousStreak, today);
        const dailyGoal = streakExisting?.daily_goal ?? DEFAULT_DAILY_GOAL;

        await withRetry(() =>
          c.env.DB.prepare(
            `INSERT INTO streak_records
               (user_id, current_streak, longest_streak, last_study_date, daily_goal)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
               current_streak = excluded.current_streak,
               longest_streak = excluded.longest_streak,
               last_study_date = excluded.last_study_date
             WHERE streak_records.last_study_date IS NOT excluded.last_study_date`,
          )
            .bind(
              userId,
              updated.currentStreak,
              updated.longestStreak,
              updated.lastStudyDate,
              dailyGoal,
            )
            .run(),
        );

        // dailyGoalProgress — DISTINCT card_id 누적 / dailyGoal (Step 3-UX-6c-2 4-Pass M-3 흡수).
        // 같은 카드 N회 review = N%가 아닌 1장 학습으로 카운트 → /mode 응답과 일관성 + 진척 정직성.
        const todayCountRow = await c.env.DB.prepare(
          `SELECT COUNT(DISTINCT card_id) AS cnt
             FROM study_reviews
            WHERE user_id = ?
              AND reviewed_at >= ?
              AND reviewed_at < ?`,
        )
          .bind(userId, todayBounds.startUtc, todayBounds.endUtc)
          .first<{ cnt: number }>();
        const todayCount = todayCountRow?.cnt ?? 0;
        const progress = dailyGoal > 0 ? Math.min(todayCount / dailyGoal, 1) : 0;

        streakOut = {
          current: updated.currentStreak,
          longest: updated.longestStreak,
          dailyGoalProgress: progress,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn('streak_records UPSERT failed (fallback to defaults)', {
          err: errMsg,
          userId,
          event: 'streak_silent_failure',
        });
        emitLearningTelemetry(
          c,
          examIdParam.examId,
          { event: 'streak_silent_failure', userId, error: errMsg },
          logger,
        );
      }
    } catch (err) {
      if (err instanceof Error && D1_UNIQUE_CONSTRAINT_PATTERN.test(err.message)) {
        return c.json({ error: 'CONCURRENT_UPDATE' }, 409);
      }
      logger.error('grade write failed', err, { userId, questionId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    // Step 3-UX-5c — learning_slo telemetry emit (devops 5-페르소나 흡수).
    emitLearningTelemetry(
      c,
      examIdParam.examId,
      {
        event: 'grade',
        isCorrect,
        inputType,
        sessionId: sessionRow?.id ?? null,
        dailyGoalProgress: streakOut.dailyGoalProgress,
        currentStreak: streakOut.current,
      },
      logger,
    );

    const result: GradeResultOut = {
      isCorrect,
      correctAnswer: question.answer,
      explanation: question.explanation,
      sourceCitations,
      relatedNodes,
      streak: streakOut,
      ...(correctLabel !== undefined ? { correctLabel } : {}),
      ...(sessionOut !== undefined ? { session: sessionOut } : {}),
    };
    return c.json(result);
  });

  // ---------------------------------------------------------------------------
  // Step 3-UX-5c — /mode + /session endpoint (plan §9.3 + §9.4)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/study/mode?examId=...&examType=1st|2nd
   *
   * 5 mode 별 available 카드 수 + 약점 영역 surface + confusion type breakdown.
   * Step 3-UX-6c-2 (ADR-040 G-1) — streak / dailyGoal block 포함:
   *   - streak.current / streak.longest: streak_records 영속값 (없으면 0)
   *   - streak.dailyGoalProgress: 오늘 KST review 누적 / dailyGoal (0~1 cap)
   *   - dailyGoal: streak_records.daily_goal (없으면 DEFAULT_DAILY_GOAL)
   * UI ModeSelector + SessionStart surface 자료.
   */
  router.get('/mode', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'mode-stats' });
    const userId = c.var.userId;

    const rateLimitResp = await enforceStudyReadRateLimit(c, userId, logger);
    if (rateLimitResp !== null) return rateLimitResp;

    const examIdParam = requireExamId(c.req.query('examId'));
    if (examIdParam.error || !examIdParam.examId) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: examIdParam.error ?? 'examId required' },
        422,
      );
    }
    void examIdParam.examId;

    const examTypeRaw = c.req.query('examType') ?? '1st';
    const examTypeParsed = examTypeSchema.safeParse(examTypeRaw);
    if (!examTypeParsed.success) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: `Invalid examType: ${examTypeRaw}` },
        422,
      );
    }
    const examType = examTypeParsed.data;

    const today = todayDateString();
    const todayBounds = dayBoundsUtc(today);

    try {
      const [
        totalRow,
        confusionRow,
        weakRow,
        weakTopResult,
        confusionBreakdownResult,
        streakRow,
        todayReviewRow,
      ] = await Promise.all([
        c.env.DB.prepare(
          `SELECT COUNT(*) AS cnt FROM exam_questions WHERE status = 'active' AND exam_type = ?`,
        )
          .bind(examType)
          .first<{ cnt: number }>(),
        c.env.DB.prepare(
          `SELECT COUNT(*) AS cnt FROM exam_questions
              WHERE status = 'active'
                AND exam_type = ?
                AND confusion_type IS NOT NULL`,
        )
          .bind(examType)
          .first<{ cnt: number }>(),
        c.env.DB.prepare(
          `SELECT COUNT(*) AS cnt FROM user_progress up
               JOIN exam_questions eq ON eq.id = up.card_id AND eq.status = 'active' AND eq.exam_type = ?
              WHERE up.user_id = ?
                AND up.card_type = 'exam'
                AND up.weak_score > 0`,
        )
          .bind(examType, userId)
          .first<{ cnt: number }>(),
        c.env.DB.prepare(
          `SELECT eq.id AS card_id, eq.subject, up.weak_score
               FROM user_progress up
               JOIN exam_questions eq ON eq.id = up.card_id AND eq.status = 'active' AND eq.exam_type = ?
              WHERE up.user_id = ?
                AND up.card_type = 'exam'
                AND up.weak_score > 0
              ORDER BY up.weak_score DESC
              LIMIT ?`,
        )
          .bind(examType, userId, WEAK_TOP_LIMIT)
          .all<{ card_id: string; subject: string | null; weak_score: number }>(),
        c.env.DB.prepare(
          `SELECT confusion_type AS type, COUNT(*) AS cnt
               FROM exam_questions
              WHERE status = 'active'
                AND exam_type = ?
                AND confusion_type IS NOT NULL
              GROUP BY confusion_type
              ORDER BY cnt DESC`,
        )
          .bind(examType)
          .all<{ type: string; cnt: number }>(),
        c.env.DB.prepare(
          `SELECT current_streak, longest_streak, daily_goal
             FROM streak_records
            WHERE user_id = ?
            LIMIT 1`,
        )
          .bind(userId)
          .first<{ current_streak: number; longest_streak: number; daily_goal: number }>(),
        c.env.DB.prepare(
          `SELECT COUNT(DISTINCT card_id) AS cnt
             FROM study_reviews
            WHERE user_id = ?
              AND reviewed_at >= ?
              AND reviewed_at < ?`,
        )
          .bind(userId, todayBounds.startUtc, todayBounds.endUtc)
          .first<{ cnt: number }>(),
      ]);

      const total = totalRow?.cnt ?? 0;
      const confusion = confusionRow?.cnt ?? 0;
      const weak = weakRow?.cnt ?? 0;

      const dailyGoal = streakRow?.daily_goal ?? DEFAULT_DAILY_GOAL;
      // dailyGoalProgress — DISTINCT card_id 누적 / dailyGoal (4-Pass silent M-3 흡수).
      // 같은 카드 N회 review = N%가 아닌 1장 학습으로 카운트 → 진척 surface 정직성.
      const todayCount = todayReviewRow?.cnt ?? 0;
      const dailyGoalProgress = dailyGoal > 0 ? Math.min(todayCount / dailyGoal, 1) : 0;

      return c.json({
        examId: examIdParam.examId,
        examType,
        modes: [
          { mode: 'category', available: total, wired: WIRED_MODES.has('category') },
          { mode: 'topic', available: total, wired: WIRED_MODES.has('topic') },
          { mode: 'confusion', available: confusion, wired: WIRED_MODES.has('confusion') },
          { mode: 'weak', available: weak, wired: WIRED_MODES.has('weak') },
          { mode: 'mixed', available: total, wired: WIRED_MODES.has('mixed') },
        ] satisfies ReadonlyArray<{ mode: LearningMode; available: number; wired: boolean }>,
        weakTop: weakTopResult.results.map((row) => ({
          cardId: row.card_id,
          subject: row.subject,
          weakScore: row.weak_score,
        })),
        confusionTypes: confusionBreakdownResult.results.map((row) => ({
          type: row.type,
          count: row.cnt,
        })),
        streak: {
          current: streakRow?.current_streak ?? 0,
          longest: streakRow?.longest_streak ?? 0,
          dailyGoalProgress,
        },
        dailyGoal,
      });
    } catch (err) {
      logger.error('mode stats query failed', err, { userId, examType });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  /**
   * GET /api/study/progress?examId=...&examType=1st|2nd&days=N
   *
   * Step 3-UX-6d ProgressVisualization 자료. LOCK §1 sidebar A (오늘+7일+마스터) +
   * full page C (30일 dot strip) source. examId 시그니처 (Hard Rule 16).
   *
   * 응답:
   *   - daily: 최근 N일 학습량 — KST 일자별 DISTINCT card_id 카운트 + 오늘 여부
   *   - subjects: 과목별 마스터 — mastered_at NOT NULL count / 전체 user_progress count
   *   - dailyGoal: 사용자 설정 (없으면 DEFAULT_DAILY_GOAL)
   *
   * N 상한 30 (full page C 30일 dot strip 정합). N < 1 또는 N > 30 → 422.
   */
  const PROGRESS_DAYS_MIN = 1;
  const PROGRESS_DAYS_MAX = 30;
  // sidebar A는 상위 5건 slice / full page C는 상위 8건 slice. 서버는 max 8 영속 (4-Pass I-2 흡수).
  const SUBJECT_MASTERY_LIMIT = 8;

  router.get('/progress', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'progress' });
    const userId = c.var.userId;

    const rateLimitResp = await enforceStudyReadRateLimit(c, userId, logger);
    if (rateLimitResp !== null) return rateLimitResp;

    const examIdParam = requireExamId(c.req.query('examId'));
    if (examIdParam.error || !examIdParam.examId) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: examIdParam.error ?? 'examId required' },
        422,
      );
    }
    void examIdParam.examId;

    const examTypeRaw = c.req.query('examType') ?? '1st';
    const examTypeParsed = examTypeSchema.safeParse(examTypeRaw);
    if (!examTypeParsed.success) {
      // 4-Pass M-2 흡수 — raw echo 차단. enum 후보 명시.
      return c.json({ error: 'VALIDATION_ERROR', message: 'examType must be 1st or 2nd' }, 422);
    }
    const examType = examTypeParsed.data;

    const daysRaw = c.req.query('days') ?? '7';
    const daysNum = Number(daysRaw);
    if (!Number.isInteger(daysNum) || daysNum < PROGRESS_DAYS_MIN || daysNum > PROGRESS_DAYS_MAX) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: `days must be integer in [${PROGRESS_DAYS_MIN}, ${PROGRESS_DAYS_MAX}]`,
        },
        422,
      );
    }

    // KST 기준 today + N일 전까지의 일자 배열 생성.
    const today = todayDateString();
    const startDate = (() => {
      // today에서 days-1일 빼서 시작 날짜 산출 (today 포함).
      const [y, m, d] = today.split('-').map(Number);
      const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 0));
      dt.setUTCDate(dt.getUTCDate() - (daysNum - 1));
      return dt.toISOString().slice(0, 10);
    })();
    const startBounds = dayBoundsUtc(startDate);
    const endBounds = dayBoundsUtc(today);

    try {
      // C-P1 흡수 — /progress 응답에 streak 통합 (이전 클라이언트가 /mode 별도 호출하던 부담 제거).
      // 일일 KST 카운트는 daily 집계로부터 isToday entry로 산출 → 별도 today review 쿼리 불요.
      const [streakRow, dailyResult, subjectsResult] = await Promise.all([
        c.env.DB.prepare(
          `SELECT current_streak, longest_streak, daily_goal
             FROM streak_records WHERE user_id = ? LIMIT 1`,
        )
          .bind(userId)
          .first<{ current_streak: number; longest_streak: number; daily_goal: number }>(),
        // 일자별 DISTINCT card_id 카운트. reviewed_at은 ISO 8601 UTC, KST 기준 date 추출은
        // strftime + '+9 hours' offset 적용 (D1 SQLite 정합).
        c.env.DB.prepare(
          `SELECT strftime('%Y-%m-%d', reviewed_at, '+9 hours') AS date,
                  COUNT(DISTINCT card_id) AS cnt
             FROM study_reviews
            WHERE user_id = ?
              AND reviewed_at >= ?
              AND reviewed_at < ?
            GROUP BY date
            ORDER BY date ASC`,
        )
          .bind(userId, startBounds.startUtc, endBounds.endUtc)
          .all<{ date: string; cnt: number }>(),
        // 과목별 마스터 — exam_questions JOIN user_progress, GROUP BY subject.
        // mastered_at NOT NULL = 마스터 도달, total = active 카드 수 (탐색 가능 모수).
        c.env.DB.prepare(
          `SELECT eq.subject AS subject,
                  COUNT(*) AS total,
                  SUM(CASE WHEN up.mastered_at IS NOT NULL THEN 1 ELSE 0 END) AS mastered
             FROM exam_questions eq
             LEFT JOIN user_progress up
                   ON up.card_id = eq.id
                  AND up.user_id = ?
                  AND up.card_type = 'exam'
                  AND up.node_id IS NULL
            WHERE eq.status = 'active'
              AND eq.exam_type = ?
              AND eq.subject IS NOT NULL
            GROUP BY eq.subject
            ORDER BY total DESC
            LIMIT ?`,
        )
          .bind(userId, examType, SUBJECT_MASTERY_LIMIT)
          .all<{ subject: string; total: number; mastered: number }>(),
      ]);

      const dailyGoal = streakRow?.daily_goal ?? DEFAULT_DAILY_GOAL;
      const dailyMap = new Map(dailyResult.results.map((r) => [r.date, r.cnt]));

      // 클라이언트 표시 순서 보장 — startDate부터 today까지 N개 일자 영속.
      const daily: Array<{ date: string; cardsDistinct: number; isToday: boolean }> = [];
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const cursor = new Date(Date.UTC(sy ?? 0, (sm ?? 1) - 1, sd ?? 0));
      for (let i = 0; i < daysNum; i++) {
        const date = cursor.toISOString().slice(0, 10);
        daily.push({
          date,
          cardsDistinct: dailyMap.get(date) ?? 0,
          isToday: date === today,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      const subjects = subjectsResult.results.map((row) => ({
        subject: row.subject,
        total: row.total,
        mastered: row.mastered,
        masteryPct: row.total > 0 ? row.mastered / row.total : 0,
      }));

      // C-P1 흡수 — streak block 응답에 포함 (오늘 KST DISTINCT는 daily isToday entry).
      const todayCount = daily.find((d) => d.isToday)?.cardsDistinct ?? 0;
      const dailyGoalProgress = dailyGoal > 0 ? Math.min(todayCount / dailyGoal, 1) : 0;

      return c.json({
        examId: examIdParam.examId,
        examType,
        days: daysNum,
        dailyGoal,
        daily,
        subjects,
        streak: {
          current: streakRow?.current_streak ?? 0,
          longest: streakRow?.longest_streak ?? 0,
          dailyGoalProgress,
        },
      });
    } catch (err) {
      logger.error('progress query failed', err, { userId, examType, days: daysNum });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  /**
   * POST /api/study/mode/start
   *
   * 학습 세션 생성. mode + cardsPlanned 정책으로 study_sessions INSERT.
   * 응답: 생성된 sessionId + 초기 phase='warmup'.
   */
  router.post('/mode/start', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'mode-start' });
    const userId = c.var.userId;

    const rateLimitResp = await enforceStudyReadRateLimit(c, userId, logger);
    if (rateLimitResp !== null) return rateLimitResp;

    const examIdParam = requireExamId(c.req.query('examId'));
    if (examIdParam.error || !examIdParam.examId) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: examIdParam.error ?? 'examId required' },
        422,
      );
    }
    void examIdParam.examId;

    const parsed = modeStartSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 422);
    }
    const { mode, modeParams, cardsPlanned } = parsed.data;

    // WS-0d 모드 정직성 — 미배선 모드 세션 시작 거부 (UI 비활성의 서버측 강제,
    // API 직접 호출 우회 차단). 배선 완료 시 WIRED_MODES 등재로 자동 해제.
    if (!WIRED_MODES.has(mode)) {
      return c.json(
        {
          error: 'MODE_NOT_AVAILABLE',
          message: `mode '${mode}' is not wired to the serving pool yet`,
          wiredModes: [...WIRED_MODES],
        },
        422,
      );
    }

    const sessionId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const modeParamsJson =
      modeParams !== undefined && modeParams !== null ? JSON.stringify(modeParams) : null;

    try {
      const insertResult = await withRetry(() =>
        c.env.DB.prepare(
          `INSERT INTO study_sessions
             (id, user_id, started_at, ended_at, mode, mode_params, phase,
              cards_planned, cards_completed, correct_count)
           VALUES (?, ?, ?, NULL, ?, ?, 'warmup', ?, 0, 0)`,
        )
          .bind(sessionId, userId, nowIso, mode, modeParamsJson, cardsPlanned)
          .run(),
      );
      if (!insertResult.value.success) {
        throw new Error('D1_INSERT_FAILED');
      }
    } catch (err) {
      logger.error('study_sessions INSERT failed', err, { userId, mode, cardsPlanned });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    emitLearningTelemetry(
      c,
      examIdParam.examId,
      { event: 'mode_start', sessionId, mode, cardsPlanned },
      logger,
    );

    return c.json({
      sessionId,
      mode,
      phase: 'warmup' as SessionPhase,
      cardsPlanned,
      cardsCompleted: 0,
      correctCount: 0,
      startedAt: nowIso,
    });
  });

  /**
   * GET /api/study/session/:id
   *
   * 세션 진척 추적. user 소유 검증 + 모든 필드 surface.
   */
  router.get('/session/:id', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'session-get' });
    const userId = c.var.userId;
    const sessionId = c.req.param('id');

    const rateLimitResp = await enforceStudyReadRateLimit(c, userId, logger);
    if (rateLimitResp !== null) return rateLimitResp;

    if (sessionId === undefined || sessionId === '') {
      return c.json({ error: 'VALIDATION_ERROR', message: 'sessionId required' }, 422);
    }

    let row: StudySessionRow | null;
    try {
      row = await c.env.DB.prepare(
        `SELECT id, user_id, started_at, ended_at, mode, mode_params, phase,
                cards_planned, cards_completed, correct_count
           FROM study_sessions
          WHERE id = ?
          LIMIT 1`,
      )
        .bind(sessionId)
        .first<StudySessionRow>();
    } catch (err) {
      logger.error('session lookup failed', err, { userId, sessionId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    if (row === null) {
      return c.json({ error: 'SESSION_NOT_FOUND' }, 404);
    }
    if (row.user_id !== userId) {
      return c.json({ error: 'SESSION_FORBIDDEN' }, 403);
    }

    let modeParams: Record<string, unknown> | null = null;
    if (row.mode_params !== null) {
      try {
        const parsed: unknown = JSON.parse(row.mode_params);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          modeParams = parsed as Record<string, unknown>;
        }
      } catch (err) {
        logger.warn('mode_params JSON parse failed', {
          err: err instanceof Error ? err.message : String(err),
          sessionId,
        });
      }
    }

    return c.json({
      id: row.id,
      mode: resolveLearningMode(row.mode),
      modeParams,
      phase: resolveSessionPhase(row.phase),
      cardsPlanned: row.cards_planned,
      cardsCompleted: row.cards_completed,
      correctCount: row.correct_count,
      startedAt: row.started_at,
      endedAt: row.ended_at,
    });
  });

  /**
   * 세션 종료 시 약점 영역 잔존 산출 (ADR-040 G-2).
   *
   * 본 세션에서 본 카드 각각에 대해 현 user_progress.weak_score를 조회 후
   * subject 단위 reviewed / stillWeak 누적. weak_score > 0 = "약점 잔존" (`/mode` weak
   * available 임계값과 정합). "before" 스냅샷은 보유하지 않으므로 단순 delta(개선치)는
   * 산출하지 않는다 — 현재 잔존 약점 수와 reviewed 수를 함께 노출하여 사용자가 직접
   * 비교 가능 (ADR-040 §"결정 §1 G-2 채택 사유" 정합).
   *
   * Hard Rule 16: examId 시그니처 의무 (Year 2 zero-cost 전환 시 본 함수에서
   * `AND eq.exam_id = ?` 절 주입 — 본 step 흡수).
   */
  async function computeWeakDelta(
    db: D1Database,
    userId: string,
    sessionId: string,
    examId: ExamId,
    logger: Logger,
  ): Promise<{
    available: boolean;
    cardsReviewed: number;
    stillWeakCount: number;
    bySubject: ReadonlyArray<{ subject: string | null; reviewed: number; stillWeak: number }>;
  }> {
    void examId; // Year 1 단일 시험. Year 2에 WHERE eq.exam_id = ? 절 활성화.
    try {
      // GROUP BY sr.card_id — DISTINCT 가 (card_id, subject, weak_score) 3-tuple 기준이라
      // user_progress 중복 row 발생 시 dedupe 실패 가능 (4-Pass silent M-4 흡수).
      // 단일 row per card 보장 → cardsReviewed = distinct card 수.
      const result = await db
        .prepare(
          `SELECT sr.card_id AS card_id,
                  MIN(eq.subject) AS subject,
                  MAX(COALESCE(up.weak_score, 0)) AS weak_score
             FROM study_reviews sr
             JOIN exam_questions eq ON eq.id = sr.card_id
             LEFT JOIN user_progress up
                   ON up.user_id = sr.user_id
                  AND up.card_id = sr.card_id
                  AND up.card_type = 'exam'
                  AND up.node_id IS NULL
            WHERE sr.session_id = ?
              AND sr.user_id = ?
            GROUP BY sr.card_id`,
        )
        .bind(sessionId, userId)
        .all<{ card_id: string; subject: string | null; weak_score: number }>();

      const subjectMap = new Map<string | null, { reviewed: number; stillWeak: number }>();
      let cardsReviewed = 0;
      let stillWeakCount = 0;
      for (const row of result.results) {
        cardsReviewed++;
        const weak = Number(row.weak_score ?? 0);
        const isStillWeak = weak > 0;
        if (isStillWeak) stillWeakCount++;
        const key = row.subject ?? null;
        const entry = subjectMap.get(key) ?? { reviewed: 0, stillWeak: 0 };
        entry.reviewed++;
        if (isStillWeak) entry.stillWeak++;
        subjectMap.set(key, entry);
      }
      const bySubject = Array.from(subjectMap.entries())
        .map(([subject, agg]) => ({ subject, reviewed: agg.reviewed, stillWeak: agg.stillWeak }))
        .sort((a, b) => b.reviewed - a.reviewed);
      return { available: true, cardsReviewed, stillWeakCount, bySubject };
    } catch (err) {
      // C-1 흡수 — silent failure를 정상 0건과 구분하는 `available: false` flag +
      // streak silent failure 패턴 정합 telemetry emit.
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn('weakDelta query failed (fallback to unavailable)', {
        err: errMsg,
        userId,
        sessionId,
        event: 'weak_delta_silent_failure',
      });
      return { available: false, cardsReviewed: 0, stillWeakCount: 0, bySubject: [] };
    }
  }

  /**
   * POST /api/study/session/:id/complete
   *
   * 세션 종료. phase='completed' + ended_at 설정 + 요약 응답.
   * 이미 종료된 세션 재호출 → idempotent (현재 state 응답).
   * Step 3-UX-6c-2 (ADR-040 G-2) — weakDelta 포함 (subject 단위 reviewed / stillWeak).
   */
  router.post('/session/:id/complete', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'session-complete' });
    const userId = c.var.userId;
    const sessionId = c.req.param('id');

    const rateLimitResp = await enforceStudyReadRateLimit(c, userId, logger);
    if (rateLimitResp !== null) return rateLimitResp;

    if (sessionId === undefined || sessionId === '') {
      return c.json({ error: 'VALIDATION_ERROR', message: 'sessionId required' }, 422);
    }

    let row: StudySessionRow | null;
    try {
      row = await c.env.DB.prepare(
        `SELECT id, user_id, started_at, ended_at, mode, mode_params, phase,
                cards_planned, cards_completed, correct_count
           FROM study_sessions
          WHERE id = ?
          LIMIT 1`,
      )
        .bind(sessionId)
        .first<StudySessionRow>();
    } catch (err) {
      logger.error('session lookup failed (complete)', err, { userId, sessionId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    if (row === null) {
      return c.json({ error: 'SESSION_NOT_FOUND' }, 404);
    }
    if (row.user_id !== userId) {
      return c.json({ error: 'SESSION_FORBIDDEN' }, 403);
    }

    const nowIso = new Date().toISOString();
    const endedAt = row.ended_at ?? nowIso;
    const alreadyCompleted = row.phase === 'completed' && row.ended_at !== null;

    if (!alreadyCompleted) {
      try {
        await withRetry(() =>
          c.env.DB.prepare(
            `UPDATE study_sessions
                SET phase = 'completed',
                    ended_at = COALESCE(ended_at, ?)
              WHERE id = ?
                AND user_id = ?`,
          )
            .bind(nowIso, sessionId, userId)
            .run(),
        );
      } catch (err) {
        logger.error('session UPDATE complete failed', err, { userId, sessionId });
        c.header('Retry-After', '5');
        return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
      }
    }

    const correctRate = row.cards_completed > 0 ? row.correct_count / row.cards_completed : 0;
    const startedMs = Date.parse(row.started_at);
    const endedMs = Date.parse(endedAt);
    const durationMinutes =
      Number.isFinite(startedMs) && Number.isFinite(endedMs)
        ? Math.max(0, (endedMs - startedMs) / 60_000)
        : 0;

    // Step 3-UX-5c — learning_slo telemetry emit (admin-web 세션 완료 추적).
    emitLearningTelemetry(
      c,
      EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      {
        event: 'session_complete',
        sessionId,
        mode: resolveLearningMode(row.mode),
        cardsCompleted: row.cards_completed,
        cardsPlanned: row.cards_planned,
        correctRate,
        durationMinutes,
      },
      logger,
    );

    // Step 3-UX-6c-2 (ADR-040 G-2) — 본 세션 distinct card 의 현재 weak_score를 subject 단위 집계.
    const weakDelta = await computeWeakDelta(
      c.env.DB,
      userId,
      sessionId,
      EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      logger,
    );

    if (!weakDelta.available) {
      // C-1 흡수 — silent failure를 운영 측에서 추적 가능하도록 telemetry emit.
      emitLearningTelemetry(
        c,
        EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        { event: 'weak_delta_silent_failure', sessionId, userId },
        logger,
      );
    }

    return c.json({
      id: row.id,
      mode: resolveLearningMode(row.mode),
      phase: 'completed' as SessionPhase,
      cardsPlanned: row.cards_planned,
      cardsCompleted: row.cards_completed,
      correctCount: row.correct_count,
      correctRate,
      startedAt: row.started_at,
      endedAt,
      durationMinutes,
      weakDelta,
    });
  });

  return router;
}
