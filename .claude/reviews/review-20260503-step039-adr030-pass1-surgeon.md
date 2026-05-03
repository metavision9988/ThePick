# Pass 1 SURGEON — Step 039 ADR-030 + 0019 회귀 fix 단독 리뷰

- **세션:** 039 (2026-05-03)
- **스코프:** 차세션 진입 직후 verify -17 회귀 (batch -13, api -4) → fix 한 변경 단독 검토
- **리뷰 방식:** 독립 메인 컨텍스트 (Pass 1 한정 단독). 다른 Pass 는 별도 리뷰.
- **리뷰 범위:** 본 세션 변경 15 파일 + 연관 3 파일 (migrations 0010/0018, pipeline.ts, scenarios.test.ts seedKnowledgeNode)
- **변경 commit:** `73426e9` feat(content): ADR-030 + 0019 마이그레이션
- **관점:** "이 코드 단독으로 터지는 경로가 있는가?" — Null/Undefined / Async / 경계값 / 빈 catch / Graceful Degradation / silent failure / 산식 정밀도

---

## 0. 요약 매트릭스

| 분류           | 건수 | 분포                                                                   |
| -------------- | ---- | ---------------------------------------------------------------------- |
| 🔴 CRITICAL    | 1    | C-1 (SCENARIO_MIGRATIONS dual-schema dormancy)                         |
| 🟠 MAJOR       | 4    | M-1 / M-2 / M-3 / M-4                                                  |
| 🟡 MINOR       | 5    | m-1 / m-2 / m-3 / m-4 / m-5                                            |
| ✅ PASS (확인) | 8    | (확인 항목 본문 §6 참조)                                               |
| N/A            | 3    | (Async await 누락 / Workers fs/path / Vectorize 임베딩 — 본 변경 무관) |

**Devil's Advocate 1건 제시**: §7 (verify run3 회귀 시나리오)
**판정:** 🟠 **수정 필요** (CRITICAL 1 / MAJOR 4 → "완료" 선언 차단)

---

## 1. 🔴 CRITICAL-1 — SCENARIO_MIGRATIONS 0019 누락 = dual-schema dormancy

### 위치

- `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:38-57` (SCENARIO_MIGRATIONS 배열)
- 영향 받는 파일:
  - `apps/api/src/__tests__/scenarios.test.ts:820-829` (`seedKnowledgeNode` — book_page/pdf_page 미주입)
  - `apps/api/src/__tests__/scenarios/cha-01-d1-disconnect.test.ts:41` (createD1FromSqlite 사용)

### 증거

SCENARIO_MIGRATIONS 배열은 0001~0018 까지만 명시 (line 38-57). **0019 부재**:

```typescript
const SCENARIO_MIGRATIONS = [
  '0001_initial_schema.sql',
  ...'0018_enforce_draft_only_insert.sql',
  // ← 0019 누락
];
```

반면 `createD1FromAllMigrations()` (line 95-100) 는 readdirSync 로 모든 .sql 자동 로드 → 0019 포함. Hard Rule 13 테스트 (`hard-rule-13-draft-only.test.ts`) 는 후자를 사용하므로 정상 fix 됨. 그러나 `scenarios.test.ts:820-829` `seedKnowledgeNode()` 는 `createD1FromSqlite()` (전자) 를 사용하므로 0019 미적용 환경에서 동작:

```typescript
function seedKnowledgeNode(nodeId: string): void {
  ctx.raw
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status)
       VALUES (?, 'CONCEPT', '시나리오 테스트 노드', '999', 2026, 5, 'draft')`,
    )
    .run(nodeId); // book_page/pdf_page 미주입 — SCENARIO_MIGRATIONS 에 0019 없으므로 PASS
}
```

### 왜 CRITICAL 인가

1. **production schema 와 test schema 가 영구적으로 분리**: 운영 D1 은 0019 적용 (진산님 wrangler apply 후), test SCENARIO_MIGRATIONS 는 0019 미적용. → 운영에서 터지는 INSERT 가 test 에서 안전 PASS.
2. **silent failure 설계**: 누군가 SCENARIO_MIGRATIONS 에 0019 를 추가하는 순간 `seedKnowledgeNode` 깨짐 → 시나리오 테스트 다수 회귀. 본 PR 에서는 의도적으로 미추가했으므로 "완료" 처럼 보이나 실제로는 ADR-030 의 invariant 가 시나리오 계층에서 뚫림.
3. **본 회귀 전조와 동일 패턴**: 직전 세션 회귀가 "0019 자동 적용 + INSERT 테스트 미동기" 였다. 본 fix 는 batch/parser 는 동기화했으나 api scenarios 는 미동기 → **두 번째 회귀 잠복**.
4. **Hard Rule 13 자체 위반**: ADR-030 `book_page/pdf_page NOT NULL` invariant 가 시나리오 테스트 환경에서 영구 미적용.

### 숨겨진 에러

- 시나리오 테스트가 운영 환경 schema 와 다른 schema 를 사용 → 시나리오 통과해도 운영에서 터질 수 있음
- 개발자가 "scenarios PASS = 안전" 판단 시 misleading
- 향후 SCENARIO_MIGRATIONS 에 0019 추가 시 약 N 개 시나리오 일괄 회귀 (회귀 폭발)

### 수정 권고

**Option A (권장):** SCENARIO_MIGRATIONS 에 0019 추가 + `seedKnowledgeNode` 4 컬럼 보강

```typescript
const SCENARIO_MIGRATIONS = [
  ...,
  '0018_enforce_draft_only_insert.sql',
  '0019_knowledge_nodes_page_chapter_meta.sql',  // ★ 추가
];

