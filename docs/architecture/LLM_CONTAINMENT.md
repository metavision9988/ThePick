# LLM 4계층 격리 설계 (ThePick)

**문서 유형:** 아키텍처 설계
**작성일:** 2026-04-27
**근거 헌법:** VOID ENGINE DESIGN CONSTITUTION v3.0 Volume IV (LLM 격리 4계층) + Volume XVIII (Content Generation Engine Profile)
**적용 범위:** ThePick의 모든 LLM 통합 지점 (BATCH 적재, Phase 3 Vision OCR, Phase 2 콘텐츠 생성)
**상태:** Design Locked (구현은 단계별)

---

## 1. 핵심 원칙

> _"엔진을 비결정론적 야수를 가두는 결정론적 우리로 설계하라."_
> — VOID DEV CONSTITUTION

LLM은 출시 후 재학습하지 않는 한 **확률적 야수**다. ThePick은 합격률 60% 목표(메모리 `project_vision_mvp_generalization`)이며 북극성은 **"생성물 신뢰성·정확성"**. LLM 출력을 검증 없이 사용하는 것은 북극성 위배.

본 문서는 LLM 호출 지점마다 **4계층 격리 우리**를 의무 적용하는 설계 명세.

---

## 2. ThePick의 LLM 통합 지점 (현재·미래)

| 시점               | 통합 지점                                   | LLM 사용 모델                                                                     |              본 4계층 적용               |
| :----------------- | :------------------------------------------ | :-------------------------------------------------------------------------------- | :--------------------------------------: |
| **Phase 0~1 현재** | BATCH 적재 (자료 구조화)                    | **Claude Code Opus 4.7 직접** (메모리 `project_batch_load_workflow` — API 호출 X) |       ⚠️ Layer 2+4 인간 검수 의존        |
| Phase 1 후반       | parser `batch-processor.ts`                 | Anthropic API Haiku (구조화) — 미구현                                             |       ✅ 4계층 전수 (구현 시점에)        |
| Phase 2            | study-material-generator (문제·암기법 생성) | Sonnet 4.6 + Haiku 4.5                                                            | ✅ 4계층 전수 + Vol XVIII 100% 인간 검수 |
| Phase 3            | Vision OCR (이미지·표 추출)                 | Claude Vision (Opus or Sonnet)                                                    |              ✅ 4계층 전수               |
| Phase 3            | RAG 답변 생성 (사용자 질의)                 | Sonnet 4.6 + Haiku 4.5                                                            |              ✅ 4계층 전수               |

**현재 BATCH 적재의 부분 격리 사유:** Claude Code Opus 4.7 직접 처리 = 인간 검수자(진산님)가 매 BATCH의 출력물 검수 = Layer 4 (Graceful Degradation = 인간 큐) + Layer 2 (의미 검증 = 인간이 확인) 부분 충족. 단, Layer 1 (Schema)·Layer 3 (Cross-validation)는 본 문서가 정의하는 코드로 적용.

---

## 3. 4계층 격리 (Layer 1 ~ Layer 4)

### 3.1 Layer 1 — Schema Validation

**목적:** LLM 출력이 약속한 JSON Schema에 맞는지 강제 검증.

**ThePick 구현 위치:**

| 통합 지점                               | Schema 정의                                          | 검증 도구                                             |
| :-------------------------------------- | :--------------------------------------------------- | :---------------------------------------------------- |
| `parser/batch-processor` (BATCH 구조화) | `KnowledgeContract` (`packages/parser/src/types.ts`) | `validateKnowledgeContract()` (이미 존재 — 강화 필요) |
| `study-material-generator` (문제 생성)  | `QuestionSchema` (Phase 2 신설)                      | Zod schema strict mode                                |
| Vision OCR (이미지 추출)                | `OCRResult` (Phase 3 신설)                           | Zod + `image_dimensions` 검증                         |

**Anthropic SDK 활용:**

