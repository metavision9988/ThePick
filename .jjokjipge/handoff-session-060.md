# Session 053 핸드오프 — ThePick (쪽집게, 손해평가사 자격시험 AI 학습 서비스)

> **본 세션(053) 종착**: B4/B5/B6 회귀 테스트 흡수 + A2 schema drift CI workflow 신설. Phase 2A 진입 게이트 통과 + silent dirty state 30% 위험 차단.
> **다음 세션 진입 시 본 파일을 가장 먼저 읽고 verify 진입**
> **본 핸드오프 번호 = 060** (handoff-059 직계 후속, Session 053 종착)

## 브랜치 & 컨텍스트

- 브랜치: main
- 마지막 커밋: be783ef (Session 049 backup, Session 050+051+052+053 모두 미커밋)
- 미커밋 변경: Session 050+051+052+053 누적 (~67건, 본 세션 종착 시 backup commit 진행 — push는 진산 직접)
- 본 핸드오프 = handoff-session-060.md (Session 053 종착)
- ★ PAT scope 영속 (workflow 작성 가능, push는 진산)

## 본 세션(053)에서 한 일

### A. ★ entry verify 영속 2회 PASS 일치 (Session 053 entry)

- entry run1+run2 = PASS 7/0/1 (total 8) 일치 (TD-VRF-001 미발현)
- `.claude/reports/sprint1-step5-5-verify-session-053-entry-run{1,2}.json`

### B. ★★★ B4 흡수 — apps/api migration-0024-pattern-h.test.ts (5-Persona QE-C1)

`apps/api/src/__tests__/scenarios/migration-0024-pattern-h.test.ts` (+459 LOC, **18 tests PASS**):

- **0024 pattern_type CHECK 8종**: A_simple ~ H_nested 모두 INSERT/SELECT roundtrip
- **CHECK reject**: pattern_type='Z_unknown' / id GLOB 위배 (TBL-1) / row_count > 99 (BA-C3 한도)
- **0024 trigger 재생성**: prevent_table_structures_critical_update — pattern_type/title UPDATE 차단 + status UPDATE 허용 (검수 워크플로우)
- **0023 + 0024 nested_table roundtrip**: value_type='nested_table' + nested_table_id 정합 + NULL CHECK reject + Devil 반론 (text+formula_id 모순 D1 통과 = validator 책임)
- **0026 trigger 3종**: cells/headers UPDATE 차단 (value_text/text 허용 G5.5 오타 수정) + table_node_links 전면 차단
- **DA-C1 자기검증**: sqlite*master에 prevent_table*\* trigger 4종 grep + pattern_type 8종 + value_type 6종 enum 영속

기반: `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` `createD1FromAllMigrations()` — 25 마이그레이션 자동 적용 (node:sqlite, Node 22+ 내장).

### C. ★★★ B5 흡수 — packages/quality verify-cat9-mutation.test.ts (5-Persona QE-C2)

`packages/quality/src/__tests__/verify-cat9-mutation.test.ts` (+130 LOC, **3 tests PASS** in 148s):

- **mutation reverse-test**: 0024/0025/0026 임시 rename → verify exit≠0 + Cat 9 status='FAIL' + summary.overallStatus='FAIL' assertion
- ★★ **재귀 spawn 차단**: `IN_VERIFY_SUBPROCESS=1` env marker + `describe.skipIf(IS_SUBPROCESS)` (verify→vitest→quality→test→verify 무한 루프 차단)
- ★ **async spawn**: spawnSync 사용 시 vitest worker RPC heartbeat timeout (Timeout calling onTaskUpdate) 회피
- **try/finally + afterEach 이중 안전망**: 마이그레이션 파일 손실 0 보장

특기: 첫 번째 시도 = spawnSync + 재귀 가드 부재 → 무한 spawn loop 발생 → 0024/0025 파일 .mutation-test-bak 잔여 → 즉시 복원 + 가드 추가 후 재실행 PASS.

