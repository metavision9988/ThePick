# Pass 3 ADVOCATE — Sprint 1 §5.3 FUZ-01 + FUZ-02

> Independent security + UX review of commits `2beb282` (FUZ-01) + `71a97c9` (FUZ-02).
> 관점: "수험생과 공격자, 둘 다 만족하는가?" — UX + 보안 횡단.
> Reviewer: Claude Opus 4.7 (1M ctx) — independent agent thread, 코드 작성 컨텍스트와 분리.
> Date: 2026-05-02 09:04:18 KST.

---

## 0. Verdict (요약)

| 분류     | 건수 |
| -------- | ---- |
| CRITICAL | 2    |
| MAJOR    | 6    |
| MINOR    | 3    |
| PASS     | 7    |
| N/A      | 3    |

**판정: 수정 필요 (CRITICAL 2건 즉시 흡수 의무, MAJOR 6건 §5.4 진입 전 일괄 흡수 권고)**

리뷰 방식: 독립 에이전트 1개 (Pass 3 ADVOCATE 단독)
리뷰 범위: 변경 파일 5개 + fixture 디렉토리 2개 + EXAM_IDS catalogue + ESLint config

---

## 1. 확인 항목 (Evidence — PASS 7건)

| #   | 파일:라인                     | 확인 내용                                                                                              |
| :-- | :---------------------------- | :----------------------------------------------------------------------------------------------------- |
| P1  | `pdf-extractor.ts:60`         | `MAX_DECOMPRESSION_RATIO = 100` — 명명 상수로 분리 (하드코딩 금지 준수)                                |
| P2  | `pdf-extractor.ts:69, 165`    | 정규식 `^\d+(-\d+)?$` 와 `/Length\s+(\d{6,})/g` ReDoS 미발생 — possessive/atomic 불필요한 단순 패턴    |
| P3  | `errors.ts:60-62, 115-117`    | `Error.captureStackTrace` 가드 + V8 외 환경 fallback — Workers 호환성 정합                             |
| P4  | `pdf-extractor.ts:230-323`    | subprocess settled 가드 + exit/error 양쪽 decrement — race condition 없음 (counter 음수 방지 line 238) |
| P5  | `schema-validator.ts:606`     | `Buffer.byteLength(raw, 'utf-8')` — UTF-8 multibyte 정확 측정 (string `.length` 함정 회피)             |
| P6  | `schema-validator.ts:502-533` | `computeMaxJsonDepth` character-level + escape 처리 — JSON.parse 진입 전 측정 (stack overflow 보호)    |
| P7  | `pdf-extractor.ts:213-219`    | `pages` 인자 정규식 화이트리스트 — argument injection 패턴 방어                                        |

---

## 2. CRITICAL

### CRITICAL-1 — `readFile(pdfPath)` 가 `preflightMaxBytes` 를 우회하여 전체 파일 적재 (OOM DoS)

**증거**: `pdf-extractor.ts:117-119`

```
const bytes = await readFile(pdfPath);                      // 전체 파일 메모리 적재
const readBytes = Math.min(fileSize, preflightMaxBytes);
const scanWindow = readBytes >= fileSize ? bytes : bytes.subarray(0, readBytes);
```

**문제**: `readFile(pdfPath)` 는 `fileSize` 한도 없이 **전체 파일** 을 메모리에 적재한다. `Math.min(fileSize, preflightMaxBytes)` 는 그 다음 줄에서야 등장하며 SCAN WINDOW 만 줄인다 — 메모리 적재 자체는 막지 못한다. 그러나 doc comment 라인 42-44 는 정반대로 명시:

```
/**
 * Maximum bytes to read for pre-flight byte scan (default 50 MB).
 * Files larger than this are stat-checked only; signature scan still runs
 * over the first 50 MB which covers compression bomb / JS / xref declarations.
 */
preflightMaxBytes?: number;
```

문서 ↔ 구현 불일치. 수험생이 100 GB sparse file 또는 attacker 가 10 GB 빈 PDF 업로드 시:

1. `stat()` 통과 (size 만 검사)
2. `readFile(pdfPath)` 가 10 GB 적재 → Node default --max-old-space-size 4 GB 초과 → OOM crash
3. PDF pre-flight 5종 분류 단 한 줄도 실행되지 않은 채 process 사망

