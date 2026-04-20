# ADR-007: v3.0 멀티시험 전환 — Year 2 이월 결정

- **상태:** Accepted
- **결정일:** 2026-04-18 (Session 8)
- **결정자:** 진산 + Claude Opus 4.7
- **관련 문서:**
  - `docs/쪽집게(ThePick) — 구현 재정립서 v3.0 FINAL.md` (2006 lines, 2026-04-17)
  - `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md` (현행 Year 1 스펙)
  - ADR-004 (Vectorize 임베딩 — `exam_id` 필터 보강 필요)

## 맥락 (Context)

v3.0 FINAL 재정립서는 **프로젝트 정체성 전환**을 요구한다:

- v2.0: "손해평가사 자격시험 AI 학습 서비스 — 16주 MVP"
- v3.0: "멀티시험 학습 SaaS 플랫폼 — Year 1 손해평가사 파일럿 + Year 2 공인중개사 확장"

v3.0 §2.2는 **Hardest-First 전략 3원칙**을 명시:

1. **Pilot First, Platform Second** — 1번째 시험으로 엔진 완성, 2번째 시험 전에는 플랫폼화 금지
2. **Extract After Two** — 2개 시험 사례 확보 전에는 추상화·공통화 금지
3. **Vertical Before Horizontal** — 1개 시험 완결 후 다음으로

그런데 v3.0 §7(DB 스키마) 및 §5(ExamAdapter)는 **Year 1 스키마에 `exam_id` 전면 도입 + `exams` 테이블 + `lv1/lv2/lv3` 범용 컬럼명**을 요구한다. 이는 **"스키마는 완벽주의, 코드는 실용주의"라는 비대칭**을 만든다.

### Session 8 시점 상태

- Phase 0 완료 (migrations 0001~0004 적용됨, **production D1까지 배포 완료**)
- Phase 1 Step 1-0 진입 게이트 G1~G8 해소 완료
- `packages/parser-1st-exam`, `packages/formula-engine`, `packages/payment` 등 **v3.0 구조와 다른 경로**로 이미 구현됨
- Temporal Graph 보호 트리거 5종이 프로덕션에 적용됨 → **기존 테이블에 `exam_id` 컬럼 추가 시 UPDATE가 트리거에 차단**되어 마이그레이션 설계 자체가 고위험 L3

## 결정 (Decision)

### v3.0 본문 vs 본 ADR의 권위 관계 (선언)

v3.0 FINAL은 §2.1(Pilot First, Platform Second) 원칙과 §7.3(Phase 0에 11개 테이블 전체 마이그레이션) 요구가 **내부적으로 비대칭**이다. "스키마는 플랫폼 완성, 코드는 파일럿"이라는 스펙 자기 모순. 본 ADR은 이 비대칭을 해소하여 **두 요구 중 §2.1 Pilot First 원칙을 상위 권위로 채택**하고, §7.3의 "Phase 0에 11테이블 전체" 선언을 Year 2 Phase 4로 이월한다.

**권위 순서:**

1. 본 ADR-007 (2026-04-18 Session 8 진산 승인) — 최상위
2. v3.0 FINAL §2.1 Hardest-First 3원칙 — 본 ADR의 논리적 근거
3. v3.0 FINAL §7.3 Phase 0 11테이블 선언 — **이월 대상** (Year 2 Phase 4 0005 마이그레이션으로 실현)

**이월 사유 재명시:**

- v3.0 §7.3 "Phase 0: migrations/0001_initial_schema.sql ← 11개 테이블 전체" 선언은 현 시점에서 실현 불가: Phase 0가 이미 완료되어 production D1에 9테이블 + 10트리거가 적용된 상태
- §2.1 "Pilot First, Platform Second" + "Extract After Two" 원칙을 우선 준수하려면 Year 2에 11테이블 확장이 타당

### 채택 옵션: 옵션 B — v3.0 구조 전환을 Year 2 Phase 4로 이월

**Year 1 (현재 ~ Phase 3 완료) 동안 유지하는 것:**

- 현재 D1 스키마 9개 테이블 + 10개 트리거 (손해평가사 특화 컬럼명 포함)
  - 적용된 테이블: `knowledge_nodes`, `knowledge_edges`, `formulas`, `constants`, `revision_changes`, `exam_questions`, `mnemonic_cards`, `user_progress`, `topic_clusters`
  - `users` 테이블은 Phase 1 Step 1-1 PBKDF2 auth 구현 시 신규 생성 (본 ADR "즉시 반영 4" 참조)
- `packages/parser-1st-exam/`, `packages/formula-engine/`, `packages/payment/` 경로
- 엣지 타입 13종 (v2.0), 노드 타입 7종 (INSURANCE/CROP 포함)
- Ontology registry는 `packages/parser/src/ontology-registry.json` 유지
- `packages/shared/src/types.ts` `NodeType`, `EdgeType`, `TRUTH_WEIGHTS`, `ConstantCategory` 등 **손해평가사 특화 리터럴 유지** (Hard Rule 15 Year 1 한시 예외 대상 — production-quality.md 참조)

