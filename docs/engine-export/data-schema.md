# Data Schema — Knowledge Graph 스키마 상세

본 문서는 [`README.md`](./README.md) §3 의 깊이 보강. 노드/엣지/산식/상수의 컬럼·제약·트리거 전수 + ontology-registry 작성 가이드.

---

## 1. knowledge_nodes (지식 노드)

### 1.1 컬럼 정의 (migrations/0001 + 0019)

```sql
CREATE TABLE knowledge_nodes (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK(type IN
                    ('LAW','FORMULA','INVESTIGATION','INSURANCE','CROP','CONCEPT','TERM')),
  name            TEXT NOT NULL,
  description     TEXT,

  -- 도메인 분류 (lv*는 도메인 별 의미 재해석)
  lv1_insurance   TEXT,    -- ThePick: 보험 종류 / 일반화: 1차 분류
  lv2_crop        TEXT,    -- ThePick: 작물 / 일반화: 2차 분류
  lv3_investigation TEXT,  -- ThePick: 조사 항목 / 일반화: 3차 분류

  -- 출처 / 추적성 (모두 의무)
  page_ref        TEXT,                  -- 통합 텍스트 ("본문 p.415 / 제1장 제3절")
  book_page       INTEGER,               -- ★ NOT NULL 트리거 (0019)
  pdf_page        INTEGER,               -- ★ NOT NULL 트리거 (0019)
  chapter         TEXT,                  -- nullable (법령 노드 호환)
  section         TEXT,                  -- nullable

  -- BATCH / 버전
  batch_id        TEXT,                  -- 'BATCH-1' 등
  version_year    INTEGER NOT NULL,      -- 2025, 2026 등 (개정 추적)
  superseded_by   TEXT,                  -- 신규 노드 ID (개정 시 SUPERSEDES 엣지와 병행)

  -- RAG 가중치 / 상태
  truth_weight    INTEGER NOT NULL DEFAULT 5,
  status          TEXT DEFAULT 'draft' CHECK(status IN
                    ('draft','review','approved','published','flagged')),

  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
```

### 1.2 인덱스

```sql
CREATE INDEX idx_nodes_type     ON knowledge_nodes(type);
CREATE INDEX idx_nodes_lv1      ON knowledge_nodes(lv1_insurance);
CREATE INDEX idx_nodes_lv2      ON knowledge_nodes(lv2_crop);
CREATE INDEX idx_nodes_status   ON knowledge_nodes(status);
CREATE INDEX idx_nodes_version  ON knowledge_nodes(version_year);
CREATE INDEX idx_nodes_book_page ON knowledge_nodes(book_page);
CREATE INDEX idx_nodes_chapter  ON knowledge_nodes(chapter);
```

### 1.3 트리거 (Hard Constraint)

**0018 — status='draft' 강제** (AI 생성 데이터 검수 게이트):

```sql
CREATE TRIGGER enforce_draft_only_on_insert
BEFORE INSERT ON knowledge_nodes
WHEN NEW.status != 'draft' AND NEW.status IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'AI 생성 노드는 status=draft 만 허용. status_transitions 경유 전이.');
END;
```

**0019 — book_page / pdf_page NOT NULL**:

```sql
CREATE TRIGGER enforce_book_page_on_insert
BEFORE INSERT ON knowledge_nodes
WHEN NEW.book_page IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ADR-030 violation: book_page 의무 (출처 추적성).');
END;

CREATE TRIGGER enforce_pdf_page_on_insert
BEFORE INSERT ON knowledge_nodes
WHEN NEW.pdf_page IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ADR-030 violation: pdf_page 의무 (검수 단계 PDF 직접 검증).');
END;
```

### 1.4 truth_weight 도메인 정합

```typescript
const TRUTH_WEIGHTS: Record<NodeType, number> = {
  LAW: 10, // 법령 = 최상위 (충돌 시 우선)
  FORMULA: 8, // 산식 = 정량 정확성
  INVESTIGATION: 7, // 절차 = 운영 정확성
  INSURANCE: 6, // 1차 도메인 분류
  CROP: 6, // 2차 도메인 분류
  CONCEPT: 5, // 일반 개념
  TERM: 3, // 어휘
};
```

