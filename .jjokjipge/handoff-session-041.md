# Handoff — Session 040 → BATCH-1 본격 적재 (Claude 영역 완료, 진산님 콘솔 영역 대기)

작성일: 2026-05-03 KST (Session 040)
직전 세션: 039 (verify -17 회귀 fix + 4-Pass CRIT 2건 + Hook gate v2 + Engine Quality Test 보고서 v1.0)
본 세션 핵심: **★ BATCH-1 본격 적재 — Claude 영역 (1)~(7) 단계 완료, Level 1+2 PASS, 진산님 콘솔 영역 대기 ★**

---

## 0. 본 세션(040) 누적 결과

### 0.1 단계별 진척 (handoff-040 §8.3 10단계)

| ☐/✅/🔴 | 단계                                                                                   | 영속/상태                                                                        |
| :-----: | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
|   ✅    | (1) verify 영속 (run1 PASS / run2 TD-VRF-001 flaky / run3 PASS, Step 039 회귀 0)       | `.claude/reports/sprint1-step5-5-verify-session-040-entry-run{1,2,3}.json`       |
|   ✅    | (3) 추출 스크립트 v2 작성 (7가지 묶음 + bbox clamping + chapter-init 옵션)             | `scripts/extract-batch-pages.py`                                                 |
|   ✅    | (4) BATCH-1 v2 재추출 (32p / chapter-section 자동 인식 / 그림 9 PNG / 분수 7건)        | `docs/batch-load/batch-1-v2/batch-1-extract.json` + 32 page JSON                 |
|   ✅    | (5) 그림 9건 Claude multimodal 분석 (옵션 C)                                           | `docs/batch-load/batch-1-v2/figures-analysis.md`                                 |
|   ✅    | (6) Knowledge Graph JSON v0.1 (draft) — 75 노드 + 133 엣지 + 13 산식 + 5 상수          | `docs/batch-load/batch-1-v2/batch-1-knowledge-graph.json`                        |
|   ✅    | (7-pre) JSON → SQL 변환 + LOCAL D1 dry-run PASS (Level 1+2)                            | `docs/batch-load/batch-1-v2/batch-1-insert.sql` + `scripts/json-to-sql-batch.py` |
|   🔴    | **(2) 마이그레이션 0019 production 적용** — `wrangler d1 migrations apply --remote`    | **★ 진산님 콘솔 영역**                                                           |
|   🔴    | **(8) batch-1-insert.sql production 적용** — `wrangler d1 execute --file=... --remote` | **★ 진산님 콘솔 영역**                                                           |
|   🔴    | (9) Level 3 학습 효과 역검증 (기출 1~2건 자동 풀이 + 혼동 유형 + 누락 페이지)          | **진산님 비유 정합 — BATCH 다 처리 후 시점**                                     |
|   🟡    | (10) batch-loadmap.md ✅/🟡 갱신 + handoff-041 + 8 게이지 실측                         | 본 handoff-041 + batch-loadmap.md 갱신 완료                                      |

### 0.2 Knowledge Graph 통계 (`docs/batch-load/batch-1-v2/batch-1-knowledge-graph.json`)

| 항목      |  영속   | batch-loadmap 추정 | 차이 | 검수 결정                                                                               |
| :-------- | :-----: | :----------------: | :--- | :-------------------------------------------------------------------------------------- |
| nodes     | **75**  |         60         | +15  | 도메인 정합 OK (의미 있는 노드만)                                                       |
| edges     | **133** |        200         | -67  | ★ 진산님 결정: "정확성·신뢰성 기조 유지, 추정/확률 짐작 금지" — hallucination 회피 정책 |
| formulas  |   13    |         13         | ≡    | ✅                                                                                      |
| constants |    5    |         -          | 신규 | 단감/떫은감 인정피해율 계수 + 자기부담비율 + 일소 한도 비율                             |

