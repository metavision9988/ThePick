# 4-Pass + 5th Persona 통합 리뷰 — Phase 2A Step 2 Vectorize Table 인덱싱

> **세션**: 057 / 2026-05-08 KST
> **대상**: table_structures(20) + table_headers(167) + table_cells(246) = 433 노드 인덱싱
> **리뷰 방식**: 5 독립 에이전트 병렬 (silent-failure-hunter / system-architect / security-engineer / quality-engineer / pr-review-toolkit:code-reviewer)
> **자가 리뷰 0건** (auto-review-protocol §"규칙 0" 정합)

---

## 0. 통합 판정 영속

| 분류        | Pass 1 (Surgeon) | Pass 2 (Architect) | Pass 3 (Advocate) | Pass 4 (Contract) | 5th (Code Reviewer) | 합계   |
| ----------- | ---------------- | ------------------ | ----------------- | ----------------- | ------------------- | ------ |
| Critical 🔴 | 0                | 0                  | 0                 | 0                 | 0                   | **0**  |
| Major 🟠    | 3                | 3                  | 2                 | 2                 | 1                   | **11** |
| Minor 🟡    | 3                | 2                  | 3                 | 2                 | 2                   | **12** |

**판정**: ✅ **CRITICAL 0건 → "완료" 선언 가능 조건 충족** (auto-review-protocol §"규칙 4" 정합).

**본 step 즉시 흡수 (6건 commit 직전 수정 PASS)**:

- ★ P1-M1 + 5th-MAJOR-1 — `parsePageRefToInt` DRY 위반 + table-fetcher console.warn 부재 → `apps/api/src/vectorize/page-ref.ts` 단일 출처 모듈 추출 + `parsePageRefWithWarn` 운영자 detect 통합
- ★ P1-M2 — `composeValueRepr` default + `merged_ref` silent fallback → 즉시 `throw` (schema CHECK 확장 시 컴파일/런타임 차단)
- ★ P1-M3 — `value_text` 빈 fallback `(빈 값)`/`(산식 미정의)`/`(중첩 표 미정의)` silent → `console.warn` (cellId/value_type 포함 운영자 detect)
- ★ P2-A1 — `fetchNodesBySource` switch 비-exhaustive → `default: throw new Error(...satisfies never)` (BootstrapSource enum 확장 시 컴파일 차단)
- ★ P3-M1 — `BootstrapBodySchema` `status + table_*` 무음 무시 → `z.refine` 으로 400 reject (운영자 misconfig 차단)
- ★ P3-M2 — `D1_QUERY_FAILED` `details: msg` SQL 구조 노출 → production/staging 에서 SQLite 에러 코드만 surface, dev/test 만 cause.message 노출 + `console.error` 운영자 visibility

**MAJOR carry-over (별도 step)**:

- P2-A2 — `TableNodeMetadata` SoT 통합 (NodeForVectorize 제네릭화 또는 VectorizeUpsertMetadata optional 필드 추가) — 별도 typing 리팩토링 step
- P2-A3 — D1 JOIN 인덱스 보강 (`idx_table_headers_parent`, `idx_table_cells_formula_id`, `idx_table_cells_nested_table_id`) — migration 0027+ 별도 step (현 433 rows 정상, 1000+ 확장 시 회귀)
- P4-M1 — `routes.ts` dispatcher 단위 테스트 부재 (직전 P4-M2 carry-over 3회째) → ★ Phase 2A Step 3 진입 전 **선결 의무**
- P4-M2 — value_type fallback 경계값 단위 테스트 → 본 step **흡수 PASS** (table-fetcher.test.ts +5건 신규 16건 PASS)

**MINOR carry-over** (12건, 다음 step 흡수 또는 운영 모니터링):

- P1-m1 ExamId `as string` 캐스팅 (영향 0)
- P1-m2 dispatcher default `assertNever` 패턴 (P2-A1 흡수와 동일)
- P1-m3 D1Reader.bind unknown[] 타입 안전성
- P2-m1 status filter ignored 명시 응답 (P3-M1 흡수와 묶음 처리됨)
- P2-m2 함수 docstring Year 2 zero-cost 명시
- P3-m1 빈 셀 인덱싱 SKIP (정책 결정 필요 — 메타데이터만 등록 vs row/col label 만 임베딩)
- P3-m2 ★ ADMIN_API_TOKEN transcript 노출 → **세션 057 종료 직후 rotate 의무 carry-over**
- P3-m3 TABLE 노드 `parent_table_id=row.id` self-ref 정합성 검토
- P4-m1 plan §5 Gate 5.5 footnote (cell-level 5/5 + S1 carry-over)
- P4-m2 schema-drift 정합 단위 테스트 (`VALUE_TYPE_LABELS` ↔ migration 0024 SQL grep)
- 5th-m1 optional spread `''` 빈 문자열 누락 (현 데이터 영향 0)
- 5th-m2 source_node_description 200자 multibyte 단어 경계 절단