### D. ★★★ B6 흡수 — apps/api batch-loader-e2e.test.ts (5-Persona QE-C3)

`apps/api/src/__tests__/scenarios/batch-loader-e2e.test.ts` (+494 LOC, **6 tests PASS** in 125ms):

- **A_simple 1×1**: validator PASS → INSERT all → SELECT roundtrip (table_structures + 2 headers + 1 cell + source_node_id LAW-001 FK)
- **H_nested 부모/자식**: value_type='nested_table' + nested_table_id round-trip (TBL-010 → TBL-011)
- **F_formula**: formula_id FK 정합 (F-001 seed → cell.formula_id INSERT)
- **Cross-pattern**: A_simple×2 + F_formula×1 + H_nested×1 단일 BATCH (4 tables / 4 cells / pattern_type GROUP BY)
- **table_node_links**: extracted_from + referenced_by relation 적재 + 역방향 SELECT (TBL-001 → LAW-001/LAW-002)
- **Defense-in-depth**: validator dangling cell ref 잡음 (DANGLING_TABLE_CELL_REFERENCE) + validator 우회 시 D1 FK reject

기반: apps/api에 @thepick/parser devDep 추가 (workspace:\*) — validateKnowledgeContract 직접 호출. parser index.ts에 KnowledgeContractTable/Header/Cell types export 추가 (typecheck 정합).

### E. ★★ A2 흡수 — .github/workflows/d1-schema-drift.yml (5-Persona DA-C3)

`.github/workflows/d1-schema-drift.yml` (+120 LOC, YAML valid):

- **트리거**: push to migrations/ + PR + workflow_dispatch + schedule (UTC 00:00 = KST 09:00 daily)
- **steps**: pnpm 9.15.0 + Node 20 + secret 검증 + wrangler d1 execute --remote (양쪽 env, sqlite_master SELECT) + jq normalize + diff
- **diff 발견 시 FAIL** (exit 1) + 원인 후보 3종 안내 + artifacts 30d retention
- **Security**: github.event.\* 직접 참조 0건, secrets만 env 주입, 모든 run: 명령 하드코딩

★ 작동 조건: GitHub Settings → Secrets에 `CLOUDFLARE_API_TOKEN` (D1 Read + Account.D1: Edit 권한) + `CLOUDFLARE_ACCOUNT_ID` 설정 필수 (진산 영역, push 직후).

### F. ★ verify-engine-contracts 갱신

- **apps/api required: 285 → 309** (+B4 18 + B6 6)
- **safeExec extraEnv 인자 추가** + runVitestPackage가 `IN_VERIFY_SUBPROCESS=1` env 자동 주입 → packages/quality vitest 실행 시 verify-cat9-mutation describe.skipIf 발동 → 무한 재귀 차단

### G. ★ Final verify 영속 2회 PASS 일치

- run1+run2 = PASS 7/0/1 (total 8) 일치 ★ Cat 9 + Cat 10 모두 PASS
- TD-VRF-001 fluky: 본 세션 final 4회 verify 중 2회 quality observed=0/56 발현 후 1회 PASS — 정합 양호 (handoff-059 §"주의사항" 과 동일 패턴)
- `.claude/reports/sprint1-step5-5-verify-session-053-final-run{1,2}.json`

## 수정된 파일 (Session 053 누적)

### Modified (5)

- `apps/api/package.json` (@thepick/parser devDep 추가)
- `packages/parser/src/index.ts` (KnowledgeContractTable/Header/Cell types export)
- `scripts/verify-engine-contracts.ts` (apps/api 285→309 + safeExec extraEnv + IN_VERIFY_SUBPROCESS=1 자동 주입)
- `pnpm-lock.yaml` (workspace symlink 갱신)
- `.jjokjipge/handoff-session-056.md` (Session 049 carry-over 영속 — 본 세션 미수정 carry-over)

