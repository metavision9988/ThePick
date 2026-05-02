# Production Deployment Runbook

**작성일**: 2026-05-02 (Session 034 — Phase 1 5-페르소나 B-C2 흡수)
**근거**:

- ENGINE_HARDENING_COMPLETION_REPORT v1.2 §10.7 #1 ("production 환경 마이그레이션 미적용 — local·dev 만 PASS")
- `.claude/reviews/phase1-tech-debt-20260502-backend.md` B-C2
- `.claude/reviews/phase1-tech-debt-20260502-devops.md` MAJOR-DO-S1-4

**용도**: BATCH-1 진입 직전 후속 PR 단계 — production 환경 첫 배포 절차. local/dev → staging dry-run → production 의 안전 시퀀스.

---

## 0. 사전 점검 (배포 전 필수)

### 0.1 환경 정의 (`apps/api/wrangler.toml`)

| 환경          | D1 binding (`database_id`)             | Pages 도메인               | 상태          |
| :------------ | :------------------------------------- | :------------------------- | :------------ |
| `development` | local SQLite                           | (PWA dev)                  | ✅ 가동       |
| `staging`     | `edacc775-b11c-4200-8a76-284c65fa0542` | `thepick-admin.pages.dev`  | ⚠️ 첫 배포 전 |
| `production`  | `a9b8d521-dc99-46f7-835c-1f226cebdbf8` | `thepick.app` (DNS 미등록) | ❌ 첫 배포 전 |

### 0.2 진산님 통제 영역 확인 (Claude 비개입 — `feedback_focus_reliability_not_schedule`)

- [ ] Cloudflare 콘솔 production D1 데이터베이스 활성화
- [ ] `ADMIN_API_TOKEN` 환경변수 (wrangler secret) 등록
- [ ] `PUBLIC_API_BASE_URL` Pages 환경변수 등록
- [ ] Anthropic 콘솔 monthly cap $200 설정 (메모리 `project_anthropic_cap_pre_install`)
- [ ] (Phase 2) Cloudflare Email Routing 활성화

---

## 1. Staging Dry-Run (필수, 1주 전 실행)

### 1.1 Staging D1 freshly 초기화

```bash
# 기존 staging D1 데이터 완전 삭제 (필요 시 진산님 콘솔 직접 작업)
# wrangler d1 execute thepick-staging --env staging --remote --command "DROP TABLE IF EXISTS ..."

# 마이그레이션 0001~0017 순차 적용
cd apps/api
pnpm wrangler d1 migrations apply thepick-staging --env staging --remote
```

**검증**: 모든 마이그레이션 PASS 확인. 트리거 12종 + CHECK 제약 + partial UNIQUE 인덱스 first-run 동작 확인.

### 1.2 트리거 12종 INSERT/UPDATE 차단 시나리오 smoke test

```bash
# 0014 prevent_knowledge_nodes_update 검증
pnpm wrangler d1 execute thepick-staging --env staging --remote --command "
  INSERT INTO knowledge_nodes (id, type, label, exam_id) VALUES ('TEST-001', 'CONCEPT', 'test', 'son-hae-pyeong-ga-sa');
  UPDATE knowledge_nodes SET label = 'modified' WHERE id = 'TEST-001';
"
# 기대: UPDATE → trigger RAISE(ABORT)

# 0017 prevent_engine_telemetry_update 검증
pnpm wrangler d1 execute thepick-staging --env staging --remote --command "
  INSERT INTO engine_telemetry (gauge_name, exam_id, batch_run_id, recorded_at, metric_value, severity) VALUES ('cost', 'son-hae-pyeong-ga-sa', 'TEST-RUN', '2026-05-02T00:00:00Z', 0, 'ok');
  UPDATE engine_telemetry SET metric_value = 1 WHERE batch_run_id = 'TEST-RUN';
"
# 기대: UPDATE / DELETE → trigger RAISE(ABORT)

# Hard Rule 17 EXAM_IDS 위반 차단 (CHECK 제약)
pnpm wrangler d1 execute thepick-staging --env staging --remote --command "
  INSERT INTO knowledge_nodes (id, type, label, exam_id) VALUES ('TEST-002', 'CONCEPT', 'test', 'invalid-exam-id');
"
# 기대: CHECK 제약 throw

# 정리
pnpm wrangler d1 execute thepick-staging --env staging --remote --command "
  DELETE FROM knowledge_nodes WHERE id LIKE 'TEST-%';
"
```

