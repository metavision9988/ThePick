-- ============================================================
-- Migration 0039: knowledge_edges UPDATE/DELETE 가드 + knowledge_nodes 부활(0→1) 차단
-- ============================================================
-- STATUS: 선작성본 — **production 적용(wrangler --remote) 미승인**.
--   승인 범위 = SQL 작성·로컬 검증까지 (진산 2026-08-06 "0·1단계 진행").
--   집행 승인 = ws-2b plan §8 마지막 행 = 여전히 대기 (TR-0/0038 선례 절차).
--
-- plan   : docs/plans/ws-2b-knowledge-edges-guard.plan.md (D-1=A안 · D-2=(a) ABORT · Amendment 2026-08-06)
-- 근거   : docs/plans/catchall-역이식-분석-20260806.md §3-C
--          docs/plans/catchall-역이식-체크리스트.md STAGE 1 (1-1·1-2)
-- 카드   : docs/plans/master-remediation-20260610/decision-card-3-knowledge-edges-guard.md ((a) 채택)
--
-- ── 왜 필요한가 (실측) ────────────────────────────────────────────────────────
-- ① knowledge_edges = production 보호 체계의 **마지막 무가드 테이블**.
--    `BEFORE DELETE` 가드는 knowledge_nodes/formulas/constants(0014) · status_transitions(0010) ·
--    review_decisions(0013) · engine_telemetry(0017) 에 있는데 **knowledge_edges 에만 없다**.
--    현 엣지 1,347개가 DELETE·본문 UPDATE 무방비다.
-- ② knowledge_nodes 의 `is_current_active` 는 **어느 UPDATE 가드 WHEN 절에도 열거돼 있지 않다**
--    (0014 → 0019 → 0041 재구축 전수 확인). 설계 의도는 "은퇴 플립(1→0)만 허용"이었으나
--    실제로는 **부활(0→1)도 자유 통과**한다. 즉 개정으로 은퇴시킨 구본이 UPDATE 한 줄로 되살아나
--    학습자에게 옛 기준이 다시 서빙될 수 있다.
--    0013:58-60 이 *"방어: application 레이어 강제"* 라고 자인해 둔 지점 = 부탁이지 기계강제가 아니었다.
--
-- ── 설계 (A안: 컬럼별 IS NOT 화이트리스트) ────────────────────────────────────
-- 엣지 UPDATE: `is_active` 플립 **한 가지만** 허용. 그 외 7컬럼(id/from_node/to_node/
--   edge_type/condition/priority/created_at) 변경은 전부 ABORT (D-2 = (a) — condition·priority 도 차단).
--   → E0-2 류 그래프 수리(stale 엣지 비활성화)와 Track B 고아 수리(INSERT-only)는 그대로 살아 있다.
-- 엣지 DELETE: 전면 ABORT. 감사 이력 보존 = Temporal Graph 의 기본 계약.
-- 노드 부활 : `OLD.is_current_active = 0 AND NEW.is_current_active = 1` 만 정확히 겨냥한 **별도**
--   트리거로 차단. 0041 트리거를 DROP/재생성하지 않는다 — 재생성은 그 자체가 회귀 표면이고,
--   본 조건은 직교라 독립 트리거가 더 안전하다(최소 변경 원칙).
--
-- ★ 신규 컬럼 추가 시 의무: knowledge_edges 에 컬럼을 추가하면 아래 WHEN 절에 **반드시 등재**한다.
--   미등재 컬럼은 무음 통과한다 (0041 이 겪은 것과 동일한 함정 — 0038/ADR-046 §D-5 준용).
--
-- ★ 복구 절차 제약 (부활 차단의 대가 — 명시 기록):
--   은퇴(1→0)를 되돌릴 수 없게 되므로, 잘못 은퇴시킨 경우의 복구는
--   **신규 노드 INSERT + 승격**으로만 한다 (Temporal Graph 원칙 정합 — 과거를 고쳐 쓰지 않는다).
--
-- ★★ 0042 승계 트리거와의 상호작용 — **결재로 해소됨 (2026-08-07)**:
--   [문제] 0042 는 개정본이 **승인되는 시점**에 구본을 은퇴시킨다(시행 시점이 아니라). 그런데
--     2026-08-06 배선된 시행시점 창은 **미발효 개정본을 서빙에서 제외**한다. 두 규칙이 만나면
--     구본 = 은퇴(0042) · 신본 = 미발효 배제 → **그 주제가 학습자 화면에서 사라진다**(blackout).
--     그리고 본 마이그의 부활 차단이 in-place 복구를 막으므로, 복구는 위 "신규 INSERT + 승격"뿐이다.
--   [해소] 진산 결재 (C) — `docs/plans/decision-card-20260807-supersedes-effectivity.md` §5.
--     **마이그 0045** 가 "오늘 유효하지 않은 판본은 approved 로 전이할 수 없다"를 기계강제한다.
--     승격이 곧 시행일 이후에만 일어나므로 0042 는 정상 발화하고 위 결합이 성립하지 않는다.
--     (검토된 대안 (a) "승계자 발효 시에만 은퇴"는 실측에서 기각 — SQLite 에 시간 기반 트리거가 없어
--      blackout 이 **구·신 동시 노출**로 바뀔 뿐이었다. 카드 §0 실측표.)
--   [잔여] 시각 경과형(valid_until 도래로 후속본 없이 만료)은 트리거로 불가 → 무결성 러너
--     계보 불변식 `LINEAGE_LAPSE`(노드 전수 스캔)가 사후 관측한다 (packages/quality production-audit).
--     ★단 그 러너는 **수동 실행**이다 — 어느 CI/cron 에도 배선돼 있지 않다(2026-08-07 전수 확인).
--       즉 이 잔여 위험의 방어선은 "돌리면 보인다" 수준이며 **자동 감시가 아니다**.
--   ⚠️★ [해소]의 범위 (2026-08-07 5-페르소나 리뷰 정정): 위 해소는 **0045 단독이 아니라
--     0045 + 0046 을 전제**한다. 0045 만으로는 "전이 선행 우회"(승인 기록을 노드보다 먼저 넣는
--     경로)가 열려 있어 같은 blackout 이 그대로 재현된다(실측). 그리고 **본 파일만 먼저 적용하면
--     "발생은 못 막고 복구만 막힌" 최악 조합**이 된다.
--   ⇒ 본 파일의 production 적용은 **0045·0046 과 한 묶음**으로 한다 (부분 적용·부분 롤백 금지).
--
-- 데이터 변경 0 (DDL only). 롤백 = 말미 down 주석 참조.
-- ============================================================

