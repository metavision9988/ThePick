# Handoff — Session 039 → ADR-030 회귀 fix + 4-Pass CRIT 2건 흡수 + dual-schema dormancy 봉합

작성일: 2026-05-03 ~02:50 KST (Session 039 종료)
직전 세션: 038 (BATCH-1 진입 reconnaissance + ADR-030 + 마이그레이션 0019 작성)
본 세션 핵심: **★ verify -17 회귀 detection + 17건 fix + 4-Pass CRIT 2건 흡수 + 1200/1200 영속 회복 ★**

---

## 0. 본 세션(039) 누적 결과

### 0.1 진입 단계 — verify -17 회귀 detection

차세션 진입 직후 verify run1+run2 일관 FAIL (TD-VRF-001 비결정성 아님):

| 영역           | observed/required | 차이    |
| :------------- | :---------------- | :------ |
| @thepick/batch | 314 / 327         | -13     |
| @thepick/api   | 281 / 285         | -4      |
| **모노레포**   | **1183 / 1200**   | **-17** |

**원인 100% 확정**: 직전 세션(038) commit `73426e9` 의 마이그레이션 0019 가 `createD1FromAllMigrations()` auto-readdir wrapper 로 자동 적용 → 기존 fixture/loader INSERT 가 book_page/pdf_page 미주입으로 트리거 ABORT.

**handoff-039 §0.3 누락 사실**: "본 세션 commits 후 verify 영속은 다음 세션 진입 직후 의무" 로 미룸 → 이전 세션 Claude 가 verify 미실행 = -17 회귀 차세션 진입까지 미인지. 4-Pass 리뷰 의무 위반.

### 0.2 본 세션 진행 단계

1. **verify run1+run2 -17 detection** (entry reports 영속)
2. **진산님 보고 + "권고대로 모두 처리" 트리거**
3. **17건 회귀 fix (Phase 1)**:
   - ADR-030 status: Proposed → Accepted (본 세션 첫 commit 후보)
   - `KnowledgeContractNode` 4 필드 + `validateKnowledgeContract` 검증 추가
   - Drizzle `knowledgeNodes` 4 컬럼 + 인덱스 2개 (book_page, chapter)
   - `draft-loader buildNodeInserts` SQL + bind 4 컬럼
4. **테스트 fixture 갱신 (Phase 2)** — batch loader/state-machine + api hard-rule-13 + JSON fixture
5. **pipeline integration + reproducibility-idempotency synthetic contract 갱신** (batch 추가 12건 회귀 detection 후 fix)
6. **parser fixture 갱신** (5건 회귀 — schema-validator/batch-processor/fuz-02/determinism)
7. **verify postfix run1+run2 PASS 1200/1200 영속**
8. **4-Pass 독립 에이전트 4명 병렬 (background)**:
   - Pass 1 Surgeon (silent-failure-hunter): CRITICAL 1 / MAJOR 4 / MINOR 5
   - Pass 2 Architect (system-architect): CRITICAL 1 / MAJOR 3 / MINOR 3
   - Pass 3 Advocate (security-engineer): CRITICAL 0 / MAJOR 2 / MINOR 3
   - Pass 4 Contract (code-reviewer): CRITICAL 1 / MAJOR 1 / MINOR 2
9. **dedup 후 CRITICAL 2건 흡수**:
   - **CRIT-D-1** (Pass 1+2 독립 일치): `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:38-58` SCENARIO_MIGRATIONS 0019 누락 → TD-API-001 dual-schema dormancy 폭발 패턴. 본 세션 봉합 (0019 추가) + Sprint 2 자동 readdir 통합 의무 영속.
   - **CRIT-D-2** (Pass 4): batch-1-sample-extract.json + loader.test.ts chapter/section 임의값이 raw 텍스트 (`docs/batch-load/batch-1-raw-pages-403-434.txt`) 와 misattribute. Pass 4 옵션 A 채택 (raw 텍스트 정합 갱신).
10. **Pass 2 MAJOR-A2-1 흡수**: PWA `apps/web/src/lib/db.ts` IKnowledgeNode 4 필드 추가 (Phase 2 sync engine 활성 시 D1 → IndexedDB mirror 의무 주석 명시).
11. **verify final run1+run2 PASS 1200/1200 영속** (CRIT 2건 + MAJOR 1건 흡수 후).
12. **통합 4-Pass 인덱스 작성** (`.claude/reviews/review-20260503-step039-adr030-index.md`).
13. **WBS §0+§1+§5+§6 갱신** (Step 039 진척 + ledger TD-S39-1~4 신규).
14. **handoff-040 작성** (본 문서, MAJOR-PASS4-1 §3 표 raw 정합 재작성 동시 흡수).

### 0.3 verify 실측 영속 체인

