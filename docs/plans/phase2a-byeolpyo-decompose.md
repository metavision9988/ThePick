# Phase 2A — 별표 1·2·5·6·7 cell-level 분해 plan + gates

> **세션**: 054 후반부 / 2026-05-08 (Phase 2A 진입 트리거 영속)
> **트리거**: 진산 발화 "2a 진행" → memory `project_batch_load_workflow.md` 자동 진행
> **선행 plan**: `docs/plans/table-processing-phase2-batch-reextract.md` §4 Phase 2A
> **선행 ADR**: ADR-032 Accepted (Session 050)
> **상태**: Plan + 정보 영속. Session 055+ 단계별 적재.

---

## 1. ★ 핵심 사실 영속

- LAW-138~142 5개 노드 = **이미 Session 045에 staging+production 적재 완료** (2026-05-06)
- Phase 2A = LAW 노드 안의 **표 본문을 cell-level로 분해 → table\_\* 4 테이블 신규 INSERT**
- LAW 노드 자체는 UPDATE 금지 (Hard Limit) → 본 작업은 INSERT-only
- table_node_links에 `relation_type='extracted_from'` 으로 표 ↔ LAW 연결만 추가

---

## 2. LAW-138~142 정보 영속 (D1 staging fetch, 2026-05-08)

| LAW ID  | book_page | pdf_page | name (요약)                                   | desc len |
| ------- | --------- | -------- | --------------------------------------------- | -------- |
| LAW-138 | 684       | 691      | <별표1> 품목별 표본주(구간)수 표 — 7개 분류표 | 615      |
| LAW-139 | 688       | 695      | <별표2> 미보상비율 적용표 — 4단계             | 387      |
| LAW-140 | 695       | 702      | <별표5> 무화과 잔여수확량 — 8/9/10월 산식     | 292      |
| LAW-141 | 695       | 702      | <별표6> 손해정도비율 — 10% 단위 10단계        | 328      |
| LAW-142 | 695       | 702      | <별표7> 고추 병충해 등급 — 1·2·3등급          | 219      |

**Description 본문**: D1 fetch 완료, 본 plan §3 적재 단위 입력.

---

## 3. 적재 단위 (5 TBL, ~125 노드 추정 — 본 plan에서 정확화)

### 3.1 별표 1 (LAW-138) — TBL-001 표본주수표

**복잡도**: ★★★ 높음 — 11 sub-tables (7 분류 + 인삼/고추/두릅/참깨녹두 4개)

**선택지**:

- **A**: 단일 TBL-001 (분류 7행 × 4열, 메타만) — plan §4 estimate. 셀당 다중 데이터 손실.
- **B**: 11 TBL (TBL-001~011), 각 분류별 sub-table — 정확. ~+200 노드.
- **C**: 1 TBL-001 + nested_table 패턴-H (각 분류 = nested table) — 패턴-H 발현, 정확.

**권장 = C** (패턴-H 첫 발현 영역, ADR-032 D-PHASE2-7=α 정합). 단, 차세션에서 진산 spot check 의무.

**TBL 정확 분해 (옵션 C)**:

- TBL-001 부모: pattern_type='H_nested', 7 분류 row + 1 데이터 col (= nested_table)
- TBL-002~008: 7 분류별 sub-table (각 행 × 표본주수 4열)
- TBL-009~011: 인삼/고추 등 + 두릅 + 참깨녹두 (3 추가 sub-table)
- 추정: 11 TBL + ~80 TROW + ~40 TCOL + ~120 TCELL = **~250 노드** (plan §4 estimate ~40 보다 +210)

### 3.2 별표 2 (LAW-139) — TBL-012 미보상비율 적용표

**복잡도**: ★ 단순 — A_simple

- TBL-012 (4행 × 4열):
  - 행: 해당없음 / 미흡 / 불량 / 매우불량
  - 열: 비율 / 감자·고추외 조건 / 감자·고추 조건 / 비고
- 추정: 1 TBL + 4 TROW + 4 TCOL + 16 TCELL = **25 노드**