**다른 도메인 진입 시**: 가중치 상대값 조정 가능. 예: 법률 도메인이 아닌 기술 도메인 → LAW 비중 낮추고 FORMULA 비중 높임. 단, 절대값 0 금지 (RAG 정렬 무효화).

---

## 2. knowledge_edges (지식 엣지)

### 2.1 컬럼 정의

```sql
CREATE TABLE knowledge_edges (
  id          TEXT PRIMARY KEY,         -- 'EDGE-BATCH-1-001' 등
  from_node   TEXT NOT NULL REFERENCES knowledge_nodes(id),
  to_node     TEXT NOT NULL REFERENCES knowledge_nodes(id),
  edge_type   TEXT NOT NULL,            -- 13 type 중 하나
  condition   TEXT,                      -- "사고접수 후 7일 이내" 등
  priority    INTEGER DEFAULT 0,         -- 동일 from-to 중 정렬
  is_active   INTEGER DEFAULT 1,         -- 0=비활성 (시계열 이력)
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_edges_from   ON knowledge_edges(from_node);
CREATE INDEX idx_edges_to     ON knowledge_edges(to_node);
CREATE INDEX idx_edges_type   ON knowledge_edges(edge_type);
CREATE INDEX idx_edges_active ON knowledge_edges(is_active);
```

### 2.2 13 EdgeType 의미

| Edge                     | 의미      | 예시                                        |
| :----------------------- | :-------- | :------------------------------------------ |
| `APPLIES_TO`             | 적용 대상 | F-01 → CROP-001 (산식이 작물에 적용)        |
| `REQUIRES_INVESTIGATION` | 조사 의무 | INS-01 → INV-001 (보험이 조사 절차 요구)    |
| `PREREQUISITE`           | 선행 조건 | CONCEPT-002 → CONCEPT-001 (개념 학습 순서)  |
| `USES_FORMULA`           | 산식 사용 | INV-001 → F-01 (절차가 산식 호출)           |
| `DEPENDS_ON`             | 의존 관계 | F-02 → F-01 (산식 간 합성)                  |
| `GOVERNED_BY`            | 법령 종속 | INS-01 → LAW-001 (보험이 법에 의해 규율)    |
| `DEFINED_AS`             | 정의 관계 | TERM-001 → CONCEPT-001 (용어가 개념의 표현) |
| `EXCEPTION`              | 예외 처리 | F-01 → F-EXC-01 (정상 → 예외 산식)          |
| `TIME_CONSTRAINT`        | 시간 제약 | INV-001 → CONST-TIME-7d (7일 이내)          |
| `SUPERSEDES`             | 개정 대체 | NODE-NEW → NODE-OLD (신규가 구식 대체)      |
| `SHARED_WITH`            | 공유      | 1차 시험 노드 ↔ 2차 시험 노드               |
| `DIFFERS_FROM`           | 차이 명시 | 단감 인정피해율 ↔ 떫은감 인정피해율         |
| `CROSS_REF`              | 상호 참조 | "p.415 참조" 류 약한 연결                   |

### 2.3 SUPERSEDES 패턴 (Temporal Graph)

```
[2025년] CONCEPT-005 (인정피해율 65%)
            │
            ▼ SUPERSEDES
[2026년] CONCEPT-105 (인정피해율 60%, 개정)
```

**금지**: `UPDATE knowledge_nodes SET ... WHERE id='CONCEPT-005'`
**허용**: 신규 `CONCEPT-105` INSERT + `EDGE-SUP-001 (CONCEPT-105 SUPERSEDES CONCEPT-005)` INSERT

조회 시 `version_year` 기준 latest 우선 + 과거 노드는 `is_active=0` 으로 비활성.

---

## 3. formulas (산식)

### 3.1 컬럼 정의

```sql
CREATE TABLE formulas (
  id                   TEXT PRIMARY KEY,           -- 'F-01' ~ 'F-99'
  name                 TEXT NOT NULL,
  equation_template    TEXT NOT NULL,              -- 'area * (1 - ratio)' (math.js 표현)
  equation_display     TEXT,                       -- 'A × (1 − r)' (사용자 노출)
  variables_schema     TEXT NOT NULL,              -- JSON: { area: { unit: 'm²', range: [0, 100000] } }
  constraints          TEXT,                       -- JSON: { 'ratio': 'between 0 and 1' }
  expected_inputs      TEXT,                       -- JSON: 교재 예시값 입력
  graceful_degradation TEXT,                       -- "원문 산식 불명확 시 폴백 메시지"
  page_ref             TEXT,
  node_id              TEXT REFERENCES knowledge_nodes(id),
  version_year         INTEGER NOT NULL,
  superseded_by        TEXT,
  created_at           TEXT DEFAULT (datetime('now'))
);
```

