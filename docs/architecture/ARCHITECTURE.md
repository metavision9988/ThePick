# 쪽집게(ThePick) — 아키텍처 다이어그램 (Mermaid DaC)

> **Diagram as Code** — 구현이 변경되면 다이어그램도 함께 수정한다.
>
> 이 파일은 6종의 아키텍처 다이어그램을 Mermaid.js로 관리한다.
>
> 최종 수정: 2026-04-12

---

## 1. 시스템 조감도

사용자(PWA) → Edge API(Workers) → 데이터 계층(D1/Vectorize)의 전체 흐름.
PWA는 오프라인 시 IndexedDB에서 직접 FSRS를 실행하므로 Workers를 거치지 않는 경로가 존재한다.

```mermaid
graph TB
    subgraph PWA["학습자 PWA (Astro + React Islands)"]
        UI_Exam["기출 풀이"]
        UI_Review["복습/약점"]
        UI_Mock["모의시험"]
        UI_Tutor["AI 튜터"]
        UI_Dash["대시보드"]

        subgraph ClientStore["클라이언트 상태"]
            Zustand["Zustand (세션)"]
            IDB["IndexedDB / Dexie.js (~4MB)"]
            FSRS_Client["FSRS 로컬 실행"]
            i18n["i18n (ko.json)"]
        end

        SW["Service Worker"]
        SyncEngine["Background Sync 엔진"]
    end

    subgraph AdminApp["관리자 CMS (admin-web)"]
        GraphViz["D3.js Graph Visualizer"]
        ContentQueue["콘텐츠 검수 큐"]
        ConstReview["Constants 검수"]
    end

    subgraph Workers["Cloudflare Workers + Hono (Edge API)"]
        Router["Hono 라우터"]
        AuthMW["인증 미들웨어"]
        ErrorMW["에러 핸들러 (AppError → ErrorResponse)"]

        subgraph Modules["modules/ (Hexagonal)"]
            subgraph Content["content 도메인"]
                Content_Domain["domain: TruthWeight, NodeId"]
                Content_App["application: search-graph, calculate-formula"]
                Content_Infra["infrastructure: D1 Repo, Vectorize, Claude"]
            end
            subgraph Learning["learning 도메인"]
                Learning_Domain["domain: FSRSParams, ConfusionType"]
                Learning_App["application: schedule-review, match-mnemonic"]
                Learning_Infra["infrastructure: D1 Progress Repo"]
            end
            subgraph Exam["exam 도메인"]
                Exam_Domain["domain: Score, PassCriteria"]
                Exam_App["application: take-exam, run-mock"]
                Exam_Infra["infrastructure: D1 Exam Repo"]
            end
        end
    end

    subgraph DataLayer["데이터 계층"]
        subgraph D1["Cloudflare D1 (9 tables)"]
            Precise["정밀: constants"]
            Struct["구조: nodes + edges + formulas"]
            Meta["메타: exam_questions, user_progress"]
        end
        Vectorize["Cloudflare Vectorize (임베딩)"]
    end

    subgraph Pipeline["빌드 파이프라인 (로컬/CI)"]
        PDF["pdfplumber"]
        Splitter["섹션 분리기"]
        Claude["Claude API 배치"]
        Validator["Ontology + 스키마 검증"]
        Loader["DB 적재 (draft)"]
    end

    %% 온라인 흐름
    UI_Exam & UI_Review & UI_Mock & UI_Tutor & UI_Dash --> Router
    Router --> AuthMW --> ErrorMW
    ErrorMW --> Content_App & Learning_App & Exam_App
    Content_Infra --> D1 & Vectorize
    Learning_Infra --> D1
    Exam_Infra --> D1

    %% 오프라인 흐름 (Workers 미경유, IndexedDB는 클라이언트 로컬 DB)
    UI_Review -.->|"오프라인"| IDB
    IDB -.-> FSRS_Client
    FSRS_Client -.->|"온라인 복귀"| SyncEngine
    SyncEngine -->|"배치 동기화"| Router

    %% 관리자
    AdminApp --> Router

    %% 파이프라인 (로컬/CI에서 실행, Workers 외부)
    PDF --> Splitter --> Claude --> Validator --> Loader --> D1

    %% formula-engine: 빌드 시 packages/에서 개발하지만
    %% 런타임에는 modules/content/application/calculate-formula.ts가 호출
    %% (Workers 번들에 포함)
```

