# thepick-db-production D1 Migration Status

> **목적**: production D1 마이그레이션 적용 증거 영속 (handoff-074 §"수정된 파일" + Session 066 C-14).
> **근거**: Session 067 C-14 흡수 (handoff-075 §"다음 할 일" §2)
> **확인 명령**: `wrangler d1 migrations list thepick-db-production --remote --env=production`

---

## 적용 일자

- **Session 067 C-14 영속 시점**: 2026-05-12 KST
- **wrangler 토큰**: `claude-code-thepick` (User API Token, 2026-05-10 발급)
- **확인 출력**: `✅ No migrations to apply!`

---

## 적용된 마이그레이션 (0001 ~ 0029, 29개 chain)

| 번호 | 파일                                      | 상태 | 비고                                                       |
| ---- | ----------------------------------------- | ---- | ---------------------------------------------------------- |
| 0001 | initial_schema.sql                        | ✅   | 1차 base schema                                            |
| 0002 | 1st_exam_extension.sql                    | ✅   | user_progress 신규                                         |
| 0003 | temporal_guard_not_null.sql               | ✅   |                                                            |
| 0004 | temporal_guard_extension.sql              | ✅   |                                                            |
| 0005 | not_null_triggers_completion.sql          | ✅   |                                                            |
| 0006 | users_and_auth.sql                        | ✅   | auth 도입                                                  |
| 0007 | users_strict_hardening.sql                | ✅   | PBKDF2 trigger 도입 (ADR-005 600k → ADR-035 100k 갱신)     |
| 0008 | webhook_events.sql                        | ✅   |                                                            |
| 0009 | sessions.sql                              | ✅   |                                                            |
| 0010 | status_transitions_and_page_ref_guard.sql | ✅   |                                                            |
| 0011 | revision_2026_constants_seed.sql          | ✅   |                                                            |
| 0012 | rate_limits.sql                           | ✅   |                                                            |
| 0013 | active_view_and_review_decisions.sql      | ✅   |                                                            |
| 0014 | phase05_critical_hardening.sql            | ✅   |                                                            |
| 0015 | batch_runs.sql                            | ✅   |                                                            |
| 0016 | knowledge_nodes_batch_idempotency.sql     | ✅   |                                                            |
| 0017 | engine_telemetry.sql                      | ✅   |                                                            |
| 0018 | enforce_draft_only_insert.sql             | ✅   |                                                            |
| 0019 | knowledge_nodes_page_chapter_meta.sql     | ✅   |                                                            |
| 0020 | ~ 0027                                    | ✅   | Pattern-H + review_queue 누적 (8건)                        |
| 0028 | pbkdf2_iterations_workers_compat.sql      | ✅   | ★ ADR-035 — trigger 100k 갱신 (Session 065 적용)           |
| 0029 | user_progress_unique_constraint.sql       | ✅   | ★★ Session 067 신규 적용 (C-06 흡수) — 5 commands / 1.04ms |

---

## 0029 적용 detail (Session 067 본 회차)

### Pre-apply 안전 검증

production user_progress 사전 확인:

```sql
SELECT COUNT(*) AS total_rows FROM user_progress;
-- → 15 rows (진산 G9 학습 시도 잔여, 1차 525문 부분 시도)

-- exam 중복 검출
SELECT user_id, card_id, card_type, COUNT(*) AS cnt
FROM user_progress
WHERE card_id IS NOT NULL
GROUP BY user_id, card_id, card_type HAVING COUNT(*) > 1;
-- → 0 rows (중복 0건)

-- concept 중복 검출
SELECT user_id, node_id, card_type, COUNT(*) AS cnt
FROM user_progress
WHERE node_id IS NOT NULL AND card_id IS NULL
GROUP BY user_id, node_id, card_type HAVING COUNT(*) > 1;
-- → 0 rows (중복 0건)
```

★ 중복 0건 → dedup 안전망 0 rows affected. 진산 G9 학습 상태 손실 위험 0.

### Apply 결과

```
🌀 Executing on remote database thepick-db-production (a9b8d521-dc99-46f7-835c-1f226cebdbf8)
🚣 Executed 5 commands in 1.04ms
┌──────────────────────────────────────────┬────────┐
│ name                                     │ status │
├──────────────────────────────────────────┼────────┤
│ 0029_user_progress_unique_constraint.sql │ ✅     │
└──────────────────────────────────────────┴────────┘
```

5 commands = dedup DELETE 2건 (0 rows) + partial UNIQUE INDEX 2건 (`uniq_progress_user_card` + `uniq_progress_user_node_concept`) + 마이그레이션 추적 INSERT 1건.

### Post-apply 검증

```bash
wrangler d1 migrations list thepick-db-production --remote --env=production
# → ✅ No migrations to apply!
```

---

## staging (thepick-db-staging) — 별도 검증 carry-over

본 회차에서 production만 확인. staging은 별도 wrangler call 시점 영속 (Session 067 후속 또는 다음 deploy chain 시).

---

## 운영 규칙

- 매 production migration apply 직후 본 파일 갱신 + git commit
- `wrangler d1 migrations list` 출력 정합 유지
- 0030+ 신규 마이그레이션 시 본 표 entry 추가

---

**작성**: Session 067 (Claude Opus 4.7 1M context) — C-14 흡수
**일자**: 2026-05-12 KST
