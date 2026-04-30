# 4-Pass 자동 리뷰 — Step 16a 옵션 B (Phase 이월 부채 흡수 + 진산님 신규 명시 2건)

**리뷰 방식: 독립 에이전트 2종 병렬** (Pass 1+2 통합 / Pass 3+4 통합 — auto-review-protocol.md 규칙 0 최소 구성).
**리뷰 일시:** 2026-04-30 17:30~17:55 KST.
**대상 변경:** Step 16a 직후 옵션 B (Phase 이월 부채 흡수) + 진산님 명시 2건 (종합 테스트 + Observability) 영속화.
**대상 commit:** (예정 — 본 review 직후 commit)
**최종 판정:** **완료 가능** (CRITICAL 0건 / MAJOR 2건 모두 차세션 권고).

---

## 0. 메타

| 항목               | 값                                                           |
| :----------------- | :----------------------------------------------------------- |
| 리뷰 방식          | 독립 에이전트 2종 병렬 (Pass 1+2 / Pass 3+4)                 |
| 1차 에이전트       | general-purpose × 2                                          |
| 1차 CRITICAL       | 0건                                                          |
| 1차 MAJOR          | 2건 (모두 차세션 권고)                                       |
| 차세션 흡수 의무   | 5건 (M-1/M-2 + 반론 R-1/R-2/R-3)                             |
| 회귀 검증          | **모노레포 전체 883/883 PASS** + typecheck PASS              |
| 진산님 명시 트리거 | "기술 부채 0 정책" + 종합 테스트 + Observability — 모두 흡수 |

---

## 1. 변경 범위

### 1.1 변경 파일 (4 + 메모리 3)

수정:

- `apps/batch/src/loader/draft-loader.ts` — `BATCH_RUN_ID_PATTERN` 신설 + preValidate 이중 방어 (M-1 + M-2)
- `apps/batch/src/__tests__/loader.test.ts` — 신규 2 테스트 + minimalContract() fixture 정정 ('FORMULA-001' → 'F-99' silent 결함 발견 + 수정)
- `apps/batch/src/loader/__tests__/build-source-id.test.ts` — 신규 3 테스트 (M-3 multi-byte: 1024자 ASCII / 한글·일본어·이모지 / 제어 문자)
- `docs/plans/engine-hardening/ROADMAP.md` §8 — 종합 테스트 + Observability + 완료 시점 알림 3 게이트 추가

신규 (영속화):

- `docs/quality/master-test-checklist.md` v0 (8 카테고리 골격)
- `~/.claude/.../memory/project_completion_notification_obligation.md`
- `~/.claude/.../memory/project_engine_observability.md`
- `~/.claude/.../memory/MEMORY.md` 인덱스 +2

### 1.2 검증 결과

| 패키지                    | 결과                                                        |
| :------------------------ | :---------------------------------------------------------- |
| `@thepick/batch`          | **210/210 PASS** (직전 205 + 신규 5: M-1 1 + M-2 1 + M-3 3) |
| `@thepick/parser`         | 136/136 PASS (회귀 0)                                       |
| `@thepick/quality`        | 41/41 PASS (회귀 0)                                         |
| `@thepick/formula-engine` | 251/251 PASS (회귀 0)                                       |
| `apps/api`                | 199/199 PASS (회귀 0)                                       |
| `@thepick/shared`         | 33/33 PASS (회귀 0)                                         |
| `@thepick/ai-adapter`     | 13/13 PASS (회귀 0)                                         |
| **모노레포 전체**         | **883/883 PASS**                                            |
| typecheck (15 pkg)        | PASS                                                        |

### 1.3 ★ 중요 발견 — silent fixture 결함 4건 자동 발견 (Pass 3 M-2 흡수의 의도된 효과)

기존 `minimalContract()` 의 `nodes[1].id = 'FORMULA-001'` 이 ontology-registry 패턴 'F-NN' (`^F-\d{2}$`) 미일치인데도 `validateKnowledgeContract` 우회로 silent pass 해왔던 결함. M-2 흡수 (preValidate 에 `isValidNodeId` 추가)가 패턴 강제 → 즉시 4건 회귀 발생 → `'F-99'` 정정 후 모두 PASS.

**진산님 "기술 부채 0 정책" 정합** — 의도된 효과로 silent 결함 1건 자동 정정. master-test-checklist v1 작성 시 "fixture ontology 패턴 일관성 grep 자동 검증" 카테고리 신설 권고 (반론 R-3).

---

