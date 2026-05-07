# 4-Pass Review (Pass 3 + Pass 4) — TD-S43-1 ontology-registry FORMULA pattern 확장

리뷰 방식: 독립 에이전트 (Pass 3+4) — 자가 리뷰 아님. 메인 대화 컨텍스트 미열람 가정.
대상: `packages/parser/src/ontology-registry.json` 3줄 변경 (version 1.1.0→1.2.0, FORMULA pattern `^F-\d{2}$`→`^F-\d{2,3}$`).
리뷰 일시: 2026-05-06
리뷰 범위:

- 변경 1개: `packages/parser/src/ontology-registry.json`
- 연관 12개 (실제 열람 또는 grep 확인):
  - `packages/parser/src/ontology-registry.ts` (registry 로드 + RegExp 컴파일 + isValidFormulaId)
  - `packages/parser/src/schema-validator.ts:451-459` (FORMULA id 검증 호출)
  - `packages/parser/src/__tests__/schema-validator.test.ts:115-171` (F-NN 패턴 단위 테스트)
  - `packages/parser/src/__tests__/normalizer.test.ts` (F-01 픽스처)
  - `packages/parser/src/__tests__/batch-processor.test.ts` (F-NN 픽스처 + prompt 템플릿)
  - `packages/parser/src/__tests__/determinism.property.test.ts:111` (F-01)
  - `packages/parser/src/batch-processor.ts:113,153,160` (LLM prompt 템플릿)
  - `packages/parser/__fixtures__/claude-malformed/05-ontology-unregistered-id.json:15` (negative fixture)
  - `apps/batch/src/loader/draft-loader.ts:213-219` (이중 방어 검증, isValidNodeId 우회)
  - `migrations/0001_initial_schema.sql` + `0003_temporal_guard_not_null.sql` + `0013_active_view_and_review_decisions.sql` (D1 schema/triggers)
  - `docs/plans/batch-loadmap.md:198` (Level 1 체크리스트 — F-NN 표기)
  - `docs/architecture/ONTOLOGY.md:14,43,53` + `VERSION_MANAGEMENT.md:168` + `LLM_CONTAINMENT.md:85` + `VALIDATION_FRAMEWORK.md:30` + `engines/parser/research.md:25` + `engine-export/README.md:414` + `architecture/review/CBIV_DESIGN_DIAGRAM.md:156` + `CONTENT_BUILD_ENGINE_REDESIGN_v2.md:387` (문서 F-NN 컨벤션)
  - `docs/batch-load/batch-{2,3,4,5}/batch-N-knowledge-graph.json` (`ontology_registry_version` 메타 스탬프)
  - `.jjokjipge/handoff-session-045.md`, `handoff-session-046.md` (TD-S43-1 결정 기록)

---

## Pass 3 (Advocate): ✅ 7건 확인 / 🔴 0건 / 🟠 3건 / N/A 2건

수험생 + 공격자 + 운영자 관점.

### ✅ 확인 (PASS — 실제 코드/문서 확인)

1. **`packages/parser/src/ontology-registry.ts:69, 87-89` — RegExp 정합 (정확한 동치)**
   `^F-\d{2,3}$`는 정규식 anchor `^...$` 둘 다 살아 있고 양적 한정자 `{2,3}`이 정확하게 2 또는 3 자리만 매칭. F-1(1자리, reject), F-01(2자리, accept), F-100(3자리, accept), F-1000(4자리, reject), `XF-01`(F 앞 prefix, reject) 모두 의도대로 동작. injection 벡터 미발생 — 자유 와일드카드 `\.*` 추가 없음.

2. **`packages/parser/src/__tests__/schema-validator.test.ts:124-128, 161-170` — 백워드 호환 단위 테스트 잔존**
   기존 어서션 4개 모두 새 패턴에서도 통과:
   - `expect(isValidNodeId('FORMULA', 'F-01')).toBe(true)` → `^F-\d{2,3}$` 매칭 OK
   - `expect(isValidNodeId('FORMULA', 'F-99')).toBe(true)` → 매칭 OK
   - `expect(isValidNodeId('FORMULA', 'F-1')).toBe(false)` → `\d{2,3}` 미만 reject OK
   - `expect(isValidFormulaId('FORMULA-01')).toBe(false)` → prefix 불일치 reject OK
     회귀 0 (기존 테스트 그대로 통과).

