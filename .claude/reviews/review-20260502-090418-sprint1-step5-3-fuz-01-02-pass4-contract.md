# Sprint 1 §5.3 FUZ-01 + FUZ-02 — Pass 4 CONTRACT 독립 리뷰

**작성일**: 2026-05-02 09:04 KST
**리뷰어**: Pass 4 CONTRACT (quality-engineer 독립 페르소나) — 코드 작성 컨텍스트 무관
**리뷰 대상 commits**: `2beb282` (FUZ-01) / `71a97c9` (FUZ-02)
**리뷰 범위**: 변경 5파일 (`errors.ts`, `pdf-extractor.ts`, `schema-validator.ts`, `fuz-01-pdf-malicious.test.ts`, `fuz-02-claude-malformed.test.ts`) + 연관 9파일 (fixtures README × 2, fixture data × 13, `index.ts`, `batch-processor.ts`, `pipeline.ts`, handoff-030, decision-2026-05-02, §5.2 4-Pass 통합 인덱스)
**관점**: "기획 문서대로 만들었는가? Silent Pivot 없는가?"

---

## 0. 종합 결과

| 분류        | 카운트 |
| :---------- | :----: |
| ✅ PASS     |   13   |
| 🔴 CRITICAL |   0    |
| 🟠 MAJOR    |   3    |
| 🟢 MINOR    |   4    |
| N/A         |   2    |

**판정**: 🟠 **수정 권고** — CRITICAL 0건이므로 §5.3 진행 가능 / 단 MAJOR 3건은 §5.4 동시 흡수 권고 (auto-review-protocol §"MAJOR phase 종료 전 해결 또는 다음 phase 명시 이월" 정합).

---

## 1. 명세 vs 구현 대조표

### 1.A FUZ-01 — PDF Malicious 5 vectors

| Fixture                  | README §1 분류   | README §2 예상 동작                                                         | 실제 구현 동작                                                                                                                       | 정합 |
| :----------------------- | :--------------- | :-------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- | :--: |
| 01-empty.pdf (0 B)       | EMPTY_INPUT      | stat 후 `bytes.length === 0` → throw + subprocess 미호출                    | `pdf-extractor.ts:102-107` `fileSize === 0` → `EMPTY_INPUT` throw, subprocess 카운터 0 (테스트 검증)                                 |  ✅  |
| 02-header-only.pdf (9 B) | MALFORMED_HEADER | stderr "No /Root" / "Invalid xref" → `MALFORMED_HEADER` 또는 `NO_XREF` 분류 | `pdf-extractor.ts:109-115` `fileSize < MIN_PDF_BYTES (100)` → `MALFORMED_HEADER`. Pre-flight 거부, subprocess 미호출                 |  🟢  |
| 03-compression-bomb.pdf  | COMPRESSION_BOMB | `/Length` vs stream 비율 검사 > 100:1 → throw, subprocess 미호출            | `pdf-extractor.ts:165-176` `lengthRe = /\/Length\s+(\d{6,})/g`, `declared > fileSize * MAX_DECOMPRESSION_RATIO` → `COMPRESSION_BOMB` |  ✅  |
| 04-malformed-xref.pdf    | MALFORMED_XREF   | xref offset > file size → `MALFORMED_XREF`                                  | `pdf-extractor.ts:151-162` `startxref\s+(\d+)\s*\n?\s*%%EOF` 정규식 매칭 → offset > fileSize 거부 (`xrefOffset: 9999999999` ≫ 336)   |  ✅  |
| 05-js-embedded.pdf       | JS_EMBEDDED      | `/JavaScript` keyword scan → throw                                          | `pdf-extractor.ts:142-149` `/\/S\s*\/JavaScript\b/` 또는 `/\/JavaScript\b/` 매칭 → `JS_EMBEDDED`                                     |  ✅  |

**FUZ-01 5/5 정합** (1건 narrowing).

### 1.B FUZ-02 — Claude Malformed 8 vectors

