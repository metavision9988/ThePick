# Ontology Registry F-ID Pattern 확장 — 4-Pass 리뷰 (Pass 1+2)

- 리뷰 방식: 독립 에이전트 (Pass 1+2, 메인 대화 컨텍스트 비참조)
- 리뷰 대상: `packages/parser/src/ontology-registry.json` 3줄 변경
  - `version`: 1.1.0 → 1.2.0
  - `node_id_patterns.FORMULA`: `^F-\d{2}$` → `^F-\d{2,3}$`
  - `formula_id_pattern`: `^F-\d{2}$` → `^F-\d{2,3}$`
- 리뷰 일자: 2026-05-06
- 리뷰 범위: 변경 1 파일 + 연관 파일 8개 (ontology-registry.ts / schema-validator.ts / normalizer.ts / draft-loader.ts / build-source-id.ts / json-to-sql-batch.py / verify-engine-contracts.ts / 5 BATCH KG JSON)

---

## Pass 1 — SURGEON (Bottom-Up, 코드 정합성)

판정: PASS / 6건 확인 / 0 Critical / 0 Major / 0 Minor / N/A 0건

### 확인 1 — JSON syntax + schema 형태 정합 (ontology-registry.json:1-53)

`python3 -c "import json; json.load(open(...))"` 실행 → JSON 파싱 성공. 필드 구조 (version / node_types / edge_types / node_id_patterns / formula_id_pattern / constant_id_pattern / constant_categories / node_types_meta / constants_dedup_policy) 모두 보존. 변경된 두 정규식 문자열은 JSON string escape (`\\d`) 정상.

### 확인 2 — 정규식 문법 정합 (JS + Python 양쪽)

- `node -e "/^F-\d{2,3}$/.test(...)"` 21개 입력 검증 (다음 §확인 6 참조).
- `python3 import re; re.compile(r'^F-\d{2,3}$')` 동일 거동 확인.
- ontology-registry.ts:55-63 `compilePattern()` 내 `new RegExp(pattern)` 호출 시점에 invalid syntax 면 즉시 throw — 모듈 로드 시 build-time 등가 fail-fast. `\d{2,3}` 은 quantifier {min,max} 표준 ECMAScript 문법.

### 확인 3 — BATCH-1~4 백워드 호환 (5개 KG JSON 전수)

실측 (`python3` 로 5개 batch KG JSON 산식 ID enumerate):

- BATCH-1: F-01 ~ F-13 (13개) — 신 패턴 PASS (2자리 수)
- BATCH-2: F-14 ~ F-33 (20개) — PASS
- BATCH-3: F-34 ~ F-60 (27개) — PASS
- BATCH-4: F-61 ~ F-97 (37개) — PASS
- BATCH-5: F-98 ~ F-130 (33개) — PASS (3자리 100~130 포함)

→ 누적 130 산식 ID 100% 신 패턴 PASS. 회귀 0건.

### 확인 4 — 3자리 ID 경계값 (F-100, F-130, F-999)

`/^F-\d{2,3}$/` 직접 실행 결과 모두 PASS. F-100 (BATCH-5 첫 3자리), F-130 (BATCH-5 max), F-999 (이론 상한) 모두 정상 매칭.

### 확인 5 — 1자리/4자리 거부 보장

- `F-1` → FAIL (1자리 거부)
- `F-9` → FAIL (1자리 거부)
- `F-1000` → FAIL (4자리 거부)
- `F-12345` → FAIL
- `F-0` → FAIL (1자리 거부, 또한 0번 산식 부재 정책 강화)
  → {2,3} quantifier 가 lower/upper 양쪽 strict bounding 작동.

### 확인 6 — 비형식 입력 거부 (case / whitespace / prefix)

- `f-01` → FAIL (lower-case)
- `F01` → FAIL (separator 부재)
- `F-AB`, `F-1A` → FAIL (non-digit)
- `"F-01 "`, `" F-01"` → FAIL (anchor `^...$` 보장)
  → 부적절 입력 차단 강도 변화 없음 (regex 변경이 anchor / 문자 클래스 외 영역 미영향).

### 반론 (Devil's Advocate)

가능한 깨짐 시나리오:

1. **변수 ID 충돌** — `equation_template` 내 변수명이 `F-100` 같은 형식이면 ID 와 변수명 혼동 가능. 그러나 (a) `formula_id_pattern` 은 산식 식별자 전용으로 변수 충돌 위험 영역이 아니며, (b) Formula Engine math.js AST 파서는 변수명에 hyphen 미허용 (식별자 토큰 규칙) → 실제 충돌 불가능. 본 우려 reject.
2. **3자리 진입 시 sort 순서 변경** — 문자열 정렬 시 `["F-99","F-100"]` 의 lexical 순서는 `F-100 < F-99` 가 됨 (`'1' < '9'`). normalizer.ts:137 `nodeIds.sort()` 결과가 시각적 직관과 어긋날 수 있음. 단, AC-PA-1 invariant 결정성 자체는 유지 (동일 입력 → 동일 정렬). 본 fix 의 결과로 정렬 결과가 BATCH-1~4 시점 대비 달라지지만 `node_ids` 결정성 정책상 문제 없음. 단, BATCH-N 간 tolerable diff 비교 시 시각적 혼동 가능 — reviewer UI 시 인지 필요. 코드 정합성 자체는 PASS.

---

## Pass 2 — ARCHITECT (Top-Down, 연계 검증)

판정: PASS / 7건 확인 / 0 Critical / 0 Major / 1 Minor / N/A 0건

### 확인 1 — 등록 패턴 단일 진실 소스 (Single Source of Truth)

`grep -rn 'F-\\d'` 실행 결과 production 코드 전체에서 정규식 literal `F-\d` 출현은 `ontology-registry.json:21,28` 두 곳뿐. parser/quality/scripts/migrations 어디에도 hardcoded F-NN regex 없음. 즉 본 변경 단일 파일 수정으로 전체 시스템에 반영 — 누락된 sibling 변경 위험 0.

### 확인 2 — registry consumer 동적 로드 (ontology-registry.ts:65-69)

```
const formulaPattern = compilePattern('formula_id_pattern', registry.formula_id_pattern);
```

모듈 로드 시 JSON import 후 즉시 RegExp 컴파일. precompile 캐시 사용. `isValidFormulaId()` (line 87-89), `isValidNodeId('FORMULA', id)` (nodePatternCache), `inferNodeTypeFromId()` (line 103-108) 모두 자동으로 신 패턴 채택. 호출 측 (schema-validator.ts:451 / draft-loader.ts:214 / normalizer.ts:172) 변경 불필요.

### 확인 3 — verify-engine-contracts.ts 의 ontology lock 검증 영향

`grep` 결과 verify-engine-contracts.ts 는 `ontology` / `formula_id_pattern` / `registry.version` 어느 것도 직접 읽거나 pin 하지 않음. 14 obligation 체계는 BATCH 적재 expansion 의무를 추적할 뿐 ID pattern 검증을 자체 수행하지 않음 (검증은 schema-validator 에 위임). → 본 fix 무영향.

### 확인 4 — `_meta.ontology_registry_version` 메타데이터 (5 BATCH KG JSON)

BATCH-1 missing / BATCH-2~4 = "1.1.0" / BATCH-5 = "1.2.0" 혼재 상태. `grep -rn "ontology_registry_version"` production 코드 전체 결과 0건 — **어떤 consumer 도 본 메타데이터를 읽거나 검증하지 않음**. 즉 mixed-version 문서 메타는 정합성 위험 0이며, 추적성 informational 라벨 용도 한정. version bump 1.1.0 → 1.2.0 의 의미는 "패턴 확장의 사후 추적 기록"으로 충분.

### 확인 5 — JSON Schema validator (parser-side)

`assertRegistryShape()` (ontology-registry.ts:25-48) 는 필드 존재성만 검증, 정규식 내용 / version 형식 검증 없음. → version "1.2.0" / pattern `^F-\d{2,3}$` 양쪽 모두 통과. 추가로 `compilePattern()` 이 invalid regex 면 모듈 로드 시 throw 하므로 1차 build-time 방어 활성.

### 확인 6 — json-to-sql-batch.py ID 검증 영향

`scripts/json-to-sql-batch.py:95-111` `build_formula_inserts()` 는 ID 검증 미수행 (단순 SQL escape 후 INSERT 문 생성). D1 schema migration 0003/0013 의 formulas 테이블 trigger 도 ID pattern CHECK 제약 없음 (`grep "CHECK.*F-"` 결과 0건). → 신 3자리 ID (F-100 ~ F-130) 가 D1 INSERT 단계에서 차단되지 않음. 생성 측 검증은 schema-validator (TS) 가 단일 책임.