3. **데이터 무결성 — 동일 namespace 내 충돌 가능성 없음 (zero-pad 컨벤션)**
   기존 F-01..F-99는 항상 2자리 zero-pad. 새 F-100..F-999는 항상 3자리. F-99 ≠ F-099가 형식적 불일치이지만 `^F-\d{2,3}$`는 둘 다 매칭한다. 그러나 BATCH 적재 시 zero-pad 컨벤션이 "F-99까지는 2자리, 100부터는 3자리"로 일관되게 운영되는 한 (`docs/batch-load/batch-{4,5}-insert.sql`에서 F-97, F-98, F-99, F-100, F-101... 순서 확인) 충돌 0. **단, F-099 입력이 들어오면 D1 PRIMARY KEY가 F-99와 다른 행으로 받아들여 중복 의미 발생 가능** — 🟠 MAJOR로 별도 보고 (아래).

4. **`apps/batch/src/loader/draft-loader.ts:213-219` — 이중 방어 자동 갱신**
   draft-loader는 별도 정규식이 아닌 `isValidNodeId(NodeType, id)`를 호출하므로, registry JSON 변경 시 자동으로 새 패턴을 사용. 수동 동기화 불필요. fixture 우회 차단(Pass 3 M-2 흡수) 정상 유지.

5. **`packages/parser/src/schema-validator.ts:456` — 에러 메시지가 패턴 동적 노출**
   `Formula ID "${formula.id}" does not match pattern: ${registry.formula_id_pattern}`. 잘못된 ID(예: F-100000) 입력 시 사용자/관리자에게 정확한 패턴(`^F-\d{2,3}$`)이 노출되어 자가 진단 가능. 정보 누설 위험 0 (패턴은 ID 형식이지 비밀이 아님).

6. **보안 — RegExp ReDoS / catastrophic backtracking 미발생**
   `^F-\d{2,3}$`는 atomic prefix(`F-`) + bounded quantifier(`{2,3}`) + anchor(`$`). 백트래킹 분기 없음. 임의 길이 입력으로 CPU 고갈 공격 불가능. `compilePattern`(ontology-registry.ts:55-63)이 모듈 로드 시 1회 컴파일하여 캐싱 — 핫 패스 RegExp 재컴파일 0.

7. **`migrations/0001_initial_schema.sql:13-72` — D1 schema는 ID 패턴 CHECK 미부과**
   `id TEXT PRIMARY KEY` 만 선언. SQLite 트리거 또는 CHECK constraint에 `^F-\d{2}$` 하드코딩 없음. 따라서 application-layer 단일 검증(parser registry)만 갱신하면 정합. DB 마이그레이션 불필요.

### 🟠 MAJOR (3건 — 즉시 또는 다음 step 처리 권고)

#### M-1. **Negative-side 단위 테스트 부재 — 4-digit/0-digit reject 어서션 누락**

파일: `packages/parser/src/__tests__/schema-validator.test.ts:123-170`
**증거**: `F-100` (3자리, 새로 허용된 케이스), `F-1000` (4자리, reject 되어야 함), `F-` (0자리, reject), `F-099` (3자리지만 zero-pad 충돌 의심) 어서션이 단 한 건도 없다. 패턴 확장 후 새 boundary 케이스에 대한 테스트가 없으면 `^F-\d{2,3}$`가 의도와 다르게 컴파일된 경우(예: 누군가 미래에 `\d{2,4}`로 잘못 수정) 감지 불가능.
**권고**: 다음 4 어서션 추가 (회귀 방어):

```ts
expect(isValidFormulaId('F-100')).toBe(true); // 3자리 새 허용 boundary
expect(isValidFormulaId('F-999')).toBe(true); // 새 상한
expect(isValidFormulaId('F-1000')).toBe(false); // 4자리 reject
expect(isValidFormulaId('F-')).toBe(false); // 0자리 reject
```

근거: production-quality.md "테스트 없이 완료 금지 → Golden Test 포함" + auto-review-protocol.md Pass 1 "경계값" 항목.

#### M-2. **Zero-pad 컨벤션 중복 발생 가능 (F-99 vs F-099)**

