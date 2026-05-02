# Pass 1 SURGEON — Sprint 1 §5.3 FUZ-01 + FUZ-02 독립 리뷰

- 일시: 2026-05-02 09:04 KST
- 리뷰 대상 commits:
  - `2beb282` feat(parser): FUZ-01 — pdf-extractor pre-flight 5종 분류 거부
  - `71a97c9` feat(parser): FUZ-02 — schema-validator raw 응답 8종 분류 거부
- 리뷰 방식: 독립 에이전트 (Pass 1 SURGEON, bottom-up code correctness only)
- 리뷰 범위: 변경 파일 6개 + 연관 파일 4개 (소비자 `apps/batch/src/pipeline.ts`,
  fixtures `pdf-malicious/*` + `claude-malformed/*`, `EXAM_IDS` catalogue, Python
  subprocess 스크립트)
- 자가 리뷰 여부: **NO** — 코드를 작성한 컨텍스트와 분리. 의도 편향 없음.

---

## 종합 카운트

- ✅ PASS: 12건
- 🔴 Critical: **2건**
- 🟠 Major: **5건**
- 🟢 Minor: **4건**

---

## 확인 항목 (PASS 12건 — 증거 기반)

| #    | 파일:라인                                                   | 확인 내용                                                                                                                                                                |
| ---- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅1  | `pdf-extractor.ts:99-100`                                   | `stat()` 결과 → `stats.size` 사용. stat throw 시 promise rejection 으로 자연 전파 (단, 분류 매핑 누락 — Major 1 참조)                                                    |
| ✅2  | `pdf-extractor.ts:152-154`                                  | `xrefMatch` null guard 적절. `Number.isFinite(xrefOffset)` 으로 NaN/Infinity 방어                                                                                        |
| ✅3  | `pdf-extractor.ts:229-323`                                  | Promise constructor 내 settled flag + 단일 settle 헬퍼로 race 방어. decrement 도 `> 0` 가드.                                                                             |
| ✅4  | `schema-validator.ts:502-533`                               | character-level depth 측정에서 escape flag 처리 + 문자열 안 brace 무시 — JSON 표준 escape 시맨틱 정합                                                                    |
| ✅5  | `schema-validator.ts:489`                                   | `Object.values(EXAM_IDS)` 사용으로 Hard Rule 17 단일 진실 소스 유지. `packages/shared/src/constants/exam-ids.ts` 와 정합                                                 |
| ✅6  | `schema-validator.ts:597-602`                               | `raw == null` 가드 + `typeof raw === 'string'` 분기로 metadata 안전                                                                                                      |
| ✅7  | `errors.ts:60, 115`                                         | `typeof Error.captureStackTrace === 'function'` 가드 — V8 외 환경에서도 안전                                                                                             |
| ✅8  | `pdf-extractor.ts:243-244`                                  | execFile timeout + maxBuffer 100MB 옵션 → subprocess 자체 살해 동작 보장                                                                                                 |
| ✅9  | `pdf-extractor.ts:319-323`                                  | `child.once('exit', decrement)` + `child.once('error', ...)` 양쪽 등록. once 사용으로 동일 이벤트 다중 fire 시 단일 감산 보장                                            |
| ✅10 | `schema-validator.ts:606`                                   | `Buffer.byteLength(raw, 'utf-8')` — UTF-8 multi-byte (한글 3 byte) 정확. .length 가 아닌 byte 단위 임계 검사                                                             |
| ✅11 | `fuz-01-pdf-malicious.test.ts:64-67`                        | afterEach invariant — 매 테스트 후 zombie 0건 강제. 한 fixture 의 leak 이 다음 테스트로 전파되지 않음                                                                    |
| ✅12 | fixtures `03-compression-bomb.pdf` `/Length 104857600` 검증 | xxd 으로 1478 byte 파일 안 `<< /Length 104857600 >>` 확인. 104857600 / 1478 ≈ 70940x → MAX_DECOMPRESSION_RATIO=100 와 충분한 마진. regex `\d{6,}` 매칭 통과 (8자리 숫자) |

---

## 🔴 CRITICAL — 2건

