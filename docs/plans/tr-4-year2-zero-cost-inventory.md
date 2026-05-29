# TR-4 — Year 2 zero-cost 전환 위반 인벤토리 (코드 변경 0, 결재 자료)

> **위치**: 5-페르소나 통합 인덱스 §6 TR-4 / §3 진앙 #2 — 진산 결재 Q4 = "인벤토리만 즉시, 실시행 별도 결재"
> **목적**: ADR-007 Year 2 zero-cost 의무 (Hard Rule 15~17) 의 **위반 실태를 정량 산출** 하여, 실시행 timing 결재 자료를 제공한다.
> **상태**: 인벤토리(본 파일) = 즉시 / 실시행 plan = 별도 결재 후 작성
> **작성일**: 2026-05-29 (Session 092)

---

## 1. 배경

CLAUDE.md `production-quality.md` Hard Rule 15~17 = Year 2 (공인중개사 등 확장)
진입 시 코드 변경량을 zero-cost 로 만들기 위한 3개 영속 규칙:

- **Rule 15** — 범용 계층 내 시험 특화 분기 금지 (Year 1 한시 예외만 허용)
- **Rule 16** — 데이터 조회 시 첫 인자 `examId: ExamId` 강제 (2단계 선언)
- **Rule 17** — 시험 ID 리터럴 단일 선언 + `ExamId` 타입 경유

본 인벤토리는 5-페르소나 리뷰의 backend-architect (`phase2-tech-debt-20260529-backend.md`)

- refactoring-expert (`phase2-tech-debt-20260529-refactoring.md`) 의 발견을
  **위반 단위로 통합** 한다.

---

## 2. 위반 인벤토리 (5-페르소나 발견 통합)

### 인벤토리-1: 노드 ID 999 천장 + DB GLOB CHECK 잠금 (backend C-1)

| 항목               | 값                                                                                                        |
| :----------------- | :-------------------------------------------------------------------------------------------------------- |
| Hard Rule          | 15 (범용 계층 시험 특화 잠금)                                                                             |
| 위반 파일          | `packages/parser/src/ontology-registry.json:37-47` + `migrations/0021_table_as_micro_kg.sql:71,85-87,102` |
| 잠금 메커니즘      | (a) ontology JSON 정규식 `^LAW-\d{3}$` 등 (b) D1 CHECK GLOB `'TBL-[0-9][0-9][0-9]'` 등                    |
| Year 1 영향        | 손해평가 단독 5~8년 운영 시 cap 도달 가능 (Temporal Graph 누적)                                           |
| Year 2 영향        | 공인중개사 LAW 적재 첫 BATCH 에서 LAW-1000 발생 → 적재 거부 즉시 stop-the-world                           |
| 영향 파일 수       | ontology 1 + 마이그 1 + 적재 코드 (parser/draft-loader)                                                   |
| 전환 비용 (실시행) | ~8h (SQLite CHECK 변경 = 테이블 재생성 마이그)                                                            |
| 권장 timing        | Year 2 진입 전 (자체 D-day 도달 가능성으로 인해 격상 가능)                                                |
| 자세히             | backend §C-1                                                                                              |

### 인벤토리-2: 시험 특화 컬럼 `lv1_insurance`/`lv2_crop`/`lv3_investigation` (refactoring C-1)

| 항목                | 값                                                                                                                                                                                                                                                                                                                                                                   |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hard Rule           | 15 (범용 계층 시험 특화 분기) — 본 항목이 Rule 15 위반의 최대 진앙                                                                                                                                                                                                                                                                                                   |
| 위반 파일 수        | **13 production 파일 / 102 occurrences** (refactoring §C-1 grep)                                                                                                                                                                                                                                                                                                     |
| 핵심 위반 위치      | `packages/parser/src/schema-validator.ts:34-36`, `apps/api/src/vectorize/upserter.ts:73-74`, `apps/api/src/vectorize/routes.ts:115,116,335,375,376`, `apps/api/src/vectorize/table-fetcher.ts:50-51,174-175,217-218,249-250,288`, `apps/api/src/search/multi-path-fallback/topic-cluster-router.ts:8-10,307`, `apps/batch/src/loader/draft-loader.ts:315,334-336` 외 |
| 명명 비대칭 부채    | `topic-cluster-router.ts:8-13` 는 이미 `cluster.lv1 ≠ kn.lv1_insurance` 우회 — 두 번째 시험 진입 시 비대칭이 고착 → 평탄화 사실상 불가                                                                                                                                                                                                                               |
| Year 2 D-day 변경량 | 1 PR 한계 초과 → staged migration 강제 → 중간 상태 INSERT contract mismatch 위험                                                                                                                                                                                                                                                                                     |
| 전환 비용 (실시행)  | 즉시 = ~1주 / Year 2 진입 후 = ~3~4주 + 회귀 위험 (refactoring §C-1)                                                                                                                                                                                                                                                                                                 |
| 권장 timing         | **Year 2 진입 직전 (실시행) — 단 인벤토리는 즉시** ★ §4 권고 = 격상 가능 (refactoring 자기 반박 §C-1: "ADR-007 합의는 LOC 증가 추세 미반영")                                                                                                                                                                                                                         |
| 자세히              | refactoring §C-1                                                                                                                                                                                                                                                                                                                                                     |