파일: `packages/parser/src/ontology-registry.json:21,28`
**증거**: 새 `^F-\d{2,3}$`는 `F-99`와 `F-099`를 둘 다 valid로 받아들인다. D1에서는 `'F-99' != 'F-099'`이므로 별도 PRIMARY KEY 행으로 적재 가능. 미래에 BATCH 작성자 또는 LLM이 zero-pad 실수로 `F-001`, `F-099`를 산출하면 기존 `F-01`, `F-99`와 의미적으로 동일한 산식이 중복 등록되어 graph 무결성 위반.
**권고 (옵션 A — 보수)**: 패턴을 더 엄격하게: `^F-(\d{2}|[1-9]\d{2})$` (2자리 또는 leading-zero 없는 3자리). F-099 reject. handoff-046 §0.4 변경 컨벤션 (F-98~F-130 사용)과 정합.
**권고 (옵션 B — 명시)**: 현 패턴 유지하되 `batch-loadmap.md` Level 1 체크리스트에 "F-100 이상은 3자리 zero-pad 금지" 명문화 + 수작업 검수.
근거: CLAUDE.md Hard Limit "knowledge_nodes, formulas 테이블 UPDATE 금지 (개정 시 신규 노드 + SUPERSEDES 엣지)" — 중복 의미 노드는 SUPERSEDES 체인 무결성 파괴 위험.

#### M-3. **확장성 — F-999 한계 도달 시 동일 패턴 반복 우려 (메모리 정합)**

파일: `packages/parser/src/ontology-registry.json:21,28`
**증거**: 7회분 BATCH 중 5개 적재 시점에 이미 F-130 사용. BATCH-6+7 + 매년 개정(memory `project_definition.md` "매년 개정") + 멀티시험 확장(ADR-007 Year 2)을 고려하면 F-999 한계는 18~24개월 내 도달 가능. 현 fix는 단순 자릿수 확장(같은 root cause 재발 패턴) — 메모리 `feedback_two_fix_failures_zoom_out.md` "두 번째 fix 실패 → 숲을 봐라" 정합 검증 권고.
**권고**: handoff-045 §"옵션 B — F-CROP-NN, F-LIVESTOCK-NN 도메인 prefix" 또는 v3.0 §10.2 "exams/{id}/ontology.json" 분리(Year 2 Phase 4)를 ADR로 사전 결정. 본 1.2.0 fix는 임시 ceiling 확장으로 명시(handoff-046 §0.4가 이미 명시 — ✅), Phase 2 진입 시 도메인 prefix ADR 의무 트리거 추가 권고.
근거: production-quality.md "10K 유저, 매년 개정, 다른 시험 확장에서도 버티는가" + Hard Rule 15~17 멀티시험 격리.

### N/A (2건 — 본 변경에 해당 없음)

- **오프라인/Service Worker UX**: 본 변경은 빌드타임 정적 JSON 임포트(ontology-registry.ts:8 `import registryData from './ontology-registry.json'`). PWA 캐싱과 무관.
- **사용자 노출 한국어 문자열**: ID 패턴은 영문 정규식. i18n 대상 0.

### 반론 (Devil's Advocate — 깨질 수 있는 시나리오)

**시나리오 A (가장 현실적)**: BATCH-2/3/4 KG의 `_meta.ontology_registry_version`은 여전히 `"1.1.0"` 스탬프(verified: `docs/batch-load/batch-{2,3,4}-knowledge-graph.json` line 22/15/21). BATCH-5만 `"1.2.0"`. 미래에 audit 도구 또는 cross-batch-integrity-validator가 "동일 ontology_registry_version 일관성"을 검증하면 BATCH-2~4 vs BATCH-5 사이 version drift로 audit fail 가능. 본 fix는 백워드 호환이지만 메타 스탬프는 백워드 호환이 아니다.

**시나리오 B**: 누군가 이미 적재된 D1 prod에서 `SELECT id FROM knowledge_nodes WHERE id GLOB 'F-?'` 같은 GLOB을 사용하는 admin/observability 쿼리가 존재한다면, F-100 등은 `?`(단일 문자) 매칭에서 누락. 본 리뷰에서 admin-web/observability 코드 미열람 — 추가 grep 권고.

**시나리오 C (보안)**: 외부 API가 미래에 사용자 입력으로 `formula_id` 받는 엔드포인트를 노출하면, 정규식 검증은 통과하되 length 체크 부재로 `F-100` vs `F-099`가 둘 다 valid로 받아들여져 race-confused 인증 우회 가능성(매우 낮음, 이론적). 대비책으로 검증 후 zero-pad normalize 함수 추가 권고.

