# 4-Pass 통합 인덱스 — Step 039 ADR-030 회귀 fix + 마이그레이션 0019 정합

- **리뷰 일자**: 2026-05-03
- **리뷰 모드**: 독립 에이전트 4명 병렬 (Pass 1 Surgeon / Pass 2 Architect / Pass 3 Advocate / Pass 4 Contract)
- **리뷰 범위**: 본 세션(039) 변경 15 파일 + ADR-030 + 마이그레이션 0019 + 연관 helper/fixture
- **Critical 흡수 후 verify**: 1200/1200 PASS / run1 ≡ run2 / overallStatus=PASS
- **판정**: ✅ 완료 가능 (CRITICAL 0건 영속)

---

## 1. Pass 별 산출물

| Pass           | 에이전트              | CRITICAL | MAJOR  | MINOR  |  PASS  |  N/A   | 판정      | 산출물                                                                  |
| :------------- | :-------------------- | :------: | :----: | :----: | :----: | :----: | :-------- | :---------------------------------------------------------------------- |
| 1 Surgeon      | silent-failure-hunter |    1     |   4    |   5    |   8    |   3    | 수정 필요 | [pass1-surgeon.md](review-20260503-step039-adr030-pass1-surgeon.md)     |
| 2 Architect    | system-architect      |    1     |   3    |   3    |   11   |   4    | 수정 필요 | [pass2-architect.md](review-20260503-step039-adr030-pass2-architect.md) |
| 3 Advocate     | security-engineer     |    0     |   2    |   3    | (다수) | (다수) | 통과      | [pass3-advocate.md](review-20260503-step039-adr030-pass3-advocate.md)   |
| 4 Contract     | code-reviewer         |    1     |   1    |   2    | (다수) |   —    | 수정 필요 | [pass4-contract.md](review-20260503-step039-adr030-pass4-contract.md)   |
| **합계 (raw)** |                       |  **3**   | **10** | **13** |        |        |           |                                                                         |
| **dedup 후**   |                       |  **2**   | **8**  | **11** |        |        |           |                                                                         |

---

## 2. CRITICAL 2건 (dedup 후) — 본 세션 흡수 완료

### CRIT-D-1 — SCENARIO_MIGRATIONS dual-schema dormancy (Pass 1 + Pass 2 독립 일치)

**파일**: `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:38-58`

**문제**: `SCENARIO_MIGRATIONS` 배열에 `0019_knowledge_nodes_page_chapter_meta.sql` 누락 → `apps/api/src/__tests__/scenarios.test.ts:825` + `apps/api/src/progress/__tests__/routes.test.ts:51` 의 INSERT 사이트가 0019 트리거를 silently bypass. Test = 0019 미적용 / Production = 0019 적용 = **dual-schema dormancy**.

**원인**: TD-API-001 (Step 036 silent-failure-hunter MAJOR-3) 누적 부채 — `SCENARIO_MIGRATIONS` 수동 배열 vs `createD1FromAllMigrations()` auto-readdir wrapper 분리. 본 세션 verify -17 회귀 fix 후 잠복 폭발.

**흡수**:

- ✅ `d1-from-sqlite.ts:38-58` SCENARIO_MIGRATIONS 에 `'0019_knowledge_nodes_page_chapter_meta.sql'` 추가 + TD-API-001 추적 주석
- ✅ `scenarios.test.ts:820-830` seedKnowledgeNode INSERT 4 컬럼 (book_page=999, pdf_page=999) 추가
- ✅ `progress/__tests__/routes.test.ts:48-56` seedNode INSERT 4 컬럼 추가

### CRIT-D-2 — fixture chapter/section misattribution (Pass 4 단독)

**파일**: `apps/batch/src/fixtures/batch-1-sample-extract.json` + `apps/batch/src/__tests__/loader.test.ts`

**문제**: chapter/section 임의값이 BATCH-1 raw 텍스트 (`docs/batch-load/batch-1-raw-pages-403-434.txt`) 와 misattribute:

- CONCEPT-001 (book_page=396) — raw 텍스트 line 1-195 = 제1장 제3절 영역인데 fixture 는 "제2장" 라벨링
- INV-001 / F-01 / INS-01 (book_page=407-427) — raw 텍스트 line 196-end = **제2장 제2절 (과수작물 손해평가 및 보험금 산정)** 영역인데 fixture 는 "제3절 현지조사 내용" 라벨링
- 챕터 풀 타이틀 truncate ("제2장 농작물재해보험 손해평가" → "제2장 농작물재해보험")

**흡수**: Pass 4 옵션 A (raw 텍스트 + handoff §3 정합 갱신):

- ✅ CONCEPT-001 (book_page=396): "제1장 농업재해보험 손해평가 개관" / "제3절 현지조사 내용"
- ✅ INV-001 / F-01 (book_page=407): "제2장 농작물재해보험 손해평가" / "제2절 과수작물 손해평가 및 보험금 산정"
- ✅ INS-01 (book_page=427): "제2장 농작물재해보험 손해평가" / "제2절 과수작물 손해평가 및 보험금 산정"
- ✅ loader.test.ts minimalContract 의 CONCEPT-001 / F-99 동일 패턴 갱신 (raw 텍스트 정합 주석 포함)

---

## 3. MAJOR 흡수 / 명시 이월

### 본 세션 흡수 1건

**MAJOR-A2-1 (Pass 2 ARCHITECT)**: PWA IndexedDB `apps/web/src/lib/db.ts:18-35` `IKnowledgeNode` interface 4 필드 미반영.

- ✅ 본 세션 흡수: bookPage / pdfPage / chapter / section 4 필드 추가 (NULL 허용 — D1 ALTER 호환). Phase 2 sync engine 활성 시 D1 → IndexedDB mirror 의무 주석 명시.
- 효과: 수험자 "근거 보기" UX 1급 기능 (project_source_citation_requirement 메모리 정합) 차단 위험 사전 해소.

### 명시 이월 (Phase 2 진입 전 또는 BATCH-1 v2 시점)

| ID            | Pass       | 영역                                                               | 흡수 시점                               | 사유                                                                             |
| :------------ | :--------- | :----------------------------------------------------------------- | :-------------------------------------- | :------------------------------------------------------------------------------- |
| MAJOR-A3-M1   | 3 ADVOCATE | 트리거 한국어 메시지 외부 logging stack 호환                       | BATCH-1 v2 / Cloudflare Logpush 도입 시 | 운영자(진산님) 한정 노출, 수험자 경로 0건                                        |
| MAJOR-A3-M2   | 3 ADVOCATE | admin-web NULL chapter/section UI 컨트랙트                         | admin-web /telemetry 본격 작업 시       | UI 변경 본 세션 영역 외                                                          |
| MAJOR-PASS4-1 | 4 CONTRACT | handoff-039 §3 표 자체 raw 텍스트 헤더와 불일치 (제3절/제2절 혼동) | handoff-040 작성 시                     | 본 fixture fix 가 raw 텍스트 정합 oracle 채택했으므로 handoff-040 표 재작성 의무 |

### Pass 1 Surgeon MAJOR 4건 / Pass 2 Architect MAJOR 잔여 — 산출물 본문 참조

각 Pass 본문에 ledger 등록. Sprint 2 master-test-checklist v3 일괄 갱신.

---

## 4. MINOR 11건 (dedup 후) — Phase 2 또는 향후 step 진입 게이트

| ID                         | Pass | 요약                                                                               |
| :------------------------- | :--- | :--------------------------------------------------------------------------------- |
| (Pass 1 Surgeon m-1~m-5)   | 1    | 산출물 본문 참조                                                                   |
| (Pass 2 Architect m-1~m-3) | 2    | 산출물 본문 참조                                                                   |
| MIN-PASS3-m-1              | 3    | chapter/section 길이 캡 부재 (DB 트리거 추가 후보)                                 |
| MIN-PASS3-m-3              | 3    | page_ref vs book_page 통합 표시 컨벤션 미정                                        |
| MIN-PASS4-m-1/2            | 4    | ADR §5 본 세션 vs 다음 세션 swap, fixture line 6 형식 batch-loadmap.md 보다 선반영 |

