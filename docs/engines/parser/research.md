# parser — Stage 0 Research

**작성일:** 2026-04-27
**Engine:** `@thepick/parser`
**Domain Profile:** Library (primary) + Batch-Build (secondary)
**DEFCON:** **L2**
**Status:** Researched

---

## 1. 도메인 경계 (Bounded Context)

PDF 자료를 ThePick의 **Knowledge Contract** (D1 적재 직전 형태)로 변환하는 책임. 입력: PDF 바이트 → 출력: `KnowledgeContract`(노드/엣지/산식/상수). 외부 LLM 호출은 Phase 1 후반 `batch-processor.ts` 도입 시점에 추가 예정.

- **포함:** PDF 추출(pdfplumber subprocess), 섹션 분리, 표 추출, Vision OCR 트리거 후보 선정, Ontology 검증, Schema 검증, Constants 추출, Claude API 배치 구조화 인터페이스
- **제외:** D1 직접 INSERT (`apps/batch/loader/draft-loader.ts`의 책임), 그래프 무결성 검증(`@thepick/quality`), 산식 계산(`@thepick/formula-engine`)

---

## 2. 기존 엔진과의 차이

| 비교         | 일반 PDF 파서         | parser                                             |
| :----------- | :-------------------- | :------------------------------------------------- |
| 출력 형식    | 텍스트 또는 임의 JSON | `KnowledgeContract` (ontology-registry.json 강제)  |
| 노드 ID 생성 | 자동/임의             | 패턴 강제 (`CONCEPT-\d{3}`, `F-\d{2}` 등)          |
| 섹션 분리    | 페이지 단위           | 의미 단위 (제 N 장 / 제 M 절) — 교재 구조 인식     |
| 산식 인식    | 텍스트만 추출         | math.js AST 파싱 가능 형태로 정규화                |
| Vision OCR   | 모든 이미지           | 표·도식만 트리거 (`vision-trigger.ts`) — 비용 통제 |

→ ThePick 도메인 특화. 일반 PDF 파서로 대체 불가.

---

## 3. 결합 패턴 (Volume III)

**Library Engine — 결합 패턴 N/A.** `apps/batch` 파이프라인 안에서 호출되며, 파이프라인 자체는 **Pattern A (Pipeline)**.

---

## 4. DEFCON 분류 (Volume I)

**L2** — formula-engine·quality와 달리 자동 L3 트리거 미해당:

- ❌ AI/ML 추론 핵심 (Phase 1 후반 추가 예정 — 그때 L3 격상 검토)
- ❌ Stateful Meta가 의존하는 결정자 아님 (출력은 검증 후 적재됨)
- ⚠️ 단, Phase 1 후반 `batch-processor.ts` LLM 통합 시 자동 L3 트리거 발동 → 본 contract 재평가 의무

---

## 5. SLA / Availability

| 항목                                        | 값                                                     | 근거                                                               |
| :------------------------------------------ | :----------------------------------------------------- | :----------------------------------------------------------------- |
| `build_correctness`                         | 0.99 (Schema validator + Ontology validator + Layer 2) | Phase 1 후반 LLM 통합 시 0.999로 격상                              |
| `build_reproducibility.invariant_threshold` | **1.0 (100%)**                                         | 노드 ID, AST, 의존 그래프, ontology 매칭, constants canonical form |
| `build_reproducibility.tolerance_threshold` | **0.05 (5%)**                                          | PDF 파싱 노이즈 — line breaks, whitespace, OCR 보정 텍스트         |
| Latency (페이지당)                          | < 500ms (PDF 추출) / < 2s (섹션 분리 포함)             | pdfplumber subprocess 비용                                         |
| Availability                                | N/A (Library)                                          | —                                                                  |

**핵심:** `build_reproducibility`가 분할된 유일한 엔진. Review B-1의 직접 적용 사례.

---

## 6. Library 식별 3문항 (Vol XV.2)

|                 Q                 | 답             | 증거                                                                                                                            |
| :-------------------------------: | :------------- | :------------------------------------------------------------------------------------------------------------------------------ |
|    Q1: 같은 입력 → 같은 출력?     | ⚠️ **PARTIAL** | invariant_fields 100% / tolerable_fields 5% 허용. PDF 파싱은 line break/whitespace 변동성 있음 (PDF library 버전·OS 차이)       |
| Q2: 인터페이스 보존 시 구현 교체? | ✅ YES         | `extractPdf` `splitSections` 등 명확한 함수 시그니처 — pdfplumber → MuPDF 등 교체 가능                                          |
|    Q3: 외부 의존 없이 테스트?     | ⚠️ **PARTIAL** | pdfplumber Python subprocess 의존 — fixture PDF로 테스트 가능하나 시스템 환경(Python 설치) 필요. CI에서 격리 컨테이너 사용 권고 |

