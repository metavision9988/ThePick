# Pass 2 ARCHITECT — Sprint 1 §5.3 FUZ-01 + FUZ-02 독립 리뷰

**리뷰 일시**: 2026-05-02 09:04:18 KST
**리뷰 대상 commits**:

- `2beb282` feat(parser): FUZ-01 — pdf-extractor pre-flight 5종 분류 거부
- `71a97c9` feat(parser): FUZ-02 — schema-validator raw 응답 8종 분류 거부

**리뷰 방식**: 독립 서브에이전트 (Pass 2 ARCHITECT 단독, top-down 연계 정합성 관점)
**관점**: "이 코드가 다른 모듈과 만나면 터지는가?"

**리뷰 범위**:

- 변경 파일 6개:
  - `packages/parser/src/errors.ts` (신규)
  - `packages/parser/src/pdf-extractor.ts` (수정)
  - `packages/parser/src/schema-validator.ts` (수정)
  - `packages/parser/src/index.ts` (수정)
  - `packages/parser/src/__tests__/fuz-01-pdf-malicious.test.ts` (신규)
  - `packages/parser/src/__tests__/fuz-02-claude-malformed.test.ts` (신규)
- 연관 파일 8개:
  - `apps/batch/src/pipeline.ts` (extractPdf consumer line 776)
  - `packages/parser/src/batch-processor.ts` (Claude 응답 처리 — validateRawClaudeResponse 통합 후보)
  - `packages/shared/src/constants/exam-ids.ts`
  - `packages/shared/src/index.ts`
  - `packages/parser/src/__tests__/determinism.property.test.ts`
  - `apps/batch/src/__manual__/pdfplumber-smoke.ts`
  - `.eslintrc.json`
  - `docs/architecture/ARCHITECTURE.md`

---

## 1. 카운트 요약

| 분류        | 건수 | 비고                                                                             |
| :---------- | :--- | :------------------------------------------------------------------------------- |
| ✅ PASS     | 8    | top-down 연계 검증 항목                                                          |
| 🔴 Critical | 1    | FUZ-02 검증층 우회 — batch-processor 미통합                                      |
| 🟠 Major    | 3    | XSS HARD_RULE_17 우선순위 / classifySubprocessError dead path / D1 1MB 상수 결합 |
| 🟢 Minor    | 2    | scanWindow signature scan 범위 / Buffer 의존 명시 부재                           |
| N/A         | 2    | Hard Rule 16 (validation layer) / 다이어그램 정합성 (해당 없음)                  |

**판정**: **수정 필요** — Critical 1건 (검증층 우회) 흡수 후 재리뷰 권장. 본 commits 만으로는 FUZ-02 의도 (Claude 응답 거부) 가 운영 경로에 작동하지 않는다.

---

## 2. PASS 확인 항목 (실제 검증한 내용)

### PASS-1: 의존 단방향 정합 (errors.ts → 0 dependency)

- 파일: `packages/parser/src/errors.ts:1-119`
- 검증: import 0건. 외부 의존 없는 순수 타입/클래스. `pdf-extractor.ts:17` + `schema-validator.ts:25` 가 단방향 import.
- 결과: 의존 순환 없음. parser 패키지 내부 정합 OK.

### PASS-2: parser → shared 단방향 (Hexagonal Engine-First)

- 파일: `packages/parser/src/schema-validator.ts:13-14`, `packages/parser/package.json:13-15`
- 검증: `@thepick/shared` 만 dependency. parser-1st-exam / formula-engine / quality 미참조. shared 는 type-only + EXAM_IDS catalogue 만 import → 단방향 OK.
- 결과: ARCHITECTURE.md §6 Hexagonal 의존 방향 (domain ← application → infrastructure) 위반 없음.

### PASS-3: index.ts re-export 완전성

- 파일: `packages/parser/src/index.ts:1-44`
- 검증: 신규 export 모두 cover —
  - `extractPdf`, `extractPdfText`, `getActivePdfSubprocessCount` (line 1)
  - `PdfParseError`, `KnowledgeContractValidationError` (line 4)
  - `PdfErrorClassification`, `KnowledgeContractErrorClassification` 등 type (line 5-10)
  - `validateRawClaudeResponse`, `RawResponseValidationOptions` (line 33, 43)
