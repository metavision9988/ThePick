# Session 052 — Phase 1 종착 + Phase 2 진입 직전 5-Persona Tech Debt Review (통합 보고서)

> **검토 시각**: 2026-05-07 15:47 KST (Session 052 mid)
> **검토 방식**: 5 독립 에이전트 단일 메시지 병렬 호출 — auto-review-protocol.md §"Phase 단위 5-페르소나 기술부채 리뷰" + memory `feedback_phase_review_5_persona.md` 정합
> **검토 트리거**: 진산 "다양한 각도에서 다양한 관련 전문가 페르소나를 동원해서 기술부채가 발생하지 않도록 점검 / 자가 검증 편향 테스트"
> **종합 판정**: 🔴 **Critical 10건 / Major 17건** — Phase 2A 진입 전 의무 차단

## 검토 범위

본 Session 052 + Session 050+051 누적 = **Phase 1 Foundation + Phase 2 진입 게이트** 마일스톤:

- 4-Pass 직전 흡수 6 Critical (CRIT-A~F) — **중복 지적 회피** 명시
- 5-Persona는 4-Pass와 다른 차원에서 본 PR 점검

**5 독립 에이전트**:
| Persona | Agent type | 관점 | 핵심 질문 |
|---|---|---|---|
| 1 | refactoring-expert | 코드 품질 부채 | "6개월 뒤 이 코드가 버틸까?" |
| 2 | performance-engineer | 런타임 부채 | "10K 사용자에서 뭐가 터지나?" |
| 3 | quality-engineer | 테스트 부채 | "프로덕션에서 뭐가 물릴까?" |
| 4 | backend-architect | 데이터·API 부채 | "2년차에 뭐가 아플까?" |
| 5 | devops-architect | 운영 부채 | "새벽 3시 on-call 시나리오?" |

---

## 🔴 Critical 통합 (10건, dedup 후)

### Persona 1 (refactoring-expert): 0 Critical (Major 4 / Minor 3)

4-Pass 흡수 + 진입 게이트 통과 자격 충족.

### Persona 2 (performance-engineer): 1 Critical

- **PE-C1**: `idx_table_cells_table_value` low-cardinality 함정 — `(table_id, value_type)` 복합 인덱스에서 admin G5.5 cross-table 쿼리(`WHERE value_type='formula'`) 시 left-prefix 부재로 풀스캔 회귀
  - 위치: `migrations/0021_table_as_micro_kg.sql:136`
  - 시나리오: BATCH-7 적재 후 ~1,250 rows / Phase 2D 셀 임베딩 후 ~5,000 rows → 풀스캔 P95 200ms+
  - Fix: Partial index `CREATE INDEX idx_table_cells_value ON table_cells(value_type) WHERE value_type IN ('formula','merged_ref','nested_table');` (24× 개선 추정)

### Persona 3 (quality-engineer): 3 Critical

- **QE-C1**: 마이그레이션 0024 D1 raw INSERT/SELECT 회귀 0건. schema-validator unit test 통과 ≠ D1 CHECK 통과
  - Fix: `apps/api/src/__tests__/migration-0024-nested.test.ts` — wrangler local D1에 H_nested INSERT/SELECT 회귀
- **QE-C2**: `verify-engine-contracts.ts` Cat 9 self-verification 부재 (mutation reverse-test). 카운트 매칭만 통과면 PASS
  - 시나리오: 0024 파일 삭제/손상해도 Cat 9 PASS — 회귀 차단 0
  - Fix: `scripts/__tests__/verify-cat9-mutation.test.ts` — 마이그레이션 파일 임시 rename → verify exit !=0 assertion
- **QE-C3**: E2E BATCH 적재 invariant 0건 (LLM→validator→D1 round-trip)
  - 시나리오: schema-validator PASS이나 D1 FK constraint 실패 → partial dirty state
  - Fix: `packages/parser/src/__tests__/batch-loader-e2e.test.ts` — fixture LLM 응답 → validateTablesSection → in-memory D1 INSERT → 무결성 SELECT