function seedKnowledgeNode(nodeId: string): void {
  ctx.raw
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
       VALUES (?, 'CONCEPT', '시나리오 테스트 노드', '999', 2026, 5, 'draft', 1, 1)`,
    )
    .run(nodeId);
}
```

**Option B (이연):** SCENARIO_MIGRATIONS 를 즉시 제거하고 모든 시나리오 테스트가 `createD1FromAllMigrations()` 를 강제 사용 → 본질적으로 dual-schema 회수 (장기 권고)

본 PR 에서는 Option A 즉시 적용 의무. Option B 는 별도 ADR 후 적용.

---

## 2. 🟠 MAJOR-1 — pipeline.integration.test.ts 실패 경로 bad contract 의 silent ambiguity

### 위치

`apps/batch/src/__tests__/pipeline.integration.test.ts:255-298` ("invalid contract → Stage 3 FAIL" 테스트)

### 증거

```typescript
const badContract: KnowledgeContract = {
  nodes: [
    {
      id: 'CONCEPT-001',
      type: 'UNKNOWN_TYPE', // 의도적 위반
      title: '',
      content: '',
      truth_weight: 5,
      source_page: 403,
      // ← book_page/pdf_page 누락 (ADR-030 위반)
    },
  ],
  ...
};

expect(byName.batch_structurize.status).toBe('failed');
```

### 문제

1. 의도된 fail 사유: `INVALID_NODE_TYPE` (UNKNOWN_TYPE)
2. 실제 fail 사유: `INVALID_NODE_TYPE` + `MISSING_REQUIRED_FIELD` (title/content) + `MISSING_SOURCE_PAGE` × 2 (book_page/pdf_page) — **4 가지 위반 모두 발화**
3. 테스트는 "어떤 사유로든 fail" 만 검증 → 미래 schema-validator 가 `INVALID_NODE_TYPE` 검출을 잃어도 (ADR-030 검증으로) PASS 통과 = silent failure
4. ADR-030 추가 후 본 contract 는 "ADR-030 검증" 으로 fail 하면서도 외부적으로는 "INVALID_NODE_TYPE 으로 fail" 처럼 보임 — 디버깅 시 misleading

### 숨겨진 에러

- schema-validator 의 `INVALID_NODE_TYPE` 검출 회귀가 본 테스트로 안 잡힘
- `INVALID_NODE_ID_PATTERN` 회귀도 마찬가지
- 향후 schema-validator 우선순위 변경 시 본 테스트가 false positive

### 수정 권고

1. badContract 에 `book_page: 1, pdf_page: 1` 명시 추가 (ADR-030 fail 경로 차단)
2. fail 사유 명시 검증 추가:

```typescript
expect(byName.batch_structurize.status).toBe('failed');
expect(byName.batch_structurize.message).toMatch(/INVALID_NODE_TYPE/);
```

---

## 3. 🟠 MAJOR-2 — schema-validator chapter/section 빈 문자열 처리의 trim() 정책 불일치

### 위치

`packages/parser/src/schema-validator.ts:330-349` (chapter/section validation)

### 증거

```typescript
if (node.chapter !== undefined && (typeof node.chapter !== 'string' || node.chapter.trim() === '')) {
  errors.push(err(`${prefix}.chapter`, 'MISSING_REQUIRED_FIELD', ...));
}
```

draft-loader.ts:340 의 INSERT path:

```typescript
node.chapter ?? null,  // undefined → null. 빈 문자열 ""은 ""그대로 INSERT 시도
```

### 문제

1. schema-validator 는 빈 문자열 `""` 와 공백 `"   "` 를 거부 (trim) → 정상
2. 그러나 LLM 이 chapter 를 `null` 직접 반환하는 경우 (`{"chapter": null, ...}`):
   - `node.chapter !== undefined` → `null !== undefined` 는 **true** → typeof null = 'object' → 'string' 아니므로 error push
   - 즉 명시적 null 도 거부 → "법령 노드는 NULL 허용" 의도 위반
3. 의도: "있으면 non-empty string, 없으면 omit" — 그러나 JSON 에서 omit 과 null 은 종종 혼용 (특히 LLM 출력)

### 숨겨진 에러

- LLM 이 `{"chapter": null}` 반환 시 batch_structurize FAIL → BATCH 적재 차단
- 진짜 법령 노드 (`LAW-NNN`) 가 chapter null 명시 시 거부
- DB 트리거 (0019) 는 chapter null 허용하므로 schema-validator 와 정책 mismatch

### 수정 권고

```typescript
// undefined OR null = 통과 (NULL 허용 정책 정합)
// 명시적 string 타입이고 trim() === '' 일 때만 거부
if (node.chapter !== undefined && node.chapter !== null) {
  if (typeof node.chapter !== 'string' || node.chapter.trim() === '') {
    errors.push(err(`${prefix}.chapter`, 'MISSING_REQUIRED_FIELD', ...));
  }
}
```

---

## 4. 🟠 MAJOR-3 — book_page/pdf_page 경계값 (0, 음수, NaN, Infinity, float) 테스트 부재

### 위치

- `packages/parser/src/__tests__/schema-validator.test.ts` (전체 testsuite)
- `apps/batch/src/__tests__/loader.test.ts:162-181` (source_page 경계값 3건만 존재)

### 증거

schema-validator.ts:294-327 에서 `isValidSourcePage` 가 source_page / book_page / pdf_page 3 필드 모두에 적용되나, **테스트는 source_page 만 검증**:

```typescript
// loader.test.ts:162
it('node 에 source_page=0 → DraftLoadError (validate phase)', async () => {
  const c = minimalContract();
  c.nodes[0].source_page = 0;  // book_page/pdf_page 경계값 미검증
  ...
});
```

book_page/pdf_page 의 경계값 (0, -1, NaN, Infinity, 3.14, "100" string) 에 대한 테스트 0건. grep 검증: `grep -rn "book_page.*[=:]\s*-\|book_page.*[=:]\s*0\b\|book_page.*[=:]\s*NaN" → 0건`.

### 문제

1. schema-validator 회귀 시 (예: `Number.isInteger` 체크 누락) book_page=3.14 통과 → DB 트리거 (INTEGER 컬럼) 가 강제 변환 → 데이터 무결성 손상
2. book_page=NaN / Infinity 가 D1 트리거를 우회할 가능성 (트리거는 `IS NULL` 만 체크)
3. preValidate (draft-loader.ts:206) 는 source_page 만 검증, book_page/pdf_page 는 schema-validator 위임 → schema-validator 회귀 시 draft-loader 도 같이 깨짐 (이중 방어선 부재)

### 숨겨진 에러

- LLM 이 `{"book_page": 396.5}` 반환 시 schema-validator 회귀로 통과 → DB INSERT 시 SQLite type affinity 로 396 변환 → silent corruption
- `{"book_page": NaN}` 시 JSON.parse 가 거부 (정상) but `{"book_page": "396"}` (string) 은 schema-validator 통과 여부 미검증

### 수정 권고

1. schema-validator.test.ts 에 book_page/pdf_page 경계값 테스트 6건 추가:

```typescript
it.each([
  ['book_page', 0],
  ['book_page', -1],
  ['book_page', NaN],
  ['book_page', Infinity],
  ['book_page', 3.14],
  ['book_page', '100' as unknown as number],
])('rejects %s = %s', (field, value) => { ... });
```

2. draft-loader.ts preValidate 에 book_page/pdf_page 이중 방어선 추가 (Pass 3 M-2 패턴 복제)

---

## 5. 🟠 MAJOR-4 — DB batch insert error 시 trigger 메시지 정보 손실

### 위치

`apps/batch/src/loader/draft-loader.ts:150-155`

### 증거

```typescript
try {
  await db.batch(all);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  throw new DraftLoadError(`D1 batch insert failed: ${msg}`, 'batch');
}
```

### 문제

1. 0019 트리거 ABORT 메시지 (`'ADR-030 violation: knowledge_nodes INSERT requires book_page ...'`) 가 D1 batch error 에 포함되긴 하나, **어떤 statement 가 실패했는지 정보 없음**
2. `failedStatement?: string` 필드가 DraftLoadError 클래스에 정의되어 있으나 (line 84) batch 경로에서는 미주입 → 디버깅 시 어떤 노드가 실패했는지 추적 불가
3. D1 batch 의 partial commit 동작은 NG-1 명시 SKIP 이라 가정 (Cloudflare 보증) — but 실패한 노드 ID 는 알 수 있어야 함
4. 위반 시 운영 BATCH-1 대용량 적재 (예: 200 nodes) 중 1건 실패 → 어느 노드인지 모름 → 전체 재시도 + 진단 부담

### 숨겨진 에러

- 0019 trigger fire 시 "어떤 INSERT 의 어떤 컬럼" 추적 불가
- 0010/0018 page_ref trigger fire 시 동일
- 0016 backfill trigger 우회 시 동일

### 수정 권고

batch error 시 노드 인덱스 / id 컬렉션 로깅:

```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  // batch 내부에서 어떤 statement 실패했는지 디버깅 단서 제공
  const sampleIds = contract.nodes.slice(0, 5).map(n => n.id).join(',');
  throw new DraftLoadError(
    `D1 batch insert failed: ${msg}. Affected batch: ${all.length} statements (sample node IDs: ${sampleIds}...)`,
    'batch',
  );
}
```

또는 batch 를 작은 chunk 로 분할 후 chunk 단위 try-catch 로 실패한 chunk 식별. 단 chunk 분할은 atomicity 손상 위험 → ADR 결정 필요.

---

## 6. 🟡 MINOR 5건

### m-1: chapter/section validation message 의 사용자 가이드 부족

- **위치:** `schema-validator.ts:335, 345`
- **문제:** "Use undefined for nodes without chapter (e.g., LAW-NNN)" — JSON 에는 undefined 가 없음 (omit 또는 null). 메시지가 JS 개념을 노출.
- **권고:** "omit the field" 또는 "exclude the property" 로 변경

### m-2: ADR-030 문서의 "다음 세션 처리" §5 진행 상태 미명시

- **위치:** `docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md:188-201`
- **문제:** Implementation Plan §5 #2/#3/#5/#6/#9 가 "다음 세션" 으로 명시 — 본 세션이 #2/#3 만 처리. #4 (extract-batch-pages.py v2) / #5 (raw text 재추출) / #9 (batch-loadmap.md 정합화) 는 미진행. ADR 본문에 "처리 진척" 갱신 부재.
- **권고:** ADR §5 표에 "✅ 본 세션 완료" / "⏭️ 다음 세션 이월" 컬럼 추가

### m-3: pipeline.ts:976 2차 검증의 메시지가 첫 에러만 노출

- **위치:** `apps/batch/src/pipeline.ts:976-982`
- **문제:** validateKnowledgeContract 가 모든 에러 수집하나 message 는 `errors[0]` 만 노출 → 본 ADR-030 도입으로 에러 수가 늘어났는데 첫 에러만 보여서 (예: book_page MISSING) 다른 에러 (pdf_page MISSING) 가 가려짐
- **권고:** `validation.errors.slice(0, 3).map(e => `${e.path}:${e.code}`).join(', ')` 형태

### m-4: hard-rule-13-draft-only.test.ts 의 book_page=1, pdf_page=1 의미 부족

- **위치:** `apps/api/src/__tests__/scenarios/hard-rule-13-draft-only.test.ts:37, 50, 63, 75`
- **문제:** book_page/pdf_page 에 의미 없는 `1, 1` 사용 → ADR-030 의도 (본문/PDF offset) 미반영. 향후 코드 리뷰어가 "왜 1 인가?" 혼동
- **권고:** 주석으로 명시 ("// 0018 트리거 검증 목적 — 0019 trigger 는 의도적 우회") 또는 의미 있는 `100, 107` 사용

### m-5: source_page 필드 deprecated 명시 부재

- **위치:** `packages/parser/src/schema-validator.ts:42-43` (KnowledgeContractNode.source_page JSDoc)
- **문제:** "ADR-030 도입 후 신규 BATCH 추출은 book_page/pdf_page 를 명시 채움" — 그럼 source_page 는 legacy fallback? deprecation 정책 불명. preValidate 는 source_page 도 강제 → 둘 다 required. 향후 source_page 회수 시점 미명시.
- **권고:** ADR-030 본문 §3.2 또는 별도 ADR 에 source_page deprecation 로드맵 명시

---

## 6. ✅ 확인 완료 항목 (PASS 증거 8건)

규칙 2 (auto-review-protocol.md): 0건 보고 시 실제 확인 증거 3개+ 필수.

1. **Drizzle schema knowledgeNodes 4 컬럼 + 인덱스 2개 등록** — `apps/api/src/db/schema.ts:133-142, 174-176`
   - bookPage / pdfPage / chapter / section integer/text 정합
   - bookPageIdx + chapterIdx 가 migrations/0019 의 idx_nodes_book_page + idx_nodes_chapter 와 1:1 매칭
   - drizzle-kit drop 방지 정책 준수

2. **0019 마이그레이션 트리거 정합** — `migrations/0019_knowledge_nodes_page_chapter_meta.sql:60-72`
   - enforce_book_page_on_insert / enforce_pdf_page_on_insert
   - WHEN NEW.book_page IS NULL → RAISE(ABORT) 정상
   - chapter / section NULL 허용 정합

3. **draft-loader INSERT 컬럼 순서 + bind 17:17 일치** — `apps/batch/src/loader/draft-loader.ts:313-348`
   - SQL 17 placeholders + 'draft' literal = 18 values
   - bind 17 인자 + 컬럼 17 = 정확
   - book_page / pdf_page 순서 정합

4. **schema-validator isValidSourcePage 3 필드 적용** — `packages/parser/src/schema-validator.ts:294-327`
   - source_page (line 294) + book_page (line 306) + pdf_page (line 318) 모두 동일 헬퍼 호출
   - 양의 정수 + Number.isFinite + Number.isInteger 검증

5. **fixture batch-1-sample-extract.json 4 nodes 모두 4 필드 채움** — `apps/batch/src/fixtures/batch-1-sample-extract.json:11-67`
   - PDF p.N = 본문 p.(N-7) offset 일관 적용
   - chapter/section 정합

6. **loader.test.ts 0010+0018 trigger 우회 의도 명시** — `apps/batch/src/__tests__/loader.test.ts:217-228, 249-258`
   - book_page/pdf_page 채워서 0019 trigger 비켜가는 의도 주석 명시
   - 0010/0018 invariant 검증 의도 보존

7. **state-machine.test.ts beforeEach seed 의 book_page/pdf_page 396, 403 정합** — `apps/batch/src/__tests__/state-machine.test.ts:67-73`
   - PDF p.403 → 본문 p.396 offset 정합 (BATCH-1 정합)

8. **reproducibility-idempotency.test.ts syntheticLargeContract 40 노드 결정성 정합** — `apps/batch/__tests__/reproducibility-idempotency.test.ts:64-79`
   - book_page = pdf_page - 7 deterministic
   - source_page = pdfPage 유지 (build-source-id 기존 결정성 보존)

---

## 7. Devil's Advocate — verify run3 회귀 시나리오 (반론 의무)

verify run1 ≡ run2 deterministic PASS 가 보고되었으나, 다음 시나리오에서 회귀 가능:

### 시나리오: SCENARIO_MIGRATIONS 가 0019 를 추가한 직후 `pnpm verify` 재실행

1. 누군가 (next session Claude) 가 CRITICAL-1 fix 차원에서 SCENARIO_MIGRATIONS 에 0019 추가
2. `seedKnowledgeNode()` 가 book_page/pdf_page 미주입이라 즉시 fail
3. apps/api 시나리오 테스트 N건 회귀 (정확 카운트 미상 — `seedKnowledgeNode` caller 추적 필요)
4. verify -N 회귀 → 본 세션과 동일 패턴 재발

### 시나리오: LLM 이 chapter=null 명시 반환

1. BATCH-2~5 에서 LLM 이 법령 노드에 `{"chapter": null}` 반환
2. schema-validator MAJOR-2 (현재 코드 line 330) 가 거부
3. batch_structurize FAIL → BATCH 적재 차단
4. 진산님 manual override 또는 schema-validator 즉시 hotfix 필요

### 시나리오: book_page=Infinity (LLM hallucination)

1. LLM 이 잘못된 정수 추론으로 `{"book_page": 1e308}` 반환 (극단적 hallucination)
2. JSON.parse 통과 (number 타입)
3. `Number.isFinite(Infinity)` = false → schema-validator 거부 정상 ★ 본 시나리오 PASS
4. 단 `Number.isFinite(1.7976931348623157e308)` = true → 통과 + DB INSERT → INTEGER 컬럼 overflow 위험

### 시나리오: chapter 필드의 한글 normalization mismatch

1. LLM 이 "제１장" (전각 1) 또는 "제1 장" (공백) 반환
2. schema-validator trim() === '' 체크 통과 (non-empty string)
3. DB 에 변형된 chapter 적재 → idx_nodes_chapter 인덱스 query 시 "제1장" 검색이 miss
4. 사용자 검색 ("제1장 노드 모두 보기") 결과 누락

→ chapter normalization (전각/반각 / 공백 정규화) 정책 부재. 본 PR 범위 외이나 ADR-030 후속 의무.

---

## 8. N/A 항목 명시

규칙 2: "해당 없음" 과 "검증 완료" 구분 의무.

- **Async await 누락**: 본 변경에 신규 async path 추가 없음. queryExistingIds / batch / first 모두 await 정상.
- **Workers fs/path 사용**: 본 변경 모든 코드가 batch 환경 (Node.js) — Workers 적용 코드 없음.
- **Vectorize 임베딩**: 본 PR 범위 외. ADR-030 §5 #6 다음 세션 이월.
- **산식 정밀도**: 본 변경은 페이지 메타 (정수) — 부동소수점 무관. 단 BATCH-1 offset (PDF p.N - 7 = 본문 p.N) 산식은 정수 뺄셈으로 정밀도 안전.

---

## 9. 판정 + 후속 의무

**판정: 🟠 수정 필요**

- 🔴 CRITICAL 1건 차단: SCENARIO_MIGRATIONS 0019 누락 → "완료" 선언 차단
- 🟠 MAJOR 4건 차단: M-1/M-2/M-3/M-4 수정 후 재리뷰 의무

### 즉시 fix 의무 (본 세션 또는 차세션 entry 1순위)

1. CRITICAL-1: SCENARIO_MIGRATIONS 에 0019 추가 + seedKnowledgeNode 보강
2. MAJOR-1: pipeline.integration.test.ts badContract 에 book_page/pdf_page 명시
3. MAJOR-2: schema-validator chapter/section null 허용 정책 정합
4. MAJOR-3: schema-validator.test.ts 에 book_page/pdf_page 경계값 6건 추가
5. MAJOR-4: draft-loader batch error 메시지에 노드 ID sample 포함

### 차후 ADR 의무 (별도 plan)

- chapter normalization 정책 (전각/반각 / 공백 정규화)
- source_page deprecation 로드맵 (book_page 단일 진실 원천 전환 시점)
- SCENARIO_MIGRATIONS 회수 + createD1FromAllMigrations 단일화 (Option B)

### 본 Pass 1 단독 검증 한계 명시

- Pass 2 (Architect): packages/ 간 의존성 + Workers 제약 + Hexagonal 위반 검증 별도 필요
- Pass 3 (Advocate): 사용자 UX (chapter 표기 효율) + 보안 (book_page injection) 검증 별도 필요
- Pass 4 (Contract): ADR-030 vs 구현 재정립서 v2.0 정합 + Hard Rules 31 위반 전수 별도 필요