**rollback**: smoke test 실패 시 마이그레이션 0001~0017 중 어느 step 부터 깨졌는지 wrangler logs 확인. 0017 의 ALTER 실패 시 `apps/api/migrations/down/0017_engine_telemetry.sql` 의 주석 SQL 수동 적용 (현 시점 down script 미작성 — Phase 2 추가 의무).

### 1.3 Staging API 배포

```bash
cd apps/api
pnpm wrangler deploy --env staging
```

**검증**:

```bash
# /health endpoint
curl https://api-staging.thepick.app/health
# 기대: {"status": "ok", ...}

# /api/telemetry/dashboard (X-Admin-Token 필수)
curl -H "X-Admin-Token: $STAGING_ADMIN_TOKEN" https://api-staging.thepick.app/api/telemetry/dashboard
# 기대: 8 게이지 모두 'no_data' 응답 (BATCH 미실행 상태)
```

**rollback**: deploy 실패 시 직전 `pnpm wrangler rollback --env staging` (Cloudflare Workers 자동 롤백 — versionId 기반).

### 1.4 admin-web Pages 배포

```bash
cd apps/admin-web
pnpm build
# Cloudflare Pages "Git Integration" 모드 활성화 시 자동 배포 — staging branch push 권고
```

**검증**: `https://thepick-admin.pages.dev/login` 접근 → 토큰 입력 → `/telemetry` 진입 → 8 게이지 `no_data` 시각 확인.

---

## 2. Production 배포 (Staging Dry-Run PASS 후)

### 2.1 Production D1 마이그레이션 첫 적용

```bash
# 사전 확인
pnpm wrangler d1 migrations list thepick --env production --remote
# 기대: 0/17 적용 상태

# 적용
pnpm wrangler d1 migrations apply thepick --env production --remote
```

**검증**: staging 과 동일 smoke test (§1.2) production 환경에서 재실행.

**rollback**: production 마이그레이션 실패 시 진산님 직접 콘솔에서 D1 backup (Cloudflare Time Travel — 최대 30일) 복원. **본 시점 down script 미작성이므로 manual SQL 복구는 위험** — Phase 2 진입 시 down script 작성 의무.

### 2.2 Production API 배포

```bash
cd apps/api
pnpm wrangler deploy --env production
```

**검증**:

```bash
curl https://api.thepick.app/health
# 기대: {"status": "ok", ...}
```

### 2.3 Production admin-web Pages 배포

```bash
cd apps/admin-web
pnpm build
# main branch push → Cloudflare Pages 자동 배포
```

**검증**: production 도메인 (DNS 등록 후) 접근 → admin token 인증 → /telemetry 8 게이지 `no_data` 확인.

---

## 3. 각 Step 실패 시 Rollback 절차

| Step                        | 실패 증상     | Rollback 절차                             |
| :-------------------------- | :------------ | :---------------------------------------- |
| 1.1 staging 마이그레이션    | wrangler 에러 | `git diff migrations/` 검토 + 진산님 보고 |
| 1.2 staging smoke test      | 트리거 미동작 | 마이그레이션 0014/0017 SQL 재검토 + ADR   |
| 1.3 staging deploy          | 5xx           | `pnpm wrangler rollback --env staging`    |
| 2.1 production 마이그레이션 | wrangler 에러 | 진산님 콘솔 D1 Time Travel 복원           |
| 2.2 production deploy       | 5xx           | `pnpm wrangler rollback --env production` |

---

## 4. BATCH-1 진입 직전 최종 게이트

본 runbook 단계 1.1~2.3 모두 PASS 확인 후 진산님 트리거 키워드 **"BATCH-1 적재 진입"** 발동. 이후 ENGINE_HARDENING_COMPLETION_REPORT v1.2 §11.2 단계 1~8 진행.

---

## 5. Phase 2 자동화 의무 (트래킹 ledger)

- [ ] **TD-DO-056**: `.github/workflows/deploy.yml` 신규 — staging dry-run 자동 게이트화
- [ ] **TD-DO-052**: 마이그레이션 down script 작성 (0001~0017 모두)
- [ ] **TD-DO-055**: CI 실패 Cloudflare webhook receiver

---

**근거 cross-ref**:

- `.claude/reviews/phase1-tech-debt-20260502-backend.md` B-C2
- `.claude/reviews/phase1-tech-debt-20260502-devops.md` MAJOR-DO-S1-4
- `apps/api/wrangler.toml`
- `migrations/0001~0017`