---

## 2. 3계층 데이터 흐름

질의가 들어왔을 때 3계층(정밀→구조→맥락)을 어떤 순서로 검색하고, 방어 장치가 어디서 개입하는지.

```mermaid
flowchart LR
    Query["사용자 질의"] --> Analyze["질의 분석\n(LV1/LV2/LV3 추출)"]

    Analyze --> MetaFilter["D1 메타데이터 필터\nWHERE lv1=? AND lv2=?"]

    MetaFilter --> VecSearch["Vectorize 유사도 검색"]

    VecSearch --> SimCheck{"유사도 >= 0.60?"}

    SimCheck -->|"No"| Degrade["Graceful Degradation\n'교재 O장 O절 참고'\nAppError(LOW_SIMILARITY)"]

    SimCheck -->|"Yes"| TWSort["Truth Weight 정렬\nLAW(10) > FORMULA(8)\n> INVESTIGATION(7)\n> CONCEPT(5) > TERM(3)"]

    TWSort --> FormulaCheck{"산식 계산 필요?"}

    FormulaCheck -->|"Yes"| ConstQuery["Constants 직접 조회\n(LLM 추론 금지)"]
    ConstQuery --> FormulaEngine["Formula Engine\n(math.js AST)"]
    FormulaEngine --> Result

    FormulaCheck -->|"No"| ContextBuild["컨텍스트 조합"]
    ContextBuild --> ClaudeGen["Claude API\ncontext 주입 해설 생성"]
    ClaudeGen --> Result["결과 반환\nSuccessResponse"]

    Degrade --> ErrorResult["ErrorResponse\n+ 교재 참조 안내"]

    style Degrade fill:#fee,stroke:#c33
    style ConstQuery fill:#efe,stroke:#3a3
    style FormulaEngine fill:#efe,stroke:#3a3
```

---

## 3. 모듈 의존관계 그래프

packages/(빌드 파이프라인)와 modules/(런타임 도메인)의 의존 방향.
packages/는 순차 파이프라인, modules/는 Hexagonal 규칙(domain ← application → infrastructure).

```mermaid
graph TD
    subgraph BuildPipeline["packages/ (빌드 파이프라인, 순차)"]
        P_Parser["parser\nM01,M06~M10"]
        P_Parser1st["parser-1st-exam\nM03,M04,M05,M11"]
        P_Quality["quality\nM12~M14"]
        P_Formula["formula-engine\nM16 (L3)"]
        P_StudyGen["study-material-generator\nM20~M24"]
        P_Shared["shared\nAppError, ErrorCode, types"]
    end

    subgraph RuntimeDomain["modules/ (런타임, Hexagonal)"]
        M_Content["content\nsearch-graph\ncalculate-formula\ndetect-confusion"]
        M_Learning["learning\nschedule-review\nmatch-mnemonic\nsync-progress"]
        M_Exam["exam\ntake-exam\nrun-mock\ngenerate-variation"]
    end

    subgraph Apps["apps/ (진입점)"]
        A_Web["web (PWA)"]
        A_Admin["admin-web"]
        A_API["api (Workers)"]
        A_Batch["batch"]
    end

    subgraph Data["데이터 계층"]
        D1["D1 (9 tables)"]
        Vec["Vectorize"]
    end

    %% 빌드 파이프라인 의존 (순차, 단방향)
    P_Parser --> P_Quality
    P_Parser1st --> P_Quality
    P_Quality -->|"approved 데이터"| D1
    P_Formula --> D1
    P_StudyGen --> D1
    P_Shared -.->|"공유 타입"| P_Parser & P_Parser1st & P_Formula & P_Quality & P_StudyGen

    %% 런타임 의존
    A_API -->|"routes → application"| M_Content & M_Learning & M_Exam
    M_Content -->|"infrastructure"| D1 & Vec
    M_Learning -->|"infrastructure"| D1
    M_Exam -->|"infrastructure"| D1

    %% 앱 → 런타임
    A_Web -->|"API 호출"| A_API
    A_Admin --> A_API
    A_Batch -->|"파이프라인 실행"| P_Parser & P_Parser1st & P_StudyGen

    %% 오프라인: PWA는 IndexedDB(클라이언트 로컬)를 직접 사용
    %% IndexedDB ≠ D1. D1은 서버 사이드, IndexedDB는 브라우저 로컬
    IDB_Local["IndexedDB\n(클라이언트 로컬)"]
    A_Web -.->|"오프라인 직접 접근"| IDB_Local

    %% 금지 방향: quality에서 parser를 역참조하면 안 됨
    P_Quality -.->|"❌ 역방향 참조 금지"| P_Parser

    classDef l3 fill:#fdd,stroke:#c33,stroke-width:2px
    class P_Formula l3
```

