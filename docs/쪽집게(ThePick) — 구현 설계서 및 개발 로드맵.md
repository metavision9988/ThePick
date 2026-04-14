# 쪽집게(ThePick) — 구현 설계서 및 개발 로드맵

> **기반 문서:** 구현 재정립서 v2.0 + 기획 문서 9종 통합 + 기존 프로젝트(`/home/soo/ThePick`) 코드 분석
>
> **목적:** 설계 문서를 실행 가능한 구현 단위로 분해하고, 각 단계의 입력/출력/검증 기준/의존관계를 명확히 정의
>
> **작성일:** 2026-04-12
>
> **v1.1 수정 (2026-04-14):** DEV COVEN 종합 리뷰 v1.0 반영 — 기출 수 정정, QG-2 현실 조정, 인증·Vectorize·교재오류·개정 매핑 추가, Won't Do 목록, Phase 4 확장 PoC

---

## 목차

1. [전체 아키텍처 조감도](#1-전체-아키텍처-조감도)
2. [개발 규약 (DEFCON + TDD + 에러 표준 + i18n)](#2-개발-규약)
3. [모노레포 프로젝트 구조](#3-모노레포-프로젝트-구조)
4. [Phase 0: Foundation + PoC (Week 1~4)](#4-phase-0-foundation--poc)
5. [Phase 1: Data Pipeline + Core Engine (Week 5~10)](#5-phase-1-data-pipeline--core-engine)
6. [Phase 2: Content + Service (Week 11~14)](#6-phase-2-content--service)
7. [Phase 3: Launch Ready (Week 15~16)](#7-phase-3-launch-ready)
8. [품질 게이트 총괄표](#8-품질-게이트-총괄표)
9. [의존관계 그래프](#9-의존관계-그래프)
10. [리스크 매트릭스 + 완화 전략](#10-리스크-매트릭스--완화-전략)
11. [기존 프로젝트 재활용 전략](#11-기존-프로젝트-재활용-전략)
12. [기술 결정 기록 (ADR 요약)](#12-기술-결정-기록)

---

## 1. 전체 아키텍처 조감도

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        사용자 접점 (PWA)                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│  │기출 풀이│ │복습/약점│ │모의시험 │ │AI 튜터 │ │대시보드/진도관리│   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘   │
│       └──────────┬┴──────────┬┴───────────┘               │            │
│                  ▼           ▼                             │            │
│  ┌──────────────────────────────────────┐                  │            │
│  │   Zustand (세션 상태) + IndexedDB    │◄─────────────────┘            │
│  │   (Dexie.js, 오프라인 캐시 ~4MB)    │                               │
│  └──────────────┬───────────────────────┘                               │
│                 │ Background Sync                                       │
└─────────────────┼───────────────────────────────────────────────────────┘
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers + Hono (Edge API)                   │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │Graph RAG    │ │Formula Engine│ │FSRS 엔진   │ │혼동감지+암기매칭│  │
│  │검색 엔진    │ │(math.js AST) │ │(간격반복)  │ │(8종 유형)      │  │
│  └──────┬──────┘ └──────┬───────┘ └─────┬──────┘ └────────┬─────────┘  │
│         │               │               │                 │            │
│         ▼               ▼               ▼                 ▼            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Drizzle ORM (타입 안전)                      │   │
│  └──────────────┬───────────────────────┬──────────────────────────┘   │
└─────────────────┼───────────────────────┼──────────────────────────────┘
                  ▼                       ▼
         ┌────────────────┐      ┌─────────────────┐
         │ Cloudflare D1  │      │ Cloudflare       │
         │ (9개 테이블)   │      │ Vectorize        │
         │ 정밀+구조 계층 │      │ 맥락 계층(임베딩)│
         └────────────────┘      └─────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                   빌드 파이프라인 (로컬/CI)                              │
│  ┌────────┐ ┌────────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐  │
│  │PDF파서 │→│섹션분리    │→│Claude API│→│스키마검증 │→│DB적재(draft)│  │
│  │pdfplumb│ │정규식      │ │배치처리  │ │Ontology   │ │→인간검수    │  │
│  └────────┘ └────────────┘ └──────────┘ └───────────┘ └─────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3계층 데이터 흐름

```
[정밀 계층] constants 테이블 → Formula Engine이 DB 직접 조회 (LLM 추론 금지)
[구조 계층] knowledge_nodes + edges + formulas → 메타데이터 필터 → Graph RAG 검색
[맥락 계층] Vectorize 임베딩 → 유사도 검색 (< 0.60이면 Graceful Degradation)
```

### 방어 장치 4종

| 장치                 | 규칙                                                           |
| -------------------- | -------------------------------------------------------------- |
| Truth Weight         | LAW(10) > FORMULA(8) > INVESTIGATION(7) > CONCEPT(5) > TERM(3) |
| Temporal Graph       | UPDATE 금지 → 신규 노드 + SUPERSEDES 엣지 + is_active=0        |
| Graceful Degradation | 유사도 < 0.60 → "교재 O장 O절 참고" 안내                       |
| Constants 직접 조회  | LLM에게 숫자 추론 절대 금지                                    |

---

## 2. 개발 규약

### 2.1 DEFCON 레벨 정의

| 레벨            | 이름                      | 사전 절차                        | 적용 영역                     |
| --------------- | ------------------------- | -------------------------------- | ----------------------------- |
| **L1 Rapid**    | 스타일/문서/PoC/단순버그  | 없음 — 바로 코딩                 | ESLint 설정, README, 1줄 버그 |
| **L2 Standard** | 일반 기능 구현            | TODO 5줄 공유 후 코딩 (기본값)   | 대부분의 모듈 구현            |
| **L3 Fortress** | 결제/인증/AI추론/개인정보 | **plan 작성 → 인간 승인 → 코딩** | 아래 L3 영역 참조             |

**L3 영역 (plan 없이 코드 수정 금지):**

| 경로/영역                    | 사유                                                    |
| ---------------------------- | ------------------------------------------------------- |
| `packages/formula-engine/`   | 계산 오류 = 서비스 사망                                 |
| `**/constants*`              | 65%→60% 잘못 입력 = 서비스 사망                         |
| `**/ontology-registry*`      | 시스템 전체 ID 체계 결정 — 잘못된 ID 허용 = 데이터 오염 |
| DB 스키마 변경 (migrations/) | 마이그레이션 실수 = 데이터 유실                         |
| `**/user_progress*`          | 사용자 학습 데이터 (PII 포함)                           |

> AI는 DEFCON을 올릴 수 있지만 내릴 수 없다.

### 2.2 TDD Micro-Task 분해 패턴

설계서의 각 Step은 **Story 수준**이다. Claude Code 실행 시 각 Step을 아래 패턴으로 **Task 단위**로 분해한다.

```
Step 0-4 (M01 PDF 텍스트 추출기) → Task 분해 예시:

Task 0-4-1 [TEST]  pdfplumber 래퍼 인터페이스 테스트 작성        (5분)
Task 0-4-2 [IMPL]  pdf-extractor.ts 구현 (subprocess 호출)       (15분)
Task 0-4-3 [TEST]  835쪽 추출 완전성 테스트 (M01-T01)            (10분)
Task 0-4-4 [IMPL]  한글 인코딩 + 특수문자 처리 (M01-T02,T04)     (10분)
Task 0-4-5 [TEST]  표 추출 테스트 (M01-T03)                      (5분)
Task 0-4-6 [IMPL]  table-extractor.ts 구현                       (15분)
Task 0-4-7 [REFACTOR] 에러 처리 + 타입 정리                      (5분)
```

**규칙:**

- 모든 Task는 `[TEST] → [IMPL] → [REFACTOR]` (Red-Green-Refactor) 순환
- Task당 5~20분이 기준. 20분 초과 시 Task 재분해
- 테스트 먼저 — 테스트 없는 구현은 "완료"로 인정하지 않음
- `.jjokjipge/state.json`에 현재 진행 중인 Task 기록 (세션 복구용)

### 2.3 에러 처리 표준

모든 API 응답과 내부 에러는 아래 표준을 따른다.

```typescript
// packages/shared/src/errors.ts

// 에러 코드 열거형
enum ErrorCode {
  // 400 계열
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_ONTOLOGY_ID = 'INVALID_ONTOLOGY_ID',
  FORMULA_PARSE_ERROR = 'FORMULA_PARSE_ERROR',

  // 404 계열
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  QUESTION_NOT_FOUND = 'QUESTION_NOT_FOUND',

  // 422 계열
  LOW_SIMILARITY = 'LOW_SIMILARITY', // Graceful Degradation 트리거
  ANSWER_MISMATCH = 'ANSWER_MISMATCH', // 기출↔Graph 불일치

  // 500 계열
  FORMULA_ENGINE_ERROR = 'FORMULA_ENGINE_ERROR',
  AI_GENERATION_ERROR = 'AI_GENERATION_ERROR',
}

// 표준 에러 클래스
class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public metadata?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// API 표준 응답
type SuccessResponse<T> = { success: true; data: T };
type ErrorResponse = {
  success: false;
  error: { code: ErrorCode; message: string; reference?: string };
};
```

**Graceful Degradation 연결:**

- 유사도 < 0.60 → `AppError(LOW_SIMILARITY, ...)` → 사용자에게 `"교재 O장 O절 참고"` 표시
- 기출↔Graph 충돌 → `AppError(ANSWER_MISMATCH, ...)` → 해당 노드 `flagged` 처리

### 2.4 i18n 전략

**원칙:** 사용자에게 노출되는 모든 문자열은 i18n 키로 관리한다. 한국어 하드코딩 금지.

```
apps/web/src/i18n/
├── ko.json                # 한국어 (기본)
└── index.ts               # i18n 유틸리티
```

**적용 범위:**

- UI 레이블, 버튼 텍스트, 에러 메시지, 안내 문구
- Graceful Degradation 메시지 ("교재 O장 O절 참고")
- 학습 서비스 안내 (빈 데이터, 오프라인 안내)
- OX 문제/암기법 생성 시 프롬프트 템플릿도 i18n 키 사용

**하드코딩 허용 예외:**

- 교재 원문 데이터 (constants, knowledge_nodes 내용)
- 법조문 원문
- ontology-registry.json의 ID (코드 내부용)

**Phase 0에서 i18n 인프라 구축, Phase 2에서 전체 적용.**

### 2.5 Epic 문서화 프로세스

각 Phase 완료 시 Epic 문서를 작성하여 구현 결과를 기록한다.

```
docs/epics/
├── EPIC-P0-foundation.md     # Phase 0 완료 시 작성
├── EPIC-P1-pipeline.md       # Phase 1 완료 시 작성
├── EPIC-P2-service.md        # Phase 2 완료 시 작성
└── EPIC-P3-launch.md         # Phase 3 완료 시 작성
```

**Epic 문서 필수 항목:**

```markdown
# EPIC-P{N}: {Phase 이름}

## 완료된 Step 목록

(Step ID + 산출물 + 검증 결과)

## 품질 게이트 통과 기록

(QG-N 통과 일시 + 증거 스크린샷/로그)

## 발견된 이슈 + 해결 방법

(구현 중 기획과 달라진 부분, 기술적 결정 사유)

## 다음 Phase 진입 조건 확인

(전제 조건 모두 충족 여부)

## 실수 로그

(CLAUDE.md "최근 실수"에도 동기화)
```

---

## 2.6 기존 프로젝트 재활용 맵

기존 프로젝트(`/home/soo/ThePick`, 14,152줄, 구현 30%)에서 프로덕션 수준 코드를 선별 재활용한다.
스택이 90% 동일(Workers+Hono+Drizzle+Astro+React+Zustand)하므로 인프라/UI/학습엔진은 이식하고, 핵심 차별점(Graph RAG, Formula Engine, Constants, Ontology, 혼동 감지, Temporal Graph)은 신규 구현한다.

### 즉시 복사 (Phase 0)

| 소스 경로                                       | 대상                                | 적용 Step       | 라인   | 재사용율              |
| ----------------------------------------------- | ----------------------------------- | --------------- | ------ | --------------------- |
| `modules/learning/src/fsrs/scheduler.ts` + test | `modules/learning/domain/services/` | Step 1-10 (M17) | 616줄  | **100%**              |
| `packages/i18n/src/`                            | `apps/web/src/i18n/`                | Step 0-3        | 231줄  | **90%** (키 추가만)   |
| `apps/api/src/routes/parsing.ts` (정규식 부분)  | `packages/parser-1st-exam/`         | Step 0-5 (M03)  | ~200줄 | **80%** (①②③ 패턴)    |
| ESLint/Prettier/Husky/lint-staged 설정          | 루트                                | Step 0-1        | 설정   | **95%**               |
| `apps/api/wrangler.toml`                        | `apps/api/`                         | Step 0-1        | 설정   | **80%** (바인딩 수정) |

### 패턴 참조 (Phase 1~2)

| 소스 경로                                      | 참조 대상          | 적용 Step | 활용                                  |
| ---------------------------------------------- | ------------------ | --------- | ------------------------------------- |
| `apps/api/src/lib/claude.ts`                   | M23 암기법 생성    | Step 2-4  | 한국어 프롬프트, 비용 추적, 배치 패턴 |
| `apps/api/src/db/schema.ts`                    | DB 스키마          | Step 0-2  | Drizzle 패턴 + 마이그레이션 구조 참조 |
| `modules/ai-engine/src/cost/`                  | AI 비용 모니터링   | Phase 2   | 모델별 가격, 월별 예측 로직           |
| `apps/web/src/components/StudySession.tsx`     | M25 기출 풀이 UI   | Step 2-6  | FSRS 상태별 카드, 피드백 UI 베이스    |
| `apps/web/src/stores/study.ts`                 | Zustand 스토어     | Step 0-3  | 세션/카드 상태관리 패턴               |
| `apps/admin-web/src/components/FileUpload.tsx` | 관리자 파일 업로드 | Step 0-13 | 드래그앤드롭, 진행 표시               |

### 사용 금지 (신규 구현)

| 기존 코드                                       | 이유                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `modules/identity, billing, analytics, admin-*` | stub만 존재 (0% 구현)                                                |
| `modules/content/`                              | Repository 패턴 껍데기만, 새 Hexagonal로 대체                        |
| `apps/batch/`                                   | 39줄 빈 파일                                                         |
| 기존 DB 스키마의 테이블 구조 자체               | 새 9개 테이블은 Graph RAG 기반으로 완전히 다름 (Drizzle 패턴만 참조) |

### 기존에 없는 것 (100% 신규 구현)

Graph RAG (노드/엣지/4-Level 메타데이터), Formula Engine (math.js AST), Constants 레지스트리, Ontology Lock, 혼동 유형 감지 (8종), Temporal Graph (SUPERSEDES), PWA 오프라인 (IndexedDB+Background Sync), Graceful Degradation, Truth Weight 정렬

---

## 3. 모노레포 프로젝트 구조

### 3계층 디렉토리 역할 구분

```
packages/  → 빌드 파이프라인용 (데이터 수집/구조화/검증/생성 — 로컬/CI에서 실행)
modules/   → 런타임 도메인 로직 (Hexagonal Architecture — Workers에서 실행)
apps/      → 진입점 (PWA, API, Admin, Batch)
```

### 전체 디렉토리 트리

```
ThePick/
├── .jjokjipge/                       # 세션 상태 추적 (Claude Code 복구용)
│   ├── state.json                    # 현재 Phase/Step/Task 진행 상태
│   ├── completed.md                  # 완료된 Step 이력
│   └── blockers.md                   # 현재 블로커 목록
│
├── apps/
│   ├── web/                          # 학습자 PWA (Astro + React Islands)
│   │   ├── public/
│   │   │   ├── manifest.json         # PWA 매니페스트
│   │   │   ├── sw.js                 # Service Worker
│   │   │   └── icons/                # PWA 아이콘 (192, 512, maskable)
│   │   ├── src/
│   │   │   ├── pages/                # Astro 라우팅
│   │   │   │   ├── index.astro       # 랜딩/대시보드
│   │   │   │   ├── exam/             # 기출 풀이 모드
│   │   │   │   ├── review/           # 복습/약점 공략
│   │   │   │   ├── mock/             # 모의시험
│   │   │   │   └── tutor/            # AI 튜터
│   │   │   ├── components/           # React Islands
│   │   │   │   ├── ExamCard.tsx
│   │   │   │   ├── FlashCard.tsx
│   │   │   │   ├── FormulaCalc.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── ComparisonMatrix.tsx
│   │   │   │   └── OfflineIndicator.tsx
│   │   │   ├── i18n/                 # 국제화 (한국어 하드코딩 금지)
│   │   │   │   ├── ko.json           # 한국어 번들
│   │   │   │   └── index.ts          # i18n 유틸리티 + t() 함수
│   │   │   ├── lib/
│   │   │   │   ├── local-db.ts       # IndexedDB (Dexie.js) 스키마
│   │   │   │   ├── sync-engine.ts    # Background Sync 엔진
│   │   │   │   └── fsrs-client.ts    # FSRS 클라이언트 로컬 실행
│   │   │   └── stores/
│   │   │       ├── session.ts        # Zustand: 현재 학습 세션
│   │   │       ├── progress.ts       # Zustand: 학습 진도
│   │   │       └── ui.ts             # Zustand: UI 상태
│   │   ├── astro.config.mjs
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   ├── admin-web/                    # 관리자 CMS (별도 앱, 데스크탑 전용)
│   │   └── src/
│   │       ├── GraphVisualizer.tsx    # D3.js Force Graph (서브그래프 단위)
│   │       ├── ContentQueue.tsx       # draft→review→approved→published
│   │       ├── ConstantsReview.tsx    # 매직 넘버 검수 UI
│   │       └── PipelineManager.tsx    # 배치 실행 관리
│   │
│   ├── api/                          # Cloudflare Workers API (Hono)
│   │   └── src/
│   │       ├── index.ts              # Hono 앱 진입점
│   │       ├── routes/
│   │       │   ├── graph.ts          # Graph RAG 검색 API
│   │       │   ├── formula.ts        # Formula Engine API
│   │       │   ├── exam.ts           # 기출 풀이 API
│   │       │   ├── progress.ts       # 학습 진도 동기화 API
│   │       │   └── admin.ts          # 관리자 API
│   │       └── middleware/
│   │           ├── auth.ts
│   │           └── error-handler.ts  # AppError → ErrorResponse 변환
│   │
│   └── batch/                        # 배치 작업 (AI 생성, 로컬/CI)
│       └── jobs/
│           ├── parse-pdf.ts
│           ├── structure-batch.ts
│           ├── generate-content.ts
│           └── validate-batch.ts
│
├── modules/                          # 런타임 도메인 로직 (Hexagonal Architecture)
│   ├── content/                      # 콘텐츠 도메인
│   │   ├── domain/                   # 순수 도메인 로직 (의존성 0)
│   │   │   ├── entities/             # KnowledgeNode, Edge, Formula, Constant
│   │   │   ├── value-objects/        # TruthWeight, ConfusionLevel, NodeId
│   │   │   └── services/             # GraphTraversal, TruthWeightSorter
│   │   ├── application/              # 유스케이스 (도메인 오케스트레이션)
│   │   │   ├── search-graph.ts       # M15: Graph RAG 검색 유스케이스
│   │   │   ├── calculate-formula.ts  # M16: 산식 계산 유스케이스
│   │   │   └── detect-confusion.ts   # M18: 혼동 감지 유스케이스
│   │   └── infrastructure/           # 외부 의존 (D1, Vectorize, Claude API)
│   │       ├── d1-node-repository.ts
│   │       ├── vectorize-search.ts
│   │       └── claude-ai-client.ts
│   │
│   ├── learning/                     # 학습 도메인
│   │   ├── domain/
│   │   │   ├── entities/             # UserProgress, StudySession, ReviewCard
│   │   │   ├── value-objects/        # FSRSParams, ConfusionType
│   │   │   └── services/             # FSRSScheduler, MnemonicMatcher
│   │   ├── application/
│   │   │   ├── schedule-review.ts    # M17: FSRS 복습 스케줄링
│   │   │   ├── match-mnemonic.ts     # M19: 암기법 매칭
│   │   │   └── sync-progress.ts     # 오프라인 동기화
│   │   └── infrastructure/
│   │       ├── d1-progress-repository.ts
│   │       └── indexeddb-adapter.ts
│   │
│   └── exam/                         # 시험 도메인
│       ├── domain/
│       │   ├── entities/             # ExamQuestion, MockTest, Score
│       │   └── services/             # GradingService, PassPredictor
│       ├── application/
│       │   ├── take-exam.ts          # M25: 기출 풀이
│       │   ├── run-mock.ts           # M27: 모의시험
│       │   └── generate-variation.ts # M22: 기출 변형
│       └── infrastructure/
│           └── d1-exam-repository.ts
│
├── packages/                         # 빌드 파이프라인용 (로컬/CI 실행)
│   ├── shared/src/                   # 공유 타입, 에러, 유틸리티
│   │   ├── errors.ts                 # AppError, ErrorCode 열거형
│   │   ├── types.ts                  # 공유 타입 정의
│   │   └── i18n-keys.ts             # i18n 키 상수
│   │
│   ├── parser/src/                   # Layer 1-2
│   │   ├── pdf-extractor.ts          # M01
│   │   ├── section-splitter.ts       # M06
│   │   ├── table-extractor.ts        # M01
│   │   ├── batch-processor.ts        # M07
│   │   ├── ontology-registry.json    # M08 (L3 영역)
│   │   ├── schema-validator.ts       # M08
│   │   ├── db-loader.ts              # Stage 5
│   │   ├── constants-extractor.ts    # M09
│   │   ├── revision-detector.ts      # M10
│   │   └── vectorize-loader.ts       # Stage 7
│   │
│   ├── parser-1st-exam/src/          # 1차 시험 전용 파서
│   │   ├── exam-question-parser.ts   # M03
│   │   ├── commercial-law-parser.ts
│   │   ├── insurance-law-parser.ts
│   │   ├── decree-parser.ts
│   │   ├── notice-parser.ts
│   │   ├── cross-ref-detector.ts
│   │   ├── revision-tracker.ts
│   │   ├── vision-ocr.ts             # M04
│   │   ├── topic-clusterer.ts        # M11
│   │   ├── curriculum-reconstructor.ts
│   │   ├── web-supplement.ts         # M05
│   │   ├── confusion-detector.ts     # M18
│   │   ├── mnemonic-generator.ts     # M23
│   │   └── answer-triangulator.ts
│   │
│   ├── formula-engine/src/           # M16 (L3 영역)
│   │   ├── ast-parser.ts             # math.js AST (동적 코드 실행 절대 금지)
│   │   ├── variable-mapper.ts
│   │   ├── constants-resolver.ts
│   │   └── engine.ts
│   │
│   ├── study-material-generator/src/ # Layer 5
│   │   ├── flashcard-generator.ts    # M20
│   │   ├── ox-generator.ts           # M21
│   │   ├── variation-generator.ts    # M22
│   │   ├── mnemonic-generator.ts     # M23
│   │   ├── formula-card-generator.ts # M24
│   │   ├── flowchart-generator.ts    # M24
│   │   ├── condition-tree-generator.ts
│   │   ├── comparison-matrix.ts
│   │   └── revision-banner.ts
│   │
│   └── quality/src/                  # Layer 3
│       ├── triangulation-checker.ts  # M12
│       ├── answer-matcher.ts         # M13
│       └── graph-integrity.ts        # M14
│
├── migrations/
│   ├── 0001_initial_schema.sql
│   └── 0002_1st_exam_extension.sql
│
├── docs/
│   ├── 쪽집게(ThePick) — 구현 재정립서 v2.0.md
│   ├── 쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md
│   ├── architecture/                 # Mermaid DaC 아키텍처 다이어그램 (4종)
│   │   └── ARCHITECTURE.md           # 시스템 조감도 + 데이터 흐름 + 의존관계 + 배치 파이프라인
│   ├── plans/                        # 기획 원본 (수정 금지)
│   └── epics/                        # Phase 완료 시 Epic 문서 (§2.5 참조)
│
├── Guide/                            # VOID DEV HARNESS 원본 문서 (수정 금지)
│                                     # 하네스 설정, 프롬프트 템플릿, 확장 규칙 원본
│
├── .claude/
│   └── rules/                        # Claude Code 자동 리뷰 규칙
│       ├── auto-review-protocol.md   # 4-Pass 리뷰 프로토콜
│       └── dev-guide.md              # 개발 규칙
│
├── CLAUDE.md                         # 프로젝트 규칙 (Claude Code 진입점)
├── package.json                      # 모노레포 루트
├── turbo.json                        # Turborepo 파이프라인 설정
└── tsconfig.base.json                # 공유 TypeScript 설정
```

### packages/ vs modules/ 역할 구분

| 구분          | packages/                                    | modules/                                      |
| ------------- | -------------------------------------------- | --------------------------------------------- |
| **실행 시점** | 빌드 타임 (로컬/CI)                          | 런타임 (Workers)                              |
| **목적**      | 데이터 수집, 구조화, 품질 검증, 컨텐츠 생성  | 도메인 비즈니스 로직                          |
| **아키텍처**  | 파이프라인 (순차 실행)                       | Hexagonal (domain→application→infrastructure) |
| **의존 방향** | parser → quality (단방향)                    | domain ← application → infrastructure         |
| **예시**      | PDF 파싱, Claude API 배치, Graph 무결성 검증 | Graph RAG 검색, FSRS 스케줄링, 시험 채점      |

### Hexagonal Architecture 의존 규칙

```
domain/          — 순수 로직, 외부 의존 0, 인터페이스만 정의
application/     — 유스케이스, domain 호출 + infrastructure 인터페이스 사용
infrastructure/  — 외부 시스템 어댑터 (D1, Vectorize, Claude API)

금지 방향: domain → infrastructure (직접 참조 불가)
허용 방향: infrastructure → domain (인터페이스 구현)
```

### apps/api/ → modules/ 연결

```
apps/api/src/routes/graph.ts
  → modules/content/application/search-graph.ts   (유스케이스 호출)
    → modules/content/domain/services/             (도메인 로직)
    → modules/content/infrastructure/              (D1/Vectorize 접근)
```

`apps/api/src/services/`는 제거하고, 도메인 로직은 `modules/`로 이동한다.

---

## 4. Phase 0: Foundation + PoC (Week 1~4)

> **목표:** 인프라 구축 + BATCH 1 PoC로 전체 파이프라인 검증
> **QG-1:** 기출 정답 100% / **QG-2:** BATCH 1 산식 100%

---

### Week 1-2: 인프라 + 데이터 수집

#### Step 0-1. 모노레포 초기화 + 개발 환경

| 항목       | 상세                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| **작업**   | Turborepo 모노레포 셋업, TypeScript 공유 설정, ESLint+Prettier+husky 구성                     |
| **산출물** | `package.json`, `turbo.json`, `tsconfig.base.json`, `.eslintrc`, `.prettierrc`, `lint-staged` |
| **검증**   | `pnpm install && pnpm lint` 통과                                                              |
| **의존**   | 없음 (최초 작업)                                                                              |
| **DEFCON** | L1                                                                                            |

```
구현 체크리스트:
[ ] pnpm workspace 구성 (apps/*, packages/*, modules/*)
[ ] Turborepo pipeline: build, test, lint, typecheck
[ ] TypeScript strict mode, path aliases (@thepick/parser, @thepick/shared 등)
[ ] ESLint: @typescript-eslint, no-implied-eval 규칙
[ ] Prettier: 2 space, single quote, trailing comma
[ ] husky + lint-staged: 커밋 전 lint+typecheck 자동 실행
[ ] .gitignore: node_modules, .env*, .wrangler, dist/
[ ] .env.example 작성 (CLOUDFLARE_*, CLAUDE_API_KEY 등)
[ ] packages/shared/ 초기화 (AppError, ErrorCode, 공유 타입) — §2.3 참조
[ ] .jjokjipge/ 세션 상태 추적 초기화 (state.json, completed.md, blockers.md)
[ ] modules/ 디렉토리 구조 초기화 (content/, learning/, exam/ 스캐폴딩)
[ ] docs/epics/ 디렉토리 생성

재활용 (§2.6):
[ ] /home/soo/ThePick/.eslintrc.cjs → 복사 후 프로젝트 경로 수정
[ ] /home/soo/ThePick/.prettierrc → 그대로 복사
[ ] /home/soo/ThePick/.husky/ → 그대로 복사
[ ] /home/soo/ThePick/apps/api/wrangler.toml → 복사 후 D1/KV ID 변경
[ ] /home/soo/ThePick/tsconfig.json → strict 설정 참조
```

#### Step 0-2. DB 스키마 마이그레이션 (L3)

| 항목       | 상세                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------- |
| **작업**   | D1 9개 테이블 생성 (기본 6 + 확장 3), Drizzle ORM 스키마 정의                                       |
| **산출물** | `migrations/0001_initial_schema.sql`, `migrations/0002_1st_exam_extension.sql`, Drizzle 스키마 파일 |
| **검증**   | `wrangler d1 migrations apply` 성공, Drizzle 타입과 D1 shape 일치                                   |
| **의존**   | Step 0-1                                                                                            |
| **DEFCON** | **L3** (DB 스키마 = plan 필수 → 인간 승인 후 실행)                                                  |

```
9개 테이블:
1. knowledge_nodes (type, lv1~lv3, truth_weight, version_year, status, exam_scope)
2. knowledge_edges (edge_type, condition, is_active)
3. formulas (equation_template, variables_schema, expected_inputs)
4. constants (category, value, numeric_value, unit, confusion_level, exam_scope)
5. revision_changes (change_type, exam_priority, before/after_value)
6. exam_questions (valid_from/until, superseded_by, exam_type, subject, confusion_type)
7. mnemonic_cards (target_id, confusion_type, memorization_method, reverse_verified)
8. user_progress (fsrs_difficulty/stability/interval/next_review, last_confusion_type)
9. topic_clusters (lv1/lv2/lv3, exam_frequency, is_covered)

v1.1 패치 반영:
- formulas.expected_inputs TEXT 추가
- constants.unit TEXT 추가
```

#### Step 0-3. PWA 셸 + IndexedDB 초기화

| 항목       | 상세                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| **작업**   | Astro 프로젝트 생성, Tailwind+shadcn/ui, PWA manifest, Service Worker 기본 셸, IndexedDB(Dexie.js) 스키마, Zustand 스토어 |
| **산출물** | `apps/web/` 전체 기본 구조                                                                                                |
| **검증**   | Lighthouse PWA 점수 90+, 오프라인에서 앱 셸 로딩 확인                                                                     |
| **의존**   | Step 0-1                                                                                                                  |
| **DEFCON** | L2                                                                                                                        |

```
구현 체크리스트:
[ ] Astro 프로젝트 + React 인테그레이션 설정
[ ] Tailwind CSS + shadcn/ui 컴포넌트 라이브러리
[ ] manifest.json (name, icons, display: standalone, orientation: portrait)
[ ] Service Worker 캐싱 전략 4종 구현
    - Cache First: 셸/CSS/JS/폰트
    - StaleWhileRevalidate: 학습 데이터
    - NetworkFirst: 진도 동기화
    - NetworkOnly: AI 튜터/결제
[ ] IndexedDB 스키마 (Dexie.js) — 8개 store
[ ] Zustand 기본 스토어 3개 (session, progress, ui)
[ ] 오프라인 상태 감지 컴포넌트
[ ] 반응형 레이아웃 (360px / 768px / 1024px)
[ ] 모바일: 터치 타겟 44px+, 키보드 내비게이션
[ ] i18n 인프라: ko.json + t() 함수 + i18n 키 상수 (§2.4 참조)
[ ] 에러 UI: AppError → 사용자 친화적 메시지 변환 (§2.3 참조)

재활용 (§2.6):
[ ] /home/soo/ThePick/packages/i18n/src/ → apps/web/src/i18n/ 이식 (231줄, 키 추가만)
[ ] /home/soo/ThePick/apps/web/src/stores/study.ts → stores/ 패턴 참조 (API URL 변경)
```

#### Step 0-4. M01 PDF 텍스트 추출기

| 항목       | 상세                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| **작업**   | pdfplumber Python subprocess 래퍼, 페이지별 텍스트+표 추출                 |
| **산출물** | `packages/parser/src/pdf-extractor.ts`                                     |
| **검증**   | M01-T01~T05 (835쪽 100%, 한글 깨짐 0건, 표 8/10+, 특수문자 정상, 5분 이내) |
| **의존**   | Step 0-1                                                                   |
| **DEFCON** | L2                                                                         |

```
입력: PDF 파일 경로
출력: { page: number, text: string, tables: Table[] }[]
주의: Workers 내부 X, 로컬/CI 빌드 파이프라인에서만 실행
```

#### Step 0-5. M03 기출문제 파서 → QG-1

| 항목       | 상세                                                                  |
| ---------- | --------------------------------------------------------------------- |
| **작업**   | 기출 PDF → 문항별 구조화 JSON (pdfplumber + 정규식 + Claude API 보조) |
| **산출물** | `packages/parser-1st-exam/src/exam-question-parser.ts`                |
| **검증**   | **M03-T02: 정답 100%** (공식 정답과 불일치 0건 — 절대 타협 불가)      |
| **의존**   | Step 0-4 (PDF 추출기)                                                 |
| **DEFCON** | L2                                                                    |

```
입력: 기출 PDF (제1~11회, 1차 3과목)
출력: { id, year, round, subject, q_no, stem, choices[], answer, explanation? }[]
검증: 1차: 과목당 25 × 11회 = 275, 전체 825문항 카운트 + 정답 전수 대조

★ QG-1 게이트: 이 단계에서 기출 정답 100% 달성 필수
  실패 시 → 파서 재구현, Phase 0 일정 연장

재활용 (§2.6):
  /home/soo/ThePick/apps/api/src/routes/parsing.ts 에서:
  - 한국 숫자 정규식 (①②③④⑤ 인식) → 80% 재사용
  - 파일 업로드 + KV 임시 저장 + 승인 워크플로우 → 패턴 참조
  - 주의: 기존은 텍스트만 파싱, pdfplumber 연동은 새로 구현
```

#### Step 0-6. M02 법령 원문 수집기

| 항목       | 상세                                                                               |
| ---------- | ---------------------------------------------------------------------------------- |
| **작업**   | 법제처 API/웹에서 상법 보험편(93조문) + 농어업재해보험법령 수집                    |
| **산출물** | `packages/parser-1st-exam/src/commercial-law-parser.ts`, `insurance-law-parser.ts` |
| **검증**   | M02-T01~T04 (조문 누락 0건, 항/호/목 분리 정확, 최신 버전)                         |
| **의존**   | Step 0-1                                                                           |
| **DEFCON** | L2                                                                                 |

---

### Week 3-4: 구조화 PoC (BATCH 1)

#### Step 0-7. M06 섹션 분리기

| 항목       | 상세                                                            |
| ---------- | --------------------------------------------------------------- |
| **작업**   | raw text → 절/항/호/목 단위 분리 (정규식 + 구조 인식)           |
| **산출물** | `packages/parser/src/section-splitter.ts`, `table-extractor.ts` |
| **검증**   | BATCH 1 범위(p.403~434) 섹션 분리 결과 수동 대조                |
| **의존**   | Step 0-4 (PDF 추출기 출력)                                      |
| **DEFCON** | L2                                                              |

#### Step 0-8. M08 Ontology Registry + Schema Validator (L3)

| 항목       | 상세                                                                                |
| ---------- | ----------------------------------------------------------------------------------- |
| **작업**   | ontology-registry.json 초기 ID 정의, 스키마 검증기 구현 (미등록 ID → 거부 + 재수행) |
| **산출물** | `packages/parser/src/ontology-registry.json`, `schema-validator.ts`                 |
| **검증**   | 등록되지 않은 ID로 테스트 → 거부 확인, 등록된 ID → 통과 확인                        |
| **의존**   | Step 0-1                                                                            |
| **DEFCON** | **L3** (시스템 전체 ID 체계 결정 — 잘못된 ID 허용 시 전체 데이터 오염 → plan 필수)  |

```
ontology-registry.json 초기 구조:
{
  "node_types": ["LAW", "FORMULA", "INVESTIGATION", "INSURANCE", "CROP", "CONCEPT", "TERM"],
  "edge_types": ["APPLIES_TO", "REQUIRES_INVESTIGATION", "PREREQUISITE", "USES_FORMULA",
                  "DEPENDS_ON", "GOVERNED_BY", "DEFINED_AS", "EXCEPTION", "TIME_CONSTRAINT",
                  "SUPERSEDES", "SHARED_WITH", "DIFFERS_FROM", "CROSS_REF"],
  "node_id_patterns": {
    "CONCEPT": "CONCEPT-\\d{3}",
    "FORMULA": "F-\\d{2}",
    "INSURANCE": "INS-\\d{2}"
  }
}
```

#### Step 0-9. M07 Claude API 배치 프로세서

| 항목       | 상세                                                                                |
| ---------- | ----------------------------------------------------------------------------------- |
| **작업**   | 섹션 텍스트 → Claude API(Haiku) → Knowledge Contract JSON 초안 (Ontology Lock 적용) |
| **산출물** | `packages/parser/src/batch-processor.ts`                                            |
| **검증**   | BATCH 1 실행 → JSON 출력 → M08 스키마 검증 통과                                     |
| **의존**   | Step 0-7, Step 0-8                                                                  |
| **DEFCON** | L2                                                                                  |

```
Knowledge Contract JSON 형식:
{
  "nodes": [
    { "id": "CONCEPT-001", "type": "CONCEPT", "title": "...",
      "content": "...", "lv1_insurance": "...", "lv2_crop": "...",
      "lv3_investigation": "...", "truth_weight": 5, "source_page": 403 }
  ],
  "edges": [
    { "source_id": "...", "target_id": "...", "edge_type": "USES_FORMULA",
      "condition": "...", "is_active": true }
  ],
  "constants": [
    { "name": "...", "category": "coefficient", "value": "1.0115",
      "numeric_value": 1.0115, "unit": "배수", "confusion_level": "danger" }
  ],
  "formulas": [
    { "id": "F-01", "name": "...", "equation_template": "...",
      "variables_schema": {}, "expected_inputs": "..." }
  ]
}

호출 규약:
- 타임아웃: 30초
- 재시도: 3회 (지수 백오프)
- 토큰 비용 로깅 필수
- Ontology Lock: ontology-registry.json 외 ID → 거부 + 재프롬프트
```

#### Step 0-10. M09 Constants 추출기

| 항목       | 상세                                                             |
| ---------- | ---------------------------------------------------------------- |
| **작업**   | 매직 넘버 추출 (수치, 날짜, 임계값, 계수) + confusion_level 태깅 |
| **산출물** | `packages/parser/src/constants-extractor.ts`                     |
| **검증**   | BATCH 1 범위 상수 전수 추출, 교재 원문과 값 100% 일치            |
| **의존**   | Step 0-9 (배치 프로세서 출력에서 상수 추출)                      |
| **DEFCON** | L2                                                               |

```
confusion_level 기준:
- danger: 혼동 빈출 수치 (경작불능 65% vs 분질미 60%)
- warn: 유사한 수치 존재 (단감 1.0115 vs 떫은감 0.9662)
- safe: 단독 수치 (혼동 위험 낮음)
```

#### Step 0-11. M16 Formula Engine PoC (L3)

| 항목       | 상세                                                                  |
| ---------- | --------------------------------------------------------------------- |
| **작업**   | math.js AST 파서 기반 산식 연산 엔진 PoC                              |
| **산출물** | `packages/formula-engine/src/` 4개 파일                               |
| **검증**   | BATCH 1의 15개 산식, 교재 예시값으로 100% 정확도 (소수점 정밀도 포함) |
| **의존**   | Step 0-2 (constants 테이블), Step 0-10                                |
| **DEFCON** | **L3** (산식 연산 = 계산 오류 시 서비스 사망 → plan 필수)             |

```
핵심 제약:
- 동적 코드 실행 절대 금지 (Hard Rule #9)
- math.js의 parse() + evaluate()만 사용
- constants는 DB에서 직접 조회 (LLM 추론 금지)
- 부동소수점: 계수 곱셈 시 정밀도 검증 (1.0115 × 0.45 등)

4개 모듈:
1. ast-parser.ts: equation_template → math.js AST 트리
2. variable-mapper.ts: expected_inputs 기반 변수명 → 실제값 매핑
3. constants-resolver.ts: 산식 내 상수명 → D1 쿼리 → numeric_value 반환
4. engine.ts: 위 3개 조합 → 최종 계산 결과 반환
```

#### Step 0-12. M14 Graph 무결성 검증기

| 항목       | 상세                                                   |
| ---------- | ------------------------------------------------------ |
| **작업**   | 고아 노드 0건, 끊긴 엣지 0건, SUPERSEDES 순환 0건 검증 |
| **산출물** | `packages/quality/src/graph-integrity.ts`              |
| **검증**   | BATCH 1 결과에 대해 무결성 검증 통과                   |
| **의존**   | Step 0-2 (DB), Step 0-9 (데이터 적재 후)               |
| **DEFCON** | L2                                                     |

#### Step 0-13. M28 Graph Visualizer 경량 버전

| 항목       | 상세                                                                                   |
| ---------- | -------------------------------------------------------------------------------------- |
| **작업**   | D3.js Force Graph, 서브그래프 단위만 렌더링 (Hairball 방지), draft→approved 워크플로우 |
| **산출물** | `apps/admin-web/src/GraphVisualizer.tsx`, `ContentQueue.tsx`                           |
| **검증**   | BATCH 1 노드/엣지 시각화, 서브그래프 필터링 동작, 검수 상태 전환                       |
| **의존**   | Step 0-2, Step 0-9 (적재된 데이터 필요)                                                |
| **DEFCON** | L2                                                                                     |

```
Hairball 방지:
- 전체 그래프 렌더링 금지
- LV1(보장방식) 또는 LV2(품목) 기준 서브그래프 선택
- 최대 노드 수 제한 (한 화면 100개 이하)
- 인간 검수 워크플로우: draft → review → approved → published
```

#### Step 0-14. BATCH 1 PoC 통합 실행 → QG-2

```
전체 흐름:
  PDF(p.403~434) → M01 → M06 → M07(+M08 검증) → M09 → DB적재(draft)
  → M14 무결성 → M28 시각화 → 인간 검수 → approved
  → M16 산식 검증

★ QG-2 게이트:
  - BATCH 1 → 40+ 노드, 80+ 엣지, 7+ 산식  ← v1.1 현실 조정 (32쪽에서 200 엣지는 과대)
  - 산식 정확도 100% (교재 예시값 대비)
  - Graph 무결성: 고아노드 0, 순환 0, 끊긴엣지 0
  실패 시 → 프롬프트 재설계 + 파이프라인 재조정, Phase 1 진입 보류
```

#### Phase 0 완료 시 필수 작업

```
1. docs/epics/EPIC-P0-foundation.md 작성 (§2.5 형식)
2. .jjokjipge/state.json 업데이트: { "phase": 1, "step": "1-1" }
3. .jjokjipge/completed.md에 Phase 0 Step 전체 기록
4. CLAUDE.md "현재 상태" 업데이트
```

---

## 5. Phase 1: Data Pipeline + Core Engine (Week 5~10)

> **목표:** 2차 전체 + 1차 3과목 Graph 완성 + Core 엔진 5개 모듈 구현
> **QG-3:** 기출↔Graph 100% / **QG-4:** 1차 삼각 검증 / **QG-5:** 엔진 5개 통과

---

### Week 5-6: 2차 BATCH 2~5 + 1차 상법

#### Step 1-1. BATCH 2~5 순차 실행

| 항목       | 상세                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| **작업**   | Phase 0 파이프라인으로 BATCH 2~5 순차 처리 (배치당 품질 게이트 필수)                                                  |
| **범위**   | B2: 종합위험 수확감소 16종 (p.435~500), B3: 논작물 (p.501~521), B4: 밭작물 (p.522~576), B5: 시설+수입감소 (p.577~647) |
| **산출물** | D1에 ~300 노드, ~1,000 엣지, ~75 산식 추가 적재 (approved)                                                            |
| **검증**   | 각 배치별: Graph 무결성 → 인간 검수 → 산식 100%                                                                       |
| **의존**   | QG-2 통과 (Phase 0 완료)                                                                                              |

```
배치 순서 엄수 (Hard Rule #6):
  BATCH 2 검증 완료 → BATCH 3 착수 → BATCH 3 검증 완료 → BATCH 4 착수 → ...
  어떤 배치도 이전 배치 검증 없이 진행 불가
```

#### Step 1-2. M10 Revision 감지기

| 항목       | 상세                                                       |
| ---------- | ---------------------------------------------------------- |
| **작업**   | 교재 vs 이전 버전 비교, 개정 이력 추출, exam_priority 태깅 |
| **산출물** | `packages/parser/src/revision-detector.ts`                 |
| **검증**   | 주요 개정사항 10건 이상 감지, revision_changes 테이블 적재 |
| **의존**   | Step 0-9, Step 1-1 (데이터 축적 후)                        |

#### Step 1-3. 상법 보험편 Graph 구축

| 항목       | 상세                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| **작업**   | 상법 제638~730조 → LAW ~100 + CONCEPT ~40 + TERM ~30 + EXCEPTION ~20 노드   |
| **산출물** | D1에 상법 Graph 적재, 엣지: GOVERNED_BY, PREREQUISITE, EXCEPTION, CROSS_REF |
| **검증**   | 조문 누락 0건, CROSS_REF(준용 관계) 정확도 검증                             |
| **의존**   | Step 0-6 (법령 수집기), Step 0-8 (Ontology)                                 |

#### Step 1-4. M13 기출 정답 대조기 → QG-3

| 항목       | 상세                                                  |
| ---------- | ----------------------------------------------------- |
| **작업**   | Graph 해설과 기출 공식 정답의 100% 일치 검증          |
| **산출물** | `packages/quality/src/answer-matcher.ts`              |
| **검증**   | **전 기출 ↔ Graph 정답 100% 일치** (불일치 → flagged) |
| **의존**   | Step 0-5 (기출), Step 1-1~1-3 (Graph)                 |

```
★ QG-3 게이트: 기출↔Graph 100% 일치
  - 불일치 1건이라도 → 파이프라인 중단, 원인 규명
  - Hard Rule #11: Graph↔기출 충돌 → flagged 처리

v1.1 추가 — 시간축 정답 변경 처리 (DEV COVEN HI-06):
  - 개정으로 과거 기출 정답이 변경된 경우 감지
  - "2019 기출 정답 ≠ 현행 Graph 정답" → status='deprecated' + superseded_by 연결
  - 학습 UI에서 deprecated 문항은 "⚠️ 개정으로 정답 변경" 배너와 함께 표시
  - exam_questions.valid_from/valid_until 필드를 정답 대조 시 필수 참조
```

---

### Week 7-8: 1차 법령 + 농학 역공학

#### Step 1-5. 법령 Graph (농어업재해보험법 + 시행령 + 고시)

| 항목       | 상세                                                        |
| ---------- | ----------------------------------------------------------- |
| **작업**   | 3단계 위계 Graph: 법률(tw=10) → 시행령(tw=9) → 고시(tw=8)   |
| **산출물** | LAW ~70, CONCEPT ~50, TERM ~30 노드 + GOVERNED_BY 엣지 체인 |
| **검증**   | 법령 계층 관계 정확, 2023~2025 개정사항 exam_priority 최고  |
| **의존**   | Step 0-6, Step 1-2                                          |

#### Step 1-6. M04 Vision OCR + M11 토픽 클러스터러 + M05 웹 보강

| 항목       | 상세                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| **작업**   | 농학개론 역공학: 이론서 스캔 → OCR → 기출 기반 토픽 클러스터링 → 웹 보강                  |
| **산출물** | `vision-ocr.ts`, `topic-clusterer.ts`, `web-supplement.ts`, `curriculum-reconstructor.ts` |
| **검증**   | M04-T01(인식률 95%+), 토픽 커버리지 → 미출제 영역 라벨링                                  |
| **의존**   | Step 0-5 (기출 데이터)                                                                    |

```
농학개론 특수 전략:
- 교재 없음 → 기출 275문항에서 역공학으로 지식체계 재구성
- 역공학: 기출 → 출제 토픽 추출 → 빈도 분석 → 커리큘럼 트리
- 웹 보강: 농진청, 농사로, 국가표준식물목록
- Hard Rule #12: 미출제 영역은 is_covered=false 라벨링
```

#### Step 1-7. M12 삼각 교차 검증기 → QG-4

| 항목       | 상세                                            |
| ---------- | ----------------------------------------------- |
| **작업**   | 교재 × 법령 × 기출 3자 일관성 검증              |
| **산출물** | `packages/quality/src/triangulation-checker.ts` |
| **검증**   | 1차 3과목 + 2차 전체 삼각 검증 통과             |
| **의존**   | Step 1-3, Step 1-5, Step 1-6 (3과목 Graph 완성) |

```
★ QG-4 게이트: 1차 3과목 Graph 완성 + 삼각 검증 통과
  실패 시 → 미통과 영역 재작업
```

---

### Week 9-10: Core 엔진

#### Step 1-8. M15 Graph RAG 검색 엔진

| 항목       | 상세                                                                 |
| ---------- | -------------------------------------------------------------------- |
| **작업**   | 메타데이터 필터(LV1~LV3) → Vectorize 유사도 검색 → truth_weight 정렬 |
| **산출물** | `apps/api/src/services/graph-rag.ts`                                 |
| **검증**   | M15-T01: 검색 정확도 90%+ (대표 질의 50건)                           |
| **의존**   | Step 0-2, Step 1-1~1-7 (Graph 완성)                                  |

```
검색 파이프라인:
1. 질의 분석 → LV1/LV2/LV3 메타데이터 추출
2. D1 메타데이터 필터 (WHERE lv1_insurance=? AND lv2_crop=?)
3. 필터된 노드 → Vectorize 유사도 검색
4. truth_weight 정렬 (LAW > FORMULA > CONCEPT)
5. 유사도 < 0.60 → Graceful Degradation
6. 결과 → Claude API context 주입
```

#### Step 1-9. M16 Formula Engine 확장 (L3)

| 항목       | 상세                                       |
| ---------- | ------------------------------------------ |
| **작업**   | PoC → 전체 ~125개 산식 커버리지 확장       |
| **검증**   | M16-T01: 전체 산식 100% 정확도             |
| **의존**   | Step 0-11 (PoC), Step 1-1 (BATCH 2~5 산식) |
| **DEFCON** | **L3**                                     |

#### Step 1-10. M17 FSRS 간격반복 엔진

| 항목       | 상세                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **작업**   | **기존 FSRS v4.5 복사** (416줄+테스트 200줄) → Hexagonal 구조 이식 + 클라이언트 로컬 실행 추가 |
| **소스**   | `/home/soo/ThePick/modules/learning/src/fsrs/scheduler.ts` + `scheduler.test.ts` **100% 복사** |
| **산출물** | `modules/learning/domain/services/fsrs-scheduler.ts`, `apps/web/src/lib/fsrs-client.ts`        |
| **검증**   | M17-T01: 기존 테스트 전부 통과 + Python 참조와 100% 동일 결과                                  |
| **의존**   | Step 0-2 (user_progress 테이블)                                                                |

```
클라이언트 로컬 실행:
- 오프라인에서도 복습 스케줄 계산 가능
- 서버와의 차이는 동기화 시점에 보정
- confusion_level=danger → 초기 난이도↑ → 복습 주기↓
```

#### Step 1-11. M18 혼동 유형 감지 엔진

| 항목       | 상세                                                    |
| ---------- | ------------------------------------------------------- |
| **작업**   | 8종 혼동 유형 자동 감지 + 개인화(사용자 오답 패턴 분석) |
| **산출물** | `apps/api/src/services/confusion.ts`                    |
| **검증**   | 8종 유형별 최소 5건 감지 + 개인화 로직 테스트           |

```
8종 혼동 유형:
1. 숫자/수치 혼동    → Peg System + 대비표
2. 소수점 계수       → 숫자분해법 + 반복연산
3. 날짜/기간 혼동    → Memory Palace + 달력
4. 긍부정 함정       → OX 반전 훈련
5. 예외 함정         → 대비 스토리
6. 절차 순서         → Memory Palace + 플로우차트
7. 작물간 교차       → 교차 비교표
8. 나열 항목 누락    → 두문자어(Acronym)
```

#### Step 1-12. M19 암기법 매칭 엔진

| 항목       | 상세                                                     |
| ---------- | -------------------------------------------------------- |
| **작업**   | 혼동 유형 → 최적 암기법 매칭 (8종 × 1순위 매칭 매트릭스) |
| **산출물** | `apps/api/src/services/mnemonic.ts`                      |
| **검증**   | 매칭 정확도 검증 (각 유형별 대표 케이스)                 |
| **의존**   | Step 1-11                                                |

```
★ QG-5 게이트: 엔진 5개 모듈 통과
  - M15-T01: 검색 정확도 90%+
  - M16-T01: 산식 100%
  - M17-T01: FSRS 100% 일치
  - M18: 8종 유형 감지 동작
  - M19: 매칭 매트릭스 동작
```

#### Phase 1 완료 시 필수 작업

```
1. docs/epics/EPIC-P1-pipeline.md 작성 (§2.5 형식)
2. .jjokjipge/state.json → { "phase": 2, "step": "2-1" }
3. modules/ 도메인 로직이 Hexagonal 규칙 준수하는지 아키텍처 리뷰
```

---

## 6. Phase 2: Content + Service (Week 11~14)

> **목표:** 학습 컨텐츠 자동 생성 + 학습 서비스 UI 4개 모드 완성
> **QG-6:** 생성 컨텐츠 정답 100% / **QG-7:** 통합 테스트 8건 통과

---

### Week 11-12: 컨텐츠 생성 (M20~M24)

#### Step 2-1. M20 플래시카드 생성기

| 항목       | 상세                                                           |
| ---------- | -------------------------------------------------------------- |
| **작업**   | constants + knowledge_nodes → FSRS 플래시카드 자동 생성        |
| **산출물** | `packages/study-material-generator/src/flashcard-generator.ts` |
| **검증**   | 내용 정확도 (랜덤 50장 수동 대조)                              |

#### Step 2-2. M21 OX/빈칸 문제 생성기

| 항목       | 상세                                                    |
| ---------- | ------------------------------------------------------- |
| **작업**   | Graph 노드 → OX/빈칸문제 자동 생성 (Claude API)         |
| **산출물** | `packages/study-material-generator/src/ox-generator.ts` |
| **검증**   | **정답 100% 필수** — Hard Stop 조건 #3                  |

#### Step 2-3. M22 기출 변형 생성기

| 항목       | 상세                                                           |
| ---------- | -------------------------------------------------------------- |
| **작업**   | 기출 → 선지 셔플/긍부정 전환/수치 변경                         |
| **산출물** | `packages/study-material-generator/src/variation-generator.ts` |
| **검증**   | **변형 후 정답 100% 유지**                                     |

#### Step 2-4. M23 암기법 생성기

| 항목       | 상세                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **작업**   | 혼동 유형별 두문자어/연상법/Memory Palace 자동 생성                                            |
| **참조**   | `/home/soo/ThePick/apps/api/src/lib/claude.ts` (277줄) — 한국어 프롬프트, 배치, 비용 추적 패턴 |
| **산출물** | `packages/study-material-generator/src/mnemonic-generator.ts`                                  |
| **검증**   | Hard Rule #14: 역방향 검증 — 복원 실패 시 폐기                                                 |

#### Step 2-5. M24 산식 계산기 + 플로우차트 + 비교 매트릭스

| 항목       | 상세                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **작업**   | 인터랙티브 산식 카드, 조사 절차 SVG, 조건 분기 아코디언, 비교표, 개정 배너                                                         |
| **산출물** | `formula-card-generator.ts`, `flowchart-generator.ts`, `condition-tree-generator.ts`, `comparison-matrix.ts`, `revision-banner.ts` |
| **검증**   | 산식 카드: Formula Engine과 동일 결과                                                                                              |

```
★ QG-6 게이트: 생성 컨텐츠 정답 100%
  - OX/빈칸 정답 100% (전수 검증)
  - 기출 변형 정답 100% (전수 검증)
  - 암기법 역방향 복원 성공율 검증
  실패 시 → 생성 로직 재설계
```

---

### Week 13-14: 학습 서비스 UI + API 통합

#### Step 2-6. M25 기출 풀이 서비스

| 항목       | 상세                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| **작업**   | 필터 → 문제 표시 → 풀이 → Graph RAG 해설 → 오답 → FSRS 기록                                                     |
| **참조**   | `/home/soo/ThePick/apps/web/src/components/StudySession.tsx` (382줄) — 카드 렌더링, 피드백, 세션 결과 UI 베이스 |
| **산출물** | `apps/web/src/pages/exam/`, `ExamCard.tsx`                                                                      |
| **검증**   | 필터, 해설 정확성, FSRS 기록 → IndexedDB → 서버 동기화                                                          |

```
UI 필수 상태:
- 로딩 / 빈 데이터(기출 0건) / 에러 / 오프라인 — 4개 UI 모두 구현
- 에러 UX: "교재 O장 O절 참고" (기술 에러 노출 금지)
- 터치 타겟 44px+, aria-label
```

#### Step 2-7. M26 복습/약점 공략 서비스

| 항목       | 상세                                                            |
| ---------- | --------------------------------------------------------------- |
| **작업**   | FSRS 스케줄 기반 오늘의 복습 카드 + 혼동유형별 집중 훈련        |
| **산출물** | `apps/web/src/pages/review/`, `FlashCard.tsx`                   |
| **검증**   | FSRS 스케줄 정확, 혼동유형별 카드 비중 자동 조절, 오프라인 동작 |

#### Step 2-8. M27 모의시험 + 대시보드

| 항목       | 상세                                                                      |
| ---------- | ------------------------------------------------------------------------- |
| **작업**   | 과목당 25문항 × 3과목, 타이머(100분), 합격판정(과목40+/평균60+), 대시보드 |
| **산출물** | `apps/web/src/pages/mock/`, `Dashboard.tsx`                               |

```
대시보드:
- 과목별 정답률 추이 차트
- 혼동 유형별 약점 분석
- FSRS 복습 스케줄 캘린더
- 모의시험 합격 예측 (최근 3회 평균)
- 학습 스트릭 (연속 학습 일수)
```

#### Step 2-9. M28 Graph Visualizer 완성 + 관리자 CMS

| 항목       | 상세                                                             |
| ---------- | ---------------------------------------------------------------- |
| **작업**   | Graph Visualizer 고급 기능 + Constants 검수 UI + 파이프라인 관리 |
| **산출물** | `apps/admin-web/` 확장                                           |

#### Step 2-10. Cloudflare Workers API 통합

| 항목       | 상세                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| **작업**   | Hono 라우터, 인증, AppError 기반 에러 핸들링(§2.3), 전체 API 엔드포인트. routes/ → modules/ 유스케이스 호출 |
| **산출물** | `apps/api/src/` (routes + middleware만 — 도메인 로직은 modules/에 위치)                                     |
| **검증**   | API E2E 테스트, Workers 배포 성공, CPU 제약 확인, ErrorResponse 표준 준수                                   |

```
API 엔드포인트:
POST /api/graph/search       — Graph RAG 검색
POST /api/formula/calculate   — 산식 계산
GET  /api/exam/questions      — 기출 목록 (필터)
GET  /api/exam/question/:id   — 기출 상세
POST /api/progress/sync       — 학습 진도 동기화 (배치)
GET  /api/review/today        — 오늘의 복습 카드
POST /api/mock/submit         — 모의시험 제출
GET  /api/dashboard/stats     — 대시보드 통계
POST /api/tutor/ask           — AI 튜터 질의
GET  /api/admin/content-queue — 관리자 검수 큐

Workers 제약:
- CPU: 50ms(free), 30s(paid $5/mo)
- 번들: 10MB 이하
- fs/path 사용 금지
```

#### Step 2-11. 오프라인 동기화 엔진

| 항목       | 상세                                                       |
| ---------- | ---------------------------------------------------------- |
| **작업**   | Background Sync, offlineActions 큐 → 배치 전송 → 충돌 해결 |
| **산출물** | `apps/web/src/lib/sync-engine.ts`                          |
| **검증**   | 오프라인 학습 → 온라인 복귀 → 동기화 성공                  |

```
충돌 해결:
- 학습 데이터: 최근 타임스탬프 우선 (유실 방지)
- 콘텐츠 데이터: 서버 우선 (approved가 진실)
- 배치 동기화: 5분 간격
```

```
★ QG-7 게이트: 통합 테스트 8건 전부 통과
  INT-01: PDF → Graph → 검색 → 해설 (E2E)
  INT-02: 기출 풀이 → 오답 → FSRS → 복습 카드 출현
  INT-03: 산식 질의 → Formula Engine → 정확한 계산 결과
  INT-04: 혼동 감지 → 암기법 매칭 → 카드 생성
  INT-05: 오프라인 학습 → 온라인 동기화
  INT-06: 모의시험 → 합격판정 → 대시보드 반영
  INT-07: 개정 사항 → 배너 표시 + 기출 플래깅
  INT-08: 관리자 검수 → draft→approved → 사용자 노출
```

#### Phase 2 완료 시 필수 작업

```
1. docs/epics/EPIC-P2-service.md 작성 (§2.5 형식)
2. .jjokjipge/state.json → { "phase": 3, "step": "3-1" }
3. i18n 키 전수 점검: 사용자 노출 문자열 중 한국어 하드코딩 0건 확인
```

---

## 7. Phase 3: Launch Ready (Week 15~16)

> **목표:** 전체 E2E 검증 + 베타 테스트 + 런칭 준비
> **QG-8:** 오답 신고 0건, P95 < 3초

---

### Week 15: 최종 검증

#### Step 3-1. 전체 기출 E2E 검증

825문항 전수 E2E — 기출 조회 → 풀이 → 해설 → 정답 일치. 불일치 0건 (Hard Stop #1)

#### Step 3-2. Formula Engine 전수 검증

125개 산식 전수 실행 → 교재 예시값 대조. 불일치 0건 (Hard Stop #2)

#### Step 3-3. 성능 최적화

API P95 < 3초, PWA Lighthouse 90+, 번들 < 300KB(gzip)

#### Step 3-4. 보안 점검

API 키 노출 0건, XSS/injection 0건, 입력 검증, PII 최소 수집 확인

---

### Week 16: 베타 + 런칭

#### Step 3-5. 수험생 베타 테스트 (5~10인)

1주간 실사용, 오답 신고 0건, UX 피드백 반영

#### Step 3-6. 런칭 체크리스트

```
[ ] tsc --noEmit 통과
[ ] eslint + prettier 통과
[ ] vitest 전체 통과
[ ] playwright E2E 통과
[ ] 7개 100% 필수 테스트 확인
[ ] L3 영역 plan + 승인 완료
[ ] .env.example 환경변수 반영
[ ] PWA Lighthouse 90+
[ ] 오프라인 동작 확인
[ ] P95 < 3초
[ ] 오답 신고 0건
[ ] i18n: 사용자 노출 문자열 중 하드코딩 0건
[ ] 에러 처리: 모든 API가 AppError/ErrorResponse 표준 준수
[ ] Epic 문서: EPIC-P0~P3 전부 작성 완료
[ ] .jjokjipge/completed.md 전체 Step 기록 완료
[ ] modules/ Hexagonal 의존 방향 위반 0건
[ ] 배포: Cloudflare Pages + Workers + D1 + Vectorize
```

```
★ QG-8: 런칭 판정
  - 기출 정답 100%, 베타 오답 0건, P95 < 3초
  - 실패 → 런칭 연기
```

---

## 8. 품질 게이트 총괄표

| 게이트   | Phase | Week | 절대 조건                           | 실패 시          |
| -------- | ----- | ---- | ----------------------------------- | ---------------- |
| **QG-1** | P0    | W2   | 기출 정답 100%                      | 파서 재구현      |
| **QG-2** | P0    | W4   | BATCH 1 산식 100%, 40+노드, 80+엣지 | 프롬프트 재설계  |
| **QG-3** | P1    | W6   | 기출↔Graph 100%                     | 파이프라인 중단  |
| **QG-4** | P1    | W8   | 1차 3과목 삼각 검증                 | 미통과 재작업    |
| **QG-5** | P1    | W10  | 엔진 5개 모듈 통과                  | 재구현           |
| **QG-6** | P2    | W12  | OX/변형/암기법 정답 100%            | 생성 로직 재설계 |
| **QG-7** | P2    | W14  | 통합 테스트 8건 통과                | 개별 수정        |
| **QG-8** | P3    | W16  | 오답 0건, P95 < 3초                 | 런칭 연기        |

### Hard Stop 조건 (즉시 기능 비활성화)

1. 기출 정답과 불일치하는 해설이 사용자에게 노출
2. Formula Engine이 잘못된 계산 결과 반환
3. OX/빈칸 문제의 정답이 틀림
4. 개정 전 내용을 현행으로 표시
5. 교재 오류를 올바른 정보로 착각하여 학습자에게 제공 ← v1.1 추가

---

## 9. 의존관계 그래프

```
Phase 0 (Week 1~4)
═══════════════════════════════════════════════════════════

Step 0-1 (모노레포)
  ├──→ Step 0-2 (DB 스키마 [L3])
  ├──→ Step 0-3 (PWA 셸)
  ├──→ Step 0-4 (PDF 추출기) ──→ Step 0-5 (기출 파서) → QG-1
  │                           └──→ Step 0-7 (섹션 분리)
  ├──→ Step 0-6 (법령 수집기)
  └──→ Step 0-8 (Ontology)

       Step 0-7 + 0-8 ──→ Step 0-9 (배치 프로세서)
                              └──→ Step 0-10 (Constants)

       Step 0-2 + 0-10 ──→ Step 0-11 (Formula PoC [L3])
       Step 0-2 + 0-9  ──→ Step 0-12 (무결성 검증)
       Step 0-2 + 0-9  ──→ Step 0-13 (Graph Viz)

       All above ──→ Step 0-14 (BATCH 1 통합) → QG-2

Phase 1 (Week 5~10)
═══════════════════════════════════════════════════════════

  QG-2 ──→ Step 1-1 (BATCH 2~5) ──→ Step 1-2 (Revision)
  Step 0-6 ──→ Step 1-3 (상법 Graph)
  Step 1-1 + 1-3 ──→ Step 1-4 (정답 대조) → QG-3

  Step 0-5 ──→ Step 1-6 (농학 역공학)
  Step 1-5 (법령 Graph)
  Step 1-3 + 1-5 + 1-6 ──→ Step 1-7 (삼각 검증) → QG-4

  Graph 완성 ──→ Step 1-8 (Graph RAG)
  Step 0-11 ──→ Step 1-9 (Formula 확장 [L3])
  Step 0-2 ──→ Step 1-10 (FSRS)
  Step 0-10 ──→ Step 1-11 (혼동감지) ──→ Step 1-12 (암기)
                                  → QG-5

Phase 2 (Week 11~14)
═══════════════════════════════════════════════════════════

  QG-5 ──→ Step 2-1~2-5 (컨텐츠 생성) → QG-6
  QG-6 ──→ Step 2-6~2-9 (학습 서비스 UI)
  Step 1-8~1-12 ──→ Step 2-10 (API 통합)
  Step 0-3 ──→ Step 2-11 (오프라인 동기화)
                                  → QG-7

Phase 3 (Week 15~16)
═══════════════════════════════════════════════════════════

  QG-7 ──→ Step 3-1~3-6 (최종 검증 + 베타) → QG-8
```

---

## 10. 리스크 매트릭스 + 완화 전략

| #   | 리스크                                        | 영향 | 확률 | 완화 전략                                    |
| --- | --------------------------------------------- | ---- | ---- | -------------------------------------------- |
| R1  | Claude API 배치에서 Ontology 외 ID 대량 생성  | 높   | 중   | M08 검증 + 거부/재프롬프트 자동화            |
| R2  | 부동소수점 산식 정밀도 오차                   | 높   | 높   | 교재 예시값 100% 대조, 정밀도 6자리          |
| R3  | 교재 개정으로 기존 Graph 무효화               | 중   | 매년 | Temporal Graph + SUPERSEDES + 자동 플래깅    |
| R4  | 농학개론 커버리지 부족                        | 중   | 높   | 역공학 + 웹 보강 + 미출제 라벨링             |
| R5  | Workers CPU 50ms 초과                         | 낮   | 중   | Paid plan($5/mo), batch 분리                 |
| R6  | IndexedDB 동기화 충돌                         | 낮   | 낮   | 타임스탬프 충돌 해결                         |
| R7  | iOS PWA 제한 (Push 등)                        | 낮   | 중   | iOS 16.4+ 지원, 앱 내 알림 대체              |
| R8  | 기출 PDF 형식 비일관성                        | 중   | 높   | 회차별 파서 분기 + 수동 보정                 |
| R9  | math.js ~800KB 번들 → Workers 콜드스타트 지연 | 중   | 높   | `create({})` 선택적 팩토리, 트리쉐이킹       |
| R10 | 인증 체계 부재로 베타 사용자 관리 불가        | 높   | 확정 | Phase 1 초기에 최소 인증 구현 (HI-02)        |
| R11 | Vectorize 한국어 성능 미검증                  | 높   | 중   | HK-01 임베딩 PoC 선행 (Phase 1 초기)         |
| R12 | 26년 개정사항 미반영 시 Constants 오류        | 높   | 확정 | 개정 영향 매핑 → 배치 착수 전 선반영 (CR-05) |

---

## 10-1. MVP 범위 제한 — Won't Do 목록 (v1.1 추가)

> DEV COVEN MD-01: 스코프 크리프 방지를 위한 명시적 제외 목록

### MVP에서 하지 않을 것

| 항목                                  | 사유                                 |
| ------------------------------------- | ------------------------------------ |
| 2차 시험 BATCH 6~7                    | 1차 집중 후 Phase 4에서 처리         |
| AI 튜터 (자연어 질의)                 | Graph RAG + 검색으로 충분, Phase 3+  |
| 게이미피케이션 (스트릭, 뱃지)         | 핵심 학습 기능 아님, Post-MVP        |
| 스터디그룹 / 소셜 기능                | 1인 학습 서비스에 불필요, Post-MVP   |
| 오디오 모드                           | PWA 텍스트 기반으로 충분             |
| 결제 시스템                           | 베타 무료 운영, 유료 전환은 Phase 4  |
| 다크모드                              | Tailwind 기반이므로 나중에 쉽게 추가 |
| 네이티브 앱                           | PWA로 충분                           |
| 다국어(영어 등)                       | 한국어 전용 서비스                   |
| M24 플로우차트·비교 매트릭스·조건트리 | Phase 3+ 이동                        |
| M28 관리자 CMS 고급 기능              | Phase 3+ 이동                        |

### 절대 하지 않을 것

- 네이티브 앱 (React Native, Flutter)
- 다른 시험 동시 지원 (확장은 Phase 4에서 순차적으로)
- Claude API 키 클라이언트 노출 (Workers 프록시 필수)

---

## 10-2. Phase 4: 확장 PoC (v1.1 추가, Week 17~18)

> DEV COVEN CR-01: 연 ~3,000명 시장에서 ROI 확보를 위한 확장 필수

### 목표

손해평가사 MVP 성공 후, 첫 확장 대상으로 **공인중개사(연 ~20만 응시, 75% Core 재사용)** PoC 실행

### Step 4-1. 공인중개사 PoC (2주)

```
1. 기출 10문항으로 Graph 구조화 테스트
2. ontology-registry.json에 부동산 도메인 ID 추가
3. 기존 Formula Engine의 부동산 세금 계산 적용 가능성 검증
4. 결과: 확장 결정(Go) 또는 재검토(Re-evaluate) 판정
```

### 수익 모델 재검토

```
손해평가사 단독: 월 9,900원 × 100명 = 월 99만원 (Claude API 비용 미달)
+ 공인중개사: 월 9,900원 × 1,000명 = 월 990만원 (흑자 전환 가능)
→ 확장이 생존 조건임을 인식하고 Phase 4를 로드맵에 포함
```

---

## 12. 기술 결정 기록 (ADR 요약)

| ADR | 결정                           | 근거                                                          | 대안(기각)                                |
| --- | ------------------------------ | ------------------------------------------------------------- | ----------------------------------------- |
| 01  | PWA                            | 1 코드베이스, 스토어 불필요                                   | React Native, Flutter                     |
| 02  | Astro + React Islands          | 정적 빠름, Islands로 인터랙티브                               | Next.js (서버 과의존)                     |
| 03  | Zustand                        | 경량, React 외부 접근                                         | Redux Toolkit (과도)                      |
| 04  | IndexedDB/Dexie.js             | 구조화 쿼리, 용량 무제한                                      | localStorage (5MB)                        |
| 05  | Cloudflare D1+Workers          | Edge, 저비용, SQLite 친화                                     | Supabase, PlanetScale                     |
| 06  | Drizzle ORM                    | 타입 안전, D1 네이티브, 경량                                  | Prisma (Workers 호환)                     |
| 07  | math.js AST                    | 보안(동적 실행 차단), 감사 가능                               | 동적 코드 실행 (보안 위험)                |
| 08  | FSRS-5                         | 최신 간격반복, 개인화 우수                                    | SM-2 (구식)                               |
| 09  | Claude Haiku 배치              | 비용 효율, 구조화 품질 충분                                   | GPT-4 (비용)                              |
| 10  | Turborepo                      | 빌드 캐시, 파이프라인 관리                                    | Nx (과도), polyrepo                       |
| 11  | Mermaid.js (아키텍처 문서)     | DaC, Git 버전 관리, 마크다운 내장                             | draw.io (바이너리, diff 불가)             |
| 12  | D3.js Force Graph (Graph 검수) | 커스텀 레이아웃, 계층적 Graph에 적합, 트리쉐이킹              | Cytoscape.js (생물학 최적화, 번들 무거움) |
| 13  | XState **기각**                | 우리 상태 흐름은 if/else + AppError로 충분, Workers 번들 제한 | — (과잉 엔지니어링)                       |

---

## 부록: 100% 필수 테스트 7개

| #   | 모듈               | 테스트                | 실패 시        |
| --- | ------------------ | --------------------- | -------------- |
| 1   | M03 기출 파서      | 기출 정답 100%        | 서비스 사망    |
| 2   | M09 Constants      | 수치/날짜 100%        | 서비스 사망    |
| 3   | M13 정답 대조      | Graph↔기출 100%       | 해설↔정답 충돌 |
| 4   | M16 Formula Engine | 산식 계산 100%        | 보험금 오산정  |
| 5   | M17 FSRS           | Python 참조 100% 일치 | 복습 주기 오류 |
| 6   | M21 OX/빈칸        | 생성 정답 100%        | AI 생성 오답   |
| 7   | M22 기출 변형      | 변형 후 정답 100%     | 정답 뒤바뀜    |

---

## 검토서 반영 대조표

### v1.0 검토 (2026-04-12)

| #   | 검토 항목                                    | 심각도   | 반영 위치                                              | 상태      |
| --- | -------------------------------------------- | -------- | ------------------------------------------------------ | --------- |
| 1   | 프로젝트 구조 불일치 (modules/, .jjokjipge/) | CRITICAL | §3 프로젝트 구조 전면 재설계                           | 반영 완료 |
| 2   | TDD Micro-Task 구조 미적용                   | CRITICAL | §2.2 TDD Micro-Task 분해 패턴 신규 추가                | 반영 완료 |
| 3   | DEFCON 레벨 정의 누락 + Ontology L2→L3       | HIGH     | §2.1 DEFCON 정의 + Step 0-8 L3 수정                    | 반영 완료 |
| 4   | Epic 문서화 프로세스 누락                    | HIGH     | §2.5 + Phase 0/1/2 완료 시 필수 작업 + 런칭 체크리스트 | 반영 완료 |
| 5   | modules/ Hexagonal Architecture 누락         | CRITICAL | §3 modules/ 3개 도메인 + Hexagonal 규칙 추가           | 반영 완료 |
| 6   | i18n 언급 없음                               | MEDIUM   | §2.4 i18n 전략 + Step 0-3 체크리스트 + 런칭 체크리스트 | 반영 완료 |
| 7   | 에러 처리 표준 미언급                        | MEDIUM   | §2.3 AppError/ErrorCode/ErrorResponse + Step 2-10 연결 | 반영 완료 |
| 8   | Guide/ 디렉토리 정의 모호                    | LOW      | §3 트리에 "VOID DEV HARNESS 원본 문서" 설명 추가       | 반영 완료 |
| 9   | 기존 프로젝트 재활용 미반영                  | HIGH     | §2.6 재활용 맵 + Step별 소스/참조 경로 추가            | 반영 완료 |

### v1.1 DEV COVEN 검토 (2026-04-14)

| #     | 검토 항목 (DEV COVEN ID)                    | 심각도   | 반영 위치                                          | 상태      |
| ----- | ------------------------------------------- | -------- | -------------------------------------------------- | --------- |
| CR-01 | 시장 규모 대비 과잉 설계 + 확장 시점 부재   | CRITICAL | §10-2 Phase 4 확장 PoC 신규 추가                   | 반영 완료 |
| CR-02 | 문서 간 아키텍처 불일치 (modules/ 3 vs 6)   | CRITICAL | modules/는 3도메인(content/learning/exam)으로 확정 | 반영 완료 |
| CR-03 | QG-2 기대치 비현실적 (200 엣지)             | CRITICAL | §0-14 + §8: 40+노드, 80+엣지, 7+산식으로 하향      | 반영 완료 |
| CR-04 | 기출 문항 수 불일치 (825 vs 실제 ~581)      | CRITICAL | 재정립서 §1 기출 수 정정                           | 반영 완료 |
| CR-05 | 26년 개정사항 영향 매핑 미확정              | CRITICAL | 재정립서 §14-1 개정 영향 매핑 신규 추가            | 반영 완료 |
| HI-01 | MVP 범위와 16주 일정 괴리                   | HIGH     | §10-1 Won't Do 목록 신규 추가                      | 반영 완료 |
| HI-02 | 인증·세션 관리 설계 부재                    | HIGH     | 재정립서 §5-1 인증 최소 설계 신규 추가             | 반영 완료 |
| HI-03 | Vectorize 구체 스펙 미정                    | HIGH     | 재정립서 §3-1 Vectorize 스펙 신규 추가             | 반영 완료 |
| HI-04 | math.js 번들 크기 + Workers 제약            | HIGH     | §10 R9 리스크 추가                                 | 반영 완료 |
| HI-05 | 교재 오류 처리 메커니즘 부재                | HIGH     | 재정립서 §17 Hard Rule #15~16 추가 + Hard Stop #5  | 반영 완료 |
| HI-06 | 개정 전/후 기출 정답 변경 시나리오 미처리   | HIGH     | Step 1-4 시간축 필터 로직 추가                     | 반영 완료 |
| HI-07 | 오프라인 동기화 충돌 시나리오 테스트 부재   | HIGH     | 재정립서 §6.3 충돌 해결 보강                       | 반영 완료 |
| HI-08 | 개인정보보호법 대응 부재                    | HIGH     | 재정립서 §5-1에 PII 정책 포함                      | 반영 완료 |
| MD-01 | "하지 않을 것" 목록 부재                    | MEDIUM   | §10-1 Won't Do 목록 신규 추가                      | 반영 완료 |
| MD-03 | 기존 프로젝트 재활용 시 이식 비용 과소 추정 | MEDIUM   | 재정립서 §15-1 재활용율 현실 조정                  | 반영 완료 |

---

_"시험 서비스에서 오답 1개 = 서비스 사망. 설계서가 아무리 완벽해도, 구현의 정확도가 100%가 아니면 의미 없다."_