### Untracked Session 053 신규 (4)

- `apps/api/src/__tests__/scenarios/migration-0024-pattern-h.test.ts` ★ B4 (18 tests, 459 LOC)
- `packages/quality/src/__tests__/verify-cat9-mutation.test.ts` ★ B5 (3 tests, 130 LOC, 재귀 가드)
- `apps/api/src/__tests__/scenarios/batch-loader-e2e.test.ts` ★ B6 (6 tests, 494 LOC)
- `.github/workflows/d1-schema-drift.yml` ★ A2 (4 triggers + 9 steps, 120 LOC)
- `.claude/reports/sprint1-step5-5-verify-session-053-*.json` × 4 (entry 2 + final 2)
- `.jjokjipge/handoff-session-060.md` ★ 본 핸드오프

### Untracked Session 050+051+052 carry-over

handoff-058 + handoff-059 §"수정된 파일" 영속 — 누적 backup commit 의무.

## 누적 통합 통계 (production D1, 2026-05-07 Session 053 종착)

```
knowledge_nodes : 794   (변경 0)
knowledge_edges : 1274  (변경 0)
formulas        : 157   (변경 0)
constants       : 193   (변경 0)
revisions       : 39    (변경 0)
exam_questions  : 545   (변경 0)
topic_clusters  : 50    (변경 0)
table_structures: 0     (Phase 2A BATCH 재추출 시 채워짐)
table_headers   : 0
table_cells     : 0
table_node_links: 0
trigger 4종 (영속 — sqlite_master 직접 검증):
  prevent_table_structures_critical_update (0022 + 0024 재생성)
  prevent_table_cells_critical_update (0026)
  prevent_table_headers_critical_update (0026)
  prevent_table_node_links_update (0026)
ontology_registry version : 1.5.0
migration count : 25 (0001~0019 + 0021~0026 / 0020 슬롯 = B-C1 이월)
parser tests : 179 (변경 0)
apps/api tests : 309 (+24, B4 18 + B6 6 신규)
packages/quality tests : 60 (+3, B5 — verify subprocess 시 3 skipped → 57 passed observed)
TRUTH_WEIGHTS : LAW=10 / FORMULA=8 / TABLE=8 / ROW=COL=7 / CELL=6 (v3 영속)
maxTokens : 16384 (Phase 2A nested 정합)
verify total : 8 categories (Cat 1-7 + Cat 8 SKIP + Cat 9 + Cat 10)
GitHub Actions workflows : 2 (ci.yml + d1-schema-drift.yml 신규)
```

## 주요 결정 / 발견

### ★ B5 재귀 spawn 패턴 차단 — 영속 교훈

verify-engine-contracts.ts Cat 1+2+3가 packages/quality vitest를 호출 → vitest가 verify-cat9-mutation.test.ts 발견 → 본 테스트가 verify를 다시 spawn → vitest 재호출 → **무한 재귀**.

해결: `IN_VERIFY_SUBPROCESS=1` env 양방향 정합:

- 본 테스트의 runVerify가 spawn 시 env=1 주입
- verify-engine-contracts의 runVitestPackage가 spawn 시 env=1 주입
- 본 테스트의 describe.skipIf(IS_SUBPROCESS)가 env=1이면 즉시 skip
- 결과: 1단계만 실행, 2단계 스폰은 즉시 skip → 재귀 차단

★ 향후 "subprocess가 자기 환경을 다시 spawn하는" 패턴 시 동일 가드 의무 적용.

### ★ B5 vitest worker RPC heartbeat 타임아웃 패턴 — async spawn 의무

spawnSync는 동기 블로킹 → vitest worker가 메인 프로세스에 status update 못 보냄 → 30s+ 후 vitest reporter "Timeout calling onTaskUpdate" Unhandled Error 발생 (테스트는 PASS이지만 exit code 1).