| Fixture                                  | README §1 분류           | README §2 예상 동작                                                             | 실제 구현 동작                                                                                                                         | 정합 |
| :--------------------------------------- | :----------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| 01-empty.json (0 B)                      | EMPTY_RESPONSE           | `JSON.parse('')` SyntaxError → 변환                                             | `schema-validator.ts:597-603` `raw == null \|\| raw.trim().length === 0` → `EMPTY_RESPONSE`. README 의 "변환" 보다 빠른 차단           |  ✅  |
| 02-parse-error.json (66 B)               | PARSE_ERROR              | `KnowledgeContractValidationError('PARSE_ERROR', { lineNumber, columnNumber })` | `schema-validator.ts:649-657` JSON.parse catch → `PARSE_ERROR` throw + `rawSnippet`. **lineNumber/columnNumber 미사용**                |  🟠  |
| 03-xss-payload.json (321 B)              | XSS_PAYLOAD_DETECTED     | `<script>` / `javascript:` / `<img onerror>` 정규식 매칭                        | `schema-validator.ts:473-480` 6개 패턴 (script / javascript: / `\bon\w+\s*=` / iframe / object / embed) → `XSS_PAYLOAD_DETECTED`       |  ✅  |
| 04-missing-required-field.json (255 B)   | MISSING_REQUIRED_FIELD   | `truth_weight` 부재 → `MISSING_REQUIRED_FIELD` + `nodeId` metadata              | `schema-validator.ts:558-565` validateKnowledgeContract → `MISSING_REQUIRED_FIELD`. **`nodeId` metadata 미보존** (path 만 보존)        |  🟢  |
| 05-ontology-unregistered-id.json (463 B) | ONTOLOGY_UNREGISTERED_ID | `isValidNodeId()` 실패 → `ONTOLOGY_UNREGISTERED_ID` + `expectedPattern`         | `schema-validator.ts:543-556` `INVALID_NODE_ID_PATTERN`/`INVALID_NODE_TYPE` → `ONTOLOGY_UNREGISTERED_ID`. **`expectedPattern` 미보존** |  🟢  |
| 06-deeply-nested-100.json (2398 B)       | JSON_DEPTH_EXCEEDED      | depth > 50 → throw + `{ depth: 100, maxAllowed: 50 }`                           | `schema-validator.ts:638-646` `computeMaxJsonDepth(raw)` > 50 → throw + `{ depth, maxAllowed }`. character-level (string 안전)         |  ✅  |
| 07-large-payload.json (123078 B)         | RESPONSE_SIZE_EXCEEDED   | size 측정 → 임계 (예: 100 KB 또는 1 MB) 초과 시 throw                           | `schema-validator.ts:606-613` `Buffer.byteLength` > 100 KB → throw. README §1 "~120 KB → 100 KB" 정합 (123078 > 102400)                |  ✅  |
| 08-hard-rule-17-violation.json (314 B)   | HARD_RULE_17_VIOLATION   | `'son-hae-pyeong-ga-sa'` literal 매칭 → throw                                   | `schema-validator.ts:489, 627-636` `Object.values(EXAM_IDS)` 동적 참조 (Year 2 자동 확장) → `HARD_RULE_17_VIOLATION`                   |  ✅  |

**FUZ-02 5/8 완전 정합 + 3 건 narrowing** (lineNumber/columnNumber 미보존, nodeId / expectedPattern metadata 누락).

---

## 2. CRITICAL 0건

본 §5.3 commit 한정 CONTRACT 위반 CRITICAL 적발 없음.

---

## 3. MAJOR 3건

### MAJOR-1 — `validateRawClaudeResponse` Production Wiring 부재 (Silent Integration Debt)

**증거**:

- `packages/parser/src/index.ts:33` — export 정상
- `packages/parser/src/__tests__/fuz-02-claude-malformed.test.ts:20` — 테스트 호출 1곳
- `apps/`, `packages/` 그 외 production 호출 0건 (`grep -rn "validateRawClaudeResponse"` 결과)
- `packages/parser/src/batch-processor.ts:281-319` — `parseContractJson()` 내부에서 `JSON.parse` 직접 호출 + `validateKnowledgeContract` 만 호출 (ln 381). raw 단계 sanitize / 임계 / Hard Rule 17 / depth 검사 우회.

