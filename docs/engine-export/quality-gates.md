# Quality Gates — 검증 체계 운영 가이드

본 문서는 [`README.md`](./README.md) §5 의 깊이 보강. 다른 프로젝트의 Claude Code 가 본 엔진을 도입한 후 **상시 검증 운영** 할 때 참조.

본 엔진의 가치는 정확성·신뢰성. 검증 체계 없이 사용하면 환각·계산 오류·근거 부재가 발생합니다.

---

## 1. 검증 체계 4 layer 개요

```
┌────────────────────────────────────────────────────────────┐
│ Layer 0: 자동 회귀 (verify-engine-contracts.ts)             │
│   - 매 세션 entry / step 완료 시 의무                        │
│   - 모노레포 1200+ 테스트 합산                              │
└────────────────────────────────────────────────────────────┘
            ↑
┌────────────────────────────────────────────────────────────┐
│ Layer 1: 표면 검증 (LOCAL D1 dry-run)                       │
│   - schema-validator + graph-integrity + ontology lock      │
│   - BATCH 적재 시 의무                                      │
└────────────────────────────────────────────────────────────┘
            ↑
┌────────────────────────────────────────────────────────────┐
│ Layer 2: 내용 정확성 (Golden Test)                          │
│   - 산식 정답 100% 일치 + page_ref 범위 + 변수 매핑          │
│   - BATCH 적재 후 + Phase 진입 전 의무                       │
└────────────────────────────────────────────────────────────┘
            ↑
┌────────────────────────────────────────────────────────────┐
│ Layer 3: 학습 효과 역검증 (BATCH 누적 후)                   │
│   - 기출 문제 자동 풀이 + 혼동 유형 노출 + 누락 페이지       │
│   - 모든 BATCH 처리 후 시점 의무                            │
└────────────────────────────────────────────────────────────┘
            ↑
┌────────────────────────────────────────────────────────────┐
│ Layer 4: 4-Pass + 5-페르소나 (코드 변경 / Phase 마일스톤)   │
│   - 독립 서브에이전트 의무 (자가 리뷰 금지)                  │
└────────────────────────────────────────────────────────────┘
```

각 layer 는 의무 트리거가 다름. 아래에서 layer 별 운영 상세.

---

## 2. Layer 0 — verify-engine-contracts (자동 회귀)

### 2.1 트리거

- **매 세션 entry 시 의무**: 직전 세션 회귀 0건 확인
- **매 step 완료 시 의무**: 본인 변경이 회귀 유발 여부 확인
- **PR 생성 전 의무**: CI 통과 외 본인 LOCAL 확인

### 2.2 실행

```bash
pnpm tsx scripts/verify-engine-contracts.ts --json \
  > .claude/reports/verify-${SESSION_ID}.json
```

### 2.3 PASS 기준

```json
{
  "summary": {
    "total": 6,
    "pass": 5,
    "fail": 0,
    "skip": 1,
    "overallStatus": "PASS"
  }
}
```

- `total: 6` 카테고리 중 `fail: 0` (skip 은 Phase 단계 정합)
- `overallStatus: PASS` 강제

### 2.4 결정성 (TD-VRF-001 패턴)

ThePick 에서 `@thepick/batch` 패키지 일부 테스트가 flaky (326/327) — 환경 의존. 다른 프로젝트도 동일 패턴 가능.

**대응**:

- run1 PASS, run2 FAIL 발생 시 → run3 추가 실행 의무
- run1 ≡ run3 PASS 일치 시 → flaky 결정성 부채 (TD-VRF-NNN) 영속, **회귀 0 으로 판정**
- run3 도 FAIL 시 → 진짜 회귀, 즉시 root cause 추적

```bash
# 패턴 (TD-VRF-001 흡수 전):
pnpm tsx scripts/verify-engine-contracts.ts --json > verify-run1.json   # PASS
pnpm tsx scripts/verify-engine-contracts.ts --json > verify-run2.json   # FAIL (flaky)
pnpm tsx scripts/verify-engine-contracts.ts --json > verify-run3.json   # PASS
# run1≡run3 → 회귀 0
```