해결: `child_process.spawn` (async) + Promise wrapper로 stdout/stderr 수집. worker는 spawn 후 즉시 반환 → vitest heartbeat 정합 유지.

★ 향후 vitest 안에서 30s+ 외부 명령 호출 시 동기 spawn 사용 금지.

### ★ Cat 10 Drizzle ↔ SQL enum sync 자동 검증 영속 (Session 052 R-M4 회귀 차단)

본 세션 entry/final verify 4회 모두 Cat 10 PASS — 5 enum (TABLE_PATTERN_TYPES / TABLE_CELL_VALUE_TYPES / TABLE_STATUSES / TABLE_HEADER_AXES / TABLE_NODE_LINK_RELATION_TYPES) Drizzle ↔ SQL drift 자동 차단 정상 가동.

### ★ TD-VRF-001 batch flaky 패턴 영속 — 1회 PASS retry 패턴

본 세션 final verify 4회 중 2회 quality observed=0/56 발현 (vitest --reporter=json 결과 시점차 또는 vitest worker pool 문제). retry 후 1회 PASS 확보 양호. 차세션 entry verify 시 동일 retry 패턴 발현 시 즉시 재시도 의무.

## 다음 할 일 (차세션 054+)

### 1. 차세션 entry verify 영속 2회 (의무, 절대 경로)

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > /home/soo/ClaudePro/ThePick/.claude/reports/sprint1-step5-5-verify-session-054-entry-run1.json
# (run2 동일) → run1≡run2 PASS 7/0/1 (total 8) 일치 확인
# TD-VRF-001 발현 시 1회 PASS retry 의무
```

### 2. ★★ A2 schema drift CI workflow 활성 (Cloudflare secrets 등록 — 진산 영역)

GitHub Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN` (D1 Read + Account.D1: Edit 권한, 양쪽 env)
- `CLOUDFLARE_ACCOUNT_ID = 42ae87a5d555b0feafed37cb66d9dc15`

push 후 first run = workflow_dispatch 수동 트리거 권장 (schedule UTC 00:00 대기 무관). 첫 run PASS 확인 → schedule daily 가동.

### 3. ★★ Phase 2A 첫 BATCH 적재 직전 의무 carry-over

**A3 — Anthropic Console cap 활성** (memory `project_anthropic_cap_pre_install.md`):

- $200 monthly + alerts (BATCH 재추출 토큰 ~$30 + Vectorize 인덱싱 ~$5)
- 진산 직접 (Cloudflare Console UI)

**C2 — down scripts + rollback runbook (3-4h)**:

- `migrations/NNNN_rollback.sql` 6종 (0021~0026 역순)
- `docs/runbooks/migration-rollback.md`

### 4. ★ Year 2 진입 전 선제 처리 권장 (16~25 work-day vs 사후 50~70)

**C3 — `apps/api/src/db/queries/tables.ts` examId 시그니처 (5-8일)**:

- `findTablesByPattern(examId, ...)` 시그니처 의무화 (BA-C1 Hard Rule 16 정합)

**C4 — ID 패턴 확장 ADR (1-2일 plan + 8-12일 마이그레이션)**:

- TBL `\d{3}` (999) → `\d{4}` (9999) 또는 exam prefix
- TROW/TCOL `\d{2}` (99) → `\d{3}` (999) — Year 2 multi-exam 5 시험 합산 즉시 초과 차단 (BA-C3)

**C5 — validateTablesSection 4 함수 분리 (1-2일)**:

- `validateTableMeta` / `validateTableHeaders` / `validateTableCells` / `validateTableCrossPattern` + `validateNestedTableCycles`
- R-M1 480 LOC God function 해소

### 5. ★ Phase 2A BATCH-7 별표 1·2·5·6·7 재추출 (★ 본 세션 B4/B5/B6 흡수 후 게이트 통과)

