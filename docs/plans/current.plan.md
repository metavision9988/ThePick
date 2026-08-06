---
phase: 3
step: 역이식 STAGE 0+1 (안전장치 수리 + 데이터 보호 가드)
approved_by: 진산 (2026-08-06, "0·1단계 진행") — 근거 = docs/plans/catchall-역이식-체크리스트.md STAGE 0·1
risk_level: L3
scope:
  # --- STAGE 0: 안전장치 배선 수리 (L3 아님 — 훅/설정) ---
  - .claude/hooks/protect-l3.sh
  - .claude/hooks/quality-gate.sh
  - .claude/hooks/enforce-review.sh
  - .claude/settings.json
  - scripts/protect-l3.test.sh
  # --- STAGE 0-4: 시행일 창 필터 (L3 아님 — SELECT 경로) ---
  - apps/api/src/search/approved-nodes-sql.ts
  - apps/api/src/search/user-search.ts
  - apps/api/src/search/__tests__/approved-nodes-sql.test.ts
  - apps/api/src/search/graph-walk/__tests__/graph-walk.golden.test.ts
  - apps/api/src/study/routes.ts
  - apps/api/src/study/__tests__/routes.test.ts
  # --- 테스트 하네스 현행화 + 드리프트 가드 (독립 리뷰 수리) ---
  - apps/api/src/__tests__/helpers/d1-from-sqlite.ts
  - apps/api/src/__tests__/scenario-migrations-drift.test.ts
  # --- STAGE 1: L3 — DB 스키마 가드 ---
  - migrations/0039_knowledge_edges_guard_and_node_reactivation.sql
  - apps/api/src/__tests__/scenarios/migration-0039-edges-guard.test.ts
  - apps/api/src/db/schema.ts
  - docs/plans/ws-2b-knowledge-edges-guard.plan.md
  # --- 진행 추적·문서 (동커밋 갱신 의무) ---
  - docs/plans/catchall-역이식-체크리스트.md
  - docs/plans/catchall-역이식-분석-20260806.md
  - docs/plans/catchall-역이식-쉬운말-20260806.md
  - docs/plans/APPROVAL_DASHBOARD.md
  - docs/plans/current.plan.md
  - docs/plans/current.plan.20260425-step1-5-ga-1-stale.md
---

> ★ scope 정합 이력: 초판 scope 는 실제 변경셋과 어긋났다(유령 1건 `enrich-related-nodes.test.ts` ·
> 미선언 4건). 스스로 켠 scope 대조 게이트의 신뢰 근거가 자기 자신부터 흔들린 셈이라,
> 독립 리뷰 지적(MINOR)을 받아 **실제 `git status` 와 1:1로 맞췄다**(2026-08-06).

## 목적

catchall(이음길) 역이식 분석(`catchall-역이식-분석-20260806.md`)이 실측으로 확정한 **현재 결함 3건**을
수리하고, 데이터 보호 가드를 마저 채운다. **새 기능 0 · 자동 승격 관련 코드 0.**

정본 3종:

- 기술 근거 = `catchall-역이식-분석-20260806.md` §3
- 쉬운 말 = `catchall-역이식-쉬운말-20260806.md`
- **진행 체크 단일 정본 = `catchall-역이식-체크리스트.md`** (작업 단위마다 **같은 커밋에서** 갱신 의무)

## 결재 근거

- 진산 2026-08-06 **"0·1단계 진행"** — 체크리스트 STAGE 0(결재 불요·수리) + STAGE 1(SQL 작성 착수)
- ★**승인 범위 = SQL 작성·로컬/staging 검증까지.** `wrangler --remote` production 적용은 **별도 게이트**
  (TR-0/0038 선례 절차 준수. 결재 대시보드 §A 로 재상신)

## 대상 변경

### STAGE 0-1·0-2·0-3 — 안전장치 배선 수리 (L3 아님)

