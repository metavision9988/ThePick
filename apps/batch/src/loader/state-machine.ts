/**
 * Status State Machine — knowledge_nodes / formulas / constants 의 상태 전이.
 *
 * 기반: migrations/0010 의 status_transitions 테이블 (append-only 감사 로그).
 * knowledge_nodes/formulas/constants 는 UPDATE 전면 차단되므로, 상태 전이는
 * 이 테이블에 새 레코드 INSERT 하는 것으로 표현된다. 현재 상태 = 최신 레코드의 to_status.
 *
 * 일방향 전이 규칙 (migrations/0010 trigger 와 동일):
 *   draft → review
 *   review → approved
 *   draft | review | approved → flagged (문제 발견 시)
 *   downgrade 금지 (approved → review, review → draft 등)
 *
 * 앱 레벨 검증을 먼저 수행 — 명확한 에러 메시지 제공 + DB 트리거는 2차 방어선.
 */

import { randomUUID } from 'node:crypto';
import type { TransitionTargetType, TransitionStatus } from '@thepick/shared';

export type { TransitionTargetType, TransitionStatus };

export interface TransitionInput {
  readonly targetType: TransitionTargetType;
  readonly targetId: string;
  readonly toStatus: Exclude<TransitionStatus, 'draft'>;
  readonly reviewerId: string;
  readonly reason?: string;
}

export interface TransitionResult {
  readonly transitionId: string;
  readonly targetType: TransitionTargetType;
  readonly targetId: string;
  readonly fromStatus: TransitionStatus;
  readonly toStatus: TransitionStatus;
  readonly reviewerId: string;
  readonly transitionedAt: string;
}

export class InvalidTransitionError extends Error {
  readonly fromStatus: TransitionStatus;
  readonly toStatus: TransitionStatus;
  constructor(fromStatus: TransitionStatus, toStatus: TransitionStatus) {
    super(
      `Illegal status transition: ${fromStatus} → ${toStatus}. ` +
        `Allowed: draft→review→approved, any→flagged (one-way).`,
    );
    this.name = 'InvalidTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

export class TargetNotFoundError extends Error {
  readonly targetType: TransitionTargetType;
  readonly targetId: string;
  constructor(targetType: TransitionTargetType, targetId: string) {
    super(`${targetType} with id "${targetId}" does not exist in DB.`);
    this.name = 'TargetNotFoundError';
    this.targetType = targetType;
    this.targetId = targetId;
  }
}

import type { D1Db } from './draft-loader';
export type { D1Db };

const TARGET_TABLE: Record<TransitionTargetType, string> = {
  node: 'knowledge_nodes',
  formula: 'formulas',
  constant: 'constants',
};

/**
 * 단일 대상에 대한 상태 전이.
 * 검증 순서: (1) 대상 존재 (2) 현재 상태 조회 (3) 전이 규칙 (4) INSERT.
 */
export async function transitionStatus(
  db: D1Db,
  input: TransitionInput,
  options: { now?: () => Date; idGenerator?: () => string } = {},
): Promise<TransitionResult> {
  if (!input.reviewerId || input.reviewerId.trim() === '') {
    throw new Error('reviewerId is required');
  }

  const table = TARGET_TABLE[input.targetType];
  const exists = await targetExists(db, table, input.targetId);
  if (!exists) {
    throw new TargetNotFoundError(input.targetType, input.targetId);
  }

  const fromStatus = await getCurrentStatus(db, input.targetType, input.targetId);

  if (!isValidTransition(fromStatus, input.toStatus)) {
    throw new InvalidTransitionError(fromStatus, input.toStatus);
  }

  const transitionId = (options.idGenerator ?? randomUUID)();
  const transitionedAt = (options.now ?? (() => new Date()))().toISOString();

  await db
    .prepare(
      `INSERT INTO status_transitions
         (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      transitionId,
      input.targetType,
      input.targetId,
      fromStatus,
      input.toStatus,
      input.reviewerId,
      input.reason ?? null,
      transitionedAt,
    )
    .run();

  return {
    transitionId,
    targetType: input.targetType,
    targetId: input.targetId,
    fromStatus,
    toStatus: input.toStatus,
    reviewerId: input.reviewerId,
    transitionedAt,
  };
}

/**
 * 특정 대상의 현재 상태 조회.
 * status_transitions 최신 레코드 → to_status. 없으면 'draft' (INSERT 초기 상태).
 */
export async function getCurrentStatus(
  db: D1Db,
  targetType: TransitionTargetType,
  targetId: string,
): Promise<TransitionStatus> {
  const row = await db
    .prepare(
      `SELECT to_status FROM status_transitions
       WHERE target_type = ? AND target_id = ?
       ORDER BY transitioned_at DESC LIMIT 1`,
    )
    .bind(targetType, targetId)
    .first<{ to_status: TransitionStatus }>();

  return row?.to_status ?? 'draft';
}

/**
 * 전이 규칙 검증. 허용 경로만 true.
 */
export function isValidTransition(from: TransitionStatus, to: TransitionStatus): boolean {
  if (from === to) return false;
  if (to === 'flagged') return from !== 'flagged';
  if (from === 'draft' && to === 'review') return true;
  if (from === 'review' && to === 'approved') return true;
  return false;
}

async function targetExists(db: D1Db, table: string, id: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS found FROM ${table} WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<{ found: number }>();
  return row?.found === 1;
}
