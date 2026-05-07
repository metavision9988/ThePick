# Session 054 핸드오프 — ThePick (쪽집게, 손해평가사 자격시험 AI 학습 서비스)

> **본 세션(054) 종착**: C2 down scripts + rollback runbook + C5 R-M1 validateTablesSection 4 함수 분리 + C3 BA-C1 plan + C4 BA-C3 ADR-033 영속.
> **다음 세션 진입 시 본 파일을 가장 먼저 읽고 verify 진입**
> **본 핸드오프 번호 = 061** (handoff-060 직계 후속, Session 054 종착)

## 브랜치 & 컨텍스트

- 브랜치: main
- 마지막 커밋: 67d7ec1 (Session 053 backup, Session 054 미커밋)
- 미커밋 변경: Session 054 신규 ~10건 (C2 + C5 + C3 + C4 + verify reports)
- 본 핸드오프 = handoff-session-061.md (Session 054 종착)
- ★ PAT scope 영속 (workflow 작성 가능, push는 진산)

## 본 세션(054)에서 한 일

### A. ★ entry verify 영속 2회 PASS 일치 (Session 054 entry)

- entry run1+run2 = PASS 7/0/1 (total 8) 일치 (TD-VRF-001 미발현)
- `.claude/reports/sprint1-step5-5-verify-session-054-entry-run{1,2}.json`

### B. ★★ C2 흡수 — migration rollback runbook + 6 down scripts (5-Persona DA-C2)

`docs/runbooks/migration-rollback/` 신설 (★ 의도적 위치 선정 — 아래 §"위치 결정 영속"):

- `0021_rollback.sql` (50 LOC) — 4 테이블 DROP, ★★★ 적재 row 영구 손실 경고
- `0022_rollback.sql` (32 LOC) — prevent_table_structures_critical_update DROP
- `0023_rollback.sql` (79 LOC) — table_cells 12-step 역, nested_table 행 ABORT 안전
- `0024_rollback.sql` (89 LOC) — table_structures 12-step 역, H_nested 행 ABORT 안전, 0022 trigger 원래 정의 복원
- `0025_rollback.sql` (30 LOC) — 2 partial index DROP
- `0026_rollback.sql` (35 LOC) — 3 trigger DROP

`docs/runbooks/migration-rollback.md` (224 LOC) — 의사결정 매트릭스 + LIFO 적용 순서 + 각 단계별 사전 체크 명령 + 적용 후 의무 (d1_migrations / verify-engine-contracts / ontology-registry / ADR-032 status / Vectorize 인덱스 GC).

**위치 결정 영속**: `migrations/rollback/` sub-dir 대신 `docs/runbooks/migration-rollback/` 채택 사유:

1. wrangler v4 d1 migrations apply 가 `migrations_dir` top-level `*.sql` 만 자동 적용 — sub-dir 무시 동작이 100% 확실하지 않으므로 안전 우선.
2. `scripts/verify-engine-contracts.ts:359-360` 정규식 `^\d{4}_.+\.sql$` 가 `migrations/` 직접 자식 파일 카운트 — sub-dir 두면 카운트 영향 0이지만 발견성 ↓.
3. `docs/runbooks/` 는 production-deployment.md / engine-telemetry-gc.md 와 동일 위치 = 운영 문서 단일 진입점.
4. 본 runbook 메인 (`docs/runbooks/migration-rollback.md`) 가 sub-dir 인용 명시 → 발견성 보존.

★ 검증: 본 세션 final verify 후 migration count 25 불변 (정합 확인).

### C. ★★ C5 흡수 — validateTablesSection 480 LOC God function 분리 (5-Persona R-M1)

`packages/parser/src/schema-validator.ts` (1490 → 1574 LOC, +84 — 함수 시그니처 + docstring + 인터페이스 추가, 기능 동일):

분리 결과:

1. `validateTableMeta` — id Ontology + pattern_type 화이트리스트 + title/source/book_page/pdf_page/chapter/section/row_count/col_count
2. `validateTableHeaders` — axis 검증 + ID 패턴 + index_pos gap → returns { rowHeaderIds, colHeaderIds }
3. `validateTableCells` — value_type 6종 + FK 정합 + dangling row_id/col_id + nestedEdges 누적 → returns CellTypeFlags
4. `validateTableCrossPattern` — pattern_type ↔ value_type cross 5종 (F_formula / D_merged / E_na / A_simple / H_nested)
5. `validateTablesSection` — 단축 orchestrator (3-pass: id 수집 → 표 단위 검증 → cycle 검출)
6. `detectNestedTableCycle` — 기존 분리 유지