| 항목 | 변경                                                                                                                                                                  | 근거                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 0-1  | `protect-l3.sh` — ① argv 부재 시 **stdin JSON 폴백** ② `realpath -m` 경로 정규화(`..` 우회 차단) ③ **scope 대조** 신설                                                | 분석 §3-A. 라이브 프로브로 현 상태 `exit 0`(무차단) 확정                                                                 |
| 0-1b | `quality-gate.sh` — **동일 배선 결함 추가 발견** (`FILE_PATH="${1:-}"` 후 `[[ -z ]] && exit 0`). 같은 stdin JSON 폴백 적용 + Write/Edit/MultiEdit 3서식에서 본문 추출 | 분석 §3-A 와 동근. 즉 **안전장치 2개가 동시에 죽어 있었다** (분석 문서 v1 은 protect-l3 만 지목 — 본 집행에서 확대 확인) |
| 0-2  | `enforce-review.sh` — **`.review-blocked` 3상태화** (리뷰 완료·인간 결재 대기 = 정지 허용)                                                                            | ★0-1과 동시 필수. 안 하면 "CRITICAL 0이어야 완료" ↔ "완료해야 rm" 정지 루프                                              |
| 0-3  | `settings.json` — 절대경로 → `$CLAUDE_PROJECT_DIR`, 비표준 `$CLAUDE_FILE_PATH` argv 제거                                                                              | worktree `../ThePick-jeongi` 가 메인 트리 훅을 실행 중                                                                   |

★ **ThePick 고유 개조 (catchall 판 그대로 쓰면 안 되는 지점)**: catchall 의 scope 파서는 `scope:` **단일행**
인라인 목록만 읽는다. ThePick 의 plan 서식은 **YAML 블록 리스트**(`scope:` 다음 줄부터 `  - path`)라
catchall 판을 그대로 이식하면 SCOPE_PATHS 가 0개 → fail-closed 로 **전 L3 경로가 차단**된다.
→ **두 서식을 모두 읽는 파서로 개조**한다. (분석 문서가 ADAPT 로 분류한 이유)

### STAGE 0-4 — 시행일 창 필터 (L3 아님, SELECT 경로)

> ★★ **집행 중 실측 정정 (2026-08-06, production SELECT)** — 분석 문서 §3-B 의 긴급성 주장을 하향한다.
>
> | 확인                                                      | 실측값                                                                                                  |
> | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
> | `knowledge_nodes` 총계 / `valid_from` 채워진 행           | **857 / 0** (`valid_until` 도 0)                                                                        |
> | 0041 이 지목한 미시행 4노드(LAW-022·023·053·INV-087) 상태 | **전부 `draft`** = 학습자 경로에 이미 미노출                                                            |
> | `2026.8.15` 언급 + `approved` 노드                        | **LAW-145 단 1건**, 그런데 개정을 _"(시행 2026.8.15 개정: …)"_ 괄호로 **병기** — 현행으로 위장하지 않음 |
> | `related_nodes` 참조 노드(10문항)의 상태                  | **전부 approved** — draft 누출 0건                                                                      |
>
> ⇒ **현재 학습자 오노출은 없다.** 분석 §3-B 의 "학습자가 9일 뒤 시행 내용을 현행으로 배우고 있다"는
> **과장이었고 본 집행에서 철회**한다(존재 주장을 데이터로 확인하지 않은 채 단정 — 정확히 catchall
> 실수 로그 2026-08-04 클래스). 남는 것은 **잠재 결함(구조적 공백)** 이며, 그래서 수리는 그대로 하되
> **production 백필은 하지 않는다**(불필요·불급 + 진산 인증 게이트).
>
> ★ 그리고 실측 중 **더 넓은 공백**을 찾았다: RW plan §3-A-2 가 이미 "필터점은 단일이 아님"으로
> 확증해 둔 (ii) `study/routes.ts` **`enrichRelatedNodes` 는 `is_current_active=1` 만 본다** —
> 시행일뿐 아니라 **approved 상태조차 확인하지 않는다**. 현재 데이터가 우연히 전부 approved 라
> 사고가 안 났을 뿐, 학습자 노출 경로에서 draft 가 새는 구조다. **본 단계에서 함께 봉합**한다.
> (필터점 (iii) vectorize 임베딩 = 정책 결정 필요 → 범위 밖·이월)