### 3.3 별표 5 (LAW-140) — TBL-013 무화과 잔여수확량

**복잡도**: ★★ 중간 — F_formula 패턴

- TBL-013 (3행 × 2열):
  - 행: 8월 / 9월 / 10월
  - 열: 월 / 산식
  - 셀: F-155/156/157 formula_id FK 정합
- 추정: 1 TBL + 3 TROW + 2 TCOL + 6 TCELL = **12 노드**

### 3.4 별표 6 (LAW-141) — TBL-014 손해정도비율

**복잡도**: ★ 단순 — A_simple

- TBL-014 (10행 × 2열):
  - 행: 1~10% / 11~20% / ... / 91~100% (10단계)
  - 열: 손해정도 구간 / 손해정도비율
- 추정: 1 TBL + 10 TROW + 2 TCOL + 20 TCELL = **33 노드**

### 3.5 별표 7 (LAW-142) — TBL-015 고추 병충해 등급

**복잡도**: ★ 단순 — A_simple

- TBL-015 (3행 × 3열):
  - 행: 1등급 / 2등급 / 3등급
  - 열: 등급 / 인정비율 / 병충해 종류
- 추정: 1 TBL + 3 TROW + 3 TCOL + 9 TCELL = **18 노드**

---

## 4. 누적 추정 (옵션 C 채택 시)

| 별표   | TBL    | 노드 추정 |
| ------ | ------ | --------- |
| 1      | 11     | 250       |
| 2      | 1      | 25        |
| 5      | 1      | 12        |
| 6      | 1      | 33        |
| 7      | 1      | 18        |
| **합** | **15** | **~338**  |

★ 본 추정은 plan §4 estimate (~125 노드) 대비 +210 — 별표 1의 11 sub-table 패턴-H 분해 영향. **진산 spot check 의무** (Session 055 entry).

---

## 5. 단계별 적재 plan (Session 055~058 권고)

| 세션 | 작업                                       | 진입 조건                  | 산출                            |
| ---- | ------------------------------------------ | -------------------------- | ------------------------------- |
| 055  | 별표 2/5/6/7 적재 (단순 4 표)              | 054 종착 + entry verify    | 4 TBL ~88 노드 (staging+prod)   |
| 056  | 별표 1 적재 (★ 패턴-H 11 sub-table)        | 055 종착 + 진산 spot check | 11 TBL ~250 노드 (staging+prod) |
| 057  | Phase 2A 종합 검증 + Vectorize 인덱싱 ($5) | 055+056 종착               | RAG 활성 + verify 갱신          |

★ Session 055 = 단순 4 표 먼저 (옵션 C 패턴-H 부담 분산). Session 056 = 별표 1 패턴-H 시점에 진산 spot check (D-PHASE2-7=α 정합).

---

## 6. Knowledge Contract JSON 구조 영속 (별표 2 example)

```json
{
  "nodes": [],
  "edges": [],
  "formulas": [],
  "constants": [],
  "tables": [
    {
      "id": "TBL-012",
      "source_node_id": "LAW-139",
      "title": "미보상비율 적용표 (4단계)",
      "pattern_type": "A_simple",
      "row_count": 4,
      "col_count": 4,
      "source": "교재 별표2 / book_page=688 / pdf_page=695",
      "book_page": 688,
      "pdf_page": 695,
      "chapter": "별표",
      "section": "별표2",
      "headers": [
        { "id": "TROW-012-01", "axis": "row", "level": 1, "index_pos": 1, "text": "해당없음" },
        { "id": "TROW-012-02", "axis": "row", "level": 1, "index_pos": 2, "text": "미흡" },
        { "id": "TROW-012-03", "axis": "row", "level": 1, "index_pos": 3, "text": "불량" },
        { "id": "TROW-012-04", "axis": "row", "level": 1, "index_pos": 4, "text": "매우불량" },
        { "id": "TCOL-012-01", "axis": "column", "level": 1, "index_pos": 1, "text": "단계" },
        { "id": "TCOL-012-02", "axis": "column", "level": 1, "index_pos": 2, "text": "비율" },
        {
          "id": "TCOL-012-03",
          "axis": "column",
          "level": 1,
          "index_pos": 3,
          "text": "감자·고추외 조건"
        },
        {
          "id": "TCOL-012-04",
          "axis": "column",
          "level": 1,
          "index_pos": 4,
          "text": "감자·고추 조건"
        }
      ],
      "cells": [
        {
          "id": "TCELL-012-01-01",
          "row_id": "TROW-012-01",
          "col_id": "TCOL-012-01",
          "value_text": "해당없음",
          "value_type": "text"
        },
        {
          "id": "TCELL-012-01-02",
          "row_id": "TROW-012-01",
          "col_id": "TCOL-012-02",
          "value_text": "0%",
          "value_type": "text"
        }
        /* ... 16 cells 총 */
      ]
    }
  ]
}
```

