# Architecture — Engine Internals

본 문서는 [`README.md`](./README.md) §2 패키지 구조와 §6 API 의 깊이 있는 보강. 다른 프로젝트의 Claude Code 가 엔진을 변경하거나 fork 할 때 참조.

---

## 1. 패키지 의존성 그래프

```
┌─────────────────────────────────────────────────────────────────┐
│                         apps (서비스)                             │
│  ┌──────────┐  ┌────────────┐  ┌────────┐  ┌──────────────┐  │
│  │   web    │  │ admin-web  │  │  api   │  │    batch     │  │
│  │ (PWA)    │  │ (검수 UI)  │  │ (HTTP) │  │ (build pipe) │  │
│  └────┬─────┘  └─────┬──────┘  └───┬────┘  └──────┬───────┘  │
└───────┼──────────────┼─────────────┼──────────────┼──────────┘
        │              │             │              │
        ▼              ▼             ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       packages (engine)                          │
│                                                                   │
│  ┌────────────────┐         ┌──────────────────────┐            │
│  │ formula-engine │ ◀──────┤ study-material-       │            │
│  │ (math.js AST)  │         │ generator (Year 2)    │            │
│  └────────┬───────┘         └──────────────────────┘            │
│           │                                                       │
│           ▼                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │   parser       │──│  parser-1st-   │  │  parser-       │    │
│  │ (도메인 무관)  │──│  exam (Y1 한시)│  │  realtor (예시)│    │
│  └────────┬───────┘  └────────────────┘  └────────────────┘    │
│           │                                                       │
│           ▼                                                       │
│  ┌────────────────┐  ┌────────────────┐                         │
│  │   quality      │  │  ai-adapter    │                         │
│  │ (graph integ.) │  │ (Claude API)   │                         │
│  └────────┬───────┘  └────────┬───────┘                         │
│           │                    │                                  │
│           └────────┬───────────┘                                  │
│                    ▼                                              │
│              ┌──────────┐                                         │
│              │  shared  │  ◀── 모든 패키지가 의존 (zero-dep)    │
│              │ (types)  │                                         │
│              └──────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     migrations/ (D1 SQLite)                      │
│  0001 initial → 0019 page/chapter meta                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 의존 방향 규칙 (Hard Rule)

- `shared` ← 모든 패키지 (out-degree 0, in-degree N)
- `formula-engine` ← `parser`, `apps/api`, `apps/batch`
- `parser` → `shared`, `ai-adapter`, `quality` (단방향)
- `quality` → `shared` (그래프 무결성만)
- `ai-adapter` → `shared` (Claude API wrapper)
- `parser-{domain}` → `parser` (어댑터 패턴, 도메인 별 1개)

**위반 예시 (금지)**:

- `parser` → `parser-1st-exam` (역방향)
- `formula-engine` → `parser` (계산 엔진이 추출 엔진에 의존하면 안됨)
- `shared` → 어떤 것도 (zero-dep 유지)

---

## 2. 데이터 흐름 (Build → Validation → Load)

```
[1] PDF (도메인 교재)
     │
     ▼
[2] extract-batch-pages.py (Python subprocess)
     │  - pdfplumber: 페이지 텍스트 + 표 + 이미지
     │  - chapter/section 자동 인식 (정규식 + chapter-init seed)
     │  - 표 cell merge + nested tables
     │  - forward-fill (페이지 경계)
     │  - 분수 regex (1/2, 100/550 등)
     │  - book_page = pdf_page - offset
     │  - Claude Vision fallback (그림 multimodal)
     │
     ▼
[3] page-level JSON + 통합 JSON + 그림 PNG
     │
     ▼
[4] Knowledge Graph 합성 (Claude Code 또는 ai-adapter)
     │  - LLM 이 raw text → 노드/엣지 후보 생성
     │  - ontology-registry.json 패턴 강제
     │  - status='draft' 자동 부착
     │
     ▼
[5] schema-validator (@thepick/parser)
     │  - ID 패턴 / NodeType / EdgeType / 필수 컬럼
     │  - 4 메타 (book_page/pdf_page/chapter/section) 강제
     │  - truth_weight 도메인 정합
     │
     ▼
[6] graph-integrity (@thepick/quality)
     │  - 고아 노드 / 끊긴 엣지 / SUPERSEDES 순환
     │
     ▼