### Persona 4 (backend-architect): 3 Critical

- **BA-C1**: Hard Rule 16 위반 — 4 신규 테이블 `examId` 컬럼·래퍼 0건 (`apps/api/src/db/queries/` 디렉토리 자체 부재)
  - Year 2 비용 추정: **선제 5~8 work-day vs 사후 30~50 work-day** (~3배 차)
  - Fix: Phase 2 admin G5.5 UI 진입 전 `apps/api/src/db/queries/tables.ts` 신설, 모든 함수 첫 인자 `examId: ExamId` 의무화
- **BA-C2**: Hard Rule 28 inconsistent — `table_cells/headers/node_links` UPDATE 무방비
  - 시나리오: G5.5 검수자 셀 직접 UPDATE → revision history 0 → 감사 불가
  - Fix: 0026 마이그레이션 trigger 3종 추가 (또는 ADR-032에 셀/헤더 UPDATE 정책 명시)
- **BA-C3**: ID 패턴 한도 — TBL `\d{3}` (999표) / TROW·TCOL `\d{2}` (99 row/col) — Year 2 multi-exam 5 시험 합산 즉시 초과
  - 별표9 LAW-143 75p 표가 100행 초과 가능
  - Fix: Year 2 진입 전 패턴 확장 (TBL `\d{4}` + exam prefix) ADR

### Persona 5 (devops-architect): 3 Critical

- **DA-C1**: 0024 trigger 재생성 검증 자동화 0건 — `verify-engine-contracts.ts:520` migr22Exists는 **파일 존재만** 검증
  - 시나리오: 향후 0025+에서 또 table_structures 재생성 시 trigger 재생성 누락 → verify는 PASS인데 D1은 무방비 → Hard Rule 28 무력화
  - Fix: Cat 9에 `wrangler d1 execute --command "SELECT name FROM sqlite_master WHERE type='trigger' AND name='prevent_table_structures_critical_update'"` 추가 (양쪽 env)
- **DA-C2**: 마이그레이션 forward-only / rollback runbook 0건 — 0021~0024 down script 부재
  - Fix: `migrations/NNNN_rollback.sql` 영속 + `docs/runbooks/migration-rollback.md`
- **DA-C3**: staging↔production schema drift CI 자동 검증 0건 — manual `wrangler d1 execute` 의존
  - 시나리오: staging만 0025 적용 + production 누락 → BATCH CHECK failure 폭증 + 토큰 ~$30 매몰
  - Fix: CI workflow에 양쪽 env `wrangler d1 export --remote` → diff job 추가

---

## 🟠 Major 통합 (~17건)

### Refactoring (4건)

- **R-M1**: `validateTablesSection` God Function — 480 LOC, cyclomatic ~45, 7가지 책임. 4 함수 분리 의무 (Phase 2 Step 1)
- **R-M2**: ErrorCode 11종 명명 일관성 깨짐 — `INVALID_TABLE_*` / `DANGLING_*` / `NESTED_TABLE_*` / `TABLE_PATTERN_*` / `TABLE_HEADER_*` 5종 prefix 혼재 → `TBL_*` 통일 권고
- **R-M3**: 12-step 마이그레이션 보일러플레이트 중복 (0023+0024 80% 동일) → `docs/runbooks/sqlite-12step-checklist.md` + `verify-migration-12step.ts`
- **R-M4**: Drizzle↔SQL enum 자동 정합 검증 부재 → `scripts/verify-drizzle-sql-enum-sync.ts` + Cat 10 신설

### Performance (3건)

- **PE-M1**: `merged_with_id` 직접 인덱스 부재 → Pattern-D anchor 역방향 풀스캔 (Phase 3 모바일 60fps 위협)
- **PE-M2**: validateTablesSection O(N×M×H) 셀별 RegExp 호출 — 별표9 600 cells × 6 BATCH = 3,600회 → 600회로 RegExp 캐싱
- **PE-M3**: TextEncoder 매 호출 인스턴스화 — module-scope 재사용 시 25ms 절약/BATCH

