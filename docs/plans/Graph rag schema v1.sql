-- ============================================================
-- 쪽집게 Graph RAG 데이터 스키마 v1.1 (방어 패치 반영)
-- 생성일: 2026-04-07
-- 패치: expected_inputs, unit, Ontology Lock 주석
-- 대상: Cloudflare D1
-- ============================================================

-- 1. 지식 노드 (Temporal Graph + Truth Weight)
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('LAW','FORMULA','INVESTIGATION','INSURANCE','CROP','CONCEPT','TERM')),
  name TEXT NOT NULL,
  description TEXT,
  lv1_insurance TEXT,
  lv2_crop TEXT,
  lv3_investigation TEXT,
  page_ref TEXT,
  batch_id TEXT,
  version_year INTEGER NOT NULL,
  superseded_by TEXT,
  truth_weight INTEGER NOT NULL DEFAULT 5,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','review','approved','published')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nodes_type ON knowledge_nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_lv1 ON knowledge_nodes(lv1_insurance);
CREATE INDEX IF NOT EXISTS idx_nodes_lv2 ON knowledge_nodes(lv2_crop);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON knowledge_nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_version ON knowledge_nodes(version_year);

-- 2. 지식 엣지 (시계열 비활성화 지원)
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id TEXT PRIMARY KEY,
  from_node TEXT NOT NULL REFERENCES knowledge_nodes(id),
  to_node TEXT NOT NULL REFERENCES knowledge_nodes(id),
  edge_type TEXT NOT NULL,
  condition TEXT,
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_edges_from ON knowledge_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_edges_to ON knowledge_edges(to_node);
CREATE INDEX IF NOT EXISTS idx_edges_type ON knowledge_edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_active ON knowledge_edges(is_active);

-- 3. 산식 (룰 엔진용)
CREATE TABLE IF NOT EXISTS formulas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  equation_template TEXT NOT NULL,
  equation_display TEXT,
  variables_schema TEXT NOT NULL,
  constraints TEXT,
  expected_inputs TEXT,              -- JSON: LLM이 지문에서 찾아야 할 변수명/타입 [{"name":"표본주수","type":"integer"}]
  graceful_degradation TEXT,
  page_ref TEXT,
  node_id TEXT REFERENCES knowledge_nodes(id),
  version_year INTEGER NOT NULL,
  superseded_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 4. 매직 넘버 레지스트리
CREATE TABLE IF NOT EXISTS constants (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('threshold','coefficient','date','ratio','sample','deductible','insurance_rate')),
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  numeric_value REAL,
  applies_to TEXT NOT NULL,
  insurance_type TEXT,
  confusion_risk TEXT,
  confusion_level TEXT DEFAULT 'normal' CHECK(confusion_level IN ('normal','warn','danger')),
  unit TEXT,                          -- "%", "원", "주", "kg", "일" (단위 혼동 방지)
  page_ref TEXT,
  version_year INTEGER NOT NULL,
  exam_frequency INTEGER DEFAULT 0,
  related_formula TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_const_category ON constants(category);
CREATE INDEX IF NOT EXISTS idx_const_version ON constants(version_year);
CREATE INDEX IF NOT EXISTS idx_const_confusion ON constants(confusion_level);

-- 5. 개정 이력 추적
CREATE TABLE IF NOT EXISTS revision_changes (
  id TEXT PRIMARY KEY,
  version_year INTEGER NOT NULL,
  revision_date TEXT NOT NULL,
  category TEXT NOT NULL,
  target_section TEXT,
  target_crops TEXT,
  change_type TEXT NOT NULL CHECK(change_type IN ('added','modified','deleted','clarified')),
  before_value TEXT,
  after_value TEXT,
  exam_priority INTEGER DEFAULT 10,
  related_constants TEXT,
  related_nodes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rev_version ON revision_changes(version_year);
CREATE INDEX IF NOT EXISTS idx_rev_priority ON revision_changes(exam_priority DESC);

-- 6. 기출문제 (시간축 관리)
CREATE TABLE IF NOT EXISTS exam_questions (
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
  related_nodes TEXT,
  related_constants TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','deprecated','flagged')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exam_year ON exam_questions(year);
CREATE INDEX IF NOT EXISTS idx_exam_status ON exam_questions(status);