- 결과: 외부 소비자 (`apps/batch`, 테스트) 가 `'@thepick/parser'` barrel 로 신규 API 접근 가능.

### PASS-4: Hard Rule 17 ESLint 정합

- 파일: `.eslintrc.json:14-20`, `packages/parser/src/schema-validator.ts:489`
- 검증:
  - ESLint `no-restricted-syntax` 가 `Literal[value='son-hae-pyeong-ga-sa']` AST 차단.
  - `HARD_RULE_17_LITERALS = Object.values(EXAM_IDS)` 는 literal 직접 인용이 아니므로 ESLint 통과.
  - 테스트 fixture (`packages/parser/__fixtures__/claude-malformed/08-hard-rule-17-violation.json`) 에 literal 가 들어 있으나 JSON 파일 → ESLint `ignorePatterns` (`**/*.json`, line 30) 로 자연 제외.
- 결과: Hard Rule 17 단일 진실 소스 + 자동 확장성 (Year 2 EXAM_IDS 추가 시 자동 차단 패턴 갱신) 보장.

### PASS-5: Workers 런타임 제약 — pdf-extractor 영향 없음

- 파일: `packages/parser/src/pdf-extractor.ts:1-17`, `apps/batch/src/__manual__/pdfplumber-smoke.ts`
- 검증:
  - pdf-extractor 는 본디 `node:child_process`, `node:fs/promises`, `node:path`, `node:url` import — Workers 미호환. **로컬/CI 빌드 파이프라인 한정** 주석 명시 (line 3-4).
  - 호출 경로: `apps/batch/src/pipeline.ts:776` (배치 전용) + `__manual__/pdfplumber-smoke.ts` (로컬 smoke 스크립트). Workers 호출 경로 없음.
  - 추가된 `node:fs/promises.readFile` (line 13) + `Buffer` 사용 (line 66) 도 동일 제약 영역. 신규 위반 없음.
- 결과: Workers 호환 여부 N/A — 본 모듈은 Node 전용 빌드 파이프라인 코드.

### PASS-6: Hard Rule 15 — 범용 계층 시험 특화 분기 부재

- 파일: `packages/parser/src/schema-validator.ts:1-666`, `packages/parser/src/errors.ts:1-119`
- 검증:
  - schema-validator 는 `EXAM_IDS catalogue` 를 검증 패턴 (literal 차단) 으로 활용. 시험 ID 별 분기 없음.
  - `if (examId === 'son-hae-pyeong-ga-sa')` 류 분기 0건.
  - `Object.values(EXAM_IDS)` 사용 (line 489) → Year 2 EXAM_IDS 추가 시 자동 확장 (Rule 15 정합).
- 결과: parser 범용 계층 격리 OK.

### PASS-7: Subprocess lifecycle 추적 — exit/error 양방향 감산

- 파일: `packages/parser/src/pdf-extractor.ts:230-323`
- 검증:
  - line 230: `activeSubprocessCount++` (호출 직전).
  - line 319: `child.once('exit', decrement)`.
  - line 320-322: `child.once('error', () => decrement(...))`.
  - `settled` 가드 (line 231-236) 로 callback double-fire 방지.
  - line 238: `if (activeSubprocessCount > 0) activeSubprocessCount--` 로 음수 방어.
- 결과: subprocess zombie 0건 invariant 의 구현 메커니즘 정합. 테스트 (FUZ-01 line 66, 84, 124) 에서 `getActivePdfSubprocessCount() === 0` 직접 검증.

### PASS-8: Type 정합성 — KnowledgeContract / ValidationError 매칭