**Year 2 Phase 4 (리팩토링 8주)로 이월:**

- `migrations/0005_multi_exam_foundation.sql` — `exams` 테이블 + 전 테이블 `exam_id` FK
- `lv1_insurance/lv2_crop/lv3_investigation` → `lv1/lv2/lv3` 컬럼명 변경
- 노드 타입 CHECK 제약 재정의 (INSURANCE/CROP 제거, CASE_LAW/CIRCUIT 추가)
- 엣지 타입 재편 (13→adapter별 허용 목록 선언 방식)
- 디렉토리 구조 전환: `packages/parser-1st-exam/` → `exams/son-hae-pyeong-ga-sa/parsers/`
- 범용 로직 분리: `packages/formula-engine/` → `engine/formula/`
- **`packages/shared/src/types.ts` 이전:** `NodeType`, `EdgeType`, `TRUTH_WEIGHTS`, `ConstantCategory`, `ConfusionType` 등 손해평가사 특화 리터럴을 `exams/son-hae-pyeong-ga-sa/domain.ts`로 이동. `packages/shared/`는 `string` 또는 generic 타입만 제공

### Year 1 내 즉시 반영 (본 ADR과 동반)

1. **ADR-004 업데이트** — Vectorize 메타데이터 스키마에 `exam_id` 필터 키 추가
2. **`packages/shared/src/exam-adapter.ts` 타입 계약 일부 선언** — v3.0 §5.2 전체 12필드 중 Year 1에 필요한 최소 핵심(ExamId 타입, EXAM_IDS 단일 선언, ExamConfig 축약, ExamAdapter 메서드 3종)만 선언. **"구조적 호환" 수준은 부분적**이며, Year 2 Phase 4에서 v3.0 §5.2 전문(FormulaDefinition, ConfusionPattern, MnemonicTemplate 등)으로 **확장 필수** (본 ADR 수준에서는 Breaking Change 예상)
3. **Hard Rules 15~17** — `.claude/rules/production-quality.md`에 멀티시험 격리 원칙 명문화. v3.0 §10.2의 번호 체계 사용하되, Year 1 실행 맥락에 맞춰 **주제 일부 재해석** (Rule 16 = 쿼리 exam_id 파라미터 / Rule 17 = 리터럴 단일 선언). v3.0 §10.2 원본(Ontology/테스트 플러그인화)은 Year 2 Phase 4 전환 시 본 파일 업데이트
4. **`users` 테이블 설계 결정** — Phase 1 Step 1-1 PBKDF2 auth 구현 시 v3.0 §7.1 users 테이블 4개 구독 컬럼 **전체 포함**:
   - `subscription_plan` (single/combo/all_access/NULL)
   - `subscribed_exams` (JSON array of ExamId)
   - `subscription_started_at` (timestamp)
   - `subscription_expires_at` (timestamp)
   - `last_login_at` (timestamp, v3.0 §7.1 권장)

   이는 Year 2 breaking change를 최소화하기 위함 (구독 관리는 사용자 데이터라 마이그레이션 비용 최대). 단, 본 ADR은 스키마 선언만 요구하며, 실제 구독 **로직** 구현은 Phase 3까지 단계적 진행

### 엣지 타입 — v2.0 13종 유지 + Adapter 허용 목록 선언 (반론 1 반영)

v3.0 §4(엣지 5종 압축 — APPLIES_TO/REQUIRES/CONTRADICTS/REFERENCES/SUPERSEDES)는 **1개 시험 사례만 보고 추상화**하는 조기 축소다. 이는 v3.0 자신이 선언한 "Extract After Two" 원칙과 배치된다.

**Year 1 유지:** v2.0 13종 (APPLIES_TO, REQUIRES_INVESTIGATION, PREREQUISITE, USES_FORMULA, DEPENDS_ON, GOVERNED_BY, DEFINED_AS, EXCEPTION, TIME_CONSTRAINT, SUPERSEDES, SHARED_WITH, DIFFERS_FROM, CROSS_REF). 손해평가사 혼동 유형 감지 엔진(Hard Rule 12~14)은 이들 시맨틱에 의존.

**Year 2 공인중개사 시점 결정:** 실제 두 시험이 공통으로 필요한 엣지만 추출. v3.0의 5종은 "공통 baseline"으로만 해석.

## 대안 (Alternatives Considered)

### 옵션 A: 지금 전면 전환 (기각)

- `migrations/0005_multi_exam_foundation.sql` 즉시 작성, Year 1 내 v3.0 정합 완성
- **기각 이유 3건:**
  1. 기존 5개 temporal guard 트리거가 UPDATE를 차단 → 우회 마이그레이션 설계 = 매우 고위험 L3
  2. Phase 1 Step 1-1 PBKDF2 착수 2~3일 지연 (현재 수익 0원 상태)
  3. v3.0 자신의 "Pilot First, Platform Second" 원칙과 배치

### 옵션 C: v3.0 무시, v2.0 완료 후 재검토 (기각)

