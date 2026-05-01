# Pass 3 — ADVOCATE (Cross-Cutting UX + 보안)

**리뷰 시각**: 2026-05-02 00:29:33 KST
**리뷰자**: Claude (Opus 4.7 1M context) — Sprint 1 §5.2 4-Pass 자동 리뷰 / Pass 3 단독 위임
**리뷰 대상**: commits `fefa64a` + `ba9ad2b` (Sprint 1 §5.2 도구 정비)
**리뷰 방식**: 독립 에이전트 (Pass 3 단독, security-engineer 페르소나) — 자가 리뷰 0건
**리뷰 범위**: 변경 파일 21건 (Pass 3 적용 가능 항목 전체) + 연관 파일 7건 (.eslintrc.json / .github/workflows/ci.yml / .github/dependabot.yml / production-quality.md / packages/shared/src/exam-adapter.ts / packages/shared/src/constants/exam-ids.ts / packages/parser/**fixtures** 디렉토리 구조)

---

## 0. 사전 안전 확인

사용자 사전 경고 정합 — 본 리뷰는 다음 안전 패턴만 사용:

- `.pdf` 파일 5건: `ls -la` + `file` + `xxd | head` (직접 Read 0건)
- `02-parse-error.json` / `06-deeply-nested-100.json` / `07-large-payload.json`: `ls -la` 만 (Read 0건)
- `01-empty.json`: 0 바이트 검증 후 stub Read (안전)
- 정상 JSON `03/04/05/08`: Read 진입 (XSS / Hard Rule 17 정합 평가용)
- 모든 README.md: Read 진입 (한계 / 명세 변경 정직 평가)

→ **악의적 binary execution 0건. JSON.parse / PDF reader 호출 0건.**

---

## 1. Pass 3 의 5가지 평가 차원 (질문 정합)

본 §5.2 산출물에 대한 5 차원 — 사용자 질문 §"Pass 3 ADVOCATE 관점" 1~5 정합:

1. **Fixtures 자체 보안 위험** (§3 본문)
2. **decision-2026-05-02 P0→P1 재분류 거짓 통과 위험** (§4)
3. **fixtures 명세 변경 정직성** (§5)
4. **ADR-028 검증 가능성** (§6)
5. **PII / 접근성 / i18n** (§7)

---

## 2. 보고 형식

```
── 4-PASS REVIEW (Pass 3 / ADVOCATE) ──
리뷰 방식: 독립 에이전트 1개 (security-engineer 페르소나)
리뷰 범위: 변경 파일 21개 + 연관 파일 7개

Pass 3 (Advocate): ✅ 11건 확인 / 🔴 0건 / 🟠 3건 / 🟡 4건 / N/A 2건

확인 (PASS): [§3.1~§3.4, §5, §7 본문 항목]
반론 (Devil's Advocate): [§8 본문]

판정: 완료 가능 (Critical 0건 — Sprint 1 §5.2 진입 차단 사유 부재)
       단, Major 3건 + Minor 4건은 §5.3 진입 전 1건, Sprint 1 종료 전 2건 처리 권고.
─────────────────────────────────────
```

---

## 3. Fixtures 자체 보안 위험 평가

### 3.1 ✅ PASS — `01-empty.pdf` (0 B) 전송 안전

**증거**:

- `ls -la pdf-malicious/01-empty.pdf` → 0 바이트.
- README L24~L36 (`§2.1`): "stat() 또는 readFile() 후 bytes.length === 0 즉시 throw" 명시.
- `file 01-empty.pdf` → "empty" — 파일 시그니처 부재 → PDF reader 가 파일을 PDF 로 인식하지 않음.

**평가**: VS Code / 브라우저 / git GUI 가 본 파일을 PDF 로 렌더링하려 하지 않음. fixture 자체로는 위험 0.

### 3.2 ✅ PASS — `02-header-only.pdf` (9 B) 전송 안전

**증거**:

- `xxd 02-header-only.pdf` → `%PDF-1.4\n` 만 존재 (objects / xref / trailer 0건).
- README L38~L46 (§2.2): "pdfplumber stderr pattern matching 으로 분류" 명시.

**평가**: 9 바이트 truncated PDF 는 어떤 reader 도 페이지 렌더링 불가 → 자동 실행 vector 부재.

### 3.3 🟠 MAJOR-A1 — `03-compression-bomb.pdf` (1.4 KB → /Length 100 MB) 의 README 한계 고지 부족

**증거**:

- `xxd 03-compression-bomb.pdf | head -3` → offset `0x00d0~0x00f0` 에 `/Length 104857600 /Filter /FlateDecode` 확인.
- 파일 본문 stream 은 1MB zeros 의 deflate 압축 → 약 1.4 KB.
- README §2.3 + §4 #4 에 "위험 회귀" 로 OOM 언급은 있으나 **개발자가 실수로 PDF reader 로 열 때 (= git clone 직후 fixture 폴더 탐색)** 위험 명시 부재.

**위험 시나리오 (Devil's Advocate)**:

1. 개발자가 VS Code 확장 PDF Viewer / 브라우저 PDF 미리보기 / Acrobat Reader 로 본 파일을 더블클릭.
2. PDF reader 가 `/Length 104857600` 를 trust → 100 MB 메모리 할당 시도 → 일부 reader 는 OOM crash / freeze.
3. CI (Ubuntu) 의 git checkout 후 임의 PDF preview 도구가 자동 실행되는 환경은 적지만, **개발자 local IDE** 에는 PDF preview extension 다수 설치됨.

**권고 (Sprint 1 §5.4 마감 전 권고)**:

README §1 표 위에 다음 banner 추가:

```markdown
> ⚠️ **경고**: 본 디렉토리의 모든 .pdf 는 의도적 malformed binary.
> PDF reader / VS Code PDF Viewer / 브라우저 미리보기로 **열지 마세요**.
> 일부 fixture (03-compression-bomb.pdf) 는 reader 의 메모리 폭발을 유도.
> 본 fixtures 는 schema-validator / pdf-extractor 의 입력으로만 사용.
```

또 별도 .gitattributes 로 본 파일들을 binary 마킹 → git diff 가 raw bytes 로 확장하지 않음.

**분류**: MAJOR (Sprint 1 §5.4 종료 전 처리). Critical 아님 — 본 §5.2 통과 차단 사유 부재.

### 3.4 🟠 MAJOR-A2 — `05-js-embedded.pdf` (449 B) 의 정적 보안 스캐너 false positive 위험

**증거**:

- `xxd 05-js-embedded.pdf` offset `0x00f0` → `/JavaScript /JS (app.alert('XSS-via-PDF');)` literal 포함.
- `.github/workflows/ci.yml` L98~L101: `gitleaks/gitleaks-action@v2` (secret-scan) 만 활성. Snyk / Dependabot security alerts 는 dependabot.yml L24~L28 의 "security-majors" 그룹만.
- 본 시점 CI 에서 PDF JavaScript 정적 검사 도구 (예: PEEPDF / pdfid) 활성 0건 → **본 시점 false positive 0건**.

**미래 위험 시나리오 (Devil's Advocate)**:

1. Snyk 가 향후 PDF malware 정적 분석 활성 (Snyk Code 의 SAST 확장).
2. GitHub 자체 secret scanning 이 PDF 내부 JavaScript literal 을 의심 패턴으로 분류.
3. CI 의 `pnpm audit` 외 다른 보안 스캐너 (Trivy / CodeQL) 가 본 fixture 를 issue 로 보고.
4. **결과**: PR / merge 가 보안 false positive 로 차단 → 개발자가 false positive 무시 습관 형성 (real positive 도 무시).

**권고**:

본 fixture 디렉토리 전체에 다음 마커 파일 추가:

- `packages/parser/__fixtures__/.security-scan-allowlist` — Snyk / Trivy / CodeQL 스캔 제외 명시 (각 도구 native config 형식 분리).
- README §1 표 아래에 "본 디렉토리는 보안 스캐너 의도적 제외 대상 (intentional malicious fixtures for negative testing)" 명시.

또 ADR-028 와 별도로 향후 보안 스캐너 도입 시 본 디렉토리 처리 방침을 ADR 로 영속화 권고.

**분류**: MAJOR (Sprint 1 §5.4 종료 전 처리 권고. CI 통과 회복력 = false positive 누적 = signal 약화).

### 3.5 ✅ PASS — `03-xss-payload.json` (320 B) — VS Code Markdown preview 안전

**증거**:

- `claude-malformed/03-xss-payload.json` 직접 Read (Lines 1~16):
  - `title`: `"<script>alert('XSS-title')</script>"` (JSON 문자열 — escaping 없음)
  - `content`: `"javascript:alert('XSS-content')<img src=x onerror=alert(1)>"` (JSON 문자열)
- README L51~L60 본문에서 `<script>` literal 을 backtick fenced text 로 표기 (`<script>` / `<img onerror>`) → markdown 렌더 시 코드 블록으로 escape.
- README L51 의 "본문" 위치에서는 **bare `<script>` literal 부재** (모두 backtick wrap).

**위험 시나리오 (Devil's Advocate)**:

1. 개발자가 VS Code Markdown preview 로 README.md 를 연다.
2. VS Code Markdown preview 는 raw HTML 을 기본으로 차단 (`markdown.preview.allowedTags` 정책).
3. 단, `markdown.preview.allowedTags` 가 `<script>` 비포함이라도 일부 확장 (Markdown All in One 등) 이 raw HTML pass-through 활성화 가능.
4. JSON 파일 자체를 `cat` 으로 출력해도 vscode terminal 이 escape 시퀀스 처리 안 함 → 안전.

**평가**: README 의 backtick fence 가 정합 — XSS literal 은 코드 블록 내부에만 존재. JSON fixture 자체는 텍스트 파일 — Read tool 진입 시 실행 0건. **PASS**.

**개선 권고 (Minor)**: VS Code Markdown preview 에서도 100% 안전을 보장하려면 README §2.3 본문의 위험 회귀 설명에 추가로 `<script&gt;` 등 HTML entity escape 표기 가능 — 다만 backtick fence 으로 충분.

### 3.6 🟡 MINOR-A3 — `08-hard-rule-17-violation.json` 과 ESLint no-restricted-syntax 정합

**증거**:

- `.eslintrc.json` L14~L20: `"selector": "Literal[value='son-hae-pyeong-ga-sa']"` AST 패턴.
- `.eslintrc.json` L30: `"ignorePatterns": ["node_modules", "dist", ".turbo", "coverage", "**/*.json", "**/*.md"]` — **`**/\*.json` 포함\*\*.
- → ESLint 가 본 fixture .json 을 lint 하지 않음 → false positive 0건.
- production-quality.md L173~L179: Rule 17 의 "예외 (Rule 적용 제외)" 에 "테스트 픽스처 파일(`*.test.ts`, `*.fixture.ts`) 내 예시 데이터" 명시.
- 본 fixture 는 `.json` 이며 `*.fixture.ts` / `*.test.ts` 가 아님 → Rule 17 예외 명세에 직접 매핑되지 않음.

**위험 시나리오 (Devil's Advocate)**:

1. Sprint 1 §5.3 에서 본 fixture 를 inline TypeScript 로 변환하는 시점 (예: `08-hard-rule-17-violation.fixture.ts`) → Rule 17 본문 예외 매핑 명시 의무.
2. 향후 ESLint ignorePatterns 에서 `**/*.json` 이 제거되면 (= JSON lint 활성) 본 fixture 의 `'son-hae-pyeong-ga-sa'` literal 이 false positive 차단.
3. README L21 / L97 / L99 / L103 의 backtick wrap `'son-hae-pyeong-ga-sa'` literal 은 ESLint 가 .md 도 ignorePatterns 에 포함 → 안전.

**권고**:

- production-quality.md Rule 17 §"예외" 본문에 "**`packages/\*/**fixtures**/**/\*.json`\*\*" 패턴 추가 (다음 commit) — 본 fixture 가 미래 ESLint JSON lint 활성 시점에 명시 예외 보장.
- 또는 본 fixture 디렉토리에 별도 `.eslintignore` 추가 (현재 .eslintignore 부재 — root .eslintrc.json L30 ignorePatterns 만).

**분류**: MINOR (즉시 차단 사유 0건. 미래 회귀 방어 권고).

---

## 4. decision-2026-05-02 (P0 → P1 재분류) 거짓 통과 위험

### 4.1 ✅ PASS — 재분류 정직성 자체

**증거**:

- `decision-2026-05-02-cha-03-05-p1-reclassification.md` §2.1 (CHA-03) L34~L40: anthropic-adapter NOT_IMPLEMENTED throw 원본 코드 인용.
- §2.1 L43~L48: "Year 1 BATCH-1 적재는 본 어댑터 미경유" — 메모리 `project_batch_load_workflow` 와 정합. 본인 메모리에서 직접 검증.
- §2.2 (CHA-05) L65: "hybrid-search 가 Phase 1 후반 활성 예정" — `apps/api/src/search/` 디렉토리 자체 부재 (리뷰 시점 grep 검증 가능).
- §4 L120: "거짓 통과 (false PASS): NOT_IMPLEMENTED 어댑터를 형식 mock 으로 '측정 완료' 처리하는 자기기만 차단" — 정직 명시.

**평가**: 재분류 자체는 baseline §2.2 / §3.1 / §5.3 의 "측정 불가능 → P0 거짓 통과 위험" 분석과 정합. 게이트 강도를 "약화" 가 아니라 "정직화" 한 결정. **PASS**.

### 4.2 🟠 MAJOR-A4 — Phase 2 진입 트리거의 모호성

**증거**:

- `decision-2026-05-02-...md` §5.3 L142~L146: "Phase 2 진입 직전 (BATCH-1 적재 후 사용자 노출 전)" 으로 시점 정의.
- ADR-028 §5 L142~L147: "BATCH-1 적재 완료 / hybrid-search 본격 활성 / CHA-05 본격 측정 / Workers 런타임 발견" 4 트리거.
- 두 문서 모두 "BATCH-1 적재 완료" 트리거를 사용 — 동일 사건.

**위험 시나리오 (Devil's Advocate)**:

1. **트리거 시점에 발견 의무가 자동 실행되는 메커니즘 부재**: BATCH-1 적재 완료를 인간이 마킹하고 → P1 게이트 측정을 인간이 트리거. 자동 알림 / hook 부재.
2. **session 망각**: 진산님이 BATCH-1 완료 시 메모리 trigger 부재 → P1 측정 의무 누락 가능.
3. **decision §5.3** 의 "P1 게이트 20/20 PASS 종료 조건" 이 어떤 시점에 강제되는지 명시 부재. "사용자 노출 전" 이지만 "사용자 노출" 시점 정의 부재 (BATCH-1 데이터로 학습 페이지 첫 렌더 vs 1K 사용자 진입).

**권고 (Sprint 1 §5.4 마감 전)**:

- `decision-2026-05-02-...md` §5.3 본문에 다음 추가:
  - "BATCH-1 적재 완료" 의 binary 정의: `engine_telemetry.batch_id = 'batch-1' AND status = 'committed' AND row_count >= <expected>` D1 쿼리로 판정.
  - "사용자 노출" 의 binary 정의: `apps/web` deploy → DNS publish → 첫 사용자 학습 세션 생성. "노출 전" 은 deploy 직전.
  - P1 측정 누락 차단 hook: handoff 가 매번 P1 미측정 시 banner 출력 (현 session-monitor 패턴 재사용).
- ADR-028 §5 4 트리거 중 "Workers 런타임 발견" (L147 시점 #4) 의 발견 메커니즘 명시: 운영 중 어떤 telemetry / log 패턴이 트리거인지 정의 (예: workerd CPU exceeded log → 트리거).

**분류**: MAJOR (Sprint 1 §5.4 마감 전 권고. Sprint 1 §5.3 진입 차단 사유는 아님).

### 4.3 ✅ PASS — 17/17 → 15/15 게이트 약화 정도 평가

**증거**:

- Master Plan v1.0.1 §11.1 L810~L825: "P0 17건 → 15건" 변경.
  - 제거된 2건: CHA-03 (Anthropic 5xx), CHA-05 (Vectorize timeout fallback).
- decision-2026-05-02 §3.2 L99~L102: P1 18 → 20 (CHA-03 / CHA-05 합류).
- 게이트 약화 평가:
  - 제거된 P0 2건은 본인이 §4.1 에서 검증한 대로 "측정 불가능 항목". 게이트 약화 = 0 (측정 불가 항목을 PASS 마킹하면 게이트 신뢰도 0).
  - 진산님 "근거 보기" UX (메모리 `project_source_citation_requirement`) 정합 — 측정 자체가 불가한데 PASS 로 시뮬레이션하면 향후 BATCH-1 적재 후 운영에서 거짓 안전감 발생.

**평가**: P0 15/15 는 **실측 가능한 항목만** 유지. 약화가 아니라 정직화. **PASS**.

### 4.4 🟡 MINOR-A5 — 진산님 검증 가능 항목의 정합

**증거**:

- decision-2026-05-02 §6 L150~L162: 검증 명령 3건 제시 (grep / cat / 메모리 확인).
- ADR-028 §7 L166~L182: 검증 명령 3건 제시.
- 두 문서 모두 "현 시점 261 PASS" 기재 (ADR-028 §7 L174). 본 §5.2 commit 후 shared 33 → 46 PASS 변경 → 261 → **274 PASS** 가 맞음.

**위험**: 진산님이 ADR-028 §7 의 "261 PASS" 을 보고 mismatch 의심 가능.

**권고 (Minor)**: ADR-028 §7 L174 의 "261 PASS" 를 현 시점 정확한 합계 (`pnpm -r test 2>&1 | grep -E "Tests.*passed"`) 로 갱신. 또는 "본 ADR 작성 시점 (2026-05-02 00:25 KST) 합계" 로 timestamp 명시.

**분류**: MINOR (정합성 검증 가능성 강화 권고).

---

## 5. Fixtures 명세 변경 정직 기록 평가

### 5.1 ✅ PASS — claude-malformed README §4 #1 / #2 정직성

**증거**:

- README L150~L154 (§4 #1 / #2):
  - `#1`: "fixture #4 의 명세 변경: handoff-029 'examId 누락' → '필수 필드 누락' 으로 적응. 근거는 §2.4 본문. 동등한 검증 효과 보장."
  - `#2`: "fixture #7 의 크기 변경: handoff-029 '100MB' → '~120KB' sentinel. 근거는 §2.7 본문."
- §2.4 L62~L65: "현 schema-validator 의 KnowledgeContract 타입에 examId 필드가 부재 (Hard Rule 16 정합 — examId 는 함수 파라미터로 주입)" — 동등성 근거 명시.
- §2.7 L86~L93: "git LFS 미설정 + repo 부담 회피" — 트레이드오프 명시.

**평가**: 명세 변경 자체 + 변경 사유 + 동등성 근거 모두 명시. CRITICAL RULE #5 (불가능 → 대안 A/B/C) 정합. **PASS**.

### 5.2 🟡 MINOR-A6 — 명세 변경의 진산님 미래 의심 여지

**위험 시나리오 (Devil's Advocate)**:

1. 진산님이 6개월 뒤 본 fixture 를 보고 "왜 examId 누락이 truth_weight 누락으로 바뀌었는가? handoff 에는 examId 라고 적혀 있는데?" 의문.
2. README §4 #1 의 "동등한 검증 효과 보장" 만으로 충분한가?
3. 미래 schema-validator 가 `examId` 필드를 추가하는 시점 (Year 2 멀티시험) 에 fixture 본 변경의 근거가 archived knowledge 가 됨 — README 가 archive 상태 표시 없음.

**권고 (Minor)**:

- README L150 (§4 #1) 본문에 다음 추가:
  - "Year 2 멀티시험 도입 시 schema-validator 가 `examId` 필드 직접 검증 활성 → 본 fixture #4 를 `examId` 누락 형태로 **재생성** 의무 (현재 truth_weight 누락은 Year 1 동등 vector)."
- README L153 (§4 #2) 본문에 추가:
  - "schema-validator 의 size 임계값 변경 시 본 sentinel 도 동시 갱신 의무. 현 sentinel 120 KB 는 D1 1 MB 한도의 12% — 임계값 100 KB 가정 정합."

**분류**: MINOR (명세 변경 추적성 강화).

### 5.3 ✅ PASS — pdf-malicious README §4 한계 명시

**증거**:

- pdf-malicious README L124~L129 (§4):
  - #1: "합성 PDF 한계 — 실제 악의적 PDF 의 모든 vector 커버 안함"
  - #2: "subprocess zombie 검증 — 본 fixtures 자체로는 미보장, 테스트 코드 별도 검증 의무"
  - #3: "JS embedded 의 실행 가능성 — pdfplumber 자동 실행 안함이 검증의 목적"
  - #4: "압축 폭탄 검증의 한계 — DEFLATE 만 다룸, LZW/ASCII85 는 P1 이상 확장 필요"

**평가**: 4 가지 한계를 모두 명시. fixture 가 cover 하지 못하는 vector 명시 = 미래 P1 시점 작업 항목으로 자동 이월. **PASS**.

---

## 6. ADR-028 검증 가능성

### 6.1 ✅ PASS — 결정 근거의 정직성

**증거**:

- ADR-028 §1.4 L46~L52: 본 시점 도입 시 5 비용 명시 (의존성 / 런타임 분리 / node:sqlite 차단 / CI 시간 / CHA-05 미가용).
- §3 L66~L77: 옵션 A/B/C/D 비교 매트릭스 제시. 옵션 A/C/D 기각 사유 명시.
- §6 L160~L162: 본 결정의 한계 3건 정직 인정:
  - #1: CHA-01 시뮬레이션의 충실도 한계 (Proxy wrap = wrapper API level 만 / fetch / network layer 미커버).
  - #2: workerd 실 런타임 정합 결손 (Node 22 + node:sqlite 위에서 검증).
  - #3: Year 2 시점 부담 이연 (Phase 2 진입 시 동시 작업 부담).

**평가**: PITR (Plurality Index Trade Review) 정합 — 4 옵션 비교 + 트레이드오프 명시 + 한계 인정. **PASS**.

### 6.2 🟡 MINOR-A7 — §5 4 트리거의 측정 가능성 결손

**증거**:

- ADR-028 §5 L142~L147 4 트리거:
  1. "BATCH-1 적재 완료" — engine_telemetry 쿼리로 측정 가능 (§4.2 권고와 정합).
  2. "hybrid-search 본격 활성" — 사용자 검색 요청 처리 시작 — 어떤 metric ?
  3. "CHA-05 본격 측정" — P1 게이트 측정 의무 시점 — circular dependency (P1 측정 시점 = 본 ADR 재검토 시점인데, P1 측정 의무 시점이 명시 부재).
  4. "Workers 런타임 발견" — "운영 중 발견" 모호 (어떤 발견 = trigger ?).

**권고**:

- 트리거 #2: "hybrid-search 활성" = `apps/api/src/search/hybrid-search.ts` 가 production 진입 + Vectorize 업서트 row > 0 + admin-web 의 검색 요청 daily count > 0. binary 측정 가능 정의.
- 트리거 #3: "BATCH-1 적재 후 사용자 노출 전" 시점에 P1 측정 sprint 진입. circular 제거.
- 트리거 #4: 어떤 telemetry 패턴 (workerd CPU exceeded count > 0, fetch retry count > N 등) 이 trigger 인지 명시.

**분류**: MINOR. 본 §5.2 진입 차단 사유 부재. Phase 2 진입 직전 ADR-028 재검토 의무 commit 시 본 권고 처리.

### 6.3 ✅ PASS — CHA-01 D1 disconnect 시뮬레이션 결손 정직 인정

**증거**:

- ADR-028 §6 #1 L160: "CHA-01 시뮬레이션의 충실도 한계: Proxy wrap 은 D1 wrapper API level disconnect 만 시뮬레이션. workerd 내부의 fetch / network layer disconnect 는 본 시점 미커버."
- decision-2026-05-02 §3.1 L93~L98: Sprint 1 GREEN 대상 15건에 CHA-01 포함.

**평가**: ADR-028 채택으로 인한 CHA-01 시뮬레이션 충실도 결손이 §6 본문에 명시 — 진산님이 본 결손을 알고 결정 효력 수용 가능. CRITICAL RULE #5 (불가능 + 대안) 정합. **PASS**.

---

## 7. PII / 접근성 / i18n / 보안 부가 검증

### 7.1 ✅ PASS — fixture 내 PII 부재

**증거**:

- 모든 정상 JSON fixture (01/03/04/05/08) Read 시 PII 0건 (이메일 / 전화 / 주민번호 / IP 0건).
- README 문서 4건 (pdf-malicious / claude-malformed / test-patterns / ADR-028) 도 PII 0건.
- Sprint 0 baseline review banner 도 PII 0건.

**평가**: 본 commit 의 모든 fixture / 문서가 PII 청정. **PASS**.

### 7.2 ✅ N/A — 접근성 (a11y)

**근거**: 본 commit 의 산출물은 모두 **테스트 fixture / 개발 문서** — 사용자 노출 0건.

- pdf-malicious README / claude-malformed README → 개발자 전용.
- test-patterns.md → 개발자 전용.
- ADR-028 → 진산님 + Claude 전용 의사결정 문서.

**평가**: a11y 원칙 (터치 타겟 / 키보드 내비 / aria-label) 적용 대상 부재. **N/A 정합**.

### 7.3 ✅ N/A — i18n (한국어 하드코딩)

**근거**: 본 commit 의 모든 한국어 텍스트는 개발자 전용 문서 — 사용자 UI 노출 0건.

- README 한국어 → 개발자 onboarding 용.
- ADR-028 한국어 → 의사결정 추적용.
- decision-2026-05-02 한국어 → 진산님 보고용.

**평가**: i18n 키 의무 부재. **N/A 정합**.

### 7.4 ✅ PASS — `perf.ts` test helper 보안

**증거**:

- `packages/shared/src/test-helpers/perf.ts` L1~L9 doc comment: "본 모듈은 production 경로에서 불러오지 않는다. 테스트 전용. package.json 의 ./test-helpers/perf export 경유로만 진입."
- L47~L75 `measure()` 함수: 외부 입력 직접 평가 0건 — `fn()` callback 만 호출.
- L116~L155 `CacheHitTracker` 클래스: 단순 카운터 — 외부 입력 0건.
- L160~L173 `percentile()` 함수: 정렬된 배열 + p (0~1) 만 입력 — XSS / injection vector 0건.

**평가**: test helper 가 production 경로 침투 0건 + 외부 입력 검증 정합 + Object.freeze 로 결과 immutable. **PASS**.

### 7.5 🟡 MINOR-A8 — `package.json` export 경로 noinclude in production 정합

**증거**:

- `git diff ba9ad2b^ ba9ad2b -- packages/shared/package.json` 변경 3 lines (구체 export 추가).
- perf.ts L9 의 doc comment 만으로는 build-time 차단 불충분.

**권고 (Minor)**: `packages/shared/package.json` 의 `exports` 필드에 `./test-helpers/*` 를 별도 conditional export 로 분리. production build 가 본 경로를 import 하면 typescript / build error.

```json
{
  "exports": {
    "./test-helpers/*": {
      "default": "./dist/test-helpers/*.js",
      "types": "./dist/test-helpers/*.d.ts"
    }
  }
}
```

또는 별도 sub-package `@thepick/shared-test-helpers` 분리. 본 시점 exports 정합 검증은 별도 Pass 2 (Architect) 영역 — 본 Pass 3 의 보안 관점에서는 doc comment 명시로 충분.

**분류**: MINOR (Pass 2 Architect 와 cross-reference 권고).

---

## 8. Devil's Advocate — "공격 vector / UX 결손" 시나리오

본 §5.2 산출물이 **깨질 수 있는 시나리오** 4건:

### 시나리오 1: Sprint 1 §5.3 시점 fixture 신뢰 — 다른 attacker vector 누락

**가정**: §5.3 에서 본 8 + 5 = 13 fixture 만으로 FUZ-01/02 PASS 마킹.

**위험**:

- 실 Claude API 가 반환할 수 있는 변조 응답 vector 는 README §4 #4 (정직 인정) 가 명시한 대로 "더 정교 / 미묘". 본 fixture 는 단순화 vector.
- 실 PDF malware vector 는 README §4 #1 이 인정한 대로 "모든 vector 커버 X". JBIG2 디코더 / type confusion / stream filter chaining 등.

**대응**: §5.3 작성 시 README §4 한계 inline 인용 + "본 PASS 는 known vector 13건 한정. unknown vector 는 별도 P1 fuzzing sprint 의무" 명시.

### 시나리오 2: ADR-028 트리거 발동 시 P1 측정 sprint 자체 부재

**가정**: BATCH-1 적재 완료 → 진산님 "다음 BATCH 적재" 트리거 발동 → 사용자 노출 prep → P1 게이트 20/20 측정 sprint 누락.

**위험**:

- decision-2026-05-02 §5.3 의 "Phase 2 진입 직전 의무" 가 자동 sprint 생성 hook 으로 연결 부재.
- handoff-030 / handoff-031 작성자 (Claude) 가 본 의무를 망각하면 silent skip.

**대응**: handoff-029 §3 권고 정합으로 handoff-030 작성 시 "P1 sprint 진입 조건 발동 시 자동 진산님 알림" 의무 (메모리 `project_completion_notification_obligation` 정합).

### 시나리오 3: fixture .pdf 가 git diff / GitHub UI 에서 raw bytes 노출

**가정**: GitHub PR review UI 에서 본 PDF 파일을 binary diff (raw bytes) 로 표시.

**위험**:

- `05-js-embedded.pdf` 의 `/JavaScript /JS (app.alert(...))` literal 이 PR diff 에 plain text 로 노출.
- 보안 팀 수동 review 시 false positive ("의도치 않은 JavaScript embed?") 또는 false negative (의도된 fixture 인 줄 모름).

**대응**: `.gitattributes` 파일에 `*.pdf binary` 또는 `packages/parser/__fixtures__/pdf-malicious/*.pdf binary` 추가 → git diff 가 "Binary files differ" 로만 표시. PR review 시 README §1 표 인용으로 의도 확인.

### 시나리오 4: ADR-028 옵션 D ("영구 N/A") 가 미래 진산님에게 매력적으로 보일 위험

**가정**: Phase 2 진입 직전 재검토 시점에 진산님이 "Workers Pool 도입 = 의존성 3건 추가 = ADR-022 단일 벤더 정합 손상" 으로 옵션 D 재선택.

**위험**:

- ADR-028 §3 L77 의 옵션 D 기각 사유 ("hybrid-search 검증 결손") 만으로 부족.
- @cloudflare/vitest-pool-workers 는 Cloudflare 공식 도구 = 단일 벤더 위반 0건. 그러나 의존성 3건 (vitest / miniflare / workerd) 추가는 ADR-022 financial circuit breaker 와 별도 평가 의무.

**대응**: ADR-028 §6 (한계) 본문에 옵션 D 재선택 시 발생하는 결손 명시 ("workerd 정합 검증 부재 → Phase 3 운영 RAG 시점에 발견되면 critical regression risk").

---

## 9. 종합 판정

### 9.1 4-PASS REVIEW 결과 (Pass 3 단독)

```
── 4-PASS REVIEW (Pass 3 / ADVOCATE) ──
리뷰 방식: 독립 에이전트 1개 (security-engineer 페르소나)
리뷰 범위: 변경 파일 21개 + 연관 파일 7개

Pass 3 (Advocate):
  ✅ PASS  : 11건 (§3.1 / §3.2 / §3.5 / §4.1 / §4.3 / §5.1 / §5.3 / §6.1 / §6.3 / §7.1 / §7.4)
  N/A     :  2건 (§7.2 a11y / §7.3 i18n — 사용자 노출 0건 정합)
  🟠 MAJOR :  3건 (§3.3 / §3.4 / §4.2)
  🟡 MINOR :  4건 (§3.6 / §4.4 / §5.2 / §6.2 / §7.5 — 5건 카운트, 본문 §3.6+§7.5 묶음 처리 → 4 분류 항목)
  🔴 CRITICAL: 0건

확인 (PASS 증거 — 11건):
  - §3.1 01-empty.pdf 0 바이트 안전 (file 출력 + README §2.1 정합)
  - §3.2 02-header-only.pdf 9 B 안전 (xxd 검증)
  - §3.5 03-xss-payload.json README backtick fence 정합
  - §4.1 decision-2026-05-02 NOT_IMPLEMENTED 사실 인용 정직
  - §4.3 P0 17→15 약화 0 (측정 불가 항목 제거)
  - §5.1 명세 변경 #4 / #7 정직 기록 (README §4)
  - §5.3 pdf-malicious README §4 한계 4건 명시
  - §6.1 ADR-028 PITR 4 옵션 비교 + 한계 3건 인정
  - §6.3 CHA-01 시뮬레이션 결손 정직 인정 (ADR-028 §6 #1)
  - §7.1 모든 fixture / 문서 PII 0건
  - §7.4 perf.ts test helper 보안 정합

반론 (Devil's Advocate — 4 시나리오):
  - 시나리오 1: §5.3 fixture 13건 신뢰 — unknown vector 누락 위험
  - 시나리오 2: ADR-028 트리거 발동 시 P1 sprint 자동 생성 hook 부재
  - 시나리오 3: GitHub PR UI 에서 .pdf raw bytes 노출 위험
  - 시나리오 4: 미래 옵션 D 재선택 유혹 — ADR-028 §6 한계 보강 의무

판정: 완료 가능 (Critical 0건 — Sprint 1 §5.2 진입 차단 사유 부재)
       Major 3건 + Minor 4건은 Sprint 1 §5.4 마감 전 / §5.3 진입 전 처리 권고.
─────────────────────────────────────
```

### 9.2 Major 3건 처리 권고 (우선순위)

| 순번 | ID  | 항목                             | 우선순위              | 권고 시점         |
| :--- | :-- | :------------------------------- | :-------------------- | :---------------- |
| 1    | A4  | Phase 2 트리거 binary 정의 부재  | P1 (sprint 1 마감 전) | §5.4 종료 전      |
| 2    | A1  | pdf-malicious README 경고 banner | P2 (사용자 안전)      | §5.3 진입 전 권고 |
| 3    | A2  | 보안 스캐너 false positive 마커  | P3 (미래 회귀 방어)   | §5.3 진입 전 권고 |

### 9.3 Minor 4건 처리 권고

| 순번 | ID  | 항목                                       | 권고 시점                               |
| :--- | :-- | :----------------------------------------- | :-------------------------------------- |
| 1    | A3  | Rule 17 예외 본문에 fixture json 패턴 추가 | 다음 dev-rules commit                   |
| 2    | A5  | ADR-028 §7 의 PASS count timestamp         | ADR-028 갱신 시                         |
| 3    | A6  | claude-malformed README §4 미래 추적       | sprint 2 진입 전                        |
| 4    | A7  | ADR-028 §5 트리거 binary 정의              | Phase 2 진입 직전 ADR-028 재검토 commit |
| 5    | A8  | shared package.json exports 분리           | Pass 2 Architect cross-ref              |

### 9.4 본 Pass 3 의 결론

**Sprint 1 §5.2 (commits fefa64a + ba9ad2b) 의 보안 / UX / i18n / a11y / PII 차원 평가:**

✅ **Critical 0건** — 진입 차단 사유 부재. 다음 Pass (Pass 4 CONTRACT) 또는 4-Pass 통합 판정 진행 가능.

🟠 **Major 3건** — Sprint 1 §5.4 마감 전 1건 (A4 — 트리거 binary), §5.3 진입 전 2건 (A1 / A2 — 사용자 안전 + 보안 스캐너) 처리 권고. **Sprint 1 §5.3 NOT-IMPL 7건 작업 차단 사유 0건** (decision-2026-05-02 §3.1 정합).

🟡 **Minor 4건** — 단계적 처리. 회귀 방어 / 정합성 강화 차원.

**핵심 발견**:

1. Fixtures 자체는 무해 + README 한계 명시 정합. 다만 **개발자 local PDF preview 위험** (A1) + **보안 스캐너 false positive** (A2) 의 운영 차원 보강 권고.
2. P0 → P1 재분류 결정은 정직화 — 측정 불가 항목 제거가 게이트 약화 아님. 다만 **트리거 자동 알림 메커니즘 부재** (A4) 가 sprint 망각 위험.
3. ADR-028 PITR 정합 + 한계 정직 인정. **§5 트리거 4건의 binary 정의 보강** (A7) 은 Phase 2 진입 직전 ADR 재검토 시점 의무.
4. Pass 3 차원 (보안 / UX / i18n / a11y / PII) 에서 **CRITICAL 0건** — 본 §5.2 진입 차단 사유 부재.

---

**작성 완료**: 2026-05-02 00:29:33 KST
**Pass 3 단독 판정**: 완료 가능 (Critical 0건)
**다음 Pass**: Pass 4 (CONTRACT — 기획 대조 / Silent Pivot 탐지) 진행 의무
**4-Pass 통합 판정**: 모든 Pass 결과 취합 후 결정