**명세 위반 종류**: Silent Pivot — handoff-030 §2.A FUZ-02 명세는 "Claude (또는 BATCH 적재 단계 LLM 출력) 의 8 종 변조 응답에 대해 graceful 분류 실패" 검증. 그러나 실제 BATCH 경로 (`processBatch`) 는 `validateRawClaudeResponse` 를 거치지 않으므로, Claude 가 100MB / XSS / Hard Rule 17 / 깊이 100 응답을 보내도 BATCH 적재가 차단되지 않음. **테스트 통과 = 운영 안전 이 아님** (auto-review-protocol §"규칙 3 반론").

특히 README §2.7 "위험 회귀: D1 single transaction 1 MB 한도 초과 시 INSERT 실패 → checkpoint 누락 → recover 시 부분 적재 위험" 의 **위험이 실제 코드 경로에서 차단되지 않음**.

**흡수 권고**: §5.4 PARTIAL 보강 commit 들과 동시 — `batch-processor.ts:378` `parseContractJson(response.content)` 호출 직전에 `validateRawClaudeResponse(response.content)` wrapper 도입 (또는 `parseContractJson` 내부에서 위임).

### MAJOR-2 — README 의 metadata 명세 vs 실제 metadata 보존 narrowing (3건)

**증거**:

| Fixture                     | README §2 명세 metadata                            | 실제 throw metadata                                                                 |
| :-------------------------- | :------------------------------------------------- | :---------------------------------------------------------------------------------- |
| #2 PARSE_ERROR              | `{ lineNumber, columnNumber }` (README ln 48)      | `{ rawSnippet }` (`schema-validator.ts:654-656`)                                    |
| #4 MISSING_REQUIRED_FIELD   | `{ field: 'truth_weight', nodeId }` (README ln 65) | `{ field, allErrors }` (`schema-validator.ts:558-565`) — nodeId 별도 추출 안 함     |
| #5 ONTOLOGY_UNREGISTERED_ID | `{ id, expectedPattern }` (README ln 71)           | `{ id, field, allErrors }` (`schema-validator.ts:546-555`) — expectedPattern 미포함 |

**명세 위반 종류**: 명세 narrowing — debugging trail 항목이 README 명세보다 적음. 운영 시 실패 분석 (예: nodeId 가 어디인지, expectedPattern 이 무엇인지) 가 verbose all-errors 에서 추출 필요 → 실수 가능성.

**흡수 권고**: README 표 (§2 본문) 와 코드 모두 갱신 — 코드 metadata 추가 또는 README 단순화. 4-Pass §5.2 MAJOR-1 (commit message transparency) 와 같은 클래스의 silent narrowing.

### MAJOR-3 — README §3 예시 코드 import path 가 실제와 다른 모듈 (FUZ-02)

**증거**:

- `packages/parser/__fixtures__/claude-malformed/README.md:115` — `import { validateKnowledgeContract } from '../src/schema-validator.js';`
- 실제 fixtures 가 검증하는 함수는 `validateRawClaudeResponse` (raw 응답 → KnowledgeContract). README 예시는 `validateKnowledgeContract` (이미 parsed object) 를 호출 — `01-empty.json` (0 byte) / `02-parse-error.json` (JSON 문법 오류) 의 경우 README 예시 코드는 동작하지 않음 (object 가 아니라 string 입력).

**명세 위반 종류**: README ↔ 실제 구현 lift — README §3 예시 코드를 그대로 따라 한 사람은 작동하지 않는 코드를 받음.

비교: 실제 작동 코드는 `fuz-02-claude-malformed.test.ts:80-89` 의 `validateRawClaudeResponse(raw)` 패턴.

**흡수 권고**: README §3 의 import + 호출을 `validateRawClaudeResponse` 로 갱신. PDF README §3 (line 121: `extractPdf` 호출) 은 정합하므로 본 흡수는 FUZ-02 README 한정.

---

## 4. MINOR 4건