-- ---------- 1) knowledge_edges UPDATE 가드 (is_active 플립만 허용) ----------
CREATE TRIGGER IF NOT EXISTS prevent_knowledge_edges_update
BEFORE UPDATE ON knowledge_edges
WHEN NEW.id         IS NOT OLD.id
  OR NEW.from_node  IS NOT OLD.from_node
  OR NEW.to_node    IS NOT OLD.to_node
  OR NEW.edge_type  IS NOT OLD.edge_type
  OR NEW.condition  IS NOT OLD.condition
  OR NEW.priority   IS NOT OLD.priority
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on knowledge_edges body columns is forbidden (Temporal Graph). Only is_active flip is allowed; use INSERT of a new edge for any other change.');
END;

-- ---------- 2) knowledge_edges DELETE 가드 (전면 차단) ----------
CREATE TRIGGER IF NOT EXISTS prevent_knowledge_edges_delete
BEFORE DELETE ON knowledge_edges
BEGIN
  SELECT RAISE(ABORT, 'DELETE on knowledge_edges is forbidden (Temporal Graph audit trail). Deactivate with is_active = 0 instead.');
END;

-- ---------- 3) knowledge_nodes 부활(0→1) 차단 ----------
-- 0041 의 prevent_knowledge_nodes_update 는 is_current_active 를 열거하지 않아 양방향 통과.
-- 여기서 **부활 방향만** 정확히 막는다 (은퇴 1→0 은 정당 경로이므로 계속 허용).
CREATE TRIGGER IF NOT EXISTS prevent_knowledge_nodes_reactivation
BEFORE UPDATE ON knowledge_nodes
WHEN OLD.is_current_active = 0 AND NEW.is_current_active = 1
BEGIN
  SELECT RAISE(ABORT, 'Reactivating a retired knowledge_node (is_current_active 0 -> 1) is forbidden (Temporal Graph). Insert a new node and promote it instead.');
END;

-- ============================================================
-- down (수동 롤백 — DDL only, 데이터 영향 0):
--   DROP TRIGGER IF EXISTS prevent_knowledge_edges_update;
--   DROP TRIGGER IF EXISTS prevent_knowledge_edges_delete;
--   DROP TRIGGER IF EXISTS prevent_knowledge_nodes_reactivation;
-- ============================================================