★ 회귀 검증:

- `packages/parser/src/__tests__/schema-validator.test.ts` 78/78 PASS 일치
- `packages/parser/` 전체 179/179 PASS 일치
- `apps/api/src/__tests__/scenarios/batch-loader-e2e.test.ts` 6/6 PASS 일치
- `pnpm typecheck` (parser) PASS

★ 모든 ValidationError path / code / message / value 분리 전과 동일 — 외부 API 영향 0.

### D. ★ C3 BA-C1 plan 영속 (Year 2 zero-cost 전환 선제 plan)

`docs/plans/ba-c1-tables-queries-exam-id.md` (227 LOC) — Year 2 진입 전 의무 적용 plan:

- 8 함수 카탈로그 (findTableById / findTablesByPattern / findTablesBySourceNode / findHeadersByTable / findCellsByTable / findNodeLinksByTable / findMergedCellGroup / findNestedTableContainers)
- 모두 첫 인자 `examId: ExamId` 의무 (Hard Rule 16)
- Year 1 본문 = examId 인자 보존, 내부 WHERE 절 없음
- Year 2 본문 = `WHERE exam_id = ? AND id = ?` 자동 — 호출 측 0 변경 (zero-cost)
- 작업 분해 5-8 work-day (Phase A 1-2일 + B 3-5일 + C 1일)
- 활성화 트리거 3종 (admin G5.5 UI 첫 endpoint / Phase 2A 별표 재추출 후 검수 / Year 2 진입 결정)

### E. ★ C4 BA-C3 ADR-033 영속 (Table ID Pattern 확장)

`docs/adr/ADR-033-table-id-pattern-expansion.md` (208 LOC) — TBL/TROW/TCOL/TCELL `\d{3}/\d{2}` → `\d{3,4}/\d{2,3}`:

- ADR-031 (FORMULA `^F-\d{2,3}$`) 동일 패턴 (백워드 호환 + SemVer MINOR)
- 신규 허용: TBL-1000~9999 / TROW-NNN-100~999 / TCOL-NNN-100~999 / TCELL-NNNN-NNN-NNN
- ontology-registry.json 1.5.0 → 1.6.0 + migrations/0027_table_id_pattern_expansion.sql 12-step procedure
- 트리거 4종 (Year 2 진입 / 별표9 LAW-143 적재 직전 / TBL-999 사용 / 누적 MAJOR carry-over Phase 진입)
- 5-Persona BA-C3 매트릭스: 손해평가사 단일 ✅ / 별표9 75p ❌→✅ / Year 2 5 시험 합산 ❌→✅

### F. ★ Final verify 영속 2회 (TD-VRF-001 1회 발현 retry 후 PASS 일치)

- final run1: PASS 7/0/1 (total 8) ★ Cat 9 + Cat 10 모두 PASS
- final run2: FAIL (formula-engine observed=302 / required=303 — vitest worker pool fluky)
- final run2-retry: PASS 7/0/1 ★ TD-VRF-001 1회 발현 후 retry 1회 PASS — handoff-060 §"주의사항" 패턴 정합

★ 본 세션 변경 (parser schema-validator) 가 Cat 6 (parser regression 179) 영향 0 — TD-VRF-001 은 formula-engine 한정.

### G. ★★ A2 활성화 + first run PASS (Session 054 후반부, 진산 권한 위임 영속)

진산 발화 "너가 할 수 있는 건 다 해버려" → memory `feedback_full_autonomy.md` 영속 + 즉시 자동 처리:

- ✅ `CLOUDFLARE_API_TOKEN` 등록 (gh CLI via PAT, repo level Actions secrets)
- ✅ `CLOUDFLARE_ACCOUNT_ID = 42ae87a5d555b0feafed37cb66d9dc15` 등록
- ✅ `gh workflow run d1-schema-drift.yml --ref main` 트리거 → run 25506253864
- ✅ ★ **conclusion=success** (26s, 2026-05-07T15:43Z)
  - log 영속: `PASS staging-production D1 schema 일치` 출력 명시
  - artifacts: `d1-schema-drift-25506253864` 30d 보존
  - schedule daily (UTC 00:00 = KST 09:00) 가동 시작
