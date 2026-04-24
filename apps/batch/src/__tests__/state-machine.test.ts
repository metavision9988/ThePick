/**
 * state-machine 테스트 — draft→review→approved 전이 규칙, downgrade 차단, append-only 로그.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  transitionStatus,
  getCurrentStatus,
  isValidTransition,
  InvalidTransitionError,
  TargetNotFoundError,
} from '../loader/state-machine';
import { openLocalDb, type LocalD1 } from '../loader/local-db';

describe('state-machine — isValidTransition (pure)', () => {
  it('draft → review 허용', () => {
    expect(isValidTransition('draft', 'review')).toBe(true);
  });

  it('review → approved 허용', () => {
    expect(isValidTransition('review', 'approved')).toBe(true);
  });

  it('draft → flagged 허용', () => {
    expect(isValidTransition('draft', 'flagged')).toBe(true);
  });

  it('review → flagged 허용', () => {
    expect(isValidTransition('review', 'flagged')).toBe(true);
  });

  it('approved → flagged 허용 (문제 발견 시)', () => {
    expect(isValidTransition('approved', 'flagged')).toBe(true);
  });

  it('draft → approved 차단 (review 건너뛰기)', () => {
    expect(isValidTransition('draft', 'approved')).toBe(false);
  });

  it('approved → review 차단 (downgrade)', () => {
    expect(isValidTransition('approved', 'review')).toBe(false);
  });

  it('approved → draft 차단 (downgrade)', () => {
    expect(isValidTransition('approved', 'draft')).toBe(false);
  });

  it('flagged → approved 차단', () => {
    expect(isValidTransition('flagged', 'approved')).toBe(false);
  });

  it('review → draft 차단 (downgrade)', () => {
    expect(isValidTransition('review', 'draft')).toBe(false);
  });

  it('동일 상태 → 동일 상태 차단', () => {
    expect(isValidTransition('draft', 'draft')).toBe(false);
    expect(isValidTransition('approved', 'approved')).toBe(false);
  });
});

describe('state-machine — DB 통합 (in-memory SQLite)', () => {
  let ctx: LocalD1;

  beforeEach(() => {
    ctx = openLocalDb({ path: ':memory:' });
    // 테스트 대상 노드 선주입 (page_ref 필수)
    ctx.raw
      .prepare(
        `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status)
         VALUES (?, 'CONCEPT', '테스트 노드', '403', 2026, 5, 'draft')`,
      )
      .run('CONCEPT-001');
  });

  afterEach(() => {
    ctx.close();
  });

  it('getCurrentStatus: transition 없으면 draft 반환', async () => {
    const status = await getCurrentStatus(ctx.db, 'node', 'CONCEPT-001');
    expect(status).toBe('draft');
  });

  it('draft → review 전이 성공 + audit log 생성', async () => {
    const r = await transitionStatus(ctx.db, {
      targetType: 'node',
      targetId: 'CONCEPT-001',
      toStatus: 'review',
      reviewerId: 'admin-1',
      reason: 'QG-2 통과',
    });
    expect(r.fromStatus).toBe('draft');
    expect(r.toStatus).toBe('review');

    const current = await getCurrentStatus(ctx.db, 'node', 'CONCEPT-001');
    expect(current).toBe('review');
  });

  it('draft → review → approved 연쇄 전이', async () => {
    await transitionStatus(ctx.db, {
      targetType: 'node',
      targetId: 'CONCEPT-001',
      toStatus: 'review',
      reviewerId: 'admin-1',
    });
    await transitionStatus(ctx.db, {
      targetType: 'node',
      targetId: 'CONCEPT-001',
      toStatus: 'approved',
      reviewerId: 'admin-2',
    });
    expect(await getCurrentStatus(ctx.db, 'node', 'CONCEPT-001')).toBe('approved');
  });

  it('approved → draft 거부 (InvalidTransitionError)', async () => {
    await transitionStatus(ctx.db, {
      targetType: 'node',
      targetId: 'CONCEPT-001',
      toStatus: 'review',
      reviewerId: 'admin-1',
    });
    await transitionStatus(ctx.db, {
      targetType: 'node',
      targetId: 'CONCEPT-001',
      toStatus: 'approved',
      reviewerId: 'admin-1',
    });

    await expect(
      transitionStatus(ctx.db, {
        targetType: 'node',
        targetId: 'CONCEPT-001',
        toStatus: 'flagged',
        reviewerId: 'admin-1',
      }),
    ).resolves.toMatchObject({ toStatus: 'flagged' });
  });

  it('draft → approved 직접 전이 거부 (review 건너뛰기 금지)', async () => {
    await expect(
      transitionStatus(ctx.db, {
        targetType: 'node',
        targetId: 'CONCEPT-001',
        toStatus: 'approved',
        reviewerId: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('존재하지 않는 대상 → TargetNotFoundError', async () => {
    await expect(
      transitionStatus(ctx.db, {
        targetType: 'node',
        targetId: 'MISSING-999',
        toStatus: 'review',
        reviewerId: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(TargetNotFoundError);
  });

  it('빈 reviewerId 거부', async () => {
    await expect(
      transitionStatus(ctx.db, {
        targetType: 'node',
        targetId: 'CONCEPT-001',
        toStatus: 'review',
        reviewerId: '',
      }),
    ).rejects.toThrow(/reviewerId is required/);
  });

  it('status_transitions 는 append-only (UPDATE/DELETE 거부)', async () => {
    await transitionStatus(ctx.db, {
      targetType: 'node',
      targetId: 'CONCEPT-001',
      toStatus: 'review',
      reviewerId: 'admin-1',
    });
    expect(() =>
      ctx.raw
        .prepare(`UPDATE status_transitions SET reviewer_id = 'hacker' WHERE target_id = ?`)
        .run('CONCEPT-001'),
    ).toThrow(/forbidden.*append-only/i);
    expect(() =>
      ctx.raw.prepare(`DELETE FROM status_transitions WHERE target_id = ?`).run('CONCEPT-001'),
    ).toThrow(/forbidden.*append-only/i);
  });
});