### Quality (5건)

- **QE-M1**: DFS cycle 깊이 빈약 — 3-cycle/4-cycle/10-depth/disconnected/multiple cycles 5종 누락
- **QE-M2**: Forward-reference declaration order 동작 미정의
- **QE-M3**: Property-based testing 0건 (fast-check)
- **QE-M4**: LLM hallucination 추가 5종 미커버 (`TBL-XYZ`/`axis='diagonal'`/`row_count=NaN`/`level=99`/Mixed Korean ID)
- **QE-M5**: 에러 메시지 snapshot 부재 (admin G5.5 UI 회귀 위험)

### Backend (4건)

- **BA-M1**: `table_node_links INTEGER PK` vs 9 테이블 TEXT PK 일관성 위반
- **BA-M2**: `table_node_links` vs `knowledge_edges` 의미 중복 (CONTAINS_TABLE은 edges에, extracted_from은 node_links에)
- **BA-M3**: ★ **TABLE=9 > FORMULA=8 부정합** — ADR §"truth_weight 정합 v2" 주석은 "TABLE=FORMULA 동급" 의도이나 코드는 9 > 8 (**본 Session 052 fix 자체에서 새 drift 도입** — 자가 검증 편향 사례)
  - Fix: `types.ts:74` TABLE=8, ROW=COL=7, CELL=6
- **BA-M4**: API endpoint 0건 (`apps/api/src/routes/` 자체 부재) — admin G5.5 UI carry-over

### DevOps (1건 + Minor 다수)

- **DA-M1**: BATCH 재추출 실패 retry/DLQ 0건 (토큰 ~$30 매몰 위험)
- (Minor) **DA-M3**: Anthropic Console cap 미활성 carry-over (memory 위반)
- (Minor) **DA-M4**: Cloudflare API token 평문 노출 영속 (진산 결정 영속, 그러나 운영 위험)

### Performance Devil's

- **PE-Devil**: `batch-processor.ts:91-97` `maxTokens: 4096` — 별표9 nested 시 truncation 위험. **8192~16K 상향 의무** (Phase 2A 첫 BATCH 직전)

---

## ✅ PASS 증거 합 (각 Persona 3+)

- `migrations/0024:79-85` — 0022 trigger 재생성 책임 명시·실제 수행 (책임 누락 회피)
- `migrations/0023:46-55` — `nested_table_id` FK + 복합 CHECK 정합 (value_type='nested_table' ⇒ NOT NULL)
- `0021:108` `UNIQUE(table_id, row_id, col_id)` — 셀 중복 INSERT 차단
- `schema-validator.ts:241` `isValidSourcePage` helper 단일 정의 + 4곳 재사용 (DRY 모범)
- `schema-validator.ts:288~314` `detectNestedTableCycle` visiting/visited 분리 (정통 그래프 알고리즘)
- `schema.ts:4~17` NC-1 정책 명시 + drizzle-kit 차단 주석 (self-document 우수)
- `migrations/0021:135-141` `idx_table_headers_table_axis` 4-key covering — 표 단위 헤더 ~0.1ms
- `schema-validator.ts:1276-1307` `computeMaxJsonDepth` character-level 1-pass — JSON.parse 진입 전 stack overflow 차단
- `schema-validator.ts:1217-1226` `DEFAULT_MAX_RESPONSE_SIZE_BYTES=100KB` D1 1MB의 10% 헤드룸
- `.github/workflows/ci.yml:80-95` gitleaks + verify-engine-contracts JSON artifact 30일 보존
- `migrations/0017_engine_telemetry.sql` + `master-dashboard.md` — append-only telemetry 인프라 영속

---

## 우선순위 묶음 (진산 "중요하고 긴급한 거 부터 순차적으로 모두 처리")

### A. 즉시 차단 (Phase 2A 진입 전 — 3시간)