- `APPROVED_NODES_STATUS_CORE` 에 `valid_from`/`valid_until` 창 조건 추가.
  이 문자열이 **status 도출 단일 진실원**이라 4 호출 측(graph-walk·user-search·keyword·study)에 자동 전파.
- `user-search.ts:492-499` 의 stale 주석 정정 (0041 이후 "컬럼이 exam_questions 에만 존재"는 사실 아님).
- **부수 의무**: MATERIALIZED CTE hot path(195→67ms 실측) 앞단 조건 추가 → **속도 재측정**.
- 시각 기준: KST 고정(`date('now','+9 hours')`) — 시험 도메인은 한국 시행일 기준.

### STAGE 1 — L3: knowledge_edges 가드 + 노드 부활 차단

마이그 **0039** 한 장에 3종 합본 (WS-2b plan 예약 슬롯 재사용, 실측 = 파일 부재 확인):

1. `prevent_knowledge_edges_delete` — 전면 ABORT (본체 3테이블은 이미 보유, 엣지만 공백)
2. `prevent_knowledge_edges_update` — 컬럼 화이트리스트 (`is_active` flip 만 허용 — 0042 동반 은퇴 경로 보존)
3. **신규** `prevent_knowledge_nodes_reactivation` — `is_current_active` **0→1 차단**
   (0041 트리거 WHEN 절에 이 컬럼이 미열거 = 현재 양방향 자유. 0013:58-60 이 자인한 "application 레이어 강제"를 기계강제로 승격)

## 위험 분석

| 위험                                                                | 완화                                                                                                     |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **0-1 적용 즉시 지금까지 통과하던 편집이 차단** → 세션 정지         | 0-2 `.review-blocked` 동시 적용 + 본 plan scope 에 전 대상 파일 선등록 (이 문서가 그 이행)               |
| catchall scope 파서 그대로 이식 시 **전 L3 차단**                   | 상기 ★ 개조. 음성 실측(`scripts/protect-l3.test.sh`)으로 블록 리스트·인라인 양 서식 통과 확인            |
| 0-4 가 검색 hot path 회귀                                           | 조건 2개는 인덱스 무관 필터 — 적용 전후 속도 실측 후 기록. 회귀 시 즉시 revert(SELECT 문자열 1곳)        |
| 0039 부활 차단이 **실수 롤백 경로를 막음**                          | 복구 절차를 "신규 INSERT + 승격"으로만 문서화 (Temporal Graph 원칙 정합). plan·마이그 헤더 양쪽 명시     |
| 0039 가 기존 운영 경로 파손                                         | Track B 고아 수리는 INSERT-only(ws-2b plan §7 분석) · 0042 정상 flip 통과 확인 · api 780 무회귀 의무     |
| L3 "진행" 지시를 SQL 작성 승인으로 과잉 해석 (2026-05-29 실수 재발) | ws-2b plan `approved_by` 를 **먼저** 명시 전환 후 SQL 작성. production 적용은 본 plan 범위 밖으로 명문화 |

## 검증 계획 (Binary)

- [x] **G-S0-1** stdin JSON 만 준 L3 경로 → `exit 2` / argv 형·`..` 우회형·절대경로형 전부 `exit 2`
      — `scripts/protect-l3.test.sh` §1·5·8
- [x] **G-S0-2** scope 밖 L3 파일 → `exit 2` (approved_by 채워져 있어도) / scope 안 → `exit 0` — §2
- [x] **G-S0-3** scope 가 **YAML 블록 리스트**일 때 정상 파싱 — §2 (ThePick 서식 회귀 가드)
- [x] **G-S0-4** `.review-blocked` 선언 후 정지 허용 / 무효화 — §10·§11(h). ★리뷰 수리로
      "파일 수" 판정 → **목록 해시** 판정으로 강화(같은 파일 재수정도 재리뷰 요구)
