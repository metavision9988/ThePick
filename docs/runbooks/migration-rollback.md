# Migration Rollback Runbook (마이그레이션 0021~0026)

> **목적**: ADR-032 Table-as-Micro-KG 도입 마이그레이션 6종 (0021~0026)의 안전한 rollback 절차.
> **트리거**: forward 마이그레이션이 운영 중 회귀를 일으켰거나, ADR-032 자체가 거부되는 경우 사용.
> **상태**: 5-Persona DA-C2 흡수 (Session 052 → Session 054 영속).
> **carry-over**: 현 시점 적재 row 0건 (Phase 2A BATCH 재추출 전), Phase 2A 적재 후 H_nested / nested_table 행 처리 별도 의무.

---

## 0. ★ 적용 전 절대 의무

| 의무                               | 사유                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **진산 명시 승인 영속**            | rollback은 forward로 만들어진 데이터 손실 / 운영 중 거부 결정이므로 단독 진행 불가. handoff에 결정 + 사유 영속 의무.                   |
| **staging 우선 적용**              | production 직접 down 금지. staging 적용 → 검증 → production 적용 순서 강제.                                                            |
| **사전 백업**                      | `wrangler d1 export` 로 4 테이블 모두 dump. 백업 실패 시 down 중단.                                                                    |
| **Cloudflare API token 회전 의무** | A2 schema drift CI workflow (`.github/workflows/d1-schema-drift.yml`) secrets와 동일 token 사용 시, down 후 token roll + secrets 갱신. |

---

## 1. 파일 위치 + 명명 규칙

```
docs/runbooks/migration-rollback/
  0021_rollback.sql   ← migrations/0021_table_as_micro_kg.sql 역
  0022_rollback.sql   ← migrations/0022_table_structures_update_guard.sql 역
  0023_rollback.sql   ← migrations/0023_table_cells_pattern_h.sql 역
  0024_rollback.sql   ← migrations/0024_table_structures_pattern_h.sql 역
  0025_rollback.sql   ← migrations/0025_table_cells_partial_index.sql 역
  0026_rollback.sql   ← migrations/0026_table_subordinate_update_guards.sql 역
```

**왜 `migrations/` 디렉토리 외부인가**:

- `wrangler d1 migrations apply` 는 `migrations_dir` (= `migrations/`) top-level `*.sql` 만 자동 적용 → down script를 동 디렉토리에 두면 자동 forward 실행 위험.
- `scripts/verify-engine-contracts.ts:359-360` 의 정규식 `^\d{4}_.+\.sql$` 가 동 디렉토리 자식 파일을 카운트 → down 추가 시 카운트 25→31 회귀.
- `docs/runbooks/migration-rollback/` sub-dir 신설로 양쪽 영향 0 + 발견성 보존 (본 runbook이 인용).

---

## 2. LIFO 적용 순서 (0026 → 0021)

forward 와 정확히 반대 순서. 하나라도 건너뛰면 schema 불일치 회귀.

```
0026_rollback.sql  (3 trigger DROP)
  ↓
0025_rollback.sql  (2 partial index DROP)
  ↓
0024_rollback.sql  (table_structures 12-step 역 + 0022 trigger 복원)
  ↓
0023_rollback.sql  (table_cells 12-step 역)
  ↓
0022_rollback.sql  (1 trigger DROP — 0024 down에서 복원된 상태 기준)
  ↓
0021_rollback.sql  (4 테이블 DROP — 모든 표 데이터 영구 손실)
```

**부분 rollback 가능**: 회귀 사유가 0026 trigger 한정이면 0026_rollback.sql 단독 적용 후 종료. 단, 0023/0024 같은 12-step 역은 **반드시 짝 LIFO 순서**.

---

## 3. 사전 체크 의무 (down 별)

### 0026 down (영향 최소)

```bash
# trigger 존재 확인
wrangler d1 execute thepick-db-staging --remote --command \
  "SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('prevent_table_cells_critical_update','prevent_table_headers_critical_update','prevent_table_node_links_update');"
# 3 row 반환이 정상 forward 상태
```

### 0025 down (영향 최소)

```bash
# partial index 존재 확인
wrangler d1 execute thepick-db-staging --remote --command \
  "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_table_cells_value_partial','idx_table_cells_merged');"
# 2 row 반환이 정상 forward 상태
```

### 0024 down (★ 데이터 손실 위험)

```bash
# H_nested 행 카운트 — > 0 이면 INSERT...SELECT 단계 ABORT
wrangler d1 execute thepick-db-staging --remote --command \
  "SELECT COUNT(*) AS h_nested_count FROM table_structures WHERE pattern_type='H_nested';"
```