- **기각 이유:** Year 2 Phase 4 리팩토링 범위가 예측 불가능해짐. 현재 ADR로 이월 범위를 명시해야 Year 2 진입 시 범위 확정 가능.

## 결과 (Consequences)

### 긍정적

- Phase 1 Step 1-1 즉시 착수 가능 (오늘 ~ 다음 주)
- 기존 production D1 배포 상태 보존 (재마이그레이션 불필요)
- `ExamAdapter` 타입 일부 선언 + Hard Rules 선제 도입으로 Year 2 리팩토링 시 "**타입 계약 기반 Breaking Change 최소화**" (전면 호환은 아니며, 필드 확장/메서드 추가는 Year 2 Phase 4에서 수행)
- 엣지 타입 13종 유지 → 손해평가사 혼동 유형 엔진(핵심 차별화) 표현력 보존

### 부정적

- Year 2 Phase 4 진입 시 **breaking migration 0005** 필요 (전 테이블 스키마 변경 + 데이터 복사)
- `users` 테이블만 Year 1에 `subscription_*` 컬럼 포함 → 스키마 일관성 일시적 불균형
- v3.0 FINAL 본문과 현재 구현이 Year 1 내내 약간 다름 → 신규 온보딩 시 본 ADR 필독 필요

### 중립

- `packages/parser-1st-exam/`, `packages/formula-engine/` 경로는 Year 2 리팩토링 대상으로 고정. Year 1 동안은 `SHARED_WITH` / `DIFFERS_FROM` 엣지로 1차/2차 공유 노드 관리.

## 후속 조치 (Year 2 Phase 4 준비물 — 지금 문서화만)

**마이그레이션 0005 실행 순서 (엄격, 단일 트랜잭션 내):**

Temporal guard 트리거가 모든 기존 테이블 UPDATE를 차단하므로 백필 UPDATE 전 트리거 DROP 필수. 순서 실수 시 프로덕션 DB 수 시간 중단 가능.

1. **DROP** 5 triggers: `prevent_knowledge_nodes_update`, `prevent_formulas_update`, `prevent_constants_update`, `prevent_revision_changes_update`, `prevent_exam_questions_update`
2. **ALTER TABLE ADD COLUMN** `exam_id TEXT` (9개 기존 테이블 전부, 초기 NULL 허용)
3. **UPDATE** 기존 row: `UPDATE {table} SET exam_id = 'son-hae-pyeong-ga-sa' WHERE exam_id IS NULL` (9회)
4. **CREATE TABLE** `exams` (v3.0 §7 스펙) + 초기 row (`son-hae-pyeong-ga-sa`, `gong-in-jung-gae-sa`) INSERT
5. **ALTER TABLE ADD CONSTRAINT** 또는 트리거 기반 `exam_id NOT NULL` + FK `REFERENCES exams(id)` (SQLite 한계로 CHECK 트리거 사용 가능)
6. **ALTER TABLE RENAME COLUMN** `lv1_insurance` → `lv1`, `lv2_crop` → `lv2`, `lv3_investigation` → `lv3` (SQLite 3.25+, D1 호환 확인 필요)
7. **CREATE TRIGGER** (재생성, `exam_id` 포함 INSERT 검증 + 기존 UPDATE 차단)
8. **CREATE INDEX** 복합 인덱스: `(exam_id, type)`, `(exam_id, lv1)`, `(exam_id, category)` 등

**ID 네이밍 재설계 (별도 ADR 필요 — Year 2 진입 시):**

- 현재 노드 ID 패턴: `CONCEPT-001`, `INS-01`, `F-01` (prefix 없음)
- Year 2 전환 시 prefix 추가 여부 결정: `SHPGS-CONCEPT-001` vs `CONCEPT-001` 유지 + `exam_id` FK로만 격리
- prefix 추가 시 전체 노드 ID 재작성 + edges의 source_id/target_id/formulas.id/user_progress.node_id 연쇄 변경 필요 — **breaking migration 범위 대폭 확대**

**디렉토리 이전 절차:**

1. `packages/parser-1st-exam/src/*` → `exams/son-hae-pyeong-ga-sa/parsers/*`
2. `packages/formula-engine/*` → `engine/formula/*` (손해평가사 특화 로직 잔존 시 별도 `exams/son-hae-pyeong-ga-sa/formula-overrides/`로 분리)
3. `protect-l3.sh` L3_PATTERNS 업데이트

## 참고

- 재정립서 v3.0 FINAL §2.2 (Hardest-First 3원칙)
- 재정립서 v3.0 FINAL §5 (ExamAdapter 인터페이스)
- 재정립서 v3.0 FINAL §7 (DB 스키마 11개 테이블)
- ADR-004 (Vectorize — exam_id 필터 추가 필요)
- ADR-006 (Cloudflare 단일 벤더 — v3.0과 정합)

## 수정 이력

- 2026-04-18 (Session 8): 초안 작성 (v3.0 FINAL 수용 결정 + Year 2 이월 범위 확정)