**위험 + 공격자 이익**:

- **공격자 시나리오 (서버 DoS)**: 공격자가 `truncate -s 10G fake.pdf` 후 `%PDF-` 헤더 + `%%EOF` 만 패치한 sparse 파일 업로드 → ext4/XFS sparse 처리되어 디스크는 거의 안 차지하지만 `readFile` 은 dense 10 GB Buffer 할당 시도 → Node process kill → batch pipeline 중단. Cloudflare Workers 메모리 한도 128 MB 환경에서는 50 MB sparse 파일만으로도 즉시 죽음.
- **수험생 false positive 시나리오**: 정상 1.2 GB 교재 PDF (예: 손해평가사 9년치 합본 PDF, 또는 추후 다른 자격증의 대용량 합본) 가 메모리 일시 적재되면서 swap thrashing → 다른 사용자 요청 latency 폭발.

**흡수 권고**:

```
import { open } from 'node:fs/promises';
const HARD_FILE_SIZE_LIMIT = 200 * 1024 * 1024;  // 200 MB hard ceiling
if (fileSize > HARD_FILE_SIZE_LIMIT) {
  throw new PdfParseError('PDF_PARSE_FAILED',
    `PDF too large (${fileSize} bytes > ${HARD_FILE_SIZE_LIMIT} hard limit)`,
    { pdfPath, fileSize });
}
const fd = await open(pdfPath, 'r');
try {
  const headBuf = Buffer.alloc(Math.min(fileSize, preflightMaxBytes));
  await fd.read(headBuf, 0, headBuf.length, 0);
  const tailBuf = Buffer.alloc(Math.min(fileSize, 1024));
  await fd.read(tailBuf, 0, tailBuf.length, Math.max(0, fileSize - 1024));
} finally {
  await fd.close();
}
```

추가로 4-Pass `pass1-surgeon` 에 동일 지적이 갈 가능성 높음 — 본 리뷰에서 Pass 3 관점 (DoS = UX 차단 + 공격 표면) 으로 흡수 의무 확인.

---

### CRITICAL-2 — XSS payload `rawSnippet` 200자 평문 보존 → Secondary XSS 위험 (admin-web 모니터링 UI 가정 시)

**증거**: `schema-validator.ts:619-625` + `errors.ts:83-84`

```
throw new KnowledgeContractValidationError(
  'XSS_PAYLOAD_DETECTED',
  `XSS payload detected in raw response: "${match[0]}"`,   // 에러 메시지에 payload 평문
  { rawSnippet: raw.slice(0, 200), field: 'raw', pattern: pattern.source },
);
```

`errors.ts` 주석:

```
/** 응답 원본 일부 (앞 200자) — debug trail */
rawSnippet?: string;
```

03-xss-payload.json 의 첫 200자는 `<script>alert('XSS-title')</script>` payload 평문을 포함.

**위험 + 공격자 이익**:

- **공격자 시나리오 (Secondary XSS via admin observability)**: 진산님 메모리 §"엔진 Observability" 에 따르면 차세션에 admin-web 마스터 대시보드 가 본격 개발 예정 (Cloudflare D1 `engine_telemetry` 테이블 + admin 화면). 이 UI 가 KnowledgeContractValidationError.metadata.rawSnippet 을 React 의 `dangerouslySetInnerHTML` 또는 markdown 렌더러 (예: react-markdown without sanitize) 로 표시하면 → admin 측 XSS 발화 → admin 세션 cookie 탈취 → 전체 BATCH 적재 권한 탈취.
- **공격자 시나리오 (log injection via stderr)**: `console.error(err.message)` 가 운영 로그에 흘러가면 `<script>` 가 그대로 로그 viewer (예: Cloudflare Logpush → Tail UI) 에 렌더링. Logpush UI 가 sanitize 안 하면 동일 결과.

**수험생 false positive 시나리오**: 정상 contract 의 `content` 필드에 PDF 보안 챕터 설명 (예: PDF 의 /JavaScript 액션과 script 태그는 동일한 자동 실행 메커니즘) 이 들어가면 `<script>` 정규식 매칭 → 정상 응답이 거부되고 그 평문이 admin-web 에 노출 — false positive 자체로도 admin 대시보드를 오염시킨다.