### 🔴 CRITICAL-1 — `child.once('exit')` + execFile callback 이중 감산 가능 + 일부 환경에서 영구 누수 위험

**증거:**

- `pdf-extractor.ts:319-323`:
  ```ts
  child.once('exit', decrement);
  child.once('error', () => {
    decrement();
  });
  ```
- 동일 파일 `:241-316`: execFile 의 callback `(error, stdout, stderr) => {...}` 자체가 subprocess 종료를 감지. 그러나 callback 안에서는 **decrement 를 호출하지 않음**.
- `decrement` 헬퍼는 `activeSubprocessCount > 0` 일 때만 `--` 하지만 음수 가드만 있음.

**위험 분석:**

Node.js child_process 의 `error` 와 `exit` 이벤트는 일부 시그널 / 비정상 종료
경로에서 모두 fire 가능. 두 이벤트 모두 fire → decrement 가 2회 호출 →
다른 동시 실행 subprocess 의 카운터까지 잘못 감산되어 **zombie 가 실제로 존재해도
0 으로 보이는 silent failure** 가능. `> 0` 가드는 음수 진입은 막지만 cross-call
오감산은 막지 못함.

또한 callback 이 정상 호출됐는데 `exit` 이벤트가 어떤 이유로 fire 못하면
**카운터 영구 +1 누수** (callback 안에서 decrement 가 없으므로). 정상 동작
환경에서는 둘 다 fire 하므로 안 보이지만 detached / process group broken 상황에서
문제 발생.

**흡수 권고 (CRITICAL):**

idempotent decrement 로 변경:

```ts
let counted = true;
const decrementOnce = () => {
  if (counted) {
    counted = false;
    if (activeSubprocessCount > 0) activeSubprocessCount--;
  }
};
child.once('exit', decrementOnce);
child.once('error', decrementOnce);
// callback 안에서도 보조로 decrementOnce() 호출 가능 (영구 누수 방어)
```

---

### 🔴 CRITICAL-2 — `XSS_PAYLOAD_DETECTED` regex `/\bon\w+\s*=/i` 가 자연어 raw JSON 에서 false positive 폭발

**증거:**

- `schema-validator.ts:476`: `/\bon\w+\s*=/i` 패턴.
- 본 패턴은 ASCII boundary `\b` + `on` + word char + `=` 매칭.

**False positive 경로 (BATCH 적재 정상 콘텐츠):**

```json
{ "content": "online = true 인 경우 분석한다" }
{ "content": "ontology = 지식 체계" }
{ "content": "once = 한 번만" }
{ "content": "option = 선택사항" }
```

위 모두 `\bon\w+\s*=` 매칭 → **XSS_PAYLOAD_DETECTED 오분류** → 정상 contract
silent rejection.

JavaScript regex `\b` 는 ASCII word boundary 라 한국어 ↔ ASCII 경계에서도
boundary 발생. 한국어 본문 안에 영어 단어 `option = ...` 가 들어가면 매칭.

**위험 분석:**

본 패턴은 HTML attribute 컨텍스트 (`<a onerror=...>`) 전용인데 raw JSON 전체에
적용한다. JSON 안 자연어가 우연히 매칭 → BATCH 적재 시 정상 교재 본문 거부.
**진산님 북극성 "신뢰성·정확성" 위반** (정상 콘텐츠 silent rejection).

**테스트 통과 = 안전 가정 거부:** 본 commit 의 fixture 는 악의적 페이로드만
검증, 정상 한국어 + 영어 단어 혼합 자연어는 cover 안 함.

**흡수 권고 (CRITICAL):**

XSS 패턴을 HTML 태그 컨텍스트로 좁혀라:

```ts
const XSS_PAYLOAD_PATTERNS = [
  /<script\b[^>]*>/i,
  /javascript\s*:/i,
  /<\w+[^>]*\s+on\w+\s*=/i, // 태그 안 attribute 형태로만 제한
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
];
```

또는 raw 전체 검사 대신 **parse 후 string field 단위 검사** (title/content
두 필드만) — 자연어 우연 매칭 위험 감소.

---

## 🟠 MAJOR — 5건