**노드 분포**: INSURANCE 6 / CROP 4 / FORMULA 13 / INVESTIGATION 15 / CONCEPT 20 / TERM 13 / LAW 4
**4 메타 컬럼**: book_page 75/75 / pdf_page 75/75 / chapter 75/75 / section 74/75 (LAW-004 손해평가요령 의도적 NULL)
**schema-validator**: ✅ PASS / **LOCAL D1 dry-run**: ✅ PASS

### 0.3 본 세션 4-Pass 자동 리뷰 — 보류

본 BATCH-1 적재 단계는 **콘텐츠 적재 (data 영역)** 이지 **코드 영역**이 아니므로, `auto-review-protocol.md` 의 4-Pass 리뷰는 적용되지 않는다 (코드 정합성 / Workers 제약 / Hexagonal 위반 등 N/A).

대신 본 BATCH-1 영역의 **3단계 검증**이 별도 게이트:

- Level 1 표면 (Ontology Lock + schema-validator + graph-integrity) ✅ Claude LOCAL D1 dry-run PASS
- Level 2 내용 (qg2 Golden Test + page_ref + 변수명 매핑) ✅ Claude 자동 PASS
- Level 3 학습 효과 (기출 자동 풀이 + 혼동 유형 + 누락 페이지) 🔴 진산님 BATCH 다 처리 후 시점

본 세션 (1)~(7) 단계의 **코드 변경**은 신규 영역 (`scripts/extract-batch-pages.py`, `scripts/json-to-sql-batch.py`):

- Hook gate (`review-gate.sh` v2) 가 false positive 발생 가능 — 본 세션 종료 전 `mark-review-complete.sh` 명시 호출 의무 (handoff-040 §8 정합)
- 두 스크립트 모두 **build pipeline tool** 영역 (Workers 외부, Python subprocess) — auto-review-protocol Pass 1+2 적용 의미 없음 (CLAUDE.md 정합)

진산님 결정: 본 세션은 콘텐츠 적재 영역으로 4-Pass 면제. 다음 코드 영역 변경 시 다시 적용.

---

## 1. ★ 진산님 차세션 진입 결정 트리거

### 1.1 즉시 의무 (차세션 진입 첫 우선)

**A. verify 영속 (TD-VRF-001 차단 + Step 040 새 코드 회귀 0 재확인)**

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > .claude/reports/sprint1-step5-5-verify-session-041-entry.json
```

연속 2회 실행 + PASS 일치 확인 의무.

**B. ★ 진산님 콘솔 — BATCH-1 production 적재 (2 단계)**

```bash
# (1) 마이그레이션 0019 production 적용 (knowledge_nodes 4 컬럼 + 트리거 2 + 인덱스 2)
wrangler d1 migrations apply <db-name> --remote

# (2) BATCH-1 INSERT (75 nodes + 133 edges + 13 formulas + 5 constants, draft 상태)
wrangler d1 execute <db-name> --file=docs/batch-load/batch-1-v2/batch-1-insert.sql --remote

