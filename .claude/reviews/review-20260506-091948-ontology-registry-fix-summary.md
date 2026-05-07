# Review Summary — Ontology Registry Formula ID Pattern Expansion (4-Pass 통합)

**리뷰 방식**: 독립 에이전트 2개 병렬 (Pass 1+2: pr-review-toolkit:code-reviewer / Pass 3+4: system-architect)
**리뷰 일자**: 2026-05-06 09:19:48 KST
**리뷰 대상 변경**: `packages/parser/src/ontology-registry.json` 3줄 fix (version bump + 2 pattern 확장)
**관련 ADR**: ADR-031 — Formula ID Pattern 확장 (`^F-\d{2}$` → `^F-\d{2,3}$`)

---

## 1. 4-Pass 결과 종합

|     Pass      | 에이전트                        | ✅ 확인 | 🔴 Critical | 🟠 Major | 🟡 Minor |  N/A  |      판정       |
| :-----------: | :------------------------------ | :-----: | :---------: | :------: | :------: | :---: | :-------------: |
|  1 (Surgeon)  | pr-review-toolkit:code-reviewer |    6    |      0      |    0     |    0     |   0   |    완료 가능    |
| 2 (Architect) | pr-review-toolkit:code-reviewer |    7    |      0      |    0     |    1     |   0   |    완료 가능    |
| 3 (Advocate)  | system-architect                |    7    |      0      |    3     |    0     |   2   |   조건부 완료   |
| 4 (Contract)  | system-architect                |    6    |      0      |    2     |    0     |   1   |   조건부 완료   |
|   **합계**    | —                               | **26**  |    **0**    |  **5**   |  **1**   | **3** | **조건부 완료** |

**4-Pass CRITICAL 0건** → "완료" 선언 기준 통과. MAJOR 5건은 본 세션 fix (3건) + 명시 이월 (3건) 처리.

## 2. Pass 1 (Surgeon) — 코드 정합성 (확인 6건)

✅ JSON syntax + schema 형태 정합 (`python3 json.load` 통과)
✅ ECMAScript regex `{min,max}` 표준 — JS+Python 양쪽 컴파일 성공
✅ BATCH-1~5 누적 130 산식 ID 100% 신 패턴 PASS (실측)
✅ F-100 / F-130 / F-999 3자리 PASS
✅ F-1 / F-1000 / F-0 거부 보장
✅ case / whitespace / prefix 비형식 입력 거부 강도 보존