### 3.2 equation_template 안전성 (Hard Limit 5)

**허용**: math.js AST 평가만. 정적 파싱 후 sandbox 에서 변수 바인딩하여 평가.

```typescript
import { parse } from 'mathjs';
const ast = parse('area * (1 - ratio)'); // 정적 파싱
const result = ast.evaluate({ area: 10000, ratio: 0.65 }); // sandbox 평가
```

**금지** (엔진 거부 — schema-validator + sandbox 이중 차단):

- 임의 JS 코드 평가 함수 (`e` `v` `a` `l` 결합 함수)
- 동적 함수 생성자 (`Function` constructor 사용 패턴)
- Node.js vm 모듈의 `runInContext` 등 sandbox 우회
- shell 명령 (`exec`, `spawn`)
- 파일 I/O (`fs.readFile` 등)

**검증**: `packages/formula-engine/src/sandbox.ts` 가 AST 노드 화이트리스트 만 통과 (BinaryOp, FunctionCall(allowed list), Literal, Identifier).

### 3.3 variables_schema 형식

```json
{
  "area": {
    "type": "number",
    "unit": "m²",
    "range": [0, 100000],
    "required": true,
    "description": "조사 면적"
  },
  "ratio": {
    "type": "number",
    "unit": "ratio",
    "range": [0, 1],
    "required": true,
    "description": "인정피해율"
  }
}
```

산식 호출 시 schema 위반 → `CalculationTimeoutError` 또는 `ValidationError` 거부.

---

## 4. constants (매직 넘버 레지스트리)

### 4.1 컬럼 정의

```sql
CREATE TABLE constants (
  id                TEXT PRIMARY KEY,            -- 'CONST-001' 패턴
  category          TEXT NOT NULL CHECK(category IN
                      ('threshold','coefficient','date','ratio','sample','deductible','insurance_rate')),
  name              TEXT NOT NULL,
  value             TEXT NOT NULL,                -- '0.65' / '2026-04-01' / '20%'
  numeric_value     REAL,                          -- 0.65 (계산용 숫자)
  applies_to        TEXT NOT NULL,                 -- 적용 노드/맥락
  insurance_type    TEXT,
  confusion_risk    TEXT,                          -- 혼동 위험 메모
  confusion_level   TEXT DEFAULT 'safe' CHECK(confusion_level IN ('safe','warn','danger')),
  -- migrations 0011 추가:
  valid_from        TEXT,                          -- ISO date
  valid_to          TEXT,                          -- ISO date
  version_year      INTEGER,
  created_at        TEXT DEFAULT (datetime('now'))
);
```

### 4.2 category 7종

| Category         | 의미        | ThePick 예시           |
| :--------------- | :---------- | :--------------------- |
| `threshold`      | 임계값      | 자기부담비율 20%       |
| `coefficient`    | 계수        | 단감 인정피해율 1.0115 |
| `date`           | 날짜 / 기한 | 사고접수 7일 이내      |
| `ratio`          | 비율        | 일소피해 한도 100/550  |
| `sample`         | 표본 수     | 표본주 6주             |
| `deductible`     | 자기부담금  | 10만원                 |
| `insurance_rate` | 보험료율    | 손해평가사 특화        |

**다른 도메인 진입 시**: 7 category 의미 재해석 (예: 전기기사 → `coefficient` = 회로 정수, `threshold` = 정격 전압). category 자체는 변경 불가 (Hard Lock).

### 4.3 LLM 추론 금지 (Hard Limit 6)

**허용**:

```typescript
const c = await db.select().from(constants).where(eq(constants.id, 'CONST-001'));
// c.numeric_value = 0.65
```

**금지**:

```typescript
const ratio = await claude.complete({ prompt: '단감 인정피해율은?' });
// LLM 환각 → 0.6 응답 가능 → 실제 0.65 와 8% 오차 → 서비스 사망
```

### 4.4 중복 정책 (ADR-021)