```typescript
// LLM 호출 시 structured output 강제
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  tools: [
    {
      name: 'extract_knowledge',
      input_schema: KnowledgeContractZodSchema, // Layer 1 진입점
    },
  ],
  tool_choice: { type: 'tool', name: 'extract_knowledge' },
  // ... messages
});
```

**Layer 1 통과 기준:**

- JSON 형식 valid
- 모든 required 필드 존재
- 타입 일치 (string/number/boolean/array)
- enum 값이 허용 목록 내

**Layer 1 실패 시:** 1회 retry (수정 prompt 포함) → 그래도 실패 시 Layer 4 진입.

### 3.2 Layer 2 — Constraint Validation (의미적 제약)

**목적:** Schema는 통과했지만 **의미적으로 말이 안 되는 출력** 차단.

**ThePick 도메인 의미 검증:**

| 도메인          | 검증 규칙                                                             | 구현 위치                                                |
| :-------------- | :-------------------------------------------------------------------- | :------------------------------------------------------- |
| 산식 변수 범위  | `보험가액 > 0`, `면적 > 0`, `비율 0 ≤ x ≤ 1`, `손해율 0 ≤ x ≤ 2`      | `packages/formula-engine/src/validators/range.ts` (신설) |
| 노드 ID 패턴    | `CONCEPT-\d{3}`, `F-\d{2}`, `INS-\d{2}` (ontology-registry.json 기준) | `packages/parser/src/ontology-validator.ts` (이미 존재)  |
| 페이지 인용     | `1 ≤ page ≤ 835` (교재 총 페이지)                                     | `packages/parser/src/source-validator.ts` (신설)         |
| 법조문 인용     | 시행규칙·시행령·법률 식별자 일치                                      | `packages/parser/src/law-validator.ts` (신설)            |
| 정답 vs 변형    | 정답·오답 후보 모두 해설 가능한가                                     | `study-material-generator` (Phase 2)                     |
| 암기법 두문자어 | 두문자어 → 원래 항목 복원 가능 (역방향 검증)                          | CLAUDE.md "Hard Limit" 명시 — 폐기 의무                  |

**ThePick 표준 의미 검증 인터페이스:**

```typescript
interface SemanticValidator<T> {
  name: string; // e.g., "amount_in_range", "page_in_textbook"
  domain: string; // "formula" | "ontology" | "source" | "law" | "content"
  validate(output: T): ValidationResult;
}

interface ValidationResult {
  passed: boolean;
  violations: Violation[];
  recoverable: boolean; // false면 즉시 Layer 4 진입
}
```

**Layer 2 통과 기준:** 모든 등록된 validator passed.

**Layer 2 실패 시:** Layer 3 (cross-validation) 또는 Layer 4 (fallback)로 진입.

### 3.3 Layer 3 — Cross-Validation (교차 검증)

**목적:** Schema·의미 모두 통과했지만 **다른 진실 소스와 비교**해서 일치 검증.

**ThePick의 Cross-Validation 4종:**

#### 3.3.1 기출 정답 ↔ 그래프 해설 일치

- BATCH-Q (기출 적재) 시 매 문제의 정답을 그래프의 해설(`knowledge_edges` 통해 추적)로 도출 가능한지 검증
- 위배 시 `knowledge_nodes`에서 빠진 사실 → 교재 인용 추가 필요
- 구현: `packages/quality/src/answer-cross-check.ts` (신설, Phase 1 후반)

#### 3.3.2 BATCH N ↔ N-1 회귀 (CBIV)

- 이미 ADR-014 + CBIV.md에 정의된 6단계 검증 — 본 문서는 LLM 격리 차원에서 동일 메커니즘을 Layer 3으로 분류
- BATCH-N 적재 시 Batch 1~N-1과의 ontology 일관성·SUPERSEDES 정합 검증
- 위배 시 BATCH-N 폐기 → 재실행 (인간 검수 후)

#### 3.3.3 산식 결과 vs Constants DB

- formula-engine 계산 결과가 constants DB의 canonical 값과 일치하는지 (Golden Test)
- 위배 시 산식 정의 또는 Constants 둘 중 하나 결함 — 인간 추적