### 🟠 MAJOR-1 — `preflightPdfChecks` 의 stat / readFile 자체 throw 는 분류되지 않은 raw fs error 로 외부 노출

**증거:**

- `pdf-extractor.ts:99`: `const stats = await stat(pdfPath);` — pdfPath 미존재 시 ENOENT.
- `pdf-extractor.ts:117`: `const bytes = await readFile(pdfPath);` — permission / I/O error.
- 두 호출 모두 try/catch 없음 → `extractPdf` 가 raw Error (code ENOENT) 로 throw → caller 는 `PdfParseError` 분기 미적용.

**위험:**

- `pipeline.ts` 가 `error instanceof PdfParseError` 분기를 추가할 때 fs error 가 비분류 채널로 빠져나감.
- FUZ-01 의도 ("모든 vector graceful 분류") 와 충돌.

**흡수 권고:**

```ts
let stats;
try {
  stats = await stat(pdfPath);
} catch (err) {
  throw new PdfParseError('PDF_PARSE_FAILED', `Cannot stat PDF: ${(err as Error).message}`, {
    pdfPath,
  });
}
```

---

### 🟠 MAJOR-2 — `/Length \d{6,}` regex 가 2GB 이상 declared length 에서 Number overflow 시점 누락

**증거:**

- `pdf-extractor.ts:165`: `const lengthRe = /\/Length\s+(\d{6,})/g;`
- `pdf-extractor.ts:168`: `const declared = Number(lengthMatch[1]);`
- `Number.isFinite(declared)` 만 검사 — `Number.MAX_SAFE_INTEGER` (≈ 9 × 10^15) 초과 시 정수 정밀도 손실되어도 isFinite 는 true.

**시나리오:**

악의적 PDF 가 `/Length 99999999999999999999999999` (24 자리) 선언 → Number()
결과 1e+25 (Infinity 아님, finite) → > fileSize × 100 비교는 동작하지만
metadata.declaredLength 에 정밀도 손실된 값 저장 → 운영 trail 부정확.

**흡수 권고:**

자릿수 컷 또는 BigInt 비교:

```ts
const declaredStr = lengthMatch[1];
if (declaredStr.length > 15 || Number(declaredStr) > fileSize * MAX_DECOMPRESSION_RATIO) {
  // ...
}
```

---

### 🟠 MAJOR-3 — XSS → Hard Rule 17 → JSON depth 검사 순서가 단일 시그널만 표면화 → 다중 위반 운영 trail 부재

**증거:**

- `schema-validator.ts:615-636`: 검사 순서 EMPTY → SIZE → XSS → Hard Rule 17 → DEPTH → PARSE.

**시나리오:**

- 200 KB raw 응답에 `son-hae-pyeong-ga-sa` 인용 → SIZE 가 먼저 throw → Hard Rule 17 위반은 보고되지 않음.
- 진산님 dashboard 에서 다중 위반 패턴 (악의적 actor 동시 다중 vector) 식별 불가.

**위험:**

graceful 거부는 작동하지만 **단일 시그널만** 표면화 → 운영 trail 에서
패턴 식별 불가.

**흡수 권고:**

검사 순서 결정 ADR 작성 + metadata.allViolations 누적 보고.

---

### 🟠 MAJOR-4 — `apps/batch/src/pipeline.ts:776` caller 가 PdfParseError 분류 분기 없음 — graceful 에러가 generic catch 로 흡수

**증거:**

- `pipeline.ts:776`: `const extracted = await extractPdf(ctx.pdfPath, { pages: pagesArg });`
- `pipeline.ts:733, 1022`: `} catch (err) { ... }` — `instanceof PdfParseError` 분기 없음.

**위험:**

- FUZ-01 핵심 의도 = 5종 vector 의 분류된 운영 trail. caller 가 분류를 무시하고 generic Error 로 처리하면 dashboard 에서 EMPTY_INPUT vs COMPRESSION_BOMB vs JS_EMBEDDED 식별 불가.
- 본 commit 의도가 절반만 달성.

**흡수 권고:**

`pipeline.ts` 의 stage error handling 에서 `if (err instanceof PdfParseError) { ... err.classification ... }` 분기 + telemetry 적재 (별도 commit 으로 §5.4 흡수 가능).