- 파일: `packages/parser/src/schema-validator.ts:539-572` (mapValidationErrorsToClassification)
- 검증:
  - `ValidationErrorCode` ('INVALID_NODE_ID_PATTERN' 등) → `KnowledgeContractErrorClassification` ('ONTOLOGY_UNREGISTERED_ID') 매핑.
  - `errors[0].path` / `errors[0].message` / `errors[0].value` 모두 `ValidationError` interface (line 91-96) 와 일치.
  - 우선순위: ontology > missing field > 기타 (PARSE_ERROR 로 fallback).
- 결과: type-safe. 테스트 회귀 (line 94-113 정상 contract 통과) 가 type 매칭 검증.

---

## 3. CRITICAL 적발

### 🔴 CRITICAL-1 — `validateRawClaudeResponse` 가 batch-processor 운영 경로에 미통합 → FUZ-02 검증층 전체 우회

**증거**:

- `packages/parser/src/batch-processor.ts:281-319`: `parseContractJson(raw)` 함수가 Claude 응답을 직접 처리.
  - line 286: `JSON.parse(jsonStr)` — 깊이 검증 없음 (50 단계 maxDepth 미적용)
  - line 281-319 전체: XSS payload / examId literal / size threshold / EMPTY_RESPONSE 검사 부재
- `packages/parser/src/batch-processor.ts:381`: `validation = validateKnowledgeContract(contract)` — 이미 parse 된 object 검증만 수행. raw 단계 거부 layer 우회.
- `packages/parser/src/batch-processor.ts:15`: import 에 `validateRawClaudeResponse` 부재.
- 즉, **FUZ-02 가 신규 정의한 8종 분류 (EMPTY_RESPONSE / RESPONSE_SIZE_EXCEEDED / XSS_PAYLOAD_DETECTED / HARD_RULE_17_VIOLATION / JSON_DEPTH_EXCEEDED / PARSE_ERROR / ONTOLOGY_UNREGISTERED_ID / MISSING_REQUIRED_FIELD) 가 테스트 fixture 에서만 발동 — 실제 Claude API 응답 처리 시 발동 안 함**.

**연쇄 위험**:

1. **D1 transaction 1MB 보호 우회**: 100KB 이상 Claude 응답이 그대로 `parseContractJson` → `validateKnowledgeContract` 진입 → DB 적재 직전 단계까지 진행 후 INSERT 실패 (checkpoint 누락 위험).
2. **XSS payload silent 적재**: Claude hallucination 으로 `<script>` 포함 content 가 D1 적재 (UI 렌더링 단계까지 위협 잠복).
3. **Hard Rule 17 위반 응답 silent 적재**: Year 2 멀티시험 확장 시 cross-exam 오염 가능 ('son-hae-pyeong-ga-sa' literal 이 다른 시험 데이터에 잔존).
4. **JSON depth 100 단계 silent 적재**: V8 JSON.parse 가 통과해도 후속 traversal (DFS) 에서 stack overflow 위험 (Sprint 1 §5.1 graph DFS stack 이슈와 동일 클래스).
5. **EMPTY_RESPONSE silent failure**: line 366-368 `if (!response.content) throw new Error(...)` 는 generic Error — `KnowledgeContractValidationError('EMPTY_RESPONSE')` 분류 메타데이터 (size/maxAllowed/rawSnippet) 손실.

**테스트 미커버 경로**:

- `batch-processor.test.ts` 가 mocked Claude client 사용 — 변조 응답 (large payload / XSS / depth 100 / Hard Rule 17 literal) 에 대한 회귀 테스트 부재.
- FUZ-02 테스트는 `readFile + validateRawClaudeResponse` 직접 호출 패턴 (`fuz-02-claude-malformed.test.ts:80, 116`) — `processBatch` 통합 경로 미검증.

**흡수 권고** (선택지 비교 — 진산님 결정):