### MINOR-1 — README §1 표 "MALFORMED_HEADER 또는 NO_XREF" 명세가 union 에 NO_XREF 없음

**증거**: `packages/parser/__fixtures__/pdf-malicious/README.md:72` — "PdfParseError('MALFORMED_HEADER') 또는 PdfParseError('NO_XREF') 분류"
`packages/parser/src/errors.ts:20-27` — `PdfErrorClassification` union 에 `NO_XREF` 부재 (있는 것: `MALFORMED_XREF`)
**해석**: README 가 "또는 NO_XREF" 를 명시했으나 코드는 `MALFORMED_HEADER` 만 사용 — narrowing OK 이지만 README 갱신 의무.

### MINOR-2 — handoff-030 §2.A 시간 추정 vs 실 commit 양 부정합 신호

**증거**: handoff-030 §2.A — FUZ-01 0.5d / FUZ-02 1d
실제: FUZ-01 commit `2beb282` 4파일 +475 / FUZ-02 commit `71a97c9` 3파일 +359 — 동일 세션 30분 내 (08:58:31 → 09:03:53) 완료.
**해석**: 시간 추정이 4-Pass 자동화 전제 — 빠른 완료 자체는 양호하지만, 본 commit 단위 4-Pass 의무 (handoff-030 §6.3) 가 적시 수행되었는가는 별도 검증 (현재 본 Pass 4 가 그 검증).

### MINOR-3 — Vitest test counter 정합 검증

**증거**: handoff-030 §0.3 — `parser` test 136 PASS

- FUZ-01 commit message: "136 → 143 PASS (+7)"
- FUZ-02 commit message: "143 → 155 PASS (+12)"
- 실제 `pnpm --filter @thepick/parser test` 출력: `Tests 155 passed (155)` (line 23)
  **해석**: 정합 ✅ — 회귀 0건. (단 FUZ-01 신규 테스트는 7건 합산 — describe 블록 5+1+1=7 / FUZ-02 8+1+1+1+1=12 정합).

### MINOR-4 — schema-validator.ts:539 mapValidationErrorsToClassification 의 우선순위 silent 결정

**증거**: `schema-validator.ts:539-572` — ontology > missing > parse_error 순. 그러나 명세 (handoff-030 / README) 에는 우선순위 명시 없음. fixture #4 `04-missing-required-field` 는 `truth_weight` 만 누락이므로 ontology 검사 통과 → MISSING 분류 도달. 그러나 만약 future fixture 가 ID 패턴 위반 + 필수 필드 누락 동시 발생 시 ontology 분류로만 throw 됨.
**해석**: README §5 fixture 추가 시 의무 (§4 한계 + §2 표 갱신) 에 본 우선순위 명세 추가 권고.

---

## 5. PASS 13건 (실제 확인 증거)

