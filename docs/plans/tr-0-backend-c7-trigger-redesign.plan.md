---
phase: 2
step: TR-0 (G-S5 게이트 직전 차단선)
risk_level: L3
approved_by: 진산 (2026-05-30, "다음 진행" 결재 — production 적용은 §6 step6 잔존)
scope:
  - migrations/0038_exam_questions_metadata_update_allow.sql (신설)
  - docs/adr/ADR-046-exam-questions-metadata-update-policy.md (신설)
  - apps/api/src/db/schema.ts (Drizzle 주석/타입 동기 — shape 무변경)
  - docs/plans/s5-6-measurements/README.md ("approved 동결" 절차 보강)
related:
  - 5-페르소나 리뷰: phase2-tech-debt-20260529-INDEX.md §5 Q1 + backend C-7
  - 진산 결재 채택: Q1 B안 (컬럼 화이트리스트)
  - 직접 의존: handoff-091/092 §"다음 할 일" #3 (approved 동결)
  - 동시 해결 후보: backend C-4 (4-way sync) — 본 plan 의 §6 옵션 비교에서 평가
---

# TR-0 plan — `prevent_exam_questions_update` 트리거 재설계

> **현 단계 차단선**: G-S5 pilot golden 검수 게이트(handoff-091 #2)는 통과 가능하나,
> 그 다음 단계 **approved 동결**(handoff-091 #3) 에서 `exam_questions.related_nodes`
> 백필 UPDATE 가 트리거에 의해 ABORT 됨. 즉 진산 검수 완료 시점에 즉시 막힘.
> 본 plan = 5-페르소나 리뷰 backend C-7 권장 §1·§2 의 정상화 경로.

> ⚠️ **2026-05-29 Session 093 선결 정정 (사전심사 반영)**: 본 plan 을 적대검증
> 워크플로우(`.claude/reviews/review-20260529-133629-dual-gate-prescreen.md`)로
> 사전심사한 결과 게이트 A 결재 전 CRITICAL 6건 정정 필요가 식별됨. 그 중
> **실코드 대조로 검증된 사실 오류**(§2 의 "0008 정책 트리거" 유령 참조 + 컬럼 분류
> 2건 누락)는 본 개정에서 직접 정정했고, **진산 결정 사항 3건**(WHEN-절 극성 /
> status 전이 정책 / calc_variables 보호등급)은 **§2.1 에 OPEN 으로 명시**(Claude
> 자율 결정 금지 — L3·보안·북극성). Binary Gate 는 §5.1 에서 G-TR0-6/9/10/11/12
> 보강. 교차검증: dogfood 4-Pass(`review-20260529-135905-4pass-changes.md`)
> MINOR #5/#6 가 동일 결함을 독립 재확인. **본 정정은 사실 교정·결정 표면화이며
> 설계(A안 컬럼 화이트리스트)는 불변 — Silent Pivot 아님.**

## 1. 목적 (1~2 문장)

손해평가사 545 기출 `exam_questions.related_nodes` (Q↔node golden 라벨) 백필을
가능하게 하되, **본문 컬럼(content/answer/explanation) 의 Temporal Graph 보호는
유지**한다. AI 생성 → 진산 검수(approved) 워크플로우의 첫 실코드 게이트를 정상
경로로 통과시킨다 (Hard Limit 위반 0).

## 2. 배경

- **발견**: phase2-tech-debt-20260529-backend.md §C-7 (라인 308~)
- **트리거 본체**: `migrations/0004_temporal_guard_extension.sql:39-43`
  ```sql
  CREATE TRIGGER IF NOT EXISTS prevent_exam_questions_update
  BEFORE UPDATE ON exam_questions
  BEGIN
    SELECT RAISE(ABORT, 'UPDATE on exam_questions is forbidden. Use INSERT + superseded_by + valid_until pattern.');
  END;
  ```
- **현 production**: 545 행 전부 `related_nodes IS NULL` (CLAUDE.md §6, 2026-05-15 라이브 확인).
- **진산 결재 (2026-05-29)**: Q1 = **B안** = `prevent_exam_questions_static_update`
  로 재설계, 컬럼 화이트리스트 (`related_nodes` UPDATE 허용).
- **컬럼 분류 (schema.ts:319-345 실코드 22컬럼 전수 — 2026-05-29 정정)**:

  | 분류                               | 컬럼 (schema.ts 라인)                                                                                                                     | 0038 트리거 처리            |
  | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------- |
  | **본문 (SUPERSEDES 의무 = ABORT)** | `content`(325) `answer`(326) `explanation`(327) `subject`(324) `year`(321) `round`(322) `question_number`(323) `exam_type`(334)           | ABORT                       |
  | **메타 (UPDATE 허용 = 백필/라벨)** | `related_nodes`(331) `related_constants`(332) `topic_cluster`(335) `memorization_type`(336) `confusion_type`(337) `input_type`(339, 0032) | 허용                        |
  | **메타·보호등급 OPEN (§2.1)**      | `distractors`(340, 객관식 오답 후보 = 학습자 노출 답안안전 표면) / `calc_variables`(341, Formula Engine 입력변수 = L3)                    | 결정 전까지 ABORT 보수 적용 |
  | **상태 머신 (§2.1 D-2)**           | `status`(333) `superseded_by`(330) `valid_until`(329) `valid_from`(328)                                                                   | D-2 결정                    |
  | **불변 (UPDATE 무의미 = ABORT)**   | `id`(320, PK) `created_at`(342)                                                                                                           | ABORT                       |

  > 직전 plan 의 본문8+메타6+상태4=18 분류는 `confusion_type`·`calc_variables` 2컬럼을
  > 누락했었다(사전심사 CRITICAL #3, dogfood MINOR #6 독립 재확인). 위 표가 실코드 22컬럼
  > 전수. 마이그 0038 WHEN 절 본문 enumeration 은 **위 본문 8 + 불변 2 컬럼 기준**으로
  > 작성하고, ADR-046 이 본 표를 schema.ts 와 1:1 대조 동결한다.

- **상태 전이 경로 (★사전심사 CRITICAL #1/#4/#5 정정 — "0008 가드 보호"는 거짓)**:
  - 실코드 확인: exam_questions `status`(active/deprecated/flagged) 전이를 보호/허용하는
    **별도 가드는 존재하지 않는다**. `migrations/0008` = `webhook_events` 전용(무관),
    `migrations/0010` status_transitions CHECK = `target_type IN ('node','formula','constant')`
    로 **exam_question 미커버**(0010:27), `0004:13-14` 가 약속한 `deprecate_exam_question()`
    저장 프로시저는 SQLite 미지원으로 **미구현**. 즉 현재 exam_questions.status 는 0004 전면
    ABORT 로 INSERT 값에 **영구 동결** 상태.
  - → 0038 이 status 를 본문(ABORT)으로 둘지, 0010 일방향 전이 가드 패턴을 이식할지 =
    **미설계 = §2.1 D-2 진산 결재**. flagged 노드 학습자 비노출(backend C-6)과 직결되므로
    임의 결정 금지.

## 2.1 진산 선결 결재 항목 (사전심사 CRITICAL 6 대응 — OPEN, 자율 결정 금지)

> 아래 3건은 보안/L3/북극성 결정이라 Claude 가 결정하지 않는다. 게이트 A 결재 시 택1.
> 결정 후 ADR-046 Draft 에 동결 → 마이그 0038 SQL 착수(인간 승인 후).

| #       | 결정 항목                 | 옵션                                                                                                                                                      | 권고 기본값                                                                                 | 영향                                                            |
| :------ | :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ | :-------------------------------------------------------------- |
| **D-1** | WHEN-절 극성              | (a) default-deny: 메타 화이트리스트만 명시 허용, 그 외 ABORT / (b) default-allow: 본문·불변만 명시 ABORT, 그 외 허용                                      | **(a) default-deny** — 신규 컬럼 추가 시 자동 보호(망각 안전). 단 D-3 가 메타여야 백필 가능 | 신규 컬럼 보호 망각 위험 ↔ 메타 백필 유연성                     |
| **D-2** | status 전이 경로          | (a) status 를 본문처럼 ABORT 유지(현 동결 지속) / (b) 0010 일방향 전이 가드 패턴을 exam_questions 에 이식(active→deprecated/flagged 허용, downgrade 차단) | 본 plan 범위면 **(a)**, 운영 필요 시 (b) 별도 plan 분리                                     | deprecate/flagged 운영 가능성 + backend C-6 flagged 비노출 불변 |
| **D-3** | `calc_variables` 보호등급 | (a) 본문급 ABORT(답안 산식 무결성 최우선) / (b) 메타 허용(0032 가 BATCH 대상으로 추가)                                                                    | **진산 결재 필수** — L3 Formula Engine 결합, 자율 금지                                      | 답안 정확도 회귀 ↔ calc BATCH 백필 가능성                       |

> ✅ **진산 결재 (2026-05-29 Session 093)**: **D-1 = (a) default-deny** / **D-2 = (a) status ABORT 유지** /
> **D-3 = (a) calc_variables 본문급 ABORT**. ⇒ 허용 6(related_nodes/related_constants/topic_cluster/
> memorization_type/confusion_type/input_type) / ABORT 16(본문8+상태4+distractors+calc_variables+id+created_at).
> 동결처 = `docs/adr/ADR-046-exam-questions-metadata-update-policy.md` (Draft, 진산 Accepted 대기).

> **표기 혼선 플래그 (진산 확인 요망)**: §4.1 의 "A안"(순수 컬럼 화이트리스트) = Q1 결재
> 문구 "컬럼 화이트리스트"의 실체 = 채택 대상. §2 배경의 "Q1=B안=prevent*exam_questions*
> static_update" 표기는 동일 대상이나 §4.1 A/B 라벨과 충돌 → 사전심사 4 리뷰어는 §4.1
> 프레이밍으로 "A안(순수 화이트리스트)" 만장일치 권고. ADR-046 에서 라벨 단일화 필요.
> 추가: `distractors`(객관식 오답 후보)는 D-1 극성과 무관히 답안안전 표면이므로 보호등급
> 별도 명시 권장(사전심사 MAJOR).

> ✅ **D-4 (2026-05-29 4-Pass MAJOR-1) — 진산 결재 2026-05-30 = (a) SUPERSEDES 경로**: `distractors` 직접 UPDATE 백필(Step 3-UX-7c
> 파이프라인 `PUT /api/admin/distractors` 설계)이 0038 distractors ABORT 와 충돌(forward-compat 트랩).
> ✅ 채택 = **(a) SUPERSEDES** (신규 INSERT + superseded_by, 직접 UPDATE 금지). 옵션표 = ADR-046 §D-6.
> 0038 = distractors ABORT **유지(불변, 정합)**. Step 3-UX-7c `PUT` 직접 UPDATE → **SUPERSEDES 재설계**(7c 착수 시 선결, distractor.ts/phase3 plan 동기). 현 7c 미구현=무파손. [[project_multi_source_choice_basis_track]] 연결.

## 3. 대상 파일

| 파일                                                                              | 종류      | 변경 내용                                                                                                                                                                                                                                                                                                                           |
| :-------------------------------------------------------------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrations/0038_exam_questions_metadata_update_allow.sql`                        | 신규      | 기존 `prevent_exam_questions_update` DROP + `prevent_exam_questions_body_update` CREATE (WHEN 절로 본문 컬럼 변동 시만 ABORT). 화이트리스트 컬럼 docstring 명시.                                                                                                                                                                    |
| `docs/adr/ADR-046-exam-questions-metadata-update-policy.md`                       | 신규      | **§2 의 22컬럼 4분류(본문/메타/상태/불변) 1:1 대조표를 schema.ts 와 동결** + §2.1 D-1(WHEN 극성)·D-2(status 전이)·D-3(calc_variables 등급) 결정 기록 + Phase B(보기별 라벨) 카운터 게이트 + Hard Limit "knowledge_nodes/formulas UPDATE 금지" 와 본 정책 관계 분리 + 신규 컬럼 추가 시 분류 체크리스트. (A안/B안 라벨 단일화 포함.) |
| `apps/api/src/db/schema.ts`                                                       | 주석 동기 | shape 무변경, 본문/메타데이터 구분 주석만 추가. NC-1 invariant 영향 0.                                                                                                                                                                                                                                                              |
| `docs/plans/s5-6-measurements/README.md`                                          | 보강      | "approved 동결" 절차의 backfill UPDATE 가 이제 허용됨을 명시 + 마이그 0038 적용 게이트 추가.                                                                                                                                                                                                                                        |
| `apps/api/src/__tests__/migrations/0038-metadata-update.test.ts` (또는 통합 위치) | 신규      | (1) related_nodes UPDATE 성공 (2) content UPDATE ABORT (3) answer UPDATE ABORT (4) 한 UPDATE 문에 content+related_nodes 동시 변경 시 ABORT.                                                                                                                                                                                         |

## 4. 위험 분석

| 위험                                                              | 가능성                    | 영향                                   | 완화                                                                                                                                                             |
| :---------------------------------------------------------------- | :------------------------ | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 본문 컬럼 보호 약화                                               | 낮음                      | 치명 (학습자 정답 회귀)                | WHEN 절 컬럼 enumeration 명시 + Test (4) 본문+메타 동시 UPDATE ABORT 보장 + ADR-046 §"본문 가드 회귀 검출" 의무                                                  |
| 트리거 교체 중 운영 invariant 깨짐                                | 매우 낮음                 | 중간                                   | 0038 마이그 단일 트랜잭션 내 DROP+CREATE. wrangler d1 migrations apply 자체가 transaction (D1 보장). production 적용 시 wrangler dev --remote idle 확인 후 진행. |
| 다른 우회 사용처 발생                                             | 중간                      | 중간 (단일 진실원 우회 진앙 #1과 묶임) | ADR-046 §"코드 측 가드" — schema.ts JSDoc + ESLint custom rule (별도 plan, 본 plan 미포함) carry-over.                                                           |
| 신규 메타 컬럼 추가 시 보호 망각                                  | 중간                      | 중간                                   | ADR-046 §"신규 컬럼 추가 시 체크리스트" — 본문 분류면 WHEN 절 enumeration 갱신 의무 명시.                                                                        |
| Phase B (진산 carry-over, 보기별 라벨) 신규 컬럼 추가 후 backfill | 높음 (carry-over 도달 시) | 중간                                   | 본 plan 이 정상 경로 마련 → Phase B 카운터 게이트 해소 (handoff-091 §"carry-over").                                                                              |
| 본문 컬럼 enumeration 누락 (e.g., explanation 빠뜨림)             | 중간                      | 치명                                   | (a) ADR-046 에서 schema.ts 와 1:1 대조표 + (b) Test (1)~(4) 외 본문 컬럼 전수 ABORT 테스트 추가                                                                  |

### 4.1 옵션 비교 (진산 추가 결재 필요한 갈림길)

| 옵션                   | 설명                                                                                                              | 장점                                                                                | 단점                                                                                            |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| **A안** (본 plan 기본) | 트리거 WHEN 절로 본문 컬럼 변동만 ABORT (단일 테이블 내 화이트리스트)                                             | 마이그 1건, 코드 변경 0, schema.ts 무변경. 즉시 적용 가능 (~3h)                     | exam_questions 가 비대해질수록 본문/메타 분류 관리 부담                                         |
| **B안**                | A안 + 신규 관계 테이블 `question_node_links` (question_id, node_id, FK) 도입. related_nodes 컬럼은 점진 deprecate | backend C-4 (4-way sync) 동시 해결 + FK 무결성 확보 + Phase B 보기별 라벨 자연 확장 | 마이그 +1 (FK 신설), 적재 코드 변경 (다른 plan 묶음 필요), schema.ts shape 변경, 이행 비용 ~10h |

→ **본 plan 의 기본 = A안** (Q1 권고 표현 정합). B안은 backend C-4 별도 plan (TR-1) 에서 평가, 본 plan §3 의 schema.ts 주석에 "B안 진행 시 deprecate 후보" 명시.

## 5. 검증 계획

### 5.1 Binary Gate (본 plan 통과 조건)

- [ ] **G-TR0-1 본문 가드 회귀 0**: 본문 8컬럼(content/answer/explanation/subject/year/round/question_number/exam_type) + 불변 2컬럼(id/created_at) 전수 단독 UPDATE ABORT (마이그 적용 후 통합 테스트).
- [ ] **G-TR0-2 메타 화이트리스트 통과**: related_nodes 단독 UPDATE 성공 + related_constants/topic_cluster/memorization_type/confusion_type/input_type 각 단독 UPDATE 성공. (distractors/calc_variables 는 §2.1 D-1/D-3 결정 후 확정 — 미결 시 ABORT 측 테스트.)
- [ ] **G-TR0-3 혼합 UPDATE ABORT**: 한 UPDATE 문에 본문+메타 동시 변동 시 ABORT (보안 회피 차단). WHEN 식은 nullable 본문(answer/explanation)의 NULL↔값 전이도 잡도록 `IS NOT`(NULL-safe) 비교 사용 — `<>` 만 쓰면 `NULL<>x`=거짓으로 우회됨.
- [ ] **G-TR0-4 status 전이 경로 검증 (★정정 — "0008 가드" 전제 폐기)**: §2.1 D-2 결정에 따라 — (a)면 status 단독 UPDATE ABORT 확인, (b)면 active→deprecated/flagged 허용 + approved→draft 등 downgrade ABORT 확인. 0008(webhook_events)·0010(node/formula/constant only)은 exam_question 무관임을 테스트 주석에 명시.
- [ ] **G-TR0-5 production smoke**: production 적용 후 545 행 `SELECT COUNT(*)` 변동 0 + `related_nodes IS NULL` 카운트 유지(백필 전).
- [ ] **G-TR0-6 트리거 교체 검증 (fail-open 차단)**: 적용 후 sqlite_master 에서 `prevent_exam_questions_body_update` COUNT=1 **AND** 구 `prevent_exam_questions_update` COUNT=0 확인. (G-TR0-5 만으로는 no-op 마이그/신규 트리거 생성 실패도 녹색 통과.)
- [ ] **G-TR0-9 22컬럼 전수 분류 커버**: §2 표의 22컬럼 각각이 본문/메타/상태/불변 중 정확히 1 분류 + 각 ABORT/허용 테스트 존재(미분류 0 = confusion_type/calc_variables 사각 제거).
- [ ] **G-TR0-10 backfill 의도 검증**: NULL→값(백필) vs 값→값(덮어쓰기) 구분 — 메타 컬럼 백필 허용하되 의도 명시.
- [ ] **G-TR0-11 멀티행 원자성**: 545행 대상 단일 UPDATE 문에서 1행이라도 본문 변동 시 전체 ABORT 확인.
- [ ] **G-TR0-12 테스트 하네스 명시**: 신규 테스트는 `createD1FromAllMigrations`(readdir 자동, 0038 포함) 사용 강제. `SCENARIO_MIGRATIONS` 큐레이션 배열(0037까지) 사용 시 0038 누락 → 트리거 미적용 위양성(TD-API-001 부채).

### 5.2 통합 검증

- [ ] typecheck (`pnpm -F api typecheck`)
- [ ] lint (`pnpm -F api lint`)
- [ ] Vitest 전체 (현 643 PASS + 본 plan 신규 ≥4 PASS)
- [ ] no-mock-routes.test.ts 통과 (계약 회귀 0)
- [ ] D1 preview DB (ADR-018) 에서 마이그 적용 dry-run → 본 plan 통합 테스트 통과 확인 후 production 적용

### 5.3 독립 리뷰 (자가 검증 금지)

- [ ] 4-Pass (Surgeon/Architect/Advocate/Contract) — 마이그 SQL + ADR + schema.ts 주석 대상
- [ ] 본 plan 의 §4.1 옵션 비교 자체에 대한 backend-architect 단독 페르소나 재검토 (B안 채택 가능성 자기 반박)

## 6. 적용 순서 (인간 승인 후 코딩 시작)

1. 진산 plan 결재 → 본 파일에 `approved_by` 갱신
2. ADR-046 작성 (Draft) → 진산 ADR Accepted 결재
3. 마이그 0038 SQL 작성 → 4-Pass 독립 리뷰
4. 신규 테스트 작성 (G-TR0-1~4)
5. D1 preview DB 적용 → 통합 테스트 통과 확인
6. **wrangler d1 execute --env production --remote** 적용 (진산 인증 게이트, [feedback_full_autonomy] 위임 범위 외)
7. G-TR0-5 production smoke 확인 → 본 plan 완료 선언
8. **연계 액션**: handoff-091 §"다음 할 일" #3 (approved 동결) 진행 가능 상태 영속 → CLAUDE.md "현재 상태" 갱신 + memory 진척 append

## 7. 롤백 전략

- 마이그 0038 적용 직후 G-TR0-1~4 실패 시: 0038 의 down 마이그 즉시 실행 — `DROP TRIGGER prevent_exam_questions_body_update; CREATE TRIGGER prevent_exam_questions_update ...` (원본 트리거 복원).
- 적용 후 백필 진행 중 본문 컬럼 회귀 발견 시: status_transitions / 마이그 적용 로그 추적 + production data 롤백은 D1 Time Travel (ADR-018 / devops C-3 carry-over).
- 본 plan 자체 폐기 시: 진산 결재 경로 A (LLM 생성 → 검수) 재설계 (C-7 §3 question_node_links 도입 = B안 전환).

## 8. 승인 기록

- 5-페르소나 리뷰 인덱스: `.claude/reviews/phase2-tech-debt-20260529-INDEX.md` §2 (C-B7) + §5 (Q1)
- backend 보고서: `.claude/reviews/phase2-tech-debt-20260529-backend.md` §C-7
- 사전심사 + dogfood: `review-20260529-133629-dual-gate-prescreen.md` + `review-20260529-135905-4pass-changes.md` (게이트 A CRITICAL 6 식별·정정)
- 진산 D-1/D-2/D-3 결재: ✅ **2026-05-29 Session 093** (§2.1 — default-deny / status ABORT / calc_variables 본문급)
- ADR-046 Draft: ✅ **작성 완료** (`docs/adr/ADR-046-exam-questions-metadata-update-policy.md`, Session 093) — 진산 Accepted 대기
- 마이그 0038 SQL + G-TR0-1~12 테스트: ✅ **선작성·로컬검증 완료** (Session 093, 진산 "권고대로 진행" 승인 하). `migrations/0038_exam_questions_metadata_update_allow.sql` + `migration-0038-metadata-update.test.ts` 28 PASS / api 671 PASS 회귀 0. 미커밋.
- 4-Pass 리뷰: ✅ **CRITICAL 0 / MAJOR 2 / MINOR 5** (`.claude/reviews/review-20260529-213954-4pass-changes.md`). MAJOR-1=distractor 7c 충돌(→§2.1 D-4 OPEN), MAJOR-2=L3 순서 역전(→SQL 헤더 STATUS 라벨링·잔여 게이트 명시). MINOR-3(schema.ts 주석) 해소, MINOR-1/2/4 carry-over(ADR-046), MINOR-5 기각(리뷰어 오독).
- 진산 plan 정식 결재 + ADR-046 Accepted: ✅ **2026-05-30** (진산 "다음 진행" 결재 — SQL 선작성본 formal sign-off 완료. production 적용(step6)은 게이트 #3 잔존)
- production 적용(wrangler --remote): **TBD** (§6 step6 진산 Cloudflare 인증 게이트 — 잔여 하드게이트, 미수행)

## 9. carry-over (본 plan 외 영역)

- **TR-1 backend C-4** (4-way sync): 본 plan A안 채택 시 C-4 별도 plan 필요. B안 채택 시 본 plan 에 흡수 가능 — §4.1 옵션 비교 결재 영향.
- **단일 진실원 우회 진앙 #1** (backend C-5/C-6): ESLint custom rule 또는 runtime guard — 본 plan 미포함, TR-1 별도 plan.
- **Phase B 보기별 라벨** (진산 carry-over): 본 plan 으로 backfill 경로 정상화 → Phase B 진입 카운터 게이트 해소.
- **devops C-3 D1 DR runbook**: §7 롤백 전략의 Time Travel 의존 → DR runbook 부재 시 운영 위험. TR-3 별도 plan.