### 인벤토리-3: `service: 'thepick-api'` 리터럴 6 파일 복제 (refactoring C-2)

| 항목               | 값                                                                                                                                                                                                                                  |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hard Rule          | 17 (식별 리터럴 단일 선언) 인접 — 직접 시험 ID 는 아니나 동일 패턴                                                                                                                                                                  |
| 위반 파일 수       | **6 production 파일 / 8회 이상 리터럴**                                                                                                                                                                                             |
| 위반 위치          | `apps/api/src/index.ts:138,209`, `apps/api/src/auth/routes.ts:94-103`, `apps/api/src/webhooks/payment.ts:111`, `apps/api/src/progress/routes.ts:62`, `apps/api/src/telemetry/routes.ts:55-64`, `apps/api/src/study/routes.ts:79,93` |
| 추세               | 신규 라우트당 +1 (선형 누적, 1년 후 10+)                                                                                                                                                                                            |
| Year 2 영향        | 멀티시험 진입 시 sub-service 화 자연 수순 (`thepick-api/search` 등) → 부분 분리 불가                                                                                                                                                |
| 전환 비용 (실시행) | ~3h (logger-factory.ts 1 파일 50줄 신설 + 6 라우트 import 치환)                                                                                                                                                                     |
| 권장 timing        | 즉시 가능 (작은 변경, 큰 누적 차단 효과)                                                                                                                                                                                            |
| 자세히             | refactoring §C-2                                                                                                                                                                                                                    |

### 인벤토리-4: BATCH parser 시험 특화 system prompt 144줄 하드코딩 (refactoring M-1)

| 항목               | 값                                                                                                                                                   |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hard Rule          | 15 (범용 계층 시험 특화 분기)                                                                                                                        |
| 위반 파일          | `packages/parser/src/batch-processor.ts:106-249` (144줄 손해평가 도메인 prompt)                                                                      |
| 영향               | Year 2 진입 시 (a) prompt 새 시험용 통째 신규 작성 (b) 두 시험 분기 if 강제 (c) 본 packages/parser/ 범용 위치에서 시험 분기 = Rule 15 신규 위반 발생 |
| 전환 비용 (실시행) | ~6h (`packages/parser-1st-exam/prompts/system.ts` 로 이전 + 어댑터 주입)                                                                             |
| 권장 timing        | Year 2 진입 직전 (parser-1st-exam 패키지 위치 정합)                                                                                                  |
| 자세히             | refactoring §M-1                                                                                                                                     |

### 인벤토리-5: ExamId 리터럴 + Hard Rule 17 lint 강제 부재