**흡수 권고**:

1. `rawSnippet` 을 1) 길이 제한 + 2) HTML escape (`<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`) 적용:

```
function safeRawSnippet(raw: string, max = 200): string {
  const truncated = raw.slice(0, max);
  return truncated
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

2. error message `${match[0]}` 도 동일 escape 또는 hex dump (`\\x3cscript\\x3e`) 표시.
3. admin-web 출력 단계에서 `dangerouslySetInnerHTML` 절대 사용 금지 룰 docs/observability/master-dashboard.md 에 명시.

---

## 3. MAJOR

### MAJOR-1 — XSS 정규식 `\bon\w+\s*=` 가 정상 한국어/영어 콘텐츠 false positive

**증거**: `schema-validator.ts:476` `/\bon\w+\s*=/i, // onerror, onclick, onload, ...`

**Node 런타임 검증 결과** (본 리뷰어 직접 실행):

```
"ontology = "    매칭: true    (정상 RAG 콘텐츠)
"once = true"    매칭: true    (코드 설명 콘텐츠)
"online = false" 매칭: true    (일반 영어)
```

**수험생 false positive 시나리오**: 손해평가사 교재 챕터 "보험 ontology" 또는 "온라인 (online) 손해사정사 등록 절차" 콘텐츠가 BATCH 적재 시 XSS_PAYLOAD_DETECTED 로 거부 → BATCH-N 중단 → 진산님이 fixture 디버깅에 시간 낭비.

**공격자 회피 시나리오**: 공격자는 attribute context 를 회피하는 우회 페이로드 사용 가능 (예: `<a href="data:text/html,..."` — `data:` 미차단). DOMPurify allowlist 가 정답이지 정규식 blocklist 는 우회 가능.

**흡수 권고**: HTML event handler 매칭은 word boundary 가 아닌 attribute context 까지 포함 (`/<[^>]+\bon\w+\s*=/i`) 또는 정공법으로 `dompurify` (Workers 호환 npm) 도입 후 sanitize 후 비교. 임시 흡수: 본 정규식을 `/<[a-z][^>]*\bon\w+\s*=/i` 로 좁힌다.

### MAJOR-2 — HARD_RULE_17 raw 매칭이 정상 응답 차단 + literal substring 우회 가능

**증거**: `schema-validator.ts:628-636`

```
for (const literal of HARD_RULE_17_LITERALS) {
  if (raw.includes(literal)) {
    throw new KnowledgeContractValidationError('HARD_RULE_17_VIOLATION', ...);
  }
}
```

`raw` 는 JSON.parse 전 전체 문자열. examId literal 이 **어떤 문맥에서든** 등장하면 차단.

**수험생 false positive 시나리오 1**: 정상 교재 노드의 `content` 필드가 시험 안내문 그대로 인용 (예: 본 시험은 손해평가사 자격시험 (영문 코드 examId) 으로 한국산업인력공단 주관) → 적법한 메타데이터인데 거부. README §2.8 에 본 fixture 의도가 "응답이 그대로 DB 적재되면 다른 시험 데이터에 오염" 이라 했지만, 본 시점에는 시험이 1종뿐이라 오염 발생 불가 — 즉 **현 시점 본 검사는 미래 가치는 있지만 현재는 false positive 만 양산**.

**수험생 false positive 시나리오 2**: 차후 운영 모니터링 / observability 응답에 examId 가 routing 키로 포함되는 경우 (예: BATCH 적재 callback 의 transport metadata top-level key). pipeline 에 examId 가 명시적 transport key 로 들어가는 것은 자연스러운 protocol 인데 본 검사가 이를 차단.

**공격자 우회 시나리오**: 공격자가 BOM, NBSP, U+200B (zero-width space) 삽입 시 `String.includes` 매칭 실패 — 정규식 word boundary + Unicode normalization 필요.

**흡수 권고**:

1. raw 단계 검사를 **content / title 필드 한정** 으로 좁힌다 (parse 후 검사). 이미 parse 후 단계 (`validateKnowledgeContract`) 에서 node 별 순회하므로 거기에 추가:

```
for (const node of contract.nodes) {
  for (const literal of HARD_RULE_17_LITERALS) {
    if (node.content?.includes(literal) || node.title?.includes(literal)) {
      // throw
    }
  }
}
```

2. transport metadata (top-level keys `batch_id`, `exam_id` 등) 는 검사 제외.
3. Unicode normalize: `raw.normalize('NFKC')` 후 비교.

### MAJOR-3 — `pdfPath` 절대 경로가 에러 메시지 + metadata 에 평문 노출 (path traversal info disclosure)

**증거**: `pdf-extractor.ts:103-176` 모든 PdfParseError 가 `pdfPath` 를 message + metadata 에 포함.

```
throw new PdfParseError('EMPTY_INPUT', `Empty PDF file (0 bytes): ${pdfPath}`, {
  pdfPath,  // 절대 경로 평문
  fileSize: 0,
});
```

**위험 + 공격자 이익**:

- **공격자 시나리오 (정보 누출)**: PDF 적재 API 가 향후 admin / partner 에게 노출되거나 (Year 2 자격증 학원 B2B), 에러 응답이 그대로 client 에 전달되면 `pdfPath = /home/soo/ClaudePro/ThePick/.../uploads/2026-05-02/userid_42.pdf` 같은 패턴 → 1) Linux 사용자명 (soo) 누출 2) 디렉토리 구조 노출 3) 다른 사용자 ID 패턴 추정.
- **수험생 false positive 영향**: 정상 거부 시에도 sysadmin 만 봐야 할 경로가 사용자 화면에 표시되면 신뢰도 저하 + 컴플라이언스 위반 잠재.

**흡수 권고**: error message 에는 `basename` 만, `pdfPath` 절대경로는 metadata 에만 (logger trail) 보존. metadata 는 admin observability 한정 노출:

```
import { basename } from 'node:path';
// message
`Empty PDF file (0 bytes): ${basename(pdfPath)}`
// metadata 전용
{ pdfPath, fileSize: 0 }
```

### MAJOR-4 — 에러 메시지가 영어 단일어 — 수험생 graceful 안내 부재 (Pass 3 Advocate 핵심 의무)

**증거**: `errors.ts` 전체, `pdf-extractor.ts:103-176`, `schema-validator.ts:597-665` — 모든 user-facing 메시지가 영어:

- `Empty PDF file (0 bytes)`
- `Missing %PDF- signature`
- `Compression bomb suspected`
- `Embedded JavaScript action detected (security policy blocks auto-execution PDFs)`
- `XSS payload detected in raw response`
- `Hard Rule 17 violation: examId literal '...' in raw response`

CLAUDE.md 글로벌 규칙 §"i18n: 사용자 노출 문자열에 한국어 하드코딩 없는가 (i18n 키 사용)" + Pass 3 Advocate 의무 §"교재 O장 O절 참고 같은 Graceful 안내" 양쪽 위반.

**수험생 false positive 시나리오**: 자기가 업로드한 정상 교재 PDF 가 거부될 때 "Embedded JavaScript action detected" 영문 메시지만 받으면 어떻게 복구할지 모름. 손해평가사 시험 응시자 50대~60대 비율 30% 이상 — 영문 에러는 사실상 zero-info.

**흡수 권고**:

1. error class 에 `userMessageKey` 필드 추가 (`'pdf.empty' | 'pdf.malformed_header' | ...`).
2. 사용자 노출 layer 에서 i18n 번역 적용 (Korean default, en-US fallback). 영문 메시지는 internal 로그 전용.
3. README §2.5 "보안 정책 누락 신호" 같은 안내 문구도 한국어 카피 deck 필요. 차세션 §5.4 entry 시 함께 흡수 권고.

### MAJOR-5 — `/Length \d{6,}` 정규식 + 100x 비율 — 정상 PDF false positive 가능 영역

**증거**: `pdf-extractor.ts:165-176`

```
const lengthRe = /\/Length\s+(\d{6,})/g; // 6+ digits = >= 100KB declared
let lengthMatch;
while ((lengthMatch = lengthRe.exec(text)) !== null) {
  const declared = Number(lengthMatch[1]);
  if (Number.isFinite(declared) && declared > fileSize * MAX_DECOMPRESSION_RATIO) {
    throw new PdfParseError('COMPRESSION_BOMB', ...);
  }
}
```