---

## 3. Layer 1 — 표면 검증 (BATCH 적재 시)

### 3.1 schema-validator

`packages/parser/src/schema-validator.ts`:

```typescript
import { schemaValidator, getOntologyRegistry } from '@thepick/parser';

const registry = getOntologyRegistry('./ontology-registry.realtor.json');
const result = await schemaValidator(graph, registry);

if (!result.valid) {
  throw new Error(`Schema violations: ${result.errors.length}`);
}
```

**검사 항목**:

- 노드 ID 패턴 (`node_id_patterns[type]` 매칭)
- NodeType / EdgeType 등록 목록 내
- 필수 컬럼 (id, type, name, version_year, status, book_page, pdf_page) 존재
- truth_weight = TRUTH_WEIGHTS[type] 정합
- status='draft' 강제 (AI 생성)
- 4 메타 컬럼 채움

### 3.2 graph-integrity

`packages/quality/src/graph-integrity.ts`:

```typescript
import { checkGraphIntegrity } from '@thepick/quality';

const integrity = checkGraphIntegrity(graph);
if (!integrity.passed) {
  console.error('Orphan nodes:', integrity.orphanNodes);
  console.error('Broken edges:', integrity.brokenEdges);
  console.error('SUPERSEDES cycles:', integrity.supersedesCycles);
  throw new Error('Graph integrity violation');
}
```

**검사 항목**:

- 고아 노드 (in/out 엣지 모두 0)
- 끊긴 엣지 (from/to 노드 부재)
- SUPERSEDES 순환 (재귀 CTE)

### 3.3 LOCAL D1 dry-run

```bash
# in-memory SQLite 에 마이그레이션 0001~0019 + batch-N-insert.sql 적용 후 검증
pnpm tsx scripts/local-d1-dry-run.ts \
  --migrations migrations/ \
  --insert docs/batch-load/batch-1-v2/batch-1-insert.sql \
  --validate
```

### 3.4 production 검증 SELECT 4건

[`data-schema.md §8`](./data-schema.md) 패턴:

```sql
-- knowledge_nodes
SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-1';   -- expected 75

-- knowledge_edges
SELECT COUNT(*) FROM knowledge_edges WHERE id LIKE 'EDGE-BATCH-1-%';  -- expected 133

-- formulas
SELECT COUNT(*) FROM formulas WHERE id LIKE 'F-%';  -- expected ≥ 13

-- constants (BATCH 영역만)
SELECT COUNT(*) FROM constants WHERE id IN ('CONST-001','CONST-002','CONST-003','CONST-004','CONST-005');
-- expected 5

-- orphan_edges (BATCH 영역만)
SELECT COUNT(*) FROM knowledge_edges e
WHERE e.id LIKE 'EDGE-BATCH-1-%'
  AND (NOT EXISTS (SELECT 1 FROM knowledge_nodes n WHERE n.id=e.from_node)
    OR NOT EXISTS (SELECT 1 FROM knowledge_nodes n WHERE n.id=e.to_node));
-- expected 0

-- status='draft' 위반
SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-1' AND status != 'draft';
-- expected 0 (Hard Rule 13)
```

**모든 검증 PASS 시** Layer 1 통과.

---

## 4. Layer 2 — 내용 정확성 (Golden Test)

### 4.1 page_ref 범위 검증

```typescript
function verifyPageRefRange(graph: KnowledgeGraph, batchPages: { min: number; max: number }) {
  const outOfRange = graph.nodes.filter(
    (n) => n.book_page < batchPages.min || n.book_page > batchPages.max,
  );
  if (outOfRange.length > 0) {
    throw new Error(`page_ref out of BATCH range: ${outOfRange.map((n) => n.id).join(', ')}`);
  }
}
```

### 4.2 산식 변수명 매핑 검증