[7] LOCAL D1 dry-run (in-memory SQLite + migrations 적용)
     │  - INSERT OR IGNORE 멱등 검증
     │  - 트리거 (0018 status='draft' / 0019 book_page+pdf_page) 통과
     │
     ▼
[8] json-to-sql-batch.py — JSON → wrangler 적용 SQL
     │
     ▼
[9] wrangler d1 execute --file=insert.sql --remote
     │  - staging → production 순차
     │  - 검증 SELECT (COUNT / orphan_edges / status='draft' 위반)
     │
     ▼
[10] 적재 완료 (status='draft' 영속, 검수 대기)
     │
     ▼
[11] 인간 검수 → status_transitions UPDATE → 'review' → 'approved'
```

---

## 3. 런타임 흐름 (학습자 요청 처리)

```
[학습자 / Astro PWA]
   │ HTTP request (예: 노드 조회, 산식 계산)
   ▼
[apps/api — Cloudflare Workers + Hono]
   │
   ├── Auth middleware (JWT + Rate Limit)
   │
   ├── examId 추출 (Hard Rule 16 강제)
   │
   ▼
[Drizzle ORM → D1 SQLite]
   │ status='approved' 노드만 조회
   │ truth_weight 정렬 (LAW > FORMULA > ...)
   │
   ├── 산식 요청 시:
   │   formula-engine.calculate(formulaId, vars)
   │   - math.js AST 파싱 + sandbox 평가
   │   - Constants Provider 자동 주입
   │   - 결과 + display 문자열 반환
   │
   ├── 자연어 응답 시:
   │   ai-adapter → Claude API
   │   - RAG context 주입 (truth_weight 정렬 노드)
   │   - 산식은 절대 LLM 에 위임하지 않음 (Hard Limit 4)
   │
   ▼
[학습자 ← JSON 응답]
   - 노드 + 근거 (book_page / pdf_page / chapter / section)
   - 산식 결과 + 단계별 풀이
   - "교재 O장 O절 참고" graceful 안내
```

---

## 4. Hexagonal 경계 (도메인 / 인프라 분리)

ThePick 은 Hexagonal Architecture 적용 — 도메인 로직이 인프라에 의존 X.

```
┌─────────────────────────────────────────────┐
│         Domain (packages/)                   │
│                                              │
│  shared (types) ──── Domain Kernel          │
│    │                                         │
│    ├── parser (use cases)                    │
│    ├── formula-engine (use cases)            │
│    └── quality (use cases)                   │
│                                              │
└─────────────────────────────────────────────┘
              ▲
              │ Port (interface)
              │
┌─────────────┴───────────────────────────────┐
│      Infrastructure (apps/)                  │
│                                              │
│  api/db (Drizzle ORM 어댑터)                 │
│  api/auth (JWT 어댑터)                       │
│  api/webhooks (HMAC 어댑터)                  │
│  batch/ (Python subprocess 어댑터)           │
│                                              │
└─────────────────────────────────────────────┘
```

### 4.1 의존 역전 예시

- **Domain (parser)**: `interface PdfReader { extract(path: string): Promise<ExtractedPage[]> }`
- **Infrastructure (apps/batch)**: `class PythonPdfReader implements PdfReader { ... }` — pdfplumber subprocess 호출
- 도메인은 PDF 추출 메커니즘 모름. 다른 PDF 라이브러리 (예: pdfjs, mupdf) 로 교체 가능.

### 4.2 위반 시그널 (4-Pass Pass 2 검사)

- `packages/parser` 안에서 `apps/api/db` import → **위반**
- `packages/formula-engine` 안에서 `fs` / `path` import → **위반** (Workers 호환 깨짐)
- `packages/shared` 안에서 다른 패키지 import → **위반** (zero-dep)

---

## 5. Cloudflare Workers 제약과 정합

엔진은 Workers 런타임에서 동작 가능해야 함. 다음 제약 인지:

| 제약                         | 영향                                         | 정합                                             |
| :--------------------------- | :------------------------------------------- | :----------------------------------------------- |
| Node.js fs / path 미사용     | parser 의 일부 기능 build pipeline 으로 분리 | `apps/batch` 로 PDF 추출 격리                    |
| CPU 50ms (free) / 30s (paid) | LLM 호출 + 산식 계산                         | 단일 요청 내 최소 호출 수 + 산식은 AST 직접 평가 |
| 번들 크기 1MB                | tree-shaking 의무                            | `import { x } from 'lib'` (전체 import 금지)     |
| Web Crypto 만                | bcrypt 등 X                                  | `crypto.subtle.digest` 사용                      |
| Durable Objects 트랜잭션     | D1 명시 BEGIN/COMMIT 거부                    | `INSERT OR IGNORE` + 자동 wrap                   |

**다른 프로젝트가 Workers 외 환경에 도입할 때**: 위 제약 일부 완화 가능 (예: Node.js 서버 → fs 사용 자유). 다만 엔진의 portable 보장은 Workers 호환 영역까지.

---

## 6. 모노레포 빌드 시스템

```
turbo.json — Turborepo 캐시 + 의존성 해석
pnpm-workspace.yaml — 워크스페이스 정의