| 시점                                          | run1          | run2          | run1≡run2              | 파일                                                       |
| :-------------------------------------------- | :------------ | :------------ | :--------------------- | :--------------------------------------------------------- |
| Session 038 entry                             | PASS 1200     | PASS 1200     | ≡                      | sprint1-step5-5-verify-session-038-entry-run{1,2}.json     |
| **Session 039 entry**                         | **FAIL 1183** | **FAIL 1183** | **≡ (회귀 detection)** | **sprint1-step5-5-verify-session-039-entry-run{1,2}.json** |
| Session 039 postfix (코드/fixture)            | PASS 1200     | PASS 1200     | ≡                      | sprint1-step5-5-verify-session-039-postfix-run{1,2}.json   |
| **Session 039 final (CRIT 2 + MAJOR 1 흡수)** | **PASS 1200** | **PASS 1200** | **≡**                  | **sprint1-step5-5-verify-session-039-final-run{1,2}.json** |

---

## 1. BATCH-1 진입 진척 (Step 20)

### 1.1 본 세션 완료 (8/8 단계)

| ☐/✅ | 단계                                                                                    | 영속        |
| :--: | :-------------------------------------------------------------------------------------- | :---------- |
|  ✅  | reconnaissance 5건                                                                      | Session 038 |
|  ✅  | pdfplumber p.403~434 32p 텍스트 추출 (v1)                                               | Session 038 |
|  ✅  | 진산님 1차 검수 — Q1/Q2/Q3 결정                                                         | Session 038 |
|  ✅  | ADR-030 + 마이그레이션 0019 작성                                                        | Session 038 |
|  ✅  | **ADR-030 Proposed → Accepted 전환**                                                    | Session 039 |
|  ✅  | **verify -17 회귀 detection + 17건 fix + 4-Pass CRIT 2건 흡수 + Pass 2 MAJOR 1건 흡수** | Session 039 |
|  ✅  | **dual-schema dormancy 봉합 (CRIT-D-1)**                                                | Session 039 |
|  ✅  | **chapter/section misattribution 정정 (CRIT-D-2)**                                      | Session 039 |

### 1.2 다음 세션 의무 (5단계 + 진산님 콘솔 1)

| ☐/✅ | 단계                                                                                               |    분량     |
| :--: | :------------------------------------------------------------------------------------------------- | :---------: |
|  🔴  | 추출 스크립트 v2 작성 (`scripts/extract-batch-pages.py`) — 7가지 의무 모두 반영 (handoff-039 §5.4) |    ~30분    |
|  🔴  | BATCH-1 v2 재추출 + chapter/section 자동 인식 + 그림 페이지 PNG 추출                               |    ~10분    |
|  🔴  | 그림 페이지 Claude multimodal 분석 (옵션 C)                                                        |    ~15분    |
|  🔴  | Knowledge Graph JSON 생성 (60 노드 + 200 엣지, 산식 13개 Golden 기존) — 4 컬럼 채움 의무           |    ~60분    |
|  🔴  | 진산님 2차 검수 + SQL INSERT + 진산님 wrangler d1 적용                                             | 진산님 영역 |

### 1.3 진산님 콘솔 영역 의무 (다음 세션 진입 직전)

| 항목                                  | 의무                                                                                    |
| :------------------------------------ | :-------------------------------------------------------------------------------------- |
| **마이그레이션 0019 production 적용** | `wrangler d1 migrations apply <db-name> --remote` (Knowledge Graph JSON INSERT 전 의무) |
| ADMIN_API_TOKEN secret put            | BATCH-1 적재 직전                                                                       |
| Anthropic console monthly cap $200    | BATCH-1 적재 직전 (메모리 `project_anthropic_cap_pre_install`)                          |
| production migrations staging dry-run | BATCH-1 적재 직전                                                                       |

---

## 2. 진산님 차세션 진입 결정 의무

### 2.1 즉시 의무 (차세션 진입 첫 우선)

