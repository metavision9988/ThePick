/**
 * public/routes 통합 테스트 — 무인증 공개 학습 표면 `/api/public/*`.
 *
 * 실제 SQLite(node:sqlite) + migrations 위에서 검증 (study/__tests__ 패턴 정합).
 * 커버:
 *   - GET /questions/next  — MC 서빙(choiceId 발급·정답 비노출)·fill_blank·필터·빈 결과
 *   - POST /grade          — MC 정/오답·복수정답·fill_blank·불투명 choiceId 위조 거부
 *   - ★ 경계 회귀 2건       — 2차 id 채점 거부 / flagged 서빙·채점 제외 (지뢰 #4)
 *   - 서빙 projection 이 answer·explanation 을 절대 노출하지 않음
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1FromSqlite, type SqliteBackedD1 } from '../../__tests__/helpers/d1-from-sqlite.js';
import { createPublicRoutes, type PublicRouteBindings } from '../routes.js';
import { issueChoiceId } from '../choice-id.js';

const JWT_SECRET = 'public-test-jwt-secret-32bytes-plus-v1';

let ctx: SqliteBackedD1;

beforeEach(() => {
  ctx = createD1FromSqlite();
});

afterEach(() => {
  ctx.close();
});

function env(): PublicRouteBindings {
  return { DB: ctx.db, ENVIRONMENT: 'test', JWT_SECRET };
}

function seedQ(params: {
  id: string;
  examType?: '1st' | '2nd';
  status?: 'active' | 'flagged' | 'deprecated';
  inputType?: 'multiple_choice' | 'fill_blank' | 'essay' | 'calc';
  subject?: string | null;
  round?: number | null;
  answer?: string | null;
  explanation?: string | null;
  distractors?: readonly string[] | null;
  content?: string;
}): void {
  ctx.raw
    .prepare(
      `INSERT INTO exam_questions
         (id, year, round, question_number, subject, content, answer, explanation,
          status, exam_type, input_type, distractors)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.id,
      2023,
      params.round ?? null,
      1,
      params.subject ?? null,
      params.content ?? '문제 본문',
      params.answer === undefined ? '1' : params.answer,
      params.explanation ?? null,
      params.status ?? 'active',
      params.examType ?? '1st',
      params.inputType ?? 'fill_blank',
      params.distractors ? JSON.stringify(params.distractors) : null,
    );
}

const app = () => createPublicRoutes();

async function get(path: string): Promise<Response> {
  return app().fetch(new Request(`http://test.local${path}`), env());
}

async function post(path: string, body: unknown): Promise<Response> {
  return app().fetch(
    new Request(`http://test.local${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env(),
  );
}

const FOUR_CHOICES = ['보험가액', '보험금액', '손해액', '자기부담금'] as const;

describe('GET /api/public/questions/next — 서빙', () => {
  it('MC 서빙: choiceId {choiceId,text} 4개 + answer/explanation 비노출 + examType=1st', async () => {
    seedQ({
      id: 'q-mc-1',
      inputType: 'multiple_choice',
      answer: '2', // 원본 위치 2 = index 1 = '보험금액'
      explanation: '해설 텍스트',
      distractors: FOUR_CHOICES,
      subject: '농작물재해보험',
    });

    const res = await get('/questions/next?inputType=multiple_choice');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.id).toBe('q-mc-1');
    expect(body.examType).toBe('1st');
    expect(body.inputType).toBe('multiple_choice');
    // 정답·해설 절대 비노출.
    expect(body).not.toHaveProperty('answer');
    expect(body).not.toHaveProperty('explanation');

    const choices = body.choices as ReadonlyArray<{ choiceId: string; text: string }>;
    expect(choices).toHaveLength(4);
    // 텍스트는 원본 4개 집합과 일치(표시 순서는 셔플).
    expect(new Set(choices.map((c) => c.text))).toEqual(new Set(FOUR_CHOICES));
    // choiceId 는 불투명 24-hex, 서로 다름.
    for (const c of choices) expect(c.choiceId).toMatch(/^[0-9a-f]{24}$/);
    expect(new Set(choices.map((c) => c.choiceId)).size).toBe(4);
  });

  it('fill_blank 서빙: choices=null, inputType=fill_blank', async () => {
    seedQ({ id: 'q-fb-1', inputType: 'fill_blank', answer: '보험가액', subject: '재배학' });
    const res = await get('/questions/next?inputType=fill_blank');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.inputType).toBe('fill_blank');
    expect(body.choices).toBeNull();
    expect(body).not.toHaveProperty('answer');
  });

  it('subject 필터: 일치 문항 없으면 404 NO_QUESTION', async () => {
    seedQ({ id: 'q-x', subject: '재배학' });
    const res = await get('/questions/next?subject=존재하지않는과목');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('NO_QUESTION');
  });

  it('★회귀: flagged 문항은 서빙 제외 (status=active 강제)', async () => {
    seedQ({
      id: 'q-flagged',
      status: 'flagged',
      inputType: 'multiple_choice',
      answer: '1',
      distractors: FOUR_CHOICES,
      subject: '플래그전용과목',
    });
    const res = await get('/questions/next?subject=플래그전용과목');
    expect(res.status).toBe(404);
  });

  it('★회귀: 2차 문항은 서빙 제외 (exam_type=1st 서버 고정)', async () => {
    seedQ({ id: 'q-2nd', examType: '2nd', subject: '2차전용과목' });
    const res = await get('/questions/next?subject=2차전용과목');
    expect(res.status).toBe(404);
  });

  it('★M-2: fill_blank 인데 answer 가 위치라벨(MC-in-disguise, BE-1 대기) → 서빙 제외', async () => {
    // 현 1차 525 상태 재현: input_type=fill_blank + answer=위치라벨("2") + distractors NULL.
    seedQ({ id: 'q-disguise', inputType: 'fill_blank', answer: '2', subject: '위장과목' });
    const res = await get('/questions/next?subject=위장과목');
    expect(res.status).toBe(404); // 정확히 채점 불가 → 서빙 안 함(오채점 fail-safe)
  });

  it('★M-2: 결함 MC 행이 뽑혀도 유효 문항 잔존 시 서빙 (후보 N개 자격 판정)', async () => {
    // 같은 과목에 결함 MC(distractors NULL) + 유효 MC 공존 → 유효행 서빙(간헐 404 방지).
    seedQ({
      id: 'q-broken-mc',
      inputType: 'multiple_choice',
      answer: '1',
      distractors: null,
      subject: '혼합과목',
    });
    seedQ({
      id: 'q-good-mc',
      inputType: 'multiple_choice',
      answer: '2',
      distractors: FOUR_CHOICES,
      subject: '혼합과목',
    });
    // 여러 번 요청해도 항상 유효행만 서빙(결함행은 isServable 탈락).
    for (let i = 0; i < 5; i++) {
      const res = await get('/questions/next?inputType=multiple_choice&subject=혼합과목');
      expect(res.status).toBe(200);
      expect(((await res.json()) as { id: string }).id).toBe('q-good-mc');
    }
  });
});

describe('POST /api/public/grade — 채점', () => {
  it('MC 정답: 정답 위치 choiceId 제출 → isCorrect true + correctChoiceIds', async () => {
    seedQ({
      id: 'q-g1',
      inputType: 'multiple_choice',
      answer: '2', // index 1 정답
      explanation: '해설',
      distractors: FOUR_CHOICES,
    });
    const correctChoiceId = await issueChoiceId(JWT_SECRET, 'q-g1', 1);
    const res = await post('/grade', { questionId: 'q-g1', choiceId: correctChoiceId });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.isCorrect).toBe(true);
    expect(body.correctAnswer).toBe('2');
    expect(body.explanation).toBe('해설');
    expect(body.correctChoiceIds).toEqual([correctChoiceId]);
  });

  it('MC 오답: 오답 위치 choiceId → isCorrect false + 정답 choiceId 노출', async () => {
    seedQ({ id: 'q-g2', inputType: 'multiple_choice', answer: '2', distractors: FOUR_CHOICES });
    const wrongChoiceId = await issueChoiceId(JWT_SECRET, 'q-g2', 0); // index 0 = 오답
    const res = await post('/grade', { questionId: 'q-g2', choiceId: wrongChoiceId });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.isCorrect).toBe(false);
    expect(body.correctChoiceIds).toEqual([await issueChoiceId(JWT_SECRET, 'q-g2', 1)]);
    // 해설 없음 → 필드 생략.
    expect(body).not.toHaveProperty('explanation');
  });

  it('MC 복수정답("2,3"): 어느 정답 보기든 정답 처리', async () => {
    seedQ({
      id: 'q-multi',
      inputType: 'multiple_choice',
      answer: '2,3',
      distractors: FOUR_CHOICES,
    });
    const cid2 = await issueChoiceId(JWT_SECRET, 'q-multi', 1);
    const cid3 = await issueChoiceId(JWT_SECRET, 'q-multi', 2);
    for (const cid of [cid2, cid3]) {
      const res = await post('/grade', { questionId: 'q-multi', choiceId: cid });
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.isCorrect).toBe(true);
      expect(new Set(body.correctChoiceIds as string[])).toEqual(new Set([cid2, cid3]));
    }
  });

  it('MC 위조/손상 choiceId → isCorrect false (매칭 실패)', async () => {
    seedQ({ id: 'q-forge', inputType: 'multiple_choice', answer: '2', distractors: FOUR_CHOICES });
    const res = await post('/grade', {
      questionId: 'q-forge',
      choiceId: 'deadbeefdeadbeefdeadbeef',
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { isCorrect: boolean }).isCorrect).toBe(false);
  });

  it('MC 인데 choiceId 누락 → 400 CHOICE_ID_REQUIRED', async () => {
    seedQ({ id: 'q-noc', inputType: 'multiple_choice', answer: '2', distractors: FOUR_CHOICES });
    const res = await post('/grade', { questionId: 'q-noc', answer: '보험금액' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('CHOICE_ID_REQUIRED');
  });

  it('fill_blank 정답: normalize 매칭 (②/2/2번 동치)', async () => {
    seedQ({ id: 'q-fb', inputType: 'fill_blank', answer: '보험가액' });
    const ok = await post('/grade', { questionId: 'q-fb', answer: ' 보험가액 ' });
    expect(((await ok.json()) as { isCorrect: boolean }).isCorrect).toBe(true);
    const no = await post('/grade', { questionId: 'q-fb', answer: '손해액' });
    expect(((await no.json()) as { isCorrect: boolean }).isCorrect).toBe(false);
  });

  it('fill_blank 인데 answer 누락 → 400 ANSWER_REQUIRED', async () => {
    seedQ({ id: 'q-fbn', inputType: 'fill_blank', answer: '보험가액' });
    const res = await post('/grade', { questionId: 'q-fbn', choiceId: 'x'.repeat(24) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('ANSWER_REQUIRED');
  });

  it('미존재 문항 → 404 QUESTION_NOT_FOUND', async () => {
    const res = await post('/grade', { questionId: 'nope', answer: 'x' });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('QUESTION_NOT_FOUND');
  });

  it('★회귀: 2차 문항 id 채점 거부 → 404 (exam_type=1st AND status=active)', async () => {
    seedQ({ id: 'q-2nd-grade', examType: '2nd', inputType: 'fill_blank', answer: '2차정답' });
    const res = await post('/grade', { questionId: 'q-2nd-grade', answer: '2차정답' });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('QUESTION_NOT_FOUND');
  });

  it('★회귀: flagged 문항 채점 거부 → 404 (status=active 강제)', async () => {
    seedQ({ id: 'q-flag-grade', status: 'flagged', inputType: 'fill_blank', answer: '정답' });
    const res = await post('/grade', { questionId: 'q-flag-grade', answer: '정답' });
    expect(res.status).toBe(404);
  });

  it('answer 없는 문항 채점 → 422 QUESTION_HAS_NO_ANSWER', async () => {
    seedQ({ id: 'q-noans', inputType: 'fill_blank', answer: null });
    const res = await post('/grade', { questionId: 'q-noans', answer: 'x' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe('QUESTION_HAS_NO_ANSWER');
  });

  it('Zod 검증 실패(questionId 누락) → 400 VALIDATION_ERROR', async () => {
    const res = await post('/grade', { answer: 'x' });
    expect(res.status).toBe(400);
  });

  it('★M-2: fill_blank 인데 answer 위치라벨(MC-in-disguise) 채점 → 422 QUESTION_NOT_GRADABLE', async () => {
    seedQ({ id: 'q-disguise-g', inputType: 'fill_blank', answer: '2' });
    const res = await post('/grade', { questionId: 'q-disguise-g', answer: '2' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe('QUESTION_NOT_GRADABLE');
  });

  it('★m-3: essay/calc 는 공개 표면 채점 미지원 → 422 QUESTION_NOT_GRADABLE (문자열 폴백 금지)', async () => {
    seedQ({ id: 'q-essay', inputType: 'essay', answer: '서술형 정답' });
    const res = await post('/grade', { questionId: 'q-essay', answer: '서술형 정답' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe('QUESTION_NOT_GRADABLE');
  });
});