명령어:
  pnpm install         # 모든 패키지 install
  pnpm -F @thepick/parser test    # 단일 패키지 테스트
  pnpm -F apps/api dev            # apps/api dev 서버
  pnpm tsx scripts/verify-engine-contracts.ts  # 엔진 검증
  pnpm build           # 모든 패키지 build (turbo 캐시)
```

다른 프로젝트 도입 시 turbo.json + pnpm-workspace.yaml 의 ThePick 영역만 정합화하고 도메인 영역 추가.

---

## 7. 병렬 처리 / 큐 / 스케줄

### 7.1 BATCH 처리 (Build pipeline)

- `apps/batch` 내부에서 PipelineStage 10개 (extract → normalize → validate → ai-enrich → schema-check → graph-check → dry-run → sql-gen → load → verify)
- `batch_runs` 테이블 (migrations/0015) 으로 state machine: `in_progress` / `completed` / `failed` / `recovered` / `killed`
- 24h stale lock 감지 → resume 허용

### 7.2 Cron Triggers (Workers)

`apps/api/src/scheduled/` — Cloudflare Cron Triggers:

- 일일 FSRS 큐 갱신
- 검수 알림 (draft 노드 7일 초과 시)
- 8 게이지 텔레메트리 집계

### 7.3 Vectorize 임베딩

- 노드 적재 후 비동기 큐로 임베딩 생성
- Vectorize 메타데이터 `exam_id` 의무 (Hard Rule 16 정합)
- 유사도 < 0.6 시 Graceful Degradation (`SIMILARITY_THRESHOLD` 상수)

---

## 8. 확장 포인트 (다른 프로젝트가 변경 가능한 영역)

| 영역                            | 변경 가능성 | 비고                                    |
| :------------------------------ | :---------: | :-------------------------------------- |
| ExamAdapter 작성                |   ⭐⭐⭐    | 도메인 특화 진입점                      |
| ontology-registry.json          |   ⭐⭐⭐    | ID 목록 + 패턴                          |
| Constants Provider              |   ⭐⭐⭐    | InMemory / D1 / Postgres 자유           |
| Vision Trigger 정책             |    ⭐⭐     | minImageArea / ocrThreshold             |
| AI Adapter (Claude → 다른 LLM)  |    ⭐⭐     | Anthropic SDK 외 가능 (인터페이스 호환) |
| PDF Reader (pdfplumber → mupdf) |     ⭐      | 가능하나 표 cell merge 정확도 차이      |
| D1 (SQLite) → Postgres          |     ⭐      | 가능하나 트리거 SQL 재작성 필요         |
| 7 NodeType / 13 EdgeType        |     ❌      | Hard Lock (도메인 의미만 재해석)        |
| 4 핵심 테이블 스키마            |     ❌      | Hard Lock (컬럼 추가 OK)                |
| Hard Limit 8 항목               |     ❌      | 절대 위반 금지                          |

---

## 9. 본 문서 외 참조

- `docs/architecture/ARCHITECTURE.md` — ThePick 의 Mermaid 다이어그램 (시스템 조감도, 데이터 흐름)
- `docs/adr/` — 아키텍처 결정 기록 (ADR-007 멀티시험 / ADR-021 constants / ADR-023 Engine-First / ADR-030 page meta)
- `docs/plans/engine-hardening/` — 엔진 강화 plan (recover-snapshot 등)

본 architecture.md 는 외부 도입자 관점 요약. 깊이 있는 ThePick 내부는 위 경로 참조.
