/**
 * public/routes — 무인증·무료·홍보용 공개 학습 표면 `/api/public/*`.
 *
 * 인증 study 라우트(`router.use('*', requireAuth)`, routes.ts:824)와 **완전 분리된
 * 별도 Hono 라우터** — 기존 study 라우트에 우회 마운트 금지(지뢰 #2). 내부 채점·보기
 * 계약 로직은 packages/learning-modes 단일 정본을 재사용(복붙 0):
 *   - parseMcChoices  = 보기 배열 + answer 위치 라벨 계약 (인증 buildShuffledChoices 와 공유)
 *   - gradeFillBlank  = 단답 normalize 매칭
 *   - choice-id       = 공개 표면 전용 불투명 choiceId(셔플시드 대체, G-1 무상태)
 *
 * 경계 강제(불변):
 *   - `exam_type='1st'` **서버 고정**(클라 파라미터 불가) + `status='active'` 를
 *     서빙·채점 **양쪽** WHERE 에 — 2차/flagged 문항 누출 차단(지뢰 #4, 회귀 테스트 2건).
 *   - 서빙 projection = answer·explanation 비노출. 정답은 채점 응답에서만(F-3).
 *   - user_progress 기록 0(G-1). 서버측 기록 = Analytics Engine 익명 이벤트뿐(PII 0).
 *
 * 근거: docs/plans/promo-1st-free-service-scope-20260708.md §3 BE-2 + 핸드오프 P1.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createLogger, ErrorCode, type Logger, type LoggerEnvironment } from '@thepick/shared';
import {
  gradeFillBlank,
  parseMcAnswerLabels,
  parseMcChoices,
  resolveInputType,
  type InputType,
} from '@thepick/learning-modes';
import { getClientIp, type RateLimiter } from '../auth/rate-limit.js';
import { checkPublicIpRateLimit } from './rate-limit.js';
import { issueChoiceId, resolveChoiceId } from './choice-id.js';
import { recordPublicEvent, type AnalyticsEngineDataset } from './analytics.js';

export interface PublicRouteBindings {
  readonly DB: D1Database;
  /** 공개 표면 per-IP rate limit (해시 IP). wrangler unsafe binding. */
  readonly PUBLIC_RATE_LIMITER_IP?: RateLimiter;
  /** 익명 이벤트 dataset (PII 0). 미설정 시 no-op. */
  readonly PUBLIC_ANALYTICS?: AnalyticsEngineDataset;
  /** choiceId HMAC 서명 키(auth 와 공유). 미설정 시 폴백 상수(F-3 하 보안 영향 0). */
  readonly JWT_SECRET?: string;
  readonly IP_PEPPER?: string;
  readonly ENVIRONMENT?: string;
}

/** 서버 고정 시험 종목 — 클라이언트 파라미터로 절대 치환 불가(경계 강제). */
const FIXED_EXAM_TYPE = '1st';
const FIXED_STATUS = 'active';

const MAX_SUBJECT_PARAM_LEN = 100;
const SERVABLE_INPUT_TYPES: readonly InputType[] = ['multiple_choice', 'fill_blank'];

/** 서빙 row (answer/distractors 는 내부용 — projection 비노출). */
interface ServeRow {
  readonly id: string;
  readonly year: number;
  readonly round: number | null;
  readonly question_number: number | null;
  readonly subject: string | null;
  readonly content: string;
  readonly input_type: string | null;
  readonly answer: string | null;
  readonly distractors: string | null;
}

interface GradeRow {
  readonly id: string;
  readonly subject: string | null;
  readonly answer: string | null;
  readonly explanation: string | null;
  readonly input_type: string | null;
  readonly distractors: string | null;
}

interface PublicChoiceOut {
  readonly choiceId: string;
  readonly text: string;
}

interface PublicNextQuestionOut {
  readonly id: string;
  readonly year: number;
  readonly round: number | null;
  readonly questionNumber: number | null;
  readonly subject: string | null;
  readonly content: string;
  readonly examType: string;
  readonly inputType: InputType;
  /** 객관식만 — 표시 순서 셔플된 {choiceId, text}. 정답 위치 비노출. */
  readonly choices: readonly PublicChoiceOut[] | null;
}