constants 는 `(name, valid_from, valid_to)` exact match 중복 검사. 임계값 기반 유사도 X (수치 1% 차이도 다른 상수). schema-validator 가 강제.

---

## 5. ontology-registry.json (Ontology Lock)

### 5.1 구조

```json
{
  "version": "1.1.0",
  "exam_id": "son-hae-pyeong-ga-sa",
  "node_types": ["LAW", "FORMULA", "INVESTIGATION", "INSURANCE", "CROP", "CONCEPT", "TERM"],
  "edge_types": ["APPLIES_TO", "REQUIRES_INVESTIGATION", "..."],
  "node_id_patterns": {
    "LAW": "^LAW-\\d{3}$",
    "FORMULA": "^F-\\d{2}$",
    "INVESTIGATION": "^INV-\\d{3}$",
    "INSURANCE": "^INS-\\d{2}$",
    "CROP": "^CROP-\\d{3}$",
    "CONCEPT": "^CONCEPT-\\d{3}$",
    "TERM": "^TERM-\\d{3}$"
  },
  "formula_id_pattern": "^F-\\d{2}$",
  "constant_id_pattern": "^CONST-\\d{3}$",
  "constant_categories": [
    "threshold",
    "coefficient",
    "date",
    "ratio",
    "sample",
    "deductible",
    "insurance_rate"
  ],
  "node_types_meta": {
    "LAW": { "deduplication_threshold": 0.88, "confusion_priority": "critical" },
    "FORMULA": { "deduplication_threshold": 0.95, "confusion_priority": "critical" },
    "INVESTIGATION": { "deduplication_threshold": 0.9, "confusion_priority": "high" },
    "INSURANCE": { "deduplication_threshold": 0.93, "confusion_priority": "high" },
    "CROP": { "deduplication_threshold": 0.97, "confusion_priority": "medium" },
    "CONCEPT": { "deduplication_threshold": 0.85, "confusion_priority": "medium" },
    "TERM": { "deduplication_threshold": 0.88, "confusion_priority": "low" }
  },
  "constants_dedup_policy": {
    "strategy": "exact_match",
    "fields": ["name", "valid_from", "valid_to"],
    "rationale": "Constants are exact-match domain — 임계값 무관 (ADR-021)"
  },
  "registered_ids": {
    "LAW": ["LAW-001", "LAW-002", "LAW-003"],
    "FORMULA": ["F-01", "F-02", "F-13"],
    "_": "도메인 별 ID 목록"
  }
}
```

### 5.2 다른 도메인 진입 시 작성

```bash
# 도메인 별 registry 신규 작성
cp packages/parser/src/ontology-registry.json \
   packages/parser-realtor/src/ontology-registry.realtor.json

# exam_id, registered_ids 만 도메인 별 갱신
# node_id_patterns 는 그대로 유지 권장 (정합성)
```

### 5.3 schema-validator 가 검증하는 것

1. 노드 ID 가 `node_id_patterns[type]` 정규식 매칭
2. 노드 ID 가 `registered_ids[type]` 에 등록되어 있음 (선택, strict mode)
3. NodeType / EdgeType 가 등록 목록 내
4. truth_weight 이 `TRUTH_WEIGHTS[type]` 와 일치
5. 4 메타 (book_page/pdf_page/chapter/section) 채움 정합

---

## 6. 보조 테이블

### 6.1 batch_runs (migrations/0015)

BATCH 실행 추적 + Idempotency. 상세는 `architecture.md §7.1`.

```sql
batch_runs (batch_run_id, started_at, completed_at, last_completed_stage,
            last_node_id, state, resume_count, fixture_path, state_hash, engine_version)
```

### 6.2 status_transitions (migrations/0010)

draft → review → approved 전이 추적.

```sql
status_transitions (id, target_type, target_id, from_status, to_status,
                    actor, reason, created_at)
```

### 6.3 engine_telemetry (migrations/0017)

8 게이지 observability 데이터.

### 6.4 revision_changes

교재 개정 시 SUPERSEDES 패턴 메타데이터. `change_type`, `before_node_id`, `after_node_id`, `revision_year`.

### 6.5 exam_questions

기출 문제 영속 — Level 3 학습 효과 역검증용.

### 6.6 mnemonic_cards