---

### 🟠 MAJOR-5 — `Object.values(EXAM_IDS)` substring 매칭이 Year 2 시험 ID 추가 시 자연어 우연 매칭 폭발 위험

**증거:**

- `schema-validator.ts:489, 628-636`: `raw.includes(literal)` substring 검사.
- 현재 EXAM_IDS = 1개 (`son-hae-pyeong-ga-sa`) — 충분히 unique 하므로 자연어 매칭 위험 낮음.
- Year 2 새 시험 ID 가 짧거나 자연어와 겹치면 (예: 영어 단어 `paper`, `pa`, `pma`, `cpa`) 정상 자연어 raw 응답이 위반으로 거부될 위험.

**위험 (확장 시점):**

- 본 commit 시점에는 OK 그러나 Year 2 시험 추가 시점에 silent rejection 폭발.
- ADR-007 (멀티시험 격리 Year 2 이월) 와 충돌.

**흡수 권고:**

word boundary regex 로 변경:

```ts
const literalRegexes = HARD_RULE_17_LITERALS.map(
  (l) => new RegExp(`\\b${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
);
for (const re of literalRegexes) {
  if (re.test(raw)) {
    /* throw */
  }
}
```

또는 ADR 명시 + Year 2 추가 시점 review 트리거.

---

## 🟢 MINOR — 4건

### 🟢 MINOR-1 — fixture `02-parse-error.json` 이 XSS / Hard Rule 17 검사를 우연히 통과

`type: CONCEPT` 가 unquoted 인 fixture (`{"id": "CONCEPT-001", type: CONCEPT, ...}`).
XSS 패턴 미매칭 + EXAM_IDS 미인용 → 5단계 (PARSE_ERROR) 까지 도달. 의도된 동작. **PASS.**

### 🟢 MINOR-2 — `errors.ts` 의 default 객체 인자 공유 가능성 점검 결과 안전

```ts
constructor(classification, message, (metadata = {}));
```

JavaScript class field 가 아닌 parameter default 이므로 호출마다 새 객체.
공유 위험 없음. **PASS.**

### 🟢 MINOR-3 — `MIN_PDF_BYTES = 100` 임계가 PDF spec 근거 주석 부재

`pdf-extractor.ts:63`. 명명 상수로 wrap 되어 있고 const 선언이라 매직 넘버는
아니지만 100 byte 가 어디서 나왔는지 spec 근거 주석 부재. README 또는 ADR
참조 권장.

### 🟢 MINOR-4 — `MAX_DECOMPRESSION_RATIO = 100` 도 cutoff 정당성 근거 부재

`pdf-extractor.ts:60`. 주석에 "Real-world PDF deflate ratio 5~20:1" 만 있고
100x cutoff 의 근거 부재. 정상 PDF 의 실측 ratio 데이터 (3 PDF 이상) 부재 →
false positive 발생 시 cutoff 조정 근거 없음. ADR 또는 measurement 데이터 추가 권장.

---

## 이월 §5.2 MAJOR 7건 중복 적발 검토

| 이월 항목                                                          | 본 commit 영향 | 상태                                                                                          |
| ------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------- |
| A1: tsconfig path mapping test-helpers production import 차단 부재 | 무관           | N/A — 본 commit 은 test-helpers 사용 없음                                                     |
| D1: ESLint Rule 17 예외 nameset `__fixtures__/**` 미포함           | **연관**       | fixture `08-hard-rule-17-violation.json` 안에 literal 인용 — ESLint 가 JSON 파일은 검사 안 함 |
| E1: ADR-028 trigger #4 측정 불가능                                 | 무관           | N/A                                                                                           |
| A2: Snyk / Dependabot false positive 차단                          | 무관           | N/A                                                                                           |
| A4: Phase 2 진입 트리거 binary 정의 부재                           | 무관           | N/A                                                                                           |
| MAJOR-1: commit msg fixtures 위치 변경 transparency                | 무관           | N/A                                                                                           |
| A3 Minor: Hard Rule 17 ESLint config 예외 패턴                     | **연관**       | 동일 — `__fixtures__/**` JSON 차단 불필요 (ESLint AST 미적용) 그러나 lint scan path 확인 필요 |

본 commit 단독으로 이월 항목 재발생 없음. D1 / A3 는 fixture 추가로 재 흡수 commit 에서 ESLint config 명시 권장.

---

## Devil's Advocate (반론 — 테스트 통과 = 안전 가정 거부)

### 반론 1 — "FUZ-01 은 7개 fixture × 분류 매칭 + zombie 0건 통과 = 안전"

**거부 근거:**

테스트는 extractPdf 직렬 호출 + Promise.allSettled 만 검증. CRITICAL-1 시나리오는
subprocess 가 spawn 후 비정상 kill 시 error + exit 두 이벤트 모두 fire — 본
환경 (linux WSL2 + Python venv) 에서 발생 빈도 낮으나 macOS / CI 환경 (Alpine
컨테이너 등) 에서 시그널 처리 차이로 발현 가능. 회귀 테스트가 cover 하지 못하는
엣지 케이스.

또한 zombie 0건 검증 invariant `getActivePdfSubprocessCount() === 0` 자체가 다른
테스트 동시 수행 + cross-call 오감산이 발생하면 false negative 발현 — invariant
신뢰성 자체에 의문.

### 반론 2 — "FUZ-02 은 8 fixture + options override + 정상 contract 통과 = 안전"

**거부 근거:**

XSS regex 의 자연어 false positive (CRITICAL-2) 는 fixture 에 자연어가 거의
없어 발현 불가. 진짜 위험은 BATCH 적재 시 한국어 교재 본문에서 `option =`,
`once = `, `online = ` 등의 우연 매칭. **테스트 fixtures 는 악의적 사례만 검증**
— 정상 자연어 다양성 cover 안 함.

추가: `Object.values(EXAM_IDS)` 는 현재 1개 literal 이라 substring 매칭으로도
unique 하지만 Year 2 시점 짧거나 자연어와 겹치는 ID 추가 시 silent rejection
폭발 (MAJOR-5). 본 commit 시점에는 무관하지만 확장 위험.

### 반론 3 — "Pre-flight 가 5종 vector 모두 잡으니 subprocess 보호 완료"

**거부 근거:**

Pre-flight 는 byte signature scan 만 수행 — 다음 vector 미차단:

- 정상 PDF signature + body + xref + 암호화 PDF (`/Encrypt` dictionary) → pdfplumber 가 password 요구 → subprocess 호출됨 + stuck
- 정상 PDF 인데 수만 페이지 (메모리 폭발) → fileSize 가 50MB 미만이면 통과 → subprocess CPU/메모리 폭발
- 정상 PDF + 악의적 colorspace / stream filter (정밀 corrupt) → subprocess 단계 crash

→ MAX_DECOMPRESSION_RATIO + MIN_PDF_BYTES + signature 만으로는 zombie 보호
불완전. CHA-02 (calculation timeout) 와 별개로 subprocess timeout
(`DEFAULT_TIMEOUT = 5min`) 이 마지막 방어선. **테스트 통과 ≠ 운영 안전.**

---

## 판정

**🔴 수정 필요 (CRITICAL 2건)**

- CRITICAL-1: subprocess counter race (idempotent decrement 적용)
- CRITICAL-2: XSS regex false positive (HTML context boundary 적용)

흡수 후 §5.4 진입 권장. MAJOR 5건 중 MAJOR-1 (fs error 분류) 와 MAJOR-4
(caller 분기) 는 본 commit 의도 완성을 위해 동일 §5.3 흡수 commit 에서
처리 권장. MAJOR-2 / MAJOR-3 / MAJOR-5 는 §5.4 초기 태스크로 명시 이월
가능.

**규칙 0 (자가 리뷰 금지) 준수:** 본 리뷰는 코드 작성 컨텍스트와 분리된 Pass 1
SURGEON 시각으로만 작성. Pass 2 ARCHITECT (의존 방향 / D1 schema / Workers 제약)

- Pass 3 ADVOCATE (UX / 보안 / 접근성) + Pass 4 CONTRACT (구현 재정립서 v2.0
  대조) 는 별도 에이전트 위임 의무.