---

## 1. Pass 1 (Silent Failure Hunter) — 본 step 흡수 PASS

**관점**: "이 코드 단독으로 silent skip / fallback / 데이터 손상 경로가 있는가?"

### Major 3건 → 본 step 즉시 흡수

- **MAJOR-1** `table-fetcher.ts:136-140` `parsePageRefToInt` 운영자 detect 부재 → ★ `page-ref.ts` `parsePageRefWithWarn` 통합 → table-fetcher buildTable\*Node 3개 함수 모두 console.warn (nodeId 포함) 출력
- **MAJOR-2** `composeValueRepr` default 분기 silent `(value_type=foo)` 인덱싱 → ★ `throw` 로 변경 (schema CHECK 확장 시 즉시 실패)
- **MAJOR-3** `value_text` 빈 fallback `(빈 값)` silent → ★ `console.warn` 출력 (cellId/value_type 포함)

### ✅ 확인 (5건)

1. table-fetcher.ts:191/265/358 `result.results ?? []` 빈 배열 폴백 + routes.ts:131-147 try-catch → silent skip 0건
2. table-fetcher.ts:165/231/311 `requireExamId` Hard Rule 16 runtime guard 3 함수 일관 + test 2건 검증 PASS
3. table-fetcher.ts:351 `WHERE tc.value_type != 'merged_ref'` SQL + test 검증 (P1-M2 흡수 후 다중 방어 완성: SQL WHERE + composeValueRepr throw)
4. routes.ts:131-152 fetchNodesBySource try-catch + Hard Rule 16 throw 모두 D1_QUERY_FAILED surface
5. table-fetcher.ts:142 joinBreadcrumb null/empty parent 자동 배제 → level 1/2/3 일관

### 🎯 Devil's Advocate (반론)

**P1-M2 흡수 전 시나리오**: 향후 `value_type='range'` 추가 + WHERE 절 미업데이트 시, default 분기로 `(value_type=range)` 가 246+ 셀에 silent 인덱싱되어 임베딩 공간에 노이즈 클러스터 생성 → smoke test 9/10 PASS 안에서 가려짐.
**흡수 후**: ★ 즉시 throw → caller (routes.ts dispatcher try-catch) 가 D1_QUERY_FAILED surface → 운영자 즉시 detect.

---

## 2. Pass 2 (Architect) — 본 step 흡수 PASS

**관점**: "다른 모듈/정책과 만났을 때 깨지는가?"

### Major 3건 → 1건 흡수 + 2건 carry-over

- **MAJOR-A1** `fetchNodesBySource` switch 비-exhaustive (4 case + default 부재) → ★ 본 step 흡수 (`default: const _exhaustive: never = source; throw new Error(...)`)
- **MAJOR-A2** `TableNodeMetadata` SoT 부재 (table-fetcher 확장 필드 vs upserter NodeForVectorize 정의 분리) → carry-over (별도 typing 리팩토링)
- **MAJOR-A3** D1 cells JOIN 12개 (433 rows 정상, 1000+ 확장 시 회귀) → carry-over (migration 0027+ 인덱스 보강)

### ✅ 확인 (9건)

1. TRUTH_WEIGHTS 정합 (TABLE=8/ROW_HEADER=COL_HEADER=7/CELL=6) ↔ types.ts:68-80 일치
2. NodeType 리터럴 정합 (`'TABLE'/'ROW_HEADER'/'COL_HEADER'/'CELL'`) ↔ types.ts:20-23 union 일치
3. Hexagonal 임포트 방향 — table-fetcher.ts → @thepick/shared + ./upserter.js + ./page-ref.js 만 (Workers infra 직접 참조 0건)
4. D1Reader 격리 (mock 호환 + 실 D1Database 시그니처 호환)
5. Hard Rule 17 정합 — 'son-hae-pyeong-ga-sa' 리터럴 신규 코드 0건 (test fixture EXAM_IDS 경유)
6. ADR-004 §3 메타데이터 필수 키 모두 충족
7. ADR-032 ID prefix 정합 (TBL/TROW/TCOL/TCELL) — schema CHECK 강제
8. merged_ref SQL WHERE 차단 (ADR-032 primary cell 중복 차단 정책)
9. Idempotent upsert (upserter.ts:233 — 본 step 재호출 시 동일 ID 덮어쓰기)

