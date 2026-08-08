---
phase: 3
step: 결정 #9 (C) 집행 — 시행시점 정합 승격 게이트 (마이그 0045·0046) + 계보 불변식 + 독립 리뷰 처분
approved_by: 진산 (2026-08-07, "c 진행") — 근거 = docs/plans/decision-card-20260807-supersedes-effectivity.md §5
risk_level: L3
scope:
  # --- L3: DB 트리거 (승격 게이트 + 백필 게이트) ---
  - migrations/0045_block_premature_promotion.sql
  - migrations/0039_knowledge_edges_guard_and_node_reactivation.sql # 헤더 경고 갱신만 (SQL 본문 불변)
  - apps/api/src/__tests__/scenarios/migration-0045-premature-promotion.test.ts
  - apps/api/src/__tests__/helpers/d1-from-sqlite.ts # SCENARIO_MIGRATIONS 등재 (드리프트 가드)
  # --- L3 추가 (2026-08-07 독립 리뷰 CRITICAL 처분 — §리뷰 처분 참조) ---
  - migrations/0046_close_third_promotion_door.sql # 세 번째 문 봉쇄 (0042[1] 재생성 + INSERT 게이트)
  - apps/api/src/__tests__/scenarios/migration-0046-third-door.test.ts
  - apps/api/src/study/__tests__/routes.test.ts # ★리뷰 MAJOR: 원 scope 누락분 정직 등재
  - apps/api/src/search/approved-nodes-sql.ts # 미러 재생성 경고를 의존 상류에 배치 (주석만)
  # --- 무결성 러너 계보 불변식 (L3 아님 — read-only 감사 코어) ---
  - packages/quality/src/production-audit.ts
  - packages/quality/src/index.ts
  - packages/quality/src/__tests__/production-audit.test.ts
  - scripts/run-graph-integrity-production.ts
  - scripts/__tests__/effectivity-mirror-differential.test.mjs # ★3R: 미러 차등 테스트(SQLite 실행 대조)
  # --- 진행 추적·문서 (동커밋 갱신 의무) ---
  - docs/plans/catchall-역이식-체크리스트.md
  - docs/plans/decision-card-20260807-supersedes-effectivity.md
  - docs/plans/APPROVAL_DASHBOARD.md
  - docs/plans/current.plan.md
  - docs/plans/current.plan.20260806-backport-stage01-stale.md
  - .jjokjipge/handoff-20260807-backport.md
  - migrations-v2/README.md # 프레임워크 정본 원장 (2호 상속 누락 방지)
  - .gitignore # 훅 런타임 마커 제외
  - .claude/reviews/review-20260807-5persona-0045.md # 독립 리뷰 보고서 영속
---

> 직전 plan(역이식 STAGE 0+1)은 `docs/plans/current.plan.20260806-backport-stage01-stale.md` 로 보존 이관.
> 본 plan 은 그 후속 = 결재 대시보드 §A #9 의 (C) 채택 집행.

## 목적

**"승인됨 + 아직 미시행" 구간을 데이터에서 구조적으로 제거한다.**

결정 카드 §1 이 못박은 문제: 하나의 "현행" 개념을 두 장치가 다르게 관리한다 —
`is_current_active`(승인 **이벤트**로 갱신) vs `valid_from`/`valid_until`(**시각 경과**, 이벤트 없음).
둘이 어긋나는 유일한 구간이 "승인됐는데 아직 시행 전"이고, 그 구간에서
0042 승계 트리거가 구본을 은퇴시키면 **주제 자체가 학습자 화면에서 사라진다**(blackout).

(C) = 그 구간에 **들어가지 못하게** 한다. 시각 이벤트를 공급하는 (A)나 서빙 구조를 바꾸는 (B) 대신,
승격 시점에 "오늘 유효한 판본만 승인"을 기계로 강제한다. 현 관행(개정 노드 전부 draft)과 이미 일치.