---

## 5. 검증 산출물

### verify 영속 (CRITICAL 2건 흡수 후)

| 시점                                              | run1               | run2               | run1 ≡ run2 | 파일                                                       |
| :------------------------------------------------ | :----------------- | :----------------- | :---------- | :--------------------------------------------------------- |
| 진입 직후 (회귀 -17)                              | FAIL 1183/1200     | FAIL 1183/1200     | ≡           | sprint1-step5-5-verify-session-039-entry-run{1,2}.json     |
| Postfix (코드/fixture fix)                        | PASS 1200/1200     | PASS 1200/1200     | ≡           | sprint1-step5-5-verify-session-039-postfix-run{1,2}.json   |
| **Final (CRITICAL 2건 흡수 + Pass 2 MAJOR 흡수)** | **PASS 1200/1200** | **PASS 1200/1200** | **≡**       | **sprint1-step5-5-verify-session-039-final-run{1,2}.json** |

### 카테고리별 (Cat 1~8)

| Cat   | observed / required | 상태            |
| :---- | :------------------ | :-------------- |
| 1+2+3 | 1200 / 1200         | ✅ PASS         |
| 4     | 9 / 4               | ✅ PASS         |
| 5A    | 15 / 15             | ✅ PASS         |
| 5B    | SKIP                | ⚪ Phase 2      |
| 6     | 303/251 + 18/18     | ✅ PASS         |
| 7     | 4 boolean PASS      | ✅ PASS         |
| 8     | SKIP                | ⚪ Phase 1 후반 |

자동 게이트 5 PASS / 1 SKIP / 0 FAIL.

---

## 6. Devil's Advocate 기록 (4 Pass 모두 1건+ 의무 정합)

- **Pass 1 Surgeon**: SCENARIO_MIGRATIONS 누락 = "테스트 PASS 인데 production 에서만 fail" 의 정확한 prototype. 회귀 detection 게이트 부재 → Sprint 2 자동 readdir 통합 의무.
- **Pass 2 Architect**: chapter/section 한국어 데이터 직접 저장 → Year 2 영어/일본어 시험 도메인 진입 시 i18n locale 분리 충돌 잠복 (Year 1 단일 정책상 수용이나 trace 의무).
- **Pass 3 Advocate**: 트리거 한국어 메시지가 admin-web 운영자 외 외부 logging stack (Logpush) 으로 누출되면 한국어 토큰 처리 의존성 발생. Cloudflare Logpush 도입 시 escape 검토 의무.
- **Pass 4 Contract**: handoff-039 §3 표 자체가 wrong oracle. fixture 가 표 차용 시 동일 misattribution 복제 위험 — 본 세션 fix 후 handoff-040 표 재작성 의무 명시 이월.

---

## 7. 차세션 진입 의무 (handoff-040 인계)

1. handoff-039 §3 BATCH-1 영역 매핑 표 raw 텍스트 헤더 정합으로 갱신 의무 (MAJOR-PASS4-1)
2. Sprint 2 master-test-checklist v3 + tech-debt.md ledger 갱신 시 본 4-Pass 결과 누적 (CRITICAL 2건 흡수 + MAJOR 본 세션 1건 흡수 + MAJOR 명시 이월 6+건)
3. SCENARIO_MIGRATIONS 자동 readdir 통합 (TD-API-001 영속 흡수, Sprint 2 초기 의무)
4. 진산님 콘솔 영역 — production wrangler d1 migrations apply 0019 (BATCH-1 적재 직전)

---

**리뷰 형식 정합**: auto-review-protocol.md 규칙 0~4 (독립 에이전트 / 전체 범위 / 증거 기반 / 반론 의무 / 분류 및 수정) 모두 준수.

**파일명 정합**: 메모리 `feedback_review_filename_pattern` (review-\* prefix) 정합.
