# Handoff — Session 038 → BATCH-1 진입 reconnaissance + ADR-030 + 마이그레이션 0019

작성일: 2026-05-03 ~01:30 KST (Session 038 종료)
직전 세션: 037 (Group A 7/7 완성 + 4-Pass admin-web 0/0 + WBS sync)
본 세션 핵심: **★ BATCH-1 적재 진입 — 진산님 "GO" 트리거 + 페이지 메타 정합화 ADR-030 ★**

---

## 0. 본 세션(038) 누적 결과

### 0.1 commits 체인 (3건 + 예정 1건)

|  #  | Commit        | 단계                                             | 핵심                                                                       |
| :-: | :------------ | :----------------------------------------------- | :------------------------------------------------------------------------- |
|  1  | `14a3968`     | docs(wbs)                                        | verify deterministic + Phase B skip + WBS §1+§2+§3+§4 sync                 |
|  2  | `b96b2c1`     | ci                                               | admin-web + ai-adapter vitest CI 통합 (후속 PR 5 흡수)                     |
|  3  | (commit 예정) | feat(content): ADR-030 + 마이그레이션 0019 + WBS | knowledge_nodes 4 메타 컬럼 + 페이지 표기 정합화 ADR + 0019 슬롯 우선 차지 |

### 0.2 본 세션 진행 단계

1. **세션 진입 4단계 의무 처리** — verify 연속 2회 deterministic PASS (1200/1200) + Phase B skip 결정 + WBS §1/§2/§3/§4 sync + 후속 PR 5 (admin-web + ai-adapter CI 통합) 흡수.
2. **★ 진산님 "GO" 트리거** — "그동안 구현한 것을 실제 적용해보는 것이군. 처음 BATCH-1 적재를 통해 확인보면 알겠군. GO".
3. **BATCH-1 reconnaissance 5건 병렬** — batch-loadmap.md 8단계 워크플로우 + 자료 위치 (`docs/manual/2026년 「농업재해보험·손해평가의 이론과 실무」 이론서_수정본(26.3.31.).pdf`, 835p) + pdfplumber 0.11.9 검증 + ontology-registry v1.1.0 (7 node_types/13 edge_types) + D1 0017/0018 정합.
4. **PDF 페이지 offset 검증** — `pdf.pages[N-1]` = 교재 PDF p.N (단감 산식 PDF p.422 line 564 "1.0115 × 낙엽률" 확인).
5. **BATCH-1 v1 텍스트 추출** — pdfplumber 로 PDF p.403~434 (= 본문 p.396~427) 32p 추출 → `docs/batch-load/batch-1-raw-pages-403-434.txt` (858 lines / 48.5KB / 100% 추출 성공).
6. **진산님 1차 검수 보고 + 페이지 mismatch 발견 (★)** — PDF 페이지 ≠ 본문 페이지 (PDF p.N = 본문 p.(N-7)). batch-loadmap.md / ThePick-분석결과.md 인용은 PDF 기준.
7. **진산님 Q1/Q2/Q3 답변 + 결정 트리거**:
   - **Q1 (페이지 정합화)**: 사용자(수험자) 입장 본문 페이지 + 챕터 타이틀 ("제2장 제1절 + 제목") 병행 의무 → **승인**
   - **Q2 (표 row/column 셀 합침)**: pdfplumber `extract_tables()` 가 row 셀 합침 정확 처리 (단감 표 검증) — column merge 도 고려 의무 → **승인**
   - **Q3 (그림 처리)**: 옵션 C (Claude Code multimodal) 채택 + 한국어 OCR 옵션은 다른 시험 도메인 (전기기사/소방) **후순위 구현 의무** → 메모리 등록
   - 트리거: **"권고 3건 모두 채택 + 자동 진행"**