## 대상 변경

### 1) 마이그 0045 — 승격 게이트(A) + 백필 게이트(B)

| 반  | 무엇                                                                                                                                          | 왜                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| A   | `status_transitions` BEFORE INSERT — `to_status='approved'` 인데 대상이 **오늘 무효**면 ABORT                                                 | 카드 §3-1. 미시행 승격 = blackout 진입로 |
| B   | `knowledge_nodes`/`formulas`/`constants` BEFORE UPDATE — **이미 서빙 중인 행**을 오늘 무효로 만드는 `valid_from`/`valid_until` 백필이면 ABORT | ★카드 문면 밖 **보강**. 아래 근거        |

★ **B 를 넣는 근거 (카드 §3 문면에는 없다 — 명시 확대)**: 카드가 정의한 위험 구간은
"승인 + 미시행"이고, 거기 도달하는 문은 **둘**이다. ①미시행 행을 승격(=A 가 막음)
②이미 승인된 행에 미래 `valid_from` 을 백필(=A 가 못 막음). 0041 은 `valid_from` 을
NULL→값 1회 백필로 열어 뒀고, ~~**STAGE 2 가 바로 그 백필을 시작한다.**~~ A 만 넣으면
그 문이 그대로 열려 있다.

> ⚠️ **정정 2건 (2026-08-07 독립 리뷰)**
>
> 1. **"문은 둘"이 틀렸다 — 셋이다.** ③승인 기록을 행보다 **먼저** 넣으면(전이 선행) A 의 EXISTS 가
>    대상 부재로 거짓이 되어 통과하고, 뒤이어 들어온 미시행 행이 SUPERSEDES 엣지 하나로 구본을
>    은퇴시킨다(0042[1]). 3개 렌즈 독립 수렴 + 메인 재현. **봉쇄 = 마이그 0046**(아래 §4).
> 2. **"STAGE 2 가 그 백필을 시작한다"는 사실이 아니다.** 역이식 STAGE 2 = `source_quote` 축이고,
>    `valid_from` 백필은 **Revision Watch Phase 2**(0041 헤더의 미시행 4노드)다. 두 로드맵의 "2"를
>    혼동했다. **B 의 정확한 근거** = "임의 시점의 `valid_*` 백필로부터 **서빙 중인 행**을 보호한다".

★ **valid_until 대칭 포함 (카드 문면은 `valid_from > today` 만 언급)**: 만료된 판본을 승격하면
승인 즉시 창 밖 = 무음 미노출이다. 같은 불변식의 반대쪽이라 함께 잠근다.
⇒ 0045 의 불변식 1문장 = **"오늘 유효하지 않은 판본은 승인 상태로 서빙 자격을 얻을 수 없다."**

★ **판정식은 서빙 코어의 미러**여야 한다 — `buildEffectivityWindowSql`(반개구간 `[from, until)`,
KST `date('now','+9 hours')`, `date()` 정규화, 해석불가 = fail-closed).
트리거가 서빙과 다른 "오늘"을 쓰면 그 자체가 새 drift 다. 테스트가 미러를 SQL 문자열로 핀 고정.

### 2) 0039 헤더 갱신 (SQL 본문 불변)

0039 의 ★★ 경고("적용 전 반드시 읽을 것 — blackout")를 **"(C) + 0045 로 해소"** 로 갱신.
0039 production 적용을 이 결정 뒤로 묶는다는 카드 §5 세 번째 체크의 이행.

### 4) 마이그 0046 — 세 번째 문 봉쇄 (★리뷰 처분으로 추가)

| 반  | 무엇                                                                                                                       | 왜                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| C-1 | 0042[1] 재생성 — 승계자가 **approved + 오늘 유효**일 때만 구본 은퇴                                                        | 미발효 승계자가 은퇴를 일으키는 경로 차단 |
| C-2 | `knowledge_nodes`/`formulas`/`constants` BEFORE INSERT — 이미 approved 전이가 있는 id 를 **오늘 무효**로 INSERT 하면 ABORT | "승인 + 미시행" 상태의 성립 자체를 차단   |