→ 2/3 PASS + 1/3 PARTIAL. Library 자격 충족하나 **invariant/tolerable 분리가 결정적 차이**. Review B-1 권고 정확.

---

## 7. 기존 자산 (이미 존재)

| 항목                              | 위치                                                                                           | 상태                                           |
| :-------------------------------- | :--------------------------------------------------------------------------------------------- | :--------------------------------------------- |
| PDF 추출                          | `src/pdf-extractor.ts` (pdfplumber subprocess)                                                 | ✅                                             |
| 섹션 분리                         | `src/section-splitter.ts`                                                                      | ✅                                             |
| 표 추출                           | `src/table-extractor.ts`                                                                       | ✅                                             |
| Vision 트리거 후보 선정           | `src/vision-trigger.ts`                                                                        | ✅                                             |
| Ontology 레지스트리               | `src/ontology-registry.json` (Hard Limit — Lock) + `ontology-registry.ts`                      | ✅                                             |
| Schema validator                  | `src/schema-validator.ts` (14가지 ValidationErrorCode)                                         | ✅                                             |
| Constants 추출                    | `src/constants-extractor.ts`                                                                   | ✅                                             |
| Claude API 배치 구조화 인터페이스 | `src/batch-processor.ts` (`ClaudeClient` 추상)                                                 | ✅ (인터페이스만, 실구현은 ai-adapter 도입 시) |
| 단위 테스트                       | `__tests__/batch-processor.test.ts`, `constants-extractor.test.ts`, `schema-validator.test.ts` | ✅ (3건)                                       |
| **결정성 Property Test**          | —                                                                                              | **❌ 보강 필요 (Step 14)**                     |
| engine.contract.yaml              | `docs/engines/parser/contract.yaml`                                                            | ✅ (Step 6)                                    |

---

## 8. Engine Hardening 차단 항목

- ✅ Library 식별 3문항 (Q1·Q3 PARTIAL — invariant/tolerable 분리로 우회)
- ⏳ Property Test (Step 14): invariant_fields 100% + tolerable_fields ≤ 5%
- ⏳ contract.yaml ACCEPTED (Step 6 — 본 파일)
- ⏳ Step 18 자동 검증

---

## 9. 위험 / Devil's Advocate

| 위험                                                | 근거             | 완화                                                            |
| :-------------------------------------------------- | :--------------- | :-------------------------------------------------------------- |
| pdfplumber 버전 변경 시 출력 변동                   | 외부 라이브러리  | 버전 고정 (`requirements.txt`) + tolerance 5%                   |
| Python 환경 차이 (Mac/Linux/WSL)                    | OS 의존          | CI에서 컨테이너 사용 + invariant_fields 100% (의존 없는 차원)   |
| ontology-registry.json 외 ID 생성 (Hard Limit 위배) | 인간/LLM 실수    | `isValidNodeId` 등 validator 강제 + Schema validator            |
| 섹션 분리 오류 (제 N 장 인식 실패)                  | 교재 포맷 다양성 | fixture 다양화 + 인간 검수 (BATCH 적재 워크플로우)              |
| 표 추출 누락                                        | pdfplumber 한계  | Vision OCR fallback (Phase 3 — `vision-trigger.ts`가 후보 식별) |
| Claude API 결과 비결정성 (Phase 1 후반)             | LLM 자체         | LLM_CONTAINMENT.md 4계층 + Layer 1 schema strict                |

---

## 10. v3.1 헌법 패치 후보 도출

본 엔진의 invariant/tolerable 분리는 **v3.1 헌법 후보 #1** (Review B-1):

- v3.0 Vol XIV.4 `build_reproducibility: 1.0`은 단일 값 — 환상 가능성
- parser 같은 PDF 파싱 엔진은 분할 필수 — v3.1에 일반화

---

## 11. 다음 단계

- Step 6 (본 파일)
- Step 9 (`step3-parser-determinism.plan.md` — invariant/tolerable 분리 strategy)
- Step 14 (Property Test 코드 — 100회 반복, fixture PDF 5종)
- Phase 1 후반 (LLM 통합 시 본 research/contract 재평가 — DEFCON L3 격상 검토)