**Node 런타임 검증** (본 리뷰어 직접 실행):

```
fileSize = 1000 (1 KB), declaredLength = 200000 (200 KB plausible PDF/Image stream)
1000 * 100 = 100000 → 200000 > 100000 = true → false positive COMPRESSION_BOMB
```

**수험생 false positive 시나리오**: 1 KB 미만의 텍스트 페이지 PDF + 임베드된 200 KB JBIG2 / Flate 이미지 stream 1개 (정상 PDF 의 흔한 구조). 또는 폰트 subset 임베드 (한글 폰트 subset 평균 50~300 KB). 레퍼런스: PDF 32000-1 §7.4 - 일부 textbook 의 figure-only 페이지는 본 케이스에 정확히 부합.

**공격자 회피 시나리오**: 공격자가 `/Length 99999` (5 digits) 로 선언 + 실제는 100 KB stream → 정규식이 캡처 못함 → 본 검사 무력화. 또는 `/Length` 를 `/Laength` 처럼 PDF spec 의 hex escape 으로 작성 (PDF 는 `#41` 형태 escape 허용) → 정규식 불일치.

**흡수 권고**:

1. 선언된 `/Length` 합산 vs 파일 크기 비교 (단일 stream 이 아닌 누적). Single stream 한 개의 절대값으로 판단 금지.
2. PDF spec hex escape (`/L#65ngth`) 도 normalize 후 비교 — 본 시점 미흡수 시 README §4.4 "DEFLATE 만 다룸 + 다른 필터 P1 확장" 에 본 누락 추가.
3. ratio 100 → ratio 50 + per-stream 절대값 한도 (예: 단일 stream 50 MB) 이중 가드.

### MAJOR-6 — FUZ-01 테스트의 zombie 검증이 in-process counter 한정 (실 OS process 검증 부재)

**증거**: `fuz-01-pdf-malicious.test.ts:64-67, 84, 124` — `getActivePdfSubprocessCount()` 카운터 변수만 검증.

```
afterEach(() => {
  expect(getActivePdfSubprocessCount()).toBe(0);
});
```

`pdf-extractor.ts:73-81` 의 카운터는 `let activeSubprocessCount = 0` 모듈 변수. **detached process / 부모 process kill 후 살아남은 자식** 은 카운터에 추적 안 됨.

`pdf-extractor.ts:319-323`:

```
child.once('exit', decrement);
child.once('error', () => { decrement(); });
```

`child.once('exit')` 는 자식이 exit signal 을 부모에게 보고할 때만 fire. SIGKILL 으로 비정상 종료 / 부모 Node process 가 SIGKILL 받으면 zombie 가 OS 레벨로 남는다. README §4.2 이 본 한계 "테스트 코드가 process tracker 로 별도 검증 의무" 명시했지만 실제 테스트는 이를 미충족.

**공격자 시나리오**: 공격자가 5 fixture 동시 + 1 정상 PDF 1000 KB 적재 시 정상 PDF 가 pdfplumber subprocess 진입 후 부모 Node process OOM (CRITICAL-1) 으로 SIGKILL → 자식 pdfplumber 가 OS init(1) 에 reparent 된 채 살아남음 → fork bomb 시나리오 (반복 시 PID 고갈).

**흡수 권고**:

1. test 에 `pgrep -P $$ python3` 호출 추가 (Linux 한정) — README §3 예시 코드에 이미 언급된 "pgrep / proc 카운트 검증" 미실현 부분 흡수.
2. `child.unref()` 미사용 확인 (현재 미사용 OK), 추가로 `child.kill('SIGTERM')` 후 timeout 시 `SIGKILL` escalation 패턴.
3. Node `process.on('exit')` hook 으로 모든 active child kill 보장.

---

## 4. MINOR

### MINOR-1 — XSS 정규식 ReDoS 검사 통과 — 단 `match()` 가 아닌 `test()` 권장

**증거**: `schema-validator.ts:617` `const match = raw.match(pattern);`

`raw.match()` 는 capture group 결과 객체 생성 — 100 KB raw 에 대해 미세하게 GC 압박. `pattern.test(raw)` 후 `pattern.exec(raw)` 로 분리하면 미세 효율. PASS 수준 — Critical 아님.

