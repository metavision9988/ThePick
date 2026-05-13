# ADR-042: Deploy Ordering — Worker rollback + D1 migration mismatch 정책

- **상태:** Accepted (Phase 3 launch toggle 차단 의무 해소)
- **결정일:** 2026-05-13 (Session 073 Step 3-UX-6e 5-페르소나 devops CRIT-DO-2 흡수)
- **결정자:** Claude Opus 4.7 (devops-architect 진단) + 진산 (우선순위 위임)
- **관련 영역:** wrangler deploy:production / db:migrate:production 절차, Worker rollback, D1 migration 적용 순서, breaking vs backward-compatible schema change

---

## 맥락 (Context)

5-페르소나 devops CRIT-DO-2 진단:

- Cloudflare Workers는 `wrangler rollback --env production` version pinning 지원.
- 그러나 D1 migration이 적용된 상태에서 Worker rollback 시 schema mismatch 위험:
  - **scenario A (column ADD)**: 0036 인덱스 추가 → Worker rollback 시 새 코드가 인덱스 활용 안 함 → 성능 회귀만, 기능 OK.
  - **scenario B (column ALTER/DROP)**: 신규 컬럼 ADD 후 Worker가 그 컬럼 활용 → rollback 시 구 Worker가 NULL/missing 컬럼 참조 → runtime 에러.
- 현재 runbook (`docs/runbooks/production-deployment.md`)은 `wrangler rollback` 명령만 권고. **schema mismatch 정책 부재.**

**위협:**

- breaking schema change (column ADD + 코드가 즉시 활용) 적용 후 Worker rollback 시 single-shot rollback 불가.
- production 회귀 발생 시 incident response 절차 모호.
- "DB migration ahead of Worker code" vs "Worker code ahead of DB migration" 정책 ADR 0건.

**근본 원인** — Phase 3 진입 시 D1 schema 변경 빈도 증가 (Session 072: 0036/0037 2건). Year 2 멀티시험 확장 시 schema 변경 폭증 예상. 정책 lock 필요.

---

## 결정 (Decision)

### 1. Schema 변경 분류 — Backward-compatible vs Breaking

**Backward-compatible (BC)** — 기존 Worker 코드가 변경 후에도 정상 동작:

- 인덱스 ADD (0036 study_reviews_session_user, 0037 exam_questions_active_subject)
- 인덱스 DROP (활용 안 되던 인덱스)
- 컬럼 ADD with DEFAULT (기존 SELECT 동작, INSERT는 default fill)
- 새 테이블 ADD
- 새 VIEW ADD
- 새 TRIGGER ADD (단, 기존 INSERT/UPDATE 동작 변경 없음)
- CHECK constraint ADD (단, 기존 데이터가 모두 정합)

**Breaking (BR)** — 기존 Worker 코드가 변경 후 fail:

- 컬럼 DROP
- 컬럼 RENAME
- 컬럼 TYPE CHANGE (예: TEXT → INTEGER)
- NOT NULL constraint ADD (기존 NULL row 존재 시)
- 테이블 DROP
- TRIGGER가 기존 동작 변경
- CHECK constraint ADD (기존 데이터 위반 시)
- FK ADD (기존 댕글링 row 존재 시)

### 2. Deploy 순서 강제

#### BC migration

```
[1] pnpm db:migrate:production   (migration 적용)
[2] (옵션) wrangler tail로 production 검증
[3] pnpm deploy:production       (Worker deploy)
[4] curl smoke + telemetry 30분 모니터
```

**rollback**: `wrangler rollback --env production` 단독 OK. Migration은 그대로 유지 (인덱스/컬럼은 backward-compat).

#### BR migration — 2-step deploy 의무

**1단계: Expand (BC 화)**

```
[1] migration N — 신규 컬럼 / 테이블 ADD (BC)
[2] pnpm db:migrate:production
[3] Worker code 갱신 — dual write (구 + 신 컬럼 둘 다 INSERT/UPDATE)
[4] pnpm deploy:production
[5] backfill (필요 시) — 구 컬럼 → 신 컬럼 데이터 copy
[6] 운영 검증 N일 (default 7일)
```

**2단계: Contract (BR 화)**

```
[1] Worker code 갱신 — 신 컬럼만 사용
[2] pnpm deploy:production
[3] migration N+1 — 구 컬럼 DROP (BC, 컬럼 미사용 상태)
[4] pnpm db:migrate:production
```

**rollback**:

- 1단계 rollback (Worker code 회귀): `wrangler rollback` — migration N은 유지 OK.
- 2단계 rollback: 어려움. 구 컬럼 DROP 후에는 데이터 손실 가능. `wrangler d1 time-travel restore` 권고.

### 3. Migration tracker 신뢰 의무

- `wrangler d1 migrations apply` 명령이 항상 우선. tracker 등록 보장.
- Direct `wrangler d1 execute --remote --file=...` 우회는 emergency only (Session 072-1 회고). 우회 시 후속 `wrangler d1 migrations apply` 명령으로 tracker 등록 의무.
- `wrangler d1 migrations list --remote`로 적용 상태 검증.