- **(A)** `batch-processor.ts:378` 의 `parseContractJson(response.content)` 호출을 `validateRawClaudeResponse(response.content)` 로 교체. 기존 `parseContractJson` 의 ` ```json ... ``` ` 블록 추출 로직 (line 283-284) 은 보존 의무 — `validateRawClaudeResponse` 가 그 후 진입. 약 10줄 변경. **권장**.
- **(B)** 별도 `processBatch` 옵션 (`enableRawValidation: true`) 으로 점진 전환 — 회귀 위험 분산. 단, "검증층 우회" 상태가 default 로 남아 있어 본 Critical 미해결.
- **(C)** §5.4 종료 게이트 직전 일괄 통합 — 본 Sprint 의 §5.3 검증을 운영 경로에서 무력화하는 셈. 비권장.

**상태**: **본 commit 흡수 의무 (옵션 A)**. FUZ-02 의 운영 가치는 batch-processor 통합 후에야 발현. 통합 전까지는 `validateRawClaudeResponse` = "테스트만 통과하는 dead code".

---

## 4. MAJOR 적발

### 🟠 MAJOR-1 — XSS 검사가 HARD_RULE_17 보다 먼저 실행 → Hard Rule 17 위반이 동시에 XSS 패턴 가질 시 분류 모호

**증거**:

- `packages/parser/src/schema-validator.ts:615-636`: 검사 순서가 (3) XSS_PAYLOAD_DETECTED → (4) HARD_RULE_17_VIOLATION.
- 시나리오: `'son-hae-pyeong-ga-sa'<script>` 같은 합성 응답 → XSS 가 먼저 매칭 → 분류 = `XSS_PAYLOAD_DETECTED`. 운영 trail 에는 Hard Rule 17 위반 흔적 미보존.

**연쇄 위험**:

- 운영 모니터링 dashboard 에서 Hard Rule 17 위반 카운트 = 실제보다 적음. Year 2 멀티시험 확장 직전에 Hard Rule 17 violation rate 낮다고 오판 → 위험 인식 지연.
- 보안 보고서 작성 시 분류가 위협 우선순위 (XSS > examId 누설) 와 부합하나, **두 위반이 동시에 발생 시 multi-classification 미지원** = trail 손실.

**흡수 권고**:

- 옵션 A: 모든 검사를 별도 단계로 수집 후 합쳐서 throw (multi-classification metadata) — 현 단일 throw 패턴 변경 큰 수준.
- 옵션 B: `metadata.allViolations: [...]` 보조 필드 추가 — 단일 classification 유지 + 부수 violation trail.
- 옵션 C: 검사 순서를 (4) HARD_RULE_17 → (3) XSS 로 swap. examId 누설은 데이터 오염 (영구) 이고 XSS 는 sanitize 가능 (transient) 이라는 관점에서 합리. **권장**.

**테스트 미커버**: 합성 vector (Hard Rule 17 + XSS 동시) 부재. fixture `08-hard-rule-17-violation.json` 은 순수 examId literal 만 — 분류 우선순위 검증 안 됨.

### 🟠 MAJOR-2 — `classifySubprocessError` 의 'MALFORMED_HEADER' 경로가 실질적 dead code

**증거**:

- `packages/parser/src/pdf-extractor.ts:183-192`: subprocess stderr 분류 함수.
  - line 188: `header / not a pdf / signature` → `MALFORMED_HEADER`.
- 그러나 `preflightPdfChecks` (line 98-177) 가 `%PDF-` signature 부재 / `%%EOF` trailer 부재 / `MIN_PDF_BYTES` 미달을 모두 사전 차단.
- 즉, **헤더 손상 PDF 는 subprocess 진입 전에 100% 거부**. `classifySubprocessError` 의 MALFORMED_HEADER 경로는 "preflight 가 통과 + subprocess stderr 가 'header' 단어 포함" 조건에서만 도달 — 운영 시 발생 가능성 매우 낮음.

**연쇄 위험**:

- 코드 신뢰성 misrepresent: 운영 trail 분석 시 MALFORMED_HEADER 분류가 발생하면 "preflight 우회 vector 발견" 신호여야 하나, dead path 잔존으로 노이즈 가능.
- Year 2 다른 PDF parser (예: pdfjs migration) 도입 시 classifier 재사용 시 정의 모호.

**흡수 권고**:

- 옵션 A: dead path 제거 + 주석 갱신 ("preflight 후 subprocess stderr 는 PDF_PARSE_FAILED / MALFORMED_XREF 만 발생").
- 옵션 B: 유지 + 주석에 "preflight bypass vector 시그널" 명시.

### 🟠 MAJOR-3 — `DEFAULT_MAX_RESPONSE_SIZE_BYTES = 100KB` 가 D1 1MB 상수와 결합 부재 (silent drift 위험)

**증거**:

- `packages/parser/src/schema-validator.ts:460`: `const DEFAULT_MAX_RESPONSE_SIZE_BYTES = 100 * 1024;`
- 주석 (line 458-459): "D1 single transaction 1 MB 한도 보호. 본 시점 100 KB 로 보수적 설정."
- D1 1MB 한도는 별도 constants (확인 필요) 가 아닌 인라인 주석으로만 표현. Cloudflare D1 SDK 의 1MB 가 향후 변경되거나 schema 별로 다를 시 본 임계값과 결합 끊김.

**연쇄 위험**:

- D1 1MB 상수 (예: `D1_MAX_TRANSACTION_BYTES = 1024 * 1024`) 가 별도 정의되어 있고 본 100KB 가 그것의 1/10 이라는 관계가 코드에 없음.
- D1 한도 변경 시 (1MB → 2MB) 본 100KB 가 자동 추적 안 됨 — 시간 누적 후 임계값 misalign.
- 4-Pass Pass 4 CONTRACT 관점에서 검토 시 "100KB 의 근거?" 질문 도달 어려움.

**흡수 권고**:

- 옵션 A: `packages/shared/src/constants/db-limits.ts` 신규 + `D1_MAX_TRANSACTION_BYTES = 1024 * 1024` 선언 → schema-validator 가 `D1_MAX_TRANSACTION_BYTES / 10` 도출.
- 옵션 B: 본 파일에 `D1_TRANSACTION_LIMIT_BYTES = 1024 * 1024` + `DEFAULT_MAX_RESPONSE_SIZE_BYTES = D1_TRANSACTION_LIMIT_BYTES / 10` — minimal 변경.
- **권장 옵션 B (Sprint 1 한정)**, 옵션 A 는 Phase 1 종료 시 일괄.

---

## 5. MINOR 적발

### 🟢 MINOR-1 — `scanWindow.subarray(0, 8)` PDF signature 검사 범위 (8 bytes) 가 spec 보다 좁음

**증거**:

- `packages/parser/src/pdf-extractor.ts:122`: `if (!scanWindow.subarray(0, 8).includes(PDF_SIGNATURE))`
- `%PDF-` 시그니처 (5 bytes) + 버전 ("1.4" 등 3 bytes) = 8 bytes 정합. 단, PDF spec 은 first 1024 bytes 어디든 시그니처 허용 (BOM / leading whitespace 케이스).
- 본 구현은 first 8 bytes 만 검사 — BOM (3 bytes) 이 앞에 붙은 PDF 는 false positive (MALFORMED_HEADER) 거부 가능.

**영향**: 정상 BOM-prefixed PDF 가 잘못 거부될 가능성. 단, pdfplumber 자체도 BOM 비표준이므로 실제 영향 미미.

**권고**: 주석에 "BOM-prefixed PDF 는 MALFORMED_HEADER 분류 (현 정책상 비표준)" 명시.

### 🟢 MINOR-2 — `Buffer.byteLength(raw, 'utf-8')` 의 Node.js Buffer 의존이 명시 부재

**증거**:

- `packages/parser/src/schema-validator.ts:606`: `const size = Buffer.byteLength(raw, 'utf-8');`
- `Buffer` 는 Node.js global. Workers 런타임 미지원 (workerd 일부 polyfill 있으나 unstable).
- schema-validator 는 errors.ts / ontology-registry 외 의존 없음 → 이론상 Workers 코드에 import 가능.
- 현 시점 `validateRawClaudeResponse` 는 batch-processor 미통합이라 Workers 호출 경로 없음. 단, **Critical-1 흡수 옵션 A 시 batch-processor 가 Workers 환경 (Cloudflare Queues consumer) 에서 호출되면 Buffer 부재로 ReferenceError**.