## 2. Pass 1+2 통합 (SURGEON + ARCHITECT) — ✅ 15건 / 🔴 0 / 🟠 0

**Agent:** general-purpose / **판정:** 완료 가능

### 2.1 Pass 1 SURGEON (10건)

|  #  | 위치                             | 확인                                                                                                         |
| :-: | :------------------------------- | :----------------------------------------------------------------------------------------------------------- |
|  1  | `draft-loader.ts:29`             | `BATCH_RUN_ID_PATTERN /^[a-zA-Z0-9_-]{8,128}$/` — UUID v4 (36자) + fixture 19자 PASS, 임의 외부 trigger 차단 |
|  2  | `draft-loader.ts:166-171`        | 빈문자열 차단 → 패턴 차단 순서 정합                                                                          |
|  3  | `draft-loader.ts:189-196`        | `isValidNodeId(n.type as NodeType, n.id)` 캐스트 안전 (unknown type → undefined → false → throws)            |
|  4  | `draft-loader.ts:191`            | M-2 = schema-validator(packages/parser:215) 와 동일 함수 — 단일 진실 소스 (ontology-registry.json)           |
|  5  | `draft-loader.ts:182-197`        | source_page → nodeId 패턴 검증 순서 정합. 음수 source_page 회귀 0                                            |
|  6  | `loader.test.ts:22-33`           | fixture 'FORMULA-001' → 'F-99' 정정 silent 결함 즉시 발견                                                    |
|  7  | `loader.test.ts:108-121`         | M-1 negative 3 케이스 (길이 7 / 특수 / 한글) 적절                                                            |
|  8  | `loader.test.ts:131-141`         | source_id 어설션 'F-99' 동기                                                                                 |
|  9  | `build-source-id.test.ts:75-104` | M-3 1024자/한글/이모지/제어문자 결정성 100회 반복                                                            |
| 10  | 변경 파일 4개                    | stub/TODO/HACK 0건                                                                                           |

### 2.2 Pass 2 ARCHITECT (5건)

|  #  | 위치                                   | 확인                                                                                 |
| :-: | :------------------------------------- | :----------------------------------------------------------------------------------- |
|  1  | `apps/batch → packages/parser`         | 단방향 의존성 정합 (Hexagonal 위반 0)                                                |
|  2  | `NodeType import from @thepick/shared` | Hard Rule 15 Year 1 한시 예외 정합 (메모리 정합)                                     |
|  3  | `isValidNodeId` 이중 방어              | schema-validator + draft-loader.ts 양쪽 — 성능 영향 낮음 (정규식 1회)                |
|  4  | fixture 정정                           | 모노레포 전체 883/883 PASS — 회귀 0                                                  |
|  5  | 4-way 정합                             | ROADMAP §8 + 메모리 2건 + master-test-checklist v0 + plan v1.2 — Silent Pivot 신규 0 |

### 2.3 반론 (4건)

- A) batchRunId 생성 경로 ISO timestamp 호환성 명시 검증 (16b/16c)
- B) ADR-007 Year 2 Phase 4 ExamAdapter 전환 시 isValidNodeId 호출 동반 마이그레이션
- C) 다른 fixture 파일 동일 silent 결함 가능성 — master-test-checklist v1 자동 검증
- D) D1/Vectorize round-trip 결정성 — master-test-checklist v1 E2E 카테고리 명시

---

## 3. Pass 3+4 통합 (ADVOCATE + CONTRACT) — ✅ 13건 / 🔴 0 / 🟠 2

**Agent:** general-purpose / **판정:** 완료 가능

### 3.1 Pass 3 ADVOCATE (8건)

|  #  | 위치                                       | 확인                                                                                    |
| :-: | :----------------------------------------- | :-------------------------------------------------------------------------------------- |
|  1  | `draft-loader.ts:29 + :166-171`            | SQL injection + DoS (128자 상한) 추가 방어                                              |
|  2  | `draft-loader.ts:189-196`                  | ontology 이중 방어 — schema-validator 우회 fixture seed 차단. silent 결함 4건 즉시 발견 |
|  3  | `build-source-id.test.ts:75-104`           | M-3 UTF-8 안전성. 정상 흐름은 caller 가 차단, 헬퍼 자체는 결정성 보장 — 분리 정합       |
|  4  | `draft-loader.ts:168`                      | 에러 메시지 운영자 식별성 우수                                                          |
|  5  | `master-test-checklist.md v0`              | 8 카테고리 진산님 의도 정합, v0 → v1 차세션 의무 명시                                   |
|  6  | `project_engine_observability.md 8 게이지` | 자동차 계기판 메타포 정합 + Cloudflare 단일 벤더                                        |
|  7  | 변경 파일 4개                              | stub/TODO 0건                                                                           |
|  8  | PII / 로그 마스킹                          | knowledge_nodes PII 0, batchRunId PII 0                                                 |