→ `validateKnowledgeContract(contract)` PASS → wrangler d1 execute INSERT × N.

---

## 7. ★ Gates (Binary 검증 기준)

각 별표 적재 후 본 gates 모두 PASS 의무 — 한 건이라도 FAIL 시 즉시 차단.

### 7.1 schema-validator (application layer)

- [ ] `validateKnowledgeContract(contract)` returns `valid: true`
- [ ] errors[].length === 0
- [ ] stats.tablesValidated === expected

### 7.2 D1 INSERT (wrangler d1 execute, staging+production)

- [ ] `INSERT INTO table_structures` row 1 (각 TBL 별)
- [ ] `INSERT INTO table_headers` rows = row_count + col_count
- [ ] `INSERT INTO table_cells` rows = row_count × col_count (수치)
- [ ] `INSERT INTO table_node_links` row 1 (relation_type='extracted_from', LAW-XXX → TBL-XXX)
- [ ] CHECK constraint failure 0 (마이그레이션 0021/0023/0024 정합)

### 7.3 verify-engine-contracts.ts

- [ ] 별표 적재 후 verify run1+run2 PASS 일치
- [ ] Cat 9 PASS (table_structures schema 정합)
- [ ] Cat 10 PASS (Drizzle ↔ SQL enum sync)
- [ ] parser regression 179 변경 0
- [ ] apps/api regression 309 변경 0

### 7.4 A2 schema drift CI 영향

- [ ] 다음날 09:00 KST schedule run PASS (staging↔production sqlite_master 일치)
- [ ] 양쪽 env 동시 적재 의무 (한쪽 누락 시 A2 FAIL 정상)

---

## 8. 위험 + 대응 (Reality Anchor)

| 위험                                     | 대응                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| LLM 표 분해 silent miss (~85% 정확도)    | 진산 spot check 의무 (별표 1 패턴-H 시점)                              |
| TBL-001 패턴-H 분해 시 11 sub-table 폭증 | 옵션 C 권장, plan §3.1 진산 결정 영속                                  |
| Vectorize 인덱싱 비용 ~$5                | $200 monthly cap 미활성 carry-over (Session 057 시점 의무)             |
| nested_table_id 자기 참조 차단           | schema-validator NESTED_TABLE_SELF_REFERENCE 정합 (Session 052 CRIT-C) |
| TBL ID 충돌 (Year 2 multi-exam)          | ADR-033 활성화 carry-over (현 시점 안전, 별표9 LAW-143 시점 트리거)    |

---

## 9. 차세션 1차 진입 의무 (Session 055)

1. entry verify run1+run2 PASS 일치 확인
2. 진산 spot check — 옵션 C (패턴-H 별표 1) 채택 여부 결정
3. 단순 4 표 적재 시작 (별표 2/5/6/7) — staging+production 동시
4. 각 별표 INSERT 후 gates §7 모두 PASS 확인
5. handoff-063 영속 + commit + push

---

**작성**: Claude Opus 4.7 1M context (Session 054 후반부)
**다음**: Session 055 entry verify + 단순 4 표 적재 시작.