### 4. Pre-deploy 점검 의무 (runbook 갱신)

`docs/runbooks/production-deployment.md` §0.2에 다음 추가:

- [ ] 본 deploy의 schema 변경이 BC인지 BR인지 분류 (PR 본문 명시 의무)
- [ ] BR이면 2-step deploy 계획 + carry-over 마이그레이션 ID 영속
- [ ] `wrangler whoami` token scope 4종 확인 (Workers Scripts:Edit + D1:Edit + Pages:Edit + Account:Read)
- [ ] `wrangler d1 migrations list --remote`로 마이그레이션 drift 0 확인
- [ ] migration rollback SQL 작성 영속 (migration-rollback/{N}\_rollback.sql)

### 5. Rollback 절차 lock

#### Scenario A: Worker code 회귀만 (schema 변경 없음)

```
wrangler rollback --env production
```

이전 version으로 즉시 복귀. 데이터 손실 0.

#### Scenario B: BC migration + Worker code (둘 다 회귀)

```
wrangler rollback --env production
```

Worker code만 rollback. BC migration은 유지 (backward-compat 정합). 인덱스 추가/컬럼 ADD with DEFAULT은 구 Worker가 무시 OK.

#### Scenario C: BR migration 2단계 진입 (Contract 후) 회귀

- Worker code rollback은 가능하나 schema가 이미 contracted 상태.
- 옵션 1: `wrangler d1 time-travel restore` (최대 30일 전 bookmark) + Worker rollback.
- 옵션 2: 즉시 hotfix migration N+2로 데이터 재생성 + Worker forward-fix.

본 scenario는 **사전 차단 의무**. BR migration 2단계 종료 후 7일 모니터링 의무.

---

## 채택 근거

1. **Cloudflare Workers는 version pinning 즉시 rollback 지원** — 단순 Worker 회귀는 1 명령으로 가능. schema mismatch만 별도 처리.
2. **2-step deploy 패턴은 RDBMS migration 정합 표준** (Expand-Contract pattern, Robert Daigneau / Sam Newman).
3. **Cloudflare D1 Time Travel 30일 retention 활성** — Scenario C도 마지막 안전망 존재.
4. **본 ADR은 정책 영속만**, schema 변경 0. Phase 3 launch toggle 차단 의무 (~2h 작업) 해소.

---

## 영향 (Consequences)

### 1. 본 ADR 영속 항목

- ☑ ADR-042 신규 영속 (본 문서)
- ☑ runbook `production-deployment.md` §0.2 pre-deploy 점검 4항목 추가 carry-over (별도 PR)
- ☑ Migration 분류 (BC / BR) PR template 정합 의무

### 2. carry-over

- ☐ `docs/runbooks/production-deployment.md` §0.2 점검 항목 추가 (별도 PR — runbook 갱신 의무)
- ☐ Migration PR template `.github/PULL_REQUEST_TEMPLATE/migration.md` 신규 (선택, Phase 3 launch 후 30일)
- ☐ Migration rollback SQL 작성 자동화 (현재 manual, migrations/migration-rollback/{N}\_rollback.sql)
- ☐ D1 Time Travel rollback runbook `d1-disaster-recovery.md` 신규 (devops MAJOR-DO-5 carry-over)

### 3. Year 2 멀티시험 전환 시 정합

ADR-007 정합 Year 2 Phase 4에서 `exam_id` 컬럼 5 테이블 추가는 **2-step deploy 의무** 적용:

1. Expand: `exam_id TEXT DEFAULT 'son-hae-pyeong-ga-sa'` 컬럼 ADD (BC, default 채움) + Worker dual-write (examId 인자 활용)
2. (운영 7일 모니터)
3. Contract: Worker code가 신 컬럼만 사용 + (선택) DEFAULT DROP

Hard Rule 16 시그니처 정합 본 ADR 정합으로 zero-cost 전환.

---

## 관련 문서

- `docs/runbooks/production-deployment.md` (본 ADR 정합 의무)
- `docs/runbooks/migration-rollback.md` + `migrations/migration-rollback/` (rollback SQL source)
- ADR-007 (멀티시험 Year 2 이월)
- ADR-018 (D1 preview database CBIV)
- ADR-029 (formula engine resource limit)
- 5-페르소나 통합 보고서: `.claude/reviews/phase3-tech-debt-20260513-163000.md` §"CRITICAL Phase 3 launch 직전 의무 흡수" #6

---

## 결정 책임

본 ADR은 다음만 lock:

- ✅ Schema 변경 BC/BR 분류 정책 영속
- ✅ BR migration 2-step deploy (Expand-Contract) 의무
- ✅ Rollback scenario A/B/C 절차 lock
- ✅ Pre-deploy 점검 4항목 정의

다음은 lock 안 함:

- ❌ runbook 본문 갱신 (별도 PR)
- ❌ Migration PR template (선택)
- ❌ D1 Time Travel rollback 절차 (별도 runbook carry-over)