- [x] **G-S0-5** 미래 `valid_from` → 미노출 / 과거 `valid_until` → 미노출 / **datetime 포맷도 동일 판정** /
      기존 approved **551 반환 수 무변동 (production 실측 551 = 현 approved 수 일치)**
- [x] **G-S1-1** `DELETE FROM knowledge_edges` → ABORT — `migration-0039-edges-guard.test.ts`
- [x] **G-S1-2** 엣지 본문 7컬럼 UPDATE → ABORT / `is_active` flip → 통과
- [x] **G-S1-3** `is_current_active` 0→1 → ABORT / 1→0 → 통과 / 0041 백필 무회귀
- [x] **G-S1-4** 전 워크스페이스 무회귀 — api **808**(기준선 780) · batch 332 · quality 86 · web 79 ·
      formula-engine 359 · parser 179 · learning-modes 135 · shared 66 · srs 35 · admin-web 21 ·
      ai-adapter 13 · scripts 27 · **E2E 26/26** · 훅 회귀 **38/38** · typecheck·lint·G-1 green
- [x] **G-REVIEW** 독립 에이전트 리뷰 (`wf_02ed73c4-f29`, 44 에이전트·5.0M tok, 5 렌즈 + 발견별 적대 반증)
      → 제기 39 · **반증 기각 12** · 생존 27(하향 후 MAJOR 9 / MINOR 18) → **전건 처분**.
      **CRITICAL 0**(유일 CRITICAL 제기건은 반증에서 MAJOR 로 하향 — 현 데이터 미도달·복구 가능).

### 성능 재측정 (plan 부수 의무 이행 — production 실측 2026-08-06)

| 경로                          | 변경 전                 | 변경 후             | 비고                                       |
| ----------------------------- | ----------------------- | ------------------- | ------------------------------------------ |
| `enrichRelatedNodes` (id 7건) | 0.84 ms / rows_read 857 | **2.35 ms / 4,178** | +1.5 ms · 결과 집합 동일(7/7)              |
| approved 전량 도출            | —                       | **2.80 ms / 5,571** | 반환 **551** = 현 approved 수 일치(무회귀) |
| `status_transitions` 규모     | —                       | 551행(전부 node)    | 윈도우 대상                                |

판정: 절대 비용 1.5 ms 증가는 hot path 예산 내로 수용. **부채 기록** — 코어가 후보 한정 전에
`status_transitions` 전량을 윈도우 처리하므로, 전이 이력이 수천 행대로 커지면 후보 id 를 서브쿼리에
밀어넣는 형태로 재설계가 필요하다(현재는 단일 진실원 유지를 우선).

## 롤백 전략

- 0-1~0-3: 훅/설정 파일 revert (DB 영향 0)
- 0-4: `APPROVED_NODES_STATUS_CORE` 문자열 1곳 revert
- 0039: **production 미적용 상태**이므로 파일 삭제로 롤백. 적용 후라면 `DROP TRIGGER` 3종

## 범위 외 (명시 이월)

- STAGE 2 `source_quote` 축 — 진산 별도 1줄 (대시보드 §A #7)
- STAGE 3 검증 엔진 이식 · STAGE 4 정답지·자동화 준비
- 0040 (WS-6c mock) — 별건. 체크리스트 1-3 에서 처리 여부만 결정
- `constants` L3 패턴의 과잉 매칭(무앵커 substring) — 관측만. 패턴 변경 = 정책 변경이라 수리 범위 밖

## 승인 기록

- 2026-08-06 진산 **"0·1단계 진행"** — STAGE 0 착수 + STAGE 1 SQL 작성 착수 승인
- (대기) 0039 production 적용 = 별도 결재