1. ✅ `errors.ts:20-27` — `PdfErrorClassification` 7개 멤버 SCREAMING_SNAKE_CASE 일관 정합
2. ✅ `errors.ts:72-80` — `KnowledgeContractErrorClassification` 8개 멤버 SCREAMING_SNAKE_CASE 일관 정합
3. ✅ `pdf-extractor.ts:50-69` — 명명 상수 (`DEFAULT_TIMEOUT`, `DEFAULT_PREFLIGHT_MAX_BYTES`, `MAX_DECOMPRESSION_RATIO`, `MIN_PDF_BYTES`) — 하드코딩 magic number 0건
4. ✅ `pdf-extractor.ts:241-323` — execFile callback `try/catch` 명시 + 에러 분류 + 빈 catch 0건. `'error'` event handler (ln 320-323) 는 silent 가 아니라 callback 자동 fire 의도 명시 (주석)
5. ✅ `schema-validator.ts:573-666` — `validateRawClaudeResponse` 7단계 검사 순서가 명세 (README §1 표 + JSDoc ln 575-588) 와 정합
6. ✅ `schema-validator.ts:489` — Hard Rule 17 `HARD_RULE_17_LITERALS = Object.values(EXAM_IDS)` — 단일 진실 소스 정합 (production-quality.md §"Hard Rule 17")
7. ✅ `fuz-01-pdf-malicious.test.ts:64-67` — `afterEach` 에서 `getActivePdfSubprocessCount() === 0` invariant 검증 — README §1 "subprocess zombie 0건" 명세 정합
8. ✅ `fuz-02-claude-malformed.test.ts:94-113` — 정상 contract pass 회귀 방어 테스트 존재
9. ✅ 테스트 파일명 `fuz-01-*` / `fuz-02-*` — handoff-030 §2.A 명세 정합
10. ✅ 본 review 파일명 `review-20260502-090418-sprint1-step5-3-fuz-01-02-pass4-contract.md` — `feedback_review_filename_pattern` 정합 (review-\* prefix + step5-3)
11. ✅ `git diff 2beb282 71a97c9` 변경 5파일 + import 1파일 (`index.ts`) — `any` 타입 0건 / `console.log` 0건 / `TODO`/`HACK` 0건 / 빈 catch 0건 / `import *` 0건 (grep 검증)
12. ✅ `pdf-extractor.ts:222` — `extractPdf` 가 `apps/batch/src/pipeline.ts:776` 에서 호출됨 — FUZ-01 wiring 정합
13. ✅ `schema-validator.ts:606` — `Buffer.byteLength(raw, 'utf-8')` 정확한 byte size (string `.length` 가 아닌 UTF-8 byte) — fixture #7 (123078 byte) 정합

---

## 6. N/A 2건

- N/A-1 — 출처 추적성 (북극성): 본 commit 은 validation layer (분류 거부) — fixture data 의 source_page 보존 검증은 §5.4 PRC-01 등 별도. 본 Pass 4 적용 X.
- N/A-2 — i18n 한국어 하드코딩: 에러 message 가 한국어 noise (`{classification} ${message}`) 외부 사용자 노출 X (admin-web / 운영 trail 한정). i18n 의무 X.

---

## 7. Devil's Advocate 반론 (최소 2개 의무 — silent pivot 탐지)

### 반론 1 — "FUZ-02 테스트 12건 통과 = Claude 응답 안전" 가정의 silent integration debt

**시나리오**: 실제 BATCH-1 적재 시 Claude API 가 200 KB XSS 응답 / Hard Rule 17 violation 응답 / depth 100 응답을 반환했다고 가정.

- `apps/batch/src/pipeline.ts` → `processBatch` (`packages/parser/src/batch-processor.ts:323`) → `parseContractJson` (`batch-processor.ts:281`) → `JSON.parse` 직접 호출.
- `validateRawClaudeResponse` 의 1~5단계 검사 (EMPTY / SIZE / XSS / Hard Rule 17 / DEPTH) 가 **호출되지 않음**.
- Claude 가 200 KB 응답을 보내면? → `JSON.parse` 가 처리 → `validateKnowledgeContract` (parsed object) 에서 ontology 검증 통과 가능성 (XSS 는 content 필드, ontology 검증 대상 아님).
- 결과: D1 transaction 에 200 KB content 적재 → checkpoint 부분 실패 가능 / XSS payload 가 `knowledge_nodes.description` 에 그대로 적재.

**탐지**: 본 Pass 4 MAJOR-1 — 단순 export 만으로는 운영 보호 X. **테스트 통과 = 운영 안전이 아님** (auto-review-protocol §"규칙 3 반론").

### 반론 2 — README §2.2 의 "MALFORMED_HEADER 또는 NO_XREF" silent narrowing

**시나리오**: 실제 BATCH 적재 중 PDF 가 다음 형태로 변조되어 도착:

- `%PDF-1.4` signature + 정상 body 1MB + xref 부재 + trailer `%%EOF` 만 존재.
- 현재 코드 `pdf-extractor.ts:130-137` — tail `%%EOF` 검사 통과 → preflight 통과.
- subprocess 호출 → pdfplumber 가 "No xref" 에러.
- `classifySubprocessError` (ln 184-192) — 케이스 처리 보면 "xref" / "cross-reference" → `MALFORMED_XREF` 분류. ✅ — `NO_XREF` 분류 자체가 union 에 없으므로 silent narrowing OK.
- 그러나 README §2.2 line 72 "PdfParseError('MALFORMED_HEADER') 또는 PdfParseError('NO_XREF') 분류" 명세는 거짓 — 실제 분류는 `MALFORMED_XREF` 또는 `MALFORMED_HEADER` 만 가능.

