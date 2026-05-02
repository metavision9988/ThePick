# Review — batch loader page_ref 트리거 정규식 회귀 fix (commit 48545f3)

작성일: 2026-05-02 ~18:25 KST
세션: 035 (Group A 잔여 2건 진입 직전 verify 의무 처리 부수효과)
리뷰 방식: **독립 에이전트** (`pr-review-toolkit:silent-failure-hunter`, agentId `a73327b5c71fc1d3c`)
리뷰 범위: 변경 파일 1개 + 연관 파일 9개

## 변경 본질

| 항목      | 값                                                                                                            |
| :-------- | :------------------------------------------------------------------------------------------------------------ |
| Commit    | `48545f3` — fix(batch): loader page_ref 트리거 정규식 0010+0018 redundancy 정합 — verify 회귀 흡수            |
| 변경 파일 | `apps/batch/src/__tests__/loader.test.ts:207-216` (정규식 1줄 + 설명 1줄)                                     |
| 트리거    | review-gate.sh hook (코드 변경 1건 감지 → 독립 에이전트 위임 의무 발화)                                       |
| 회귀 종류 | 직전 세션(034) commit `2d10ed9` (마이그레이션 0018) + `3a39310` (SCENARIO_MIGRATIONS 0001~0018 확장) 부수효과 |

## 리뷰 결과 종합

| Pass               | CRITICAL | MAJOR | MINOR | PASS  |
| :----------------- | :------: | :---: | :---: | :---: |
| Pass 1 (Surgeon)   |    0     |   2   |   2   |   4   |
| Pass 2 (Architect) |    0     |   1   |   2   |   5   |
| **합계**           |  **0**   | **3** | **4** | **9** |

판정: **수정 권고** — fix 자체는 OK이나 "의도된 redundancy" 영속 보장 부족.

## MAJOR 3건 분류

### MAJOR-1 — 정규식이 0010 silent regression 을 가린다 (Pass 1)

**위치:** `apps/batch/src/__tests__/loader.test.ts:215`
**문제:** 새 정규식 `/page_ref is required|Hard Rule 13 violation/` 는 두 메시지 중 하나만 매치되면 PASS. 미래에 0010 트리거가 silently DROP 되거나 WHEN 조건 깨져 NULL 케이스에 대해 0010 fire 안 해도 0018 만 fire 하면 테스트 PASS → 0010 회귀를 본 테스트가 더 이상 잡지 못함.

**Devil's Advocate:** 누군가 미래에 0010 의 `enforce_knowledge_nodes_page_ref_not_null` 트리거를 "0018 과 중복" 명목으로 DROP 마이그레이션 추가 → 0010 의 빈 문자열(`page_ref = ''`) 차단 superset 사라짐 → 본 테스트는 여전히 PASS (NULL 은 0018 이 잡으므로) → 빈 문자열 page_ref INSERT 통과 → 출처 추적성 무력화 → production-quality.md "근거 0건 = approved 차단" silent 위반.

**상태:** 본 commit 후속 처리에서 흡수 (트리거 등록 invariant 검증 테스트 추가).

### MAJOR-2 — 빈 문자열 page_ref 차단 회귀 방어선 부재 (Pass 1)

**위치:** `apps/batch/src/__tests__/loader.test.ts` 전체, `apps/api/src/__tests__/scenarios/hard-rule-13-draft-only.test.ts` 전체
**문제:** 0010 트리거의 strict-superset 영역인 `page_ref = ''` 케이스 명시적 회귀 테스트가 레포 어디에도 없음. 0018 주석은 "0010 회수 시 본 트리거를 NULL+빈 문자열 양쪽 차단으로 강화 의무" 명시하나, 빈 문자열 차단이 작동하는지 검증하는 테스트 없으면 "강화 의무" 자체가 회귀 게이트 부재.

**Devil's Advocate:** loader 코드 회귀 (page_ref 누락 시 default `''` 주입) 또는 admin UI 에서 빈 문자열 직접 INSERT 시도 → 0010 트리거 silently 깨지면 빈 문자열 통과 → 출처 추적성 0건 노드 draft 적재 → Reviewer "근거 보기" UX 무용.

**상태:** 본 commit 후속 처리에서 흡수 (빈 문자열 차단 테스트 추가).

### MAJOR-3 — SCENARIO_MIGRATIONS 두 wrapper 분기 + handoff 경로 오류 (Pass 2)

**위치 1:** `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:38-57` — 명시적 `SCENARIO_MIGRATIONS` 배열 18개 하드코딩 (0001~0018), **신규 마이그레이션 추가 시 수동 갱신 의무**.
**위치 2:** `apps/batch/src/loader/local-db.ts:51-78` — `readdirSync(migrationsDir).filter('.sql').sort()` 자동 적용.
**위치 3:** handoff-035 §0.1 명시 위치 (`apps/batch/src/__tests__/d1-from-sqlite.ts`) ≠ 실제 위치 (`apps/api/src/__tests__/helpers/d1-from-sqlite.ts`).

