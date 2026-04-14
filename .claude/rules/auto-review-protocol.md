# 4-Pass 자동 리뷰 프로토콜 — ThePick 특화

# L2+ 구현 완료 후, "완료" 선언 전에 반드시 4-Pass 리뷰를 실행한다.

# 이 프로토콜은 선택이 아니다. 스킵하면 CRITICAL RULE #4 위반이다.

## 트리거 조건

- L2 이상 구현 작업 완료 시 (새 기능, 기존 기능 수정, 리팩토링)
- 문서 생성/수정이라도 아키텍처 다이어그램, DB 스키마, API 스펙이 포함되면 L2 적용
- L1(스타일/순수 텍스트 문서/1줄 버그)은 면제
- **사용자가 리뷰를 요청하지 않아도 반드시 자동 수행한다. 스킵은 CRITICAL RULE #4 위반이다.**
- **"완료"라는 단어를 사용자에게 보고하기 전에 4-Pass를 실행했는지 자문하라.**
- Stop Hook(review-reminder.sh)이 코드 변경을 감지하면 리뷰 리마인더를 강제 출력한다.

## Pass 1 — SURGEON (Bottom-Up, 코드 정합성)

**관점: "이 코드 단독으로 터지는 경로가 있는가?"**

- Null/Undefined: D1 쿼리 반환값 null 가능 — `.first()` 후 크래시 경로
- Async: `await` 누락 (D1 쿼리, Vectorize 호출, Claude API, pdfplumber subprocess)
- 경계값: 빈 배열(노드 0건), NaN(산식 변수 누락), 음수(FSRS interval)
- 에러 처리: 빈 catch 금지, Graceful Degradation 준수 (유사도 < 0.60 → 거부)
- 산식 정밀도: 부동소수점 오차 (1.0115 × 0.45 등), `numeric_value` vs `value` 혼용
- Formula Engine: 동적 코드 실행 함수 사용 여부 — math.js AST만 허용

## Pass 2 — ARCHITECT (Top-Down, 연계 검증)

**관점: "이 코드가 다른 모듈과 만나면 터지는가?"**

- Import 방향: packages/ 간 의존성 단방향 (quality → parser OK, parser → quality X)
- Workers 제약: fs/path 사용 금지, CPU 시간 제한, 번들 크기
- D1 스키마 일치: Drizzle ORM 타입과 실제 D1 테이블 shape 일치
- Ontology Lock: 새 노드/엣지 ID가 ontology-registry.json에 등록되어 있는가
- truth_weight 정렬: RAG 결과 LLM 주입 시 LAW > FORMULA > CONCEPT 순서 준수
- Temporal Graph: UPDATE 대신 INSERT + SUPERSEDES 패턴 사용 확인
- IndexedDB ↔ D1 동기화: 오프라인 큐 → Background Sync 흐름 정상
- 다이어그램 정합성: `docs/architecture/ARCHITECTURE.md`의 Mermaid 다이어그램과 실제 구현 일치
- Hexagonal 위반: modules/ domain → infrastructure 직접 참조 없는가
- i18n: 사용자 노출 문자열에 한국어 하드코딩 없는가 (i18n 키 사용)

## Pass 3 — ADVOCATE (Cross-Cutting, UX + 보안)

**관점: "수험생과 공격자, 둘 다 만족하는가?"**

- 에러 UX: "교재 O장 O절 참고" 같은 Graceful 안내 vs 기술 에러 노출
- 상태 표현: 로딩/빈 데이터(기출 0건)/에러/오프라인 UI 존재 확인
- 오프라인: Service Worker 캐싱 전략 적절한가 (NetworkOnly 대상에 Cache 사용 등)
- 접근성: 모바일 80% — 터치 타겟 44px+, 키보드 내비게이션, aria-label
- 보안: API 키 하드코딩 없음, XSS(innerHTML 금지), 입력 검증
- 정답 안전: OX/빈칸/변형 문제의 정답이 100% 정확한가 (Hard Stop 조건)

## Pass 4 — CONTRACT (기획 대조, Silent Pivot 탐지)

**관점: "구현 재정립서 v2.0 대로 만들었는가?"**