- 결과 > 0 → 다음 중 하나 선택:
  1. **down 거부**: 0024 forward 유지 (가장 안전).
  2. **사전 이전**: H_nested 행을 다른 패턴 (예: `D_merged`) 으로 UPDATE → 단, `prevent_table_structures_critical_update` trigger 가 차단 (Hard Rule 28). trigger DROP → UPDATE → down → trigger 복원 순서 필요 (전체 트랜잭션 외부 의무).
  3. **백업 + DELETE**: H_nested 행을 별도 dump → DELETE → down. carry-over 결정 영속 의무.

### 0023 down (★ 데이터 손실 위험)

```bash
# nested_table 셀 카운트
wrangler d1 execute thepick-db-staging --remote --command \
  "SELECT COUNT(*) AS nested_count FROM table_cells WHERE value_type='nested_table' OR nested_table_id IS NOT NULL;"
```

- 결과 > 0 → 0024 down 과 동일한 3 옵션. 단, 본 셀은 `prevent_table_cells_critical_update` trigger (0026) 가 UPDATE 차단 → trigger 의존성 LIFO 순서 정합 의무.

### 0022 / 0021 down

- 0022: 단순 DROP TRIGGER. 0024 down 선행 시 안전.
- 0021: ★★★ **4 테이블 전체 DROP**. `wrangler d1 export` 백업 의무 + 진산 명시 승인.

---

## 4. 적용 절차 (staging → production)

### Step 1 — staging 적용

```bash
# 1a. 사전 백업 (production 동일 명령, --env production)
wrangler d1 execute thepick-db-staging --remote --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'table_%';" \
  > backups/pre-rollback-staging-$(date +%Y%m%d-%H%M%S).txt

# 1b. 적재 row dump (0021 down 시 필수)
wrangler d1 export thepick-db-staging --remote \
  --output=backups/table-data-staging-pre-0021-rollback-$(date +%Y%m%d-%H%M%S).sql \
  --table=table_structures --table=table_headers --table=table_cells --table=table_node_links

# 1c. down 순차 적용 (LIFO)
wrangler d1 execute thepick-db-staging --remote \
  --file=docs/runbooks/migration-rollback/0026_rollback.sql
wrangler d1 execute thepick-db-staging --remote \
  --file=docs/runbooks/migration-rollback/0025_rollback.sql
# (0024 → 0023 → 0022 → 0021 동일, 각 단계 후 sqlite_master 검증 권장)
```

### Step 2 — staging 검증

```bash
# trigger / index 부재 확인
wrangler d1 execute thepick-db-staging --remote --command \
  "SELECT type, name FROM sqlite_master WHERE name LIKE 'prevent_table%' OR name LIKE 'idx_table_cells_%' OR name LIKE 'table_%';"

# d1_migrations 테이블 갱신 (wrangler 자동 추적 X)
wrangler d1 execute thepick-db-staging --remote --command \
  "DELETE FROM d1_migrations WHERE name LIKE '002[1-6]_%';"
```

### Step 3 — verify-engine-contracts 영향 확인

```bash
# 본 runbook 검증 후 verify Cat 9 의도된 FAIL 확인
pnpm tsx scripts/verify-engine-contracts.ts --json | jq '.categories[] | select(.id==9)'
# Cat 9 status="FAIL" 이 down 후 의도된 결과 (forward 상태 검증이므로)
```

**★ 중요**: down 적용 후 `verify-engine-contracts.ts` 는 **FAIL 이 정상**. CI 파이프라인이 verify FAIL 로 차단되므로, rollback 적용 시 verify 의 forward 검증 부분도 동시 patch 의무 (혹은 임시 skip 플래그). 본 시나리오는 별도 PR/handoff 결정 영속.

### Step 4 — production 적용

staging 검증 PASS + 진산 승인 후에만 동일 절차 production 반복. **--env production** 플래그 의무.

### Step 5 — A2 schema drift CI 영향

`.github/workflows/d1-schema-drift.yml` 가 staging↔production sqlite_master diff 감지 → 한쪽만 down 적용 시 의도된 FAIL. 양쪽 적용 완료 후 first run PASS 확인 의무.

---

## 5. 적용 후 의무 (영속)

| 항목                                         | 의무                                                            |
| -------------------------------------------- | --------------------------------------------------------------- |
| `d1_migrations` 갱신                         | wrangler 가 forward 만 추적 → down 후 row 수동 삭제             |
| `scripts/verify-engine-contracts.ts`         | Cat 9 검증 항목 동시 갱신 (forward 상태 검증)                   |
| `packages/parser/src/ontology-registry.json` | 0023/0021 down 시 ID 패턴 + edge_type 회귀                      |
| `packages/shared/src/types.ts`               | TRUTH_WEIGHTS / NodeType / EdgeType 회귀 (0021/0023 down 시)    |
| `apps/api/src/db/schema.ts`                  | Drizzle table 정의 회귀 (0021 down 시 4 테이블 제거)            |
| ADR-032 status                               | Accepted → Rejected 전환 + decision history 추가 (0021 down 시) |
| handoff                                      | rollback 적용 사실 + 사유 + 백업 위치 영속                      |
| Cloudflare API token                         | A2 secrets 가 같은 token 사용 시 roll + secrets 갱신            |
| Vectorize 인덱스                             | 0021 down 시 table_id 메타데이터 stale → 재구축 또는 GC         |