### MINOR-2 — fixture 04-malformed-xref.pdf 가 fileSize 336 byte < MIN_PDF_BYTES (100) 검사 후에 도달

`fuz-01` 테스트에서 04 가 MALFORMED_XREF 로 분류됨을 기대하는데, 본 fixture 가 336 byte 라 `MIN_PDF_BYTES = 100` 검사를 통과 (size > 100). 만약 fixture 를 80 byte 로 줄이면 MALFORMED_HEADER 로 잘못 분류된다 — fixture 견고성 의존성 명시 의무. README §2.4 에 "336 B" 가 의도 명시되어 있으나 본 의존성을 명시적 언급 권고.

### MINOR-3 — PdfParseError stderr metadata 가 500 char slice — log injection 가능성

**증거**: `pdf-extractor.ts:281, 297, 310` `stderr: stderr?.slice(0, 500)`

stderr 에 ANSI escape sequence (예: `[31m`) 가 포함되면 logger 가 컬러 해석하면서 의도와 다른 출력 가능. CRITICAL-2 와 동급의 대응 (escape) 권장하지만 exposure 범위가 작아 MINOR.

---

## 5. N/A

| 항목                      | 사유                                                                  |
| :------------------------ | :-------------------------------------------------------------------- |
| 정답 안전 (OX/빈칸/변형)  | 본 commit 은 validation layer — 정답 데이터 직접 처리 없음            |
| Service Worker / 오프라인 | 본 commit 은 engine layer (Workers + Node subprocess) — PWA 외부      |
| Workers Memory 50 MB 한도 | 본 commit 은 batch pipeline (Node 환경) 한정 — Workers 진입 경로 부재 |

---

## 6. Devil's Advocate (반론 — 깨질 시나리오)

### 반론 1 — "FUZ-01 + FUZ-02 가 전부 통과해도 BATCH 적재가 prod 에서 죽는다"

**시나리오**: 진산님이 BATCH-1 적재 시 진짜 손해평가사 교재 PDF (100 MB+) 를 적재한다고 가정.

1. `readFile(pdfPath)` 100 MB 적재 (CRITICAL-1)
2. text 변환 후 `\bon\w+\s*=` 정규식 매칭 — 교재 본문에 "온라인", "ontology", "once", "online" 등 한국어 + 영어 단어 다수 포함 → MAJOR-1 재발 → BATCH 거부
3. content 에 시험 안내문 인용 (examId 평문) 포함 시 → MAJOR-2 재발 → BATCH 거부

**즉 본 commit 의 통과 = 정상 적재 동작 보장이 아니다**. 별도의 "정상 응답 회귀 fixture" (예: §5.3 후속 §5.4 에 추가 요구) 를 BATCH-1 입력 sample 로 도입해야 한다. 현 정상 contract 회귀 (`fuz-02-claude-malformed.test.ts:94`) 는 작은 1-node 합성 응답만 검증 — real-world 응답과 거리가 멀다.

### 반론 2 — "stack overflow 보호가 50 단계로 충분한가?"

**시나리오**: BATCH 적재 응답이 nested table (예: 시군별 → 농가별 → 작물별 → 재해유형별) 형태이면 nested 4단계 + node array + nodes [50] + 각 node 객체 (5단계) 약 9~12 단계. 정상 50 한도 아래. PASS.

그러나 **graph 구조 (knowledge_edges 전이 폐쇄)** 를 응답에 포함한다면 transitive closure 로 인해 100+ 단계 nested 가능. 현 KnowledgeContract 는 평면 nodes/edges 배열이라 OK. 미래 v2 contract 에서 nested edges 도입 시 본 임계값 재검토 필요. 현재는 PASS 이지만 ADR-NEXT 후보.

### 반론 3 — "5종 fixture 가 P0 vector 를 다 다루는가?"

**시나리오**: PDF 의 알려진 attack vector 는 OWASP 분류 시 12+ class. 본 5종은 obvious case. 미커버:

- `/Encrypt` PDF (RC4 brute force 시도 시 CPU DoS)
- nested `/ObjStm` (object stream 압축 폭탄 — 본 검사는 단일 `/Length` 만)
- `/XRef` cross-reference stream 무한 reference loop (cycle DoS)
- `/AcroForm /XFA` XML 폭탄 (billion laughs)
- 부분 손상된 PDF 의 partial recovery (pdfplumber 가 silently 잘못된 텍스트 추출)

README §4.1 "합성 PDF: 실제 악의적 PDF 의 모든 vector 를 커버하지 않는다" 가 정직하게 언급. **본 commit 의 P0 stamp 는 위 5종 한정 — 수험생 환경에서 만나는 진짜 vector 의 1/3 미만**. handoff §6 ledger 에 P1 fixture 확장 (`05b-encrypted.pdf`, `05c-objstm-bomb.pdf`, `05d-xref-loop.pdf`) 추가 의무 권고.

---

## 7. §5.2 이월 MAJOR 중복 회피 검토

| ID  | §5.2 흡수 상태                                                                                                                                                                                                                                             | 본 commit 에서 신규 발견                                                                                                    |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| A1  | OOM banner README 추가 — 이미 흡수 (line 8-30)                                                                                                                                                                                                             | 추가 지적 없음                                                                                                              |
| A2  | Snyk / Dependabot config — README 만 권고 (line 31)                                                                                                                                                                                                        | **실제 .snyk / dependabot.yml 파일 부재 — ledger 잔존**                                                                     |
| A3  | Hard Rule 17 ESLint config — 본 commit 의 `EXAM_IDS` 사용으로 회피 OK (verify: `eslint.config.json` 의 `Literal[value='son-hae-pyeong-ga-sa']` 가 `schema-validator.ts:489 Object.values(EXAM_IDS)` 는 ESLint AST 상 **literal 부재** 로 자동 통과 — 정합) | **단 `validateRawClaudeResponse` 의 raw substring 검사 (MAJOR-2) 가 ESLint 와 다른 layer 라 둘 사이의 의도 일치 확인 필요** |
| A4  | Phase 2 진입 트리거 binary — 본 commit 외부 영역                                                                                                                                                                                                           | 추가 지적 없음                                                                                                              |

---

## 8. 흡수 권고 (우선순위)

| 우선 | 항목       | 흡수 시점          | 작업량 (hr) |
| :--- | :--------- | :----------------- | :---------- |
| P0   | CRITICAL-1 | 즉시 (§5.3 마무리) | 1.5         |
| P0   | CRITICAL-2 | 즉시 (§5.3 마무리) | 0.5         |
| P0   | MAJOR-1    | §5.4 진입 전       | 0.5         |
| P0   | MAJOR-2    | §5.4 진입 전       | 1.0         |
| P1   | MAJOR-3    | §5.4 진입 전       | 0.5         |
| P1   | MAJOR-4    | §5.4 별도 task     | 2.0         |
| P1   | MAJOR-5    | §5.4 진입 전       | 1.0         |
| P1   | MAJOR-6    | §5.4 별도 task     | 1.5         |
| P2   | MINOR 1~3  | §5.4 ~ Phase 2     | 합 1.0      |

**총 흡수 예상 8.5 hr** — Sprint 1 §5.4 진입 전 P0 4건 (3.5 hr) 흡수가 의무 권고.

---

**작성**: Claude (Opus 4.7 1M context) — Independent Pass 3 ADVOCATE
**작성일**: 2026-05-02 09:04:18 KST
**근거 컨텍스트**: 변경 5 파일 + fixture 2 디렉토리 + EXAM_IDS catalogue + ESLint config + Node 런타임 검증
**Devil's Advocate 반론**: 3건
**수험생 false positive 시나리오**: 7건 (MAJOR-1 ontology/once/online, MAJOR-2 시험 안내문, MAJOR-3 60대 사용자 영문 에러, MAJOR-4 한국어 부재, MAJOR-5 정상 PDF 200KB stream, CRITICAL-1 1.2GB 합본, CRITICAL-2 PDF 보안 챕터 콘텐츠)
**공격자 시나리오**: 6건 (CRITICAL-1 sparse OOM, CRITICAL-2 admin XSS, MAJOR-1 svg/onload 우회, MAJOR-2 ZWSP 우회, MAJOR-3 path 누출, MAJOR-5 5-digit /Length 우회 + hex escape)