**탐지**: 본 Pass 4 MINOR-1 — 명세 보완 의무. README 갱신 시 §5 fixture 추가 의무 (§5 line 162) 동일 적용.

### 반론 3 (보너스) — fixture 04 의 truth_weight 누락 우선순위 (README §2.4 명세 lift)

**시나리오**: README §2.4 line 65 — "node 검증 단계에서 truth_weight 부재 감지 → MISSING_REQUIRED_FIELD". 그러나 `schema-validator.ts:539-572` `mapValidationErrorsToClassification` 의 우선순위는 ontology > missing. 만약 future fixture 가 ID 패턴 위반 + truth_weight 누락 동시이면 ontology 로 throw — fixture 04 만으로는 발견 못함.

- 본 fixture 가 ID 정상 (`CONCEPT-002` 정합) 이라 missing 분류 도달 — silent OK, 그러나 우선순위 명세 부재.

**탐지**: 본 Pass 4 MINOR-4 — 우선순위 명시 권고.

---

## 8. §5.2 이월 MAJOR 7건 ledger 진행 상태

handoff-030 §6.1 ledger 의 7건은 §5.4 PARTIAL 보강 commit 들과 동시 흡수 의무. 본 §5.3 commit 2건 (`2beb282` / `71a97c9`) 은 §5.4 가 아니므로 흡수 대상 아님. 단 **본 Pass 4 가 ledger 추적 의무** (auto-review-protocol §"규칙 3"):

|  #  | Pass | ID         | 적발 내용                                                         | 본 §5.3 commit 흡수 여부                                   |
| :-: | :--: | :--------- | :---------------------------------------------------------------- | :--------------------------------------------------------- |
|  1  |  2   | A1         | tsconfig path mapping 이 test-helpers production import 차단 부재 | ❌ 미흡수 (변경 0) — §5.4 commit 들에서 처리 의무          |
|  2  |  2   | D1         | Rule 17 예외 nameset 가 `__fixtures__/**` 미포함                  | ❌ 미흡수 (변경 0) — Phase 1 후반                          |
|  3  |  2   | E1         | ADR-028 trigger #4 측정 불가능                                    | ❌ 미흡수 (ADR-028 변경 0)                                 |
|  4  |  3   | A2         | .snyk / dependabot.yml false positive 차단 마커 부재              | ❌ 미흡수 (변경 0) — CI 통합 시점                          |
|  5  |  3   | A4         | Phase 2 진입 트리거 binary 정의 부재                              | ❌ 미흡수 (변경 0) — ROADMAP 별도                          |
|  6  |  4   | MAJOR-1    | commit ba9ad2b message 의 fixtures 위치 변경 transparency 누락    | ❌ 흡수 불가 (이미 commit) — 본 commits message 는 정합 ✅ |
|  7  |  3   | A3 (Minor) | Hard Rule 17 예외 패턴 ESLint config                              | ❌ 미흡수 (변경 0) — A2 와 동일 시점                       |

**이월 ledger 변경 없음** — 본 §5.3 commit 들은 §5.2 이월 MAJOR 와 별도 layer 작업이므로 정합. handoff-030 §6.1 이 진실 소스 유지.

---

## 9. Phase 정합 (Sprint 1 §5.3 진행 상태)

handoff-030 §0.3 / §1 기준:

- **§5.3 NOT-IMPL 5건**: CHA-01 / CHA-02 / CHA-04 + FUZ-01 / FUZ-02
- **본 commit 흡수**: FUZ-01 + FUZ-02 (2/5)
- **잔존 NOT-IMPL**: CHA-01 / CHA-02 / CHA-04 (3건)
- **P0 PASS 진척**:
  - 이전 (handoff-030 §0.3): 3 / 15 PASS (REG-01 / REG-02 / PRC-02)
  - 현재 (본 commit 후): **5 / 15 PASS** (+FUZ-01 / +FUZ-02 가 NOT-IMPL → PASS 승격)
  - 단 본 Pass 4 MAJOR-1 (validateRawClaudeResponse wiring 부재) 가 production 안전 게이트로 평가되면 FUZ-02 PARTIAL 강등 가능 — 진산님 판단 항목.
