---
phase: master-remediation WS-2 (RC-1)
step: WS-2b — knowledge_edges UPDATE/DELETE 가드 트리거 신설
risk_level: L3 (DB 스키마/트리거 마이그레이션)
approved_by: TBD — 결재 완료 범위 = "plan 작성 착수"만 (결재 #3 (a), 진산 2026-07-02). plan 승인·SQL 작성·집행 승인 = §8 결재란 별도
scope:
  - migrations/0039_knowledge_edges_update_delete_guard.sql (슬롯 예약 — ★SQL 미작성, §8 결재 후)
  - apps/api/src/__tests__/scenarios/migration-0039-edges-guard.test.ts (SQL 과 동시 작성 — 0038 테스트 선례 위치)
  - apps/api/src/db/schema.ts (knowledgeEdges 주석 동기만 — shape 무변경, NC-1 영향 0)
related:
  - 결재 카드: docs/plans/master-remediation-20260610/decision-card-3-knowledge-edges-guard.md ((a) 채택 2026-07-02)
  - MASTER_PLAN.md:132 (WS-2b 정의 "plan 별도 작성 → 진산 승인 → SQL") + :136 Binary Gate G-WS2 ③
  - 절차 선례: docs/plans/tr-0-backend-c7-trigger-redesign.plan.md (plan→결재→SQL→4-Pass→preview→production)
  - 묶음 맥락: docs/plans/e0-2-graph-repair.plan.md (Track B = INSERT-only) + e0-2-graph-repair-analysis-appendix.md ③-①(가드 공백)·③-⑤(묶음 권고)
---

# WS-2b plan — knowledge_edges UPDATE/DELETE 가드 트리거 신설

> ★ **본 문서는 L3 plan 까지다 — 마이그 SQL 은 작성하지 않았다.** SQL 작성·테스트·
> production 집행은 §8 결재란 체크 후에만 착수한다 (TR-0/0038 선례 절차,
> `MASTER_PLAN.md:132`). RULE #5: 본 문서는 사실 + 선택지 + 권고 — 채택 = 진산.

> ★ 슬롯 상호 참조 (2026-07-02 리뷰 MAJOR-6): 본 plan = **0039** / `ws-6c-mock-exam-questions.plan.md` = **0040** 재번호. SQL 작성 시점 migrations/ 재실측 의무.

## 1. 목적 (1~2 문장)

production 보호 트리거 체계에서 유일하게 무가드인 `knowledge_edges` 에 UPDATE/DELETE
DB-레벨 차단 트리거를 신설한다 — 단 `is_active` 플립(E0-2 류 수리·stale 엣지 정리의
정당 경로)은 허용하여, Temporal Graph 감사 이력 보존과 그래프 수리 운영을 양립시킨다.

## 2. 배경 — 가드 공백 실측 (2026-07-02 실코드 재대조)

### 2.1 knowledge_edges 스키마 = 8컬럼 (`migrations/0001_initial_schema.sql:37-46`)

`id`(PK) · `from_node`(FK NOT NULL) · `to_node`(FK NOT NULL) · `edge_type`(NOT NULL) ·
`condition`(nullable) · `priority`(default 0) · `is_active`(default 1) · `created_at`.
status 컬럼 부재 — INSERT 즉시 활성 (draft 격리 불가, 부록 ③ 거버넌스 행).

### 2.2 현존 트리거 4개 전부 INSERT 계열 — BEFORE UPDATE / BEFORE DELETE = 0건

`grep -rn "ON knowledge_edges" migrations/` 전수 재확인 (2026-07-02):

| 트리거                                      | 종류          | 위치           |
| :------------------------------------------ | :------------ | :------------- |
| `enforce_edges_created_at_not_null`         | BEFORE INSERT | `0003:66-71`   |
| `mav_supersedes_knowledge_nodes_deactivate` | AFTER INSERT  | `0013:101-108` |
| `prevent_supersedes_reverse_cycle`          | BEFORE INSERT | `0014:181-192` |
| `prevent_supersedes_self`                   | BEFORE INSERT | `0014:195-200` |

즉 `UPDATE knowledge_edges SET edge_type=...` / `DELETE FROM knowledge_edges` 가
DB-레벨 무차단 — 동일 인증 세션 내 오발이 물리적으로 열려 있다 (부록 ③-⑤ 지적).

### 2.3 타 테이블과의 비대칭 — nodes 계열 가드 진화 이력 (본 plan PITR 의 전례 축)

| 단계              | 형태                                                         | 위치                                    |
| :---------------- | :----------------------------------------------------------- | :-------------------------------------- |
| 1. 전면 차단      | 무조건 ABORT                                                 | `0003:17-27` (nodes/formulas)           |
| 2. 플립 예외      | `WHEN OLD.is_current_active = NEW.is_current_active` → ABORT | `0013:64-86` (nodes/formulas/constants) |
| 3. 컬럼별 IS NOT  | 본문 컬럼 enumeration (NULL-safe) — **현행 최종형**          | `0014:34-95`                            |
| 3b. backfill 예외 | nodes 만 batch_run_id/source_id NULL→값 1회 허용             | `0016:67-89`                            |
| DELETE 차단       | 전면 ABORT (감사 이력 보존)                                  | `0014:105-121`                          |

exam_questions 도 동일 진화: `0004:39-43` 전면 → `0038:39-67` 컬럼 화이트리스트
default-deny (`prevent_exam_questions_body_update`, production 적용 ☑ 2026-06-11 —
`MASTER_PLAN.md:247` 결재 #11). **knowledge_edges 만 이 체계에서 처음부터 제외**
(부록 ③-① — "타 7테이블 보유 비대칭", `MASTER_PLAN.md:68`).

### 2.4 공백의 실사용 이력 (가드 필요성의 실증 + 플립 허용 근거의 실증)

- E0-2 Track A-1 이 가드 부재 창에서 수동 `UPDATE knowledge_edges SET is_active=0`
  (R1 SUPERSEDES 오용 엣지 11 + 진성 중복 2쌍) 을 집행 완료 — changes 26, 감사행
  RD-E02-A1-20260611 (`e0-2-graph-repair.plan.md:113-117` §8).
- 동 plan R-4: "가드 공백(WS-2b)이 메워지기 전 수동 UPDATE 는 본 plan 결재 범위로만"
  (`e0-2-graph-repair.plan.md:83`) — 절차 방어뿐, DB-레벨 방어 0 인 상태가 지속 중.
- 함의 2가지: ① 가드는 필요하다 (오발 창 실재) ② **is_active 플립은 정당 운영
  경로다** (수리 실적 실재) — 전면 차단이 아니라 플립-허용 가드가 정답 형상.

### 2.5 기존 자동화와의 충돌 검사

`knowledge_edges` 를 **UPDATE 하는 트리거는 어디에도 없다** — 0013 MAV 는
`knowledge_nodes.is_current_active` 를 갱신하지 엣지를 갱신하지 않는다 (`0013:104-107`,
부록 ③-① "공통 배경 전제 교정"). 엣지 비활성화는 전적으로 수동/애플리케이션 책임
→ UPDATE 가드 신설이 기존 자동화를 깨는 경로 = 0.

## 3. Reality Anchor (스키마 존재 ≠ 실태 — 2026-05-16 실수 클래스 방지)

- **production 트리거 현황 서술은 마이그 파일 기준이다**: 0001~0037 적용 기록
  (`.claude/reports/production-migration-status.md`) + 0038 production 적용 ☑
  2026-06-11 (`MASTER_PLAN.md:247` #11). **라이브 sqlite_master 대조는 집행 시퀀스
  step (1) 확인 항목으로 명기** (§7) — read-only SELECT:
  `SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='knowledge_edges'`
  결과가 §2.2 표 4건과 일치해야 착수 (불일치 시 중단·보고).
- 본 plan 대상은 데이터가 아닌 DDL(트리거) — 그래도 집행 직전 라이브 실측을 의무화.
- Track B 검수 일정: 카드 #3 은 06-15 예정으로 기록 — 2026-07-02 현재 검수 완료 여부
  [미확인]. 묶음 성립 여부는 §7 분기로 처리 (카드 명문: 미완 시 (b) 자연 강등, 손실 0).

## 4. PITR — 트리거 설계 옵션 비교 (권고 = A안)

| 축               | **A안: 컬럼별 IS NOT 화이트리스트** (0014/0038 최종형 동형)                                                                                          | B안: 전면 차단 + is_active 플립 예외 (0013 초기형 동형)                                                      |
| :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| WHEN 절          | 보호 7컬럼(id/from_node/to_node/edge_type/condition/priority/created_at) `NEW.x IS NOT OLD.x` enumeration → ABORT. `is_active` 만 WHEN 미포함 = 허용 | `OLD.is_active = NEW.is_active` → ABORT (플립일 때만 통과)                                                   |
| 혼합 UPDATE 방어 | **구조적 봉쇄** — 플립+본문 동시 변경도 본문 컬럼 변동이 WHEN 에 걸려 ABORT                                                                          | **알려진 구멍** — 플립+본문 동시 변경 통과 (`0013:59-60` 주석이 자인한 결함; nodes 가 0014 로 재정의한 사유) |
| NULL-safe        | `IS NOT` 필수 — `condition` nullable, `<>` 는 NULL↔값 전이 우회 (0038 헤더·G-TR0-3 선례)                                                             | 해당 없음 (is_active 는 NOT NULL 성격의 0/1)                                                                 |
| 유지비           | 8컬럼뿐이라 enumeration 극소 (exam_questions 22컬럼 대비). 신규 컬럼 추가 시 WHEN 갱신 의무 (체크리스트, §6 게이트)                                  | enumeration 불요                                                                                             |
| 전례 정합        | nodes(0014)·exam_questions(0038) **현행 최종형과 동형** — B→A 이행을 전례가 이미 실증                                                                | nodes 가 이미 밟고 **버린** 중간 단계로 회귀                                                                 |
| DELETE 차단      | 양안 공통: `BEFORE DELETE` 전면 ABORT (`0014:105-121` 동형 — Temporal 감사 이력 보존)                                                                | 동일                                                                                                         |

**권고 = A안.** 근거: ① B안의 혼합-UPDATE 구멍은 0013 주석이 자인했고 nodes 는 그
때문에 0014 컬럼별 IS NOT 으로 재정의된 전례가 실재 — 중간 단계로 되돌아갈 이유 없음.
② knowledge_edges 는 8컬럼뿐이라 A안의 유일 비용(enumeration 유지)이 극소.
③ 0038 default-deny 선례(진산 D-1 결재)와 정책 일관.

### 4.1 부속 결정 항목 (§8 결재란과 연동)

| #       | 결정 항목                       | 옵션                                            | 권고                                                                                                                                                                                                     |
| :------ | :------------------------------ | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-1** | 트리거 설계                     | A안 (컬럼별 IS NOT) / B안 (전면 차단+플립 예외) | **A안** (§4 비교)                                                                                                                                                                                        |
| **D-2** | `condition`/`priority` 보호등급 | (a) ABORT (본문 취급) / (b) 화이트리스트 허용   | **(a) ABORT** — 엣지 속성 변경의 정상 경로 = `is_active=0` + 신규 INSERT (Temporal 정합). 메타-UPDATE 실수요 현재 0건 (실측: `grep "UPDATE knowledge_edges"` apps/packages/scripts = 0 히트, 2026-07-02) |

## 5. 대상 파일 + 마이그 슬롯

| 파일                                                                  | 종류      | 내용 (§8 결재 후 작성)                                                                                                                                            |
| :-------------------------------------------------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrations/0039_knowledge_edges_update_delete_guard.sql`             | 신규      | `prevent_knowledge_edges_update` (D-1 채택안 WHEN 절) + `prevent_knowledge_edges_delete` (전면 ABORT). 헤더 docstring = 정책·결재 근거·롤백 주석 (0038 서식 준용) |
| `apps/api/src/__tests__/scenarios/migration-0039-edges-guard.test.ts` | 신규      | §6 게이트 전수 — `createD1FromAllMigrations` 하네스 강제 (G-TR0-12 선례)                                                                                          |
| `apps/api/src/db/schema.ts`                                           | 주석 동기 | `knowledgeEdges`(:243-258) 에 보호/허용 컬럼 구분 주석만 — shape 무변경                                                                                           |

**마이그 슬롯 실측 (2026-07-02)**: `migrations/` 37 파일, 최고 번호 **0038**
(0020 결번). 차기 가용 번호 = **0039**. 결번 0020 재사용 금지 — 파일명 순차 적용
관례에서 기적용 DB 뒤로 과거 번호를 삽입하면 적용 순서·감사 추적이 혼동된다
(최고번호+1 원칙).

## 6. Binary Gate (G-WS2b — G-TR0 패턴, MASTER_PLAN G-WS2 ③ 충족)

- [ ] **G-WS2b-1 본문 가드**: 보호 7컬럼(id/from_node/to_node/edge_type/condition/priority/created_at) 전수 **단독 UPDATE ABORT**.
- [ ] **G-WS2b-2 플립 허용**: `is_active` 1→0 및 0→1 단독 UPDATE **성공** (E0-2 류 수리 경로 보존).
- [ ] **G-WS2b-3 혼합 UPDATE ABORT**: 한 UPDATE 문에 is_active 플립 + 본문 컬럼 동시 변동 시 ABORT (0013식 구멍 회귀 차단). `condition` NULL↔값 전이 케이스 포함 (`IS NOT` NULL-safe 검증).
- [ ] **G-WS2b-4 DELETE 전면 차단**: 단건·다건 DELETE ABORT.
- [ ] **G-WS2b-5 INSERT 경로 회귀 0**: 기존 4 트리거(§2.2) 동작 불변 — created_at NULL ABORT · SUPERSEDES INSERT 시 to_node 자동 비활성(0013 MAV) · 역순환/자기참조 ABORT 각 1케이스.
- [ ] **G-WS2b-6 트리거 생성 검증 (fail-open 차단)**: 적용 후 sqlite_master 에서 신규 트리거 2건 COUNT 확인 (no-op 마이그가 녹색 통과하는 위양성 차단 — G-TR0-6 선례).
- [ ] **G-WS2b-7 멀티행 원자성**: 다행 UPDATE 중 1행이라도 본문 변동 시 문 전체 ABORT.
- [ ] **G-WS2b-8 하네스 강제**: 테스트는 `createD1FromAllMigrations`(readdir 자동 — 0039 포함) 사용. 큐레이션 배열 사용 시 0039 누락 위양성 (G-TR0-12 선례).
- [ ] **G-WS2b-9 production smoke**: 집행 후 `SELECT COUNT(*) FROM knowledge_edges` 변동 0 (기준: total 1274 / active 1261, E0-2 §8) + 신규 트리거 2건 라이브 sqlite_master 존재.

## 7. Track B 묶음 집행 시퀀스 (카드 #3 (a) 채택안)

전제: §8 plan 승인 + SQL 작성 승인 → SQL·테스트 작성 → 4-Pass 독립 리뷰 CRITICAL 0
→ D1 preview/로컬 dry-run G-WS2b-1~8 PASS → **집행 승인** 후 아래를 **동일 진산 인증
세션 1회**로:

1. **라이브 현황 실측** (read-only): sqlite_master 트리거 4건 = §2.2 일치 확인 (Reality Anchor §3 — 불일치 시 중단·보고).
2. **0039 가드 선적용** (`wrangler d1 execute thepick-db-production --remote`, 진산 인증 게이트 — [feedback_full_autonomy] 위임 범위 외).
3. **가드 존재 확인** (G-WS2b-6 라이브측) — 이후 엣지 쓰기는 전부 가드 하에서 발생.
4. **Track B 수리 SQL 집행** — INSERT-only(`e0-2-graph-repair.plan.md:52` §2 Track B, 검수 승인분만) 라 가드와 충돌 0. 단 수리 엣지에 SUPERSEDES 타입 절대 금지 (0013 MAV to_node 자동 비활성화 — e0-2 plan §4, 가드와 무관한 INSERT-측 제약) + NOT EXISTS 중복 가드 + review_decisions 기록 (G-RP-4/5).
5. **러너 재실행 gatePass**: `pnpm tsx scripts/run-graph-integrity-production.ts` — 고아 24−승인분 · 유령 0 유지 · 순환 0 (E0-2 G-RP-1~3) + G-WS2b-9.

**분기 (카드 명문)**: Track B 검수 미완이면 0039 단독 집행 = 카드 (b) 자연 강등 —
손실 0, 가드 공백만 먼저 닫힘. 어느 분기든 순서 불변식 = **가드가 Track B INSERT 보다
선행** (부록 ③-⑤ "선행/동시 적용" 권고 — 다음 엣지 쓰기 시점에 이미 가드 존재).

## 8. 결재란 (RULE #5 — SQL 승인은 plan 승인과 별도)

```
[ ] plan 승인 (본 문서 §1~§7 + D-1/D-2 채택안 확정)
[ ] D-1: 트리거 설계 = A안 (권고) / B안
[ ] D-2: condition/priority = (a) ABORT (권고) / (b) 허용
[ ] SQL 작성 승인 (migrations/0039 + 테스트 — 작성 후 4-Pass·preview 검증까지)
[ ] production 집행 승인 (§7 시퀀스 — Track B 묶음 여부 포함, 진산 Cloudflare 인증)
```

## 9. 위험 분석 / 롤백

| 위험                                        | 가능성    | 영향 | 완화                                                                                                          |
| :------------------------------------------ | :-------- | :--- | :------------------------------------------------------------------------------------------------------------ |
| 정당 플립까지 차단 (미래 수리·자동화)       | 낮음      | 중간 | is_active 는 WHEN 미포함 허용 — Track A-1 류 수리 경로 보존. 플립 거버넌스는 트리거 아닌 결재 절차 (R-4 승계) |
| 신규 컬럼 추가 시 보호 망각 (A안)           | 중간      | 중간 | 0039 헤더 + schema.ts 주석에 "신규 컬럼 = WHEN enumeration 갱신 의무" 체크리스트 (0038/ADR-046 §D-5 준용)     |
| 기존 INSERT 자동화 파손                     | 매우 낮음 | 높음 | §2.5 — 엣지를 UPDATE 하는 트리거 부재 실측 + G-WS2b-5 회귀 게이트                                             |
| no-op 마이그 위양성                         | 낮음      | 중간 | G-WS2b-6 sqlite_master 카운트 검증 (테스트 + 라이브 양측)                                                     |
| 라이브 트리거 현황 ≠ 마이그 파일 (드리프트) | 낮음      | 높음 | §7 step 1 착수 전 실측 의무 — 불일치 시 중단·보고 (Reality Anchor)                                            |

**롤백**: DDL-only(데이터 변경 0) — `DROP TRIGGER prevent_knowledge_edges_update;
DROP TRIGGER prevent_knowledge_edges_delete;` 로 무가드 원상 복귀 (down 주석을 0039
말미에 동봉 의무, 0038 서식). D1 Time Travel 불요.

## 10. carry-over (본 plan 범위 밖)

- 엣지 status/draft 격리 부재 (INSERT 즉시 활성, §2.1) — 거버넌스는 검수-선행 절차로만 방어 중. 스키마 확장은 별건 (부록 ③ 거버넌스 행).
- 애플리케이션-레이어 가드 (Drizzle/raw statement 측 UPDATE 금지 lint) — TR-0 §9 "단일 진실원 우회 진앙 #1"과 동일 클래스, 별도 plan.
- 여타 테이블 가드 전수 재감사 — RC-1 은 knowledge_edges 를 마지막 공백으로 판정 (`MASTER_PLAN.md:68` "타 7테이블 보유 비대칭") 이나 26 테이블 전수 대조는 미수행 [미조사], E1 게이트 후보.