```typescript
function verifyFormulaVariables(formula: Formula, rawText: string) {
  const declaredVars = Object.keys(JSON.parse(formula.variables_schema));
  const usedInTemplate = extractIdentifiers(parse(formula.equation_template));
  const missing = declaredVars.filter((v) => !usedInTemplate.includes(v));
  if (missing.length > 0) {
    throw new Error(
      `F-${formula.id}: variables_schema 에 선언된 ${missing} 가 equation_template 에 미사용`,
    );
  }
}
```

### 4.3 산식 Golden Test (교재 예시값)

```typescript
import { calculate } from '@thepick/formula-engine';
import { test, expect } from 'vitest';

test('F-01 단감 인정피해율 — 교재 예시값', () => {
  const result = calculate('F-01', { area: 10000, ratio: 1.0115 });
  expect(result.value).toBeCloseTo(10115, 0); // 정수 부분 일치
  // 교재 p.415 예시값과 100% 일치 의무
});
```

### 4.4 기출 정답 100% 일치 (도메인 별 의무)

```typescript
test('기출 제10회 2차 — 적과전 인정피해율 산식 문항', async () => {
  const officialAnswer = '6500'; // 공식 정답
  const myAnswer = calculate('F-01', officialInputs).value.toString();
  expect(myAnswer).toBe(officialAnswer); // 1건이라도 불일치 시 BATCH FAIL
});
```

**불일치 1건이라도 발견 시**: BATCH 진입 차단 + root cause 추적 의무. 100% 일치 보장이 본 엔진의 차별점.

---

## 5. Layer 3 — 학습 효과 역검증 (BATCH 누적 후)

### 5.1 트리거

- **모든 BATCH 처리 완료 후** 시점만 의미 있음 (단일 BATCH 시점 = 미진입)
- ThePick 의 경우 BATCH-1~14 모두 완료 후 시점 (진산님 결정 정합)

### 5.2 검증 항목

#### 기출 자동 풀이

```typescript
async function autoSolveExam(year: number, examId: ExamId) {
  const questions = await db
    .select()
    .from(exam_questions)
    .where(and(eq(exam_questions.year, year), eq(exam_questions.exam_id, examId)));

  let correct = 0;
  for (const q of questions) {
    const ragContext = await ragSearch(q.question_text, examId);
    const answer = await aiAdapter.solve(q.question_text, ragContext);
    if (answer === q.official_answer) correct++;
  }

  const accuracy = correct / questions.length;
  return { year, total: questions.length, correct, accuracy };
}
```

**기준**:

- 60% 이상 → BATCH 누적 충분
- 40~60% → 누락 페이지 식별 (Layer 3 보강 BATCH)
- 40% 미만 → BATCH 적재 품질 재검토

#### 8 ConfusionType 자동 감지

```typescript
import { detectConfusion } from '@thepick/quality';

const confusion = await detectConfusion(graph, {
  enabledTypes: REALTOR_ADAPTER.enabledConfusionTypes,
});
// 학습자 함정 (예: 65% vs 60% 혼동) 노출 → 학습 자료 자동 생성 트리거
```

#### 누락 페이지 식별

```typescript
const coveredPages = new Set(graph.nodes.map((n) => n.book_page));
const allPages = range(1, 835);
const uncovered = allPages.filter((p) => !coveredPages.has(p));
// 30 페이지 이상 누락 → 보강 BATCH 진입 트리거
```

---

## 6. Layer 4 — 4-Pass 자동 리뷰 (코드 변경 후)

### 6.1 트리거

- **L2+ 코드 변경 후 의무** (auto-review-protocol.md 정합)
- **자가 리뷰 절대 금지** — 독립 서브에이전트 의무
- 데이터 적재 영역 (knowledge_graph JSON / SQL) = 면제 (코드 영역 X)

### 6.2 4 Pass 의미

| Pass                           | 관점         | 핵심 질문                       |
| :----------------------------- | :----------- | :------------------------------ |
| **1 SURGEON** (Bottom-Up)      | 코드 정합성  | "이 코드 단독으로 터지는 경로?" |
| **2 ARCHITECT** (Top-Down)     | 모듈 연계    | "다른 모듈과 만나면 터지는가?"  |
| **3 ADVOCATE** (Cross-Cutting) | UX + 보안    | "수험생과 공격자 둘 다 만족?"   |
| **4 CONTRACT** (기획 대조)     | Silent Pivot | "기획대로 만들었는가?"          |