#### 3.3.4 Self-Consistency (선택, 고비용)

- 동일 prompt를 N회 호출 → Majority Vote
- 적용 대상: 고가치 결정 (예: 새 법령 해설 — Phase 3 BATCH-R)
- 비용: N배 → ADR-025 Cost Cap과 충돌 가능 → 신중 적용

**Layer 3 통과 기준:** 4종 중 해당 통합 지점에서 활성 항목 모두 통과.

**Layer 3 실패 시:** 인간 검수 큐 (Layer 4의 일부) — 자동 거부 X.

### 3.4 Layer 4 — Graceful Degradation (Fallback)

**목적:** Layer 1~3 모두 실패 시 **규칙 기반 대안** 또는 **인간 큐**로 진입. LLM이 침묵하거나 거부할 때도 사용자 영향 최소화.

**ThePick의 Fallback 패턴:**

| 통합 지점                 | LLM 실패 시 Fallback                                          | UX                                                                                                             |
| :------------------------ | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------- |
| BATCH 구조화              | **인간 큐 (Hard Stop)** — draft 상태로 유지, 진산님 검수 대기 | 자동 진행 X (BATCH는 사용자 직접 노출 X)                                                                       |
| Vision OCR (이미지 추출)  | **인간 OCR 검수 큐** — 원본 이미지 + LLM 부분 출력 첨부       | 작업자 큐                                                                                                      |
| 사용자 질의 RAG (Phase 3) | **키워드 기반 검색 + 교재 페이지 인용** — LLM 답변 X          | "현재 답변을 제공할 수 없어요. 교재 N장 N절을 참고하세요." (메모리 `project_source_citation_requirement` 정합) |
| 문제 생성 (Phase 2)       | **기존 문제 데이터베이스 조회** — 새 문제 생성 X              | 작업자 큐                                                                                                      |
| 암기법 생성 (Phase 2)     | **인간 작성 암기법 보유** — LLM 의존 X                        | 작업자 큐                                                                                                      |

**Layer 4 통과 기준:** Fallback 결과가 사용자에게 우아한 메시지 + 인간 큐에 작업 등록 + Lineage 이벤트 발행.

**핵심 원칙:** Fallback은 "예외 처리"가 아니라 **핵심 기능**. Layer 4 미설계 = 헌법 위배 (v3.0 Vol IV.2 명시).

---

## 4. 4계층 통합 흐름

```
LLM 호출
   │
   ↓
[Anthropic SDK structured output 강제]
   │
   ↓
[Layer 1: Schema 검증]
   ├── PASS → Layer 2
   └── FAIL → 1회 retry → 재실패 → Layer 4
   │
   ↓
[Layer 2: 의미 검증]
   ├── PASS → Layer 3
   └── FAIL → recoverable 여부 판단
              ├── recoverable → 1회 retry → Layer 4
              └── unrecoverable → Layer 4 즉시
   │
   ↓
[Layer 3: 교차 검증]
   ├── PASS → 출력 채택 + state='draft'
   ├── PARTIAL FAIL → 인간 검수 큐 (Layer 4 일부)
   └── FULL FAIL → Layer 4 즉시
   │
   ↓
[state='draft'] → 진산님 인간 검수 → state='approved' → 운영 적재
```

**모든 단계에 Lineage 이벤트 발행** (CLAUDE.md "TYPE-3 Cascade Destruction" 방지):

- `LLM_CALLED`, `LAYER_1_PASS/FAIL`, `LAYER_2_PASS/FAIL`, ...

---

## 5. ThePick 통합 지점별 적용 차등표

