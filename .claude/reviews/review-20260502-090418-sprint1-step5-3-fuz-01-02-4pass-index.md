# Sprint 1 §5.3 FUZ-01 + FUZ-02 — 4-Pass 통합 인덱스

**작성일**: 2026-05-02 ~09:30 KST
**작성자**: Claude (Opus 4.7 1M context) — Session 030
**리뷰 방식**: 독립 에이전트 4개 병렬 (silent-failure-hunter / system-architect / security-engineer / quality-engineer)
**리뷰 범위**: commit 2건 (`2beb282` FUZ-01 + `71a97c9` FUZ-02) + 변경 6파일 + 연관 9파일
**근거 문서**: `.claude/rules/auto-review-protocol.md`

---

## 0. 종합 결과

| Pass        | 에이전트              |  PASS  | CRITICAL | MAJOR  | MINOR  |  N/A  |
| :---------- | :-------------------- | :----: | :------: | :----: | :----: | :---: |
| 1 SURGEON   | silent-failure-hunter |   12   |    2     |   5    |   4    |   0   |
| 2 ARCHITECT | system-architect      |   8    |    1     |   3    |   2    |   2   |
| 3 ADVOCATE  | security-engineer     |   7    |    2     |   6    |   3    |   3   |
| 4 CONTRACT  | quality-engineer      |   13   |    0     |   3    |   4    |   2   |
| **합계**    | —                     | **40** |  **5**   | **17** | **13** | **7** |

**판정**: 수정 필요 — CRITICAL 5건 즉시 흡수 의무.

---

## 1. CRITICAL 흡수 (5건 dedupe + 즉시 의무)

### C-1 (Pass 1) — subprocess counter race / 영구 누수

**증거**: pdf-extractor.ts:319-323. child once exit + child once error 등록 + callback settle 가드가 분리. exit + error 양쪽 fire 또는 detached 시 cross-call 오감산 가능.

**위험**: silent zombie + 영구 +1 누수.

**흡수**: idempotent decrement 적용 (`counted` flag 로컬).

### C-2 (Pass 1 + Pass 3 부분 중복) — XSS regex `\bon\w+\s*=` false positive

**증거**: schema-validator.ts:476. Node 런타임 검증 결과 — option / online / ontology / once 모두 매칭.

**위험**: BATCH 적재 정상 한국어 + 영어 단어 silent rejection. 북극성 (신뢰성 정확성) 위반.

**흡수**: HTML 태그 컨텍스트로 한정 — `/<[a-z][^>]*\bon\w+\s*=/i`.

### C-3 (Pass 2 + Pass 4 중복) — `validateRawClaudeResponse` batch-processor 미통합

**증거**: batch-processor.ts:281-319. parseContractJson 이 직접 JSON.parse 후 validateKnowledgeContract 만 위임. 7검사 우회.

**위험**: FUZ-02 8 vectors 운영 미적용 — silent integration debt. D1 1MB / XSS / Hard Rule 17 / depth 모두 무력.

**흡수**: parseContractJson 진입 전 validateRawClaudeResponse wrapping (또는 내부 위임).

### C-4 (Pass 3) — `readFile(pdfPath)` OOM 우회

**증거**: pdf-extractor.ts:117-119. readFile 가 preflightMaxBytes 적용 전 전체 파일 적재. 문서 (line 42-44) 와 정반대.

**위험**: 공격자 sparse 10GB PDF 업로드 → Node OOM crash. Workers 50 MB sparse 만으로 즉사.

**흡수**: hard ceiling (200 MB) + fs.open + fd.read 부분 read (head + tail).

### C-5 (Pass 3) — `rawSnippet` XSS payload 평문 → Secondary XSS

**증거**: schema-validator.ts:619-625 + errors.ts:83-84. rawSnippet `raw.slice(0, 200)` 가 script 평문 보존.

**위험**: admin-web 모니터링 / Logpush UI 가 sanitize 안 하면 발화 → admin 세션 탈취.