### 🎯 Devil's Advocate

**시나리오 1**: nested_table cell 의 부모-자식 순환 인덱싱 — schema CHECK 가 `id != nested_table_id` 자기 참조만 막을 가능성 (순환 미차단) → BATCH 적재 단(별도 step) 무결성 검증 carry-over.
**시나리오 2**: D1 prepared statement 재사용 vs Workers isolate 1-request scope → 단일 bootstrap full sweep 시 N× 컴파일 오버헤드 (현 batch=50 운영 시 무관).

---

## 3. Pass 3 (Advocate / Security) — 본 step 흡수 PASS

**관점**: "수험생/공격자/운영자 셋 다 만족하는가?"

### Major 2건 → 모두 본 step 흡수

- **MAJOR-1** `BootstrapBodySchema` status + table\_\* 무음 무시 → ★ 본 step 흡수 (`z.refine` 으로 400 reject + clear message + staging 검증 PASS)
- **MAJOR-2** `D1_QUERY_FAILED details: msg` SQL 구조 노출 → ★ 본 step 흡수 (production/staging 은 SQLite 에러 코드만 surface, dev/test 만 cause.message + console.error)

### ✅ 확인 (6건)

1. table-fetcher.ts:147-152 requireExamId Hard Rule 16 enforcement (test 2건)
2. table-fetcher.ts:189/263/356 모든 사용자 입력 (limit/offset) `.bind()` parameter binding — SQL injection 0
3. SQL WHERE merged_ref 차단 + composeValueRepr throw (다중 방어)
4. routes.ts:113 `app.use('*', requireAdminToken<...>())` sub-router 전역 적용 → table\_\* 도 동일 인증
5. metadata spread (`...(row.lv1 ? {} : {})`) → null 컬럼 키 미포함 (P3-M2 흡수 정합)
6. value_text 교재 표 데이터 (사용자 PII 부재). admin G5.5 이후 사용자 데이터 셀 추가 시 재검토 carry-over

### 🎯 Devil's Advocate

**시나리오**: schema CHECK 미충족 상태로 직접 INSERT (admin G5.5 향후 LLM 자동 적재 + draft) 시 `merged_refs` 오타 → WHERE 절 통과 → primary cell 과 함께 중복 인덱싱.
**흡수 후 P1-M2**: composeValueRepr `merged_ref` case throw + default throw → application-side 이중 방어 완성.

---

## 4. Pass 4 (Contract / Quality) — 본 step 흡수 PASS

**관점**: "plan/ADR 대로 만들었는가? 테스트 부채는?"

### Major 2건 → 1건 흡수 + 1건 carry-over

- **MAJOR-1** `routes.ts` dispatcher 단위 테스트 부재 (직전 P4-M2 carry-over 3회째) → carry-over **★ Phase 2A Step 3 진입 전 선결 의무** (Hono mock + 4 source 분기 + 401 admin token)
- **MAJOR-2** value_type fallback 경계값 단위 테스트 → ★ 본 step **흡수 PASS** (table-fetcher.test.ts +5건: merged_ref throw, default throw, text empty warn, formula null warn, nested_table null warn)

### ✅ 확인 (10건)

1-10. plan §2 텍스트 합성 / §2.5 merged_ref SKIP / §3.1 JOIN 명세 / TRUTH_WEIGHTS 정합 / status 부모 추론 / Hard Rule 16 강제 / Hard Rule 17 grep / 빈 데이터 경계 / Year 2 zero-cost — 모두 PASS (자세한 file:line 영속).

### 🎯 Devil's Advocate

**시나리오**: ADR-033 등 향후 마이그레이션 0027 진입 시 `value_type='range'` 추가 → composeValueRepr default silent fallback.
**흡수 후 P1-M2 + P4-M2**: ★ default throw + 단위 테스트 (`unsupported value_type='range'` throw 검증) → schema-drift 컴파일/런타임 양쪽 차단.