8. **★ 페이지 표기 정합화 즉시 적용** — 이번 turn 부터 모든 페이지 인용 = "**본문 p.X (PDF p.Y)**" 병행 (Claude 가 진산님 검증 부담 차단).
9. **ADR-030 작성** — `docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md` (Proposed). knowledge_nodes 에 4 신규 컬럼 (book_page / pdf_page / chapter / section) 도입.
10. **마이그레이션 0019 SQL 작성** — `migrations/0019_knowledge_nodes_page_chapter_meta.sql`. ALTER TABLE × 4 + 트리거 2 (book_page + pdf_page NOT NULL) + 인덱스 2 (book_page + chapter).
11. **0019 슬롯 conflict 해결** — handoff-038 §주의사항 명시 conflict (B-C1 + B-C3) → 본 ADR-030 우선 차지 (BATCH-1 진입 직전 차단 게이트), B-C1 = 0020, B-C3 = 0021 슬롯 이월. WBS §5 TD-PHASE2-1 갱신.
12. **메모리 신규 등록 (1건)** — `feedback_other_exams_ocr_deferred.md` (다른 시험 도메인 OCR/Vision 후순위 구현).
13. **WBS §1 BATCH-1 진입 진척 추가** — reconnaissance / 텍스트 추출 / Q1/Q2/Q3 결정 / ADR-030 + 0019 모두 ✅ + 다음 세션 의무 명시.
14. **handoff-039 작성** (본 문서)

### 0.3 verify 실측 (Session 038 진입)

```
RUN 1 ≡ RUN 2 (1200/1200 PASS, EXIT 0)
  shared 50/50 / formula-engine 303/303 / parser 155/155 / quality 57/57
  batch 327/327 / api 285/285 / ai-adapter 13/13 / admin-web 10/10
  Cat 4 E2E 9/4 / Cat 5A 15/15 / Cat 6 303/251 + 18/18 / Cat 7 PASS / Cat 8 SKIP
  자동 게이트: 5 PASS / 1 SKIP / 0 FAIL
TD-VRF-001 미재현 (코드 변경 없는 진입 직후)
산출물: .claude/reports/sprint1-step5-5-verify-session-038-entry-run{1,2}.json
```

본 세션 commits 후 verify 영속은 다음 세션 진입 직후 의무 (TD-VRF-001 패턴 — 변경 직후 첫 실행 비결정성).

---

## 1. BATCH-1 진입 진척 (Step 20)

### 1.1 본 세션 완료 (5/8)

| ☐/✅ | 단계                                                                            | 산출물                                                      |
| :--: | :------------------------------------------------------------------------------ | :---------------------------------------------------------- |
|  ✅  | reconnaissance 5건 (batch-loadmap + ontology + pdfplumber + D1 + 자료)          | 본 세션 in-conversation                                     |
|  ✅  | pdfplumber p.403~434 32p 텍스트 추출 (v1)                                       | `docs/batch-load/batch-1-raw-pages-403-434.txt` (858 lines) |
|  ✅  | 진산님 1차 검수 — Q1/Q2/Q3 결정 (페이지+챕터/표 column merge/Claude multimodal) | 본 세션 in-conversation                                     |
|  ✅  | ADR-030 + 마이그레이션 0019 작성                                                | `docs/adr/ADR-030-*.md` + `migrations/0019_*.sql`           |
|  ✅  | 메모리 등록 (다른 시험 OCR/Vision 후순위)                                       | `feedback_other_exams_ocr_deferred.md`                      |

### 1.2 다음 세션 의무 (3/8 + 진산님 콘솔 1)

| ☐/✅ | 단계                                                                                                                               |    분량     |
| :--: | :--------------------------------------------------------------------------------------------------------------------------------- | :---------: |
|  🔴  | Drizzle ORM `apps/api/src/db/schema.ts` knowledge_nodes 4 컬럼 추가                                                                |    ~10분    |
|  🔴  | `apps/batch/src/loader/draft-loader.ts` INSERT path 4 컬럼 추가                                                                    |    ~20분    |
|  🔴  | 추출 스크립트 v2 작성 (`scripts/extract-batch-pages.py`) — extract_text + extract_tables (column merge) + 챕터/절 메타 + 그림 메타 |    ~30분    |
|  🔴  | BATCH-1 v2 재추출 + chapter/section 자동 인식 + 그림 페이지 PNG 추출                                                               |    ~10분    |
|  🔴  | 그림 페이지 Claude multimodal 분석 (옵션 C)                                                                                        |    ~15분    |
|  🔴  | Knowledge Graph JSON 생성 (60 노드 + 200 엣지, 산식 13개는 Golden 기존) — 4 컬럼 채움 의무                                         |    ~60분    |
|  🔴  | 진산님 2차 검수 (sample 5 노드 + 산식 1)                                                                                           | 진산님 영역 |
|  🔴  | SQL INSERT 스크립트 생성 + 진산님 wrangler d1 적용                                                                                 | 진산님 콘솔 |
|  🔴  | batch-loadmap.md ☐ → ✅ + handoff-040 + 8 게이지 실측 보고                                                                         |    ~15분    |