**반론 (Devil's Advocate)**: lexical sort 시 `F-100 < F-99` 순서 변동. 단, invariant 결정성은 유지 (실제 정렬 의존 코드 없음, semantic order만 사용).

## 3. Pass 2 (Architect) — 연계 검증 (확인 7건 + Minor 1)

✅ SSOT 단일 진실 소스 — production 코드 전체에서 hardcoded `F-\d` 0건
✅ registry consumer (ontology-registry.ts precompile 캐시) 자동 반영
✅ verify-engine-contracts.ts 14 obligation 무관 (ID pattern 미검증 영역)
✅ `assertRegistryShape()` 필드 존재성 검증 PASS, `compilePattern()` build-time fail-fast 확보
✅ `json-to-sql-batch.py` ID 미검증 + D1 schema CHECK 0건 → 신 3자리 ID INSERT 차단 없음
✅ Hard Limit 5 (Ontology Lock) 정합 — 외부 ID 생성 아닌 내부 패턴 확장
✅ 4 KG JSON consumer 모두 신 pattern 적합

**🟡 Minor 1**: `_meta.ontology_registry_version` 표기 불일치 (BATCH-1 missing / 2~4 = 1.1.0 / 5 = 1.2.0). production 미참조 → 런타임 영향 0. Phase 2 audit 도구 추가 시 일관성 검증 의무.

**반론**: schema-validator.test.ts 에 F-100/F-999 acceptance + F-1000 rejection 케이스 추가 권장 (별도 step, 본 fix scope 밖).

## 4. Pass 3 (Advocate) — UX + 보안 (Major 3건)

🟠 **M-1**: schema-validator.test.ts 에 F-100/F-999/F-1000 boundary 어서션 부재 (테스트 회귀 방어 누락)
🟠 **M-2**: zero-pad 충돌 (`F-99` vs `F-099` 둘 다 valid → D1 별도 PK 행) — 패턴 강화 또는 명문화 필요
🟠 **M-3**: F-999 ceiling 재발 우려 — 도메인 prefix ADR 사전 결정 권고

**반론**: F-100 vs F-10 충돌은 패턴상 불가 (F-10 = 2자리, F-100 = 3자리 — `^F-\d{2,3}$` 가 정확히 matching). 다만 zero-pad 케이스 (F-99 vs F-099) 는 실제 발생 가능 — 운영 정책 명문화 의무.

## 5. Pass 4 (Contract) — 기획 대조 (Major 2건)

🟠 **M-4**: L3 영역 변경 (Hard Limit 5 Ontology Lock) 에 정식 ADR 부재 — handoff 노트가 ADR 역할 대체 → ADR-031 작성 권고 (본 보고서와 동시 처리)
🟠 **M-5 ★ blocker**: 본 fix 의 실효성을 무력화하는 9곳 미갱신:

- **`packages/parser/src/batch-processor.ts:113` LLM prompt** = "FORMULA: F-NN (예: F-01)" — Path B (자동 배치 적재) 활성화 시 BATCH-6+ LLM 이 F-100 산출 거부 가능
- **`docs/architecture/LLM_CONTAINMENT.md:85`** = `F-\d{2}` 직접 표기 (사실관계 오류)
- **`docs/engines/parser/research.md:25`** = 동일 사실관계 오류

**반론 (시나리오 D — M-5)**: 진산님 메모리 `project_batch_load_workflow` 정합으로 현 시점 Path A (Claude Code 직접 처리) 만 사용 — batch-processor.ts 미사용. 그러나 미래 Path B 부활 시 즉시 영향 발생.

## 6. 본 세션 fix (3건) + 명시 이월 (3건)

### 6.1 본 세션 즉시 처리 (M-4, M-5 일부)

|   MAJOR   | 처리                                   | 변경 파일                                                 |
| :-------: | :------------------------------------- | :-------------------------------------------------------- |
|    M-4    | ADR-031 작성                           | `docs/adr/ADR-031-formula-id-pattern-expansion.md` (신규) |
| M-5 (1/3) | batch-processor.ts:113 LLM prompt 갱신 | `packages/parser/src/batch-processor.ts:113~119`          |
| M-5 (2/3) | LLM_CONTAINMENT.md:85 사실관계 정정    | `docs/architecture/LLM_CONTAINMENT.md:85`                 |
| M-5 (3/3) | research.md:25 사실관계 정정           | `docs/engines/parser/research.md:25`                      |

### 6.2 명시 이월 (다음 step / Phase 2)

| MAJOR | 이월 사유                                                | 처리 시점                         |
| :---: | :------------------------------------------------------- | :-------------------------------- |
|  M-1  | 테스트 회귀 방어 강화 — 본 fix scope 외                  | 다음 step 첫 태스크               |
|  M-2  | zero-pad 충돌 정책 명문화 — 진산 메모리 명시 결정 의무   | 다음 BATCH 적재 진입 시           |
|  M-3  | F-999 ceiling 도메인 prefix ADR — Phase 2 진입 시 재검토 | Phase 2 / Year 2 멀티시험 진입 시 |

## 7. 판정 + 후속

**판정: 완료 가능 (CRITICAL 0건 + M-4/M-5 fix 완료 + M-1/M-2/M-3 명시 이월)**

본 fix + 본 세션 후속 fix (M-4 ADR / M-5 3 파일) 모두 완료. handoff-046 §3.2 부채 ledger 에 명시 이월 3건 (M-1, M-2, M-3) 영속.

본 시점 = "BATCH-5 적재 완료 + ontology-registry v1.2.0 정합 + 4-Pass 리뷰 통과" 로 BATCH-N+ 적재 진입 가능.

## 8. 영속 산출물

- 본 통합 보고서: `.claude/reviews/review-20260506-091948-ontology-registry-fix-summary.md`
- Pass 1+2 보고서: `.claude/reviews/review-20260506-ontology-registry-fix-pass12.md`
- Pass 3+4 보고서: `.claude/reviews/review-20260506-ontology-registry-fix-pass34.md`
- ADR-031: `docs/adr/ADR-031-formula-id-pattern-expansion.md`
- 본 fix 직접 변경:
  - `packages/parser/src/ontology-registry.json` (version 1.2.0 + 2 pattern)
  - `packages/parser/src/batch-processor.ts:113~119` (LLM prompt 갱신)
  - `docs/architecture/LLM_CONTAINMENT.md:85` (사실관계 정정)
  - `docs/engines/parser/research.md:25` (사실관계 정정)