### 6.3 실행 (Agent tool 병렬)

```
[메인 컨텍스트]
   │
   ├─ Agent (silent-failure-hunter) — Pass 1 + 일부 Pass 2
   ├─ Agent (security-engineer)     — Pass 3 일부
   ├─ Agent (system-architect)      — Pass 2 + Pass 4
   ├─ Agent (quality-engineer)      — Pass 1 + Pass 3
   └─ Agent (code-reviewer)         — 통합 + 반론
```

**최소 구성**: 2개 (Pass 1+2 / Pass 3+4)
**권장 구성**: 4~5개 병렬

### 6.4 보고 형식

```
── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 N개
리뷰 범위: 변경 파일 N개 + 연관 파일 N개

Pass 1 (Surgeon): ✅ N건 확인 / 🔴 N건 / 🟠 N건 / N/A N건
  확인: [파일:라인 — 확인 내용] × 3개 이상
  반론: [깨질 수 있는 시나리오 1개 이상]

Pass 2 (Architect): ✅ N건 / 🔴 N건 / 🟠 N건 / N/A N건
  ...

판정: 완료 가능 / 수정 필요
────────────────────────────────────
```

### 6.5 PASS 기준

- 모든 Pass CRITICAL 0건
- MAJOR 는 즉시 수정 또는 다음 step 명시 이월
- 0건 보고 시 실제 확인 증거 3개+ 필수
- 반론 (Devil's Advocate) 최소 1개 이상

---

## 7. Layer 4 — 5-페르소나 기술부채 심층 리뷰 (Phase 마일스톤)

### 7.1 트리거

- **Phase 0/1/2/3 각 완료 시점**
- **대규모 묶음 변경 완료 시** (예: ADR 5건 + 패키지 신설 + 업그레이드 3종)

### 7.2 5 에이전트 (4-Pass 와 중복 금지)

| 에이전트               | 관점            | 핵심 질문                     |
| :--------------------- | :-------------- | :---------------------------- |
| `refactoring-expert`   | 코드 품질 부채  | "6개월 뒤 이 코드가 버틸까?"  |
| `performance-engineer` | 런타임 부채     | "10K 사용자에서 뭐가 터지나?" |
| `quality-engineer`     | 테스트 부채     | "프로덕션에서 뭐가 물릴까?"   |
| `backend-architect`    | 데이터·API 부채 | "2년차에 뭐가 아플까?"        |
| `devops-architect`     | 운영 부채       | "새벽 3시 on-call 시나리오?"  |

### 7.3 실행

```
단일 메시지 내 Agent 5개 병렬 호출 의무
직전 4-Pass 결과 전달 → 중복 지적 금지
각 에이전트 반드시 Critical/Major/Minor + 파일:라인 증거 + Devil's Advocate 반론
```

### 7.4 통합 보고

- 파일: `.claude/reviews/phase{N}-tech-debt-{YYYYMMDD-HHMMSS}.md`
- 4-Pass 결과와 별도 관리
- 우선순위 매트릭스 도메인 책임자 보고

### 7.5 "완료" 선언 기준 (강화)

- 4-Pass CRITICAL 0건 **AND** 5-페르소나 CRITICAL 0건
- MAJOR 는 phase 종료 전 해결 또는 다음 phase 초기 태스크로 명시 이월

---

## 8. 부채 ledger 운영 (TD-NNN-N 영속 패턴)

ThePick 의 핸드오프 패턴 — 다른 프로젝트도 동일 권장.

### 8.1 부채 ID 형식

```
TD-S{NN}-{N}   — Session N 발견 부채 (TD-S40-1, TD-S40-2)
TD-VRF-{NNN}   — 검증 결정성 부채 (TD-VRF-001 batch flaky)
TD-PHASE{N}-{N}  — Phase 단위 누적 부채
```

### 8.2 영속 위치

- 매 세션 종료 시 `.jjokjipge/handoff-session-NNN.md` §3.2 후속 부채 ledger 갱신
- Phase 마일스톤 시 `docs/plans/wbs-quality-progress.md` 일괄 갱신

### 8.3 흡수 트리거

- 진산 결정 트리거 ("TD-S40-1 흡수") 시 즉시 진입
- Phase 진입 시 일괄 정리

---

## 9. 게이트 흐름 (BATCH-N 적재 1회 전체 흐름)

```
[1] 진산 트리거: "BATCH-N 적재"
        ↓
[2] verify-engine-contracts (entry) — Layer 0 PASS 의무
        ↓
[3] PDF 추출 (extract-batch-pages.py) → JSON
        ↓
[4] Knowledge Graph 합성 (Claude Code) → JSON v0.1 draft
        ↓
[5] schema-validator + graph-integrity — Layer 1 PASS 의무
        ↓
[6] LOCAL D1 dry-run (in-memory) — Layer 1 PASS 의무
        ↓
[7] page_ref 범위 + 변수 매핑 — Layer 2 자동 PASS 의무
        ↓
[8] json-to-sql-batch.py → batch-N-insert.sql
        ↓
[9] wrangler d1 execute (staging) — 진산 GO 트리거 의무
        ↓
[10] staging 검증 SELECT 4건 + orphan 0 — Layer 1 production PASS
        ↓
[11] wrangler d1 execute (production)
        ↓
[12] production 검증 SELECT 4건 + status='draft' 위반 0 — Layer 1 production PASS
        ↓
[13] handoff-NNN.md + batch-loadmap.md 갱신
        ↓
[14] verify-engine-contracts (exit) — Layer 0 PASS 재확인
        ↓
[15] 다음 BATCH 진산 트리거 대기 (또는 Level 3 역검증 BATCH 누적 후)
```

**Layer 3 (학습 효과 역검증)** 은 모든 BATCH 누적 후 시점.

---

## 10. 다른 프로젝트가 본 게이트 체계를 도입할 때

### 10.1 의무 의식

- 본 5 layer 는 **선택 X / 의무 O**. 일부 layer 만 적용 시 정확성·신뢰성 보장 깨짐.
- "BATCH 적재 잘 됐다" 의 정의 = **Layer 1+2 PASS** 까지. Layer 3 = 별도 시점.
- 코드 변경 후 4-Pass 면제 = **데이터 영역만**. 코드 영역은 자가 리뷰 금지 의무.

### 10.2 첫 BATCH 적재 시 게이트 체크리스트

```markdown
- [ ] verify-engine-contracts (entry) PASS
- [ ] schema-validator PASS (0건 위반)
- [ ] graph-integrity PASS (orphan / broken / cycles 0건)
- [ ] LOCAL D1 dry-run PASS (멱등 INSERT)
- [ ] page_ref 범위 검증 PASS
- [ ] 산식 변수명 매핑 검증 PASS
- [ ] (산식 영역) Golden Test 100% 일치
- [ ] staging 검증 SELECT 4건 PASS + orphan 0 + status='draft' 위반 0
- [ ] production 검증 SELECT 4건 PASS + 동일
- [ ] handoff 영속 + batch-loadmap 갱신
- [ ] verify-engine-contracts (exit) PASS
```

11개 항목 모두 PASS 시 BATCH-N 완료.

### 10.3 위반 시그널 자동 감지

- `quality-gate.sh` hook (PreToolUse Edit/Write) — `any` / `console.log` / `TODO` / 빈 catch 자동 감지
- `review-gate.sh` hook (Stop) — 코드 변경 감지 시 4-Pass 리뷰 미실행 차단
- `mark-review-complete.sh` — 리뷰 완료 명시 호출

다른 프로젝트도 동일 hook 도입 권장 (`.claude/hooks/` 복사).

---

본 quality-gates.md 는 검증 운영 마스터. 실제 구현 코드는 `packages/quality/src/` + `scripts/verify-engine-contracts.ts` 참조.