| 항목               | 값                                                                                                                                             |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| Hard Rule          | 17                                                                                                                                             |
| 현 상태            | `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 단일 선언 (`packages/shared/src/constants/exam-ids.ts`) 존재. 그러나 ESLint `no-restricted-syntax` 강제 미도입 |
| 위반 검출 메커니즘 | 없음 (수동 grep 만)                                                                                                                            |
| 잠재 위반 영역     | 신규 추가되는 모든 코드 — 누구도 안 보면 모름                                                                                                  |
| 전환 비용 (실시행) | ~2h (ESLint custom rule 추가 + allowlist (exam-ids.ts/주석/픽스처) 설정 + CI 게이트)                                                           |
| 권장 timing        | 즉시 (예방 비용 < 정정 비용)                                                                                                                   |

### 인벤토리-6: examId 파라미터 누락 데이터 조회 함수 (Hard Rule 16)

| 항목                  | 값                                                                                                                                                                                                                                                        |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hard Rule             | 16                                                                                                                                                                                                                                                        |
| 현 상태               | 시험 지식 9 테이블 (`user_progress`, `knowledge_nodes`, `knowledge_edges`, `exam_questions`, `mnemonic_cards`, `formulas`, `constants`, `topic_clusters`, `revision_changes`) 의 데이터 조회 래퍼 함수가 첫 인자 `examId: ExamId` 받는지 전수 점검 미실행 |
| 본 인벤토리 한계      | refactoring 페르소나가 본 영역 미점검 (스코프 외) — 본 plan §3 에 보강 후속 작업 명시                                                                                                                                                                     |
| 전환 비용 (보강 점검) | ~4h (전수 grep + 시그니처 갱신)                                                                                                                                                                                                                           |
| 권장 timing           | 즉시 점검 / 실시행은 묶음 결재                                                                                                                                                                                                                            |

---

## 3. 보강 후속 작업 (인벤토리 결재 후)

본 인벤토리는 refactoring + backend 페르소나가 본 영역에서 본 발견에 한정.
다음은 본 plan 의 보강 점검 후속 (인간 승인 후 별도 plan 으로 진행):

- [ ] Hard Rule 16 전수 점검 — 9 테이블의 데이터 조회 래퍼 함수 시그니처 grep
- [ ] Vectorize 메타데이터 `exam_id` 주입 누락 전수 점검 (ADR-004 §3)
- [ ] BATCH 파이프라인 `exam_id` 추출 경로 검증 (파일명/폴더/메타)
- [ ] `packages/parser-1st-exam/` vs `packages/parser/` 책임 경계 재확인
- [ ] `packages/shared/src/types.ts` 의 Year 1 한시 예외 (NodeType INSURANCE/CROP 등) 의 Year 2 이전 timing 재검토

---

## 4. 권고 (Q4 결재 한도 내) — 인벤토리 실시행 timing

### 4.1 즉시 실시행 권고 (저비용·고예방가치)

- **인벤토리-3** (logger-factory) — ~3h, 추세 차단 효과 큼
- **인벤토리-5** (ESLint Rule 17 강제) — ~2h, 신규 위반 예방

### 4.2 Phase 2 closure 묶음 권고

- **인벤토리-6** (Hard Rule 16 전수 점검) — ~4h

### 4.3 Year 2 진입 직전 묶음 권고

- **인벤토리-2** (lv1_insurance 평탄화) — ~1주
- **인벤토리-4** (BATCH prompt 분리) — ~6h

### 4.4 격상 검토 권고 (자기 반박)

- **인벤토리-1** (ID 999 천장) — 손해평가 단독 5~8년 도달 가능성으로 인해 **TR-2 (Phase 2 closure) 묶음 격상** 가능. 진산 추가 결재 필요.
- **인벤토리-2** (lv1_insurance) — refactoring 자기 반박 = "LOC 증가 추세 미반영" → 즉시안 격상 가능. 진산 추가 결재 필요.

---

## 5. 자기 검증

- **본 인벤토리 = 5-페르소나 발견 통합** — 페르소나 스코프 외 영역 (인벤토리-6) 은 후속 작업으로 명시.
- **권고 timing 의 보수성**: §4.3 "Year 2 진입 직전" 권고는 ADR-007 본문과 정합. 그러나 §4.4 격상 검토 자기 반박은 ADR-007 합의의 가정 (LOC 증가 추세) 을 재평가. 진산 결재 영역.
- **인벤토리 누락 가능성**: refactoring/backend 페르소나가 본 영역 전수 점검은 아니므로 (스코프 분할 결과), §3 보강 후속 의무.
- **자율 실행 차단선**: 본 plan = 인벤토리 영속만 (코드 변경 0). 실시행은 §4 권고 timing 별로 별도 plan + 인간 승인.

---

## 6. 승인 기록

- 5-페르소나 통합 인덱스: `.claude/reviews/phase2-tech-debt-20260529-INDEX.md` §6 TR-4 / §3 진앙 #2 / §5 Q4
- refactoring 보고서: `.claude/reviews/phase2-tech-debt-20260529-refactoring.md` §C-1/C-2/M-1
- backend 보고서: `.claude/reviews/phase2-tech-debt-20260529-backend.md` §C-1
- 진산 인벤토리 결재: **TBD** (본 파일 작성 직후 상신)
- 진산 §4.4 격상 결재: **TBD** (인벤토리 결재 후)
- 실시행 plan 결재: **TBD** (격상 결재 후 timing 별 별도 plan)
