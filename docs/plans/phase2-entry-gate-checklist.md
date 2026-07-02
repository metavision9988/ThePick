# Phase 2(생성층) 진입 게이트 체크리스트 (WS-6a — 결재 #12 (a) 집행)

> **지위**: MASTER_PLAN G-WS6 ⑤ "Phase 2 진입 체크리스트에 6f 게이트 명문"(MASTER_PLAN.md:184) 충족 형식.
> **결재 근거**: 결재 카드 #12 (a) "게이트 선행 원칙 명문화" — 진산 2026-07-02 일괄 결재("권고대로", 기록
> 커밋 3adb10a). 카드: `master-remediation-20260610/decision-card-12-generation-gate-draft-pitr.md`.
> **성격**: 살아있는 문서 — 각 항목 충족 시 상태·증거 링크를 갱신한다(§3 갱신 규율). 본 체크리스트
> 전 항목 충족 전 "Phase 2(생성층) 착수" 선언 금지 (CRITICAL RULE #7 정합 — gate 전부 통과 전 완료 선언 금지).

---

## 1. 원칙 — 생성 코드 1줄 전 DB 게이트 마이그 선행

**규칙**: AI 가 학습 콘텐츠를 만들어 DB 에 적재하는 코드(생성 코드)는, 그 생성물의 **표적 테이블에
환각 차단 DB 게이트(마이그레이션)가 production 에 선행 적용된 후**에만 1줄이라도 작성한다.

- **원문 근거**: MASTER_PLAN.md:177 WS-6a "생성 코드 1줄 전 DB 게이트 마이그 선행 (Phase 2 진입 규칙)" +
  §2.1-8 생성층 역순 리스크(MASTER_PLAN.md:74 — mnemonic_cards CHECK·트리거·reverse_verified 검증 전무,
  exam_questions status 'draft' 부재 + 0038 status 동결로 사후 격리 불가).
- **적용 범위**: 생성 엔진 본체(study-material-generator, M20~M24 — 현 stub, `packages/study-material-generator/src/index.ts` = `export {}`),
  distractor BATCH(Step 3-UX-7b~7f), 암기법 생성 체인(M18→M19→M23), 변형 문제 생성(F6 신규 Epic 후보,
  MASTER_PLAN §6b A-3) 등 **AI 생성물 → D1 적재 경로 전부**.
- **선례**: knowledge_nodes 는 BATCH-1 적재 진입 전 마이그 0018 로 draft-only INSERT + page_ref NOT NULL
  트리거를 선행 적용했다(`migrations/0018_enforce_draft_only_insert.sql:12` "BATCH-1 적재 진입 차단 게이트",
  트리거 본문 :20-37). 본 원칙은 그 선례를 생성층 표적 테이블 전체(mnemonic_cards·mock_exam_questions 등)로
  일반화한 것이다.
- **위반 판정(기계적)**: 생성 코드 커밋 시점에 해당 표적 테이블의 게이트 마이그가 production 미적용이면
  위반. 게이트 없는 표적 테이블로의 INSERT 코드 = 착수 금지 대상.

## 2. 진입 조건 체크리스트 (전 항목 충족 전 생성 코드 착수 금지)

> 현 상태는 2026-07-02 기준 **정직 표기** — 미완은 미완으로 적는다.

| #   | 진입 조건                                                                                                                     | 현 상태 (2026-07-02)                                                                                                                                                                                                                               | 근거                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| ☐ 1 | **WS-6b mnemonic_cards 게이트 마이그** — status CHECK + draft-only INSERT 트리거 + reverse_verified=1 없이 approved 전이 금지 | **미완 — L3 plan 미작성.** 현 실태: `migrations/0002:41-52` = `status TEXT DEFAULT 'draft'` 선언뿐 CHECK·트리거 0 (게이트 전무). production COUNT 0 (§6b A-6 — 게이트 신설은 F2 진전이 아닌 착수 전 안전장치)                                      | MASTER_PLAN.md:178 (plan 선행·L3 결재) / G-WS6 ①②                                     |
| ☐ 2 | **WS-6c exam_questions draft 표현** — mock_exam_questions 격리 스테이징 테이블 (결재 #12 (b-2) 채택안)                        | **◐ L3 plan 작성 완료 (2026-07-02, 본 집행): `ws-6c-mock-exam-questions.plan.md`.** SQL 작성·ADR Accepted·production 적용 = plan §7 결재란 승인 대기 = **게이트로서는 미완**                                                                       | 결재 #12 (b-2) ☑ / G-WS6 ④ 절반(6c ADR) 잔여                                          |
| ☐ 3 | **WS-6f containment Layer2 validator 4종 + prompt injection + output PII 필터**                                               | **미완 — 미구현.** 현 user-facing LLM 0 = 공격면 부재로 시점 정합, 착수 시점만 못박음(본 항목이 그 못박음)                                                                                                                                         | MASTER_PLAN.md:182 (Phase 2 진입 게이트 지정)·:308 / OPUS48_EXECUTION_PLAYBOOK.md:222 |
| ☐ 4 | **G-1 R1~R5 전수** — 생성 엔진 신규 Epic feasibility (AI 출력 정확도 = 비즈니스 핵심 → 자동 발동 전수 대상)                   | **미완 — 미수행.** `docs/feasibility/` 에 생성 Epic 판정서 부재(기존 `thepick.feasibility.md` 는 아키텍처·graph-walk 축 판정). R3 = "생성물 정답 100% 보존" GT Spike 선행(§6b A-3 방향)                                                            | MASTER_PLAN.md:189 (M20~M24 진입 조건) / CLAUDE.md G-1 자동 발동 조건                 |
| ☐ 5 | **E0 통과** (E0-1~E0-8 — 1호 완성 게이트)                                                                                     | **미완 — 8중 1만 ✓.** E0-3(Formula 골든 303/303) ✓ 2026-06-10. E0-1(MC 3중모순)·E0-2(무결성 러너 판정 FAIL — 데이터 수리 결재 #20 잔여)·E0-4(N=6<30)·E0-5(graph GO/NO-GO 조건부 보류)·E0-6(F6 미착수)·E0-7(백필 처분)·E0-8(커버리지 역감사) 미충족 | `docs/audit/EXPANSION_GATE_DESIGN_20260611-073814.md:36-43`                           |

### 2b. G-WS6 Binary Gate 배선표 (참조 — 판정 정본은 MASTER_PLAN.md:184)

| G-WS6 항목                                           | 커버 위치                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ① mnemonic_cards draft 외 status INSERT ABORT 테스트 | §2-1 (WS-6b plan → 마이그)                                                                             |
| ② reverse_verified=0 approved 전이 ABORT 테스트      | §2-1 (〃)                                                                                              |
| ③ tables[] 무음 폐기 봉합 테스트                     | WS-6d (본 체크리스트 밖 — L2, MASTER_PLAN.md:180. 미완)                                                |
| ④ ADR 2건(6c·6e) Accepted                            | 6e = **ADR-047 Accepted ✓** (2026-07-02, 결재 #13 (b)) / 6c = §2-2 plan §7 승인 후 ADR 작성 = **잔여** |
| ⑤ Phase 2 진입 체크리스트에 6f 게이트 명문           | **본 문서 §2-3 로 충족 ✓** (2026-07-02)                                                                |

> 생성 엔진 **본체**(M20~M24) 진입은 본 체크리스트 §2 외에 **ai-adapter 단일 정본 결정**(ADR-023 §2.4
> 경로)도 요구한다 — MASTER_PLAN.md:189 정본 유지(본 문서는 중복 판정하지 않음).

## 3. 갱신 규율

1. 항목 충족 시 ☐→☑ + **증거 링크**(마이그 번호·리뷰 `review-*` 링크·테스트 RAW 로그·결재 기록) 병기.
2. 게이트 항목의 추가·완화·문구 개정 = 진산 결재 필요 (E0~E4 채택 규칙 "게이트 문구 개정 = L3급 결재"
   준용 — 결재 #16, 침식 차단).
3. 본 문서와 MASTER_PLAN §WS-6 이 어긋나면 **어긋남 발견 즉시 동기**(루트 문서 stale = 하위 작업 오염원 —
   2026-05-15 실수 로그 재발 방지).

---

_집행 기록: 2026-07-02 결재 #12 (a) 집행 — 본 문서 신설 (코드 무접촉·문서만). (b-2)는
`ws-6c-mock-exam-questions.plan.md` 로 plan 화(SQL 미작성)._