**권고**:

- 옵션 A: `new TextEncoder().encode(raw).byteLength` 로 교체 — Workers 호환 확보.
- 옵션 B: 모듈 상단 주석 `// Node.js only — Workers 미호환 (Buffer)` 명시.

---

## 6. N/A 항목

### N/A-1: Hard Rule 16 — 데이터 조회 경계 (validation layer)

- 본 변경은 검증 layer (validation) 만 다룸. D1/Vectorize 데이터 조회 함수 추가 없음.
- `examId: ExamId` 첫 인자 패턴 의무 대상 아님.

### N/A-2: ARCHITECTURE.md Mermaid 다이어그램 정합성

- 본 변경은 packages/parser 내부 검증 layer 추가. 시스템 컴포넌트 boundary / 데이터 흐름 / 의존 관계 다이어그램 영향 없음.
- 단, FUZ-01 (PDF 파싱 성공/실패 경로) + FUZ-02 (Claude 응답 검증층) 은 Phase 1 BATCH 파이프라인 다이어그램에 반영 권장 (Phase 1 종료 시 일괄).

---

## 7. 이월 MAJOR 7건 중복 회피 검증

| 이월 ID | 제목                                          | 본 commit 영향 | 판정                                                                                                  |
| :------ | :-------------------------------------------- | :------------- | :---------------------------------------------------------------------------------------------------- |
| A1      | tsconfig path mapping (Pass 2)                | 무관           | ledger 유지 — 본 리뷰 미해결                                                                          |
| D1      | ESLint Rule 17 예외 nameset `__fixtures__/**` | 부분 무관      | `**/*.json` 기존 ignorePattern 으로 fixture 자연 제외 → ledger 유지 (tests 별도 매커니즘 필요시 별건) |
| E1      | ADR-028 trigger #4 측정 불가능                | 무관           | ledger 유지 — 본 리뷰 미해결                                                                          |

본 리뷰의 모든 신규 발견은 위 3건과 별개 분류.

---

## 8. Devil's Advocate 반론 (깨질 수 있는 통합 시나리오)

### 반론 1 (Critical-1 의 reverse): "Critical-1 은 false alarm — batch-processor 통합은 §5.4 P2-NIT 의무 범위가 아닐 수 있다"

**반론 검토**:

- handoff-session-030 §2.A FUZ-02 명세를 직접 확인 못 했으나, commit message ("schema-validator raw 응답 8종 분류 거부") 와 fixture README §3 (예시 `validateKnowledgeContract` 호출) 를 종합하면 **본 commit 의 의도는 검증 함수 정의 + 단위 테스트**까지 가능. 통합은 별도 step.
- 단, **FUZ-02 의 운영 가치 (Claude 응답 변조 거부)** 는 batch-processor 통합 후에야 발현. 현 상태는 "테스트는 통과하지만 운영에는 쓰이지 않는 함수" — 4-Pass Pass 4 CONTRACT 의 "Silent Pivot" 시그널.
- **결론**: 본 commit 에서 통합이 의무가 아니더라도, **다음 commit 또는 §5.4 진입 전 의무**로 ledger 등재 필수. 현 상태로 §5.3 종료 게이트 통과 시 운영 가치 0 의 검증 layer 가 잔존.

→ Critical-1 등급 유지 (반론 부족).

### 반론 2 (PASS-7 의 reverse): "Subprocess zombie 검증이 100% 충분하다"

**반론 검토**:

- `child.once('exit', decrement)` + `child.once('error', decrement)` 는 **Node.js child_process 의 documented event 만 cover**.
- 미커버 시나리오:
  - `SIGKILL` (kill -9) 직전 subprocess 가 emit 'exit' 못 한 채 process orphan → `activeSubprocessCount` decrement 실패. Linux 에서 zombie 잔존 (parent process Cloudflare Workers / batch runner 가 살아 있는 동안).
  - `child.kill('SIGKILL')` 호출 후 `wait4` 안 하면 process table entry 잔존. `getActivePdfSubprocessCount() === 0` 가 OS 차원 zombie 0건과 다름.
  - timeout (line 264) 시 Node.js 가 `SIGTERM` (Linux default) 보내고 `error.killed = true` 콜백 발동 — 단, subprocess 가 SIGTERM 무시 + grace period 내 exit 안 하면? Node 20+ 는 `killSignal: 'SIGKILL'` default 가 아닌 `SIGTERM` → 후속 reap 의무.
- **결론**: `getActivePdfSubprocessCount()` = "Node 차원 callback decrement 카운터". OS 차원 zombie 검증은 별도 (`ps -ef | grep python3 | grep extract_pdf` 같은 외부 명령). FUZ-01 fixtures 5종은 모두 **preflight 단계 거부 → subprocess 미생성** 이라 zombie 위험 자체가 없는 vector. 진짜 zombie 위험 (subprocess 호출 후 SIGKILL bypass) 은 **테스트 fixture 미커버**.

→ MAJOR 등급 신규 적발 후보, 단 FUZ-01 의 §5.3 명세 (5종 사전 거부) 범위를 넘어가는 영역. **§5.4 또는 P1 등재 권고** (현 §5.3 ledger 유지).

### 반론 3: "options.maxSizeBytes override (test line 131) 가 회귀 방어 충분"

**반론 검토**:

- 테스트 (`fuz-02-claude-malformed.test.ts:129-134`):
  ```typescript
  const small = JSON.stringify({ nodes: [], edges: [], formulas: [], constants: [] });
  expect(() => validateRawClaudeResponse(small, { maxSizeBytes: 10 })).toThrow(
    /RESPONSE_SIZE_EXCEEDED/,
  );
  ```
- override 자체는 동작 검증 OK. 단, **호출 측이 실수로 `maxSizeBytes: Infinity` 또는 `Number.MAX_SAFE_INTEGER` 전달 시 → D1 1MB 보호 우회**. type 시스템이 막지 않음 (number 타입).
- batch-processor 통합 (Critical-1 흡수) 시 호출 측이 `maxSizeBytes` 명시 안 함 = default 100KB → 문제 없음. 단, 향후 미래 코드에서 "큰 응답 허용" override 시 silent overflow 가능.

**권고**: `RawResponseValidationOptions.maxSizeBytes` 에 hard ceiling (예: D1 1MB / 1024 \* 1024) 강제. options 가 ceiling 초과 시 throw. 본 리뷰 시점 MINOR 등급 (실제 발생 시나리오 부재).

→ MINOR 등급 신규 적발 후보. 명시적 별건 등재 시 ledger 추가.

---

## 9. 최종 판정 + 흡수 권고 우선순위

| 우선 | 항목                   | 흡수 시점                 | 비용  |
| :--- | :--------------------- | :------------------------ | :---- |
| 1    | Critical-1 (옵션 A)    | 본 §5.3 즉시              | ~10줄 |
| 2    | MAJOR-2 (dead path)    | 본 §5.3 또는 §5.4 진입 전 | ~5줄  |
| 3    | MAJOR-3 (D1 상수 결합) | 본 §5.3                   | ~3줄  |
| 4    | MAJOR-1 (검사 순서)    | §5.3 또는 §5.4            | ~10줄 |
| 5    | MINOR-1, MINOR-2       | §5.4 ledger               | 주석  |

**판정**: **수정 필요 (Critical 1건 흡수 의무)**.

본 리뷰 후 흡수 권고 (옵션 A) 를 적용하면 §5.3 종료 게이트 진입 가능. MAJOR-2/3 는 §5.3 이내 흡수 권장, MAJOR-1 / MINOR 는 §5.4 ledger 등재 후 분리 흡수.

---

**작성**: Pass 2 ARCHITECT 독립 서브에이전트
**작성일**: 2026-05-02 09:04:18 KST
**리뷰 대상**: commits 2beb282 + 71a97c9