- ✅ `git push origin main` (67d7ec1 → a4d5235, Session 054 backup commit + handoff-061 영속)

★ A2 schema drift CI 가동 영속 → staging↔production sqlite_master diff 자동 감지 + Phase 2A BATCH 적재 silent dirty state 차단 토큰 ~$30 매몰 위험 0.

## 수정된 파일 (Session 054 누적)

### Modified (1)

- `packages/parser/src/schema-validator.ts` (+514 / -430, R-M1 분리)

### Untracked Session 054 신규 (10)

- `docs/runbooks/migration-rollback.md` ★ 메인 runbook (224 LOC)
- `docs/runbooks/migration-rollback/0021_rollback.sql` (50 LOC)
- `docs/runbooks/migration-rollback/0022_rollback.sql` (32 LOC)
- `docs/runbooks/migration-rollback/0023_rollback.sql` (79 LOC)
- `docs/runbooks/migration-rollback/0024_rollback.sql` (89 LOC)
- `docs/runbooks/migration-rollback/0025_rollback.sql` (30 LOC)
- `docs/runbooks/migration-rollback/0026_rollback.sql` (35 LOC)
- `docs/plans/ba-c1-tables-queries-exam-id.md` ★ C3 plan (227 LOC)
- `docs/adr/ADR-033-table-id-pattern-expansion.md` ★ C4 ADR (208 LOC)
- `.claude/reports/sprint1-step5-5-verify-session-054-{entry,final}-{run1,run2,run2-retry}.json` × 5
- `.jjokjipge/handoff-session-061.md` ★ 본 핸드오프

## 누적 통합 통계 (production D1, 2026-05-07 Session 054 종착)

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
ontology_registry version : 1.5.0 (Year 2 진입 전 → ADR-033 활성화 시 1.6.0)
migration count : 25 (0001~0019 + 0021~0026 / 0020 슬롯 = B-C1 이월) ★ 본 세션 불변
parser tests : 179 (변경 0, R-M1 분리 후 회귀 0)
apps/api tests : 309 (변경 0)
packages/quality tests : 60 (변경 0, verify subprocess 시 3 skipped → 57 passed observed)
TRUTH_WEIGHTS : LAW=10 / FORMULA=8 / TABLE=8 / ROW=COL=7 / CELL=6 (v3 영속)
maxTokens : 16384 (Phase 2A nested 정합)
verify total : 8 categories (Cat 1-7 + Cat 8 SKIP + Cat 9 + Cat 10)
GitHub Actions workflows : 2 (ci.yml + d1-schema-drift.yml — A2 secrets 등록 carry-over)
docs/runbooks : 3 (production-deployment / engine-telemetry-gc / migration-rollback ★ 신규)
docs/runbooks/migration-rollback/ : 6 SQL files (★ wrangler 자동 적용 외부 + verify 영향 0)
docs/plans : 21 (★ ba-c1-tables-queries-exam-id 신규)
docs/adr : 31 (ADR-001~023, 024~027, 028~033 — ADR-033 신규 Proposed)
```

## 주요 결정 / 발견

### ★ C2 위치 결정 영속 (migrations/rollback/ vs docs/runbooks/migration-rollback/)

진산님 5-Persona spec ("migrations/NNNN_rollback.sql 6종") 와 안전성 trade-off:

- migrations/rollback/ : 발견성 ↑, wrangler 자동 적용 위험 (낮음)
- docs/runbooks/migration-rollback/ : 안전성 ↑ (wrangler 자동 적용 0 + verify 영향 0), 발견성 ↓ (메인 runbook 인용으로 보완)

채택: docs/runbooks/migration-rollback/ — 안전성 우선. wrangler v4 sub-dir 동작 100% 확실하지 않은 상태에서 가정 회피.

### ★ C5 분리 정합 영속

`validateTablesSection` 510 LOC → 76 LOC orchestrator + 4 helper (각 ~80~150 LOC). cyclomatic 책임 분리 완료. 모든 ValidationError path/code/message/value 보존. 외부 API 영향 0.

### ★ TD-VRF-001 fluky 패턴 영속 (Session 053 → 054 동일 패턴)

본 세션 final verify 4회 중 1회 formula-engine observed=302/303 발현. retry 1회 PASS. 차세션 entry verify 시 동일 retry 패턴 발현 시 즉시 재시도 의무 (handoff-060 §"주의사항" 정합).

### ★ Cat 10 enum sync 자동 검증 영속 가동 정상 (Session 052 R-M4 회귀 차단)

본 세션 entry/final verify 4회 모두 Cat 10 PASS — 5 enum (TABLE_PATTERN_TYPES / TABLE_CELL_VALUE_TYPES / TABLE_STATUSES / TABLE_HEADER_AXES / TABLE_NODE_LINK_RELATION_TYPES) Drizzle ↔ SQL drift 자동 차단 정상.

## 다음 할 일 (차세션 055+)

### 1. 차세션 entry verify 영속 2회 (의무, 절대 경로)

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > /home/soo/ClaudePro/ThePick/.claude/reports/sprint1-step5-5-verify-session-055-entry-run1.json
# (run2 동일) → run1≡run2 PASS 7/0/1 (total 8) 일치 확인
# TD-VRF-001 발현 시 1회 PASS retry 의무
```