---

## 6. 의사결정 매트릭스

| 사유                                                                   | 권장 down             |
| ---------------------------------------------------------------------- | --------------------- |
| `prevent_table_*_critical_update` trigger 자체에 회귀                  | 0026 + 0022 (필요 시) |
| admin G5.5 cross-table 쿼리 partial index 회귀                         | 0025                  |
| pattern_type CHECK 8종 자체에 D1 회귀 (별표9 LAW-143 패턴-H 차단 결정) | 0024                  |
| nested_table value_type 자체에 D1 회귀 (패턴-H 거부 결정)              | 0024 + 0023 (LIFO)    |
| ADR-032 전체 거부 (Table-as-Micro-KG 자체 폐기)                        | 0026 → 0021 전체 LIFO |

---

## 7. 의도적으로 다루지 않는 것

- **forward + down 자동 toggle 스크립트**: 위험. 진산 명시 승인 강제 정합.
- **wrangler 내장 d1 migrations rollback**: 미지원 (forward-only). 본 runbook의 수동 절차가 유일한 경로.
- **D1 point-in-time recovery**: Cloudflare 30일 자동 백업 활성 가정 (Cloudflare 정책 준수). down 절차와 별도 재해 복구 경로.

---

## 8. 검증 체크리스트 (down 적용 후)

- [ ] `sqlite_master` 에 forward로 만든 entity 부재 확인
- [ ] `d1_migrations` 테이블에서 0021~0026 row 삭제
- [ ] staging↔production sqlite_master 동일 diff (A2 workflow PASS)
- [ ] `verify-engine-contracts.ts` Cat 9 의도된 FAIL 확인 + 별도 patch 진행
- [ ] handoff + ADR-032 status 갱신 영속
- [ ] 백업 파일 위치 + 진산 결정 사유 영속

---

## 9. carry-over (Phase 2A 적재 후 보강 의무)

현재 (2026-05-07 Session 054 종착) 적재 row 0건 → 본 runbook 단순 적용 가능.
Phase 2A BATCH-7 별표 1·2·5·6·7 재추출 후:

- H_nested 행이 별표9 LAW-143 등 ~125 노드 적재 시 다수 발생 가능
- 0024 down 사전 체크에서 ABORT 위험 ↑ → 본 §3 H_nested 행 처리 옵션 3종 별도 ADR 영속 필요
- nested_table 셀 ID 패턴 (`TCELL-NNN-NN-NN`) 백업 dump 시 행 카운트 polynomial → 백업 storage 한도 별도 모니터링 의무

차세션 Phase 2A 적재 직후 본 §9 갱신 + ADR 작성 결정 영속.

## 10. D1 DR — 오프사이트 백업 (2026-07-10 신설, 5-페르소나 P5 D-03)

- **문제**: D1 복구 = Time Travel **30일** 단일 의존 — 30일+ 잠복 결함(실전 전력: 정답 오류 36 이 수개월 잠복) 발견 시 user_progress·검수 승급 이력 영구 복구 불가.
- **오프사이트 스냅샷**: `bash scripts/backup-d1-to-r2.sh` → `r2://thepick-backups/d1/production/<UTC>.sql` (전체 dump, 크기 하한 가드). **첫 백업 = `d1/production/20260710T054633Z.sql` (2.8MB, 2026-07-10)**.
- **복구 경로**: ① 30일 내 = Time Travel(`wrangler d1 time-travel restore`) ② 30일+ = R2 스냅샷 SQL 을 신규 D1 에 import 후 바인딩 전환. RPO = 백업 실행 주기 / RTO = import 소요(현 3MB ≈ 분 단위).
- **자동화 = 가동 중 (2026-07-12)**: `.github/workflows/ops.yml` — 주간(월 KST 12:00) 백업 + 일간(KST 06:17) 공개 표면 라이브 스모크(실패 시 GH 알림 메일 = 알림 최소선 1채널). 시크릿 = `CLOUDFLARE_API_TOKEN`(진산 발급 07-12, D1·R2 권한)·`CLOUDFLARE_ACCOUNT_ID`. 첫 dispatch 검증 = R2 `d1/production/20260712T034158Z.sql` 실재 확인. 대량 production 쓰기 작업 직전에는 여전히 수동 1회 실행 권장(`bash scripts/backup-d1-to-r2.sh` — RPO 를 그 시점으로 당김).
