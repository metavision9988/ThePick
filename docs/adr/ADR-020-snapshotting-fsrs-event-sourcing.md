# ADR-020: Snapshotting Pattern for FSRS Event Sourcing

작성일: 2026-04-26
상태: Accepted (Phase 2 적용)
관련: ADR-016 (Event Sourcing FSRS)
검토서 v2.1 §2 MR-3 (P0 Critical, Phase 2)

## Context

ADR-016 의 Event Sourcing 은 멱등성 측면 옳지만, **계산 비용 폭발**:

- 1년 학습자가 한 카드 50번 복습 → 동기화마다 50개 이벤트 replay
- 6개월/1년 사용자 누적 → 동기화 응답 시간 5초+ → 학습자 이탈

## Decision

**Snapshotting Pattern** (체크포인트 + 증분 replay):

### 데이터 모델

```sql
-- ADR-016 의 user_card_state 를 단순 캐시 → 체크포인트로 격상
CREATE TABLE user_card_state (
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  current_fsrs_state JSON NOT NULL,
  last_event_id TEXT NOT NULL,
  last_event_client_ts INTEGER NOT NULL,  -- ★ 신규
  snapshot_count INTEGER DEFAULT 0,        -- ★ N번째 스냅샷
  snapshot_hash TEXT NOT NULL,             -- ★ 검증용
  PRIMARY KEY (user_id, card_id)
);
```

### 동기화 로직

```typescript
const SNAPSHOT_EVERY_N_EVENTS = 10;

// 1. 마지막 스냅샷 로드
const checkpoint = await db.select().from(userCardState).where(...).get();

// 2. 증분 replay (체크포인트 이후 이벤트만)
const incrementalEvents = await db.select().from(userReviewEvents).where(
  and(
    eq(userReviewEvents.userId, userId),
    eq(userReviewEvents.cardId, cardId),
    checkpoint ? gt(userReviewEvents.clientTs, checkpoint.lastEventClientTs) : sql`1=1`
  )
).orderBy(asc(userReviewEvents.clientTs));

// 3. 마지막 스냅샷 + 증분 = 최종 상태
const startState = checkpoint?.currentFsrsState ?? initialFsrsState;
const finalState = replayFsrsEvents(startState, incrementalEvents);

// 4. N번째 이벤트마다 스냅샷 갱신
if ((checkpoint?.snapshotCount ?? 0 + incrementalEvents.length) % 10 === 0) {
  await db.insert(userCardState).values({...}).onConflictDoUpdate({...});
}
```

### 무결성 검증 (월 1회 cron)

```typescript
// 전체 replay vs 스냅샷 hash 비교 → 불일치 시 알림 + 자동 정정
```

**Hard Rule 27**: FSRS Event Sourcing 은 Snapshotting Pattern 의무. 매 N건 (기본 10) 체크포인트 + 증분 replay. 월 1회 full-replay 무결성 검증 cron.

## Consequences

### 긍정적

- 1년 학습자 동기화 1초 이내 보장
- 정기 무결성 검증으로 손상 자동 검출
- ADR-016 의 신뢰성 보존 + 성능 보장

### Trade-offs

- 스토리지 +5KB/카드 (스냅샷)
- 무결성 검증 cron 운영 부담 (월 1회)

### 적용 시점

**Phase 2** (학습자 화면 본격 진입 + ADR-016 적용 시).

### 테스트 기준

| ID      | 통과 기준                                             |
| :------ | :---------------------------------------------------- |
| ESF-T06 | 스냅샷 + 증분 replay = 전체 replay (50카드 100% 일치) |
| ESF-T07 | 1년 사용자 동기화 1초 이내                            |
| ESF-T08 | 정확히 10번째 이벤트마다 스냅샷 갱신                  |
| ESF-T09 | 의도적 스냅샷 손상 → 자동 검출 + 정정                 |