### 확인 7 — Hard Limit 5 (Ontology Lock) 위반 여부

CLAUDE.md "Hard Limit (절대 제약)" — "Ontology Lock: ontology-registry.json 외 ID 생성 금지". 본 변경은 (a) 파일 외부에서 ID 를 생성하지 않고, (b) ontology-registry.json **내부**에서 패턴 확장만 수행 → Lock 정신 (외부 위변조 차단) 그대로 유지. 정책 정합.

### Minor 1 — `_meta.ontology_registry_version` 표기 불일치 (메타 일관성, 비차단)

- 위치: 5개 BATCH KG JSON `_meta.ontology_registry_version`
- 현황: BATCH-1 = (key 부재) / BATCH-2~4 = "1.1.0" / BATCH-5 = "1.2.0"
- 영향: production 코드 미참조이므로 런타임 정합 영향 0. 단, 향후 reviewer / auditor 가 "어느 BATCH 에서 패턴이 확장되었나" 추적 시, BATCH-5 의 1.2.0 라벨만으로 시점 추정 가능 (긍정 사이드).
- 권고 (선택): future BATCH-N 적재 시 `_meta.ontology_registry_version` 키를 의무 채움 (`json-to-sql-batch.py` 가 KG JSON 을 읽을 때 누락 경고 emit). 본 fix 와 무관 — 향후 step 으로 분리.

### 반론 (Devil's Advocate)

가능한 깨짐 시나리오:

1. **`equation_template` SUPERSEDES 체인의 ID 직렬화** — Temporal Graph 정책상 산식 개정 시 INSERT + SUPERSEDES 사용. 신 ID 가 3자리이면 SUPERSEDES edge 의 source/target 직렬화 텍스트 길이가 1 byte 증가 → graph canonical hash (normalizer.ts edge_dependency_graph) 변동 가능. 단, 이는 **새 ID 도입의 자연 결과**이며 invariant 위배 아님 (BATCH-N 간 graph 가 다른 것은 정상). PASS.
2. **regex catastrophic backtracking** — `^F-\d{2,3}$` 은 backreference 없는 정규 패턴, 입력 길이 4-5자, anchor 양쪽 고정 → ReDoS 위험 0. PASS.
3. **JSON Schema generator (Drizzle ORM 타입 합성)** — Drizzle 은 D1 컬럼 타입에서 TS 타입을 합성하지 의 정규식 추출 안 함. 본 fix 로 ORM 타입 변경 없음. PASS.
4. **테스트 확대 누락** — schema-validator.test.ts:163-170 `isValidFormulaId` 케이스가 F-100 / F-130 acceptance 미증명 (현재 F-01, F-99 PASS / F-1, FORMULA-01 FAIL 만). 본 fix 자체는 코드 변경 0이라 기존 테스트가 그대로 PASS 하지만, regression-prevention 차원에서 F-100 / F-999 acceptance + F-1000 rejection 케이스 추가가 권장. 단, 테스트 작성은 본 fix scope 밖 (별도 step). 본 review 에서는 Minor 비차단.

---

## 종합 판정

- Pass 1 (Surgeon): PASS 6건 / 0 Critical / 0 Major / 0 Minor
- Pass 2 (Architect): PASS 7건 / 0 Critical / 0 Major / 1 Minor (메타 일관성, 비차단)

**판정: 완료 가능 (수정 불필요)**

근거:

1. JSON syntax / regex 문법 정합 모두 PASS.
2. 누적 130 산식 ID (BATCH-1~5) 신 패턴 100% 백워드 호환.
3. 1자리 / 4자리 / 비형식 입력 거부 강도 보존.
4. SSOT 단일 파일 변경으로 전체 시스템 자동 반영 (downstream consumer 변경 불필요).
5. Hard Limit 5 (Ontology Lock) 정신 유지 — 외부 ID 생성 아닌 내부 패턴 확장.
6. mixed-version `_meta.ontology_registry_version` 은 production 코드 미참조 → 런타임 영향 0.

후속 step (선택, 본 fix scope 밖):

- schema-validator.test.ts 에 F-100 / F-999 acceptance + F-1000 rejection 케이스 추가 (regression-prevention).
- BATCH-N 적재 파이프라인이 `_meta.ontology_registry_version` 누락 시 경고 emit (메타 일관성 강제).