---

## 4. 배치 파이프라인 흐름

교재 PDF → 구조화 데이터 → 품질 검증 → 인간 검수 → 학습자료 생성의 8단계.
BATCH N 검증 없이 BATCH N+1 진행 금지 (Hard Rule #6).

```mermaid
flowchart TD
    subgraph BatchGate["배치 순서 게이트 (Hard Rule #6)"]
        direction LR
        B1["BATCH 1\np.403~434\n적과전 종합위험"]
        B2["BATCH 2\np.435~500\n수확감소 16종"]
        B3["BATCH 3\np.501~521\n논작물"]
        B4["BATCH 4\np.522~576\n밭작물"]
        B5["BATCH 5\np.577~647\n시설+수입감소"]
        B6["BATCH 6\np.648~757\n가축재해"]
        B7["BATCH 7\np.1~388\n이론/약관"]
        B8["BATCH 8\np.758~835\n부록"]

        B1 -->|"QG-2 통과"| B2
        B2 -->|"검증 완료"| B3
        B3 -->|"검증 완료"| B4
        B4 -->|"검증 완료"| B5
        B5 -->|"검증 완료"| B6
        B6 -->|"검증 완료"| B7
        B7 -->|"검증 완료"| B8
    end

    subgraph EachBatch["각 BATCH마다 Stage 1~8 반복"]
        PDF["Stage 1\nPDF → pdfplumber"] --> Split["Stage 2\n섹션 분리\n정규식 + 구조 인식"]

        Split --> Claude["Stage 3\nClaude API 배치\nKnowledge Contract JSON"]

        Claude --> Validate["Stage 4\nOntology Lock +\n스키마 검증 (L3)"]

        Validate -->|"미등록 ID"| Reject["거부 + 재프롬프트"]
        Reject --> Claude

        Validate -->|"통과"| Insert["Stage 5\nD1 INSERT\nstatus = 'draft'"]

        Insert --> Integrity["M14\nGraph 무결성 검증\n고아노드 0, 순환 0"]

        Integrity -->|"실패"| Fix["수정 후 재검증"]
        Fix --> Insert

        Integrity -->|"통과"| Visualize["Stage 6\nGraph Visualizer\n인간 검수"]

        Visualize -->|"draft → review → approved"| Embed["Stage 7\napproved 노드만\nVectorize 임베딩"]

        Embed --> Generate["Stage 8\n학습자료 자동 생성\nM20~M24"]
    end

    BatchGate -->|"현재 BATCH 선택"| EachBatch
    Generate -->|"검증 통과 → 다음 BATCH"| BatchGate

    style Reject fill:#fee,stroke:#c33
    style Fix fill:#fee,stroke:#c33
    style B1 fill:#dfd,stroke:#3a3,stroke-width:2px
```

---

## 5. PWA 오프라인 동기화 흐름

오프라인 학습 → offlineActions 큐 → 온라인 복귀 시 배치 동기화.
학습 데이터는 유실 방지를 위해 최근 타임스탬프 우선.

```mermaid
sequenceDiagram
    participant User as 수험생
    participant PWA as PWA (React)
    participant IDB as IndexedDB
    participant FSRS as FSRS 로컬
    participant SW as Service Worker
    participant API as Workers API
    participant D1 as D1

    Note over User,D1: 오프라인 학습

    User->>PWA: 카드 학습 (응답 제출)
    PWA->>FSRS: 다음 복습 스케줄 계산
    FSRS-->>PWA: { difficulty, stability, interval, next_review }
    PWA->>IDB: userProgress 업데이트
    PWA->>IDB: offlineActions 큐 추가
    PWA-->>User: UI 즉시 반영 (온/오프 구분 불가)

    Note over User,D1: 온라인 복귀

    SW->>IDB: offlineActions 큐 조회 (synced=false)
    IDB-->>SW: [action1, action2, ...]
    SW->>API: POST /api/progress/sync (배치 전송)
    API->>D1: 타임스탬프 비교 + UPSERT

    alt 충돌 발생
        API->>API: 최근 타임스탬프 우선 (학습 데이터 유실 방지)
    end

    API-->>SW: 동기화 완료 + 서버 최신 데이터
    SW->>IDB: synced=true 마킹
    SW->>IDB: 서버 최신 데이터 반영 (다른 기기 학습분)
    SW-->>PWA: 동기화 완료 알림
```

---

## 6. Hexagonal Architecture 의존 규칙

modules/ 내부의 3계층 의존 방향. domain은 외부 의존 0.

```mermaid
graph LR
    subgraph Hexagonal["modules/{도메인}/"]
        Domain["domain/\n순수 로직\nentities, value-objects\nservices\n\n외부 의존 0\n인터페이스만 정의"]

        Application["application/\n유스케이스\ndomain 호출\ninfrastructure\n인터페이스 사용"]

        Infrastructure["infrastructure/\n외부 시스템 어댑터\nD1 Repository\nVectorize Client\nClaude API Client"]
    end

    Application -->|"호출"| Domain
    Application -->|"인터페이스 사용"| Infrastructure
    Infrastructure -->|"구현"| Domain

    Domain -.->|"❌ 직접 참조 금지"| Infrastructure

    External["외부 시스템\nD1, Vectorize, Claude API"]
    Infrastructure --> External

    Routes["apps/api/src/routes/"]
    Routes -->|"유스케이스 호출"| Application

    style Domain fill:#dfd,stroke:#3a3,stroke-width:2px
    style Infrastructure fill:#ddf,stroke:#33a
```

---

## 7. Graceful Degradation 정책 (계층별)

외부 의존성 장애 시 사용자 경험을 보존하는 계층별 폴백 전략.
Phase 1 Step 1-1 본격 구현 전 ADR-008에서 정량 기준 확정 예정.

```mermaid
graph TB
    Request["사용자 요청"]

    subgraph L1["L1 — Edge Cache (Workers Cache API)"]
        L1Check{"캐시 히트?"}
        L1Hit["캐시 반환\n(stale-while-revalidate)"]
        L1Check -->|Yes| L1Hit
    end

    subgraph L2["L2 — 주 데이터 경로"]
        D1Query["D1 Query"]
        VecQuery["Vectorize Query"]
        ClaudeAPI["Claude API"]
    end

    subgraph L3["L3 — 폴백 (Graceful Degradation)"]
        KVFallback["Workers KV 캐시\n(최근 24h 응답 스냅샷)"]
        PageRefOnly["'교재 O장 O절 참고'\n안내 (유사도 < 0.60)"]
        StaticError["정적 에러 페이지\n+ 재시도 안내"]
    end

    Request --> L1Check
    L1Check -->|No| D1Query
    L1Check -->|No| VecQuery
    L1Check -->|No| ClaudeAPI

    D1Query -.->|"5xx or timeout"| KVFallback
    VecQuery -.->|"유사도 < 0.60"| PageRefOnly
    ClaudeAPI -.->|"rate-limit or 5xx"| KVFallback
    KVFallback -.->|"캐시 miss"| StaticError

    style L3 fill:#fff2e5,stroke:#f90
    style StaticError fill:#fee,stroke:#c00
```

**원칙:**

1. **L1 Edge Cache 먼저** — stale-while-revalidate로 지연 최소화
2. **L2 실패 시 L3로 단계적 저하** — 정적 5xx 페이지는 최후 수단
3. **조용한 실패 금지** — 모든 폴백 경로에 `logger.warn(DEGRADED_RESPONSE, { reason })` 기록
4. **사용자 안내 표준화** — 에러가 아닌 "교재 O장 O절 참고" 형태 (재정립서 Graceful Degradation 원칙)
5. **정량 기준은 ADR-008** — 재시도 횟수, 캐시 TTL, 폴백 판단 기준 등

> ### ⚠️ KV 폴백 적용 범위 (Hard Limit)
>
> L3 Workers KV 캐시 폴백은 **read-only 공용 데이터만** 대상으로 한다.
> 사용자별 데이터 및 Write-path는 KV 폴백을 엄격히 금지.
>
> **KV 폴백 허용 (read-only 공용):**
>
> - `knowledge_nodes`, `knowledge_edges`
> - `formulas`, `constants`
> - `exam_questions`, `mnemonic_cards`
> - `topic_clusters`
>
> **KV 폴백 금지 (사용자별 / Write-path):**
>
> - `users`, `user_progress` — 사용자별 PII. stale 캐시가 로그아웃 후
>   Bob 로그인 시 Alice 응답 반환 위험 (Broken Access Control, OWASP A01)
> - `payment_events` / 구독 상태 — stale "구독 활성" 캐시 반환 시 결제 우회 경로
> - Webhook 수신 (`/webhooks/payment` 등) — write-path. D1 5xx 시
>   **503 Service Unavailable + Retry-After 헤더**로 PG 측 재시도 위임.
>   Idempotency 키는 D1 단일 소스에만 보관 (KV 병행 저장 금지)
> - 결제/진도 쓰기 요청 — 동일 원칙 (503 + Retry-After)
>
> **이유:** 사용자별 데이터의 stale 캐시 반환은 인증/결제 경계 침범.
> CLAUDE.md CRITICAL RULE #3 ("try-catch에서 데이터 조용히 삭제 금지")과
> 정답 안전 Hard Stop 원칙의 연장.

**현재 구현 범위 (Year 1):**

- ✅ Vectorize 유사도 < 0.60 거부 → "교재 O장 O절 참고" (ADR-004)
- ⏳ D1 5xx 폴백 (ADR-008 수립 후 Phase 1 Step 1-1 이후) — **read-only 공용 데이터 한정**
- ⏳ Write-path 503 + Retry-After 정책 (Phase 1 Step 1-2 webhook 구현 시)
- ⏳ Claude API rate-limit 폴백 (Phase 2 batch 파이프라인 강화 시)

---

## 다이어그램 관리 규칙

1. **구현 변경 시 다이어그램도 함께 수정** — 코드 PR에 다이어그램 변경이 포함되어야 함
2. **네이밍 일치** — 다이어그램의 모듈명/파일명은 실제 코드와 100% 일치
3. **4-Pass 리뷰 Pass 2(Architect)에서 다이어그램 정합성 확인**
4. **새 다이어그램 추가 시** 이 파일에 섹션 추가 (별도 파일 생성 금지)