const GradeBodySchema = z.object({
  questionId: z.string().min(1).max(128),
  /** 객관식 — 서빙 시 발급된 불투명 choiceId. */
  choiceId: z.string().min(1).max(64).optional(),
  /** 단답 — 사용자 입력 텍스트. */
  answer: z.string().min(1).max(2000).optional(),
});

function buildLogger(env: PublicRouteBindings, route: string): Logger {
  const known: ReadonlySet<string> = new Set(['development', 'staging', 'production', 'test']);
  const environment: LoggerEnvironment = known.has(env.ENVIRONMENT ?? '')
    ? (env.ENVIRONMENT as LoggerEnvironment)
    : 'development';
  return createLogger({ service: 'thepick-api', environment }).child({ module: 'public', route });
}

/** subject 쿼리 파라미터 정규화(길이 가드). null = 미지정. */
function normalizeSubjectParam(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SUBJECT_PARAM_LEN) return null;
  return trimmed;
}

/** round 쿼리 파라미터 → 양의 정수 또는 null. */
function normalizeRoundParam(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** inputType 쿼리 파라미터 → 서빙 가능 타입 또는 null(미필터). */
function normalizeInputTypeParam(raw: string | undefined): InputType | null {
  if (raw === undefined) return null;
  return SERVABLE_INPUT_TYPES.find((t) => t === raw) ?? null;
}

function randomIntBelow(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % maxExclusive;
}

/** 표시 순서 셔플(암호 난수) — 정답이 항상 같은 위치에 오지 않도록. 채점 무관(choiceId). */
function cryptoShuffle<T>(items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIntBelow(i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** SERVE 후보당 최대 조회 수 — RANDOM 단일 픽이 결함행에 적중해도 유효행 잔존 시 서빙(m-2/m-4). */
const SERVE_CANDIDATE_LIMIT = 10;

/**
 * 문항이 **선언된 input_type 대로 정확히 채점 가능한가** = 서빙 자격(4-Pass M-2).
 *   - MC: parseMcChoices 계약 통과(보기 배열 + 위치라벨 정합).
 *   - fill_blank: answer 가 위치라벨(MC-in-disguise)이 아닌 진성 텍스트 정답.
 *     ★ 현 1차 525 = distractors NULL·answer 위치라벨 = BE-1(보기 추출) 전 = 서빙 부적격
 *       → 정확히 채점 못 할 문항을 서빙/채점하지 않음(정답 100% 불변 fail-safe).
 *   - essay/calc: 공개 표면 미지원(Formula Engine 미경유 문자열 폴백 오채점 차단).
 */
function isServable(row: {
  readonly input_type: string | null;
  readonly answer: string | null;
  readonly distractors: string | null;
}): boolean {
  const it = resolveInputType(row.input_type);
  if (it === 'multiple_choice') return parseMcChoices(row.distractors, row.answer).ok;
  if (it === 'fill_blank') {
    return row.answer !== null && row.answer !== '' && parseMcAnswerLabels(row.answer) === null;
  }
  return false;
}

/**
 * 서빙용 MC 보기 build — parseMcChoices(단일 정본) → 보기별 choiceId 발급 → 표시 셔플.
 * 계약 위반(적재 결함) 시 null → 호출 측이 서빙 거부.
 */
async function buildPublicChoices(
  secret: string,
  row: ServeRow,
  logger: Logger,
): Promise<PublicChoiceOut[] | null> {
  const parsed = parseMcChoices(row.distractors, row.answer);
  if (!parsed.ok) {
    logger.warn('MC serve refused — choice contract', {
      questionId: row.id,
      reason: parsed.reason,
    });
    return null;
  }
  const choices: PublicChoiceOut[] = [];
  for (let originalIndex = 0; originalIndex < parsed.originalTexts.length; originalIndex++) {
    choices.push({
      choiceId: await issueChoiceId(secret, row.id, originalIndex),
      text: parsed.originalTexts[originalIndex]!,
    });
  }
  return cryptoShuffle(choices);
}

export function createPublicRoutes(): Hono<{ Bindings: PublicRouteBindings }> {
  const app = new Hono<{ Bindings: PublicRouteBindings }>();

  // 공개 표면 per-IP rate limit (해시 IP, PII 0) — 전 핸들러 선행.
  app.use('*', async (c, next): Promise<void | Response> => {
    const logger = buildLogger(c.env, 'rate-limit');
    const ok = await checkPublicIpRateLimit(
      c.env.PUBLIC_RATE_LIMITER_IP,
      getClientIp(c),
      c.env.IP_PEPPER,
      c.env.ENVIRONMENT,
      logger,
    );
    if (!ok) {
      c.header('Retry-After', '60');
      return c.json({ error: 'TOO_MANY_REQUESTS' }, 429);
    }
    await next();
  });

  // GET /api/public/questions/next — 랜덤 서빙(비노출 projection).
  app.get('/questions/next', async (c) => {
    const logger = buildLogger(c.env, 'next');
    const subject = normalizeSubjectParam(c.req.query('subject'));
    const round = normalizeRoundParam(c.req.query('round'));
    const inputTypeFilter = normalizeInputTypeParam(c.req.query('inputType'));

    // exam_type/status 는 서버 고정 — 클라 파라미터 경로 없음(경계 강제).
    // input_type 은 서빙 가능 타입(SERVABLE)으로 SQL 제약(4-Pass m-1/m-8) —
    // 필터 지정 시 그 타입, 미지정 시 IN(multiple_choice, fill_blank).
    const conditions: string[] = ['status = ?', 'exam_type = ?'];
    const params: (string | number)[] = [FIXED_STATUS, FIXED_EXAM_TYPE];
    if (inputTypeFilter !== null) {
      conditions.push('input_type = ?');
      params.push(inputTypeFilter);
    } else {
      conditions.push(`input_type IN (${SERVABLE_INPUT_TYPES.map(() => '?').join(', ')})`);
      params.push(...SERVABLE_INPUT_TYPES);
    }
    if (subject !== null) {
      conditions.push('subject = ?');
      params.push(subject);
    }
    if (round !== null) {
      conditions.push('round = ?');
      params.push(round);
    }

    // 후보 N개 조회 후 서버측 자격 판정(isServable)으로 첫 유효행 선택 —
    // RANDOM 단일 픽이 결함행에 적중해도 유효 문항 잔존 시 서빙(m-2/m-4).
    const sql = `SELECT id, year, round, question_number, subject, content, input_type, answer, distractors
                 FROM exam_questions
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY RANDOM()
                 LIMIT ${SERVE_CANDIDATE_LIMIT}`;

    let candidates: ServeRow[];
    try {
      const result = await c.env.DB.prepare(sql)
        .bind(...params)
        .all<ServeRow>();
      candidates = result.results;
    } catch (err) {
      logger.error('serve query failed', err);
      return c.json({ error: ErrorCode.INTERNAL_ERROR }, 500);
    }

    const row = candidates.find(isServable) ?? null;
    if (row === null) {
      // 서빙 자격 문항 0 — 현 1차는 BE-1(보기 추출) 승급 전까지 정상 서빙 대상 없음.
      return c.json({ error: 'NO_QUESTION' }, 404);
    }

    const inputType = resolveInputType(row.input_type);
    let choices: PublicChoiceOut[] | null = null;
    if (inputType === 'multiple_choice') {
      const secret = c.env.JWT_SECRET ?? '';
      choices = await buildPublicChoices(secret, row, logger);
      if (choices === null) {
        // isServable 이 parseMcChoices.ok 를 이미 보장 → null 은 비정상(방어).
        logger.error('MC serve build failed after isServable pass', undefined, {
          questionId: row.id,
        });
        return c.json({ error: 'QUESTION_UNAVAILABLE' }, 404);
      }
    }

    const out: PublicNextQuestionOut = {
      id: row.id,
      year: row.year,
      round: row.round,
      questionNumber: row.question_number,
      subject: row.subject,
      content: row.content,
      examType: FIXED_EXAM_TYPE,
      inputType,
      choices,
    };

    recordPublicEvent(c.env.PUBLIC_ANALYTICS, 'serve', {
      subject: row.subject,
      round: row.round,
      inputType,
      examType: FIXED_EXAM_TYPE,
    });

    return c.json(out);
  });

  // POST /api/public/grade — 서버 채점(정답은 여기서만 노출).
  app.post('/grade', async (c) => {
    const logger = buildLogger(c.env, 'grade');
    const raw = await c.req.json().catch(() => null);
    const parsed = GradeBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, details: parsed.error.format() }, 400);
    }
    const { questionId, choiceId, answer } = parsed.data;

    // ★ 경계 강제: exam_type='1st' AND status='active' 양쪽 — 2차/flagged id 채점 거부(지뢰 #4).
    let row: GradeRow | null;
    try {
      row = await c.env.DB.prepare(
        `SELECT id, subject, answer, explanation, input_type, distractors
         FROM exam_questions
         WHERE id = ? AND exam_type = ? AND status = ?
         LIMIT 1`,
      )
        .bind(questionId, FIXED_EXAM_TYPE, FIXED_STATUS)
        .first<GradeRow>();
    } catch (err) {
      logger.error('grade query failed', err);
      return c.json({ error: ErrorCode.INTERNAL_ERROR }, 500);
    }

    if (row === null) {
      // 미존재·2차·flagged·deprecated 전부 여기로(정보 노출 최소).
      return c.json({ error: 'QUESTION_NOT_FOUND' }, 404);
    }
    if (row.answer === null || row.answer === '') {
      return c.json({ error: 'QUESTION_HAS_NO_ANSWER' }, 422);
    }

    const inputType = resolveInputType(row.input_type);
    const correctAnswer = row.answer;

    let isCorrect: boolean;
    let correctChoiceIds: string[] | undefined;

    if (inputType === 'multiple_choice') {
      if (choiceId === undefined) {
        return c.json({ error: 'CHOICE_ID_REQUIRED' }, 400);
      }
      const mc = parseMcChoices(row.distractors, row.answer);
      if (!mc.ok) {
        logger.error('grade MC contract violation (data defect)', undefined, {
          questionId: row.id,
          reason: mc.reason,
        });
        return c.json({ error: 'QUESTION_NOT_GRADABLE' }, 422);
      }
      const secret = c.env.JWT_SECRET ?? '';
      const submittedIndex = await resolveChoiceId(
        secret,
        row.id,
        mc.originalTexts.length,
        choiceId,
      );
      isCorrect = submittedIndex !== null && mc.correctOriginalIndices.has(submittedIndex);
      // 정답 보기 하이라이트용 — 정답 위치들의 choiceId 재발급.
      correctChoiceIds = [];
      for (const oi of mc.correctOriginalIndices) {
        correctChoiceIds.push(await issueChoiceId(secret, row.id, oi));
      }
    } else if (inputType === 'fill_blank') {
      if (answer === undefined) {
        return c.json({ error: 'ANSWER_REQUIRED' }, 400);
      }
      // ★ MC-in-disguise(위치라벨 answer)는 fill_blank 텍스트 채점 불가 — 양방향
      //   오채점 차단(4-Pass M-2). 현 1차 525(answer=위치라벨·distractors NULL)가 여기.
      if (parseMcAnswerLabels(row.answer) !== null) {
        logger.error(
          'grade fill_blank on position-label answer (MC-in-disguise, BE-1 대기)',
          undefined,
          {
            questionId: row.id,
          },
        );
        return c.json({ error: 'QUESTION_NOT_GRADABLE' }, 422);
      }
      isCorrect = gradeFillBlank({ expected: row.answer, userAnswer: answer }).isCorrect;
    } else {
      // essay/calc — 공개 표면 미지원(Formula Engine 미경유 문자열 폴백 오채점 금지, m-3).
      logger.error('grade unsupported input_type on public surface', undefined, {
        questionId: row.id,
        inputType,
      });
      return c.json({ error: 'QUESTION_NOT_GRADABLE' }, 422);
    }

    recordPublicEvent(c.env.PUBLIC_ANALYTICS, 'grade', {
      subject: row.subject,
      inputType,
      isCorrect,
      examType: FIXED_EXAM_TYPE,
    });

    // explanation 0/525(F-5) — 없으면 필드 생략(프론트 빈상태 처리). correctChoiceIds = MC 만.
    const body: Record<string, unknown> = { isCorrect, correctAnswer };
    if (row.explanation !== null && row.explanation !== '') {
      body.explanation = row.explanation;
    }
    if (correctChoiceIds !== undefined) {
      body.correctChoiceIds = correctChoiceIds;
    }
    return c.json(body);
  });

  return app;
}