★ **(a)안 재도입이 아니다**: 카드가 (a)를 기각한 이유는 "시행일이 와도 은퇴를 발화시킬 이벤트가 없다"
였는데, 0045 [A] 적용 후에는 **approved ⟹ 승격 시점에 유효**가 보장되고 승격 시점 flip 은 0042[2]가
이미 담당한다. 따라서 C-1 의 조건이 거짓인 경우는 **정상 경로에 존재하지 않으며**, 남는 것은 우회 시퀀스뿐이다.

### 3) 무결성 러너 계보 불변식 (사후 관측)

카드 §3-4 가 지정한 `LINEAGE_DUAL_ACTIVE`(구·신 동시 서빙) + 카드 §2-(D) 가 최소 의무로 지목한
`LINEAGE_GAP`(계보 전체가 서빙에서 사라짐) 2종 → **처분 후 3종**(`LINEAGE_LAPSE` 신설). **트리거가 원리상 못 잡는 것**을 잡는 그물이다 —
SQLite 에 시간 기반 트리거가 없으므로 `valid_until` 도래 같은 **시각 경과 실패는 관측만이 방어선**.

- 판정에 status·시행일이 필요 → `D1NodeRow` 에 `effective_status`/`valid_from`/`valid_until` 추가(옵션)
- **덤프에 없으면 `measured:false`** — 가짜 PASS 금지(러너 기존 fabricate 차단 철학 정합).
  러너는 `parseDump` 필수 컬럼으로 승격해 **입력 단계에서 fail-loud**.

> ⚠️ **판정축 교정 (2026-08-07 리뷰 CRITICAL)**: 초판 `LINEAGE_GAP` 은 `oldNode.is_current_active !== 1`
> 을 조건으로 삼았는데, **시각 경과형에서는 구본을 은퇴시킬 이벤트가 없어 그 값이 계속 1** 이다 —
> 위 문단이 "관측만이 방어선"이라 지목한 부류가 정작 조건에서 빠져 있었다(과소보고). 동시에 판정이
> 엣지 국소라 다중홉 체인에서 오탐했다(과대보고 → 두 번째 개정이 생기면 게이트 영구 FAIL).
> ⇒ 판정축을 **"오늘 서빙되는가"** 로 옮기고, 터미널 승계자에서만 GAP 을 보고하며,
> 엣지와 무관한 **`LINEAGE_LAPSE`**(노드 전수 스캔)를 신설했다.

## 위험 분석

| 위험                                                           | 완화                                                                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0045 가 **정상 승격을 막는다**(회귀)                           | 실측: production `valid_from`/`valid_until` = **0/857 노드 · 0 formulas · 0 constants**. 오늘자 효과 0 = 무회귀. api 전량 회귀 의무 |
| 트리거 "오늘" ↔ 서빙 "오늘" 불일치 = 새 drift                  | 동일 식(`date('now','+9 hours')`·반개구간·`date()` 정규화) 사용 + 테스트가 SQL 문자열 핀 고정                                       |
| 해석 불가 날짜에서 **fail-open**(WHEN 이 NULL → 미발화)        | `COALESCE(<비교>, 0) = 0` 로 3값 논리 명시 붕괴 → 해석 불가 = 차단. 전용 테스트                                                     |
| B 가 **정당한 백필을 막는다** (미시행 4노드 valid_from 채우기) | B 는 "서빙 중(approved+active)" 행에만 발화. 대상 4노드는 draft → 통과. 전용 테스트                                                 |
| 러너 신규 불변식이 **선재 데이터로 즉시 red**                  | 실측: production 활성 SUPERSEDES 엣지 **0** (전체 11 전부 `is_active=0`) → 두 불변식 공허참. 게이트 판정 불변                       |
| 카드 문면 밖 확대(B·valid_until)를 **Silent Pivot** 으로 오인  | 본 plan §대상변경 + 카드 §7 + 체크리스트에 **명시 확대**로 기록. 결정 자체는 (C) 불변                                               |
| production 적용을 승인으로 오해 (2026-05-29 실수 재발)         | 승인 범위 = SQL 작성·로컬 검증. 마이그 헤더 STATUS 라벨 + 본 plan 명문화 + 대시보드 재상신                                          |