암기법 카드 — `study-material-generator` 가 생성. 두문자어 ↔ 원래 항목 역방향 검증 의무 (Hard Limit).

### 6.7 topic_clusters

연관 노드 군집 — Vectorize 임베딩 기반.

### 6.8 user_progress

학습자 FSRS 상태. 본 엔진 영역 외 (학습 layer).

---

## 7. 마이그레이션 19개 요약 (migrations/)

|  #   | 이름                                  | 책임                                                                                                                                     |
| :--: | :------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------- |
| 0001 | initial_schema                        | 9 테이블 + 인덱스 (knowledge_nodes/edges/formulas/constants/exam_questions/mnemonic_cards/topic_clusters/revision_changes/user_progress) |
| 0002 | 1st_exam_extension                    | 1차 시험 도메인 컬럼                                                                                                                     |
| 0003 | temporal_guard_not_null               | 시계열 무결성 강화                                                                                                                       |
| 0004 | temporal_guard_extension              | 동일                                                                                                                                     |
| 0005 | not_null_triggers_completion          | NOT NULL 트리거 완성                                                                                                                     |
| 0006 | users_and_auth                        | 사용자 + 인증                                                                                                                            |
| 0007 | users_strict_hardening                | 사용자 보안 강화                                                                                                                         |
| 0008 | webhook_events                        | 결제 webhook                                                                                                                             |
| 0009 | sessions                              | 세션 관리                                                                                                                                |
| 0010 | status_transitions_and_page_ref_guard | draft→approved 전이 + page_ref 가드                                                                                                      |
| 0011 | revision_2026_constants_seed          | 2026년 개정 상수 seed                                                                                                                    |
| 0012 | rate_limits                           | API rate limit                                                                                                                           |
| 0013 | active_view_and_review_decisions      | 활성 뷰 + 검수 결정                                                                                                                      |
| 0014 | phase05_critical_hardening            | Phase 0.5 보안 강화                                                                                                                      |
| 0015 | batch_runs                            | BATCH 실행 추적 + Idempotency                                                                                                            |
| 0016 | knowledge_nodes_batch_idempotency     | 노드 멱등성                                                                                                                              |
| 0017 | engine_telemetry                      | 8 게이지 observability                                                                                                                   |
| 0018 | enforce_draft_only_insert             | AI 생성 status='draft' 강제                                                                                                              |
| 0019 | knowledge_nodes_page_chapter_meta     | 4 메타 컬럼 + NOT NULL 트리거                                                                                                            |

다른 프로젝트 도입 시 0001~0019 전부 적용 권장 (의존성 순차).

---

## 8. 검증 SQL 패턴 (다른 도메인에서 재사용)

```sql
-- BATCH-N 적재 후 검증
SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-1';   -- 예상 수 일치
SELECT COUNT(*) FROM knowledge_edges WHERE id LIKE 'EDGE-BATCH-1-%';

-- 고아 엣지 (from/to node 부재)
SELECT COUNT(*) FROM knowledge_edges e
WHERE NOT EXISTS (SELECT 1 FROM knowledge_nodes n WHERE n.id=e.from_node)
   OR NOT EXISTS (SELECT 1 FROM knowledge_nodes n WHERE n.id=e.to_node);
-- 0 이어야 PASS

-- status='draft' 강제 위반
SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-1' AND status != 'draft';
-- 0 이어야 PASS (Hard Rule 13)

-- 4 메타 채움
SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-1' AND
       (book_page IS NULL OR pdf_page IS NULL);
-- 0 이어야 PASS (0019 트리거 정합)

-- SUPERSEDES 순환 (재귀 CTE)
WITH RECURSIVE chain AS (
  SELECT from_node, to_node, 1 as depth FROM knowledge_edges WHERE edge_type='SUPERSEDES'
  UNION ALL
  SELECT c.from_node, e.to_node, c.depth+1 FROM chain c
    JOIN knowledge_edges e ON c.to_node=e.from_node
   WHERE e.edge_type='SUPERSEDES' AND c.depth < 100
)
SELECT COUNT(*) FROM chain WHERE from_node = to_node;  -- 0 이어야 PASS
```

---

본 data-schema.md 는 도메인 무관 스키마 골격. 도메인 별 ontology-registry 와 NodeType/EdgeType 의미 재해석은 [`customization.md`](./customization.md) 참조.