- **PARTIAL 6건 (CHA-06 / FUZ-04 / PRF-01 / PRF-02 / PRC-01 / REC-01 / REC-02)**: §5.4 작업 잔존.
- **NOT-IMPL 잔존**: CHA-01 / CHA-02 / CHA-04 = **3건** (handoff-030 §1 정합).

**정합** ✅ — `decision-2026-05-02-cha-03-05-p1-reclassification.md` (CHA-03 / CHA-05 P1 이연) 적용 후 **15/15 P0 게이트 체계 유지**.

---

## 10. 본 보고서의 한계 (정직)

1. **본 Pass 4 는 4-Pass 의 1개 Pass** — Pass 1 (Surgeon) / Pass 2 (Architect) / Pass 3 (Advocate) 와 통합 검증 의무. 본 Pass 4 의 MAJOR-1 (`validateRawClaudeResponse` wiring 부재) 은 Pass 2 Architect 영역과 중복 가능 — 통합 인덱스에서 dedupe.
2. **Production wiring 검증 깊이 한계** — `grep -rn "validateRawClaudeResponse"` 에 의존. 동적 import / 재export / 메타프로그래밍 우회 가능성 (낮지만 0 아님).
3. **Fixture 한계 (FUZ-02 README §4.3 정합)** — 실제 Claude API 응답의 모든 변종 커버 X. Sprint 1 종료 후 BATCH-1 실 데이터 기반 추가 fixtures 필요.

---

## 11. 종합 권고 (기획 문서 vs 실제 코드 회귀 종합)

| 권고                                                                                                | 우선순위 | 흡수 시점                |
| :-------------------------------------------------------------------------------------------------- | :------- | :----------------------- |
| MAJOR-1 — `batch-processor.ts:378` `parseContractJson` 진입 전 `validateRawClaudeResponse` wrapping | 🟠 MAJOR | §5.4 PARTIAL 보강 commit |
| MAJOR-2 — README §2 metadata 명세 ↔ 코드 정합 (3건)                                                 | 🟠 MAJOR | §5.4 PARTIAL 보강 commit |
| MAJOR-3 — FUZ-02 README §3 예시 코드 import path 갱신                                               | 🟠 MAJOR | §5.4 PARTIAL 보강 commit |
| MINOR-1 — FUZ-01 README §2.2 "또는 NO_XREF" 표현 갱신                                               | 🟢 MINOR | §5.4 또는 차세션         |
| MINOR-2 — handoff-030 §2.A 시간 추정 후속 검증                                                      | 🟢 MINOR | 본 4-Pass 통합 인덱스    |
| MINOR-3 — Vitest 회귀 카운터 (155) 정합 자동화                                                      | 🟢 MINOR | §5.4 종료 게이트         |
| MINOR-4 — `mapValidationErrorsToClassification` 우선순위 README 명세 추가                           | 🟢 MINOR | §5.4 또는 차세션         |

**Sprint 1 §5.3 진입 차단 사항 0건** — CRITICAL 0건이므로 §5.3 잔존 3건 (CHA-01 / CHA-02 / CHA-04) 진행 가능. MAJOR 3건은 §5.4 commit 들과 동시 흡수 권고 (handoff-030 §3.4 옵션 A 정합).

---

**Pass 4 작성**: Pass 4 CONTRACT 독립 페르소나 — Sprint 1 §5.3 commits `2beb282` + `71a97c9`
**작성일**: 2026-05-02 09:04 KST
**다음 단계**: Pass 1 / 2 / 3 와 통합 인덱스 작성 → §5.3 잔존 3건 진입 또는 본 MAJOR 3건 §5.4 commit 들과 동시 흡수.