---

## 5. 5th Persona (Code Reviewer)

**관점**: 종합 코드 품질 + Pass 1~4 보강

### Major 1건 → 본 step 흡수

- **MAJOR-1** `parsePageRefToInt` DRY 위반 (routes.ts vs table-fetcher.ts 시그니처 불일치) → ★ 본 step 흡수 (`apps/api/src/vectorize/page-ref.ts` 단일 출처 + 양쪽 모듈 import)

### ✅ 확인 (8건)

1. `any` 0건 (table-fetcher.ts 416 LOC, readonly 명시)
2. 하드코딩 0건 (PATTERN_TYPE_LABELS / VALUE_TYPE_LABELS 상수화 OK + truth_weight TRUTH_WEIGHTS 경유)
3. Hard Rule 16 강제 (3 fetcher 일관 + 테스트)
4. 빈 catch 0건 (table-fetcher 자체 try-catch 0건 — caller routes.ts 통합)
5. Workers 호환 (fs/path/Buffer/process 미사용)
6. 테스트 의미성 (16건, SQL 정규식 검증, mock D1Reader captured queries)
7. JSDoc 완성도 (책임/비스코프/근거 영속)
8. L3 영역 미침범 (formula-engine/constants/ontology-registry 변경 0건)

### 🎯 Devil's Advocate

**시나리오**: source_node_description 200자 slice 가 multibyte 한국어 단어 경계를 깰 위험 → MINOR carry-over (현 데이터 영향 0, 250자+ 노드 회귀 케이스 추가 권장).

---

## 6. 회귀 검증 영속

### 6.1 단위 테스트

- apps/api: **333 → 349 PASS** (+16: page-ref 11 + table-fetcher 5건 추가)
- vectorize 디렉토리: 24 → **40 PASS** (upserter 13 + table-fetcher 16 + page-ref 11)

### 6.2 staging+production 회귀 0

- T3 `고추 병충해 2등급` staging+production 동등 score=0.7631 (TCELL-015-02-03) — pre-fix vs post-fix 일치
- T5 `무화과 8월 잔여수확량 산식` production score=0.7737 (TCELL-013-01-02) — 일치
- P3-M1 schema refinement 동작 검증 (status + table_cells → 400 + 명확한 메시지)

### 6.3 post-fix verify run1 ≡ run2

- summary: `{total:8, pass:7, fail:0, skip:1, overallStatus:"PASS"}`
- diff (timestamp 제외) = 0 줄 → deterministic 안정 PASS
- 영속: `.claude/reports/sprint1-step5-5-verify-session-057-post-fix-run{1,2}.json`

---

## 7. 판정 (auto-review-protocol §"규칙 4" 정합)

- **CRITICAL 0건** → "완료" 선언 가능 조건 충족 ✓
- **MAJOR 11건 중 6건 즉시 흡수 + 5건 carry-over 명시** ✓
- **MINOR 12건 carry-over** (다음 step 또는 운영 모니터링)

**Phase 2A Step 2 (table\_\* Vectorize 인덱싱) 완료 가능**.

---

## 8. 차세션 우선순위 (carry-over 영속)

1. ★★★ **P4-M1** routes.ts dispatcher 단위 테스트 (Hono mock 기반) — Phase 2A Step 3 진입 전 선결 의무
2. ★★ **P3-m2** ADMIN_API_TOKEN transcript 노출 → staging/production rotate (`wrangler secret put ADMIN_API_TOKEN --env <env>`) 의무
3. ★ **P2-A2** TableNodeMetadata SoT 통합 (typing 리팩토링)
4. ★ **P2-A3** D1 JOIN 인덱스 보강 (migration 0027+) — 현 433 rows 무관, Year 2 확장 시 의무
5. **MINOR 12건** 다음 step 흡수 또는 운영 모니터링

---

**리뷰 작성**: Claude (Opus 4.7 1M context) — Session 057 Phase 2A Step 2 종착
**5 독립 에이전트**: silent-failure-hunter / system-architect / security-engineer / quality-engineer / pr-review-toolkit:code-reviewer
**판정 영속**: 2026-05-08 KST 15:20 — Phase 2A Step 2 (table\_\* Vectorize 인덱싱 433 노드, vectorCount 1227 staging+production) "완료" 선언 가능