---

## Pass 4 (Contract): ✅ 6건 확인 / 🔴 0건 / 🟠 2건 / N/A 1건

설계서 + Hard Limit 31개 + 상용 품질 원칙 대조.

### ✅ 확인 (PASS)

1. **Hard Limit 5 (Ontology Lock — `ontology-registry.json 외 ID 생성 금지`) 정합**
   파일: `CLAUDE.md:66`. Hard Limit은 "registry 외부에서 ID 생성 금지"이지 "registry 자체를 변경 금지"가 아니다. registry는 허용 목록의 source of truth이며, 그 자체의 갱신은 의도된 절차다(version bump). 본 변경은 외부에서 임의 ID 패턴을 도입한 것이 아니라 registry 자체를 SemVer MINOR로 확장 — Hard Limit 5 위반 0.
   `handoff-session-046.md:60` "Hard Limit Ontology Lock 정합 변경 (백워드 호환)"이 의도 명시.

2. **Hard Limit 7 (BATCH 순차 실행 — `전 배치 검증 없이 다음 배치 금지`) 정합**
   파일: `CLAUDE.md:68`. 본 변경은 백워드 호환(`F-01..F-99` 모두 새 패턴에서 valid). `handoff-session-046.md:18` `verify 5/0/1 PASS 일치`(`.claude/reports/sprint1-step5-5-verify-session-043-after-td-s43-1-run1.json`) — TD-S43-1 fix 후 BATCH-1~4 회귀 0 검증 완료. BATCH-5는 새 ID 사용, BATCH-1~4 영향 0.

3. **L3 영역 (`**/ontology-registry*`—`CLAUDE.md:77`) 절차 정합**
`\*\*/ontology-registry*`는 명시적 L3 영역. plan + 인간 승인 의무.
   증거: handoff-session-045.md:100-102가 "TD-S43-1 결정 트리거 — 옵션 A/B 비교" 사전 plan 역할 수행. handoff-session-046.md:60 "진산 결정 정합 (메모리 '구현 최상 품질 기본값')" — 인간 결정 기록.
   ★ 단, 이는 handoff 노트 형식이지 정식 ADR 문서가 아니다 — 🟠 M-4로 별도 권고.

4. **Hard Rule 15~17 (멀티시험 격리) 영향 0**
   파일: `production-quality.md` Hard Rule 15~17. 본 변경은 시험 ID(`son-hae-pyeong-ga-sa`) 리터럴이나 시험별 분기를 도입하지 않는다. ID 패턴 자릿수 확장은 시험-무관(generic ontology). Year 2 멀티시험 확장 시에도 동일 패턴이 모든 시험에 적용 가능 (또는 v3.0 §10.2 따라 `exams/{id}/ontology.json` 분리 시 자연 해결).

5. **버전 시맨틱 (SemVer) 정합 — 1.1.0 → 1.2.0 (MINOR)**
   변경 성격:
   - ❌ Breaking change(MAJOR): F-01..F-99 reject 안 됨, 모든 기존 valid ID 유지 → MAJOR 아님
   - ✅ 기능 추가(MINOR): F-100..F-999 신규 허용 → MINOR 정합
   - ❌ 버그 fix only(PATCH): 새 기능 추가이므로 PATCH 아님
     결정: MINOR(1.2.0)는 SemVer 정확.

6. **`packages/parser/src/__tests__/schema-validator.test.ts:155-158` cross-type ID mismatch 테스트 무영향**
   `expect(isValidNodeId('CONCEPT', 'LAW-001')).toBe(false)` 등 cross-type 어서션은 FORMULA 패턴 변경과 무관. 통과 그대로 유지.

### 🟠 MAJOR (2건)

#### M-4. **L3 영역 변경 — 정식 ADR 부재 (handoff 노트가 ADR 역할 대체)**

파일: 없음 (있어야 할 파일이 없음 — `docs/adr/ADR-031-formula-id-pattern-3digit.md` 등)
**증거**:

- `docs/adr/ADR-029-formula-engine-resource-limit.md:182` 선례: "L3 영역 변경 = ADR 의무, ADR-029가 plan 역할 대체"
- `dev-guide.md` "L3 영역 변경 시 마이그레이션 SQL 먼저 작성 → plan → 인간 승인"
- `auto-review-protocol.md` Pass 4: "Silent Pivot 탐지 — 기획 ≠ 구현"
- 본 변경: handoff-session-045.md §"TD-S43-1 (신규, 차세션 결정 의무)" 옵션 A/B 비교 + handoff-session-046.md §0.4 "진산 결정 정합" — 비교 + 결정 기록은 충실. 그러나 정식 `docs/adr/ADR-XXX-*.md` 파일 부재.
- `docs/adr/` 디렉토리 최신 ADR-030 (knowledge-nodes-page-chapter-meta), ADR-031 부재.

**판정**: 절차적 부채. 결정 자체는 정합(백워드 호환 + 옵션 비교 + 인간 승인). 그러나 미래 6개월 후 "왜 1.2.0으로 올렸나" 추적 시 handoff 노트보다 ADR이 1급 출처.
**권고**: `docs/adr/ADR-031-formula-id-pattern-3digit-expansion.md` 작성 — handoff-045/046 §"TD-S43-1" 내용 흡수 + 옵션 A 채택 근거 + 옵션 B 이월 명시(M-3 정합). 본 fix 후 step에서 처리.

#### M-5. **문서 컨벤션 일관성 — `F-NN` 표기 9곳 미갱신**

파일:

- `docs/plans/batch-loadmap.md:198` (Level 1 체크리스트): `F-NN`
- `docs/architecture/ONTOLOGY.md:14,43,53`: `F-NN`
- `docs/architecture/VERSION_MANAGEMENT.md:168`: `F-NN-온주밀감`
- `docs/architecture/LLM_CONTAINMENT.md:85`: `F-\d{2}` (★ 정규식 직접 표기 — drift 명백)
- `docs/architecture/VALIDATION_FRAMEWORK.md:30`: `F-NN`
- `docs/engines/parser/research.md:25`: `F-\d{2}` (★ 정규식 직접 표기)
- `docs/engine-export/README.md:414`: `F-NN`
- `docs/architecture/review/CBIV_DESIGN_DIAGRAM.md:156`: `F-NN`
- `docs/architecture/review/CONTENT_BUILD_ENGINE_REDESIGN_v2.md:387`: `F-NN`
- `packages/parser/src/batch-processor.ts:113,153,160`: LLM prompt에 `F-NN` 안내 (★ 런타임 영향 — LLM에게 2자리 패턴만 안내하면 LLM이 F-100 산출 거부 가능성)
- `packages/parser/src/__tests__/batch-processor.test.ts:142`: `expect(prompt).toContain('F-NN')` (★ prompt 갱신 시 회귀 방어)

**증거**: 정규식 직접 표기(`F-\d{2}`) 2곳은 사실관계 오류 — 현 패턴은 `F-\d{2,3}`. 문서가 코드와 다른 진실을 주장.

**판정**: silent pivot 탐지(Pass 4 본질). 코드 1줄 변경에 비해 문서 동기화 누락 9곳.
**권고**:

- 즉시 (블로커): `packages/parser/src/batch-processor.ts:113`(LLM prompt) — `F-NN (예: F-01)` → `F-NN 또는 F-NNN (F-01..F-999)` 갱신. 미갱신 시 BATCH-6+ LLM 산출이 F-100을 reject 가능. (★ 본 변경의 핵심 효익을 무력화).
- 즉시 (블로커): `docs/architecture/LLM_CONTAINMENT.md:85` + `docs/engines/parser/research.md:25` — 정규식 표기 `F-\d{2}` → `F-\d{2,3}` (사실관계 fix).
- 다음 step: 나머지 7곳 (architecture/\*.md, batch-loadmap.md, engine-export/README.md, CBIV/CONTENT_BUILD docs) — 일괄 갱신.

### N/A (1건)

- **수치/임계값 (constants 값과 교재 원문 일치)**: 본 변경은 ID 패턴이지 수치 상수가 아님.

### 반론 (Devil's Advocate)

**시나리오 D (가장 위험)**: `packages/parser/src/batch-processor.ts:113` LLM prompt가 "FORMULA: F-NN (예: F-01)"을 포함. BATCH-6+ 적재 시 LLM에게 이 prompt가 전달되면 LLM은 "F-NN" = 2자리만 허용한다고 학습 → F-100 산출 시 LLM 자체 검열로 F-99 재사용 시도(중복 ID) 또는 적재 실패. **본 1줄 fix는 코드 정합성은 OK이나 LLM 안내 라인이 미갱신이면 실효성이 사실상 0.** 시급도 BLOCKER 권고. 본 리뷰에서 batch-processor.ts 수정 권한 외이므로 Pass 4 MAJOR로 보고.