| 통합 지점                             | Layer 1 |       Layer 2       |         Layer 3          |          Layer 4           |
| :------------------------------------ | :-----: | :-----------------: | :----------------------: | :------------------------: |
| BATCH 적재 (현재 — Opus 직접)         | ⚠️ 인간 |   ✅ 인간 + 코드    |         ✅ CBIV          | ✅ Hard Stop (draft 유지)  |
| BATCH 적재 (Phase 1 후반 — Haiku API) | ✅ Zod  |  ✅ 4종 validator   |     ✅ CBIV + Golden     |         ✅ 인간 큐         |
| Vision OCR (Phase 3)                  | ✅ Zod  | ✅ image dim + page | ✅ 텍스트 vs 이미지 일치 |       ✅ 인간 OCR 큐       |
| 문제 생성 (Phase 2)                   | ✅ Zod  |  ✅ 정답·오답 검증  |   ✅ 그래프 해설 일치    |      ✅ 기존 DB 조회       |
| RAG 답변 (Phase 3)                    | ✅ Zod  |  ✅ 출처 page 검증  | ✅ Self-Consistency 선택 | ✅ 키워드 검색 + 교재 인용 |

---

## 6. 5요소 계약 (engine.contract.yaml에 첨부)

LLM 통합 엔진의 contract.yaml에 다음 5요소 의무 (v3.0 Vol IV.3):

```yaml
llm_integration:
  enabled: true
  model: 'claude-haiku-4-5-20251001' # 모델 버전 고정 (시드)
  cost_cap_per_request_usd: 0.05 # ADR-025 Layer 1과 일치
  cost_cap_per_user_per_day_usd: 1.00
  timeout_ms: 30000
  retry_max: 1
  fallback: 'human_review_queue' # Layer 4 진입점
  schema_strict: true # Layer 1
  semantic_validators: # Layer 2 활성 목록
    - 'amount_in_range'
    - 'page_in_textbook'
    - 'ontology_id_match'
  cross_validation: # Layer 3
    enabled: true
    strategies: ['cbiv_regression'] # answer_cross_check / cbiv_regression / golden_test / self_consistency
  prompt_injection_defense: true
  output_pii_filter: true # 출력에 PII 포함 시 마스킹
```

---

## 7. 결정성 보장 (시드 명시)

LLM은 결정성이 없지만 **부분적 시드 고정**으로 재현성 확보 가능:

| 시드 종류                    | ThePick 활용                                                            |
| :--------------------------- | :---------------------------------------------------------------------- |
| `model` 버전 명시            | `claude-haiku-4-5-20251001` (특정 dated alias) — 모델 변경은 ADR 트리거 |
| `temperature: 0`             | BATCH 구조화·OCR — 가장 결정적                                          |
| `max_tokens` 고정            | 출력 길이 제한                                                          |
| `system` prompt 동결         | 변경 시 v3.0 Vol VII Quality Regression test 의무                       |
| `messages` 입력 SHA-256 해시 | Lineage 이벤트에 포함 → 동일 입력 추적                                  |

**`build_reproducibility.invariant_fields`에 LLM 출력 ID는 포함 X** — `node_ids`/`AST`/`dependency_edges` 등 **인간 검수 후 confirmed**된 구조만 100% 재현. LLM raw 출력은 `tolerable_fields` (5% 허용).

---

## 8. 단계별 적용 로드맵 (요약)

본 LLM 격리 4계층은 단계적 적용:

| 시점                                               | 적용                                                                         |
| :------------------------------------------------- | :--------------------------------------------------------------------------- |
| **본 문서 ACCEPTED 직후 (2026-04-27)**             | 설계 동결. 코드 변경 0건.                                                    |
| **Engine Hardening Step 8 (parser Property test)** | parser의 Layer 1 (KnowledgeContract Zod) + Layer 2 (4종 validator) 강화      |
| **BATCH-1 적재 시점**                              | Layer 4 (인간 큐 = Hard Stop) 명시 적용 — 실제로는 이미 워크플로우상 적용 중 |
| **Phase 1 후반 — parser API 통합**                 | Layer 1~3 코드 전수 활성화                                                   |
| **Phase 2 — study-material-generator**             | LLM 통합 엔진 신설 시 본 문서 5요소 contract 의무                            |
| **Phase 3 — Vision OCR / RAG**                     | 4계층 전수 + Tier 5 Chaos (Hallucination/Prompt Injection) 통과 의무         |