- 설계서 대조: `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md` 기준
- Hard Rules 16개 위반 여부 전수 체크
- 수치/임계값: constants 값이 교재 원문과 일치하는가
- 배치 순서: 현재 BATCH N이 검증 완료되었는가 (BATCH N+1 진행 전)
- 품질 게이트: 해당 Phase의 QG 통과 조건 충족 여부
- 네이밍: 노드 ID 컨벤션 (CONCEPT-001, F-01, INS-01 등)

## 실행 규칙

### 규칙 0: 독립 에이전트 필수 (자가 리뷰 금지)

- **코드를 작성한 컨텍스트(메인 대화)에서 직접 4-Pass를 실행하지 않는다.**
- 반드시 Agent tool로 독립 서브에이전트를 생성하여 리뷰를 위임한다.
- 서브에이전트는 코드 작성 맥락을 모르므로 의도 편향이 차단된다.
- 최소 구성: Pass 1+2 에이전트 1개 + Pass 3+4 에이전트 1개 (병렬 실행)
- 권장 구성: 전문 에이전트 4~5개 병렬 (silent-failure-hunter, security-engineer, system-architect, quality-engineer, code-reviewer)

### 규칙 1: 전체 범위 리뷰 (변경 파일 한정 금지)

- 변경 파일뿐 아니라, 변경과 연계된 모든 파일을 리뷰 범위에 포함한다.
- "이 Step에서 안 건드렸으니 Pass" 금지. 이전 Step 산출물도 누적 검증 대상이다.
- 리뷰 프롬프트에 변경 파일 목록 + 연관 파일 목록을 명시적으로 전달한다.

### 규칙 2: 증거 기반 보고 (0건 근거 필수)

- "✅ 0건"을 보고하려면 **실제로 확인한 항목과 파일을 나열**해야 한다.
- "해당 없음"과 "검증 완료"를 구분한다:
  - N/A: 이 프로젝트/파일에 해당 항목이 존재하지 않음 (예: Workers 코드가 없어서 Workers 제약 미적용)
  - PASS: 해당 항목을 확인했고, 문제 없음 (확인한 파일:라인 명시)
- 0건 보고 시 최소 3개 이상의 "실제로 확인한 것" 증거를 제시해야 한다.

### 규칙 3: 반론 의무 (Devil's Advocate)

- 각 Pass에서 최소 1개의 "이게 깨질 수 있는 시나리오"를 제시한다.
- "테스트 통과 = 안전" 가정 금지. 테스트가 커버하지 못하는 엣지 케이스를 명시한다.
- stub/TODO/placeholder가 있으면 반드시 CRITICAL로 보고한다.

### 규칙 4: 분류 및 수정

- 각 Pass 결과를 Critical/Major/Minor로 분류
- Critical/Major는 즉시 수정. Minor는 보고만.
- 수정 후 빌드/테스트 재확인
- 4-Pass 모두 Critical 0건이어야 "완료" 선언 가능

## 보고 형식

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 N개 / 자가 리뷰(사유: \_\_\_)
리뷰 범위: 변경 파일 N개 + 연관 파일 N개 (목록)

Pass 1 (Surgeon): ✅ N건 확인 / 🔴 N건 / 🟠 N건 / N/A N건
확인: [파일:라인 — 확인 내용] × 3개 이상
반론: [깨질 수 있는 시나리오 1개 이상]

Pass 2 (Architect): ✅ N건 확인 / 🔴 N건 / 🟠 N건 / N/A N건
확인: [파일:라인 — 확인 내용] × 3개 이상
반론: [깨질 수 있는 시나리오 1개 이상]

Pass 3 (Advocate): ✅ N건 확인 / 🔴 N건 / 🟠 N건 / N/A N건
확인: [파일:라인 — 확인 내용] × 3개 이상
반론: [깨질 수 있는 시나리오 1개 이상]

Pass 4 (Contract): ✅ N건 확인 / 🔴 N건 / 🟠 N건 / N/A N건
확인: [파일:라인 — 확인 내용] × 3개 이상
반론: [깨질 수 있는 시나리오 1개 이상]

판정: 완료 가능 / 수정 필요
────────────────────────────────────