**흡수**: rawSnippet + message 의 매칭 텍스트 HTML escape (< / > / & / " / ').

---

## 2. MAJOR 17건 dedupe (12 unique)

### 2.1 즉시 흡수 (본 4-Pass 흡수 commit) — 5건

|  #  | Pass | 적발                                                                       | 흡수                                             |
| :-: | :--: | :------------------------------------------------------------------------- | :----------------------------------------------- |
|  1  |  1   | preflightPdfChecks 의 stat / readFile raw fs error 가 PdfParseError 미분류 | try/catch 후 PdfParseError PDF_PARSE_FAILED 매핑 |
|  2  |  2   | classifySubprocessError 의 MALFORMED_HEADER 경로가 preflight 하 dead path  | 제거 + 주석 갱신                                 |
|  3  |  2   | DEFAULT_MAX_RESPONSE_SIZE_BYTES 100KB 가 D1 1MB 상수 결합 부재             | D1_TRANSACTION_LIMIT_BYTES 명시 + 도출 비율      |
|  4  |  4   | README metadata 명세 vs 코드 narrowing 3건                                 | README 본문 갱신 (실제 metadata 일치)            |
|  5  |  4   | claude-malformed/README.md §3 예시 import 불일치                           | README §3 갱신                                   |

### 2.2 §5.4 PARTIAL 보강 동시 흡수 — 7건

|  #  |    Pass    | 적발                                                    | 이월 사유                                      |
| :-: | :--------: | :------------------------------------------------------ | :--------------------------------------------- |
|  6  |     1      | /Length 6+ digits Number overflow (24자리 정밀도 손실)  | 자릿수 컷 / BigInt — §5.4                      |
|  7  | 1 + 2 중복 | XSS / Hard Rule 17 / DEPTH 검사 순서 단일 시그널        | multi-classification metadata — §5.4           |
|  8  |   1 + 3    | pipeline.ts caller PdfParseError 분기 없음              | telemetry 적재 (engine_telemetry 통합 시점)    |
|  9  |   1 + 3    | Object.values(EXAM_IDS) substring Year 2 false positive | word boundary regex + Unicode normalize — §5.4 |
| 10  |     3      | pdfPath 절대경로 평문 노출 (info disclosure)            | basename + metadata 절대경로 — §5.4            |
| 11  |     3      | 영어 에러 메시지 — 한국어 graceful 안내 부재            | i18n 키 (Phase 1 후반 일괄)                    |
| 12  |     3      | FUZ-01 zombie 검증 in-process counter 한정              | OS process tracker 추가 — §5.4                 |

---

## 3. MINOR 13건 (보고만)

- Pass 1 Minor 4건 — fixture / errors.ts default / MIN_PDF_BYTES spec 근거 / MAX_DECOMPRESSION_RATIO cutoff 정당성
- Pass 2 Minor 2건 — PDF signature scan 8 byte / Buffer Workers 의존 명시
- Pass 3 Minor 3건 — match vs test+exec 효율 / fixture 04 size 의존 / stderr 500 char ANSI escape
- Pass 4 Minor 4건 — README NO_XREF / 시간 추정 / Vitest counter / 우선순위 명세

---

## 4. 본 4-Pass Devil's Advocate 종합

1. **Pass 1**: subprocess counter cross-call 오감산 (macOS / Alpine 시그널 차이)
2. **Pass 1**: XSS regex 한국어 + 영어 단어 false positive
3. **Pass 2**: validateRawClaudeResponse dead code (batch-processor 미통합)
4. **Pass 3**: BATCH-1 100MB 정상 PDF 도착 → readFile OOM
5. **Pass 4**: 12 테스트 통과 = 운영 안전 거짓 — parseContractJson 직접 호출이 검증층 우회

---

## 5. 본 인덱스의 한계 (정직)

1. CRITICAL 5건 흡수 의무 — §5.3 종료 게이트 진입 차단.
2. MAJOR 12건 dedupe 후 5건 즉시 + 7건 §5.4 이월 — handoff-030 §6 ledger 갱신 의무.
3. 본 4-Pass 는 §5.3 commit 2건 한정 — CHA-01/02/04 본격 구현 commit 별 4-Pass 의무.
4. 테스트 카운트 회귀 — parser 136 → 155 (+19) / batch 238 회귀 0건.

---

## 6. 본 4-Pass 산출물 보고서

| Pass | 보고서                                                                                |
| :--: | :------------------------------------------------------------------------------------ |
|  1   | `.claude/reviews/review-20260502-090418-sprint1-step5-3-fuz-01-02-pass1-surgeon.md`   |
|  2   | `.claude/reviews/review-20260502-090418-sprint1-step5-3-fuz-01-02-pass2-architect.md` |
|  3   | `.claude/reviews/review-20260502-090418-sprint1-step5-3-fuz-01-02-pass3-advocate.md`  |
|  4   | `.claude/reviews/review-20260502-090418-sprint1-step5-3-fuz-01-02-pass4-contract.md`  |

---

**통합 인덱스 작성**: Claude (Opus 4.7 1M context) — Session 030
**리뷰 방식**: 독립 에이전트 4개 병렬 (auto-review-protocol §"규칙 0" 정합)
**다음 단계**: CRITICAL 5건 + MAJOR 5건 즉시 흡수 → 회귀 게이트 → MAJOR 7건 §5.4 ledger → CHA-01/02/04 진입
