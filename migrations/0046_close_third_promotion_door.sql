-- ============================================================
-- Migration 0046: 세 번째 문 봉쇄 — "승인 기록만으로 구본을 은퇴시킬 수 없다"
-- ============================================================
-- STATUS: 선작성본 — **production 적용(wrangler --remote) 미승인**.
--   승인 범위 = SQL 작성·로컬 검증까지. 적용은 0039·0045 와 **한 묶음**으로 별도 결재
--   (결재 대시보드 §A #10). 셋은 서로의 전제라 부분 적용 금지 — 아래 [적용 순서] 참조.
--
-- plan   : docs/plans/current.plan.md (§리뷰 처분 C-1)
-- 결정   : docs/plans/decision-card-20260807-supersedes-effectivity.md ((C) 정책) + §8 리뷰 처분
-- 리뷰   : .claude/reviews/review-20260807-5persona-0045.md (5-페르소나 독립 병렬, CRITICAL 처분)
--
-- ── 왜 필요한가 (독립 리뷰가 실행 재현한 것) ──────────────────────────────────
-- 0045 헤더는 "위험 구간에 도달하는 문은 둘이고, 둘 다 잠근다"고 단정했다. **문은 셋이었다.**
-- 5-페르소나 리뷰 중 3개 렌즈가 서로 모르는 채 같은 구멍에 수렴했고, 메인 세션이 전 마이그
-- (0001~0045) 적용 하네스에서 직접 재현했다:
--
--   1) 노드가 **아직 없는 상태**로 status_transitions(to_status='approved') INSERT
--      → 0045 [A] 의 EXISTS 가 거짓이라 통과 (헤더 :60 이 "참조 무결성 담당 아님"으로 의도 고정)
--   2) 그 id 로 미시행 노드(valid_from = 미래)를 INSERT  → 0045 는 INSERT 무대상이라 통과
--   3) SUPERSEDES 엣지 INSERT
--      → 0042 [1] 이 승계자의 **도출 status = approved** 만 보고 구본을 은퇴
--   ⇒ 구본 은퇴 + 신본 미발효 = **blackout**. 그리고 0039 가 in-place 부활을 막으므로 **복구 불가**.
--
-- ★ 이 문은 카드 §0 이 (a)안을 기각한 논거("SQLite 에 시간 기반 트리거가 없다")의 **사정거리 밖**이다.
--   여기서 은퇴를 일으키는 것은 시각 경과가 아니라 **명백한 이벤트(엣지 INSERT / 노드 INSERT)** 이고,
--   이벤트가 있으면 트리거로 막을 수 있다. 즉 "원리상 불가"가 아니라 **누락**이었다.
--
-- ── 무엇을 하는가 ─────────────────────────────────────────────────────────────
--   [C-1] 0042 [1] 재생성 — 승계자가 approved 이고 **오늘 실제로 서빙될 때만** 구본을 은퇴시킨다.
--   [C-3] 0042 [2] 재생성 — 승격 동반 flip 에도 **같은 조건**. (2R 리뷰: [1]만 고치면 "엣지 먼저,
--         승격 나중" 순서가 열려 있었고 그게 오히려 AI draft 표준 워크플로다.)
--   [C-2] knowledge_nodes / formulas / constants BEFORE INSERT —
--         **이미 approved 전이가 있는 id** 를 오늘 무효인 시행일로 INSERT 하면 ABORT.
--         (= 위 재현 시퀀스의 2단계를 차단. [C-1] 과 이중 방어이며 서로를 대체하지 않는다:
--           [C-1] 은 은퇴를, [C-2] 는 "승인됐는데 미발효" 상태의 성립 자체를 막는다.)
--
-- ── (a)안 재도입이 아닌 이유 (중요) ───────────────────────────────────────────
-- 카드가 (a)("승계자가 발효됐을 때만 은퇴")를 기각한 이유는 **시행일이 와도 은퇴를 발화시킬
-- 이벤트가 없어 구·신 동시 노출이 된다**는 것이었다. 그 논거는 0045 [A] 가 없던 시점의 것이다.
-- [A] 적용 후에는 **approved ⟹ 승격 시점에 유효**가 기계로 보장되고, 승격 시점의 flip 은
-- 0042 [2](mav_promotion_flip_superseded_nodes, status_transitions AFTER INSERT)가 이미 담당한다.
-- 따라서 [C-1]/[C-3] 의 추가 조건이 참이 아닌 경우는 정상 경로에 잘 나타나지 않는다.
-- ★단 "남는 것은 위 우회 시퀀스뿐"이라고 단정하지 않는다 — 2R 독립 검증이 그 단정을 반증했다
--   (비활성 승계자 경로 · 승격 후 강등 경로). 아래 §"막지 않는 것"이 알려진 미커버 목록이며,
--   그 목록조차 **완결 증명이 아니라 다각 재현의 결과**다. 상시 관측(무결성 러너)이 필요한 이유다.
-- (시각 경과형 = `valid_until` 도래는 여전히 트리거로 불가. 관측 = 무결성 러너 계보 불변식.)
--
-- ── 판정식 = 서빙 코어의 미러 (0045 와 동일 규약) ─────────────────────────────
--   apps/api/src/search/approved-nodes-sql.ts `buildEffectivityWindowSql` / `TODAY_KST_SQL`:
--     · 반개구간 [valid_from, valid_until)   · NULL = 무제한
--     · KST 고정 date('now','+9 hours')      · date() 정규화
--     · 해석 불가 = fail-closed → COALESCE(<비교>, 0) = 0 으로 3값 논리 명시 붕괴
--   ★ 코어의 창 규약이 바뀌면 0045 와 **본 마이그를 함께** 새 마이그로 재생성해야 한다.
--     (경고를 의존의 상류에도 남겼다 — approved-nodes-sql.ts 헤더 참조.)
--
-- ── [적용 순서] ★부분 적용 금지 ──────────────────────────────────────────────
--   0039 → 0045 → 0046 (파일명 순 = wrangler d1 migrations apply 순서와 동일).
--   · 0039 만 적용: 부활 차단만 켜짐 = blackout 이 나면 **복구 불가**인데 발생은 안 막힌다.
--   · 0045 만 적용: 문 둘만 잠김 = 위 우회 시퀀스가 그대로 열려 있다.
--   · 롤백도 묶음이다 — 0046 만 DROP 하면 0039 의 부활 차단이 켜진 채 세 번째 문이 다시 열린다.
--
-- 데이터 변경 0 (DDL only). 적용 시점 실측치는 마이그 본문이 아니라 적용 원장에 기록한다
-- (.claude/reports/production-migration-status.md — 마이그 파일은 불변이라 스냅샷이 박제된다).
-- ============================================================

-- ============================================================
-- [C-1] 0042 [1] 재생성 — 승계자가 "approved + 오늘 유효" 일 때만 구본 은퇴
-- ============================================================
-- 0042 원본과의 차이는 마지막 AND 블록 하나뿐이다. 나머지(엣지 타입·is_active·실 status 도출
-- + rowid DESC 타이브레이커)는 **문자 그대로 보존** — 재생성은 회귀 표면이므로 최소 변경.
DROP TRIGGER IF EXISTS mav_supersedes_knowledge_nodes_deactivate;
CREATE TRIGGER mav_supersedes_knowledge_nodes_deactivate
AFTER INSERT ON knowledge_edges
WHEN NEW.edge_type = 'SUPERSEDES'
  AND NEW.is_active = 1
  AND COALESCE(
        (SELECT st.to_status
           FROM status_transitions st
          WHERE st.target_type = 'node' AND st.target_id = NEW.from_node
          ORDER BY st.transitioned_at DESC, st.rowid DESC
          LIMIT 1),
        'draft') = 'approved'
  -- ★0046 신설 조건: 승계자가 **실제로 서빙되는 상태**여야 한다 (미발효/만료/비활성 승계자는 은퇴 못 시킴)
  --   is_current_active 를 함께 보는 이유(2R 리뷰 MAJOR): INSERT 시 이 컬럼에는 어떤 가드도 없어
  --   `is_current_active=0` 인 승계자를 손작성 SQL 로 넣을 수 있고(E0-8 갭 적재가 실제로 --file 경로다),
  --   그러면 approved·오늘 유효라 EXISTS 를 통과해 구본만 은퇴시킨다 = 구 0 · 신 0 blackout(실측 재현).
  AND EXISTS (
    SELECT 1 FROM knowledge_nodes kn
     WHERE kn.id = NEW.from_node
       AND kn.is_current_active = 1
       AND (kn.valid_from  IS NULL OR COALESCE(date(kn.valid_from)  <= date('now','+9 hours'), 0) = 1)
       AND (kn.valid_until IS NULL OR COALESCE(date(kn.valid_until) >  date('now','+9 hours'), 0) = 1)
  )
BEGIN
  UPDATE knowledge_nodes
    SET is_current_active = 0
    WHERE id = NEW.to_node AND is_current_active = 1;
END;

-- ============================================================
-- [C-3] 0042 [2] 재생성 — 승격 동반 flip 에도 **같은 유효성 조건** (2R 리뷰 MAJOR-1)
-- ============================================================
-- [C-1] 만 고치면 비대칭이 남는다. 은퇴를 일으키는 트리거는 **둘**이고, 순서가 갈린다:
--   · 엣지를 나중에 건다 → 0042 [1] 발화        ← [C-1] 이 잠금
--   · 엣지를 먼저 걸고 나중에 승격한다 → 0042 [2] 발화  ← 잠금 없음이었다
-- 두 번째가 AI draft 표준 워크플로(엣지 선작성 → 검수 → 승격)이므로 오히려 더 흔한 순서다.
-- 0045 [A] 가 적용된 환경에서는 "미발효 승격" 자체가 막히지만, **0045 미적용 환경**
-- (2호 초기 D1 · staging · 백업 복원본 = 0046 헤더가 스스로 지목한 환경)에서는 그대로 뚫린다.
-- 2R 독립 검증이 그 시퀀스를 실행 재현했다: `served = []` (blackout).
-- ⇒ [2] 에도 동일 조건을 달아 **순서와 무관하게** 같은 불변식이 성립하게 한다.
DROP TRIGGER IF EXISTS mav_promotion_flip_superseded_nodes;
CREATE TRIGGER mav_promotion_flip_superseded_nodes
AFTER INSERT ON status_transitions
WHEN NEW.target_type = 'node' AND NEW.to_status = 'approved'
  AND COALESCE(
        (SELECT st.to_status
           FROM status_transitions st
          WHERE st.target_type = 'node' AND st.target_id = NEW.target_id
          ORDER BY st.transitioned_at DESC, st.rowid DESC
          LIMIT 1),
        'draft') = 'approved'
  -- ★0046 신설 조건 — [C-1] 과 **키 컬럼 참조를 제외하면 동일**한 술어
  --   ([C-1] 은 NEW.from_node, 여기는 NEW.target_id. 3R 검증이 "문자 그대로 동일" 표현을 반증했다.)
  AND EXISTS (
    SELECT 1 FROM knowledge_nodes kn
     WHERE kn.id = NEW.target_id
       AND kn.is_current_active = 1
       AND (kn.valid_from  IS NULL OR COALESCE(date(kn.valid_from)  <= date('now','+9 hours'), 0) = 1)
       AND (kn.valid_until IS NULL OR COALESCE(date(kn.valid_until) >  date('now','+9 hours'), 0) = 1)
  )
BEGIN
  UPDATE knowledge_nodes
    SET is_current_active = 0
    WHERE is_current_active = 1
      AND id IN (
        SELECT ke.to_node
          FROM knowledge_edges ke
         WHERE ke.from_node = NEW.target_id
           AND ke.edge_type = 'SUPERSEDES'
           AND ke.is_active = 1
      );
END;

-- ============================================================
-- [C-2] "승인 기록이 앞선 미발효 INSERT" 차단 — 3종 대칭
-- ============================================================
-- 정상 순서는 "행 INSERT → 검수 → 승격 전이" 다. 역순(전이 먼저)이면 0045 [A] 의 EXISTS 가
-- 대상 부재로 거짓이 되어 게이트를 통과하고, 그 뒤에 들어오는 행은 어떤 게이트도 거치지 않는다.
-- 여기서 그 행이 **오늘 무효**면 곧바로 "승인 + 미시행" 위험 구간이 성립한다.
--
-- 판정은 0045 [B] 와 같은 단일 진실원 미러(최신 전이 + rowid DESC 타이브레이커)를 쓴다.
-- 전이 이력이 없으면 'draft' → 미발화 (= 개정본을 미리 만들어 두는 정상 경로는 그대로 열려 있다).

DROP TRIGGER IF EXISTS enforce_insert_within_effectivity_nodes;
CREATE TRIGGER enforce_insert_within_effectivity_nodes
BEFORE INSERT ON knowledge_nodes
WHEN COALESCE(
       (SELECT st.to_status
          FROM status_transitions st
         WHERE st.target_type = 'node' AND st.target_id = NEW.id
         ORDER BY st.transitioned_at DESC, st.rowid DESC
         LIMIT 1),
       'draft') = 'approved'
  AND (
       (NEW.valid_from  IS NOT NULL AND COALESCE(date(NEW.valid_from)  <= date('now','+9 hours'), 0) = 0)
    OR (NEW.valid_until IS NOT NULL AND COALESCE(date(NEW.valid_until) >  date('now','+9 hours'), 0) = 0)
  )
BEGIN
  SELECT RAISE(ABORT, 'Insert blocked: the latest status transition for this knowledge_node id is approved, and the row being inserted is not effective today. Insert the row first, then promote it on/after its effective date (policy (C) 2026-08-07).');
END;

DROP TRIGGER IF EXISTS enforce_insert_within_effectivity_formulas;
CREATE TRIGGER enforce_insert_within_effectivity_formulas
BEFORE INSERT ON formulas
WHEN COALESCE(
       (SELECT st.to_status
          FROM status_transitions st
         WHERE st.target_type = 'formula' AND st.target_id = NEW.id
         ORDER BY st.transitioned_at DESC, st.rowid DESC
         LIMIT 1),
       'draft') = 'approved'
  AND (
       (NEW.valid_from  IS NOT NULL AND COALESCE(date(NEW.valid_from)  <= date('now','+9 hours'), 0) = 0)
    OR (NEW.valid_until IS NOT NULL AND COALESCE(date(NEW.valid_until) >  date('now','+9 hours'), 0) = 0)
  )
BEGIN
  SELECT RAISE(ABORT, 'Insert blocked: the latest status transition for this formula id is approved, and the row being inserted is not effective today. Insert the row first, then promote it on/after its effective date (policy (C) 2026-08-07).');
END;

DROP TRIGGER IF EXISTS enforce_insert_within_effectivity_constants;
CREATE TRIGGER enforce_insert_within_effectivity_constants
BEFORE INSERT ON constants
WHEN COALESCE(
       (SELECT st.to_status
          FROM status_transitions st
         WHERE st.target_type = 'constant' AND st.target_id = NEW.id
         ORDER BY st.transitioned_at DESC, st.rowid DESC
         LIMIT 1),
       'draft') = 'approved'
  AND (
       (NEW.valid_from  IS NOT NULL AND COALESCE(date(NEW.valid_from)  <= date('now','+9 hours'), 0) = 0)
    OR (NEW.valid_until IS NOT NULL AND COALESCE(date(NEW.valid_until) >  date('now','+9 hours'), 0) = 0)
  )
BEGIN
  SELECT RAISE(ABORT, 'Insert blocked: the latest status transition for this constant id is approved, and the row being inserted is not effective today. Insert the row first, then promote it on/after its effective date (policy (C) 2026-08-07).');
END;

-- ============================================================
-- 본 마이그가 **막지 않는 것** (정직 기록 — 0045 헤더의 과대 주장을 반복하지 않는다)
-- ============================================================
-- ① formulas / constants 의 은퇴 경로 — 0014 `mav_formulas_supersedes_deactivate` /
--    `mav_constants_supersedes_deactivate` 는 `superseded_by` 가 채워진 행이 INSERT 되면
--    **status 도 시행일도 보지 않고** 구본을 은퇴시킨다. status_transitions 를 거치지 않으므로
--    0045 [A] 도 본 마이그 [C-2] 도 발화하지 않는다(실측 재현 확인).
--    → 처분 = 0042 헤더가 이미 예약한 **0043 슬롯**. 그때까지 정책은 불변:
--      **formulas/constants 적재에 `superseded_by` 사용 금지.** 현재 학습자 실피해 0
--      (런타임 계산 소비자 0건)이나, "3종 대칭으로 다 잠갔다"고 읽으면 안 된다.
-- ② knowledge_edges 의 `is_active` 0→1 플립 — 0039 가 허용하는데 은퇴 트리거는 AFTER INSERT
--    전용이라 발화하지 않는다 → 구·신 동시 노출 가능. 관측 = 러너 `LINEAGE_DUAL_ACTIVE`.
--    기계 차단은 별건 슬롯(원장 등재).
-- ③ 시각 경과형(`valid_until` 도래) — 트리거로 원리상 불가. 관측 = 러너 `LINEAGE_LAPSE`
--    (0046 동커밋에서 신설. 단 러너는 **수동 실행**이며 CI 미배선 = 자동 감시 아님).
-- ④ 다문장 승격 파일의 **부분 적용** — ABORT 앞 문장은 커밋된다. `INSERT OR IGNORE` 도
--    BEFORE 트리거가 UNIQUE 충돌보다 먼저 돌아 재실행이 하드 실패한다(실측).
--    → 처분 = 런북 pre-flight SELECT 의무화(별건). 트리거로 막을 수 있는 종류가 아니다.
-- ⑤ **승격 후 강등**(approved → flagged) — 구본은 이미 은퇴 확정인데 신본이 승인 상태를 잃어
--    양쪽 다 미서빙이 된다. 전이 자체는 0010 이 허용하는 정당한 조작이라 트리거로 막을 것이 아니다
--    (막으면 오적재 회수 경로가 사라진다). 이미 알려진 항목: 0042 헤더 §10 후속 원장 ②.
--    관측 = 러너 `LINEAGE_GAP`(성분 단위). 2R 독립 검증이 실측 재현했고 이 목록의 결손도 지적했다.
-- ⑦ **다중홉 체인에서 승격 순서가 계보 순서와 다를 때의 stale 노출 (본 마이그가 만든 대가)** —
--    `A sup B sup C` 에서 최신본 A 가 **먼저** 승인되면 B 는 그 시점에 은퇴(active=0)한다. 이후 B 를
--    승격해도 [C-1]/[C-3] 의 `is_current_active = 1` 조건 때문에 **B 는 C 를 은퇴시키지 못한다**
--    → 서빙 = [C, A] 로 **구식 원본 C 가 최신본과 나란히 노출**된다(3R 실측: 0046 없으면 [A] 단독).
--    ★이 조건을 빼면 반대로 blackout 이 난다(비활성 승계자가 구본만 은퇴시킴 — G-0046-10 이 고정).
--      즉 **알고 택한 트레이드오프**다: 정보 소멸(blackout) 대신 정보 과잉(stale)을 택했다.
--    현 production 실피해 0(활성 SUPERSEDES 엣지 0건). 관측 공백도 있다 —
--    `LINEAGE_DUAL_ACTIVE` 는 엣지 국소 판정이라 A–B·B–C 어느 쪽도 "둘 다 서빙"이 아니어서 무보고다.
--    → 처분 = 현재 동작을 시나리오 테스트로 고정(G-0046-11) + 본 항 등재. 관측 보강은 별건.
-- ⑥ **복구·재적재 제약 (본 마이그의 대가 — 정직 기록)** — [C-2] 는 "최신 전이 = approved 인 id 를
--    오늘 무효인 행으로 INSERT" 를 막는다. 그 결과 **만료된 approved 행을 그대로 되살리는 경로가
--    닫힌다**: 전이 선행도(→[C-2] ABORT) 노드 선행도(→0045 [A] ABORT) 실패한다(실측).
--    정본 복구 경로는 Temporal Graph 원칙대로 **신규 id + 승격**이다. 다만 R2 스냅샷 전량 복원
--    (docs/runbooks/migration-rollback.md)이 영향을 받는지는 wrangler 덤프의 문장 순서에 달려 있고
--    **미판정**이다 → production 적용 전 DR 리허설 1회를 절차에 넣을 것.
--
-- ============================================================
-- down (수동 롤백 — DDL only, 데이터 영향 0):
--   DROP TRIGGER IF EXISTS enforce_insert_within_effectivity_nodes;
--   DROP TRIGGER IF EXISTS enforce_insert_within_effectivity_formulas;
--   DROP TRIGGER IF EXISTS enforce_insert_within_effectivity_constants;
--   -- ★[C-1]·[C-3] 은 DROP 이 아니라 **0042 원본으로 되돌려야 한다** — 그냥 DROP 하면
--   --   승계 은퇴 자체가 사라져 구·신 영구 동시 노출이 된다. 0042 의 [1]·[2] 블록
--   --   (각각 DROP + CREATE)을 그대로 재실행할 것. 즉 롤백 = "DROP 3 + 0042 [1][2] 재실행"이며
--   --   "DROP 4(또는 5)" 가 아니다. (2R 리뷰가 카드·대시보드의 'DROP 4' 표기를 오류로 지적)
--   -- ⚠️ 0042 를 **나중에 재실행**하면 [C-1]·[C-3] 이 무음 revert 된다. 경보는 시나리오
--   --   테스트 G-0046-8 하나뿐이므로, 0042 재실행 시 본 마이그를 반드시 뒤에 다시 적용할 것.
--   ⚠️ 롤백 = 세 번째 문 재개방. 0039(부활 차단)가 켜진 상태에서의 단독 롤백은
--      "발생은 막지 못하고 복구만 막힌" 최악 조합이다 — 0039·0045 와 함께 판단할 것.
-- ============================================================