**A. verify 진입 직후 영속 (TD-VRF-001 차단)**

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > .claude/reports/sprint1-step5-5-verify-session-040-entry.json
```

연속 2회 실행 후 PASS 일치 확인 의무. **Step 039 fix 가 코드 변경 직후 verify 영속 PASS 인지 차세션 진입 시 재확인 의무 (4-Pass 의무 위반 재발 차단)**.

**B. ADR-030 production 적용 트리거 (진산님 콘솔)**

`wrangler d1 migrations apply <db-name> --remote` 실행. ALTER TABLE × 4 + 트리거 2 + 인덱스 2 (Cloudflare D1 ALTER ADD COLUMN 호환 검증).

### 2.2 다음 세션 결정 트리거

| 트리거                                                 | 진행                                                 |
| :----------------------------------------------------- | :--------------------------------------------------- |
| **"BATCH-1 다음 단계 진행"** ★ 권고                    | 추출 스크립트 v2 + Knowledge Graph JSON 생성 (~2.5h) |
| "마이그레이션 0019 production 적용 완료"               | 진산님 콘솔 wrangler d1 적용 후 다음 세션 진입       |
| "추가 fix 트리거" (Pass 1 잔여 MAJOR / Pass 3 M-1/M-2) | TD-S39-1/2 흡수                                      |

---

## 3. BATCH-1 영역 매핑 표 (★ raw 텍스트 정합 재작성, handoff-039 §3 MAJOR-PASS4-1 흡수)

`docs/batch-load/batch-1-raw-pages-403-434.txt` 의 명시 헤더 정합 (line 66, 196-197, 222-223 cross-check):

| 본문 페이지 | PDF 페이지 | 챕터                                 | 절                                         | 영역                                                                  |
| :---------- | :--------- | :----------------------------------- | :----------------------------------------- | :-------------------------------------------------------------------- |
| p.396~400   | p.403~407  | **제1장 농업재해보험 손해평가 개관** | 제3절 현지조사 내용                        | 손해평가 일반 (단위 / 검증조사 / 전산입력 / 현지조사 절차)            |
| p.401~402   | p.408~409  | **제2장 농작물재해보험 손해평가**    | 제1절 손해평가 기본단계                    | 사고접수 → 조사기관 배정 → 손해평가반 구성 → 5단계 현지조사 절차      |
| p.403~412   | p.410~419  | **제2장 농작물재해보험 손해평가**    | **제2절 과수작물 손해평가 및 보험금 산정** | 적과전 종합위험 (피해사실확인, 적과 전·후 착과수, 유과타박률, 낙엽률) |
| p.413~420   | p.420~427  | **제2장 농작물재해보험 손해평가**    | **제2절 과수작물 손해평가 및 보험금 산정** | 적과 후 손해조사 (착과피해조사, 고사나무조사)                         |
| p.421~427   | p.428~434  | **제2장 농작물재해보험 손해평가**    | **제2절 과수작물 손해평가 및 보험금 산정** | 적과전 5종한정특약 (일소피해, 가을동상해 등 별도 보장)                |

**handoff-039 §3 와의 차이 (MAJOR-PASS4-1 정정)**:

- handoff-039 §3 는 모든 영역을 "제3절 현지조사 내용" 으로 라벨링 → 실제로는 BATCH-1 영역 32p 중 5p만 제1장 제3절, 나머지 27p는 제2장 제2절.
- handoff-039 §3 챕터 풀 타이틀 "제2장 농작물재해보험" 은 raw 텍스트 헤더 "제2장 농작물재해보험 손해평가" 과 비교해 "손해평가" 누락 → 본 표는 풀 타이틀 사용.

---

## 4. 차세션 진입 직후 1차 읽기 (★ 7개)

1. **본 핸드오프** — `.jjokjipge/handoff-session-040.md`
2. **WBS 진척 대시보드** — `.jjokjipge/wbs-quality-progress.md` (§0 + §1 + §5 + §6 갱신, §2 Gantt 다음 세션 갱신 의무)
3. **★ 4-Pass 통합 인덱스** — `.claude/reviews/review-20260503-step039-adr030-index.md`
4. **ADR-030 (Accepted)** — `docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md`
5. **마이그레이션 0019 SQL** — `migrations/0019_knowledge_nodes_page_chapter_meta.sql`
6. **BATCH-1 v1 추출 텍스트** — `docs/batch-load/batch-1-raw-pages-403-434.txt` (다음 세션 v2 재추출 의무)
7. **batch-loadmap.md** — `docs/plans/batch-loadmap.md`

### 4.1 직전 세션 핸드오프 체인

8. `.jjokjipge/handoff-session-039.md` (BATCH-1 진입 reconnaissance + ADR-030 + 마이그레이션 0019)
9. `.jjokjipge/handoff-session-038.md` (verify deterministic + Phase B skip + WBS sync)

---

## 5. 본 세션이 차세션에 넘기는 의무

### 5.1 명시 이월 6건 (Step 039 4-Pass)

| ID                                  | Pass                                               | 영역                                                             | 흡수 시점                                     |
| :---------------------------------- | :------------------------------------------------- | :--------------------------------------------------------------- | :-------------------------------------------- |
| TD-S39-1 (MAJOR-A3-M1)              | 3 ADVOCATE                                         | 트리거 한국어 메시지 외부 logging stack(Logpush) 호환            | BATCH-1 v2 / Cloudflare Logpush 도입 시       |
| TD-S39-2 (MAJOR-A3-M2)              | 3 ADVOCATE                                         | admin-web NULL chapter/section UI 컨트랙트 부재                  | admin-web /telemetry 본격 작업 시             |
| TD-S39-3 (MAJOR-PASS4-1)            | 4 CONTRACT                                         | handoff-039 §3 표 raw 텍스트와 misattribute                      | ✅ 본 handoff-040 §3 raw 정합 재작성으로 흡수 |
| TD-S39-4                            | 3 MINOR                                            | chapter/section 길이 캡 + page_ref vs book_page 통합 표시 컨벤션 | Phase 2 진입 전                               |
| Pass 1+2 잔여 MAJOR (~5건)          | 1+2                                                | Sprint 2 master-test-checklist v3                                | Sprint 2 초기                                 |
| TD-API-001 영속 (자동 readdir 통합) | Step 036 silent-failure-hunter / Step 039 CRIT-D-1 | Sprint 2 초기 (자동 readdir 통합 + array 단일 출처화)            |

### 5.2 누적 이월 MAJOR 83건 (handoff-039 77 + Step 039 신규 6)

영역별 dedup 후 효과적 신규 ~30-35건 추정. master-test-checklist v3 + tech-debt.md ledger Sprint 2 초기 일괄 갱신 의무.

### 5.3 Group B 4건 + Group C 2건 (handoff-039 §5.7 그대로 유효)

Phase 2 진입 직전 의무.

### 5.4 추출 v2 의무 7가지 묶음 (handoff-039 §5.4 그대로 유효)

차세션 첫 동작에서 추출 스크립트 v2 작성 진입. 본 세션 §3 표 (MAJOR-PASS4-1 흡수) 정합 활용.

### 5.5 session-health

본 세션(039) ~50분 도달 (90분 임계 여유). handoff-040 작성 완료. 차세션(040)도 90분/30턴 전 handoff-041 작성 의무.

---

## 6. 주의사항

- **★ 4-Pass 의무 재발 차단** — Session 038 의 verify 미실행 → -17 회귀 차세션 진입까지 미인지 = `.claude/rules/auto-review-protocol.md` 위반. 차세션부터 코드 변경 후 verify 영속 + 4-Pass 즉시 실행 의무 재확인.
- **★ TD-API-001 영속 부채** — SCENARIO_MIGRATIONS 0019 추가는 봉합. 자동 readdir 통합 + array 단일 출처화 Sprint 2 초기 의무.
- **★ ADR-030 production 적용 진산님 콘솔 영역** — `wrangler d1 migrations apply --remote` 실행 + smoke test (knowledge_nodes 4 컬럼 + 트리거 2 + 인덱스 2 등록 확인) 의무.
- **★ chapter/section raw 텍스트 정합 fixture/loader.test 모두 적용 완료** — BATCH-1 v2 재추출 시 자동 인식 결과가 §3 표 정합으로 출력되어야 함. 추출 스크립트 v2 작성 시 §3 표를 oracle 로 사용.
- **누적 이월 MAJOR 83건** — Phase 2 진입 시 일괄 갱신.
- **TD-VRF-001** — 본 세션 batch 1건 fail 후 재실행 327 PASS 재현. Sprint 2 초기 흡수.
- **Year 2 progress API examId 강제** — handoff-039 그대로 유효.
- **production 작업 진산님 콘솔 영역**: 0019 적용 + ADMIN_API_TOKEN secret put + Anthropic cap $200 + staging dry-run.
- **Untracked Guide/3단계리뷰\*.md 2건** — 진산님 자료 (Hard Limit `Guide/` 보존).

---

## 7. 핵심 문서 (1차 읽기 의무, 우선순위 순)

1. `.jjokjipge/handoff-session-040.md` — 본 세션 종합 (본 문서)
2. `.jjokjipge/wbs-quality-progress.md` — Step 039 진척 갱신 (§0 + §1 + §5 + §6)
3. **★ 차세션 첫 의무**: `.claude/reviews/review-20260503-step039-adr030-index.md` (4-Pass 통합 인덱스)
4. `docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md` (Accepted)
5. `migrations/0019_knowledge_nodes_page_chapter_meta.sql` (production 적용 진산님 콘솔)
6. `docs/batch-load/batch-1-raw-pages-403-434.txt` — BATCH-1 v1 추출 (다음 세션 v2 재추출 의무)
7. `docs/plans/batch-loadmap.md` — BATCH-1 ☐ + 검수 체크리스트 3단계

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 039
**다음 세션**: Session 040 — verify 영속 + 진산님 0019 production 적용 + 추출 스크립트 v2 + BATCH-1 v2 재추출 + 그림 multimodal + Knowledge Graph JSON 생성
**작성 효력**: 2026-05-03 ~02:50 KST
**예상 완료**: handoff-041 (Knowledge Graph JSON 검수 + SQL 적재 + batch-loadmap ☐ → ✅ + 8 게이지 실측 첫 보고)