### 3.2 Pass 4 CONTRACT (5건)

|  #  | 위치                          | 확인                                                                        |
| :-: | :---------------------------- | :-------------------------------------------------------------------------- |
|  9  | `handoff-022 §0.4/§4.8`       | Phase 이월 부채 3건 모두 본 세션 흡수 → 트래킹 항목 해소                    |
| 10  | `loader.test.ts` fixture 정정 | 'FORMULA-001' (위반) → 'F-99' silent pivot 명시화                           |
| 11  | `ROADMAP §8`                  | 신규 4 항목 (★ 종합 테스트 / Observability / Phase 이월 0 / 완료 시점 알림) |
| 12  | CRITICAL RULE #1~7            | 모두 준수                                                                   |
| 13  | 메모리 신규 2건               | type: project, MEMORY.md 인덱스 갱신                                        |

### 3.3 🟠 MAJOR 2건 (모두 차세션 권고)

**M-1: BATCH_RUN_ID_PATTERN 8자 하한 vs UUID-strict 트레이드오프**

- 외부 trigger nanoid 6자 사용 시 차단. crypto.randomUUID() / ULID 호환.
- 권고: 차세션 BATCH-1 trigger 작성 시 caller 책임 문서화 + ROADMAP §8 "trigger caller UUID v4 강제" 명시.

**M-2: master-test-checklist v0 → v1 numeric PASS 기준 부재**

- v0 골격이 "tests / 패키지" 메타 분류만. v1 시점에 각 체크 항목별 PASS 기준 (numeric/boolean) 명시 의무.
- 권고: handoff-023 §"v1 작성 의무" 에 "각 체크 항목별 numeric/boolean + golden test 직접 호출" ★★★ 표기.

### 3.4 반론 (3건)

- R-1) M-1 nanoid 6자 hint 부재 → 차세션 trigger 작성 시 hint 추가
- R-2) Observability v0 → v1 단계별 활성 게이지 (Phase 1: 7 / Phase 2: 8) 명시
- R-3) 다른 fixture 파일 ontology 위반 ID grep 전수 점검 (master-test-checklist v1 §"fixture 일관성")

---

## 4. 최종 판정

### 4.1 16a 옵션 B commit 가능

**근거:**

- CRITICAL 0건
- MAJOR 2건 모두 차세션 권고 (본 세션 차단 사유 아님)
- 회귀 0건 (모노레포 883/883 PASS + typecheck PASS)
- silent 결함 4건 자동 발견 + 정정 (Phase 이월 부채 흡수의 의도된 효과)
- 4-way 정합 (ROADMAP + 메모리 + master-test-checklist + plan) — Silent Pivot 신규 0
- handoff-022 §0.4/§4.8 Phase 이월 부채 3건 모두 해소

### 4.2 차세션 흡수 의무 (5건)

|  #  | 항목                                                            | 처리 시점                  |
| :-: | :-------------------------------------------------------------- | :------------------------- |
| M-1 | BATCH-1 trigger caller UUID v4 강제 + nanoid hint               | Step 16b 진입 시           |
| M-2 | master-test-checklist v1 numeric/boolean PASS 기준              | 차세션 v1 작성 시          |
| R-1 | trigger 작성 시 nanoid hint 에러 메시지                         | Step 16b 진입 시           |
| R-2 | Observability phase 별 활성 게이지 단계 명시                    | Observability 본격 작성 시 |
| R-3 | fixture ontology 패턴 grep 전수 점검 (master-test-checklist v1) | 차세션 v1 작성 시          |

---

## 5. 메타 통계

| 항목           | 값                                                      |
| :------------- | :------------------------------------------------------ |
| 1차 호출       | 2 agent 병렬 (Pass 1+2 / Pass 3+4)                      |
| 총 duration    | ~25분                                                   |
| 총 token       | ~156K (74K + 82K)                                       |
| 본 step commit | (예정)                                                  |
| 신규 영속화    | 메모리 2건 + master-test-checklist v0 + ROADMAP §8 갱신 |

---

**리뷰 작성자:** Claude (Opus 4.7) — 본 세션 메인 컨텍스트가 2 독립 agent 결과를 종합. 2 agent 자체는 독립 컨텍스트 (auto-review-protocol.md 규칙 0 준수).