## 검증 계획 (Binary)

- [x] **G-0045-1** 미래 `valid_from` 노드 → `approved` 전이 INSERT = ABORT / 오늘·과거 = 통과
- [x] **G-0045-2** 과거 `valid_until` 노드 → 승격 ABORT / 미래 `valid_until` = 통과
      (★리뷰 처분: 2b 에 **서빙 결과 집합 대조** 추가 — 상한 방향 drift 가 침묵하던 구멍)
- [x] **G-0045-3** `valid_from`/`valid_until` NULL(현 production 전량) = **무회귀 통과**
- [x] **G-0045-4** 해석 불가 날짜('언젠가') = ABORT (fail-closed, 서빙 창과 동일 방향)
- [x] **G-0045-5** `review`/`flagged` 전이는 무접촉 (승격만 게이트) / formula·constant 대칭 동작
- [x] **G-0045-6** B: approved+active 행에 미래 `valid_from` 백필 = ABORT / draft 행은 통과 /
      과거 `valid_from` 백필은 통과 / 0041 의 NULL→값 1회 규약 무회귀
- [x] **G-0045-7** ★end-to-end: OLD(approved) ← NEW(미래 valid_from) 계보에서
      **승격 차단 → 서빙 = OLD 단독**(blackout 0·이중 노출 0), 시행일 이후 승격 → **서빙 = NEW 단독**
- [x] **G-0045-8** 트리거 실재 + 미러 구성요소(`+9 hours`·`date(`·`COALESCE`) SQL 핀 (fail-open 차단)
- [x] **G-INT-1** 계보 불변식: 구·신 동시 서빙 검출 / 계보 공백 검출 / status 부재 시 `measured:false`
- [x] **G-REG** 전 워크스페이스 무회귀 (api 843 · quality 115 · scripts 28 · **E2E 26/26** · turbo typecheck 17/17·lint 17/17 · 훅 회귀 38/38)
- [x] **G-REVIEW** 독립 에이전트 리뷰 CRITICAL 0
      — 5-페르소나 병렬 실행 → raw CRITICAL 3 → **전건 처분 후 0**.
      보고서 `.claude/reviews/review-20260807-5persona-0045.md`

### 리뷰 처분으로 추가된 게이트 (0046)

- [x] **G-0046-1** approved 전이가 선행한 id 로 오늘 무효인 행 INSERT = ABORT (미래/만료/해석불가 3종)
- [x] **G-0046-2** ★무회귀: 전이 이력이 없으면 미시행 노드 INSERT 자유 (개정본 사전 준비 경로 보존)
- [x] **G-0046-3** approved 아닌 전이(review/flagged)는 무발화
- [x] **G-0046-4** formula·constant 대칭 (차단 + 정상 경로 통과)
- [x] **G-0046-5** ★e2e: 전이 선행 우회 시도 → 서빙 = 구본 단독 유지 (blackout 0)
- [x] **G-0046-6** ★선재 상태(0045 이전 DB)에서도 미발효 승계자는 은퇴를 못 일으킨다
- [x] **G-0046-7** ★무회귀: 오늘 유효한 승계자는 종전대로 구본 은퇴 → 서빙 = 신본 단독 (동시 노출 0)
- [x] **G-0046-8** 트리거 4종 실재 + 0042[1] 재생성본이 승계자 유효성 EXISTS 를 담고 있음
- [x] **G-0046-M** 변이 3/3 red (EXISTS 제거 / INSERT 게이트 삭제 / COALESCE 붕괴 제거) · 복원 sha256 동일
- [x] **G-LAPSE** `LINEAGE_LAPSE` — 엣지 없는 만료 검출 / 다중홉 오탐 0 / 빈 문자열·해석불가 단독 보고
- [x] **G-COMP** (2R) 계보 판정 = 성분 단위 — 위임 증발 0 / 분기 오탐 0 / 병합·순환 1건 수렴 /
      union-find ↔ 독립 BFS **400 케이스 불일치 0**
