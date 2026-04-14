# 📋 쪽집게 Graph RAG 데이터 파이프라인 — 통합 기획·설계서

> **DEV COVEN 합동 산출물 v1.1** (방어 패치 3건 + 스키마 패치 2건 반영)
> 대화 세션에서 도출된 모든 분석·설계 결과를 Claude Code 실행 가능한 형태로 통합
>
> 작성일: 2026-04-07
> v1.1 패치: Ontology Lock, AST 파서, Hairball 방지, expected_inputs, unit 필드
> 기반 교재: 「2026년 농업재해보험 손해평가의 이론과 실무」 (835쪽, 2025.12.31 기준)

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [기존 설계 대비 GAP 분석 결과](#2-gap-분석-결과)
3. [교재 구조 분석 결과](#3-교재-구조-분석-결과)
4. [Graph RAG 아키텍처 최종 설계](#4-graph-rag-아키텍처-최종-설계)
5. [DB 스키마 통합 명세](#5-db-스키마-통합-명세)
6. [매직 넘버 레지스트리 설계](#6-매직-넘버-레지스트리)
7. [개정 이력 추적 시스템](#7-개정-이력-추적-시스템)
8. [자동 추출 파이프라인 설계](#8-자동-추출-파이프라인)
9. [학습자료 자동 생성 설계](#9-학습자료-자동-생성)
10. [3단계 워크플로우](#10-3단계-워크플로우)
11. [Claude Code 태스크 브레이크다운](#11-claude-code-태스크-브레이크다운)
12. [기존 프로젝트 파일 연동 가이드](#12-프로젝트-파일-연동)

---

## 1. Executive Summary

### 프로젝트 배경

쪽집게 서비스의 핵심 데이터 소스인 손해평가사 교재(835쪽)를 AI가 정확하게 활용할 수 있는
구조화된 지식 체계(Graph RAG)로 변환하는 것이 이 설계서의 목적이다.

### 핵심 발견 사항 (이 대화에서 도출)

| #   | 발견                                                                | 영향                                    |
| --- | ------------------------------------------------------------------- | --------------------------------------- |
| 1   | 교재는 5대 보장방식 × 70+ 품목 × 16종 조사 × 80+ 산식의 조건부 트리 | 단순 벡터 검색 불가, Graph RAG 필수     |
| 2   | 정밀 수치(계수, 임계값, 날짜) 70개+ 존재, LLM 추론 불가             | constants 테이블 별도 하드코딩          |
| 3   | 같은 이름의 조사/산식이 작물마다 미묘하게 다름                      | 작물별 교차 매트릭스 + 차이점 엣지 필요 |
| 4   | 교재는 매년 개정, 과거 정답이 현재 오답                             | Temporal Graph + 개정이력 추적          |
| 5   | 교재 텍스트와 법령 원문 충돌 가능                                   | Truth Weight 우선순위 체계              |
| 6   | 500+ 노드를 JSON으로 검수 불가능                                    | Graph Visualizer 선행 개발 필수         |
| 7   | Graph RAG 중간 산출물 = 학습자료 원재료                             | 자동 변환 파이프라인으로 일석이조       |
| 8   | 개정 사항은 시험 출제 확률 최고                                     | exam_priority 가중치 시스템             |

### 아키텍처 요약

```
┌─────────────────────────────────────────────────────────────────────┐
│  3계층 데이터 아키텍처                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [정밀 계층] D1: constants 테이블                                    │
│  수치/날짜/임계값 → 룰 엔진이 DB에서 직접 조회, LLM 추론 금지       │
│                                                                     │
│  [구조 계층] D1: knowledge_nodes + edges + formulas                  │
│  개념관계/조건분기/절차흐름 → 메타데이터 필터 후 검색                │
│                                                                     │
│  [맥락 계층] Vectorize: 임베딩                                       │
│  해설/부연설명/사례 → 벡터 유사도 검색                               │
│                                                                     │
│  ──────── 방어 장치 ────────                                        │
│  · Truth Weight: LAW(10) > FORMULA(8) > CONCEPT(5)                  │
│  · Temporal Graph: UPDATE 금지, 버전별 신규 노드 + SUPERSEDES 엣지  │
│  · Graceful Degradation: 유사도 < 0.60 → 해설 거부 + 교재 안내     │
│  · Constants 직접 조회: LLM에게 숫자 추론 절대 금지                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. GAP 분석 결과

기존 프로젝트 파일과 이 대화에서 도출된 요구사항 간의 차이.

### 🔴 Critical GAP (기존에 전혀 없던 것)

| ID    | GAP                               | 반영 위치                     |
| ----- | --------------------------------- | ----------------------------- |
| GAP-1 | Graph RAG 노드/엣지 아키텍처      | SYSTEM_ARCHITECTURE 추가      |
| GAP-2 | 산식 연산 격리 (Formula Engine)   | 신규 모듈                     |
| GAP-3 | 4-Level 계층적 메타데이터 태깅    | data_collection_pipeline 추가 |
| GAP-4 | 매직 넘버 레지스트리 (constants)  | 신규 테이블                   |
| GAP-5 | 개정 이력 추적 (revision_changes) | 신규 테이블                   |

### 🟠 High GAP (존재하나 부족한 것)

| ID    | GAP                              | 반영 위치             |
| ----- | -------------------------------- | --------------------- |
| GAP-6 | Graceful Degradation 임계값 미정 | AI 응답 파이프라인    |
| GAP-7 | 기출문제 시간축 충돌 관리        | exam_questions 스키마 |
| GAP-8 | Knowledge Contract 포맷 미정의   | 파이프라인 출력 스펙  |
| GAP-9 | Graph Visualizer 부재            | Phase 0 태스크 추가   |

---

## 3. 교재 구조 분석 결과

### 3.1 물리적 구조

```
1권: 이론과 실무 (p.1~388)
├── 제1장 보험의 이해 (p.1~54)
├── 제2장 농업재해보험 특성과 필요성 (p.55~78)
├── 제3장 농작물재해보험 제도 (p.79~330) — 상품/약관
└── 제4장 가축재해보험 제도 (p.331~388)

2권: 손해평가 이론과 실무 (p.390~757) ★ 2차 시험 핵심
├── 제1장 손해평가 개관 (p.390~400)
├── 제2장 농작물재해보험 손해평가 (p.401~647) ★★★
│   ├── 제2절 과수작물 (p.403~500)
│   │   ├── 1. 적과전 종합위험 — 사과,배,단감,떫은감 (p.403~434)
│   │   ├── 2. 종합위험 수확감소 — 16종 (p.435~470)
│   │   ├── 3. 종합위험 과실손해 — 감귤,오디,두릅,블루베리 (p.475~500)
│   │   └── 4. 수확전 종합위험 — 복분자,무화과 (p.493~500)
│   ├── 제3절 논작물 (p.501~521) — 벼,밀,보리,귀리
│   ├── 제4절 밭작물 (p.522~576) — 콩,감자,양파,마늘,고추 등
│   ├── 제5절 시설작물 (p.577~600) — 원예시설,버섯
│   └── 제6절 농업수입감소보장 (p.601~647)
├── 제3장 가축재해보험 손해평가 (p.648~757)
└── 부록 (p.758~835) — 용어사전, 법령원문

요약표 (p.729~760) — 보장방식별 산식 통합 + 개정이력 체인
```

### 3.2 시험 출제 가중치

| 영역                      | 페이지 | 출제 비중 | 구조화 우선순위 |
| ------------------------- | ------ | --------- | --------------- |
| 2권 제2장 농작물 손해평가 | 247쪽  | 55~65%    | P0 (BATCH 1~5)  |
| 2권 제3장 가축 손해평가   | 110쪽  | 15~20%    | P1 (BATCH 6)    |
| 1권 제3장 상품내용(약관)  | 168쪽  | 10~15%    | P1 (BATCH 7)    |
| 2권 제1장 + 1권 제1~2장   | 89쪽   | 5~10%     | P2              |
| 부록 (용어/법령)          | 78쪽   | 참조      | 전 단계 공통    |

### 3.3 배치 분리 계획

| Batch    | 범위                                  | 페이지    | 우선순위 | 예상 노드 | 예상 산식 |
| -------- | ------------------------------------- | --------- | -------- | --------- | --------- |
| BATCH 1  | 적과전 종합위험 (사과/배/단감/떫은감) | p.403~434 | P0-PoC   | ~60       | ~15       |
| BATCH 2  | 종합위험 수확감소 (16종)              | p.435~500 | P1-A     | ~80       | ~20       |
| BATCH 3  | 논작물 (벼/밀/보리/귀리)              | p.501~521 | P1-B     | ~40       | ~10       |
| BATCH 4  | 밭작물 (수확감소+생산비)              | p.522~576 | P1-C     | ~100      | ~25       |
| BATCH 5  | 시설작물 + 수입감소보장               | p.577~647 | P1-D     | ~80       | ~20       |
| BATCH 6  | 가축재해보험                          | p.648~757 | P2       | ~60       | ~10       |
| BATCH 7  | 1권 전체 (이론/약관)                  | p.1~388   | P2       | ~80       | ~5        |
| BATCH 8  | 부록 (용어/법령)                      | p.758~835 | 전 단계  | ~120      | 0         |
| **합계** |                                       | **835쪽** |          | **~620**  | **~105**  |

---

## 4. Graph RAG 아키텍처 최종 설계

### 4.1 4-Level 메타데이터 스키마

```
LV1: 보장방식 (Insurance Type) — 8종
 └── LV2: 품목/작물군 (Crop Category) — 70+종
      └── LV3: 조사 종류 (Investigation Type) — 16종
           └── LV4: 구성 요소 (시기/방법/산식/조건/상수)
```

### 4.2 노드 유형 (7종)

| 타입          | 설명           | truth_weight | 예상 수량 |
| ------------- | -------------- | ------------ | --------- |
| LAW           | 법조문 원문    | 10           | ~50       |
| FORMULA       | 산식           | 8            | ~105      |
| INVESTIGATION | 조사 방법      | 7            | ~20       |
| INSURANCE     | 보장방식       | 6            | ~8        |
| CROP          | 품목           | 6            | ~70       |
| CONCEPT       | 교재 설명/개념 | 5            | ~150      |
| TERM          | 용어 정의      | 3            | ~120      |

### 4.3 엣지 유형 (11종)

| 타입                       | 의미              | 예시                             |
| -------------------------- | ----------------- | -------------------------------- |
| APPLIES_TO                 | 보장방식 → 품목   | INS-01 → 사과                    |
| REQUIRES_INVESTIGATION     | 보장방식 → 조사   | INS-01 → 착과수조사              |
| PREREQUISITE               | 조사 간 선후관계  | 착과수조사 → 낙과피해조사        |
| USES_FORMULA               | 조사 → 산식       | 착과피해조사 → 감수과실수        |
| DEPENDS_ON                 | 산식 → 변수/상수  | 보험금 = f(감수량, 자기부담비율) |
| GOVERNED_BY                | 절차 → 법조문     | 손해평가반 → 손해평가요령 제8조  |
| DEFINED_AS                 | 용어 → 정의       | 실제결과주수 → 정의              |
| EXCEPTION                  | 일반규칙 → 예외   | 경작불능65% → 분질미60%          |
| TIME_CONSTRAINT            | 시간 조건         | 낙엽률조사 → 6.1~10월            |
| SUPERSEDES                 | 신버전 → 구버전   | 2026노드 → 2025노드              |
| SHARED_WITH / DIFFERS_FROM | 작물 간 공유/차이 | 사과착과수조사 ↔ 포도착과수조사  |

### 4.4 조건부 라우팅 패턴

교재 전체를 관통하는 5단계 흐름 (모든 보장방식 공통):

```
[사고접수] → [피해사실확인] → [조사방법 선택] → [현지조사] → [보험금 산정]
     ↑              ↑                ↑                ↑              ↑
   재해종류      보장재해확인      조건부 트리       산식 적용      룰 엔진
```

재해종류/품목/보장방식에 따라 각 단계의 변수가 달라진다.
이것이 Graph의 엣지 조건(condition)으로 표현된다.

### 4.5 작물별 교차 관계 3대 패턴

| 패턴                           | 설명                                                               | 시스템 대응                                |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------ |
| 공통 골격 + 작물별 변주        | 피해사실확인, 경작불능(65%) 등은 전 작물 공통이나 시기/기준이 다름 | SHARED_WITH + DIFFERS_FROM 엣지            |
| 한 작물이 다수 보장방식에 등장 | 사과가 적과전/수확감소/수입감소 3개 방식에 동시 등장               | 품목 노드에서 다수 보장방식으로 APPLIES_TO |
| 완전히 고유한 산식             | 감귤(등급내/외), 벼(수량요소점수), 인삼(연근별), 고추(α=54.2%)     | 독립 FORMULA 노드                          |

---

## 5. DB 스키마 통합 명세

### 5.1 knowledge_nodes

```sql
CREATE TABLE knowledge_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- LAW|FORMULA|INVESTIGATION|INSURANCE|CROP|CONCEPT|TERM
  name TEXT NOT NULL,
  description TEXT,
  lv1_insurance TEXT,              -- 보장방식 ID (INS-01 등)
  lv2_crop TEXT,                   -- 품목 ID (CROP-APPLE 등)
  lv3_investigation TEXT,          -- 조사종류 ID (INV-01 등)
  page_ref TEXT,                   -- 교재 페이지
  batch_id TEXT,                   -- 파싱 배치 ID (BATCH-1 등)
  version_year INTEGER NOT NULL,   -- 교재 기준연도 (2026)
  superseded_by TEXT,              -- 개정 시 새 노드 ID
  truth_weight INTEGER NOT NULL DEFAULT 5,
  status TEXT DEFAULT 'draft',     -- draft|review|approved|published
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 인덱스
CREATE INDEX idx_nodes_type ON knowledge_nodes(type);
CREATE INDEX idx_nodes_lv1 ON knowledge_nodes(lv1_insurance);
CREATE INDEX idx_nodes_lv2 ON knowledge_nodes(lv2_crop);
CREATE INDEX idx_nodes_status ON knowledge_nodes(status);
CREATE INDEX idx_nodes_version ON knowledge_nodes(version_year);
```

### 5.2 knowledge_edges

```sql
CREATE TABLE knowledge_edges (
  id TEXT PRIMARY KEY,
  from_node TEXT NOT NULL REFERENCES knowledge_nodes(id),
  to_node TEXT NOT NULL REFERENCES knowledge_nodes(id),
  edge_type TEXT NOT NULL,         -- APPLIES_TO|PREREQUISITE|USES_FORMULA|SUPERSEDES|...
  condition TEXT,                   -- 조건 (예: "우박피해시만", "단감/떫은감만")
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,     -- 개정 시 구버전 엣지 비활성화
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_edges_from ON knowledge_edges(from_node);
CREATE INDEX idx_edges_to ON knowledge_edges(to_node);
CREATE INDEX idx_edges_type ON knowledge_edges(edge_type);
CREATE INDEX idx_edges_active ON knowledge_edges(is_active);
```

### 5.3 formulas (룰 엔진용)

```sql
CREATE TABLE formulas (
  id TEXT PRIMARY KEY,              -- F-01, F-02...
  name TEXT NOT NULL,
  equation_template TEXT NOT NULL,  -- "V1 / (V1 + V2)"
  equation_display TEXT,            -- LaTeX 또는 사람 읽기용
  variables_schema TEXT NOT NULL,   -- JSON: [{id,name,type,range,unit}]
  constraints TEXT,                 -- JSON: 선행 조건
  expected_inputs TEXT,              -- JSON: LLM이 지문에서 찾아야 할 변수명/타입 [{"name":"표본주수","type":"integer"}]
  graceful_degradation TEXT,        -- 실패 시 안내 메시지
  page_ref TEXT,
  node_id TEXT REFERENCES knowledge_nodes(id),
  version_year INTEGER NOT NULL,
  superseded_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 5.4 constants (매직 넘버 레지스트리)

```sql
CREATE TABLE constants (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,           -- threshold|coefficient|date|ratio|sample|deductible|insurance_rate
  name TEXT NOT NULL,
  value TEXT NOT NULL,              -- "65%", "1.0115", "7월 31일"
  numeric_value REAL,               -- 계산용 (0.65, 1.0115, NULL)
  applies_to TEXT NOT NULL,         -- JSON: ["벼","밀","보리"] 또는 ["전품목"]
  insurance_type TEXT,              -- 보장방식 ID
  confusion_risk TEXT,              -- 혼동 대상: "분질미는 60%"
  confusion_level TEXT DEFAULT 'normal', -- normal|warn|danger
  unit TEXT,                          -- "%", "원", "주", "kg", "일" (단위 혼동 방지)
  page_ref TEXT,
  version_year INTEGER NOT NULL,
  exam_frequency INTEGER DEFAULT 0, -- 기출 등장 횟수 (역공학 후 업데이트)
  related_formula TEXT,             -- 관련 산식 ID
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_const_category ON constants(category);
CREATE INDEX idx_const_version ON constants(version_year);
CREATE INDEX idx_const_confusion ON constants(confusion_level);
```

### 5.5 revision_changes (개정 이력 추적)

```sql
CREATE TABLE revision_changes (
  id TEXT PRIMARY KEY,
  version_year INTEGER NOT NULL,
  revision_date TEXT NOT NULL,      -- "2025.12.26"
  category TEXT NOT NULL,           -- rule|formula|date|threshold|method|scope|crop_added|crop_removed
  target_section TEXT,              -- "밭작물 수확감소보장"
  target_crops TEXT,                -- JSON: ["콩","양파"]
  change_type TEXT NOT NULL,        -- added|modified|deleted|clarified
  before_value TEXT,                -- 종전 내용
  after_value TEXT,                 -- 현행 내용
  exam_priority INTEGER DEFAULT 10, -- 출제 가능성 (added=10, modified=8, clarified=5)
  related_constants TEXT,           -- JSON: 영향받는 constants IDs
  related_nodes TEXT,               -- JSON: 영향받는 node IDs
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_rev_version ON revision_changes(version_year);
CREATE INDEX idx_rev_priority ON revision_changes(exam_priority DESC);
```

### 5.6 exam_questions (기출문제 — 시간축 관리)

```sql
CREATE TABLE exam_questions (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  round INTEGER,
  question_number INTEGER,
  subject TEXT,
  content TEXT NOT NULL,
  answer TEXT,
  explanation TEXT,
  valid_from TEXT,
  valid_until TEXT,
  superseded_by TEXT,
  related_nodes TEXT,               -- JSON: knowledge_node IDs
  related_constants TEXT,           -- JSON: constants IDs
  status TEXT DEFAULT 'active',     -- active|deprecated|flagged
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 6. 매직 넘버 레지스트리

### 6.1 분류 체계

교재에서 추출된 70+ 매직 넘버를 6개 카테고리로 분류:

| 카테고리       | 설명           | 예시                            | 수량 |
| -------------- | -------------- | ------------------------------- | ---- |
| threshold      | 임계값(%)      | 경작불능 65%, 일소 6%           | ~12  |
| coefficient    | 계수/산식상수  | 단감 1.0115, 고추 α=54.2%       | ~16  |
| date           | 기한/날짜      | 이앙한계일 7.31, 낙엽조사 6.1   | ~12  |
| insurance_rate | 보험금 비율    | 경작불능 45%/42%/40%/35%/30%    | ~15  |
| deductible     | 자기부담금     | 시설 30~100만, 피복재 10~30만   | ~8   |
| sample         | 수량/표본 기준 | 수량요소 4포기, 과중 30/40/60개 | ~10  |

### 6.2 혼동 위험 등급

| 등급   | 기준                                          | 예시                         | 학습자료 태그 |
| ------ | --------------------------------------------- | ---------------------------- | ------------- |
| danger | 작물별 수치가 다른데 이름이 같음, 소수점 계수 | 단감 1.0115 vs 떫은감 0.9662 | 🔴 암기필수   |
| warn   | 예외 조건이 있거나 혼동 가능                  | 경작불능 65% vs 분질미 60%   | 🟡 혼동주의   |
| normal | 단일 값, 혼동 위험 낮음                       | 나무손해 자기부담 5%         | (없음)        |

---

## 7. 개정 이력 추적 시스템

### 7.1 교재 개정 체인 감지

교재 p.730~760 요약표에 개정일자 체인이 명시됨:

- 밭작물 수확감소: `(2023.10.31)(2024.06.24)(2025.3.31)(2025.8.8)(2025.12.26)` — 5회 개정
- 과수 수입감소: `(2025.8.8)(2025.12.26)` — 2회 개정
- 논작물: `(2023.05.25)(2023.10.31)` — 안정적

### 7.2 시험 출제 가중치 로직

```
exam_priority 산정 규칙:
  - change_type = 'added' (신규 추가)     → 10 (거의 확실히 출제)
  - change_type = 'modified' (수치 변경)  → 8  (높은 확률)
  - change_type = 'clarified' (명확화)    → 5  (출제 가능)
  - change_type = 'deleted' (삭제)        → 3  (간접 출제)

  + 최근 개정일수록 가산: 2025.12.26 개정 → +2
  + 다빈도 개정 섹션 가산: 5회 개정 → +1
```

### 7.3 FSRS 연동

`exam_priority`가 높은 항목 → FSRS 초기 난이도(difficulty)를 높게 설정
→ 복습 간격이 짧아져 자연스럽게 반복 노출

---

## 8. 자동 추출 파이프라인

### 8.1 전체 흐름

```
[입력: PDF 835쪽]
    │
    ▼
[Stage 1: 텍스트 추출] — pdfplumber
    │  페이지별 raw text
    ▼
[Stage 2: 섹션 분리] — 정규식 + 구조 인식
    │  절/항/호/목 단위 분리
    │  표(Table) 별도 추출
    ▼
[Stage 3: 배치별 구조화] — Claude API 배치 호출
    │  Knowledge Contract YAML 초안 생성
    │  노드/엣지/산식/상수 자동 추출
    ▼
[Stage 4: 자동 검증] — 룰 기반 + Ontology Lock
    │  ontology-registry.json 기준 ID 검증
    │  미등록 ID 거부 → 재수행 강제
    │  필수 필드 누락 체크
    │  산식 변수 매핑 검증
    │  상수 범위 검증
    ▼
[Stage 5: DB 적재] — D1 INSERT (status='draft')
    │
    ▼
[Stage 6: 인간 검수] — Graph Visualizer UI
    │  status: draft → review → approved → published
    ▼
[Stage 7: Vectorize 임베딩] — approved 노드만
    │
    ▼
[Stage 8: 학습자료 자동 생성]
```

### 8.2 Claude API 배치 호출 프롬프트 설계

각 배치(BATCH 1~8)에 대해 아래 형태의 시스템 프롬프트를 사용:

```
당신은 손해평가사 교재를 구조화된 데이터로 변환하는 전문가입니다.

[Ontology Lock] 아래 사전 정의된 ID만 사용하세요. 목록에 없는 ID는 생성 금지.
- node_type: LAW|FORMULA|INVESTIGATION|INSURANCE|CROP|CONCEPT|TERM
- edge_type: APPLIES_TO|REQUIRES_INVESTIGATION|PREREQUISITE|USES_FORMULA|DEPENDS_ON|GOVERNED_BY|DEFINED_AS|EXCEPTION|TIME_CONSTRAINT|SUPERSEDES|SHARED_WITH|DIFFERS_FROM
- crop_id: (ontology-registry.json에서 주입, 예: CROP-APPLE, CROP-PEAR, ...)
- insurance_id: (ontology-registry.json에서 주입, 예: INS-01, INS-02, ...)

주어진 텍스트에서 다음을 추출하세요:

1. NODES: 각 개념/조사/산식을 노드로 분류
   - type: 위 허용 목록에서만 선택
   - lv1~lv3 메타데이터 태깅

2. EDGES: 노드 간 관계
   - edge_type: 위 허용 목록에서만 선택
   - condition 명시

3. FORMULAS: 모든 수식을 분리
   - equation_template (기계 연산용, AST 파서 호환 형식)
   - variables_schema (변수 목록 + 타입 + 범위)
   - expected_inputs (LLM이 지문에서 찾아야 할 변수명 + 데이터타입)

4. CONSTANTS: 모든 수치/날짜/임계값 발췌
   - category 분류
   - unit 명시 (%, 원, 주, kg 등)
   - confusion_level 판정

출력은 반드시 JSON으로, 아래 스키마를 따르세요:
{nodes: [...], edges: [...], formulas: [...], constants: [...]}
```

### 8.3 핵심 파서 컴포넌트 (Claude Code 구현 대상)

```typescript
// packages/parser/src/
├── pdf-extractor.ts        // pdfplumber 래퍼 (Python subprocess)
├── section-splitter.ts     // 정규식 기반 절/항/호/목 분리
├── table-extractor.ts      // 표 구조 인식 및 JSON 변환
├── batch-processor.ts      // Claude API 배치 호출 관리
├── ontology-registry.json  // 허용 ID 하드코딩 (Ontology Lock)
├── schema-validator.ts     // 출력 JSON 스키마 검증 + 미등록 ID 거부
├── db-loader.ts           // D1 INSERT (draft 상태)
├── constants-extractor.ts  // 매직 넘버 전용 추출기
├── revision-detector.ts    // 개정 이력 체인 감지
└── vectorize-loader.ts     // approved → Vectorize 임베딩

// packages/formula-engine/src/
├── ast-parser.ts           // math.js 경량 AST 파서 (eval() 금지)
├── variable-mapper.ts      // expected_inputs 기반 변수 매핑
├── constants-resolver.ts   // D1 constants 테이블 직접 조회
└── engine.ts              // 통합 연산 엔진
```

---

## 9. 학습자료 자동 생성

### 9.1 Graph RAG 산출물 → 학습자료 매핑

| Graph 산출물                           | 변환 대상        | 학습자료 형태                  |
| -------------------------------------- | ---------------- | ------------------------------ |
| INVESTIGATION 노드 + PREREQUISITE 엣지 | 조사 흐름도      | SVG 플로우차트 (시기별/클릭형) |
| FORMULA 노드 + variables_schema        | 산식 연습 카드   | 인터랙티브 슬라이더 계산기     |
| 엣지 condition 필드                    | 조건부 분기 트리 | 아코디언 카드 (재해종류별)     |
| CONSTANTS (confusion_level=danger)     | 암기 플래시카드  | FSRS 간격반복 카드             |
| SHARED_WITH + DIFFERS_FROM 엣지        | 작물간 비교표    | 교차 매트릭스                  |
| revision_changes (exam_priority≥8)     | 개정사항 알림    | 최우선 학습 배너               |

### 9.2 자동 생성 템플릿 엔진

```typescript
// packages/study-material-generator/src/
├── flowchart-generator.ts    // INVESTIGATION 노드 → SVG
├── formula-card-generator.ts // FORMULA → 인터랙티브 카드
├── condition-tree-generator.ts // 엣지 condition → 아코디언
├── flashcard-generator.ts    // CONSTANTS → FSRS 카드
├── comparison-matrix.ts      // SHARED/DIFFERS → 비교표
└── revision-banner.ts        // revision_changes → 알림
```

---

## 10. 3단계 워크플로우

```
┌─────────────────────────────────────────────────────────────────────┐
│  STAGE 1: 설계 (Claude Chat — 완료)                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                 │
│  ✅ 교재 구조 분석                                                   │
│  ✅ Graph RAG 4-Level 메타데이터 설계                                │
│  ✅ DB 스키마 설계 (6개 테이블)                                      │
│  ✅ 매직 넘버 레지스트리 (70+ 항목 발굴)                             │
│  ✅ 작물별 교차 관계 매트릭스                                        │
│  ✅ 개정 이력 추적 시스템 설계                                       │
│  ✅ 학습자료 자동 생성 프로토타입 3종                                │
│  ✅ 파이프라인 설계                                                  │
│  ✅ 이 통합 설계서 (본 문서)                                         │
├─────────────────────────────────────────────────────────────────────┤
│  STAGE 2: 자동화 도구 개발 (Claude Code)                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                            │
│  □ PDF 추출 파서 구현                                                │
│  □ Claude API 배치 프로세서 구현                                     │
│  □ DB 스키마 마이그레이션 (D1)                                       │
│  □ constants 자동 추출기 구현                                        │
│  □ 룰 엔진 (Formula Engine) 구현                                    │
│  □ Graph Visualizer (검수 도구) 구현                                 │
│  □ BATCH 1 PoC 실행 및 검증                                         │
│  □ BATCH 2~8 순차 실행                                               │
├─────────────────────────────────────────────────────────────────────┤
│  STAGE 3: 검수 + 학습자료 생성                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                   │
│  □ Graph Visualizer로 draft → approved 검수                          │
│  □ 기출문제 역공학 (삼각 교차 검증)                                  │
│  □ 학습자료 자동 생성 파이프라인 가동                                │
│  □ FSRS 간격반복 카드 생성                                           │
│  □ 개정사항 최우선 카드 배치                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 11. Claude Code 태스크 브레이크다운

기존 `MVP_ROADMAP_4LEVEL.md`의 Phase 체계에 통합.
Phase 0에 신규 Epic을 추가하고, Phase 1의 Epic 1.1을 확장.

### 🏔️ Epic 0.4: Graph RAG 데이터 파이프라인 PoC (신규)

> "관리자로서, 교재 PDF를 구조화된 지식 데이터로 변환할 수 있어야 한다"

#### 📖 Story 0.4.1: PDF 추출 파서

| Task ID      | Type      | Task                                     | 예상 시간 |
| ------------ | --------- | ---------------------------------------- | --------- |
| P0-E4-S1-T01 | 🔧 SETUP  | pdfplumber 설치 및 Python 환경 구성      | 15분      |
| P0-E4-S1-T02 | 🧪 TEST   | BATCH 1 (p.403~434) 텍스트 추출 테스트   | 15분      |
| P0-E4-S1-T03 | 🔨 IMPL   | section-splitter 구현 (절/항/호/목 분리) | 30분      |
| P0-E4-S1-T04 | 🔨 IMPL   | table-extractor 구현 (표 → JSON)         | 30분      |
| P0-E4-S1-T05 | 🧪 TEST   | BATCH 1 섹션 분리 정확도 검증            | 15분      |
| P0-E4-S1-T06 | 📊 VERIFY | 추출 결과 vs 원문 대조                   | 15분      |

**완료 기준:**

- [ ] BATCH 1 (32쪽) 텍스트 100% 추출
- [ ] 섹션 분리 정확도 95%+
- [ ] 표 3개 이상 JSON 변환 성공

#### 📖 Story 0.4.2: DB 스키마 구축

| Task ID      | Type    | Task                         | 예상 시간 |
| ------------ | ------- | ---------------------------- | --------- |
| P0-E4-S2-T01 | 🔨 IMPL | knowledge_nodes 테이블 생성  | 10분      |
| P0-E4-S2-T02 | 🔨 IMPL | knowledge_edges 테이블 생성  | 10분      |
| P0-E4-S2-T03 | 🔨 IMPL | formulas 테이블 생성         | 10분      |
| P0-E4-S2-T04 | 🔨 IMPL | constants 테이블 생성        | 10분      |
| P0-E4-S2-T05 | 🔨 IMPL | revision_changes 테이블 생성 | 10분      |
| P0-E4-S2-T06 | 🔨 IMPL | exam_questions 테이블 생성   | 10분      |
| P0-E4-S2-T07 | 🧪 TEST | 전체 스키마 CRUD 테스트      | 15분      |
| P0-E4-S2-T08 | 🔨 IMPL | 인덱스 생성                  | 10분      |

**완료 기준:**

- [ ] 6개 테이블 생성 완료
- [ ] CRUD 동작 확인
- [ ] 인덱스 적용 확인

#### 📖 Story 0.4.3: Claude API 배치 프로세서

| Task ID      | Type      | Task                                                          | 예상 시간 |
| ------------ | --------- | ------------------------------------------------------------- | --------- |
| P0-E4-S3-T01 | 🔧 SETUP  | Claude API 연동 (Haiku 배치)                                  | 15분      |
| P0-E4-S3-T02 | 🔨 IMPL   | ontology-registry.json 초안 작성 (품목ID/보장방식ID/엣지타입) | 20분      |
| P0-E4-S3-T03 | 🔨 IMPL   | 구조화 프롬프트 템플릿 작성 (Ontology Lock 포함)              | 30분      |
| P0-E4-S3-T04 | 🔨 IMPL   | batch-processor 구현 (섹션 → API → JSON)                      | 30분      |
| P0-E4-S3-T05 | 🔨 IMPL   | schema-validator 구현 (미등록 ID 거부 + 재수행 강제)          | 25분      |
| P0-E4-S3-T06 | 🧪 TEST   | BATCH 1 첫 섹션 변환 테스트                                   | 15분      |
| P0-E4-S3-T07 | 🔨 IMPL   | db-loader 구현 (JSON → D1 INSERT)                             | 20분      |
| P0-E4-S3-T08 | 📊 VERIFY | BATCH 1 전체 파이프라인 E2E 테스트                            | 20분      |

**완료 기준:**

- [ ] BATCH 1 → 60+ 노드, 200+ 엣지, 15+ 산식 자동 추출
- [ ] ontology-registry.json 외 ID 0건 (Ontology Lock 검증)
- [ ] D1에 draft 상태로 적재 완료
- [ ] 산식 변수 매핑 검증 통과

#### 📖 Story 0.4.4: Constants 자동 추출기

| Task ID      | Type      | Task                                 | 예상 시간 |
| ------------ | --------- | ------------------------------------ | --------- |
| P0-E4-S4-T01 | 🔨 IMPL   | constants-extractor 구현             | 30분      |
| P0-E4-S4-T02 | 🔨 IMPL   | confusion_level 자동 판정 로직       | 20분      |
| P0-E4-S4-T03 | 🧪 TEST   | BATCH 1 상수 추출 테스트 (15개 목표) | 15분      |
| P0-E4-S4-T04 | 📊 VERIFY | 매직 넘버 레지스트리 대조 검증       | 15분      |

**완료 기준:**

- [ ] BATCH 1에서 상수 15개+ 자동 추출
- [ ] confusion_level 분류 정확도 90%+

#### 📖 Story 0.4.5: Formula Engine (룰 엔진) PoC — AST 파서 기반

| Task ID      | Type      | Task                                                            | 예상 시간 |
| ------------ | --------- | --------------------------------------------------------------- | --------- |
| P0-E4-S5-T01 | 🔧 SETUP  | math.js 경량 AST 파서 설치 및 Workers 호환 확인                 | 15분      |
| P0-E4-S5-T02 | 🔨 IMPL   | ast-parser 모듈 구현 (eval() 절대 금지, AST로만 연산)           | 25분      |
| P0-E4-S5-T03 | 🔨 IMPL   | variable-mapper 구현 (expected_inputs 기반 자동 매핑)           | 20분      |
| P0-E4-S5-T04 | 🔨 IMPL   | constants-resolver 구현 (D1에서 직접 조회)                      | 15분      |
| P0-E4-S5-T05 | 🔨 IMPL   | BATCH 1 산식 등록 (유과타박률/낙엽률/인정피해율/보험금 등 15개) | 25분      |
| P0-E4-S5-T06 | 🧪 TEST   | 전체 산식 단위 테스트 (TDD)                                     | 20분      |
| P0-E4-S5-T07 | 📊 VERIFY | 교재 예시값으로 정확도 100% 검증                                | 15분      |

**완료 기준:**

- [ ] BATCH 1 산식 15개 JS 함수 구현
- [ ] 모든 산식 단위 테스트 통과
- [ ] LLM 호출 없이 constants DB 직접 조회로 연산

#### 📖 Story 0.4.6: Graph Visualizer (경량 검수 도구)

| Task ID      | Type     | Task                                                        | 예상 시간 |
| ------------ | -------- | ----------------------------------------------------------- | --------- |
| P0-E4-S6-T01 | 🔧 SETUP | Astro 프로젝트 내 admin 라우트 설정                         | 15분      |
| P0-E4-S6-T02 | 🔨 IMPL  | D3.js Force Graph 기본 렌더링 (서브그래프 필터 기본값)      | 30분      |
| P0-E4-S6-T03 | 🔨 IMPL  | 노드 클릭 → 상세 패널 (description, formula, page_ref)      | 20분      |
| P0-E4-S6-T04 | 🔨 IMPL  | status 변경 버튼 (draft→review→approved)                    | 15분      |
| P0-E4-S6-T05 | 🔨 IMPL  | LV1/LV2/LV3 필터 UI (전체 그래프 렌더링 금지, 서브그래프만) | 20분      |
| P0-E4-S6-T06 | 🔨 IMPL  | 방사형 렌더링 모드 (특정 노드 중심 N-hop 탐색)              | 20분      |
| P0-E4-S6-T07 | 🧪 TEST  | BATCH 1 데이터로 시각화 테스트                              | 15분      |

**완료 기준:**

- [ ] BATCH 1 노드/엣지 시각화 (서브그래프 단위)
- [ ] 전체 그래프 동시 렌더링 차단 (Hairball 방지)
- [ ] 클릭으로 status 변경 가능
- [ ] 필터로 하위 그래프 표시

---

### Phase 1 확장 사항

기존 `MVP_ROADMAP_4LEVEL.md`의 Phase 1 Epic 1.1(콘텐츠 파싱 엔진)에 추가:

| 추가 Story    | 내용                                                             |
| ------------- | ---------------------------------------------------------------- |
| Story 1.1.N+1 | BATCH 2~5 순차 실행 (과수16종 → 논작물 → 밭작물 → 시설/수입감소) |
| Story 1.1.N+2 | 개정 이력 자동 감지 (revision-detector)                          |
| Story 1.1.N+3 | Vectorize 임베딩 적재 (approved 노드)                            |
| Story 1.1.N+4 | 메타데이터 필터 + truth_weight 정렬 검색 구현                    |

기존 Epic 1.3(관리자 CMS)에 추가:

| 추가 Story    | 내용                                                   |
| ------------- | ------------------------------------------------------ |
| Story 1.3.N+1 | RAR Cycle 워크플로우 (draft→review→approved→published) |
| Story 1.3.N+2 | 기출문제 시간축 충돌 관리 UI                           |
| Story 1.3.N+3 | Constants 검수 UI (혼동등급 확인)                      |

---

## 12. 프로젝트 파일 연동 가이드

이 설계서의 내용이 기존 프로젝트 파일에 반영되어야 할 위치:

| 기존 파일                          | 반영 내용                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `SYSTEM_ARCHITECTURE_MASTER_v1.md` | §4 모듈설계에 formula-engine, graph-rag 레이어 추가. §6 데이터아키텍처에 6개 테이블 스키마 추가                   |
| `MVP_ROADMAP_4LEVEL.md`            | Phase 0에 Epic 0.4 추가. Phase 1 Epic 1.1/1.3 확장                                                                |
| `POC_CHECKLIST.md`                 | POC-NEW-1: Vectorize 메타필터 검증, POC-NEW-2: 룰엔진 정확도, POC-NEW-3: Claude 배치 구조화 품질                  |
| `CLAUDE_md_v2_1_jjokjipge.md`      | 프로젝트 구조에 packages/parser, packages/formula-engine 추가. 슬래시 커맨드에 /parse-batch, /verify-formula 추가 |
| `data_collection_pipeline.md`      | 4-Level 메타데이터 태깅 스키마 추가. Knowledge Contract 출력 포맷 정의                                            |
| `ADMIN_ARCHITECTURE_SUPPLEMENT.md` | Graph Visualizer UI 명세 추가. RAR Cycle 워크플로우 추가                                                          |
| `GAP_ANALYSIS_REPORT.md`           | 본 설계서의 §2 GAP 분석 결과 반영                                                                                 |

### 신규 생성 파일

| 파일명                         | 내용                                                   |
| ------------------------------ | ------------------------------------------------------ |
| `GRAPH_RAG_SCHEMA_v1.sql`      | §5의 SQL 스키마 전체 (마이그레이션용)                  |
| `MAGIC_NUMBER_REGISTRY.yaml`   | §6의 매직 넘버 70+ 항목 (초기 시드 데이터)             |
| `PIPELINE_PROMPT_TEMPLATES.md` | §8.2의 Claude API 프롬프트 템플릿 (Ontology Lock 적용) |
| `BATCH_PLAN.md`                | §3.3의 배치별 실행 계획 + 체크리스트                   |
| `ontology-registry.json`       | 허용 ID 목록 (품목/보장방식/엣지타입/조사종류)         |

---

## 부록: Hard Rules (전 단계 적용)

```
1. UPDATE 금지: knowledge_nodes, formulas는 절대 UPDATE하지 않는다.
   개정 시 새 노드 생성 → SUPERSEDES 엣지 연결 → 구 엣지 is_active=0

2. LLM 연산 금지: 수식 계산은 Formula Engine만 수행한다.
   LLM은 "어떤 산식을 적용할지" 판단만 하고, 실제 연산은 하지 않는다.

3. Truth Weight 강제 정렬: RAG 결과를 LLM에 주입할 때
   LAW(10) > FORMULA(8) > INVESTIGATION(7) > CONCEPT(5) 순서.
   낮은 가중치가 높은 가중치를 덮어쓰는 것을 금지한다.

4. Graceful Degradation: 검색 유사도 < 0.60이면 해설을 생성하지 않고
   "교재 O장 O절을 참고해 주세요"로 후퇴한다.

5. Constants 직접 조회: 수치/날짜/임계값은 LLM에게 묻지 않고
   constants 테이블에서 DB 쿼리로 가져온다.

6. 배치 순서 엄수: BATCH 1 → 검증 → BATCH 2 → ... 순차 진행.
   전 배치의 PoC 검증 없이 다음 배치 진행 금지.

7. 인간 검수 필수: AI가 생성한 모든 데이터는 draft 상태로만 DB에 적재.
   approved 상태는 Graph Visualizer에서 인간이 확인 후에만 전환.

8. Ontology Lock: ontology-registry.json에 사전 정의된 ID만 허용.
   schema-validator가 미등록 ID를 거부하고 재수행을 강제한다.

9. eval() 금지: equation_template 실행은 반드시 math.js AST 파서로.
   eval(), new Function() 등 동적 코드 실행은 어떤 경우에도 사용하지 않는다.

10. Hairball 방지: Graph Visualizer는 전체 그래프를 한번에 렌더링하지 않는다.
    작물 기준 또는 조사 기준의 서브그래프 필터가 기본값이다.
```

---

_"835페이지의 교재를 삼키는 데는 설계가 반, 실행이 반이다._
_설계는 끝났다. 이제 Claude Code에게 바톤을 넘긴다."_

— DEV COVEN 통합 기획·설계서 v1.1 (방어 패치 반영)