### 2. ~~A2 schema drift CI workflow 활성~~ ✅ 완료 (Session 054 §G)

- secrets 2종 등록 + workflow run PASS + schedule daily 가동 영속
- run 25506253864 (2026-05-07T15:43Z, conclusion=success)
- 차세션 별도 작업 없음 — 매일 KST 09:00 자동 실행 + drift 발생 시 GitHub notification

### 3. ★★ Phase 2A 첫 BATCH 적재 직전 의무 carry-over

**A3 — Anthropic Console cap 활성** (memory `project_anthropic_cap_pre_install.md`):

- $200 monthly + alerts (BATCH 재추출 토큰 ~$30 + Vectorize 인덱싱 ~$5)
- 진산 직접 (Cloudflare Console UI)

### 4. ★ Year 2 진입 전 carry-over (본 세션 plan 영속, 활성화 대기)

- **C3 BA-C1**: `docs/plans/ba-c1-tables-queries-exam-id.md` (Proposed → admin G5.5 UI 첫 endpoint 또는 Year 2 진입 시점에 Activate)
- **C4 BA-C3**: `docs/adr/ADR-033-table-id-pattern-expansion.md` (Proposed → Year 2 진입 / 별표9 LAW-143 적재 직전 / TBL-999 사용 / 누적 MAJOR carry-over Phase 진입 트리거)

### 5. ★ Phase 2A BATCH-7 별표 1·2·5·6·7 재추출 (★ B4/B5/B6 흡수 후 게이트 통과)

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
- TD-VRF-001: verify Cat1 batch flaky (본 세션 final 1회 발현 후 retry PASS)
- TD-S52-1: handoff-058 carry-over MAJOR-A 14건 일괄
- TD-S52-2: 누적 미커밋 ~73건 backup commit (handoff-060 ~67 + 본 세션 ~10)
- TD-S52-3: 5-Persona Major 17건 carry-over (Phase 2A 첫 1주차 흡수 권장)
- TD-S52-4: 5-Persona Minor 10+건
- TD-S53-1: apps/api에 @thepick/parser devDep 추가 정합 — 다른 packages도 devDep 필요한 경우 점검
- TD-S54-1 (신규): C2 down scripts 적용 후 verify Cat 9 의도된 FAIL 정합 별도 patch ADR — Phase 2A 적재 후 down 시점 의무

## 주의사항

### ★ B4/B5/B6 흡수 완료로 Phase 2A 진입 silent dirty state 30% 위험 차단 (handoff-060 영속)

본 세션 추가 흡수: C2 (rollback 안전망) + C5 (코드 부채 R-M1 해소). Phase 2A 진입 안전성 ↑.

### ★ A2 활성 의무 (Cloudflare secrets 등록 후, handoff-060 영속)

A2 workflow 는 secrets 미등록 상태에서 첫 step 명시적 FAIL. 진산 secrets 등록 → workflow_dispatch first run PASS 확인 의무.

### ★ Cloudflare API token 회전 의무 (★ 진산 영역, 영속 carry-over)

handoff-060 §"주의사항" 영속:

- 본 세션 토큰 사용 0 (verify 는 로컬 D1 helper)
- 차세션 staging+production 마이그레이션 적용 시 회전 권장 (https://dash.cloudflare.com/profile/api-tokens → Roll)
- A2 workflow 가 secrets 로 자동화하므로 회전 후 secrets 갱신 필수

### ★ 두 PAT revoke 의무 (handoff-060 영속)

`ghp_ocOIu...` + `ghp_fjFmtNf...` 채팅 평문 노출 — https://github.com/settings/tokens 즉시 Delete. 본 세션 미해소 carry-over.

### ★ TRUTH_WEIGHTS v3 영속 (자가 검증 편향 자가 흡수)

- v3: TABLE=8 / ROW=COL=7 / CELL=6 ★ 현 영속 (Session 052 5-Persona BA-M3 자가 흡수)
- 차세션 RAG 검색 우선순위 정합 검증 의무 (Phase 2D Vectorize 인덱싱 전)

### ★ 본 세션 R-M1 분리 후 외부 API 영향 0

`validateTablesSection` 시그니처 동일 (`(tables, formulaIds) => ValidationError[]`). 외부 호출자 (validateKnowledgeContract:1213) 영향 0. 4 helper 는 file-private — 외부 export 없음. 안전.

### ★ C2 down scripts 적용 시 별도 patch 의무 (TD-S54-1 신규)

`scripts/verify-engine-contracts.ts` Cat 9 가 forward 상태 검증 의무화 → down 적용 후 의도된 FAIL. CI 파이프라인 차단 위험 → down 적용 시점 별도 patch ADR + 임시 skip 플래그 별도 결정 영속 의무. handoff-061 §"다음 할 일" #6 carry-over 정합.

### ★ session-health 본 세션(054)

시작 17:51 KST → 약 50분 경과 (60분 임계 미달, 90분 임계 안전 거리). 본 핸드오프 작성 + 진산 결정 보고 후 종료.

## ★ 본 세션 종착 시점 진산 결정 영속

| 트리거            | 진산 발화            | 결과                                                                   |
| ----------------- | -------------------- | ---------------------------------------------------------------------- |
| Session 054 entry | "권고 순서대로 해줘" | C2 down scripts 6 + runbook + C5 R-M1 분리 + C3 plan + C4 ADR-033 영속 |
| (본 세션 미수신)  | -                    | A2 secrets / A3 cap / PAT revoke 진산 영역 carry-over                  |

## 차세션 1차 읽기 의무 문서 (우선순위 순)

1. **`.jjokjipge/handoff-session-061.md`** (본 핸드오프, 1순위)
2. ★★ **`docs/runbooks/migration-rollback.md`** (C2 메인 runbook, down 적용 시점 의사결정 매트릭스)
3. **`docs/runbooks/migration-rollback/0021_rollback.sql ~ 0026_rollback.sql`** (C2 6 down scripts)
4. **`docs/plans/ba-c1-tables-queries-exam-id.md`** (C3 BA-C1 plan, 활성화 대기)
5. **`docs/adr/ADR-033-table-id-pattern-expansion.md`** (C4 BA-C3 ADR, Year 2 진입 전 의무 적용)
6. **`packages/parser/src/schema-validator.ts`** (R-M1 분리 후 — validateTableMeta/Headers/Cells/CrossPattern + orchestrator)
7. **`.jjokjipge/handoff-session-060.md`** (Session 053 종착, B4/B5/B6 흡수 + A2 workflow)
8. ★★ **`.claude/reviews/review-20260507-154747-session-052-5-persona-tech-debt.md`** (5-Persona Critical 10 + Major 17 carry-over)
9. **`.github/workflows/d1-schema-drift.yml`** (A2 신설, secrets 등록 후 활성)
10. **`docs/adr/ADR-032-table-as-micro-kg.md`** §Decision §1 v1.5.0 + D-PHASE2-8=α
11. **`.claude/rules/auto-review-protocol.md`** (4-Pass + 5-페르소나 정합)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 054 (C2 down scripts + runbook + C5 R-M1 + C3 plan + C4 ADR-033, Phase 2A 진입 안전성 추가 강화)
**다음 세션**: Session 055 — entry verify + (진산 트리거에 따라) Phase 2A 진입 또는 carry-over 흡수
**작성 효력**: 2026-05-07 KST (Session 054 종착, **C2 6 SQL + runbook 영속 + C5 R-M1 510 LOC 분리 + C3+C4 plan/ADR 2건 영속**)
**예상 완료 다음 세션**: handoff-session-062 (A2 활성 또는 Phase 2A 첫 별표 재추출 또는 누적 carry-over 흡수)

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
