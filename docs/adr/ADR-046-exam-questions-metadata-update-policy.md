# ADR-046: exam_questions 본문/메타데이터 UPDATE 정책 (트리거 재설계 — TR-0)

- **상태:** **Accepted** (2026-05-30 진산 "다음 진행" 결재 — plan formal sign-off 와 묶음, 게이트 #1 해소). D-1/D-2/D-3 결정은 2026-05-29 진산 결재 완료, 본 ADR은 그 결정의 동결 문서. ★ **production 적용(wrangler --remote)은 본 ADR이 승인하지 않는다** (L3 하드게이트 = plan §6, 게이트 #3 잔존·미수행).
  - **진행 경과 (2026-05-29 Session 093)**: 진산 "권고대로 진행" 승인 하에 마이그 0038 SQL + G-TR0-1~12 테스트 **선작성·로컬검증·4-Pass 완료** (28 PASS / api 671 PASS 회귀 0 / 4-Pass CRITICAL 0, `review-20260529-213954-4pass-changes.md`). 4-Pass MAJOR 2건(distractor 7c 충돌=§D-6 / L3 순서 역전=라벨링 해소) 반영. ★ formal Accepted + production 적용은 잔여 진산 게이트. 미커밋.
- **결정일:** 2026-05-29 (Session 093) / D-1·D-2·D-3 진산 결재 2026-05-29
- **결정자:** 진산 (D-1/D-2/D-3 택1 결재) + Claude Opus 4.8 (사전심사·dogfood 실코드 대조로 결함 식별 및 설계 동결)
- **관련 영역:** ★ **L3** — DB 스키마/마이그레이션 (`migrations/0038`), `apps/api/src/db/schema.ts`(주석 동기), 답안 안전(Formula Engine 결합)
- **선결 조건:** `docs/plans/tr-0-backend-c7-trigger-redesign.plan.md` 진산 정식 결재 (본 ADR Accepted 와 묶음). 본 ADR Accepted → 마이그 0038 SQL 작성(4-Pass) → D1 preview dry-run → 진산 인증 게이트(`wrangler --remote`).

---

## 맥락 (Context)

Phase 2 5-페르소나 리뷰 backend **C-7**(`.claude/reviews/phase2-tech-debt-20260529-backend.md` §C-7)가 즉시 차단선을 발견했다:

- `migrations/0004_temporal_guard_extension.sql:39-43` 의 `prevent_exam_questions_update`
  트리거가 **exam_questions 의 모든 UPDATE 를 전면 ABORT** 한다.
- 그 결과 G-S5 multi-hop 정답률 측정에 필요한 골든 라벨(`exam_questions.related_nodes`,
  현 production 545행 전부 NULL)의 **백필 UPDATE 가 불가능** — 진산이 golden-pilot 을
  검수(approved)해도 production 동결 자체가 막힌다.

이중 게이트 사전심사(`.claude/reviews/review-20260529-133629-dual-gate-prescreen.md`)와
dogfood 4-Pass(`.claude/reviews/review-20260529-135905-4pass-changes.md`)가 독립적으로
TR-0 plan 의 결함 2건을 실코드 대조로 확증했고, 본 ADR이 그 정정을 반영해 정책을 동결한다:

1. **"0008 정책 트리거가 status 를 보호" 전제는 거짓** — 실코드: `migrations/0008` =
   `webhook_events` 전용, `migrations/0010` status_transitions CHECK =
   `target_type IN ('node','formula','constant')`(0010:27)로 **exam_question 미커버**,
   `0004:13-14` 가 약속한 `deprecate_exam_question()` 저장 프로시저는 SQLite 미지원으로
   **미구현**. ⇒ exam_questions.status 는 현재 0004 전면 ABORT 로 INSERT 값에 **영구 동결**.
2. **컬럼 분류 누락** — 직전 plan 의 본문8+메타6+상태4=18 분류가 `confusion_type`(schema.ts:337)·
   `calc_variables`(schema.ts:341) 2컬럼을 누락. 실 스키마는 22컬럼.

## 결정 (Decision)

### D-0. exam_questions 22컬럼 4분류 (schema.ts:319-345 1:1 동결)

본 표가 마이그 0038 트리거 enumeration 의 **유일 진실원**이다. schema.ts 변경 시 본 표 동기 의무.

| 분류                                | 컬럼 (schema.ts 라인)                                                                                                               | 0038 처리           | 근거                                              |
| :---------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :------------------ | :------------------------------------------------ |
| **본문 (SUPERSEDES 의무)**          | `content`(325) `answer`(326) `explanation`(327) `subject`(324) `year`(321) `round`(322) `question_number`(323) `exam_type`(334)     | **ABORT**           | Temporal Graph 불변 — 학습자 정답·해설 무결성     |
| **메타 화이트리스트 (UPDATE 허용)** | `related_nodes`(331) `related_constants`(332) `topic_cluster`(335) `memorization_type`(336) `confusion_type`(337) `input_type`(339) | **허용**            | Q↔node 라벨·분류 메타. 본문 의미 불변, 백필 대상  |
| **상태 머신**                       | `status`(333) `superseded_by`(330) `valid_until`(329) `valid_from`(328)                                                             | **ABORT** (D-2)     | 아래 D-2                                          |
| **답안 안전 (메타이나 보호)**       | `distractors`(340) `calc_variables`(341)                                                                                            | **ABORT** (D-1·D-3) | 객관식 오답 후보·산식 입력변수 = 답안 정확도 표면 |
| **불변**                            | `id`(320, PK) `created_at`(342)                                                                                                     | **ABORT**           | 재키잉·타임스탬프 변조 무의미·위험                |

→ **허용 6 / ABORT 16.**

### D-1. WHEN-절 극성 = **default-deny** (진산 결재 2026-05-29)

화이트리스트 6 메타 컬럼만 UPDATE 허용, 그 외 전부 ABORT. 화이트리스트에 없는
`distractors`·`calc_variables` 는 자동으로 ABORT 측에 포함되어 답안 안전을 보존한다.

> **SQLite 구현 주의 (마이그 0038 작성 시 필수)**: SQLite 트리거는 "SET 절에 포함된
> 컬럼"을 직접 열거할 수 없다. default-deny 는 **ABORT 대상 16컬럼을 WHEN 절에
> `NEW.col IS NOT OLD.col` 로 enumerate(OR 결합)** 하여 구현한다. 화이트리스트 6컬럼은
> WHEN 에 미포함 → 그 변동은 ABORT 를 트리거하지 않음 = 허용. **`<>` 가 아닌 `IS NOT`**
> (NULL-safe) 사용 — nullable 본문(answer/explanation)의 `NULL↔값` 전이를 `<>` 는
> `NULL<>x=거짓`으로 우회시키므로 백필 가드가 뚫린다(사전심사 G-TR0-3).
> **미래 컬럼 자동 보호 한계**: 신규 컬럼은 WHEN enumeration 에 추가해야 보호되므로,
> "default-deny" 의 망각 안전은 트리거가 아닌 아래 §"신규 컬럼 체크리스트"(프로세스)가 담보한다.

### D-2. status 전이 경로 = **ABORT 유지** (진산 결재 2026-05-29)

`status`/`superseded_by`/`valid_until`/`valid_from` 은 본문과 동일하게 ABORT. exam_questions
status 의 현 영구 동결을 지속한다. 0038 의 범위는 **`related_nodes` 등 메타 백필 해소로 한정**.
deprecate/flagged 운영이 필요해지면 0010 일방향 전이 가드 패턴 이식 = **별도 plan**(본 ADR 범위 밖).

### D-3. `calc_variables` 보호등급 = **본문급 ABORT** (진산 결재 2026-05-29, L3 Formula Engine)

산식 입력변수 JSON 은 `answer` 와 동급 보호. UPDATE 차단. calc 문항 변수 백필이 필요하면
SUPERSEDES(신규 INSERT + `superseded_by`) 경로로만 — Formula Engine 답안 정확도 무결성 최우선.

### D-4. Hard Limit 와의 관계 (경계 명시)

본 정책은 **exam_questions 의 일부 메타데이터 UPDATE 만 허용**하며, 다음을 **변경하지 않는다**:

- `knowledge_nodes`·`formulas`·`constants` UPDATE 전면 금지 (Hard Limit, 0003/0004) — **불변**.
- exam_questions **본문**(content/answer/explanation 등)의 SUPERSEDES 의무 — **불변**.
- "AI 생성 데이터는 draft, 인간 검수 후 approved" (golden 백필은 진산 검수 통과분만).

즉 본 ADR은 "Temporal Graph 완화"가 아니라 **본문 불변을 유지한 채 비-진실값 라벨 메타에만
열린 창**을 정의한다.

### D-5. 신규 컬럼 추가 체크리스트 (망각 안전 = 프로세스 담보)

exam_questions 에 컬럼 추가 시 (마이그/schema.ts PR):

1. D-0 표에 분류 1개 배정 (본문/메타화이트리스트/상태/답안안전/불변).
2. 본문·상태·답안안전·불변이면 → 마이그 0038 후속 마이그의 WHEN enumeration 에 추가.
3. 메타 화이트리스트면 → 추가하지 않음(허용). 단 답안 노출 표면인지 재검토.
4. 본 ADR D-0 표 + schema.ts 1:1 정합 확인.

### D-6. distractors UPDATE vs Step 3-UX-7c 파이프라인 충돌 (★OPEN — 4-Pass MAJOR-1, 진산 결재 필요)

4-Pass(`review-20260529-213954-4pass-changes.md` MAJOR-1)가 모듈 간 계약 충돌을 발견:

- 본 ADR D-1·D-3 = `distractors` ABORT(답안 안전, 학습자 노출 오답 후보 보호).
- 그러나 `apps/admin-web/src/types/distractor.ts:6,66` + `docs/plans/phase3-learning-ux-modes.plan.md`
  Step 3-UX-7c = "진산 검수 → `exam_questions.distractors` **직접 UPDATE** (`PUT /api/admin/distractors/:questionId`)" 설계.
- ⇒ 7c 구현 시 distractor 백필 UPDATE 가 0038 트리거에 ABORT 됨 (현재 7c 미구현 = 런타임 무파손, forward-compat 트랩).

**충돌의 본질**: distractors 는 (a) 학습자 노출 답안 자산(보호 대상) **이면서** (b) distractor BATCH 저작이
채워야 할 메타(작성 대상)라는 이중 성격. related_nodes(내부 링크, 백필 허용)와 달리 answer 급 노출 자산이다.

**진산 결재 선택 (D-6, 7c 착수 전 결정)**:

| 옵션                              | 설명                                                                                             | trade-off                                       |
| :-------------------------------- | :----------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| **(a) SUPERSEDES 경로 (권고)**    | distractors 백필도 본문처럼 신규 INSERT + superseded_by (직접 UPDATE 금지). 7c 파이프라인 재설계 | 답안 안전 일관 / 7c 구현 비용↑                  |
| (b) distractors 화이트리스트 이동 | distractors 를 UPDATE 허용으로 전환(0038 WHEN 에서 제외)                                         | 7c 직접 UPDATE / 답안 안전 표면 완화(검수 의존) |
| (c) 별도 staging 테이블           | distractor_drafts 등 staging → 검수 후 SUPERSEDES 승격                                           | 무결성↑ / 신규 테이블·복잡도                    |

→ 결정 전까지 **0038 = distractors ABORT 유지**(현 SQL). 7c 착수는 본 D-6 결재 후. `distractor.ts:6,66` docstring

- phase3 plan 동기 의무. [[project_multi_source_choice_basis_track]] Phase B/C 와 연결.

## 트리거 설계 사양 (마이그 0038 구현 대상 — 인간 승인 후 작성)

> 아래는 **설계 사양**이며 실제 SQL 파일(`migrations/0038_exam_questions_metadata_update_allow.sql`)은
> 본 ADR Accepted + plan 정식 결재 후 작성한다(L3). 4-Pass 독립 리뷰 + D1 preview dry-run + G-TR0-1~12 통과 의무.

- 단일 마이그 트랜잭션: `DROP TRIGGER prevent_exam_questions_update` → `CREATE TRIGGER prevent_exam_questions_body_update BEFORE UPDATE ON exam_questions WHEN (<ABORT 16컬럼 IS NOT 열거>) BEGIN SELECT RAISE(ABORT, ...); END;`
- ABORT 16 = 본문 8 + 상태 4 + 답안안전 2(distractors/calc_variables) + 불변 2(id/created_at).
- 허용 6 = related_nodes/related_constants/topic_cluster/memorization_type/confusion_type/input_type (WHEN 미포함).
- down 마이그(롤백): `DROP TRIGGER prevent_exam_questions_body_update; CREATE TRIGGER prevent_exam_questions_update ...`(원본 전면 ABORT 복원). ⚠️ 롤백 시 백필 재차단 트레이드오프 명시(plan §7).
- 트리거 명칭: **`prevent_exam_questions_body_update`** 로 단일화 (plan §2 배경의 `_static_update` 표기는 본 명칭으로 통일 — plan A안/B안 라벨 혼선도 본 ADR이 "A안=순수 컬럼 화이트리스트=채택"으로 단일화).

## 검증 (Binary Gate)

`tr-0...plan.md` §5.1 의 **G-TR0-1 ~ G-TR0-12** 전수 PASS 가 본 ADR 구현의 완료 조건.
특히 G-TR0-3(혼합 UPDATE ABORT + IS NOT), G-TR0-6(트리거 교체 fail-open 차단),
G-TR0-9(22컬럼 전수 분류 커버), G-TR0-12(createD1FromAllMigrations 하네스).

## 결과 (Consequences)

**긍정:**

- golden `related_nodes` 백필 경로 정상화 → G-S5 pilot 측정 차단 해소(진산 검수 후).
- 본문·답안안전(distractors/calc_variables)·상태 보호는 유지 → 학습자 정답 회귀 0.
- Phase B(보기별 라벨) 신규 메타 컬럼 백필 경로 사전 확보.

**부정/위험:**

- exam_questions status 영구 동결 지속(D-2 a) → deprecate/flagged 운영 시 별도 plan 필요(carry-over).
- 미래 컬럼은 WHEN enumeration 수동 추가 의무(§D-5 체크리스트로 담보 — 누락 시 보호 공백).
- 트리거 교체 자체가 production 운영 invariant 변경 → D1 preview dry-run + 진산 인증 게이트 필수.

**중립:**

- schema.ts shape 무변경(주석만 동기). NC-1 invariant 영향 0.

## carry-over (4-Pass 리뷰 MINOR — 0038 범위 밖, 명시 이월)

- **MINOR-1 DELETE 가드 부재**: `exam_questions` 는 BEFORE DELETE 가드가 0004·0038 어디에도 없음
  (status_transitions 0010:55-59 는 DELETE 가드 보유 = 대조군). 본문 SUPERSEDES 불변의 DELETE 측면이
  DB 무방비. 0038 신규 결함 아님(0004부터). → TR-1 또는 후속 마이그에서 `prevent_exam_questions_delete`
  (0010 패턴 이식) 검토. D-4 §"불변" 정신과 정합.
- **MINOR-2 이중 로더 부채 (TD-API-001)**: 0038 테스트만 `createD1FromAllMigrations`(readdir, 0038 포함),
  다른 시나리오 테스트는 `SCENARIO_MIGRATIONS` 큐레이션(0037까지, 0038 미포함). 그 테스트들은 exam_questions
  UPDATE 미시도라 현 영향 0이나, 향후 메타 UPDATE 검증 시 0004 full-ABORT 위양성 위험. → SCENARIO_MIGRATIONS
  readdir 통합(TD-API-001 해소, 기존 WBS 의무) carry-over.
- **MINOR-4 confusion_type CHECK 부재**: 화이트리스트 6 중 input_type 만 SQL CHECK(0032:19) 보유,
  confusion_type 은 Drizzle TS enum 만(런타임 미강제) → 0038 UPDATE 창으로 임의 문자열 주입 가능(학습자 통계
  UI 노출). 답안(answer/distractors/calc_variables)은 ABORT 보호라 답안 무결성 무손상 = MINOR. → §D-5
  체크리스트에 "학습자 노출 enum 메타는 SQL CHECK 또는 read-path Zod" 추가 또는 적재 레이어 allowlist 검증.
- **MINOR-5 (기각)**: 4-Pass 가 "G-TR0-2 input_type 케이스가 seed=신규값 동일이라 전이 미실증"으로 보고했으나
  **실코드 재확인 결과 오독** — seed input_type='multiple_choice'(test:62), WHITELIST='fill_blank'(test:50)
  = 실제 전이. input_type 이 WHEN 절에 오분류되면 이 UPDATE 가 ABORT→테스트 실패로 회귀 검출됨. 기각(RULE #4
  리뷰 출력 교차검증).

## 링크

- plan: `docs/plans/tr-0-backend-c7-trigger-redesign.plan.md` (§2 22컬럼 / §2.1 D-1~3 / §5.1 게이트)
- 사전심사: `.claude/reviews/review-20260529-133629-dual-gate-prescreen.md` (게이트 A 4 리뷰어)
- dogfood 4-Pass: `.claude/reviews/review-20260529-135905-4pass-changes.md` (MINOR #5/#6 동일 결함 재확인)
- 근거 보고서: `.claude/reviews/phase2-tech-debt-20260529-backend.md` §C-7
- 운영 가이드: `docs/plans/phase2-tech-debt-workflow.md` §2 게이트 A
- 실코드: `migrations/0004:39-43`(원 트리거) / `migrations/0010:27,99`(status_transitions, exam_question 미커버) / `apps/api/src/db/schema.ts:319-345`