세부 일정·승인 게이트는 각 Phase 진입 시점의 plan에 명시.

---

## 9. v3.0 Vol XVIII (Content Generation Profile) 정합

ThePick의 BATCH 적재 + Phase 2 study-material-generator는 **Content Generation Engine** 프로파일에 해당:

| Vol XVIII 의무                                | ThePick 적용                                                                                                    |
| :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| 모든 출력물 hash 무결성 검증                  | `state_hash` (SHA-256 of normalized JSON) 매 노드 INSERT 시 — 메모리 `project_source_citation_requirement` 정합 |
| 생성 입력(seed + prompt + model_version) 보존 | Lineage 이벤트 + `lineage_events` 테이블 (Phase 1 후반 신설)                                                    |
| **100% 인간 검수 통과 후 배포**               | ✅ `state='draft'` → 진산님 검수 → `state='approved'` (이미 워크플로우 명시)                                    |
| 재생성 가능 (reproducibility)                 | ADR-023 + Engine Hardening Roadmap의 reproducibility test                                                       |
| 라이선스/저작권 추적                          | 메모리 `feedback_copyright_skip` — 진산님 명시 비적용 (검토 불요)                                               |

→ ThePick은 본 문서 + 기존 메모리·CLAUDE.md로 Vol XVIII 100% 충족.

---

## 10. 안티패턴 (피할 것)

| 안티패턴              | 사례                           | ThePick 회피                        |
| :-------------------- | :----------------------------- | :---------------------------------- |
| Layer 4 미설계        | LLM 실패 시 그냥 에러 throw    | Hard Stop + 인간 큐 의무            |
| Layer 1만 적용        | Zod 통과 = 끝                  | 4계층 모두 통과해야 `state='draft'` |
| 의미 검증 LLM 의존    | 산식 검증을 또 다른 LLM 호출로 | 결정적 코드 (range check)만         |
| Cross-validation 누락 | CBIV 미적용 BATCH 적재         | ADR-014 의무                        |
| Self-Consistency 남용 | 모든 호출 N=5                  | Cost SLO 폭발 → 고가치만            |
| 시드 미고정           | `temperature: 1.0` BATCH       | `temperature: 0` + 모델 dated alias |

---

## 11. 본 문서의 위치

- 본 문서는 **설계 명세** (Design Locked)
- 코드 구현은 단계별 (Section 8 로드맵)
- 본 문서 변경은 **Major decision** — ADR 작성 의무 (v3.0 Vol V.5 Migration Strategy)
- 변경 트리거:
  - 새 통합 지점 추가 (예: Phase 4 음성 입력)
  - Layer 추가/삭제
  - Anthropic SDK 변경에 따른 Layer 1 도구 변경

---

## 12. 관련 문서

- `docs/architecture/Engine Design/VOID ENGINE DESIGN CONSTITUTION v3.0.md` Vol IV, IV-B, XVIII
- `docs/architecture/CONTENT_BUILD_ENGINE.md` (4 코어 모듈 — Ontology/Validation/Version/Loader)
- `docs/architecture/CBIV.md` (Layer 3 Cross-validation의 핵심)
- `docs/architecture/ONTOLOGY.md` (Layer 2 노드 ID 패턴)
- `docs/architecture/VALIDATION_FRAMEWORK.md` (Layer 1+2 통합 프레임)
- `docs/adr/ADR-008-graceful-degradation-thresholds.md` (Layer 4 임계값)
- `docs/adr/ADR-014-cross-batch-integrity-validator.md` (Layer 3 핵심)
- `docs/adr/ADR-025-two-layer-cost-control.md` (Cost Cap — Layer 1 비용 통제)

---

**문서 버전:** 1.0
**다음 업데이트:** Phase 1 후반 parser API 통합 시점 → Layer 1+2 코드 명시 v1.1
**Reviewer:** 진산
**Date:** 2026-04-27