**문제:** 미래에 0019 마이그레이션 추가 시 `d1-from-sqlite.ts:38-57` 갱신 망각하면 api 테스트가 0019 트리거 영향을 받지 못한 채 PASS → 본 commit 과 동일 패턴의 verify 회귀 재발 위험.

**Devil's Advocate:** 0019 에서 page_ref VARCHAR 길이 제약 추가 + SCENARIO_MIGRATIONS 갱신 누락 → loader.test.ts 는 0001~0018 전체 자동 적용으로 PASS, hard-rule-13-draft-only.test.ts 는 0019 미적용 → 두 테스트 모순으로 verify 308/285 분리 디버깅 지옥.

**상태:** 본 commit 범위 외. handoff-035 §0.1 경로 정정 + tech-debt ledger 이월 (Sprint 2 초기 처리 — Phase 2 ledger 진입).

## MINOR 4건 (참고)

| ID      | 위치                                                             | 영역   | 상태                     |
| :------ | :--------------------------------------------------------------- | :----- | :----------------------- |
| MINOR-1 | `loader.test.ts:215` 좌측 alternation 다중 테이블 false-positive | Pass 1 | 영향 제한적 보류         |
| MINOR-2 | `loader.test.ts:207` description "redundancy" 의도 약하게 표현   | Pass 1 | MAJOR-1 흡수로 자동 해소 |
| MINOR-3 | `migrations/0018:28-31` 0010 회수 차단 ADR/gate 부재             | Pass 2 | tech-debt ledger 이월    |
| MINOR-4 | handoff-035 §0.1 경로 명시 오류                                  | Pass 2 | MAJOR-3 와 동일 처리     |

## 처리 결정 (메인 대화)

`feedback_no_granular_decisions` 메모리 정합 — 품질 지엽 결정은 진산님께 묻지 않고 최상 품질 기본값:

- **MAJOR-1 + MAJOR-2 즉시 흡수** (본 commit 직접 부수효과, 의도된 redundancy 영속 직접 보장)
  - loader.test.ts 에 2 tests 추가 (트리거 등록 invariant + 빈 문자열 차단)
  - verify-engine-contracts.ts:148 batch required 309 → 311 동시 갱신
  - 후속 commit 으로 영속
- **MAJOR-3 별도 처리** (본 commit 범위 외, 구조 부채)
  - handoff-035 §0.1 경로 정정 (본 세션)
  - SCENARIO_MIGRATIONS 자동 readdir 전환은 Sprint 2 tech-debt ledger 이월

## 4-Pass 면제 사유 (참고)

본 fix 는 1줄 정규식 변경으로 auto-review-protocol.md L1 면제 대상. 그러나 review-gate.sh hook 이 코드 변경 자체를 감지하므로 강제 실행. **L1 회귀 fix 라도 silent failure 위험은 존재** — 본 리뷰가 즉시 MAJOR 3건 발견한 사실이 hook 의 정당성 입증.

## 관련 파일

- `/home/soo/ClaudePro/ThePick/apps/batch/src/__tests__/loader.test.ts` (변경 본체)
- `/home/soo/ClaudePro/ThePick/migrations/0010_status_transitions_and_page_ref_guard.sql` (NULL+빈문자열 strict superset)
- `/home/soo/ClaudePro/ThePick/migrations/0018_enforce_draft_only_insert.sql` (NULL only + Hard Rule 13)
- `/home/soo/ClaudePro/ThePick/apps/api/src/__tests__/helpers/d1-from-sqlite.ts` (실제 SCENARIO_MIGRATIONS 위치)
- `/home/soo/ClaudePro/ThePick/apps/batch/src/loader/local-db.ts` (자동 readdir)
- `/home/soo/ClaudePro/ThePick/apps/api/src/__tests__/scenarios/hard-rule-13-draft-only.test.ts` (e2e — 0018 트리거 2종 등록만 검증, 0010 미커버)
- `/home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts:148` (batch required 309)

## 후속 commit 검증 의무

- pnpm --filter @thepick/batch test → **311/311 PASS**
- verify-engine-contracts.ts → **EXIT 0**, 모노레포 1174/1174 PASS, overallStatus PASS
- verify JSON 영속 갱신 (`.claude/reports/sprint1-step5-5-verify-after-group-a-20260502.json`)
- handoff-035 §0.1 경로 정정 (`apps/batch/src/__tests__/d1-from-sqlite.ts` → `apps/api/src/__tests__/helpers/d1-from-sqlite.ts`)