- [x] **G-MIRROR** (3R) ★미러 차등 테스트 — 실제 SQLite 서빙 SQL ↔ TS 미러 **54조합 대조, fail-open 0**.
      변이 7(2R 개방형 정규식 회귀) 즉시 red 로 검출력 실증
- [x] **G-0046-9/10/11** (2R·3R) 엣지 선행 순서 blackout 0 / 비활성 승계자 blackout 0 /
      다중홉 순서 역전 시 stale 노출 **현재 동작 고정**(헤더 ⑦ 등재 = 알고 택한 대가)

## 롤백 전략

- 0045/0046: **production 미적용** 상태이므로 파일 삭제로 롤백. 적용 후라면 말미 down 주석
  (0045 = DROP 6 / 0046 = DROP 3 + 0042 [1] 블록 재실행). ★**반쪽 롤백 금지** — 0039 가 켜진 채
  0045/0046 만 내리면 "발생은 못 막고 복구만 막힌" 최악 조합이다.
- 러너 불변식: 순수 코어 함수 + 옵션 필드라 revert 시 기존 동작 그대로.

## 범위 외 (명시 이월)

- **(B) 서빙 계보 해석**(카드 §2-B) — ADR-013 개정 + hot path 비용. 필요해질 때 별도 결재.
- **(A) 발효 스윕**(카드 §2-A) — (C) 로 승격/백필 문을 닫았으므로 불요. `valid_until` 도래형 실패는
  러너 `LINEAGE_LAPSE`(엣지 무관 노드 전수) **관측**으로 커버 — 후속본이 없으면 엣지가 없어
  `LINEAGE_GAP`(성분 단위)은 그 부류를 보지 못한다(2R 리뷰 지적 반영) — 자동 복구가 아니고, ★**자동 실행도 아니다**:
  `scripts/run-graph-integrity-production.ts` 는 어느 워크플로에도 배선돼 있지 않다
  (`.github/workflows/{ops,ci,d1-schema-drift,g1-gate}.yml` 전수 확인 2026-08-07). 즉 이 잔여 위험은
  **"덤프를 떠서 러너를 돌리면 보인다"** 수준이다. 러너 cron 배선 = 별건 후보(비차단).
- **batch state-machine 의 ABORT 타입화** — `apps/batch/src/loader/state-machine.ts:103` 의
  status_transitions INSERT 는 typed error(`TargetNotFoundError`/`InvalidTransitionError`) 계열과 달리
  0045 ABORT 를 raw D1 에러로 전파한다. 메시지 자체가 자기설명적이고, 술어를 코드에 복제하면
  단일 진실원이 깨지므로 **이번 범위에서 제외**(관측 기록). 필요해지면 메시지 기반 매핑이 아니라
  "승격 전 유효성 조회" 헬퍼로 별건 처리.
- 0043(formulas/constants 승계 지뢰) · 0040(WS-6c) — 별건 슬롯.
- STAGE 2 `source_quote` 축 = 대시보드 §A #7 별도 1줄.

## 승인 기록

- 2026-08-07 진산 **"c 진행"** — 카드 §5 (C) 채택 + 마이그 0045 작성·검증 착수
- (대기) 0045·0039 production 적용 = 별도 결재 (묶어서 상신)