**시나리오 E**: 누군가 미래에 `migrations/00XX_formula_id_check_constraint.sql`로 D1 CHECK constraint를 도입한다면, application-layer 패턴과 DB 패턴이 이중 source of truth가 되어 drift 위험. 현재는 D1 CHECK 부재(`migrations/0001_initial_schema.sql:13-72` 확인) — 단일 source 유지가 단기 해결책.

**시나리오 F**: handoff-046.md "auto-review-protocol §트리거 조건 면제 정합 (단순 데이터 적재 + ontology version bump)". 본 4-Pass 리뷰가 자체적으로 면제 가능 여부 검증 — `auto-review-protocol.md` "L1(스타일/순수 텍스트 문서/1줄 버그)은 면제, 단 아키텍처 다이어그램/DB 스키마/API 스펙 포함 시 L2". ontology-registry는 "API 스펙급 contract"로 해석 가능 — L2 적용 정합. 본 리뷰 실행 자체가 옳음.

---

## 통합 판정

**🟠 수정 필요 (조건부 완료 가능)**

- 🔴 CRITICAL 0건 ✅ (4-Pass auto-review-protocol "Critical 0건 = 완료 가능" 통과 가능)
- 🟠 MAJOR 5건 — 즉시 처리 권고:
  - **M-5 (블로커)**: `packages/parser/src/batch-processor.ts:113` LLM prompt + `docs/architecture/LLM_CONTAINMENT.md:85` + `docs/engines/parser/research.md:25` 정규식 갱신. 미처리 시 본 fix의 실효성 무력화.
  - **M-1**: schema-validator.test.ts에 F-100/F-999/F-1000 boundary 어서션 4건 추가.
- 🟠 MAJOR 3건 — 다음 step 처리 가능:
  - **M-2**: zero-pad 충돌 (F-99 vs F-099) 패턴 강화 또는 명문화.
  - **M-3**: F-999 ceiling 도달 시 도메인 prefix ADR 사전 결정.
  - **M-4**: 정식 ADR-031 작성 (handoff 노트 → 1급 출처).

**M-5 + M-1 처리 후 "완료" 선언 가능**. 나머지 3건(M-2/M-3/M-4)은 명시적 이월(다음 step의 첫 태스크로 등록)하면 4-Pass MAJOR 흡수 정합.

근거: `auto-review-protocol.md` "MAJOR는 phase 종료 전 해결 또는 다음 phase 초기 태스크로 명시 이월".

---

## 부록 — 핵심 파일 절대경로

- 변경 파일: `/home/soo/ClaudePro/ThePick/packages/parser/src/ontology-registry.json`
- 즉시 갱신 의무 (M-5 블로커):
  - `/home/soo/ClaudePro/ThePick/packages/parser/src/batch-processor.ts:113,153,160`
  - `/home/soo/ClaudePro/ThePick/docs/architecture/LLM_CONTAINMENT.md:85`
  - `/home/soo/ClaudePro/ThePick/docs/engines/parser/research.md:25`
- 테스트 보강 (M-1):
  - `/home/soo/ClaudePro/ThePick/packages/parser/src/__tests__/schema-validator.test.ts:123-170`
- 다음 step 권고:
  - `/home/soo/ClaudePro/ThePick/docs/adr/ADR-031-formula-id-pattern-3digit-expansion.md` (신규 작성)
  - `/home/soo/ClaudePro/ThePick/docs/plans/batch-loadmap.md:198` (Level 1 체크리스트 갱신)
  - `/home/soo/ClaudePro/ThePick/docs/architecture/ONTOLOGY.md:14,43,53` (F-NN 일괄 갱신)
- 결정 추적:
  - `/home/soo/ClaudePro/ThePick/.jjokjipge/handoff-session-045.md:100-102` (TD-S43-1 옵션 A/B)
  - `/home/soo/ClaudePro/ThePick/.jjokjipge/handoff-session-046.md:52-60` (옵션 A 채택 결정)
  - `/home/soo/ClaudePro/ThePick/.claude/reports/sprint1-step5-5-verify-session-043-after-td-s43-1-run1.json` (회귀 0 검증)