# (3) 검증
wrangler d1 execute <db-name> --remote --command="SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-1'" # expect 75
wrangler d1 execute <db-name> --remote --command="SELECT COUNT(*) FROM knowledge_edges WHERE id LIKE 'EDGE-BATCH-1-%'" # expect 133
```

### 1.2 차세션 결정 트리거

| 트리거                               | 진행                                                                     |
| :----------------------------------- | :----------------------------------------------------------------------- |
| **"BATCH-1 production 적용 완료"**   | Level 3 학습 효과 역검증 진입 (기출 1~2건 자동 풀이) 또는 BATCH-2 진입   |
| **"BATCH-2 적재"**                   | 종합위험 수확감소 16종 (본문 p.428~493, PDF p.435~500, ~66p) 적재        |
| **"다음 배치 적재" / "이어서 적재"** | 로드맵 순서 자동 (BATCH-2 진입)                                          |
| "Level 3 역검증 진행"                | 본 BATCH-1 만으로 기출 1~2건 풀이 시도 (진산님 비유 — 머릿속 지식 점검)  |
| "엣지 +N 추가 도출"                  | 진산님 명시 트리거 시만 (현 시점은 hallucination 회피 정합으로 -67 보류) |

---

## 2. BATCH-1 적재 핵심 산출물 (1차 읽기 우선순위)

1. **`docs/batch-load/batch-1-v2/batch-1-knowledge-graph.json`** — 75 노드 + 133 엣지 + 13 산식 + 5 상수 (★ status='draft', AI 생성)
2. **`docs/batch-load/batch-1-v2/batch-1-insert.sql`** — 진산님 wrangler d1 적용 대상 SQL (멱등성 INSERT OR IGNORE)
3. **`docs/batch-load/batch-1-v2/figures-analysis.md`** — 그림 9건 multimodal 분석
4. `docs/batch-load/batch-1-v2/batch-1-extract.json` — 32p raw 추출 (chapter/section 자동 인식 + 표 7개 + 분수 7건)
5. `scripts/extract-batch-pages.py` — 추출 v2 (재사용 BATCH-N 모두 적용 가능)
6. `scripts/json-to-sql-batch.py` — JSON → SQL 변환
7. `docs/plans/batch-loadmap.md` — BATCH-1 🟡 갱신 + 본격 적재 진척 영속

---

## 3. 본 세션이 차세션에 넘기는 의무 + 후속 부채

### 3.1 즉시 의무 (진산님 콘솔 영역)

| 의무                               | 영역                       | 차단 영향                              |
| :--------------------------------- | :------------------------- | :------------------------------------- |
| 마이그레이션 0019 production 적용  | 진산님 콘솔                | batch-1-insert.sql 적용 전 의무        |
| batch-1-insert.sql production 적용 | 진산님 콘솔                | BATCH-2 진입 전 의무 (3단계 검증 의무) |
| 검증 SELECT COUNT(\*) 75/133 확인  | 진산님 콘솔 또는 admin-web | 적용 성공 확인                         |

### 3.2 후속 부채 영속

**TD-S40-1**: `packages/formula-engine/src/formulas/batch1-definitions.ts` pageRef 3건 (F-03 'p.409' / F-06 'p.424' / F-07 'p.424') ADR-030 이전 정합 X. raw text cross-check 결과:

- F-03 정의 = book_p409 (pdf_p416), 예시 = book_p410 (pdf_p417)
- F-06 단감 인정피해율 산식 = book_p415 (pdf_p422)
- F-07 떫은감 인정피해율 산식 = book_p415 (pdf_p422)
- knowledge_graph 의 book_page/pdf_page 정확. formula-engine 영역 정정 후속 step.
- 본 BATCH-1 적재 영향 0 (knowledge_graph 정합 oracle).

**TD-S40-2**: handoff-040 §3 oracle 표 misattribute 1건 — book_p396~397 라벨링이 "제3절" 이지만 실제 raw text = "제2절 손해평가 체계" forward-fill (제3절 헤더는 book_p398 부터). 본 handoff-041 §4 정정.

**TD-S40-3**: 엣지 -67건 (133 vs batch-loadmap 추정 200). 진산님 결정 "정확성·신뢰성 기조 유지" — 본 시점 보류. BATCH-N 적재 누적 시 cross-reference 자연 증가 영역.

**누적 이월 MAJOR 83건** (handoff-040 그대로) + Step 040 신규 부채 3건 = **86건 누적**. Sprint 2 master-test-checklist v3 일괄 갱신 의무.

### 3.3 BATCH-1 진산님 비유 정합

진산님 명시 (본 세션):

> "직접 검수를 하려해도 사실 쉽지가 않군 .. 맞겠지? 너가 정확히 분석해서 넣었으리라 믿어 .. 이것을 처리하는 엔진 개발에 공들인 만큼 믿고 가야지 만약 문제가 있다면 해결하기도 쉽지 않을 테고 .. batch 처리를 다하고 실제 암기나 연습문제등을 통해 확인이 가능할 듯 해.."

→ **Level 3 학습 효과 역검증** = 모든 BATCH 처리 후 (~10-12 세션 누적 추정) 학습자 관점에서 기출/암기/연습문제 풀이 시 정확성 확인. 본 BATCH-1 단독 시점에는 Level 1+2 통과로 충분.

→ 본 세션 정확성 책임은 **knowledge_graph 의 raw text oracle 정합** 으로 담보:

- chapter/section 자동 인식 결과 = handoff-040 §3 표 정정안 (book_p398 부터 제3절 detect)
- FORMULA 노드 page_ref = raw text 매칭 (F-03 100/550, F-06 1.0115, F-07 0.9662 모두 raw 매칭)
- 그림 9건 = pdf 의 모든 image 메타 추출 + multimodal 의미 분석
- 분수 7건 = raw text regex 매칭

---

## 4. ★ BATCH-1 영역 매핑 표 정정 (handoff-040 §3 → §4 정합 갱신)

handoff-040 §3 표 misattribute 1건 (TD-S40-2) 정정 — `docs/batch-load/batch-1-v2/batch-1-extract.json` 자동 인식 결과 oracle:

| 본문 페이지 | PDF 페이지 | 챕터                                       | 절                                                  | 영역 / 비고                                                              |
| :---------- | :--------- | :----------------------------------------- | :-------------------------------------------------- | :----------------------------------------------------------------------- |
| p.396~397   | p.403~404  | **제1장 농업재해보험 손해평가 개관**       | **제2절 손해평가 체계 (forward-fill)**              | "라./바. 현지조사 실시" sub-section. 제3절 헤더 book_p398 부터.          |
| p.398~400   | p.405~407  | **제1장 농업재해보험 손해평가 개관**       | **제3절 현지조사 내용 (detect)**                    | 손해평가 일반 (단위 / 검증조사 / 전산입력 / 현지조사 절차)               |
| p.401~402   | p.408~409  | **제2장 농작물재해보험 손해평가 (detect)** | **제1절 손해평가 기본단계 (detect)**                | 사고접수 → 조사기관 배정 → 손해평가반 구성 → 5단계 절차 (그림 #1 #2)     |
| p.403~412   | p.410~419  | **제2장 농작물재해보험 손해평가**          | **제2절 과수작물 손해평가 및 보험금 산정 (detect)** | 적과전 종합위험 II (피해사실확인, 적과 전·후 착과수, 유과타박률, 낙엽률) |
| p.413~420   | p.420~427  | **제2장 농작물재해보험 손해평가**          | **제2절 과수작물 손해평가 및 보험금 산정**          | 적과 후 손해조사 (착과피해, 고사나무, 단감/떫은감 인정피해율)            |
| p.421~427   | p.428~434  | **제2장 농작물재해보험 손해평가**          | **제2절 과수작물 손해평가 및 보험금 산정**          | 적과전 5종한정특약 (일소피해, 가을동상해 등 별도 보장)                   |

**handoff-040 §3 차이**:

- handoff-040 §3 = book_p396~400 모두 "제3절 현지조사 내용" → 실제 396~397 = 제2절 forward-fill (raw text 헤더 부재).
- handoff-040 §3 chapter "제2장 농작물재해보험" → raw text "제2장 농작물재해보험 손해평가" 풀 타이틀.
- ★ silent assumption 해결 ✅: handoff-040 §8.4 "제1장 풀 타이틀" — book_p390 cross-check 결과 "제1장 농업재해보험 손해평가 개관" 100% 확정.

---

## 5. 본 세션 verify 영속 체인

| 시점                  | run1          | run2                                | run3          | run1≡run3 | 파일                                                     |
| :-------------------- | :------------ | :---------------------------------- | :------------ | :-------- | :------------------------------------------------------- |
| Session 040 entry     | PASS 1200     | FAIL 1199 (batch 326/327 flaky)     | PASS 1200     | ≡         | sprint1-step5-5-verify-session-040-entry-run{1,2,3}.json |
| **Session 041 entry** | **PASS 1200** | **FAIL 1199 (batch 326/327 flaky)** | **PASS 1200** | **≡**     | sprint1-step5-5-verify-session-041-entry-run{1,2,3}.json |

**판정**: TD-VRF-001 정확 재현 (handoff-040 §6 명시 부채). Step 039 ADR-030 fix 진짜 회귀 0건 확정.

**Session 041 entry 영속 (2026-05-03)**: run1+run2+run3 패턴 Session 040 과 100% 동일. TD-VRF-001 결정성 부채 영속 (Sprint 2 초기 흡수 의무). Step 040 신설 코드 영역 (`scripts/extract-batch-pages.py` + `scripts/json-to-sql-batch.py`) 은 Workers 외부 build pipeline tool — verify-engine-contracts 적용 X (정합).

---

## 6. 주의사항

- **★ Knowledge Graph JSON status='draft' 강제**: AI 생성 데이터 정합 (Hard Rule 13 + 0018 트리거). 진산님 검수 후 status_transitions UPDATE 로 review/approved 전이 (state-machine.ts).
- **★ 마이그레이션 0019 적용 전 batch-1-insert.sql 적용 시 ABORT**: book_page/pdf_page 트리거 0019에서 정의됨. 진산님 콘솔 영역 1차 의무.
- **★ 멱등성 INSERT OR IGNORE**: SQL 재실행 시 충돌 없음 (PK 충돌 시 skip). formulas 13건은 기존 등록 row 보존.
- **★ Level 3 학습 효과 역검증 미완** = "BATCH-1 적재 완료" 미선언. 본 시점 = "BATCH-1 진산님 콘솔 적용 직전" (Level 1+2 통과).
- **★ batch1-definitions.ts pageRef TD-S40-1**: knowledge_graph oracle 정합. formula-engine 영역 후속 정정 (BATCH-1 적재 영향 0).
- **★ 엣지 133 vs 200 차이**: 진산님 결정 "정확성 기조 유지" 정합. 본 시점 보류.
- **누적 이월 MAJOR 86건** (Step 040 신규 3건 추가). Phase 2 진입 시 일괄 갱신.
- **TD-VRF-001 영속** — Sprint 2 초기 흡수 의무.
- **Hook gate v2 false positive 0건 확인 의무**: 본 세션 종료 전 `bash ~/.claude/hooks/mark-review-complete.sh` 명시 호출.
- **session-health 본 세션** ~25-30턴 도달 (90분 임계 근접 미도달, 임계 여유). 차세션(041) 도 90분/30턴 전 handoff-042 작성 의무.
- **Untracked Guide/3단계리뷰\*.md 2건** — 진산님 자료 (Hard Limit `Guide/` 보존).

---

## 7. 핵심 문서 (1차 읽기 의무, 우선순위 순)

1. **본 핸드오프** — `.jjokjipge/handoff-session-041.md`
2. **★ Knowledge Graph JSON** — `docs/batch-load/batch-1-v2/batch-1-knowledge-graph.json`
3. **★ batch-1-insert.sql** — `docs/batch-load/batch-1-v2/batch-1-insert.sql` (진산님 콘솔 적용)
4. `docs/batch-load/batch-1-v2/figures-analysis.md` — 그림 9건 multimodal 분석
5. `docs/plans/batch-loadmap.md` — BATCH-1 🟡 + 다음 BATCH 진입 (BATCH-2 본문 p.428~493)
6. `migrations/0019_knowledge_nodes_page_chapter_meta.sql` — 진산님 콘솔 적용 1차 의무
7. `scripts/extract-batch-pages.py` + `scripts/json-to-sql-batch.py` — BATCH-N 재사용
8. `docs/reports/engine-quality-test-completion-v1.0-20260503.md` — 본 BATCH-1 진입 게이트 영속
9. `.jjokjipge/handoff-session-040.md` — 직전 세션 (Engine Quality Test 완료 + Hook gate v2)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 040
**다음 세션**: Session 041 — verify 영속 + 진산님 콘솔 (0019 + batch-1-insert.sql 적용) + BATCH-2 진입 또는 Level 3 역검증
**작성 효력**: 2026-05-03 KST
**예상 완료**: handoff-042 (BATCH-2 본문 p.428~493 적재 완료 또는 Level 3 역검증 영속)
