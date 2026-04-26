# ADR-016: Event Sourcing for FSRS Sync

작성일: 2026-04-26
상태: Accepted (Phase 2 적용)
관련: ADR-020 (Snapshotting)
검토서 §2 결함 E (P1, Phase 2)

## Context

기존 설계: LWW (Last-Write-Wins) — `user_progress (user_id, card_id, fsrs_state JSON, updated_at)` — 마지막 updated_at 이 이김.

비판 (검토서 §2-E): 멀티 디바이스 환경에서 학습 데이터 손실:

- 모바일에서 카드 A 학습 (오프라인)
- 태블릿에서 카드 A 학습 (온라인 즉시 sync)
- 모바일 온라인 → 모바일의 더 늦은 timestamp 가 태블릿 신규 데이터 덮어쓰기 → **태블릿 학습 사라짐**

ADVOCATE: 사용자가 학습한 이력이 사라지면 = **신뢰 즉사**. FSRS interval 계산 망가짐 → 같은 카드 반복 → 이탈.

## Decision

**Event Sourcing** for FSRS — append-only 이벤트 스트림 + 멱등 replay.

### 데이터 모델

```sql
CREATE TABLE user_review_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  event_type TEXT NOT NULL,         -- 'review' / 'reset' / 'lapse'
  rating TEXT NOT NULL,              -- 'again' / 'hard' / 'good' / 'easy'
  device_id TEXT NOT NULL,
  client_ts INTEGER NOT NULL,
  server_ts INTEGER NOT NULL,
  fsrs_state_before JSON NOT NULL,
  fsrs_state_after JSON NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_review_events_user_card
  ON user_review_events (user_id, card_id, client_ts);

CREATE TABLE user_card_state (
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  current_fsrs_state JSON NOT NULL,
  last_event_id TEXT NOT NULL,
  PRIMARY KEY (user_id, card_id)
);
```

### 동기화 로직

1. 모든 이벤트 append (UNIQUE id 보장 — idempotency)
2. 영향 받은 카드별 모든 이벤트를 client_ts 순서로 재생 → 최종 FSRS 상태
3. 캐시 (`user_card_state`) 갱신

```typescript
// 멀티 디바이스 충돌 → 두 학습 모두 보존, 순서대로 합리적 FSRS 진행
```

**Hard Rule 22**: FSRS 사용자 학습 데이터는 Event Sourcing 으로 관리. LWW 패턴 사용 금지.

### 보강 — Snapshotting (ADR-020)

1년 학습자 = 카드 50번 복습 = 50 이벤트 replay → 비용 폭발. ADR-020 의 Snapshotting Pattern 으로 해소.

## Consequences

### 긍정적

- 멀티 디바이스 학습 데이터 손실 0
- 학습자 신뢰 보존
- append-only 패턴이 진산님 메모리 (UPDATE 금지) 와 정합

### Trade-offs

- 스토리지 증가 (사용자당 ~50KB/월)
- Snapshotting 미적용 시 1년 사용자 동기화 5초+ → ADR-020 의무
- 마이그레이션 0016/0017 (Phase 2)

### 적용 시점

**Phase 2** (학습자 화면 본격 진입 시). Phase 1 가-1 단계는 명시 이월.