1. **DA-C1** Cat 9 trigger D1 SELECT 자동화 (30min)
2. **DA-C3** staging+production schema drift CI workflow (2h, push 차세션 carry-over 정합)
3. **DA-M3** Anthropic Console cap 활성 — **진산 영역 (Console UI 의무)**, 본 세션에서 처리 불가 → handoff 영속

### B. Phase 2A 진입 전 의무 (1-2일)

4. **PE-C1** 0025 partial index 마이그레이션 + staging+production 적용 (15min)
5. **BA-C2** 0026 trigger 마이그레이션 (table_cells/headers/links UPDATE 차단) + staging+production 적용 (1h)
6. **BA-M3** truth_weight 재조정 (TABLE=8 / ROW=COL=7 / CELL=6) — ADR 정합 (5min, 본 fix 자가 drift 자가 흡수)
7. **QE-C1** 0024 D1 raw roundtrip 회귀 테스트 (1-2h)
8. **QE-C2** Cat 9 mutation reverse-test (1h)
9. **QE-C3** E2E BATCH invariant 회귀 (2-4h)
10. **PE-Devil** `maxTokens` 4096 → 16384 상향 (5min)

### C. Phase 2 도중 / Year 2 진입 전 carry-over

11. **R-M4** Cat 10 신설 — Drizzle↔SQL enum 자동 verify (2h, 본 세션 가능)
12. **DA-C2** down scripts 0021~0026 + `docs/runbooks/migration-rollback.md` (3-4h, 본 세션 후반)
13. **R-M1** `validateTablesSection` 4 함수 분리 (1-2일 carry-over) — 차세션
14. **BA-C1** `apps/api/src/db/queries/tables.ts` examId 시그니처 (5-8일 carry-over) — 차세션 plan
15. **BA-C3** ID 패턴 확장 ADR (1-2일 carry-over) — Year 2 진입 전 의무

---

## 본 세션 처리 계획

| 묶음 | 작업                         | 본 세션 처리?    | carry-over                        |
| ---- | ---------------------------- | ---------------- | --------------------------------- |
| A1   | DA-C1 Cat 9 trigger D1 검증  | ✅ 즉시          | -                                 |
| A2   | DA-C3 schema drift CI        | ✅ workflow 작성 | push 차세션 (PAT scope)           |
| A3   | DA-M3 Anthropic cap          | ❌ 진산 영역     | handoff 영속                      |
| B1   | PE-C1 partial index          | ✅ 즉시          | -                                 |
| B2   | BA-C2 0026 trigger           | ✅ 즉시          | -                                 |
| B3   | BA-M3 truth_weight 재조정    | ✅ 즉시          | -                                 |
| B4   | QE-C1 D1 raw roundtrip       | ✅ 즉시          | -                                 |
| B5   | QE-C2 Cat 9 mutation         | ✅ 즉시          | -                                 |
| B6   | QE-C3 E2E BATCH invariant    | ✅ 부분          | 일부 carry-over                   |
| B7   | PE-Devil maxTokens           | ✅ 즉시          | -                                 |
| C1   | R-M4 Cat 10 enum sync        | ✅ 시간 허용 시  | session-health 임계 시 carry-over |
| C2   | DA-C2 down scripts + runbook | ✅ 시간 허용 시  | 동상                              |
| C3   | R-M1 함수 분리               | ❌ 시간 부족     | 차세션                            |
| C4   | BA-C1 queries/tables.ts      | ❌ 시간 부족     | 차세션 plan                       |
| C5   | BA-C3 ID 패턴 ADR            | ❌ 시간 부족     | 차세션 plan                       |

---

**작성**: Claude (Opus 4.7 1M context) — Session 052 mid
**근거**: 5 독립 에이전트 (refactoring/performance/quality/backend/devops) 병렬 호출. 각 자기 확인 편향 0. 4-Pass 흡수 6 Critical 중복 지적 회피.
**다음**: 진산 "권장안으로 진행" 트리거 → 우선순위 순차 처리 시작.