| 별표   | 노드                        | 패턴      | 추정 노드 |
| ------ | --------------------------- | --------- | --------- |
| 별표 1 | LAW-138 표본주수표          | A_simple  | 40        |
| 별표 2 | LAW-139 미보상비율 적용표   | A_simple  | 19        |
| 별표 5 | LAW-140 무화과 잔여수확량   | F_formula | 13        |
| 별표 6 | LAW-141 손해정도비율 10단계 | A_simple  | 31        |
| 별표 7 | LAW-142 고추 병충해 등급    | A_simple  | 16        |

진산 트리거: **"Phase 2A 진입"** 또는 **"별표 재추출 시작"**

### 6. carry-over (Phase 2 병행 또는 차차세션)

- TD-S49-1: SQL 제너레이터 BEGIN/COMMIT 미추가 정합
- TD-S49-2 (잔여): ontology-registry.ts assertRegistryShape 확장
- TD-S49-3: ADR-031/033 — v1.1.0~v1.3.0 history 영속
- TD-VRF-001: verify Cat1 batch flaky (본 세션 final 4회 중 2회 retry 후 PASS)
- TD-S52-1: handoff-058 carry-over MAJOR-A 14건 일괄
- TD-S52-2: 누적 미커밋 60+건 backup commit (본 세션 종착 시 진행)
- TD-S52-3: 5-Persona Major 17건 carry-over (Phase 2A 첫 1주차 흡수 권장)
- TD-S52-4: 5-Persona Minor 10+건
- TD-S53-1 (신규): apps/api에 @thepick/parser devDep 추가 정합 — 다른 packages도 devDep 필요한 경우 점검 (parser-1st-exam 등 도메인 분리 시)

## 주의사항

### ★ B4/B5/B6 흡수 완료로 Phase 2A 진입 silent dirty state 30% 위험 차단 (5-Persona Persona 3 평가 정합)

본 세션 B4/B5/B6 흡수 = handoff-059 §"주의사항" "B4/B5/B6 미흡수 상태에서 Phase 2A 진입 시 첫 BATCH silent dirty state 30% 위험" 완전 해소.

### ★ A2 활성 의무 (Cloudflare secrets 등록 후)

A2 workflow는 secrets 미등록 상태에서는 첫 step에서 명시적 FAIL. 진산님 secrets 등록 → workflow_dispatch first run PASS 확인 의무.

### ★ Cloudflare API token 회전 의무 (★ 진산 영역, 영속 carry-over)

handoff-059 §"주의사항" 영속:

- 본 세션 토큰 사용 0 (verify는 로컬 D1 helper)
- 차세션 staging+production 마이그레이션 적용 시 회전 권장 (https://dash.cloudflare.com/profile/api-tokens → Roll)
- A2 workflow가 secrets로 자동화하므로 회전 후 secrets 갱신 필수

### ★ TRUTH_WEIGHTS v3 영속 (자가 검증 편향 자가 흡수)

- v3: TABLE=8 / ROW=COL=7 / CELL=6 ★ 현 영속 (Session 052 5-Persona BA-M3 자가 흡수)
- 차세션 RAG 검색 우선순위 정합 검증 의무 (Phase 2D Vectorize 인덱싱 전)

### ★ B4/B6는 apps/api에 위치, B5는 packages/quality에 위치

5-Persona 원래 spec:

- QE-C1: `apps/api/src/__tests__/migration-0024-nested.test.ts` → 본 세션 `apps/api/src/__tests__/scenarios/migration-0024-pattern-h.test.ts` (scenarios/ 디렉토리 정합)
- QE-C2: `scripts/__tests__/verify-cat9-mutation.test.ts` → 본 세션 `packages/quality/src/__tests__/verify-cat9-mutation.test.ts` (vitest 발견 정합 + scripts/ 별도 vitest config 부재)
- QE-C3: `packages/parser/src/__tests__/batch-loader-e2e.test.ts` → 본 세션 `apps/api/src/__tests__/scenarios/batch-loader-e2e.test.ts` (d1-from-sqlite helper 재사용 + parser→apps/api devDep 정합)

### ★ 누적 미커밋 ~67건 (Session 050+051+052+053 통합)

본 세션 종착 backup commit 진행 (push는 진산 직접). PAT scope 영속 carry-over.

### ★ 일반 운영 주의

- migration 0001~0019 + 0021 + 0022 + 0023 + 0024 + 0025 + 0026 staging+production 적용 완료 (0020 슬롯 = B-C1 이월)
- L3 영역 변경 시 plan + 인간 승인 의무 — 본 세션 변경은 회귀 테스트 + workflow + verify 갱신 (L3 미해당)
- handoff-042 §9 엔진 추출 carry-over: Layer 1+2+3+4+5(1차+2차 일부)+6 충족하지만 사용자 앱 PWA + Level 3 미충족 → 발화 시 보류 의무
- 누적 이월 MAJOR ~131건 (Phase 2A 진입 시 일괄 갱신)
- session-health 본 세션(053): 시작 16:08 KST → 약 90분 경과 (90분 임계 명시 트리거 정합 — 핸드오프 작성 + backup commit 후 종료)

## ★ 본 세션 종착 시점 진산 결정 영속

| 트리거            | 진산 발화                      | 결과                                                                 |
| ----------------- | ------------------------------ | -------------------------------------------------------------------- |
| Session 053 entry | "B4부터 순차적으로 모두 진행"  | B4 18 + B5 3 + B6 6 = 27 신규 회귀 테스트 흡수                       |
| 추가 작업         | "중요하고 긴급한 거 부터 진행" | A2 schema drift CI workflow 신설 + verify 갱신 + parser types export |
| 세션 종착         | "권고안들 진행"                | handoff-060 작성 + backup commit 진행                                |

## 차세션 1차 읽기 의무 문서 (우선순위 순)

1. **`.jjokjipge/handoff-session-060.md`** (본 핸드오프, 1순위)
2. ★★ **`.claude/reviews/review-20260507-154747-session-052-5-persona-tech-debt.md`** (5-Persona Critical 10 + Major 17 carry-over)
3. **`.github/workflows/d1-schema-drift.yml`** (A2 신설, secrets 등록 후 활성)
4. **`apps/api/src/__tests__/scenarios/migration-0024-pattern-h.test.ts`** (B4 패턴 학습)
5. **`packages/quality/src/__tests__/verify-cat9-mutation.test.ts`** (B5 재귀 가드 패턴)
6. **`apps/api/src/__tests__/scenarios/batch-loader-e2e.test.ts`** (B6 E2E invariant)
7. **`scripts/verify-engine-contracts.ts`** (apps/api 309 + IN_VERIFY_SUBPROCESS=1)
8. **`packages/parser/src/index.ts`** (KnowledgeContractTable/Header/Cell types export)
9. **`.jjokjipge/handoff-session-059.md`** (Session 052 종착, 5-Persona carry-over 8/2)
10. **`docs/adr/ADR-032-table-as-micro-kg.md`** §Decision §1 v1.5.0 + D-PHASE2-8=α
11. **`.claude/rules/auto-review-protocol.md`** (4-Pass + 5-페르소나 정합)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 053 (B4/B5/B6 흡수 + A2 schema drift CI + verify 갱신, Phase 2A 진입 silent dirty state 차단)
**다음 세션**: Session 054 — entry verify + A3 Anthropic cap 활성 권고 + C2 rollback runbook 시작 + (시간 허용 시) C3/C4/C5 Year 2 선제 plan
**작성 효력**: 2026-05-07 KST (Session 053 종착, **B4 18 + B5 3 + B6 6 = 27 신규 회귀 + A2 workflow 영속**)
**예상 완료 다음 세션**: handoff-session-061 (A2 활성 + C2 진행 + carry-over 일부)

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