### 1.3 진산님 콘솔 영역 의무 (다음 세션 진입 직전)

| 항목                                  | 의무                                                                                                  |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------- |
| **마이그레이션 0019 production 적용** | `wrangler d1 migrations apply <db-name> --remote` (진산님 콘솔) — Knowledge Graph JSON INSERT 전 의무 |
| ADMIN_API_TOKEN secret put            | BATCH-1 적재 직전 (handoff-038 §0 후속 PR 1)                                                          |
| Anthropic console monthly cap $200    | BATCH-1 적재 직전 (메모리 `project_anthropic_cap_pre_install`)                                        |
| production migrations staging dry-run | BATCH-1 적재 직전 (handoff-038 §0 후속 PR 1)                                                          |

---

## 2. 진산님 차세션 진입 결정 의무

### 2.1 즉시 의무 (차세션 진입 첫 우선)

**A. ADR-030 승인 (Proposed → Accepted)**

`docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md` 검토 후 status 갱신:

- 현 status: Proposed (Session 038)
- 진산님 승인 시 → Accepted

**B. verify 진입 직후 영속 (TD-VRF-001 차단)**

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > .claude/reports/sprint1-step5-5-verify-session-039-entry.json
```

연속 2회 실행 후 PASS 일치 확인 의무.

### 2.2 다음 세션 결정 트리거

| 트리거                                       | 진행                                                                                 |
| :------------------------------------------- | :----------------------------------------------------------------------------------- |
| **"BATCH-1 다음 단계 진행"**                 | Drizzle schema + draft-loader + 추출 스크립트 v2 + Knowledge Graph JSON 생성 (~2.5h) |
| **"마이그레이션 0019 production 적용 완료"** | 진산님 콘솔 wrangler d1 적용 후 다음 세션 진입 트리거                                |
| **"ADR-030 검토 변경 의견"**                 | ADR-030 일부 수정 후 재검토 (예: 컬럼명 변경, 트리거 강도 조정 등)                   |

---

## 3. 핵심 영역 인덱스 (BATCH-1 32p)

| 본문 페이지 | PDF 페이지 | 챕터 / 절                          | 영역                                                                  |
| :---------- | :--------- | :--------------------------------- | :-------------------------------------------------------------------- |
| p.396~398   | p.403~405  | 제1장 제3절 (이전)                 | 손해평가 일반 (단위 / 검증조사 / 전산입력)                            |
| p.398~403   | p.405~410  | **제1장 제3절**                    | 현지조사 내용 / 품목별 종류 / 본조사·재조사·검증조사                  |
| p.404~412   | p.411~419  | 제3절 / 나. 손해평가 현지조사 방법 | 적과전 종합위험 (피해사실확인, 적과 전·후 착과수, 유과타박률, 낙엽률) |
| p.413~420   | p.420~427  | 제3절 / 적과 후 손해조사           | 착과피해조사 / 고사나무조사                                           |
| p.421~427   | p.428~434  | 제3절 / 적과전 5종한정특약         | 일소피해, 가을동상해 등 (별도 보장)                                   |

---

## 4. 차세션 진입 직후 1차 읽기 (★ 7개)

1. **본 핸드오프** — `.jjokjipge/handoff-session-039.md`
2. **WBS 진척 대시보드** — `.jjokjipge/wbs-quality-progress.md` (BATCH-1 진척 §1 갱신, §2 Gantt 다음 세션 갱신 의무)
3. **★ ADR-030** — `docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md` (Proposed → 진산님 승인)
4. **★ 마이그레이션 0019 SQL** — `migrations/0019_knowledge_nodes_page_chapter_meta.sql`
5. **BATCH-1 v1 추출 텍스트** — `docs/batch-load/batch-1-raw-pages-403-434.txt` (858 lines)
6. **batch-loadmap.md** — `docs/plans/batch-loadmap.md` (BATCH-1 ☐ + 검수 체크리스트 3단계)
7. **메모리 신규** — `~/.claude/projects/-home-soo-ClaudePro-ThePick/memory/feedback_other_exams_ocr_deferred.md`

### 4.1 직전 세션 핸드오프 체인

8. `.jjokjipge/handoff-session-038.md` (verify deterministic + Phase B skip + WBS sync)
9. `.jjokjipge/handoff-session-037.md` (Group A 7/7 완성)

### 4.2 진산님 메모리 정합 (Session 038)

- `project_batch_load_workflow` ✅ "GO" 트리거 발화 → BATCH-1 자동 진행 (8단계 워크플로우 명시)
- `project_source_citation_requirement` ✅ ADR-030 4 컬럼 (book_page + pdf_page + chapter + section)
- `project_v3_final_multi_exam_deferred` ✅ Year 1 9테이블 유지 (컬럼 추가만, 테이블 추가 X)
- `feedback_focus_reliability_not_schedule` ✅ 사용자 UX 개선 (수험자 페이지 인식 정합)
- `feedback_no_granular_decisions` ✅ 권고 3건 일괄 결정 트리거
- `feedback_document_first_workflow` ✅ ADR + 마이그레이션 SQL + 핸드오프 영속
- `feedback_other_exams_ocr_deferred` ✅ 메모리 신규 등록 (다른 시험 OCR/Vision 후순위)

---

## 5. 본 세션이 차세션에 넘기는 의무 (정직)

### 5.1 ADR-030 진산님 검토 + Accepted 전환 의무

`docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md` 의 status 를 Proposed → Accepted 갱신.

### 5.2 마이그레이션 0019 production 적용 (진산님 콘솔)

`wrangler d1 migrations apply <db-name> --remote` 실행. ALTER TABLE × 4 + 트리거 2 + 인덱스 2 (Cloudflare D1 ALTER ADD COLUMN 호환 검증).

### 5.3 Drizzle ORM + draft-loader 갱신

`apps/api/src/db/schema.ts` knowledge_nodes 4 컬럼 추가 + `apps/batch/src/loader/draft-loader.ts` INSERT path 4 컬럼 추가.

### 5.4 추출 스크립트 v2 작성

`scripts/extract-batch-pages.py` 신설:

- `extract_text()` (본문 텍스트)
- `extract_tables()` (row + column 셀 합침 인식 — Q2 진산님 승인 정합)
- 챕터/절 자동 인식 (정규식 또는 첫 5줄 패턴 매칭)
- 그림 메타 (`page.images`) + PNG 영속 (`page.crop().to_image().save()`)
- 영속 형식: 1 페이지당 JSON (text + tables + chapter + section + image_paths + book_page + pdf_page)

### 5.5 그림 페이지 PNG 추출 + Claude multimodal 분석 (옵션 C)

PDF p.421 (= 본문 p.414) Im60 (366×148) "유과타박률 조사요령" + PDF p.423 (= 본문 p.416) Im61 (424×258) "가지별 낙엽 판단" + 추가 그림 페이지 식별 → PNG 영속 → Claude Code 가 다음 turn 에서 Read 로 직접 분석 + Knowledge Graph 노드 의미 반영.

### 5.6 누적 이월 MAJOR 77건 (handoff-038 그대로)

영역별 dedup 후 효과적 신규 ~25-30건 추정. master-test-checklist v3 + tech-debt.md ledger 일괄 갱신 의무 — Sprint 2 초기.

### 5.7 Group B 4건 + Group C 2건 (handoff-038 §5.4-5.5 그대로)

Phase 2 진입 직전 의무.

### 5.8 session-health

본 세션 (038) ~85분 도달 (90분 임계 근접). handoff-039 작성 완료. 다음 세션 (039) 도 90분 / 30턴 전 handoff-040 작성 의무.

### 5.9 column merge 검증 의무 (다음 세션)

진산님 Q2 후속 — pdfplumber `extract_tables()` 가 column merge 도 정확 인식하는지 BATCH-1 영역 외 페이지에서 시험적 검증. 만약 인식 부정확하면 `table_settings={...}` 옵션 조정 의무.

### 5.10 batch-loadmap.md / ThePick-분석결과.md 페이지 인용 정합화

ADR-030 적용 후 페이지 인용을 "**본문 p.X (PDF p.Y)**" 형식으로 갱신 의무. BATCH-2 진입 직전 처리.

---

## 6. 주의사항

- **ADR-030 = Proposed** — 진산님 검토 + Accepted 전환 후 마이그레이션 0019 production 적용 가능. 본 세션은 SQL 파일까지만 작성.
- **0019 슬롯 conflict 해소 ✅** — TD-PHASE2-1 갱신 (B-C1 = 0020, B-C3 = 0021 이월). 향후 마이그레이션 추가 시 0020+ 부터 사용.
- **페이지 표기 정합화 즉시 적용 (★)** — 이번 turn 부터 모든 페이지 인용 = "본문 p.X (PDF p.Y)" 병행. Claude 가 진산님 검증 부담 차단 의무. batch-loadmap.md / ThePick-분석결과.md 정합화는 다음 세션.
- **column merge 검증 의무** — 진산님 Q2 후속 (다음 세션 추출 스크립트 v2 작성 시).
- **그림 처리 옵션 C (Claude multimodal) 채택** — 다른 시험 도메인 OCR/Vision 후순위 (메모리 `feedback_other_exams_ocr_deferred`).
- **누적 이월 MAJOR 77건** — handoff-038 그대로. Phase 2 진입 시 일괄 갱신.
- **TD-API-001 / TD-VRF-001 / TD-PHASE2-2 / TD-PHASE2-3** — handoff-038 §주의사항 그대로 유효.
- **Year 2 progress API examId 강제** — handoff-038 그대로.
- **production 작업 진산님 콘솔 영역**: 0019 적용 + ADMIN_API_TOKEN secret put + Anthropic cap $200 + staging dry-run.
- **Untracked Guide/3단계리뷰\*.md 2건** — 진산님 자료 (Hard Limit `Guide/` 보존).

---

## 7. 핵심 문서 (1차 읽기 의무, 우선순위 순)

1. `.jjokjipge/handoff-session-039.md` — 본 세션 종합 (본 문서)
2. `.jjokjipge/wbs-quality-progress.md` — BATCH-1 §1 진척 갱신 (§2 Gantt 다음 세션 의무)
3. **★ 차세션 첫 의무**: `docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md` (Proposed → 진산님 승인)
4. **★ 차세션 첫 의무**: `migrations/0019_knowledge_nodes_page_chapter_meta.sql` (production 적용 진산님 콘솔)
5. `docs/batch-load/batch-1-raw-pages-403-434.txt` — BATCH-1 v1 추출 (다음 세션 v2 재추출 의무)
6. `docs/plans/batch-loadmap.md` — BATCH-1 ☐ + 검수 체크리스트 3단계
7. `~/.claude/projects/-home-soo-ClaudePro-ThePick/memory/feedback_other_exams_ocr_deferred.md` — 신규 메모리

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 038
**다음 세션**: Session 039 — ADR-030 승인 + 마이그레이션 0019 production 적용 + Drizzle ORM + draft-loader + 추출 스크립트 v2 + BATCH-1 v2 재추출 + 그림 multimodal + Knowledge Graph JSON 생성
**작성 효력**: 2026-05-03 ~01:30 KST
**예상 완료**: handoff-040 (Knowledge Graph JSON 검수 + SQL 적재 + batch-loadmap ☐ → ✅ + 8 게이지 실측 첫 보고)
